import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile, DEFAULT_SETTINGS, RULESETS } from '../src/engine/index.js';
import { fieldKey, fieldSettings, battlefieldSettings } from '../web/battlefield.js';
import { rulesHint } from '../web/rules-hint.js';

const ring = Object.freeze({ ...DEFAULT_SETTINGS });
const plane = Object.freeze({ ...ring, ...fieldSettings('torus:100x80') });
const readWarrior = file => fs.readFileSync(new URL(`../warriors/${file}`, import.meta.url), 'utf8');
const suggest = (source, settings = ring, context = {}, language = 'redcode') =>
  rulesHint(compile(source, language, settings), { settings, ...context });

test('battlefield settings round-trip ring, plane and volume selections', () => {
  for (const field of ['ring', 'torus:100x80', 'torus:40x20x10']) {
    const settings = battlefieldSettings(field);
    assert.equal(fieldKey(settings), field);
    assert.equal(settings.dialect, undefined);
    assert.equal(settings.rulesName, '');
  }
  assert.equal(fieldKey({ ...plane, sizeZ: undefined }), 'torus:100x80');
  assert.equal(battlefieldSettings('ring').coreSize, 8000);
  assert.equal(battlefieldSettings('torus:40x20x10').coreSize, 8000);
});

test('3D suggestions clear hill restrictions so Use these rules compiles the warrior', () => {
  const source = readWarrior('volume/lift.js');
  const current = Object.freeze({ ...ring, ...RULESETS['88'], rulesName: '88' });
  const before = compile(source, 'javascript', current);
  assert.match(before.errors[0].message, /is for a 3D battlefield/);
  // The previous hint changed only geometry, retaining the incompatible dialect.
  const oldSettings = { ...current, ...fieldSettings('torus:40x20x10') };
  assert.equal(compile(source, 'javascript', oldSettings).ok, false);
  for (const context of [{}, { entry: { battlefield: 'torus:80x10x10' } }]) {
    const hint = suggest(source, current, context, 'javascript');
    assert.equal(fieldKey(hint.settings), context.entry?.battlefield ?? 'torus:40x20x10');
    assert.equal(hint.settings.rulesName, '');
    assert.equal(hint.settings.dialect, undefined);
    assert.equal(hint.settings.pSpace, undefined);
    assert.equal(hint.settings.assertErrors, undefined);
    assert.equal(compile(source, 'javascript', hint.settings).ok, true);
    assert.match(hint.text, /3D battlefield/);
  }
  assert.equal(current.dialect, '88', 'suggestions must not mutate the arena');
});

test('plane suggestions use real generator errors and disappear on compatible settings', () => {
  const source = readWarrior('plane/climber.js');
  const hint = suggest(source, ring, {}, 'javascript');
  assert.equal(fieldKey(hint.settings), 'torus:100x80');
  assert.match(hint.text, /100×80/);
  assert.equal(compile(source, 'javascript', hint.settings).ok, true);
  assert.equal(suggest(source, hint.settings, {}, 'javascript'), null);
});

test('library home geometry wins over length failures without switching successful builds', () => {
  const source = Array(21).fill('NOP').join('\n');
  const small = { ...ring, ...fieldSettings('torus:40x20x10') };
  const entry = { battlefield: 'torus:100x80' };
  const hint = suggest(source, small, { entry, fit: false });
  assert.equal(fieldKey(hint.settings), entry.battlefield);
  assert.match(hint.text, /100×80/);
  assert.equal(compile(source, 'redcode', hint.settings).ok, true);
  assert.equal(suggest('NOP', small, { entry, fit: false }), null);
  assert.equal(suggest('NOP', plane, { entry, fit: false }), null);
});

test('ring suggestions handle half-row limits and completed failed compatibility scans', () => {
  const source = Array(51).fill('NOP').join('\n');
  const hint = suggest(source, plane);
  assert.equal(fieldKey(hint.settings), 'ring');
  assert.equal(hint.settings.sizeX, undefined);
  assert.equal(hint.settings.coreSize, 8000);
  assert.match(hint.text, /classic ring/);
  assert.equal(compile(source, 'redcode', hint.settings).ok, true);
  assert.equal(fieldKey(suggest('NOP', plane, { fit: false }).settings), 'ring');
  for (const fit of [undefined, true]) assert.equal(suggest('NOP', plane, { fit }), null);
  assert.equal(suggest('NOP', ring, { fit: false }), null);
});

test('hill-size suggestions preserve custom rules and expand only necessary limits', () => {
  const source = ';assert CORESIZE == 16000\n' + Array(7).fill('NOP').join('\n');
  const current = Object.freeze({ ...ring, maxLength: 5, maxCycles: 1234 });
  const hint = suggest(source, current);
  assert.equal(hint.settings.coreSize, 16000);
  assert.equal(hint.settings.maxLength, 7);
  assert.equal(hint.settings.maxCycles, 1234);
  assert.match(hint.text, /max length 7/);
  assert.equal(compile(source, 'redcode', hint.settings).warnings.length, 0);
  assert.equal(compile(source, 'redcode', hint.settings).ok, true);
  assert.equal(suggest(source, hint.settings), null);
  assert.equal(suggest(';assert CORESIZE == 16000\nNOP').settings.maxLength, ring.maxLength);
  assert.equal(suggest(Array(6).fill('NOP').join('\n'), current).settings.coreSize, ring.coreSize);
  assert.equal(current.maxLength, 5);
});

test('X-hill assertions select the full large-core preset', () => {
  const hint = suggest(';assert CORESIZE == 55440\nNOP');
  assert.equal(hint.settings.coreSize, 55440);
  assert.equal(hint.settings.maxProcesses, 10000);
  assert.equal(hint.settings.maxCycles, 500000);
  assert.equal(hint.settings.maxLength, 200);
  assert.equal(hint.settings.minDistance, 200);
});

test('absent, unrelated and already satisfied diagnostics do not suggest changes', () => {
  assert.equal(rulesHint(null, { settings: ring }), null);
  assert.equal(rulesHint({}, { settings: ring }), null);
  assert.equal(suggest('not-an-opcode'), null);
  assert.equal(rulesHint({ warnings: [{ message: ';assert CORESIZE == 8000 is false under these rules' }] }, { settings: ring }), null);
  const volume = { ...ring, ...fieldSettings('torus:40x20x10') };
  assert.equal(rulesHint({ errors: [{ message: 'is for a 3D battlefield' }] }, { settings: volume }), null);
});
