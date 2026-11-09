// Hill oneshots and clears: the parts of the Koenigstuhl 94nop hill's oneshots
// and core clears that our blocks still lacked (docs/hill-recipe-book.md,
// "Scanners, oneshots and core clears", the "Our blocks" rows for Oneshot,
// D-clear and SPL/DAT two-pass).
//
// - finisher-oneshot: a oneshot finisher behind an opening's probe. If the
//   opening found nothing it scans on its own (a .66c pair scan, the prescan),
//   then clears One Shot's way from the cell it found (pointer-overwrite
//   passes: SPL, ..., then DAT). DETECT 1 adds King Cobra's bomb detection to
//   its own scan: a find must have an occupied neighbour (anything but an
//   empty DAT.F $0, $0 at found +- 1), so a lone bomb or decoy is passed over
//   and the scan goes on; DETECT 2 checks the opening's find the same way. IMP
//   1 adds an imp failsafe: when the scan runs out without a find, it runs an
//   anti-imp forward d-clear (DAT <s) from the boundary instead of the plain
//   clear; IMP 2 also takes that branch on a find of its own scan that looks
//   like an imp's trail (the found cell equals the next one).
// - finisher-dclear-fwd: the hill's d-clear (The Machine, HazyLazy, Arrow,
//   Ghost Murmur): a SPL #0 pump, MOV bomb, >gate and DJN.F -1, >gate, walking
//   forward. Each loop writes one DAT and decrements the next cell; the bomb is
//   DAT <s, len (s the imp step), so an imp ring that runs into it breaks its
//   next point. The gate is the block's first cell, so the write that comes
//   round onto it resets the pointer past the block.
// - finisher-twopass-stream: the self-switching SPL->DAT clear of King Cobra,
//   KryneLamiya and Infravision. The clear writes *bptr through the probe; the
//   SPL pump's own A-field drives a DJN.F stream that walks forward round the
//   core, and when it reaches bptr (the cell before the pump) it decrements
//   bptr.A from 1 to 0, so *bptr turns from the SPL into the DAT: the pass
//   switch is the stream, not a counter. The stream then parks on the pump
//   (its A-field increments and decrements back to 0 on every loop), so it
//   never reaches the clear's own code.
//
// Not built: Eternal Exile's own-code gate. Its gate is a cell of the dead
// scanner that the clear walks over before it reaches the clear itself; in a
// tree the dead code in front of a finisher is the opening's, so the same trick
// would erase the opening (our decoy) to save the one gate cell. The gate idea
// itself is finisher-dclear-fwd (own gate cell) and finisher-oneshot's IMP
// branch (the probe as the gate).
//
// All Redcode here is written from scratch; the hill warriors named above were
// read for their mechanism, never copied. How to write a block:
// docs/block-algebra.md.
import { modInverse } from '../util.js';

const MARKER = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };
const MARKER2 = { ...MARKER, b: 124 };   // a body's second cell: not a copy of the first (IMP 2 would call that an imp trail)
const mod = (x, n) => ((x % n) + n) % n;
const idxOf = (ctx, label) => `(${ctx.L(label)}+${ctx.pc()})`;
const impPoints = (P, core) => P.POINTS || (core % 3 ? 3 : 13);
const impStepOf = (P, core) => modInverse(impPoints(P, core), core);
// An empty core cell, as the bomb detection's SEQ.I against DAT.F $0, $0 sees it.
const blank = (x) => x.op === 'DAT' && x.mod === 'F' && x.aMode === '$' && x.bMode === '$' && x.a === 0 && x.b === 0;
const chainOf = (P) => [...Array(P.SPLS).keys()].map((k) => `b${k}`).concat('bd');

