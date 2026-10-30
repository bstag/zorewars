import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, treeMismatches } from '../tools/algebra/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';

const ok = (tree, rules) => {
  const built = buildTree(tree, { rules });
  assert.equal(built.verification.ok, true, `${rules} ${JSON.stringify(tree)}`);
  return built;
};
const stone = { id: 'stone', P: { TSTEP: 4, TBOMB: 0 } };
// LP allows 8 processes: the defaults (13 points) need more, so LP gets small rings.
const small = { 'imp-ring': { N: 3 }, 'vector-spiral': { N: 3, K: 2 } };

test('every imp block passes the gate alone with its defaults on every rule set', () => {
  for (const id of ['imp', 'imp-ring', 'vector-spiral', 'imp-gate']) {
    for (const rules of ['88', '94nop', '94x']) ok({ id }, rules);
    if (small[id]) {
      assert.ok(treeMismatches({ id }, recipeSettings('lp')).some((m) => /more processes than this hill allows/.test(m)), id);
      ok({ id, P: small[id] }, 'lp');
    } else ok({ id }, 'lp');
  }
});

test('the launches are exact: every process the blocks declare, no more', () => {
  const peak = (tree, rules) => Math.max(...ok(tree, rules).verification.observations.map((o) => o.peak));
  assert.equal(peak({ id: 'imp-ring' }, '94nop'), 26);                     // 13 parked, each split into a jumper and an adder
  assert.equal(peak({ id: 'vector-spiral', P: { N: 7, K: 3 } }, '88'), 16);
  assert.equal(peak({ id: 'imp-gate', P: { GATE: 5, GK: 2 } }, '94nop'), 4);
});

test('imp blocks in combinations', () => {
  const cases = [
    ['94nop', { id: 'par', kids: [stone, { id: 'imp' }] }],
    ['88', { id: 'par', kids: [stone, { id: 'imp-ring' }] }],
    ['94nop', { id: 'apart', P: { D: 4000 }, kids: [stone, { id: 'vector-spiral' }] }],
    ['88', { id: 'boot', P: { HOP: 3000 }, kids: [{ id: 'imp-ring' }] }],
    ['94x', { id: 'par', kids: [stone, { id: 'vector-spiral', P: { N: 17, K: 5 } }] }],
    ['94nop', { id: 'par', kids: [stone, { id: 'imp-gate' }] }],
    ['94nop', { id: 'par', kids: [{ id: 'imp-gate', P: { GATE: 3, GK: 2 } }, { id: 'vector-spiral' }] }],
    ['lp', { id: 'copies', P: { N: 2, D: 2667 }, kids: [{ id: 'imp-gate' }] }],
    ['94nop', { id: 'trigger', P: { MODE: 0, TIME: 2000 }, kids: [{ id: 'imp-gate' }, { id: 'vector-spiral' }] }],
  ];
  for (const [rules, tree] of cases) ok(tree, rules);
});

test('the gate stops a planted imp', () => {
  for (const [rules, tree] of [['94nop', { id: 'imp-gate' }], ['88', { id: 'imp-gate', P: { GATE: 20, GK: 1 } }], ['94x', { id: 'imp-gate' }],
    ['94nop', { id: 'par', kids: [stone, { id: 'imp-gate' }] }]]) {
    assert.ok(ok(tree, rules).verification.observations.some((o) => o.scenario === 'imp-gate: planted target'), rules);
  }
});

test('broken settings are refused', () => {
  const s94 = recipeSettings('94nop'), s94x = recipeSettings('94x');
  const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  has({ id: 'vector-spiral', P: { N: 12, K: 4 } }, s94, /no 12-point imp ring on a 8000-cell core/);
  has({ id: 'vector-spiral', P: { N: 13, K: 3 } }, s94, /fewer imps than points/);
  has({ id: 'imp-ring', P: { N: 21 } }, s94x, /no 21-point imp ring on a 55440-cell core/);
  has({ id: 'imp-ring', P: { N: 7 } }, s94x, /no 7-point/);
  has({ id: 'imp-gate', P: { GATE: 1, GK: 0 } }, s94, /GATE must be an integer/);
  // Two bodies that write ahead of themselves: the imp crawls over the spiral's launcher, and the gate sees it.
  assert.throws(() => buildTree({ id: 'par', kids: [{ id: 'imp' }, { id: 'vector-spiral' }] }, { rules: '94nop' }), /only one member may write just ahead of itself/);
});
