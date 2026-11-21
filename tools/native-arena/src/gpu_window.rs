use crate::arena::{Arena, Breakpoints, SourceLocation, Stop, MAX_WARRIORS};
use crate::benchmark::{self, Benchmark};
use crate::completion::{suggestions, Completions};
use crate::match_file::{CoreEdit, MatchFile, OpenedMatch, RoundResult, EXTENSION};
use crate::match_setup::{MatchSetup, Placement, Preset, MAX_SEED};
use crate::redcode::{
    assemble_with_rules, directive, opcode, Rules, Warrior, CORE_SYMBOLS, MODES, MODS,
};
use crate::timeline::Timeline;
use crate::workspace::{Draft, Workspace};
use eframe::egui::{self, Color32, Key, RichText, TextureHandle, TextureOptions};
use std::time::{Duration, Instant};

const COLORS: [u32; MAX_WARRIORS] = [0x54e6bb, 0xf8ad64, 0x88a8ff, 0xf187bd];
const SPEEDS: [u32; 6] = [1, 8, 32, 128, 512, 4096];
const FRAME_TIME: Duration = Duration::from_nanos(16_666_667);
include!(concat!(env!("OUT_DIR"), "/library.rs"));

pub fn run(arena: Arena) -> Result<(), String> {
    let options = eframe::NativeOptions {
        renderer: eframe::Renderer::Wgpu,
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([940.0, 790.0])
            .with_min_inner_size([620.0, 515.0]),
        ..Default::default()
    };
    eframe::run_native(
        "ZoreWars Arena · GPU",
        options,
        Box::new(|cc| {
            let adapter = cc
                .wgpu_render_state
                .as_ref()
                .ok_or("No wgpu render state")?
                .adapter
                .get_info();
            let mut app = Desktop::new(
                arena,
                format!("{} · {:?}", adapter.name, adapter.backend),
                Benchmark::from_env(),
            );
            if app.benchmark.is_none() {
                app.restore_workspace(std::env::args_os().nth(1).is_none());
            }
            Ok(Box::new(app))
        }),
    )
    .map_err(|error| error.to_string())
}

struct Desktop {
    arena: Arena,
    timeline: Timeline,
    breaks: Breakpoints,
    stop: Option<Stop>,
    selected: usize,
    running: bool,
    play_match: bool,
    speed: usize,
    next_frame: Instant,
    image: Option<TextureHandle>,
    dirty: bool,
    adapter: String,
    error: Option<String>,
    benchmark: Option<Benchmark>,
    warrior: usize,
    view: View,
    display: Activity,
    query: String,
    address: String,
    editor: Option<(usize, String)>,
    source_editor: Option<SourceEditor>,
    source_view: Option<SourceView>,
    setup: MatchSetup,
    setup_draft: Option<SetupDraft>,
    round: u32,
    scores: [u32; MAX_WARRIORS],
    show_inspector: bool,
    show_debugger: bool,
    inspector_width: f32,
    debugger_height: f32,
    workspace_path: Option<std::path::PathBuf>,
    saved_workspace: Option<Workspace>,
    workspace_check: Instant,
    parked_drafts: Vec<Draft>,
    library: Option<LibraryPicker>,
    results_open: bool,
    results: Vec<RoundResult>,
    result_selection: usize,
    replay: Option<ReplayReturn>,
    core_edits: Vec<CoreEdit>,
    match_notice: Option<String>,
    fast: bool,
}

struct SourceView {
    location: SourceLocation,
    scroll_to_line: bool,
}

struct ReplayReturn {
    viewed: usize,
    arena: Arena,
    timeline: Timeline,
    selected: usize,
    stop: Option<Stop>,
}

struct LibraryPicker {
    side: Option<usize>,
    search: String,
    family: String,
    entries: Vec<(&'static str, &'static str, Warrior)>,
}

struct SetupDraft {
    settings: MatchSetup,
    use_built_ins: bool,
}

struct SourceEditor {
    side: Option<usize>,
    fallback: String,
    source: String,
    checked: Result<Warrior, String>,
    saved_to: Option<std::path::PathBuf>,
    focus_on_open: bool,
    modified: bool,
}

impl SourceEditor {
    fn new(side: Option<usize>, source: String, fallback: String, rules: Rules) -> Self {
        let checked = assemble_with_rules(&source, &fallback, rules);
        Self {
            side,
            fallback,
            source,
            checked,
            saved_to: None,
            focus_on_open: true,
            modified: false,
        }
    }

    fn check(&mut self, rules: Rules) {
        self.checked = assemble_with_rules(&self.source, &self.fallback, rules);
        self.saved_to = None;
        self.modified = true;
    }

    fn draft(&self) -> Draft {
        Draft {
            side: self.side,
            fallback: self.fallback.clone(),
            source: self.source.clone(),
        }
    }

    fn completions(
        &self,
        cursor: Option<egui::text::CCursorRange>,
        rules: Rules,
    ) -> Option<Completions> {
        let cursor = cursor.filter(|range| range.is_empty())?;
        suggestions(&self.source, cursor.primary.index, rules)
    }

    fn complete(
        &mut self,
        output: egui::text_edit::TextEditOutput,
        before: egui::text::CCursorRange,
        completion: Completions,
        index: usize,
        rules: Rules,
        ctx: &egui::Context,
    ) {
        let mut state = output.state;
        let mut undoer = state.undoer();
        undoer.add_undo(&(before, self.source.clone()));
        let word = &completion.words[index];
        let caret = self.source[..completion.replace.start].chars().count() + word.chars().count();
        self.source.replace_range(completion.replace, word);
        let after = egui::text::CCursorRange::one(egui::text::CCursor::new(caret));
        undoer.add_undo(&(after, self.source.clone()));
        state.set_undoer(undoer);
        state.cursor.set_char_range(Some(after));
        state.store(ctx, output.response.id);
        output.response.request_focus();
        self.check(rules);
        ctx.request_repaint();
    }
}

fn open_redcode_draft(side: Option<usize>, rules: Rules) -> Result<Option<SourceEditor>, String> {
    let Some(path) = rfd::FileDialog::new()
        .add_filter("Redcode", &["red"])
        .pick_file()
    else {
        return Ok(None);
    };
    let (source, fallback) = crate::read_redcode(&path)?;
    Ok(Some(SourceEditor::new(side, source, fallback, rules)))
}

#[derive(Clone, Copy)]
enum DraftAction {
    Replace(usize),
    Add,
    Solo,
}

#[derive(PartialEq, Eq, Clone, Copy)]
enum View {
    Queue,
    Core,
    Pspace,
}

#[derive(PartialEq, Eq, Clone, Copy)]
enum Activity {
    All,
    Execution,
    Writes,
    Deaths,
    QueueHeads,
}

fn rgb(value: u32) -> Color32 {
    Color32::from_rgb((value >> 16) as u8, (value >> 8) as u8, value as u8)
}

fn toggle(cells: &mut std::collections::BTreeSet<usize>, address: usize) {
    if !cells.remove(&address) {
        cells.insert(address);
    }
}

fn redcode_layout(
    text: &str,
    wrap_width: f32,
    visuals: &egui::Visuals,
    diagnostic_line: Option<usize>,
    source_line: Option<usize>,
) -> egui::text::LayoutJob {
    let mut job = egui::text::LayoutJob::default();
    job.wrap.max_width = wrap_width;
    let plain = visuals.text_color();
    let (op_color, directive_color, number, mode) = if visuals.dark_mode {
        (rgb(0x7fdcff), rgb(0xddadff), rgb(0xffca8c), rgb(0x9ce4bb))
    } else {
        (rgb(0x075575), rgb(0x6f348d), rgb(0x844212), rgb(0x186447))
    };
    for (index, line) in text.split_inclusive('\n').enumerate() {
        let mut append = |text, color| {
            let mut format = egui::TextFormat::simple(egui::FontId::monospace(14.0), color);
            if diagnostic_line == Some(index + 1) {
                format.underline = egui::Stroke::new(
                    1.0_f32,
                    if visuals.dark_mode {
                        Color32::LIGHT_RED
                    } else {
                        Color32::DARK_RED
                    },
                );
            }
            if source_line == Some(index + 1) {
                format.background = visuals.selection.bg_fill.gamma_multiply(0.50);
            }
            job.append(text, 0.0, format);
        };
        let (mut code, comment) = line.find(';').map_or((line, ""), |i| line.split_at(i));
        while let Some(first) = code.chars().next() {
            let word_char = |c: char| c.is_ascii_alphanumeric() || c == '_' || c == '.';
            let (end, color) = if word_char(first) {
                let end = code.find(|c| !word_char(c)).unwrap_or(code.len());
                let word = code[..end].to_ascii_uppercase();
                let (base, modifier) = word.split_once('.').unwrap_or((&word, ""));
                let color = if (opcode(base).is_some() || base == "TRN")
                    && (modifier.is_empty() || MODS.contains(&modifier))
                {
                    op_color
                } else if directive(&word) || CORE_SYMBOLS.contains(&word.as_str()) {
                    directive_color
                } else if first.is_ascii_digit() {
                    number
                } else {
                    plain
                };
                (end, color)
            } else {
                (
                    first.len_utf8(),
                    if MODES.contains(first) { mode } else { plain },
                )
            };
            append(&code[..end], color);
            code = &code[end..];
        }
        append(comment, visuals.weak_text_color());
    }
    job
}

fn word_help(word: &str) -> Option<&'static str> {
    Some(match word {
        "DAT" => "Data. Executing it kills the process.",
        "MOV" => "Copy A to B. The modifier chooses which fields to copy.",
        "ADD" => "Add A to B, wrapping at the core size.",
        "SUB" => "Subtract A from B, wrapping at the core size.",
        "MUL" => "Multiply B by A, wrapping at the core size.",
        "DIV" => "Divide B by A. Division by zero kills the process.",
        "MOD" => "Store the remainder of B divided by A. Zero kills the process.",
        "JMP" => "Jump to A.",
        "JMZ" => "Jump to A if the selected B fields are zero.",
        "JMN" => "Jump to A if the selected B fields are nonzero.",
        "DJN" => "Decrement B, then jump to A if it is nonzero.",
        "SPL" => "Queue the next instruction, then queue a child at A.",
        "SLT" => "Skip the next instruction if A is less than B.",
        "SEQ" | "CMP" => "Skip the next instruction if A equals B.",
        "SNE" => "Skip the next instruction if A differs from B.",
        "NOP" => "Continue to the next instruction.",
        "LDP" => "Load P-space cell A into B.",
        "STP" => "Store A in P-space cell B.",
        "ORG" => "Set the execution entry point.",
        "END" => "End the warrior and optionally set the entry point.",
        "EQU" => "Define a named expression.",
        "FOR" => "Repeat the block up to ROF.",
        "ROF" => "Close a FOR block.",
        "PIN" => "Declare a P-space identifier. ZoreWars uses private P-space.",
        "A" => "A-field to A-field.",
        "B" => "B-field to B-field.",
        "AB" => "A-field to B-field.",
        "BA" => "B-field to A-field.",
        "F" => "Both fields.",
        "X" => "Both fields, crossed.",
        "I" => "Whole instruction where the opcode supports it.",
        _ => return None,
    })
}

