import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

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
  ].entries()) {
    const out = path.join(dir, String(i));
    const result = spawnSync(process.execPath, ['cli/zorewars.js', ...args, '--hill', path.join(dir, 'missing-hill'), '--out', out], { encoding: 'utf8' });
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /representation|epsilon|select|algorithm|outcome|racing|league/i);
    assert.equal(fs.existsSync(out), false);
  }
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
