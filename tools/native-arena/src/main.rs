#![cfg_attr(windows, windows_subsystem = "windows")]

mod arena;
#[cfg(any(windows, feature = "gpu"))]
mod benchmark;
#[cfg(feature = "gpu")]
mod completion;
#[cfg(feature = "gpu")]
mod gpu_window;
#[cfg(feature = "gpu")]
mod match_file;
#[cfg(any(feature = "gpu", test))]
mod match_setup;
mod redcode;
#[cfg(any(feature = "gpu", test))]
mod timeline;
#[cfg(all(windows, not(feature = "gpu")))]
mod window;
#[cfg(feature = "gpu")]
mod workspace;

use redcode::{assemble, Warrior};
use std::path::Path;

fn load(path: &Path) -> Result<Warrior, String> {
    load_with_rules(path, redcode::Rules::CLASSIC)
}

fn load_with_rules(path: &Path, rules: redcode::Rules) -> Result<Warrior, String> {
    let (source, fallback) = read_redcode(path)?;
    redcode::assemble_with_rules(&source, &fallback, rules)
        .map_err(|e| format!("{}: {e}", path.display()))
}

fn read_redcode(path: &Path) -> Result<(String, String), String> {
    let source = std::fs::read_to_string(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let fallback = path
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned();
    Ok((source, fallback))
}

#[cfg(any(windows, feature = "gpu"))]
fn startup() -> Result<arena::Arena, String> {
    let files: Vec<_> = std::env::args_os().skip(1).collect();
    if files.len() > arena::MAX_WARRIORS {
        return Err("Choose up to four warrior files.".into());
    }
    let warriors = if files.is_empty() {
        vec![
            assemble(include_str!("../../../warriors/dwarf.red"), "Dwarf")?,
            assemble(include_str!("../../../warriors/imp.red"), "Imp")?,
        ]
    } else {
        files
            .iter()
            .map(|p| load(Path::new(p)))
            .collect::<Result<_, _>>()?
    };
    Ok(arena::Arena::new(warriors))
}

#[cfg(all(windows, not(feature = "gpu")))]
fn main() {
    let result = startup().and_then(window::run);
    if let Err(message) = result {
        show_error(&message);
        std::process::exit(1);
    }
}

#[cfg(feature = "gpu")]
fn main() {
    if let Err(error) = startup().and_then(gpu_window::run) {
        show_error(&error);
        std::process::exit(1);
    }
}

#[cfg(windows)]
fn show_error(message: &str) {
    use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR};

    let message: Vec<_> = message.encode_utf16().chain([0]).collect();
    let title: Vec<_> = "ZoreWars Arena".encode_utf16().chain([0]).collect();
    unsafe {
        MessageBoxW(
            std::ptr::null_mut(),
            message.as_ptr(),
            title.as_ptr(),
            MB_ICONERROR,
        );
    }
}

#[cfg(all(not(windows), feature = "gpu"))]
fn show_error(message: &str) {
    eprintln!("{message}");
}

#[cfg(all(not(windows), not(feature = "gpu")))]
fn main() {
    eprintln!("Build with --features gpu for the cross-platform arena.");
}

#[cfg(test)]
mod tests {
    use super::*;
    use arena::{Arena, Breakpoints, Stop, CYCLES};
    use match_setup::{MatchSetup, Placement, Preset};
    use timeline::Timeline;

