import { OP, MOD, MODE, OPCODES, MODIFIERS, MODES, pSpaceSizeFor } from './constants.js';
import { appendWarrior } from './gpu/packing.js';
import { formatInstruction } from './disassembly.js';
import { makeGeometry } from './geometry.js';
import { HISTORY_ACTOR, HISTORY_BATCH, HISTORY_CYCLE, HISTORY_NONE, HISTORY_PC, HISTORY_PSPACE,
  HISTORY_SUCCESSORS, HISTORY_WORDS, HISTORY_WRITE_WORDS } from './rust-history-layout.js';
import { lossSymptom } from './report.js';

const attachedHistory = new WeakMap();
const historyObservers = new WeakMap();

export function observeRustHistory(vm, observe) {
  historyObservers.set(vm, observe);
}

export function detachRustHistory(vm) {
  attachedHistory.get(vm)?.detach();
}

export function hasRustHistory(vm) {
  return attachedHistory.has(vm);
}

export function advanceRustHistory(vm, limit) {
  const history = attachedHistory.get(vm);
  const steps = history.run(limit, !vm.traceSize);
  return { steps, lastStep: history.lastStep };
}

// Apply Rust's changes at the execution point of a VM step. This also works
// with a retained log after its original Rust instance has gone away.
export function rustHistoryExecutor(vm) {
  let log, entry;
  const geometry = vm.geo;
  const formatWrite = () => {
    const word = log[entry + 1];
    return formatInstruction({ op: OPCODES[word & 31], mod: MODIFIERS[(word >>> 5) & 7],
      aMode: MODES[(word >>> 8) & 7], bMode: MODES[(word >>> 11) & 7],
      a: log[entry + 2], b: log[entry + 3] }, vm.size, geometry);
  };
  return (records, at, warrior, pc, processes) => {
    log = records;
    if (vm.lastExec) vm.lastExec[pc] = vm.steps;
    const writeEnd = at + 1 + HISTORY_WRITE_WORDS * log[at];
    for (entry = at + 1; entry < writeEnd; entry += HISTORY_WRITE_WORDS) {
      const addr = log[entry];
      const instruction = log[entry + 4];
      vm.op[addr] = instruction & 31;
      vm.mod[addr] = (instruction >>> 5) & 7;
      vm.aMode[addr] = (instruction >>> 8) & 7;
      vm.bMode[addr] = (instruction >>> 11) & 7;
      vm.a[addr] = log[entry + 5];
      vm.b[addr] = log[entry + 6];
      vm.touch(addr, warrior, formatWrite);
    }
    const pspaceIndex = log[at + HISTORY_PSPACE];
    if (pspaceIndex !== HISTORY_NONE) vm.warriors[warrior].pspace[pspaceIndex] = log[at + HISTORY_PSPACE + 1];
    const successor = at + HISTORY_SUCCESSORS;
    for (let i = successor; i < successor + 2; i++) {
      const process = log[i];
      if (process === HISTORY_NONE) break;
      if (geometry) processes.h = Math.floor(process / vm.size);
      processes.push(geometry ? process % vm.size : process);
    }
    return log[successor] === HISTORY_NONE;
  };
}

const { DAT, MOV, ADD, SUB, MUL, DIV, MOD: MODULO, JMP, JMZ, JMN, DJN, SPL, SLT, SEQ, SNE, NOP } = OP;
const { A, B, AB, BA, F, X, I } = MOD;
const empty = DAT | (F << 5) | (MODE.DIRECT << 8) | (MODE.DIRECT << 11);

function wrapSum(sum, size) {
  return sum >= size ? sum - size : sum;
}

function decrement(value, size) {
  return value === 0 ? size - 1 : value - 1;
}

function address(core, size, pc, field, mode) {
  if (mode === MODE.IMMEDIATE) return pc;
  const pointer = wrapSum(pc + field, size);
  if (mode === MODE.DIRECT) return pointer;
  const slot = pointer * 3 + 1 + (mode & 1);
  let offset = core[slot];
  if (mode === MODE.A_PREDEC || mode === MODE.B_PREDEC) {
    offset = decrement(offset, size);
    core[slot] = offset;
  }
  return wrapSum(pointer + offset, size);
}

