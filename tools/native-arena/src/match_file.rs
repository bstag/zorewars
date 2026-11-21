use crate::arena::{Arena, CodeChange, Death, ProcessSample, RoundStart, RoundStats, MAX_WARRIORS};
use crate::match_setup::{MatchSetup, MAX_SEED};
use crate::redcode::{assemble_with_rules, Rules, Warrior, MODS, OPS};
use crate::timeline::Timeline;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{self, BufReader, BufWriter, Write};
use std::path::Path;

pub const EXTENSION: &str = "zwmatch";
const FORMAT_VERSION: u32 = 1;
const MAX_FILE_BYTES: u64 = 256 * 1024 * 1024;

#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CoreEdit {
    pub step: u32,
    pub address: usize,
    pub source: String,
}

#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RoundReplay {
    pub start: RoundStart,
    pub edits: Vec<CoreEdit>,
    pub steps: u32,
}

impl RoundReplay {
    pub fn capture(arena: &Arena, edits: &[CoreEdit], steps: u32) -> Self {
        Self {
            start: arena.round_start(),
            edits: edits.to_vec(),
            steps,
        }
    }

    fn validate(&self, setup: &MatchSetup, count: usize, round: u32) -> Result<(), String> {
        let rules = setup.preset.rules();
        let positions = setup.positions(count, round)?;
        let mover = (round as usize - 1) % count;
        if !self.start.matches(&positions, mover, rules) || self.steps > rules.cycles * count as u32
        {
            return Err("invalid positions, first mover, P-space, or instruction count".into());
        }
        let mut previous = 0;
        for edit in &self.edits {
            if edit.step < previous || edit.step > self.steps || edit.address >= rules.core_size {
                return Err("invalid core edit position".into());
            }
            previous = edit.step;
        }
        Ok(())
    }

    pub fn rebuild(
        &self,
        warriors: Vec<Warrior>,
        rules: Rules,
        include_before_edits: bool,
    ) -> Result<(Arena, Timeline), String> {
        let mut arena = self.start.restore(warriors, rules);
        let mut timeline = Timeline::new(&arena);
        for edit in &self.edits {
            advance_to(&mut arena, &mut timeline, edit.step)?;
            arena
                .edit(edit.address, &edit.source)
                .map_err(|error| format!("Core edit at {}: {error}", edit.address))?;
            if include_before_edits {
                timeline.record_edit(&arena, edit.address);
            } else {
                timeline = Timeline::new(&arena);
            }
        }
        advance_to(&mut arena, &mut timeline, self.steps)?;
        Ok((arena, timeline))
    }
}

fn advance_to(arena: &mut Arena, timeline: &mut Timeline, step: u32) -> Result<(), String> {
    timeline.advance(arena, step.saturating_sub(arena.steps()), None);
    if arena.steps() != step {
        return Err(format!("Replay did not reach the recorded step {step}"));
    }
    Ok(())
}

#[derive(Serialize, Deserialize)]
pub struct RoundResult {
    pub outcome: String,
    pub cycle: u32,
    pub replay: RoundReplay,
    pub elimination: Option<Death>,
    pub stats: [RoundStats; MAX_WARRIORS],
    pub changed: Vec<Vec<CodeChange>>,
    pub samples: Vec<ProcessSample>,
    pub scores: [u32; MAX_WARRIORS],
}

impl RoundResult {
    pub fn capture(arena: &Arena, edits: &[CoreEdit]) -> Self {
        let count = arena.warriors.len();
        let elimination = (0..count)
            .filter(|&side| arena.processes(side) == 0)
            .filter_map(|side| arena.stats[side].last_death)
            .max_by_key(|death| death.step);
        let mut scores = [0; MAX_WARRIORS];
        for (side, score) in scores[..count].iter_mut().enumerate() {
            *score = arena.round_score(side);
        }
        Self {
            outcome: arena.outcome(),
            cycle: arena.cycle(),
            replay: RoundReplay::capture(arena, edits, arena.steps()),
            elimination,
            stats: arena.stats.clone(),
            changed: (0..count).map(|side| arena.changed_code(side)).collect(),
            samples: arena.samples.clone(),
            scores,
        }
    }

