import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { compile, DEFAULT_SETTINGS, MODIFIERS, MODES, OPCODES, VM, runMatch } from '../src/engine/index.js';
import { createRound, createTraceRound } from '../src/engine/battle.js';
import { mulberry32 } from '../src/engine/random.js';
import { createRingDuel } from '../src/engine/ring-duel.js';
import { createPackedKernel, createWasmRingKernel, ringDuelWasmURL } from '../src/engine/ring-duel-wasm.js';
import { createBrowserLiveController } from '../web/live.js';
import { prepareReplay } from '../web/replay.js';
import { recordArenaReplay } from '../web/recorded-replay.js';
import { createLiveController } from '../src/engine/live.js';
import { GpuBackendError } from '../src/engine/gpu/errors.js';
import { applyLiveVM, encodeLiveVM } from '../src/engine/gpu/live-layout.js';
import { createNativeRingKernel, nativeAddonURL } from '../tools/ring-duel-native.js';

const createKernel = createWasmRingKernel(new WebAssembly.Module(readFileSync(ringDuelWasmURL)));

test('native Rust executes ring and torus matches with the same reports and traces', {
  skip: !existsSync(nativeAddonURL) && 'Run npm run build:native to test the Node addon',
}, () => {
  const native = createNativeRingKernel();
  const cases = [
    [{}, ['STP.AB #7, #1\nMOV.I 0, >9\nJMP -2', 'SPL 0\nJMP -1', 'DAT 0,0']],
    [{ topology: 'torus', sizeX: 30, sizeY: 19, sizeZ: 4, coreSize: 2280 },
      ['TRN [0,1,1]', 'SPL [0,1,1]\nMOV.I {0, >0\nJMP -2']],
  ];
  for (const [geometry, sources] of cases) {
    const settings = { ...ring, ...geometry, maxCycles: 20, rounds: 3, pSpace: true };
    const warriors = sources.map(source => compile(source, 'redcode', settings));
    for (const options of [{ executionHistory: false }, { report: true, traceRound: 2, traceSize: 13 }]) {
      assert.deepEqual(runMatch(warriors, settings, { ...options, createRingKernel: native }),
        runMatch(warriors, settings, options));
    }
  }
});

const ring = { ...DEFAULT_SETTINGS, coreSize: 31, minDistance: 8, maxLength: 8, maxCycles: 5, maxProcesses: 4, pSpace: false };

function packedCore(vm) {
  const cells = new Uint16Array(vm.size * 3);
  for (let i = 0; i < vm.size; i++) {
    cells[3 * i] = vm.op[i] | (vm.mod[i] << 5) | (vm.aMode[i] << 8) | (vm.bMode[i] << 11);
    cells[3 * i + 1] = vm.a[i];
    cells[3 * i + 2] = vm.b[i];
  }
  return cells;
}

test('score-only ring rounds match core, queues and results across opcodes, modifiers and addressing modes', () => {
  const random = mulberry32(4242);
  const field = () => Math.floor(random() * 15) - 7;
  const ops = OPCODES.slice(0, OPCODES.indexOf('TRN'));
  const jump = { op: 'JMP', mod: 'B', aMode: '$', bMode: '$', a: 0, b: 0 };
  let scenario = 0;
  for (const op of ops) for (const mod of MODIFIERS) {
    for (const aMode of MODES) for (const bMode of MODES) {
      const label = `${op}.${mod} ${aMode}, ${bMode}`;
      const pSpace = op === 'LDP' || op === 'STP';
      const settings = { ...ring, pSpace, maxProcesses: [1, 4, 8][scenario % 3] };
      const firstTurn = scenario++ % 2;
      const positions = [scenario % ring.coreSize, (scenario + 8) % ring.coreSize];
      const instructions = [{ op, mod, aMode, bMode, a: field(), b: field() }];
      const opCount = pSpace ? ops.length : ops.indexOf('LDP');
      for (let i = 0; i < 5; i++) {
        instructions.push({ ...jump, op: ops[Math.floor(random() * opCount)], a: field(), b: field() });
      }
      const warriors = [{ name: 'Subject', start: 0, instructions }, { name: 'Opponent', start: 0, instructions: [jump] }];
      const reference = createRound(warriors, settings, { positions, firstTurn, executionHistory: false });
      reference.vm.run();
      const expected = reference.finish();
      for (const kernel of pSpace ? [createKernel] : [undefined, createKernel]) {
        const duel = createRingDuel(settings, warriors, kernel);
        assert.ok(duel, label);
        assert.deepEqual(duel.round(positions, firstTurn), expected, label);
        assert.deepEqual(duel.core, packedCore(reference.vm), label);
        assert.deepEqual([duel.processes(0), duel.processes(1)], reference.vm.warriors.map(w => [...w.queue]), label);
      }
    }
  }
});

test('history-off matches preserve P-space behavior for warriors assembled with P-space', () => {
  const settings = { ...ring, rounds: 3 };
  const warrior = compile('STP.AB #1, #1\nLDP.AB #1, marker\nJMZ.B dead, marker\nJMP 0\ndead DAT 0, 0\nmarker DAT 0, 0', 'redcode', { ...settings, pSpace: true });
  const opponent = compile('JMP 0', 'redcode', settings);
  assert.ok(warrior.ok && opponent.ok);
  const warriors = [warrior, opponent];
  assert.equal(createRingDuel(settings, warriors), null);
  const baseline = runMatch(warriors, settings, { seed: 42 });
  assert.equal(baseline.warriors[0].ties, settings.rounds);
  assert.deepEqual(runMatch(warriors, settings, { seed: 42, executionHistory: false }), baseline);
  for (const kernel of [createKernel, ...(existsSync(nativeAddonURL) ? [createNativeRingKernel()] : [])]) {
    assert.deepEqual(runMatch(warriors, settings, { seed: 42, executionHistory: false, createRingKernel: kernel }), baseline);
  }
});

