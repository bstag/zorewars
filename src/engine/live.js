import { GpuBackendError } from './gpu/errors.js';
import { LIVE_STEPS } from './gpu/live-layout.js';
import { advanceRustHistory, detachRustHistory, hasRustHistory } from './ring-duel.js';

// A confirmed VM snapshot is always authoritative. On GPU failure the same
// VM resumes on CPU, including queues, P-space, forensic history and events.
export function createLiveController(vm, { backend = 'auto', createGpu = async () => { throw new GpuBackendError('WebGPU is unavailable'); },
  createCpu, onBackend = () => {}, onGpuFailure = () => {}, timeoutMs = 15000 } = {}) {
  if (!['auto', 'cpu', 'gpu'].includes(backend)) throw new Error('backend takes auto, cpu or gpu');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new Error('timeoutMs must be a positive integer');
  let closed = false, engine, mode = backend === 'cpu' ? 'cpu' : 'initializing', reason, lastStep = null;
  let acceptingInitialization = true;
  let tail = Promise.resolve();
  const bounded = (promise, operation) => {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new GpuBackendError(`GPU ${operation} timed out`)), timeoutMs);
    })]).finally(() => clearTimeout(timer));
  };
  const cpu = (error) => { mode = 'cpu'; reason = error?.message ?? reason; engine?.close(); engine = null; onBackend(mode, reason); };
  const prepareCpu = async () => {
    if (hasRustHistory(vm)) { mode = 'wasm'; onBackend(mode, reason); return; }
    if (!createCpu) return;
    const attach = await createCpu();
    if (!closed && attach?.()) { mode = 'wasm'; onBackend(mode, reason); }
  };
  const initialization = backend === 'cpu' ? null : Promise.resolve().then(createGpu);
  initialization?.then((session) => { if (!acceptingInitialization) session.close(); }).catch(() => {});
  const ready = backend === 'cpu' ? prepareCpu() : bounded(initialization, 'initialization').then((session) => {
    if (closed) { session.close(); return; }
    // Subsequent GPU readbacks update the VM facade in place. Any earlier
    // Rust attachment holds a separate snapshot of the core and queues.
    detachRustHistory(vm);
    engine = session; mode = 'gpu'; onBackend(mode);
  }).catch((error) => {
    acceptingInitialization = false;
    if (closed) return;
    if (backend === 'gpu') throw error;
    cpu(error); onGpuFailure(error);
    return prepareCpu();
  });
  // A strict GPU caller can observe initialization errors through ready or
  // advance; attaching a handler also prevents an idle UI's unhandled error.
  ready.catch(() => {});
  return {
    ready,
    get backend() { return mode; },
    get fallbackReason() { return reason; },
    get lastStep() { return lastStep; },
    advance(count, { cancelled = () => false } = {}) {
      if (!(count === Infinity || Number.isSafeInteger(count) && count >= 0)) return Promise.reject(new Error('steps must be a nonnegative integer'));
      const result = tail.then(async () => {
        if (closed || cancelled()) return 0;
        await ready;
        if (closed || cancelled() || vm.done) return 0;
        const limit = Math.min(count, LIVE_STEPS);
        if (limit === 0) return 0;
        if (engine) {
          try { const n = await bounded(engine.advance(limit), 'advance'); lastStep = engine.lastStep; return closed ? 0 : n; }
          catch (error) {
            if (closed) return 0;
            if (backend === 'gpu' || !(error instanceof GpuBackendError)) { engine?.close(); throw error; }
            cpu(error); onGpuFailure(error);
            await prepareCpu();
            if (closed || cancelled()) return 0;
          }
        }
        let n = 0;
        if (limit > 1 && hasRustHistory(vm)) {
          ({ steps: n, lastStep } = advanceRustHistory(vm, limit));
        } else {
          while (n < limit && !vm.done) { lastStep = vm.step(); n++; }
        }
        if (mode === 'wasm' && !hasRustHistory(vm)) cpu();
        return n;
      });
      tail = result.catch(() => {});
      return result;
    },
    close() { if (!closed) { closed = true; engine?.close(); } },
  };
}
