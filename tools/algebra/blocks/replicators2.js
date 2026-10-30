// Replicators that recover: a paper whose copies rebuild their wiped
// neighbours, and an imp spiral whose launcher never stops feeding it.
// How to write a block: docs/block-algebra.md.
import { modInverse } from '../util.js';

const norm = (x, core) => ((x % core) + core) % core;
const DAT0 = { op: 'DAT', mod: 'F', aMode: '#', a: 0, bMode: '#', b: 0 };

// ---------------------------------------------------------------------------
// relaunch-paper: N copies on a lattice core/N apart (slot 0 is the original).
// Each copy keeps scanning its successor cell by cell, top down. Where a cell
// differs it asks its predecessor: if the predecessor agrees with it (two
// against one) it rewrites the successor's cell; if not, it is the damaged one
// and leaves it alone, so a copy that was hit never spreads its damage. After a
// scan that repaired anything it starts a fresh process in the successor. A
// clear that wipes some slots is undone from the surviving slot behind them,
// one slot per scan. The boot copies every slot first (last slot first, so no
// copy scans a slot that is still being written) and starts each one.
//
// Layout, from cnt: cnt, then the TOP cells every copy holds (start .. the
// last JMP: scanned and copied), then the boot and the state cells, which are
// never copied (a copy resets cnt and dst before it reads them).
const TOP = 16;
const RP = { cnt: 0, start: 1, fix: 14, boot: 17, dst: 24, bk: 25, flag: 26 };
const RP_LEN = 27;
const relaunchPaper = {
  kind: 'body', exit: 'never', processes: 1, grows: true, writes: 'sparse', roams: true, entryFirst: false,
  purpose: 'N copies core/N apart; each scans its successor and, where it and its predecessor agree against it, rewrites the cell and starts a fresh process there, so slots wiped by a clear are rebuilt from the survivors.',
  params: { N: [3, 16] }, entry: 'boot',
  mutable: [['cnt', ['b']], ['dst', ['b']], ['bk', ['b']], ['flag', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (core % P.N) out.push(`relaunch-paper: ${P.N} slots don't divide a ${core}-cell core`);
    else if (core / P.N < 2 * settings.maxLength) out.push('relaunch-paper: its slots are too close to hold the warrior');
    if (P.N > settings.maxProcesses) out.push('relaunch-paper: more slots than the process table holds');
    return out;
  },
  emit(ctx) {
    const { L, P, core, old } = ctx, D = core / P.N;
    const m = (x) => norm(x, core);
    const cnt = L('cnt'), dst = L('dst'), bk = L('bk'), flag = L('flag');
    const dst0 = m(D + TOP - RP.dst + 1);                       // first <dst lands on the successor's top cell
    ctx.ins('cnt', 'DAT', 'F', '#0', `#${TOP}`);
    ctx.ins('start', 'MOV', 'AB', `#${TOP}`, cnt);
    ctx.ins('', 'MOV', 'AB', `#${dst0}`, dst);
    ctx.ins('scan', old ? 'CMP' : 'SEQ', 'I', `@${cnt}`, `<${dst}`);   // mine against the successor's
    ctx.ins('', 'JMP', 'B', L('vote'));
    ctx.ins('more', 'DJN', 'B', L('scan'), cnt);
    ctx.ins('', 'JMZ', 'B', L('start'), flag);
    ctx.ins('', 'MOV', 'AB', '#0', flag);
    ctx.ins('relaunch', 'SPL', 'B', `${L('start')}+${D}`);          // a fresh process in the rebuilt successor
    ctx.ins('', 'JMP', 'B', L('start'));
    ctx.ins('vote', 'MOV', 'I', dst, bk);
    ctx.ins('', 'ADD', 'AB', `#${m(RP.dst - RP.bk - 2 * D)}`, bk);     // the predecessor's cell
    ctx.ins('', old ? 'CMP' : 'SEQ', 'I', `@${cnt}`, `@${bk}`);
    ctx.ins('', 'JMP', 'B', L('more'));                               // it disagrees with me: I may be the damaged one
    ctx.ins('fix', 'MOV', 'I', `@${cnt}`, `@${dst}`);
    ctx.ins('', 'MOV', 'AB', '#1', flag);
    ctx.ins('', 'JMP', 'B', L('more'));
    // Boot: slots N-1 down to 1, each copied whole and started.
    ctx.ins('boot', 'MOV', 'I', `@${cnt}`, `<${dst}`);
    ctx.ins('', 'DJN', 'B', L('boot'), cnt);
    ctx.ins('', 'SPL', 'B', `@${dst}`);
    ctx.ins('', 'ADD', 'AB', `#${m(TOP - D)}`, dst);
    ctx.ins('', 'MOV', 'AB', `#${TOP}`, cnt);
    ctx.ins('', 'DJN', 'B', L('boot'), flag);
    ctx.ins('', 'JMP', 'B', L('start'));
    ctx.ins('dst', 'DAT', 'F', '#0', `#${m((P.N - 1) * D + TOP - RP.dst + 1)}`);
    ctx.ins('bk', 'DAT', 'F', '#0', '#0');
    ctx.ins('flag', 'DAT', 'F', '#0', `#${P.N - 1}`);
  },
  // A process on any cell of a copy's scan or repair code.
  running(api) {
    const code = Array.from({ length: TOP }, (_, k) => api.code('cnt', k + 1));
    return api.vm.processes(0).some((q) => code.some((y) => api.same(api.vm.peek(q), y)));
  },
  // Planted: a clear's DAT sweep wipes two whole slots (2 and 3) after the boot.
  plant(api) {
    const D = api.core / api.P.N, out = [];
    for (const s of [2, 3]) for (let k = 0; k < RP_LEN; k++) out.push([api.at('cnt', s * D + k), DAT0, RP_WIPE]);
    return out;
  },
  watch(api) {
    const N = api.P.N, D = api.core / N, base = api.at('cnt');
    const planted = api.scenario === 'relaunch-paper: planted target';
    const slot = (s) => api.norm(base + s * D);
    const intact = (s) => { for (let k = 1; k <= TOP; k++) if (!api.same(api.vm.peek(slot(s) + k), api.code('cnt', k))) return false; return true; };
    const occupied = (s) => api.vm.processes(0).some((q) => api.norm(q - slot(s)) < RP_LEN);
    const fixAt = (s) => api.norm(slot(s) + RP.fix);
    let wiped = null, fixes = 0, relaunched = 0, entered = false;
    return {
      before: (pc) => {
        if (pc === api.entry()) entered = true;
        if (planted && wiped === null && api.vm.cycle === RP_WIPE + 1) {
          // The sweep landed: both slots are gone (their processes die on their next turn).
          wiped = [2, 3].every((s) => !intact(s));
          if (!wiped) throw new Error('relaunch-paper: the planted sweep did not wipe its slots');
        }
        // A repair writes the predecessor-approved cell into the successor.
        for (const s of [1, 2]) if (pc === fixAt(s) && api.vm.cycle > RP_WIPE) fixes++;
        if (planted && api.vm.cycle > RP_WIPE && [1, 2].some((s) => pc === api.norm(slot(s) + 8))) relaunched++;
        return null;
      },
      after: () => {},
      final: () => {
        if (!entered) return;              // a switch branch not taken
        if (api.alone) {
          for (let s = 1; s < N; s++) if (!intact(s)) throw new Error(`relaunch-paper: slot ${s} holds no whole copy`);
          for (let s = 0; s < N; s++) if (!occupied(s)) throw new Error(`relaunch-paper: slot ${s} is not running`);
        }
        if (!planted) return;
        if (!fixes || !relaunched) throw new Error('relaunch-paper never repaired the wiped slots');
        for (const s of [2, 3]) {
          if (!intact(s)) throw new Error(`relaunch-paper did not rebuild wiped slot ${s}`);
          for (let k = 1; k <= TOP; k++) if (api.vm.writeCycle[api.norm(slot(s) + k)] <= RP_WIPE) throw new Error(`relaunch-paper: slot ${s} was not rewritten after the sweep`);
          if (!occupied(s)) throw new Error(`relaunch-paper rebuilt slot ${s} but started nothing in it`);
        }
      },
    };
  },
};
const RP_WIPE = 6000;

// ---------------------------------------------------------------------------
// imp-feeder: an N-point spiral of 2^K imps (MOV 0, S with N * S = 1), started
// by one vector launch, whose last adder survives as a feeder. Every lap of
// WAIT + 4 instructions the feeder starts one more imp, one step further back
// along the spiral: twin k sits (N - 1 - k) * S from the first imp plus the
// distance the spiral has crawled, which the feeder knows because it runs
// once per pass of the queue, as every imp does. The new process lands right
// after the feeder in the queue, so it runs before every twin started earlier
// and writes the cell the previous twin runs next: the twins form a second
// spiral one cell behind the first, which carries on when the first is
// killed, and every kill frees a slot that the feeder fills again.
// The feeder lives until the spiral has swept the whole core (about core / N
// passes: most of a round on 55,440 cells, about 25,000 cycles at N = 13 on
// 8,000, the whole round at N = 3), when the imps overrun it and it becomes
// one more imp; by then every cell is imp code, so kills no longer cascade.
const impFeeder = {
  kind: 'body', exit: 'never', grows: true, writes: 'sparse', roams: true, layout: 'last',
  purpose: 'Vector-launched N-point spiral of 2^K imps plus a feeder that adds one imp every WAIT + 4 passes at the spiral\'s current position, so imps killed by bombs or a clear are replaced, up to the process limit.',
  params: { N: [3, 31], K: [1, 6], WAIT: [1, 200] }, entry: 'vStart',
  processes: (P) => 2 ** (P.K + 1),          // 2^K jumpers and 2^K adders; all but one adder die
  mutable: [['fCnt', ['b']], ['fPtr', ['b']], ['vVec', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, S = modInverse(P.N, core), M = 2 ** P.K, out = [];
    if (!S) return [`no ${P.N}-point imp spiral on a ${core}-cell core`];
    if (M < P.N) out.push('imp-feeder: fewer imps than points');
    for (let i = 1; i < M; i++) if ((i * S) % core > core - settings.maxLength) { out.push(`imp-feeder: a ${P.N}-point imp lands on the launcher`); break; }
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, S = modInverse(P.N, core), M = 2 ** P.K, lap = P.WAIT + 4;
    for (let i = 0; i < P.K; i++) ctx.ins(i ? '' : 'vStart', 'SPL', 'B', '1');
    ctx.ins('vSplit', 'SPL', 'B', L('vAdd'));                    // a jumper, then an adder
    ctx.ins('vJump', 'JMP', 'B', `@${L('vVec')}`);
    ctx.ins('vAdd', 'ADD', 'AB', `#${S}`, L('vVec'));
    ctx.ins('', 'DJN', 'B', L('vVec'), L('fCnt'));               // every adder but the last dies on the vector
    ctx.ins('fLoop', 'MOV', 'AB', `#${P.WAIT}`, L('fCnt'));
    ctx.ins('fWait', 'DJN', 'B', L('fWait'), L('fCnt'));
    ctx.ins('fFeed', 'SPL', 'B', `@${L('fPtr')}`);
    ctx.ins('', 'ADD', 'AB', `#${norm(lap - S, core)}`, L('fPtr'));
    ctx.ins('', 'JMP', 'B', L('fLoop'));
    ctx.ins('fCnt', 'DAT', 'F', '#0', `#${M}`);
    // The feeder's first SPL is its (WAIT + 2)th instruction; it runs once per pass, as the imps do.
    ctx.ins('fPtr', 'DAT', 'F', '#0', `#${norm(2 + (P.N - 1) * S + P.WAIT + 2, core)}`);
    ctx.ins('vVec', 'DAT', 'F', '#0', `#${L('vImp')}-${L('vVec')}`);
    ctx.ins('vImp', 'MOV', 'I', '0', `${S}`);
  },
  running: (api) => api.vm.processes(0).some((q) => api.same(api.vm.peek(q), api.code('vImp'))),
  plant: () => [],     // the watch kills imps itself, at a cycle, where they stand
  watch(api) {
    const imp = api.code('vImp'), feedAt = api.at('fFeed'), ptrAt = api.at('fPtr');
    const planted = api.scenario === 'imp-feeder: planted target';
    const isImp = (q) => api.same(api.vm.peek(q), imp);
    // The feeder's loop (fLoop .. its JMP) and its pointer. Once the spiral has
    // swept the core it overruns them too, and the feeder becomes one more imp.
    const feeder = Array.from({ length: 5 }, (_, k) => [api.at('fLoop', k), api.code('fLoop', k)]);
    const feeding = () => feeder.every(([c, x]) => api.same(api.vm.peek(c), x)) && api.vm.peek(ptrAt).op === 'DAT';
    // Imps: processes outside the warrior, or on imp code (the spiral sweeps
    // the warrior too). One that hasn't had its turn this pass may stand on a
    // cell its predecessor has yet to write.
    const imps = () => api.vm.processes(0).filter((q) => !api.inImage(q) || isImp(q)).length;
    let feeds = 0, onImp = 0, last = null, before = null, low = Infinity, killed = 0, entered = false;
    let victims = null;
    return {
      before: (pc) => {
        if (pc === api.entry()) entered = true;
        // Each feed's target is checked one lap later: a process that landed
        // on the spiral has run it (an imp cell); one that landed off it died on it.
        if (pc === feedAt && feeding()) {
          if (last !== null) { feeds++; if (isImp(last)) onImp++; }
          last = api.norm(ptrAt + api.vm.peek(ptrAt).b);
        }
        // A victim's turn: a DAT where it stands, so it dies now.
        if (victims?.delete(pc)) { api.vm.poke(pc, DAT0); killed++; }
        return null;
      },
      after: () => {
        if (!planted || !entered) return;
        if (api.vm.cycle === IF_KILL) {
          // The queue from the feeder on: the fed imps, newest first, then the
          // 2^K launched ones. With more than N fed imps (a spiral of their own)
          // kill every launched imp; with fewer, every other fed one.
          const qs = api.vm.processes(0), f = Math.max(0, qs.findIndex((q) => api.inSelf(q) && !isImp(q)));
          const ring = [...qs.slice(f), ...qs.slice(0, f)].filter((q) => !api.inImage(q));
          const M = 2 ** api.P.K, fed = ring.slice(0, -M);
          before = imps();
          victims = new Set(fed.length > api.P.N ? ring.slice(-M) : fed.filter((_, i) => i % 2 === 0));
        } else if (before !== null) low = Math.min(low, imps());
        if (victims && api.vm.cycle > IF_KILL + 2 * api.settings.maxProcesses) victims = null;
      },
      final: () => {
        if (!entered) return;              // a switch branch not taken
        if (!feeds) throw new Error('imp-feeder never fed its spiral');
        // Every feed lands on the spiral: a cell the imps have already run.
        if ((api.alone || planted) && onImp < feeds * (api.alone ? 1 : 0.9)) throw new Error(`imp-feeder fed ${feeds - onImp} of ${feeds} imps off the spiral`);
        const n = imps(), full = api.vm.processes(0).length >= api.settings.maxProcesses;
        if (api.alone && n < 2 ** api.P.K + 2 && !full) throw new Error(`imp-feeder: the spiral did not grow (${n} imps)`);
        if (!planted) return;
        if (!killed || !(low < before)) throw new Error('imp-feeder: the planted kill took no imps');
        if (n < before && !full) throw new Error(`imp-feeder did not refill its spiral (${before} imps, ${low} after the kill, ${n} at the end)`);
      },
    };
  },
};
const IF_KILL = 8000;

const blocks = { 'relaunch-paper': relaunchPaper, 'imp-feeder': impFeeder };
for (const [id, b] of Object.entries(blocks)) b.id = id;
relaunchPaper.defaults = { N: 8 };
impFeeder.defaults = { N: 13, K: 4, WAIT: 8 };

export default Object.values(blocks);
