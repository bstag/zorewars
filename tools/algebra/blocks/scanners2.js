// Scanners, second wave: a Blur-style carpet scanner, a mirrored scanner, a
// quickscan that decodes the exact cell it found, and a clear that spreads
// outward from that cell. How to write a block: docs/block-algebra.md.
//
// Offsets from a pointer cell at global index idx: the image is the cells
// [0, span), so the offsets that miss it are [span - idx, core - idx). Every
// block here writes that range with the pointer's index taken from its label
// (`L(label)+pc` is the label's index), so nothing is counted by hand.

// What a planted opponent looks like: a cell no empty core holds.
const MARKER = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };
const mod = (x, core) => ((x % core) + core) % core;
// The global index of a local label, as an expression usable on the current line.
const idxOf = (ctx, label) => `(${ctx.L(label)}+${ctx.pc()})`;
// A cell is "live" when one of the warrior's processes runs near it (a booted
// warrior's original image is fair game once nothing runs there).
const live = (api, t) => api.vm.processes(0).some((q) => mod(t - q + api.settings.maxLength, api.core) < 2 * api.settings.maxLength);
const ownCell = (api, t) => api.inSelf(t) || (api.inImage(t) && live(api, t));

// ---------------------------------------------------------------------------
// blur-scanner
//
// The scan pointer is ptr's B-field, the carpet pointer its A-field. A hit
// whose carpet of LEN cells stays clear of the image moves the carpet there
// (MOV.BA) and arms a counter; while it is armed, every lap of the scan also
// drops one SPL #0, #0 at }ptr. Those bombs have zero fields, so the scan
// (JMZ.F) doesn't see its own carpet. With CLEAR 1, after SCANS laps it
// becomes a DAT clear of everything outside the image, through the same A-field.
function emitBlur(ctx) {
  const { L, P, span } = ctx, ptr = L('ptr'), cnt = L('cnt');
  const tick = P.CLEAR ? 'sTick' : 'sLoop';
  ctx.ins('sLoop', 'ADD', 'AB', `#${P.STEP}`, ptr);
  ctx.ins('sLook', 'JMZ', 'F', L('sCarp'), `@${ptr}`);
  ctx.ins('sHit', 'SLT', 'AB', `#(${span}-${idxOf(ctx, 'ptr')}-1)`, ptr);   // below the image's end: ours
  ctx.ins('', 'JMP', 'B', L('sCarp'));
  ctx.ins('', 'SLT', 'AB', `#(CORESIZE-${idxOf(ctx, 'ptr')}-${P.LEN})`, ptr); // the carpet would reach the image
  ctx.ins('', 'JMP', 'B', L('sSet'));
  ctx.ins('', 'JMP', 'B', L('sCarp'));
  ctx.ins('sSet', 'MOV', 'BA', ptr, ptr);
  ctx.ins('', 'MOV', 'AB', `#${P.LEN}`, cnt);
  ctx.ins('sCarp', 'JMZ', 'B', L(tick), cnt);
  ctx.ins('sBomb', 'MOV', 'I', L('bomb'), `}${ptr}`);
  ctx.ins('', 'DJN', 'B', L(tick), cnt);            // either way on to the tick
  if (P.CLEAR) {
    ctx.ins('sTick', 'DJN', 'B', L('sLoop'), L('clock'));
    ctx.ins('cGo', 'MOV', 'A', `#(${span}-${idxOf(ctx, 'ptr')})`, ptr);
    ctx.ins('', 'MOV', 'AB', `#(CORESIZE-${span})`, cnt);
    ctx.ins('cLoop', 'MOV', 'I', L('dbomb'), `}${ptr}`);
    ctx.ins('', 'DJN', 'B', L('cLoop'), cnt);
    ctx.ins('', 'JMP', 'B', L('cGo'));
  } else ctx.ins('sTick', 'JMP', 'B', L('sLoop'));
  // The first cell looked at is the first one past the image.
  ctx.ins('ptr', 'DAT', 'F', '#0', `#(${span}-${idxOf(ctx, 'ptr')}-${P.STEP})`);
  ctx.ins('cnt', 'DAT', 'F', '#0', '#0');
  if (P.CLEAR) ctx.ins('clock', 'DAT', 'F', '#0', `#${P.SCANS}`);
  ctx.ins('bomb', 'SPL', 'B', '#0', '#0');
  if (P.CLEAR) ctx.ins('dbomb', 'DAT', 'F', '#0', '#0');
}

