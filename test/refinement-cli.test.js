import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { cmdRefine, cmdTune } from '../cli/devtools.js';
import { compile, DEFAULT_SETTINGS } from '../src/engine/index.js';
import { battlePool } from '../cli/devtools-context.js';
import { refineOptions, tuneOptions } from '../cli/search-options.js';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zorewars-refinement-cli-'));
  t.after(() => {
    assert.equal(path.dirname(dir), path.resolve(os.tmpdir()));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const red = path.join(dir, 'sitting.red'), js = path.join(dir, 'sitting.js');
  fs.writeFileSync(red, ';name Sitting\nJMP 0');
  fs.writeFileSync(js, '// SPACE {"STEP":[1,1]}\nconst P = {"STEP":1};\nname("Sitting");\njmp(0);\n');
  return { dir, red, js };
}

function beforeLoading() {
  return {
    usage(message) { throw new Error(message); },
    settingsFrom() { return { ...DEFAULT_SETTINGS }; },
    loadAll() { assert.fail('invalid arguments must fail before loading warriors or opponents'); },
  };
}

const small = { ...DEFAULT_SETTINGS, coreSize: 800, maxCycles: 80, maxLength: 20, minDistance: 50, maxProcesses: 64, pSpace: false };
const shortRun = { iterations: '1', variants: '3', rounds: '2', 'check-rounds': '2', seeds: '2', 'field-rounds': '2', threads: '1', backend: 'cpu' };

function commandFixture(t, settings = small) {
  const f = fixture(t), lines = [], tables = [], loads = [], pools = [];
  const hill = path.join(f.dir, 'hill');
  fs.mkdirSync(hill);
  for (const name of ['WaitA', 'WaitB']) fs.writeFileSync(path.join(hill, `${name}.red`), `;name ${name}\nJMP 0`);
  const out = path.join(f.dir, 'result', 'chosen.red');
  t.mock.method(console, 'log', (...args) => lines.push(args.join(' ')));
  const h = {
    usage: beforeLoading().usage,
    settingsFrom() { return { ...settings }; },
    expandRefs(refs) { return refs; },
    async loadAll(refs, cfg) {
      loads.push({ refs, settings: { ...cfg } });
      return refs.map(file => {
        const compiled = compile(fs.readFileSync(file, 'utf8'), file.endsWith('.js') ? 'javascript' : 'redcode', cfg);
        assert.equal(compiled.ok, true, JSON.stringify(compiled.errors));
        return { ...compiled, file };
      });
    },
    printTable(rows) { tables.push(rows); },
  };
  async function createPool(flags, helpers) {
    const real = await battlePool(flags, helpers), tracked = { closed: 0 };
    t.after(() => real.close());
    pools.push(tracked);
    return { ...real, close() { tracked.closed++; real.close(); } };
  }
  return { ...f, hill, out, h, lines, tables, loads, pools, createPool,
    flags: { ...shortRun, hill, out } };
}

test('refine validates field-rounds before any warrior or model setup', async t => {
  const { red } = fixture(t);
  await assert.rejects(cmdRefine({ _: [red], flags: { 'field-rounds': '0' } }, beforeLoading()), /--field-rounds must be a positive integer/);
});

test('tune rejects malformed candidate and seed counts before loading', async t => {
  const { js } = fixture(t);
  for (const key of ['candidates', 'seeds']) for (const value of ['abc', '2junk', '1.5', '0', '-1', 'Infinity', '9007199254740992']) {
    await assert.rejects(cmdTune({ _: [js], flags: { [key]: value } }, beforeLoading()), new RegExp(`--${key} must be a positive integer`));
  }
});

test('refine validates every search count and incompatible options before setup', async t => {
  const { red } = fixture(t), h = beforeLoading();
  for (const key of ['iterations', 'variants', 'rounds', 'check-rounds', 'seeds', 'seed', 'turns', 'field-rounds']) {
    for (const value of ['0', '-1', '1.5', 'NaN', 'Infinity', '9007199254740992']) {
      await assert.rejects(cmdRefine({ _: [red], flags: { [key]: value } }, h), new RegExp(`--${key} must be a positive integer`));
    }
  }
  for (const [flags, message] of [
    [{ objective: 'other' }, /--objective takes/], [{ partner: 'partner.red' }, /--partner needs/],
    [{ objective: 'pushoff' }, /needs --hill/], [{ effort: 'invalid' }, /--effort takes/],
    ...['0', '-1', 'NaN', 'Infinity'].map(budget => [{ budget }, /--budget takes/]),
  ]) await assert.rejects(cmdRefine({ _: [red], flags }, h), message);
});

test('search option defaults and push-off hill selection preserve the caller request', t => {
  const { red, js } = fixture(t), usage = beforeLoading().usage;
  const request = refineOptions({ _: [red], flags: {} }, usage);
  assert.equal(request.search.seeds, 3);
  assert.equal(request.search.iterations, 3);
  assert.equal(request.search.fieldRounds, 50);
  assert.equal(request.proposer.effort, 'high');
  assert.equal(request.out, path.join('refined', 'sitting.red'));
  assert.equal(tuneOptions({ _: [js], flags: {} }, usage).candidates, 40);
  assert.equal(tuneOptions({ _: [js], flags: {} }, usage).seeds, 3);
  for (const rules of ['88', '94nop', 'lp', '94x']) {
    const flags = Object.freeze({ rules, objective: 'pushoff' });
    const parsed = refineOptions({ _: [red], flags }, usage);
    assert.equal(parsed.flags.hill, `koenigstuhl:${rules}`);
    assert.equal(parsed.flags.top, '30');
    assert.equal(parsed.search.seeds, 6);
    assert.equal(flags.hill, undefined);
  }
  const flags = { objective: 'pushoff', hill: 'local', top: '4', seeds: '2', budget: '1.25', model: 'custom', effort: 'low' };
  const parsed = refineOptions({ _: [red], flags }, usage);
  assert.equal(parsed.flags.hill, 'local');
  assert.equal(parsed.flags.top, '4');
  assert.equal(parsed.search.seeds, 2);
  assert.equal(parsed.search.budget, 1.25);
  assert.deepEqual(parsed.proposer, { model: 'custom', effort: 'low', turns: 20 });
});

test('search commands reject wrong argument counts, formats and missing files', async t => {
  const { red, js, dir } = fixture(t), h = beforeLoading();
  for (const [command, file, wrong] of [[cmdRefine, red, js], [cmdTune, js, red]]) {
    for (const refs of [[], [file, file]]) await assert.rejects(command({ _: refs, flags: {} }, h), /needs exactly one/);
    for (const ref of [wrong, path.join(dir, path.basename(file) + path.extname(file))]) {
      await assert.rejects(command({ _: [ref], flags: {} }, h), /works on a/);
    }
  }
});

test('refine executes a real search, reports confirmed gains, and writes the warrior and full log', async t => {
  const f = commandFixture(t);
  fs.writeFileSync(f.red, ';name Sitting\nDAT 0, 0');
  const createProposer = async options => {
    assert.equal(options.effort, 'high');
    return async ({ tools, prompt }) => {
      assert.match(prompt, /DAT 0, 0/);
      assert.match(await tools.check({ redcode: 'JMP 0' }), /Survives alone/);
      assert.match(await tools.battle({ redcode: 'JMP 0', opponent: 'WaitA' }), /^Against WaitA:/);
      return { variants: [{ idea: 'survive', redcode: ';name Sitting\nJMP 0' }], usage: { input_tokens: 100 }, turns: 1 };
    };
  };
  await cmdRefine({ _: [f.red], flags: { ...f.flags, json: true } }, f.h, { createProposer, createPool: f.createPool });
  const result = JSON.parse(f.lines.join(''));
  assert.equal(result.ok, true);
  assert.equal(result.improved, true);
  assert.equal(result.source, undefined);
  assert.equal(result.log[0].kept, true);
  assert.equal(result.log[0].check.gain, 1);
  assert.equal(fs.readFileSync(f.out, 'utf8'), ';name Sitting\nJMP 0');
  const saved = JSON.parse(fs.readFileSync(f.out.replace('.red', '.refine.json'), 'utf8'));
  assert.equal(saved.source, fs.readFileSync(f.out, 'utf8'));
  assert.equal(saved.usage.input_tokens, 100);
  assert.equal(f.pools[0].closed, 1);
  f.lines.length = 0;
  await cmdRefine({ _: [f.red], flags: f.flags }, f.h, { createProposer, createPool: f.createPool });
  assert.match(f.lines.join('\n'), /Improved \(survive\)/);
  assert.match(f.lines.join('\n'), /fresh seeds: \+1\.000 ± 0\.000 pts\/round -> kept/);
  assert.match(f.lines.join('\n'), /about \$/);
  assert.equal(f.pools[1].closed, 1);
});

test('refine text reports no gain and model errors while preserving the starting warrior', async t => {
  const f = commandFixture(t);
  for (const fail of [false, true]) {
    f.lines.length = 0;
    await cmdRefine({ _: [f.red], flags: { ...f.flags, model: 'custom' } }, f.h, {
      createPool: f.createPool,
      createProposer: async () => async () => {
        if (fail) throw new Error('offline proposer failed');
        return { variants: [{ idea: 'unchanged', redcode: fs.readFileSync(f.red, 'utf8') }], turns: 1 };
      },
    });
    assert.match(f.lines.join('\n'), fail ? /stopped: offline proposer failed/ : /worst against nobody/);
    assert.match(f.lines.join('\n'), /No rewrite beat the starting warrior/);
    assert.match(f.lines.join('\n'), /Model tokens:/);
    assert.equal(fs.readFileSync(f.out, 'utf8'), fs.readFileSync(f.red, 'utf8'));
  }
  assert.ok(f.pools.every(p => p.closed === 1));
});

test('refine push-off keeps entry limits when hill opponents use relaxed settings', async t => {
  const f = commandFixture(t, { ...small, maxLength: 1 });
  const partner = path.join(f.dir, 'partner.red');
  fs.writeFileSync(partner, ';name Partner\nJMP 0');
  fs.writeFileSync(path.join(f.hill, 'long.red'), ';name Long\nNOP\nNOP\nJMP 0');
  await cmdRefine({ _: [f.red], flags: { ...f.flags, objective: 'pushoff', partner } }, f.h, {
    createPool: f.createPool,
    createProposer: async () => async ({ system, prompt, tools }) => {
      assert.match(system, /at most 1 instructions/);
      assert.match(prompt, /Long/);
      await assert.rejects(tools.check({ redcode: 'NOP\nJMP 0' }), /does not compile/);
      assert.match(await tools.score({ redcode: 'JMP 0' }), /^Push-off place/);
      return { variants: [] };
    },
  });
  assert.ok(f.loads.every(load => load.settings.maxLength === 1));
  const saved = JSON.parse(fs.readFileSync(f.out.replace('.red', '.refine.json'), 'utf8'));
  assert.equal(saved.objective, 'pushoff');
  assert.match(f.lines.join('\n'), /current place/);
  assert.equal(f.pools[0].closed, 1);
});

test('refine closes its battle pool if model setup or output writing fails', async t => {
  const f = commandFixture(t);
  await assert.rejects(cmdRefine({ _: [f.red], flags: f.flags }, f.h, {
    createPool: f.createPool, createProposer: async () => { throw new Error('no model available'); },
  }), /no model available/);
  assert.equal(fs.existsSync(f.out), false);
  const blocked = path.join(f.dir, 'blocked');
  fs.writeFileSync(blocked, 'a file, not a directory');
  await assert.rejects(cmdRefine({ _: [f.red], flags: { ...f.flags, out: path.join(blocked, 'out.red') } }, f.h, {
    createPool: f.createPool, createProposer: async () => async () => ({ variants: [] }),
  }), /EEXIST|ENOTDIR/);
  assert.ok(f.pools.every(p => p.closed === 1));
});

test('refine rejects empty or wholly invalid hills before creating a model or battle pool', async t => {
  const f = commandFixture(t), emptyHill = path.join(f.dir, 'empty-hill');
  fs.mkdirSync(emptyHill);
  const runtime = {
    createProposer() { assert.fail('an empty field must not create a model'); },
    createPool() { assert.fail('an empty field must not create a pool'); },
  };
  for (const invalid of [false, true]) {
    if (invalid) fs.writeFileSync(path.join(emptyHill, 'invalid.red'), 'invalid-opcode');
    await assert.rejects(cmdRefine({ _: [f.red], flags: { ...f.flags, hill: emptyHill, json: true } }, f.h, runtime), /no opponents compiled/);
  }
  assert.equal(fs.existsSync(f.out), false);
  const result = spawnSync(process.execPath, ['cli/zorewars.js', 'refine', f.red, '--hill', emptyHill, '--json'], { encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /no opponents compiled/);
});

test('tune JSON writes only a statistically confirmed improvement', async t => {
  const f = commandFixture(t);
  fs.writeFileSync(f.js, '// SPACE {"MODE":[1,1]}\nconst P = {"MODE":0};\nname("Sitting");\nraw(P.MODE ? "JMP 0" : "DAT 0, 0");\n\n');
  await cmdTune({ _: [f.js], flags: { ...f.flags, candidates: '1', seeds: '1', json: true, write: true } }, f.h);
  const result = JSON.parse(f.lines.join(''));
  assert.equal(result.improved, true);
  assert.equal(result.written, true);
  assert.deepEqual(result.best, { MODE: 1 });
  assert.ok(result.results.every(row => row.rows === undefined));
  const saved = fs.readFileSync(f.js, 'utf8');
  assert.match(saved, /const P = {"MODE":1};/);
  assert.ok(saved.endsWith('\n\n'));
  assert.equal(compile(saved, 'javascript', small).ok, true);
});

test('tune text distinguishes confirmed gains from unchanged constants', async t => {
  const f = commandFixture(t);
  await cmdTune({ _: [f.js], flags: { ...f.flags, candidates: '1', seeds: '1', write: true } }, f.h);
  assert.match(f.lines.join('\n'), /No finalist beats the current constants/);
  for (const write of [false, true]) {
    f.lines.length = 0;
    fs.writeFileSync(f.js, '// SPACE {"MODE":[1,1]}\nconst P = {"MODE":0};\nraw(P.MODE ? "JMP 0" : "DAT 0, 0");\n');
    await cmdTune({ _: [f.js], flags: { ...f.flags, candidates: '1', seeds: '1', write } }, f.h);
    assert.match(f.lines.join('\n'), write ? /Written to/ : /Run again with --write/);
    assert.match(fs.readFileSync(f.js, 'utf8'), new RegExp(`const P = {"MODE":${write ? 1 : 0}};`));
  }
  assert.equal(f.tables.length, 3);
});

test('CLI exits with usage errors for invalid search counts without model credentials', t => {
  const { red, js } = fixture(t);
  for (const [command, file, flag, value] of [['refine', red, 'field-rounds', '0'], ['tune', js, 'seeds', 'junk']]) {
    const result = spawnSync(process.execPath, ['cli/zorewars.js', command, file, `--${flag}`, value], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, new RegExp(`--${flag} must be a positive integer`));
  }
});
