import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { nativeAddonURL } from '../tools/ring-duel-native.js';
import { ringDuelWasmURL } from '../src/engine/ring-duel-wasm.js';

const run = (...args) => {
  const result = spawnSync(process.execPath, ['cli/zorewars.js', ...args, '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
};

test('tree CLI writes loadable champions and resumes a ladder with earlier champions', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zorewars-tree-cli-'));
  const hill = path.join(dir, 'hill');
  fs.mkdirSync(hill);
  fs.writeFileSync(path.join(hill, 'imp.red'), ';name Imp\nMOV.I 0, 1\n');
  fs.writeFileSync(path.join(hill, 'loop.red'), ';name Loop\nJMP 0\n');
  const start = path.join(dir, 'start.json');
  fs.writeFileSync(start, JSON.stringify({ id: 'mod-stone', P: { STEP: 2936, BOMBS: 1, GUARD: 1 } }));
  const common = ['evolve', '--representation', 'tree', '--hill', hill, '--start', start,
    '--generations', '1', '--batch', '1', '--rounds', '1', '--race', '0', '--threads', '1'];
  const out = path.join(dir, 'search');
  const search = run(...common, '--out', out, '--place', 'none');
  assert.equal(search.history.length, 1);
  assert.ok(search.archive.length > 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, 'best.json'), 'utf8')), search.finalists?.[0]?.tree);
  assert.ok(run('check', path.join(out, 'best.red')).ok);
  const ladderOut = path.join(dir, 'ladder');
  const ladder = run(...common, '--out', ladderOut, '--ladder', '2', '--champions', start,
    '--cap', '1', '--sample', '0', '--clear-place', '3', '--clear-rounds', '1', '--place-rounds', '1');
  assert.equal(ladder.rungs[0].skipped, true);
  assert.equal(ladder.reached, 1);
  assert.ok(ladder.champion && ladder.top30);
  assert.ok(run('check', path.join(ladderOut, 'best.red')).ok);
});

test('invalid search and training options fail before creating output', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zorewars-invalid-evolution-'));
  for (const [i, args] of [
    ['train', '--representation', 'tree'],
    ['evolve', '--representation', 'tree', '--lex-epsilon', '-0.1'],
    ['evolve', '--representation', 'tree', '--lex-epsilon', 'NaN'],
    ['evolve', '--representation', 'tree', '--select', 'unknown'],
    ['evolve', '--algorithm', 'unknown'],
    ['evolve', '--algorithm', 'ga', '--descriptor', 'outcomes'],
    ['evolve', '--algorithm', 'ga', '--race', '1'],
    ['evolve', '--league', '--scratch'],
    ['evolve', '--representation', 'blocks', '--checkpoint', 'checkpoint.json'],
    ['train', '--checkpoint', 'checkpoint.json'],
  ].entries()) {
    const out = path.join(dir, String(i));
    const result = spawnSync(process.execPath, ['cli/zorewars.js', ...args, '--hill', path.join(dir, 'missing-hill'), '--out', out], { encoding: 'utf8' });
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /representation|epsilon|select|algorithm|outcome|racing|league|checkpoint/i);
    assert.equal(fs.existsSync(out), false);
  }
});