// ---------------------------------------------------------------------------
// finisher-oneshot
//
// The probe (an upstream opening's pointer: B = the found cell, or the image
// boundary) is also the scan pointer and the clear pointer, as in King Cobra,
// where the scan pointer is the clear's. probe.A is kept GAP ahead of probe.B,
// so ADD.F inc, probe steps a pair and SNE.I *probe, @probe compares it.
//
//   payload  guard the probe off the image; A = B + GAP
//            at the boundary -> scan; else the opening's find: DETECT 2 -> hit,
//            otherwise -> cgo (cleared from as it is)
//   scan     ADD.F inc, probe / SNE.I *probe, @probe / DJN.B scan, cnt
//            SNE.I *probe, @probe / JMP fail      (the counter ran out)
//   hit      in range? else scan
//            [IMP 2]  found == found + 1 -> imp branch
//            [DETECT] found - 1 or found + 1 occupied, else scan (a lone cell)
//   commit   probe.B := the occupied cell of the pair, - BACK
//            *probe -> the first bomb; [SPL #0]; MOV.I *probe, >probe twice
//   fail     IMP 0: commit at the boundary; IMP 1/2: the d-clear at the boundary
//   imp      [SPL #0]; MOV.I abomb, >probe / DJN.F imp, >probe
function emitOneshot(ctx) {
  const { L, P, span, core } = ctx, probe = ctx.ref('probe');
  const idx = () => `(${probe}+${ctx.pc()})`;
  const skip = () => `(${span}-${idx()})`;            // the image's length after the probe
  const chain = chainOf(P);
  const lo = () => `#(${span}-${idx()}+${Math.max(P.BACK, 1)}-1)`;
  const hi = () => `#(CORESIZE-${idx()}-${P.GAP}-2)`;
  ctx.mark('payload');
  ctx.ins('', 'SLT', 'AB', `#(${span}-${idx()}-1)`, probe);   // inside the image? -> the boundary
  ctx.ins('', 'MOV', 'AB', `#${skip()}`, probe);
  ctx.ins('', 'MOV', 'BA', probe, probe);
  ctx.ins('', 'ADD', 'A', `#${P.GAP}`, probe);               // A = B + GAP
  ctx.ins('', 'SEQ', 'AB', `#${skip()}`, probe);             // the opening found nothing: scan
  ctx.ins('', 'JMP', 'B', L(P.DETECT === 2 ? 'hit' : 'cgo'));      // its find: checked (DETECT 2) or taken as it is
  ctx.ins('scan', 'ADD', 'F', L('inc'), probe);
  ctx.ins('look', 'SNE', 'I', `*${probe}`, `@${probe}`);
  ctx.ins('', 'DJN', 'B', L('scan'), L('cnt'));
  ctx.ins('', 'SNE', 'I', `*${probe}`, `@${probe}`);         // the pair differs: a hit; else the counter ran out
  ctx.ins('', 'JMP', 'B', L('fail'));
  ctx.ins('hit', 'SLT', 'AB', lo(), probe);
  ctx.ins('', 'JMP', 'B', L('scan'));
  ctx.ins('', 'SLT', 'AB', hi(), probe);
  ctx.ins('', 'JMP', 'B', L('pick'));
  ctx.ins('', 'JMP', 'B', L('scan'));
  if (P.DETECT || P.IMP === 2) {
    ctx.ins('pick', 'MOV', 'B', probe, L('tp'));             // tp -> the occupied cell of the pair
    ctx.ins('', 'JMN', 'F', L('pk2'), `@${probe}`);
    ctx.ins('', 'MOV', 'AB', probe, L('tp'));
    ctx.ins('pk2', 'ADD', 'AB', `#(${idx()}-${idxOf(ctx, 'tp')})`, L('tp'));
    if (P.IMP === 2) {
      ctx.ins('', 'SNE', 'I', `>${L('tp')}`, `@${L('tp')}`);  // found == found + 1: an imp's trail (tp -> found + 1)
      ctx.ins('', 'JMP', 'B', L('impset'));
    } else ctx.ins('', 'ADD', 'AB', '#1', L('tp'));
    if (P.DETECT) {
      // Occupied = anything but an empty core cell (DAT.F $0, $0), so a SPL #0, 0 counts.
      ctx.ins('', 'SEQ', 'I', `@${L('tp')}`, L('blank'));     // found + 1 occupied: a body
      ctx.ins('', 'JMP', 'B', L('commit'));
      ctx.ins('', 'ADD', 'AB', '#-2', L('tp'));
      ctx.ins('', 'SEQ', 'I', `@${L('tp')}`, L('blank'));     // found - 1 occupied: a body
      ctx.ins('', 'JMP', 'B', L('commit'));
      ctx.ins('lone', 'JMP', 'B', L('scan'));                // a lone cell: pass it over
    }
  } else ctx.mark('pick');
  ctx.ins('commit', 'JMN', 'F', L('cgo'), `@${probe}`);       // the B cell is the occupied one, or the A cell
  ctx.ins('', 'MOV', 'AB', probe, probe);
  ctx.mark('cgo');
  if (P.BACK) ctx.ins('', 'SUB', 'AB', `#${P.BACK}`, probe);
  ctx.ins('cset', 'MOV', 'A', `#(${L(chain[0])}-${probe})`, probe);
  if (P.PUMP) ctx.ins('', 'SPL', 'B', '#0', '0');
  ctx.ins('w1', 'MOV', 'I', `*${probe}`, `>${probe}`);
  ctx.ins('w2', 'MOV', 'I', `*${probe}`, `>${probe}`);
  ctx.ins('', 'JMP', 'B', L('w1'));
  chain.forEach((b, k) => {
    const next = chain[Math.min(k + 1, chain.length - 1)], dat = b === 'bd';
    ctx.ins(b, dat ? 'DAT' : 'SPL', dat ? 'F' : 'B', `#(${L(next)}-${probe})`, `#${skip()}`);
  });
  if (P.IMP) {
    const s = impStepOf(P, core);
    if (P.IMP === 2) {
      ctx.ins('impset', 'JMN', 'F', L('igo'), `@${probe}`);
      ctx.ins('', 'MOV', 'AB', probe, probe);
      ctx.ins('', 'JMP', 'B', L('igo'));
    }
    ctx.ins('fail', 'MOV', 'AB', `#${skip()}`, probe);
    ctx.mark('igo');
    if (P.PUMP) ctx.ins('', 'SPL', 'B', '#0', '0');
    ctx.ins('dl', 'MOV', 'I', L('abomb'), `>${probe}`);
    ctx.ins('dd', 'DJN', 'F', L('dl'), `>${probe}`);
    ctx.ins('abomb', 'DAT', 'F', `<${s}`, `#${skip()}`);
  } else {
    ctx.ins('fail', 'MOV', 'AB', `#${skip()}`, probe);
    ctx.ins('', 'JMP', 'B', L('cgo'));
  }
  ctx.ins('inc', 'DAT', 'F', `#${P.STEP}`, `#${P.STEP}`);
  ctx.ins('cnt', 'DAT', 'F', '#0', `#${P.SCANS}`);
  if (P.DETECT || P.IMP === 2) ctx.ins('tp', 'DAT', 'F', '#0', '#0');
  if (P.DETECT) ctx.ins('blank', 'DAT', 'F', '$0', '$0');
}

