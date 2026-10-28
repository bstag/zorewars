#!/usr/bin/env node
// Time complete CLI evolution runs, including setup, breeding, classification,
// battle evaluation and saved artifacts. Only one additional CPU worker runs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const option = (key, fallback) => {
  const index = args.indexOf(key);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw Error(key + ' needs a value');
  return args[index + 1];
};
const integer = (key, fallback) => {
  const value = Number(option(key, fallback));
  if (!Number.isSafeInteger(value) || value < 1) throw Error(key + ' must be a positive integer');
  return value;
};
const samples = integer('--samples', 2);
const rules = option('--rules', '94nop');
if (!['94nop', '88', 'lp', '94x', '94x-hill'].includes(rules)) throw Error('Unknown ruleset');
const common = ['--rules', rules, '--generations', String(integer('--generations', 2)),
  '--batches', String(integer('--batches', 1)), '--batch', String(integer('--batch', 12)),
  '--eval-rounds', String(integer('--eval-rounds', 2)), '--seed', String(integer('--seed', 4242)),
  '--threads', '1'];
if (args.includes('--cycles')) common.push('--cycles', String(integer('--cycles')));
const stamp = new Date().toISOString().replaceAll(':', '-');
const out = path.resolve(root, option('--out', 'evolved/gpu-evolution-benchmark/' + stamp));
if (fs.existsSync(out) && fs.readdirSync(out).length) throw Error('Use a new, empty output directory');
fs.mkdirSync(out, { recursive: true });
const report = { status: 'running', startedAt: new Date().toISOString(), samples,
  scope: 'Complete local CLI evolution; current library only; one CPU worker; no held-out strength validation',
  timing: 'Wall time from starting Node to process exit, including initialization, shader setup and output files',
  host: { platform: process.platform, node: process.version, cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length },
  commonArgs: common, runs: [] };
const save = () => fs.writeFileSync(path.join(out, 'benchmark.json'), JSON.stringify(report, null, 2));
save();
let reference;
const evolutionResult = ({ execution, ...result }) => result;
async function run(backend, sample) {
  const directory = path.join(out, backend + '-' + sample);
  const command = ['cli/zorewars.js', 'evolve', ...common, '--backend', backend, '--out', directory];
  const stdout = fs.openSync(path.join(out, backend + '-' + sample + '.stdout.log'), 'w');
  const stderr = fs.openSync(path.join(out, backend + '-' + sample + '.stderr.log'), 'w');
  console.error('Starting ' + backend.toUpperCase() + ' evolution ' + sample + '/' + samples);
  const started = performance.now();
  let child;
  try {
    await new Promise((resolve, reject) => {
      child = spawn(process.execPath, command, { cwd: root, windowsHide: true, stdio: ['ignore', stdout, stderr] });
      child.once('error', reject);
      child.once('close', (code, signal) => code === 0 ? resolve() : reject(Error(backend + ' exited with ' + (signal ?? code) + '; see logs in ' + out)));
    });
  } finally { fs.closeSync(stdout); fs.closeSync(stderr); }
  const elapsedMs = performance.now() - started;
  const result = JSON.parse(fs.readFileSync(path.join(directory, 'evolve.json'), 'utf8'));
  assert.equal(result.execution.backend, backend, 'Requested backend must actually execute');
  if (backend === 'cpu') assert.equal(result.execution.threads, 1);
  const comparable = evolutionResult(result);
  if (reference) assert.deepEqual(comparable, reference, 'Same-seed complete evolution results must agree');
  else reference = comparable;
  const record = { backend, sample, elapsedMs, directory, command: [process.execPath, ...command],
    execution: result.execution, stats: result.stats, champions: result.champions.map(({ round, id, fit }) => ({ round, id, fit })),
    identicalEvolution: true };
  report.runs.push(record); save();
  console.error(backend.toUpperCase() + ' ' + sample + ': ' + (elapsedMs / 1000).toFixed(2) + ' seconds, ' + result.stats.evaluated + ' evaluations; evolution agrees');
}
const median = (numbers) => {
  const sorted = [...numbers].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
try {
  for (let sample = 1; sample <= samples; sample++) {
    for (const backend of sample % 2 ? ['gpu', 'cpu'] : ['cpu', 'gpu']) await run(backend, sample);
  }
  const cpu = report.runs.filter((r) => r.backend === 'cpu'), gpu = report.runs.filter((r) => r.backend === 'gpu');
  const cpuMs = median(cpu.map((r) => r.elapsedMs)), gpuMs = median(gpu.map((r) => r.elapsedMs));
  report.status = 'passed'; report.finishedAt = new Date().toISOString();
  report.summary = { cpuSeconds: cpuMs / 1000, gpuSeconds: gpuMs / 1000, speedup: cpuMs / gpuMs,
    elapsedTimeReductionPercent: (1 - gpuMs / cpuMs) * 100, cpuWorkers: 1,
    evaluatedPerRun: reference.stats.evaluated, sources: reference.inputs.sources.length, opponents: reference.inputs.opponents.length,
    settings: reference.config.settings, identicalEvolution: true, adapter: gpu[0].execution.adapter,
    matchesPerRun: gpu[0].execution.matches, battleRoundsPerRun: gpu[0].execution.rounds };
  save(); console.log(JSON.stringify({ ...report.summary, report: path.join(out, 'benchmark.json') }, null, 2));
} catch (error) { report.status = 'failed'; report.error = error.message; save(); throw error; }
