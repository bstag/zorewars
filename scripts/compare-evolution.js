// Reproducible algorithm ablations on the real '88/50-instruction rules.
// Same initial sources, generation/offspring schedule and validation seeds.
// Actual battle counts are reported: archives and local search cost different
// amounts, so this is NOT an equal-compute tournament or a hill-strength claim.
// node scripts/compare-evolution.js --seeds 4242,4243,4244 --threads 4
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, measureSpecies, RULESETS } from '../src/engine/index.js';
import { createPool, evaluate, libraryOpponents, strip } from '../tools/hill.js';
import { evolve } from '../tools/evolve.js';
import { roleOf, toRedcode } from '../tools/genes.js';
import { validateCandidates } from '../tools/training.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback;
const integer = (name, fallback) => {
  const n = Number(option(name, fallback));
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`--${name} must be a positive integer`);
  return n;
};
const out = path.resolve(option('out', path.join(root, 'evolved', 'algorithm-comparison')));
const seeds = String(option('seeds', '4242,4243,4244')).split(',').map(Number);
if (!seeds.length || seeds.some((n) => !Number.isSafeInteger(n) || n < 0 || n > 2147483646)) throw new Error('invalid seeds');
const variants = {
  ga: { algorithm: 'ga' },
  lexicase: { algorithm: 'ga', selection: 'lexicase' },
  species: { algorithm: 'map-elites' },
  outcomes: { algorithm: 'map-elites', descriptor: 'outcomes' },
  'outcomes-lexicase': { algorithm: 'map-elites', descriptor: 'outcomes', selection: 'lexicase' },
  memetic: { algorithm: 'map-elites', descriptor: 'outcomes', selection: 'lexicase', localSteps: 2 },
};
const names = String(option('variants', Object.keys(variants).join(','))).split(',');
if (names.some((n) => !Object.hasOwn(variants, n))) throw new Error(`variants: ${Object.keys(variants).join(', ')}`);
const settings = { ...RULESETS['88'], maxLength: 50, maxCycles: integer('cycles', RULESETS['88'].maxCycles) };
const opponents = libraryOpponents(settings);
const sources = [...opponents, ...libraryOpponents({ ...settings, dialect: undefined })]
  .map((o) => ({ w: o.w, role: roleOf(`${o.category} ${o.name}`) }));
const heldOut = ['afterimage', 'levy', 'riptide', 'telltale', 'undercurrent'].map((name) => {
  const file = path.join(root, 'examples', 'experimental-88', `${name}.red`);
  const w = compile(fs.readFileSync(file, 'utf8'), 'redcode', settings);
  if (!w.ok) throw new Error(`held-out ${name}: ${JSON.stringify(w.errors)}`);
  return { name: w.name, group: 'held-out', file, w: strip(w) };
});
const schedule = { rounds: integer('generations', 2), batches: integer('batches', 2), batchSize: integer('batch', 12),
  evalRounds: integer('eval-rounds', 4), populationSize: integer('population', 16), archiveSize: integer('archive-size', 16) };
const checkRounds = integer('check-rounds', 20), validationSeeds = integer('validation-seeds', 3);
if (validationSeeds < 2) throw new Error('validation-seeds must be at least 2');
const pool = createPool(integer('threads', 4));
const report = { settings, schedule, seeds, validationSeeds, checkRounds,
  comparison: 'Matched offspring schedules; actual compute differs and is reported. Held-out results never select entries.',
  inputs: { sources, opponents, heldOut }, runs: [] };
fs.mkdirSync(out, { recursive: true });
try {
  for (const seed of seeds) for (const variant of names) {
    const started = Date.now(), directory = path.join(out, `${variant}-${seed}`);
    fs.mkdirSync(directory, { recursive: true });
    const r = await evolve({ pool, sources, opponents, settings, ...schedule, ...variants[variant],
      maxLength: 50, objective: 'points', seed,
      onLog: (message) => console.log(`${variant}/${seed}: ${message}`) });
    r.validation = await validateCandidates({ pool, baseline: r.baseline,
      candidates: [...(r.population ?? r.archive), ...r.champions.slice().reverse()],
      field: opponents, settings, objective: 'points', seed, seeds: validationSeeds, rounds: checkRounds, finalists: 3 });
    const best = r.validation.results.find((x) => x.id === r.validation.recommended);
    const baseline = r.validation.results.find((x) => x.id === r.validation.baseline);
    const source = toRedcode(best.g, { dialect: '88', coreSize: settings.coreSize,
      name: `${variant} ${seed}`, strategy: 'Algorithm comparison; see evolve.json for validation and provenance.' });
    const w = compile(source, 'redcode', settings);
    if (!w.ok || !measureSpecies(w, settings).survives) throw new Error('export failed strict compilation or solo survival');
    fs.writeFileSync(path.join(directory, 'best.red'), source);
    const tests = [], baselines = [];
    for (const matchSeed of [900001, 910001, 920001]) {
      tests.push(await evaluate(pool, w, heldOut, { settings, seed: matchSeed, rounds: checkRounds }));
      const base = compile(toRedcode(r.baseline.g, { dialect: '88', coreSize: settings.coreSize }), 'redcode', settings);
      baselines.push(await evaluate(pool, base, heldOut, { settings, seed: matchSeed, rounds: checkRounds }));
    }
    const heldScore = tests.reduce((s, t) => s + t.score, 0) / tests.length;
    const heldBaseline = baselines.reduce((s, t) => s + t.score, 0) / baselines.length;
    r.heldOutCheck = { seeds: [900001, 910001, 920001], score: heldScore, baseline: heldBaseline, results: tests };
    fs.writeFileSync(path.join(directory, 'evolve.json'), JSON.stringify(r, null, 1));
    const record = { variant, seed, improved: r.validation.improved, score: best.score, baseline: baseline.score,
      gain: best.gain, margin: best.margin, heldOut: heldScore, heldBaseline,
      cells: r.archive.length, evaluated: r.stats.evaluated, searchBattleRounds: r.stats.battleRounds,
      localTried: r.stats.localTried, localImproved: r.stats.localImproved,
      milliseconds: Date.now() - started, file: path.join(directory, 'best.red') };
    report.runs.push(record);
    fs.writeFileSync(path.join(out, 'comparison.json'), JSON.stringify(report, null, 1));
    console.log(JSON.stringify(record));
  }
} finally { pool.close(); }
console.log(`Report: ${path.join(out, 'comparison.json')}`);
