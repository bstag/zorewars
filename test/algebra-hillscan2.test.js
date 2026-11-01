// Tests for the hillscan2 blocks (trap-scanner, finisher-overwrite, oneshot-cobra-imp).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, treeMismatches, leaves, shape } from '../tools/algebra/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';
import { compile, VM } from '../src/engine/index.js';

const NEW = ['94nop', 'lp', '94x'];
const seq = (...kids) => ({ id: 'seq', kids });
const mod = (x, core) => ((x % core) + core) % core;
const M = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };

const ok = (tree, rules, planted = []) => {
  const built = buildTree(tree, { rules, length: 100 });
  assert.equal(built.verification.ok, true, `${shape(tree)} on ${rules}`);
  const scenarios = built.verification.observations.map((o) => o.scenario);
  for (const id of planted) assert.ok(scenarios.includes(`${id}: planted target`), `${shape(tree)} on ${rules}: no planted run for ${id}`);
  return built;
};

const qmul = { id: 'opening-qscan-mul' };
const cmpscan = { id: 'opening-cmpscan', P: { SSTEP: 3044, GAP: 5, START: 700, SCANS: 64 } };

test('blocks load with working defaults', () => {
  for (const id of ['trap-scanner', 'finisher-overwrite', 'oneshot-cobra-imp']) {
    assert.ok(leaves[id], id);
    assert.equal(typeof leaves[id].watch, 'function', id);
  }
  assert.equal(typeof leaves['trap-scanner'].plant, 'function');
  assert.equal(typeof leaves['oneshot-cobra-imp'].plant, 'function');
});

test('trap-scanner traps the planted target and becomes a clear, alone, booted and behind a quickscan', () => {
  for (const rules of NEW) {
    ok({ id: 'trap-scanner' }, rules, ['trap-scanner']);
    ok({ id: 'boot', P: { HOP: 3000 }, kids: [{ id: 'trap-scanner' }] }, rules, ['trap-scanner']);
    ok(seq(qmul, { id: 'trap-scanner' }), rules, ['trap-scanner', 'opening-qscan-mul']);
    ok({ id: 'trap-scanner', P: { STEP: 3031, HITS: 6, SELF: 3, ROOM: 20 } }, rules, ['trap-scanner']);
  }
});

test('finisher-overwrite clears pass after pass behind a scan and a quickscan', () => {
  for (const rules of NEW) {
    ok(seq(cmpscan, { id: 'finisher-overwrite' }), rules);
    ok(seq(qmul, { id: 'finisher-overwrite' }), rules, ['opening-qscan-mul']);
    ok(seq(qmul, { id: 'finisher-overwrite', P: { SPLS: 0, PUMP: 0 } }), rules);
    ok(seq(qmul, { id: 'finisher-overwrite', P: { SPLS: 3, PUMP: 0 } }), rules);
    ok({ id: 'boot', kids: [seq(qmul, { id: 'finisher-overwrite' })] }, rules);
  }
});

test('oneshot-cobra-imp commits, spins off its imp and clears, alone, booted and behind a quickscan', () => {
  for (const rules of NEW) {
    ok({ id: 'oneshot-cobra-imp' }, rules, ['oneshot-cobra-imp']);
    ok(seq(qmul, { id: 'oneshot-cobra-imp' }), rules, ['oneshot-cobra-imp']);
    ok({ id: 'oneshot-cobra-imp', P: { STEP: 2341, GAP: 6, ROOM: 300, IGAP: 30 } }, rules, ['oneshot-cobra-imp']);
  }
  ok({ id: 'boot', P: { HOP: 3000 }, kids: [{ id: 'oneshot-cobra-imp' }] }, 'lp', ['oneshot-cobra-imp']);
});

