import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree } from '../tools/algebra/index.js';
import { twinFactor, twinStep, twinStart, twinLoops } from '../tools/algebra/blocks/twin-scan.js';
import twinBlocks from '../tools/algebra/blocks/twin-scan.js';

const defaults = twinBlocks[0].defaults;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

test('twin-scan sizes its step, start and timer to any core', () => {
  for (const core of [8000, 25200, 55440, 8192]) {
    const g = twinFactor(defaults.G, core), S = twinStep(defaults, core);
    assert.equal(core % g, 0);
    assert.equal(gcd(S, core), g, `core ${core}: the step shares exactly ${g}`);
    assert.ok(twinStart(defaults, core) > defaults.GAP);
    assert.ok(twinLoops(defaults, core) >= 2);
  }
  assert.equal(twinFactor(defaults.G, 7919), 1);
  assert.match(twinBlocks[0].mismatches(defaults, { coreSize: 7919 }).join(), /no factor/);
});

test('twin-scan passes the gate alone on every ring, booted, and with its options', () => {
  for (const rules of ['modelwar', '94nop', '94x', 'lp']) {
    const s = buildTree({ id: 'twin-scan' }, { rules, verification: 'full' });
    assert.equal(s.verification.ok, true, rules);
    assert.ok(s.verification.observations.some(({ scenario }) => scenario === 'twin-scan: planted target'), rules);
  }
  for (const P of [{ CLR: 0 }, { UP: 0, GAP: 2, WIPE: 2 }, { G: 8, GAP: 9, WIPE: 10, UP: 4 }, { TIME: 50 }]) {
    const s = buildTree({ id: 'twin-scan', P }, { rules: 'modelwar', verification: 'full' });
    assert.equal(s.verification.ok, true, JSON.stringify(P));
  }
  const b = buildTree({ id: 'boot', P: { HOP: 12600 }, kids: [{ id: 'twin-scan' }, { id: 'decoy-field', P: { COUNT: 190 } }] }, { rules: 'modelwar', length: 300, verification: 'full' });
  assert.equal(b.verification.ok, true);
});

test('twin-scan refuses a wipe that does not reach its high probe', () => {
  assert.throws(() => buildTree({ id: 'twin-scan', P: { GAP: 9, UP: 4, WIPE: 5 } }, { rules: 'modelwar' }), /does not reach the high probe/);
});
