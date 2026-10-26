import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { scanLibraryFit } from '../web/library-fit.js';
import { compile, fitsBattlefield, VM, DEFAULT_SETTINGS } from '../src/engine/index.js';

const plane = { ...DEFAULT_SETTINGS, topology: 'torus', coreSize: 8000, sizeX: 100, sizeY: 80, sizeZ: 1 };
const entry = (source, file = 'test.red') => ({ source, file, name: file, language: 'redcode' });

test('library fit: yields and cancels inside one long-running warrior', async () => {
  const maxCycles = 1_000_000;
  const controller = new AbortController();
  const original = VM.prototype.step;
  let steps = 0, stepsAtYield = null;
  VM.prototype.step = function () { steps++; return original.call(this); };
  let result;
  try {
    result = await scanLibraryFit([entry('JMP 0')], { ...plane, maxCycles }, {
      signal: controller.signal,
      yieldControl: async () => { stepsAtYield = steps; controller.abort(); },
    });
  } finally { VM.prototype.step = original; }
  assert.ok(stepsAtYield > 0 && stepsAtYield < maxCycles, `browser got control only after ${stepsAtYield} steps`);
  assert.equal(result, null, 'a cancelled scan must not publish a result');
});

test('library fit: checks the full cycle limit, including a late suicide', async () => {
  const warrior = entry('outer MOV.AB #5000, inner\ninner DJN.B inner, #5000\n      DJN.B outer, #50\n      DAT 0');
  for (const [maxCycles, survives] of [[100_000, true], [300_000, false]]) {
    const settings = { ...plane, maxCycles };
    assert.equal(fitsBattlefield(compile(warrior.source, 'redcode', settings), settings), survives);
    const fit = await scanLibraryFit([warrior], settings);
    assert.equal(fit.get(warrior.file), survives);
  }
});

test('library fit: library classifications and Python mirrors match the existing engine', async () => {
  const root = new URL('../warriors/', import.meta.url);
  const files = ['imp.red', 'dwarf.red', 'stoneimp.red', 'plane/columnimp.js', 'plane/planesilk.js', 'volume/volumesilk.js'];
  const library = files.map((file) => ({
    file, source: fs.readFileSync(new URL(file, root), 'utf8'), name: file,
    language: file.endsWith('.js') ? 'javascript' : 'redcode',
    ...(file.startsWith('plane/') || file.startsWith('volume/') ? { battlefield: 'torus' } : {}),
  }));
  library.push(entry('FOO 0', 'invalid.red'));
  library.push({ file: 'imp.py', language: 'python', convertedFrom: 'imp.red' });
  library.push({ file: 'column.py', language: 'python', convertedFrom: 'plane/columnimp.js' });
  library.push({ file: 'dwarf.py', name: 'dwarf.red (Python)', language: 'python' });
  library.push({ file: 'unknown.py', name: 'Unknown (Python)', language: 'python' });
  for (const settings of [DEFAULT_SETTINGS, plane, { ...plane, sizeX: 40, sizeY: 20, sizeZ: 10 }]) {
    const cfg = { ...settings, maxCycles: 2000 };
    const fit = await scanLibraryFit(library, cfg);
    for (const e of library.filter((e) => e.language !== 'python')) {
      const expected = e.battlefield && cfg.topology !== 'torus' ? false : fitsBattlefield(compile(e.source, e.language, cfg), cfg);
      assert.equal(fit.get(e.file), expected, `${e.file} on ${cfg.sizeX || 'ring'}`);
    }
    assert.equal(fit.get('imp.py'), fit.get('imp.red'));
    assert.equal(fit.get('column.py'), fit.get('plane/columnimp.js'));
    assert.equal(fit.get('dwarf.py'), fit.get('dwarf.red'));
    assert.equal(fit.get('unknown.py'), cfg.topology !== 'torus');
  }
});

test('library fit: an already cancelled scan does not compile or return classifications', async () => {
  const controller = new AbortController();
  controller.abort();
  const warrior = { ...entry(''), get source() { throw Error('must not compile'); } };
  assert.equal(await scanLibraryFit([warrior], plane, { signal: controller.signal }), null);
});

test('library fit: identical emitted programs share a solo run, including failures', async () => {
  const library = [entry('JMP 0', 'loop.red'), entry(';name Twin\nJMP 8000', 'twin.red'),
    entry('DAT 0', 'dead.red'), entry(';name Dead twin\nDAT 0', 'dead-twin.red'),
    entry('JMP 0\nDAT 0', 'start.red'), entry('ORG 1\nJMP 0\nDAT 0', 'other-start.red')];
  const original = VM.prototype.load;
  let loads = 0;
  VM.prototype.load = function (...args) { loads++; return original.apply(this, args); };
  try {
    const fit = await scanLibraryFit(library, { ...plane, maxCycles: 1000 });
    assert.equal(loads, 4, 'duplicates should not execute another solo battle');
    assert.deepEqual([...fit.values()], [true, true, false, false, true, false]);
    await scanLibraryFit(library, { ...plane, maxCycles: 1000 });
    assert.equal(loads, 8, 'results belong to a single scan');
  } finally { VM.prototype.load = original; }
});
