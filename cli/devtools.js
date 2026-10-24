// Developer tools for the CLI: hill, species, tune and evolve. Loaded only
// when one of these commands runs (they start worker threads).
//
// `h` holds helpers from zorewars.js: loadAll, settingsFrom, usage, printTable,
// expandRefs, libraryRefs.

import fs from 'node:fs';
import path from 'node:path';
import { measureSpecies, speciesAxes } from '../src/engine/index.js';
import { createPool, libraryOpponents, classicOpponents, evaluate, strip } from '../tools/hill.js';
import { tune } from '../tools/tune.js';
import { evolve } from '../tools/evolve.js';
import { roleOf, toRedcode } from '../tools/genes.js';

const SYMPTOMS = {
  tie: 'ties (both alive at the end: no kill power)',
  converted: 'stunned or captured (died after running enemy code)',
  early: 'found fast (killed before cycle 5000)',
  late: 'worn down (killed later)',
  suicide: 'own goals (its own code, empty core or divide by zero)',
};
const progress = (json, text) => { if (!json && process.stderr.isTTY) process.stderr.write(`\r${text}\x1b[K`); };
const done = (json) => { if (!json && process.stderr.isTTY) process.stderr.write('\r\x1b[K'); };

async function opponents(h, settings, flags, exclude) {
  const json = !!flags.json;
  const field = libraryOpponents(settings, { exclude });
  if (flags.classics) {
    progress(json, 'Fetching the Hall of Fame classics from the public archives…');
    const missing = [];
    field.push(...await classicOpponents(settings, { onError: (name) => missing.push(name) }));
    done(json);
    if (missing.length && !json) console.error(`(could not load ${missing.length} classic${missing.length === 1 ? '' : 's'}: ${missing.join(', ')})`);
  }
  return field;
}

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
  const pool = createPool();
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
  const refs = args._.length ? h.expandRefs(args._) : h.libraryRefs();
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
  const candidates = Math.max(1, parseInt(args.flags.candidates ?? '40', 10));
  const pool = createPool();
  try {
    const r = await tune({ pool, source, field, settings, candidates, onProgress: (i, n) => progress(json, `Screening candidate ${i}/${n}…`) });
    done(json);
    const cur = r.results.find((x) => x.current);
    if (args.flags.write && !r.best.current) {
      fs.writeFileSync(file, source.replace(/^const P = \{.*\};\s*$/m, `const P = ${JSON.stringify(r.best.P)};`));
    }
    if (json) { console.log(JSON.stringify({ ok: true, space: r.space, current: r.current, best: r.best.P, results: r.results.map(({ rows, ...x }) => x), written: !!args.flags.write && !r.best.current }, null, 2)); return; }
    console.log(`Tuned ${w.name}: ${r.tried} candidates screened against ${field.length} opponents${r.rejected ? ` (${r.rejected} refused by the warrior's own checks)` : ''}\n`);
    h.printTable(r.results.map((x) => ({ Constants: JSON.stringify(x.P) + (x.current ? '  (current)' : ''), 'Pts/round': x.score.toFixed(2), Smooth: x.smooth.toFixed(2) })));
    if (r.best.current) console.log('\nThe current constants are still the best found.');
    else {
      console.log(`\nBest: const P = ${JSON.stringify(r.best.P)};`);
      if (cur) console.log(`(${(r.best.smooth - cur.smooth >= 0 ? '+' : '') + (r.best.smooth - cur.smooth).toFixed(2)} smooth points per round over the current constants)`);
      console.log(args.flags.write ? `Written to ${file}.` : 'Run again with --write to save it into the file.');
    }
  } finally { pool.close(); }
}

export async function cmdEvolve(args, h) {
  const settings = h.settingsFrom(args.flags);
  const json = !!args.flags.json;
  const generations = Math.max(1, parseInt(args.flags.generations ?? '6', 10));
  const batches = Math.max(1, parseInt(args.flags.batches ?? '4', 10));
  const batchSize = Math.max(4, parseInt(args.flags.batch ?? '40', 10));
  const out = args.flags.out ?? 'evolved';
  // Gene pool and starting opponents: the library, plus any warriors given.
  const field = libraryOpponents(settings);
  const extra = args._.length ? await h.loadAll(h.expandRefs(args._), settings, json) : [];
  const sources = [
    ...field.map((o) => ({ w: o.w, role: roleOf(`${o.category} ${o.name}`) })),
    ...extra.map((w) => ({ w: strip(w), role: roleOf(`${w.name} ${w.strategy || ''}`) || 'paper' })),
  ];
  const heldOut = args.flags.classics ? await opponents(h, settings, { ...args.flags, classics: true }, []).then((f) => f.filter((x) => x.group === 'classic')) : [];
  fs.mkdirSync(out, { recursive: true });
  const pool = createPool();
  try {
    if (!json) console.log(`Evolving: ${generations} Red Queen generations, ${batches}x${batchSize} children each, ${sources.length} warriors in the gene pool${heldOut.length ? `, ${heldOut.length} classics held out` : ''}\n`);
    const r = await evolve({
      pool, sources, opponents: field, heldOut, settings, rounds: generations, batches, batchSize,
      maxLength: Math.min(settings.maxLength, 40),
      onLog: (t) => progress(json, t),
      onRound: (rec) => {
        done(json);
        const c = rec.champion;
        const file = path.join(out, `redqueen-${rec.round}.red`);
        fs.writeFileSync(file, toRedcode(c.g, { name: c.name, coreSize: settings.coreSize, strategy: `Champion of Red Queen generation ${rec.round} (zorewars evolve): ${c.species.hint}, ${c.species.processes} processes, ${c.species.coverage} cells.` }));
        if (json) return;
        const vs = c.vsAncestors ? ` | vs ancestors ${(c.vsAncestors.reduce((s, x) => s + x.pts, 0) / c.vsAncestors.length).toFixed(2)} pts/round` : '';
        const held = c.heldOut ? ` | held-out classics ${c.heldOut.score.toFixed(2)}` : '';
        console.log(`generation ${rec.round}: ${rec.cells} species cells (${rec.placed} improved) | champion fitness ${c.fit.toFixed(2)}, ${c.species.hint}, ${c.g.code.length} instructions${vs}${held}  -> ${file}`);
      },
    });
    for (const x of r.archive) {
      const [p, c] = x.cell.split(',');
      fs.writeFileSync(path.join(out, `elite-p${p}-c${c}.red`), toRedcode(x.g, { name: `Elite p${p} c${c}`, coreSize: settings.coreSize, strategy: `Best evolved ${x.species.hint} (${x.species.processes} processes, ${x.species.coverage} cells), zorewars evolve.` }));
    }
    fs.writeFileSync(path.join(out, 'evolve.json'), JSON.stringify(r, null, 1));
    if (json) { console.log(JSON.stringify({ ok: true, out, champions: r.champions.map(({ w, ...c }) => c), archive: r.archive, operators: r.operators }, null, 2)); return; }
    console.log(`\nFinal archive: ${r.archive.length} species, best first`);
    h.printTable(r.archive.slice(0, 12).map((x) => ({ Cell: x.cell, Usually: x.species.hint, Processes: x.species.processes, 'Cells run': x.species.coverage, Length: x.g.code.length, Fitness: x.fit.toFixed(2) })));
    console.log(`\nWritten to ${out}/: redqueen-N.red (each generation's champion), elite-pP-cC.red (best of each species), evolve.json.`);
    console.log(`Try one: zorewars hill ${out}/redqueen-${generations}.red --classics`);
  } finally { pool.close(); }
}
