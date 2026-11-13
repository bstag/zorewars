import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTree, observeTree } from '../tools/algebra/index.js';

const id = 'lp-transparent-pair';
const rules = 'lp-hill';
const build = P => buildTree({ id, P }, { rules, verification: 'full' });

test('a wrapped transparent pair locks its peer, hits itself, then retires the peer with DAT', () => {
  const built = build();
  const base = 7993;
  const { vm, observation } = observeTree(built, { positions: [base] });
  const { phases } = observation.blocks[0];
  assert.equal(built.total, 26);
  assert.deepEqual(phases['peer-lock'], { cycle: 16029, target: 2150, distinctProbes: 3997 });
  assert.equal(phases['peer-executes-lock'].cycle, 16030);
  assert.deepEqual(phases['self-lock'], { cycle: 16043, target: 1994, distinctProbes: 3999 });
  assert.deepEqual(phases['first-dat'], { cycle: 16049, target: 1990 });
  assert.equal(phases['peer-retires'].cycle, 47411);
  assert.deepEqual(vm.processes(0), [1997]);
});

test('the forward scanner waits in its deployed image before the peer race', () => {
  const built = build({ STEP: 82, HOP: 500 });
  const { phases } = built.verification.observations[0].observation.blocks[0];
  assert.equal(phases['fore-entry'].cycle, 130);
  assert.equal(phases['peer-lock'].target, 665);
  assert.equal(phases['peer-lock'].distinctProbes, 3997);
  assert.equal(phases['self-lock'].distinctProbes, 3999);
});

test('the A-field probe ignores a B-only marker and traps the next A-marked cell', () => {
  const built = build();
  const marker = { op: 'JMP', mod: 'B', aMode: '#', a: 0, bMode: '$', b: 7 };
  const { vm } = observeTree(built, {
    positions: [0], cycles: 90, injections: [
      { cycle: 0, address: 1845, instruction: marker },
      { cycle: 0, address: 1767, instruction: { ...marker, a: 9 } },
    ],
  });
  assert.deepEqual(vm.peek(1845), marker);
  assert.equal(vm.peek(1767).a, 0);
  assert.equal(vm.writerPc[1767], 2002);
});

test('switching only JMZ modifiers to B stalls both scanners on their own traps', () => {
  const built = build();
  const instructions = built.w.instructions.map(ins => ins.op === 'JMZ' ? { ...ins, mod: 'B' } : ins);
  const { vm, observation } = observeTree({ ...built, w: { ...built.w, instructions } });
  const { phases, work } = observation.blocks[0];
  assert.equal(phases['first-dat'], undefined);
  assert.equal(work['back-probes'].uniqueTargets, 640);
  assert.equal(work['fore-probes'].uniqueTargets, 75);
  assert.deepEqual(vm.peek(work['back-probes'].lastTarget),
    { op: 'JMP', mod: 'B', aMode: '#', a: 0, bMode: '$', b: 6080 });
});

test('advancing the forward seed changes which scanner enters the clear', () => {
  const built = build();
  const seed = built.labels.b0foreseed;
  const instructions = built.w.instructions.map((ins, i) => i === seed ? { ...ins, b: ins.b + 40 * 78 } : ins);
  const { observation } = observeTree({ ...built, w: { ...built.w, instructions } });
  const { phases } = observation.blocks[0];
  assert.equal(phases['back-entry'].cycle, 29);
  assert.equal(phases['fore-entry'].cycle, 130);
  assert.equal(phases['first-dat'], undefined);
  assert.deepEqual(phases['forward-peer-lock'], { cycle: 15980, target: 2001, distinctProbes: 3958 });
  assert.deepEqual(phases['forward-first-dat'], { cycle: 16000, target: 2153 });
});

test('the transparent pair rejects geometry without a 4,000-cell ring orbit', () => {
  assert.throws(() => build({ STEP: 80 }), /gcd/);
  assert.throws(() => buildTree({ id }, { rules: 'lp', torus: '100x80' }), /requires the 8,000-cell ring/);
});

