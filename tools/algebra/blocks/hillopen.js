// Hill openings: the burst and the scatter that the Koenigstuhl 94nop leaders
// open with. `probe-burst` drops bombs around the cell the scanner found;
// `decoy-maker` scatters junk far away so scanners find decoys, not us;
// `opening-qscan-lattice` is a denser decoding quickscan. How to write a
// block: docs/block-algebra.md. All Redcode here is written from scratch.

const MARKER = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };
const mod = (x, core) => ((x % core) + core) % core;

// ---------------------------------------------------------------------------
// probe-burst
//
// Sits in a seq between an opening (which hands on the cell it found through
// `probe`, B = that cell) and a body or finisher. It reads the probe, and if
// the opening found nothing (probe at the image boundary, B = span) it hands
// on at once. Otherwise it drops COUNT bombs STEP apart around the found cell,
// the first OFFSET cells before it, each one guarded off the warrior's own
// image, then hands on. The probe is left pointing at the found cell, so a
// finisher after it can still clear from there.

// The found cell the gate's planted run aims the opening at: far from the
// image, and +1 to dodge round numbers a quickscan's lattice might land on.
const burstFound = (api) => mod(api.image.start + Math.floor(api.core / 2) + 1, api.core);

const probeBurst = {
  id: 'probe-burst',
  kind: 'opening', exit: 'next', processes: 1, writes: 'sparse', link: 'fall', dialects: '94',
  purpose: 'Drops COUNT bombs STEP apart around the cell a probe found (the first OFFSET cells before it; BOMB 0 DAT, 1 SPL), never inside the warrior\'s image, then hands on; at the image boundary it hands on at once.',
  params: { COUNT: [1, 40], STEP: [1, 100], OFFSET: [0, 200], BOMB: [0, 1] },
  defaults: { COUNT: 12, STEP: 8, OFFSET: 16, BOMB: 0 },
  entry: 'burst',
  // Needs an upstream opening's probe. It does NOT advertise `provides: probe`:
  // the seq's first-provider rule already carries the upstream opening's probe
  // through to any later finisher unchanged, and advertising one here would let
  // probe-burst satisfy its own need, so a probe-less seq(probe-burst, ...)
  // would wrongly pass the contract and then silently no-op.
  needs: ['probe'],
  mutable: [['probe', ['a', 'b']], ['bp', ['b']], ['cnt', ['b']]],
  mismatches(P, settings) {
    // The whole burst (OFFSET before the hit to the last bomb) must be shorter
    // than half the core, so it can never wrap back into the image.
    const reach = P.OFFSET + P.COUNT * P.STEP;
    return reach >= Math.floor(settings.coreSize / 2) ? ['the burst is wide enough to wrap into the warrior'] : [];
  },
  emit(ctx) {
    const { L, P, span } = ctx, U = ctx.ref('probe');
    // Boundary? The opening leaves B = span when it found nothing.
    ctx.ins('burst', 'SNE', 'AB', `#${span}`, U);
    ctx.ins('', 'JMP', 'B', ctx.next);
    // Point our own probe and the bomb pointer at the found cell.
    ctx.ins('', 'MOV', 'B', U, L('probe'));
    ctx.ins('', 'ADD', 'AB', `#(${U}-${L('probe')})`, L('probe'));   // probe.B = found - probe
    ctx.ins('', 'MOV', 'B', L('probe'), L('bp'));
    ctx.ins('', 'ADD', 'AB', `#(${L('probe')}-${L('bp')}-${P.OFFSET})`, L('bp')); // bp.B = found - OFFSET - bp
    ctx.ins('', 'MOV', 'AB', `#${P.COUNT}`, L('cnt'));
    // Each pass: bomb unless the pointer has fallen within the image (B < span).
    ctx.ins('bLoop', 'SLT', 'AB', `#${span - 1}`, L('bp'));   // skip the JMP when B >= span
    ctx.ins('', 'JMP', 'B', L('bSkip'));
    ctx.ins('', 'MOV', 'I', L('bomb'), `@${L('bp')}`);
    ctx.ins('bSkip', 'ADD', 'AB', `#${P.STEP}`, L('bp'));
    ctx.ins('', 'DJN', 'B', L('bLoop'), L('cnt'));
    ctx.ins('', 'JMP', 'B', ctx.next);
    ctx.ins('probe', 'DAT', 'F', '#0', `#${span}`);
    ctx.ins('bp', 'DAT', 'F', '#0', '#0');
    ctx.ins('cnt', 'DAT', 'F', '#0', '#0');
    ctx.ins('bomb', P.BOMB ? 'SPL' : 'DAT', P.BOMB ? 'B' : 'F', '#0', '#0');
  },
  // Make the upstream opening hand on a real find (far from the image) without
  // the opening having to scan for it: poke its probe to point at `found`, and
  // put a marker there so a decoding opening keeps the pointer as it is.
  plant(api) {
    const found = burstFound(api), U = api.ref('probe');
    return [[U, { op: 'DAT', mod: 'F', aMode: '#', a: 0, bMode: '#', b: api.norm(found - U) }], [found, MARKER]];
  },
  watch(api) {
    const { vm, core, P } = api, bp = api.at('bp');
    const own = api.scenario === 'probe-burst: planted target';
    const found = burstFound(api);
    const want = new Set(Array.from({ length: P.COUNT }, (_, k) => mod(found - P.OFFSET + k * P.STEP, core)));
    const hit = new Set();
    let bombs = 0;
    return {
      before(pc) {
        if (pc !== api.at('bLoop') + 2) return null;        // the MOV.I bomb, @bp
        return mod(bp + vm.peek(bp).b, core);
      },
      after(t) {
        if (t === null) return;
        if (api.inImage(t)) throw new Error('probe-burst bombed its own image');
        if (!api.same(vm.peek(t), api.code('bomb')) || vm.writerPc[t] !== api.at('bLoop') + 2) throw new Error('probe-burst dropped something other than its bomb');
        bombs++; hit.add(t);
      },
      final() {
        if (own) {
          if (bombs !== P.COUNT) throw new Error(`probe-burst dropped ${bombs} bombs, not ${P.COUNT}`);
          for (const c of want) if (!hit.has(c)) throw new Error('probe-burst did not bomb the ring around the found cell');
        }
        if (api.alone && bombs) throw new Error('probe-burst bombed although the opening found nothing');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// decoy-maker
//
// First thing the warrior does: scatter COUNT copies of a junk instruction
// into a region DIST cells away, SPREAD apart, so a scanner that sweeps the
// core finds decoys far from the real code. Then it hands on with the probe at
// the image boundary (B = span), so it can lead a seq even before any scanner.
const decoyMaker = {
  id: 'decoy-maker',
  kind: 'opening', exit: 'next', processes: 1, writes: 'sparse', link: 'fall',
  purpose: 'Scatters COUNT junk cells into a region DIST away, SPREAD apart, so scanners find decoys far from the warrior, then hands on with the probe at the image boundary.',
  params: { COUNT: [1, 18], DIST: [256, 27000], SPREAD: [1, 400] },
  defaults: { COUNT: 8, DIST: 4000, SPREAD: 40 },
  entry: 'dMake',
  provides: { probe: 'probe' },
  mutable: [['dPtr', ['b']], ['dCnt', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, room = settings.maxLength;
    const out = [];
    if (P.DIST < room) out.push('the decoy region starts inside the warrior');
    if (P.DIST + P.COUNT * P.SPREAD > core - room) out.push('the decoy region runs on into the warrior itself');
    return out;
  },
  emit(ctx) {
    const { L, P, span } = ctx;
    ctx.ins('dMake', 'MOV', 'AB', `#${P.COUNT}`, L('dCnt'));
    ctx.ins('dLoop', 'MOV', 'I', L('junk'), `@${L('dPtr')}`);
    ctx.ins('', 'ADD', 'AB', `#${P.SPREAD}`, L('dPtr'));
    ctx.ins('', 'DJN', 'B', L('dLoop'), L('dCnt'));
    ctx.ins('', 'MOV', 'AB', `#${span}`, L('probe'));    // probe at the image boundary
    ctx.ins('', 'JMP', 'B', ctx.next);
    ctx.ins('dPtr', 'DAT', 'F', '#0', `#${P.DIST}`);
    ctx.ins('dCnt', 'DAT', 'F', '#0', '#0');
    ctx.ins('probe', 'DAT', 'F', '#0', `#${span}`);
    ctx.ins('junk', 'DAT', 'F', '#1', '#37');            // a non-empty cell: a decoy
  },
  watch(api) {
    const { vm, core, P } = api, ptr = api.at('dPtr');
    const want = new Set(Array.from({ length: P.COUNT }, (_, k) => mod(ptr + P.DIST + k * P.SPREAD, core)));
    const made = new Set();
    return {
      before(pc) {
        if (pc !== api.at('dLoop')) return null;
        return mod(ptr + vm.peek(ptr).b, core);
      },
      after(t) {
        if (t === null) return;
        if (api.inImage(t)) throw new Error('decoy-maker wrote a decoy inside its own image');
        if (!api.same(vm.peek(t), api.code('junk')) || vm.writerPc[t] !== api.at('dLoop')) throw new Error('decoy-maker wrote something other than its junk cell');
        made.add(t);
      },
      final() {
        // The scatter runs once at the start, whatever else shares the core, so
        // it is checked in every scenario (the writes are recorded as they land).
        if (made.size !== P.COUNT) throw new Error(`decoy-maker scattered ${made.size} decoys, not ${P.COUNT}`);
        for (const c of want) if (!made.has(c)) throw new Error('decoy-maker scattered its decoys in the wrong place');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// opening-qscan-lattice
//
// A denser quickscan. The lattice is 2*UNITS locations SPACING apart from
// START; each location is a pair of cells FACTOR apart (4*UNITS cells in all).
// Detection is unrolled, three instructions per UNIT testing four cells: an
// SNE and an SEQ, each comparing a pair, share one JMP to the decoder — a pair
// that differs (one cell occupied) reaches the decoder, all-equal falls to the
// next unit. On no hit it hands on the image boundary. On a hit the decoder
// walks the same lattice once, finds the differing pair and, with a JMZ, works
// out which of its two cells is occupied, then hands that exact cell on.

// loc_m = START + m*SPACING (m = 0..2*UNITS-1); cells loc_m and loc_m+FACTOR.
const latticeCells = (P, core) => {
  const out = [];
  for (let m = 0; m < 2 * P.UNITS; m++) { out.push(mod(P.START + m * P.SPACING, core), mod(P.START + m * P.SPACING + P.FACTOR, core)); }
  return out;
};

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

const qscanLattice = {
  id: 'opening-qscan-lattice',
  kind: 'opening', exit: 'next', processes: 1, writes: 'sparse', link: 'fall', dialects: '94',
  purpose: 'Dense decoding quickscan: UNITS unrolled units of three instructions test four cells each (an SNE/SEQ pair sharing one JMP) over 2*UNITS locations SPACING apart, each a pair FACTOR apart; a loop decoder hands on the exact occupied cell, or the image boundary.',
  params: { START: [1, 54000], SPACING: [1, 2000], FACTOR: [1, 2000], UNITS: [6, 10] },
  defaults: { START: 200, SPACING: 300, FACTOR: 100, UNITS: 10 },
  entry: 'qScan',
  provides: { probe: 'probe' },
  mutable: [['probe', ['a', 'b']], ['dpA', ['b']], ['dpB', ['b']], ['dcnt', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, room = settings.maxLength;
    return latticeCells(P, core).some((c) => c <= room || c >= core - room) ? ['a lattice quickscan probe lands on or next to the warrior itself'] : [];
  },
  state(ctx) { ctx.ins('probe', 'DAT', 'F', '#0', `#${ctx.span}`); },
  emit(ctx) {
    const { L, P } = ctx, probe = L('probe');
    // Detection: three instructions, four cells, a shared jump to the decoder.
    for (let k = 0; k < P.UNITS; k++) {
      const c0 = P.START + 2 * k * P.SPACING, c2 = P.START + (2 * k + 1) * P.SPACING;
      ctx.ins(k ? '' : 'qScan', 'SNE', 'I', `${probe}+${c0}`, `${probe}+${c0 + P.FACTOR}`);
      ctx.ins('', 'SEQ', 'I', `${probe}+${c2}`, `${probe}+${c2 + P.FACTOR}`);
      ctx.ins('', 'JMP', 'B', L('decode'));
    }
    ctx.ins('', 'JMP', 'B', ctx.next);                  // nothing found: probe stays at the boundary
    // Decoder: walk the lattice once; a pair that differs is resolved by a JMZ.
    ctx.ins('decode', 'ADD', 'AB', `#${P.SPACING}`, L('dpA'));
    ctx.ins('', 'ADD', 'AB', `#${P.SPACING}`, L('dpB'));
    ctx.ins('', 'SNE', 'I', `@${L('dpA')}`, `@${L('dpB')}`);  // differ -> skip the DJN
    ctx.ins('', 'DJN', 'B', L('decode'), L('dcnt'));
    ctx.ins('', 'JMP', 'B', L('dCell'));
    ctx.ins('dCell', 'JMZ', 'F', L('dSecond'), `@${L('dpA')}`); // first cell empty -> the second is the hit
    ctx.ins('', 'MOV', 'B', L('dpA'), probe);
    ctx.ins('', 'ADD', 'AB', `#(${L('dpA')}-${probe})`, probe);
    ctx.ins('', 'JMP', 'B', ctx.next);
    ctx.ins('dSecond', 'MOV', 'B', L('dpB'), probe);
    ctx.ins('', 'ADD', 'AB', `#(${L('dpB')}-${probe})`, probe);
    ctx.ins('', 'JMP', 'B', ctx.next);
    // The scan heads start one SPACING before START, so the first lap lands on loc_0.
    ctx.ins('dpA', 'DAT', 'F', '#0', `#(${P.START - P.SPACING}+(${probe}-${L('dpA')}))`);
    ctx.ins('dpB', 'DAT', 'F', '#0', `#(${P.START - P.SPACING + P.FACTOR}+(${probe}-${L('dpB')}))`);
    ctx.ins('dcnt', 'DAT', 'F', '#0', `#${2 * P.UNITS + 1}`);
  },
  // Plant on the second cell of a middle location, so the decoder's JMZ path runs.
  plant(api) {
    const m0 = api.P.UNITS, cell = mod(api.P.START + m0 * api.P.SPACING + api.P.FACTOR, api.core);
    return [[api.at('probe') + cell, MARKER]];
  },
  watch(api) {
    const planted = api.scenario === 'opening-qscan-lattice: planted target';
    const m0 = api.P.UNITS, want = mod(api.P.START + m0 * api.P.SPACING + api.P.FACTOR, api.core);
    const cells = latticeCells(api.P, api.core);
    const seesSelf = cells.some((c) => api.inImage(api.at('probe') + c));
    const exit = onExit(api, (b) => {
      if (planted && b !== want) throw new Error(`The lattice quickscan handed on ${b}, not the planted cell ${want}`);
      if (api.scenario === 'alone' && !seesSelf && !atBoundary(api, b)) throw new Error('The lattice quickscan found nothing but did not hand on the image boundary');
    });
    return { before: exit.before, final: () => { if (planted && !exit.exited()) throw new Error('The lattice quickscan never handed on'); } };
  },
};

export default [probeBurst, decoyMaker, qscanLattice];
