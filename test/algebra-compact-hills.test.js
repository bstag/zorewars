import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compile, VM } from '../src/engine/index.js';
import { buildTree } from '../tools/algebra/index.js';
import { timeTinyLp } from '../examples/hill-study/time-tiny-lp-leaders.mjs';

const nano = { rules: 'nano', length: 5, verification: 'full' };
const tiny = { rules: 'tiny', length: 20, verification: 'full' };
const tinyPaper = (P = {}) => ({
  id: 'seq', kids: [{ id: 'tiny-copy-burst', P }, { id: 'boot-paper' }],
});

test('the Tiny LP scanner keeps quiet on empty core and attacks a wrapped marker on turn five', () => {
  for (const TRAP of [0, 1]) {
    const built = buildTree({ id: 'tiny-lp-trap-scan', P: { TRAP } }, { rules: 'tinylp' });
    const quiet = timeTinyLp(built.w);
    assert.equal(quiet.firstRemoteMove, null);
    assert.equal(quiet.turns, 8000);
    assert.deepEqual(timeTinyLp(built.w, { marker: 73, base: 777 }).firstMarkerOverwrite,
      { turn: 5, pc: 7, destination: 73 });
  }
  const prefixed = { id: 'seq', kids: [{ id: 'tiny-copy-burst', P: { COUNT: 1 } }, { id: 'tiny-lp-trap-scan' }] };
  assert.equal(buildTree(prefixed, { rules: 'tinylp' }).verification.ok, true);
  const edge = buildTree({ id: 'tiny-lp-trap-scan', P: { START: 799 } }, { rules: 'tinylp' });
  assert.equal(timeTinyLp(edge.w, { marker: 799 }).firstMarkerOverwrite.turn, 5);
  assert.throws(() => buildTree({
    ...prefixed, kids: [prefixed.kids[0], { id: 'tiny-lp-trap-scan', P: { START: 799 } }],
  }, { rules: 'tinylp' }), /remote first probe/);
  assert.throws(() => buildTree({ id: 'tiny-lp-trap-scan', P: { STEP: 10 } }, { rules: 'tinylp' }), /coprime/);
});

test('Nano Lane reproduces the workshop warrior and verifies the reverse and B-field modes', () => {
  const built = buildTree({ id: 'nano-lane' }, nano);
  const source = readFileSync(new URL('../examples/hill-study/nano-lane.red', import.meta.url), 'utf8');
  const reference = compile(source, 'redcode', built.settings);
  assert.equal(reference.ok, true);
  const withoutLine = ({ line, ...instruction }) => instruction;
  assert.deepEqual(built.w.instructions.map(withoutLine), reference.instructions.map(withoutLine));
  assert.equal(built.w.start, reference.start);
  assert.equal(built.verification.ok, true);

  const reversed = buildTree({ id: 'nano-lane', P: { LANE: 15, REVERSE: 1, FIELDS: 1 } }, nano);
  assert.equal(reversed.verification.ok, true);
  const marker = { op: 'JMP', mod: 'B', aMode: '#', a: 1, bMode: '$', b: 0 };
  for (const [warrior, offset, expectedOp] of [[built.w, 44, 'DAT'], [reversed.w, 79, 'JMP']]) {
    const vm = new VM(built.settings);
    const base = 78;
    vm.load([warrior], { positions: [base] });
    vm.poke(base + offset, marker);
    vm.step();
    vm.step();
    assert.equal(vm.peek(base + offset).op, expectedOp);
  }
});

test('Nano Lane needs its own five-cell image on the Nano ring', () => {
  assert.throws(() => buildTree({ id: 'nano-lane' }, tiny), /requires the 80-cell ring/);
  assert.throws(() => buildTree({ id: 'par', kids: [{ id: 'nano-lane' }, { id: 'imp' }] }, nano),
    /must own its entire five-cell image/);
});

test('the Tiny copy burst lands its predecremented source and hands on at wrapped addresses', () => {
  const built = buildTree(tinyPaper({ COUNT: 1, SRC1: 30, DST1: 35 }), tiny);
  assert.equal(built.verification.ok, true);
  const vm = new VM(built.settings);
  const base = 797;
  const pointer = { op: 'DAT', mod: 'F', aMode: '#', a: 2, bMode: '#', b: 7 };
  const marker = { op: 'JMP', mod: 'B', aMode: '#', a: 3, bMode: '$', b: 4 };
  vm.load([built.w], { positions: [base] });
  vm.poke(base + 30, pointer);
  vm.poke(base + 31, marker);
  vm.step();
  assert.deepEqual(vm.peek(base + 30), { ...pointer, a: 1 });
  assert.deepEqual(vm.peek(base + 35), marker);
  assert.deepEqual(vm.processes(0), [base + 1]);
});

test('the Tiny copy burst fits 20 instructions and the Tiny LP process cap', () => {
  assert.equal(buildTree(tinyPaper(), tiny).total, 18);
  assert.equal(buildTree(tinyPaper(), { ...tiny, rules: 'tinylp' }).total, 19);
  const nine = { id: 'seq', kids: [{ id: 'tiny-copy-burst', P: { COUNT: 9 } }, { id: 'silk3' }] };
  assert.equal(buildTree(nine, tiny).total, 19);
});

test('the Tiny copy burst refuses friendly, aliased, or relocated writes', () => {
  for (const P of [{ SRC1: 5 }, { DST1: 5 }]) {
    assert.throws(() => buildTree(tinyPaper(P), tiny), /touches the linked image/);
  }
  const preceded = {
    id: 'seq', kids: [{ id: 'tiny-copy-burst', P: { COUNT: 1 } },
      { id: 'tiny-copy-burst', P: { COUNT: 1, DST1: 799 } }, { id: 'boot-paper' }],
  };
  assert.throws(() => buildTree(preceded, tiny), /touches the linked image/);
  assert.throws(() => buildTree(tinyPaper({ SRC1: 200, DST2: 200 }), tiny), /destinations must be distinct/);
  assert.throws(() => buildTree({ id: 'boot', P: { HOP: 325 }, kids: [tinyPaper()] }, tiny),
    /requires an unshifted image/);
});
