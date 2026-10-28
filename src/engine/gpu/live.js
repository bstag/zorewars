import { liveKernel } from './live-kernel.js';
import { liveLayout, encodeLiveVM, applyLiveVM, LIVE_STEPS } from './live-layout.js';
import { GpuBackendError } from './errors.js';

const STORAGE = 128, COPY_SRC = 4, COPY_DST = 8, MAP_READ = 1;
export async function createGpuLiveEngine({ gpu } = {}) {
  if (!gpu) throw new GpuBackendError('WebGPU is unavailable');
  const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter || adapter.info.isFallbackAdapter) throw new GpuBackendError('No hardware WebGPU adapter is available');
  const device = await adapter.requestDevice();
  let closed = false, failure;
  const sessions = new Set(), pipelines = new Map();
  const stats = { backend: 'gpu', advances: 0, steps: 0, readbackBytes: 0, milliseconds: 0 };
  device.lost.then((info) => { failure = new GpuBackendError(`GPU device lost: ${info.message || info.reason}`); });
  device.addEventListener('uncapturederror', (event) => { failure = new GpuBackendError(event.error.message); });
  return {
    stats,
    async createSession(vm) {
      if (closed || failure) throw failure ?? new GpuBackendError('GPU engine is closed');
      if (vm.warriors.length < 1 || vm.warriors.length > 4 || vm.size > 200000 || vm.settings.maxCycles > 10000000
        || vm.settings.maxProcesses > 200000 || vm.traceSize) throw new GpuBackendError('Live GPU supports 1–4 warriors, up to 200000 cells/processes and 10000000 cycles; instruction tracing uses CPU');
      const layout = liveLayout(vm), settings = { ...vm.settings, pSpaceSize: vm.warriors[0].pspace.length };
      const bytes = layout.words * 4;
      if (bytes > device.limits.maxStorageBufferBindingSize) throw new GpuBackendError('Live round exceeds GPU buffer capacity');
      const key = JSON.stringify([settings, layout]);
      if (!pipelines.has(key)) pipelines.set(key, (async () => {
        const module = device.createShaderModule({ code: liveKernel(settings, layout) });
        const info = await module.getCompilationInfo();
        const errors = info.messages.filter((m) => m.type === 'error');
        if (errors.length) throw new GpuBackendError(errors.map((m) => `Live GPU shader ${m.lineNum}: ${m.message}`).join('\n'));
        return device.createComputePipelineAsync({ layout: 'auto', compute: { module, entryPoint: 'main' } });
      })());
      const pipeline = await pipelines.get(key);
      if (closed || failure) throw failure ?? new GpuBackendError('GPU engine is closed');
      const buffers = [];
      const buffer = (size, usage) => { const b = device.createBuffer({ size, usage }); buffers.push(b); return b; };
      let sessionClosed = false, busy = false, lastStep = null;
      const memory = buffer(bytes, STORAGE | COPY_DST | COPY_SRC);
      const controls = buffer(8, STORAGE | COPY_DST);
      const readback = buffer(bytes, COPY_DST | MAP_READ);
      device.queue.writeBuffer(memory, 0, encodeLiveVM(vm, layout));
      const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [controls, memory].map((b, binding) => ({ binding, resource: { buffer: b } })) });
      const session = {
        backend: 'gpu',
        get lastStep() { return lastStep; },
        async advance(count) {
          if (!(count === Infinity || Number.isSafeInteger(count) && count >= 0)) throw new Error('steps must be a nonnegative integer');
          if (sessionClosed) throw new GpuBackendError('Live GPU session is closed');
          if (busy) throw new Error('Live advances must be serialized');
          if (failure) throw failure;
          if (vm.done || count === 0) return 0;
          busy = true;
          const start = performance.now();
          try {
            const limit = Math.min(LIVE_STEPS, count);
            const remaining = vm.events ? Math.max(0, (vm.eventLimit - vm.events.length) / 4) : 0;
            device.queue.writeBuffer(controls, 0, new Uint32Array([limit, Math.min(layout.eventCapacity, remaining)]));
            const encoder = device.createCommandEncoder(), pass = encoder.beginComputePass();
            pass.setPipeline(pipeline); pass.setBindGroup(0, group); pass.dispatchWorkgroups(1); pass.end();
            encoder.copyBufferToBuffer(memory, 0, readback, 0, bytes); device.queue.submit([encoder.finish()]);
            await readback.mapAsync(MAP_READ);
            if (sessionClosed) return 0;
            const raw = new Uint32Array(readback.getMappedRange()), n = raw[16];
            lastStep = applyLiveVM(vm, raw, layout); readback.unmap();
            stats.advances++; stats.steps += n; stats.readbackBytes += bytes; stats.milliseconds += performance.now() - start;
            return n;
          } catch (error) { throw error instanceof GpuBackendError ? error : new GpuBackendError(error.message, { cause: error }); }
          finally { if (readback.mapState === 'mapped') readback.unmap(); busy = false; }
        },
        close() { if (!sessionClosed) { sessionClosed = true; sessions.delete(session); for (const b of buffers) b.destroy(); } },
      };
      sessions.add(session);
      return session;
    },
    close() { if (!closed) { closed = true; for (const s of sessions) s.close(); device.destroy(); gpu = null; } },
  };
}
