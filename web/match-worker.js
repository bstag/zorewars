// Both paths run off the page's UI thread. GPU logic is shared with Node.
import { createGpuMatchPool } from '../src/engine/gpu/pool.js';
import { createCpuMatchPool } from './cpu-matches.js';

let pool;
self.onmessage = async ({ data }) => {
  const { type, id, task } = data;
  try {
    if (type === 'init') {
      pool = data.backend === 'cpu' ? createCpuMatchPool()
        : await createGpuMatchPool({ gpu: self.navigator.gpu, batchSize: data.batchSize });
      self.postMessage({ type: 'ready', backend: pool.backend, stats: pool.stats });
    } else if (type === 'species') {
      const result = await pool.measureSpecies(task.warrior, task.settings);
      self.postMessage({ type: 'result', id, result, stats: pool.stats });
    } else if (type === 'match') {
      const result = await pool.match(task);
      self.postMessage({ type: 'result', id, result, stats: pool.stats });
    }
  } catch (error) {
    self.postMessage({ type: 'error', id, message: error.message, name: error.name });
  }
};
