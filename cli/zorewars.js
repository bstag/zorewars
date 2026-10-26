#!/usr/bin/env node
// ZoreWars command-line tool: compile warriors, run battles and tournaments,
// and serve the web arena. Designed to be driven by humans and AI agents
// alike: every command supports --json for machine-readable output.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compile, detectLanguage, runMatch, runTournament, DEFAULT_SETTINGS, RULESETS, listing, formatPostMortem, generateFromJS, inLibraryFor, fitsBattlefield } from '../src/engine/index.js';
import { convertWarrior, conversionCandidates } from '../src/engine/convert.js';
import { runPythonFile, pythonRunner } from './python.js';
import { fetchWarriorText, nameFromUrl } from './remote.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WARRIOR_DIR = path.join(ROOT, 'warriors');

const HELP = `ZoreWars — programs battle inside a simulated circular memory array.

Usage:
  zorewars battle <warrior> [warrior...] [options]   (one warrior alone: does it survive?)
  zorewars battle ... --report [--round N]           explain how each round was won
  zorewars trace <warrior> <warrior> [--round N] [--last 40]
                                                     the last instructions before a round ended
  zorewars tournament <warrior|dir> [more...] [options]
  zorewars compile <warrior> [--json]
  zorewars convert <warrior> --to js|py [--out file]  Redcode -> JavaScript or Python, verified
  zorewars check <warrior> [--json]
  zorewars list [--torus XxY[xZ]] [--json]          built-in warriors (and which run on that battlefield)
  zorewars classics [--json]                         famous originals you can fight
  zorewars serve [--port 8080]

Developer tools (use every CPU core):
  zorewars hill <warrior> [--classics] [--rounds 20]  score it against the library (and the classics),
                                                     opponent by opponent, with why rounds were lost
                                                     (hill, tune, evolve: --hill koenigstuhl:94nop [--top 50]
                                                     plays a real hill's top warriors instead)
  zorewars species [warrior...]                      where warriors sit on the behaviour map
                                                     (processes x cells executed); none = the library
  zorewars tune <warrior.js> [--candidates 40] [--seeds 3] [--write]
                                                     search the warrior's // SPACE for better constants
  zorewars evolve [warrior...] [--generations 6] [--king w.js] [--genome 40] [--scratch] [--ties 0.5] [--out evolved]
                                                     breed warriors: Red Queen rounds of MAP-Elites
  zorewars pushoff <entry...> --hill koenigstuhl:94nop|88|lp|94x [--rules NAME] [--length 50] [--top 50] [--save f]
                                                     predict a tournament place: round robin with a hill's
                                                     top warriors, then the iterative diversity push-off

Warriors:
  path/to/file.red   Redcode assembly
  path/to/file.js    JavaScript generator   (runs in-process)
  path/to/file.py    Python generator       (needs python on PATH)
  path/to/file.cpp   C++ generator          (needs g++ or clang++ on PATH)
  @name              built-in warrior, e.g. @imp @dwarf @silk @seeker
  https://...        Redcode fetched from a URL (never cached or saved)
  classic:name       a famous original from the public archives, e.g.
                     classic:thermite  classic:"iron gate"  classic:arvon
  -                  Redcode read from stdin

Options:
  --rounds N         rounds per match            (default 1 for battle, 10 for tournament)
  --seed N           seed for load positions     (default 1)
  --rules NAME       a standard hill's settings: 94nop, 88 (with ICWS'88 checks), lp, 94x
                     (no P-space); combine with e.g. --length 50 for a tournament
  --coresize N       core size                   (default ${DEFAULT_SETTINGS.coreSize})
  --cycles N         max cycles before a tie     (default ${DEFAULT_SETTINGS.maxCycles})
  --processes N      max processes per warrior   (default ${DEFAULT_SETTINGS.maxProcesses})
  --length N         max warrior length          (default ${DEFAULT_SETTINGS.maxLength})
  --distance N       min distance between warriors (default ${DEFAULT_SETTINGS.minDistance})
  --pspace N         P-space size                (default: coresize/16)
  --torus XxY[xZ]    a torus battlefield instead of the ring, e.g. 100x80;
                     addresses are vectors there: [0,1] is one row down
                     and TRN turns a process's heading (code can flow any way)
  --fixed N          warrior 2 starts at N in round 1, like pmars -F;
                     later rounds follow pMARS's RNG, so results match pMARS
  --json             machine-readable output
  --classics         hill/tune/evolve: also play the Hall of Fame originals
  --scratch          evolve: start from random programs, no library genes or opponents (the library is only held out)
  --ties 0.5         evolve: what a tie with a champion counts (0..1); lower makes champions kill
                     (fetched from the public archives each run; needs network)

pMARS's short options also work: -r -s -c -p -l -d -F -S (and -b -k are ignored),
so 'pmars -r 100 -l 25 -d 100 a.red b.red' becomes 'zorewars battle -r 100 -l 25 -d 100 a.red b.red'.
  --port N           port for 'serve'            (default 8080)

Exit status: 0 ok, 1 a warrior failed to compile, 2 bad usage.`;

