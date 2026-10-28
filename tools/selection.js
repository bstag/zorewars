// Epsilon lexicase maximizes per-opponent cases. The default epsilon is the
// case's median absolute deviation across the original selection pool.
const pick = (xs, random) => xs[Math.floor(random() * xs.length)];
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function lexicase(population, random, epsilon = 'auto') {
  if (!population.length) throw new Error('lexicase needs a population');
  if (epsilon !== 'auto' && (!Number.isFinite(epsilon) || epsilon < 0)) throw new Error('epsilon must be auto or a nonnegative number');
  const count = population[0].cases.length;
  if (population.some((x) => x.cases.length !== count || x.cases.some((v) => !Number.isFinite(v)))) throw new Error('lexicase cases must be aligned and finite');
  const cases = Array.from({ length: count }, (_, i) => i);
  for (let i = cases.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cases[i], cases[j]] = [cases[j], cases[i]];
  }
  let remaining = population;
  for (const c of cases) {
    const values = population.map((x) => x.cases[c]);
    const middle = median(values);
    const tolerance = epsilon === 'auto' ? median(values.map((v) => Math.abs(v - middle))) : epsilon;
    const best = Math.max(...remaining.map((x) => x.cases[c]));
    remaining = remaining.filter((x) => x.cases[c] >= best - tolerance);
    if (remaining.length === 1) break;
  }
  return pick(remaining, random);
}

// Keep one overall elite, then select without replacement. Scalar truncation
// would erase the specialists that lexicase parent selection protects.
export function lexicaseSurvivors(population, size, random, epsilon = 'auto') {
  if (!Number.isInteger(size) || size < 1) throw new Error('survivor size must be a positive integer');
  if (population.length <= size) return population;
  const remaining = [...population].sort((a, b) => b.fit - a.fit);
  const kept = [remaining.shift()];
  while (kept.length < size) {
    const next = lexicase(remaining, random, epsilon);
    kept.push(next);
    remaining.splice(remaining.indexOf(next), 1);
  }
  return kept;
}

// CVT-MAP-Elites: deterministic Lloyd iterations partition the W/T simplex
// for a fixed probe panel. K is the archive capacity, independent of dimension.
// Loss is implicit (1 - W - T); points alone cannot distinguish a tie from
// a one-third chance of winning. Probe identities never include new champions.
export function outcomeNiches(probeCount, size, random) {
  if (!Number.isInteger(probeCount) || probeCount < 1 || !Number.isInteger(size) || size < 1) throw new Error('outcome niches need probes and a positive capacity');
  const sample = () => Array.from({ length: probeCount }, () => {
    let w = random(), t = random();
    if (w + t > 1) { w = 1 - w; t = 1 - t; }
    return [w, t];
  }).flat();
  let centers = Array.from({ length: size }, sample);
  const points = Array.from({ length: Math.max(256, size * 8) }, sample);
  const nearest = (vector) => {
    let best = 0, distance = Infinity;
    centers.forEach((center, i) => {
      const d = center.reduce((s, v, k) => s + (v - vector[k]) ** 2, 0);
      if (d < distance) { distance = d; best = i; }
    });
    return best;
  };
  for (let iteration = 0; iteration < 8; iteration++) {
    const sums = centers.map(() => new Array(probeCount * 2).fill(0)), counts = new Array(size).fill(0);
    for (const p of points) {
      const i = nearest(p); counts[i]++;
      p.forEach((v, k) => { sums[i][k] += v; });
    }
    centers = centers.map((c, i) => counts[i] ? sums[i].map((v) => v / counts[i]) : c);
  }
  return {
    centers,
    describe(rows) {
      if (rows.length !== probeCount) throw new Error('outcome probe panel changed');
      return rows.flatMap((r) => {
        const n = r.w + r.l + r.t;
        if (!(n > 0)) throw new Error('outcome probes need completed rounds');
        return [r.w / n, r.t / n];
      });
    },
    cell(vector) {
      if (vector.length !== probeCount * 2 || vector.some((v) => !Number.isFinite(v))) throw new Error('invalid outcome descriptor');
      return `o${nearest(vector)}`;
    },
  };
}
