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
// - Racing (optional): every candidate is screened with evalRounds rounds. A
//   child that beats its cell's elite there must beat it again with twice
//   the rounds, and again, `race` times, both on the same fresh seeds, before
//   it takes the cell; most children fail the screen, so the extra rounds go
//   to the few that matter. The round's champion is then picked from the top
//   few elites with one more doubling.

import { mulberry32 } from '../../../src/engine/index.js';
import { evaluate, strip } from '../../hill.js';
import { createObjective } from '../../objective.js';
import { outcomeNiches } from '../../selection.js';
import { makeGenePool, makeOperators, makeChooser, genomeOf, toWarrior } from '../../genes.js';
import { countBattles } from '../execution.js';
import { instructionOptions } from './options.js';
import { createAssessor } from './evaluation.js';
import { createBreeder } from './population.js';
import { initialGenomes } from './seeds.js';

export async function evolve(input) {
  const options = instructionOptions(input);
  const { pool: runner, sources, opponents, heldOut, settings, entrySettings, rounds, batches, batchSize, evalRounds,
    maxLength, kings, scratch, tieValue, seed, algorithm, objective, populationSize, selection, epsilon,
    descriptor, archiveSize, localSteps, partners, fieldRounds, league, exploitWin, exploitAge_, race,
    onRound, geo } = options;
  const random = mulberry32(seed);
  const units = makeGenePool(sources, { random });
  const ops = makeOperators(units, geo, { scratch, coreSize: settings.coreSize, random, pSpace: entrySettings.pSpace !== false && entrySettings.dialect !== '88' });
  // On a plane or volume the archive gets a third dimension, the warrior's
  // shape (how many axes its writes spread over), so row-bound, flat and
  // volumetric species each keep their own elites.
  const niche = (sp) => (geo ? `${sp.key},${sp.shape}` : sp.key);
  const opNames = Object.keys(ops);
  const chooser = makeChooser(opNames, random);
  const champions = kings.map((w) => ({ round: 0, name: w.name, g: genomeOf(w), w: strip(w) }));
  const coreSize = settings.coreSize;
  const stats = { evaluated: 0, cacheHits: 0, rejected: 0, matches: 0, battleRounds: 0, localTried: 0, localImproved: 0, raced: 0, promoted: 0 };
  const pool = countBattles(runner, stats);
  const target = await createObjective({ pool, opponents, partners, settings, objective, rounds: evalRounds, fieldRounds, seed });
  const outcomes = descriptor === 'outcomes'
    ? outcomeNiches(target.field.length, archiveSize, mulberry32(seed ^ 0x6a09e667)) : null;
  const cellOf = (x) => outcomes ? outcomes.cell(x.descriptor) : niche(x.species);

  // Populations: who each one is scored against. Without a league there is
  // only the main one, whose rivals are the champions (the Red Queen).
  const exploiters = [], leagueExploiters = [];
  const RECENT = 10;   // the main warriors face this many of the latest exploiters of each kind
  const MAIN = { key: 'main', field: true, rivals: () => league
    ? [...champions, ...exploiters.slice(-RECENT), ...leagueExploiters.slice(-RECENT)] : champions };
  const EXPLOIT = { key: 'exploit', field: false, rivals: () => champions.slice(-1) };
  const LEAGUE = { key: 'league', field: false, rivals: () => [...champions, ...exploiters, ...leagueExploiters] };

  const { assess, assessBatch, reset, lineage } = createAssessor({ pool, target, outcomes, stats, options });
  const { start, originalCount, startingSources } = await initialGenomes({ sources, champions, units, random, options, pool });
  const { breed, bestOf } = createBreeder({ assess, assessBatch, cellOf, stats, options, random, ops, chooser, startingSources });
  // A league side population's champion: kept as a rival, not exported as a Red Queen.
  const sideChampion = async (archive, round, label, pop) => {
    const best = await bestOf(archive, round, pop);
    return { round, name: `${label} ${round}`, id: best.id, g: best.g, fit: best.fit, species: best.species,
      w: strip(toWarrior(best.g, `${label} ${round}`, coreSize)) };
  };

  let archive = new Map(), exploitArchive = null, leagueArchive = null, exploitAge = 0;
  const history = [];
  let baseline = null;
  for (let round = 1; round <= rounds; round++) {
    reset(); // scores from different placements/opponents are never compared
    // Warm start: last round's elites are judged again against the new opponents.
    const prev = round === 1 ? start : [...archive.values()].map((x) => x.g);
    let placed;
    ({ archive, placed } = await breed(MAIN, prev, round, (i, x) => {
      if (round === 1 && i < originalCount && x && (!baseline || x.fit > baseline.fit)) baseline = x;
    }));
    const best = await bestOf(archive, round, MAIN);
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
      const ex = await sideChampion(exploitArchive, round, 'Exploiter', EXPLOIT);
      exploiters.push(ex);
      exploitAge = fresh ? 1 : exploitAge + 1;
      ex.restart = ex.fit >= exploitWin || exploitAge >= exploitAge_;
      if (ex.restart) exploitArchive = null;
      ({ archive: leagueArchive } = await breed(LEAGUE, leagueArchive ? [...leagueArchive.values()].map((x) => x.g) : start, round));
      const lx = await sideChampion(leagueArchive, round, 'League exploiter', LEAGUE);
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
      ...(league ? { league, exploitWin, exploitAge: exploitAge_ } : {}), ...(race ? { race } : {}) },
    ...(outcomes ? { probes: target.field.map(({ w, ...o }) => o), centroids: outcomes.centers } : {}),
    baseline, stats, lineage: [...lineage.values()], champions, history,
    ...(league ? { exploiters, leagueExploiters } : {}),
    population: algorithm === 'ga' ? final : undefined,
    archive: [...niches.values()].map((x) => ({ ...x, cell: cellOf(x) })),
    operators: Object.fromEntries(Object.entries(chooser.credit).map(([o, c]) => [o, { tried: c.tries - 2, improved: c.wins - 1 }])),
  };
}
