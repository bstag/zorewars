import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile, VM, DEFAULT_SETTINGS, runRound, measureSpecies } from '../src/engine/index.js';
import { initSpecies } from '../web/ladder.js';
import { createSimulationRunner } from '../web/simulation.js';

function speciesDOM() {
  const elements = new Map();
  for (const id of ['speciesCard', 'speciesMap', 'speciesInfo']) elements.set(id, {
    open: true, innerHTML: '', textContent: '', listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
  });
  return { getElementById: id => elements.get(id), elements };
}

test('species map: selecting a different cell does not simulate unchanged warriors', async () => {
  const previous = globalThis.document;
  const dom = speciesDOM();
  globalThis.document = dom;
  const original = VM.prototype.load;
  let loads = 0;
  VM.prototype.load = function (...args) { loads++; return original.apply(this, args); };
  try {
    let settings = { ...DEFAULT_SETTINGS, maxCycles: 1000 };
    const slots = [{ compiled: compile('JMP 0') }];
    const map = initSpecies({ settings: () => settings, slots: () => slots, library: () => [] });
    await map.refresh();
    const measured = loads;
    assert.ok(measured > 0);
    dom.elements.get('speciesMap').listeners.click({ target: { closest: () => ({ dataset: { cell: '0,0' } }) } });
    assert.equal(loads, measured, 'selecting a map cell must only redraw it');
    await map.refresh();
    assert.equal(loads, measured, 'unchanged refreshes reuse the measurement');
    slots[0].compiled = compile('DAT 0');
    await map.refresh();
    assert.equal(loads, measured + 1, 'changed code must be measured again');
    settings = { ...settings, maxCycles: 2000 };
    await map.refresh();
    assert.equal(loads, measured + 2, 'changed rules must be measured again');
  } finally { VM.prototype.load = original; globalThis.document = previous; }
});

test('browser runner: long rounds and species measurements yield and can be cancelled', async () => {
  for (const method of ['round', 'species']) {
    const original = VM.prototype.step;
    let steps = 0, cancelled = false, yieldedAt = 0;
    VM.prototype.step = function () { steps++; return original.call(this); };
    try {
      const runner = createSimulationRunner({ cancelled: () => cancelled, yieldControl: async () => { yieldedAt = steps; cancelled = true; } });
      const w = compile('JMP 0');
      const settings = { ...DEFAULT_SETTINGS, maxCycles: 1_000_000 };
      const pspaces = [VM.freshPSpace(settings), VM.freshPSpace(settings)];
      const result = await runner[method](method === 'round' ? [w, w] : w, settings, { seed: 2, pspaces });
      assert.equal(result, null);
      assert.equal(pspaces[0][0], settings.coreSize - 1, 'an incomplete round must not record a result');
      assert.ok(yieldedAt > 0 && yieldedAt < settings.maxCycles, `${method} yielded only after ${yieldedAt} instructions`);
    } finally { VM.prototype.step = original; }
  }
});

test('browser runner: complete rounds preserve outcomes, traces, reports and P-space', async () => {
  const shapes = [{}, { topology: 'torus', sizeX: 100, sizeY: 80, sizeZ: 1 }, { topology: 'torus', sizeX: 40, sizeY: 20, sizeZ: 10 }];
  for (const shape of shapes) {
    const settings = { ...DEFAULT_SETTINGS, ...shape, maxCycles: 2000 };
    const ws = ['SPL 0\nMOV 0, 1', 'STP.AB #17, #1\nLDP.AB #1, 1\nJMP -2', 'DAT 0'].map(s => compile(s, 'redcode', settings));
    const syncPS = ws.map(() => VM.freshPSpace(settings));
    const asyncPS = ws.map(() => VM.freshPSpace(settings));
    const runner = createSimulationRunner({ yieldControl: () => Promise.resolve() });
    for (let r = 0; r < 3; r++) {
      const options = { seed: 27 + r, firstTurn: r, traceSize: 12, report: true };
      const expected = runRound(ws, settings, { ...options, pspaces: syncPS });
      assert.deepEqual(await runner.round(ws, settings, { ...options, pspaces: asyncPS }), expected);
      assert.deepEqual(asyncPS, syncPS);
    }
  }
});

test('browser runner: species metrics agree for ring, plane and volume warriors', async () => {
  const cases = [
    [{}, ['imp.red', 'silk.red', 'dwarf.red']],
    [{ topology: 'torus', sizeX: 100, sizeY: 80, sizeZ: 1 }, ['plane/planesilk.js', 'plane/columnimp.js']],
    [{ topology: 'torus', sizeX: 40, sizeY: 20, sizeZ: 10 }, ['volume/volumesilk.js', 'volume/backdraft.js']],
  ];
  const runner = createSimulationRunner({ yieldControl: () => Promise.resolve() });
  for (const [shape, files] of cases) {
    const settings = { ...DEFAULT_SETTINGS, ...shape, maxCycles: 10000 };
    for (const file of files) {
      const source = fs.readFileSync(new URL('../warriors/' + file, import.meta.url), 'utf8');
      const w = compile(source, file.endsWith('.js') ? 'javascript' : 'redcode', settings);
      assert.deepEqual(await runner.species(w, settings), measureSpecies(w, settings), file);
    }
  }
  assert.equal(measureSpecies(compile('DAT 0'), { maxCycles: 0 }).coverage, 0);
});

test('species map: superseded measurements cannot replace current code or rules', async () => {
  const previous = globalThis.document, dom = speciesDOM();
  globalThis.document = dom;
  try {
    let settings = { ...DEFAULT_SETTINGS, maxCycles: 1_000_000 };
    const slots = [{ compiled: compile(';name Old\nJMP 0') }];
    const map = initSpecies({ settings: () => settings, slots: () => slots, library: () => [] });
    const old = map.refresh();
    settings = { ...settings, maxCycles: 1000 };
    slots[0].compiled = compile(';name Current\nDAT 0');
    await map.refresh();
    await old;
    assert.match(dom.elements.get('speciesInfo').innerHTML, /Current/);
    assert.doesNotMatch(dom.elements.get('speciesInfo').innerHTML, /Old/);
    dom.elements.get('speciesCard').open = false;
    dom.elements.get('speciesCard').listeners.toggle();
  } finally { globalThis.document = previous; }
});

test('species map: returning to cached rules cancels the previous library job', async () => {
  const previous = globalThis.document, dom = speciesDOM();
  globalThis.document = dom;
  try {
    const first = { ...DEFAULT_SETTINGS, maxCycles: 1000 };
    const second = { ...first, maxCycles: 200000 };
    let settings = first;
    const map = initSpecies({ settings: () => settings, slots: () => [], library: () => [{ file: 'loop.red', language: 'redcode', source: 'JMP 0' }] });
    await map.refresh();
    settings = second;
    const old = map.refresh();
    settings = first;
    await map.refresh();
    settings = second;
    await map.refresh();
    await old;
    assert.match(dom.elements.get('speciesMap').innerHTML, /class="sp-lib"/, 'the current rules must finish measuring their library');
  } finally { globalThis.document = previous; }
});
