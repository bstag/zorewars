// Audit extracted Koenigstuhl source and ranking snapshots without network access.
// Usage: node scripts/hill-archive-census.js <snapshot-directory> [field]
// Layout: <key>.html and <key>/HILL32/ (or <key>/HILL/) for each field.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { compile, RULESETS } from '../src/engine/index.js';

const [root, field] = process.argv.slice(2);
if (!root) throw new Error('Usage: node scripts/hill-archive-census.js <snapshot-directory> [field]');

const fields = {
  '88': ['88', RULESETS['88']],
  '94nop': ['94', RULESETS['94nop']],
  pspace: ['PSPACE', { pSpace: true }],
  icws64: ['ICWS64', { ...RULESETS['88'], coreSize: 8192, maxProcesses: 64 }],
  icws: ['ICWS', { ...RULESETS['88'], coreSize: 8192, maxCycles: 100000 }],
  lp: ['LP', { ...RULESETS.lp, maxLength: 200, pSpace: true }],
  '94x': ['X', RULESETS['94x-hill']],
  tiny: ['TINY', { coreSize: 800, maxCycles: 8000, maxProcesses: 800, maxLength: 20, minDistance: 20 }],
  nano: ['NANO', { coreSize: 80, maxCycles: 800, maxProcesses: 80, maxLength: 5, minDistance: 5 }],
  odd: ['ODD', { maxLength: 800, minDistance: 800 }],
};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceFile = name => !name.startsWith('.') && /\.(?:red|rc|txt)$/i.test(name);
const operators = (instructions, names) => instructions.some(ins => names.includes(ins.op));

function sourceDecade(source) {
  const date = source.match(/^\s*;\s*date\b([^\r\n]*)/im)?.[1];
  const years = new Set(date?.match(/\b(?:19[89]\d|20[0-2]\d)\b/g));
  return years.size === 1 ? `${Math.floor(Number([...years][0]) / 10) * 10}s` : 'undated';
}

function summarize(rows) {
  const lengths = rows.map(r => r.length).sort((a, b) => a - b);
  const half = Math.floor(lengths.length / 2);
  return {
    assembled: rows.length,
    medianLength: !lengths.length ? null : (lengths[half] + lengths[Math.floor((lengths.length - 1) / 2)]) / 2,
    split: rows.filter(r => r.split).length,
    compare: rows.filter(r => r.compare).length,
    pSpace: rows.filter(r => r.pSpace).length,
    indirectSideEffects: rows.filter(r => r.indirectSideEffects).length,
  };
}

function census(key, dir, overrides) {
  const base = `https://asdflkj.net/COREWAR/${dir}/`;
  const ranking = key === 'odd' ? 'hill32.html' : 'hill32_rec.html';
  const html = fs.readFileSync(path.join(root, `${key}.html`));
  const ranked = [...html.toString('latin1').matchAll(/^\s*(\d+)\s+<a href="(HILL(?:32)?\/[^"]+)">[^<]*<\/a>/gim)]
    .map(([, rank, href]) => ({ rank: Number(rank), name: decodeURIComponent(path.basename(href)) }));
  if (!ranked.length) throw new Error(`No ranked source links in ${key}.html`);
  const settings = {
    coreSize: 8000, maxCycles: 80000, maxProcesses: 8000, maxLength: 100, minDistance: 100,
    pSpace: true, assertErrors: true, ...overrides,
  };
  const sourceRoot = path.join(root, key);
  const sources = new Map();
  for (const sub of ['HILL', 'HILL32']) {
    const folder = path.join(sourceRoot, sub);
    if (!fs.existsSync(folder)) continue;
    for (const name of fs.readdirSync(folder).filter(sourceFile).sort()) {
      const id = name.toLowerCase();
      if (sources.has(id)) throw new Error(`Ambiguous source in ${key}: ${name}`);
      sources.set(id, path.join(folder, name));
    }
  }

  const rows = [], failed = [], missing = [], receipts = [];
  const matched = new Set();
  for (const { rank, name } of ranked) {
    const id = name.toLowerCase();
    const file = sources.get(id);
    if (!file) {
      missing.push(name);
      continue;
    }
    matched.add(id);
    const bytes = fs.readFileSync(file);
    receipts.push([name, hash(bytes)]);
    const source = bytes.toString('latin1');
    const w = compile(source, 'redcode', settings);
    if (!w.ok) {
      failed.push({ name, reason: w.errors[0].message });
      continue;
    }
    rows.push({
      rank, length: w.instructions.length, decade: sourceDecade(source),
      split: operators(w.instructions, ['SPL']), compare: operators(w.instructions, ['SEQ', 'CMP', 'SNE']),
      pSpace: operators(w.instructions, ['LDP', 'STP']),
      indirectSideEffects: w.instructions.some(ins => /[<>{}]/.test(ins.aMode) || /[<>{}]/.test(ins.bMode)),
    });
  }
  const decades = {};
  for (const decade of [...new Set(rows.map(r => r.decade))].sort()) {
    decades[decade] = summarize(rows.filter(r => r.decade === decade));
  }
  return {
    ranking: base + ranking, rankingSha256: hash(html), matchedSourcesSha256: hash(JSON.stringify(receipts)),
    settings, ranks: ranked.length, matched: matched.size, unmatchedArchiveFiles: sources.size - matched.size,
    missingSources: missing.length, missingExamples: missing.slice(0, 5),
    assemblyFailures: failed.length, failureExamples: failed.slice(0, 5),
    all: summarize(rows), top50: summarize(rows.filter(r => r.rank <= 50)),
    otherRanks: summarize(rows.filter(r => r.rank > 50)), decades,
  };
}

if (field && !Object.hasOwn(fields, field)) throw new Error(`Unknown field: ${field}`);
const selected = field ? [[field, fields[field]]] : Object.entries(fields);
const hills = Object.fromEntries(selected.map(([key, [dir, settings]]) => [key, census(key, dir, settings)]));
console.log(JSON.stringify({ schema: 'koenigstuhl-census-v1', hills }, null, 2));
