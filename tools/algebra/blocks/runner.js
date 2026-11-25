// Runner boots: the lockstep fan boots of John Metcalf's 94x warriors, Void
// Runner (stone/imp) and Azathoth (paper/stone), docs/hill-top30/94x.md #6 and
// #7. What sets them apart from fanboot.js:
//
//   - the stone is the "runner" engine: one MOV bombs ahead, SUB.X walks the
//     bomb pointer back 2*STEP a pass and its trail pointer forward, a second
//     MOV writes through the next target's A-field, and a DJN.F adds a
//     decrement stream. Its first target is set so that after TIME/2 passes
//     the bomb lands on its own SUB line; the loop is then SPL #0 / MOV / DAT,
//     and the DAT's >1 walks the pointer one cell per process death: a core
//     clear that every process feeds;
//   - the boot doubles the processes after the copies, so each body gets
//     8 * 2^D (stone/imp) or N * K (paper/stone) processes;
//   - runner-stone-imp starts up to three imp pumps PGAP apart, so one clear
//     can't stop every spiral;
//   - runner-paper-stone's paper is a 5-line looping copier that checks the
//     cell after each new copy and drops a copy that was hit.
//
// All Redcode here is written from scratch from the descriptions.

import { modInverse } from '../util.js';

const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));

const mod = (x, core) => ((x % core) + core) % core;
const near = (d, core) => Math.min(mod(d, core), core - mod(d, core));

// The runner stone. `feeds` SPL #0 lines (the stone/imp boot's processes
// arrive at the first and double there), the 4-line loop, `gap` blank cells,
// then the bomb. Labels: rl (loop), rh (the SUB the stone retires onto), rp
// (pointers), rb (bomb).
function emitRunner(ctx, feeds, gap) {
  const { L, P, core } = ctx, S = mod(P.STEP, core);
  for (let i = 0; i < feeds; i++) ctx.ins(i ? '' : 'rs', 'SPL', 'B', '#0', '0');
  ctx.ins('rl', 'MOV', 'I', L('rb'), `@${L('rp')}`);
  ctx.ins('rh', 'SUB', 'X', `#${mod(2 * S, core)}`, `@${L('rl')}`);
  // B: the first target, rh + STEP*TIME, so pass TIME/2 bombs rh.
  ctx.ins('rp', 'MOV', 'I', `{${mod(P.BACK, core)}`, `}${mod(-1 + S * P.TIME, core)}`);
  ctx.ins('', 'DJN', 'F', `@${L('rh')}`, `}${L('rp')}`);
  for (let i = 0; i < gap; i++) ctx.ins('', 'DAT', 'F', '0', '0');
  ctx.ins('rb', 'DAT', 'F', `}${S}`, '>1');
}
const runnerSize = (feeds, gap) => feeds + 4 + gap + 1;

// Where the runner writes before it retires, relative to rp: the bombs
// (rp.B, falling by 2*STEP a pass) and the trail (rp.A, rising by 2 a pass).
function runnerHits(P, core, passes) {
  const S = mod(P.STEP, core), bombs = [], trail = [];
  for (let k = 0; k < passes; k++) {
    bombs.push(mod(-1 + S * P.TIME - 2 * S * k, core));
    trail.push(mod(P.BACK + 2 * k, core));
  }
  return { bombs, trail };
}

