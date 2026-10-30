// More torus blocks (docs/block-algebra.md; AGENTS.md "The plane").
// Four blocks: a vector silk paper, a backward two-pass clear, a many-process
// plane clear that shares one pointer, and a leap body that dodges a front.
// Code runs along x; label distances are plain x-steps, cross-row motion is a
// vector (ctx.vec). All address arithmetic goes through api.add/api.rel/geo,
// never a plain sum. Written from scratch; warriors are studied, never copied.

const KILL = { op: 'DAT', mod: 'F', aMode: '#', a: 0, bMode: '#', b: 0 };
const dimsOf = (s) => [s.sizeX ?? s.coreSize, s.sizeY ?? 1, s.sizeZ ?? 1];
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const lcm = (a, b) => (a / gcd(a, b)) * b;
const wrap = (v, m) => ((v % m) + m) % m;
const period = (s, m) => m / gcd(wrap(s, m), m);          // steps of s before a walk comes home
const vz = (ctx, z) => (dimsOf(ctx.settings)[2] > 1 ? z : 0);   // a plane (Z=1) has no z part
const TORUS = { topologies: ['torus'] };
const offset = (api, c, from) => api.geo.decode(api.geo.sub(api.norm(c), api.norm(from)));
const rowKey = (api, c) => { const [, y, z] = api.geo.decode(c); return `${y},${z}`; };

