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
import { makeGeometry } from '../src/engine/geometry.js';

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
  // --hill koenigstuhl:94nop (or a folder): train against a real hill's top
  // warriors instead of the library.
  const field = flags.hill ? await hillOpponents(String(flags.hill), settings, flags) : libraryOpponents(settings, { exclude });
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
  if (args.flags.hill) Object.assign(settings, hillSettingsFor(settings));
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
  const pool = createPool();
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

export async function cmdEvolve(args, h) {
  const settings = h.settingsFrom(args.flags);
  const json = !!args.flags.json;
  const generations = Math.max(1, parseInt(args.flags.generations ?? '6', 10));
  const batches = Math.max(1, parseInt(args.flags.batches ?? '4', 10));
  const batchSize = Math.max(4, parseInt(args.flags.batch ?? '40', 10));
  const out = args.flags.out ?? 'evolved';
  // Gene pool and starting opponents: the library, plus any warriors given.
  // --scratch: none of that. Random programs, scored only against each
  // other's champions; the library is only held out, to report progress.
  const scratch = !!args.flags.scratch;
  const library = libraryOpponents(settings);
  const hill = args.flags.hill ? await hillOpponents(String(args.flags.hill), settings, args.flags) : null;
  const field = scratch ? [] : hill ?? library;
  const extra = args._.length ? await h.loadAll(h.expandRefs(args._), settings, json) : [];
  const sources = [
    ...(scratch ? [] : library).map((o) => ({ w: o.w, role: roleOf(`${o.category} ${o.name}`) })),
    ...extra.map((w) => ({ w: strip(w), role: roleOf(`${w.name} ${w.strategy || ''}`) || 'paper' })),
  ];
  const classics = args.flags.classics ? await opponents(h, settings, { ...args.flags, classics: true }, []).then((f) => f.filter((x) => x.group === 'classic')) : [];
  const heldOut = scratch ? [...library, ...classics] : classics;
  // --king a.js,b.red: start the Red Queen with these as champions (they
  // also join the gene pool and the starting population).
  const kings = args.flags.king ? await h.loadAll(h.expandRefs(String(args.flags.king).split(',')), settings, json) : [];
  for (const w of kings) sources.push({ w: strip(w), role: roleOf(`${w.name} ${w.strategy || ''}`) || 'paper' });
  const maxLength = Math.min(settings.maxLength, Math.max(4, parseInt(args.flags.genome ?? '40', 10)));
  if (hill) Object.assign(settings, hillSettingsFor(settings));   // genomes keep the entry limit above
  fs.mkdirSync(out, { recursive: true });
  const pool = createPool();
  try {
    if (!json) console.log(`Evolving${scratch ? ' from scratch' : ''}: ${generations} Red Queen generations, ${batches}x${batchSize} children each, ${scratch ? 'random programs, no gene pool' : `${sources.length} warriors in the gene pool`}, genomes up to ${maxLength} instructions${kings.length ? `, starting champions: ${kings.map((k) => k.name).join(', ')}` : ''}${heldOut.length ? `, ${heldOut.length} ${scratch ? 'library warriors and classics' : 'classics'} held out` : ''}\n`);
    const geo = settings.topology === 'torus' && (settings.sizeY ?? 1) > 1 ? makeGeometry(settings) : null;
    const r = await evolve({
      pool, sources, opponents: field, heldOut, settings, rounds: generations, batches, batchSize,
      maxLength, kings, scratch,
      tieValue: Math.min(1, Math.max(0, parseFloat(args.flags.ties ?? '0.5'))),
      onLog: (t) => progress(json, t),
      onRound: (rec) => {
        done(json);
        const c = rec.champion;
        const file = path.join(out, `redqueen-${rec.round}.red`);
        fs.writeFileSync(file, toRedcode(c.g, { name: c.name, coreSize: settings.coreSize, geo, strategy: `Champion of Red Queen generation ${rec.round} (zorewars evolve): ${c.species.hint}, ${c.species.processes} processes, ${c.species.coverage} cells.` }));
        if (json) return;
        const vs = c.vsAncestors ? ` | vs ancestors ${(c.vsAncestors.reduce((s, x) => s + x.pts, 0) / c.vsAncestors.length).toFixed(2)} pts/round` : '';
        const held = c.heldOut ? ` | held-out ${scratch ? 'library' : 'classics'} ${c.heldOut.score.toFixed(2)}` : '';
        console.log(`generation ${rec.round}: ${rec.cells} species cells (${rec.placed} improved) | champion fitness ${c.fit.toFixed(2)}, ${c.species.hint}, ${c.g.code.length} instructions${vs}${held}  -> ${file}`);
      },
    });
    for (const x of r.archive) {
      const [p, c, shape] = x.cell.split(',');
      const tag = `p${p}-c${c}${shape ? `-s${shape}` : ''}`;
      fs.writeFileSync(path.join(out, `elite-${tag}.red`), toRedcode(x.g, { name: `Elite ${tag.replaceAll('-', ' ')}`, coreSize: settings.coreSize, geo, strategy: `Best evolved ${x.species.hint} (${x.species.processes} processes, ${x.species.coverage} cells), zorewars evolve.` }));
    }
    fs.writeFileSync(path.join(out, 'evolve.json'), JSON.stringify(r, null, 1));
    if (json) { console.log(JSON.stringify({ ok: true, out, champions: r.champions.map(({ w, ...c }) => c), archive: r.archive, operators: r.operators }, null, 2)); return; }
    console.log(`\nFinal archive: ${r.archive.length} species, best first`);
    h.printTable(r.archive.slice(0, 12).map((x) => ({ Cell: x.cell, Usually: x.species.hint, Processes: x.species.processes, 'Cells run': x.species.coverage, Length: x.g.code.length, Fitness: x.fit.toFixed(2) })));
    console.log(`\nWritten to ${out}/: redqueen-N.red (each generation's champion), elite-pP-cC.red (best of each species), evolve.json.`);
    console.log(`Try one: zorewars hill ${out}/redqueen-${generations}.red --classics`);
  } finally { pool.close(); }
}

