// Hill openings: the burst and the scatter that the Koenigstuhl 94nop leaders
// open with. `probe-burst` drops bombs around the cell the scanner found;
// `decoy-maker` scatters junk far away so scanners find decoys, not us;
// `opening-qscan-lattice` is a denser decoding quickscan, and
// `opening-qscan-mul` decodes its hit with a MUL. How to write a block:
// docs/block-algebra.md. All Redcode here is written from scratch.

import { modInverse } from '../util.js';
import {observeMulQuickscan} from '../observation-roles.js';

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
// Stepped on until no cell of the burst touches the warrior, so a boot's copy
// (which may sit half a core away) is never in the way.
const burstFound = (api) => {
  const { P, core } = api, lo = -P.OFFSET - 2, hi = -P.OFFSET + P.COUNT * P.STEP + 2;
  let c = mod(api.image.start + Math.floor(core / 2) + 1, core);
  for (let tries = 0; tries < 16; tries++, c = mod(c + 1009, core)) {
    let clear = true;
    for (let d = lo; d <= hi && clear; d++) if (api.inImage(c + d)) clear = false;
    if (clear) return c;
  }
  return c;
};

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
    let bombs = 0, aimed = null;
    return {
      before(pc) {
        if (pc === api.entry() && aimed === null) aimed = mod(api.ref('probe') + vm.peek(api.ref('probe')).b, core) === found;
        if (pc !== api.at('bLoop') + 2) return null;        // the MOV.I bomb, @bp
        return mod(bp + vm.peek(bp).b, core);
      },
      after(t) {
        if (t === null) return;
        if (api.inImage(t) && !api.inDead(t)) throw new Error('probe-burst bombed its own image');
        if (!api.same(vm.peek(t), api.code('bomb')) || vm.writerPc[t] !== api.at('bLoop') + 2) throw new Error('probe-burst dropped something other than its bomb');
        bombs++; hit.add(t);
      },
      final() {
        // Under a boot the opening may find the abandoned original first; the
        // ring is only owed when the burst started at the planted cell.
        if (own && aimed) {
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
      if (prevInSelf && !api.inSelf(pc) && !exited && !api.vm.processes(0).some((q) => api.inSelf(q))) { exited = true; check(api.vm.peek(api.at('probe')).b); }
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
      if (planted && b !== want && !api.inImage(api.at('probe') + b)) throw new Error(`The lattice quickscan handed on ${b}, not the planted cell ${want}`);
      if (api.scenario === 'alone' && !seesSelf && !atBoundary(api, b)) throw new Error('The lattice quickscan found nothing but did not hand on the image boundary');
    });
    return { before: exit.before, final: () => { if (planted && !exit.exited()) throw new Error('The lattice quickscan never handed on'); } };
  },
};

