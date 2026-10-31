// Silk tails and the counted-copy bombing replicator: papers whose processes
// do something after their last stage instead of dying on a DAT, and the
// limited-process "LP paper". How to write a block: docs/block-algebra.md.
// All Redcode here is written from scratch; hill warriors were studied for
// the ideas only (named in each block's header).
//
// The silk stage is the one `silk3` uses (papers.js): SPL STEP, #0 then
// MOV.I >s, }s. Its B field is the source and its A field the destination
// (and the SPL target), so the N processes that pass through a stage launch N
// processes at the copy and copy the N cells from the stage on, one each.

import { modInverse } from '../util.js';

const norm = (x, core) => ((x % core) + core) % core;
// Do the cells [a, a + n) and [b, b + m) overlap on this core?
const overlaps = (a, n, b, m, core) => norm(a - b, core) < m || norm(b - a, core) < n;
const log2up = (n) => Math.ceil(Math.log2(n));

const silkStage = (ctx, label, step) => {
  ctx.ins(label, 'SPL', 'B', `${step}`, '#0');
  ctx.ins('', 'MOV', 'I', `>${ctx.L(label)}`, `}${ctx.L(label)}`);
};
// How many places in core hold `pattern` ([[offset, test(cell)], ...]) outside the image.
function countCopies(api, pattern) {
  let n = 0;
  for (let c = 0; c < api.core; c++) if (!api.inImage(c) && pattern.every(([k, test]) => test(api.vm.peek(c + k)))) n++;
  return n;
}
const sameAs = (api, ins) => (x) => api.same(x, ins);
const opIs = (op) => (x) => x.op === op;
// A process is running a copy of a silk: it stands on a stage's MOV, or on a
// SPL followed by that MOV.
function silkRunning(api, label) {
  const mov = api.code(label, 1);
  return api.vm.processes(0).some((q) => api.same(api.vm.peek(q), mov) || (api.vm.peek(q).op === 'SPL' && api.same(api.vm.peek(q + 1), mov)));
}
// Each splitting stage i copies itself and the cells after it STEP_i away;
// refuse a step whose copy lands on the paper it is copying.
function stageMismatches(id, steps, n, len, core) {
  const out = [];
  steps.forEach((s, i) => { if (overlaps(2 * i + s, n, 0, len, core)) out.push(`${id}: stage ${i + 1} copies onto itself on a ${core}-cell core`); });
  return out;
}
// The watch for the splitting stages: once all n processes have run stage
// i's MOV, the copy STEP_i on holds the stage and the rest of the body.
function stageWatch(api, labels, steps, n, bodyFrom) {
  const movAt = labels.map((l) => api.norm(api.at(l) + 1)), runs = labels.map(() => 0);
  return {
    runs,
    before: (pc) => { const i = movAt.indexOf(api.norm(pc)); return i < 0 ? null : i; },
    after: (i) => {
      if (i === null || ++runs[i] !== n) return;
      const d = api.at(labels[i]) + steps[i];
      if (api.vm.peek(d).op !== 'SPL') throw new Error(`${api.scenario}: stage ${i + 1} did not copy its SPL`);
      const len = bodyFrom(i);
      for (let k = 1; k < len; k++) if (!api.same(api.vm.peek(d + k), api.code(labels[i], k))) throw new Error(`stage ${i + 1} made an incomplete copy`);
    },
  };
}

