#!/usr/bin/env node
// Differential test of ZoreWars against pMARS, the reference Core War
// simulator. Runs the same warriors through both and reports any difference.
//
//   node scripts/pmars-compare.js --pmars path/to/pmars [--quick]
//
// The warrior set is the ZoreWars library, the P-space fixtures in
// test/fixtures, and the Hall of Fame originals, which are fetched from the
// public archives into a temporary folder (nothing is stored in the repo).
// Five checks:
//   asm     every warrior assembles to the same instructions as pMARS's listing
//   round   single rounds at fixed positions (pmars -F) end the same way
//   match   2-warrior matches give the same win/tie totals (RNG placement,
//           first-mover rotation, P-space carried between rounds)
//   pspace  matches between P-space-driven warriors give the same totals
// (Games with 3+ warriors aren't compared: ZoreWars places them with its own
// algorithm, and pMARS can't be given fixed positions for more than two.)
// See COMPLIANCE.md for how to build pMARS and for the latest results.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compile, VM, listing, runMatch } from '../src/engine/index.js';
import { fetchWarriorText } from '../cli/remote.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const PMARS = opt('pmars') || process.env.PMARS;
const QUICK = argv.includes('--quick');
const ONLY = opt('only')?.split(',');
if (!PMARS || !fs.existsSync(PMARS)) {
  console.error('usage: node scripts/pmars-compare.js --pmars path/to/pmars [--quick] [--only asm,round,match,pspace]');
  console.error('See COMPLIANCE.md for how to build pMARS.');
  process.exit(2);
}

const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'zorewars-pmars-'));
const pmars = (args) => spawnSync(PMARS, args, { encoding: 'utf8' }).stdout;
const norm = (v) => ((v % 8000) + 8000) % 8000;

async function loadWarriors() {
  const list = [];
  const lib = JSON.parse(fs.readFileSync(path.join(ROOT, 'warriors/index.json'), 'utf8'));
  for (const e of lib) {
    if (e.language === 'python' || e.convertedFrom || e.battlefield) continue;   // pMARS has no planes or volumes
    let file = path.join(ROOT, 'warriors', e.file);
    let text = fs.readFileSync(file, 'utf8');
    if (e.language === 'javascript') {
      text = listing(compile(text, 'javascript'));
      file = path.join(WORK, e.file.replace(/\.js$/, '.red'));
      fs.writeFileSync(file, text);
    }
    list.push({ id: e.file, file, text });
  }
  for (const f of fs.readdirSync(path.join(ROOT, 'test/fixtures'))) {
    const file = path.join(ROOT, 'test/fixtures', f);
    list.push({ id: f, file, text: fs.readFileSync(file, 'utf8'), fixture: true });
  }
  const hof = JSON.parse(fs.readFileSync(path.join(ROOT, 'warriors/encyclopedia.json'), 'utf8')).hallOfFame;
  for (const h of hof) {
    if (/Frontwards/.test(h.url)) continue; // written for '94x rules
    try {
      const { text } = await fetchWarriorText(h.url);
      const file = path.join(WORK, `${list.length}-${decodeURIComponent(h.url.split('/').pop())}`);
      fs.writeFileSync(file, text);
      list.push({ id: h.name, file, text });
    } catch (e) {
      console.warn(`skipping ${h.name}: ${e.message}`);
    }
  }
  return list;
}

