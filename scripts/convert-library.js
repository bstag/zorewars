#!/usr/bin/env node
// Converts every Redcode warrior in the library to JavaScript and Python,
// verifies each conversion compiles to exactly the same program, writes them
// to warriors/javascript/ and warriors/python/, and lists them in
// warriors/index.json.
//   node scripts/convert-library.js

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, generateFromJS } from '../src/engine/index.js';
import { convertWarrior } from '../src/engine/convert.js';
import { pythonRunner } from '../cli/python.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const W = path.join(ROOT, 'warriors');
const index = JSON.parse(fs.readFileSync(path.join(W, 'index.json'), 'utf8'));
const originals = index.filter((e) => e.language === 'redcode' && !e.battlefield);   // plane warriors stay Redcode
const runPython = pythonRunner();
if (!runPython) {
  console.error('Python is needed to verify the Python conversions (tried python3, python, py).');
  process.exit(1);
}

const out = { javascript: path.join(W, 'javascript'), python: path.join(W, 'python') };
for (const dir of Object.values(out)) fs.mkdirSync(dir, { recursive: true });

const entries = [];
for (const e of originals) {
  const source = fs.readFileSync(path.join(W, e.file), 'utf8');
  const base = path.parse(e.file).name;
  for (const [lang, ext, toRedcode] of [['javascript', 'js', (c) => generateFromJS(c)], ['python', 'py', runPython]]) {
    const r = await convertWarrior(source, lang, { compile, toRedcode });
    const file = `${lang}/${base}.${ext}`;
    fs.writeFileSync(path.join(W, file), r.code);
    entries.push({ file, name: e.name, category: e.category, family: e.family, language: lang, convertedFrom: e.file, benchmark: false });
    console.log(`${file.padEnd(28)} ${r.level} (${r.instructions} instructions)`);
  }
}

// Replace earlier conversions in the manifest, keep everything else.
const kept = index.filter((e) => !e.convertedFrom);
fs.writeFileSync(path.join(W, 'index.json'), `[\n${[...kept, ...entries].map((e) => `  ${JSON.stringify(e)}`).join(',\n')}\n]\n`);
console.log(`\n${entries.length} conversions written and verified.`);
