// Shared WebGPU compute backend. The host supplies a browser or native GPU.
// `match` and `close` are the same interface as the CPU worker pool; calls
// arriving together are collected into a single GPU batch.
import { DEFAULT_SETTINGS, pSpaceSizeFor, OP, MOD, MODES } from '../constants.js';
import { topologyFor } from '../topology.js';
import { makeGeometry } from '../geometry.js';
import { matchPlan, summarizeMatch } from '../match.js';
import { gpuKernel } from './kernel.js';
import { soloKernel } from './solo-kernel.js';
import { speciesFromStats } from '../species.js';
import { GpuBackendError } from './errors.js';

const CHUNK_STEPS = 2048;
const DISPATCHES = 8;
// WebGPU buffer flags, kept local rather than changing Node's globals.
const COPY_SRC = 4, COPY_DST = 8, MAP_READ = 1, STORAGE = 128;

function config(settings, solo = false) {
  const s = { ...DEFAULT_SETTINGS, ...settings, ...(solo ? { rounds: 1 } : {}) };
  s.pSpaceSize = pSpaceSizeFor(s);
  for (const key of ['coreSize', 'maxCycles', 'maxProcesses', 'maxLength', 'rounds', 'pSpaceSize']) {
    if (!Number.isSafeInteger(s[key]) || s[key] < (solo && key === 'maxCycles' ? 0 : 1)) throw new Error(`GPU: ${key} must be a positive integer`);
  }
  if (s.coreSize > 200000 || s.maxCycles > 10000000 || s.maxProcesses > 200000 || s.pSpaceSize > 200000) {
    throw new GpuBackendError('GPU: supports cores, queues and P-space up to 200000 cells and up to 10000000 cycles');
  }
  topologyFor(s); // Validate the same geometry used by CPU placement.
  return s;
}

// Only execution settings affect the shader; round counts can vary per match.
const shaderKey = (s) => JSON.stringify([s.coreSize, s.maxCycles, s.maxProcesses, s.pSpaceSize, s.topology ?? 'ring', s.sizeX, s.sizeY, s.sizeZ]);

function appendWarrior(input, desc, w, s, geo) {
  const norm = (v) => ((v % s.coreSize) + s.coreSize) % s.coreSize;
  if (!w?.instructions?.length || w.instructions.length > s.maxLength || (geo && w.instructions.length > geo.maxCodeLength)) throw new Error('GPU: invalid warrior length for ' + (w?.name ?? 'warrior'));
  if (!Number.isSafeInteger(w.start)) throw new Error('GPU: invalid warrior start');
  input[desc] = input.length; input[desc + 1] = w.instructions.length;
  input[desc + 2] = geo ? geo.encode(w.start, 0, 0) : norm(w.start);
  for (const ins of w.instructions) {
    const op = typeof ins.op === 'number' ? ins.op : OP[ins.op];
    const mod = typeof ins.mod === 'number' ? ins.mod : MOD[ins.mod];
    const am = typeof ins.aMode === 'number' ? ins.aMode : MODES.indexOf(ins.aMode);
    const bm = typeof ins.bMode === 'number' ? ins.bMode : MODES.indexOf(ins.bMode);
    if (![op, mod, am, bm, ins.a, ins.b].every(Number.isInteger) || op < 0 || op > 18 || mod < 0 || mod > 6 || am < 0 || am > 7 || bm < 0 || bm > 7) throw new Error('GPU: invalid compiled instruction');
    input.push(op | (mod << 5) | (am << 8) | (bm << 11), norm(ins.a), norm(ins.b));
  }
}
function packSolo(tasks) {
  const input = new Array(1 + tasks.length * 3).fill(0); input[0] = tasks.length;
  tasks.forEach((task, i) => { const s = config(task.settings, true); appendWarrior(input, 1 + i * 3, task.warrior, s, makeGeometry(s)); });
  return { input: new Uint32Array(input), totalRounds: 0 };
}
function unpackSolo(tasks, raw) {
  if (raw.length !== tasks.length * 4) throw new GpuBackendError('GPU: incomplete solo readback');
  tasks.forEach((task, i) => { const s = config(task.settings, true); if (raw[i * 4] < 1 || raw[i * 4] > s.maxProcesses || raw[i * 4 + 1] > s.coreSize || raw[i * 4 + 2] > 1 || raw[i * 4 + 3] < 1 || raw[i * 4 + 3] > 3) throw new GpuBackendError('GPU: invalid solo measurements'); });
  return tasks.map((task, i) => speciesFromStats({ processes: raw[i * 4], coverage: raw[i * 4 + 1], survives: !!raw[i * 4 + 2], shape: raw[i * 4 + 3] }, task.settings));
}
const memoryStride = (s, solo) => 32 + s.coreSize * (solo ? 5 : 4) + s.maxProcesses * (solo ? 1 : 2) + s.pSpaceSize * (solo ? 1 : 2);

