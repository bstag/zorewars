// Structural GA: typed recipe crossover, legal parameter moves and a changing
// Red Queen field. Existing instruction evolution is deliberately a separate API.
import { createHash } from 'node:crypto';
import { mulberry32 } from '../src/engine/random.js';
import { lexicase, lexicaseSurvivors } from './selection.js';
import { evaluate } from './hill.js';
import { createObjective } from './objective.js';
import { recipeFamilies, defaultBlockRecipes, buildBlockRecipe } from './blocks/registry.js';
import { RULESETS } from '../src/engine/index.js';

export async function evolveBlocks({ pool, opponents, settings, rules = '94x', length = 50,
  families = Object.keys(recipeFamilies).filter(k => recipeFamilies[k].rules.includes(rules)),
  initial = [], kings = [], populationSize = 12, offspring = 12, generations = 3,
  localSteps = 0, rounds = 6, seed = 1, objective = 'points', tieValue = 0.5,
  partners = [], fieldRounds = 50, onGeneration = () => {} }) {
  for (const [key, value] of Object.entries({ populationSize, offspring, generations, rounds })) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${key} must be a positive integer`);
  }
  if (!Number.isSafeInteger(localSteps) || localSteps < 0 || !Number.isSafeInteger(seed) || seed < 0 || seed > 2147483646) throw new Error('Invalid search limits');
  if (!['points', 'smooth', 'pushoff'].includes(objective) || !Number.isFinite(tieValue) || tieValue < 0 || tieValue > 1) throw new Error('Invalid objective or ties');
  if (partners.length && objective !== 'pushoff') throw new Error('partners need objective pushoff');
  const profile = RULESETS[rules];
  if (!profile || settings.topology === 'torus' || ['coreSize', 'maxProcesses', 'maxCycles', 'minDistance', 'dialect'].some(k => settings[k] !== profile[k])) throw new Error('Battle settings must match the verified rules profile');
  if (!Number.isSafeInteger(length) || length < 1 || length > profile.maxLength || settings.maxLength < length) throw new Error('Invalid block instruction budget');
  if (!opponents.length || !families.length || new Set(families).size !== families.length || populationSize < families.length) throw new Error('Need opponents and population >= distinct family count');
  for (const family of families) if (!Object.hasOwn(recipeFamilies, family) || !recipeFamilies[family].rules.includes(rules)) throw new Error(`Unsupported family ${family} for ${rules}`);
  if (initial.some(x => !families.includes(x.family))) throw new Error('Initial recipe outside selected families');
  const random = mulberry32(seed), pick = xs => xs[Math.floor(random() * xs.length)],
    sample = ([lo, hi]) => lo + Math.floor(random() * (hi - lo + 1));
  const catalog = new Map(), rejected = [], history = [], champions = [],
    ancestors = kings.map((w, i) => ({ name: `King ${i + 1}: ${w.name}`, group: 'champion', w }));
  const stats = { proposed: 0, duplicates: 0, rejected: 0, evaluations: 0, localProposals: 0, matches: 0, battleRounds: 0 };
  const backend = pool;
  pool = { match(task) { stats.matches++; stats.battleRounds += task.settings.rounds; return backend.match(task); } };
  function admit(recipe, operator, parents, generation) {
    stats.proposed++;
    // Stable family/key ordering makes imported JSON key order irrelevant.
    const family = recipeFamilies[recipe.family];
    let P = Object.fromEntries(Object.keys(family.space).map(k => [k, recipe.P[k]]));
    if (Object.keys(recipe.P).length !== Object.keys(P).length) throw new Error('Unexpected initial recipe keys');
    if (family.canonical) P = family.canonical(P, rules);   // one program, one id
    const normalized = { family: recipe.family, P }, id = createHash('sha256').update(JSON.stringify(normalized)).digest('hex').slice(0, 16);
    if (catalog.has(id)) { stats.duplicates++; return catalog.get(id); }
    try {
      const built = buildBlockRecipe(normalized, { rules, length });
      const x = { ...built, id, operator, parents, generation }; catalog.set(id, x); return x;
    } catch (error) { stats.rejected++; rejected.push({ recipe: normalized, operator, parents, generation, reason: error.message }); return null; }
  }
  // Push-off: the field (and our partners) play one round robin up front; each
  // candidate is placed in it. Champions are kept as a record but, as in
  // instruction evolution, do not enter push-off fitness.
  const target = objective === 'pushoff' ? await createObjective({ pool, opponents, partners, settings, objective, rounds, fieldRounds, seed }) : null;
  async function score(x, generation) {
    const matchSeed = (seed + generation * 10000) % 2147483647;
    if (target) {
      const a = await target.assess(x.w, { seed: matchSeed });
      stats.evaluations++;
      const rows = a.rows.slice(0, target.field.length);
      return { ...x, fit: a.fit, places: a.places, score: a.score, smooth: a.smooth, cases: rows.map(r => r.pts),
        rows, vsAncestors: [], evaluatedGeneration: generation, ancestorCount: ancestors.length };
    }
    const base = await evaluate(pool, x.w, opponents, { settings, rounds, seed: matchSeed });
    const prior = ancestors.length ? await evaluate(pool, x.w, ancestors, { settings, rounds, seed: matchSeed + 5000 }) : null;
    const value = row => objective === 'points' ? row.pts : row.smooth;
    const baseCases = base.rows.map(value), priorCases = prior?.rows.map(r => value(r) - (1 - tieValue) * r.t / rounds) ?? [];
    const mean = xs => xs.reduce((s, v) => s + v, 0) / xs.length;
    const fit = priorCases.length ? (mean(baseCases) + mean(priorCases)) / 2 : mean(baseCases);
    stats.evaluations++;
    return { ...x, fit, score: base.score, smooth: base.smooth, cases: [...baseCases, ...priorCases],
      rows: base.rows, vsAncestors: prior?.rows ?? [], evaluatedGeneration: generation, ancestorCount: ancestors.length };
  }
  // Parameters this program actually uses: changing one changes its canonical
  // form. Mutating the others only re-proposes the same program.
  function active(spec, P, keys) {
    if (!spec.canonical) return keys;
    const now = JSON.stringify(spec.canonical(P, rules));
    const used = keys.filter(k => spec.space[k].some(v => v !== P[k] && JSON.stringify(spec.canonical({ ...P, [k]: v }, rules)) !== now));
    return used.length ? used : keys;
  }
  function mutate(parent, local = false) {
    const spec = recipeFamilies[parent.recipe.family], P = { ...parent.recipe.P };
    // Block swap: families made of slots change a whole block half the time,
    // then repair the other slots so the contracts still fit.
    if (!local && spec.slots && random() < 0.5) {
      const slot = pick(active(spec, P, spec.slots)), [lo, hi] = spec.space[slot], options = [];
      for (let v = lo; v <= hi; v++) if (v !== P[slot]) options.push(v);
      P[slot] = slot === 'DECOYS' ? (P.DECOYS ? 0 : sample([1, hi])) : pick(options);
      return { family: parent.recipe.family, P: spec.repair(P, rules, slot) };
    }
    const key = pick(active(spec, P, local ? spec.numeric : Object.keys(spec.space))), [lo, hi] = spec.space[key];
    if (!local && random() < 0.5) P[key] = sample([lo, hi]);
    else P[key] = Math.max(lo, Math.min(hi, P[key] + (random() < 0.5 ? -1 : 1) * (local ? 1 : Math.max(1, Math.floor((hi - lo) / 32)))));
    return { family: parent.recipe.family, P: spec.repair ? spec.repair(P, rules, key) : P };
  }
  function survivors(xs) {
    // Retain the best available member of every family, then outcome specialists.
    const elites = families.map(f => xs.filter(x => x.recipe.family === f).sort((a, b) => b.fit - a.fit)[0]).filter(Boolean);
    const remaining = xs.filter(x => !elites.some(e => e.id === x.id));
    return [...elites, ...(populationSize > elites.length && remaining.length ? lexicaseSurvivors(remaining, populationSize - elites.length, random) : [])].sort((a, b) => b.fit - a.fit);
  }
  let population = [];
  for (const recipe of [...defaultBlockRecipes(families), ...initial]) {
    const x = admit(recipe, 'initial', [], 0); if (x && !population.some(v => v.id === x.id)) population.push(x);
  }
  if (!population.length) throw new Error('No initial recipe passed the gates');
  // Validation keeps the baseline unless a finalist beats it, so it must be the
  // best starting recipe on the base field, not whichever family came first.
  const starting = new Set(population.map(x => x.id));
  const measure = { points: 'score', smooth: 'smooth', pushoff: 'fit' }[objective];
  let baseline = null;
  for (let attempts = 0; population.length < populationSize && attempts < populationSize * 20; attempts++) {
    const x = admit(mutate(pick(population)), 'initial-mutation', [], 0);
    if (x && !population.some(v => v.id === x.id)) population.push(x);
  }
  for (let generation = 1; generation <= generations; generation++) {
    // No stale scores: same placements and identical ancestor list for everyone.
    population = await Promise.all(population.map(x => score(x, generation)));
    if (!baseline) baseline = population.filter(x => starting.has(x.id)).reduce((a, b) => (b[measure] > a[measure] ? b : a));
    const children = [], seen = new Set(population.map(x => x.id));
    for (let attempts = 0; children.length < offspring && attempts < offspring * 20; attempts++) {
      const a = lexicase(population, random), parents = [a.id];
      let recipe, operator;
      if (random() < 0.15) {
        parents.length = 0;
        const family = pick(families); recipe = { family, P: { ...recipeFamilies[family].defaults } };
        recipe = mutate({ recipe }); operator = 'family-immigrant';
      } else {
        let parent = a; operator = 'mutate';
        if (random() < 0.4) {
          const b = lexicase(population.filter(x => x.recipe.family === a.recipe.family), random);
          parent = { recipe: { family: a.recipe.family, P: Object.fromEntries(Object.keys(a.recipe.P).map(k => [k, random() < 0.5 ? a.recipe.P[k] : b.recipe.P[k]])) } };
          parents.push(b.id); operator = 'crossover+mutate';
        }
        recipe = mutate(parent);
      }
      const x = admit(recipe, operator, parents, generation);
      if (x && !seen.has(x.id)) { seen.add(x.id); children.push(x); }
    }
    population = survivors([...population, ...await Promise.all(children.map(x => score(x, generation)))]);
    for (let i = 0; i < localSteps; i++) {
      const parent = population[i % population.length]; stats.localProposals++;
      const x = admit(mutate(parent, true), 'parameter-step', [parent.id], generation);
      if (x && !population.some(p => p.id === x.id)) population = survivors([...population, await score(x, generation)]);
    }
    const champion = population[0]; champions.push(champion);
    const record = { generation, champion: champion.id, family: champion.recipe.family, fit: champion.fit, score: champion.score,
      ...(champion.places ? { places: champion.places } : {}),
      ancestorCount: ancestors.length, population: population.map(x => ({ id: x.id, family: x.recipe.family, fit: x.fit, evaluatedGeneration: x.evaluatedGeneration, ancestorCount: x.ancestorCount })) };
    history.push(record);
    await onGeneration(record, champion);
    ancestors.push({ name: `Generation ${generation}: ${champion.id}`, group: 'champion', w: champion.w });
  }
  return { config: { representation: 'blocks', algorithm: 'ga', selection: 'lexicase', rules, length, families, seed, populationSize, offspring, generations, localSteps, rounds, objective, tieValue,
    partners: partners.map(w => w.name), fieldRounds },
    baseline, population, champions, candidates: [...catalog.values()], rejected, history, stats };
}
