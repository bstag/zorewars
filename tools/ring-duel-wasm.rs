// The packed Redcode interpreter. The JS host prepares the core and the two
// process queues in linear memory, then calls run once per round.

#[repr(C)]
#[derive(Clone, Copy)]
struct Cell<W> {
    instruction: W,
    a: W,
    b: W,
}

#[cfg(zorewars_native)]
#[path = "ring-duel-node.rs"]
mod node;

// Keep the shared record layout in sync with rust-history-layout.js.
const HISTORY_BATCH: u32 = 128;
const HISTORY_WORDS: usize = 29;
const HISTORY_WRITE_WORDS: usize = 7;
const HISTORY_SUCCESSORS: usize = 22;
const HISTORY_PSPACE: usize = 24;
const HISTORY_ACTOR: usize = 26;
const HISTORY_PC: usize = 27;
const HISTORY_CYCLE: usize = 28;
const HISTORY_NONE: u32 = u32::MAX;
const ROUND_STATE_WORDS: usize = 25;

#[no_mangle]
extern "C" fn history_version() -> i32 {
    2
}

trait Word: Copy + Into<u32> {
    fn from_word(value: u32) -> Self;
}

impl Word for u16 {
    fn from_word(value: u32) -> Self {
        value as u16
    }
}

impl Word for u32 {
    fn from_word(value: u32) -> Self {
        value
    }
}

#[derive(Clone, Copy)]
struct Torus([i64; 3]);

impl Torus {
    #[inline]
    fn decode(self, value: u32) -> [i64; 3] {
        let mut carry = i64::from(value);
        self.0.map(|size| {
            let digit = (carry + size / 2) % size - size / 2;
            carry = (carry - digit) / size;
            digit
        })
    }

    #[inline]
    fn encode(self, point: [i64; 3]) -> u32 {
        let [x, y, z] = std::array::from_fn(|i| {
            let size = self.0[i];
            (point[i] + size / 2).rem_euclid(size) - size / 2
        });
        (x + self.0[0] * (y + self.0[1] * z)).rem_euclid(self.0.iter().product()) as u32
    }

    #[inline]
    fn add(self, a: u32, b: u32) -> u32 {
        let a = self.decode(a);
        let b = self.decode(b);
        self.encode(std::array::from_fn(|i| a[i] + b[i]))
    }

    fn heading(self, from: u32, target: u32, current: u32) -> u32 {
        let from = self.decode(from);
        let target = self.decode(target);
        let delta = self.decode(self.encode(std::array::from_fn(|i| target[i] - from[i])));
        let axis = (0..3).max_by_key(|&i| (delta[i].abs(), 2 - i)).unwrap();
        if delta[axis] == 0 {
            current
        } else {
            2 * axis as u32 + u32::from(delta[axis] < 0)
        }
    }
}

const DAT: u16 = 0;
const MOV: u16 = 1;
const ADD: u16 = 2;
const SUB: u16 = 3;
const MUL: u16 = 4;
const DIV: u16 = 5;
const MOD: u16 = 6;
const JMP: u16 = 7;
const JMZ: u16 = 8;
const JMN: u16 = 9;
const DJN: u16 = 10;
const SPL: u16 = 11;
const SLT: u16 = 12;
const SEQ: u16 = 13;
const SNE: u16 = 14;
const LDP: u16 = 16;
const STP: u16 = 17;
const TRN: u16 = 18;

const A: u16 = 0;
const B: u16 = 1;
const AB: u16 = 2;
const BA: u16 = 3;
const X: u16 = 5;
const I: u16 = 6;

#[inline(always)]
fn wrap(sum: u32, size: u32) -> u32 {
    if sum >= size {
        sum - size
    } else {
        sum
    }
}

#[inline(always)]
fn offset_address(a: u32, b: u32, size: u32, torus: Option<Torus>) -> u32 {
    torus.map_or_else(
        || {
            let sum = a + b;
            // P-space can write the survivor count directly into a field.
            if sum < size * 2 {
                wrap(sum, size)
            } else {
                sum % size
            }
        },
        |geo| geo.add(a, b),
    )
}

