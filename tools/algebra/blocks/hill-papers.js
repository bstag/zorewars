// Lockstep papers of the Koenigstuhl 94nop top 30 (docs/hill-top30/94nop.md,
// docs/hill-top30/block-gaps.md), each as a body a fan boot can deliver. The
// hill warriors were studied for the mechanism only; every line here is
// written from scratch (own layout, pointers and constants). Ring, '94.
//
// All three are run by PROCS processes that arrive together (a fan boot's N
// workers) and stay in lockstep: every process runs each line once a lap, so
// one MOV line copies PROCS cells.
//
//   loop-paper6     6 cells. A looping bombing paper: a lap starts PROCS
//                   processes in the next copy, copies the body there, drops
//                   one anti-imp DAT per process through a remote pointer and
//                   moves the next copy on.
//   stream-paper3   5 cells. Three copy streams a lap into one shared
//                   destination: the body, then the PROCS cells after it
//                   upward and the same cells downward (two source pointers),
//                   which leaves 2*PROCS empty cells behind every copy.
//   backcopy-paper  6 cells. Copies itself top cell first to descending
//                   addresses, starts the copy only when it is whole and lays
//                   PROCS anti-imp DATs directly below it, so a strip of
//                   copies and DAT rows grows downward.
//
// FAN 0 is the fan-boot member: nothing but the body, entered at its first
// cell by PROCS processes (fanboot N = PROCS). FAN 1 puts its own SPL fan in
// front so the block also runs alone. The watch refuses any other number of
// entrants, so FAN 0 outside a fan of PROCS processes fails the gate.
import { fanLines } from '../fan-lines.js';

const mod = (x, n) => ((x % n) + n) % n;
// Do the cells [a, a + n) and [b, b + m) overlap on this core?
const overlaps = (a, n, b, m, core) => mod(a - b, core) < m || mod(b - a, core) < n;
// The anti-imp bomb: run by a three-point imp, it decrements the other two arms.
const third = (core) => Math.round(core / 3);
const LAPS = 256;
const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
// Where every later copy can land, for a fan boot to compare with a partner's `lattice`: copies sit
// a multiple of `grain` cells from the first one (each copy throws its own copies its parent's
// distances), so the paper's `cells` cells fill these residues, counted from its first cell.
// `base` is the body's offset from the block's first cell (the FAN 1 fan comes first).
function copyLattice(core, cells, base, ...distances) {
  const grain = distances.reduce((g, d) => gcd(g, mod(d, core)), core);
  return { step: grain, residues: [...new Set(Array.from({ length: Math.min(cells, grain) }, (_, k) => mod(base + k, grain)))] };
}
// The cells the original writes in its first FIRST_LAPS laps, from the block's first cell, as
// { cells }: a bounded partner (a clear's window) is checked against these, since a paper's
// later generations reach every part of the core in the end (see docs/block-algebra.md).
const FIRST_LAPS = 8;
const lapCells = (core, base, laps) => ({ cells: laps.flatMap(([from, size]) => Array.from({ length: size }, (_, k) => mod(base + from + k, core))) });
const baseOf = (where, label) => (where ? where.at(label) - where.start : 0);
// The same first laps as `lattice` writes ({ from, size } windows): a fan boot refuses a partner
// whose code lies under them. A paper writes its copies, its bombs and the cells it erases.
const lapWindows = (base, laps) => laps.map(([from, size]) => ({ from: base + from, size }));          // laps a single copy is checked for (far more than one copy runs in a round)

