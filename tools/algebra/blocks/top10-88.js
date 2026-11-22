// Blocks for rebuilding the Koenigstuhl '88 hill's top ten from blocks
// (docs/hill-top10/88.md). Each mechanism was studied in the hill warriors
// and traced in the VM; the Redcode, layouts and constants below are written
// from scratch.
//
//   selfclear-stone-pump-88  Talisman / Quicksilver '88: a parallel boot sends
//                            PROCS-1 processes into a pair-bombing stone and one
//                            into a three-line imp pump over boot-laid seeds;
//                            at pass TIME the stone bombs its own second MOV
//                            and becomes an SPL-fed backward clear.
//   blank-padding-88         COUNT DAT #0, #0 cells (Zygote's spacer).
//   probe-carpet-88          the hill quickscans' two-stream carpet, after a probe.
//   resin-paper-88           Lithobolia / Resinoid: a resin volley and a paper.
//   paper-stone-boot-88      Into the Unknown: one boot, 18 to a stone, 9 to a paper.
//   opening-qscan-m-88       a decoding quickscan that decodes into its carpet.
//   cannonade-pump-88        Freight Train: forking stone, spiral, two pumps.
//   blitz-stone-spiral-88    Der Zweite Blitzkrieg: mod-g stone into a clear.
//   stone-loop-paper-88      Zygote: in-place stone and looping paper.
//   oneshot-88               Mountain Viper: one-shot scanner and clear.
//   pit-vampire-imp-88       Elemental Dust 2: vampire, pit, imps, decoys.
import { modInverse } from '../util.js';

const mod = (x, n) => ((x % n) + n) % n;
const within = (x, lo, hi, core) => mod(x - lo, core) <= mod(hi - lo, core);

// How to make n processes from one: 'D' is SPL 1, 'M' is MOV -1, 0 (n -> 2n-1).
function fanOps(n) {
  const ops = [];
  while (n > 1) { if (n % 2) { ops.unshift('M'); n = (n + 1) / 2; } else { ops.unshift('D'); n /= 2; } }
  return ops;
}
function emitFan(ctx, n, label, firstB = '0') {
  fanOps(n).forEach((op, i) => (op === 'D'
    ? ctx.ins(i ? '' : label, 'SPL', 'B', '1', i ? '0' : firstB)
    : ctx.ins(i ? '' : label, 'MOV', 'I', '-1', '0')));
}
const sameOps = (x, y) => ['op', 'aMode', 'bMode'].every((f) => x[f] === y[f]);

// ---------------------------------------------------------------------------
// selfclear-stone-pump-88
//
// Image:
//   bSeed  MOV pImp, q0+2        three imp instructions where the first
//          MOV pImp, <bSeed      launches land (q0+2, q0+1, q0)
//          MOV pImp, <bSeed
//   bBomb  MOV sBomb, s0+BOFF    the stone's bomb, BOFF past the stone copy's head
//   bGo    SPL 1, s0+cS          fan to PROCS processes; this B-field is the
//          ...                   stone's copy pointer
//   bCpS   MOV <sHead, <bGo      each process copies one stone cell (or more)
//   bCpP   MOV <pHead, <bJmp     and one pump cell
//   bDjn   DJN @bGo, #PROCS      PROCS-1 jump into the stone copy
//   bJmp   JMP @0, p0+cP         the last one into the pump copy
//   pHead  SPL 0, cP             the pump: every pass one child adds S+1 to the
//   pAdd   ADD #S+1, pJmp        launch vector and becomes an imp on the 3-point
//   pJmp   JMP @0, v             ring (S = modInverse(N, core); N = 3 on the hill)
//   pImp   MOV 0, S              template for the seeds (not copied)
//   sHead  SPL 0, cS             the stone
//   sHit   MOV BOFF-1, <FIRST    bomb through the pointer cell's B-field ...
//   sTwo   MOV BOFF-2, @sHit     ... and on the pointer cell itself
//   sAdd   ADD #STEP, sHit
//   sDjn   DJN sHit, <STREAM     a decrement stream
//   sBomb  DAT <DEC, <DEC        moved BOFF past the copy's head by bBomb
//
// The pointer starts at 1 - TIME*STEP, so after TIME passes it is 1: sTwo then
// writes the bomb on itself. From then on every process the SPL makes runs
// sHit once and dies on the DAT, and sHit's "<1" walks the DAT's B-field down:
// an SPL-fed clear moving backward from the stone, one cell a cycle of the
// stone, while the imps keep the warrior alive. This is the end state traced in
// Talisman (and, by a different path through its DJN, in Quicksilver '88).
const SCP = 'selfclear-stone-pump-88';
const SC_STONE = ['sHead', 'sHit', 'sTwo', 'sAdd', 'sDjn'];
const SC_PUMP = ['pHead', 'pAdd', 'pJmp'];

function scGeom(P, core) {
  const S = modInverse(P.N, core);
  const linesS = Math.ceil(SC_STONE.length / P.PROCS), linesP = Math.ceil(SC_PUMP.length / P.PROCS);
  const cS = linesS * P.PROCS, cP = linesP * P.PROCS;
  const first = mod(1 - P.TIME * P.STEP, core);
  // Addresses from the stone copy's head.
  const pumpRel = mod(P.PHOP, core);                    // pump copy head
  const q0 = mod(pumpRel + P.IOFF, core);               // first launch
  return { S, linesS, linesP, cS, cP, first, pumpRel, q0 };
}

