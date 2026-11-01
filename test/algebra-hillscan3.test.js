// Tests for the hillscan3 blocks (blur-carpet, twin-storm, scanner-mul).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, treeMismatches, leaves, shape } from '../tools/algebra/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';
import { compile, VM } from '../src/engine/index.js';

const NEW = ['94nop', 'lp', '94x'];
const seq = (...kids) => ({ id: 'seq', kids });
const mod = (x, core) => ((x % core) + core) % core;
const M = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };
const qmul = { id: 'opening-qscan-mul' };

const ok = (tree, rules, planted = []) => {
  const built = buildTree(tree, { rules, length: 100 });
  assert.equal(built.verification.ok, true, `${shape(tree)} on ${rules}`);
  const scenarios = built.verification.observations.map((o) => o.scenario);
  for (const id of planted) assert.ok(scenarios.includes(`${id}: planted target`), `${shape(tree)} on ${rules}: no planted run for ${id}`);
  return built;
};

test('blocks load with working defaults', () => {
  for (const id of ['blur-carpet', 'twin-storm', 'scanner-mul']) {
    assert.ok(leaves[id], id);
    assert.equal(typeof leaves[id].watch, 'function', id);
    assert.equal(typeof leaves[id].plant, 'function', id);
  }
});

test('blur-carpet carpets the planted target and clears, alone, booted and behind a quickscan', () => {
  for (const rules of NEW) {
    ok({ id: 'blur-carpet' }, rules, ['blur-carpet']);
    ok(seq(qmul, { id: 'blur-carpet' }), rules, ['blur-carpet', 'opening-qscan-mul']);
    ok({ id: 'blur-carpet', P: { STEP: 290, GAP: 7, BACK: 0, SCANS: 2000 } }, rules, ['blur-carpet']);
  }
  ok({ id: 'boot', P: { HOP: 3000 }, kids: [{ id: 'blur-carpet' }] }, '94nop', ['blur-carpet']);
});

test('twin-storm starts both engines and carpets the planted pair, alone and behind a quickscan', () => {
  for (const rules of NEW) {
    ok({ id: 'twin-storm' }, rules, ['twin-storm']);
    ok(seq(qmul, { id: 'twin-storm' }), rules, ['twin-storm', 'opening-qscan-mul']);
  }
  ok({ id: 'twin-storm', P: { FIRST: 600, HOP: 2400, STEP: 7, TIME: 300, D: 500, BOOT: 5000 } }, '94nop', ['twin-storm']);
});

test('scanner-mul bombs the planted target, alone and behind a quickscan', () => {
  for (const rules of NEW) {
    ok({ id: 'scanner-mul' }, rules, ['scanner-mul']);
    ok(seq(qmul, { id: 'scanner-mul' }), rules, ['scanner-mul', 'opening-qscan-mul']);
  }
  ok({ id: 'scanner-mul', P: { MULT: 7721, START: 7442, BOMB: 1 } }, '94nop', ['scanner-mul']);   // Russ Post's own multiplier
});

