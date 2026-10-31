// Tests for the hillstones2 blocks (tools/algebra/blocks/hillstones2.js):
// armadillo-switch, self-add-stone, delayed-pump.

import test from 'node:test';
import assert from 'node:assert/strict';

const { buildTree, treeMismatches, leaves, shape } = await import('../tools/algebra/index.js');
const { recipeSettings } = await import('../tools/blocks/recipes.js');
const { compile, VM } = await import('../src/engine/index.js');

const NEW = ['94nop', 'lp', '94x'];
const seq = (...kids) => ({ id: 'seq', kids });
const par = (...kids) => ({ id: 'par', kids });
const ok = (tree, rules) => {
  const built = buildTree(tree, { rules, length: 100 });
  assert.equal(built.verification.ok, true, `${shape(tree)} on ${rules}`);
  return built;
};

test('the three blocks load with working defaults', () => {
  for (const id of ['armadillo-switch', 'self-add-stone', 'delayed-pump']) {
    assert.ok(leaves[id], id);
    assert.equal(typeof leaves[id].watch, 'function', `${id} watch`);
  }
});

test('armadillo-switch and self-add-stone build on every 94 rule set', () => {
  for (const rules of NEW) {
    ok({ id: 'armadillo-switch' }, rules);                       // STEP 2920 has gcd 40 on both cores
    ok({ id: 'self-add-stone' }, rules);
  }
  // Alternate settings (steps tuned to the 8,000 core).
  ok({ id: 'armadillo-switch', P: { STEP: 2090, HOP: 46 } }, '94nop');
  ok({ id: 'self-add-stone', P: { STEP: 1080 } }, '94nop');
});

// delayed-pump is a spiral launcher, so (like vector-spiral) its process count
// depends on the core: the default 13-point spiral of 32 processes suits the
// 8,000-cell 94nop and the 55,440-cell 94x; the 8-process lp hill needs a small
// 3-point launch.
test('delayed-pump builds: default on 94nop/94x, a small launch on lp', () => {
  ok({ id: 'delayed-pump' }, '94nop');
  ok({ id: 'delayed-pump' }, '94x');
  ok({ id: 'delayed-pump', P: { POINTS: 3, K: 2 } }, 'lp');
  ok({ id: 'delayed-pump', P: { DELAY: 600 } }, '94nop');
});

test('the stones run behind a quickscan opening (seq)', () => {
  for (const rules of ['94nop', '94x']) {
    ok(seq({ id: 'opening-quickscan' }, { id: 'armadillo-switch' }), rules);
    ok(seq({ id: 'opening-quickscan' }, { id: 'self-add-stone' }), rules);
  }
});

test('delayed-pump pairs with a stone under par (the idle lets the stone fill first)', () => {
  ok(par({ id: 'stone' }, { id: 'delayed-pump' }), '94nop');
  ok({ id: 'apart', kids: [{ id: 'stone' }, { id: 'delayed-pump' }] }, '94nop');
});

