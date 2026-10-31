// opening-qscan-mul45, opening-qscan-qi, airbag-vampire and djn-vampire
// (tools/algebra/blocks/hillqv.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, treeMismatches, leaves, shape } from '../tools/algebra/index.js';
import { link } from '../tools/algebra/link.js';
import { recipeSettings } from '../tools/blocks/recipes.js';
import { compile, VM } from '../src/engine/index.js';
import { m45Cells, qiCells } from '../tools/algebra/blocks/hillqv.js';

const NEW = ['94nop', 'lp', '94x'];
const seq = (...kids) => ({ id: 'seq', kids });
const ok = (tree, rules, planted = []) => {
  const built = buildTree(tree, { rules, length: 100 });
  assert.equal(built.verification.ok, true, `${shape(tree)} on ${rules}`);
  const scenarios = built.verification.observations.map((o) => o.scenario);
  for (const id of planted) assert.ok(scenarios.includes(`${id}: planted target`), `${shape(tree)} on ${rules}: no planted run for ${id}`);
  return built;
};
const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));

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

// An opening's hand-on, cell by cell: plant a marker on `cell` (or nothing)
// and read the probe (the first state cell) once the opening has run.
const compiled = new Map();
function hands(id, P, rules, cell) {
  const settings = recipeSettings(rules, 100), key = JSON.stringify([id, P, rules]);
  if (!compiled.has(key)) compiled.set(key, compile(link(seq({ id, P }, { id: 'mod-stone' }), settings).source, 'redcode', settings));
  const w = compiled.get(key);
  const vm = new VM(settings);
  vm.load([w], { positions: [0] });
  if (cell !== null) vm.poke(cell, { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 7 });
  vm.run(60);
  return vm.peek(0).b;
}

const Q45 = 'opening-qscan-mul45', QI = 'opening-qscan-qi';

test('the quickscans decode every cell they test, and hand on the boundary when nothing is there', () => {
  const cases = [[Q45, '94nop', leaves[Q45].defaults], [Q45, '94x', leaves[Q45].defaults], [Q45, '94nop', { QFAC: 1577, GAP: 765, UNITS: 7, UNITS2: 2 }],
    [QI, '94nop', leaves[QI].defaults], [QI, '94x', leaves[QI].defaults], [QI, '94nop', { ...leaves[QI].defaults, UNITS: 6 }]];
  for (const [id, rules, P] of cases) {
    const core = recipeSettings(rules, 100).coreSize, cells = (id === Q45 ? m45Cells : qiCells)(P, core);
    assert.equal(new Set(cells).size, cells.length);
    for (const cell of cells) assert.equal(hands(id, P, rules, cell), cell, `${id} ${rules} cell ${cell}`);
    const span = hands(id, P, rules, null);
    assert.ok(span > 0 && span <= 100, `${id} ${rules}: no hit should leave the boundary, got ${span}`);
  }
});

test('the quickscans lead a burst, a stone and a finisher on every rule set', () => {
  for (const rules of NEW) {
    for (const id of [Q45, QI]) {
      ok(seq({ id }, { id: 'probe-burst2' }, { id: 'mod-stone' }), rules, [id, 'probe-burst2']);
      ok(seq({ id }, { id: 'finisher-guarded' }), rules, [id]);
    }
  }
  ok(seq({ id: QI, P: { ...leaves[QI].defaults, UNITS: 5 } }, { id: 'finisher-outward' }), '94nop', [QI]);
  ok({ id: 'boot', kids: [seq({ id: Q45 }, { id: 'probe-burst2' }, { id: 'mod-stone' })] }, '94nop');
});