    #[cfg(feature = "gpu")]
    #[test]
    fn source_tracking_follows_whole_instruction_copies_and_rewinds() {
        use arena::SourceLocation;
        let copier = assemble(
            "; café\ni FOR 2\nseed&i MOV.I 0, 1\nROF\nORG copy\ncopy MOV.I @ptr, 3998\noverwrite MOV.I bomb, 3997\nptr DAT #0, seed02-ptr\nbomb DAT 0",
            "Copier",
        ).unwrap();
        assert_eq!(copier.source_lines, [3, 3, 6, 7, 8, 9]);

        let mut arena = Arena::new(vec![copier, assemble("JMP 0", "Victim").unwrap()]);
        let mut timeline = Timeline::new(&arena);
        timeline.advance(&mut arena, 3, None);
        let copied = Some(SourceLocation {
            warrior: 0,
            offset: 1,
        });
        assert_eq!(arena.cell_source(4000), copied);
        assert_eq!(arena.cell_source(4001), copied);
        assert!(arena.instruction(4000).starts_with("DAT"));
        assert_eq!((arena.trace[1].actor, arena.trace[1].source), (1, copied));

        timeline.seek_step(&mut arena, 0);
        assert_eq!(
            arena.cell_source(4000),
            Some(SourceLocation {
                warrior: 1,
                offset: 0
            })
        );
        timeline.seek_step(&mut arena, 1);
        assert_eq!(arena.cell_source(4000), copied);
        arena.edit(4000, "DAT 0").unwrap();
        arena.advance(1);
        assert_eq!(arena.cell_source(4000), None);
        assert_eq!(arena.trace.back().unwrap().source, None);
    }

    #[test]
    fn redcode_expands_nested_for_with_counters_and_core_constants() {
        let source = "span EQU 2\norg cell02\ni FOR span\ncell&i DAT #i, #0\nj FOR 1\n DAT #i, #j\nROF\nROF\nFOR MAXLENGTH-CURLINE\n DAT #0, #0\nROF";
        let warrior = redcode::assemble_with_rules(source, "Loops", Preset::Nano.rules()).unwrap();
        assert_eq!(warrior.start, 2);
        assert_eq!(
            warrior
                .code
                .iter()
                .map(|cell| [cell[1], cell[2]])
                .collect::<Vec<_>>(),
            [[1, 0], [1, 1], [2, 0], [2, 1], [0, 0]]
        );
        let error = assemble("i FOR 2\nDAT #missing, #0\nROF", "Broken")
            .err()
            .unwrap();
        assert!(error.starts_with("line 2:"), "{error}");
    }

    #[test]
    fn hill_presets_load_compatible_starters_and_native_core_sizes() {
        for &(_, presets) in Preset::GROUPS {
            for &preset in presets {
                let setup = MatchSetup {
                    preset,
                    ..Default::default()
                };
                let rules = preset.rules();
                let mut arena = setup.start(&preset.starter().unwrap()).unwrap();
                assert_eq!(arena.owners.len(), rules.core_size);
                assert_eq!(arena.positions, [0, rules.core_size / 2]);
                assert_eq!(arena.pspace(0).len(), rules.space_size());
                arena.advance(16);
                assert_eq!(arena.steps(), 16, "{}", preset.label());
            }
        }
        let rules = Preset::Nano.rules();
        let code = redcode::assemble_with_rules(
            ";assert CORESIZE == 80 && MAXLENGTH == 5\nMOV 0, 1",
            "Nano Imp",
            rules,
        )
        .unwrap();
        let mut arena = Arena::round(vec![code], rules, vec![79], 0);
        arena.advance(1);
        assert_eq!(arena.pc(), Some(79));
        assert_eq!(arena.queued(0, 0), Some(0));
        arena.advance(10_000);
        assert!(arena.done());
        assert_eq!(arena.steps(), 800);
        assert!(
            redcode::assemble_with_rules("MOV 0, 1\n".repeat(6).as_str(), "Too long", rules)
                .is_err()
        );
    }

    #[test]
    fn icws88_rejects_newer_syntax_and_accepts_classic_cmp() {
        let rules = Preset::Icws88.rules();
        for source in [
            "JMP.B 0",
            "MUL 1, 2",
            "SEQ 1, 2",
            "MOV *0, 1",
            "ORG start\nstart JMP 0",
        ] {
            assert!(
                redcode::assemble_with_rules(source, "Invalid", rules).is_err(),
                "{source}"
            );
        }
        let warrior =
            redcode::assemble_with_rules("start CMP 0, <1\nEND start", "Valid", rules).unwrap();
        let mut arena = Arena::round(vec![warrior], rules, vec![0], 0);
        let cell = arena.instruction(0);
        assert_eq!(cell, "CMP $0, <1");
        arena.edit(0, &cell).unwrap();
    }