function pack(tasks) {
  const input = new Array(1 + tasks.length * 9).fill(0);
  input[0] = tasks.length;
  let totalRounds = 0;
  tasks.forEach((task, i) => {
    const s = config(task.settings), geo = makeGeometry(s);
    const desc = 1 + i * 9;
    [task.a, task.b].forEach((w, side) => appendWarrior(input, desc + side * 3, w, s, geo));
    input[desc + 6] = s.rounds;
    input[desc + 7] = input.length;
    input[desc + 8] = totalRounds;
    for (const { positions, firstTurn } of matchPlan(task)) input.push(...positions, firstTurn);
    totalRounds += s.rounds;
  });
  return { input: new Uint32Array(input), totalRounds };
}

function unpack(tasks, raw) {
  let offset = 0;
  return tasks.map((task) => {
    const s = config(task.settings);
    const rounds = [], plan = matchPlan(task);
    for (let r = 0; r < s.rounds; r++, offset += 5) {
      const winner = raw[offset], diedAt = raw[offset + 2];
      const diagnostic = winner === 2 ? 'tie' : !raw[offset + 3] ? 'suicide' : raw[offset + 4] > 100 ? 'converted' : diedAt < 5000 ? 'early' : 'late';
      rounds.push({ winner: winner === 2 ? null : winner, cycles: raw[offset + 1],
        positions: plan[r].positions, firstTurn: plan[r].firstTurn,
        survivors: winner === 2 ? [0, 1] : [winner],
        diedAt: [0, 1].map((i) => winner !== 2 && i !== winner ? diedAt : null), diagnostic });
    }
    return summarizeMatch(task, rounds);
  });
}

