import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, gate, observeTree, treeMismatches, treeSettings } from '../tools/algebra/index.js';
import { VM } from '../src/engine/index.js';

const tree = { id: 'paired-clear', P: { HOP: 380 } };
const build = () => buildTree(tree, { rules: 'tinylp', verification: 'full' });
const label = (built, name) => built.labels[`b0${name}`];

test('the live SPL feeder attacks before filling the queue and the surviving clear switches to DAT', () => {
  const feeder = { id: 'paired-clear-feeder' };
  const built = buildTree(feeder, { rules: 'tinylp', verification: 'full' });
  assert.equal(built.total, 15);
  for (const base of [0, 416]) {
    const { vm, observation } = observeTree(built, { positions: [base] });
    const phases = observation.blocks[0].phases;
    assert.equal(phases['remote-first-spl'].cycle + 1, 15);
    assert.equal(phases['home-first-spl'].cycle + 1, 17);
    assert.equal(phases['home-first-dat'].cycle + 1, 4622);
    assert.equal(vm.warriors[0].peak, 8);
    assert.equal(observation.processes, 4);
  }
  assert.throws(() => buildTree(feeder, { rules: 'tiny' }), /eight-process cap/);
});

function changeInstruction(built, name, change) {
  const index = label(built, name);
  const instructions = built.w.instructions.map((ins, i) => i === index ? { ...ins, ...change } : ins);
  return { ...built, w: { ...built.w, instructions } };
}

test('paired clear deploys one complete remote image and assigns one worker to each clear', () => {
  const built = build();
  assert.equal(built.total, 15);
  assert.equal(built.verification.ok, true);
  assert.ok(built.verification.observations.every((observation) => observation.peak === 2));
  const vm = new VM(built.settings);
  // The remote payload straddles the ring seam.
  const home = 416;
  const remote = vm.norm(home + tree.P.HOP);
  vm.load([built.w], { positions: [home] });
  for (let i = 0; i < 12; i++) vm.step();
  assert.deepEqual(vm.processes(0), [vm.norm(remote + label(built, 'write')), home + label(built, 'write')]);
  for (let offset = 0; offset < 8; offset++) {
    assert.deepEqual(vm.peek(remote + offset), vm.peek(home + offset));
  }
  vm.step();
  vm.step();
  assert.equal(vm.writerPc[vm.norm(remote + 15)], vm.norm(remote + label(built, 'write')));
  assert.equal(vm.writerPc[home + 15], home + label(built, 'write'));
});

test('paired clear rejects unsafe spacing and profiles', () => {
  const settings = treeSettings('tinylp');
  assert.match(treeMismatches({ id: 'paired-clear', P: { HOP: 14 } }, settings).join(' '), /no safe clearing interval/);
  assert.match(treeMismatches(tree, { ...settings, maxProcesses: 1 }).join(' '), /process/i);
  assert.ok(treeMismatches(tree, treeSettings('88')).length > 0);
});

test('paired clear gate catches skipped copies, wrong dispatch and a missed pass boundary', () => {
  const built = build();
  assert.throws(() => gate(changeInstruction(built, 'copy1', { op: 'NOP' })), /not copied intact/);
  assert.throws(() => gate(changeInstruction(built, 'route', {
    a: label(built, 'write') - label(built, 'route'),
  })), /one worker at each clear/);
  assert.throws(() => gate(changeInstruction(built, 'meter', {
    b: built.w.instructions[label(built, 'meter')].b + 1,
  }), { verification: 'full' }), /missed its bounded clearing interval/);
});

