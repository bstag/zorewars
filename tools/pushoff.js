// The push-off's round robin, run on worker threads. The ranking itself
// lives in src/engine/pushoff.js (the arena uses it too).

import { evaluate } from './hill.js';
import { pushOff } from '../src/engine/pushoff.js';
export { pushOff };

// Plays the round robin (each pair once, both ways round as `rounds` rotates
// the first mover) and returns { scores, results }: scores[i][j] is warrior
// i's points per round against j, results[i][j] its { w, l, t, rounds }.
// With self: true, each warrior also plays itself (results[i][i]), as
// Astolfi's diversity distances include.
export async function roundRobin(pool, warriors, { rounds = 50, seed = 1, settings, self = false, onProgress = () => {} } = {}) {
  const n = warriors.length;
  const scores = Array.from({ length: n }, () => new Array(n).fill(0));
  const results = Array.from({ length: n }, () => new Array(n).fill(null));
  for (let i = 0; i < n; i++) {
    const first = self ? i : i + 1;
    const field = warriors.slice(first).map((w, k) => ({ name: String(first + k), group: 'x', w }));
    if (field.length) {
      const a = await evaluate(pool, warriors[i], field, { rounds, seed: seed + i, settings });
      a.rows.forEach((r, k) => {
        const j = first + k;
        results[i][j] = { w: r.w, l: r.l, t: r.t, rounds };
        if (j === i) return;
        results[j][i] = { w: r.l, l: r.w, t: r.t, rounds };
        scores[i][j] = (3 * r.w + r.t) / rounds;
        scores[j][i] = (3 * r.l + r.t) / rounds;
      });
    }
    onProgress(i + 1, n);
  }
  return { scores, results };
}

// The 8 readings of the push-off that rank by points per opponent (SD-score
// as sd or eq6, with or without self-fights, against the original or the
// current field): see src/engine/pushoff.js. The announcement's wording
// points to these; ranking by wins/losses/ties moves places the most.
export const POINTS_READINGS = ['sd', 'eq6'].flatMap((metric) => [false, true].flatMap((self) =>
  ['original', 'current'].map((field) => ({ features: 'points', metric, self, field }))));

// Median place of each of `entries` (indices) over those readings.
export function medianPlaces(scores, results, names, entries) {
  const per = entries.map(() => []);
  for (const v of POINTS_READINGS) {
    const r = pushOff(scores, names, { ...v, results });
    entries.forEach((e, k) => per[k].push(r.find((x) => x.index === e).rank));
  }
  return per.map((p) => { const s = [...p].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; });
}
