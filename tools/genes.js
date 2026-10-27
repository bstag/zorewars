// Genetics for the evolver: genomes, a gene pool cut from existing warriors,
// mutation operators, and repairs chosen by how a warrior loses.
//
// A genome is { start, code: [{ op, mod, aMode, a, bMode, b }] } — a warrior
// without names. Grafts append or prepend code to preserve relative addresses;
// trimming and splice crossover can break them, so offspring are checked solo.

import { defaultModifier } from '../src/engine/constants.js';

export const MAXLEN = 40;
export const ROLES = ['paper', 'stone', 'scan', 'clear', 'imp'];

export const pick = (a, random = Math.random) => a[Math.floor(random() * a.length)];
export const clone = (g) => ({ start: g.start, code: g.code.map((i) => ({ ...i })) });
export const fits = (g, maxLen = MAXLEN) => g.code.length >= 1 && g.code.length <= maxLen;
export const genomeOf = (w) => ({ start: w.start, code: w.instructions.map(({ op, mod, aMode, a, bMode, b }) => ({ op, mod, aMode, a, bMode, b })) });

// Which strategy a library category (or warrior name) belongs to.
export function roleOf(text = '') {
  const t = text.toLowerCase();
  if (/paper|replicat|silk|self-mover|mice/.test(t)) return 'paper';
  if (/clear|vampire|sweep/.test(t)) return 'clear';
  if (/imp/.test(t)) return 'imp';
  if (/scan|seek|one-shot|gate|blitz/.test(t)) return 'scan';
  if (/stone|bomb|stun|dwarf/.test(t)) return 'stone';
  return null;
}

// Units to graft: whole small warriors plus random slices, grouped by role.
export function makeGenePool(sources, { slices = 6, random = Math.random } = {}) {
  const rnd = (n) => Math.floor(random() * n);
  const units = Object.fromEntries(ROLES.map((r) => [r, []]));
  for (const { w, role } of sources) {
    if (!role || !units[role]) continue;
    const g = genomeOf(w);
    if (g.code.length <= 24) units[role].push(g);
    for (let k = 0; k < slices; k++) {
      const len = Math.min(g.code.length, 3 + rnd(8));
      const at = rnd(g.code.length - len + 1);
      units[role].push({ start: 0, code: g.code.slice(at, at + len) });
    }
  }
  for (const r of ROLES) if (!units[r].length) delete units[r];
  return units;
}

function prepend(g, first) {
  const c = clone(g);
  if (g.start === 0) c.code.unshift(first);
  else {
    c.code.unshift(first, { op: 'JMP', mod: 'B', aMode: '$', a: g.start + 1, bMode: '$', b: 0 });
    if (first.a > 1) first.a++;
  }
  c.start = 0;
  return c;
}

// Append a unit and start a process in it with an SPL in front.
export function graft(g, u) {
  const spl = { op: 'SPL', mod: 'B', aMode: '$', a: 0, bMode: '$', b: 0 };
  const c = prepend(g, spl);
  spl.a = c.code.length + u.start;
  c.code.push(...clone(u).code);
  c.code[0] = spl;
  return c;
}

const NUMS = [1, 2, 3, 4, 5, 7, 8, 13, 16, 97, 1471, 2365, 2667, 3044, 3364];
const OPS_ALL = ['MOV', 'ADD', 'SUB', 'MUL', 'DIV', 'MOD', 'JMP', 'JMZ', 'JMN', 'DJN', 'SPL', 'SEQ', 'SNE', 'SLT', 'NOP', 'DAT'];
const MODS_ALL = ['A', 'B', 'AB', 'BA', 'F', 'X', 'I'];
const MODES_ALL = ['#', '$', '@', '<', '>', '*', '{', '}'];

// ICWS'88 (pMARS -8, the '88 tournament): eleven opcodes, # $ @ < only,
// limits on immediates and no modifiers, so each instruction runs with the
// modifier the '94 standard gives that '88 code. legal88 bends an evolved
// instruction into that, in place; the evolver applies it to every child.
const OPS88 = ['DAT', 'MOV', 'ADD', 'SUB', 'JMP', 'JMZ', 'JMN', 'DJN', 'SEQ', 'SPL', 'SLT'];
const OP_TO88 = { MUL: 'ADD', DIV: 'SUB', MOD: 'SUB', SNE: 'SEQ', NOP: 'JMP', TRN: 'JMP', LDP: 'MOV', STP: 'MOV' };
const MODE_TO88 = { '>': '<', '{': '<', '}': '<', '*': '@' };
export function legal88(i) {
  if (!OPS88.includes(i.op)) i.op = OP_TO88[i.op] ?? 'MOV';
  i.aMode = MODE_TO88[i.aMode] ?? i.aMode;
  i.bMode = MODE_TO88[i.bMode] ?? i.bMode;
  if (i.op === 'DAT') { if (!'#<'.includes(i.aMode)) i.aMode = '#'; if (!'#<'.includes(i.bMode)) i.bMode = '#'; }
  if (['MOV', 'ADD', 'SUB', 'SEQ'].includes(i.op) && i.bMode === '#') i.bMode = '$';
  if (['JMP', 'JMZ', 'JMN', 'DJN', 'SPL'].includes(i.op) && i.aMode === '#') i.aMode = '$';
  i.mod = defaultModifier(i.op, i.aMode, i.bMode);
  return i;
}

