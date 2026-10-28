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

test('search, specialist selection, outcome niches and local refinement reproduce across workers', async () => {
  const one = createPool(1), two = createPool(2);
  try {
    for (const variant of [{ algorithm: 'map-elites' }, { algorithm: 'ga' },
      { algorithm: 'ga', selection: 'lexicase', localSteps: 2 },
      { algorithm: 'map-elites', selection: 'lexicase', descriptor: 'outcomes', archiveSize: 8, localSteps: 2 }]) {
      const { algorithm } = variant;
      const options = { sources, opponents: field, settings, rounds: 2, batches: 2, batchSize: 5, populationSize: 4,
        evalRounds: 2, maxLength: 10, ...variant, seed: 12345, objective: 'points' };
      const a = await evolve({ ...options, pool: one });
      const b = await evolve({ ...options, pool: two });
      assert.deepEqual(a, b, `${algorithm}: complete search must reproduce`);
      assert.ok(a.stats.cacheHits > 0);
      assert.ok(a.baseline && a.champions.length === 2);
      assert.equal(new Set(a.archive.map((x) => x.cell)).size, a.archive.length);
      if (algorithm === 'ga') assert.ok(a.population.length <= 4);
      if (variant.descriptor === 'outcomes') {
        assert.ok(a.archive.length <= 8);
        assert.equal(a.probes.length, field.length);
        assert.ok(a.archive.every((x) => /^o\d+$/.test(x.cell) && x.descriptor.length === field.length * 2));
      }
      assert.ok(a.stats.battleRounds > 0);
      assert.ok(a.archive.every((x) => x.cases.length === field.length + 1));
      if (variant.localSteps) assert.ok(a.stats.localTried > 0);
      const ids = new Set(a.lineage.map((x) => x.id));
      for (const node of a.lineage) for (const parent of node.parents) assert.ok(ids.has(parent));
      for (const c of a.archive) assert.ok(compile(toRedcode(c.g), 'redcode', settings).ok);
      const different = await evolve({ ...options, pool: two, seed: 54321 });
      assert.notDeepEqual(a.lineage, different.lineage);
    }
  } finally { one.close(); two.close(); }
});

