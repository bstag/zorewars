// Hill imps: two imp pumps that serve a stone (docs/hill-recipe-book.md,
// stones chapter, gap #9) and a silk whose last stage is a moving imp (papers
// chapter, gap #8). Everything here is written from scratch; the hill warriors
// named are studied for their mechanism, never copied. Ring, ICWS'94 only, and
// only where the process table is large (a pump that adds a process every pass,
// or a paper, is pointless on the 8-process LP hill).
//
// Each pump block is a whole stone/imp body: a stone and a continuous imp pump
// in one image, sharing one bomb lattice. Both run forever.
//
//   knight-pump   a continuous pump whose launcher's spare process joins the
//                 stone: every pass launches one imp onto the spiral and then
//                 jumps into the stone loop, so the pump is also the stone's
//                 process feeder. Black Knight #112, Last Judgement #36,
//                 Positive Knife #47.
//
//   capped-pump   a continuous pump placed where the stone's Nth bomb lands:
//                 the stone grows on its own SPL #0 feeder, the pump feeds the
//                 spiral one imp a pass, and bomb N lands on the pump's feeder,
//                 switching the pump off at a planned time, after the spiral is
//                 fed, so it stops taking cycles the stone needs. Quicksilver
//                 #50 (its launcher sits where the stone's 101st bomb lands).
//
// The pump (both blocks). One process sits on SPL #0 and sends a chain down
// the pump every pass of the queue, so the pump launches one imp a pass. Each
// launch lands one imp step and one cell further on than the last (D = STEP +
// 1): every imp already running has moved one cell since, so the new one
// arrives exactly where its predecessor writes, one turn after it, and the
// imps stand STEP apart in queue order like a spiral launched all at once.
// Only the very first imp has no predecessor, so each chain also lays one imp a
// cell further along a carpet ahead of it (the carpet pointer is the launch
// line's B-field). (fanboot-stone-imp's pump works the same way; what is new
// here is where its processes go and how it stops.)
//
// The stone (both blocks) is MOV bomb, @ptr / ADD #STEP, ptr / JMP loop, ptr
// (the JMP's B-field is the pointer). STEP is a multiple of G = 4, so every
// bomb lands on one residue class mod 4 of the block's own cells; the layout
// puts only the bomb, padding and (capped-pump) the pump's feeder on that
// class, so the stone can never hit its own live code, on 8,000 or 55,440.
// Fed one process at a time at the loop's head, its processes run in a fixed
// rotation (MOV, ADD, MOV, ADD...) and bomb every cell of the lattice in turn,
// which is what lets capped-pump plan the pass that hits the pump.
//
//   moving-imp-silk  a two-stage silk (forward, then backward) whose last stage
//                 is Mercenary's moving imp, MOV.I #HOP-LEAD, }LEAD with HOP
//                 about half the core: its copies fan out into strips that the
//                 paper's leftover processes crawl along. Mercenary #69.

import { modInverse } from '../util.js';

const mod = (x, n) => ((x % n) + n) % n;
// Do the cells [a, a + n) and [b, b + m) overlap on this core?
const overlaps = (a, n, b, m, core) => mod(a - b, core) < m || mod(b - a, core) < n;
const G = 4, R = 3;                              // bomb class: offsets = R (mod G) from the block's first cell
const impPoints = (P, core) => P.POINTS || (core % 3 ? 3 : 13);
const impStep = (P, core) => modInverse(impPoints(P, core), core);

// A block's cells in order: [label, op, mod, a, b]. A label of null is a
// padding cell. `check` asserts the layout keeps the bomb class (offsets = R
// mod G) for the bomb, padding and the cells named in `onClass`: no flow ever
// runs through a class cell, since a bomb there would kill it.
function plan(items, onClass = []) {
  const at = {};
  items.forEach((x, i) => {
    if (x[0]) at[x[0]] = i;
    const want = !x[0] || x[0] === 'sBomb' || onClass.includes(x[0]);
    if (want !== (i % G === R)) throw new Error(`hillimps layout: ${x[0] ?? 'padding'} at ${i} is ${want ? 'off' : 'on'} the bomb class`);
  });
  at.size = items.length;
  return at;
}
const PAD = [null, 'DAT', 'F', '#0', '#0'];
function emitAll(ctx, items) { for (const x of items) ctx.ins(x[0] ?? '', x[1], x[2], x[3], x[4]); }

