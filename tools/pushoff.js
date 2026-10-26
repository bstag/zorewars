// The push-off's round robin, run on worker threads. The ranking itself
// lives in src/engine/pushoff.js (the arena uses it too).

import { evaluate } from './hill.js';
export { pushOff } from '../src/engine/pushoff.js';

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
