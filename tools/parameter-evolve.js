// Optional generator-level GA. Callers supply compilation/behavior gates and
// evaluation; this never edits emitted instructions or changes the CLI evolver.
import { createHash } from 'node:crypto';
import { mulberry32 } from '../src/engine/random.js';
import { lexicase, lexicaseSurvivors } from './selection.js';

export async function evolveParameters({ space, current, initial = [], build, evaluate,
  seed = 4242, populationSize = 12, generations = 3, offspring = 12, onGeneration = () => {} }) {
  for (const [key, value] of Object.entries({ populationSize, generations, offspring })) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${key} must be a positive integer`);
  }
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 2147483646) throw new Error('invalid seed');
  const keys = Object.keys(space);
  if (!keys.length) throw new Error('empty parameter space');
  for (const key of keys) {
    const range = space[key];
    if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isSafeInteger) || range[0] > range[1]) throw new Error(`invalid range: ${key}`);
  }
  function checked(P) {
    if (Object.keys(P).length !== keys.length || keys.some((k) => !Number.isSafeInteger(P[k]) || P[k] < space[k][0] || P[k] > space[k][1])) throw new Error('parameters outside declared space');
    return Object.fromEntries(keys.map((k) => [k, P[k]]));
  }
  checked(current);
  initial.forEach(checked);
  const random = mulberry32(seed), pick = (xs) => xs[Math.floor(random() * xs.length)];
  const sample = () => Object.fromEntries(keys.map((k) => [k, space[k][0] + Math.floor(random() * (space[k][1] - space[k][0] + 1))]));
  const catalog = new Map(), rejected = [], history = [], stats = { proposed: 0, duplicates: 0, rejected: 0, evaluations: 0 };
  async function admit(P, operator, parents, generation) {
    stats.proposed++;
    P = checked(P);
    const id = createHash('sha256').update(JSON.stringify(P)).digest('hex').slice(0, 16);
    if (catalog.has(id)) { stats.duplicates++; return catalog.get(id); }
    try {
      const built = await build(P);
      if (!built?.w?.ok || built.verification?.ok !== true) throw new Error('compilation or behavior gate failed');
      const candidate = { id, P, operator, parents, generation, ...built };
      catalog.set(id, candidate);
      return candidate;
    } catch (error) {
      stats.rejected++;
      rejected.push({ P, operator, parents, generation, reason: error.message });
      return null;
    }
  }
  async function score(candidate, generation) {
    const result = await evaluate(candidate, generation);
    if (!Number.isFinite(result.fit) || !result.cases?.length || result.cases.some((x) => !Number.isFinite(x))) throw new Error('invalid evaluation');
    stats.evaluations++;
    return { ...candidate, ...result };
  }
  function breed(population) {
    if (random() < 0.1) return { P: sample(), operator: 'immigrant', parents: [] };
    const a = lexicase(population, random);
    let P = { ...a.P }, operator = 'mutate', parents = [a.id];
    if (random() < 0.35) {
      const b = lexicase(population, random);
      P = Object.fromEntries(keys.map((k) => [k, random() < 0.5 ? a.P[k] : b.P[k]]));
      operator = 'crossover+mutate'; parents.push(b.id);
    }
    const key = pick(keys), [lo, hi] = space[key];
    if (hi - lo === 1) P[key] = lo + hi - P[key];
    else if (random() < 0.5) P[key] = lo + Math.floor(random() * (hi - lo + 1));
    else {
      const radius = Math.max(1, Math.round((hi - lo) / 16));
      P[key] = Math.max(lo, Math.min(hi, P[key] + (random() < 0.5 ? -1 : 1) * (1 + Math.floor(random() * radius))));
    }
    return { P, operator, parents };
  }
  const baseline = await admit(current, 'original', [], 0);
  if (!baseline) throw new Error('original generator failed the behavior gate');
  let population = [baseline];
  for (const P of initial) {
    const x = await admit(P, 'initial', [], 0);
    if (x && !population.some((v) => v.id === x.id)) population.push(x);
  }
  for (let tries = 0; population.length < populationSize && tries < populationSize * 20; tries++) {
    const x = await admit(sample(), 'initial-random', [], 0);
    if (x && !population.some((v) => v.id === x.id)) population.push(x);
  }
  population = await Promise.all(population.map((x) => score(x, 0)));
  population = lexicaseSurvivors(population, populationSize, random);
  for (let generation = 1; generation <= generations; generation++) {
    // Rotate placements, but rescore ALL parents before comparing new children.
    population = await Promise.all(population.map((x) => score(x, generation)));
    const children = [], seen = new Set(population.map((x) => x.id));
    for (let tries = 0; children.length < offspring && tries < offspring * 20; tries++) {
      const proposal = breed(population);
      const x = await admit(proposal.P, proposal.operator, proposal.parents, generation);
      if (x && !seen.has(x.id)) { seen.add(x.id); children.push(x); }
    }
    const scored = await Promise.all(children.map((x) => score(x, generation)));
    population = lexicaseSurvivors([...population, ...scored], populationSize, random);
    population.sort((a, b) => b.fit - a.fit);
    const record = { generation, children: children.length, champion: population[0].id,
      score: population[0].score, controlGain: population[0].fit, population: population.map((x) => x.id) };
    history.push(record); await onGeneration(record);
  }
  return { seed, config: { populationSize, generations, offspring }, baseline,
    population, candidates: [...catalog.values()], rejected, history, stats };
}
