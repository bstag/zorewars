// Ruleset campaigns and a final, placement-held-out comparison. Search scores
// are never used as evidence that an exported version improved its baseline.
import { RULESETS } from '../src/engine/index.js';
import { evaluate } from './hill.js';
import { genomeId } from './evolve.js';
import { toWarrior } from './genes.js';

export const TRAINING_PROFILES = Object.freeze({
  default: {},
  ...Object.fromEntries(Object.keys(RULESETS).map((rules) => [rules, { rules }])),
  plane: { torus: '100x80' },
  volume: { torus: '40x20x10' },
  'volume-wide': { torus: '80x10x10' },
  'volume-coprime': { torus: '41x20x9' },
  'volume-cube': { torus: '20x20x20' },
});

export function trainingProfiles(spec = '94nop,88,lp,94x') {
  const names = spec === 'all' ? Object.keys(TRAINING_PROFILES) : String(spec).split(',');
  if (!names.length || new Set(names).size !== names.length) throw new Error('profiles must be a nonempty list without duplicates');
  return names.map((name) => {
    if (!Object.hasOwn(TRAINING_PROFILES, name)) throw new Error(`unknown training profile '${name}'; choose ${Object.keys(TRAINING_PROFILES).join(', ')} or all`);
    return { name, flags: TRAINING_PROFILES[name] };
  });
}

export async function validateCandidates({ pool, baseline, candidates, field, settings,
  seed = 1, seeds = 3, rounds = 30, finalists = 6, onProgress = () => {},
}) {
  if (!baseline) throw new Error('validation needs a surviving starting warrior');
  if (!field.length) throw new Error('validation needs opponents');
  for (const [key, value] of Object.entries({ seeds, rounds, finalists })) {
    if (!Number.isInteger(value) || value < (key === 'seeds' ? 2 : 1)) throw new Error(`${key} must be an integer >= ${key === 'seeds' ? 2 : 1}`);
  }
  const unique = new Map();
  for (const c of candidates) {
    const id = genomeId(c.g);
    if (id !== genomeId(baseline.g) && !unique.has(id)) unique.set(id, c);
  }
  const checked = [{ ...baseline, baseline: true }, ...[...unique.values()].slice(0, finalists)];
  // Disjoint from the small offsets used for training generations. Every
  // finalist and the baseline receive the same placements and opponent order.
  const seedList = Array.from({ length: seeds }, (_, i) => (seed + 100000000 + i * 10000) % 2147483646 + 1);
  const results = [];
  for (const [i, candidate] of checked.entries()) {
    const runs = [];
    for (const matchSeed of seedList) runs.push(await evaluate(pool, toWarrior(candidate.g, 'Validation', settings.coreSize), field, { rounds, seed: matchSeed, settings }));
    const mean = (key) => runs.reduce((sum, r) => sum + r[key], 0) / runs.length;
    const rows = field.map((opponent, j) => ({
      name: opponent.name, category: opponent.category, group: opponent.group,
      wins: runs.reduce((sum, r) => sum + r.rows[j].w, 0),
      losses: runs.reduce((sum, r) => sum + r.rows[j].l, 0),
      ties: runs.reduce((sum, r) => sum + r.rows[j].t, 0),
      score: runs.reduce((sum, r) => sum + r.rows[j].pts, 0) / seeds,
    }));
    results.push({ id: genomeId(candidate.g), g: candidate.g, baseline: !!candidate.baseline,
      score: mean('score'), smooth: mean('smooth'), rows, samples: runs.map((r) => r.score) });
    onProgress(i + 1, checked.length);
  }
  const base = results[0];
  const baseSamples = [...base.samples];
  for (const result of results) {
    const delta = result.samples.map((x, i) => x - baseSamples[i]);
    result.gain = delta.reduce((sum, x) => sum + x, 0) / seeds;
    // A screening noise guard, not a claim about winning an unseen hill.
    // Placements are the independent samples; opponents are averaged within
    // each seed, so a large field cannot manufacture a small noise margin.
    const variance = delta.reduce((sum, x) => sum + (x - result.gain) ** 2, 0) / (seeds - 1);
    result.margin = 2.5 * Math.sqrt(variance / seeds);
    result.improved = !result.baseline && result.gain > result.margin;
    delete result.samples;
  }
  const better = results.filter((r) => r.improved).sort((a, b) => b.gain - a.gain)[0];
  return { seeds: seedList, rounds, opponents: field.map(({ w, ...o }) => o),
    improved: !!better, recommended: (better ?? base).id, baseline: base.id,
    results: results.sort((a, b) => b.score - a.score) };
}
