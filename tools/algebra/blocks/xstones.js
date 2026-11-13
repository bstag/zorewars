// X-hill stones (docs/hill-top30/block-gaps.md, section "X"; docs/hill-top30/94x.md):
//
//   remote-bomb-stone  -- a five-process stone whose loop and bomb live apart.
//     The boot plants the bomb BDIST cells away; the loop copies it from there
//     and watches its B-field with a JMN. When the remote bomb is destroyed, or
//     when the stone's own blank lattice comes round to it (time-up), every
//     process falls through into a d-clear. Four of the X hill's top five carry
//     a stone of this kind. It is not `airbag-stone` (which repairs itself from
//     a template): nothing here is repaired, the stone gives up and clears.
//
//   movthrough-stone   -- the "mov-through" stone of five X-hill warriors: one
//     MOV carries whatever sits at a forward pointer to a backward pointer, both
//     stepping STEP. On its last pass the forward pointer is the stone's own
//     increment cell and the backward pointer its own loop line, so the loop is
//     overwritten with a NOP and the processes fall through into a
//     `mov bomb, }gate / djn.f` forward clear.
//
// Both keep an exact, bounded process count: P processes in an L-line loop with
// P = L + 1, each entering one line after the one before it (a `JMP >0`
// dispatcher). The core then sees the loop executed in order, one instruction a
// cycle, exactly as one process would run it, so no pass is skipped or doubled
// and the time-up is exact; but any one process can die and the rest carry on.
// PROCS 1 leaves the fan out: one process, or L + 1 arriving in lockstep from a
// `fanboot`, enter at the dispatcher.
//
// All Redcode here is written from scratch; the hill warriors were read for the
// mechanism, never copied. Ring, ICWS'94 only. How to write a block:
// docs/block-algebra.md.

import { modInverse } from '../util.js';

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const mod = (x, n) => ((x % n) + n) % n;
const EVERY = ['op', 'mod', 'aMode', 'a', 'bMode', 'b'];
const ZERO = { op: 'DAT', mod: 'F', aMode: '$', a: 0, bMode: '$', b: 0 };

// The step of the smallest imp ring the core allows (3-point on 8,000, 13-point
// on 55,440): what the clear's DAT decrements at, so an imp that runs the bomb
// breaks the next arm of its own ring.
function antiImp(core) {
  for (let n = 3; n < 64; n++) if (gcd(n, core) === 1) return modInverse(n, core);
  return 1;
}

// Windows are [lo, hi) offsets from an anchor cell (may be negative).
const inWindow = (x, [lo, hi], core) => mod(x - lo, core) < hi - lo;
// What the lattice must miss: the block's own cells, and everything the linker
// says this block protects (the whole image, or its copy under a boot).
// OWN 1 (both stones) keeps only the block's own cells out of the plan. That is for a stone booted far
// from a large image (a fan boot inside a switch): the old image is dead code there, and the window the
// linker gives (the whole image) would end the stone after a few dozen passes. Live partners are still
// checked: the watch refuses a bomb on any live cell of the warrior.
function windowFor(anchorIdx, blockStart, blockSize, span) {
  let lo = blockStart - anchorIdx, hi = lo + blockSize;
  if (span > 0 && anchorIdx < span) { lo = Math.min(lo, -anchorIdx); hi = Math.max(hi, span - anchorIdx); }
  return [lo - 1, hi + 1];
}

