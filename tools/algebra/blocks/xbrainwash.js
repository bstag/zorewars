// X-hill brainwash scanner (docs/hill-top30/block-gaps.md, section "X"; docs/hill-top30/94x.md, #5
// and #9: the 55HSB arm of KAT v5 and Big I.F.F.S.): a one-process scanner that wipes what it
// finds with SPL until the first empty cell, then, when its scan has been round the core, lays
// a brainwash carpet over the whole core and ends as a clear that advances by an imp step.
//
//   bwPtr   DAT   $first, $0       B: scan pointer, then carpet pointer; A: the clear's pointer.
//                                  The LOWEST cell of the block: the clear's gate.
//   bwBomb  DAT   $first - s, <s   the clear's bomb, and the DAT an imp steps onto after the gate
//   bwHit   SLT.AB #HI, bwPtr      past the image's end?
//           JMP   bwScan           no: an own cell
//           SLT.BA bwPtr, bwLim    before its start?
//           JMP   bwScan           yes: an own cell
//   bwWipe  MOV   bwSpl, >bwPtr    SPL over the find
//           JMN.F bwWipe, @bwPtr   until the first empty cell
//   bwScan  ADD.AB #STEP, bwPtr
//   bwLook  JMZ.F bwScan, @bwPtr   .5c
//   bwBack  JMN.B bwHit, bwPtr     a find; B = 0 is the pointer itself: the lap is done
//   bwWash  MOV   bwStp, <bwPtr    (WASH 1) the brainwash carpet, backward from just below the block,
//           DJN.B bwWash, #count   once round the core
//   bwClr   SPL   #0, 0            the imp-step clear (see impstep-clear in ximps.js)
//   bwMov   MOV   bwBomb, *bwPtr
//   bwAdd   ADD.A #s, bwPtr
//   bwDjn   DJN.B bwMov, *bwPtr
//   bwLim   DAT   #core - index, #0
//   bwSpl   SPL   #0, #0           both fields zero: the scan does not see its own carpet
//   bwStp   STP.B >0, #0           (WASH 1) each run stores what it finds into the next P-space cell
//
// The stunned processes of the opponent sit on the SPL carpet; when the brainwash carpet
// replaces it they run STP cell after STP cell, each of which stores a B-field into the P-space
// cell its own B-field counts up to, so the opponent's stored state is overwritten from cell 0
// on before the clear kills it. The opponent's next round then starts from garbage.
//
// The clear is the imp-step clear with its gate lowest and its DAT next: an imp arm that climbs
// onto the block copies itself over bwPtr, whose A-field 0 re-aims the clear at the ring. By
// then the eleven cells of scanner between the DAT and the clear's loop are spent, so the
// re-aimed walk has twelve rows of bombs to lay before it reaches the loop.
//
// All Redcode here is written from scratch; the hill warriors were read for the mechanism,
// never copied. Ring, ICWS'94 only; WASH 1 needs a rule set with P-space.

import { modInverse } from '../util.js';

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const mod = (x, n) => ((x % n) + n) % n;
const EVERY = ['op', 'mod', 'aMode', 'a', 'bMode', 'b'];
const MARKER = { op: 'MOV', mod: 'I', aMode: '$', a: 0, bMode: '$', b: 7 };
// The watch's victim: it stores 77 in its P-space cell 5, then multiplies on two cells, as a stunned warrior does.
const VICTIM = ';name victim\nORG v\nv stp.ab #77, #5\n spl 0, 1\n jmp -1, 1\nEND';
const size = (P) => (P.WASH ? 20 : 17);
const impStep = (core) => { for (let n = 3; n < 64; n++) if (gcd(n, core) === 1) return modInverse(n, core); return 1; };
// How many cells the brainwash carpet lays: the core but the image and a margin above it.
const washCount = (core, span) => core - span - 8;

