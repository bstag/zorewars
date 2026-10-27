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
import { trainingProfiles, validateCandidates } from '../tools/training.js';
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

export async function cmdEvolve(args, h, { quiet = false } = {}) {
  const settings = h.settingsFrom(args.flags);
  const json = !!args.flags.json;
  const integer = (key, fallback, min = 1) => {
    const n = Number(args.flags[key] ?? fallback);
    if (!Number.isSafeInteger(n) || n < min) h.usage(`--${key} must be an integer >= ${min}`);
    return n;
  };
  const generations = integer('generations', 6);
  const batches = integer('batches', 4);
  const batchSize = integer('batch', 40);
  const seed = integer('seed', 1, 0);
  if (seed > 2147483646) h.usage('--seed must be <= 2147483646');
  const algorithm = args.flags.algorithm ?? 'map-elites';
  const objective = args.flags.objective ?? 'smooth';
  if (!['map-elites', 'ga'].includes(algorithm)) h.usage('--algorithm takes map-elites or ga');
  if (!['smooth', 'points', 'pushoff'].includes(objective)) h.usage('--objective takes smooth, points or pushoff');
  if (objective === 'pushoff' && args.flags.scratch) h.usage('--objective pushoff ranks against a field: not with --scratch');
  const tieValue = Number(args.flags.ties ?? 0.5);
  if (!Number.isFinite(tieValue) || tieValue < 0 || tieValue > 1) h.usage('--ties must be from 0 to 1');
  const evalRounds = integer('eval-rounds', args.flags.rounds ?? 6);
  const populationSize = integer('population', batchSize);
  const checkRounds = integer('check-rounds', 30);
  const seeds = integer('seeds', 3, 2);
  const finalists = integer('finalists', 6);
  const threads = args.flags.threads === undefined ? undefined : integer('threads', 1);
  const out = args.flags.out ?? 'evolved';
  // Gene pool and starting opponents: the library, plus any warriors given.
  // --scratch: none of that. Random programs, scored only against each
  // other's champions; the library is only held out, to report progress.
  const scratch = !!args.flags.scratch;
  // Separate the legal opponent field from additional sources of genes.
  const library = libraryOpponents(settings);
  // '88 uses its actual adapted library for opponents. Additional '94 genes
  // may be bent into '88, but must never become illegal '88 opponents.
  const genes = settings.dialect === '88' ? [...library, ...libraryOpponents({ ...settings, dialect: undefined })] : library;
  const hill = args.flags.hill ? await hillOpponents(String(args.flags.hill), settings, args.flags) : null;
  const field = scratch ? [] : hill ?? library;
  const extra = args._.length ? await h.loadAll(h.expandRefs(args._), settings, json) : [];
  const sources = [
    ...(scratch ? [] : genes).map((o) => ({ w: o.w, role: roleOf(`${o.category} ${o.name}`) })),
    ...extra.map((w) => ({ w: strip(w), role: roleOf(`${w.name} ${w.strategy || ''}`) || 'paper' })),
  ];
  const classics = args.flags.classics ? await opponents(h, settings, { ...args.flags, classics: true }, []).then((f) => f.filter((x) => x.group === 'classic')) : [];
  const heldOut = scratch ? [...library, ...classics] : classics;
  // --king a.js,b.red: start the Red Queen with these as champions (they
  // also join the gene pool and the starting population).
  const kings = args.flags.king ? await h.loadAll(h.expandRefs(String(args.flags.king).split(',')), settings, json) : [];
  for (const w of kings) sources.push({ w: strip(w), role: roleOf(`${w.name} ${w.strategy || ''}`) || 'paper' });
  // --partner a.red,b.red: our other entries, ranked beside each candidate (--objective pushoff).
  const partners = args.flags.partner ? await h.loadAll(h.expandRefs(String(args.flags.partner).split(',')), settings, json) : [];
  if (partners.length && objective !== 'pushoff') h.usage('--partner needs --objective pushoff');
  const maxLength = Math.min(settings.maxLength, integer('genome', 40));
  const entrySettings = { ...settings };
  if (hill) Object.assign(settings, hillSettingsFor(settings));   // genomes keep the entry limit above
  if (!scratch && !field.length) h.usage('no opponents compiled for this battlefield');
  fs.mkdirSync(out, { recursive: true });
  const pool = createPool(threads);
  try {
    if (!json) console.log(`Evolving${scratch ? ' from scratch' : ''}: ${generations} Red Queen generations, ${batches}x${batchSize} children each, ${scratch ? 'random programs, no gene pool' : `${sources.length} warriors in the gene pool`}, genomes up to ${maxLength} instructions${kings.length ? `, starting champions: ${kings.map((k) => k.name).join(', ')}` : ''}${heldOut.length ? `, ${heldOut.length} ${scratch ? 'library warriors and classics' : 'classics'} held out` : ''}\n`);
    const geo = settings.topology === 'torus' ? makeGeometry(settings) : null;
    const r = await evolve({
      pool, sources, opponents: field, heldOut, settings, entrySettings, rounds: generations, batches, batchSize,
      maxLength, kings, scratch, seed, algorithm, objective, evalRounds, populationSize, tieValue, partners,
      onLog: (t) => progress(json, t),
      onRound: (rec) => {
        done(json);
        const c = rec.champion;
        const file = path.join(out, `redqueen-${rec.round}.red`);
        fs.writeFileSync(file, toRedcode(c.g, { name: c.name, coreSize: settings.coreSize, geo, dialect: settings.dialect, strategy: `Champion of Red Queen generation ${rec.round} (zorewars evolve): ${c.species.hint}, ${c.species.processes} processes, ${c.species.coverage} cells.` }));
        if (json) return;
        const vs = c.vsAncestors ? ` | vs ancestors ${(c.vsAncestors.reduce((s, x) => s + x.pts, 0) / c.vsAncestors.length).toFixed(2)} pts/round` : '';
        const held = c.heldOut ? ` | held-out ${scratch ? 'library' : 'classics'} ${c.heldOut.score.toFixed(2)}` : '';
        const fitText = c.places ? `push-off place ${c.places[0]}${c.places.length > 1 ? ` (partners ${c.places.slice(1).join(', ')})` : ''}` : `fitness ${c.fit.toFixed(2)}`;
        console.log(`generation ${rec.round}: ${rec.cells} ${algorithm === 'ga' ? 'population members' : 'species cells'} (${rec.placed} archive updates) | champion ${fitText}, ${c.species.hint}, ${c.g.code.length} instructions${vs}${held}  -> ${file}`);
      },
    });
    for (const x of r.archive) {
      const [p, c, shape] = x.cell.split(',');
      const tag = `p${p}-c${c}${shape ? `-s${shape}` : ''}`;
      fs.writeFileSync(path.join(out, `elite-${tag}.red`), toRedcode(x.g, { name: `Elite ${tag.replaceAll('-', ' ')}`, coreSize: settings.coreSize, geo, dialect: settings.dialect, strategy: `Best evolved ${x.species.hint} (${x.species.processes} processes, ${x.species.coverage} cells), zorewars evolve.` }));
    }
    r.inputs = {
      sources: sources.map((s) => ({ name: s.w.name, role: s.role, w: s.w })),
      opponents: field, heldOut, kings: kings.map(strip),
    };
    if (args.flags.validate) {
      // Scratch remains independent of the library: validate against its
      // champion lineage, rather than using the held-out library to select.
      const validationField = scratch ? r.champions.map((c) => ({ name: c.name, group: 'champion', w: c.w })) : field;
      r.validation = await validateCandidates({ pool, baseline: r.baseline,
        candidates: [...(r.population ?? r.archive), ...r.champions.slice().reverse()], field: validationField,
        settings, seed, seeds, rounds: checkRounds, finalists,
        onProgress: (i, n) => progress(json, `Validating finalist ${i}/${n} on fresh placements…`),
      });
      const best = r.validation.results.find((c) => c.id === r.validation.recommended);
      fs.writeFileSync(path.join(out, 'best.red'), toRedcode(best.g, { name: `Recommended ${algorithm}`, coreSize: settings.coreSize, geo,
        dialect: settings.dialect, strategy: r.validation.improved ? `Validated improvement over starting baseline (${best.gain.toFixed(3)} points per round).` : 'Starting baseline retained: no finalist cleared the validation noise margin.' }));
      if (!json) console.log(`\nValidation: ${r.validation.improved ? 'improved version' : 'starting baseline retained'} -> ${path.join(out, 'best.red')}`);
    }
    fs.writeFileSync(path.join(out, 'evolve.json'), JSON.stringify(r, null, 1));
    if (quiet) return r;
    if (json) { console.log(JSON.stringify({ ok: true, out, config: r.config, stats: r.stats, validation: r.validation, champions: r.champions.map(({ w, ...c }) => c), archive: r.archive, operators: r.operators }, null, 2)); return r; }
    console.log(`\nFinal archive: ${r.archive.length} species, best first`);
    h.printTable(r.archive.slice(0, 12).map((x) => ({ Cell: x.cell, Usually: x.species.hint, Processes: x.species.processes, 'Cells run': x.species.coverage, Length: x.g.code.length, Fitness: x.fit.toFixed(2) })));
    console.log(`\nWritten to ${out}/: redqueen-N.red (each generation's champion), elite-pP-cC.red (best of each species), evolve.json.`);
    console.log(`Try one: zorewars hill ${out}/redqueen-${generations}.red --classics`);
    return r;
  } finally { pool.close(); }
}