// ---------------------------------------------------------------------------
// remote-bomb-stone
//
//   [rbFan  SPL 1 / MOV -1,0 / MOV -1,0]     PROCS 5: one process becomes five
//   rbGo    JMP   >0, 2            sends arrivals to rbPlant, rbLoop, rbW1, ...
//   rbGate  DAT   A, B             the two bomb pointers
//   rbPlant MOV   rbTpl, R         plants the remote bomb (run once)
//   rbLoop  ADD.F rbTpl, rbGate    both pointers on by 2*STEP
//   rbW1    MOV   R, *rbGate       a copy of the remote bomb
//   rbW2    MOV   R+1, @rbGate     a blank DAT (the cell after the remote bomb)
//   rbWatch JMN.B rbLoop, R        the remote bomb's B-field still there?
//   rbCm    MOV   rbDat, }rbGo     no: the d-clear; rbGo's A-field (0) is its gate, so the
//   rbCd    DJN.F rbCm, }rbGo     first write lands on rbGo and the bomb's A-field restarts it past the block
//   rbDat   DAT   <imp step, reset the gate past the block
//   rbTpl   DAT   <2*STEP, <2*STEP the bomb's template, and the loop's increment
//
// Pass k writes the bomb at gate + B0 + S + k*2S and a blank at gate + B0 + k*2S.
// B0 is set so the blank of pass T lands on the remote bomb itself: its B-field
// reads zero and the watch lets every process through. T is the largest count
// (at most TIME) for which no write before it touches the warrior.
const RB_MIN = 40;
function rbPlan(P, core, win) {
  const S = P.STEP, S2 = mod(2 * S, core), period = core / gcd(S2, core);
  // RETIRE: the cell RETIRE before the block (from the gate) takes the bomb of the last pass, so the
  // remote bomb must be one STEP before it. BDIST is then not used.
  const target = P.RETIRE ? mod(-rbGateIdx(P) - P.RETIRE, core) : null;
  const ok = (x) => mod(x, core) === target || !inWindow(x, win, core);
  let best = null;
  for (let adj = 0; adj < (P.RETIRE ? 1 : 24) && (!best || best.safe < period - 1); adj++) {
    const R = P.RETIRE ? mod(target - S, core) : P.BDIST + adj;               // remote bomb, from the gate
    let safe = -1;
    // j passes before the time-up the blank is at R - j*2S and the bomb S past it;
    // j = -1 is the pass still in flight when the watch first fails.
    let clear = ok(R) && ok(R + 1) && ok(R + S);
    for (let d = 0; d < 12 && clear; d++) clear = ok(R + S2 + d) && ok(R + S2 + S + d);   // the passes in flight at the time-up
    if (clear) {
      safe = period - 1;
      for (let j = 1; j < period; j++) {
        const b = mod(R - j * S2, core), a = mod(b + S, core);
        if (!ok(b) || !ok(a) || a === mod(R + 1, core) || a === target || b === target) { safe = j - 1; break; }
      }
    }
    if (!best || safe > best.safe) best = { R, safe };
  }
  const T = Math.max(1, Math.min(best.safe, P.TIME || best.safe));
  return { R: best.R, safe: best.safe, T, S2, B0: mod(best.R - T * S2, core), A0: mod(best.R - T * S2 + S, core) };
}
const rbSize = (P) => (P.PROCS === 5 ? 14 : 11);
const rbHitAt = () => 600;
const rbGateIdx = (P) => (P.PROCS === 5 ? 4 : 1);

