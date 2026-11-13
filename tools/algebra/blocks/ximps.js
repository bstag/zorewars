// X-hill imp blocks (docs/hill-top30/block-gaps.md, section "X";
// docs/hill-top30/94x.md, #8 and #5/#9):
//
//   dual-imp-pump  -- a continuous pump that feeds two imp spirals of different
//     sizes at once: NA-point imps that carry their step in the A-field
//     (`mov.i #step, *0`) and NB-point imps that carry it in the B-field
//     (`mov.i #1, step`), so a bomb or a gate tuned to one ring leaves the other.
//     One process a pass goes to each spiral, for as long as the pump lives;
//     `dual-launcher` builds its two rings once and stops.
//
//   impstep-clear  -- a clear that advances by an imp step and keeps its pointer
//     cell as the lowest cell of its block. An imp arm that climbs onto it
//     re-aims the clear at the ring and is broken on the pointer cell: 40 wins
//     in 40 rounds against a 64-process 13-point spiral on the 55,440 core,
//     where a plain d-clear with the same bomb tied all 40. The mechanism, as
//     traced, is written out above the block.
//
// All Redcode here is written from scratch; the hill warriors were read for the
// mechanism, never copied. Ring, ICWS'94 only. How to write a block:
// docs/block-algebra.md.

import { modInverse } from '../util.js';

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const mod = (x, n) => ((x % n) + n) % n;
// Ring sizes a core allows, smallest first.
function ringSizes(core) { const out = []; for (let n = 3; n < 64; n++) if (gcd(n, core) === 1) out.push(n); return out; }
// 0 picks for the core: the smallest ring, and the next one at least four points larger
// (3 and 7 on 8,000 cells; 13 and 17 on 55,440).
function points(P, core) {
  const sizes = ringSizes(core), a = P.NA || sizes[0];
  return { a, b: P.NB || sizes.find((n) => n >= a + 4) };
}

// ---------------------------------------------------------------------------
// dual-imp-pump (10 instructions)
//
//   dpFeed  SPL   #SA+1, #SB+1    the feeder: one new worker a round; its fields are the strides
//   dpCa    MOV   dpImpA, }dpCar  a carpet of A-imps, one cell a pass, under the first arm
//   dpCb    MOV   dpImpB, >dpCar  and of B-imps
//   dpAdd   ADD.F dpFeed, dpVec   both launch vectors on by a step and a cell
//   dpLb    SPL   @dpVec          a process to the B spiral
//   dpLa    JMP   *dpVec          and this one to the A spiral
//   dpCar   DAT   carpet A, carpet B
//   dpVec   DAT   launch A, launch B
//   dpImpA  MOV.I #SA, *0
//   dpImpB  MOV.I #1, SB
//
// Imp k of a spiral starts at head + k * (step + 1). Each cell it steps onto was
// written one round earlier by imp k - 1 (which is a step and a cell behind it
// in the ring but a round ahead in time); imp 0 has nobody before it, so the
// pump lays its path: one imp instruction a pass from the head on.
function dpPlan(P, core) {
  const n = points(P, core);
  return { n, sa: modInverse(n.a, core), sb: modInverse(n.b ?? 1, core) };
}
const isA = (x, sa, core) => x.op === 'MOV' && x.mod === 'I' && x.aMode === '#' && x.bMode === '*' && mod(x.a, core) === sa && x.b === 0;
const isB = (x, sb, core) => x.op === 'MOV' && x.mod === 'I' && x.aMode === '#' && x.bMode === '$' && mod(x.b, core) === sb;

