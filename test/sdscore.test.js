// The tournament runner's SD-score hill (rule 'official'), checked by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pushOff, sdScoreHill } from '../src/engine/pushoff.js';

test('official rule: worked 3-warrior example', () => {
  // Rows: A, B, C's points against each other (diagonal ignored).
  const scores = [[9, 3, 1], [0, 9, 2], [2, 1, 9]];
  const r = sdScoreHill(scores, ['A', 'B', 'C']);
  // Round 1 (diagonal 0): distances A-B 3.630, A-C 4.950, B-C 5.373;
  // scores A 2 x 3.630, B 1 x 3.630, C 1.5 x 4.950: B goes.
  // Round 2: columns [0,2] and [1,0], distance 2/1 + 1/0.5 = 4; A avg 1 < C 2.
  assert.deepEqual(r.map((x) => x.name), ['C', 'A', 'B']);
  assert.ok(Math.abs(r[2].div - 3.6301) < 1e-3);
  assert.ok(Math.abs(r[1].div - 4) < 1e-9);
  assert.deepEqual(pushOff(scores, ['A', 'B', 'C'], { rule: 'official' }), r);
});

test('official rule: ties push off the later warrior; zero-spread columns are skipped', () => {
  const same = [[0, 1, 1], [1, 0, 1], [1, 1, 0]];
  assert.deepEqual(sdScoreHill(same, ['a', 'b', 'c']).map((x) => x.name), ['a', 'b', 'c']);
  // b takes nothing from a: a's column is [0, 0], zero spread, no NaN.
  const r = sdScoreHill([[0, 3], [0, 0]], ['a', 'b']);
  assert.ok(r.every((x) => Number.isFinite(x.score)));
  assert.deepEqual(r.map((x) => x.name), ['a', 'b']);
  assert.deepEqual(sdScoreHill([[0]], ['only']).map((x) => x.name), ['only']);
  assert.deepEqual(sdScoreHill([], []), []);
});
