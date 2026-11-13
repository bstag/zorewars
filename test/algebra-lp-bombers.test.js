import assert from 'node:assert/strict';
import test from 'node:test';
import { VM } from '../src/engine/index.js';
import { buildTree } from '../tools/algebra/index.js';

const wideImp = { STEP: 2880, FIRST: 2424, GAP: 1520, GATE: 136 };
const load = (built, base = 7997) => {
  const vm = new VM(built.settings);
  vm.load([built.w], { positions: [base] });
  return { vm, at: offset => vm.norm(base + offset) };
};

test('the imp bomber passes the gate with and without its own imps, alone and in combinations', () => {
  for (const rules of ['lp', 'lp-hill']) {
    assert.equal(buildTree({ id: 'lp-imp-bomber' }, { rules }).total, 12);
    assert.equal(buildTree({ id: 'lp-imp-bomber', P: { IMPS: 0 } }, { rules }).total, 9);
    assert.equal(buildTree({ id: 'boot', P: { HOP: 3000 }, kids: [{ id: 'lp-imp-bomber' }] }, { rules }).verification.ok, true);
    assert.equal(buildTree({ id: 'par', kids: [{ id: 'lp-imp-bomber', P: wideImp }, { id: 'imp' }] }, { rules }).verification.ok, true);
  }
  const beside = { id: 'apart', kids: [{ id: 'lp-imp-bomber', P: { ...wideImp, IMPS: 0 } }, { id: 'lp-stream-paper', P: { STRIDE: 2880, FIRST: 2400 } }] };
  assert.equal(buildTree(beside, { rules: 'lp' }).verification.ok, true);
});

test('the imp bomber throws imp instructions on two lattices and counts four processes', () => {
  const built = buildTree({ id: 'lp-imp-bomber' }, { rules: 'lp' });
  const { vm, at } = load(built);
  const { line, ...imp } = built.w.instructions[11];
  assert.equal(imp.op, 'MOV');
  for (let i = 0; i < 64; i++) vm.step();
  assert.equal(vm.processes(0).length, 4);
  for (let k = 1; k <= 3; k++) {
    assert.deepEqual(vm.peek(at(9 + 2404 + k * 2912)), imp);
    assert.deepEqual(vm.peek(at(9 + 2404 + 1456 + k * 2912)), imp);
  }
  // Two of the four are imps: one from the end of the bomber, one SPAN further on.
  const imps = vm.processes(0).filter(pc => vm.norm(pc - at(0)) >= 12 && vm.peek(pc).op === 'MOV');
  assert.equal(imps.length, 2);
  const apart = Math.min(vm.norm(imps[0] - imps[1]), vm.norm(imps[1] - imps[0]));
  assert.ok(Math.abs(apart - 3999) <= 4, `imps ${apart} apart`);
  while (!vm.done) vm.step();
  assert.equal(vm.warriors[0].alive, true);
  assert.equal(vm.warriors[0].peak, 4);
});

test('the jmp stone and clear boot away, split five and one, and pass the gate in combinations', () => {
  for (const rules of ['lp', 'lp-hill']) {
    assert.equal(buildTree({ id: 'lp-jmp-stone-clear' }, { rules }).total, 22);
    assert.equal(buildTree({ id: 'lp-jmp-stone-clear', P: { SPLIT: 0 } }, { rules }).total, 18);
    assert.equal(buildTree({ id: 'seq', kids: [{ id: 'decoy-maker' }, { id: 'lp-jmp-stone-clear' }] }, { rules }).verification.ok, true);
    assert.equal(buildTree({ id: 'image', kids: [{ id: 'lp-jmp-stone-clear' }, { id: 'decoys' }] }, { rules }).verification.ok, true);
  }
  const built = buildTree({ id: 'lp-jmp-stone-clear', P: { SPLIT: 0 } }, { rules: 'lp' });
  const { vm, at } = load(built);
  for (let i = 0; i < 40; i++) vm.step();
  const queue = vm.processes(0).map(pc => vm.norm(pc - at(8 + 3170)));   // offsets in the copy
  assert.equal(queue.length, 6);
  assert.equal(queue.filter(offset => offset < 4).length, 5);
  assert.equal(queue.filter(offset => offset === 7 || offset === 8).length, 1);
  assert.equal(vm.processes(0).some(pc => vm.norm(pc - at(0)) < 18), false, 'nothing runs in the loaded image');
  for (let i = 0; i < 400; i++) vm.step();
  const ptr = 8 + 3170 + 4;
  // The workers arrive one at a time, so the first lattice points are passed over until the next lap of the lattice.
  for (let k = 4; k <= 60; k++) {
    assert.equal(vm.peek(at(ptr + 2408 + k * 2912)).op, 'JMP', `stream B bomb ${k}`);
    assert.equal(vm.peek(at(ptr + 2408 + 1456 + k * 2912)).op, 'JMP', `stream A bomb ${k}`);
  }
  while (!vm.done) vm.step();
  assert.equal(vm.processes(0).length, 6);
});