test('the transparent quartet shares eight slots between two clears and two locked peers', () => {
  const built = buildTree({ id: 'lp-transparent-quartet' }, { rules, length: 54, verification: 'full' });
  const observe = base => {
    const { observation, vm } = observeTree(built, { positions: [base] });
    const relative = address => vm.norm(address - base);
    const { phases, work } = observation.blocks[0];
    const normalized = Object.fromEntries(Object.entries(phases).map(([name, data]) => [name, {
      ...data, ...(data.target !== undefined && { target: relative(data.target) }),
      ...(data.writerPc !== undefined && { writerPc: relative(data.writerPc) }),
      ...(data.queue && { queue: data.queue.map(relative) }),
    }]));
    return { phases: normalized, work, finalQueue: vm.processes(0).map(relative) };
  };
  const normal = observe(0), wrapped = observe(7993);
  assert.equal(built.total, 54);
  assert.deepEqual(normal.phases, wrapped.phases);
  assert.deepEqual(normal.finalQueue, wrapped.finalQueue);
  const { phases, work } = normal;
  assert.equal(phases['pair-2-peer-lock'].distinctProbes, 3997);
  assert.equal(phases['pair-2-self-lock'].distinctProbes, 3999);
  assert.deepEqual(phases['first-cap'], {
    cycle: 32140,
    queue: [2157, 5967, 5966, 5965, 6118, 2006, 2005, 2004],
    slots: [3, 1, 3, 1],
    roles: ['locked', 'queued-dat', 'clear-writer', 'feeder', 'locked', 'queued-dat', 'clear-writer', 'feeder'],
  });
  assert.equal(phases['peer-retires'].writerPc, 5966);
  assert.equal(phases['pair-2-peer-retires'].writerPc, 2005);
  assert.deepEqual(phases['clear-retires'].slots, [0, 0, 3, 0]);
  assert.ok(work.feeds.count > 0 && work['pair-2-feeds'].count > 0);
  assert.equal(work['capped-feeds'], undefined);
  assert.equal(work['pair-2-capped-feeds'], undefined);
  assert.deepEqual(normal.finalQueue, [5965]);
});

test('the partitioned quartet resets both safe sectors and writes from both sites at the limit', () => {
  const built = buildTree({ id: 'lp-partitioned-quartet' }, { rules, length: 68, verification: 'full' });
  const { vm, observation } = observeTree(built, { positions: [7993] });
  const { phases, work } = observation.blocks[0];
  assert.equal(built.total, 68);
  assert.equal(phases['first-cap'].cycle, 32246);
  assert.deepEqual(phases['first-cap'].slots, [3, 1, 3, 1]);
  assert.equal(phases['peer-retires'].writerPc, 2000);
  assert.equal(phases['pair-2-peer-retires'].writerPc, 5961);
  assert.equal(phases['clear-retires'], undefined);
  for (const prefix of ['', 'pair-2-']) {
    assert.equal(work[`${prefix}resets`].count, 2);
    assert.equal(work[`${prefix}back-dat-writes`].uniqueTargets, 1801);
    assert.ok(work[`${prefix}back-dat-writes`].lastCycle > 79980);
  }
  assert.equal(vm.peek(1998).op, 'SPL');
  assert.equal(vm.peek(2000).op, 'MOV');
  assert.equal(vm.peek(5959).op, 'SPL');
  assert.equal(vm.peek(5961).op, 'MOV');
});

test('partitioned clear geometry rejects a sector that wraps into the loaded image', () => {
  assert.throws(() => buildTree({ id: 'lp-partitioned-quartet', P: { HOP: 3600 } }, { rules, length: 68 }),
    /overlapping or unsafe clear sectors/);
  const narrow = buildTree({ id: 'lp-partitioned-quartet', P: { WIDTH: 256 } },
    { rules, length: 68, verification: 'full' });
  assert.ok(narrow.verification.ok);
});
