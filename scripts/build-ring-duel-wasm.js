import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ringDuelWasmURL } from '../src/engine/ring-duel-wasm.js';

const source = fileURLToPath(new URL('../tools/ring-duel-wasm.rs', import.meta.url));
const output = fileURLToPath(ringDuelWasmURL);
const { status, error } = spawnSync('rustc', [
  '--target', 'wasm32-unknown-unknown', '--crate-type', 'cdylib',
  '-C', 'opt-level=3', '-C', 'panic=abort', '-C', 'strip=symbols',
  '-C', 'link-arg=--export=__heap_base',
  source, '-o', output,
], { stdio: 'inherit' });
if (error) throw error;
process.exitCode = status ?? 1;
