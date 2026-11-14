import { createRequire } from 'node:module';
import { createPackedKernel } from '../src/engine/ring-duel-wasm.js';

const require = createRequire(import.meta.url);
export const nativeAddonURL = new URL('./build/ring-duel.node', import.meta.url);

export function createNativeRingKernel() {
  const { dispatch, historyVersion } = require('./build/ring-duel.node');
  return createPackedKernel(() => {
    let buffer;
    const args = new Uint32Array(17);
    function invoke(op, values) {
      args.set(values);
      return dispatch(buffer, op, args);
    }
    return {
      start: 0,
      historyVersion,
      maxBytes: 0x100000000,
      allocate(bytes) { return buffer = new ArrayBuffer(bytes); },
      run: (...values) => invoke(0, values),
      run_diagnosed: (...values) => invoke(1, values),
      advance_group: (...values) => invoke(2, values),
      advance_torus: (...values) => invoke(3, values),
    };
  });
}
