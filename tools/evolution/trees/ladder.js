import { mulberry32 } from '../../../src/engine/index.js';
import { treeSettings, id } from '../../algebra/index.js';
import { evolveTrees } from './search.js';
import { placeOnHill } from './placement.js';

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
  pool, hill, rung = 10, sample = 20, champions = 3, cap = 10, clearRounds = 30, fromRung = 1, previous = [],
  clearPlace = 2, clearMargin = 0.05,
  rules = '94nop', length = 100, torus = null, starts = [], seed = 1, onLog = () => {}, onRung = () => {}, ...evolve
}) {
  const settings = treeSettings(rules, length, torus);
  const rungs = [];
  for (let end = hill.length; end > 0; end -= rung) rungs.push({ from: Math.max(0, end - rung), to: end, field: hill.slice(Math.max(0, end - rung), end) });
  const below = rungs.slice(0, fromRung - 1).flatMap((r) => r.field), record = [];
  const past = previous.map((c, i) => ({ name: `champion ${i + 1}`, group: 'champion', w: c.w }));
  let champ = previous.at(-1) ?? null, carry = starts, generations = 0;
  // Cleared: the warrior ranks within `clearPlace` among the rung's warriors, or
  // within `clearMargin` of the leader. Ranks are noisy on a tightly packed rung,
  // so insisting on a clean 1st stalls the climb on luck; "top-2, or all but a
  // hair behind the leader" tracks real competitiveness without that.
  const rank = (w, r) => placeOnHill({ pool, field: r.field, w, settings, rounds: clearRounds, cache: (r.cache ??= {}) });
  const passes = (p) => { const lead = p.table.find((x) => !x.ours); return p.place <= clearPlace || (lead && lead.score - p.score <= clearMargin); };
  const cleared = async (w, r) => passes(await rank(w, r));
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
        if (passes(p)) { winner = { tree: rec.champion.tree, shape: rec.champion.shape, w }; return true; }
        onLog(`${label}: generation ${rec.gen} on the rung: ${ordinal(p.place)} of ${p.of} (${p.score.toFixed(2)}; leader ${lead.name} ${lead.score.toFixed(2)})`);
        return false;
      } });
    const best = result.finalists[0] ?? result.archive[0];
    // Carry the confirmed champion even when its screen score was below the top 16.
    carry = [...new Map([best, ...result.archive].map(e => [id(e.tree), e.tree])).values()].slice(0, 16);
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