// Contract checks both blocks share.
function pumpMismatches(id, P, settings) {
  const core = settings.coreSize, out = [];
  if (settings.dialect === '88') return [`${id}: the pump and the stone need ICWS'94`];
  if (!impStep(P, core)) return [`${id}: no ${impPoints(P, core)}-point imp spiral on a ${core}-cell core`];
  if (settings.maxProcesses < 64) out.push(`${id}: a continuous pump needs hundreds of processes; this hill allows ${settings.maxProcesses}`);
  if (P.STEP % G) out.push(`${id}: STEP ${P.STEP} must be a multiple of ${G}, so the bombs keep to one residue class of the block`);
  else if (core / (P.STEP % core === 0 ? core : gcd(P.STEP, core)) < 100) out.push(`${id}: STEP ${P.STEP} reaches only ${core / gcd(P.STEP, core)} cells`);
  return out;
}
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };

// The stone's loop and the pump's cells, as both blocks use them. The stone
// loop is MOV bomb, @sJmp / ADD #STEP, sJmp / JMP sMov, first (the JMP's
// B-field is the pointer). The pump: a feeder SPL #0, the carpet MOV, the
// ADD.A that moves the launch on by D = STEP + 1, and the launch line (A = the
// next launch, B = the carpet pointer).
const stoneCells = (ctx, first) => {
  const { L, P, core } = ctx;
  return [
    ['sMov', 'MOV', 'I', L('sBomb'), `@${L('sJmp')}`],
    ['sAdd', 'ADD', 'AB', `#${mod(P.STEP, core)}`, L('sJmp')],
    ['sJmp', 'JMP', 'B', L('sMov'), `${first}`],
    ['sBomb', 'DAT', 'F', '#0', '#1'],
  ];
};
const pumpCell = (ctx, label, S) => {
  const { L, core } = ctx, D = mod(S + 1, core);
  return {
    pFeed: ['pFeed', 'SPL', 'B', '#0', '0'],
    pCarpet: ['pCarpet', 'MOV', 'I', L('pImp'), `>${L('pL')}`],
    pStep: ['pStep', 'ADD', 'A', `#${D}`, L('pL')],
    pL: ['pL', 'SPL', 'B', `${L('pImp')}-${L('pL')}-${D}`, `${L('pImp')}-${L('pL')}+1`],
    pImp: ['pImp', 'MOV', 'I', '#0', `${S}`],
  }[label];
};

