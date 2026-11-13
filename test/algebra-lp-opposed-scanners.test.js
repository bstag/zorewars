import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTree, observeTree } from '../tools/algebra/index.js';

const id = 'lp-opposed-scanners';
const rules = 'lp-hill';

test('the four scanners keep complete lanes at a wrapped placement', () => {
  for (const [P, expected] of [[{}, 2], [{ SHIFT: 4000 }, 1], [{ SPREAD: 10 }, 4]]) {
    const built = buildTree({ id, P }, { rules, verification: 'full' });
    const base = 7997;
    const { observation } = observeTree(built, { positions: [base] });
    const { phases, work } = observation.blocks[0];
    const targets = [1, 2, 3, 4].map(i => phases[`site-${i}-first-probe`].target);
    assert.deepEqual([1, 2, 3, 4].map(i => phases[`site-${i}-entry`].cycle + 1), [35, 37, 38, 40]);
    assert.equal(new Set(targets.map(target => target % 80)).size, expected);
    assert.ok(Object.values(work).every(({ uniqueTargets }) => uniqueTargets === 100));
    assert.equal(observation.processes, 4);
  }
});

test('a nonzero B field alone leaves an LP scanner quiet', () => {
  const built = buildTree({ id }, { rules });
  const marker = { op: 'JMP', mod: 'B', aMode: '#', a: 0, bMode: '$', b: 7 };
  const { vm, observation } = observeTree(built, {
    positions: [0], cycles: 50,
    injections: [{ cycle: 0, address: 2057, instruction: marker },
      { cycle: 0, address: 2217, instruction: { ...marker, a: 3 } }],
  });
  assert.deepEqual(vm.peek(2057), marker);
  assert.deepEqual(observation.blocks[0].phases['site-2-first-hit'], { cycle: 44, target: 2217 });
  assert.equal(vm.peek(2217).a, 0);
});

test('linking rejects a probe orbit through friendly code', () => {
  assert.throws(() => buildTree({ id, P: { START: 2 } }, { rules }), /probe lane intersects/);
  assert.throws(() => buildTree({ id }, { rules: 'tinylp' }), /8,000-cell ring/);
});

test('a confirmed JMP trap hands off to a bounded DAT sweep at the same layout', () => {
  const build = HANDOFF => buildTree({ id, P: { HANDOFF, SPREAD: 10 } }, { rules, verification: 'full' });
  const control = build(0), clear = build(2);
  const changed = control.w.instructions.filter((instruction, i) => instruction.op !== clear.w.instructions[i].op);
  assert.deepEqual(changed.map(({ op }) => op), ['JMP', 'JMP']);
  assert.deepEqual(control.w.instructions.map(({ op, mod, ...operands }) => operands),
    clear.w.instructions.map(({ op, mod, ...operands }) => operands));
  assert.equal(clear.total, control.total);
  const planted = built => built.verification.observations.at(-1).observation.blocks[0];
  assert.deepEqual(planted(clear).phases['site-1-first-hit'], { cycle: 92, target: 2057 });
  assert.deepEqual(planted(clear).phases['site-1-first-dat'], { cycle: 100, target: 2057 });
  assert.equal(planted(clear).work['site-1-sweep'].uniqueTargets, 120);
  assert.ok(planted(clear).work['site-1-sweep'].count > 120);
  assert.equal(planted(control).phases['site-1-first-dat'], undefined);
});

test('the probe guard rescans while intact and enters the clear when redirected to zero A', () => {
  const built = buildTree({ id, P: { HANDOFF: 1, SPREAD: 10 } }, { rules });
  const base = 7997;
  const guard = (base + 2003) % 8000;
  const target = (base + 2057) % 8000;
  const marker = { op: 'JMP', mod: 'B', aMode: '#', a: 3, bMode: '$', b: 0 };
  const planted = { cycle: 0, address: target, instruction: marker };
  const damaged = { cycle: 94, address: guard, instruction: { ...built.w.instructions[built.labels.b0backguard], b: 9 } };
  for (const injections of [[planted], [planted, damaged]]) {
    const { vm, observation } = observeTree(built, { positions: [base], cycles: 110, injections });
    const phase = observation.blocks[0].phases['site-1-first-dat'];
    assert.deepEqual(phase, injections.length === 2 ? { cycle: 100, target } : undefined);
    assert.equal(vm.peek(target).op, injections.length === 2 ? 'DAT' : 'JMP');
  }
});

