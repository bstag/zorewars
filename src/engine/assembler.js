// Redcode assembler: turns ICWS'94-style source text into instruction objects.
//
// Supported: labels (with or without a trailing colon), EQU constants,
// ORG / END start addresses, arithmetic expressions with pMARS-style
// registers (a=...), FOR / ROF macro loops with & concatenation, all '94
// opcodes plus the P-space opcodes LDP / STP, every modifier and addressing
// mode, ;name / ;author / ;strategy metadata and ;assert checks. Text before
// a ;redcode line is ignored, as in pMARS.

import { OPCODES, OPCODE_ALIASES, MODIFIERS, MODES, DEFAULT_SETTINGS, defaultModifier, pSpaceSizeFor } from './constants.js';
import { makeGeometry } from './geometry.js';

// Vector literals [x,y] / [x,y,z] (torus battlefields) are encoded with the
// battlefield being assembled for; set by assemble() while it runs.
let encodeVector = null;

export const PSEUDO = new Set(['ORG', 'END', 'EQU', 'PIN']);

export function opcodeOf(token) {
  const [raw, mod] = token.toUpperCase().split('.');
  const op = OPCODE_ALIASES[raw] || raw;
  if (OPCODES.includes(op) || PSEUDO.has(op)) return { op, mod: mod ?? null, raw };
  return null;
}

// Split "a, b" at the first top-level comma.
export function splitOperands(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) return [text.slice(0, i).trim(), text.slice(i + 1).trim()];
  }
  return text.trim() ? [text.trim()] : [];
}

export function tokenizeExpr(text) {
  const tokens = [];
  const re = /\s*(?:(\d+)|([A-Za-z_][\w]*)|(&&|\|\||==|!=|<=|>=|[-+*/%()<>!=[\],]))/y;
  let pos = 0;
  text = text.trim();
  while (pos < text.length) {
    re.lastIndex = pos;
    const m = re.exec(text);
    if (!m) throw new Error(`unexpected '${text.slice(pos).trim()}' in expression`);
    if (m[1] !== undefined) tokens.push({ t: 'num', v: parseInt(m[1], 10) });
    else if (m[2] !== undefined) tokens.push({ t: 'id', v: m[2] });
    else tokens.push({ t: 'op', v: m[3] });
    pos = re.lastIndex;
    while (pos < text.length && /\s/.test(text[pos])) pos++;
  }
  return tokens;
}

// Recursive-descent evaluator. `lookup(name)` resolves identifiers;
// `registers`, if given, receives pMARS-style assignments such as a=5.
function evaluate(text, lookup, registers = null) {
  const tokens = tokenizeExpr(text);
  let i = 0;
  const peek = () => tokens[i];
  const eat = (v) => {
    if (tokens[i] && tokens[i].v === v) { i++; return true; }
    return false;
  };
  const truth = (b) => (b ? 1 : 0);

  function primary() {
    const t = tokens[i++];
    if (!t) throw new Error('expression ended unexpectedly');
    if (t.t === 'num') return t.v;
    if (t.t === 'id') {
      if (registers && tokens[i] && tokens[i].v === '=') {
        i++;
        const v = logicalOr();
        registers.set(t.v, v);
        return v;
      }
      return lookup(t.v);
    }
    if (t.v === '(') {
      const v = logicalOr();
      if (!eat(')')) throw new Error("missing ')'");
      return v;
    }
    if (t.v === '[') {                       // vector literal [x,y] or [x,y,z]
      const parts = [logicalOr()];
      while (eat(',')) parts.push(logicalOr());
      if (!eat(']')) throw new Error("missing ']'");
      if (parts.length < 2 || parts.length > 3) throw new Error('a vector has 2 or 3 components: [x,y] or [x,y,z]');
      if (encodeVector) return encodeVector(parts[0], parts[1], parts[2] ?? 0);
      if (parts[1] !== 0 || (parts[2] ?? 0) !== 0) throw new Error('vectors with a y or z part need a torus battlefield (e.g. --torus 100x80)');
      return parts[0];
    }
    if (t.v === '-') return -primary();
    if (t.v === '+') return primary();
    if (t.v === '!') return truth(!primary());
    throw new Error(`unexpected '${t.v}'`);
  }
  function term() {
    let v = primary();
    for (;;) {
      if (eat('*')) v *= primary();
      else if (eat('/')) { const d = primary(); if (d === 0) throw new Error('division by zero'); v = Math.trunc(v / d); }
      else if (eat('%')) { const d = primary(); if (d === 0) throw new Error('division by zero'); v %= d; }
      else return v;
    }
  }
  function sum() {
    let v = term();
    for (;;) {
      if (eat('+')) v += term();
      else if (eat('-')) v -= term();
      else return v;
    }
  }
  function compare() {
    let v = sum();
    for (;;) {
      if (eat('==')) v = truth(v === sum());
      else if (eat('!=')) v = truth(v !== sum());
      else if (eat('<=')) v = truth(v <= sum());
      else if (eat('>=')) v = truth(v >= sum());
      else if (eat('<')) v = truth(v < sum());
      else if (eat('>')) v = truth(v > sum());
      else return v;
    }
  }
  function logicalAnd() {
    let v = compare();
    while (eat('&&')) { const r = compare(); v = truth(v && r); }
    return v;
  }
  function logicalOr() {
    let v = logicalAnd();
    while (eat('||')) { const r = logicalAnd(); v = truth(v || r); }
    return v;
  }

  const v = logicalOr();
  if (peek()) throw new Error(`unexpected '${peek().v}'`);
  return v;
}

