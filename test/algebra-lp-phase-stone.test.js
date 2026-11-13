import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTree, observeTree, recipes } from '../tools/algebra/index.js';
import { deployment, traceDeployment } from '../examples/hill-study/replay-lp-phase-deployment.mjs';

const rules = 'lp-hill';

test('LP phase-stone changes only dispatch and doubles the distinct orbit at the same worker count', () => {
  const build = PHASE => buildTree({ id: 'lp-phase-stone', P: { PHASE } }, { rules, verification: 'full' });
  const repeated = build(0);
  const interleaved = build(1);
  const changed = repeated.w.instructions.flatMap((ins, i) =>
    JSON.stringify(ins) === JSON.stringify(interleaved.w.instructions[i]) ? [] : [i]);
  assert.deepEqual(changed, [repeated.labels.b0dispatch]);
  const report = built => observeTree(built, { positions: [7997] }).observation.blocks[0];
  const a = report(repeated), b = report(interleaved);
  assert.deepEqual(a.firstTargets, [49, 49, 113, 113, 177, 177, 241, 241]);
  assert.deepEqual(b.firstTargets, [49, 81, 113, 145, 177, 209, 241, 273]);
  assert.equal(a.work['dat-writes'].count, b.work['dat-writes'].count);
  assert.equal(a.work['dat-writes'].uniqueTargets, 125);
  assert.equal(b.work['dat-writes'].uniqueTargets, 250);
});

test('LP phase-stone shares the queue with paper and rejects a friendly shot lane', () => {
  const tree = recipes['lp-phase-paper'].tree();
  for (const PHASE of [0, 1]) {
    tree.kids[0].P = { PHASE };
    const built = buildTree(tree, { rules, verification: 'full' });
    const { observation } = observeTree(built);
    const [stone, paper] = observation.blocks;
    assert.equal(stone.workersAtEnd, 2);
    assert.ok(paper.phases['capped-transfer']);
  }
  tree.kids[0].P = { OFFSET: 1 };
  assert.throws(() => buildTree(tree, { rules }), /shot lane overlaps/);
});

test('LP standard boot preserves the phase and the linker checks the shifted shot lane', () => {
  const tree = recipes['lp-booted-phase-paper'].tree();
  const built = buildTree(tree, { rules, verification: 'full' });
  const { observation } = observeTree(built, { positions: [7997] });
  const [, stone] = observation.blocks;
  assert.equal(stone.shift, 5952);
  assert.deepEqual(stone.firstTargets, [49, 81, 113, 145, 177, 209, 241, 273]);
  assert.equal(stone.workersAtEnd, 2);
  const near = deployment(256);
  const changed = near.w.instructions.flatMap((ins, i) =>
    JSON.stringify(ins) === JSON.stringify(built.w.instructions[i]) ? [] : [i]);
  assert.deepEqual(changed, [built.labels.b2boot + 2, built.labels.b2copyTo]);
  tree.kids[1].P.HOP = 5956;
  assert.throws(() => buildTree(tree, { rules }), /shot lane overlaps/);
});

test('LP deployment trace distinguishes a paper touch from a lethal full copy', () => {
  const benign = traceDeployment(deployment(512));
  assert.equal(benign.paper.firstCopy.changed, false);
  assert.equal(benign.paper.changes, 0);
  const hit = traceDeployment(deployment(1984));
  assert.deepEqual(hit.launch.copies.map(write => write.cell), [1998, 1997, 1996, 1995, 1994, 1993]);
  assert.deepEqual(hit.deaths.map(({ lastTouch }) => [lastTouch.turn, lastTouch.origin, lastTouch.source]),
    [[262, 'paper', 1011], [262, 'paper', 1011]]);
});

test('LP sparse lane keeps the launch and reduces stone writes into paper copies', () => {
  const baseline = deployment(5952);
  const variant = deployment(5952, { STEP: 160, OFFSET: 46 });
  const changed = baseline.w.instructions.flatMap((ins, i) =>
    JSON.stringify(ins) === JSON.stringify(variant.w.instructions[i]) ? [] : [i]);
  assert.deepEqual(changed, [baseline.labels.b3stride, baseline.labels.b3shot]);
  const base = traceDeployment(baseline);
  const sparse = traceDeployment(variant);
  assert.deepEqual(sparse.launch.firstCap, base.launch.firstCap);
  assert.deepEqual([base.copyOverlap.stoneHits, sparse.copyOverlap.stoneHits], [295, 32]);
  assert.deepEqual([base.stoneOnPaper.deaths, sparse.stoneOnPaper.deaths], [27, 6]);
  assert.equal(sparse.fullQueueTurns['2/6'], 74811);
  const tree = recipes['lp-sparse-phase-paper'].tree();
  tree.kids[1].kids[0].P.OFFSET = 1;
  assert.throws(() => buildTree(tree, { rules }), /shot lane overlaps the deployed stone/);
});

test('LP hidden return leaves A zero and preserves launch phase and initial queue', () => {
  const P = { STEP: 160, OFFSET: 46 };
  const normal = deployment(5952, P);
  const hidden = deployment(5952, { ...P, HIDERETURN: 1 });
  const back = normal.labels.b3back;
  const changed = normal.w.instructions.flatMap((ins, i) =>
    JSON.stringify(ins) === JSON.stringify(hidden.w.instructions[i]) ? [] : [i]);
  assert.deepEqual(changed, [back]);
  const jump = hidden.w.instructions[back];
  assert.deepEqual([jump.op, jump.aMode, jump.a, jump.b], ['JMP', '@', 0, normal.labels.b3stride - back]);
  const a = traceDeployment(normal);
  const b = traceDeployment(hidden);
  assert.deepEqual(b.launch.firstCap, a.launch.firstCap);
  assert.deepEqual(b.launch.firstStoneShot, a.launch.firstStoneShot);
  assert.equal(b.final.filter(([, tag]) => tag === 'stone').length, 2);
});
