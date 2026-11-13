// The lockstep papers of the 94nop top 30 (tools/algebra/blocks/hill-papers.js):
// loop-paper6, stream-paper3 and backcopy-paper. Each builds and passes the gate
// alone and as a fan-boot member, does what it promises in the core, and is
// refused where it cannot work.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, treeMismatches, shape } from '../tools/algebra/index.js';
import { compile, VM } from '../src/engine/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';

const PAPERS = ['loop-paper6', 'stream-paper3', 'backcopy-paper'];
const s94 = recipeSettings('94nop', 100);
const ok = (rules, tree, length = 100) => {
  const built = buildTree(tree, { rules, length });
  assert.equal(built.verification.ok, true, `${rules} ${shape(tree)}`);
  return built;
};
const member = (id, P = {}) => ({ id, P: { FAN: 0, ...(id === 'stream-paper3' ? { TAIL: 0 } : {}), ...P } });
const fb = (a, b, P = {}) => ({ id: 'fanboot', P: { N: 6, K: 2, ...P }, kids: [a, b] });
const behindScan = (body, UNITS) => ({ id: 'seq', kids: [{ id: 'opening-qscan-mul', P: { UNITS, SHARE: 1 } }, { id: 'probe-burst2' }, body] });

test('every paper passes the gate alone with its defaults on 94nop and 94x, for 6 and 8 processes', () => {
  for (const id of PAPERS) {
    for (const rules of ['94nop', '94x']) ok(rules, { id });
    ok('94nop', { id, P: { PROCS: 8 } });
  }
  ok('94nop', { id: 'stream-paper3', P: { TAIL: 0 } });
  // The bodies are as short as they claim (FAN 1 adds three fan lines).
  assert.equal(ok('94nop', { id: 'loop-paper6' }).total, 9);
  assert.equal(ok('94nop', { id: 'stream-paper3', P: { TAIL: 0 } }).total, 8);
  assert.equal(ok('94nop', { id: 'backcopy-paper' }).total, 9);
});

test('each is a fan-boot member beside hill-stone, behind a quickscan and burst, in 50 instructions', () => {
  for (const id of PAPERS) {
    const built = ok('94nop', behindScan(fb({ id: 'hill-stone', P: { PROCS: 1 } }, member(id)), 2), 50);
    assert.ok(built.total <= 50, `${id}: ${built.total}`);
    // The bare body: six cells (five for the stream paper), one copy line in the fan.
    const paper = built.root.kids[2].kids[1];
    assert.equal(built.spans[paper.ns].size, id === 'stream-paper3' ? 5 : 6, id);
  }
});

test('they combine in other ways too: an 8-fan, par, and the 55,440 core', () => {
  ok('94nop', fb({ id: 'mod-stone' }, member('stream-paper3', { PROCS: 8 }), { N: 8 }));
  ok('94nop', fb({ id: 'mod-stone' }, member('backcopy-paper', { PROCS: 8 }), { N: 8, K: 1 }));
  ok('94nop', { id: 'par', kids: [{ id: 'mod-stone' }, { id: 'loop-paper6' }] });
  ok('94nop', { id: 'par', kids: [{ id: 'stream-paper3' }, { id: 'backcopy-paper' }] });
  ok('94x', fb({ id: 'mod-stone' }, member('loop-paper6'), { HOPA: 20000, HOPB: 40000 }));
});

// Runs a built tree alone and returns the VM once `cycles` have passed.
function run(tree, cycles) {
  const built = buildTree(tree, { rules: '94nop', length: 100 });
  const vm = new VM(s94); vm.load([compile(built.source, 'redcode', s94)], { positions: [0] });
  while (vm.cycle < cycles) vm.step();
  return { vm, at: (l) => built.labels[built.root.ns + l] };
}
const empty = (x) => x.op === 'DAT' && x.a === 0 && x.b === 0;

test('loop-paper6: one lap puts a whole copy STEP away with six processes in it and six bombs behind the pointer', () => {
  // The fan, then the SPL and copy lines by 6 processes, interleaved with their children.
  const { vm, at } = run({ id: 'loop-paper6' }, 5 + 6 + 12), go = at('lpGo'), copy = go + 2008;
  for (let k = 1; k < 6; k++) assert.deepEqual({ ...vm.peek(copy + k) }, { ...vm.peek(go + k) }, `cell ${k}`);
  assert.equal(vm.peek(copy).op, 'SPL');
  assert.equal(vm.processes(0).filter((q) => q >= copy && q < copy + 6).length, 6);
  // The first bomb lands on the pointer cell, the rest run on from where its B-field then points.
  for (let i = 0; i < 300 && vm.peek(go + 3000).b !== 5334 + 5; i++) vm.step();     // the lap's six bombs
  const ptr = vm.peek(go + 3000);
  assert.deepEqual([ptr.op, ptr.a, ptr.b], ['DAT', 2667, 5334 + 5]);
  for (let i = 0; i < 5; i++) { const d = vm.peek((go + 3000 + 5334 + i) % 8000); assert.deepEqual([d.op, d.a, d.b], ['DAT', 2667, 5334], `bomb ${i}`); }
});

