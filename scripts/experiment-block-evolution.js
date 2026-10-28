// Reproducible integration experiment: actual CLI Red Queen, legal parameter
// steps, standalone tuner, then fresh common placements and decoy ablations.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RULESETS, measureSpecies, mulberry32 } from '../src/engine/index.js';
import { createPool, libraryOpponents, evaluate } from '../tools/hill.js';
import { buildBlockRecipe, defaultBlockRecipes } from '../tools/blocks/registry.js';
import { recipeDefaults } from '../tools/blocks/recipes.js';
import { compassDefaults } from '../tools/blocks/compass.js';
import { tune } from '../tools/tune.js';
import { hash } from '../tools/blocks/inventory.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.resolve(process.argv[2] ?? path.join(root, 'evolved/block-evolution-20261028'));
if (fs.existsSync(out)) throw new Error('Use a fresh experiment directory');
fs.mkdirSync(path.join(out, 'field'), { recursive: true });
const settings = RULESETS['94x'], seed = 20261028, library = libraryOpponents(settings);
const select = files => files.map(file => {
  const x = library.find(v => v.file === file);
  if (!x || !measureSpecies(x.w, settings).survives) throw new Error(`Missing/unsafe opponent: ${file}`);
  return x;
});
const field = select(['dwarf.red', 'scanner.red', 'silk.red', 'vampire.red', 'mice.red', 'twopass.red']);
const comparison = select(['seeker.red', 'oneshot.red', 'fastsilk.js', 'gatekeeper.js']);
for (const x of field) fs.copyFileSync(path.join(root, 'warriors', x.file), path.join(out, 'field', x.file));
console.log('Running the main CLI: three recipe families, Red Queen and parameter steps');
const args = ['cli/zorewars.js', 'evolve', '--representation', 'blocks', '--rules', '94x', '--length', '50',
  '--hill', path.join(out, 'field'), '--population', '6', '--batch', '6', '--generations', '3', '--local-steps', '3',
  '--eval-rounds', '4', '--seed', String(seed), '--threads', '4', '--validate', '--check-rounds', '8', '--seeds', '3',
  '--finalists', '4', '--out', path.join(out, 'search'), '--json'];
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, { cwd: root }); let stdout = '', stderr = '';
  child.stdout.on('data', x => { stdout += x; }); child.stderr.on('data', x => { stderr += x; });
  child.on('error', reject); child.on('close', code => {
    fs.writeFileSync(path.join(out, 'cli-output.json'), stdout); fs.writeFileSync(path.join(out, 'cli-stderr.txt'), stderr);
    if (code) reject(new Error(`CLI failed (${code}): ${stderr}`)); else resolve();
  });
});
const search = JSON.parse(fs.readFileSync(path.join(out, 'search/evolve.json'), 'utf8'));
const report = { schemaVersion: 1, seed, settings, entryLength: 50, command: [process.execPath, ...args],
  sourceHashes: Object.fromEntries(['tools/block-evolve.js', 'tools/blocks/registry.js', 'tools/blocks/compass.js', 'cli/block-devtools.js'].map(file => [file, hash(fs.readFileSync(path.join(root, file), 'utf8'))])),
  field: field.map(({ w, ...x }) => ({ ...x, codeHash: hash(JSON.stringify(w.instructions)) })),
  comparison: comparison.map(({ w, ...x }) => ({ ...x, codeHash: hash(JSON.stringify(w.instructions)) })),
  search: { config: search.config, stats: search.stats, history: search.history, execution: search.execution, validation: search.validation },
  limitations: 'Small previously examined local panels. Fresh placements, not unseen strategy families. No public hill strength claim or automatic promotion. Standalone tuner candidates are re-gated before use.' };
const entries = defaultBlockRecipes().map(recipe => ({ name: `default-${recipe.family}`, b: buildBlockRecipe(recipe) }));
for (const x of search.population) if (!entries.some(e => e.name === `evolved-${x.recipe.family}`)) entries.push({ name: `evolved-${x.recipe.family}`, b: buildBlockRecipe(x.recipe) });
for (const PHASE of [0, 1, 2]) entries.push({ name: ['plain-DAT', 'plain-short', 'plain-full'][PHASE],
  b: buildBlockRecipe({ family: 'clear', P: { ...recipeDefaults, OPENING: 0, RELOCATE: 0, PHASE } }) });
