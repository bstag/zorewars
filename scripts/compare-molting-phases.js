// Matched payload-duration ablation. No tuning or selection on the comparison
// panel: every predeclared variant and matching control is evaluated/exported.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { compile, RULESETS, measureSpecies } from '../src/engine/index.js';
import { createPool, libraryOpponents, evaluate } from '../tools/hill.js';
import { parseTunable } from '../tools/tune.js';
import { genomeId } from '../tools/evolve.js';
import { genomeOf } from '../tools/genes.js';
import { buildMolting, clearControl } from '../tools/molting-generator.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const flags = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i].replace(/^--/, ''), value = process.argv[i + 1];
  if (!process.argv[i].startsWith('--') || !['out', 'threads', 'rounds'].includes(key) || !value || value.startsWith('--')) throw new Error('Expected --out, --threads or --rounds with a value');
  flags[key] = value;
}
function integer(key, fallback) {
  const n = Number(flags[key] ?? fallback);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`Invalid ${key}`);
  return n;
}
const out = path.resolve(flags.out ?? path.join(root, 'evolved', 'molting-phases'));
if (fs.existsSync(path.join(out, 'report.json'))) throw new Error('Choose a fresh output directory to preserve previous results.');
const settings = { ...RULESETS['94x'] }, entrySettings = { ...settings, maxLength: 50 };
const source = fs.readFileSync(path.join(root, 'examples/experimental-94x/molting-phases.js'), 'utf8');
const parents = [4242, 4243].map((seed) => {
  const text = fs.readFileSync(path.join(root, `examples/experimental-94x/molting-${seed}.js`), 'utf8');
  return { seed, source: text, P: parseTunable(text).current };
});
if (parents.some((p) => p.P.BACKWARD !== 0)) throw new Error('This frozen experiment requires both forward-clear parents for shared plain controls.');
const phases = [
  { name: 'full', PHASE: 2, STUN: 512 }, { name: 'short64', PHASE: 1, STUN: 64 },
  { name: 'short512', PHASE: 1, STUN: 512 }, { name: 'short4096', PHASE: 1, STUN: 4096 },
  { name: 'dat', PHASE: 0, STUN: 512 },
];
const library = libraryOpponents(settings);
function panel(files, group) {
  return files.map((file) => {
    const o = library.find((x) => x.file === file);
    if (!o || !measureSpecies(o.w, settings).survives) throw new Error(`Invalid opponent ${file}`);
    return { ...o, group };
  });
}
const development = panel(['dwarf.red', 'scanner.red', 'silk.red', 'vampire.red', 'twopass.red', 'stunner.red', 'quickscan.js', 'fastsilk.js',
  'seeker.red', 'oneshot.red', 'mice.red', 'gatekeeper.js', 'papercut.js', 'hydra.js'], 'development');
const comparison = panel(['imp.red', 'gemini.red', 'sweeper.red', 'stoneimp.red', 'evolvedsilk.red', 'redqueen.red', 'carpet.js', 'blitz.js'], 'previously-used-comparison');
const report = { sourceHash: createHash('sha256').update(source).digest('hex'), settings, entrySettings,
  seeds: [1400001, 1410001, 1420001, 1430001], rounds: integer('rounds', 12), phases,
  inputs: { source, parents, development, comparison }, variants: [], results: [], paired: [],
  limitations: 'Fixed matched ablation, no parameter evolution or promotion. Fresh placements on previously examined local-library opponents; no untouched-opponent or public-hill claim. Multiple exploratory comparisons, not formal significance tests.',
};
fs.mkdirSync(out, { recursive: true });
function save(stage) {
  report.stage = stage;
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(stage);
}
const entries = [];
for (const parent of parents) for (const phase of phases) {
  const P = { ...parent.P, PHASE: phase.PHASE, STUN: phase.STUN };
  const built = buildMolting(source, P, entrySettings);
  if (phase.PHASE === 2) {
    const before = compile(parent.source, 'javascript', entrySettings);
    if (genomeId(genomeOf(before)) !== genomeId(genomeOf(built.w))) throw new Error('full-phase baseline changed');
  }
  const name = `${parent.seed}-${phase.name}`;
  fs.writeFileSync(path.join(out, `${name}.js`), built.source);
  entries.push({ name, parent: parent.seed, phase: phase.name, kind: 'molting', w: built.w });
  entries.push({ name: `${name}-in-place`, parent: parent.seed, phase: phase.name, kind: 'in-place', w: clearControl(built.w, entrySettings, { bare: false }) });
  // Both frozen parents face forward, so their bare payloads are identical.
  if (parent === parents[0]) entries.push({ name: `plain-${phase.name}`, phase: phase.name, kind: 'plain', w: clearControl(built.w, entrySettings) });
  report.variants.push({ name, P, length: built.w.instructions.length, verification: built.verification });
}
save('all ten variants and matching controls verified; protocol frozen');
const rawPool = createPool(integer('threads', 4));
const counts = { matches: 0, battleRounds: 0 };
const pool = { match(task) { counts.matches++; counts.battleRounds += task.settings.rounds; return rawPool.match(task); } };
const cache = new Map(), started = Date.now();
try {
  for (const entry of entries) {
    const id = genomeId(genomeOf(entry.w));
    fs.writeFileSync(path.join(out, `${entry.name}.red`), entry.w.redcode);
    let runs = cache.get(id);
    if (!runs) {
      runs = { development: [], comparison: [] };
      for (const seed of report.seeds) {
        runs.development.push(await evaluate(pool, entry.w, development, { settings, rounds: report.rounds, seed }));
        runs.comparison.push(await evaluate(pool, entry.w, comparison, { settings, rounds: report.rounds, seed }));
      }
      cache.set(id, runs);
    }
    const average = (xs) => xs.reduce((sum, x) => sum + x.score, 0) / xs.length;
    const { w, ...metadata } = entry;
    report.results.push({ ...metadata, id, length: w.instructions.length, ...runs,
      developmentScore: average(runs.development), comparisonScore: average(runs.comparison) });
    save(`${entry.name}: ${average(runs.development).toFixed(3)} development, ${average(runs.comparison).toFixed(3)} comparison`);
  }
  for (const variant of report.variants) {
    const result = report.results.find((x) => x.name === variant.name);
    const references = new Set([`${result.parent}-full`, `plain-${result.phase}`, `${result.name}-in-place`, 'plain-full']);
    for (const reference of references) if (reference !== result.name) {
      const control = report.results.find((x) => x.name === reference);
      for (const panel of ['development', 'comparison']) {
        const differences = result[panel].map((x, i) => x.score - control[panel][i].score);
        const gain = differences.reduce((s, x) => s + x, 0) / differences.length;
        const variance = differences.reduce((s, x) => s + (x - gain) ** 2, 0) / (differences.length - 1);
        const margin = 2.5 * Math.sqrt(variance / differences.length);
        report.paired.push({ name: result.name, reference, panel, gain, margin, clearedMargin: gain > margin });
      }
    }
  }
  report.counts = counts;
  report.milliseconds = Date.now() - started;
  save('complete; no automatic selection or default changes');
} finally { rawPool.close(); }
