import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile, DEFAULT_SETTINGS, runMatch, diagnoseRounds, mulberry32 } from '../src/engine/index.js';
import { OPCODES, MODIFIERS, MODES, RULESETS } from '../src/engine/constants.js';
import { createGpuPool } from '../tools/gpu.js';
import { createPool, strip } from '../tools/hill.js';
import { evolve } from '../tools/evolve.js';
import { roundRobin } from '../tools/pushoff.js';
import { randomGenome, toWarrior } from '../tools/genes.js';

const enabled = process.env.ZOREWARS_GPU_TEST === '1';
const cfg = { ...DEFAULT_SETTINGS, coreSize: 80, maxLength: 12, minDistance: 12, maxCycles: 300, maxProcesses: 8, rounds: 4 };
const summary = (task) => {
  const m = runMatch([task.a, task.b], task.settings, { seed: task.seed, report: !!task.diagnose });
  const a = m.warriors[0];
  return { w: a.wins, l: a.losses, t: a.ties, smooth: a.smooth, ...(task.diagnose ? { d: diagnoseRounds(m.rounds) } : {}) };
};
const warrior = (source, settings = cfg) => {
  const w = compile(source, 'redcode', settings);
  assert.ok(w.ok, JSON.stringify(w.errors));
  return strip(w);
};

test('GPU options reject invalid batch sizes before loading the runtime', async () => {
  for (const batchSize of [0, -1, 1.2, NaN]) await assert.rejects(createGpuPool({ batchSize }), /positive integer/);
});

test('GPU round-robin reference field fills a batch and retains CPU pair results', { skip: !enabled }, async () => {
  const gpu = await createGpuPool({ batchSize: 256 });
  const cpu = { backend: 'cpu', match: async (task) => summary(task) };
  const ws = [warrior('MOV.I 0, 1'), warrior('ADD.AB #4, 3\nMOV.I 2, @2\nJMP -2\nDAT 0, 0'), warrior('SPL 0\nJMP -1')];
  try {
    for (const self of [true, false]) {
      const warriors = self ? ws.slice(0, 2) : ws;
      const options = { rounds: 4, seed: 4242, settings: cfg, self };
      const expected = await roundRobin(cpu, warriors, options);
      const before = { ...gpu.stats }, progress = [];
      const actual = await roundRobin(gpu, warriors, { ...options, onProgress: (i, n) => progress.push([i, n]) });
      assert.deepEqual(actual, expected, 'Every seeded pair and mirrored score must agree');
      assert.equal(gpu.stats.matches - before.matches, 3);
      assert.equal(gpu.stats.batches - before.batches, 1, 'Independent rows should fill one GPU batch');
      assert.deepEqual(progress, warriors.map((_, i) => [i + 1, warriors.length]));
    }
  } finally { gpu.close(); }
});

