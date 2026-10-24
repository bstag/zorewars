#!/usr/bin/env node
// Plays every in-process library warrior against every other and writes
// warriors/benchmarks.json, which the encyclopedia page displays.
//   node scripts/benchmark.js [--rounds 100] [--seed 1]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, runMatch, DEFAULT_SETTINGS } from '../src/engine/index.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const argv = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? parseInt(argv[i + 1], 10) : def;
};
const rounds = flag('rounds', 100);
const seed = flag('seed', 1);

const list = JSON.parse(fs.readFileSync(path.join(ROOT, 'warriors', 'index.json'), 'utf8'))
  .filter((e) => (e.language === 'redcode' || e.language === 'javascript') && e.benchmark !== false);
const warriors = list.map((e) => {
  const w = compile(fs.readFileSync(path.join(ROOT, 'warriors', e.file), 'utf8'), e.language);
  if (!w.ok) throw new Error(`${e.file}: ${JSON.stringify(w.errors)}`);
  return { file: e.file, w };
});

const results = {};
for (const { file } of warriors) results[file] = { vs: {}, wins: 0, losses: 0, ties: 0, score: 0, played: 0 };

for (let i = 0; i < warriors.length; i++) {
  for (let j = i + 1; j < warriors.length; j++) {
    const a = warriors[i], b = warriors[j];
    const m = runMatch([a.w, b.w], { ...DEFAULT_SETTINGS, rounds }, { seed: seed + i * 1000 + j });
    const [sa, sb] = m.warriors;
    results[a.file].vs[b.file] = { w: sa.wins, l: sa.losses, t: sa.ties };
    results[b.file].vs[a.file] = { w: sb.wins, l: sb.losses, t: sb.ties };
    for (const [f, s] of [[a.file, sa], [b.file, sb]]) {
      const r = results[f];
      r.wins += s.wins; r.losses += s.losses; r.ties += s.ties; r.score += s.score; r.played += rounds;
    }
    process.stderr.write('.');
  }
}
process.stderr.write('\n');

const ranking = Object.entries(results)
  .map(([file, r]) => ({ file, scorePerRound: +(r.score / r.played).toFixed(3) }))
  .sort((x, y) => y.scorePerRound - x.scorePerRound)
  .map((x, i) => ({ ...x, rank: i + 1 }));

const out = { generated: new Date().toISOString().slice(0, 10), rounds, seed, ranking, results };
fs.writeFileSync(path.join(ROOT, 'warriors', 'benchmarks.json'), JSON.stringify(out, null, 1) + '\n');
for (const r of ranking) console.log(`${String(r.rank).padStart(3)}. ${r.file.padEnd(18)} ${r.scorePerRound.toFixed(2)} pts/round`);
