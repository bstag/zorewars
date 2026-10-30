// Pair scanners: compare two cells GAP apart, STEP at a time, and react to a
// pair that differs by stunning a fixed run of cells around it, then scan on.
// How to write a block: docs/block-algebra.md.
//
// - pair-wipe-scanner ('94): two pairs a loop (SNE, then SNE again through
//   the compare's own fields); a find wipes WIPE cells with SPL from BACK
//   before the pair's first cell, and when the run would reach its own image
//   (the scan has come round to its own code) it turns into a d-clear of
//   everything outside the image. STREAM adds a DJN stream to the scan loop.
// - pair-wipe-scanner-88: the same in strict ICWS'88, one pair a loop.
// - cmp-carpet-scanner: works out which cell of a differing pair is occupied,
//   ignores its own carpet, and lays CARPET SPL 0 cells from BACK before that
//   cell; it scans on forever, so a trigger hands it over to a clear.
//
// The safety test is one SLT: with R = [g, g + LEN) the run about to be laid
// (g its first cell's index in the image), R misses the image [0, span) iff
// (g + LEN - 1) mod core >= span + LEN - 1. The pointer cell takes that value
// with one ADD, is tested, and then becomes the run's pointer with another.

const MARKER = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };
const EMPTY = { op: 'DAT', mod: 'F', aMode: '$', a: 0, bMode: '$', b: 0 };
const DGAP = 6;          // the d-clear's SPL stream runs this far ahead of its DAT stream
const mod = (x, core) => ((x % core) + core) % core;
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
// The global index of a local label, as an expression usable on the current line.
const idxOf = (ctx, label) => `(${ctx.L(label)}+${ctx.pc()})`;
const live = (api, t) => api.vm.processes(0).some((q) => mod(t - q + api.settings.maxLength, api.core) < 2 * api.settings.maxLength);
const ownCell = (api, t) => api.inSelf(t) || (api.inImage(t) && live(api, t));

// The d-clear: an SPL stream DGAP cells ahead of a DAT stream, both walking
// down from the cell below the image to its end, then again. wp (the wipe's
// pointer) carries the SPL stream.
function dclear(ctx, spl) {
  const { L, span } = ctx, n = `(CORESIZE-${span})`;
  ctx.ins('cGo', 'MOV', 'AB', `#(CORESIZE-${idxOf(ctx, 'wp')}-${DGAP})`, L('wp'));
  ctx.ins('', 'MOV', 'AB', `#(CORESIZE-${idxOf(ctx, 'dp')})`, L('dp'));
  ctx.ins('', 'MOV', 'AB', `#(${n}-${DGAP})`, L('cnt'));
  ctx.ins('cBoth', 'MOV', 'I', L(spl), `<${L('wp')}`);
  ctx.ins('cKill', 'MOV', 'I', L('dbomb'), `<${L('dp')}`);
  ctx.ins('', 'DJN', 'B', L('cBoth'), L('cnt'));
  ctx.ins('', 'MOV', 'AB', `#${DGAP}`, L('cnt'));
  ctx.ins('cTail', 'MOV', 'I', L('dbomb'), `<${L('dp')}`);
  ctx.ins('', 'DJN', 'B', L('cTail'), L('cnt'));
  ctx.ins('', 'JMP', 'B', L('cGo'));
}
function tailCells(ctx) {
  const { P } = ctx;
  ctx.ins('wp', 'DAT', 'F', '#0', '#0');
  ctx.ins('cnt', 'DAT', 'F', '#0', '#0');
  if (P.CLEAR) {
    ctx.ins('dp', 'DAT', 'F', '#0', '#0');
    ctx.ins('dbomb', 'DAT', 'F', '#0', '#0');
  }
  // The stream's first decrement is the cell just below the image.
  if (P.STREAM) ctx.ins('sptr', 'DAT', 'F', '#0', `#(0-${idxOf(ctx, 'sptr')})`);
}
// The compare's first pair, one STEP before the first one looked at: the
// first run then starts right after the image.
const firstPair = (ctx, extra = 0) => `(${ctx.span}+${ctx.P.BACK}+${extra}-${idxOf(ctx, 'cmp')}-${ctx.P.STEP})`;