function fanMismatches(id, P, settings) {
  const out = [];
  if (P.PROCS !== 6 && P.PROCS !== 8) out.push(`${id}: PROCS must be 6 or 8 (a fan of lockstep processes, one cell copied each)`);
  if (settings.maxProcesses < 16 * P.PROCS) out.push(`${id}: a lockstep paper needs room to grow (${16 * P.PROCS} processes); this hill allows ${settings.maxProcesses}`);
  return out;
}
// The block's first instruction: its own fan (FAN 1), or the body itself.
function emitFan(ctx, entry) {
  if (ctx.P.FAN) fanLines(ctx.P.PROCS).forEach((d, i) => ctx.ins(i ? '' : entry, 'SPL', 'B', d));
  else ctx.mark(entry);
}
// Counts how many processes ran `first` before any ran `second`: the entrants.
function entrants(api, id, first, second) {
  let n = 0, checked = false;
  return (pc) => {
    if (checked) return;
    if (pc === first) n++;
    else if (pc === second) {
      checked = true;
      if (n !== api.P.PROCS) throw new Error(`${id}: ${n} process${n === 1 ? '' : 'es'} entered together; it needs PROCS (${api.P.PROCS}) in lockstep (FAN 1, or a fan boot with N = PROCS)`);
    }
  };
}
const inWindow = (api, at, size) => api.vm.processes(0).filter((q) => api.rel(q, at) < size).length;
function countCopies(api, head, cells) {
  let n = 0;
  for (let c = 0; c < api.core; c++) {
    if (api.vm.peek(c).op === head && cells.every(([k, x]) => api.same(api.vm.peek(c + k), x))) n++;
  }
  return n;
}
const onCode = (api, label, ks) => {
  const code = ks.map((k) => api.code(label, k));
  return api.vm.processes(0).some((q) => code.some((x) => api.same(api.vm.peek(q), x)));
};

