// Redcode -> JavaScript / Python converter.
//
// Produces readable generator programs: numeric EQUs become real constants,
// FOR / ROF blocks become real loops, labels and comments are kept. Every
// conversion is verified by compiling it and comparing the result with the
// original, instruction by instruction. If the most readable form doesn't
// match exactly, simpler forms are tried, down to copying each Redcode line
// verbatim with raw(), which always matches.

import { opcodeOf, splitOperands, tokenizeExpr, FOR_RE, ROF_RE } from './assembler.js';
import { MODES, MODIFIERS } from './constants.js';

const BUILTINS = ['CORESIZE', 'MAXPROCESSES', 'MAXCYCLES', 'MAXLENGTH', 'MINDISTANCE'];
const HELPER = { '#': 'imm', '$': 'dir', '@': 'ind', '*': 'aind', '<': 'predec', '{': 'apredec', '>': 'postinc', '}': 'apostinc' };
const API = ['name', 'author', 'strategy', 'label', 'org', 'equ', 'comment', 'raw', 'curline', 'render',
  ...Object.values(HELPER), 'dat', 'mov', 'add', 'sub', 'mul', 'div', 'mod', 'jmp', 'jmz', 'jmn', 'djn', 'spl',
  'slt', 'seq', 'sne', 'nop', 'ldp', 'stp', 'cmp', ...BUILTINS];
const JS_RESERVED = new Set([...API, 'pad2', 'Math', 'String', 'Number', 'break', 'case', 'catch', 'class', 'const',
  'continue', 'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'false', 'finally', 'for',
  'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'null', 'return', 'super', 'switch', 'this',
  'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'await', 'enum', 'static',
  'implements', 'interface', 'package', 'private', 'protected', 'public', 'arguments', 'eval', 'undefined', 'NaN', 'Infinity']);
const PY_RESERVED = new Set([...API, 'math', 'int', 'range', 'print', 'len', 'str', 'and', 'as', 'assert', 'async',
  'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'False', 'finally', 'for',
  'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'None', 'nonlocal', 'not', 'or', 'pass', 'raise',
  'return', 'True', 'try', 'while', 'with', 'yield', 'match', 'case', 'type']);

// ---------------------------------------------------------------- parsing

function parse(source) {
  let lines = source.split(/\r?\n/);
  const start = lines.findIndex((l) => /^\s*;\s*redcode/i.test(l));
  if (start > 0) lines = lines.slice(start);
  let i = 0;
  let ended = false;

  function block(insideFor) {
    const nodes = [];
    while (i < lines.length && !ended) {
      const raw = lines[i++];
      const semi = raw.indexOf(';');
      const code = (semi >= 0 ? raw.slice(0, semi) : raw).trim();
      const comment = semi >= 0 ? raw.slice(semi + 1).trim() : '';
      if (!code) {
        if (!comment) { nodes.push({ type: 'blank' }); continue; }
        const m = /^(name|author|strategy|assert)\b\s*(.*)$/i.exec(comment);
        if (m) nodes.push({ type: 'meta', key: m[1].toLowerCase(), value: m[2].trim(), raw });
        else if (/^redcode/i.test(comment)) continue; // ;redcode headers mean nothing in a generator
        else nodes.push({ type: 'comment', text: comment });
        continue;
      }
      if (ROF_RE.test(code)) {
        if (insideFor) return nodes;
        nodes.push({ type: 'raw', raw });
        continue;
      }
      const f = FOR_RE.exec(code);
      if (f) {
        const names = f[1].trim().split(/\s+/).filter(Boolean).map((n) => n.replace(/:$/, ''));
        const counter = names.pop() ?? null;
        const header = raw;
        const body = block(true);
        nodes.push({ type: 'for', labels: names, counter, count: f[2].trim(), body, comment, raw: header });
        continue;
      }
      const pending = [];
      let rest = code;
      let info = null;
      for (;;) {
        const m = /^([A-Za-z_][\w.&]*)(:?)\s*/.exec(rest); // & allows FOR-built labels like bomb&i
        if (!m) break;
        const inf = m[2] ? null : opcodeOf(m[1]);
        if (inf) { info = inf; rest = rest.slice(m[0].length); break; }
        pending.push(m[1]);
        rest = rest.slice(m[0].length);
      }
      if (!info) {
        nodes.push(pending.length && !rest ? { type: 'labels', names: pending, comment } : { type: 'raw', raw });
        continue;
      }
      if (info.op === 'EQU') { nodes.push({ type: 'equ', names: pending, expr: rest.trim(), comment }); continue; }
      if (info.op === 'ORG') { nodes.push({ type: 'org', expr: rest.trim(), comment }); continue; }
      if (info.op === 'END') { nodes.push({ type: 'end', expr: rest.trim(), comment }); ended = true; break; }
      if (info.op === 'PIN' || (info.mod && !MODIFIERS.includes(info.mod))) { nodes.push({ type: 'raw', raw }); continue; }
      nodes.push({ type: 'ins', labels: pending, op: info.raw.toLowerCase(), mod: info.mod, operands: splitOperands(rest), comment, raw });
    }
    return nodes;
  }
  return block(false);
}