// Native callers pass JS-owned buffers. Check values that can become indices
// as they are read, without scanning the whole core before each live step.
#[inline(always)]
fn checked_cell<W: Word>(cell: Cell<W>, limit: u32) -> bool {
    cell.a.into() < limit && cell.b.into() < limit
}

#[inline(always)]
fn decrement<W: Word>(value: u32, size: u32) -> u32 {
    if value == 0 {
        size - 1
    } else if std::mem::size_of::<W>() == 2 {
        value - 1
    } else {
        (value - 1) % size
    }
}

#[inline(always)]
unsafe fn operand<W: Word, const DIAGNOSE: bool, const HISTORY: bool>(
    core: *mut Cell<W>,
    size: u32,
    pc: u32,
    field: u32,
    torus: Option<Torus>,
    mode: u16,
    owners: *mut u8,
    side: u8,
    writes: *mut u32,
    field_limit: u32,
) -> Option<(u32, Cell<W>)> {
    if mode == 0 {
        return Some((pc, *core.add(pc as usize)));
    }
    let pointer = offset_address(pc, field, size, torus);
    let cell = core.add(pointer as usize);
    if mode == 1 {
        return Some((pointer, *cell));
    }
    let field = if mode & 1 == 0 {
        &raw mut (*cell).a
    } else {
        &raw mut (*cell).b
    };
    let mut offset = (*field).into();
    if cfg!(zorewars_native) && offset >= field_limit {
        return None;
    }
    if mode == 4 || mode == 5 {
        offset = decrement::<W>(offset, size);
        *field = W::from_word(offset);
        if DIAGNOSE {
            *owners.add(pointer as usize) = side;
        }
        if HISTORY {
            record_write(writes, pointer, *cell, *core.add(pc as usize));
        }
    }
    let address = offset_address(pointer, offset, size, torus);
    let value = *core.add(address as usize);
    if mode >= 6 {
        *field = W::from_word(increment::<W>(offset, size));
        if DIAGNOSE {
            *owners.add(pointer as usize) = side;
        }
        if HISTORY {
            record_write(writes, pointer, *cell, *core.add(pc as usize));
        }
    }
    Some((address, value))
}

#[inline(always)]
fn increment<W: Word>(value: u32, size: u32) -> u32 {
    if std::mem::size_of::<W>() == 2 {
        wrap(value + 1, size)
    } else {
        (value + 1) % size
    }
}

// An instruction can modify two operand pointers and one destination.
#[inline(always)]
unsafe fn record_write<W: Word>(writes: *mut u32, addr: u32, value: Cell<W>, executing: Cell<W>) {
    let entry = writes.add(1 + *writes as usize * HISTORY_WRITE_WORDS);
    *entry = addr;
    *entry.add(1) = executing.instruction.into();
    *entry.add(2) = executing.a.into();
    *entry.add(3) = executing.b.into();
    *entry.add(4) = value.instruction.into();
    *entry.add(5) = value.a.into();
    *entry.add(6) = value.b.into();
    *writes += 1;
}

#[inline(always)]
fn calculate<W: Word>(
    op: u16,
    dest: u32,
    source: u32,
    size: u32,
    torus: Option<Torus>,
) -> Option<u32> {
    if let Some(torus) = torus {
        if source % size == 0 && (op == DIV || op == MOD) {
            return None;
        }
        let dest = torus.decode(dest);
        let source = torus.decode(source);
        return Some(torus.encode(std::array::from_fn(|i| {
            let p = dest[i].rem_euclid(torus.0[i]);
            let q = source[i].rem_euclid(torus.0[i]);
            match op {
                ADD => p + q,
                SUB => p - q,
                MUL => p * q,
                DIV if q != 0 => p / q,
                MOD if q != 0 => p % q,
                _ => p,
            }
        })));
    }
    let value = match op {
        ADD if std::mem::size_of::<W>() == 2 => wrap(dest + source, size),
        ADD => (dest + source) % size,
        SUB if std::mem::size_of::<W>() == 2 => wrap(dest + size - source, size),
        SUB => ((i64::from(dest) + i64::from(size) - i64::from(source)) % i64::from(size)) as u32,
        MUL if std::mem::size_of::<W>() == 2 => (dest * source) % size,
        MUL => ((f64::from(dest) * f64::from(source)) % f64::from(size)) as u32,
        DIV if source != 0 => dest / source,
        MOD if source != 0 => dest % source,
        _ => return None,
    };
    Some(value)
}

