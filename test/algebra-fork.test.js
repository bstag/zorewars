// fork(opening, a, b): the opening runs, then a hit picks a and nothing found
// picks b (the Alternating Raisins idea, docs/hill-recipe-book.md, gap #12).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, treeMismatches } from '../tools/algebra/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';
import { compile, VM } from '../src/engine/index.js';

const fork = (o, a, b) => ({ id: 'fork', kids: [o, a, b] });
const mul = { id: 'opening-qscan-mul' }, guarded = { id: 'finisher-guarded' }, stone = { id: 'mod-stone' };

test('fork passes the gate with both branch scenarios on every rule set', () => {
  for (const rules of ['94nop', 'lp', '94x']) {
    const built = buildTree(fork(mul, guarded, stone), { rules, length: 100 });
    const names = built.verification.observations.map((o) => o.scenario);
    assert.ok(names.includes('fork: nothing found') && names.includes('opening-qscan-mul: planted target'), `${rules}: ${names}`);
  }
  assert.equal(buildTree(fork({ id: 'opening-cmpscan-88' }, { id: 'finisher-guarded-88' }, stone), { rules: '88', length: 100 }).verification.ok, true);
  assert.equal(buildTree(fork(mul, { id: 'silk-imps' }, { id: 'scanner-pendulum' }), { rules: '94x', length: 100 }).verification.ok, true);
});

// Run the warrior with and without a target in the opening's lattice and see which body runs.
test('fork takes the hit branch only when the opening found something', () => {
  const settings = recipeSettings('94nop', 100);
  const built = buildTree(fork(mul, guarded, stone), { rules: '94nop', length: 100 });
  const w = compile(built.source, 'redcode', settings);
  const pick = Object.keys(built.labels).find((l) => l.endsWith('pick'));
  const ran = (plant) => {
    const vm = new VM(settings);
    vm.load([w], { positions: [0] });
    if (plant !== null) vm.poke(plant, { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 7 });
    let seen = null;
    for (let i = 0; i < 400 && seen === null; i++) {
      const pc = vm.processes(0)[0];
      if (pc === built.labels[pick] + 1 || pc === built.labels[pick] + 2) seen = pc - built.labels[pick];
      vm.step();
    }
    return seen;
  };
  // With nothing planted the SEQ skips to the second jump (b); with a target, the first (a).
  assert.equal(ran(null), 2);
  assert.equal(ran((1 + 349) * 3 % 8000), 1);   // unit 2's B location, defaults QFAC 349
});

test('fork refuses an opening without a probe and bodies that stop', () => {
  const s = recipeSettings('94nop', 100);
  const has = (tree, re) => assert.ok(treeMismatches(tree, s).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, s)));
  has(fork(stone, guarded, stone), /must hand on|provides no probe/);
  has(fork(mul, mul, stone), /must run forever/);
});

// BY 1: the opening chain ends in probe-verdict; a body takes a, a lone cell or nothing takes b.
test('fork BY 1 tells a body from a lone cell', () => {
  const settings = recipeSettings('94nop', 100);
  const opening = { id: 'seq', kids: [mul, { id: 'probe-verdict' }] };
  const built = buildTree({ id: 'fork', P: { BY: 1 }, kids: [opening, guarded, stone] }, { rules: '94nop', length: 100 });
  assert.equal(built.verification.ok, true);
  assert.equal(built.labels[built.root.kids[0].kids[0].ns + 'probe'], 0);      // the probe is still the first cell
  const w = compile(built.source, 'redcode', settings);
  const pick = Object.keys(built.labels).find((l) => l.endsWith('pick'));
  const marker = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 7 };
  const ran = (cells) => {
    const vm = new VM(settings);
    vm.load([w], { positions: [0] });
    for (const c of cells) vm.poke(c, marker);
    for (let i = 0; i < 600; i++) {
      const pc = vm.processes(0)[0];
      if (pc === built.labels[pick] + 1 || pc === built.labels[pick] + 2) return pc - built.labels[pick];
      vm.step();
    }
    return null;
  };
  const hit = (1 + 349) * 3 % 8000;
  assert.equal(ran([]), 2);
  assert.equal(ran([hit]), 2);              // a lone cell: probably a bomb
  assert.equal(ran([hit, hit + 1]), 1);     // a body
  assert.ok(treeMismatches({ id: 'fork', P: { BY: 1 }, kids: [mul, guarded, stone] }, settings).some((m) => /needs a verdict/.test(m)));
});
