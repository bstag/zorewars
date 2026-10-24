// JavaScript warrior generator.
//
// A JavaScript warrior is ordinary JS that *emits* Redcode through a small
// API (mov, add, label, ...). Loops, functions and constants become a macro
// language; the output is plain Redcode, which is what actually runs in the
// virtual machine. The same API exists for Python (lang/python/zorewars.py)
// and C++ (lang/cpp/zorewars.hpp).

import { OPCODES, MODIFIERS, DEFAULT_SETTINGS } from './constants.js';

export function createGenerator(settings = {}) {
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  const meta = { name: null, author: null, strategy: [] };
  const lines = [];
  let pendingLabels = [];
  let org = null;
  let count = 0; // instructions emitted, for curline()

  const operand = (x) => (typeof x === 'number' ? String(x) : String(x).trim());

  function emitInstruction(op, mod, args) {
    if (args.length > 2) throw new Error(`${op} takes at most two operands`);
    count++;
    const label = pendingLabels.length ? pendingLabels.join(' ') : '';
    pendingLabels = [];
    const opm = mod ? `${op}.${mod}` : op;
    const ops = args.map(operand).join(', ');
    // Always at least one space after a label, however long it is.
    lines.push(`${label ? `${label} `.padEnd(10) : ''.padEnd(10)}${opm.padEnd(8)}${ops}`.trimEnd());
  }

  const api = {
    name: (s) => { meta.name = String(s); },
    author: (s) => { meta.author = String(s); },
    strategy: (s) => { meta.strategy.push(String(s)); },
    label: (name) => { pendingLabels.push(String(name)); },
    org: (where) => { org = operand(where); },
    equ: (name, value) => { lines.push(`${String(name).padEnd(10)}EQU     ${operand(value)}`); },
    comment: (text) => { lines.push(`; ${text}`); },
    raw: (line) => { lines.push(String(line)); },
    // Index of the next instruction, like Redcode's CURLINE.
    curline: () => count,
    // operand helpers: imm(4) -> "#4", ind("ptr") -> "@ptr", ...
    imm: (x) => `#${operand(x)}`,
    dir: (x) => `$${operand(x)}`,
    ind: (x) => `@${operand(x)}`,
    aind: (x) => `*${operand(x)}`,
    predec: (x) => `<${operand(x)}`,
    apredec: (x) => `{${operand(x)}`,
    postinc: (x) => `>${operand(x)}`,
    apostinc: (x) => `}${operand(x)}`,
    CORESIZE: cfg.coreSize,
    MAXPROCESSES: cfg.maxProcesses,
    MAXCYCLES: cfg.maxCycles,
    MAXLENGTH: cfg.maxLength,
    MINDISTANCE: cfg.minDistance,
  };

  for (const op of [...OPCODES, 'CMP']) {
    const fn = (...args) => emitInstruction(op, null, args);
    for (const m of MODIFIERS) {
      fn[m.toLowerCase()] = (...args) => emitInstruction(op, m, args);
    }
    api[op.toLowerCase()] = fn;
  }

  function render() {
    const out = [];
    out.push(`;name ${meta.name ?? 'Unnamed'}`);
    out.push(`;author ${meta.author ?? 'Anonymous'}`);
    for (const s of meta.strategy) out.push(`;strategy ${s}`);
    if (org !== null) out.push(`          ORG     ${org}`);
    out.push(...lines);
    if (pendingLabels.length) out.push(pendingLabels.join(' '));
    return out.join('\n') + '\n';
  }

  return { api, render };
}

// Run JavaScript warrior source and return the Redcode it emits.
export function generateFromJS(source, settings = {}) {
  const { api, render } = createGenerator(settings);
  const names = Object.keys(api);
  const fn = new Function(...names, `"use strict";\n${source}`);
  fn(...names.map((k) => api[k]));
  return render();
}