test('SPLIT 1 puts the clear CHOP beyond the stone and still splits five and one', () => {
  const built = buildTree({ id: 'lp-jmp-stone-clear' }, { rules: 'lp' });
  const { vm, at } = load(built);
  for (let i = 0; i < 44; i++) vm.step();
  const stone = at(12 + 3170), clear = at(18 + 3170 + 712);            // adv is cell 12, cur cell 18
  const queue = vm.processes(0);
  assert.equal(queue.length, 6);
  assert.equal(queue.filter(pc => vm.norm(pc - stone) < 4).length, 5);
  assert.equal(queue.filter(pc => [1, 2].includes(vm.norm(pc - clear))).length, 1);
  assert.equal(vm.peek(at(18 + 3170)).op, 'DAT', 'no clear beside the stone');
  assert.equal(vm.peek(clear + 1).op, 'MOV');
  while (!vm.done) vm.step();
  assert.equal(vm.processes(0).length, 6);
  assert.throws(() => buildTree({ id: 'lp-jmp-stone-clear', P: { CHOP: 2008 } }, { rules: 'lp' }), /clear reaches the stone within a round/);
  assert.throws(() => buildTree({ id: 'lp-jmp-stone-clear', P: { CHOP: 710 } }, { rules: 'lp' }), /bombs its separate clear/);
});

test('both bombers pass full verification at their defaults', () => {
  for (const id of ['lp-imp-bomber', 'lp-jmp-stone-clear']) {
    for (const rules of ['lp', 'lp-hill']) assert.equal(buildTree({ id }, { rules, verification: 'full' }).verification.ok, true);
  }
});

test('the bombers refuse lattices that reach themselves, an unarmed stream, partners for the clear and other rules', () => {
  const lp = { rules: 'lp' };
  assert.throws(() => buildTree({ id: 'lp-imp-bomber', P: { FIRST: 2400 } }, lp), /bombs reach its own cells/);
  assert.throws(() => buildTree({ id: 'lp-imp-bomber', P: { GATE: 61 } }, lp), /no bomb lands on the stream pointer/);
  assert.throws(() => buildTree({ id: 'lp-imp-bomber', P: { STEP: 2916 } }, lp), /stream wraps onto the bomber/);
  assert.throws(() => buildTree({ id: 'par', kids: [{ id: 'lp-imp-bomber' }, { id: 'lp-phase-stone' }] }, lp), /Blocks do not fit/);
  assert.throws(() => buildTree({ id: 'lp-jmp-stone-clear', P: { FIRST: 2400 } }, lp), /bombs its own loop or its clear/);
  assert.throws(() => buildTree({ id: 'par', kids: [{ id: 'lp-jmp-stone-clear' }, { id: 'imp' }] }, lp), /a clear runs alone/);
  for (const id of ['lp-imp-bomber', 'lp-jmp-stone-clear']) assert.throws(() => buildTree({ id }, { rules: '94nop' }), /8,000-cell LP ring/);
});