    #[test]
    fn seeded_placement_matches_the_cli_and_fixed_positions_wrap() {
        let mut setup = MatchSetup {
            preset: Preset::LimitedProcess,
            placement: Placement::Seeded,
            seed: 12345,
            ..Default::default()
        };
        // Reference positions from src/engine/topology.js with the LP preset.
        assert_eq!(setup.positions(2, 1).unwrap(), [0, 4944]);
        assert_eq!(setup.positions(2, 2).unwrap(), [0, 5719]);
        assert_eq!(setup.positions(4, 3).unwrap(), [0, 1265, 7275, 2875]);
        setup.placement = Placement::Fixed;
        setup.fixed = "7999, 100".into();
        assert!(setup.positions(2, 1).is_err());
        setup.fixed = "7999, 3000".into();
        setup.preset = Preset::Classic;
        let arena = setup
            .start(&[
                assemble("ORG loop\nDAT 0\nloop JMP 0", "Wrap").unwrap(),
                assemble("JMP 0", "Wait").unwrap(),
            ])
            .unwrap();
        assert_eq!(arena.queued(0, 0), Some(0));
        assert_eq!(arena.owners[7999], Some(0));
        assert_eq!(arena.owners[0], Some(0));
    }

    #[test]
    fn limited_process_rules_reassemble_and_cap_the_queue() {
        let setup = MatchSetup {
            preset: Preset::LimitedProcess,
            ..Default::default()
        };
        let warrior =
            assemble("limit EQU MAXPROCESSES\nSPL 0\nJMP -1\nDAT #limit", "Split").unwrap();
        let mut arena = setup.start(&[warrior]).unwrap();
        assert!(arena.instruction(2).ends_with("#8"));
        arena.advance(100);
        assert_eq!(arena.processes(0), 8);
        assert!(arena.queued(0, 8).is_none());
        assert!(arena
            .edit(0, "STP.AB #1, #1")
            .unwrap_err()
            .contains("requires P-space"));
    }

    #[test]
    fn next_round_rotates_the_first_mover_and_preserves_round_start_pspace() {
        let mut arena = Arena::new(vec![
            assemble("STP.AB #42, #1\nJMP 0", "Survivor").unwrap(),
            assemble("DAT 0", "Loser").unwrap(),
        ]);
        assert_eq!(arena.pspace(0)[0], 7999);
        let breaks = Breakpoints {
            process_death: true,
            ..Default::default()
        };
        assert_eq!(
            arena.run(100, Some(&breaks)),
            Some(Stop::ProcessDeath { address: 4000 })
        );
        assert_eq!(arena.steps(), 2);
        assert_eq!(arena.round_score(0), 3);
        assert_eq!(arena.round_score(1), 0);
        let mut next = arena.next_round(vec![0, 3000]);
        assert_eq!(next.next_actor(), Some(1));
        assert_eq!(&next.pspace(0)[..2], &[1, 42]);
        assert_eq!(next.pspace(1)[0], 0);
        next.advance(1);
        assert_eq!(next.pc(), Some(3000));
        next.reset();
        assert_eq!(next.next_actor(), Some(1));
        assert_eq!(&next.pspace(0)[..2], &[1, 42]);
    }