// The shared watch: stone writes, pump launches, (knight) spares joining the
// stone, (capped) the cap.
function pumpWatch(api, o) {
  const { vm, P, core } = api, S = impStep(P, core), D = mod(S + 1, core);
  const movAt = api.at('sMov'), addAt = api.at('sAdd'), jmpAt = api.at('sJmp'), launchAt = api.at('pL'), impCell = api.at('pImp');
  const feedAt = api.at('pFeed'), joinAt = o.knight ? api.at('pJoin') : null;
  const imp = api.code('pImp'), mov = api.code('sMov'), launchOp = api.code('pL').op;
  let writes = 0, adds = 0, launches = 0, joins = 0, capWrite = null, launchesAfterCap = 0, enteredAt = null;
  return {
    before(pc) {
      if (enteredAt === null && api.inSelf(pc)) enteredAt = vm.cycle;
      if (pc === movAt && api.same(vm.peek(pc), mov)) return { write: api.norm(jmpAt + vm.peek(jmpAt).b) };
      if (pc === addAt && api.same(vm.peek(pc), api.code('sAdd'))) return { add: true };
      if (pc === launchAt && vm.peek(pc).op === launchOp) return { launch: api.norm(launchAt + vm.peek(launchAt).a) };
      if (joinAt !== null && pc === joinAt && api.same(vm.peek(pc), api.code('pJoin'))) return { join: true };
      return null;
    },
    after(t) {
      if (!t) return;
      if (t.add) { adds++; return; }
      if (t.write !== undefined) {
        // The pointer has moved on once per ADD: this bomb is lattice point `adds`.
        if (o.cap && t.write === feedAt && capWrite === null) capWrite = adds;
        // Inside the block the bombs may only hit the class kept for them.
        if (api.inSelf(t.write) && api.rel(t.write, api.self.start) % G !== R) throw new Error(`${api.scenario}: the stone bombed its own code`);
        writes++;
      } else if (t.launch !== undefined) {
        // The c-th launch lands c * (STEP + 1) past the imp.
        const want = api.norm(impCell + launches * D);
        if (t.launch !== want) throw new Error(`${api.scenario}: launch ${launches} went to ${t.launch}, not ${want}`);
        launches++;
        if (capWrite !== null) launchesAfterCap++;
      } else if (t.join) {
        // The spare process is queued on the stone's loop.
        const q = vm.processes(0);
        if (q[q.length - 1] !== movAt) throw new Error(`${api.scenario}: the launcher's spare process did not join the stone`);
        joins++;
      }
    },
    final() {
      if (o.cap && capWrite === null && (api.alone || vm.cycle - (enteredAt ?? vm.cycle) > 20000)) throw new Error(`${api.scenario}: the stone never capped the pump`);
      if (!api.alone) return;
      const procs = vm.processes(0);
      const imps = procs.filter((q) => api.same(vm.peek(q), imp)).length;
      if (o.cap) {
        if (capWrite !== P.CAP) throw new Error(`capped-pump: the pump was bombed by lattice bomb ${capWrite}, not ${P.CAP}`);
        if (launchesAfterCap > 4) throw new Error(`capped-pump: the pump launched ${launchesAfterCap} imps after it was capped`);
        if (vm.peek(feedAt).op !== 'DAT') throw new Error('capped-pump: the pump feeder is not a DAT after the cap');
        if (launches < 2 * impPoints(P, core)) throw new Error(`capped-pump: only ${launches} imps launched before the cap`);
        if (imps < launches / 2) throw new Error(`capped-pump: only ${imps} imps of ${launches} launched survive`);
      } else {
        if (joins < launches - 2 || joins < 50) throw new Error(`knight-pump: only ${joins} spare processes joined the stone (${launches} launches)`);
        if (imps < 3 * impPoints(P, core)) throw new Error(`knight-pump: only ${imps} imp processes; the pump stopped feeding the spiral`);
        const inStone = procs.filter((q) => q === movAt || q === api.at('sAdd') || q === jmpAt).length;
        if (inStone < 50) throw new Error(`knight-pump: only ${inStone} processes run the stone`);
      }
      if (writes < 200) throw new Error(`${api.scenario}: the stone bombed only ${writes} cells`);
    },
  };
}
const runsStoneOrImps = (api) => {
  const imp = api.code('pImp');
  return api.vm.processes(0).some((q) => api.inSelf(q) || api.same(api.vm.peek(q), imp));
};
// Imp arms crawl forward from their starts: none may start on the block or
// within reach behind it.
function armMismatches(id, P, settings, lay) {
  const core = settings.coreSize, D = mod(impStep(P, core) + 1, core);
  for (let i = 1; i < 4 * impPoints(P, core); i++) {
    const d = mod(lay.pImp + i * D, core);
    if (d < lay.size || d > core - settings.maxLength - 400) return [`${id}: an imp arm starts on or just behind the block`];
  }
  return [];
}

