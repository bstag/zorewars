// fang-vampire and probe-verdict (tools/algebra/blocks/hillvamp.js).
import test from 'node:test';
import assert from 'node:assert/strict';

const { buildTree, treeMismatches, leaves, shape } = await import('../tools/algebra/index.js');
const { link } = await import('../tools/algebra/link.js');
const { recipeSettings } = await import('../tools/blocks/recipes.js');
const { compile, VM } = await import('../src/engine/index.js');

const NEW = ['94nop', 'lp', '94x'];
const seq = (...kids) => ({ id: 'seq', kids });
const ok = (tree, rules, planted = []) => {
  const built = buildTree(tree, { rules, length: 100 });
  assert.equal(built.verification.ok, true, `${shape(tree)} on ${rules}`);
  const scenarios = built.verification.observations.map((o) => o.scenario);
  for (const id of planted) assert.ok(scenarios.includes(`${id}: planted target`), `${shape(tree)} on ${rules}: no planted run for ${id}`);
  return built;
};
const vamp = (P) => ({ id: 'fang-vampire', ...(P ? { P: { ...leaves['fang-vampire'].defaults, ...P } } : {}) });

// A copy of a block whose emitted code is altered by `f`, to show its watch notices.
let copies = 0;
function broken(id, f) {
  const orig = leaves[id], nid = `broken${++copies}-${id}`;
  leaves[nid] = { ...orig, id: nid, emit: (ctx) => orig.emit({ ...ctx, ins: (l, o, m, a, b = '0') => ctx.ins(l, ...f(l, o, m, a, b)) }) };
  const scenarioFix = (api) => ({ ...api, scenario: api.scenario.replace(nid, id) });
  leaves[nid].watch = (api) => orig.watch(scenarioFix(api));
  if (orig.plant) leaves[nid].plant = (api) => orig.plant(scenarioFix(api));
  return { id: nid };
}

test('fang-vampire builds with every pit on every rule set it supports', () => {
  for (const rules of NEW) for (const PIT of [0, 1, 2, 3]) ok(vamp({ PIT }), rules, ['fang-vampire']);
  for (const rules of NEW) ok(vamp({ PIT: 0, RELAY: 2000 }), rules, ['fang-vampire']);
  ok(vamp({ PIT: 1, RELAY: 3001, STEP: 3359 }), '94nop', ['fang-vampire']);
});

test('fang-vampire follows an opening', () => {
  for (const rules of NEW) {
    ok(seq({ id: 'opening-qscan-mul' }, vamp()), rules, ['opening-qscan-mul', 'fang-vampire']);
    ok(seq({ id: 'decoy-maker' }, vamp({ PIT: 3 })), rules, ['fang-vampire']);
  }
});

// The fang itself, cell by cell: after every ADD.F the fang's A and B fields
// still sum to the pit, so a copy dropped on the scanned cell leads home.
test('fang-vampire keeps A + B on the pit as it scans, and the copy jumps into the pit', () => {
  for (const [rules, PIT, RELAY] of [['94nop', 0, 0], ['94x', 2, 0], ['94nop', 1, 2000]]) {
    const settings = recipeSettings(rules, 100), core = settings.coreSize;
    const P = { ...leaves['fang-vampire'].defaults, PIT, RELAY };
    const l = link({ id: 'fang-vampire', P }, settings);
    const w = compile(l.source, 'redcode', settings);
    const at = (name) => l.labels[Object.keys(l.labels).find((k) => k.endsWith(name))];
    const fang = at('vFang'), aim = (at('vPit') + RELAY) % core, look = at('vLook');
    const vm = new VM(settings); vm.load([w], { positions: [0] });
    let passes = 0;
    while (passes < 500) {
      const pc = vm.processes(0)[0];
      vm.step();
      if (pc !== look) continue;
      passes++;
      const f = vm.peek(fang);
      assert.equal((fang + f.a + f.b) % core, aim, `${rules} pass ${passes}: A + B left the pit`);
    }
    // A fang copied anywhere (as the bite does) jumps to the aim.
    const f = vm.peek(fang), s = (fang + f.b) % core;
    assert.equal((s + f.a) % core, aim);
  }
});

test('the Unpit sentinel kills its prisoner far away and counts it', () => {
  const settings = recipeSettings('94nop', 100);
  const P = { ...leaves['fang-vampire'].defaults, PIT: 3 };
  const l = link({ id: 'fang-vampire', P }, settings);
  const w = compile(l.source, 'redcode', settings);
  const at = (name) => l.labels[Object.keys(l.labels).find((k) => k.endsWith(name))];
  const fang = w.instructions[at('vFang')], sent = at('vSent');
  // Two prisoners run a fang copy planted 4000 away; each dies, each bumps X.A.
  const s = 4000, copy = { ...fang, a: (sent - s + 8000) % 8000 };
  const them = { name: 'victims', instructions: [{ op: 'SPL', mod: 'B', aMode: '$', a: 1, bMode: '$', b: 0 }, { op: 'JMP', mod: 'B', aMode: '$', a: s - 3001 - 1, bMode: '$', b: 0 }], start: 0 };
  const vm = new VM(settings);
  vm.load([w, them], { positions: [0, 3001] });
  vm.poke(s, copy);
  while (!vm.done && vm.cycle < 200) vm.step();
  assert.equal(vm.warriors[1].alive, false, 'the prisoners should be dead');
  assert.equal(vm.peek(sent).a, P.KILL + 2, 'the sentinel counts both prisoners');
});

