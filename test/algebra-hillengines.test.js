// Tests for the hill engine blocks (tools/algebra/blocks/hillengines.js):
// carpet-stone, stream-swarm, fed-stream-swarm, knight-pump-stream,
// finisher-overwrite-antiimp.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, treeMismatches, leaves, shape, link, treeSettings } from '../tools/algebra/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';
import { compile, VM } from '../src/engine/index.js';
import { modInverse } from '../tools/algebra/util.js';
import { carpetPlan } from '../tools/algebra/blocks/hillengines.js';

const IDS = ['carpet-stone', 'stream-swarm', 'fed-stream-swarm', 'knight-pump-stream', 'finisher-overwrite-antiimp'];
const seq = (...kids) => ({ id: 'seq', kids });
const qmul = { id: 'opening-qscan-mul' };
const cmpscan = { id: 'opening-cmpscan', P: { SSTEP: 3044, GAP: 5, START: 700, SCANS: 64 } };
const mod = (x, n) => ((x % n) + n) % n;
const ok = (tree, rules) => {
  const built = buildTree(tree, { rules, length: 100 });
  assert.equal(built.verification.ok, true, `${shape(tree)} on ${rules}`);
  assert.equal(built.verification.shape, 'generic');
  return built;
};
// Run a block alone; `at(label)` is a label's address (the block is loaded at 0).
function solo(id, P = {}, rules = '94nop') {
  const settings = treeSettings(rules, 100), Q = { ...leaves[id].defaults, ...P };
  const r = link({ id, P: Q }, settings), w = compile(r.source, 'redcode', settings);
  assert.ok(w.ok, JSON.stringify(w.errors));
  const vm = new VM(settings); vm.load([w], { positions: [0] });
  return { vm, w, at: (l) => r.labels[`b0${l}`], P: Q, core: settings.coreSize };
}
const same = (a, b, core) => ['op', 'mod', 'aMode', 'bMode'].every((k) => a[k] === b[k]) && mod(a.a, core) === mod(b.a, core) && mod(a.b, core) === mod(b.b, core);

test('the blocks load with a watch', () => {
  for (const id of IDS) {
    assert.ok(leaves[id], id);
    assert.equal(typeof leaves[id].watch, 'function', `${id} watch`);
  }
});

test('every block builds on the rule sets it supports, alone and behind a quickscan', () => {
  for (const rules of ['94nop', '94x']) {
    ok({ id: 'carpet-stone' }, rules);
    ok(seq(qmul, { id: 'carpet-stone' }), rules);
    ok({ id: 'knight-pump-stream' }, rules);
    ok(seq(qmul, { id: 'knight-pump-stream' }), rules);
    ok(seq(qmul, { id: 'fed-stream-swarm' }), rules);
  }
  ok({ id: 'carpet-stone', P: { STEP: 37 } }, '94nop');
  ok({ id: 'boot', kids: [{ id: 'knight-pump-stream' }] }, '94nop');
  for (const rules of ['94nop', 'lp', '94x', '88']) ok({ id: 'stream-swarm' }, rules);
  for (const rules of ['94nop', 'lp']) ok(seq(qmul, { id: 'stream-swarm' }), rules);
  for (const rules of ['94nop', '88']) {
    ok({ id: 'fed-stream-swarm' }, rules);
    ok({ id: 'stream-swarm', P: { N: 20, K: 10 } }, rules);
  }
  for (const rules of ['94nop', 'lp', '94x']) {
    ok(seq(qmul, { id: 'finisher-overwrite-antiimp' }), rules);
    ok(seq(cmpscan, { id: 'finisher-overwrite-antiimp' }), rules);
    ok(seq(qmul, { id: 'finisher-overwrite-antiimp', P: { SPLS: 0, PUMP: 0, ARMS: 1, POINTS: 0 } }), rules);
  }
  ok({ id: 'boot', kids: [seq(qmul, { id: 'finisher-overwrite-antiimp' })] }, '94nop');
});

