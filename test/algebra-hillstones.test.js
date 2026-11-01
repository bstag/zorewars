// Tests for the hillstones blocks (tools/algebra/blocks/hillstones.js).

import test from 'node:test';
import assert from 'node:assert/strict';

const { buildTree, treeMismatches, leaves, shape } = await import('../tools/algebra/index.js');
const { recipeSettings } = await import('../tools/blocks/recipes.js');
const { compile, VM } = await import('../src/engine/index.js');

const NEW = ['94nop', 'lp', '94x'];
const seq = (...kids) => ({ id: 'seq', kids });
const ok = (tree, rules) => {
  const built = buildTree(tree, { rules, length: 100 });
  assert.equal(built.verification.ok, true, `${shape(tree)} on ${rules}`);
  return built;
};

test('timed-stone loads with working defaults', () => {
  assert.ok(leaves['timed-stone'], 'timed-stone');
  assert.equal(typeof leaves['timed-stone'].watch, 'function');
});

test('timed-stone builds alone, both endings, on every 94 rule set', () => {
  for (const rules of NEW) {
    ok({ id: 'timed-stone', P: { END: 1 } }, rules);            // one-cell clear wreck
    ok({ id: 'timed-stone', P: { END: 0 } }, rules);            // self-off sink
    ok({ id: 'timed-stone', P: { STEP: 2920, TIME: 250, END: 1 } }, rules);
  }
});

test('timed-stone runs as the last member of a seq behind an opening', () => {
  for (const rules of NEW) {
    ok(seq({ id: 'opening-quickscan' }, { id: 'timed-stone', P: { END: 1 } }), rules);
    ok(seq({ id: 'opening-quickscan' }, { id: 'timed-stone', P: { END: 0 } }), rules);
  }
});

test('bad settings are refused', () => {
  const s94 = recipeSettings('94nop'), s88 = recipeSettings('88');
  const has = (P, settings, re) => assert.ok(treeMismatches({ id: 'timed-stone', P }, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches({ id: 'timed-stone', P }, settings)));
  has({ STEP: 2817 }, s94, /too small to keep the bomb class/);  // coprime step: gcd 1
  has({ STEP: 100 }, s94, /reaches only/);                       // gcd 100 > 80: too few cells
  has({}, s88, /needs ICWS'94/);
});

// The one-cell clear, directly: after TIME bombs the warrior converts, and from
// then on a single cell is cleared per process, the pointer walking forward one
// step at a time (the DAT's >1 postincrement). We watch the pointer sweep a
// contiguous forward run of cells.
test('timed-stone END 1 converts into a forward one-cell-per-process clear', () => {
  const rules = '94nop', P = { STEP: 2920, TIME: 150, END: 1 };
  const settings = recipeSettings(rules, 100);
  const built = buildTree({ id: 'timed-stone', P }, { rules, length: 100 });
  const w = compile(built.source, 'redcode', settings);
  assert.ok(w.ok, JSON.stringify(w.errors));
  const vm = new VM(settings);
  vm.load([w], { positions: [0] });
  // The clear pointer is the last cell of the block; its B is what advances.
  const cptr = built.labels[Object.keys(built.labels).find((k) => k.endsWith('tsCPtr'))];
  const readPtr = () => vm.peek(cptr).b;
  // Run through the bombing phase and well into the clear.
  vm.run(settings.coreSize);               // enough cycles to convert and sweep
  const start = readPtr();
  vm.run(6000);
  const end = readPtr();
  // The pointer has advanced (forward sweep), and the warrior is still alive.
  assert.ok(vm.warriors[0].alive, 'warrior died running its own clear');
  const advanced = ((end - start) % settings.coreSize + settings.coreSize) % settings.coreSize;
  assert.ok(advanced > 100, `clear pointer barely moved (${advanced})`);
});

// A copy of a block whose emitted code is altered by `f`, to show its watch notices.
let copies = 0;
function broken(id, f, P) {
  const orig = leaves[id], nid = `broken${++copies}-${id}`;
  leaves[nid] = { ...orig, id: nid, emit: (ctx) => orig.emit({ ...ctx, ins: (l, o, m, a, b = '0') => ctx.ins(l, ...f(l, o, m, a, b)) }) };
  const scenarioFix = (api) => ({ ...api, scenario: api.scenario.replace(nid, id) });
  leaves[nid].watch = (api) => orig.watch(scenarioFix(api));
  if (orig.plant) leaves[nid].plant = (api) => orig.plant(scenarioFix(api));
  return { id: nid, ...(P ? { P } : {}) };
}

test('the watch catches a clear whose pointer does not advance', () => {
  // Break the DAT's >1 postincrement into a static #1: the clear stalls on one cell.
  const bad = broken('timed-stone', (l, o, m, a, b) => (l === 'tsCBomb' && b === '>1' ? [o, m, a, '#1'] : [o, m, a, b]), { END: 1 });
  assert.throws(() => buildTree({ id: bad.id, P: bad.P }, { rules: '94nop', length: 100 }), /advance exactly one cell|swept too few cells/, bad.id);
});
