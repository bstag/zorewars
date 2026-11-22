// Blocks found missing while rebuilding the Koenigstuhl 94x hill's top 10
// (docs/hill-top10/94x.md):
//
//   airbag-mov-stone  -- David Moore's stone from Fire and Ice II, Fire and
//     Brimstone, Ballista and Fatamorgana X: five processes run a four-line
//     loop that copies one remote MOV bomb twice a pass (at X, and at X plus
//     the bomb's own A-field), a JMN watches the remote bomb, and after one
//     full sweep of its lattice the stone's own bomb lands on its pointer line,
//     which then copies the d-clear's SPL over the watch: every process ends in
//     a SPL-fed d-clear. Alone on the hill the original's stone arm scores more
//     than the whole warrior does.
//
//   flag-cmp-scanner  -- John Metcalf's Discord: a .8c two-pair scanner with a
//     16-cell SPL wipe; at the end of its first lap the pair lands on its own
//     head, the wipe covers its flag cell, and that starts its clear.
//
//   stone-dual-pump   -- David Moore's Denial (also an arm of KAT v5 and Big
//     I.F.F.S.): five lockstep processes copy a self-splitting two-write stone
//     and a pump feeding a 13-point A-imp and a 19-point B-imp spiral from one
//     loop; the stone times itself out onto its own ADD and becomes a
//     one-cell-per-process clear.
//
//   arrow-scanner     -- Christian Schmidt's Arrow X (the scanner arm of
//     Ballista): a .67c pair scan that becomes a .5c blur scanner at its first
//     find and clears after a set number of finds.
//
// All Redcode here is written from scratch from the mechanisms described in
// docs/hill-top30/94x.md and docs/hill-top10/94x.md; the hill warriors were
// read for the mechanism, never copied. Ring, ICWS'94 only.

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const mod = (x, n) => ((x % n) + n) % n;
const near = (d, core) => Math.min(mod(d, core), core - mod(d, core));
const EVERY = ['op', 'mod', 'aMode', 'a', 'bMode', 'b'];
const ZERO = { op: 'DAT', mod: 'F', aMode: '$', a: 0, bMode: '$', b: 0 };
function modInverse(a, m) {
  let [r0, r1, s0, s1] = [mod(a, m), m, 1, 0];
  while (r1) { const q = Math.floor(r0 / r1); [r0, r1] = [r1, r0 - q * r1]; [s0, s1] = [s1, s0 - q * s1]; }
  return r0 === 1 ? mod(s0, m) : null;
}

// ---------------------------------------------------------------------------
// airbag-mov-stone
//
//   agPrep  MOV  ..., ...             HOP > 0: copy the loop (agGo1 to agJmp) and the remote
//                                     bomb HOP cells on; always: plant the d-clear D cells past
//                                     the running pointer line (5 cells)
//   agFan   SPL  1 / MOV -1,0 / MOV -1,0       one process becomes five
//   agGo    JMP  >0, agGo1+HOP-agGo   the five go to agGo1, agTop, agMov, agPtr, agChk (of the copy):
//   agGo1   JMP  agTop                the first one a turn late, so the loop runs in order
//   agTop   ADD.AB #2D, agPtr         the pointer on by twice the bomb's A-field
//   agMov   MOV  >agChk, @agPtr       the remote bomb to X (agChk's B points at it; +1)
//   agPtr   MOV  <agChk, *B0          the remote bomb to X + D, through the A-field of the
//                                     bomb just written (-1: agChk points at it again)
//   agChk   JMN.B agTop, GAP+2        the remote bomb's B-field still there?
//   agJmp   JMP  agPtr+D              no: into the d-clear
//   [GAP blank cells]
//   agBomb  MOV  D, 1                 the remote bomb; D = core - STEP
//   agT0    DAT  0, 5      -> clear gate (its B: the first cell after the clear)
//           DAT  <ANTI, 5  -> the clear's bomb; its B resets the gate when the clear laps
//           SPL  #0, {-2   -> agPtr + D: grows the clear's processes (and ticks the gate's A)
//           MOV  -2, >-3   -> one bomb at the gate, then on
//           DJN.F -1, >-4  -> and a second step of the gate
//
// The pointer starts so that after TIME passes (0: a full sweep of its lattice)
// it is 0: the first MOV then writes the bomb onto agPtr itself. The next
// process to run agPtr runs MOV D, 1, which copies the clear's SPL (agPtr + D)
// over agChk; every process that reaches agChk splits there and its JMP feeds
// the clear. An enemy that zeroes the remote bomb's B-field sends the loop into
// the clear at once (the airbag). With HOP the stone leaves only six loop cells,
// the bomb and the five-cell clear in the far core: the original's footprint,
// which a scanner's wipe-until-empty cannot run along into the loop.
const agLay = (P) => {
  const prep = P.HOP ? 12 : 5, go = prep + 3;
  const l = { prep, fan: prep, go, go1: go + 1, top: go + 2, mov: go + 3, ptr: go + 4, chk: go + 5, jmp: go + 6 };
  l.bomb = l.jmp + 1 + P.GAP; l.t0 = l.bomb + 1; l.size = l.t0 + 5;
  return l;
};
function agPlan(P, core) {
  const D = mod(core - P.STEP, core), D2 = mod(2 * D, core), period = core / gcd(D2, core);
  const T = P.TIME || period - 1;
  return { D, D2, period, T, B0: mod(-D2 * T, core) };
}
// Cells the stone writes before its time-up, as offsets from agPtr: [first write, second write] for each pass.
function agHits(P, core) {
  const { D, D2, T, B0 } = agPlan(P, core), out = [];
  for (let k = 1; k < T; k++) { const x = mod(B0 + D2 * k, core); out.push(x, mod(x + D, core)); }
  return out;
}
const agClearAt = (P, core) => mod(agPlan(P, core).D - 2, core);   // the clear's gate, from the running agPtr
// The loop cells a bomb must never hit (agTop, agMov, agChk, agJmp, from agPtr); agPtr is the time-up.
const AG_LIVE = [-2, -1, 1, 2];
const AG_LOOP = ['agGo1', 'agTop', 'agMov', 'agPtr', 'agChk', 'agJmp'];

