import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile, DEFAULT_SETTINGS, runMatch, runRound, VM } from '../src/engine/index.js';
import { matchPlan, summarizeMatch } from '../src/engine/match.js';
import { createMatchBackend } from '../src/engine/match-backend.js';
import { GpuBackendError } from '../src/engine/gpu/errors.js';
import { createCpuMatchPool } from '../web/cpu-matches.js';
import { createBrowserMatchPool } from '../web/matches.js';
import { createPool } from '../tools/hill.js';

const settings = { ...DEFAULT_SETTINGS, coreSize: 80, maxLength: 5, minDistance: 5, maxCycles: 100, maxProcesses: 8, rounds: 5 };
const taskFor = (cfg = settings) => ({ a: compile('SPL 0\nMOV.I 0, 1', 'redcode', cfg),
  b: compile('STP.AB #9, #1\nLDP.AB #1, 1\nJMP -2', 'redcode', cfg), settings: cfg, seed: 4242, diagnose: true, details: true });

test('shared match plans and yielding CPU results preserve both sides and round state', async () => {
  for (const shape of [{}, { topology: 'torus', sizeX: 10, sizeY: 8, sizeZ: 1 }, { topology: 'torus', sizeX: 10, sizeY: 4, sizeZ: 2 }]) {
    const task = taskFor({ ...settings, ...shape });
    const expected = runMatch([task.a, task.b], task.settings, { seed: task.seed, report: true });
    assert.deepEqual(matchPlan(task).map(({ seed, ...r }) => r), expected.rounds.map(({ positions, firstTurn }) => ({ positions, firstTurn })));
    const cpu = createCpuMatchPool();
    try {
      const result = await cpu.match(task);
      assert.deepEqual(result, summarizeMatch(task, expected.rounds.map(({ round, ...r }) => r)));
      for (const [side, actual] of [[0, result], [1, result.opponent]]) {
        const expectedSide = expected.warriors[side];
        assert.deepEqual(actual === result ? { w: actual.w, l: actual.l, t: actual.t, smooth: actual.smooth } : actual,
          { w: expectedSide.wins, l: expectedSide.losses, t: expectedSide.ties, smooth: expectedSide.smooth });
      }
    } finally { cpu.close(); }
  }
});

test('browser round plans preserve existing random placements and P-space across rounds', async () => {
  const task = taskFor();
  task.roundOptions = Array.from({ length: settings.rounds }, (_, r) => ({ seed: 27 + r, firstTurn: (r + 1) % 2 }));
  const pspaces = [VM.freshPSpace(settings), VM.freshPSpace(settings)];
  const rounds = task.roundOptions.map((options) => runRound([task.a, task.b], settings, { ...options, pspaces, report: true }));
  const cpu = createCpuMatchPool();
  try { assert.deepEqual(await cpu.match(task), summarizeMatch(task, rounds)); }
  finally { cpu.close(); }
  assert.throws(() => matchPlan({ ...task, roundOptions: [] }), /one entry per round/);
});

test('local CPU workers support the same detailed round plans as browser workers', async () => {
  const cpu = createPool(1), browser = createCpuMatchPool();
  try {
    for (const custom of [false, true]) {
      const task = taskFor();
      if (custom) task.roundOptions = Array.from({ length: settings.rounds }, (_, r) => ({ seed: 99 + r, firstTurn: (r + 1) % 2 }));
      const { id, ...actual } = await cpu.match(task);
      assert.deepEqual(actual, await browser.match(task));
    }
  } finally { cpu.close(); browser.close(); }
});

test('auto falls back once when GPU initialization fails; explicit GPU remains strict', async () => {
  let cpus = 0, notices = 0;
  const options = { createGpu: async () => { throw new Error('no GPU'); },
    createCpu: () => { cpus++; return { backend: 'cpu', size: 1, match: async (t) => t, close() {} }; },
    onFallback: (reason) => { notices++; assert.equal(reason, 'no GPU'); } };
  const pool = await createMatchBackend(options);
  assert.equal(pool.backend, 'cpu'); assert.equal(pool.stats.fallbackReason, 'no GPU');
  assert.equal(await pool.match(42), 42); pool.close();
  assert.equal(cpus, 1); assert.equal(notices, 1);
  await assert.rejects(createMatchBackend({ ...options, backend: 'gpu' }), /no GPU/);
  assert.equal(cpus, 1);
});

test('device failure retries every pending match with one CPU pool and unchanged tasks', async () => {
  let cpus = 0, closed = 0;
  const retried = [];
  const pool = await createMatchBackend({
    createGpu: async () => ({ backend: 'gpu', size: 8, match: () => Promise.reject(new GpuBackendError('device lost')), close() { closed++; } }),
    createCpu: async () => { cpus++; return { backend: 'cpu', size: 1, async match(task) { retried.push(task); return task.seed; }, close() {} }; },
  });
  const tasks = [1, 2, 3].map((seed) => ({ seed, settings }));
  assert.deepEqual(await Promise.all(tasks.map((t) => pool.match(t))), [1, 2, 3]);
  assert.deepEqual(retried, tasks); assert.equal(cpus, 1); assert.equal(closed, 1);
  assert.equal(pool.backend, 'cpu'); pool.close();
});

test('bad tasks do not hide their errors behind CPU fallback; closed backends do not retry', async () => {
  let cpus = 0;
  const pool = await createMatchBackend({
    createGpu: async () => ({ backend: 'gpu', match: async () => { throw new Error('bad warrior'); }, close() {} }),
    createCpu: () => { cpus++; },
  });
  await assert.rejects(pool.match({}), /bad warrior/); assert.equal(cpus, 0);
  pool.close(); await assert.rejects(pool.match({}), /closed/); assert.equal(cpus, 0);
});

test('browser auto mode remains usable when workers and WebGPU are unavailable', async () => {
  const pool = await createBrowserMatchPool({ createWorker: () => { throw new Error('workers blocked'); } });
  try {
    assert.equal(pool.backend, 'cpu');
    assert.match(pool.stats.fallbackReason, /workers blocked/);
    const task = taskFor();
    assert.deepEqual(await pool.match(task), summarizeMatch(task, runMatch([task.a, task.b], settings, { seed: task.seed, report: true }).rounds.map(({ round, ...r }) => r)));
  } finally { pool.close(); }
});

test('cancelled browser CPU matches publish no partial results', async () => {
  let cancelled = false;
  const pool = createCpuMatchPool({ cancelled: () => cancelled, yieldControl: async () => { cancelled = true; } });
  try {
    const task = taskFor({ ...settings, maxCycles: 1000000 });
    await assert.rejects(pool.match(task), { name: 'AbortError' });
    assert.equal(pool.stats.matches, 0); assert.equal(pool.stats.rounds, 0);
  } finally { pool.close(); }
});

test('Stop during worker initialization terminates it without starting CPU fallback', async () => {
  let cancelled = false, created = 0, terminated = 0;
  const result = createBrowserMatchPool({ cancelled: () => cancelled, createWorker: () => {
    created++;
    return { postMessage() { cancelled = true; }, terminate() { terminated++; } };
  } });
  await assert.rejects(result, { name: 'AbortError' });
  assert.equal(created, 1); assert.equal(terminated, 1);
});