const remoteBombStone = {
  id: 'remote-bomb-stone', kind: 'body', exit: 'never', writes: 'core', roams: false, dialects: '94',
  processes: 5,
  purpose: 'A five-process stone whose loop and bomb live apart: the boot plants the bomb BDIST cells away, the loop copies it from there (a bomb and a blank DAT a pass, STEP apart, .5c) and a JMN watches the remote bomb\'s B-field. When an enemy destroys the remote bomb, or after TIME passes when the stone\'s own blank lands on it, every process falls through into a d-clear with an anti-imp DAT. The five processes enter the four-line loop one line apart, so the loop runs in order and the time-up is exact. PROCS 1 leaves the fan out (one process, or five in lockstep from a fanboot). SPARE > 0 makes the clear skip that many cells after the block on every lap (room for the first arm of an imp spiral); RETIRE > 0 places the remote bomb (BDIST is then ignored) so that the bomb of the very last pass lands on the cell RETIRE before the block: an imp launcher put there is retired by the time-up and only by the time-up (as the RETIRE option of compact-imp-pump allows), not when an enemy hit sends the stone into its clear early; it costs no instruction. 14 instructions (11 with PROCS 1).',
  params: { STEP: [1, 27719], TIME: [0, 27000], BDIST: [200, 50000], PROCS: [1, 5], SPARE: [0, 6000], RETIRE: [0, 64], OWN: [0, 1] },
  // STEP 2019: 0.82 / 0.98 points a round against the X top 30 (booted, 20 rounds, seeds 1 and 2),
  // where 6691 scored 0.55 / 0.56; 1301, 977 and 5003 also beat it on both seeds, by less.
  defaults: { STEP: 2019, TIME: 0, BDIST: 3000, PROCS: 5, SPARE: 0, RETIRE: 0, OWN: 0 },
  entry: 'rbGo0', loop: 'rbLoop',
  provides: { datBomb: 'rbDat' },
  mutable: [['rbGo0', EVERY], ['rbFan1', EVERY], ['rbFan2', EVERY], ['rbGo', EVERY], ['rbGate', EVERY]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (P.PROCS !== 1 && P.PROCS !== 5) out.push('remote-bomb-stone: PROCS must be 5 (its own fan) or 1 (no fan: one process, or five from a fanboot)');
    if (settings.maxProcesses < 5) out.push('remote-bomb-stone: needs five processes');
    if (P.SPARE && !P.RETIRE && P.BDIST < P.SPARE + 64) out.push(`remote-bomb-stone: BDIST ${P.BDIST} puts the remote bomb inside the ${P.SPARE} spared cells`);
    if (P.SPARE > core / 4) out.push(`remote-bomb-stone: SPARE ${P.SPARE} is more than a quarter of the core`);
    if (P.BDIST > core - 4 * settings.maxLength) out.push(`remote-bomb-stone: BDIST ${P.BDIST} puts the remote bomb on the warrior itself on a ${core}-cell core`);
    const period = core / gcd(2 * P.STEP, core);
    if (period < 100) out.push(`remote-bomb-stone: STEP ${P.STEP} reaches only ${period} cells of the core`);
    if (P.TIME >= period) out.push(`remote-bomb-stone: TIME ${P.TIME} is past the lattice's ${period} passes`);
    if (!out.length) {
      const size = rbSize(P), plan = rbPlan(P, core, windowFor(rbGateIdx(P), 0, size, 0));
      if (plan.safe < RB_MIN) out.push(`remote-bomb-stone: STEP ${P.STEP} brings the bombs home after ${Math.max(plan.safe, 0)} passes`);
    }
    return out;
  },
  linked(P, settings, at, { span }) {
    const size = rbSize(P), start = at('rbGo0');
    const plan = rbPlan(P, settings.coreSize, windowFor(at('rbGate'), start, size, P.OWN ? 0 : span));
    return plan.safe < RB_MIN ? [`remote-bomb-stone: here STEP ${P.STEP} brings the bombs home after ${Math.max(plan.safe, 0)} passes`] : [];
  },
  emit(ctx) {
    const { L, P, core } = ctx, fan = P.PROCS === 5, start = ctx.pc();
    const gateIdx = start + rbGateIdx(P);
    const plan = rbPlan(P, core, windowFor(gateIdx, start, rbSize(P), P.OWN ? 0 : ctx.span));
    const R = `${L('rbGate')}+${plan.R}`;
    if (fan) {
      // 1 -> 2 -> 3 -> 5: each MOV copies the SPL above it onto itself, so all but
      // the process that ran the MOV split again.
      ctx.ins('rbGo0', 'SPL', 'B', '1');
      ctx.ins('rbFan1', 'MOV', 'I', '-1', '0');
      ctx.ins('rbFan2', 'MOV', 'I', '-1', '0');
      ctx.ins('rbGo', 'JMP', 'B', '>0', '2');
    } else {
      ctx.mark('rbGo0');
      ctx.ins('rbGo', 'JMP', 'B', '>0', '2');
    }
    ctx.ins('rbGate', 'DAT', 'F', `$${plan.A0}`, `$${plan.B0}`);
    ctx.ins('rbPlant', 'MOV', 'I', L('rbTpl'), R);
    ctx.ins('rbLoop', 'ADD', 'F', L('rbTpl'), L('rbGate'));
    ctx.ins('rbW1', 'MOV', 'I', R, `*${L('rbGate')}`);
    ctx.ins('rbW2', 'MOV', 'I', `${R}+1`, `@${L('rbGate')}`);
    ctx.ins('rbWatch', 'JMN', 'B', L('rbLoop'), R);
    ctx.ins('rbCm', 'MOV', 'I', L('rbDat'), `}${L('rbGo')}`);
    ctx.ins('rbCd', 'DJN', 'F', L('rbCm'), `}${L('rbGo')}`);
    // The restart value: the first cell past the block, and past the SPARE cells after it.
    ctx.ins('rbDat', 'DAT', 'F', `#${L('rbTpl')}-${L('rbGo')}+1+${P.SPARE}`, `<${antiImp(core)}`);
    ctx.ins('rbTpl', 'DAT', 'F', `<${plan.S2}`, `<${plan.S2}`);
  },
  // An enemy destroys the remote bomb once the stone is running.
  plant: (api) => [[api.norm(api.at('rbWatch') + api.code('rbWatch').b), ZERO, rbHitAt(api.P)]],
  watch(api) {
    const { vm, core } = api;
    const gate = api.at('rbGate'), go = api.at('rbGo'), w1 = api.at('rbW1'), w2 = api.at('rbW2'), cm = api.at('rbCm'), cd = api.at('rbCd');
    const end = api.norm(api.at('rbTpl') + 1);            // the SPARE cells start here
    const retireAt = api.P.RETIRE ? api.norm(api.at('rbGo0') - api.P.RETIRE) : -1;
    let retired = null;
    const spared = (c) => api.rel(c, end) < api.P.SPARE;
    const R = api.norm(api.at('rbWatch') + api.code('rbWatch').b);
    const g0 = api.code('rbGate'), S2 = api.norm(api.code('rbTpl').a), lat = gcd(S2, core);
    const planted = api.scenario === 'remote-bomb-stone: planted target';
    // The pass whose blank reaches the remote bomb, from the compiled pointers.
    let T = 0;
    for (let k = 1, b = api.norm(gate + g0.b); k <= core; k++) { b = api.norm(b + S2); if (b === R) { T = k; break; } }
    const watchAt = api.at('rbWatch');
    let blanks = 0, bombs = 0, zeroedAt = null, clearAt = null, clearWrites = 0, late = 0, after = 0;
    return {
      before(pc) {
        if (!api.entered()) return null;             // not running (a switch's other branch): a partner's imp may cross these cells
        if (pc === w1 || pc === w2) {
          if (!api.same(vm.peek(pc), api.code(pc === w1 ? 'rbW1' : 'rbW2'))) return null;
          const p = vm.peek(gate);
          return { k: pc === w1 ? 1 : 2, t: api.norm(gate + (pc === w1 ? p.a : p.b)) };
        }
        // After the planted hit each process meets the watch once more, and no more.
        if (planted && pc === watchAt && vm.cycle > rbHitAt(api.P) && api.same(vm.peek(pc), api.code('rbWatch'))) late++;
        if (pc === cm) {
          if (clearAt === null) clearAt = vm.cycle;
          if (!api.same(vm.peek(pc), api.code('rbCm'))) return null;
          return { k: 3, t: api.norm(go + vm.peek(go).a) };
        }
        return null;
      },
      after(tok) {
        if (!tok) return;
        const { k, t } = tok;
        if (k === 3) {
          // The cells before the gate (the fan and the dispatcher) are spent; the gate resets the pointer past the rest.
          if (api.inSelf(t) && api.rel(t, api.self.start) > api.rel(go, api.self.start)) throw new Error("remote-bomb-stone's clear wrote its own code");
          if (spared(t)) throw new Error('remote-bomb-stone cleared the cells it was told to spare');
          clearWrites++;
          return;
        }
        if (t === retireAt) { if (k !== 1 || blanks !== T - 1) throw new Error('remote-bomb-stone hit the RETIRE cell before its last pass'); retired = vm.cycle; }
        else if (api.inSelf(t) || (api.inImage(t) && !api.inDead(t))) throw new Error('remote-bomb-stone bombed the warrior');
        if (api.norm(t - gate - (k === 1 ? g0.a : g0.b)) % lat) throw new Error('remote-bomb-stone left its step lattice');
        if (clearAt !== null && ++after > 16) throw new Error('remote-bomb-stone kept bombing after it fell into its clear');
        if (k === 1) bombs++;
        else { blanks++; if (t === R && zeroedAt === null) zeroedAt = blanks; }
      },
      final() {
        if (!api.entered()) return;                  // under a switch: the branch not taken this round
        if (planted) {
          if (clearAt === null || late > 5) throw new Error('remote-bomb-stone did not fall into its clear when the remote bomb was destroyed');
          if (!clearWrites) throw new Error("remote-bomb-stone's clear never wrote");
          return;
        }
        if (!api.alone) return;
        if (!T) throw new Error('remote-bomb-stone: the blank lattice never reaches the remote bomb');
        if (clearAt === null) {
          if (vm.cycle > 4 * T + 200) throw new Error(`remote-bomb-stone never converted (time-up was due after ${T} passes)`);
          if (bombs < Math.min(T, 100)) throw new Error(`remote-bomb-stone bombed too little (${bombs})`);
          return;
        }
        if (zeroedAt !== T) throw new Error(`remote-bomb-stone's time-up came after ${zeroedAt} passes, not the predicted ${T}`);
        if (api.P.RETIRE && retired === null) throw new Error('remote-bomb-stone reached its time-up without bombing the RETIRE cell');
        if (bombs < T) throw new Error(`remote-bomb-stone made ${bombs} bombs in ${T} passes`);
        const procs = vm.processes(0);
        if (!procs.length || !procs.every((q) => q === cm || q === cd)) throw new Error('remote-bomb-stone: a process is outside the clear at the end');
        for (const l of ['rbCm', 'rbCd', 'rbDat']) if (!api.same(vm.peek(api.at(l)), api.code(l))) throw new Error('remote-bomb-stone damaged its own clear');
        if (vm.cycle - clearAt >= core + 200) {
          for (let c = 0; c < core; c++) if (!api.inSelf(c) && !spared(c) && vm.writeCycle[c] < clearAt) throw new Error("remote-bomb-stone's clear left cells untouched");
        }
      },
    };
  },
};

