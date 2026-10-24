import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, generateFromJS } from '../src/engine/index.js';
import { convertWarrior, conversionCandidates, sameProgram } from '../src/engine/convert.js';
import { pythonRunner } from '../cli/python.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const index = JSON.parse(read('warriors/index.json'));
const runPython = pythonRunner();
const toJS = (code) => generateFromJS(code);

test('every library warrior converts to readable, verified JavaScript', async () => {
  for (const e of index.filter((x) => x.language === 'redcode')) {
    const r = await convertWarrior(read(`warriors/${e.file}`), 'javascript', { compile, toRedcode: toJS });
    assert.equal(r.level, 'readable', e.file);
  }
});

test('committed conversions compile to the same program as their originals', () => {
  for (const e of index.filter((x) => x.convertedFrom && x.language === 'javascript')) {
    const conv = compile(read(`warriors/${e.file}`), 'javascript');
    assert.ok(sameProgram(compile(read(`warriors/${e.convertedFrom}`)), conv), e.file);
  }
});

test('committed Python conversions compile to the same program', { skip: !runPython && 'Python not installed' }, () => {
  for (const e of index.filter((x) => x.convertedFrom && x.language === 'python')) {
    const conv = compile(runPython(read(`warriors/${e.file}`)));
    assert.ok(sameProgram(compile(read(`warriors/${e.convertedFrom}`)), conv), e.file);
  }
});

test('FOR loops become real loops, with & labels and CURLINE', async () => {
  const src = `;name Loops
n     EQU 3
i     FOR n
bomb&i DAT #i, #i*(CORESIZE/4)
      ROF
start JMP bomb02
pad   FOR MAXLENGTH-CURLINE
      DAT 0, 0
      ROF
      END start`;
  const js = conversionCandidates(src, 'javascript')[0].code;
  assert.match(js, /for \(let i = 1; i <= n; i\+\+\)/);
  assert.match(js, /label\(`bomb\$\{pad2\(i\)\}`\)/);
  assert.match(js, /curline\(\)/);
  const r = await convertWarrior(src, 'javascript', { compile, toRedcode: toJS });
  assert.equal(r.level, 'readable');
});

test('numeric EQUs become constants and keep integer division semantics', async () => {
  const src = 'step EQU (CORESIZE+1)/3\nneg EQU -7/2\nr EQU -7%3\nDAT #step, #neg\nDAT #r, #0';
  const js = conversionCandidates(src, 'javascript')[0].code;
  assert.match(js, /const step = Math\.trunc\(\(CORESIZE \+ 1\) \/ 3\);/);
  const r = await convertWarrior(src, 'javascript', { compile, toRedcode: toJS });
  assert.equal(r.level, 'readable');
  if (runPython) {
    const p = await convertWarrior(src, 'python', { compile, toRedcode: runPython });
    assert.equal(p.level, 'readable');
    assert.match(p.code, /int\(math\.fmod\(/);
  }
});

test('anything the readable form gets wrong falls back to a form that matches', async () => {
  // Register assignment (pMARS a=...) has no JavaScript equivalent here.
  const src = 'SEQ a=10, b=a+5\nDAT a, b';
  const r = await convertWarrior(src, 'javascript', { compile, toRedcode: toJS });
  assert.ok(sameProgram(compile(src), compile(generateFromJS(r.code))));
});
