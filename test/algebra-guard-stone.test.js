import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree } from '../tools/algebra/index.js';
import { guardFactor, guardStep, guardPlan } from '../tools/algebra/blocks/guard-stone.js';
import guardBlocks from '../tools/algebra/blocks/guard-stone.js';

const defaults = guardBlocks[0].defaults;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const mod = (x, n) => ((x % n) + n) % n;

test('guard-stone sizes its step and its guard to any core', () => {
  for (const core of [8000, 25200, 55440, 8192]) {
    const g = guardFactor(defaults.G, core), S = guardStep(defaults, core), plan = guardPlan(defaults, core);
    assert.equal(gcd(S, core), g, `core ${core}: the step shares exactly ${g}`);
    assert.ok(plan, `core ${core}: a start exists`);
    // The guard is the first cell of the block the lattice reaches.
    const { lay, X0, K } = plan;
    const at = (k, extra) => mod(lay.p + X0 + 2 * k * S + extra, core);
    assert.equal(at(K, 0), lay.guard, `core ${core}: step K writes the guard`);
    for (let k = 1; k <= K + lay.procs + 2; k++) {
      for (const extra of [0, S]) {
        if (k === K && extra === 0) continue;
        assert.ok(!lay.critical.includes(at(k, extra)), `core ${core}: step ${k} would hit the block's own code`);
      }
    }
  }
  assert.equal(guardFactor(defaults.G, 7919), 1);                 // a prime core has no factor to share
  assert.match(guardBlocks[0].mismatches(defaults, { coreSize: 7919, maxProcesses: 8000 }).join(), /no factor/);
});

test('guard-stone passes the gate alone on every ring, with each bomb and process count', () => {
  for (const rules of ['modelwar', '94nop', '94x', 'lp']) {
    const s = buildTree({ id: 'guard-stone' }, { rules, verification: 'full' });
    assert.equal(s.verification.ok, true, rules);
    assert.ok(s.verification.observations.some(({ scenario }) => scenario === 'guard-stone: planted target'), rules);
  }
  for (const P of [{ BOMB: 0 }, { BOMB: 1 }, { M: 0 }, { M: 2 }, { CLR: 0 }, { G: 4, GPAD: 0 }]) {
    const s = buildTree({ id: 'guard-stone', P }, { rules: 'modelwar', verification: 'full' });
    assert.equal(s.verification.ok, true, JSON.stringify(P));
  }
});

test('guard-stone runs its processes through the loop in order: every step writes a fresh cell', async () => {
  const { VM } = await import('../src/engine/index.js');
  const { recipeSettings } = await import('../tools/blocks/recipes.js');
  const settings = recipeSettings('modelwar');
  const built = buildTree({ id: 'guard-stone', P: { M: 1 } }, { rules: 'modelwar' });
  const vm = new VM(settings);
  vm.load([built.w], { positions: [0] });
  const p = built.labels[built.root.ns + 'p'], { S, X0 } = guardPlan(built.root.P, settings.coreSize);
  for (let i = 0; i < 2000; i++) vm.step();
  // The MOV bomb (the default) differs from empty core, so a missing write shows. While the boot's
  // processes fall into line the first two steps are skipped; from the third, every step writes both
  // bombs, and nothing lands off the lattice.
  const bomb = vm.peek(built.labels[built.root.ns + 'bomb']), core = settings.coreSize;
  assert.equal(bomb.op, 'MOV');
  const lattice = new Set();
  for (let k = 0; k <= 1000; k++) for (const e of [0, S]) lattice.add(mod(p + X0 + 2 * k * S + e, core));
  for (let a = built.total; a < core; a++) if (vm.peek(a).op === 'MOV') assert.ok(lattice.has(a), `a bomb at ${a} is off the lattice`);
  for (let k = 3; k <= 100; k++) {
    const c = mod(p + X0 + 2 * k * S, core);
    assert.equal(vm.peek(c).op, bomb.op, `step ${k} was skipped`);
    assert.equal(vm.peek(mod(c + S, core)).op, bomb.op, `step ${k}'s second bomb was skipped`);
  }
});

test('guard-stone beside a sweep in a switch-score', () => {
  const t = buildTree({ id: 'switch-score', P: { STREAK: 4 }, kids: [{ id: 'sweep' }, { id: 'guard-stone', P: { BOMB: 2, M: 0 } }] }, { rules: 'modelwar', length: 200, verification: 'full' });
  assert.equal(t.verification.ok, true);
});

test('guard-stone refuses more processes than the hill allows', () => {
  assert.throws(() => buildTree({ id: 'guard-stone', P: { M: 2 } }, { rules: 'lp' }), /this hill allows 8/);
});
