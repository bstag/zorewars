use crate::arena::{Arena, Breakpoints, Stop};

const MIN_INTERVAL: u32 = 8192;

struct CellEdit {
    step: u32,
    address: usize,
    instruction: [u16; 3],
}

pub struct Timeline {
    snapshots: Vec<Arena>,
    latest_step: u32,
    latest_cycle: u32,
    interval: u32,
    edits: Vec<CellEdit>,
}

impl Timeline {
    pub fn new(arena: &Arena) -> Self {
        // Larger cores take more memory per snapshot.
        let budget = (40 * crate::arena::SIZE / arena.rules.core_size).clamp(8, 40) as u32;
        let steps = arena.rules.cycles * arena.warriors.len() as u32;
        Self {
            snapshots: vec![arena.clone()],
            latest_step: arena.steps(),
            latest_cycle: arena.cycle(),
            interval: MIN_INTERVAL.max(steps.div_ceil(budget)),
            edits: Vec::new(),
        }
    }

    pub fn latest_cycle(&self) -> u32 {
        self.latest_cycle
    }

    pub fn latest_step(&self) -> u32 {
        self.latest_step
    }
    pub fn first_step(&self) -> u32 {
        self.snapshots[0].steps()
    }
    pub fn first_cycle(&self) -> u32 {
        self.snapshots[0].cycle()
    }

    #[cfg(feature = "gpu")]
    pub fn record_edit(&mut self, arena: &Arena, address: usize) {
        let step = arena.steps();
        // Checkpoints describe the state after all edits at their instruction boundary.
        if let Some(checkpoint) = self
            .snapshots
            .last_mut()
            .filter(|snapshot| snapshot.steps() == step)
        {
            checkpoint.write_edit(address, arena.encoded_cell(address));
        }
        self.edits.push(CellEdit {
            step,
            address,
            instruction: arena.encoded_cell(address),
        });
    }

    fn run_until_edit(
        &self,
        arena: &mut Arena,
        count: u32,
        breaks: Option<&Breakpoints>,
    ) -> Option<Stop> {
        let before = arena.steps();
        let upcoming = &self.edits[self.edits.partition_point(|edit| edit.step <= before)..];
        let limit = upcoming
            .first()
            .map_or(count, |edit| count.min(edit.step - before));
        let stop = arena.run(limit, breaks);
        let after = arena.steps();
        for edit in upcoming.iter().take_while(|edit| edit.step == after) {
            arena.write_edit(edit.address, edit.instruction);
        }
        stop
    }

    pub fn advance(
        &mut self,
        arena: &mut Arena,
        mut count: u32,
        breaks: Option<&Breakpoints>,
    ) -> Option<Stop> {
        while count != 0 && !arena.done() {
            let before = arena.steps();
            let limit = count.min(self.interval - before % self.interval);
            let stop = self.run_until_edit(arena, limit, breaks);
            let after = arena.steps();
            if after > self.latest_step {
                self.latest_step = after;
                self.latest_cycle = arena.cycle();
                if after % self.interval == 0 {
                    self.snapshots.push(arena.clone());
                }
            }
            if stop.is_some() {
                return stop;
            }
            count -= after - before;
        }
        None
    }

    pub fn seek_step(&self, arena: &mut Arena, step: u32) {
        let target = step.clamp(self.first_step(), self.latest_step);
        let snapshot = self
            .snapshots
            .iter()
            .rfind(|s| s.steps() <= target)
            .unwrap();
        if target < arena.steps() || snapshot.steps() > arena.steps() {
            *arena = snapshot.clone();
        }
        while arena.steps() < target && !arena.done() {
            self.run_until_edit(arena, target - arena.steps(), None);
        }
    }

    pub fn seek_cycle(&self, arena: &mut Arena, cycle: u32) {
        if cycle >= self.latest_cycle {
            self.seek_step(arena, self.latest_step);
            return;
        }
        // A snapshot may sit partway through a cycle. Use a strictly earlier
        // one to land at the first instruction boundary of the target cycle.
        *arena = self
            .snapshots
            .iter()
            .rfind(|s| s.cycle() < cycle)
            .unwrap_or(&self.snapshots[0])
            .clone();
        while arena.cycle() < cycle {
            self.seek_step(arena, arena.steps() + cycle - arena.cycle());
        }
    }
}