for (const [name, changes] of [['no-decoys', { DECOYS: 0 }], ['DAT-decoys', { DECOY: 0 }], ['varied-decoys', { DECOY: 2 }], ['in-place', { BOOT: 0 }], ['direct-DAT', { PHASE: 0 }]]) {
  entries.push({ name: `compass-${name}`, b: buildBlockRecipe({ family: 'compass', P: { ...compassDefaults, ...changes } }) });
}
const rawPool = createPool(4); let battleRounds = 0;
const pool = { match(task) { battleRounds += task.settings.rounds; return rawPool.match(task); } };
try {
  const champion = buildBlockRecipe(search.population[0].recipe);
  const source = champion.generator.replace(/^\/\/ SPACE .*$/m, `// SPACE ${JSON.stringify({ STEP: [Math.max(1, champion.recipe.P.STEP - 8), champion.recipe.P.STEP + 8] })}`);
  console.log(`Tuning ${champion.recipe.family} through the existing parameter tuner`);
  const random = Math.random; let pending;
  try { Math.random = mulberry32(seed + 77); pending = tune({ pool, source, field, settings: { ...settings, maxLength: 50 }, candidates: 6, screenRounds: 4, checkRounds: 8, seeds: 3, finalists: 3 }); }
  finally { Math.random = random; }
  report.tuning = await pending;
  for (const x of report.tuning.results) buildBlockRecipe({ family: champion.recipe.family, P: x.P });
  entries.push({ name: 'tuner-choice', b: buildBlockRecipe({ family: champion.recipe.family, P: report.tuning.best.P }) });
  report.validationSeeds = [seed + 2000000, seed + 2100000, seed + 2200000]; report.validationRounds = 8;
  report.validation = [];
  for (const { name, b } of entries) {
    const runs = [];
    for (const matchSeed of report.validationSeeds) runs.push({ seed: matchSeed,
      training: await evaluate(pool, b.w, field, { settings, rounds: 8, seed: matchSeed }),
      comparison: await evaluate(pool, b.w, comparison, { settings, rounds: 8, seed: matchSeed }) });
    report.validation.push({ name, recipe: b.recipe, instructions: b.w.instructions.length, sourceHash: hash(b.source), verification: b.verification, runs });
    fs.writeFileSync(path.join(out, name + '.red'), b.source);
    fs.writeFileSync(path.join(out, name + '.js'), b.generator);
    fs.writeFileSync(path.join(out, name + '.recipe.json'), JSON.stringify({ rules: '94x', length: 50, recipe: b.recipe }, null, 2));
    console.log(`Validated ${name}`);
  }
  const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
  report.summary = report.validation.map(x => ({ name: x.name, instructions: x.instructions,
    training: mean(x.runs.map(r => r.training.score)), comparison: mean(x.runs.map(r => r.comparison.score)) }));
  report.paired = [];
  for (const entry of report.validation) for (const controlName of ['plain-DAT', 'default-compass']) {
    const control = report.validation.find(x => x.name === controlName);
    for (const panel of ['training', 'comparison']) {
      const deltas = entry.runs.map((r, i) => r[panel].score - control.runs[i][panel].score), gain = mean(deltas),
        margin = 2.5 * Math.sqrt(deltas.reduce((s, x) => s + (x - gain) ** 2, 0) / (deltas.length - 1) / deltas.length);
      report.paired.push({ entry: entry.name, control: controlName, panel, gain, margin, exceedsNoiseGuard: gain > margin });
    }
  }
  report.battleRounds = { search: search.stats.battleRounds,
    cliValidation: search.validation.results.length * 3 * 8 * field.length, tuningAndComparisons: battleRounds };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ summary: report.summary, battleRounds: report.battleRounds }));
} finally { await rawPool.close(); }
