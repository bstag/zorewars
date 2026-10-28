import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RULESETS, compile } from '../src/engine/index.js';
import { parseTunable, withConstants } from '../tools/tune.js';
import { buildMolting, verifyMolting, clearControl } from '../tools/molting-generator.js';
import { evolveParameters } from '../tools/parameter-evolve.js';
import { genomeId } from '../tools/evolve.js';
import { genomeOf } from '../tools/genes.js';

const source = fs.readFileSync(new URL('../examples/experimental-94x/molting.js', import.meta.url), 'utf8');
const { current } = parseTunable(source);
const settings = { ...RULESETS['94x'], maxLength: 50 };

test('behavior gate accepts every structure and both plain controls are compact and legal', () => {
  for (let i = 0; i < 8; i++) {
    const P = { ...current, OPENING: i & 1, TRIGGER: (i >> 1) & 1, BACKWARD: (i >> 2) & 1 };
    const built = buildMolting(source, P, settings);
    assert.equal(built.verification.observations.length, P.TRIGGER ? 3 : 2);
    assert.equal(clearControl(built.w, settings).instructions.length, 13);
    assert.equal(clearControl(built.w, settings, { bare: false }).instructions.length, built.w.instructions.length);
  }
});

test('gate rejects displaced copies, bypassed relocation, dead payloads and disabled sensors', () => {
  const built = buildMolting(source, current, settings);
  const displaced = structuredClone(built.w);
  displaced.instructions[2].b += 2;
  assert.throws(() => verifyMolting(displaced, current, settings), /relocate/);
  const bypassed = compile(built.w.redcode.replace(/ORG\s+opening/, 'ORG payload'), 'redcode', settings);
  assert.throws(() => verifyMolting(bypassed, current, settings), /relocate/);
  const dead = structuredClone(built.w);
  dead.instructions[dead.instructions.length - 13].op = 'DAT';
  assert.throws(() => verifyMolting(dead, current, settings), /solo/);
  const disabled = compile(withConstants(source, current).replace("seq.i('marker', `probe+${P.SENSOR}`);", "seq.i('marker', 'marker');"), 'javascript', settings);
  assert.equal(disabled.ok, true);
  assert.throws(() => verifyMolting(disabled, current, settings), /damaged marker/);
});

test('parameter GA is reproducible, stays within bounds, and never evaluates rejected builds', async () => {
  const space = { SWITCH: [0, 1], STEP: [1, 10] }, current = { SWITCH: 0, STEP: 3 };
  async function run() {
    return evolveParameters({ space, current, seed: 91, populationSize: 4, generations: 3, offspring: 4,
      initial: [{ SWITCH: 1, STEP: 5 }],
      build(P) {
        assert.ok(P.STEP >= 1 && P.STEP <= 10);
        assert.ok([0, 1].includes(P.SWITCH));
        if (P.STEP % 2 === 0) throw new Error('synthetic behavior failure');
        return { w: { ok: true }, verification: { ok: true } };
      },
      async evaluate(c, generation) {
        assert.equal(c.P.STEP % 2, 1);
        const cases = [c.P.STEP, c.P.SWITCH * 3 + generation];
        return { cases, score: cases[0], fit: cases[0] };
      },
    });
  }
  const a = await run(), b = await run();
  assert.deepEqual(a, b);
  assert.ok(a.stats.rejected > 0);
  const ids = new Set(a.candidates.map((x) => x.id));
  for (const c of a.candidates) for (const parent of c.parents) assert.ok(ids.has(parent));
  assert.ok(a.population.every((c) => c.cases[1] === c.P.SWITCH * 3 + 3), 'parents must be rescored on final generation placements');
  assert.ok(a.candidates.some((c) => c.operator === 'mutate' || c.operator === 'crossover+mutate'));
});

test('saved generator recommendations match their validated genomes and still relocate', () => {
  const results = JSON.parse(fs.readFileSync(new URL('../docs/molting-parameters-results.json', import.meta.url), 'utf8'));
  for (const run of results.runs) {
    const text = fs.readFileSync(new URL(`../examples/experimental-94x/molting-${run.seed}.js`, import.meta.url), 'utf8');
    const P = parseTunable(text).current;
    assert.deepEqual(P, run.P);
    const built = buildMolting(text, P, settings);
    assert.equal(genomeId(genomeOf(built.w)), run.validation.recommended);
    assert.deepEqual(built.verification, run.verification);
  }
});