// pMARS's short options, so tournament command lines can be reused as-is:
//   pmars -r 100 -s 8000 -p 8000 -c 80000 -l 25 -d 100 -F 4000 -S 500
const PMARS_FLAGS = { r: 'rounds', s: 'coresize', c: 'cycles', p: 'processes', l: 'length', d: 'distance', F: 'fixed', S: 'pspace' };

function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (['json', 'help', 'report', 'classics', 'write', 'scratch', 'self'].includes(key)) args.flags[key] = true;
      else args.flags[key] = argv[++i];
    } else if (a === '-h') args.flags.help = true;
    else if (/^-[A-Za-z]$/.test(a) && PMARS_FLAGS[a[1]]) args.flags[PMARS_FLAGS[a[1]]] = argv[++i];
    else if (/^-[bkf8eVo]$/.test(a)) { /* pMARS display/mode switches: ignored */ }
    else args._.push(a);
  }
  return args;
}

function settingsFrom(flags, defaults = {}) {
  const num = (k) => (flags[k] !== undefined ? parseInt(flags[k], 10) : undefined);
  const s = { ...DEFAULT_SETTINGS, ...defaults };
  // --rules 94nop|88|lp|94x: a standard hill's settings (other flags override them).
  if (flags.rules !== undefined) {
    const r = RULESETS[String(flags.rules).toLowerCase()];
    if (!r) usage(`--rules takes ${Object.keys(RULESETS).join(', ')}`);
    Object.assign(s, r);
  }
  const map = { rounds: 'rounds', coresize: 'coreSize', cycles: 'maxCycles', processes: 'maxProcesses', length: 'maxLength', distance: 'minDistance', pspace: 'pSpaceSize' };
  for (const [flag, key] of Object.entries(map)) {
    const v = num(flag);
    if (v !== undefined) {
      if (!Number.isFinite(v) || v <= 0) usage(`--${flag} must be a positive integer`);
      s[key] = v;
    }
  }
  // --torus 100x80 (or 20x20x20): a torus battlefield instead of the ring.
  if (flags.torus !== undefined) {
    const dims = String(flags.torus).toLowerCase().split('x').map((d) => parseInt(d, 10));
    if (dims.length < 2 || dims.length > 3 || dims.some((d) => !Number.isFinite(d) || d < 1)) usage('--torus takes sizes like 100x80 or 20x20x20');
    const [x, y, z = 1] = dims;
    Object.assign(s, { topology: 'torus', sizeX: x, sizeY: y, sizeZ: z, coreSize: x * y * z });
  }
  return s;
}

function usage(msg) {
  console.error(`zorewars: ${msg}\nRun 'zorewars --help' for usage.`);
  process.exit(2);
}

