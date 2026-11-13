import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTree, observeTree, recipes } from '../tools/algebra/index.js';

const rules = 'lp-hill';
function build(AIM = 1) {
  const tree = recipes['lp-quickscan-sector'].tree();
  tree.kids[1].P = { AIM };
  return buildTree(tree, { rules, verification: 'full' });
}
const report = observation => observation.blocks.find(block => block.id === 'lp-probe-sector');

test('the planted quickscan hit redirects the first DAT while preserving the fixed control timing', () => {
  const fixed = build(0), aimed = build();
  const planted = built => report(built.verification.observations.at(-1).observation);
  assert.equal(aimed.total, fixed.total);
  assert.deepEqual(planted(aimed).phases['accepted-probe'], planted(fixed).phases['accepted-probe']);
  assert.equal(planted(aimed).phases['first-dat'].cycle, planted(fixed).phases['first-dat'].cycle);
  assert.equal(planted(aimed).phases['first-dat'].target, 3977);
  assert.equal(planted(fixed).phases['first-dat'].target, 278);
  assert.ok(planted(aimed).work.resets.count > 0);
  assert.equal(report(aimed.verification.observations[0].observation).phases['first-dat'].target, 278);
});

test('the probe guard accepts an exact corridor fit and falls back one cell beyond either boundary', () => {
  const built = build();
  const cycle = report(built.verification.observations[0].observation).enteredAt;
  const probe = built.labels.b1probe;
  const base = 7997;
  for (const [target, accepted] of [[277, false], [278, true], [6542, true], [6543, false]]) {
    const instruction = { ...built.w.instructions[probe], b: target - probe };
    const { vm, observation } = observeTree(built, {
      positions: [base], cycles: 80, injections: [{ cycle, address: (base + probe) % 8000, instruction }],
    });
    const { phases } = report(observation);
    assert.equal(Boolean(phases['accepted-probe']), accepted);
    assert.equal(vm.norm(phases['first-dat'].target - base), accepted ? target : 278);
  }
});

test('the full reserved aiming corridor participates in declared-sector overlap checks', () => {
  const tree = recipes['lp-quickscan-sector'].tree();
  tree.kids[1] = { id: 'par', kids: [tree.kids[1], { id: 'lp-sector-clear', P: { START: 5000, WIDTH: 32 } }] };
  assert.throws(() => buildTree(tree, { rules, length: 100 }), /declared clear sectors overlap/);
});
