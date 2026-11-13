import assert from 'node:assert/strict';
import test from 'node:test';
import { VM } from '../src/engine/index.js';
import { buildTree } from '../tools/algebra/index.js';

const ids = { 'lp-stream-paper': 8, 'lp-step-paper': 7, 'lp-scan-paper': 8 };
const wide = {                                   // lattices 160 cells apart, for a larger image
  'lp-stream-paper': { STRIDE: 2880, FIRST: 2400 },
  'lp-step-paper': { STEP: 2880, WRITE: 2400 },
  'lp-scan-paper': { STEP: 2880, FIRST: 2392 },
};
const blank = { op: 'DAT', mod: 'F', aMode: '$', a: 0, bMode: '$', b: 0 };
const load = (built, base = 7997) => {
  const vm = new VM(built.settings);
  vm.load([built.w], { positions: [base] });
  return { vm, at: offset => vm.norm(base + offset) };
};

test('the three LP papers pass the gate alone, booted and beside a stone on both LP rule sets', () => {
  for (const [id, cells] of Object.entries(ids)) {
    for (const rules of ['lp', 'lp-hill']) {
      const built = buildTree({ id }, { rules });
      assert.equal(built.total, cells);
      assert.equal(built.verification.ok, true);
      assert.equal(buildTree({ id: 'boot', P: { HOP: 3000 }, kids: [{ id }] }, { rules }).verification.ok, true);
      assert.equal(buildTree({ id: 'par', kids: [{ id, P: wide[id] }, { id: 'lp-phase-stone' }] }, { rules }).verification.ok, true);
    }
  }
  const twins = { id: 'apart', kids: [{ id: 'lp-stream-paper', P: wide['lp-stream-paper'] }, { id: 'lp-step-paper', P: wide['lp-step-paper'] }] };
  assert.equal(buildTree(twins, { rules: 'lp' }).total, 22);
});

test('the stream paper drops its DAT every STRIDE, copies exactly eight cells and keeps moving at the cap', () => {
  const built = buildTree({ id: 'lp-stream-paper' }, { rules: 'lp' });
  const { vm, at } = load(built);
  const { line, ...dat } = built.w.instructions[7];
  for (let i = 0; i < 33; i++) vm.step();                 // head, then eight laps of four
  for (let k = 0; k < 8; k++) assert.deepEqual(vm.peek(at(2 + 2416 + k * 2912)), dat);
  assert.deepEqual(vm.processes(0), [at(5)]);
  vm.step(); vm.step();                                   // spl home, guarded jump
  assert.deepEqual(vm.processes(0), [at(0), at(2376)]);
  assert.deepEqual(vm.peek(at(2376 + 7)), dat);
  assert.deepEqual(vm.peek(at(2376 + 8)), blank);
  assert.deepEqual(vm.peek(at(2376 - 1)), blank);
  while (!vm.done) vm.step();
  assert.equal(vm.warriors[0].alive, true);
  assert.equal(vm.warriors[0].peak, 8);

  // The guard: a copy whose head did not arrive is not entered.
  const guarded = load(built);
  for (let i = 0; i < 34; i++) guarded.vm.step();
  guarded.vm.poke(guarded.at(2376), { op: 'DAT', mod: 'F', aMode: '#', a: 0, bMode: '#', b: 5 });
  guarded.vm.step();
  assert.ok(!guarded.vm.processes(0).includes(guarded.at(2376)));
});

test('the step paper moves the cell its remote pointer selects along an arithmetic walk and leaves a carpet', () => {
  const built = buildTree({ id: 'lp-step-paper' }, { rules: 'lp' });
  const { vm, at } = load(built);
  const marker = { op: 'JMP', mod: 'B', aMode: '#', a: 7, bMode: '$', b: 0 };
  vm.poke(at(1 + 4004), marker);                          // the remote pointer cell itself, moved on lap 1
  for (let i = 0; i < 2; i++) vm.step();
  assert.deepEqual(vm.peek(at(1 + 2416)), marker);
  assert.equal(vm.peek(at(1 + 4004)).b, 1);
  vm.step();
  assert.equal(vm.peek(at(1)).b, 2416 + 2912);             // the SPL's B-field is the step
  while (vm.processes(0).length < 2) vm.step();
  assert.equal(vm.steps, 1 + 21 * 4 + 1);
  vm.step();
  assert.deepEqual(vm.processes(0), [at(0), at(5208)]);
  for (let c = 0; c < 21; c++) assert.ok(vm.lastWrite[at(5208 + c)] > 0, 'body and carpet cells written');
});