test('bad settings are refused', () => {
  const s94 = recipeSettings('94nop'), s88 = recipeSettings('88'), sx = recipeSettings('94x');
  const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  const none = (tree, settings) => assert.deepEqual(treeMismatches(tree, settings), []);
  for (const id of ['blur-carpet', 'twin-storm', 'scanner-mul']) has({ id }, s88, /ICWS'94/);
  has({ id: 'blur-carpet', P: { STEP: 70, GAP: 5, BACK: 2, SCANS: 4000 } }, s94, /SCANS/);
  has({ id: 'blur-carpet', P: { STEP: 4, GAP: 5, BACK: 2, SCANS: 800 } }, s94, /GAP must be less/);
  has({ id: 'twin-storm', P: { FIRST: 1000, HOP: 3000, STEP: 9, TIME: 333, D: 4500, BOOT: 7400 } }, s94, /other engine|half the core/);
  has({ id: 'twin-storm', P: { FIRST: 1000, HOP: 3000, STEP: 9, TIME: 333, D: 2000, BOOT: 7400 } }, s94, /reaches the other engine/);
  has({ id: 'twin-storm', P: { FIRST: 1000, HOP: 3000, STEP: 9, TIME: 333, D: 913, BOOT: 7950 } }, s94, /on the warrior/);
  // 7721 - 1 is a multiple of 2, 5 and 4 (8,000) but not of 3, 7 and 11 (55,440).
  none({ id: 'scanner-mul', P: { MULT: 7721, START: 1, BOMB: 0 } }, s94);
  has({ id: 'scanner-mul', P: { MULT: 7721, START: 1, BOMB: 0 } }, sx, /misses cells/);
  has({ id: 'scanner-mul', P: { MULT: 4623, START: 1, BOMB: 0 } }, s94, /misses cells/);
});

// A copy of a block whose emitted code is altered by `f`, to show its watch notices.
let copies = 0;
function broken(id, f, P) {
  const orig = leaves[id], nid = `broken${++copies}-${id}`;
  leaves[nid] = { ...orig, id: nid, emit: (ctx) => orig.emit({ ...ctx, ins: (l, o, m, a, b = '0') => ctx.ins(l, ...f(l, o, m, a, b)) }) };
  const scenarioFix = (api) => ({ ...api, scenario: api.scenario.replace(nid, id) });
  leaves[nid].watch = (api) => orig.watch(scenarioFix(api));
  leaves[nid].plant = (api) => orig.plant(scenarioFix(api));
  if (orig.running) leaves[nid].running = orig.running;
  return { id: nid, ...(P ? { P } : {}) };
}

test('the watches catch a broken mechanism', () => {
  const build = (tree) => () => buildTree(tree, { rules: '94nop', length: 100 });
  // blur-carpet: a find moves the carpet to the wrong cell (BACK off by 3).
  const bc = broken('blur-carpet', (l, o, m, a, b) => (l === '' && o === 'ADD' && m === 'AB' && a.includes('-2)') ? [o, m, a.replace(/-2\)$/, '-5)'), b] : [o, m, a, b]));
  assert.throws(build({ id: bc.id }), /did not move its carpet to the find/, bc.id);
  // twin-storm: the B pointer starts on the second engine instead of HOP past FIRST.
  const tw = broken('twin-storm', (l, o, m, a, b) => (l === 'ptr' ? [o, m, a, `${913 - 1}`] : [o, m, a, b]));
  assert.throws(build({ id: tw.id }), /bombed engine 2|other than its bomb/, tw.id);
  // twin-storm: the launcher never jumps into the second engine.
  const t2 = broken('twin-storm', (l, o, m, a, b) => (l === 'launch' ? ['DAT', 'F', '#0', '#0'] : [o, m, a, b]));
  assert.throws(build({ id: t2.id }), /did not start both engines|stopped running|never entered/, t2.id);
  // scanner-mul: an additive step instead of the multiplication.
  const sm = broken('scanner-mul', (l, o, m, a, b) => (l === 'sLoop' ? ['ADD', m, a, b] : [o, m, a, b]));
  assert.throws(build({ id: sm.id }), /not MULT times the last/, sm.id);
});

// Build a single tree, load it (and any opponents) and return the VM and labels.
function load(tree, rules = '94nop', extra = []) {
  const settings = recipeSettings(rules, 100);
  const built = buildTree(tree, { rules, length: 100 });
  const w = compile(built.source, 'redcode', settings);
  assert.ok(w.ok, JSON.stringify(w.errors));
  const vm = new VM(settings);
  vm.load([w, ...extra.map(([src]) => compile(src, 'redcode', settings))], { positions: [0, ...extra.map(([, at]) => at)] });
  return { vm, w, built, settings, core: settings.coreSize };
}
const local = (built, name) => built.labels[`b0${name}`];

