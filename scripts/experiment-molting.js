// Full-cycle, offline 94x experiment. Does not change generator defaults.
// node scripts/experiment-molting.js --out evolved/molting-94x --backend cpu
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compile, measureSpecies, mulberry32, RULESETS } from '../src/engine/index.js';
import { createMatchBackend } from '../src/engine/match-backend.js';
import { createPool, evaluate, libraryOpponents, strip } from '../tools/hill.js';
import { tune, parseTunable, withConstants } from '../tools/tune.js';
import { evolve } from '../tools/evolve.js';
import { genomeOf, toRedcode } from '../tools/genes.js';
import { validateCandidates } from '../tools/training.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const flags = {};
const allowed = new Set(['out', 'backend', 'threads', 'seed', 'candidates', 'screen-rounds', 'check-rounds', 'seeds', 'generations', 'batches', 'batch']);
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i].replace(/^--/, ''), value = process.argv[i + 1];
  if (!process.argv[i].startsWith('--') || !allowed.has(key) || !value || value.startsWith('--')) throw new Error(`Expected --option value, got ${process.argv[i]}`);
  flags[key] = value;
}
function integer(key, fallback, min = 1) {
  const n = Number(flags[key] ?? fallback);
  if (!Number.isSafeInteger(n) || n < min) throw new Error(`Invalid --${key}`);
  return n;
}
const seed = integer('seed', 4242, 0);
if (seed > 2147483646) throw new Error('seed must be <= 2147483646');
const out = path.resolve(flags.out ?? path.join(root, 'evolved', `molting-94x-${seed}`));
if (fs.existsSync(path.join(out, 'report.json'))) throw new Error('Output contains a previous report; choose a new --out directory.');
const settings = { ...RULESETS['94x'] }, entrySettings = { ...settings, maxLength: 50 };
const schedule = { candidates: integer('candidates', 12), screenRounds: integer('screen-rounds', 4),
  checkRounds: integer('check-rounds', 12), seeds: integer('seeds', 3, 2),
  generations: integer('generations', 2), batches: integer('batches', 2), batchSize: integer('batch', 12) };
