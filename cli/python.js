// Running Python generator programs from Node (CLI, scripts and tests).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LIB = path.join(ROOT, 'lang', 'python');

function env() {
  return { ...process.env, PYTHONPATH: [LIB, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter), PYTHONIOENCODING: 'utf-8' };
}

// The first Python interpreter that works, as [command, ...prefixArgs].
let found;
export function findPython() {
  if (found !== undefined) return found;
  const candidates = process.platform === 'win32' ? [['python'], ['py', '-3'], ['python3']] : [['python3'], ['python']];
  found = null;
  for (const [cmd, ...pre] of candidates) {
    const r = spawnSync(cmd, [...pre, '-c', 'import sys; print(sys.version_info[0])'], { encoding: 'utf8' });
    if (!r.error && r.status === 0 && r.stdout.trim() === '3') { found = [cmd, ...pre]; break; }
  }
  return found;
}

// Run a Python warrior file and return the Redcode it prints.
export function runPythonFile(file) {
  const py = findPython();
  if (!py) throw new Error('could not find a Python 3 interpreter (tried python3, python, py)');
  const r = spawnSync(py[0], [...py.slice(1), file], { env: env(), encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`python exited with status ${r.status}:\n${r.stderr}`);
  return r.stdout;
}

// A function that runs Python source text, or null when Python is missing.
export function pythonRunner() {
  if (!findPython()) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zorewars-py-'));
  let n = 0;
  return (code) => {
    const file = path.join(dir, `warrior${n++}.py`);
    fs.writeFileSync(file, code);
    try { return runPythonFile(file); } finally { fs.rmSync(file, { force: true }); }
  };
}
