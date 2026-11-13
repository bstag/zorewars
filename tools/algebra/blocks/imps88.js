// ICWS'88 imp delivery (docs/block-algebra.md, docs/hill-top30/88.md):
//
//   imp-pump-88         a continuous imp pump run by one process: every pass
//                       of the queue it launches one more imp onto an N-point
//                       ring, and it lays its own seed cells;
//   stone-pump-boot-88  the hill's modal '88 delivery as one body: a parallel
//                       boot copies a pair-bombing stone and that pump away,
//                       sends all processes but one to the stone and the last
//                       to the pump, and leaves the original as a decoy.
//
// The mechanisms are the ones the Koenigstuhl '88 hill uses; every line of
// Redcode, the layouts and the constants here are written from scratch.
import { modInverse } from '../util.js';

const mod = (x, n) => ((x % n) + n) % n;
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };

// ---------------------------------------------------------------------------
// The pump. One process sits on SPL 0; every pass of the queue it sends one
// child down three lines:
//
//   pHead  SPL 0
//   pSeed  MOV pImp, <pPtr        lay one imp instruction, walking downward
//   pAdd   ADD #S+1, pJmp         move the launch vector one ring point on
//   pJmp   JMP @0, vector         launch: the child becomes an imp
//   pImp   MOV 0, S               the template
//   pPtr   DAT #0, #N+1           the seed pointer
//
// S = modInverse(N, core), so N steps of S land one cell on. Launch k lands
// on q0 + k(S+1): the imp before it (one pass older, so one cell further on
// its own arm) writes exactly that cell just before the new imp runs it. Only
// the very first imp has nobody ahead of it: it needs the N cells q0 .. q0+N-1
// to hold an imp already. The seed line lays them, top down, one a pass, so
// the first live launch must wait until pass N: the launches before it (N-3 of
// them when N > 3) are aimed at empty core and die. After the seeds the seed
// pointer reaches its own cell and is overwritten with the template; its
// B-field is then S, so the line goes on laying spare imp instructions a ring
// step away, behind the second arm, where they do nothing.
const pumpCells = ['pHead', 'pSeed', 'pAdd', 'pJmp', 'pImp', 'pPtr'];
const PUMP_LEN = pumpCells.length;
const pumpDummies = (N) => Math.max(0, N - 3);

// The pump's own geometry rules, with every address taken from q0 (the cell
// after the pump): `room` cells below q0 hold the warrior.
function pumpMismatches(id, N, core, room) {
  const S = modInverse(N, core), out = [];
  if (!S) return [`${id}: no ${N}-point imp ring on a ${core}-cell core`];
  if (S < 2 * room + N + 8 || core - S < 2 * room + N + 8) out.push(`${id}: the ${N}-point step ${S} keeps the ring and the spare seeds too close to the warrior`);
  for (let j = 1; j <= pumpDummies(N); j++) {
    const d = mod(-j * (S + 1), core);
    if (d < N + 2 || d > core - room - 2) { out.push(`${id}: a launch made before the seeds are down lands on the warrior`); break; }
  }
  for (let k = 1; k <= 2 * N; k++) {
    const d = mod(k * (S + 1), core);
    if (d > core - room - 2 || d < N) { out.push(`${id}: ring point ${k} lands on the warrior`); break; }
  }
  return out;
}

function emitPump(ctx, N, headB = '0') {
  const { L, core } = ctx, S = modInverse(N, core);
  ctx.ins('pHead', 'SPL', 'B', '0', headB);              // its B-field is free: a boot keeps its copy count there
  ctx.ins('pSeed', 'MOV', 'I', L('pImp'), `<${L('pPtr')}`);
  ctx.ins('pAdd', 'ADD', 'AB', `#${S + 1}`, L('pJmp'));
  // q0 is the cell after pPtr, three cells past pJmp. One ADD runs before every JMP.
  ctx.ins('pJmp', 'JMP', 'B', '@0', `${mod(3 - (pumpDummies(N) + 1) * (S + 1), core)}`);
  ctx.ins('pImp', 'MOV', 'I', '0', `${S}`);
  ctx.ins('pPtr', 'DAT', 'F', '#0', `#${N + 1}`);
}