// ---------------------------------------------------------------------------
// opening-qscan-mul
//
// A quickscan that decodes a hit with one MUL instead of a loop (the q^4 idea
// of the 94nop leaders; docs/hill-recipe-book.md, openings chapter). Each of
// UNITS units owns a table cell t_k (a state cell k+1 past the probe) holding
// X_k = 1 + QFAC*(k+1), and tests two locations, each a pair GAP apart:
//
//   sne  probe+S_k+QDEC, probe+S_k+QDEC+GAP   ; location A = QDEC * X_k
//   seq  <t_k, probe+S_k+GAP                  ; location B = QDEC * (X_k - 1)
//   jmp  dec_g, {sel / $0 / }sel              ; pick t_k for the decoder
//
// with QDEC = 1 + QFAC^-1 and S_k = (k+1)(1+QFAC), all mod the core. The SEQ's
// `<t_k` decrements the entry to X_k - 1 and, because of how QDEC is chosen,
// lands exactly on location B's first cell. So the entry records which
// location fired: X_k if the SNE did (the SEQ never ran), X_k - 1 if the SEQ
// did. The decoder points `sel` at t_k (units come in threes: {sel, nothing,
// }sel around a middle entry, and a ladder of ADD #3 for later threes), sets
// probe.B = QDEC, multiplies it by the entry and has the location; a JMN picks
// the occupied cell of the pair. A hit costs 4 to 5 + g cycles (g = UNITS/3
// rounded down at most). No hit leaves the probe at the image boundary.
//
// Nothing above needs t_k to be k+1 past the probe: with t_k at any offset d_k
// the entry is 1 + QFAC*d_k and location B is d_k*(1+QFAC). So SHARE 1 lets the
// linker put whole threes of the table in B-fields another block never reads
// (gap #4: Hullabaloo's and Elven King's tables live in their boots' SPLs):
// today the fan lines of a fanboot later in the same seq. The code below is
// written with label arithmetic, so it is the same either way, and the checks
// on where the probes land run after linking, when the d_k are known.

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
// Unit k's locations relative to the probe: B (the SEQ's) and A (the SNE's).
const mulUnits = (P, core) => {
  const dec = mod(1 + modInverse(P.QFAC, core), core);
  return Array.from({ length: P.UNITS }, (_, k) => {
    const b = mod((k + 1) * (1 + P.QFAC), core);
    return { k, b, a: mod(b + dec, core), entry: mod(1 + P.QFAC * (k + 1), core) };
  });
};
const mulCells = (P, core) => mulUnits(P, core).flatMap((u) => [u.a, mod(u.a + P.GAP, core), u.b, mod(u.b + P.GAP, core)]);
// The same, with each table cell where the linker put it (d[k] past the probe).
const placedUnits = (P, core, d) => {
  const dec = mod(1 + modInverse(P.QFAC, core), core);
  return d.map((dk, k) => { const b = mod(dk * (1 + P.QFAC), core); return { k, b, a: mod(b + dec, core) }; });
};
const placedCells = (P, core, d) => placedUnits(P, core, d).flatMap((u) => [u.a, mod(u.a + P.GAP, core), u.b, mod(u.b + P.GAP, core)]);
const groupSizes = (P) => Array.from({ length: Math.ceil(P.UNITS / 3) }, (_, g) => Math.min(3, P.UNITS - 3 * g));
const tableOffsets = (api) => Array.from({ length: api.P.UNITS }, (_, k) => mod(api.at(`t${k}`) - api.at('probe'), api.core));
const probeProblems = (P, settings, cells) => {
  const core = settings.coreSize, room = settings.maxLength, out = [];
  if (cells.some((c) => c <= room || c >= core - room)) out.push('a MUL quickscan probe lands on or next to the warrior itself');
  if (new Set(cells).size < cells.length) out.push('two MUL quickscan probes test the same cell');
  return out;
};