// Built-in refs: @dwarf for Redcode warriors, @dwarf.js / @dwarf.py for others.
function builtinRef(entry) {
  return entry.language === 'redcode' ? `@${path.parse(entry.file).name}` : `@${entry.file}`;
}

function builtinPath(name) {
  const list = JSON.parse(fs.readFileSync(path.join(WARRIOR_DIR, 'index.json'), 'utf8'));
  const key = name.toLowerCase();
  const hit = list.find((w) => builtinRef(w).slice(1) === key) ||
    list.find((w) => w.name.toLowerCase() === key);
  if (!hit) usage(`no built-in warrior '@${name}'. Try 'zorewars list'.`);
  return path.join(WARRIOR_DIR, hit.file);
}

// Run an external generator (Python or C++) and capture the Redcode it prints.
function runGenerator(file, language) {
  if (language === 'python') return runPythonFile(file);
  if (language === 'cpp') {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zorewars-'));
    const exe = path.join(tmp, process.platform === 'win32' ? 'warrior.exe' : 'warrior');
    let compiled = false;
    for (const cxx of ['g++', 'clang++']) {
      const r = spawnSync(cxx, ['-std=c++17', '-O1', '-I', path.join(ROOT, 'lang', 'cpp'), file, '-o', exe], { encoding: 'utf8' });
      if (r.error) continue;
      if (r.status !== 0) throw new Error(`${cxx} failed:\n${r.stderr}`);
      compiled = true;
      break;
    }
    if (!compiled) throw new Error('could not find a C++ compiler (tried g++, clang++)');
    const r = spawnSync(exe, [], { encoding: 'utf8' });
    fs.rmSync(tmp, { recursive: true, force: true });
    if (r.status !== 0) throw new Error(`warrior program exited with status ${r.status}:\n${r.stderr}`);
    return r.stdout;
  }
  throw new Error(`unsupported language ${language}`);
}

function hallOfFame() {
  return JSON.parse(fs.readFileSync(path.join(WARRIOR_DIR, 'encyclopedia.json'), 'utf8')).hallOfFame;
}

function classicUrl(name) {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const list = hallOfFame();
  const hit = list.find((h) => h.name.toLowerCase().replace(/[^a-z0-9]/g, '') === key) ||
    list.find((h) => h.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(key));
  if (!hit) usage(`no classic matching '${name}'. Try 'zorewars classics'.`);
  return hit.url;
}

async function loadWarrior(ref, settings) {
  let file = ref;
  let source;
  let language;
  if (ref.startsWith('classic:') || /^https?:\/\//i.test(ref)) {
    const url = ref.startsWith('classic:') ? classicUrl(ref.slice(8)) : ref;
    try {
      ({ text: source } = await fetchWarriorText(url, { anyHost: true }));
    } catch (e) {
      return { ref, file: url, ok: false, errors: [{ line: 0, message: e.message }], warnings: [] };
    }
    const w = compile(source, 'redcode', settings);
    if (w.name === 'Unnamed') w.name = nameFromUrl(url);
    return { ...w, ref, file: url };
  }
  if (ref === '-') {
    source = fs.readFileSync(0, 'utf8');
    language = 'redcode';
    file = '<stdin>';
  } else {
    if (ref.startsWith('@')) file = builtinPath(ref.slice(1));
    if (!fs.existsSync(file)) usage(`no such file: ${file}`);
    language = detectLanguage(file);
    if (language === 'python' || language === 'cpp') {
      try {
        source = runGenerator(path.resolve(file), language);
      } catch (e) {
        return { ref, file, language, ok: false, errors: [{ line: 0, message: e.message }], warnings: [] };
      }
      language = 'redcode';
    } else {
      source = fs.readFileSync(file, 'utf8');
    }
  }
  const w = compile(source, language, settings);
  return { ...w, ref, file: file === '<stdin>' ? file : path.relative(process.cwd(), path.resolve(file)).split(path.sep).join('/') };
}