// The host supplies disjoint, aligned buffers. Core fields and queue entries
// are always below core_size, and queue indices are below max_processes.
#[no_mangle]
unsafe extern "C" fn run(
    core: *mut Cell<u16>,
    queue: *mut u16,
    queues: *mut u32,
    core_size: u32,
    max_processes: u32,
    budget: u32,
    first_turn: usize,
    pspace: *mut u16,
    pspace_size: usize,
) -> i32 {
    execute::<u16, false, false, false>(
        core,
        queue,
        queues,
        core_size,
        max_processes,
        budget,
        first_turn,
        std::ptr::null_mut(),
        std::ptr::null_mut(),
        pspace,
        pspace_size,
        2,
        std::ptr::null_mut(),
        std::ptr::null_mut(),
        0,
        None,
    )
}

#[no_mangle]
unsafe extern "C" fn run_diagnosed(
    core: *mut Cell<u16>,
    queue: *mut u16,
    queues: *mut u32,
    core_size: u32,
    max_processes: u32,
    budget: u32,
    first_turn: usize,
    owners: *mut u8,
    diagnostics: *mut u32, // Two words: enemy DAT death and foreign steps for the eliminated side.
    pspace: *mut u16,
    pspace_size: usize,
) -> i32 {
    execute::<u16, true, false, false>(
        core,
        queue,
        queues,
        core_size,
        max_processes,
        budget,
        first_turn,
        owners,
        diagnostics,
        pspace,
        pspace_size,
        2,
        std::ptr::null_mut(),
        std::ptr::null_mut(),
        0,
        None,
    )
}

// State holds cycle, turn, remaining budget, live count, done, total steps,
// and the warrior, PC and death flag from the most recent instruction.
// The high words of the remaining budget, cycle and step counters are at
// offsets 22–24. History records, when requested, follow the round state.
#[no_mangle]
unsafe extern "C" fn advance_group(
    core: *mut Cell<u16>,
    queue: *mut u16,
    queues: *mut u32,
    core_size: u32,
    max_processes: u32,
    pspace: *mut u16,
    pspace_size: usize,
    count: usize,
    died_at: *mut u32,
    state: *mut u32,
    max_steps: u32,
    history: u32,
    owners: *mut u8,
    diagnostics: *mut u32,
) -> u32 {
    let advance = if history != 0 {
        execute::<u16, false, true, true>
    } else if !diagnostics.is_null() {
        execute::<u16, true, true, false>
    } else {
        execute::<u16, false, true, false>
    };
    advance(
        core,
        queue,
        queues,
        core_size,
        max_processes,
        *state.add(2),
        *state.add(1) as usize,
        owners,
        diagnostics,
        pspace,
        pspace_size,
        count,
        died_at,
        state,
        if history != 0 {
            max_steps.min(HISTORY_BATCH)
        } else {
            max_steps
        },
        None,
    ) as u32
}

#[no_mangle]
unsafe extern "C" fn advance_torus(
    core: *mut Cell<u32>,
    queue: *mut u32,
    queues: *mut u32,
    core_size: u32,
    max_processes: u32,
    pspace: *mut u32,
    pspace_size: usize,
    count: usize,
    died_at: *mut u32,
    state: *mut u32,
    max_steps: u32,
    history: u32,
    x: u32,
    y: u32,
    z: u32,
    owners: *mut u8,
    diagnostics: *mut u32,
) -> u32 {
    let advance = if history != 0 {
        execute::<u32, false, true, true>
    } else if !diagnostics.is_null() {
        execute::<u32, true, true, false>
    } else {
        execute::<u32, false, true, false>
    };
    advance(
        core,
        queue,
        queues,
        core_size,
        max_processes,
        *state.add(2),
        *state.add(1) as usize,
        owners,
        diagnostics,
        pspace,
        pspace_size,
        count,
        died_at,
        state,
        if history != 0 {
            max_steps.min(HISTORY_BATCH)
        } else {
            max_steps
        },
        (x != 0).then_some(Torus([i64::from(x), i64::from(y), i64::from(z)])),
    ) as u32
}

