// Node owns native runtime setup; interpreter and batching are shared with web.
import { createGpuMatchPool } from '../src/engine/gpu/pool.js';

export async function createGpuPool(options = {}) {
  if (options.batchSize !== undefined && (!Number.isSafeInteger(options.batchSize) || options.batchSize < 1)) {
    throw new Error('GPU batch size must be a positive integer');
  }
  let runtime;
  try { runtime = await import('webgpu'); }
  catch (cause) { throw new Error('Local GPU backend needs the optional webgpu package. Run npm install --include=optional.', { cause }); }
  return createGpuMatchPool({ ...options, gpu: runtime.create([]), schedule: setImmediate });
}