const dualImpPump = {
  id: 'dual-imp-pump', kind: 'body', exit: 'never', writes: 'sparse', roams: true, dialects: '94',
  processes: 8, grows: true,
  purpose: 'A continuous pump feeding two imp spirals of different sizes at once: NA-point imps with the step in the A-field (mov.i #step, *0) and NB-point imps with it in the B-field (mov.i #1, step), DISTA and DISTB cells away. Every pass sends one process to each spiral, a step and a cell past the last, and lays one more cell of each first arm\'s path. NA or NB 0 picks for the core (3 and 7 on 8,000 cells, 13 and 17 on 55,440). 10 instructions.',
  params: { NA: [0, 31], NB: [0, 31], DISTA: [200, 50000], DISTB: [200, 50000] },
  defaults: { NA: 0, NB: 0, DISTA: 1500, DISTB: 4200 },
  entry: 'dpFeed', loop: 'dpFeed',
  mutable: [['dpCar', ['a', 'b']], ['dpVec', ['a', 'b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [], { n, sa, sb } = dpPlan(P, core);
    for (const [name, v] of [['NA', n.a], ['NB', n.b]]) if (!v || v < 3 || gcd(v, core) !== 1) out.push(`dual-imp-pump: no ${v ?? P[name]}-point imp ring on a ${core}-cell core (${name})`);
    if (out.length) return out;
    if (n.a === n.b) out.push('dual-imp-pump: NA and NB must differ (two rings of different sizes)');
    for (const [name, d] of [['DISTA', P.DISTA], ['DISTB', P.DISTB]]) if (d > core - 4 * settings.maxLength) out.push(`dual-imp-pump: ${name} ${d} puts a spiral on the warrior itself on a ${core}-cell core`);
    if (Math.abs(P.DISTA - P.DISTB) < 200) out.push('dual-imp-pump: DISTA and DISTB put the two first arms on top of each other');
    // The first few launch points of each spiral must miss the pump.
    for (const [d, s] of [[P.DISTA, sa], [P.DISTB, sb]]) for (let k = 1; k < 64; k++) { const c = mod(d + k * (s + 1), core); if (c < settings.maxLength + 8 || c > core - settings.maxLength - 8) { out.push('dual-imp-pump: an early launch point lands on the warrior'); break; } }
    return [...new Set(out)];
  },
  emit(ctx) {
    const { L, P, core } = ctx, { sa, sb } = dpPlan(P, core), vec = L('dpVec'), car = L('dpCar');
    ctx.ins('dpFeed', 'SPL', 'B', `#${sa + 1}`, `#${sb + 1}`);
    ctx.ins('dpCa', 'MOV', 'I', L('dpImpA'), `}${car}`);
    ctx.ins('dpCb', 'MOV', 'I', L('dpImpB'), `>${car}`);
    ctx.ins('dpAdd', 'ADD', 'F', L('dpFeed'), vec);
    ctx.ins('dpLb', 'SPL', 'B', `@${vec}`);
    ctx.ins('dpLa', 'JMP', 'B', `*${vec}`);
    // The heads are DISTA and DISTB from dpVec. By the time a worker launches, the
    // workers behind it have stepped the vector: once for its SPL, twice for its JMP.
    ctx.ins('dpCar', 'DAT', 'F', `$${P.DISTA + 1}`, `$${P.DISTB + 1}`);
    ctx.ins('dpVec', 'DAT', 'F', `$${mod(P.DISTA - 2 * (sa + 1), core)}`, `$${mod(P.DISTB - (sb + 1), core)}`);
    ctx.ins('dpImpA', 'MOV', 'I', `#${sa}`, '*0');
    ctx.ins('dpImpB', 'MOV', 'I', '#1', `${sb}`);
  },
  running(api) {
    const { sa, sb } = dpPlan(api.P, api.core);
    return api.vm.processes(0).some((q) => { const x = api.vm.peek(q); return isA(x, sa, api.core) || isB(x, sb, api.core); });
  },
  watch(api) {
    const { vm, core, P } = api, { n, sa, sb } = dpPlan(P, core);
    const vec = api.at('dpVec'), la = api.at('dpLa'), lb = api.at('dpLb');
    const heads = { a: api.norm(vec + P.DISTA), b: api.norm(vec + P.DISTB) };
    let na = 0, nb = 0;
    const intact = () => ['dpFeed', 'dpCa', 'dpCb', 'dpAdd', 'dpLb', 'dpLa', 'dpImpA', 'dpImpB'].every((l) => api.same(vm.peek(api.at(l)), api.code(l)));
    return {
      before(pc) {
        if (!api.entered()) return null;             // not running (a switch's other branch): a partner's imp may cross these cells
        if (pc !== la && pc !== lb) return null;
        if (!intact()) return null;                    // a partner or the gate has damaged the pump
        const v = vm.peek(vec);
        if (pc === la) {
          const t = api.norm(vec + v.a);
          if (t !== api.norm(heads.a + na * (sa + 1))) throw new Error(`dual-imp-pump: A launch ${na} is not a step and a cell past the last`);
          na++;
        } else {
          const t = api.norm(vec + v.b);
          if (t !== api.norm(heads.b + nb * (sb + 1))) throw new Error(`dual-imp-pump: B launch ${nb} is not a step and a cell past the last`);
          nb++;
        }
        return null;
      },
      final() {
        if (!api.entered()) return;                  // under a switch: the branch not taken this round
        if (!api.alone) return;
        if (na < 2 * n.a || nb < 2 * n.b) throw new Error(`dual-imp-pump launched too little (${na} A, ${nb} B)`);
        let a = 0, b = 0;
        for (const q of vm.processes(0)) { const x = vm.peek(q); if (isA(x, sa, core)) a++; else if (isB(x, sb, core)) b++; }
        // Nothing launched has died. (An imp whose next cell its predecessor writes later this round stands on an empty cell for now.)
        if (vm.processes(0).length < na + nb) throw new Error(`dual-imp-pump lost imps: ${vm.processes(0).length} processes after ${na} + ${nb} launches`);
        if (a < n.a || b < n.b) throw new Error(`dual-imp-pump: ${a} A-imps and ${b} B-imps do not fill a ${n.a}- and a ${n.b}-point ring`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// impstep-clear (6 instructions + PAD)
//
//   icGate  DAT   $first, $0       A: the bomb pointer. The LOWEST cell of the block.
//   icBomb  DAT   $first - step, <step     the bomb, and the DAT an imp steps onto after the gate
//   [PAD spare DAT cells]
//   icClr   SPL   #0, 0            the pump
//   icMov   MOV   icBomb, *icGate  bomb
//   icAdd   ADD.A #step, icGate    one ring point on
//   icDjn   DJN.B icMov, *icGate   decrement the B-field of the cell icGate points at
//
// What it does on its own: POINTS * step = 1 (mod core), so every POINTS bombs
// the pattern is one cell further on: POINTS fronts, core / POINTS apart, each
// walking forward. After a lap the front that started just below the block
// reaches icGate: the bomb's A-field is `first - step`, the ADD makes it
// `first`, and the lap starts again. (One process alone runs MOV, ADD, DJN;
// the pumped processes settle into ADD, MOV, DJN in time, so the DJN decrements
// the bomb just laid.) The cells that are the block shifted by a ring step are
// never bombed: SIZE * (POINTS - 1) of them.
//
// How it kills an imp spiral (traced in the VM against a 64-process 13-point
// spiral on 55,440 cells; ten rounds, 640 imps). Not by its laps: until an arm
// reaches the block the spiral usually has all its processes. Imps climb, so the
// first cell of the block an arm reaches is icGate, and the arm before it
// copies `mov 0, S` onto it:
//   1. That copy has A-field 0, so the clear's pointer is now the gate itself,
//      a cell of the ring. The next bombs fall an imp step apart: on the cells
//      the other arms are about to execute, in ring order, and after POINTS of
//      them on the next row. 56% of the imps died on a bomb laid in the few
//      hundred cycles after the first contact.
//   2. While the copy's A-field is 0 the DJN.B decrements its B-field, and the
//      ADD.A changes its A-field every pass; an imp that executes it copies the
//      wrong cell to the wrong place, so the next arm's cell is not refreshed.
//      18% died on a cell nothing had written.
//   3. The imp steps off the gate onto icBomb, a DAT (6% died on the gate or on
//      icBomb). With SPL #0 in that place (the first layout) the imps were
//      captured into the clear's own loop instead and the round was often a tie.
// The rest (16%) died on bombs of the ordinary laps. Each part matters, measured
// over 20 rounds against the same spiral: with a JMP for the DJN 8 wins and 12
// ties; with step 1 instead of an imp step 2 wins, 12 ties, 6 losses (the
// re-aimed pointer walks straight into its own code); with the 17-point step
// against the 13-point spiral 15 wins and 5 ties; as built, 40 wins in 40.
//
// The price: the re-aimed walk comes back beside the gate. Bomb POINTS lands on
// icBomb (harmless: it is the bomb), each cell above it takes POINTS more, and
// then the walk reaches SPL #0 and the loop. Against a spiral alone the round is
// over by then; against a spiral with any other process (measured: the spiral
// plus one `jmp 0` 25,000 cells away) the clear killed the imps and then itself
// in 6 of 20 rounds, and a longer PAD alone did not help (PAD 21 or 31: still 6).
//
// TRIP 1 stops the walk. icTrip, a zero cell right after icBomb, is a cell only
// the re-aimed walk ever bombs (an ordinary lap never touches the block), POINTS
// bombs after icBomb. Every process the SPL #0 pump makes passes icChk first:
// trip still zero, on to the loop; trip bombed, the pointer goes back to the start
// of an ordinary lap and the trip is zeroed again. The loop itself is unchanged,
// so the kill is not slowed; but the pump makes a process only once every N
// turns when N processes run, so PAD must give the walk room to wait: with PAD 20
// (TRIP 1, 30 cells) it won 40 of 40 rounds against the spiral with the survivor
// and 38 (2 ties) against the spiral alone; with PAD 6 or 12 the walk still
// reached the loop in 6 and 3 rounds of 20. The step cannot be
// changed between laps to cover the blind cells either: the kill needs the
// gate's walk to use an imp step every time (a version whose later laps used
// the next ring size won 20, tied 7 and lost 13 of 40).
const icStep = (P, core) => modInverse(P.POINTS || ringSizes(core)[0], core);
const icSize = (P) => 6 + P.PAD + (P.TRIP ? 4 : 0);
// A 64-process spiral of the ring size the clear is set for: the opponent the watch duels.
// With `survivor`, the spiral first copies a one-process `jmp 0` 45% of the core away and starts it
// there, so the round goes on after the imps are dead.
function icSpiral(points, core, survivor = false) {
  const s = modInverse(points, core), far = Math.floor(core * 0.45);
  const head = survivor ? ['ORG xx', `xx mov.i surv, surv+${far}`, ` spl.b surv+${far}, 0`, ' jmp go, 0', 'surv jmp 0, 0'] : ['ORG go'];
  return [';name spiral', ...head, 'go spl 1', ' spl 1', ' spl 1', ' spl 1', ' spl 1', ' spl 1',
    ' spl ad', ' jmp @vec', `ad add.ab #${s}, vec`, 'vec dat #0, #imp-vec', `imp mov.i 0, ${s}`, 'END'].join('\n');
}
const impstepClear = {
  id: 'impstep-clear', kind: 'finisher', exit: 'never', writes: 'core', roams: false, dialects: '94',
  relocatable: false, protects: 'image',
  processes: 8, grows: true,
  purpose: 'A SPL #0-pumped clear that advances by an imp step (POINTS-point ring; 0: the smallest the core allows) and whose pointer cell is the lowest cell of the block, followed by its DAT. It covers the core in POINTS fronts and laps. Its use is against imp spirals, and it kills them at its gate, not in the open core: the first arm to climb onto the block copies its imp over the pointer cell, whose A-field 0 re-aims the clear at the ring itself, so the next bombs fall an imp step apart on the cells the other arms are about to execute; meanwhile the loop keeps altering that copy (ADD.A its A-field, DJN.B its B-field), so the imp that runs it breaks the ring, and it then steps onto the DAT. Against a 64-process 13-point spiral on 55,440 cells: 40 wins in 40 rounds (a plain d-clear: 40 ties). Limits: the re-aimed walk comes back beside the gate after POINTS bombs, so it would reach its own pump soon after the kill; TRIP 1 (default) stops that: a zero cell just above its DAT that only the re-aimed walk ever bombs, checked by every process the pump makes, sends the pointer back to an ordinary lap (against the spiral plus one far-away jmp 0: 40 wins in 40 with TRIP 1 and PAD 20, 14 wins and 6 losses in 20 without); the block\'s own cells shifted by a ring step are never bombed. 6 instructions + PAD, 4 more with TRIP (30 at the defaults).',
  params: { POINTS: [0, 31], PAD: [0, 60], TRIP: [0, 1], LATE: [0, 60] },
  // TRIP 0: PAD 6 (on 8,000 cells a 3-point ring brings the re-aimed walk back every 3 bombs;
  // against a 64-process 3-point spiral PAD 2 won 35, tied 2 and lost 3 of 40, PAD 6 won 37 and
  // tied 3). TRIP 1: PAD 20, so the walk can wait for the pump's next process (see above).
  defaults: { POINTS: 0, PAD: 20, TRIP: 1, LATE: 0 },
  entry: 'icClr', entryFirst: false, loop: 'icMov',
  provides: { datBomb: 'icBomb' },
  mutable: [['icGate', ['op', 'mod', 'aMode', 'a', 'bMode', 'b']], ['icBomb', ['b']], ['icTrip', ['op', 'mod', 'aMode', 'a', 'bMode', 'b']]],
  mismatches(P, settings) {
    const core = settings.coreSize;
    if (P.POINTS && (P.POINTS < 3 || gcd(P.POINTS, core) !== 1)) return [`impstep-clear: no ${P.POINTS}-point imp ring on a ${core}-cell core`];
    return [];
  },
  emit(ctx) {
    const { L, P, core, span } = ctx, idx = ctx.pc(), s = icStep(P, core);
    const first = Math.max(span - idx, icSize(P));    // the first cell past the image, from icGate
    ctx.ins('icGate', 'DAT', 'F', `$${first}`, '$0');
    ctx.ins('icBomb', 'DAT', 'F', `$${mod(first - s, core)}`, `<${s}`);
    // LATE of the PAD cells come before the trip: the walk bombs the trip POINTS x (LATE + 2) bombs after it starts.
    const late = P.TRIP ? Math.min(P.LATE, P.PAD) : 0;
    for (let i = 0; i < late; i++) ctx.ins('', 'DAT', 'F', '$0', '$0');
    if (P.TRIP) ctx.ins('icTrip', 'DAT', 'F', '$0', '$0');
    for (let i = late; i < P.PAD; i++) ctx.ins('', 'DAT', 'F', '$0', '$0');
    ctx.ins('icClr', 'SPL', 'B', '#0', '0');
    if (P.TRIP) {
      // Each new process: trip still zero, to the loop; bombed, back to an ordinary lap.
      ctx.ins('icChk', 'JMZ', 'B', L('icMov'), L('icTrip'));
      ctx.ins('icRst', 'MOV', 'A', `#${first}`, L('icGate'));
      ctx.ins('', 'MOV', 'AB', '#0', L('icTrip'));
    }
    ctx.ins('icMov', 'MOV', 'I', L('icBomb'), `*${L('icGate')}`);
    ctx.ins('icAdd', 'ADD', 'A', `#${s}`, L('icGate'));
    ctx.ins('icDjn', 'DJN', 'B', L('icMov'), `*${L('icGate')}`);
  },
  watch(api) {
    const { vm, core, P } = api, s = icStep(P, core);
    const gate = api.at('icGate'), mov = api.at('icMov'), bombAt = api.at('icBomb');
    const sameBomb = (x) => { const b = api.code('icBomb'); return x.op === 'DAT' && x.aMode === b.aMode && x.bMode === b.bMode && api.norm(x.a) === api.norm(b.a); };
    const rst = P.TRIP ? api.at('icRst') : -1;
    let last = null, bombs = 0, laps = 0, resets = 0;
    return {
      before(pc) {
        if (!api.entered()) return null;             // not running (a switch's other branch): a partner's imp may cross these cells
        if (pc === rst) resets++;
        if (pc !== mov || !api.same(vm.peek(pc), api.code('icMov'))) return null;
        return api.norm(gate + vm.peek(gate).a);
      },
      after(t) {
        if (t === null) return;
        if (t === gate) { laps++; last = null; return; }
        if (api.inSelf(t) || (api.inImage(t) && !api.inDead(t) && api.rel(t, api.image.start) > api.rel(gate, api.image.start))) throw new Error('impstep-clear bombed its own warrior');
        if (!sameBomb(vm.peek(t))) throw new Error('impstep-clear dropped something other than its bomb');
        // Each bomb is an imp step past the last; the pumped processes overlap, so a step can be doubled or tripled.
        const d = last === null ? s : api.norm(t - last);
        if (![0, s, api.norm(2 * s), api.norm(3 * s)].includes(d)) throw new Error('impstep-clear left the imp-step lattice');
        last = t; bombs++;
      },
      final() {
        if (!api.entered()) return;                  // under a switch: the branch not taken this round
        if (!api.alone) return;
        if (bombs < 1000) throw new Error(`impstep-clear bombed too little (${bombs})`);
        if (!sameBomb(vm.peek(bombAt))) throw new Error('impstep-clear lost the DAT after its gate');
        if (resets) throw new Error(`impstep-clear reset its walk ${resets} times with nothing to re-aim it`);
        if (P.TRIP && vm.peek(api.at('icTrip')).b !== 0) throw new Error('impstep-clear bombed its own trip cell in an ordinary lap');
        void laps;
        // The promise: a 64-process spiral of the ring size it is set for dies in at least four of six load offsets, the clear in at most one.
        if (api.image.start !== 0 || api.self.start !== 0) return;
        const points = P.POINTS || ringSizes(core)[0];
        // Six load offsets spread over the core. A spiral loaded about one ring step away can
        // reach the block before the clear has started, so one round of six may be lost.
        const offsets = [1, 2, 3, 4, 5, 6].map((k) => Math.floor((k * core) / 7) + 37 * k);
        let kills = 0, deaths = 0;
        for (const offset of offsets) {
          const r = api.duel(icSpiral(points, core), { offset });
          if (!r.ours) deaths++;
          else if (!r.theirs) kills++;
        }
        if (deaths > 1) throw new Error(`impstep-clear died against a ${points}-point spiral in ${deaths} of 6 rounds`);
        if (kills < 4) throw new Error(`impstep-clear killed a ${points}-point spiral in only ${kills} of 6 rounds`);
        // TRIP: the same spiral with a far-away jmp 0 beside it. The clear must outlive the kill and find the survivor.
        if (P.TRIP) {
          let wins = 0, lost = 0;
          for (const offset of offsets.slice(0, 4)) {
            const r = api.duel(icSpiral(points, core, true), { offset });
            if (!r.ours) { lost++; continue; }
            if (!r.theirs) wins++;
            // The walk was sent back before it climbed past the trip to the cell under the pump.
            if (P.PAD > P.LATE && r.vm.writeCycle[api.add(api.at('icClr'), -1)] >= 0) throw new Error('impstep-clear: the re-aimed walk climbed past its trip to the pump');
          }
          // Where the spiral reaches the block in time, a clear without the trip dies after the kill; this one may not.
          if (lost) throw new Error(`impstep-clear died after the kill in ${lost} of 4 rounds against a ${points}-point spiral with a survivor beside it`);
          if (wins < 3) throw new Error(`impstep-clear beat a ${points}-point spiral with a survivor in only ${wins} of 4 rounds`);
        }
      },
    };
  },
};

export default [dualImpPump, impstepClear];