#[inline(always)]
unsafe fn execute<W: Word, const DIAGNOSE: bool, const GROUP: bool, const HISTORY: bool>(
    core: *mut Cell<W>,
    queue: *mut W,
    queues: *mut u32,
    core_size: u32,
    max_processes: u32,
    budget: u32,
    first_turn: usize,
    owners: *mut u8,
    diagnostics: *mut u32,
    pspace: *mut W,
    pspace_size: usize,
    count: usize,
    died_at: *mut u32,
    state: *mut u32,
    max_steps: u32,
    torus: Option<Torus>,
) -> i32 {
    let heads = queues;
    let tails = queues.add(count);
    let sizes = tails.add(count);
    let field_limit = if pspace_size != 0 && count >= core_size as usize {
        count as u32 + 1
    } else {
        core_size
    };
    let mut turn = first_turn;
    let mut foreign_steps = [0u32; 2];
    if GROUP && DIAGNOSE {
        foreign_steps = [*diagnostics.add(2), *diagnostics.add(3)];
    }
    let mut remaining = if GROUP {
        (u64::from(*state.add(22)) << 32) | u64::from(budget)
    } else {
        u64::from(budget)
    };
    let mut alive = if GROUP { *state.add(3) as usize } else { count };
    let mut cycle = if GROUP {
        (u64::from(*state.add(23)) << 32) | u64::from(*state)
    } else {
        0
    };
    let mut done = GROUP && *state.add(4) != 0;
    let mut step = 0u32;
    while remaining > 0 && (!GROUP || (!done && step < max_steps)) {
        let queue = queue.add(turn * max_processes as usize);
        let head = *heads.add(turn);
        if cfg!(zorewars_native)
            && (head >= max_processes
                || *tails.add(turn) >= max_processes
                || *sizes.add(turn) == 0
                || *sizes.add(turn) > max_processes)
        {
            return i32::MIN;
        }
        let process = (*queue.add(head as usize)).into();
        let (pc, mut heading) = if torus.is_some() {
            (process % core_size, process / core_size)
        } else {
            (process, 0)
        };
        if cfg!(zorewars_native) && (pc >= core_size || heading >= 6) {
            return i32::MIN;
        }
        *heads.add(turn) = wrap(head + 1, max_processes);
        let mut size = *sizes.add(turn) - 1;

        let Cell { instruction, a, b } = *core.add(pc as usize);
        if cfg!(zorewars_native) && !checked_cell(Cell { instruction, a, b }, field_limit) {
            return i32::MIN;
        }
        let instruction = instruction.into() as u16;
        let op = instruction & 31;
        let modifier = (instruction >> 5) & 7;
        let side = turn as u8 + 1;
        let enemy_code = DIAGNOSE && *owners.add(pc as usize) == (1 - turn) as u8 + 1;
        if DIAGNOSE {
            // The diagnostic classifier only distinguishes counts above 100.
            foreign_steps[turn] = (foreign_steps[turn] + u32::from(enemy_code)).min(101);
        }
        let writes = if HISTORY {
            state.add(ROUND_STATE_WORDS + step as usize * HISTORY_WORDS)
        } else {
            std::ptr::null_mut()
        };
        if HISTORY {
            *writes = 0;
            *writes.add(HISTORY_SUCCESSORS) = HISTORY_NONE;
            *writes.add(HISTORY_SUCCESSORS + 1) = HISTORY_NONE;
            *writes.add(HISTORY_PSPACE) = HISTORY_NONE;
            *writes.add(HISTORY_ACTOR) = turn as u32;
            *writes.add(HISTORY_PC) = process;
            *writes.add(HISTORY_CYCLE) = cycle as u32;
        }
        let Some((a_address, source)) = operand::<W, DIAGNOSE, HISTORY>(
            core,
            core_size,
            pc,
            a.into(),
            torus,
            (instruction >> 8) & 7,
            owners,
            side,
            writes,
            field_limit,
        ) else {
            return i32::MIN;
        };
        let Some((b_address, dest)) = operand::<W, DIAGNOSE, HISTORY>(
            core,
            core_size,
            pc,
            b.into(),
            torus,
            (instruction >> 11) & 7,
            owners,
            side,
            writes,
            field_limit,
        ) else {
            return i32::MIN;
        };
        if cfg!(zorewars_native)
            && (!checked_cell(source, field_limit) || !checked_cell(dest, field_limit))
        {
            return i32::MIN;
        }
        let target = core.add(b_address as usize);
        let (source_a, source_b) = (source.a.into(), source.b.into());
        let (dest_a, dest_b) = (dest.a.into(), dest.b.into());

        let heading_offset = |heading| {
            let mut direction = [0; 3];
            direction[(heading / 2) as usize] = if heading % 2 == 0 { 1 } else { -1 };
            torus.map_or(1, |geo| geo.encode(direction))
        };
        let mut next = offset_address(pc, heading_offset(heading), core_size, torus);
        let mut killed = false;
        match op {
            DAT => killed = true,
            MOV => match modifier {
                A => (*target).a = source.a,
                B => (*target).b = source.b,
                AB => (*target).b = source.a,
                BA => (*target).a = source.b,
                X => {
                    (*target).a = source.b;
                    (*target).b = source.a;
                }
                I => *target = source,
                _ => {
                    (*target).a = source.a;
                    (*target).b = source.b;
                }
            },
            ADD | SUB | MUL | DIV | MOD => {
                if modifier != B && modifier != AB {
                    let field = if modifier == BA || modifier == X {
                        source_b
                    } else {
                        source_a
                    };
                    if let Some(value) = calculate::<W>(op, dest_a, field, core_size, torus) {
                        (*target).a = W::from_word(value);
                    } else {
                        killed = true;
                    }
                }
                if modifier != A && modifier != BA {
                    let field = if modifier == AB || modifier == X {
                        source_a
                    } else {
                        source_b
                    };
                    if let Some(value) = calculate::<W>(op, dest_b, field, core_size, torus) {
                        (*target).b = W::from_word(value);
                    } else {
                        killed = true;
                    }
                }
            }
            JMP => next = a_address,
            JMZ | JMN => {
                let zero = match modifier {
                    A | BA => dest_a == 0,
                    B | AB => dest_b == 0,
                    _ => dest_a == 0 && dest_b == 0,
                };
                if (op == JMZ) == zero {
                    next = a_address;
                }
            }
            DJN => {
                let mut jump = false;
                if modifier != B && modifier != AB {
                    (*target).a = W::from_word(decrement::<W>((*target).a.into(), core_size));
                    jump = decrement::<W>(dest_a, core_size) != 0;
                }
                if modifier != A && modifier != BA {
                    (*target).b = W::from_word(decrement::<W>((*target).b.into(), core_size));
                    jump |= decrement::<W>(dest_b, core_size) != 0;
                }
                if jump {
                    next = a_address;
                }
            }
            SLT | SEQ | SNE => {
                let skip = if op == SLT {
                    match modifier {
                        A => source_a < dest_a,
                        B => source_b < dest_b,
                        AB => source_a < dest_b,
                        BA => source_b < dest_a,
                        X => source_a < dest_b && source_b < dest_a,
                        _ => source_a < dest_a && source_b < dest_b,
                    }
                } else {
                    let equal = match modifier {
                        A => source_a == dest_a,
                        B => source_b == dest_b,
                        AB => source_a == dest_b,
                        BA => source_b == dest_a,
                        X => source_a == dest_b && source_b == dest_a,
                        _ => {
                            source_a == dest_a
                                && source_b == dest_b
                                && (modifier != I
                                    || source.instruction.into() == dest.instruction.into())
                        }
                    };
                    (op == SEQ) == equal
                };
                if skip {
                    next = offset_address(next, heading_offset(heading), core_size, torus);
                }
            }
            LDP if pspace_size != 0 => {
                let index = if modifier == A || modifier == AB {
                    source_a
                } else {
                    source_b
                };
                let at = turn * pspace_size + index as usize % pspace_size;
                let value = (*pspace.add(at)).into();
                if modifier == A || modifier == BA {
                    (*target).a = W::from_word(value);
                } else {
                    (*target).b = W::from_word(value);
                }
            }
            STP if pspace_size != 0 => {
                let value = if modifier == A || modifier == AB {
                    source_a
                } else {
                    source_b
                };
                let index = if modifier == A || modifier == BA {
                    dest_a
                } else {
                    dest_b
                };
                let at = turn * pspace_size + index as usize % pspace_size;
                *pspace.add(at) = W::from_word(value);
                if HISTORY {
                    *writes.add(HISTORY_PSPACE) = (at % pspace_size) as u32;
                    *writes.add(HISTORY_PSPACE + 1) = value;
                }
            }
            TRN => {
                if let Some(geo) = torus {
                    heading = geo.heading(pc, a_address, heading);
                    next = geo.add(pc, heading_offset(heading));
                }
            }
            _ => {}
        }
        if DIAGNOSE && matches!(op, MOV | ADD | SUB | MUL | DIV | MOD | DJN | LDP) {
            *owners.add(b_address as usize) = side;
        }
        if HISTORY && matches!(op, MOV | ADD | SUB | MUL | DIV | MOD | DJN | LDP) {
            record_write(writes, b_address, *target, *core.add(pc as usize));
        }

        if !killed {
            let mut tail = *tails.add(turn);
            let encoded_next = next + heading * core_size;
            *queue.add(tail as usize) = W::from_word(encoded_next);
            if HISTORY {
                *writes.add(HISTORY_SUCCESSORS) = encoded_next;
            }
            tail = wrap(tail + 1, max_processes);
            size += 1;
            if op == SPL && size < max_processes {
                let child = a_address + heading * core_size;
                *queue.add(tail as usize) = W::from_word(child);
                if HISTORY {
                    *writes.add(HISTORY_SUCCESSORS + 1) = child;
                }
                tail = wrap(tail + 1, max_processes);
                size += 1;
            }
            *tails.add(turn) = tail;
        }
        *sizes.add(turn) = size;
        if GROUP {
            *state.add(6) = turn as u32;
            *state.add(7) = pc;
            *state.add(8) = u32::from(killed);
            // Match VM.step's budget rescaling and cycle boundary rules.
            if size == 0 {
                if DIAGNOSE {
                    *diagnostics = u32::from(op == DAT && enemy_code);
                    *diagnostics.add(1) = foreign_steps[turn];
                }
                *died_at.add(2 * turn) = cycle as u32;
                *died_at.add(2 * turn + 1) = (cycle >> 32) as u32;
                if alive >= 2 {
                    remaining -= 1 + (remaining - 1) / alive as u64;
                }
                alive -= 1;
            }
            let mut next = turn;
            if count == 2 {
                next ^= 1;
            } else if alive != 0 {
                for _ in 0..count {
                    next = (next + 1) % count;
                    if *sizes.add(next) != 0 {
                        break;
                    }
                }
            }
            cycle += u64::from(next <= turn);
            turn = next;
            done = alive <= usize::from(count > 1) || remaining <= 1;
            remaining = remaining.wrapping_sub(1);
            step += 1;
            continue;
        } else if size == 0 {
            if pspace_size != 0 {
                *pspace.add(turn * pspace_size) = W::from_word(0);
                *pspace.add((turn ^ 1) * pspace_size) = W::from_word(1);
            }
            if DIAGNOSE {
                *diagnostics = u32::from(op == DAT && enemy_code);
                *diagnostics.add(1) = foreign_steps[turn];
            }
            return step as i32;
        }
        turn ^= 1;
        step += 1;
        remaining -= 1;
    }
    if GROUP {
        if DIAGNOSE {
            *diagnostics.add(2) = foreign_steps[0];
            *diagnostics.add(3) = foreign_steps[1];
        }
        *state = cycle as u32;
        *state.add(23) = (cycle >> 32) as u32;
        *state.add(1) = turn as u32;
        *state.add(2) = remaining as u32;
        *state.add(22) = (remaining >> 32) as u32;
        *state.add(3) = alive as u32;
        *state.add(4) = u32::from(done);
        let (steps, carry) = (*state.add(5)).overflowing_add(step);
        *state.add(5) = steps;
        *state.add(24) += u32::from(carry);
        if !HISTORY && done && step != 0 && pspace_size != 0 {
            for side in 0..count {
                *pspace.add(side * pspace_size) = W::from_word(if *sizes.add(side) == 0 {
                    0
                } else {
                    alive as u32
                });
            }
        }
        return step as i32;
    }
    if pspace_size != 0 {
        *pspace = W::from_word(2);
        *pspace.add(pspace_size) = W::from_word(2);
    }
    -1
}
