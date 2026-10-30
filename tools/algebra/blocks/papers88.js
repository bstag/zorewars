// ICWS'88-flavoured papers and imp launchers (docs/block-algebra.md). Four
// bodies that run in strict '88 (or '94 where marked), each written so its
// behaviour is checkable when it runs alone and beside a partner:
//
//   bomb-mice      a counted copy paper that also drops a DAT bomb each lap,
//                  on a residue class its copies never touch;
//   silk-88        a two/three-stage '88 silk (SPL @copy, predecrement copies)
//                  with one anti-imp bomb per pass;
//   anti-imp-silk  a '94 silk with 1-3 anti-imp bombs a lap;
//   dual-launcher  two coupled imp spirals launched together, in '88.
//
// Every number here is a plain ring address, so these are ring blocks. The
// copy papers keep their bombs off their own copies by arithmetic alone (a
// grain that divides both the 8,000 and the 55,440 cores), and each watch
// checks that the real mechanism happened: copies were made, and every bomb
// landed where the arithmetic says it must. Write all Redcode yourself; the
// library and the originals are studied for ideas, never copied.

import { modInverse } from '../util.js';

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const norm = (x, core) => ((x % core) + core) % core;
const mod = (x, n) => ((x % n) + n) % n;

// How many places in the core hold `pattern` ([[offset, test(cell)], ...]) outside the image.
function countCopies(api, pattern, extra = () => true) {
  let n = 0;
  for (let c = 0; c < api.core; c++) if (!api.inImage(c) && pattern.every(([k, test]) => test(api.vm.peek(c + k))) && extra(c)) n++;
  return n;
}
const sameAs = (api, ins) => (x) => api.same(x, ins);

// ---------------------------------------------------------------------------
// bomb-mice: one process copies the LEN-cell body D cells on, starts a process
// in the copy, then drops a DAT bomb, and loops; every copy does the same.
//
// The copy pointer (mDst) and counter (mCnt) are reset from immediates every
// lap, so each copy behaves exactly like the original whatever it inherited:
// no value marches across generations. Child i therefore starts a fixed stride
// S = D - (LEN - 3) past child i-1, so every copy sits at start + i*S, all on
// one residue class modulo g = gcd(S, core); a copy's LEN cells cover residues
// [0 .. LEN-1] of that class. The bomb lands BOFF = mBptr-index + B cells past
// the running copy, so every bomb sits on residue BOFF mod g. Choosing BOFF mod
// g outside [0 .. LEN-1] keeps every bomb off every copy, for ever. TRAP 1
// loops back through a JMZ that reads the bomb cell (zero when it is our own
// DAT): a process whose bomb cell an enemy has disturbed falls out and dies
// rather than spinning. DEC 1 marches the bomb forward by a grain each lap (a
// decrement stream along the one safe residue class), resetting before it can
// wrap back to the warrior.

