import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, gate, treeMismatches, treeSettings } from '../tools/algebra/index.js';
import { VM } from '../src/engine/index.js';

const id = 'marching-stone-boot';
const build = (tree = { id }) => buildTree(tree, { rules: 'tinylp', verification: 'full' });

test('the marching boot completes a wrapped copy before launch and keeps marching after cap', () => {
  const built = build();
  assert.equal(built.total, 9);
  assert.ok(built.verification.observations.every(({ peak }) => peak === 8));
  const vm = new VM(built.settings), base = 505;
  vm.load([built.w], { positions: [base] });
  const at = (label) => vm.norm(base + built.labels[`b0${label}`]);
  const copies = [];
  for (let step = 0; step < 4; step++) {
    vm.step();
    if (step < 3) {
      const target = vm.norm(799 + 2 - step);
      assert.equal(vm.lastWrite[target], vm.steps);
      copies.push(target);
    }
  }
  assert.deepEqual(copies, [1, 0, 799]);
  for (let i = 0; i < 3; i++) assert.deepEqual(vm.peek(799 + i), vm.peek(at('stone') + i));
  assert.deepEqual(vm.processes(0), [at('advance'), 799]);
  vm.step();
  vm.step();
  assert.equal(vm.writerPc[4], 799);
  assert.equal(vm.peek(4).op, 'DAT');

  // With MARCH 280 the 800-cell ring has 20 slots. Check a complete orbit,
  // including the first refresh and SPL at cap after returning to slot zero.
  let refreshed = false;
  for (let deployment = 1; deployment <= 20; deployment++) {
    while (vm.processes(0)[0] !== at('fire') && !vm.done) {
      const pc = vm.processes(0)[0];
      vm.step();
      if (deployment === 20 && pc === at('copyFirst')) {
        assert.equal(vm.writerPc[799], pc);
        assert.deepEqual(vm.peek(799), vm.peek(at('stone')));
        refreshed = true;
      }
    }
    assert.equal(vm.done, false);
    const site = vm.norm(799 + 280 * deployment);
    assert.equal(vm.norm(at('fire') + vm.peek(at('fire')).a), site);
    const before = vm.warriors[0].queue.size;
    vm.step();
    assert.equal(vm.warriors[0].queue.size, Math.min(8, before + 1));
  }
  assert.equal(vm.norm(at('fire') + vm.peek(at('fire')).a), 799);
  assert.equal(refreshed, true);
});

test('a short two-factor quickscan can hand on to the marching boot under Tiny LP', () => {
  const tree = {
    id: 'seq',
    kids: [
      { id: 'opening-qscan-qi', P: { UNITS: 4, FA: 53, FB: 137, TA: 2, TB: 3, SA: 5, SB: 7, RA: 11, RB: 13, STEP: 41 } },
      { id, P: { FIRST: 250, MARCH: 240 } },
    ],
  };
  const built = build(tree);
  assert.equal(built.total, 36);
  assert.ok(built.verification.observations.some(({ scenario }) => scenario === 'opening-qscan-qi: planted target'));
});

test('the marching boot rejects overlapping lattices and detects a damaged copy or march', () => {
  const settings = treeSettings('tinylp');
  assert.match(treeMismatches({ id, P: { AIM: 1 } }, settings).join(' '), /shot lattice hits/);
  assert.match(treeMismatches({ id, P: { MARCH: 800 } }, settings).join(' '), /visit more than one slot/);
  assert.throws(() => build({ id, P: { FIRST: 281 } }), /overlaps the linked image/);
  const built = build();
  const edit = (label, change) => {
    const index = built.labels[`b0${label}`];
    const instructions = built.w.instructions.map((ins, i) => i === index ? { ...ins, ...change } : ins);
    return { ...built, w: { ...built.w, instructions } };
  };
  assert.throws(() => gate(edit('copyMiddle', { op: 'NOP' })), /not written intact/);
  const advance = built.w.instructions[built.labels.b0advance];
  assert.throws(() => gate(edit('advance', { a: advance.a + 1 })), /not written intact/);
});
