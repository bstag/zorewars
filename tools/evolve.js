// The evolver: Red Queen rounds of MAP-Elites, after Digital Red Queen
// (Sakana AI and MIT, https://github.com/SakanaAI/drq), with two changes:
// children are made by repairs chosen from how their parent loses (genes.js),
// and fitness can use tournament points or the smooth score. The alternative
// GA keeps an elitist population with tournament parent selection.
//
// - Archive (MAP-Elites): one elite per species cell (src/engine/species.js).
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

import { createHash } from 'node:crypto';
import { compile, DEFAULT_SETTINGS, measureSpecies, mulberry32 } from '../src/engine/index.js';
import { makeGeometry } from '../src/engine/geometry.js';
import { evaluate, strip } from './hill.js';
import { roundRobin, medianPlaces } from './pushoff.js';
import { makeGenePool, makeOperators, makeChooser, crossover, fits, clone, graft, genomeOf, pick as choose, toWarrior, toRedcode, randomGenome, legal88, MAXLEN } from './genes.js';

export const genomeId = (g) => createHash('sha256').update(JSON.stringify(g)).digest('hex').slice(0, 16);

export async function evolve({
  pool, sources, opponents, heldOut = [], settings, entrySettings = settings,
  rounds = 8, batches = 4, batchSize = 40, evalRounds = 6, maxLength = MAXLEN,
  kings = [],          // warriors that start as champions: generation 1 must already beat them
  scratch = false,     // from scratch: random programs, no gene pool, fitness only against champions
  tieValue = 0.5,      // what a tie with a champion is worth, as a share of a tie's points (0..1)
  seed = 1, algorithm = 'map-elites', objective = 'smooth', populationSize = batchSize,
  partners = [],       // objective 'pushoff': our other entries, ranked beside each candidate
  fieldRounds = 50,    // objective 'pushoff': rounds a pair for the field's own round robin
  onLog = () => {}, onRound = () => {},
}) {
  settings = { ...DEFAULT_SETTINGS, ...settings };
  entrySettings = { ...DEFAULT_SETTINGS, ...entrySettings };
  for (const [key, n] of Object.entries({ rounds, batches, batchSize, evalRounds, maxLength, populationSize, fieldRounds })) {
    if (!Number.isInteger(n) || n < 1) throw new Error(`${key} must be a positive integer`);
  }
  if (!Number.isInteger(seed) || seed < 0 || seed > 2147483646) throw new Error('seed must be an integer from 0 to 2147483646');
  if (!['map-elites', 'ga'].includes(algorithm)) throw new Error('algorithm must be map-elites or ga');
  if (!['smooth', 'points', 'pushoff'].includes(objective)) throw new Error('objective must be smooth, points or pushoff');
  if (objective === 'pushoff' && !opponents.length) throw new Error('objective pushoff needs opponents (a field to rank in)');
  if (!Number.isFinite(tieValue) || tieValue < 0 || tieValue > 1) throw new Error('tieValue must be from 0 to 1');
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
  const stats = { evaluated: 0, cacheHits: 0, rejected: 0 };
  const metric = objective === 'smooth' ? 'smooth' : 'score';
  const rowMetric = objective === 'smooth' ? 'smooth' : 'pts';
  // Push-off: the partners and opponents play each other once (self-fights
  // too); each candidate then plays them all and itself.
  let base = null;
  if (objective === 'pushoff') {
    const ws = [...partners.map((w) => ({ name: w.name, group: 'partner', w: strip(w) })), ...opponents];
    // Few rounds make every warrior's results noisy, and noise reads as
    // diversity: at 10 rounds a pair the field looked so diverse that a real
    // specialist (a vampire placed 7th) came last. Play the field properly.
    const rr = await roundRobin(pool, ws.map((x) => x.w), { rounds: Math.max(evalRounds, fieldRounds), seed: seed + 11, settings, self: true });
    base = { ws, ...rr };
  }
  const placeOf = (a) => {
    const n = base.ws.length + 1;
    const res = (r) => ({ w: r.w, l: r.l, t: r.t, rounds: r.w + r.l + r.t });
    const pts = (r) => (3 * r.w + r.t) / r.rounds;
    const scores = Array.from({ length: n }, (_, i) => (i ? [0, ...base.scores[i - 1]] : new Array(n).fill(0)));
    const results = Array.from({ length: n }, (_, i) => (i ? [null, ...base.results[i - 1]] : new Array(n).fill(null)));
    a.rows.forEach((row, k) => {
      const r = res(row);
      if (k === base.ws.length) { results[0][0] = r; return; }   // the self-fight
      const flip = { w: r.l, l: r.w, t: r.t, rounds: r.rounds };
      results[0][k + 1] = r; results[k + 1][0] = flip; scores[0][k + 1] = pts(r); scores[k + 1][0] = pts(flip);
    });
    const places = medianPlaces(scores, results, ['candidate', ...base.ws.map((x) => x.name)], [0, ...partners.map((_, k) => k + 1)]);
    // Lower places are better; points break ties between equal places.
    return { fit: -(places[0] + places.slice(1).reduce((s, p) => s + p, 0) / 2) + a.score / 100, places };
  };

  async function assess(input, round, origin = { operator: 'seed', parents: [] }) {
    let g = clone(input);
    if (!fits(g, maxLength)) return null;
    if (settings.dialect === '88') g.code.forEach(legal88);   // every child stays ICWS'88
    g = genomeOf(toWarrior(g, 'Evolved', coreSize));
    const id = genomeId(g);
    if (!lineage.has(id)) lineage.set(id, { id, generation: round, ...origin });
    if (assessed.has(id)) { stats.cacheHits++; return assessed.get(id); }
    if (!measured.has(id)) {
      // Compile what will actually be exported. This also enforces P-space,
      // dialect and geometry limits instead of bypassing them via toWarrior.
      const w = compile(toRedcode(g, { coreSize, geo, dialect: entrySettings.dialect }), 'redcode', entrySettings);
      const species = w.ok ? measureSpecies(w, settings) : null;
      measured.set(id, species?.survives ? { w, species } : null);
    }
    const m = measured.get(id);
    if (!m) { stats.rejected++; assessed.set(id, null); return null; }
    const { w, species } = m;
    const matchSeed = (seed + round * 1000) % 2147483646 + 1;
    const field = base ? [...base.ws, { name: 'self', group: 'self', w: strip(w) }] : opponents;
    const a = field.length ? await evaluate(pool, w, field, { rounds: evalRounds, seed: matchSeed, settings, diagnose: true }) : null;
    let fit = a ? a[metric] : 0, places;
    if (base) ({ fit, places } = placeOf(a));
    const sym = a ? { ...a.symptoms } : {};
    if (champions.length && !base) {
      const c = await evaluate(pool, w, champions.map((x) => ({ name: x.name, group: 'champion', w: x.w })), { rounds: evalRounds, seed: matchSeed, settings, diagnose: true });
      const vsChamps = c.rows.reduce((s, r) => s + r[rowMetric] - ((1 - tieValue) * r.t) / evalRounds, 0) / c.rows.length;
      fit = a ? (a[metric] + vsChamps) / 2 : vsChamps;
      for (const k in c.symptoms) sym[k] = (sym[k] ?? 0) + c.symptoms[k];
    }
    const result = { id, g, fit, sym, species, ...(places ? { places } : {}) };
    stats.evaluated++;
    assessed.set(id, result);
    return result;
  }
  const place = (archive, x) => {
    if (!x) return false;
    const key = algorithm === 'ga' ? x.id : niche(x.species);
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
      if (measureSpecies(toWarrior(g, 'Random', coreSize), settings).survives) alive.push(g);
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

  let archive = new Map();
  const history = [];
  let baseline = null;
  for (let round = 1; round <= rounds; round++) {
    assessed.clear(); // scores from different placements/opponents are never compared
    // Warm start: last round's elites are judged again against the new opponents.
    const prev = round === 1 ? start : [...archive.values()].map((x) => x.g);
    archive = new Map();
    for (const [i, g] of prev.entries()) {
      const x = await assess(g, round, { operator: 'seed', parents: [],
        ...(round === 1 && i < startingSources.length ? { source: startingSources[i].name } : {}) });
      place(archive, x);
      if (round === 1 && i < originalCount && x && (!baseline || x.fit > baseline.fit)) baseline = x;
    }
    const prune = () => {
      if (algorithm === 'ga') archive = new Map([...archive.entries()].sort((a, b) => b[1].fit - a[1].fit).slice(0, populationSize));
    };
    prune();
    let placed = 0;
    for (let b = 0; b < batches; b++) {
      const elites = [...archive.values()];
      if (!elites.length) break;
      const kids = [];
      for (let tries = 0; kids.length < batchSize && tries < batchSize * 20; tries++) {
        const parent = () => algorithm === 'ga'
          ? Array.from({ length: 3 }, () => pick(elites)).sort((a, b) => b.fit - a.fit)[0]
          : pick(elites);
        const p = parent();
        const mate = random() < (algorithm === 'ga' ? 0.7 : 0.2) ? parent() : null;
        const base = mate ? crossover(p.g, mate.g, maxLength, random, { aligned: algorithm === 'ga' }) : p.g;
        const op = chooser.choose(p.sym);
        const child = ops[op](base);
        if (child && fits(child, maxLength)) kids.push({ child, op, parent: p, mate });
      }
      for (const k of kids) {
        const x = await assess(k.child, round, { operator: k.op, parents: [k.parent.id, ...(k.mate ? [k.mate.id] : [])] });
        chooser.record(k.op, !!x && x.fit > k.parent.fit);
        if (place(archive, x)) placed++;
      }
      prune();
      onLog(`round ${round}: batch ${b + 1}/${batches}, ${algorithm === 'ga' ? 'population' : 'archive'} ${archive.size}`);
    }
    const best = [...archive.values()].sort((a, b) => b.fit - a.fit)[0];
    if (!best) throw new Error('nothing survived: every candidate killed itself');
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
    const rec = { round, cells: archive.size, placed, champion: champ };
    history.push(rec);
    onRound(rec);
  }
  const final = [...archive.values()].sort((a, b) => b.fit - a.fit);
  const niches = new Map();
  for (const x of final) if (!niches.has(niche(x.species))) niches.set(niche(x.species), x);
  return {
    config: { seed, algorithm, objective, rounds, batches, batchSize, evalRounds, maxLength, populationSize, tieValue, scratch, settings, entrySettings },
    baseline, stats, lineage: [...lineage.values()], champions, history,
    population: algorithm === 'ga' ? final : undefined,
    archive: [...niches.values()].map((x) => ({ id: x.id, cell: niche(x.species), species: x.species, fit: x.fit, g: x.g })),
    operators: Object.fromEntries(Object.entries(chooser.credit).map(([o, c]) => [o, { tried: c.tries - 2, improved: c.wins - 1 }])),
  };
}
