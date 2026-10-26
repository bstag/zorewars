// Iterative diversity push-off, as the Core War Tournament Weekend ranks its
// entries: every warrior plays every other, then, again and again, each
// remaining warrior is scored by its average score times its diversity, and
// the lowest is pushed off. Diversity is the distance to the most similar
// other warrior, comparing how each scores against the field (Achille
// Astolfi, "A Numeric Approach to Diversity Hills"), with the SD-score
// (Ismael, "The Standard Deviation Score", Journal of Big Data 12:58, 2025)
// in place of Astolfi's Euclidean distance.
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

const FEATURES = {
  points: (r) => [(3 * r.w + r.t) / r.rounds],
  wlt: (r) => [r.w / r.rounds, r.l / r.rounds, r.t / r.rounds],
  wl: (r) => [r.w / r.rounds, r.l / r.rounds],
};

// scores[i][j]: warrior i's points per round against warrior j. results[i][j]
// (optional; needed for 'wlt', 'wl' and self): { w, l, t, rounds }, with
// results[i][i] a self-fight. Returns the warriors in final order (first =
// winner), each with the average, diversity and score it had when it was
// pushed off (or at the end).
export function pushOff(scores, names, { results = null, features = 'points', metric = 'sd', self = false, field = 'original' } = {}) {
  const n = scores.length;
  const feat = FEATURES[features];
  if (!feat) throw new Error(`unknown features '${features}'`);
  if ((features !== 'points' || self) && !results) throw new Error(`features '${features}'${self ? ' with self-fights' : ''} needs the win/loss/tie results`);
  // vec[i][j]: warrior i's numbers against warrior j (null: no game).
  const vec = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (
    results ? (results[i][j] ? feat(results[i][j]) : null) : (i === j ? null : [scores[i][j]]))));
  const active = new Set(names.map((_, i) => i));
  const out = [];
  while (active.size) {
    const live = [...active];
    const cols = field === 'current' ? live : names.map((_, i) => i);
    // Each attribute's spread: over the warriors whose patterns are compared.
    const sigma = new Map();
    for (const j of cols) {
      const rows = cols.filter((i) => (self || i !== j) && vec[i][j]);
      const dims = vec[rows[0]]?.[j]?.length ?? 0;
      sigma.set(j, Array.from({ length: dims }, (_, f) => {
        const v = rows.map((i) => vec[i][j][f]);
        const mean = v.reduce((s, x) => s + x, 0) / (v.length || 1);
        return Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / (v.length || 1));
      }));
    }
    const dist = (i, k) => {
      let num = 0, den = 0, sum = 0, cnt = 0;
      for (const j of cols) {
        if (!self && (j === i || j === k)) continue;
        const a = vec[i][j], b = vec[k][j];
        if (!a || !b) continue;
        sigma.get(j).forEach((s, f) => {
          const d = Math.abs(a[f] - b[f]);
          if (metric === 'euclid') { sum += d * d; cnt++; } else if (metric === 'eq6') { num += d; den += s; } else if (s > 0) { sum += d / s; cnt++; }
        });
      }
      if (metric === 'euclid') return Math.sqrt(sum);
      if (metric === 'eq6') return den > 0 ? num / den : 0;
      return cnt ? sum / cnt : 0;
    };
    const stats = new Map();
    for (const i of live) {
      const avg = live.length > 1 ? live.filter((j) => j !== i).reduce((s, j) => s + scores[i][j], 0) / (live.length - 1) : 0;
      const div = live.length > 1 ? Math.min(...live.filter((k) => k !== i).map((k) => dist(i, k))) : 0;
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
