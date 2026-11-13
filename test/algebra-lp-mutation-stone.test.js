import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTree, observeTree } from '../tools/algebra/index.js';
import { mutationBuilds, traceMutation } from '../examples/hill-study/trace-lp-mutation-paper.mjs';

const rules = 'lp-hill';
const id = 'lp-mutation-stone';

test('LP mutation stone lands the donor on the stride and repeatedly clears its linked sector', () => {
  const built = buildTree({ id, P: { SHOTS: 8, WIDTH: 32 } }, { rules, verification: 'full' });
  const { observation } = observeTree(built, { positions: [7997], cycles: 130 });
  const [stone] = observation.blocks;
  assert.equal(observation.processes, 1);
  assert.equal(stone.work.shots.count, 8);
  assert.deepEqual(stone.phases['pivot-write'], { cycle: 22, target: 7997 });
  assert.equal(stone.phases['pivot-jump'].cycle, 24);
  assert.deepEqual(stone.phases['first-dat'], { cycle: 25, target: 198 });
  assert.equal(stone.work['dat-writes'].uniqueTargets, 32);
  assert.equal(stone.work.resets.count, 1);
});

test('LP mutation stone rejects a prior orbit hit and a wrapping clear sector', () => {
  assert.throws(() => buildTree({ id, P: { STEP: 32, SHOTS: 251 } }, { rules }), /early shot or donor overlaps/);
  assert.throws(() => buildTree({ id, P: { START: 7800 } }, { rules }), /sector overlaps/);
});

test('LP mutation hybrid keeps one stone lineage at the cap through the handoff', () => {
  const { dual, holdStone, startClear } = mutationBuilds();
  const trace = traceMutation(dual);
  assert.deepEqual(traceMutation(dual, 7997), trace);
  for (const { queue } of [trace.firstCap, trace.pivot, trace.clear]) {
    assert.equal(queue.filter(([, tag]) => tag === 'stone').length, 1);
    assert.equal(queue.filter(([, tag]) => tag === 'paper').length, 7);
  }
  assert.equal(trace.pivot.turn, 2225);
  assert.equal(trace.clear.turn, 2249);
  assert.equal(trace.work['dat-writes'].uniqueTargets, 960);
  assert.equal(trace.final.filter(([, tag]) => tag === 'stone').length, 1);
  const held = traceMutation(holdStone);
  assert.equal(held.phases['pivot-write'], undefined);
  assert.equal(held.clear, null);
  assert.equal(traceMutation(startClear).paperTouchesCursorAt, 23422);
});
