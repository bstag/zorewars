import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, treeMismatches, leaves, shape } from '../tools/algebra/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';

const ALL = ['88', '94nop', 'lp', '94x'], NEW = ['94nop', 'lp', '94x'];
const seq = (...kids) => ({ id: 'seq', kids });
const ok = (tree, rules, planted = []) => {
  const built = buildTree(tree, { rules, length: 100 });
  assert.equal(built.verification.ok, true, `${shape(tree)} on ${rules}`);
  const scenarios = built.verification.observations.map((o) => o.scenario);
  for (const id of planted) assert.ok(scenarios.includes(`${id}: planted target`), `${shape(tree)} on ${rules}: no planted run for ${id}`);
  return built;
};

const qdec = { id: 'opening-qscan-decode' }, qscan = { id: 'opening-quickscan' };
const lattice = { id: 'opening-qscan-lattice' };
const sne = { id: 'opening-sne' }, none = { id: 'opening-none' };
const stone = { id: 'mod-stone' }, guarded = { id: 'finisher-guarded' };

test('blocks load with working defaults', () => {
  for (const id of ['probe-burst', 'decoy-maker']) {
    assert.ok(leaves[id], id);
    assert.equal(typeof leaves[id].watch, 'function', id);
  }
  assert.equal(typeof leaves['probe-burst'].plant, 'function');
});

test('probe-burst bursts after a decoding opening and hands on to a body', () => {
  for (const rules of NEW) {
    ok(seq(qdec, { id: 'probe-burst' }, stone), rules, ['probe-burst']);
    ok(seq(qscan, { id: 'probe-burst' }, guarded), rules, ['probe-burst']);
    ok(seq(qdec, { id: 'probe-burst', P: { COUNT: 20, STEP: 12, OFFSET: 100, BOMB: 1 } }, stone), rules, ['probe-burst']);
  }
});

test('opening-qscan-lattice decodes the exact cell and leads finishers and a burst', () => {
  for (const rules of NEW) {
    ok(seq(lattice, guarded), rules, ['opening-qscan-lattice']);
    ok(seq(lattice, { id: 'probe-burst' }, stone), rules, ['opening-qscan-lattice', 'probe-burst']);
    ok(seq(lattice, { id: 'finisher-outward' }), rules, ['opening-qscan-lattice']);
    ok(seq({ id: 'opening-qscan-lattice', P: { START: 500, SPACING: 1000, FACTOR: 250, UNITS: 6 } }, guarded), rules, ['opening-qscan-lattice']);
  }
});

test('decoy-maker scatters then leads a seq', () => {
  for (const rules of ALL) ok(seq({ id: 'decoy-maker' }, stone), rules);
  for (const rules of NEW) {
    ok(seq({ id: 'decoy-maker' }, sne, guarded), rules);
    ok(seq({ id: 'decoy-maker' }, guarded), rules);
  }
});

test('bad settings are refused', () => {
  const s94 = recipeSettings('94nop'), s88 = recipeSettings('88');
  const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  has(seq(qdec, { id: 'probe-burst' }, stone), s88, /probe-burst needs ICWS'94/);
  has(seq(qdec, { id: 'probe-burst', P: { COUNT: 40, STEP: 100, OFFSET: 0, BOMB: 0 } }, stone), s94, /wrap into the warrior/);
  has(seq({ id: 'decoy-maker', P: { COUNT: 8, DIST: 10, SPREAD: 40 } }, stone), s94, /starts inside the warrior/);
  has(seq({ id: 'probe-burst' }, stone), s94, /nothing provides a probe/);
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

test('the watches catch a broken mechanism', () => {
  // probe-burst: a burst of one bomb too few.
  const pb = broken('probe-burst', (l, o, m, a, b) => (l === '' && o === 'MOV' && m === 'AB' && a === '#12' ? [o, m, '#11', b] : [o, m, a, b]));
  assert.throws(() => buildTree(seq(qdec, pb, stone), { rules: '94nop', length: 100 }), /not 12|ring around/, pb.id);
  // decoy-maker: a counter one short, so a decoy goes missing.
  const dm = broken('decoy-maker', (l, o, m, a, b) => (l === 'dMake' && o === 'MOV' && a === '#8' ? [o, m, '#7', b] : [o, m, a, b]));
  assert.throws(() => buildTree(seq(dm, stone), { rules: '94nop', length: 100 }), /not 8|wrong place/, dm.id);
  // lattice: the decoder resolves the second-cell hit through the wrong head, so it hands on the wrong cell.
  const lt = broken('opening-qscan-lattice', (l, o, m, a, b) => (l === 'dSecond' && o === 'MOV' ? [o, m, a.replace(/dpB$/, 'dpA'), b] : [o, m, a, b]));
  assert.throws(() => buildTree(seq(lt, guarded), { rules: '94nop', length: 100 }), /not the planted cell/, lt.id);
});