test('Rust replays prior results for preassembled P-space code and treats ring TRN as a no-op', () => {
  const settings = { ...ring, rounds: 4, maxCycles: 9 };
  const adaptive = compile('LDP.AB #0, #0\nJMZ.B 2, -1\nDAT 0, 0\nJMP 0', 'redcode', { ...settings, pSpace: true });
  const turned = compile('TRN [0,1]\nJMP -1', 'redcode', {
    ...settings, topology: 'torus', sizeX: 7, sizeY: 3, coreSize: 21,
  });
  assert.ok(adaptive.ok && turned.ok);
  const warriors = [adaptive, turned];
  const options = { seed: 42, round: 4, traceSize: 6 };
  const expected = runMatch(warriors, settings, { ...options, report: 4, traceRound: 4 }).rounds[3];
  assert.equal(expected.winner, null);
  for (const kernel of [undefined, createKernel, ...(existsSync(nativeAddonURL) ? [createNativeRingKernel()] : [])]) {
    const replay = createTraceRound(warriors, settings, { ...options, createRingKernel: kernel });
    replay.vm.run();
    assert.deepEqual({ round: 4, ...replay.finish() }, expected);
  }
});

test('Wasm preserves private P-space across rounds and resets it for each match', () => {
  const settings = { ...ring, pSpace: true, pSpaceSize: 3, rounds: 5, maxCycles: 15 };
  const warrior = compile(`
    LDP.AB #0, result
    LDP.AB #1, count
    ADD.AB #1, count
    STP.B count, #4
    SNE.AB #2, count
    DAT 0, 0
    SNE.AB #0, result
    DAT 0, 0
    JMP 0
    result DAT 0, 0
    count DAT 0, 0
  `, 'redcode', { ...settings, maxLength: 12 });
  const opponent = compile('STP.AB #9, #1\nJMP 0', 'redcode', settings);
  assert.ok(warrior.ok && opponent.ok);
  const warriors = [warrior, opponent];
  const cfg = { ...settings, maxLength: 12, minDistance: 12 };
  const expected = runMatch(warriors, cfg, { seed: 42 });
  assert.deepEqual(expected.rounds.map(r => r.winner), [null, 1, 1, 1, 1]);
  for (let match = 0; match < 2; match++) {
    assert.deepEqual(runMatch(warriors, cfg, { seed: 42, executionHistory: false, createRingKernel: createKernel }), expected);
  }
});

test('Wasm handles the full unsigned field range and wrapped loads across rounds', () => {
  const settings = { ...ring, coreSize: 65536 };
  const warriors = [
    compile('MUL.AB #65535, product\nJMP 0\nproduct DAT 0, 65535', 'redcode', settings),
    compile('JMP 0', 'redcode', settings),
  ];
  assert.ok(warriors.every(w => w.ok));
  const duel = createRingDuel(settings, warriors, createKernel);
  for (const [firstTurn, positions] of [[0, [65535, 20]], [1, [10, 0]]]) {
    const reference = createRound(warriors, settings, { positions, firstTurn, executionHistory: false });
    reference.vm.run();
    assert.deepEqual(duel.round(positions, firstTurn), reference.finish());
    assert.deepEqual(duel.core, packedCore(reference.vm));
  }
});

test('Rust uses wide cells for large rings and preserves single-cell ring behavior', () => {
  const kernels = [createKernel];
  if (existsSync(nativeAddonURL)) kernels.push(createNativeRingKernel());
  for (const coreSize of [1, 100003]) {
    const settings = { ...ring, coreSize, maxCycles: 6 };
    const source = coreSize === 1 ? 'JMP 0' : 'MUL.AB #100001, 2\nMOV.I 0, @1\nDAT 0, 100002';
    const warrior = compile(source, 'redcode', settings);
    const options = { positions: [coreSize - 1], traceSize: 6, report: true };
    const reference = createRound([warrior], settings, options);
    reference.vm.run();
    const expected = reference.finish();
    for (const kernel of kernels) {
      const wasm = createRound([warrior], settings, { ...options, createRingKernel: kernel });
      wasm.vm.run();
      assert.deepEqual(wasm.finish(), expected);
      assert.deepEqual(wasm.vm.b, reference.vm.b);
      const duel = createRingDuel(settings, [warrior], kernel);
      const { trace, report, ...outcome } = expected;
      assert.deepEqual(duel.round(options.positions, 0), outcome);
    }
  }
});

test('Rust preserves large budgets through eliminations and wraps signed ring placements', () => {
  const settings = { ...ring, maxCycles: 2 ** 40, maxProcesses: 1 };
  const warriors = ['DAT 0, 0', 'JMP 0', 'DAT 0, 0'].map(source => compile(source, 'redcode', settings));
  const kernels = [createKernel];
  if (existsSync(nativeAddonURL)) kernels.push(createNativeRingKernel());
  for (const kernel of kernels) {
    for (const count of [2, 3]) {
      const roster = warriors.slice(0, count);
      const positions = [-2, 3 * settings.coreSize + 5, -10].slice(0, count);
      const reference = createRound(roster, settings, { positions, firstTurn: 0 });
      const duel = createRingDuel(settings, roster, kernel);
      const active = duel.startRound(positions, 0);
      assert.equal(active.budget, reference.vm.budget);
      while (!reference.vm.done) {
        assert.deepEqual(active.step(), reference.vm.step());
        assert.equal(active.budget, reference.vm.budget);
      }
      assert.deepEqual(active.finish(), reference.finish());
      assert.deepEqual(duel.round(positions, 0), reference.finish());
    }
    const roster = warriors.slice(0, 2);
    const options = { positions: [0, 10], firstTurn: 1, traceSize: 4, report: true };
    const js = createRound(roster, settings, options);
    const rust = createRound(roster, settings, options);
    for (const { vm } of [js, rust]) {
      vm.cycle = 2 ** 32 - 1;
      vm.steps = 2 ** 33 - 1;
      vm.budget = 2 ** 41 - 1;
    }
    assert.ok(createRingDuel(settings, roster, kernel, { history: true }).attachHistory(rust.vm));
    assert.equal(rust.vm.run(), js.vm.run());
    assert.deepEqual(rust.finish(), js.finish());
  }
});