// The planted target: the 3rd cell the scan looks at that is outside the image
// with room around it for the carpet.
function blurTarget(api) {
  const ptr = api.at('ptr'), d0 = api.code('ptr').b, room = api.P.LEN + 8;
  let found = 0;
  for (let k = 1; k < 1000; k++) {
    const c = mod(ptr + d0 + k * api.P.STEP, api.core);
    let clear = true;
    for (let j = -8; j <= room && clear; j++) if (api.inImage(c + j)) clear = false;
    if (clear && ++found === 3) return c;
  }
  return -1;
}

function watchBlur(api) {
  const { vm, core, P } = api, ptr = api.at('ptr');
  const planted = api.scenario === 'blur-scanner: planted target';
  const target = planted ? blurTarget(api) : -1;
  const carpet = new Set(), killed = new Int32Array(core).fill(-1);
  let looks = 0, spl = 0, clearAt = null, sole = false;
  const writer = { [api.at('sBomb')]: 'bomb', ...(P.CLEAR ? { [api.at('cLoop')]: 'dbomb' } : {}) };
  return {
    before(pc) {
      if (pc === api.at('sLook')) looks++;
      if (P.CLEAR && clearAt === null && pc === api.at('cGo')) {
        clearAt = vm.cycle;
        sole = api.scenario === 'alone' && vm.processes(0).length === 1;
      }
      const bomb = writer[pc];
      return bomb ? { bomb, pc, t: mod(ptr + vm.peek(ptr).a, core) } : null;
    },
    after(tok) {
      if (!tok) return;
      const { t, bomb } = tok;
      if (ownCell(api, t)) throw new Error('blur-scanner bombed its own warrior');
      if (!api.same(vm.peek(t), api.code(bomb)) || vm.writerPc[t] !== tok.pc) throw new Error('blur-scanner dropped something other than its bomb');
      if (bomb === 'bomb') { carpet.add(t); spl++; } else killed[t] = vm.cycle;
    },
    final() {
      if (planted) {
        if (!carpet.has(target)) throw new Error('blur-scanner ignored the planted target');
        for (let k = 1; k < P.LEN; k++) if (!carpet.has(mod(target + k, core))) throw new Error('blur-scanner did not carpet forward from the planted target');
      }
      if (!api.alone) return;
      if (looks < Math.min(1000, P.CLEAR ? P.SCANS : 1000)) throw new Error('blur-scanner looked at too few cells');
      if (spl) throw new Error('blur-scanner carpeted an empty core');
      if (P.CLEAR && clearAt === null && vm.cycle > 8 * P.SCANS + 100) throw new Error('blur-scanner never switched to its clear');
      if (sole && vm.cycle - clearAt >= 2 * core + 10) {
        for (let c = 0; c < core; c++) if (!api.inImage(c) && killed[c] < clearAt) throw new Error("blur-scanner's clear left cells untouched");
      }
    },
  };
}

// ---------------------------------------------------------------------------
// mirror-scanner
//
// Two pointers, pa and pb, start just before and just after the image and
// move apart STEP at a time, so each lap compares the cell x past the end
// with the cell x before the start. A pair that differs is resolved side by
// side: each side that isn't empty and is outside the image is bombed. The
// bomb is an empty cell (DAT $0, $0), so a bombed cell never makes a pair
// differ again. '88 has no JMZ.F and can't write DAT $0, $0, so it copies an
// empty cell from far away first and compares with it.
function ifEmpty(ctx, label, ptr) {
  if (!ctx.old) return ctx.ins('', 'JMZ', 'F', ctx.L(label), `@${ctx.L(ptr)}`);
  ctx.ins('', 'CMP', 'I', `@${ctx.L(ptr)}`, ctx.L('bomb'));
  ctx.ins('', 'JMP', 'B', '2');
  ctx.ins('', 'JMP', 'B', ctx.L(label));
}
function emitMirror(ctx) {
  const { L, P, old, core, span } = ctx, pa = L('pa'), pb = L('pb');
  if (old) ctx.ins('sInit', 'MOV', 'I', `${L('bomb')}+${Math.floor(core / 2)}`, L('bomb'));
  else ctx.mark('sInit');
  ctx.ins('sLoop', 'ADD', 'AB', `#${P.STEP}`, pb);
  ctx.ins('', 'SUB', 'AB', `#${P.STEP}`, pa);
  ctx.ins('sLook', old ? 'CMP' : 'SEQ', 'I', `@${pa}`, `@${pb}`);
  ctx.ins('', 'JMP', 'B', L('sHit'));
  ctx.ins('', 'JMP', 'B', L('sLoop'));
  ctx.mark('sHit');
  for (const [side, p, then] of [['B', 'pb', 'sTryA'], ['A', 'pa', 'sLoop']]) {
    if (side === 'A') ctx.mark('sTryA');
    ifEmpty(ctx, then, p);
    ctx.ins('', 'SLT', 'AB', `#(${span}-${idxOf(ctx, p)}-1)`, L(p));
    ctx.ins('', 'JMP', 'B', L(then));
    ctx.ins('', 'SLT', 'AB', `#(CORESIZE-${idxOf(ctx, p)}-1)`, L(p));
    ctx.ins(`bomb${side}`, 'MOV', 'I', L('bomb'), `@${L(p)}`);
  }
  ctx.ins('', 'JMP', 'B', L('sLoop'));
  // pa's first look is the cell before the image, pb's the cell after it.
  ctx.ins('pa', 'DAT', 'F', '#0', `#(CORESIZE-${idxOf(ctx, 'pa')}-1+${P.STEP})`);
  ctx.ins('pb', 'DAT', 'F', '#0', `#(${span}-${idxOf(ctx, 'pb')}-${P.STEP})`);
  if (old) ctx.ins('bomb', 'DAT', 'F', '#0', '#0');
  else ctx.ins('bomb', 'DAT', 'F', '$0', '$0');
}