// Watches one running pump whose cells start at `head` (the original, or a
// booted copy). Returns the hooks plus what it saw.
function pumpWatch(api, head, N, id) {
  const { vm, core } = api, S = modInverse(N, core);
  const cell = Object.fromEntries(pumpCells.map((l, i) => [l, api.norm(head + i)]));
  const q0 = api.norm(head + PUMP_LEN), dummies = pumpDummies(N);
  const imp = api.code('pImp');
  const isImp = (c) => api.same(vm.peek(c), imp);
  const sameBut = (l, skip) => api.same({ ...vm.peek(cell[l]), [skip]: 0 }, { ...api.code(l), [skip]: 0 });
  const codeOk = () => ['pSeed', 'pAdd'].every((l) => api.same(vm.peek(cell[l]), api.code(l))) && sameBut('pHead', 'b') && sameBut('pJmp', 'b');
  const state = { launches: 0, seeds: 0, broken: false };
  const inPump = (c) => api.norm(c - head) < 4;
  return {
    state, q0, isImp, inPump,
    before(pc) {
      if (state.broken || (pc !== cell.pJmp && pc !== cell.pSeed)) return null;
      if (!codeOk()) { state.broken = true; return null; }
      if (pc === cell.pSeed) return { seed: api.norm(cell.pPtr + vm.peek(cell.pPtr).b - 1) };
      return { launch: api.norm(cell.pJmp + vm.peek(cell.pJmp).b) };
    },
    after(t) {
      if (!t) return;
      if (t.seed !== undefined) {
        // The first N seeds are q0+N-1 down to q0; then the pointer cell itself.
        const k = state.seeds++;
        if (k <= N && t.seed !== api.norm(q0 + N - 1 - k)) throw new Error(`${id}: seed ${k} went to the wrong cell`);
        if (inPump(t.seed)) throw new Error(`${id}: the seed line wrote into the pump`);
        return;
      }
      const k = state.launches++;
      if (t.launch !== api.norm(q0 + (k - dummies) * (S + 1))) throw new Error(`${id}: launch ${k} left the ring (it should land ${S + 1} past the one before)`);
    },
    // Alone: nothing but our own processes ran, so every live launch must still be an imp.
    // `exact` when nothing else of ours bombs: beside a stone the oldest imp is sometimes hit.
    final(procs, exact = true) {
      const live = state.launches - dummies;
      if (live < 2 * N) throw new Error(`${id}: only ${Math.max(0, live)} imps were launched`);
      // Beside a stone an imp may wait on a cell whose B-field the stone has just decremented:
      // the imp before it rewrites the cell before it runs.
      const loose = (c) => { const x = vm.peek(c); return x.op === 'MOV' && x.aMode === '$' && x.bMode === '$' && api.norm(x.a) === 0; };
      const counts = exact ? isImp : loose;
      const onImp = procs.filter(counts), waiting = procs.filter((q) => !inPump(q) && !counts(q));
      // The newest N imps lead their arms: each waits on a cell the imp before it writes just before it runs.
      if (waiting.length > N + (exact ? 0 : 2)) throw new Error(`${id}: ${waiting.length} launched processes are not on an imp`);
      if (!exact && onImp.length < Math.max(2 * N, live / 2)) throw new Error(`${id}: only ${onImp.length} of ${live} imps are alive`);
      if (exact && onImp.length + waiting.length !== live) throw new Error(`${id}: ${live} imps were launched but ${onImp.length + waiting.length} are alive`);
      let breaks = 0;
      for (let i = 1; i < onImp.length; i++) if (api.norm(onImp[i] - onImp[i - 1]) !== S) breaks++;
      if (breaks > (exact ? 1 : 3)) throw new Error(`${id}: the imps do not stand a ring step apart`);
      if (procs.length < api.settings.maxProcesses && !procs.some(inPump)) throw new Error(`${id}: the pump stopped`);
    },
  };
}

