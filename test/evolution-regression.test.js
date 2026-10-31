import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compile, DEFAULT_SETTINGS } from '../src/engine/index.js';
import { createPool, strip } from '../tools/hill.js';
import { evolve } from '../tools/evolve.js';

// Captured before separating the instruction evolver. Hash the entire result:
// scores alone would miss changes to birth order, lineage, caches and counters.
const snapshots = {
  species: '7e5f6a091fc3f63bb932858e4907f96025f7eaea1cf4c702ea688ebc325ce9c1',
  ga: '7d79a097a4aba36463a64cd747d3f77c48733984c8163ac3f43990cefa678af7',
  lexicase: '9aba9519b1dbcca7e76a1019458ab30f32ac3190486c33723b1440c82b926fb3',
  outcomes: 'e7c65f3681f059ca4484d9415800758bb7b642d435d8a6d004fd09a7d6f2ffe8',
  racing: 'd9b329512304863df7bc4f8ef46624e3e5f81480261a6d57e48d04604e44ebcb',
  league: 'c6c17b7522ba17f0eee564b7e2f78b6be183749cb160e96e057f03f0a49dad5c',
  pushoff: 'd1fc40e9e797ea88bf50c244a564482b06a96149ca5a7cfc8771b7314409f967',
  scratch: 'f7ce85d080a6adf5bda69d0a901eccbb9e20b0b17ec8ece466ca259954b08251',
};
const variants = {
  species: {},
  ga: { algorithm: 'ga' },
  lexicase: { algorithm: 'ga', selection: 'lexicase', localSteps: 2 },
  outcomes: { selection: 'lexicase', descriptor: 'outcomes', archiveSize: 8, localSteps: 2 },
  racing: { race: 2 },
  league: { league: true, exploitAge: 1 },
  pushoff: { objective: 'pushoff', fieldRounds: 2 },
  scratch: { scratch: true, sources: [], opponents: [], maxLength: 2 },
};

test('instruction evolution preserves complete seeded results across search modes', async () => {
  const settings = { ...DEFAULT_SETTINGS, coreSize: 80, maxLength: 10, minDistance: 10,
    maxCycles: 300, maxProcesses: 16, pSpace: false };
  const sources = ['MOV.I 0, 1', 'SPL 0\nMOV.I 0, 1', 'ADD #4, 3\nMOV 2, @2\nJMP -2\nDAT 0, 0']
    .map(source => ({ w: compile(source, 'redcode', settings), role: 'imp' }));
  const opponents = sources.map(({ w }, i) => ({ name: `Probe ${i}`, group: 'test', w: strip(w) }));
  const pool = createPool(1);
  try {
    for (const [name, variant] of Object.entries(variants)) {
      const result = await evolve({ pool, sources, opponents, settings, rounds: 2, batches: 1,
        batchSize: 4, populationSize: 4, evalRounds: 2, maxLength: 8, seed: 515,
        objective: 'points', ...variant });
      const digest = createHash('sha256').update(JSON.stringify(result)).digest('hex');
      assert.equal(digest, snapshots[name], `${name}: seeded evolution changed`);
    }
  } finally { pool.close(); }
});
