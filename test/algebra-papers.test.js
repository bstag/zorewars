// The paper blocks (tools/algebra/blocks/papers.js): each builds and passes the
// gate with its defaults on every rule set it supports, alone and combined;
// settings that can't work are refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, treeMismatches, link, gate, shape } from '../tools/algebra/index.js';
import { compile } from '../src/engine/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';

const SUPPORTS = {
  mice: ['88', '94nop', 'lp', '94x'],
  silk3: ['94nop', '94x'],
  'bomb-paper': ['94nop', 'lp', '94x'],
  'boot-paper': ['88', '94nop', 'lp', '94x'],
};
const ok = (rules, tree) => {
  const built = buildTree(tree, { rules });
  assert.equal(built.verification.ok, true, `${rules} ${shape(tree)}`);
  return built;
};

test('every paper passes the gate alone with its defaults on every rule set it supports', () => {
  for (const [id, rules] of Object.entries(SUPPORTS)) for (const r of rules) ok(r, { id });
  // Other stage counts and process counts work too.
  ok('94nop', { id: 'silk3', P: { STAGES: 2 } });
  ok('94nop', { id: 'silk3', P: { STAGES: 4 } });
  ok('94nop', { id: 'boot-paper', P: { STAGES: 3 } });
  ok('94nop', { id: 'bomb-paper', P: { BOMB: 1 } });
  ok('94nop', { id: 'bomb-paper', P: { PROCS: 3 } });
});

test('papers combine with other blocks', () => {
  const stone = { id: 'stone' };
  const cases = [
    ['88', { id: 'par', kids: [stone, { id: 'mice' }] }],
    ['lp', { id: 'par', kids: [stone, { id: 'mice' }] }],
    ['94nop', { id: 'apart', kids: [stone, { id: 'mice' }] }],
    ['94nop', { id: 'par', kids: [stone, { id: 'silk3' }] }],
    ['94x-hill', { id: 'switch', kids: [stone, { id: 'silk3' }] }],
    ['lp', { id: 'par', kids: [stone, { id: 'bomb-paper' }] }],
    ['lp', { id: 'apart', kids: [stone, { id: 'bomb-paper' }] }],
    ['94x-hill', { id: 'switch', kids: [stone, { id: 'bomb-paper' }] }],
    ['88', { id: 'par', kids: [stone, { id: 'boot-paper' }] }],
    ['lp', { id: 'image', kids: [{ id: 'boot-paper' }, { id: 'decoys' }] }],
    ['94x-hill', { id: 'switch', kids: [stone, { id: 'boot-paper' }] }],
  ];
  for (const [rules, tree] of cases) ok(rules, tree);
});

test('papers refuse settings that cannot work', () => {
  const has = (rules, tree, re) => {
    const m = treeMismatches(tree, recipeSettings(rules));
    assert.ok(m.some((x) => re.test(x)), JSON.stringify(m));
  };
  has('88', { id: 'silk3' }, /needs ICWS'94/);
  has('88', { id: 'bomb-paper' }, /needs ICWS'94/);
  has('lp', { id: 'silk3' }, /room to grow/);
  has('lp', { id: 'bomb-paper', P: { PROCS: 3 } }, /no room in the process table/);
  has('94nop', { id: 'bomb-paper', P: { INIT: 3000 } }, /bombs its own code/);
  has('94nop', { id: 'bomb-paper', P: { STEP: 2741 + 60 } }, /copies onto itself/);
  has('94nop', { id: 'mice', P: { D: 8000 } }, /land on itself/);
  has('94nop', { id: 'boot-paper', P: { HOP: 8000 } }, /HOP lands on the warrior/);
  has('94nop', { id: 'silk3', P: { STEP2: 8000 } }, /stage 2 copies onto itself/);
});

test('the gate sees a paper break its contract', () => {
  // Past its mismatches, a bomb-paper whose first bomb (after its four processes
  // have each moved it on by BSTEP) lands on its seed is caught by its watch.
  const settings = recipeSettings('94nop'), tree = { id: 'bomb-paper', P: { INIT: 8000 - ((4 * 2384) % 8000) - 1 } };
  const linked = link(tree, settings), w = compile(linked.source, 'redcode', settings);
  assert.ok(w.ok);
  assert.throws(() => gate({ ...linked, w, settings, tree }), /bombed itself/);
});
