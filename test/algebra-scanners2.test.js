import test from 'node:test';
import assert from 'node:assert/strict';
import { recipeSettings } from '../tools/blocks/recipes.js';
import { buildTree, treeMismatches, leaves, shape } from '../tools/algebra/index.js';

const ALL = ['88', '94nop', 'lp', '94x'], NEW = ['94nop', 'lp', '94x'];
const IDS = ['blur-scanner', 'mirror-scanner', 'opening-qscan-decode', 'finisher-outward'];
const ok = (tree, rules, planted = []) => {
  const built = buildTree(tree, { rules });
  assert.equal(built.verification.ok, true, `${shape(tree)} on ${rules}`);
  const scenarios = built.verification.observations.map((o) => o.scenario);
  for (const id of planted) assert.ok(scenarios.includes(`${id}: planted target`), `${shape(tree)} on ${rules}: no planted run for ${id}`);
  return built;
};
const seq = (...kids) => ({ id: 'seq', kids });
const blur = { id: 'blur-scanner' }, mirror = { id: 'mirror-scanner' }, decode = { id: 'opening-qscan-decode' }, outward = { id: 'finisher-outward' };

test('the second-wave scanner blocks are loaded with working defaults', () => {
  for (const id of IDS) {
    assert.ok(leaves[id], id);
    assert.equal(typeof leaves[id].watch, 'function', id);
    if (id !== 'finisher-outward') assert.equal(typeof leaves[id].plant, 'function', id);
  }
});

test('the scanning bodies run alone and in combinations', () => {
  for (const rules of ALL) {
    ok(mirror, rules, ['mirror-scanner']);
    ok({ id: 'par', kids: [mirror, { id: 'stone' }] }, rules, ['mirror-scanner']);
  }
  for (const rules of ['88', '94nop']) ok({ id: 'trigger', P: { MODE: 0, TIME: 2000 }, kids: [mirror, { id: 'finisher-dclear' }] }, rules, ['mirror-scanner']);
  for (const rules of NEW) {
    ok(blur, rules, ['blur-scanner']);
    ok({ id: 'blur-scanner', P: { STEP: 997, LEN: 40, CLEAR: 0, SCANS: 1 } }, rules, ['blur-scanner']);
    ok(seq({ id: 'opening-sne' }, blur), rules, ['opening-sne', 'blur-scanner']);
    ok(seq(decode, mirror), rules, ['opening-qscan-decode', 'mirror-scanner']);
  }
  ok({ id: 'trigger', P: { MODE: 0, TIME: 2000 }, kids: [{ id: 'blur-scanner', P: { STEP: 2341, LEN: 16, CLEAR: 0, SCANS: 1 } }, { id: 'finisher-counted' }] }, '94nop', ['blur-scanner']);
});

test('the decoding quickscan and the outward clear run after openings and before clears', () => {
  for (const rules of NEW) {
    ok(seq(decode, outward), rules, ['opening-qscan-decode']);
    ok(seq(decode, { id: 'finisher-guarded' }), rules, ['opening-qscan-decode']);
    ok(seq({ id: 'opening-sne' }, outward), rules, ['opening-sne']);
    ok(seq({ id: 'opening-quickscan' }, outward), rules, ['opening-quickscan']);
  }
  for (const rules of ALL) ok(seq({ id: 'opening-bomber' }, outward), rules);
  ok(seq({ id: 'opening-none' }, { id: 'finisher-outward', P: { STUN: 0 } }), '88');
  ok(seq({ id: 'opening-bscan' }, { id: 'finisher-outward', P: { STUN: 400 } }), '94nop');
});