// ---------------------------------------------------------------------------
// pair-wipe-scanner ('94)
function emitPairWipe(ctx) {
  const { L, P, span } = ctx, cmp = L('cmp'), wp = L('wp'), cnt = L('cnt');
  const own = P.CLEAR ? 'cGo' : 'sLoop';
  ctx.ins('sLoop', 'ADD', 'F', L('step'), cmp);
  ctx.ins('cmp', 'SNE', 'I', `$${firstPair(ctx)}`, `$${firstPair(ctx, P.GAP)}`);
  ctx.ins('', 'ADD', 'F', L('step'), cmp);
  ctx.ins('cmp2', 'SNE', 'I', `*${cmp}`, `@${cmp}`);
  // A difference at the first SNE skips the step, so the second sees the same pair.
  if (P.STREAM) ctx.ins('sTick', 'DJN', 'F', L('sLoop'), `<${L('sptr')}`);
  else ctx.ins('sTick', 'JMP', 'B', L('sLoop'));
  ctx.ins('hit', 'MOV', 'AB', cmp, wp);
  ctx.ins('', 'ADD', 'AB', `#(${idxOf(ctx, 'cmp')}-${P.BACK}+${P.WIPE}-1)`, wp);
  ctx.ins('', 'SLT', 'AB', `#(${span}+${P.WIPE}-2)`, wp);
  ctx.ins('', 'JMP', 'B', L(own));
  ctx.ins('', 'ADD', 'AB', `#(1-${P.WIPE}-${idxOf(ctx, 'wp')})`, wp);
  ctx.ins('', 'MOV', 'AB', `#${P.WIPE}`, cnt);
  ctx.ins('wipe', 'MOV', 'I', L('step'), `>${wp}`);
  ctx.ins('', 'DJN', 'B', L('wipe'), cnt);
  ctx.ins('', 'JMP', 'B', L('sLoop'));
  if (P.CLEAR) dclear(ctx, 'step');
  // The step is also the stun bomb.
  ctx.ins('step', 'SPL', 'B', `#${P.STEP}`, `#${P.STEP}`);
  tailCells(ctx);
}

// ---------------------------------------------------------------------------
// pair-wipe-scanner-88: CMP compares the pair named by its own fields (an ADD
// of the step cell moves both); MOV copies the CMP into wp, whose B (the
// pair's second cell) becomes the run's pointer, walking down with <wp.
function emitPairWipe88(ctx) {
  const { L, P, span } = ctx, cmp = L('cmp'), wp = L('wp'), cnt = L('cnt');
  const own = P.CLEAR ? 'cGo' : 'sLoop';
  ctx.ins('sLoop', 'ADD', 'F', L('step'), cmp);
  ctx.ins('cmp', 'CMP', 'I', `$${firstPair(ctx)}`, `$${firstPair(ctx, P.GAP)}`);
  ctx.ins('', 'JMP', 'B', L('hit'));
  if (P.STREAM) ctx.ins('sTick', 'DJN', 'B', L('sLoop'), `<${L('sptr')}`);
  else ctx.ins('sTick', 'JMP', 'B', L('sLoop'));
  ctx.ins('hit', 'MOV', 'I', cmp, wp);
  ctx.ins('', 'ADD', 'AB', `#(${idxOf(ctx, 'cmp')}-${P.GAP}-${P.BACK}+${P.WIPE}-1)`, wp);
  ctx.ins('', 'SLT', 'AB', `#(${span}+${P.WIPE}-2)`, wp);
  ctx.ins('', 'JMP', 'B', L(own));
  ctx.ins('', 'ADD', 'AB', `#(1-${idxOf(ctx, 'wp')})`, wp);
  ctx.ins('', 'MOV', 'AB', `#${P.WIPE}`, cnt);
  ctx.ins('wipe', 'MOV', 'I', L('step'), `<${wp}`);
  ctx.ins('', 'DJN', 'B', L('wipe'), cnt);
  ctx.ins('', 'JMP', 'B', L('sLoop'));
  if (P.CLEAR) dclear(ctx, 'step');
  ctx.ins('step', 'SPL', 'B', `$${P.STEP}`, `$${P.STEP}`);
  tailCells(ctx);
}

