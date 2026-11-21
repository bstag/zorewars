#![allow(dead_code)]
include!("../../ring-duel-wasm.rs");

use crate::redcode::{Rules, Warrior, MODES, MODS, OPS};
use std::collections::{BTreeSet, VecDeque};

pub const SIZE: usize = Rules::CLASSIC.core_size;
pub const CYCLES: u32 = Rules::CLASSIC.cycles;
pub const MAX_WARRIORS: usize = 4;
const TRACE_LENGTH: usize = 6;
const EMPTY: Cell<u16> = Cell {
    instruction: (4 << 5) | (1 << 8) | (1 << 11),
    a: 0,
    b: 0,
};

#[derive(Default)]
pub struct Breakpoints {
    pub execute: BTreeSet<usize>,
    pub write: BTreeSet<usize>,
    pub first_hit: bool,
    pub process_death: bool,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Stop {
    Execute { address: usize },
    Write { address: usize },
    FirstHit { address: usize, victim: usize },
    ProcessDeath { address: usize },
}

impl Stop {
    pub fn address(&self) -> usize {
        match *self {
            Self::Execute { address }
            | Self::Write { address }
            | Self::ProcessDeath { address }
            | Self::FirstHit { address, .. } => address,
        }
    }
}

#[derive(Clone)]
pub struct TraceEntry {
    pub step: u32,
    pub cycle: u32,
    pub actor: usize,
    pub pc: usize,
    pub killed: bool,
    pub writes: [Option<usize>; 3],
    #[cfg(feature = "gpu")]
    pub source: Option<SourceLocation>,
}

#[cfg(feature = "gpu")]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SourceLocation {
    pub offset: u16,
    pub warrior: u8,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "gpu", derive(serde::Serialize, serde::Deserialize))]
pub struct LastWrite {
    pub step: u32,
    pub cycle: u32,
    pub actor: usize,
    pub pc: usize,
}

#[derive(Clone, Copy)]
#[cfg_attr(feature = "gpu", derive(serde::Serialize, serde::Deserialize))]
pub struct Death {
    pub step: u32,
    pub cycle: u32,
    pub actor: usize,
    pub address: usize,
    pub writer: Option<LastWrite>,
}

#[derive(Clone, Default)]
#[cfg_attr(feature = "gpu", derive(serde::Serialize, serde::Deserialize))]
pub struct RoundStats {
    // Own code, enemy code, empty core, division by zero.
    pub deaths: [u32; 4],
    pub foreign_steps: u32,
    pub last_death: Option<Death>,
}

#[derive(Clone, Copy)]
#[cfg_attr(feature = "gpu", derive(serde::Serialize, serde::Deserialize))]
pub struct ProcessSample {
    pub step: u32,
    pub counts: [u32; MAX_WARRIORS],
}

#[cfg_attr(feature = "gpu", derive(Clone, serde::Serialize, serde::Deserialize))]
pub struct CodeChange {
    pub address: usize,
    pub offset: usize,
    pub ending: [u16; 3],
}

#[derive(Clone, PartialEq, Eq)]
#[cfg_attr(feature = "gpu", derive(serde::Serialize, serde::Deserialize))]
pub struct RoundStart {
    positions: Vec<usize>,
    pspace: Vec<u16>,
    first_turn: usize,
}

impl RoundStart {
    #[cfg(feature = "gpu")]
    pub fn matches(&self, positions: &[usize], first_turn: usize, rules: Rules) -> bool {
        self.positions == positions
            && self.first_turn == first_turn
            && self.pspace.len() == positions.len() * rules.space_size()
            && self
                .pspace
                .iter()
                .all(|&value| usize::from(value) < rules.core_size)
    }

    pub fn restore(&self, warriors: Vec<Warrior>, rules: Rules) -> Arena {
        let mut arena = Arena::round(warriors, rules, self.positions.clone(), self.first_turn);
        arena.starting_pspace.copy_from_slice(&self.pspace);
        arena.pspace.copy_from_slice(&self.pspace);
        arena
    }
}