test('bad quickscan settings are refused', () => {
  const s94 = recipeSettings('94nop'), s88 = recipeSettings('88');
  has(seq({ id: Q45, P: { ...leaves[Q45].defaults, QFAC: 350 } }, { id: 'mod-stone' }), s94, /no inverse/);
  has(seq({ id: Q45, P: { ...leaves[Q45].defaults, UNITS: 4, UNITS2: 5 } }, { id: 'mod-stone' }), s94, /UNITS2 must not exceed/);
  has(seq({ id: Q45, P: { QFAC: 349, GAP: 197, UNITS: 12, UNITS2: 6 } }, { id: 'mod-stone' }), s94, /lands on or next to|same cell/);
  has(seq({ id: QI, P: { ...leaves[QI].defaults, FB: leaves[QI].defaults.FA } }, { id: 'mod-stone' }), s94, /same cell|lands on/);
  has(seq({ id: QI }, { id: 'mod-stone' }), s88, /needs ICWS'94/);
});

test('the quickscan watches catch a broken decoder', () => {
  const rules = { rules: '94nop', length: 100 };
  // q^4.5: the mutation no longer bumps the multiplier, so the second half decodes with QDEC.
  const m = broken(Q45, (l, o, m2, a, b) => (o === 'SEQ' && a.startsWith('>') ? [o, m2, a.replace(/^>/, '$'), b] : [o, m2, a, b]));
  assert.throws(() => buildTree(seq(m, { id: 'finisher-guarded' }), rules), /not the planted cell|did not hand on the image boundary/);
  // q^4.5: the second half picks the wrong entry (no `{sel`), so the MUL decodes another location.
  const s = broken(Q45, (l, o, m2, a, b) => (o === 'JMP' && b.startsWith('{') ? [o, m2, a, '$0'] : [o, m2, a, b]));
  assert.throws(() => buildTree(seq(s, { id: 'finisher-guarded' }), rules), /not the planted cell/);
  // q^i: no swap, so a hit on an A cell is handed on as the (empty) B cell.
  const q = broken(QI, (l, o, m2, a, b) => (o === 'MOV' && m2 === 'X' ? ['NOP', 'F', '$0', '$0'] : [o, m2, a, b]));
  assert.throws(() => buildTree(seq(q, { id: 'finisher-guarded' }), rules), /not the planted cell/);
});

// ---------------------------------------------------------------------------
// The vampires.
const AIR = 'airbag-vampire', DJN = 'djn-vampire';
const pick = ({ op, mod, aMode, a, bMode, b }, core) => ({ op, mod, aMode, a: ((a % core) + core) % core, bMode, b: ((b % core) + core) % core });
const lab = (l, name) => l.labels[Object.keys(l.labels).find((k) => k.endsWith(name))];

test('the vampires build bare and behind a quickscan on every rule set they support', () => {
  for (const rules of NEW) {
    for (const id of [AIR, DJN]) {
      ok({ id }, rules);
      ok(seq({ id: 'opening-qscan-mul' }, { id }), rules, ['opening-qscan-mul']);
    }
  }
  ok({ id: AIR, P: { STEP: 2392, G: 8 } }, '94nop');
  ok({ id: DJN, P: { STEP: 3359 } }, '94x');
  ok({ id: 'boot', kids: [seq({ id: 'opening-qscan-qi' }, { id: DJN })] }, '94nop');
});

test('the airbag loop runs three staggered processes and throws only onto its padding lattice', () => {
  for (const [rules, P] of [['94nop', leaves[AIR].defaults], ['94x', { STEP: 2392, G: 8 }]]) {
    const settings = recipeSettings(rules, 100), core = settings.coreSize;
    const l = link({ id: AIR, P }, settings), w = compile(l.source, 'redcode', settings);
    const fang = lab(l, 'vFang'), pit = lab(l, 'vPit'), loop = lab(l, 'vLoop'), chk = lab(l, 'vChk');
    const vm = new VM(settings); vm.load([w], { positions: [0] });
    vm.run(30);
    const ps = vm.processes(0);
    assert.equal(ps.length, 3, `${rules}: three processes`);
    assert.equal(new Set(ps).size, 3, `${rules}: staggered`);
    for (const q of ps) assert.ok(q >= loop && q <= chk, `${rules}: every process in the loop`);
    assert.equal(vm.peek(chk).a, core - 3, `${rules}: the launch rewrote the closing JMP to -3`);
    for (let n = 0; n < 3000; n++) {
      const pc = vm.processes(0)[0], f = vm.peek(fang);
      vm.step();
      assert.equal((fang + f.a + f.b) % core, pit, `${rules}: A + B left the pit`);
      if (pc !== loop + 1) continue;
      const t = (fang + f.b) % core;
      if (t < l.total) assert.equal((t - fang + core) % P.G, 1, `${rules}: a throw at ${t} is off the padding lattice`);
    }
  }
});

test('the djn-vampire guard keeps every DJN bomb off its own code', () => {
  for (const rules of ['94nop', '94x']) {
    const settings = recipeSettings(rules, 100);
    const l = link({ id: DJN, P: leaves[DJN].defaults }, settings), w = compile(l.source, 'redcode', settings);
    const vm = new VM(settings); vm.load([w], { positions: [0] });
    vm.run(40000);
    const moving = new Set(['vFang'].map((n) => lab(l, n)));
    for (let c = 0; c < l.total; c++) if (!moving.has(c)) assert.deepEqual(pick(vm.peek(c), settings.coreSize), pick(w.instructions[c], settings.coreSize), `${rules}: cell ${c} changed`);
    let djns = 0;
    for (let c = l.total; c < settings.coreSize; c++) if (vm.peek(c).op === 'DJN') djns++;
    assert.ok(djns > 1000, `${rules}: only ${djns} DJN bombs thrown`);
  }
});

test('bad vampire settings are refused', () => {
  const s94 = recipeSettings('94nop'), s88 = recipeSettings('88');
  has({ id: AIR, P: { STEP: 2396, G: 5 } }, s94, /not a multiple of G/);
  has({ id: AIR, P: { STEP: 2394, G: 7 } }, s94, /does not divide the core/);
  has({ id: AIR, P: { STEP: 2000, G: 5 } }, s94, /throws at only/);
  has({ id: DJN, P: { STEP: 2000 } }, s94, /scans only 4 cells/);
  has({ id: DJN }, s88, /needs ICWS'94/);
  assert.ok(treeMismatches({ id: 'par', kids: [{ id: AIR }, { id: 'stone' }] }, s94).length > 0);
});

test('the vampire watches catch a broken mechanism', () => {
  const rules = { rules: '94nop', length: 100 };
  // Only two processes launched: the loop is not run by three.
  const two = broken(AIR, (l, o, m, a, b) => (l === '' && o === 'SPL' ? ['NOP', 'F', '$0', '$0'] : [o, m, a, b]));
  assert.throws(() => buildTree(two, rules), /three staggered|too few/);
  // The fang's A-field off by one: its copies miss the pit.
  const off = broken(AIR, (l, o, m, a, b) => (l === 'vFang' ? [o, m, `${a}+1`, b] : [o, m, a, b]));
  assert.throws(() => buildTree(off, rules), /does not lead to its pit/);
  // No guard before the DJN throw: it lands on the vampire.
  const bare = broken(DJN, (l, o, m, a, b) => (o === 'SLT' && m === 'B' ? ['NOP', 'F', '$0', '$0'] : [o, m, a, b]));
  assert.throws(() => buildTree(bare, rules), /onto its own warrior|did not survive|stopped running/);
  // A pit check that always fires: the clear starts with no prisoner.
  const eager = broken(DJN, (l, o, m, a, b) => (l === 'vCheck' ? ['JMN', m, a, b] : [o, m, a, b]));
  assert.throws(() => buildTree(eager, rules), /with no prisoner/);
});

test('djn-vampire is refused after linking unless it ends what it protects', () => {
  for (const tree of [{ id: 'image', kids: [{ id: 'djn-vampire' }, { id: 'decoys' }] }, { id: 'fork', kids: [{ id: 'opening-qscan-mul' }, { id: 'djn-vampire' }, { id: 'silk-imps' }] }]) {
    assert.throws(() => buildTree(tree, { rules: '94nop', length: 100 }), /must be the last block of what it protects/);
  }
  assert.equal(buildTree({ id: 'boot', P: { HOP: 3000 }, kids: [{ id: 'djn-vampire' }, { id: 'decoys' }] }, { rules: '94nop', length: 100 }).verification.ok, true);
});