    fn validate_report(&self, warriors: &[Warrior], rules: Rules) -> Result<(), String> {
        let count = warriors.len();
        let size = rules.core_size;
        let steps = self.replay.steps;
        if self.cycle > rules.cycles
            || self.changed.len() != count
            || self
                .scores
                .iter()
                .any(|&score| score >= (count * count) as u32)
        {
            return Err("invalid round summary".into());
        }
        for death in self.elimination.iter().chain(
            self.stats
                .iter()
                .filter_map(|stats| stats.last_death.as_ref()),
        ) {
            if death.actor >= count
                || death.address >= size
                || death.step == 0
                || death.step > steps
                || death.writer.is_some_and(|writer| {
                    writer.actor >= count || writer.pc >= size || writer.step > steps
                })
            {
                return Err("invalid process death in round summary".into());
            }
        }
        for (changes, warrior) in self.changed.iter().zip(warriors) {
            for change in changes {
                let [instruction, a, b] = change.ending;
                if change.address >= size
                    || change.offset >= warrior.code.len()
                    || (instruction & 31) as usize >= OPS.len()
                    || ((instruction >> 5) & 7) as usize >= MODS.len()
                    || usize::from(a) >= size
                    || usize::from(b) >= size
                {
                    return Err("invalid changed instruction in round summary".into());
                }
            }
        }
        if self.samples.iter().any(|sample| {
            sample.step > steps
                || sample
                    .counts
                    .iter()
                    .any(|&count| count as usize > rules.processes)
        }) {
            return Err("invalid process sample in round summary".into());
        }
        Ok(())
    }
}

#[derive(Serialize)]
pub struct MatchFile<'a> {
    version: u32,
    setup: &'a MatchSetup,
    roster: Vec<(&'a str, &'a str)>,
    round: u32,
    active: RoundReplay,
    cursor: u32,
    address: usize,
    results: &'a [RoundResult],
}

#[derive(Deserialize)]
struct SavedMatch {
    version: u32,
    setup: MatchSetup,
    roster: Vec<(String, String)>,
    round: u32,
    active: RoundReplay,
    cursor: u32,
    address: usize,
    results: Vec<RoundResult>,
}

pub struct OpenedMatch {
    pub setup: MatchSetup,
    pub round: u32,
    pub arena: Arena,
    pub timeline: Timeline,
    pub edits: Vec<CoreEdit>,
    pub address: usize,
    pub results: Vec<RoundResult>,
    pub scores: [u32; MAX_WARRIORS],
}

impl<'a> MatchFile<'a> {
    pub fn new(
        setup: &'a MatchSetup,
        round: u32,
        arena: &'a Arena,
        timeline: &Timeline,
        edits: &[CoreEdit],
        address: usize,
        results: &'a [RoundResult],
    ) -> Self {
        Self {
            version: FORMAT_VERSION,
            setup,
            round,
            address,
            results,
            roster: arena
                .warriors
                .iter()
                .map(|warrior| (warrior.fallback.as_ref(), warrior.source.as_ref()))
                .collect(),
            active: RoundReplay::capture(arena, edits, timeline.latest_step()),
            cursor: arena.steps(),
        }
    }

    pub fn write(&self, path: &Path) -> io::Result<()> {
        let mut temp = path.as_os_str().to_owned();
        temp.push(format!(".{}.tmp", std::process::id()));
        let result = (|| {
            let mut writer = BufWriter::new(File::create(&temp)?);
            serde_json::to_writer(&mut writer, self)?;
            writer.flush()?;
            if writer.get_ref().metadata()?.len() > MAX_FILE_BYTES {
                return Err(io::Error::other("Match file is larger than 256 MiB"));
            }
            writer.get_ref().sync_all()?;
            drop(writer);
            fs::rename(&temp, path)
        })();
        if result.is_err() {
            let _ = fs::remove_file(&temp);
        }
        result
    }
}

