// Fan boots: the self-metering parallel boot the Koenigstuhl 94nop leaders
// use to start two bodies at once (docs/hill-recipe-book.md, openings,
// paper/stone and stones chapters). A fan of SPLs makes N processes that run
// in lockstep. Every process runs each copy line once, so a MOV line copies N
// cells for one line of code. The copy pointers live in the very cells that
// later send the processes away: a destination pointer is predecremented once
// per copy, so after the last copy it points at the first copied cell, and the
// same A-field is then the SPL or JMP vector into that copy. The launch is
// done exactly when the copy is, with no loop counter. Then the processes
// split between the two bodies, either k:1 (each spawns K processes into the
// first body and then enters the second) or by a DJN counter (N-1 to the
// first body, the last one to the second).
//
//   fanboot-paper-stone  the paper/stone boot (Azathoth, Arvon, pst_v4,
//                        Hullabaloo, Dance of Fallen Angels, Neith): N boot
//                        processes, N*K into a counted stone, N into a silk
//   fanboot-stone-imp    the stone/imp boot (Uninvited, Red Dragon, Candy II):
//                        a DJN counter sends N-1 into the stone and the last
//                        into a continuous imp pump (the pump's stride of
//                        STEP+1 and carpet ahead of the spiral are the idea
//                        of Uninvited's and Nightstalker's pumps)
//
// The blocks carry their own bodies: a leaf cannot hold other blocks, so the
// boot of arbitrary members is a combinator's job (see the report that came
// with these blocks). All Redcode here is written from scratch.

import { modInverse } from '../util.js';

const mod = (x, core) => ((x % core) + core) % core;
const FANS = { 4: ['1', '1'], 6: ['2', '1', '1'], 8: ['1', '1', '1'] };
const STONE = 7, PAPER = 6, PUMP = 5;
const copies = (size, N) => Math.ceil(size / N);       // MOV lines to copy a body of `size` cells

// The counted stone (7 cells). The feeder's SPL #2S, #2S also holds the
// increment: ADD.F moves both pointers of `pt` on by 2*STEP a pass, and the
// A pointer starts STEP past the B pointer, so the two writes a pass walk
// START + m*STEP (m = 0, 1, 2, ...) from pt. Every pass ends on a DJN #TIME
// counter shared by all the stone's processes; the process that runs it out
// falls through and bombs the loop's first MOV, so every process dies there
// on its next pass and the feeder's new ones die at once: the stone switches
// itself off after TIME passes (as the hill stones do with a planned
// self-hit), and the paper or the imps are the warrior from then on.
function emitStone(ctx) {
  const { L, P, core } = ctx, S2 = mod(2 * P.STEP, core);
  ctx.ins('st', 'SPL', 'B', `#${S2}`, `#${S2}`);
  ctx.ins('lp', 'MOV', 'I', L('pt'), `@${L('pt')}`);
  ctx.ins('', 'MOV', 'I', L('pt'), `*${L('pt')}`);
  ctx.ins('', 'ADD', 'F', L('st'), L('pt'));
  ctx.ins('cnt', 'DJN', 'B', L('lp'), `#${P.TIME}`);
  ctx.ins('stop', 'MOV', 'I', L('pt'), L('lp'));
  ctx.ins('pt', 'DAT', 'F', `#${mod(P.START + P.STEP, core)}`, `#${mod(P.START, core)}`);
}
function emitStoneClear(ctx) {
  const { L, P, core } = ctx, step = mod(2 * P.STEP, core);
  ctx.ins('st', 'SPL', 'B', `#${step}`, `#${step}`);
  ctx.ins('lp', 'MOV', 'I', L('pt'), `@${L('pt')}`);
  ctx.ins('', 'MOV', 'I', L('pt'), `*${L('pt')}`);
  ctx.ins('', 'ADD', 'F', L('st'), L('pt'));
  ctx.ins('cnt', 'DJN', 'B', L('lp'), `#${P.TIME}`);
  ctx.ins('stop', 'MOV', 'I', L('redirect'), L('lp'));
  ctx.ins('wipe', 'MOV', 'I', L('kill'), `>${L('st')}`);
  ctx.ins('', 'JMP', 'B', L('wipe'));
  ctx.ins('redirect', 'JMP', 'B', `${L('wipe')}-${L('lp')}`);
  ctx.ins('pt', 'DAT', 'F', `#${mod(P.START + P.STEP, core)}`, `#${mod(P.START, core)}`);
  ctx.ins('kill', 'DAT', 'F', '#0', `#${L('ps')}-${L('st')}`);
}

