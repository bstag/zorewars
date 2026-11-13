import assert from 'node:assert/strict';
import test from 'node:test';
import { VM } from '../src/engine/index.js';
import { buildTree } from '../tools/algebra/index.js';
import { selfhitPlan } from '../tools/algebra/blocks/lp-selfhit-scanner.js';

const id = 'lp-selfhit-scanner';
const defaults = { MODE: 1, STEP: 28, PROBES: 2000, GAP: 14, STUN: 1, CLEAR: 1, GUARD: 1 };
const single = { MODE: 0, STEP: 3046, PROBES: 4000, GAP: 7 };                 // guarded, one cell at a time, every 2nd cell
const plain = { GUARD: 0, MODE: 0, STEP: 7956, PROBES: 2000, GAP: 12, STUN: 0 };   // the unguarded layout
// [parameters, cells]: every MODE, STUN and CLEAR at least once, on a lattice its layout allows.
const variants = [
  [{}, 16],
  [{ ...single }, 15],
  [{ ...plain }, 10],
  [{ ...plain, STUN: 2 }, 10],
  [{ ...plain, CLEAR: 0, STEP: 3048, PROBES: 1000 }, 9],
  [{ ...plain, STUN: 1, STEP: 3056, PROBES: 500 }, 13],
  [{ ...plain, STUN: 1, STEP: 3056, PROBES: 500, CLEAR: 0 }, 12],
  [{ ...plain, MODE: 1, STEP: 3048, PROBES: 1000 }, 13],
  [{ ...plain, MODE: 1, STEP: 3048, PROBES: 1000, STUN: 2 }, 13],
  [{ ...plain, MODE: 1, STEP: 3056, PROBES: 500, GAP: 24, CLEAR: 0 }, 12],
  [{ ...plain, MODE: 1, STEP: 3104, PROBES: 250, GAP: 16, STUN: 1 }, 16],
  [{ ...plain, MODE: 1, STEP: 3104, PROBES: 250, GAP: 16, STUN: 1, CLEAR: 0 }, 15],
  // Guarded: every 2nd cell alone, every 2nd (g 4, GAP 6) and every 4th (g 8, GAP 12) as a pair, each STUN and CLEAR.
  [{ ...single, STUN: 0 }, 11], [{ ...single, STUN: 2, CLEAR: 0 }, 10], [{ ...single, CLEAR: 0 }, 14],
  [{ ...single, STEP: 7997, PROBES: 2667, STUN: 0 }, 11],
  ...[0, 1, 2].flatMap(STUN => [0, 1].flatMap(CLEAR => [
    [{ MODE: 1, STEP: 3044, PROBES: 2000, GAP: 6, STUN, CLEAR }, (STUN === 1 ? 15 : 13) + CLEAR],
    [{ MODE: 1, STEP: 3048, PROBES: 1000, GAP: 12, STUN, CLEAR }, (STUN === 1 ? 15 : 13) + CLEAR],
  ])),
];

test('every scanner variant passes the gate alone and with a planted target on both LP rule sets', () => {
  for (const [P, cells] of variants) {
    for (const rules of ['lp', 'lp-hill']) {
      const built = buildTree({ id, P }, { rules });
      assert.equal(built.total, cells, JSON.stringify(P));
      assert.equal(built.verification.ok, true);
      assert.ok(built.verification.observations.some(run => run.scenario === `${id}: planted target`));
    }
  }
});

