// Evolving block trees against a hill (docs/block-algebra.md): learn which
// blocks, combinations and numbers make strong warriors, judged the way a hill
// judges them, by average points against every warrior on it.
//
// - Candidates are trees. Every one is built and must pass the behaviour gate
//   before it is scored, so evolution only ever spends battles on warriors
//   that do what their blocks claim.
// - The archive keeps the best tree per niche (its behaviour species and the
//   top of its tree shape), so papers, stones, scanners and their hybrids all
//   keep improving instead of one design taking over.
// - Racing: a child that beats its niche's elite on the screen must beat it
//   again with doubled rounds, `race` times, on the same seeds, before it
//   takes the niche, so luck doesn't displace a better warrior.
// - `ties` is what a tie is worth while breeding (a win is 3): 1 is the hill's
//   own scoring, 0 rewards only kills. Placement on the hill always uses 3/1/0.
// - Tune mode (ops ['tune']) only changes numbers: hill-climbing one design.
// - placement.js ranks a warrior on the hill by score.
// - ladder.js climbs a hill from the bottom, a rung at a time.
// - Every generation's champion is diagnosed by opponent strategy (what it
//   loses to), and with a CounterTable (counters.js) every mutation is scored
//   against its parent by opponent strategy, so runs build up a measured table
//   of which changes counter which strategies.

import { mulberry32, measureSpecies } from '../../../src/engine/index.js';
import { evaluate, strip } from '../../hill.js';
import { lexicase as selectLexicase } from '../../selection.js';
import { buildTree, treeSettings } from '../../algebra/index.js';
import { randomTree, mutate, crossover, id, shape, MUTATIONS,COUPLED_MUTATIONS } from '../../algebra/genome.js';
import { diagnose, describeDiagnosis, describeChange, weakestTag } from '../../algebra/counters.js';

// A niche: what the warrior does alone, and how its tree is put together at the top.
const topShape = (tree) => (tree.kids ? `${tree.id}(${tree.kids.map((k) => k.id).join(',')})` : tree.id);