// The m-th lattice cell, relative to the bomb pointer.
const lattice = (P, core, m) => mod(P.START + m * P.STEP, core);
// Writes before the counter runs out: two a pass, plus the passes other
// processes are part-way through when it does (bounded by SLACK).
const SLACK = 64;

// The silk (6 cells): N processes each launch one process into the next
// copy and copy one cell, then reset the copy pointers, moving the copy
// distance on by PDELTA, so copies spread over the core with N processes each.
function emitPaper(ctx) {
  const { L, P, core } = ctx;
  ctx.ins('ps', 'SPL', 'B', `${mod(P.PSTEP, core)}`, '0');
  ctx.ins('', 'MOV', 'I', `>${L('ps')}`, `}${L('ps')}`);
  ctx.ins('', 'ADD', 'A', `#${mod(P.PDELTA, core)}`, L('pd'));
  ctx.ins('', 'MOV', 'F', L('pd'), L('ps'));
  ctx.ins('', 'JMP', 'B', L('ps'));
  ctx.ins('pd', 'DAT', 'F', `#${mod(P.PSTEP, core)}`, '#0');
}

// The imp pump (5 cells). A process stays on SPL #0 and sends one process
// down the pump every turn, so the pump launches one imp a pass. Each launch
// lands one STEP and one cell further on than the last (D = STEP + 1): the
// imps already running have each moved one cell since, so the new one joins
// the spiral exactly where its predecessor writes next. The spiral's head has
// no predecessor, so every launch also lays one imp a cell further along a
// carpet ahead of it (the carpet pointer is the launch JMP's free B-field).
function emitPump(ctx) {
  const { L, P, core } = ctx, step = modInverse(P.IPOINTS, core), D = mod(step + 1, core);
  ctx.ins('ip', 'SPL', 'B', '#0', '0');
  ctx.ins('', 'MOV', 'I', L('imp'), `>${L('ij')}`);
  ctx.ins('', 'ADD', 'A', `#${D}`, L('ij'));
  ctx.ins('ij', 'JMP', 'B', `${L('imp')}-${L('ij')}-${D}`, `${L('imp')}-${L('ij')}`);
  ctx.ins('imp', 'MOV', 'I', '0', `${step}`);
}

// Checks shared by the two blocks' contracts.
function commonMismatches(P, settings, hops, stoneSize = STONE, pointer = STONE - 1) {
  const core = settings.coreSize, room = settings.maxLength, out = [];
  if (!FANS[P.N]) out.push(`the fan makes 4, 6 or 8 processes, not ${P.N}`);
  if (settings.maxProcesses < 64) out.push(`a fan boot's bodies need hundreds of processes; this hill allows ${settings.maxProcesses}`);
  // The two copies and the original must be apart (offsets from the block's first cell).
  const at = [0, ...hops].map((h) => mod(h, core));
  for (let i = 0; i < at.length; i++) for (let j = i + 1; j < at.length; j++) {
    const d = mod(at[j] - at[i], core);
    if (Math.min(d, core - d) < room + 16) out.push('the boot puts two of its bodies (or a body and the original) on top of each other');
  }
  // The stone must not bomb itself before its counter runs out.
  for (let m = 0; m < 2 * (P.TIME + SLACK); m++) {
    if (mod(lattice(P, core, m) + pointer, core) < stoneSize) { out.push(`the stone's bomb ${m} lands on the stone before its counter runs out`); break; }
  }
  return out;
}

// The fan: N processes in lockstep, all arriving at the first copy line
// together. `b0` is the first SPL's B-field (free for a pointer).
function emitFan(ctx, b0 = '0') {
  FANS[ctx.P.N].forEach((a, i) => ctx.ins(i ? '' : 'fan', 'SPL', 'B', a, i ? '0' : b0));
}