test('stream-paper3: a lap copies the body and leaves twelve rewritten empty cells behind it, both pointers back where they were', () => {
  const tree = { id: 'stream-paper3' };
  const built = buildTree(tree, { rules: '94nop', length: 100 }), go = built.labels[built.root.ns + 'spGo'];
  const vm = new VM(s94); vm.load([compile(built.source, 'redcode', s94)], { positions: [0] });
  // Dirt where the copy's tail will be: the second and third streams must erase it.
  for (let k = 6; k < 18; k++) vm.poke(go + 1367 + k, { op: 'JMP', mod: 'B', aMode: '$', a: 1, bMode: '$', b: 1 });
  // A full lap of the six original processes: 5 lines each, interleaved with their children's turns.
  let lapEnd = null;
  while (vm.cycle < 400 && lapEnd === null) { vm.step(); if (vm.peek(go).a === 1367 + 18 && vm.peek(go).b === 0 && vm.peek(go + 5).b === 0) lapEnd = vm.cycle; }
  assert.ok(lapEnd !== null, 'the lap never ended with its pointers restored');
  const copy = go + 1367;
  for (let k = 1; k < 5; k++) assert.deepEqual({ ...vm.peek(copy + k) }, { ...vm.peek(go + k) }, `cell ${k}`);
  for (let k = 6; k < 18; k++) assert.ok(empty(vm.peek(copy + k)), `cell ${k} behind the copy`);
  assert.equal(vm.peek(go).a, 1367 + 18);          // the next copy lands 3 * PROCS further on
});

test('backcopy-paper: copies downward, starts the copy only when whole, and lays a DAT row under it', () => {
  const tree = { id: 'backcopy-paper' };
  const built = buildTree(tree, { rules: '94nop', length: 100 }), go = built.labels[built.root.ns + 'bcGo'];
  const vm = new VM(s94); vm.load([compile(built.source, 'redcode', s94)], { positions: [0] });
  const copy = (go - 1009 + 8000) % 8000, order = [];
  let startedWhole = null;
  while (vm.cycle < 200) {
    const pc = vm.processes(0)[0];
    vm.step();
    for (let k = 0; k < 6; k++) if (vm.writeCycle[copy + k] === vm.cycle - 1 && !order.includes(k)) order.push(k);
    if (startedWhole === null && pc >= copy && pc < copy + 6) startedWhole = order.length === 6;
  }
  assert.deepEqual(order, [5, 4, 3, 2, 1, 0]);      // top cell first
  assert.equal(startedWhole, true);
  for (const k of [0, 1, 3, 5]) assert.deepEqual({ ...vm.peek(copy + k) }, { ...vm.peek(go + k) }, `cell ${k}`);
  for (let k = 1; k <= 6; k++) { const d = vm.peek(copy - k); assert.deepEqual([d.op, d.a, d.b], ['DAT', 2667, 5334], `row cell ${k}`); }
  // The second lap's copy sits directly below that row.
  for (const k of [0, 1, 3, 5]) assert.deepEqual({ ...vm.peek(copy - 12 + k) }, { ...vm.peek(go + k) }, `second copy, cell ${k}`);
});

test('settings that cannot work are refused', () => {
  const has = (rules, tree, re) => {
    const m = treeMismatches(tree, recipeSettings(rules, 100));
    assert.ok(m.some((x) => re.test(x)), JSON.stringify(m));
  };
  for (const id of PAPERS) {
    has('88', { id }, /needs ICWS'94/);
    has('lp', { id }, /room to grow/);
    has('94nop', { id, P: { PROCS: 7 } }, /PROCS must be 6 or 8/);
  }
  has('94nop', { id: 'loop-paper6', P: { STEP: 2000 } }, /STEP mod 16/);
  has('94nop', { id: 'loop-paper6', P: { PROCS: 8, STEP: 2010 } }, /STEP mod 16/);
  has('94nop', { id: 'loop-paper6', P: { BPTR: 2000 } }, /run of bombs/);
  has('94nop', { id: 'loop-paper6', P: { DELTA: 250 } }, /whole number of cores/);
  has('94nop', { id: 'stream-paper3', P: { STEP: 8000 - 18 * 4 } }, /copies onto the paper/);
  has('94nop', { id: 'backcopy-paper', P: { STEP: 8000 - 12 * 5 } }, /copies onto the paper/);
});

test('the linker and the gate refuse a paper in the wrong place', () => {
  // TAIL 0 keeps a pointer in the next cell: refused unless the paper is last in the image.
  assert.throws(() => buildTree(fb(member('stream-paper3'), { id: 'mod-stone' }), { rules: '94nop', length: 100 }), /TAIL 0 keeps its tail pointer/);
  // A bare body needs its PROCS processes delivered together.
  for (const id of PAPERS) {
    assert.throws(() => buildTree(member(id), { rules: '94nop', length: 100 }), /1 process entered together/, id);
    assert.throws(() => buildTree(fb({ id: 'mod-stone' }, member(id), { N: 8 }), { rules: '94nop', length: 100 }), /8 processes entered together/, id);
  }
});
