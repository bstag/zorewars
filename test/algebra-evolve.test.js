import test from 'node:test';
import assert from 'node:assert/strict';
import { createPool, libraryOpponents } from '../tools/hill.js';
import { treeSettings, shape } from '../tools/algebra/index.js';
import { evolveTrees, placeOnHill, climbTrees } from '../tools/algebra/evolve.js';

const settings = treeSettings('94nop', 100);
const field = libraryOpponents(settings).filter((o) => ['Dwarf', 'Silk', 'Seeker'].includes(o.name));
const stone = { id: 'mod-stone', P: { STEP: 2936, BOMBS: 1, GUARD: 1 } };
const paper = { id: 'par', kids: [{ id: 'paper', P: { PSTEP: 1777, PDELTA: 1013 } }, stone] };

test('tree evolution keeps only gated trees, races them, and is seeded', async () => {
  const pool = createPool(2);
  try {
    const run = () => evolveTrees({ pool, field, starts: [stone, paper], generations: 1, batch: 4, rounds: 2, race: 1, seed: 3 });
    const r = await run();
    assert.equal(r.history.length, 1);
    assert.ok(r.archive.length >= 2);
    assert.ok(r.archive.every((e) => e.source && e.fit >= 0 && e.fit <= 3));
    assert.ok(r.stats.built > 0 && r.stats.scored > 0);
    const again = await run();
    assert.deepEqual(again.archive.map((e) => [e.shape, e.fit]), r.archive.map((e) => [e.shape, e.fit]));
  } finally { pool.close(); }
});

test('tune mode only changes numbers', async () => {
  const pool = createPool(2);
  try {
    const r = await evolveTrees({ pool, field, starts: [paper], generations: 2, batch: 4, rounds: 2, race: 0, seed: 5, ops: ['tune'], randomRate: 0 });
    // Without random trees or crossover, every niche keeps the starting shape.
    const starting = shape(paper);
    const shapes = r.archive.map((e) => e.shape).filter((s) => s.startsWith('par('));
    assert.ok(shapes.length > 0 && shapes.every((s) => s === starting), JSON.stringify(shapes));
  } finally { pool.close(); }
});

test('ties 0 counts only wins', async () => {
  const pool = createPool(2);
  try {
    const run = (ties) => evolveTrees({ pool, field, starts: [paper], generations: 0, batch: 1, rounds: 4, race: 0, seed: 2, randomRate: 0, ties });
    const [full, wins] = [await run(1), await run(0)];
    // Same seeds, so the same rounds: dropping ties can only lower the score, to 3 x wins.
    assert.ok(wins.archive[0].fit <= full.archive[0].fit);
    const won = wins.archive[0].fit * field.length * 4 / 3;
    assert.ok(Math.abs(won - Math.round(won)) < 1e-9, String(won));
  } finally { pool.close(); }
});

test('climbTrees climbs from the bottom rung and records each one', async () => {
  const pool = createPool(2);
  try {
    const hill = libraryOpponents(settings).slice(0, 6);
    const r = await climbTrees({ pool, hill, rung: 3, sample: 2, cap: 1, clearRounds: 4, starts: [stone, paper], batch: 3, rounds: 2, race: 0, seed: 4 });
    assert.equal(r.of, 6);
    assert.ok(r.rungs.length >= 1 && r.rungs[0].from === 4 && r.rungs[0].to === 6, JSON.stringify(r.rungs));
    assert.ok(r.rungs.every((x) => x.skipped || x.generations >= 1));
    assert.ok(r.champion && r.champion.w && r.champion.tree);
    // The climb only stops early on a rung it could not clear.
    const last = r.rungs.at(-1);
    assert.ok(r.rungs.length === 2 || (!last.cleared && !last.skipped));
  } finally { pool.close(); }
});

test('a climb resumes from a rung with earlier champions', async () => {
  const pool = createPool(2);
  try {
    const hill = libraryOpponents(settings).slice(0, 6);
    const w = (await evolveTrees({ pool, field, starts: [paper], generations: 0, batch: 1, rounds: 2, race: 0, seed: 1, randomRate: 0 })).archive[0].w;
    const r = await climbTrees({ pool, hill, rung: 3, sample: 2, cap: 1, clearRounds: 4, fromRung: 2, previous: [{ tree: paper, shape: 'par', w }], starts: [stone], batch: 3, rounds: 2, race: 0, seed: 4 });
    assert.equal(r.rungs[0].rung, 2);
    assert.equal(r.rungs[0].from, 1);
  } finally { pool.close(); }
});

test('placeOnHill ranks a warrior among the hill by average points', async () => {
  const pool = createPool(2);
  try {
    const r = await evolveTrees({ pool, field, starts: [paper], generations: 0, batch: 1, rounds: 2, race: 0, seed: 1, randomRate: 0 });
    const p = await placeOnHill({ pool, field, w: r.archive[0].w, settings, rounds: 4 });
    assert.equal(p.of, field.length + 1);
    assert.ok(p.place >= 1 && p.place <= p.of);
    assert.equal(p.table.filter((x) => x.ours).length, 1);
    assert.deepEqual(p.table.map((x) => x.score), [...p.table.map((x) => x.score)].sort((a, b) => b - a));
  } finally { pool.close(); }
});
