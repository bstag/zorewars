#!/usr/bin/env node
// Converts every Redcode warrior in the library to JavaScript and Python,
// verifies each conversion compiles to exactly the same program, writes them
// to warriors/javascript/ and warriors/python/, and lists them in
// warriors/index.json. Ring warriors that are ICWS'88 instruction for
// instruction are also written as '88 Redcode to warriors/88/ (the '88 hill
// and tournament rules), verified the same way under --rules 88.
//   node scripts/convert-library.js

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, generateFromJS, toICWS88, RULESETS } from '../src/engine/index.js';
import { convertWarrior, sameProgram } from '../src/engine/convert.js';
import { pythonRunner } from '../cli/python.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const W = path.join(ROOT, 'warriors');
const index = JSON.parse(fs.readFileSync(path.join(W, 'index.json'), 'utf8'));
const originals = index.filter((e) => e.language === 'redcode' && !e.battlefield && !e.dialect);   // plane and '88 warriors stay Redcode
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

// ICWS'88: every ring original (Redcode or JavaScript) whose code is '88.
fs.mkdirSync(path.join(W, '88'), { recursive: true });
const s94 = { ...RULESETS['94nop'], pSpace: undefined };
for (const e of index.filter((x) => !x.convertedFrom && !x.sameAs && !x.battlefield && !x.dialect && (x.language === 'redcode' || x.language === 'javascript'))) {
  const w = compile(fs.readFileSync(path.join(W, e.file), 'utf8'), e.language, s94);
  if (!w.ok) continue;
  const r = toICWS88(w);
  if (!r.ok) continue;
  const file = `88/${path.parse(e.file).name}.red`;
  if (!sameProgram(w, compile(r.code, 'redcode', RULESETS['88']))) throw new Error(`${file}: the '88 version is a different program`);
  fs.writeFileSync(path.join(W, file), r.code);
  entries.push({ file, name: e.name, category: e.category, family: e.family, language: 'redcode', dialect: '88', convertedFrom: e.file, benchmark: false });
  console.log(`${file.padEnd(28)} ICWS'88 (${w.instructions.length} instructions)`);
}

// Replace earlier conversions in the manifest, keep everything else.
const kept = index.filter((e) => !e.convertedFrom);
fs.writeFileSync(path.join(W, 'index.json'), `[\n${[...kept, ...entries].map((e) => `  ${JSON.stringify(e)}`).join(',\n')}\n]\n`);
console.log(`\n${entries.length} conversions written and verified.`);
