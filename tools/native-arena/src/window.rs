use crate::arena::{Arena, Breakpoints, Stop, CYCLES, MAX_WARRIORS, SIZE};
use crate::benchmark::{self, Benchmark};
use std::time::{Duration, Instant};
use std::{
    cell::RefCell,
    mem::size_of,
    path::Path,
    ptr::{null, null_mut},
};
use windows_sys::Win32::{
    Foundation::*,
    Graphics::Gdi::*,
    System::LibraryLoader::GetModuleHandleW,
    UI::{Controls::Dialogs::*, Input::KeyboardAndMouse::SetFocus, WindowsAndMessaging::*},
};

const COLORS: [u32; MAX_WARRIORS] = [0x54e6bb, 0xf8ad64, 0x88a8ff, 0xf187bd];
const BG: u32 = 0x101720;
const PANEL: u32 = 0x1c2633;
const TEXT: u32 = 0xe6edf5;
const MUTED: u32 = 0xaebfd2;
const COLS: usize = 100;
const ROWS: usize = 80;
const ACTIONS: [&str; 11] = [
    "Run / Pause",
    "Step",
    "Reset",
    "Load roster",
    "Add warrior",
    "Remove last",
    "Break on write",
    "Break on exec",
    "First hit",
    "Slower",
    "Faster",
];
const WATCH_COLOR: u32 = 0xffdf75;
const SPEEDS: [u32; 6] = [1, 8, 32, 128, 512, 4096];
const BENCHMARK_FRAME: u32 = WM_APP + 1;

struct App {
    arena: Arena,
    running: bool,
    selected: usize,
    pixels: Vec<u32>,
    breaks: Breakpoints,
    stop: Option<Stop>,
    speed: usize,
    benchmark: Option<Benchmark>,
}

fn toggle(set: &mut std::collections::BTreeSet<usize>, address: usize) {
    if !set.remove(&address) {
        set.insert(address);
    }
}

thread_local! { static APP: RefCell<Option<App>> = const { RefCell::new(None) }; }

fn wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain([0]).collect()
}

pub fn run(arena: Arena) -> Result<(), String> {
    APP.with(|slot| {
        *slot.borrow_mut() = Some(App {
            arena,
            running: false,
            selected: 0,
            pixels: vec![0; SIZE],
            breaks: Breakpoints::default(),
            stop: None,
            speed: 4,
            benchmark: Benchmark::from_env(),
        })
    });
    unsafe {
        let module = GetModuleHandleW(null());
        let class = wide("ZoreWarsNativeArena");
        let style = WNDCLASSW {
            lpfnWndProc: Some(window_proc),
            hInstance: module,
            hCursor: LoadCursorW(null_mut(), IDC_ARROW),
            lpszClassName: class.as_ptr(),
            ..std::mem::zeroed()
        };
        if RegisterClassW(&style) == 0 {
            return Err(std::io::Error::last_os_error().to_string());
        }
        let window_style = WS_OVERLAPPEDWINDOW | WS_CLIPCHILDREN;
        let mut size = RECT {
            left: 0,
            top: 0,
            right: 950,
            bottom: 790,
        };
        if APP.with(|slot| slot.borrow().as_ref().unwrap().benchmark.is_some()) {
            size.right = 940;
            AdjustWindowRectEx(&mut size, window_style, 0, 0);
        }
        let hwnd = CreateWindowExW(
            0,
            class.as_ptr(),
            wide("ZoreWars Arena").as_ptr(),
            window_style,
            CW_USEDEFAULT,
            CW_USEDEFAULT,
            size.right - size.left,
            size.bottom - size.top,
            null_mut(),
            null_mut(),
            module,
            null(),
        );
        if hwnd.is_null() {
            return Err(std::io::Error::last_os_error().to_string());
        }
        ShowWindow(hwnd, SW_SHOW);
        let benchmark_thread = APP
            .with(|slot| slot.borrow().as_ref().unwrap().benchmark.is_some())
            .then(|| {
                let running = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(true));
                let active = running.clone();
                let window = hwnd as usize;
                let thread = std::thread::spawn(move || {
                    let period = Duration::from_nanos(16_666_667);
                    let mut next = Instant::now() + period;
                    while active.load(std::sync::atomic::Ordering::Relaxed) {
                        std::thread::sleep(next.saturating_duration_since(Instant::now()));
                        PostMessageW(window as HWND, BENCHMARK_FRAME, 0, 0);
                        next = (next + period).max(Instant::now());
                    }
                });
                (running, thread)
            });
        let mut msg: MSG = std::mem::zeroed();
        let result = loop {
            match GetMessageW(&mut msg, null_mut(), 0, 0) {
                -1 => break Err(std::io::Error::last_os_error().to_string()),
                0 => break Ok(()),
                _ => {
                    TranslateMessage(&msg);
                    DispatchMessageW(&msg);
                }
            }
        };
        if let Some((running, thread)) = benchmark_thread {
            running.store(false, std::sync::atomic::Ordering::Relaxed);
            let _ = thread.join();
        }
        result
    }
}