// The planted run: a lone marker the scan reaches at look 2 and a two-cell
// body at look 5, both past the image and clear of everything else the scan
// looks at before them. The scan starts at the image boundary (the opening
// found nothing); if the opening happens to find the lone cell, the scan goes
// on from it along the same looks.
function oneshotPlan(api) {
  const { core, P } = api, probe = api.ref('probe');
  const len = api.image.size, b0 = mod(api.image.start + len, core);
  const B = (k) => mod(b0 + k * P.STEP, core), A = (k) => mod(B(k) + P.GAP, core);
  const lone = B(2), body = B(5);
  const used = new Set([lone, mod(lone - 1, core), mod(lone + 1, core), body, mod(body + 1, core), mod(body - 1, core)]);
  const touched = [A(1), A(2), A(3), A(4), A(5), B(1), B(3), B(4)];
  if (touched.some((c) => used.has(c))) return null;
  // Everything in range: past the image (and BACK) and short of its start.
  for (const c of [lone, body]) {
    const r = api.rel(c, probe);
    if (r < len + P.BACK + 2 || r > core - P.GAP - 4 || api.inImage(c - P.BACK - 2) || api.inImage(c + P.GAP + 2)) return null;
  }
  if (api.rel(body, lone) < 4 && api.rel(lone, body) < 4) return null;
  return { lone, body };
}