test('staged paired clear preserves both lanes through the SPL and repeated DAT passes', () => {
  const staged = { id: 'paired-clear-staged', P: { HOP: 380 } };
  const built = buildTree(staged, { rules: 'tinylp', verification: 'full' });
  assert.equal(built.total, 18);
  assert.ok(built.verification.observations.every((observation) => observation.peak === 2));
  const vm = new VM(built.settings);
  const home = 416, away = vm.norm(home + staged.P.HOP);
  vm.load([built.w], { positions: [home] });
  for (let i = 0; i < 14; i++) vm.step();
  assert.deepEqual(vm.processes(0), [vm.norm(away + label(built, 'write')), home + label(built, 'write')]);
  for (let i = 0; i < 4; i++) vm.step();
  for (const origin of [home, away]) {
    assert.equal(vm.peek(origin + 34).op, 'SPL');
    assert.equal(vm.peek(origin + 35).op, 'SPL');
  }
  while (vm.peek(home + 34).op !== 'DAT' && vm.cycle < 1000) vm.step();
  assert.ok(vm.cycle < 1000);
  assert.equal(vm.peek(away + 34).op, 'DAT');
  assert.equal(vm.peek(home + 34 + 255).op, 'SPL');
  assert.equal(vm.peek(away + 34 + 255).op, 'SPL');
  assert.throws(() => gate(changeInstruction(built, 'selectBomb', { op: 'NOP' })), /unexpected write/);
});

test('staged paired clear requires an even stun length inside a safe sector', () => {
  const settings = treeSettings('tinylp');
  assert.match(treeMismatches({ id: 'paired-clear-staged', P: { STUN: 255 } }, settings).join(' '), /STUN must be even/);
  assert.match(treeMismatches({ id: 'paired-clear-staged', P: { HOP: 380, STUN: 334 } }, settings).join(' '), /fit inside/);
  assert.match(treeMismatches({ id: 'paired-clear-staged', P: { START: 17 } }, settings).join(' '), /no safe clearing interval/);
});

test('paired fan changes only two opcodes and completes both phases with a wrapped remote site', () => {
  const HOP = 380;
  const built = [0, 1, 2].map(FAN => buildTree({ id: 'paired-clear-fan', P: { HOP, FAN } },
    { rules: 'tinylp', verification: 'full' }));
  assert.deepEqual(built.map(b => b.total), [27, 27, 27]);
  const [control, halfFan, fan] = built;
  const fanSites = ['fan1', 'fan2'].map(name => label(fan, name));
  const matchControl = fan.w.instructions.map((ins, index) => fanSites.includes(index) ? { ...ins, op: 'NOP' } : ins);
  assert.deepEqual(matchControl, control.w.instructions);
  assert.deepEqual(changeInstruction(fan, 'fan2', { op: 'NOP' }).w.instructions, halfFan.w.instructions);
  for (const [index, b] of built.entries()) {
    assert.ok(b.verification.observations.every(row => row.peak === 2 * 2 ** index));
    const { vm, observation } = observeTree(b, { positions: [416], cycles: 100 });
    const workersAt = origin => vm.processes(0).filter(pc => vm.norm(pc - origin) < 16).length;
    assert.deepEqual([workersAt(416), workersAt(796)], [2 ** index, 2 ** index]);
    const { work } = observation.blocks[0];
    const lanes = [work['home-attack'], work['remote-attack']];
    assert.deepEqual(lanes.map(lane => lane.firstCycle + 1), [[28, 27], [33, 31], [39, 35]][index]);
    assert.deepEqual(lanes.map(lane => lane.uniqueTargets), [[19, 19], [18, 20], [16, 18]][index]);
    for (const work of Object.values(observation.blocks[0].work)) {
      assert.equal(work.count, work.uniqueTargets);
    }
    assert.equal(Object.keys(observation.blocks[0].work).length, 2);
  }
  assert.throws(() => gate(changeInstruction(fan, 'fan2', { op: 'NOP' })), /wrong worker allocation/);
  assert.throws(() => gate(changeInstruction(fan, 'selectBomb', { op: 'NOP' })), /out-of-order SPL or DAT write/);
});