// ---------------------------------------------------------------------------
// movthrough-stone
//
//   [mtFan  SPL 1 / SPL 1]         PROCS 4: one process becomes four
//   mtGo    JMP   >0, 1            sends arrivals to mtPre, mtMov, mtAdd, mtDjn;
//                                  its A-field (0) is later the clear's gate
//   mtPre   NOP   #STEP, #-STEP    the increments; run once; what the last pass moves
//   mtMov   MOV   A, B             move the cell at +A to +B
//   mtAdd   ADD.F mtPre, mtMov     A on by STEP, B back by STEP
//   mtDjn   DJN.F mtMov, <stream   loop, with a decrement stream
//   mtCm    MOV   mtDat, }mtGo     the forward clear the processes fall into
//   mtCd    DJN.F mtCm, }mtGo
//   mtDat   DAT   #reset, <imp step
//
// Pass k moves the cell at mtMov - 1 - (T-k)*STEP to mtMov + 2 + (T-k)*STEP. In
// empty core that drops a DAT at the destination; on enemy code it carries the
// instruction away. On pass T the source is mtPre and the destination mtDjn:
// the loop line becomes a NOP. The clear's first write lands on mtGo (A-field
// 0) and the bomb's A-field resets the gate past the block; so does every lap.
const MT_MIN = 40;
function mtPlan(P, core, win) {
  const S = P.STEP, period = core / gcd(S, core);
  let safe = -1;
  if (!inWindow(2 - S, win, core)) {
    safe = period;
    for (let j = 1; j < period; j++) if (inWindow(2 + j * S, win, core)) { safe = j; break; }
  }
  const T = Math.max(2, Math.min(safe, P.TIME || safe));
  return { safe, T, A0: mod(-1 - (T - 1) * S, core), B0: mod(2 + (T - 1) * S, core) };
}
const mtSize = (P) => (P.PROCS === 4 ? 10 : 8) + (P.RETIRE ? 1 : 0);
const mtMovIdx = (P) => (P.PROCS === 4 ? 4 : 2);

