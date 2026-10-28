import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compile, RULESETS } from '../src/engine/index.js';
import { emitCompass, buildCompass, compassDefaults, verifyCompass } from '../tools/blocks/compass.js';
import { buildBlockRecipe, defaultBlockRecipes, familyReadiness } from '../tools/blocks/registry.js';
import { evolveBlocks } from '../tools/block-evolve.js';
import { withConstants } from '../tools/tune.js';

test('Compass: both layouts, decoy extremes, every phase and wrapped copies', () => {
  for (const BOOT of [0, 1]) for (const PHASE of [0, 1, 2]) for (const DECOYS of [0, 18]) {
    const b = buildCompass({ ...compassDefaults, BOOT, PHASE, DECOYS, DECOY: DECOYS ? 2 : 0, STEP: 55439, HOP: 256, STUN: 512 });
    assert.ok(b.w.instructions.length <= 50);
    const probes = b.verification.observations.filter(x => x.scenario);
    assert.deepEqual(probes.filter(x => x.hit).map(x => x.scenario), ['a-only', 'b-only']);
    assert.ok(probes.every(x => x.stunWrites === (PHASE === 0 ? 0 : PHASE === 1 ? 512 : 55440 - b.protectedSpan)));
  }
  const a = buildCompass(), b = buildCompass({ ...compassDefaults, DECOYS: 0 });
  assert.deepEqual(a.w.instructions.slice(0, a.payloadLength), b.w.instructions.slice(0, b.payloadLength));
  assert.deepEqual(a.verification.observations.slice(0, 3).map(x => x.target), b.verification.observations.slice(0, 3).map(x => x.target));
});

test('Compass gate rejects copied-code, detection, handoff and phase damage', () => {
  for (const [from, to] of [['<copyFrom, <copyTo', 'copyFrom, <copyTo'], ['SNE.I', 'SEQ.I'],
    ['found MOV.AB probe, probe', 'found MOV.AB #999, probe'], ['#32, remaining', '#31, remaining']]) {
    const b = emitCompass(compassDefaults), settings = { ...RULESETS['94x'], maxLength: 50 };
    assert.ok(b.source.includes(from)); b.source = b.source.replace(from, to);
    b.w = compile(b.source, 'redcode', settings); b.settings = settings;
    assert.ok(b.w.ok); assert.throws(() => verifyCompass(b));
  }
  assert.throws(() => buildCompass(compassDefaults, { length: 40 }), /length|instructions/i);
});

test('all recipe exports round-trip through the tuner without losing layout', () => {
  const code = w => w.instructions.map(({ line, ...x }) => x);
  for (const recipe of defaultBlockRecipes()) {
    const b = buildBlockRecipe(recipe), P = { ...recipe.P, STEP: recipe.P.STEP + 1 };
    const changed = buildBlockRecipe({ family: recipe.family, P });
    const emitted = compile(withConstants(b.generator, P), 'javascript', b.settings);
    assert.ok(emitted.ok, JSON.stringify(emitted.errors));
    assert.deepEqual(code(emitted), code(changed.w)); assert.equal(emitted.start, changed.w.start);
  }
  assert.equal(familyReadiness.length, 14);
  assert.equal(new Set(familyReadiness.map(x => x.category)).size, 14);
  assert.throws(() => buildBlockRecipe(defaultBlockRecipes(['compass'])[0], { rules: '88' }), /not admitted/);
  assert.throws(() => buildBlockRecipe(defaultBlockRecipes(['lifeboat'])[0], { length: NaN }), /budget/);
});

test('recipe GA is repeatable, rescores against Red Queen and records gated local moves', async () => {
  const settings = RULESETS['94x'], opponents = [{ name: 'test', group: 'test', w: compile('MOV.I 0, 1', 'redcode', settings) }];
  // Deterministic match fixture isolates search semantics; VM gates still run.
  let calls = 0;
  const pool = { async match(task) { calls++; const wins = (task.a.instructions.length + task.seed) % (task.settings.rounds + 1);
    return { w: wins, t: 0, l: task.settings.rounds - wins, smooth: 3 * wins }; } };
  const run = () => evolveBlocks({ pool, opponents, settings, families: ['clear', 'compass'], populationSize: 3,
    offspring: 2, generations: 2, localSteps: 2, rounds: 2, seed: 719 });
  const a = await run(), b = await run();
  assert.deepEqual(a.history, b.history); assert.deepEqual(a.stats, b.stats); assert.ok(calls > 0);
  assert.deepEqual(a.history.map(x => x.ancestorCount), [0, 1]);
  for (const g of a.history) {
    assert.ok(g.population.every(x => x.evaluatedGeneration === g.generation && x.ancestorCount === g.generation - 1));
    assert.deepEqual([...new Set(g.population.map(x => x.family))].sort(), ['clear', 'compass']);
  }
  assert.equal(a.stats.localProposals, 4);
  assert.ok(a.candidates.some(x => x.operator === 'parameter-step'));
  assert.ok(a.candidates.filter(x => x.operator === 'family-immigrant').every(x => x.parents.length === 0));
  assert.ok(a.candidates.every(x => x.verification.ok && x.w.instructions.length <= 50));
  assert.ok(a.champions[1].vsAncestors.length === 1);
  await assert.rejects(() => evolveBlocks({ pool, opponents, settings: { ...settings, maxCycles: 100 }, generations: 1 }), /settings/);
});

test('CLI rejects incompatible block flags before starting an experiment', () => {
  for (const args of [['--scratch'], ['--algorithm', 'map-elites'], ['--rules', '88', '--families', 'compass'], ['--cycles', '100']]) {
    const result = spawnSync(process.execPath, ['cli/zorewars.js', 'evolve', '--representation', 'blocks', ...args], { encoding: 'utf8' });
    assert.equal(result.status, 2, result.stderr);
  }
});

test('main CLI exports a validated recipe and resumes it without losing contracts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zorewars-blocks-'));
  // Leave only a tiny harmless temporary experiment; do not remove shared paths.
  const hill = path.join(dir, 'field'); fs.mkdirSync(hill);
  fs.writeFileSync(path.join(hill, 'imp.red'), 'MOV.I 0, 1\n');
  const run = (out, extra = []) => spawnSync(process.execPath, ['cli/zorewars.js', 'evolve', '--representation', 'blocks',
    '--families', 'compass', '--population', '1', '--batch', '1', '--generations', '2', '--eval-rounds', '1',
    '--threads', '1', '--hill', hill, '--validate', '--check-rounds', '1', '--seeds', '2', '--finalists', '1',
    '--out', out, '--json', ...extra], { encoding: 'utf8' });
  const first = path.join(dir, 'first'), a = run(first);
  assert.equal(a.status, 0, a.stderr);
  const result = JSON.parse(a.stdout);
  assert.deepEqual(result.history.map(x => x.ancestorCount), [0, 1]);
  assert.equal(result.execution.backend, 'cpu');
  for (const suffix of ['red', 'js', 'recipe.json']) assert.ok(fs.existsSync(path.join(first, 'best.' + suffix)));
  const verify = spawnSync(process.execPath, ['scripts/blocks.js', 'verify', '--recipe', path.join(first, 'best.recipe.json'),
    '--generator', path.join(first, 'best.js')], { encoding: 'utf8' });
  assert.equal(verify.status, 0, verify.stderr);
  const resumed = run(path.join(dir, 'resumed'), [path.join(first, 'best.recipe.json')]);
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.equal(run(first).status, 2, 'existing experiment must not be overwritten');
});