#[cfg(test)]
#[test]
fn highlights_preserve_source_bytes_and_distinguish_redcode_tokens() {
    let source = "org loop\nloop mov.i #23, >target ; café\n";
    let visuals = egui::Visuals::dark();
    let job = redcode_layout(source, 300.0, &visuals, Some(2), None);
    assert_eq!(job.text, source);
    let color = |token: &str| {
        let offset = source.find(token).unwrap();
        job.sections
            .iter()
            .find(|section| section.byte_range.contains(&offset))
            .unwrap()
            .format
            .color
    };
    assert_ne!(color("mov.i"), color("loop"));
    assert_ne!(color("mov.i"), color("org"));
    assert_ne!(color("#"), color("23"));
    assert_eq!(color("café"), visuals.weak_text_color());
    assert!(job
        .sections
        .iter()
        .find(|section| section.byte_range.contains(&source.find("mov.i").unwrap()))
        .is_some_and(|section| section.format.underline.width > 0.0));
}

#[cfg(test)]
#[test]
fn source_dialog_checks_pasted_redcode_and_applies_only_the_valid_draft() {
    let warriors = [crate::redcode::assemble("JMP 0", "Original").unwrap()];
    let setup = MatchSetup {
        preset: Preset::LimitedProcess,
        ..Default::default()
    };
    let mut desktop = Desktop::new(setup.start(&warriors).unwrap(), String::new(), None);
    desktop.setup = setup;
    desktop.source_editor = Some(SourceEditor::new(
        None,
        String::new(),
        "Draft".into(),
        desktop.arena.rules,
    ));
    let ctx = egui::Context::default();
    let draw = |desktop: &mut Desktop, events| {
        let _ = ctx.run_ui(
            egui::RawInput {
                events,
                ..Default::default()
            },
            |ui| desktop.source_dialog(ui.ctx()),
        );
    };
    draw(&mut desktop, vec![]);
    draw(
        &mut desktop,
        vec![egui::Event::Paste("STP.AB #1, #1\n".into())],
    );
    let editor = desktop.source_editor.as_ref().unwrap();
    assert_eq!(editor.source, "STP.AB #1, #1\n");
    assert_eq!(
        editor.checked.as_ref().err().unwrap(),
        "line 1: STP.AB requires P-space"
    );
    desktop.apply_source(DraftAction::Add);
    assert_eq!(desktop.arena.warriors.len(), 1);

    let prefix = ";assert MAXPROCESSES == 8\nORG loop\nDAT 0\nloop JMP loo";
    let key = |key, modifiers| egui::Event::Key {
        key,
        physical_key: None,
        pressed: true,
        repeat: false,
        modifiers,
    };
    draw(
        &mut desktop,
        vec![
            key(Key::A, egui::Modifiers::COMMAND),
            egui::Event::Paste(prefix.into()),
        ],
    );
    assert!(desktop.source_editor.as_ref().unwrap().checked.is_err());
    draw(&mut desktop, vec![key(Key::Tab, egui::Modifiers::NONE)]);
    let editor = desktop.source_editor.as_ref().unwrap();
    assert_eq!(editor.source, format!("{prefix}p"));
    assert_eq!(editor.checked.as_ref().ok().unwrap().start, 1);
    draw(&mut desktop, vec![key(Key::Z, egui::Modifiers::COMMAND)]);
    assert_eq!(desktop.source_editor.as_ref().unwrap().source, prefix);
    draw(&mut desktop, vec![key(Key::Tab, egui::Modifiers::NONE)]);
    desktop.apply_source(DraftAction::Add);
    assert!(desktop.source_editor.is_none());
    assert_eq!(desktop.arena.warriors.len(), 2);
    assert_eq!(desktop.warrior, 1);
    assert_eq!(desktop.arena.queued(1, 0), Some(4001));
}

#[cfg(test)]
#[test]
fn run_match_respects_breakpoints_and_scores_each_round_once() {
    let setup = MatchSetup {
        preset: Preset::Nano,
        rounds: 3,
        ..Default::default()
    };
    let warriors = [
        crate::redcode::assemble("JMP 0", "Survivor").unwrap(),
        crate::redcode::assemble("DAT 0", "Loser").unwrap(),
    ];
    let mut desktop = Desktop::new(setup.start(&warriors).unwrap(), String::new(), None);
    desktop.setup = setup;
    desktop.breaks.process_death = true;
    desktop.run_pause(true);
    desktop.tick(desktop.next_frame);
    assert_eq!(desktop.round, 1);
    assert!(desktop.arena.done());
    assert!(!desktop.running);
    assert_eq!(desktop.stop, Some(Stop::ProcessDeath { address: 40 }));
    desktop.breaks.process_death = false;
    desktop.run_pause(true);
    desktop.tick(desktop.next_frame);
    assert_eq!(desktop.round, 2);
    assert_eq!(desktop.arena.pc(), Some(40));
    assert!(desktop.running);
    desktop.tick(desktop.next_frame);
    assert_eq!(desktop.round, 3);
    assert!(!desktop.running);
    assert!(desktop.arena.done());
    assert_eq!(desktop.scores[0] + desktop.arena.round_score(0), 9);
    assert_eq!(desktop.scores[1], 0);
    assert_eq!(desktop.results.len(), 3);
    let blow = desktop.results[0].elimination.unwrap();
    assert_eq!((blow.address, blow.step), (40, 2));
    let last_step = desktop.arena.steps();
    desktop.replay_result(0, blow.step - 1, Some(blow.address));
    assert_eq!(desktop.arena.steps(), 1);
    assert_eq!(desktop.arena.processes(1), 1);
    desktop.step();
    assert!(desktop.arena.done());
    assert_eq!(desktop.results.len(), 3);
    desktop.return_from_replay();
    assert_eq!(desktop.arena.steps(), last_step);
    assert_eq!(desktop.round, 3);
}

#[cfg(test)]
#[test]
fn batch_results_show_attributed_deaths_and_assemble_compatible_library_entries() {
    let setup = MatchSetup {
        preset: Preset::Nano,
        rounds: 3,
        ..Default::default()
    };
    let warriors = [
        crate::redcode::assemble("MOV.I 1, 40\nDAT 0", "Bomber").unwrap(),
        crate::redcode::assemble("JMP 0", "Target").unwrap(),
    ];
    let mut desktop = Desktop::new(setup.start(&warriors).unwrap(), String::new(), None);
    desktop.setup = setup;
    desktop.open_library(None);
    let library = desktop.library.take().unwrap();
    assert!(library.entries.iter().any(|(name, _, _)| *name == "Imp"));
    assert!(library
        .entries
        .iter()
        .all(|(_, _, warrior)| warrior.code.len() <= 5));
    desktop.run_pause(true);
    desktop.fast = true;
    for _ in 0..3 {
        desktop.tick(desktop.next_frame);
    }
    assert_eq!(desktop.results.len(), 3);
    assert!(!desktop.running);
    let result = &desktop.results[0];
    let blow = result.elimination.unwrap();
    assert_eq!(blow.address, 40);
    assert_eq!(result.stats[1].deaths, [0, 1, 0, 0]);
    assert_eq!(blow.writer.unwrap().actor, 0);
    assert_eq!(result.stats[1].foreign_steps, 1);
    assert_eq!(result.changed[1][0].address, 40);
    assert_eq!(result.samples.last().unwrap().counts[1], 0);
}

#[cfg(test)]
#[test]
fn resuming_a_slot_draft_keeps_other_warrior_drafts() {
    let arena = Arena::new(Preset::Classic.starter().unwrap());
    let mut desktop = Desktop::new(arena, String::new(), None);
    desktop.parked_drafts = vec![
        Draft {
            side: Some(0),
            fallback: "Dwarf".into(),
            source: "JMP 1".into(),
        },
        Draft {
            side: Some(1),
            fallback: "Imp".into(),
            source: "JMP 2".into(),
        },
    ];
    desktop.edit_source(1);
    assert_eq!(desktop.source_editor.as_ref().unwrap().source, "JMP 2");
    assert_eq!(desktop.parked_drafts[0].source, "JMP 1");
}

#[cfg(test)]
#[test]
fn match_file_restores_the_active_cursor_and_replays_individual_rounds() {
    let setup = MatchSetup {
        preset: Preset::Nano,
        placement: Placement::Seeded,
        seed: 321,
        rounds: 3,
        ..Default::default()
    };
    let warriors = [
        crate::redcode::assemble("STP.AB #7, #1\nJMP 0", "Store").unwrap(),
        crate::redcode::assemble("JMP 0", "Wait").unwrap(),
    ];
    let mut desktop = Desktop::new(setup.start(&warriors).unwrap(), String::new(), None);
    desktop.setup = setup;
    let target = desktop.arena.positions[1];
    desktop.step();
    desktop.apply_core_edit(target, "DAT 0").unwrap();
    desktop.apply_core_edit(1, "JMP 0").unwrap();
    desktop.step();
    assert!(desktop.arena.done());
    assert!(desktop.next_round());
    let second_positions = desktop.arena.positions.clone();
    desktop.timeline.advance(&mut desktop.arena, 1600, None);
    desktop.capture_round();
    assert!(desktop.next_round());
    desktop.timeline.advance(&mut desktop.arena, 32, None);
    desktop.timeline.seek_step(&mut desktop.arena, 12);
    desktop.selected = 17;

    let path = std::env::temp_dir().join(format!("zorewars-match-{}.zwmatch", std::process::id()));
    let file = MatchFile::new(
        &desktop.setup,
        desktop.round,
        &desktop.arena,
        &desktop.timeline,
        &desktop.core_edits,
        desktop.selected,
        &desktop.results,
    );
    file.write(&path).unwrap();
    let reopened = OpenedMatch::read(&path).unwrap();
    std::fs::remove_file(&path).unwrap();
    desktop.apply_saved_match(reopened);
    assert!(desktop.results_open);
    assert_eq!(desktop.arena.steps(), 12);
    assert_eq!(desktop.timeline.latest_step(), 32);
    assert_eq!(desktop.selected, 17);
    assert_eq!(desktop.scores[..2], [4, 1]);

    desktop.replay_result(1, 0, None);
    assert_eq!(desktop.arena.positions, second_positions);
    assert_eq!(desktop.arena.next_actor(), Some(1));
    assert_eq!(&desktop.arena.pspace(0)[..2], &[1, 7]);
    desktop.return_from_replay();
    desktop.replay_result(0, 0, None);
    assert_eq!(desktop.arena.steps(), 0);
    assert!(desktop.arena.instruction(target).starts_with("JMP"));
    let source = desktop.arena.cell_source(target).unwrap();
    assert_eq!(source.warrior, 1);
    desktop.show_instruction_source(source);
    assert!(desktop.modal_open());
    assert!(desktop.source_editor.is_none());
    assert_eq!(desktop.source_view.take().unwrap().location, source);
    desktop.step();
    assert!(desktop.arena.instruction(target).starts_with("DAT"));
    desktop.step();
    assert_eq!(desktop.arena.outcome(), "Store wins");
    assert_eq!(desktop.arena.cell_source(target), None);
    desktop.timeline.seek_step(&mut desktop.arena, 0);
    desktop.timeline.seek_step(&mut desktop.arena, 2);
    assert_eq!(desktop.arena.outcome(), "Store wins");
    desktop.return_from_replay();
    assert_eq!(desktop.round, 3);
    assert_eq!(desktop.arena.steps(), 12);
}