// ---- pushoff: where would these entries place in a tournament? ----
// The Core War Tournament Weekend adds entries to the top of a Koenigstuhl
// hill and ranks everyone by an iterative diversity push-off (tools/pushoff.js).
// Hill warriors are fetched on demand into a temporary cache (not this repo),
// as the Hall of Fame classics are.
const KOENIGSTUHL = { '94nop': '94', '88': '88', lp: 'LP', '94x': 'X' };
async function fetchHill(name, top, json) {
  const dir = KOENIGSTUHL[name];
  if (!dir) throw new Error(`unknown hill '${name}': use ${Object.keys(KOENIGSTUHL).map((k) => `koenigstuhl:${k}`).join(', ')}`);
  const base = `https://asdflkj.net/COREWAR/${dir}/`;
  const cache = path.join((await import('node:os')).tmpdir(), 'zorewars-hills', dir);
  fs.mkdirSync(cache, { recursive: true });
  const listing = await (await fetch(`${base}hill32_rec.html`)).text();
  const files = [...new Set([...listing.matchAll(/href="(HILL32\/[^"]+\.red)"/gi)].map((m) => m[1]))].slice(0, top);
  const out = [];
  for (const [k, f] of files.entries()) {
    const local = path.join(cache, path.basename(f));
    if (!fs.existsSync(local)) fs.writeFileSync(local, await (await fetch(base + f)).text());
    out.push(local);
    progress(json, `hill: ${k + 1}/${files.length}`);
  }
  done(json);
  return out;
}

// Hill warriors aren't bound by the entry rules (the 94x hill's leaders use
// P-space, and many are longer than a tournament's limit), so games against
// them run with the limit raised; entries were checked when they compiled.
function hillSettingsFor(settings) { return { ...settings, pSpace: undefined, maxLength: Math.max(settings.maxLength, 200) }; }
async function hillFiles(spec, top, json) {
  return spec.startsWith('koenigstuhl:') ? fetchHill(spec.slice(12).toLowerCase(), top, json)
    : fs.readdirSync(spec).filter((f) => /\.(red|rc)$/i.test(f)).map((f) => path.join(spec, f)).slice(0, top);
}
async function hillOpponents(spec, settings, flags) {
  const { compile } = await import('../src/engine/index.js');
  const json = !!flags.json;
  const out = [];
  for (const f of await hillFiles(spec, Math.max(1, parseInt(flags.top ?? '50', 10)), json)) {
    const w = compile(fs.readFileSync(f, 'utf8'), 'redcode', hillSettingsFor(settings));
    if (w.ok) out.push({ name: w.name, group: 'hill', w: strip(w) });
    else if (!json) console.error(`(skipped ${path.basename(f)}: ${w.errors[0].message})`);
  }
  return out;
}

export async function cmdPushoff(args, h) {
  const { roundRobin, pushOff } = await import('../tools/pushoff.js');
  const { compile } = await import('../src/engine/index.js');
  const json = !!args.flags.json;
  const settings = h.settingsFrom(args.flags);
  if (!args._.length || !args.flags.hill) h.usage('pushoff <entry...> --hill koenigstuhl:94nop|88|lp|94x (or a folder) [--rules NAME] [--length 50] [--top 50] [--rounds 50]');
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
  const pool = createPool();
  try {
    const scores = await roundRobin(pool, all.map((x) => strip(x.w)), { rounds, settings: hillSettings, onProgress: (i, n) => progress(json, `round robin: ${i}/${n}`) });
    done(json);
    const names = all.map((x) => x.w.name);
    const ranked = pushOff(scores, names).map((r) => ({ ...r, entry: all[r.index].entry }));
    if (json) { console.log(JSON.stringify({ ok: true, ranking: ranked.map(({ index, ...r }) => r) }, null, 2)); return; }
    h.printTable(ranked.slice(0, 25).concat(ranked.filter((r) => r.entry && r.rank > 25)).map((r) => ({
      Rank: r.rank, Warrior: `${r.entry ? '★ ' : ''}${r.name}`, 'Avg pts': r.avg.toFixed(2), Diversity: r.div.toFixed(2), Score: r.score.toFixed(2),
    })));
    for (const r of ranked.filter((x) => x.entry)) console.log(`\n★ ${r.name}: rank ${r.rank} of ${ranked.length}`);
  } finally { pool.close(); }
}