const movthroughStone = {
  id: 'movthrough-stone', kind: 'body', exit: 'never', writes: 'core', roams: false, dialects: '94',
  processes: 4,
  purpose: 'The X hill\'s mov-through stone: one MOV carries whatever is at a forward pointer to a backward pointer, both stepping STEP (.33c, with a folded DJN stream); in empty core that is a DAT bomb, on enemy code it carries the instruction away. After TIME passes (0: as many as miss the warrior) the forward pointer is the stone\'s own increment cell and the backward pointer its loop line, so the loop is overwritten with a NOP and the four processes fall through into a `mov bomb, }gate / djn.f` forward clear with an anti-imp DAT. The four processes enter the three-line loop one line apart, so the loop runs in order and the last pass is exact. PROCS 1 leaves the fan out (one process, or four in lockstep from a fanboot). SPARE > 0 makes the clear skip that many cells after the block on every lap (room for the first arm of an imp spiral); RETIRE > 0 adds one instruction that bombs the cell RETIRE before the block as the processes fall into the clear, which for this stone happens only at its own time-up (retiring an imp launcher placed there once it has fed its spiral). (movthrough-feed-stone is the same stone with its increment cell as a feeding SPL.) 10 instructions (8 with PROCS 1, one more with RETIRE).',
  params: { STEP: [1, 27719], TIME: [0, 27000], PROCS: [1, 4], SPARE: [0, 6000], RETIRE: [0, 64], OWN: [0, 1] },
  defaults: { STEP: 7558, TIME: 0, PROCS: 4, SPARE: 0, RETIRE: 0, OWN: 0 },
  entry: 'mtGo0', loop: 'mtMov',
  provides: { datBomb: 'mtDat' },
  mutable: [['mtGo', EVERY], ['mtMov', ['a', 'b']], ['mtDjn', EVERY]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (P.PROCS !== 1 && P.PROCS !== 4) out.push('movthrough-stone: PROCS must be 4 (its own fan) or 1 (no fan: one process, or four from a fanboot)');
    if (settings.maxProcesses < 4) out.push('movthrough-stone: needs four processes');
    const period = core / gcd(P.STEP, core);
    if (period < 100) out.push(`movthrough-stone: STEP ${P.STEP} reaches only ${period} cells of the core`);
    if (P.SPARE > core / 4) out.push(`movthrough-stone: SPARE ${P.SPARE} is more than a quarter of the core`);
    if (P.TIME > period) out.push(`movthrough-stone: TIME ${P.TIME} is past the lattice's ${period} passes`);
    if (!out.length) {
      const size = mtSize(P), plan = mtPlan(P, core, windowFor(mtMovIdx(P), 0, size, 0));
      if (plan.safe < MT_MIN) out.push(`movthrough-stone: STEP ${P.STEP} brings the bombs home after ${Math.max(plan.safe, 0)} passes`);
    }
    return out;
  },
  linked(P, settings, at, { span }) {
    const plan = mtPlan(P, settings.coreSize, windowFor(at('mtMov'), at('mtGo0'), mtSize(P), P.OWN ? 0 : span));
    return plan.safe < MT_MIN ? [`movthrough-stone: here STEP ${P.STEP} brings the bombs home after ${Math.max(plan.safe, 0)} passes`] : [];
  },
  emit(ctx) {
    const { L, P, core } = ctx, fan = P.PROCS === 4, start = ctx.pc();
    const movIdx = start + mtMovIdx(P);
    const plan = mtPlan(P, core, windowFor(movIdx, start, mtSize(P), P.OWN ? 0 : ctx.span));
    if (fan) {
      ctx.ins('mtGo0', 'SPL', 'B', '1');
      ctx.ins('', 'SPL', 'B', '1');
    } else ctx.mark('mtGo0');
    ctx.ins('mtGo', 'JMP', 'B', '>0', '1');
    // FEED 1: the same cell as SPL #STEP, #-STEP. Its A-field is immediate, so it splits to itself: the entrant
    // that reaches it stays there and sends one more process into the loop every turn it gets, while ADD.F
    // still reads its two fields as the increments. Moved onto the loop line at the end, it feeds the clear.
    ctx.ins('mtPre', P.FEED ? 'SPL' : 'NOP', P.FEED ? 'B' : 'F', `#${P.STEP}`, `#${-P.STEP}`);
    ctx.ins('mtMov', 'MOV', 'I', `$${plan.A0}`, `$${plan.B0}`);
    ctx.ins('mtAdd', 'ADD', 'F', L('mtPre'), L('mtMov'));
    // The stream starts half a core away and walks back one cell a pass.
    ctx.ins('mtDjn', 'DJN', 'F', L('mtMov'), `<${Math.floor(core / 2) + 7}`);
    if (P.RETIRE) ctx.ins('mtRet', 'MOV', 'I', L('mtDat'), `${L('mtGo0')}-${P.RETIRE}`);
    ctx.ins('mtCm', 'MOV', 'I', L('mtDat'), `}${L('mtGo')}`);
    ctx.ins('mtCd', 'DJN', 'F', L('mtCm'), `}${L('mtGo')}`);
    ctx.ins('mtDat', 'DAT', 'F', `#${L('mtDat')}-${L('mtGo')}+1+${P.SPARE}`, `<${antiImp(core)}`);
  },
  watch(api) {
    const { vm, core } = api;
    const go = api.at('mtGo'), pre = api.at('mtPre'), mov = api.at('mtMov'), djn = api.at('mtDjn'), cm = api.at('mtCm'), cd = api.at('mtCd');
    const m0 = api.code('mtMov'), S = api.norm(api.code('mtPre').a);
    const end = api.norm(api.at('mtDat') + 1);
    const spared = (c) => api.rel(c, end) < api.P.SPARE;
    // The pass whose source is the increment cell, from the compiled pointers.
    let T = 0;
    for (let k = 1, a = api.norm(m0.a); k <= core; k++, a = api.norm(a + S)) if (a === core - 1) { T = k; break; }
    let passes = 0, convertedAt = null, clearAt = null, clearWrites = 0, after = 0;
    return {
      before(pc) {
        if (!api.entered()) return null;             // not running (a switch's other branch): a partner's imp may cross these cells
        if (pc === mov) {
          const cur = vm.peek(mov);
          if (cur.op !== 'MOV' || cur.aMode !== '$' || cur.bMode !== '$') return null;
          return { k: 1, s: api.norm(mov + cur.a), t: api.norm(mov + cur.b) };
        }
        if (pc === cm) {
          if (clearAt === null) clearAt = vm.cycle;
          if (!api.same(vm.peek(pc), api.code('mtCm'))) return null;
          return { k: 2, t: api.norm(go + vm.peek(go).a) };
        }
        return null;
      },
      after(tok) {
        if (!tok) return;
        const { k, t } = tok;
        if (k === 2) {
          // The fan before the gate is spent; the gate resets the pointer past the rest.
          if (api.inSelf(t) && api.rel(t, api.self.start) > api.rel(go, api.self.start)) throw new Error("movthrough-stone's clear wrote its own code");
          if (spared(t)) throw new Error('movthrough-stone cleared the cells it was told to spare');
          clearWrites++;
          return;
        }
        passes++;
        if (t === djn && tok.s === pre) { if (convertedAt === null) convertedAt = passes; return; }
        if (api.inSelf(t) || (api.inImage(t) && !api.inDead(t))) throw new Error('movthrough-stone bombed the warrior');
        if (clearAt === null && api.norm(t - mov - m0.b) % gcd(S, core)) throw new Error('movthrough-stone left its step lattice');
        if (clearAt !== null && !api.P.FEED && ++after > 8) throw new Error('movthrough-stone kept moving after it fell into its clear');
      },
      final() {
        if (!api.entered()) return;                  // under a switch: the branch not taken this round
        if (!api.alone) return;
        if (!T) throw new Error('movthrough-stone: the forward pointer never reaches the increment cell');
        if (convertedAt === null) {
          if (vm.cycle > 3 * T + 200) throw new Error(`movthrough-stone never overwrote its loop (due on pass ${T})`);
          if (passes < Math.min(T - 1, 100)) throw new Error(`movthrough-stone moved too little (${passes})`);
          return;
        }
        if (!api.P.FEED && convertedAt !== T) throw new Error(`movthrough-stone overwrote its loop on pass ${convertedAt}, not the predicted ${T}`);
        if (api.P.FEED && convertedAt > 2 * T + 8) throw new Error(`movthrough-stone overwrote its loop after ${convertedAt} moves, not about ${T}`);
        if (vm.peek(djn).op !== (api.P.FEED ? 'SPL' : 'NOP')) throw new Error(`movthrough-stone's loop line is not the ${api.P.FEED ? 'SPL' : 'NOP'} it moved there`);
        if (clearAt === null) throw new Error('movthrough-stone never reached its clear');
        const procs = vm.processes(0);
        const fed = (q) => api.P.FEED && [pre, mov, api.at('mtAdd'), djn].includes(q);
        if (!procs.length || !procs.every((q) => q === cm || q === cd || fed(q))) throw new Error('movthrough-stone: a process is outside the clear at the end');
        if (!procs.some((q) => q === cm || q === cd)) throw new Error('movthrough-stone: no process runs the clear at the end');
        for (const l of ['mtCm', 'mtCd', 'mtDat']) if (!api.same(vm.peek(api.at(l)), api.code(l))) throw new Error('movthrough-stone damaged its own clear');
        if (vm.cycle - clearAt >= core + 200) {
          for (let c = 0; c < core; c++) if (!api.inSelf(c) && !spared(c) && vm.writeCycle[c] < clearAt) throw new Error("movthrough-stone's clear left cells untouched");
        }
        void clearWrites;
      },
    };
  },
};