// ---------------------------------------------------------------------------
// loop-paper6
//
//   lpGo  spl  STEP, 0             PROCS processes start in the next copy. A is
//                                  the destination, B the source counter
//         mov  >lpGo, }lpGo        each process copies one cell
//         mov  lpBm, >lpGo+BPTR    ... and drops one anti-imp DAT through a
//                                  pointer BPTR away (a run of DATs that grows
//                                  by PROCS cells a lap)
//         add.a #16*DELTA-1, lpGo  the next copy lands 16*DELTA*PROCS further on
//         jmp  lpGo, <lpGo         loop; the B operand rewinds the source counter
//   lpBm  dat  <third, <2*third
//
// The copy's first cell is taken before the pointers move, so every copy
// starts with a clean counter and its parent's current distance. Distances
// only ever grow by multiples of 16, and STEP mod 16 leaves the body's own 16-
// cell class free, so no copy ever writes onto itself (on 8,000 and 55,440).
const GRAIN = 16, LP = 6;
const loopPaper6 = {
  id: 'loop-paper6',
  kind: 'body', exit: 'never', grows: true, writes: 'sparse', roams: true, dialects: '94',
  processes: (P) => (P.FAN ? P.PROCS : 1),
  purpose: 'Six-line looping bombing paper for PROCS lockstep processes (the paper beside the stone in six 94nop top-30 warriors): each lap starts PROCS processes in the next copy STEP away, copies the body there one cell per process, drops PROCS anti-imp DATs through a pointer BPTR away, and moves the next copy 16*DELTA*PROCS on. FAN 0 is the bare six cells for a fan boot with N = PROCS; FAN 1 adds its own fan.',
  params: { PROCS: [6, 8], FAN: [0, 1], STEP: [64, 54000], DELTA: [1, 3464], BPTR: [64, 54000] },
  defaults: { PROCS: 6, FAN: 1, STEP: 2008, DELTA: 1, BPTR: 3000 },
  entry: 'lpIn',
  mutable: [['lpGo', ['a', 'b']]],
  // Copies land STEP and then multiples of 16*DELTA*PROCS further on.
  copies: (P, settings, where) => {
    const core = settings.coreSize, base = baseOf(where, 'lpGo'), lap = GRAIN * P.DELTA * P.PROCS;
    return [copyLattice(core, LP, base, P.STEP, lap), lapCells(core, base, Array.from({ length: FIRST_LAPS }, (_, j) => [P.STEP + j * lap, LP]))];
  },
  // Its first laps' writes: the copies, the bomb pointer's cell (the first bomb lands on it) and
  // the run of bombs that starts two thirds of the core past it and grows PROCS a lap.
  lattice: (P, settings, where) => {
    const base = baseOf(where, 'lpGo'), lap = GRAIN * P.DELTA * P.PROCS, S2 = 2 * third(settings.coreSize);
    return lapWindows(base, [...Array.from({ length: FIRST_LAPS }, (_, j) => [P.STEP + j * lap, LP]), [P.BPTR, 1], [P.BPTR + S2, P.PROCS * FIRST_LAPS]]);
  },
  mismatches(P, settings) {
    const core = settings.coreSize, out = fanMismatches('loop-paper6', P, settings);
    const r = mod(P.STEP, GRAIN);
    if (r < LP || r > GRAIN - P.PROCS) out.push(`loop-paper6: STEP mod 16 must be ${LP} to ${GRAIN - P.PROCS}, or a later copy lands on the body`);
    if (mod(P.STEP, core) < 2 * GRAIN || mod(-P.STEP, core) < 2 * GRAIN) out.push('loop-paper6: STEP lands on the paper itself');
    if (mod(GRAIN * P.DELTA * P.PROCS, core) === 0) out.push('loop-paper6: DELTA moves the copies a whole number of cores: every lap would land on the last');
    // The bomb pointer and the run of DATs behind it stay off the body.
    const ptr = mod(P.BPTR, core), run = mod(P.BPTR + 2 * third(core), core);
    if (ptr < GRAIN || ptr > core - GRAIN) out.push('loop-paper6: BPTR puts the bomb pointer on the paper');
    if (run < GRAIN || mod(-run, core) < core / 4) out.push('loop-paper6: the run of bombs behind BPTR reaches the paper within a quarter of the core');
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, S = third(core);
    emitFan(ctx, 'lpIn');
    ctx.ins('lpGo', 'SPL', 'B', `${mod(P.STEP, core)}`, '0');
    ctx.ins('lpCopy', 'MOV', 'I', `>${L('lpGo')}`, `}${L('lpGo')}`);
    ctx.ins('lpDrop', 'MOV', 'I', L('lpBm'), `>${L('lpGo')}+${mod(P.BPTR, core)}`);
    ctx.ins('', 'ADD', 'A', `#${mod(GRAIN * P.DELTA - 1, core)}`, L('lpGo'));
    ctx.ins('', 'JMP', 'B', L('lpGo'), `<${L('lpGo')}`);
    ctx.ins('lpBm', 'DAT', 'F', `<${S}`, `<${mod(2 * S, core)}`);
  },
  running: (api) => onCode(api, 'lpGo', [1, 2, 3, 4]),
  watch(api) {
    const { P, vm } = api, N = P.PROCS, home = api.at('lpGo'), copyAt = api.at('lpCopy'), dropAt = api.at('lpDrop');
    const ptr = api.add(home, mod(P.BPTR, api.core)), bomb = api.code('lpBm');
    const intact = () => [1, 2, 3, 4, 5].every((k) => api.same(vm.peek(api.add(home, k)), api.code('lpGo', k))) && vm.peek(home).op === 'SPL';
    const entered = entrants(api, 'loop-paper6', home, copyAt);
    const bombs = new Set();
    let spl = 0, mov = 0, dest = null, laps = 0;
    // Laps checked cell by cell: the first always, the second too when alone. Later ones run in a
    // core full of this paper's other copies (and a full process table), which may write here as well.
    const strict = api.alone ? 2 : 1;
    return {
      before(pc) {
        entered(pc);
        if (pc === home && intact()) { if (spl++ % N === 0) dest = api.add(home, vm.peek(home).a); return null; }
        if (pc === copyAt && intact()) return { copy: true };
        if (pc === dropAt && intact()) return { t: api.add(ptr, vm.peek(ptr).b) };
        return null;
      },
      after(tok) {
        if (!tok) return;
        if (tok.copy) {
          if (++mov % N || dest === null || laps >= strict) return;
          // The lap's copy is whole and PROCS processes are in it.
          for (let k = 1; k < LP; k++) if (!api.same(vm.peek(api.add(dest, k)), api.code('lpGo', k))) throw new Error(`loop-paper6: lap ${laps + 1} left an incomplete copy`);
          if (vm.peek(dest).op !== 'SPL') throw new Error(`loop-paper6: lap ${laps + 1} did not copy its first cell`);
          if (inWindow(api, dest, LP) < N) throw new Error(`loop-paper6: fewer than ${N} processes run the new copy`);
          laps++;
          return;
        }
        if (api.rel(tok.t, home) < LP) { if (api.alone) throw new Error('loop-paper6 bombed itself'); return; }
        if (api.same(vm.peek(tok.t), bomb)) bombs.add(tok.t);
        else if (api.alone) throw new Error('loop-paper6 dropped something other than its bomb');
      },
      final() {
        if (!spl) return;                       // never entered (a branch not taken)
        if (!laps) throw new Error('loop-paper6 never finished a copy');
        if (!api.alone) return;
        if (laps < 2) throw new Error('loop-paper6 made too few laps');
        if (bombs.size < 2 * N) throw new Error(`loop-paper6 dropped too few bombs (${bombs.size})`);
        if (countCopies(api, 'SPL', [1, 2, 3, 4, 5].map((k) => [k, api.code('lpGo', k)])) < 4) throw new Error('loop-paper6 made too few copies');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// stream-paper3
//
//   spGo  spl  STEP, 0             PROCS processes start in the next copy. A is
//                                  the one destination of all three streams,
//                                  B the first stream's source counter
//         mov  >spGo, }spGo        stream 1: the body
//         mov  >spGo+5, }spGo      stream 2: PROCS cells upward from the tail
//                                  (the pointer is the B-field of the first
//                                  cell after the body)
//         mov  <spGo+5, }spGo      stream 3: the same cells downward, which
//                                  puts the tail pointer back
//         jmp  spGo, <spGo         loop; the B operand rewinds stream 1
//
// The cells after a copy are empty, so streams 2 and 3 lay 2*PROCS empty cells
// behind every copy: each copy lands with a clean tail of its own, and whatever
// was there is erased. A lap moves the destination on by 3*PROCS.
// TAIL 1 emits the tail cell (DAT 0, 0) as a sixth cell; TAIL 0 relies on the
// cell after the body being empty, so the block must come last in the image.
const SP = 5;
const streamPaper3 = {
  id: 'stream-paper3',
  kind: 'body', exit: 'never', grows: true, writes: 'sparse', roams: true, dialects: '94',
  processes: (P) => (P.FAN ? P.PROCS : 1),
  purpose: 'Five-line three-stream paper for PROCS lockstep processes (the Azathoth family\'s paper as its own block): each lap starts PROCS processes in the next copy STEP away and runs three copy lines into one shared destination, the body and then the PROCS cells after it upward and downward through a second source pointer, so every copy is followed by 2*PROCS erased cells and the next lands 3*PROCS further on. TAIL 1 carries the tail pointer cell; TAIL 0 needs the block last in the image. FAN 0 is the bare body for a fan boot with N = PROCS; FAN 1 adds its own fan.',
  params: { PROCS: [6, 8], FAN: [0, 1], TAIL: [0, 1], STEP: [64, 54000] },
  defaults: { PROCS: 6, FAN: 1, TAIL: 1, STEP: 1367 },
  entry: 'spIn',
  // Copies land STEP and then multiples of 3*PROCS further on.
  // A lap writes 3 * PROCS cells: the copy and the 2 * PROCS cells its streams erase behind it.
  copies: (P, settings, where) => {
    const core = settings.coreSize, base = baseOf(where, 'spGo'), lap = 3 * P.PROCS;
    return [copyLattice(core, SP, base, P.STEP, lap), lapCells(core, base, Array.from({ length: FIRST_LAPS }, (_, j) => [P.STEP + j * lap, lap]))];
  },
  // Its first laps' writes: each copy and the 2 * PROCS cells its streams erase behind it.
  lattice: (P, settings, where) => lapWindows(baseOf(where, 'spGo'), Array.from({ length: FIRST_LAPS }, (_, j) => [P.STEP + j * 3 * P.PROCS, 3 * P.PROCS])),
  mutable: (P) => [['spGo', ['a', 'b']], ...(P.TAIL ? [['spTail', ['b']]] : [])],
  mismatches(P, settings) {
    const core = settings.coreSize, out = fanMismatches('stream-paper3', P, settings), N = P.PROCS;
    // A lap writes 3N cells; the body and the N tail cells it reads must stay as they are.
    for (let j = 0; j < LAPS; j++) {
      if (overlaps(P.STEP + 3 * N * j, 3 * N, 0, SP + N, core)) { out.push(`stream-paper3: lap ${j + 1} copies onto the paper or its tail`); break; }
    }
    // Copies of copies: generation k lands about k * STEP away. If that comes round to the paper
    // within a few generations (STEP 1000 on 8,000 cells: the eighth), that copy's streams rewrite
    // the tail pointer the original is still using.
    for (let k = 2; k <= 16; k++) {
      if (overlaps(k * P.STEP, 3 * N, -3 * N, SP + 4 * N, core)) { out.push(`stream-paper3: generation ${k} of its copies comes back onto the paper (${k} x STEP is ${mod(k * P.STEP, core)} on a ${core}-cell core)`); break; }
    }
    return out;
  },
  linked(P, settings, at, { total }) {
    return !P.TAIL && at('spGo') + SP < total
      ? ['stream-paper3: TAIL 0 keeps its tail pointer in the cell after the body, which must be empty: put it last in the image, or use TAIL 1'] : [];
  },
  emit(ctx) {
    const { L, P, core } = ctx, tail = `${L('spGo')}+${SP}`;
    emitFan(ctx, 'spIn');
    ctx.ins('spGo', 'SPL', 'B', `${mod(P.STEP, core)}`, '0');
    ctx.ins('spOne', 'MOV', 'I', `>${L('spGo')}`, `}${L('spGo')}`);
    ctx.ins('', 'MOV', 'I', `>${tail}`, `}${L('spGo')}`);
    ctx.ins('spBack', 'MOV', 'I', `<${tail}`, `}${L('spGo')}`);
    ctx.ins('', 'JMP', 'B', L('spGo'), `<${L('spGo')}`);
    if (P.TAIL) ctx.ins('spTail', 'DAT', 'F', '0', '0');
  },
  running: (api) => onCode(api, 'spGo', [1, 2, 3, 4]),
  watch(api) {
    const { P, vm } = api, N = P.PROCS, home = api.at('spGo'), oneAt = api.at('spOne'), backAt = api.at('spBack');
    const tail = api.add(home, SP);
    const intact = () => [1, 2, 3, 4].every((k) => api.same(vm.peek(api.add(home, k)), api.code('spGo', k))) && vm.peek(home).op === 'SPL';
    const entered = entrants(api, 'stream-paper3', home, oneAt);
    const empty = (c) => { const x = vm.peek(c); return x.op === 'DAT' && x.a === 0 && x.b === 0; };
    let spl = 0, one = 0, back = 0, dest = null, started = 0, tail0 = 0, laps = 0, wiped = 0;
    // Laps checked cell by cell: the first always, the second too when alone. Later ones run in a
    // core full of this paper's other copies (and a full process table), which may write here as well.
    const strict = api.alone ? 2 : 1;
    return {
      before(pc) {
        entered(pc);
        if (pc === home && intact()) {
          if (!spl && !empty(tail)) throw new Error('stream-paper3: the cell after the body is not empty (TAIL 0 needs the block last in the image)');
          if (spl++ % N === 0) { dest = api.add(home, vm.peek(home).a); started = vm.cycle; tail0 = vm.peek(tail).b; }
          return null;
        }
        if (pc === oneAt && intact()) return 1;
        if (pc === backAt && intact()) return 3;
        return null;
      },
      after(tok) {
        if (!tok || dest === null || laps >= strict) return;
        if (tok === 1) {
          if (++one % N) return;
          // Stream 1 is through: the copy is whole and PROCS processes are in it.
          for (let k = 1; k < SP; k++) if (!api.same(vm.peek(api.add(dest, k)), api.code('spGo', k))) throw new Error(`stream-paper3: lap ${laps + 1} left an incomplete copy`);
          if (vm.peek(dest).op !== 'SPL') throw new Error(`stream-paper3: lap ${laps + 1} did not copy its first cell`);
          if (inWindow(api, dest, SP) < N) throw new Error(`stream-paper3: fewer than ${N} processes run the new copy`);
          return;
        }
        if (++back % N) return;
        // Streams 2 and 3 are through: the tail pointer is back, and the cells behind the copy were rewritten.
        if (api.norm(vm.peek(tail).b - tail0) !== 0) throw new Error('stream-paper3: the second source pointer was not put back');
        for (let k = N; k < 3 * N; k++) {
          const c = api.add(dest, k);
          if (vm.writeCycle[c] < started) throw new Error(`stream-paper3: lap ${laps + 1} wrote only part of its three streams`);
          if (api.alone && !empty(c)) throw new Error('stream-paper3: the cells behind a copy are not empty');
          wiped++;
        }
        laps++;
      },
      final() {
        if (!spl) return;                       // never entered
        if (!laps) throw new Error('stream-paper3 never finished a lap');
        if (!api.alone) return;
        if (laps < 2 || wiped < 4 * N) throw new Error('stream-paper3 made too few laps');
        if (countCopies(api, 'SPL', [1, 2, 3, 4].map((k) => [k, api.code('spGo', k)])) < 4) throw new Error('stream-paper3 made too few copies');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// backcopy-paper
//
//   bcGo  mov.ab #PROCS-4, bcJ     arm the source counter (every lap, so a
//                                  fresh copy needs no repair)
//         mov  <bcJ, <bcS          copy the top cell first, downward, to the
//                                  cells below the last thing written
//   bcS   spl  @bcS, PROCS-STEP-2  the copy is whole: start PROCS processes at
//                                  its first cell (B is the write pointer)
//         mov  bcB, <bcS           PROCS anti-imp DATs directly below the copy
//   bcJ   jmp  bcGo, 0             B: the source counter
//   bcB   dat  <third, <2*third
//
// One pointer walks down the core: a copy, a row of DATs, the next copy ...
// 2*PROCS cells a lap, starting STEP below the body. A copy inherits the
// pointer as it stood when its SPL line was copied, so its own strip starts
// about STEP below itself.
const BC = 6;
const backcopyPaper = {
  id: 'backcopy-paper',
  kind: 'body', exit: 'never', grows: true, writes: 'sparse', roams: true, dialects: '94',
  processes: (P) => (P.FAN ? P.PROCS : 1),
  purpose: 'Six-line backward-copying paper for PROCS lockstep processes: each lap copies the body top cell first to descending addresses STEP below, starts PROCS processes in the copy once it is whole, and lays PROCS anti-imp DATs directly below it, so a strip of copies and DAT rows grows downward 2*PROCS cells a lap and whatever sweeps upward meets a DAT row before a copy. FAN 0 is the bare six cells for a fan boot with N = PROCS; FAN 1 adds its own fan.',
  params: { PROCS: [6, 8], FAN: [0, 1], STEP: [64, 54000] },
  defaults: { PROCS: 6, FAN: 1, STEP: 1009 },
  entry: 'bcIn',
  // Copies land STEP below, then multiples of 2*PROCS lower; a copy starts its own strip PROCS - 3 lower still.
  // Lap j writes the 2 * PROCS cells (a copy, then its DAT row) below STEP + 2 * PROCS * j.
  copies: (P, settings, where) => {
    const core = settings.coreSize, base = baseOf(where, 'bcGo'), N = P.PROCS;
    return [copyLattice(core, BC, base, P.STEP, 2 * N, N - 3), lapCells(core, base, Array.from({ length: FIRST_LAPS }, (_, j) => [-P.STEP - 2 * N * (j + 1) + N, 2 * N]))];
  },
  // Its first laps' writes: each copy and the row of DATs below it.
  lattice: (P, settings, where) => lapWindows(baseOf(where, 'bcGo'), Array.from({ length: FIRST_LAPS }, (_, j) => [-P.STEP - 2 * P.PROCS * (j + 1) + P.PROCS, 2 * P.PROCS])),
  mutable: [['bcS', ['b']], ['bcJ', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = fanMismatches('backcopy-paper', P, settings), N = P.PROCS;
    // Lap j writes the 2N cells below body - STEP - 2N*j + N; the N cells it reads must stay.
    for (let j = 0; j < LAPS; j++) {
      if (overlaps(-P.STEP - 2 * N * j - N, 2 * N, -4, N + 8, core)) { out.push(`backcopy-paper: lap ${j + 1} copies onto the paper`); break; }
    }
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, S = third(core);
    emitFan(ctx, 'bcIn');
    ctx.ins('bcGo', 'MOV', 'AB', `#${P.PROCS - 4}`, L('bcJ'));
    ctx.ins('bcCopy', 'MOV', 'I', `<${L('bcJ')}`, `<${L('bcS')}`);
    ctx.ins('bcS', 'SPL', 'B', `@${L('bcS')}`, `${mod(P.PROCS - P.STEP - 2, core)}`);
    ctx.ins('bcDrop', 'MOV', 'I', L('bcB'), `<${L('bcS')}`);
    ctx.ins('bcJ', 'JMP', 'B', L('bcGo'), '0');
    ctx.ins('bcB', 'DAT', 'F', `<${S}`, `<${mod(2 * S, core)}`);
  },
  running: (api) => onCode(api, 'bcGo', [0, 1, 3]),
  watch(api) {
    const { P, vm } = api, N = P.PROCS, home = api.at('bcGo'), copyAt = api.at('bcCopy'), splAt = api.at('bcS'), dropAt = api.at('bcDrop');
    const bomb = api.code('bcB');
    const fixed = [0, 1, 3, 5];                 // cells of a copy that never change
    const intact = () => fixed.every((k) => api.same(vm.peek(api.add(home, k)), api.code('bcGo', k))) && vm.peek(splAt).op === 'SPL' && vm.peek(api.add(home, 4)).op === 'JMP';
    const entered = entrants(api, 'backcopy-paper', home, copyAt);
    const pointer = () => api.add(splAt, vm.peek(splAt).b);
    let copies = 0, spls = 0, drops = 0, laps = 0, last = null, lapTop = null, low = null, armed = false;
    // Laps checked cell by cell: the first always, the second too when alone. Later ones run in a
    // core full of this paper's other copies (and a full process table), which may write here as well.
    const strict = api.alone ? 2 : 1;
    return {
      before(pc) {
        entered(pc);
        if (pc === home) armed = true;
        if (!armed || !intact()) return null;
        if (pc === copyAt) return { copy: api.add(pointer(), -1) };
        if (pc === splAt) return { spl: pointer() };
        if (pc === dropAt) return { drop: api.add(pointer(), -1) };
        return null;
      },
      after(tok) {
        if (!tok || laps >= strict) return;
        if (tok.copy !== undefined) {
          // Written top cell first, each cell directly below the last.
          if (copies % N === 0) {
            if (low !== null && api.alone && api.rel(low, tok.copy) !== 1) throw new Error('backcopy-paper: a lap did not continue below the last');
            lapTop = tok.copy;
          }
          else if (api.rel(last, tok.copy) !== 1) throw new Error('backcopy-paper did not copy downward');
          last = tok.copy;
          if (api.rel(tok.copy, home) < BC) throw new Error('backcopy-paper copied onto itself');
          if (++copies % N) return;
          for (const k of fixed) if (!api.same(vm.peek(api.add(tok.copy, k)), api.code('bcGo', k))) throw new Error(`backcopy-paper: lap ${laps + 1} left an incomplete copy`);
          return;
        }
        if (tok.spl !== undefined) {
          if (++spls % N) return;
          // Started only once whole: PROCS processes at the copy's first cell.
          for (const k of fixed) if (!api.same(vm.peek(api.add(tok.spl, k)), api.code('bcGo', k))) throw new Error('backcopy-paper started a process in an incomplete copy');
          if (inWindow(api, tok.spl, BC) < N) throw new Error(`backcopy-paper: fewer than ${N} processes run the new copy`);
          return;
        }
        if (!api.same(vm.peek(tok.drop), bomb)) throw new Error('backcopy-paper dropped something other than its bomb');
        if (++drops % N) return;
        // The row of DATs sits directly below the copy, and the next lap continues below it.
        if (api.rel(lapTop, tok.drop) !== 2 * N - 1) throw new Error('backcopy-paper: the DAT row is not directly below the copy');
        low = tok.drop;
        laps++;
      },
      final() {
        if (!armed) return;                     // never entered
        if (!laps) throw new Error('backcopy-paper never finished a lap');
        if (!api.alone) return;
        if (laps < 2) throw new Error('backcopy-paper made too few laps');
        if (countCopies(api, 'MOV', [1, 3, 5].map((k) => [k, api.code('bcGo', k)])) < 4) throw new Error('backcopy-paper made too few copies');
      },
    };
  },
};

export default [loopPaper6, streamPaper3, backcopyPaper];
