// Hill stone tricks the earlier stone blocks do not have (docs/hill-recipe-book.md,
// "Stones and stone/imps", our-blocks rows on the two-pointer stone and the
// wreck-becomes-clear ending). Everything here is written from scratch; the hill
// warriors named are studied for their mechanism, never copied. Ring, ICWS'94.
//
//   bomb-pointer-stone  Quicksilver's family (a): two writes a pass from ONE
//     pointer, the second through the A-field of the cell the pointer names
//     (`}`), so a cell that already holds a bomb sends the second write STEP
//     further on: the bombs are their own second pointer. The start is timed so
//     that after TIME passes the first write lands on the stone's own ADD, and
//     the bomb's `>` operand turns the wreck into a one-cell-per-process core
//     clear for free. Unlike the hill stones (whose clear finally runs over its
//     own feeder, leaving the imps to hold the round), the pointer cell sits
//     lowest in the block, so when the clear comes round it overwrites the
//     pointer first and parks in three dead cells: the stone survives alone.
//     HOP sets the bomb's A-field, the distance of the second write: STEP as in
//     Quicksilver, or a short one for Reepicheep's pairs of bombs 31 apart.
//
// Not built here, and why (see the report in the block group's tests):
//   - the {0,}0 3-line stone is `self-add-stone` (hillstones2.js); its wreck
//     ending cannot survive alone: `{0,}0` ties the pointer (the MOV) to the cell
//     just below the ADD and the SPL feeder must sit just below the MOV, so the
//     clear, going either way from the ADD, reaches the feeder before it can
//     reach the pointer.
//   - the self-copying stone whose SPL is copied over its DJN, with the bomb that
//     resets the gate, is `armadillo-switch` (hillstones2.js).

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const mod = (x, n) => ((x % n) + n) % n;
// x^-1 mod n, or null when gcd(x, n) > 1.
function inverse(x, n) {
  let [r0, r1, t0, t1] = [mod(x, n), n, 1, 0];
  while (r1) { const q = Math.floor(r0 / r1); [r0, r1] = [r1, r0 - q * r1]; [t0, t1] = [t1, t0 - q * t1]; }
  return r0 === 1 ? mod(t0, n) : null;
}

// ---------------------------------------------------------------------------
// bomb-pointer-stone
//
//    0 bpEntry MOV.I  bpBomb, remote     plant the bomb copy the loop reads  } dead after
//    1         JMP    bpFeed                                                } the start: the
//    2 bpBomb  DAT    STEP, >-3          the template (A: the 2nd pointer)   } clear parks here
//    3 bpW2    MOV.I  remote, }X         write 2: at X + A(X); X is the pointer
//    4 bpFeed  SPL    #0, 0              one new process a pass
//    5 bpW1    MOV.I  remote, @bpW2      write 1: at X
//    6 bpHit   ADD.AB #2 STEP, bpW2      X += 2 STEP
//    7 bpDjn   DJN.F  bpW2, <C           a DJN stream walking down from below the warrior
//
// The pointer X walks the lattice p0 + 2 STEP j. Write 1 lands on X; write 2
// reads the cell X names after the ADD (the next lattice point) and lands A
// cells beyond it: on a fresh cell that is the cell itself, on a bombed one
// STEP further (the bomb's A-field). X starts 2 STEP x TIME below bpHit, so on
// pass TIME write 1 drops a bomb on the ADD. From then on every process runs
// SPL, MOV (one bomb at X), then dies on the bomb, whose `>-3` moves X up one
// cell: a forward core clear. It runs up the core, wraps, and first meets the
// block at its three dead cells and then bpW2: the bomb copied there makes X
// -3, so the clear writes cells 0..3 for ever (a process sink) and never
// reaches the feeder above. The pointer must therefore be the lowest live
// cell, which is why write 2 comes first in the loop and the feeder sits
// inside it (five instructions a pass: 2 writes, 1 decrement, 1 split).
//
// Every live cell in the ADD's residue class (mod gcd(2 STEP, core)) must come
// later on the lattice than the ADD, so that nothing live is hit first; TIME
// must end inside the first lap (write 2's STEP shift only starts on the
// second), and before the DJN stream, walking down from below the warrior,
// comes round to the bomb copy above it.
const BP = ['bpEntry', 'bpJmp', 'bpBomb', 'bpW2', 'bpFeed', 'bpW1', 'bpHit', 'bpDjn'];
const BP_AT = Object.fromEntries(BP.map((l, i) => [l, i]));
const BP_DEAD = [0, 1, 2];                 // dead once started: the clear parks here
const BP_LIVE = [3, 4, 5, 6, 7];

