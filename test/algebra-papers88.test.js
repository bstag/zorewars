// The '88-flavoured paper and launcher blocks (tools/algebra/blocks/papers88.js):
// each builds and passes the gate with its defaults on every rule set it
// supports, alone and in one combination; and the gate rejects a deliberately
// broken variant.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, link, gate, shape } from '../tools/algebra/index.js';
import { compile } from '../src/engine/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';

const SUPPORTS = {
  'bomb-mice': ['88', 'lp', '94nop'],
  'silk-88': ['88'],
  'anti-imp-silk': ['94nop', '94x', 'lp'],
  'dual-launcher': ['88'],
};

const ok = (rules, tree) => {
  const built = buildTree(tree, { rules });
  assert.equal(built.verification.ok, true, `${rules} ${shape(tree)}`);
  return built;
};

test('every block passes the gate alone with its defaults on every rule set it supports', () => {
  for (const [id, rules] of Object.entries(SUPPORTS)) for (const r of rules) ok(r, { id });
  // Other parameter choices work too.
  ok('94nop', { id: 'bomb-mice', P: { D: 2003, CSTEP: 2040, B: 2010, DEC: 1, TRAP: 0 } });  // decrement stream
  ok('88', { id: 'bomb-mice', P: { D: 2003, CSTEP: 2040, B: 2010, DEC: 0, TRAP: 1 } });      // JMZ trap
  ok('88', { id: 'silk-88', P: { STAGES: 3, D: 2003, DELTA: 80, CSTEP: 2040, B: 2010 } });    // three stages
  ok('94x', { id: 'anti-imp-silk', P: { BOMBS: 3, D: 2004, CSTEP: 1840, B: 2004 } });          // three bombs a lap
  ok('94nop', { id: 'anti-imp-silk', P: { BOMBS: 1, D: 2004, CSTEP: 1840, B: 2004 } });        // one bomb a lap
});

test('the blocks combine with a stone, side by side and apart', () => {
  const stone = { id: 'stone' };
  const cases = [
    ['88', { id: 'par', kids: [stone, { id: 'bomb-mice' }] }],
    ['94nop', { id: 'apart', kids: [stone, { id: 'bomb-mice' }] }],
    ['88', { id: 'par', kids: [stone, { id: 'silk-88' }] }],
    ['lp', { id: 'par', kids: [stone, { id: 'anti-imp-silk' }] }],
    ['94nop', { id: 'apart', kids: [stone, { id: 'anti-imp-silk' }] }],
    ['88', { id: 'apart', kids: [stone, { id: 'dual-launcher' }] }],
  ];
  for (const [rules, tree] of cases) ok(rules, tree);
});

test('dual-launcher refuses a hill too small for its launch', () => {
  assert.throws(() => buildTree({ id: 'dual-launcher' }, { rules: 'lp' }), /peaks at .* processes|more processes than this hill allows/);
});

test('the gate rejects a broken variant of each block', () => {
  // Each tree is linked and gated directly (bypassing the fit checks), so the
  // behaviour gate itself must catch the contract it breaks.
  const broken = [
    ['bomb-mice', '88', { D: 2003, CSTEP: 2040, B: 2001, DEC: 0, TRAP: 0 }, /residue overlaps its copies/],       // bomb on the copy residue window
    ['silk-88', '88', { STAGES: 2, D: 2003, DELTA: 80, CSTEP: 2040, B: 1999 }, /residue overlaps its copies/],     // bomb on the copy residue window
    ['anti-imp-silk', '94nop', { BOMBS: 2, D: 2004, CSTEP: 40, B: 2004 }, /too few copies/],                        // CSTEP rounds to no march: copies cannot spread
    ['dual-launcher', '94nop', { NA: 11, NB: 13, K: 2 }, /did not survive/],                                        // fewer imps than points: they walk into gaps and die
  ];
  for (const [id, rules, P, re] of broken) {
    const settings = recipeSettings(rules, 50);
    const linked = link({ id, P }, settings);
    const w = compile(linked.source, 'redcode', settings);
    assert.ok(w.ok, `${id} should assemble`);
    assert.throws(() => gate({ ...linked, w, settings, tree: { id, P } }), re, `${id} broken variant should be rejected by the gate`);
  }
});