// ---------------------------------------------------------------------------
// cmp-carpet-scanner: '88 code, legal '94 too. A differing pair is decoded:
// the occupied cell is the second if it isn't empty, else the first. A cell
// that is its own carpet bomb is passed over, so it never re-carpets itself.
function emitCarpet(ctx) {
  const { L, P, old, core, span } = ctx, cmp = L('cmp'), wp = L('wp'), cnt = L('cnt');
  // '88 can't write DAT $0, $0: copy an empty cell from far away first.
  if (old) ctx.ins('sInit', 'MOV', 'I', `${L('empty')}+${Math.floor(core / 2)}`, L('empty'));
  else ctx.mark('sInit');
  ctx.ins('sLoop', 'ADD', 'F', L('step'), cmp);
  ctx.ins('cmp', 'CMP', 'I', `$${firstPair(ctx)}`, `$${firstPair(ctx, P.GAP)}`);
  ctx.ins('', 'JMP', 'B', L('hit'));
  ctx.ins('', 'JMP', 'B', L('sLoop'));
  ctx.ins('hit', 'MOV', 'I', cmp, wp);
  ctx.ins('', 'ADD', 'AB', `#(${cmp}-${wp})`, wp);          // wp -> the pair's second cell
  ctx.ins('', 'CMP', 'I', `@${wp}`, L('empty'));
  ctx.ins('', 'JMP', 'B', L('occ'));
  ctx.ins('', 'SUB', 'AB', `#${P.GAP}`, wp);                // empty: the first cell is the one
  ctx.ins('occ', 'CMP', 'I', `@${wp}`, L('bomb'));
  ctx.ins('', 'JMP', 'B', L('chk'));
  ctx.ins('', 'JMP', 'B', L('sLoop'));                       // our own carpet
  ctx.ins('chk', 'ADD', 'AB', `#(${idxOf(ctx, 'wp')}-${P.BACK}+${P.CARPET}-1)`, wp);
  ctx.ins('', 'SLT', 'AB', `#(${span}+${P.CARPET}-2)`, wp);
  ctx.ins('', 'JMP', 'B', L('sLoop'));                       // the carpet would reach the image
  ctx.ins('', 'ADD', 'AB', `#(1-${idxOf(ctx, 'wp')})`, wp);
  ctx.ins('', 'MOV', 'AB', `#${P.CARPET}`, cnt);
  ctx.ins('lay', 'MOV', 'I', L('bomb'), `<${wp}`);
  ctx.ins('', 'DJN', 'B', L('lay'), cnt);
  ctx.ins('', 'JMP', 'B', L('sLoop'));
  ctx.ins('step', 'DAT', 'F', `#${P.STEP}`, `#${P.STEP}`);
  ctx.ins('wp', 'DAT', 'F', '#0', '#0');
  ctx.ins('cnt', 'DAT', 'F', '#0', '#0');
  ctx.ins('bomb', 'SPL', 'B', '$0', '$0');
  if (old) ctx.ins('empty', 'DAT', 'F', '#0', '#0');
  else ctx.ins('empty', 'DAT', 'F', '$0', '$0');
}

// ---------------------------------------------------------------------------
// Planting: two targets on pairs the scan looks at early, each with room for
// its run clear of the image and of the other run, on cells no earlier pair
// looks at. The first is a pair's first cell, the second a pair's second cell.
// `rangeOf(x, t)` is the run [lo, lo + len) a find at pair x, target t, lays.
function pickTargets(api, rangeOf) {
  const { core, P } = api, x0 = api.at('cmp') + api.code('cmp').a;
  const seen = new Set(), out = [];
  const clearOf = (lo, len, m) => { for (let j = -m; j < len + m; j++) if (api.inImage(lo + j)) return false; return true; };
  const far = (lo, len, o) => { const d = mod(lo - o.lo, core), m = 2 * P.GAP + P.BACK + 16; return d > o.len + m && d < core - len - m; };
  for (let k = 1; k < 3000 && out.length < 2; k++) {
    const x = mod(x0 + k * P.STEP, core), y = mod(x + P.GAP, core);
    if (api.inImage(x) || api.inImage(y)) break;              // it would see its own code first
    const t = out.length ? y : x, [lo, len] = rangeOf(x, t);
    if (k >= 3 && !seen.has(t) && clearOf(lo, len, 8) && (!out.length || (k >= out[0].k + 3 && far(lo, len, out[0])))) out.push({ k, t, lo: mod(lo, core), len });
    seen.add(x); seen.add(y);
  }
  return out.length === 2 ? out : [];
}

