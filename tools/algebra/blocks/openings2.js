// More hill openings and deployment tricks (docs/hill-recipe-book.md, "What
// our blocks are missing", gaps 2, 10 and 11). `probe-burst2` is the two-stream
// burst the quickscanners fire at a hit; `boot-stone` boots a small stone and
// cleans up after itself (pointer wipe, early start); `decoys-mixed` is a long
// in-image decoy whose cells all differ; `decoy-mirror` copies the warrior's
// own image far away as a decoy. How to write a block: docs/block-algebra.md.
// All Redcode here is written from scratch.

import {observeBurst} from '../observation-roles.js';
const MARKER = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };
const mod = (x, core) => ((x % core) + core) % core;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

// ---------------------------------------------------------------------------
// probe-burst2
//
// The burst nearly every quickscanner on the 94nop hill fires after a hit
// (Arvon, Azathoth, Hullabaloo, pdQscan, luca, Eternal Exile): two bombs per
// four-cycle loop instead of one. The loop is
//
//   loop  mov  bomb, @ptr        ; stream 1: the cell ptr points at
//   ptr   mov  bomb, *0          ; stream 2: through the bomb just written
//         add  #STEP, ptr
//         djn  loop, #COUNT
//   bomb  dat  #-GAP, #0
//
// The second MOV addresses through the A field of the bomb the first one has
// just dropped, so it lands GAP cells before it. Stream 1 runs from OFFSET
// cells before the found cell up through it; stream 2 runs GAP cells behind.
//
// There is no room in four cycles for a per-bomb guard like probe-burst's, so
// the whole window is checked once before the loop: it runs from
// found - OFFSET - GAP to found - OFFSET + (COUNT-1)*STEP, W = GAP +
// (COUNT-1)*STEP cells wide. With the image at [probe, probe + span), the
// burst is safe exactly when t = found - OFFSET - GAP - span (mod core) is
// below core - span - W; otherwise (a hit too close to the warrior, or the
// probe at the image boundary) it hands on without bombing.

// The planted found cell: half a core on, stepped on until none of the burst
// touches the warrior (a boot's copy may sit half a core away).
const burstBounds=P=>{const run=(P.COUNT-1)*P.STEP,side=(P.SIDE??-1)*P.GAP;return {lo:-P.OFFSET+Math.min(0,run)+Math.min(0,side),hi:-P.OFFSET+Math.max(0,run)+Math.max(0,side),width:P.GAP+Math.abs(run)};};
const burstFound = (api) => {
  const { P, core } = api, bounds=burstBounds(P),lo=bounds.lo-2,hi=bounds.hi+2;
  let c = mod(api.image.start + Math.floor(core / 2) + 1, core);
  for (let tries = 0; tries < 16; tries++, c = mod(c + 1009, core)) {
    let clear = true;
    for (let d = lo; d <= hi && clear; d++) if (api.inImage(c + d)) clear = false;
    if (clear) return c;
  }
  return c;
};
const burst2Cells = (P, found, core) => Array.from({ length: P.COUNT }, (_, k) => mod(found - P.OFFSET + k * P.STEP, core))
  .flatMap((c) => [c, mod(c + (P.SIDE??-1)*P.GAP, core)]);

