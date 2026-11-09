// Tests for the hilloneshot blocks (finisher-oneshot, finisher-dclear-fwd, finisher-twopass-stream).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildTree, treeMismatches, leaves, shape } from '../tools/algebra/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';
import { compile, VM } from '../src/engine/index.js';

const NEW = ['94nop', 'lp', '94x'];
const seq = (...kids) => ({ id: 'seq', kids });
const fork = (a, b) => ({ id: 'fork', kids: [qmul, a, b] });
const mod = (x, core) => ((x % core) + core) % core;
const qmul = { id: 'opening-qscan-mul' };
const cmpscan = { id: 'opening-cmpscan', P: { SSTEP: 3044, GAP: 5, START: 700, SCANS: 64 } };
const os = (P) => ({ id: 'finisher-oneshot', ...(P ? { P: { ...leaves['finisher-oneshot'].defaults, ...P } } : {}) });
const dcf = (P) => ({ id: 'finisher-dclear-fwd', ...(P ? { P: { ...leaves['finisher-dclear-fwd'].defaults, ...P } } : {}) });
const tps = (P) => ({ id: 'finisher-twopass-stream', ...(P ? { P: { ...leaves['finisher-twopass-stream'].defaults, ...P } } : {}) });

const ok = (tree, rules, planted = []) => {
  const built = buildTree(tree, { rules, length: 100 });
  assert.equal(built.verification.ok, true, `${shape(tree)} on ${rules}`);
  const scenarios = built.verification.observations.map((o) => o.scenario);
  for (const id of planted) assert.ok(scenarios.includes(`${id}: planted target`), `${shape(tree)} on ${rules}: no planted run for ${id}`);
  return built;
};

test('blocks load with working defaults', () => {
  for (const id of ['finisher-oneshot', 'finisher-dclear-fwd', 'finisher-twopass-stream']) {
    assert.ok(leaves[id], id);
    assert.equal(typeof leaves[id].watch, 'function', id);
    for (const [k, [lo, hi]] of Object.entries(leaves[id].params)) assert.ok(leaves[id].defaults[k] >= lo && leaves[id].defaults[k] <= hi, `${id} ${k}`);
  }
  assert.equal(typeof leaves['finisher-oneshot'].plant, 'function');
});

test('finisher-oneshot passes over a lone cell, commits to the body and clears, behind a quickscan', () => {
  for (const rules of NEW) {
    ok(seq(qmul, os()), rules, ['opening-qscan-mul', 'finisher-oneshot']);
    for (const DETECT of [0, 1, 2]) ok(seq(qmul, os({ DETECT, IMP: 0 })), rules, ['finisher-oneshot']);
    ok(seq(qmul, os({ DETECT: 1, IMP: 2, BACK: 4, SPLS: 1 })), rules, ['finisher-oneshot']);
  }
  ok(seq(qmul, os({ PUMP: 0, SPLS: 0, IMP: 0, SCANS: 40 })), '94nop', ['finisher-oneshot']);
  ok(seq(cmpscan, os({ DETECT: 2 })), '94nop', ['finisher-oneshot']);
  ok(fork(os({ DETECT: 2, IMP: 0 }), { id: 'tail-silk' }), '94nop', ['opening-qscan-mul']);
});

test('finisher-dclear-fwd clears forward pass after pass, alone, behind a quickscan, booted and in a fork', () => {
  for (const rules of NEW) {
    ok(dcf(), rules);
    ok(seq(qmul, dcf()), rules, ['opening-qscan-mul']);
    ok(seq(qmul, dcf({ ANTI: 0, PUMP: 0 })), rules);
  }
  ok({ id: 'boot', kids: [seq(qmul, dcf())] }, '94nop');
  ok(fork(dcf(), { id: 'tail-silk' }), '94nop', ['opening-qscan-mul']);
});

test('finisher-twopass-stream clears SPL then DAT behind a quickscan, a compare scan and in a fork', () => {
  for (const rules of NEW) {
    ok(seq(qmul, tps()), rules, ['opening-qscan-mul']);
    ok(seq(qmul, tps({ DJS: 400 })), rules);
  }
  ok(seq(cmpscan, tps({ DJS: 5000 })), '94nop');
  ok(fork(tps(), { id: 'tail-silk' }), '94nop', ['opening-qscan-mul']);
});