// ---------------------------------------------------------------- expressions

// Parse +, -, *, /, %, unary minus and parentheses into a tree. Anything
// else (comparisons, register assignment) returns null: keep it as Redcode.
function parseExpr(text) {
  let tokens;
  try { tokens = tokenizeExpr(text); } catch { return null; }
  let i = 0;
  const peek = () => tokens[i];
  function primary() {
    const t = tokens[i++];
    if (!t) throw 0;
    if (t.t === 'num') return { k: 'num', v: t.v };
    if (t.t === 'id') {
      if (peek()?.v === '=') throw 0;
      return { k: 'id', v: t.v };
    }
    if (t.v === '(') { const e = sum(); if (tokens[i++]?.v !== ')') throw 0; return e; }
    if (t.v === '-') return { k: 'neg', a: primary() };
    if (t.v === '+') return primary();
    throw 0;
  }
  function term() {
    let a = primary();
    while (['*', '/', '%'].includes(peek()?.v)) { const op = tokens[i++].v; a = { k: 'bin', op, a, b: primary() }; }
    return a;
  }
  function sum() {
    let a = term();
    while (['+', '-'].includes(peek()?.v)) { const op = tokens[i++].v; a = { k: 'bin', op, a, b: term() }; }
    return a;
  }
  try {
    const e = sum();
    return i === tokens.length ? e : null;
  } catch { return null; }
}

const idsOf = (node, out = new Set()) => {
  if (!node) return out;
  if (node.k === 'id') out.add(node.v);
  if (node.a) idsOf(node.a, out);
  if (node.b) idsOf(node.b, out);
  return out;
};

const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2 };

// Print a numeric expression tree in the target language. `name(id)` maps a
// Redcode identifier to the program's variable or expression.
function printExpr(node, lang, name, uses, parentPrec = 0) {
  switch (node.k) {
    case 'num': return String(node.v);
    case 'id': return name(node.v);
    case 'neg': {
      const inner = printExpr(node.a, lang, name, uses, 3);
      return /^\d/.test(inner) ? `-${inner}` : `-(${inner})`.replace(/^-\((\w+)\)$/, '-$1');
    }
    case 'bin': {
      const p = PREC[node.op];
      if (node.op === '/') {
        const a = printExpr(node.a, lang, name, uses, p), b = printExpr(node.b, lang, name, uses, p + 1);
        return lang === 'python' ? `int(${a} / ${b})` : `Math.trunc(${a} / ${b})`;
      }
      if (node.op === '%' && lang === 'python') {
        uses.math = true;
        return `int(math.fmod(${printExpr(node.a, lang, name, uses)}, ${printExpr(node.b, lang, name, uses)}))`;
      }
      const a = printExpr(node.a, lang, name, uses, p);
      const b = printExpr(node.b, lang, name, uses, p + 1); // left-associative
      const s = `${a} ${node.op} ${b}`;
      return p < parentPrec ? `(${s})` : s;
    }
  }
  return '0';
}

// ---------------------------------------------------------------- emitting

