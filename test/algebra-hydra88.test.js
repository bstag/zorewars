// hydra-88 (tools/algebra/blocks/hydra88.js): a launcher of small resin clears.
// It builds and passes the gate on 88 and 94nop, quick and full, alone and
// after a quickscan; its launches are followed in the VM; broken settings are
// refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, gate, leaves, treeMismatches } from '../tools/algebra/index.js';
import { RULESETS, VM } from '../src/engine/index.js';

const ID = 'hydra-88';
const ok = (rules, tree, verification = 'quick', length) => {
  const built = buildTree(tree, { rules, verification, length });
  assert.equal(built.verification.ok, true);
  assert.deepEqual(built.w.warnings, []);
  return built;
};

test('it passes the gate on 88 and 94nop, quick and full, alone and after a quickscan', () => {
  for (const rules of ['88', '94nop']) assert.equal(ok(rules, { id: ID }).total, 10);
  assert.equal(ok('88', { id: ID }, 'full').verification.profile, 'full');
  const built = ok('88', { id: 'seq', kids: [{ id: 'opening-qscan-add-88', P: { ROWS: 4 } }, { id: ID }] }, 'full');
  assert.ok(built.total <= 50);
});

test('every launch enters a whole four-cell resin child, HOP cells past the last, on its SPL 0', () => {
  const built = ok('88', { id: ID }), P = leaves[ID].defaults, { settings, labels } = built, core = settings.coreSize;
  for (const base of [0, 7000]) {
    const vm = new VM(settings);
    vm.load([built.w], { positions: [base] });
    const at = (l) => (base + labels['b0' + l]) % core;
    const launches = [];
    while (vm.cycle < 400 && launches.length < 12) {
      const pc = vm.processes(0)[0];
      if (pc === at('hJ')) {
        const head = (at('hTop') + vm.peek(at('hTop')).b) % core;
        launches.push(head);
        assert.deepEqual([0, 1, 2, 3].map((i) => vm.peek(head + i).op), ['SPL', 'MOV', 'MOV', 'DJN'], `launch ${launches.length - 1}`);
        assert.deepEqual([vm.peek(head + 1).aMode, vm.peek(head + 2).aMode, vm.peek(head + 2).b], ['$', '<', P.FIRST]);
        vm.step();
        assert.equal(vm.processes(0).at(-1), head);            // the jumper is now on the child's SPL 0
      } else vm.step();
    }
    assert.equal(launches.length, 12);
    launches.forEach((head, k) => assert.equal(head, (at('hHead') + P.START + k * P.HOP) % core, `child ${k}`));
    // The children run: each lays its own trail from FIRST above its drop line.
    while (vm.cycle < 1500) vm.step();
    const drop = vm.peek(launches[0] + 2 + P.FIRST - 1);
    assert.deepEqual([drop.op, drop.aMode, drop.bMode, drop.a], ['MOV', '<', '<', 0]);
  }
});

test('broken settings are refused by the contract and by the gate', () => {
  const s88 = { ...RULESETS['88'], maxLength: 50 };
  assert.ok(treeMismatches({ id: ID, P: { HOP: 1273 } }, s88).some((m) => /lands on the warrior/.test(m)));
  assert.ok(treeMismatches({ id: 'par', kids: [{ id: 'stone' }, { id: ID }] }, s88).length > 0, 'it takes no partners');
  // A launcher that steps a cell too far leaves a gap under each child's top cell.
  const built = buildTree({ id: ID }, { rules: '88' });
  built.w.instructions[built.labels.b0hAdd].a++;
  assert.throws(() => gate(built), /not HOP cells past|not whole/);
  // One that copies the wrong line as the layer makes children that are not resin.
  const wrong = buildTree({ id: ID }, { rules: '88' });
  wrong.w.instructions[wrong.labels.b0hL].a++;
  assert.throws(() => gate(wrong), /not whole/);
});

test('CHILDREN stops the launcher after that many whole children; SPLIT 1 children return to their SPL; quick and full', () => {
  for (const P of [{ CHILDREN: 7 }, { CHILDREN: 3 }, { CHILDREN: 7, SPLIT: 1 }, { CHILDREN: 7, SPLIT: 1, HOP: 992, FIRST: 7339 }]) {
    const built = ok('88', { id: ID, P });
    assert.equal(built.total, 13);
    const { settings, labels, w } = built, core = settings.coreSize, D = { ...leaves[ID].defaults, ...P };
    const vm = new VM(settings);
    vm.load([w], { positions: [0] });
    const heads = [];
    while (vm.cycle < 3000) {
      const pc = vm.processes(0)[0];
      if (pc === labels.b0hJ) heads.push((labels.b0hTop + vm.peek(labels.b0hTop).b) % core);
      vm.step();
    }
    assert.equal(vm.peek(labels.b0hHead).op, 'DAT', 'the launcher stopped');
    const whole = heads.filter((h, k) => k < D.CHILDREN && h === (D.START + k * D.HOP) % core);
    assert.equal(whole.length, D.CHILDREN);
    // A SPLIT child's loop returns to its own head.
    const back = vm.peek((D.START + 3) % core);
    assert.equal(back.op, 'DJN');
    assert.equal(back.a, P.SPLIT ? core - 3 : core - 2);
  }
  ok('88', { id: ID, P: { CHILDREN: 7, SPLIT: 1, HOP: 992, FIRST: 7339 } }, 'full');
  ok('88', { id: 'seq', kids: [{ id: 'opening-qscan-table-88' }, { id: 'probe-burst-88' }, { id: ID, P: { CHILDREN: 7, SPLIT: 1, HOP: 992, FIRST: 7339 } }] }, 'full', 100);
  const s88 = { ...RULESETS['88'], maxLength: 50 };
  assert.ok(treeMismatches({ id: ID, P: { CHILDREN: 30, HOP: 250 } }, s88).some((m) => /lands on the warrior/.test(m)));
});
