// The evolver: Red Queen rounds of MAP-Elites, after Digital Red Queen
// (Sakana AI and MIT, https://github.com/SakanaAI/drq), with two changes:
// children are made by repairs chosen from how their parent loses (genes.js),
// and fitness is the smooth score.
//
// - Archive (MAP-Elites): one elite per species cell (src/engine/species.js).
//   A child only has to beat the elite of its own kind to be kept, so papers,
//   stones and scanners all keep improving instead of one family taking over.
// - Red Queen: each round's champion joins the opponents. Fitness is half
//   "beat the starting opponents", half "beat every earlier champion", so a
//   new champion can't forget how to beat its ancestors. Ties against
//   champions count half, so tie-farming imps can't win a round that way.
// - Held out (optional): opponents never trained on, e.g. the Hall of Fame
//   classics, to see whether champions get more general or only better at
//   beating each other.

import { measureSpecies } from '../src/engine/index.js';
import { evaluate, strip } from './hill.js';
import { makeGenePool, makeOperators, makeChooser, crossover, fits, clone, graft, genomeOf, pick, toWarrior, MAXLEN } from './genes.js';

export async function evolve({
  pool, sources, opponents, heldOut = [], settings,
  rounds = 8, batches = 4, batchSize = 40, evalRounds = 6, maxLength = MAXLEN,
  kings = [],          // warriors that start as champions: generation 1 must already beat them
  onLog = () => {}, onRound = () => {},
}) {
  const units = makeGenePool(sources);
  const ops = makeOperators(units);
  const opNames = Object.keys(ops);
  const chooser = makeChooser(opNames);
  const champions = kings.map((w) => ({ round: 0, name: w.name, g: genomeOf(w), w: strip(w) }));
  const coreSize = settings.coreSize;

  async function assess(g, round) {
    if (!fits(g, maxLength)) return null;
    const w = toWarrior(g, 'Evolved', coreSize);
    const species = measureSpecies(w, settings);
    if (!species.survives) return null;              // kills itself when alone
    const seed = round * 1000 + 1;                     // the same placements for everyone in a round
    const a = await evaluate(pool, w, opponents, { rounds: evalRounds, seed, settings, diagnose: true });
    let fit = a.smooth;
    const sym = { ...a.symptoms };
    if (champions.length) {
      const c = await evaluate(pool, w, champions.map((x) => ({ name: x.name, group: 'champion', w: x.w })), { rounds: evalRounds, seed, settings, diagnose: true });
      const vsChamps = c.rows.reduce((s, r) => s + r.smooth - (0.5 * r.t) / evalRounds, 0) / c.rows.length;
      fit = (a.smooth + vsChamps) / 2;
      for (const k in sym) sym[k] += c.symptoms[k];
    }
    return { g, fit, sym, species };
  }
  const place = (archive, x) => {
    if (!x) return false;
    const cur = archive.get(x.species.key);
    if (cur && cur.fit >= x.fit) return false;
    archive.set(x.species.key, x);
    return true;
  };

  // Round 1 starts from the sources themselves plus random grafts of their slices.
  const unitList = Object.values(units).flat();
  let start = sources.map((s) => genomeOf(s.w)).filter((g) => fits(g, maxLength));
  for (let tries = 0; start.length < Math.max(batchSize, 40) && tries < 1000 && unitList.length; tries++) {
    const c = graft(clone(pick(unitList)), pick(unitList));
    if (fits(c, maxLength)) start.push(c);
  }

  let archive = new Map();
  const history = [];
  for (let round = 1; round <= rounds; round++) {
    // Warm start: last round's elites are judged again against the new opponents.
    const prev = round === 1 ? start : [...archive.values()].map((x) => x.g);
    archive = new Map();
    for (const g of prev) place(archive, await assess(g, round));
    let placed = 0;
    for (let b = 0; b < batches; b++) {
      const elites = [...archive.values()];
      if (!elites.length) break;
      const kids = [];
      for (let tries = 0; kids.length < batchSize && tries < batchSize * 20; tries++) {
        const p = pick(elites);                                   // uniform over niches, as in DRQ
        const base = Math.random() < 0.2 ? crossover(p.g, pick(elites).g, maxLength) : p.g;
        const op = chooser.choose(p.sym);
        const child = ops[op](base);
        if (child && fits(child, maxLength)) kids.push({ child, op, parent: p });
      }
      for (const k of kids) {
        const x = await assess(k.child, round);
        chooser.record(k.op, !!x && x.fit > k.parent.fit);
        if (place(archive, x)) placed++;
      }
      onLog(`round ${round}: batch ${b + 1}/${batches}, archive ${archive.size} cells`);
    }
    const best = [...archive.values()].sort((a, b) => b.fit - a.fit)[0];
    if (!best) throw new Error('nothing survived: every candidate killed itself');
    const name = `Red Queen ${round}`;
    const w = toWarrior(best.g, name, coreSize);
    const held = heldOut.length ? await evaluate(pool, w, heldOut, { rounds: 20, seed: 1001, settings }) : null;
    const vsAncestors = champions.length
      ? await evaluate(pool, w, champions.map((x) => ({ name: x.name, group: 'champion', w: x.w })), { rounds: 20, seed: 77, settings })
      : null;
    const champ = { round, name, g: best.g, w: strip(w), fit: best.fit, species: best.species,
      heldOut: held && { score: held.score, smooth: held.smooth },
      vsAncestors: vsAncestors && vsAncestors.rows.map((r) => ({ name: r.name, pts: r.pts })) };
    champions.push(champ);
    const rec = { round, cells: archive.size, placed, champion: champ };
    history.push(rec);
    onRound(rec);
  }
  const final = [...archive.values()].sort((a, b) => b.fit - a.fit);
  return {
    champions, history,
    archive: final.map((x) => ({ cell: x.species.key, species: x.species, fit: x.fit, g: x.g })),
    operators: Object.fromEntries(Object.entries(chooser.credit).map(([o, c]) => [o, { tried: c.tries - 2, improved: c.wins - 1 }])),
  };
}
