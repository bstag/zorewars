import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VM, compile, DEFAULT_SETTINGS, postMortem, mulberry32 } from '../src/engine/index.js';
import { encodeLiveVM, applyLiveVM, liveLayout } from '../src/engine/gpu/live-layout.js';
import { createGpuLiveEngine } from '../src/engine/gpu/live.js';
import { createLiveController } from '../src/engine/live.js';
import { GpuBackendError } from '../src/engine/gpu/errors.js';
import { randomGenome, toWarrior } from '../tools/genes.js';

const cfg = { ...DEFAULT_SETTINGS, coreSize: 80, maxCycles: 700, maxLength: 5, minDistance: 5, maxProcesses: 8, pSpaceSize: 7 };
function makeVM(settings = cfg, count = 2, programs) {
  const code = programs ?? ['MOV.I 0, 1', 'SPL 0\nMOV.I 2, >1\nDJN -1, #13\nDAT 0, 0', 'LDP #0, 3\nSTP.AB #9, #1\nJMP -2\nDAT 0, 0', 'ADD.AB #4, 3\nMOV.I 2, @2\nJMP -2\nDAT 0, 0'];
  const ws = code.slice(0, count).map((source) => {
    if (typeof source !== 'string') return source;
    const w = compile(source, 'redcode', settings); assert.ok(w.ok, JSON.stringify(w.errors)); return w;
  });
  const vm = new VM(settings); vm.enableEvents(); vm.load(ws, { seed: 4242, firstTurn: count - 1 }); return vm;
}
function state(vm) {
  return {
    core: Object.fromEntries(['op', 'mod', 'aMode', 'bMode', 'a', 'b', 'owner', 'lastWrite', 'lastExec', 'writerPc', 'writeCycle'].map((key) => [key, [...vm[key]]])),
    steps: vm.steps, cycle: vm.cycle, turn: vm.turn, budget: vm.budget, done: vm.done, winner: vm.winner,
    aliveCount: vm.aliveCount, curH: vm.curH, curPc: vm.curPc, contacts: vm.contacts, events: vm.events,
    contactSeen: [...vm.contactSeen].sort(),
    warriors: vm.warriors.map((w) => ({ ...w, pspace: [...w.pspace], queue: { head: w.queue.head, size: w.queue.size,
      h: w.queue.h, lastH: w.queue.lastH, buf: [...w.queue.buf], heads: [...w.queue.heads] } })),
  };
}

test('live snapshot codec retains core, FIFO state, P-space and complete forensic records', () => {
  for (const count of [1, 2, 3, 4]) {
    const original = makeVM(cfg, count), copy = makeVM(cfg, count);
    original.run(400);
    copy.events = [...original.events];
    applyLiveVM(copy, encodeLiveVM(original), liveLayout(original));
    assert.deepEqual(state(copy), state(original));
    assert.deepEqual(postMortem(copy), postMortem(original));
  }
});

test('live CPU fallback and cancellation preserve the authoritative visible state', async () => {
  const vm = makeVM(), reference = makeVM();
  const controller = createLiveController(vm, { createGpu: async () => { throw new Error('no GPU'); } });
  try {
    await controller.ready;
    assert.equal(controller.backend, 'cpu');
    assert.match(controller.fallbackReason, /no GPU/);
    await controller.advance(13); reference.run(13); assert.deepEqual(state(vm), state(reference));
    assert.equal(await controller.advance(9, { cancelled: () => true }), 0);
    assert.deepEqual(state(vm), state(reference));
    controller.close(); assert.equal(await controller.advance(100), 0);
  } finally { controller.close(); }
});

test('late GPU initialization cannot resurrect a replaced live round', async () => {
  let release, closed = 0;
  const controller = createLiveController(makeVM(), { createGpu: () => new Promise((r) => { release = r; }) });
  await Promise.resolve(); controller.close(); release({ close() { closed++; } }); await controller.ready;
  assert.equal(closed, 1); assert.equal(await controller.advance(1), 0);
});

test('stalled GPU initialization falls back and closes a session that arrives after timeout', async () => {
  let release, closed = 0;
  const vm = makeVM(), expected = makeVM();
  const controller = createLiveController(vm, { timeoutMs: 5, createGpu: () => new Promise((resolve) => { release = resolve; }) });
  try {
    await controller.advance(7); expected.run(7);
    assert.equal(controller.backend, 'cpu'); assert.match(controller.fallbackReason, /timed out/);
    release({ close() { closed++; } }); await Promise.resolve(); await Promise.resolve();
    assert.equal(closed, 1); assert.deepEqual(state(vm), state(expected));
  } finally { controller.close(); }
});

test('a stalled GPU advance closes its session before CPU recovery', async () => {
  let closed = false;
  const vm = makeVM(), expected = makeVM();
  const controller = createLiveController(vm, { timeoutMs: 5, createGpu: async () => ({
    advance: () => new Promise(() => {}), close() { closed = true; },
  }) });
  try {
    await controller.advance(11); expected.run(11);
    assert.equal(closed, true); assert.equal(controller.backend, 'cpu'); assert.deepEqual(state(vm), state(expected));
  } finally { controller.close(); }
});