// ---------------------------------------------------------------------------
// knight-pump
//
//    0 sMov   MOV  sBomb, @sJmp    the stone: no feeder of its own, the pump
//    1 sAdd   ADD  #STEP, sJmp       sends it one process a pass
//    2 sJmp   JMP  sMov, FIRST
//    3 sBomb  DAT  #0, #1          (bomb class)
//    4 pFeed  SPL  #0              entry: one chain a pass
//    5        MOV  pImp, >pL       carpet one cell further ahead of the spiral
//    6 pHop   JMP  pStep           (hop over the bomb class)
//    7        DAT                  (bomb class)
//    8        ADD.A #STEP+1, pL    the next launch one step and a cell on
//    9 pL     SPL  imp-D, imp+1    launch one imp ...
//   10 pJoin  JMP  sMov            ... and the spare process joins the stone
//   11        DAT                  (bomb class)
//   12 pImp   MOV.I #0, STEP
//
// Black Knight's launcher ends in a DJN.F stream into its stone; this one
// jumps, so no stream laps round onto the block's own cells.
function knightCells(ctx, first) {
  const { L } = ctx, S = impStep(ctx.P, ctx.core), [sMov, sAdd, sJmp, sBomb] = stoneCells(ctx, first);
  return [sMov, sAdd, sJmp, sBomb, pumpCell(ctx, 'pFeed', S), pumpCell(ctx, 'pCarpet', S), ['pHop', 'JMP', 'B', L('pStep'), '0'], PAD,
    pumpCell(ctx, 'pStep', S), pumpCell(ctx, 'pL', S), ['pJoin', 'JMP', 'B', L('sMov'), '0'], PAD, pumpCell(ctx, 'pImp', S)];
}
const LAYOUT_CTX = { L: (x) => x, P: { STEP: 4, POINTS: 3 }, core: 8000 };
const KNIGHT = plan(knightCells(LAYOUT_CTX, 0));
// The stone's first bomb lands just past the block, on the bomb class, plus FIRST laps of G.
const knightFirst = (P) => {
  let f = KNIGHT.size - KNIGHT.sJmp;
  while (mod(KNIGHT.sJmp + f, G) !== R) f++;
  return f + G * P.FIRST;
};
const knightPump = {
  id: 'knight-pump',
  kind: 'body', exit: 'never', grows: true, writes: 'sparse', roams: true, layout: 'last', dialects: '94',
  purpose: 'Stone/imp body whose continuous imp pump is also the stone\'s feeder: each pass launches one imp onto a POINTS-point spiral (0 = 3, or 13 where 3 divides the core) and sends the spare process into a 3-line stone (STEP a multiple of 4; its bombs keep to a residue class the block leaves to padding), so the stone gains a process for every imp.',
  params: { STEP: [4, 54000], POINTS: [0, 31], FIRST: [0, 200] },
  defaults: { STEP: 3044, POINTS: 0, FIRST: 0 },
  entry: 'pFeed', entryFirst: false, processes: 2, loop: 'sMov',
  mutable: [['sJmp', ['b']], ['pL', ['a', 'b']]],
  mismatches(P, settings) {
    const out = pumpMismatches('knight-pump', P, settings);
    return out.length ? out : armMismatches('knight-pump', P, settings, KNIGHT);
  },
  emit(ctx) { emitAll(ctx, knightCells(ctx, knightFirst(ctx.P))); },
  running: runsStoneOrImps,
  watch: (api) => pumpWatch(api, { knight: true }),
};

