// Frozen-template experiment: GA over generator choices/numbers, never code.
// node scripts/evolve-molting-parameters.js --out evolved/molting-parameters
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { RULESETS, measureSpecies } from '../src/engine/index.js';
import { createPool, libraryOpponents, evaluate } from '../tools/hill.js';
import { parseTunable } from '../tools/tune.js';
import { genomeId } from '../tools/evolve.js';
import { genomeOf } from '../tools/genes.js';
import { validateCandidates } from '../tools/training.js';
import { evolveParameters } from '../tools/parameter-evolve.js';
import { buildMolting, clearControl } from '../tools/molting-generator.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const options = {};
const allowed = new Set(['out', 'seeds', 'threads', 'population', 'generations', 'offspring', 'screen-rounds', 'check-rounds']);
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i].replace(/^--/, ''), value = process.argv[i + 1];
  if (!process.argv[i].startsWith('--') || !allowed.has(key) || !value || value.startsWith('--')) throw new Error('Expected a known --option value');
  options[key] = value;
}
function integer(key, fallback) {
  const n = Number(options[key] ?? fallback);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`Invalid ${key}`);
  return n;
}
const seeds = (options.seeds ?? '4242,4243').split(',').map(Number);
if (!seeds.length || new Set(seeds).size !== seeds.length || seeds.some((n) => !Number.isSafeInteger(n) || n < 0 || n > 2147480000)) throw new Error('Invalid seeds');
const out = path.resolve(options.out ?? path.join(root, 'evolved', 'molting-parameters'));
if (fs.existsSync(path.join(out, 'report.json'))) throw new Error('Choose a new output directory; existing reports are never overwritten.');
const settings = { ...RULESETS['94x'] }, entrySettings = { ...settings, maxLength: 50 };
const source = fs.readFileSync(path.join(root, 'examples/experimental-94x/molting.js'), 'utf8');
const { space, current } = parseTunable(source);
const schedule = { populationSize: integer('population', 12), generations: integer('generations', 3),
  offspring: integer('offspring', 12), screenRounds: integer('screen-rounds', 4), checkRounds: integer('check-rounds', 12) };
const library = libraryOpponents(settings);
const select = (files, group) => files.map((file) => {
  const o = library.find((x) => x.file === file);
  if (!o || !measureSpecies(o.w, settings).survives) throw new Error(`Invalid opponent ${file}`);
  return { ...o, group };
});
// Prior held-out opponents are now training data. These final eight have not
// supplied battle scores to either previous Molting experiment or this search.
const field = select(['dwarf.red', 'scanner.red', 'silk.red', 'vampire.red', 'twopass.red', 'stunner.red', 'quickscan.js', 'fastsilk.js',
  'seeker.red', 'oneshot.red', 'mice.red', 'gatekeeper.js', 'papercut.js', 'hydra.js'], 'training');
const held = select(['imp.red', 'gemini.red', 'sweeper.red', 'stoneimp.red', 'evolvedsilk.red', 'redqueen.red', 'carpet.js', 'blitz.js'], 'new-held-out');
const original = buildMolting(source, current, entrySettings);
const controls = [0, 1].map((BACKWARD) => ({ name: BACKWARD ? 'plain-backward' : 'plain-forward',
  w: clearControl(buildMolting(source, { ...current, BACKWARD }, entrySettings).w, entrySettings) }));
