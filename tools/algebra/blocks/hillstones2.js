// More hill stone endings and launchers (docs/hill-recipe-book.md, the stones
// and stone/imp chapter; gaps #7, #15, #9). Everything here is written from
// scratch; the hill warriors named are studied for their mechanism, never
// copied. Ring, ICWS'94 only.
//
// Three blocks, each a trick the earlier hill-stone / timed-stone blocks do not
// cover:
//
//   armadillo-switch (gap #7)  -- a self-copying stone whose A-trail copies its
//     own SPL over its DJN after a few thousand cycles, so every process falls
//     through into a two-line gated forward clear; the bomb's B-field (HOP + 1,
//     larger than the code) resets the clear pointer past the warrior when the
//     clear laps onto the gate, so the clear sweeps the core forever without
//     ever writing its own code. Tolypeutes #6, Armadillo #33, Elven King #42.
//
//   self-add-stone (gap #15)   -- the {0,}0 self-adding three-line stone: one
//     MOV lays a bomb, one ADD.AB {0,}0 advances the MOV's own pointer with no
//     separate increment cell (the loop line's A-field is both the source
//     pointer and the step), one DJN.F folds in an anti-imp decrement stream.
//     Positive Knife #47, Black Knight #112, Cloudrunner #108.
//
//   delayed-pump (gap #9)      -- an imp launcher that idles a set number of
//     passes before it starts pumping, so a stone sharing the process table
//     claims its slots first; then a continuous pump places and splits a new
//     N-point imp every pass. Uninvited #59, Red Dragon #45 (djn #0, #5 idle).
//
// On an 8,000-cell core a bomber or stone reaching >= 100 cells has
// gcd(STEP, core) <= 80, so (as hill-stone and timed-stone explain) strict
// layout safety to 100 cells is impossible here: safety comes from the bomb
// residue class meeting none of the block's own cells, as in stones.js. The
// self-add stone keeps its MOV's residue class off its code the same way; its
// SPL #0 feeder keeps it alive when a folded DJN-stream cell reaches zero and a
// single process would fall through and die.

import { modInverse } from '../util.js';
import {observeArmadillo,verifyArmadillo} from '../observation-roles.js';

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const mod = (x, n) => ((x % n) + n) % n;

