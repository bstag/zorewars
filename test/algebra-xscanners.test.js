// Tests for the X-hill follow scanner (tools/algebra/blocks/xscanners.js): follow-scanner.
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
function solo(P = {}, rules = '94x') {
  const settings = treeSettings(rules, 100), Q = { ...leaves['follow-scanner'].defaults, ...P };
  const r = link({ id: 'follow-scanner', P: Q }, settings), w = compile(r.source, 'redcode', settings);
  assert.ok(w.ok, JSON.stringify(w.errors));
  const vm = new VM(settings); vm.load([w], { positions: [0] });
  return { vm, w, settings, at: (l) => r.labels[`b0${l}`], core: settings.coreSize, source: r.source };
}
const imp = (b) => ({ op: 'MOV', mod: 'I', aMode: '$', a: 0, bMode: '$', b });

test('follow-scanner builds alone, behind an opening and booted, on both cores', () => {
  assert.equal(typeof leaves['follow-scanner'].watch, 'function');
  assert.equal(ok({ id: 'follow-scanner' }, '94x').total, 19);
  ok({ id: 'follow-scanner' }, '94nop');
  ok(seq({ id: 'opening-quickscan' }, { id: 'follow-scanner' }), '94nop', 50);
  ok({ id: 'boot', kids: [{ id: 'follow-scanner' }] }, '94x', 50);
});

