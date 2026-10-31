// Developer tools for the CLI: hill, species, tune, refine and pushoff. Loaded only
// when one of these commands runs (they start worker threads).
//
// `h` holds helpers from zorewars.js: loadAll, settingsFrom, usage, printTable,
// expandRefs, libraryRefs.

import fs from 'node:fs';
import path from 'node:path';
import { measureSpecies, speciesAxes } from '../src/engine/index.js';
import { evaluate, strip } from '../tools/hill.js';
import { tune } from '../tools/tune.js';
import { refine, claudeProposer, DEFAULT_MODEL } from '../tools/refine.js';
import { battlePool, opponents, hillFiles, hillSettingsFor, progress, done } from './devtools-context.js';

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
  if (args._.length !== 1) h.usage('tune needs exactly one JavaScript warrior');
  const file = args._[0];
  if (!/\.js$/i.test(file) || !fs.existsSync(file)) h.usage('tune works on a JavaScript warrior file with a // SPACE comment and a const P = {...}; line');
  const settings = h.settingsFrom(args.flags);
  const json = !!args.flags.json;
  const source = fs.readFileSync(file, 'utf8');
  const [w] = await h.loadAll([file], settings, json);
  const field = await opponents(h, settings, args.flags, [w.name, path.basename(file)]);
  if (args.flags.hill) Object.assign(settings, hillSettingsFor(settings));
  const candidates = Math.max(1, parseInt(args.flags.candidates ?? '40', 10));
  const seeds = Math.max(1, parseInt(args.flags.seeds ?? '3', 10));
  const pool = await battlePool(args.flags, h);
  try {
    const r = await tune({ pool, source, field, settings, candidates, seeds, onProgress: (i, n) => progress(json, i <= candidates + 1 ? `Screening candidate ${i}/${candidates + 1}…` : `Checking finalists on ${seeds} fresh seeds (${i}/${n})…`) });
    done(json);
    const write = args.flags.write && r.improved;
    if (write) fs.writeFileSync(file, source.replace(/^const P = \{.*\};[ \t]*$/m, `const P = ${JSON.stringify(r.best.P)};`));
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

// refine: a language model reads the warrior's post-mortems and proposes
// rewrites; one is kept only if it beats the current version on fresh seeds.
export async function cmdRefine(args, h) {
  if (args._.length !== 1) h.usage('refine needs exactly one Redcode warrior');
  const file = args._[0];
  if (!/\.(red|rc)$/i.test(file) || !fs.existsSync(file)) h.usage('refine works on a Redcode file (convert a generator first with: zorewars compile <file>)');
  const settings = h.settingsFrom(args.flags);
  const json = !!args.flags.json;
  const integer = (key, fallback) => {
    const n = Number(args.flags[key] ?? fallback);
    if (!Number.isInteger(n) || n < 1) h.usage(`--${key} must be a positive integer`);
    return n;
  };
  const iterations = integer('iterations', 3), variants = integer('variants', 4), rounds = integer('rounds', 20);
  const effort = args.flags.effort ?? 'high';
  const objective = args.flags.objective ?? 'points';
  if (!['points', 'pushoff'].includes(objective)) h.usage('--objective takes points or pushoff');
  // The push-off ranks against a hill: by default the Koenigstuhl hill of the --rules set.
  const KOENIGSTUHL_HILLS = { '94nop': '94nop', 88: '88', lp: 'lp', '94x': '94x' };
  if (objective === 'pushoff' && !args.flags.hill) {
    const hill = KOENIGSTUHL_HILLS[args.flags.rules];
    if (!hill) h.usage('--objective pushoff needs --hill, or --rules 94nop|88|lp|94x to use that Koenigstuhl hill');
    args.flags.hill = `koenigstuhl:${hill}`;
    args.flags.top ??= '30';
  }
  // A push-off check has one sample per seed, so it needs more seeds than a points check.
  const checkRounds = integer('check-rounds', 30), seeds = integer('seeds', objective === 'pushoff' ? 6 : 3), seed = integer('seed', 1);
  const turns = integer('turns', 20);
  const budget = Number(args.flags.budget ?? 5);
  if (!Number.isFinite(budget) || budget <= 0) h.usage('--budget takes a number of dollars');
  const model = args.flags.model ?? DEFAULT_MODEL;
  if (!['low', 'medium', 'high', 'xhigh', 'max'].includes(effort)) h.usage('--effort takes low, medium, high, xhigh or max');
  const source = fs.readFileSync(file, 'utf8');
  const [w] = await h.loadAll([file], settings, json);
  const entrySettings = { ...settings };
  const field = await opponents(h, settings, args.flags, [w.name, path.basename(file)]);
  // --partner b.red: our other entry, ranked beside each candidate (--objective pushoff).
  const partners = args.flags.partner ? await h.loadAll(h.expandRefs(String(args.flags.partner).split(',')), entrySettings, json) : [];
  if (partners.length && objective !== 'pushoff') h.usage('--partner needs --objective pushoff');
  if (args.flags.hill) Object.assign(settings, hillSettingsFor(settings));
  const out = args.flags.out ?? path.join('refined', path.basename(file));
  // The API key may live in a .env file beside the project (never committed).
  if (typeof process.loadEnvFile === 'function' && fs.existsSync('.env')) process.loadEnvFile('.env');
  const propose = await claudeProposer({ model, effort, turns });
  const pool = await battlePool(args.flags, h);
  try {
    const r = await refine({ pool, source, field, settings, entrySettings, propose, iterations, variants, rounds, checkRounds, seeds, seed, model, turns, budget,
      objective, partners: partners.map(strip), fieldRounds: integer('field-rounds', 50),
      onProgress: (t) => progress(json, t) });
    done(json);
    fs.mkdirSync(path.dirname(out) || '.', { recursive: true });
    fs.writeFileSync(out, r.source);
    fs.writeFileSync(out.replace(/\.(red|rc)$/i, '') + '.refine.json', JSON.stringify(r, null, 1));
    if (json) { console.log(JSON.stringify({ ok: true, out, ...r, source: undefined }, null, 2)); return; }
    console.log(`Refined ${w.name} against ${field.length} opponents: ${iterations} iterations of ${variants} rewrites each.
`);
    for (const e of r.log) {
      if (e.error) { console.log(`iteration ${e.iteration}: stopped: ${e.error}`); continue; }
      console.log(`iteration ${e.iteration}: current ${e.text}, worst against ${e.worst.join(', ') || 'nobody'}; the model took ${e.turns} turns (${e.calls.check} checks, ${e.calls.battle} battles, ${e.calls.score} field scores)`);
      for (const v of e.variants) console.log(`  ${v.text}  ${v.idea}`);
      if (e.check) console.log(`  fresh seeds: ${e.check.gain >= 0 ? '+' : ''}${e.check.gain.toFixed(3)} ± ${e.check.margin.toFixed(3)} ${r.objective === 'pushoff' ? 'places' : 'pts/round'} -> ${e.kept ? 'kept' : 'within the noise, not kept'}`);
    }
    console.log(`
${r.improved ? `Improved (${r.idea})` : 'No rewrite beat the starting warrior by more than the noise'} -> ${out}`);
    console.log(`Model tokens${r.cost !== null ? ` (about $${r.cost.toFixed(2)} of a $${budget.toFixed(2)} budget)` : ''}: ${r.usage.input_tokens} in, ${r.usage.cache_read_input_tokens} read from the cache, ${r.usage.cache_creation_input_tokens} written to it, ${r.usage.output_tokens} out.`);
  } finally { pool.close(); }
}

// ---- pushoff: where would these entries place in a tournament? ----
// The Core War Tournament Weekend adds entries to the top of a Koenigstuhl
// hill and ranks everyone by an iterative diversity push-off (tools/pushoff.js).
// Hill warriors are fetched on demand into a temporary cache (not this repo),
// as the Hall of Fame classics are.
export async function cmdPushoff(args, h) {
  const { roundRobin, pushOff } = await import('../tools/pushoff.js');
  const { compile } = await import('../src/engine/index.js');
  const json = !!args.flags.json;
  const settings = h.settingsFrom(args.flags);
  // The runner's rule by default; --rule announcement takes the older readings
  // of the announcement (see src/engine/pushoff.js).
  const rule = args.flags.rule ?? 'official';
  if (!['official', 'announcement'].includes(rule)) h.usage('pushoff --rule official|announcement');
  const variant = rule === 'official' ? { rule } : { features: args.flags.features ?? 'points', metric: args.flags.metric ?? 'sd', self: !!args.flags.self, field: args.flags.field ?? 'original' };
  const show = (all, scores, results) => {
    const ranked = pushOff(scores, all.map((x) => x.name), { ...variant, results }).map((r) => ({ ...r, entry: all[r.index].entry }));
    if (json) { console.log(JSON.stringify({ ok: true, variant, ranking: ranked.map(({ index, ...r }) => r) }, null, 2)); return; }
    h.printTable(ranked.slice(0, 25).concat(ranked.filter((r) => r.entry && r.rank > 25)).map((r) => ({
      Rank: r.rank, Warrior: `${r.entry ? '★ ' : ''}${r.name}`, 'Avg pts': r.avg.toFixed(2), Diversity: r.div.toFixed(2), Score: r.score.toFixed(2),
    })));
    for (const r of ranked.filter((x) => x.entry)) console.log(`\n★ ${r.name}: rank ${r.rank} of ${ranked.length}`);
  };
  // --load results.json: rank games saved earlier (--save) under another reading.
  if (args.flags.load) {
    const saved = JSON.parse(fs.readFileSync(String(args.flags.load), 'utf8'));
    show(saved.warriors, saved.scores, saved.results);
    return;
  }
  if (!args._.length || !args.flags.hill) h.usage('pushoff <entry...> --hill koenigstuhl:94nop|88|lp|94x (or a folder) [--rules NAME] [--length 50] [--top 50] [--rounds 50] [--rule official|announcement] [--features points|wlt|wl] [--metric sd|eq6|euclid] [--self] [--field original|current] [--save file] | pushoff --load file');
  const entries = await h.loadAll(h.expandRefs(args._), settings, json);
  const hillSettings = hillSettingsFor(settings);
  const top = Math.max(2, parseInt(args.flags.top ?? '50', 10));
  const files = await hillFiles(String(args.flags.hill), top, json);
  const hill = [];
  for (const f of files) {
    const w = compile(fs.readFileSync(f, 'utf8'), 'redcode', hillSettings);
    if (w.ok) hill.push(w); else if (!json) console.error(`(skipped ${path.basename(f)}: ${w.errors[0].message})`);
  }
  const all = [...entries.map((w) => ({ w, entry: true })), ...hill.map((w) => ({ w, entry: false }))];
  const rounds = Math.max(2, parseInt(args.flags.rounds ?? '50', 10));
  if (!json) console.log(`Push-off: ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} + ${hill.length} hill warriors, ${rounds} rounds a pair (core ${settings.coreSize}, ${settings.maxProcesses} processes, ${settings.maxCycles} cycles)\n`);
  const pool = await battlePool(args.flags, h);
  try {
    const seed = parseInt(args.flags.seed ?? '1', 10);
    const { scores, results } = await roundRobin(pool, all.map((x) => strip(x.w)), { rounds, seed, settings: hillSettings, self: variant.self || !!args.flags.save, onProgress: (i, n) => progress(json, `round robin: ${i}/${n}`) });
    done(json);
    const warriors = all.map((x) => ({ name: x.w.name, entry: x.entry }));
    // --save: keep every result (self-fights too) to rank again with --load.
    if (args.flags.save) fs.writeFileSync(String(args.flags.save), JSON.stringify({ rounds, settings: { coreSize: settings.coreSize, maxProcesses: settings.maxProcesses, maxCycles: settings.maxCycles, maxLength: settings.maxLength }, warriors, scores, results }));
    show(warriors, scores, results);
  } finally { pool.close(); }
}
