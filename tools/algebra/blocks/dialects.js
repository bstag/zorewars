// ICWS'88 versions of the '94-only scan openings and the guarded clear, so '88
// trees can scan, then clear. '88 has CMP but no SNE, no modifiers, no A-field
// indirection and no postincrement, so the scans compare with CMP instructions
// whose own fields are the pointers (an ADD of a DAT #s, #s steps both fields),
// and the clear walks downward with predecrement. The code is legal '94 too,
// and runs the same there: each instruction is written with the modifier '88
// implies. Every opening leaves in `probe` (B) the higher cell of the pair it
// found, or the first cell past the image when it found nothing; the clear
// starts on that cell and walks down from it. How to write a block:
// docs/block-algebra.md.

const OPENING = { kind: 'opening', exit: 'next', processes: 1, writes: 'sparse', link: 'fall', provides: { probe: 'probe' } };
// What a planted opponent looks like: a cell no empty core holds.
const MARKER = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };
const mod = (x, core) => ((x % core) + core) % core;

// Watch for the moment control leaves the block's code and check the probe then.
function onExit(api, check) {
  let prevInSelf = false, exited = false;
  return {
    before(pc) {
      if (prevInSelf && !api.inSelf(pc) && !exited) { exited = true; check(mod(api.at('probe') + api.vm.peek(api.at('probe')).b, api.core)); }
      prevInSelf = api.inSelf(pc);
      return null;
    },
    exited: () => exited,
  };
}
// The cell handed on is the first one past the image: the cell before it is ours, it is not.
const atBoundary = (api, c) => api.inImage(c - 1) && !api.inImage(c);
// A booted copy runs away from the image as loaded (and its guard knows only itself).
const movedAway = (api) => mod(api.self.start - api.image.start, api.core) >= api.total;
// Alone, an opening must hand on the boundary; a booted one may also hand on a
// pair that holds code of ours its guard doesn't know of (the boot left behind).
function aloneCheck(api, id, c, low) {
  if (api.scenario !== 'alone' || atBoundary(api, c)) return;
  if (!movedAway(api) || (!api.inImage(c) && !api.inImage(low))) throw new Error(`${id} found nothing but did not hand on the image boundary`);
}
function plantedCheck(api, id, c, want, exit) {
  if (c !== want) throw new Error(`${id} did not hand on the planted pair (handed on ${c}, expected ${want})`);
  exit();
}

// --- opening-cmpscan-88 -----------------------------------------------------
// The pairs it compares, as absolute addresses of their lower cells.
const cmpPairs = (api) => {
  const c = api.at('cmp'), { START, SSTEP, SCANS } = api.P;
  return Array.from({ length: SCANS }, (_, k) => mod(c + START + (k + 1) * SSTEP, api.core));
};
// The planted pair: the first one clear of every copy of the warrior, if all the
// pairs before it are clear too (so nothing of ours is found first).
function cmpTarget(api) {
  const clear = (a) => !api.inImage(a) && !api.inImage(a + api.P.GAP);
  const pairs = cmpPairs(api);
  for (let k = 0; k < Math.min(pairs.length, 8); k++) if (!clear(pairs[k])) return -1;
  return pairs[Math.min(pairs.length - 1, 3)];
}

