import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { cmdPushoff } from '../cli/devtools.js';
import { compile, DEFAULT_SETTINGS } from '../src/engine/index.js';
import { pushOff } from '../src/engine/pushoff.js';
import { battlePool } from '../cli/devtools-context.js';

const cfg = { ...DEFAULT_SETTINGS, coreSize: 800, maxCycles: 40, maxLength: 10, minDistance: 50, maxProcesses: 16 };

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zorewars-pushoff-cli-'));
  t.after(() => {
    assert.equal(path.dirname(dir), path.resolve(os.tmpdir()));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}

const usage = message => { throw new Error(message); };
const beforeLoading = () => ({ usage, settingsFrom: () => ({ ...cfg }), expandRefs: refs => refs, loadAll() { assert.fail('invalid options must fail before loading warriors'); } });

function tournament(t) {
  const dir = fixture(t), entry = path.join(dir, 'entry.red'), hill = path.join(dir, 'hill');
  fs.mkdirSync(hill);
  fs.writeFileSync(entry, ';name Entry\nJMP 0');
  fs.writeFileSync(path.join(hill, 'a.red'), ';name Imp\nMOV.I 0, 1');
  fs.writeFileSync(path.join(hill, 'b.red'), ';name Dead\nDAT 0, 0');
  fs.writeFileSync(path.join(hill, 'z-invalid.red'), 'invalid-opcode');
  const lines = [], warnings = [], tables = [], tasks = [], pools = [], loads = [];
  t.mock.method(console, 'log', line => lines.push(line));
  t.mock.method(console, 'error', line => warnings.push(line));
  const h = {
    usage, settingsFrom: () => ({ ...cfg }), expandRefs: refs => refs,
    async loadAll(refs, settings) {
      loads.push({ refs, settings: { ...settings } });
      return refs.map(file => {
        const w = compile(fs.readFileSync(file, 'utf8'), 'redcode', settings);
        assert.equal(w.ok, true, JSON.stringify(w.errors));
        return { ...w, file };
      });
    },
    printTable(rows) { tables.push(rows); },
  };
  async function createPool(flags, helpers) {
    const real = await battlePool(flags, helpers), state = { closed: 0 };
    pools.push(state);
    t.after(() => real.close());
    return { ...real,
      match(task) { tasks.push(task); return real.match(task); },
      close() { state.closed++; real.close(); },
    };
  }
  return { dir, entry, hill, h, lines, warnings, tables, tasks, pools, loads, createPool,
    flags: { hill, rounds: '2', top: '50', backend: 'cpu', threads: '1', json: true } };
}

test('pushoff rejects malformed counts and ranking options before loading', async () => {
  for (const key of ['top', 'rounds', 'seed']) {
    for (const value of ['junk', '2junk', '1.5', 'Infinity', '9007199254740992']) {
      await assert.rejects(cmdPushoff({ _: ['entry.red'], flags: { hill: 'local', [key]: value } }, beforeLoading()), new RegExp(`--${key} must be`));
    }
  }
  for (const key of ['top', 'rounds']) for (const value of ['0', '-1']) {
    await assert.rejects(cmdPushoff({ _: ['entry.red'], flags: { hill: 'local', [key]: value } }, beforeLoading()), new RegExp(`--${key} must be a positive integer`));
  }
  for (const [key, value] of [['features', 'bad'], ['features', 'constructor'], ['metric', 'bad'], ['field', 'bad']]) {
    await assert.rejects(cmdPushoff({ _: ['entry.red'], flags: { hill: 'local', rule: 'announcement', [key]: value } }, beforeLoading()), new RegExp(`unknown ${key}`));
  }
});

test('engine rejects unknown diversity options, including inherited feature names', () => {
  const scores = [[0, 1], [1, 0]], names = ['A', 'B'], result = { w: 0, l: 0, t: 1, rounds: 1 };
  for (const [key, value] of [['features', 'constructor'], ['features', 'toString'], ['metric', 'bad'], ['field', 'bad']]) {
    assert.throws(() => pushOff(scores, names, { [key]: value, results: [[result, result], [result, result]] }), new RegExp(`unknown ${key}`));
  }
  assert.deepEqual(pushOff(scores, names, { rule: 'official', features: 'bad', metric: 'bad', field: 'bad' }), pushOff(scores, names, { rule: 'official' }));
  assert.throws(() => pushOff(scores, names, { rule: 'bad' }), /unknown rule/);
});

test('scores-only replay does not load warriors or build battlefield settings', async t => {
  const dir = fixture(t), file = path.join(dir, 'legacy.json'), lines = [];
  fs.writeFileSync(file, JSON.stringify({ warriors: [{ name: 'A', entry: true }, { name: 'B', entry: false }], scores: [[0, 1], [1, 0]] }));
  t.mock.method(console, 'log', line => lines.push(line));
  await cmdPushoff({ _: [], flags: { load: file, json: true } }, {
    usage,
    settingsFrom() { assert.fail('replay must not build battlefield settings'); },
    loadAll() { assert.fail('replay must not load warriors'); },
  });
  assert.equal(JSON.parse(lines.join('')).ranking.length, 2);
});

test('replay refuses malformed matrices and missing self-fights with a clear usage error', async t => {
  const dir = fixture(t), file = path.join(dir, 'bad.json');
  fs.writeFileSync(file, JSON.stringify({ warriors: [{ name: 'A' }], scores: [[0, 1], [1, 0]] }));
  await assert.rejects(cmdPushoff({ _: [], flags: { load: file, json: true } }, beforeLoading()), /scores must be a square/);
  const result = { w: 0, l: 0, t: 2, rounds: 2 };
  fs.writeFileSync(file, JSON.stringify({ warriors: [{ name: 'A' }, { name: 'B' }], scores: [[0, 1], [1, 0]], results: [[null, result], [result, null]] }));
  await assert.rejects(cmdPushoff({ _: [], flags: { load: file, json: true, rule: 'announcement', self: true } }, beforeLoading()), /self-fight/);
});

test('a live tournament saves complete results and replays every announcement reading without battles', async t => {
  const f = tournament(t), save = path.join(f.dir, 'nested', 'results.json');
  const flags = Object.freeze({ ...f.flags, save, rounds: '1', top: '1', seed: '0' });
  await cmdPushoff({ _: [f.entry], flags }, f.h, { createPool: f.createPool });
  const live = JSON.parse(f.lines.join('')), saved = JSON.parse(fs.readFileSync(save, 'utf8'));
  assert.equal(saved.rounds, 2, 'the existing minimum of two rounds remains');
  assert.equal(saved.warriors.length, 3, 'top 1 retains the existing minimum of two hill files');
  assert.equal(saved.settings.maxLength, cfg.maxLength);
  assert.equal(f.loads[0].settings.maxLength, cfg.maxLength);
  assert.ok(saved.results.every((row, i) => row[i] && row[i].w + row[i].l + row[i].t === 2));
  assert.ok(saved.scores.every((row, i) => row[i] === 0));
  assert.equal(f.tasks.length, 6, 'saving also records the three self-fights');
  assert.equal(f.tasks[0].seed, 0);
  assert.equal(f.pools[0].closed, 1);
  f.lines.length = 0;
  const replayOnly = { usage, settingsFrom() { assert.fail('replay must not construct settings'); }, loadAll() { assert.fail('replay must not compile'); } };
  await cmdPushoff({ _: [], flags: { load: save, json: true } }, replayOnly);
  assert.deepEqual(JSON.parse(f.lines.join('')), live);
  for (const features of ['points', 'wlt', 'wl']) for (const metric of ['sd', 'eq6', 'euclid']) for (const self of [false, true]) for (const field of ['original', 'current']) {
    f.lines.length = 0;
    const variant = { features, metric, self, field };
    await cmdPushoff({ _: [], flags: { load: save, json: true, rule: 'announcement', ...variant } }, replayOnly);
    const actual = JSON.parse(f.lines.join(''));
    const expected = pushOff(saved.scores, saved.warriors.map(w => w.name), { ...variant, results: saved.results })
      .map(({ index, ...r }) => ({ ...r, entry: saved.warriors[index].entry }));
    assert.deepEqual(actual.ranking, expected, JSON.stringify(variant));
    assert.deepEqual(actual.variant, variant);
  }
  assert.equal(f.tasks.length, 6);
  assert.equal(f.loads.length, 1);
});

test('announcement self-fights work without saving, and official flags keep their override', async t => {
  const f = tournament(t);
  await cmdPushoff({ _: [f.entry], flags: { ...f.flags, rule: 'announcement', features: 'wl', metric: 'eq6', self: true, field: 'current' } }, f.h, { createPool: f.createPool });
  assert.equal(f.tasks.length, 6);
  assert.equal(JSON.parse(f.lines.join('')).variant.self, true);
  f.lines.length = 0;
  f.tasks.length = 0;
  await cmdPushoff({ _: [f.entry, f.entry], flags: { ...f.flags, seed: '-1', json: false, features: 'ignored', metric: 'ignored', field: 'ignored', self: true } }, f.h, { createPool: f.createPool });
  assert.match(f.lines.join('\n'), /2 entries \+ 2 hill warriors/);
  assert.match(f.lines.join('\n'), /★ Entry: rank/);
  assert.ok(f.tables[0].some(row => row.Warrior === '★ Entry'));
  assert.match(f.warnings.join('\n'), /skipped z-invalid.red/);
  assert.equal(f.tasks.length, 6, 'official mode ignores --self unless saving');
  assert.equal(f.tasks[0].seed, -1, 'signed integer seeds remain supported');
  assert.ok(f.pools.every(p => p.closed === 1));
});

test('hill opponents use relaxed length limits while entries retain theirs', async t => {
  const f = tournament(t), save = path.join(f.dir, 'results.json');
  f.h.settingsFrom = () => ({ ...cfg, maxLength: 1 });
  fs.writeFileSync(path.join(f.hill, 'a.red'), ';name Long\nNOP\nJMP 0');
  await cmdPushoff({ _: [f.entry], flags: { ...f.flags, save } }, f.h, { createPool: f.createPool });
  const saved = JSON.parse(fs.readFileSync(save, 'utf8'));
  assert.equal(f.loads[0].settings.maxLength, 1);
  assert.equal(saved.settings.maxLength, 1);
  assert.ok(saved.warriors.some(w => w.name === 'Long'));
  assert.ok(f.tasks.every(task => task.settings.maxLength === 200));
});

test('empty or invalid hills and empty entry lists stop before pool creation', async t => {
  const f = tournament(t), empty = path.join(f.dir, 'empty');
  fs.mkdirSync(empty);
  const runtime = { createPool() { assert.fail('invalid tournaments must not create workers'); } };
  for (const invalid of [false, true]) {
    if (invalid) fs.writeFileSync(path.join(empty, 'invalid.red'), 'invalid-opcode');
    await assert.rejects(cmdPushoff({ _: [f.entry], flags: { ...f.flags, hill: empty } }, f.h, runtime), /no opponents compiled/);
  }
  f.h.loadAll = async () => [];
  await assert.rejects(cmdPushoff({ _: [f.entry], flags: f.flags }, f.h, runtime), /at least one entry/);
  for (const args of [{ _: [], flags: f.flags }, { _: [f.entry], flags: {} }]) await assert.rejects(cmdPushoff(args, f.h, runtime), /pushoff <entry/);
});

test('save failures close the battle pool', async t => {
  const f = tournament(t), blocked = path.join(f.dir, 'blocked');
  fs.writeFileSync(blocked, 'a file');
  await assert.rejects(cmdPushoff({ _: [f.entry], flags: { ...f.flags, save: path.join(blocked, 'results.json') } }, f.h, { createPool: f.createPool }), /EEXIST|ENOTDIR/);
  assert.equal(f.pools[0].closed, 1);
});

test('replay validates names, finite scores and result counts while accepting legacy records', async t => {
  const dir = fixture(t), file = path.join(dir, 'record.json'), lines = [];
  t.mock.method(console, 'log', line => lines.push(line));
  const base = { warriors: [{ name: 'A', entry: true }, { name: 'B', entry: false }], scores: [[0, 1], [1, 0]] };
  const game = { w: 0, l: 0, t: 2, rounds: 2 };
  for (const [record, error] of [
    [null, /named warriors/], [{ ...base, warriors: [] }, /named warriors/], [{ ...base, warriors: [null] }, /named warriors/],
    [{ ...base, warriors: [{ name: 'A', entry: 1 }, { name: 'B' }] }, /entry markers/],
    [{ ...base, scores: [[0, null], [1, 0]] }, /finite numbers/],
    [{ ...base, results: [] }, /results must be a square/],
    ...[null, { ...game, w: -1 }, { ...game, t: 1 }, { ...game, t: 1.5 }, { ...game, rounds: 0 }].map(bad => [{ ...base, results: [[null, bad], [game, null]] }, /invalid win\/loss\/tie/]),
  ]) {
    fs.writeFileSync(file, JSON.stringify(record));
    await assert.rejects(cmdPushoff({ _: [], flags: { load: file, json: true } }, beforeLoading()), error);
  }
  fs.writeFileSync(file, JSON.stringify(base));
  await assert.rejects(cmdPushoff({ _: [], flags: { load: file, rule: 'announcement', features: 'wlt' } }, beforeLoading()), /needs saved win\/loss\/tie/);
  await cmdPushoff({ _: [], flags: { load: file, rule: 'announcement', json: true } }, beforeLoading());
  assert.equal(JSON.parse(lines.pop()).ranking.length, 2);
  fs.writeFileSync(file, JSON.stringify({ ...base, results: [[null, game], [game, null]] }));
  await cmdPushoff({ _: [], flags: { load: file, rule: 'announcement', features: 'wlt', json: true } }, beforeLoading());
  assert.equal(JSON.parse(lines.pop()).ranking.length, 2);
  fs.writeFileSync(file, JSON.stringify({ warriors: [{ name: 'only' }], scores: [[9]] }));
  await cmdPushoff({ _: [], flags: { load: file, json: true } }, beforeLoading());
  assert.equal(JSON.parse(lines.pop()).ranking[0].name, 'only');
  fs.writeFileSync(file, '{');
  await assert.rejects(cmdPushoff({ _: [], flags: { load: file } }, beforeLoading()), /could not load push-off results/);
  await assert.rejects(cmdPushoff({ _: [], flags: { load: path.join(dir, 'missing.json') } }, beforeLoading()), /could not load push-off results/);
});

test('text replay retains entries ranked below the first 25 rows', async t => {
  const f = tournament(t), file = path.join(f.dir, 'many.json'), n = 27;
  const warriors = Array.from({ length: n }, (_, i) => ({ name: `W${i}`, entry: i === n - 1 }));
  fs.writeFileSync(file, JSON.stringify({ warriors, scores: Array.from({ length: n }, () => Array(n).fill(0)) }));
  await cmdPushoff({ _: [], flags: { load: file } }, f.h);
  assert.equal(f.tables[0].length, 26);
  assert.equal(f.tables[0].at(-1).Rank, 27);
  assert.match(f.lines.join('\n'), /★ W26: rank 27 of 27/);
});

test('CLI reports usage errors for malformed play and replay input', t => {
  const dir = fixture(t), file = path.join(dir, 'bad.json');
  fs.writeFileSync(file, '{}');
  for (const args of [
    ['entry.red', '--hill', dir, '--top', '2junk'],
    ['entry.red', '--hill', dir, '--rule', 'announcement', '--metric', 'bad'],
    ['--load', file], ['--rule', 'bad', '--load', file],
  ]) {
    const result = spawnSync(process.execPath, ['cli/zorewars.js', 'pushoff', ...args], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /zorewars:/);
  }
});