function watchOneshot(api) {
  const { vm, core, P } = api, probe = api.ref('probe'), chain = chainOf(P);
  const planted = api.scenario === 'finisher-oneshot: planted target';
  const plan = planted ? oneshotPlan(api) : null;
  const skipLen = api.norm(api.code('payload', 1).a);   // the image's length after the probe
  const at = (l) => api.at(l);
  const s = P.IMP ? impStepOf(P, core) : 0;
  const written = new Int32Array(core).fill(-1);
  let scanned = false, entered = null, committed = null, found = -1, failed = null, impAt = null, wraps = 0, writes = 0, dats = 0, decs = 0, dwraps = 0;
  const own = (t) => t !== probe && api.rel(t, probe) < skipLen;
  return {
    before(pc) {
      if (api.inDead(pc) || !api.inSelf(pc) || !api.same(vm.peek(pc), api.code('payload', api.norm(pc - at('payload'))))) return null;
      if (entered === null && pc === at('payload')) entered = vm.cycle;
      if (entered === null) return null;
      if (pc === at('look')) scanned = true;
      if (committed === null && failed === null && pc === at('cset')) {
        committed = vm.cycle;
        found = mod(probe + vm.peek(probe).b + P.BACK, core);
        if (api.inImage(found) && !api.inDead(found)) throw new Error('finisher-oneshot committed to its own warrior');
        if (blank(vm.peek(found)) && blank(vm.peek(found + P.GAP))) throw new Error('finisher-oneshot committed to an empty pair');
        // Bomb detection: a find of its own scan (or, DETECT 2, any find) has an occupied neighbour.
        if (P.DETECT && (P.DETECT === 2 || scanned) && blank(vm.peek(found - 1)) && blank(vm.peek(found + 1))) throw new Error('finisher-oneshot committed to a lone cell (bomb detection failed)');
      }
      if (failed === null && pc === at('fail')) failed = vm.cycle;
      if (P.IMP && impAt === null && pc === at('dl')) impAt = vm.cycle;
      if (pc === at('w1') || pc === at('w2')) return { kind: 'w', pc, t: mod(probe + vm.peek(probe).b, core) };
      if (P.IMP && pc === at('dl')) return { kind: 'dl', pc, t: mod(probe + vm.peek(probe).b, core) };
      if (P.IMP && pc === at('dd')) return { kind: 'dd', pc, t: mod(probe + vm.peek(probe).b, core) };
      return null;
    },
    after(tok) {
      if (!tok) return;
      const { t, pc, kind } = tok;
      if (kind === 'w') {
        const want = api.code(chain[Math.min(wraps, chain.length - 1)]);
        if (!api.same(vm.peek(t), want) || vm.writerPc[t] !== pc) throw new Error(`finisher-oneshot wrote something other than pass ${wraps + 1}'s bomb`);
        if (t === probe) { wraps++; return; }
        if (api.inSelf(t) || own(t)) throw new Error('finisher-oneshot cleared its own warrior');
        writes++; written[t] = vm.cycle;
        return;
      }
      if (t === probe) { if (kind === 'dl') dwraps++; return; }
      if (api.inSelf(t) || own(t)) throw new Error("finisher-oneshot's imp clear hit its own warrior");
      if (kind === 'dl') {
        const x = vm.peek(t);
        if (!api.same(x, api.code('abomb')) || vm.writerPc[t] !== pc) throw new Error("finisher-oneshot's imp clear wrote something other than its bomb");
        if (x.aMode !== '<' || api.norm(x.a) !== s) throw new Error("finisher-oneshot's imp clear bomb is not anti-imp");
        dats++;
      } else decs++;
    },
    final() {
      if (entered === null) return;
      if (plan) {
        if (P.SCANS < 8) return;   // too few looks to reach the body
        if (committed === null) throw new Error('finisher-oneshot did not commit to the planted body');
        const hitBody = found === plan.body || found === mod(plan.body + 1, core);
        if (P.DETECT && !hitBody && (P.DETECT === 2 || found !== plan.lone)) throw new Error('finisher-oneshot did not pass over the lone cell to commit to the body');
        if (!P.DETECT && !hitBody && found !== plan.lone) throw new Error('finisher-oneshot committed to a cell that was not planted');
        if (written[mod(found - P.BACK, core)] < 0) throw new Error('finisher-oneshot did not clear from the found cell');
      }
      if ((api.scenario === 'alone')) {
        if (committed !== null && !api.inDead(found)) throw new Error('finisher-oneshot committed on an empty core');
        if (committed === null && failed === null && vm.cycle - entered > 3 * P.SCANS + 50) throw new Error('finisher-oneshot never gave up its scan');
        if (failed !== null && P.IMP && impAt === null) throw new Error('finisher-oneshot did not take its imp failsafe when the scan found nothing');
        if (failed !== null && P.IMP && dats > core && dwraps === 0) throw new Error("finisher-oneshot's imp clear never came round onto its gate");
        if (failed !== null && !P.IMP && writes > core && wraps === 0) throw new Error('finisher-oneshot never came round onto its pointer');
        if (writes >= chain.length * core && wraps < chain.length - 1) throw new Error('finisher-oneshot never reached its DAT pass');
      }
    },
  };
}