test('Rust runs a torus above the arena size ceiling through both packed and history paths', () => {
  const settings = { ...ring, topology: 'torus', coreSize: 113 * 108 * 17, sizeX: 113, sizeY: 108, sizeZ: 17 };
  const warriors = ['TRN [0,0,-1]', 'MOV.I 0, 1'].map(source => compile(source, 'redcode', settings));
  const kernels = [createKernel];
  if (existsSync(nativeAddonURL)) kernels.push(createNativeRingKernel());
  for (const kernel of kernels) {
    for (const options of [{ executionHistory: false }, { report: true }]) {
      assert.deepEqual(runMatch(warriors, settings, { ...options, createRingKernel: kernel }), runMatch(warriors, settings, options));
    }
    const positions = [-settings.coreSize - 5, 2 * settings.coreSize + settings.sizeX * 2];
    const reference = createRound(warriors, settings, { positions, firstTurn: 1 });
    reference.vm.run();
    assert.deepEqual(createRingDuel(settings, warriors, kernel).round(positions, 1), reference.finish());
  }
});

test('short Rust rounds allocate only reachable queue slots and P-space cells', () => {
  const settings = { ...ring, maxProcesses: 0x40000000, maxCycles: 6, pSpaceSize: 0x40000000, pSpace: true };
  const warriors = [
    'LDP.AB #25, 4\nADD.AB #1, 3\nSTP.B 2, #25\nSPL -3\nDAT 0,0',
    'JMP 0',
  ].map(source => compile(source, 'redcode', settings));
  assert.ok(warriors.every(w => w.ok));
  const kernels = [createKernel];
  if (existsSync(nativeAddonURL)) kernels.push(createNativeRingKernel());
  for (const kernel of kernels) {
    const duel = createRingDuel(settings, warriors, (cfg, options) => {
      assert.equal(cfg.maxProcesses, 13);
      assert.equal(options.pspaceSize, settings.coreSize);
      return kernel(cfg, options);
    });
    const referenceSettings = { ...settings, maxProcesses: 13, pSpaceSize: 40 };
    const pspaces = warriors.map(() => VM.freshPSpace(referenceSettings));
    for (let firstTurn = 0; firstTurn < 2; firstTurn++) {
      const positions = [0, 12];
      const reference = createRound(warriors, referenceSettings, { positions, firstTurn, pspaces });
      reference.vm.run();
      assert.deepEqual(duel.round(positions, firstTurn), reference.finish());
      assert.deepEqual(duel.core, packedCore(reference.vm));
      assert.deepEqual(warriors.map((_, i) => duel.processes(i)), reference.vm.warriors.map(w => [...w.queue]));
    }
  }
});

test('packed kernel allocation follows the runtime address limit and handles allocation failure', () => {
  const settings = { ...ring, coreSize: 200000000 };
  const options = { count: 1 };
  let requested = 0;
  const makeKernel = maxBytes => createPackedKernel(() => ({
    start: 0, maxBytes,
    allocate(bytes) {
      requested = bytes;
      throw new RangeError('Unable to allocate a packed buffer');
    },
  }));
  assert.equal(makeKernel(0x80000000)(settings, options), null);
  assert.equal(requested, 0);
  assert.equal(makeKernel(0x100000000)(settings, options), null);
  assert.ok(requested > 0x80000000 && requested < 0x100000000);
});

test('live Rust compacts a wrapped FIFO and leaves unreachable P-space entries alone', () => {
  const settings = { ...ring, maxCycles: 5, maxProcesses: 64, pSpace: true, pSpaceSize: 128 };
  const warrior = compile('STP.AB #7, #3\nSPL -1\nJMP -2', 'redcode', settings);
  const options = { positions: [0], report: true, traceSize: 5 };
  const js = createRound([warrior], settings, options);
  const rust = createRound([warrior], settings, options);
  for (const { vm } of [js, rust]) {
    vm.run(1);
    const { queue, pspace } = vm.warriors[0];
    queue.buf[63] = queue.buf[queue.head];
    queue.head = 63;
    pspace[100] = 9999;
  }
  const duel = createRingDuel(settings, [warrior], createKernel, { history: true });
  assert.ok(duel.attachHistory(rust.vm));
  assert.equal(rust.vm.run(), js.vm.run());
  assert.deepEqual(rust.finish(), js.finish());
  assert.deepEqual(rust.vm.warriors[0].pspace, js.vm.warriors[0].pspace);
  assert.equal(rust.vm.warriors[0].pspace[100], 9999);
});

