// Iterative diversity push-off, as the Core War Tournament Weekend ranks its
// entries: every warrior plays every other, then, again and again, each
// remaining warrior is scored by its average score times its diversity, and
// the lowest is pushed off. Diversity is the SD-score (Ismael, "The Standard
// Deviation Score", Journal of Big Data 12:58, 2025) to the most similar
// other warrior: the mean over opponents of |x_j - y_j| / sigma_j, where x and
// y are two warriors' scores against each opponent j and sigma_j is the
// standard deviation of everyone's scores against j. A warrior that scores
// like another one is worth less than one that wins its own way (Achille
// Astolfi's diversity scoring, with SD-score in place of Euclidean distance).
//
// One detail the announcement leaves open, and our reading of it: the score
// patterns compared are each warrior's scores against every warrior of the
// original field (so diversity stays meaningful down to the last few), while
// the average and the set of candidates shrink as warriors are pushed off.

// scores[i][j]: warrior i's points per round against warrior j (3 a win, 1 a
// tie). Returns the warriors in final order (first = winner), each with the
// average, diversity and score it had when it was pushed off (or at the end).
export function pushOff(scores, names) {
  const n = scores.length;
  const active = new Set(names.map((_, i) => i));
  const out = [];
  while (active.size) {
    const live = [...active];
    const stats = new Map();
    // Each opponent's spread of scores against it, over the whole field.
    const sigma = new Map();
    for (let j = 0; j < n; j++) {
      const col = names.map((_, i) => i).filter((i) => i !== j).map((i) => scores[i][j]);
      const mean = col.reduce((s, v) => s + v, 0) / (col.length || 1);
      sigma.set(j, Math.sqrt(col.reduce((s, v) => s + (v - mean) ** 2, 0) / (col.length || 1)));
    }
    const sd = (i, k) => {
      let sum = 0, cnt = 0;
      for (let j = 0; j < n; j++) {
        if (j === i || j === k || !(sigma.get(j) > 0)) continue;
        sum += Math.abs(scores[i][j] - scores[k][j]) / sigma.get(j);
        cnt++;
      }
      return cnt ? sum / cnt : 0;
    };
    for (const i of live) {
      const avg = live.length > 1 ? live.filter((j) => j !== i).reduce((s, j) => s + scores[i][j], 0) / (live.length - 1) : 0;
      const div = live.length > 1 ? Math.min(...live.filter((k) => k !== i).map((k) => sd(i, k))) : 0;
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