const oneshot = {
  id: 'finisher-oneshot',
  kind: 'finisher', exit: 'never', writes: 'core', relocatable: false, protects: 'image', dialects: '94',
  processes: (P) => (P.PUMP ? 8 : 1), grows: true,
  purpose: 'Oneshot behind an opening\'s probe: if the opening found nothing it scans on (a .66c pair scan of SCANS looks), then clears One Shot\'s way from the find (SPLS SPL passes, then DAT, each started by the write over the probe). DETECT 1 passes over a lone cell its scan finds (no occupied neighbour: a bomb or decoy), DETECT 2 the opening\'s lone find too; IMP 1 runs an anti-imp forward d-clear (DAT <s) when the scan finds nothing, IMP 2 also when a find looks like an imp trail. PUMP 1 feeds the clears from SPL #0.',
  params: { STEP: [1, 27719], GAP: [1, 32], SCANS: [1, 4000], DETECT: [0, 2], IMP: [0, 2], BACK: [0, 16], SPLS: [0, 3], PUMP: [0, 1], POINTS: [0, 31] },
  defaults: { STEP: 3359, GAP: 8, SCANS: 3000, DETECT: 0, IMP: 1, BACK: 0, SPLS: 2, PUMP: 1, POINTS: 0 },
  entry: 'payload',
  needs: ['probe'],
  provides: { datBomb: 'bd' },
  mutable: (P) => [['cnt', ['b']], ...(P.DETECT || P.IMP === 2 ? [['tp', ['b']]] : [])],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (settings.dialect === '88') return ["finisher-oneshot needs ICWS'94"];
    if (P.PUMP && settings.maxProcesses < 2) out.push('PUMP needs more than one process');
    if (P.IMP && !impStepOf(P, core)) out.push(`finisher-oneshot: no ${impPoints(P, core)}-point imp step on a ${core}-cell core`);
    if (P.STEP % core === 0 || P.STEP % core === P.GAP % core) out.push('finisher-oneshot: STEP must move the pair off itself');
    if (2 * (P.GAP + P.BACK + 4) >= settings.maxLength) out.push('finisher-oneshot: GAP and BACK are as wide as a warrior');
    return out;
  },
  emit: emitOneshot,
  plant(api) {
    const plan = oneshotPlan(api);
    if (!plan) return [];
    return [[plan.lone, MARKER], [plan.body, MARKER], [mod(plan.body + 1, api.core), MARKER2]];
  },
  watch: watchOneshot,
};

// ---------------------------------------------------------------------------
// finisher-dclear-fwd
//
//   gate   DAT  0, #len         the pointer; first cell, so a wrap lands on it
//  [pump   SPL  #0, 0]
//   dl     MOV.I bomb, >gate    one DAT
//   dd     DJN.F dl, >gate      one decrement
//   bomb   DAT  <s, #len        anti-imp A-field (ANTI 1) or #0; B skips the block
//
// The MOV that comes round onto the gate overwrites it with the bomb, whose B
// is the block's length, so the next write is just past the block. A DJN that
// lands on the gate decrements it to 0 and the next MOV overwrites it the same
// way. With the pump, many processes share the pointer; the MOVs and DJNs
// interleave, so a cell is DAT-bombed on one lap and decremented on another.
function emitDclearFwd(ctx) {
  const { L, P, core } = ctx, s = impStepOf(P, core);
  const len = `(${L('bomb')}+1-${L('gate')})`;
  ctx.ins('gate', 'DAT', 'F', '#0', `#${len}`);
  if (P.PUMP) ctx.ins('pump', 'SPL', 'B', '#0', '0');
  else ctx.mark('pump');
  ctx.ins('dl', 'MOV', 'I', L('bomb'), `>${L('gate')}`);
  ctx.ins('dd', 'DJN', 'F', L('dl'), `>${L('gate')}`);
  ctx.ins('bomb', 'DAT', 'F', P.ANTI ? `<${s}` : '#0', `#${len}`);
}

