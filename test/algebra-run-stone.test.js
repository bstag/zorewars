// run-stone (tools/algebra/blocks/run-stone.js): the multi-process stone that
// never switches itself off. It builds and passes the gate alone and as a fan
// boot's first member, keeps bombing to the end of a round without touching
// itself, and is refused where it cannot work.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, treeMismatches, shape } from '../tools/algebra/index.js';
import { compile, VM } from '../src/engine/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';

const s94 = recipeSettings('94nop', 100);
const ok = (rules, tree, length = 100) => {
  const built = buildTree(tree, { rules, length });
  assert.equal(built.verification.ok, true, `${rules} ${shape(tree)}`);
  return built;
};
const fb = (a, b, P = {}) => ({ id: 'fanboot', P: { N: 6, K: 2, HOPA: 6206, HOPB: 1000, ...P }, kids: [a, b] });

test('run-stone passes the gate alone on 94nop and 94x, in six cells', () => {
  assert.equal(ok('94nop', { id: 'run-stone' }).total, 6);
  ok('94x', { id: 'run-stone' });
  ok('94nop', { id: 'run-stone', P: { STEP: 123, FIRST: 400, LEAP: 3 } });
});

test('it is a fan boot\'s first member: beside a paper, behind a quickscan and burst, in 50 instructions', () => {
  const paper = { id: 'loop-paper6', P: { FAN: 0 } }, scan = (UNITS) => [{ id: 'opening-qscan-mul', P: { UNITS, SHARE: 1 } }, { id: 'probe-burst2' }];
  ok('94nop', fb({ id: 'run-stone' }, paper));
  ok('94nop', fb({ id: 'run-stone' }, { id: 'stream-paper3', P: { FAN: 0, TAIL: 0, PROCS: 8, STEP: 1512 } }, { N: 8 }));
  ok('94x', fb({ id: 'run-stone' }, paper, { HOPA: 20006, HOPB: 40000 }));
  ok('94nop', { id: 'boot', P: { HOP: 3000 }, kids: [{ id: 'run-stone' }] });
  const built = ok('94nop', { id: 'seq', kids: [...scan(3), fb({ id: 'run-stone' }, paper)] }, 50);
  assert.ok(built.total <= 50, `${built.total}`);
});

test('alone it bombs to the end of the round: both residue classes filled, its loop untouched, the feeder still feeding', () => {
  const built = buildTree({ id: 'run-stone' }, { rules: '94nop', length: 100 }), home = built.labels[built.root.ns + 'rsGo'];
  const w = compile(built.source, 'redcode', s94), vm = new VM(s94);
  vm.load([w], { positions: [0] });
  let last = 0;
  while (!vm.done && vm.cycle < s94.maxCycles) { vm.step(); }
  assert.equal(vm.warriors[0].alive, true);
  for (let c = 0; c < 8000; c++) if (vm.writeCycle[c] > last) last = vm.writeCycle[c];
  assert.ok(vm.cycle - last <= 8, `last write at ${last} of ${vm.cycle}`);
  // Every cell on residues 6 and 7 (mod 8) from the stone was written; nothing else was, but its own moving pointer.
  for (let c = 0; c < 8000; c++) {
    const r = (c - home + 8000) % 8, wrote = vm.writeCycle[c] > 0;
    if (c === home + 2) continue;
    assert.equal(wrote, r >= 6, `cell ${c} (residue ${r})`);
  }
  const m = (v) => ((v % 8000) + 8000) % 8000, ins = (x) => [x.op, x.mod, x.aMode, m(x.a), x.bMode, m(x.b)];
  for (const k of [0, 1, 3, 4, 5]) assert.deepEqual(ins(vm.peek(home + k)), ins(w.instructions[home + k]), `cell ${k}`);
  assert.ok(vm.processes(0).length > 100, `${vm.processes(0).length} processes`);
});

test('entrants a line apart, as a fan boot delivers them, write to different cells', () => {
  // 12 entrants in two groups of six, one instruction apart (fanboot N 6, K 2).
  const built = buildTree(fb({ id: 'run-stone' }, { id: 'loop-paper6', P: { FAN: 0 } }), { rules: '94nop', length: 100 });
  const stone = built.root.kids[0], home = built.labels[stone.ns + 'rsGo'] + 6206;
  const vm = new VM(s94); vm.load([compile(built.source, 'redcode', s94)], { positions: [0] });
  const hit = new Set();
  while (vm.cycle < 3000) {
    const pc = vm.processes(0)[0], mv = vm.peek(home + 2);
    const stoneThere = vm.peek(home).op === 'SPL' && vm.peek(home + 1).op === 'ADD' && vm.peek(home + 4).op === 'JMP';   // a paper copy may land on it later
    const t = !stoneThere ? null : pc === home + 3 ? (home + 2 + mv.a) % 8000 : pc === home + 2 ? (home + 2 + mv.b) % 8000 : null;
    vm.step();
    if (t !== null) hit.add(t);
  }
  // Not one cell per group of entrants: several hundred different cells in 3,000 cycles.
  assert.ok(hit.size > 400, `${hit.size} cells`);
  for (const t of hit) assert.ok((t - home + 8000) % 8 >= 6, `cell ${t}`);
});

test('a fan boot refuses a partner on the lattice the stone declares (residues 6 and 7 mod 8 from it)', () => {
  const paper = { id: 'loop-paper6', P: { FAN: 0 } }, build = (b, P) => buildTree(fb({ id: 'run-stone' }, b, P), { rules: '94nop', length: 100 });
  assert.equal(build(paper, { HOPB: 1000 }).verification.ok, true);            // the paper's copy starts a multiple of 8 from the stone's
  assert.equal(build(paper, { HOPB: 5008 }).verification.ok, true);
  for (const HOPB of [1001, 1002, 1005, 1007]) assert.throws(() => build(paper, { HOPB }), /run-stone writes on cell \d of loop-paper6's copy/, `HOPB ${HOPB}`);
  // A partner longer than six cells cannot avoid it anywhere.
  for (const HOPB of [1000, 1003, 1006]) assert.throws(() => build({ id: 'paper' }, { HOPB }), /run-stone writes on cell \d of paper's copy/);
});

test('settings that cannot work are refused', () => {
  const has = (rules, tree, re) => {
    const m = treeMismatches(tree, recipeSettings(rules, 100));
    assert.ok(m.some((x) => re.test(x)), JSON.stringify(m));
  };
  has('88', { id: 'run-stone' }, /needs ICWS'94/);
  has('lp', { id: 'run-stone' }, /never stops adding processes/);
  has('94nop', { id: 'run-stone', P: { STEP: 1000 } }, /whole number of cores/);
  has('94nop', { id: 'run-stone', P: { STEP: 500 } }, /reaches only 2 cells/);
  has('94nop', { id: 'run-stone', P: { STEP: 7000 } }, /STEP must be an integer/);
});
