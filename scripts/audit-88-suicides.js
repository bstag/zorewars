// A repeatable solo and combat audit. Reports ownership-based "suicide"
// labels separately from long-run, unopposed deaths.
import fs from 'node:fs';
import path from 'node:path';
import { compile, measureSpecies, RULESETS, runMatch } from '../src/engine/index.js';
import { libraryOpponents } from '../tools/hill.js';

const args = process.argv.slice(2);
const option = (key, fallback) => { const i = args.indexOf(`--${key}`); return i < 0 ? fallback : args[i + 1]; };
const out = option('out', 'evolved/suicide-audit');
const directory = option('dir', 'examples/experimental-88');
const fieldDirectory = option('field-dir', directory);
const rounds = Number(option('rounds', 20));
const settings = { ...RULESETS['88'], maxLength: 50 };
const warriors = fs.readdirSync(directory).filter((f) => f.endsWith('.red')).map((file) => {
  const source = fs.readFileSync(path.join(directory, file), 'utf8');
  const w = compile(source, 'redcode', settings);
  if (!w.ok) throw new Error(`${file}: ${JSON.stringify(w.errors)}`);
  return { file, source, w };
});
const sparring = fs.readdirSync(fieldDirectory).filter((f) => f.endsWith('.red')).map((file) => {
  const w = compile(fs.readFileSync(path.join(fieldDirectory, file), 'utf8'), 'redcode', settings);
  if (!w.ok) throw new Error(`${file}: ${JSON.stringify(w.errors)}`);
  return { name: w.name, file, w };
});
const field = [...libraryOpponents(settings), ...sparring];
fs.mkdirSync(out, { recursive: true });
const results = [];
for (const mine of warriors) {
  const solo = measureSpecies(mine.w, { ...settings, maxCycles: 800000 });
  const summary = { file: mine.file, length: mine.w.instructions.length, soloSurvives: solo.survives,
    played: 0, wins: 0, losses: 0, ties: 0, flaggedSuicides: 0, flaggedAfterEnemyExecution: 0, causes: {}, examples: [] };
  for (const opponent of field) {
    for (const seed of [880050, 9753189]) {
      const m = runMatch([mine.w, opponent.w], { ...settings, rounds }, { seed, report: true });
      const s = m.warriors[0];
      summary.played += rounds; summary.wins += s.wins; summary.losses += s.losses; summary.ties += s.ties;
      for (const r of m.rounds) {
        const me = r.report.warriors[0];
        if (me.alive) continue;
        const death = me.lastDeath;
        summary.causes[death.cause] = (summary.causes[death.cause] ?? 0) + 1;
        if (death.cause === 'enemyCode') continue;
        summary.flaggedSuicides++;
        if (me.foreignSteps > 0) summary.flaggedAfterEnemyExecution++;
        if (!summary.examples.some((x) => x.opponent === opponent.name)) summary.examples.push({ opponent: opponent.name,
          opponentFile: opponent.file, seed, round: r.round, positions: r.positions, firstTurn: r.firstTurn,
          death, foreignSteps: me.foreignSteps, foreignFirst: me.foreignFirst,
          code: me.code, summary: r.report.summary });
      }
    }
  }
  summary.score = (3 * summary.wins + summary.ties) / summary.played;
  results.push(summary);
  fs.writeFileSync(path.join(out, mine.file), mine.source);
  console.log(JSON.stringify({ ...summary, examples: summary.examples.map(({ code, ...e }) => e) }));
}
fs.writeFileSync(path.join(out, 'audit.json'), JSON.stringify({ settings, rounds, results }, null, 2));
if (args.includes('--assert-solo') && results.some((x) => !x.soloSurvives)) process.exitCode = 1;