// ---------------------------------------------------------------------------
// vector-silk: a silk-style vector paper. Each lap copies its body to a
// destination taken from the seed (dst.a), starts a process there, then moves
// the seed on by [0,SY,SZ]: the copy distance changes every lap, so the copies
// climb through rows and (in a volume) layers. The seed's y (or z) offset is
// odd while its axis step and size are even, so a copy never lands on the
// original's own row (or layer) and cannot corrupt it. The copy pointer counts
// down the x axis from DX+1 to DX-7 and so stays inside the row.
const SILKLEN = 8;
const vectorSilk = {
  ...TORUS, kind: 'body', exit: 'never', processes: 1, grows: true, writes: 'sparse', roams: true, entryFirst: false,
  purpose: 'Vector silk paper: copies itself [DX,DY,DZ] away, runs a process there, then moves its seed on by [0,SY,SZ]; the copy distance changes each lap, spreading complete copies through rows and layers.',
  params: { DX: [-100, 100], DY: [0, 199], DZ: [0, 199], SY: [0, 199], SZ: [0, 199] },
  defaults: { DX: 7, DY: 3, DZ: 1, SY: 6, SZ: 3 },
  entry: 'go',
  mutable: [['cnt', ['b']], ['dst', ['a', 'b']]],
  mismatches(P, settings) {
    const [X, Y, Z] = dimsOf(settings), out = [], hx = Math.floor(X / 2);
    const safeY = Y % 2 === 0 && P.SY % 2 === 0 && P.DY % 2 !== 0;
    const safeZ = Z > 1 && Z % 2 === 0 && P.SZ % 2 === 0 && P.DZ % 2 !== 0;
    if (!safeY && !safeZ) out.push('vector-silk: its copies could land on its own row (DY odd with SY and Y even, or DZ odd with SZ and Z even)');
    if (P.DX - (SILKLEN - 1) < -hx || P.DX + 1 > X - hx - 1) out.push(`vector-silk: DX must be from ${SILKLEN - 1 - hx} to ${X - hx - 2} on a ${X}-wide row`);
    if (lcm(period(P.SY, Y), period(P.SZ, Z)) < 3) out.push('vector-silk: its seed visits fewer than 3 rows and layers');
    if (Z > 1 && wrap(P.SZ, Z) === 0) out.push('vector-silk: in a volume SZ must move its copies through the layers');
    return out;
  },
  emit(ctx) {
    const { L, P } = ctx;
    ctx.ins('cnt', 'DAT', 'F', '#0', '#0');
    ctx.ins('go', 'MOV', 'AB', `#${SILKLEN}`, L('cnt'));
    ctx.ins('', 'MOV', 'AB', L('dst'), L('dst'));                      // this lap's destination: the seed
    ctx.ins('copy', 'MOV', 'I', `@${L('cnt')}`, `<${L('dst')}`);       // cells 8..1, last first
    ctx.ins('', 'DJN', 'B', L('copy'), L('cnt'));
    ctx.ins('spl', 'SPL', 'B', `@${L('dst')}`);                        // launch the fresh copy
    ctx.ins('', 'ADD', 'A', `#${ctx.vec(0, P.SY, vz(ctx, P.SZ))}`, L('dst'));
    ctx.ins('', 'JMP', 'B', L('go'));
    ctx.ins('dst', 'DAT', 'F', `#${ctx.vec(P.DX + 1, P.DY, vz(ctx, P.DZ))}`, '#0');
  },
  running(api) {
    const code = Array.from({ length: 7 }, (_, k) => api.code('go', k));
    return api.vm.processes(0).some((q) => code.some((y) => api.same(api.vm.peek(q), y)));
  },
  watch(api) {
    // The copied `dst` cell has a mutated b (it is the copy pointer), so only
    // the first seven cells (go..jmp) make an exact, re-runnable copy.
    const go = api.at('go'), code = Array.from({ length: 7 }, (_, k) => api.code('go', k));
    const complete = (c) => code.every((y, k) => api.same(api.vm.peek(api.add(c, k)), y));
    let spawns = 0;
    return {
      before: (pc) => (spawns < 4 && pc === api.at('spl') ? api.add(api.at('dst'), api.vm.peek(api.at('dst')).b) : null),
      after: (t) => {
        if (t === null) return;
        spawns++;
        const [, y, z] = offset(api, t, go);
        if (!y && !z) throw new Error('vector-silk started a process on its own row');
        if (!complete(t)) throw new Error('vector-silk launched an incomplete copy');
      },
      final: () => {
        if (!api.alone) return;
        const rows = new Set();
        for (let c = 0; c < api.core; c++) if (!api.inImage(c) && complete(c)) rows.add(rowKey(api, c));
        if (rows.size < 3) throw new Error(`vector-silk's complete copies are in ${rows.size} rows/layers`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// backward-clear: a two-pass clear that walks backward. Its pointer counts
// down (predecrement), so its front arrives from the side a forward clear's
// lookouts never watch. The pointer `ptr` is the warrior's first cell; each
// pass starts just behind it and counts CORESIZE - span cells, stopping just
// short of the image, so it spares the whole warrior (itself included). Pass 1
// lays stun traps, pass 2 lays DATs, then it starts over. TRAP 1 lays an
// SPL 0 / JMP -1 trap pair (a process on the JMP hops back onto the SPL).
const backwardClear = {
  ...TORUS, kind: 'finisher', exit: 'never', processes: 1, writes: 'core', protects: 'self', relocatable: false,
  purpose: 'Backward two-pass clear in one process: predecrement passes of SPL traps then DATs, each stopping short of the image, over and over; TRAP 1 lays an SPL 0 / JMP -1 trap pair.',
  params: { TRAP: [0, 1] }, defaults: { TRAP: 0 },
  entry: 'go', loop: 'go',
  mutable: [['ptr', ['b']], ['left', ['b']]],
  emit(ctx) {
    const { L, P } = ctx, span = ctx.span, count = ctx.core - span;
    const pair = P.TRAP === 1, cnt1 = pair ? Math.floor(count / 2) : count;
    ctx.ins('ptr', 'DAT', 'F', '#0', '#0');                     // rel 0: the pointer counts down from here
    ctx.ins('go', 'MOV', 'AB', '#0', L('ptr'));
    ctx.ins('', 'MOV', 'AB', `#${cnt1}`, L('left'));
    ctx.ins('pass1', 'MOV', 'I', L('stun'), `<${L('ptr')}`);
    if (pair) ctx.ins('', 'MOV', 'I', L('jump'), `<${L('ptr')}`);
    ctx.ins('', 'DJN', 'B', L('pass1'), L('left'));
    ctx.ins('', 'MOV', 'AB', '#0', L('ptr'));
    ctx.ins('', 'MOV', 'AB', `#${count}`, L('left'));
    ctx.ins('pass2', 'MOV', 'I', L('kill'), `<${L('ptr')}`);
    ctx.ins('', 'DJN', 'B', L('pass2'), L('left'));
    ctx.ins('', 'JMP', 'B', L('go'));
    ctx.ins('left', 'DAT', 'F', '#0', '#0');
    ctx.ins('stun', 'SPL', 'B', '#0', '#0');
    if (pair) ctx.ins('jump', 'JMP', 'B', '-1');
    ctx.ins('kill', 'DAT', 'F', '#0', '#0');
  },
  watch(api) {
    const span = api.total, ptr = api.at('ptr');
    const stunPc = api.at('pass1'), jumpPc = api.P.TRAP === 1 ? api.at('pass1', 1) : -1, killPc = api.at(api.P.TRAP === 1 ? 'pass2' : 'pass2');
    const kills = new Set();
    const spared = (t) => api.rel(t, api.self.start) < span;
    const writeAt = () => api.add(ptr, api.norm(api.vm.peek(ptr).b - 1));   // <ptr: predecrement then address
    return {
      before: (pc) => {
        if (pc === stunPc) return { t: writeAt(), op: 'SPL' };
        if (pc === jumpPc) return { t: writeAt(), op: 'JMP' };
        if (pc === killPc) return { t: writeAt(), op: 'DAT' };
        return null;
      },
      after: (tok) => {
        if (tok === null) return;
        if (spared(tok.t)) throw new Error('backward-clear wrote into the image it must spare');
        if (api.vm.peek(tok.t).op !== tok.op) throw new Error(`backward-clear wrote ${api.vm.peek(tok.t).op}, not ${tok.op}`);
        if (tok.op === 'DAT') kills.add(tok.t);
      },
      final: () => {
        if (!api.sole() || kills.size < api.core - span) return;   // a full kill pass has run
        for (let c = 0; c < api.core; c++) {
          if (api.rel(c, api.self.start) < span) continue;         // spared
          if (!kills.has(c)) throw new Error(`backward-clear missed a cell (${api.geo.format(api.geo.sub(c, api.self.start))} from it)`);
        }
      },
    };
  },
};

// ---------------------------------------------------------------------------
// multi-plane-clear: a two-pass plane clear run by PROCS processes that share
// one pointer, so a bomb that kills one process does not stop the clear: the
// others keep advancing the same pointer. Each process has its own loop (so a
// DAT on one path spares the others), but all read and step the shared `ptr`.
// Two SLT guards write only while span <= ptr.b <= limit: the low guard turns
// away a pointer that has wrapped below the image, the high guard keeps slack
// for PROCS so racing writers cannot step past a full lap into the image. The
// bomb is SPL 0 on the first lap (stun), then a DAT for ever after.
const multiPlaneClear = {
  ...TORUS, kind: 'finisher', exit: 'never', writes: 'core', protects: 'image', relocatable: false,
  processes: (P) => P.PROCS,
  purpose: 'Two-pass plane clear run by PROCS processes sharing one pointer: a >ptr sweep (SPL 0 then DAT) that counts through every cell, spares the image, and keeps going when one of its processes is killed.',
  params: { PROCS: [2, 4] }, defaults: { PROCS: 2 },
  entry: 'go', loop: 'loop1',
  mutable: [['ptr', ['b']], ['bomb', ['op', 'mod', 'aMode', 'a', 'bMode', 'b']]],
  emit(ctx) {
    const { L, P } = ctx, first = ctx.span, limit = ctx.core - P.PROCS;
    ctx.ins('ptr', 'DAT', 'F', '#0', `#${first}`);              // rel 0: the shared pointer
    ctx.ins('bomb', 'SPL', 'B', '#0', '#0');                    // first lap stuns, then becomes a DAT
    ctx.ins('kill', 'DAT', 'F', '#0', '#0');
    for (let i = 2; i <= P.PROCS; i++) ctx.ins(i === 2 ? 'go' : '', 'SPL', 'B', L('loop' + i));
    if (P.PROCS < 2) ctx.mark('go');
    for (let i = 1; i <= P.PROCS; i++) {
      ctx.ins('loop' + i, 'SLT', 'AB', `#${first - 1}`, L('ptr'));  // ptr.b >= span? skip the low reset
      ctx.ins('', 'JMP', 'B', L('reset' + i));                      // wrapped below the image: reset
      ctx.ins('', 'SLT', 'AB', `#${limit}`, L('ptr'));              // ptr.b > limit? fall through to reset
      ctx.ins('', 'JMP', 'B', L('do' + i));                         // in range: write
      ctx.ins('reset' + i, 'MOV', 'I', L('kill'), L('bomb'));       // lap done: stun -> DAT
      ctx.ins('', 'MOV', 'AB', `#${first}`, L('ptr'));              // reset the shared pointer
      ctx.ins('do' + i, 'MOV', 'I', L('bomb'), `>${L('ptr')}`);
      ctx.ins('', 'JMP', 'B', L('loop' + i));
    }
  },
  watch(api) {
    const span = api.total, ptr = api.at('ptr'), bomb = api.at('bomb');
    const doAt = [];
    for (let i = 1; i <= api.P.PROCS; i++) doAt.push(api.at('do' + i));
    const kills = new Set();
    let writes = 0;
    return {
      before: (pc) => (doAt.includes(pc) ? { t: api.add(ptr, api.vm.peek(ptr).b), kill: api.vm.peek(bomb).op === 'DAT' } : null),
      after: (tok) => {
        if (tok === null) return;
        if (api.rel(tok.t, api.self.start) < span) throw new Error('multi-plane-clear wrote into the image it must spare');
        writes++;
        if (tok.kill) kills.add(tok.t);
      },
      final: () => {
        // Alone: it clears essentially the whole core (all but the image and a
        // PROCS-cell slack behind it). The plant scenario only needs survival.
        if (api.scenario.startsWith('multi-plane-clear: planted') && writes < 50) throw new Error('multi-plane-clear stalled after a process was killed');
        if (!api.alone || !api.sole() || kills.size < api.core - span - 2 * api.P.PROCS) return;
        let holes = 0;
        for (let c = 0; c < api.core; c++) {
          if (api.rel(c, api.self.start) < span) continue;
          if (!kills.has(c)) holes++;
        }
        if (holes > 2 * api.P.PROCS) throw new Error(`multi-plane-clear left ${holes} cells uncleared`);
      },
    };
  },
  // A DAT dropped on one process's loop, after the processes are running, with
  // a cycle: that process dies, the others keep the shared clear going.
  plant(api) {
    return api.P.PROCS >= 2 ? [[api.at('loop2'), KILL, 60]] : [];
  },
};

// ---------------------------------------------------------------------------
// torus-leap: a body that dodges a front. It plants a marker SENT rows "up"
// (the way a clear's front arrives) and watches it. Between looks it runs a
// slow clear of its own, bounded to CLEN cells just ahead so it never reaches
// the marker and so, alone, never leaps. When something overwrites the marker,
// it copies its whole body [0,-HOPY,-HOPZ] (further up, behind the front),
// runs the copy, and leaves its old code behind. `first` re-plants the marker
// and re-aims the clear, so each copy starts clean.
const torusLeap = {
  ...TORUS, kind: 'body', exit: 'never', processes: 1, writes: 'sparse', roams: true, moves: true,
  purpose: 'Leap body: watches a marker SENT rows away and, when it is hit, copies itself [0,-HOPY,-HOPZ] behind the front and carries on there; a slow bounded clear between looks. Alone it never leaps.',
  params: { SENT: [1, 8], HOPY: [2, 40], HOPZ: [0, 8], CLEN: [40, 400] },
  defaults: { SENT: 2, HOPY: 6, HOPZ: 1, CLEN: 200 },
  entry: 'first', loop: 'loop',
  mutable: [['ptr', ['b']], ['ccnt', ['b']], ['src', ['b']], ['dst', ['b']], ['cnt', ['b']]],
  mismatches(P, settings) {
    const [X, Y, Z] = dimsOf(settings), out = [];
    if (P.HOPY <= P.SENT) out.push('torus-leap: HOPY must take it beyond the marker (HOPY > SENT)');
    if (P.HOPY >= Y) out.push(`torus-leap: HOPY (${P.HOPY}) must be less than the ${Y} rows`);
    if (Z > 1 && P.HOPZ >= Z) out.push(`torus-leap: HOPZ (${P.HOPZ}) must be less than the ${Z} layers`);
    if (P.CLEN >= X * (Y - P.SENT - 1)) out.push('torus-leap: CLEN is long enough to reach its own marker');
    return out;
  },
  emit(ctx) {
    const { L, P } = ctx, hz = vz(ctx, P.HOPZ);
    const up = `#${ctx.vec(0, -P.SENT, 0)}`;
    ctx.ins('first', 'MOV', 'I', L('mark'), `@${L('sentp')}`);       // plant the marker SENT rows up
    ctx.ins('', 'MOV', 'AB', `#${L('end')}-${L('ptr')}`, L('ptr'));  // aim the clear just past us
    ctx.ins('', 'MOV', 'AB', `#${P.CLEN}`, L('ccnt'));
    ctx.ins('loop', 'MOV', 'I', L('kill'), `>${L('ptr')}`);          // one cell of the slow clear
    ctx.ins('', 'SEQ', 'I', L('mark'), `@${L('sentp')}`);            // marker still intact?
    ctx.ins('', 'JMP', 'B', L('move'));                              //   no: the front is near -> leap
    ctx.ins('', 'DJN', 'B', L('loop'), L('ccnt'));                   //   yes: keep clearing, bounded
    ctx.ins('', 'MOV', 'AB', `#${L('end')}-${L('ptr')}`, L('ptr'));  // bounded: re-aim short of the marker
    ctx.ins('', 'MOV', 'AB', `#${P.CLEN}`, L('ccnt'));
    ctx.ins('', 'JMP', 'B', L('loop'));
    ctx.ins('move', 'MOV', 'AB', `#${L('end')}-${L('src')}`, L('src'));
    ctx.ins('', 'MOV', 'AB', `#[${L('end')}-${L('dst')},${-P.HOPY},${-hz}]`, L('dst'));
    ctx.ins('', 'MOV', 'AB', `#${L('end')}-${L('first')}`, L('cnt'));
    ctx.ins('copy', 'MOV', 'I', `<${L('src')}`, `<${L('dst')}`);     // copy the whole body, last cell first
    ctx.ins('', 'DJN', 'B', L('copy'), L('cnt'));
    ctx.ins('', 'JMP', 'B', `@${L('dst')}`);                         // run the copy's first cell
    ctx.ins('src', 'DAT', 'F', '#0', '#0');
    ctx.ins('dst', 'DAT', 'F', '#0', '#0');
    ctx.ins('cnt', 'DAT', 'F', '#0', '#0');
    ctx.ins('ptr', 'DAT', 'F', '#0', '#0');
    ctx.ins('ccnt', 'DAT', 'F', '#0', '#0');
    ctx.ins('sentp', 'DAT', 'F', '#0', up);                          // the marker's place: SENT rows up
    ctx.ins('mark', 'DAT', 'F', '#0', '#1');
    ctx.ins('kill', 'DAT', 'F', '#0', '#0');
    ctx.mark('end');
  },
  running(api) {
    // The process always executes one of the body's code cells (first..jmp),
    // whether in the original or a leap copy; the operands are position-free.
    const code = Array.from({ length: api.rel(api.at('src'), api.at('first')) }, (_, k) => api.code('first', k));
    return api.vm.processes(0).some((q) => { const i = api.vm.peek(q); return code.some((y) => api.same(i, y)); });
  },
  // A front that arrives at the marker (plant with a cycle, after `first` has
  // laid it): the leap must fire and make a whole copy behind it.
  plant(api) {
    return [[api.add(api.at('sentp'), api.geo.encode(0, -api.P.SENT, 0)), KILL, 300]];
  },
  watch(api) {
    const start = api.self.start, leapTo = api.add(start, api.geo.encode(0, -api.P.HOPY, -vz(api, api.P.HOPZ)));
    // The data cells (src..ccnt) hold live values mid-leap, so a whole copy is
    // confirmed by its position-independent code cells (first..jmp).
    const code = Array.from({ length: api.rel(api.at('src'), api.at('first')) }, (_, k) => api.code('first', k));
    const complete = (base) => code.every((y, k) => api.same(api.vm.peek(api.add(base, k)), y));
    let leaped = false;
    return {
      before: (pc) => { if (pc === api.at('move')) { if (api.alone) throw new Error('torus-leap leaped while alone'); leaped = true; } return null; },
      final: () => {
        if (api.alone) return;                                      // alone: only the no-leap rule applies
        if (api.scenario.startsWith('torus-leap: planted')) {
          if (!leaped) throw new Error('torus-leap did not leap when its marker was hit');
          if (!complete(leapTo)) throw new Error('torus-leap leaped to an incomplete copy');
        }
      },
    };
  },
};

export default [
  { id: 'vector-silk', ...vectorSilk },
  { id: 'backward-clear', ...backwardClear },
  { id: 'multi-plane-clear', ...multiPlaneClear },
  { id: 'torus-leap', ...torusLeap },
];