// Gate helpers shared by the two blocks.
function copyWatch(api, bodies) {
  const arrived = new Set();
  return (pc) => {
    for (const b of bodies) {
      if (arrived.has(b.name) || pc !== b.at) continue;
      arrived.add(b.name);
      for (let i = 0; i < b.size; i++) if (!api.same(api.vm.peek(api.add(pc, i)), api.code(b.label, i))) throw new Error(`runner boot: a process entered the ${b.name} copy before it was complete`);
    }
    return arrived;
  };
}
function runnerWatch(api, st, size, rpOff) {
  const { vm } = api, rl = api.add(st, rpOff - 2), rh = api.add(st, rpOff - 1), rp = api.add(st, rpOff);
  let retired = null, bombs = 0;
  return {
    before(pc) {
      if (retired === null && pc === rl && vm.peek(pc).op === 'MOV' && vm.peek(rh).op === 'SUB') return { t: api.add(rp, vm.peek(rp).b) };
      return null;
    },
    after(t) {
      if (!t) return;
      if (api.rel(t.t, st) < size) {
        if (t.t !== rh) throw new Error('runner stone: it bombed itself before its time ran out');
        retired = vm.cycle;
      }
      bombs++;
    },
    get retired() { return retired; },
    get bombs() { return bombs; },
  };
}
// Passes the stone may make before the boot is done with its own cells.
const EARLY = 64;
// Room kept around each body: the image a tree puts round the block, capped so a
// hill with a huge length limit (ModelWar's 5040) still leaves room for three pumps.
const ROOM = (settings) => Math.min(settings.maxLength, 600) + 16;
function runnerMismatches(P, settings, stoneSize, rpOff, others) {
  const core = settings.coreSize, out = [];
  if (P.TIME % 2) out.push('runner stone: TIME must be even, so the bomb lands on its own SUB');
  if (gcd(2 * P.STEP, core) > 2) out.push(`runner stone: 2*STEP shares ${gcd(2 * P.STEP, core)} with the core; the bombs would miss its own SUB`);
  const { bombs, trail } = runnerHits(P, core, P.TIME / 2);
  // Before the planned hit (pass TIME/2), bombs and trail stay off the stone and the other bodies (offsets from rp).
  const own = (d) => { const r = mod(d + rpOff, core); return r < stoneSize; };
  if (bombs.some(own)) out.push('runner stone: a bomb lands on the stone before its time runs out');
  if (trail.some((d) => own(d) || own(d + 1))) out.push('runner stone: its trail pointer runs over the stone');
  // Bodies that must last (the pumps) are checked over every pass; the boot and
  // the paper's first copy only while the boot can still be running.
  for (const o of others) {
    const hit = (d) => mod(d - o.at, core) < o.size, n = o.early ? EARLY : bombs.length;
    if (bombs.slice(0, n).some(hit) || trail.slice(0, n).some(hit)) { out.push(`runner stone: it bombs the ${o.name} ${o.early ? 'while the boot runs' : 'before it retires'}`); break; }
  }
  return out;
}

