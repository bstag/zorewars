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
const opponents = sources.slice(0, 2).map(({ w }, i) => ({ name: `Probe ${i}`, group: 'test', w: strip(w) }));
const options = { sources, opponents, settings, rounds: 3, batches: 1, batchSize: 4,
  evalRounds: 2, maxLength: 8, seed: 515, objective: 'points' };

test('a league breeds an exploiter and a league exploiter every generation', async () => {
  const pool = createPool(2);
  try {
    const r = await evolve({ ...options, pool, league: true });
    assert.equal(r.champions.length, 3);
    assert.deepEqual(r.exploiters.map((x) => x.name), ['Exploiter 1', 'Exploiter 2', 'Exploiter 3']);
    assert.deepEqual(r.leagueExploiters.map((x) => x.name), ['League exploiter 1', 'League exploiter 2', 'League exploiter 3']);
    // From generation 2 the main warriors must also beat the league's exploiters.
    assert.ok(r.history[1].caseNames.includes('Exploiter 1'));
    assert.ok(r.history[1].caseNames.includes('League exploiter 1'));
    assert.ok(!r.history[0].caseNames.some((n) => /xploiter/.test(n)));
    assert.equal(r.config.league, true);
    // Seeded: the same league twice gives the same result.
    assert.deepEqual(await evolve({ ...options, pool, league: true }), r);
  } finally { pool.close(); }
});

test('exploiters restart once they are old enough', async () => {
  const pool = createPool(2);
  try {
    const r = await evolve({ ...options, pool, league: true, exploitAge: 1, exploitWin: Infinity });
    assert.ok(r.exploiters.every((x) => x.restart));
    const kept = await evolve({ ...options, pool, league: true, exploitAge: 99, exploitWin: Infinity });
    assert.ok(kept.exploiters.every((x) => !x.restart));
  } finally { pool.close(); }
});

test('without a league nothing changes shape, and a league needs a gene pool', async () => {
  const pool = createPool(1);
  try {
    const r = await evolve({ ...options, pool, rounds: 1 });
    assert.equal(r.exploiters, undefined);
    assert.equal(r.config.league, undefined);
    await assert.rejects(evolve({ ...options, pool, league: true, scratch: true }), /league/);
  } finally { pool.close(); }
});
