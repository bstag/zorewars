import { createLiveController } from '../src/engine/live.js';
import { createGpuLiveEngine } from '../src/engine/gpu/live.js';
import { GpuBackendError } from '../src/engine/gpu/errors.js';
import { createRingDuel } from '../src/engine/ring-duel.js';
import { createWasmRingKernel, ringDuelWasmURL } from '../src/engine/ring-duel-wasm.js';

let gpuEngine, wasmKernel, gpuFailures = 0;
const GPU_ATTEMPTS = 2;
function loadWasmKernel() {
  wasmKernel ??= WebAssembly.compileStreaming(fetch(ringDuelWasmURL)).then(createWasmRingKernel)
    .catch(() => { wasmKernel = null; return null; });
  return wasmKernel;
}

export async function prepareWasmLive(vm, loadKernel = loadWasmKernel) {
  try {
    const kernel = await loadKernel();
    if (!kernel) return null;
    const warriors = vm.warriors.map(w => ({ start: w.start, instructions: w.original }));
    const duel = createRingDuel(vm.settings, warriors, kernel, { history: true });
    return duel && (() => duel.attachHistory(vm));
  } catch {
    return null;
  }
}

export function createBrowserLiveController(vm, { loadWasmKernel: loadKernel, ...options } = {}) {
  return createLiveController(vm, { ...options,
    createGpu: async () => {
      // After repeated failures stop asking: every round would otherwise wait
      // on a GPU that isn't coming before falling back to the CPU.
      if (gpuFailures >= GPU_ATTEMPTS) throw new GpuBackendError('WebGPU failed earlier in this session');
      gpuEngine ??= createGpuLiveEngine({ gpu: globalThis.navigator?.gpu });
      const session = await (await gpuEngine).createSession(vm);
      gpuFailures = 0;
      return session;
    },
    createCpu: () => prepareWasmLive(vm, loadKernel),
    onGpuFailure: () => { gpuFailures++; const previous = gpuEngine; gpuEngine = null; previous?.then((engine) => engine.close()).catch(() => {}); },
  });
}