const source = fs.readFileSync(path.join(root, 'examples/experimental-94x/molting.js'), 'utf8');
const { current, space } = parseTunable(source);
function build(text, language = 'javascript') {
  const w = compile(text, language, entrySettings);
  if (!w.ok) throw new Error(JSON.stringify(w.errors));
  if (!measureSpecies(w, entrySettings).survives) throw new Error('Candidate fails full-cycle solo survival');
  return w;
}
const original = build(source);
const library = libraryOpponents(settings);
const solo = library.map((o) => ({ file: o.file, name: o.name, ...measureSpecies(o.w, settings) }));
const select = (files, group) => files.map((file) => {
  const opponent = library.find((o) => o.file === file);
  if (!opponent || !solo.find((x) => x.file === file)?.survives) throw new Error(`Unusable opponent: ${file}`);
  return { ...opponent, group };
});
const field = select(['dwarf.red', 'scanner.red', 'silk.red', 'vampire.red', 'twopass.red', 'stunner.red', 'quickscan.js', 'fastsilk.js'], 'training');
const heldOut = select(['seeker.red', 'oneshot.red', 'mice.red', 'gatekeeper.js', 'papercut.js', 'hydra.js'], 'held-out');
const report = {
  sourceHash: createHash('sha256').update(source).digest('hex'), seed, settings, entrySettings, schedule,
  limitations: 'Small local-library experiment, not a public-hill benchmark or equal-compute algorithm comparison. Held-out opponents never select finalists. Standard compiled evolution need not preserve Molting behavior.',
  inputs: { source, field, heldOut, librarySoloAudit: solo }, structures: [], evolution: [], comparison: [], stage: 'setup',
};
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'original.js'), source);
for (const [group, entries] of Object.entries({ training: field, heldout: heldOut })) {
  fs.mkdirSync(path.join(out, group), { recursive: true });
  for (const opponent of entries) fs.writeFileSync(path.join(out, group, `${path.parse(opponent.file).name}.red`),
    toRedcode(genomeOf(opponent.w), { coreSize: settings.coreSize, name: opponent.name }));
}
const save = (stage) => {
  report.stage = stage;
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(stage);
};
save('setup');
const runner = await createMatchBackend({ backend: flags.backend ?? 'cpu',
  createCpu: () => createPool(integer('threads', 4)),
  createGpu: async () => (await import('../tools/gpu.js')).createGpuPool(),
  onFallback: (reason) => console.log(`CPU fallback: ${reason}`),
});
const counts = { matches: 0, battleRounds: 0 };
const pool = {
  get backend() { return runner.backend; }, get size() { return runner.size; }, get stats() { return runner.stats; },
  measureSpecies: (w, cfg) => runner.measureSpecies(w, cfg),
  match(task) { counts.matches++; counts.battleRounds += task.settings.rounds; return runner.match(task); },
  close() { runner.close(); },
};
const started = Date.now();
try {
  const sources = [];
  for (let i = 0; i < 8; i++) {
    const P = { ...current, OPENING: i & 1, TRIGGER: (i >> 1) & 1, BACKWARD: (i >> 2) & 1 };
    const text = withConstants(source, P), w = build(text), name = `structure-${i}`;
    fs.writeFileSync(path.join(out, `${name}.js`), text);
    fs.writeFileSync(path.join(out, `${name}.red`), w.redcode);
    const result = await evaluate(pool, w, field, { settings, seed, rounds: schedule.screenRounds });
    report.structures.push({ name, P, length: w.instructions.length, ...result });
    sources.push({ w: strip(w), role: P.OPENING ? 'scan' : 'stone' });
  }
  save('eight structures screened');

  // tune() samples Math.random; seed it only in this standalone experiment,
  // restoring it immediately after tune constructs its synchronous sample list.
  // Replay that draw separately to preserve ALL sampled constants in the report.
  const random = mulberry32(seed);
  report.tuningSamples = [current, ...Array.from({ length: schedule.candidates }, () =>
    Object.fromEntries(Object.entries(space).map(([k, [lo, hi]]) => [k, lo + Math.floor(random() * (hi - lo + 1))])))];
  for (const P of report.tuningSamples) build(withConstants(source, P));
  const originalRandom = Math.random;
  let pending;
  try {
    Math.random = mulberry32(seed);
    pending = tune({ pool, source, field, settings, candidates: schedule.candidates, screenRounds: schedule.screenRounds,
      checkRounds: schedule.checkRounds, seeds: schedule.seeds, finalists: 3,
      onProgress: (i, n) => console.log(`Tuning ${i}/${n}`) });
  } finally { Math.random = originalRandom; }
  report.tuning = await pending;
  const tunedSource = withConstants(source, report.tuning.best.P), tuned = build(tunedSource);
  fs.writeFileSync(path.join(out, 'tuned.js'), tunedSource);
  fs.writeFileSync(path.join(out, 'tuned.red'), tuned.redcode);
  save(`tuning complete: ${report.tuning.improved ? 'validated improvement' : 'original retained'}`);

  const exports = [{ name: 'original', w: original }, { name: 'tuned', w: tuned }];
  for (const [name, options] of Object.entries({
    standard: {},
    specialist: { selection: 'lexicase', descriptor: 'outcomes', archiveSize: 16, localSteps: 1 },
  })) {
    const directory = path.join(out, name);
    fs.mkdirSync(directory, { recursive: true });
    // Both searches receive the same eight structures and tuned recommendation.
    const result = await evolve({ pool, sources: [...sources, { w: strip(tuned), role: 'stone' }], opponents: field,
      settings, entrySettings, maxLength: 50, seed, objective: 'points', rounds: schedule.generations,
      batches: schedule.batches, batchSize: schedule.batchSize, evalRounds: schedule.screenRounds, ...options,
      onLog: (message) => console.log(`${name}: ${message}`),
    });
    result.validation = await validateCandidates({ pool, baseline: result.baseline,
      candidates: [...result.archive, ...result.champions.slice().reverse()], field, settings, objective: 'points',
      seed, seeds: schedule.seeds, rounds: schedule.checkRounds, finalists: 3,
      onProgress: (i, n) => console.log(`${name} validation ${i}/${n}`),
    });
    const best = result.validation.results.find((x) => x.id === result.validation.recommended);
    const text = toRedcode(best.g, { coreSize: settings.coreSize, name: `Molting experiment ${name}`,
      strategy: 'Compiled evolution descendant or retained seed; see experiment report for provenance.' });
    const w = build(text, 'redcode');
    fs.writeFileSync(path.join(directory, 'best.red'), text);
    for (const champion of result.champions) fs.writeFileSync(path.join(directory, `generation-${champion.round}.red`),
      toRedcode(champion.g, { coreSize: settings.coreSize, name: `${name} generation ${champion.round}` }));
    fs.writeFileSync(path.join(directory, 'evolve.json'), JSON.stringify(result, null, 2));
    exports.push({ name, w });
    report.evolution.push({ name, config: result.config, stats: result.stats, validation: result.validation,
      length: w.instructions.length, lineage: result.lineage.find((x) => x.id === best.id) });
    save(`${name} evolution complete`);
  }

  // Same original body, different entry point: isolate the opening and move.
  const noOpening = build(original.redcode.replace(/ORG\s+opening/, 'ORG molt'), 'redcode');
  const inPlace = build(original.redcode.replace(/ORG\s+opening/, 'ORG payload'), 'redcode');
  exports.push({ name: 'skip-opening', w: noOpening }, { name: 'clear-in-place', w: inPlace });
  report.comparisonSeeds = [900001, 910001, 920001];
  // No selection or edits after these held-out results are observed.
  for (const { name, w } of exports) {
    fs.writeFileSync(path.join(out, `${name}.red`), w.redcode);
    const training = [], held = [];
    for (const matchSeed of report.comparisonSeeds) {
      training.push(await evaluate(pool, w, field, { settings, seed: matchSeed, rounds: schedule.checkRounds }));
      held.push(await evaluate(pool, w, heldOut, { settings, seed: matchSeed, rounds: schedule.checkRounds }));
    }
    const average = (runs, key) => runs.reduce((s, r) => s + r[key], 0) / runs.length;
    const row = { name, length: w.instructions.length, trainingScore: average(training, 'score'),
      heldOutScore: average(held, 'score'), trainingSmooth: average(training, 'smooth'), heldOutSmooth: average(held, 'smooth'), training, held };
    report.comparison.push(row);
    console.log(JSON.stringify({ name, length: row.length, training: row.trainingScore, heldOut: row.heldOutScore }));
    save(`compared ${name}`);
  }
  report.execution = pool.stats;
  report.counts = counts;
  report.milliseconds = Date.now() - started;
  save('complete');
} finally { pool.close(); }