function watchDclearFwd(api) {
  const { vm, core, P } = api, gate = api.at('gate'), len = api.self.size;
  const s = impStepOf(P, core), entry = api.at(P.PUMP ? 'pump' : 'dl');
  const touched = new Int32Array(core).fill(-1), datted = new Int32Array(core).fill(-1);
  let entered = null, sole = false, wraps = 0, dats = 0, decs = 0, firstWrap = null;
  return {
    before(pc) {
      if (api.inDead(pc) || !api.inSelf(pc) || !api.same(vm.peek(pc), api.code('gate', api.norm(pc - gate)))) return null;   // not our code running (a dead branch run over by an imp)
      if (entered === null && pc === entry) { entered = vm.cycle; sole = (api.scenario === 'alone'); }
      if (pc !== api.at('dl') && pc !== api.at('dd')) return null;
      return { pc, dl: pc === api.at('dl'), t: mod(gate + vm.peek(gate).b, core) };
    },
    after(tok) {
      if (!tok) return;
      const { t, pc } = tok;
      if (t === gate) {
        if (tok.dl) {
          wraps++;
          if (firstWrap === null) firstWrap = vm.cycle;
          if (api.norm(vm.peek(gate).b) !== len) throw new Error('finisher-dclear-fwd: the write over the gate did not reset the pointer past the block');
        }
        return;
      }
      if (api.inSelf(t)) throw new Error('finisher-dclear-fwd hit its own code');
      if (tok.dl) {
        const x = vm.peek(t);
        if (!api.same(x, api.code('bomb')) || vm.writerPc[t] !== pc) throw new Error('finisher-dclear-fwd wrote something other than its bomb');
        if (P.ANTI && (x.aMode !== '<' || api.norm(x.a) !== s)) throw new Error('finisher-dclear-fwd: the bomb is not anti-imp');
        dats++; datted[t] = vm.cycle;
      } else decs++;
      touched[t] = vm.cycle;
    },
    final() {
      if (entered === null) return;
      for (const l of ['dl', 'dd', 'bomb']) if (!api.same(vm.peek(api.at(l)), api.code(l))) throw new Error('finisher-dclear-fwd damaged its own code');
      if (!sole) return;
      if (dats + decs > 2 * core && wraps === 0) throw new Error('finisher-dclear-fwd never came round onto its gate');
      if (dats < decs / 2 - 10) throw new Error('finisher-dclear-fwd decrements far more than it bombs');
      // Every cell outside the block is reached on the first lap, and DAT-bombed within a few laps.
      if (firstWrap !== null) for (let c = 0; c < core; c++) if (!api.inSelf(c) && touched[c] < entered) throw new Error('finisher-dclear-fwd left cells untouched on its first lap');
      if (dats + decs > 8 * core) {
        let missed = 0;
        for (let c = 0; c < core; c++) if (!api.inSelf(c) && datted[c] < entered) missed++;
        if (missed > core / 50) throw new Error(`finisher-dclear-fwd never DAT-bombed ${missed} cells in four laps`);
      }
    },
  };
}

