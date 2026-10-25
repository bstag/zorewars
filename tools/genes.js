// Genetics for the evolver: genomes, a gene pool cut from existing warriors,
// mutation operators, and repairs chosen by how a warrior loses.
//
// A genome is { start, code: [{ op, mod, aMode, a, bMode, b }] } — a warrior
// without names. Operators only append or prepend code (or edit in place), so
// the relative addresses inside the old code keep working.

export const MAXLEN = 40;
export const ROLES = ['paper', 'stone', 'scan', 'clear', 'imp'];

const rnd = (n) => Math.floor(Math.random() * n);
export const pick = (a) => a[rnd(a.length)];
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
export function makeGenePool(sources, { slices = 6 } = {}) {
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
// geo (a plane or volume's geometry, see src/engine/geometry.js) adds
// operators that treat a number as the point it is: plain retunes mostly
// move along x, so on their own they rarely reach other rows or layers.
export function makeOperators(units, geo = null) {
  // Every ICWS'94 opcode the evolver can switch to, plus TRN (our turn
  // instruction, an assembler error on the ring) on a plane or volume.
  const OPCODES = ['MOV', 'ADD', 'SUB', 'MUL', 'DIV', 'MOD', 'JMP', 'JMZ', 'JMN', 'DJN', 'SPL', 'SEQ', 'SNE', 'SLT', 'NOP', 'DAT', ...(geo ? ['TRN'] : [])];
  const ops = {
    retune(g) {   // change one number: nudge it, or try a known-good step
      const c = clone(g); const i = pick(c.code); const f = Math.random() < 0.5 ? 'a' : 'b';
      i[f] = Math.random() < 0.5 ? i[f] + rnd(9) - 4 : (Math.random() < 0.5 ? pick(NUMS) * (1 + rnd(4)) : rnd(8000));
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
    const field = (g) => { const c = clone(g); const i = pick(c.code); return [c, i, Math.random() < 0.5 ? 'a' : 'b']; };
    Object.assign(ops, {
      axis(g) {     // nudge one axis of a vector, or set it anywhere along that axis
        const [c, i, f] = field(g); const v = geo.decode(i[f]); const k = rnd(dims);
        v[k] = Math.random() < 0.6 ? v[k] + (1 + rnd(3)) * (Math.random() < 0.5 ? -1 : 1) : rnd(size[k]);
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
        const v = [0, 0, 0]; v[rnd(dims)] = Math.random() < 0.5 ? -1 : 1;
        Object.assign(i, { op: 'TRN', mod: 'B', aMode: '$', a: geo.encode(...v), bMode: '$', b: 0 });
        return c;
      },
      lift(g) {     // give a plain step a part along another axis: off the row, through the layers
        const [c, i, f] = field(g); const v = geo.decode(i[f]); const k = 1 + rnd(dims - 1);
        v[k] = (1 + rnd(size[k] - 1)) * (Math.random() < 0.5 ? -1 : 1);
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
export function makeChooser(opNames) {
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
      let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
      for (const o of opNames) if ((r -= w[o]) <= 0) return o;
      return opNames[0];
    },
    record(op, better) { credit[op].tries++; if (better) credit[op].wins++; },
  };
}

export function crossover(x, y, maxLen = MAXLEN) {
  const cx = rnd(x.code.length + 1), cy = rnd(y.code.length + 1);
  const code = [...x.code.slice(0, cx), ...y.code.slice(cy)].slice(0, maxLen).map((i) => ({ ...i }));
  return code.length ? { start: Math.min(x.start, code.length - 1), code } : clone(x);
}

export function toWarrior(g, name = 'Evolved', coreSize = 8000) {
  const norm = (v) => ((v % coreSize) + coreSize) % coreSize;
  return { ok: true, name, author: 'ZoreWars Evolver', start: g.start, instructions: g.code.map((i) => ({ ...i, a: norm(i.a), b: norm(i.b) })) };
}

export function toRedcode(g, { name = 'Evolved', strategy = '', coreSize = 8000, geo = null } = {}) {
  const sv = (v) => { v = ((v % coreSize) + coreSize) % coreSize; return geo ? geo.format(v) : v > coreSize / 2 ? v - coreSize : v; };
  return [
    ';redcode-94', `;name ${name}`, ';author ZoreWars Evolver', ...(strategy ? [`;strategy ${strategy}`] : []),
    `        ORG     ${g.start}`,
    ...g.code.map((i) => `        ${(i.op + '.' + i.mod).padEnd(8)}${i.aMode}${sv(i.a)}, ${i.bMode}${sv(i.b)}`),
    '        END', '',
  ].join('\n');
}
