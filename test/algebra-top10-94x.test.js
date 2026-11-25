// Tests for the blocks added while rebuilding the 94x hill's top 10
// (tools/algebra/blocks/top10-94x.js; docs/hill-top10/94x.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, leaves } from '../tools/algebra/index.js';
import { treeSettings } from '../tools/algebra/build.js';

const IDS = ['airbag-mov-stone', 'flag-cmp-scanner', 'stone-dual-pump', 'arrow-scanner'];
const ok = (tree, rules = '94x-hill', length = 200) => {
  const built = buildTree(tree, { rules, length });
  assert.equal(built.verification.ok, true, JSON.stringify(built.verification.issues ?? built.verification));
  return built;
};
const misfits = (id, P, rules = '94x-hill', length = 200) => leaves[id].mismatches({ ...leaves[id].defaults, ...P }, treeSettings(rules, length));

test('the blocks load with a watch and accept their defaults on the X core', () => {
  for (const id of IDS) {
    assert.ok(leaves[id], id);
    assert.equal(typeof leaves[id].watch, 'function', `${id} watch`);
    assert.deepEqual(misfits(id, {}), [], id);
  }
});

test('airbag-mov-stone builds in place and self-booted, and its stone keeps Moore\'s shape', () => {
  const b = ok({ id: 'airbag-mov-stone' });
  assert.equal(b.total, 29);
  assert.match(b.source, /MOV\.I +\$53421, \$1/);   // the remote bomb: MOV D, 1 with D = core - 2019
  assert.match(b.source, /JMN\.B/);
  // HOP: seven more copy lines; the loop, bomb and clear run 43,990 cells away.
  assert.equal(ok({ id: 'airbag-mov-stone', P: { HOP: 43990 } }).total, 36);
  ok({ id: 'boot', P: { HOP: 30000 }, kids: [{ id: 'airbag-mov-stone', P: { HOP: 13990 } }] });
});

test('airbag-mov-stone refuses steps that bomb its loop and times past its lattice', () => {
  assert.ok(misfits('airbag-mov-stone', { STEP: 2018 }).some((m) => /bombs its own code/.test(m)));
  assert.ok(misfits('airbag-mov-stone', { TIME: 9240 }).some((m) => /past the lattice/.test(m)));
  assert.ok(misfits('airbag-mov-stone', { STEP: 10 }).some((m) => /d-clear would land on the stone/.test(m)));
});

test('flag-cmp-scanner looks first at STEP - 1, so its first lap ends on its own head', () => {
  const b = ok({ id: 'flag-cmp-scanner' });
  assert.equal(b.total, 17);
  assert.match(b.source, /SNE\.I +\$8277, \$8285/);
  ok({ id: 'flag-cmp-scanner', P: { STEP: 3774, STREAM: 4545 } }, 'modelwar', 5040);
});

test('flag-cmp-scanner refuses a wipe too short for its pair and a stream outside the core', () => {
  assert.ok(misfits('flag-cmp-scanner', { COUNT: 2, GAP: 8 }).some((m) => /cannot cover a pair/.test(m)));
  assert.ok(misfits('flag-cmp-scanner', { STREAM: 55420 }).some((m) => /must be inside/.test(m)));
  assert.ok(misfits('flag-cmp-scanner', { STEP: 27720 }).some((m) => /looks at only/.test(m)));
});

test('stone-dual-pump builds alone and booted, with both imp templates', () => {
  const b = ok({ id: 'stone-dual-pump' });
  assert.equal(b.total, 25);
  assert.match(b.source, /MOV\.I +#34117, \*0/);     // 13-point A-imp
  assert.match(b.source, /MOV\.I +#5, \$29179/);     // 19-point B-imp
  ok({ id: 'boot', P: { HOP: 12000 }, kids: [{ id: 'stone-dual-pump' }] });
});

test('stone-dual-pump refuses odd times, equal or impossible rings, and stones that hit themselves', () => {
  assert.ok(misfits('stone-dual-pump', { TIME: 23301 }).some((m) => /TIME must be even/.test(m)));
  assert.ok(misfits('stone-dual-pump', { NB: 13 }).some((m) => /must differ/.test(m)));
  assert.ok(misfits('stone-dual-pump', { NA: 15 }).some((m) => /no 15-point imp ring/.test(m)));
  assert.ok(misfits('stone-dual-pump', { PHOP: 30140 }).some((m) => /on each other/.test(m)));
  // The ModelWar numbers the recipes use.
  assert.deepEqual(misfits('stone-dual-pump', { SHOP: 13703, PHOP: 13931, STEP: 863, TIME: 10592, DJN: 20455 }, 'modelwar', 5040), []);
});

test('arrow-scanner builds alone and booted, and refuses a stream on itself', () => {
  assert.equal(ok({ id: 'arrow-scanner' }).total, 13);
  ok({ id: 'boot', P: { HOP: 18008, WIPE: 1 }, kids: [{ id: 'arrow-scanner' }] });
  assert.ok(misfits('arrow-scanner', { FAR: 10 }).some((m) => /drops its stream on itself/.test(m)));
});