// ---------------------------------------------------------------------------
// gap #7: the Armadillo stone switch.
//
// The loop is five lines: a feeder SPL, an A-trail MOV (reads a cell well below
// and writes a DAT a little above, both pointers predecrementing), a second MOV
// that drops the bomb on the B-trail, an ADD that steps both trails together,
// and a DJN that folds in a decrement stream and loops back. The A-trail is set
// so that, after a few thousand cycles, its read reaches the feeder SPL and its
// write lands on the DJN: the DJN is overwritten by a copy of the SPL. From
// then on the "loop" is two SPL feeders, and every process pours through into
// the two cells below -- `MOV bomb, >GATE` and `DJN.F -1, >GATE`, a forward
// clear of one DAT plus one decrement per two instructions. Because the bomb's
// B-field is HOP + 1 (bigger than the block), when the sweep laps round onto
// GATE itself the clear pointer is flung HOP + 1 cells past the code, so the
// clear never runs over its own two lines.
const armadilloSwitch = {
  id: 'armadillo-switch', kind: 'body', exit: 'never', writes: 'core', roams: false,
  grows: true, processes: 8, dialects: '94',
  purpose: 'A self-copying stone whose A-trail copies its own SPL over its DJN, dropping processes into a two-line gated forward clear. The HOP+1 bomb B-field resets the pointer past its code each lap. STREAM0 uses the original folded B-predecrement DJN stream; STREAM1 uses A-indirect *-3 through the moving trail pointer. ANTISTEP sets the DAT bomb\'s remote B-predecrement distance; default1 preserves the original bomb.',
  params: { STEP: [1, 4000], HOP: [8, 400], STREAM:[0,1], ANTISTEP:[1,7999] },
  defaults: { STEP: 3510, HOP: 56, STREAM:0, ANTISTEP:1 },
  observationRole:'stone-clear',observe:observeArmadillo,verifyObservation:verifyArmadillo,
  phaseContract:{minimumClearWrites:100,requiresNaturalHandoff:true,requiresHealthyClearProcessAtEnd:true},
  entry: 'asInc', loop: 'asLoop',
  provides: { datBomb: 'asBomb' },
  coldStart: { entry: 'asLoop', feeder: 'asInc', gate: 'asInc-6' },
  mutable: [['asAmov', ['a', 'b']], ['asInc', ['b']], ['asLoop', ['a', 'b']], ['asCmov', ['b']], ['asCdjn', ['b']]],
  mismatches(P, settings) {
    const out = [];
    if (settings.dialect === '88') out.push("armadillo-switch: the self-copying switch needs ICWS'94 (A-field indirection and modifiers)");
    if (P.HOP < 8) out.push(`armadillo-switch: HOP ${P.HOP} must clear the block (about 8 cells)`);
    return out;
  },
  emit(ctx) {
    const { L, P } = ctx;
    // The feeder: SPL #x acts as SPL 0, an unbounded feeder into the A-trail
    // line; its B is the decrement stream the DJN below also folds in.
    ctx.ins('asInc', 'SPL', 'B', `#${P.STEP}`, `<${L('asInc')}-${P.STEP}`);
    // A-trail: read a cell STEP below (mostly empty), write a DAT just above the
    // loop. When the read reaches the feeder SPL, the write lands on the DJN.
    ctx.ins('asAmov', 'MOV', 'I', `{${P.STEP}`, `<${L('asLoop')}-${P.STEP}-${P.HOP}`);
    // B-trail: drop the bomb at the pointer the A-trail line keeps (@-1).
    ctx.ins('asBmov', 'MOV', 'I', L('asBomb'), '@-1');
    // Step both trails by STEP each pass (add the feeder's A and B into asAmov).
    ctx.ins('asAdd', 'ADD', 'F', L('asInc'), '-2');
    // The loop: back to the A-trail line, plus a folded decrement stream.
    ctx.ins('asLoop', 'DJN', 'F', '@-1', P.STREAM?'*-3':`<${L('asInc')}-${P.STEP}`);
    // The forward clear the processes fall into once the SPL overwrites the DJN.
    ctx.ins('asCmov', 'MOV', 'I', L('asBomb'), `>${L('asInc')}-6`);
    ctx.ins('asCdjn', 'DJN', 'F', '-1', `>${L('asInc')}-6`);
    // The bomb: B = HOP + 1 resets the clear pointer past the code on each lap.
    // DAT still resolves its operands before killing a process. A remote
    // predecrement can damage another imp leg, including a friendly one.
    // This is relative to each executed bomb, not to the original template.
    ctx.ins('asBomb', 'DAT', 'F', `<${P.ANTISTEP??1}`, `${P.HOP}+1`);
  },
  watch(api) {
    const incAt = api.at('asInc'), loopAt = api.at('asLoop'), cmovAt = api.at('asCmov');
    let switched = false, switchCycle = null, clearWrites = 0;
    return {
      before(pc) {
        // The switch: the DJN cell now holds a copy of the feeder SPL.
        if (!switched) {
          const l = api.vm.peek(loopAt);
          if (l.op === 'SPL') { switched = true; switchCycle = api.vm.cycle; }
        }
        // A clear write: a process on asCmov while asCmov is still itself.
        if (pc === cmovAt && api.same(api.vm.peek(pc), api.code('asCmov'))) {
          return api.norm(cmovAt + api.vm.peek(cmovAt).b);
        }
        return null;
      },
      after(tok) {
        if (tok === null) return;
        if (!switched) return;                       // a stray pre-switch read
        if (api.inSelf(tok)) throw new Error('armadillo-switch cleared its own code');
        clearWrites++;
      },
      final() {
        if (!api.alone) return;
        if (!switched) throw new Error('armadillo-switch never copied its SPL over its DJN');
        if (clearWrites < 100) throw new Error(`armadillo-switch's forward clear ran too little (${clearWrites} writes)`);
        void switchCycle;
      },
    };
  },
};