// movthrough-feed-stone: the same stone, with its increment cell an SPL #STEP, #-STEP (emitted with FEED
// set). The entrant that reaches it stays there and sends one more process into the loop every turn it
// gets, so the stone keeps a share of the turns beside a partner that grows (a continuous imp pump), and
// when the last pass moves that cell onto the loop line it feeds the clear. The price: the loop runs out
// of order, so the last pass is not exact, and the processes it feeds go on moving cells after it.
// Beside fan-imp-pump in one fan boot: about 2,650 moves in a round where the plain stone made 339.
//
// A known weakness: the feeder is unbounded and the end of the stone is exact. With many processes
// two ADDs can come between two MOVs, so a pointer value is skipped; the end comes only if the MOV
// runs while its source pointer is on the increment cell. The 2,650 moves above are not the lattice's
// limit (the default step plans 6,301 passes on 55,440 cells): ADDs ran ahead of MOVs by the thousands
// of processes the stone had by then. remote-feed-stone (xremotefeed.js) avoids both: a bounded feeder
// and a pass counter that ends it whatever the order.
const movthroughFeedStone = {
  ...movthroughStone,
  id: 'movthrough-feed-stone', grows: true,
  purpose: 'The mov-through stone with a feeder: its increment cell is an SPL #STEP, #-STEP that one entrant sits on, sending one more process into the loop every turn it gets (ADD.F still reads its fields as the increments), so the stone keeps adding processes and keeps its share of the turns beside a growing partner such as a continuous imp pump; the last pass moves that SPL onto the loop line, where it feeds the clear. The loop then runs out of order, so the last pass is only approximately TIME and the fed processes go on moving cells. Beside fan-imp-pump under one fan boot: about 2,650 moves in a round, against 339 for movthrough-stone. 10 instructions (8 with PROCS 1).',
  emit: (ctx) => movthroughStone.emit({ ...ctx, P: { ...ctx.P, FEED: 1 } }),
  watch: (api) => movthroughStone.watch({ ...api, P: { ...api.P, FEED: 1 } }),
};

export default [remoteBombStone, movthroughStone, movthroughFeedStone];
