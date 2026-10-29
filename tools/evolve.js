// The evolver: Red Queen rounds of MAP-Elites, after Digital Red Queen
// (Sakana AI and MIT, https://github.com/SakanaAI/drq). In this version,
// children are made by repairs chosen from how their parent loses (genes.js),
// and fitness can use tournament points or the smooth score. The alternative
// GA keeps an elitist population with tournament or epsilon-lexicase
// selection. MAP-Elites can use outcome niches; either can refine numbers.
//
// - Archive (MAP-Elites): one elite per solo species or outcome CVT cell.
//   A child only has to beat the elite of its own kind to be kept, so papers,
//   stones and scanners all keep improving instead of one family taking over.
// - Red Queen: each round's champion joins the opponents. Fitness is half
//   "beat the starting opponents", half "beat every earlier champion", so a
//   new champion can't forget how to beat its ancestors. Ties against
//   champions count half (tieValue), so tie-farming imps can't win a round
//   that way; lower it to make champions kill.
// - Held out (optional): opponents never trained on, e.g. the Hall of Fame
//   classics, to see whether champions get more general or only better at
//   beating each other.
// - objective 'pushoff': fitness is the candidate's place in a Core War
//   Tournament Weekend push-off (average x SD-score diversity, median of the
//   8 points readings) against the opponents, entered beside `partners` (our
//   other entries), whose places count half against it. A warrior that wins
//   in its own way beats a stronger clone, as in the tournament. Champions
//   are kept as a record but don't enter this fitness.
// - League (optional), after AlphaStar's league: two more populations breed
//   beside the main one each generation. Exploiters are scored only on
//   beating the latest main champion, and start over from the gene pool once
//   they beat it clearly (or grow old); league exploiters are scored on
//   beating every champion the league has made. Their champions join the
//   main warriors' rivals, so weaknesses are found and patched in-house
//   instead of by overfitting a fixed set of kings. With objective pushoff
//   the main fitness is the push-off value plus points against the rivals.

import { createHash } from 'node:crypto';
import { compile, DEFAULT_SETTINGS, measureSpecies, mulberry32 } from '../src/engine/index.js';
import { makeGeometry } from '../src/engine/geometry.js';
import { evaluate, strip } from './hill.js';
import { createObjective } from './objective.js';
import { lexicase, lexicaseSurvivors, outcomeNiches } from './selection.js';
import { makeGenePool, makeOperators, makeChooser, crossover, fits, clone, graft, genomeOf, pick as choose, toWarrior, toRedcode, randomGenome, legal88, MAXLEN } from './genes.js';

export const genomeId = (g) => createHash('sha256').update(JSON.stringify(g)).digest('hex').slice(0, 16);

