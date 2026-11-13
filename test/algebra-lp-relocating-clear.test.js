import assert from 'node:assert/strict';
import test from 'node:test';
import { VM } from '../src/engine/index.js';
import { buildTree } from '../tools/algebra/index.js';

const id = 'lp-relocating-clear';
const LEAP = 6180, GUARD = 12, N = 17;
const load = (built, base = 7997) => {
  const vm = new VM(built.settings);
  vm.load([built.w], { positions: [base] });
  return { vm, at: offset => vm.norm(base + offset) };
};
// Runs until the single process is on `pc`; returns false at the cycle limit.
const runTo = (vm, pc) => { while (!vm.done && vm.processes(0)[0] !== pc) vm.step(); return !vm.done; };

test('the relocating clear passes the gate alone, with a hit guard cell, in combinations and under full verification', () => {
  for (const rules of ['lp', 'lp-hill']) {
    const built = buildTree({ id }, { rules });
    assert.equal(built.total, N);
    assert.ok(built.verification.observations.some(run => run.scenario === `${id}: planted target`));
    assert.equal(buildTree({ id }, { rules, verification: 'full' }).verification.ok, true);
    assert.equal(buildTree({ id: 'seq', kids: [{ id: 'decoy-maker' }, { id }] }, { rules }).verification.ok, true);
    assert.equal(buildTree({ id: 'image', kids: [{ id }, { id: 'decoys' }] }, { rules }).verification.ok, true);
    assert.equal(buildTree({ id: 'boot', P: { HOP: 3000 }, kids: [{ id }] }, { rules }).verification.ok, true);
  }
  assert.equal(buildTree({ id, P: { LEAP: 4000, GUARD: 6 } }, { rules: 'lp' }).verification.ok, true);
});

test('an SPL pass ends when the front reaches the guard; the code leaps ahead, carries the front and arms the DAT', () => {
  const built = buildTree({ id }, { rules: 'lp' });
  const { vm, at } = load(built);
  const ptr = 14, sbomb = 15, leap = 7, go = 13;
  for (let i = 0; i < 4; i++) vm.step();                       // two guard cells, two bombs
  assert.equal(vm.peek(at(-GUARD)).op, 'MOV');
  assert.deepEqual(vm.peek(at(-GUARD)), vm.peek(at(N - 1 + GUARD)));
  assert.equal(vm.peek(at(ptr + 16)).op, 'SPL');               // the front starts past the back guard
  assert.equal(vm.peek(at(ptr + 17)).op, 'SPL');

  assert.ok(runTo(vm, at(leap)));
  const laps = (8000 - GUARD - (ptr + 16)) / 2;                // bombs from ptr + 16 round to the front guard, two a lap
  assert.equal(vm.steps, 2 + 4 * Math.ceil(laps + 0.5) - 1);
  assert.equal(vm.peek(at(-GUARD)).op, 'SPL');                 // the carpet changed the front guard
  let spl = 0;
  for (let c = 0; c < 8000; c++) if (vm.peek(c).op === 'SPL') spl++;
  assert.ok(spl >= 8000 - N - 2 * GUARD - 4, `${spl} SPL cells after the first pass`);
  const front = vm.norm(at(ptr) + vm.peek(at(ptr)).b);

  assert.ok(runTo(vm, at(go)));
  vm.step();
  assert.deepEqual(vm.processes(0), [at(1 + LEAP)]);
  assert.equal(vm.norm(at(ptr + LEAP) + vm.peek(at(ptr + LEAP)).b), front, 'the copy continues at the same cell');
  assert.equal(vm.peek(at(sbomb + LEAP)).op, 'DAT');
  assert.equal(vm.peek(at(sbomb)).op, 'SPL');                  // the code it left still has the SPL

  // The next pass kills, and wipes the code it left.
  assert.ok(runTo(vm, at(leap + LEAP)));
  for (let c = 0; c < N; c++) assert.equal(vm.peek(at(c)).op, 'DAT');
  while (!vm.done) vm.step();
  assert.equal(vm.warriors[0].alive, true);
  assert.equal(vm.warriors[0].peak, 1);
});

test('a write on either guard cell makes it leap at once', () => {
  const built = buildTree({ id }, { rules: 'lp' });
  for (const guard of [-GUARD, N - 1 + GUARD]) {
    const { vm, at } = load(built);
    for (let i = 0; i < 200; i++) vm.step();
    vm.poke(at(guard), { op: 'DAT', mod: 'F', aMode: '#', a: 3, bMode: '#', b: 3 });
    assert.ok(runTo(vm, at(13)));
    assert.ok(vm.steps < 200 + 8 + 2 * N + 8, `left after ${vm.steps - 200} steps`);
    vm.step();
    assert.deepEqual(vm.processes(0), [at(1 + LEAP)]);
  }
});

test('the finisher starts its carpet at the probe a scanner hands on', () => {
  const finisher = 'lp-relocating-finisher';
  for (const opening of ['opening-sne', 'opening-cmpscan', 'opening-none']) {
    for (const rules of ['lp', 'lp-hill']) {
      const built = buildTree({ id: 'seq', kids: [{ id: opening }, { id: finisher }] }, { rules, verification: opening === 'opening-sne' ? 'full' : 'quick' });
      assert.equal(built.verification.ok, true);
      assert.equal(built.spans[built.root.kids[1].ns].size, N + 3);
    }
  }
  // A target on the scan's first pair: the first SPL lands on the cell the probe points to.
  const built = buildTree({ id: 'seq', kids: [{ id: 'opening-cmpscan' }, { id: finisher }] }, { rules: 'lp' });
  const { vm, at } = load(built, 0);
  const probe = built.labels[built.root.kids[0].ns + 'probe'], sweep = built.labels[built.root.kids[1].ns + 'sweep'];
  const { START, SSTEP } = built.root.kids[0].P;
  const target = START + SSTEP;
  vm.poke(at(target), { op: 'JMP', mod: 'B', aMode: '$', a: 2, bMode: '$', b: 5 });
  assert.ok(runTo(vm, at(sweep)));
  const aimed = vm.norm(at(probe) + vm.peek(at(probe)).b);
  vm.step();
  assert.equal(vm.peek(aimed).op, 'SPL');
  assert.ok(vm.norm(aimed - at(target)) <= 31 || vm.norm(at(target) - aimed) <= 31, 'the carpet starts at the find');
  assert.throws(() => buildTree({ id: finisher }, { rules: 'lp' }), /nothing provides a probe/);
});

test('the relocating clear refuses a leap out of range, partners and other rule sets', () => {
  assert.throws(() => buildTree({ id, P: { LEAP: 7960 } }, { rules: 'lp' }), /LEAP must be an integer from 200 to 7700/);
  assert.throws(() => buildTree({ id, P: { GUARD: 2 } }, { rules: 'lp' }), /GUARD must be an integer from 4 to 64/);
  assert.throws(() => buildTree({ id: 'par', kids: [{ id }, { id: 'imp' }] }, { rules: 'lp' }), /a clear runs alone/);
  assert.throws(() => buildTree({ id }, { rules: '94nop' }), /8,000-cell LP ring/);
});