// ---------------------------------------------------------------------------
// capped-pump
//
//    0 sMov   MOV  sBomb, @sJmp    the stone
//    1 sAdd   ADD  #STEP, sJmp
//    2 sJmp   JMP  sMov, FIRST     FIRST is chosen so bomb CAP lands on pFeed
//    3 sBomb  DAT  #0, #1          (bomb class)
//    4 sFeed  SPL  #0              the stone's own feeder ...
//    5 sHop   JMP  sMov            ... into its loop
//    6 cGo    SPL  sFeed           entry: one process to the stone, one falls
//    7 pFeed  SPL  #0              into the pump (on the bomb class, the only
//    8        MOV  pImp, >pL         live cell there)
//    9        ADD.A #STEP+1, pL
//   10 pL     JMP  imp-D, imp+1    the chain process becomes the imp
//   11        DAT                  (bomb class)
//   12 pImp   MOV.I #0, STEP
//
// Fed one process a pass, the stone's processes run MOV, ADD, MOV, ADD... in
// queue order, so every lattice cell is bombed once in turn, and pFeed is the
// only live cell on the class: bomb CAP hits it exactly. The feeder process
// dies on the DAT, the chains already under way finish, and the spiral keeps
// the imps it has. CAP is less than a lap of the lattice, so no earlier lap
// reaches it.
function cappedCells(ctx, first) {
  const { L } = ctx, S = impStep(ctx.P, ctx.core), [sMov, sAdd, sJmp, sBomb] = stoneCells(ctx, first);
  const launch = pumpCell(ctx, 'pL', S);
  launch[1] = 'JMP';
  return [sMov, sAdd, sJmp, sBomb, ['sFeed', 'SPL', 'B', '#0', '0'], ['sHop', 'JMP', 'B', L('sMov'), '0'], ['cGo', 'SPL', 'B', L('sFeed'), '0'],
    pumpCell(ctx, 'pFeed', S), pumpCell(ctx, 'pCarpet', S), pumpCell(ctx, 'pStep', S), launch, PAD, pumpCell(ctx, 'pImp', S)];
}
const CAPPED = plan(cappedCells(LAYOUT_CTX, 0), ['pFeed']);
const cappedFirst = (P, core) => mod(CAPPED.pFeed - CAPPED.sJmp - P.CAP * P.STEP, core);
const cappedPump = {
  id: 'capped-pump',
  kind: 'body', exit: 'never', grows: true, writes: 'sparse', roams: true, layout: 'last', dialects: '94',
  purpose: 'Stone/imp body whose continuous imp pump sits where the stone\'s CAP-th bomb lands: a 3-line stone on its own SPL #0 feeder (STEP a multiple of 4; its bombs keep to a residue class the block leaves to padding and the pump\'s feeder) lets the pump feed a POINTS-point spiral one imp a pass, then switches it off at a planned pass.',
  params: { STEP: [4, 54000], POINTS: [0, 31], CAP: [10, 1900] },
  defaults: { STEP: 3044, POINTS: 0, CAP: 300 },
  entry: 'cGo', entryFirst: false, processes: 3, loop: 'sMov',
  mutable: [['sJmp', ['b']], ['pL', ['a', 'b']]],
  mismatches(P, settings) {
    const out = pumpMismatches('capped-pump', P, settings);
    if (out.length) return out;
    const core = settings.coreSize, lap = core / gcd(P.STEP, core);
    if (P.CAP >= lap) out.push(`capped-pump: CAP ${P.CAP} is past the first lap of the bomb lattice (${lap} bombs)`);
    // The bombs before the cap land outside the block.
    const first = cappedFirst(P, core);
    for (let m = 0; m < P.CAP; m++) {
      if (mod(CAPPED.sJmp + first + m * P.STEP, core) < CAPPED.size) { out.push(`capped-pump: bomb ${m} lands on the block before the cap`); break; }
    }
    out.push(...armMismatches('capped-pump', P, settings, CAPPED));
    return out;
  },
  emit(ctx) { emitAll(ctx, cappedCells(ctx, cappedFirst(ctx.P, ctx.core))); },
  running: runsStoneOrImps,
  watch: (api) => pumpWatch(api, { cap: true }),
};

