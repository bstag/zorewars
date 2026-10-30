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
// - placeOnHill() says where a warrior would rank on the hill by score.
// - climbTrees() climbs a hill from the bottom, a rung at a time (below).
// - Every generation's champion is diagnosed by opponent strategy (what it
//   loses to), and with a CounterTable (counters.js) every mutation is scored
//   against its parent by opponent strategy, so runs build up a measured table
//   of which changes counter which strategies.

import { mulberry32, measureSpecies } from '../../src/engine/index.js';
import { evaluate, strip } from '../hill.js';
import { roundRobin } from '../pushoff.js';
import { buildTree, treeSettings } from './index.js';
import { randomTree, mutate, crossover, id, shape, MUTATIONS } from './genome.js';
import { diagnose, describeDiagnosis, describeChange, weakestTag } from './counters.js';

// A niche: what the warrior does alone, and how its tree is put together at the top.
const topShape = (tree) => (tree.kids ? `${tree.id}(${tree.kids.map((k) => k.id).join(',')})` : tree.id);

export async function evolveTrees({
  pool, field, rules = '94nop', length = 100, torus = null, starts = [],
  generations = 10, batch = 30, rounds = 10, race = 2, seed = 1, ops = MUTATIONS, ties = 1,
  archiveSize = 48, crossRate = 0.25, randomRate = 0.1, onLog = () => {}, onGeneration = () => {}, stop = null,
  counters = null, aim = true, aimTries = 6, aimExplore = 0.3,
}) {
  // The field may change by generation (a function of it), as the ladder's does.
  const fieldAt = typeof field === 'function' ? field : () => field;
  const settings = treeSettings(rules, length, torus);
  const play = { ...settings, maxLength: Math.max(settings.maxLength, 200) };   // hill warriors may be longer
  const random = mulberry32(seed);
  const pick = (xs) => xs[Math.floor(random() * xs.length)];
  const stats = { built: 0, refused: 0, scored: 0, battleRounds: 0, raced: 0, placed: 0 };

  // Build once per tree (the gate is the expensive part); remember refusals too.
  const builds = new Map();
  function build(tree) {
    const key = id(tree);
    if (!builds.has(key)) {
      try {
        const b = buildTree(tree, { rules, length, torus });
        const sp = measureSpecies(b.w, settings);
        builds.set(key, { ok: true, tree, w: strip(b.w), source: b.source, size: b.total, species: sp, niche: `${sp.key}|${topShape(tree)}` });
        stats.built++;
      } catch (e) { builds.set(key, { ok: false, error: e.message }); stats.refused++; }
    }
    return builds.get(key);
  }
  const fitness = (r, n) => r.rows.reduce((t, x) => t + 3 * x.w + ties * x.t, 0) / (r.rows.length * n);
  // Points per round against the hill (ties worth `ties`), at a racing level (rounds x 2^level, that level's seeds).
  // The rows behind each score (results against every opponent) are kept for the diagnosis and the counter table.
  const scores = new Map(), raws = new Map();
  async function score(b, gen, level = 0) {
    const key = `${id(b.tree)}:${gen}:${level}`;
    if (!scores.has(key)) {
      const n = rounds * 2 ** level;
      const opponents = fieldAt(gen);
      scores.set(key, evaluate(pool, b.w, opponents, { rounds: n, seed: seed * 7919 + gen * 104729 + level * 1009, settings: play })
        .then((r) => { stats.scored++; stats.battleRounds += n * opponents.length; raws.set(key, { rows: r.rows, opponents }); return fitness(r, n); }));
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

  // Generation 0: the starting trees, then random trees until the batch is full.
  const seeds = [...starts];
  for (let i = 0; seeds.length < Math.max(batch, starts.length + 8) && i < batch * 20; i++) {
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

  const history = [];
  for (let gen = 1; gen <= generations; gen++) {
    // Elites are judged again on this generation's seeds, so fits compare.
    const elites = [...archive.values()];
    archive = new Map();
    for (const e of elites) { e.fit = await score(e.build, gen, 0); archive.set(e.build.niche, { ...e, gen }); }
    let placed = 0;
    for (let k = 0; k < batch; k++) {
      const pool3 = [...archive.values()];
      const parent = [pick(pool3), pick(pool3), pick(pool3)].sort((a, b) => b.fit - a.fit)[0];
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
    const finals = await Promise.all(top.map(async (e) => ({ e, fit: await score(e.build, gen, race + 1) })));
    const champ = finals.sort((a, b) => b.fit - a.fit)[0];
    const raw = rowsOf(champ.e.tree, gen, race + 1), dx = raw ? diagnose(raw.rows, raw.opponents) : null;
    const rec = { gen, niches: archive.size, placed, champion: { shape: shape(champ.e.tree), fit: champ.fit, tree: champ.e.tree, size: champ.e.build.size, species: champ.e.build.species.hint, diagnosis: dx } };
    history.push(rec);
    onLog(`generation ${gen}: ${archive.size} niches, ${placed} placed | champion ${champ.fit.toFixed(2)} pts/round, ${rec.champion.shape} (${rec.champion.size} cells, ${rec.champion.species})${dx ? ` | weakest: ${describeDiagnosis(dx)}` : ''}`);
    onGeneration(rec);
    if (stop && await stop(rec, champ.e.build.w)) break;
  }
  const final = [...archive.values()].sort((a, b) => b.fit - a.fit)
    .map((e) => ({ shape: shape(e.tree), fit: e.fit, tree: e.tree, size: e.build.size, species: e.build.species.hint, source: e.build.source, w: e.build.w }));
  return { settings, ties, history, archive: final, stats, best: history.at(-1)?.champion ?? null };
}

// Where a warrior would rank on the hill by average points: the hill's own round
// robin (once), plus the warrior against every hill warrior. `cache` keeps the
// hill's round robin between calls.
export async function placeOnHill({ pool, field, w, settings, rounds = 50, seed = 77, cache = {} }) {
  const play = { ...settings, maxLength: Math.max(settings.maxLength, 200) };
  cache.hill ??= await roundRobin(pool, field.map((x) => x.w), { rounds, seed, settings: play });
  const n = field.length, { scores } = cache.hill;
  const ours = await evaluate(pool, w, field, { rounds, seed: seed + 5003, settings: play });
  const table = field.map((x, j) => {
    const vsOthers = scores[j].reduce((t, v, k) => t + (k === j ? 0 : v), 0);
    const vsUs = (3 * ours.rows[j].l + ours.rows[j].t) / rounds;
    return { name: x.name, score: (vsOthers + vsUs) / n };
  });
  table.push({ name: 'ours', score: ours.score, ours: true });
  table.sort((a, b) => b.score - a.score);
  return { score: ours.score, place: table.findIndex((x) => x.ours) + 1, of: table.length, table, rows: ours.rows };
}

// Climbing a hill from the bottom. The hill (best first) is cut into rungs of
// `rung` warriors, taken from the bottom up. On each rung the current champion
// is tested first: if it would already rank first among that rung's warriors,
// the rung is skipped. Otherwise trees evolve against the rung, plus a fresh
// sample of `sample` warriors from the rungs already cleared (so nothing learnt
// below is forgotten) and the last `champions` champions (Red Queen), until a
// champion ranks first on the rung or `cap` generations pass; then the climb
// stops there. The archive's best trees carry on to the next rung.
// To resume a climb: `fromRung` (the rungs below count as cleared) and
// `previous`, the earlier champions in order ({ shape, tree, w }); the last of
// them is the champion, and they all play as Red Queen opponents.
export async function climbTrees({
  pool, hill, rung = 10, sample = 20, champions = 3, cap = 10, clearRounds = 20, fromRung = 1, previous = [],
  rules = '94nop', length = 100, torus = null, starts = [], seed = 1, onLog = () => {}, onRung = () => {}, ...evolve
}) {
  const settings = treeSettings(rules, length, torus);
  const rungs = [];
  for (let end = hill.length; end > 0; end -= rung) rungs.push({ from: Math.max(0, end - rung), to: end, field: hill.slice(Math.max(0, end - rung), end) });
  const below = rungs.slice(0, fromRung - 1).flatMap((r) => r.field), record = [];
  const past = previous.map((c, i) => ({ name: `champion ${i + 1}`, group: 'champion', w: c.w }));
  let champ = previous.at(-1) ?? null, carry = starts, generations = 0;
  // Cleared: the warrior would rank first among the rung's warriors by score.
  const rank = (w, r) => placeOnHill({ pool, field: r.field, w, settings, rounds: clearRounds, cache: (r.cache ??= {}) });
  const cleared = async (w, r) => (await rank(w, r)).place === 1;
  const ordinal = (n) => `${n}${[, 'st', 'nd', 'rd'][n % 100 >> 3 ^ 1 && n % 10] || 'th'}`;
  for (const [k, r] of rungs.entries()) {
    if (k + 1 < fromRung) continue;
    const label = `rung ${k + 1}/${rungs.length} (hill ranks ${r.from + 1}-${r.to})`;
    if (champ && await cleared(champ.w, r)) {
      record.push({ rung: k + 1, from: r.from + 1, to: r.to, skipped: true, generations: 0 });
      onLog(`${label}: cleared by the champion already`);
      below.push(...r.field);
      continue;
    }
    // Each generation: this rung, a fresh sample from below, the latest champions.
    const field = (gen) => {
      const random = mulberry32(seed * 31 + (k + 1) * 977 + gen);
      const pool2 = [...below], picked = [];
      while (picked.length < sample && pool2.length) picked.push(pool2.splice(Math.floor(random() * pool2.length), 1)[0]);
      return [...r.field, ...picked, ...past.slice(-champions)];
    };
    let winner = null;
    const result = await evolveTrees({ ...evolve, pool, field, rules, length, torus, starts: carry, generations: cap, seed: seed + k,
      onLog: (t) => onLog(`${label}: ${t}`),
      stop: async (rec, w) => {
        generations++;
        const p = await rank(w, r), lead = p.table.find((x) => !x.ours);
        rec.rung = { place: p.place, of: p.of, score: p.score, leader: lead.name, leaderScore: lead.score };
        if (p.place === 1) { winner = { tree: rec.champion.tree, shape: rec.champion.shape, w }; return true; }
        onLog(`${label}: generation ${rec.gen} on the rung: ${ordinal(p.place)} of ${p.of} (${p.score.toFixed(2)}; leader ${lead.name} ${lead.score.toFixed(2)})`);
        return false;
      } });
    carry = result.archive.slice(0, 16).map((e) => e.tree);
    const best = result.archive[0];
    const entry = { rung: k + 1, from: r.from + 1, to: r.to, skipped: false, generations: result.history.length, cleared: !!winner,
      champion: winner ? { tree: winner.tree, shape: winner.shape } : { tree: best.tree, shape: best.shape } };
    record.push(entry);
    onRung(entry, winner ? winner.w : best.w);
    if (!winner) { onLog(`${label}: not cleared in ${cap} generations; the climb stops here`); champ = { ...entry.champion, w: best.w }; break; }
    onLog(`${label}: cleared by ${winner.shape}`);
    champ = winner;
    past.push({ name: `champion ${k + 1}`, group: 'champion', w: winner.w });
    below.push(...r.field);
  }
  const top = record.filter((x) => x.cleared || x.skipped).at(-1);
  return { rungs: record, champion: champ, reached: top ? top.from : null, of: hill.length, generations };
}