// carpet-stone, directly: the writes walk the lattice p0 + k STEP in order,
// nothing in the block but the bomb cell is hit until the planned bomb lands
// on a loop cell, and from then on the carpet stops spreading.
test('carpet-stone: the carpet walks its lattice, then switches the stone off on the planned cell', () => {
  const { vm, w, at, core } = solo('carpet-stone');
  const plan = carpetPlan(17, core);
  assert.ok(plan.k > 4 * Math.floor(core / 17), `the stop comes after ${plan.k} bombs, more than four laps`);
  const w1 = at('cW1'), w2 = at('cW2'), add = at('cAdd'), ptr = at('cPtr'), size = w.instructions.length;
  let adds = 0, stopAt = null;
  const late = new Set(), seen = new Set();
  while (vm.cycle < 40000) {
    const pc = vm.processes(0)[0];
    const live = (pc === w1 || pc === w2 || pc === add) && vm.peek(pc).op !== 'DAT';
    if (live && pc === add) { vm.step(); adds++; continue; }
    const t = live ? mod(ptr + (pc === w1 ? vm.peek(ptr).b : vm.peek(ptr).a), core) : null;
    const k = 2 * adds + (pc === w2 ? 1 : 0);
    vm.step();
    if (t === null) continue;
    if (stopAt === null) {
      // The write is lattice point k (the pointer has moved on once per ADD).
      assert.equal(t, mod(plan.p0 + k * 17, core), `write ${k} on its lattice point`);
      seen.add(k);
      if (t < size && t !== at('cBomb')) {
        assert.equal(k, plan.k, 'stopped by the planned bomb');
        assert.equal(t, plan.cell);
        stopAt = vm.cycle;
      }
    } else late.add(t);
  }
  for (let k = 0; k <= plan.k; k++) assert.ok(seen.has(k), `lattice point ${k} was bombed`);
  assert.ok(stopAt !== null, 'the stone never stopped');
  assert.ok(late.size <= 4, `${late.size} cells written after the stop`);
  for (const l of ['cFeed', 'cW1', 'cW2', 'cDjn', 'cInc']) if (at(l) !== plan.cell) assert.equal(vm.peek(at(l)).op, w.instructions[at(l)].op, `${l} intact`);
  assert.equal(vm.warriors[0].alive, true);
});

// stream-swarm, directly: N copies D apart; each stream decrements one cell a
// run; a stream that comes down onto the next copy shifts that copy's pointer,
// and the copy restarts near its own origin.
test('stream-swarm: the copies stand core/N apart and a pass over a copy restarts its stream', () => {
  const { vm, w, at, P, core } = solo('stream-swarm');
  const D = Math.floor(core / P.N), first = mod(at('ssPtr') + w.instructions[at('ssPtr')].b, core);
  const lines = Array.from({ length: P.N }, (_, i) => mod(first - i * D, core));
  while (vm.processes(0).includes(at('ssEnd')) || vm.cycle < 200) vm.step();
  for (const c of lines) assert.ok(same(vm.peek(c), w.instructions[at('ssLine')], core), `a copy at ${c}`);
  const restarts = [];
  const lineSet = new Set(lines);
  while (vm.cycle < 80000) {
    const pc = vm.processes(0)[0];
    let hit = null;
    if (lineSet.has(pc)) {
      const p = mod(pc + vm.peek(pc).b, core), t = mod(p + vm.peek(p).b - 1, core);
      if (lineSet.has(t) && t !== pc) hit = t;
    }
    vm.step();
    if (hit !== null) {
      // The copy hit now points one cell lower; its next target is within K + 30 of it.
      const p = mod(hit + vm.peek(hit).b, core), next = mod(p + vm.peek(p).b - 1, core);
      restarts.push(mod(hit - next, core));
    }
  }
  assert.ok(restarts.length >= P.N, `${restarts.length} passes over a copy`);
  assert.ok(restarts.every((d) => d <= P.K + 30), `restarts land near the origin: ${restarts.slice(0, 10)}`);
  const procs = vm.processes(0);
  for (const c of lines) assert.ok(procs.includes(c), `the stream at ${c} still runs`);
});

