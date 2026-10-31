// Hill engines: four odd engines from the Koenigstuhl 94nop hill that we had no
// block for (docs/hill-recipe-book.md, gap #15 and the two items the second
// round left open). Everything here is written from scratch; the hill warriors
// named are studied for their mechanism, never copied. Ring only.
//
//   carpet-stone   a SPL #0-fed stone with a small step (17) coprime with the
//                  core: its bombs lay a carpet that closes up lap after lap,
//                  a slow forward core clear, and the carpet itself switches
//                  the stone off when it first comes round onto its loop.
//                  Hullab3loo #8, luca #17.
//   stream-swarm / fed-stream-swarm
//                  N one-line DJN streams booted core/N apart; each stream
//                  decrements the gap below it, and when it passes the next
//                  copy down it shifts that copy's pointer, which restarts that
//                  stream near its own origin. Scratchers (no feeder), Living
//                  Dead (each stream fed by its own SPL #0).
//   knight-pump-stream
//                  knight-pump with Black Knight's DJN.F stream on the
//                  launcher's join, made safe by putting the stream's pointer
//                  on the stone's own bomb lattice. Black Knight #112.
//   finisher-overwrite-antiimp
//                  One Shot's clear with its third pass: SPL passes, then an
//                  anti-imp DAT >s, >2s whose A-field names a copy of itself
//                  laid by the DAT pass. One Shot #235.
//
// How to write a block: docs/block-algebra.md.

import { modInverse } from '../util.js';
import hillimps from './hillimps.js';

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const mod = (x, n) => ((x % n) + n) % n;
// x^-1 mod n (gcd(x, n) = 1), by extended Euclid.
function inverse(x, n) {
  let [r0, r1, t0, t1] = [mod(x, n), n, 1, 0];
  while (r1) { const q = Math.floor(r0 / r1); [r0, r1] = [r1, r0 - q * r1]; [t0, t1] = [t1, t0 - q * t1]; }
  return mod(t0, n);
}

// ---------------------------------------------------------------------------
// carpet-stone
//
// Hullab3loo's stone is the hill's Quicksilver loop (an SPL #0 feeder, two
// writes a loop, a DJN.F stream) with a step of 17. A step that small and
// coprime with the core does not spread bombs over the core like a stone: each
// lap of the core lays every 17th cell, the next lap lands between them, and
// after 17 laps every cell has been bombed. It is a slow forward clear, and, as
// in Hullab3loo, it is not layout-safe: one lap in every few lands on the stone
// itself. Hullab3loo times its stone to stop (and lets its paper repair the
// rest); this block makes the carpet its own timer.
//
//    0 cFeed  SPL   #0, 0            entry: one new process a pass
//    1 cW1    MOV.I cBomb, @cPtr     write X          } the stop cells: a DAT
//    2 cW2    MOV.I cBomb, *cPtr     write X + STEP   } here leaves a process
//    3 cAdd   ADD.F cInc, cPtr       X += 2 STEP      } sink (X stays fixed)
//    4 cDjn   DJN.F cW1, <cFeed      a decrement stream walking down from the block
//    5 cPtr   DAT   #X+STEP, #X
//    6 cBomb  DAT   #0, #0           (bombed with itself: harmless)
//    7 cInc   DAT   #2 STEP, #2 STEP
//
// The writes walk the lattice p0 + k STEP in order (both writes of one pointer
// value, then the ADD), so the k-th bomb is known exactly. On each lap of the
// core the carpet meets the block at most once, at a residue that shifts by
// core mod STEP; the block picks the start p0 (past its end) whose first
// meeting with a cell other than the bomb is one of the three stop cells, as
// late as possible (17 on 8,000: the fifth lap). When that bomb lands the
// processes die on it: a stop at cW1 kills them before they write, at cW2 or
// cAdd they keep writing the same one or two cells. The feeder keeps a sink of
// processes, as Hullab3loo's stone does after its self-hit. A step whose
// lattice misses every live cell (gcd > 1) never stops: then it is a plain
// layout-safe stone.
const CARPET = ['cFeed', 'cW1', 'cW2', 'cAdd', 'cDjn', 'cPtr', 'cBomb', 'cInc'];
const C_AT = Object.fromEntries(CARPET.map((l, i) => [l, i]));
const C_SIZE = CARPET.length, C_STOP = [1, 2, 3], C_SAFE = [6];

