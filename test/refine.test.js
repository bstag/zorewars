import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile, DEFAULT_SETTINGS } from '../src/engine/index.js';
import { createPool, strip } from '../tools/hill.js';
import { refine, costOf } from '../tools/refine.js';

const settings = { ...DEFAULT_SETTINGS, coreSize: 800, maxLength: 20, minDistance: 50, maxCycles: 4000, maxProcesses: 64, pSpace: false };
const field = ['MOV.I 0, 1', 'SPL 0\nMOV.I 0, 1'].map((s, i) => ({ name: `Imp ${i}`, group: 'test', w: strip(compile(s, 'redcode', settings)) }));
const weak = ';name Sitting\nJMP 0';
const dwarf = ';name Dwarf\nADD #4, 3\nMOV 2, @2\nJMP -2\nDAT 0, 0';

test('refine keeps a rewrite only when it beats the current version on fresh seeds', async () => {
  const pool = createPool(2);
  try {
    const prompts = [];
    const outputs = [];
    const propose = async ({ system, prompt, tools }) => {
      prompts.push({ system, prompt });
      outputs.push(await tools.check({ redcode: dwarf }), await tools.check({ redcode: ';name Fall\nDAT 0, 0' }),
        await tools.battle({ redcode: dwarf, opponent: 'imp 1' }), await tools.score({ redcode: dwarf }));
      await assert.rejects(tools.battle({ redcode: dwarf, opponent: 'nobody' }), /no opponent/);
      await assert.rejects(tools.check({ redcode: 'MOV 0,' }), /does not compile/);
      return { variants: [{ idea: 'broken', redcode: 'MOV 0,' }, { idea: 'too long', redcode: 'NOP\n'.repeat(25) }, { idea: 'a dwarf', redcode: dwarf }] };
    };
    const r = await refine({ pool, source: weak, field, settings, propose, iterations: 2, variants: 3, rounds: 6, checkRounds: 6, seeds: 2 });
    // The model saw our code, the scores and the rules, but no opponent's code.
    assert.match(prompts[0].prompt, /JMP 0/);
    assert.match(prompts[0].prompt, /Imp 0/);
    assert.match(prompts[0].system, /core size 800, at most 20 instructions/);
    assert.ok(!prompts[0].prompt.includes('MOV.I 0, 1'));
    // The model's tools compile, run alone, battle one opponent and score the field.
    assert.match(outputs[0], /Survives alone/);
    assert.match(outputs[1], /DIES ALONE/);
    assert.match(outputs[2], /^Against Imp 1: won \d+/);
    assert.match(outputs[3], /points\/round over 2 opponents/);
    assert.deepEqual(r.log[0].calls, { check: 3, battle: 2, score: 1 });
    // Failures are reported back to the model in the next iteration.
    assert.match(prompts[1].prompt, /does not compile/);
    assert.match(prompts[1].prompt, /too long/);
    assert.equal(r.log.length, 2);
    assert.ok(r.log[0].variants.length === 1);
  } finally { pool.close(); }
});

test('refine stops cleanly when the model fails', async () => {
  const pool = createPool(1);
  try {
    const r = await refine({ pool, source: weak, field, settings, propose: async () => { throw new Error('offline'); }, iterations: 2, rounds: 4 });
    assert.equal(r.improved, false);
    assert.deepEqual(r.log, [{ iteration: 1, error: 'offline', calls: { check: 0, battle: 0, score: 0 } }]);
  } finally { pool.close(); }
});

test('refine stops once its budget is spent', async () => {
  assert.equal(costOf({ input_tokens: 1e6, output_tokens: 1e6, cache_read_input_tokens: 1e6, cache_creation_input_tokens: 1e6 }, 'claude-opus-5-5'), 4 + 20 + 0.2 + 5);
  assert.equal(costOf({ input_tokens: 1 }, 'some-other-model'), null);
  const pool = createPool(1);
  try {
    const budgets = [];
    const propose = async ({ budget }) => { budgets.push(budget); return { variants: [], usage: { input_tokens: 2e6 } }; };
    const r = await refine({ pool, source: weak, field, settings, propose, iterations: 3, rounds: 4, budget: 5 });
    assert.deepEqual(budgets, [5]);                        // the second iteration never asks
    assert.equal(r.cost, 8);
    assert.match(r.log.at(-1).error, /budget of \$5.00 spent/);
  } finally { pool.close(); }
});

test('with objective pushoff, refine ranks rewrites by push-off place beside a partner', async () => {
  const pool = createPool(2);
  try {
    let seen;
    const propose = async ({ system, prompt, tools }) => {
      seen = { system, prompt, score: await tools.score({ redcode: dwarf }) };
      return { variants: [{ idea: 'a dwarf', redcode: dwarf }] };
    };
    const partner = strip(compile(';name Partner\nSPL 0\nMOV.I 0, 1', 'redcode', settings));
    const r = await refine({ pool, source: weak, field, settings, propose, iterations: 1, rounds: 4, checkRounds: 4, seeds: 3,
      fieldRounds: 4, objective: 'pushoff', partners: [partner] });
    assert.equal(r.objective, 'pushoff');
    assert.match(seen.system, /iterative push-off/);
    assert.match(seen.prompt, /Push-off place: place \d+ of 4 \(partner \d+\)/);
    assert.match(seen.score, /^Push-off place \d+ of 4/);
    assert.match(r.log[0].variants[0].text, /^place \d+ of 4/);
    await assert.rejects(refine({ pool, source: weak, field, settings, propose, partners: [partner] }), /partners need objective pushoff/);
  } finally { pool.close(); }
});
