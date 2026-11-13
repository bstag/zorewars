// Tests for the X-hill ladder scanner (tools/algebra/blocks/xladder.js): ladder-scanner.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, treeMismatches, leaves, shape, link, treeSettings } from '../tools/algebra/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';
import { compile, VM } from '../src/engine/index.js';

const seq = (...kids) => ({ id: 'seq', kids });
const ok = (tree, rules, length = 100) => {
  const built = buildTree(tree, { rules, length });
  assert.equal(built.verification.ok, true, `${shape(tree)} on ${rules}`);
  return built;
};
function solo(P = {}, rules = '94nop') {
  const settings = treeSettings(rules, 100), Q = { ...leaves['ladder-scanner'].defaults, ...P };
  const r = link({ id: 'ladder-scanner', P: Q }, settings), w = compile(r.source, 'redcode', settings);
  assert.ok(w.ok, JSON.stringify(w.errors));
  const vm = new VM(settings); vm.load([w], { positions: [0] });
  return { vm, at: (l) => r.labels[`b0${l}`], core: settings.coreSize };
}

test('ladder-scanner builds alone, behind an opening, booted and with decoys, on both cores', () => {
  assert.equal(typeof leaves['ladder-scanner'].watch, 'function');
  // On 94x the gate runs all 500,000 cycles: three laps, so all three rungs are checked.
  assert.equal(ok({ id: 'ladder-scanner' }, '94x').total, 19);
  ok({ id: 'ladder-scanner' }, '94nop');
  ok(seq({ id: 'opening-quickscan' }, { id: 'ladder-scanner' }), '94nop', 50);
  ok({ id: 'boot', kids: [{ id: 'ladder-scanner' }] }, '94x', 50);
  ok({ id: 'image', kids: [{ id: 'ladder-scanner' }, { id: 'decoys' }] }, '94nop', 50);
});