async function loadAll(refs, settings, json) {
  const warriors = await Promise.all(refs.map((r) => loadWarrior(r, settings)));
  const bad = warriors.filter((w) => !w.ok);
  if (bad.length) {
    if (json) {
      console.log(JSON.stringify({ ok: false, errors: bad.map((w) => ({ warrior: w.ref, errors: w.errors })) }, null, 2));
    } else {
      for (const w of bad) {
        console.error(`${w.ref}: failed to compile`);
        for (const e of w.errors) console.error(`  line ${e.line}: ${e.message}`);
      }
    }
    process.exit(1);
  }
  return warriors;
}

function expandRefs(refs) {
  const out = [];
  for (const r of refs) {
    if (r !== '-' && !r.startsWith('@') && !r.includes(':') && fs.existsSync(r) && fs.statSync(r).isDirectory()) {
      for (const f of fs.readdirSync(r).sort()) {
        if (/\.(red|js|py|cpp)$/i.test(f)) out.push(path.join(r, f));
      }
    } else out.push(r);
  }
  return out;
}

async function cmdBattle(args) {
  const refs = args._;
  if (refs.length < 1) usage('battle needs at least one warrior');
  const settings = settingsFrom(args.flags, { rounds: 1 });
  const json = !!args.flags.json;
  const warriors = await loadAll(refs, settings, json);
  const seed = parseInt(args.flags.seed ?? '1', 10);
  const fixed = args.flags.fixed !== undefined ? parseInt(args.flags.fixed, 10) : undefined;
  const report = !!args.flags.report;
  const detailRound = Math.min(settings.rounds, Math.max(1, parseInt(args.flags.round ?? '1', 10)));
  const result = runMatch(warriors, settings, { seed, fixed, report });

  if (json) {
    console.log(JSON.stringify({
      ok: true,
      seed,
      settings,
      warriors: result.warriors.map((s, i) => ({ ...s, file: warriors[i].file, length: warriors[i].instructions.length })),
      rounds: result.rounds.map((r) => ({
        round: r.round,
        winner: r.winner === null ? null : warriors[r.winner].name,
        winnerIndex: r.winner,
        cycles: r.cycles,
        survivors: r.survivors,
        positions: r.positions,
        ...(r.report ? { report: r.report } : {}),
      })),
    }, null, 2));
    return;
  }

  console.log(`Battle: ${warriors.map((w) => w.name).join(' vs ')}  (${settings.rounds} round${settings.rounds === 1 ? '' : 's'}, ${fixed !== undefined ? `-F ${fixed}` : `seed ${seed}`})\n`);
  if (settings.rounds <= 20 || report) {
    for (const r of result.rounds) {
      const who = warriors.length === 1 ? (r.survivors.length ? 'survived' : 'died')
        : r.winner === null ? `tie (${r.survivors.map((i) => warriors[i].name).join(', ') || 'no survivors'})` : `${warriors[r.winner].name} wins`;
      console.log(`  round ${String(r.round).padStart(3)}: ${who} at cycle ${r.cycles}`);
      if (r.report) console.log(`             ${r.report.summary}`);
    }
    console.log('');
  }
  if (report) {
    const r = result.rounds[detailRound - 1];
    console.log(`Post-mortem of round ${detailRound} (positions ${r.positions.join(', ')}; ${warriors[r.firstTurn].name} moved first). Use --round N for another round.\n`);
    console.log(formatPostMortem(r.report));
  }
  printTable(result.warriors.map((s) => ({ Warrior: s.name, Author: s.author, Wins: s.wins, Losses: s.losses, Ties: s.ties, Score: s.score, Smooth: s.smooth.toFixed(2) })));
}