// The start p0 (an offset from the block's first cell, past its end) and the
// lattice index k of the bomb that stops the stone (Infinity: never).
function carpetPlan(S, core) {
  const g = gcd(S, core), n = core / g, inv = inverse(S / g, n);
  let best = null;
  for (let p0 = C_SIZE; p0 < C_SIZE + S; p0++) {
    let first = null;
    for (let c = 0; c < C_SIZE; c++) {
      if (C_SAFE.includes(c) || mod(c - p0, g)) continue;
      const k = mod((mod(c - p0, core) / g) * inv, n);
      if (!first || k < first.k) first = { k, cell: c };
    }
    if (first && !C_STOP.includes(first.cell)) continue;     // it would hit live code first
    const plan = first ? { p0, k: first.k, cell: first.cell } : { p0, k: Infinity, cell: null };
    if (!best || plan.k > best.k) best = plan;
  }
  return best;
}

const carpetStone = {
  id: 'carpet-stone',
  kind: 'body', exit: 'never', grows: true, processes: 8, writes: 'core', roams: false, dialects: '94',
  purpose: 'Small-step carpet stone: an SPL #0-fed loop writes two DATs a pass STEP apart (STEP small and coprime with the core, so each lap lands between the last: a slow forward clear) beside a DJN.F stream; the carpet is aimed so that the first time it comes round onto the stone it hits a loop cell, switching the stone off into a process sink.',
  params: { STEP: [9, 200] },
  defaults: { STEP: 17 },
  entry: 'cFeed', loop: 'cW1',
  provides: { datBomb: 'cBomb' },
  mutable: [['cPtr', ['a', 'b']], ['cFeed', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, g = gcd(P.STEP, core), out = [];
    if (core / g < 200) out.push(`carpet-stone: STEP ${P.STEP} reaches only ${core / g} cells`);
    // The stop is timed by the fixed rotation of a growing process queue; a full table breaks it.
    if (settings.maxProcesses < 64) out.push(`carpet-stone: its switch-off needs a growing process queue; this hill allows ${settings.maxProcesses}`);
    else if (!carpetPlan(P.STEP, core)) out.push(`carpet-stone: no start lets STEP ${P.STEP} stop on its loop before it hits other live cells`);
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, S = P.STEP, plan = carpetPlan(S, core);
    const x = plan.p0 - C_AT.cPtr;                                // cPtr's B: the first bomb, relative to cPtr
    ctx.ins('cFeed', 'SPL', 'B', '#0', '0');
    ctx.ins('cW1', 'MOV', 'I', L('cBomb'), `@${L('cPtr')}`);
    ctx.ins('cW2', 'MOV', 'I', L('cBomb'), `*${L('cPtr')}`);
    ctx.ins('cAdd', 'ADD', 'F', L('cInc'), L('cPtr'));
    ctx.ins('cDjn', 'DJN', 'F', L('cW1'), `<${L('cFeed')}`);
    ctx.ins('cPtr', 'DAT', 'F', `#${mod(x + S, core)}`, `#${mod(x, core)}`);
    ctx.ins('cBomb', 'DAT', 'F', '#0', '#0');
    ctx.ins('cInc', 'DAT', 'F', `#${mod(2 * S, core)}`, `#${mod(2 * S, core)}`);
  },
  watch(api) {
    const { vm, P, core } = api, S = P.STEP, plan = carpetPlan(S, core), start = api.self.start;
    const at = Object.fromEntries(CARPET.map((l) => [l, api.at(l)]));
    let adds = 0, writes = 0, stoppedAt = null, stopT = null;
    const cells = new Set(), after = new Set();
    const intact = (l) => api.same(vm.peek(at[l]), api.code(l));
    return {
      before(pc) {
        if (pc === at.cAdd && intact('cAdd')) return { add: true };
        if (pc === at.cW1 && intact('cW1')) return { t: api.norm(at.cPtr + vm.peek(at.cPtr).b), k: 2 * adds };
        if (pc === at.cW2 && intact('cW2')) return { t: api.norm(at.cPtr + vm.peek(at.cPtr).a), k: 2 * adds + 1 };
        if (pc === at.cDjn && intact('cDjn')) return { d: api.norm(at.cFeed + vm.peek(at.cFeed).b - 1) };
        return null;
      },
      after(tok) {
        if (!tok) return;
        if (tok.add) { adds++; return; }
        if (tok.d !== undefined) {
          if (api.inSelf(tok.d)) throw new Error(`${api.scenario}: carpet-stone's stream decremented its own code`);
          return;
        }
        // Until it stops, the k-th write is lattice point k: p0 + k STEP from the block's start.
        if (stoppedAt === null && tok.t !== api.add(start, mod(plan.p0 + tok.k * S, core))) throw new Error(`${api.scenario}: carpet-stone's write ${tok.k} left its lattice`);
        if (vm.peek(tok.t).op !== 'DAT') throw new Error('carpet-stone wrote something other than its DAT');
        if (api.inSelf(tok.t)) {
          const off = api.rel(tok.t, start);
          if (!C_SAFE.includes(off) && tok.t !== stopT) {
            if (stoppedAt !== null || off !== plan.cell) throw new Error(`${api.scenario}: carpet-stone bombed its own live code (cell ${off}, lattice point ${tok.k})`);
            if (tok.k !== plan.k) throw new Error(`carpet-stone stopped on lattice point ${tok.k}, not ${plan.k}`);
            stoppedAt = vm.cycle; stopT = tok.t;
          }
        }
        if (stoppedAt !== null && tok.t !== stopT) after.add(tok.t);
        writes++; cells.add(tok.t);
      },
      final() {
        if (after.size > 8) throw new Error(`carpet-stone kept bombing after it switched itself off (${after.size} cells)`);
        if (!api.alone) return;
        if (cells.size < 200) throw new Error(`carpet-stone laid only ${cells.size} bombs`);
        // Alone on 8,000 the stop comes well inside the gate's 20,000 cycles.
        if (plan.cell !== null && core <= 8000 && stoppedAt === null) throw new Error('carpet-stone never switched itself off');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// stream-swarm and fed-stream-swarm
//
// A boot loop copies the one-line stream N times, D = core / N apart, starting
// a process on each copy; the boot process then dies.
//
//   ssGo   MOV.I ssLine, @ssPtr      (fed: also MOV.I ssFeed, <ssPtr, the
//          SPL   @ssPtr               feeder one cell below the line)
//          ADD.AB #D, ssPtr
//          DJN.B ssGo, ssCnt
//   ssPtr  DAT   #0, #first copy
//   ssCnt  DAT   #0, #N
//  [ssFeed SPL   #0, 0]
//   ssLine DJN.F #0, <-K             ('88: DJN 0, <-K, which decrements B only)
//
// A copy at c walks down from c - K - 1, decrementing one cell per execution,
// for ever. When the copy above it comes down onto c, it decrements c's B-field
// (its A is immediate: a jump to itself whatever it holds), so c's pointer
// becomes the cell below its old one, which the stream decremented once at its
// start: the stream restarts near its origin. The feeder's A is immediate too,
// so a pass changes nothing that matters there either. Each stream sweeps its
// own gap of about D cells, over and over, and the swarm decrements the whole
// core (the warrior's dead boot included) every few thousand cycles: it breaks
// imps, counters and pointers. A target that comes down to zero (a cell whose
// two fields were equal and small) lets the DJN fall through: the unfed stream
// then dies; the fed one loses a process.
const SWARM_MARGIN = 16;
function swarmLayout(P, settings) {
  const core = settings.coreSize, D = Math.floor(core / P.N);
  return { D, lead: P.K + SWARM_MARGIN };
}
function swarmMismatches(id, fed) {
  return (P, settings) => {
    const core = settings.coreSize, { D, lead } = swarmLayout(P, settings), out = [];
    if (!fed && P.N + 1 > settings.maxProcesses) out.push(`${id}: ${P.N} streams and a boot process; this hill allows ${settings.maxProcesses}`);
    if (fed && settings.dialect !== '88' && settings.maxProcesses < 2 * P.N) out.push(`${id}: ${P.N} fed streams need room for ${2 * P.N} processes`);
    // Every copy and its pointer cell clear the warrior (at most maxLength cells).
    if (D <= settings.maxLength + lead + 2) out.push(`${id}: ${P.N} copies ${D} apart do not clear a ${settings.maxLength}-cell warrior and the streams' lead`);
    if (P.K < 2 + (fed ? 1 : 0)) out.push(`${id}: K ${P.K} puts the pointer on the copy`);
    if (core % P.N && core / P.N < 2) out.push(`${id}: N too large`);
    return out;
  };
}
function emitSwarm(fed) {
  return (ctx) => {
    const { L, P, core, total, old } = ctx, { D, lead } = swarmLayout(P, ctx.settings);
    // Data first, so every B-field in the boot code is negative: an '88 stream
    // (B only) would otherwise bring a small positive B to zero and fall through.
    // The farthest copy first: the copy just past the warrior, whose stream walks
    // down into it, starts last, when the boot is done.
    const ptrIdx = ctx.pc();
    ctx.ins('ssPtr', 'DAT', 'F', '#0', `#${mod(total + lead + (P.N - 1) * D - ptrIdx, core)}`);
    ctx.ins('ssCnt', 'DAT', 'F', '#0', `#${P.N}`);
    if (fed) ctx.ins('ssFeed', 'SPL', 'B', old ? '0' : '#0', '0');
    ctx.ins('ssLine', 'DJN', 'F', old ? '0' : '#0', `<${-P.K}`);
    ctx.ins('ssGo', 'MOV', 'I', L('ssLine'), `@${L('ssPtr')}`);
    if (fed) ctx.ins('', 'MOV', 'I', L('ssFeed'), `<${L('ssPtr')}`);
    ctx.ins('', 'SPL', 'B', `@${L('ssPtr')}`, '0');
    ctx.ins('', 'ADD', 'AB', `#${mod(-D + (fed ? 1 : 0), core)}`, L('ssPtr'));
    ctx.ins('', 'DJN', 'B', L('ssGo'), L('ssCnt'));
    ctx.ins('ssEnd', 'DAT', 'F', '#0', '#0');               // the boot process dies here
  };
}
function swarmWatch(fed) {
  return (api) => {
    const { vm, P, core } = api, old = api.settings.dialect === '88', { D } = swarmLayout(P, api.settings);
    const first = api.norm(api.at('ssPtr') + api.code('ssPtr').b);
    const lines = Array.from({ length: P.N }, (_, i) => api.norm(first - i * D));
    const lineAt = new Map(lines.map((c, i) => [c, i]));
    const line = api.code('ssLine'), goAt = api.at('ssGo');
    const isLine = (x) => x.op === 'DJN' && x.aMode === line.aMode && x.bMode === '<' && x.mod === line.mod;
    let copies = 0, runs = 0, resets = 0;
    const cells = new Set();
    return {
      before(pc) {
        if (pc === goAt && api.same(vm.peek(pc), api.code('ssGo'))) return { copy: api.norm(api.at('ssPtr') + vm.peek(api.at('ssPtr')).b) };
        if (!lineAt.has(pc) || !isLine(vm.peek(pc))) return null;
        const ptr = api.norm(pc + vm.peek(pc).b);
        const t = api.norm(ptr + vm.peek(ptr).b - 1);
        if (t === pc || ptr === pc) return { skip: true };
        const was = vm.peek(t), wb = t === ptr ? was.b - 1 : was.b;
        return { t, a: was.a, b: wb };
      },
      after(tok) {
        if (!tok || tok.skip) return;
        if (tok.copy !== undefined) {
          if (!isLine(vm.peek(tok.copy)) || !api.same(vm.peek(tok.copy), line)) throw new Error(`${api.scenario}: ${api.scenario.split(':')[0]} copied its stream badly`);
          copies++;
          return;
        }
        const now = vm.peek(tok.t);
        if (api.norm(now.b - tok.b) !== core - 1 || (!old && api.norm(now.a - tok.a) !== core - 1)) throw new Error(`${api.scenario}: a stream did not decrement the cell it points at`);
        if (lineAt.has(tok.t)) resets++;
        runs++; cells.add(tok.t);
      },
      final() {
        if (!api.alone) return;
        const id = fed ? 'fed-stream-swarm' : 'stream-swarm';
        if (copies !== P.N) throw new Error(`${id}: made ${copies} copies, not ${P.N}`);
        const procs = vm.processes(0);
        const running = lines.filter((c) => procs.some((q) => q === c || (fed && q === api.norm(c - 1)))).length;
        if (running < P.N) throw new Error(`${id}: only ${running} of ${P.N} streams still run`);
        if (cells.size < Math.min(core / 2, 2000)) throw new Error(`${id}: the streams decremented only ${cells.size} cells`);
        // Once every stream has had time to cross its gap, passes over the copies restart them.
        if (runs > P.N * (D + 50) && resets === 0) throw new Error(`${id}: no stream ever passed over another copy`);
      },
    };
  };
}
const swarmRunning = (api) => {
  const procs = api.vm.processes(0);
  return procs.some((q) => { const x = api.vm.peek(q); return (x.op === 'DJN' && x.bMode === '<') || (x.op === 'SPL' && api.vm.peek(q + 1).op === 'DJN'); });
};
const streamSwarm = {
  id: 'stream-swarm',
  kind: 'body', exit: 'never', writes: 'core', roams: true,
  purpose: 'N one-line DJN streams booted core/N apart, one process each: each walks down its gap decrementing every cell (both fields in \'94, B in \'88), and a stream passing over the next copy down shifts its pointer, restarting it near its origin, so the swarm sweeps the whole core over and over.',
  params: { N: [2, 24], K: [2, 60] },
  defaults: { N: 7, K: 10 },
  entry: 'ssGo', entryFirst: false, processes: (P) => P.N + 1,
  mutable: [['ssPtr', ['b']], ['ssCnt', ['b']]],
  mismatches: swarmMismatches('stream-swarm', false),
  emit: emitSwarm(false),
  running: swarmRunning,
  watch: swarmWatch(false),
};
const fedStreamSwarm = {
  ...streamSwarm,
  id: 'fed-stream-swarm', grows: true, processes: (P) => P.N + 1,
  purpose: 'N streams booted core/N apart, each a SPL #0 feeder over a one-line DJN stream (both with immediate A-fields, so passes by the other streams only move a pointer): each walks down its gap decrementing every cell, a pass over the next copy restarts it near its origin, and a stream that falls through on a zero is refilled by its feeder.',
  mismatches: swarmMismatches('fed-stream-swarm', true),
  emit: emitSwarm(true),
  watch: swarmWatch(true),
};

// ---------------------------------------------------------------------------
// knight-pump-stream
//
// knight-pump (hillimps.js) with its join as Black Knight's: the launcher's
// spare process enters the stone through DJN.F sMov, <ptr instead of JMP sMov,
// so every pump pass also decrements one cell of a stream. Left as it is, the
// stream walks down one cell a pass for ever and in a long enough round laps
// the core and decrements the pump and the stone (that is why knight-pump left
// it out). Here the stream's pointer cell sits SDIST cells past the block on
// the stone's own bomb lattice (STEP is a multiple of 4, so every lap of the
// lattice bombs every cell of one residue class): each lap of the lattice
// writes the bomb, DAT #0, #1, over the pointer, which restarts the stream just
// below it. Alone, the stone (fed a process a pass) laps its lattice about
// every hundred passes, so the stream sweeps the cells just below the pointer
// and never comes near the block. It can still lap the core if the stone is
// stopped and the pump then runs about SDIST more passes: no layout of a
// one-line stream run once a pass avoids that, since nothing else bounds it.
const knightPump = hillimps.find((b) => b.id === 'knight-pump');
const KNIGHT_SIZE = 13, KNIGHT_JOIN = 10;
// The stream's pointer: the first lattice cell at or past SDIST from the block's start.
function streamCell(P, core, jmpOff, first) {
  const g = gcd(P.STEP, core), base = jmpOff + first;
  let x = P.SDIST;
  while (mod(x - base, g)) x++;
  return x;
}
// Where the stone puts its first bomb (sJmp's B) and where sJmp is, read from knight-pump's own code.
function knightFirst(ctxLike) {
  let jmpOff = null, first = null, n = 0;
  knightPump.emit({ ...ctxLike, ins: (l, o, m, a, b) => { if (l === 'sJmp') { jmpOff = n; first = Number(b); } n++; } });
  return { jmpOff, first };
}
const knightPumpStream = {
  ...knightPump,
  id: 'knight-pump-stream',
  purpose: 'knight-pump with Black Knight\'s stream: the launcher\'s spare joins the stone through DJN.F, decrementing one cell a pass, and the stream\'s pointer sits SDIST past the block on the stone\'s own bomb lattice, so every lap of the stone\'s bombs restarts the stream there and it never reaches the block.',
  params: { ...knightPump.params, SDIST: [200, 54000] },
  defaults: { ...knightPump.defaults, SDIST: 2100 },
  mismatches(P, settings) {
    const out = knightPump.mismatches(P, settings);
    if (out.length) return out;
    const core = settings.coreSize;
    const { jmpOff, first } = knightFirst({ L: (x) => x, P, core, settings, old: false });
    const x = streamCell(P, core, jmpOff, first);
    if (x >= core - settings.maxLength - 200) out.push(`knight-pump-stream: SDIST ${P.SDIST} puts the stream just below the warrior`);
    // Keep the stream (the cells just below its pointer) clear of the imp arms' starts.
    const S = modInverse(P.POINTS || (core % 3 ? 3 : 13), core), D = mod(S + 1, core);
    for (let i = 0; i < 4 * (P.POINTS || (core % 3 ? 3 : 13)); i++) {
      const arm = mod(12 + i * D, core);
      if (mod(x - arm, core) < 1000 && mod(x - arm, core) > 0) { out.push(`knight-pump-stream: SDIST ${P.SDIST} puts the stream where an imp arm crawls`); break; }
    }
    return out;
  },
  emit(ctx) {
    const start = ctx.pc(), { jmpOff, first } = knightFirst(ctx);
    const x = streamCell(ctx.P, ctx.core, jmpOff, first);
    knightPump.emit({
      ...ctx,
      ins: (l, o, m, a, b = '0') => (l === 'pJoin'
        ? ctx.ins(l, 'DJN', 'F', a, `<${mod(x - (ctx.pc() - start), ctx.core)}`)
        : ctx.ins(l, o, m, a, b)),
    });
  },
  watch(api) {
    const base = knightPump.watch(api), { vm, core } = api;
    const joinAt = api.at('pJoin'), join = api.code('pJoin');
    const ptr = api.norm(joinAt + join.b);
    const bomb = api.code('sBomb');
    let streams = 0, resets = 0, low = 0, wasBomb = false;
    return {
      before(pc) {
        wasBomb = api.same(vm.peek(ptr), bomb);
        const t = base.before(pc);
        if (pc === joinAt && api.same(vm.peek(pc), join)) return { base: t, d: api.norm(ptr + vm.peek(ptr).b - 1) };
        return t ? { base: t } : null;
      },
      after(tok) {
        if (!wasBomb && api.same(vm.peek(ptr), bomb)) resets++;      // the stone's bomb over the pointer restarts the stream
        if (!tok) return;
        base.after(tok.base);
        if (tok.d !== undefined) {
          if (api.inSelf(tok.d)) throw new Error(`${api.scenario}: knight-pump-stream's stream decremented its own block`);
          low = Math.max(low, api.rel(ptr, tok.d));
          streams++;
        }
      },
      final() {
        base.final();
        if (!api.alone) return;
        if (streams < 50) throw new Error(`knight-pump-stream: the stream ran only ${streams} times`);
        if (core <= 8000 && streams > 120 && resets === 0) throw new Error(`knight-pump-stream: the stone never restarted the stream (${streams} runs, ${low} cells below its pointer)`);
        if (low > 400) throw new Error(`knight-pump-stream: the stream ran ${low} cells below its pointer (${resets} restarts by the stone)`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// finisher-overwrite-antiimp
//
// finisher-overwrite (hillscan2.js) clears through the opening's probe with
// MOV.I *probe, >probe; each bomb's A-field names the next bomb (relative to
// the probe, since a wrap copies it onto the probe) and its B-field the image's
// length after the probe, so each wrap starts the next pass past the warrior.
// The last bomb there names itself, so the DAT pass repeats for ever. One
// Shot's last bomb is an anti-imp DAT >s, >2s (s the imp step: a process that
// runs it increments the B-fields of the next two cells of a 3-point ring, so
// the ring's other imps copy themselves to the wrong place). Its fields are
// fixed by that, so it cannot name itself. It doesn't need to: the DAT pass
// (sourced from the original, named by the last SPL) lays a copy at every cell
// past the warrior, probe + s among them. When the DAT pass wraps, the probe
// gets A = s, so every later pass copies the copy at probe + s, which the
// passes never change (they write it with itself, or skip it). B = 2s (ARMS 2,
// One Shot) starts each later pass at probe + 2s: they then cover the third of
// the core below the probe, outside the warrior when the probe is the opening's
// first cell (as in the MUL quickscan); ARMS 1 uses B = the image length, so
// the later passes cover everything past the warrior, at the price of the
// second increment landing on an arbitrary cell.
const impPoints = (P, core) => P.POINTS || (core % 3 ? 3 : 13);
const impStepOf = (P, core) => modInverse(impPoints(P, core), core);
function aiChain(P) { return [...Array(P.SPLS).keys()].map((k) => `b${k}`).concat('bd'); }
function emitAntiImp(ctx) {
  const { L, P, span, core } = ctx, probe = ctx.ref('probe'), s = impStepOf(P, core);
  const idx = () => `(${probe}+${ctx.pc()})`;        // the probe's global index, on the current line
  const chain = aiChain(P);
  ctx.mark('payload');
  ctx.ins('', 'SLT', 'AB', `#(${span}-${idx()}-1)`, probe);     // probe inside the image? -> its end
  ctx.ins('', 'MOV', 'AB', `#(${span}-${idx()})`, probe);
  ctx.ins('', 'MOV', 'A', `#(${L(chain[0])}-${probe})`, probe);  // *probe -> the first bomb
  if (P.PUMP) ctx.ins('pump', 'SPL', 'B', '#0', '0');
  ctx.ins('w1', 'MOV', 'I', `*${probe}`, `>${probe}`);
  ctx.ins('w2', 'MOV', 'I', `*${probe}`, `>${probe}`);
  ctx.ins('', 'JMP', 'B', L('w1'));
  chain.slice(0, -1).forEach((b, k) => ctx.ins(b, 'SPL', 'B', `#(${L(chain[k + 1])}-${probe})`, `#(${span}-${idx()})`));
  ctx.ins('bd', 'DAT', 'F', `>${s}`, P.ARMS === 2 ? `>${mod(2 * s, core)}` : `>(${span}-${idx()})`);
}
function watchAntiImp(api) {
  const { vm, core, P } = api, chain = aiChain(P), s = impStepOf(P, core);
  // The image's length after the probe: what the payload's MOV.AB writes into it.
  const probe = api.ref('probe'), skipLen = api.norm(api.code('payload', 1).a);
  const bd = api.code('bd'), last = chain.length - 1;
  const written = new Int32Array(core).fill(-1);
  let enteredAt = null, wraps = 0, writes = 0, finalWrites = 0;
  const w1 = api.at('w1'), w2 = api.at('w2');
  return {
    before(pc) {
      if (enteredAt === null && pc === api.at('payload')) enteredAt = vm.cycle;
      if (pc !== w1 && pc !== w2) return null;
      return { pc, t: mod(probe + vm.peek(probe).b, core), src: mod(probe + vm.peek(probe).a, core) };
    },
    after(tok) {
      if (!tok) return;
      const { t, pc } = tok;
      const want = wraps < last ? api.code(chain[wraps]) : bd;
      if (!api.same(vm.peek(t), want) || vm.writerPc[t] !== pc) throw new Error(`finisher-overwrite-antiimp wrote something other than pass ${wraps + 1}'s bomb`);
      // After the DAT pass, every pass copies the copy at probe + s.
      if (wraps > last && tok.src !== mod(probe + s, core)) throw new Error('finisher-overwrite-antiimp: a later pass did not copy the anti-imp DAT at probe + s');
      if (t === probe) {
        wraps++;
        if (wraps === 2) {
          // The first full pass (started by wrap 1) covers everything past the image,
          // unless it was already an anti-imp pass of ARMS 2 (SPLS 0): then from probe + 2s.
          const from = last === 0 && P.ARMS === 2 ? mod(2 * s, core) : skipLen;
          for (let c = 0; c < core; c++) if (api.rel(c, probe) >= from && written[c] < 0) throw new Error('finisher-overwrite-antiimp left cells untouched on its first full pass');
        }
        return;
      }
      if (api.inSelf(t)) throw new Error('finisher-overwrite-antiimp cleared its own code');
      const r = api.rel(t, probe);
      if (r < skipLen) throw new Error('finisher-overwrite-antiimp cleared the warrior after its probe');
      if (P.ARMS === 2 && wraps > last && r < mod(2 * s, core)) throw new Error('finisher-overwrite-antiimp: an anti-imp pass started below probe + 2s');
      if (wraps > last) finalWrites++;
      writes++; written[t] = vm.cycle;
    },
    final() {
      if (enteredAt === null) return;
      if (writes >= core && wraps === 0) throw new Error('finisher-overwrite-antiimp never came round onto its pointer');
      if (writes >= (chain.length + 1) * core && wraps <= last) throw new Error('finisher-overwrite-antiimp never reached its anti-imp passes');
      if (api.alone && wraps > last + 1 && finalWrites === 0) throw new Error('finisher-overwrite-antiimp: no anti-imp pass after the DAT pass');
    },
  };
}
const finisherAntiImp = {
  id: 'finisher-overwrite-antiimp',
  kind: 'finisher', exit: 'never', writes: 'core', relocatable: false, protects: 'image', dialects: '94',
  processes: (P) => (P.PUMP ? 8 : 1), grows: true,
  purpose: 'One Shot clear with its anti-imp pass: clears forward from the probe through the probe itself, SPLS SPL passes, then a pass of DAT >s, >2s (s the imp step: whoever runs one breaks the next two cells of an imp ring); that pass lays a copy at probe + s, and its wrap points the probe there, so every later pass copies it (ARMS 2: over the third of the core below the probe; ARMS 1: over everything past the warrior). PUMP 1 runs it from a SPL #0 pump.',
  params: { SPLS: [0, 3], PUMP: [0, 1], ARMS: [1, 2], POINTS: [0, 31] },
  defaults: { SPLS: 2, PUMP: 1, ARMS: 2, POINTS: 0 },
  entry: 'payload',
  needs: ['probe'],
  provides: { datBomb: 'bd' },
  mismatches(P, settings) {
    const core = settings.coreSize, s = impStepOf(P, core), out = [];
    if (settings.dialect === '88') return ["finisher-overwrite-antiimp needs ICWS'94"];
    if (P.PUMP && settings.maxProcesses < 2) out.push('PUMP needs more than one process');
    if (!s) return [...out, `finisher-overwrite-antiimp: no ${impPoints(P, core)}-point imp step on a ${core}-cell core`];
    // probe + s (the copy every later pass reads) and, with ARMS 2, probe + 2s
    // (where they start) must lie past the warrior and short of the probe.
    const room = (x) => x > settings.maxLength && x < core - settings.maxLength;
    if (!room(s)) out.push(`finisher-overwrite-antiimp: the imp step ${s} lands inside a warrior's reach of the probe`);
    if (P.ARMS === 2 && !room(mod(2 * s, core))) out.push(`finisher-overwrite-antiimp: 2s = ${mod(2 * s, core)} lands inside a warrior's reach of the probe`);
    return out;
  },
  emit: emitAntiImp,
  watch: watchAntiImp,
};

export default [carpetStone, streamSwarm, fedStreamSwarm, knightPumpStream, finisherAntiImp];
export { carpetPlan };