export async function cmdTrain(args, h) {
  let profiles;
  try { profiles = trainingProfiles(args.flags.profiles); } catch (e) { h.usage(e.message); }
  if (args.flags.rules || args.flags.torus) h.usage('train selects battlefields with --profiles; use evolve for custom --rules/--torus');
  const out = args.flags.out ?? path.join('evolved', 'training');
  fs.mkdirSync(out, { recursive: true });
  const campaign = { ok: true, profiles: [] };
  for (const profile of profiles) {
    if (!args.flags.json) console.log(`Training ${profile.name}…`);
    const directory = path.join(out, profile.name);
    const r = await cmdEvolve({ _: args._, flags: { ...args.flags, ...profile.flags, out: directory,
      genome: args.flags.genome ?? h.settingsFrom({ ...args.flags, ...profile.flags }).maxLength,
      algorithm: args.flags.algorithm ?? 'ga', objective: args.flags.objective ?? 'points', validate: true, json: true } }, h, { quiet: true });
    const best = r.validation.results.find((c) => c.id === r.validation.recommended);
    const base = r.validation.results.find((c) => c.id === r.validation.baseline);
    const result = { profile: profile.name, file: path.join(directory, 'best.red'), report: path.join(directory, 'evolve.json'),
      improved: r.validation.improved, score: best.score, baseline: base.score, gain: best.gain, margin: best.margin, config: r.config };
    campaign.profiles.push(result);
    // Persist after each profile so completed runs survive interruption.
    fs.writeFileSync(path.join(out, 'training.json'), JSON.stringify(campaign, null, 2));
    if (!args.flags.json) console.log(`${profile.name}: ${best.score.toFixed(3)} pts/round (${r.validation.improved ? `gain +${best.gain.toFixed(3)}` : 'baseline retained'}) -> ${result.file}`);
  }
  if (args.flags.json) console.log(JSON.stringify(campaign, null, 2));
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
    if (!fs.existsSync(local)) {
      const res = await fetch(base + f);
      const text = await res.text();
      if (!res.ok || /^\s*<!DOCTYPE|^\s*<html/i.test(text)) { if (!json) console.error(`(could not fetch ${path.basename(f)})`); continue; }
      fs.writeFileSync(local, text);
    }
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
  // How the push-off reads the announcement (see src/engine/pushoff.js).
  const variant = { features: args.flags.features ?? 'points', metric: args.flags.metric ?? 'sd', self: !!args.flags.self, field: args.flags.field ?? 'original' };
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
  if (!args._.length || !args.flags.hill) h.usage('pushoff <entry...> --hill koenigstuhl:94nop|88|lp|94x (or a folder) [--rules NAME] [--length 50] [--top 50] [--rounds 50] [--features points|wlt|wl] [--metric sd|eq6|euclid] [--self] [--field original|current] [--save file] | pushoff --load file');
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
    const { scores, results } = await roundRobin(pool, all.map((x) => strip(x.w)), { rounds, settings: hillSettings, self: variant.self || !!args.flags.save, onProgress: (i, n) => progress(json, `round robin: ${i}/${n}`) });
    done(json);
    const warriors = all.map((x) => ({ name: x.w.name, entry: x.entry }));
    // --save: keep every result (self-fights too) to rank again with --load.
    if (args.flags.save) fs.writeFileSync(String(args.flags.save), JSON.stringify({ rounds, settings: { coreSize: settings.coreSize, maxProcesses: settings.maxProcesses, maxCycles: settings.maxCycles, maxLength: settings.maxLength }, warriors, scores, results }));
    show(warriors, scores, results);
  } finally { pool.close(); }
}
