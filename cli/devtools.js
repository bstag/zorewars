// Developer tools for the CLI: hill, species, tune, refine and pushoff. Loaded only
// when one of these commands runs (they start worker threads).
//
// `h` holds helpers from zorewars.js: loadAll, settingsFrom, usage, printTable,
// expandRefs, libraryRefs.

import fs from 'node:fs';
import path from 'node:path';
import { measureSpecies, speciesAxes } from '../src/engine/index.js';
import { evaluate, strip } from '../tools/hill.js';
import { tune, withConstants } from '../tools/tune.js';
import { tuneOptions } from './search-options.js';
export { cmdRefine } from './refinement.js';
export { cmdPushoff } from './pushoff.js';
import { battlePool, opponents, hillSettingsFor, progress, done } from './devtools-context.js';

// Retain these commands for callers of the former combined command module.
export async function cmdEvolve(...args) { return (await import('./evolution.js')).cmdEvolve(...args); }
export async function cmdTrain(...args) { return (await import('./evolution.js')).cmdTrain(...args); }

const SYMPTOMS = {
  tie: 'ties (both alive at the end: no kill power)',
  converted: 'stunned or captured (died after running enemy code)',
  early: 'found fast (killed before cycle 5000)',
  late: 'worn down (killed later)',
  suicide: 'own goals (its own code, empty core or divide by zero)',
};
function symptomLines(sym) {
  const total = Object.values(sym).reduce((a, b) => a + b, 0);
  if (!total) return ['  It won every round.'];
  return Object.entries(sym).filter(([, n]) => n).sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `  ${String(Math.round((100 * n) / total)).padStart(3)}%  ${SYMPTOMS[k]}`);
}

export async function cmdHill(args, h) {
  if (args._.length !== 1) h.usage('hill needs exactly one warrior');
  const settings = h.settingsFrom(args.flags, { rounds: 20 });
  const json = !!args.flags.json;
  const [w] = await h.loadAll(args._, settings, json);
  const field = await opponents(h, settings, args.flags, [w.name, path.basename(w.file)]);
  if (args.flags.hill) Object.assign(settings, hillSettingsFor(settings));
  const pool = await battlePool(args.flags, h);
  try {
    progress(json, `Playing ${field.length} opponents, ${settings.rounds} rounds each…`);
    const r = await evaluate(pool, w, field, { rounds: settings.rounds, seed: parseInt(args.flags.seed ?? '1', 10), settings, diagnose: true });
    done(json);
    if (json) {
      console.log(JSON.stringify({ ok: true, warrior: w.name, rounds: settings.rounds, score: r.score, smooth: r.smooth, groups: r.groups, symptoms: r.symptoms, opponents: r.rows }, null, 2));
      return;
    }
    console.log(`Hill: ${w.name} against ${field.length} opponents, ${settings.rounds} rounds each\n`);
    h.printTable([...r.rows].sort((a, b) => a.pts - b.pts).map((x) => ({
      Opponent: x.name, Group: x.group, Wins: x.w, Losses: x.l, Ties: x.t, 'Pts/round': x.pts.toFixed(2), Smooth: x.smooth.toFixed(2),
    })));
    console.log('');
    for (const [g, s] of Object.entries(r.groups)) console.log(`  ${g.padEnd(8)} ${s.score.toFixed(2)} pts/round  (smooth ${s.smooth.toFixed(2)}, ${s.opponents} opponents)`);
    console.log(`  ${'overall'.padEnd(8)} ${r.score.toFixed(2)} pts/round  (smooth ${r.smooth.toFixed(2)})\n`);
    console.log('Rounds it did not win:');
    for (const l of symptomLines(r.symptoms)) console.log(l);
    if (!args.flags.classics) console.log('\nAdd --classics to also play the Hall of Fame originals.');
  } finally { pool.close(); }
}