test('Rust preserves the raw P-space survivor count when it equals the core size', () => {
  const kernels = [createKernel];
  if (existsSync(nativeAddonURL)) kernels.push(createNativeRingKernel());
  for (const [coreSize, topology] of [[1, 'ring'], [2, 'ring'], [2, 'torus']]) {
    const settings = { ...ring, coreSize, topology, sizeX: coreSize, sizeY: 1,
      maxLength: 1, minDistance: 1, maxCycles: 6, pSpace: true, pSpaceSize: 1 };
    const warriors = Array.from({ length: coreSize }, () => compile('LDP.AB #0, 0', 'redcode', settings));
    const positions = warriors.map((_, i) => i);
    assert.ok(warriors.every(w => w.ok));
    for (const kernel of kernels) {
      const duel = createRingDuel(settings, warriors, kernel);
      const pspaces = warriors.map(() => VM.freshPSpace(settings));
      for (let round = 0; round < 3; round++) {
        const options = { positions, firstTurn: round % coreSize, traceSize: 6, report: true };
        const js = createRound(warriors, settings, { ...options, pspaces });
        const rust = createRound(warriors, settings, {
          ...options, pspaces: pspaces.map(ps => ps.slice()), createRingKernel: kernel,
        });
        js.vm.run();
        rust.vm.run();
        assert.deepEqual(rust.vm.b, js.vm.b);
        const { trace, report, ...outcome } = js.finish();
        assert.deepEqual(rust.finish(), { ...outcome, trace, report });
        assert.deepEqual(duel.round(positions, options.firstTurn), outcome);
        assert.deepEqual(Array.from(duel.core).filter((_, i) => i % 3 === 2), [...js.vm.b]);
        if (round > 0) assert.equal(js.vm.b[0], coreSize);
      }
      const options = { positions, pspaces: pspaces.map(ps => ps.slice()) };
      const js = createRound(warriors, settings, options);
      const rust = createRound(warriors, settings, {
        ...options, pspaces: pspaces.map(ps => ps.slice()), createRingKernel: kernel,
      });
      for (const vm of [js.vm, rust.vm]) {
        vm.step(); // LDP puts the raw survivor count in the executing cell.
        vm.op[0] = OPCODES.indexOf('ADD');
        vm.aMode[0] = MODES.indexOf('>');
      }
      // Retake the Rust snapshot from the edited state before exercising
      // the pointer and arithmetic with the non-normalized field.
      const edited = createRingDuel(settings, warriors, kernel, { history: true });
      assert.ok(edited.attachHistory(rust.vm));
      while (!js.vm.done) assert.deepEqual(rust.vm.step(), js.vm.step());
      assert.deepEqual(rust.vm.b, js.vm.b);
    }
  }
});

test('Rust preserves P-space when warriors outnumber core cells', () => {
  const settings = { ...ring, coreSize: 1, pSpace: true, pSpaceSize: 1, maxCycles: 5 };
  const warriors = Array.from({ length: 4 }, () => compile('LDP.AB #0, 0', 'redcode', settings));
  const positions = [0, 0, 0, 0];
  const kernels = [createKernel];
  if (existsSync(nativeAddonURL)) kernels.push(createNativeRingKernel());
  for (const kernel of kernels) {
    const duel = createRingDuel(settings, warriors, kernel);
    const pspaces = warriors.map(() => VM.freshPSpace(settings));
    for (let firstTurn = 0; firstTurn < 4; firstTurn++) {
      const js = createRound(warriors, settings, { positions, firstTurn, pspaces });
      const rust = createRound(warriors, settings, {
        positions, firstTurn, pspaces: pspaces.map(ps => ps.slice()), createRingKernel: kernel,
      });
      assert.equal(rust.vm.run(), js.vm.run());
      assert.deepEqual(rust.vm.b, js.vm.b);
      assert.deepEqual(rust.finish(), js.finish());
      assert.deepEqual(duel.round(positions, firstTurn), js.finish());
      if (firstTurn) assert.equal(duel.core[2], 4);
    }
  }
});

test('packed Rust diagnosis survives slices on wide cores and very large budgets', () => {
  const kernels = [createKernel];
  if (existsSync(nativeAddonURL)) kernels.push(createNativeRingKernel());
  const scenarios = [
    { ...ring, coreSize: 8000, maxCycles: 2 ** 40 },
    { ...ring, coreSize: 70001 },
    { ...ring, topology: 'torus', sizeX: 80, sizeY: 5, sizeZ: 3, coreSize: 1200 },
  ];
  for (const kernel of kernels) {
    for (const base of scenarios) {
      const settings = { ...base, maxCycles: Math.max(140, base.maxCycles) };
      const warriors = [
        'JMP 0',
        'MOV.I bomb, -19\nMOV.I loop, -21\nDJN.B 0, #120\nMOV.A #0, -22\nJMP 0\nloop JMN.A 0, 1\nbomb DAT 1,0',
      ].map(source => compile(source, 'redcode', settings));
      assert.ok(warriors.every(w => w.ok));
      const positions = [0, 20];
      const reference = createRound(warriors, settings, { positions, report: true });
      reference.vm.run();
      const { report, ...expected } = reference.finish();
      assert.equal(report.warriors[0].lastDeath.cause, 'enemyCode');
      assert.ok(report.warriors[0].foreignSteps > 100);
      const duel = createRingDuel(settings, warriors, kernel, { diagnose: true });
      const active = duel.startRound(positions, 0);
      while (!active.done) active.run(11);
      assert.deepEqual(active.finish(), { ...expected, diagnostic: 'converted' });
      assert.deepEqual(duel.round(positions, 0), { ...expected, diagnostic: 'converted' });
    }
  }
});