test('instruction CLI resumes a saved field and produces the same validated run', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zorewars-checkpoint-cli-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const hill = path.join(dir, 'hill');
  fs.mkdirSync(hill);
  const opponent = path.join(hill, 'imp.red');
  fs.writeFileSync(opponent, ';name Imp\nMOV.I 0, 1\n');
  const uninterrupted = path.join(dir, 'uninterrupted');
  const paused = path.join(dir, 'paused');
  const resumed = path.join(dir, 'resumed');
  const checkpoint = path.join(paused, 'run.json');
  const common = ['evolve', '--rules', 'nano', '--hill', hill, '--seed', '487',
    '--cycles', '100', '--batches', '1', '--batch', '3', '--threads', '1',
    '--eval-rounds', '2', '--validate', '--check-rounds', '2', '--seeds', '2'];
  run(...common, '--generations', '3', '--out', uninterrupted);
  const backend = fs.existsSync(nativeAddonURL) ? ['--native'] : [];
  const started = run(...common, ...backend, '--generations', '2', '--out', paused,
    '--checkpoint', checkpoint, '--stop-after', '1');
  assert.deepEqual(started, { ok: true, paused: true, generation: 1, checkpoint });
  assert.equal(fs.existsSync(path.join(paused, 'evolve.json')), false);
  fs.unlinkSync(opponent);
  const nextBackend = fs.existsSync(ringDuelWasmURL) ? ['--wasm'] : ['--backend', 'cpu'];
  const continued = run('evolve', '--resume', checkpoint, '--generations', '3', ...nextBackend,
    '--stop-after', '2', '--out', resumed);
  assert.deepEqual(continued, { ok: true, paused: true, generation: 2, checkpoint });
  run('evolve', '--resume', checkpoint, '--backend', 'cpu');
  for (const file of fs.readdirSync(uninterrupted)) {
    assert.deepEqual(fs.readFileSync(path.join(resumed, file)), fs.readFileSync(path.join(uninterrupted, file)), file);
  }
  const saved = JSON.parse(fs.readFileSync(checkpoint, 'utf8'));
  assert.equal(saved.state.round, 3);
  assert.equal(saved.options.rounds, 3);
  assert.equal(saved.cli.execution.backend, 'cpu');
  const rejected = spawnSync(process.execPath, ['cli/zorewars.js', 'evolve', '--resume', checkpoint, '--seed', '42'], { encoding: 'utf8' });
  assert.equal(rejected.status, 2, rejected.stderr);
  assert.match(rejected.stderr, /saved warriors and search settings/);
});

test('numeric tree tuning preserves structure in search and ladder runs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zorewars-tune-tree-'));
  const hill = path.join(dir, 'hill'); fs.mkdirSync(hill);
  fs.writeFileSync(path.join(hill, 'imp.red'), ';name Imp\nMOV.I 0, 1\n');
  fs.writeFileSync(path.join(hill, 'loop.red'), ';name Loop\nJMP 0\n');
  const start = path.join(dir, 'start.json');
  fs.writeFileSync(start, JSON.stringify({ id: 'mod-stone', P: { STEP: 2936, BOMBS: 1, GUARD: 1 } }));
  const args = ['evolve', '--representation', 'tree', '--hill', hill, '--start', start, '--tune',
    '--generations', '1', '--batch', '1', '--rounds', '1', '--race', '0', '--threads', '1', '--seed', '5'];
  const search = run(...args, '--place', 'none', '--out', path.join(dir, 'search'));
  assert.ok(search.archive.every(e => e.shape === 'mod-stone'));
  const ladder = run(...args, '--ladder', '2', '--cap', '1', '--sample', '0',
    '--clear-rounds', '1', '--place-rounds', '1', '--out', path.join(dir, 'ladder'));
  assert.equal(ladder.generations, 1, 'exercise breeding rather than a skipped rung');
  assert.equal(ladder.champion.shape, 'mod-stone');
  assert.ok(ladder.rungs.every(e => e.champion.shape === 'mod-stone'));
});

test('hill and pushoff retain local opponent loading after CLI separation', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zorewars-hill-cli-'));
  fs.writeFileSync(path.join(dir, 'imp.red'), ';name Imp\nMOV.I 0, 1\n');
  const hill = run('hill', '@dwarf', '--hill', dir, '--rounds', '1', '--cycles', '300', '--threads', '1');
  assert.equal(hill.opponents[0].name, 'Imp');
  const push = run('pushoff', '@dwarf', '--hill', dir, '--rounds', '1', '--cycles', '300', '--threads', '1');
  assert.equal(push.ranking.length, 2);
  assert.equal(push.ranking.filter(x => x.entry).length, 1);
});
