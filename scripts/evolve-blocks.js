// Reproducible recipe GA -> guarded parameter steps -> fresh-seed comparisons.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { measureSpecies, mulberry32 } from '../src/engine/index.js';
import { buildRecipe, recipeDefaults, recipeSpace, recipeSettings, recipeGenerator } from '../tools/blocks/recipes.js';
import { hash } from '../tools/blocks/inventory.js';
import { evolveParameters } from '../tools/parameter-evolve.js';
import { createPool, libraryOpponents, evaluate } from '../tools/hill.js';
import { tune } from '../tools/tune.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const options = {}, allowed = ['rules', 'out', 'seed', 'population', 'generations', 'offspring', 'rounds', 'check-rounds', 'threads', 'tune-candidates'];
for (let i=2; i<process.argv.length; i+=2) {
  const key = process.argv[i].replace(/^--/, ''), value = process.argv[i+1];
  if (!process.argv[i].startsWith('--') || !allowed.includes(key) || !value || value.startsWith('--')) throw new Error('Expected known --option value');
  options[key] = value;
}
function integer(key, fallback) {
  const n = Number(options[key] ?? fallback);
  if (!Number.isSafeInteger(n) || n < 1 || n > 1000000) throw new Error(`Invalid ${key}`);
  return n;
}
const rules = options.rules ?? '94x', settings = recipeSettings(rules), seed = integer('seed', 4244);
const schedule = { populationSize: integer('population', 6), generations: integer('generations', 2), offspring: integer('offspring', 6), rounds: integer('rounds', 4), checkRounds: integer('check-rounds', 8), tuneCandidates: integer('tune-candidates', 4) };
const out = path.resolve(options.out ?? path.join(root, 'evolved/block-search'));
if (fs.existsSync(out)) throw new Error('Choose a new output directory; runs are never overwritten.');
const library = libraryOpponents(settings);
const index = JSON.parse(fs.readFileSync(path.join(root, 'warriors/index.json'), 'utf8'));
const excluded = [];
function select(files) {
  return files.flatMap(file => {
    const adaptation = rules === '88' ? index.find(x => x.dialect === '88' && (x.adaptedFrom === file || x.convertedFrom === file))?.file : file;
    const entry = library.find(x => x.file === adaptation);
    if (!entry || !measureSpecies(entry.w, settings).survives) {
      excluded.push({ file, reason: entry ? 'fails full solo survival on this profile' : 'not available for this profile' });
      return [];
    }
    return [entry];
  });
}
const field = select(rules === '88' ? ['dwarf.red', 'scanner.red', 'vampire.red', 'mice.red', 'stunner.red'] : ['dwarf.red', 'scanner.red', 'silk.red', 'vampire.red', 'twopass.red', 'mice.red']);
const comparison = select(rules === '88' ? ['gemini.red', 'impring.red'] : ['seeker.red', 'oneshot.red']);
if (field.length < 2 || !comparison.length) throw new Error('Too few surviving opponents for this profile');
const report = { schemaVersion: 1, rules, settings, seed, schedule, backend: 'CPU', excluded,
  implementation: { recipes: hash(fs.readFileSync(path.join(root, 'tools/blocks/recipes.js'), 'utf8')), evolution: hash(fs.readFileSync(path.join(root, 'tools/parameter-evolve.js'), 'utf8')) },
  field: field.map(({w, ...x}) => ({ ...x, codeHash: hash(JSON.stringify(w.instructions)) })), comparison: comparison.map(({w, ...x}) => ({ ...x, codeHash: hash(JSON.stringify(w.instructions)) })),
  limitations: 'Small local panels and exploratory noise guards; comparison opponents are reused from earlier research. No claim of public hill strength. Ordinary tuner candidates are compilation-screened; finalists are behavior-checked again here.',
};
fs.mkdirSync(out, { recursive: true });
const save = stage => { report.stage = stage; fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.log(stage); };
const rawPool = createPool(integer('threads', 4));
let battleRounds = 0;
const pool = { match(task) { battleRounds += task.settings.rounds; return rawPool.match(task); } };
const build = P => buildRecipe(P, { rules });
const score = async (candidate, matchSeed, rounds = schedule.rounds, opponents = field) => {
  const r = await evaluate(pool, candidate.w, opponents, { settings, rounds, seed: matchSeed });
  return { ...r, fit: r.score, cases: r.rows.map(x => x.pts) };
};
const summarize = c => ({ P: c.P, sourceHash: hash(c.source), instructions: c.w.instructions.length, sections: c.sections, verification: c.verification });
try {
  save('Starting block evolution');
  const evolution = await evolveParameters({ space: recipeSpace, current: recipeDefaults, seed,
    initial: [0, 1, 2].map(PHASE => ({ ...recipeDefaults, OPENING: 0, RELOCATE: 0, PHASE })),
    populationSize: schedule.populationSize, generations: schedule.generations, offspring: schedule.offspring,
    build, evaluate: (candidate, generation) => score(candidate, seed + generation * 10000),
    onGeneration: record => console.log(`Generation ${record.generation}: ${record.score.toFixed(3)} points/round`) });
  report.evolution = { stats: evolution.stats, history: evolution.history, rejected: evolution.rejected,
    candidates: evolution.candidates.map(c => ({ id: c.id, parents: c.parents, operator: c.operator, generation: c.generation, ...summarize(c) })) };
  const champion = evolution.population[0];
  // Coordinate steps keep the selected grammar fixed. Use common placements for
  // every neighbor and the champion; future work can add a wider local search.
  let refined = { ...champion, ...await score(champion, seed + 500000) };
  report.refinement = [];
  for (const key of ['WAIT', 'STEP', 'HOP', 'STUN']) {
    const [lo, hi] = recipeSpace[key], radius = Math.max(1, Math.round((hi-lo)/32));
    const origin = refined;
    for (const sign of [-1, 1]) {
      const P = { ...origin.P, [key]: Math.max(lo, Math.min(hi, origin.P[key] + sign*radius)) };
      const b = build(P), r = await score(b, seed + 500000);
      report.refinement.push({ key, ...summarize(b), score: r.score });
      if (r.score > refined.score) refined = { ...b, ...r };
    }
  }
  save('Evolution and guarded parameter steps complete; checking existing tuner');
  // Existing tuner samples synchronously before its first await. Restore the
  // global RNG immediately; record all proposed vectors for reproducibility.
  const generator = recipeGenerator(refined.P, { rules, length: 50 });
  const numericSpace = Object.fromEntries(['WAIT', 'STEP', 'HOP', 'STUN'].map(k => [k, recipeSpace[k]]));
  const tunerSource = generator.replace(/^\/\/ SPACE .*$/m, `// SPACE ${JSON.stringify(numericSpace)}`);
  const priorRandom = Math.random; let tuning;
  try { Math.random = mulberry32(seed + 17); tuning = tune({ pool, source: tunerSource, field, settings, candidates: schedule.tuneCandidates, screenRounds: schedule.rounds, checkRounds: schedule.checkRounds, seeds: 3, finalists: 2 }); }
  finally { Math.random = priorRandom; }
  report.tuning = await tuning;
  for (const finalist of report.tuning.results) build(finalist.P);
  const tuned = build(report.tuning.best.P);
  const controls = ['plain-DAT', 'plain-short', 'plain-full'].map((name, PHASE) => ({ name, built: build({ ...recipeDefaults, OPENING: 0, RELOCATE: 0, PHASE }) }));
  const entries = [{ name: 'starting-recipe', built: build(recipeDefaults) }, { name: 'GA-champion', built: champion }, { name: 'parameter-steps', built: refined }, { name: 'existing-tuner', built: tuned }, ...controls];
  report.validationSeeds = [seed + 1000000, seed + 1100000, seed + 1200000];
  report.validation = [];
  for (const {name, built} of entries) {
    const runs = [];
    for (const freshSeed of report.validationSeeds) runs.push({ seed: freshSeed, training: await score(built, freshSeed, schedule.checkRounds), comparison: await score(built, freshSeed, schedule.checkRounds, comparison) });
    report.validation.push({ name, ...summarize(built), runs });
    fs.writeFileSync(path.join(out, `${name}.red`), built.source);
    fs.writeFileSync(path.join(out, `${name}.js`), recipeGenerator(built.P, { rules, length: 50 }));
    fs.writeFileSync(path.join(out, `${name}.recipe.json`), JSON.stringify({ schemaVersion: 1, rules, length: 50, ...summarize(built) }, null, 2));
    console.log(`Validated ${name}`);
  }
  const mean = xs => xs.reduce((a,b) => a+b, 0)/xs.length;
  report.summary = report.validation.map(entry => ({ name: entry.name, instructions: entry.instructions, training: mean(entry.runs.map(r => r.training.score)), comparison: mean(entry.runs.map(r => r.comparison.score)) }));
  report.paired = [];
  for (const entry of report.validation.slice(1,4)) for (const control of [report.validation[0], ...report.validation.slice(4)]) for (const panel of ['training','comparison']) {
    const differences = entry.runs.map((r,i) => r[panel].score - control.runs[i][panel].score);
    const gain = mean(differences), margin = 2.5*Math.sqrt(differences.reduce((s,x) => s+(x-gain)**2,0)/(differences.length-1)/differences.length);
    report.paired.push({ entry: entry.name, control: control.name, panel, gain, margin, exceedsNoiseGuard: gain > margin });
  }
  report.battleRounds = battleRounds;
  save('Complete; exploratory results only, no automatic promotion');
  console.log(JSON.stringify(report.summary));
} finally { await rawPool.close(); }
