// resin-stone (tools/algebra/blocks/resin88.js). It builds and passes the gate
// on 88 and 94nop (the gate's watch runs both kill duels); here the mechanism
// is shown piece by piece in the VM: what the trail is, what a process that
// runs a drop does, and the two ways a victim dies of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, gate, leaves, treeMismatches } from '../tools/algebra/index.js';
import { compile, RULESETS, VM } from '../src/engine/index.js';

const ID = 'resin-stone';
const s88 = RULESETS['88'];
const ok = (rules, tree, verification = 'quick') => {
  const built = buildTree(tree, { rules, verification });
  assert.equal(built.verification.ok, true);
  assert.deepEqual(built.w.warnings, []);
  return built;
};
const isDrop = (x) => x.op === 'MOV' && x.aMode === '<' && x.bMode === '<' && x.a === 0;
const load = (...parts) => {
  const vm = new VM(s88);
  vm.load(parts.map(([src]) => (typeof src === 'string' ? compile(src, 'redcode', s88) : src)), { positions: parts.map(([, at]) => at) });
  return vm;
};

test('it passes the gate on 88 and 94nop, quick and full, with one or two heads', () => {
  for (const rules of ['88', '94nop']) {
    assert.equal(ok(rules, { id: ID }).total, 5);
    assert.equal(ok(rules, { id: ID, P: { HEADS: 1 } }).total, 4);
  }
  ok('88', { id: ID }, 'full');
  ok('88', { id: 'seq', kids: [{ id: 'opening-qscan-add-88', P: { ROWS: 4 } }, { id: ID }] }, 'full');
});

test('the trail: MOV <0, <p instructions downward from FIRST above the drop line, about two cells in five', () => {
  const built = ok('88', { id: ID }), P = leaves[ID].defaults, base = 1000, rDrop = base + built.labels.b0rDrop;
  const vm = load([built.w, base]);
  while (vm.cycle < 3000) vm.step();
  assert.ok(isDrop(vm.peek(rDrop + P.FIRST - 1)), 'the first drop');
  assert.equal(vm.peek(rDrop + P.FIRST).op, 'DAT');
  let drops = 0;
  for (let d = 1; d <= 900; d++) if (isDrop(vm.peek(rDrop + P.FIRST - d))) drops++;
  assert.ok(drops >= 300 && drops <= 700, `${drops} drops in 900 cells`);
  // Every drop's B-field is the trail pointer when it was laid: it points FIRST-ish cells above itself.
  const some = vm.peek(rDrop + P.FIRST - 1);
  assert.ok(some.b <= P.FIRST && some.b >= P.FIRST - 2, `B-field ${some.b}`);
});

test('a process that runs a drop survives it; held on two drops it drags empty cells down onto itself', () => {
  // One drop, run once: the process is alive on the next cell and only B-fields have changed.
  const once = load([';name once\nv MOV <0, <300\n JMP 0\n END v\n', 1000]);
  once.step();
  assert.deepEqual(once.processes(0), [1001]);
  assert.equal(once.peek(1000).b, 299);                 // its own B-field
  assert.equal(once.peek(1300).b, s88.coreSize - 1);    // and the cell 300 above it
  // Two drops and a jump back, alone: marked cells between are overwritten from the top down,
  // and after about three cycles a cell the loop itself is wiped.
  const held = load([';name held on two drops\nv MOV <0, <300\n MOV <0, <300\n JMP v\n END v\n', 1000]);
  for (let d = 100; d <= 200; d++) held.poke(1000 + d, { op: 'SPL', mod: 'B', aMode: '$', a: 0, bMode: '$', b: 0 });
  while (held.cycle < 420 && !held.done) held.step();
  assert.equal(held.peek(1200).op, 'DAT');              // the top of the marked stretch is already gone
  assert.equal(held.peek(1100).op, 'SPL');              // the bottom not yet
  while (held.cycle < 2000 && !held.done) held.step();
  assert.equal(held.warriors[0].alive, false);
  assert.ok(held.cycle > 700 && held.cycle < 1000, `died at cycle ${held.cycle}`);
  for (let d = 100; d <= 200; d++) assert.equal(held.peek(1000 + d).op, 'DAT');
  assert.equal(held.peek(1002).op, 'DAT');              // its own jump
});