function target(api) {
  const ptr = api.at('bwPtr');
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
  id: 'brainwash-scanner', kind: 'body', exit: 'never', writes: 'core', roams: false, dialects: '94',
  processes: 8, grows: true,
  purpose: 'A one-process .5c F-scanner (55HSB idea) that wipes a find with SPL until the first empty cell and, when its scan has been round the core, lays a brainwash carpet over the whole core (WASH 1, P-space rule sets only: STP cells that make the stunned processes overwrite their own P-space cell by cell) and ends as the imp-step clear: pointer cell lowest, its DAT next, eleven spent cells between that and the clear\'s loop, so an imp arm that climbs onto it re-aims the clear at its own ring (WASH 0 against a 64-process 13-point spiral on 55,440 cells: 19 wins and a loss in 20; an arm that arrives while it is still scanning can kill it). 20 instructions (17 with WASH 0).',
  params: { STEP: [1, 27719], WASH: [0, 1] },
  defaults: { STEP: 13, WASH: 1 },
  entry: 'bwScan', entryFirst: false, loop: 'bwScan',
  provides: { splBomb: 'bwSpl', datBomb: 'bwBomb' },
  mutable: [['bwPtr', EVERY], ['bwBomb', ['b']], ['bwWashC', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, g = gcd(P.STEP, core), out = [];
    if (g > 1) out.push(`brainwash-scanner: STEP ${P.STEP} shares a factor (${g}) with the ${core}-cell core, so the scan does not come back to its pointer after every cell`);
    if (P.WASH && !settings.pSpace) out.push('brainwash-scanner: the brainwash carpet (WASH 1) needs a rule set with P-space (94x-hill)');
    return out;
  },
  emit(ctx) {
    const { L, P, core, span } = ctx, idx = ctx.pc(), ptr = L('bwPtr'), s = impStep(core);
    const first = Math.max(span - idx, size(P));      // the first cell past the image, from bwPtr
    ctx.ins('bwPtr', 'DAT', 'F', `$${first}`, '$0');
    ctx.ins('bwBomb', 'DAT', 'F', `$${mod(first - s, core)}`, `<${s}`);
    ctx.ins('bwHit', 'SLT', 'AB', `#${first - 1}`, ptr);
    ctx.ins('', 'JMP', 'B', L('bwScan'));
    ctx.ins('', 'SLT', 'BA', ptr, L('bwLim'));
    ctx.ins('', 'JMP', 'B', L('bwScan'));
    ctx.ins('bwWipe', 'MOV', 'I', L('bwSpl'), `>${ptr}`);
    ctx.ins('', 'JMN', 'F', L('bwWipe'), `@${ptr}`);
    ctx.ins('bwScan', 'ADD', 'AB', `#${P.STEP}`, ptr);
    ctx.ins('bwLook', 'JMZ', 'F', L('bwScan'), `@${ptr}`);
    ctx.ins('bwBack', 'JMN', 'B', L('bwHit'), ptr);
    if (P.WASH) {
      ctx.ins('bwWash', 'MOV', 'I', L('bwStp'), `<${ptr}`);
      ctx.ins('bwWashC', 'DJN', 'B', L('bwWash'), `#${washCount(core, Math.max(span, size(P)))}`);
    }
    ctx.ins('bwClr', 'SPL', 'B', '#0', '0');
    ctx.ins('bwMov', 'MOV', 'I', L('bwBomb'), `*${ptr}`);
    ctx.ins('bwAdd', 'ADD', 'A', `#${s}`, ptr);
    ctx.ins('bwDjn', 'DJN', 'B', L('bwMov'), `*${ptr}`);
    ctx.ins('bwLim', 'DAT', 'F', `#${Math.min(core - idx, core - 1)}`, '#0');
    ctx.ins('bwSpl', 'SPL', 'B', '#0', '#0');
    if (P.WASH) ctx.ins('bwStp', 'STP', 'B', '>0', '#0');
  },
  plant(api) {
    const c = target(api);
    return c < 0 ? [] : [0, 1, 2, 3].map((i) => [api.norm(c + i), MARKER]);
  },
  watch(api) {
    const { vm, core, P } = api;
    const ptr = api.at('bwPtr'), wipe = api.at('bwWipe'), look = api.at('bwLook'), clr = api.at('bwClr'), mov = api.at('bwMov');
    const wash = P.WASH ? api.at('bwWash') : -1;
    const planted = api.scenario === 'brainwash-scanner: planted target';
    const tgt = planted ? target(api) : -1;
    const wiped = new Set();
    let looks = 0, live = 0, washes = 0, washAt = null, clearAt = null, looksAtEnd = null, bombs = 0;
    return {
      before(pc) {
        if (!api.entered()) return null;
        if (pc === look) looks++;
        if (pc === wash && washAt === null) { washAt = vm.cycle; looksAtEnd = looks; }
        if (pc === clr && clearAt === null) { clearAt = vm.cycle; if (looksAtEnd === null) looksAtEnd = looks; }
        if (pc === wipe && api.same(vm.peek(pc), api.code('bwWipe'))) return { k: 1, t: api.norm(ptr + vm.peek(ptr).b) };
        if (pc === wash && api.same(vm.peek(pc), api.code('bwWash'))) return { k: 2, t: api.norm(ptr + vm.peek(ptr).b - 1) };
        if (pc === mov && api.same(vm.peek(pc), api.code('bwMov'))) return { k: 3, t: api.norm(ptr + vm.peek(ptr).a) };
        return null;
      },
      after(tok) {
        if (!tok) return;
        const { k, t } = tok;
        if (k === 3) { if (t !== ptr && api.inSelf(t)) throw new Error("brainwash-scanner's clear bombed its own code"); bombs++; return; }
        if (api.inSelf(t) || (api.inImage(t) && !api.inDead(t))) throw new Error(k === 1 ? 'brainwash-scanner wiped its own warrior' : 'brainwash-scanner laid its brainwash carpet on its own warrior');
        if (k === 1) {
          if (!api.same(vm.peek(t), api.code('bwSpl'))) throw new Error('brainwash-scanner wiped with something other than its SPL');
          wiped.add(t); if (!api.inDead(t)) live++;
        } else {
          if (vm.peek(t).op !== 'STP') throw new Error('brainwash-scanner laid something other than STP in its brainwash carpet');
          washes++;
        }
      },
      final() {
        if (!api.entered()) return;
        if (planted && tgt >= 0) {
          for (let i = 0; i < 4; i++) if (!wiped.has(api.norm(tgt + i))) throw new Error('brainwash-scanner did not wipe the planted body to its end');
          if (wiped.has(api.norm(tgt + 4))) throw new Error('brainwash-scanner wiped past the first empty cell');
          return;
        }
        if (!api.alone) return;
        if (live) throw new Error('brainwash-scanner found something in an empty core');
        const lapEnded = washAt ?? clearAt;
        if (lapEnded === null) {
          if (!wiped.size && looks > core + 2) throw new Error('brainwash-scanner never ended its scan after a lap');
          if (looks < Math.min(1000, core - 2)) throw new Error(`brainwash-scanner looked at too few cells (${looks})`);
        } else {
          if (!wiped.size && looksAtEnd !== core) throw new Error(`brainwash-scanner ended its scan after ${looksAtEnd} looks, not one lap (${core})`);
          if (P.WASH && clearAt !== null && washes !== washCount(core, api.image.size)) throw new Error(`brainwash-scanner laid ${washes} brainwash cells, not ${washCount(core, api.image.size)}`);
          if (clearAt !== null && vm.cycle > clearAt + 6000 && bombs < 1000) throw new Error('brainwash-scanner\'s clear bombed too little');
        }
        // The brainwash: a victim that stored 77 in its P-space cell 5 and then sat still has lost it by the end.
        if (P.WASH && api.image.start === 0) {
          const r = api.duel(VICTIM, { offset: 3 * P.STEP * 100 + 1000 });
          if (r.vm.warriors[1].pspace[5] === 77) throw new Error("brainwash-scanner did not overwrite the victim's P-space");
        }
      },
    };
  },
};