    #[test]
    fn debugger_views_and_edit_follow_the_current_timeline() {
        let mut arena = Arena::new(vec![
            assemble("STP.AB #7, #1\nSPL 2\nJMP 0\nJMP 0", "Test").unwrap()
        ]);
        let mut timeline = Timeline::new(&arena);
        timeline.advance(&mut arena, 2, None);
        assert_eq!(arena.pspace(0)[1], 7);
        assert_eq!(arena.queued(0, 0), Some(2));
        assert_eq!(arena.queued(0, 1), Some(3));
        assert_eq!(arena.queued(0, 2), None);
        assert_eq!(arena.find_next(3, "spl").unwrap(), Some(1));
        assert_eq!(arena.find_next(3, "7").unwrap(), Some(0));
        timeline.seek_step(&mut arena, 0);
        assert_eq!(arena.pspace(0)[1], 0);
        assert_eq!(arena.queued(0, 0), Some(0));
        timeline.seek_step(&mut arena, 2);
        assert!(arena.edit(2, "DAT 0\nJMP 0").is_err());
        assert!(arena.instruction(2).starts_with("JMP"));
        arena.edit(2, "DAT 0").unwrap();
        let mut edited = Timeline::new(&arena);
        edited.advance(&mut arena, 1, None);
        assert_eq!(arena.deaths[2], 3);
        assert_eq!(arena.executed[2], 3);
        edited.seek_step(&mut arena, 0);
        assert_eq!(arena.steps(), 2);
        assert!(arena.instruction(2).starts_with("DAT"));
        assert_eq!(arena.deaths[2], 0);
        assert_eq!(arena.queued(0, 0), Some(2));
    }

    #[test]
    fn timeline_rewinds_and_reproduces_first_hit_with_pspace() {
        let mut arena = Arena::new(vec![
            assemble(
                "STP.AB #7, #1\nLDP.AB #1, 2\nMOV.I 0, 3998\nJMP -2",
                "Writer",
            )
            .unwrap(),
            assemble("JMP 0", "Wait").unwrap(),
        ]);
        let mut timeline = Timeline::new(&arena);
        let breaks = Breakpoints {
            first_hit: true,
            ..Default::default()
        };
        assert_eq!(
            timeline.advance(&mut arena, 512, Some(&breaks)),
            Some(Stop::FirstHit {
                address: 4000,
                victim: 1
            })
        );
        let hit = arena.steps();
        let after = arena.instruction(4000);
        let write = arena.last_write(4000).unwrap();
        assert_eq!(
            (write.actor, write.pc, write.step, write.cycle),
            (0, 2, hit, 2)
        );
        timeline.seek_step(&mut arena, hit - 1);
        assert_eq!(arena.last_write(4000), None);
        assert_eq!(arena.owners[4000], Some(1));
        assert_eq!(
            timeline.advance(&mut arena, 512, Some(&breaks)),
            Some(Stop::FirstHit {
                address: 4000,
                victim: 1
            })
        );
        assert_eq!(arena.steps(), hit);
        assert_eq!(arena.instruction(4000), after);
        assert_eq!(arena.last_write(4000), Some(write));
        timeline.seek_cycle(&mut arena, 1);
        assert_eq!(arena.steps(), 2);
        timeline.seek_cycle(&mut arena, timeline.latest_cycle());
        assert_eq!(arena.steps(), hit);
    }

    #[test]
    fn timeline_seeks_across_snapshots_and_keeps_the_reached_range() {
        let mut arena = Arena::new(vec![
            assemble("SPL 1\nJMP -1", "Split").unwrap(),
            assemble("MOV.I 0, 1", "Imp").unwrap(),
        ]);
        let mut reference = arena.clone();
        let mut timeline = Timeline::new(&arena);
        timeline.advance(&mut arena, 24_001, None);
        let tip = timeline.latest_cycle();
        timeline.seek_cycle(&mut arena, 9_000);
        reference.advance(18_000);
        assert_eq!(arena.steps(), reference.steps());
        assert_eq!(arena.owners, reference.owners);
        assert_eq!(arena.activity, reference.activity);
        for side in 0..2 {
            assert_eq!(arena.processes(side), reference.processes(side));
        }
        timeline.seek_cycle(&mut arena, 0);
        assert_eq!(arena.steps(), 0);
        assert_eq!(timeline.latest_cycle(), tip);
        timeline.seek_cycle(&mut arena, tip);
        assert_eq!(arena.steps(), 24_001);
    }

