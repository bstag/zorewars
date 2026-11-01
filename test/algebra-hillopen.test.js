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
  // An in-range distance wrapping onto the image exercises the overlap check.
  has(seq({ id: 'decoy-maker', P: { COUNT: 8, DIST: 8000, SPREAD: 40 } }, stone), s94, /decoy region runs on into the warrior/);
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

// opening-qscan-mul, cell by cell: plant a marker on each of the 4*UNITS cells
// in turn and check the opening hands on exactly that cell, through the MUL.
import { compile, VM } from '../src/engine/index.js';

function mulHands(P, rules, cell) {
  const settings = recipeSettings(rules, 100);
  const built = buildTree(seq({ id: 'opening-qscan-mul', P }, { id: 'mod-stone' }), { rules, length: 100 });
  const w = compile(built.source, 'redcode', settings);
  const vm = new VM(settings);
  vm.load([w], { positions: [0] });
  if (cell !== null) vm.poke(cell, { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 7 });
  vm.run(40 + P.UNITS * 3);
  return vm.peek(0).b;   // the probe is the first state cell
}

test('opening-qscan-mul decodes every cell it tests', () => {
  const core = (rules) => recipeSettings(rules, 100).coreSize;
  for (const [rules, P] of [['94nop', { QFAC: 349, GAP: 197, UNITS: 8 }], ['94nop', { QFAC: 1091, GAP: 197, UNITS: 10 }], ['94x', { QFAC: 349, GAP: 197, UNITS: 8 }]]) {
    const c = core(rules), inv = [...Array(c).keys()].find((x) => (P.QFAC * x) % c === 1), dec = (1 + inv) % c;
    const span = mulHands(P, rules, null);
    for (let k = 0; k < P.UNITS; k++) {
      const b = ((k + 1) * (1 + P.QFAC)) % c, a = (b + dec) % c;
      for (const cell of [a, (a + P.GAP) % c, b, (b + P.GAP) % c]) assert.equal(mulHands(P, rules, cell), cell, `${rules} unit ${k} cell ${cell}`);
    }
    assert.ok(span > 0 && span <= 100, `${rules}: no hit should leave the boundary, got ${span}`);
  }
});

test('opening-qscan-mul refuses a factor with no inverse and probes on itself', () => {
  const s94 = recipeSettings('94nop'), sx = recipeSettings('94x');
  const has = (P, settings, re) => assert.ok(treeMismatches(seq({ id: 'opening-qscan-mul', P }, stone), settings).some((m) => re.test(m)));
  has({ QFAC: 350, GAP: 197, UNITS: 8 }, s94, /no inverse/);
  has({ QFAC: 77, GAP: 197, UNITS: 8 }, sx, /no inverse/);      // 7 and 11 divide 55440
  has({ QFAC: 349, GAP: 197, UNITS: 13 }, s94, /lands on or next to|same cell/);
});

test('opening-qscan-mul leads a burst and a finisher, and its watch catches a wrong pair choice', () => {
  for (const rules of NEW) {
    ok(seq({ id: 'opening-qscan-mul' }, guarded), rules, ['opening-qscan-mul']);
    ok(seq({ id: 'opening-qscan-mul' }, { id: 'probe-burst' }, stone), rules, ['opening-qscan-mul', 'probe-burst']);
    ok(seq({ id: 'opening-qscan-mul', P: { QFAC: 1091, GAP: 197, UNITS: 10 } }, { id: 'finisher-outward' }), rules, ['opening-qscan-mul']);
  }
  // Always take the first cell of the pair: the planted second cell is missed.
  const mb = broken('opening-qscan-mul', (l, o, m, a, b) => (o === 'ADD' && m === 'AB' && a === '#197' ? [o, m, '#0', b] : [o, m, a, b]));
  assert.throws(() => buildTree(seq(mb, guarded), { rules: '94nop', length: 100 }), /not the planted cell/, mb.id);
});

// Under a boot the copy's quickscan may find the abandoned original (a decoy):
// the gate must judge the copy by its own cells and let a burst hit the dead
// original, but never the live copy.
test('booted quickscans and bursts pass the gate', () => {
  for (const rules of NEW) {
    for (const kids of [[{ id: 'opening-qscan-mul' }, stone], [{ id: 'opening-qscan-mul' }, { id: 'probe-burst' }, stone], [lattice, { id: 'probe-burst2' }, stone], [qdec, guarded]]) {
      assert.equal(buildTree({ id: 'boot', kids: [seq(...kids)] }, { rules, length: 100 }).verification.ok, true, `boot(${kids.map((k) => k.id).join(',')}) on ${rules}`);
    }
  }
});