unsafe fn choose_file(hwnd: HWND) -> Result<Option<std::path::PathBuf>, String> {
    use std::os::windows::ffi::OsStringExt;
    let mut buffer = [0u16; 32768];
    let filter = wide("Redcode warriors (*.red)\0*.red\0All files\0*.*\0");
    let ofn = OPENFILENAMEW {
        lStructSize: size_of::<OPENFILENAMEW>() as u32,
        hwndOwner: hwnd,
        lpstrFilter: filter.as_ptr(),
        lpstrFile: buffer.as_mut_ptr(),
        nMaxFile: buffer.len() as u32,
        Flags: OFN_FILEMUSTEXIST | OFN_PATHMUSTEXIST | OFN_NOCHANGEDIR,
        ..std::mem::zeroed()
    };
    let mut ofn = ofn;
    if GetOpenFileNameW(&mut ofn) == 0 {
        let error = CommDlgExtendedError();
        return if error == 0 {
            Ok(None)
        } else {
            Err(format!("File dialog failed ({error:#x})"))
        };
    }
    let end = buffer.iter().position(|&c| c == 0).unwrap_or(buffer.len());
    Ok(Some(std::ffi::OsString::from_wide(&buffer[..end]).into()))
}

unsafe fn command(hwnd: HWND, action: usize) {
    if matches!(action, 4 | 5) {
        // A modal file dialog dispatches window messages, so release the state borrow.
        let allowed = APP.with(|slot| {
            let mut slot = slot.borrow_mut();
            let app = slot.as_mut().unwrap();
            app.running = false;
            action == 4 || app.arena.warriors.len() < MAX_WARRIORS
        });
        if allowed {
            match choose_file(hwnd)
                .and_then(|path| path.map(|p| crate::load(Path::new(&p))).transpose())
            {
                Ok(Some(warrior)) => APP.with(|slot| {
                    let mut slot = slot.borrow_mut();
                    let app = slot.as_mut().unwrap();
                    let mut roster = if action == 4 {
                        Vec::new()
                    } else {
                        std::mem::take(&mut app.arena.warriors)
                    };
                    roster.push(warrior);
                    app.arena = Arena::new(roster);
                    app.selected = 0;
                    app.stop = None;
                }),
                Ok(None) => {}
                Err(error) => crate::show_error(&error),
            }
        }
    } else {
        APP.with(|slot| {
            let mut slot = slot.borrow_mut();
            let app = slot.as_mut().unwrap();
            match action {
                1 if !app.arena.done() => {
                    app.running = !app.running;
                    if app.running {
                        app.stop = None;
                    }
                }
                2 => {
                    app.running = false;
                    app.stop = None;
                    app.arena.advance(1);
                }
                3 => {
                    app.running = false;
                    app.stop = None;
                    app.arena.reset();
                }
                6 if app.arena.warriors.len() > 1 => {
                    app.running = false;
                    let mut roster = std::mem::take(&mut app.arena.warriors);
                    roster.pop();
                    app.arena = Arena::new(roster);
                    app.selected = 0;
                    app.stop = None;
                }
                7 => toggle(&mut app.breaks.write, app.selected),
                8 => toggle(&mut app.breaks.execute, app.selected),
                9 => app.breaks.first_hit = !app.breaks.first_hit,
                10 => app.speed = app.speed.saturating_sub(1),
                11 => app.speed = (app.speed + 1).min(SPEEDS.len() - 1),
                _ => {}
            }
        });
    }
    InvalidateRect(hwnd, null(), 0);
    SetFocus(hwnd);
}

fn board(width: i32, height: i32) -> RECT {
    let scale = ((width - 36) / COLS as i32)
        .min((height - 330) / ROWS as i32)
        .max(1);
    let left = ((width - scale * COLS as i32) / 2).max(18);
    RECT {
        left,
        top: 132,
        right: left + scale * COLS as i32,
        bottom: 132 + scale * ROWS as i32,
    }
}

