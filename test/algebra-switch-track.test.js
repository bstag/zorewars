import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree } from '../tools/algebra/index.js';
import { scoreChoice, trackCells } from '../tools/algebra/switch-score.js';
import { trackChoice } from '../tools/algebra/switch-table.js';

const core = 25200;
const P = { CELL: 20, FIRST: 0, WIN: 1, TIE: 0, LOSS: -2, HOLD: 0, STREAK: 0, SENT: 1931, SEAL: 0, TRACK: 90, TMEMBER: 1, TMISS: 2, TPROBE: 1, TLOSS: -1, TTIE: 1 };
const fresh = (result, last, arm, phase, miss) => {
  const p = new Array(core / 16).fill(0);
  p[0] = result; p[20] = last; p[21] = 1931; p[22] = core / 2; p[23] = core / 2;
  p[90] = arm; p[91] = phase; p[92] = miss;
  return p;
};
const writes = (p) => new Map(scoreChoice(P, 2, p, core).writes);

test('the tracker keeps the arm after our loss and switches it otherwise', () => {
  const t = trackCells(P);
  assert.equal(writes(fresh(0, 0, 1, 0, 0)).get(t.arm), 1);
  assert.equal(writes(fresh(1, 0, 1, 0, 0)).get(t.arm), 0);
  assert.equal(writes(fresh(2, 0, 0, 0, 0)).get(t.arm), 1);
});

test('only probe rounds of the tracked member count as misses', () => {
  const t = trackCells(P);
  // (arm + phase) % 2 === TPROBE is a probe round: a loss is a miss, the second flips the phase.
  assert.equal(writes(fresh(0, 1, 1, 0, 0)).get(t.miss), 1);
  const flip = writes(fresh(0, 1, 1, 0, 1));
  assert.equal(flip.get(t.phase), 1);
  assert.equal(flip.get(t.miss), 0);
  // A loss off the probe, or by another member, changes nothing.
  assert.equal(writes(fresh(0, 1, 0, 0, 1)).get(t.miss), 1);
  assert.equal(writes(fresh(0, 0, 1, 0, 1)).get(t.miss), 1);
  // TTIE: a probe tie flips at once; a probe win clears the misses.
  assert.equal(writes(fresh(2, 1, 1, 0, 0)).get(t.phase), 1);
  assert.equal(writes(fresh(1, 1, 1, 0, 1)).get(t.miss), 0);
});

test('TLOSS replaces LOSS for the tracked member only', () => {
  const bias = core / 2;
  assert.equal(writes(fresh(0, 1, 0, 0, 0)).get(23), bias - 1);
  assert.equal(writes(fresh(0, 0, 0, 0, 0)).get(22), bias - 2);
});

test('a tracked switch-table plays (arm + phase + TFIRST) mod 2', () => {
  assert.deepEqual([[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, p]) => trackChoice(a, p, 1)), [1, 0, 0, 1]);
});

test('a tracked switch-score and switch-table pass the gate', () => {
  const kid = (id) => ({ id: 'boot', P: { HOP: 12600 }, kids: [{ id }] });
  const tree = { id: 'switch-score', P: { ...P, TMEMBER: 0 },
    kids: [{ id: 'switch-table', P: { TRACK: 90, TFIRST: 1 }, kids: [kid('split-stone'), kid('tail-silk')] }, kid('tail-silk')] };
  const built = buildTree(tree, { rules: 'modelwar', length: 5040 });
  assert.equal(built.verification.ok, true, JSON.stringify(built.verification.issues ?? built.verification));
  assert.match(built.source, /NOP\.F/);
});

test('TRACK is off by default, so older trees build the same code', () => {
  const kid = (id) => ({ id: 'boot', P: { HOP: 12600 }, kids: [{ id }] });
  const tree = (extra) => ({ id: 'switch-score', P: { LOSS: -2, ...extra }, kids: [kid('split-stone'), kid('tail-silk')] });
  const a = buildTree(tree({}), { rules: 'modelwar', length: 5040, verification: 'quick' }).source;
  const b = buildTree(tree({ TRACK: 0, TPROBE: 1, TTIE: 1, TLOSS: -1 }), { rules: 'modelwar', length: 5040, verification: 'quick' }).source;
  assert.equal(a, b);
});

test('Trio v10 passes the gate and rebuilds to the committed Redcode', async () => {
  const fs = await import('node:fs');
  const read = (name) => fs.readFileSync(new URL(`../modelwar/${name}`, import.meta.url), 'utf8');
  const body = (s) => s.split(/\r?\n/).filter((l) => !l.startsWith(';')).join('\n').trim();
  const built = buildTree(JSON.parse(read('trio10.json')), { rules: 'modelwar', length: 5040 });
  assert.equal(built.verification.ok, true, JSON.stringify(built.verification.issues ?? built.verification));
  assert.equal(body(built.source), body(read('trio10.red')));
});
