// One generation of GA or MAP-Elites: select, mutate, race, refine and retain.
import { lexicase, lexicaseSurvivors } from '../../selection.js';
import { crossover, fits } from '../../genes.js';

export function createBreeder({ assess, assessBatch, cellOf, stats, options, random, ops, chooser, startingSources }) {
  const { algorithm, selection, epsilon, populationSize, maxLength, race, batches, batchSize,
    localSteps, geo, onPlace, onLog } = options;
  const pick = xs => xs[Math.floor(random() * xs.length)];
  const place = async (archive, x, round, pop) => {
    if (!x) return false;
    const key = algorithm === 'ga' ? x.id : cellOf(x);
    let cur = archive.get(key);
    if (cur && race) {
      // Racing: the screen and each doubling compare child and elite on the same seeds.
      if (cur.id === x.id) return false;
      for (let level = 0; level <= race; level++) {
        const [c, e] = await Promise.all([assess(x.g, round, undefined, pop, level), assess(cur.g, round, undefined, pop, level)]);
        if (!c || (e && e.fit >= c.fit)) return false;
        if (level === 1) stats.raced++;
        x = c; cur = e ?? cur;
      }
      stats.promoted++;
    } else if (cur && cur.fit >= x.fit) return false;
    archive.set(key, x);
    onPlace(x, cur ?? null);
    return true;
  };

  // One generation of one population: warm start from `prev`, then batches
  // of children judged by that population's rivals. Returns its archive.
  async function breed(pop, prev, round, onSeed = () => {}) {
    let archive = new Map();
    const seeds = await assessBatch(prev.map((g, i) => ({ g, origin: { operator: 'seed', parents: [],
      ...(round === 1 && pop.key === 'main' && i < startingSources.length ? { source: startingSources[i].name } : {}) } })), round, pop);
    for (const [i, x] of seeds.entries()) { await place(archive, x, round, pop); onSeed(i, x); }
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
        // Credit compares screening fits: the parent may hold its cell at a higher racing level.
        const parentFit = race ? (await assess(k.parent.g, round, undefined, pop))?.fit ?? k.parent.fit : k.parent.fit;
        chooser.record(k.op, !!x && x.fit > parentFit);
        if (await place(archive, x, round, pop)) placed++;
        // Bounded memetic refinement: only fitter children get extra numeric
        // searches. All trials use this generation's common opponents/seeds.
        if (x && x.fit > parentFit) for (let step = 0; step < localSteps; step++) {
          stats.localTried++;
          const tuned = await assess((geo ? ops.axis : ops.retune)(x.g), round, { operator: 'local-retune', parents: [x.id] }, pop);
          if (await place(archive, tuned, round, pop)) placed++;
          if (tuned && tuned.fit > x.fit) { x = tuned; stats.localImproved++; }
        }
      }
      prune();
      onLog(`round ${round}: ${pop.key === 'main' ? '' : `${pop.key} `}batch ${b + 1}/${batches}, ${algorithm === 'ga' ? 'population' : 'archive'} ${archive.size}`);
    }
    return { archive, placed };
  }
  const FINALISTS = 4;
  const bestOf = async (archive, round, pop) => {
    const ranked = [...archive.values()].sort((a, b) => b.fit - a.fit);
    if (!ranked.length) throw new Error('nothing survived: every candidate killed itself');
    if (!race) return ranked[0];
    // Racing: the top elites play off with one more doubling of rounds.
    const finals = await Promise.all(ranked.slice(0, FINALISTS).map((x) => assess(x.g, round, undefined, pop, race + 1)));
    return finals.filter(Boolean).sort((a, b) => b.fit - a.fit)[0] ?? ranked[0];
  };
  return { breed, bestOf };
}