function emitProgram(tree, lang, { numeric, loops }) {
  const py = lang === 'python';
  const C = py ? '#' : '//';
  const reserved = py ? PY_RESERVED : JS_RESERVED;
  const varName = (n) => (/^[A-Za-z_]\w*$/.test(n) && !reserved.has(n) ? n : `${n.replace(/\W/g, '_')}_`);
  const str = (s) => JSON.stringify(s);
  const uses = { math: false, pad2: false };
  const body = [];
  const meta = [];
  const stringTexts = []; // Redcode text left in strings: decides which EQUs still need equ()
  let origin = null;

  // Top-level EQUs: numeric ones (only numbers, built-ins and other numeric
  // EQUs) become constants of the program; the rest stay as Redcode EQUs.
  const equs = [];
  for (const n of tree) if (n.type === 'equ') for (const nm of n.names) equs.push({ name: nm, expr: n.expr, comment: n.comment });
  const numericConsts = new Map(); // redcode name -> {ast}
  if (numeric) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of equs) {
        if (numericConsts.has(e.name)) continue;
        const ast = parseExpr(e.expr);
        if (!ast) continue;
        const ids = [...idsOf(ast)];
        if (ids.every((id) => BUILTINS.includes(id) || (numericConsts.has(id) && id !== e.name))) {
          numericConsts.set(e.name, { ast });
          changed = true;
        }
      }
    }
  }

  // Render an operand. `scope` maps loop counters to their loop variables.
  function operand(text, scope) {
    let mode = null;
    let expr = text.trim();
    if (MODES.includes(expr[0])) { mode = expr[0]; expr = expr.slice(1).trim(); }
    const wrap = (v) => (mode ? `${HELPER[mode]}(${v})` : v);
    const ast = numeric ? parseExpr(expr) : null;
    if (ast) {
      const ids = [...idsOf(ast)];
      const ok = ids.every((id) => BUILTINS.includes(id) || numericConsts.has(id) || scope.has(id) || id.toUpperCase() === 'CURLINE');
      if (ok) {
        const name = (id) => (scope.has(id) ? scope.get(id) : numericConsts.has(id) ? varName(id) : id.toUpperCase() === 'CURLINE' ? 'curline()' : id);
        return wrap(printExpr(ast, lang, name, uses));
      }
    }
    return wrap(textLiteral(expr, scope));
  }

  // A string of Redcode text, with loop counters substituted (template /
  // f-string) the way FOR substitutes them: &i -> two digits, i -> value.
  function textLiteral(text, scope) {
    stringTexts.push(text);
    const counters = [...scope.keys()].filter((c) => new RegExp(`(?<![\\w.])&?${c}(?!\\w)`).test(text));
    if (!counters.length) return str(text);
    // Escape for the literal first, then splice in the counters.
    let out = py ? text.replace(/[\\"]/g, '\\$&').replace(/[{}]/g, (c) => c + c) : text.replace(/[`\\$]/g, '\\$&');
    for (const c of counters) {
      const v = scope.get(c);
      const amp = new RegExp(`&${c}(?!\\w)`, 'g');
      const bare = new RegExp(`(?<![\\w&.\\u0001\\u0002])${c}(?!\\w)`, 'g');
      // Placeholders first, so one substitution can't touch the other.
      out = out.replace(amp, `\u0001${v}\u0003`).replace(bare, `\u0002${v}\u0003`);
    }
    if (py) out = out.replace(/\u0001(\w+)\u0003/g, '{$1:02d}').replace(/\u0002(\w+)\u0003/g, '{$1}');
    else {
      if (out.includes('\u0001')) uses.pad2 = true;
      out = out.replace(/\u0001(\w+)\u0003/g, '${pad2($1)}').replace(/\u0002(\w+)\u0003/g, '${$1}');
    }
    return py ? `f"${out}"` : `\`${out}\``;
  }

  const withComment = (code, comment, indent) => {
    const line = indent + code;
    return comment ? `${line.padEnd(Math.max(44, line.length + 2))}${C} ${comment}` : line;
  };
  const labelCalls = (labels, scope) => labels.map((l) => `label(${textLiteral(l, scope)})`);

  let loopId = 0;
  function emitNodes(nodes, scope, indent) {
    for (const n of nodes) {
      switch (n.type) {
        case 'blank':
          if (body.length && body.at(-1) !== '') body.push('');
          break;
        case 'comment':
          body.push(`${indent}${C} ${n.text}`);
          break;
        case 'meta':
          if (scope.size) { body.push(`${indent}${C} ${n.key} ${n.value}`); break; }
          if (n.key === 'assert') { body.push(`${indent}raw(${str(`;assert ${n.value}`)})${py ? '' : ';'}`); stringTexts.push(n.value); }
          else meta.push({ key: n.key, value: n.value });
          break;
        case 'equ':
          if (scope.size) { // inside a loop: stays a Redcode EQU
            for (const nm of n.names) body.push(withComment(`equ(${textLiteral(nm, scope)}, ${textLiteral(n.expr, scope)})${py ? '' : ';'}`, n.comment, indent));
          }
          break; // top-level EQUs are emitted in the header
        case 'org':
        case 'end':
          if (n.expr) origin = n.expr;
          break;
        case 'labels':
          body.push(withComment(`${labelCalls(n.names, scope).join('; ')}${py ? '' : ';'}`, n.comment, indent));
          break;
        case 'raw':
          body.push(`${indent}raw(${textLiteral(n.raw.trim(), scope)})${py ? '' : ';'}`);
          break;
        case 'ins': {
          const call = `${n.op}${n.mod ? `.${n.mod.toLowerCase()}` : ''}(${n.operands.map((o) => operand(o, scope)).join(', ')})`;
          const parts = [...labelCalls(n.labels, scope), call];
          body.push(withComment(`${parts.join('; ')}${py ? '' : ';'}`, n.comment, indent));
          break;
        }
        case 'for': {
          const countAst = parseExpr(n.count);
          const countIds = countAst ? [...idsOf(countAst)] : null;
          const countOk = loops && countAst && countIds.every((id) => BUILTINS.includes(id) || numericConsts.has(id) || scope.has(id) || id.toUpperCase() === 'CURLINE');
          if (!countOk) { // keep it as a Redcode FOR loop (outer counters substituted)
            body.push(`${indent}raw(${textLiteral(n.raw.trim(), scope)})${py ? '' : ';'}`);
            emitNodes(n.body, scope, indent);
            body.push(`${indent}raw("rof")${py ? '' : ';'}`);
            break;
          }
          if (n.labels.length) body.push(`${indent}${labelCalls(n.labels, scope).join('; ')}${py ? '' : ';'}`);
          if (countAst.k === 'num' && countAst.v === 0) {
            body.push(`${indent}${C} (a FOR 0 block: disabled in the original)`);
            break;
          }
          const v = n.counter ? varName(n.counter) : `_k${loopId}`;
          loopId++;
          const name = (id) => (scope.has(id) ? scope.get(id) : numericConsts.has(id) ? varName(id) : id.toUpperCase() === 'CURLINE' ? 'curline()' : id);
          let count = printExpr(countAst, lang, name, uses);
          const inner = new Map(scope);
          if (n.counter) inner.set(n.counter, v);
          const step = py ? '    ' : '  ';
          if (/curline\(\)/.test(count)) { // evaluate once, before the loop
            const c = `count${loopId}`;
            body.push(`${indent}${py ? '' : 'const '}${c} = ${count}${py ? '' : ';'}`);
            count = c;
          }
          body.push(withComment(py ? `for ${v} in range(1, ${count} + 1):` : `for (let ${v} = 1; ${v} <= ${count}; ${v}++) {`, n.comment, indent));
          const before = body.length;
          emitNodes(n.body, inner, indent + step);
          if (py && body.length === before) body.push(`${indent}${step}pass`);
          if (!py) body.push(`${indent}}`);
          break;
        }
      }
    }
  }
  emitNodes(tree, new Map(), '');

  // Header: metadata, constants, and the EQUs Redcode text still uses.
  const out = [];
  const nameMeta = meta.find((m) => m.key === 'name');
  out.push(`${C} ${nameMeta ? nameMeta.value : 'Warrior'}, converted from Redcode by ZoreWars.`);
  out.push(`${C} Verified: compiles to exactly the same instructions as the original.`);
  if (py) {
    out.push('from zorewars import *');
    if (uses.math) out.push('import math');
  }
  out.push('');
  for (const m of meta) if (m.key !== 'assert') out.push(`${m.key}(${str(m.value)})${py ? '' : ';'}`);
  if (meta.length) out.push('');
  if (uses.pad2) out.push('const pad2 = (n) => String(n).padStart(2, "0");', '');
  const textBlob = stringTexts.join(' ');
  // Names built with & (bomb&i) can refer to any constant, so keep them all.
  const pastes = /&\w/.test(textBlob);
  const used = (nm) => pastes || new RegExp(`(^|[^\\w])${nm}($|[^\\w])`).test(textBlob) ||
    equs.some((e) => !numericConsts.has(e.name) && new RegExp(`(^|[^\\w])${nm}($|[^\\w])`).test(e.expr));
  // numeric constants in dependency order
  const done = new Set();
  const order = [];
  const visit = (nm) => {
    if (done.has(nm)) return;
    done.add(nm);
    for (const id of idsOf(numericConsts.get(nm).ast)) if (numericConsts.has(id)) visit(id);
    order.push(nm);
  };
  for (const nm of numericConsts.keys()) visit(nm);
  const header = [];
  for (const nm of order) {
    const e = equs.find((x) => x.name === nm);
    const val = printExpr(numericConsts.get(nm).ast, lang, (id) => (numericConsts.has(id) ? varName(id) : id), uses);
    header.push(withComment(`${py ? '' : 'const '}${varName(nm)} = ${val}${py ? '' : ';'}`, e.comment, ''));
    if (used(nm)) header.push(`equ(${str(nm)}, ${varName(nm)})${py ? '' : ';'}`);
  }
  for (const e of equs) {
    if (numericConsts.has(e.name)) continue;
    header.push(withComment(`equ(${str(e.name)}, ${str(e.expr)})${py ? '' : ';'}`, e.comment, ''));
  }
  if (uses.math && !out.includes('import math')) out.splice(out.indexOf('from zorewars import *') + 1, 0, 'import math');
  if (header.length) out.push(...header, '');
  if (origin) {
    const ast = numeric ? parseExpr(origin) : null;
    const plain = ast && [...idsOf(ast)].every((id) => numericConsts.has(id) || BUILTINS.includes(id));
    out.push(`org(${plain ? printExpr(ast, lang, (id) => (numericConsts.has(id) ? varName(id) : id), uses) : str(origin)})${py ? '' : ';'}`);
  }
  while (body[0] === '') body.shift();
  out.push(...body);
  while (out.at(-1) === '') out.pop();
  return out.join('\n') + '\n';
}

// Last resort: every line verbatim through raw(), which always matches.
function emitVerbatim(source, lang) {
  const py = lang === 'python';
  const C = py ? '#' : '//';
  const lines = [`${C} Converted from Redcode by ZoreWars: the original lines, copied verbatim.`];
  if (py) lines.push('from zorewars import *');
  lines.push('');
  let src = source.split(/\r?\n/);
  const start = src.findIndex((l) => /^\s*;\s*redcode/i.test(l));
  if (start > 0) src = src.slice(start);
  for (const l of src) {
    const m = /^\s*;\s*(name|author|strategy)\b\s*(.*)$/i.exec(l);
    if (m) lines.push(`${m[1].toLowerCase()}(${JSON.stringify(m[2].trim())})${py ? '' : ';'}`);
    else if (/^\s*;\s*redcode/i.test(l) || !l.trim()) continue;
    else lines.push(`raw(${JSON.stringify(l)})${py ? '' : ';'}`);
  }
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------- public API

// Candidate conversions, most readable first.
export function conversionCandidates(source, lang) {
  const tree = parse(source);
  return [
    { level: 'readable', code: emitProgram(tree, lang, { numeric: true, loops: true }) },
    { level: 'loops kept, expressions as Redcode', code: emitProgram(tree, lang, { numeric: false, loops: true }) },
    { level: 'structured, FOR kept as Redcode', code: emitProgram(tree, lang, { numeric: false, loops: false }) },
    { level: 'verbatim', code: emitVerbatim(source, lang) },
  ];
}

// True when two compiled warriors are the same program.
export function sameProgram(a, b, coreSize = 8000) {
  const n = (v) => ((v % coreSize) + coreSize) % coreSize;
  return a.ok && b.ok && a.start === b.start && a.name === b.name && a.author === b.author &&
    a.instructions.length === b.instructions.length &&
    a.instructions.every((x, k) => {
      const y = b.instructions[k];
      return x.op === y.op && x.mod === y.mod && x.aMode === y.aMode && x.bMode === y.bMode && n(x.a) === n(y.a) && n(x.b) === n(y.b);
    });
}

// Convert and verify. `toRedcode(code)` runs a candidate and returns the
// Redcode it prints (sync or async); `compile` compiles Redcode.
export async function convertWarrior(source, lang, { compile, toRedcode, settings = {} }) {
  const original = compile(source, 'redcode', settings);
  if (!original.ok) throw new Error(`the original doesn't assemble: ${original.errors[0]?.message}`);
  const tried = [];
  for (const cand of conversionCandidates(source, lang)) {
    let ok = false;
    try {
      const red = await toRedcode(cand.code);
      ok = sameProgram(original, compile(red, 'redcode', settings), settings.coreSize);
    } catch (e) {
      tried.push(`${cand.level}: ${e.message}`);
    }
    if (ok) {
      const code = cand.level === 'readable' ? cand.code
        : cand.code.replace(/^(\/\/|#) Verified:.*$/m, `$1 Verified: compiles to exactly the same instructions (${cand.level} form).`);
      return { code, level: cand.level, instructions: original.instructions.length, tried };
    }
    tried.push(`${cand.level}: compiled differently`);
  }
  throw new Error(`no conversion compiled to the same program (${tried.join('; ')})`);
}