// A random program for evolving from scratch: random opcodes, modifiers and
// modes; each number is a small step (within the program, mostly) or any
// number at all (on a torus: any point). Nothing from the library.
export function randomGenome(len, { coreSize = 8000, geo = null, random = Math.random, pSpace = false } = {}) {
  const rnd = (n) => Math.floor(random() * n);
  const pick = (a) => a[rnd(a.length)];
  const ops = [...OPS_ALL, ...(geo ? ['TRN'] : [])];
  if (pSpace) ops.push('LDP', 'STP');
  const num = () => (random() < 0.6 ? rnd(2 * len + 9) - len - 4 : rnd(coreSize));
  const code = Array.from({ length: len }, () => ({ op: pick(ops), mod: pick(MODS_ALL), aMode: pick(MODES_ALL), a: num(), bMode: pick(MODES_ALL), b: num() }));
  return { start: rnd(len), code };
}
// geo (a plane or volume's geometry, see src/engine/geometry.js) adds
// operators that treat a number as the point it is: plain retunes mostly
// move along x, so on their own they rarely reach other rows or layers.
export function makeOperators(units, geo = null, { scratch = false, coreSize = 8000, random = Math.random, pSpace = false } = {}) {
  const rnd = (n) => Math.floor(random() * n);
  const pick = (a) => a[rnd(a.length)];
  // Every ICWS'94 opcode the evolver can switch to, plus TRN (our turn
  // instruction, an assembler error on the ring) on a plane or volume.
  const OPCODES = [...OPS_ALL, ...(geo ? ['TRN'] : []), ...(pSpace ? ['LDP', 'STP'] : [])];
  const ops = {
    retune(g) {   // change one number: nudge it, or try a known-good step
      const c = clone(g); const i = pick(c.code); const f = random() < 0.5 ? 'a' : 'b';
      // From scratch there are no known-good steps: a nudge or any number.
      i[f] = random() < 0.5 ? i[f] + rnd(9) - 4 : (!scratch && random() < 0.5 ? pick(NUMS) * (1 + rnd(4)) : rnd(coreSize));
      return c;
    },
    trim(g) {     // delete an instruction: smaller is harder to find
      if (g.code.length < 3) return null;
      const c = clone(g); const k = rnd(c.code.length); c.code.splice(k, 1);
      if (c.start > k) c.start--;
      c.start = Math.min(c.start, c.code.length - 1);
      return c;
    },
    tweak(g) {    // change an opcode, modifier or mode
      const c = clone(g); const i = pick(c.code);
      const r = rnd(4);
      if (r === 0) i.op = pick(OPCODES);
      else if (r === 1) i.mod = pick(['A', 'B', 'AB', 'BA', 'F', 'X', 'I']);
      else if (r === 2) i.aMode = pick(['#', '$', '@', '<', '>', '*', '{', '}']);
      else i.bMode = pick(['#', '$', '@', '<', '>', '*', '{', '}']);
      return c;
    },
    procs(g) {    // SPL 1 in front doubles the processes
      return prepend(g, { op: 'SPL', mod: 'B', aMode: '$', a: 1, bMode: '$', b: 0 });
    },
  };
  if (geo) {
    const dims = geo.Z > 1 ? 3 : 2, size = [geo.X, geo.Y, geo.Z];
    const field = (g) => { const c = clone(g); const i = pick(c.code); return [c, i, random() < 0.5 ? 'a' : 'b']; };
    Object.assign(ops, {
      axis(g) {     // nudge one axis of a vector, or set it anywhere along that axis
        const [c, i, f] = field(g); const v = geo.decode(i[f]); const k = rnd(dims);
        v[k] = random() < 0.6 ? v[k] + (1 + rnd(3)) * (random() < 0.5 ? -1 : 1) : rnd(size[k]);
        i[f] = geo.encode(...v);
        return c;
      },
      rotate(g) {   // swap two axes of a vector: a row attack becomes a column or depth attack
        const [c, i, f] = field(g); const v = geo.decode(i[f]); const a = rnd(dims); const b = (a + 1 + rnd(dims - 1)) % dims;
        [v[a], v[b]] = [v[b], v[a]];
        i[f] = geo.encode(...v);
        return c;
      },
      turn(g) {     // make an instruction a TRN that faces along one axis: code flows down a column or through the layers
        const c = clone(g); const i = pick(c.code);
        const v = [0, 0, 0]; v[rnd(dims)] = random() < 0.5 ? -1 : 1;
        Object.assign(i, { op: 'TRN', mod: 'B', aMode: '$', a: geo.encode(...v), bMode: '$', b: 0 });
        return c;
      },
      lift(g) {     // give a plain step a part along another axis: off the row, through the layers
        const [c, i, f] = field(g); const v = geo.decode(i[f]); const k = 1 + rnd(dims - 1);
        v[k] = (1 + rnd(size[k] - 1)) * (random() < 0.5 ? -1 : 1);
        i[f] = geo.encode(...v);
        return c;
      },
    });
  }
  for (const role of Object.keys(units)) ops[`graft_${role}`] = (g) => graft(g, pick(units[role]));
  return ops;
}

