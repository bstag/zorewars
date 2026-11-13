import { OP, MOD, MODE } from './constants.js';
import { appendWarrior } from './gpu/packing.js';

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

// Score-only ICWS'94 ring rounds. Keep the queue and packed core between rounds.
// Return null when the general VM is needed for the settings or programs.
export function createRingDuel(settings, warriors) {
  const { coreSize, maxProcesses, maxCycles } = settings;
  if (warriors.length !== 2 || (settings.topology || 'ring') !== 'ring' || settings.pSpace !== false) return null;
  if (!Number.isInteger(coreSize) || coreSize < 2 || coreSize > 65536) return null;
  if (!Number.isInteger(maxProcesses) || maxProcesses < 1 || maxProcesses > 0x7fffffff) return null;
  if (!Number.isInteger(maxCycles) || maxCycles < 1 || !Number.isSafeInteger(2 * maxCycles)) return null;

  const players = [];
  for (const warrior of warriors) {
    const packed = [0, 0, 0];
    try {
      appendWarrior(packed, 0, warrior, settings, null);
    } catch {
      return null;
    }
    const cells = Uint16Array.from(packed.slice(packed[0]));
    for (let i = 0; i < cells.length; i += 3) {
      // Callers can pass programs assembled under different rules.
      if ((cells[i] & 31) >= OP.LDP) return null;
    }
    players.push({ cells, start: packed[2] });
  }
  const core = new Uint16Array(3 * coreSize);
  const emptyCore = core.slice();
  for (let i = 0; i < emptyCore.length; i += 3) emptyCore[i] = empty;
  const queue = new Uint16Array(2 * maxProcesses);
  const heads = new Uint32Array(2);
  const tails = new Uint32Array(2);
  const sizes = new Uint32Array(2);
  const budget = 2 * maxCycles;

  function round(positions, firstTurn) {
    core.set(emptyCore);
    for (let side = 0; side < 2; side++) {
      const { cells, start } = players[side];
      let at = positions[side];
      for (let i = 0; i < cells.length; i += 3) {
        const cell = at * 3;
        core[cell] = cells[i];
        core[cell + 1] = cells[i + 1];
        core[cell + 2] = cells[i + 2];
        at = wrapSum(at + 1, coreSize);
      }
      queue[side * maxProcesses] = wrapSum(positions[side] + start, coreSize);
      heads[side] = 0;
      tails[side] = maxProcesses === 1 ? 0 : 1;
      sizes[side] = 1;
    }

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
      if (size === 0) {
        const diedAt = [null, null];
        diedAt[turn] = Math.floor((steps + firstTurn) / 2);
        const winner = 1 - turn;
        return { winner, cycles: Math.floor((steps + firstTurn + 1) / 2), positions, firstTurn, survivors: [winner], diedAt };
      }
      turn = 1 - turn;
    }
    return { winner: null, cycles: maxCycles, positions, firstTurn, survivors: [0, 1], diedAt: [null, null] };
  }

  function processes(side) {
    return Array.from({ length: sizes[side] }, (_, i) => queue[side * maxProcesses + wrapSum(heads[side] + i, maxProcesses)]);
  }

  return { round, core, processes };
}