async function cmdTournament(args) {
  const refs = expandRefs(args._);
  if (refs.length < 2) usage('tournament needs at least two warriors');
  const settings = settingsFrom(args.flags, { rounds: 10 });
  const json = !!args.flags.json;
  const warriors = await loadAll(refs, settings, json);
  const seed = parseInt(args.flags.seed ?? '1', 10);
  const result = runTournament(warriors, settings, {
    seed,
    onMatch: json ? undefined : (m) => process.stderr.write(`  ${m.a} vs ${m.b}: ${m.result.map((r) => `${r.wins}-${r.losses}-${r.ties}`).join(' / ')}\n`),
  });
  if (json) {
    console.log(JSON.stringify({ ok: true, seed, settings, ...result }, null, 2));
    return;
  }
  console.log(`\nTournament standings (${settings.rounds} rounds per pairing, 3 points per win, 1 per tie)\n`);
  printTable(result.ranking.map((t, i) => ({
    '#': i + 1, Warrior: t.name, Wins: t.wins, Losses: t.losses, Ties: t.ties, Score: t.score, 'Pts/round': t.scorePerRound.toFixed(2), 'Smooth/round': t.smoothPerRound.toFixed(2),
  })));
}

async function cmdCompile(args, checkOnly = false) {
  if (args._.length !== 1) usage(`${checkOnly ? 'check' : 'compile'} needs exactly one warrior`);
  const settings = settingsFrom(args.flags);
  const w = await loadWarrior(args._[0], settings);
  const json = !!args.flags.json;
  if (json) {
    console.log(JSON.stringify({
      ok: w.ok, name: w.name, author: w.author, strategy: w.strategy, start: w.start,
      length: w.instructions?.length ?? 0,
      errors: w.errors, warnings: w.warnings,
      ...(checkOnly ? {} : { instructions: (w.instructions || []).map(({ line, ...i }) => i), redcode: w.ok ? listing(w, settings) : '' }),
    }, null, 2));
  } else if (!w.ok) {
    console.error(`${args._[0]}: failed to compile`);
    for (const e of w.errors) console.error(`  line ${e.line}: ${e.message}`);
    for (const e of w.warnings || []) console.error(`  warning: line ${e.line}: ${e.message}`);
  } else {
    for (const e of w.warnings) console.error(`warning: line ${e.line}: ${e.message}`);
    if (checkOnly) console.log(`${w.name}: OK (${w.instructions.length} instructions)`);
    else console.log(listing(w, settings));
  }
  process.exit(w.ok ? 0 : 1);
}