test('victims in the path of the trail die: a plain loop by walking off, an SPL-fed one by clearing itself', () => {
  const built = ok('88', { id: ID }), P = leaves[ID].defaults, base = 1000, rDrop = base + built.labels.b0rDrop;
  const at = rDrop + P.FIRST - 60;
  const run = (victim, cycles) => {
    const vm = load([built.w, base], [victim, at]);
    while (!vm.done && vm.cycle < cycles) vm.step();
    return vm;
  };
  const plain = run(';name plain\nv SUB #1, 2\n JMP v\n DAT #0, #0\n END v\n', 2000);
  assert.deepEqual([plain.warriors[0].alive, plain.warriors[1].alive], [true, false]);
  assert.ok(plain.cycle < 200, `the plain loop died at cycle ${plain.cycle}`);
  // What killed it was not a DAT of ours: its jump is a drop, and it died on the cell after its code.
  assert.ok(isDrop(plain.peek(at + 1)));
  const fed = run(';name fed\nv SPL 0\n JMP v\n END v\n', 60000);
  assert.deepEqual([fed.warriors[0].alive, fed.warriors[1].alive], [true, false]);
  // A lone imp walking up into the trail dies the first way when a drop lands on the cell it
  // has just copied itself to: the one-head trail does that, the two-head one happens not to.
  const one = ok('88', { id: ID, P: { HEADS: 1 } });
  const imp = load([one.w, base], [';name imp\nv MOV 0, 1\n END v\n', base + one.labels.b0rDrop + P.FIRST - 60]);
  while (!imp.done && imp.cycle < 3000) imp.step();
  assert.deepEqual([imp.warriors[0].alive, imp.warriors[1].alive], [true, false]);
});

test('broken settings are refused by the contract and by the gate', () => {
  const s = { ...s88, maxLength: 50 };
  assert.ok(treeMismatches({ id: ID, P: { FIRST: 7990 } }, s).some((m) => /starts the trail on the warrior/.test(m)));
  assert.ok(treeMismatches({ id: 'par', kids: [{ id: 'stone' }, { id: ID }] }, s).length > 0, 'it takes no partners');
  // A drop line that does not count itself down is not a drop: it lays one cell over and over.
  const built = buildTree({ id: ID }, { rules: '88' });
  built.w.instructions[built.labels.b0rDrop].a = 1;
  assert.throws(() => gate(built), /something other than its drop|laid only|did not survive/);
  // A layer that copies the wrong line lays no drops.
  const layer = buildTree({ id: ID }, { rules: '88' });
  layer.w.instructions[layer.labels.b0rLay].a = 2;
  assert.throws(() => gate(layer), /something other than its drop/);
});

test('SPLIT 1 (the loop returns to the SPL): it fills the process table, passes quick and full, and kills the same way', () => {
  const built = ok('88', { id: ID, P: { SPLIT: 1, HEADS: 1 } });
  assert.equal(built.total, 4);
  ok('88', { id: ID, P: { SPLIT: 1, HEADS: 1 } }, 'full');
  ok('94nop', { id: ID, P: { SPLIT: 1 } });
  const back = built.w.instructions[built.labels.b0rBack];
  assert.equal(built.labels.b0rBack + (back.a > 4000 ? back.a - 8000 : back.a), built.labels.b0rHead);
  const vm = load([built.w, 1000]);
  while (vm.cycle < 3000) vm.step();
  assert.ok(vm.processes(0).length > 800, `${vm.processes(0).length} processes after 3,000 cycles`);
  // A trail start that brings the trail onto the stone too soon is refused by the gate.
  assert.throws(() => buildTree({ id: ID, P: { SPLIT: 1, HEADS: 1, FIRST: 5000 } }, { rules: '88' }), /did not survive/);
});
