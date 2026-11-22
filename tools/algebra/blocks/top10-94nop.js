// Blocks from the Koenigstuhl 94nop hill's top 10 (docs/hill-top10/94nop.md):
// the engines our catalog had only approximately, rebuilt so the recipes in
// tools/algebra/recipes-top10/94nop.js play like the originals.
//
// - cobra-body: King Cobra's (and Kaitain's) oneshot. A 4-line scan whose two
//   pointers live in the clear's first cell, a commit only when two adjacent
//   pairs differ, a SPL #0-pumped clear from the find whose DJN.F stream turns
//   its SPL bombs into DATs once it has come all the way round, and the
//   scanning process left behind as a MOV.I imp; optionally its own boot.
// - lattice-qscan, qi-qscan, q45-qscan: the hill's three MUL-decoded
//   quickscans (Metcalf's lattice; inversed's q^i, straight and cross-pair
//   forms; van Rijn's q^4.5), each with its two-stream burst built in.
// - agony-body: Excalibur's two-look pair scanner, 16-SPL wipe and the pumped
//   DAT clear it falls into when the scan comes round to itself.
// - lore-vampire: Forgotten Lore II, island for island: a DJN-throwing vampire
//   whose own bombs time its switch to a SPL-then-DAT clear.
// - collective-paper: The Collective's counted-copy paper with three bombs per
//   copied cell.
// - toly-pump: Tolypeutes' one-process continuous three-point imp pump.
// - h-stone, moore-paper: Hullab3loo's step-17 run-laying stone and its
//   six-line looping paper, both for a fan boot's lockstep processes.
//
// All Redcode here is written from scratch from the descriptions in
// docs/hill-top10/94nop.md; the hill warriors were read for ideas, never
// copied. How to write a block: docs/block-algebra.md.

import { modInverse } from '../util.js';

const MARKER = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };
const mod = (x, n) => ((x % n) + n) % n;
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));

