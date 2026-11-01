// Collect child-process and worker coverage without changing the node:test suite.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { inputSignature, reportSignature } from '../tools/quality/crap.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const inputs = inputSignature(root);
const manifest = path.join(root, 'coverage/crap-manifest.json');
// Invalidate earlier success before starting: a failed run cannot reuse it.
if (fs.existsSync(manifest)) fs.unlinkSync(manifest);
const child = spawn(process.execPath, [path.join(root, 'node_modules/c8/bin/c8.js'), process.execPath, '--test'],
  { cwd: root, stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('close', code => {
  if (code !== 0) { process.exitCode = code || 1; return; }
  if (inputs !== inputSignature(root)) { console.error('Sources changed during coverage; rerun npm run test:coverage'); process.exitCode = 1; return; }
  fs.writeFileSync(manifest, JSON.stringify({ inputs, coverage: reportSignature(root),
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() }, null, 2) + '\n');
});