test('local GPU agrees with the CPU interpreter and seeded evolution', { skip: !enabled }, async (t) => {
  const gpu = await createGpuPool({ batchSize: 256 });
  const verify = async (tasks) => {
    const actual = await Promise.all(tasks.map((task) => gpu.match(task)));
    // Intentionally sequential: GPU verification never starts a CPU worker farm.
    tasks.forEach((task, i) => assert.deepEqual(actual[i], summary(task), `task ${i}: ${task.a.name} vs ${task.b.name}`));
  };
  try {
    await t.test('every ring opcode, modifier and addressing mode, including aliased operands', async () => {
      const random = mulberry32(4242), tasks = [];
      const enemy = warrior('SPL 0\nMOV.I 2, >1\nDJN -1, #40\nDAT 0, 0');
      for (const op of OPCODES.filter((op) => op !== 'TRN')) {
        for (const mod of MODIFIERS) for (let mode = 0; mode < MODES.length; mode++) {
          const g = randomGenome(12, { coreSize: cfg.coreSize, random });
          g.code[0] = { op, mod, aMode: MODES[mode], a: mode % 3, bMode: MODES[(mode + 3) % 8], b: mode % 2 };
          g.start = 0;
          tasks.push({ a: toWarrior(g, `${op}.${mod}/${mode}`, cfg.coreSize), b: enemy, settings: cfg, seed: 17 + mode, diagnose: true });
        }
      }
      await verify(tasks);
    });
    await t.test('P-space persists between rounds; first mover rotates', async () => {
      const a = warrior('LDP.AB #0, 5\nJMZ 3, 4\nSTP.AB #42, #1\nSPL 0\nJMP -4\nDAT 0, 0');
      const b = warrior('LDP.AB #1, 4\nADD.AB #1, 3\nSTP.B 2, #1\nJMP -3\nDAT 0, 0');
      await verify([1, 42, 2147483646].map((seed) => ({ a, b, settings: { ...cfg, rounds: 9, pSpaceSize: 7 }, seed, diagnose: true })));
    });
    await t.test('legal entry points outside the body retain CPU wrapping semantics', async () => {
      const plane = { ...cfg, topology: 'torus', sizeX: 10, sizeY: 8, sizeZ: 1, maxLength: 5 };
      await verify([cfg, plane].map((settings) => ({ a: warrior('ORG 17\nMOV.I 0, 1', settings),
        b: warrior('MOV.I 0, 1', settings), settings, seed: 4242, diagnose: true })));
    });
    await t.test('library fights and process queue saturation', async () => {
      const settings = { ...DEFAULT_SETTINGS, rounds: 3, maxCycles: 6500 };
      const files = ['silk.red', 'seeker.red', 'dwarf.red', 'stoneimp.red', 'impring.red', 'fastsilk.js'];
      const ws = files.map((file) => {
        const w = compile(fs.readFileSync(new URL(`../warriors/${file}`, import.meta.url), 'utf8'), file.endsWith('.js') ? 'javascript' : 'redcode', settings);
        assert.ok(w.ok); return strip(w);
      });
      await verify(ws.flatMap((a, i) => ws.slice(i).map((b, j) => ({ a, b, settings, seed: 4242 + i * 7 + j, diagnose: true }))));
    });
    await t.test('current library pairs agree under full standard ruleset limits', async (t) => {
      const profiles = [
        ['88', ['88/dwarf.red', '88/scout-88.red', '88/impring-88.red']],
        ['94nop', ['silk.red', 'seeker.red', 'stoneimp.red']],
        ['lp', ['silk.red', 'seeker.red', 'dwarf.red']],
        ['94x', ['silk.red', 'stoneimp.red', 'impring.red']],
        ['94x-hill', ['chameleon.js', 'bandit.js', 'seeker.red']],
      ];
      for (const [rules, files] of profiles) await t.test(rules, async () => {
        const settings = { ...DEFAULT_SETTINGS, ...RULESETS[rules], rounds: 4 };
        const ws = files.map((file) => {
          const w = compile(fs.readFileSync(new URL('../warriors/' + file, import.meta.url), 'utf8'),
            file.endsWith('.js') ? 'javascript' : 'redcode', settings);
          assert.ok(w.ok, rules + ': ' + file + ': ' + JSON.stringify(w.errors));
          return strip(w);
        });
        const tasks = ws.flatMap((a, i) => ws.slice(i).map((b, j) => ({
          a, b, settings, seed: 4242 + i * 7 + j, diagnose: true,
        })));
        await verify(tasks);
      });
    });
    await t.test('large-core multiplication uses exact modular arithmetic', async () => {
      const settings = { ...cfg, coreSize: 100000, minDistance: 100, maxLength: 12, maxCycles: 200, rounds: 2 };
      const a = warrior('MUL.F #99999, 1\nSNE.AB #1, 0\nJMP -2\nMOV.I 0, 1', settings);
      await verify([{ a, b: warrior('MOV.I 0, 1', settings), settings, seed: 4242, diagnose: true }]);
    });
    await t.test('plane and volume geometry, headings, vector division and process queues', async () => {
      for (const [sizeX, sizeY, sizeZ] of [[10, 8, 1], [10, 4, 2], [11, 3, 3]]) {
        const settings = { ...cfg, topology: 'torus', sizeX, sizeY, sizeZ, coreSize: sizeX * sizeY * sizeZ, maxLength: 5, rounds: 3 };
        const random = mulberry32(71), tasks = [];
        for (let i = 0; i < 100; i++) {
          const a = randomGenome(5, { coreSize: settings.coreSize, random });
          const b = randomGenome(5, { coreSize: settings.coreSize, random });
          // Exercise turns even when random generation selected ring opcodes.
          a.code[i % 5].op = 'TRN';
          tasks.push({ a: toWarrior(a, `vector ${i}`, settings.coreSize), b: toWarrior(b, 'enemy', settings.coreSize), settings, seed: i + 1, diagnose: true });
        }
        await verify(tasks);
      }
      const settings = { ...DEFAULT_SETTINGS, topology: 'torus', sizeX: 40, sizeY: 20, sizeZ: 10, rounds: 3, maxCycles: 6500 };
      const ws = ['volumesilk.js', 'backdraft.js', 'volumequeen.js'].map((file) => {
        const w = compile(fs.readFileSync(new URL(`../warriors/volume/${file}`, import.meta.url), 'utf8'), 'javascript', settings);
        assert.ok(w.ok); return strip(w);
      });
      await verify(ws.flatMap((a) => ws.map((b) => ({ a, b, settings, seed: 4242, diagnose: true }))));
      const wide = { ...settings, sizeX: 80, sizeY: 10 };
      const adapter = strip(compile(fs.readFileSync(new URL('../warriors/volume/adapter.js', import.meta.url), 'utf8'), 'javascript', wide));
      await verify(ws.map((b) => ({ a: adapter, b, settings: wide, seed: 4242, diagnose: true })));
    });
    await t.test('complete searches reproduce across CPU and GPU, including caches and operator credit', async () => {
      const cpu = createPool(1);
      try {
        const settings = { ...cfg, pSpace: false, maxCycles: 200, rounds: 1 };
        const sources = ['MOV.I 0, 1', 'ADD.AB #4, 3\nMOV.I 2, @2\nJMP -2\nDAT #0, #0'].map((s) => ({ w: warrior(s, settings), role: 'stone' }));
        const opponents = sources.map(({ w }) => ({ name: w.name, group: 'test', w }));
        for (const algorithm of ['map-elites', 'ga']) {
          const options = { sources, opponents, settings, seed: 12345, rounds: 2, batches: 2, batchSize: 5, evalRounds: 2, maxLength: 12, populationSize: 4, algorithm };
          const expected = await evolve({ ...options, pool: cpu });
          const actual = await evolve({ ...options, pool: gpu });
          assert.deepEqual(actual, expected, algorithm);
        }
        for (const objective of ['points', 'pushoff']) {
          const options = { sources, opponents, settings, seed: 77, rounds: 1, batches: 1, batchSize: 4,
            evalRounds: 2, fieldRounds: 2, maxLength: 12, partners: objective === 'pushoff' ? [sources[0].w] : [], objective };
          assert.deepEqual(await evolve({ ...options, pool: gpu }), await evolve({ ...options, pool: cpu }), objective);
        }
        const plane = { ...settings, topology: 'torus', sizeX: 10, sizeY: 8, sizeZ: 1, maxLength: 5 };
        const planeSources = ['MOV.I 0, 1', 'SPL 0\nJMP -1'].map((s) => ({ w: warrior(s, plane), role: 'paper' }));
        const options = { sources: planeSources, opponents: planeSources.map(({ w }) => ({ name: w.name, group: 'test', w })),
          settings: plane, seed: 77, rounds: 1, batches: 1, batchSize: 4, evalRounds: 2, maxLength: 5 };
        assert.deepEqual(await evolve({ ...options, pool: gpu }), await evolve({ ...options, pool: cpu }), 'torus archive and mutations');
      } finally { cpu.close(); }
    });
    assert.ok(gpu.stats.matches > 1000);
  } finally { gpu.close(); }
});
