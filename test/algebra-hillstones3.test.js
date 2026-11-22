// Tests for the hillstones3 blocks (tools/algebra/blocks/hillstones3.js):
// bomb-pointer-stone (Quicksilver's bomb-as-second-pointer stone whose wreck
// becomes a clear, with Reepicheep's short HOP as a parameter) and
// airbag-clear-stone (a stone that abandons itself for a clear when its airbag
// is hit, or when its own trail comes home onto it).

import test from 'node:test';
import assert from 'node:assert/strict';

const { buildTree, treeMismatches, leaves, shape } = await import('../tools/algebra/index.js');
const { link } = await import('../tools/algebra/link.js');
const { recipeSettings } = await import('../tools/blocks/recipes.js');
const { compile, VM } = await import('../src/engine/index.js');

const seq = (...kids) => ({ id: 'seq', kids });
const qscan = { id: 'opening-qscan-mul' };
const ok = (tree, rules, planted = []) => {
  const built = buildTree(tree, { rules, length: 100 });
  assert.equal(built.verification.ok, true, `${shape(tree)} on ${rules}`);
  const scenarios = built.verification.observations.map((o) => o.scenario);
  for (const id of planted) assert.ok(scenarios.includes(`${id}: planted target`), `${shape(tree)} on ${rules}: no planted run for ${id}`);
  return built;
};
// The 55,440-cell X hill needs its own steps (the defaults suit 8,000).
const BP_X = { STEP: 6691, TIME: 6000 };
const AB_X = { STEP: 2077, TIME: 6000 };
const bp = (P) => ({ id: 'bomb-pointer-stone', ...(P ? { P: { ...leaves['bomb-pointer-stone'].defaults, ...P } } : {}) });
const ab = (P) => ({ id: 'airbag-clear-stone', ...(P ? { P: { ...leaves['airbag-clear-stone'].defaults, ...P } } : {}) });

// A compiled copy of a tree, its labels, and a VM with it loaded at 0.
function load(tree, rules) {
  const settings = recipeSettings(rules, 100);
  const l = link(tree, settings);
  const w = compile(l.source, 'redcode', settings);
  assert.ok(w.ok, JSON.stringify(w.errors));
  const vm = new VM(settings);
  vm.load([w], { positions: [0] });
  const at = (name) => l.labels[Object.keys(l.labels).find((k) => k.endsWith(name))];
  return { vm, at, settings, size: w.instructions.length };
}

test('both blocks load with purpose, params and a watch', () => {
  for (const id of ['bomb-pointer-stone', 'airbag-clear-stone']) {
    assert.ok(leaves[id], id);
    assert.ok(leaves[id].purpose && leaves[id].params, id);
    assert.equal(typeof leaves[id].watch, 'function', `${id} watch`);
  }
});

test('bomb-pointer-stone builds alone and behind the MUL quickscan on 94nop, lp and 94x', () => {
  ok(bp(), '94nop');
  ok(bp(), 'lp');
  ok(bp(BP_X), '94x');
  ok(bp({ HOP: 31, STEP: 1913, TIME: 2000 }), '94nop');              // pairs 31 apart, as Reepicheep
  ok(seq(qscan, bp()), '94nop', ['opening-qscan-mul']);
  ok(seq(qscan, bp()), 'lp');
  ok(seq(qscan, bp(BP_X)), '94x');
});

test('bomb-pointer-stone runs in a paper/stone fan boot', () => {
  ok({ id: 'fanboot', kids: [bp(), { id: 'silk-imps' }] }, '94nop');
  ok(seq(qscan, { id: 'probe-burst2' }, { id: 'fanboot', kids: [bp({ STEP: 1913, TIME: 1900 }), { id: 'silk-imps' }] }), '94nop');
});

test('airbag-clear-stone builds (with its planted hit) alone, behind the quickscan and in a fan boot', () => {
  ok(ab(), '94nop', ['airbag-clear-stone']);
  ok(ab(), 'lp', ['airbag-clear-stone']);
  ok(ab(AB_X), '94x', ['airbag-clear-stone']);
  ok(ab({ PROCS: 2, TIME: 3000 }), '94nop', ['airbag-clear-stone']);
  ok(seq(qscan, ab()), '94nop', ['airbag-clear-stone']);
  ok(seq(qscan, ab(AB_X)), '94x');
  ok({ id: 'fanboot', kids: [ab(), { id: 'silk-imps' }] }, '94nop', ['airbag-clear-stone']);
});