// A copy of the body is laid out from index 0 (mCnt, never copied: the loop
// reads indices 1 .. LEN-1). mLoop at index 1 is the entry a fresh copy is
// started on. Data cells (mSeed, mDst, mBptr, mBomb) sit last, so mDst is at
// LEN-3 and the stride between a process's start and its child's start is
// (seed value) - (LEN - mDst) = seed - 3.
const MG = 40;                                     // the copy/bomb grain (divides 8000 and 55440, > LEN)
function miceCells() {
  const cells = ['mCnt', 'mLoop', 'mSet', 'mCopy', 'mDjn', 'mSpl', 'mAdv', 'mBombMov', 'mAddB', 'mGuard', 'mReset', 'mBack', 'mSeed', 'mDst', 'mBptr', 'mBomb'];
  return { cells, idx: Object.fromEntries(cells.map((l, i) => [l, i])), LEN: cells.length };
}
// The bomb offset from a copy's start, its residue, and the bomb stream's top.
function miceGeom(P, core, maxLength = 0) {
  const { idx, LEN } = miceCells();
  const BOFF = idx.mBptr + P.B;                     // bomb target, from a copy's start
  const limitB = P.B + MG * Math.max(0, Math.floor((core - 2 * maxLength - BOFF) / MG));
  return { idx, LEN, BOFF, rBomb: norm(BOFF, MG), limitB };
}
// bomb-mice marches a self-relative seed by CSTEP (a grain multiple) and resets
// its copy pointer from the seed every lap, so a fresh copy lands a clean CSTEP
// on (no predecrement drift). With D-3 and CSTEP both multiples of the grain,
// every copy sits on one residue class and covers residues 0 .. LEN-1 of it;
// the bomb, BOFF cells past each copy, sits on residue BOFF mod grain, chosen
// outside that window, so it never lands on any copy, generation after
// generation. DEC 1 decrements the swept cells instead of dropping a DAT (a
// decrement stream against imps and stones); TRAP 1 loops back through a JMZ on
// the next target, so a process whose stream an enemy has fouled falls out.
const bombMice = {
  id: 'bomb-mice', kind: 'body', exit: 'never', processes: 1, grows: true,
  writes: 'sparse', roams: true, entryFirst: false, loop: 'mLoop',
  purpose: 'Mice-style copy paper: a counted loop copies the body a marching CSTEP on, starts a process in the copy, and sweeps a bomb each lap on a residue class its copies never touch; DEC 1 decrements the cells it sweeps, TRAP 1 adds a JMZ trap on the stream.',
  params: { D: [200, 54000], CSTEP: [200, 54000], B: [100, 54000], DEC: [0, 1], TRAP: [0, 1] }, entry: 'mLoop',
  mutable: [['mCnt', ['a', 'b']], ['mSeed', ['b']], ['mDst', ['a', 'b']], ['mBptr', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, ml = settings.maxLength, out = [];
    const { idx, LEN, BOFF, rBomb, limitB } = miceGeom(P, core, ml);
    if (core % MG) out.push(`bomb-mice: the ${MG}-cell grain does not divide the ${core}-cell core`);
    if ((P.D - 3) % MG) out.push(`bomb-mice: D-3 must be a multiple of ${MG} so every copy keeps one residue class`);
    if (P.CSTEP % MG) out.push(`bomb-mice: CSTEP must be a multiple of ${MG} so the march keeps the residue class`);
    if (rBomb <= LEN - 1) out.push(`bomb-mice: the bomb lands on residue ${rBomb}, inside the copy window (0..${LEN - 1})`);
    if (P.D <= 2 * LEN || P.CSTEP < ml) out.push('bomb-mice: D or CSTEP too small; copies would overlap the warrior');
    if (BOFF < ml) out.push('bomb-mice: the first bomb lands inside the warrior');
    if (idx.mBptr + limitB > core - ml) out.push('bomb-mice: its bomb stream would wrap into the warrior');
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx;
    const { LEN, limitB } = miceGeom(P, core, ctx.settings.maxLength);
    ctx.ins('mCnt', 'DAT', 'F', '#0', '#0');
    ctx.ins('mLoop', 'MOV', 'AB', `#${LEN - 1}`, L('mCnt'));            // reset the copy counter
    ctx.ins('mSet', 'MOV', 'F', L('mSeed'), L('mDst'));                 // dst := the marching seed
    ctx.ins('mCopy', 'MOV', 'I', `@${L('mCnt')}`, `<${L('mDst')}`);      // copy a cell
    ctx.ins('mDjn', 'DJN', 'B', L('mCopy'), L('mCnt'));
    ctx.ins('mSpl', 'SPL', 'B', `@${L('mDst')}`);                        // start a process in the fresh copy
    ctx.ins('mAdv', 'ADD', 'AB', `#${P.CSTEP}`, L('mSeed'));            // march the seed for next lap
    // Sweep the bomb, then march it a grain on, resetting before it would wrap.
    if (P.DEC) ctx.ins('mBombMov', 'SUB', 'I', L('mBomb'), `@${L('mBptr')}`);  // decrement the cell
    else ctx.ins('mBombMov', 'MOV', 'I', L('mBomb'), `@${L('mBptr')}`);         // drop a DAT
    ctx.ins('mAddB', 'ADD', 'AB', `#${MG}`, L('mBptr'));
    ctx.ins('mGuard', 'SLT', 'B', L('mBptr'), `#${limitB + 1}`);          // still below the limit? skip the reset
    ctx.ins('mReset', 'MOV', 'AB', `#${P.B}`, L('mBptr'));                // overflowed: reset the bomb pointer
    if (P.TRAP) ctx.ins('mBack', 'JMZ', 'B', L('mLoop'), `@${L('mBptr')}`);   // loop unless the next target is disturbed
    else ctx.ins('mBack', 'JMP', 'B', L('mLoop'));
    ctx.ins('mSeed', 'DAT', 'F', '#0', `#${P.D}`);                        // the self-relative copy distance, marching
    ctx.ins('mDst', 'DAT', 'F', '#0', '#0');
    ctx.ins('mBptr', 'DAT', 'F', '#0', `#${P.B}`);
    ctx.ins('mBomb', 'DAT', 'F', P.DEC ? '#1' : '#0', P.DEC ? '#1' : '#0');  // the DAT payload, or the amount to subtract
  },
  // Papers run in their copies; the original keeps looping in its own image.
  running: (api) => api.vm.processes(0).some((q) => api.inSelf(q) || api.same(api.vm.peek(q), api.code('mLoop'))),
  watch(api) {
    const core = api.core, { idx, LEN, rBomb } = miceGeom(api.P, core);
    // A copy's static code cells, as a pattern from its mLoop (index 1).
    const statics = ['mLoop', 'mSet', 'mCopy', 'mDjn', 'mSpl', 'mAdv'];
    const pattern = statics.map((l, i) => [i, sameAs(api, api.code(l))]);
    const movCode = api.code('mBombMov'), bombCells = new Set();
    const origMov = api.at('mBombMov'), bptr = api.at('mBptr');
    const rPtr = norm(api.P.B, MG);
    // The original is the healthy witness for the sweep, while it is intact: a
    // long-running wrapping paper may eventually have a copy land on it, and
    // once its pointer is clobbered it is no longer the witness (its copies are).
    const intact = () => api.same(api.vm.peek(origMov), movCode) && api.vm.peek(bptr).op === 'DAT' && api.norm(api.vm.peek(bptr).b) % MG === rPtr;
    return {
      before: (pc) => {
        if (pc !== origMov || !intact()) return null;
        return api.norm(bptr + api.vm.peek(bptr).b);
      },
      after: (t) => {
        if (t === null) return;
        if (api.inImage(t)) throw new Error('bomb-mice swept inside its own image');
        // On the one safe residue class (measured from this block's own start),
        // off the copy window (0..LEN-1).
        if (api.norm(t - api.self.start) % MG !== rBomb) throw new Error(`bomb-mice swept off its residue class (${api.norm(t - api.self.start) % MG} != ${rBomb})`);
        if (api.vm.peek(t).op !== 'DAT' || api.vm.writerPc[t] !== origMov) throw new Error('bomb-mice left something other than its DAT');
        bombCells.add(t);
      },
      final: () => {
        if (!api.alone) return;
        if (rBomb <= LEN - 1) throw new Error('bomb-mice: the bomb residue overlaps its copies');
        if (bombCells.size < 3) throw new Error(`bomb-mice swept too few cells (${bombCells.size})`);
        if (countCopies(api, pattern) < 3) throw new Error('bomb-mice made too few copies');
      },
    };
  },
};
// D-3 = 2000 and CSTEP = 2040 are both multiples of the 40-cell grain; BOFF =
// 14 + 2010 = 2024, residue 24 modulo 40, clear of the copy window (0..15).
bombMice.defaults = { D: 2003, CSTEP: 2040, B: 2010, DEC: 0, TRAP: 0 };

// ---------------------------------------------------------------------------
// silk-88: a strict-'88 silk-style paper. One process, each pass, lays STAGES
// predecrement copies of the body (SPL @copy launches a process into each) at
// seed, seed+DELTA, ..., then marches the seed by CSTEP and drops one anti-imp
// bomb. '88 has only B-predecrement (`<`) and no post-increment, so the copies
// are MOV <src, <dst with a reset counter, and the launch is SPL @dst. As in
// bomb-mice, D-3, DELTA and CSTEP are all grain multiples, so every copy of
// every generation sits on one residue class (covering residues 0..LEN-1) and
// the bomb, BOFF past each copy, sits off that window and never lands on a copy.
// kCnt is index 0 (never copied: the loop reads indices 1..LEN-1). Each stage
// refills the counter, resets dst from the seed (+ DELTA for later stages),
// copies the body and launches into it. Data cells (kSeed, kDst, kBptr, kBomb)
// sit last, so kDst is at LEN-3.
function silkCells(P) {
  const perStage = (j) => [`kRef${j}`, `kSet${j}`, ...(j ? [`kOff${j}`] : []), `kCopy${j}`, `kDjn${j}`, `kSpl${j}`];
  const stages = Array.from({ length: P.STAGES }, (_, j) => perStage(j)).flat();
  const tail = ['kAdv', 'kBombMov', 'kAddB', 'kGuard', 'kReset', 'kBack'];
  const cells = ['kCnt', ...stages, ...tail, 'kSeed', 'kDst', 'kBptr', 'kBomb'];
  return { cells, idx: Object.fromEntries(cells.map((l, i) => [l, i])), LEN: cells.length };
}
function silkGeom(P, core, maxLength = 0) {
  const { idx, LEN } = silkCells(P);
  const BOFF = idx.kBptr + P.B;
  const limitB = P.B + MG * Math.max(0, Math.floor((core - 2 * maxLength - BOFF) / MG));
  return { idx, LEN, BOFF, rBomb: norm(BOFF, MG), limitB };
}
const silk88 = {
  id: 'silk-88', kind: 'body', exit: 'never', processes: 1, grows: true,
  writes: 'sparse', roams: true, entryFirst: false, loop: 'kRef0',
  purpose: "Strict-'88 silk: one process lays STAGES predecrement copies of the body a pass (SPL @copy into each), marches its seed by CSTEP so the copies spread, and drops one anti-imp bomb a pass on a residue class its copies never touch.",
  params: { STAGES: [2, 3], D: [200, 54000], DELTA: [40, 4000], CSTEP: [200, 54000], B: [100, 54000] }, entry: 'kRef0',
  mutable: [['kCnt', ['a', 'b']], ['kSeed', ['b']], ['kDst', ['a', 'b']], ['kBptr', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, ml = settings.maxLength, out = [];
    const { idx, LEN, BOFF, rBomb, limitB } = silkGeom(P, core, ml);
    if (core % MG) out.push(`silk-88: the ${MG}-cell grain does not divide the ${core}-cell core`);
    if ((P.D - 3) % MG || P.CSTEP % MG || P.DELTA % MG) out.push(`silk-88: D-3, DELTA and CSTEP must be multiples of ${MG} to keep every copy on one residue class`);
    if (rBomb <= LEN - 1) out.push(`silk-88: the bomb lands on residue ${rBomb}, inside the copy window (0..${LEN - 1})`);
    if (P.DELTA < LEN) out.push('silk-88: DELTA is smaller than the body, so its copies would overlap');
    if (P.D <= 2 * LEN || P.CSTEP < ml) out.push('silk-88: D or CSTEP too small; copies would overlap the warrior');
    if (BOFF < ml) out.push('silk-88: the first bomb lands inside the warrior');
    if (idx.kBptr + limitB > core - ml) out.push('silk-88: its bomb stream would wrap into the warrior');
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx;
    const { LEN, limitB } = silkGeom(P, core, ctx.settings.maxLength);
    ctx.ins('kCnt', 'DAT', 'F', '#0', '#0');
    for (let j = 0; j < P.STAGES; j++) {
      ctx.ins(`kRef${j}`, 'MOV', 'AB', `#${LEN - 1}`, L('kCnt'));            // refill the copy counter
      ctx.ins(`kSet${j}`, 'MOV', 'F', L('kSeed'), L('kDst'));                // dst := the marching seed
      if (j) ctx.ins(`kOff${j}`, 'ADD', 'AB', `#${j * P.DELTA}`, L('kDst')); // this stage's offset
      ctx.ins(`kCopy${j}`, 'MOV', 'I', `@${L('kCnt')}`, `<${L('kDst')}`);     // predecrement copy
      ctx.ins(`kDjn${j}`, 'DJN', 'B', L(`kCopy${j}`), L('kCnt'));
      ctx.ins(`kSpl${j}`, 'SPL', 'B', `@${L('kDst')}`);                      // launch into the copy
    }
    ctx.ins('kAdv', 'ADD', 'AB', `#${P.CSTEP}`, L('kSeed'));                 // march the seed
    ctx.ins('kBombMov', 'MOV', 'I', L('kBomb'), `@${L('kBptr')}`);            // one bomb a pass
    ctx.ins('kAddB', 'ADD', 'AB', `#${MG}`, L('kBptr'));
    ctx.ins('kGuard', 'SLT', 'B', L('kBptr'), `#${limitB + 1}`);
    ctx.ins('kReset', 'MOV', 'AB', `#${P.B}`, L('kBptr'));
    ctx.ins('kBack', 'JMP', 'B', L('kRef0'));
    ctx.ins('kSeed', 'DAT', 'F', '#0', `#${P.D}`);
    ctx.ins('kDst', 'DAT', 'F', '#0', '#0');
    ctx.ins('kBptr', 'DAT', 'F', '#0', `#${P.B}`);
    ctx.ins('kBomb', 'DAT', 'F', '#0', '#0');
  },
  running: (api) => api.vm.processes(0).some((q) => api.inSelf(q) || api.same(api.vm.peek(q), api.code('kRef0'))),
  watch(api) {
    const core = api.core, { idx, LEN, rBomb } = silkGeom(api.P, core);
    const statics = ['kRef0', 'kSet0', 'kCopy0', 'kDjn0', 'kSpl0'];
    const pattern = statics.map((l, i) => [i, sameAs(api, api.code(l))]);
    const movCode = api.code('kBombMov'), bombCells = new Set();
    const origMov = api.at('kBombMov'), bptr = api.at('kBptr'), rPtr = norm(api.P.B, MG);
    const intact = () => api.same(api.vm.peek(origMov), movCode) && api.vm.peek(bptr).op === 'DAT' && api.norm(api.vm.peek(bptr).b) % MG === rPtr;
    return {
      before: (pc) => (pc !== origMov || !intact() ? null : api.norm(bptr + api.vm.peek(bptr).b)),
      after: (t) => {
        if (t === null) return;
        if (api.inImage(t)) throw new Error('silk-88 bombed inside its own image');
        if (api.norm(t - api.self.start) % MG !== rBomb) throw new Error(`silk-88 bombed off its residue class (${api.norm(t - api.self.start) % MG} != ${rBomb})`);
        if (api.vm.peek(t).op !== 'DAT' || api.vm.writerPc[t] !== origMov) throw new Error('silk-88 dropped something other than its DAT');
        bombCells.add(t);
      },
      final: () => {
        if (!api.alone) return;
        if (rBomb <= LEN - 1) throw new Error('silk-88: the bomb residue overlaps its copies');
        if (bombCells.size < 3) throw new Error(`silk-88 dropped too few bombs (${bombCells.size})`);
        if (countCopies(api, pattern) < 3) throw new Error('silk-88 made too few copies');
      },
    };
  },
};
// D-3 = 2000, DELTA = 80, CSTEP = 2040 are grain multiples; BOFF = idx(kBptr) +
// B lands off the copy window. Defaults are set after the block is built so the
// index is known.
silk88.defaults = { STAGES: 2, D: 2003, DELTA: 80, CSTEP: 2040, B: 2010 };

// ---------------------------------------------------------------------------
// dual-launcher: two imp spirals launched together in one pass (strict '88).
// A shared SPL at the top sends one process into spiral A's launcher and one
// into spiral B's, so both vector launches finish in the same pass and all the
// imps of both spirals start crawling together (a straggler would run into a
// cell its own ring had not written yet). Spiral A is an NA-point spiral of
// 2^K imps, spiral B an NB-point one; each imp is MOV 0, modInverse(N, core).
// The process count is exact (not a paper): each launcher's K SPLs give 2^K
// processes which each split into a jumper and an adder (2^(K+1)); the adders
// die on the vector, leaving 2^K imps a spiral. The shared split's own process
// flows straight into spiral A's launcher, so the launch peaks at 2^(K+1) +
// 2^(K+1) = 2^(K+2) processes. The block declares that exact peak and the
// linker refuses any hill too small for it: the 8-process hill cannot hold the
// launch (K >= 1 peaks at 8 or more with the field active), so LP is refused.
const DL_PEAK = (K) => 2 ** (K + 2);
const dlTail = (ctx, p, N) => {
  const { L, core } = ctx, step = modInverse(N, core);
  ctx.ins(`${p}Split`, 'SPL', 'B', L(`${p}Add`));             // a jumper, then an adder
  ctx.ins(`${p}Jump`, 'JMP', 'B', `@${L(`${p}Vec`)}`);
  ctx.ins(`${p}Add`, 'ADD', 'AB', `#${step}`, L(`${p}Vec`));
  ctx.ins(`${p}Vec`, 'DAT', 'F', '#0', `#${L(`${p}Imp`)}-${L(`${p}Vec`)}`);   // adders die here
  ctx.ins(`${p}Imp`, 'MOV', 'I', '0', `${step}`);
};
const dualLauncher = {
  id: 'dual-launcher', kind: 'body', exit: 'never', writes: 'sparse', roams: true, layout: 'last',
  purpose: 'Two coupled imp spirals launched in one pass: a shared split feeds an NA-point and an NB-point vector launcher, each raising 2^K imps; the process count is exact, so it is refused on a hill too small for its launch peak.',
  params: { NA: [3, 23], NB: [3, 23], K: [1, 5] }, entry: 'dStart',
  processes: (P) => DL_PEAK(P.K),
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    for (const [n, name] of [[P.NA, 'NA'], [P.NB, 'NB']]) {
      const step = modInverse(n, core);
      if (!step) { out.push(`dual-launcher: no ${n}-point imp spiral on a ${core}-cell core (${name})`); continue; }
      if (2 ** P.K < n) out.push(`dual-launcher: ${2 ** P.K} imps is fewer than the ${n} points of ${name}, so an imp would walk into a gap`);
      for (let i = 1; i < 2 ** P.K; i++) if ((i * step) % core > core - settings.maxLength) { out.push(`dual-launcher: a ${n}-point imp lands on the launcher (${name})`); break; }
    }
    if (P.NA === P.NB) out.push('dual-launcher: the two spirals must differ (NA != NB)');
    if (DL_PEAK(P.K) > settings.maxProcesses) out.push(`dual-launcher: its launch peaks at ${DL_PEAK(P.K)} processes; this hill allows ${settings.maxProcesses}`);
    return out;
  },
  emit(ctx) {
    const { L, P } = ctx;
    // Split spiral B off, then fall straight into spiral A's launcher.
    ctx.ins('dStart', 'SPL', 'B', L('dLaunchB'));
    for (let i = 0; i < P.K; i++) ctx.ins(i ? '' : 'dLaunchA', 'SPL', 'B', '1');
    dlTail(ctx, 'a', P.NA);
    for (let i = 0; i < P.K; i++) ctx.ins(i ? '' : 'dLaunchB', 'SPL', 'B', '1');
    dlTail(ctx, 'b', P.NB);
  },
  running: (api) => {
    const a = api.code('aImp'), b = api.code('bImp');
    return api.vm.processes(0).some((q) => api.same(api.vm.peek(q), a) || api.same(api.vm.peek(q), b));
  },
  watch(api) {
    const impA = api.code('aImp'), impB = api.code('bImp');
    const isImp = (q) => api.same(api.vm.peek(q), impA) || api.same(api.vm.peek(q), impB);
    // The two trails cross and bleed into each other (that crossing is the
    // coupling), so the stable witness is the whole steady complement: both
    // spirals launched their 2^K imps, the adders died, and both survive.
    return {
      final: () => {
        if (!api.alone) return;
        const procs = api.vm.processes(0), steady = 2 ** (api.P.K + 1);
        if (procs.length !== steady) throw new Error(`dual-launcher: ${procs.length} imps survive, not the ${steady} both spirals should hold`);
        if (!procs.every(isImp)) throw new Error('dual-launcher: a surviving process is not an imp');
        if (!procs.some((q) => api.same(api.vm.peek(q), impA)) || !procs.some((q) => api.same(api.vm.peek(q), impB))) throw new Error('dual-launcher: one of the two spirals died out');
      },
    };
  },
};
dualLauncher.defaults = { NA: 11, NB: 13, K: 4 };

// ---------------------------------------------------------------------------
// anti-imp-silk: a '94 copy paper that drops BOMBS (1-3) anti-imp bombs a lap.
// One process marches a self-relative seed by CSTEP and copies the body there
// (SPL @copy launches into it), so copies spread without re-hammering; then it
// drops BOMBS anti-imp bombs (DAT.F >core/3, #0 -- the post-increment A-field
// bumps an imp that dies on it a third of the core on, breaking its stride).
// The copy distance, the march and the bomb pointers are all aligned to the
// 80-cell grain (which divides both cores), so every copy sits on one residue
// class covering residues 0..LEN-1, and the BOMBS bombs sit on distinct
// residues above that window: they never land on a copy, generation after
// generation. The default fits the 8-process hill (it grows into the table and
// survives when it is full), the 8,000 core and the 55,440 core.
const AG = 80;                                     // the copy/bomb grain
function aimCells(P) {
  const bombMovs = Array.from({ length: P.BOMBS }, (_, j) => `aBomb${j}`);
  const ptrs = Array.from({ length: P.BOMBS }, (_, j) => `aPtr${j}`);
  // aCnt is index 0 (never copied); aDst is the last cell so the stride residue
  // is the same whatever BOMBS is (every copy keeps one residue class).
  const cells = ['aCnt', 'aLoop', 'aSet', 'aCopy', 'aDjn', 'aSpl', 'aAdv', ...bombMovs, 'aBack', 'aSeed', 'aPay', ...ptrs, 'aDst'];
  return { cells, idx: Object.fromEntries(cells.map((l, i) => [l, i])), LEN: cells.length };
}
// Align the seed, march and bomb pointers to the grain; return the real values.
function aimGeom(P, core) {
  const { idx, LEN } = aimCells(P);
  const o = LEN - idx.aDst;                         // = 1 (aDst is last): the needed seed residue
  const seed = P.D - mod(P.D - o, AG);              // first copy distance, ≡ o (mod AG)
  const cstep = P.CSTEP - mod(P.CSTEP, AG);          // march, a grain multiple
  // The first bomb's pointer residue, pinned just above the copy window.
  const want = LEN + 3;
  const B0 = P.B - mod((idx.aPtr0 + P.B) - want, AG);
  const BOFF = Array.from({ length: P.BOMBS }, (_, j) => idx[`aPtr${j}`] + B0);   // bomb j targets start + BOFF[j]
  const r = BOFF.map((b) => mod(b, AG));
  return { idx, LEN, o, seed, cstep, B0, BOFF, r };
}
const antiImpSilk = {
  id: 'anti-imp-silk', kind: 'body', exit: 'never', processes: 1, grows: true,
  writes: 'sparse', roams: true, entryFirst: false, loop: 'aLoop', dialects: '94',
  purpose: "A '94 copy paper that marches a seed by CSTEP, copies the body there and launches a process into it, and drops BOMBS (1-3) anti-imp bombs a lap (DAT.F >core/3) on residue classes its copies never touch.",
  params: { BOMBS: [1, 3], D: [200, 54000], CSTEP: [200, 54000], B: [200, 54000] }, entry: 'aLoop',
  mutable: [['aCnt', ['a', 'b']], ['aSeed', ['b']], ['aDst', ['a', 'b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, ml = settings.maxLength, out = [];
    const { idx, LEN, seed, cstep, BOFF, r } = aimGeom(P, core);
    if (core % AG) out.push(`anti-imp-silk: the ${AG}-cell grain does not divide the ${core}-cell core`);
    if (seed <= 2 * LEN || cstep < ml) out.push('anti-imp-silk: D or CSTEP too small; copies would overlap the warrior');
    if (r.some((x) => x <= LEN - 1)) out.push(`anti-imp-silk: a bomb lands on residue ${r.find((x) => x <= LEN - 1)}, inside the copy window (0..${LEN - 1})`);
    if (new Set(r).size !== r.length) out.push('anti-imp-silk: two bombs share a residue class');
    if (BOFF.some((b) => b < ml || b > core - ml)) out.push('anti-imp-silk: a bomb lands inside or wraps into the warrior');
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx;
    const { LEN, seed, cstep, B0 } = aimGeom(P, core);
    const third = Math.round(core / 3);
    ctx.ins('aCnt', 'DAT', 'F', '#0', '#0');
    ctx.ins('aLoop', 'MOV', 'AB', `#${LEN - 1}`, L('aCnt'));
    ctx.ins('aSet', 'MOV', 'F', L('aSeed'), L('aDst'));                  // dst := the marching seed
    ctx.ins('aCopy', 'MOV', 'I', `@${L('aCnt')}`, `<${L('aDst')}`);
    ctx.ins('aDjn', 'DJN', 'B', L('aCopy'), L('aCnt'));
    ctx.ins('aSpl', 'SPL', 'B', `@${L('aDst')}`);                        // launch into the copy
    ctx.ins('aAdv', 'ADD', 'AB', `#${cstep}`, L('aSeed'));               // march the seed
    for (let j = 0; j < P.BOMBS; j++) ctx.ins(`aBomb${j}`, 'MOV', 'I', L('aPay'), `@${L(`aPtr${j}`)}`);   // drop anti-imp bombs
    ctx.ins('aBack', 'JMP', 'B', L('aLoop'));
    ctx.ins('aSeed', 'DAT', 'F', '#0', `#${seed}`);
    ctx.ins('aPay', 'DAT', 'F', `>${third}`, '#0');                      // the anti-imp bomb (post-increment A)
    for (let j = 0; j < P.BOMBS; j++) ctx.ins(`aPtr${j}`, 'DAT', 'F', '#0', `#${B0}`);
    ctx.ins('aDst', 'DAT', 'F', '#0', '#0');
  },
  running: (api) => api.vm.processes(0).some((q) => api.inSelf(q) || api.same(api.vm.peek(q), api.code('aLoop'))),
  watch(api) {
    const core = api.core, { idx, LEN, r } = aimGeom(api.P, core);
    const statics = ['aLoop', 'aSet', 'aCopy', 'aDjn', 'aSpl', 'aAdv'];
    const pattern = statics.map((l, i) => [i, sameAs(api, api.code(l))]);
    const rSet = new Set(r);
    // The original is the healthy witness while its loop is intact.
    const loopIntact = () => api.same(api.vm.peek(api.at('aLoop')), api.code('aLoop'));
    const movs = Array.from({ length: api.P.BOMBS }, (_, j) => ({ pc: api.at(`aBomb${j}`), ptr: api.at(`aPtr${j}`), code: api.code(`aBomb${j}`), ptrCode: api.code(`aPtr${j}`) }));
    const bombCells = new Set();
    return {
      before: (pc) => {
        const m = movs.find((x) => x.pc === pc);
        // Validate only while the original and its pointer are intact (a long
        // run on a crowded hill may let a copy land on and clobber them).
        if (!m || !loopIntact() || !api.same(api.vm.peek(pc), m.code) || !api.same(api.vm.peek(m.ptr), m.ptrCode)) return null;
        return api.norm(m.ptr + api.vm.peek(m.ptr).b);
      },
      after: (t) => {
        if (t === null) return;
        if (api.inImage(t)) throw new Error('anti-imp-silk bombed inside its own image');
        if (!rSet.has(api.norm(t - api.self.start) % AG)) throw new Error(`anti-imp-silk bombed off its residue classes (${api.norm(t - api.self.start) % AG})`);
        if (api.vm.peek(t).op !== 'DAT') throw new Error('anti-imp-silk dropped something other than a DAT');
        bombCells.add(t);
      },
      final: () => {
        if (!api.alone) return;
        if (r.some((x) => x <= LEN - 1)) throw new Error('anti-imp-silk: a bomb residue overlaps its copies');
        if (bombCells.size < api.P.BOMBS) throw new Error(`anti-imp-silk dropped too few distinct bombs (${bombCells.size} of ${api.P.BOMBS})`);
        if (countCopies(api, pattern) < 3) throw new Error('anti-imp-silk made too few copies');
      },
    };
  },
};
antiImpSilk.defaults = { BOMBS: 2, D: 2004, CSTEP: 1840, B: 2004 };

const blocks = { 'bomb-mice': bombMice, 'silk-88': silk88, 'dual-launcher': dualLauncher, 'anti-imp-silk': antiImpSilk };
export default Object.values(blocks);