function postIncrement(core, size, pc, field, mode) {
  const slot = wrapSum(pc + field, size) * 3 + 1 + (mode & 1);
  core[slot] = wrapSum(core[slot] + 1, size);
}

function calculate(op, destination, source, size) {
  switch (op) {
    case ADD: return wrapSum(destination + source, size);
    case SUB: return destination >= source ? destination - source : destination + size - source;
    case MUL: return (destination * source) % size;
    case DIV: return source ? Math.floor(destination / source) : -1;
    case MODULO: return source ? destination % source : -1;
  }
}

// Packed ICWS'94 rounds with optional loss diagnosis from the Wasm kernel.
// Keep the queue and packed core between rounds.
// Return null when the general VM is needed for the settings or programs.
export function createRingDuel(settings, warriors, createKernel, { diagnose = false, history = false } = {}) {
  const { coreSize, maxProcesses: processLimit, maxCycles } = settings;
  const count = warriors.length;
  const topology = settings.topology || 'ring';
  if (count === 0 || (count !== 2 && (!createKernel || diagnose)) || !['ring', 'torus'].includes(topology)) return null;
  const geometry = makeGeometry(settings);
  const wide = geometry || coreSize > 65536 || (createKernel && count >= coreSize);
  if (wide && !createKernel) return null;
  if (!createKernel && (settings.pSpace !== false || diagnose)) return null;
  // A torus queue word stores a cell index and one of six headings.
  if (!Number.isInteger(coreSize) || coreSize < 1 || coreSize > (geometry ? Math.floor(0x100000000 / 6) : 0x7fffffff)) return null;
  if (geometry && ![geometry.X, geometry.Y, geometry.Z].every(Number.isSafeInteger)) return null;
  if (!Number.isSafeInteger(processLimit) || processLimit < 1) return null;
  if (!Number.isInteger(maxCycles) || maxCycles < 1 || !Number.isSafeInteger(count * maxCycles)) return null;

  // Each instruction can add at most one process and the budget only shrinks.
  const maxProcesses = Math.min(processLimit, count * maxCycles + 1);
  const players = [];
  let needsPspace = history;
  let executesPspace = false;
  for (const warrior of warriors) {
    const packed = [0, 0, 0];
    try {
      appendWarrior(packed, 0, warrior, settings, geometry);
    } catch {
      return null;
    }
    const cells = (wide ? Uint32Array : Uint16Array).from(packed.slice(packed[0]));
    for (let i = 0; i < cells.length; i += 3) {
      const op = cells[i] & 31;
      if (op === OP.TRN && !createKernel) return null;
      if (op === OP.LDP || op === OP.STP) {
        // Rule restrictions apply during assembly. An already compiled
        // program executes under the same VM semantics as in JavaScript.
        if (!createKernel) return null;
        needsPspace = true;
        executesPspace = true;
      }
    }
    players.push({ cells, start: packed[2] });
  }
  const fieldLimit = needsPspace ? Math.max(coreSize, count + 1) : coreSize;
  const configuredPspace = needsPspace ? pSpaceSizeFor(settings) : 0;
  if (needsPspace && (!Number.isSafeInteger(configuredPspace) || configuredPspace < 1)) return null;
  // Redcode indexes P-space with a core field or the previous survivor count.
  const pspaceSize = Math.min(configuredPspace, fieldLimit);
  const kernel = createKernel?.({ ...settings, maxProcesses }, { diagnose, history, pspaceSize, count, geometry });
  if (createKernel && !kernel) return null;
  const core = kernel?.core ?? new Uint16Array(3 * coreSize);
  // Keep the standard ring reset fast. On wide cores, clear in place to
  // avoid reserving a second full battlefield just for its empty state.
  const emptyCore = wide ? null : core.slice();
  if (emptyCore) for (let i = 0; i < emptyCore.length; i += 3) emptyCore[i] = empty;
  const queue = kernel?.queue ?? new Uint16Array(2 * maxProcesses);
  const heads = kernel?.heads ?? new Uint32Array(2);
  const tails = kernel?.tails ?? new Uint32Array(2);
  const sizes = kernel?.sizes ?? new Uint32Array(2);
  const owners = kernel?.owners;
  const budget = 2 * maxCycles;
  let generation = 0;
  const offsetAddress = geometry ? geometry.add : (a, b) => wrapSum(a + b, coreSize);
  const east = geometry ? geometry.encode(1, 0, 0) : 1;
  const normalize = position => ((position % coreSize) + coreSize) % coreSize;

  function load(positions, firstTurn) {
    if (kernel && (positions.length !== count || positions.some(p => !Number.isSafeInteger(p))
      || !Number.isInteger(firstTurn) || firstTurn < 0 || firstTurn >= count)) throw new Error('Invalid positions or first mover for Rust battle');
    generation++;
    if (emptyCore) core.set(emptyCore);
    else {
      core.fill(0);
      for (let i = 0; i < core.length; i += 3) core[i] = empty;
    }
    owners?.fill(0);
    for (let side = 0; side < count; side++) {
      const { cells, start } = players[side];
      const base = positions[side];
      let at = geometry ? normalize(geometry.add(base, 0)) : normalize(base);
      for (let i = 0; i < cells.length; i += 3) {
        const cell = at * 3;
        core[cell] = cells[i];
        core[cell + 1] = cells[i + 1];
        core[cell + 2] = cells[i + 2];
        if (owners) owners[at] = side + 1;
        at = offsetAddress(at, east);
      }
      queue[side * maxProcesses] = geometry
        ? normalize(geometry.add(base, start)) : offsetAddress(normalize(base), start);
      heads[side] = 0;
      tails[side] = maxProcesses === 1 ? 0 : 1;
      sizes[side] = 1;
    }
  }

  function startRound(positions, firstTurn) {
    if (!kernel) throw new Error('Slicing requires a Rust match');
    load(positions, firstTurn);
    kernel.startGroup(firstTurn);
    const { roundState } = kernel;
    const loaded = generation;
    const finishedPositions = [...positions];
    function checkActive() {
      if (loaded !== generation) throw new Error('This round has been replaced');
    }
    function finish() {
      checkActive();
      if (!roundState[4]) throw new Error('The round is still running');
      const survivors = [];
      const diedAt = Array.from(sizes, (size, side) => {
        if (!size) return kernel.diedAt(side);
        survivors.push(side);
        return null;
      });
      const winner = count > 1 && survivors.length === 1 ? survivors[0] : null;
      return { winner, cycles: kernel.cycle, positions: [...finishedPositions], firstTurn, survivors, diedAt,
        ...(diagnose ? { diagnostic: winner === null ? 'tie'
          : lossSymptom(kernel.diagnostics[0], kernel.diagnostics[1], diedAt[1 - winner]) } : {}) };
    }
    return {
      get cycle() { checkActive(); return kernel.cycle; },
      get turn() { checkActive(); return roundState[1]; },
      get budget() { checkActive(); return kernel.budget; },
      get aliveCount() { checkActive(); return roundState[3]; },
      get done() { checkActive(); return !!roundState[4]; },
      get steps() { checkActive(); return kernel.steps; },
      step() {
        checkActive();
        if (!kernel.advanceGroup(1)) return null;
        return { warrior: roundState[6], pc: roundState[7], killed: !!roundState[8] };
      },
      run(maxSteps = Infinity) {
        checkActive();
        if (!(maxSteps > 0)) return 0;
        let steps = 0;
        while (!roundState[4] && steps < maxSteps) {
          const advanced = kernel.advanceGroup(Math.min(0x7fffffff, Math.ceil(maxSteps - steps)));
          if (advanced === 0) throw new Error('Rust stopped before the round finished');
          steps += advanced;
        }
        return steps;
      },
      finish,
    };
  }

  function round(positions, firstTurn) {
    if (count !== 2 || wide || (kernel && budget > 0x80000000)) {
      const active = startRound(positions, firstTurn);
      active.run();
      return active.finish();
    }
    load(positions, firstTurn);
    const steps = kernel ? kernel.run(firstTurn) : run(firstTurn);
    if (steps === null) return { winner: null, cycles: maxCycles, positions, firstTurn, survivors: [0, 1], diedAt: [null, null],
      ...(diagnose ? { diagnostic: 'tie' } : {}) };
    const turn = (steps + firstTurn) % 2;
    const diedAt = [null, null];
    diedAt[turn] = Math.floor((steps + firstTurn) / 2);
    const winner = 1 - turn;
    return { winner, cycles: Math.floor((steps + firstTurn + 1) / 2), positions, firstTurn, survivors: [winner], diedAt,
      ...(diagnose ? { diagnostic: lossSymptom(kernel.diagnostics[0], kernel.diagnostics[1], diedAt[turn]) } : {}) };
  }

  // Replay each batch through VM.step for ownership, traces and diagnostics.
  // The log keeps the value at each write so intermediate states stay visible.
  function attachHistory(vm) {
    if (!kernel?.historyLog || diagnose) return false;
    // A live GPU session may hand back a partially progressed VM.
    const supportsPspace = ps => ps.length === configuredPspace
      && !ps.subarray(0, pspaceSize).some(value => value < 0 || value >= fieldLimit);
    if (vm.warriors.some(w => w.queue.size > maxProcesses
      || (pspaceSize && !supportsPspace(w.pspace)))) return false;
    for (let p = 0; p < coreSize; p++) {
      const op = vm.op[p];
      if ((!pspaceSize && (op === OP.LDP || op === OP.STP))
        || vm.a[p] < 0 || vm.a[p] >= fieldLimit || vm.b[p] < 0 || vm.b[p] >= fieldLimit) return false;
      if (op === OP.LDP || op === OP.STP) executesPspace = true;
      core[3 * p] = op | (vm.mod[p] << 5) | (vm.aMode[p] << 8) | (vm.bMode[p] << 11);
      core[3 * p + 1] = vm.a[p];
      core[3 * p + 2] = vm.b[p];
    }
    vm.warriors.forEach((w, side) => {
      for (let i = 0; i < w.queue.size; i++) {
        const slot = wrapSum(w.queue.head + i, w.queue.buf.length);
        queue[side * maxProcesses + i] = w.queue.buf[slot] + (geometry ? w.queue.heads[slot] * coreSize : 0);
      }
      heads[side] = 0;
      sizes[side] = w.queue.size;
      tails[side] = wrapSum(sizes[side], maxProcesses);
    });
    kernel.startGroup(vm.turn, vm);
    const { historyLog, pspace } = kernel;
    detachRustHistory(vm);
    const { poke, execute, clear, run: runVM } = vm;
    let replayAt = -1;
    let lastStep;
    const applyRecord = rustHistoryExecutor(vm);
    const observe = historyObservers.get(vm);
    const detach = () => {
      vm.poke = poke;
      vm.execute = execute;
      vm.clear = clear;
      vm.run = runVM;
      attachedHistory.delete(vm);
    };
    attachedHistory.set(vm, { detach, run: runHistory, get lastStep() { return lastStep; } });
    vm.clear = () => {
      detach();
      clear.call(vm);
    };
    vm.poke = (addr, instruction, owner) => {
      poke.call(vm, addr, instruction, owner);
      const p = vm.norm(addr);
      if (vm.op[p] === OP.LDP || vm.op[p] === OP.STP) {
        if (!pspaceSize) { detach(); return; }
        executesPspace = true;
      }
      core[3 * p] = vm.op[p] | (vm.mod[p] << 5) | (vm.aMode[p] << 8) | (vm.bMode[p] << 11);
      core[3 * p + 1] = vm.a[p];
      core[3 * p + 2] = vm.b[p];
    };
    const syncPspace = () => {
      if (!executesPspace) return true;
      for (let side = 0; side < count; side++) {
        const { pspace: privateSpace } = vm.warriors[side];
        if (!supportsPspace(privateSpace)) { detach(); return false; }
        pspace.set(privateSpace.subarray(0, pspaceSize), side * pspaceSize);
      }
      return true;
    };
    vm.execute = (warrior, pc, processes) => {
      const single = replayAt < 0;
      if (single) {
        const op = vm.op[pc];
        if ((op === OP.LDP || op === OP.STP) && !syncPspace()) return execute.call(vm, warrior, pc, processes);
        kernel.advanceGroup(1, true);
        observe?.(vm.steps - 1, historyLog, 1);
      }
      return applyRecord(historyLog, single ? 0 : replayAt, warrior, pc, processes);
    };
    // Rust supplies the scheduler state for live frames. Only forensic data
    // and writes need to be applied in instruction order.
    function applyLiveBatch(advanced) {
      const { owner, writerPc, writeCycle } = vm;
      const cycleBase = vm.cycle - (vm.cycle >>> 0);
      const firstLow = vm.cycle >>> 0;
      for (let at = 0; at < advanced * HISTORY_WORDS; at += HISTORY_WORDS) {
        const w = historyLog[at + HISTORY_ACTOR];
        const warrior = vm.warriors[w], processes = warrior.queue;
        const encoded = historyLog[at + HISTORY_PC];
        const pc = geometry ? encoded % coreSize : encoded;
        const low = historyLog[at + HISTORY_CYCLE];
        vm.cycle = cycleBase + low + (low < firstLow ? 0x100000000 : 0);
        vm.steps++;
        vm.curPc = pc;
        vm.curH = processes.lastH = processes.h = geometry ? Math.floor(encoded / coreSize) : 0;
        processes.head = wrapSum(processes.head + 1, processes.buf.length);
        processes.size--;
        const killed = historyLog[at + HISTORY_SUCCESSORS] === HISTORY_NONE;
        let codeOwner, writer, writtenAt;
        if (owner) {
          codeOwner = owner[pc];
          if (codeOwner >= 0 && codeOwner !== w) {
            warrior.foreignSteps++;
            if (!warrior.foreignFirst) warrior.foreignFirst = {
              cycle: vm.cycle, pc, owner: codeOwner, instruction: vm.disassemble(pc),
            };
          }
          if (killed) { writer = writerPc[pc]; writtenAt = writeCycle[pc]; }
        }
        applyRecord(historyLog, at, w, pc, processes);
        if (killed && owner) vm.recordDeath(warrior, pc, codeOwner, writer, writtenAt);
        if (processes.size > warrior.peak) warrior.peak = processes.size;
        if (processes.size === 0) { warrior.alive = false; warrior.diedAt = vm.cycle; }
      }
      const state = kernel.roundState;
      vm.cycle = kernel.cycle;
      vm.turn = state[1];
      vm.budget = kernel.budget;
      vm.aliveCount = state[3];
      vm.done = !!state[4];
      vm.winner = vm.done && count > 1 && vm.aliveCount === 1 ? vm.warriors.findIndex(w => w.alive) : null;
      lastStep = { warrior: state[6], pc: state[7], killed: !!state[8] };
    }
    function runHistory(maxSteps = Infinity, live = false) {
      let steps = 0;
      while (!vm.done && steps < maxSteps) {
        if (!syncPspace()) {
          while (!vm.done && steps < maxSteps) { lastStep = vm.step(); steps++; }
          break;
        }
        let advanced;
        try {
          advanced = kernel.advanceGroup(Math.min(HISTORY_BATCH, Math.ceil(maxSteps - steps)), true);
          if (advanced < 1) throw new Error('Rust history made no progress');
          observe?.(vm.steps, historyLog, advanced);
          if (live) applyLiveBatch(advanced);
          else {
            for (replayAt = 0; replayAt < advanced * HISTORY_WORDS; replayAt += HISTORY_WORDS) {
              lastStep = vm.step();
            }
          }
        } catch (error) {
          detach();
          throw error;
        } finally {
          replayAt = -1;
        }
        steps += advanced;
      }
      return steps;
    }
    vm.run = maxSteps => runHistory(maxSteps);
    return true;
  }

  function run(firstTurn) {
    let turn = firstTurn;
    for (let steps = 0; steps < budget; steps++) {
      const base = turn * maxProcesses;
      const head = heads[turn];
      const pc = queue[base + head];
      heads[turn] = wrapSum(head + 1, maxProcesses);
      let size = sizes[turn] - 1;
      const offset = pc * 3;
      const instruction = core[offset];
      const op = instruction & 31;
      const mod = (instruction >>> 5) & 7;
      const aMode = (instruction >>> 8) & 7;
      const bMode = (instruction >>> 11) & 7;
      const aField = core[offset + 1];
      const bField = core[offset + 2];

      const aAddress = address(core, coreSize, pc, aField, aMode);
      const aOffset = aAddress * 3;
      const aInstruction = core[aOffset];
      const aA = core[aOffset + 1];
      const aB = core[aOffset + 2];
      if (aMode >= MODE.A_POSTINC) postIncrement(core, coreSize, pc, aField, aMode);
      const bOffset = address(core, coreSize, pc, bField, bMode) * 3;
      const bA = core[bOffset + 1];
      const bB = core[bOffset + 2];
      if (bMode >= MODE.A_POSTINC) postIncrement(core, coreSize, pc, bField, bMode);

      let next = wrapSum(pc + 1, coreSize);
      let child = -1;
      let killed = false;
      switch (op) {
        case DAT:
          killed = true;
          break;
        case MOV:
          switch (mod) {
            case A: core[bOffset + 1] = aA; break;
            case B: core[bOffset + 2] = aB; break;
            case AB: core[bOffset + 2] = aA; break;
            case BA: core[bOffset + 1] = aB; break;
            case X: core[bOffset + 1] = aB; core[bOffset + 2] = aA; break;
            case I: core[bOffset] = aInstruction;
              // Whole-instruction copies also copy the two fields.
            case F: core[bOffset + 1] = aA; core[bOffset + 2] = aB; break;
          }
          break;
        case ADD:
        case SUB:
        case MUL:
        case DIV:
        case MODULO:
          if (mod !== B && mod !== AB) {
            const value = calculate(op, bA, mod === BA || mod === X ? aB : aA, coreSize);
            if (value < 0) killed = true;
            else core[bOffset + 1] = value;
          }
          if (mod !== A && mod !== BA) {
            const value = calculate(op, bB, mod === AB || mod === X ? aA : aB, coreSize);
            if (value < 0) killed = true;
            else core[bOffset + 2] = value;
          }
          break;
        case JMP:
          next = aAddress;
          break;
        case JMZ:
        case JMN: {
          const zero = mod === A || mod === BA ? bA === 0 : mod === B || mod === AB ? bB === 0 : bA === 0 && bB === 0;
          if (op === JMZ ? zero : !zero) next = aAddress;
          break;
        }
        case DJN: {
          let jump = false;
          if (mod !== B && mod !== AB) {
            core[bOffset + 1] = decrement(core[bOffset + 1], coreSize);
            jump = bA !== 1;
          }
          if (mod !== A && mod !== BA) {
            core[bOffset + 2] = decrement(core[bOffset + 2], coreSize);
            jump ||= bB !== 1;
          }
          if (jump) next = aAddress;
          break;
        }
        case SPL:
          child = aAddress;
          break;
        case SEQ:
        case SNE:
        case SLT: {
          let compare;
          if (op === SLT) {
            switch (mod) {
              case A: compare = aA < bA; break;
              case B: compare = aB < bB; break;
              case AB: compare = aA < bB; break;
              case BA: compare = aB < bA; break;
              case X: compare = aA < bB && aB < bA; break;
              default: compare = aA < bA && aB < bB;
            }
          } else {
            switch (mod) {
              case A: compare = aA === bA; break;
              case B: compare = aB === bB; break;
              case AB: compare = aA === bB; break;
              case BA: compare = aB === bA; break;
              case X: compare = aA === bB && aB === bA; break;
              default: compare = aA === bA && aB === bB && (mod !== I || aInstruction === core[bOffset]);
            }
            if (op === SNE) compare = !compare;
          }
          if (compare) next = wrapSum(next + 1, coreSize);
          break;
        }
        case NOP:
          break;
      }

      if (!killed) {
        let tail = tails[turn];
        queue[base + tail] = next;
        tail = wrapSum(tail + 1, maxProcesses);
        size++;
        if (child >= 0 && size < maxProcesses) {
          queue[base + tail] = child;
          tail = wrapSum(tail + 1, maxProcesses);
          size++;
        }
        tails[turn] = tail;
      }
      sizes[turn] = size;
      if (size === 0) return steps;
      turn = 1 - turn;
    }
    return null;
  }

  function processes(side) {
    return Array.from({ length: sizes[side] }, (_, i) => {
      const process = queue[side * maxProcesses + wrapSum(heads[side] + i, maxProcesses)];
      return geometry ? process % coreSize : process;
    });
  }

  return { round, startRound, attachHistory: kernel ? attachHistory : undefined, core, processes };
}