// Where each side looks on lap k (k = 1, 2, ...).
const mirrorLook = (api, side, k) => (side === 'B'
  ? mod(api.at('pb') + api.code('pb').b + k * api.P.STEP, api.core)
  : mod(api.at('pa') + api.code('pa').b - k * api.P.STEP, api.core));
// Planted targets: one on each side, on different laps, well clear of the image.
function mirrorTargets(api) {
  const pick = (side, n, not) => {
    let found = 0;
    for (let k = 1; k < 1000; k++) {
      const c = mirrorLook(api, side, k);
      let clear = !not.includes(k);
      for (let j = -8; j <= 8 && clear; j++) if (api.inImage(c + j)) clear = false;
      if (clear && ++found === n) return { k, c };
    }
    return { k: -1, c: -1 };
  };
  const b = pick('B', 3, []), a = pick('A', 2, [b.k]);
  return { a: a.c, b: b.c };
}

function watchMirror(api) {
  const { vm, core } = api;
  const planted = api.scenario === 'mirror-scanner: planted target';
  const targets = planted ? mirrorTargets(api) : { a: -1, b: -1 };
  const writers = { [api.at('bombA')]: 'pa', [api.at('bombB')]: 'pb' };
  const hitBy = { a: null, b: null };
  let looks = 0, bombs = 0;
  return {
    before(pc) {
      if (pc === api.at('sLook')) looks++;
      const p = writers[pc];
      if (!p) return null;
      return { pc, p, t: mod(api.at(p) + vm.peek(api.at(p)).b, core), bomb: vm.peek(api.at('bomb')) };
    },
    after(tok) {
      if (!tok) return;
      const { t, p } = tok;
      if (ownCell(api, t)) throw new Error('mirror-scanner bombed its own warrior');
      if (!api.same(vm.peek(t), tok.bomb) || vm.peek(t).op !== 'DAT' || vm.writerPc[t] !== tok.pc) throw new Error('mirror-scanner dropped something other than its bomb');
      bombs++;
      if (t === targets.a) hitBy.a = p;
      if (t === targets.b) hitBy.b = p;
    },
    final() {
      if (planted) {
        if (hitBy.b !== 'pb') throw new Error('mirror-scanner missed the planted target after its image');
        if (hitBy.a !== 'pa') throw new Error('mirror-scanner missed the planted target before its image');
      }
      if (api.alone && looks < 1000) throw new Error('mirror-scanner looked at too few pairs');
      if (api.alone && bombs) throw new Error('mirror-scanner bombed an empty core');
    },
  };
}

// ---------------------------------------------------------------------------
// opening-qscan-decode
//
// N pairs (X, X + GAP), X = START + k SPACING from the probe, compared with
// SEQ at one cycle a pair; a pair that differs leaves X in the probe (the last
// such pair wins). The decoder then works out which cell of the pair is
// occupied: X if it isn't empty, X + GAP if it is. No hit: the image boundary.
const decodeTable = (P, core) => Array.from({ length: P.N }, (_, k) => mod(P.START + k * P.SPACING, core));

