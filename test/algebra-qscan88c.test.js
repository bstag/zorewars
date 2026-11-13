// opening-qscan-full-88 (tools/algebra/blocks/qscan88c.js): the full-size '88
// quickscan without a decoder. It builds and passes the gate on 88 and 94nop,
// quick and full, with the burst and a body; every pair's hand-on is checked
// in the VM; broken settings are refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, gate, leaves, treeMismatches } from '../tools/algebra/index.js';
import { RULESETS, VM } from '../src/engine/index.js';

const ID = 'opening-qscan-full-88';
const marker = { op: 'JMP', mod: 'B', aMode: '$', a: 0, bMode: '$', b: 0 };
const guarded = { id: 'finisher-guarded-88', P: { PHASE: 0 } };
const seq = (...kids) => ({ id: 'seq', kids });
const ok = (rules, tree, verification = 'quick', length = 100) => {
  const built = buildTree(tree, { rules, length, verification });
  assert.equal(built.verification.ok, true);
  assert.deepEqual(built.w.warnings, []);
  return built;
};

test('18 pairs are 37 cells, 49 with the burst; it passes the gate quick and full', () => {
  const bare = ok('88', seq({ id: 'opening-none' }, guarded)).total;
  const scan = ok('88', seq({ id: ID }, guarded));
  assert.equal(scan.spans[scan.root.kids[0].ns].size + 1, 37);          // 36 lines and the probe cell
  const burst = ok('88', seq({ id: ID }, { id: 'probe-burst-88' }, guarded), 'full');
  assert.equal(burst.total - scan.total, 12);
  assert.ok(burst.total - bare <= 50);
  ok('94nop', seq({ id: ID }, { id: 'probe-burst-88' }, guarded));
  ok('88', seq({ id: ID, P: { PAIRS: 12, SPACING: 600 } }, { id: 'probe-burst-88' }, { id: 'stone-pump-boot-88' }), 'full');
  assert.ok(ok('88', seq({ id: ID, P: { PAIRS: 4, SPACING: 1700 } }, { id: 'probe-burst-88' }, { id: 'stone-pump-boot-88' }), 'quick', 50).total <= 50);
});

test('it hands on the low cell of the last pair that differs, in PAIRS cycles plus one a hit', () => {
  const built = ok('88', seq({ id: ID }, guarded));
  const { settings, labels, root } = built, core = settings.coreSize, P = leaves[ID].defaults;
  const ns = root.kids[0].ns, qP = labels[ns + 'qP'], end = labels[root.kids[1].ns + 'payload'];
  const run = (base, plant) => {
    const vm = new VM(settings);
    vm.load([built.w], { positions: [base] });
    for (const c of plant) vm.poke(base + qP + c, marker);
    while (vm.processes(0)[0] !== (base + end) % core && vm.cycle < 100) vm.step();
    assert.equal(vm.processes(0)[0], (base + end) % core);
    return { probe: vm.peek(base + qP).b, cycles: vm.cycle };
  };
  for (const base of [0, 7990]) {
    assert.deepEqual(run(base, []), { probe: built.w.instructions[qP].b, cycles: P.PAIRS });
    for (let i = 0; i < P.PAIRS; i++) {
      const low = P.START + i * P.SPACING;
      assert.deepEqual(run(base, [low]), { probe: low, cycles: P.PAIRS + 1 }, `pair ${i} low`);
      assert.deepEqual(run(base, [low + P.GAP]), { probe: low, cycles: P.PAIRS + 1 }, `pair ${i} high`);
      assert.deepEqual(run(base, [low, low + P.GAP]), { probe: built.w.instructions[qP].b, cycles: P.PAIRS }, `pair ${i} equal`);
    }
    // Two pairs differ: the later one wins.
    assert.deepEqual(run(base, [P.START, P.START + 5 * P.SPACING]), { probe: P.START + 5 * P.SPACING, cycles: P.PAIRS + 2 });
  }
});

test('broken settings are refused by the contract and by the gate', () => {
  const s88 = { ...RULESETS['88'], maxLength: 100 };
  const refuses = (P, re) => assert.ok(treeMismatches(seq({ id: ID, P }, guarded), s88).some((m) => re.test(m)), `${JSON.stringify(P)} should be refused`);
  refuses({ GAP: 400 }, /same cell/);
  refuses({ PAIRS: 24 }, /looks at the image/);
  const built = buildTree(seq({ id: ID }, guarded), { rules: '88', length: 100 });
  built.w.instructions[built.labels[built.root.kids[0].ns + 'qScan'] + 1].a++;      // pair 0 sets the wrong cell
  assert.throws(() => gate(built), /not on the last pair that differed/);
});