const airbagMovStone = {
  id: 'airbag-mov-stone', kind: 'body', exit: 'never', writes: 'core', roams: true, moves: true, dialects: '94',
  processes: 5, grows: true,
  purpose: 'Moore\'s airbag stone (Fire and Ice II, Fire and Brimstone, Ballista, Fatamorgana X): five processes run a four-line loop that copies one remote MOV D,1 bomb twice a pass, at X and at X + D through the bomb just written (D = core - STEP, so the lattice is gcd(STEP, core)), while a JMN watches the remote bomb\'s B-field. After TIME passes (0: one full sweep of the lattice) the bomb lands on the stone\'s own pointer line, which then copies the d-clear\'s SPL over the watch: every process ends in a SPL-fed d-clear D cells away with a DAT that decrements at ANTI (0: core/2+1). An enemy that zeroes the remote bomb starts the clear at once. HOP > 0 copies only the loop and the bomb HOP cells away (the original\'s small footprint).',
  params: { STEP: [1, 27719], TIME: [0, 27719], GAP: [0, 40], ANTI: [0, 54000], HOP: [0, 54000] },
  // The original's numbers on 55,440: STEP 2019 (D 53421, lattice 3: 18,480 cells), a full sweep (9,239 passes), GAP 8.
  defaults: { STEP: 2019, TIME: 0, GAP: 8, ANTI: 0, HOP: 0 },
  entry: 'agPrep', loop: 'agTop',
  provides: { datBomb: 'agT1' },
  mutable: [['agGo', EVERY], ['agFan1', EVERY], ['agFan2', EVERY], ['agPtr', EVERY], ['agChk', EVERY]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [], l = agLay(P);
    if (P.STEP >= core) return [`airbag-mov-stone: STEP ${P.STEP} is not smaller than the ${core}-cell core`];
    const { D, period, T } = agPlan(P, core), g = gcd(D, core);
    if (settings.maxProcesses < 5) out.push('airbag-mov-stone: needs five processes');
    if (period < 200) out.push(`airbag-mov-stone: STEP ${P.STEP} sweeps only ${period} positions`);
    if (T >= period) out.push(`airbag-mov-stone: TIME ${P.TIME} is past the lattice's ${period - 1} passes`);
    if (near(D, core) < l.size + 8) out.push('airbag-mov-stone: the d-clear would land on the stone (STEP too small)');
    if (P.HOP && near(P.HOP, core) < Math.min(settings.maxLength, 600) + l.size + 16) out.push(`airbag-mov-stone: HOP ${P.HOP} puts the loop's copy on the warrior`);
    if (P.HOP && near(P.HOP + l.ptr + D, core) < Math.min(settings.maxLength, 600) + l.size + 16) out.push('airbag-mov-stone: the d-clear of the copy lands on the warrior');
    if (out.length) return out;
    // Live cells (offsets from the running agPtr) that no write before the time-up may
    // touch: the loop and the planted clear. The boot cells and the templates are spent
    // once the loop runs, the gap is blank and the remote bomb gets the same instruction;
    // agPtr is hit only at the time-up.
    const live = new Set(AG_LIVE.map((i) => mod(i, core)));
    for (let j = 0; j < 5; j++) live.add(mod(agClearAt(P, core) + j, core));
    const hits = agHits(P, core);
    const bad = hits.findIndex((h) => live.has(h) || h === 0);
    if (bad >= 0) out.push(`airbag-mov-stone: pass ${(bad >> 1) + 1} bombs its own code before the time-up (lattice ${g})`);
    return out;
  },
  linked(P, settings, at, { span, dead = [] }) {
    const core = settings.coreSize, ptr = mod(at('agPtr') + P.HOP, core), start = at('agPrep'), size = agLay(P).size;
    const isDead = (c) => dead.some((w) => mod(c - w.start, core) < w.size);
    // Other live code of the warrior: any cell of the protected span outside this block.
    const hits = agHits(P, core);
    for (let i = 0; i < hits.length; i++) {
      const c = mod(ptr + hits[i], core);
      if (c < span && mod(c - start, core) >= size && !isDead(c)) return [`airbag-mov-stone: here pass ${(i >> 1) + 1} bombs the rest of the warrior`];
    }
    return [];
  },
  emit(ctx) {
    const { L, P, core } = ctx, { D, D2, B0 } = agPlan(P, core), anti = P.ANTI || Math.floor(core / 2) + 1, H = P.HOP;
    const clr = `${L('agPtr')}+${H + agClearAt(P, core)}`;
    if (H) {
      AG_LOOP.forEach((l, i) => ctx.ins(i ? '' : 'agPrep', 'MOV', 'I', L(l), `${L(l)}+${H}`));
      ctx.ins('', 'MOV', 'I', L('agBomb'), `${L('agBomb')}+${H}`);
    }
    for (let j = 0; j < 5; j++) ctx.ins(j || H ? '' : 'agPrep', 'MOV', 'I', `${L('agT0')}+${j}`, `${clr}+${j}`);
    ctx.ins('agFan', 'SPL', 'B', '1');
    ctx.ins('agFan1', 'MOV', 'I', '-1', '0');
    ctx.ins('agFan2', 'MOV', 'I', '-1', '0');
    ctx.ins('agGo', 'JMP', 'B', '>0', `${L('agGo1')}-${L('agGo')}+${H}`);
    ctx.ins('agGo1', 'JMP', 'B', L('agTop'));
    ctx.ins('agTop', 'ADD', 'AB', `#${D2}`, L('agPtr'));
    ctx.ins('agMov', 'MOV', 'I', `>${L('agChk')}`, `@${L('agPtr')}`);
    ctx.ins('agPtr', 'MOV', 'I', `<${L('agChk')}`, `*${B0}`);
    ctx.ins('agChk', 'JMN', 'B', L('agTop'), `${L('agBomb')}-${L('agChk')}`);
    ctx.ins('agJmp', 'JMP', 'B', `${L('agPtr')}+${D}`);
    for (let i = 0; i < P.GAP; i++) ctx.ins('', 'DAT', 'F', '0', '0');
    ctx.ins('agBomb', 'MOV', 'I', `$${D}`, '$1');
    // The clear, planted at agPtr + HOP + D - 2 by agPrep.
    ctx.ins('agT0', 'DAT', 'F', '$0', '$5');
    ctx.ins('agT1', 'DAT', 'F', `<${anti}`, '$5');
    ctx.ins('agT2', 'SPL', 'B', '#0', '{-2');
    ctx.ins('agT3', 'MOV', 'I', '$-2', '>-3');
    ctx.ins('agT4', 'DJN', 'F', '$-1', '>-4');
  },
  plant: (api) => [[api.add(api.at('agBomb'), api.P.HOP), ZERO, 600]],
  running(api) {
    const { vm } = api, top = api.add(api.at('agTop'), api.P.HOP), clr = api.add(api.at('agPtr'), api.P.HOP + agClearAt(api.P, api.core));
    return vm.processes(0).some((q) => api.rel(q, top) < 5 || api.rel(q, clr) < 5);
  },
  watch(api) {
    const { vm, core, P } = api, { T, D } = agPlan(P, core), H = P.HOP;
    const run = (l) => api.add(api.at(l), H);
    const go1 = run('agGo1'), mv = run('agMov'), ptr = run('agPtr'), bomb = run('agBomb'), spl = api.add(ptr, D);
    const clr = api.add(ptr, agClearAt(P, core)), live = AG_LIVE.map((i) => api.add(ptr, i));
    const planted = api.scenario === 'airbag-mov-stone: planted target';
    let bombs = 0, clearAt = null, retiredAt = null, clearWrites = 0, arrived = false;
    return {
      before(pc) {
        if (!api.entered()) return null;
        if (pc === go1 && !arrived) {
          arrived = true;
          AG_LOOP.forEach((l, i) => { if (!api.same(vm.peek(api.add(go1, i)), api.code(l))) throw new Error('airbag-mov-stone: a process entered the loop before it was in place'); });
          for (let j = 0; j < 5; j++) if (!api.same(vm.peek(api.add(clr, j)), api.code('agT0', j))) throw new Error('airbag-mov-stone: the loop started before its clear was planted');
        }
        if (pc === spl && clearAt === null) clearAt = vm.cycle;
        if (pc === mv && api.same(vm.peek(pc), api.code('agMov'))) return { t: api.add(ptr, vm.peek(ptr).b) };
        if (pc === ptr && api.same({ ...vm.peek(pc), b: 0 }, { ...api.code('agPtr'), b: 0 })) {
          const x = api.add(ptr, vm.peek(ptr).b);
          return { t: api.add(x, vm.peek(x).a) };
        }
        if (pc === api.add(clr, 3)) return { c: api.add(clr, vm.peek(clr).b) };
        return null;
      },
      after(tok) {
        if (!tok) return;
        if (tok.c !== undefined) { if (tok.c !== clr && api.rel(tok.c, clr) < 5) throw new Error("airbag-mov-stone's clear wrote its own code"); clearWrites++; return; }
        const t = tok.t;
        if (t === ptr) { if (retiredAt === null) retiredAt = bombs; return; }
        if (live.includes(t)) throw new Error('airbag-mov-stone bombed its own loop before its time-up');
        if (api.rel(t, clr) < 5) throw new Error('airbag-mov-stone bombed its own d-clear');
        if (t !== bomb && !api.inSelf(t) && api.inImage(t) && !api.inDead(t)) throw new Error('airbag-mov-stone bombed the warrior');
        bombs++;
      },
      final() {
        if (!api.entered()) return;
        if (!arrived) throw new Error('airbag-mov-stone: no process reached the loop');
        if (planted) {
          if (clearAt === null) throw new Error('airbag-mov-stone did not fall into its clear when the remote bomb was zeroed');
          if (!clearWrites) throw new Error("airbag-mov-stone's clear never wrote");
          return;
        }
        if (!api.alone) return;
        if (bombs < Math.min(2 * T - 2, 200)) throw new Error(`airbag-mov-stone bombed too little (${bombs})`);
        if (clearAt === null) {
          if (vm.cycle > 4 * T + 400) throw new Error(`airbag-mov-stone never reached its clear (time-up due after ${T} passes)`);
          return;
        }
        if (retiredAt === null) throw new Error('airbag-mov-stone entered its clear without the time-up or a hit');
        if (!clearWrites) throw new Error("airbag-mov-stone's clear never wrote");
      },
    };
  },
};