test('torus DIV and MOD treat a raw P-space survivor count as a zero vector', () => {
  const settings = { ...ring, coreSize: 2, topology: 'torus', sizeX: 2,
    minDistance: 1, maxLength: 1, maxCycles: 6, pSpace: true, pSpaceSize: 1 };
  const warriors = ['LDP.AB #0, 0', 'NOP 0, 0'].map(source => compile(source, 'redcode', settings));
  const kernels = [createKernel];
  if (existsSync(nativeAddonURL)) kernels.push(createNativeRingKernel());
  for (const kernel of kernels) {
    for (const op of ['DIV', 'MOD']) {
      const options = { positions: [0, 1], traceSize: 6, report: true };
      const js = createRound(warriors, settings, options);
      const rust = createRound(warriors, settings, { ...options, createRingKernel: kernel });
      for (const { vm } of [js, rust]) {
        vm.poke(1, { op, mod: 'B', aMode: '$', a: 1, bMode: '$', b: 0 }, 1);
        vm.warriors[0].pspace[0] = 2;
        vm.step();
        assert.equal(vm.b[0], 2);
        assert.equal(vm.step().killed, true);
      }
      assert.deepEqual(rust.finish(), js.finish());
    }
  }
});

test('Wasm scores solo and multi-warrior rounds with the same cycles and survivors as the VM', () => {
  const settings = { ...DEFAULT_SETTINGS, coreSize: 97, minDistance: 10, maxLength: 10,
    maxProcesses: 4, maxCycles: 25, rounds: 12, pSpaceSize: 3 };
  const [idle, die, wait, split, adaptive] = [
    'JMP 0',
    'DAT 0, 0',
    'DJN.B 0, #6\nDAT 0, 0',
    'SPL 0\nDAT 0, 0',
    'LDP.AB #0, flag\nJMZ.B die, flag\nSTP.AB #1, #4\nJMP 0\ndie DAT 0, 0\nflag DAT 0, 0',
  ].map(source => compile(source, 'redcode', settings));
  for (const warriors of [[idle], [die], [adaptive], [idle, die, wait], [die, die, die],
    [idle, wait, split, adaptive], [die, idle, wait, split, adaptive]]) {
    const options = { seed: 42, executionHistory: false };
    assert.deepEqual(runMatch(warriors, settings, { ...options, createRingKernel: createKernel }),
      runMatch(warriors, settings, options));
  }
});

test('Wasm ring slices preserve core, queues and scheduler state between calls', () => {
  const settings = { ...ring, maxCycles: 9, pSpace: true, pSpaceSize: 3 };
  const warriors = [
    'LDP.AB #0, 2\nSTP.B 1, #4\nDJN.B 0, #5\nDAT 0, 0',
    'DJN.B 0, #3\nDAT 0, 0',
    'SPL 0\nMOV.I 0, >4\nJMP -2',
  ].map(source => compile(source, 'redcode', settings));
  for (const [count, positions] of [[1, [0]], [2, [0, 10]], [3, [0, 10, 20]]]) {
    const roster = warriors.slice(0, count);
    const duel = createRingDuel(settings, roster, createKernel);
    let oldRound;
    for (let r = 0; r < 3; r++) {
      const firstTurn = r % count;
      const pspaces = roster.map(() => VM.freshPSpace(settings));
      // Reuse the reference P-space from the preceding round.
      if (oldRound) oldRound.reference.vm.warriors.forEach((w, i) => pspaces[i].set(w.pspace));
      const reference = createRound(roster, settings, { positions, firstTurn, pspaces, executionHistory: false });
      const active = duel.startRound(positions, firstTurn);
      if (oldRound) assert.throws(() => oldRound.active.run(1), /replaced/);
      assert.throws(() => active.finish(), /still running/);
      assert.equal(active.run(0), 0);
      let slice = 0;
      while (!reference.vm.done) {
        const limit = [1, 3, 2][slice++ % 3];
        if (limit === 1) assert.deepEqual(active.step(), reference.vm.step());
        else assert.equal(active.run(limit), reference.vm.run(limit));
        for (const key of ['cycle', 'turn', 'budget', 'aliveCount', 'done', 'steps']) assert.equal(active[key], reference.vm[key], key);
        assert.deepEqual(duel.core, packedCore(reference.vm));
        assert.deepEqual(roster.map((_, i) => duel.processes(i)), reference.vm.warriors.map(w => [...w.queue]));
      }
      assert.equal(active.run(1), 0);
      assert.equal(active.step(), null);
      assert.deepEqual(active.finish(), reference.finish());
      oldRound = { active, reference };
    }
  }
});

test('Wasm ring history matches the VM for ordered writes, traces, deaths and post-mortems', () => {
  const settings = { ...ring, coreSize: 97, maxCycles: 36, maxLength: 12, rounds: 3, pSpace: true };
  const warriors = [
    'LDP.AB #0, 4\nSTP.AB #4, #2\nMOV.I >0, >19\nJMP -1\nDAT 0,0',
    'SPL 0\nDJN.B -1, <19\nDAT 0,0',
    'DIV.F #0, >-1\nDAT 0,0',
  ].map(source => compile(source, 'redcode', settings));
  for (const roster of [warriors.slice(0, 1), warriors.slice(0, 2), warriors]) {
    const positions = [0, 20, 40].slice(0, roster.length);
    for (const firstTurn of positions.keys()) {
      const options = { positions, firstTurn, traceSize: 11, report: true };
      const js = createRound(roster, settings, options);
      const wasm = createRound(roster, settings, { ...options, createRingKernel: createKernel });
      js.vm.enableEvents();
      wasm.vm.enableEvents();
      while (!js.vm.done) {
        assert.deepEqual(wasm.vm.step(), js.vm.step());
        assert.deepEqual(packedCore(wasm.vm), packedCore(js.vm));
        for (const key of ['owner', 'lastWrite', 'lastExec', 'writerPc', 'writeCycle', 'contacts', 'events', 'warriors']) {
          assert.deepEqual(wasm.vm[key], js.vm[key], key);
        }
      }
      assert.deepEqual(wasm.finish(), js.finish());
    }
    const options = { seed: 42, report: true, traceRound: 2, traceSize: 11 };
    assert.deepEqual(runMatch(roster, settings, { ...options, createRingKernel: createKernel }),
      runMatch(roster, settings, options));
  }
});

