// Tests for the hillscan blocks (scanner-pendulum, oneshot-cobra).
import test from 'node:test';
import assert from 'node:assert/strict';

const { buildTree, treeMismatches, leaves, shape } = await import('../tools/algebra/index.js');
const { recipeSettings } = await import('../tools/blocks/recipes.js');
const { compile, VM } = await import('../src/engine/index.js');

const NEW = ['94nop', 'lp', '94x'];
const seq = (...kids) => ({ id: 'seq', kids });
const mod = (x, core) => ((x % core) + core) % core;

const ok = (tree, rules, planted = []) => {
  const built = buildTree(tree, { rules, length: 100 });
  assert.equal(built.verification.ok, true, `${shape(tree)} on ${rules}`);
  const scenarios = built.verification.observations.map((o) => o.scenario);
  for (const id of planted) assert.ok(scenarios.includes(`${id}: planted target`), `${shape(tree)} on ${rules}: no planted run for ${id}`);
  return built;
};

const stone = { id: 'mod-stone' };

test('blocks load with working defaults', () => {
  for (const id of ['scanner-pendulum', 'oneshot-cobra']) {
    assert.ok(leaves[id], id);
    assert.equal(typeof leaves[id].watch, 'function', id);
    assert.equal(typeof leaves[id].plant, 'function', id);
  }
});

test('scanner-pendulum scans, wipes and becomes a clear, alone and in combinations', () => {
  for (const rules of NEW) {
    ok({ id: 'scanner-pendulum' }, rules, ['scanner-pendulum']);
    ok({ id: 'boot', P: { HOP: 3000 }, kids: [{ id: 'scanner-pendulum' }] }, rules, ['scanner-pendulum']);
    ok({ id: 'apart', P: { D: 4000 }, kids: [{ id: 'scanner-pendulum' }, stone] }, rules);
    ok({ id: 'scanner-pendulum', P: { STEP: 2341, TIME: 40, ROOM: 300 } }, rules, ['scanner-pendulum']);
  }
});

test('oneshot-cobra commits on a body and clears, alone and beside a stone', () => {
  for (const rules of NEW) {
    ok({ id: 'oneshot-cobra' }, rules, ['oneshot-cobra']);
    ok({ id: 'apart', P: { D: 4000 }, kids: [{ id: 'oneshot-cobra' }, stone] }, rules, ['oneshot-cobra']);
    ok({ id: 'oneshot-cobra', P: { STEP: 2341, GAP: 6, TIME: 4000, ROOM: 300 } }, rules, ['oneshot-cobra']);
  }
});

