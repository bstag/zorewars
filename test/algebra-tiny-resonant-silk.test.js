import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/engine/index.js';
import { buildTree, gate } from '../tools/algebra/index.js';

const options = { rules: 'tiny', verification: 'full' };
const paper = (P = {}) => ({ id: 'tiny-resonant-silk', P });
const soloTrace = (built, base = 0) => built.verification.observations
  .find((run) => run.base === base && run.scenario === 'alone').observation.blocks
  .find(({ id }) => id === 'tiny-resonant-silk');

test('the Y lineage executes after three X hops beside the original X stage', () => {
  const built = buildTree(paper(), options);
  assert.equal(built.total, 9);
  const trace = soloTrace(built);
  assert.deepEqual([
    'first-y', 'first-x', 'y-lineage-x', 'y-lineage-hop-1', 'y-lineage-hop-2', 'resonant-return',
  ].map((phase) => trace.phases[phase]), [
    { cycle: 12, target: 453 }, { cycle: 42, target: 122 }, { cycle: 43, target: 455 },
    { cycle: 75, target: 572 }, { cycle: 125, target: 689 }, { cycle: 199, target: 6 },
  ]);
  assert.equal(soloTrace(built, 793).phases['resonant-return'].target, 799);
  assert.equal(trace.work['root-sweep-writes'].firstTarget, 778);
  assert.equal(trace.work['root-sweep-writes'].count, 8);
});

test('the one-field control returns one cell later and replaces the original sweep', () => {
  const baseline = buildTree(paper(), options);
  const control = buildTree(paper({ RETURN: 2 }), options);
  const differences = control.w.instructions.flatMap((instruction, index) => {
    const original = baseline.w.instructions[index];
    return Object.keys(instruction).filter((key) => original[key] !== instruction[key])
      .map((key) => [index, key, original[key], instruction[key]]);
  });
  assert.deepEqual(differences, [[3, 'b', 450, 451]]);
  const trace = soloTrace(control);
  assert.deepEqual(trace.phases['resonant-return'], { cycle: 199, target: 7 });
  assert.equal(soloTrace(control, 793).phases['resonant-return'].target, 0);
  assert.equal(trace.work['root-sweep-writes'].count, 6);
});

test('the copy burst can lead the paper without changing its relative deployment', () => {
  const built = buildTree({ id: 'seq', kids: [{ id: 'tiny-copy-burst' }, paper()] }, options);
  assert.equal(built.total, 13);
  assert.deepEqual(soloTrace(built).phases['resonant-return'], { cycle: 203, target: 10 });
});

test('the gate rejects a broken copy, and the linker protects pre-return deployment', () => {
  const built = buildTree(paper(), options);
  const damaged = built.source.replace('MOV.I }b0y, >b0y', 'NOP.F }b0y, >b0y');
  const warrior = compile(damaged, 'redcode', built.settings);
  assert.equal(warrior.ok, true);
  assert.throws(() => gate({ ...built, w: warrior }, { verification: 'full' }), /missed a declared write/);
  assert.throws(() => buildTree(paper({ X: 200 }), options), /footprints overlap/);
  assert.throws(() => buildTree(paper({ SOURCE: 446 }), options), /clear source overlaps/);
  assert.throws(() => buildTree(paper(), { rules: 'tinylp' }), /needs at least 128 process slots/);
});