test('Rust history batches preserve exposed traces, edits, queues, and ordered events', () => {
  const kernels = [createKernel];
  if (existsSync(nativeAddonURL)) kernels.push(createNativeRingKernel());
  for (const createRingKernel of kernels) {
    for (const torus of [false, true]) {
      const settings = { ...ring, coreSize: 96, maxCycles: 180, maxProcesses: 12, pSpace: true,
        ...(torus ? { topology: 'torus', sizeX: 16, sizeY: 6 } : {}) };
      const warriors = [
        'STP.AB #7, #1\nLDP.AB #1, 4\nMOV.I >4, >4\nSPL 0\nJMP -4\nDAT 0,0\nDAT 0,0',
        torus ? 'SPL start, 0\nTRN $[0,1]\nstart JMP 0' : 'SPL 0\nJMP -1',
        'DIV.F #0, >-1\nDAT 0,0',
      ].map(source => compile(source, 'redcode', settings));
      assert.ok(warriors.every(w => w.ok), JSON.stringify(warriors.flatMap(w => w.errors)));
      const options = { positions: [0, 36, 60], firstTurn: 2, traceSize: 29, report: true };
      const js = createRound(warriors, settings, options);
      let calls = 0;
      const rust = createRound(warriors, settings, { ...options, createRingKernel: (...args) => {
        const kernel = createRingKernel(...args);
        const advance = kernel.advanceGroup;
        kernel.advanceGroup = (...args) => { calls++; return advance(...args); };
        return kernel;
      } });
      for (const { vm } of [js, rust]) vm.enableEvents();
      assert.equal(js.vm.run(137), 137);
      assert.equal(rust.vm.run(137), 137);
      assert.equal(calls, 2);
      const jsTrace = js.vm.trace;
      const rustTrace = rust.vm.trace;
      for (const { vm } of [js, rust]) vm.warriors[0].pspace[1] = 11;
      assert.deepEqual(rust.vm.step(), js.vm.step());
      assert.equal(rust.vm.run(), js.vm.run());
      assert.deepEqual(rustTrace, jsTrace);
      for (const key of ['owner', 'lastWrite', 'lastExec', 'writerPc', 'writeCycle', 'contacts', 'events', 'warriors']) {
        assert.deepEqual(rust.vm[key], js.vm[key], key);
      }
      assert.deepEqual(packedCore(rust.vm), packedCore(js.vm));
      assert.deepEqual(rust.finish(), js.finish());
    }
  }
});

test('saved Rust replay seeks into a checkpoint and finishes without a kernel', async () => {
  const settings = { ...ring, coreSize: 96, maxCycles: 9000, maxProcesses: 16, pSpace: true };
  const warriors = ['STP.AB #7, #1\nLDP.AB #1, 5\nMOV.I >5, >5\nSPL 0\nJMP -4\nDAT 0,0',
    'SPL 0\nJMP -1'].map(source => compile(source, 'redcode', settings));
  const setup = { warriors, positions: [0, 45], firstTurn: 1, pspaces: warriors.map(() => VM.freshPSpace(settings)) };
  const options = { ...setup, pspaces: setup.pspaces.map(ps => ps.slice()), report: true };
  const rust = createRound(warriors, settings, { ...options, createRingKernel: createKernel });
  // Register before attachment, as the arena does.
  const vm = new VM(settings);
  vm.enableEvents();
  vm.load(warriors, { ...setup, pspaces: setup.pspaces.map(ps => ps.slice()) });
  const recorder = recordArenaReplay(vm);
  assert.ok(createRingDuel(settings, warriors, createKernel, { history: true }).attachHistory(vm));
  vm.step();
  while (!vm.done) {
    vm.run(4096);
    recorder.checkpoint();
  }
  const recording = recorder.result();
  assert.equal(recording.length, vm.steps);
  assert.ok(recording.checkpointCount > 0);
  assert.ok(recording.bytes > 0);
  let playback, yields = 0;
  const replay = await prepareReplay(settings, setup, vm.cycle, 100, {
    recording, isCurrent: () => true, resetHighlights() {},
    loadWasmKernel: () => assert.fail('recorded playback must not start a kernel'),
    onRecordedPlayback: value => { playback = value; },
    clock: () => yields * 5 + 5, yieldFrame: async () => { yields++; },
  });
  assert.ok(playback);
  assert.equal(replay.cycle, vm.cycle - 100);
  const reference = createRound(warriors, settings, { ...options, pspaces: setup.pspaces.map(ps => ps.slice()) });
  reference.vm.run(replay.steps);
  assert.deepEqual(packedCore(replay), packedCore(reference.vm));
  assert.deepEqual(playback.advance(1), 1);
  assert.deepEqual(playback.lastStep, reference.vm.step());
  while (!replay.done) assert.ok(playback.advance(512) > 0);
  rust.vm.run();
  for (const key of ['owner', 'lastWrite', 'lastExec', 'writerPc', 'writeCycle', 'contacts', 'warriors']) {
    assert.deepEqual(replay[key], rust.vm[key], key);
  }
  assert.deepEqual(packedCore(replay), packedCore(rust.vm));
  assert.equal(replay.winner, rust.vm.winner);
  playback.close();
  assert.equal(playback.advance(1), 0);
});