// ---------------------------------------------------------------------------
// gap #15: the {0,}0 self-adding three-line stone.
//
// The MOV copies the cell STEP below itself (empty, so a DAT) to a cell its
// B-field points at; the ADD.AB {0,}0 above resolves both operands to the MOV
// line (its own predecremented A-field points one cell back) and adds the MOV's
// A-field (= STEP) into the MOV's B-field, walking the write pointer forward by
// STEP each pass with no separate increment cell. The DJN.F folds in an anti-
// imp decrement stream and loops. An SPL #0 feeder keeps the warrior alive when
// a stream cell reaches zero and a lone process would fall through and die.
const selfAddStone = {
  id: 'self-add-stone', kind: 'body', exit: 'never', writes: 'sparse', roams: false,
  grows: true, processes: 8, dialects: '94',
  purpose: 'A three-line {0,}0 stone: one MOV lays a DAT, one ADD.AB {0,}0 advances the MOV\'s own pointer by STEP with no increment cell (the loop line\'s A-field is both source pointer and step), one DJN.F folds in an anti-imp decrement stream. An SPL #0 feeder keeps it alive through stream-driven fall-throughs.',
  params: { STEP: [1, 4000] },
  defaults: { STEP: 2920 },
  entry: 'safFeed', loop: 'safLay',
  mutable: [['safLay', ['b']], ['safDjn', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, g = gcd(P.STEP, core), out = [];
    if (core / g < 100) out.push(`self-add-stone: STEP ${P.STEP} reaches only ${Math.floor(core / g)} cells of the core`);
    if (g < 16) out.push(`self-add-stone: gcd(STEP, core) = ${g} is too small to keep the MOV's residue class off its own code`);
    return out;
  },
  emit(ctx) {
    const { L, P, core, total } = ctx;
    // Feeder: SPL 0, an unbounded feeder into the loop below.
    ctx.ins('safFeed', 'SPL', 'B', '#0', '0');
    // The laying MOV: A = STEP (source STEP below, empty -> a DAT; also the
    // step), B walks forward. Its first write lands at `total`, just past the
    // warrior, on a residue class (total mod g) empty of the block.
    const layIdx = ctx.pc();
    ctx.ins('safLay', 'MOV', 'I', `$${P.STEP}`, `$${mod(total - layIdx, core)}`);
    // The self-add: both operands resolve one cell up (to safLay); .ab adds
    // safLay's A-field (STEP) into its B-field. No increment cell.
    ctx.ins('safAdd', 'ADD', 'AB', '{0', '}0');
    // Loop, folding a backward decrement stream (anti-imp).
    ctx.ins('safDjn', 'DJN', 'F', L('safLay'), '<-500');
  },
  watch(api) {
    const layAt = api.at('safLay');
    const cells = new Set();
    return {
      before(pc) {
        if (pc !== layAt) return null;
        const cur = api.vm.peek(layAt);
        // The MOV must still be itself (same opcode and A-field, B walks).
        if (cur.op !== api.code('safLay').op || api.norm(cur.a) !== api.norm(api.code('safLay').a)) return null;
        return api.norm(layAt + cur.b);
      },
      after(tok) {
        if (tok === null) return;
        if (api.inSelf(tok)) throw new Error('self-add-stone bombed its own code');
        cells.add(tok);
      },
      final() {
        if (api.alone && cells.size < 100) throw new Error(`self-add-stone bombed too few cells (${cells.size})`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// gap #9: the delayed imp launcher.
//
// A DJN idles DELAY passes before anything launches, so a stone sharing the
// process table fills its own slots first (Uninvited #59 / Red Dragon #45 use
// `djn #0, #5` ahead of their pump). Only then does the single idle process
// fall into a one-pass vector launch: K SPLs fan it into 2^K processes, each
// reaches a JMP @vec in the same pass, and the interleaved adders send
// consecutive jumpers STEP apart (STEP = modInverse(POINTS, core)), so the 2^K
// imps come up as one self-sustaining POINTS-point spiral -- robust enough to
// keep crawling beside a core-bombing partner, as a burst launch must be.
//
// This delivers the idle ("delayed pump") part of gap #9. A continuous pump
// that adds one imp per pass (the hill's growing spiral) and the Quicksilver
// cap that bombs the launcher on its Nth pass are noted as still-open in the
// block group's report; a naive one-per-pass pump collapses its imps onto the
// same POINTS residues, so the robust burst is used here instead.
const delayedPump = {
  id: 'delayed-pump', kind: 'body', exit: 'never', writes: 'sparse', roams: true,
  layout: 'last', dialects: '94',
  purpose: 'An imp launcher that idles DELAY passes (so a partner stone claims process slots first), then fires a one-pass vector launch of a POINTS-point spiral of 2^K imps -- self-sustaining, like a delayed vector-spiral.',
  params: { DELAY: [1, 2000], POINTS: [3, 31], K: [1, 6] },
  defaults: { DELAY: 200, POINTS: 13, K: 4 },
  entry: 'dpIdle', loop: 'dpIdle',
  processes: (P) => 2 ** (P.K + 1),          // 2^K jumpers and 2^K adders; the adders die on the vector
  mutable: [['dpVec', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, step = modInverse(P.POINTS, core), M = 2 ** P.K, out = [];
    if (settings.dialect === '88') return ["delayed-pump: the imp and vector launch need ICWS'94"];
    if (!step) return [`delayed-pump: no ${P.POINTS}-point imp spiral on a ${core}-cell core`];
    if (M < P.POINTS) out.push('delayed-pump: fewer imps than points');
    for (let i = 1; i < M; i++) if ((i * step) % core > core - settings.maxLength) { out.push(`delayed-pump: a ${P.POINTS}-point imp lands on the launcher`); break; }
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, step = modInverse(P.POINTS, core);
    // Idle: a single process spins DELAY turns, then falls into the launch.
    ctx.ins('dpIdle', 'DJN', 'B', L('dpIdle'), `#${P.DELAY}`);
    // K SPLs fan one process into 2^K, all reaching the jump in one pass.
    for (let i = 0; i < P.K; i++) ctx.ins(i ? '' : 'dpStart', 'SPL', 'B', '1');
    // The tail: a jumper then an adder; the jumpers land STEP apart, the adders
    // step the vector and die on it; the vector points at the imp.
    ctx.ins('dpSplit', 'SPL', 'B', L('dpAdd'));
    ctx.ins('dpJump', 'JMP', 'B', `@${L('dpVec')}`);
    ctx.ins('dpAdd', 'ADD', 'AB', `#${step}`, L('dpVec'));
    ctx.ins('dpVec', 'DAT', 'F', '#0', `#${L('dpImp')}-${L('dpVec')}`);
    ctx.ins('dpImp', 'MOV', 'I', '0', `${step}`);
  },
  // Moving body: it runs in copies of its imp, not in its launcher code.
  running: (api) => { const imp = api.code('dpImp'); return api.vm.processes(0).some((q) => api.same(api.vm.peek(q), imp)); },
  watch(api) {
    const idleAt = api.at('dpIdle'), imp = api.code('dpImp');
    let enteredAt = null, firstImp = null;
    const isImp = (q) => api.same(api.vm.peek(q), imp);
    return {
      before(pc) {
        if (enteredAt === null && pc === idleAt) enteredAt = api.vm.cycle;
        if (firstImp === null && api.vm.processes(0).some(isImp)) firstImp = api.vm.cycle;
        return null;
      },
      after() {},
      final() {
        if (!api.alone) return;
        if (firstImp === null) throw new Error('delayed-pump never launched an imp');
        // The idle must hold the launch back about DELAY passes.
        if (enteredAt !== null && firstImp - enteredAt < api.P.DELAY - 4) {
          throw new Error(`delayed-pump launched after only ${firstImp - enteredAt} cycles, not ~${api.P.DELAY}`);
        }
        // The spiral came up whole: 2^K imps, standing STEP apart in queue order.
        const procs = api.vm.processes(0), want = 2 ** api.P.K;
        if (procs.length !== want) throw new Error(`delayed-pump has ${procs.length} imps, not ${want}`);
        if (!procs.every(isImp)) throw new Error('a delayed-pump process left the imp');
        const step = api.norm(imp.b);
        let breaks = 0;
        for (let i = 1; i < procs.length; i++) if (api.norm(procs[i] - procs[i - 1]) !== step) breaks++;
        if (breaks > 1) throw new Error('delayed-pump imps are not STEP apart: the launch was out of step');
      },
    };
  },
};

export default [armadilloSwitch, selfAddStone, delayedPump];