// Watch a pair-wipe scanner ('94 or '88): every run it lays misses its warrior
// and is its bomb; the planted pairs get exactly their runs, the second after
// the first (so it scanned on); the clear starts only once a run would reach
// its own image; alone it reacts to nothing but its own stream, reaches its
// clear, and the clear kills every cell outside the image.
function watchPairWipe(api, { id, looks: lookLabels, post }) {
  const { vm, core, P } = api;
  const planted = api.scenario === `${id}: planted target`;
  const targets = planted ? pickTargets(api, (x) => [x - P.BACK, P.WIPE]) : [];
  const cmpAt = api.at('cmp'), wpAt = api.at('wp');
  const lookAt = new Set(lookLabels.map((l) => api.at(l)));
  const writers = new Map([[api.at('wipe'), { kind: 'wipe', ptr: wpAt, pre: !post }]]);
  if (P.CLEAR) {
    writers.set(api.at('cBoth'), { kind: 'spl', ptr: wpAt, pre: true });
    for (const l of ['cKill', 'cTail']) writers.set(api.at(l), { kind: 'dat', ptr: api.at('dp'), pre: true });
  }
  if (P.STREAM) writers.set(api.at('sTick'), { kind: 'stream', ptr: api.at('sptr'), pre: true });
  const mine = (c) => vm.writerPc[c] >= 0 && api.inSelf(vm.writerPc[c]);
  const killed = new Int32Array(P.CLEAR ? core : 0).fill(-1);
  const runs = [];
  let looks = 0, cur = null, lastHit = null, clearAt = null, sole = false;
  return {
    before(pc) {
      if (lookAt.has(pc)) looks++;
      if (pc === api.at('hit')) {
        const x = mod(cmpAt + vm.peek(cmpAt).a, core), y = mod(cmpAt + vm.peek(cmpAt).b, core);
        const seesSelf = api.inImage(x) || api.inImage(y);
        if (api.alone && !seesSelf && !mine(x) && !mine(y)) throw new Error(`${id} reacted to an empty core`);
        lastHit = { x }; cur = { x, cells: [] }; runs.push(cur);
      }
      if (P.CLEAR && clearAt === null && pc === api.at('cGo')) {
        clearAt = vm.cycle;
        sole = api.scenario === 'alone' && vm.processes(0).length === 1;
        let near = false;
        for (let j = 0; lastHit && j < P.WIPE && !near; j++) near = api.inImage(lastHit.x - P.BACK + j);
        if (!near) throw new Error(`${id} switched to its clear before its scan reached its own code`);
      }
      const w = writers.get(pc);
      return w ? { pc, w, t: mod(w.ptr + vm.peek(w.ptr).b - (w.pre ? 1 : 0), core) } : null;
    },
    after(tok) {
      if (!tok) return;
      const { t, w } = tok;
      if (w.kind === 'stream') {
        if (clearAt === null && api.inImage(t)) throw new Error(`${id}'s stream decremented its own warrior`);
        return;
      }
      if (w.kind === 'wipe' ? ownCell(api, t) : api.inImage(t)) throw new Error(`${id} bombed its own warrior`);
      const want = w.kind === 'dat' ? api.code('dbomb') : api.code('step');
      if (!api.same(vm.peek(t), want) || vm.writerPc[t] !== tok.pc) throw new Error(`${id} dropped something other than its bomb`);
      if (w.kind === 'wipe') cur?.cells.push(t);
      else if (w.kind === 'dat') killed[t] = vm.cycle;
    },
    final() {
      if (planted) {
        if (!targets.length) throw new Error(`${id}: no room to plant a target`);
        const [a, b] = targets, first = runs.find((r) => r.cells.length);
        const runOf = (o) => Array.from({ length: o.len }, (_, j) => mod(o.lo + j, core));
        if (!first || first.x !== a.t) throw new Error(`${id} did not react to the planted pair first`);
        const want = runOf(a), got = new Set(first.cells);
        if (first.cells.length !== want.length || want.some((c) => !got.has(c))) throw new Error(`${id} did not wipe the planted run`);
        const all = new Set(runs.flatMap((r) => r.cells));
        if (runOf(b).some((c) => !all.has(c))) throw new Error(`${id} did not scan on and wipe the second planted pair`);
      }
      if (!api.alone) return;
      if (P.CLEAR) {
        if (clearAt === null) throw new Error(`${id} never switched to its clear`);
        if (sole && vm.cycle - clearAt >= 3 * core + 200) {
          for (let c = 0; c < core; c++) if (!api.inImage(c) && killed[c] < clearAt) throw new Error(`${id}'s clear left cells untouched`);
        }
      } else if (looks < 1000) throw new Error(`${id} looked at too few pairs`);
    },
  };
}

