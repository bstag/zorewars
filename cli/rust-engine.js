import { existsSync, readFileSync } from 'node:fs';
import { createNativeRingKernel, nativeAddonURL } from '../tools/ring-duel-native.js';
import { createWasmRingKernel, ringDuelWasmURL } from '../src/engine/ring-duel-wasm.js';

export function rustEngine(flags, usage) {
  if (flags.native && flags.wasm) usage('Choose either --native or --wasm');
  if (flags.native) {
    if (!existsSync(nativeAddonURL)) usage('Run npm run build:native to build the native Rust engine');
    return { createRingKernel: createNativeRingKernel(), native: true };
  }
  if (!flags.wasm) return {};
  if (!existsSync(ringDuelWasmURL)) usage('Run npm run build:wasm to build the WebAssembly engine');
  const wasmModule = new WebAssembly.Module(readFileSync(ringDuelWasmURL));
  return { createRingKernel: createWasmRingKernel(wasmModule), wasmModule };
}