test('counted handoff waits for the fourth strike and clears that target across the seam', () => {
  const P = { HANDOFF: 3, HITS: 4, SPREAD: 10 };
  const built = buildTree({ id, P }, { rules, verification: 'full' });
  const base = 7997;
  const marker = { op: 'JMP', mod: 'B', aMode: '#', a: 3, bMode: '$', b: 0 };
  const injections = [2057, 1977, 1897, 1817].map(offset =>
    ({ cycle: 0, address: (base + offset) % 8000, instruction: marker }));
  const run = markers => observeTree(built, { positions: [base], cycles: 165, injections: markers });
  const partial = run(injections.slice(0, 3)).observation.blocks[0];
  assert.equal(partial.work['site-1-strikes'].count, 3);
  assert.equal(partial.phases['site-1-first-dat'], undefined);
  const complete = run(injections).observation.blocks[0];
  assert.equal(complete.work['site-1-strikes'].count, 4);
  assert.deepEqual(complete.phases['site-1-first-dat'], { cycle: 160, target: 1814 });
  assert.throws(() => buildTree({ id, P: { ...P, SPREAD: 0 } }, { rules }), /four distinct probe lanes/);
});

test('an outward sweep repeats across the seam and leaves its next cell untouched', () => {
  const P = { HANDOFF: 3, HITS: 1, SPREAD: 10, SWEEP: 1800, OUTWARD: 1 };
  const built = buildTree({ id, P }, { rules, verification: 'full' });
  const marker = { op: 'JMP', mod: 'B', aMode: '#', a: 3, bMode: '$', b: 0 };
  const base = 5000;
  const { vm, observation } = observeTree(built, {
    positions: [base], cycles: 16000, injections: [{ cycle: 0, address: base + 2227, instruction: marker }],
  });
  const sweep = observation.blocks[0].work['site-2-sweep'];
  assert.equal(sweep.firstTarget, base + 2160 + 16);
  assert.equal(sweep.uniqueTargets, 1800);
  assert.ok(sweep.count > 1800);
  assert.ok(vm.lastWrite[975] > 0);
  assert.equal(vm.lastWrite[976], -Infinity);
});

test('the linker rejects sweep widths that first cross into a peer or the loaded image', () => {
  const P = { HANDOFF: 3, HITS: 64, SPREAD: 10 };
  for (const [SWEEP, OUTWARD] of [[144, 0], [1823, 1]]) {
    assert.ok(buildTree({ id, P: { ...P, SWEEP, OUTWARD } }, { rules }).verification.ok);
    assert.throws(() => buildTree({ id, P: { ...P, SWEEP: SWEEP + 1, OUTWARD } }, { rules }),
      /a clear strip intersects friendly code/);
  }
});

const aimLayout = { OUTWARD: 1, START: 74, SPREAD: 3, HANDOFF: 3 };
const buildAim = P => buildTree({ id, P: { ...aimLayout, ...P } }, { rules, length: 100, verification: 'full' });

test('aiming and the fixed control start sweeping at the same turn', () => {
  const control = buildAim({ AIM: 1, HITS: 2, SWEEP: 1795 });
  const aimed = buildAim({ AIM: 2, HITS: 2, SWEEP: 1795 });
  const fallback = buildAim({ AIM: 2, HITS: 2, SWEEP: 1796 });
  const data = built => built.verification.observations.at(-1).observation.blocks[0];
  const sweep = built => data(built).work['site-1-sweep'];
  assert.equal(control.total, 73);
  assert.deepEqual(aimed.w.instructions.filter((instruction, i) => instruction.b !== control.w.instructions[i].b)
    .map(({ op }) => op), ['SLT', 'SLT']);
  assert.equal(sweep(aimed).firstCycle, sweep(control).firstCycle);
  assert.equal(sweep(fallback).firstCycle, sweep(control).firstCycle);
  assert.equal(sweep(aimed).firstTarget, 1994);
  assert.equal(sweep(control).firstTarget, 1999);
  assert.equal(sweep(fallback).firstTarget, 1999);
  assert.equal(data(fallback).phases['site-1-aim'], undefined);
});

test('the forward aimed clear retains its anchor when it resets across the seam', () => {
  const built = buildAim({ AIM: 2, HITS: 1 });
  const base = 5750;
  const address = base + 2237;
  const marker = { op: 'JMP', mod: 'B', aMode: '#', a: 3, bMode: '$', b: 0 };
  const { vm, observation } = observeTree(built, {
    positions: [base], cycles: 1400, injections: [{ cycle: 0, address, instruction: marker }],
  });
  const { phases, work } = observation.blocks[0];
  assert.ok(phases['site-2-aim']);
  assert.equal(work['site-2-sweep'].firstTarget, address);
  assert.equal(work['site-2-sweep'].uniqueTargets, 120);
  assert.ok(work['site-2-sweep'].count > 120);
  assert.ok(vm.lastWrite[106] > 0);
  assert.equal(vm.lastWrite[107], -Infinity);
});