export async function evolve({
  pool, sources, opponents, heldOut = [], settings, entrySettings = settings,
  rounds = 8, batches = 4, batchSize = 40, evalRounds = 6, maxLength = MAXLEN,
  kings = [],          // warriors that start as champions: generation 1 must already beat them
  scratch = false,     // from scratch: random programs, no gene pool, fitness only against champions
  tieValue = 0.5,      // what a tie with a champion is worth, as a share of a tie's points (0..1)
  seed = 1, algorithm = 'map-elites', objective = 'smooth', populationSize = batchSize,
  selection = 'default', epsilon = 'auto', descriptor = 'species', archiveSize = 64, localSteps = 0,
  partners = [],       // objective 'pushoff': our other entries, ranked beside each candidate
  fieldRounds = 50,    // objective 'pushoff': rounds a pair for the field's own round robin
  league = false,      // also breed exploiters and league exploiters (see above)
  exploitWin = 2,      // an exploiter champion this fit (points per round vs the main champion) has done its job: restart
  exploitAge: exploitAge_ = 6,      // ...and so has one that has bred this many generations without it
  onLog = () => {}, onRound = () => {},
}) {
  settings = { ...DEFAULT_SETTINGS, ...settings };
  entrySettings = { ...DEFAULT_SETTINGS, ...entrySettings };
  for (const [key, n] of Object.entries({ rounds, batches, batchSize, evalRounds, maxLength, populationSize, fieldRounds, archiveSize })) {
    if (!Number.isInteger(n) || n < 1) throw new Error(`${key} must be a positive integer`);
  }
  if (!Number.isInteger(seed) || seed < 0 || seed > 2147483646) throw new Error('seed must be an integer from 0 to 2147483646');
  if (!['map-elites', 'ga'].includes(algorithm)) throw new Error('algorithm must be map-elites or ga');
  if (!['default', 'lexicase'].includes(selection)) throw new Error('selection must be default or lexicase');
  if (epsilon !== 'auto' && (!Number.isFinite(epsilon) || epsilon < 0)) throw new Error('epsilon must be auto or a nonnegative number');
  if (!['species', 'outcomes'].includes(descriptor)) throw new Error('descriptor must be species or outcomes');
  if (descriptor === 'outcomes' && (algorithm !== 'map-elites' || !opponents.length || scratch)) throw new Error('outcome niches need map-elites with a fixed opponent field, not scratch');
  if (!Number.isInteger(localSteps) || localSteps < 0) throw new Error('localSteps must be a nonnegative integer');
  if (!['smooth', 'points', 'pushoff'].includes(objective)) throw new Error('objective must be smooth, points or pushoff');
  if (objective === 'pushoff' && !opponents.length) throw new Error('objective pushoff needs opponents (a field to rank in)');
  if (!Number.isFinite(tieValue) || tieValue < 0 || tieValue > 1) throw new Error('tieValue must be from 0 to 1');
  if (league && (scratch || descriptor !== 'species')) throw new Error('league needs species niches and a gene pool: not with scratch or outcome niches');
  if (league && (typeof exploitWin !== 'number' || Number.isNaN(exploitWin) || !Number.isInteger(exploitAge_) || exploitAge_ < 1)) throw new Error('exploitWin must be a number and exploitAge a positive integer');
  const random = mulberry32(seed);
  const pick = (xs) => choose(xs, random);
  const units = makeGenePool(sources, { random });
  const geo = settings.topology === 'torus' ? makeGeometry(settings) : null;
  maxLength = Math.min(maxLength, settings.maxLength, entrySettings.maxLength, geo?.maxCodeLength ?? Infinity);
  const ops = makeOperators(units, geo, { scratch, coreSize: settings.coreSize, random, pSpace: entrySettings.pSpace !== false && entrySettings.dialect !== '88' });
  // On a plane or volume the archive gets a third dimension, the warrior's
  // shape (how many axes its writes spread over), so row-bound, flat and
  // volumetric species each keep their own elites.
  const niche = (sp) => (geo ? `${sp.key},${sp.shape}` : sp.key);
  const opNames = Object.keys(ops);
  const chooser = makeChooser(opNames, random);
  const champions = kings.map((w) => ({ round: 0, name: w.name, g: genomeOf(w), w: strip(w) }));
  const coreSize = settings.coreSize;
  const measured = new Map(), assessed = new Map(), lineage = new Map();
  const stats = { evaluated: 0, cacheHits: 0, rejected: 0, matches: 0, battleRounds: 0, localTried: 0, localImproved: 0 };
  const runner = pool;
  // Retain live backend getters (auto can fall back mid-run) and accelerated
  // solo checks while counting battle work through the same execution pool.
  pool = {
    get backend() { return runner.backend; },
    get size() { return runner.size; },
    get stats() { return runner.stats; },
    measureSpecies: runner.measureSpecies ? (w, cfg) => runner.measureSpecies(w, cfg) : undefined,
    match(task) { stats.matches++; stats.battleRounds += task.settings.rounds; return runner.match(task); },
  };
  const metric = objective === 'smooth' ? 'smooth' : 'score';
  const rowMetric = objective === 'smooth' ? 'smooth' : 'pts';
  const target = await createObjective({ pool, opponents, partners, settings, objective, rounds: evalRounds, fieldRounds, seed });
  const outcomes = descriptor === 'outcomes'
    ? outcomeNiches(target.field.length, archiveSize, mulberry32(seed ^ 0x6a09e667)) : null;
  const cellOf = (x) => outcomes ? outcomes.cell(x.descriptor) : niche(x.species);

  const solo = async (w) => pool.measureSpecies ? pool.measureSpecies(strip(w), settings) : measureSpecies(w, settings);

  // Populations: who each one is scored against. Without a league there is
  // only the main one, whose rivals are the champions (the Red Queen).
  const exploiters = [], leagueExploiters = [];
  const RECENT = 10;   // the main warriors face this many of the latest exploiters of each kind
  const MAIN = { key: 'main', field: true, rivals: () => league
    ? [...champions, ...exploiters.slice(-RECENT), ...leagueExploiters.slice(-RECENT)] : champions };
  const EXPLOIT = { key: 'exploit', field: false, rivals: () => champions.slice(-1) };
  const LEAGUE = { key: 'league', field: false, rivals: () => [...champions, ...exploiters, ...leagueExploiters] };

  async function assess(input, round, origin = { operator: 'seed', parents: [] }, pop = MAIN) {
    let g = clone(input);
    if (!fits(g, maxLength)) return null;
    if (settings.dialect === '88') g.code.forEach(legal88);   // every child stays ICWS'88
    g = genomeOf(toWarrior(g, 'Evolved', coreSize));
    const id = genomeId(g);
    if (!lineage.has(id)) lineage.set(id, { id, generation: round, ...origin });
    const key = `${pop.key}:${id}`;
    if (assessed.has(key)) { stats.cacheHits++; return assessed.get(key); }
    if (!measured.has(id)) {
      // Compile what will actually be exported. This also enforces P-space,
      // dialect and geometry limits instead of bypassing them via toWarrior.
      const w = compile(toRedcode(g, { coreSize, geo, dialect: entrySettings.dialect }), 'redcode', entrySettings);
      measured.set(id, w.ok ? solo(w).then((species) => species.survives ? { w, species } : null) : null);
    }
    // Cache pending solo checks as well as pending fitness assessments.
    // Duplicate births retain one measurement and the same cache accounting.
    const pending = (async () => {
      const m = await measured.get(id);
      if (!m) { stats.rejected++; assessed.set(key, null); return null; }
      const { w, species } = m;
      const matchSeed = (seed + round * 1000) % 2147483646 + 1;
      const a = pop.field && target.field.length ? await target.assess(w, { seed: matchSeed, diagnose: true }) : null;
      let fit = a?.fit ?? 0;
      const rows = a ? a.rows.slice(0, target.field.length).map((r) => ({ ...r, value: r[rowMetric] })) : [];
      const sym = a ? { ...a.symptoms } : {};
      const rivals = pop.rivals();
      if (rivals.length && (objective !== 'pushoff' || league || !a)) {
        const c = await evaluate(pool, w, rivals.map((x) => ({ name: x.name, group: 'champion', w: x.w })), { rounds: evalRounds, seed: matchSeed, settings, diagnose: true });
        const vsChamps = c.rows.reduce((s, r) => s + r[rowMetric] - ((1 - tieValue) * r.t) / evalRounds, 0) / c.rows.length;
        fit = !a ? vsChamps : objective === 'pushoff' ? a.fit + vsChamps : (a[metric] + vsChamps) / 2;
        rows.push(...c.rows.map((r) => ({ ...r, value: r[rowMetric] - ((1 - tieValue) * r.t) / evalRounds })));
        for (const k in c.symptoms) sym[k] = (sym[k] ?? 0) + c.symptoms[k];
      }
      const result = { id, g, fit, sym, species, cases: rows.map((r) => r.value), rows,
        ...(outcomes ? { descriptor: outcomes.describe(a.rows.slice(0, target.field.length)) } : {}),
        ...(a?.places ? { places: a.places } : {}) };
      stats.evaluated++;
      assessed.set(key, result);
      return result;
    })();
    assessed.set(key, pending);
    return pending;
  }
  const assessBatch = async (items, round, pop = MAIN) => {
    if (pool.backend === 'gpu') return Promise.all(items.map(({ g, origin }) => assess(g, round, origin, pop)));
    const results = [];
    for (const { g, origin } of items) results.push(await assess(g, round, origin, pop));
    return results;
  };
  const place = (archive, x) => {
    if (!x) return false;
    const key = algorithm === 'ga' ? x.id : cellOf(x);
    const cur = archive.get(key);
    if (cur && cur.fit >= x.fit) return false;
    archive.set(key, x);
    return true;
  };

  // Round 1 starts from the sources themselves plus random grafts of their
  // slices; from scratch, from random programs that survive alone, and (with
  // no kings) four of those survivors are generation 0's champions.
  const unitList = Object.values(units).flat();
  const startingSources = sources.map((s) => ({ g: genomeOf(s.w), name: s.w.name })).filter((s) => fits(s.g, maxLength));
  let start = startingSources.map((s) => s.g);
  if (scratch) {
    const alive = [];
    for (let tries = 0; alive.length < Math.max(batchSize, 40) && tries < 20000; tries++) {
      const min = Math.min(4, maxLength);
      const g = randomGenome(min + Math.floor(random() * (maxLength - min + 1)), { coreSize, geo, random, pSpace: entrySettings.pSpace !== false && entrySettings.dialect !== '88' });
      if (settings.dialect === '88') g.code.forEach(legal88);
      if ((await solo(toWarrior(g, 'Random', coreSize))).survives) alive.push(g);
    }
    if (!alive.length) throw new Error('no random program survived alone');
    if (!champions.length) {
      for (const [k, g] of alive.slice(0, 4).entries()) {
        champions.push({ round: 0, name: `Random ${k + 1}`, g, w: strip(toWarrior(g, `Random ${k + 1}`, coreSize)) });
      }
    }
    start.push(...alive);
  }
  const originalCount = start.length;
  for (let tries = 0; start.length < Math.max(batchSize, 40) && tries < 1000 && unitList.length; tries++) {
    const c = graft(clone(pick(unitList)), pick(unitList));
    if (fits(c, maxLength)) start.push(c);
  }

  // One generation of one population: warm start from `prev`, then batches
  // of children judged by that population's rivals. Returns its archive.
  async function breed(pop, prev, round, onSeed = () => {}) {
    let archive = new Map();
    const seeds = await assessBatch(prev.map((g, i) => ({ g, origin: { operator: 'seed', parents: [],
      ...(round === 1 && pop === MAIN && i < startingSources.length ? { source: startingSources[i].name } : {}) } })), round, pop);
    for (const [i, x] of seeds.entries()) { place(archive, x); onSeed(i, x); }
    const prune = () => {
      if (algorithm === 'ga') {
        const all = [...archive.values()];
        const kept = selection === 'lexicase' ? lexicaseSurvivors(all, populationSize, random, epsilon)
          : all.sort((a, b) => b.fit - a.fit).slice(0, populationSize);
        archive = new Map(kept.map((x) => [x.id, x]));
      }
    };
    prune();
    let placed = 0;
    for (let b = 0; b < batches; b++) {
      const elites = [...archive.values()];
      if (!elites.length) break;
      const kids = [];
      for (let tries = 0; kids.length < batchSize && tries < batchSize * 20; tries++) {
        const parent = () => selection === 'lexicase' ? lexicase(elites, random, epsilon) : algorithm === 'ga'
          ? Array.from({ length: 3 }, () => pick(elites)).sort((a, b) => b.fit - a.fit)[0]
          : pick(elites);
        const p = parent();
        const mate = random() < (algorithm === 'ga' ? 0.7 : 0.2) ? parent() : null;
        const base = mate ? crossover(p.g, mate.g, maxLength, random, { aligned: algorithm === 'ga' }) : p.g;
        const op = chooser.choose(p.sym);
        const child = ops[op](base);
        if (child && fits(child, maxLength)) kids.push({ child, op, parent: p, mate });
      }
      const evaluated = await assessBatch(kids.map((k) => ({ g: k.child,
        origin: { operator: k.op, parents: [k.parent.id, ...(k.mate ? [k.mate.id] : [])] } })), round, pop);
      // Apply results and mutation credit in birth order, never finish order.
      for (const [i, k] of kids.entries()) {
        let x = evaluated[i];
        chooser.record(k.op, !!x && x.fit > k.parent.fit);
        if (place(archive, x)) placed++;
        // Bounded memetic refinement: only fitter children get extra numeric
        // searches. All trials use this generation's common opponents/seeds.
        if (x && x.fit > k.parent.fit) for (let step = 0; step < localSteps; step++) {
          stats.localTried++;
          const tuned = await assess((geo ? ops.axis : ops.retune)(x.g), round, { operator: 'local-retune', parents: [x.id] }, pop);
          if (place(archive, tuned)) placed++;
          if (tuned && tuned.fit > x.fit) { x = tuned; stats.localImproved++; }
        }
      }
      prune();
      onLog(`round ${round}: ${pop === MAIN ? '' : `${pop.key} `}batch ${b + 1}/${batches}, ${algorithm === 'ga' ? 'population' : 'archive'} ${archive.size}`);
    }
    return { archive, placed };
  }
  const bestOf = (archive) => {
    const best = [...archive.values()].sort((a, b) => b.fit - a.fit)[0];
    if (!best) throw new Error('nothing survived: every candidate killed itself');
    return best;
  };
  // A league side population's champion: kept as a rival, not exported as a Red Queen.
  const sideChampion = (archive, round, label) => {
    const best = bestOf(archive);
    return { round, name: `${label} ${round}`, id: best.id, g: best.g, fit: best.fit, species: best.species,
      w: strip(toWarrior(best.g, `${label} ${round}`, coreSize)) };
  };

  let archive = new Map(), exploitArchive = null, leagueArchive = null, exploitAge = 0;
  const history = [];
  let baseline = null;
  for (let round = 1; round <= rounds; round++) {
    assessed.clear(); // scores from different placements/opponents are never compared
    // Warm start: last round's elites are judged again against the new opponents.
    const prev = round === 1 ? start : [...archive.values()].map((x) => x.g);
    let placed;
    ({ archive, placed } = await breed(MAIN, prev, round, (i, x) => {
      if (round === 1 && i < originalCount && x && (!baseline || x.fit > baseline.fit)) baseline = x;
    }));
    const best = bestOf(archive);
    const name = algorithm === 'ga' ? `Genetic ${round}` : `Red Queen ${round}`;
    const w = toWarrior(best.g, name, coreSize);
    const held = heldOut.length ? await evaluate(pool, w, heldOut, { rounds: 20, seed: 1001, settings }) : null;
    const vsAncestors = champions.length
      ? await evaluate(pool, w, champions.map((x) => ({ name: x.name, group: 'champion', w: x.w })), { rounds: 20, seed: 77, settings })
      : null;
    const champ = { round, name, id: best.id, g: best.g, w: strip(w), fit: best.fit, species: best.species, ...(best.places ? { places: best.places } : {}),
      heldOut: held && { score: held.score, smooth: held.smooth },
      vsAncestors: vsAncestors && vsAncestors.rows.map((r) => ({ name: r.name, pts: r.pts })) };
    champions.push(champ);
    const rec = { round, cells: archive.size, placed, caseNames: best.rows.map((r) => r.name), champion: champ };
    if (league) {
      // Exploiters attack the champion just made; once one beats it clearly,
      // or the line grows old, the next generation starts from the gene pool.
      const fresh = !exploitArchive;
      ({ archive: exploitArchive } = await breed(EXPLOIT, fresh ? start : [...exploitArchive.values()].map((x) => x.g), round));
      const ex = sideChampion(exploitArchive, round, 'Exploiter');
      exploiters.push(ex);
      exploitAge = fresh ? 1 : exploitAge + 1;
      ex.restart = ex.fit >= exploitWin || exploitAge >= exploitAge_;
      if (ex.restart) exploitArchive = null;
      ({ archive: leagueArchive } = await breed(LEAGUE, leagueArchive ? [...leagueArchive.values()].map((x) => x.g) : start, round));
      const lx = sideChampion(leagueArchive, round, 'League exploiter');
      leagueExploiters.push(lx);
      rec.exploiter = ex; rec.leagueExploiter = lx;
    }
    history.push(rec);
    onRound(rec);
  }
  const final = [...archive.values()].sort((a, b) => b.fit - a.fit);
  const niches = new Map();
  for (const x of final) if (!niches.has(cellOf(x))) niches.set(cellOf(x), x);
  return {
    config: { seed, algorithm, objective, selection, epsilon, descriptor, archiveSize, localSteps, fieldRounds,
      rounds, batches, batchSize, evalRounds, maxLength, populationSize, tieValue, scratch, settings, entrySettings,
      ...(league ? { league, exploitWin, exploitAge: exploitAge_ } : {}) },
    ...(outcomes ? { probes: target.field.map(({ w, ...o }) => o), centroids: outcomes.centers } : {}),
    baseline, stats, lineage: [...lineage.values()], champions, history,
    ...(league ? { exploiters, leagueExploiters } : {}),
    population: algorithm === 'ga' ? final : undefined,
    archive: [...niches.values()].map((x) => ({ ...x, cell: cellOf(x) })),
    operators: Object.fromEntries(Object.entries(chooser.credit).map(([o, c]) => [o, { tried: c.tries - 2, improved: c.wins - 1 }])),
  };
}
