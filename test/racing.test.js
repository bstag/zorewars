import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile, DEFAULT_SETTINGS } from '../src/engine/index.js';
import { createPool, strip } from '../tools/hill.js';
import { evolve } from '../tools/evolve.js';

const settings = { ...DEFAULT_SETTINGS, coreSize: 80, maxLength: 10, minDistance: 10,
  maxCycles: 300, maxProcesses: 16, pSpace: false };
const sources = ['MOV.I 0, 1', 'SPL 0\nMOV.I 0, 1', 'ADD #4, 3\nMOV 2, @2\nJMP -2\nDAT 0, 0'].map((source) => ({
  w: compile(source, 'redcode', settings), role: 'imp',
}));
const opponents = sources.map(({ w }, i) => ({ name: `Probe ${i}`, group: 'test', w: strip(w) }));
const options = { sources, opponents, settings, rounds: 2, batches: 2, batchSize: 6,
  evalRounds: 2, maxLength: 8, seed: 515, objective: 'points' };

test('racing makes a would-be elite win again with doubled rounds', async () => {
  const pool = createPool(2);
  try {
    const replaced = [];
    const r = await evolve({ ...options, pool, race: 2, onPlace: (x, old) => { if (old) replaced.push([x, old]); } });
    assert.equal(r.config.race, 2);
    assert.ok(r.stats.raced > 0 && r.stats.promoted <= r.stats.raced);
    assert.ok(replaced.length > 0);
    // Every replacement was decided at the top racing level, on common seeds.
    for (const [x] of replaced) assert.equal(x.level, 2);
    // Champions come from the finalists' play-off, one level higher.
    assert.ok(r.champions.every((c) => c.fit !== undefined));
    assert.deepEqual(await evolve({ ...options, pool, race: 2 }), r);
    // Without racing nothing is raced.
    const plain = await evolve({ ...options, pool });
    assert.equal(plain.stats.raced, 0);
    assert.equal(plain.config.race, undefined);
  } finally { pool.close(); }
});

test('racing needs map-elites with species niches', async () => {
  const pool = createPool(1);
  try {
    await assert.rejects(evolve({ ...options, pool, race: 1, algorithm: 'ga' }), /racing/);
    await assert.rejects(evolve({ ...options, pool, race: 7 }), /race/);
  } finally { pool.close(); }
});
