// Tests for the X-hill brainwash scanner (tools/algebra/blocks/xbrainwash.js): brainwash-scanner.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, treeMismatches, leaves, shape, link, treeSettings } from '../tools/algebra/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';
import { compile, VM } from '../src/engine/index.js';

const ID = 'brainwash-scanner';
const ok = (tree, rules, length, verification = 'quick') => {
  const built = buildTree(tree, { rules, length, verification });
  assert.equal(built.verification.ok, true, `${shape(tree)} on ${rules}`);
  return built;
};
function solo(P, rules, length) {
  const settings = treeSettings(rules, length), Q = { ...leaves[ID].defaults, ...P };
  const r = link({ id: ID, P: Q }, settings), w = compile(r.source, 'redcode', settings);
  assert.ok(w.ok, JSON.stringify(w.errors));
  return { settings, w, at: (l) => r.labels[`b0${l}`], core: settings.coreSize };
}

test('brainwash-scanner builds with its brainwash carpet under P-space rules and without it elsewhere', () => {
  assert.equal(typeof leaves[ID].watch, 'function');
  assert.equal(ok({ id: ID }, '94x-hill', 200).total, 20);
  ok({ id: ID }, '94x-hill', 200, 'full');
  ok({ id: ID }, 'pspace', 100, 'full');                                   // 8,000 cells with P-space
  ok({ id: 'boot', kids: [{ id: ID }] }, '94x-hill', 200);
  ok({ id: 'seq', kids: [{ id: 'opening-quickscan' }, { id: ID }] }, '94x-hill', 200);
  ok({ id: 'image', kids: [{ id: 'boot', kids: [{ id: ID }] }, { id: 'decoy-field', P: { COUNT: 150 } }] }, '94x-hill', 200);
  assert.equal(ok({ id: ID, P: { WASH: 0 } }, '94x', 50).total, 17);
  ok({ id: ID, P: { WASH: 0 } }, '94nop', 50, 'full');
  ok({ id: ID, P: { WASH: 0 } }, '94x', 50, 'full');
});

test('bad settings are refused', () => {
  const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  has({ id: ID }, recipeSettings('94x', 50), /needs a rule set with P-space/);
  has({ id: ID }, recipeSettings('94nop', 50), /needs a rule set with P-space/);
  has({ id: ID, P: { STEP: 14 } }, recipeSettings('94x-hill', 200), /shares a factor/);
  has({ id: 'par', kids: [{ id: ID, P: { WASH: 0 } }, { id: 'imp' }] }, recipeSettings('94x', 50), /a clear runs alone/);
});

// Alone on the 8,000-cell P-space core: one lap of the scan, then the carpet over all the core but
// the block, then the imp-step clear, with the scanner's own cells never written.
test('brainwash-scanner: scan lap, then the brainwash carpet over the core, then the clear', () => {
  const { settings, w, at, core } = solo({}, 'pspace', 100);
  const vm = new VM(settings); vm.load([w], { positions: [0] });
  let looks = 0;
  while (vm.processes(0)[0] !== at('bwWash')) { if (vm.processes(0)[0] === at('bwLook')) looks++; vm.step(); assert.ok(vm.cycle < 3 * core, 'the lap never ended'); }
  assert.equal(looks, core);
  while (vm.processes(0)[0] !== at('bwClr')) { vm.step(); assert.ok(vm.cycle < 6 * core, 'the carpet never ended'); }
  let stp = 0;
  for (let c = 20; c < core; c++) if (vm.peek(c).op === 'STP') stp++;
  assert.equal(stp, core - 20 - 8, 'the carpet covers the core but the block and a margin above it');
  for (let c = 0; c < 20; c++) assert.notEqual(vm.peek(c).op === 'STP' && c !== at('bwStp'), true, `cell ${c}`);
  vm.run(20000);
  assert.ok(vm.warriors[0].alive);
  assert.ok(vm.processes(0).every((q) => q >= at('bwClr') && q <= at('bwDjn')), 'every process is in the clear');
  let dat = 0;
  for (let c = 20; c < core; c++) if (vm.peek(c).op === 'DAT') dat++;
  assert.ok(dat > 2000, `${dat} cells cleared`);
});

// The brainwash, under the hill's rules: a stunned victim that kept 77 in its P-space cell 5 has
// lost it by the end of the round; without the carpet (WASH 0) it still has it.
test('brainwash-scanner overwrites a stunned victim\'s P-space; WASH 0 leaves it alone', () => {
  const run = (WASH) => {
    const { settings, w } = solo({ WASH }, '94x-hill', 200);
    const victim = compile(';name victim\nORG v\nv stp.ab #77, #5\n spl 0, 1\n jmp -1, 1\nEND', 'redcode', settings);
    assert.ok(victim.ok, JSON.stringify(victim.errors));
    const vm = new VM(settings); vm.load([w, victim], { positions: [0, 3 * leaves[ID].defaults.STEP * 100 + 1000] });
    vm.run();
    return { cell: vm.warriors[1].pspace[5], ours: vm.warriors[0].alive, theirs: vm.warriors[1].alive };
  };
  const plain = run(0), washed = run(1);
  assert.equal(plain.cell, 77);
  assert.notEqual(washed.cell, 77);
  assert.ok(washed.ours && !washed.theirs, 'and the victim is dead at the end');
});

// The clear at the end is the imp-step clear with its gate lowest: a 64-process 13-point spiral
// that scanner-pendulum never beats dies on it.
test('brainwash-scanner (WASH 0) kills a 13-point spiral on the 55,440 core', () => {
  const settings = treeSettings('94x', 100);
  const build = (tree) => compile(link(tree, settings).source, 'redcode', settings);
  const spiral = build({ id: 'vector-spiral', P: { ...leaves['vector-spiral'].defaults, N: 13, K: 6 } });
  const ours = build({ id: ID, P: { ...leaves[ID].defaults, WASH: 0 } });
  assert.ok(spiral.ok && ours.ok);
  const results = [9000, 21013, 33333, 47001].map((offset) => {
    const vm = new VM(settings); vm.load([ours, spiral], { positions: [0, offset] });
    vm.run();
    return vm.warriors[0].alive && !vm.warriors[1].alive ? 'win' : !vm.warriors[0].alive ? 'loss' : 'tie';
  });
  // 19 wins and a loss over 20 load offsets: an arm that arrives while it is still scanning can kill it.
  assert.ok(results.filter((r) => r === 'win').length >= 3, `${results}`);
});

test('the watch catches a scanner whose carpet is not a brainwash', () => {
  const orig = leaves[ID], nid = 'broken-brainwash-scanner';
  leaves[nid] = { ...orig, id: nid, emit: (ctx) => orig.emit({ ...ctx, pc: ctx.pc, ins: (l, o, m, a, b = '0') => (l === 'bwStp' ? ctx.ins(l, 'NOP', 'F', '#0', '#0') : ctx.ins(l, o, m, a, b)) }) };
  const fix = (api) => ({ ...api, scenario: api.scenario.replace(nid, ID) });
  leaves[nid].watch = (api) => orig.watch(fix(api));
  leaves[nid].plant = (api) => orig.plant(fix(api));
  assert.throws(() => buildTree({ id: nid }, { rules: '94x-hill', length: 200 }), /something other than STP|did not overwrite the victim/);
});
