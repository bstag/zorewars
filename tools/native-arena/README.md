# ZoreWars Desktop Arena

The default wgpu build targets Windows, macOS, and Linux. Run it from the repository
root with Rust installed and a working graphics driver.

```sh
cargo run --release --locked --manifest-path tools/native-arena/Cargo.toml
```

Add `-- warriors/dwarf.red warriors/imp.red` to load specific files. The arena
shows the adapter and graphics backend it selected. Linux builds require the
Wayland development libraries and `pkg-config`. On Debian or Ubuntu, install
`libwayland-dev` and `pkg-config`. The file picker uses the system desktop portal
on Linux.

## Windows GDI build

Build from the repository root with Rust and the Windows MSVC toolchain.

```powershell
cargo run --release --locked --no-default-features --manifest-path tools/native-arena/Cargo.toml
```

Dwarf and Imp are built in. You can pass one to four local `.red` paths to the
executable. In the GPU build, **Warriors → Open .red…** opens a file in the editor. Choose
**Add to match** to keep the current roster or **Use as solo roster** to replace
it. **Load roster from files…** loads one to four files together. The Windows
GDI build uses **Load roster** and **Add warrior**.

The GPU arena restores your roster, match settings, panel sizes, and retained
editor drafts when it opens. **Keep draft** closes the editor and keeps your
changes for **Warriors → Resume draft**. **Save As…** writes a standalone
Redcode file. A single dropped `.red` file opens in the editor and dropping
several files loads them as a roster.

- **Space** runs or pauses. **S** executes one instruction. **R** resets the round.
- In the GPU build, **Step back** rewinds one instruction. The **Cycle** slider
  scrubs through the part of the round already played. Its right edge returns
  to the latest instruction reached, including a breakpoint mid-cycle. **Latest**
  also jumps there when Step back leaves you within that same cycle.
  Scrubbing pauses playback. Run or Step continues from the displayed state.
  Click a trace row's instruction to pause just before it, or click a write
  address to inspect that cell. The inspector's **Last write** link jumps to
  the moment before that write while keeping its target selected.
- Double-click a core cell or use its **Source** link in the debugger to open
  the original Redcode at the highlighted line. Trace rows also have their own
  **Source** links. The debugger follows whole-instruction copies and remembers
  the source that was executed even when the cell is overwritten later. Source
  opened from the debugger is read-only.
- The GPU inspector panel shows the process queue in execution order, a core
  listing with address jumps and opcode or field-value search, and each warrior's
  P-space. Click a queue address to select it for inspection or a breakpoint.
- In the GPU build, **Match → Match settings…** groups rule presets into
  Standard, Small core, Extended and historical, and SAL. The chosen preset
  sets the core, cycle budget, process and length limits, and P-space.
  Choose even spacing, a reproducible seed, or explicit starting addresses in
  roster order. Fixed addresses apply every round. **Run match** advances
  through all scheduled rounds, pausing for breakpoints. **Run round** stops at
  the end of the current round. **Next round** advances manually. The first
  mover rotates, P-space carries over when enabled, and the roster shows
  cumulative pMARS points.
- **Run fast** processes chunks of the match between frames. **Results** shows
  each completed round, process counts over time, death attribution, and changes
  to the original code. **Show killing blow** opens the round just before the
  elimination. **Replay ending** starts up to 80 instructions before the end.
  **Return to match** restores the active round.
- **Match → Save match…** writes a self-contained `.zwmatch` file with the
  Redcode, rule preset, placements, carried P-space, core edits, results, and
  current round position. **Match → Open match…** restores the fight and opens
  **Results** when it contains completed rounds. Select a round and choose
  **Replay round**, **Replay ending**, or **Show killing blow** when available.
  **Choose another round…** returns directly to the round list.
- Use **Warriors → Warrior library…**, or click **Replace** beside a warrior,
  to search bundled Redcode by name or strategy and filter by family. The
  library shows warriors that assemble under the active rules.
- Use **View** to hide or show the inspector and debugger, or drag the panel
  dividers to resize them. The core grid fits the available space.
- In the GPU build, **New warrior** opens an editable Imp starter. Select an
  existing warrior in the inspector and click **Edit source** to change it or
  load a replacement. The editor assembles Redcode as you type under the
  current rules and shows the instruction count and entry offset, or the first
  assembly error with its source line underlined. **Apply and restart match** uses a passing draft in the
  current session. **Save As…** writes the draft to a path you choose.
  Autocomplete suggests opcodes, modifiers, directives, labels, and constants.
  Hover for instruction help. Click a suggestion or press **Tab** to insert the first one.
- **Edit cell** replaces one instruction while paused. Applying the edit starts
  a new rewind history at that point. Reset returns to the loaded warriors.
- **View → Core highlights** switches the grid between all activity, execution,
  writes, process deaths, and queue heads. Queue heads marks the upcoming instruction
  for each warrior, with the next mover in white.
- The grid wraps from cell 7999 to cell 0. Colors show the last writer and brighten
  on recent activity. White marks the last executed cell.
- Click a cell to inspect its instruction and owner. Process counts appear below
  the grid.
- **W** and **E** toggle write and execution breakpoints for the selected cell.
  Both pause after the matching instruction completes, so Step advances to the
  following instruction. The trace shows which warrior acted and what it wrote.
- **H** toggles the first-hit breakpoint. It pauses once per round on the first
  write to a cell last owned by another warrior that still has running processes.
  Operand increments and decrements count as writes. Reset rearms it.
- **Break on process death** pauses immediately after any process dies.
- The **Speed** slider in the GPU build and **Slower** / **Faster** in the GDI
  build adjust how many instructions run per frame.

The desktop app calls the same Rust interpreter as the native CLI addon. The
default is the 8,000-cell ring with 80,000 cycles, 8,000 processes per warrior,
and even spacing. Reset restores the current round's starting state, including
its incoming P-space.

The built-in assembler supports ICWS’94 instructions, addressing modes, labels,
entry points, numeric EQU expressions, assertions, and bounded `FOR`/`ROF`
loops with counters. `PIN` gives a warning and uses private P-space, like the web
assembler. Use plain expanded Redcode for warriors relying on more advanced
pMARS preprocessing. The app runs without Node.js, a browser, or WebAssembly.

## Benchmarking the two Windows renderers

Build each variant into a separate target directory, then run the executables
one at a time with `ZOREWARS_ARENA_BENCHMARK` set to an absolute path for the
timing report.

```powershell
$manifest = 'tools/native-arena/Cargo.toml'
cargo build --release --locked --no-default-features --manifest-path $manifest --target-dir tools/build/arena-gdi
cargo build --release --locked --manifest-path $manifest --target-dir tools/build/arena-gpu
foreach ($renderer in 'gdi', 'gpu') {
    $env:ZOREWARS_ARENA_BENCHMARK = Join-Path $PWD "tools/build/arena-${renderer}.txt"
    Start-Process -Wait "tools/build/arena-$renderer/release/zorewars-arena.exe"
    Get-Content $env:ZOREWARS_ARENA_BENCHMARK
}
Remove-Item Env:ZOREWARS_ARENA_BENCHMARK
```

The benchmark runs the bundled Dwarf vs. Imp fight at 512 instructions per
frame. It aims for 60 FPS, skips the first 15 frames, and records 120 frames.
Leave the test windows visible and avoid interacting with them. Frame interval
measures the time between starts of successive updates. GDI drawing includes
Win32 painting calls. The wgpu build reports UI preparation and eframe’s CPU
frame time separately. Neither timing measures time on the GPU or the instant
the monitor presents a frame.