test('paired fan rejects a cap below eight and a partial write group at the phase boundary', () => {
  const settings = treeSettings('tinylp');
  const fan = { id: 'paired-clear-fan', P: { HOP: 380 } };
  assert.match(treeMismatches(fan, { ...settings, maxProcesses: 7 }).join(' '), /process/i);
  assert.match(treeMismatches({ ...fan, P: { HOP: 380, STUN: 254 } }, settings).join(' '), /multiple of eight/);
});

test('attack-first fan writes from both sites before growing and reaches four workers per site', () => {
  const rules = 'tinylp', HOP = 380;
  const buildLead = FAN => buildTree({ id: 'paired-clear-fan', P: { HOP, FAN, LEAD: 1 } },
    { rules, verification: 'full' });
  const control = buildLead(0), fan = buildLead(2);
  assert.equal(fan.total, 30);
  const splitSites = ['fan1', 'fan2'].map(name => label(fan, name));
  assert.deepEqual(fan.w.instructions.map((ins, pc) => splitSites.includes(pc) ? { ...ins, op: 'NOP' } : ins),
    control.w.instructions);

  const positions = [416];
  const early = observeTree(fan, { positions, cycles: 24 });
  const { vm } = early;
  assert.equal(vm.processes(0).length, 2);
  const lanes = ['home-attack', 'remote-attack'].map(name => early.observation.blocks[0].work[name]);
  assert.deepEqual(lanes.map(lane => lane.firstCycle + 1), [24, 23]);
  assert.deepEqual(lanes.map(lane => lane.firstTarget), [447, 27]);
  assert.deepEqual(lanes.map(lane => lane.uniqueTargets), [1, 1]);

  const ready = observeTree(fan, { positions, cycles: 34 }).vm;
  assert.deepEqual([416, 796].map(origin => ready.processes(0).filter(pc => ready.norm(pc - origin) < 18).length),
    [4, 4]);
  assert.throws(() => gate(changeInstruction(fan, 'leadTwo', { op: 'NOP' })), /out-of-order lead write/);
  assert.match(treeMismatches({ id: 'paired-clear-fan', P: { LEAD: 1, FAN: 0, START: 32 } },
    treeSettings(rules)).join(' '), /no safe clearing interval/);
});

test('A and B streams switch both selectors before DAT, including at a wrapped copy', () => {
  const rules = 'tinylp', HOP = 380, positions = [416];
  const build = P => buildTree({ id: 'paired-clear-stream', P: { HOP, ...P } }, { rules, verification: 'full' });
  for (const FIELD of [0, 1]) {
    const control = build({ FIELD, STREAM: 0 }), stream = build({ FIELD }), compact = build({ FIELD, COMPACT: 1 });
    assert.deepEqual([control.total, stream.total, compact.total], [24, 24, 21]);
    assert.deepEqual(stream.w.instructions.flatMap((ins, i) =>
      JSON.stringify(ins) === JSON.stringify(control.w.instructions[i]) ? [] : [i]),
    ['stream', 'cycle'].map(name => label(stream, name)));

    for (const built of [control, stream, compact]) {
      const { observation, vm } = observeTree(built, { positions, cycles: 850 });
      const { phases } = observation.blocks[0];
      for (const [name, offset] of [['home', 0], ['remote', HOP]]) {
        const change = phases[`${name}-selector`], firstDat = phases[`${name}-first-dat`];
        const writer = label(built, built.root.P.STREAM ? 'cycle' : 'selectDat');
        assert.equal(change.writer, vm.norm(positions[0] + offset + writer));
        assert.equal(firstDat.target, vm.norm(positions[0] + offset + 34));
        assert.ok(change.cycle < firstDat.cycle);
      }
    }
    assert.throws(() => gate(changeInstruction(compact, 'cycle', { bMode: '$' })), /expected selector path/);
  }
  assert.throws(() => build({ STREAM: 0, COMPACT: 1 }), /COMPACT needs the decrement stream/);
});