#[derive(Clone)]
pub struct Arena {
    pub warriors: Vec<Warrior>,
    pub rules: Rules,
    pub positions: Vec<usize>,
    pub owners: Vec<Option<usize>>,
    pub activity: Vec<u32>,
    pub executed: Vec<u32>,
    pub deaths: Vec<u32>,
    pub trace: VecDeque<TraceEntry>,
    pub stats: [RoundStats; MAX_WARRIORS],
    pub samples: Vec<ProcessSample>,
    #[cfg(feature = "gpu")]
    sources: Vec<Option<SourceLocation>>,
    #[cfg(feature = "gpu")]
    execution_sources: Vec<Option<SourceLocation>>,
    opcodes: Vec<u8>,
    last_writes: Vec<Option<LastWrite>>,
    first_hit_seen: bool,
    core: Vec<Cell<u16>>,
    queue: Vec<u16>,
    queues: Vec<u32>,
    pspace: Vec<u16>,
    starting_pspace: Vec<u16>,
    first_turn: usize,
    state: Vec<u32>,
    died: Vec<u32>,
}

impl Arena {
    pub fn new(warriors: Vec<Warrior>) -> Self {
        let n = warriors.len();
        Self::round(
            warriors,
            Rules::CLASSIC,
            (0..n).map(|side| side * SIZE / n).collect(),
            0,
        )
    }

    pub fn round(
        warriors: Vec<Warrior>,
        rules: Rules,
        positions: Vec<usize>,
        first_turn: usize,
    ) -> Self {
        assert!((1..=MAX_WARRIORS).contains(&warriors.len()));
        let n = warriors.len();
        let size = rules.core_size;
        let pspace_size = rules.space_size();
        let mut starting_pspace = vec![0; n * pspace_size];
        if pspace_size != 0 {
            for cells in starting_pspace.chunks_exact_mut(pspace_size) {
                cells[0] = size as u16 - 1;
            }
        }
        let mut arena = Self {
            warriors,
            rules,
            positions,
            owners: vec![None; size],
            activity: vec![0; size],
            executed: vec![0; size],
            deaths: vec![0; size],
            trace: VecDeque::with_capacity(TRACE_LENGTH),
            stats: std::array::from_fn(|_| RoundStats::default()),
            samples: Vec::new(),
            #[cfg(feature = "gpu")]
            sources: vec![None; size],
            #[cfg(feature = "gpu")]
            execution_sources: vec![None; size],
            opcodes: vec![DAT as u8; size],
            last_writes: vec![None; size],
            first_hit_seen: false,
            core: vec![EMPTY; size],
            queue: vec![0; n * rules.processes],
            queues: vec![0; 3 * n],
            pspace: vec![0; n * pspace_size],
            starting_pspace,
            first_turn,
            state: vec![0; ROUND_STATE_WORDS + HISTORY_BATCH as usize * HISTORY_WORDS],
            died: vec![0; 2 * n],
        };
        arena.reset();
        arena
    }

    pub fn next_round(&self, positions: Vec<usize>) -> Self {
        assert!(self.done());
        let n = self.warriors.len();
        let mut next = Self::round(
            self.warriors.clone(),
            self.rules,
            positions,
            (self.first_turn + 1) % n,
        );
        if self.rules.pspace {
            next.starting_pspace.copy_from_slice(&self.pspace);
            let survivors = (0..n).filter(|&side| self.processes(side) > 0).count() as u16;
            for (side, cells) in next
                .starting_pspace
                .chunks_exact_mut(self.rules.space_size())
                .enumerate()
            {
                cells[0] = if self.processes(side) > 0 {
                    survivors
                } else {
                    0
                };
            }
            next.pspace.copy_from_slice(&next.starting_pspace);
        }
        next
    }

    pub fn round_score(&self, side: usize) -> u32 {
        if !self.done() || self.processes(side) == 0 {
            return 0;
        }
        let count = self.warriors.len() as u32;
        let survivors = (0..self.warriors.len())
            .filter(|&i| self.processes(i) != 0)
            .count() as u32;
        (count * count - 1) / survivors
    }

    pub fn round_start(&self) -> RoundStart {
        RoundStart {
            positions: self.positions.clone(),
            pspace: self.starting_pspace.clone(),
            first_turn: self.first_turn,
        }
    }