test('bad settings are refused', () => {
  const s94 = recipeSettings('94nop'), s88 = recipeSettings('88');
  const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  // '94-only: neither block can be written in strict '88.
  has({ id: 'scanner-pendulum' }, s88, /ICWS'94/);
  has({ id: 'oneshot-cobra' }, s88, /ICWS'94/);
  // ROOM wide enough to swallow the scan window.
  has({ id: 'scanner-pendulum', P: { STEP: 17, TIME: 18, ROOM: 4000 } }, s94, /no room/);
  has({ id: 'oneshot-cobra', P: { STEP: 19, GAP: 10, TIME: 8000, ROOM: 4000 } }, s94, /no room/);
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
  // scanner-pendulum: the flip never happens (the MOV dbomb,bomb is turned into
  // a no-op), so alone the wipe never becomes a DAT clear.
  const pb = broken('scanner-pendulum', (l, o, m, a, b) => (o === 'MOV' && m === 'I' && a.endsWith('dbomb') && b.endsWith('bomb') ? [o, m, a, a] : [o, m, a, b]));
  assert.throws(() => buildTree({ id: pb.id }, { rules: '94nop', length: 100 }), /never flipped/, pb.id);
  // oneshot-cobra: the clear no longer steps past its own image on a wrap, so
  // it eventually writes over its own code.
  const cb = broken('oneshot-cobra', (l, o, m, a, b) => (l === 'cFix' ? [o, m, '#0', b] : [o, m, a, b]));
  assert.throws(() => buildTree({ id: cb.id }, { rules: '94nop', length: 100 }), /its own code|did not|reach/, cb.id);
});

// Build a single-block warrior, poke the core, run, and report what happened:
// how many SPL/DAT the wipe laid where, and whether the clear committed.
function runPoked(id, P, rules, pokes, cycles) {
  const settings = recipeSettings(rules, 100);
  const built = buildTree({ id, ...(P ? { P } : {}) }, { rules, length: 100 });
  const w = compile(built.source, 'redcode', settings);
  assert.ok(w.ok, JSON.stringify(w.errors));
  const labels = {};
  for (const [lbl, idx] of Object.entries(built.labels)) labels[lbl.replace(/^b0/, '')] = idx;
  const vm = new VM(settings);
  vm.load([w], { positions: [0] });
  for (const [c, ins] of pokes) vm.poke(mod(c, settings.coreSize), ins);
  let committed = false;
  const commitPc = labels.commit, cLoopPc = labels.cLoop;
  while (!vm.done && vm.cycle < cycles) {
    const pc = vm.processes(0)[0];
    if (pc === commitPc || (commitPc === undefined && pc === cLoopPc)) committed = true;
    vm.step();
  }
  return { vm, w, labels, settings, committed };
}

const M = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };

test('scanner-pendulum wipes a whole body until the first empty cell', () => {
  const settings = recipeSettings('94nop');
  const core = settings.coreSize;
  const built = buildTree({ id: 'scanner-pendulum' }, { rules: '94nop', length: 100 });
  const labels = {};
  for (const [lbl, idx] of Object.entries(built.labels)) labels[lbl.replace(/^b0/, '')] = idx;
  const ptr = labels.ptr, step = 17;
  // a body of five adjacent cells, well clear of the warrior
  const base = 3000;
  const pokes = [];
  for (let k = 0; k < 5; k++) pokes.push([base + k, M]);
  const { vm } = runPoked('scanner-pendulum', null, '94nop', pokes, 4000);
  // the five body cells (and only those) are stunned with SPL
  for (let k = 0; k < 5; k++) assert.equal(vm.peek(base + k).op, 'SPL', `body cell ${k} stunned`);
  assert.notEqual(vm.peek(base + 5).op, 'SPL', 'the wipe stopped at the empty cell after the body');
});

test('oneshot-cobra ignores a lone bomb but commits on a two-cell body', () => {
  // the scan looks at ptr.B offsets; find the first in-range cell like the block does
  const settings = recipeSettings('94nop');
  const built = buildTree({ id: 'oneshot-cobra' }, { rules: '94nop', length: 100 });
  const labels = {};
  for (const [lbl, idx] of Object.entries(built.labels)) labels[lbl.replace(/^b0/, '')] = idx;
  const w = compile(built.source, 'redcode', settings);
  const ptr = labels.ptr, step = 19, len = w.instructions.length;
  let target = -1, found = 0;
  for (let k = 1; k < 5000 && target < 0; k++) {
    const c = mod(ptr + w.instructions[ptr].b + k * step, settings.coreSize);
    let clear = true;
    for (let j = -4; j <= 8 && clear; j++) if (mod(c + j, settings.coreSize) < len) clear = false;
    if (clear && ++found === 3) target = c;
  }
  assert.ok(target > 0);
  // a single isolated cell: bomb detection drops it
  const lone = runPoked('oneshot-cobra', null, '94nop', [[target, M]], 3000);
  assert.equal(lone.committed, false, 'a lone bomb must not trigger the oneshot');
  // two adjacent cells: a body, so it commits
  const body = runPoked('oneshot-cobra', null, '94nop', [[target, M], [target + 1, M]], 3000);
  assert.equal(body.committed, true, 'a two-cell body must trigger the oneshot');
});