// Symptom (see diagnoseRounds) -> the operators that address it.
export const CURE = {
  suicide: ['retune', 'retune', 'trim', 'tweak', 'axis'],
  early: ['trim', 'procs', 'graft_paper'],
  late: ['graft_paper', 'procs'],
  converted: ['graft_paper', 'graft_clear', 'procs'],
  tie: ['graft_stone', 'graft_scan', 'graft_clear', 'retune', 'lift', 'rotate', 'turn'],
};

// Picks an operator from a warrior's symptoms, weighted by how often each
// operator has produced a child better than its parent so far.
export function makeChooser(opNames, random = Math.random) {
  const credit = Object.fromEntries(opNames.map((o) => [o, { tries: 2, wins: 1 }]));
  return {
    credit,
    choose(sym = {}) {
      const w = Object.fromEntries(opNames.map((o) => [o, 0.15]));
      const total = Object.values(sym).reduce((a, b) => a + b, 0) || 1;
      for (const [s, n] of Object.entries(sym)) {
        const cures = (CURE[s] || []).filter((o) => o in w);
        for (const o of cures) w[o] += ((n / total) / cures.length) * 3;
      }
      for (const o of opNames) w[o] *= 0.25 + credit[o].wins / credit[o].tries;
      let r = random() * Object.values(w).reduce((a, b) => a + b, 0);
      for (const o of opNames) if ((r -= w[o]) <= 0) return o;
      return opNames[0];
    },
    record(op, better) { credit[op].tries++; if (better) credit[op].wins++; },
  };
}

export function crossover(x, y, maxLen = MAXLEN, random = Math.random, { aligned = false } = {}) {
  const rnd = (n) => Math.floor(random() * n);
  if (aligned) {
    // Keep instruction positions aligned so inherited relative jumps and
    // pointers still refer to the same indices. Splicing unrelated offsets
    // is useful exploration in MAP-Elites but destroys most GA offspring.
    const cut = rnd(Math.min(x.code.length, y.code.length) + 1);
    const code = [...x.code.slice(0, cut), ...y.code.slice(cut)].slice(0, maxLen).map((i) => ({ ...i }));
    const start = x.start < cut ? x.start : y.start;
    return { start: Math.min(start, code.length - 1), code };
  }
  const cx = rnd(x.code.length + 1), cy = rnd(y.code.length + 1);
  const code = [...x.code.slice(0, cx), ...y.code.slice(cy)].slice(0, maxLen).map((i) => ({ ...i }));
  return code.length ? { start: Math.min(x.start, code.length - 1), code } : clone(x);
}

export function toWarrior(g, name = 'Evolved', coreSize = 8000) {
  const norm = (v) => ((v % coreSize) + coreSize) % coreSize;
  return { ok: true, name, author: 'ZoreWars Evolver', start: g.start, instructions: g.code.map((i) => ({ ...i, a: norm(i.a), b: norm(i.b) })) };
}

export function toRedcode(g, { name = 'Evolved', strategy = '', coreSize = 8000, geo = null, dialect = null } = {}) {
  const sv = (v) => { v = ((v % coreSize) + coreSize) % coreSize; return geo ? geo.format(v) : v > coreSize / 2 ? v - coreSize : v; };
  if (dialect === '88') {   // no modifiers, CMP for SEQ, and the start on the END line
    return [
      ';redcode', `;name ${name}`, ';author ZoreWars Evolver', ...(strategy ? [`;strategy ${strategy}`] : []),
      ...g.code.map((i, k) => `${k === g.start ? 'start' : ''}`.padEnd(8) + `${(i.op === 'SEQ' ? 'CMP' : i.op).padEnd(8)}${i.aMode}${sv(i.a)}, ${i.bMode}${sv(i.b)}`),
      '        END     start', '',
    ].join('\n');
  }
  return [
    ';redcode-94', `;name ${name}`, ';author ZoreWars Evolver', ...(strategy ? [`;strategy ${strategy}`] : []),
    `        ORG     ${g.start}`,
    ...g.code.map((i) => `        ${(i.op + '.' + i.mod).padEnd(8)}${i.aMode}${sv(i.a)}, ${i.bMode}${sv(i.b)}`),
    '        END', '',
  ].join('\n');
}