test('the scan stuns a target on its probe, bombs its trip on the predicted step and clears to the cycle limit', () => {
  for (const [P] of variants) {
    const full = { ...defaults, ...P }, plan = selfhitPlan(full);
    const built = buildTree({ id, P }, { rules: 'lp' });
    const base = 7997, at = label => (base + plan.at[label]) % 8000;
    const perProbe = plan.pair ? 3 : 2, stuns = plan.names.filter(name => /^s\d$/.test(name)).length;

    // Alone: nothing is found before the trip, so the SPL runs on the predicted step.
    let vm = new VM(built.settings);
    vm.load([built.w], { positions: [base] });
    for (let i = 0; i < plan.handoff; i++) vm.step();
    assert.deepEqual(vm.processes(0), [at('feed')], JSON.stringify(P));
    const stunOp = plan.below ? 'JMP' : ['JMP', 'SPL', 'DJN'][full.STUN];     // the guarded pair puts its SPL one below
    assert.equal(vm.peek(at(plan.trip)).op, stunOp);
    while (!vm.done) vm.step();
    assert.equal(vm.warriors[0].alive, true);
    assert.equal(vm.cycle, 80000);
    assert.equal(vm.processes(0).length, 8);
    let untouched = 0;
    for (let c = 0; c < 8000; c++) if (vm.writeCycle[c] < plan.handoff) untouched++;
    assert.ok(untouched <= plan.size, 'the clear covered the core');

    // A target on the third probe is stunned as soon as that probe finds it.
    vm = new VM(built.settings);
    vm.load([built.w], { positions: [base] });
    const target = vm.norm(at('look') + plan.first + 3 * full.STEP);
    vm.poke(target, { op: 'MOV', mod: 'I', aMode: '$', a: 1, bMode: '$', b: 2 });
    for (let i = 0; i < 2 * perProbe + 2 + stuns + (plan.guard ? 5 : 0); i++) vm.step();
    assert.equal(vm.peek(target).op, stunOp, JSON.stringify(P));
    if (full.STUN === 1) assert.equal(vm.peek(target + (plan.below ? -1 : 1)).op, plan.below ? 'SPL' : 'JMP');
  }
});

test('the scanner works behind a boot, an opening and decoys', () => {
  assert.equal(buildTree({ id: 'boot', P: { HOP: 3000 }, kids: [{ id }] }, { rules: 'lp' }).total, 22);
  const pair = { ...single };
  assert.equal(buildTree({ id: 'boot', P: { HOP: 3000 }, kids: [{ id, P: pair }, { id: 'decoys' }] }, { rules: 'lp-hill' }).verification.ok, true);
  assert.equal(buildTree({ id: 'seq', kids: [{ id: 'decoy-maker' }, { id }] }, { rules: 'lp' }).verification.ok, true);
  assert.equal(buildTree({ id: 'image', kids: [{ id }, { id: 'decoys' }] }, { rules: 'lp' }).verification.ok, true);
});

test('SECTOR copies pass over each other, hand over on each other\'s trips, and clear disjoint sectors', () => {
  const twin = { id: 'copies', P: { N: 2, D: 4000 }, kids: [{ id, P: { SECTOR: 4000 } }] };
  const quad = { id: 'copies', P: { N: 4, D: 2000 }, kids: [{ id, P: { SECTOR: 2000 } }] };
  for (const rules of ['lp', 'lp-hill']) {
    assert.equal(buildTree(twin, { rules, verification: 'full' }).total, 27);
    assert.equal(buildTree(quad, { rules }).total, 39);
  }
  const built = buildTree(twin, { rules: 'lp' });
  const vm = new VM(built.settings);
  vm.load([built.w], { positions: [0] });
  const x = built.spans[built.root.kids[0].ns].start, size = 20;
  const blocks = [x, x + 4000];
  while (!vm.done) {
    vm.step();
    if (vm.steps === 40000) {
      // Both copies are in their clears by now: one process each, in its own sweep.
      assert.deepEqual(vm.processes(0).map(pc => blocks.findIndex(b => pc - b >= 13 && pc - b < 16)).sort(), [0, 1]);
    }
  }
  for (const b of blocks) {
    // The clear and the cells it needs are intact in both copies.
    const norm = ins => ({ ...ins, a: (ins.a + 8000) % 8000, b: (ins.b + 8000) % 8000 });
    for (let c = 13; c < 17; c++) assert.deepEqual(norm(vm.peek(b + c)), norm((({ line, ...ins }) => ins)(built.w.instructions[x + c])));
  }
  let untouched = 0;
  for (let c = 0; c < 8000; c++) if (vm.writeCycle[c] < 0 && !blocks.some(b => c - b >= 0 && c - b < size)) untouched++;
  assert.equal(untouched, 0, 'the two sectors cover the core');
  assert.throws(() => buildTree({ ...twin, P: { N: 2, D: 3000 } }, { rules: 'lp' }), /runs as one of 2 copies 4000 apart/);
  assert.throws(() => buildTree({ id, P: { SECTOR: 4000 } }, { rules: 'lp' }), /runs as one of 2 copies/);
  assert.throws(() => buildTree({ id, P: { SECTOR: 3000 } }, { rules: 'lp' }), /SECTOR is 2000/);
  assert.throws(() => buildTree({ id, P: { SECTOR: 4000, GAP: 3 } }, { rules: 'lp' }), /never probes the cell before look/);
  assert.throws(() => buildTree({ id: 'copies', P: { N: 2, D: 4000 }, kids: [{ id }] }, { rules: 'lp' }), /a clear erases the other copies/);
});