test('a round with instructions executed before Wasm attachment has no saved replay', () => {
  const settings = { ...ring, maxCycles: 20 };
  const warriors = [compile('JMP 0', 'redcode', settings)];
  const vm = new VM(settings);
  vm.load(warriors, { positions: [0] });
  const recorder = recordArenaReplay(vm);
  vm.step();
  assert.ok(createRingDuel(settings, warriors, createKernel, { history: true }).attachHistory(vm));
  vm.run();
  assert.equal(recorder.result(), null);
});

test('the browser live controller can resume a populated ring VM in Wasm', async () => {
  const settings = { ...ring, pSpace: true, maxCycles: 25 };
  const warriors = ['STP.AB #7, #1\nMOV.I >1, >9\nJMP -2', 'SPL 0\nJMP -1']
    .map(source => compile(source, 'redcode', settings));
  const options = { positions: [0, 10], firstTurn: 1, report: true, traceSize: 16 };
  const js = createRound(warriors, settings, options);
  const wasm = createRound(warriors, settings, options);
  js.vm.run(5);
  wasm.vm.run(5);
  const live = createBrowserLiveController(wasm.vm, { backend: 'cpu', loadWasmKernel: async () => createKernel });
  try {
    await live.ready;
    assert.equal(live.backend, 'wasm');
    assert.equal(await live.advance(Infinity), js.vm.run());
    assert.deepEqual(wasm.finish(), js.finish());
  } finally { live.close(); }
});

test('live Wasm batches publish Rust scheduler state and preserve history and recorded replay', async () => {
  for (const geometry of [{}, { topology: 'torus', sizeX: 16, sizeY: 3, sizeZ: 2 }]) {
    const settings = { ...ring, ...geometry, coreSize: 96, maxCycles: 190, pSpace: true };
    const warriors = [
      'STP.AB #7, #1\nLDP.AB #1, 5\nMOV.I >5, >5\nSPL 0\nJMP -4\nDAT 0,0',
      'SPL 0\nJMP -1',
      'DIV.F #0, >-1',
    ].map(source => compile(source, 'redcode', settings));
    assert.ok(warriors.every(w => w.ok));
    const setup = { warriors, positions: geometry.topology ? [0, 40, 80] : [0, 36, 60],
      firstTurn: 2, pspaces: warriors.map(() => VM.freshPSpace(settings)) };
    const reference = createRound(warriors, settings, { ...setup, pspaces: setup.pspaces.map(ps => ps.slice()), report: true });
    const actual = createRound(warriors, settings, { ...setup, pspaces: setup.pspaces.map(ps => ps.slice()), report: true });
    for (const round of [reference, actual]) round.vm.enableEvents();
    const recorder = recordArenaReplay(actual.vm);
    const live = createBrowserLiveController(actual.vm, { backend: 'cpu', loadWasmKernel: async () => createKernel });
    try {
      for (const limit of [139, 1, 129, 4096]) {
        let last;
        const before = reference.vm.steps;
        while (!reference.vm.done && reference.vm.steps - before < limit) last = reference.vm.step();
        assert.equal(await live.advance(limit), reference.vm.steps - before);
        if (last) assert.deepEqual(live.lastStep, last);
        assert.deepEqual(packedCore(actual.vm), packedCore(reference.vm));
        for (const key of ['steps', 'cycle', 'turn', 'budget', 'aliveCount', 'done', 'winner', 'curPc', 'curH',
          'owner', 'lastWrite', 'lastExec', 'writerPc', 'writeCycle', 'contacts', 'events', 'warriors']) {
          assert.deepEqual(actual.vm[key], reference.vm[key], key);
        }
      }
      const recording = recorder.result();
      assert.equal(recording.length, actual.vm.steps);
      assert.deepEqual(actual.finish(), reference.finish());
    } finally { live.close(); }
  }
});

test('a live GPU readback replaces a Rust snapshot and GPU loss resumes from confirmed state', async () => {
  const settings = { ...ring, pSpace: true, maxCycles: 40, maxLength: 8 };
  const warriors = ['STP.AB #7, #1\nMOV.I 0, 6\nJMP -2', 'SPL 0\nJMP -1']
    .map(source => compile(source, 'redcode', settings));
  const options = { positions: [0, 10], report: true, traceSize: 9 };
  const reference = createRound(warriors, settings, options);
  const device = createRound(warriors, settings, options);
  const rust = createRound(warriors, settings, { ...options, createRingKernel: createKernel });
  for (const { vm } of [reference, device, rust]) vm.run(5);
  let attached = 0, submissions = 0, closed = 0;
  const controller = createLiveController(rust.vm, {
    createGpu: async () => ({
      async advance(limit) {
        if (submissions++) throw new GpuBackendError('Device lost');
        const steps = device.vm.run(limit);
        applyLiveVM(rust.vm, encodeLiveVM(device.vm));
        return steps;
      },
      close() { closed++; },
    }),
    createCpu: async () => () => {
      attached++;
      return createRingDuel(settings, warriors, createKernel, { history: true }).attachHistory(rust.vm);
    },
  });
  try {
    await controller.ready;
    assert.equal(controller.backend, 'gpu');
    assert.equal(rust.vm.execute, VM.prototype.execute);
    assert.equal(await controller.advance(0), 0);
    assert.equal(submissions, 0);
    assert.equal(await controller.advance(8), reference.vm.run(8));
    assert.equal(await controller.advance(7), reference.vm.run(7));
    assert.equal(controller.backend, 'wasm');
    assert.equal(attached, 1);
    assert.equal(closed, 1);
    assert.equal(await controller.advance(Infinity), reference.vm.run());
    assert.deepEqual(rust.finish(), reference.finish());
  } finally { controller.close(); }
});