// ---------------------------------------------------------------------------
// flag-cmp-scanner (17 instructions): the engine of John Metcalf's Discord
//
//   fcFlag  DAT   0, 0              the flag: the clear starts once anything is written here
//   fcTop   SUB   fcInc, fcPtr      both pointers on by STEP
//   fcPtr   SNE   B0-GAP, B0        a pair GAP apart (entry: the first look needs no SUB)
//           SUB   fcInc, fcPtr
//           SEQ   *fcPtr, @fcPtr    the next pair; after a difference, the same pair again
//           SLT   #OWN, fcPtr       a difference past our own cells: attack
//           DJN.F fcTop, <STREAM    scan on; the stream walks back one cell a pass to fcFlag
//   fcAim   MOV.B fcPtr, #0         the wipe pointer: five cells past the find
//           ADD   #COUNT, fcCnt
//   fcWipe  MOV   *1, <fcAim        2*COUNT SPLs downward over the pair
//           MOV   fcInc, <fcAim
//   fcCnt   DJN   fcWipe, #0
//           JMZ   fcTop, fcFlag     flag still empty: scan on
//   fcInc   SPL   #-STEP, -STEP     the increment, the wipe's bomb, and the clear's SPL pump
//   fcClr   MOV   fcBomb, >fcWipe+1 a d-clear on fcWipe+1's fields: DAT forward,
//           DJN.F fcClr, {fcWipe+1  decrements backward
//   fcBomb  DAT   1, 9
//
// Two pairs every five instructions (.8c). The geometry times the end: the
// pointers start at STEP - 1, so the B pointer always sits one below a multiple
// of STEP from fcPtr, and at the end of its first lap it lands on fcTop. That
// pair differs (code against blank), the SLT does not catch a pointer just
// below fcPtr, and the wipe runs from fcPtr + 3 down over the scan loop and
// fcFlag; the JMZ then falls into the clear. (Discord alone: clear at cycle
// 23,552.) The wipe never reaches fcAim and below: a find past the SLT's limit
// wipes from at least 19 cells on. An enemy write to fcFlag also starts the
// clear, at the next find. The stream decrements cells far below; it is not
// what ends the scan.
const FC = { flag: 0, top: 1, ptr: 2, djn: 6, aim: 7, wipe: 9, cnt: 11, inc: 13, size: 17 };
function fcPlan(P, core) {
  const S = mod(P.STEP, core);
  // The first pair: B0 (STEP - 1) is the first B cell looked at; the pointers move STEP a SUB.
  const B0 = mod(S - 1, core);
  return { S, B0 };
}
const flagCmpScanner = {
  id: 'flag-cmp-scanner', kind: 'body', exit: 'never', writes: 'core', roams: false, dialects: '94',
  processes: 2, grows: true,
  purpose: 'Discord\'s engine (John Metcalf): a one-process .8c scanner that compares two pairs of cells GAP apart every five instructions, STEP at a time, ignores finds among its own cells, and wipes each find with 2*COUNT SPLs downward from four cells past it, with a DJN stream STREAM cells back. Its first look is at STEP - 1, so at the end of the first lap the pair lands on its own head and the wipe covers its scan loop and the flag cell before it; the scanner then falls into a SPL-fed d-clear (as does an enemy write to the flag).',
  params: { STEP: [1, 27719], GAP: [1, 64], COUNT: [2, 32], STREAM: [100, 54000] },
  // Discord's numbers on 55,440: STEP 8286 (gcd 6), GAP 8, COUNT 8, the stream 10,000 back.
  defaults: { STEP: 8286, GAP: 8, COUNT: 8, STREAM: 10000 },
  entry: 'fcPtr', loop: 'fcTop',
  provides: { splBomb: 'fcInc' },
  mutable: [['fcFlag', EVERY], ['fcPtr', ['a', 'b']], ['fcAim', ['b']], ['fcWipe', ['a', 'b']], ['fcCnt', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (P.STREAM >= core - 64) out.push(`flag-cmp-scanner: STREAM ${P.STREAM} must be inside the ${core}-cell core`);
    if (2 * P.COUNT < P.GAP + 2) out.push(`flag-cmp-scanner: a wipe of ${2 * P.COUNT} cells cannot cover a pair ${P.GAP} apart`);
    if (core / gcd(P.STEP, core) < 500) out.push(`flag-cmp-scanner: STEP ${P.STEP} looks at only ${core / gcd(P.STEP, core)} positions`);
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, { S, B0 } = fcPlan(P, core);
    // A difference counts only past our own cells (and the wipe's reach below them): fcPtr's B-field
    // must be at least OWN; finds before the scanner wrap round to large B-fields.
    const own = FC.size - FC.ptr - 1 + 2 * P.COUNT;
    ctx.ins('fcFlag', 'DAT', 'F', '$0', '$0');
    ctx.ins('fcTop', 'SUB', 'F', L('fcInc'), L('fcPtr'));
    ctx.ins('fcPtr', 'SNE', 'I', `$${mod(B0 - P.GAP, core)}`, `$${B0}`);
    ctx.ins('', 'SUB', 'F', L('fcInc'), L('fcPtr'));
    ctx.ins('', 'SEQ', 'I', `*${L('fcPtr')}`, `@${L('fcPtr')}`);
    ctx.ins('', 'SLT', 'AB', `#${own}`, L('fcPtr'));
    ctx.ins('fcDjn', 'DJN', 'F', L('fcTop'), `<${mod(-P.STREAM, core)}`);
    ctx.ins('fcAim', 'MOV', 'B', L('fcPtr'), `#0`);
    ctx.ins('', 'ADD', 'AB', `#${P.COUNT}`, L('fcCnt'));
    // fcAim gets fcPtr's B-field and sits five cells past fcPtr, so the first SPL
    // lands four cells past the find and the wipe runs down over both cells of the pair.
    ctx.ins('fcWipe', 'MOV', 'I', `*1`, `<${L('fcAim')}`);
    ctx.ins('', 'MOV', 'I', L('fcInc'), `<${L('fcAim')}`);
    ctx.ins('fcCnt', 'DJN', 'B', L('fcWipe'), '#0');
    ctx.ins('', 'JMZ', 'B', L('fcTop'), L('fcFlag'));
    ctx.ins('fcInc', 'SPL', 'B', `#${mod(-S, core)}`, `$${mod(-S, core)}`);
    ctx.ins('fcClr', 'MOV', 'I', L('fcBomb'), `>${L('fcWipe')}+1`);
    ctx.ins('', 'DJN', 'F', L('fcClr'), `{${L('fcWipe')}+1`);
    ctx.ins('fcBomb', 'DAT', 'F', '$1', '$9');
  },
  // A target on the scan's path: the B cell of the tenth pair.
  plant: (api) => {
    const { S, B0 } = fcPlan(api.P, api.core);
    return [[api.add(api.at('fcPtr'), mod(B0 + 9 * S, api.core)), { op: 'MOV', mod: 'I', aMode: '$', a: 0, bMode: '$', b: 1 }]];
  },
  running(api) { const top = api.at('fcFlag'); return api.vm.processes(0).some((q) => api.rel(q, top) < FC.size); },
  watch(api) {
    const { vm, core, P } = api, { S, B0 } = fcPlan(P, core);
    const top = api.at('fcFlag'), wipe = api.at('fcWipe'), aim = api.at('fcAim'), clr = api.at('fcClr');
    const planted = api.scenario === 'flag-cmp-scanner: planted target';
    const target = planted ? api.add(api.at('fcPtr'), mod(B0 + 9 * S, core)) : null;
    let wiped = 0, hitTarget = false, clearAt = null, clearWrites = 0;
    const own = (c) => api.rel(c, top) < FC.size;
    return {
      before(pc) {
        if (!api.entered()) return null;
        if (pc === clr && clearAt === null) clearAt = vm.cycle;
        if ((pc === wipe || pc === api.add(wipe, 1)) && api.same(vm.peek(pc), api.code(pc === wipe ? 'fcWipe' : 'fcWipe', pc === wipe ? 0 : 1))) return { k: 1, t: api.add(aim, vm.peek(aim).b - 1) };
        if (pc === clr) return { k: 2, t: api.add(api.add(wipe, 1), vm.peek(api.add(wipe, 1)).b) };
        return null;
      },
      after(tok) {
        if (!tok) return;
        if (tok.k === 1) {
          // The end of the first lap wipes the scan loop itself (a find on fcTop covers the flag): by design.
          if (own(tok.t) ? api.rel(tok.t, top) >= FC.aim : (api.inImage(tok.t) && !api.inDead(tok.t))) throw new Error('flag-cmp-scanner wiped its own warrior');
          if (tok.t === target) hitTarget = true;
          wiped++;
        } else {
          if (api.rel(tok.t, api.at('fcInc')) < 4) throw new Error("flag-cmp-scanner's clear wrote its own loop");
          clearWrites++;
        }
      },
      final() {
        if (!api.entered()) return;
        if (planted) { if (!hitTarget) throw new Error('flag-cmp-scanner ignored the planted target'); return; }
        if (!api.alone) return;
        // Alone the first lap ends on its own head (2.5 cycles a look at STEP's lattice); allow two laps.
        const due = Math.ceil(5 * core / gcd(S, core)) + 2000;
        if (vm.cycle > due && clearAt === null) throw new Error('flag-cmp-scanner never started its clear');
        if (clearAt !== null && !clearWrites) throw new Error("flag-cmp-scanner's clear never wrote");
      },
    };
  },
};

// ---------------------------------------------------------------------------
// stone-dual-pump: the engine of David Moore's Denial (also an arm of KAT v5 and Big I.F.F.S.)
//
//   sdGo    MOV  sdBomb, <stone copy + 5 + OFF>   plant the stone's bomb past its copy
//           MOV  sdImpB, <pump copy + IDB>        plant the B-imp and A-imp templates
//           MOV  sdImpA, <pump copy + IDA>
//           SPL  2 / SPL 2 / SPL 1                five processes in lockstep
//           MOV  {sdStone, {sdVec                 they copy the 5-cell stone (sdStone's A counts)
//           MOV  <sdL3, <sdVec                    and the 4-cell pump and a blank (sdL3's B counts)
//           SPL  1  (x D)                         5 * 2^D workers
//   sdVec   SPL  stone copy, pump copy            each worker sends one into the stone,
//           SPL  @sdVec                           one into the pump
//           JMP  *sdVec                           and goes into the stone itself
//   sdStone SPL  #5, <DJN       the stone: re-entered every pass, so it keeps splitting
//           MOV  bomb, @sdPtr   a bomb at X
//   sdHit   ADD  #2*STEP, sdPtr
//   sdPtr   MOV  bomb, }FIRST   a bomb at X + 2*STEP, or through the A-field of a bomb already there
//           DJN.F sdStone, <DJN a decrement stream
//   sdBomb  DAT  STEP, >1       planted OFF cells past the copy
//   sdL0    SPL  #SB, <SA       the pump: keeps splitting; A and B are the two ring steps
//           ADD.F -1, 1         steps both launch vectors
//           SPL  B-launch, A-launch     a process to the next B-imp point
//   sdL3    JMP  @-1, 2         and this one to the next A-imp point (B: the copy counter)
//   sdImpB  MOV.I #5, SB        NB-point imp, its step in the B-field
//   sdImpA  MOV.I #SA, *0       NA-point imp, its step in the A-field
//
// After TIME/2 passes the stone's pointer reaches its own ADD: the bomb lands
// there, and the loop becomes SPL / MOV bomb, @ptr / DAT >1: every process
// that dies on the DAT moves the pointer on a cell, a one-cell-per-process clear.
// The pump's launch vectors start LEADB and LEADA ring steps behind the
// templates, as many as the workers that step them before the first launch.
const sdLay = (P) => { const vec = 8 + P.D; return { vec, stone: vec + 3, bomb: vec + 8, l0: vec + 9, l3: vec + 12, impB: vec + 13, impA: vec + 14, size: vec + 15 }; };
function sdPlan(P, core) {
  return { SA: modInverse(P.NA, core), SB: modInverse(P.NB, core), S: mod(P.STEP, core) };
}
// Offsets from the stone copy's sdPtr that the stone writes before its time-up, pass by pass.
// The loop runs in order, so in empty core the second MOV writes a fresh cell (A-field 0) and
// the next pass's first MOV writes it again: one new cell a pass, 2*STEP apart. (Through the
// A-field of a non-empty cell it lands elsewhere; that is the attack, not a self-hit.)
function sdHits(P, core) {
  const out = [];
  for (let k = 1; k < P.TIME / 2; k++) out.push(mod(-1 - P.STEP * (P.TIME - 2 * k), core));
  return out;
}
// Passes the pump and its templates are left alone (the original's stone bombs its own
// pump about 6,600 passes in, and its own DJN line later: both harmless by then).
const SD_PUMP_SAFE = 1000;
const stoneDualPump = {
  id: 'stone-dual-pump', kind: 'body', exit: 'never', grows: true, writes: 'sparse', roams: true, dialects: '94',
  purpose: 'Denial\'s engine (David Moore): five lockstep processes plant a bomb and two imp templates, copy a 5-line self-splitting stone SHOP away and a 4-line dual pump PHOP away, double D times, and send two of every three processes into the stone and one into the pump. The stone writes a DAT STEP,>1 bomb at X and through its A-field STEP on (every STEP cells, a 2*STEP stride) with a decrement stream, and after TIME/2 passes bombs its own ADD and becomes a one-cell-per-process clear; the pump feeds an NA-point A-imp spiral and an NB-point B-imp spiral from one loop, one launch each a pass, for ever.',
  params: { D: [0, 3], SHOP: [256, 54000], PHOP: [256, 54000], STEP: [1, 27719], TIME: [100, 30000], OFF: [0, 40], DJN: [1, 54000], NA: [3, 43], NB: [3, 43], IDA: [8, 4000], IDB: [8, 4000], LEADA: [0, 200], LEADB: [0, 200] },
  // Denial's numbers on 55,440.
  defaults: { D: 2, SHOP: 30133, PHOP: 30361, STEP: 859, TIME: 23300, OFF: 5, DJN: 45001, NA: 13, NB: 19, IDA: 804, IDB: 203, LEADA: 40, LEADB: 20 },
  entry: 'sdGo',
  processes: (P) => 15 * 2 ** P.D,
  mutable: [['sdVec', ['a', 'b']], ['sdStone', ['a']], ['sdL3', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [], l = sdLay(P), { SA, SB } = sdPlan(P, core);
    if (!SA) out.push(`stone-dual-pump: no ${P.NA}-point imp ring on a ${core}-cell core (NA)`);
    if (!SB) out.push(`stone-dual-pump: no ${P.NB}-point imp ring on a ${core}-cell core (NB)`);
    if (P.NA === P.NB) out.push('stone-dual-pump: NA and NB must differ');
    if (P.TIME % 2) out.push('stone-dual-pump: TIME must be even, so the stone lands on its own ADD');
    if (Math.abs(P.IDA - P.IDB) < 8) out.push('stone-dual-pump: IDA and IDB put the two templates on top of each other');
    if (settings.maxProcesses < 15 * 2 ** P.D) out.push('stone-dual-pump: needs more processes than the hill allows');
    if (out.length) return out;
    const room = Math.min(settings.maxLength, 600) + 16;
    const S0 = mod(l.vec + P.SHOP, core), P0 = mod(l.vec + P.PHOP, core);
    for (const [a, b, what, r] of [[0, S0, 'the stone copy', room], [0, P0, 'the pump copy', room], [S0, P0, 'the stone and the pump', 16 + P.OFF]]) if (near(b - a, core) < r) out.push(`stone-dual-pump: ${what} lands on the warrior or on each other`);
    if ([P.IDA, P.IDB].some((id) => near(P0 + id - S0, core) < 16 + P.OFF || near(P0 + id, core) < room)) out.push('stone-dual-pump: an imp template lands on the stone or the warrior');
    if (out.length) return out;
    // Before its time-up the stone must miss its own five cells and bomb, and the pump and its templates.
    // The SPL, the first MOV, the ADD and the pointer line must never be hit before the
    // time-up (the DJN may: the SPL #0 then feeds one pass per process); the pump and its
    // templates not in the first SD_PUMP_SAFE passes.
    const ptr = mod(S0 + 3, core), stone = new Set([-3, -2, -1, 0].map((i) => mod(i, core)));
    const pump = new Set([0, 1, 2, 3, P.IDA, P.IDB].map((c) => mod(P0 + c - ptr, core)));
    const hits = sdHits(P, core);
    const k = hits.findIndex((h, i) => stone.has(h) || (i < SD_PUMP_SAFE && pump.has(h)));
    if (k >= 0) out.push(`stone-dual-pump: pass ${k + 1} bombs ${stone.has(hits[k]) ? 'the stone itself' : 'the pump'} before its time-up`);
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, l = sdLay(P), { SA, SB, S } = sdPlan(P, core);
    const stoneAt = `${L('sdVec')}+${P.SHOP}`, pumpAt = `${L('sdVec')}+${P.PHOP}`;
    ctx.ins('sdGo', 'MOV', 'I', L('sdBomb'), `${stoneAt}+${5 + P.OFF}`);
    ctx.ins('', 'MOV', 'I', L('sdImpB'), `${pumpAt}+${P.IDB}`);
    ctx.ins('', 'MOV', 'I', L('sdImpA'), `${pumpAt}+${P.IDA}`);
    ctx.ins('', 'SPL', 'B', '2');
    ctx.ins('', 'SPL', 'B', '2');
    ctx.ins('', 'SPL', 'B', '1');
    ctx.ins('', 'MOV', 'I', `{${L('sdStone')}`, `{${L('sdVec')}`);
    ctx.ins('', 'MOV', 'I', `<${L('sdL3')}`, `<${L('sdVec')}`);
    for (let i = 0; i < P.D; i++) ctx.ins('', 'SPL', 'B', '1');
    // After five predecrements each: A the stone copy's first cell, B the pump copy's.
    ctx.ins('sdVec', 'SPL', 'B', `${P.SHOP + 5}`, `${P.PHOP + 5}`);
    ctx.ins('', 'SPL', 'B', `@${L('sdVec')}`);
    ctx.ins('', 'JMP', 'B', `*${L('sdVec')}`);
    const bomb = `${L('sdStone')}+${5 + P.OFF}`;
    ctx.ins('sdStone', 'SPL', 'B', '#5', `<${mod(P.DJN, core)}`);
    ctx.ins('', 'MOV', 'I', bomb, `@${L('sdPtr')}`);
    ctx.ins('sdHit', 'ADD', 'AB', `#${mod(2 * S, core)}`, L('sdPtr'));
    ctx.ins('sdPtr', 'MOV', 'I', bomb, `}${mod(-1 - S * P.TIME, core)}`);
    ctx.ins('', 'DJN', 'F', L('sdStone'), `<${mod(P.DJN - 4, core)}`);
    ctx.ins('sdBomb', 'DAT', 'F', `$${S}`, '>1');
    // The pump; its launch vectors are relative to the copy's third line.
    ctx.ins('sdL0', 'SPL', 'B', `#${SB}`, `<${SA}`);
    ctx.ins('', 'ADD', 'F', '-1', '1');
    ctx.ins('', 'SPL', 'B', `${mod(-2 + P.IDB - P.LEADB * SB, core)}`, `${mod(-2 + P.IDA - P.LEADA * SA, core)}`);
    ctx.ins('sdL3', 'JMP', 'B', '@-1', '2');
    ctx.ins('sdImpB', 'MOV', 'I', '#5', `$${SB}`);
    ctx.ins('sdImpA', 'MOV', 'I', `#${SA}`, '*0');
  },
  running(api) {
    const { SA, SB } = sdPlan(api.P, api.core), st = api.add(api.at('sdVec'), api.P.SHOP);
    const a = api.code('sdImpA'), b = api.code('sdImpB'), pump = api.add(api.at('sdVec'), api.P.PHOP);
    return api.vm.processes(0).some((q) => api.rel(q, st) < 5 || api.rel(q, pump) < 4 || api.same(api.vm.peek(q), a) || api.same(api.vm.peek(q), b));
  },
  watch(api) {
    const { vm, P } = api;
    const st = api.add(api.at('sdVec'), P.SHOP), pump = api.add(api.at('sdVec'), P.PHOP);
    const hit = api.add(st, 2), ptr = api.add(st, 3), mv = api.add(st, 1);
    const a = api.code('sdImpA'), b = api.code('sdImpB');
    const seen = { stone: false, pump: false };
    let bombs = 0, retired = null, imps = { a: 0, b: 0 };
    const check = (at, label, n, name) => { for (let i = 0; i < n; i++) { const want = api.code(label, i); if (i === 0 && name === 'stone') continue; if (!api.same(vm.peek(api.add(at, i)), want)) throw new Error(`stone-dual-pump: a process entered the ${name} copy before it was complete`); } };
    return {
      before(pc) {
        if (!api.entered()) return null;
        if (!seen.stone && pc === st) { seen.stone = true; check(st, 'sdStone', 5, 'stone'); }
        if (!seen.pump && pc === pump) { seen.pump = true; check(pump, 'sdL0', 3, 'pump'); }
        if (retired === null && vm.cycle % 997 === 0) {
          let na = 0, nb = 0;
          for (const q of vm.processes(0)) { const x = vm.peek(q); if (api.same(x, a)) na++; else if (api.same(x, b)) nb++; }
          imps = { a: Math.max(imps.a, na), b: Math.max(imps.b, nb) };
        }
        if (retired === null && (pc === mv || pc === ptr) && api.same(vm.peek(hit), api.code('sdHit'))) {
          const p = vm.peek(ptr), t = pc === mv ? api.add(ptr, p.b) : api.add(api.add(ptr, p.b), vm.peek(api.add(ptr, p.b)).a);
          return { t };
        }
        return null;
      },
      after(tok) {
        if (!tok) return;
        if (tok.t === hit) { retired = vm.cycle; return; }
        if (api.rel(tok.t, st) < 4) throw new Error('stone-dual-pump: the stone bombed itself before its time-up');
        if (api.rel(tok.t, pump) < 4 && bombs < SD_PUMP_SAFE) throw new Error('stone-dual-pump: the stone bombed the pump early');
        if (!api.inSelf(tok.t) && api.inImage(tok.t) && !api.inDead(tok.t)) throw new Error('stone-dual-pump: the stone bombed the warrior');
        bombs++;
      },
      final() {
        if (!api.entered()) return;
        if (!seen.stone || !seen.pump) throw new Error('stone-dual-pump: nothing entered the stone or the pump copy');
        if (!api.alone) return;
        if (bombs < 100) throw new Error(`stone-dual-pump: only ${bombs} bombs`);
        if (imps.a < P.NA || imps.b < P.NB) throw new Error(`stone-dual-pump: the pump fed only ${imps.a} A-imps and ${imps.b} B-imps`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// arrow-scanner (13 instructions): the engine of Christian Schmidt's Arrow X,
// the scanner arm of Ballista
//
//   arGate  DAT   0, 0              the clear's gate (two cells before the head)
//           DAT   0, 0
//   arHead  MOV   }arFlag, >FAR     run once after each later find: drops a copy of
//                                   itself on a far forward stream and puts arFlag back
//   arWip   MOV   *arAdd, >arHead   the carpet: one SPL a lap from arHead's B-field on
//   arAdd   ADD.F arInc, arScan     both pointers on by STEP
//   arScan  SNE   }B0+GAP, B0       a pair GAP apart (entry); the } ticks a trail of A-fields
//   arFlag  DJN.F arAdd, <TRAIN     equal: scan on, with a decrement stream
//           MOV.B arScan, @arWip    a find: aim the carpet three cells before it
//           DJN   {arFlag, #HITS    count it, and start the loop one line earlier
//   arInc   SPL   #STEP, STEP       the increment and the carpet's bomb; after HITS
//                                   finds it runs, splits for ever and feeds
//   arClr   MOV   arBomb, >arGate   a forward clear
//           DJN.F arClr, >arGate
//   arBomb  DAT   <1, 2-arGate+arBomb   its B-field resets the gate past the block
//
// Before the first find the loop is three instructions (.67c); the first find
// moves arFlag's jump to arWip, so each lap also lays one carpet SPL (.5c); a
// later find moves it to arHead for one lap, and arHead's } puts it back.
const AR = { gate: 0, head: 2, wip: 3, add: 4, scan: 5, flag: 6, inc: 9, clr: 10, bomb: 12, size: 13 };
const arrowScanner = {
  id: 'arrow-scanner', kind: 'body', exit: 'never', writes: 'core', roams: false, dialects: '94',
  processes: 2, grows: true,
  purpose: 'Arrow X\'s engine (Christian Schmidt): a one-process scanner that compares a pair of cells GAP apart STEP at a time in a 3-instruction loop (.67c) with a decrement stream; the first find adds a carpet line, so each lap also drops one SPL at a pointer that every find re-aims three cells before itself (a blur scanner at .5c); after HITS finds the SPL that serves as increment and bomb starts splitting and feeds a forward clear with DAT <1.',
  params: { STEP: [1, 27719], GAP: [1, 64], HITS: [2, 400], TRAIN: [1, 54000], FAR: [1, 54000] },
  // Arrow X's numbers on 55,440 (in Ballista: STEP 4927, 45 finds).
  defaults: { STEP: 4927, GAP: 8, HITS: 45, TRAIN: 50302, FAR: 1800 },
  entry: 'arScan', loop: 'arAdd',
  provides: { splBomb: 'arInc' },
  mutable: [['arGate', EVERY], ['arHead', ['b']], ['arScan', ['a', 'b']], ['arFlag', ['a']], ['arCnt', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (core / gcd(P.STEP, core) < 500) out.push(`arrow-scanner: STEP ${P.STEP} looks at only ${core / gcd(P.STEP, core)} positions`);
    if (P.FAR >= core - 64 || P.FAR < 64) out.push(`arrow-scanner: FAR ${P.FAR} drops its stream on itself`);
    if (P.TRAIN >= core) out.push(`arrow-scanner: TRAIN ${P.TRAIN} is outside the ${core}-cell core`);
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, S = mod(P.STEP, core), B0 = mod(2 * S, core);
    ctx.ins('arGate', 'DAT', 'F', '$0', '$0');
    ctx.ins('', 'DAT', 'F', '$0', '$0');
    ctx.ins('arHead', 'MOV', 'I', `}${L('arFlag')}`, `>${mod(P.FAR, core)}`);
    ctx.ins('arWip', 'MOV', 'I', `*${L('arAdd')}`, `>${L('arHead')}`);
    ctx.ins('arAdd', 'ADD', 'F', L('arInc'), L('arScan'));
    ctx.ins('arScan', 'SNE', 'I', `}${mod(B0 + P.GAP, core)}`, `$${B0}`);
    ctx.ins('arFlag', 'DJN', 'F', L('arAdd'), `<${mod(P.TRAIN, core)}`);
    ctx.ins('', 'MOV', 'B', L('arScan'), `@${L('arWip')}`);
    ctx.ins('arCnt', 'DJN', 'B', `{${L('arFlag')}`, `#${P.HITS}`);
    ctx.ins('arInc', 'SPL', 'B', `#${S}`, `$${S}`);
    ctx.ins('arClr', 'MOV', 'I', L('arBomb'), `>${L('arGate')}`);
    ctx.ins('', 'DJN', 'F', L('arClr'), `>${L('arGate')}`);
    ctx.ins('arBomb', 'DAT', 'F', '<1', `$${AR.bomb - AR.gate + 2}`);
  },
  // A target on the scan's path: the B cell of the tenth pair.
  plant: (api) => [[api.add(api.at('arScan'), mod(12 * mod(api.P.STEP, api.core), api.core)), { op: 'MOV', mod: 'I', aMode: '$', a: 0, bMode: '$', b: 1 }]],
  running(api) { const top = api.at('arGate'); return api.vm.processes(0).some((q) => api.rel(q, top) < AR.size); },
  watch(api) {
    const { vm, core, P } = api, S = mod(P.STEP, core);
    const top = api.at('arGate'), head = api.at('arHead'), wip = api.at('arWip'), clr = api.at('arClr'), gate = api.at('arGate');
    const planted = api.scenario === 'arrow-scanner: planted target';
    const target = planted ? api.add(api.at('arScan'), mod(12 * S, core)) : null;
    let carpet = 0, nearTarget = false, clearAt = null, clearWrites = 0;
    return {
      before(pc) {
        if (!api.entered()) return null;
        if (pc === clr && clearAt === null) clearAt = vm.cycle;
        if (pc === wip && api.same(vm.peek(pc), api.code('arWip'))) return { k: 1, t: api.add(head, vm.peek(head).b) };
        if (pc === clr) return { k: 2, t: api.add(gate, vm.peek(gate).b) };
        return null;
      },
      after(tok) {
        if (!tok) return;
        const own = api.rel(tok.t, top) < AR.size;
        if (tok.k === 1) {
          // A find among its own cells carpets the scan loop (as Arrow X does); the clear must stay whole.
          if (own && api.rel(tok.t, api.at('arInc')) < 4) throw new Error('arrow-scanner carpeted its own clear');
          if (!own && api.inImage(tok.t) && !api.inDead(tok.t)) throw new Error('arrow-scanner carpeted its own warrior');
          if (target !== null && api.rel(tok.t, api.add(target, -8)) < 16) nearTarget = true;
          carpet++;
        } else {
          if (api.rel(tok.t, api.at('arInc')) < 4) throw new Error("arrow-scanner's clear wrote its own loop");
          clearWrites++;
        }
      },
      final() {
        if (!api.entered()) return;
        if (planted) { if (!nearTarget) throw new Error('arrow-scanner ignored the planted target'); return; }
        if (!api.alone) return;
        if (clearAt !== null && !clearWrites) throw new Error("arrow-scanner's clear never wrote");
      },
    };
  },
};

export default [airbagMovStone, flagCmpScanner, stoneDualPump, arrowScanner];