export function parseOperand(text, equs) {
  const lead = /^([A-Za-z_]\w*)(.*)$/s.exec(text);
  if (lead && equs?.has(lead[1])) {
    const sub = equs.get(lead[1]).text.trim();
    if (MODES.includes(sub[0])) text = sub + lead[2];
  }
  const c = text[0];
  if (MODES.includes(c)) return { mode: c, expr: text.slice(1).trim() };
  return { mode: '$', expr: text };
}

export const FOR_RE = /^((?:[A-Za-z_]\w*:?\s+)*)for\s+(.+)$/i;
export const ROF_RE = /^rof\b/i;

// True if a line of code (comment removed) assembles to an instruction.
function isInstruction(code) {
  for (const tok of code.split(/\s+/)) {
    if (!tok) continue;
    const info = /^[A-Za-z_][\w.]*$/.test(tok) ? opcodeOf(tok) : null;
    if (info) return !PSEUDO.has(info.op);
    if (!/^[A-Za-z_]\w*:?$/.test(tok)) return false;
  }
  return false;
}
const codePart = (t) => {
  const k = t.indexOf(';');
  return (k >= 0 ? t.slice(0, k) : t).trim();
};

// Expand FOR / ROF blocks into plain lines. Each output line keeps the
// source line number it came from; `expanded` marks lines produced by a loop.
//   [labels] [counter] FOR count ... ROF
// The counter (the last label) runs from 1 to count. In the body, the
// counter's name is replaced by its value, and &counter by the value padded
// to two digits, so bomb&i becomes bomb01, bomb02, ... "FOR 0" is the
// customary way to comment out a block.
function preprocess(source, constants, errors) {
  let raw = source.split(/\r?\n/).map((text, i) => ({ text, lineNo: i + 1, expanded: false }));
  const start = raw.findIndex((l) => /^\s*;\s*redcode/i.test(l.text));
  if (start > 0) raw = raw.slice(start);

  const equs = new Map();
  const out = [];
  let total = 0;
  const lookup = (name, seen = new Set()) => {
    if (equs.has(name) && !seen.has(name)) {
      return evaluate(equs.get(name), (n) => lookup(n, new Set([...seen, name])));
    }
    const up = name.toUpperCase();
    if (up === 'CURLINE') return out.filter((l) => isInstruction(codePart(l.text))).length;
    if (up in constants) return constants[up];
    throw new Error(`'${name}' must be a constant defined before the FOR`);
  };
  const substitute = (text, counter, k) => text
    .replace(new RegExp(`&${counter}(?!\\w)`, 'g'), String(k).padStart(2, '0'))
    .replace(new RegExp(`(?<![\\w&.])${counter}(?!\\w)`, 'g'), String(k));

  function run(lines) {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const c = codePart(l.text);
      const eq = /^([A-Za-z_]\w*)\s+equ\s+(.+)$/i.exec(c);
      if (eq) equs.set(eq[1], eq[2]);
      const m = FOR_RE.exec(c);
      if (!m) {
        if (ROF_RE.test(c)) errors.push({ line: l.lineNo, message: 'ROF without a matching FOR' });
        else out.push(l);
        continue;
      }
      let depth = 1;
      let j = i + 1;
      for (; j < lines.length; j++) {
        const cj = codePart(lines[j].text);
        if (FOR_RE.test(cj)) depth++;
        else if (ROF_RE.test(cj) && --depth === 0) break;
      }
      if (j >= lines.length) {
        errors.push({ line: l.lineNo, message: 'FOR without a matching ROF' });
        return;
      }
      const names = m[1].trim().split(/\s+/).filter(Boolean).map((n) => n.replace(/:$/, ''));
      const counter = names.pop();
      if (names.length) out.push({ text: names.join(' '), lineNo: l.lineNo, expanded: l.expanded });
      let count = 0;
      try {
        count = evaluate(m[2], lookup);
      } catch (e) {
        errors.push({ line: l.lineNo, message: `FOR count: ${e.message}` });
      }
      total += Math.max(0, count) * (j - i - 1);
      if (total > 100000) {
        errors.push({ line: l.lineNo, message: 'FOR loops expand to too many lines' });
        return;
      }
      const body = lines.slice(i + 1, j);
      for (let k = 1; k <= count; k++) {
        run(body.map((b) => ({ lineNo: b.lineNo, expanded: true, text: counter ? substitute(b.text, counter, k) : b.text })));
      }
      i = j;
    }
  }
  run(raw);
  return out;
}

