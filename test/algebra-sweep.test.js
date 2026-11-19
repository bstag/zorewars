import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree } from '../tools/algebra/index.js';
import { sweepFactor, sweepStep, sweepStart, sweepLaps } from '../tools/algebra/blocks/sweep.js';
import sweepBlocks from '../tools/algebra/blocks/sweep.js';

const RULES = ['modelwar', '94nop', '94x'];
const defaults = sweepBlocks.find((b) => b.id === 'sweep').defaults;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

test('sweep sizes its step, start and timer to any core', () => {
  for (const core of [8000, 25200, 55440, 8192, 7919]) {
    const g = sweepFactor(defaults.G, core);
    if (g < 2) { assert.equal(core, 7919); continue; }          // a prime core has no factor to share
    assert.equal(core % g, 0);
    const step = sweepStep(defaults, core);
    assert.equal(gcd(step, core), g, `core ${core}: the step shares exactly ${g}`);
    assert.equal((sweepStart(defaults, core) + 1) % g, 0, `core ${core}: the lap ends one cell under the probes`);
    assert.ok(sweepLaps(defaults, core) >= 2);
  }
  // 25,200 cells: the tuned ModelWar build.
  assert.equal(sweepStep(defaults, 25200), 12710);
  assert.equal(sweepStart(defaults, 25200), 5939);
});

test('sweep and restart-clear pass the gate alone on every ring they support', () => {
  for (const rules of RULES) {
    const s = buildTree({ id: 'sweep' }, { rules, verification: 'full' });
    assert.equal(s.verification.ok, true, rules);
    assert.ok(s.verification.observations.some(({ scenario }) => scenario === 'sweep: planted target'), rules);
    const c = buildTree({ id: 'restart-clear' }, { rules, verification: 'full' });
    assert.equal(c.verification.ok, true, rules);
  }
});

test('sweep keeps its options buildable: trip modes and where the clear starts', () => {
  for (const P of [{ TRIP: 0 }, { TRIP: 2 }, { CLR: 0 }, { UP: 0 }, { UP: 9, WIPE: 5 }]) {
    const s = buildTree({ id: 'sweep', P }, { rules: 'modelwar', verification: 'full' });
    assert.equal(s.verification.ok, true, JSON.stringify(P));
  }
});

test('an opening hands on to sweep and to restart-clear', () => {
  for (const rules of ['modelwar', '94nop']) {
    for (const id of ['sweep', 'restart-clear']) {
      const t = buildTree({ id: 'seq', kids: [{ id: 'opening-quickscan' }, { id }] }, { rules, length: 100, verification: 'full' });
      assert.equal(t.verification.ok, true, `${rules} ${id}`);
    }
  }
});

test('sweep refuses a scan whose holes are wider than its window', () => {
  assert.throws(() => buildTree({ id: 'sweep', P: { G: 16, GAP: 2, WIPE: 2, UP: 3 } }, { rules: 'modelwar' }), /every 16th cell/);
});