impl Desktop {
    fn new(arena: Arena, adapter: String, benchmark: Option<Benchmark>) -> Self {
        Self {
            timeline: Timeline::new(&arena),
            arena,
            breaks: Breakpoints::default(),
            stop: None,
            selected: 0,
            running: false,
            play_match: false,
            speed: 4,
            next_frame: Instant::now(),
            image: None,
            dirty: true,
            adapter,
            error: None,
            benchmark,
            warrior: 0,
            view: View::Queue,
            display: Activity::All,
            query: String::new(),
            address: String::new(),
            editor: None,
            source_editor: None,
            source_view: None,
            setup: MatchSetup::default(),
            setup_draft: None,
            round: 1,
            scores: [0; MAX_WARRIORS],
            show_inspector: true,
            show_debugger: true,
            inspector_width: 225.0,
            debugger_height: 180.0,
            workspace_path: None,
            saved_workspace: None,
            workspace_check: Instant::now() + Duration::from_secs(1),
            parked_drafts: Vec::new(),
            library: None,
            results_open: false,
            results: Vec::new(),
            result_selection: 0,
            replay: None,
            core_edits: Vec::new(),
            match_notice: None,
            fast: false,
        }
    }

    fn restore_workspace(&mut self, restore_roster: bool) {
        let Some(path) = Workspace::path() else {
            return;
        };
        self.workspace_path = Some(path.clone());
        match Workspace::read(&path) {
            Ok(saved) => {
                if restore_roster {
                    match saved.arena() {
                        Ok(arena) => {
                            self.warrior = saved.warrior;
                            self.start_match(saved.setup.clone(), arena);
                            self.parked_drafts = saved.drafts.clone();
                        }
                        Err(error) => {
                            self.error = Some(format!("Could not restore workspace. {error}"));
                            self.workspace_path = None;
                        }
                    }
                } else {
                    self.parked_drafts = saved
                        .drafts
                        .iter()
                        .cloned()
                        .map(|mut draft| {
                            draft.side = None;
                            draft
                        })
                        .collect();
                }
                self.show_inspector = saved.show_inspector;
                self.show_debugger = saved.show_debugger;
                self.inspector_width = saved.inspector_width.max(160.0);
                self.debugger_height = saved.debugger_height.max(72.0);
                self.saved_workspace = Some(saved);
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => {
                self.error = Some(format!("Could not read workspace. {error}"));
                self.workspace_path = None;
            }
        }
    }

    fn save_workspace(&mut self) {
        let Some(path) = &self.workspace_path else {
            return;
        };
        let current = Workspace {
            setup: self.setup.clone(),
            roster: self
                .arena
                .warriors
                .iter()
                .map(|warrior| (warrior.fallback.to_string(), warrior.source.to_string()))
                .collect(),
            drafts: self
                .parked_drafts
                .iter()
                .cloned()
                .chain(self.source_editor.as_ref().map(SourceEditor::draft))
                .collect(),
            warrior: self.warrior,
            inspector_width: self.inspector_width,
            debugger_height: self.debugger_height,
            show_inspector: self.show_inspector,
            show_debugger: self.show_debugger,
        };
        if self.saved_workspace.as_ref() != Some(&current) {
            match current.write(path) {
                Ok(()) => self.saved_workspace = Some(current),
                Err(error) => self.error = Some(format!("Could not save workspace. {error}")),
            }
        }
    }

    fn resume_slot_draft(&mut self, side: usize) -> bool {
        if let Some(index) = self
            .parked_drafts
            .iter()
            .position(|draft| draft.side == Some(side))
        {
            self.resume_draft(index);
            return true;
        }
        false
    }

    fn resume_draft(&mut self, index: usize) {
        let draft = self.parked_drafts.remove(index);
        self.running = false;
        let side = draft.side.filter(|&side| side < self.arena.warriors.len());
        let mut editor = SourceEditor::new(side, draft.source, draft.fallback, self.arena.rules);
        editor.modified = true;
        self.source_editor = Some(editor);
        self.error = None;
    }

    fn run_pause(&mut self, play_match: bool) {
        self.fast = false;
        if self.running {
            self.running = false;
        } else if !self.arena.done() || play_match && self.has_next_round() {
            self.running = true;
            self.play_match = play_match;
            self.stop = None;
            self.next_frame = Instant::now();
        }
    }

    fn tick(&mut self, now: Instant) {
        if !self.running || now < self.next_frame {
            return;
        }
        let deadline = Instant::now() + Duration::from_millis(7);
        loop {
            if self.arena.done() && (!self.play_match || !self.next_round()) {
                self.running = false;
                break;
            }
            let steps = if self.fast { 4096 } else { SPEEDS[self.speed] };
            self.stop = self
                .timeline
                .advance(&mut self.arena, steps, Some(&self.breaks));
            if let Some(stop) = &self.stop {
                self.selected = stop.address();
            }
            self.capture_round();
            self.running = self.stop.is_none()
                && (!self.arena.done() || self.play_match && self.has_next_round());
            self.dirty = true;
            if !self.running || !self.fast || Instant::now() >= deadline {
                break;
            }
        }
        self.next_frame = now + FRAME_TIME;
    }

    fn step(&mut self) {
        self.running = false;
        self.stop = None;
        self.timeline.advance(&mut self.arena, 1, None);
        self.capture_round();
        self.dirty = true;
    }

    fn reset(&mut self) {
        self.running = false;
        self.stop = None;
        self.arena.reset();
        self.core_edits.clear();
        self.results.truncate((self.round - 1) as usize);
        self.timeline = Timeline::new(&self.arena);
        self.dirty = true;
    }

    fn open_source(&mut self, side: Option<usize>) {
        if self.source_editor.is_none() && side.is_some_and(|side| self.resume_slot_draft(side)) {
            return;
        }
        self.running = false;
        match open_redcode_draft(side, self.arena.rules) {
            Ok(Some(editor)) => {
                self.source_editor = Some(editor);
                self.error = None;
            }
            Ok(None) => {}
            Err(error) => self.error = Some(error),
        }
    }

    fn load_roster_files(&mut self) {
        self.running = false;
        let Some(paths) = rfd::FileDialog::new()
            .add_filter("Redcode", &["red"])
            .pick_files()
        else {
            return;
        };
        self.load_roster_paths(&paths);
    }

    fn load_roster_paths(&mut self, paths: &[std::path::PathBuf]) {
        self.running = false;
        if !(1..=MAX_WARRIORS).contains(&paths.len()) {
            self.error = Some(format!("Choose one to {MAX_WARRIORS} Redcode files"));
            return;
        }
        match paths
            .iter()
            .map(|path| crate::load_with_rules(path, self.arena.rules))
            .collect()
        {
            Ok(warriors) => {
                self.set_roster(warriors);
            }
            Err(error) => self.error = Some(error),
        }
    }

    fn dropped_files(&mut self, ctx: &egui::Context) {
        if self.modal_open() {
            return;
        }
        let paths = ctx.input_mut(|input| {
            std::mem::take(&mut input.raw.dropped_files)
                .into_iter()
                .filter_map(|file| file.path)
                .filter(|path| {
                    path.extension()
                        .is_some_and(|ext| ext.eq_ignore_ascii_case("red"))
                })
                .collect::<Vec<_>>()
        });
        if let [path] = paths.as_slice() {
            self.running = false;
            match crate::read_redcode(path) {
                Ok((source, name)) => {
                    self.error = None;
                    self.source_editor =
                        Some(SourceEditor::new(None, source, name, self.arena.rules));
                }
                Err(error) => self.error = Some(error),
            }
        } else if !paths.is_empty() {
            self.load_roster_paths(&paths);
        }
    }

    fn open_library(&mut self, side: Option<usize>) {
        if side.is_some_and(|side| self.resume_slot_draft(side)) {
            return;
        }
        self.running = false;
        let rules = self.arena.rules;
        let entries = LIBRARY
            .iter()
            .filter_map(|&(name, family, source)| {
                if !rules.icws88 && name.contains("88") {
                    return None;
                }
                assemble_with_rules(source, name, rules)
                    .ok()
                    .map(|warrior| (name, family, warrior))
            })
            .collect();
        self.library = Some(LibraryPicker {
            side,
            search: String::new(),
            family: String::new(),
            entries,
        });
    }

    fn library_dialog(&mut self, ctx: &egui::Context) {
        let Some(picker) = &mut self.library else {
            return;
        };
        let mut chosen = None;
        let mut close = false;
        let modal = egui::Modal::new(egui::Id::new("warrior-library")).show(ctx, |ui| {
            ui.set_width((ctx.content_rect().width() - 64.0).clamp(320.0, 550.0));
            ui.heading("Warrior library");
            ui.horizontal(|ui| {
                ui.add(
                    egui::TextEdit::singleline(&mut picker.search)
                        .hint_text("Search name or strategy"),
                );
                egui::ComboBox::from_id_salt("library-family")
                    .selected_text(if picker.family.is_empty() {
                        "All families"
                    } else {
                        &picker.family
                    })
                    .show_ui(ui, |ui| {
                        ui.selectable_value(&mut picker.family, String::new(), "All families");
                        let families = picker
                            .entries
                            .iter()
                            .map(|(_, family, _)| *family)
                            .collect::<std::collections::BTreeSet<_>>();
                        for family in families {
                            ui.selectable_value(&mut picker.family, family.into(), family);
                        }
                    });
            });
            let query = picker.search.trim().to_lowercase();
            egui::ScrollArea::vertical()
                .max_height(300.0)
                .show(ui, |ui| {
                    ui.set_min_height(300.0);
                    let mut matches = 0;
                    for (name, family, warrior) in &picker.entries {
                        if !picker.family.is_empty() && picker.family != *family {
                            continue;
                        }
                        if !query.is_empty()
                            && !name.to_lowercase().contains(&query)
                            && !family.to_lowercase().contains(&query)
                            && !warrior.source.to_lowercase().contains(&query)
                        {
                            continue;
                        }
                        matches += 1;
                        if ui
                            .button(format!(
                                "{name}  ·  {family}  ·  {} instructions",
                                warrior.code.len()
                            ))
                            .clicked()
                        {
                            chosen = Some(warrior.clone());
                        }
                    }
                    if matches == 0 {
                        ui.label("No compatible warriors match the search.");
                    }
                });
            close = ui.button("Cancel").clicked();
        });
        if let Some(warrior) = chosen {
            let side = picker.side;
            self.library = None;
            self.source_editor = Some(SourceEditor::new(
                side,
                warrior.source.to_string(),
                warrior.fallback.to_string(),
                self.arena.rules,
            ));
        } else if close || modal.should_close() {
            self.library = None;
        }
    }

    fn set_roster(&mut self, warriors: Vec<Warrior>) -> bool {
        let mut setup = self.setup.clone();
        let clear_fixed =
            setup.placement == Placement::Fixed && warriors.len() != self.arena.warriors.len();
        if clear_fixed {
            setup.placement = Placement::Even;
        }
        match setup.start(&warriors) {
            Ok(arena) => {
                self.start_match(setup, arena);
                if clear_fixed {
                    self.error =
                        Some("Placement switched to even spacing for the new roster size.".into());
                }
                true
            }
            Err(error) => {
                self.error = Some(error);
                false
            }
        }
    }

    fn start_match(&mut self, setup: MatchSetup, arena: Arena) {
        for draft in &mut self.parked_drafts {
            draft.side = draft.side.filter(|&side| {
                match (self.arena.warriors.get(side), arena.warriors.get(side)) {
                    (Some(previous), Some(next)) => previous.source == next.source,
                    _ => false,
                }
            });
        }
        self.setup = setup;
        self.round = 1;
        self.scores.fill(0);
        self.results.clear();
        self.result_selection = 0;
        self.match_notice = None;
        self.error = None;
        let size = arena.rules.core_size;
        self.breaks.write.retain(|&address| address < size);
        self.breaks.execute.retain(|&address| address < size);
        self.start_round(arena);
    }

    fn start_round(&mut self, arena: Arena) {
        self.running = false;
        self.stop = None;
        self.warrior = self.warrior.min(arena.warriors.len() - 1);
        self.selected = arena.positions[self.warrior];
        self.arena = arena;
        self.core_edits.clear();
        self.timeline = Timeline::new(&self.arena);
        self.dirty = true;
    }

    fn has_next_round(&self) -> bool {
        self.round < self.setup.rounds
    }

    fn next_round(&mut self) -> bool {
        if !self.arena.done() || !self.has_next_round() {
            return false;
        }
        match self
            .setup
            .positions(self.arena.warriors.len(), self.round + 1)
        {
            Ok(positions) => {
                self.capture_round();
                let arena = self.arena.next_round(positions);
                for side in 0..arena.warriors.len() {
                    self.scores[side] += self.arena.round_score(side);
                }
                self.round += 1;
                self.error = None;
                self.start_round(arena);
                true
            }
            Err(error) => {
                self.error = Some(error);
                false
            }
        }
    }

    fn capture_round(&mut self) {
        if self.replay.is_some() || !self.arena.done() || self.results.len() >= self.round as usize
        {
            return;
        }
        self.results
            .push(RoundResult::capture(&self.arena, &self.core_edits));
        self.result_selection = self.results.len() - 1;
    }

    fn replay_result(&mut self, index: usize, step: u32, address: Option<usize>) {
        let result = &self.results[index];
        let (mut arena, timeline) =
            match result
                .replay
                .rebuild(self.arena.warriors.clone(), self.arena.rules, true)
            {
                Ok(state) if state.0.done() => state,
                Ok(_) => {
                    self.error = Some("Replay did not finish at the recorded step".into());
                    return;
                }
                Err(error) => {
                    self.error = Some(error);
                    return;
                }
            };
        timeline.seek_step(&mut arena, step);
        let address = address
            .or_else(|| arena.next_actor().and_then(|side| arena.queued(side, 0)))
            .or_else(|| arena.pc())
            .unwrap_or(arena.positions[0]);
        self.replay = Some(ReplayReturn {
            viewed: index,
            arena: std::mem::replace(&mut self.arena, arena),
            timeline: std::mem::replace(&mut self.timeline, timeline),
            selected: std::mem::replace(&mut self.selected, address),
            stop: self.stop.take(),
        });
        self.running = false;
        self.error = None;
        self.results_open = false;
        self.dirty = true;
    }

    fn save_match(&mut self) {
        self.running = false;
        let Some(path) = rfd::FileDialog::new()
            .add_filter("ZoreWars match", &[EXTENSION])
            .set_file_name("match.zwmatch")
            .save_file()
        else {
            return;
        };
        let path = if path.extension().is_none() {
            path.with_extension(EXTENSION)
        } else {
            path
        };
        self.capture_round();
        let saved = MatchFile::new(
            &self.setup,
            self.round,
            &self.arena,
            &self.timeline,
            &self.core_edits,
            self.selected,
            &self.results,
        );
        match saved.write(&path) {
            Ok(()) => {
                self.error = None;
                self.match_notice = Some(format!("Saved {}", path.display()));
            }
            Err(error) => self.error = Some(format!("{}: {error}", path.display())),
        }
    }

    fn open_match(&mut self) {
        self.running = false;
        let Some(path) = rfd::FileDialog::new()
            .add_filter("ZoreWars match", &[EXTENSION])
            .pick_file()
        else {
            return;
        };
        match OpenedMatch::read(&path) {
            Ok(saved) => {
                self.apply_saved_match(saved);
                self.match_notice = Some(format!("Opened {}", path.display()));
            }
            Err(error) => self.error = Some(format!("{}: {error}", path.display())),
        }
    }

    fn apply_saved_match(&mut self, saved: OpenedMatch) {
        self.start_match(saved.setup, saved.arena);
        self.timeline = saved.timeline;
        self.round = saved.round;
        self.scores = saved.scores;
        self.results = saved.results;
        self.core_edits = saved.edits;
        self.selected = saved.address;
        self.result_selection = self.results.len().saturating_sub(1);
        self.results_open = !self.results.is_empty();
    }

    fn return_from_replay(&mut self) {
        let Some(live) = self.replay.take() else {
            return;
        };
        self.arena = live.arena;
        self.timeline = live.timeline;
        self.selected = live.selected;
        self.stop = live.stop;
        self.running = false;
        self.dirty = true;
    }

    fn modal_open(&self) -> bool {
        self.editor.is_some()
            || self.source_editor.is_some()
            || self.source_view.is_some()
            || self.setup_draft.is_some()
            || self.library.is_some()
            || self.results_open
    }

    fn timeline_controls(&mut self, ui: &mut egui::Ui) {
        let mut cycle = self.arena.cycle();
        let tip = self.timeline.latest_cycle();
        ui.horizontal_wrapped(|ui| {
            let back = ui.add_enabled(
                self.arena.steps() > self.timeline.first_step(),
                egui::Button::new("Step back"),
            );
            let slider = ui.add_enabled(
                tip > self.timeline.first_cycle(),
                egui::Slider::new(&mut cycle, self.timeline.first_cycle()..=tip)
                    .text("Cycle")
                    .clamping(egui::SliderClamping::Always),
            );
            let latest = ui.add_enabled(
                self.arena.steps() < self.timeline.latest_step(),
                egui::Button::new("Latest"),
            );
            if back.clicked() {
                let step = self.arena.steps() - 1;
                self.timeline.seek_step(&mut self.arena, step);
            } else if slider.changed() {
                self.timeline.seek_cycle(&mut self.arena, cycle);
            } else if latest.clicked() {
                self.timeline
                    .seek_step(&mut self.arena, self.timeline.latest_step());
            } else {
                return;
            }
            self.running = false;
            self.stop = None;
            self.dirty = true;
        });
    }

    fn inspect_before(&mut self, step: u32, address: usize) {
        self.timeline.seek_step(&mut self.arena, step - 1);
        self.selected = address;
        self.running = false;
        self.stop = None;
        self.dirty = true;
    }

    fn inspect(&mut self, address: usize) {
        self.selected = address;
        self.running = false;
        self.dirty = true;
    }

    fn show_instruction_source(&mut self, location: SourceLocation) {
        if self.modal_open() {
            return;
        }
        self.running = false;
        self.source_view = Some(SourceView {
            location,
            scroll_to_line: true,
        });
    }

    fn source_view_dialog(&mut self, ctx: &egui::Context) {
        let Some(view) = &mut self.source_view else {
            return;
        };
        let warrior = &self.arena.warriors[usize::from(view.location.warrior)];
        let line = warrior.source_lines[usize::from(view.location.offset)];
        let mut source = warrior.source.as_ref();
        let modal = egui::Modal::new(egui::Id::new("instruction-source")).show(ctx, |ui| {
            ui.heading(format!("{} · Redcode line {line}", warrior.name));
            let width = (ctx.content_rect().width() - 70.0).clamp(260.0, 640.0);
            let height = (ctx.content_rect().height() - 170.0).clamp(130.0, 400.0);
            egui::ScrollArea::vertical()
                .max_height(height)
                .show(ui, |ui| {
                    let mut layouter = |ui: &egui::Ui, text: &dyn egui::TextBuffer, width: f32| {
                        let job =
                            redcode_layout(text.as_str(), width, ui.visuals(), None, Some(line));
                        ui.fonts_mut(|fonts| fonts.layout_job(job))
                    };
                    let output = egui::TextEdit::multiline(&mut source)
                        .id(egui::Id::new("original-redcode").with(view.location.warrior))
                        .code_editor()
                        .desired_rows(14)
                        .desired_width(width)
                        .layouter(&mut layouter)
                        .show(ui);
                    if view.scroll_to_line {
                        let first = warrior
                            .source
                            .split_inclusive('\n')
                            .take(line - 1)
                            .map(|line| line.chars().count())
                            .sum();
                        let cursor = egui::text::CCursor::new(first);
                        let rect = output
                            .galley
                            .pos_from_cursor(cursor)
                            .translate(output.galley_pos.to_vec2());
                        ui.scroll_to_rect(rect, Some(egui::Align::Center));
                        view.scroll_to_line = false;
                    }
                });
            ui.button("Close").clicked()
        });
        if modal.inner || modal.should_close() {
            self.source_view = None;
        }
    }

    fn edit_source(&mut self, side: usize) {
        if self.replay.is_some() || self.resume_slot_draft(side) {
            return;
        }
        self.running = false;
        self.error = None;
        let warrior = &self.arena.warriors[side];
        self.source_editor = Some(SourceEditor::new(
            Some(side),
            warrior.source.to_string(),
            warrior.fallback.to_string(),
            self.arena.rules,
        ));
    }

    fn inspector_panel(&mut self, ui: &mut egui::Ui) {
        ui.horizontal_wrapped(|ui| {
            ui.selectable_value(&mut self.view, View::Queue, "Queue");
            ui.selectable_value(&mut self.view, View::Core, "Core");
            ui.selectable_value(&mut self.view, View::Pspace, "P-space");
        });
        ui.horizontal_wrapped(|ui| {
            egui::ComboBox::from_id_salt("inspector-warrior")
                .selected_text(&self.arena.warriors[self.warrior].name)
                .show_ui(ui, |ui| {
                    for (side, warrior) in self.arena.warriors.iter().enumerate() {
                        ui.selectable_value(&mut self.warrior, side, &warrior.name);
                    }
                });
            if ui
                .add_enabled(
                    !self.modal_open() && self.replay.is_none(),
                    egui::Button::new("Edit source"),
                )
                .clicked()
            {
                self.edit_source(self.warrior);
            }
        });
        match self.view {
            View::Queue => {
                let count = self.arena.processes(self.warrior) as usize;
                ui.label(format!("{count} queued"));
                egui::ScrollArea::vertical()
                    .id_salt(("queue", self.warrior))
                    .show_rows(ui, 20.0, count, |ui, rows| {
                        for index in rows {
                            let addr = self.arena.queued(self.warrior, index).unwrap();
                            let head = if index == 0 { " →" } else { "  " };
                            if ui
                                .link(
                                    RichText::new(format!("{head} {index:4}  {addr:04}"))
                                        .monospace(),
                                )
                                .on_hover_text(self.arena.instruction(addr))
                                .clicked()
                            {
                                self.inspect(addr);
                            }
                        }
                    });
            }
            View::Core => self.core_listing(ui),
            View::Pspace => {
                let cells = self.arena.pspace(self.warrior);
                if !self.arena.rules.pspace {
                    ui.label("P-space is disabled for this match.");
                    return;
                }
                egui::ScrollArea::vertical()
                    .id_salt(("pspace", self.warrior))
                    .show_rows(ui, 20.0, cells.len(), |ui, rows| {
                        for index in rows {
                            ui.monospace(format!("{index:03}  {}", cells[index]));
                        }
                    });
            }
        }
    }

    fn core_listing(&mut self, ui: &mut egui::Ui) {
        let size = self.arena.rules.core_size;
        ui.horizontal(|ui| {
            ui.add(
                egui::TextEdit::singleline(&mut self.address)
                    .hint_text("Address")
                    .desired_width(90.0),
            );
            if ui.button("Go").clicked() {
                match self.address.trim().parse::<usize>() {
                    Ok(addr) if addr < size => {
                        self.error = None;
                        self.inspect(addr);
                    }
                    _ => self.error = Some(format!("Enter an address from 0 to {}", size - 1)),
                }
            }
        });
        ui.horizontal(|ui| {
            ui.add(
                egui::TextEdit::singleline(&mut self.query)
                    .hint_text("Opcode or value")
                    .desired_width(108.0),
            );
            if ui.button("Find next").clicked() {
                match self.arena.find_next(self.selected, &self.query) {
                    Ok(Some(addr)) => {
                        self.error = None;
                        self.inspect(addr);
                    }
                    Ok(None) => self.error = Some("No matching core cell".into()),
                    Err(error) => self.error = Some(error),
                }
            }
        });
        let center = self.selected;
        egui::ScrollArea::vertical()
            .id_salt("core-neighborhood")
            .show(ui, |ui| {
                for offset in 0..21 {
                    let addr = (center + size + offset - 10) % size;
                    let line = format!("{addr:04} {}", self.arena.instruction(addr));
                    if ui
                        .selectable_label(addr == center, RichText::new(line).monospace())
                        .clicked()
                    {
                        self.inspect(addr);
                    }
                }
            });
    }

    fn edit_dialog(&mut self, ctx: &egui::Context) {
        let Some((address, text)) = &mut self.editor else {
            return;
        };
        let mut apply = false;
        let mut cancel = false;
        let modal = egui::Modal::new(egui::Id::new("edit-core-cell")).show(ctx, |ui| {
            ui.heading(format!("Edit cell {address:04}"));
            ui.text_edit_singleline(text);
            ui.label("Apply starts a new timeline at this instruction boundary.");
            if let Some(error) = &self.error {
                ui.colored_label(Color32::LIGHT_RED, error);
            }
            ui.horizontal(|ui| {
                apply = ui.button("Apply").clicked();
                cancel = ui.button("Cancel").clicked();
            });
        });
        if apply {
            let (address, source) = self.editor.take().unwrap();
            if let Err(error) = self.apply_core_edit(address, &source) {
                self.editor = Some((address, source));
                self.error = Some(error);
            }
        } else if cancel || modal.should_close() {
            self.editor = None;
            self.error = None;
        }
    }

    fn apply_core_edit(&mut self, address: usize, source: &str) -> Result<(), String> {
        self.arena.edit(address, source)?;
        self.core_edits.push(CoreEdit {
            step: self.arena.steps(),
            address,
            source: source.to_owned(),
        });
        self.timeline = Timeline::new(&self.arena);
        self.results.truncate((self.round - 1) as usize);
        self.capture_round();
        self.error = None;
        self.stop = None;
        self.dirty = true;
        Ok(())
    }

    fn setup_dialog(&mut self, ctx: &egui::Context) {
        let Some(draft) = &mut self.setup_draft else {
            return;
        };
        let setup = &mut draft.settings;
        let mut apply = false;
        let mut cancel = false;
        let modal = egui::Modal::new(egui::Id::new("match-setup")).show(ctx, |ui| {
            ui.heading("Match Setup");
            egui::ComboBox::from_label("Rules")
                .selected_text(setup.preset.label())
                .height(280.0)
                .show_ui(ui, |ui| {
                    for &(group, presets) in Preset::GROUPS {
                        ui.label(RichText::new(group).strong());
                        for &preset in presets {
                            ui.selectable_value(&mut setup.preset, preset, preset.label());
                        }
                    }
                });
            let rules = setup.preset.rules();
            ui.label(format!(
                "{} cells · {} cycles · {} processes",
                rules.core_size, rules.cycles, rules.processes
            ));
            ui.label(format!(
                "{} max length · {} min separation · P-space {}",
                rules.length,
                rules.distance,
                if rules.pspace { "on" } else { "off" }
            ));
            ui.horizontal(|ui| {
                ui.label("Rounds");
                ui.add(egui::DragValue::new(&mut setup.rounds).range(1..=1000));
            });
            ui.checkbox(
                &mut draft.use_built_ins,
                "Replace roster with Dwarf and Imp",
            );
            let count = if draft.use_built_ins {
                2
            } else {
                self.arena.warriors.len()
            };
            ui.horizontal_wrapped(|ui| {
                ui.label("Placement");
                for (mode, label) in [
                    (Placement::Even, "Even"),
                    (Placement::Seeded, "Seeded"),
                    (Placement::Fixed, "Fixed"),
                ] {
                    if ui
                        .selectable_value(&mut setup.placement, mode, label)
                        .clicked()
                        && mode == Placement::Fixed
                        && setup.fixed.is_empty()
                    {
                        setup.fixed = (0..count)
                            .map(|side| (side * rules.core_size / count).to_string())
                            .collect::<Vec<_>>()
                            .join(", ");
                    }
                }
            });
            match setup.placement {
                Placement::Even => {}
                Placement::Seeded => {
                    ui.horizontal(|ui| {
                        ui.label("Seed");
                        ui.add(egui::DragValue::new(&mut setup.seed).range(1..=MAX_SEED));
                    });
                }
                Placement::Fixed => {
                    let roster = if draft.use_built_ins {
                        "Dwarf, Imp".into()
                    } else {
                        self.arena
                            .warriors
                            .iter()
                            .map(|warrior| warrior.name.as_str())
                            .collect::<Vec<_>>()
                            .join(", ")
                    };
                    ui.label(format!("Starting addresses in roster order ({roster})"));
                    ui.text_edit_singleline(&mut setup.fixed);
                }
            }
            if let Some(error) = &self.error {
                ui.colored_label(Color32::LIGHT_RED, error);
            }
            ui.horizontal(|ui| {
                apply = ui.button("Start match").clicked();
                cancel = ui.button("Cancel").clicked();
            });
        });
        if apply {
            let arena = if draft.use_built_ins {
                setup
                    .preset
                    .starter()
                    .and_then(|warriors| setup.start(&warriors))
            } else {
                setup.start(&self.arena.warriors)
            };
            match arena {
                Ok(arena) => {
                    let setup = self.setup_draft.take().unwrap().settings;
                    self.start_match(setup, arena);
                }
                Err(error) => self.error = Some(error),
            }
        } else if cancel || modal.should_close() {
            self.setup_draft = None;
            self.error = None;
        }
    }

    fn source_dialog(&mut self, ctx: &egui::Context) {
        let Some(editor) = &mut self.source_editor else {
            return;
        };
        let rules = self.arena.rules;
        let room = self.arena.warriors.len() < MAX_WARRIORS;
        let title = editor.side.map_or_else(
            || format!("Redcode · {}", editor.fallback),
            |side| format!("Edit {}", self.arena.warriors[side].name),
        );
        let mut action = None;
        let mut open = false;
        let mut save = false;
        let mut cancel = false;
        let mut close_draft = false;
        let text_id = egui::Id::new("warrior-redcode");
        if editor.focus_on_open {
            egui::text_edit::TextEditState::default().store(ctx, text_id);
        }
        egui::Modal::new(egui::Id::new("edit-warrior-source")).show(ctx, |ui| {
            ui.heading(title);
            let width = (ctx.content_rect().width() - 70.0).clamp(260.0, 640.0);
            let height = (ctx.content_rect().height() - 200.0).clamp(130.0, 380.0);
            let focused = ctx.memory(|memory| memory.has_focus(text_id));
            let plain_tab = |event: &egui::Event| {
                matches!(
                    event,
                    egui::Event::Key {
                        key: Key::Tab,
                        pressed: true,
                        modifiers: egui::Modifiers::NONE,
                        ..
                    }
                )
            };
            let accept_tab = focused
                && ctx.input(|input| input.events.iter().any(plain_tab))
                && egui::text_edit::TextEditState::load(ctx, text_id)
                    .and_then(|state| editor.completions(state.cursor.char_range(), rules))
                    .is_some();
            if accept_tab {
                ctx.input_mut(|input| input.events.retain(|event| !plain_tab(event)));
            }
            let output = egui::ScrollArea::vertical()
                .max_height(height)
                .show(ui, |ui| {
                    let diagnostic_line = editor.checked.as_ref().err().and_then(|error| {
                        error.strip_prefix("line ")?.split_once(':')?.0.parse().ok()
                    });
                    let mut layouter = |ui: &egui::Ui, text: &dyn egui::TextBuffer, width: f32| {
                        let job = redcode_layout(
                            text.as_str(),
                            width,
                            ui.visuals(),
                            diagnostic_line,
                            None,
                        );
                        ui.fonts_mut(|fonts| fonts.layout_job(job))
                    };
                    let output = egui::TextEdit::multiline(&mut editor.source)
                        .id(text_id)
                        .code_editor()
                        .desired_rows(14)
                        .desired_width(width)
                        .layouter(&mut layouter)
                        .show(ui);
                    if editor.focus_on_open {
                        output.response.request_focus();
                        editor.focus_on_open = false;
                    }
                    if output.response.changed() {
                        editor.check(rules);
                        ctx.request_repaint();
                    }
                    output
                })
                .inner;
            let cursor = output
                .cursor_range
                .or_else(|| output.state.cursor.char_range());
            if let Some((cursor, completions)) = cursor.and_then(|cursor| {
                editor
                    .completions(Some(cursor), rules)
                    .map(|items| (cursor, items))
            }) {
                let mut accept = accept_tab.then_some(0);
                ui.horizontal_wrapped(|ui| {
                    ui.label("Complete (Tab)");
                    for (index, word) in completions.words.iter().enumerate() {
                        let button = ui.button(RichText::new(word).monospace());
                        let button = if let Some(help) = word_help(word) {
                            button.on_hover_text(help)
                        } else {
                            button
                        };
                        if button.clicked() {
                            accept = Some(index);
                        }
                    }
                });
                if let Some(index) = accept {
                    editor.complete(output, cursor, completions, index, rules, ctx);
                }
            }
            let valid = match &editor.checked {
                Ok(warrior) => {
                    ui.label(format!(
                        "{} · {} instructions · entry offset {} · {}",
                        warrior.name,
                        warrior.code.len(),
                        warrior.start,
                        self.setup.preset.label()
                    ));
                    for warning in &warrior.warnings {
                        ui.label(RichText::new(warning).color(Color32::YELLOW));
                    }
                    true
                }
                Err(error) => {
                    ui.colored_label(Color32::LIGHT_RED, error);
                    false
                }
            };
            if let Some(error) = &self.error {
                ui.colored_label(Color32::LIGHT_RED, error);
            }
            if let Some(path) = &editor.saved_to {
                ui.label(format!("Saved a copy to {}", path.display()));
            }
            ui.horizontal_wrapped(|ui| {
                if let Some(side) = editor.side {
                    if ui
                        .add_enabled(valid, egui::Button::new("Apply and restart match"))
                        .clicked()
                    {
                        action = Some(DraftAction::Replace(side));
                    }
                    open = ui
                        .add_enabled(!editor.modified, egui::Button::new("Open .red…"))
                        .on_hover_text("Replace this draft with a file")
                        .clicked();
                } else {
                    if ui
                        .add_enabled(valid && room, egui::Button::new("Add to match"))
                        .on_disabled_hover_text(if room {
                            "Fix the Redcode to add this warrior"
                        } else {
                            "The match already has four warriors"
                        })
                        .clicked()
                    {
                        action = Some(DraftAction::Add);
                    }
                    if ui
                        .add_enabled(valid, egui::Button::new("Use as solo roster"))
                        .clicked()
                    {
                        action = Some(DraftAction::Solo);
                    }
                }
                save = ui.button("Save As…").clicked();
                if editor.modified {
                    cancel = ui.button("Discard draft").clicked();
                    if ui.button("Keep draft").clicked() {
                        close_draft = true;
                    }
                } else {
                    cancel = ui.button("Close").clicked();
                }
            });
        });
        if let Some(action) = action {
            self.apply_source(action);
        } else if open {
            let side = editor.side;
            self.open_source(side);
        } else if save {
            if let Some(path) = rfd::FileDialog::new()
                .add_filter("Redcode", &["red"])
                .set_file_name(format!("{}.red", editor.fallback))
                .save_file()
            {
                match std::fs::write(&path, &editor.source) {
                    Ok(()) => {
                        editor.saved_to = Some(path);
                        self.error = None;
                    }
                    Err(error) => self.error = Some(format!("{}: {error}", path.display())),
                }
            }
        } else if close_draft {
            if let Some(editor) = self.source_editor.take() {
                self.parked_drafts.push(editor.draft());
            }
            self.error = None;
        } else if cancel {
            self.source_editor = None;
            self.error = None;
        }
    }

    fn apply_source(&mut self, action: DraftAction) {
        let Some(Ok(warrior)) = self.source_editor.as_ref().map(|editor| &editor.checked) else {
            return;
        };
        let mut warriors = self.arena.warriors.clone();
        let side = match action {
            DraftAction::Replace(side) => {
                warriors[side] = warrior.clone();
                side
            }
            DraftAction::Add if warriors.len() < MAX_WARRIORS => {
                warriors.push(warrior.clone());
                warriors.len() - 1
            }
            DraftAction::Add => return,
            DraftAction::Solo => {
                warriors = vec![warrior.clone()];
                0
            }
        };
        if self.set_roster(warriors) {
            self.warrior = side;
            self.selected = self.arena.positions[side];
            self.source_editor = None;
        }
    }

    fn controls(&mut self, ui: &mut egui::Ui) {
        let context = ui.ctx().clone();
        let modal_open = self.modal_open();
        let key = |key| {
            !modal_open
                && !context.egui_wants_keyboard_input()
                && context.input(|input| input.key_pressed(key))
        };
        let label = if self.running { "Pause" } else { "Run round" };
        if ui
            .add_enabled(
                self.running || !self.arena.done(),
                egui::Button::new(label).min_size(egui::vec2(69.0, 0.0)),
            )
            .clicked()
            || key(Key::Space)
        {
            self.run_pause(false);
        }
        let live = self.replay.is_none();
        if live
            && self.setup.rounds > 1
            && ui
                .add_enabled(
                    !self.running && self.has_next_round(),
                    egui::Button::new("Run match"),
                )
                .on_hover_text("Run through the remaining rounds")
                .clicked()
        {
            self.run_pause(true);
        }
        if live
            && ui
                .add_enabled(
                    !self.running && (!self.arena.done() || self.has_next_round()),
                    egui::Button::new("Run fast"),
                )
                .on_hover_text("Run the match in batches; breakpoints still apply")
                .clicked()
        {
            self.run_pause(true);
            self.fast = self.running;
        }
        if ui.button("Step").clicked() || key(Key::S) {
            self.step();
        }
        if live && (ui.button("Reset round").clicked() || key(Key::R)) {
            self.reset();
        }
        if live
            && self.setup.rounds > 1
            && ui
                .add_enabled(
                    self.has_next_round() && self.arena.done() && !self.running,
                    egui::Button::new("Next round"),
                )
                .clicked()
        {
            self.next_round();
        }
        if live
            && ui
                .add_enabled(!self.results.is_empty(), egui::Button::new("Results"))
                .clicked()
        {
            self.running = false;
            self.result_selection = self
                .result_selection
                .min(self.results.len().saturating_sub(1));
            self.results_open = true;
        }
        if !live && ui.button("Return to match").clicked() {
            self.return_from_replay();
        }
        if let Some(replay) = &self.replay {
            if ui.button("Choose another round…").clicked() {
                self.result_selection = replay.viewed;
                self.return_from_replay();
                self.results_open = true;
            }
        }
        ui.add(
            egui::Slider::new(&mut self.speed, 0..=SPEEDS.len() - 1)
                .show_value(false)
                .text("Speed"),
        )
        .on_hover_text(format!("{} instructions/frame", SPEEDS[self.speed]));
    }

    fn results_dialog(&mut self, ctx: &egui::Context) {
        if !self.results_open {
            return;
        }
        let mut replay = None;
        let modal = egui::Modal::new(egui::Id::new("match-results")).show(ctx, |ui| {
            ui.set_width((ctx.content_rect().width() - 70.0).clamp(380.0, 660.0));
            ui.heading("Match results");
            ui.columns(2, |columns| {
                egui::ScrollArea::vertical().id_salt("round-history").max_height(305.0).show(&mut columns[0], |ui| {
                    for (index, result) in self.results.iter().enumerate() {
                        ui.selectable_value(&mut self.result_selection, index,
                            format!("Round {} · {}", index + 1, result.outcome));
                    }
                });
                let Some(result) = self.results.get(self.result_selection) else { return };
                let ui = &mut columns[1];
                ui.label(format!("Cycle {} · {} instructions", result.cycle, result.replay.steps));
                if ui.button("Replay round").clicked() {
                    replay = Some((0, None));
                }
                if let Some(blow) = result.elimination {
                    let victim = &self.arena.warriors[blow.actor].name;
                    ui.label(format!("{victim} lost its last process at {:04} on cycle {}", blow.address, blow.cycle));
                    if let Some(write) = blow.writer {
                        ui.label(format!("Last written by {} from {:04} on cycle {}",
                            self.arena.warriors[write.actor].name, write.pc, write.cycle));
                    }
                    if ui.button("Show killing blow").clicked() {
                        replay = Some((blow.step.saturating_sub(1), Some(blow.address)));
                    }
                }
                if ui.button("Replay ending").clicked() {
                    replay = Some((result.replay.steps.saturating_sub(80), result.elimination.map(|blow| blow.address)));
                }
                ui.separator();
                for (side, warrior) in self.arena.warriors.iter().enumerate() {
                    let [own, enemy, empty, div] = result.stats[side].deaths;
                    ui.collapsing(&warrior.name, |ui| {
                        ui.label(format!("Deaths · own {own} · enemy {enemy} · empty {empty} · divide by zero {div}"));
                        ui.label(format!("{} foreign instructions executed · {} of {} original cells changed",
                            result.stats[side].foreign_steps, result.changed[side].len(), warrior.code.len()));
                        if !result.changed[side].is_empty() {
                            egui::ScrollArea::vertical().id_salt(("ending-code", side)).max_height(100.0).show(ui, |ui| {
                                for change in &result.changed[side] {
                                    ui.monospace(format!("{:04}  {}", change.address,
                                        self.arena.format_instruction(warrior.code[change.offset])));
                                    ui.monospace(format!("   →  {}", self.arena.format_instruction(change.ending)));
                                }
                            });
                        }
                    });
                }
            });
            if let Some(result) = self.results.get(self.result_selection) {
                self.process_chart(ui, result);
            }
            if let Some(error) = &self.error {
                ui.colored_label(Color32::LIGHT_RED, error);
            }
            ui.button("Close").clicked()
        });
        if let Some((step, address)) = replay {
            self.replay_result(self.result_selection, step, address);
        } else if modal.inner || modal.should_close() {
            self.results_open = false;
        }
    }

    fn process_chart(&self, ui: &mut egui::Ui, result: &RoundResult) {
        ui.horizontal_wrapped(|ui| {
            ui.label("Processes over time (log scale)");
            for (side, warrior) in self.arena.warriors.iter().enumerate() {
                ui.colored_label(rgb(COLORS[side]), &warrior.name);
            }
        });
        let (rect, _) =
            ui.allocate_exact_size(egui::vec2(ui.available_width(), 72.0), egui::Sense::hover());
        let plot = rect.shrink(4.0);
        ui.painter()
            .rect_filled(rect, 4.0, ui.visuals().extreme_bg_color);
        let max = result
            .samples
            .iter()
            .flat_map(|sample| sample.counts)
            .max()
            .unwrap_or(1)
            .max(1);
        for (side, color) in COLORS.iter().enumerate().take(self.arena.warriors.len()) {
            let points = result
                .samples
                .iter()
                .map(|sample| {
                    egui::pos2(
                        plot.left()
                            + plot.width() * sample.step as f32 / result.replay.steps.max(1) as f32,
                        plot.bottom()
                            - plot.height() * (sample.counts[side] as f32).ln_1p()
                                / (max as f32).ln_1p(),
                    )
                })
                .collect();
            ui.painter()
                .add(egui::Shape::line(points, (1.5, rgb(*color))));
        }
    }

    fn menus(&mut self, ui: &mut egui::Ui) {
        let config = egui::containers::menu::MenuConfig::new()
            .close_behavior(egui::PopupCloseBehavior::CloseOnClickOutside);
        egui::MenuBar::new().config(config).ui(ui, |ui| {
            ui.menu_button("Match", |ui| {
                if ui.button("Open match…").clicked() {
                    self.open_match();
                    ui.close();
                }
                if ui.button("Save match…").clicked() {
                    self.save_match();
                    ui.close();
                }
                ui.separator();
                if ui.button("Match settings…").clicked() {
                    self.open_match_settings();
                    ui.close();
                }
                if ui.button("Restart match").clicked() {
                    let setup = self.setup.clone();
                    match setup.start(&self.arena.warriors) {
                        Ok(arena) => self.start_match(setup, arena),
                        Err(error) => self.error = Some(error),
                    }
                    ui.close();
                }
            });
            ui.menu_button("Warriors", |ui| self.warrior_menu(ui));
            ui.menu_button("View", |ui| {
                ui.checkbox(&mut self.show_inspector, "Inspector");
                ui.checkbox(&mut self.show_debugger, "Debugger");
                ui.separator();
                ui.label("Core highlights");
                let before = self.display;
                for (mode, name) in [
                    (Activity::All, "All activity"),
                    (Activity::Execution, "Execution"),
                    (Activity::Writes, "Writes"),
                    (Activity::Deaths, "Deaths"),
                    (Activity::QueueHeads, "Queue heads"),
                ] {
                    ui.selectable_value(&mut self.display, mode, name);
                }
                self.dirty |= self.display != before;
            });
        });
    }

    fn open_match_settings(&mut self) {
        self.running = false;
        self.error = None;
        self.setup_draft = Some(SetupDraft {
            settings: self.setup.clone(),
            use_built_ins: false,
        });
    }

    fn warrior_menu(&mut self, ui: &mut egui::Ui) {
        if !self.parked_drafts.is_empty() {
            let mut resume = None;
            ui.menu_button("Resume draft", |ui| {
                for (index, draft) in self.parked_drafts.iter().enumerate() {
                    let slot = draft
                        .side
                        .map_or_else(|| "New warrior".into(), |side| format!("Slot {}", side + 1));
                    if ui.button(format!("{slot} · {}", draft.fallback)).clicked() {
                        resume = Some(index);
                        ui.close();
                    }
                }
            });
            if let Some(index) = resume {
                self.resume_draft(index);
                ui.close();
            }
        }
        if ui.button("Warrior library…").clicked() {
            self.open_library(None);
            ui.close();
        }
        if ui.button("Open .red…").clicked() {
            self.open_source(None);
            ui.close();
        }
        if ui.button("Load roster from files…").clicked() {
            self.load_roster_files();
            ui.close();
        }
        if ui.button("New warrior…").clicked() {
            self.running = false;
            self.error = None;
            let opcode = if self.arena.rules.icws88 {
                "MOV"
            } else {
                "MOV.I"
            };
            self.source_editor = Some(SourceEditor::new(
                None,
                format!(";name New warrior\n\n        {opcode} 0, 1\n"),
                "New warrior".into(),
                self.arena.rules,
            ));
            ui.close();
        }
        if ui.button("Replace roster with Dwarf and Imp").clicked() {
            match self.setup.preset.starter() {
                Ok(warriors) => {
                    self.set_roster(warriors);
                }
                Err(error) => self.error = Some(error),
            }
            ui.close();
        }
        ui.separator();
        for (side, warrior) in self.arena.warriors.iter().enumerate() {
            ui.selectable_value(
                &mut self.warrior,
                side,
                format!("{}. {}", side + 1, warrior.name),
            );
        }
        if ui.button("Edit selected warrior…").clicked() {
            self.edit_source(self.warrior);
            ui.close();
        }
        if ui
            .add_enabled(
                self.arena.warriors.len() > 1,
                egui::Button::new("Remove selected from roster"),
            )
            .clicked()
        {
            let mut warriors = self.arena.warriors.clone();
            warriors.remove(self.warrior);
            self.set_roster(warriors);
            ui.close();
        }
    }

    fn roster_summary(&mut self, ui: &mut egui::Ui) {
        let count = self.arena.warriors.len();
        let mut inspect = None;
        let mut action = None;
        let can_edit = !self.modal_open() && self.benchmark.is_none() && self.replay.is_none();
        ui.horizontal_wrapped(|ui| {
            for (side, warrior) in self.arena.warriors.iter().enumerate() {
                ui.label(
                    RichText::new(format!(
                        "{} @ {:04} · {} processes",
                        warrior.name,
                        self.arena.positions[side],
                        self.arena.processes(side)
                    ))
                    .color(rgb(COLORS[side])),
                );
                if self.setup.rounds > 1 && count > 1 && self.replay.is_none() {
                    ui.label(format!(
                        "{} pts",
                        self.scores[side] + self.arena.round_score(side)
                    ));
                }
                if !self.arena.done() {
                    if let Some(address) = self.arena.queued(side, 0) {
                        let label = if self.arena.next_actor() == Some(side) {
                            "Next"
                        } else {
                            "Head"
                        };
                        if ui
                            .link(format!("{label} {address:04}"))
                            .on_hover_text("Inspect the first queued instruction")
                            .clicked()
                        {
                            inspect = Some(address);
                        }
                    }
                }
                if can_edit {
                    ui.push_id(side, |ui| {
                        if ui
                            .small_button("Edit")
                            .on_hover_text(format!("Edit {}", warrior.name))
                            .clicked()
                        {
                            action = Some((side, None));
                        }
                        ui.menu_button("Replace", |ui| {
                            if ui.button("From library…").clicked() {
                                action = Some((side, Some(true)));
                                ui.close();
                            }
                            if ui.button("Open .red…").clicked() {
                                action = Some((side, Some(false)));
                                ui.close();
                            }
                        });
                    });
                }
            }
        });
        if let Some(address) = inspect {
            self.inspect(address);
        }
        match action {
            Some((side, None)) => self.edit_source(side),
            Some((side, Some(true))) => self.open_library(Some(side)),
            Some((side, Some(false))) => self.open_source(Some(side)),
            None => {}
        }
    }

    fn debugger(&mut self, ui: &mut egui::Ui) {
        let editing = self.modal_open();
        let count = self.arena.warriors.len();
        let selected = self.selected;
        let owner = self.arena.owners[selected]
            .map_or("unowned", |side| self.arena.warriors[side].name.as_str());
        ui.monospace(format!(
            "Cell {selected:04}   {}   ·   {owner}",
            self.arena.instruction(selected)
        ));
        if let Some(source) = self.arena.cell_source(selected) {
            let warrior = &self.arena.warriors[usize::from(source.warrior)];
            let line = warrior.source_lines[usize::from(source.offset)];
            if ui
                .link(format!("Source · {} · line {line}", warrior.name))
                .on_hover_text("Open the original Redcode at this line")
                .clicked()
            {
                self.show_instruction_source(source);
            }
        }
        if ui
            .add_enabled(
                !self.running && !editing && self.replay.is_none(),
                egui::Button::new("Edit cell"),
            )
            .clicked()
        {
            self.error = None;
            self.editor = Some((selected, self.arena.instruction(selected)));
        }
        if let Some(write) = self.arena.last_write(selected) {
            if ui
                .add_enabled(
                    write.step > self.timeline.first_step(),
                    egui::Link::new(format!(
                        "Last write: {} at {:04} · cycle {}, step {}",
                        self.arena.warriors[write.actor].name, write.pc, write.cycle, write.step
                    )),
                )
                .on_hover_text("Pause immediately before this write")
                .clicked()
            {
                self.inspect_before(write.step, selected);
                return;
            }
        } else if self.arena.owners[selected].is_some() {
            ui.label("Loaded with the warrior");
        }
        ui.horizontal_wrapped(|ui| {
            let context = ui.ctx().clone();
            let key = |key| {
                !editing
                    && !context.egui_wants_keyboard_input()
                    && context.input(|input| input.key_pressed(key))
            };
            if ui
                .selectable_label(self.breaks.write.contains(&selected), "Break on write (W)")
                .clicked()
                || key(Key::W)
            {
                toggle(&mut self.breaks.write, selected);
                self.dirty = true;
            }
            if ui
                .selectable_label(
                    self.breaks.execute.contains(&selected),
                    "Break on execute (E)",
                )
                .clicked()
                || key(Key::E)
            {
                toggle(&mut self.breaks.execute, selected);
                self.dirty = true;
            }
            let hit = ui.add_enabled(
                count > 1,
                egui::Button::selectable(self.breaks.first_hit, "First hit (H)"),
            );
            if count > 1 && (hit.clicked() || key(Key::H)) {
                self.breaks.first_hit = !self.breaks.first_hit;
            }
            ui.toggle_value(&mut self.breaks.process_death, "Break on process death");
        });
        if let (Some(stop), Some(entry)) = (&self.stop, self.arena.trace.back()) {
            let reason = match stop {
                Stop::Execute { .. } => "Execution breakpoint".into(),
                Stop::Write { .. } => "Write breakpoint".into(),
                Stop::ProcessDeath { .. } => "Process died".into(),
                Stop::FirstHit { victim, .. } => {
                    format!("First hit on {}", self.arena.warriors[*victim].name)
                }
            };
            ui.colored_label(
                Color32::YELLOW,
                format!(
                    "{reason} at {:04} · {} executed {:04} · cycle {}, step {}",
                    stop.address(),
                    self.arena.warriors[entry.actor].name,
                    entry.pc,
                    entry.cycle,
                    entry.step,
                ),
            );
        }
        let mut jump = None;
        let mut target = None;
        let mut source_jump = None;
        for entry in self.arena.trace.iter().rev().take(4) {
            ui.horizontal_wrapped(|ui| {
                let source = format!(
                    "#{:06}  {:04}  {}",
                    entry.step, entry.pc, self.arena.warriors[entry.actor].name
                );
                if ui
                    .add_enabled(
                        entry.step > self.timeline.first_step(),
                        egui::Link::new(RichText::new(source).monospace()),
                    )
                    .on_hover_text("Pause before this instruction")
                    .clicked()
                {
                    jump = Some((entry.step, entry.pc));
                }
                if let Some(source) = entry.source {
                    let warrior = &self.arena.warriors[usize::from(source.warrior)];
                    let line = warrior.source_lines[usize::from(source.offset)];
                    if ui
                        .link("Source")
                        .on_hover_text(format!("{} · line {line}", warrior.name))
                        .clicked()
                    {
                        source_jump = Some(source);
                    }
                }
                for &address in entry.writes.iter().flatten() {
                    if ui
                        .link(RichText::new(format!("→ {address:04}")).monospace())
                        .on_hover_text("Inspect this write target")
                        .clicked()
                    {
                        target = Some(address);
                    }
                }
                if entry.killed {
                    ui.label("process died");
                }
            });
        }
        if let Some(source) = source_jump {
            self.show_instruction_source(source);
        } else if let Some((step, address)) = jump {
            self.inspect_before(step, address);
        } else if let Some(address) = target {
            self.selected = address;
            self.running = false;
            self.dirty = true;
        }
    }

    fn grid(&mut self, ui: &mut egui::Ui) {
        let core_size = self.arena.rules.core_size;
        let cols = ((core_size as f32 * 1.25).sqrt().round() as usize).max(1);
        let rows = core_size.div_ceil(cols);
        if self.dirty {
            let mut pixels: Vec<_> = self
                .arena
                .owners
                .iter()
                .enumerate()
                .map(|(addr, owner)| {
                    let color = owner.map_or(0x1c2633, |side| COLORS[side]);
                    let (activity, highlight) = match self.display {
                        Activity::All => (self.arena.activity[addr], color),
                        Activity::Execution => (self.arena.executed[addr], 0x92edff),
                        Activity::Writes => {
                            (self.arena.last_write(addr).map_or(0, |w| w.step), color)
                        }
                        Activity::Deaths => (self.arena.deaths[addr], 0xff766e),
                        Activity::QueueHeads => (0, color),
                    };
                    rgb(if activity != 0 && self.arena.steps() - activity <= 512 {
                        highlight
                    } else {
                        (color & 0xfefefe) >> 1
                    })
                })
                .collect();
            if self.display == Activity::QueueHeads {
                if let Some(next) = self.arena.next_actor() {
                    for (side, &color) in COLORS.iter().enumerate().take(self.arena.warriors.len())
                    {
                        if let Some(address) = self.arena.queued(side, 0) {
                            pixels[address] = rgb(color);
                        }
                    }
                    if let Some(address) = self.arena.queued(next, 0) {
                        pixels[address] = Color32::WHITE;
                    }
                }
            } else if let Some(pc) = self.arena.pc() {
                pixels[pc] = Color32::WHITE;
            }
            for &address in self.breaks.write.union(&self.breaks.execute) {
                pixels[address] = Color32::YELLOW;
            }
            pixels[self.selected] = if self.stop.is_some() {
                Color32::YELLOW
            } else {
                Color32::LIGHT_GRAY
            };
            pixels.resize(cols * rows, Color32::TRANSPARENT);
            let image = egui::ColorImage::new([cols, rows], pixels);
            if let Some(texture) = &mut self.image {
                texture.set(image, TextureOptions::NEAREST);
            } else {
                self.image = Some(
                    ui.ctx()
                        .load_texture("core", image, TextureOptions::NEAREST),
                );
            }
            self.dirty = false;
        }
        let scale = (ui.available_width() / cols as f32)
            .min(ui.available_height() / rows as f32)
            .max(0.05);
        let size = egui::vec2(cols as f32, rows as f32) * scale;
        let texture = self.image.as_ref().unwrap();
        let margin = (ui.available_width() - size.x).max(0.0) / 2.0;
        let response = ui
            .horizontal(|ui| {
                ui.add_space(margin);
                ui.add(egui::Image::new((texture.id(), size)).sense(egui::Sense::click()))
            })
            .inner;
        if let Some(point) = response.interact_pointer_pos() {
            if response.clicked() || response.double_clicked() {
                let local = point - response.rect.min;
                let col = ((local.x / scale) as usize).min(cols - 1);
                let row = ((local.y / scale) as usize).min(rows - 1);
                let address = row * cols + col;
                if address < core_size {
                    self.selected = address;
                    self.dirty = true;
                    ui.ctx().request_repaint();
                    if response.double_clicked() {
                        if let Some(source) = self.arena.cell_source(address) {
                            self.show_instruction_source(source);
                        }
                    }
                }
            }
        }
    }
}

impl eframe::App for Desktop {
    fn ui(&mut self, ui: &mut egui::Ui, frame: &mut eframe::Frame) {
        let start = Instant::now();
        let simulation = if self.benchmark.is_some() {
            self.arena.advance(benchmark::STEPS);
            self.dirty = true;
            start.elapsed()
        } else {
            Duration::ZERO
        };
        let draw_start = Instant::now();
        let context = ui.ctx().clone();
        self.tick(Instant::now());
        if self.benchmark.is_none() {
            if self.replay.is_none() {
                self.dropped_files(&context);
            }
            let width = ui.available_width();
            let height = ui.available_height();
            egui::Panel::top("arena-menu").show_inside(ui, |ui| {
                ui.add_enabled_ui(!self.modal_open() && self.replay.is_none(), |ui| {
                    self.menus(ui)
                });
            });
            if self.show_inspector {
                let panel = egui::Panel::right("arena-inspector")
                    .default_size(self.inspector_width)
                    .min_size(160.0)
                    .max_size((width * 0.46).max(160.0))
                    .resizable(true)
                    .show_inside(ui, |ui| {
                        ui.set_min_width(ui.available_width());
                        self.inspector_panel(ui);
                    });
                self.inspector_width = panel.response.rect.width();
            }
            if self.show_debugger {
                let panel = egui::Panel::bottom("arena-debugger")
                    .default_size(self.debugger_height)
                    .min_size(72.0)
                    .max_size((height * 0.54).max(72.0))
                    .resizable(true)
                    .show_inside(ui, |ui| {
                        ui.set_min_height(ui.available_height());
                        ui.heading("Debugger");
                        egui::ScrollArea::vertical().show(ui, |ui| self.debugger(ui));
                    });
                self.debugger_height = panel.response.rect.height();
            }
            self.edit_dialog(&context);
            self.setup_dialog(&context);
            self.source_dialog(&context);
            self.source_view_dialog(&context);
            self.library_dialog(&context);
            self.results_dialog(&context);
        }
        egui::CentralPanel::default().show_inside(ui, |ui| {
            ui.add_enabled_ui(!self.modal_open(), |ui| {
                ui.horizontal_wrapped(|ui| self.controls(ui))
            });
            if let Some(error) = self.error.as_ref().filter(|_| !self.modal_open()) {
                ui.colored_label(Color32::LIGHT_RED, error);
            } else if let Some(notice) = &self.match_notice {
                ui.label(RichText::new(notice).weak());
            }
            if self.benchmark.is_none() {
                self.timeline_controls(ui);
            }
            let status = if self.replay.is_some() {
                "Replay".into()
            } else if self.arena.done() {
                self.arena.outcome()
            } else if self.running {
                "Running".into()
            } else {
                "Paused".into()
            };
            let round = self
                .replay
                .as_ref()
                .map_or(self.round, |replay| replay.viewed as u32 + 1);
            ui.horizontal_wrapped(|ui| {
                ui.label(format!(
                    "{status}  ·  Round {}/{}  ·  Cycle {} / {}  ·  {} instructions",
                    round,
                    self.setup.rounds,
                    self.arena.cycle(),
                    self.arena.rules.cycles,
                    self.arena.steps()
                ));
                if self.benchmark.is_none()
                    && self.replay.is_none()
                    && !self.modal_open()
                    && ui
                        .small_button(self.setup.preset.label())
                        .on_hover_text("Match settings")
                        .clicked()
                {
                    self.open_match_settings();
                }
            });
            self.roster_summary(ui);
            self.grid(ui);
            if self.dirty {
                ui.ctx().request_repaint();
            }
            if self.running {
                ui.ctx().request_repaint_after(
                    self.next_frame.saturating_duration_since(Instant::now()),
                );
            }
        });
        if self.workspace_path.is_some() {
            if start >= self.workspace_check {
                self.save_workspace();
                self.workspace_check = start + Duration::from_secs(1);
            }
            context.request_repaint_after(
                self.workspace_check
                    .saturating_duration_since(Instant::now()),
            );
        }
        if let Some(benchmark) = &mut self.benchmark {
            let previous_cpu = frame
                .info()
                .cpu_usage
                .map(|s| Duration::from_secs_f32(s.max(0.0)));
            if benchmark.sample(
                start,
                simulation,
                draw_start.elapsed(),
                previous_cpu,
                self.arena.steps(),
                &self.adapter,
            ) {
                self.benchmark = None;
                ui.ctx().send_viewport_cmd(egui::ViewportCommand::Close);
            } else {
                ui.ctx()
                    .request_repaint_after(FRAME_TIME.saturating_sub(start.elapsed()));
            }
        }
    }

    fn on_exit(&mut self) {
        self.save_workspace();
    }
}