test('persistent live GPU exactly matches CPU at instruction boundaries', { skip: process.env.ZOREWARS_GPU_TEST !== '1' }, async (t) => {
  const { create } = await import('webgpu');
  const engine = await createGpuLiveEngine({ gpu: create([]) });
  const check = async (settings, count, programs) => {
    const actual = makeVM(settings, count, programs), expected = makeVM(settings, count, programs);
    const session = await engine.createSession(actual);
    try {
      for (const n of [1, 1, 3, 17, 128, 1024, 4096]) {
        const ran = await session.advance(n); assert.equal(ran, expected.run(n));
        assert.deepEqual(state(actual), state(expected), `${settings.topology ?? 'ring'} ${count} warriors at ${actual.steps}`);
        assert.deepEqual(actual.takeEvents(), expected.takeEvents());
      }
      assert.deepEqual(postMortem(actual), postMortem(expected));
    } finally { session.close(); }
  };
  try {
    await t.test('1–4 warriors on rings, planes and volumes, including deaths and budget rescaling', async () => {
      for (const shape of [{}, { topology: 'torus', sizeX: 10, sizeY: 8, sizeZ: 1 }, { topology: 'torus', sizeX: 10, sizeY: 4, sizeZ: 2 }]) {
        for (const count of [1, 2, 3, 4]) await check({ ...cfg, ...shape }, count);
      }
    });
    await t.test('self-modification, addressing side effects, headings and P-space', async () => {
      const random = mulberry32(77);
      for (const shape of [{}, { topology: 'torus', sizeX: 10, sizeY: 4, sizeZ: 2 }]) {
        const settings = { ...cfg, ...shape };
        for (let i = 0; i < 24; i++) {
          const g = randomGenome(5, { coreSize: 80, random });
          if (shape.topology) g.code[i % 5].op = 'TRN';
          await check(settings, 2, [toWarrior(g, 'random', 80), compile('SPL 0\nMOV.I -1, >1\nJMP -1', 'redcode', settings)]);
        }
      }
    });
    await t.test('real volume warriors preserve inspector histories and animation events', async () => {
      const settings = { ...DEFAULT_SETTINGS, topology: 'torus', sizeX: 80, sizeY: 10, sizeZ: 10, maxCycles: 1500, minDistance: 5 };
      const ws = ['backdraft.js', 'volumesilk.js', 'volumequeen.js', 'adapter.js'].map((file) => {
        const w = compile(fs.readFileSync(new URL(`../warriors/volume/${file}`, import.meta.url), 'utf8'), 'javascript', settings);
        assert.ok(w.ok); return w;
      });
      await check(settings, 4, ws);
    });
    await t.test('GPU can continue a CPU replay checkpoint under ICWS 88 rules', async () => {
      const settings = { ...cfg, dialect: '88', pSpace: false };
      const programs = ['MOV 0, 1', 'ADD #4, 3\nMOV 2, @2\nJMP -2\nDAT #0, #0'];
      const actual = makeVM(settings, 2, programs), expected = makeVM(settings, 2, programs);
      actual.run(233); expected.run(233);
      const session = await engine.createSession(actual);
      try { await session.advance(101); expected.run(101); assert.deepEqual(state(actual), state(expected)); }
      finally { session.close(); }
    });
    await t.test('P-space result cells and learned values survive into the next GPU round', async () => {
      const aPS = [VM.freshPSpace(cfg), VM.freshPSpace(cfg)], bPS = [VM.freshPSpace(cfg), VM.freshPSpace(cfg)];
      for (let r = 0; r < 3; r++) {
        const actual = makeVM(), expected = makeVM();
        const ws = ['LDP #0, 3\nSTP.AB #9, #1\nJMP -2\nDAT 0, 0', 'MOV.I 0, 1'].map((s) => compile(s, 'redcode', cfg));
        actual.load(ws, { seed: 27 + r, firstTurn: r % 2, pspaces: aPS });
        expected.load(ws, { seed: 27 + r, firstTurn: r % 2, pspaces: bPS });
        const session = await engine.createSession(actual);
        try { while (!actual.done) await session.advance(4096); expected.run(); actual.recordResults(); expected.recordResults(); assert.deepEqual(state(actual), state(expected)); }
        finally { session.close(); }
      }
    });
    await t.test('bounded event buffers report overflow and retain the same visible prefix as CPU', async () => {
      const actual = makeVM(cfg, 2, ['MOV.I 0, 1', 'MOV.I 0, 1']), expected = makeVM(cfg, 2, ['MOV.I 0, 1', 'MOV.I 0, 1']);
      actual.enableEvents(1); expected.enableEvents(1);
      const session = await engine.createSession(actual);
      try { await session.advance(1000); expected.run(1000); assert.deepEqual(state(actual), state(expected)); assert.ok(actual.eventsDropped > 0); }
      finally { session.close(); }
    });
    await t.test('device failure resumes on CPU from the last confirmed GPU snapshot', async () => {
      const actual = makeVM(), expected = makeVM(); let calls = 0;
      const session = await engine.createSession(actual);
      const controller = createLiveController(actual, { createGpu: async () => ({
        get lastStep() { return session.lastStep; }, close() { session.close(); },
        advance(n) { if (++calls === 2) throw new GpuBackendError('device lost for test'); return session.advance(n); },
      }) });
      try {
        await controller.advance(31); expected.run(31); assert.deepEqual(state(actual), state(expected));
        await controller.advance(73); expected.run(73); assert.equal(controller.backend, 'cpu'); assert.deepEqual(state(actual), state(expected));
      } finally { controller.close(); }
    });
    await t.test('closing an in-flight GPU advance cannot mutate the replaced VM or its P-space', async () => {
      const actual = makeVM(), initial = state(actual);
      const session = await engine.createSession(actual);
      const controller = createLiveController(actual, { createGpu: async () => session });
      await controller.ready;
      const pending = controller.advance(4096);
      await Promise.resolve(); await Promise.resolve(); controller.close();
      await pending;
      assert.deepEqual(state(actual), initial);
    });
  } finally { engine.close(); }
});