async function cmdConvert(args) {
  if (args._.length !== 1) usage('convert needs exactly one warrior');
  const to = { js: 'javascript', javascript: 'javascript', py: 'python', python: 'python' }[(args.flags.to || '').toLowerCase()];
  if (!to) usage('convert needs --to js or --to py');
  const settings = settingsFrom(args.flags);
  const json = !!args.flags.json;
  const [w] = await loadAll(args._, settings, json);
  // Convert the Redcode itself, so comments and FOR loops carry over. (For a
  // JavaScript, Python or C++ warrior this is the Redcode it generated.)
  const source = w.redcode ?? listing(w, settings);
  const runPython = to === 'python' ? pythonRunner() : null;
  let result;
  if (to === 'python' && !runPython) {
    const code = conversionCandidates(source, 'python')[0].code
      .replace(/^# Verified:.*$/m, '# Not verified: Python was not found on the machine that converted it.');
    result = { code, level: 'readable', verified: false };
    console.error('warning: Python not found, so this conversion is not verified');
  } else {
    try {
      const r = await convertWarrior(source, to, { compile, settings, toRedcode: to === 'javascript' ? (c) => generateFromJS(c, settings) : runPython });
      result = { ...r, verified: true };
    } catch (e) {
      if (json) console.log(JSON.stringify({ ok: false, errors: [{ line: 0, message: e.message }] }, null, 2));
      else console.error(`${args._[0]}: ${e.message}`);
      process.exit(1);
    }
  }
  if (args.flags.out) {
    fs.writeFileSync(args.flags.out, result.code);
    if (!json) console.error(`wrote ${args.flags.out} (${result.level} form${result.verified ? ', verified' : ''})`);
  }
  if (json) console.log(JSON.stringify({ ok: true, language: to, level: result.level, verified: result.verified, code: result.code }, null, 2));
  else if (!args.flags.out) process.stdout.write(result.code);
}

async function cmdTrace(args) {
  const refs = args._;
  if (refs.length < 1) usage('trace needs at least one warrior');
  const round = Math.max(1, parseInt(args.flags.round ?? '1', 10));
  const last = Math.max(1, Math.min(100000, parseInt(args.flags.last ?? '40', 10)));
  const settings = { ...settingsFrom(args.flags), rounds: round };
  const json = !!args.flags.json;
  const warriors = await loadAll(refs, settings, json);
  const seed = parseInt(args.flags.seed ?? '1', 10);
  const fixed = args.flags.fixed !== undefined ? parseInt(args.flags.fixed, 10) : undefined;
  // Earlier rounds are played too, so P-space and placement match the real match.
  const result = runMatch(warriors, settings, { seed, fixed, report: round, traceRound: round, traceSize: last });
  const r = result.rounds[round - 1];
  if (json) {
    console.log(JSON.stringify({ ok: true, round, positions: r.positions, firstTurn: r.firstTurn, trace: r.trace, report: r.report }, null, 2));
    return;
  }
  const names = warriors.map((w) => w.name);
  const width = Math.max(...names.map((n) => n.length));
  console.log(`Round ${round}: ${names.map((n, i) => `${n} at ${r.positions[i]}`).join(', ')}; ${names[r.firstTurn]} moved first.`);
  console.log(`Last ${r.trace.length} instructions executed:\n`);
  console.log(`  ${'cycle'.padStart(6)}  ${'warrior'.padEnd(width)}  addr  ${'instruction'.padEnd(24)} procs`);
  for (const t of r.trace) {
    const died = t.died ? `  <- process died (${t.died === 'enemyCode' ? 'ran an enemy bomb' : t.died === 'ownCode' ? 'ran its own DAT' : t.died === 'emptyCore' ? 'ran empty core' : 'division by zero'})` : '';
    console.log(`  ${String(t.cycle).padStart(6)}  ${names[t.warrior].padEnd(width)}  ${String(t.pc).padStart(4, '0')}  ${t.instruction.padEnd(24)} ${String(t.processes).padStart(5)}${died}`);
  }
  console.log(`\n${r.report.summary}`);
}

function cmdClassics(args) {
  const list = hallOfFame();
  if (args.flags.json) {
    console.log(JSON.stringify(list.map(({ name, author, year, family, url }) => ({ name, author, year, family, url, ref: `classic:${name}` })), null, 2));
    return;
  }
  printTable(list.map((h) => ({ Year: h.year, Name: h.name, Author: h.author, Family: h.family })));
  console.log(`\nFight one with: zorewars battle mine.red classic:"${list.at(-1).name}"`);
  console.log('Warriors are fetched from the public archives each time; nothing is saved.');
}

// With --torus (or other rule flags), also says which warriors can play on
// that battlefield: they compile there and, on a torus, survive alone.
function cmdList(args) {
  const list = JSON.parse(fs.readFileSync(path.join(WARRIOR_DIR, 'index.json'), 'utf8'));
  const settings = settingsFrom(args.flags);
  const check = args.flags.torus !== undefined;
  const runs = new Map();
  if (check) {
    for (const w of list.filter((e) => e.language !== 'python')) {
      runs.set(w.file, fitsBattlefield(compile(fs.readFileSync(path.join(WARRIOR_DIR, w.file), 'utf8'), w.language, settings), settings));
    }
    for (const w of list.filter((e) => e.language === 'python')) runs.set(w.file, runs.get(w.convertedFrom ?? w.file.replace(/\.py$/, '.red')) ?? false);
  }
  if (args.flags.json) {
    console.log(JSON.stringify(list.map((w) => ({ ...w, ref: builtinRef(w), ...(check ? { runsHere: runs.get(w.file) } : {}) })), null, 2));
    return;
  }
  const rows = list.map((w) => ({ Ref: builtinRef(w), Name: w.name, Strategy: w.category, Language: w.language, ...(check ? { 'Runs here': runs.get(w.file) ? 'yes' : '-' } : {}), File: `warriors/${w.file}` }));
  printTable(check ? [...rows.filter((r) => r['Runs here'] === 'yes'), ...rows.filter((r) => r['Runs here'] !== 'yes')] : rows);
  if (check) console.log(`
${[...runs.values()].filter(Boolean).length} of ${list.length} can play on this battlefield.`);
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.red': 'text/plain; charset=utf-8', '.py': 'text/plain; charset=utf-8', '.cpp': 'text/plain; charset=utf-8',
  '.hpp': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
};

function cmdServe(args) {
  const port = parseInt(args.flags.port ?? process.env.PORT ?? '8080', 10);
  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url, 'http://x');
    if (reqUrl.pathname === '/api/fetch') {
      // Lets the arena load warriors from archives that don't send CORS headers.
      try {
        if (req.method !== 'GET') throw new Error('GET only');
        const { text, url } = await fetchWarriorText(reqUrl.searchParams.get('url') || '');
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Source-Url': url, 'Cache-Control': 'no-store' });
        res.end(text);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(e.message);
      }
      return;
    }
    let urlPath = decodeURIComponent(reqUrl.pathname);
    if (urlPath === '/') { res.writeHead(302, { Location: '/web/' }); res.end(); return; }
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    const file = path.normalize(path.join(ROOT, urlPath));
    if (!file.startsWith(ROOT + path.sep) || file.includes(`${path.sep}node_modules${path.sep}`)) {
      res.writeHead(403); res.end('forbidden'); return;
    }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  });
  server.listen(port, () => console.log(`ZoreWars arena running at http://localhost:${port}/`));
}

