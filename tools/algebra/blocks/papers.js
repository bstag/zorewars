// Papers: bodies that copy themselves around the core and run every copy.
// How to write a block: docs/block-algebra.md. Every paper here grows (fills
// the process table) and roams (runs outside its image), so each says how to
// recognise its copies (running) and counts them when it runs alone (watch).
//
// Two copy engines appear below:
// - the Mice loop ('88): one process copies the body cell by cell with a
//   counter, then SPLs a process into the copy and moves its target on;
// - the silk stage ('94): SPL STEP, #0 then MOV.I >s, }s. The stage's B field
//   is the source and its A field the destination (and the SPL target), so the
//   N processes that pass through a stage launch N processes at the copy and
//   copy N cells to it, one each.

// The silk copy instruction, relative to its stage: MOV.I >-1, }-1.
const silkStage = (ctx, label, step) => {
  ctx.ins(label, 'SPL', 'B', `${step}`, '#0');
  ctx.ins('', 'MOV', 'I', `>${ctx.L(label)}`, `}${ctx.L(label)}`);
};
// Processes a silk of `len` cells needs: one per cell copied.
const silkLog = (len) => Math.ceil(Math.log2(len));
const norm = (x, core) => ((x % core) + core) % core;
// Do the cells [a, a + n) and [b, b + m) overlap on this core?
const overlaps = (a, n, b, m, core) => norm(a - b, core) < m || norm(b - a, core) < n;

// How many places in core hold `pattern` ([[offset, test(cell)], ...]) outside the image.
function countCopies(api, pattern) {
  let n = 0;
  for (let c = 0; c < api.core; c++) if (!api.inImage(c) && pattern.every(([k, test]) => test(api.vm.peek(c + k)))) n++;
  return n;
}
const sameAs = (api, ins) => (x) => api.same(x, ins);
const opIs = (op) => (x) => x.op === op;

// ---------------------------------------------------------------------------
// The Mice loop: cnt, start, copy, djn, spl, add, jmp, dst (8 cells, entry 1).
// Each lap copies cells 7..1 to dst - 7 .. dst - 1 (the copy of cnt is never
// needed: start rewrites it), starts a process at the copy's start, and moves
// dst on by STEP. dst is copied before it moves, so every copy throws its own
// copies its own distance away.
const MICE_LEN = 8;
function emitMice(ctx, p, D, STEP) {
  const { L } = ctx, cnt = L(`${p}Cnt`), dst = L(`${p}Dst`);
  ctx.ins(`${p}Cnt`, 'DAT', 'F', '#0', '#0');
  ctx.ins(`${p}Start`, 'MOV', 'AB', `#${MICE_LEN - 1}`, cnt);
  ctx.ins(`${p}Copy`, 'MOV', 'I', `@${cnt}`, `<${dst}`);
  ctx.ins('', 'DJN', 'B', L(`${p}Copy`), cnt);
  ctx.ins(`${p}Spl`, 'SPL', 'B', `@${dst}`);
  ctx.ins('', 'ADD', 'AB', `#${STEP}`, dst);
  ctx.ins('', 'JMP', 'B', L(`${p}Start`));
  ctx.ins(`${p}Dst`, 'DAT', 'F', '#0', `#${D}`);
}
// The first two copies must land clear of the loop itself.
function miceMismatches(D, STEP, core, what = '') {
  const first = D - 1, second = D - 1 + STEP - (MICE_LEN - 1);
  return [first, second].some((b) => overlaps(b, MICE_LEN, 0, MICE_LEN, core)) ? [`${what}its copies land on itself on a ${core}-cell core`] : [];
}
// The cells of a copy that never change (start .. jmp), as a pattern from cnt.
const micePattern = (api, p) => [1, 2, 3, 4, 5, 6].map((k) => [k, sameAs(api, api.code(`${p}Cnt`, k))]);
const miceRunning = (api, p) => {
  const code = [1, 2, 3, 4, 5, 6].map((k) => api.code(`${p}Cnt`, k));
  return api.vm.processes(0).some((q) => code.some((y) => api.same(api.vm.peek(q), y)));
};
// Every lap of the original must start a process at a complete copy.
function miceSpawnWatch(api, p, laps) {
  let seen = 0;
  return {
    before: (pc) => {
      if (seen >= laps || pc !== api.at(`${p}Spl`)) return null;
      const dst = api.at(`${p}Dst`);
      return api.norm(dst + api.vm.peek(dst).b);
    },
    after: (target) => {
      if (target === null) return;
      seen++;
      for (let k = 1; k <= 6; k++) {
        if (!api.same(api.vm.peek(target - 1 + k), api.code(`${p}Cnt`, k))) throw new Error('Mice started a process at an incomplete copy');
      }
    },
    spawns: () => seen,
  };
}

