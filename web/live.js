import { createLiveController } from '../src/engine/live.js';
import { createGpuLiveEngine } from '../src/engine/gpu/live.js';

let gpuEngine;
export function createBrowserLiveController(vm, options = {}) {
  return createLiveController(vm, { ...options,
    createGpu: async () => {
      gpuEngine ??= createGpuLiveEngine({ gpu: globalThis.navigator?.gpu });
      return (await gpuEngine).createSession(vm);
    },
    onGpuFailure: () => { const previous = gpuEngine; gpuEngine = null; previous?.then((engine) => engine.close()).catch(() => {}); },
  });
}