// Watch the carpet scanner: carpets miss the warrior and are SPL 0; each
// planted target gets exactly its carpet, decoded to the occupied cell; alone
// it scans on and lays nothing.
function watchCarpet(api) {
  const { vm, core, P } = api, id = 'cmp-carpet-scanner';
  const planted = api.scenario === `${id}: planted target`;
  const targets = planted ? pickTargets(api, (x, t) => [t - P.BACK, P.CARPET]) : [];
  const cmpAt = api.at('cmp'), wpAt = api.at('wp');
  const runs = [];
  let looks = 0, cur = null;
  return {
    before(pc) {
      if (pc === cmpAt) looks++;
      if (pc === api.at('hit')) {
        const x = mod(cmpAt + vm.peek(cmpAt).a, core), y = mod(cmpAt + vm.peek(cmpAt).b, core);
        cur = { o: api.same(vm.peek(y), EMPTY) ? x : y, cells: [] }; runs.push(cur);
      }
      return pc === api.at('lay') ? { pc, t: mod(wpAt + vm.peek(wpAt).b - 1, core) } : null;
    },
    after(tok) {
      if (!tok) return;
      if (ownCell(api, tok.t)) throw new Error(`${id} carpeted its own warrior`);
      if (!api.same(vm.peek(tok.t), api.code('bomb')) || vm.writerPc[tok.t] !== tok.pc) throw new Error(`${id} dropped something other than SPL 0`);
      cur?.cells.push(tok.t);
    },
    final() {
      if (planted) {
        if (!targets.length) throw new Error(`${id}: no room to plant a target`);
        for (const tg of targets) {
          const want = Array.from({ length: tg.len }, (_, j) => mod(tg.lo + j, core));
          const run = runs.find((r) => r.cells.length && r.cells.some((c) => want.includes(c)));
          const got = new Set(run?.cells ?? []);
          if (!run || got.size !== want.length || want.some((c) => !got.has(c))) throw new Error(`${id} did not carpet the planted target`);
        }
      }
      if (!api.alone) return;
      if (looks < 1000) throw new Error(`${id} looked at too few pairs`);
      if (runs.some((r) => r.cells.length)) throw new Error(`${id} carpeted an empty core`);
    },
  };
}

// ---------------------------------------------------------------------------
const BODY = { kind: 'body', exit: 'never', processes: 1, roams: false };
function pairMismatches(P, settings) {
  const core = settings.coreSize, out = [];
  if (P.STEP % core === 0) out.push('the pair scan stands still');
  if (P.WIPE <= P.BACK + P.GAP) out.push('WIPE must be more than BACK + GAP, so a run covers both cells of its pair');
  if (P.STREAM && !P.CLEAR) out.push('STREAM needs CLEAR 1: the stream would come round to the warrior');
  if (P.CLEAR && gcd(P.STEP, core) > P.GAP) out.push('the pair scan never comes round to its own code, so it never clears');
  return out;
}
const pairParams = { STEP: [1, 27719], GAP: [1, 100], BACK: [0, 100], WIPE: [2, 200], STREAM: [0, 1], CLEAR: [0, 1] };
const pairMutable = (P) => [['cmp', ['a', 'b']], ['wp', ['a', 'b']], ['cnt', ['b']], ...(P.CLEAR ? [['dp', ['b']]] : []), ...(P.STREAM ? [['sptr', ['b']]] : [])];

