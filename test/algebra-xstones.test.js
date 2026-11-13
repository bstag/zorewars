// Tests for the X-hill stones (tools/algebra/blocks/xstones.js):
// remote-bomb-stone, movthrough-stone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, treeMismatches, leaves, shape, link, treeSettings } from '../tools/algebra/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';
import { compile, VM } from '../src/engine/index.js';

const IDS = ['remote-bomb-stone', 'movthrough-stone'];
const seq = (...kids) => ({ id: 'seq', kids });
const ok = (tree, rules, length = 100) => {
  const built = buildTree(tree, { rules, length });
  assert.equal(built.verification.ok, true, `${shape(tree)} on ${rules}`);
  return built;
};
// A block alone in a VM; `at(label)` is a label's address (loaded at 0).
function solo(id, P = {}, rules = '94x') {
  const settings = treeSettings(rules, 100), Q = { ...leaves[id].defaults, ...P };
  const r = link({ id, P: Q }, settings), w = compile(r.source, 'redcode', settings);
  assert.ok(w.ok, JSON.stringify(w.errors));
  const vm = new VM(settings); vm.load([w], { positions: [0] });
  return { vm, w, at: (l) => r.labels[`b0${l}`], core: settings.coreSize, total: r.total };
}
const mod = (x, n) => ((x % n) + n) % n;

test('the blocks load with a watch and stay compact', () => {
  for (const id of IDS) {
    assert.ok(leaves[id], id);
    assert.equal(typeof leaves[id].watch, 'function', `${id} watch`);
  }
  assert.equal(ok({ id: 'remote-bomb-stone' }, '94x').total, 14);
  assert.equal(ok({ id: 'remote-bomb-stone', P: { PROCS: 1 } }, '94x').total, 11);
  assert.equal(ok({ id: 'movthrough-stone' }, '94x').total, 10);
  assert.equal(ok({ id: 'movthrough-stone', P: { PROCS: 1 } }, '94x').total, 8);
});

test('both build alone on the 8,000 core too, and within 50 instructions behind an opening', () => {
  for (const id of IDS) {
    ok({ id }, '94nop');
    ok(seq({ id: 'opening-quickscan' }, { id }), '94nop', 50);
  }
  ok(seq({ id: 'opening-quickscan' }, { id: 'remote-bomb-stone' }), '94x', 50);
});

test('both run booted away, and take lockstep processes from a fan boot', () => {
  for (const id of IDS) ok({ id: 'boot', kids: [{ id }] }, '94x');
  // Five into the remote-bomb stone (N 6, SPLIT 1), four into the mov-through stone (N 4, MOREA 1).
  // At the default fan boot placement on 8,000 cells the step-2019 lattice crosses the pump's copy and the gate
  // refuses it (the watch sees the bomb); the older step 6691 misses it.
  assert.throws(() => buildTree({ id: 'fanboot', P: { N: 6, SPLIT: 1 }, kids: [{ id: 'remote-bomb-stone', P: { PROCS: 1 } }, { id: 'compact-imp-pump', P: { RETIRE: 1 } }] }, { rules: '94nop', length: 100 }), /bombed the warrior/);
  ok({ id: 'fanboot', P: { N: 6, SPLIT: 1 }, kids: [{ id: 'remote-bomb-stone', P: { PROCS: 1, STEP: 6691 } }, { id: 'compact-imp-pump', P: { RETIRE: 1 } }] }, '94nop');
  // A placement whose lattice crosses the pump's copy is refused by the gate.
  assert.throws(() => buildTree({ id: 'fanboot', P: { N: 4, SPLIT: 1, MOREA: 1, HOPB: 5000 }, kids: [{ id: 'movthrough-stone', P: { PROCS: 1, TIME: 150 } }, { id: 'compact-imp-pump', P: { RETIRE: 1 } }] }, { rules: '94nop', length: 100 }), /bombed the warrior/);
  ok({ id: 'fanboot', P: { N: 4, SPLIT: 1, MOREA: 1, HOPB: 5003 }, kids: [{ id: 'movthrough-stone', P: { PROCS: 1, TIME: 150 } }, { id: 'compact-imp-pump', P: { RETIRE: 1 } }] }, '94nop');
});

