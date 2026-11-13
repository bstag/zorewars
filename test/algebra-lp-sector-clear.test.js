import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTree, observeTree, recipes } from '../tools/algebra/index.js';

const rules = 'lp-hill';
const sector = P => ({ id: 'lp-sector-clear', P });
const pair = (first, second) => ({ id: 'par', kids: [sector(first), sector(second)] });
const full = tree => buildTree(tree, { rules, verification: 'full' });

test('linked sectors include pending-write room in the overlap check', () => {
  const first = { START: 255, WIDTH: 256 };
  assert.throws(() => full(pair(first, { START: 525, WIDTH: 256 })), /declared clear sectors overlap/);
  assert.ok(full(pair(first, { START: 526, WIDTH: 256 })).verification.ok);
  assert.throws(() => full(sector({ START: 7800, WIDTH: 256 })), /sector overlaps the loaded image/);
});

test('the sector pair preserves independent writers and linked start positions across the seam', () => {
  const built = full(recipes['lp-sector-pair'].tree());
  const base = 7993;
  const { observation, vm } = observeTree(built, { positions: [base] });
  assert.equal(built.total, 19);
  assert.deepEqual(observation.blocks.map(({ phases }) => vm.norm(phases['first-dat'].target - base)), [256, 4200]);
  assert.ok(observation.blocks.every(({ work, feederAtLimit }) => feederAtLimit && work.resets.count > 0
    && work['dat-writes'].lastCycle >= 79980));
});

test('paced feeders share writer turns that the unpaced fourth feeder would lose', () => {
  const built = full(recipes['lp-paced-sectors'].tree());
  const { observation, vm } = observeTree(built);
  const writes = observation.blocks.map(block => block.work['dat-writes'].count);
  assert.equal(vm.warriors[0].peak, 8);
  assert.ok(Math.max(...writes) - Math.min(...writes) <= 4);
  assert.ok(observation.blocks.every(block => block.feederAtLimit && block.work['feeds-at-cap'].count > 0));

  const unpaced = { id: 'par', kids: [253, 2038, 3929, 5920].map(START => sector({ START, WIDTH: 1200 })) };
  const quiet = buildTree(unpaced, { rules });
  const { observation: control } = observeTree(quiet);
  assert.equal(control.blocks[3].feederAtLimit, true);
  assert.equal(control.blocks[3].work['dat-writes'].count, 4);
  assert.throws(() => full(unpaced), /did not reset its sector/);
});