// ---------------------------------------------------------------------------
// moving-imp-silk (gap #8, the last open silk tail)
//
//   miFan  SPL 2 / SPL 1 / SPL 1   6 processes, one per cell copied
//   mi0    SPL STEP1, #0           forward stage: split into the copy STEP1 on ...
//          MOV.I >mi0, }mi0        ... and copy one cell each (B source, A dest)
//          MOV.I <mi0, {mi1        backward stage: the same 6 cells again, last
//   mi1    SPL STEP2, #0             first (mi0's B is past the body now), split into it
//   miImp  MOV.I #HOP-LEAD, }LEAD  the moving imp
//   miEnd  DAT 0, 0                (what a copy carries past the imp: an empty cell)
//
// The moving imp is the paper's last stage. A process that runs it writes the
// line LEAD cells on plus the A field it finds there, and the `}` steps that A
// field by one. The first write onto an empty cell overwrites the pointer cell
// itself, so the new copy's A field is HOP - LEAD; every later write through it
// lands HOP on, HOP + 1, HOP + 2, ...: one cell further each time, so the
// copies fan out into runs. HOP is half the core plus HALF (-1 by default), so
// two hops come back HALF*2 cells from where they began: the runs written half
// a core apart keep landing next to each other and grow into long strips of
// the line. A process that has run it steps to the next cell, so wherever two
// copies have landed side by side it runs the next one, and the next: the
// processes crawl along the strips like imps, laying more as they go. By the
// end of a solo round on 8,000 most of the process table crawls on them, with
// dozens of A values (the fan-out). On 55,440 the strips take far longer to
// meet (about 10^5 cycles), so there the watch checks the stages, the writes
// and the fan-out, not the crawl.
//
// Hill warrior with the idea: Mercenary #69 (its "silk-imps" tail). Its silk
// stages are the For John order; these are silk3's (papers.js) with tail-silk's
// backward stage.
const MI_FAN = ['2', '1', '1'];
const MI_N = 6, MI_LEN = 6;                       // processes; cells from mi0 on (each stage copies 6)
const movingImpSilk = {
  id: 'moving-imp-silk',
  kind: 'body', exit: 'never', grows: true, writes: 'sparse', roams: true, layout: 'last', dialects: '94',
  purpose: 'Silk whose last stage is a moving imp: 6 processes, a forward and a backward stage, then MOV.I #HOP-LEAD, }LEAD (HOP = core/2 + HALF), which lands LEAD on plus the A field it finds and steps that A field, so its copies fan out into strips half a core apart that the leftover processes crawl along like imps.',
  params: { STEP1: [64, 54000], STEP2: [64, 54000], HALF: [-64, 64], LEAD: [16, 54000] },
  defaults: { STEP1: 3039, STEP2: 1607, HALF: -1, LEAD: 1234 },
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (settings.dialect === '88') return ["moving-imp-silk: the silk and the moving imp need ICWS'94"];
    if (settings.maxProcesses < 32 * MI_N) out.push(`moving-imp-silk needs room to grow (${32 * MI_N} processes)`);
    // Offsets from mi0: the body is cells -3 (the fan) .. 5.
    const hit = (at, n) => overlaps(at, n, -3, MI_LEN + 3, core);
    if (hit(P.STEP1, MI_LEN)) out.push(`moving-imp-silk: the forward stage copies onto the paper on a ${core}-cell core`);
    if (hit(3 + P.STEP2 - MI_N, MI_LEN)) out.push(`moving-imp-silk: the backward stage copies onto the paper on a ${core}-cell core`);
    if (hit(4 + P.LEAD, 1) || hit(4 + core / 2 + P.HALF, 1)) out.push('moving-imp-silk: the moving imp lands on the paper');
    if (P.HALF === 0) out.push('moving-imp-silk: HALF 0 sends every second write back onto the same cell');
    return out;
  },
  entry: 'miFan', processes: MI_N,
  mutable: [['mi0', ['a', 'b']], ['mi1', ['a', 'b']], ['miImp', ['a']]],
  emit(ctx) {
    const { L, P, core } = ctx;
    MI_FAN.forEach((a, i) => ctx.ins(i ? '' : 'miFan', 'SPL', 'B', a, '0'));
    ctx.ins('mi0', 'SPL', 'B', `${mod(P.STEP1, core)}`, '#0');
    ctx.ins('', 'MOV', 'I', `>${L('mi0')}`, `}${L('mi0')}`);
    ctx.ins('', 'MOV', 'I', `<${L('mi0')}`, `{${L('mi1')}`);
    ctx.ins('mi1', 'SPL', 'B', `${mod(P.STEP2, core)}`, '#0');
    ctx.ins('miImp', 'MOV', 'I', `#${mod(core / 2 + P.HALF - P.LEAD, core)}`, `}${mod(P.LEAD, core)}`);
    ctx.ins('miEnd', 'DAT', 'F', '$0', '$0');
  },
  running(api) {
    const fwd = api.code('mi0', 1), isT = movingImp(api);
    return api.vm.processes(0).some((q) => { const x = api.vm.peek(q); return isT(x) || api.same(x, fwd) || (x.op === 'SPL' && api.same(api.vm.peek(q + 1), fwd)); });
  },
  watch(api) {
    const { vm, P } = api, isT = movingImp(api), N = MI_N, LEN = MI_LEN;
    const mi0 = api.at('mi0'), mi1 = api.at('mi1'), fwdMov = api.add(mi0, 1), backMov = api.add(mi0, 2), impAt = api.at('miImp');
    const runs = { fwd: 0, back: 0 };
    // A copy holds the body: an SPL first, then the cells as compiled (the
    // backward copy's mi1 has its A field part-way counted down).
    const whole = (start, what) => {
      for (let k = 0; k < LEN; k++) {
        const x = vm.peek(api.add(start, k)), want = api.code('mi0', k);
        if (k === 0 || k === 3 ? x.op !== 'SPL' : !api.same(x, want)) throw new Error(`moving-imp-silk: ${what} made an incomplete copy (cell ${k})`);
      }
    };
    let drops = 0, bumps = 0;
    return {
      before(pc) {
        if (pc === fwdMov) return { kind: 'fwd' };
        if (pc === backMov) return { kind: 'back' };
        if (pc === impAt && api.same(vm.peek(pc), api.code('miImp'))) {
          const c = api.add(impAt, P.LEAD), a = vm.peek(c).a;
          return { kind: 'drop', c, t: api.add(c, a), a };
        }
        return null;
      },
      after(x) {
        if (!x) return;
        if (x.kind === 'fwd' && ++runs.fwd === N) whole(api.add(mi0, P.STEP1), 'the forward stage');
        else if (x.kind === 'back' && ++runs.back === N) whole(api.add(mi1, P.STEP2 - N), 'the backward stage');
        else if (x.kind === 'drop') {
          // The line lands LEAD on plus the A field found there, and that A field moves on by one.
          if (!isT(vm.peek(x.t))) throw new Error('moving-imp-silk: the moving imp did not copy itself');
          if (x.t !== x.c) {
            if (api.norm(vm.peek(x.c).a) !== api.norm(x.a + 1)) throw new Error('moving-imp-silk: the moving imp did not step the A field it read');
            bumps++;
          }
          drops++;
        }
      },
      final() {
        if (!api.alone) return;
        if (runs.fwd < N || runs.back < N) throw new Error(`moving-imp-silk: a stage never ran with every process (${runs.fwd}, ${runs.back})`);
        if (drops < N) throw new Error(`moving-imp-silk: only ${drops} processes ran the moving imp`);
        // By the end the moving imp is the warrior: most processes crawl along
        // runs of it, and the A fields its writes stepped have fanned out.
        const fans = new Set();
        for (let c = 0; c < api.core; c++) if (isT(vm.peek(c))) fans.add(api.norm(vm.peek(c).a));
        if (fans.size < 4) throw new Error(`moving-imp-silk: the moving imp's writes did not fan out (${fans.size} A values)`);
        if (!bumps) throw new Error("moving-imp-silk: no write went through a stepped A field");
        if (api.core > 8000) return;
        const procs = vm.processes(0), on = procs.filter((q) => isT(vm.peek(q)));
        const crawl = on.filter((q) => isT(vm.peek(q + 1))).length;
        if (on.length < procs.length / 3 || on.length < 200) throw new Error(`moving-imp-silk: only ${on.length} of ${procs.length} processes run the moving imp`);
        if (crawl < on.length / 2) throw new Error(`moving-imp-silk: the moving imps do not crawl (${crawl} of ${on.length} have one ahead)`);
      },
    };
  },
};
// A copy of the moving imp: MOV.I #x, }LEAD, whatever x its A field has reached.
const movingImp = (api) => {
  const t = api.code('miImp');
  return (x) => x.op === 'MOV' && x.mod === t.mod && x.aMode === '#' && x.bMode === '}' && api.norm(x.b) === api.norm(t.b);
};

export default [knightPump, cappedPump, movingImpSilk];
