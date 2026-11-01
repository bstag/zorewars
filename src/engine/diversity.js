// Distance statistics and bounded caches for validated diversity readings.
// Ranking owns which warriors remain; this model owns distances for that set.
const FEATURES = {
  points: (r) => [(3 * r.w + r.t) / r.rounds],
  wlt: (r) => [r.w / r.rounds, r.l / r.rounds, r.t / r.rounds],
  wl: (r) => [r.w / r.rounds, r.l / r.rounds],
};

export function validateDiversityOptions({ features = 'points', metric = 'sd', field = 'original' } = {}) {
  if (!Object.hasOwn(FEATURES, features)) throw new Error(`unknown features '${features}'`);
  if (!['sd', 'eq6', 'euclid'].includes(metric)) throw new Error(`unknown metric '${metric}'`);
  if (!['original', 'current'].includes(field)) throw new Error(`unknown field '${field}'`);
}

export function createDiversity(scores, { results, features, metric, self, field }) {
  const n = scores.length;
  const feat = FEATURES[features];
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
  const fixed = field !== 'current';
  const originalCols = scores.map((_, i) => i);
  let originalSigma;
  const originalDistances = new Array(n * n);
  function distances(live) {
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
    return dist;
  }
  return distances;
}