test('the trap burst rearms twice and returns to the original probe sequence', () => {
  const P = { HITS: 2, SWEEP: 5, OUTWARD: 1, SPREAD: 10 };
  const build = HANDOFF => buildTree({ id, P: { ...P, HANDOFF } }, { rules, verification: 'full' });
  const dat = build(4), control = build(5);
  const observation = built => built.verification.observations.at(-1).observation.blocks[0];
  assert.equal(dat.total, 49);
  assert.deepEqual(observation(dat).phases, observation(control).phases);
  assert.equal(observation(dat).work['site-1-rearms'].count, 2);
  assert.equal(observation(dat).work['site-1-burst-dats'].uniqueTargets, 10);
  assert.equal(observation(dat).work['site-1-probes'].uniqueTargets, 100);
  assert.equal(observation(control).work['site-1-burst-dats'], undefined);

  const base = 6025;
  const address = (base + 1977) % 8000;
  const marker = { op: 'JMP', mod: 'B', aMode: '#', a: 3, bMode: '$', b: 0 };
  const injections = [2057, 1977].map(offset => ({ cycle: 0, address: (base + offset) % 8000, instruction: marker }));
  for (const [built, op] of [[dat, 'DAT'], [control, 'JMP']]) {
    const { vm } = observeTree(built, { positions: [base], cycles: 180, injections });
    assert.equal(vm.peek(address).op, op);
  }
});

test('the linker protects every residue a trap burst can visit', () => {
  const P = { HANDOFF: 4, HITS: 1, OUTWARD: 1, SPREAD: 10 };
  assert.ok(buildTree({ id, P: { ...P, SWEEP: 9 } }, { rules }).verification.ok);
  assert.throws(() => buildTree({ id, P: { ...P, SWEEP: 10 } }, { rules }), /burst from this probe lane intersects/);
  assert.throws(() => buildTree({ id, P: { ...P, SWEEP: 9, BURSTSKIP: 1 } }, { rules }), /burst from this probe lane intersects/);
});

test('a neighboring burst leaves the trap in place across the seam', () => {
  const P = { HANDOFF: 4, HITS: 2, SWEEP: 5, BURSTSKIP: 1, OUTWARD: 1, SPREAD: 10 };
  const built = buildTree({ id, P }, { rules, verification: 'full' });
  const base = 6023;
  const marker = { op: 'JMP', mod: 'B', aMode: '#', a: 3, bMode: '$', b: 0 };
  const injections = [2057, 1977].map(offset => ({ cycle: 0, address: (base + offset) % 8000, instruction: marker }));
  const { vm, observation } = observeTree(built, { positions: [base], cycles: 240, injections });
  assert.equal(vm.peek(0).op, 'JMP');
  assert.equal(observation.blocks[0].work['site-1-burst-dats'].firstTarget, 7999);
  for (let address = 7995; address < 8000; address++) assert.ok(vm.lastWrite[address] > 0);
  assert.equal(vm.lastWrite[7994], -Infinity);
});

test('the inline DAT and NOP follow-ups share a 33-cell layout and hit timing', () => {
  const build = HANDOFF => buildTree({ id, P: { HANDOFF, SPREAD: 10 } }, { rules, verification: 'full' });
  const dat = build(6), nop = build(7);
  const data = built => built.verification.observations.at(-1).observation.blocks[0];
  assert.equal(dat.total, 33);
  assert.equal(nop.total, 33);
  assert.deepEqual(data(dat).phases, data(nop).phases);
  assert.deepEqual(data(dat).phases['site-1-first-hit'], { cycle: 52, target: 2057 });
  assert.deepEqual(data(dat).phases['site-1-first-burst'], { cycle: 56, target: 2057 });
  assert.equal(data(dat).work['site-1-burst-dats'].count, 1);
  assert.equal(data(nop).work['site-1-burst-dats'], undefined);
});

test('a shorter scan step doubles the orbit while preserving first probes', () => {
  const build = STEP => buildTree({ id, P: { START: 31, SPREAD: 4, STEP } }, { rules, verification: 'full' });
  const data = built => built.verification.observations[0].observation.blocks[0];
  const short = data(build(40)), standard = data(build(80));
  assert.deepEqual(short.phases, standard.phases);
  assert.ok(Object.values(short.work).every(({ uniqueTargets }) => uniqueTargets === 200));
  assert.ok(Object.values(standard.work).every(({ uniqueTargets }) => uniqueTargets === 100));
  assert.throws(() => build(42), /even step dividing the core/);
  assert.throws(() => buildTree({ id, P: { STEP: 40 } }, { rules }), /probe lane intersects/);
});

test('the smaller loader admits four safe 250-cell lanes', () => {
  const P = { START: 10, SPREAD: 2, STEP: 32 };
  const built = buildTree({ id, P: { ...P, UNROLL: 1 } }, { rules, verification: 'full' });
  const { phases, work } = built.verification.observations[0].observation.blocks[0];
  assert.equal(built.total, 25);
  assert.equal(phases['site-1-entry'].cycle, 40);
  assert.ok(Object.values(work).every(({ uniqueTargets }) => uniqueTargets === 250));
  assert.throws(() => buildTree({ id, P }, { rules }), /probe lane intersects/);
});
