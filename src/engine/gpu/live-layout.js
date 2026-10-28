import { OPCODES, MODIFIERS, MODES, OP, MOD } from '../constants.js';
import { assemble } from '../assembler.js';

export const LIVE_STEPS = 4096;
const NONE = 0xffffffff;
const CAUSES = ['ownCode', 'enemyCode', 'emptyCore', 'divideByZero'];
export function liveLayout(vm) {
  const count = vm.warriors.length, core = 32 + count * 32;
  const queues = core + vm.size * 8, ps = queues + count * vm.settings.maxProcesses;
  const contacts = ps + count * vm.warriors[0].pspace.length;
  const events = contacts + count * count * 9;
  const eventCapacity = Math.max(1, (vm.eventLimit ?? 16384) / 4);
  return { count, core, queues, ps, contacts, events, eventCapacity, words: events + eventCapacity * 4 };
}
const header = (i) => OP[i.op] | MOD[i.mod] << 5 | MODES.indexOf(i.aMode) << 8 | MODES.indexOf(i.bMode) << 11;
function captured(text, vm) {
  const r = assemble(text, { ...vm.settings, dialect: undefined, pSpace: true, assertErrors: false });
  if (!r.ok) throw new Error('Cannot encode captured live instruction');
  const i = r.instructions[0]; return [header(i), vm.norm(i.a), vm.norm(i.b)];
}
function instruction(vm, h, a, b) {
  const signed = vm.geo ? vm.geo.format : (v) => v > vm.size / 2 ? v - vm.size : v;
  return `${OPCODES[h & 31]}.${MODIFIERS[(h >>> 5) & 7]} ${MODES[(h >>> 8) & 7]}${signed(a)}, ${MODES[(h >>> 11) & 7]}${signed(b)}`;
}

export function encodeLiveVM(vm, l = liveLayout(vm)) {
  const out = new Uint32Array(l.words), P = vm.settings.maxProcesses, PS = vm.warriors[0].pspace.length;
  out.set([vm.steps, vm.cycle, vm.turn, vm.budget, vm.aliveCount, +vm.done, vm.winner ?? NONE, vm.curPc, vm.curH]);
  out[9] = NONE; out[12] = vm.contacts.length;
  for (let p = 0; p < vm.size; p++) {
    const c = l.core + p * 8;
    out.set([vm.op[p] | vm.mod[p] << 5 | vm.aMode[p] << 8 | vm.bMode[p] << 11, vm.a[p], vm.b[p], vm.owner[p],
      Number.isFinite(vm.lastWrite[p]) ? vm.lastWrite[p] : NONE,
      Number.isFinite(vm.lastExec[p]) ? vm.lastExec[p] : NONE, vm.writerPc[p], vm.writeCycle[p]], c);
  }
  vm.warriors.forEach((w, side) => {
    const m = 32 + side * 32, q = w.queue;
    out.set([q.head, q.size, q.h, q.lastH, +w.alive, w.diedAt ?? NONE, w.peak, w.foreignSteps], m);
    out.set([w.deaths.total, ...CAUSES.map((k) => w.deaths[k])], m + 15);
    if (w.foreignFirst) {
      const f = w.foreignFirst;
      out.set([1, f.cycle, f.pc, f.owner, ...captured(f.instruction, vm)], m + 8);
    }
    if (w.lastDeath) {
      const d = w.lastDeath;
      out.set([1, d.cycle, d.step, d.pc, ...captured(d.instruction, vm), CAUSES.indexOf(d.cause), d.codeOwner, d.writerPc, d.writeCycle], m + 20);
    }
    for (let k = 0; k < P; k++) out[l.queues + side * P + k] = q.buf[k] + vm.size * q.heads[k];
    out.set(w.pspace, l.ps + side * PS);
  });
  vm.contacts.forEach((c, i) => {
    out.set([i + 1, c.cycle, c.step, c.addr, c.pc, ...captured(c.instruction, vm)], l.contacts + (c.attacker * l.count + c.victim) * 9);
  });
  return out;
}

