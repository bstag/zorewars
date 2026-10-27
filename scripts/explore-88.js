// Mechanism-first experiments: fixed architectures, seeded parameter search.
// Run: node scripts/explore-88.js [--out evolved/novel-88] [--seed 880050]
import fs from 'node:fs';
import path from 'node:path';
import { compile, measureSpecies, mulberry32, RULESETS } from '../src/engine/index.js';
import { createPool, evaluate, libraryOpponents, strip } from '../tools/hill.js';
import { genomeOf } from '../tools/genes.js';
import { validateCandidates } from '../tools/training.js';
import { afterimage, levy, riptide, undercurrent, telltale } from '../tools/experimental-88.js';

const flags = Object.fromEntries(process.argv.slice(2).reduce((xs, x, i, all) => {
  if (x.startsWith('--')) xs.push([x.slice(2), all[i + 1]]);
  return xs;
}, []));
const out = flags.out ?? 'evolved/novel-88';
const seed = Number(flags.seed ?? 880050);
const count = Number(flags.candidates ?? 16);
const rounds = Number(flags.rounds ?? 8);
for (const [key, n] of Object.entries({ seed, candidates: count, rounds, threads: Number(flags.threads ?? 4) })) {
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`--${key} must be a positive integer`);
}
const settings = { ...RULESETS['88'], maxLength: 50 };
const random = mulberry32(seed);
const header = (name, strategy) => `;redcode\n;name ${name}\n;author ZoreWars\n;assert CORESIZE == 8000\n;strategy ${strategy}\n`;

const controls = [{ name: 'Two-pass control', group: 'control', w: strip(compile(header('Two-pass control', 'Diagnostic clear') + `
base DAT #0, #0
go MOV trap, <base
DJN go, #7991
MOV #0, base
clear MOV bomb, <base
DJN clear, #7991
JMP 0
trap SPL 0, 0
bomb DAT #0, #0
END go
`, 'redcode', settings)) }];
const grid = [];
for (const wire of [64, 96, 160, 256]) for (const hop of [384, 768, 1536, 3072]) for (const direction of [-1, 1]) grid.push({ family: 'afterimage', p: { wire, hop, direction }, make: afterimage });
for (const step of [32, 96, 224, 352]) for (const width of [1, 2, 4]) for (const guard of [128, 512, 2048]) grid.push({ family: 'levy', p: { step, width, guard }, make: levy });
for (const offset of [0, 128, 512, 1024]) for (const stun of [false, true]) for (const carpet of [2, 4, 8, 12]) for (const ending of ['idle', 'sweep', 'pulse']) grid.push({ family: 'riptide', p: { offset, stun, carpet, ending }, make: riptide });
for (const offset of [0, 128, 512, 1024]) for (const tag of [97, 881, 3141]) grid.push({ family: 'undercurrent', p: { offset, tag }, make: undercurrent });
for (const offset of [0, 128, 512, 1024]) for (const carpet of [2, 4, 8, 12]) for (const ending of ['idle', 'sweep', 'pulse']) grid.push({ family: 'telltale', p: { offset, carpet, ending }, make: telltale });
const families = flags.families ? flags.families.split(',') : ['afterimage', 'levy', 'riptide', 'undercurrent', 'telltale'];
if (families.some((f) => !grid.some((c) => c.family === f))) throw new Error('unknown family');
const candidates = families.flatMap((family) => {
  const xs = grid.filter((x) => x.family === family);
  for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; }
  return xs.slice(0, count);
});
fs.mkdirSync(out, { recursive: true });
const prior = compile(fs.readFileSync('examples/trained/ga-88-4ab78c7a.red', 'utf8'), 'redcode', settings);
if (!prior.ok) throw new Error(JSON.stringify(prior.errors));
const field = [...libraryOpponents(settings), { name: prior.name, group: 'library', w: strip(prior) }, ...controls];
const pool = createPool(Number(flags.threads ?? 4));
try {
  const results = [];
  for (const [i, c] of candidates.entries()) {
    const source = c.make(c.p);
    const w = compile(source, 'redcode', settings);
    if (!w.ok) throw new Error(`${c.family}: ${JSON.stringify(w.errors)}\n${source}`);
    const species = measureSpecies(w, settings);
    if (!species.survives) { results.push({ family: c.family, p: c.p, rejected: 'solo death' }); continue; }
    const r = await evaluate(pool, w, field, { settings, seed, rounds, diagnose: true });
    results.push({ family: c.family, p: c.p, length: w.instructions.length, source, g: genomeOf(w), species,
      score: r.groups.library.score, control: r.groups.control.score, symptoms: r.symptoms, rows: r.rows });
    console.log(`${i + 1}/${candidates.length} ${c.family} ${JSON.stringify(c.p)}: ${r.groups.library.score.toFixed(3)} (${r.groups.control.score.toFixed(2)} vs clear)`);
  }
  const finalists = families.flatMap((family) => {
    const xs = results.filter((r) => r.family === family && !r.rejected);
    const chosen = [...xs.sort((a, b) => b.score - a.score).slice(0, 2), ...xs.slice().sort((a, b) => b.control - a.control || b.score - a.score).slice(0, 1)];
    return [...new Map(chosen.map((c) => [c.source, c])).values()];
  });
  const validation = await validateCandidates({ pool, baseline: { g: genomeOf(prior) }, candidates: finalists,
    field: field.filter((o) => o.group === 'library'), settings, seed, seeds: 3, rounds: 30, finalists: finalists.length,
    onProgress: (i, n) => console.log(`validation ${i}/${n}`) });
  // Keep all designs, including failures. They are mechanistic experiments;
  // the score is not a claim of beating an external hill.
  const winners = [];
  for (const family of families) {
    const checked = finalists.filter((c) => c.family === family).map((c) => {
      const w = compile(c.source, 'redcode', settings);
      const match = validation.results.find((r) => JSON.stringify(r.g) === JSON.stringify(genomeOf(w)));
      return { ...c, validation: match };
    }).filter((c) => c.validation).sort((a, b) => b.validation.score - a.validation.score);
    const best = checked[0];
    if (!best) continue;
    fs.writeFileSync(path.join(out, `${family}.red`), best.source);
    winners.push(best);
  }
  const report = { settings, seed, rounds, field, results, validation, winners };
  fs.writeFileSync(path.join(out, 'experiments.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(winners.map((w) => ({ family: w.family, p: w.p, length: w.length,
    score: w.validation.score, gain: w.validation.gain, margin: w.validation.margin })), null, 2));
} finally { pool.close(); }
