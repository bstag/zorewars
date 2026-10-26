// Redcode assembler: turns ICWS'94-style source text into instruction objects.
//
// Supported: labels (with or without a trailing colon), EQU constants,
// ORG / END start addresses, arithmetic expressions with pMARS-style
// registers (a=...; a-z read 0 until set), EQUs as text substitution (also
// multi-line EQU macros), FOR / ROF macro loops with & concatenation, all '94
// opcodes plus the P-space opcodes LDP / STP, every modifier and addressing
// mode, ;name / ;author / ;strategy metadata and ;assert checks. Text before
// a ;redcode line is ignored, as in pMARS.

import { OPCODES, OPCODE_ALIASES, MODIFIERS, MODES, DEFAULT_SETTINGS, defaultModifier, pSpaceSizeFor } from './constants.js';
import { makeGeometry } from './geometry.js';

// Vector literals [x,y] / [x,y,z] (torus battlefields) are encoded with the
// battlefield being assembled for; set by assemble() while it runs.
let encodeVector = null;

export const PSEUDO = new Set(['ORG', 'END', 'EQU', 'PIN']);

// ICWS'88 Redcode, as pMARS -8 accepts it (checked against pMARS for every
// opcode and pair of modes): eleven opcodes, four modes, no modifiers, and
// per-opcode limits on immediate operands.
const OPS88 = new Set(['DAT', 'MOV', 'ADD', 'SUB', 'JMP', 'JMZ', 'JMN', 'DJN', 'CMP', 'SPL', 'SLT']);
export function check88(raw, mod, aMode, bMode) {
  if (!OPS88.has(raw)) return `${raw} is not an ICWS'88 opcode`;
  if (mod) return `modifiers (.${mod}) are not ICWS'88`;
  for (const m of [aMode, bMode]) if (!'#$@<'.includes(m)) return `the '${m}' mode is not ICWS'88 (only # $ @ <)`;
  if (raw === 'DAT' && !(/[#<]/.test(aMode) && /[#<]/.test(bMode))) return 'DAT operands must be # or <';
  if (['MOV', 'ADD', 'SUB', 'CMP'].includes(raw) && bMode === '#') return `${raw}'s B-operand can't be immediate`;
  if (['JMP', 'JMZ', 'JMN', 'DJN', 'SPL'].includes(raw) && aMode === '#') return `${raw}'s A-operand can't be immediate`;
  return null;
}

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
        registers.set(/^[A-Za-z]$/.test(t.v) ? t.v.toLowerCase() : t.v, v);   // pMARS's a-z registers ignore case
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

// pMARS's EQU is text substitution: with 'step equ (a)/(b)', '2*step' is
// 2*(a)/(b), not 2*((a)/(b)), and '-gate' with 'gate equ src-step' is
// -src-step. So expressions are evaluated with every EQU written in as text.
// `textOf(name)` gives an EQU's text, or undefined for other names.
export function inlineEquText(text, textOf, depth = 0) {
  if (depth > 32) throw new Error('an EQU refers to itself');
  let changed = false;
  const out = text.replace(/(?<![\w.&])[A-Za-z_]\w*(?!\w)/g, (n) => {
    const t = textOf(n);
    if (t === undefined) return n;
    changed = true;
    return t;
  });
  return changed ? inlineEquText(out, textOf, depth + 1) : out;
}

export function parseOperand(text, equs) {
  // pMARS's EQU is text substitution, so an EQU that starts with a mode
  // ('x equ #5'), directly or through other EQUs ('y equ x+1'), gives the
  // operand its mode: 'y' is '#5+1'.
  let probe = text;
  for (let depth = 0; depth < 10; depth++) {
    const lead = /^([A-Za-z_]\w*)(.*)$/s.exec(probe);
    if (!lead || !equs?.has(lead[1])) break;
    probe = equs.get(lead[1]).text.trim() + lead[2];
    if (MODES.includes(probe[0])) { text = probe; break; }
  }
  const c = text[0];
  if (MODES.includes(c)) return { mode: c, expr: text.slice(1).trim() };
  return { mode: '$', expr: text };
}

export const FOR_RE = /^((?:[A-Za-z_]\w*:?\s+)*)for\s+(.+)$/i;
export const ROF_RE = /^rof\b/i;

// True if a line of code (comment removed) assembles to an instruction.
function isInstruction(code) {
  for (const tok of code.replace(/:(?=\S)/g, ': ').split(/\s+/)) {
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

// Multi-line EQU (pMARS): 'name EQU line1' followed by lines that are just
// 'EQU lineN' defines a macro, and the name standing alone where an
// instruction would go expands to those lines (labels before it stay, on a
// line of their own). Definitions become blank lines, so line numbers hold.
function expandMacros(raw) {
  const macros = new Map();
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const c = codePart(raw[i].text);
    const head = /^([A-Za-z_]\w*):?\s+equ\s+(.*)$/i.exec(c);
    if (head) {
      const body = [head[2]];
      let j = i + 1;
      for (; j < raw.length; j++) {
        const cj = codePart(raw[j].text);
        if (!cj && raw[j].text.includes(';')) continue;     // a comment between the lines
        const m = /^equ\s+(.*)$/i.exec(cj);
        if (!m) break;
        body.push(m[1]);
      }
      if (body.length > 1) {
        macros.set(head[1], body);
        for (let k = i; k < j; k++) out.push({ ...raw[k], text: '' });
        i = j - 1;
        continue;
      }
    }
    const toks = c.replace(/:(?=\S)/g, ': ').split(/\s+/).filter(Boolean);
    const name = toks.at(-1);
    if (macros.has(name) && toks.slice(0, -1).every((t) => /^[A-Za-z_]\w*:?$/.test(t) && !opcodeOf(t.replace(/:$/, '')))) {
      if (toks.length > 1) out.push({ ...raw[i], text: toks.slice(0, -1).join(' ') });
      for (const text of macros.get(name)) out.push({ ...raw[i], text });
      continue;
    }
    out.push(raw[i]);
  }
  return out;
}

// Expand FOR / ROF blocks into plain lines. Each output line keeps the
// source line number it came from; `expanded` marks lines produced by a loop.
//   [labels] [counter] FOR count ... ROF
// The counter (the last label) runs from 1 to count. In the body, the
// counter's name is replaced by its value, and &counter by the value padded
// to two digits, so bomb&i becomes bomb01, bomb02, ... "FOR 0" is the
// customary way to comment out a block.
function preprocess(source, constants, errors, warnings, registers, cfg) {
  let raw = source.split(/\r?\n/).map((text, i) => ({ text, lineNo: i + 1, expanded: false }));
  // The first ';redcode' line starts the program (text before it is ignored)
  // and the next one ends it.
  const marker = (l) => /^\s*;redcode/i.test(l.text);
  const start = raw.findIndex(marker);
  if (start > 0) raw = raw.slice(start);
  const next = raw.findIndex((l, k) => k > 0 && marker(l));
  if (start >= 0 && next > 0) raw = raw.slice(0, next);
  // A backslash just before the end of a line joins the next line, unless
  // the line has a comment.
  for (let k = 0; k < raw.length - 1; k++) {
    if (/\\$/.test(raw[k].text) && !raw[k].text.includes(';')) {
      raw[k] = { ...raw[k], text: raw[k].text.slice(0, -1) + raw[k + 1].text };
      raw.splice(k + 1, 1);
      k--;
    }
  }
  raw = expandMacros(raw);

  const equs = new Map();
  const out = [];
  let total = 0;
  // 3. Labels already placed, and how many instructions so far (CURLINE): a
  // FOR count may use them ('for bomb-bomber+1'), relative to the FOR's place.
  const labelPos = new Map();
  let instrCount = 0;
  const emit = (l) => {
    const c = codePart(l.text);
    if (/^[A-Za-z_]\w*:?\s+equ\b/i.test(c)) { out.push(l); return; }
    const names = [];
    let op = null;
    for (const t of c.replace(/:(?=\S)/g, ': ').split(/\s+/).filter(Boolean)) {
      const n = t.replace(/:$/, '');
      op = /^[A-Za-z_][\w.]*$/.test(n) ? opcodeOf(n) : null;
      if (op || !/^[A-Za-z_]\w*$/.test(n)) break;
      names.push(n);
    }
    // A line that defines a label again is left out entirely, with a
    // warning, as in pMARS (so a loop body with a fixed label emits it once).
    const dup = names.find((n) => labelPos.has(n));
    if (dup) {
      warnings.push({ line: l.lineNo, message: `duplicate label '${dup}': this line is ignored, as in pMARS` });
      return;
    }
    for (const n of names) labelPos.set(n, instrCount);
    // CURLINE in ORG and END is the position where they stand.
    if (op && (op.op === 'ORG' || op.op === 'END')) l = { ...l, text: l.text.replace(/(?<![\w&.])CURLINE(?!\w)/g, String(instrCount)) };
    out.push(l);
    if (isInstruction(c)) instrCount++;
  };
  const lookup = (name, seen = new Set()) => {
    if (equs.has(name) && !seen.has(name)) {
      return evaluate(equs.get(name), (n) => lookup(n, new Set([...seen, name])), registers);
    }
    if (labelPos.has(name)) return labelPos.get(name) - instrCount;
    if (name === 'CURLINE') return instrCount;           // uppercase only, as in pMARS
    const up = name.toUpperCase();
    if (up in constants) return constants[up];
    if (/^[A-Za-z]$/.test(name)) return registers.get(name.toLowerCase()) ?? 0;   // pMARS registers a-z
    throw new Error(`'${name}' must be a constant or a label defined before the FOR`);
  };
  // A standalone ';assert' line runs where it stands, once per loop copy it
  // is in, with labels counted from that position; it can set registers. A
  // false one is an error under hill rules (as in pMARS), else a warning, so
  // ring warriors can still play on other battlefields.
  const runAssert = (l) => {
    const m = /^\s*;\s*assert\b(.*)$/i.exec(l.text);
    if (!m) return;
    let ok;
    try {
      ok = evaluate(inlineEquText(m[1], (n) => equs.get(n)), lookup, registers);
    } catch (e) {
      warnings.push({ line: l.lineNo, message: `;assert could not be checked: ${e.message}` });
      return;
    }
    if (!ok) (cfg.assertErrors ? errors : warnings).push({ line: l.lineNo, message: `;assert${m[1]} is false under these rules` });
  };
  // 4. pMARS's EQU is text substitution, so an EQU that uses the loop's
  // counter ('Lookat equ look+8*(qscan-1)') or pastes it ('length equ
  // (data&i-pap&i+1)') takes the counter's value in each copy. Such EQUs are
  // written into the body's operands before the counter is filled in.
  const usesCounter = (text, counter, seen = new Set()) => new RegExp(`(?<!\\w)&?${counter}(?!\\w)`).test(text)
    || [...text.matchAll(/[A-Za-z_]\w*/g)].some(([n]) => equs.has(n) && !seen.has(n) && usesCounter(equs.get(n), counter, new Set([...seen, n])));
  const inlineEqus = (text, counter) => {
    const semi = text.indexOf(';');
    const code = semi >= 0 ? text.slice(0, semi) : text;
    const op = [...code.matchAll(/\S+/g)].find((m) => /^[A-Za-z_][\w.]*$/.test(m[0]) && opcodeOf(m[0]));
    if (!op) return text;
    const at = op.index + op[0].length;
    let tail = code.slice(at);
    for (let pass = 0; pass < 10; pass++) {
      const next = tail.replace(/(?<![\w&.])[A-Za-z_]\w*(?![\w&])/g, (n) => (equs.has(n) && usesCounter(equs.get(n), counter) ? equs.get(n) : n));
      if (next === tail) break;
      tail = next;
    }
    return code.slice(0, at) + tail + (semi >= 0 ? text.slice(semi) : '');
  };
  const substitute = (text, counter, k) => inlineEqus(text, counter)
    .replace(new RegExp(`&${counter}(?!\\w)`, 'g'), String(k).padStart(2, '0'))
    .replace(new RegExp(`(?<![\\w&.])${counter}(?!\\w)`, 'g'), String(k));

  // pMARS's EQU is text substitution, so an EQU can stand for a whole
  // instruction ('d01 equ spl 0,1' ... 'd01'). Expand such a name where an
  // opcode is expected, so CURLINE and FOR counts see the instruction.
  const expandEquInstruction = (l, c) => {
    const toks = c.trim().split(/\s+/);
    for (let t = 0; t < toks.length; t++) {
      const name = toks[t].replace(/:$/, '');
      if (equs.has(name) && isInstruction(equs.get(name))) {
        return { ...l, text: [...toks.slice(0, t), equs.get(name), ...toks.slice(t + 1)].join(' ') };
      }
      if (!/^[A-Za-z_]\w*:?$/.test(toks[t]) || opcodeOf(name)) break;
    }
    return l;
  };

  function run(lines) {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const c = codePart(l.text);
      if (!c) runAssert(l);
      const eq = /^([A-Za-z_]\w*)\s+equ\s+(.+)$/i.exec(c);
      if (eq) equs.set(eq[1], eq[2]);
      const m = FOR_RE.exec(c);
      if (!m) {
        if (ROF_RE.test(c)) errors.push({ line: l.lineNo, message: 'ROF without a matching FOR' });
        else emit(eq ? l : expandEquInstruction(l, c));
        continue;
      }
      let depth = 1;
      let j = i + 1;
      for (; j < lines.length; j++) {
        const cj = codePart(lines[j].text);
        if (FOR_RE.test(cj)) depth++;
        else if (ROF_RE.test(cj) && --depth === 0) break;
      }
      const names = m[1].trim().split(/\s+/).filter(Boolean).map((n) => n.replace(/:$/, ''));
      const counter = names.pop();
      if (names.length) emit({ text: names.join(' '), lineNo: l.lineNo, expanded: l.expanded });
      let count = 0;
      try {
        count = evaluate(inlineEquText(m[2], (n) => equs.get(n)), lookup, registers);
      } catch (e) {
        errors.push({ line: l.lineNo, message: `FOR count: ${e.message}` });
      }
      // A FOR with no ROF: pMARS emits the rest of the program once (if the
      // count is positive) and warns.
      if (j >= lines.length) {
        if (count > 0) {
          warnings.push({ line: l.lineNo, message: 'FOR without a matching ROF: the rest is used once, as in pMARS' });
          run(lines.slice(i + 1).map((b) => ({ lineNo: b.lineNo, expanded: true, text: counter ? substitute(b.text, counter, 1) : b.text })));
        }
        return;
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
    VERSION: 95,                        // pMARS 0.9.5
    WARRIORS: cfg.warriors ?? 2,
  };

  // ---- Pass 1: parse lines, collect labels and EQUs ----
  const labels = new Map(); // name -> instruction index
  const equs = new Map();   // name -> { text, line }
  const lines = [];         // instruction lines
  let orgExpr = null, endExpr = null;
  let endLabels = [];
  let endSeen = false;
  let orgLine = 0, endLine = 0;

  const registers = new Map(); // pMARS-style a=... assignments, from expansion on
  const srcLines = preprocess(source, constants, errors, warnings, registers, cfg);
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
        else if (key !== 'assert') meta[key] = m[2];      // asserts run in preprocess
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
      if (!pending.length) warnings.push({ line: lineNo, message: 'EQU without a name is ignored' });
      for (const name of pending) {
        if (equs.has(name)) errors.push({ line: lineNo, message: `EQU '${name}' is defined twice` });
        equs.set(name, { text: rest, line: lineNo });
      }
      continue;
    }
    if (opInfo.op === 'ORG') {
      if (cfg.dialect === '88') errors.push({ line: lineNo, message: "ICWS'88: ORG is not ICWS'88; give the start on the END line (END start)" });
      orgExpr = rest; orgLine = lineNo;              // a later ORG replaces an earlier one
      continue;
    }
    if (opInfo.op === 'PIN') {
      warnings.push({ line: lineNo, message: 'PIN (shared P-space) is not supported; this warrior gets private P-space' });
      continue;
    }
    if (opInfo.op === 'END') {
      if (rest) { endExpr = rest; endLine = lineNo; }
      endLabels = pending.map((name) => ({ name, lineNo }));   // e.g. 'last end start'
      endSeen = true;
      break;
    }
    if (opInfo.mod && !MODIFIERS.includes(opInfo.mod)) {
      errors.push({ line: lineNo, message: `unknown modifier '.${opInfo.mod}'` });
      continue;
    }
    lines.push({ labels: pending, op: opInfo.op, raw: opInfo.raw, mod: opInfo.mod, operands: splitOperands(rest), lineNo });
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
  // A label on the END line itself (as in 'last end start') is the address
  // just past the last instruction, as in pMARS; many hill warriors use it.
  for (const { name, lineNo } of endLabels) {
    if (labels.has(name) || equs.has(name)) errors.push({ line: lineNo, message: `duplicate label '${name}'` });
    labels.set(name, instrLines.length);
  }
  // Labels after the last instruction: before an END line they are the
  // address just past the last instruction, like a label on the END line;
  // with no END, pMARS discards them, and so do we.
  if (endSeen) {
    for (const name of trailingLabels) {
      if (labels.has(name) || equs.has(name)) errors.push({ line: 0, message: `duplicate label '${name}'` });
      labels.set(name, instrLines.length);
    }
  }
  for (const name of endSeen ? [] : trailingLabels) {
    const line = lines.filter((l) => l.labelsOnly?.includes(name)).at(-1)?.lineNo ?? 0;
    warnings.push({ line, message: `label '${name}' comes after the last instruction and is discarded, as in pMARS. Use '${name} EQU (finalLabel+1)' instead.` });
  }

  // ---- Pass 2: evaluate operands ----
  const equText = (n) => equs.get(n)?.text.trim();
  const registerWarned = new Set();
  const makeLookup = (idx, stack = new Set()) => function lookup(name) {
    if (labels.has(name)) return labels.get(name) - idx;
    if (equs.has(name)) {
      if (stack.has(name)) throw new Error(`EQU '${name}' refers to itself`);
      const next = new Set(stack); next.add(name);
      return evaluate(equs.get(name).text, makeLookup(idx, next), registers);
    }
    if (name === 'CURLINE') return idx;                  // uppercase only, as in pMARS
    const up = name.toUpperCase();
    if (up in constants) return constants[up];
    if (registers.has(name)) return registers.get(name);
    // pMARS's registers a-z (either case) read 0 until set: 'mov f, 0' is
    // legal there. Warn once, since it is more often a typo'd label.
    if (/^[A-Za-z]$/.test(name)) {
      const r = name.toLowerCase();
      if (registers.has(r)) return registers.get(r);
      if (!registerWarned.has(r)) {
        registerWarned.add(r);
        warnings.push({ line: 0, message: `'${name}' isn't a label, so it is read as pMARS register ${r} (0 until set)` });
      }
      return 0;
    }
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
    } else if (l.op === 'TRN' && !geo) {
      errors.push({ line: l.lineNo, message: 'TRN (turn) needs a torus battlefield, where code can flow along any axis: choose a Plane battlefield in Rules (CLI: --torus 100x80)' });
      return;
    } else if (ops.length === 1) {
      // As in pMARS, only these opcodes may omit the B operand (and TRN).
      if (l.op === 'DAT') { aOp = { mode: '#', expr: '0' }; bOp = parseOperand(ops[0], equs); }
      else if (['JMP', 'SPL', 'NOP', 'TRN'].includes(l.op)) { aOp = parseOperand(ops[0], equs); bOp = { mode: '$', expr: '0' }; }
      else {
        errors.push({ line: l.lineNo, message: `${l.op} needs two operands (only DAT, JMP, SPL and NOP may have one)` });
        return;
      }
    } else {
      aOp = parseOperand(ops[0], equs); bOp = parseOperand(ops[1], equs);
    }
    let a, b;
    try { a = evaluate(inlineEquText(aOp.expr, equText), lookup, registers); } catch (e) { errors.push({ line: l.lineNo, message: `A-operand: ${e.message}` }); return; }
    try { b = evaluate(inlineEquText(bOp.expr, equText), lookup, registers); } catch (e) { errors.push({ line: l.lineNo, message: `B-operand: ${e.message}` }); return; }
    if (cfg.dialect === '88') {
      const bad = check88(l.raw, l.mod, aOp.mode, bOp.mode);
      if (bad) { errors.push({ line: l.lineNo, message: `ICWS'88: ${bad}` }); return; }
    }
    if (cfg.pSpace === false && (l.op === 'LDP' || l.op === 'STP')) {
      errors.push({ line: l.lineNo, message: `${l.op}: these rules have no P-space` });
      return;
    }
    const mod = l.mod || defaultModifier(l.op, aOp.mode, bOp.mode);
    instructions.push({ op: l.op, mod, aMode: aOp.mode, a, bMode: bOp.mode, b, line: l.lineNo });
  });

  // The start: ORG's, if it is not 0; otherwise END's. (pMARS ignores a
  // nonzero END after a nonzero ORG, with a warning.)
  const entry = (expr, line) => {
    if (!expr) return 0;
    try { return evaluate(inlineEquText(expr, equText), makeLookup(0), registers); } catch (e) { errors.push({ line, message: `start: ${e.message}` }); return 0; }
  };
  const org = entry(orgExpr, orgLine), end = entry(endExpr, endLine);
  if (org && end && org !== end) warnings.push({ line: endLine, message: 'END gives a different start from ORG; ORG wins, as in pMARS' });
  let start = org || end;

  // A lone word is a legal label, but an unused one is usually a typo'd opcode.
  const referenced = [...instrLines.flatMap((l) => l.operands), ...[...equs.values()].map((e) => e.text), orgExpr || '', endExpr || ''].join(' ');
  for (const l of lines.filter((x) => x.labelsOnly)) {
    for (const name of l.labelsOnly) {
      if (!new RegExp(`(^|[^\w])${name}($|[^\w])`).test(referenced)) {
        warnings.push({ line: l.lineNo, message: `'${name}' is an unused label on its own line. Did you mean an instruction?` });
      }
    }
  }


  if (!errors.length && instructions.length === 0) errors.push({ line: 0, message: 'program has no instructions' });
  if (geo && instructions.length > geo.maxCodeLength && instructions.length <= cfg.maxLength) {
    errors.push({ line: 0, message: `program is ${instructions.length} instructions long; on a ${geo.X}-wide torus the limit is ${geo.maxCodeLength} (half a row), so that every label stays on its own row` });
  }
  if (instructions.length > cfg.maxLength) {
    errors.push({ line: 0, message: `program is ${instructions.length} instructions long; the limit is ${cfg.maxLength}` });
  }
  if (instructions.length && (start < 0 || start >= instructions.length)) {
    warnings.push({ line: orgLine || endLine, message: `start offset ${start} is outside the program` });
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
