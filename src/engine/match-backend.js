import { GpuBackendError } from './gpu/errors.js';

// CPU/GPU selection is identical in a Node CLI and a browser worker. Failed
// matches and solo checks retry from their original inputs with fresh state.
export async function createMatchBackend({ backend = 'auto', createGpu, createCpu, onFallback = () => {} }) {
  if (!['auto', 'cpu', 'gpu'].includes(backend)) throw new Error('backend takes auto, cpu or gpu');
  let active, gpu, cpu, fallback, fallbackReason, closed = false;
  async function useCpu(error) {
    if (!fallback) {
      fallbackReason = error?.message;
      gpu?.close();
      fallback = Promise.resolve().then(createCpu).then((pool) => {
        cpu = pool;
        if (closed) { pool.close(); throw new Error('Match backend is closed'); }
        active = pool;
        if (error) onFallback(fallbackReason);
        return pool;
      });
    }
    return fallback;
  }
  if (backend === 'cpu') await useCpu();
  else {
    try { active = gpu = await createGpu(); }
    catch (error) { if (backend === 'gpu' || error.name === 'AbortError') throw error; await useCpu(error); }
  }
  async function invoke(method, args) {
    if (closed) throw new Error('Match backend is closed');
    const engine = active;
    try { return await engine[method](...args); }
    catch (error) {
      if (closed || backend !== 'auto' || engine === cpu || (!fallback && !(error instanceof GpuBackendError))) throw error;
      return (await useCpu(error))[method](...args);
    }
  }
  return {
    get backend() { return active.backend ?? 'cpu'; },
    get size() { return active.size; },
    get stats() { return { ...(active.stats ?? { backend: 'cpu', threads: active.size }), requestedBackend: backend, ...(fallbackReason ? { fallbackReason } : {}) }; },
    match(task) { return invoke('match', [task]); },
    measureSpecies(warrior, settings) { return invoke('measureSpecies', [warrior, settings]); },
    close() { if (!closed) { closed = true; gpu?.close(); cpu?.close(); } },
  };
}
