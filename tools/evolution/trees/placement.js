import { evaluate } from '../../hill.js';
import { roundRobin } from '../../pushoff.js';

// Where a warrior would rank on the hill by average points: the hill's own round
// robin (once), plus the warrior against every hill warrior. `cache` keeps the
// hill's round robin between calls.
export async function placeOnHill({ pool, field, w, settings, rounds = 50, seed = 77, cache = {} }) {
  const play = { ...settings, maxLength: settings.hillMaxLength ?? Math.max(settings.maxLength, 200) };
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