test('bad settings are refused', () => {
  const s94 = recipeSettings('94nop'), s88 = recipeSettings('88');
  const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  has({ id: 'trap-scanner' }, s88, /ICWS'94/);
  has({ id: 'oneshot-cobra-imp' }, s88, /ICWS'94/);
  has(seq(cmpscan, { id: 'finisher-overwrite' }), s88, /ICWS'94/);
  has({ id: 'trap-scanner', P: { STEP: 2341, HITS: 24, SELF: 8, ROOM: 4000 } }, s94, /no room/);
  has({ id: 'oneshot-cobra-imp', P: { STEP: 19, GAP: 10, ROOM: 4000, IGAP: 4 } }, s94, /no room/);
  has({ id: 'finisher-overwrite' }, s94, /nothing provides a probe/);
  has(seq(cmpscan, { id: 'finisher-overwrite' }), { ...s94, maxProcesses: 1 }, /PUMP needs/);
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
const keep = (l, o, m, a, b) => [o, m, a, b];
const nop = ['NOP', 'F', '$0', '$0'];

test('the watches catch a broken mechanism', () => {
  const build = (tree) => () => buildTree(tree, { rules: '94nop', length: 100 });
  // trap-scanner: the third trap cell gets a SPL instead of the JMP back.
  const tb = broken('trap-scanner', (l, o, m, a, b) => (l === 'tW3' ? [o, m, a.replace(/tJmp$/, 'tSpl'), b] : [o, m, a, b]));
  assert.throws(build({ id: tb.id }), /SPL, SPL, JMP|other than its trap/, tb.id);
  // finisher-overwrite: the first bomb's skip is one short, so its wrap writes the image's last cell.
  const fb = broken('finisher-overwrite', (l, o, m, a, b) => (l === 'b0' ? [o, m, a, `${b}-1`] : [o, m, a, b]));
  assert.throws(build(seq(cmpscan, fb)), /its own warrior|bomb/, fb.id);
  // oneshot-cobra-imp: no imp is started at the find.
  const nb = broken('oneshot-cobra-imp', (l, ...r) => (l === 'spin' ? nop : keep(l, ...r)));
  assert.throws(build({ id: nb.id }), /did not spin off its imp/, nb.id);
  // oneshot-cobra-imp with its imp started at the image's first cell instead of
  // past its end: the imp crawls over the warrior, and the watch says so.
  const toStart = (x) => x.replace(/^\((\d+)\+(\d+)-/, '(0-');
  const ib = broken('oneshot-cobra-imp', (l, o, m, a, b) => (l === 'launch' ? [o, m, a, toStart(b)] : l === 'spin' ? [o, m, toStart(a), b] : [o, m, a, b]));
  assert.throws(build({ id: ib.id }), /imp reached the warrior|its own warrior/, ib.id);
});

// Build a single tree, load it alone at 0, return the VM, compiled warrior and local labels.
function load(tree, rules = '94nop', extra = []) {
  const settings = recipeSettings(rules, 100);
  const built = buildTree(tree, { rules, length: 100 });
  const w = compile(built.source, 'redcode', settings);
  assert.ok(w.ok, JSON.stringify(w.errors));
  const ws = [w, ...extra.map(([src]) => compile(src, 'redcode', settings))];
  const vm = new VM(settings);
  vm.load(ws, { positions: [0, ...extra.map(([, at]) => at)] });
  return { vm, w, built, settings, core: settings.coreSize };
}
const local = (built, ns, name) => built.labels[ns + name];
// The nth in-range look of a scanner (ptr + B0 + k STEP) with lo..hi clear of the warrior's len cells.
function nthLook(w, ptr, step, core, len, lo, hi, nth = 3) {
  let found = 0;
  for (let k = 1; k < 5000; k++) {
    const c = mod(ptr + w.instructions[ptr].b + k * step, core);
    let clear = true;
    for (let j = lo; j <= hi && clear; j++) if (mod(c + j, core) < len) clear = false;
    if (clear && ++found === nth) return c;
  }
  return -1;
}

test('trap-scanner captures every process of a warrior it finds, then its clear kills them', () => {
  // A one-cell opponent (JMP 0, #1: runs in place; its B-field makes it visible)
  // sits on the third cell the scan looks at.
  const probe = load({ id: 'trap-scanner' });
  const ptr = local(probe.built, 'b0', 'ptr'), core = probe.core;
  const c = nthLook(probe.w, ptr, 2341, core, probe.w.instructions.length, -4, 12);
  const { vm } = load({ id: 'trap-scanner' }, '94nop', [['JMP.B $0, #1', c]]);
  const tW3 = local(probe.built, 'b0', 'tW3');
  let trappedAt = null;
  while (!vm.done && trappedAt === null) { if (vm.processes(0)[0] === tW3) trappedAt = vm.cycle; vm.step(); }
  assert.ok(trappedAt !== null, 'the trap was laid');
  vm.run(vm.cycle + 400);
  const theirs = vm.processes(1);
  assert.ok(theirs.length > 4, `the trapped warrior multiplied (${theirs.length} processes)`);
  assert.ok(theirs.every((q) => mod(q - c, core) <= 2), 'every enemy process is inside the three trap cells');
  vm.run();
  assert.equal(vm.warriors[1].alive, false, 'the clear killed the prisoners');
  assert.equal(vm.warriors[0].alive, true);
});

test('finisher-overwrite runs SPL, SPL, then DAT passes, each started by the write over its pointer', () => {
  // Nothing to find: the clear starts at the image boundary. One process.
  const tree = seq(qmul, { id: 'finisher-overwrite', P: { SPLS: 2, PUMP: 0 } });
  const { vm, w, built, core } = load(tree);
  const len = w.instructions.length;
  const ns = Object.keys(built.labels).find((l) => l.endsWith('payload')).slice(0, -'payload'.length);
  const bomb = (name) => w.instructions[local(built, ns, name)];
  const same = (a, b) => ['op', 'mod', 'aMode', 'bMode'].every((k) => a[k] === b[k]) && mod(a.a, core) === mod(b.a, core) && mod(a.b, core) === mod(b.b, core);
  const chain = ['b0', 'b1', 'bd'].map(bomb), wraps = [];
  while (!vm.done && wraps.length < 4 && vm.cycle < 80000) {
    vm.step();
    // A wrap: the probe (the first state cell) is exactly one of the bombs.
    const k = chain.findIndex((b) => same(vm.peek(0), b));
    if (k < 0 || wraps.at(-1)?.cycle === vm.cycle - 1 && wraps.at(-1).k === k && same(vm.peek(0), wraps.at(-1).p)) continue;
    wraps.push({ cycle: vm.cycle, k, p: vm.peek(0) });
    // At each wrap everything outside the image holds that pass's bomb.
    for (let c = len; c < core; c++) assert.ok(same(vm.peek(c), chain[k]), `wrap ${wraps.length}: cell ${c} is not its bomb`);
  }
  assert.deepEqual(wraps.map((x) => x.k), [0, 1, 2, 2], 'the pointer was overwritten by SPL, SPL, DAT, DAT');
  for (let i = local(built, ns, 'payload'); i < len; i++) assert.ok(same(vm.peek(i), w.instructions[i]), `finisher cell ${i} intact`);
});

function cobraImpRun(killClearAfter) {
  const probe = load({ id: 'oneshot-cobra-imp' });
  const { built, w, core } = probe, ptr = local(built, 'b0', 'ptr'), len = w.instructions.length;
  const c = nthLook(w, ptr, 19, core, len, -14, 8);
  const { vm } = load({ id: 'oneshot-cobra-imp' });
  vm.poke(c, M); vm.poke(c + 1, M);
  const commit = local(built, 'b0', 'commit');
  let committed = null;
  while (!vm.done && vm.cycle < 80000) {
    if (committed === null && vm.processes(0)[0] === commit) committed = vm.cycle;
    if (committed !== null && killClearAfter !== null && vm.cycle === committed + killClearAfter) {
      for (let i = 0; i < len; i++) vm.poke(i, { op: 'DAT', mod: 'F', aMode: '#', a: 0, bMode: '#', b: 0 });
    }
    vm.step();
  }
  return { vm, w, len, committed, core, imp: w.instructions[local(built, 'b0', 'imp')] };
}

test('oneshot-cobra-imp: if the clear is killed the imp keeps the warrior alive; if not, the clear catches the imp', () => {
  const isImp = (x, imp) => x.op === imp.op && x.mod === imp.mod && x.aMode === imp.aMode && x.bMode === imp.bMode && x.b === imp.b;
  const killed = cobraImpRun(40);
  assert.ok(killed.committed !== null);
  assert.equal(killed.vm.warriors[0].alive, true, 'the imp survived the dead clear');
  assert.ok(killed.vm.processes(0).every((q) => isImp(killed.vm.peek(q), killed.imp)), 'only imps run');
  const intact = cobraImpRun(null);
  assert.equal(intact.vm.warriors[0].alive, true);
  for (let i = 0; i < intact.len; i++) if (!isImp(intact.w.instructions[i], intact.imp)) assert.ok(!isImp(intact.vm.peek(i), intact.imp), `the imp never reached image cell ${i}`);
  assert.ok(!intact.vm.processes(0).some((q) => isImp(intact.vm.peek(q), intact.imp)), 'the clear caught the imp');
});
