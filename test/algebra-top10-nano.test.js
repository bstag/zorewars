import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree } from '../tools/algebra/index.js';
import { leaves } from '../tools/algebra/leaves.js';
import { treeSettings } from '../tools/algebra/build.js';
import { recipes } from '../tools/algebra/recipes.js';
import { nanoScale } from '../tools/algebra/blocks/top10-nano.js';
import { assemble, RULESETS } from '../src/engine/index.js';

// The blocks of tools/algebra/blocks/top10-nano.js (docs/hill-top10/nano.md).
const ok = (b) => assert.equal(b.verification.ok, true, JSON.stringify(b.verification.issues ?? b.verification));
const build = (tree, rules = 'nano', length = 5) => buildTree(tree, { rules, length });
const misfits = (id, P, rules = 'nano', length = 5) => leaves[id].mismatches({ ...leaves[id].defaults, ...P }, treeSettings(rules, length));
const field = (i) => `${i.op}.${i.mod} ${i.aMode}${((i.a % 80) + 80) % 80}, ${i.bMode}${((i.b % 80) + 80) % 80}`;
const code = (b) => b.w.instructions.map(field);

test('the four blocks pass the gate alone with their defaults on Nano', () => {
  for (const id of ['nano-mirror-clear', 'nano-twin-clear', 'nano-dat-clear', 'nano-paper-clear']) {
    const b = build({ id });
    ok(b);
    assert.equal(b.total, 5);
  }
});

test('every top-10 Nano recipe builds five instructions and passes the gate', () => {
  const keys = Object.keys(recipes).filter((k) => k.startsWith('top10-nano-'));
  assert.equal(keys.length, 10);
  for (const k of keys) {
    const b = build(recipes[k].tree('nano'));
    ok(b);
    assert.equal(b.total, 5, k);
  }
});

test('nano-mirror-clear lays out each fifth-line form as its warrior does', () => {
  // SLOT 0: SPL, mirror, swap-back, walker, DJN (Reptiloid Conspiracy's shape).
  assert.deepEqual(code(build({ id: 'nano-mirror-clear' })), ['SPL.I #39, {57', 'MOV.I <68, {79', 'MOV.I {78, <67', 'MOV.I }78, {54', 'DJN.F $77, {54']);
  // SLOT 1 starts at the head; SLOT 2 throws its own SPL first.
  const head = build({ id: 'nano-mirror-clear', P: { SLOT: 1 } });
  assert.equal(head.w.start, 0);
  assert.equal(head.w.instructions[0].op, 'MOV');
  assert.equal(head.w.instructions[1].op, 'SPL');
  assert.deepEqual(code(build({ id: 'nano-mirror-clear', P: { SLOT: 2, COPYB: 46 } }))[1], 'MOV.I {0, >45');
});

test('nano-twin-clear and nano-dat-clear: the SPL\'s fields are the pointers, the bomb becomes one', () => {
  assert.deepEqual(code(build({ id: 'nano-twin-clear' })).slice(0, 3), ['SPL.I #42, >71', 'MOV.I <79, {79', 'MOV.I {78, <78']);
  const combat = build({ id: 'nano-twin-clear', P: { SLOT: 1, HEADM: 1, PA: 70, PB: 36, SIDEM: 0, FEEDMOD: 0 } });
  ok(combat);
  assert.equal(combat.w.instructions[4].op, 'DIV');
  const dat = build({ id: 'nano-dat-clear' });
  assert.equal(dat.w.start, 1);
  assert.equal(dat.w.instructions[0].op, 'DAT');
  assert.equal(((dat.w.instructions[0].b % 80) + 80) % 80, 76);
});

test('nano-paper-clear copies itself and passes the gate as a roaming paper', () => {
  const b = build({ id: 'nano-paper-clear' });
  ok(b);
  assert.deepEqual(code(b).slice(1, 3), ['MOV.I }79, }1', 'SPL.B {43, >55']);
});

test('nanoScale keeps offsets near the block and scales the rest by the core', () => {
  assert.equal(nanoScale(39, 80), 39);
  assert.equal(nanoScale(78, 25200), -2);
  assert.equal(nanoScale(39, 25200), 12285);
  assert.equal(nanoScale(60, 8000), -2000);
});

test('the blocks scale to the 8000-cell core', () => {
  ok(build(recipes['top10-nano-reptiloid-conspiracy'].tree('nano'), '94nop', 100));
  ok(build(recipes['top10-nano-iron-throne'].tree('nano'), '94nop', 100));
});

test('mismatches refuse settings that break each block', () => {
  assert.ok(misfits('nano-mirror-clear', {}, 'tiny', 20).length === 0);
  assert.ok(leaves['nano-mirror-clear'].mismatches(leaves['nano-mirror-clear'].defaults, { ...treeSettings('nano', 5), coreSize: 40 }).some((m) => /at least 80/.test(m)));
  assert.ok(misfits('nano-mirror-clear', { CURSOR: 57, STREAM: 57 }).some((m) => /reads its own pointer/.test(m)));
  assert.ok(misfits('nano-mirror-clear', { PTR: 2 }).some((m) => /PTR 2 lands on its own code/.test(m)));
  assert.ok(misfits('nano-twin-clear', { PA: 50, PB: 50 }).some((m) => /same cell/.test(m)));
  assert.ok(misfits('nano-dat-clear', { BOMBB: 78 }).some((m) => /onto its own SPL/.test(m)));
  assert.ok(misfits('nano-paper-clear', { COPY: 77 }).some((m) => /lands the copy on the paper/.test(m)));
});

test('the gate refuses a mirror clear that throws its own SPL and dies alone (Forbes as published)', () => {
  const forbes = { SLOT: 2, PTR: 42, FEEDMOD: 0, SIDEM: 1, SIDE: 49, COPYB: 46, CURM: 0, CURSOR: 67, WALKM: 0, STRM: 0, STREAM: 63, DJNM: 0, DJNC: 63, DJNMOD: 1 };
  assert.throws(() => build({ id: 'nano-mirror-clear', P: forbes }), /did not survive alone/);
});

test('the rebuilt Reptiloid Conspiracy assembles to the same five instructions as its description', () => {
  const b = build(recipes['top10-nano-reptiloid-conspiracy'].tree('nano'));
  const again = assemble(b.source, RULESETS.nano);
  assert.deepEqual(again.instructions.map(field), code(b));
});