export function assemble(source, settings = {}) {
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  const errors = [];
  const warnings = [];
  const meta = { name: 'Unnamed', author: 'Anonymous', strategy: [], dialect: null };
  // The ruleset a warrior was written for, from its ;redcode header
  // ("redcode-94", "redcode-94nop", "redcode-88"...; null if none). Future
  // rulesets, such as a 3D battlefield, are declared the same way.
  const header = /^\s*;\s*(redcode(?:-[\w.]+)?)/im.exec(source);
  if (header) meta.dialect = header[1].toLowerCase();

  const geo = makeGeometry(cfg);
  encodeVector = geo ? geo.encode : null;
  const constants = {
    SIZEX: geo ? geo.X : cfg.coreSize,
    SIZEY: geo ? geo.Y : 1,
    SIZEZ: geo ? geo.Z : 1,
    CORESIZE: cfg.coreSize,
    MAXPROCESSES: cfg.maxProcesses,
    MAXCYCLES: cfg.maxCycles,
    MAXLENGTH: cfg.maxLength,
    MINDISTANCE: cfg.minDistance,
    ROUNDS: cfg.rounds,
    PSPACESIZE: pSpaceSizeFor(cfg),
    VERSION: 100,
    WARRIORS: 2,
  };

  // ---- Pass 1: parse lines, collect labels and EQUs ----
  const labels = new Map(); // name -> instruction index
  const equs = new Map();   // name -> { text, line }
  const lines = [];         // instruction lines
  let startExpr = null;
  let startLine = 0;

  const asserts = [];
  const srcLines = preprocess(source, constants, errors);
  for (const src of srcLines) {
    const lineNo = src.lineNo;
    let text = src.text;
    const semi = text.indexOf(';');
    if (semi >= 0) {
      const comment = text.slice(semi + 1).trim();
      const m = /^(name|author|strategy|assert)\b\s*(.*)$/i.exec(comment);
      if (m && !src.expanded) {
        const key = m[1].toLowerCase();
        if (key === 'strategy') meta.strategy.push(m[2]);
        else if (key === 'assert') asserts.push({ text: m[2], line: lineNo });
        else meta[key] = m[2];
      }
      text = text.slice(0, semi);
    }
    text = text.trim();
    if (!text) continue;

    const pending = [];
    let rest = text;
    let opInfo = null;
    for (;;) {
      const m = /^([A-Za-z_][\w.]*)(:?)\s*/.exec(rest);
      if (!m) break;
      const info = m[2] ? null : opcodeOf(m[1]);
      if (info) { opInfo = info; rest = rest.slice(m[0].length); break; }
      pending.push(m[1]);
      rest = rest.slice(m[0].length);
    }
    if (!opInfo) {
      if (pending.length && !rest) {
        // label-only line: labels attach to the next instruction
        lines.push({ labelsOnly: pending, lineNo });
        continue;
      }
      errors.push({ line: lineNo, message: `unknown instruction '${(pending.at(-1) || rest).split(/\s/)[0]}'` });
      continue;
    }

    if (opInfo.op === 'EQU') {
      if (!pending.length) errors.push({ line: lineNo, message: 'EQU needs a name' });
      for (const name of pending) equs.set(name, { text: rest, line: lineNo });
      continue;
    }
    if (opInfo.op === 'ORG') {
      startExpr = rest; startLine = lineNo;
      continue;
    }
    if (opInfo.op === 'PIN') {
      warnings.push({ line: lineNo, message: 'PIN (shared P-space) is not supported; this warrior gets private P-space' });
      continue;
    }
    if (opInfo.op === 'END') {
      if (rest) { startExpr = rest; startLine = lineNo; }
      break;
    }
    if (opInfo.mod && !MODIFIERS.includes(opInfo.mod)) {
      errors.push({ line: lineNo, message: `unknown modifier '.${opInfo.mod}'` });
      continue;
    }
    lines.push({ labels: pending, op: opInfo.op, mod: opInfo.mod, operands: splitOperands(rest), lineNo });
  }

  // Attach label-only lines to the following instruction and number instructions.
  const instrLines = [];
  let carry = [];
  for (const l of lines) {
    if (l.labelsOnly) { carry.push(...l.labelsOnly); continue; }
    l.labels = [...carry, ...l.labels];
    carry = [];
    instrLines.push(l);
  }
  const trailingLabels = carry; // labels after the last instruction
  instrLines.forEach((l, idx) => {
    for (const name of l.labels) {
      if (labels.has(name) || equs.has(name)) errors.push({ line: l.lineNo, message: `duplicate label '${name}'` });
      labels.set(name, idx);
    }
  });
  // pMARS discards labels that follow the last instruction; so do we.
  for (const name of trailingLabels) {
    const line = lines.filter((l) => l.labelsOnly?.includes(name)).at(-1)?.lineNo ?? 0;
    warnings.push({ line, message: `label '${name}' comes after the last instruction and is discarded, as in pMARS. Use '${name} EQU (finalLabel+1)' instead.` });
  }

  // ---- Pass 2: evaluate operands ----
  const registers = new Map(); // pMARS-style a=... assignments
  const makeLookup = (idx, stack = new Set()) => function lookup(name) {
    if (labels.has(name)) return labels.get(name) - idx;
    if (equs.has(name)) {
      if (stack.has(name)) throw new Error(`EQU '${name}' refers to itself`);
      const next = new Set(stack); next.add(name);
      return evaluate(equs.get(name).text, makeLookup(idx, next), registers);
    }
    const up = name.toUpperCase();
    if (up === 'CURLINE') return idx;
    if (up in constants) return constants[up];
    if (registers.has(name)) return registers.get(name);
    throw new Error(`unknown label '${name}'`);
  };

  const instructions = [];
  instrLines.forEach((l, idx) => {
    const lookup = makeLookup(idx);
    let ops = l.operands;
    if (ops.length > 2) {
      errors.push({ line: l.lineNo, message: 'too many operands' });
      return;
    }
    let aOp, bOp;
    if (ops.length === 0) {
      if (l.op !== 'DAT' && l.op !== 'NOP') {
        errors.push({ line: l.lineNo, message: `${l.op} needs at least one operand` });
        return;
      }
      aOp = { mode: '#', expr: '0' }; bOp = { mode: '#', expr: '0' };
    } else if (ops.length === 1) {
      // As in pMARS, only these opcodes may omit the B operand.
      if (l.op === 'DAT') { aOp = { mode: '#', expr: '0' }; bOp = parseOperand(ops[0], equs); }
      else if (['JMP', 'SPL', 'NOP'].includes(l.op)) { aOp = parseOperand(ops[0], equs); bOp = { mode: '$', expr: '0' }; }
      else {
        errors.push({ line: l.lineNo, message: `${l.op} needs two operands (only DAT, JMP, SPL and NOP may have one)` });
        return;
      }
    } else {
      aOp = parseOperand(ops[0], equs); bOp = parseOperand(ops[1], equs);
    }
    let a, b;
    try { a = evaluate(aOp.expr, lookup, registers); } catch (e) { errors.push({ line: l.lineNo, message: `A-operand: ${e.message}` }); return; }
    try { b = evaluate(bOp.expr, lookup, registers); } catch (e) { errors.push({ line: l.lineNo, message: `B-operand: ${e.message}` }); return; }
    const mod = l.mod || defaultModifier(l.op, aOp.mode, bOp.mode);
    instructions.push({ op: l.op, mod, aMode: aOp.mode, a, bMode: bOp.mode, b, line: l.lineNo });
  });

  let start = 0;
  if (startExpr) {
    try { start = evaluate(startExpr, makeLookup(0)); } catch (e) { errors.push({ line: startLine, message: `start: ${e.message}` }); }
  }

  // A lone word is a legal label, but an unused one is usually a typo'd opcode.
  const referenced = [...instrLines.flatMap((l) => l.operands), ...[...equs.values()].map((e) => e.text), startExpr || ''].join(' ');
  for (const l of lines.filter((x) => x.labelsOnly)) {
    for (const name of l.labelsOnly) {
      if (!new RegExp(`(^|[^\w])${name}($|[^\w])`).test(referenced)) {
        warnings.push({ line: l.lineNo, message: `'${name}' is an unused label on its own line. Did you mean an instruction?` });
      }
    }
  }

  for (const a of asserts) {
    try {
      if (!evaluate(a.text, makeLookup(0), registers)) warnings.push({ line: a.line, message: `;assert ${a.text} is false under these rules` });
    } catch (e) {
      warnings.push({ line: a.line, message: `;assert could not be checked: ${e.message}` });
    }
  }

  if (!errors.length && instructions.length === 0) errors.push({ line: 0, message: 'program has no instructions' });
  if (instructions.length > cfg.maxLength) {
    errors.push({ line: 0, message: `program is ${instructions.length} instructions long; the limit is ${cfg.maxLength}` });
  }
  if (instructions.length && (start < 0 || start >= instructions.length)) {
    warnings.push({ line: startLine, message: `start offset ${start} is outside the program` });
  }

  errors.sort((x, y) => x.line - y.line);
  return {
    name: meta.name.trim() || 'Unnamed',
    author: meta.author.trim() || 'Anonymous',
    strategy: meta.strategy.join('\n'),
    dialect: meta.dialect,
    start,
    instructions,
    errors,
    warnings,
    ok: errors.length === 0,
  };
}