test('smooth validation follows survival reward even when points prefer a different finalist', async () => {
  const baseline = { g: genomeOf(compile('JMP 0, #0')) };
  const longLived = { g: genomeOf(compile('JMP 0, #1')) };
  const pointsWinner = { g: genomeOf(compile('JMP 0, #2')) };
  const pool = { async match(task) {
    const kind = task.a.instructions[0].b, n = task.settings.rounds;
    return { w: kind === 2 ? n / 5 : 0, l: kind === 2 ? 4 * n / 5 : n, t: 0, smooth: n * [0.1, 0.9, 0.6][kind] };
  } };
  const opts = { pool, baseline, candidates: [longLived, pointsWinner], field: field.slice(0, 1), settings, seeds: 3 };
  const points = await validateCandidates(opts);
  const smooth = await validateCandidates({ ...opts, objective: 'smooth' });
  assert.equal(points.results.find((r) => r.id === points.recommended).g.code[0].b, 2);
  assert.equal(smooth.results.find((r) => r.id === smooth.recommended).g.code[0].b, 1);
  assert.equal(smooth.objective, 'smooth');
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

test('outcome/lexicase extensions preserve entry rules on rings, LP and a torus', async () => {
  const pool = createPool(1);
  try {
    for (const cfg of [RULESETS['88'], RULESETS.lp, RULESETS['94x'],
      { ...DEFAULT_SETTINGS, coreSize: 80, topology: 'torus', sizeX: 20, sizeY: 4, sizeZ: 1, maxLength: 10, minDistance: 10 }]) {
      const limits = { ...cfg, maxCycles: 300 };
      const w = compile(cfg.dialect === '88' ? 'MOV 0, 1' : 'MOV.I 0, 1', 'redcode', limits);
      const r = await evolve({ pool, sources: [{ w, role: 'imp' }], opponents: [{ name: 'Imp', group: 'probe', w: strip(w) }],
        settings: limits, rounds: 2, batches: 1, batchSize: 3, evalRounds: 1, seed: 91, maxLength: 8,
        selection: 'lexicase', descriptor: 'outcomes', archiveSize: 4, localSteps: 1 });
      assert.ok(r.archive.length > 0 && r.archive.length <= 4);
      const geo = limits.topology === 'torus' ? (await import('../src/engine/geometry.js')).makeGeometry(limits) : null;
      for (const x of r.archive) assert.ok(compile(toRedcode(x.g, { dialect: limits.dialect, coreSize: limits.coreSize, geo }), 'redcode', limits).ok);
    }
    await assert.rejects(evolve({ pool, sources, opponents: field, settings, algorithm: 'ga', descriptor: 'outcomes' }), /outcome niches/);
    await assert.rejects(evolve({ pool, sources, opponents: field, settings, descriptor: 'outcomes', scratch: true }), /outcome niches/);
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

test('push-off validation promotes a lower-point specialist and replays a shared fresh field per seed', async () => {
  const warrior = (kind) => compile(`JMP 0, #${kind}`, 'redcode', settings);
  const tasks = [];
  const pool = { async match(task) {
    tasks.push(task);
    let a = task.a.instructions[0].b, b = task.b.instructions[0].b;
    if (a === 0) a = 2; // baseline is a clone of our partner
    if (b === 0) b = 2;
    const win = a === 1 && b === 2 || a === 2 && b >= 3 || a >= 3 && b === 1;
    const lose = b === 1 && a === 2 || b === 2 && a >= 3 || b >= 3 && a === 1;
    const n = task.settings.rounds;
    return { w: win ? n : 0, l: lose ? n : 0, t: !win && !lose ? n : 0, smooth: n };
  } };
  const r = await validateCandidates({ pool, settings, objective: 'pushoff', seed: 41, seeds: 3, rounds: 10,
    baseline: { g: genomeOf(warrior(0)) }, candidates: [{ g: genomeOf(warrior(1)) }], partners: [warrior(2)],
    field: [3, 4].map((kind) => ({ name: `Probe ${kind}`, group: 'test', w: strip(warrior(kind)) })) });
  assert.equal(r.objective, 'pushoff');
  assert.ok(r.improved);
  const baseline = r.results.find((x) => x.baseline), chosen = r.results.find((x) => x.id === r.recommended);
  assert.ok(chosen.score < baseline.score, 'rank gain must count even when raw points fall');
  assert.ok(chosen.objectiveValue > baseline.objectiveValue);
  assert.equal(chosen.places.length, 3);
  assert.ok(chosen.places.every((p) => p.length === 2));
  const fieldTasks = tasks.filter((t) => t.a.instructions[0].b >= 2);
  assert.equal(fieldTasks.length, 3 * 6, 'one three-warrior round robin, including self, per fresh seed');
  assert.deepEqual(tasks.filter((t) => t.a.instructions[0].b === 0).map((t) => t.seed),
    tasks.filter((t) => t.a.instructions[0].b === 1).map((t) => t.seed));
});

test('CLI exports loadable outcome elites with specialist selection and refinement recorded', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'zorewars-outcomes-'));
  const result = spawnSync(process.execPath, ['cli/zorewars.js', 'evolve', '--rules', '88', '--length', '50',
    '--algorithm', 'map-elites', '--selection', 'lexicase', '--descriptor', 'outcomes', '--archive-size', '8',
    '--local-steps', '1', '--generations', '1', '--batches', '1', '--batch', '3', '--eval-rounds', '1',
    '--validate', '--check-rounds', '2', '--seeds', '2', '--finalists', '1', '--cycles', '500',
    '--threads', '1', '--seed', '77', '--out', out, '--json'], { encoding: 'utf8', timeout: 120000 });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(fs.readFileSync(path.join(out, 'evolve.json'), 'utf8'));
  assert.equal(report.config.selection, 'lexicase');
  assert.equal(report.config.localSteps, 1);
  assert.equal(report.validation.objective, 'smooth');
  assert.ok(report.centroids.length === 8 && report.probes.length > 0);
  const elites = fs.readdirSync(out).filter((f) => /^elite-o\d+\.red$/.test(f));
  assert.equal(elites.length, report.archive.length);
  for (const file of [...elites, 'best.red']) assert.ok(compile(fs.readFileSync(path.join(out, file), 'utf8'), 'redcode', report.config.entrySettings).ok);
});
