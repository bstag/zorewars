// An independent reference interpreter for torus battlefields, written from
// the rules in design/3d-battlefield.md rather than from src/engine/vm.js.
// It keeps cells by (x, y, z) position and fields as (x, y, z) tuples, and
// gets the number <-> point mapping from a table built by enumerating every
// point, not from geometry.js's arithmetic. scripts/plane-fuzz.js runs random
// programs through both and compares them after every step.
//
// Not covered: P-space (LDP/STP) and the end-of-round cycle budget.

const MODE_CHARS = ['#', '$', '*', '@', '{', '<', '}', '>'];

export function makeReference({ sizeX: X, sizeY: Y = 1, sizeZ: Z = 1, maxProcesses = 8000 }) {
  const N = X * Y * Z;
  const half = (m) => Math.floor(m / 2);
  const mod = (v, m) => ((v % m) + m) % m;
  // A field's value is a point in balanced form: x in [-X/2, X/2), and so on.
  // number(t) = x + X*(y + Y*z) mod N; the inverse comes from a table.
  const number = ([x, y, z]) => mod(x + X * (y + Y * z), N);
  const toTuple = new Array(N);
  for (let z = -half(Z); z < Z - half(Z); z++) {
    for (let y = -half(Y); y < Y - half(Y); y++) {
      for (let x = -half(X); x < X - half(X); x++) {
        const n = number([x, y, z]);
        if (toTuple[n]) throw new Error('the mapping is not one-to-one');
        toTuple[n] = [x, y, z];
      }
    }
  }
  const tuple = (n) => toTuple[mod(n, N)];
  const balance = ([x, y, z]) => [mod(x + half(X), X) - half(X), mod(y + half(Y), Y) - half(Y), mod(z + half(Z), Z) - half(Z)];
  // Positions are cells: (x, y, z) with each component 0..size-1.
  const posOf = (cellNumber) => { const [x, y, z] = tuple(cellNumber); return [mod(x, X), mod(y, Y), mod(z, Z)]; };
  const key = ([x, y, z]) => `${x},${y},${z}`;
  const move = ([px, py, pz], [dx, dy, dz]) => [mod(px + dx, X), mod(py + dy, Y), mod(pz + dz, Z)];
  const cellNumber = (pos) => number(balance(pos));
  // Field arithmetic, per axis, on the 0..size-1 representatives (MUL/DIV/MOD).
  const perAxis = (a, b, f) => balance([f(a[0], b[0], X), f(a[1], b[1], Y), f(a[2], b[2], Z)]);
  const plus = (a, b) => perAxis(a, b, (p, q) => p + q);
  const minus = (a, b) => perAxis(a, b, (p, q) => p - q);
  const times = (a, b) => perAxis(a, b, (p, q, m) => mod(p, m) * mod(q, m));
  const divide = (a, b, isMod) => {
    const sizes = [X, Y, Z];
    if (b.every((q, k) => mod(q, sizes[k]) === 0)) return null;      // all-zero divisor
    return balance(a.map((p, k) => {
      const m = sizes[k], pp = mod(p, m), qq = mod(b[k], m);
      if (qq === 0) return pp;                                          // that axis is left alone
      return isMod ? pp % qq : Math.floor(pp / qq);
    }));
  };
  // Counting (DJN, < > { }) treats a field as a plain number.
  const count = (t, d) => tuple(number(t) + d);
  const isZero = (t) => t[0] === 0 && t[1] === 0 && t[2] === 0;
  const HEAD = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

  const cells = new Map();                       // key(pos) -> instruction (fields as tuples)
  const empty = () => ({ op: 'DAT', mod: 'F', aMode: '$', a: [0, 0, 0], bMode: '$', b: [0, 0, 0] });
  const at = (pos) => { const k = key(pos); if (!cells.has(k)) cells.set(k, empty()); return cells.get(k); };
  const warriors = [];
  let turn = 0;

  function load(programs, cellPositions) {
    programs.forEach((w, i) => {
      const base = posOf(cellPositions[i]);
      w.instructions.forEach((ins, k) => {
        cells.set(key(move(base, [k, 0, 0])), { op: ins.op, mod: ins.mod, aMode: ins.aMode, a: tuple(ins.a), bMode: ins.bMode, b: tuple(ins.b) });
      });
      warriors.push({ queue: [{ pos: move(base, [w.start, 0, 0]), h: 0 }], alive: true });
    });
  }

  // Operand evaluation (ICWS'94): returns the target position; pre-decrement
  // happens now, post-increment is returned to be applied after the snapshot.
  function operand(mode, field, pc) {
    if (mode === '#') return { pos: pc, post: null };
    const p = move(pc, field);
    if (mode === '$') return { pos: p, post: null };
    const cell = at(p);
    const useA = mode === '*' || mode === '{' || mode === '}';
    if (mode === '{') cell.a = count(cell.a, -1);
    if (mode === '<') cell.b = count(cell.b, -1);
    const target = move(p, useA ? cell.a : cell.b);
    const post = mode === '}' ? { cell, f: 'a' } : mode === '>' ? { cell, f: 'b' } : null;
    return { pos: target, post };
  }
  const bump = (post) => { if (post) post.cell[post.f] = count(post.cell[post.f], 1); };

  function step() {
    const w = warriors[turn];
    const proc = w.queue.shift();
    const pc = proc.pos;
    const ir = { ...at(pc), a: at(pc).a, b: at(pc).b };   // instruction register
    const A = operand(ir.aMode, ir.a, pc);
    const src = { ...at(A.pos) };                           // A snapshot, before its post-increment
    bump(A.post);
    const B = operand(ir.bMode, ir.b, pc);
    const dst = at(B.pos);
    const bA = dst.a, bB = dst.b;                           // B snapshot
    bump(B.post);
    const heading = HEAD[proc.h];
    const next = move(pc, heading), skip = move(next, heading);
    const push = (pos, h = proc.h) => { if (w.queue.length < maxProcesses) w.queue.push({ pos, h }); };
    const m = ir.mod;
    const arith = (f) => {
      let ok = true;
      const set = (fld, v) => { if (v === null) ok = false; else dst[fld] = v; };
      if (m === 'A') set('a', f(bA, src.a));
      else if (m === 'B') set('b', f(bB, src.b));
      else if (m === 'AB') set('b', f(bB, src.a));
      else if (m === 'BA') set('a', f(bA, src.b));
      else if (m === 'X') { set('a', f(bA, src.b)); set('b', f(bB, src.a)); }
      else { set('a', f(bA, src.a)); set('b', f(bB, src.b)); }
      if (ok) push(next);
    };
    switch (ir.op) {
      case 'DAT': break;
      case 'MOV':
        if (m === 'A') dst.a = src.a; else if (m === 'B') dst.b = src.b;
        else if (m === 'AB') dst.b = src.a; else if (m === 'BA') dst.a = src.b;
        else if (m === 'F') { dst.a = src.a; dst.b = src.b; }
        else if (m === 'X') { dst.a = src.b; dst.b = src.a; }
        else { Object.assign(dst, { op: src.op, mod: src.mod, aMode: src.aMode, bMode: src.bMode, a: src.a, b: src.b }); }
        push(next);
        break;
      case 'ADD': arith(plus); break;
      case 'SUB': arith(minus); break;
      case 'MUL': arith(times); break;
      case 'DIV': arith((p, q) => divide(p, q, false)); break;
      case 'MOD': arith((p, q) => divide(p, q, true)); break;
      case 'JMP': push(A.pos); break;
      case 'JMZ': case 'JMN': {
        const z = m === 'A' || m === 'BA' ? isZero(bA) : m === 'B' || m === 'AB' ? isZero(bB) : isZero(bA) && isZero(bB);
        push((ir.op === 'JMZ') === z ? A.pos : next);
        break;
      }
      case 'DJN': {
        let nz;
        if (m === 'A' || m === 'BA') { nz = !isZero(count(bA, -1)); dst.a = count(dst.a, -1); }
        else if (m === 'B' || m === 'AB') { nz = !isZero(count(bB, -1)); dst.b = count(dst.b, -1); }
        else { nz = !isZero(count(bA, -1)) || !isZero(count(bB, -1)); dst.a = count(dst.a, -1); dst.b = count(dst.b, -1); }
        push(nz ? A.pos : next);
        break;
      }
      case 'SPL': push(next); push(A.pos); break;
      case 'SEQ': case 'SNE': {
        const same = (p, q) => number(p) === number(q);
        let eq;
        if (m === 'A') eq = same(src.a, bA); else if (m === 'B') eq = same(src.b, bB);
        else if (m === 'AB') eq = same(src.a, bB); else if (m === 'BA') eq = same(src.b, bA);
        else if (m === 'F') eq = same(src.a, bA) && same(src.b, bB);
        else if (m === 'X') eq = same(src.a, bB) && same(src.b, bA);
        else eq = same(src.a, bA) && same(src.b, bB) && src.op === dst.op && src.mod === dst.mod && src.aMode === dst.aMode && src.bMode === dst.bMode;
        push((ir.op === 'SEQ') === eq ? skip : next);
        break;
      }
      case 'SLT': {                               // compares the fields as plain numbers
        const lt = (p, q) => number(p) < number(q);
        let r;
        if (m === 'A') r = lt(src.a, bA); else if (m === 'B') r = lt(src.b, bB);
        else if (m === 'AB') r = lt(src.a, bB); else if (m === 'BA') r = lt(src.b, bA);
        else if (m === 'X') r = lt(src.a, bB) && lt(src.b, bA);
        else r = lt(src.a, bA) && lt(src.b, bB);
        push(r ? skip : next);
        break;
      }
      case 'NOP': push(next); break;
      case 'TRN': {                               // face along A: the axis with the largest part
        const d = balance([A.pos[0] - pc[0], A.pos[1] - pc[1], A.pos[2] - pc[2]]);
        const mag = d.map(Math.abs);
        let h = proc.h;
        if (mag.some((v) => v > 0)) {
          const axis = mag[0] >= mag[1] && mag[0] >= mag[2] ? 0 : mag[1] >= mag[2] ? 1 : 2;
          h = axis * 2 + (d[axis] > 0 ? 0 : 1);
        }
        push(move(pc, HEAD[h]), h);
        break;
      }
      default: throw new Error(`reference: ${ir.op} is not covered`);
    }
    if (w.queue.length === 0) w.alive = false;
    // The turn passes to the next living warrior.
    for (let k = 1; k <= warriors.length; k++) {
      const c = (turn + k) % warriors.length;
      if (warriors[c].alive) { turn = c; break; }
    }
  }

  // Snapshot in the VM's terms: cell numbers and field numbers.
  function snapshot() {
    const core = new Map();
    for (const [k, ins] of cells) {
      const pos = k.split(',').map(Number);
      const isEmpty = ins.op === 'DAT' && ins.mod === 'F' && ins.aMode === '$' && ins.bMode === '$' && isZero(ins.a) && isZero(ins.b);
      if (!isEmpty) core.set(cellNumber(pos), `${ins.op}.${ins.mod} ${ins.aMode}${number(ins.a)} ${ins.bMode}${number(ins.b)}`);
    }
    return { core, queues: warriors.map((w) => w.queue.map((p) => `${cellNumber(p.pos)}/${p.h}`)), alive: warriors.map((w) => w.alive) };
  }

  return { load, step, snapshot, turnOf: () => turn, MODE_CHARS };
}
