import assert from 'node:assert/strict';
import test from 'node:test';
import { hillSettingsFor } from '../cli/devtools-context.js';
import { compile, VM } from '../src/engine/index.js';
import { buildTree, gate, recipes, treeSettings } from '../tools/algebra/index.js';
import { packedPlan } from '../tools/algebra/switch-table.js';

test('native hill profiles retain field limits when an entry budget is shortened', () => {
  for (const [rules, core, limit] of [['nano', 80, 5], ['tiny', 800, 20], ['tinylp', 800, 50]]) {
    const settings = treeSettings(rules, 4);
    const field = hillSettingsFor(settings);
    assert.equal(settings.coreSize, core);
    assert.equal(settings.maxLength, 4);
    assert.equal(field.maxLength, limit);
    assert.equal(field.pSpace, true);
    assert.equal(compile('MOV.I 0, 1\n'.repeat(limit + 1), 'redcode', field).ok, false);
  }
  assert.equal(buildTree({ id: 'stone' }, { rules: 'nano', verification: 'full' }).verification.observations[0].stoneCells, 20);
});

test('binary twin imp starts both trails and refuses an overlapping phase or insufficient queue', () => {
  const built = buildTree({ id: 'binary-twin-imp' }, { rules: 'icws64', verification: 'full' });
  assert.equal(built.total, 17);
  assert.equal(built.w.instructions[built.labels.b0imp].b, 2731);
  assert.ok(built.verification.observations.every(row => row.peak === 8));
  assert.ok(buildTree(recipes['twinned-stone'].tree(), { rules: 'icws64' }).verification.observations.every(row => row.peak === 9));
  assert.throws(() => buildTree({ id: 'binary-twin-imp', P: { PHASE: 2731 } }, { rules: 'icws64' }), /distinct cells/);
  assert.throws(() => buildTree(recipes['twinned-stone'].tree(), { rules: 'tinylp' }), /process/);

  const wrong = built.source.replace('b0imp+1365', 'b0imp+1367');
  const w = compile(wrong, 'redcode', built.settings);
  assert.ok(w.ok);
  assert.throws(() => gate({ ...built, w }), /unseeded cell/);
});

test('outcome table stores a state independently of the branch and checks all four states', () => {
  const tree = recipes['table-stones'].tree();
  const built = buildTree(tree, { rules: 'tinylp', verification: 'full' });
  assert.equal(built.verification.observations.length, 16);
  assert.equal(built.total, 39);
  const pspace = VM.freshPSpace(built.settings);
  const vm = new VM(built.settings);
  const launch = (result) => {
    pspace[0] = result;
    vm.load([built.w], { positions: [0], pspaces: [pspace] });
    for (let step = 0; step < 20; step++) {
      const pc = vm.processes(0)[0];
      if (pc === built.labels.b1tLoop || pc === built.labels.b2tLoop) return pc;
      vm.step();
    }
    throw new Error('The table never launched a payload');
  };
  assert.equal(launch(-1), built.labels.b1tLoop);
  assert.equal(launch(2), built.labels.b1tLoop);
  assert.equal(pspace[1], 1);
  assert.equal(launch(1), built.labels.b2tLoop);
  assert.equal(launch(0), built.labels.b1tLoop);
  assert.equal(pspace[1], 0);

  const changed = built.source.replace('STP.B @b0row, #1', 'STP.AB #3, #1');
  const w = compile(changed, 'redcode', built.settings);
  assert.ok(w.ok);
  assert.throws(() => gate({ ...built, w }), /wrong next state/);
  assert.throws(() => buildTree({ ...tree, P: { FIRST: 2 } }, { rules: 'tinylp' }), /missing payload/);
  assert.throws(() => buildTree({ ...tree, P: { CELL: 50 } }, { rules: 'tinylp' }), /exceed the P-space size/);
});

test('packed P-space agrees with the explicit table across persistent round histories', () => {
  const tree = recipes['table-stones'].tree();
  const P = { LOSS: 0xC840, WIN: 0x1D95, TIE: 0x8C04 };
  const rules = 'tinylp';
  const explicit = buildTree({ ...tree, P }, { rules, verification: 'full' });
  const packed = buildTree({ ...tree, P: { ...P, PACKED: 1 } }, { rules, verification: 'full' });
  const plan = packedPlan(packed.root.P, packed.settings.coreSize);
  assert.equal(new Set(plan.states).size, 4);
  const model = buildTree(recipes['packed-stones'].tree(), { rules, length: 31, verification: 'full' });
  assert.equal(model.total, 31);
  assert.throws(() => buildTree(tree, { rules, length: 31 }), /budget/);

  function dispatch(built) {
    const vm = new VM(built.settings);
    const state = VM.freshPSpace(built.settings);
    const base = 796;
    const entries = ['b1tLoop', 'b2tLoop'].map(key => (base + built.labels[key]) % vm.size);
    return (result) => {
      state[0] = result;
      vm.load([built.w], { positions: [base], pspaces: [state] });
      for (let step = 0; step < 20; step++) {
        const branch = entries.indexOf(vm.processes(0)[0]);
        if (branch !== -1) return { branch, state: state[1] };
        vm.step();
      }
      throw new Error('The table never launched a payload');
    };
  }
  const runExplicit = dispatch(explicit), runPacked = dispatch(packed);
  for (const result of [-1, 1, 1, 0, 1, 3, 2, 1, 0, 2, 1]) {
    const expected = runExplicit(result);
    assert.deepEqual(runPacked(result), { branch: expected.branch, state: plan.states[expected.state] });
  }
  assert.throws(() => buildTree({
    ...tree, P: { ...P, FIRST: 3, PACKED: 1 }, kids: [...tree.kids, ...tree.kids],
  }, { rules }), /residue range exceeds the core/);
});
