// Node owns native runtime setup; interpreter and batching are shared with web.
import { createGpuMatchPool } from '../src/engine/gpu/pool.js';
import { createGpuLiveEngine } from '../src/engine/gpu/live.js';

async function nativeGpu(adapter) {
  let runtime;
  try { runtime = await import('webgpu'); }
  catch (cause) { throw new Error('Local GPU backend needs the optional webgpu package. Run npm install --include=optional.', { cause }); }
  return runtime.create(adapter ? [`adapter=${adapter}`] : []);
}

export async function createGpuPool({ adapter, batchSize } = {}) {
  if (batchSize !== undefined && (!Number.isSafeInteger(batchSize) || batchSize < 1)) {
    throw new Error('GPU batch size must be a positive integer');
  }
  return createGpuMatchPool({ batchSize, gpu: await nativeGpu(adapter), schedule: setImmediate });
}

export async function createLocalGpuLiveEngine({ adapter } = {}) {
  return createGpuLiveEngine({ gpu: await nativeGpu(adapter) });
}