test('bad settings are refused', () => {
  const s94 = recipeSettings('94nop'), s88 = recipeSettings('88');
  const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  has(seq({ id: 'opening-qscan-decode', P: { START: 400, SPACING: 900, GAP: 7580, N: 8 } }, outward), s94, /lands on or next to the warrior/);
  has(seq({ id: 'opening-qscan-decode', P: { START: 30, SPACING: 900, GAP: 12, N: 8 } }, outward), s94, /lands on or next to the warrior/);
  has(seq(decode, outward), s88, /opening-qscan-decode needs ICWS'94/);
  has(blur, s88, /blur-scanner needs ICWS'94/);
  has({ id: 'par', kids: [blur, { id: 'stone' }] }, s94, /a clear erases its partners/);
  has(outward, s94, /nothing provides a probe/);
  has({ id: 'blur-scanner', P: { STEP: 2341, LEN: 65, CLEAR: 1, SCANS: 4000 } }, s94, /LEN must be/);
});

// A copy of a block whose code is changed by `f`, to show its watch notices.
let copies = 0;
function broken(id, f, P) {
  const orig = leaves[id], nid = `broken${++copies}-${id}`;
  leaves[nid] = { ...orig, id: nid, emit: (ctx) => orig.emit({ ...ctx, ins: (l, o, m, a, b = '0') => ctx.ins(l, ...f(l, o, m, a, b)) }) };
  // Plants and watches name their scenario after the block's id.
  const scenarioFix = (api) => ({ ...api, scenario: api.scenario.replace(nid, id) });
  leaves[nid].watch = (api) => orig.watch(scenarioFix(api));
  if (orig.plant) leaves[nid].plant = (api) => orig.plant(scenarioFix(api));
  return { id: nid, ...(P ? { P } : {}) };
}

test('the watches catch a broken mechanism', () => {
  const cases = [
    // Blur: a carpet one cell long; a clear that counts one cell too many.
    [broken('blur-scanner', (l, o, m, a, b) => (l === '' && o === 'MOV' && m === 'AB' && a === '#16' ? [o, m, '#1', b] : [o, m, a, b])), /did not carpet forward/],
    [broken('blur-scanner', (l, o, m, a, b) => (o === 'MOV' && a.startsWith('#(CORESIZE-') ? [o, m, a.replace('#(CORESIZE-', '#(1+CORESIZE-'), b] : [o, m, a, b])), /bombed its own warrior/],
    // Mirror: the side before the image tested through the wrong pointer.
    [broken('mirror-scanner', (l, o, m, a, b) => (o === 'JMZ' && b.endsWith('pa') ? [o, m, a, b.replace(/pa$/, 'pb')] : [o, m, a, b])), /missed the planted target before its image/],
    // Decoder: never moves on to the pair's second cell.
    [broken('opening-qscan-decode', (l, o, m, a, b) => (l === 'qSecond' ? [o, m, '#0', b] : [o, m, a, b])), /not the planted cell/],
  ];
  for (const [tree, re] of cases) {
    const tr = tree.id.endsWith('opening-qscan-decode') ? seq(tree, { id: 'finisher-guarded' }) : tree;
    assert.throws(() => buildTree(tr, { rules: '94nop' }), re, tree.id);
  }
  // Outward: starts one cell past the probe; the forward pointer's jump lands on the image; the backward pointer stands still.
  const outCases = [
    [broken('finisher-outward', (l, o, m, a, b) => (o === 'ADD' && /-b\d+fp\)$/.test(a) ? [o, m, a.replace(/\)$/, '+1)'), b] : [o, m, a, b])), /did not start at the probe/],
    [broken('finisher-outward', (l, o, m, a, b) => (l === 'fWrap' ? [o, m, a.replace(/\)$/, '-1)'), b] : [o, m, a, b])), /wrote over its own warrior/],
    [broken('finisher-outward', (l, o, m, a, b) => (l === 'oBack' ? [o, m, a, b.replace('<', '@')] : [o, m, a, b])), /did not start at the probe|did not spread outward/],
  ];
  for (const [tree, re] of outCases) for (const rules of ['88', '94nop']) {
    assert.throws(() => buildTree(seq({ id: 'opening-bomber' }, tree), { rules }), re, `${tree.id} on ${rules}`);
  }
});
