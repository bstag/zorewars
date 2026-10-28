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
  // Store each unordered pair's absolute differences in column/feature order.
  // A bounded optional table avoids excessive allocation for very large fields.
  const dimensions = features === 'wlt' ? 3 : features === 'wl' ? 2 : 1;
  const pairCount = n * (n - 1) / 2;
  const differenceCount = pairCount * n * dimensions;
  const differences = differenceCount <= 8 * 1024 * 1024 ? new Float64Array(differenceCount) : null;
  const present = differences ? new Uint8Array(pairCount * n) : null;
  if (differences) {
    let pair = 0;
    for (let i = 0; i < n; i++) for (let k = i + 1; k < n; k++, pair++) {
      const columns = pair * n;
      for (let j = 0; j < n; j++) {
        const a = vec[i][j], b = vec[k][j];
        if (!a || !b) continue;
        present[columns + j] = 1;
        const offset = (columns + j) * dimensions;
        for (let f = 0; f < dimensions; f++) differences[offset + f] = Math.abs(a[f] - b[f]);
      }
    }
  }
  const active = new Set(names.map((_, i) => i));
  const out = [];
  const fixed = field !== 'current';
  const originalCols = names.map((_, i) => i);
  let originalSigma;
  const originalDistances = new Array(n * n);
  while (active.size) {
    const live = [...active];
    const cols = fixed ? originalCols : live;
    const distances = fixed ? originalDistances : new Array(n * n);
    // Each attribute's spread: over the warriors whose patterns are compared.
    const sigma = fixed && originalSigma ? originalSigma : new Map();
    if (!fixed || !originalSigma) for (const j of cols) {
      const rows = cols.filter((i) => (self || i !== j) && vec[i][j]);
      const dims = vec[rows[0]]?.[j]?.length ?? 0;
      sigma.set(j, Array.from({ length: dims }, (_, f) => {
        const v = rows.map((i) => vec[i][j][f]);
        const mean = v.reduce((s, x) => s + x, 0) / (v.length || 1);
        return Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / (v.length || 1));
      }));
    }
    if (fixed) originalSigma = sigma;
    const dist = (i, k) => {
      // Original field: reused across rounds. Current field: reused within
      // one round only (distances are symmetric).
      const low = Math.min(i, k), high = Math.max(i, k);
      const key = low * n + high;
      if (distances[key] !== undefined) return distances[key];
      const pair = low * (2 * n - low - 1) / 2 + high - low - 1;
      const columns = pair * n;
      let num = 0, den = 0, sum = 0, cnt = 0;
      for (let c = 0; c < cols.length; c++) {
        const j = cols[c];
        if (!self && (j === i || j === k)) continue;
        let a, b;
        if (differences) { if (!present[columns + j]) continue; }
        else { a = vec[i][j]; b = vec[k][j]; if (!a || !b) continue; }
        const spreads = sigma.get(j), offset = (columns + j) * dimensions;
        for (let f = 0; f < spreads.length; f++) {
          const s = spreads[f];
          const d = differences ? differences[offset + f] : Math.abs(a[f] - b[f]);
          if (metric === 'euclid') { sum += d * d; cnt++; } else if (metric === 'eq6') { num += d; den += s; } else if (s > 0) { sum += d / s; cnt++; }
        }
      }
      const value = metric === 'euclid' ? Math.sqrt(sum) : metric === 'eq6' ? (den > 0 ? num / den : 0) : (cnt ? sum / cnt : 0);
      distances[key] = value;
      return value;
    };
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
