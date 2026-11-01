// Seeded program grammar, independent of pMARS execution and campaign files.
import {mulberry32} from '../src/engine/index.js';
export function createProgramGenerator({seed:SEED,coreSize:CORE,rules:RULES}) {
const rng = mulberry32(SEED);
const r = (n) => Math.floor(rng() * n);
const pick = (a) => a[r(a.length)];
const chance = (p) => rng() < p;
// (No single-letter label that is also an assigned register: pMARS's
// handling of a name that is both isn't characterised; see the spec.)
const LABELS = ['top', 'mid', 'bot', 'ptr', 'x1', 'Top', 'aa', 'z'];
const EQUS = ['k', 'step', 'gap', 'K2', 'half', 'imm'];
const REGS = ['a', 'b', 'c', 'A', 'q'];
const CONSTS = ['CORESIZE', 'MAXLENGTH', 'MAXPROCESSES', 'MAXCYCLES', 'MINDISTANCE', 'VERSION', 'WARRIORS', 'PSPACESIZE', 'CURLINE'];
const OPS = ['+', '-', '*', '/', '%', '==', '!=', '<', '>', '<=', '>=', '&&', '||'];
const OPCODES = ['dat', 'mov', 'add', 'sub', 'mul', 'jmp', 'jmz', 'jmn', 'djn', 'spl', 'seq', 'sne', 'slt', 'nop', 'cmp', 'div', 'mod'];
const MODS = ['', '', '', '.a', '.b', '.ab', '.ba', '.f', '.x', '.i'];
const MODES = ['', '', '#', '$', '@', '*', '<', '>', '{', '}'];
const OPS88 = ['dat', 'mov', 'add', 'sub', 'jmp', 'jmz', 'jmn', 'djn', 'spl', 'cmp', 'slt'];

function expr(depth, scope) {
  if (depth <= 0 || chance(0.35)) {
    const k = r(10);
    if (k < 4) return chance(0.1) ? String(pick([-CORE - 1, -CORE, CORE - 1, CORE, CORE + 1])) : String(r(chance(0.2) ? 300 : 12) * (chance(0.15) ? -1 : 1));
    if (k < 6) return pick(LABELS);
    if (k === 6) return pick(scope.equs.length ? scope.equs : EQUS);
    if (k === 7) return pick(REGS);
    if (k === 8 && scope.counters.length) return chance(0.5) ? pick(scope.counters) : `${pick(LABELS)}&${pick(scope.counters)}`;
    return pick(CONSTS);
  }
  const k = r(10);
  if (k < 5) {
    const op = pick(OPS);
    const rhs = op === '/' || op === '%' ? (chance(0.85) ? String(1 + r(5)) : expr(depth - 1, scope)) : expr(depth - 1, scope);
    return `${expr(depth - 1, scope)}${chance(0.5) ? ' ' : ''}${op}${chance(0.5) ? ' ' : ''}${rhs}`;
  }
  if (k < 7) return `(${expr(depth - 1, scope)})`;
  if (k === 7) return `${pick(['-', '+', '!'])}${expr(depth - 1, scope)}`;
  if (k === 8) return `(${pick(REGS)}=${expr(depth - 1, scope)})`;
  return expr(depth - 1, scope);
}
function instruction(scope) {
  const label = chance(0.35) ? `${scope.counters.length && chance(0.4) ? `${pick(LABELS)}&${pick(scope.counters)}` : pick(LABELS)}${chance(0.3) ? ':' : ''} ` : '';
  // Mostly legal '88 instructions, with a deliberate minority of '94 forms
  // retained to exercise rejection rather than only testing valid syntax.
  const legal88 = RULES === '88' && chance(0.85);
  const op = pick(legal88 ? OPS88 : OPCODES);
  const mod = legal88 || op === 'cmp' ? '' : pick(MODS);
  const operand = (field) => {
    let modes = legal88 ? ['', '$', '#', '@', '<'] : MODES;
    if (legal88 && op === 'dat') modes = ['#', '<'];
    else if (legal88 && ((field === 'A' && ['jmp', 'jmz', 'jmn', 'djn', 'spl'].includes(op)) || (field === 'B' && ['mov', 'add', 'sub', 'cmp'].includes(op)))) modes = modes.filter(m => m !== '#');
    return `${pick(modes)}${expr(2, scope)}`;
  };
  const two = op === 'dat' ? chance(0.7) : !['jmp', 'spl', 'nop'].includes(op) || chance(0.6);
  return `${label}${op}${mod}${chance(0.1) ? '' : ' '} ${operand('A')}${two ? `, ${operand('B')}` : ''}`;
}
function block(scope, depth, lines) {
  const n = 1 + r(5);
  for (let i = 0; i < n; i++) {
    const k = r(20);
    if (k < 8) lines.push(instruction(scope));
    else if (k < 10) {                                           // EQU: a value, a mode, a chain, an instruction
      const name = pick(EQUS);
      const v = r(4);
      lines.push(`${name} equ ${v === 0 ? `#${expr(1, scope)}` : v === 1 ? instruction(scope).replace(/^\S+:?\s+(?=[a-z])/, '') : expr(2, scope)}`);
      scope.equs.push(name);
    } else if (k === 10) {                                       // multi-line EQU macro
      const name = `m${r(3)}`;
      lines.push(`${name} equ ${instruction({ ...scope, counters: [] }).replace(/^\S+:?\s+(?=[a-z])/, '')}`);
      if (chance(0.3)) lines.push('; between');
      // (No label in the macro's lines: pMARS records it at the definition, a
      // quirk ZoreWars doesn't model; see COMPLIANCE.md.)
      lines.push(` equ ${instruction({ ...scope, counters: [] }).replace(/^\S+:?\s+(?=[a-z])/, '')}`);
      lines.push(name);
    } else if (k < 13 && depth > 0) {                            // FOR block, maybe nested
      const counter = pick(['i', 'j', 'n', 'cnt']);
      const head = `${chance(0.3) ? `${pick(LABELS)} ` : ''}${chance(0.8) ? `${counter} ` : ''}for ${chance(0.6) ? String(r(4)) : expr(1, scope)}`;
      lines.push(head);
      block({ ...scope, counters: head.includes(`${counter} for`) ? [...scope.counters, counter] : scope.counters }, depth - 1, lines);
      if (chance(0.97)) lines.push('rof');
    } else if (k === 13) lines.push(`;assert ${chance(0.8) ? `${expr(1, scope)}${chance(0.5) ? '||1' : ''}` : '1'}`);
    else if (k === 14) lines.push(`${pick(LABELS)}${chance(0.5) ? ':' : ''}`);   // label on its own line
    else if (k === 15) lines.push(`org ${expr(1, scope)}`);
    else if (k === 16) lines.push(`; ${pick(['note', 'for 3', 'rof', 'equ 5'])}`);
    else if (k === 17) lines.push(`${instruction(scope)} ; ${pick(['comment', 'assert 0', 'x'])}`);
    else if (k === 18) { const t = instruction(scope); const at = t.indexOf(','); lines.push(at > 0 && chance(0.5) ? `${t.slice(0, at + 1)}\\` : t); if (at > 0) lines.push(t.slice(at + 1)); }
    else lines.push(instruction(scope));
  }
}
function generated() {
  const lines = [`;redcode-${RULES}`, ';name fuzz'];
  if (chance(0.9)) lines.push(';assert 1');
  block({ equs: [], counters: [] }, 2, lines);
  if (chance(0.7)) lines.push(`${chance(0.3) ? `${pick(LABELS)} ` : ''}end${chance(0.4) ? ` ${expr(1, { equs: [], counters: [] })}` : ''}`);
  return lines.join('\n') + '\n';
}
function mutated(SEEDS) {
  const lines = pick(SEEDS).replace(/\r/g, '').split('\n');
  for (let m = 1 + r(3); m > 0; m--) {
    const i = 1 + r(Math.max(1, lines.length - 1));
    const k = r(6);
    if (k === 0 && lines.length > 3) lines.splice(i, 1);
    else if (k === 1) lines.splice(i, 0, lines[i] ?? '');
    else if (k === 2) lines[i] = (lines[i] ?? '').replace(/\d+/, () => String(r(12)));
    else if (k === 3) lines.splice(i, 0, instruction({ equs: [], counters: [] }));
    else if (k === 4) lines[i] = (lines[i] ?? '').replace(/[-+*/]/, () => pick(['+', '-', '*', '/', '%']));
    else { const j = 1 + r(lines.length - 1); [lines[i], lines[j]] = [lines[j], lines[i]]; }
  }
  return lines.join('\n');
}

return {generated,instruction,pick,r,chance,mutated};
}