export async function cmdSpecies(args, h) {
  const settings = h.settingsFrom(args.flags);
  const json = !!args.flags.json;
  const refs = args._.length ? h.expandRefs(args._) : h.libraryRefs(settings);
  const warriors = await h.loadAll(refs, settings, json);
  const axes = speciesAxes(settings);
  const rows = warriors.map((w) => ({ name: w.name, file: w.file, ...measureSpecies(w, settings) }));
  if (json) { console.log(JSON.stringify({ ok: true, axes, warriors: rows }, null, 2)); return; }
  h.printTable(rows.map((r) => ({
    Warrior: r.name, Processes: r.processes, 'Cells run': r.coverage,
    Cell: `${axes.processes.labels[r.cell[0]]} x ${axes.coverage.labels[r.cell[1]]}`, 'Usually': r.survives ? r.hint : 'kills itself when alone',
  })));
  // The map itself: columns are process counts, rows are cells executed.
  const P = axes.processes.labels.length, C = axes.coverage.labels.length;
  const width = 12;
  console.log(`\nSpecies map (columns: most processes at once; rows: different cells executed)\n`);
  console.log(`${''.padEnd(10)}${axes.processes.labels.map((l) => l.padEnd(width)).join('')}`);
  for (let c = C - 1; c >= 0; c--) {
    const cells = Array.from({ length: P }, (_, p) => rows.filter((r) => r.cell[0] === p && r.cell[1] === c));
    const lines = Math.max(1, ...cells.map((x) => x.length));
    for (let k = 0; k < lines; k++) {
      const label = k === 0 ? axes.coverage.labels[c] : '';
      console.log(`${label.padEnd(10)}${cells.map((x) => (x[k] ? x[k].name.slice(0, width - 2) : k === 0 ? '·' : '').padEnd(width)).join('')}`);
    }
  }
}

export async function cmdTune(args, h) {
  const { file, json, candidates, seeds } = tuneOptions(args, h.usage);
  const settings = h.settingsFrom(args.flags);
  const source = fs.readFileSync(file, 'utf8');
  const [w] = await h.loadAll([file], settings, json);
  const field = await opponents(h, settings, args.flags, [w.name, path.basename(file)]);
  if (args.flags.hill) Object.assign(settings, hillSettingsFor(settings));
  const pool = await battlePool(args.flags, h);
  try {
    const r = await tune({ pool, source, field, settings, candidates, seeds, onProgress: (i, n) => progress(json, i <= candidates + 1 ? `Screening candidate ${i}/${candidates + 1}…` : `Checking finalists on ${seeds} fresh seeds (${i}/${n})…`) });
    done(json);
    const write = args.flags.write && r.improved;
    if (write) fs.writeFileSync(file, withConstants(source, r.best.P));
    if (json) { console.log(JSON.stringify({ ok: true, space: r.space, current: r.current, best: r.best.P, improved: r.improved, seeds: r.seeds, results: r.results.map(({ rows, ...x }) => x), written: !!write }, null, 2)); return; }
    console.log(`Tuned ${w.name}: ${r.tried} candidates screened against ${field.length} opponents${r.rejected ? ` (${r.rejected} refused by the warrior's own checks)` : ''}.`);
    console.log(`Finalists re-checked on ${r.seeds.length} fresh seeds x ${r.checkRounds} rounds; gains are against the current constants, opponent by opponent.\n`);
    h.printTable(r.results.map((x) => ({
      Constants: JSON.stringify(x.P) + (x.current ? '  (current)' : ''), 'Pts/round': x.score.toFixed(2), Smooth: x.smooth.toFixed(2),
      Gain: x.current ? '' : `${x.gain >= 0 ? '+' : ''}${x.gain.toFixed(3)} ± ${x.margin.toFixed(3)}${x.significant ? '  *' : ''}`,
    })));
    if (!r.improved) console.log('\nNo finalist beats the current constants by more than the noise (* would mark one). Keeping them.');
    else {
      console.log(`\nBest: const P = ${JSON.stringify(r.best.P)};`);
      console.log(`(+${r.best.gain.toFixed(3)} ± ${r.best.margin.toFixed(3)} smooth points per round over the current constants: more than the noise)`);
      console.log(write ? `Written to ${file}.` : 'Run again with --write to save it into the file.');
    }
  } finally { pool.close(); }
}
