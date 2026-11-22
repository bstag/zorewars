import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildTree } from '../tools/algebra/index.js';

const read = (name) => fs.readFileSync(new URL(`../modelwar/${name}`, import.meta.url), 'utf8');
const body = (s) => s.split(/\r?\n/).filter((l) => !l.startsWith(';')).join('\n').trim();
const tree = () => JSON.parse(read('trio9.json'));

test('Trio v9 passes the gate and rebuilds to the committed Redcode', () => {
  const built = buildTree(tree(), { rules: 'modelwar', length: 5040 });
  assert.equal(built.verification.ok, true, JSON.stringify(built.verification.issues ?? built.verification));
  assert.equal(body(built.source), body(read('trio9.red')));
});

test('SEAL overwrites every P-space write of a switch-table once its state is stored', () => {
  const t = { id: 'switch-table', P: { CELL: 80, FIRST: 5, LOSS: 0x50, WIN: 0x05, TIE: 0x05, SEAL: 1 },
    kids: [{ id: 'boot', P: { HOP: 12600 }, kids: [{ id: 'split-stone' }] }, { id: 'boot', P: { HOP: 12600 }, kids: [{ id: 'tail-silk' }] }] };
  const built = buildTree(t, { rules: 'modelwar', length: 5040 });
  assert.equal(built.verification.ok, true, JSON.stringify(built.verification.issues ?? built.verification));
  assert.match(built.source, /put\s+STP\.B/);
  assert.match(built.source, /MOV\.I\s+\S*result, \S*put/);
});

test('SEAL is off by default, so switch-score code is unchanged', () => {
  const t = tree();
  const off = buildTree({ ...t, P: { ...t.P, SEAL: 0 } }, { rules: 'modelwar', length: 5040, verification: 'quick' }).source;
  const plain = buildTree(t, { rules: 'modelwar', length: 5040, verification: 'quick' }).source;
  assert.equal(body(off), body(plain));
  const on = buildTree({ ...t, P: { ...t.P, SEAL: 1 } }, { rules: 'modelwar', length: 5040, verification: 'quick' }).source;
  assert.ok(on.split('\n').length > plain.split('\n').length);
});

test('twin-scan DEAD ignores finds in the image it was booted away from', () => {
  const boot = (P) => ({ id: 'boot', P: { HOP: 12600 }, kids: [{ id: 'twin-scan', P }] });
  const plain = buildTree(boot({}), { rules: 'modelwar', length: 5040 }).source;
  const dead = buildTree(boot({ DEAD: 12600 }), { rules: 'modelwar', length: 5040 });
  assert.equal(dead.verification.ok, true, JSON.stringify(dead.verification.issues ?? dead.verification));
  assert.equal(dead.source.split('\n').length - plain.split('\n').length, 4);
});