// knight-pump-stream, directly: over a whole round the stone's bombs restart
// the stream at its pointer again and again, so it stays within a few hundred
// cells of the pointer, two thousand cells from the block.
test('knight-pump-stream: the stone keeps restarting the stream, which never nears the block', () => {
  const { vm, w, at, core } = solo('knight-pump-stream');
  const join = at('pJoin'), ptr = mod(join + w.instructions[join].b, core);
  let runs = 0, reach = 0, restarts = 0, prev = vm.peek(ptr).b;
  while (vm.cycle < 80000) {
    if (vm.processes(0)[0] === join) { runs++; const b = vm.peek(ptr).b; reach = Math.max(reach, b > core / 2 ? core - b : 0); }
    vm.step();
    const x = vm.peek(ptr);
    if (x.op === 'DAT' && x.b === 1 && prev !== 1) restarts++;
    prev = x.b;
  }
  assert.ok(ptr > 2000 && ptr < 2200, `pointer at ${ptr}`);
  assert.ok(runs > 200, `${runs} stream runs`);
  assert.ok(restarts >= 3, `${restarts} restarts`);
  assert.ok(reach < 200, `the stream reached ${reach} cells below its pointer`);
  for (let i = 0; i < w.instructions.length; i++) {
    if (['sJmp', 'pL', 'sBomb'].some((l) => at(l) === i) || i % 4 === 3) continue;
    assert.ok(same(vm.peek(i), w.instructions[i], core), `block cell ${i} intact`);
  }
});

// finisher-overwrite-antiimp, directly (SPLS 0 so the anti-imp passes come
// inside a round): after the DAT pass wraps, the probe holds A = s, B = 2s,
// probe + s holds the anti-imp DAT, and later passes refill the third of the
// core below the probe with it, never touching the warrior.
test('finisher-overwrite-antiimp: the DAT pass hands over to anti-imp passes sourced from its own copy', () => {
  const tree = seq(qmul, { id: 'finisher-overwrite-antiimp', P: { SPLS: 0, PUMP: 1, ARMS: 2, POINTS: 0 } });
  const settings = recipeSettings('94nop', 100), built = buildTree(tree, { rules: '94nop', length: 100 });
  const w = compile(built.source, 'redcode', settings), core = 8000, s = modInverse(3, core);
  const vm = new VM(settings); vm.load([w], { positions: [0] });
  const probe = built.labels.b1probe, bd = w.instructions[built.labels.b2bd], len = w.instructions.length;
  assert.equal(probe, 0, 'the MUL quickscan\'s probe is the first cell');
  assert.equal(bd.aMode, '>'); assert.equal(bd.bMode, '>'); assert.equal(mod(bd.a, core), s); assert.equal(mod(bd.b, core), 2 * s);
  let handover = null;
  while (vm.cycle < 80000) {
    vm.step();
    if (handover === null && same(vm.peek(probe), bd, core)) handover = vm.cycle;
  }
  assert.ok(handover !== null, 'the DAT pass never wrapped');
  assert.ok(same(vm.peek(s), bd, core), 'probe + s holds the anti-imp DAT');
  const refilled = [];
  for (let c = 2 * s; c < core; c++) if (vm.writeCycle[c] > handover) refilled.push(c);
  assert.ok(refilled.length > 2000, `${refilled.length} cells rewritten after the handover`);
  for (const c of refilled) assert.ok(same(vm.peek(c), bd, core), `cell ${c} holds the anti-imp DAT`);
  for (let c = built.labels.b2payload; c < len; c++) assert.ok(same(vm.peek(c), w.instructions[c], core), `finisher cell ${c} intact`);
  // A process that runs a laid copy breaks the next two cells of a 3-point ring.
  const t = new VM(settings), imp = { op: 'MOV', mod: 'I', aMode: '#', a: 0, bMode: '$', b: s };
  t.load([compile('JMP 0', 'redcode', settings), compile(`DAT.F >${s}, >${2 * s}`, 'redcode', settings)], { positions: [4000, 100] });
  t.poke(100 + s, imp); t.poke(100 + 2 * s, imp);
  while (t.warriors[1].alive) t.step();
  assert.equal(t.peek(100 + s).b, s + 1); assert.equal(t.peek(100 + 2 * s).b, s + 1);
});