    pub fn changed_code(&self, side: usize) -> Vec<CodeChange> {
        self.warriors[side]
            .code
            .iter()
            .enumerate()
            .filter_map(|(offset, original)| {
                let address = (self.positions[side] + offset) % self.core.len();
                let current = self.core[address];
                let ending = [current.instruction, current.a, current.b];
                (*original != ending).then_some(CodeChange {
                    address,
                    offset,
                    ending,
                })
            })
            .collect()
    }

    pub fn reset(&mut self) {
        let n = self.warriors.len();
        let size = self.rules.core_size;
        self.core.fill(EMPTY);
        self.owners.fill(None);
        self.activity.fill(0);
        self.executed.fill(0);
        self.deaths.fill(0);
        self.trace.clear();
        self.stats = std::array::from_fn(|_| RoundStats::default());
        self.samples.clear();
        #[cfg(feature = "gpu")]
        {
            self.sources.fill(None);
            self.execution_sources.fill(None);
        }
        self.opcodes.fill(DAT as u8);
        self.last_writes.fill(None);
        self.first_hit_seen = false;
        self.queue.fill(0);
        self.queues.fill(0);
        self.pspace.copy_from_slice(&self.starting_pspace);
        self.state.fill(0);
        self.died.fill(0);
        self.state[1] = self.first_turn as u32;
        self.state[2] = self.rules.cycles * n as u32;
        self.state[3] = n as u32;
        for (side, w) in self.warriors.iter().enumerate() {
            let base = self.positions[side];
            for (i, &[instruction, a, b]) in w.code.iter().enumerate() {
                let address = (base + i) % size;
                self.core[address] = Cell { instruction, a, b };
                self.opcodes[address] = (instruction & 31) as u8;
                self.owners[address] = Some(side);
                #[cfg(feature = "gpu")]
                {
                    self.sources[address] = Some(SourceLocation {
                        offset: i as u16,
                        warrior: side as u8,
                    });
                }
            }
            self.queue[side * self.rules.processes] = ((base + w.start) % size) as u16;
            self.queues[n + side] = 1;
            self.queues[2 * n + side] = 1;
        }
        let mut counts = [0; MAX_WARRIORS];
        counts[..n].fill(1);
        self.samples.push(ProcessSample { step: 0, counts });
    }

    pub fn advance(&mut self, steps: u32) {
        self.run(steps, None);
    }

