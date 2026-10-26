#!/usr/bin/env node
// CPU cost of the actual VM, including round setup but excluding compilation.
// Load seeds are fixed; simulated instruction counts must stay unchanged.
// node scripts/benchmark-vm.js [--rounds 12] [--samples 7] [--warmup 12]
//   [--scenario volume] [--candidate path/to/vm.js] [--compare path/to/vm.js] [--json]
// --compare alternates the two VMs and verifies their complete final state.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { compile, DEFAULT_SETTINGS, VM } from '../src/engine/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const rounds = Number(option('--rounds', 12));
const samples = Number(option('--samples', 7));
const warmup = Number(option('--warmup', 12));
if (![rounds, samples, warmup].every((v) => Number.isInteger(v) && v > 0)) throw new Error('rounds, samples and warmup must be positive integers');
const comparison = option('--compare');
const candidate = option('--candidate');
const CurrentVM = candidate ? (await import(pathToFileURL(path.resolve(candidate)))).VM : VM;
const ReferenceVM = comparison ? (await import(pathToFileURL(path.resolve(comparison)))).VM : null;
const plane = { topology: 'torus', coreSize: 8000, sizeX: 100, sizeY: 80, sizeZ: 1 };
const volume = { topology: 'torus', coreSize: 8000, sizeX: 40, sizeY: 20, sizeZ: 10 };
const scenarios = [
  { name: 'ring-paper', files: ['silk.red', 'fastsilk.js'] },
  { name: 'ring-scanner', files: ['seeker.red', 'silk.red'] },
  { name: 'ring-bomber', files: ['dwarf.red', 'stoneimp.red'] },
  { name: 'ring-multi', files: ['silk.red', 'dwarf.red', 'seeker.red', 'impring.red'] },
  { name: 'plane', files: ['plane/planesilk.js', 'plane/raster.js'], settings: plane },
  { name: 'volume', files: ['volume/volumesilk.js', 'volume/backdraft.js'], settings: volume },
  { name: 'volume-events', files: ['volume/scatter.js', 'volume/volumequeen.js'], settings: volume, events: true },
  { name: 'ring-trace', files: ['seeker.red', 'silk.red'], trace: 60 },
].filter((s) => !option('--scenario') || s.name === option('--scenario')).map((s) => {
  const settings = { ...DEFAULT_SETTINGS, ...s.settings };
  const warriors = s.files.map((file) => {
    const w = compile(fs.readFileSync(path.join(root, 'warriors', file), 'utf8'), file.endsWith('.js') ? 'javascript' : 'redcode', settings);
    assert.ok(w.ok, `${file}: ${JSON.stringify(w.errors)}`);
    return w;
  });
  return { ...s, settings, warriors };
});
assert.ok(scenarios.length, 'unknown scenario');

// Include the core, forensic history, FIFO order and headings, P-space,
// counters, events and trace. A matching winner alone can hide VM regressions.
function fingerprint(vm) {
  const hash = createHash('sha256');
  for (const key of ['op', 'mod', 'aMode', 'bMode', 'a', 'b', 'owner', 'lastWrite', 'lastExec', 'writerPc', 'writeCycle']) {
    const v = vm[key];
    hash.update(Buffer.from(v.buffer, v.byteOffset, v.byteLength));
  }
  const warriors = vm.warriors.map(({ queue, ...w }) => ({
    ...w,
    queue: [...queue],
    headings: Array.from({ length: queue.size }, (_, i) => queue.heads[(queue.head + i) % queue.buf.length]),
    h: queue.h,
    lastH: queue.lastH,
  }));
  hash.update(JSON.stringify({
    warriors, contacts: vm.contacts, events: vm.events, trace: vm.trace,
    turn: vm.turn, cycle: vm.cycle, steps: vm.steps, budget: vm.budget,
    done: vm.done, winner: vm.winner, aliveCount: vm.aliveCount,
    curH: vm.curH, curPc: vm.curPc,
  }));
  return hash.digest('hex');
}

function run(Engine, scenario, count, verify = false) {
  const cpuStart = process.cpuUsage();
  const start = performance.now();
  const vms = [];
  let steps = 0;
  const pspaces = scenario.warriors.map(() => Engine.freshPSpace(scenario.settings));
  for (let r = 0; r < count; r++) {
    const vm = new Engine(scenario.settings);
    if (scenario.events) vm.enableEvents();
    if (scenario.trace) vm.enableTrace(scenario.trace);
    vm.load(scenario.warriors, { seed: 100 + r, firstTurn: r % scenario.warriors.length, pspaces });
    vm.run();
    vm.recordResults();
    steps += vm.steps;
    if (verify) vms.push(fingerprint(vm));
  }
  const ms = performance.now() - start;
  const cpu = process.cpuUsage(cpuStart);
  return { ms, cpuMs: (cpu.user + cpu.system) / 1000, steps, fingerprints: vms };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
const rounded = (value) => +value.toFixed(2);
function summarize(runs) {
  const ms = median(runs.map((r) => r.ms));
  return {
    ms: rounded(ms),
    medianAbsoluteDeviationMs: rounded(median(runs.map((r) => Math.abs(r.ms - ms)))),
    // On Windows CPU time has coarse resolution; very short runs are noisy.
    cpuMs: rounded(median(runs.map((r) => r.cpuMs))),
    millionStepsPerSecond: rounded(runs[0].steps / ms / 1000),
  };
}
const results = [];
for (const scenario of scenarios) {
  // Warm the interpreter and JIT before measuring either implementation.
  run(CurrentVM, scenario, warmup);
  if (ReferenceVM) {
    run(ReferenceVM, scenario, warmup);
    const actual = run(CurrentVM, scenario, rounds, true);
    const expected = run(ReferenceVM, scenario, rounds, true);
    assert.deepEqual(actual.fingerprints, expected.fingerprints, `${scenario.name}: VM state changed`);
  }
  const current = [], reference = [];
  for (let i = 0; i < samples; i++) {
    if (ReferenceVM && i % 2 === 0) reference.push(run(ReferenceVM, scenario, rounds));
    current.push(run(CurrentVM, scenario, rounds));
    if (ReferenceVM && i % 2 !== 0) reference.push(run(ReferenceVM, scenario, rounds));
  }
  const baseline = ReferenceVM ? summarize(reference) : null;
  results.push({
    scenario: scenario.name, rounds, samples, steps: current[0].steps,
    ...summarize(current),
    ...(baseline ? {
      baselineMs: baseline.ms,
      baselineMedianAbsoluteDeviationMs: baseline.medianAbsoluteDeviationMs,
      baselineCpuMs: baseline.cpuMs,
      stateMatches: true,
    } : {}),
  });
}
if (args.includes('--json')) console.log(JSON.stringify({ node: process.version, platform: process.platform, warmup, results }, null, 2));
else console.table(results.map((r) => ({
  ...r,
  ...(ReferenceVM ? {
    speedup: `${(r.baselineMs / r.ms).toFixed(2)}x`,
    cpuReduction: r.baselineCpuMs > 0 ? `${(100 * (1 - r.cpuMs / r.baselineCpuMs)).toFixed(1)}%` : 'n/a',
  } : {}),
})));
