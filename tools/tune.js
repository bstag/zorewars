// Random-search tuner for JavaScript warriors with tunable constants.
//
// The warrior declares its constants and the range of each:
//   // SPACE {"STEP":[4,40],"GAP":[2,20]}      ranges (integers), or lists of choices
//   const P = {"STEP":24,"GAP":8};
// The tuner rewrites the `const P = ...;` line with random values from SPACE,
// screens every candidate with a few rounds, re-checks the best few with more
// rounds on fresh seeds (so a lucky draw isn't kept), and reports the best.

import { compile } from '../src/engine/index.js';
import { evaluate } from './hill.js';

const P_LINE = /^const P = (\{.*\});[ \t]*$/m;   // [ \t]*, not \s*: keep the line break and any blank line after it

export function parseTunable(source) {
  const space = /\/\/ SPACE (\{.*\})/.exec(source);
  const p = P_LINE.exec(source);
  if (!space) throw new Error('no "// SPACE {...}" comment: declare the ranges to search, e.g. // SPACE {"STEP":[4,40]}');
  if (!p) throw new Error('no "const P = {...};" line holding the current constants');
  return { space: JSON.parse(space[1]), current: JSON.parse(p[1]) };
}

export const withConstants = (source, P) => source.replace(P_LINE, `const P = ${JSON.stringify(P)};`);

function sample(space) {
  return Object.fromEntries(Object.entries(space).map(([k, v]) => {
    if (Array.isArray(v) && v.length === 2 && v.every(Number.isInteger)) return [k, v[0] + Math.floor(Math.random() * (v[1] - v[0] + 1))];
    if (Array.isArray(v)) return [k, v[Math.floor(Math.random() * v.length)]];
    return [k, v];
  }));
}

// Screening picks the best of many noisy samples, so its winner is usually
// partly luck. The check stage therefore re-runs the finalists and the
// current constants on fresh seeds (the same seeds, so the same load
// positions, for everyone) and compares each finalist with the current
// constants opponent by opponent and seed by seed. A finalist only counts as
// an improvement if its mean gain is more than Z standard errors above zero.
const Z = 2.5;   // a little stricter than 2, because several finalists are compared

// Mean of paired differences (same opponent, same seed) and its margin: a
// candidate is a real improvement if gain - margin > 0.
export function pairedGain(samples, base, z = Z) {
  const d = samples.map((x, k) => x - base[k]);
  const m = d.reduce((s, x) => s + x, 0) / d.length;
  const sd = Math.sqrt(d.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, d.length - 1));
  return { gain: m, margin: (z * sd) / Math.sqrt(d.length) };
}

export async function tune({ pool, source, field, settings, candidates = 40, screenRounds = 10, checkRounds = 20, seeds = 3, finalists = 6, onProgress = () => {} }) {
  const { space, current } = parseTunable(source);
  const build = (P) => compile(withConstants(source, P), 'javascript', settings);
  const tried = [];
  const all = [current, ...Array.from({ length: candidates }, () => ({ ...current, ...sample(space) }))];
  let rejected = 0;
  for (const [i, P] of all.entries()) {
    const w = build(P);
    if (!w.ok) { rejected++; continue; }                // e.g. the warrior's own checks refuse these values
    const r = await evaluate(pool, w, field, { rounds: screenRounds, seed: 1, settings });
    tried.push({ P, screen: r.smooth, current: i === 0 });
    onProgress(i + 1, all.length);
  }
  if (!tried.length) throw new Error('no candidate compiled');
  tried.sort((a, b) => b.screen - a.screen);
  // Re-check the best (and the current values, for comparison) on fresh seeds.
  const check = tried.slice(0, finalists);
  if (!check.some((t) => t.current)) check.push(tried.find((t) => t.current));
  const seedList = Array.from({ length: Math.max(1, seeds) }, (_, i) => 1001 + i * 1000);
  const results = [];
  for (const [i, t] of check.filter(Boolean).entries()) {
    const w = build(t.P);
    const runs = [];
    for (const seed of seedList) runs.push(await evaluate(pool, w, field, { rounds: checkRounds, seed, settings }));
    const mean = (k) => runs.reduce((s, r) => s + r[k], 0) / runs.length;
    results.push({ ...t, score: mean('score'), smooth: mean('smooth'), samples: runs.flatMap((r) => r.rows.map((x) => x.smooth)), rows: runs[0].rows });
    onProgress(all.length + i + 1, all.length + check.length);
  }
  // Paired differences against the current constants: same opponent, same seed.
  const base = results.find((r) => r.current);
  const baseSamples = base.samples;
  for (const r of results) {
    Object.assign(r, pairedGain(r.samples, baseSamples));   // gain ± margin
    r.significant = !r.current && r.gain - r.margin > 0;
    delete r.samples;
  }
  results.sort((a, b) => b.smooth - a.smooth);
  // The recommendation: the best finalist that clearly beats the current
  // constants; otherwise keep the current ones.
  const better = results.filter((r) => r.significant).sort((a, b) => b.gain - a.gain)[0];
  return { space, current, best: better ?? base, improved: !!better, results, tried: tried.length, rejected, seeds: seedList, checkRounds };
}
