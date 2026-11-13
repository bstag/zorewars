// X-hill ladder scanner (docs/hill-top30/block-gaps.md, section "X";
// docs/hill-top30/94x.md, #3 and #30): a one-process .33c scan with a carpet
// that always runs (one cell a look, re-aimed by every find) and whose bomb
// changes lap by lap: SPL, then JMP, then DAT. The bombs have both fields zero,
// so the scan does not see its own carpet; the lap is the scan finding its own
// pointer, with no counter cell and no STP rung.
//
// All Redcode here is written from scratch; the hill warriors were read for the
// mechanism, never copied. Ring, ICWS'94 only. How to write a block:
// docs/block-algebra.md.
//
//   lsCp    DAT   #0, #K          B: the carpet pointer (first cell of the block)
//   lsPtr   DAT   #rung, #0       A: which bomb; B: the scan pointer
//   lsLoop  MOV   *lsPtr, >lsCp   one carpet cell every look
//           ADD.AB #STEP, lsPtr
//   lsTest  JMZ.F lsLoop, @lsPtr  .33c
//   lsHit   SLT.AB #HI, lsPtr     past the image's end?
//           JMP   lsOwn           no: an own cell
//           SLT.AB #LO, lsPtr     before its start?
//   lsAim   MOV.B lsPtr, lsCp     no: the carpet goes on from one cell before the find
//   lsAimJ  JMP   lsLoop
//   lsEnt   DJN.B lsLoop, #2      the entry, once: a second arrival falls onto lsR2 and dies
//   lsR2    DAT   #0, #0          third lap on: kill
//   lsR1    JMP   #0, #0          second lap: stop the stunned processes multiplying
//   lsR0    SPL   #0, #0          first lap: stun
//   lsOwn   JMN.B lsLoop, lsPtr   an own cell other than the pointer itself
//   lsLap   MOV.AB #K, lsCp       the scan is back at its own pointer: a lap is done;
//           SEQ.A #top, lsPtr     the carpet restarts just past the image
//           SUB.A #1, lsPtr       with the next bomb
//   lsLapJ  JMP   lsLoop
//
// The carpet runs forward one cell a look. If it gets round the core before the
// lap ends it writes over lsCp, whose B-field is then zero: it parks there,
// rewriting that one cell, until a find re-aims it or the lap ends.

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const EVERY = ['op', 'mod', 'aMode', 'a', 'bMode', 'b'];
const MARKER = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };
const SIZE = 19;

// The third cell the scan looks at that has clear core either side of it.
function lookTarget(api) {
  const ptr = api.at('lsPtr');
  let found = 0;
  for (let k = 1; k < 4000; k++) {
    const c = api.norm(ptr + k * api.P.STEP);
    let clear = true;
    for (let j = -12; j <= 12 && clear; j++) if (api.inImage(c + j) || api.inDead(api.norm(c + j))) clear = false;
    if (clear && ++found === 3) return c;
  }
  return -1;
}