const cmpscan88 = {
  ...OPENING,
  purpose: "ICWS'88 comparison scan: a CMP compares pairs of cells GAP apart, SSTEP at a time from START, three cycles a pair; hands on the higher cell of the first pair that differs (skipping pairs on its own image), or the image boundary after SCANS pairs.",
  params: { SSTEP: [1, 55439], GAP: [1, 31], START: [128, 54000], SCANS: [8, 4000] }, entry: 'scan',
  mutable: [['probe', ['a', 'b']], ['clock', ['b']], ['cmp', ['a', 'b']]],
  mismatches: (P, settings) => (P.SSTEP % settings.coreSize === 0 ? ['the comparison scan stands still'] : []),
  state(ctx) {
    const { P } = ctx;
    ctx.ins('probe', 'DAT', 'F', '#0', `#${ctx.span - ctx.pc()}`);
    ctx.ins('clock', 'DAT', 'F', '#0', `#${P.SCANS}`);
    ctx.ins('stride', 'DAT', 'F', `#${P.SSTEP}`, `#${P.SSTEP}`);
  },
  emit(ctx) {
    const { L, P, span, core } = ctx;
    // The CMP's own fields are the pair (relative to it): ADD $stride steps both.
    ctx.ins('scan', 'ADD', 'F', L('stride'), L('cmp'));
    const at = ctx.pc();
    ctx.ins('cmp', 'CMP', 'I', `${P.START}`, `${P.START + P.GAP}`);
    ctx.ins('', 'JMP', 'B', L('hit'));
    ctx.ins('tick', 'DJN', 'B', L('scan'), L('clock'));
    // Out of pairs: the cell past the image, given as if the CMP had found it.
    ctx.ins('', 'MOV', 'AB', `#${span - at}`, L('cmp'));
    ctx.ins('', 'JMP', 'B', L('found'));
    // A pair differs. Hand it on only if both cells are off the image: the higher
    // cell (B, relative to the CMP) must lie in [span - at + GAP, core - at - 1].
    ctx.ins('hit', 'SLT', 'AB', `#${span - at + P.GAP - 1}`, L('cmp'));
    ctx.ins('', 'JMP', 'B', L('tick'));
    ctx.ins('', 'SLT', 'B', L('cmp'), `#${core - at}`);
    ctx.ins('', 'JMP', 'B', L('tick'));
    // The probe takes the CMP (its B made relative to the probe).
    ctx.ins('found', 'MOV', 'I', L('cmp'), L('probe'));
    ctx.ins('', 'ADD', 'AB', `#(${L('cmp')}-${L('probe')})`, L('probe'));
  },
  plant(api) { const a = cmpTarget(api); return a < 0 ? [] : [[a, MARKER]]; },
  watch(api) {
    const id = this.id, planted = api.scenario === `${id}: planted target`, target = cmpTarget(api);
    const exit = onExit(api, (c) => {
      if (planted && target >= 0) plantedCheck(api, id, c, mod(target + api.P.GAP, api.core), () => {});
      aloneCheck(api, id, c, c - api.P.GAP);
      if (api.scenario === 'alone' && atBoundary(api, c) && api.vm.peek(api.at('clock')).b !== 0) throw new Error(`${id} gave up before its SCANS pairs`);
    });
    return { before: exit.before, final: () => { if (planted && target >= 0 && !exit.exited()) throw new Error(`${id} never handed on`); } };
  },
};

// --- opening-quickscan-88 ---------------------------------------------------
// The table: N pairs (X, X + GAP), X = START + k SPACING from the probe.
const quickTable = (P, core) => Array.from({ length: P.N }, (_, k) => mod(P.START + k * P.SPACING, core));