const dclearFwd = {
  id: 'finisher-dclear-fwd',
  kind: 'finisher', exit: 'never', writes: 'core', relocatable: true, protects: 'self', dialects: '94',
  processes: (P) => (P.PUMP ? 8 : 1), grows: true, entryFirst: false,
  purpose: 'The hill\'s forward d-clear: MOV bomb, >gate / DJN.F -1, >gate from a SPL #0 pump (PUMP 1), one DAT and one decrement a loop, walking forward from just past the block; the gate is its first cell, so the write that comes round onto it resets the pointer past the block. ANTI 1 makes the bomb DAT <s (s the POINTS-point imp step), which breaks an imp ring that runs into it.',
  params: { ANTI: [0, 1], PUMP: [0, 1], POINTS: [0, 31] },
  defaults: { ANTI: 1, PUMP: 1, POINTS: 0 },
  entry: 'pump',
  provides: { datBomb: 'bomb' },
  mutable: [['gate', ['op', 'mod', 'aMode', 'a', 'bMode', 'b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (settings.dialect === '88') return ["finisher-dclear-fwd needs ICWS'94"];
    if (P.PUMP && settings.maxProcesses < 2) out.push('PUMP needs more than one process');
    if (P.ANTI && !impStepOf(P, core)) out.push(`finisher-dclear-fwd: no ${impPoints(P, core)}-point imp step on a ${core}-cell core`);
    return out;
  },
  emit: emitDclearFwd,                 // without the pump, 'pump' marks the MOV
  watch: watchDclearFwd,
};

// ---------------------------------------------------------------------------
// finisher-twopass-stream
//
//   payload  guard the probe off the image, JMP cs0
//   bptr     DAT  1, #skip+1       *bptr = cs0 (A 1), later bptr itself (A 0)
//   cs0      SPL  #DJS, #skip      pump, and the SPL pass's bomb
//   w1, w2   MOV.I *bptr, >probe
//   dj       DJN.F w1, }cs0        the stream: decrements cs0 + cs0.A, cs0.A++
//
// The SPL pass's bomb over the probe sets probe.B = skip; the DAT pass's bomb
// is bptr after the stream's decrement, DAT 0, #skip. The stream starts DJS
// cells past cs0 and walks forward round the core; it reaches bptr after
// CORESIZE - DJS - 1 loops (two writes a loop: DJS 3000 gives 1.25 laps of SPL
// on 8,000 cells; King Cobra's is about two), and then cs0, where it parks. The
// hill scores DJS 400 to 5000 the same.
function emitTwopassStream(ctx) {
  const { L, P, span } = ctx, probe = ctx.ref('probe');
  const idx = () => `(${probe}+${ctx.pc()})`;
  ctx.mark('payload');
  ctx.ins('', 'SLT', 'AB', `#(${span}-${idx()}-1)`, probe);
  ctx.ins('', 'MOV', 'AB', `#(${span}-${idx()})`, probe);
  ctx.ins('', 'JMP', 'B', L('cs0'));
  ctx.ins('bptr', 'DAT', 'F', '#1', `#(${span}-${idx()}+1)`);
  ctx.ins('cs0', 'SPL', 'B', `#${P.DJS}`, `#(${span}-${idx()})`);
  ctx.ins('w1', 'MOV', 'I', `*${L('bptr')}`, `>${probe}`);
  ctx.ins('w2', 'MOV', 'I', `*${L('bptr')}`, `>${probe}`);
  ctx.ins('dj', 'DJN', 'F', L('w1'), `}${L('cs0')}`);
}

function watchTwopassStream(api) {
  const { vm, core, P } = api, probe = api.ref('probe');
  const bptr = api.at('bptr'), cs0 = api.at('cs0'), dj = api.at('dj');
  const skip = api.norm(api.code('cs0').b);
  const spl = new Int32Array(core).fill(-1), dat = new Int32Array(core).fill(-1);
  let entered = null, sole = false, switched = null, loops = 0, splWrites = 0, datWrites = 0, wraps = 0, parkedFrom = null;
  return {
    before(pc) {
      if (api.inDead(pc) || !api.inSelf(pc) || !api.same(vm.peek(pc), api.code('payload', api.norm(pc - api.at('payload'))))) return null;
      if (entered === null && pc === api.at('payload')) { entered = vm.cycle; sole = (api.scenario === 'alone'); }
      if (entered === null) return null;
      if (pc === dj) return { dj: true, a: vm.peek(bptr).a, csA: vm.peek(cs0).a, t: mod(cs0 + vm.peek(cs0).a, core) };
      if (pc === api.at('w1') || pc === api.at('w2')) return { pc, t: mod(probe + vm.peek(probe).b, core), bomb: vm.peek(mod(bptr + vm.peek(bptr).a, core)) };
      if (vm.peek(bptr).a !== (switched === null ? 1 : 0)) throw new Error('finisher-twopass-stream: bptr changed by something other than its stream');
      return null;
    },
    after(tok) {
      if (!tok) return;
      if (tok.dj) {
        loops++;
        const a = vm.peek(bptr).a;
        if (tok.a === 1 && a !== 1) {
          if (tok.t !== bptr || a !== 0 || vm.writerPc[bptr] !== dj) throw new Error('finisher-twopass-stream: bptr changed by something other than its stream');
          switched = vm.cycle;
          if (sole && loops < core - P.DJS - 2) throw new Error('finisher-twopass-stream switched to DAT before its stream came round');
          if (sole && api.vm.processes(0).length > 0) {
            // The SPL pass covered everything past the image before the first DAT.
            if (2 * (core - P.DJS) > core + skip) for (let c = 0; c < core; c++) if (api.rel(c, probe) >= skip && spl[c] < entered) throw new Error('finisher-twopass-stream: the SPL pass did not cover the core before the switch');
          }
        }
        if (switched !== null && tok.t === cs0) parkedFrom ??= vm.cycle;
        if (switched !== null && parkedFrom !== null && tok.t !== cs0) throw new Error('finisher-twopass-stream: the stream left the pump after parking');
        // It may run over the dead guard in front of bptr; never over the clear's loop.
        if ([api.at('w1'), api.at('w2'), dj].includes(tok.t)) throw new Error("finisher-twopass-stream's stream reached its own loop");
        return;
      }
      const { t, pc, bomb } = tok;
      if (!api.same(vm.peek(t), bomb) || vm.writerPc[t] !== pc) throw new Error('finisher-twopass-stream wrote something other than its bomb');
      const want = switched === null ? 'SPL' : 'DAT';
      if (bomb.op !== want) throw new Error(`finisher-twopass-stream wrote a ${bomb.op} in its ${want} pass`);
      if (t === probe) {
        wraps++;
        if (api.norm(vm.peek(probe).b) !== skip) throw new Error('finisher-twopass-stream: the bomb over its pointer did not skip the image');
        return;
      }
      if (api.inSelf(t) || api.rel(t, probe) < skip) throw new Error('finisher-twopass-stream cleared its own warrior');
      if (want === 'SPL') { splWrites++; spl[t] = vm.cycle; } else { datWrites++; dat[t] = vm.cycle; }
    },
    final() {
      if (entered === null) return;
      for (const l of ['w1', 'w2', 'dj']) if (!api.same(vm.peek(api.at(l)), api.code(l))) throw new Error('finisher-twopass-stream damaged its own code');
      if (!sole) return;
      if (loops > core - P.DJS + 4 && switched === null) throw new Error('finisher-twopass-stream: its stream never switched the clear to DAT');
      if (switched !== null && loops > core - P.DJS + 20 && parkedFrom === null) throw new Error('finisher-twopass-stream: the stream did not park on the pump');
      if (datWrites > core + skip) for (let c = 0; c < core; c++) if (api.rel(c, probe) >= skip && dat[c] < entered) throw new Error('finisher-twopass-stream: the DAT pass left cells untouched');
    },
  };
}

const twopassStream = {
  id: 'finisher-twopass-stream',
  kind: 'finisher', exit: 'never', writes: 'core', relocatable: false, protects: 'image', dialects: '94',
  processes: 8, grows: true,
  purpose: 'King Cobra\'s self-switching clear: from a SPL #DJS pump it writes *bptr forward through the probe (from the find), SPL first; the pump\'s A-field drives a DJN.F stream round the core that, after CORESIZE - DJS loops, decrements bptr.A to 0 so *bptr becomes the DAT, then parks on the pump. Each bomb over the probe resets it past the image.',
  params: { DJS: [8, 6000] },
  defaults: { DJS: 3000 },
  entry: 'payload',
  needs: ['probe'],
  provides: { splBomb: 'cs0', datBomb: 'bptr' },
  mutable: [['bptr', ['a', 'b']], ['cs0', ['a', 'b']]],
  mismatches(P, settings) {
    const out = [];
    if (settings.dialect === '88') return ["finisher-twopass-stream needs ICWS'94"];
    if (settings.maxProcesses < 2) out.push('finisher-twopass-stream needs more than one process (its pump)');
    if (P.DJS >= settings.coreSize - settings.maxLength) out.push('finisher-twopass-stream: DJS starts the stream inside the warrior');
    return out;
  },
  emit: emitTwopassStream,
  watch: watchTwopassStream,
};

export default [oneshot, dclearFwd, twopassStream];
export { oneshotPlan };
