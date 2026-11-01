// Iterative diversity push-off, as the Core War Tournament Weekend ranks its
// entries: every warrior plays every other, then, again and again, each
// remaining warrior is scored by its average score times its diversity, and
// the lowest is pushed off. Diversity is the distance to the most similar
// other warrior, comparing how each scores against the field (Achille
// Astolfi, "A Numeric Approach to Diversity Hills",
// https://corewar.co.uk/astolfi/diversity.htm), with the SD-score (Osama
// Ismael, "The Standard Deviation Score", Journal of Big Data 12:58, 2025,
// https://doi.org/10.1186/s40537-025-01091-z) in place of Astolfi's
// Euclidean distance. Sources for every method: docs/references.md.
//
// The announcement leaves details open, so each is an option (defaults first):
//   features  'points': one number per opponent, points per round (3 a win, 1 a tie)
//             'wlt':    wins, losses and ties per round, as Astolfi's distance 1
//             'wl':     wins and losses per round, as his distance 2
//   metric    'sd':     the SD-score as the paper's text describes it: each
//                       attribute's difference divided by its own standard
//                       deviation, averaged
//             'eq6':    the SD-score as the paper's equation 6 writes it: the sum
//                       of differences over the sum of standard deviations
//             'euclid': Astolfi's Euclidean distance
//   self      false:    the two warriors' own columns (and self-fights) left out
//             true:     included, as Astolfi does ("including the two")
//   field     'original': patterns over every warrior of the starting field, so
//                         diversity stays meaningful down to the last few
//             'current':  over the warriors still in, as on Astolfi's hill
// The average is always over the other warriors still in.
//
// rule: 'official' replaces all of these with the tournament runner's own
// script (sdScoreHill below); the options above are the readings we used
// before it was published.

import { createDiversity, validateDiversityOptions } from './diversity.js';

// The official rule overrides announcement options, including unused flags.
export function validatePushOffOptions({ rule = null, ...options } = {}) {
  if (rule === 'official') return;
  if (rule) throw new Error(`unknown rule '${rule}'`);
  validateDiversityOptions(options);
}

// scores[i][j]: warrior i's points per round against warrior j. results[i][j]
// (optional; needed for 'wlt', 'wl' and self): { w, l, t, rounds }, with
// results[i][i] a self-fight. Returns the warriors in final order (first =
// winner), each with the average, diversity and score it had when it was
// pushed off (or at the end).
export function pushOff(scores, names, { rule = null, results = null, features = 'points', metric = 'sd', self = false, field = 'original' } = {}) {
  validatePushOffOptions({ rule, features, metric, field });
  if (rule === 'official') return sdScoreHill(scores, names);
  const distances = createDiversity(scores, { results, features, metric, self, field });
  const active = new Set(names.map((_, i) => i));
  const out = [];
  while (active.size) {
    const live = [...active];
    const dist = distances(live);
    const stats = new Map();
    for (const i of live) {
      let total = 0, nearest = Infinity;
      for (let j = 0; j < live.length; j++) if (live[j] !== i) total += scores[i][live[j]];
      for (let k = 0; k < live.length; k++) if (live[k] !== i) nearest = Math.min(nearest, dist(i, live[k]));
      const avg = live.length > 1 ? total / (live.length - 1) : 0;
      const div = live.length > 1 ? nearest : 0;
      stats.set(i, { avg, div, score: avg * div });
    }
    if (live.length === 1) { out.unshift({ index: live[0], name: names[live[0]], ...stats.get(live[0]) }); break; }
    const worst = live.reduce((a, b) => (stats.get(a).score <= stats.get(b).score ? a : b));
    out.unshift({ index: worst, name: names[worst], ...stats.get(worst) });
    active.delete(worst);
    if (live.length === 2) {                         // the last one keeps the numbers that won it
      const best = live.find((i) => i !== worst);
      out.unshift({ index: best, name: names[best], ...stats.get(best) });
      break;
    }
  }
  return out.map((r, k) => ({ rank: k + 1, ...r }));
}

// The push-off as the tournament runner's script computes it: an infinite
// SD-score hill over the current field. Each warrior's row is its score
// against every warrior still in, with 0 against itself; the diagonal zero
// stays in, both in each column's standard deviation and in the distance.
// Distance is the sum over columns of |difference| / that column's standard
// deviation; diversity is the distance to the nearest other warrior, and the
// lowest diversity times average score is pushed off (on a tie, the one
// listed later). A column with zero spread is skipped (the script would
// divide 0 by 0 there).
export function sdScoreHill(scores, names) {
  const live = names.map((_, i) => i);
  const at = (i, j) => (i === j ? 0 : scores[i][j]);
  const out = [];
  while (live.length > 1) {
    const sd = live.map((j) => {
      const mean = live.reduce((t, i) => t + at(i, j), 0) / live.length;
      return Math.sqrt(live.reduce((t, i) => t + (at(i, j) - mean) ** 2, 0) / live.length);
    });
    const dist = (i, k) => live.reduce((t, j, c) => (sd[c] > 0 ? t + Math.abs(at(i, j) - at(k, j)) / sd[c] : t), 0);
    const stats = live.map((i) => {
      let div = Infinity;
      for (const k of live) if (k !== i) div = Math.min(div, dist(i, k));
      const avg = live.reduce((t, j) => t + at(i, j), 0) / (live.length - 1);
      return { index: i, name: names[i], avg, div, score: avg * div };
    });
    let worst = 0;
    for (let c = 1; c < stats.length; c++) if (stats[c].score <= stats[worst].score) worst = c;
    out.unshift(stats[worst]);
    live.splice(worst, 1);
    if (live.length === 1) out.unshift(stats.find((x) => x.index === live[0]));
  }
  if (live.length === 1 && !out.length) out.push({ index: 0, name: names[0], avg: 0, div: 0, score: 0 });
  return out.map((r, k) => ({ rank: k + 1, ...r }));
}