const probeBurst2 = {
  id: 'probe-burst2',
  kind: 'opening', exit: 'next', processes: 1, writes: 'sparse', link: 'fall', dialects: '94',
  purpose: 'Two-stream burst around the cell a probe found: each four-cycle loop drops a bomb (BOMB 0 DAT, 1 SPL) on the pointer and another SIDE*GAP cells from it through the first bomb\'s A field. COUNT loops advance by signed STEP from OFFSET before the hit. SIDE -1 is behind, +1 ahead. The entire signed target hull must avoid the image; a boundary probe hands on immediately.',
  params: { COUNT: [1, 40], STEP: [-100, 100], OFFSET: [0, 200], GAP: [1, 200], BOMB: [0, 1], SIDE:[-1,1] },
  defaults: { COUNT: 16, STEP: 7, OFFSET: 0, GAP: 80, BOMB: 0, SIDE:-1 },
  observationRole:'probe-burst',observe:observeBurst,
  entry: 'burst',
  // As probe-burst: it needs an upstream probe and doesn't advertise one, so
  // the upstream probe (still pointing at the found cell) carries on through.
  needs: ['probe'],
  mutable: [['ptr', ['b']], ['cnt', ['b']]],
  mismatches(P, settings) {
    const out = [], W = burstBounds(P).width;
    if(!P.STEP)out.push('STEP must be nonzero');if(!P.SIDE)out.push('SIDE must be -1 or1');
    if (W + P.OFFSET >= Math.floor(settings.coreSize / 2)) out.push('the burst is wide enough to wrap into the warrior');
    if (P.GAP % Math.abs(P.STEP) === 0 && P.GAP / Math.abs(P.STEP) < P.COUNT) out.push('GAP is a multiple of STEP, so the two streams bomb the same cells');
    return out;
  },
  emit(ctx) {
    const { L, P, span, core } = ctx, U = ctx.ref('probe'), ptr = L('ptr');
    const bounds=burstBounds(P),W=bounds.width;
    ctx.ins('burst', 'SNE', 'AB', `#${span}`, U);               // boundary: nothing found
    ctx.ins('', 'JMP', 'B', ctx.next);
    ctx.ins('', 'MOV', 'B', U, ptr);                             // ptr.B = found - probe
    ctx.ins('', 'ADD', 'AB', `#${mod(bounds.lo - span, core)}`, ptr);   // t
    ctx.ins('', 'SLT', 'B', ptr, `#${core - span - W}`);        // t below the limit: safe
    ctx.ins('', 'JMP', 'B', ctx.next);
    ctx.ins('', 'ADD', 'AB', `#(${span-P.OFFSET-bounds.lo}+${U}-${ptr})`, ptr);   // ptr.B = found - OFFSET - ptr
    ctx.ins('loop', 'MOV', 'I', L('bomb'), `@${ptr}`);
    ctx.ins('ptr', 'MOV', 'I', L('bomb'), '*0');
    ctx.ins('', 'ADD', 'AB', `#${P.STEP}`, ptr);
    ctx.ins('cnt', 'DJN', 'B', L('loop'), `#${P.COUNT}`);
    ctx.ins('', 'JMP', 'B', ctx.next);
    ctx.ins('bomb', P.BOMB ? 'SPL' : 'DAT', P.BOMB ? 'B' : 'F', `#${(P.SIDE??-1)*P.GAP}`, '#0');
  },
  plant(api) {
    const found = burstFound(api), U = api.ref('probe');
    return [[U, { op: 'DAT', mod: 'F', aMode: '#', a: 0, bMode: '#', b: api.norm(found - U) }], [found, MARKER]];
  },
  watch(api) {
    const { vm, core, P } = api, ptr = api.at('ptr'), loop = api.at('loop');
    const own = api.scenario === 'probe-burst2: planted target';
    const want = new Set(burst2Cells(P, burstFound(api), core));
    const hit = new Set();
    let bombs = 0, aimed = null;
    return {
      before(pc) {
        if (pc === api.entry() && aimed === null) aimed = mod(api.ref('probe') + vm.peek(api.ref('probe')).b, core) === burstFound(api);
        // Only while the cell still holds the burst's code: an imp crawling over the abandoned original isn't the burst.
        if ((pc === loop || pc === ptr) && !['op', 'mod', 'aMode', 'bMode'].every((f) => vm.peek(pc)[f] === api.code(pc === loop ? 'loop' : 'ptr')[f])) return null;
        if (pc === loop) return [pc, mod(ptr + vm.peek(ptr).b, core)];
        if (pc === ptr) { const t = mod(ptr + vm.peek(ptr).b, core); return [pc, mod(t + vm.peek(t).a, core)]; }
        return null;
      },
      after(tok) {
        if (tok === null) return;
        const [pc, t] = tok;
        if (api.inImage(t) && !api.inDead(t)) throw new Error(`probe-burst2 bombed its own image (${api.scenario}, cell ${api.rel(t, api.image.start)})`);
        if (!api.same(vm.peek(t), api.code('bomb')) || vm.writerPc[t] !== pc) throw new Error(`probe-burst2's ${pc === loop ? 'first' : 'second'} stream dropped something other than its bomb`);
        bombs++; hit.add(t);
      },
      final() {
        // Under a boot the opening may find the abandoned original first; the
        // ring is only owed when the burst started at the planted cell.
        if (own && aimed) {
          if (bombs !== 2 * P.COUNT) throw new Error(`probe-burst2 dropped ${bombs} bombs, not ${2 * P.COUNT}`);
          for (const c of want) if (!hit.has(c)) throw new Error('probe-burst2 missed a cell of its two streams around the found cell');
        }
        if (api.alone && bombs) throw new Error('probe-burst2 bombed although the opening found nothing');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// boot-stone
//
// Boot hygiene (gap 10), shown on a small stone because a block can't wrap
// another block (the `boot` combinator would need the change). The block
// copies a four-cell Dwarf HOP cells away with four unrolled MOVs through one
// pointer, bp, and starts it there. Two options from the hill:
//
// WIPE 1 (Eternal Exile, Kaitain, Silver Talon): the copy is started with an
// SPL, then the boot process overwrites the SPL and bp with DAT 0,0 and dies
// on that DAT. Nothing left in the abandoned image points at the copy, so a
// scanner that finds the image learns nothing about where the warrior went.
//
// EARLY 1 (Excalibur): the copy is started after its first two cells (the
// bomb and the ADD) and the last two are copied while it runs. The copy runs
// one cell behind the boot: after the SPL the boot is ahead in the queue, so
// it copies the MOV before the copy reaches it, and the JMP likewise. '94 only
// (the '88 boot copies backward with a predecrement, so the entry comes last).
//
// The stone's step must share a factor of 4 or more with the core, so its
// bombs never land on its three code cells, and its first bombs must miss the
// image while the boot is still running there.

const BS_SIZE = 4;
const bootStone = {
  id: 'boot-stone',
  kind: 'body', exit: 'never', writes: 'sparse', roams: true, moves: true,
  purpose: 'Copies a four-cell Dwarf (a DAT every STEP cells) HOP cells away and starts it; WIPE 1 starts it with an SPL, then erases the SPL and the copy pointer and lets the boot process die, so the abandoned image holds no pointer to the copy; EARLY 1 starts the copy after its first two cells and finishes copying while it runs.',
  params: { HOP: [200, 54000], STEP: [4, 4000], WIPE: [0, 1], EARLY: [0, 1] },
  defaults: { HOP: 4000, STEP: 3044, WIPE: 1, EARLY: 0 },
  processes: (P) => (P.WIPE || P.EARLY ? 2 : 1),
  entry: 'c0',
  provides: { datBomb: 'sb' },
  mutable: [['bp', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, room = settings.maxLength, out = [];
    if (settings.dialect === '88' && P.EARLY) out.push("boot-stone: EARLY needs ICWS'94 (a forward copy)");
    if (gcd(P.STEP, core) < BS_SIZE) out.push(`boot-stone: STEP ${P.STEP} shares less than ${BS_SIZE} with the core, so the stone bombs itself`);
    if (P.HOP < room || P.HOP > core - room - BS_SIZE) out.push('boot-stone: HOP puts the copy on the warrior itself');
    for (let k = 1; k <= 4; k++) {
      const r = mod(P.HOP + k * P.STEP, core);
      if (r <= room || r >= core - room) { out.push("boot-stone: the copy's first bombs land on the image while the boot is still there"); break; }
    }
    return out;
  },
  emit(ctx) {
    const { L, P, old } = ctx, sb = L('sb'), sl = L('sl'), bp = L('bp');
    const order = old ? [3, 2, 1, 0] : [0, 1, 2, 3];        // '88 copies backward through a predecrement
    const launch = (label, op) => ctx.ins(label, op, 'B', `${sl}+${P.HOP}`);
    order.forEach((i, n) => {
      if (P.EARLY && n === 2) launch('launch', 'SPL');
      ctx.ins(`c${n}`, 'MOV', 'I', i ? `${sb}+${i}` : sb, old ? `<${bp}` : `>${bp}`);
    });
    if (!P.EARLY) launch('launch', P.WIPE ? 'SPL' : 'JMP');
    else if (!P.WIPE) launch('join', 'JMP');                 // EARLY without WIPE: the boot process joins the stone
    if (P.WIPE) {
      ctx.ins('', 'MOV', 'I', L('clean'), L('launch'));
      ctx.ins('', 'MOV', 'I', L('clean'), bp);
      ctx.ins('clean', 'DAT', 'F', '#0', '#0');
    }
    ctx.ins('sb', 'DAT', 'F', '#0', '#0');
    ctx.ins('sl', 'ADD', 'AB', `#${P.STEP}`, sb);
    ctx.ins('', 'MOV', 'I', sb, `@${sb}`);
    ctx.ins('', 'JMP', 'B', sl);
    ctx.ins('bp', 'DAT', 'F', '#0', old ? `#(${sb}+${P.HOP + BS_SIZE}-${bp})` : `#(${sb}+${P.HOP}-${bp})`);
  },
  running(api) {
    const copy = api.add(api.at('sb'), api.P.HOP);
    return api.vm.processes(0).some((q) => api.rel(q, copy) < BS_SIZE);
  },
  watch(api) {
    const { vm, P } = api, sb = api.at('sb'), copy = api.add(sb, P.HOP);
    const inCopy = (c) => api.rel(c, copy) < BS_SIZE;
    const copyPcs = new Map(Array.from({ length: BS_SIZE }, (_, n) => [api.at(`c${n}`), n]));
    const bpAt = api.at('bp'), movAt = api.add(copy, 2), clean = P.WIPE ? api.at('clean') : null;
    let written = 0, firstRun = null, wiped = false, bombs = 0;
    return {
      before(pc) {
        if (firstRun === null && inCopy(pc)) {
          firstRun = vm.cycle;
          if (P.EARLY && written >= BS_SIZE) throw new Error('boot-stone: EARLY, but the copy started only after it was complete');
          if (!P.EARLY && written < BS_SIZE) throw new Error('boot-stone: the copy started before it was complete');
        }
        if (copyPcs.has(pc) && api.same(vm.peek(pc), api.code(`c${copyPcs.get(pc)}`))) {
          const b = vm.peek(bpAt).b, t = api.norm(bpAt + b + (api.settings.dialect === '88' ? -1 : 0));
          return ['copy', t, api.norm(pc + vm.peek(pc).a)];
        }
        if (pc === clean) {
          // The boot process is about to die: nothing in the boot code may point at the copy.
          for (let i = 0; i < api.self.size; i++) {
            const c = api.add(api.self.start, i), ins = vm.peek(c);
            for (const [m, f] of [[ins.aMode, ins.a], [ins.bMode, ins.b]]) if (m !== '#' && inCopy(api.norm(c + f))) throw new Error('boot-stone: WIPE, but the abandoned boot code still points at the copy');
          }
          wiped = true;
        }
        if (pc === movAt && firstRun !== null) return ['bomb', api.norm(copy + vm.peek(copy).b)];
        return null;
      },
      after(tok) {
        if (!tok) return;
        const [kind, t, src] = tok;
        if (kind === 'copy') {
          if (!inCopy(t)) throw new Error('boot-stone: the boot wrote outside the copy');
          if (!api.same(vm.peek(t), vm.peek(src))) throw new Error('boot-stone: a copied cell differs from its original');
          written++;
        } else {
          if (inCopy(t) && t !== copy) throw new Error('boot-stone: the stone bombed its own code');
          bombs++;
        }
      },
      final() {
        if (firstRun === null) throw new Error('boot-stone: the copy never ran');
        if (written !== BS_SIZE) throw new Error(`boot-stone: copied ${written} cells, not ${BS_SIZE}`);
        if (P.WIPE && !wiped) throw new Error('boot-stone: WIPE, but the boot process never reached its wipe');
        if (api.alone && !bombs) throw new Error('boot-stone: the copy never bombed');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// decoys-mixed
//
// A long in-image decoy (gap 11): Excalibur lays 51 SPLs, one of every
// modifier, and Silver Talon 72 with varied B modes. `decoys` stops at 18
// cells and repeats its cells. Here COUNT SPL cells cycle through the seven
// modifiers, the A modes and the B modes, and every A field is different, so
// no two cells are equal: a scanner comparing any two of them (SNE.I, SEQ.I)
// always sees a difference and stops on the decoy instead of skipping it as
// empty. Both fields are non-zero, so JMZ/JMN scanners see every cell too.
// '88 uses SPL with its three A modes and four B modes (no modifiers, no
// immediate A).

const MODS = ['A', 'B', 'AB', 'BA', 'F', 'X', 'I'];
const AMODES94 = ['#', '$', '@', '*', '<', '{', '>', '}'], BMODES94 = ['#', '$', '@', '<', '>'];
const AMODES88 = ['$', '@', '<'], BMODES88 = ['#', '$', '@', '<'];
const decoysMixed = {
  id: 'decoys-mixed',
  kind: 'data', exit: 'data', processes: 0, writes: 'sparse',
  purpose: 'COUNT decoy cells (19-90), all different: SPLs cycling through every modifier, A mode and B mode with non-zero fields, so a scanner comparing any two of them sees them differ and stops there.',
  params: { COUNT: [19, 90], SEED: [1, 400] },
  defaults: { COUNT: 40, SEED: 97 },
  mismatches(P, settings) {
    return P.COUNT + 2 > settings.maxLength ? ['decoys-mixed: more decoy cells than the warrior may hold'] : [];
  },
  emit(ctx) {
    const { P, old } = ctx, A = old ? AMODES88 : AMODES94, B = old ? BMODES88 : BMODES94;
    // A fields 1, 2, ... COUNT (all different); B fields wander but are never 0.
    for (let i = 0; i < P.COUNT; i++) ctx.ins('', 'SPL', MODS[i % 7], `${A[i % A.length]}${i + 1}`, `${B[i % B.length]}${1 + ((i * P.SEED) % 997)}`);
  },
};

// ---------------------------------------------------------------------------
// decoy-mirror
//
// A remote decoy that looks like us (gap 11): the opening copies the last
// COUNT cells of the warrior's image (all of it if the image is shorter) DIST
// cells away, then hands on with the probe at the image boundary. A scanner
// that finds the copy sees real code, and its burst or clear is spent there.
// Excalibur's "mirror" copies of its tail are the hill's version (their
// purpose is a guess in the recipe book); Forgotten Scanner's decoy maker is
// the hill's other remote decoy. It costs two cycles a cell.

const decoyMirror = {
  id: 'decoy-mirror',
  kind: 'opening', exit: 'next', processes: 1, writes: 'sparse', link: 'fall',
  purpose: 'Copies the last COUNT cells of the warrior\'s image (all of it if shorter) DIST cells away as a decoy that looks like real code, then hands on with the probe at the image boundary.',
  params: { COUNT: [4, 100], DIST: [256, 54000] },
  defaults: { COUNT: 24, DIST: 2400 },
  entry: 'mMake',
  provides: { probe: 'probe' },
  mutable: [['mSrc', ['b']], ['mDst', ['b']], ['mCnt', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, room = settings.maxLength;
    return P.DIST < room || P.DIST > core - 2 * room ? ['decoy-mirror: the mirror would land on the warrior itself'] : [];
  },
  emit(ctx) {
    const { L, P, span } = ctx, n = Math.max(1, Math.min(P.COUNT, span));
    ctx.ins('mMake', 'MOV', 'I', `<${L('mSrc')}`, `<${L('mDst')}`);
    ctx.ins('', 'DJN', 'B', L('mMake'), L('mCnt'));
    ctx.ins('', 'JMP', 'B', ctx.next);
    // The image is cells 0 .. span-1 of the warrior: copy down from its end.
    ctx.ins('mSrc', 'DAT', 'F', '#0', `#${span - ctx.pc()}`);
    ctx.ins('mDst', 'DAT', 'F', '#0', `#${span - ctx.pc() + P.DIST}`);
    ctx.ins('mCnt', 'DAT', 'F', '#0', `#${n}`);
    ctx.ins('probe', 'DAT', 'F', '#0', `#${span}`);
  },
  watch(api) {
    const { vm, P, core } = api, src = api.at('mSrc'), dst = api.at('mDst'), loop = api.at('mMake');
    const end = api.norm(src + api.code('mSrc').b), n = Math.max(1, Math.min(P.COUNT, api.code('probe').b));   // probe.B = span
    const want = new Set(Array.from({ length: n }, (_, k) => mod(end - 1 - k + P.DIST, core)));
    const made = new Set();
    return {
      before(pc) {
        if (pc !== loop || !api.same(vm.peek(pc), api.code('mMake'))) return null;
        return [api.norm(src + vm.peek(src).b - 1), api.norm(dst + vm.peek(dst).b - 1)];
      },
      after(t) {
        if (!t) return;
        const [s, d] = t;
        if (api.inImage(d)) throw new Error('decoy-mirror wrote inside its own image');
        if (!api.inImage(s)) throw new Error('decoy-mirror copied a cell from outside its image');
        // Copying mDst itself captures its B field before this MOV's own predecrement of it.
        const orig = s === dst ? { ...vm.peek(s), b: api.norm(vm.peek(s).b + 1) } : vm.peek(s);
        if (!api.same(vm.peek(d), orig) || vm.writerPc[d] !== loop) throw new Error('decoy-mirror\'s copy differs from the image');
        made.add(d);
      },
      final() {
        if (!api.entered()) return;
        if (made.size !== n) throw new Error(`decoy-mirror copied ${made.size} cells, not ${n}`);
        for (const c of want) if (!made.has(c)) throw new Error('decoy-mirror put its mirror in the wrong place');
      },
    };
  },
};

export default [probeBurst2, bootStone, decoysMixed, decoyMirror];