test('bad settings are refused', () => {
  const s94 = recipeSettings('94nop'), s88 = recipeSettings('88');
  const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  has(seq(cmpscan, os()), s88, /ICWS'94/);
  has(dcf(), s88, /ICWS'94/);
  has(seq(cmpscan, tps()), s88, /ICWS'94/);
  has(os(), s94, /nothing provides a probe/);
  has(tps(), s94, /nothing provides a probe/);
  has(seq(qmul, os()), { ...s94, maxProcesses: 1 }, /PUMP needs/);
  has(dcf(), { ...s94, maxProcesses: 1 }, /PUMP needs/);
  has(seq(qmul, tps()), { ...s94, maxProcesses: 1 }, /needs more than one process/);
  has(seq(qmul, os({ STEP: 8 })), s94, /STEP must move the pair/);
  has(seq(qmul, os({ GAP: 32, BACK: 16 })), s94, /as wide as a warrior/);
  has(seq(qmul, os({ POINTS: 2 })), s94, /no 2-point imp step/);
  has(dcf({ POINTS: 4 }), s94, /no 4-point imp step/);
  has(seq(qmul, tps({ DJS: 6000 })), { ...s94, coreSize: 6050 }, /inside the warrior/);
});

// A copy of a block whose emitted code is altered by `f`, to show its watch notices.
let copies = 0;
function broken(id, f, P) {
  const orig = leaves[id], nid = `broken${++copies}-${id}`;
  leaves[nid] = { ...orig, id: nid, emit: (ctx) => orig.emit({ ...ctx, ins: (l, o, m, a, b = '0') => ctx.ins(l, ...f(l, o, m, a, b)) }) };
  const scenarioFix = (api) => ({ ...api, scenario: api.scenario.replace(nid, id) });
  leaves[nid].watch = (api) => orig.watch(scenarioFix(api));
  if (orig.plant) leaves[nid].plant = (api) => orig.plant(scenarioFix(api));
  return { id: nid, P: { ...orig.defaults, ...P } };
}

test('the watches catch a broken mechanism', () => {
  const build = (tree) => () => buildTree(tree, { rules: '94nop', length: 100 });
  // finisher-oneshot: the bomb detection's "lone cell: pass it over" jumps into the clear instead.
  const lone = broken('finisher-oneshot', (l, o, m, a, b) => (l === 'lone' ? [o, m, a.replace(/scan$/, 'commit'), b] : [o, m, a, b]), { DETECT: 1, IMP: 0 });
  assert.throws(build(seq(qmul, lone)), /lone cell|pass over the lone cell/, lone.id);
  // finisher-oneshot: the first bomb's skip is one short, so its wrap clears the image's last cell.
  const skip = broken('finisher-oneshot', (l, o, m, a, b) => (l === 'b0' ? [o, m, a, `${b}-1`] : [o, m, a, b]), { SCANS: 1, IMP: 0 });
  assert.throws(build(seq(qmul, skip)), /own warrior|bomb/, skip.id);
  // finisher-oneshot: the imp failsafe's bomb loses its anti-imp A-field.
  const anti = broken('finisher-oneshot', (l, o, m, a, b) => (l === 'abomb' ? [o, m, '#0', b] : [o, m, a, b]), { SCANS: 20, IMP: 1 });
  assert.throws(build(seq(qmul, anti)), /not anti-imp/, anti.id);
  // finisher-oneshot: the failsafe never runs (the fail jump goes back to the scan).
  const nofs = broken('finisher-oneshot', (l, o, m, a, b) => (o === 'JMP' && /fail$/.test(a) ? [o, m, a.replace(/fail$/, 'scan'), b] : [o, m, a, b]), { SCANS: 20, IMP: 1 });
  assert.throws(build(seq(qmul, nofs)), /never gave up|imp failsafe/, nofs.id);
  // finisher-dclear-fwd: the bomb's B is one short, so the wrap lands the pointer on its own code.
  const db = broken('finisher-dclear-fwd', (l, o, m, a, b) => (l === 'bomb' ? [o, m, a, `${b}-1`] : [o, m, a, b]));
  assert.throws(build(db), /reset the pointer|own code/, db.id);
  // finisher-dclear-fwd: a plain DAT where an anti-imp one is promised.
  const da = broken('finisher-dclear-fwd', (l, o, m, a, b) => (l === 'bomb' ? [o, m, '#0', b] : [o, m, a, b]));
  assert.throws(build(seq(qmul, da)), /not anti-imp/, da.id);
  // finisher-twopass-stream: bptr starts at 0, so the first pass is already DAT.
  const t0 = broken('finisher-twopass-stream', (l, o, m, a, b) => (l === 'bptr' ? [o, m, '#0', b] : [o, m, a, b]));
  assert.throws(build(seq(qmul, t0)), /DAT in its SPL pass|other than its stream/, t0.id);
  // finisher-twopass-stream: the stream walks backward (predecrement) into its own loop.
  const tb = broken('finisher-twopass-stream', (l, o, m, a, b) => (l === 'dj' ? [o, m, a, b.replace(/^\}/, '{')] : [o, m, a, b]));
  assert.throws(build(seq(qmul, tb)), /its own loop|damaged|in its SPL pass/, tb.id);
});

// Build a tree, load it alone at 0 (plus any extra warriors), return the VM and labels.
function load(tree, rules = '94nop', extra = []) {
  const settings = recipeSettings(rules, 100);
  const built = buildTree(tree, { rules, length: 100 });
  const w = compile(built.source, 'redcode', settings);
  assert.ok(w.ok, JSON.stringify(w.errors));
  const ws = [w, ...extra.map(([src]) => compile(src, 'redcode', settings))];
  const vm = new VM(settings);
  vm.load(ws, { positions: [0, ...extra.map(([, at]) => at)] });
  const label = (name) => built.labels[Object.keys(built.labels).find((k) => k.endsWith(name))];
  return { vm, w, built, settings, core: settings.coreSize, label };
}
const same = (a, b, core) => ['op', 'mod', 'aMode', 'bMode'].every((k) => a[k] === b[k]) && mod(a.a, core) === mod(b.a, core) && mod(a.b, core) === mod(b.b, core);

test('finisher-twopass-stream: the stream throws the switch at bptr, then parks on the pump', () => {
  const DJS = 400, { vm, w, core, label } = load(seq(qmul, tps({ DJS })));
  const len = w.instructions.length, bptr = label('bptr'), cs0 = label('cs0'), dj = label('dj');
  let switchedAt = null, splBefore = 0;
  while (!vm.done && vm.cycle < 80000) {
    vm.step();
    if (switchedAt === null && vm.peek(bptr).a === 0) {
      switchedAt = vm.cycle;
      assert.equal(vm.writerPc[bptr], dj, 'the stream decremented bptr');
      for (let c = len; c < core; c++) if (vm.peek(c).op === 'SPL') splBefore++;
    }
  }
  assert.ok(switchedAt !== null, 'the clear switched to DAT');
  assert.ok(splBefore > core - len - 10, `the SPL pass covered the core before the switch (${splBefore})`);
  assert.equal(vm.peek(cs0).a, 0, 'the stream parked on the pump');
  for (const l of ['w1', 'w2', 'dj']) assert.ok(same(vm.peek(label(l)), w.instructions[label(l)], core), `${l} intact`);
  // Long after the switch, everything past the image is the DAT bomb (DAT 0, skip).
  for (let c = len; c < core; c++) assert.equal(vm.peek(c).op, 'DAT', `cell ${c}`);
});

test('finisher-oneshot IMP 2 takes the anti-imp d-clear on an imp trail its scan finds', () => {
  const tree = seq(qmul, os({ DETECT: 1, IMP: 2, SCANS: 400 }));
  const { w, core, label } = load(tree);
  const len = w.instructions.length, step = leaves['finisher-oneshot'].defaults.STEP;
  const imp = { op: 'MOV', mod: 'I', aMode: '$', a: 0, bMode: '$', b: 1 };
  let tried = 0;
  for (let k = 3; k < 40; k++) {
    const c = mod(len + k * step, core);
    if (c < len + 20 || c > core - 40) continue;
    const { vm } = load(tree);
    for (let j = 0; j < 4; j++) vm.poke(c + j, imp);
    const payload = label('payload'), probe = 0;
    while (!vm.done && vm.processes(0)[0] !== payload) vm.step();
    if (vm.peek(probe).b !== len) continue;                // the quickscan saw it first: try another place
    tried++;
    let branch = null;
    while (!vm.done && branch === null && vm.cycle < 20000) {
      const pc = vm.processes(0)[0];
      if (pc === label('dl')) branch = 'imp'; else if (pc === label('w1')) branch = 'clear';
      vm.step();
    }
    assert.equal(branch, 'imp', `trail at ${c}: the find went to the anti-imp clear`);
    assert.ok(mod(vm.peek(probe).b, core) >= mod(c - len, core) - 2, 'the d-clear starts at the trail');
    break;
  }
  assert.ok(tried > 0, 'found a trail place the quickscan misses');
});

test('finisher-dclear-fwd beats an imp ring and never loses to it', () => {
  const settings = recipeSettings('94nop', 100);
  const built = buildTree(dcf(), { rules: '94nop', length: 100 });
  const ours = compile(built.source, 'redcode', settings);
  const ring = compile(fs.readFileSync(new URL('../warriors/impring.red', import.meta.url), 'utf8'), 'redcode', settings);
  let wins = 0, losses = 0;
  for (let r = 0; r < 8; r++) {
    const vm = new VM(settings);
    vm.load(r % 2 ? [ring, ours] : [ours, ring], { positions: [0, 1000 + 731 * r] });
    vm.run();
    const [a, b] = r % 2 ? [vm.warriors[1], vm.warriors[0]] : [vm.warriors[0], vm.warriors[1]];
    if (a.alive && !b.alive) wins++;
    if (!a.alive && b.alive) losses++;
  }
  assert.equal(losses, 0);
  assert.ok(wins > 0, 'the d-clear killed the ring at least once');
});