function printTable(rows) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const width = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c]).length)));
  const line = (vals) => vals.map((v, i) => String(v).padEnd(width[i])).join('  ');
  console.log(line(cols));
  console.log(width.map((w) => '-'.repeat(w)).join('  '));
  for (const r of rows) console.log(line(cols.map((c) => r[c])));
}

// The library's Redcode and JavaScript warriors, as @refs.
function libraryRefs(settings) {
  return JSON.parse(fs.readFileSync(path.join(WARRIOR_DIR, 'index.json'), 'utf8'))
    .filter((e) => inLibraryFor(e, settings))
    .map(builtinRef);
}
const devtools = async () => [await import('./devtools.js'), { loadAll, settingsFrom, usage, printTable, expandRefs, libraryRefs }];

const args = parseArgs(process.argv.slice(2));
const cmd = args._.shift();
if (!cmd || args.flags.help) { console.log(HELP); process.exit(cmd || args.flags.help ? 0 : 2); }
switch (cmd) {
  case 'battle': await cmdBattle(args); break;
  case 'tournament': await cmdTournament(args); break;
  case 'compile': await cmdCompile(args); break;
  case 'check': await cmdCompile(args, true); break;
  case 'list': cmdList(args); break;
  case 'classics': cmdClassics(args); break;
  case 'trace': await cmdTrace(args); break;
  case 'convert': await cmdConvert(args); break;
  case 'serve': cmdServe(args); break;
  case 'hill': { const [m, h] = await devtools(); await m.cmdHill(args, h); break; }
  case 'species': { const [m, h] = await devtools(); await m.cmdSpecies(args, h); break; }
  case 'tune': { const [m, h] = await devtools(); await m.cmdTune(args, h); break; }
  case 'evolve': { const [m, h] = await devtools(); await m.cmdEvolve(args, h); break; }
  case 'pushoff': { const [m, h] = await devtools(); await m.cmdPushoff(args, h); break; }
  default: usage(`unknown command '${cmd}'`);
}