    pub fn run(&mut self, mut steps: u32, breaks: Option<&Breakpoints>) -> Option<Stop> {
        let size = self.rules.core_size;
        let pspace_size = self.rules.space_size();
        let sample_every = (self.rules.cycles * self.warriors.len() as u32).div_ceil(96);
        while steps > 0 && !self.done() {
            let n = self.warriors.len();
            let start = self.steps();
            let watch_hits = !self.first_hit_seen && n > 1;
            // While watching for a stop, commit at most one instruction. The
            // interpreter itself still commits all of that instruction's writes.
            let exact = breaks.is_some_and(|b| {
                !b.execute.is_empty()
                    || !b.write.is_empty()
                    || b.first_hit && watch_hits
                    || b.process_death
            });
            let mut live_counts = [0; MAX_WARRIORS];
            for (side, count) in live_counts[..n].iter_mut().enumerate() {
                *count = self.processes(side);
            }
            let limit = if exact { 1 } else { steps };
            // These distinct buffers use the same packed layouts as the Wasm host.
            // The roster, core fields and queue indices are initialized above.
            let count = unsafe {
                advance_group(
                    self.core.as_mut_ptr(),
                    self.queue.as_mut_ptr(),
                    self.queues.as_mut_ptr(),
                    size as u32,
                    self.rules.processes as u32,
                    self.pspace.as_mut_ptr(),
                    pspace_size,
                    n,
                    self.died.as_mut_ptr(),
                    self.state.as_mut_ptr(),
                    limit,
                    1,
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                )
            };
            assert!(count > 0 && count <= HISTORY_BATCH);
            let mut stop = None;
            for (index, record) in self.state[ROUND_STATE_WORDS..]
                .chunks_exact(HISTORY_WORDS)
                .take(count as usize)
                .enumerate()
            {
                let time = start + index as u32 + 1;
                let pc = record[HISTORY_PC] as usize;
                let actor = record[HISTORY_ACTOR] as usize;
                #[cfg(feature = "gpu")]
                let source = self.sources[pc];
                #[cfg(feature = "gpu")]
                {
                    self.execution_sources[pc] = source;
                }
                let owner = self.owners[pc];
                if owner.is_some_and(|side| side != actor) {
                    self.stats[actor].foreign_steps += 1;
                }
                self.activity[pc] = time;
                self.executed[pc] = time;
                let killed = record[HISTORY_SUCCESSORS] == HISTORY_NONE;
                if killed {
                    self.deaths[pc] = time;
                    let cause = if self.opcodes[pc] != DAT as u8 {
                        3
                    } else {
                        match owner {
                            Some(side) if side == actor => 0,
                            Some(_) => 1,
                            None => 2,
                        }
                    };
                    self.stats[actor].deaths[cause] += 1;
                    self.stats[actor].last_death = Some(Death {
                        step: time,
                        cycle: record[HISTORY_CYCLE],
                        actor,
                        address: pc,
                        writer: self.last_writes[pc],
                    });
                }
                let mut writes = [None; 3];
                for (slot, entry) in record[1..1 + HISTORY_WRITE_WORDS * record[0] as usize]
                    .chunks_exact(HISTORY_WRITE_WORDS)
                    .enumerate()
                {
                    let addr = entry[0] as usize;
                    writes[slot] = Some(addr);
                    if !self.first_hit_seen {
                        if let Some(victim) = self.owners[addr]
                            .filter(|&side| side != actor && live_counts[side] != 0)
                        {
                            self.first_hit_seen = true;
                            if breaks.is_some_and(|b| b.first_hit) {
                                stop.get_or_insert(Stop::FirstHit {
                                    address: addr,
                                    victim,
                                });
                            }
                        }
                    }
                    if breaks.is_some_and(|b| b.write.contains(&addr)) {
                        stop.get_or_insert(Stop::Write { address: addr });
                    }
                    self.owners[addr] = Some(actor);
                    self.opcodes[addr] = (entry[4] & 31) as u8;
                    self.activity[addr] = time;
                    self.last_writes[addr] = Some(LastWrite {
                        step: time,
                        cycle: record[HISTORY_CYCLE],
                        actor,
                        pc,
                    });
                }
                #[cfg(feature = "gpu")]
                if record[HISTORY_COPY_SOURCE] != HISTORY_NONE {
                    // Operand side effects only change fields. The last write in
                    // a MOV.I record is the whole-instruction copy.
                    let target = writes[record[0] as usize - 1].unwrap();
                    self.sources[target] = self.sources[record[HISTORY_COPY_SOURCE] as usize];
                }
                if breaks.is_some_and(|b| b.execute.contains(&pc)) {
                    stop.get_or_insert(Stop::Execute { address: pc });
                }
                if killed && breaks.is_some_and(|b| b.process_death) {
                    stop.get_or_insert(Stop::ProcessDeath { address: pc });
                }
                live_counts[actor] -= 1;
                live_counts[actor] += record[HISTORY_SUCCESSORS..HISTORY_SUCCESSORS + 2]
                    .iter()
                    .filter(|&&pc| pc != HISTORY_NONE)
                    .count() as u32;
                if time % sample_every == 0 || self.done() && index + 1 == count as usize {
                    self.samples.push(ProcessSample {
                        step: time,
                        counts: live_counts,
                    });
                }
                if self.trace.len() == TRACE_LENGTH {
                    self.trace.pop_front();
                }
                self.trace.push_back(TraceEntry {
                    step: time,
                    cycle: record[HISTORY_CYCLE],
                    actor,
                    pc,
                    killed,
                    writes,
                    #[cfg(feature = "gpu")]
                    source,
                });
            }
            if stop.is_some() {
                return stop;
            }
            steps -= count;
        }
        None
    }

