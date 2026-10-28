import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/engine/index.js';
import { lexicase, lexicaseSurvivors, outcomeNiches } from '../tools/selection.js';

test('lexicase selects specialists that scalar tournaments would overlook', () => {
  const population = [
    { id: 'generalist', fit: 2, cases: [2, 2] },
    { id: 'paper-killer', fit: 1.5, cases: [3, 0] },
    { id: 'stone-killer', fit: 1.5, cases: [0, 3] },
    { id: 'dominated', fit: 0, cases: [0, 0] },
  ];
  const original = structuredClone(population), random = mulberry32(771);
  const chosen = new Set(Array.from({ length: 80 }, () => lexicase(population, random, 0).id));
  assert.deepEqual([...chosen].sort(), ['paper-killer', 'stone-killer']);
  const kept = lexicaseSurvivors(population, 3, mulberry32(17), 0);
  assert.deepEqual(kept.map((x) => x.id).sort(), ['generalist', 'paper-killer', 'stone-killer']);
  assert.deepEqual(population, original);
  assert.equal(lexicase([{ cases: [3, 3] }], random).cases[0], 3);
  assert.throws(() => lexicase(population, random, -1), /epsilon/);
  assert.throws(() => lexicase([{ cases: [1] }, { cases: [] }], random), /aligned/);
  assert.throws(() => lexicaseSurvivors(population, 0, random), /positive/);
});

test('epsilon keeps near-best noisy cases and uses a repeatable MAD tolerance', () => {
  const population = [{ id: 0, cases: [3] }, { id: 1, cases: [2.9] }, { id: 2, cases: [0] }];
  const sample = (epsilon) => {
    const random = mulberry32(17);
    return Array.from({ length: 80 }, () => lexicase(population, random, epsilon).id);
  };
  assert.deepEqual([...new Set(sample(0))], [0]);
  assert.deepEqual([...new Set(sample(0.2))].sort(), [0, 1]);
  assert.deepEqual(sample('auto'), sample('auto'));
  assert.deepEqual([...new Set(sample('auto'))].sort(), [0, 1]);
});

test('CVT outcome niches are bounded, seeded and distinguish equal-point fighting styles', () => {
  const a = outcomeNiches(2, 32, mulberry32(42));
  const b = outcomeNiches(2, 32, mulberry32(42));
  assert.deepEqual(a.centers, b.centers);
  const ties = a.describe([{ w: 0, l: 0, t: 12 }, { w: 0, l: 0, t: 12 }]);
  const kills = a.describe([{ w: 4, l: 8, t: 0 }, { w: 4, l: 8, t: 0 }]);
  assert.deepEqual(ties, [0, 1, 0, 1]);
  assert.notEqual(a.cell(ties), a.cell(kills));
  const occupied = new Set();
  for (let w = 0; w <= 12; w++) for (let t = 0; t <= 12 - w; t++) {
    const d = a.describe([{ w, t, l: 12 - w - t }, { w: t, t: w, l: 12 - w - t }]);
    occupied.add(a.cell(d));
  }
  assert.ok(occupied.size > 1 && occupied.size <= 32);
  assert.throws(() => a.describe([{ w: 1, t: 0, l: 0 }]), /panel changed/);
  assert.throws(() => a.cell([NaN]), /invalid outcome/);
});