const qscanMul = {
  id: 'opening-qscan-mul',
  kind: 'opening', exit: 'next', processes: 1, writes: 'sparse', link: 'fall', dialects: '94',
  purpose: 'MUL-decoding quickscan: UNITS unrolled units of three instructions test two pair locations each (an SNE, and an SEQ whose predecrement of a table entry records which location fired); on a hit one MUL turns that entry into the location, a JMN picks the occupied cell of the pair and hands it on, or the image boundary.',
  params: { QFAC: [1, 54000], GAP: [1, 2000], UNITS: [1, 13], SHARE: [0, 1] },
  defaults: { QFAC: 349, GAP: 197, UNITS: 8, SHARE: 0 },
  observationRole:'quickscan',observe:observeMulQuickscan,
  knowledge:{parameterRoles:{QFAC:'invertible geometry/decoder factor',GAP:'pair spacing',UNITS:'structural probe and instruction count',SHARE:'table-layout choice'},
    derived:{decoder:'1+inverse(QFAC,coreSize)',probeLocations:'linked table offsets, QFAC and GAP'},
    tuningGroups:[{name:'scan-and-burst',parameters:['QFAC','GAP','next.COUNT','next.STEP','next.OFFSET','next.GAP'],requires:'invertible factor; distinct safe linked probes; safe nonaliasing burst window'}],
    tuning:['Recompute probe geometry after linking shared tables.','Distinct safe probe locations are required; more even spacing alone does not prove better combat coverage.','Tune hit geometry together with the following burst and boot latency.'],
    failures:['Source layout changes can move a shared table so probes hit our own image.','Frozen-marker coverage is not battle win rate.','The 2026-11-04 36-cell boot/scan/burst grid selected QFAC243/GAP138/six units with shared SEED1 and the original burst. Its two fresh40-round full-field gains were +0.101% and +0.688%; the first opponent-sensitivity bound crossed zero, so current was retained. QFAC243 is a scoped challenger, not a new default or independently confirmed gain.'],
    replicationKnowledge:['The fixed shared-SEED1/QFAC243 challenger subsequently passes six fresh40-round full-field seeds: gain0.4137%,5/6 positive, across-seed95% interval0.1128 to0.7146 percent. This does not overwrite the earlier inconclusive confirmation record.','Scan-only averages0.1776% with an interval spanning zero; adding scan243 to shared-SEED1 averages0.0054%, also spanning zero. Combined strength is not proof of an incremental scanning benefit. Keep QFAC349 as current default pending a separate decision.','Four-arm placement replays include a Rascal win at35 with scan-only/combined versus later losses for current/seed-only, and an Ick placement where both singles win but the combination loses. These examples demonstrate useful coverage and regressions without establishing their whole-field prevalence.'],
    freshFamilyKnowledge:['In the fresh2026-11-04 source comparison, Armadillo has selected opening wins at cycles35 and52 against The Bloodhound and CrazyShot where current does not attack in its opening. Its bombs replace control instructions later executed as DAT.','Most reference-win/current-loss pairs in the preselected three-advantage-opponent cohorts have no opening attack from either warrior:58/72 for Tolypeutes and42/54 for Armadillo. Scan improvements address a real subset, not the entire remaining gap.','Compare coverage and response geometry separately, then together. Keep no-hit delay, actual target use, burst cost, regressions and full-field points; restoring one selected opening write can preserve a win through later redundant attack.'],
    placementKnowledge:['In six later fresh ten-round frozen-archive placements, combined SEED1/QFAC243 has median56.5 versus current89 and SEED1-only69. All-nine medians including historical anchors are90/68/68. Broad ranges and unchanged added-scan uncertainty in the40-round study prevent attributing this median rank difference solely to better scanning. No default or current snapshot changes.'],
    evidence:[]},
  entry: 'qScan',
  provides: { probe: 'probe' },
  mutable: (P) => [['probe', ['a', 'b']], ['sel', ['a']], ...Array.from({ length: P.UNITS }, (_, k) => [`t${k}`, ['b']])],
  mismatches(P, settings) {
    const core = settings.coreSize;
    if (gcd(P.QFAC, core) !== 1) return [`QFAC ${P.QFAC} has no inverse mod ${core}, so a hit can't be decoded`];
    // With a shared table the offsets are known only after linking (see linked).
    return P.SHARE ? [] : probeProblems(P, settings, mulCells(P, core));
  },
  // Threes of the table that may live in another block's free B-fields.
  claimsFreeB: (P) => (P.SHARE ? groupSizes(P) : null),
  claimCell: (P, L, k) => ({ label: L(`t${k}`), value: `1-${P.QFAC}*(${L('probe')})` }),
  linked: (P, settings, at) => probeProblems(P, settings, placedCells(P, settings.coreSize, Array.from({ length: P.UNITS }, (_, k) => mod(at(`t${k}`) - at('probe'), settings.coreSize)))),
  // The probe and the table are state cells, laid out together before all
  // code, so the table's offsets from the probe (and so every location) are
  // fixed whatever the rest of the warrior is. A three the linker placed
  // elsewhere (ctx.claimed) is left out here.
  state(ctx) {
    const { L, P } = ctx;
    ctx.ins('probe', 'DAT', 'F', '#0', `#${ctx.span}`);
    for (let k = 0; k < P.UNITS; k++) if (!ctx.claimed?.has(Math.floor(k / 3))) ctx.ins(`t${k}`, 'DAT', 'F', '#0', `#1-${P.QFAC}*(${L('probe')})`);
  },
  emit(ctx) {
    const { L, P, core } = ctx, probe = L('probe');
    const dec = mod(1 + modInverse(P.QFAC, core), core), groups = Math.ceil(P.UNITS / 3);
    const t = (k) => L(`t${k}`), loc = (k) => `(${t(k)}-${probe})*${1 + P.QFAC}`;   // location B, as label arithmetic
    const mid = (g) => (3 * g + 1 < P.UNITS ? t(3 * g + 1) : `${t(3 * g)}+1`);       // where sel.A points for group g
    for (let k = 0; k < P.UNITS; k++) {
      const g = Math.floor(k / 3), r = k % 3;
      ctx.ins(k ? '' : 'qScan', 'SNE', 'I', `${probe}+${loc(k)}+${dec}`, `${probe}+${loc(k)}+${dec + P.GAP}`);
      ctx.ins('', 'SEQ', 'I', `<${t(k)}`, `${probe}+${loc(k)}+${P.GAP}`);
      ctx.ins('', 'JMP', 'B', L(`dec${g}`), r === 0 ? `{${L('sel')}` : r === 2 ? `}${L('sel')}` : '$0');
    }
    ctx.ins('', 'JMP', 'B', ctx.next);                   // nothing found: probe stays at the boundary
    // Ladder: entering at dec_g walks sel.A from group to group down to group g.
    for (let g = groups - 1; g >= 1; g--) ctx.ins(`dec${g}`, 'ADD', 'A', `#${mid(g)}-${mid(g - 1)}`, L('sel'));
    ctx.ins('dec0', 'MOV', 'AB', `#${mod(1 + modInverse(P.QFAC, core), core)}`, probe);
    ctx.ins('', 'MUL', 'B', `*${L('sel')}`, probe);      // probe.B = QDEC * entry = the location
    ctx.ins('', 'JMN', 'F', ctx.next, `@${probe}`);      // first cell occupied: hand it on
    ctx.ins('', 'ADD', 'AB', `#${P.GAP}`, probe);        // otherwise it is the second
    ctx.ins('', 'JMP', 'B', ctx.next);
    // sel.A starts at the middle entry of the first three.
    ctx.ins('sel', 'DAT', 'F', `${mid(0)}-${L('sel')}`, '#0');
  },
  // Plant on the second cell of the SEQ location of a middle unit, so the
  // decrement, the ladder and the pair choice all run.
  plant(api) {
    const u = placedUnits(api.P, api.core, tableOffsets(api))[Math.floor(api.P.UNITS / 2)];
    return [[api.at('probe') + u.b + api.P.GAP, MARKER]];
  },
  watch(api) {
    const planted = api.scenario === 'opening-qscan-mul: planted target';
    const d = tableOffsets(api), u = placedUnits(api.P, api.core, d)[Math.floor(api.P.UNITS / 2)];
    const want = mod(u.b + api.P.GAP, api.core);
    const seesSelf = placedCells(api.P, api.core, d).some((c) => api.inImage(api.at('probe') + c));
    const exit = onExit(api, (b) => {
      if (planted && b !== want && !api.inImage(api.at('probe') + b)) throw new Error(`The MUL quickscan handed on ${b}, not the planted cell ${want}`);
      if (api.scenario === 'alone' && !seesSelf && !atBoundary(api, b)) throw new Error(`The MUL quickscan found nothing but did not hand on the image boundary (handed on ${b}, image ${api.total})`);
    });
    return { before: exit.before, final: () => { if (planted && !exit.exited()) throw new Error('The MUL quickscan never handed on'); } };
  },
};

export default [probeBurst, decoyMaker, qscanLattice, qscanMul];
