import assert from 'node:assert/strict';
import test from 'node:test';
import { VM } from '../src/engine/index.js';
import { buildTree } from '../tools/algebra/index.js';

const hill = { rules: 'lp-hill', length: 200 };
const step = (P = {}) => ({ id: 'lp-step-paper', P });
const wide = { STEP: 2880, WRITE: 2400 }, wideStream = { STRIDE: 2880, FIRST: 2400 };
const daub = { id: 'par', kids: [
  { id: 'par', kids: [step(wide), { id: 'lp-stream-paper', P: wideStream }] },
  { id: 'par', kids: [{ id: 'stone', P: { TSTEP: 160 } }, { id: 'stone', P: { TSTEP: 96 } }] },
  { id: 'lp-imp-quad' },
] };

test('the imp quad starts exactly 2^K imps on its spiral, in order, with no adders', () => {
  for (const rules of ['lp', 'lp-hill']) {
    assert.equal(buildTree({ id: 'lp-imp-quad' }, { rules, verification: 'full' }).total, 9);
    assert.equal(buildTree({ id: 'lp-imp-quad', P: { N: 7, K: 3 } }, { rules }).total, 14);
  }
  const built = buildTree({ id: 'lp-imp-quad' }, { rules: 'lp' });
  const vm = new VM(built.settings);
  vm.load([built.w], { positions: [0] });
  const imp = 8, starts = [];
  for (let i = 0; i < 40; i++) {
    const pc = vm.processes(0)[0];
    if (vm.peek(pc).op === 'MOV' && !starts.includes(pc)) starts.push(pc);
    vm.step();
    assert.ok(vm.processes(0).length <= 4);
  }
  assert.deepEqual(starts.slice(0, 4), [imp, imp + 2667, imp + 5334, imp + 1].map(x => x % 8000));
  while (!vm.done) vm.step();
  assert.equal(vm.processes(0).length, 4);
  assert.throws(() => buildTree({ id: 'lp-imp-quad', P: { N: 5 } }, { rules: 'lp' }), /no 5-point spiral/);
  assert.throws(() => buildTree({ id: 'lp-imp-quad', P: { N: 7, K: 2 } }, { rules: 'lp' }), /fewer imps than points/);
});

test('two papers, two stones and four imps fit the eight slots (DaubFusion shape, nested par)', () => {
  for (const rules of ['lp', 'lp-hill']) {
    const built = buildTree(daub, { rules, verification: 'full' });
    assert.equal(built.total, 36);
    assert.equal(built.verification.ok, true);
  }
  // The vector spiral needs a transient adder per imp, so four of its imps do not fit beside four others.
  const vector = { ...daub, kids: [...daub.kids.slice(0, 2), { id: 'vector-spiral', P: { N: 3, K: 2 } }] };
  assert.throws(() => buildTree(vector, { rules: 'lp' }), /more processes than this hill allows/);
});

test('padding and decoys behind a quickscan and a paper are dead to the paper, but not to a quickscan probe', () => {
  const qscan = { id: 'seq', kids: [{ id: 'opening-qscan-mul' }, step()] };
  assert.equal(buildTree({ id: 'image', kids: [qscan, { id: 'lp-padding', P: { COUNT: 150 } }] }, hill).total, 199);
  assert.equal(buildTree({ id: 'image', kids: [qscan, { id: 'decoys-mixed', P: { COUNT: 90 } }] }, hill).total, 139);
  const q45 = { id: 'seq', kids: [{ id: 'opening-qscan-mul45' }, step()] };
  assert.equal(buildTree(q45, { ...hill, verification: 'full' }).total, 57);
  assert.equal(buildTree({ id: 'image', kids: [q45, { id: 'lp-padding', P: { COUNT: 100 } }] }, hill).total, 157);
  // Its nearest probe is 169 cells on: a 197-cell image would be probed.
  assert.throws(() => buildTree({ id: 'image', kids: [q45, { id: 'lp-padding', P: { COUNT: 140 } }] }, hill), /probe lands on or next to the warrior/);
  // The opening's table cells (laid out before the code) are dead once it has handed on.
  assert.equal(buildTree({ id: 'seq', kids: [{ id: 'opening-qscan-mul45' }, { id: 'lp-stream-paper' }] }, hill).total, 58);
});