const selfclearStonePump = {
  id: SCP, kind: 'body', exit: 'never', processes: 1, grows: true,
  writes: 'sparse', roams: true, moves: true, entry: 'bSeed',
  purpose: "ICWS'88 stone/imp in Talisman's form: the boot lays three imp seeds and the stone's bomb, a fan of PROCS processes copies a five-cell pair-bombing stone HOP cells away and a three-line imp pump PHOP past it, PROCS-1 enter the stone and one the pump; after TIME passes the stone's pointer reaches its own second MOV, which bombs itself, and the stone becomes an SPL-fed backward clear while the imps keep it alive.",
  params: { PROCS: [3, 9], STEP: [2, 54000], TIME: [50, 20000], STREAM: [8, 54000], HOP: [200, 54000], PHOP: [200, 54000], IOFF: [100, 54000], BOFF: [5, 40], DEC: [-200, 200], GUARD: [0, 1], N: [3, 23] },
  defaults: { PROCS: 5, STEP: 2211, TIME: 1819, STREAM: 2438, HOP: 4716, PHOP: 7691, IOFF: 959, BOFF: 16, DEC: -19, GUARD: 1, N: 3 },
  mutable: [['bSeed', ['b']], ['bGo', ['b']], ['bJmp', ['b']], ['bDjn', ['b']], ['sHead', ['b']], ['pHead', ['b']], ['pJmp', ['b']], ['sHit', ['b']]],
  knowledge: {
    parameterRoles: {
      PROCS: 'Processes the fan makes: PROCS-1 start the stone, one the pump. 5 copies each body with one line.', N: 'Imp ring points (3 on the 8,000 core; 3 and 7 do not exist on 25,200 cells, 11 and 13 do). The boot lays N seeds.',
      STEP: 'Stone step (any value: the stone is timed, not layout-safe).',
      TIME: 'Passes before the stone bombs its own second MOV and turns into a backward clear. The contract refuses a TIME whose earlier passes hit the stone, the pump or the seeds.',
      STREAM: 'The DJN stream\'s pointer cell, from the DJN.',
      HOP: 'Stone copy, from the original stone head.', PHOP: 'Pump copy head, from the stone copy head.',
      IOFF: 'First imp launch, from the pump copy head.', GUARD: '1: the contract keeps the stone off the pump before TIME. 0: it may bomb the pump (Quicksilver 88 bombs its own pump head at pass 47, after about a dozen launches, and lives on a short ring).', BOFF: 'Bomb, from the stone copy head.', DEC: 'Both fields of the bomb: DAT <DEC, <DEC.',
    },
    tuning: ['The SPL 0 head adds a stone process every pass, so passes come quicker than with a fixed crowd: Talisman reaches its pass 1819 at about cycle 8,700.', 'Before TIME the stone bombs 2*TIME cells; after it the clear moves one cell a cycle of the SPL loop.'],
    failures: ['The clear runs backward through the pump and over imps that cross its front; alone the ring keeps most arms, beside a partner nothing is promised.', 'A crowd out of step can run sHit before sTwo at the moment the pointer reaches 1; then the head is bombed instead and the stone stops growing but keeps bombing.'],
    evidence: ['docs/hill-top10/88.md'],
  },
  mismatches(P, settings) {
    const core = settings.coreSize, out = [], G = scGeom(P, core);
    if (!G.S) return [`${SCP}: no ${P.N}-point imp ring on a ${core}-cell core`];
    if (settings.maxProcesses < P.PROCS + 20) out.push(`${SCP}: too few processes`);
    const room = settings.maxLength;
    // Cells (from the stone copy head) that must stay intact before TIME.
    // A hit on the DJN is survivable (the SPL keeps feeding a stone that no longer loops), so only
    // the head, both MOVs and the ADD are protected, with the pump's three cells (a hit on the bomb
    // cell only moves its B-field).
    const stoneLo = 0, stoneHi = 3;
    const pumpLo = G.pumpRel, pumpHi = G.pumpRel + SC_PUMP.length - 1;
    const inStone = (x) => within(x, stoneLo, stoneHi, core), inPump = (x) => within(x, pumpLo, pumpHi, core);
    if (within(G.pumpRel, stoneLo - G.cP - 2, stoneHi + 2, core)) out.push(`${SCP}: the stone and pump copies overlap`);
    if (P.BOFF < G.cS) out.push(`${SCP}: BOFF puts the bomb inside the stone copy`);
    // The first imps' path: three arms, each from q0+j*S for a few hundred cells.
    const onArms = (x, run = 300) => Array.from({ length: P.N }, (_, j) => j).some((j) => within(x, G.q0 + j * G.S - 2, G.q0 + j * G.S + run, core));
    for (const x of [stoneLo, stoneHi, pumpLo, pumpHi]) if (onArms(x, 400)) { out.push(`${SCP}: an imp arm starts on the stone or the pump`); break; }
    // The stream walks down from STREAM cells above the DJN, a cell a pass: it reaches the cell x
    // above the DJN at pass STREAM - x, and after TIME the DJN no longer runs.
    const sDjn = 4, streamHits = (y) => { const x = mod(y - sDjn, core); return x >= 1 && x <= P.STREAM && P.STREAM - x < P.TIME; };
    if ([0, 1, 2].some((i) => streamHits(G.pumpRel + i))) out.push(`${SCP}: the DJN stream runs over the pump copy`);
    // Pass k bombs c and, when c is an empty cell, the cell below it (c from the stone head: sHit is +1).
    for (let k = 0; k < P.TIME; k++) {
      const c = mod(1 + G.first + k * P.STEP, core), hit = c <= 4 ? [c] : [c, c - 1];
      if (hit.some((x) => inStone(x) || (P.GUARD && inPump(x)))) { out.push(`${SCP}: pass ${k} of ${P.TIME} already bombs the stone or the pump`); break; }
      if (k < 8 && [c, c - 1].some((x) => onArms(x, 12))) { out.push(`${SCP}: bomb ${k} lands on the first imps' path`); break; }
    }
    if (mod(P.HOP, core) < room + 20 || mod(P.HOP, core) > core - room - 20) out.push(`${SCP}: HOP puts the stone copy on the warrior`);
    return [...new Set(out)];
  },
  linked(P, settings, at, { total, shiftedFrame }) {
    if (shiftedFrame) return [];
    const core = settings.coreSize, G = scGeom(P, core), out = [];
    const inImage = (x) => mod(x, core) < total;
    const s0 = at('sHead') + P.HOP;
    const cells = [];
    for (let i = -1; i <= Math.max(G.cS, P.BOFF); i++) cells.push([s0 + i, 'stone']);
    for (let i = -1; i <= G.cP; i++) cells.push([s0 + G.pumpRel + i, 'pump']);
    for (let i = 0; i < P.N; i++) cells.push([s0 + G.q0 + i, 'imp seeds']);
    for (const [x, what] of cells) if (inImage(x)) { out.push(`${SCP}: the ${what} copy lands on the original image`); break; }
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, G = scGeom(P, core);
    const s0 = `${L('sHead')}+${P.HOP}`, p0 = `${s0}+${G.pumpRel}`, q0 = `${s0}+${G.q0}`;
    // The first imp needs N cells q0 .. q0+N-1 holding an imp: N seeds, top down.
    ctx.ins('bSeed', 'MOV', 'I', L('pImp'), `${q0}+${P.N - 1}`);
    for (let i = 1; i < P.N; i++) ctx.ins('', 'MOV', 'I', L('pImp'), `<${L('bSeed')}`);
    ctx.ins('bBomb', 'MOV', 'I', L('sBomb'), `${s0}+${P.BOFF}`);
    emitFan(ctx, P.PROCS, 'bGo', `${s0}+${G.cS}`);
    for (let i = 0; i < G.linesS; i++) ctx.ins(i ? '' : 'bCpS', 'MOV', 'I', `<${L('sHead')}`, `<${L('bGo')}`);
    for (let i = 0; i < G.linesP; i++) ctx.ins(i ? '' : 'bCpP', 'MOV', 'I', `<${L('pHead')}`, `<${L('bJmp')}`);
    ctx.ins('bDjn', 'DJN', 'B', `@${L('bGo')}`, `#${P.PROCS}`);
    ctx.ins('bJmp', 'JMP', 'B', '@0', `${p0}+${G.cP}`);
    // pJmp's first launch (after one ADD) lands on q0 = pump head + IOFF.
    ctx.ins('pHead', 'SPL', 'B', '0', `${G.cP}`);
    ctx.ins('pAdd', 'ADD', 'AB', `#${G.S + 1}`, L('pJmp'));
    ctx.ins('pJmp', 'JMP', 'B', '@0', `${mod(P.IOFF - 2 - (G.S + 1), core)}`);
    ctx.ins('pImp', 'MOV', 'I', '0', `${G.S}`);
    ctx.ins('sHead', 'SPL', 'B', '0', `${G.cS}`);
    ctx.ins('sHit', 'MOV', 'I', `${P.BOFF - 1}`, `<${G.first}`);
    ctx.ins('sTwo', 'MOV', 'I', `${P.BOFF - 2}`, `@${L('sHit')}`);
    ctx.ins('sAdd', 'ADD', 'AB', `#${mod(P.STEP, core)}`, L('sHit'));
    ctx.ins('sDjn', 'DJN', 'B', L('sHit'), `<${P.STREAM}`);
    ctx.ins('sBomb', 'DAT', 'F', `<${P.DEC}`, `<${P.DEC}`);
  },
  running(api) {
    const G = scGeom(api.P, api.core), s0 = api.norm(api.at('sHead') + api.P.HOP), imp = api.code('pImp');
    return api.vm.processes(0).some((q) => api.norm(q - s0) < 3 || api.norm(q - s0 - G.pumpRel) < 3 || api.same(api.vm.peek(q), imp));
  },
  watch(api) {
    const { vm, P, core } = api, G = scGeom(P, core);
    const s0 = api.norm(api.at('sHead') + P.HOP), p0 = api.norm(s0 + G.pumpRel), q0 = api.norm(s0 + G.q0);
    const bDjn = api.at('bDjn'), bJmp = api.at('bJmp'), sHit = api.norm(s0 + 1), sTwo = api.norm(s0 + 2), pJmp = api.norm(p0 + 2);
    const imp = api.code('pImp');
    const inStone = (c) => within(c, s0, s0 + 3, core), inPump = (c) => within(c, p0, p0 + 2, core);
    const copyOk = (base, labels) => labels.every((l, i) => {
      const x = vm.peek(base + i), y = api.code(l);
      return sameOps(x, y) && api.norm(x.a) === api.norm(y.a) && (i === 0 || api.norm(x.b) === api.norm(y.b));
    });
    const stoneOk = () => SC_STONE.slice(0, 4).every((l, i) => { const x = vm.peek(s0 + i), y = api.code(l); return sameOps(x, y) && api.norm(x.a) === api.norm(y.a); });
    let toStone = 0, toPump = 0, passes = 0, bombs = 0, launches = 0, broken = false, cleared = false, clearWrites = 0;
    return {
      before(pc) {
        if (pc === bDjn && !toPump) return { route: 1 };
        if (pc === bJmp && !toPump) {
          if (!copyOk(s0, SC_STONE)) throw new Error(`${SCP}: the stone copy is not the stone`);
          if (!copyOk(p0, SC_PUMP)) throw new Error(`${SCP}: the pump copy is not the pump`);
          if (!api.same(vm.peek(s0 + P.BOFF), api.code('sBomb'))) throw new Error(`${SCP}: the bomb is not BOFF past the stone copy`);
          for (let i = 0; i < P.N; i++) if (!api.same(vm.peek(q0 + i), imp)) throw new Error(`${SCP}: imp seed ${i} is missing`);
          return { route: 2 };
        }
        if (pc === sTwo && !broken && !cleared) {
          if (!stoneOk()) { broken = true; return null; }
          return { bomb: api.norm(sHit + vm.peek(sHit).b) };
        }
        if (pc === sHit && cleared) return { clear: api.norm(sTwo + vm.peek(sTwo).b - 1) };
        if (pc === api.norm(s0 + 3) && !broken && !cleared) return { add: true };
        if (pc === pJmp && toPump && api.same(vm.peek(pJmp), { ...api.code('pJmp'), b: vm.peek(pJmp).b })) return { launch: api.norm(pJmp + vm.peek(pJmp).b) };
        return null;
      },
      after(t) {
        if (!t) return;
        if (t.route) {
          if (t.route === 2) { toPump++; if (!vm.processes(0).includes(p0)) throw new Error(`${SCP}: the last process did not enter the pump copy`); } else if (vm.processes(0).at(-1) === s0) toStone++;
          return;
        }
        if (t.add) { passes++; return; }
        if (t.bomb !== undefined) {
          if (t.bomb === sTwo) {
            if (vm.peek(sTwo).op !== 'DAT') throw new Error(`${SCP}: the self-hit did not leave a DAT`);
            if (api.alone && passes !== P.TIME) throw new Error(`${SCP}: the stone hit itself after ${passes} passes, not ${P.TIME}`);
            cleared = true;
            return;
          }
          if (P.GUARD && inPump(t.bomb)) throw new Error(`${SCP}: the stone bombed its pump`);
          if (inStone(t.bomb)) throw new Error(`${SCP}: the stone bombed itself before TIME`);
          bombs++;
          return;
        }
        if (t.clear !== undefined) {
          if (vm.peek(t.clear).op === 'DAT') clearWrites++;
          return;
        }
        if (t.launch !== undefined) {
          if (t.launch !== api.norm(q0 + launches * (G.S + 1))) throw new Error(`${SCP}: launch ${launches} left the ring`);
          launches++;
        }
      },
      final() {
        if (!api.entered()) return;
        if (toPump && toStone !== P.PROCS - 1) throw new Error(`${SCP}: ${toStone} processes entered the stone, not ${P.PROCS - 1}`);
        if (!api.alone) return;
        if (toPump !== 1) throw new Error(`${SCP}: the boot never reached the pump`);
        if (bombs < Math.min(200, P.TIME)) throw new Error(`${SCP}: the stone dropped only ${bombs} bombs`);
        if (vm.cycle > 40 * P.TIME && !cleared && !broken) throw new Error(`${SCP}: the stone never turned into a clear`);
        if (cleared && clearWrites < 500) throw new Error(`${SCP}: the clear wrote only ${clearWrites} cells`);
        if (launches < (P.GUARD ? 12 : 3)) throw new Error(`${SCP}: the pump launched only ${launches} imps`);
        const imps = vm.processes(0).filter((q) => api.same(vm.peek(q), imp)).length;
        if (imps < 3) throw new Error(`${SCP}: only ${imps} imps are alive`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// blank-padding-88: COUNT cells of DAT #0, #0 (the strict-'88 spelling of an
// empty cell), laid out after the code, as Zygote keeps 34 of them between
// its bodies and its quickscan.
const blankPadding = {
  id: 'blank-padding-88', kind: 'data', exit: 'data', processes: 0, writes: 'sparse', entry: 'pad',
  purpose: "COUNT cells of DAT #0, #0 laid out after the code (strict '88 empty cells): a scanner that finds the image finds empty cells, and the parts sit further apart.",
  params: { COUNT: [1, 90] },
  defaults: { COUNT: 34 },
  mismatches: () => [],
  emit(ctx) { for (let i = 0; i < ctx.P.COUNT; i++) ctx.ins(i ? '' : 'pad', 'DAT', 'F', '#0', '#0'); },
  watch: () => ({ before: () => null, after() {}, final() {} }),
};

// ---------------------------------------------------------------------------
// probe-carpet-88: the burst the Metcalf-style '88 quickscans run after a hit
// (Talisman, Resinoid, Into the Unknown, Der Zweite Blitzkrieg, Lithobolia),
// in its own layout. It follows an opening that provides `probe`.
//
//   cGo    ADD probe, cKil       cKil's B-field becomes the found cell ('88 ADD
//          ADD #shift, cKil      adds the A-fields too: see below); a found cell
//          SLT #limit, cKil      whose carpet would reach the image (or the
//          JMP next              image boundary: nothing found) is now a small
//          SUB #shift, cKil      number: hand on at once
//         (CMP @cKil, BLANK      SIDE 1: the found cell empty? Then the pair's
//          JMP cLoop             other cell is the occupied one)
//          ADD #GAP, cKil
//   cLoop  MOV cBomb, @cKil      stream 1: the bomb on the pointer cell
//   cKil   MOV <src, <ptr        stream 2: through the bomb just laid, whose
//          SUB #STEP, cKil       B-field (DB) it decrements: DB-1 above it
//          DJN cLoop, #COUNT     then fall into the next block
//   cBomb  DAT <DA, <DB          (a state cell, laid before the code)
//
// Four cycles a pass and two writes. The pointer lives in cKil's own B-field,
// which is what lets the second MOV aim through the cell the first just wrote.
// With STEP 7 and DB 46 the second stream sits three cells off the first, so
// where they overlap the carpet has a write every three or four cells, from
// DB-1 above the found cell to (COUNT-1)*STEP below it. The second stream
// copies whatever cKil's A-field points at, one cell lower each pass: the
// first ADD has added the probe's A-field to it, and a decoding quickscan
// leaves an arbitrary number there, so the source is some far cell, nearly
// always empty. That is what the hill's version does too: the second stream
// erases rather than bombs. Both kill code that runs them; the DAT's own
// predecrements also damage cells DA and DB away when an enemy runs one.
const PC = 'probe-carpet-88';
const pcLo = (P) => -(P.COUNT - 1) * P.STEP;                          // lowest write, from the found cell
const pcHi = (P) => (P.SIDE ? P.GAP : 0) + P.DB - 1;                   // highest write
const probeCarpet = {
  id: PC, kind: 'opening', exit: 'next', link: 'fall', processes: 1, writes: 'sparse', entry: 'cGo', needs: ['probe'],
  purpose: "ICWS'88 carpet after a quickscan hit, as the Metcalf-style hill quickscans lay it: COUNT four-cycle passes STEP apart down from the found cell, each a DAT <DA, <DB on the pointer and a second write DB-1 above it, aimed through the first bomb's own B-field and copying a far (nearly always empty) cell; SIDE 1 first picks the occupied cell of the pair. At the image boundary, or when the carpet would reach the image, it hands on at once. Nine instructions (twelve with SIDE 1) and one data cell.",
  params: { COUNT: [2, 20], STEP: [1, 40], GAP: [1, 400], DA: [-400, 400], DB: [2, 200], BLANK: [100, 54000], SIDE: [0, 1] },
  defaults: { COUNT: 9, STEP: 7, GAP: 130, DA: -46, DB: 46, BLANK: 3900, SIDE: 0 },
  mutable: [['cKil', ['a', 'b']], ['cCount', ['b']]],
  knowledge: {
    parameterRoles: {
      COUNT: 'Passes: two writes each.', STEP: 'Between passes, downward.', GAP: 'SIDE 1: the quickscan\'s pair gap (the occupied cell is the found one or GAP above it).',
      DA: 'The bomb\'s A-field (a predecrement an enemy runs).', DB: 'The bomb\'s B-field: the second stream lands DB-1 above the first.', BLANK: 'SIDE 1: a cell assumed empty, from the CMP.',
      SIDE: '0: carpet from the found cell (after an opening that already names the occupied cell, such as opening-qscan-table-88). 1: test the found cell first.',
    },
    tuning: ['Against the hill this burst, not the scan, is where a quickscan earns its points: Talisman with its burst cut to one pass scored 1.12 against 1.30 with nine (100 rounds each), below its body with no quickscan at all (1.19); a DAT #0, #0 bomb in place of DAT <-46, <46 cost 0.07.', 'Every cycle before the first bomb counts in a quickscan duel: the opponent\'s own quickscan is running too.'],
    failures: ['A found cell closer to the image than the carpet is long gets no carpet.', 'With SIDE 1, if BLANK is not empty the side choice can be wrong.'],
    evidence: ['docs/hill-top10/88.md'],
  },
  mismatches(P, settings) {
    const out = [];
    if (pcHi(P) - pcLo(P) >= Math.floor(settings.coreSize / 2) - settings.maxLength) out.push(`${PC}: the carpet is long enough to wrap into the warrior`);
    if (P.SIDE && (P.BLANK < settings.maxLength + pcHi(P) + 2 || P.BLANK > settings.coreSize - settings.maxLength - 2)) out.push(`${PC}: BLANK lies too near the warrior`);
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, U = ctx.ref('probe'), K = L('cKil');
    const idx = `(${ctx.pc()}+(${K}-${L('cGo')}))`;                      // cKil's index in the image
    ctx.ins('cGo', 'ADD', 'F', U, K);
    ctx.ins('', 'ADD', 'AB', `#(${idx}+${pcHi(P)})`, K);
    ctx.ins('', 'SLT', 'AB', `#${ctx.span + pcHi(P) - pcLo(P)}`, K);
    ctx.ins('', 'JMP', 'B', ctx.next);
    ctx.ins('', 'SUB', 'AB', `#(${idx}+${pcHi(P)})`, K);
    if (P.SIDE) {
      ctx.ins('', 'CMP', 'I', `@${K}`, `${mod(P.BLANK, core)}`);
      ctx.ins('', 'JMP', 'B', L('cLoop'));
      ctx.ins('', 'ADD', 'AB', `#${P.GAP}`, K);
    }
    ctx.ins('cLoop', 'MOV', 'I', L('cBomb'), `@${K}`);
    // Its B starts as the offset to the probe cell, so the first ADD leaves it on the found cell.
    ctx.ins('cKil', 'MOV', 'I', `<${L('cBomb')}`, `<(${U}-${K})`);
    ctx.ins('', 'SUB', 'AB', `#${P.STEP}`, K);
    ctx.ins('cCount', 'DJN', 'B', L('cLoop'), `#${P.COUNT}`);
  },
  // The bomb is a state cell (laid before all code), so the DJN falls straight into the next block.
  state(ctx) { ctx.ins('cBomb', 'DAT', 'F', `<${ctx.P.DA}`, `<${ctx.P.DB}`); },
  watch(api) {
    const { vm, P } = api, K = api.at('cKil'), w1 = api.at('cLoop'), bomb = api.code('cBomb');
    let ones = 0, twos = 0, found = null, due = null, closed = false, first = null;
    const isBomb = (x) => x.op === 'DAT' && api.norm(x.a) === api.norm(bomb.a) && x.aMode === bomb.aMode;
    return {
      before(pc) {
        if (found !== null && !closed && pc !== api.entry() && !api.inSelf(pc)) closed = true;
        if (closed) return null;
        if (pc === api.entry() && found === null) {
          found = api.norm(api.ref('probe') + vm.peek(api.ref('probe')).b);
          due = api.rel(found, api.image.start) !== api.total;
          for (let d = pcLo(P); d <= pcHi(P) && due; d++) if (api.rel(found + d, api.image.start) < api.total) due = false;
        }
        if ((pc === w1 || pc === K) && vm.peek(pc).op === 'MOV') {
          const p = api.norm(K + vm.peek(K).b);
          if (pc === w1) { first ??= p; return { t: p, pc, one: true }; }
          return { t: api.norm(p + vm.peek(p).b - 1), pc, one: false };
        }
        return null;
      },
      after(x) {
        if (!x) return;
        if (api.inImage(x.t) && !api.inDead(x.t)) throw new Error(`${PC} wrote into its own image`);
        if (vm.writerPc[x.t] !== x.pc) throw new Error(`${PC} wrote somewhere other than its pointer said`);
        if (x.one) { if (!isBomb(vm.peek(x.t))) throw new Error(`${PC} dropped something other than its bomb`); ones++; } else twos++;
      },
      final() {
        if (found === null) return;
        if (!due) { if (ones + twos) throw new Error(`${PC} bombed although the probe held nothing it could carpet`); return; }
        if (ones !== P.COUNT || twos !== P.COUNT) throw new Error(`${PC} made ${ones} + ${twos} writes, not ${P.COUNT} + ${P.COUNT}`);
        if (first !== found && first !== api.norm(found + P.GAP)) throw new Error(`${PC} did not start on the found pair`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// resin-paper-88: Lithobolia's and Resinoid's body. A binary SPL tree with
// RESINS + 1 leaves starts every leaf within a few cycles:
//
//   tree   SPL right              (RESINS SPLs in all; the running process takes
//          ...                    the left half, the new one the right)
//   leaf k MOV rBack, <lJmp       copy the resin, last cell first, through the
//          ...                    leaf's own JMP B-field ...
//   lJmp   JMP @0, dst_k+RLEN     ... which then points at the copy's head
//   paper  fan to LEN processes   the last leaf: a straight-line paper
//          MOV <LEN, <k1 / k1 SPL @0, dst     STAGES copy stages
//          SPL 0 / ADD #S, tJmp / tJmp JMP @0, tImp-S*LEN / tImp MOV 0, S
//                                 then a 3-point imp pump tail
//   rHead  SPL 0 (HEADS of them)  the resin template (see resin-stone):
//   rLay   MOV rDrop, <rDrop      lays MOV <0, <p drops downward from FIRST
//   rDrop  MOV <0, <FIRST         above itself, two cells a pass
//   rBack  DJN rLay, <STREAM
//
// Resin k lands at RHOP + k*HOP from the template, one process each (its SPL
// heads add one a pass). The paper is the last block in the image: the empty
// cells after it are its stage counters. RPROCS > 1 adds SPL @lJmp lines to
// each resin leaf. Resinoid's paper ends in an in-place imp maker; this block
// uses the pump tail for both.
const RP = 'resin-paper-88';
function rpGeom(P, core) {
  const RLEN = P.HEADS + 3;
  const steps = [P.STEP1, P.STEP2, P.STEP3].slice(0, P.STAGES);
  const LEN = 2 * P.STAGES + 4;
  const resinAt = (k) => mod(P.RHOP + k * P.HOP, core);    // from the template head
  return { RLEN, steps, LEN, resinAt, S: modInverse(3, core), fan: fanOps(LEN) };
}
// The leaves in tree order: resins 0 .. RESINS-1, then the paper.
function emitTree(ctx, leaves, emitLeaf, path = 't') {
  if (leaves.length === 1) { emitLeaf(leaves[0]); return; }
  const half = Math.ceil(leaves.length / 2);
  ctx.ins('', 'SPL', 'B', ctx.L(`${path}r`), '0');
  emitTree(ctx, leaves.slice(0, half), emitLeaf, `${path}l`);
  ctx.mark(`${path}r`);
  emitTree(ctx, leaves.slice(half), emitLeaf, `${path}r`);
}
const resinPaper = {
  id: RP, kind: 'body', exit: 'never', processes: 1, grows: true, writes: 'core', attacks: 'all', roams: true, moves: true, layout: 'last', entry: 'go',
  purpose: "ICWS'88 resin volley and paper (Lithobolia, Resinoid): a binary SPL tree starts RESINS leaves that each copy a resin (SPL 0 heads over a loop laying MOV <0, <p drops) HOP apart and jump into it, and one leaf that fans into a straight-line paper of STAGES copy stages ending in a 3-point imp pump.",
  params: { RESINS: [1, 8], HEADS: [1, 2], RHOP: [200, 54000], HOP: [100, 27000], FIRST: [200, 54000], STREAM: [16, 54000], STAGES: [1, 3], STEP1: [200, 54000], STEP2: [200, 54000], STEP3: [200, 54000], SPLIT: [0, 1], RPROCS: [1, 6] },
  defaults: { RPROCS: 1, SPLIT: 1, RESINS: 7, HEADS: 1, RHOP: 6200, HOP: 992, FIRST: 7339, STREAM: 7900, STAGES: 3, STEP1: 2302, STEP2: 2949, STEP3: 4368 },
  mutable: (P) => [['lJmp0', ['b']], ...Array.from({ length: P.RESINS }, (_, k) => [`lJmp${k}`, ['b']]), ...Array.from({ length: P.STAGES }, (_, j) => [`k${2 * j + 1}`, ['b']]), ['tJmp', ['b']], ['rDrop', ['b']], ['rBack', ['b']]],
  knowledge: {
    parameterRoles: {
      RESINS: 'Resins booted (Lithobolia 7, Resinoid 2).', RPROCS: 'Processes each resin leaf starts in its resin (SPL @ lines before its JMP); Resinoid starts six.', SPLIT: '1: each resin loop returns to its SPL 0, so its processes double every few passes (Lithobolia, Resinoid). 0: it returns to the layer line and the heads add one a pass. Alone, 1 scored 1.05 against 0.96 for 0 on the hill (100 rounds, no quickscan).', HEADS: 'SPL 0 lines over each resin loop.', RHOP: 'First resin, from the template.', HOP: 'Between resins.',
      FIRST: 'Where each resin\'s trail starts, above its drop line.', STREAM: 'Each resin\'s DJN stream pointer.',
      STAGES: 'Paper copy stages before the pump tail.', STEP1: 'Stage 1 copy distance, from the stage.', STEP2: 'Stage 2.', STEP3: 'Stage 3.',
    },
    tuning: ['Every leaf starts within about RESINS/2 + 5 cycles: the tree is log-deep and each resin leaf is RLEN+1 cycles.', 'Seven resins and a paper are about 60 instructions; Lithobolia spends the rest of its 99 on a 13-pair quickscan.'],
    failures: ['Resin trails run over the other resins and the paper copies: the papers outbreed it, the resins do not care.', 'Imp rings are tied, not killed (see resin-stone).'],
    evidence: ['docs/hill-top10/88.md'],
  },
  mismatches(P, settings) {
    const core = settings.coreSize, room = settings.maxLength, out = [], G = rpGeom(P, core);
    if (!G.S) return [`${RP}: no 3-point imp ring on a ${core}-cell core`];
    const near = (d, r) => mod(d, core) < r || mod(d, core) > core - r;
    for (let k = 0; k < P.RESINS; k++) {
      if (near(G.resinAt(k), room + G.RLEN + 2)) out.push(`${RP}: resin ${k} lands on the warrior`);
      for (let j = 0; j < k; j++) if (near(G.resinAt(k) - G.resinAt(j), G.RLEN + 2)) out.push(`${RP}: resins ${j} and ${k} overlap`);
    }
    G.steps.forEach((s, j) => { if (near(s, room + G.LEN + 2 * P.STAGES)) out.push(`${RP}: paper stage ${j + 1} lays its copy on the warrior`); });
    if (near(P.FIRST, room + 4)) out.push(`${RP}: FIRST starts the trail on the warrior`);
    if (settings.maxProcesses < 4 * G.LEN + P.RESINS) out.push(`${RP}: too few processes`);
    return [...new Set(out)];
  },
  linked(P, settings, at, { total, shiftedFrame }) {
    if (shiftedFrame) return [];
    const core = settings.coreSize, G = rpGeom(P, core), out = [];
    if (at('k0') + G.LEN !== total) out.push(`${RP}: it must be the last block in the image (the cells after its paper are the stage counters)`);
    const inImage = (x) => mod(x, core) < total;
    for (let k = 0; k < P.RESINS; k++) for (let i = -1; i <= G.RLEN; i++) if (inImage(at('rHead') + G.resinAt(k) + i)) { out.push(`${RP}: resin ${k} lands on the original image`); k = P.RESINS; break; }
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, G = rpGeom(P, core);
    const leaves = [...Array.from({ length: P.RESINS }, (_, k) => k), 'paper'];
    ctx.mark('go');
    emitTree(ctx, leaves, (leaf) => {
      if (leaf === 'paper') {
        emitFan(ctx, G.LEN, 'fGo');
        G.steps.forEach((step, j) => {
          ctx.ins(`k${2 * j}`, 'MOV', 'I', `<${G.LEN}`, `<${L(`k${2 * j + 1}`)}`);
          ctx.ins(`k${2 * j + 1}`, 'SPL', 'B', '@0', `${mod(step - 1 + G.LEN, core)}`);
        });
        ctx.ins('tSpl', 'SPL', 'B', '0', '0');
        ctx.ins('tAdd', 'ADD', 'AB', `#${G.S}`, L('tJmp'));
        ctx.ins('tJmp', 'JMP', 'B', '@0', `${mod(1 - G.S * G.LEN, core)}`);
        ctx.ins('tImp', 'MOV', 'I', '0', `${G.S}`);
        return;
      }
      for (let i = G.RLEN - 1; i >= 0; i--) ctx.ins(i === G.RLEN - 1 ? `leaf${leaf}` : '', 'MOV', 'I', `${L('rHead')}+${i}`, `<${L(`lJmp${leaf}`)}`);
      for (let i = 1; i < P.RPROCS; i++) ctx.ins('', 'SPL', 'B', `@${L(`lJmp${leaf}`)}`, '0');
      ctx.ins(`lJmp${leaf}`, 'JMP', 'B', '@0', `${L('rHead')}+${G.resinAt(leaf) + G.RLEN}`);
    });
  },
  // The template sits before the code: the paper has to be the image's last cells.
  state(ctx) {
    const { L, P } = ctx;
    for (let i = 0; i < P.HEADS; i++) ctx.ins(i ? `rHead${i}` : 'rHead', 'SPL', 'B', '0', '0');
    ctx.ins('rLay', 'MOV', 'I', L('rDrop'), `<${L('rDrop')}`);
    ctx.ins('rDrop', 'MOV', 'I', '<0', `<${mod(P.FIRST, ctx.core)}`);
    ctx.ins('rBack', 'DJN', 'B', P.SPLIT ? L('rHead') : L('rLay'), `<${P.STREAM}`);
  },
  running(api) {
    const G = rpGeom(api.P, api.core), head = api.at('rHead'), imp = api.code('tImp');
    const resins = Array.from({ length: api.P.RESINS }, (_, k) => api.norm(head + G.resinAt(k)));
    return api.vm.processes(0).some((q) => resins.some((r) => api.norm(q - r) < G.RLEN) || api.same(api.vm.peek(q), imp) || api.inSelf(q));
  },
  watch(api) {
    const { vm, P, core } = api, G = rpGeom(P, core), head = api.at('rHead');
    const jumps = Array.from({ length: P.RESINS }, (_, k) => api.at(`lJmp${k}`));
    const dst = Array.from({ length: P.RESINS }, (_, k) => api.norm(head + G.resinAt(k)));
    // Processes an RPROCS leaf has already started move the B-fields: compare the rest.
    const sameA = (x, y) => sameOps(x, y) && api.norm(x.a) === api.norm(y.a);
    const entered = new Set(), k0 = api.at('k0'), stageSpl = G.steps.map((s, j) => api.at(`k${2 * j + 1}`));
    const stageRuns = G.steps.map(() => 0);
    let launches = 0, closed = false;
    const tJmp = api.at('tJmp');
    return {
      before(pc) {
        if (closed) return null;
        const k = jumps.indexOf(pc);
        if (k >= 0 && !entered.has(k)) {
          for (let i = 0; i < G.RLEN; i++) if (!sameA(vm.peek(dst[k] + i), api.code(i < P.HEADS ? (i ? `rHead${i}` : 'rHead') : ['rLay', 'rDrop', 'rBack'][i - P.HEADS]))) throw new Error(`${RP}: resin ${k} is not a copy of the resin`);
          if (api.norm(pc + vm.peek(pc).b) !== dst[k]) throw new Error(`${RP}: leaf ${k} does not jump into its resin`);
          entered.add(k);
          return null;
        }
        const j = stageSpl.indexOf(pc);
        if (j >= 0 && stageRuns[j] < G.LEN) { stageRuns[j]++; return null; }
        if (pc === tJmp && vm.peek(pc).op === 'JMP') launches++;
        return null;
      },
      after() {},
      final() {
        if (!api.alone) return;
        if (entered.size !== P.RESINS) throw new Error(`${RP}: only ${entered.size} of ${P.RESINS} resins were started`);
        stageRuns.forEach((n, j) => { if (n !== G.LEN) throw new Error(`${RP}: paper stage ${j + 1} started ${n} processes, not ${G.LEN}`); });
        if (launches < G.LEN) throw new Error(`${RP}: the pump tail launched only ${launches} imps`);
        void k0;
      },
    };
  },
};

// ---------------------------------------------------------------------------
// paper-stone-boot-88: Into the Unknown's body. One boot sends two thirds of
// its processes into a timed pair-bombing stone and a third into a paper:
//
//   bBomb  MOV sBomb, s0+BOFF     the stone's bomb, beside the stone copy
//   bGo    SPL 2                  three lines make five processes
//          SPL 2
//   bTwo   SPL 1                  (also the template for bDbl)
//   bCpS   MOV <bSs, <bSd         each copies one stone cell
//   bDbl   MOV bTwo, 0            the first overwrites itself with SPL 1, the
//                                 other four run it: nine processes
//   bCpP   MOV <bPs, <bPd         each copies one paper cell
//          SPL @bSd               nine into the stone ...
//   bSd    SPL @0, s0+5           ... nine more ...
//   bPd    JMP @0, p0+9           ... and nine into the paper
//   bSs / bPs                     the copy counters (data)
//   paper  MOV <9, <k1 / k1 SPL @0, PSTEPn   three stages (as silk-tail-88)
//          SPL 0 / MOV 0, <1 / DJN -1, #-GAP an SPL-fed clear from GAP below
//   stone  SPL 0 / MOV b, <first / MOV b, @-1 / ADD #STEP, -2 / DJN -3, <STREAM
//   sBomb  DAT <DA, <DB
//
// The stone is selfclear-stone-pump-88's: its pointer starts at 1-TIME*STEP,
// so pass TIME bombs its own second MOV and leaves an SPL-fed backward clear.
const PSB = 'paper-stone-boot-88';
const PS_PAPER = 9, PS_STONE = 5;
const psbStepsOf = (P) => [P.PSTEP1, P.PSTEP2, P.PSTEP3];
const paperStoneBoot = {
  id: PSB, kind: 'body', exit: 'never', processes: 1, grows: true, writes: 'sparse', roams: true, moves: true, entry: 'bBomb',
  purpose: "ICWS'88 paper/stone boot (Into the Unknown): five processes copy a timed pair-bombing stone, double to nine, copy a nine-line paper, then send eighteen into the stone and nine into the paper. The paper runs three copy stages and ends in an SPL-fed clear; the stone bombs its own second MOV at pass TIME and becomes a backward clear.",
  params: { STEP: [2, 54000], TIME: [50, 20000], STREAM: [8, 54000], BOFF: [5, 40], DA: [-27000, 27000], DB: [-200, 200], SHOP: [200, 54000], PHOP: [200, 54000], PSTEP1: [200, 54000], PSTEP2: [200, 54000], PSTEP3: [200, 54000], GAP: [20, 400] },
  defaults: { STEP: 5789, TIME: 1344, STREAM: 5000, BOFF: 9, DA: 2667, DB: -6, SHOP: 2725, PHOP: 236, PSTEP1: 5656, PSTEP2: 3152, PSTEP3: 3408, GAP: 80 },
  mutable: [['bSd', ['b']], ['bPd', ['b']], ['bSs', ['b']], ['bPs', ['b']], ['bDbl', ['a', 'b']], ['k1', ['b']], ['k3', ['b']], ['k5', ['b']], ['cDjn', ['b']], ['sHit', ['b']], ['sHead', ['b']]],
  knowledge: {
    parameterRoles: {
      STEP: 'Stone step.', TIME: 'Passes before the stone bombs its own second MOV.', STREAM: 'The stone\'s DJN stream pointer.', BOFF: 'The bomb, from the stone copy head.', DA: 'Bomb A-field (Into the Unknown: 2667, an anti-imp decrement).', DB: 'Bomb B-field.',
      SHOP: 'Stone copy, from the stone template.', PHOP: 'Paper copy, from the paper template.', PSTEP1: 'Paper stage 1 distance.', PSTEP2: 'Stage 2.', PSTEP3: 'Stage 3.', GAP: 'How far below its tail the paper\'s clear starts.',
    },
    tuning: ['Eighteen processes on a stone whose SPL head adds one a pass.', "Alone, Into the Unknown's paper clears (MOV 0, <1 lines) reach and overwrite its stone between cycles 12,000 and 16,000, before the stone's own end."],
    failures: ['The paper\'s clear lays MOV 0, <1 instructions and wipes older copies as readily as anything else.'],
    evidence: ['docs/hill-top10/88.md'],
  },
  mismatches(P, settings) {
    const core = settings.coreSize, room = settings.maxLength, out = [];
    const first = mod(1 - P.TIME * P.STEP, core), pumpless = (x) => within(x, 0, 3, core);
    for (let k = 0; k < P.TIME; k++) {
      const c = mod(1 + first + k * P.STEP, core), hit = c <= 4 ? [c] : [c, c - 1];
      if (hit.some(pumpless)) { out.push(`${PSB}: pass ${k} of ${P.TIME} already bombs the stone`); break; }
    }
    if (P.BOFF < PS_STONE) out.push(`${PSB}: BOFF puts the bomb inside the stone copy`);
    const near = (d, r) => mod(d, core) < r || mod(d, core) > core - r;
    if (near(P.SHOP, room + 20) || near(P.PHOP, room + 20)) out.push(`${PSB}: a copy lands on the warrior`);
    psbStepsOf(P).forEach((s, j) => { if (near(s, room + 2 * PS_PAPER)) out.push(`${PSB}: paper stage ${j + 1} lays its copy on the warrior`); });
    if (settings.maxProcesses < 200) out.push(`${PSB}: too few processes`);
    return out;
  },
  linked(P, settings, at, { total, shiftedFrame }) {
    if (shiftedFrame) return [];
    const core = settings.coreSize, out = [], inImage = (x) => mod(x, core) < total;
    const s0 = at('sHead') + P.SHOP, p0 = at('k0') + P.PHOP;
    for (let i = -1; i <= Math.max(PS_STONE, P.BOFF); i++) if (inImage(s0 + i)) { out.push(`${PSB}: the stone copy lands on the original image`); break; }
    for (let i = -1; i <= PS_PAPER + 6; i++) if (inImage(p0 + i)) { out.push(`${PSB}: the paper copy lands on the original image`); break; }
    const s1 = mod(s0, core), p1 = mod(p0, core);
    if (within(p1, s1 - PS_PAPER - 7, s1 + Math.max(PS_STONE, P.BOFF) + 1, core)) out.push(`${PSB}: the stone and paper copies overlap`);
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx;
    const s0 = `${L('sHead')}+${P.SHOP}`, p0 = `${L('k0')}+${P.PHOP}`;
    ctx.ins('bBomb', 'MOV', 'I', L('sBomb'), `${s0}+${P.BOFF}`);
    ctx.ins('bGo', 'SPL', 'B', '2', '0');
    ctx.ins('', 'SPL', 'B', '2', '0');
    ctx.ins('bTwo', 'SPL', 'B', '1', '0');
    ctx.ins('bCpS', 'MOV', 'I', `<${L('bSs')}`, `<${L('bSd')}`);
    ctx.ins('bDbl', 'MOV', 'I', L('bTwo'), '0');
    ctx.ins('bCpP', 'MOV', 'I', `<${L('bPs')}`, `<${L('bPd')}`);
    ctx.ins('', 'SPL', 'B', `@${L('bSd')}`, '0');
    ctx.ins('bSd', 'SPL', 'B', '@0', `${s0}+${PS_STONE}`);
    ctx.ins('bPd', 'JMP', 'B', '@0', `${p0}+${PS_PAPER}`);
    ctx.ins('bSs', 'DAT', 'F', '#0', `#${L('sHead')}+${PS_STONE}-${L('bSs')}`);
    ctx.ins('bPs', 'DAT', 'F', '#0', `#${L('k0')}+${PS_PAPER}-${L('bPs')}`);
    psbStepsOf(P).forEach((step, j) => {
      ctx.ins(`k${2 * j}`, 'MOV', 'I', `<${PS_PAPER}`, `<${L(`k${2 * j + 1}`)}`);
      ctx.ins(`k${2 * j + 1}`, 'SPL', 'B', '@0', `${mod(step - 1 + PS_PAPER, core)}`);
    });
    ctx.ins('cSpl', 'SPL', 'B', '0', '0');
    ctx.ins('cMov', 'MOV', 'I', '0', `<${L('cDjn')}`);
    ctx.ins('cDjn', 'DJN', 'B', L('cMov'), `#${-P.GAP}`);
    ctx.ins('sHead', 'SPL', 'B', '0', '0');
    ctx.ins('sHit', 'MOV', 'I', `${P.BOFF - 1}`, `<${mod(1 - P.TIME * P.STEP, core)}`);
    ctx.ins('sTwo', 'MOV', 'I', `${P.BOFF - 2}`, `@${L('sHit')}`);
    ctx.ins('sAdd', 'ADD', 'AB', `#${mod(P.STEP, core)}`, L('sHit'));
    ctx.ins('sDjn', 'DJN', 'B', L('sHit'), `<${P.STREAM}`);
    ctx.ins('sBomb', 'DAT', 'F', `<${P.DA}`, `<${P.DB}`);
  },
  running(api) {
    const s0 = api.norm(api.at('sHead') + api.P.SHOP), mov = api.code('cMov'), k0 = api.code('k0');
    return api.vm.processes(0).some((q) => api.norm(q - s0) < 3 || api.same(api.vm.peek(q), mov) || sameOps(api.vm.peek(q), k0));
  },
  watch(api) {
    const { vm, P } = api, s0 = api.norm(api.at('sHead') + P.SHOP), p0 = api.norm(api.at('k0') + P.PHOP);
    const bSd = api.at('bSd'), bPd = api.at('bPd'), sHit = api.norm(s0 + 1), sTwo = api.norm(s0 + 2);
    const stoneCells = ['sHead', 'sHit', 'sTwo', 'sAdd', 'sDjn'], paperCells = ['k0', 'k1', 'k2', 'k3', 'k4', 'k5', 'cSpl', 'cMov', 'cDjn'];
    const copyOk = (base, labels) => labels.every((l, i) => { const x = vm.peek(base + i), y = api.code(l); return sameOps(x, y) && api.norm(x.a) === api.norm(y.a); });
    let toStone = 0, toPaper = 0, passes = 0, bombs = 0, cleared = false, broken = false, checked = false;
    const stoneOk = () => copyOk(s0, stoneCells.slice(0, 4));
    return {
      before(pc) {
        if ((pc === bSd || pc === bPd) && !checked) {
          checked = true;
          if (!copyOk(s0, stoneCells)) throw new Error(`${PSB}: the stone copy is not the stone`);
          if (!copyOk(p0, paperCells)) throw new Error(`${PSB}: the paper copy is not the paper`);
          if (!api.same(vm.peek(s0 + P.BOFF), api.code('sBomb'))) throw new Error(`${PSB}: the bomb is not BOFF past the stone copy`);
        }
        if (pc === bSd && toPaper < PS_PAPER) return { route: 's' };
        if (pc === bPd && toPaper < PS_PAPER) return { route: 'p' };
        if (pc === sTwo && !broken && !cleared) { if (!stoneOk()) { broken = true; return null; } return { bomb: api.norm(sHit + vm.peek(sHit).b) }; }
        if (pc === api.norm(s0 + 3) && !broken && !cleared) return { add: true };
        return null;
      },
      after(t) {
        if (!t) return;
        if (t.route === 's') { toStone += 2; return; }
        if (t.route === 'p') { toPaper++; if (vm.processes(0).at(-1) !== p0) throw new Error(`${PSB}: a process did not enter the paper copy`); return; }
        if (t.add) { passes++; return; }
        if (t.bomb !== undefined) {
          if (t.bomb === sTwo) { if (api.alone && passes !== P.TIME) throw new Error(`${PSB}: the stone hit itself after ${passes} passes, not ${P.TIME}`); cleared = true; return; }
          if (within(t.bomb, s0, s0 + 3, api.core)) throw new Error(`${PSB}: the stone bombed itself before TIME`);
          bombs++;
        }
      },
      final() {
        if (!api.entered() || !api.alone) return;
        if (toPaper !== PS_PAPER || toStone !== 2 * PS_PAPER) throw new Error(`${PSB}: ${toStone} processes went to the stone and ${toPaper} to the paper, not 18 and 9`);
        if (bombs < Math.min(200, P.TIME)) throw new Error(`${PSB}: the stone dropped only ${bombs} bombs`);
        if (vm.cycle > 40 * P.TIME && !cleared && !broken) throw new Error(`${PSB}: the stone never turned into a clear`);
        const k0 = api.code('k0'), k1 = api.code('k1');
        let copies = 0;
        for (let c = 0; c < api.core; c++) if (!api.inSelf(c) && sameOps(vm.peek(c), k0) && sameOps(vm.peek(c + 1), k1)) copies++;
        if (copies < 2) throw new Error(`${PSB}: only ${copies} paper copies exist`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// opening-qscan-m-88: a decoding '88 quickscan whose decoder adds straight
// into its own carpet instruction, the way the Metcalf and Janeczek
// quickscans on the hill do (written from scratch; the encoding is this
// block's own). Measured on Talisman's body: the hill's quickscan wins about
// as many early races against Talisman as it loses (44/40 of 200 rounds),
// while a decoding quickscan that hands a probe to a separate burst lost
// them 28/45: the cycles between the find and the first bomb decide.
//
//   pair i  CMP lo, lo+GAP        equal: skip the next line (one cycle a pair)
//           second line           a jump into the decoder (below)
//   qMiss   JMP next              nothing differed
//   E(K-1)  ADD @s(K-1), qKil     entering at E_e adds levels e .. 0
//   ...
//   E0      ADD @s0, qKil
//           CMP qBlank, @qKil     the decoded cell is a pair's low cell: if it
//           JMP qLoop             is empty, the high one is the find
//           ADD #GAP, qKil
//   qLoop   MOV qBomb, @qKil      the carpet (probe-carpet-88's loop): a bomb on
//   qKil    MOV qSrc, <B0         the cell and a second write DB-1 above it,
//           SUB #STEP, qKil       through the bomb's own B-field
//           DJN qLoop, #COUNT     then fall into the next block
//   qBomb   DAT <DA, <DB          (a state cell)
//
// Level k has a pointer s_k (the B-field of the second line of pair (k,k),
// a DJN) that points at the second line of pair (k,-), a JMP whose B-field
// is v_k; moved down one cell it points at that pair's CMP, whose B-field
// (the pair's high cell, from the CMP) is w_k. A pair coded (e, d) enters at
// E_e and selects w_d for one level d <= e:
//   (e, -)   JMP E_e, $v_e           adds v_e + ... + v_0
//   (d, d)   DJN E_d, #pointer       moves its own pointer: w_d + v_(d-1) .. v_0
//   (e, d)   JMP E_e, <s_d           v_e .. w_d .. v_0  (d < e)
// so K levels decode K(K+3)/2 pairs: 9, 14 or 20. '88 ADD adds A-fields too,
// so qKil's A-field (the second write's source) ends up an arbitrary cell:
// the second stream copies whatever lies there, nearly always an empty cell,
// as the originals' does. The v_k and qKil's start B0 are searched (seeded)
// for pairs spread over the core, clear of the warrior with their carpets.
const QM = 'opening-qscan-m-88';
function qmStructure(N) {
  let K = 1;
  while ((K * (K + 3)) / 2 < N) K++;
  const pairs = [];
  for (let e = 0; e < K; e++) pairs.push({ e, d: -1 });
  for (let d = 0; d < K; d++) pairs.push({ e: d, d, self: true });
  for (let e = 1; e < K; e++) for (let d = 0; d < e; d++) pairs.push({ e, d });
  return { K, pairs: pairs.slice(0, N) };
}
function qmRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// Indices inside the block (from its first CMP).
const qmIdx = (N, K) => ({ miss: 2 * N, E: (k) => 2 * N + 1 + (K - 1 - k), side: 2 * N + K + 1, loop: 2 * N + K + 4, kil: 2 * N + K + 5, total: 2 * N + K + 8 });
// Every pair's low cell, from qKil, for table entries v and start b.
function qmPositions(P, S, v, b, core) {
  const { K, pairs } = S, N = pairs.length, I = qmIdx(N, K);
  const tIdx = (k) => 2 * pairs.findIndex((p) => p.e === k && p.d === -1);      // CMP of pair (k,-)
  const V = []; v.reduce((acc, x, k) => (V[k] = acc + x), 0);
  // w_k: the B-field of pair (k,-)'s CMP = its high cell, from that CMP.
  const w = Array.from({ length: K }, (_, k) => mod(I.kil + b + V[k] + P.GAP - tIdx(k), core));
  return pairs.map((p) => {
    let sum = 0;
    for (let k = 0; k <= p.e; k++) sum += k === p.d ? w[k] : v[k];
    return mod(b + sum, core);
  });
}
function qmPlan(P, settings) {
  const core = settings.coreSize, S = qmStructure(P.PAIRS), N = S.pairs.length, I = qmIdx(N, S.K);
  const rand = qmRng(P.SEED), room = settings.maxLength;
  const lo = Math.min(-(P.COUNT - 1) * P.STEP, P.DB - 1 - (P.COUNT - 1) * P.STEP), hi = P.GAP + Math.max(0, P.DB - 1);
  let best = null;
  for (let t = 0; t < 4000; t++) {
    const v = Array.from({ length: S.K }, () => Math.floor(rand() * core)), b = Math.floor(rand() * core);
    const pos = qmPositions(P, S, v, b, core);
    // From the block's first CMP: the cell, its carpet, clear of the warrior (room cells either side).
    const abs = pos.map((x) => mod(x + I.kil, core));
    const ok = abs.every((x) => mod(x + lo, core) > room + P.MINDIST && mod(x + hi, core) < core - room - P.MINDIST && mod(x + hi, core) > mod(x + lo, core));
    if (!ok) continue;
    const sorted = [...abs].sort((x, y) => x - y);
    let gap = core;
    for (let i = 1; i < sorted.length; i++) gap = Math.min(gap, sorted[i] - sorted[i - 1]);
    if (!best || gap > best.gap) best = { v, b, pos, gap };
    if (gap >= P.SPREAD) break;
  }
  return best && { ...best, S, I };
}
const opQscanM = {
  id: QM, kind: 'opening', exit: 'next', link: 'fall', processes: 1, writes: 'sparse', entry: 'qScan',
  purpose: "ICWS'88 decoding quickscan with its carpet built in (the Metcalf/Janeczek hill form): PAIRS one-cycle comparisons whose second lines jump into a chain of K decoder ADDs that add table entries kept in the scan's own B-fields straight into the carpet instruction, a two-line side test, then COUNT four-cycle passes of two writes (a DAT <DA, <DB and a copy DB-1 above it through that bomb). 2*PAIRS+K+8 instructions and one data cell; a quiet round hands on after PAIRS+1 cycles.",
  params: { PAIRS: [5, 20], GAP: [2, 4000], COUNT: [2, 20], STEP: [1, 40], DA: [-400, 400], DB: [-200, 200], SEED: [1, 100000], MINDIST: [10, 2000], SPREAD: [20, 2000], BLANK: [100, 54000] },
  defaults: { PAIRS: 18, GAP: 130, COUNT: 9, STEP: 7, DA: -46, DB: 46, SEED: 7, MINDIST: 150, SPREAD: 250, BLANK: 3901 },
  mutable: (P) => {
    const S = qmStructure(P.PAIRS);
    return [['qKil', ['a', 'b']], ['qCount', ['b']], ...S.pairs.map((p, i) => [`qs${i}`, ['b']])];
  },
  knowledge: {
    parameterRoles: {
      PAIRS: 'Comparisons (two cells each). K levels decode K(K+3)/2 pairs.', GAP: 'Between the two cells of a pair.', COUNT: 'Carpet passes.', STEP: 'Between passes, downward.',
      DA: 'Bomb A-field.', DB: 'Bomb B-field: the second write lands DB-1 above the first.', SEED: 'Seeds the search for the table entries.', MINDIST: 'Closest a carpet may come to the warrior.', SPREAD: 'Stop the search once every two pairs are this far apart.',
      BLANK: 'A cell assumed empty, from the side test.',
    },
    tuning: ['A find at pair i bombs about i + e + 5 cycles after the round starts (e+1 ADDs, the side test, the first MOV).', 'The hill\'s quickscans earn their points with the carpet, not the scan: see probe-carpet-88.'],
    failures: ['If BLANK is not empty the side choice can be wrong.', 'An opponent sitting on both cells of a pair (equal, e.g. two empty-looking cells) is not seen.'],
    evidence: ['docs/hill-top10/88.md'],
  },
  mismatches(P, settings) {
    if (Math.abs(P.DB) < 2) return [`${QM}: DB must be at least 2 either way (the second write lands DB-1 from the bomb)`];
    const plan = qmPlan(P, settings);
    if (!plan) return [`${QM}: no table found that keeps every pair and carpet clear of the warrior (SEED ${P.SEED})`];
    if (P.BLANK < settings.maxLength + 50 || P.BLANK > settings.coreSize - settings.maxLength - 50) return [`${QM}: BLANK lies too near the warrior`];
    return [];
  },
  state(ctx) { ctx.ins('qBomb', 'DAT', 'F', `<${ctx.P.DA}`, `<${ctx.P.DB}`); },
  emit(ctx) {
    const { L, P, core } = ctx, plan = qmPlan(P, ctx.settings), { S, I, v, b, pos } = plan, N = S.pairs.length;
    const here = (i) => `${L('qScan')}+${i}`;                      // the block's cell i
    const sLine = (k) => 2 * S.pairs.findIndex((p) => p.self && p.d === k) + 1;
    const tLine = (k) => 2 * S.pairs.findIndex((p) => p.e === k && p.d === -1) + 1;
    S.pairs.forEach((p, i) => {
      const low = mod(pos[i] + I.kil - 2 * i, core);                // from this CMP
      ctx.ins(i ? '' : 'qScan', 'CMP', 'I', `${low}`, `${mod(low + P.GAP, core)}`);
      const E = `${here(I.E(p.e))}`;
      if (p.self) ctx.ins(`qs${i}`, 'DJN', 'B', E, `#${tLine(p.d) - (2 * i + 1)}`);
      else if (p.d < 0) ctx.ins(`qs${i}`, 'JMP', 'B', E, `${v[p.e]}`);
      else ctx.ins(`qs${i}`, 'JMP', 'B', E, `<${here(sLine(p.d))}`);
    });
    ctx.ins('qMiss', 'JMP', 'B', ctx.next);
    for (let k = S.K - 1; k >= 0; k--) ctx.ins(k === S.K - 1 ? 'qDec' : '', 'ADD', 'F', `@${here(sLine(k))}`, L('qKil'));
    ctx.ins('', 'CMP', 'I', `${mod(P.BLANK, core)}`, `@${L('qKil')}`);
    ctx.ins('', 'JMP', 'B', L('qLoop'));
    ctx.ins('', 'ADD', 'AB', `#${P.GAP}`, L('qKil'));
    ctx.ins('qLoop', 'MOV', 'I', L('qBomb'), `@${L('qKil')}`);
    // A starts on a far cell (the second stream's source); B on b, which the decoder completes.
    ctx.ins('qKil', 'MOV', 'I', `${mod(P.BLANK + 37, core)}`, `<${b}`);
    ctx.ins('', 'SUB', 'AB', `#${P.STEP}`, L('qKil'));
    ctx.ins('qCount', 'DJN', 'B', L('qLoop'), `#${P.COUNT}`);
  },
  // The gate's find: something on the high cell of the first pair (the side test must move to it).
  plant(api) {
    const plan = qmPlan(api.P, api.settings);
    return [[api.norm(api.at('qKil') + plan.pos[0] + api.P.GAP), { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 }]];
  },
  watch(api) {
    const { vm, P, core } = api, plan = qmPlan(P, api.settings), K0 = api.at('qKil'), w1 = api.at('qLoop'), miss = api.at('qMiss');
    const bomb = api.code('qBomb'), scan = api.at('qScan'), N = plan.S.pairs.length;
    const isBomb = (x) => x.op === 'DAT' && api.norm(x.a) === api.norm(bomb.a) && x.aMode === bomb.aMode;
    // What the scan should find: the first pair whose cells differ, read when the scan starts.
    let expect = undefined, ones = 0, twos = 0, first = null, start = null, missAt = null, closed = false;
    return {
      before(pc) {
        if (closed) return null;
        if (pc === scan && expect === undefined) {
          start = vm.cycle;
          expect = null;
          for (let i = 0; i < N && expect === null; i++) {
            const lo = api.norm(K0 + plan.pos[i]);
            if (!api.same(vm.peek(lo), vm.peek(lo + P.GAP))) expect = { i, lo };
          }
        }
        if (pc === miss) { missAt = vm.cycle; closed = true; return null; }
        if ((pc === w1 || pc === K0) && vm.peek(pc).op === 'MOV') {
          const p = api.norm(K0 + vm.peek(K0).b);
          if (pc === w1) { first ??= p; return { t: p, pc, one: true }; }
          return { t: api.norm(p + vm.peek(p).b - 1), pc, one: false };
        }
        if (first !== null && !api.inSelf(pc)) closed = true;
        return null;
      },
      after(x) {
        if (!x) return;
        if (api.inImage(x.t) && !api.inDead(x.t)) throw new Error(`${QM} wrote into its own image`);
        if (vm.writerPc[x.t] !== x.pc) throw new Error(`${QM} wrote somewhere other than its pointer said`);
        if (x.one) { if (!isBomb(vm.peek(x.t))) throw new Error(`${QM} dropped something other than its bomb`); ones++; } else twos++;
      },
      final() {
        if (expect === undefined) return;
        if (expect === null) {
          if (ones + twos) throw new Error(`${QM} bombed although no pair differed`);
          if (missAt !== null && missAt - start !== N) throw new Error(`${QM}: a quiet scan took ${missAt - start} cycles, not ${N}`);
          return;
        }
        if (first !== expect.lo && first !== api.norm(expect.lo + P.GAP)) throw new Error(`${QM}: the carpet did not start on pair ${expect.i}`);
        if (ones !== P.COUNT || twos !== P.COUNT) throw new Error(`${QM} made ${ones} + ${twos} writes, not ${P.COUNT} + ${P.COUNT}`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// cannonade-pump-88: Freight Train's body. A Cannonade-style stone, an
// N-point imp spiral launched by vector, and two continuous pumps that keep
// growing it:
//
//   bGo    SPL lGo, cHead+3       the fan's B-fields count the templates down:
//          SPL 1, cHead+3         pump 1, pump 2, stone (pumps first, so they
//          SPL 1, sMov+4          are whole before cGo starts them); four ...
//          MOV <bGo, <bC1         ... processes copy pump 1,
//          MOV <bGo+1, <bC2       pump 2
//          MOV <bGo+2, <bSd       and the stone (a cell each)
//   bSd    DJN s0+1, #s0+4        and enter the stone at its SPL
//   lGo    SPL cGo                the launch: one process places the seed,
//          SPL 1 (LK of them)     2^LK processes ...
//          SPL 2                  ... half jump, half add:
//   lJmp   JMP @0, P              2^LK imps on consecutive spiral points
//          ADD #S, lJmp           (S = modInverse(N, core))
//          JMP s0+1               and the adders join the stone
//   cGo    MOV iImp, P            the seed the first imp runs
//          MOV sBomb, s0+DD       the bomb that ends the stone
//   bC1    SPL c1, c1+3           start pump 1 (its B-field: the copy counter)
//          MOV #v2, c2+2          aim pump 2
//   bC2    JMP c2, c2+3           and become it
//   cHead  SPL 0 / ADD #S+1, 1 / JMP @0, v      the pump template
//   iImp   MOV 0, S
//   sMov   MOV <src, tgt          the stone: SPL -1 forks a MOV a pass; the ADD
//   sSpl   SPL -1, <2-STEP        adds the DJN's own fields (-2, -STEP) to the
//   sAdd   ADD 1, -2              MOV, so its source walks down two cells and
//   sDjn   DJN -2, <-STEP         its target STEP cells a pass
//   sBomb  DAT <AI, <1            (AI = the 3-point imp step)
//
// The MOV's source starts DD+1+2*TIME above it and its target 3+STEP*TIME:
// pass TIME copies the bomb (DD past the stone) onto the DJN. Then processes
// that reach the DJN die, and the ADD adds the bomb's fields instead: the
// target moves up one cell a pass, a forward clear fed by the SPL, and the
// source jumps AI cells a pass, decrementing B-fields one imp step apart.
const CP = 'cannonade-pump-88';
function cpGeom(P, core) {
  const S = modInverse(P.N, core), L = 2 ** P.LK;
  return { S, L };
}
const cannonadePump = {
  id: CP, kind: 'body', exit: 'never', processes: 1, grows: true, writes: 'sparse', roams: true, moves: true, entry: 'bGo',
  purpose: "ICWS'88 Cannonade-style stone with a vector-launched N-point imp spiral and two continuous pumps (Freight Train): four processes copy the four-line stone and two three-line pumps, a launch branch puts 2^LK imps on consecutive spiral points and 2^LK more processes into the stone, and a third process seeds the spiral, places the stone's end bomb and starts both pumps. At pass TIME the stone copies that bomb onto its own DJN and becomes a forward clear.",
  params: { N: [3, 13], LK: [1, 4], STEP: [2, 54000], TIME: [100, 20000], DD: [5, 30], SHOP: [200, 54000], C1HOP: [200, 54000], C2HOP: [200, 54000], PHOP: [200, 54000], O1: [0, 54000], O2: [0, 54000] },
  defaults: { N: 7, LK: 3, STEP: 82, TIME: 2437, DD: 7, SHOP: 1510, C1HOP: 2014, C2HOP: 6518, PHOP: 7000, O1: 1, O2: 2 },
  mutable: [['bGo', ['b']], ['bGo1', ['b']], ['bGo2', ['b']], ['bSd', ['b']], ['bC1', ['b']], ['bC2', ['b']], ['lJmp', ['b']]],
  knowledge: {
    parameterRoles: {
      N: 'Spiral points (Freight Train: 7, step 1143).', LK: '2^LK imps launched at once, and as many extra stone processes.', STEP: 'Stone target step (downward).', TIME: 'Passes before the stone copies its end bomb onto its DJN.', DD: 'End bomb, from the stone.',
      SHOP: 'Stone copy, from the block start.', C1HOP: 'Pump 1 copy, from the block start.', C2HOP: 'Pump 2 copy.', PHOP: 'The spiral seed, from the block start.',
      O1: 'Pump 1\'s first launch, from the seed, counted in spiral cells beyond the vector launch.', O2: 'The same for pump 2.',
    },
    tuning: ['The stone forks a process every pass through its SPL, so it fills the table: its passes slow as it grows.'],
    failures: ['The stone\'s source walk decrements every other cell from DD+1 to DD+1+2*TIME above it, pumps included, late in the stone\'s life.'],
    evidence: ['docs/hill-top10/88.md'],
  },
  mismatches(P, settings) {
    const core = settings.coreSize, room = settings.maxLength, out = [], G = cpGeom(P, core);
    if (!G.S) return [`${CP}: no ${P.N}-point spiral on a ${core}-cell core`];
    const near = (d, r) => mod(d, core) < r || mod(d, core) > core - r;
    for (const [h, w] of [[P.SHOP, 'stone'], [P.C1HOP, 'pump 1'], [P.C2HOP, 'pump 2'], [P.PHOP, 'seed']]) if (near(h, room + 40)) out.push(`${CP}: the ${w} lands on the warrior`);
    const parts = [[P.SHOP, P.DD + 1], [P.C1HOP, 3], [P.C2HOP, 3]];
    for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) if (near(parts[i][0] - parts[j][0], 12)) out.push(`${CP}: two copies overlap`);
    // Target of pass k (from the stone's MOV): 3 + STEP*(TIME-k); before TIME it must miss the stone,
    // its end bomb and both pumps.
    const own = [[0, 3], [P.DD, P.DD], [P.C1HOP - P.SHOP, P.C1HOP - P.SHOP + 2], [P.C2HOP - P.SHOP, P.C2HOP - P.SHOP + 2]];
    for (let k = 0; k < P.TIME; k++) {
      const t = mod(3 + P.STEP * (P.TIME - k), core);
      if (own.some(([a, b]) => within(t, a, b, core))) { out.push(`${CP}: pass ${k} of ${P.TIME} bombs the stone, its bomb or a pump`); break; }
    }
    if (settings.maxProcesses < 200) out.push(`${CP}: too few processes`);
    return [...new Set(out)];
  },
  linked(P, settings, at, { total, shiftedFrame }) {
    if (shiftedFrame) return [];
    const core = settings.coreSize, out = [], G = cpGeom(P, core), inImage = (x) => mod(x, core) < total;
    const b = at('bGo');
    for (const [h, n, w] of [[P.SHOP, P.DD + 1, 'stone'], [P.C1HOP, 3, 'pump 1'], [P.C2HOP, 3, 'pump 2']]) for (let i = -1; i <= n; i++) if (inImage(b + h + i)) { out.push(`${CP}: the ${w} copy lands on the original image`); break; }
    for (let j = 0; j < G.L; j++) if (inImage(b + P.PHOP + j * G.S) || inImage(b + P.PHOP + j * G.S + 1)) { out.push(`${CP}: a spiral point lands on the original image`); break; }
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, G = cpGeom(P, core), b = L('bGo');
    const s0 = `${b}+${P.SHOP}`, c1 = `${b}+${P.C1HOP}`, c2 = `${b}+${P.C2HOP}`, seed = `${b}+${P.PHOP}`;
    // The fan's B-fields count the templates down; the pumps are copied first, so they are
    // complete before cGo starts them.
    ctx.ins('bGo', 'SPL', 'B', L('lGo'), `${L('cHead')}+3`);
    ctx.ins('bGo1', 'SPL', 'B', '1', `${L('cHead')}+3`);
    ctx.ins('bGo2', 'SPL', 'B', '1', `${L('sMov')}+4`);
    ctx.ins('', 'MOV', 'I', `<${b}`, `<${L('bC1')}`);
    ctx.ins('', 'MOV', 'I', `<${L('bGo1')}`, `<${L('bC2')}`);
    ctx.ins('', 'MOV', 'I', `<${L('bGo2')}`, `<${L('bSd')}`);
    ctx.ins('bSd', 'DJN', 'B', `${s0}+1`, `#${s0}+4-${L('bSd')}`);
    ctx.ins('lGo', 'SPL', 'B', L('cGo'), '0');
    for (let i = 0; i < P.LK; i++) ctx.ins('', 'SPL', 'B', '1', '0');
    ctx.ins('', 'SPL', 'B', '2', '0');
    ctx.ins('lJmp', 'JMP', 'B', '@0', seed);
    ctx.ins('', 'ADD', 'AB', `#${G.S}`, L('lJmp'));
    ctx.ins('', 'JMP', 'B', `${s0}+1`);
    // Pump k's first launch (after one ADD) lands O_k cells past the 2^LK-th spiral point.
    const first = (o) => `${seed}+${mod(G.L * G.S + o, core)}`;
    ctx.ins('cGo', 'MOV', 'I', L('iImp'), seed);
    ctx.ins('', 'MOV', 'I', L('sBomb'), `${s0}+${P.DD}`);
    ctx.ins('bC1', 'SPL', 'B', c1, `${c1}+3`);
    ctx.ins('', 'MOV', 'AB', `#(${first(P.O2)})-(${c2}+2)-${G.S + 1}`, `${c2}+2`);
    ctx.ins('bC2', 'JMP', 'B', c2, `${c2}+3`);
    // The pump template; its JMP is aimed for its first copy (pump 1); pump 2 is re-aimed by cGo.
    ctx.ins('cHead', 'SPL', 'B', '0', '0');
    ctx.ins('cAdd', 'ADD', 'AB', `#${G.S + 1}`, L('cJmp'));
    ctx.ins('cJmp', 'JMP', 'B', '@0', `(${first(P.O1)})-(${c1}+2)-${G.S + 1}`);
    ctx.ins('iImp', 'MOV', 'I', '0', `${G.S}`);
    ctx.ins('sMov', 'MOV', 'I', `<${P.DD + 1 + 2 * P.TIME}`, `${mod(3 + P.STEP * P.TIME, core)}`);
    ctx.ins('sSpl', 'SPL', 'B', '-1', `<${mod(2 - P.STEP, core)}`);
    ctx.ins('sAdd', 'ADD', 'F', '1', '-2');
    ctx.ins('sDjn', 'DJN', 'B', '-2', `<${mod(-P.STEP, core)}`);
    // Its A-field decrements cells a 3-point imp step apart (the spiral's own step where no 3-point ring exists).
    ctx.ins('sBomb', 'DAT', 'F', `<${modInverse(3, core) || G.S}`, '<1');
  },
  running(api) {
    const s0 = api.norm(api.at('bGo') + api.P.SHOP), imp = api.code('iImp');
    return api.vm.processes(0).some((q) => api.norm(q - s0) < 3 || api.same(api.vm.peek(q), imp));
  },
  watch(api) {
    const { vm, P, core } = api, G = cpGeom(P, core), b = api.at('bGo');
    const s0 = api.norm(b + P.SHOP), c1 = api.norm(b + P.C1HOP), c2 = api.norm(b + P.C2HOP), seed = api.norm(b + P.PHOP);
    const stoneL = ['sMov', 'sSpl', 'sAdd', 'sDjn'], pumpL = ['cHead', 'cAdd', 'cJmp'];
    const copyOk = (base, labels) => labels.every((l, i) => { const x = vm.peek(base + i), y = api.code(l); return sameOps(x, y) && api.norm(x.a) === api.norm(y.a); });
    const imp = api.code('iImp'), sMov = s0, sDjn = api.norm(s0 + 3);
    let checked = false, stoneSeen = false, pump2Seen = false, passes = 0, ended = false, broken = false, launches = 0, clearWrites = 0;
    const cJ1 = api.norm(c1 + 2), cJ2 = api.norm(c2 + 2);
    return {
      before(pc) {
        // Each copy is checked as it is entered: the stone is copied last.
        if (pc === api.at('bSd') && !stoneSeen) { stoneSeen = true; if (!copyOk(s0, stoneL)) throw new Error(`${CP}: the stone copy is not the stone`); }
        if (pc === api.at('bC2') && !pump2Seen) { pump2Seen = true; if (!copyOk(c2, pumpL)) throw new Error(`${CP}: pump 2 is not the pump`); }
        if (pc === api.at('bC1') && !checked) {
          checked = true;
          if (!copyOk(c1, pumpL)) throw new Error(`${CP}: pump 1 is not the pump`);
          if (!api.same(vm.peek(seed), imp)) throw new Error(`${CP}: the spiral seed is missing`);
          if (!api.same(vm.peek(s0 + P.DD), api.code('sBomb'))) throw new Error(`${CP}: the end bomb is not DD past the stone`);
        }
        if (pc === sMov && !broken) {
          // The MOV's fields move every pass; the SPL and ADD must be intact.
          if (!sameOps(vm.peek(s0), api.code('sMov')) || !copyOk(s0 + 1, stoneL.slice(1, 3))) { broken = true; return null; }
          return { t: api.norm(sMov + vm.peek(sMov).b), djnWas: vm.peek(sDjn).op };
        }
        if ((pc === cJ1 || pc === cJ2) && vm.peek(pc).op === 'JMP') launches++;
        return null;
      },
      after(t) {
        if (!t) return;
        if (t.djnWas === 'DJN' && t.t === sDjn) {
          if (api.alone && Math.abs(passes - P.TIME) > 2) throw new Error(`${CP}: the stone bombed its DJN after ${passes} passes, not ${P.TIME}`);
          ended = true;
          return;
        }
        if (t.djnWas === 'DJN') {
          passes++;
          if (within(t.t, s0, s0 + 3, core)) throw new Error(`${CP}: the stone bombed itself before TIME`);
        } else clearWrites++;
      },
      final() {
        if (!api.entered() || !api.alone) return;
        if (!checked) throw new Error(`${CP}: the pumps were never started`);
        if (passes < Math.min(300, P.TIME)) throw new Error(`${CP}: the stone made only ${passes} passes`);
        if (launches < 20) throw new Error(`${CP}: the pumps launched only ${launches} imps`);
        const imps = vm.processes(0).filter((q) => api.same(vm.peek(q), imp)).length;
        if (imps < P.N) throw new Error(`${CP}: only ${imps} imps are alive`);
        void ended; void clearWrites;
      },
    };
  },
};

// ---------------------------------------------------------------------------
// blitz-stone-spiral-88: Der Zweite Blitzkrieg's body. A mod-g stone that
// turns itself into a two-pass clear, and a one-pass vector spiral:
//
//   bGo    SPL lGo                the launch branch (below)
//          MOV tGate, gate        lay the clear's parts at the copy site: its
//          MOV tSplit, mov-SRC-1  gate, the SPL the stone will copy onto its own
//          MOV #-PTR-1, ptr       JMP, and the clear's source pointer
//          SPL 1 / MOV -1, 0 / SPL 1      six processes
//          MOV <bSrc, <bDst       copy the six-line stone
//   bDst   JMP @0, h+6            and enter it at its head
//   lGo    MOV iImp, P            the spiral's seed and the stone's increment
//          MOV sInc, sub+INCR
//          fan to 2^K - 1 processes, then SPL 2: half jump, half add
//   lJmp   JMP @0, P              2^K - 1 imps on consecutive N-point spiral cells
//          ADD #D, lJmp
//   sInc   DAT #C, #-C            the adders die here
//   head   SPL 0, <GVAL           the stone (copied to h):
//   sub    SUB INCR, 1            the MOV's A-field walks down C a pass, its
//   mov    MOV <-SRC, 1           B-field up C: it copies the cell under a
//   jmp    JMP -2, <gate          decrement stream onto a cell C further on
//   cMov   MOV @PTR, <inc         the clear, reached when the JMP is replaced
//   cJmp   JMP -1, <GVAL-2
//
// The stone's targets are mov + 1 + k*C, every g-th cell (g = gcd(C, core));
// after core/g passes the target comes back to mov + 1, its own JMP, and the
// source to mov - SRC, where the predecrement reads the SPL laid one cell
// below: the JMP becomes SPL 0, the processes fall through into the clear,
// which copies @PTR (the new SPL, then, once its pointer cell is cleared,
// the gate DAT) downward from below the increment: an SPL pass, a DAT pass,
// then the DAT gate stays.
const BZ = 'blitz-stone-spiral-88';
const gcdOf = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
function bzGeom(P, core) {
  const D = modInverse(P.N, core), g = gcdOf(P.C, core), imps = 2 ** P.K - 1;
  // Offsets from the copy's head h: sub h+1, mov h+2, jmp h+3, cMov h+4, cJmp h+5.
  const gate = 4 + P.PTR + P.GVAL, split = 2 - P.SRC - 1, ptr = 4 + P.PTR, inc = 1 + P.INCR;
  return { D, g, imps, gate, split, ptr, inc };
}
const blitzStoneSpiral = {
  id: BZ, kind: 'body', exit: 'never', processes: 1, grows: true, writes: 'core', roams: true, moves: true, entry: 'bGo',
  purpose: "ICWS'88 stone/spiral (Der Zweite Blitzkrieg): six processes boot a mod-g stone that copies cells under a decrement stream C cells apart; after core/g passes it copies a prepared SPL onto its own JMP and falls into a two-pass (SPL, then DAT) clear that ends as a gate. Meanwhile 2^K-1 imps are launched in one pass onto an N-point spiral.",
  params: { N: [3, 13], K: [2, 5], C: [8, 27000], GVAL: [-60, -2], INCR: [7, 60], PTR: [-60, -6], SRC: [6, 60], SHOP: [200, 54000], PHOP: [200, 54000] },
  defaults: { N: 7, K: 4, C: 328, GVAL: -19, INCR: 20, PTR: -11, SRC: 19, SHOP: 3405, PHOP: 1232 },
  mutable: [['bDst', ['b']], ['bSrc', ['b']], ['lJmp', ['b']]],
  knowledge: {
    parameterRoles: {
      N: 'Spiral points (7: step 1143).', K: '2^K-1 imps in one pass.', C: 'Stone step; gcd(C, core) is the grain g and core/g passes the stone\'s life (328 on 8000: g 8, 1000 passes).',
      GVAL: 'The stone head\'s decrement offset, and the gate\'s.', INCR: 'The increment cell, from the SUB.', PTR: 'The clear\'s source pointer cell, from the clear MOV.', SRC: 'The stone MOV\'s source offset; the SPL it copies at the end sits one below.',
      SHOP: 'Stone copy, from the stone template.', PHOP: 'Spiral seed, from the imp template.',
    },
    tuning: ['Targets are every g-th cell on one residue, so the stone never touches its own residue classes until it means to.'],
    failures: ['The spiral is launched once and never fed; imps that die are not replaced.'],
    evidence: ['docs/hill-top10/88.md'],
  },
  mismatches(P, settings) {
    const core = settings.coreSize, room = settings.maxLength, out = [], G = bzGeom(P, core);
    if (!G.D) return [`${BZ}: no ${P.N}-point spiral on a ${core}-cell core`];
    if (G.g < 4) out.push(`${BZ}: C shares only ${G.g} with the core; the stone needs a grain to miss its own parts`);
    // Targets: mov + 1 (mod g); the source stream: mov - SRC (mod g). Offsets from mov = h+2.
    const parts = [[G.gate, 'gate'], [G.split, 'SPL'], [G.ptr, 'pointer cell'], [G.inc, 'increment'], ...[0, 1, 3, 4, 5].map((o) => [o, 'stone'])];
    for (const [o, w] of parts) {
      if (mod(o - 2 - 1, G.g) === 0 && o !== 3) out.push(`${BZ}: the stone's targets hit its ${w}`);
      if (mod(o - 2 + P.SRC, G.g) === 0 && o !== G.split + 1 && o !== 2 - P.SRC) out.push(`${BZ}: the stone's decrement stream hits its ${w}`);
    }
    if (mod(P.SHOP, core) < room + 70 || mod(P.SHOP, core) > core - room - 70) out.push(`${BZ}: the stone copy lands on the warrior`);
    if (settings.maxProcesses < 100) out.push(`${BZ}: too few processes`);
    return [...new Set(out)];
  },
  linked(P, settings, at, { total, shiftedFrame }) {
    if (shiftedFrame) return [];
    const core = settings.coreSize, G = bzGeom(P, core), out = [], inImage = (x) => mod(x, core) < total;
    const h = at('head') + P.SHOP;
    for (const o of [-1, 0, 1, 2, 3, 4, 5, 6, G.gate, G.split, G.ptr, G.inc]) if (inImage(h + o)) { out.push(`${BZ}: the stone copy or its parts land on the original image`); break; }
    for (let j = 0; j < G.imps; j++) if (inImage(at('iImp') + P.PHOP + j * G.D)) { out.push(`${BZ}: a spiral cell lands on the original image`); break; }
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, G = bzGeom(P, core), h = `${L('head')}+${P.SHOP}`, seed = `${L('iImp')}+${P.PHOP}`;
    ctx.ins('bGo', 'SPL', 'B', L('lGo'), '0');
    ctx.ins('', 'MOV', 'I', L('tGate'), `${h}+${G.gate}`);
    ctx.ins('', 'MOV', 'I', L('head'), `${h}+${G.split}`);
    ctx.ins('', 'MOV', 'AB', `#${-P.PTR - 1}`, `${h}+${G.ptr}`);
    emitFan(ctx, 6, 'bFan');
    ctx.ins('', 'MOV', 'I', `<${L('bSrc')}`, `<${L('bDst')}`);
    ctx.ins('bDst', 'JMP', 'B', '@0', `${h}+6`);
    ctx.ins('lGo', 'MOV', 'I', L('iImp'), seed);
    ctx.ins('', 'MOV', 'I', L('sInc'), `${h}+${G.inc}`);
    emitFan(ctx, G.imps, 'lFan');
    ctx.ins('', 'SPL', 'B', '2', '0');
    ctx.ins('lJmp', 'JMP', 'B', '@0', seed);
    ctx.ins('', 'ADD', 'AB', `#${G.D}`, L('lJmp'));
    ctx.ins('sInc', 'DAT', 'F', `#${P.C}`, `#${-P.C}`);
    ctx.ins('bSrc', 'DAT', 'F', '#0', `#${L('head')}+6-${L('bSrc')}`);
    ctx.ins('tGate', 'DAT', 'F', `<${P.GVAL - 1}`, '#0');
    ctx.ins('iImp', 'MOV', 'I', '0', `${G.D}`);
    ctx.ins('head', 'SPL', 'B', '0', `<${P.GVAL}`);
    ctx.ins('sub', 'SUB', 'F', `${P.INCR}`, '1');
    ctx.ins('mov', 'MOV', 'I', `<${-P.SRC}`, '1');
    ctx.ins('jmp', 'JMP', 'B', '-2', `<${-3 + P.GVAL}`);
    ctx.ins('cMov', 'MOV', 'I', `@${P.PTR}`, `<${P.INCR - 3}`);
    ctx.ins('cJmp', 'JMP', 'B', '-1', `<${P.GVAL - 2}`);
  },
  running(api) {
    const h = api.norm(api.at('head') + api.P.SHOP), imp = api.code('iImp');
    return api.vm.processes(0).some((q) => api.norm(q - h) < 6 || api.same(api.vm.peek(q), imp) || api.vm.peek(q).op === 'SPL');
  },
  watch(api) {
    const { vm, P, core } = api, G = bzGeom(P, core), h = api.norm(api.at('head') + P.SHOP);
    const stoneL = ['head', 'sub', 'mov', 'jmp', 'cMov', 'cJmp'], imp = api.code('iImp'), mov = api.norm(h + 2), jmpC = api.norm(h + 3), lJmp = api.at('lJmp');
    const copyOk = () => stoneL.every((l, i) => { const x = vm.peek(h + i), y = api.code(l); return sameOps(x, y) && (l === 'mov' || api.norm(x.a) === api.norm(y.a)); });
    let entered = 0, launches = 0, passes = 0, turned = false, clearWrites = 0, broken = false;
    const bDst = api.at('bDst'), cMov = api.norm(h + 4);
    return {
      before(pc) {
        if (pc === bDst && entered < 6) { if (!entered && !copyOk()) throw new Error(`${BZ}: the stone copy is not the stone`); entered++; return null; }
        if (pc === lJmp && launches < G.imps) { launches++; return null; }
        if (pc === mov && !broken && !turned) {
          if (vm.peek(jmpC).op !== 'JMP') { turned = true; return null; }
          return { t: api.norm(mov + vm.peek(mov).b) };
        }
        if (pc === cMov && turned) return { c: true };
        return null;
      },
      after(t) {
        if (!t) return;
        if (t.c) { clearWrites++; return; }
        passes++;
        if (t.t === jmpC) {
          if (vm.peek(jmpC).op !== 'SPL') throw new Error(`${BZ}: the stone's end did not lay an SPL on its JMP`);
          // (Its MOV runs core/g times by then, less any run a process lost between the SUB and the MOV.)
          if (api.alone && passes < core / G.g / 2) throw new Error(`${BZ}: the stone hit its JMP after only ${passes} passes`);
          turned = true;
          return;
        }
        if (within(t.t, h, api.norm(h + 5), core)) throw new Error(`${BZ}: the stone bombed itself`);
      },
      final() {
        if (!api.entered() || !api.alone) return;
        if (entered !== 6) throw new Error(`${BZ}: ${entered} processes entered the stone, not 6`);
        if (launches !== G.imps) throw new Error(`${BZ}: ${launches} imps were launched, not ${G.imps}`);
        if (vm.cycle > 60000 && !turned) throw new Error(`${BZ}: the stone never turned into its clear`);
        if (turned && clearWrites < 200) throw new Error(`${BZ}: the clear wrote only ${clearWrites} cells`);
        const imps = vm.processes(0).filter((q) => api.same(vm.peek(q), imp)).length;
        // Alone the clear and the gate thin the spiral too: Der Zweite Blitzkrieg itself ends with six,
        // and a 13-point spiral on the 25,200 core with fewer.
        if (imps < 2) throw new Error(`${BZ}: only ${imps} imps are alive`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// stone-loop-paper-88: Zygote's body, with no boot. PROCS SPLs put PROCS
// processes into a pair-bombing stone where it stands, then a fan of seven
// runs a seven-cell looping paper in lockstep:
//
//   go     SPL sHead (PROCS of them)
//          SPL 1 / SPL 1 / MOV -1, 0      seven processes
//   pAdd   ADD #7, pPtr      B-field: first the offset to pPtr, then the copy
//   pCpy   MOV <pAdd, <pSpl  counter. Seven MOVs copy pBomb .. pAdd (counting
//   pSpl   SPL @0, STEP      pAdd's B-field down to 0) STEP on, and seven SPLs
//   pRow   MOV pBomb, <pSpl  start a process each in the copy; seven bombs go
//   pStr   MOV pBomb, <pPtr  on the cells just below it, seven more down a
//   pJmz   JMZ pAdd, pAdd    stream from pPtr; the counter is 0, so loop. Next
//   pBomb  DAT <BA, <BB      time round the first ADD lands on pAdd itself and
//   pPtr   DAT #0, #PSTART   re-arms it to 7; the other six move the stream on.
//   (pad)                    two empty cells, then the stone:
//   sHead  SPL 0 / MOV sB, <FIRST / MOV sB, @-1 / ADD #STEP, -2 / DJN -3, <STREAM
//   sBomb  DAT <SA, #SB
//
// Each loop the copy lands 14 cells below the last (seven cells, seven bombs
// under them), so a paper lays a march of copies and bombs, and every copy
// runs the same loop with its own seven processes.
const ZY = 'stone-loop-paper-88';
const stoneLoopPaper = {
  id: ZY, kind: 'body', exit: 'never', processes: 1, grows: true, writes: 'sparse', roams: true, entry: 'go',
  purpose: "ICWS'88 in-place stone and looping paper (Zygote): PROCS SPLs start a pair-bombing stone where it stands, and seven processes in lockstep run a seven-cell paper that, every loop, copies itself STEP on (14 cells below the last copy), starts seven processes there, bombs the seven cells under the copy and runs a seven-bomb stream; a counter in its first ADD re-arms itself.",
  params: { PROCS: [2, 9], STEP: [200, 54000], PSTART: [200, 54000], BA: [-54000, 54000], BB: [-54000, 54000], SSTEP: [2, 54000], FIRST: [50, 54000], STREAM: [8, 54000], SA: [-200, 200], SB: [-200, 200], GAP: [0, 10] },
  defaults: { PROCS: 7, STEP: 7349, PSTART: 7742, BA: 2667, BB: 5334, SSTEP: 7893, FIRST: 4977, STREAM: 2350, SA: 1, SB: 17, GAP: 4 },
  mutable: [['pAdd', ['b']], ['pSpl', ['b']], ['pPtr', ['b']], ['sHit', ['b']], ['sBomb', ['b']]],
  knowledge: {
    parameterRoles: {
      PROCS: 'Stone processes (Zygote: 7).', STEP: 'Where the paper\'s first copy lands, from its SPL; later copies come 14 cells lower each loop.', PSTART: 'The bomb stream\'s pointer, from its cell.',
      BA: 'Paper bomb A-field (Zygote: 2667, an anti-imp decrement).', BB: 'Paper bomb B-field.', SSTEP: 'Stone step (Zygote: -107).', FIRST: 'Stone pointer start, from its first MOV.', STREAM: 'Stone DJN stream pointer.',
      SA: 'Stone bomb A-field (a predecrement).', SB: 'Stone bomb B-field (immediate).', GAP: 'Empty cells between the paper\'s pointer and the stone.',
    },
    tuning: ['Nothing is booted: the stone and the paper run in the image, so the quickscan and padding that follow them are what a scanner finds first.'],
    failures: ['The stone is not layout-safe: with step -107 it reaches its own cells after about 1,170 passes.'],
    evidence: ['docs/hill-top10/88.md'],
  },
  mismatches(P, settings) {
    const core = settings.coreSize, room = settings.maxLength, out = [];
    const near = (d, r) => mod(d, core) < r || mod(d, core) > core - r;
    if (near(P.STEP, room + 40)) out.push(`${ZY}: the paper's first copy lands on the warrior`);
    if (near(P.FIRST, room + 4)) out.push(`${ZY}: the stone's first bombs land on the warrior`);
    if (settings.maxProcesses < 100) out.push(`${ZY}: too few processes`);
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx;
    for (let i = 0; i < P.PROCS; i++) ctx.ins(i ? '' : 'go', 'SPL', 'B', L('sHead'), '0');
    emitFan(ctx, 7, 'pFan');
    ctx.ins('pAdd', 'ADD', 'AB', '#7', L('pPtr'));
    ctx.ins('pCpy', 'MOV', 'I', `<${L('pAdd')}`, `<${L('pSpl')}`);
    ctx.ins('pSpl', 'SPL', 'B', '@0', `${mod(P.STEP, core)}`);
    ctx.ins('pRow', 'MOV', 'I', L('pBomb'), `<${L('pSpl')}`);
    ctx.ins('pStr', 'MOV', 'I', L('pBomb'), `<${L('pPtr')}`);
    ctx.ins('pJmz', 'JMZ', 'B', L('pAdd'), L('pAdd'));
    ctx.ins('pBomb', 'DAT', 'F', `<${P.BA}`, `<${P.BB}`);
    ctx.ins('pPtr', 'DAT', 'F', '#0', `#${mod(P.PSTART, core)}`);
    for (let i = 0; i < P.GAP; i++) ctx.ins('', 'DAT', 'F', '#0', '#0');
    ctx.ins('sHead', 'SPL', 'B', '0', '0');
    ctx.ins('sHit', 'MOV', 'I', L('sBomb'), `<${mod(P.FIRST, core)}`);
    ctx.ins('sTwo', 'MOV', 'I', L('sBomb'), `@${L('sHit')}`);
    ctx.ins('sAdd', 'ADD', 'AB', `#${mod(P.SSTEP, core)}`, L('sHit'));
    ctx.ins('sDjn', 'DJN', 'B', L('sHit'), `<${P.STREAM}`);
    ctx.ins('', 'DAT', 'F', '#0', '#0');
    ctx.ins('', 'DAT', 'F', '#0', '#0');
    ctx.ins('sBomb', 'DAT', 'F', `<${P.SA}`, `#${P.SB}`);
  },
  running(api) {
    const add = api.code('pAdd'), cpy = api.code('pCpy');
    return api.vm.processes(0).some((q) => api.inSelf(q) || sameOps(api.vm.peek(q), add) || sameOps(api.vm.peek(q), cpy));
  },
  watch(api) {
    const { vm, P } = api, pSpl = api.at('pSpl'), sTwo = api.at('sTwo'), sHit = api.at('sHit'), pAdd = api.at('pAdd');
    const paperL = ['pAdd', 'pCpy', 'pSpl', 'pRow', 'pStr', 'pJmz', 'pBomb'];
    let spawns = 0, firstCopy = null, bombs = 0, stoneDone = false;
    return {
      before(pc) {
        if (pc === pSpl && spawns < 7 && vm.peek(pc).op === 'SPL') {
          const dst = api.norm(pc + vm.peek(pc).b);
          if (!spawns) {
            firstCopy = dst;
            if (dst !== api.norm(pSpl + P.STEP - 7)) throw new Error(`${ZY}: the paper's first copy is not STEP-7 past its SPL`);
            paperL.forEach((l, i) => { const x = vm.peek(dst + i), y = api.code(l); if (!sameOps(x, y) || api.norm(x.a) !== api.norm(y.a)) throw new Error(`${ZY}: the paper's copy is not the paper`); });
          }
          spawns++;
          return null;
        }
        if (pc === sTwo && !stoneDone) {
          if (!sameOps(vm.peek(sHit), api.code('sHit')) || !sameOps(vm.peek(sTwo), api.code('sTwo'))) { stoneDone = true; return null; }
          return { t: api.norm(sHit + vm.peek(sHit).b) };
        }
        return null;
      },
      after(t) { if (t && vm.peek(t.t).op === 'DAT') bombs++; },
      final() {
        if (!api.entered() || !api.alone) return;
        if (spawns !== 7) throw new Error(`${ZY}: the paper started ${spawns} processes in its first copy, not 7`);
        if (bombs < 100) throw new Error(`${ZY}: the stone dropped only ${bombs} bombs`);
        const add = api.code('pAdd'), cpy = api.code('pCpy');
        let copies = 0;
        for (let c = 0; c < api.core; c++) if (!api.inSelf(c) && sameOps(vm.peek(c), add) && sameOps(vm.peek(c + 1), cpy)) copies++;
        if (copies < 3) throw new Error(`${ZY}: only ${copies} paper copies exist`);
        void firstCopy; void pAdd;
      },
    };
  },
};

// ---------------------------------------------------------------------------
// oneshot-88: Mountain Viper's body. A 0.66c comparison scanner whose
// increment is the jump into its clear, booted away with the clear STEP cells
// past it; the boot process dies so nothing live stays in the image:
//
//   sScan  SUB sInc, sLook        move both pointers STEP
//   sLook  CMP FIRST+GAP, FIRST   equal: skip the jump
//   sInc   JMP STEP, STEP         differ: into the clear, STEP cells on (its
//   sDjn   DJN sScan, @sLook      fields are the increment); the DJN decrements
//   sLast  JMP sScan              the scanned cell: three cycles for two cells
//   cRef   DAT #0, #2             the clear (its first cell is STEP past sInc):
//   cGo    MOV sLook, @cMov1      the scan line, carrying the find, becomes the
//   cSpl   SPL 0, <-GATE          clear's pointer cell (cPtr, GATE past cGo);
//   cMov1  MOV @cRef, <cPtr       then, fed by the SPL, @cRef (the SPL itself)
//   cMov2  MOV @cRef, <cPtr       is laid downward from beside the find
//   cDjn   DJN cMov1, <STREAM
//   kill   DAT <-GATE-1, #0       (laid GATE+1 below cRef)
//
// When the clear comes round to its own pointer cell it writes the SPL there;
// the pointer's B-field becomes -GATE, so the next write skips the clear and
// lands on cRef, whose B-field now aims @cRef at the kill DAT: the SPL pass
// is followed by a DAT pass, with the SPL's decrement a gate below the clear.
const OS = 'oneshot-88';
const OS_SCAN = ['sScan', 'sLook', 'sInc', 'sDjn', 'sLast'], OS_CLEAR = ['cRef', 'cGo', 'cSpl', 'cMov1', 'cMov2', 'cDjn'];
const oneshot88 = {
  id: OS, kind: 'body', exit: 'never', processes: 1, grows: true, writes: 'core', roams: true, moves: true, entry: 'bS',
  purpose: "ICWS'88 one-shot (Mountain Viper): a 0.66c comparison scanner booted HOP away, whose increment line is its jump into a clear STEP cells further on; the clear takes the scan line as its pointer, lays SPL 0 downward from beside the find and, after a lap, switches its source to a DAT through its own pointer for the kill pass, with a decrement gate below it. The boot process dies.",
  params: { STEP: [3, 200], GAP: [2, 100], FIRST: [200, 54000], GATE: [5, 30], STREAM: [8, 54000], HOP: [200, 54000] },
  defaults: { STEP: 23, GAP: 12, FIRST: 7479, GATE: 8, STREAM: 1471, HOP: 5828 },
  mutable: [['bS', ['b']], ['bC', ['b']], ['sLook', ['a', 'b']], ['cRef', ['b']], ['cMov1', ['b']], ['cMov2', ['b']], ['cDjn', ['b']], ['cSpl', ['b']]],
  knowledge: {
    parameterRoles: { STEP: 'Scan step, and the distance from the jump line to the clear.', GAP: 'Between the two cells a comparison reads.', FIRST: 'First comparison, from the scan line.', GATE: 'Where the clear keeps its pointer, the gate and the kill DAT.', STREAM: 'The clear\'s DJN stream.', HOP: 'Scanner copy, from the scanner template.' },
    tuning: ['Three cycles for every two cells while nothing is found.', 'The DJN that closes the loop also decrements every scanned B-field.'],
    failures: ['It triggers on the first difference it meets, a decoy included; Mountain Viper puts its own 42-cell SPL decoy between scanner and quickscan.'],
    evidence: ['docs/hill-top10/88.md'],
  },
  mismatches(P, settings) {
    const core = settings.coreSize, room = settings.maxLength, out = [];
    if (mod(P.HOP, core) < room + P.STEP + P.GATE + 20 || mod(P.HOP, core) > core - room - P.STEP - 20) out.push(`${OS}: the copies land on the warrior`);
    if (P.STEP < P.GATE + 4) out.push(`${OS}: STEP must leave room for the clear's gate and kill cell between scanner and clear`);
    if (settings.maxProcesses < 50) out.push(`${OS}: too few processes`);
    return out;
  },
  linked(P, settings, at, { total, shiftedFrame }) {
    if (shiftedFrame) return [];
    const core = settings.coreSize, out = [], s0 = at('sScan') + P.HOP, c0 = s0 + 2 + P.STEP;
    for (let i = -P.GATE - 2; i <= P.GATE + 1; i++) if (mod(c0 + i, core) < total) { out.push(`${OS}: the clear copy lands on the original image`); break; }
    for (let i = 0; i < 5; i++) if (mod(s0 + i, core) < total) { out.push(`${OS}: the scanner copy lands on the original image`); break; }
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, s0 = `${L('sScan')}+${P.HOP}`, c0 = `${s0}+${2 + P.STEP}`;
    ctx.ins('bS', 'MOV', 'I', L('sLast'), `${s0}+4`);
    for (let i = 1; i < 5; i++) ctx.ins('', 'MOV', 'I', `${L('sLast')}-${i}`, `<${L('bS')}`);
    ctx.ins('bC', 'MOV', 'I', L('cDjn'), `${c0}+4`);
    for (let i = 1; i < 6; i++) ctx.ins('', 'MOV', 'I', `${L('cDjn')}-${i}`, `<${L('bC')}`);
    ctx.ins('', 'SPL', 'B', `${s0}+1`, '0');
    ctx.ins('', 'MOV', 'I', L('kill'), `${c0}-${P.GATE + 1}`);
    ctx.ins('kill', 'DAT', 'F', `<${-P.GATE - 1}`, '#0');            // the boot process dies here
    ctx.ins('cRef', 'DAT', 'F', '#0', '#2');
    ctx.ins('cGo', 'MOV', 'I', `${-P.STEP - 1}`, `@${L('cMov1')}`);
    ctx.ins('cSpl', 'SPL', 'B', '0', `<${-P.GATE}`);
    ctx.ins('cMov1', 'MOV', 'I', `@${L('cRef')}`, `<${P.GATE - 2}`);
    ctx.ins('cMov2', 'MOV', 'I', `@${L('cRef')}`, `<${P.GATE - 3}`);
    ctx.ins('cDjn', 'DJN', 'B', L('cMov1'), `<${P.STREAM}`);
    ctx.ins('sScan', 'SUB', 'F', L('sInc'), L('sLook'));
    ctx.ins('sLook', 'CMP', 'I', `${mod(P.FIRST + P.GAP, core)}`, `${mod(P.FIRST, core)}`);
    ctx.ins('sInc', 'JMP', 'B', `${P.STEP}`, `${P.STEP}`);
    ctx.ins('sDjn', 'DJN', 'B', L('sScan'), `@${L('sLook')}`);
    ctx.ins('sLast', 'JMP', 'B', L('sScan'));
  },
  running(api) {
    const s0 = api.norm(api.at('sScan') + api.P.HOP), c0 = api.norm(s0 + 2 + api.P.STEP);
    return api.vm.processes(0).some((q) => api.norm(q - s0) < 5 || api.norm(q - c0) < 5 || api.vm.peek(q).op === 'SPL');
  },
  plant(api) {
    // A cell for the scan to find a few hundred cycles in.
    const s0 = api.norm(api.at('sScan') + api.P.HOP), look = api.norm(s0 + 1);
    return [[api.norm(look + api.P.FIRST - 100 * api.P.STEP), { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 }]];
  },
  watch(api) {
    const { vm, P, core } = api, s0 = api.norm(api.at('sScan') + P.HOP), c0 = api.norm(s0 + 2 + P.STEP);
    const sInc = api.norm(s0 + 2), cMov1 = api.norm(c0 + 2), cMov2 = api.norm(c0 + 3), cRef = api.norm(c0 - 1);
    const copyOk = (base, labels) => labels.every((l, i) => { const x = vm.peek(base + i), y = api.code(l); return sameOps(x, y) && api.norm(x.a) === api.norm(y.a); });
    let started = false, triggered = null, spls = 0, dats = 0, bootDead = false;
    return {
      before(pc) {
        if (pc === api.norm(s0 + 1) && !started) {
          started = true;
          if (!copyOk(s0, OS_SCAN)) throw new Error(`${OS}: the scanner copy is not the scanner`);
          if (!copyOk(cRef, OS_CLEAR)) throw new Error(`${OS}: the clear copy is not the clear`);
          if (!api.same(vm.peek(cRef - P.GATE), api.code('kill'))) throw new Error(`${OS}: the kill DAT is not GATE+1 below the clear`);
        }
        if (pc === sInc && triggered === null && vm.peek(pc).op === 'JMP') triggered = vm.cycle;
        if ((pc === cMov1 || pc === cMov2) && triggered !== null && sameOps(vm.peek(pc), api.code('cMov1'))) {
          const p = api.norm(c0 + P.GATE), t = api.norm(p + vm.peek(p).b - 1);
          return { t, src: api.norm(cRef + vm.peek(cRef).b) };
        }
        return null;
      },
      after(t) {
        if (!t) return;
        if (!bootDead && started) bootDead = !vm.processes(0).some((q) => api.inSelf(q));
        const x = vm.peek(t.t);
        if (x.op === 'SPL') spls++; else if (x.op === 'DAT') dats++;
      },
      final() {
        if (!api.alone && !String(api.scenario ?? '').includes('planted')) return;
        if (!started) throw new Error(`${OS}: the scanner never started`);
        if (api.alone && vm.processes(0).some((q) => api.inSelf(q))) throw new Error(`${OS}: a process is still running in the image`);
        if (triggered === null) throw new Error(`${OS}: the scanner never found anything`);
        if (spls < 500) throw new Error(`${OS}: the clear laid only ${spls} SPLs`);
        if (vm.cycle >= api.settings.maxCycles && dats < 100) throw new Error(`${OS}: the clear never switched to its DAT pass (${dats} DATs)`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// pit-vampire-imp-88: Elemental Dust 2's body. The boot copies a vampire, its
// fang, its increment and a pit HOP away, keeping their spacing, starts the
// vampire, lays one imp and sends six processes down a binary tree onto two
// laps of a 3-point ring; the seventh joins the vampire. Every empty cell of
// the image is a decoy.
//
//   vHead  SPL 0, <2-FOFF          the vampire: SPL-fed, it gains a process a
//   vLoop  MOV vFang, @vFang       pass; it drops a copy of its fang where the
//   vAdd   ADD vInc, @vLoop        fang's B-field points, then adds the
//   vDjn   DJN vLoop, <STREAM      increment (-VSTEP, +VSTEP) to the fang:
//   vFang  JMP pit-dist, dist      A + B stays the distance to the pit, so every
//   pMov   MOV pBomb, <ptr         dropped fang jumps into it. Prisoners run the
//   pSpl   SPL pMov                pit: each splits and lays an anti-imp DAT
//   pJmp   JMP @pSpl               downward from below the vampire, for us
//   pBomb  DAT <AI, <x
//   vInc   DAT <-VSTEP, <VSTEP
//
// The prisoners' clear goes round the core and finally over the pit and the
// vampire themselves; by then the imps carry the round.
const VI = 'pit-vampire-imp-88';
const VI_CODE = ['vHead', 'vLoop', 'vAdd', 'vDjn'], VI_PIT = ['pMov', 'pSpl', 'pJmp', 'pBomb'];
const viHurts = (G, x) => [0, 1, 2, 3, G.fang, G.pit, G.pit + 1, G.pit + 3, G.inc].includes(x);
function viLayout(P) {
  // Offsets from vHead: fang FOFF, pit TOFF (4 cells), increment IOFF.
  return { fang: P.FOFF, pit: P.TOFF, inc: P.IOFF, end: P.IOFF + 1 };
}
const pitVampireImp = {
  id: VI, kind: 'body', exit: 'never', processes: 1, grows: true, writes: 'sparse', roams: true, moves: true, entry: 'bGo',
  purpose: "ICWS'88 vampire/imp (Elemental Dust 2): boots an SPL-fed fang vampire (step VSTEP, a DJN stream) and a pit whose prisoners split and clear the core with anti-imp DATs, then lays two laps of a 3-point imp ring with a binary tree of six jumps; the decoy cells DAT #pit, #1 fill every gap of the image.",
  params: { VSTEP: [2, 27000], HOP: [200, 54000], STREAM: [8, 54000], IHOP: [200, 54000], FOFF: [5, 30], TOFF: [8, 40], IOFF: [12, 60], CLR: [10, 60], DECOYS: [0, 60] },
  defaults: { VSTEP: 644, HOP: 3054, STREAM: 4526, IHOP: 6619, FOFF: 16, TOFF: 27, IOFF: 40, CLR: 27, DECOYS: 30 },
  mutable: [['vbDst', ['b']], ['tbDst', ['b']], ['vFang', ['a', 'b']], ['vDjn', ['b']], ['pMov', ['b']]],
  knowledge: {
    parameterRoles: {
      VSTEP: 'Fang step.', HOP: 'Vampire copy, from the template.', STREAM: 'The vampire\'s DJN stream pointer.', IHOP: 'The imp, from its template.',
      FOFF: 'Fang, from the vampire head.', TOFF: 'Pit, from the vampire head.', IOFF: 'Increment, from the vampire head.', CLR: 'The prisoners\' clear starts CLR+1 below the vampire head.', DECOYS: 'Decoy cells after the code (the gaps between the parts are decoys too).',
    },
    tuning: ['The vampire is a three-line loop fed by its own SPL, so it speeds up as it grows, like a stone.'],
    failures: ['The decoy cells are DAT #pit, #1: their A-fields all name the pit. Why that form was chosen is not established (uncertain).'],
    evidence: ['docs/hill-top10/88.md'],
  },
  mismatches(P, settings) {
    const core = settings.coreSize, room = settings.maxLength, out = [], G = viLayout(P);
    if (!(P.FOFF >= 4 && P.TOFF >= P.FOFF + 1 && P.IOFF >= P.TOFF + 4)) out.push(`${VI}: the fang, pit and increment must follow the vampire in that order`);
    const near = (d, r) => mod(d, core) < r || mod(d, core) > core - r;
    if (near(P.HOP, room + G.end + 30)) out.push(`${VI}: the vampire copy lands on the warrior`);
    // Fang k lands at vLoop + (k+1)*VSTEP. A fang on the pit's JMP is harmless (it leads into the pit too);
    // anywhere else among the parts it is not.
    for (let k = 0; k < 400; k++) {
      const x = mod(P.FOFF + (P.VSTEP - P.FOFF + 1) + k * P.VSTEP, core);
      if (viHurts(G, x)) { out.push(`${VI}: fang ${k} lands on the vampire`); break; }
    }
    if (!modInverse(3, core)) out.push(`${VI}: no 3-point imp ring on a ${core}-cell core`);
    return out;
  },
  linked(P, settings, at, { total, shiftedFrame }) {
    if (shiftedFrame) return [];
    const core = settings.coreSize, out = [], G = viLayout(P), S = modInverse(3, core), inImage = (x) => mod(x, core) < total;
    const v0 = at('vHead') + P.HOP;
    for (let i = -P.CLR - 2; i <= G.end; i++) if (inImage(v0 + i)) { out.push(`${VI}: the vampire copy lands on the original image`); break; }
    const i0 = at('iImp') + P.IHOP;
    for (let k = 0; k < 6; k++) if (inImage(i0 + k * S) || inImage(i0 + k * S + 1)) { out.push(`${VI}: an imp lands on the original image`); break; }
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, G = viLayout(P), S = modInverse(3, core), v0 = `${L('vHead')}+${P.HOP}`, i0 = `${L('iImp')}+${P.IHOP}`;
    ctx.ins('bGo', 'MOV', 'I', `${L('vHead')}+3`, `${v0}+3`);
    ctx.ins('vbDst', 'MOV', 'I', `${L('vHead')}+2`, `<${L('bGo')}`);
    ctx.ins('', 'MOV', 'I', `${L('vHead')}+1`, `<${L('bGo')}`);
    ctx.ins('', 'MOV', 'I', L('vHead'), `<${L('bGo')}`);
    ctx.ins('', 'MOV', 'I', L('vFang'), `${v0}+${G.fang}`);
    ctx.ins('', 'MOV', 'I', L('vInc'), `${v0}+${G.inc}`);
    ctx.ins('tbDst', 'MOV', 'I', `${L('pMov')}+3`, `${v0}+${G.pit + 3}`);
    for (let i = 2; i >= 0; i--) ctx.ins('', 'MOV', 'I', `${L('pMov')}+${i}`, `<${L('tbDst')}`);
    ctx.ins('', 'SPL', 'B', v0, '0');
    ctx.ins('', 'MOV', 'I', L('iImp'), i0);
    // A balanced tree of SPLs over seven leaves: six imp jumps (k = 0..5) and the vampire.
    const leaves = [0, 1, 2, 3, 4, 5, 'v'];
    emitTree(ctx, leaves, (leaf) => (leaf === 'v' ? ctx.ins('', 'JMP', 'B', v0, '0') : ctx.ins('', 'JMP', 'B', `${i0}+${mod(leaf * S, core)}`, '0')), 'vt');
    ctx.ins('iImp', 'MOV', 'I', '0', `${S}`);
    const decoy = (n) => { for (let i = 0; i < n; i++) ctx.ins('', 'DAT', 'F', `#${L('pMov')}`, '#1'); };
    ctx.ins('vHead', 'SPL', 'B', '0', `<${2 - G.fang}`);
    ctx.ins('vLoop', 'MOV', 'I', L('vFang'), `@${L('vFang')}`);
    ctx.ins('vAdd', 'ADD', 'F', L('vInc'), `@${L('vLoop')}`);
    ctx.ins('vDjn', 'DJN', 'B', L('vLoop'), `<${P.STREAM}`);
    decoy(G.fang - 4);
    // A + B = the distance from the fang to the pit; the first fang lands VSTEP past vLoop.
    ctx.ins('vFang', 'JMP', 'B', `${G.pit - G.fang - (P.VSTEP - G.fang + 1)}`, `<${P.VSTEP - G.fang + 1}`);
    decoy(G.pit - G.fang - 1);
    ctx.ins('pMov', 'MOV', 'I', L('pBomb'), `<${-G.pit - P.CLR}`);
    ctx.ins('pSpl', 'SPL', 'B', L('pMov'), '0');
    ctx.ins('pJmp', 'JMP', 'B', `@${L('pSpl')}`, '0');
    ctx.ins('pBomb', 'DAT', 'F', `<${modInverse(3, core)}`, `<${G.fang - 2 * G.pit - 3}`);
    decoy(G.inc - G.pit - 4);
    ctx.ins('vInc', 'DAT', 'F', `<${-P.VSTEP}`, `<${P.VSTEP}`);
    decoy(P.DECOYS);
  },
  running(api) {
    const v0 = api.norm(api.at('vHead') + api.P.HOP), imp = api.code('iImp');
    return api.vm.processes(0).some((q) => api.norm(q - v0) < 4 || api.same(api.vm.peek(q), imp));
  },
  watch(api) {
    const { vm, P, core } = api, G = viLayout(P), v0 = api.norm(api.at('vHead') + P.HOP), pit = api.norm(v0 + G.pit), fang = api.norm(v0 + G.fang);
    const vLoop = api.norm(v0 + 1), imp = api.code('iImp');
    const copyOk = (base, labels) => labels.every((l, i) => { const x = vm.peek(base + i), y = api.code(l); return sameOps(x, y) && api.norm(x.a) === api.norm(y.a); });
    let checked = false, fangs = 0, bad = 0, retired = false;
    return {
      before(pc) {
        if (retired) return null;
        if (pc === v0 && !checked) {
          checked = true;
          if (!copyOk(v0, VI_CODE) || !copyOk(pit, VI_PIT)) throw new Error(`${VI}: the vampire copy is not the vampire`);
          if (!sameOps(vm.peek(fang), api.code('vFang')) || !api.same(vm.peek(v0 + G.inc), api.code('vInc'))) throw new Error(`${VI}: the fang or the increment is missing`);
        }
        if (pc === vLoop && checked && sameOps(vm.peek(fang), api.code('vFang'))) return { t: api.norm(fang + vm.peek(fang).b) };
        return null;
      },
      after(t) {
        if (!t) return;
        const x = vm.peek(t.t);
        // After core/gcd(VSTEP, core)/2 fangs the drop comes round to vLoop itself: the vampire's own
        // processes then jump into the pit and join the prisoners' clear (Elemental Dust 2 does the same).
        if (api.rel(t.t, v0) === 1 && fangs >= 1000) { retired = true; return; }
        if (viHurts(G, api.rel(t.t, v0))) throw new Error(`${VI}: a fang landed on the vampire (+${api.rel(t.t, v0)}, fang ${fangs + bad})`);
        if (x.op === 'JMP' && api.norm(t.t + x.a) === pit) fangs++; else bad++;
      },
      final() {
        if (!api.entered() || !api.alone) return;
        if (!checked) throw new Error(`${VI}: the vampire never started`);
        if (fangs < 100) throw new Error(`${VI}: only ${fangs} fangs lead to the pit`);
        // Alone the imps do not last: once the vampire has retired into its pit the prisoners' clear
        // goes round the core (Elemental Dust 2 alone ends the same way); survival is the gate's check.
        void imp;
      },
    };
  },
};

export default [selfclearStonePump, blankPadding, probeCarpet, resinPaper, paperStoneBoot, opQscanM, cannonadePump, blitzStoneSpiral, stoneLoopPaper, oneshot88, pitVampireImp];