// Render instructions back to canonical Redcode (relative, signed fields).
// `sizeOrSettings`: the core size, or full settings (a torus battlefield
// shows off-axis fields as vectors such as [0,1]).
export function listing(warrior, sizeOrSettings = DEFAULT_SETTINGS.coreSize) {
  const geo = typeof sizeOrSettings === 'object' ? makeGeometry({ ...DEFAULT_SETTINGS, ...sizeOrSettings }) : null;
  const coreSize = typeof sizeOrSettings === 'object' ? (sizeOrSettings.coreSize ?? DEFAULT_SETTINGS.coreSize) : sizeOrSettings;
  const signed = geo ? geo.format : (v) => {
    let x = ((v % coreSize) + coreSize) % coreSize;
    if (x > coreSize / 2) x -= coreSize;
    return x;
  };
  const out = [`;name ${warrior.name}`, `;author ${warrior.author}`];
  if (warrior.strategy) for (const s of warrior.strategy.split('\n')) out.push(`;strategy ${s}`);
  out.push(`        ORG ${warrior.start}`);
  for (const i of warrior.instructions) {
    const opm = `${i.op}.${i.mod}`.padEnd(7);
    out.push(`        ${opm} ${i.aMode}${signed(i.a)}, ${i.bMode}${signed(i.b)}`);
  }
  return out.join('\n');
}
