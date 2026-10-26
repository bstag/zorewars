// The push-off's round robin, run on worker threads. The ranking itself
// lives in src/engine/pushoff.js (the arena uses it too).

import { evaluate } from './hill.js';
export { pushOff } from '../src/engine/pushoff.js';

// Plays the round robin (each pair once, both ways round as `rounds` rotates
// the first mover) and returns the scores matrix for pushOff.
export async function roundRobin(pool, warriors, { rounds = 50, seed = 1, settings, onProgress = () => {} } = {}) {
  const n = warriors.length;
  const scores = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    const field = warriors.slice(i + 1).map((w, k) => ({ name: String(i + 1 + k), group: 'x', w }));
    if (!field.length) break;
    const a = await evaluate(pool, warriors[i], field, { rounds, seed: seed + i, settings });
    a.rows.forEach((r, k) => {
      const j = i + 1 + k;
      scores[i][j] = (3 * r.w + r.t) / rounds;
      scores[j][i] = (3 * r.l + r.t) / rounds;
    });
    onProgress(i + 1, n);
  }
  return scores;
}