// ---------------------------------------------------------------------------
// runner-stone-imp
//
//   fan   spl 1 / spl 1                4 processes
//         mov <vK, {vK                 one line per pump: 4 processes copy its 4 cells
//         spl 1                        8 processes
//         mov <sv, {sv                 they copy the 8-cell stone
//         spl 1  (x D)                 8 * 2^D processes
//   sv    spl  stone copy              each sends one into the stone,
//   v2    spl  pump 2 copy             one into each further pump,
//   v3    spl  pump 3 copy
//   v1    jmp  pump 1 copy             and goes to the first pump itself
//
// Each vector cell's B-field is the source pointer and its A-field the
// destination; the MOVs predecrement both, so after the copy the A-field is
// the launch vector (as in fanboot.js).
const SI_STONE = runnerSize(2, 1), SI_RP = 4, PUMP = 4;
const siLayout = (P) => {
  const sv = 2 + P.PUMPS + 2 + P.D, st = sv + P.PUMPS + 1, ip = st + SI_STONE;
  return { sv, st, ip, size: ip + PUMP };
};
const pumpHops = (P, core) => {
  const gap = P.PGAP || Math.floor(core / 3);
  return [P.IHOP, P.IHOP + gap, P.IHOP - gap].slice(0, P.PUMPS);
};
const stoneImp = {
  id: 'runner-stone-imp',
  kind: 'body', exit: 'never', grows: true, writes: 'sparse', roams: true, dialects: '94',
  purpose: 'Void Runner-style stone/imp boot: a fan copies a self-timed runner stone SHOP away and PUMPS imp pumps (IHOP, IHOP+PGAP, IHOP-PGAP; PGAP 0 is a third of the core), then doubles D more times so 8*2^D processes enter each. The stone bombs two directions a pass and after TIME/2 passes lands a bomb on its own SUB, which turns it into a one-cell-per-process core clear; the pumps feed IPOINTS-point spirals for ever. A pump sends its first launch NPROC spiral points behind its imp (0: as many as the processes in it, so the last of them starts the spiral).',
  params: { D: [0, 3], SHOP: [256, 54000], IHOP: [256, 54000], PUMPS: [1, 3], PGAP: [0, 27000], STEP: [1, 27719], TIME: [100, 30000], BACK: [1, 54000], IPOINTS: [3, 43], NPROC: [0, 64], DEC: [1, 54000] },
  // Evolved against the ModelWar ladder's top 17 (25200 cells).
  defaults: { D: 2, SHOP: 18905, IHOP: 20179, PUMPS: 3, PGAP: 0, STEP: 3497, TIME: 3746, BACK: 19769, IPOINTS: 31, NPROC: 33, DEC: 8467 },
  entry: 'fan',
  processes: (P) => 8 * 2 ** P.D,
  mutable: (P) => ['sv', 'v1', 'v2', 'v3'].slice(0, P.PUMPS + 1).map((l) => [l, ['a', 'b']]),
  mismatches(P, settings) {
    const core = settings.coreSize, room = ROOM(settings), out = [], l = siLayout(P);
    if (!modInverse(P.IPOINTS, core)) out.push(`no ${P.IPOINTS}-point spiral on a ${core}-cell core`);
    if (8 * 2 ** P.D < P.IPOINTS) out.push(`a pump gets ${8 * 2 ** P.D} processes, too few for a ${P.IPOINTS}-point spiral: raise D or lower IPOINTS`);
    if (settings.maxProcesses < 16 * 2 ** P.D * (P.PUMPS + 1)) out.push(`the runner boot needs more processes than this hill's ${settings.maxProcesses}`);
    const at = [0, l.st + P.SHOP, ...pumpHops(P, core).map((h) => l.ip + h)];
    for (let i = 0; i < at.length; i++) for (let j = i + 1; j < at.length; j++) if (near(at[j] - at[i], core) < room) out.push('the boot puts two of its bodies (or a body and the original) on top of each other');
    const rpAt = l.st + P.SHOP + SI_RP;
    const others = [{ name: 'boot', at: mod(-rpAt, core), size: l.size, early: true }, ...pumpHops(P, core).map((h, i) => ({ name: `imp pump ${i + 1}`, at: mod(l.ip + h - rpAt, core), size: PUMP }))];
    out.push(...runnerMismatches(P, settings, SI_STONE, SI_RP, others));
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, l = siLayout(P), hops = pumpHops(P, core);
    ctx.ins('fan', 'SPL', 'B', '1', '0');
    ctx.ins('', 'SPL', 'B', '1', '0');
    const v = ['v1', 'v2', 'v3'];
    for (let k = 0; k < P.PUMPS; k++) ctx.ins('', 'MOV', 'I', `<${L(v[k])}`, `{${L(v[k])}`);
    ctx.ins('', 'SPL', 'B', '1', '0');
    ctx.ins('', 'MOV', 'I', `<${L('sv')}`, `{${L('sv')}`);
    for (let i = 0; i < P.D; i++) ctx.ins('', 'SPL', 'B', '1', '0');
    ctx.ins('sv', 'SPL', 'B', `${L('rs')}-${L('sv')}+${P.SHOP + SI_STONE}`, `${L('rs')}-${L('sv')}+${SI_STONE}`);
    // Pumps 2 and 3 are spawned into, pump 1 is entered: the last vector is a JMP.
    const order = P.PUMPS === 1 ? ['v1'] : P.PUMPS === 2 ? ['v2', 'v1'] : ['v2', 'v3', 'v1'];
    const hopOf = { v1: hops[0], v2: hops[1], v3: hops[2] };
    order.forEach((n, i) => ctx.ins(n, i === order.length - 1 ? 'JMP' : 'SPL', 'B', `${L('ip1')}-${L(n)}+${hopOf[n] + PUMP}`, `${L('ip1')}-${L(n)}+${PUMP}`));
    emitRunner(ctx, 2, 1);
    // One pump body; every copy is made from it.
    ctx.ins('ip1', 'SPL', 'B', '#0', '0');
    const IS = modInverse(P.IPOINTS, core);
    ctx.ins('', 'ADD', 'F', `#${IS}`, L('il1'));
    ctx.ins('il1', 'DJN', 'F', `${L('im1')}-${L('il1')}-${mod(IS * (P.NPROC || 8 * 2 ** P.D), core)}`, `<${mod(P.DEC, core)}`);
    ctx.ins('im1', 'MOV', 'I', `#${IS}`, '*0');
  },
  running(api) {
    const st = api.add(api.at('rs'), api.P.SHOP), imp = api.code('im1');
    return api.vm.processes(0).some((q) => api.rel(q, st) < SI_STONE || api.same(api.vm.peek(q), imp));
  },
  watch(api) {
    const { P, core } = api, hops = pumpHops(P, core);
    const st = api.add(api.at('rs'), P.SHOP);
    const bodies = [{ name: 'stone', at: st, size: SI_STONE, label: 'rs' }, ...hops.map((h, i) => ({ name: `pump ${i + 1}`, at: api.add(api.at('ip1'), h), size: PUMP, label: 'ip1' }))];
    const seen = copyWatch(api, bodies), stone = runnerWatch(api, st, SI_STONE, SI_RP);
    // The spirals are counted while the stone still bombs: once it retires,
    // its core clear sweeps everything, the imps included, by design.
    const imp = api.code('im1');
    let imps = 0;
    return {
      before(pc) {
        seen(pc);
        if (stone.retired === null && api.vm.cycle % 1000 === 0) imps = Math.max(imps, api.vm.processes(0).filter((q) => api.same(api.vm.peek(q), imp)).length);
        return stone.before(pc);
      },
      after(t) { stone.after(t); },
      final() {
        if (api.entered && !api.entered()) return;
        const got = seen(-1);
        for (const b of bodies) if (!got.has(b.name)) throw new Error(`runner boot: nothing entered the ${b.name} copy`);
        if (!api.alone) return;
        if (stone.bombs < Math.min(100, P.TIME / 2)) throw new Error(`runner stone: only ${stone.bombs} bombs`);
        if (imps < P.IPOINTS) throw new Error(`runner boot: the pumps fed only ${imps} imps before the stone retired`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// runner-paper-stone
//
//   fan   spl 2 / spl 1 / spl 1        6 processes
//         mov <pv, {pv                 they copy the paper (5 lines and a blank)
//         mov <sv, {sv                 and the 6-cell stone
//   sv    spl  stone copy              each sends K into the stone
//         spl  *sv  (x K-1)
//   pv    jmp  paper copy              and enters the paper
const PS_STONE = runnerSize(1, 0), PS_RP = 3, PAPER = 6;
const psLayout = (P) => {
  const sv = 5, pv = sv + P.K, st = pv + 1, pa = st + PS_STONE;
  return { sv, pv, st, pa, size: pa + PAPER };
};
function emitLooper(ctx) {
  const { L, P, core } = ctx;
  // Each lap: launch into the next copy, copy three cells through two A-field
  // pointers (px's and the blank 3 cells past it), and loop while the cell the
  // copy checks is still blank.
  ctx.ins('pa', 'SPL', 'B', `${mod(P.PSTEP, core)}`, `{${L('px')}`);
  ctx.ins('', 'MOV', 'I', `}${L('px')}`, `}${L('pa')}`);
  ctx.ins('', 'MOV', 'I', `}${L('px')}+3`, `}${L('pa')}`);
  ctx.ins('px', 'MOV', 'I', `{${L('px')}+3`, `}${L('pa')}`);
  ctx.ins('', 'JMZ', 'F', `@${L('px')}-1`, `*${L('px')}`);
  ctx.ins('', 'DAT', 'F', '0', '0');
}
const paperStone = {
  id: 'runner-paper-stone',
  kind: 'body', exit: 'never', grows: true, writes: 'sparse', roams: true, dialects: '94',
  purpose: 'Azathoth-style paper/stone boot: six lockstep processes copy a 5-line looping paper PHOP away and a self-timed runner stone SHOP away; each spawns K into the stone and enters the paper. The paper copies itself PSTEP on (the distance growing each lap) and drops a copy that was hit; the stone shares the queue, so it runs fast only when the paper is stunned, and after TIME/2 passes it bombs its own SUB and becomes a one-cell-per-process core clear.',
  params: { K: [1, 6], SHOP: [256, 54000], PHOP: [256, 54000], STEP: [1, 27719], TIME: [100, 30000], BACK: [1, 54000], PSTEP: [100, 54000] },
  // Evolved against the ModelWar ladder's top 17 (25200 cells).
  defaults: { K: 6, SHOP: 14203, PHOP: 15035, STEP: 7673, TIME: 6482, BACK: 29960, PSTEP: 50861 },
  entry: 'fan',
  processes: (P) => 6 * (P.K + 1),
  mutable: [['sv', ['a', 'b']], ['pv', ['a', 'b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, room = ROOM(settings), out = [], l = psLayout(P);
    const at = [0, l.st + P.SHOP, l.pa + P.PHOP];
    for (let i = 0; i < at.length; i++) for (let j = i + 1; j < at.length; j++) if (near(at[j] - at[i], core) < room) out.push('the boot puts two of its bodies (or a body and the original) on top of each other');
    const rpAt = l.st + P.SHOP + PS_RP;
    out.push(...runnerMismatches(P, settings, PS_STONE, PS_RP, [{ name: 'boot', at: mod(-rpAt, core), size: l.size, early: true }, { name: 'paper copy', at: mod(l.pa + P.PHOP - rpAt, core), size: PAPER, early: true }]));
    return out;
  },
  emit(ctx) {
    const { L, P } = ctx;
    ctx.ins('fan', 'SPL', 'B', '2', '0');
    ctx.ins('', 'SPL', 'B', '1', '0');
    ctx.ins('', 'SPL', 'B', '1', '0');
    ctx.ins('', 'MOV', 'I', `<${L('pv')}`, `{${L('pv')}`);
    ctx.ins('', 'MOV', 'I', `<${L('sv')}`, `{${L('sv')}`);
    ctx.ins('sv', 'SPL', 'B', `${L('rs')}-${L('sv')}+${P.SHOP + PS_STONE}`, `${L('rs')}-${L('sv')}+${PS_STONE}`);
    for (let k = 1; k < P.K; k++) ctx.ins('', 'SPL', 'B', `*${L('sv')}`, '0');
    ctx.ins('pv', 'JMP', 'B', `${L('pa')}-${L('pv')}+${P.PHOP + PAPER}`, `${L('pa')}-${L('pv')}+${PAPER}`);
    emitRunner(ctx, 1, 0);
    emitLooper(ctx);
  },
  running(api) {
    const st = api.add(api.at('rs'), api.P.SHOP), code = [1, 2, 3].map((i) => api.code('pa', i));
    return api.vm.processes(0).some((q) => api.rel(q, st) < PS_STONE || code.some((y) => api.same(api.vm.peek(q), y)));
  },
  watch(api) {
    const { P } = api, st = api.add(api.at('rs'), P.SHOP);
    const bodies = [{ name: 'stone', at: st, size: PS_STONE, label: 'rs' }, { name: 'paper', at: api.add(api.at('pa'), P.PHOP), size: PAPER, label: 'pa' }];
    const seen = copyWatch(api, bodies), stone = runnerWatch(api, st, PS_STONE, PS_RP);
    const paper = [1, 2, 3].map((i) => api.code('pa', i));
    return {
      before(pc) { seen(pc); return stone.before(pc); },
      after(t) { stone.after(t); },
      final() {
        if (api.entered && !api.entered()) return;
        const got = seen(-1);
        for (const b of bodies) if (!got.has(b.name)) throw new Error(`runner boot: nothing entered the ${b.name} copy`);
        if (!api.alone) return;
        let n = 0;
        for (let c = 0; c < api.core; c++) if (!api.inImage(c) && paper.every((x, i) => api.same(x, api.vm.peek(c + i)))) n++;
        if (n < 3) throw new Error('runner boot: the paper made too few copies');
      },
    };
  },
};

export default [stoneImp, paperStone];
