import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree } from '../tools/algebra/index.js';
import { sweepEntries } from '../tools/algebra/blocks/sweep.js';

test('sweep VARY plays a different step each round, from a P-space round counter', async () => {
  const { VM } = await import('../src/engine/index.js');
  const { recipeSettings } = await import('../tools/blocks/recipes.js');
  const settings = { ...recipeSettings('modelwar'), maxLength: 600 };
  for (const VARY of [2, 4]) {
    const P = { G: 7, STEPF: 8600, STARTF: 6100, CLR: 0, TRIP: 0, LAPF: 34, VARY };
    const t = buildTree({ id: 'boot', P: { HOP: 12600, DIRECT: 1 }, kids: [{ id: 'sweep', P }] }, { rules: 'modelwar', length: 600, verification: 'full' });
    assert.equal(t.verification.ok, true, `VARY ${VARY}`);
    const sweep = t.root.kids[0], entries = sweepEntries(sweep.P, settings.coreSize);
    assert.equal(new Set(entries.map(([s]) => s)).size, VARY, 'the steps differ');
    const at = (l) => t.labels[sweep.ns + l] + 12600;
    let counter = 0;
    for (let round = 0; round <= VARY; round++) {
      const ps = VM.freshPSpace(settings);
      ps[sweep.P.VCELL] = counter;
      const vm = new VM(settings);
      vm.load([t.w], { positions: [0], pspaces: [ps] });
      for (let i = 0; i < 300; i++) vm.step();
      const [S, start] = entries[round % VARY];
      assert.equal(vm.peek(at('st')).a, S, `round ${round}: the step`);
      counter = vm.warriors[0].pspace[sweep.P.VCELL];
      assert.equal(counter, (round % VARY) + 1, `round ${round}: the counter`);
      assert.ok(start > 0);
    }
  }
});

test('twin-scan VARY rotates its step and its probes the same way', async () => {
  const { VM } = await import('../src/engine/index.js');
  const { recipeSettings } = await import('../tools/blocks/recipes.js');
  const { twinEntries } = await import('../tools/algebra/blocks/twin-scan.js');
  const settings = { ...recipeSettings('modelwar'), maxLength: 600 };
  const P = { VARY: 3, STEPF: 7300, STARTF: 1768, STEPF2: 3700, STARTF2: 5300, STEPF3: 4100, STARTF3: 1768, CLR: 0 };
  const t = buildTree({ id: 'boot', P: { HOP: 12600, EARLY: 1 }, kids: [{ id: 'twin-scan', P }, { id: 'decoy-field' }] }, { rules: 'modelwar', length: 600, verification: 'full' });
  assert.equal(t.verification.ok, true);
  const twin = t.root.kids[0], entries = twinEntries(twin.P, settings.coreSize);
  let counter = 0;
  for (let round = 0; round <= 3; round++) {
    const ps = VM.freshPSpace(settings);
    ps[twin.P.VCELL] = counter;
    const vm = new VM(settings);
    vm.load([t.w], { positions: [0], pspaces: [ps] });
    for (let i = 0; i < 600; i++) vm.step();
    assert.equal(vm.peek(t.labels[twin.ns + 'st'] + 12600).a, entries[round % 3][0], `round ${round}`);
    counter = vm.warriors[0].pspace[twin.P.VCELL];
  }
});

test('sweep VARY needs P-space; VARY 0 keeps the plain sweep', () => {
  assert.throws(() => buildTree({ id: 'sweep', P: { VARY: 2 } }, { rules: '94nop' }), /P-space/);
  const plain = buildTree({ id: 'sweep' }, { rules: 'modelwar' }), off = buildTree({ id: 'sweep', P: { VARY: 1 } }, { rules: 'modelwar' });
  assert.deepEqual(off.w.instructions, plain.w.instructions);
});