test('bad settings are refused', () => {
  const x = recipeSettings('94x');
  const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  has({ id: 'follow-scanner', P: { STEP: 5544 } }, x, /shares a factor/);
  has({ id: 'follow-scanner', P: { STEP: 14 } }, x, /shares a factor/);
  has({ id: 'follow-scanner' }, recipeSettings('88'), /needs ICWS'94/);
  // It ends as a core clear, so it takes no partner beside it.
  has({ id: 'par', kids: [{ id: 'follow-scanner' }, { id: 'imp' }] }, x, /a clear runs alone/);
});

// Directly: three stretches of imp-like cells one "ring step" apart. Only the
// first is on the scan's path; the others are reached by following B-fields.
test('follow-scanner wipes a find to its end, then follows the B-field from arm to arm', () => {
  const { vm, at, core } = solo();
  const first = (3 * leaves['follow-scanner'].defaults.STEP) % core + 2000 * 0, ringStep = 4001;
  const arms = [first, first + ringStep, first + 2 * ringStep];
  for (const a of arms) for (let i = 0; i < 4; i++) vm.poke(a + i, imp(ringStep));
  vm.run(200);
  // The scan's find is wiped from the cell found to the first empty cell.
  for (let i = 0; i < 4; i++) assert.equal(vm.peek(first + i).op, 'SPL', `first arm, cell ${i}`);
  // The follow lands on the cell the last one pointed at (the next arm's head) and wipes on from there.
  for (const a of arms.slice(1)) assert.equal(vm.peek(a + 3).op, 'SPL', `arm at ${a} was reached by following`);
  for (const a of arms) {
    assert.equal(vm.peek(a + 4).op, 'DAT', 'the wipe stops at the first empty cell');
    assert.equal(vm.peek(a - 1).op, 'DAT');
  }
  assert.equal(vm.warriors[0].peak, 1);
  assert.ok(vm.processes(0)[0] === at('fsScan') || vm.processes(0)[0] === at('fsLook'), 'back to scanning');
});

test('follow-scanner skips its own cells and turns into its clear after one lap', () => {
  const { vm, at, core } = solo({}, '94nop');
  let looks = 0, wipes = 0;
  while (vm.processes(0)[0] !== at('fsClr')) {
    const pc = vm.processes(0)[0];
    if (pc === at('fsLook')) looks++;
    if (pc === at('fsW')) wipes++;
    vm.step();
    assert.ok(vm.cycle < 20000, 'the lap never ended');
  }
  assert.equal(looks, core);            // STEP is coprime to the core: one look a cell
  assert.equal(wipes, 0);               // its own 19 cells were looked at and left alone
  vm.run(3 * core);
  assert.ok(vm.warriors[0].alive, 'the clear laps its own image safely');
  let untouched = 0;
  for (let c = 19; c < core; c++) if (vm.writeCycle[c] < 0) untouched++;
  assert.equal(untouched, 0, 'the clear reached every cell');
});

// The promise the block is for: a 13-point spiral on the X core. A scanner that
// only wipes what it finds loses to it; this one follows the ring and beats it.
test('follow-scanner beats a 13-point imp spiral that scanner-pendulum loses to', () => {
  const settings = treeSettings('94x', 100);
  const build = (tree) => compile(link(tree, settings).source, 'redcode', settings);
  const spiral = build({ id: 'vector-spiral', P: { ...leaves['vector-spiral'].defaults, N: 13 } });
  const ours = build({ id: 'follow-scanner', P: leaves['follow-scanner'].defaults });
  const pend = build({ id: 'scanner-pendulum', P: leaves['scanner-pendulum'].defaults });
  assert.ok(spiral.ok && ours.ok && pend.ok);
  const fight = (w, offset) => {
    const vm = new VM(settings); vm.load([w, spiral], { positions: [0, offset] });
    vm.run();
    return vm.warriors[0].alive && !vm.warriors[1].alive ? 'win' : !vm.warriors[0].alive ? 'loss' : 'tie';
  };
  const offsets = [9000, 21013, 33333, 47001];
  const a = offsets.map((o) => fight(ours, o)), b = offsets.map((o) => fight(pend, o));
  assert.ok(a.filter((r) => r === 'win').length >= 3, `follow-scanner: ${a}`);
  assert.ok(!a.includes('loss'), `follow-scanner: ${a}`);
  assert.ok(b.filter((r) => r === 'win').length === 0, `scanner-pendulum: ${b}`);
});

// A copy of the block whose emitted code is altered by `f`, to show its watch notices.
test('the watch catches a scanner that does not follow', () => {
  const orig = leaves['follow-scanner'], nid = 'broken-follow-scanner';
  leaves[nid] = { ...orig, id: nid, emit: (ctx) => orig.emit({ ...ctx, pc: ctx.pc, ins: (l, o, m, a, b = '0') => (l === 'fsFol' ? ctx.ins(l, 'NOP', 'F', a, b) : ctx.ins(l, o, m, a, b)) }) };
  const fix = (api) => ({ ...api, scenario: api.scenario.replace(nid, 'follow-scanner') });
  leaves[nid].watch = (api) => orig.watch(fix(api));
  leaves[nid].plant = (api) => orig.plant(fix(api));
  assert.throws(() => buildTree({ id: nid }, { rules: '94nop', length: 100 }), /did not follow|did not wipe what the B-field led to/);
});

// On 94x the quick gate stops a growing warrior at 20,000 cycles, before the lap ends
// (110,880 cycles). Here the block runs alone on the 55,440 core through the handoff.
test('follow-scanner hands over to its clear after one lap on the 55,440 core', () => {
  const { vm, at, core } = solo({}, '94x');
  let looks = 0, wipes = 0;
  while (vm.processes(0)[0] !== at('fsClr')) {
    const pc = vm.processes(0)[0];
    if (pc === at('fsLook')) looks++;
    if (pc === at('fsW')) wipes++;
    vm.step();
    assert.ok(vm.cycle < 2 * core + 200, 'the lap never ended');
  }
  assert.equal(looks, core);                       // STEP is coprime to the core: one look a cell
  assert.equal(wipes, 0);
  assert.ok(vm.cycle >= 2 * core && vm.cycle < 2 * core + 100, `handoff at cycle ${vm.cycle}`);
  // The clear is running: its first write resets the gate past the block, then it sweeps.
  vm.run(2000);
  const procs = vm.processes(0);
  assert.ok(procs.length > 30, 'the SPL #0 pump is feeding the clear');
  assert.ok(procs.every((q) => q >= at('fsClr') && q <= at('fsCd')), 'every process is in the clear');
  const gate = vm.peek(at('fsPtr'));
  assert.ok(gate.b > 19 && gate.b < 19 + 2100, `the clear pointer is past the block (${gate.b})`);
  for (let c = 20; c < 1000; c++) assert.ok(vm.writeCycle[c] >= 2 * core, `cell ${c} cleared`);
  // To the end of the round: it laps the core and never touches its own code.
  vm.run();
  assert.ok(vm.warriors[0].alive);
  for (const l of ['fsClr', 'fsCm', 'fsCd', 'fsDat']) assert.equal(vm.writeCycle[at(l)], -1, `${l} untouched`);
  let untouched = 0;
  for (let c = 19; c < core; c++) if (vm.writeCycle[c] < 2 * core) untouched++;
  assert.equal(untouched, 0, 'the clear reached every cell outside the block');
});

test('follow-scanner passes full verification on both cores', () => {
  for (const rules of ['94x', '94nop']) assert.equal(buildTree({ id: 'follow-scanner' }, { rules, length: 100, verification: 'full' }).verification.ok, true);
});

// The STP option, under the hill's rules with P-space: a victim stores 77 in its P-space cell 5 and
// then sits in a one-cell loop. Against the plain scanner the 77 is still there at the end of the
// round; against the STP one it has been overwritten. Without P-space the option is refused.
test('follow-scanner STP 1 brainwashes a victim under 94x-hill rules and is refused without P-space', () => {
  const settings = treeSettings('94x-hill', 200);
  assert.ok(settings.pSpace, 'the hill rules have P-space');
  const victim = compile(';name victim\nORG v\nv stp.ab #77, #5\n jmp 0, 1\nEND', 'redcode', settings);
  assert.ok(victim.ok, JSON.stringify(victim.errors));
  const fight = (STP) => {
    const P = { ...leaves['follow-scanner'].defaults, STP };
    const w = compile(link({ id: 'follow-scanner', P }, settings).source, 'redcode', settings);
    assert.ok(w.ok, JSON.stringify(w.errors));
    const vm = new VM(settings); vm.load([w, victim], { positions: [0, 3 * leaves['follow-scanner'].defaults.STEP * 100 + 1000] });
    while (!vm.done && vm.cycle < 60000) vm.step();
    return vm.warriors[1].pspace[5];
  };
  assert.equal(fight(0), 77, 'the plain scanner leaves the victim\'s P-space alone');
  assert.notEqual(fight(1), 77, 'the STP bomb overwrote the victim\'s cell 5');
  assert.equal(buildTree({ id: 'follow-scanner', P: { STP: 1 } }, { rules: '94x-hill', length: 200 }).verification.ok, true);
  assert.equal(buildTree({ id: 'follow-scanner', P: { STP: 1 } }, { rules: '94x-hill', length: 200, verification: 'full' }).verification.ok, true);
  assert.ok(treeMismatches({ id: 'follow-scanner', P: { STP: 1 } }, recipeSettings('94x')).some((m) => /needs a rule set with P-space/.test(m)));
});
