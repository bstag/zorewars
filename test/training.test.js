import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { compile, DEFAULT_SETTINGS, mulberry32, RULESETS } from '../src/engine/index.js';
import { createPool, libraryOpponents, strip } from '../tools/hill.js';
import { evolve } from '../tools/evolve.js';
import { crossover, genomeOf, randomGenome, toRedcode } from '../tools/genes.js';
import { trainingProfiles, validateCandidates } from '../tools/training.js';

const settings = { ...DEFAULT_SETTINGS, coreSize: 80, maxLength: 10, minDistance: 10, maxCycles: 1000, maxProcesses: 16, pSpace: false };
const imp = compile('MOV.I 0, 1', 'redcode', settings);
const stone = compile('ADD.AB #4, 3\nMOV.I 2, @2\nJMP -2\nDAT #0, #0', 'redcode', settings);
const sources = [{ w: imp, role: 'imp' }, { w: stone, role: 'stone' }];
const field = sources.map(({ w }, i) => ({ name: `Opponent ${i}`, group: 'test', w: strip(w) }));

test('both search algorithms are seeded, isolated and repeatable across worker counts', async () => {
  const one = createPool(1), two = createPool(2);
  try {
    for (const algorithm of ['map-elites', 'ga']) {
      const options = { sources, opponents: field, settings, rounds: 2, batches: 2, batchSize: 5, populationSize: 4,
        evalRounds: 2, maxLength: 10, algorithm, seed: 12345, objective: 'points' };
      const a = await evolve({ ...options, pool: one });
      const b = await evolve({ ...options, pool: two });
      assert.deepEqual(a, b, `${algorithm}: complete search must reproduce`);
      assert.ok(a.stats.cacheHits > 0);
      assert.ok(a.baseline && a.champions.length === 2);
      assert.equal(new Set(a.archive.map((x) => x.cell)).size, a.archive.length);
      if (algorithm === 'ga') assert.ok(a.population.length <= 4);
      const ids = new Set(a.lineage.map((x) => x.id));
      for (const node of a.lineage) for (const parent of node.parents) assert.ok(ids.has(parent));
      for (const c of a.archive) assert.ok(compile(toRedcode(c.g), 'redcode', settings).ok);
      const different = await evolve({ ...options, pool: two, seed: 54321 });
      assert.notDeepEqual(a.lineage, different.lineage);
    }
  } finally { one.close(); two.close(); }
});

test('entry rules remain strict when opponents need relaxed settings', async () => {
  const pool = createPool(1);
  try {
    const forbidden = compile('LDP #0, 1\nJMP -1', 'redcode', { ...settings, pSpace: true });
    const result = await evolve({ pool, settings: { ...settings, pSpace: true, maxLength: 20 }, entrySettings: settings,
      sources: [...sources, { w: forbidden, role: 'scan' }], opponents: field,
      rounds: 1, batches: 1, batchSize: 4, maxLength: 10, seed: 7 });
    assert.ok(result.stats.rejected > 0);
    for (const x of result.archive) assert.ok(compile(toRedcode(x.g), 'redcode', settings).ok);
  } finally { pool.close(); }
});

test('P-space random generation does not contaminate later no-P-space searches', () => {
  const random = mulberry32(99);
  let found = false;
  for (let i = 0; i < 100; i++) {
    found ||= randomGenome(20, { pSpace: true, random }).code.some((x) => ['LDP', 'STP'].includes(x.op));
    assert.ok(randomGenome(20, { pSpace: false, random }).code.every((x) => !['LDP', 'STP'].includes(x.op)));
  }
  assert.ok(found);
});

test('GA crossover keeps inherited instructions at their original indices', () => {
  const random = mulberry32(123);
  const x = randomGenome(10, { random }), y = randomGenome(10, { random });
  const original = structuredClone([x, y]);
  for (let i = 0; i < 30; i++) {
    const child = crossover(x, y, 10, random, { aligned: true });
    assert.equal(child.code.length, 10);
    for (let k = 0; k < 10; k++) {
      assert.ok(JSON.stringify(child.code[k]) === JSON.stringify(x.code[k]) || JSON.stringify(child.code[k]) === JSON.stringify(y.code[k]));
    }
    assert.ok(child.start >= 0 && child.start < child.code.length);
  }
  assert.deepEqual([x, y], original, 'crossover leaves parents intact');
});

test('scratch supports short genomes and emits legal ICWS 88', async () => {
  const pool = createPool(1);
  const cfg = { ...settings, dialect: '88' };
  try {
    const r = await evolve({ pool, sources: [], opponents: [], settings: cfg, scratch: true,
      rounds: 1, batches: 1, batchSize: 4, maxLength: 2, evalRounds: 2, seed: 12 });
    assert.ok(r.archive.length);
    for (const x of r.archive) {
      assert.ok(x.g.code.length <= 2);
      assert.ok(compile(toRedcode(x.g, { dialect: '88', coreSize: cfg.coreSize }), 'redcode', cfg).ok);
    }
  } finally { pool.close(); }
});