const impPump = {
  id: 'imp-pump-88', kind: 'body', exit: 'never', processes: 1, grows: true,
  writes: 'sparse', roams: true, layout: 'last', entry: 'pHead',
  purpose: "ICWS'88 continuous imp pump on one process: SPL 0 over a seed line, an ADD and a JMP @0. Every pass of the queue it launches one more imp onto an N-point ring (step modInverse(N, core)), each a ring step and a cell past the last; it lays its own N seed cells, so it is six instructions whatever N is.",
  params: { N: [3, 23] },
  defaults: { N: 3 },
  mutable: [['pJmp', ['b']], ['pPtr', ['a', 'b']]],
  knowledge: {
    parameterRoles: { N: 'Points of the ring. The step is modInverse(N, core): 3 gives 2667 and 7 gives 1143 on the 8,000 core; neither exists on the 55,440 core, where 13 is the smallest.' },
    tuning: ['The pump adds one process a pass, so with nothing else running pass r comes after about r*r/2 cycles: about 400 passes in an 80,000-cycle round. The arms move one cell a pass.', 'With N above 3 the first N-3 launches are spent on empty core while the seeds go down.'],
    failures: ['Until 2N imps are out, every imp depends on the one before it: one hit ends the ring and every later launch. After that only the oldest imp is exposed, because each imp rewrites the next one\'s cell just before it runs.', 'A process limit below about 2N+4 stops the pump before the ring is closed.'],
    evidence: ['docs/hill-top30/88.md'],
  },
  mismatches(P, settings) {
    const out = pumpMismatches('imp-pump-88', P.N, settings.coreSize, settings.maxLength);
    if (settings.maxProcesses < 2 * P.N + 4 + pumpDummies(P.N)) out.push(`imp-pump-88: ${settings.maxProcesses} processes are too few to close a ${P.N}-point ring`);
    return out;
  },
  emit(ctx) { emitPump(ctx, ctx.P.N); },
  running: (api) => api.vm.processes(0).some((q) => api.inSelf(q) || api.same(api.vm.peek(q), api.code('pImp'))),
  watch(api) {
    const w = pumpWatch(api, api.at('pHead'), api.P.N, 'imp-pump-88');
    return {
      before: w.before,
      after: w.after,
      final() {
        if (api.alone) w.final(api.vm.processes(0));
        else if (!w.state.broken && api.entered() && w.state.launches < 1) throw new Error('imp-pump-88: nothing was launched');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// stone-pump-boot-88
//
//   bGo    SPL 1, dst      a fan that makes PROCS processes in lockstep (SPL 1
//          MOV -1, 0       doubles; MOV -1, 0 after it turns n into 2n-1). The
//          ...             first line's free B-field is the stone's copy pointer
//   bCpS   MOV <sHead, <bGo    each process copies one stone cell
//   bCpP   MOV <pHead, <bJmp   and one pump cell
//   bDjn   DJN @bGo, #PROCS    all but the last jump to the stone copy
//   bJmp   JMP @0, dst         the last one enters the pump copy
//   sHead  SPL 0, count    the stone: its head's B-field counts the copy down
//   sHit   MOV sBomb, <FIRST   bomb through the pointer cell's own B-field
//   sTwo   MOV sBomb, @sHit    bomb the pointer cell
//   sAdd   ADD #STEP, sHit
//   sDjn   DJN sHit, <STREAM   a decrement stream; a process it drops dies on
//   sBomb  DAT #0, #2          the bomb
//   pHead  ... the pump above, six cells
//
// The stone: in step, every ADD is followed by one sTwo (a bomb on the new
// pointer cell c, B = 2) and one sHit (c's B-field becomes 1, a bomb on c+1),
// so it bombs pairs (c, c+1), c moving by STEP. On an empty cell that sHit
// reaches first the bomb goes to c-1. gcd(STEP, core) must be at least 10: the
// stone's six cells sit on residues 0-5 of that grain, the bombs on 6-9, and
// the pump copy is placed on residues clear of them too, so the stone never
// bombs itself or its pump however long it runs. FIRST and IHOP are moved down
// to the nearest value that fits (see bootGeom).
//
// The DJN stream starts STREAM cells above the stone and walks down to it;
// when it reaches the DJN itself it moves its own pointer and starts again, so
// it only ever works the STREAM cells above the stone. The pump copy and the
// first cells of every imp arm must lie outside that stretch.
// The stone copy is its bomb and then five cells of code; addresses below are from the head (the SPL).
const STONE_LEN = 5, ARM_RUN = 450, RHO = 8;
const stoneCells = ['sHead', 'sHit', 'sTwo', 'sAdd', 'sDjn'];

// How to make n processes from one: 'D' is SPL 1, 'M' is MOV -1, 0.
function fanOps(n) {
  const ops = [];
  while (n > 1) { if (n % 2) { ops.unshift('M'); n = (n + 1) / 2; } else { ops.unshift('D'); n /= 2; } }
  return ops;
}

function bootGeom(P, core) {
  const fan = fanOps(P.PROCS);
  const linesS = Math.ceil(STONE_LEN / P.PROCS), linesP = Math.ceil(PUMP_LEN / P.PROCS);
  const cS = linesS * P.PROCS, cP = linesP * P.PROCS;      // cells each copy line set moves
  const bootLen = 1 + fan.length + linesS + linesP + 2;
  const g = gcd(P.STEP, core);
  // TIME 0: pointer cells on residue RHO from the stone's bomb cell, the pump copy on a residue the bombs miss.
  // TIME > 0: any step; the pointer is set so that pass TIME lands on the stone's own ADD line.
  const first = P.TIME ? mod(2 - P.TIME * P.STEP, core) : P.FIRST - mod(P.FIRST + 2 - RHO, g);
  const want = mod(RHO + 2, g);
  const ihop = P.TIME ? P.IHOP : P.IHOP - mod(P.IHOP - P.HOP - PUMP_LEN - want, g);   // in the image the pump ends just before the bomb
  const pumpRel = mod(ihop - P.HOP - PUMP_LEN - 1, core);  // pump copy head - stone copy head
  return { fan, linesS, linesP, cS, cP, bootLen, g, first, ihop, pumpRel, S: modInverse(P.N, core) };
}

const stonePumpBoot = {
  id: 'stone-pump-boot-88', kind: 'body', exit: 'never', processes: 1, grows: true,
  writes: 'sparse', roams: true, moves: true, entry: 'bBm',
  purpose: "ICWS'88 stone/imp delivery: a fan makes PROCS processes that copy a five-cell pair-bombing stone (SPL 0 head, two MOVs through one pointer, ADD #STEP, a DJN stream) HOP cells away and the six-cell imp pump IHOP away, send PROCS-1 into the stone and one into the pump, and leave the original as a decoy.",
  params: { PROCS: [2, 9], N: [3, 23], STEP: [10, 27000], FIRST: [20, 54000], STREAM: [8, 20000], HOP: [200, 54000], IHOP: [200, 54000], TIME: [0, 8000] },
  defaults: { PROCS: 6, N: 3, STEP: 2370, FIRST: 3207, STREAM: 1500, HOP: 3000, IHOP: 2494, TIME: 0 },
  mutable: [['bGo', ['b']], ['bJmp', ['b']], ['bDjn', ['b']], ['sHead', ['b']], ['pHead', ['b']]],
  knowledge: {
    parameterRoles: {
      PROCS: 'Processes the fan makes: PROCS-1 enter the stone together, one the pump. 6 or more copies each body with one line.',
      N: 'Points of the imp ring (3 or 7 on the 8,000 core).',
      STEP: 'Stone step. With TIME 0, gcd(STEP, core) is the grain: at least 10, and the stone covers 1/5 of the core at 10. With TIME set, any step.',
      TIME: '0: a layout-safe stone that runs for ever. Otherwise the stone runs TIME passes with any step (two bombs a pass, so TIME 2000 with an odd step is half the core) and then bombs its own ADD line and stops, leaving the pump; the contract refuses a step whose earlier passes would touch the stone or the pump. FIRST is not used.',
      FIRST: 'First pointer cell, from the stone; moved down to the grain residue that keeps the bombs off the stone.',
      STREAM: 'How far above the stone the DJN stream starts; it only ever works that stretch.',
      HOP: 'Stone copy, from the original stone.', IHOP: 'Pump copy, from the original pump; moved down to a residue the bombs miss.',
    },
    tuning: ['The stone gains PROCS-1 processes a pass and the pump one, so a pass comes after about PROCS*r*r/2 cycles: about 160 passes in an 80,000-cycle round with six processes. Imp arms move a cell a pass.'],
    failures: ['The stone bombs the abandoned image and anything beside it there, so it is not a partner for another body in a par.', 'The two copy pointers stay in the decoy.'],
    evidence: ['docs/hill-top30/88.md'],
  },
  mismatches(P, settings) {
    const id = 'stone-pump-boot-88', core = settings.coreSize, out = [];
    const G = bootGeom(P, core), { g, S, cS, cP, pumpRel } = G;
    if (!S) return [`${id}: no ${P.N}-point imp ring on a ${core}-cell core`];
    if (!P.TIME && g < 10) return [`${id}: STEP ${P.STEP} shares only ${g} with the core; without TIME the stone needs a grain of at least 10 to miss itself and its pump`];
    if (settings.maxProcesses < P.PROCS + 2 * P.N + 8 + pumpDummies(P.N)) out.push(`${id}: ${settings.maxProcesses} processes are too few for the stone and a closed ring`);
    if (G.ihop < 200 || G.first < 20) out.push(`${id}: FIRST or IHOP is too small once moved to its residue`);
    out.push(...pumpMismatches(id, P.N, core, PUMP_LEN + 2));
    const q0 = pumpRel + PUMP_LEN;                           // every address from the stone copy's head
    const within = (x, lo, hi) => mod(x - lo, core) <= hi - lo;
    if (within(pumpRel, -cP - 3, cS + 2)) out.push(`${id}: the stone and pump copies overlap`);
    // The stream works (sDjn, sDjn + STREAM]: the pump and its seeds must be outside.
    if (P.STREAM >= core - 16 || within(pumpRel + PUMP_LEN + P.N + 1, 5, 4 + P.STREAM + PUMP_LEN + P.N + 2)) out.push(`${id}: the DJN stream runs over the pump copy`);
    for (let j = 0; j < P.N; j++) {
      const arm = q0 + j * S;
      if (within(arm, -ARM_RUN - 3, STONE_LEN + 1)) out.push(`${id}: imp arm ${j} starts less than ${ARM_RUN} cells below the stone copy and would run over it`);
      if (within(arm, 5 - 12, 4 + P.STREAM)) out.push(`${id}: imp arm ${j} starts inside the DJN stream's stretch`);
    }
    // Until N+1 imps are out the ring hangs on its first imp: the first bombs must miss its path.
    for (let k = 0; k < 120; k++) if (within(1 + G.first + k * P.STEP + 1, q0 - 1, q0 + P.N + 6 + 3)) { out.push(`${id}: bomb ${k} lands on the first imp's path`); break; }
    // A pointer cell that is one of our own imp instructions sends the second bomb a ring step on:
    // that must not be the stone or the pump.
    const onArm = (x) => Array.from({ length: P.N }, (_, j) => q0 + j * S).some((arm) => within(x, arm, arm + ARM_RUN));
    for (const [lo, n, what] of P.TIME ? [] : [[-1, STONE_LEN + 1, 'the stone'], [pumpRel, PUMP_LEN, 'the pump']]) {
      for (let y = lo; y < lo + n; y++) for (let d = 1; d <= 3; d++) {
        const x = y - S + d;
        if (mod(x + 1 - RHO, g) === 0 && onArm(x)) out.push(`${id}: a bomb aimed through one of its own imps would land on ${what}`);
      }
    }
    for (let j = 1; j <= pumpDummies(P.N); j++) if (within(q0 - j * (S + 1), -3, STONE_LEN + 1)) out.push(`${id}: a launch made before the seeds are down lands on the stone copy`);
    if (P.TIME) {
      // Pass k bombs its pointer cell and the cell above (or, on a fresh cell, the one below):
      // before pass TIME none of that may touch the stone or the pump, directly or through an imp.
      const hits = (x) => within(x, -1, STONE_LEN) || within(x, pumpRel, pumpRel + PUMP_LEN - 1);
      for (let k = 0; k < P.TIME; k++) {
        const c = mod(1 + G.first + k * P.STEP, core);
        if ([-2, -1, 0, 1].some((d) => hits(c + d)) || (onArm(c) && [1, 2, 3].some((d) => hits(c + S - d)))) { out.push(`${id}: pass ${k} of ${P.TIME} already bombs the stone or the pump with STEP ${P.STEP}`); break; }
      }
    }
    return [...new Set(out)];
  },
  linked(P, settings, at, { total, shiftedFrame }) {
    if (shiftedFrame) return [];
    const id = 'stone-pump-boot-88', core = settings.coreSize, G = bootGeom(P, core), out = [];
    if (!G.S || (!P.TIME && G.g < 10)) return [];
    const inImage = (x) => mod(x, core) < total;
    const s0 = at('sHead') + P.HOP, p0 = at('pHead') + G.ihop;
    for (let i = -2; i <= G.cS; i++) if (inImage(s0 + i)) { out.push(`${id}: the stone copy lands on the original image`); break; }
    for (let i = -1; i <= G.cP + P.N; i++) if (inImage(p0 + i)) { out.push(`${id}: the pump copy lands on the original image`); break; }
    for (let j = 1; j <= pumpDummies(P.N); j++) if (inImage(p0 + PUMP_LEN - j * (G.S + 1))) { out.push(`${id}: a launch made before the seeds are down lands on the original image`); break; }
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, G = bootGeom(P, core);
    ctx.ins('bBm', 'MOV', 'I', L('sBomb'), `${L('sBomb')}+${P.HOP}`);     // the bomb goes first, below the stone copy
    G.fan.forEach((op, i) => {
      const label = i === 0 ? 'bGo' : '';
      // The first SPL's B-field is the stone's copy pointer: it ends on the copy's head.
      if (op === 'D') ctx.ins(label, 'SPL', 'B', '1', i === 0 ? `${L('sHead')}+${P.HOP + G.cS}` : '0');
      else ctx.ins(label, 'MOV', 'I', '-1', '0');
    });
    for (let i = 0; i < G.linesS; i++) ctx.ins(i ? '' : 'bCpS', 'MOV', 'I', `<${L('sHead')}`, `<${L('bGo')}`);
    for (let i = 0; i < G.linesP; i++) ctx.ins(i ? '' : 'bCpP', 'MOV', 'I', `<${L('pHead')}`, `<${L('bJmp')}`);
    ctx.ins('bDjn', 'DJN', 'B', `@${L('bGo')}`, `#${P.PROCS}`);
    ctx.ins('bJmp', 'JMP', 'B', '@0', `${L('pHead')}+${G.ihop + G.cP}`);
    emitPump(ctx, P.N, `${G.cP}`);
    ctx.ins('sBomb', 'DAT', 'F', '#0', '#2');
    ctx.ins('sHead', 'SPL', 'B', '0', `${G.cS}`);
    ctx.ins('sHit', 'MOV', 'I', L('sBomb'), `<${G.first}`);
    ctx.ins('sTwo', 'MOV', 'I', L('sBomb'), `@${L('sHit')}`);
    ctx.ins('sAdd', 'ADD', 'AB', `#${P.STEP}`, L('sHit'));
    ctx.ins('sDjn', 'DJN', 'B', L('sHit'), `<${P.STREAM}`);       // a process it drops dies on the empty cell after it
  },
  running(api) {
    const G = bootGeom(api.P, api.core), s0 = api.norm(api.at('sHead') + api.P.HOP), p0 = api.norm(api.at('pHead') + G.ihop);
    return api.vm.processes(0).some((q) => api.norm(q - s0) < STONE_LEN || api.norm(q - p0) < 4 || api.same(api.vm.peek(q), api.code('pImp')));
  },
  watch(api) {
    const id = 'stone-pump-boot-88', { vm, P, core } = api, G = bootGeom(P, core);
    const s0 = api.norm(api.at('sHead') + P.HOP), p0 = api.norm(api.at('pHead') + G.ihop);
    const pump = pumpWatch(api, p0, P.N, id);
    const inStone = (c) => api.norm(c - s0 + 1) <= STONE_LEN, inPumpCopy = (c) => api.norm(c - p0) < PUMP_LEN;
    const bDjn = api.at('bDjn'), bJmp = api.at('bJmp'), sHit = api.norm(s0 + 1), sTwo = api.norm(s0 + 2);
    const copyOk = (base, labels) => labels.every((l, i) => {
      const x = vm.peek(base + i), y = api.code(l);
      return ['op', 'aMode', 'bMode'].every((f) => x[f] === y[f]) && api.norm(x.a) === api.norm(y.a) && (i === 0 ? api.norm(x.b) === 0 : api.norm(x.b) === api.norm(y.b));
    });
    const stoneOk = () => api.same(vm.peek(s0 - 1), api.code('sBomb')) && stoneCells.every((l, i) => {
      const x = vm.peek(s0 + i), y = api.code(l);
      return ['op', 'aMode', 'bMode'].every((f) => x[f] === y[f]) && api.norm(x.a) === api.norm(y.a);
    });
    let toStone = 0, toPump = 0, bombs = 0, damaged = false, ended = false;
    const cells = new Set();
    return {
      before(pc) {
        if (pc === bDjn && !toPump) return { route: 1 };
        if (pc === bJmp && !toPump) {
          if (!copyOk(s0, stoneCells) || !api.same(vm.peek(s0 - 1), api.code('sBomb'))) throw new Error(`${id}: the stone copy is not the stone`);
          if (!copyOk(p0, pumpCells)) throw new Error(`${id}: the pump copy is not the pump`);
          return { route: 2 };
        }
        if ((pc === sHit || pc === sTwo) && !damaged) {
          if (!stoneOk()) { damaged = true; return null; }
          const c = api.norm(sHit + vm.peek(sHit).b);
          return { bomb: pc === sTwo ? c : api.norm(c + vm.peek(c).b - 1), c };
        }
        return pump.before(pc);
      },
      after(t) {
        if (!t) return;
        if (t.route) {
          const now = vm.processes(0);
          if (t.route === 2) { toPump++; if (!now.includes(p0)) throw new Error(`${id}: the last process did not enter the pump copy`); } else if (now[now.length - 1] === s0) toStone++;
          return;
        }
        if (t.bomb !== undefined) {
          if (inPumpCopy(t.bomb)) throw new Error(`${id}: the stone bombed its pump`);
          if (inStone(t.bomb)) {
            // With TIME the stone ends on its own ADD line; any other self-hit is a fault.
            if (!P.TIME || t.c !== api.norm(s0 + 3)) throw new Error(`${id}: the stone bombed itself`);
            ended = true; damaged = true;
            return;
          }
          if (vm.peek(t.bomb).op !== 'DAT') throw new Error(`${id}: the stone dropped something other than its DAT`);
          // By its first bomb the boot is over: nothing runs in the original any more (much later an imp arm may cross it).
          if (!bombs && vm.processes(0).some((q) => api.inSelf(q))) throw new Error(`${id}: a process is still running the original`);
          bombs++; cells.add(t.bomb);
          return;
        }
        pump.after(t);
      },
      final() {
        if (!api.entered()) return;
        if (toPump && toStone !== P.PROCS - 1) throw new Error(`${id}: ${toStone} processes entered the stone, not ${P.PROCS - 1}`);
        if (!api.alone) return;
        if (toPump !== 1) throw new Error(`${id}: the boot never reached the pump`);
        const procs = vm.processes(0);
        if (!P.TIME && !procs.some(inStone)) throw new Error(`${id}: the stone stopped`);
        if (P.TIME && !ended && vm.cycle > 12 * P.TIME + 2000) throw new Error(`${id}: the stone did not end at pass ${P.TIME}`);
        if (cells.size < Math.min(100, P.TIME || 100)) throw new Error(`${id}: the stone bombed only ${cells.size} cells`);
        pump.final(procs.filter((q) => !inStone(q) && q !== api.norm(s0 + STONE_LEN)), false);   // a process the stream dropped waits a turn on the cell after the stone
      },
    };
  },
};

export default [impPump, stonePumpBoot];