unsafe extern "system" fn window_proc(hwnd: HWND, msg: u32, w: WPARAM, l: LPARAM) -> LRESULT {
    match msg {
        WM_GETMINMAXINFO => {
            let info = &mut *(l as *mut MINMAXINFO);
            info.ptMinTrackSize.x = 730;
            info.ptMinTrackSize.y = 480;
        }
        WM_CREATE => {
            let module = GetModuleHandleW(null());
            let button = wide("BUTTON");
            let controls: Vec<_> = ACTIONS
                .iter()
                .enumerate()
                .map(|(i, label)| {
                    CreateWindowExW(
                        0,
                        button.as_ptr(),
                        wide(label).as_ptr(),
                        WS_CHILD | WS_VISIBLE | WS_TABSTOP,
                        18 + 112 * (i % 6) as i32,
                        53 + 33 * (i / 6) as i32,
                        106,
                        29,
                        hwnd,
                        (i + 1) as HMENU,
                        module,
                        null(),
                    )
                })
                .collect();
            let benchmark = APP.with(|slot| slot.borrow().as_ref().unwrap().benchmark.is_some());
            if controls.iter().any(|handle| handle.is_null())
                || (!benchmark && SetTimer(hwnd, 1, 33, None) == 0)
            {
                return -1;
            }
        }
        WM_COMMAND => command(hwnd, w & 0xffff),
        WM_KEYDOWN => match w {
            0x20 => command(hwnd, 1),
            0x53 => command(hwnd, 2),
            0x52 => command(hwnd, 3),
            0x57 => command(hwnd, 7),
            0x45 => command(hwnd, 8),
            0x48 => command(hwnd, 9),
            _ => return DefWindowProcW(hwnd, msg, w, l),
        },
        WM_TIMER => {
            let changed = APP.with(|slot| {
                let mut slot = slot.borrow_mut();
                let app = slot.as_mut().unwrap();
                if app.benchmark.is_some() {
                    return true;
                }
                if !app.running {
                    return false;
                }
                app.stop = app.arena.run(SPEEDS[app.speed], Some(&app.breaks));
                if let Some(stop) = &app.stop {
                    app.selected = stop.address();
                }
                app.running = app.stop.is_none() && !app.arena.done();
                true
            });
            if changed {
                InvalidateRect(hwnd, null(), 0);
            }
        }
        BENCHMARK_FRAME => {
            InvalidateRect(hwnd, null(), 0);
        }
        WM_SIZE => {
            InvalidateRect(hwnd, null(), 0);
        }
        WM_LBUTTONDOWN => {
            let x = l as i16 as i32;
            let y = (l >> 16) as i16 as i32;
            let mut rect = std::mem::zeroed();
            GetClientRect(hwnd, &mut rect);
            let grid = board(rect.right, rect.bottom);
            if x >= grid.left && x < grid.right && y >= grid.top && y < grid.bottom {
                let column = (x - grid.left) as usize * COLS / (grid.right - grid.left) as usize;
                let row = (y - grid.top) as usize * ROWS / (grid.bottom - grid.top) as usize;
                APP.with(|slot| slot.borrow_mut().as_mut().unwrap().selected = row * COLS + column);
                InvalidateRect(hwnd, null(), 0);
            }
            SetFocus(hwnd);
        }
        WM_PAINT => paint(hwnd),
        WM_DESTROY => {
            KillTimer(hwnd, 1);
            PostQuitMessage(0);
        }
        _ => return DefWindowProcW(hwnd, msg, w, l),
    }
    0
}

fn colorref(rgb: u32) -> u32 {
    ((rgb & 255) << 16) | (rgb & 0xff00) | (rgb >> 16)
}

unsafe fn label(dc: HDC, x: i32, y: i32, color: u32, text: &str) {
    let chars = wide(text);
    SetTextColor(dc, colorref(color));
    TextOutW(dc, x, y, chars.as_ptr(), (chars.len() - 1) as i32);
}

