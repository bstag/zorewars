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

const P_LINE = /^const P = (\{.*\});\s*$/m;

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

export async function tune({ pool, source, field, settings, candidates = 40, screenRounds = 10, checkRounds = 30, finalists = 6, onProgress = () => {} }) {
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
  const results = [];
  for (const t of check.filter(Boolean)) {
    const r = await evaluate(pool, build(t.P), field, { rounds: checkRounds, seed: 1001, settings });
    results.push({ ...t, score: r.score, smooth: r.smooth, groups: r.groups, rows: r.rows });
  }
  results.sort((a, b) => b.smooth - a.smooth);
  return { space, current, best: results[0], results, tried: tried.length, rejected };
}
