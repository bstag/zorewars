// One field objective for search and fresh-seed validation. Push-off needs a
// common field matrix: candidates never enter one another's tournaments.
import { evaluate, strip } from './hill.js';
import { roundRobin, medianPlaces } from './pushoff.js';

export async function createObjective({ pool, opponents, settings, objective = 'points',
  partners = [], rounds = 6, fieldRounds = 50, seed = 1, readings,
}) {
  if (!['points', 'smooth', 'pushoff'].includes(objective)) throw new Error('objective must be smooth, points or pushoff');
  if (partners.length && objective !== 'pushoff') throw new Error('partners need objective pushoff');
  if (objective === 'pushoff' && !opponents.length) throw new Error('objective pushoff needs opponents');
  const field = [...partners.map((w) => ({ name: w.name, group: 'partner', w: strip(w) })), ...opponents];
  const base = objective === 'pushoff'
    ? await roundRobin(pool, field.map((x) => x.w), { rounds: Math.max(rounds, fieldRounds), seed: seed + 11, settings, self: true })
    : null;
  return {
    field,
    async assess(w, { seed: matchSeed = seed, diagnose = false } = {}) {
      const a = await evaluate(pool, w, base ? [...field, { name: 'self', group: 'self', w: strip(w) }] : field,
        { rounds, seed: matchSeed, settings, diagnose });
      if (!base) return { ...a, fit: objective === 'smooth' ? a.smooth : a.score };
      const n = field.length + 1;
      const scores = Array.from({ length: n }, (_, i) => i ? [0, ...base.scores[i - 1]] : new Array(n).fill(0));
      const results = Array.from({ length: n }, (_, i) => i ? [null, ...base.results[i - 1]] : new Array(n).fill(null));
      a.rows.forEach((row, k) => {
        const r = { w: row.w, l: row.l, t: row.t, rounds: row.w + row.l + row.t };
        if (k === field.length) { results[0][0] = r; return; }
        const flip = { w: r.l, l: r.w, t: r.t, rounds: r.rounds };
        results[0][k + 1] = r; results[k + 1][0] = flip;
        scores[0][k + 1] = (3 * r.w + r.t) / r.rounds;
        scores[k + 1][0] = (3 * flip.w + flip.t) / r.rounds;
      });
      const places = medianPlaces(scores, results, ['candidate', ...field.map((x) => x.name)],
        [0, ...partners.map((_, k) => k + 1)], readings);
      return { ...a, places, fit: -(places[0] + places.slice(1).reduce((s, p) => s + p, 0) / 2) + a.score / 100 };
    },
  };
}