// Where things are, as offsets from the block's first cell.
function layoutPS(P) {
  const stone = P.CLEAR ? 11 : STONE, pointer = P.CLEAR ? 9 : STONE - 1;
  const fan = FANS[P.N]?.length ?? 3, ms = copies(stone, P.N), mp = copies(PAPER, P.N);
  const sv = fan + mp + ms, pv = sv + P.K, st = pv + 1, ps = st + stone;
  return { fan, ms, mp, sv, pv, st, ps, stone, pointer, size: ps + PAPER };
}
function layoutSI(P) {
  const fan = FANS[P.N]?.length ?? 3, ms = copies(STONE, P.N), mi = copies(PUMP, P.N);
  const sv = fan + ms + mi, iv = sv + 1, st = iv + 1, ip = st + STONE;
  return { fan, ms, mi, sv, iv, st, ip, size: ip + PUMP };
}

// A boot cell as the boot leaves it: its code, with the pointer fields (A, and
// B unless null) at their final values, so a cell written over later is not taken for it.
function bootCell(api, pc, label, A, B) {
  const c = api.vm.peek(pc), x = api.code(label);
  return ['op', 'mod', 'aMode', 'bMode'].every((k) => c[k] === x[k]) && api.norm(c.a) === api.norm(A ?? x.a) && (B === null || api.norm(c.b) === api.norm(B ?? x.b));
}
// The boot as it runs, seen from the gate: which processes go where, whether
// each copy is complete when its first process arrives, and the stone's
// writes and switch-off. `routes(pc)` names where a boot cell sends a process.
function fanWatch(api, { bodies, routes, expect, bootLen, pointer = STONE - 1, clear = false }) {
  const { vm, core } = api;
  const copyAt = Object.fromEntries(Object.entries(bodies).map(([k, b]) => [k, api.add(api.at(b.label), b.hop)]));
  const sent = Object.fromEntries(Object.keys(bodies).map((k) => [k, 0]));
  const arrived = new Set();
  const movRuns = new Map();
  const st = copyAt.stone, pt = api.add(st, pointer), stoneSize = bodies.stone.size;
  const inStone = (c) => api.rel(c, st) < stoneSize;
  let stopped = null, writes = new Set(), stopToken = false;
  // The stone copy still holds the stone (its counter and pointers change, and its loop is bombed when it stops).
  const stoneIntact = () => Array.from({ length: stoneSize }, (_, i) => i).every((i) => {
    const c = vm.peek(api.add(st, i)), x = api.code('st', i);
    return i === 1 || (c.op === x.op && c.mod === x.mod);
  });
  return {
    before(pc) {
      // Boot cells, while they hold what the boot leaves there (a paper copy may land on the image later).
      const r = api.rel(pc, api.at('fan')) < bootLen ? routes(pc) : null;
      if (r) {
        if (r.mov) { movRuns.set(pc, (movRuns.get(pc) ?? 0) + 1); return null; }
        return { route: r };
      }
      // A first arrival in a copy: the copy must be complete.
      for (const [k, b] of Object.entries(bodies)) {
        if (pc === copyAt[k] && !arrived.has(k)) {
          arrived.add(k);
          for (let i = 0; i < b.size; i++) if (!api.same(vm.peek(api.add(pc, i)), api.code(b.label, i))) throw new Error(`fan boot: a process entered the ${k} copy before it was complete`);
        }
      }
      // The stone copy's writes and its switch-off.
      if ((pc === api.add(st, 1) || pc === api.add(st, 2)) && vm.peek(pc).op === 'MOV' && stoneIntact()) {
        const ins = vm.peek(pt);
        return { write: api.add(pt, pc === api.add(st, 1) ? ins.b : ins.a) };
      }
      if (pc === api.add(st, 4) && vm.peek(pc).op === 'DJN' && mod(vm.peek(pc).b, core) === 1) return { lastPass: true };
      if (stopToken && pc === api.add(st, 5)) { stopToken = false; return { stop: true }; }
      return null;
    },
    after(t) {
      if (!t) return;
      if (t.route) {
        const { body, target } = t.route;
        if (target !== copyAt[body]) throw new Error(`fan boot: a boot cell sent a process to ${target}, not the ${body} copy at ${copyAt[body]} (${api.scenario})`);
        sent[body]++;
      } else if (t.write !== undefined) {
        if (stopped === null && inStone(t.write) && stoneIntact()) throw new Error('fan boot: the stone bombed itself before its counter ran out');
        writes.add(t.write);
      } else if (t.lastPass) stopToken = true;
      else if (t.stop) {
        const want = clear ? 'JMP' : 'DAT';
        if (vm.peek(api.add(st, 1)).op !== want || vm.writerPc[api.add(st, 1)] !== api.add(st, 5)) {
          throw new Error(clear ? 'fan boot: the stone did not redirect to the clear' : "fan boot: the stone's counter ran out but its loop was not bombed");
        }
        stopped = vm.cycle;
      }
    },
    final() {
      if (api.entered && !api.entered()) return;   // a switch's branch not taken
      const N = api.P.N;
      for (const [pc, n] of movRuns) if (n !== N) throw new Error(`fan boot: a copy line ran ${n} times, not once per process (${N})`);
      for (const [k, n] of Object.entries(expect)) if (sent[k] !== n) throw new Error(`fan boot: ${sent[k]} processes went to the ${k}, not ${n}`);
      for (const k of Object.keys(bodies)) if (!arrived.has(k)) throw new Error(`fan boot: nothing entered the ${k} copy`);
      if (!api.alone) return;
      if (writes.size < Math.min(100, api.P.TIME)) throw new Error(`fan boot: the stone bombed only ${writes.size} cells`);
      // (After the switch-off the paper's copies may launch processes into the
      // stone's cells, so what runs there later is not checked here; the test
      // file checks the switch-off directly on the stone/imp, which has no paper.)
    },
  };
}

