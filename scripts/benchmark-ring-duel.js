// Compare engines on the same placements. Pass an optional path to native
// pMARS to validate its scores and measure its CLI wall time.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compile, RULESETS, runMatch } from '../src/engine/index.js';
import { createWasmRingKernel, ringDuelWasmURL } from '../src/engine/ring-duel-wasm.js';
import { createNativeRingKernel } from '../tools/ring-duel-native.js';

const argv = process.argv.slice(2);
const history = argv.includes('--history');
const kernelOnly = argv.includes('--kernel');
if (history && kernelOnly) throw new Error('--kernel measures score-only Rust execution');
const [roundsArg = history ? '8' : '200', pmars] = argv.filter(arg => !['--native', '--history', '--kernel'].includes(arg));
const rounds = Number(roundsArg);
if (!Number.isSafeInteger(rounds) || rounds < 1) throw new Error('Expected a positive round count');
const settings = { ...RULESETS['94nop'], rounds, ...(history ? { maxCycles: 10000 } : {}) };
const options = { fixed: 4000, executionHistory: history };
const createRingKernel = createWasmRingKernel(new WebAssembly.Module(readFileSync(ringDuelWasmURL)));
const nativeKernel = argv.includes('--native') ? createNativeRingKernel() : null;
const pairs = history ? [['silk', 'seeker']] : [['imp', 'impring'], ['silk', 'seeker'], ['oneshot', 'stoneimp']];
const time = (run) => {
  const start = performance.now();
  const result = run();
  return { result, ms: performance.now() - start };
};
const median = (samples) => samples.sort((a, b) => a - b)[Math.floor(samples.length / 2)];

function measureKernel(warriors, factory, expected) {
  const samples = [];
  for (let trial = 0; trial < 7; trial++) {
    let ms = 0, instructions = 0;
    const measured = (...args) => {
      const kernel = factory(...args), run = kernel.run;
      kernel.run = (firstTurn) => {
        const start = performance.now();
        const stopped = run(firstTurn);
        ms += performance.now() - start;
        instructions += stopped === null ? 2 * settings.maxCycles : stopped + 1;
        return stopped;
      };
      return kernel;
    };
    assert.deepEqual(runMatch(warriors, settings, { ...options, createRingKernel: measured }), expected);
    if (trial >= 2) samples.push(instructions / (1000 * ms));
  }
  return +median(samples).toFixed(1);
}

const results = pairs.map(([a, b]) => {
  const files = [a, b].map((name) => fileURLToPath(new URL(`../warriors/${name}.red`, import.meta.url)));
  const warriors = files.map((file) => compile(readFileSync(file, 'utf8'), 'redcode', settings));
  assert.ok(warriors.every((w) => w.ok));
  const js = () => runMatch(warriors, settings, options);
  const wasm = () => runMatch(warriors, settings, { ...options, createRingKernel });
  const expected = js();
  if (kernelOnly) return {
    pair: `${a} vs ${b}`,
    'Wasm M instructions/s': measureKernel(warriors, createRingKernel, expected),
    ...(nativeKernel ? { 'Native M instructions/s': measureKernel(warriors, nativeKernel, expected) } : {}),
  };
  const engines = [['js', js], ['wasm', wasm]];
  if (nativeKernel) engines.push(['native', () => runMatch(warriors, settings, { ...options, createRingKernel: nativeKernel })]);
  for (const [, run] of engines.slice(1)) assert.deepEqual(run(), expected);
  const times = { js: [], wasm: [], native: [], pmars: [] };
  for (let trial = 0; trial < 5; trial++) {
    for (const [name, run] of trial % 2 ? [...engines].reverse() : engines) {
      const sample = time(run);
      assert.deepEqual(sample.result, expected);
      times[name].push(sample.ms);
    }
    if (pmars) {
      const sample = time(() => spawnSync(pmars,
        ['-r', String(rounds), '-c', String(settings.maxCycles), '-b', '-k', '-F', String(options.fixed), ...files], { encoding: 'utf8' }));
      const { status, stdout, stderr, error } = sample.result;
      if (error) throw error;
      assert.equal(status, 0, stderr);
      const actual = stdout.trim().split(/\r?\n/).slice(-2).map((line) => line.trim().split(/\s+/).map(Number));
      assert.deepEqual(actual, expected.warriors.map(({ wins, ties }) => [wins, ties]));
      times.pmars.push(sample.ms);
    }
  }
  const jsMs = median(times.js);
  const wasmMs = median(times.wasm);
  return {
    pair: `${a} vs ${b}`,
    'JS ms': +jsMs.toFixed(1),
    'Wasm ms': +wasmMs.toFixed(1),
    'JS / Wasm': +(jsMs / wasmMs).toFixed(2),
    ...(nativeKernel ? { 'Native ms': +median(times.native).toFixed(1), 'JS / Native': +(jsMs / median(times.native)).toFixed(2) } : {}),
    ...(pmars ? { 'pMARS ms': +median(times.pmars).toFixed(1), 'Wasm / pMARS': +(wasmMs / median(times.pmars)).toFixed(2) } : {}),
  };
});
console.log(`${rounds} ${history ? 'full-history' : 'score-only'} rounds per pairing, median of five runs, Node ${process.versions.node} (${process.platform} ${process.arch})`);
if (kernelOnly) console.log('Times Rust calls with a preloaded core, including the language boundary.');
console.table(results);