test('bad settings are refused', () => {
  const x = recipeSettings('94x'), n = recipeSettings('94nop'), old = recipeSettings('88');
  const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  has({ id: 'remote-bomb-stone', P: { PROCS: 3 } }, x, /PROCS must be 5/);
  has({ id: 'remote-bomb-stone', P: { STEP: 13860 } }, x, /reaches only/);          // 2 * STEP is half the core
  has({ id: 'remote-bomb-stone', P: { BDIST: 30000 } }, n, /on the warrior itself/);   // past the 8,000 core
  has({ id: 'remote-bomb-stone', P: { STEP: 110, TIME: 20000 } }, x, /is past the lattice/);
  has({ id: 'remote-bomb-stone' }, old, /needs ICWS'94/);
  has({ id: 'movthrough-stone', P: { PROCS: 2 } }, x, /PROCS must be 4/);
  has({ id: 'movthrough-stone', P: { STEP: 2 } }, x, /brings the bombs home/);
  has({ id: 'movthrough-stone', P: { STEP: 4000 } }, n, /reaches only/);
  has({ id: 'movthrough-stone' }, old, /needs ICWS'94/);
  // Both end as a core clear, so they take no partner beside them.
  has({ id: 'par', kids: [{ id: 'remote-bomb-stone' }, { id: 'imp' }] }, x, /a clear runs alone/);
});

// remote-bomb-stone, directly: the bomb is planted BDIST away; each pass drops a
// copy of it and a blank, STEP apart, on the 2*STEP lattice; when the blank
// lattice reaches the remote bomb the five processes are in the clear a few
// cycles later.
test('remote-bomb-stone plants its bomb remotely, bombs its lattice and converts on time', () => {
  const { vm, at, core, total } = solo('remote-bomb-stone', { TIME: 500 });
  const gate = at('rbGate'), R = mod(at('rbWatch') + vm.peek(at('rbWatch')).b, core);
  const g0 = { ...vm.peek(gate) }, S2 = mod(vm.peek(at('rbTpl')).a, core);
  assert.ok(mod(R - gate, core) >= 3000 && R > total, 'the remote bomb is far from the loop');
  assert.equal(mod(g0.b + 500 * S2, core), mod(R - gate, core), 'pass 500 puts the blank on the remote bomb');
  const cells = new Set();
  let passes = 0, fell = null;
  while (vm.cycle < 4000 && fell === null) {
    const pc = vm.processes(0)[0];
    if (pc === at('rbW1')) cells.add(mod(gate + vm.peek(gate).a, core));
    if (pc === at('rbW2')) { cells.add(mod(gate + vm.peek(gate).b, core)); passes++; }
    if (pc === at('rbCm')) fell = vm.cycle;
    vm.step();
    if (vm.cycle === 20) assert.equal(vm.peek(R).op, 'DAT', 'planted');
    if (vm.cycle === 20) assert.equal(mod(vm.peek(R).b, core), S2, 'the planted bomb carries the step');
  }
  assert.equal(vm.warriors[0].peak, 5);
  assert.ok(fell !== null && fell < 4 * 500 + 40, `fell into the clear at ${fell}`);
  assert.ok(passes >= 500 && passes <= 502, `${passes} passes`);
  assert.equal(vm.peek(R).b, 0, 'the remote bomb was blanked');
  for (const c of cells) {
    assert.ok(c >= total, `bomb at ${c} is inside the image`);
    assert.ok([g0.a, g0.b].some((p) => mod(c - gate - p, core) % S2 === 0 || mod(c - gate - p, core) % 2 === 0), 'on the lattice');
  }
  assert.ok(cells.size >= 1000, `${cells.size} cells bombed`);
  vm.run(2000);
  const inClear = vm.processes(0).every((q) => q === at('rbCm') || q === at('rbCd'));
  assert.ok(inClear && vm.processes(0).length === 5, 'all five processes run the clear');
});

test('remote-bomb-stone: destroying the remote bomb sends every process into the clear', () => {
  const { vm, at, core } = solo('remote-bomb-stone');
  const R = mod(at('rbWatch') + vm.peek(at('rbWatch')).b, core);
  vm.run(1000);
  assert.ok(vm.processes(0).every((q) => q >= at('rbLoop') && q <= at('rbWatch')), 'still a stone');
  vm.poke(R, { op: 'DAT', mod: 'F', aMode: '$', a: 0, bMode: '$', b: 0 });
  vm.run(30);
  assert.ok(vm.processes(0).every((q) => q === at('rbCm') || q === at('rbCd')), 'in the clear 30 cycles later');
  vm.run(vm.settings?.maxCycles ?? 100000);
  assert.ok(vm.warriors[0].alive);
});

// movthrough-stone, directly: every pass moves one cell from the forward pointer
// to the backward pointer; on the predicted pass it moves its own increment
// cell onto its loop line and the four processes fall into the clear.
test('movthrough-stone carries cells through and overwrites its own loop on the predicted pass', () => {
  const { vm, at, core } = solo('movthrough-stone', { TIME: 300 });
  const mov = at('mtMov'), marker = { op: 'SPL', mod: 'B', aMode: '#', a: 5, bMode: '#', b: 9 };
  // Something for pass 3 to carry: put it where pass 3's forward pointer will be.
  const S = mod(vm.peek(at('mtPre')).a, core), a3 = mod(mov + vm.peek(mov).a + 2 * S, core), b3 = mod(mov + vm.peek(mov).b - 2 * S, core);
  vm.poke(a3, marker);
  let passes = 0;
  while (vm.cycle < 3000 && vm.peek(at('mtDjn')).op === 'DJN') { if (vm.processes(0)[0] === mov) passes++; vm.step(); }
  assert.equal(passes, 300, 'the loop line went on pass 300');
  assert.equal(vm.peek(at('mtDjn')).op, 'NOP');
  assert.equal(vm.peek(b3).op, 'SPL', 'pass 3 carried the planted cell to the backward pointer');
  assert.equal(vm.warriors[0].peak, 4);
  vm.run(200);
  assert.ok(vm.processes(0).length === 4 && vm.processes(0).every((q) => q === at('mtCm') || q === at('mtCd')), 'all four processes run the clear');
  vm.run(2 * core);
  assert.ok(vm.warriors[0].alive, 'the clear laps its own block safely');
  assert.equal(vm.peek(at('mtCm')).op, 'MOV');
});

// A copy of a block whose emitted code is altered by `f`, to show its watch notices.
let copies = 0;
function broken(id, f) {
  const orig = leaves[id], nid = `broken${++copies}-${id}`;
  leaves[nid] = { ...orig, id: nid, emit: (ctx) => orig.emit({ ...ctx, pc: ctx.pc, ins: (l, o, m, a, b = '0') => ctx.ins(l, ...f(l, o, m, a, b)) }) };
  const fix = (api) => ({ ...api, scenario: api.scenario.replace(nid, id) });
  leaves[nid].watch = (api) => orig.watch(fix(api));
  if (orig.plant) leaves[nid].plant = (api) => orig.plant(fix(api));
  return nid;
}

test('the watches catch a broken mechanism', () => {
  // No airbag: the watch is a plain jump, so neither the time-up nor a destroyed bomb stops the stone.
  const deaf = broken('remote-bomb-stone', (l, o, m, a, b) => (l === 'rbWatch' ? ['JMP', m, a, b] : [o, m, a, b]));
  assert.throws(() => buildTree({ id: deaf }, { rules: '94nop', length: 100 }), /never converted|did not fall into its clear|bombed the warrior|did not survive|time-up/);
  // A stone whose backward pointer does not step: it never reaches its loop line.
  const stuck = broken('movthrough-stone', (l, o, m, a, b) => (l === 'mtPre' ? [o, m, a, '#0'] : [o, m, a, b]));
  assert.throws(() => buildTree({ id: stuck }, { rules: '94nop', length: 100 }), /never overwrote its loop|left its step lattice|bombed the warrior|did not survive/);
});

// Stone/imp on the X core. compact-imp-pump promises to refill its spiral after a
// planted kill unless a partner retires it once it has fed the spiral (RETIRE). A
// 13-point spiral cannot restart from nothing beside any partner, so the stones
// retire the pump themselves: it sits just below the stone, and RETIRE 5 drops the
// stone's DAT on its launch line as the processes fall into the clear. SPARE keeps
// the clear off the first arm, which starts just past the stone.
const stoneImp = {
  remote: { id: 'fanboot', P: { N: 6, SPLIT: 1, EXACT: 1, HOPA: 20000, HOPB: 19981 }, kids: [
    { id: 'remote-bomb-stone', P: { PROCS: 1, STEP: 1723, TIME: 80, SPARE: 5600, RETIRE: 5 } },
    { id: 'compact-imp-pump', P: { N: 13, LEAD: 24, RETIRE: 1 } }] },
  movthrough: { id: 'fanboot', P: { N: 4, SPLIT: 1, MOREA: 1, EXACT: 1, HOPA: 20000, HOPB: 19983 }, kids: [
    { id: 'movthrough-stone', P: { PROCS: 1, TIME: 80, SPARE: 5600, RETIRE: 5 } },
    { id: 'compact-imp-pump', P: { N: 13, LEAD: 24, RETIRE: 1 } }] },
};
for (const [name, tree] of Object.entries(stoneImp)) {
  test(`${name} stone with compact-imp-pump under fanboot on 94x: the gate passes and the imps outlive the clear`, () => {
    const built = ok(structuredClone(tree), '94x', 50);
    assert.ok(built.total <= 26, `${built.total} instructions`);
    // Without RETIRE the pump's own refill scenario refuses the tree.
    const plain = structuredClone(tree); plain.kids[0].P.RETIRE = 0; plain.kids[0].P.BDIST = 8000;
    assert.throws(() => buildTree(plain, { rules: '94x', length: 50 }), /compatible imps survive|did not refill/);
    // Directly: half-way through the round the stone is a clear, the launcher is gone,
    // and far more than 13 processes are still running 13-point imps.
    const vm = new VM(built.settings); vm.load([built.w], { positions: [0] });
    vm.run(250000);
    const core = built.settings.coreSize, step = 34117;
    const label = (suffix) => built.labels[Object.keys(built.labels).find((k) => k.endsWith(suffix))];
    const stoneAt = 20000 + label(name === 'remote' ? 'rbGo0' : 'mtGo0');
    const clearAt = 20000 + label(name === 'remote' ? 'rbCm' : 'mtCm');
    const procs = vm.processes(0);
    const imps = procs.filter((q) => { const c = vm.peek(q); return c.op === 'MOV' && c.mod === 'I' && mod(c.b, core) === step; });
    assert.ok(vm.warriors[0].alive);
    assert.ok(imps.length >= 26, `${imps.length} imps of ${procs.length} processes`);
    assert.ok(procs.some((q) => q === clearAt || q === clearAt + 1), 'the stone is running its clear');
    assert.equal(vm.peek(stoneAt - 5).op, 'DAT', 'the launcher was retired');
    // The spared cells past the stone were never touched by the clear's DAT.
    const bomb = vm.peek(20000 + label(name === 'remote' ? 'rbDat' : 'mtDat'));
    let hit = 0;
    for (let c = clearAt + 4; c < clearAt + 4 + 5000; c++) { const x = vm.peek(c); if (x.op === 'DAT' && x.a === bomb.a && x.b === bomb.b && x.aMode === bomb.aMode) hit++; }
    assert.equal(hit, 0, 'the clear left the spared window alone');
  });
}

test('both stones pass full verification on both cores', () => {
  for (const id of IDS) for (const rules of ['94x', '94nop']) {
    assert.equal(buildTree({ id }, { rules, length: 100, verification: 'full' }).verification.ok, true, `${id} on ${rules}`);
  }
});

// RETIRE fires on the time-up only. An enemy hit on the remote bomb sends the stone into its clear
// with the launcher untouched, so the pump keeps feeding its spiral.
test('remote-bomb-stone RETIRE: an early hit leaves the launcher alone, the time-up retires it', () => {
  const built = ok(structuredClone(stoneImp.remote), '94x', 50);
  const label = (suffix) => built.labels[Object.keys(built.labels).find((k) => k.endsWith(suffix))];
  const core = built.settings.coreSize, stoneAt = 20000 + label('rbGo0'), launcher = stoneAt - 5;
  const run = (hitAt, until) => {
    const vm = new VM(built.settings); vm.load([built.w], { positions: [0] });
    const watch = 20000 + label('rbWatch');
    while (vm.cycle < until) {
      if (vm.cycle === hitAt) vm.poke(mod(watch + vm.peek(watch).b, core), { op: 'DAT', mod: 'F', aMode: '$', a: 0, bMode: '$', b: 0 });
      vm.step();
    }
    return vm;
  };
  assert.equal(run(-1, 500).peek(launcher).op, 'JMP', 'the launch line');
  const hit = run(600, 3000);
  assert.equal(hit.peek(launcher).op, 'JMP', 'after an early hit the launcher is still there');
  assert.ok(hit.processes(0).some((q) => q === 20000 + label('rbCm') || q === 20000 + label('rbCd')), 'and the stone is in its clear');
  const natural = run(-1, 12000);
  assert.equal(natural.peek(launcher).op, 'DAT', 'the time-up dropped the last bomb on the launcher');
});

// movthrough-feed-stone: its increment cell is a feeding SPL, so beside a continuous pump that fills the
// process table it keeps a share of the turns. Measured here against the plain stone in the same fan boot
// beside fan-imp-pump (16 lockstep feeders of its own): far more moves, a clear that starts, live imps.
test('movthrough-feed-stone keeps bombing beside fan-imp-pump where the plain stone starves', () => {
  for (const rules of ['94x', '94nop']) {
    assert.equal(ok({ id: 'movthrough-feed-stone' }, rules).verification.ok, true);
    assert.equal(buildTree({ id: 'movthrough-feed-stone' }, { rules, length: 100, verification: 'full' }).verification.ok, true);
  }
  const fan = (id) => ({ id: 'fanboot', P: { N: 4, SPLIT: 1, MOREA: 1, HOPA: 20000, HOPB: 31000 }, kids: [{ id, P: { PROCS: 1, TIME: 3000 } }, { id: 'fan-imp-pump', P: { FAN: 1 } }] });
  const run = (id) => {
    const built = ok(fan(id), '94x', 50), core = built.settings.coreSize;
    const label = (suffix) => (built.labels[Object.keys(built.labels).find((k) => k.endsWith(suffix))] + 20000) % core;
    const vm = new VM(built.settings); vm.load([built.w], { positions: [0] });
    let moves = 0, clearAt = null;
    while (vm.cycle < 150000) {
      const q = vm.warriors[0].queue, pc = q.buf[q.head];
      if (pc === label('mtMov')) moves++;
      if (clearAt === null && pc === label('mtCm')) clearAt = vm.cycle;
      vm.step();
    }
    const imps = vm.processes(0).filter((q) => { const x = vm.peek(q); return x.op === 'MOV' && mod(x.b, core) === 34117; }).length;
    return { moves, clearAt, imps };
  };
  const fed = run('movthrough-feed-stone'), plain = run('movthrough-stone');
  assert.ok(fed.moves > 1000, `the fed stone moved ${fed.moves} cells`);
  assert.ok(plain.moves < 400, `the plain stone moved ${plain.moves} cells`);
  assert.ok(fed.clearAt !== null, 'the fed stone reached its clear');
  assert.ok(fed.imps >= 13, `${fed.imps} imps still running`);
});

// OWN 1: a stone fan-booted far from a large image (here one member of a three-member switch-score on
// the P-space hill) plans its lattice around its own cells only. With the linker's window, the whole
// 137-cell image, the plan ends the stone after a few dozen passes and the tree is refused.
test('OWN 1 lets a fan-booted stone inside a large switch keep a long phase; the gate still runs', () => {
  const boot = (k, HOP = 19000) => ({ id: 'boot', P: { HOP }, kids: [k] });
  const tree = (OWN) => ({ id: 'switch-score', P: { STREAK: 3 }, kids: [{ id: 'fanboot-paper-stone' }, boot({ id: 'ladder-scanner', P: { STP: 1 } }),
    { id: 'fanboot', P: { N: 4, SPLIT: 1, MOREA: 1, HOPA: 20000, HOPB: 31000 }, kids: [{ id: 'movthrough-feed-stone', P: { PROCS: 1, TIME: 3000, OWN } }, { id: 'dual-imp-pump' }] }] });
  assert.throws(() => buildTree(tree(0), { rules: '94x-hill', length: 200 }), /brings the bombs home after/);
  const built = buildTree(tree(1), { rules: '94x-hill', length: 200 });
  assert.equal(built.verification.ok, true);
  const mov = built.w.instructions[built.labels[Object.keys(built.labels).find((k) => k.endsWith('mtMov'))]];
  const step = 7558, core = 55440;
  // The first move's source is T - 1 steps back: T is in the thousands, not a few dozen.
  let T = 0; for (let k = 1, a = mod(mov.a, core); k <= core; k++, a = mod(a + step, core)) if (a === core - 1) { T = k; break; }
  assert.ok(T >= 1000, `${T} passes planned`);
});