test('a Wasm browser replay reconstructs the JS checkpoint and can continue from it', async () => {
  const settings = { ...ring, pSpace: true, maxCycles: 42 };
  const warriors = ['STP.AB #7, #1\nMOV.I 0, 6\nJMP -2', 'SPL 0\nJMP -1']
    .map(source => compile(source, 'redcode', settings));
  const setup = { warriors, positions: [0, 10], firstTurn: 1,
    pspaces: warriors.map(() => VM.freshPSpace(settings)) };
  const deps = { isCurrent: () => true, resetHighlights: () => {} };
  const js = await prepareReplay(settings, setup, 20, 5, { ...deps, loadWasmKernel: async () => null });
  const rust = await prepareReplay(settings, setup, 20, 5, { ...deps, loadWasmKernel: async () => createKernel });
  assert.notEqual(rust.execute, VM.prototype.execute);
  assert.equal(rust.cycle, 15);
  assert.deepEqual(packedCore(rust), packedCore(js));
  assert.deepEqual(rust.warriors, js.warriors);
  assert.deepEqual(rust.contacts, js.contacts);
  assert.deepEqual(rust.events, js.events);
  assert.deepEqual(rust.step(), js.step());
});

test('live Rust permits P-space edits and clearing the VM detaches the old execution state', () => {
  const settings = { ...ring, pSpace: true };
  const warrior = compile('JMP 0', 'redcode', settings);
  const options = { positions: [0], report: true };
  const js = createRound([warrior], settings, options);
  const rust = createRound([warrior], settings, { ...options, createRingKernel: createKernel });
  for (const vm of [js.vm, rust.vm]) {
    vm.poke(0, { op: 'LDP', mod: 'AB', aMode: '#', a: 0, bMode: '$', b: 0 }, 0);
    vm.step();
    assert.equal(vm.b[0], settings.coreSize - 1);
    vm.load([warrior], options);
    vm.run();
    assert.equal(vm.steps, settings.maxCycles);
  }
  assert.deepEqual(rust.finish(), js.finish());
});

test('Rust torus rounds match JavaScript with vector arithmetic, headings and wide fields', () => {
  for (const [sizeX, sizeY, sizeZ] of [[19, 6, 1], [20, 5, 7], [80, 43, 40]]) {
    const settings = { ...ring, topology: 'torus', sizeX, sizeY, sizeZ, coreSize: sizeX * sizeY * sizeZ,
      maxLength: 10, maxCycles: 18, pSpace: true };
    const z = sizeZ > 1 ? 1 : 0;
    const warriors = [
      `STP.AB #[-5,2,${z}], #2
       LDP.AB #2, value
       MUL.F factor, value
       DIV.F factor, value
       MOD.F factor, value
       MOV.I {factor, >value
       TRN [0,-1,${z}]
       value DAT [-3,2,${z}], [2,-1,${z}]
       factor DAT [0,-2,${z}], [3,0,0]`,
      'SPL 0\nADD.F >-1, <-1\nSUB.F >-2, <-1\nJMP -3',
    ].map(source => compile(source, 'redcode', settings));
    assert.ok(warriors.every(w => w.ok), JSON.stringify(warriors.flatMap(w => w.errors ?? [])));
    const positions = [settings.coreSize - 2, sizeX * 3];
    const options = { positions, firstTurn: 1, traceSize: 18, report: true };
    const js = createRound(warriors, settings, options);
    const wasm = createRound(warriors, settings, { ...options, createRingKernel: createKernel });
    const duel = createRingDuel(settings, warriors, createKernel);
    const sliced = duel.startRound(positions, options.firstTurn);
    while (!js.vm.done) {
      const step = js.vm.step();
      assert.deepEqual(wasm.vm.step(), step);
      assert.deepEqual(sliced.step(), step);
      assert.equal(wasm.vm.curH, js.vm.curH);
      assert.deepEqual(wasm.vm.warriors, js.vm.warriors);
      assert.deepEqual(wasm.vm.contacts, js.vm.contacts);
    }
    assert.deepEqual(wasm.vm.a, js.vm.a);
    assert.deepEqual(wasm.vm.b, js.vm.b);
    assert.deepEqual(wasm.vm.op, js.vm.op);
    const expected = js.finish();
    assert.deepEqual(wasm.finish(), expected);
    const { trace, report, ...outcome } = expected;
    assert.deepEqual(sliced.finish(), outcome);
  }
});

test('Rust torus SPL children inherit a changed heading through a jump', () => {
  const settings = { ...ring, topology: 'torus', sizeX: 16, sizeY: 7, sizeZ: 3,
    coreSize: 336, maxCycles: 10, pSpace: true };
  const warrior = compile('TRN [0,0,1]', 'redcode', settings);
  const options = { positions: [0], traceSize: 10, report: true };
  const js = createRound([warrior], settings, options);
  const wasm = createRound([warrior], settings, { ...options, createRingKernel: createKernel });
  const { encode } = js.vm.geo;
  for (const vm of [js.vm, wasm.vm]) {
    vm.poke(encode(0, 0, 1), { op: 'SPL', mod: 'B', aMode: '$', a: 0, bMode: '$', b: 0 }, 0);
    vm.poke(encode(0, 0, -1), { op: 'JMP', mod: 'B', aMode: '$', a: encode(0, 0, -1), bMode: '$', b: 0 }, 0);
  }
  assert.equal(wasm.vm.run(), js.vm.run());
  assert.equal(wasm.vm.warriors[0].peak, 4);
  assert.deepEqual(wasm.vm.warriors, js.vm.warriors);
  assert.deepEqual(wasm.finish(), js.finish());
});