    #[test]
    fn first_hit_stops_on_the_first_ordered_write_and_rearms_on_reset() {
        let mut arena = Arena::new(vec![
            assemble("MOV.I >4000, 4001\nJMP -1", "Attacker").unwrap(),
            assemble("JMP 0\nDAT 0", "Defender").unwrap(),
        ]);
        let breaks = Breakpoints {
            first_hit: true,
            ..Default::default()
        };
        let stop = Stop::FirstHit {
            address: 4000,
            victim: 1,
        };
        assert_eq!(arena.run(512, Some(&breaks)), Some(stop));
        assert_eq!(arena.steps(), 1);
        assert_eq!(
            arena.trace.back().unwrap().writes,
            [Some(4000), Some(4001), None]
        );
        assert_eq!(arena.run(4, Some(&breaks)), None);
        assert_eq!(arena.steps(), 5);
        arena.reset();
        assert_eq!(
            arena.run(512, Some(&breaks)),
            Some(Stop::FirstHit {
                address: 4000,
                victim: 1
            })
        );
        arena.reset();
        arena.advance(2);
        assert_eq!(arena.run(4, Some(&breaks)), None);
    }

    #[test]
    fn first_hit_skips_eliminated_warriors_and_cell_breakpoints_stop_exactly() {
        let mut arena = Arena::new(vec![
            assemble("DAT 0", "Eliminated").unwrap(),
            assemble("MOV.I 0, -2666\nMOV.I 0, 2666\nJMP -2", "Attacker").unwrap(),
            assemble("JMP 0", "Defender").unwrap(),
        ]);
        let mut breaks = Breakpoints {
            first_hit: true,
            ..Default::default()
        };
        assert_eq!(
            arena.run(512, Some(&breaks)),
            Some(Stop::FirstHit {
                address: 5333,
                victim: 2
            })
        );
        assert_eq!(arena.steps(), 4);
        assert_eq!(arena.pc(), Some(2667));
        arena.reset();
        breaks.first_hit = false;
        breaks.write.insert(0);
        assert_eq!(
            arena.run(512, Some(&breaks)),
            Some(Stop::Write { address: 0 })
        );
        assert_eq!(arena.steps(), 2);
        breaks.execute.insert(5333);
        assert_eq!(
            arena.run(512, Some(&breaks)),
            Some(Stop::Execute { address: 5333 })
        );
        assert_eq!(arena.steps(), 3);
    }

    #[test]
    fn assembles_library_warriors_and_tracks_imp_writes() {
        let dwarf = assemble(include_str!("../../../warriors/dwarf.red"), "Dwarf").unwrap();
        assert_eq!(dwarf.start, 0);
        assert_eq!(dwarf.code[0][1..], [4, 3]);
        let imp = assemble(include_str!("../../../warriors/imp.red"), "Imp").unwrap();
        let mut arena = Arena::new(vec![imp]);
        arena.advance(300);
        assert_eq!(arena.pc(), Some(299));
        assert_eq!(arena.owners[300], Some(0));
        assert_eq!(arena.instruction(300), "MOV.I $0, $1");
        arena.advance(CYCLES);
        assert_eq!(arena.outcome(), "Imp survived");
        arena.reset();
        assert_eq!(arena.steps(), 0);
        assert_eq!(arena.owners[300], None);
    }

    #[test]
    fn shared_engine_eliminates_warriors_and_finishes_multiwarrior_round() {
        let mut arena = Arena::new(vec![
            assemble("DAT 0", "A").unwrap(),
            assemble("JMP 0", "B").unwrap(),
            assemble("DAT 0", "C").unwrap(),
        ]);
        arena.advance(1);
        assert_eq!(arena.processes(0), 0);
        assert!(!arena.done());
        arena.advance(2);
        assert!(arena.done());
        assert_eq!(arena.outcome(), "B wins");
    }
}