export async function evolveTrees({
  pool, field, rules = '94nop', length = 100, torus = null, starts = [],
  generations = 10, batch = 30, rounds = 10, race = 2, seed = 1, ops = MUTATIONS, ties = 1,
  archiveSize = 48, crossRate = 0.25, randomRate = 0.1, onLog = () => {}, onGeneration = () => {}, stop = null,
  counters = null, aim = true, aimTries = 6, aimExplore = 0.3, lexicase = false, lexEpsilon = 0.1,
}) {
  if (!Number.isFinite(lexEpsilon) || lexEpsilon < 0) throw new Error('lexicase epsilon must be a nonnegative finite number');
  const numericOnly = ops.length>0&&ops.every(op=>['tune','tune-placement'].includes(op));
  const localOnly=numericOnly||ops.length>0&&ops.every(op=>op==='tune'||COUPLED_MUTATIONS.includes(op));
  const verification=ops.some(op=>COUPLED_MUTATIONS.includes(op))?'full':'quick';
  if (localOnly && !starts.length) throw new Error('numeric/coupled tuning needs starting trees');
  // The field may change by generation (a function of it), as the ladder's does.
  const fieldAt = typeof field === 'function' ? field : () => field;
  const settings = treeSettings(rules, length, torus);
  const play = { ...settings, maxLength: settings.hillMaxLength ?? Math.max(settings.maxLength, 200) };
  const random = mulberry32(seed);
  const pick = (xs) => xs[Math.floor(random() * xs.length)];
  const stats = { built: 0, refused: 0, scored: 0, battleRounds: 0, raced: 0, placed: 0 };

  // Build once per tree (the gate is the expensive part); remember refusals too.
  const builds = new Map();
  function build(tree) {
    const key = id(tree);
    if (!builds.has(key)) {
      try {
        const b = buildTree(tree, { rules, length, torus,verification });
        const sp = measureSpecies(b.w, settings);
        builds.set(key, { ok: true, tree, w: strip(b.w), source: b.source, size: b.total, species: sp, niche: `${sp.key}|${topShape(tree)}` });
        stats.built++;
      } catch (e) { builds.set(key, { ok: false, error: e.message }); stats.refused++; }
    }
    return builds.get(key);
  }
  const caseValue = (r) => (3 * r.w + ties * r.t) / (r.w + r.l + r.t);
  const fitness = (r) => r.rows.reduce((t, x) => t + caseValue(x), 0) / r.rows.length;
  // Points per round against the hill (ties worth `ties`), at a racing level (rounds x 2^level, that level's seeds).
  // The rows behind each score (results against every opponent) are kept for the diagnosis and the counter table.
  const scores = new Map(), raws = new Map();
  async function score(b, gen, level = 0) {
    const key = `${id(b.tree)}:${gen}:${level}`;
    if (!scores.has(key)) {
      const n = rounds * 2 ** level;
      const opponents = fieldAt(gen);
      scores.set(key, evaluate(pool, b.w, opponents, { rounds: n, seed: seed * 7919 + gen * 104729 + level * 1009, settings: play })
        .then((r) => { stats.scored++; stats.battleRounds += n * opponents.length; raws.set(key, { rows: r.rows, opponents }); return fitness(r); }));
    }
    return scores.get(key);
  }
  const rowsOf = (tree, gen, level) => raws.get(`${id(tree)}:${gen}:${level}`);

  let archive = new Map();
  // Racing: the child must beat the niche's elite at every level, on common seeds.
  async function place(b, gen) {
    const cur = archive.get(b.niche);
    if (cur && cur.id === id(b.tree)) return false;
    let fit = await score(b, gen, 0);
    if (cur) {
      if (fit <= await score(cur.build, gen, 0)) return false;
      for (let level = 1; level <= race; level++) {
        stats.raced += level === 1 ? 1 : 0;
        const [c, e] = await Promise.all([score(b, gen, level), score(cur.build, gen, level)]);
        if (c <= e) return false;
        fit = c;
      }
    }
    archive.set(b.niche, { id: id(b.tree), tree: b.tree, build: b, fit, gen });
    stats.placed++;
    if (archive.size > archiveSize) {                          // drop the weakest niche
      const worst = [...archive.entries()].sort((x, y) => x[1].fit - y[1].fit)[0];
      archive.delete(worst[0]);
    }
    return true;
  }

  // Numeric tuning stays within the supplied structures, including generation 0.
  const seeds = [...starts];
  for (let i = 0; !localOnly && seeds.length < Math.max(batch, starts.length + 8) && i < batch * 20; i++) {
    try { seeds.push(randomTree(settings, random)); } catch { break; }
  }
  for (const t of seeds) { const b = build(t); if (b.ok) await place(b, 0); }
  onLog(`generation 0: ${archive.size} niches from ${seeds.length} starting trees (${stats.refused} refused by the gate)`);

  // Aimed mutation: when the counter table has something to say, find the
  // opponent type this parent does worst against (from its own results this
  // generation), draw `aimTries` candidate mutations, and keep the one the
  // table rates highest against that type (unknown changes still get a turn,
  // through the exploration bonus). Without a table, or a clear weakness, it is
  // an ordinary single mutation.
  function aimedMutation(parent, gen) {
    const one = () => mutate(parent.tree, settings, random, 60, ops)?.tree ?? null;
    if (!counters || !aim || ops !== MUTATIONS) return one();
    const pr = rowsOf(parent.tree, gen, 0);
    const weak = pr ? weakestTag(diagnose(pr.rows, pr.opponents)) : null;
    if (!weak) return one();
    let best = null, bestScore = -Infinity;
    for (let a = 0; a < aimTries; a++) {
      const cand = one();
      if (!cand) continue;
      const s = counters.score(describeChange(parent.tree, cand), weak, aimExplore) + random() * 1e-9;
      if (s > bestScore) { bestScore = s; best = cand; }
    }
    stats.aimed = (stats.aimed ?? 0) + 1;
    return best;
  }

  // Parent selection. Tournament picks by average fitness, which lets the
  // highest-tying design (a paper) crowd out everything. Lexicase instead keeps,
  // opponent by opponent in a shuffled order, the candidates that are best (within
  // lexEpsilon) against that opponent, until one is left: a warrior that is best
  // against some opponents survives even if its average is low, so attackers that
  // beat scanners or clears stay in the gene pool beside the papers.
  function selectParent(pool3, gen) {
    if (!lexicase) return [pick(pool3), pick(pool3), pick(pool3)].sort((a, b) => b.fit - a.fit)[0];
    const cands = pool3.map((e) => ({ e, cases: rowsOf(e.tree, gen, 0)?.rows.map(caseValue) })).filter((c) => c.cases);
    if (cands.length <= 1) return cands[0]?.e ?? pick(pool3);
    return selectLexicase(cands, random, lexEpsilon).e;
  }

  const history = [];
  let finalists = [];
  for (let gen = 1; gen <= generations; gen++) {
    // Elites are judged again on this generation's seeds, so fits compare.
    const elites = [...archive.values()];
    archive = new Map();
    for (const e of elites) { e.fit = await score(e.build, gen, 0); archive.set(e.build.niche, { ...e, gen }); }
    let placed = 0;
    for (let k = 0; k < batch; k++) {
      const pool3 = [...archive.values()];
      const parent = selectParent(pool3, gen);
      let child = null, mutated = false;
      const r = random();
      if (r < randomRate && ops === MUTATIONS) { try { child = randomTree(settings, random); } catch { child = null; } }
      else if (r < randomRate + crossRate && ops === MUTATIONS) child = crossover(parent.tree, pick(pool3).tree, settings, random);
      if (!child) { child = aimedMutation(parent, gen); mutated = true; }
      if (!child) continue;
      const b = build(child);
      if (b.ok && await place(b, gen)) placed++;
      // A mutation is an experiment: the child against its parent, same opponents and seeds.
      const [pr, cr] = [rowsOf(parent.tree, gen, 0), b.ok && rowsOf(child, gen, 0)];
      if (counters && mutated && pr && cr) { counters.record(describeChange(parent.tree, child), pr.rows, cr.rows, cr.opponents); stats.experiments = (stats.experiments ?? 0) + 1; }
    }
    // The generation's champion: the top few elites with one more doubling.
    const top = [...archive.values()].sort((a, b) => b.fit - a.fit).slice(0, 4);
    finalists = await Promise.all(top.map(async (e) => ({ e, fit: await score(e.build, gen, race + 1) })));
    finalists.sort((a, b) => b.fit - a.fit);
    const champ = finalists[0];
    const raw = rowsOf(champ.e.tree, gen, race + 1), dx = raw ? diagnose(raw.rows, raw.opponents) : null;
    const rec = { gen, niches: archive.size, placed, champion: { shape: shape(champ.e.tree), fit: champ.fit, tree: champ.e.tree, size: champ.e.build.size, species: champ.e.build.species.hint, diagnosis: dx } };
    history.push(rec);
    onLog(`generation ${gen}: ${archive.size} niches, ${placed} placed | champion ${champ.fit.toFixed(2)} pts/round, ${rec.champion.shape} (${rec.champion.size} cells, ${rec.champion.species})${dx ? ` | weakest: ${describeDiagnosis(dx)}` : ''}`);
    onGeneration(rec);
    if (stop && await stop(rec, champ.e.build.w)) break;
  }
  const candidate = (e, fit = e.fit) => ({ shape: shape(e.tree), fit, tree: e.tree, size: e.build.size, species: e.build.species.hint, source: e.build.source, w: e.build.w });
  const final = [...archive.values()].sort((a, b) => b.fit - a.fit).map(e => candidate(e));
  return { settings, ties,verification,history, archive: final, finalists: finalists.map(({ e, fit }) => candidate(e, fit)),
    stats, best: history.at(-1)?.champion ?? null };
}