unsafe fn paint(hwnd: HWND) {
    let start = Instant::now();
    let simulation = APP.with(|slot| {
        let mut slot = slot.borrow_mut();
        let app = slot.as_mut().unwrap();
        if app.benchmark.is_none() {
            return Duration::ZERO;
        }
        app.arena.advance(benchmark::STEPS);
        start.elapsed()
    });
    let draw_start = Instant::now();
    let mut ps: PAINTSTRUCT = std::mem::zeroed();
    let dc = BeginPaint(hwnd, &mut ps);
    let mut rect = std::mem::zeroed();
    GetClientRect(hwnd, &mut rect);
    let brush = CreateSolidBrush(colorref(BG));
    FillRect(dc, &rect, brush);
    DeleteObject(brush);
    SetBkMode(dc, TRANSPARENT as i32);
    SelectObject(dc, GetStockObject(DEFAULT_GUI_FONT));
    APP.with(|slot| {
        let mut slot = slot.borrow_mut();
        let app = slot.as_mut().unwrap();
        let arena = &app.arena;
        let status = if arena.done() {
            arena.outcome()
        } else if app.running {
            "Running".into()
        } else {
            "Paused".into()
        };
        let first_hit = if app.breaks.first_hit { "on" } else { "off" };
        label(
            dc,
            18,
            14,
            TEXT,
            &format!(
                "{status}     Cycle {} / {CYCLES}     {} instructions",
                arena.cycle(),
                arena.steps()
            ),
        );
        label(
            dc,
            18,
            33,
            MUTED,
            &format!("Space Run/Pause   S Step   R Reset   W Write   E Execute   H First hit {first_hit}   {} steps/frame", SPEEDS[app.speed]),
        );
        let grid = board(rect.right, rect.bottom);
        for (i, pixel) in app.pixels.iter_mut().enumerate() {
            let fresh = arena.activity[i] != 0 && arena.steps() - arena.activity[i] <= 512;
            let color = arena.owners[i].map(|side| COLORS[side]).unwrap_or(PANEL);
            *pixel = if fresh {
                color
            } else {
                (color & 0xfefefe) >> 1
            };
        }
        app.pixels[app.selected] = TEXT;
        if let Some(pc) = arena.pc() {
            app.pixels[pc] = 0xffffff;
        }
        for &address in app.breaks.write.union(&app.breaks.execute) {
            app.pixels[address] = WATCH_COLOR;
        }
        if let Some(stop) = &app.stop { app.pixels[stop.address()] = WATCH_COLOR; }
        let info = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: COLS as i32,
                biHeight: -(ROWS as i32),
                biPlanes: 1,
                biBitCount: 32,
                ..std::mem::zeroed()
            },
            ..std::mem::zeroed()
        };
        StretchDIBits(
            dc,
            grid.left,
            grid.top,
            grid.right - grid.left,
            grid.bottom - grid.top,
            0,
            0,
            COLS as i32,
            ROWS as i32,
            app.pixels.as_ptr().cast(),
            &info,
            DIB_RGB_COLORS,
            SRCCOPY,
        );
        let owner = arena.owners[app.selected]
            .map(|side| arena.warriors[side].name.as_str())
            .unwrap_or("unowned");
        label(
            dc,
            18,
            grid.bottom + 8,
            TEXT,
            &format!(
                "Cell {:04}    {}    ·    {owner}    ·    Write {} / Execute {}",
                app.selected,
                arena.instruction(app.selected),
                if app.breaks.write.contains(&app.selected) { "on" } else { "off" },
                if app.breaks.execute.contains(&app.selected) { "on" } else { "off" },
            ),
        );
        for (side, warrior) in arena.warriors.iter().enumerate() {
            label(
                dc,
                18,
                grid.bottom + 28 + 17 * side as i32,
                COLORS[side],
                &format!("{}    {} processes", warrior.name, arena.processes(side)),
            );
        }
        if let (Some(stop), Some(entry)) = (&app.stop, arena.trace.back()) {
            let reason = match stop {
                Stop::Execute { .. } => "Execution breakpoint".into(),
                Stop::Write { .. } => "Write breakpoint".into(),
                Stop::ProcessDeath { .. } => "Process died".into(),
                Stop::FirstHit { victim, .. } => format!("First hit on {}", arena.warriors[*victim].name),
            };
            label(dc, 18, grid.bottom + 102, WATCH_COLOR, &format!(
                "{reason} at {:04}   ·   {} executed {:04}   ·   cycle {}, step {}",
                stop.address(), arena.warriors[entry.actor].name, entry.pc, entry.cycle, entry.step));
        }
        for (index, entry) in arena.trace.iter().rev().take(4).enumerate() {
            let writes = entry.writes.iter().flatten().map(|addr| format!("{addr:04}")).collect::<Vec<_>>();
            let writes = if writes.is_empty() { String::new() } else { format!("   wrote {}", writes.join(", ")) };
            let death = if entry.killed { "   process died" } else { "" };
            label(dc, 18, grid.bottom + 124 + index as i32 * 16, MUTED, &format!(
                "#{:<6}  {:04}   {}{writes}{death}", entry.step, entry.pc, arena.warriors[entry.actor].name));
        }
    });
    EndPaint(hwnd, &ps);
    let drawing = draw_start.elapsed();
    let finished = APP.with(|slot| {
        let mut slot = slot.borrow_mut();
        let app = slot.as_mut().unwrap();
        app.benchmark.as_mut().is_some_and(|benchmark| {
            benchmark.sample(start, simulation, drawing, None, app.arena.steps(), "GDI")
        })
    });
    if finished {
        PostQuitMessage(0);
    }
}
