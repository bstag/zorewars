import { createMatchBackend } from '../src/engine/match-backend.js';
import { GpuBackendError } from '../src/engine/gpu/errors.js';
import { createCpuMatchPool } from './cpu-matches.js';

const workerFactory = () => new Worker(new URL('./match-worker.js', import.meta.url), { type: 'module' });

async function workerPool({ backend, batchSize, createWorker, cancelled }) {
  if (cancelled()) throw new DOMException('Match cancelled', 'AbortError');
  const worker = createWorker();
  let next = 0, closed = false, stats, failReady;
  const pending = new Map();
  function fail(error) {
    failReady?.(error);
    for (const p of pending.values()) p.reject(error);
    pending.clear();
  }
  worker.onerror = (event) => { event.preventDefault?.(); fail(new GpuBackendError(event.message || 'Battle worker failed')); };
  worker.onmessageerror = () => fail(new GpuBackendError('Battle worker could not read its message'));
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => failReady(new GpuBackendError('Battle worker initialization timed out')), 15000);
      const check = setInterval(() => { if (cancelled()) failReady(new DOMException('Match cancelled', 'AbortError')); }, 50);
      const cleanup = () => { clearTimeout(timeout); clearInterval(check); };
      failReady = (error) => { cleanup(); reject(error); };
      worker.onmessage = ({ data }) => {
        if (data.stats) stats = data.stats;
        if (data.type === 'ready') { cleanup(); failReady = null; resolve(); return; }
        if (data.type === 'error' && data.id === undefined) { failReady?.(new GpuBackendError(data.message)); return; }
        const p = pending.get(data.id);
        if (!p) return;
        pending.delete(data.id);
        if (data.type === 'error') {
          const error = data.name === 'GpuBackendError' ? new GpuBackendError(data.message) : new Error(data.message);
          error.name = data.name; p.reject(error);
        } else p.resolve(data.result);
      };
      try { worker.postMessage({ type: 'init', backend, batchSize }); } catch (error) { failReady(error); }
    });
  } catch (error) { worker.terminate(); throw error; }
  function request(type, task) {
      if (closed) return Promise.reject(new Error('Battle worker is closed'));
      const id = next++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        try { worker.postMessage({ type, id, task }); }
        catch (error) { pending.delete(id); reject(error); }
      });
  }
  return {
    backend, size: backend === 'gpu' ? batchSize : 1,
    get stats() { return stats; },
    match(task) { return request('match', task); },
    measureSpecies(warrior, settings) { return request('species', { warrior, settings }); },
    close() { if (!closed) { closed = true; worker.terminate(); fail(new Error('Battle worker is closed')); } },
  };
}

export async function createBrowserMatchPool({ backend = 'auto', batchSize = 128, createWorker = workerFactory, cancelled = () => false, onFallback } = {}) {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) throw new Error('GPU batch size must be a positive integer');
  const pool = await createMatchBackend({ backend, onFallback,
    createGpu: () => workerPool({ backend: 'gpu', batchSize, createWorker, cancelled }),
    createCpu: async () => {
      try { return await workerPool({ backend: 'cpu', batchSize, createWorker, cancelled }); }
      catch (error) { if (error.name === 'AbortError') throw error; return createCpuMatchPool({ cancelled }); }
    },
  });
  if (cancelled()) { pool.close(); throw new DOMException('Match cancelled', 'AbortError'); }
  return pool;
}