test('the scan paper copies only onto what it finds', () => {
  const built = buildTree({ id: 'lp-scan-paper' }, { rules: 'lp' });
  const quiet = load(built);
  for (let i = 0; i < 20000; i++) quiet.vm.step();
  assert.equal(quiet.vm.processes(0).length, 1);
  let written = 0;
  for (let c = 8; c < 7990; c++) if (quiet.vm.lastWrite[quiet.at(c)] > 0) written++;
  assert.equal(written, 0);

  const { vm, at } = load(built);
  const target = 2 + 2408 + 5 * 3024, COUNT = 29;         // the fifth probe
  vm.poke(at(target), { op: 'SPL', mod: 'B', aMode: '$', a: 3, bMode: '$', b: 0 });
  while (vm.processes(0).length < 2) vm.step();
  assert.equal(vm.steps, 1 + 5 * 2 + 1 + COUNT * 2 + 1);
  vm.step();
  const head = target + 5 - COUNT;
  assert.deepEqual(vm.processes(0), [at(0), at(head)]);
  assert.equal(vm.peek(at(head)).op, 'MOV');
  assert.equal(vm.peek(at(head + 7)).op, 'JMN');
  for (let c = head + 8; c <= target + 4; c++) assert.deepEqual(vm.peek(at(c)), blank);
  while (!vm.done) vm.step();
  assert.equal(vm.processes(0).length, 2);                 // neither finds the other, or itself
});

test('the stream and step papers sit beside a stone on their default lattices, and all three pass full verification', () => {
  for (const id of ['lp-stream-paper', 'lp-step-paper']) {
    assert.equal(buildTree({ id: 'par', kids: [{ id }, { id: 'lp-phase-stone' }] }, { rules: 'lp' }).verification.ok, true);
  }
  for (const id of Object.keys(ids)) {
    for (const rules of ['lp', 'lp-hill']) assert.equal(buildTree({ id }, { rules, verification: 'full' }).verification.ok, true);
  }
  // An opening that has handed on is dead: a 16-cell lattice may land on it, but not on a live partner.
  const narrow = { id: 'lp-stream-paper', P: { STRIDE: 2896, FIRST: 2392 } };
  assert.equal(buildTree({ id: 'seq', kids: [{ id: 'opening-quickscan' }, narrow] }, { rules: 'lp' }).total, 33);
  assert.throws(() => buildTree({ id: 'par', kids: [narrow, { id: 'lp-phase-stone' }] }, { rules: 'lp' }), /reaches the rest of the warrior/);
});

test('the stream paper lays EXTRA cells after each copy, and a paper passes the gate as a member of a P-space switch', () => {
  const built = buildTree({ id: 'lp-stream-paper', P: { EXTRA: 12 } }, { rules: 'lp' });
  const { vm, at } = load(built);
  while (vm.processes(0).length < 2) vm.step();
  assert.equal(vm.steps, 1 + 20 * 4 + 1);
  vm.step();
  assert.deepEqual(vm.processes(0), [at(0), at(2376)]);
  for (let c = 8; c < 20; c++) assert.ok(vm.lastWrite[at(2376 + c)] > 0, 'carpet cell written');
  // The other member and the dispatch are dead to the paper (linked's `dead`), and a paper copy that
  // later runs over the scanner's first cell does not count as the scanner starting.
  const table = { FIRST: 0, LOSS: 0x4409, WIN: 0x9944, TIE: 0x0040, PACKED: 1 };
  const tree = { id: 'switch-table', P: table, kids: [{ id: 'lp-step-paper' }, { id: 'lp-selfhit-scanner' }] };
  assert.equal(buildTree(tree, { rules: 'lp-hill', length: 200 }).total, 44);
  assert.throws(() => buildTree(tree, { rules: 'lp' }), /P-space/);
});

test('the papers refuse lattices that reach themselves, the warrior, or other rule sets', () => {
  const lp = { rules: 'lp' };
  assert.throws(() => buildTree({ id: 'lp-stream-paper', P: { FIRST: 2400 } }, lp), /stream reaches its own body/);
  assert.throws(() => buildTree({ id: 'lp-stream-paper', P: { STRIDE: 2897 } }, lp), /stream reaches its own body/);
  assert.throws(() => buildTree({ id: 'par', kids: [{ id: 'lp-stream-paper', P: { STRIDE: 2896, FIRST: 2392 } }, { id: 'lp-phase-stone' }] }, lp), /reaches the rest of the warrior/);
  assert.throws(() => buildTree({ id: 'lp-step-paper', P: { WRITE: 2400 } }, lp), /reaches its own body/);
  assert.throws(() => buildTree({ id: 'lp-step-paper', P: { READ: 3 } }, lp), /READ points into its own body/);
  assert.throws(() => buildTree({ id: 'lp-scan-paper', P: { FIRST: 2404 } }, lp), /finds its own body/);
  assert.throws(() => buildTree({ id: 'lp-scan-paper', P: { COUNT: 21 } }, lp), /comes back to the body of the copy/);
  assert.throws(() => buildTree({ id: 'lp-scan-paper', P: { FIRST: 2412 } }, lp), /finds the paper that made it/);
  for (const id of Object.keys(ids)) assert.throws(() => buildTree({ id }, { rules: '94nop' }), /8,000-cell LP ring/);
});