// ---------------------------------------------------------------------------
// cobra-body
//
//   cptr  DAT   ZOFS+HOP+1, ZOFS     the two scan pointers (A ahead of B by HOP+1);
//                                    after the commit B is the clear's pointer
//   bptr  DAT   1, DSAFE             *bptr names the bomb: cs0 (SPL), later itself (DAT)
//   cs0   SPL   #DJS, SKIP           the pump; also the SPL bomb (B: the wrap skip)
//   clear MOV   *bptr, >cptr
//         MOV   *bptr, >cptr
//         DJN.F clear, }cs0          a stream walking up from cs0+DJS: when it has
//                                    come round to bptr, bptr becomes DAT 0, DSAFE-1
//         (STEP-8 empty cells)
//   loop  SUB   inc, @dj             cptr -= inc, i.e. A += STEP+1, B += STEP+2
//         SEQ   {cptr, <cptr         compare a pair HOP apart
//         SNE   {cptr, <cptr         ... it differs: does the pair below differ too?
//   dj    DJN.F loop, <cptr          no: decrement the cell and scan on (STEP a pass)
//   inc   SPL   *bptr, <cptr         yes: start the clear just below the find
//         MOV.I #IMPA, 1             and crawl off as an imp
//
// The step is the layout: inc's fields name bptr and cptr, so the distance from
// cptr to loop (STEP - 2) sets the scan step. A wrap of the clear writes a bomb
// over cptr and resets its pointer SKIP cells on (SPL pass) or DSAFE (DAT pass).
//
// BOOT > 0 adds King Cobra's own boot after the body: a three-line loop copies
// the scan and the clear BOOT cells on (two cells a pass, six passes, the empty
// cells between them left out), a SPL starts the copied scan, and a MOV.F #0, {0
// erases the boot pointer before the boot process dies on a DAT:
//   cboot MOV   {cfrom, {cto
//         MOV   <cfrom, <cto
//         DJN   cboot, #6
//   cto   SPL   loop+BOOT+6, cptr+BOOT+6
//         MOV.F #0, {0
//   cfrom DAT   loop+6, cptr+6
// That is 18 cycles to start the scan, where the boot combinator's copy of all
// STEP+4 cells takes 2*(STEP+4).
const CB = { cptr: 0, bptr: 1, cs0: 2, clear: 3, clear2: 4, cdjn: 5 };
const cbLoop = (P) => P.STEP - 2;
const cbSize = (P) => P.STEP + 4;
// Where the running copy's cptr is (the original under BOOT 0).
const cbHome = (api) => (api.P.BOOT ? api.add(api.at('cptr'), api.P.BOOT) : api.at('cptr'));
const cobraBody = {
  id: 'cobra-body',
  kind: 'body', exit: 'never', processes: 1, grows: true, writes: 'core', roams: true, dialects: '94',
  purpose: 'King Cobra oneshot (also Kaitain): a four-line scan steps a pair of pointers HOP apart by STEP (the distance from its clear to its scan sets the step) and commits only when two adjacent pairs differ; it then starts a SPL #0-pumped clear just below the find and leaves itself as a MOV.I imp. The clear lays SPLs that skip SKIP cells past itself on each wrap, while a DJN.F stream from its pump walks the core; when the stream reaches the bomb pointer the clear lays DATs (skip DSAFE) for good. Alone it commits on its own image after one lap.',
  params: { STEP: [8, 400], HOP: [1, 60], ZOFS: [100, 54000], DJS: [8, 54000], SKIP: [30, 27000], DSAFE: [6, 60], IMPA: [0, 54000], BOOT: [0, 54000] },
  // IMPA: the imp's A-field (King Cobra's is half the core); it plays no part in the imp's step.
  defaults: { STEP: 19, HOP: 10, ZOFS: 2372, DJS: 124, SKIP: 1077, DSAFE: 9, IMPA: 4000, BOOT: 0 },
  entry: 'go', loop: 'loop', entryFirst: false,
  mutable: [['cptr', ['a', 'b']], ['bptr', ['a', 'b']], ['cs0', ['a']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [], size = cbSize(P);
    if (gcd(P.STEP, core) !== 1) out.push(`cobra-body: STEP ${P.STEP} shares a factor with the ${core}-cell core, so the scan misses cells`);
    if (P.SKIP < size || P.SKIP >= core / 2) out.push(`cobra-body: SKIP must clear its own ${size} cells and stay under half the core`);
    if (P.ZOFS + P.HOP + 1 >= core - size) out.push('cobra-body: ZOFS starts the scan inside itself');
    if (P.DJS >= core - size) out.push('cobra-body: DJS starts the stream inside itself');
    if (P.BOOT && (P.BOOT < settings.maxLength + size || P.BOOT > core - settings.maxLength - size)) out.push('cobra-body: BOOT puts the copy on (or next to) the warrior');
    // The first self-commit (alone) must not start the clear on its own clear code.
    const start = cbSelfCommit(P, core);
    if (start !== null && start >= CB.bptr && start <= CB.cdjn) out.push(`cobra-body: with these numbers its first commit on itself starts the clear on its own code (cell ${start})`);
    return out;
  },
  emit(ctx) {
    const { L, P } = ctx;
    ctx.ins('cptr', 'DAT', 'F', `${P.ZOFS + P.HOP + 1}`, `${P.ZOFS}`);
    ctx.ins('bptr', 'DAT', 'F', '1', `${P.DSAFE}`);
    ctx.ins('cs0', 'SPL', 'B', `#${P.DJS}`, `${P.SKIP}`);
    ctx.ins('clear', 'MOV', 'I', `*${L('bptr')}`, `>${L('cptr')}`);
    ctx.ins('', 'MOV', 'I', `*${L('bptr')}`, `>${L('cptr')}`);
    ctx.ins('', 'DJN', 'F', L('clear'), `}${L('cs0')}`);
    for (let i = 6; i < cbLoop(P); i++) ctx.ins('', 'DAT', 'F', '0', '0');
    if (!P.BOOT) ctx.mark('go');
    ctx.ins('loop', 'SUB', 'F', L('inc'), `@${L('dj')}`);
    ctx.ins('', 'SEQ', 'I', `{${L('cptr')}`, `<${L('cptr')}`);
    ctx.ins('', 'SNE', 'I', `{${L('cptr')}`, `<${L('cptr')}`);
    ctx.ins('dj', 'DJN', 'F', L('loop'), `<${L('cptr')}`);
    ctx.ins('inc', 'SPL', 'B', `*${L('bptr')}`, `<${L('cptr')}`);
    ctx.ins('imp', 'MOV', 'I', `#${P.IMPA}`, '1');
    if (!P.BOOT) return;
    ctx.ins('go', 'MOV', 'I', `{${L('cfrom')}`, `{${L('cto')}`);
    ctx.ins('', 'MOV', 'I', `<${L('cfrom')}`, `<${L('cto')}`);
    ctx.ins('', 'DJN', 'B', L('go'), '#6');
    ctx.ins('cto', 'SPL', 'B', `${L('loop')}+${P.BOOT + 6}`, `${L('cptr')}+${P.BOOT + 6}`);
    ctx.ins('', 'MOV', 'F', '#0', '{0');
    ctx.ins('cfrom', 'DAT', 'F', `${L('loop')}+6`, `${L('cptr')}+6`);
  },
  plant(api) {
    const t = cbTarget(api);
    return [[t, MARKER], [api.add(t, -1), MARKER]];
  },
  running: (api) => {
    const home = cbHome(api), size = cbSize(api.P);
    return api.vm.processes(0).some((q) => api.rel(q, home) < size || api.vm.peek(q).op === 'MOV' && api.vm.peek(q).mod === 'I' && api.vm.peek(q).aMode === '#');
  },
  watch(api) {
    const { vm, P } = api, cptr = cbHome(api), clear = api.add(cptr, CB.clear), inc = api.add(cptr, cbLoop(P) + 4);
    const planted = api.scenario === 'cobra-body: planted target';
    const target = planted ? cbTarget(api) : null;
    let committed = null, writes = 0, spl = 0, dat = 0;
    return {
      before(pc) {
        if (pc === inc && committed === null && vm.peek(inc).op === 'SPL') committed = { cycle: vm.cycle };
        if (pc !== clear && pc !== api.add(clear, 1)) return null;
        if (vm.peek(pc).op !== 'MOV') return null;
        return { t: api.add(cptr, vm.peek(cptr).b), pc };
      },
      after(tok) {
        if (!tok) return;
        const off = api.rel(tok.t, cptr);
        if (off >= CB.bptr && off <= CB.cdjn) throw new Error('cobra-body: the clear wrote over its own clear');
        if (committed && committed.first === undefined) committed.first = tok.t;
        const x = vm.peek(tok.t);
        if (x.op === 'SPL') spl++; else if (x.op === 'DAT') dat++;
        writes++;
      },
      final() {
        if (!api.entered()) return;
        if (planted) {
          if (!committed) throw new Error('cobra-body did not commit to the planted body');
          if (committed.first === undefined || api.rel(target, committed.first) > P.HOP + 4) throw new Error('cobra-body did not start its clear at the planted body');
        }
        if (api.alone) {
          if (!committed) throw new Error('cobra-body never committed (not even on itself)');
          if (writes < 1000 || spl < 500) throw new Error(`cobra-body: its clear wrote only ${writes} bombs (${spl} SPL)`);
        }
      },
    };
  },
};

// The first commit of a lone cobra-body on its own image: the cell (offset from
// cptr) where its clear writes first, or null if it never commits within a lap.
// Pass model: from pointers (A, B) the SEQ compares A+STEP and B+STEP+1; if they
// differ the SNE compares the pair one below; both differing commits with
// B = B+STEP-1, else the pass ends with both pointers STEP (or STEP-1) on.
function cbSelfCommit(P, core) {
  const size = cbSize(P), loop = cbLoop(P);
  const full = (c) => { const o = mod(c, core); return o <= CB.cdjn || (o >= loop && o < size); };
  let A = P.ZOFS + P.HOP + 1, B = P.ZOFS;
  for (let k = 0; k < 2 * core; k++) {
    const a1 = A + P.STEP, b1 = B + P.STEP + 1;
    if (full(a1) === full(b1)) { A += P.STEP; B += P.STEP; continue; }
    if (full(a1 - 1) !== full(b1 - 1)) return mod(b1 - 2, core);
    A += P.STEP - 1; B += P.STEP - 1;
  }
  return null;
}
// A two-cell body (t-1, t) on the B side of the third pass, outside the warrior.
function cbTarget(api) {
  const { P } = api, cptr = cbHome(api);
  for (let k = 3; k < 400; k++) {
    const t = api.add(cptr, P.ZOFS + k * P.STEP + 1);
    let clear = true;
    for (let d = -P.HOP - 4; d <= P.HOP + 4 && clear; d++) if (api.inImage(api.add(t, d))) clear = false;
    if (clear) return t;
  }
  return api.add(cptr, P.ZOFS + 3 * P.STEP + 1);
}

// ---------------------------------------------------------------------------
// lattice-qscan
//
// John Metcalf's lattice quickscan with its two-stream burst built in (Azathoth,
// Arvon, Kaitain): six units of three lines test 24 cells. QDEC = 1 + 1/QFAC
// (mod core), and each unit belongs to one table row e holding
// V = QFAC*(e - ptr) + 1. Its SNE compares ptr + QDEC*V with a cell an offset
// further on; if they are equal its SEQ predecrements row e (V - 1) and, through
// it, compares e + V - 1 = ptr + QDEC*(V - 1) with that cell plus an offset. A
// pair that differs jumps to the decoder, after the unit's jump line has pointed
// the decoder's selector cells (dec.A, sel.A, zsel.A) at row e. One MUL then
// turns ptr.B (QDEC) into the pair's first cell, an SNE against an empty cell
// picks the occupied one of the pair, and the burst lays TIME pairs of DATs,
// STEP apart: one on the pointer and one GAP below it through the bomb just
// written. The rows are the B-fields of the two exits, of two table cells, of the
// last unit's jump and of the bomb, so the whole scan costs 30 cells.
//
//   dec   MUL.B  *sel, ptr        (dec.A: which selector cell names the row)
//   zsel  SNE    <tabB, @ptr      against an empty far cell: is the first cell occupied?
//   sel   ADD.B  tabA, ptr        no: step to the second cell (sel.A: the offset's row)
//   bomb  MOV    tabC, @ptr
//   ptr   MOV    tabC, *QDEC      second stream through the bomb's A-field
//         ADD    #STEP, ptr
//         DJN    bomb, #TIME
//   exitA JMP    next, Vc         row tabA-1
//   tabA  DAT    h, Vd            row tabA
//         DAT    h, Ve            row tabA+1
//         six units (the last unit's jump is row tabB-1, Va)
//   tabB  JMP    next, Vb         no hit
//   tabC  DAT    -GAP, Vf         the bomb, row tabC
const LQ_UNITS = [
  // row (relative to a label), the SNE offset row, the SEQ offset (row, -1?), the jump's mutation
  { row: ['tabA', 1], off: ['tabA', 1], seqOff: ['tabA', 1, 1], jump: ['JMP', 'B', 'dec', (L) => `}${L('sel')}`] },
  { row: ['tabB', 0], off: ['tabA', 0], seqOff: ['tabA', 0, 0], jump: ['JMP', 'B', 'dec', (L) => `{${L('dec')}`] },
  { row: ['tabB', -1], off: ['tabA', 0], seqOff: ['tabA', 0, 0], jump: ['DJN', 'A', 'dec', (L) => `{${L('dec')}`] },
  { row: ['tabC', 0], off: ['tabA', 0], seqOff: ['tabA', 0, 0], jump: ['JMP', 'B', 'dec', (L) => `}${L('dec')}`] },
  { row: ['tabA', -1], off: ['tabA', -1], seqOff: ['tabA', -1, 1], jump: ['JMP', 'B', 'dec', (L) => `{${L('sel')}`] },
  { row: ['tabA', 0], off: ['tabA', 0], seqOff: ['tabA', 0, 1], jump: null },
];
// Cells of the image, as offsets from the block's first cell (dec).
const LQ = { dec: 0, zsel: 1, sel: 2, bomb: 3, ptr: 4, exitA: 7, tabA: 8, scan: 10, tabB: 28, tabC: 29 };
const lqRow = ([lab, k]) => LQ[lab] + k;
function lqNumbers(P, core) {
  const inv = modInverse(mod(P.QFAC, core), core), qdec = mod(1 + inv, core);
  const V = (r) => mod(P.QFAC * (r - LQ.ptr) + 1, core);
  // The four cells each unit tests (offsets from ptr), and its row.
  const units = LQ_UNITS.map((u) => {
    const r = lqRow(u.row), v = V(r), o = V(lqRow(u.off)), so = V(lqRow(u.seqOff)) - u.seqOff[2];
    const x1 = mod(qdec * v, core), y1 = mod(qdec * (v - 1), core);
    return { r, v, cells: [x1, mod(x1 + o, core), y1, mod(y1 + so, core)] };
  });
  return { qdec, V, units, zero: mod(LQ.tabB - LQ.ptr + V(LQ.tabB) - 1, core) };
}
const latticeQscan = {
  id: 'lattice-qscan',
  kind: 'opening', exit: 'next', processes: 1, writes: 'sparse', link: 'fall', dialects: '94',
  purpose: 'Metcalf lattice quickscan with its burst built in (Azathoth, Arvon, Kaitain): six three-line units test 24 cells whose addresses are QDEC = 1 + 1/QFAC times six table rows kept in spare B-fields; a hit points the decoder at its row, one MUL gives the cell, and TIME passes lay a DAT on the pointer and another GAP below it, STEP apart, before it hands on. 30 cells.',
  params: { QFAC: [1, 54000], GAP: [1, 200], STEP: [1, 100], TIME: [1, 40] },
  defaults: { QFAC: 1533, GAP: 80, STEP: 7, TIME: 21 },
  entry: 'scan',
  entryFirst: false,
  mutable: [['dec', ['a']], ['zsel', ['a']], ['sel', ['a']], ['ptr', ['b']], ['exitA', ['b']], ['tabA', ['b']], ['tabA1', ['b']], ['tabB1', ['b']], ['tabB', ['b']], ['tabC', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize;
    if (!modInverse(mod(P.QFAC, core), core)) return [`lattice-qscan: QFAC ${P.QFAC} has no inverse mod ${core}`];
    if (P.TIME * P.STEP + P.GAP >= core / 4) return ['lattice-qscan: the burst is too wide'];
    return [];
  },
  linked(P, settings, at, { total }) {
    const core = settings.coreSize, room = Math.max(total, settings.maxLength), n = lqNumbers(P, core), ptr = at('ptr'), out = [];
    const inImg = (c) => mod(c, core) < room;
    const reach = (c) => { for (let d = -P.GAP - 2; d <= P.TIME * P.STEP + 2; d++) if (inImg(c + d)) return true; return false; };
    for (const u of n.units) if (u.cells.some((c) => reach(ptr + c))) { out.push(`lattice-qscan: QFAC ${P.QFAC} puts a scanned cell (or its burst) on the warrior`); break; }
    if (inImg(ptr + n.zero)) out.push('lattice-qscan: its empty reference cell is inside the warrior');
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, qdec = mod(1 + modInverse(mod(P.QFAC, core), core), core);
    // A row's value as label arithmetic, so it stays right wherever the block lands.
    const V = (lab, k = 0) => `(${P.QFAC}*(${L(lab)}+${k}-${L('ptr')})+1)`;
    const rowOf = ([lab, k]) => V(lab, k);
    const h = Math.floor(core / 2);
    ctx.ins('dec', 'MUL', 'B', `*${L('sel')}`, L('ptr'));
    ctx.ins('zsel', 'SNE', 'I', `<${L('tabB')}`, `@${L('ptr')}`);
    ctx.ins('sel', 'ADD', 'B', L('tabA'), L('ptr'));
    ctx.ins('bomb', 'MOV', 'I', L('tabC'), `@${L('ptr')}`);
    ctx.ins('ptr', 'MOV', 'I', L('tabC'), `*${qdec}`);
    ctx.ins('', 'ADD', 'AB', `#${P.STEP}`, L('ptr'));
    ctx.ins('', 'DJN', 'B', L('bomb'), `#${P.TIME}`);
    ctx.ins('exitA', 'JMP', 'B', ctx.next, V('tabA', -1));
    ctx.ins('tabA', 'DAT', 'F', `${h}`, V('tabA', 0));
    ctx.ins('tabA1', 'DAT', 'F', `${h}`, V('tabA', 1));
    LQ_UNITS.forEach((u, i) => {
      const v = rowOf(u.row), o = rowOf(u.off), so = `(${V(u.seqOff[0], u.seqOff[1])}-${u.seqOff[2]})`;
      const x1 = `${L('ptr')}+${qdec}*${v}`, y1 = `${L('ptr')}+${qdec}*(${v}-1)`;
      ctx.ins(i ? '' : 'scan', 'SNE', 'I', x1, `${x1}+${o}`);
      ctx.ins('', 'SEQ', 'I', `<(${L(u.row[0])}+${u.row[1]})`, `${y1}+${so}`);
      if (u.jump) ctx.ins('', u.jump[0], u.jump[1], L(u.jump[2]), u.jump[3](L));
      else ctx.ins('tabB1', 'DJN', 'F', L('dec'), `<${V('tabB', -1)}`);
    });
    ctx.ins('tabB', 'JMP', 'B', ctx.next, V('tabB', 0));
    ctx.ins('tabC', 'DAT', 'F', `${-P.GAP}`, V('tabC', 0));
  },
  plant(api) {
    const t = lqTarget(api);
    return t ? [[t.cell, MARKER]] : [];
  },
  watch(api) {
    const { vm, P, core } = api, bomb = api.at('bomb'), ptrCell = api.at('ptr');
    const planted = api.scenario === 'lattice-qscan: planted target';
    const t = planted ? lqTarget(api) : null;
    const want = new Set();
    if (t) for (let k = 0; k < P.TIME; k++) { want.add(mod(t.cell + k * P.STEP, core)); want.add(mod(t.cell - P.GAP + k * P.STEP, core)); }
    const hit = new Set();
    let bombs = 0;
    return {
      before(pc) {
        if (pc !== bomb && pc !== ptrCell) return null;
        const x = vm.peek(pc), y = api.code(pc === bomb ? 'bomb' : 'ptr');
        if (x.op !== y.op || x.mod !== y.mod || x.aMode !== y.aMode || x.bMode !== y.bMode) return null;  // not ours any more (an imp ran over it)
        const b = vm.peek(ptrCell).b, at = api.add(ptrCell, b);
        return pc === bomb ? at : api.add(at, vm.peek(at).a);
      },
      after(c) {
        if (c === null) return;
        if (api.inImage(c) && !api.inDead(c)) throw new Error('lattice-qscan bombed its own warrior');
        bombs++; hit.add(c);
      },
      final() {
        if (t) for (const c of want) if (!hit.has(c)) throw new Error('lattice-qscan did not burst around the planted cell');
        if (api.alone && bombs) throw new Error('lattice-qscan bombed although nothing was there');
      },
    };
  },
};
// A unit's cell outside the warrior, for the planted run: the first SNE cell of
// the fourth unit (the burst must start there).
function lqTarget(api) {
  const n = lqNumbers(api.P, api.core), ptr = api.at('ptr');
  for (const u of [n.units[3], n.units[1], n.units[0]]) {
    const cell = api.add(ptr, u.cells[0]);
    if (!api.inImage(cell)) return { cell };
  }
  return null;
}

// ---------------------------------------------------------------------------
// agony-body
//
// Excalibur's scanner (inversed's rework of Agony II). Two pair compares per
// six-line lap, a fixed-length SPL wipe on a find, and a pumped DAT clear once
// the scan comes round to itself:
//
//   pad   DAT   0, 0               its A-field is the scan's "still scanning" flag
//   scan  SUB   *y, @x             ptr += STEP (both fields)
//   ptr   SNE   -1-HOP, -1         pair HOP apart; first look at scan itself
//         SUB   *y, ptr            equal: step again
//   x     SEQ   *ptr, @ptr         (if the SNE differed this repeats its compare)
//         SLT   #SAFE, @x          B within SAFE of ptr is our own code: scan on
//         DJN.F scan, <scan-SDIST  ... with a DJN stream walking down from scan-SDIST
//   bptr  MOV.B @x, #0             found: bptr points 5 past the B cell
//         MOV   #WLEN/2, count
//   wipe  MOV   inc, <bptr         WLEN SPLs downward from 4 past the find
//   y     MOV   inc, <bptr
//   count DJN   wipe, #0
//         JMZ.A scan, pad          pad still empty: scan on
//   inc   SPL   #-STEP, -STEP      the step, and the clear's pump
//   clear MOV   kill, >y           DATs forward from bptr; over y it skips CSAFE
//         DJN.F clear, {y          with a DJN stream walking down from y
//   kill  DAT   DSAFE, CSAFE
//
// The B pointer meets scan after CORESIZE looks (STEP prime to the core): the
// wipe then covers the scan lines and pad, the JMZ falls through and the clear
// starts. Before that, the SLT keeps every find off its own code.
const AG = { pad: 0, scan: 1, ptr: 2, x: 4, slt: 5, bptr: 7, wipe: 9, y: 10, count: 11, inc: 13, clear: 14, kill: 16, size: 17 };
const agonyBody = {
  id: 'agony-body',
  kind: 'body', exit: 'never', processes: 1, grows: true, writes: 'core', roams: false, dialects: '94',
  purpose: 'Excalibur scanner (Agony style): compares pairs HOP apart, two looks per six-line lap, STEP at a time, beside a DJN stream SDIST below it; a find gets WLEN SPLs laid downward from 4 past it, then the scan goes on. When the scan comes round to itself the wipe covers its own scan lines, a flag cell stops reading empty, and it falls into a SPL-pumped DAT clear that skips CSAFE cells past its pointer on each wrap. 17 cells, one process until the clear.',
  params: { STEP: [2, 27719], HOP: [1, 60], SAFE: [20, 400], SDIST: [30, 27000], WLEN: [4, 40], DSAFE: [1, 40], CSAFE: [7, 60] },
  defaults: { STEP: 3147, HOP: 8, SAFE: 27, SDIST: 344, WLEN: 16, DSAFE: 3, CSAFE: 10 },
  entry: 'scan', loop: 'scan', entryFirst: false,
  mutable: [['ptr', ['a', 'b']], ['bptr', ['b']], ['count', ['b']], ['y', ['a', 'b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (gcd(P.STEP, core) !== 1) out.push(`agony-body: STEP ${P.STEP} shares a factor with the ${core}-cell core, so the scan never comes round to itself`);
    if (P.WLEN % 2) out.push('agony-body: WLEN must be even (two SPLs a pass)');
    if (P.SAFE < AG.kill - AG.ptr + P.HOP) out.push('agony-body: SAFE must cover its own code from ptr');
    if (P.DSAFE + P.CSAFE < 7) out.push('agony-body: DSAFE + CSAFE must be at least 7, or the clear\'s stream reaches its own code before a wrap resets it');
    // The scan stream walks down one cell a lap; it must not reach the code in the core/2 laps of a full scan.
    if (P.SDIST + Math.ceil(core / 2) + 2 * P.HOP >= core - AG.size) out.push('agony-body: SDIST is too large: the scan stream would reach its own code');
    return out;
  },
  emit(ctx) {
    const { L, P } = ctx;
    ctx.ins('pad', 'DAT', 'F', '0', '0');
    ctx.ins('scan', 'SUB', 'F', `*${L('y')}`, `@${L('x')}`);
    ctx.ins('ptr', 'SNE', 'I', `${-1 - P.HOP}`, '-1');
    ctx.ins('', 'SUB', 'F', `*${L('y')}`, L('ptr'));
    ctx.ins('x', 'SEQ', 'I', `*${L('ptr')}`, `@${L('ptr')}`);
    ctx.ins('', 'SLT', 'AB', `#${P.SAFE}`, `@${L('x')}`);
    ctx.ins('', 'DJN', 'F', L('scan'), `<(${L('scan')}-${P.SDIST})`);
    ctx.ins('bptr', 'MOV', 'B', `@${L('x')}`, '#0');
    ctx.ins('', 'MOV', 'AB', `#${P.WLEN / 2}`, L('count'));
    ctx.ins('wipe', 'MOV', 'I', L('inc'), `<${L('bptr')}`);
    ctx.ins('y', 'MOV', 'I', L('inc'), `<${L('bptr')}`);
    ctx.ins('count', 'DJN', 'B', L('wipe'), '#0');
    ctx.ins('', 'JMZ', 'A', L('scan'), L('pad'));
    ctx.ins('inc', 'SPL', 'B', `#${-P.STEP}`, `${-P.STEP}`);
    ctx.ins('clear', 'MOV', 'I', L('kill'), `>${L('y')}`);
    ctx.ins('', 'DJN', 'F', L('clear'), `{${L('y')}`);
    ctx.ins('kill', 'DAT', 'F', `${P.DSAFE}`, `${P.CSAFE}`);
  },
  plant(api) { return [[agTarget(api), MARKER]]; },
  watch(api) {
    const { vm, P } = api, home = api.self.start;
    const at = (o) => api.add(home, o);
    const planted = api.scenario === 'agony-body: planted target';
    const target = planted ? agTarget(api) : null;
    const wiped = new Set();
    let selfWipe = false, clears = 0;
    return {
      before(pc) {
        const off = api.rel(pc, home);
        if ((off === AG.wipe || off === AG.y) && vm.peek(pc).op === 'MOV') return { kind: 'wipe', t: api.add(at(AG.bptr), vm.peek(at(AG.bptr)).b - 1) };
        if (off === AG.clear && vm.peek(pc).op === 'MOV') return { kind: 'clear', t: api.add(at(AG.y), vm.peek(at(AG.y)).b) };
        return null;
      },
      after(tok) {
        if (!tok) return;
        const o = api.rel(tok.t, home);
        if (tok.kind === 'wipe') {
          if (o < AG.size) { if (o > AG.slt) throw new Error('agony-body: its wipe hit its own live code'); selfWipe = true; }
          wiped.add(tok.t);
        } else {
          if (o >= AG.count && o < AG.size) throw new Error('agony-body: its clear wrote over its own clear');
          clears++;
        }
      },
      final() {
        if (!api.entered()) return;
        if (planted) for (let d = -P.WLEN + 5; d <= 4; d++) if (!wiped.has(api.add(target, d))) throw new Error('agony-body did not wipe the planted find');
        if (selfWipe && api.alone && vm.cycle > 30000 && clears < 100) throw new Error('agony-body found itself but its clear did not run');
      },
    };
  },
};
// The B cell of the third look, outside the warrior and its wipe.
function agTarget(api) {
  const { P } = api, ptr = api.add(api.self.start, AG.ptr);
  for (let k = 3; k < 200; k++) {
    const t = api.add(ptr, -1 + k * P.STEP);
    let clear = true;
    for (let d = -P.WLEN - P.HOP - 2; d <= 6 && clear; d++) if (api.inImage(api.add(t, d))) clear = false;
    if (clear) return t;
  }
  return api.add(ptr, -1 + 3 * P.STEP);
}

// ---------------------------------------------------------------------------
// qi-qscan
//
// inversed's two-factor q^i with its burst built in. The cell q0 = MOV A0, }B0
// holds two unrelated locations; each unit compares an A location (A0 times a
// table factor) with a B location (B0 times the matching factor), then a second
// pair. A unit's jump line sets the decoder up so one or two MULs turn q0 into
// the unit's pair; `decide` picks the pair that differs and swaps the occupied
// cell into q0.B, and the burst lays BCOUNT DATs BSTEP apart from it while the
// MOV at q0 copies q0's A cell (normally empty) BHOP from each bomb.
//
// FORM 0 (pst_v4, Eternal Exile, clrsrc): six units, the second pair STEP
// further on, table rows (A1, B1), (A2, B2); 24 cells in 34 lines.
// FORM 1 (King Cobra): seven four-cell units whose second pair is the cross pair
// (A*B2, B*A2), then three two-cell units of cross pairs only; 34 cells in 41
// lines.
const m = (core, ...xs) => xs.reduce((p, x) => mod(p * mod(x, core), core), 1);
function qiUnits(P, core) {
  const { A0, B0, A1, B1, A2, B2 } = P, M = (...x) => m(core, ...x);
  if (!P.FORM) {
    const st = (x, y) => [[x, y], [mod(x + P.STEP, core), mod(y + P.STEP, core)]];
    return [st(A0, B0), st(M(A0, A2), M(B0, B2)), st(M(A0, A1), M(B0, B1)), st(M(A0, A2 - 1), M(B0, B2 - 1)),
      st(M(A0 - 1, A2), M(B0 - 1, B2)), st(M(A0, A2, B2), M(B0, A2, B2))];
  }
  const cr = (x, y, ca = B2, cb = A2) => [[x, y], [M(x, ca), M(y, cb)]];
  return [cr(A0, B0), cr(M(A0, A2), M(B0, B2)), cr(M(A0 - 1, A2), M(B0 - 1, B2)), cr(M(A0, A2 - 1), M(B0, B2 - 1), B2 - 1, A2 - 1),
    cr(M(A0, A1), M(B0, B1)), cr(M(A0, A1 - 1), M(B0, B1 - 1)), cr(M(A0, A0), M(B0, B0)),
    [[M(A0 - 1, B2), M(B0 - 1, A2)]], [[M(A0, B2 - 1), M(B0, A2 - 1)]], [[M(A0, B1 - 1), M(B0, A1 - 1)]]];
}
const qiScan = {
  id: 'qi-qscan',
  kind: 'opening', exit: 'next', processes: 1, writes: 'sparse', link: 'fall', dialects: '94',
  purpose: 'inversed\'s two-factor q^i quickscan with its burst built in: q0 holds two unrelated locations (A0, B0); each unit compares an A cell with a B cell built from matching table factors and then a second pair (FORM 0: STEP further on, six units, pst_v4; FORM 1: the cross pair, seven units and three two-cell units, King Cobra); its jump line sets up one or two MULs, a pair test swaps the occupied cell into q0.B, and BCOUNT DATs go down BSTEP apart, each with a copy of q0\'s A cell BHOP away.',
  params: { FORM: [0, 1], A0: [2, 54000], B0: [2, 54000], A1: [2, 54000], B1: [2, 54000], A2: [2, 54000], B2: [2, 54000], STEP: [1, 54000], BSTEP: [1, 100], BHOP: [1, 200], BCOUNT: [1, 40] },
  defaults: { FORM: 0, A0: 3325, B0: 7515, A1: 3270, B1: 3495, A2: 5778, B2: 4498, STEP: 3949, BSTEP: 9, BHOP: 67, BCOUNT: 21 },
  entry: 'scan',
  mutable: (P) => [['q0', ['a', 'b']], ['t1', ['a', 'b']], ['t2', ['a', 'b']], ['qb', ['a', 'b']], ['dec', ['a']], ...(P.FORM ? [['fast', ['a']]] : [['dec1', ['b']]])],
  mismatches(P, settings) {
    return P.BCOUNT * P.BSTEP + P.BHOP >= settings.coreSize / 4 ? ['qi-qscan: the burst is too wide'] : [];
  },
  linked(P, settings, at, { total }) {
    const core = settings.coreSize, q0 = at('q0'), s0 = at('scan'), s1 = at('bLoop');
    // The scan lines are done once the burst runs; the burst loop and everything else must be missed.
    const inImg = (c) => { const x = mod(c, core); return x < total && !(x >= s0 && x < s1); };
    const reach = (c) => { for (let d = -P.BHOP - 2; d <= P.BCOUNT * P.BSTEP + 2; d++) if (inImg(c + d)) return true; return false; };
    const cells = qiUnits(P, core).flat(2);
    if (cells.some((c) => reach(q0 + c))) return ['qi-qscan: a scanned cell (or its burst) lands on the warrior'];
    if (new Set(cells).size < cells.length) return ['qi-qscan: two scanned cells coincide'];
    return [];
  },
  emit(ctx) {
    const { L, P, core } = ctx, q0 = L('q0'), cell = (v) => `${q0}+${v}`, nil = () => `${-ctx.pc() - 1}`;
    const units = qiUnits(P, core);
    const jumps = P.FORM
      ? [['JMP', 'B', 'decide', '0'], ['JMP', 'B', 'dec', '0'], ['DJN', 'F', 'dec', q0], ['DJN', 'F', 'dec', L('t2')],
        ['JMP', 'B', 'dec', `<${L('qb')}`], ['DJN', 'F', 'dec', `<${L('qb')}`], ['JMP', 'B', 'dec', `}${L('dec')}`],
        ['DJN', 'F', 'fast', q0], ['DJN', 'F', 'fast', L('t2')], ['DJN', 'F', 'fast', `{${L('fast')}`]]
      : [['JMP', 'B', 'decide', '0'], ['JMP', 'B', 'dec', '0'], ['JMP', 'B', 'dec', `<${L('dec1')}`], ['DJN', 'F', 'dec', L('t2')],
        ['DJN', 'F', 'dec', q0], ['JMP', 'B', 'dec1', '0']];
    units.forEach((u, i) => {
      const [[a, b], second] = u;
      if (second) {
        ctx.ins(i ? '' : 'scan', 'SNE', 'I', cell(a), cell(b));
        ctx.ins('', 'SEQ', 'I', cell(second[0]), cell(second[1]));
      } else ctx.ins('', 'SEQ', 'I', cell(a), cell(b));
      const [op, md, to, bf] = jumps[i];
      ctx.ins('', op, md, L(to), bf);
    });
    ctx.ins('', 'JMP', 'B', ctx.next);                                     // nothing found
    if (P.FORM) {
      ctx.ins('t1', 'DAT', 'F', `${P.A1}`, `${P.B1}`);
      ctx.ins('t2', 'DAT', 'F', `${P.A2}`, `${P.B2}`);
      ctx.ins('qb', 'DAT', 'F', `>${-P.BHOP}`, `{${L('t2')}`);              // the bomb; its B names the row
      ctx.ins('dec', 'MUL', 'F', `@${L('qb')}`, q0);
      ctx.ins('decide', 'SNE', 'I', `*${q0}`, `@${q0}`);
      ctx.ins('fast', 'MUL', 'X', L('t2'), q0);                             // the cross pair
    } else {
      ctx.ins('dec1', 'MUL', 'X', L('t2'), L('t2'));
      ctx.ins('dec', 'MUL', 'F', `@${L('dec1')}`, q0);
      ctx.ins('decide', 'SNE', 'I', `*${q0}`, `@${q0}`);
      ctx.ins('', 'ADD', 'F', L('qinc'), q0);                              // the second pair
    }
    ctx.ins('', 'SEQ', 'I', nil(), `*${q0}`);                              // A cell empty: B is the hit
    ctx.ins('', 'MOV', 'X', q0, q0);
    ctx.ins('bLoop', 'MOV', 'I', L('qb'), `@${q0}`);
    ctx.ins('q0', 'MOV', 'I', `${P.A0}`, `}${P.B0}`);
    ctx.ins('', 'ADD', 'AB', `#${P.BSTEP}`, q0);
    ctx.ins('', 'DJN', 'B', L('bLoop'), `#${P.BCOUNT}`);
    ctx.ins('', 'JMP', 'B', ctx.next);
    if (!P.FORM) {
      ctx.ins('qb', 'DAT', 'F', `>${-P.BHOP}`, '>1');
      ctx.ins('t1', 'DAT', 'F', `${P.A1}`, `${P.B1}`);
      ctx.ins('t2', 'DAT', 'F', `${P.A2}`, `${P.B2}`);
      ctx.ins('qinc', 'DAT', 'F', `${P.STEP}`, `${P.STEP}`);
    }
  },
  plant(api) { return [[qiTarget(api), MARKER]]; },
  watch(api) {
    const { vm, P, core } = api, bl = api.at('bLoop'), q0 = api.at('q0'), scan = api.at('scan');
    const planted = api.scenario === 'qi-qscan: planted target';
    const t = planted ? qiTarget(api) : null;
    const hit = new Set();
    let bombs = 0;
    return {
      // Only its own burst line (an imp or a clear may run over the abandoned original later).
      before(pc) { return pc === bl && api.same(vm.peek(bl), api.code('bLoop')) ? api.add(q0, vm.peek(q0).b) : null; },
      after(c) {
        if (c === null) return;
        // Its own scan lines are done once it bursts (linked lets the burst reach them); nothing else of ours.
        if (api.inImage(c) && !api.inDead(c) && api.rel(c, scan) >= api.rel(bl, scan)) throw new Error('qi-qscan bombed its own warrior');
        bombs++; hit.add(c);
      },
      final() {
        if (t !== null) for (let k = 0; k < P.BCOUNT; k++) if (!hit.has(mod(t + k * P.BSTEP, core))) throw new Error('qi-qscan did not burst from the planted cell');
        if (api.alone && bombs) throw new Error('qi-qscan bombed although nothing was there');
      },
    };
  },
};
// The A cell of the fifth unit's second pair: the table row, a MUL, the pair
// test and the swap all run.
function qiTarget(api) {
  const u = qiUnits(api.P, api.core)[4];
  return api.add(api.at('q0'), u[1][0]);
}

// ---------------------------------------------------------------------------
// lore-vampire
//
// Forgotten Lore II (David Moore): a scanning vampire that also throws DJN.F
// bombs, waits for a prisoner before it clears, and times its own end with its
// bombs. Islands in a 99-cell block (offsets from flag; the step sets where the
// loop sits, STEP cells after bite):
//
//   0     flag  DAT   0, 0            a prisoner (or one of our own bombs) dirties it
//   1     bite  JMP   @TPTR+FIRST, -FIRST   the fang: A + B stays TPTR, so a copy
//                                     at bite+B jumps through bite+TPTR into the trap
//   S-3   boot  four setup lines: trap pointers at bite+TPTR-1..+1, a copy of the
//               trap DECOY cells past tdest, and a line that blanks the boot one
//               line a pass, so the loop is 7, 6, 5, 4 and then 3 lines long
//   S+1   loop  SUB.X #STEP-1, bite   A += STEP, B -= STEP-1 (the .X uses this
//                                     line's own B-field, bite - loop = -STEP)
//               MOV   b2, *bite       throw DJN.F #1, 1 at the A side
//         lj    JMZ.F boot, <bite     B -= 1: scan the B side; empty: next pass
//               MOV   @-2, @bite      found: drop the fang on it
//               JMZ.F loop, flag      no prisoner yet: scan on
//         tdest JMP   clear, <DECOY
//   47    gate  DAT   GA, GB           two clear pointers
//   49          DAT   <ISTEP, 9       the DAT bomb (anti-imp)
//   50    clear SPL   #11, {CTIME     pump; its B counts down; at 1 its {1 turns
//               MOV   clear, >gate    ... this line's source into the DAT
//               MOV   *-1, }gate
//               JMP   -2, <clear
//   76    b2    DJN.F #1, 1
//   94    bp    SPL   #bite+TPTR-1, <flag
//   95    trap  SPL   bp, <flag        a prisoner dirties flag and spins here
//   96          SPL   #4000, }1        counts prisoners in tsrc.A ...
//   97    tsrc  JMN.A #-MAXPROC, #-3   ... and they all die when every process is in
//   98          DAT   0, 0
//
// The A side's lattice comes round onto flag before either side reaches a live
// cell, which ends the scan if no prisoner has; `mismatches` checks that order.
const LV = { flag: 0, bite: 1, gate: 47, cbomb: 49, clear: 50, b2: 76, bp: 94, trap: 95, tcnt: 96, tsrc: 97, size: 99 };
const lvLoop = (P) => LV.bite + P.STEP;
// Offsets (from flag) of the cells that must survive the scan phase.
function lvLive(P) {
  const loop = lvLoop(P), out = [LV.bite];
  for (let i = 0; i <= 5; i++) out.push(loop + i);
  out.push(LV.gate, LV.cbomb, LV.clear, LV.clear + 1, LV.clear + 2, LV.clear + 3, LV.b2, LV.bp, LV.trap, LV.tcnt, LV.tsrc, LV.tsrc + 1);
  return out;
}
// The first pass (k >= 1) at which the A side throws at, or the B side scans, a cell (offset from flag).
function lvPass(P, core, c, side) {
  const g = gcd(P.STEP, core);
  for (let k = 1; k <= core / g + 1; k++) {
    const at = side === 'A' ? LV.bite + P.TPTR + P.FIRST + k * P.STEP : LV.bite - P.FIRST - k * P.STEP;
    if (mod(at - c, core) === 0) return k;
  }
  return Infinity;
}
const loreVampire = {
  id: 'lore-vampire',
  kind: 'body', exit: 'never', processes: 1, grows: true, writes: 'core', roams: false, dialects: '94',
  purpose: 'Forgotten Lore II vampire: each pass moves a fang\'s fields by +STEP / -STEP (their sum stays on a trap pointer), throws DJN.F #1, 1 at the A side and scans the B side, dropping the fang on anything found; the fang jumps prisoners into a trap that dirties a flag. A dirty flag (a prisoner, or the A side\'s own lattice coming round onto it) sends it into a two-stream SPL clear whose pump counts CTIME passes and then turns both streams into anti-imp DATs. 99 cells in islands; one process until the clear.',
  params: { STEP: [6, 40], FIRST: [1, 54000], TPTR: [100, 54000], DECOY: [100, 54000], GA: [7, 60], GB: [100, 54000], CTIME: [100, 54000] },
  defaults: { STEP: 24, FIRST: 117, TPTR: 218, DECOY: 6619, GA: 25, GB: 3987, CTIME: 6568 },
  entry: 'boot', loop: 'loop',
  mutable: (P) => [['flag', ['op', 'mod', 'aMode', 'a', 'bMode', 'b']], ['bite', ['a', 'b']], ['lj', ['a']], ['tdest', ['b']], ['gate', ['a', 'b']], ['clear', ['a', 'b']], ['cmov', ['a']], ['tcnt', ['a']], ['tsrc', ['a', 'b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [], loop = lvLoop(P);
    if (loop + 5 >= LV.gate) out.push('lore-vampire: STEP puts the loop on the clear');
    if (P.TPTR + 2 >= core - LV.size || P.TPTR - 1 < LV.size) out.push('lore-vampire: the trap pointers must lie outside the block');
    const dec = loop + 5 + P.DECOY;
    if (mod(dec, core) < LV.size || mod(dec + 3, core) < LV.size + 3) out.push('lore-vampire: DECOY copies the trap onto itself');
    // The timer: the A side's lattice must reach flag before either side reaches a live cell
    // (the pointer cell bite+TPTR is live for the B side, which would drop a fang on it).
    const kFlag = lvPass(P, core, LV.flag, 'A');
    if (!Number.isFinite(kFlag)) out.push('lore-vampire: its DJN bombs never reach flag, so nothing ends the scan');
    else {
      const live = lvLive(P);
      const first = Math.min(...live.map((c) => Math.min(lvPass(P, core, c, 'A'), lvPass(P, core, c, 'B'))), lvPass(P, core, LV.bite + P.TPTR, 'B'));
      if (first <= kFlag) out.push(`lore-vampire: its bombs or scan reach its own code (pass ${first}) before flag (pass ${kFlag})`);
    }
    return out;
  },
  emit(ctx) {
    const { L, P, core, settings } = ctx, loop = lvLoop(P);
    const istep = modInverse(3, core) || Math.round(core / 3);
    const start = ctx.pc(), at = (n) => { while (ctx.pc() - start < n) ctx.ins('', 'DAT', 'F', '0', '0'); };
    ctx.ins('flag', 'DAT', 'F', '0', '0');
    ctx.ins('bite', 'JMP', 'B', `@${P.TPTR + P.FIRST}`, `${-P.FIRST}`);
    at(loop - 4);
    ctx.ins('boot', 'MOV', 'X', `#(${L('trap')}-${L('bite')})-${P.TPTR + 1}`, `${L('bite')}+${P.TPTR + 1}`);
    ctx.ins('', 'MOV', 'X', `#(${L('trap')}-${L('bite')})-${P.TPTR}`, `}${L('bp')}`);
    ctx.ins('', 'MOV', 'I', `>${L('tsrc')}`, `>${L('tdest')}`);
    ctx.ins('', 'MOV', 'I', `${L('boot')}-2`, `}${L('lj')}`);
    ctx.ins('loop', 'SUB', 'X', `#${P.STEP - 1}`, L('bite'));
    ctx.ins('', 'MOV', 'I', L('b2'), `*${L('bite')}`);
    ctx.ins('lj', 'JMZ', 'F', L('boot'), `<${L('bite')}`);
    ctx.ins('', 'MOV', 'I', `@(${L('loop')}+1)`, `@${L('bite')}`);
    ctx.ins('', 'JMZ', 'F', L('loop'), L('flag'));
    ctx.ins('tdest', 'JMP', 'B', L('clear'), `<${P.DECOY}`);
    at(LV.gate);
    ctx.ins('gate', 'DAT', 'F', `${P.GA}`, `${P.GB}`);
    at(LV.cbomb);
    ctx.ins('cbomb', 'DAT', 'F', `<${istep}`, '9');
    ctx.ins('clear', 'SPL', 'B', '#11', `{${P.CTIME}`);
    ctx.ins('cmov', 'MOV', 'I', L('clear'), `>${L('gate')}`);
    ctx.ins('', 'MOV', 'I', `*${L('cmov')}`, `}${L('gate')}`);
    ctx.ins('', 'JMP', 'B', L('cmov'), `<${L('clear')}`);
    at(LV.b2);
    ctx.ins('b2', 'DJN', 'F', '#1', '1');
    at(LV.bp);
    ctx.ins('bp', 'SPL', 'B', `#${L('bite')}+${P.TPTR - 1}`, `<${L('flag')}`);
    ctx.ins('trap', 'SPL', 'B', L('bp'), `<${L('flag')}`);
    ctx.ins('tcnt', 'SPL', 'B', `#${Math.floor(core / 2)}`, '}1');
    ctx.ins('tsrc', 'JMN', 'A', `#${-settings.maxProcesses}`, '#-3');
    ctx.ins('', 'DAT', 'F', '0', '0');
  },
  watch(api) {
    const { vm, P } = api, home = api.self.start, loop = lvLoop(P);
    const off = (c) => api.rel(c, home);
    const bite = api.add(home, LV.bite);
    const live = new Set(lvLive(P));
    let clearAt = null, clears = 0, fangs = 0;
    return {
      before(pc) {
        const o = off(pc);
        if (o === loop + 5 && clearAt === null) clearAt = vm.cycle;
        if (clearAt === null && o === loop + 1) return { kind: 'djn', t: api.add(bite, vm.peek(bite).a) };
        if (clearAt === null && o === loop + 3) return { kind: 'fang', t: api.add(bite, vm.peek(bite).b) };
        if (o === LV.clear + 1) return { kind: 'clear', t: api.add(home, LV.gate + vm.peek(api.add(home, LV.gate)).b) };
        if (o === LV.clear + 2) return { kind: 'clear', t: api.add(home, LV.gate + vm.peek(api.add(home, LV.gate)).a) };
        return null;
      },
      after(tok) {
        if (!tok) return;
        const o = off(tok.t);
        if (tok.kind === 'clear') {
          if (o > LV.gate && o <= LV.clear + 3) throw new Error('lore-vampire: its clear wrote over its own clear');
          clears++;
          return;
        }
        if (o < LV.size && live.has(o)) throw new Error(`lore-vampire: its ${tok.kind === 'djn' ? 'DJN bomb' : 'fang'} hit its own live code (cell ${o})`);
        if (tok.kind === 'fang' && o === LV.bite + P.TPTR) throw new Error('lore-vampire dropped a fang on its trap pointer');
        if (tok.kind === 'fang') fangs++;
      },
      final() {
        if (!api.entered() || !api.alone) return;
        if (clearAt === null) throw new Error('lore-vampire never started its clear (its flag timer did not fire)');
        if (clears < 1000) throw new Error(`lore-vampire: its clear wrote only ${clears} bombs`);
        // A real prisoner: a lone loop where the B side looks early must be caught, and the vampire must win.
        const k = 6, cell = api.add(bite, -P.FIRST - k * P.STEP);
        const d = api.duel('victim jmp 0, 1\n', { offset: api.norm(cell - api.image.start) });
        if (!d.ours) throw new Error('lore-vampire died against a lone loop');
        if (d.theirs) throw new Error('lore-vampire did not finish a lone loop it found');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// collective-paper
//
// The Collective's paper (Roy van Rijn; Borg with one more bomb): one process
// copies the body with a counted loop and bombs three times per copied cell,
// then starts a new process at home and jumps into the copy if the cell after
// it is still empty. Every copy does the same, so the processes double each
// generation.
//
//   pGo   MOV   #CLEN, #10         a new home process: count CLEN cells (the body
//                                  and CLEN-10 cells after it, a carpet)
//   pLoop MOV   <pGo, <pDest       copy one cell, top down
//         MOV   pBmb, @bPtr        bomb at bPtr + B
//   bPtr  MOV   <BA, }BB           move a cell next to that bomb (through its A)
//         ADD   <0, >0             double both of bPtr's fields
//         MOV   pBmb, }bPtr        bomb at bPtr + A, A + 1
//         JMN   pLoop, pGo
//         SPL   >pGo, <core/2      a new process at home ...
//   pDest JMZ   @0, D              ... and into the copy, if the cell after it is empty
//   pBmb  DAT   <BHOP, <1
//
// The first lap enters at pLoop and copies only the 10 lines; the copy lands
// D - 10 cells past pDest, later ones CLEN further down each time.
const CP = { pGo: 0, pLoop: 1, bPtr: 3, spl: 7, pDest: 8, pBmb: 9, size: 10 };
// The walk of bPtr's fields: [B-side bomb, A-side bomb] offsets from bPtr, lap by lap.
function* cpWalk(P, core) {
  let a = mod(P.BA, core), b = mod(P.BB, core);
  for (;;) { const a2 = mod(2 * a, core), b2 = mod(2 * b, core); yield [b, a2]; a = mod(a2 + 1, core); b = b2; }
}
const collectivePaper = {
  id: 'collective-paper',
  kind: 'body', exit: 'never', processes: 1, grows: true, writes: 'sparse', roams: true, entryFirst: false, dialects: '94',
  purpose: 'The Collective\'s counted-copy paper: one process copies the body (10 lines, then CLEN cells a time) D cells on, bombing three times per copied cell (a DAT through a doubling pointer, a cell moved beside it, and a DAT through the pointer\'s other doubling field), then starts a new process at home and jumps into the copy if the cell after it is empty, so the processes double each generation.',
  params: { D: [200, 54000], BA: [1, 54000], BB: [1, 54000], BHOP: [1, 100], CLEN: [10, 40] },
  defaults: { D: 7730, BA: 3358, BB: 4923, BHOP: 6, CLEN: 23 },
  entry: 'pLoop', loop: 'pLoop',
  mutable: [['pGo', ['b']], ['pDest', ['b']], ['bPtr', ['a', 'b']], ['dbl', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [], room = Math.min(settings.maxLength, 100);
    // The first copies land D - 10, then CLEN further down each time: they must miss the body.
    for (let j = 0; j < 4; j++) {
      const at = mod(CP.pDest + P.D - CP.size - j * P.CLEN, core);
      if (at < CP.size + room || at > core - P.CLEN - room) { out.push(`collective-paper: copy ${j + 1} lands on (or next to) the paper`); break; }
    }
    // The bomb walk (and the cell it moves BHOP past its first bomb) keeps off the body for its first laps.
    let k = 0;
    for (const [b, a] of cpWalk(P, core)) {
      const near = (x) => mod(x + CP.bPtr + 2, core) < CP.size + 2 + P.BHOP;
      if (near(b) || near(a)) { out.push(`collective-paper: its doubling bomb walk comes back onto the paper within ${k + 1} laps`); break; }
      if (++k >= 3 * P.CLEN) break;
    }
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx;
    ctx.ins('pGo', 'MOV', 'AB', `#${P.CLEN}`, `#${CP.size}`);
    ctx.ins('pLoop', 'MOV', 'I', `<${L('pGo')}`, `<${L('pDest')}`);
    ctx.ins('', 'MOV', 'I', L('pBmb'), `@${L('bPtr')}`);
    ctx.ins('bPtr', 'MOV', 'I', `<${P.BA}`, `}${P.BB}`);
    ctx.ins('dbl', 'ADD', 'F', '<0', '>0');
    ctx.ins('', 'MOV', 'I', L('pBmb'), `}${L('bPtr')}`);
    ctx.ins('', 'JMN', 'B', L('pLoop'), L('pGo'));
    ctx.ins('', 'SPL', 'B', `>${L('pGo')}`, `<${Math.floor(core / 2)}`);
    ctx.ins('pDest', 'JMZ', 'B', '@0', `${P.D}`);
    ctx.ins('pBmb', 'DAT', 'F', `<${P.BHOP}`, '<1');
  },
  // A process on any copy's loop (the copies run the same code).
  running(api) {
    const code = [1, 2, 3, 4, 5, 6].map((k) => api.code('pGo', k));
    return api.vm.processes(0).some((q) => code.some((y) => api.same(api.vm.peek(q), y)));
  },
  watch(api) {
    const { vm, P } = api, home = api.at('pGo'), dest = api.at('pDest');
    const intact = () => [1, 2, 4, 5, 6, 7, 9].every((k) => api.same(vm.peek(api.add(home, k)), api.code('pGo', k)));
    let laps = 0, spawns = 0, entered = 0;
    return {
      before(pc) {
        if (!intact()) return null;
        if (pc === api.add(home, CP.spl)) return { kind: 'spl' };
        if (pc === dest) return { kind: 'jmz', t: api.add(dest, vm.peek(dest).b) };
        if (pc === api.add(home, CP.pLoop)) laps++;
        return null;
      },
      after(tok) {
        if (!tok) return;
        if (tok.kind === 'spl') { spawns++; return; }
        // A process that moved into a copy: count it if the copy is whole (its own bombs may
        // already have hit a later copy, which the original does not check either).
        if (vm.processes(0).includes(tok.t)) {
          const whole = [1, 2, 4, 5, 6, 7, 9].every((k) => api.same(vm.peek(api.add(tok.t, k)), api.code('pGo', k)));
          if (whole) entered++;
          else if (entered < 2) throw new Error('collective-paper moved into an incomplete copy in its first generations');
        }
      },
      final() {
        if (!api.entered() || !api.alone) return;
        if (spawns < 3 || entered < 3) throw new Error(`collective-paper made too few generations (${spawns} spawns, ${entered} moves)`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// toly-pump
//
// Tolypeutes' imp launcher (Roy van Rijn): one process on a SPL #0 pump feeds a
// three-point spiral for ever. Every pass lays a fresh imp one cell further on
// and sends one process ISTEP+1 further on than the last:
//
//   L0   SPL   #IDEST, {-(ISTEP+1)    pump; A: where the next imp is laid
//   L1   SUB.X L0, L3                 L3.A += ISTEP+1 (L0's B), L3.B -= L0's A
//   L2   MOV.I imp, }L0               lay an imp at L0 + A, A + 1
//   L3   DJN.F L0+IDEST-2(ISTEP+1), <DSTREAM   jump: launch k lands on
//                                     L0 + IDEST + (ISTEP+1)(k-1); the B side is a
//                                     DJN stream
//   imp  MOV.I #1, ISTEP
//
// Launch k lands one ring step and one cell past launch k-1, on the imps laid before it, so the
// launches line up behind the imps already running: a spiral that gains one imp
// a pass. (The original keeps the imp it copies far away, planted by its boot;
// here it is the fifth cell.)
const toly = { L0: 0, L1: 1, L2: 2, L3: 3, imp: 4, size: 5 };
const tolyStep = (P, core) => P.ISTEP || modInverse(3, core) || modInverse(13, core);
const tolyPump = {
  id: 'toly-pump',
  kind: 'body', exit: 'never', processes: 1, grows: true, writes: 'sparse', roams: true, dialects: '94',
  purpose: 'Tolypeutes\' continuous imp pump for one process: a SPL #0 pump lays a fresh MOV.I #1, ISTEP one cell further on each pass (from IDEST) and launches one process ISTEP+1 further on than the last, so each launch lands behind the imps already running and the spiral gains an imp a pass, beside a DJN stream from DSTREAM. ISTEP 0 is the three-point step (thirteen-point where three divides the core).',
  params: { IDEST: [100, 54000], ISTEP: [0, 27719], DSTREAM: [100, 54000] },
  defaults: { IDEST: 7381, ISTEP: 0, DSTREAM: 2768 },
  entry: 'L0',
  mutable: [['L0', ['a']], ['L3', ['a', 'b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, s = tolyStep(P, core), out = [];
    if (!s) return [`toly-pump: no three- or thirteen-point spiral on a ${core}-cell core`];
    // An n-point ring: n * ISTEP = 1 (mod core) for some n up to 31.
    if (!Array.from({ length: 30 }, (_, i) => i + 2).some((n) => mod(n * s, core) === 1)) out.push('toly-pump: ISTEP is not the step of a ring of 2 to 31 points');
    const room = Math.min(settings.maxLength, 200);
    if (mod(P.IDEST, core) < 2 * toly.size || mod(P.IDEST, core) > core - room - 4 * toly.size) out.push('toly-pump: IDEST lays the imps on (or beside) the warrior');
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, s = tolyStep(P, core);
    ctx.ins('L0', 'SPL', 'B', `#${P.IDEST}`, `{${-(s + 1)}`);
    ctx.ins('L1', 'SUB', 'X', L('L0'), L('L3'));
    ctx.ins('L2', 'MOV', 'I', L('imp'), `}${L('L0')}`);
    ctx.ins('L3', 'DJN', 'F', `${L('L0')}+${mod(P.IDEST - 2 * (s + 1), core)}`, `<${P.DSTREAM}`);
    ctx.ins('imp', 'MOV', 'I', '#1', `${s}`);
  },
  running(api) {
    const imp = api.code('imp');
    return api.vm.processes(0).some((q) => api.inSelf(q) || api.same(api.vm.peek(q), imp));
  },
  watch(api) {
    const { vm, P, core } = api, L3 = api.at('L3'), L0 = api.at('L0'), imp = api.code('imp'), s = tolyStep(P, core);
    // L3.A moves on ISTEP+1 every time a process passes the SUB; the launches follow it.
    let launches = 0, imps = 0, last = null;
    return {
      before(pc) {
        if (pc === L3 && vm.peek(L3).op === 'DJN') return { k: launches, a: vm.peek(L3).a, imp: vm.peek(L0).a };
        if (vm.cycle % 997 === 0) imps = Math.max(imps, vm.processes(0).filter((q) => api.same(vm.peek(q), imp)).length);
        return null;
      },
      after(tok) {
        if (!tok || launches >= 20) return;
        // Each launch aims ISTEP+1 past the one before (several processes sit between the
        // SUB and the DJN, so where the first one lands depends on the queue).
        if (last !== null && mod(tok.a - last, core) !== s + 1) throw new Error(`toly-pump: launch ${tok.k} aimed off the spiral`);
        last = tok.a;
        launches++;
      },
      final() {
        if (!api.entered() || !api.alone) return;
        if (launches < 20) throw new Error('toly-pump launched too few imps');
        if (imps < 3) throw new Error(`toly-pump: only ${imps} imps running`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// h-stone
//
// The "H-stone" of Hullabaloo and Hullab3loo (Roy van Rijn), for the lockstep
// processes of a fan boot:
//
//   hGo  SPL   #0, 0
//        MOV   hBomb, @hPtr           a bomb at hPtr + B
//   hHit ADD   #2*STEP, hPtr          B moves 2*STEP a pass
//   hPtr MOV   hBomb, }hHit-STEP*TIME through the A-field of the cell 2*STEP on:
//                                     an empty cell takes the bomb itself, a bombed
//                                     one (A = STEP + n) sends it STEP + n further,
//                                     so a wave of lockstep processes lays a short
//                                     run there
//        DJN.F -3, {SDJN              a decrement stream
//   hBomb DAT  }STEP, >1
//
// The first target is set so that, about TIME/2 passes in, a bomb lands on hHit:
// then only SPL #0 / MOV is left and the stone is a process sink, leaving the
// core to its partner. A run may land on a neighbouring line first (it does in
// the originals too); either way the bombing stops there. (The originals keep the bomb far from the stone, planted
// by their boot; here it is the sixth cell.)
const HS = { hGo: 0, hMov: 1, hHit: 2, hPtr: 3, hDjn: 4, hBomb: 5, size: 6 };
const hStone = {
  id: 'h-stone',
  kind: 'body', exit: 'never', processes: 1, grows: true, writes: 'sparse', roams: false, dialects: '94',
  purpose: 'Hullabaloo\'s H-stone for a fan boot\'s lockstep processes: a SPL #0 feeder over a loop that bombs at its pointer, moves the pointer 2*STEP, and bombs again through the A-field of the cell there (an empty cell takes the bomb, a bombed one passes it STEP and more cells on, so a wave of processes lays short runs), beside a DJN.F stream; its first target is aimed so that about TIME/2 passes in it bombs its own ADD and becomes a process sink.',
  params: { STEP: [3, 4000], TIME: [100, 54000], SDJN: [100, 54000] },
  defaults: { STEP: 17, TIME: 7485, SDJN: 2926 },
  entry: 'hGo', loop: 'hMov',
  mutable: [['hPtr', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize;
    return gcd(P.STEP, core) > 2 ? [`h-stone: STEP shares ${gcd(P.STEP, core)} with the core; its runs would never reach its own ADD`] : [];
  },
  emit(ctx) {
    const { L, P, core } = ctx;
    ctx.ins('hGo', 'SPL', 'B', '#0', '0');
    ctx.ins('hMov', 'MOV', 'I', L('hBomb'), `@${L('hPtr')}`);
    ctx.ins('hHit', 'ADD', 'AB', `#${mod(2 * P.STEP, core)}`, L('hPtr'));
    ctx.ins('hPtr', 'MOV', 'I', L('hBomb'), `}${mod(-1 - P.STEP * P.TIME, core)}`);
    ctx.ins('', 'DJN', 'F', L('hMov'), `{${P.SDJN}`);
    ctx.ins('hBomb', 'DAT', 'F', `}${P.STEP}`, '>1');
  },
  watch(api) {
    const { vm } = api, home = api.self.start, hPtr = api.add(home, HS.hPtr), hHit = api.add(home, HS.hHit);
    let off = null, bombs = 0;
    return {
      before(pc) {
        const o = api.rel(pc, home);
        if (off !== null || vm.peek(hHit).op !== 'ADD') return null;
        if (o === HS.hMov) return { t: api.add(hPtr, vm.peek(hPtr).b) };
        if (o === HS.hPtr) { const c = api.add(hPtr, vm.peek(hPtr).b); return { t: api.add(c, vm.peek(c).a) }; }
        return null;
      },
      after(tok) {
        if (!tok) return;
        const o = api.rel(tok.t, home);
        // Its runs end it: the first one onto its own loop stops the bombing (the ADD is aimed
        // at, but a run of a wave of processes may land on a neighbour first, as in the originals).
        if (o < HS.size && o !== HS.hBomb) { off = vm.cycle; return; }
        bombs++;
      },
      final() {
        if (!api.entered() || !api.alone) return;
        if (bombs < 500) throw new Error(`h-stone dropped only ${bombs} bombs before it hit itself`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// moore-paper
//
// The six-line bombing paper beside the stone in Hullab3loo, Hullabaloo, Borgir
// and their kin (after David Moore's papers), for N lockstep processes:
//
//   pGo  SPL   STEP, {3              start one process in the next copy; and count
//                                    down the copy line's source (in the 4th line's A)
//        MOV   }2, }-1               copy one cell: the body, first to last
//        MOV   pBmb, >BSTEP          an anti-imp DAT through a pointer BSTEP on
//        MOV   3, }-3                erase one cell after the copy
//        JMZ.F -4, *-1               loop while the cell after the body is empty
//   pBmb DAT   <2*ISTEP, <ISTEP
//   pEnd DAT   0, 0
//
// With N = 6 a lap copies the six lines, lays six DATs, erases the six cells
// after the copy, and moves the next copy 12 cells further on.
const MP = { pGo: 0, pBmb: 5, pEnd: 6, size: 7 };
const moorePaper = {
  id: 'moore-paper',
  kind: 'body', exit: 'never', grows: true, writes: 'sparse', roams: true, dialects: '94',
  processes: 1,
  purpose: 'Moore-style six-line looping paper (Hullab3loo, Hullabaloo, Borgir) for six lockstep processes: each lap starts the processes in the next copy STEP away, copies the body there one cell per process, drops an anti-imp DAT per process through a pointer BSTEP away, erases the six cells after the copy, and moves the next copy twelve cells on; it stops when the cell after its body is hit. Bare body for a fan boot with N = 6.',
  params: { STEP: [64, 54000], BSTEP: [64, 54000] },
  defaults: { STEP: 561, BSTEP: 7157 },
  entry: 'pGo',
  mutable: [['pGo', ['a']], ['pW', ['a']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (mod(P.STEP, core) < 2 * MP.size + 6 || mod(-P.STEP, core) < 4 * MP.size) out.push('moore-paper: STEP lands the copy on the paper');
    if (mod(P.BSTEP, core) < MP.size || mod(-P.BSTEP, core) < MP.size) out.push('moore-paper: BSTEP puts the bomb pointer on the paper');
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, s = modInverse(3, core) || Math.round(core / 3);
    ctx.ins('pGo', 'SPL', 'B', `${mod(P.STEP, core)}`, `{${L('pW')}`);
    ctx.ins('', 'MOV', 'I', `}${L('pW')}`, `}${L('pGo')}`);
    ctx.ins('', 'MOV', 'I', L('pBmb'), `>${mod(P.BSTEP, core)}`);
    ctx.ins('pW', 'MOV', 'I', `${L('pEnd')}`, `}${L('pGo')}`);
    ctx.ins('', 'JMZ', 'F', L('pGo'), `*${L('pW')}`);
    ctx.ins('pBmb', 'DAT', 'F', `<${mod(2 * s, core)}`, `<${s}`);
    ctx.ins('pEnd', 'DAT', 'F', '0', '0');
  },
  running(api) {
    const code = [1, 2, 4].map((k) => api.code('pGo', k));
    return api.vm.processes(0).some((q) => code.some((y) => api.same(api.vm.peek(q), y)));
  },
  watch(api) {
    const { vm } = api;
    const code = [1, 2, 3, 4, 5].map((k) => api.code('pGo', k));
    return {
      final() {
        if (!api.entered() || !api.alone) return;
        let n = 0;
        for (let c = 0; c < api.core; c++) if (vm.peek(c).op === 'SPL' && code.every((y, i) => api.same(vm.peek(c + 1 + i), y))) n++;
        if (n < 4) throw new Error(`moore-paper made only ${n} copies`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// q45-qscan
//
// Roy van Rijn's q^4.5 quickscan (Hullab3loo, Tolypeutes, The Collective) with
// its burst built in. The pointer's B-field holds QZ; each table row e holds
// V = 1 + QY*(e - qptr), QY*(QZ - 1) = 1, so the SEQ's predecrement through a
// row (e + V - 1) is the same cell as qptr + QZ*(V - 1): six units test 24
// cells with one MUL to decode. A SEQ through >qptr then tests qptr + QZ and
// bumps the multiplier to QZ + 1, and three two-line units reuse the rows the
// first pass decremented with the new multiplier; a last JMZ tests one more:
// 33 cells.
//
//   (6 units of three lines, the bump, 3 units of two lines, JMZ.F next, cell)
//   q0   MUL.B *q1, qptr     (q0.A: which selector names the row)
//   q2   SNE   {tA, @qptr    first cell occupied? (against an empty cell)
//   q1   ADD.B tB, qptr      no: the second (q1.A: the offset's row)
//        MOV   tC, @qptr
//   qptr MOV   tC, }QZ       burst: a DAT, and one GAP below through its A
//        ADD   #STEP, qptr
//        DJN   -3, #TIME
//        JMP   next
//
// The table comes first, PAD empty cells before the scan, because the cells a
// q^4.5 tests are only about as far apart as its rows are from qptr (the
// originals keep their rows 75 to 95 cells away, in their boots' B-fields):
//   tA-1, tA   rows qa1, qa2 (their A-fields name the empty cells z)
//   tC   DAT   >-GAP, >qc2   the bomb, and a row
//   z    two empty cells     (rows tA and tB-1 must not be neighbours: the
//                            fourth cells of their units would coincide)
//   tB-1, tB, tB+1  rows qb1, qb2, qb3
const Q45 = (P, core) => {
  const qy = modInverse(mod(P.QZ - 1, core), core);
  return { qy, qz: mod(P.QZ, core) };
};
// The rows' offsets from qptr: the table (8 cells) and PAD blanks come before the 27 scan lines and q0..MOV.
const Q45R = (P) => { const o = -(8 + P.PAD + 31); return { tA1: o, tA: o + 1, tC: o + 2, tB1: o + 5, tB: o + 6, tB2: o + 7 }; };
function q45Cells(P, core) {
  const { qy, qz } = Q45(P, core), V = (r) => mod(1 + qy * r, core), M = (a, b) => mod(a * b, core);
  const R = Q45R(P), a1 = V(R.tA1), a2 = V(R.tA), b1 = V(R.tB1), b2 = V(R.tB), b3 = V(R.tB2), c2 = V(R.tC);
  const unit = (v, o, so) => [M(qz, v), mod(M(qz, v) + o, core), M(qz, v - 1), mod(M(qz, v - 1) + so, core)];
  const first = [unit(a1, b2, b2), unit(c2, b2, b2), unit(a2, b2, b2), unit(b3, b3, b3 - 1), unit(b1, b1, b1 - 1), unit(b2, b2, b2 - 1)];
  const q1 = mod(qz + 1, core), bump = [[qz, mod(qz + b2 - 1, core)]];
  const second = [c2, a2, a1].map((v) => [M(q1, v - 1), mod(M(q1, v - 1) + b2 - 1, core)]);
  const last = [mod(M(q1, b2 - 1) + b2 - 1, core)];
  return { V: { a1, a2, b1, b2, b3, c2 }, first, bump, second, last, all: [...first.flat(), ...bump.flat(), ...second.flat(), ...last] };
}
const q45Qscan = {
  id: 'q45-qscan',
  kind: 'opening', exit: 'next', processes: 1, writes: 'sparse', link: 'fall', dialects: '94',
  purpose: 'van Rijn\'s q^4.5 quickscan with its burst built in (Hullab3loo, Tolypeutes, The Collective): six three-line units decoded by one MUL with multiplier QZ, a SEQ that bumps the multiplier to QZ+1, three two-line units reusing the decremented rows, and a last single-cell test (33 cells); a hit lays TIME pairs of DATs STEP apart, on the pointer and GAP below it, then hands on.',
  params: { QZ: [2, 54000], PAD: [0, 60], GAP: [1, 200], STEP: [1, 100], TIME: [1, 40] },
  // QZ 438 spreads the cells best for PAD 16 on 8,000 cells (no two of the 33 closer than 49).
  defaults: { QZ: 438, PAD: 16, GAP: 87, STEP: 7, TIME: 19 },
  entry: 'scan', entryFirst: false,
  mutable: [['q0', ['a']], ['q2', ['a']], ['q1', ['a']], ['qptr', ['b']], ['tA1', ['a', 'b']], ['tA', ['a', 'b']], ['tB1', ['b']], ['tB', ['b']], ['tB2', ['b']], ['tC', ['a', 'b']]],
  mismatches(P, settings) {
    const core = settings.coreSize;
    if (!Q45(P, core).qy) return [`q45-qscan: QZ - 1 has no inverse mod ${core}`];
    if (P.TIME * P.STEP + P.GAP >= core / 4) return ['q45-qscan: the burst is too wide'];
    const c = q45Cells(P, core).all;
    if (new Set(c).size < c.length) return ['q45-qscan: two scanned cells coincide'];
    return [];
  },
  linked(P, settings, at, { total }) {
    const core = settings.coreSize, qptr = at('qptr'), s0 = at('scan'), s1 = at('q0');
    const inImg = (c) => { const x = mod(c, core); return x < total && !(x >= s0 && x < s1); };
    const reach = (c) => { for (let d = -P.GAP - 2; d <= P.TIME * P.STEP + 2; d++) if (inImg(c + d)) return true; return false; };
    return q45Cells(P, core).all.some((c) => reach(qptr + c)) ? ['q45-qscan: a scanned cell (or its burst) lands on the warrior'] : [];
  },
  emit(ctx) {
    const { L, P, core } = ctx, { qz } = Q45(P, core), cells = q45Cells(P, core), at = (v) => `${L('qptr')}+${v}`;
    // The table: the qa rows' A-fields name z2 (+1, as SNE {tA predecrements them first).
    ctx.ins('tA1', 'DAT', 'F', `${L('z2')}+1`, `${cells.V.a1}`);
    ctx.ins('tA', 'DAT', 'F', `${L('z2')}+1`, `${cells.V.a2}`);
    ctx.ins('tC', 'DAT', 'F', `>${-P.GAP}`, `>${cells.V.c2}`);
    ctx.ins('z', 'DAT', 'F', '0', '0');
    ctx.ins('z2', 'DAT', 'F', '0', '0');
    ctx.ins('tB1', 'DAT', 'F', '0', `${cells.V.b1}`);
    ctx.ins('tB', 'DAT', 'F', '0', `${cells.V.b2}`);
    ctx.ins('tB2', 'DAT', 'F', '0', `${cells.V.b3}`);
    for (let i = 0; i < P.PAD; i++) ctx.ins('', 'DAT', 'F', '0', '0');
    const rows = [['tA1', ['DJN', 'A', 'q0', `{${L('q0')}`]], ['tC', ['JMP', 'B', 'q0', `}${L('q0')}`]], ['tA', ['JMP', 'B', 'q0', `{${L('q0')}`]],
      ['tB2', ['JMP', 'B', 'q0', `}${L('q1')}`]], ['tB1', ['JMP', 'B', 'q0', `{${L('q1')}`]], ['tB', ['DJN', 'F', 'q0', `<${Math.floor(core * 0.86)}`]]];
    cells.first.forEach(([x1, x2, , y2], i) => {
      ctx.ins(i ? '' : 'scan', 'SNE', 'I', at(x1), at(x2));
      ctx.ins('', 'SEQ', 'I', `<${L(rows[i][0])}`, at(y2));
      const [op, md, to, b] = rows[i][1];
      ctx.ins('', op, md, L(to), b);
    });
    ctx.ins('', 'SEQ', 'I', `>${L('qptr')}`, at(cells.bump[0][1]));
    ctx.ins('', 'JMP', 'B', L('q2'), `<${L('qptr')}`);
    cells.second.forEach(([x1, x2], i) => {
      ctx.ins('', 'SEQ', 'I', at(x1), at(x2));
      const [op, md, to, b] = rows[[1, 2, 0][i]][1];          // rows tC, tA, tA-1 again
      ctx.ins('', op, md, L(to), b);
    });
    ctx.ins('', 'JMZ', 'F', ctx.next, at(cells.last[0]));
    ctx.ins('q0', 'MUL', 'B', `*${L('q1')}`, L('qptr'));
    ctx.ins('q2', 'SNE', 'I', `{${L('tA')}`, `@${L('qptr')}`);
    ctx.ins('q1', 'ADD', 'B', L('tB'), L('qptr'));
    ctx.ins('', 'MOV', 'I', L('tC'), `@${L('qptr')}`);
    ctx.ins('qptr', 'MOV', 'I', L('tC'), `}${qz}`);
    ctx.ins('', 'ADD', 'AB', `#${P.STEP}`, L('qptr'));
    ctx.ins('', 'DJN', 'B', `${L('qptr')}-1`, `#${P.TIME}`);
    ctx.ins('', 'JMP', 'B', ctx.next);
  },
  plant(api) { return [[q45Target(api), MARKER]]; },
  watch(api) {
    const { vm, P, core } = api, qptr = api.at('qptr'), bomb = api.add(qptr, -1);
    const planted = api.scenario === 'q45-qscan: planted target';
    const t = planted ? q45Target(api) : null;
    const hit = new Set();
    let bombs = 0;
    return {
      before(pc) { return pc === bomb && api.same(vm.peek(bomb), api.code('qptr', -1)) ? api.add(qptr, vm.peek(qptr).b) : null; },
      after(c) {
        if (c === null) return;
        if (api.inImage(c) && !api.inDead(c)) throw new Error('q45-qscan bombed its own warrior');
        bombs++; hit.add(c);
      },
      final() {
        if (t !== null) for (let k = 0; k < P.TIME; k++) if (!hit.has(mod(t + k * P.STEP, core))) throw new Error('q45-qscan did not burst from the planted cell');
        if (api.alone && bombs) throw new Error('q45-qscan bombed although nothing was there');
      },
    };
  },
};
// The second cell of the second bumped unit: the bump, the MUL with QZ+1 and the pair choice all run.
function q45Target(api) {
  const c = q45Cells(api.P, api.core);
  return api.add(api.at('qptr'), c.second[1][1]);
}

export default [cobraBody, latticeQscan, agonyBody, qiScan, loreVampire, collectivePaper, tolyPump, hStone, moorePaper, q45Qscan];