test('bad settings are refused', () => {
  const s94 = recipeSettings('94nop', 100), s88 = recipeSettings('88', 100);
  const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  has(bp(), s88, /needs ICWS'94/);
  has(bp({ TIME: 2500 }), s94, /bombs its own live cell/);                 // STEP 2857: the feeder comes first
  has(bp({ STEP: 2000 }), s94, /reaches only/);
  has(bp({ STEP: 1000, TIME: 100 }), s94, /lattice that sparse/);          // gcd 2000
  has(bp({ HOP: 31, STEP: 1913, TIME: 4100 }), s94, /past the first lap/);
  has(bp({ HOP: 8000 }), s94, /whole core/);
  has(ab(), s88, /needs ICWS'94/);
  has(ab({ STEP: 3039 }), s94, /bombs its own/);
  has(ab({ TIME: 4500 }), s94, /more than a lap/);
  has(ab({ STEP: 2000 }), s94, /reaches only/);
  // No paper/stone par: the wreck is a core clear.
  assert.ok(treeMismatches({ id: 'par', kids: [bp(), { id: 'paper' }] }, s94).some((m) => /a clear runs alone/.test(m)));
});

// The wreck, directly: on pass TIME write 1 lands on the ADD; the DAT's `>-3`
// then walks the pointer up one cell a process, clearing the core; when the
// clear comes round it overwrites the pointer cell first and parks in the
// three dead cells below it, leaving the feeder and write 1 alive.
test('bomb-pointer-stone wrecks its ADD into a clear that parks below its feeder', () => {
  const { vm, at, settings } = load(bp(), '94nop');
  const add = at('bpHit'), feed = at('bpFeed'), w1 = at('bpW1'), w2 = at('bpW2');
  let wreck = null;
  for (let c = 0; c < 40000 && wreck === null; c++) { vm.step(); if (vm.peek(add).op === 'DAT') wreck = vm.cycle; }
  assert.ok(wreck !== null && wreck > 4000, `the ADD was wrecked at ${wreck}`);
  vm.run(settings.maxCycles - vm.cycle);
  assert.ok(vm.warriors[0].alive, 'it died after the wreck');
  assert.equal(vm.peek(feed).op, 'SPL', 'the clear overwrote the feeder');
  assert.equal(vm.peek(w1).op, 'MOV', 'the clear overwrote write 1');
  assert.equal(vm.peek(w2).op, 'DAT', 'the clear did not come round to the pointer');
  let bombed = 0;
  for (let c = 8; c < settings.coreSize; c++) if (vm.peek(c).op === 'DAT' && vm.peek(c).a) bombed++;
  assert.ok(bombed > settings.coreSize * 0.95, `the clear covered only ${bombed} cells`);
});

// The airbag, directly: a hit on the bag sends every process into the clear
// within a pass, and the clear never writes the block.
test('airbag-clear-stone abandons the stone the moment its airbag is hit', () => {
  const { vm, at, settings, size } = load(ab(), '94nop');
  const bag = at('abBag'), clr = at('abClr'), clr2 = at('abClr2');
  vm.run(500);
  vm.poke(bag, { op: 'DAT', mod: 'F', aMode: '#', a: 0, bMode: '#', b: 1 });
  vm.run(60);
  const procs = vm.processes(0);
  assert.ok(procs.length >= 4 && procs.every((pc) => pc === clr || pc === clr2), `processes at ${procs}`);
  const code = Array.from({ length: size }, (_, i) => vm.disassemble(i));
  vm.run(40000);
  assert.ok(vm.warriors[0].alive);
  for (let i = 0; i < size; i++) if (i !== at('abCPtr') && i !== bag) assert.equal(vm.disassemble(i), code[i], `the clear wrote cell ${i}`);
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
  const build = (t) => () => buildTree(t, { rules: '94nop', length: 100 });
  // The wreck's `>` aimed one cell off: the pointer never moves, so no clear.
  const noClear = broken('bomb-pointer-stone', (l, o, m, a, b) => (l === 'bpBomb' ? [o, m, a, '>-2'] : [o, m, a, b]));
  assert.throws(build({ id: noClear.id }), /wreck clear wrote only|own/, noClear.id);
  // The start pointer one lattice cell off: the trail comes home somewhere live.
  const offAim = broken('bomb-pointer-stone', (l, o, m, a, b) => (l === 'bpW2' ? [o, m, a, `}${Number(b.slice(1)) + 1}`] : [o, m, a, b]));
  assert.throws(build({ id: offAim.id }), /bombed its own|never wrecked|wrecked its ADD on pass|did not survive|stopped running/, offAim.id);
  // An airbag that is never tested: the planted hit changes nothing.
  const noBag = broken('airbag-clear-stone', (l, o, m, a, b) => (l === 'abChk' ? ['JMP', 'B', a, '0'] : [o, m, a, b]));
  assert.throws(build({ id: noBag.id }), /airbag|own/, noBag.id);
  // The clear's restart cell (the bomb's B-field) pointing into the block.
  const selfClear = broken('airbag-clear-stone', (l, o, m, a, b) => (l === 'abDBomb' ? [o, m, a, '#3'] : [o, m, a, b]));
  assert.throws(build({ id: selfClear.id }), /clear wrote its own|did not survive|stopped running/, selfClear.id);
});