function pmarsListing(file) {
  const lines = pmars(['-r', '1', '-c', '1', file]).split(/\r?\n/);
  const ins = [];
  let start = 0;
  let inProg = false;
  for (const l of lines) {
    if (l.startsWith('Program "')) { inProg = true; continue; }
    if (!inProg) continue;
    const m = /^(\S*)\s+([A-Z]{3})\.(AB|BA|A|B|F|X|I)\s+([#$*@{<}>])\s*(-?\d+),\s*([#$*@{<}>])\s*(-?\d+)/.exec(l);
    if (m) {
      if (m[1] === 'START') start = ins.length;
      ins.push({ op: m[2] === 'CMP' ? 'SEQ' : m[2], mod: m[3], aMode: m[4], a: +m[5], bMode: m[6], b: +m[7] });
    } else if (ins.length && !l.trim()) break;
  }
  return { ins, start };
}

function checkAsm(ws) {
  const diffs = [];
  for (const w of ws) {
    const ours = compile(w.text);
    const theirs = pmarsListing(w.file);
    const same = ours.ok && theirs.ins.length === ours.instructions.length && ours.start === theirs.start &&
      ours.instructions.every((a, k) => {
        const b = theirs.ins[k];
        return a.op === b.op && a.mod === b.mod && a.aMode === b.aMode && a.bMode === b.bMode && norm(a.a) === norm(b.a) && norm(a.b) === norm(b.b);
      });
    if (!same) diffs.push(w.id);
  }
  return { label: 'assembler: identical instructions', total: ws.length, diffs };
}

function checkRounds(ws, per) {
  const diffs = [];
  let total = 0;
  const compiled = new Map(ws.map((w) => [w.id, compile(w.text)]));
  for (let i = 0; i < ws.length; i++) {
    for (let j = i + 1; j < ws.length; j++) {
      for (let k = 0; k < per; k++) {
        const pos = 100 + ((k * 7919 + i * 131 + j * 17) % 7801);
        const out = pmars(['-r', '1', '-b', '-k', '-F', String(pos), ws[i].file, ws[j].file]).trim().split(/\r?\n/).slice(-2);
        const [w1, t1] = out[0].split(' ').map(Number);
        const theirs = w1 ? 0 : Number(out[1].split(' ')[0]) ? 1 : t1 ? 'tie' : '?';
        const vm = new VM();
        vm.load([compiled.get(ws[i].id), compiled.get(ws[j].id)], { positions: [0, pos], firstTurn: 0 });
        vm.run();
        const ours = vm.winner === null ? 'tie' : vm.winner;
        total++;
        if (ours !== theirs) diffs.push(`${ws[i].id} vs ${ws[j].id} @${pos}: ours ${ours}, pMARS ${theirs}`);
      }
    }
  }
  return { label: 'single rounds at fixed positions', total, diffs };
}

function matchTotals(pick, rounds, F) {
  const n = pick.length;
  const out = pmars(['-r', String(rounds), '-b', '-k', '-F', String(F), ...pick.map((w) => w.file)]).trim().split(/\r?\n/).slice(-n);
  const theirs = out.map((l) => l.trim().split(/\s+/).map(Number));
  const m = runMatch(pick.map((w) => compile(w.text)), { rounds }, { fixed: F });
  // pMARS -k prints: wins ties (2 warriors) or score, rounds by survivor count..., losses (3+).
  const ours = pick.map((_, i) => {
    if (n === 2) return [m.warriors[i].wins, m.warriors[i].ties];
    const by = Array(n).fill(0);
    let losses = 0;
    for (const r of m.rounds) if (r.survivors.includes(i)) by[r.survivors.length - 1]++; else losses++;
    return [m.warriors[i].score, ...by, losses];
  });
  return JSON.stringify(ours) === JSON.stringify(theirs) ? null : `ours ${JSON.stringify(ours)} pMARS ${JSON.stringify(theirs)}`;
}

function checkMatches(ws, count, rounds) {
  const diffs = [];
  const pairs = [];
  for (let i = 0; i < ws.length; i++) for (let j = i + 1; j < ws.length; j++) if ((i * 31 + j * 7) % 13 === 0) pairs.push([ws[i], ws[j]]);
  const chosen = pairs.slice(0, count);
  chosen.forEach((p, k) => {
    const F = 100 + ((k * 2711) % 7801);
    const d = matchTotals(p, rounds, F);
    if (d) diffs.push(`${p[0].id} vs ${p[1].id} -F ${F}: ${d}`);
  });
  return { label: `${rounds}-round 2-warrior matches`, total: chosen.length, diffs };
}

function checkPSpace(ws, rounds) {
  const diffs = [];
  let total = 0;
  const fixtures = ws.filter((w) => w.fixture);
  const opponents = ws.filter((w) => ['dwarf.red', 'mice.red', 'scanner.red', 'silk.red', 'impring.red', 'seeker.red'].includes(w.id)).concat(fixtures);
  for (const a of fixtures) {
    for (const b of opponents) {
      if (a === b) continue;
      for (const F of [150, 2222, 5555]) {
        total++;
        const d = matchTotals([a, b], rounds, F);
        if (d) diffs.push(`${a.id} vs ${b.id} -F ${F}: ${d}`);
      }
    }
  }
  return { label: `${rounds}-round P-space matches`, total, diffs };
}

const banner = spawnSync(PMARS, [], { encoding: 'utf8' });
const version = `${banner.stdout}${banner.stderr}`.split(/\r?\n/).find((l) => /pMARS v/.test(l)) || 'pMARS (version unknown)';
console.log(`Comparing ZoreWars with ${version.trim()}`);
const ws = await loadWarriors();
console.log(`${ws.length} warriors (library, fixtures and Hall of Fame originals)\n`);
const checks = {
  asm: () => checkAsm(ws),
  round: () => checkRounds(ws.filter((w) => !w.fixture), QUICK ? 1 : 2),
  match: () => checkMatches(ws, QUICK ? 30 : 100, 20),
  pspace: () => checkPSpace(ws, 30),
};
let failed = 0;
for (const [name, run] of Object.entries(checks)) {
  if (ONLY && !ONLY.includes(name)) continue;
  const t0 = Date.now();
  const r = run();
  const ok = r.total - r.diffs.length;
  console.log(`${r.diffs.length ? 'FAIL' : 'ok  '} ${r.label}: ${ok}/${r.total} identical (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  for (const d of r.diffs.slice(0, 10)) console.log(`       ${d}`);
  failed += r.diffs.length;
}
fs.rmSync(WORK, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