impl OpenedMatch {
    pub fn read(path: &Path) -> Result<Self, String> {
        let file = File::open(path).map_err(|error| error.to_string())?;
        if file.metadata().map_err(|error| error.to_string())?.len() > MAX_FILE_BYTES {
            return Err("Match file is larger than 256 MiB".into());
        }
        let saved: SavedMatch =
            serde_json::from_reader(BufReader::new(file)).map_err(|error| error.to_string())?;
        saved.restore()
    }
}

impl SavedMatch {
    fn restore(self) -> Result<OpenedMatch, String> {
        if self.version != FORMAT_VERSION {
            return Err(format!("Unsupported match file version {}", self.version));
        }
        let count = self.roster.len();
        if !(1..=MAX_WARRIORS).contains(&count)
            || !(1..=1000).contains(&self.setup.rounds)
            || !(1..=self.setup.rounds).contains(&self.round)
            || !(1..=MAX_SEED).contains(&self.setup.seed)
            || !((self.round as usize - 1)..=self.round as usize).contains(&self.results.len())
        {
            return Err("Invalid roster, match settings, or round count".into());
        }
        let rules = self.setup.preset.rules();
        let warriors = self
            .roster
            .iter()
            .map(|(name, source)| {
                assemble_with_rules(source, name, rules).map_err(|error| format!("{name}: {error}"))
            })
            .collect::<Result<Vec<_>, _>>()?;
        let mut scores = [0; MAX_WARRIORS];
        for (index, result) in self.results.iter().enumerate() {
            let round = index as u32 + 1;
            result
                .replay
                .validate(&self.setup, count, round)
                .and_then(|()| result.validate_report(&warriors, rules))
                .map_err(|error| format!("Round {round}: {error}"))?;
            if round != self.round {
                for (total, score) in scores.iter_mut().zip(result.scores) {
                    *total += score;
                }
            } else if result.replay != self.active {
                return Err("Current round does not match its recorded replay".into());
            }
        }
        self.active
            .validate(&self.setup, count, self.round)
            .map_err(|error| format!("Current round: {error}"))?;
        if self.address >= rules.core_size
            || self.cursor > self.active.steps
            || self
                .active
                .edits
                .last()
                .is_some_and(|edit| self.cursor < edit.step)
        {
            return Err("Invalid match cursor or selected cell".into());
        }
        let (mut arena, timeline) = self.active.rebuild(warriors, rules, false)?;
        if arena.done() != (self.results.len() == self.round as usize) {
            return Err("Current round completion differs from the recorded results".into());
        }
        timeline.seek_step(&mut arena, self.cursor);
        Ok(OpenedMatch {
            setup: self.setup,
            round: self.round,
            arena,
            timeline,
            edits: self.active.edits,
            address: self.address,
            results: self.results,
            scores,
        })
    }
}

#[cfg(test)]
#[test]
fn rejects_incompatible_version_and_out_of_range_replay_data() {
    let setup = MatchSetup::default();
    let arena = setup.start(&setup.preset.starter().unwrap()).unwrap();
    let timeline = Timeline::new(&arena);
    let file = MatchFile::new(&setup, 1, &arena, &timeline, &[], 0, &[]);

    let mut value = serde_json::to_value(file).unwrap();
    value["version"] = 0.into();
    let saved: SavedMatch = serde_json::from_value(value.clone()).unwrap();
    assert!(saved
        .restore()
        .err()
        .unwrap()
        .contains("Unsupported match file version"));

    value["version"] = FORMAT_VERSION.into();
    value["active"]["start"]["positions"][0] = arena.rules.core_size.into();
    let saved: SavedMatch = serde_json::from_value(value).unwrap();
    assert!(saved.restore().err().unwrap().contains("invalid positions"));
}