export async function createGpuMatchPool({ gpu, batchSize = 1024, schedule = (fn) => setTimeout(fn, 0) } = {}) {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) throw new Error('GPU batch size must be a positive integer');
  if (!gpu) throw new GpuBackendError('WebGPU is unavailable');
  const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter || adapter.info.isFallbackAdapter) throw new GpuBackendError('No hardware WebGPU adapter is available');
  const limit = Math.min(adapter.limits.maxStorageBufferBindingSize, adapter.limits.maxBufferSize, 512 * 1024 * 1024);
  const device = await adapter.requestDevice({ requiredLimits: { maxStorageBufferBindingSize: limit, maxBufferSize: limit } });
  let failure, closed = false, running = false, lost = false, releaseScheduled = false;
  const pending = [], pipelines = new Map();
  const stats = { backend: 'gpu', adapter: { vendor: adapter.info.vendor, architecture: adapter.info.architecture, device: adapter.info.device, description: adapter.info.description }, matches: 0, rounds: 0, batches: 0, dispatches: 0, milliseconds: 0, soloChecks: 0, soloBatches: 0, soloMilliseconds: 0 };
  device.lost.then((info) => { failure = new GpuBackendError(`GPU device lost: ${info.message || info.reason}`); lost = true; releaseRuntime(); });
  device.addEventListener('uncapturederror', (event) => { failure = new GpuBackendError(`GPU: ${event.error.message}`); });

  function releaseRuntime() {
    if (!closed || !lost || running || releaseScheduled) return;
    releaseScheduled = true;
    // Native Dawn needs its root alive through device-loss and readback
    // callbacks. Release on a later task after the active batch has unwound.
    schedule(() => { gpu = null; });
  }

  async function runBatch(tasks, s, solo) {
    if (failure) throw failure;
    const start = performance.now();
    const stride = memoryStride(s, solo);
    const key = (solo ? 'solo:' : 'match:') + shaderKey(s);
    const { input, totalRounds } = solo ? packSolo(tasks) : pack(tasks);
    const outputBytes = solo ? tasks.length * 16 : totalRounds * 20; // Bad input must not trigger CPU fallback.
    const buffers = [];
    try {
      if (!pipelines.has(key)) {
        const module = device.createShaderModule({ code: solo ? soloKernel(s, stride, CHUNK_STEPS) : gpuKernel(s, stride, CHUNK_STEPS) });
        const info = await module.getCompilationInfo();
        const errors = info.messages.filter((m) => m.type === 'error');
        if (errors.length) throw new Error(errors.map((m) => `GPU shader ${m.lineNum}:${m.linePos}: ${m.message}`).join('\n'));
        pipelines.set(key, await device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'main' } }));
      }
      if (input.byteLength > limit || outputBytes > limit) throw new Error('GPU: match input or results exceed the device buffer limit; reduce rounds or GPU batch size');
      const buffer = (size, usage) => { const b = device.createBuffer({ size: Math.max(4, size), usage }); buffers.push(b); return b; };
      const programs = buffer(input.byteLength, STORAGE | COPY_DST);
      const memory = buffer(stride * tasks.length * 4, STORAGE | COPY_DST);
      const results = buffer(outputBytes, STORAGE | COPY_SRC);
      const finished = buffer(4, STORAGE | COPY_SRC | COPY_DST);
      const status = buffer(4, COPY_DST | MAP_READ);
      const readback = buffer(outputBytes, COPY_DST | MAP_READ);
      device.queue.writeBuffer(programs, 0, input);
      const pipeline = pipelines.get(key);
      const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [programs, memory, results, finished].map((resource, binding) => ({ binding, resource: { buffer: resource } })) });
      // Upper bound ensures an interpreter defect cannot submit forever.
      const maxRounds = solo ? 1 : Math.max(...tasks.map((t) => config(t.settings).rounds));
      const maxPasses = Math.ceil((Math.ceil(s.maxCycles * (solo ? 1 : 2) / CHUNK_STEPS) + 1) * maxRounds / DISPATCHES) + 1;
      let complete = false;
      for (let pass = 0; pass < maxPasses; pass++) {
        if (failure) throw failure;
        if (closed) throw new Error('GPU pool is closed');
        const encoder = device.createCommandEncoder();
        for (let d = 0; d < DISPATCHES; d++) {
          const compute = encoder.beginComputePass();
          compute.setPipeline(pipeline); compute.setBindGroup(0, group);
          compute.dispatchWorkgroups(Math.ceil(tasks.length / 32)); compute.end();
        }
        encoder.copyBufferToBuffer(finished, 0, status, 0, 4);
        device.queue.submit([encoder.finish()]);
        stats.dispatches += DISPATCHES;
        await status.mapAsync(MAP_READ);
        const done = new Uint32Array(status.getMappedRange())[0]; status.unmap();
        if (done === tasks.length) { complete = true; break; }
      }
      if (!complete) throw new Error('GPU interpreter exceeded its instruction budget');
      const encoder = device.createCommandEncoder();
      encoder.copyBufferToBuffer(results, 0, readback, 0, outputBytes);
      device.queue.submit([encoder.finish()]);
      await readback.mapAsync(MAP_READ);
      const raw = new Uint32Array(readback.getMappedRange());
      const answer = solo ? unpackSolo(tasks, raw) : unpack(tasks, raw);
      readback.unmap();
      if (solo) { stats.soloChecks += tasks.length; stats.soloBatches++; stats.soloMilliseconds += performance.now() - start; }
      else { stats.matches += tasks.length; stats.rounds += totalRounds; stats.batches++; stats.milliseconds += performance.now() - start; }
      return answer;
    } catch (error) { throw error instanceof GpuBackendError ? error : new GpuBackendError(error.message, { cause: error }); }
    finally { for (const b of buffers) b.destroy(); }
  }

  async function flush() {
    if (running || closed) return;
    running = true;
    try {
      while (pending.length && !closed) {
        const first = pending[0], solo = first.kind === 'solo', s = config(first.task.settings, solo);
        const strideBytes = memoryStride(s, solo) * 4;
        const capacity = Math.min(batchSize, Math.floor(limit / strideBytes));
        if (capacity < 1) throw new GpuBackendError('GPU: this battlefield exceeds the device buffer limit');
        const group = [];
        while (group.length < capacity && pending.length && pending[0].kind === first.kind && shaderKey(config(pending[0].task.settings, solo)) === shaderKey(s)) group.push(pending.shift());
        try {
          const results = await runBatch(group.map((p) => p.task), s, solo);
          group.forEach((p, i) => p.resolve(results[i]));
        } catch (error) { group.forEach((p) => p.reject(error)); }
      }
    } catch (error) { for (const p of pending.splice(0)) p.reject(error); }
    finally { running = false; releaseRuntime(); }
  }

  function enqueue(kind, task) {
    if (closed || !gpu) return Promise.reject(new Error('GPU pool is closed'));
    try { config(task.settings, kind === 'solo'); } catch (error) { return Promise.reject(error); }
    return new Promise((resolve, reject) => {
      pending.push({ kind, task, resolve, reject });
      if (!running) schedule(flush);
    });
  }
  return {
    backend: 'gpu', size: batchSize, stats,
    match(task) { return enqueue('match', task); },
    measureSpecies(warrior, settings) { return enqueue('solo', { warrior, settings }); },
    close() {
      if (closed) return;
      closed = true;
      for (const p of pending.splice(0)) p.reject(new Error('GPU pool is closed'));
      pipelines.clear();
      device.destroy();
      releaseRuntime();
    },
  };
}
