import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nativeAddonURL } from '../tools/ring-duel-native.js';

const source = fileURLToPath(new URL('../tools/ring-duel-wasm.rs', import.meta.url));
const output = fileURLToPath(nativeAddonURL);
const args = [];
if (process.platform === 'win32') {
  const sdkPath = ['node-gyp', 'Cache', process.versions.node, process.arch, 'node.lib'];
  const nodeLib = process.env.ZOREWARS_NODE_LIB ?? [
    process.env.LOCALAPPDATA,
    path.join(homedir(), 'AppData', 'Local'),
  ].filter(Boolean).map(dir => path.join(dir, ...sdkPath)).find(existsSync);
  if (!nodeLib || !existsSync(nodeLib)) {
    console.error('Install the Node SDK with node-gyp install, or set ZOREWARS_NODE_LIB to your architecture’s node.lib.');
    process.exit(2);
  }
  args.push('-L', path.dirname(nodeLib));
} else if (process.platform === 'darwin') {
  args.push('-C', 'link-arg=-Wl,-undefined,dynamic_lookup');
}
mkdirSync(path.dirname(output), { recursive: true });
const { status, error } = spawnSync('rustc', [
  '--crate-type', 'cdylib', '--cfg', 'zorewars_native', '-C', 'opt-level=3',
  '-C', 'panic=abort', ...args, source, '-o', output,
], { stdio: 'inherit' });
if (error) throw error;
process.exitCode = status ?? 1;