const blocks = {
  'pair-wipe-scanner': {
    ...BODY, writes: (P) => (P.CLEAR ? 'core' : 'sparse'), dialects: '94',
    purpose: 'Agony-style pair scanner: compares cells GAP apart, STEP at a time, two pairs a loop; a pair that differs gets WIPE SPL bombs from BACK before it, then it scans on; when a wipe would reach its own image it turns into a d-clear of everything outside the image (CLEAR 1). STREAM 1 adds a DJN stream to the scan loop.',
    params: pairParams,
    entry: 'sLoop', loop: 'sLoop',
    provides: (P) => (P.CLEAR ? { splBomb: 'step', datBomb: 'dbomb' } : { splBomb: 'step' }),
    mutable: pairMutable,
    mismatches: pairMismatches,
    emit: emitPairWipe,
    plant(api) { return pickTargets(api, (x) => [x - api.P.BACK, api.P.WIPE]).map((t) => [t.t, MARKER]); },
    watch: (api) => watchPairWipe(api, { id: 'pair-wipe-scanner', looks: ['cmp', 'cmp2'], post: true }),
  },
  'pair-wipe-scanner-88': {
    ...BODY, writes: (P) => (P.CLEAR ? 'core' : 'sparse'),
    purpose: "ICWS'88 pair scanner: a CMP compares cells GAP apart, STEP at a time; a pair that differs gets WIPE SPL bombs from BACK before it, then it scans on; when a wipe would reach its own image it turns into a d-clear of everything outside the image (CLEAR 1). STREAM 1 adds a DJN stream to the scan loop.",
    params: pairParams,
    entry: 'sLoop', loop: 'sLoop',
    provides: (P) => (P.CLEAR ? { splBomb: 'step', datBomb: 'dbomb' } : { splBomb: 'step' }),
    mutable: pairMutable,
    mismatches: pairMismatches,
    emit: emitPairWipe88,
    plant(api) { return pickTargets(api, (x) => [x - api.P.BACK, api.P.WIPE]).map((t) => [t.t, MARKER]); },
    watch: (api) => watchPairWipe(api, { id: 'pair-wipe-scanner-88', looks: ['cmp'], post: false }),
  },
  'cmp-carpet-scanner': {
    ...BODY, writes: 'sparse',
    purpose: 'Compare scanner: compares cells GAP apart, STEP at a time; on a pair that differs it decodes which cell is occupied, passes over its own carpet, and lays CARPET SPL 0 cells from BACK before that cell, then scans on. It runs forever: a trigger hands it over to a clear.',
    params: { STEP: [1, 27719], GAP: [1, 100], BACK: [0, 100], CARPET: [1, 200] },
    entry: 'sInit', loop: 'sLoop',
    provides: { splBomb: 'bomb' },
    mutable: [['cmp', ['a', 'b']], ['wp', ['a', 'b']], ['cnt', ['b']]],
    mismatches(P, settings) {
      const out = [];
      if (P.STEP % settings.coreSize === 0) out.push('the pair scan stands still');
      if (P.BACK >= P.CARPET) out.push('BACK must be less than CARPET, so a carpet covers the cell it found');
      return out;
    },
    emit: emitCarpet,
    plant(api) { return pickTargets(api, (x, t) => [t - api.P.BACK, api.P.CARPET]).map((t) => [t.t, MARKER]); },
    watch: watchCarpet,
  },
};
for (const [id, b] of Object.entries(blocks)) b.id = id;
// Defaults that work on every rule set they support (8,000 and 55,440 cores).
// 5287 is prime to 8,000 and 55,440, and its pairs come round to the image
// only after about two to four times core/40 looks on either core: a lap.
blocks['pair-wipe-scanner'].defaults = { STEP: 5287, GAP: 8, BACK: 4, WIPE: 16, STREAM: 0, CLEAR: 1 };
blocks['pair-wipe-scanner-88'].defaults = { STEP: 5287, GAP: 8, BACK: 4, WIPE: 16, STREAM: 0, CLEAR: 1 };
blocks['cmp-carpet-scanner'].defaults = { STEP: 5287, GAP: 8, BACK: 4, CARPET: 16 };

export default Object.values(blocks);