    pub fn done(&self) -> bool {
        self.state[4] != 0
    }
    pub fn cycle(&self) -> u32 {
        self.state[0]
    }
    pub fn steps(&self) -> u32 {
        self.state[5]
    }
    pub fn pc(&self) -> Option<usize> {
        (self.steps() != 0).then_some(self.state[7] as usize)
    }
    pub fn next_actor(&self) -> Option<usize> {
        (!self.done()).then_some(self.state[1] as usize)
    }
    pub fn last_write(&self, address: usize) -> Option<LastWrite> {
        self.last_writes[address]
    }
    #[cfg(feature = "gpu")]
    pub fn cell_source(&self, address: usize) -> Option<SourceLocation> {
        if self.executed[address] == 0 {
            self.sources[address]
        } else {
            self.execution_sources[address]
        }
    }
    pub fn processes(&self, side: usize) -> u32 {
        self.queues[2 * self.warriors.len() + side]
    }
    pub fn queued(&self, side: usize, index: usize) -> Option<usize> {
        let cap = self.rules.processes;
        (index < self.processes(side) as usize)
            .then(|| self.queue[side * cap + (self.queues[side] as usize + index) % cap] as usize)
    }
    pub fn pspace(&self, side: usize) -> &[u16] {
        let size = self.rules.space_size();
        &self.pspace[side * size..(side + 1) * size]
    }
    pub fn edit(&mut self, address: usize, source: &str) -> Result<(), String> {
        let warrior = crate::redcode::assemble_with_rules(source, "Edit", self.rules)?;
        let [instruction] = warrior.code.as_slice() else {
            return Err("Enter exactly one Redcode instruction".into());
        };
        self.write_edit(address, *instruction);
        Ok(())
    }

    pub fn write_edit(&mut self, address: usize, [instruction, a, b]: [u16; 3]) {
        self.core[address] = Cell { instruction, a, b };
        self.opcodes[address] = (instruction & 31) as u8;
        // Manual changes have no warrior attribution.
        self.owners[address] = None;
        #[cfg(feature = "gpu")]
        {
            self.sources[address] = None;
        }
        self.last_writes[address] = None;
        self.activity[address] = 0;
    }
    pub fn find_next(&self, after: usize, query: &str) -> Result<Option<usize>, String> {
        let size = self.rules.core_size;
        let query = query.trim().to_ascii_uppercase();
        let opcode = OPS
            .iter()
            .position(|&op| op == if query == "CMP" { "SEQ" } else { &query });
        let field = query
            .parse::<i64>()
            .ok()
            .map(|n| n.rem_euclid(size as i64) as u16);
        if opcode.is_none() && field.is_none() {
            return Err("Enter an opcode or an integer field value".into());
        }
        Ok((1..=size)
            .map(|offset| (after + offset) % size)
            .find(|&addr| {
                let cell = self.core[addr];
                opcode == Some((cell.instruction & 31) as usize)
                    || field.is_some_and(|value| cell.a == value || cell.b == value)
            }))
    }
    pub fn outcome(&self) -> String {
        let alive: Vec<_> = self
            .warriors
            .iter()
            .enumerate()
            .filter(|(i, _)| self.processes(*i) > 0)
            .collect();
        match alive.as_slice() {
            [] => "No surviving processes".into(),
            [(_, w)] if self.warriors.len() == 1 => format!("{} survived", w.name),
            [(_, w)] => format!("{} wins", w.name),
            _ => "Tie".into(),
        }
    }

    pub fn instruction(&self, address: usize) -> String {
        self.format_instruction(self.encoded_cell(address))
    }

    pub fn encoded_cell(&self, address: usize) -> [u16; 3] {
        let Cell { instruction, a, b } = self.core[address];
        [instruction, a, b]
    }

    pub fn format_instruction(&self, [w, a, b]: [u16; 3]) -> String {
        let size = self.rules.core_size;
        let mode = |shift: u16| MODES.as_bytes()[usize::from((w >> shift) & 7u16)] as char;
        let signed = |v: u16| {
            if v > size as u16 / 2 {
                i32::from(v) - size as i32
            } else {
                i32::from(v)
            }
        };
        let opcode = OPS[(w & 31) as usize];
        let (opcode, dot, modifier) = if self.rules.icws88 {
            (if opcode == "SEQ" { "CMP" } else { opcode }, "", "")
        } else {
            (opcode, ".", MODS[((w >> 5) & 7) as usize])
        };
        format!(
            "{opcode}{dot}{modifier} {}{}, {}{}",
            mode(8),
            signed(a),
            mode(11),
            signed(b)
        )
    }
}