function onExit(api, check) {
  let prevInSelf = false, exited = false;
  return {
    before(pc) {
      if (prevInSelf && !api.inSelf(pc) && !exited) { exited = true; check(api.vm.peek(api.at('probe')).b); }
      prevInSelf = api.inSelf(pc);
      return null;
    },
    exited: () => exited,
  };
}
const atBoundary = (api, b) => api.inImage(api.at('probe') + b - 1) && !api.inImage(api.at('probe') + b);

// ---------------------------------------------------------------------------
// finisher-outward
//
// Two pointers start at the probe's cell: fp writes it and walks forward
// (>fp), bp writes the cell before it and walks backward (<bp), one write each
// per lap, so the clear spreads both ways from what the opening found. Each
// pointer jumps over the image when it reaches it. The bomb is read through
// sel: SPL for the first STUN laps, then DAT; when the DAT phase starts, and
// every CORESIZE laps after, both pointers go back to the probe's cell.
function emitOutward(ctx) {
  const { L, P, old, span } = ctx, probe = ctx.ref('probe'), fp = L('fp'), bp = L('bp');
  // Reset pointer p to `to()` when its B-field equals `at()` (both built on
  // their own line, since they hold the pointer's index).
  const reset = (p, at, to, label) => {
    if (old) {
      ctx.ins('', 'CMP', 'AB', `#${at()}`, L(p));
      ctx.ins('', 'JMP', 'B', '2');
    } else ctx.ins('', 'SNE', 'AB', `#${at()}`, L(p));
    ctx.ins(label, 'MOV', 'AB', `#${to()}`, L(p));
  };
  ctx.ins('payload', 'MOV', 'B', probe, fp);
  ctx.ins('oAim', 'ADD', 'AB', `#(${probe}-${fp})`, fp);
  // A probe inside the image starts the clear at the image's end.
  ctx.ins('', 'SLT', 'AB', `#(${span}-${idxOf(ctx, 'fp')}-1)`, fp);
  ctx.ins('', 'MOV', 'AB', `#(${span}-${idxOf(ctx, 'fp')})`, fp);
  ctx.ins('', 'SLT', 'AB', `#(CORESIZE-${idxOf(ctx, 'fp')}-1)`, fp);
  ctx.ins('', 'JMP', 'B', L('oSync'));
  ctx.ins('', 'MOV', 'AB', `#(${span}-${idxOf(ctx, 'fp')})`, fp);
  ctx.ins('oSync', 'MOV', 'B', fp, bp);
  ctx.ins('', 'ADD', 'AB', `#(${fp}-${bp})`, bp);
  ctx.mark('oLoop');
  reset('bp', () => `(${span}-${idxOf(ctx, 'bp')})`, () => `(CORESIZE-${idxOf(ctx, 'bp')})`, 'bWrap');
  ctx.ins('oBack', 'MOV', 'I', `@${L('sel')}`, `<${bp}`);
  if (old) {
    ctx.ins('oFwd', 'MOV', 'I', `@${L('sel')}`, `@${fp}`);
    ctx.ins('', 'ADD', 'AB', '#1', fp);
  } else ctx.ins('oFwd', 'MOV', 'I', `@${L('sel')}`, `>${fp}`);
  reset('fp', () => `(CORESIZE-${idxOf(ctx, 'fp')})`, () => `(${span}-${idxOf(ctx, 'fp')})`, 'fWrap');
  ctx.ins('', 'DJN', 'B', L('oLoop'), L('cnt'));
  ctx.ins('', 'MOV', 'AB', `#(${L('dbomb')}-${L('sel')})`, L('sel'));
  ctx.ins('', 'JMP', 'B', L('payload'));
  ctx.ins('fp', 'DAT', 'F', '#0', '#0');
  ctx.ins('bp', 'DAT', 'F', '#0', '#0');
  ctx.ins('cnt', 'DAT', 'F', '#0', `#${P.STUN}`);
  ctx.ins('sel', 'DAT', 'F', '#0', `#(${L(P.STUN ? 'sbomb' : 'dbomb')}-${L('sel')})`);
  if (old) ctx.ins('sbomb', 'SPL', 'B', '0', '0');
  else ctx.ins('sbomb', 'SPL', 'B', '#0', '#0');
  ctx.ins('dbomb', 'DAT', 'F', '#0', '#0');
}