const quickscan88 = {
  ...OPENING,
  purpose: "ICWS'88 unrolled quickscan: N CMPs compare fixed pairs of cells (GAP apart, SPACING apart from START) in about N cycles; hands on the higher cell of the last pair that differs, or the image boundary.",
  params: { START: [1, 54000], SPACING: [1, 27000], GAP: [1, 4000], N: [4, 12] }, entry: 'qScan',
  mutable: [['probe', ['a', 'b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, room = settings.maxLength;
    // Every probed cell must be off the image wherever the probe sits in it.
    return quickTable(P, core).some((x) => x < room || x + P.GAP > core - room) ? ['a quickscan probe lands on or next to the warrior itself'] : [];
  },
  state(ctx) { ctx.ins('probe', 'DAT', 'F', '#0', `#${ctx.span - ctx.pc()}`); },
  emit(ctx) {
    const { L, P, core } = ctx, probe = L('probe');
    // CMP skips the MOV when the pair is equal: one cycle per empty pair.
    quickTable(P, core).forEach((x, k) => {
      ctx.ins(k ? '' : 'qScan', 'CMP', 'I', `${probe}+${x}`, `${probe}+${x + P.GAP}`);
      ctx.ins('', 'MOV', 'AB', `#${x + P.GAP}`, probe);
    });
  },
  plant(api) { return [[api.at('probe') + quickTable(api.P, api.core)[Math.floor(api.P.N / 2)], MARKER]]; },
  watch(api) {
    const id = this.id, table = quickTable(api.P, api.core), probe = api.at('probe');
    const planted = api.scenario === `${id}: planted target`;
    const want = mod(probe + table[Math.floor(api.P.N / 2)] + api.P.GAP, api.core);
    const seesSelf = table.some((x) => api.inImage(probe + x) || api.inImage(probe + x + api.P.GAP));
    const exit = onExit(api, (c) => {
      if (planted) plantedCheck(api, id, c, want, () => {});
      if (!seesSelf) aloneCheck(api, id, c, c - api.P.GAP);
    });
    return { before: exit.before, final: () => { if (planted && !exit.exited()) throw new Error(`${id} never handed on`); } };
  },
};

// --- opening-sne-88 ---------------------------------------------------------
const sne88 = {
  ...OPENING,
  purpose: "ICWS'88 fast scan: two CMPs a loop, each stepping 2 STEP, compare pairs of cells GAP apart, STEP apart, for SCANS loops from START (2.5 cycles a pair); hands on the higher cell of the first pair that differs, or the image boundary.",
  params: { START: [1, 54000], STEP: [2, 4000], GAP: [1, 2000], SCANS: [1, 4000] }, entry: 'sScan',
  mutable: [['probe', ['a', 'b']], ['clock', ['b']], ['c1', ['a', 'b']], ['c2', ['a', 'b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, room = settings.maxLength, out = [];
    // No guard in the loop: the scanned cells must all lie off the image.
    if (P.START + P.STEP < room) out.push('the SNE scan starts inside the warrior');
    if (P.START + 2 * P.SCANS * P.STEP + P.GAP > core - room) out.push('the SNE scan runs on into the warrior itself');
    return out;
  },
  state(ctx) {
    const { P } = ctx;
    ctx.ins('probe', 'DAT', 'F', '#0', `#${ctx.span - ctx.pc()}`);
    ctx.ins('clock', 'DAT', 'F', '#0', `#${P.SCANS}`);
    ctx.ins('stride', 'DAT', 'F', `#${2 * P.STEP}`, `#${2 * P.STEP}`);
  },
  emit(ctx) {
    const { L, P, span } = ctx, probe = L('probe');
    // Pair j (1 .. 2 SCANS) is START + j STEP from its CMP: c1 takes the odd ones, c2 the even.
    ctx.ins('sScan', 'ADD', 'F', L('stride'), L('c1'));
    const at1 = ctx.pc();
    ctx.ins('c1', 'CMP', 'I', `${P.START - P.STEP}`, `${P.START - P.STEP + P.GAP}`);
    ctx.ins('', 'JMP', 'B', L('hit1'));
    ctx.ins('', 'ADD', 'F', L('stride'), L('c2'));
    ctx.ins('c2', 'CMP', 'I', `${P.START}`, `${P.START + P.GAP}`);
    ctx.ins('', 'JMP', 'B', L('hit2'));
    ctx.ins('', 'DJN', 'B', L('sScan'), L('clock'));
    // Out of loops: the cell past the image, given as if c1 had found it.
    ctx.ins('', 'MOV', 'AB', `#${span - at1}`, L('c1'));
    ctx.ins('hit1', 'MOV', 'I', L('c1'), probe);
    ctx.ins('', 'ADD', 'AB', `#(${L('c1')}-${probe})`, probe);
    ctx.ins('', 'JMP', 'B', ctx.next);
    ctx.ins('hit2', 'MOV', 'I', L('c2'), probe);
    ctx.ins('', 'ADD', 'AB', `#(${L('c2')}-${probe})`, probe);
  },
  plant(api) { return [[api.at('c1') + api.P.START + 3 * api.P.STEP, MARKER]]; },
  watch(api) {
    const id = this.id, planted = api.scenario === `${id}: planted target`;
    const want = mod(api.at('c1') + api.P.START + 3 * api.P.STEP + api.P.GAP, api.core);
    const clock = () => api.vm.peek(api.at('clock')).b;
    const exit = onExit(api, (c) => {
      if (planted) plantedCheck(api, id, c, want, () => { if (clock() === 0) throw new Error(`${id} ran out of scans despite a hit`); });
      if (api.scenario === 'alone' && !movedAway(api) && (clock() !== 0 || !atBoundary(api, c))) throw new Error(`${id} stopped early, or did not hand on the image boundary`);
    });
    return { before: exit.before, final: () => { if (planted && !exit.exited()) throw new Error(`${id} never handed on`); } };
  },
};

// --- finisher-guarded-88 ----------------------------------------------------
// Copies the probe into its own pointer (so it knows the pointer's place in the
// image), then clears downward with predecrement from the probe's cell, three
// cycles a cell. The cells off the image, as offsets from the pointer at index
// i, are [span - i, core - i - 1]; walking down it leaves them only at the
// bottom, where one SLT a cell catches it and jumps to the top.
const guarded88 = {
  kind: 'finisher', exit: 'never', processes: 1, writes: 'core', relocatable: false, protects: 'image',
  purpose: "ICWS'88 guarded clear: from the probe's cell downward, skipping the whole image, three cycles a cell; an optional SPL stun phase (PHASE 1: STUN cells; 2: the whole core), then DAT.",
  params: { PHASE: [0, 2], STUN: [1, 4096] }, entry: 'payload',
  needs: ['probe'],
  provides: (P) => (P.PHASE ? { datBomb: 'killBomb', splBomb: 'stunBomb' } : { datBomb: 'killBomb' }),
  mutable: [['remaining', ['b']], ['ptr', ['a', 'b']]],
  writers: { stun: 'stunWrite', kill: 'killWrite' },
  state(ctx) { ctx.ins('remaining', 'DAT', 'F', '#0', `#${ctx.P.STUN}`); },
  emit(ctx) {
    const { L, P, span, core } = ctx, probe = ctx.ref('probe'), ptr = L('ptr');
    const i = ctx.pc() + 8 + (P.PHASE ? 5 : 0);           // the pointer's index
    const low = span - i, top = core - i;                 // B must stay in [low + 1, top]
    ctx.ins('payload', 'MOV', 'I', probe, ptr);
    ctx.ins('', 'ADD', 'AB', `#(${probe}-${ptr}+1)`, ptr); // now from the pointer; +1: the first write lands on the probe's cell
    ctx.ins('', 'SLT', 'B', ptr, `#${top + 1}`);           // above the top (inside the image)?
    ctx.ins('', 'MOV', 'AB', `#${top}`, ptr);
    if (P.PHASE) {
      ctx.ins('', 'MOV', 'AB', `#${P.PHASE === 2 ? core - span : P.STUN}`, L('remaining'));
      ctx.ins('stunGuard', 'SLT', 'AB', `#${low}`, ptr);
      ctx.ins('', 'MOV', 'AB', `#${top}`, ptr);
      ctx.ins('stunWrite', 'MOV', 'I', L('stunBomb'), `<${ptr}`);
      ctx.ins('', 'DJN', 'B', L('stunGuard'), L('remaining'));
    }
    ctx.ins('killGuard', 'SLT', 'AB', `#${low}`, ptr);
    ctx.ins('', 'MOV', 'AB', `#${top}`, ptr);
    ctx.ins('killWrite', 'MOV', 'I', L('killBomb'), `<${ptr}`);
    ctx.ins('', 'JMP', 'B', L('killGuard'));
    if (ctx.pc() !== i) throw new Error('finisher-guarded-88 layout');
    ctx.ins('ptr', 'DAT', 'F', '#0', '#0');
    if (P.PHASE) ctx.ins('stunBomb', 'SPL', 'B', '0', '0');
    ctx.ins('killBomb', 'DAT', 'F', '#0', '#0');
  },
  watch(api) {
    const id = this.id, core = api.core, ptr = api.at('ptr');
    const kill = api.at('killWrite'), stun = api.P.PHASE ? api.at('stunWrite') : -1;
    // A booted copy guards only its own image, and leaves the boot behind to be cleared.
    const moved = movedAway(api);
    // The probe, as the first instruction (MOV probe, ptr) names it.
    const probe = mod(api.at('payload') + api.code('payload').a, core);
    const guarded = moved ? (c) => api.inSelf(c) : (c) => api.inImage(c);
    let entered = null, handed = null, first = null, stuns = 0;
    return {
      before(pc) {
        if (entered === null && pc === api.entry()) { entered = api.vm.cycle; handed = mod(probe + api.vm.peek(probe).b, core); }
        if (pc !== kill && pc !== stun) return null;
        return { t: mod(ptr + api.vm.peek(ptr).b - 1, core), stun: pc === stun };
      },
      after(w) {
        if (!w) return;
        if (guarded(w.t)) throw new Error(`${id} wrote inside the image`);
        if (!api.same(api.vm.peek(w.t), api.code(w.stun ? 'stunBomb' : 'killBomb'))) throw new Error(`${id} dropped something other than its bomb`);
        if (w.stun) stuns++;
        if (first === null) {
          first = w.t;
          if (handed !== null && !guarded(handed) && first !== handed) throw new Error(`${id} did not start on the probe's cell`);
        }
      },
      final() {
        // Alone after its opening (every process in its code): it must have covered the core.
        if (api.scenario !== 'alone' || moved || entered === null || !api.vm.processes(0).every((q) => api.inSelf(q))) return;
        if (api.P.PHASE === 1 && stuns !== api.P.STUN) throw new Error(`${id} stunned ${stuns} cells, not STUN`);
        for (let c = 0; c < core; c++) if (!guarded(c) && api.vm.writeCycle[c] < entered) throw new Error(`${id} left cells untouched`);
      },
    };
  },
};

const blocks = {
  'opening-cmpscan-88': cmpscan88,
  'opening-quickscan-88': quickscan88,
  'opening-sne-88': sne88,
  'finisher-guarded-88': guarded88,
};
for (const [id, b] of Object.entries(blocks)) b.id = id;
// Defaults that work on every rule set ('88, 94nop, lp, 94x).
blocks['opening-cmpscan-88'].defaults = { SSTEP: 997, GAP: 7, START: 512, SCANS: 128 };
blocks['opening-quickscan-88'].defaults = { START: 300, SPACING: 650, GAP: 8, N: 12 };
blocks['opening-sne-88'].defaults = { START: 100, STEP: 16, GAP: 8, SCANS: 240 };
blocks['finisher-guarded-88'].defaults = { PHASE: 1, STUN: 64 };

export default Object.values(blocks);
