import test from 'node:test';
import assert from 'node:assert/strict';
import { recipeSettings } from '../tools/blocks/recipes.js';
import { buildTree, treeMismatches, leaves, shape } from '../tools/algebra/index.js';

const ALL = ['88', '94nop', 'lp', '94x'], NEW = ['94nop', 'lp', '94x'];
const guarded = { id: 'finisher-guarded' };
const ok = (tree, rules, planted) => {
  const built = buildTree(tree, { rules });
  assert.equal(built.verification.ok, true, `${shape(tree)} on ${rules}`);
  const scenarios = built.verification.observations.map((o) => o.scenario);
  for (const id of planted) assert.ok(scenarios.includes(`${id}: planted target`), `${shape(tree)} on ${rules}: no planted run for ${id}`);
  return built;
};

test('the scanner blocks are loaded with working defaults', () => {
  for (const id of ['opening-quickscan', 'opening-sne', 'scanner', 'bscan-body']) {
    assert.ok(leaves[id], id);
    assert.equal(typeof leaves[id].plant, 'function', id);
    assert.equal(typeof leaves[id].watch, 'function', id);
  }
});

test('openings hand on to a guarded clear, and to other blocks', () => {
  for (const rules of NEW) {
    for (const id of ['opening-quickscan', 'opening-sne']) {
      ok({ id: 'seq', kids: [{ id }, guarded] }, rules, [id]);
    }
    ok({ id: 'seq', kids: [{ id: 'opening-quickscan' }, { id: 'scanner' }] }, rules, ['opening-quickscan', 'scanner']);
    ok({ id: 'seq', kids: [{ id: 'opening-sne' }, { id: 'relocate', kids: [{ id: 'finisher-counted' }] }] }, rules, ['opening-sne']);
  }
});

test('scanning bodies run alone and in combinations on every rule set', () => {
  for (const rules of ALL) {
    ok({ id: 'scanner' }, rules, ['scanner']);
    ok({ id: 'scanner', P: { STEP: 2341, BOMB: 1 } }, rules, ['scanner']);
    ok({ id: 'bscan-body' }, rules, ['bscan-body']);
    ok({ id: 'par', kids: [{ id: 'scanner' }, { id: 'stone' }] }, rules, ['scanner']);
    ok({ id: 'trigger', P: { MODE: 0, TIME: 2000 }, kids: [{ id: 'bscan-body' }, { id: 'finisher-counted' }] }, rules, ['bscan-body']);
  }
  ok({ id: 'bscan-body', P: { STEP: 997, WIDTH: 4 } }, '94nop', ['bscan-body']);
});

test('bad scanner settings are refused', () => {
  const s94 = recipeSettings('94nop'), s88 = recipeSettings('88');
  const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  has({ id: 'seq', kids: [{ id: 'opening-quickscan', P: { START: 10, SPACING: 650, GAP: 8, N: 12 } }, guarded] }, s94, /lands on or next to the warrior/);
  has({ id: 'seq', kids: [{ id: 'opening-quickscan', P: { START: 300, SPACING: 700, GAP: 8, N: 12 } }, guarded] }, s94, /lands on or next to the warrior/);
  has({ id: 'seq', kids: [{ id: 'opening-sne', P: { START: 100, STEP: 16, GAP: 8, SCANS: 300 } }, guarded] }, s94, /runs on into the warrior/);
  has({ id: 'seq', kids: [{ id: 'opening-sne' }, guarded] }, s88, /opening-sne needs ICWS'94/);
  has({ id: 'bscan-body', P: { STEP: 2341, WIDTH: 5 } }, s94, /WIDTH must be/);
  // Defaults fit everywhere they claim to.
  for (const rules of NEW) assert.deepEqual(treeMismatches({ id: 'seq', kids: [{ id: 'opening-sne' }, guarded] }, recipeSettings(rules)), []);
});