const report = { sourceHash: createHash('sha256').update(source).digest('hex'), seeds, settings, entrySettings, schedule,
  inputs: { source, field, held }, runs: [], history: [], comparison: [],
  limitations: 'Fixed-template parameter GA, not general structural code synthesis. Small related local-library panels; no public-hill strength claim. Solo transition checks cannot guarantee survival under enemy interference.',
};
fs.mkdirSync(out, { recursive: true });
const save = (stage) => {
  report.stage = stage;
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(stage);
};
save('setup: original and both plain controls verified');
const rawPool = createPool(integer('threads', 4));
const counts = { matches: 0, battleRounds: 0 };
const pool = { match(task) { counts.matches++; counts.battleRounds += task.settings.rounds; return rawPool.match(task); } };
const exports = [{ name: 'original', ...original }, ...controls];
const started = Date.now();
try {
  for (const seed of seeds) {
    const controlScores = [];
    const placements = Array.from({ length: schedule.generations + 1 }, (_, g) => seed + g * 1009);
    for (const matchSeed of placements) {
      const results = await Promise.all(controls.map((c) => evaluate(pool, c.w, field, { settings, rounds: schedule.screenRounds, seed: matchSeed })));
      controlScores.push(results.sort((a, b) => b.score - a.score)[0]);
    }
    const result = await evolveParameters({ space, current, seed, ...schedule,
      initial: Array.from({ length: 8 }, (_, i) => ({ ...current, OPENING: i & 1, TRIGGER: (i >> 1) & 1, BACKWARD: (i >> 2) & 1 })),
      build: (P) => buildMolting(source, P, entrySettings),
      evaluate: async (candidate, generation) => {
        const r = await evaluate(pool, candidate.w, field, { settings, rounds: schedule.screenRounds, seed: placements[generation] });
        return { score: r.score, fit: r.score - controlScores[generation].score,
          cases: r.rows.map((x, i) => x.pts - controlScores[generation].rows[i].pts) };
      },
      onGeneration: (g) => { report.history.push({ seed, ...g }); save(`seed ${seed}, generation ${g.generation}: ${g.score.toFixed(3)} points, ${g.controlGain.toFixed(3)} vs plain clear`); },
    });
    const validation = await validateCandidates({ pool, baseline: { g: genomeOf(original.w) },
      candidates: result.population.map((c) => ({ g: genomeOf(c.w) })), field, settings,
      objective: 'points', seed, seeds: 3, rounds: schedule.checkRounds, finalists: 3,
      onProgress: (i, n) => console.log(`seed ${seed}: validating ${i}/${n}`),
    });
    const recommended = result.candidates.find((c) => genomeId(genomeOf(c.w)) === validation.recommended);
    if (!recommended) throw new Error('recommended code has no parameter provenance');
    // Rebuild and recheck the emitted recommendation, including its marker path.
    const built = buildMolting(source, recommended.P, entrySettings);
    const name = `generator-${seed}`;
    fs.writeFileSync(path.join(out, `${name}.js`), built.source);
    fs.writeFileSync(path.join(out, `${name}.red`), built.w.redcode);
    fs.writeFileSync(path.join(out, `search-${seed}.json`), JSON.stringify({ ...result, validation, placements, controlScores }, null, 2));
    report.runs.push({ seed, stats: result.stats, admitted: result.candidates.length, validation,
      P: recommended.P, parameterId: recommended.id, verification: built.verification, length: built.w.instructions.length });
    exports.push({ name, ...built });
    exports.push({ name: `in-place-${seed}`, w: clearControl(built.w, entrySettings, { bare: false }) });
    save(`seed ${seed}: recommendation frozen`);
  }

  report.comparisonSeeds = [1200001, 1210001, 1220001];
  const cached = new Map();
  for (const x of exports) {
    fs.writeFileSync(path.join(out, `${x.name}.red`), x.w.redcode);
    const id = genomeId(genomeOf(x.w));
    let evaluation = cached.get(id);
    if (!evaluation) {
      const training = [], heldOut = [];
      for (const matchSeed of report.comparisonSeeds) {
        training.push(await evaluate(pool, x.w, field, { settings, rounds: schedule.checkRounds, seed: matchSeed }));
        heldOut.push(await evaluate(pool, x.w, held, { settings, rounds: schedule.checkRounds, seed: matchSeed }));
      }
      evaluation = { training, heldOut };
      cached.set(id, evaluation);
    }
    const mean = (runs) => runs.reduce((sum, r) => sum + r.score, 0) / runs.length;
    report.comparison.push({ name: x.name, length: x.w.instructions.length, ...evaluation,
      trainingScore: mean(evaluation.training), heldOutScore: mean(evaluation.heldOut) });
    save(`compared ${x.name}`);
  }
  // Descriptive paired comparisons, not a second selection stage. Placements
  // (not individual opponents) are the independent samples in this noise guard.
  report.pairedComparisons = [];
  for (const seed of seeds) for (const reference of ['original', 'plain-forward', 'plain-backward', `in-place-${seed}`]) {
    const candidate = report.comparison.find((x) => x.name === `generator-${seed}`);
    const baseline = report.comparison.find((x) => x.name === reference);
    for (const panel of ['training', 'heldOut']) {
      const delta = candidate[panel].map((r, i) => r.score - baseline[panel][i].score);
      const gain = delta.reduce((s, x) => s + x, 0) / delta.length;
      const variance = delta.reduce((s, x) => s + (x - gain) ** 2, 0) / (delta.length - 1);
      const margin = 2.5 * Math.sqrt(variance / delta.length);
      report.pairedComparisons.push({ seed, reference, panel, gain, margin, clearedMargin: gain > margin });
    }
  }
  report.counts = counts; report.milliseconds = Date.now() - started;
  save('complete');
} finally { rawPool.close(); }