test('bad settings are refused', () => {
  const s94 = recipeSettings('94nop', 100);
  const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  const P = (id, Q) => ({ id, P: { ...leaves[id].defaults, ...Q } });
  has(P('carpet-stone', { STEP: 64 }), s94, /reaches only/);
  has({ id: 'carpet-stone' }, recipeSettings('lp', 100), /growing process queue/);
  has({ id: 'carpet-stone' }, recipeSettings('88', 100), /ICWS'94/);
  has(P('stream-swarm', { N: 8 }), recipeSettings('lp', 100), /boot process/);
  has(P('stream-swarm', { N: 24, K: 60 }), { ...s94, maxLength: 300 }, /do not clear/);
  has(P('fed-stream-swarm', { K: 2 }), s94, /pointer on the copy/);
  has(P('knight-pump-stream', { SDIST: 7950 }), s94, /just below the warrior/);
  has(P('knight-pump-stream', { STEP: 3045 }), s94, /multiple of 4/);
  has(seq(qmul, P('finisher-overwrite-antiimp', { POINTS: 4 })), s94, /no 4-point imp step/);
  has({ id: 'finisher-overwrite-antiimp' }, s94, /nothing provides a probe/);
});

// A copy of a block whose emitted code is altered by `f`, to show its watch notices.
let copies = 0;
function broken(id, f, P) {
  const orig = leaves[id], nid = `broken${++copies}-${id}`;
  leaves[nid] = { ...orig, id: nid, emit: (ctx) => orig.emit({ ...ctx, ins: (l, o, m, a, b = '0') => ctx.ins(l, ...f(l, o, m, a, b)) }) };
  const scenarioFix = (api) => ({ ...api, scenario: api.scenario.replace(nid, id) });
  leaves[nid].watch = (api) => orig.watch(scenarioFix(api));
  if (orig.running) leaves[nid].running = orig.running;
  return { id: nid, ...(P ? { P: { ...orig.defaults, ...P } } : {}) };
}

test('the watches catch a broken mechanism', () => {
  const build = (tree) => () => buildTree(tree, { rules: '94nop', length: 100 });
  // carpet-stone: the pointer starts one cell on, off the planned lattice.
  const cs = broken('carpet-stone', (l, o, m, a, b) => (l === 'cPtr' ? [o, m, a, `#${Number(b.slice(1)) + 1}`] : [o, m, a, b]));
  assert.throws(build(cs), /left its lattice/, cs.id);
  // stream-swarm: the copies are DJN.B, which leaves the A-field alone.
  const sw = broken('stream-swarm', (l, o, m, a, b) => (l === 'ssLine' ? [o, 'B', a, b] : [o, m, a, b]));
  assert.throws(build(sw), /did not decrement/, sw.id);
  // knight-pump-stream: the stream's pointer is moved off the bomb lattice, so nothing restarts it.
  const ks = broken('knight-pump-stream', (l, o, m, a, b) => (l === 'pJoin' ? [o, m, a, `<${Number(b.slice(1)) + 1}`] : [o, m, a, b]));
  assert.throws(build(ks), /never restarted|cells below its pointer/, ks.id);
  // finisher-overwrite-antiimp: the payload aims the probe at the second bomb, so pass 1 lays the wrong one.
  const fa = broken('finisher-overwrite-antiimp', (l, o, m, a, b) => (o === 'MOV' && m === 'A' ? [o, m, a.replace(/b0-/, 'b1-'), b] : [o, m, a, b]));
  assert.throws(build(seq(qmul, fa)), /other than pass 1's bomb/, fa.id);
});
