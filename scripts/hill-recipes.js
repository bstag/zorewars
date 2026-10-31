#!/usr/bin/env node
// Tags every warrior on a Koenigstuhl hill with the parts it is built from
// (opening, boot, bodies, insurance, finisher) for docs/hill-recipe-book.md.
//   node scripts/hill-recipes.js [--hill 94nop] [--top 2000] [--out docs/hill-recipe-index.json]
// Signals: the warrior's comments, its compiled code and a solo run. The tags
// are heuristics: the book's family sections were checked against the source.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, measureSpecies } from '../src/engine/index.js';
import { hillFiles } from '../cli/devtools-context.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const flags = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) flags[argv[i].slice(2)] = argv[++i];
const hill = flags.hill ?? '94nop', top = Number(flags.top ?? 2000);
const out = flags.out ?? path.join(ROOT, 'docs/hill-recipe-index.json');
const DIRS = { '94nop': '94', '88': '88', lp: 'LP', '94x': 'X' };
const settings = { maxLength: 200, pSpace: undefined };

// Comment tags: what the author says the warrior does.
const TEXT = {
  qscan: /q-?scan|quick-?scan|\bq\^?\d|q\^|quickscanner|\bqs\b/,
  boot: /\bboot/,
  decoy: /decoy/,
  paper: /paper|silk|replicat|reproduc|\bmice\b|clone/,
  stone: /stone|bomber|bombing|dwarf|\bbomb/,
  scanner: /(?<!q-?|quick-?|quick )scanner|\bscans?\b(?! ?(once|first))|scissors|\bcmp-?scan|b-?scan|blur|agony|hunter/,
  oneshot: /one-?shot/,
  clear: /clear|\bclr\b/,
  imp: /\bimps?\b|spiral|imp-?ring|vortex|impring|imp-?gate/,
  vampire: /vamp|\bfang|\bpit\b/,
  stun: /stun|incendiar|spl[ -]?bomb|spl[ -]?carpet/,
  pspace: /p-?space|\bswitch|brainwash/,
  evolved: /evolv|\bga\b|genetic/,
};

const dist = (x) => Math.abs((((x + 4000) % 8000) + 8000) % 8000 - 4000);
const big = (x) => dist(x) > 100;

// Code tags: shapes a part leaves in the compiled instructions.
function codeTags(ins) {
  const t = new Set();
  const cmps = ins.filter((i) => ['SEQ', 'SNE', 'CMP'].includes(i.op) && big(i.a) && big(i.b));
  if (cmps.length >= 6) t.add('qscan');
  // silk: SPL @0 plus a copy with incrementing/decrementing pointers on both sides
  if (ins.some((i) => i.op === 'SPL' && i.aMode === '@' && i.a === 0)
    && ins.some((i) => i.op === 'MOV' && '}<{>'.includes(i.aMode) && '><}'.includes(i.bMode))) t.add('paper');
  // imp: MOV.I to a step with N * step = 1 (mod 8000)
  if (ins.some((i) => i.op === 'MOV' && i.mod === 'I' && i.bMode === '$'
    && [3, 5, 7, 9, 11, 13, 17, 19, 21, 23, 27, 29, 31].some((n) => (((i.b % 8000) + 8000) * n) % 8000 === 1))) t.add('imp');
  // clear: a tight loop moving a bomb through a nearby incrementing pointer
  const clearMov = (m) => m.op === 'MOV' && '$*@'.includes(m.aMode) && '>}'.includes(m.bMode) && dist(m.b) < 30;
  if (ins.some((i, k) => i.op === 'SPL' && (i.aMode === '#' || i.a === 0) && ins.slice(k + 1, k + 5).some(clearMov)
      && ins.slice(k + 1, k + 6).some((j, d) => (j.op === 'DJN' || j.op === 'JMP') && j.a !== 0 && dist(j.a) <= d + 1))
    || ins.some((i, k) => clearMov(i) && ins.slice(k + 1, k + 4).some((j) => (j.op === 'DJN' || j.op === 'JMP') && (j.a + 8000) % 8000 > 7990))) t.add('clear');
  let run = 0;
  for (const i of ins) { run = i.op === 'DAT' && (i.a || i.b) ? run + 1 : 0; if (run >= 6) t.add('decoy'); }
  if (ins.some((i) => i.op === 'LDP' || i.op === 'STP')) t.add('pspace');
  return t;
}

const files = await hillFiles(`koenigstuhl:${hill}`, top, true);
const byName = new Map(files.map((f) => [path.basename(f).toLowerCase(), f]));
const listing = await (await fetch(`https://asdflkj.net/COREWAR/${DIRS[hill]}/hill32_rec.html`)).text();
const ranked = [...listing.matchAll(/^\s*(\d+)\s+<a href="HILL32\/([^"]+)">([^<]*)<\/a>\s+(.*?)\s+([\d.]+)\s+\((\w+)\)/gm)]
  .map((m) => ({ rank: +m[1], file: m[2], name: m[3].trim(), author: m[4].trim(), score: +m[5] })).slice(0, top);

const rows = [];
for (const r of ranked) {
  const f = byName.get(r.file.toLowerCase());
  if (!f) continue;
  const src = fs.readFileSync(f, 'latin1');
  const comments = src.split(/\r?\n/).filter((l) => l.includes(';')).map((l) => l.slice(l.indexOf(';') + 1)).join(' ');
  const strategy = src.split(/\r?\n/).filter((l) => /^\s*;\s*strat/i.test(l)).map((l) => l.replace(/^\s*;\s*strategy\s*/i, '')).join(' ').trim();
  let w;
  try { w = compile(src, 'redcode', settings); } catch { continue; }
  if (w.ok === false || !w.instructions?.length) continue;
  const text = `${r.name} ${r.author} ${comments}`.toLowerCase();
  const parts = new Set(Object.entries(TEXT).filter(([, re]) => re.test(text)).map(([k]) => k));
  for (const k of codeTags(w.instructions)) parts.add(k);
  if (parts.has('oneshot')) parts.delete('scanner');
  const s = measureSpecies(w, settings);
  const order = [...Object.keys(TEXT)];
  rows.push({ ...r, length: w.instructions.length, parts: order.filter((k) => parts.has(k)),
    alone: { hint: s.hint, processes: s.processes, cells: s.coverage, survives: s.survives }, strategy: strategy.slice(0, 200) });
}
fs.writeFileSync(out, JSON.stringify({ hill, retrievedAt: new Date().toISOString(), warriors: rows }, null, 1) + '\n');

const pct = (n, d) => `${Math.round((100 * n) / d)}%`;
const bands = [[1, 50], [51, 200], [201, 500], [501, Infinity]];
for (const [a, b] of bands) {
  const l = rows.filter((r) => r.rank >= a && r.rank <= b), m = {};
  for (const r of l) for (const p of r.parts) m[p] = (m[p] ?? 0) + 1;
  console.log(`ranks ${a}-${b === Infinity ? 'end' : b} (${l.length}): ${Object.entries(m).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${pct(v, l.length)}`).join(', ')}`);
}
console.log(`${rows.length} warriors -> ${path.relative(ROOT, out)}`);
