import { createLiveController } from '../src/engine/live.js';
import { createGpuLiveEngine } from '../src/engine/gpu/live.js';
import { createRingDuel } from '../src/engine/ring-duel.js';
import { createWasmRingKernel, ringDuelWasmURL } from '../src/engine/ring-duel-wasm.js';

let gpuEngine, wasmKernel;
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
      gpuEngine ??= createGpuLiveEngine({ gpu: globalThis.navigator?.gpu });
      return (await gpuEngine).createSession(vm);
    },
    createCpu: () => prepareWasmLive(vm, loadKernel),
    onGpuFailure: () => { const previous = gpuEngine; gpuEngine = null; previous?.then((engine) => engine.close()).catch(() => {}); },
  });
}