// ---------------------------------------------------------------------------
const mice = {
  kind: 'body', exit: 'never', processes: 1, grows: true, writes: 'sparse', roams: true, entryFirst: false,
  purpose: 'Mice: a counted loop copies the body D cells away, SPLs a process into the copy, and moves its target on by STEP; every copy does the same.',
  params: { D: [16, 54000], STEP: [16, 54000] }, entry: 'mStart',
  mutable: [['mCnt', ['b']], ['mDst', ['b']]],
  mismatches: (P, settings) => miceMismatches(P.D, P.STEP, settings.coreSize),
  emit(ctx) { emitMice(ctx, 'm', ctx.P.D, ctx.P.STEP); },
  running: (api) => miceRunning(api, 'm'),
  watch(api) {
    const spawn = miceSpawnWatch(api, 'm', 3);
    return {
      ...spawn,
      final: () => {
        if (!api.alone) return;
        if (spawn.spawns() < 3) throw new Error('Mice made too few laps');
        if (countCopies(api, micePattern(api, 'm')) < 3) throw new Error('Mice made too few copies');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// silk3: STAGES silk stages one after another, then a DAT. 2^K processes pass
// through once: each stage copies itself and everything after it STEP<i> away
// and starts 2^K processes there, so copies made by the first stage hold every
// stage, those of the second all but the first, and so on: several patterns.
const silkLen = (S) => 2 * S + 1;
const silk3 = {
  kind: 'body', exit: 'never', grows: true, writes: 'sparse', roams: true, dialects: '94',
  processes: (P) => 2 ** silkLog(silkLen(P.STAGES)),
  purpose: 'Multi-stage silk: STAGES stages, each copying itself and the stages after it STEP1..STEP4 away and starting a full set of processes there.',
  params: { STAGES: [2, 4], STEP1: [64, 54000], STEP2: [64, 54000], STEP3: [64, 54000], STEP4: [64, 54000] }, entry: 'sStart',
  mutable: [0, 1, 2, 3].map((i) => [`s${i}`, ['a', 'b']]),
  mismatches(P, settings) {
    const core = settings.coreSize, K = silkLog(silkLen(P.STAGES)), n = 2 ** K, out = [];
    if (settings.maxProcesses < 32 * n) out.push(`silk3 runs its processes off its end, so it needs room to grow (${32 * n} processes)`);
    const steps = [P.STEP1, P.STEP2, P.STEP3, P.STEP4].slice(0, P.STAGES);
    steps.forEach((s, i) => { if (overlaps(2 * i + s, n, -K, K + silkLen(P.STAGES), core)) out.push(`silk3: stage ${i + 1} copies onto itself`); });
    return out;
  },
  emit(ctx) {
    const { P } = ctx, K = silkLog(silkLen(P.STAGES));
    for (let i = 0; i < K; i++) ctx.ins(i ? '' : 'sStart', 'SPL', 'B', '1');
    const steps = [P.STEP1, P.STEP2, P.STEP3, P.STEP4];
    for (let i = 0; i < P.STAGES; i++) silkStage(ctx, `s${i}`, steps[i]);
    ctx.ins('sEnd', 'DAT', 'F', '#0', '#0');
  },
  running: (api) => {
    const mov = api.code('s0', 1);
    return api.vm.processes(0).some((q) => api.same(api.vm.peek(q), mov) || (api.vm.peek(q).op === 'SPL' && api.same(api.vm.peek(q + 1), mov)));
  },
  watch(api) {
    const S = api.P.STAGES, n = 2 ** silkLog(silkLen(S)), steps = [api.P.STEP1, api.P.STEP2, api.P.STEP3, api.P.STEP4];
    const movAt = Array.from({ length: S }, (_, i) => api.norm(api.at(`s${i}`) + 1));
    const runs = new Array(S).fill(0);
    return {
      before: (pc) => { const i = movAt.indexOf(api.norm(pc)); return i < 0 ? null : i; },
      after: (i) => {
        if (i === null || ++runs[i] !== n) return;
        // Stage i has copied itself and the rest of the paper to its own step.
        const d = api.at(`s${i}`) + steps[i];
        if (api.vm.peek(d).op !== 'SPL') throw new Error(`silk3: stage ${i + 1} did not copy its SPL`);
        for (let k = 1; k < silkLen(S) - 2 * i; k++) {
          if (!api.same(api.vm.peek(d + k), api.code(`s${i}`, k))) throw new Error(`silk3: stage ${i + 1} made an incomplete copy`);
        }
      },
      final: () => {
        if (!api.alone) return;
        if (runs.some((r) => r < n)) throw new Error(`silk3: a stage never ran with every process (${runs})`);
        // Copies of each stage (and what follows it), wherever they came from.
        const mov = api.code('s0', 1);
        const copies = countCopies(api, [[0, opIs('SPL')], [1, sameAs(api, mov)]]);
        if (copies < 3 * S) throw new Error('silk3 made too few copies');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// bomb-paper: a looping silk with 2^PROCS processes (4 by default, so it
// fits the limited-process hill's 8 with room for one copy). Each pass every
// process launches into the copy, copies U cells of it, moves the bomb on by
// BSTEP and drops it, then moves the next copy DELTA further on. When the
// table is full the SPLs fail and the loops keep copying and bombing; when a
// copy is killed its processes come back in a new one.
//
// Steps come in grains that divide both the 8,000 and the 55,440 cores, so
// every loop runs forever without hitting itself: its copies all land STEP
// + a multiple of 80 away (DELTA counts 80s), and its bombs INIT + a multiple
// of 16 away (BSTEP counts 16s). STEP and INIT pick the residues that miss;
// a STEP that is a multiple of 16 also keeps every copy clear of the others' bombs.
const COPY_GRAIN = 80, BOMB_GRAIN = 16;
const bombUnroll = (PROCS) => { const n = 2 ** PROCS; let u = 1; while (n * u < 8 + u) u++; return u; };
const bombSpan = (PROCS) => 8 + bombUnroll(PROCS);            // silk .. bomb
const bombLen = (PROCS) => PROCS + bombSpan(PROCS);           // with the launcher
const bombPaper = {
  kind: 'body', exit: 'never', grows: true, writes: 'sparse', roams: true, dialects: '94',
  processes: (P) => 2 ** P.PROCS,
  purpose: 'Bombing silk: 2^PROCS processes copy the paper STEP away (then 80*DELTA further each pass) and drop a DAT (BOMB 1: an anti-imp DAT) every 16*BSTEP cells from INIT; works with 8 processes.',
  params: { PROCS: [2, 3], STEP: [64, 54000], DELTA: [1, 692], BSTEP: [1, 3464], INIT: [16, 54000], BOMB: [0, 1] }, entry: 'bStart',
  mutable: [['bSilk', ['a', 'b']], ['bSeed', ['a']], ['bBomb', ['b']]],
  mismatches(P, settings) {
    const K = P.PROCS, len = bombLen(K), span = bombSpan(K), copyLen = 2 ** K * bombUnroll(K), out = [];
    // Bombs land on INIT + 16k from the bomb cell, which is the paper's last.
    const r = norm(P.INIT, BOMB_GRAIN);
    if (r < 1 || r > BOMB_GRAIN - len) out.push('bomb-paper bombs its own code');
    // Copies land on STEP + 80k from the silk, which follows the launcher.
    const c = norm(P.STEP, COPY_GRAIN);
    if (c < span || c > COPY_GRAIN - copyLen - K) out.push('bomb-paper copies onto itself');
    if (2 ** K * 2 > settings.maxProcesses) out.push('bomb-paper: no room in the process table for a copy');
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx;
    for (let i = 0; i < P.PROCS; i++) ctx.ins(i ? '' : 'bStart', 'SPL', 'B', '1');
    ctx.ins('bSilk', 'SPL', 'B', `${P.STEP}`, '#0');
    for (let u = 0; u < bombUnroll(P.PROCS); u++) ctx.ins('', 'MOV', 'I', `>${L('bSilk')}`, `}${L('bSilk')}`);
    ctx.ins('', 'ADD', 'AB', `#${P.BSTEP * BOMB_GRAIN}`, L('bBomb'));
    ctx.ins('bMov', 'MOV', 'I', L('bBomb'), `@${L('bBomb')}`);
    ctx.ins('', 'ADD', 'A', `#${P.DELTA * COPY_GRAIN}`, L('bSeed'));
    ctx.ins('', 'MOV', 'F', L('bSeed'), L('bSilk'));
    ctx.ins('', 'JMP', 'B', L('bSilk'));
    ctx.ins('bSeed', 'DAT', 'F', `#${P.STEP}`, '#0');
    // An anti-imp bomb: a process that dies on it bumps the cell a third of the core on.
    ctx.ins('bBomb', 'DAT', 'F', P.BOMB ? `>${Math.round(core / 3)}` : '#0', `#${P.INIT}`);
  },
  // A process inside a copy: some cell at or before it starts SPL, MOV.I >-1, }-1.
  running: (api) => {
    const mov = api.code('bSilk', 1), span = api.norm(api.at('bBomb') - api.at('bSilk'));
    return api.vm.processes(0).some((q) => api.vm.peek(q).op !== 'DAT'
      && Array.from({ length: span }, (_, j) => q - j).some((c) => api.vm.peek(c).op === 'SPL' && api.same(api.vm.peek(c + 1), mov)));
  },
  watch(api) {
    const U = bombUnroll(api.P.PROCS), toMov = api.at('bMov') - api.at('bSilk'), toBomb = api.at('bBomb') - api.at('bMov');
    const movCode = api.code('bMov'), bombs = new Set();
    let mine = 0;
    return {
      // Bombs dropped by the original and by its copies: each must be a DAT.
      before: (pc) => {
        const bomb = api.vm.peek(pc + toBomb);
        if (!api.same(api.vm.peek(pc), movCode) || bomb.op !== 'DAT' || (bomb.a === 0 && bomb.b === 0)) return null;
        const silk = api.norm(pc - toMov), at = api.norm(pc + toBomb);
        return { pc, silk, t: api.norm(at + api.vm.peek(at).b), mine: pc === api.at('bMov') };
      },
      after: (x) => {
        if (x === null) return;
        // The original never bombs itself. A copy its parent left short (with
        // stale cells for its seed and bomb) may: its bombs don't count.
        if (api.norm(x.t - x.silk) <= toMov + toBomb) { if (x.mine) throw new Error('bomb-paper bombed itself'); return; }
        if (api.vm.writerPc[x.t] !== x.pc || api.vm.peek(x.t).op !== 'DAT') throw new Error('bomb-paper dropped something other than its bomb');
        bombs.add(x.t);
        if (x.mine) mine++;
      },
      final: () => {
        if (!api.alone) return;
        if (mine < 1 || bombs.size < 50) throw new Error(`bomb-paper dropped too few bombs (${bombs.size})`);
        const pattern = [[0, opIs('SPL')]];
        for (let k = 1; k <= U + 5; k++) pattern.push([k, sameAs(api, api.code('bSilk', k))]);
        if (countCopies(api, pattern) < 3) throw new Error('bomb-paper made too few copies');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// boot-paper: copies its paper HOP cells away, starts it there and leaves the
// original behind as a decoy (never run again). On '94 with room to grow the
// paper is a silk of STAGES stages (steps STEP1..STEP3) whose 2^K processes are
// split off before the jump; on '88 or a limited-process hill it is a Mice
// loop (D = STEP1, STEP = STEP2) with one process.
const bootEngine = (ctx) => (ctx.old || ctx.settings.maxProcesses < 256 ? 'mice' : 'silk');
const bootBodyLen = (engine, S) => (engine === 'mice' ? MICE_LEN : silkLen(S));
const bootPaper = {
  kind: 'body', exit: 'never', grows: true, writes: 'sparse', roams: true,
  processes: (P) => 2 ** silkLog(silkLen(P.STAGES)),
  purpose: 'Boots a paper HOP cells away and leaves the original as a decoy: a STAGES-stage silk on \'94, a Mice loop on \'88 and the limited-process hill.',
  params: { HOP: [256, 54000], STAGES: [1, 3], STEP1: [64, 54000], STEP2: [64, 54000], STEP3: [64, 54000] }, entry: 'kBoot',
  mutable: [['kSrc', ['b']], ['kDst', ['b']], ['kCnt', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, engine = settings.dialect === '88' || settings.maxProcesses < 256 ? 'mice' : 'silk';
    const len = bootBodyLen(engine, P.STAGES), size = 6 + 3 + len, out = [];
    if (overlaps(P.HOP, len, len - size, size, core)) out.push('boot-paper: HOP lands on the warrior itself');
    if (engine === 'mice') out.push(...miceMismatches(P.STEP1, P.STEP2, core, 'boot-paper: '));
    else {
      const n = 2 ** silkLog(len);
      [P.STEP1, P.STEP2, P.STEP3].slice(0, P.STAGES).forEach((s, i) => { if (overlaps(2 * i + s, n, 0, len, core)) out.push(`boot-paper: stage ${i + 1} copies onto itself`); });
    }
    return out;
  },
  emit(ctx) {
    const { L, P } = ctx, engine = bootEngine(ctx), len = bootBodyLen(engine, P.STAGES);
    const src = L('kSrc'), dst = L('kDst'), end = `${L('kBody')}+${len}`;
    ctx.ins('kBoot', 'MOV', 'I', `<${src}`, `<${dst}`);
    ctx.ins('', 'DJN', 'B', L('kBoot'), L('kCnt'));
    if (engine === 'mice') ctx.ins('', 'ADD', 'AB', '#1', dst);          // the Mice loop starts at its second cell
    else for (let i = 0; i < silkLog(len); i++) ctx.ins('', 'SPL', 'B', '1');
    ctx.ins('kJmp', 'JMP', 'B', `@${dst}`);
    ctx.ins('kSrc', 'DAT', 'F', '#0', `#(${end}-${src})`);
    ctx.ins('kDst', 'DAT', 'F', '#0', `#(${end}-${dst}+${P.HOP})`);
    ctx.ins('kCnt', 'DAT', 'F', '#0', `#${len}`);
    ctx.mark('kBody');
    if (engine === 'mice') emitMice(ctx, 'km', P.STEP1, P.STEP2);
    else {
      const steps = [P.STEP1, P.STEP2, P.STEP3];
      for (let i = 0; i < P.STAGES; i++) silkStage(ctx, `k${i}`, steps[i]);
      ctx.ins('', 'DAT', 'F', '#0', '#0');
    }
  },
  running: (api) => (api.settings.dialect === '88' || api.settings.maxProcesses < 256 ? miceRunning(api, 'km') : silk3.running({ ...api, code: (l, k) => api.code(l === 's0' ? 'k0' : l, k) })),
  watch(api) {
    const mice = api.settings.dialect === '88' || api.settings.maxProcesses < 256;
    const len = bootBodyLen(mice ? 'mice' : 'silk', api.P.STAGES);
    const body = api.at(mice ? 'kmCnt' : 'k0'), copyAt = api.norm(body + api.P.HOP);
    let booted = false, started = null;
    return {
      before: (pc) => {
        if (started === null && pc === api.entry()) started = api.vm.cycle;
        if (!booted && pc === api.at('kJmp')) {
          // The paper arrives whole, HOP away, before anything jumps to it.
          for (let k = 0; k < len; k++) if (!api.same(api.vm.peek(copyAt + k), api.code(mice ? 'kmCnt' : 'k0', k))) throw new Error('boot-paper booted an incomplete copy');
          const dst = api.at('kDst'), target = api.norm(dst + api.vm.peek(dst).b);
          if (target !== api.norm(copyAt + (mice ? 1 : 0))) throw new Error('boot-paper jumped somewhere other than its copy');
          booted = true;
          return null;
        }
        // The original is a decoy: for the first 1,000 cycles nothing runs the
        // paper's code in it (later, a stray process from a broken copy may).
        if (api.vm.cycle < started + 1000 && api.norm(pc - body) < len && api.vm.peek(pc).op !== 'DAT'
          && !Array.from({ length: len }, (_, k) => api.vm.writeCycle[api.norm(body + k)]).some((c) => c >= started)) {
          throw new Error('boot-paper ran the paper it left behind');
        }
        return null;
      },
      after: () => {},
      final: () => {
        if (!api.alone) return;
        if (!booted) throw new Error('boot-paper never booted');
        const pattern = mice ? micePattern(api, 'km') : [[0, opIs('SPL')], [1, sameAs(api, api.code('k0', 1))]];
        if (countCopies(api, pattern) < 3) throw new Error('boot-paper made too few copies');
      },
    };
  },
};

const blocks = { mice, silk3, 'bomb-paper': bombPaper, 'boot-paper': bootPaper };
for (const [id, b] of Object.entries(blocks)) b.id = id;
mice.defaults = { D: 2213, STEP: 1499 };
silk3.defaults = { STAGES: 3, STEP1: 3039, STEP2: 1607, STEP3: 5113, STEP4: 2391 };
bombPaper.defaults = { PROCS: 2, STEP: 2736, DELTA: 37, BSTEP: 149, INIT: 2994, BOMB: 0 };
bootPaper.defaults = { HOP: 3700, STAGES: 2, STEP1: 2213, STEP2: 1499, STEP3: 4219 };

export default Object.values(blocks);