test('bad settings are refused', () => {
  const x = recipeSettings('94x');
  const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  has({ id: 'ladder-scanner', P: { STEP: 5544 } }, x, /looks at only 10 cells/);
  has({ id: 'ladder-scanner' }, recipeSettings('88'), /needs ICWS'94/);
  has({ id: 'par', kids: [{ id: 'ladder-scanner' }, { id: 'imp' }] }, x, /a clear runs alone/);
});

// Directly, on the 8,000 core: the carpet lays SPL in the first lap, JMP in the
// second and DAT after that; a find moves the carpet to one cell before it.
test('ladder-scanner changes its bomb lap by lap and re-aims its carpet at a find', () => {
  const { vm, at, core } = solo();
  const lapCycles = 3 * core;                 // STEP is coprime to the core: 3 cycles a look
  const find = (5 * leaves['ladder-scanner'].defaults.STEP + 1) % core;         // the fifth look
  for (let i = 0; i < 3; i++) vm.poke(find + i, { op: 'MOV', mod: 'I', aMode: '$', a: 0, bMode: '$', b: 1 });
  vm.run(60);
  for (let k = -1; k < 3; k++) assert.equal(vm.peek(find + k).op, 'SPL', `carpet at find${k < 0 ? k : '+' + k}`);
  assert.equal(vm.peek(find - 2).op, 'DAT');
  const selected = () => vm.peek(at('lsPtr') + vm.peek(at('lsPtr')).a).op;
  assert.equal(selected(), 'SPL');
  // A cell the carpet reaches in every lap: the op laid there shows the rung.
  const probe = find + 200;
  vm.run(lapCycles - 60 - 600);
  assert.equal(vm.peek(probe).op, 'SPL', 'first lap');
  vm.run(700);
  assert.equal(selected(), 'JMP', 'second rung after one lap');
  assert.ok(vm.peek(at('lsCp')).b >= 19 && vm.peek(at('lsCp')).b < 120, 'the carpet restarted just past the block');
  vm.run(lapCycles - 500);
  assert.equal(vm.peek(probe).op, 'JMP', 'second lap');
  vm.run(600);
  assert.equal(selected(), 'DAT', 'third rung after two laps');
  vm.run(lapCycles);
  assert.equal(selected(), 'DAT', 'the ladder stops at DAT');
  assert.equal(vm.peek(probe).op, 'DAT', 'third lap');
  assert.ok(vm.warriors[0].alive);
  assert.equal(vm.warriors[0].peak, 1);
  assert.equal(vm.peek(at('lsLoop')).op, 'MOV');
  assert.equal(vm.peek(at('lsR0')).op, 'SPL');
});

test('the watch catches a ladder that does not move up', () => {
  const orig = leaves['ladder-scanner'], nid = 'broken-ladder-scanner';
  // The rung bump becomes a NOP: every lap lays SPL.
  let adds = 0;
  leaves[nid] = { ...orig, id: nid, emit: (ctx) => { adds = 0; orig.emit({ ...ctx, pc: ctx.pc, ins: (l, o, m, a, b = '0') => (o === 'SUB' && m === 'A' ? ctx.ins(l, 'NOP', 'F', a, b) : ctx.ins(l, o, m, a, b)) }); void adds; } };
  const fix = (api) => ({ ...api, scenario: api.scenario.replace(nid, 'ladder-scanner') });
  leaves[nid].watch = (api) => orig.watch(fix(api));
  leaves[nid].plant = (api) => orig.plant(fix(api));
  assert.throws(() => buildTree({ id: nid }, { rules: '94nop', length: 100 }), /did not move up one rung|wrong rung/);
});

// A copy-ahead boot starts the copy as soon as its entry is in and joins it when the copy is
// done. The entry sits after the loop and the find path, so both are in place first, and it
// is a one-shot gate: the joining boot process dies on it, leaving one scanner, not two.
test('ladder-scanner runs under boot EARLY 1 as one process', () => {
  for (const rules of ['94x', '94nop']) for (const UNROLL of [1, 2]) {
    const built = ok({ id: 'boot', P: { EARLY: 1, UNROLL }, kids: [{ id: 'ladder-scanner' }] }, rules, 50);
    const vm = new VM(built.settings); vm.load([built.w], { positions: [0] });
    vm.run(400);
    assert.equal(vm.warriors[0].peak, 2, 'the boot process joined');
    assert.equal(vm.processes(0).length, 1, 'and died on the gate');
    const core = built.settings.coreSize, hop = built.tree.P?.HOP ?? 4096;
    const label = (suffix) => built.labels[Object.keys(built.labels).find((k) => k.endsWith(suffix))];
    const loop = (hop + label('lsLoop')) % core;
    assert.ok(vm.processes(0)[0] >= loop && vm.processes(0)[0] <= loop + 2, 'the survivor is in the scan loop of the copy');
    assert.equal(vm.peek((hop + label('lsR0')) % core).op, 'SPL', 'the bombs were copied');
  }
});

test('ladder-scanner passes full verification on both cores', () => {
  for (const rules of ['94x', '94nop']) assert.equal(buildTree({ id: 'ladder-scanner' }, { rules, length: 100, verification: 'full' }).verification.ok, true);
});

// The STP option, under the hill's rules with P-space: a victim stores 77 in its P-space cell 5 and
// then sits in a one-cell loop. Against the plain scanner the 77 is still there at the end of the
// round; against the STP one it has been overwritten. Without P-space the option is refused.
test('ladder-scanner STP 1 brainwashes a victim under 94x-hill rules and is refused without P-space', () => {
  const settings = treeSettings('94x-hill', 200);
  assert.ok(settings.pSpace, 'the hill rules have P-space');
  const victim = compile(';name victim\nORG v\nv stp.ab #77, #5\n jmp 0, 1\nEND', 'redcode', settings);
  assert.ok(victim.ok, JSON.stringify(victim.errors));
  const fight = (STP) => {
    const P = { ...leaves['ladder-scanner'].defaults, STP };
    const w = compile(link({ id: 'ladder-scanner', P }, settings).source, 'redcode', settings);
    assert.ok(w.ok, JSON.stringify(w.errors));
    const vm = new VM(settings); vm.load([w, victim], { positions: [0, 300] });
    while (!vm.done && vm.cycle < 400000) vm.step();
    return vm.warriors[1].pspace[5];
  };
  assert.equal(fight(0), 77, 'the plain scanner leaves the victim\'s P-space alone');
  assert.notEqual(fight(1), 77, 'the STP bomb overwrote the victim\'s cell 5');
  assert.equal(buildTree({ id: 'ladder-scanner', P: { STP: 1 } }, { rules: '94x-hill', length: 200 }).verification.ok, true);
  assert.equal(buildTree({ id: 'ladder-scanner', P: { STP: 1 } }, { rules: '94x-hill', length: 200, verification: 'full' }).verification.ok, true);
  assert.ok(treeMismatches({ id: 'ladder-scanner', P: { STP: 1 } }, recipeSettings('94x')).some((m) => /needs a rule set with P-space/.test(m)));
});