test('bad fang-vampire settings are refused', () => {
  const s94 = recipeSettings('94nop'), s88 = recipeSettings('88'), slp = recipeSettings('lp');
  const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  has(vamp(), s88, /fang-vampire needs ICWS'94/);
  has(vamp({ STEP: 2000 }), s94, /scans only 4 cells/);
  has(vamp({ PIT: 3, RELAY: 2000 }), s94, /RELAY must be 0/);
  has(vamp({ RELAY: 50 }), s94, /relay lands/);
  has(vamp({ PIT: 3, KILL: 7500 }), s94, /kill zone/);
  has(vamp({ PIT: 2, HOLD: 8 }), slp, /can never all arrive/);
  // A clear can't share the core with partners.
  assert.ok(treeMismatches({ id: 'par', kids: [vamp(), { id: 'stone' }] }, s94).length > 0);
});

test('the fang-vampire watch catches a broken mechanism', () => {
  const rules = { rules: '94nop', length: 100 };
  // The fang's A-field off by one: copies no longer lead to the pit.
  const off = broken('fang-vampire', (l, o, m, a, b) => (l === 'vFang' ? [o, m, `${a}+1`, b] : [o, m, a, b]));
  assert.throws(() => buildTree(off, rules), /does not lead to its pit/);
  // Only the A-field steps: the pair stops summing to the pit.
  const half = broken('fang-vampire', (l, o, m, a, b) => (l === 'vLoop' ? [o, 'A', a, b] : [o, m, a, b]));
  assert.throws(() => buildTree(half, rules), /does not lead to its pit|ignored the planted|did not finish its prisoner/);
  // A signal check that always fires: it switches to the clear with no prisoner.
  const eager = broken('fang-vampire', (l, o, m, a, b) => (l === 'vCheck' ? ['JMN', m, a, b] : [o, m, a, b]));
  assert.throws(() => buildTree(eager, rules), /with no prisoner/);
  // A stun pit that never splits nor marks: the clear never starts and the prisoner lives.
  const dud = broken('fang-vampire', (l, o, m, a, b) => (l === 'vPit' ? ['JMP', 'B', '$0', '0'] : [o, m, a, b]));
  assert.throws(() => buildTree(dud, rules), /did not finish its prisoner|never switched/);
});

test('probe-verdict hands on found-nothing / lone / body', () => {
  for (const rules of NEW) {
    ok(seq({ id: 'opening-qscan-mul' }, { id: 'probe-verdict' }, { id: 'finisher-guarded' }), rules, ['opening-qscan-mul', 'probe-verdict']);
    ok(seq({ id: 'opening-qscan-decode' }, { id: 'probe-verdict', P: { NEAR: 4 } }, { id: 'mod-stone' }), rules, ['probe-verdict']);
  }
  // Cell by cell: the verdict for nothing, a lone marker, and a marker with a neighbour.
  const settings = recipeSettings('94nop', 100);
  const built = buildTree(seq({ id: 'opening-qscan-mul' }, { id: 'probe-verdict' }, { id: 'mod-stone' }), { rules: '94nop', length: 100 });
  const w = compile(built.source, 'redcode', settings);
  const verdictAt = built.labels[Object.keys(built.labels).find((k) => k.endsWith('verdict'))];
  const run = (cells) => {
    const vm = new VM(settings); vm.load([w], { positions: [0] });
    for (const c of cells) vm.poke(c, { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 7 });
    vm.run(150);
    return vm.peek(verdictAt).b;
  };
  // The MUL quickscan's first SEQ location (unit 0, B side) relative to its probe at cell 0.
  const P = leaves['opening-qscan-mul'].defaults, b = (1 + P.QFAC) % 8000 + P.GAP;
  assert.equal(run([]), 0, 'nothing found');
  assert.equal(run([b]), 1, 'a lone cell');
  assert.equal(run([b, b + 2]), 2, 'a cell with a neighbour');
  assert.equal(run([b, b + 3]), 1, 'a neighbour beyond NEAR does not count');
});

test('bad probe-verdict settings are refused and its watch catches a wrong verdict', () => {
  const s94 = recipeSettings('94nop');
  assert.ok(treeMismatches(seq({ id: 'probe-verdict' }, { id: 'mod-stone' }), s94).some((m) => /nothing provides a probe/.test(m)));
  assert.ok(treeMismatches(seq({ id: 'probe-verdict' }, { id: 'mod-stone' }), recipeSettings('88')).some((m) => /needs ICWS'94/.test(m)));
  const blind = broken('probe-verdict', (l, o, m, a, b) => (o === 'MOV' && a === '#2' ? [o, m, '#1', b] : [o, m, a, b]));
  assert.throws(() => buildTree(seq({ id: 'opening-qscan-mul' }, blind, { id: 'mod-stone' }), { rules: '94nop', length: 100 }), /called a body 1/);
});