// ---------------------------------------------------------------------------
// fanboot-paper-stone
//
//   fan   spl 2 / spl 1 / spl 1        N = 6 (8: three spl 1; 4: two)
//         mov <pv, {pv                 each process copies one paper cell
//         mov <sv, {sv                 ... and one stone cell (two lines if the
//   sv    spl  STONE+HOP+M, STONE+M          stone is longer than N)
//         spl  *sv                     K-1 more: K stone processes each
//   pv    jmp  PAPER+HOP+M, PAPER+M    A-field = the paper copy: enter it
//
// sv and pv each hold a body's source pointer (B) and destination (A); the
// MOVs predecrement both, so after the N-th copy the A-fields are the vectors.
const paperStone = {
  id: 'fanboot-paper-stone',
  kind: 'body', exit: 'never', grows: true, writes: 'sparse', roams: true, dialects: '94',
  purpose: 'Paper/stone fan boot: N lockstep processes copy a counted stone SHOP away and a silk PHOP away. Each worker spawns K into the stone and enters the paper. After TIME passes the stone switches off, or replaces its bombing loop with a jump into a DAT clear (CLEAR 1).',
  params: { N: [4, 8], K: [1, 4], SHOP: [256, 54000], PHOP: [256, 54000], STEP: [1, 54000], START: [1, 54000], TIME: [16, 4000], PSTEP: [100, 54000], PDELTA: [1, 54000], CLEAR: [0, 1] },
  defaults: { N: 8, K: 2, SHOP: 3360, PHOP: 860, STEP: 2377, START: 2332, TIME: 1200, PSTEP: 1777, PDELTA: 1013, CLEAR: 0 },
  entry: 'fan',
  processes: (P) => P.N * (P.K + 1),
  mutable: [['sv', ['a', 'b']], ['pv', ['a', 'b']]],
  mismatches(P, settings) {
    const out = [];
    if (P.N < PAPER) out.push(`the silk copies one cell per process, so it needs N of at least ${PAPER}`);
    const l = layoutPS(P);
    out.push(...commonMismatches(P, settings, [l.st + P.SHOP, l.ps + P.PHOP], l.stone, l.pointer));
    // While the boot runs, the stone's first bombs must miss the boot cells and the paper copy.
    const core = settings.coreSize, early = 4 * P.N * (P.K + 1);
    const ptAt = l.st + l.pointer + P.SHOP;
    for (let m = 0; m < early; m++) {
      const c = mod(ptAt + lattice(P, core, m), core);
      if (mod(c, core) < l.st) { out.push('the stone\'s first bombs hit the boot while it runs'); break; }
      const r = mod(c - (l.ps + P.PHOP), core);
      if (r < PAPER) { out.push('the stone\'s first bombs hit the paper copy'); break; }
    }
    return out;
  },
  emit(ctx) {
    const { L, P } = ctx, l = layoutPS(P), M = (n) => copies(n, P.N) * P.N;
    emitFan(ctx);
    for (let i = 0; i < l.mp; i++) ctx.ins('', 'MOV', 'I', `<${L('pv')}`, `{${L('pv')}`);
    for (let i = 0; i < l.ms; i++) ctx.ins('', 'MOV', 'I', `<${L('sv')}`, `{${L('sv')}`);
    ctx.ins('sv', 'SPL', 'B', `${L('st')}-${L('sv')}+${P.SHOP + M(l.stone)}`, `${L('st')}-${L('sv')}+${M(l.stone)}`);
    for (let k = 1; k < P.K; k++) ctx.ins('', 'SPL', 'B', `*${L('sv')}`, '0');
    ctx.ins('pv', 'JMP', 'B', `${L('ps')}-${L('pv')}+${P.PHOP + M(PAPER)}`, `${L('ps')}-${L('pv')}+${M(PAPER)}`);
    if (P.CLEAR) emitStoneClear(ctx);
    else emitStone(ctx);
    emitPaper(ctx);
  },
  // Running: a process in the stone copy, or in any copy of the silk.
  running(api) {
    const st = api.add(api.at('st'), api.P.SHOP), code = [1, 2, 3, 4].map((i) => api.code('ps', i));
    return api.vm.processes(0).some((q) => api.rel(q, st) < layoutPS(api.P).stone || code.some((y) => api.same(api.vm.peek(q), y)));
  },
  watch(api) {
    const { P } = api, sv = api.at('sv'), pv = api.at('pv'), movs = new Set();
    const l = layoutPS(P);
    for (let i = l.fan; i < l.sv; i++) movs.add(api.add(api.at('fan'), i));
    const vec = (cell) => api.add(cell, api.vm.peek(cell).a);
    const w = fanWatch(api, {
      bodies: { stone: { label: 'st', hop: P.SHOP, size: l.stone }, paper: { label: 'ps', hop: P.PHOP, size: PAPER } },
      pointer: l.pointer,
      clear: !!P.CLEAR,
      expect: { stone: P.N * P.K, paper: P.N },
      bootLen: l.st,
      routes(pc) {
        const k = api.rel(pc, sv);
        if (movs.has(pc)) return api.same(api.vm.peek(pc), api.code('fan', api.rel(pc, api.at('fan')))) ? { mov: true } : null;
        if (k === 0) return bootCell(api, pc, 'sv', l.st - l.sv + P.SHOP, l.st - l.sv) ? { body: 'stone', target: vec(sv) } : null;
        if (k < P.K) return api.same(api.vm.peek(pc), api.code('sv', k)) ? { body: 'stone', target: vec(sv) } : null;
        if (pc === pv) return bootCell(api, pc, 'pv', l.ps - l.pv + P.PHOP, l.ps - l.pv) ? { body: 'paper', target: vec(pv) } : null;
        return null;
      },
    });
    const paper = [1, 2, 3, 4].map((i) => api.code('ps', i));
    return {
      ...w,
      final() {
        w.final();
        if (!api.alone) return;
        let n = 0;
        for (let c = 0; c < api.core; c++) if (!api.inImage(c) && paper.every((x, i) => api.same(x, api.vm.peek(c + i)))) n++;
        if (n < 3) throw new Error('fan boot: the paper made too few copies');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// fanboot-stone-imp
//
//   fan   spl 2, STONE+M / spl 1 / spl 1   N = 6; the first SPL's B-field is
//         mov <fan, {sv                      the stone's source pointer
//         mov <iv, {iv                     each process copies a pump cell
//   sv    djn  STONE+HOP+M, #N             N-1 processes jump into the stone
//   iv    jmp  PUMP+HOP+M, PUMP+M          the last one falls into the pump
//
// The DJN's A-field is the stone's destination pointer and so its vector; its
// B-field is the counter that splits the processes.
const stoneImp = {
  id: 'fanboot-stone-imp',
  kind: 'body', exit: 'never', grows: true, writes: 'sparse', roams: true, dialects: '94',
  purpose: 'Stone/imp fan boot: a fan of N lockstep processes copies a counted stone SHOP away and an imp pump IHOP away one cell per process, the copy pointers then serving as the launch vectors; a DJN #N counter sends N-1 into the stone and the last into the pump, which feeds an IPOINTS-point spiral for ever. The stone switches itself off after TIME passes.',
  params: { N: [4, 8], SHOP: [256, 54000], IHOP: [256, 54000], STEP: [1, 54000], START: [1, 54000], TIME: [16, 4000], IPOINTS: [3, 31] },
  defaults: { N: 6, SHOP: 3360, IHOP: 5600, STEP: 2377, START: 2332, TIME: 1200, IPOINTS: 13 },
  entry: 'fan',
  processes: (P) => P.N,
  mutable: [['fan', ['b']], ['sv', ['a', 'b']], ['iv', ['a', 'b']]],
  mismatches(P, settings) {
    const out = [];
    if (!modInverse(P.IPOINTS, settings.coreSize)) out.push(`no ${P.IPOINTS}-point spiral on a ${settings.coreSize}-cell core`);
    const l = layoutSI(P);
    out.push(...commonMismatches(P, settings, [l.st + P.SHOP, l.ip + P.IHOP]));
    const core = settings.coreSize, ptAt = l.st + STONE - 1 + P.SHOP;
    for (let m = 0; m < 4 * P.N; m++) {
      const c = mod(ptAt + lattice(P, core, m), core);
      if (c < l.st) { out.push('the stone\'s first bombs hit the boot while it runs'); break; }
      if (mod(c - (l.ip + P.IHOP), core) < PUMP) { out.push('the stone\'s first bombs hit the imp pump'); break; }
    }
    return out;
  },
  emit(ctx) {
    const { L, P } = ctx, l = layoutSI(P), M = (n) => copies(n, P.N) * P.N;
    emitFan(ctx, `${L('st')}-${L('fan')}+${M(STONE)}`);
    for (let i = 0; i < l.ms; i++) ctx.ins('', 'MOV', 'I', `<${L('fan')}`, `{${L('sv')}`);
    for (let i = 0; i < l.mi; i++) ctx.ins('', 'MOV', 'I', `<${L('iv')}`, `{${L('iv')}`);
    ctx.ins('sv', 'DJN', 'B', `${L('st')}-${L('sv')}+${P.SHOP + M(STONE)}`, `#${P.N}`);
    ctx.ins('iv', 'JMP', 'B', `${L('ip')}-${L('iv')}+${P.IHOP + M(PUMP)}`, `${L('ip')}-${L('iv')}+${M(PUMP)}`);
    emitStone(ctx);
    emitPump(ctx);
  },
  // Running: a process in the stone or pump copy, or on an imp.
  running(api) {
    const st = api.add(api.at('st'), api.P.SHOP), ip = api.add(api.at('ip'), api.P.IHOP), imp = api.code('imp');
    return api.vm.processes(0).some((q) => api.rel(q, st) < STONE || api.rel(q, ip) < PUMP || api.same(api.vm.peek(q), imp));
  },
  watch(api) {
    const { P, vm, core } = api, sv = api.at('sv'), iv = api.at('iv'), movs = new Set();
    const l = layoutSI(P);
    for (let i = l.fan; i < l.sv; i++) movs.add(api.add(api.at('fan'), i));
    const w = fanWatch(api, {
      bodies: { stone: { label: 'st', hop: P.SHOP, size: STONE }, pump: { label: 'ip', hop: P.IHOP, size: PUMP } },
      expect: { stone: P.N - 1, pump: 1 },
      bootLen: l.st,
      routes(pc) {
        if (movs.has(pc)) return api.same(vm.peek(pc), api.code('fan', api.rel(pc, api.at('fan')))) ? { mov: true } : null;
        // The DJN jumps while its counter, once decremented, is not zero.
        if (pc === sv && bootCell(api, pc, 'sv', l.st - l.sv + P.SHOP, null)) return mod(vm.peek(sv).b, core) === 1 ? null : { body: 'stone', target: api.add(sv, vm.peek(sv).a) };
        if (pc === iv && bootCell(api, pc, 'iv', l.ip - l.iv + P.IHOP, l.ip - l.iv)) return { body: 'pump', target: api.add(iv, vm.peek(iv).a) };
        return null;
      },
    });
    const imp = api.code('imp');
    return {
      ...w,
      final() {
        w.final();
        if (!api.alone) return;
        // The pump keeps feeding the spiral: imps all over, and more and more of them.
        const imps = api.vm.processes(0).filter((q) => api.same(api.vm.peek(q), imp)).length;
        if (imps < 3 * P.IPOINTS) throw new Error(`fan boot: only ${imps} imp processes; the pump stopped feeding the spiral`);
      },
    };
  },
};

export default [paperStone, stoneImp];