function watchOutward(api) {
  const { vm, core, P } = api;
  const fp = api.at('fp'), bp = api.at('bp'), sel = api.at('sel');
  const probe = mod(api.at('payload') + api.code('payload').a, core);
  const fwd = (c) => { do c = mod(c + 1, core); while (api.inImage(c)); return c; };
  const back = (c) => { do c = mod(c - 1, core); while (api.inImage(c)); return c; };
  const killed = new Int32Array(core).fill(-1);
  let entered = null, sole = false, datFrom = null, writes = 0, restart = false;
  let expectF = null, expectB = null;
  const writers = { [api.at('oBack')]: 'back', [api.at('oFwd')]: 'fwd' };
  return {
    before(pc) {
      if (pc === api.entry()) {
        if (entered === null) { entered = vm.cycle; sole = api.scenario === 'alone' && vm.processes(0).length === 1; }
        // The clear starts (again) at the probe's cell, or past the image if the probe is in it.
        let start = mod(probe + vm.peek(probe).b, core);
        if (api.inImage(start)) start = fwd(start);
        expectF = start; expectB = back(start); restart = true;
      }
      const side = writers[pc];
      if (!side) return null;
      // Where this write lands, read from the instruction as it stands.
      const p = side === 'fwd' ? fp : bp, t = mod(p + vm.peek(p).b - (vm.peek(pc).bMode === '<' ? 1 : 0), core);
      return { pc, side, t, bomb: vm.peek(sel + vm.peek(sel).b) };
    },
    after(tok) {
      if (!tok) return;
      const { t, side } = tok;
      if (api.inImage(t)) throw new Error('finisher-outward wrote over its own warrior');
      if (!api.same(vm.peek(t), tok.bomb) || vm.writerPc[t] !== tok.pc) throw new Error('A finisher-outward write broke its contract');
      const want = side === 'fwd' ? expectF : expectB;
      if (t !== want) throw new Error(restart ? 'finisher-outward did not start at the probe' : 'finisher-outward did not spread outward cell by cell');
      if (side === 'fwd') expectF = fwd(t); else { expectB = back(t); restart = false; }
      writes++;
      if (writes <= 2 * P.STUN && tok.bomb.op !== 'SPL') throw new Error('finisher-outward stunned too few cells');
      if (tok.bomb.op === 'DAT') { if (datFrom === null) datFrom = vm.cycle; killed[t] = vm.cycle; }
      else if (writes > 2 * P.STUN) throw new Error('finisher-outward kept stunning after its stun phase');
    },
    final() {
      if (entered === null || !sole || datFrom === null) return;
      if (vm.cycle - datFrom < (api.settings.dialect === '88' ? 5 : 3) * core) return;
      for (let c = 0; c < core; c++) if (!api.inImage(c) && killed[c] < datFrom) throw new Error('finisher-outward left cells untouched');
    },
  };
}

// ---------------------------------------------------------------------------