test('validation uses points, common fresh placements, and retains baseline without a clear gain', async () => {
  const baseline = { g: genomeOf(compile('JMP 0, #0')), fit: 0 };
  const winning = { g: genomeOf(compile('JMP 0, #1')), fit: 0 };
  const lucky = { g: genomeOf(compile('JMP 0, #2')), fit: 100 };
  const tasks = [];
  const pool = { async match(task) {
    tasks.push(task);
    const n = task.settings.rounds;
    const kind = task.a.instructions[0].b;
    const win = kind === 1 || (kind === 2 && task.seed % 3 === 0);
    const lose = kind === 2 && !win;
    return { w: win ? n : 0, l: lose ? n : 0, t: !win && !lose ? n : 0, smooth: n * (kind === 2 ? 3 : 1) };
  } };
  const opts = { pool, baseline, field: field.slice(0, 1), settings, seeds: 3, rounds: 10, seed: 42 };
  const r = await validateCandidates({ ...opts, candidates: [winning, winning, lucky] });
  assert.ok(r.improved);
  assert.equal(r.results.length, 3, 'duplicate genomes are evaluated once');
  assert.equal(r.results.find((x) => x.id === r.recommended).score, 3);
  assert.deepEqual(tasks.slice(0, 3).map((t) => t.seed), tasks.slice(3, 6).map((t) => t.seed));
  const noGain = await validateCandidates({ ...opts, candidates: [lucky] });
  assert.equal(noGain.improved, false);
  assert.equal(noGain.recommended, noGain.baseline);
  await assert.rejects(validateCandidates({ ...opts, candidates: [], field: [] }), /opponents/);
  await assert.rejects(validateCandidates({ ...opts, candidates: [], seeds: 1 }), /seeds/);
});

test('training profiles cover ring rules, planes and volumes; 88 opponents are actually legal', () => {
  assert.deepEqual(trainingProfiles().map((p) => p.name), ['94nop', '88', 'lp', '94x']);
  const all = trainingProfiles('all');
  for (const name of Object.keys(RULESETS)) assert.ok(all.some((p) => p.name === name));
  assert.ok(all.some((p) => p.flags.torus === '20x20x20'));
  assert.throws(() => trainingProfiles('unknown'), /unknown training profile/);
  assert.throws(() => trainingProfiles('88,88'), /duplicates/);
  for (const opponent of libraryOpponents(RULESETS['88'])) {
    const g = genomeOf(opponent.w);
    assert.ok(compile(toRedcode(g, { dialect: '88' }), 'redcode', RULESETS['88']).ok);
  }
});

test('train CLI writes independently loadable recommendations and complete reports', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'zorewars-train-'));
  const result = spawnSync(process.execPath, ['cli/zorewars.js', 'train', '--profiles', '88,volume-cube',
    '--generations', '1', '--batches', '1', '--batch', '3', '--eval-rounds', '1', '--check-rounds', '2',
    '--seeds', '2', '--finalists', '1', '--cycles', '500', '--threads', '1', '--seed', '77', '--out', out, '--json'],
  { encoding: 'utf8', timeout: 120000 });
  assert.equal(result.status, 0, result.stderr);
  const campaign = JSON.parse(result.stdout);
  assert.equal(campaign.profiles.length, 2);
  for (const profile of campaign.profiles) {
    const report = JSON.parse(fs.readFileSync(profile.report, 'utf8'));
    assert.equal(report.config.algorithm, 'ga');
    assert.equal(report.config.objective, 'points');
    assert.ok(report.inputs.sources.length && report.validation.results.length);
    assert.ok(compile(fs.readFileSync(profile.file, 'utf8'), 'redcode', report.config.entrySettings).ok);
    const recommended = report.validation.results.find((x) => x.id === report.validation.recommended);
    assert.equal(profile.score, recommended.score);
    assert.equal(profile.gain, recommended.gain);
    assert.equal(profile.improved, report.validation.improved);
  }
  assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'training.json'), 'utf8')).profiles.length, 2);
});

test('the pushoff objective ranks each candidate in a push-off beside its partners', async () => {
  const pool = createPool(1);
  try {
    const partner = compile('SPL 0\nMOV.I 0, 1', 'redcode', settings);
    const r = await evolve({ pool, sources, opponents: field, settings, rounds: 1, batches: 1, batchSize: 4, populationSize: 4,
      evalRounds: 2, maxLength: 10, algorithm: 'ga', seed: 7, objective: 'pushoff', partners: [partner] });
    const n = field.length + 2;                          // candidate, partner, opponents
    for (const x of r.population) {
      assert.equal(x.places.length, 2);
      for (const p of x.places) assert.ok(p >= 1 && p <= n);
      assert.ok(Math.abs(x.fit - (-(x.places[0] + x.places[1] / 2))) < 0.1, 'fitness is the places, points only break ties');
    }
    await assert.rejects(evolve({ pool, sources, opponents: [], settings, objective: 'pushoff' }), /needs opponents/);
  } finally { pool.close(); }
});
