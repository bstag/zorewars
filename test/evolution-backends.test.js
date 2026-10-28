import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile, DEFAULT_SETTINGS } from '../src/engine/index.js';
import { createMatchBackend } from '../src/engine/match-backend.js';
import { GpuBackendError } from '../src/engine/gpu/errors.js';
import { createPool, strip } from '../tools/hill.js';
import { evolve } from '../tools/evolve.js';

const settings = { ...DEFAULT_SETTINGS, coreSize: 80, maxLength: 10, minDistance: 10,
  maxCycles: 300, maxProcesses: 16, pSpace: false };
const sources = ['MOV.I 0, 1', 'SPL 0\nMOV.I 0, 1'].map((source) => ({
  w: compile(source, 'redcode', settings), role: 'imp',
}));
const opponents = sources.map(({ w }, i) => ({ name: `Probe ${i}`, group: 'test', w: strip(w) }));

test('evolution counters preserve accelerated solo checks and concurrent birth scheduling', async () => {
  const cpu = createPool(2);
  let soloChecks = 0, active = 0, peak = 0;
  // Exercise the GPU scheduling contract with CPU results, independent of
  // hardware availability. Match promises finish asynchronously in workers.
  const batched = {
    backend: 'gpu',
    async measureSpecies(w, cfg) {
      soloChecks++;
      await new Promise((resolve) => setImmediate(resolve));
      return cpu.measureSpecies(w, cfg);
    },
    match(task) {
      active++; peak = Math.max(peak, active);
      return cpu.match(task).finally(() => { active--; });
    },
  };
  try {
    for (const variant of [{ algorithm: 'ga' }, { algorithm: 'map-elites' },
      { algorithm: 'map-elites', selection: 'lexicase', descriptor: 'outcomes', localSteps: 2 }]) {
      for (const objective of ['points', 'pushoff']) {
        const options = { sources, opponents, settings, rounds: 2, batches: 1, batchSize: 4,
          populationSize: 4, archiveSize: 8, evalRounds: 2, fieldRounds: 2, maxLength: 8, seed: 991,
          objective, partners: objective === 'pushoff' ? [sources[0].w] : [], ...variant };
        assert.deepEqual(await evolve({ ...options, pool: batched }), await evolve({ ...options, pool: cpu }));
      }
    }
    assert.ok(soloChecks > 0, 'solo checks must use the supplied backend');
    assert.ok(peak > opponents.length + 2, 'independent candidates must still fill backend batches');
  } finally { cpu.close(); }
});

test('evolution observes a live GPU-to-CPU fallback without changing seeded results', async () => {
  const cpu = createPool(1), fallbackCpu = createPool(1);
  let failures = 0;
  const backend = await createMatchBackend({ backend: 'auto', createCpu: () => fallbackCpu,
    createGpu: async () => ({ backend: 'gpu',
      async measureSpecies() { failures++; throw new GpuBackendError('test solo device loss'); }, close() {},
    }) });
  try {
    const options = { sources, opponents, settings, rounds: 2, batches: 1, batchSize: 4,
      selection: 'lexicase', descriptor: 'outcomes', archiveSize: 8, localSteps: 1,
      evalRounds: 2, maxLength: 8, seed: 771 };
    assert.deepEqual(await evolve({ ...options, pool: backend }), await evolve({ ...options, pool: cpu }));
    assert.ok(failures > 0, 'the GPU solo method must not be bypassed');
    assert.equal(backend.backend, 'cpu');
    assert.match(backend.stats.fallbackReason, /device loss/);
  } finally { backend.close(); cpu.close(); }
});