const BODY = { kind: 'body', exit: 'never', processes: 1, roams: false };
const blocks = {
  'blur-scanner': {
    ...BODY, writes: (P) => (P.CLEAR ? 'core' : 'sparse'), dialects: '94',
    purpose: 'Blur-style scanner: looks at one cell every STEP and, from each non-empty cell outside its image, lays a carpet of LEN SPL bombs forward one per lap while it keeps scanning; with CLEAR 1, after SCANS laps it turns into a DAT clear of everything outside its image.',
    params: { STEP: [1, 27719], LEN: [1, 64], CLEAR: [0, 1], SCANS: [1, 54000] },
    entry: 'sLoop', loop: 'sLoop',
    provides: (P) => (P.CLEAR ? { splBomb: 'bomb', datBomb: 'dbomb' } : { splBomb: 'bomb' }),
    mutable: [['ptr', ['a', 'b']], ['cnt', ['b']], ['clock', ['b']]],
    emit: emitBlur,
    plant: (api) => [[blurTarget(api), MARKER]],
    watch: watchBlur,
  },
  'mirror-scanner': {
    ...BODY, writes: 'sparse',
    purpose: 'Mirrored scanner: compares the cell x past its image with the cell x before it, x growing by STEP, two cells a lap; bombs whichever of a differing pair is occupied and outside the image.',
    params: { STEP: [1, 27719] },
    entry: 'sInit', loop: 'sLoop',
    provides: { datBomb: 'bomb' },
    mutable: [['pa', ['b']], ['pb', ['b']]],
    emit: emitMirror,
    plant(api) { const t = mirrorTargets(api); return [[t.a, MARKER], [t.b, MARKER]]; },
    watch: watchMirror,
  },
  'opening-qscan-decode': {
    kind: 'opening', exit: 'next', processes: 1, writes: 'sparse', link: 'fall', dialects: '94',
    purpose: 'Decoding quickscan: compares N fixed pairs (X, X + GAP), X = START + k SPACING, in about N cycles; then decodes which cell of a differing pair is occupied and hands that exact cell on, or the image boundary.',
    params: { START: [1, 54000], SPACING: [1, 27000], GAP: [1, 27000], N: [4, 14] }, entry: 'qScan',
    provides: { probe: 'probe' },
    mutable: [['probe', ['a', 'b']]],
    mismatches(P, settings) {
      const core = settings.coreSize, room = settings.maxLength;
      const cells = decodeTable(P, core).flatMap((x) => [x, mod(x + P.GAP, core)]);
      return cells.some((c) => c <= room || c >= core - room) ? ['a decoding quickscan probe lands on or next to the warrior itself'] : [];
    },
    state(ctx) { ctx.ins('probe', 'DAT', 'F', '#0', `#${ctx.span}`); },
    emit(ctx) {
      const { L, P, core, span } = ctx, probe = L('probe');
      decodeTable(P, core).forEach((x, k) => {
        ctx.ins(k ? '' : 'qScan', 'SEQ', 'I', `${probe}+${x}`, `${probe}+${mod(x + P.GAP, core)}`);
        ctx.ins('', 'MOV', 'AB', `#${x}`, probe);
      });
      // The decoder: no hit hands on the boundary; an empty first cell means the second.
      ctx.ins('qDec', 'SNE', 'AB', `#${span}`, probe);
      ctx.ins('', 'JMP', 'B', ctx.next);
      ctx.ins('', 'JMZ', 'F', L('qSecond'), `@${probe}`);
      ctx.ins('', 'JMP', 'B', ctx.next);
      ctx.ins('qSecond', 'ADD', 'AB', `#${P.GAP}`, probe);
    },
    // The target sits on the second cell of the middle pair.
    plant(api) {
      const x = decodeTable(api.P, api.core)[Math.floor(api.P.N / 2)];
      return [[api.at('probe') + x + api.P.GAP, MARKER]];
    },
    watch(api) {
      const table = decodeTable(api.P, api.core), core = api.core;
      const planted = api.scenario === 'opening-qscan-decode: planted target';
      const want = mod(table[Math.floor(api.P.N / 2)] + api.P.GAP, core);
      const seesSelf = table.some((x) => api.inImage(api.at('probe') + x) || api.inImage(api.at('probe') + x + api.P.GAP));
      const exit = onExit(api, (b) => {
        if (planted && b !== want) throw new Error(`The decoding quickscan handed on ${b}, not the planted cell ${want}`);
        if (api.scenario === 'alone' && !seesSelf && !atBoundary(api, b)) throw new Error('The decoding quickscan found nothing but did not hand on the image boundary');
      });
      return { before: exit.before, final: () => { if (planted && !exit.exited()) throw new Error('The decoding quickscan never handed on'); } };
    },
  },
  'finisher-outward': {
    kind: 'finisher', exit: 'never', processes: 1, writes: 'core', relocatable: false, protects: 'image',
    purpose: 'Clears outward from the probe\'s cell in both directions at once (one pointer forward, one backward), jumping over the image: SPL for the first STUN laps, then DAT, restarting at the probe every CORESIZE laps.',
    params: { STUN: [0, 4000] }, entry: 'payload',
    needs: ['probe'],
    provides: { datBomb: 'dbomb', splBomb: 'sbomb' },
    mutable: [['fp', ['b']], ['bp', ['b']], ['cnt', ['b']], ['sel', ['b']]],
    emit: emitOutward,
    watch: watchOutward,
  },
};
for (const [id, b] of Object.entries(blocks)) b.id = id;
// Defaults that work on every rule set they support (8,000 and 55,440 cores).
// 2341 is prime to 8,000 and 55,440: the scans reach every cell.
blocks['blur-scanner'].defaults = { STEP: 2341, LEN: 16, CLEAR: 1, SCANS: 4000 };
blocks['mirror-scanner'].defaults = { STEP: 2341 };
blocks['opening-qscan-decode'].defaults = { START: 400, SPACING: 900, GAP: 12, N: 8 };
blocks['finisher-outward'].defaults = { STUN: 32 };

export default Object.values(blocks);