test('bad settings are refused', () => {
  const s94 = recipeSettings('94nop'), s94x = recipeSettings('94x'), s88 = recipeSettings('88');
  const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  has({ id: 'self-add-stone', P: { STEP: 2817 } }, s94, /too small to keep/);       // coprime step: gcd 1
  has({ id: 'self-add-stone', P: { STEP: 2000 } }, s94, /reaches only/);             // gcd 2000: 4 cells
  has({ id: 'self-add-stone' }, s88, /needs ICWS'94/);
  has({ id: 'armadillo-switch' }, s88, /needs ICWS'94/);
  has({ id: 'delayed-pump' }, s88, /need ICWS'94/);
  has({ id: 'delayed-pump', P: { POINTS: 3 } }, s94x, /no 3-point imp spiral/);      // 3 | 55440
  has({ id: 'delayed-pump', P: { POINTS: 13, K: 2 } }, s94, /fewer imps than points/);
});

// self-add-stone, directly: the {0,}0 ADD walks the MOV's B-field forward by
// STEP each pass with no increment cell, so the warrior bombs a wide forward
// lattice. We watch the MOV's target cells and check it reaches many of them.
test('self-add-stone bombs a wide forward lattice off its own code', () => {
  const rules = '94nop', P = { STEP: 2920 };
  const settings = recipeSettings(rules, 100);
  const built = buildTree({ id: 'self-add-stone', P }, { rules, length: 100 });
  const w = compile(built.source, 'redcode', settings);
  assert.ok(w.ok, JSON.stringify(w.errors));
  const vm = new VM(settings);
  vm.load([w], { positions: [0] });
  const code = w.instructions.length;
  const layIdx = Object.keys(built.labels).find((k) => k.endsWith('safLay'));
  const lay = built.labels[layIdx];
  const targets = new Set();
  let selfHit = false;
  for (let t = 0; t < 40000 && vm.warriors[0].alive; t++) {
    const pc = vm.processes(0)[0];
    if (pc === lay) {
      const p = vm.peek(lay);
      const tgt = ((lay + p.b) % settings.coreSize + settings.coreSize) % settings.coreSize;
      targets.add(tgt);
      if (tgt < code) selfHit = true;
    }
    vm.run(1);
  }
  assert.ok(vm.warriors[0].alive, 'self-add-stone died running alone');
  assert.equal(selfHit, false, 'self-add-stone bombed its own code');
  assert.ok(targets.size > 100, `self-add-stone reached only ${targets.size} cells`);
});

// armadillo-switch, directly: the A-trail copies the feeder SPL over the DJN
// loop line after a few thousand cycles; from then on the DJN cell is an SPL
// and the two lines below run as a forward clear that never writes the code.
test('armadillo-switch converts its DJN into an SPL and clears forward', () => {
  const rules = '94nop', P = { STEP: 3510, HOP: 56 };
  const settings = recipeSettings(rules, 100);
  const built = buildTree({ id: 'armadillo-switch', P }, { rules, length: 100 });
  const w = compile(built.source, 'redcode', settings);
  assert.ok(w.ok, JSON.stringify(w.errors));
  const vm = new VM(settings);
  vm.load([w], { positions: [0] });
  const loopIdx = built.labels[Object.keys(built.labels).find((k) => k.endsWith('asLoop'))];
  let switched = false;
  for (let t = 0; t < 20000 && !switched; t++) {
    if (vm.peek(loopIdx).op === 'SPL') switched = true;
    vm.run(1);
  }
  assert.ok(switched, 'armadillo-switch never copied its SPL over its DJN');
  vm.run(40000);
  assert.ok(vm.warriors[0].alive, 'armadillo-switch died running its own clear');
});

// A copy of a block whose emitted code is altered by `f`, to show its watch notices.
let copies = 0;
function broken(id, f, P) {
  const orig = leaves[id], nid = `broken${++copies}-${id}`;
  leaves[nid] = { ...orig, id: nid, emit: (ctx) => orig.emit({ ...ctx, ins: (l, o, m, a, b = '0') => ctx.ins(l, ...f(l, o, m, a, b)) }) };
  const scenarioFix = (api) => ({ ...api, scenario: api.scenario.replace(nid, id) });
  leaves[nid].watch = (api) => orig.watch(scenarioFix(api));
  if (orig.running) leaves[nid].running = orig.running;
  if (orig.plant) leaves[nid].plant = (api) => orig.plant(scenarioFix(api));
  return { id: nid, ...(P ? { P } : {}) };
}

test('the watches catch a broken mechanism', () => {
  // armadillo-switch: turn the A-trail MOV into a NOP, so the SPL is never
  // copied over the DJN and the switch never happens.
  const noSwitch = broken('armadillo-switch', (l, o, m, a, b) => (l === 'asAmov' ? ['NOP', m, a, b] : [o, m, a, b]));
  assert.throws(() => buildTree({ id: noSwitch.id }, { rules: '94nop', length: 100 }), /never copied its SPL|stopped running|did not survive/, noSwitch.id);

  // self-add-stone: break the {0,}0 self-add into add #0, so the MOV pointer
  // never advances and it bombs a single cell.
  const stuck = broken('self-add-stone', (l, o, m, a, b) => (l === 'safAdd' ? [o, m, '#0', b] : [o, m, a, b]));
  assert.throws(() => buildTree({ id: stuck.id }, { rules: '94nop', length: 100 }), /too few cells|bombed its own code/, stuck.id);

  // delayed-pump: cut the idle down to one pass, so the launch is not delayed.
  const noIdle = broken('delayed-pump', (l, o, m, a, b) => (l === 'dpIdle' ? [o, m, a, '#1'] : [o, m, a, b]));
  assert.throws(() => buildTree({ id: noIdle.id }, { rules: '94nop', length: 100 }), /launched after only|delayed-pump/, noIdle.id);
});
