// X-hill follow scanner (docs/hill-top30/block-gaps.md, section "X";
// docs/hill-top30/94x.md, #2 and #3/#30):
//
//   follow-scanner  -- a .5c F-scan whose answer to an imp ring is to follow
//     B-fields. A find is wiped forward with SPL until the first empty cell;
//     the B-field of the last cell wiped is then added to the pointer and, if
//     something is there, that is wiped too, and so on: on an imp the B-field is
//     the ring's step, so the wipe walks from arm to arm. When the scan pointer
//     comes back to itself it becomes a d-clear with an anti-imp DAT. This is
//     the arm several X-hill P-switchers would run every round without P-space.
//
// (The ladder scanner, the other X-hill one-process scanner, is in xladder.js.)
//
// One process until its final clear. All Redcode here is
// written from scratch; the hill warriors were read for the mechanism, never
// copied. Ring, ICWS'94 only. How to write a block: docs/block-algebra.md.

import { modInverse } from '../util.js';

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const mod = (x, n) => ((x % n) + n) % n;
const EVERY = ['op', 'mod', 'aMode', 'a', 'bMode', 'b'];
function antiImp(core) {
  for (let n = 3; n < 64; n++) if (gcd(n, core) === 1) return modInverse(n, core);
  return 1;
}
// The n-th cell (n = 3) a pointer starting at `from` and stepping `step` looks at
// that has `room` clear cells of core either side of it.
function lookTarget(api, from, step, room = 12, n = 3) {
  let found = 0;
  for (let k = 1; k < 4000; k++) {
    const c = api.norm(from + k * step);
    let clear = true;
    for (let j = -room; j <= room && clear; j++) if (api.inImage(c + j) || api.inDead(api.norm(c + j))) clear = false;
    if (clear && ++found === n) return c;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// follow-scanner (19 instructions)
//
//   fsPtr   DAT   #1, #0          B: the scan pointer (first cell of the block)
//   fsHit   SLT.AB #HI, fsPtr     past the image's end?
//           JMP   fsScan          no: an own cell
//           SLT.BA fsPtr, fsLink  before its start? (B >= core - index)
//           JMP   fsScan          yes: an own cell
//   fsWipe  MOV.B @fsPtr, fsLink  keep the B-field of the cell about to go
//           MOV   fsSpl, >fsPtr   SPL over it
//           JMN.F fsWipe, @fsPtr  until the first empty cell
//   fsFol   ADD.B fsLink, fsPtr   follow the last B-field
//   fsFolJ  JMN.F fsHit, <fsPtr   something there: wipe that too
//   fsScan  ADD.AB #STEP, fsPtr
//   fsLook  JMZ.F fsScan, @fsPtr  .5c
//   fsBack  JMN.B fsHit, fsPtr    a find; B = 0 is the pointer itself: the lap is done
//   fsClr   SPL   #0, 0           the d-clear; its first write lands on fsPtr,
//   fsCm    MOV   fsDat, >fsPtr   whose new B-field skips the image
//   fsCd    DJN.F fsCm, >fsPtr
//   fsLink  DAT   #core - index, #0
//   fsSpl   SPL   #0, #0          both fields zero: the scan does not see its own carpet
//   fsDat   DAT   <imp step, #past the image
const followScanner = {
  id: 'follow-scanner', kind: 'body', exit: 'never', writes: 'core', roams: false, dialects: '94',
  processes: 8, grows: true,
  purpose: 'A one-process .5c F-scanner that answers imps by following B-fields: a find is wiped forward with SPL until the first empty cell, then the B-field of the last cell wiped (on an imp, the ring\'s step) is added to the pointer and whatever is there is wiped too, arm after arm. Its SPL has both fields zero, so the scan never sees its own carpet. STP 1 (P-space rule sets only) also drops a brainwash bomb on the first empty cell after each carpet: the processes the SPLs make run it and overwrite their own P-space cell by cell. When the scan pointer comes back to itself (one lap of the STEP lattice) it becomes a SPL #0-pumped d-clear with an anti-imp DAT. 19 instructions (21 with STP).',
  params: { STEP: [1, 27719], STP: [0, 1] },
  // Tuning, 20-round runs against the X top 30, booted, seeds 1 and 2: STEP 23 scored 0.72 / 0.66,
  // 17 0.69 / 0.64, 13 0.68 / 0.64, where 9973 scored 0.63 / 0.63. Against a 64-process 13-point spiral
  // (20 rounds) 23 won 7, tied 11, lost 2 and 9973 won 6, tied 12, lost 2. (An earlier note here said
  // 9973 won 17 of 20 against the spiral; that figure was never measured and was wrong.)
  defaults: { STEP: 23, STP: 0 },
  entry: 'fsScan', entryFirst: false, loop: 'fsScan',
  provides: { splBomb: 'fsSpl', datBomb: 'fsDat' },
  mutable: [['fsPtr', EVERY], ['fsLink', ['b']]],
  mismatches(P, settings) {
    // A follow leaves the scan pointer anywhere, so only a step that reaches every cell is sure to
    // bring it back to the pointer cell (the lap that starts the clear).
    const core = settings.coreSize, g = gcd(P.STEP, core);
    const out = g > 1 ? [`follow-scanner: STEP ${P.STEP} shares a factor (${g}) with the ${core}-cell core; after a follow the scan might never return to its pointer and start the clear`] : [];
    if (P.STP && !settings.pSpace) out.push('follow-scanner: the STP bomb needs a rule set with P-space (94x-hill)');
    return out;
  },
  emit(ctx) {
    const { L, P, core, span } = ctx, idx = ctx.pc(), ptr = L('fsPtr');
    ctx.ins('fsPtr', 'DAT', 'F', '#1', '#0');
    ctx.ins('fsHit', 'SLT', 'AB', `#${Math.max(span - idx, 18 + 2 * P.STP)}`, ptr);
    ctx.ins('', 'JMP', 'B', L('fsScan'));
    ctx.ins('', 'SLT', 'BA', ptr, L('fsLink'));
    ctx.ins('', 'JMP', 'B', L('fsScan'));
    ctx.ins('fsWipe', 'MOV', 'B', `@${ptr}`, L('fsLink'));
    ctx.ins('fsW', 'MOV', 'I', L('fsSpl'), `>${ptr}`);
    ctx.ins('', 'JMN', 'F', L('fsWipe'), `@${ptr}`);
    // STP 1: a brainwash bomb on the first empty cell after the carpet, where the processes the SPLs
    // make arrive: each run stores what it finds into the next P-space cell (its B-field counts up).
    if (P.STP) ctx.ins('fsWash', 'MOV', 'I', L('fsStp'), `@${ptr}`);
    ctx.ins('fsFol', 'ADD', 'B', L('fsLink'), ptr);
    ctx.ins('fsFolJ', 'JMN', 'F', L('fsHit'), `<${ptr}`);
    ctx.ins('fsScan', 'ADD', 'AB', `#${P.STEP}`, ptr);
    ctx.ins('fsLook', 'JMZ', 'F', L('fsScan'), `@${ptr}`);
    ctx.ins('fsBack', 'JMN', 'B', L('fsHit'), ptr);
    ctx.ins('fsClr', 'SPL', 'B', '#0', '0');
    ctx.ins('fsCm', 'MOV', 'I', L('fsDat'), `>${ptr}`);
    ctx.ins('fsCd', 'DJN', 'F', L('fsCm'), `>${ptr}`);
    ctx.ins('fsLink', 'DAT', 'F', `#${Math.min(core - idx, core - 1)}`, '#0');
    ctx.ins('fsSpl', 'SPL', 'B', '#0', '#0');
    if (P.STP) ctx.ins('fsStp', 'STP', 'B', '>0', '#0');
    ctx.ins('fsDat', 'DAT', 'F', `<${antiImp(core)}`, `#${Math.max(span - idx, 19 + 2 * P.STP)}`);
  },
  // A body of five cells on the scan's path whose last cell's B-field leads to a
  // second body off it: the second is only reached by following.
  plant(api) {
    const t = followTargets(api);
    if (!t) return [];
    const cell = (b) => ({ op: 'MOV', mod: 'I', aMode: '$', a: 0, bMode: '$', b });
    return [
      ...[0, 1, 2, 3].map((i) => [api.norm(t.first + i), cell(7)]),
      [api.norm(t.first + 4), cell(t.link)],
      ...[0, 1, 2].map((i) => [api.norm(t.second + i), cell(3)]),
    ];
  },
  watch(api) {
    const { vm, core } = api;
    const ptr = api.at('fsPtr'), w = api.at('fsW'), look = api.at('fsLook'), folJ = api.at('fsFolJ'), clr = api.at('fsClr'), cm = api.at('fsCm');
    const planted = api.scenario === 'follow-scanner: planted target';
    const t = planted ? followTargets(api) : null;
    const wiped = new Set(), washed = new Set(), wash = api.P.STP ? api.at('fsWash') : -1;
    let looks = 0, stray = 0, live = 0, followed = false, clearAt = null, looksAtClear = 0;
    return {
      before(pc) {
        if (!api.entered()) return null;             // not running (a switch's other branch): a partner's imp may cross these cells
        if (pc === look) looks++;
        if (pc === clr && clearAt === null) { clearAt = vm.cycle; looksAtClear = looks; }
        if (pc === folJ && t && api.norm(ptr + vm.peek(ptr).b - 1) === t.second) followed = true;
        if (pc === w && api.same(vm.peek(pc), api.code('fsW'))) return { k: 1, t: api.norm(ptr + vm.peek(ptr).b), was: vm.peek(api.norm(ptr + vm.peek(ptr).b)) };
        if (pc === cm && api.same(vm.peek(pc), api.code('fsCm'))) return { k: 2, t: api.norm(ptr + vm.peek(ptr).b) };
        if (pc === wash && api.same(vm.peek(pc), api.code('fsWash'))) return { k: 3, t: api.norm(ptr + vm.peek(ptr).b) };
        return null;
      },
      after(tok) {
        if (!tok) return;
        const { k, t: c } = tok;
        if (k === 2) { if (c !== ptr && api.inSelf(c)) throw new Error("follow-scanner's clear wrote its own code"); return; }
        if (k === 3) {
          if (api.inSelf(c) || vm.peek(c).op !== 'STP') throw new Error('follow-scanner dropped its STP bomb in the wrong place');
          washed.add(c);
          return;
        }
        if (api.inSelf(c) || (api.inImage(c) && !api.inDead(c))) throw new Error('follow-scanner wiped its own warrior');
        if (!api.same(vm.peek(c), api.code('fsSpl'))) throw new Error('follow-scanner wiped with something other than its SPL');
        if (tok.was.a === 0 && tok.was.b === 0 && !api.inDead(c)) stray++;
        wiped.add(c);
        if (!api.inDead(c)) live++;
      },
      final() {
        if (!api.entered()) return;                  // under a switch: the branch not taken this round
        if (planted && t) {
          for (let i = 0; i < 5; i++) if (!wiped.has(api.norm(t.first + i))) throw new Error('follow-scanner did not wipe the planted body to its end');
          if (wiped.has(api.norm(t.first + 5))) throw new Error('follow-scanner wiped past the first empty cell');
          if (api.P.STP && !washed.has(api.norm(t.first + 5))) throw new Error('follow-scanner did not drop its STP bomb after the carpet');
          if (!followed) throw new Error("follow-scanner did not follow the last cell's B-field");
          for (let i = 0; i < 3; i++) if (!wiped.has(api.norm(t.second + i))) throw new Error('follow-scanner did not wipe what the B-field led to');
          return;
        }
        if (!api.alone) return;
        if (stray) throw new Error('follow-scanner wiped empty core');
        // STP bomb: a victim that stored 77 in its P-space cell 5 and then sat still has lost it by the end.
        if (api.P.STP && api.image.start === 0) {
          const r = api.duel(';name victim\nORG v\nv stp.ab #77, #5\n jmp 0, 1\nEND', { offset: 3 * api.P.STEP * 100 + 1000, cycles: 60000 });
          if (r.vm.warriors[1].pspace[5] === 77) throw new Error("follow-scanner's STP bomb did not overwrite the victim's P-space");
        }
        if (live) throw new Error('follow-scanner found something in an empty core');
        const laps = core / gcd(api.P.STEP, core);
        if (clearAt === null) {
          // A follow (here: off the abandoned image) leaves the pointer off its lap, so only an undisturbed scan is timed.
          if (!wiped.size && looks > laps + 2) throw new Error('follow-scanner never turned into its clear after a lap');
          if (looks < Math.min(1000, laps - 2)) throw new Error(`follow-scanner looked at too few cells (${looks})`);
          return;
        }
        if (!wiped.size && looksAtClear !== laps) throw new Error(`follow-scanner turned into its clear after ${looksAtClear} looks, not one lap (${laps})`);
        if (!api.same(vm.peek(cm), api.code('fsCm'))) throw new Error('follow-scanner damaged its own clear');
      },
    };
  },
};
function followTargets(api) {
  const first = lookTarget(api, api.at('fsPtr'), api.P.STEP, 40);
  if (first < 0) return null;
  // The follow lands on (first + 5) + link - 1; put the second body 23 cells on, off the scan's early path.
  return { first, link: 19, second: api.norm(first + 4 + 19) };
}

export default [followScanner];