test('blur-carpet drops one SPL a lap, moves its one carpet to a find, and its clear covers the core', () => {
  const { vm, w, built, core } = load({ id: 'blur-carpet' });
  const len = w.instructions.length, scan = local(built, 'scan'), loop = local(built, 'sLoop'), cGo = local(built, 'cGo');
  const isSpl = (x) => x.op === 'SPL';
  // A marker on the 6th pair's A cell (it is past the carpet's reach by then).
  const c = mod(scan + w.instructions[scan].a + 5 * 70, core);
  vm.poke(c, M);
  let laps = 0;
  while (vm.processes(0)[0] !== cGo) { if (vm.processes(0)[0] === loop) laps++; vm.step(); }
  assert.equal(laps, 800, 'SCANS laps, one bomb each');
  // The carpet: from the image's end for 6 laps (the find is in the 6th), then
  // from 2 cells before the marker for the other 794.
  for (let k = 0; k < 6; k++) assert.ok(isSpl(vm.peek(len + k)), `first carpet cell ${k}`);
  assert.ok(!isSpl(vm.peek(len + 6)), 'the first carpet stopped at the find');
  for (let k = -2; k < 794 - 2; k++) assert.ok(isSpl(vm.peek(c + k)), `carpet cell ${k} from the find`);
  let spls = 0;
  for (let i = len; i < core; i++) if (isSpl(vm.peek(i))) spls++;
  assert.equal(spls, 800, 'nothing but the carpet was bombed');
  vm.run(vm.cycle + 2 * core);
  for (let i = len; i < core; i++) assert.equal(vm.peek(i).op, 'DAT', `cell ${i} cleared`);
  for (let i = 0; i < len; i++) if (i) assert.equal(vm.peek(i).op, w.instructions[i].op, `image cell ${i} intact`);
});

test('scanner-mul visits every cell once a period, in no fixed stride', () => {
  const { vm, w, built, core } = load({ id: 'scanner-mul' });
  const ptr = local(built, 'ptr'), look = local(built, 'sLook'), seen = new Set(), strides = new Set();
  let last = null;
  while (seen.size < core && vm.cycle < 4 * core) {
    const at = vm.processes(0)[0] === look;
    vm.step();
    if (!at) continue;
    const c = mod(ptr + vm.peek(ptr).b, core);
    assert.ok(!seen.has(c), `cell ${c} looked at twice`);
    seen.add(c);
    if (last !== null && strides.size < 100) strides.add(mod(c - last, core));
    last = c;
  }
  assert.equal(seen.size, core, 'every cell looked at');
  assert.ok(strides.size > 90, 'the strides vary');
  assert.equal(vm.peek(local(built, 'bomb')).op, w.instructions[local(built, 'bomb')].op);
});

test('twin-storm: either engine scans on if the other is killed', () => {
  const tree = { id: 'twin-storm' };
  for (const victim of [0, 1]) {
    const { vm, built, core } = load(tree);
    const P = leaves['twin-storm'].defaults, cptr = local(built, 'cptr');
    const eng = [mod(cptr + P.BOOT, core), mod(cptr + P.BOOT + P.D, core)];
    const other = eng[1 - victim], optr = other + 1;
    vm.run(200);
    assert.ok(vm.processes(0).some((q) => mod(q - eng[0], core) < 13) && vm.processes(0).some((q) => mod(q - eng[1], core) < 13), 'both engines run');
    for (let i = 0; i < 13; i++) vm.poke(eng[victim] + i, { op: 'DAT', mod: 'F', aMode: '#', a: 0, bMode: '#', b: 0 });
    const before = mod(vm.peek(optr).a, core);
    vm.run(vm.cycle + 1000);
    assert.ok(mod(vm.peek(optr).a - before, core) > 100, 'the survivor kept scanning');
    vm.run();
    assert.equal(vm.warriors[0].alive, true);
  }
});
