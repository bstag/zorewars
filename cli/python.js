// Running Python generator programs from Node (CLI, scripts and tests).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LIB = path.join(ROOT, 'lang', 'python');

// A generator runs once to print Redcode. One that is still going after this
// long is looping, and one that prints more than this is not a warrior.
export const GENERATOR_LIMITS = { timeout: 20000, maxBuffer: 8 * 1024 * 1024 };

// Why a generator process failed, in one line.
export function generatorFailure(what, r) {
  if (r.error?.code === 'ETIMEDOUT') return `${what} was still running after ${GENERATOR_LIMITS.timeout / 1000} seconds (an endless loop?) and was stopped`;
  if (r.error?.code === 'ENOBUFS') return `${what} printed more than ${GENERATOR_LIMITS.maxBuffer / 1024 / 1024} MB and was stopped`;
  if (r.error) return `${what} could not run: ${r.error.message}`;
  return `${what} exited with status ${r.status}:\n${r.stderr}`;
}

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
  const r = spawnSync(py[0], [...py.slice(1), file], { env: env(), encoding: 'utf8', ...GENERATOR_LIMITS });
  if (r.error || r.status !== 0) throw new Error(generatorFailure('python', r));
  return r.stdout;
}

// A function that runs Python source text, or null when Python is missing.
export function pythonRunner() {
  if (!findPython()) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zorewars-py-'));
  process.once('exit', () => fs.rmSync(dir, { recursive: true, force: true }));
  let n = 0;
  return (code) => {
    const file = path.join(dir, `warrior${n++}.py`);
    fs.writeFileSync(file, code);
    try { return runPythonFile(file); } finally { fs.rmSync(file, { force: true }); }
  };
}