function bpPlan(S, core, TIME, HOP = S) {
  const g2 = gcd(2 * S, core), n = core / g2, inv = inverse((2 * S) / g2, n);
  const hit = BP_AT.bpHit, p0 = mod(hit - 2 * S * TIME, core);        // block-relative first target
  // The lattice index at which a write lands on block cell x: write 1 (and a
  // write 2 through a fresh cell) on the lattice itself, write 2 through a
  // bombed cell STEP + d beyond it (d: the A-field's post-increments, 0..3).
  const j = (x) => (mod(x - p0, g2) ? Infinity : mod((mod(x - p0, core) / g2) * inv, n));
  const first = (x) => Math.min(x === hit ? Infinity : j(x), ...[0, 1, 2, 3].map((d) => j(mod(x - HOP - d, core))));
  const early = BP_LIVE.filter((x) => first(x) <= TIME + 2);
  return { g2, n, p0, early };
}

const bombPointerStone = {
  id: 'bomb-pointer-stone',
  kind: 'body', exit: 'never', grows: true, processes: 8, writes: 'core', roams: false, dialects: '94',
  purpose: 'Quicksilver-style stone: two writes a pass from one pointer, the second through the A-field of the cell it names, so bombs already laid act as a second pointer HOP on (HOP 0: STEP, as Quicksilver; 31: pairs as in Reepicheep); after TIME passes its first write lands on its own ADD and the bomb\'s `>` operand turns the wreck into a one-cell-per-process core clear, which parks in dead cells when it comes round so the stone survives alone.',
  params: { STEP: [3, 27000], TIME: [50, 20000], OFF: [0, 60], HOP: [0, 27000] },
  defaults: { STEP: 2857, TIME: 1500, OFF: 5, HOP: 0 },
  entry: 'bpEntry', loop: 'bpW1',
  provides: { datBomb: 'bpBomb' },
  mutable: [['bpW2', ['b']], ['bpHit', ['a']], ['bpBomb', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (settings.dialect === '88') return ["bomb-pointer-stone: the `}` second write needs ICWS'94"];
    const { g2, n, early } = bpPlan(P.STEP, core, P.TIME, P.HOP || P.STEP);
    if (P.HOP % core === 0 && P.HOP) out.push(`bomb-pointer-stone: HOP ${P.HOP} is a whole core: the second write would land on the first`);
    if (n < 200) out.push(`bomb-pointer-stone: STEP ${P.STEP} reaches only ${n} cells a lap`);
    if (g2 > 2 * settings.maxLength) out.push(`bomb-pointer-stone: gcd(2 STEP, core) = ${g2}: the wreck clear never forms on a lattice that sparse`);
    if (P.TIME >= n) out.push(`bomb-pointer-stone: TIME ${P.TIME} is past the first lap (${n} passes), where the second write's STEP shift starts`);
    // The DJN stream walks down from below the warrior and comes round to the
    // bomb copy above it after about core - length - OFF passes.
    if (P.TIME > core - 2 * settings.maxLength - P.OFF - 20) out.push(`bomb-pointer-stone: TIME ${P.TIME} lets the DJN stream reach the bomb copy first`);
    if (early.length) out.push(`bomb-pointer-stone: STEP ${P.STEP} with TIME ${P.TIME} bombs its own live cell ${early.map((x) => BP[x]).join(', ')} before its ADD`);
    return out;
  },
  emit(ctx) {
    const { P, core, total } = ctx, S = P.STEP;
    const { p0 } = bpPlan(S, core, P.TIME, P.HOP || S);
    const base = ctx.pc();                                  // the block's first cell (global index)
    const remote = (i) => `${total + P.OFF - (base + i)}`;  // the bomb copy: OFF cells past the warrior
    const stream = `<${-1 - (base + BP_AT.bpDjn)}`;         // pointer cell just below the warrior
    ctx.ins('bpEntry', 'MOV', 'I', `${BP_AT.bpBomb}`, remote(0));
    ctx.ins('bpJmp', 'JMP', 'B', `${BP_AT.bpFeed - BP_AT.bpJmp}`);
    ctx.ins('bpBomb', 'DAT', 'F', `${P.HOP || S}`, `>${BP_AT.bpW2 - BP_AT.bpHit}`);
    ctx.ins('bpW2', 'MOV', 'I', remote(BP_AT.bpW2), `}${mod(p0 - BP_AT.bpW2, core)}`);
    ctx.ins('bpFeed', 'SPL', 'B', '#0', '0');
    ctx.ins('bpW1', 'MOV', 'I', remote(BP_AT.bpW1), `@${BP_AT.bpW2 - BP_AT.bpW1}`);
    ctx.ins('bpHit', 'ADD', 'AB', `#${mod(2 * S, core)}`, `${BP_AT.bpW2 - BP_AT.bpHit}`);
    ctx.ins('bpDjn', 'DJN', 'F', `${BP_AT.bpW2 - BP_AT.bpDjn}`, stream);
  },
  watch(api) {
    const { vm, P } = api, start = api.self.start;
    const at = Object.fromEntries(BP.map((l) => [l, api.at(l)]));
    const intact = (l) => api.same(vm.peek(at[l]), api.code(l));
    let adds = 0, wreckAt = null, wreckAdds = null, parked = null;
    const stoneCells = new Set(), clearCells = new Set();
    return {
      before(pc) {
        if (pc === at.bpHit && intact('bpHit')) return { add: true };
        if (pc === at.bpW1 && intact('bpW1')) return { t: api.norm(at.bpW2 + vm.peek(at.bpW2).b), w: 1 };
        if (pc === at.bpW2 && api.same(vm.peek(pc), { ...api.code('bpW2'), b: vm.peek(pc).b })) {
          const I = api.norm(at.bpW2 + vm.peek(at.bpW2).b);
          return { t: api.norm(I + vm.peek(I).a), w: 2 };
        }
        return null;
      },
      after(tok) {
        if (!tok) return;
        if (tok.add) { adds++; return; }
        const off = api.inSelf(tok.t) ? api.rel(tok.t, start) : null;
        if (wreckAt === null) {
          if (off === BP_AT.bpHit && tok.w === 1) { wreckAt = vm.cycle; wreckAdds = adds; return; }
          if (off !== null && !BP_DEAD.includes(off)) throw new Error(`${api.scenario}: bomb-pointer-stone bombed its own ${BP[off]} before its ADD (pass ${adds})`);
          stoneCells.add(tok.t);
          return;
        }
        // The wreck clear: write 1 only (write 2 is dead), one cell a process.
        if (off !== null) {
          if (off === BP_AT.bpW2) { if (parked === null) parked = vm.cycle; return; }
          if (!BP_DEAD.includes(off) && off !== BP_AT.bpHit && off !== BP_AT.bpDjn) throw new Error(`${api.scenario}: bomb-pointer-stone's wreck clear wrote its live ${BP[off]}`);
          return;
        }
        if (vm.peek(tok.t).op !== 'DAT') throw new Error('bomb-pointer-stone\'s clear wrote something other than its bomb');
        clearCells.add(tok.t);
      },
      final() {
        if (!api.alone) return;
        if (stoneCells.size < Math.min(P.TIME, 200)) throw new Error(`bomb-pointer-stone bombed only ${stoneCells.size} cells before its wreck`);
        if (wreckAt === null) {
          // The wreck comes at pass TIME; the gate's 8,000-core run lasts long enough to see it.
          if (api.core <= 8000) throw new Error(`bomb-pointer-stone never wrecked its ADD (${adds} passes, TIME ${P.TIME})`);
          return;
        }
        if (Math.abs(wreckAdds - P.TIME) > 1) throw new Error(`bomb-pointer-stone wrecked its ADD on pass ${wreckAdds}, not ${P.TIME}`);
        const ran = vm.cycle - wreckAt;
        if (ran > 2000 && clearCells.size < ran / 20) throw new Error(`bomb-pointer-stone's wreck clear wrote only ${clearCells.size} cells`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// airbag-clear-stone
//
// The hill's airbag (Viva La Bomba, Fort Destruction, Fuse): the stone tests a
// cell that stays empty while nothing touches it, and the moment it doesn't,
// every process abandons the stone for a core clear. Our `airbag-stone`
// repairs itself and keeps bombing; this one gives up the stone, as the hill
// ones do. The trail is aimed so that, if nothing else has, the stone's own
// bomb sets the airbag off after TIME passes: the bombing comes home onto the
// bag before any live cell, and the clear takes over (the wreck-becomes-clear
// idea, with the airbag as the switch).
//
//    0 abCPtr  DAT   #0, #R            the clear pointer (lowest cell)
//    1 abFeed  SPL   abChk             entry: split PROCS - 1 processes into the
//    2 abSplit DJN   abFeed, abProcs     loop, then join it
//    3 abChk   JMZ.F abW1, abBag       bag empty: bomb on; anything else: clear
//    4 abClr   MOV.I abDBomb, >abCPtr  a forward clear, 1 DAT + 1 decrement
//    5 abClr2  DJN.F abClr, >abCPtr    per 2 instructions
//    6 abW1    MOV.I abBomb, @abPtr    write X
//    7 abW2    MOV.I abBomb, *abPtr    write X + STEP
//    8 abAdd   ADD.F abInc, abPtr      X += 2 STEP
//    9 abDjn   DJN.F abChk, <C         a DJN stream walking down from below the warrior
//   10 abPtr   DAT   #X+STEP, #X
//   11 abInc   DAT   #2 STEP, #2 STEP
//   12 abBomb  DAT   <core/3, <2 core/3  non-zero, so it sets the bag off
//   13 abDBomb DAT   #0, #R            on the pointer it restarts the clear past the block
//   14 abProcs DAT   #0, #PROCS - 1
//   15 abBag   DAT   #0, #0            the airbag; top cell, so a stream coming down trips it first
//
// Every process passes the test once a pass, so once the bag is set no process
// starts another pass: the stone stops within one pass and all of them clear.
// The processes already past the test finish their pass, each moving the
// pointer one more step, so the trail must not reach a live cell for that many
// steps past the bag either: the process count is fixed (PROCS, plus whatever
// a launcher sends in) rather than fed without limit, to keep that short. The
// feeder starts each process two instructions behind the last, so up to four
// take different places round the five-instruction loop and the pointer moves
// once a round, between one write 1 and the next: every lattice point is
// bombed, the bag included. A fifth would share a place, two ADDs would run in
// one round and the trail would skip points (and could skip the bag). The clear
// sweeps up from the block's end; when it comes round onto abCPtr (the lowest
// cell, so before any code) the DAT or the decrement it leaves there throws
// the pointer back to R, past the block, and it sweeps again.
const AB = ['abCPtr', 'abFeed', 'abSplit', 'abChk', 'abClr', 'abClr2', 'abW1', 'abW2', 'abAdd', 'abDjn', 'abPtr', 'abInc', 'abBomb', 'abDBomb', 'abProcs', 'abBag'];
const AB_AT = Object.fromEntries(AB.map((l, i) => [l, i]));
const AB_SIZE = AB.length;
const AB_SAFE = [AB_AT.abBomb];            // a bomb on the bomb template changes nothing
const AB_PLANT = 2000;                     // the planted hit on the bag, in cycles

// The lattice p0 + k STEP (write 1 on even k, write 2 on odd), aimed so that
// lattice point 2 TIME is the bag; every other live cell must come later, and
// later still than the passes the processes already past the test finish after
// the bag is set (one each: PROCS of them plus up to 16 a launcher sends in).
function abPlan(S, core, TIME, procs) {
  const g = gcd(S, core), n = core / g, inv = inverse(S / g, n), bag = AB_AT.abBag;
  const p0 = mod(bag - 2 * TIME * S, core);
  const k = (x) => (mod(x - p0, g) ? Infinity : mod((mod(x - p0, core) / g) * inv, n));
  const margin = 2 * procs + 2;
  const early = AB.map((_, x) => x).filter((x) => x !== bag && !AB_SAFE.includes(x) && k(x) <= 2 * TIME + margin);
  return { g, n, p0, early };
}

const airbagClearStone = {
  id: 'airbag-clear-stone',
  kind: 'body', exit: 'never', processes: (P) => P.PROCS, writes: 'core', roams: false, dialects: '94',
  purpose: 'A stone with an airbag: PROCS processes in one loop; every pass tests a cell that stays empty while nothing touches it; once it is hit, every process abandons the stone for a gated forward core clear that restarts past the block each lap. The trail is aimed so its own bomb sets the airbag off after TIME passes if nothing else has.',
  params: { STEP: [3, 27000], TIME: [100, 20000], PROCS: [2, 4] },
  defaults: { STEP: 2807, TIME: 1500, PROCS: 4 },
  entry: 'abFeed', loop: 'abChk', entryFirst: false,
  provides: { datBomb: 'abBomb' },
  mutable: [['abCPtr', ['a', 'b']], ['abPtr', ['a', 'b']], ['abBag', ['a', 'b']], ['abProcs', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (settings.dialect === '88') return ["airbag-clear-stone: needs ICWS'94 (JMZ.F, A-field pointers)"];
    if (P.PROCS > settings.maxProcesses) out.push(`airbag-clear-stone: ${P.PROCS} processes; this hill allows ${settings.maxProcesses}`);
    const { n, early } = abPlan(P.STEP, core, P.TIME, Math.min(P.PROCS + 16, settings.maxProcesses));
    if (n < 200) out.push(`airbag-clear-stone: STEP ${P.STEP} reaches only ${n} cells`);
    if (2 * P.TIME >= n) out.push(`airbag-clear-stone: TIME ${P.TIME} is more than a lap (${n} bombs) away: the trail would pass the bag`);
    if (P.TIME > core - 2 * settings.maxLength - 20) out.push(`airbag-clear-stone: TIME ${P.TIME} lets the DJN stream come round to the warrior first`);
    if (early.length) out.push(`airbag-clear-stone: STEP ${P.STEP} with TIME ${P.TIME} bombs its own ${early.map((x) => AB[x]).join(', ')} before the airbag (or while the processes already past the test finish their pass)`);
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, S = P.STEP, { p0 } = abPlan(S, core, P.TIME, 0);
    const base = ctx.pc(), x = mod(p0 - AB_AT.abPtr, core);           // abPtr's B: the first bomb, relative to abPtr
    const third = Math.round(core / 3);
    ctx.ins('abCPtr', 'DAT', 'F', '#0', `#${AB_SIZE}`);
    ctx.ins('abFeed', 'SPL', 'B', L('abChk'));
    ctx.ins('abSplit', 'DJN', 'B', L('abFeed'), L('abProcs'));
    ctx.ins('abChk', 'JMZ', 'F', L('abW1'), L('abBag'));
    ctx.ins('abClr', 'MOV', 'I', L('abDBomb'), `>${L('abCPtr')}`);
    ctx.ins('abClr2', 'DJN', 'F', L('abClr'), `>${L('abCPtr')}`);
    ctx.ins('abW1', 'MOV', 'I', L('abBomb'), `@${L('abPtr')}`);
    ctx.ins('abW2', 'MOV', 'I', L('abBomb'), `*${L('abPtr')}`);
    ctx.ins('abAdd', 'ADD', 'F', L('abInc'), L('abPtr'));
    ctx.ins('abDjn', 'DJN', 'F', L('abChk'), `<${-1 - (base + AB_AT.abDjn)}`);
    ctx.ins('abPtr', 'DAT', 'F', `#${mod(x + S, core)}`, `#${x}`);
    ctx.ins('abInc', 'DAT', 'F', `#${mod(2 * S, core)}`, `#${mod(2 * S, core)}`);
    ctx.ins('abBomb', 'DAT', 'F', `<${third}`, `<${mod(2 * third, core)}`);
    ctx.ins('abDBomb', 'DAT', 'F', '#0', `#${AB_SIZE}`);
    ctx.ins('abProcs', 'DAT', 'F', '#0', `#${P.PROCS - 1}`);
    ctx.ins('abBag', 'DAT', 'F', '#0', '#0');
  },
  plant: (api) => [[api.at('abBag'), { op: 'DAT', mod: 'F', aMode: '#', a: 0, bMode: '#', b: 1 }, AB_PLANT]],
  watch(api) {
    const { vm, P } = api, start = api.self.start;
    const at = Object.fromEntries(AB.map((l) => [l, api.at(l)]));
    const intact = (l) => api.same(vm.peek(at[l]), api.code(l));
    const planted = api.scenario === 'airbag-clear-stone: planted target';
    let adds = 0, firedProcs = 0, firedAt = null, firedBy = null, firedAdds = null, clearAt = null, lateBombs = 0;
    const stone = new Set(), cleared = new Set();
    const bagSet = () => { const b = vm.peek(at.abBag); return b.op !== 'DAT' || b.a !== 0 || b.b !== 0; };
    return {
      before(pc) {
        if (firedAt === null && bagSet()) { firedAt = vm.cycle; firedBy = 'other'; firedAdds = adds; firedProcs = vm.processes(0).length; }
        if (pc === at.abAdd && intact('abAdd')) return { add: true };
        if (pc === at.abW1 && intact('abW1')) return { t: api.norm(at.abPtr + vm.peek(at.abPtr).b) };
        if (pc === at.abW2 && intact('abW2')) return { t: api.norm(at.abPtr + vm.peek(at.abPtr).a) };
        if (pc === at.abClr && intact('abClr')) { if (clearAt === null) clearAt = vm.cycle; return { c: api.norm(at.abCPtr + vm.peek(at.abCPtr).b) }; }
        return null;
      },
      after(tok) {
        if (!tok) return;
        if (tok.add) { adds++; return; }
        if (tok.c !== undefined) {
          if (api.inSelf(tok.c) && api.rel(tok.c, start) !== AB_AT.abCPtr) throw new Error(`${api.scenario}: airbag-clear-stone's clear wrote its own ${AB[api.rel(tok.c, start)]}`);
          cleared.add(tok.c);
          return;
        }
        if (api.inSelf(tok.t)) {
          const off = api.rel(tok.t, start);
          if (off === AB_AT.abBag) { if (firedAt === null) { firedAt = vm.cycle; firedBy = 'self'; firedAdds = adds; firedProcs = vm.processes(0).length; } }
          else if (!AB_SAFE.includes(off)) throw new Error(`${api.scenario}: airbag-clear-stone bombed its own ${AB[off]} (pass ${adds})`);
        }
        if (firedAt !== null && vm.cycle > firedAt + 8 * firedProcs + 200) lateBombs++;   // past the passes already under way
        stone.add(tok.t);
      },
      final() {
        // Once the bag is set no process may start another pass (a stray that the
        // clear's decrement drops into the stone may make one).
        if (lateBombs > 16) throw new Error(`${api.scenario}: airbag-clear-stone kept bombing after its airbag went off (${lateBombs} bombs)`);
        if (firedAt !== null && vm.cycle > firedAt + 500 && clearAt === null) throw new Error(`${api.scenario}: airbag-clear-stone's airbag went off but no clear ran`);
        if (planted) {
          if (firedAt === null || firedAt < AB_PLANT) throw new Error('airbag-clear-stone did not notice the hit on its airbag');
          if (clearAt === null || clearAt > firedAt + 8 * firedProcs + 200) throw new Error('airbag-clear-stone did not switch to its clear when its airbag was hit');
        }
        if (!api.alone) return;
        if (stone.size < Math.min(P.TIME, 200)) throw new Error(`airbag-clear-stone bombed only ${stone.size} cells`);
        if (firedAt === null) { if (api.core <= 8000) throw new Error(`airbag-clear-stone's trail never came home to its airbag (${adds} passes)`); return; }
        if (firedBy !== 'self' || Math.abs(firedAdds - P.TIME) > 2) throw new Error(`airbag-clear-stone's airbag went off on pass ${firedAdds} (${firedBy}), not by its own bomb on pass ${P.TIME}`);
        if (vm.cycle - clearAt > 2000 && cleared.size < (vm.cycle - clearAt) / 20) throw new Error(`airbag-clear-stone's clear wrote only ${cleared.size} cells`);
      },
    };
  },
};

export default [bombPointerStone, airbagClearStone];