test('FEED 1 gives each SECTOR copy its share of the eight slots and keeps their overshoot on blank pads', () => {
  const twin = { id: 'copies', P: { N: 2, D: 4000 }, kids: [{ id, P: { SECTOR: 4000, FEED: 1 } }] };
  const quad = { id: 'copies', P: { N: 4, D: 2000 }, kids: [{ id, P: { SECTOR: 2000, FEED: 1 } }] };
  for (const rules of ['lp', 'lp-hill']) {
    assert.equal(buildTree(twin, { rules, verification: 'full' }).total, 34);
    assert.equal(buildTree(quad, { rules, verification: 'full' }).total, 43);
  }
  for (const [tree, N, D, pads] of [[twin, 2, 4000, 3], [quad, 4, 2000, 1]]) {
    const built = buildTree(tree, { rules: 'lp' });
    const kid = built.root.kids[0], x = built.spans[kid.ns].start, size = built.spans[kid.ns].size;
    const L = l => built.labels[kid.ns + l] - x;
    assert.equal(L('tripc'), pads);
    const vm = new VM(built.settings);
    vm.load([built.w], { positions: [0] });
    const blocks = Array.from({ length: N }, (_, k) => x + k * D);
    let worst = 0;
    while (!vm.done) {
      const pc = vm.processes(0)[0], k = blocks.findIndex(b => pc - b === L('wipe'));
      if (k >= 0) {
        const ptr = blocks[k] + L('gtmp'), target = (ptr + vm.peek(ptr).b) % 8000;
        // Never on any copy's code (the pads before each trip are blank junk).
        assert.ok(!blocks.some(b => { const r = (target - b + 8000) % 8000; return r >= pads && r < size; }), `write on a copy at ${target}`);
        worst = Math.max(worst, vm.peek(ptr).b);
      }
      vm.step();
    }
    assert.ok(worst <= D - L('gtmp') + pads - 1, 'the overshoot stays on the next copy\'s pads');
    // Each copy's clear holds exactly its share.
    for (const b of blocks) assert.equal(vm.processes(0).filter(pc => pc - b >= L('rst') && pc - b <= L('rj')).length, 8 / N);
  }
  assert.throws(() => buildTree({ id, P: { FEED: 1 } }, { rules: 'lp' }), /FEED is the fed sector clear/);
});

test('without the guard a lattice must reach the trip first; with it only the pair spacing is checked', () => {
  const lp = { rules: 'lp' };
  assert.throws(() => buildTree({ id, P: { ...plain, STEP: 3042 } }, lp), /finds its own \w+ before the trip/);
  assert.throws(() => buildTree({ id, P: { ...plain, CLEAR: 0 } }, lp), /finds its own feed before the trip/);
  assert.throws(() => buildTree({ id, P: { ...plain, MODE: 1, STEP: 3056, PROBES: 500, GAP: 8 } }, lp), /bombs also land on its own/);
  assert.equal(buildTree({ id, P: { ...plain, GUARD: 1, STEP: 3042, PROBES: 4000 } }, lp).verification.ok, true);
  assert.throws(() => buildTree({ id, P: { PROBES: 2001 } }, lp), /returns to its start after 2000 probes/);
  assert.throws(() => buildTree({ id, P: { GAP: 8 } }, lp), /would find its own SPL\/JMP bombs/);
  assert.throws(() => buildTree({ id, P: { GAP: 65 } }, lp), /GAP may be at most 64/);
  assert.throws(() => buildTree({ id }, { rules: 'tinylp' }), /8,000-cell LP ring/);
  assert.throws(() => buildTree({ id }, { rules: '94nop' }), /8,000-cell LP ring/);
  assert.throws(() => buildTree({ id: 'par', kids: [{ id }, { id: 'imp' }] }, lp), /a clear runs alone/);
});

test('every block of this file passes full verification at its defaults', () => {
  for (const rules of ['lp', 'lp-hill']) assert.equal(buildTree({ id }, { rules, verification: 'full' }).verification.ok, true);
});