// The existing VM is a stable renderer/inspector facade. Applying a complete
// snapshot is synchronous, so readers never observe half of a GPU update.
export function applyLiveVM(vm, raw, l = liveLayout(vm)) {
  if (raw.length !== l.words || raw[0] < vm.steps || raw[2] >= l.count) throw new Error('Invalid live GPU snapshot');
  const P = vm.settings.maxProcesses, PS = vm.warriors[0].pspace.length;
  for (let side = 0; side < l.count; side++) {
    const m = 32 + side * 32;
    if (raw[m] >= P || raw[m + 1] > P) throw new Error('Invalid live GPU queue');
  }
  vm.steps = raw[0]; vm.cycle = raw[1]; vm.turn = raw[2]; vm.budget = raw[3] | 0;
  vm.aliveCount = raw[4]; vm.done = !!raw[5]; vm.winner = raw[6] === NONE ? null : raw[6];
  vm.curPc = raw[7] | 0; vm.curH = raw[8];
  for (let p = 0; p < vm.size; p++) {
    const c = l.core + p * 8, h = raw[c];
    vm.op[p] = h & 31; vm.mod[p] = (h >>> 5) & 7; vm.aMode[p] = (h >>> 8) & 7; vm.bMode[p] = (h >>> 11) & 7;
    vm.a[p] = raw[c + 1]; vm.b[p] = raw[c + 2]; vm.owner[p] = raw[c + 3] | 0;
    vm.lastWrite[p] = raw[c + 4] === NONE ? -Infinity : raw[c + 4];
    vm.lastExec[p] = raw[c + 5] === NONE ? -Infinity : raw[c + 5];
    vm.writerPc[p] = raw[c + 6] | 0; vm.writeCycle[p] = raw[c + 7] | 0;
  }
  vm.warriors.forEach((w, side) => {
    const m = 32 + side * 32, q = w.queue;
    [q.head, q.size, q.h, q.lastH] = raw.subarray(m, m + 4);
    w.alive = !!raw[m + 4]; w.diedAt = raw[m + 5] === NONE ? null : raw[m + 5];
    w.peak = raw[m + 6]; w.foreignSteps = raw[m + 7];
    w.foreignFirst = raw[m + 8] ? { cycle: raw[m + 9], pc: raw[m + 10], owner: raw[m + 11], instruction: instruction(vm, ...raw.subarray(m + 12, m + 15)) } : null;
    w.deaths.total = raw[m + 15]; CAUSES.forEach((key, i) => { w.deaths[key] = raw[m + 16 + i]; });
    w.lastDeath = raw[m + 20] ? { cycle: raw[m + 21], step: raw[m + 22], pc: raw[m + 23],
      instruction: instruction(vm, ...raw.subarray(m + 24, m + 27)), cause: CAUSES[raw[m + 27]], codeOwner: raw[m + 28] | 0,
      writerPc: raw[m + 29] | 0, writeCycle: raw[m + 30] | 0 } : null;
    for (let k = 0; k < P; k++) { const v = raw[l.queues + side * P + k]; q.buf[k] = v % vm.size; q.heads[k] = Math.floor(v / vm.size); }
    w.pspace.set(raw.subarray(l.ps + side * PS, l.ps + (side + 1) * PS));
  });
  const contacts = [];
  vm.contactSeen.clear();
  for (let a = 0; a < l.count; a++) for (let b = 0; b < l.count; b++) {
    const p = l.contacts + (a * l.count + b) * 9;
    if (raw[p]) {
      contacts.push({ order: raw[p], attacker: a, victim: b, cycle: raw[p + 1], step: raw[p + 2], addr: raw[p + 3], pc: raw[p + 4], instruction: instruction(vm, ...raw.subarray(p + 5, p + 8)) });
      vm.contactSeen.add(a * 64 + b);
    }
  }
  vm.contacts = contacts.sort((a, b) => a.order - b.order).map(({ order, ...c }) => c);
  if (vm.events) for (let k = 0; k < raw[13] * 4; k++) vm.events.push(raw[l.events + k]);
  vm.eventsDropped = (vm.eventsDropped ?? 0) + raw[14];
  return raw[9] === NONE ? null : { warrior: raw[9], pc: raw[10], killed: !!raw[11] };
}