export default {
  id: 'ladder-scanner', kind: 'body', exit: 'never', writes: 'core', roams: false, dialects: '94',
  processes: 1,
  purpose: 'A one-process .33c scanner with a carpet that always runs (one cell a look, re-aimed to one cell before every find) and a bomb ladder: the carpet lays SPL during the first lap of the scan, JMP during the second (STP 1, P-space rule sets only: a brainwash bomb that makes the stunned processes overwrite their own P-space cell by cell) and DAT from then on. Every bomb has both fields zero, so the scan never sees its own carpet; a carpet that gets round the core parks on its own pointer cell until the next find or lap. No counter cell and no STP rung: the lap is the scan finding its own pointer. Its entry is a one-shot gate after the loop and the find path and before the bombs, so a copy-ahead boot (boot EARLY 1) has the whole loop in place before it starts, and the boot process that joins later dies on the gate\'s second pass instead of doubling the scan. 19 instructions.',
  params: { STEP: [1, 27719], STP: [0, 1] },
  // 29: 0.83 / 0.80 / 0.75 points a round against the X top 30 over three 20-round seeds (booted),
  // where 7919 scored 0.56 / 0.56 / 0.53.
  defaults: { STEP: 29, STP: 0 },
  entry: 'lsEnt', entryFirst: false, loop: 'lsLoop',
  provides: { splBomb: 'lsR0', datBomb: 'lsR2' },
  mutable: [['lsCp', EVERY], ['lsPtr', ['a', 'b']], ['lsEnt', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, laps = core / gcd(P.STEP, core), out = [];
    if (laps < 400) out.push(`ladder-scanner: STEP ${P.STEP} looks at only ${laps} cells of the core`);
    if (P.STP && !settings.pSpace) out.push('ladder-scanner: the STP rung needs a rule set with P-space (94x-hill)');
    return out;
  },
  emit(ctx) {
    const { L, P, core, span } = ctx, cpIdx = ctx.pc(), cp = L('lsCp'), ptr = L('lsPtr');
    const end = Math.max(span, cpIdx + SIZE);         // the first cell past what is protected
    const K = end - cpIdx;
    ctx.ins('lsCp', 'DAT', 'F', '#0', `#${K}`);
    ctx.ins('lsPtr', 'DAT', 'F', `#${L('lsR0')}-${ptr}`, '#0');
    ctx.ins('lsLoop', 'MOV', 'I', `*${ptr}`, `>${cp}`);
    ctx.ins('', 'ADD', 'AB', `#${P.STEP}`, ptr);
    ctx.ins('lsTest', 'JMZ', 'F', L('lsLoop'), `@${ptr}`);
    // Own: the pointer up to the cell after the image (a carpet aimed there would start on the image's last cell).
    ctx.ins('lsHit', 'SLT', 'AB', `#${K - 1}`, ptr);
    ctx.ins('', 'JMP', 'B', L('lsOwn'));
    ctx.ins('', 'SLT', 'AB', `#${core - cpIdx - 2}`, ptr);
    ctx.ins('lsAim', 'MOV', 'B', ptr, cp);
    ctx.ins('lsAimJ', 'JMP', 'B', L('lsLoop'));
    // The entry: the first process through goes to the loop; a second (the boot process of a
    // copy-ahead boot, which joins its copy) counts the gate to zero and falls onto the DAT below.
    ctx.ins('lsEnt', 'DJN', 'B', L('lsLoop'), '#2');
    ctx.ins('lsR2', 'DAT', 'F', '#0', '#0');
    // STP 1: the second lap brainwashes instead. Each run of the cell stores the B-field it finds at
    // its own B-field's distance into the next P-space cell (its B-field counts up), so the stunned
    // processes that stream over the carpet overwrite the victim's P-space from cell 0 on. Both
    // fields start at zero, so the scan does not see it either.
    if (P.STP) ctx.ins('lsR1', 'STP', 'B', '>0', '#0');
    else ctx.ins('lsR1', 'JMP', 'B', '#0', '#0');
    ctx.ins('lsR0', 'SPL', 'B', '#0', '#0');
    ctx.ins('lsOwn', 'JMN', 'B', L('lsLoop'), ptr);
    ctx.ins('lsLap', 'MOV', 'AB', `#${K}`, cp);
    ctx.ins('', 'SEQ', 'A', `#${L('lsR2')}-${ptr}`, ptr);
    ctx.ins('', 'SUB', 'A', '#1', ptr);
    ctx.ins('lsLapJ', 'JMP', 'B', L('lsLoop'));
  },
  plant(api) {
    const c = lookTarget(api);
    return c < 0 ? [] : [0, 1, 2, 3].map((i) => [api.norm(c + i), MARKER]);
  },
  watch(api) {
    const { vm, core } = api;
    const cp = api.at('lsCp'), ptr = api.at('lsPtr'), loop = api.at('lsLoop'), test = api.at('lsTest'), aim = api.at('lsAim'), aimJ = api.at('lsAimJ');
    const lap = api.at('lsLap'), lapJ = api.at('lsLapJ');
    const names = ['lsR0', 'lsR1', 'lsR2'], rungs = names.map((l) => api.at(l));
    const planted = api.scenario === 'ladder-scanner: planted target';
    const target = planted ? lookTarget(api) : -1;
    const period = core / gcd(api.P.STEP, core);
    const carpet = new Set();
    const rungNow = () => rungs.indexOf(api.norm(ptr + vm.peek(ptr).a));
    let looks = 0, aims = 0, laps = 0, aimed = null, writes = 0, first = null;
    return {
      before(pc) {
        if (!api.entered()) return null;             // not running (a switch's other branch): a partner's imp may cross these cells
        // A partner's imp that crawls over these cells has replaced them: only the scanner's own code counts.
        const mine = (l) => api.same(vm.peek(pc), api.code(l));
        if (pc === test && mine('lsTest')) looks++;
        if (first === null && pc === loop) first = vm.cycle;
        if (pc === aim && mine('lsAim')) { aimed = api.norm(ptr + vm.peek(ptr).b); if (!api.inDead(aimed)) aims++; return null; }
        if (pc === aimJ && aimed !== null && mine('lsAimJ')) {
          if (api.norm(cp + vm.peek(cp).b) !== api.norm(aimed - 1)) throw new Error('ladder-scanner did not aim its carpet one cell before the find');
          aimed = null;
          return null;
        }
        if (pc === lap && mine('lsLap')) {
          laps++;
          if (api.alone && looks !== laps * period) throw new Error(`ladder-scanner ended lap ${laps} after ${looks} looks, not ${laps * period}`);
          return null;
        }
        if (pc === lapJ && mine('lsLapJ')) {
          if (rungNow() !== Math.min(laps, 2)) throw new Error('ladder-scanner did not move up one rung at the end of a lap');
          if (vm.peek(cp).b !== api.code('lsCp').b) throw new Error('ladder-scanner did not restart its carpet past the image');
          return null;
        }
        if (pc === loop && api.same(vm.peek(pc), api.code('lsLoop'))) return { t: api.norm(cp + vm.peek(cp).b), rung: rungNow(), src: { ...vm.peek(api.norm(ptr + vm.peek(ptr).a)) } };
        return null;
      },
      after(tok) {
        if (!tok) return;
        const { t, rung } = tok;
        if (rung < 0) throw new Error("ladder-scanner's selector left the ladder");
        writes++;
        if (t === cp) return;                          // parked on its own pointer
        if (api.inSelf(t)) throw new Error('ladder-scanner carpeted its own code');
        if (!api.same(vm.peek(t), api.code(names[rung]))) {
          // Under a copy-ahead boot the first few looks come before the bombs are copied: an empty cell is laid.
          const early = first !== null && vm.cycle < first + 64 && tok.src.op === 'DAT' && tok.src.a === 0 && tok.src.b === 0;
          if (!early) throw new Error('ladder-scanner dropped something other than its current rung');
        }
        if (rung === 0) carpet.add(t);
      },
      final() {
        if (!api.entered()) return;                  // under a switch: the branch not taken this round
        if (planted && target >= 0) {
          for (let k = -1; k < 4; k++) if (!carpet.has(api.norm(target + k))) throw new Error('ladder-scanner did not carpet the planted target');
        }
        if (!api.alone) return;
        if (looks < 1000) throw new Error(`ladder-scanner looked at too few cells (${looks})`);
        if (aims) throw new Error('ladder-scanner aimed its carpet in an empty core');
        if (writes < looks - 1) throw new Error('ladder-scanner did not drop a bomb every look');
        if (laps !== Math.floor(looks / period)) throw new Error(`ladder-scanner counted ${laps} laps in ${looks} looks`);
        if (rungNow() !== Math.min(laps, 2)) throw new Error('ladder-scanner is on the wrong rung');
        // STP rung: a victim that stored 77 in its P-space cell 5 and then sat still has lost it by the end.
        if (api.P.STP && api.image.start === 0) {
          const r = api.duel(';name victim\nORG v\nv stp.ab #77, #5\n jmp 0, 1\nEND', { offset: 300 });
          if (r.vm.warriors[1].pspace[5] === 77) throw new Error("ladder-scanner's STP rung did not overwrite the victim's P-space");
        }
      },
    };
  },
};