// ---------------------------------------------------------------------------
// silk-imps
//
// A multi-stage silk whose last stage steps IMPSTEP + 1 and whose body ends
// with an imp, MOV.I #0, IMPSTEP (IMPSTEP * POINTS = 1 mod the core, so a
// ring of POINTS such imps crawls). The processes that copied with the last
// stage fall through into the imp line, and each one writes the imp IMPSTEP
// on: onto the copy that stage has just made, one cell before that copy's own
// imp, and at the copy's MOV, so the copy's processes turn into imps as they
// arrive. Generation after generation the copies sit IMPSTEP + 1 apart, so the
// imps they leave line up into crawling imp chains; when the process table is
// full the copies stop splitting and the leftover processes keep crawling.
// Imps tie the rounds a paper would lose and blunt stones.
//
// Hill warriors with silk-imps: Blackheart, LuckyMisfortune and Electra (their
// imp stage steps 2668 against a 2667 imp on the 8,000 core). POINTS 0 picks
// 3, or 23 where 3 divides the core (55,440): in solo runs on 55,440 the
// smallest ring, 13, leaves only one imp process in seven with an imp ahead
// of it, while 23 lines up about half of them, as 3 does on 8,000.
const impPoints = (P, core) => P.POINTS || (core % 3 ? 3 : 23);
const impStep = (P, core) => modInverse(impPoints(P, core), core);
const siLen = (S) => 2 * S + 2 + 1;               // S splitting stages, the imp stage, the imp
const siProcs = (S) => 2 ** log2up(siLen(S));
const silkImps = {
  id: 'silk-imps',
  kind: 'body', exit: 'never', grows: true, writes: 'sparse', roams: true, dialects: '94',
  processes: (P) => siProcs(P.STAGES),
  purpose: 'Silk-imps: STAGES silk stages, then a last stage that steps IMPSTEP + 1 and an imp (MOV.I #0, IMPSTEP for a POINTS-point ring; 0 = 3, or 23 where 3 divides the core) that every process writes on its way out, so the copies line up into crawling imps.',
  params: { STAGES: [1, 3], STEP1: [64, 54000], STEP2: [64, 54000], STEP3: [64, 54000], POINTS: [0, 31] },
  entry: 'siStart',
  mutable: (P) => [...Array.from({ length: P.STAGES }, (_, i) => [`si${i}`, ['a', 'b']]), ['siLast', ['a', 'b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, n = siProcs(P.STAGES), len = siLen(P.STAGES), out = [];
    const S = impStep(P, core);
    if (!S) return [`silk-imps: no ${impPoints(P, core)}-point imp on a ${core}-cell core`];
    if (settings.maxProcesses < 32 * n) out.push(`silk-imps needs room to grow (${32 * n} processes)`);
    const steps = [P.STEP1, P.STEP2, P.STEP3].slice(0, P.STAGES);
    out.push(...stageMismatches('silk-imps', steps, n, len, core));
    // The imp stage copies n cells IMPSTEP + 1 on: clear of itself (a 1-point "ring" would not be).
    if (overlaps(2 * P.STAGES + S + 1, n, 0, len, core)) out.push('silk-imps: the imp stage copies onto itself');
    return out;
  },
  emit(ctx) {
    const { P, core } = ctx, S = impStep(P, core);
    for (let i = 0; i < log2up(siLen(P.STAGES)); i++) ctx.ins(i ? '' : 'siStart', 'SPL', 'B', '1');
    const steps = [P.STEP1, P.STEP2, P.STEP3];
    for (let i = 0; i < P.STAGES; i++) silkStage(ctx, `si${i}`, steps[i]);
    silkStage(ctx, 'siLast', S + 1);
    ctx.ins('siImp', 'MOV', 'I', '#0', `${S}`);
  },
  // Copies of the stages, or imps: the warrior lives on in both.
  running: (api) => silkRunning(api, 'si0') || silkRunning(api, 'siLast') || api.vm.processes(0).some((q) => api.same(api.vm.peek(q), api.code('siImp'))),
  watch(api) {
    const core = api.core, S = impStep(api.P, core), n = siProcs(api.P.STAGES), len = siLen(api.P.STAGES);
    const labels = [...Array.from({ length: api.P.STAGES }, (_, i) => `si${i}`), 'siLast'];
    const steps = [api.P.STEP1, api.P.STEP2, api.P.STEP3].slice(0, api.P.STAGES).concat(S + 1);
    const stages = stageWatch(api, labels, steps, n, (i) => len - 2 * i);
    const impAt = api.at('siImp'), imp = api.code('siImp');
    let wrote = 0;
    return {
      before: (pc) => {
        if (pc === impAt && api.same(api.vm.peek(impAt), imp)) return 'imp';
        return stages.before(pc);
      },
      after: (t) => {
        if (t === 'imp') {
          // Every process leaving the original drops the imp IMPSTEP on: the cell
          // just before the imp of the copy the last stage made.
          const at = api.norm(impAt + S);
          if (!api.same(api.vm.peek(at), imp)) throw new Error('silk-imps: the imp did not write itself IMPSTEP on');
          if (api.norm(at + 1 - (api.at('siLast') + S + 1)) !== 2) throw new Error('silk-imps: the imp does not land just before the copy\'s imp');
          wrote++;
          return;
        }
        stages.after(t);
      },
      final: () => {
        if (!api.alone) return;
        if (stages.runs.some((r) => r < n)) throw new Error(`silk-imps: a stage never ran with every process (${stages.runs})`);
        if (wrote < n) throw new Error(`silk-imps: only ${wrote} processes left through the imp`);
        // The leftover processes crawl: many stand on imps, and most of those
        // have an imp in the next cell (the chain they crawl along).
        const on = api.vm.processes(0).filter((q) => api.same(api.vm.peek(q), imp));
        const chained = on.filter((q) => api.same(api.vm.peek(q + 1), imp)).length;
        if (on.length < 100) throw new Error(`silk-imps: only ${on.length} processes run imps`);
        if (chained < on.length / 3) throw new Error(`silk-imps: the imps do not line up (${chained} of ${on.length} have an imp ahead)`);
        const copies = countCopies(api, [[0, opIs('SPL')], [1, sameAs(api, api.code('siLast', 1))], [2, sameAs(api, imp)]]);
        if (copies < 3) throw new Error('silk-imps made too few copies');
      },
    };
  },
};
silkImps.defaults = { STAGES: 2, STEP1: 3039, STEP2: 1607, STEP3: 5113, POINTS: 0 };

// ---------------------------------------------------------------------------
// silk-cc
//
// A "cc paper": a multi-stage silk whose processes, after the last stage,
// fall into a backward core clear instead of dying:
//
//   ccMov  MOV.I #0, <1         ; drop this line just below the pointer, moving it back
//   ccJmp  JMP   ccMov, #COUNT  ; the pointer: B counts down from COUNT
//
// Every process of a copy joins its clear. The MOV writes its own line (not a
// DAT) at ccJmp + COUNT - 1, then - 2, ... so the front comes back toward the
// copy; enemy processes that run a dropped line keep clearing for us. When the
// pointer reaches 0 the MOV overwrites the JMP itself, so every process of
// that copy runs off the end and dies: the clear stops on its own after
// COUNT - 1 cells and frees its processes for new copies. (A counter shared
// by several processes in a DJN can pass zero and run on for a whole lap of
// the core; this one cannot.)
//
// Hill warriors with cc tails: Shadowfax and Devilstick (an endless clear
// whose loop decrements a far cell), pppc and Swarm (a counted DJN). This is
// our own bounded version.
const ccLen = (S) => 2 * S + 2;
const ccProcs = (S) => 2 ** log2up(ccLen(S));
const silkCc = {
  id: 'silk-cc',
  kind: 'body', exit: 'never', grows: true, writes: 'sparse', roams: true, dialects: '94',
  processes: (P) => ccProcs(P.STAGES),
  purpose: 'cc paper: STAGES silk stages, then every process falls into a backward clear that drops its own MOV line over the COUNT - 1 cells ahead of the copy, far end first, and stops itself by overwriting its JMP.',
  params: { STAGES: [2, 3], STEP1: [64, 54000], STEP2: [64, 54000], STEP3: [64, 54000], COUNT: [8, 4000] },
  entry: 'ccStart',
  mutable: (P) => [...Array.from({ length: P.STAGES }, (_, i) => [`cc${i}`, ['a', 'b']]), ['ccJmp', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, n = ccProcs(P.STAGES), len = ccLen(P.STAGES), out = [];
    if (settings.maxProcesses < 32 * n) out.push(`silk-cc needs room to grow (${32 * n} processes)`);
    const steps = [P.STEP1, P.STEP2, P.STEP3].slice(0, P.STAGES);
    out.push(...stageMismatches('silk-cc', steps, n, len, core));
    // The original's clear covers ccJmp + 1 .. ccJmp + COUNT - 1: it must not
    // reach round to the paper, nor wipe a copy its own stages just made.
    const jmp = len - 1;
    if (P.COUNT - 1 >= core - len) out.push('silk-cc: the clear wraps round the core into the paper');
    steps.forEach((s, i) => { if (overlaps(2 * i + s, n, jmp + 1, P.COUNT - 1, core)) out.push(`silk-cc: the clear sweeps over stage ${i + 1}'s copy on a ${core}-cell core`); });
    return out;
  },
  emit(ctx) {
    const { P, L } = ctx;
    for (let i = 0; i < log2up(ccLen(P.STAGES)); i++) ctx.ins(i ? '' : 'ccStart', 'SPL', 'B', '1');
    const steps = [P.STEP1, P.STEP2, P.STEP3];
    for (let i = 0; i < P.STAGES; i++) silkStage(ctx, `cc${i}`, steps[i]);
    ctx.ins('ccMov', 'MOV', 'I', '#0', '<1');
    ctx.ins('ccJmp', 'JMP', 'B', L('ccMov'), `#${P.COUNT}`);
  },
  running: (api) => silkRunning(api, 'cc0') || api.vm.processes(0).some((q) => api.same(api.vm.peek(q), api.code('ccMov'))),
  watch(api) {
    const P = api.P, n = ccProcs(P.STAGES), len = ccLen(P.STAGES);
    const labels = Array.from({ length: P.STAGES }, (_, i) => `cc${i}`);
    const steps = [P.STEP1, P.STEP2, P.STEP3].slice(0, P.STAGES);
    const stages = stageWatch(api, labels, steps, n, (i) => len - 2 * i);
    const movAt = api.at('ccMov'), jmpAt = api.at('ccJmp'), mov = api.code('ccMov');
    const swept = new Set();
    let ended = false;
    return {
      before: (pc) => {
        if (pc !== movAt || !api.same(api.vm.peek(movAt), mov)) return stages.before(pc);
        const j = api.vm.peek(jmpAt);
        return { at: api.norm(jmpAt + j.b - 1) };
      },
      after: (t) => {
        if (t === null || typeof t === 'number') { stages.after(t); return; }
        // The original's clear: its own line, ahead of the copy, never further than COUNT - 1.
        const k = api.norm(t.at - jmpAt);
        if (k === 0) { ended = true; return; }
        if (k >= P.COUNT) throw new Error(`silk-cc: the clear wrote ${k} cells ahead, past COUNT - 1`);
        if (!api.same(api.vm.peek(t.at), mov) || api.vm.writerPc[t.at] !== movAt) throw new Error('silk-cc: the clear dropped something other than its own line');
        swept.add(t.at);
      },
      final: () => {
        if (!api.alone) return;
        if (stages.runs.some((r) => r < n)) throw new Error(`silk-cc: a stage never ran with every process (${stages.runs})`);
        if (swept.size < Math.min(P.COUNT - 1, 50)) throw new Error(`silk-cc: the clear covered only ${swept.size} cells`);
        // A finished sweep has overwritten its JMP, and nothing runs the original any more.
        if (ended) {
          if (swept.size !== P.COUNT - 1) throw new Error(`silk-cc: the clear ended after ${swept.size} cells, not ${P.COUNT - 1}`);
          if (!api.same(api.vm.peek(jmpAt), mov)) throw new Error('silk-cc: the finished clear did not overwrite its JMP');
          if (api.vm.processes(0).some((q) => api.inSelf(q))) throw new Error('silk-cc: processes kept running the finished clear');
        }
        const copies = countCopies(api, [[0, opIs('SPL')], [1, sameAs(api, api.code('cc0', 1))]]);
        if (copies < 3) throw new Error('silk-cc made too few copies');
      },
    };
  },
};
silkCc.defaults = { STAGES: 3, STEP1: 3039, STEP2: 1607, STEP3: 5113, COUNT: 500 };

// ---------------------------------------------------------------------------
// lp-paper
//
// A counted-copy replicator for few processes (the LP hill allows 8). One
// process copies the body, last cell first, with a counter (as Mice does), and
// every lap of the copy loop also attacks:
//
//   lCopy  MOV.I  @lCnt, <lDst    ; copy one cell
//          MOV.I  *lPtr, @lPtr    ; scatter: move the cell about to be bombed to lPtr + B
//          MOV.I  lBomb, }lPtr    ; bomb lPtr + A, then A + 1
//          ADD.F  lPtr, lPtr      ; double both pointers
//          DJN    lCopy, lCnt
//
// so the bomb walks a -> 2(a + 1), a pseudo-random walk through the core, and
// the scatter pointer doubles. Then it starts a process in the finished copy
// and moves the next copy CSTEP further on. A copy carries the pointer as it
// was when copied, a point further along the same walk, so if the walk never
// lands on the body no copy ever bombs itself: `mismatches` follows the whole
// walk and refuses one that does (or that hits the first copies while they
// are made). EXTRA copies that many cells past the body as well, wiping a
// little more of whatever sits at the destination. The process count stays
// tiny, so a scanner finds few targets, a clear meets copies spread far
// apart, and the 8-process hill does not stop it.
//
// Hill warriors with the idea: Borg and The Collective (their doubling
// pointer is a self-adding ADD on the cell above; ours names the pointer).
// The nearest block we had is `bomb-mice` (papers88.js), whose bomb steps
// along one residue class instead.
const LP = ['lCnt', 'lLoop', 'lSet', 'lCopy', 'lScat', 'lBombMov', 'lDouble', 'lDjn', 'lSpl', 'lAdv', 'lBack', 'lSeed', 'lDst', 'lPtr', 'lBomb'];
const LP_CODE = LP.slice(1, 11);                      // the cells that never change
const LPI = Object.fromEntries(LP.map((l, i) => [l, i]));
const LP_LEN = LP.length;
const lpCount = (P) => LP_LEN - 1 + P.EXTRA;          // cells copied: indices count .. 1
// Where copy j lands: its index 0, measured from the original's index 0.
const lpCopyAt = (P, j, core) => norm(LPI.lDst + P.D + j * P.CSTEP - lpCount(P) - 1, core);
// The walk: [bomb offset, scatter offset] from lPtr, lap by lap, from (A0, B0).
function* lpWalk(P, core) {
  let a = norm(P.A0, core), b = norm(P.B0, core);
  for (;;) { yield [a, b]; a = norm(2 * (a + 1), core); b = norm(2 * b, core); }
}
function lpMismatches(P, core, maxLength = LP_LEN) {
  // The walk keeps maxLength cells clear of the paper on both sides, so it
  // misses any partner laid out beside it in the warrior's image too.
  const out = [], n = lpCount(P) + 1, body = (x) => norm(x + LPI.lPtr + maxLength, core) < LP_LEN + 2 * maxLength;
  for (let j = 0; j < 3; j++) if (overlaps(lpCopyAt(P, j, core), n, 0, LP_LEN, core)) out.push(`lp-paper: copy ${j + 1} lands on the paper on a ${core}-cell core`);
  // The whole walk (it repeats within 2 * core laps) stays off the body ...
  let k = 0;
  for (const [a, b] of lpWalk(P, core)) {
    if (body(a)) { out.push(`lp-paper: its bomb walk comes within the warrior's length of itself on a ${core}-cell core`); break; }
    if (body(b)) { out.push(`lp-paper: its scatter comes within the warrior's length of itself on a ${core}-cell core`); break; }
    if (++k > 2 * core) break;
  }
  // ... and off each of the first three copies from the lap it is started on.
  const walk = lpWalk(P, core), inCopy = (i, x) => norm(x + LPI.lPtr - lpCopyAt(P, i, core), core) < n;
  for (let j = 0; j < 3 && !out.length; j++) {
    for (let lap = 0; lap < lpCount(P); lap++) {
      const [a, b] = walk.next().value;
      const hit = [...Array(j + 1).keys()].find((i) => inCopy(i, a) || inCopy(i, b));
      if (hit !== undefined) { out.push(`lp-paper: it bombs its copy ${hit + 1} on a ${core}-cell core`); break; }
    }
  }
  return out;
}
const lpPaper = {
  id: 'lp-paper',
  kind: 'body', exit: 'never', processes: 1, grows: true, writes: 'sparse', roams: true, entryFirst: false, dialects: '94',
  loop: 'lLoop',
  purpose: 'Counted-copy bombing replicator for few processes: one process copies the body (plus EXTRA cells) D cells on, CSTEP further each time; each lap of the copy also bombs along a doubling walk (a -> 2(a + 1)) and scatters the target cell to a doubling pointer.',
  params: { D: [200, 54000], CSTEP: [200, 54000], A0: [1, 54000], B0: [1, 54000], EXTRA: [0, 16] },
  entry: 'lLoop',
  mutable: [['lCnt', ['b']], ['lSeed', ['b']], ['lDst', ['b']], ['lPtr', ['a', 'b']]],
  mismatches: (P, settings) => lpMismatches(P, settings.coreSize, settings.maxLength),
  emit(ctx) {
    const { L, P } = ctx;
    ctx.ins('lCnt', 'DAT', 'F', '#0', '#0');
    ctx.ins('lLoop', 'MOV', 'AB', `#${lpCount(P)}`, L('lCnt'));
    ctx.ins('lSet', 'MOV', 'B', L('lSeed'), L('lDst'));
    ctx.ins('lCopy', 'MOV', 'I', `@${L('lCnt')}`, `<${L('lDst')}`);
    ctx.ins('lScat', 'MOV', 'I', `*${L('lPtr')}`, `@${L('lPtr')}`);
    ctx.ins('lBombMov', 'MOV', 'I', L('lBomb'), `}${L('lPtr')}`);
    ctx.ins('lDouble', 'ADD', 'F', L('lPtr'), L('lPtr'));
    ctx.ins('lDjn', 'DJN', 'B', L('lCopy'), L('lCnt'));
    ctx.ins('lSpl', 'SPL', 'B', `@${L('lDst')}`);
    ctx.ins('lAdv', 'ADD', 'AB', `#${P.CSTEP}`, L('lSeed'));
    ctx.ins('lBack', 'JMP', 'B', L('lLoop'));
    ctx.ins('lSeed', 'DAT', 'F', '#0', `#${P.D}`);
    ctx.ins('lDst', 'DAT', 'F', '#0', '#0');
    ctx.ins('lPtr', 'DAT', 'F', `#${P.A0}`, `#${P.B0}`);
    ctx.ins('lBomb', 'DAT', 'F', '#0', '#0');
  },
  // A process on any copy's loop code (the original keeps looping in its image).
  running: (api) => {
    const code = LP_CODE.map((l) => api.code(l));
    return api.vm.processes(0).some((q) => code.some((y) => api.same(api.vm.peek(q), y)));
  },
  watch(api) {
    const at = (l) => api.at(l), ptr = at('lPtr');
    // The original is the witness while its loop and pointer are intact.
    // (Late in a round another copy may land on it.)
    const intact = () => LP_CODE.every((l) => api.same(api.vm.peek(at(l)), api.code(l))) && api.vm.peek(ptr).op === 'DAT'
      && api.same(api.vm.peek(at('lBomb')), api.code('lBomb'));
    const bombs = new Set();
    let spawns = 0;
    return {
      before: (pc) => {
        if (pc !== at('lBombMov') && pc !== at('lDouble') && pc !== at('lSpl')) return null;
        if (!intact()) return null;
        const p = api.vm.peek(ptr);
        if (pc === at('lBombMov')) return { kind: 'bomb', t: api.norm(ptr + p.a), a: p.a };
        if (pc === at('lDouble')) return { kind: 'double', a: p.a, b: p.b };
        return spawns < 3 ? { kind: 'spawn', t: api.norm(at('lDst') + api.vm.peek(at('lDst')).b) } : null;
      },
      after: (x) => {
        if (x === null) return;
        const p = api.vm.peek(ptr);
        if (x.kind === 'bomb') {
          if (api.inImage(x.t)) throw new Error('lp-paper bombed its own image');
          if (api.vm.writerPc[x.t] !== at('lBombMov') || !api.same(api.vm.peek(x.t), api.code('lBomb'))) throw new Error('lp-paper dropped something other than its bomb');
          if (api.norm(p.a - x.a) !== 1) throw new Error('lp-paper: the bomb did not step its pointer');
          bombs.add(x.t);
        } else if (x.kind === 'double') {
          if (api.norm(p.a - 2 * x.a) !== 0 || api.norm(p.b - 2 * x.b) !== 0) throw new Error('lp-paper: the pointer did not double');
        } else {
          // Every early lap starts a process on a complete copy (x.t is its index 1).
          spawns++;
          for (const l of LP_CODE) if (!api.same(api.vm.peek(x.t - 1 + LPI[l]), api.code(l))) throw new Error('lp-paper started a process on an incomplete copy');
        }
      },
      final: () => {
        if (!api.alone) return;
        if (spawns < 3) throw new Error('lp-paper made too few laps');
        if (bombs.size < 20) throw new Error(`lp-paper dropped too few bombs (${bombs.size})`);
        if (countCopies(api, LP_CODE.map((l, i) => [i, sameAs(api, api.code(l))])) < 3) throw new Error('lp-paper made too few copies');
      },
    };
  },
};
// Found by a search over the four numbers for settings whose original makes
// its first copies before any copy's walk hits it, on 8,000 and 55,440 cells.
// On 8,000 the doubling walk ends on a cycle of values 64m - 2 (m runs over
// the units mod 125 when A0 + 2 is prime to 5), which includes 62, inside a
// 100-cell warrior: A0 + 2 and B0 multiples of 25 keep the cycle far away.
lpPaper.defaults = { D: 4829, CSTEP: 2580, A0: 2973, B0: 1950, EXTRA: 6 };

// ---------------------------------------------------------------------------
// tail-silk
//
// A flow-through silk with an anti-imp tail, and the two other stage shapes
// the hill's papers use. After a forward stage (copy the body STEP1 on and
// split there):
//
// - BACK 1, a backward stage: MOV.I <t0, {t1 copies the same cells again,
//   last first, reusing the forward stage's source pointer (now past the
//   body), and t1 SPL STEP2 splits into that copy: its A field was counted
//   down once per process, so it ends on the copy's first cell. No new
//   source pointer is needed.
// - the tail every process runs once: MOV.I #ISTEP, }ISTEP drops a copy of
//   itself ISTEP on (and, through the A field it finds there, a further ISTEP
//   on for the next process: down the points of an imp ring through it); MOV.I
//   tBomb, >BSTEP lays a carpet of anti-imp DATs, one cell per process.
// - MOVE 1, a moving last stage: MOV.I <tMv, {tMv copies the body once more,
//   last first, and tMv JMP STEP3 moves every process into that copy (its A
//   field, the destination, was counted down to the copy's first cell; its B
//   field is the source). The processes leave the old copy empty, a decoy,
//   instead of dying: the paper keeps moving.
// - tBomb DAT <ISTEP, <2*ISTEP: a process that dies on it (ours, at the end of
//   the flow-through, or an imp) first decrements the cells ISTEP and 2*ISTEP
//   on, the other two points of a 3-point imp ring through it, which knocks
//   the ring's imps off course.
//
// ISTEP is the POINTS-point imp step (POINTS 0: 3, or 23 where 3 divides the
// core, as in silk-imps). Hill warriors with these parts: minotaur and Timescape
// (backward stage), For John, minotaur and Electra (moving last stage), Burning
// Metal, Electra and Ziggy (the anti-imp DAT), Froth and Fizzle, pdQscan and
// SnowScan (the self-dropping line).
const tLen = (P) => 2 + 2 * P.BACK + 2 + 2 * P.MOVE + 1;
const tProcs = (P) => 2 ** log2up(tLen(P));
const tailSilk = {
  id: 'tail-silk',
  kind: 'body', exit: 'never', grows: true, writes: 'sparse', roams: true, dialects: '94',
  processes: (P) => tProcs(P),
  purpose: 'Flow-through silk with an anti-imp tail: a forward stage, BACK 1 a backward stage, then each process drops a self-copying MOV.I #ISTEP, }ISTEP and an anti-imp DAT <ISTEP, <2*ISTEP (carpet BSTEP on); MOVE 1 ends with a moving stage that jumps every process into a new copy.',
  params: { STEP1: [64, 54000], STEP2: [64, 54000], STEP3: [64, 54000], BSTEP: [64, 54000], BACK: [0, 1], MOVE: [0, 1], POINTS: [0, 31] },
  entry: 'tStart',
  mutable: (P) => [['t0', ['a', 'b']], ...(P.BACK ? [['t1', ['a', 'b']]] : []), ...(P.MOVE ? [['tMv', ['a', 'b']]] : [])],
  mismatches(P, settings) {
    const core = settings.coreSize, n = tProcs(P), len = tLen(P), out = [];
    const S = impStep(P, core);
    if (!S) return [`tail-silk: no ${impPoints(P, core)}-point imp step on a ${core}-cell core`];
    if (settings.maxProcesses < 32 * n) out.push(`tail-silk needs room to grow (${32 * n} processes)`);
    // Each stage's copy (n cells) must miss the body it copies.
    const copies = [[0, P.STEP1, 'the forward stage']];
    if (P.BACK) copies.push([2 + 1, P.STEP2 - n, 'the backward stage']);
    if (P.MOVE) copies.push([len - 2, P.STEP3 - n, 'the moving stage']);
    for (const [at, step, what] of copies) if (overlaps(at + step, n, 0, len, core)) out.push(`tail-silk: ${what} copies onto the paper on a ${core}-cell core`);
    // The dropped line and the carpet start outside the paper and its first copy.
    const drop = 2 + 2 * P.BACK, carpet = drop + 1;
    if (overlaps(drop + S, 1, 0, len, core) || overlaps(drop + 2 * S, 1, 0, len, core)) out.push('tail-silk: the dropped line lands on the paper');
    if (overlaps(carpet + P.BSTEP, n, 0, len, core)) out.push('tail-silk: the carpet lands on the paper');
    if (overlaps(carpet + P.BSTEP, n, P.STEP1, len, core)) out.push('tail-silk: the carpet lands on the forward copy');
    return out;
  },
  emit(ctx) {
    const { P, L, core } = ctx, S = impStep(P, core);
    for (let i = 0; i < log2up(tLen(P)); i++) ctx.ins(i ? '' : 'tStart', 'SPL', 'B', '1');
    silkStage(ctx, 't0', P.STEP1);
    if (P.BACK) {
      ctx.ins('', 'MOV', 'I', `<${L('t0')}`, `{${L('t1')}`);
      ctx.ins('t1', 'SPL', 'B', `${P.STEP2}`, '#0');
    }
    ctx.ins('tDrop', 'MOV', 'I', `#${S}`, `}${S}`);
    ctx.ins('tCarpet', 'MOV', 'I', L('tBomb'), `>${P.BSTEP}`);
    if (P.MOVE) {
      ctx.ins('', 'MOV', 'I', `<${L('tMv')}`, `{${L('tMv')}`);
      ctx.ins('tMv', 'JMP', 'B', `${P.STEP3}`, `#${L('t0')}-${L('tMv')}+${tProcs(P)}`);
    }
    ctx.ins('tBomb', 'DAT', 'F', `<${S}`, `<${2 * S}`);
  },
  running: (api) => silkRunning(api, 't0'),
  watch(api) {
    const P = api.P, core = api.core, S = impStep(P, core), n = tProcs(P), len = tLen(P);
    const t0 = api.at('t0'), dropAt = api.at('tDrop'), carpetAt = api.at('tCarpet'), bombAt = api.at('tBomb');
    const drop = api.code('tDrop'), bomb = api.code('tBomb');
    const stages = stageWatch(api, ['t0'], [P.STEP1], n, () => len);
    // The backward and moving stages: once all n processes have copied, the
    // copy (ending where the pointer was counted down to) holds the body.
    const backMov = P.BACK ? api.norm(t0 + 2) : null, mvMov = P.MOVE ? api.norm(api.at('tMv') - 1) : null;
    const runs = { back: 0, move: 0 };
    const copyAt = (step, from) => api.norm(from + step - n);
    const whole = (start, what) => {
      for (let k = 0; k < len; k++) {
        const x = api.vm.peek(start + k), want = api.code('t0', k);
        if (k === 0 ? x.op !== 'SPL' : (!api.same(x, want) && !(P.BACK && k === 3) && !(P.MOVE && k === len - 2))) throw new Error(`tail-silk: ${what} made an incomplete copy (cell ${k})`);
      }
    };
    let drops = 0, carpets = 0, jumped = 0, died = 0, split = 0;
    return {
      before: (pc) => {
        if (pc === backMov) return { kind: 'back' };
        if (pc === mvMov) return { kind: 'move' };
        if (pc === dropAt && api.same(api.vm.peek(dropAt), drop)) {
          const c = api.norm(dropAt + S);
          return { kind: 'drop', t: api.norm(c + api.vm.peek(c).a), c };
        }
        if (pc === carpetAt && api.same(api.vm.peek(carpetAt), api.code('tCarpet'))) {
          const c = api.norm(carpetAt + P.BSTEP);
          return { kind: 'carpet', t: api.norm(c + api.vm.peek(c).b) };
        }
        if (P.MOVE && jumped < n && pc === api.at('tMv')) return { kind: 'jump', want: api.norm(api.at('tMv') + api.vm.peek(api.at('tMv')).a) };
        if (P.BACK && split < n && pc === api.at('t1')) return { kind: 'split', want: api.norm(api.at('t1') + api.vm.peek(api.at('t1')).a) };
        if (pc === bombAt && api.same(api.vm.peek(bombAt), bomb)) return { kind: 'die' };
        return stages.before(pc);
      },
      after: (x) => {
        if (x === null || typeof x === 'number') { stages.after(x); return; }
        if (x.kind === 'back' && ++runs.back === n) whole(copyAt(P.STEP2, api.at('t1')), 'the backward stage');
        else if (x.kind === 'move' && ++runs.move === n) whole(copyAt(P.STEP3, api.at('tMv')), 'the moving stage');
        else if (x.kind === 'drop') {
          if (!api.same(api.vm.peek(x.t), drop)) throw new Error('tail-silk: the dropped line did not copy itself');
          drops++;
        } else if (x.kind === 'carpet') {
          if (!api.same(api.vm.peek(x.t), bomb)) throw new Error('tail-silk: the carpet did not lay its bomb');
          carpets++;
        } else if (x.kind === 'jump') {
          // The moving stage sends every process to the copy it has just made.
          if (x.want !== copyAt(P.STEP3, api.at('tMv'))) throw new Error('tail-silk: the moving stage jumped somewhere other than its copy');
          jumped++;
        } else if (x.kind === 'split') {
          if (x.want !== copyAt(P.STEP2, api.at('t1'))) throw new Error('tail-silk: the backward stage split somewhere other than its copy');
          split++;
        } else if (x.kind === 'die') died++;
      },
      final: () => {
        if (!api.alone) return;
        if (stages.runs[0] < n) throw new Error('tail-silk: the forward stage never ran with every process');
        if (P.BACK && (runs.back < n || split < n)) throw new Error('tail-silk: the backward stage never ran with every process');
        if (drops < n || carpets < n) throw new Error(`tail-silk: the tail ran too rarely (${drops} drops, ${carpets} bombs)`);
        if (P.MOVE ? jumped < n : died < n) throw new Error(P.MOVE ? 'tail-silk: the moving stage moved too few processes' : 'tail-silk: too few processes ran off the end');
        const copies = countCopies(api, [[0, opIs('SPL')], [1, sameAs(api, api.code('t0', 1))]]);
        if (copies < 3) throw new Error('tail-silk made too few copies');
      },
    };
  },
};
tailSilk.defaults = { STEP1: 3039, STEP2: 1607, STEP3: 5113, BSTEP: 2376, BACK: 1, MOVE: 0, POINTS: 0 };

const blocks = [silkImps, silkCc, lpPaper, tailSilk];
export default blocks;
