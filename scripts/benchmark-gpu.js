#!/usr/bin/env node
// Compare the same local match workload. CPU runs default to one worker so
// this can also be used alongside an existing evolution campaign.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { compile, DEFAULT_SETTINGS } from '../src/engine/index.js';
import { createPool, strip } from '../tools/hill.js';
import { createGpuPool } from '../tools/gpu.js';

const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const integer = (key, fallback) => {
  const value = Number(option(key, fallback));
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${key} must be a positive integer`);
  return value;
};
const matches = integer('--matches', 64), rounds = integer('--rounds', 3), samples = integer('--samples', 3);
const threads = integer('--threads', 1), cycles = integer('--cycles', 20000), batchSize = integer('--gpu-batch', 1024);
const scenario = option('--scenario', 'ring');
if (!['ring', 'volume'].includes(scenario)) throw new Error('--scenario takes ring or volume');
const settings = { ...DEFAULT_SETTINGS, rounds, maxCycles: cycles,
  ...(scenario === 'volume' ? { topology: 'torus', sizeX: 40, sizeY: 20, sizeZ: 10 } : {}) };
const files = scenario === 'ring' ? ['silk.red', 'seeker.red', 'dwarf.red', 'stoneimp.red', 'impring.red', 'fastsilk.js']
  : ['volume/volumesilk.js', 'volume/backdraft.js', 'volume/volumequeen.js'];
const warriors = files.map((file) => {
  const w = compile(fs.readFileSync(new URL(`../warriors/${file}`, import.meta.url), 'utf8'), file.endsWith('.js') ? 'javascript' : 'redcode', settings);
  assert.ok(w.ok, JSON.stringify(w.errors)); return strip(w);
});
const tasks = Array.from({ length: matches }, (_, i) => ({ a: warriors[i % warriors.length],
  b: warriors[Math.floor(i / warriors.length) % warriors.length], settings, seed: 4242 + i * 7, diagnose: true }));
const gpu = await createGpuPool({ batchSize }), cpu = createPool(threads);
const run = async (pool, workload) => {
  const cpuStart = process.cpuUsage();
  const start = performance.now();
  const results = await Promise.all(workload.map((task) => pool.match(task)));
  const usage = process.cpuUsage(cpuStart);
  // CPU worker messages contain transport ids; those are not battle results.
  return { ms: performance.now() - start, cpuMs: (usage.user + usage.system) / 1000, results: results.map(({ id, ...r }) => r) };
};
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
try {
  const startup = await run(gpu, tasks.slice(0, 1));
  await run(cpu, tasks.slice(0, 4));
  const cpuTimes = [], gpuTimes = [], cpuUsage = [], gpuUsage = [];
  for (let sample = 0; sample < samples; sample++) {
    let a, b;
    if (sample % 2 === 0) { a = await run(cpu, tasks); b = await run(gpu, tasks); }
    else { b = await run(gpu, tasks); a = await run(cpu, tasks); }
    assert.deepEqual(b.results, a.results, 'GPU results must exactly match CPU results before reporting speed');
    cpuTimes.push(a.ms); gpuTimes.push(b.ms);
    cpuUsage.push(a.cpuMs); gpuUsage.push(b.cpuMs);
  }
  const cpuMs = median(cpuTimes), gpuMs = median(gpuTimes);
  const result = { scenario, matches, rounds, cycles, samples, cpuThreads: threads, state: 'match summaries and loss symptoms agree',
    adapter: gpu.stats.adapter, coldGpuMs: +startup.ms.toFixed(2),
    cpuMs: +cpuMs.toFixed(2), gpuMs: +gpuMs.toFixed(2), speedup: +(cpuMs / gpuMs).toFixed(3),
    cpuSamplesMs: cpuTimes.map((n) => +n.toFixed(2)), gpuSamplesMs: gpuTimes.map((n) => +n.toFixed(2)),
    cpuReferenceCpuMs: +median(cpuUsage).toFixed(2), gpuHostCpuMs: +median(gpuUsage).toFixed(2),
    gpuRoundsPerSecond: +(matches * rounds * 1000 / gpuMs).toFixed(2) };
  console.log(JSON.stringify(result, null, 2));
} finally { cpu.close(); gpu.close(); }
