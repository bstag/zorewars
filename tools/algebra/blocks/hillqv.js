// Hill quickscans and vampires, second round (gaps #1 and #13 of
// docs/hill-recipe-book.md, "What our blocks are missing").
//
//   opening-qscan-mul45  the q^4 MUL decode plus the "qz mutation": one SEQ bumps
//                        the decoder's multiplier, and a second run of one-pair
//                        units tests new locations from the same table (q^4.5)
//   opening-qscan-qi     a two-factor quickscan: the probe holds two factors,
//                        each unit compares an A location with an unrelated B
//                        location, and the hit is decoded with a MUL.F (q^i)
//   airbag-vampire       a fang thrower whose 4-line loop is run by 3 processes,
//                        started by a launch that rewrites the loop's last line
//   djn-vampire          a scanning vampire that also throws DJN.F bombs from
//                        its loop, at the mirror side of its fang
//
// How to write a block: docs/block-algebra.md. All Redcode here is written from
// scratch; hill warriors were studied for ideas only.

import { modInverse } from '../util.js';

const MARKER = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };
const mod = (x, core) => ((x % core) + core) % core;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

// An opening's hand-on, seen from outside: the first step after the last
// process left the block's code. `check` gets the probe's B-field then.
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
const probeProblems = (name, settings, cells) => {
  const core = settings.coreSize, room = settings.maxLength, out = [];
  if (cells.some((c) => c <= room || c >= core - room)) out.push(`a ${name} probe lands on or next to the warrior itself`);
  if (new Set(cells).size < cells.length) out.push(`two ${name} probes test the same cell`);
  return out;
};

// ---------------------------------------------------------------------------
// opening-qscan-mul45
//
// opening-qscan-mul (hillopen.js) with Hullabaloo's extra half (Roy van Rijn's
// q^4.5; Halcyon and Elven King share it). The first UNITS units are the q^4
// units: table cell t_k (k+1 past the probe) holds X_k = 1 + QFAC*(k+1); the
// SNE tests location QDEC*X_k, the SEQ's `<t_k` drops the entry to X_k - 1 and
// lands on location QDEC*(X_k - 1), so the entry records which one fired
// (QDEC = 1 + QFAC^-1). Here the multiplier lives in the probe's B-field from
// the start (B = QDEC), so a hit costs one MUL and nothing else:
//
//   seq  >probe, probe+QDEC+GAP     ; the qz mutation: tests location QDEC (X = 1)
//   jmp  pick, <probe               ;   and bumps probe.B to QDEC+1 on the way
//
// After it every first-half SEQ has run, so each t_k holds X_k - 1, and the
// MUL now multiplies by QDEC+1. UNITS2 SEQ-only units then test the locations
// (QDEC+1)*(X_k - 1) = (k+1)*(2*QFAC + 1), one pair each, reusing the last
// UNITS2 entries of the table and the same selector moves (`{sel`, nothing,
// `}sel` within a three and the ladder of ADD #3 between threes). The last
// entries are the ones used because (k+1)(2Q+1) sits only k+1 cells from the
// first half's location 2(k+1)(Q+1) when 2(k+1) <= UNITS. No hit sets the
// probe to the image boundary. A hit hands on the exact cell, as
// opening-qscan-mul does (B == span means nothing found).

const m45Units = (P, core) => {
  const dec = mod(1 + modInverse(P.QFAC, core), core), out = [];
  for (let k = 0; k < P.UNITS; k++) {
    const b = mod((k + 1) * (1 + P.QFAC), core);
    out.push({ half: 1, k, cells: [mod(b + dec, core), mod(b + dec + P.GAP, core), b, mod(b + P.GAP, core)] });
  }
  out.push({ half: 0, cells: [dec, mod(dec + P.GAP, core)] });
  for (let j = 0; j < P.UNITS2; j++) {
    const k = P.UNITS - P.UNITS2 + j, l = mod((k + 1) * (2 * P.QFAC + 1), core);
    out.push({ half: 2, k, cells: [l, mod(l + P.GAP, core)] });
  }
  return out;
};
const m45Cells = (P, core) => m45Units(P, core).flatMap((u) => u.cells);
// The planted cell: the second cell of the second half's middle unit, so the
// mutation, the ladder, the MUL by QDEC+1 and the pair choice all run.
const m45Want = (P, core) => m45Units(P, core).filter((u) => u.half === 2)[Math.floor(P.UNITS2 / 2)].cells[1];

const qscanMul45 = {
  id: 'opening-qscan-mul45',
  kind: 'opening', exit: 'next', processes: 1, writes: 'sparse', link: 'fall', dialects: '94',
  purpose: 'q^4.5 quickscan: UNITS MUL-decoded units of three lines (four cells each, as opening-qscan-mul), then a SEQ that bumps the decoder\'s multiplier from QDEC to QDEC+1, then UNITS2 two-line units testing new pairs from the same table; a hit costs one MUL and a JMN, and hands on the exact cell, or the image boundary.',
  params: { QFAC: [1, 54000], GAP: [1, 2000], UNITS: [4, 12], UNITS2: [1, 6] },
  defaults: { QFAC: 1577, GAP: 765, UNITS: 8, UNITS2: 3 },
  entry: 'qScan',
  provides: { probe: 'probe' },
  mutable: (P) => [['probe', ['a', 'b']], ['sel', ['a']], ...Array.from({ length: P.UNITS }, (_, k) => [`t${k}`, ['b']])],
  mismatches(P, settings) {
    const core = settings.coreSize;
    if (gcd(P.QFAC, core) !== 1) return [`QFAC ${P.QFAC} has no inverse mod ${core}, so a hit can't be decoded`];
    if (P.UNITS2 > P.UNITS) return ['the second half reuses table entries, so UNITS2 must not exceed UNITS'];
    return probeProblems('q^4.5 quickscan', settings, m45Cells(P, core));
  },
  // The probe (B = QDEC, the multiplier) and the table come first, so every
  // location is fixed relative to the probe whatever the rest of the warrior is.
  state(ctx) {
    const { L, P, core } = ctx;
    ctx.ins('probe', 'DAT', 'F', '#0', `#${mod(1 + modInverse(P.QFAC, core), core)}`);
    for (let k = 0; k < P.UNITS; k++) ctx.ins(`t${k}`, 'DAT', 'F', '#0', `#1-${P.QFAC}*(${L('probe')})`);
  },
  emit(ctx) {
    const { L, P, core, span } = ctx, probe = L('probe');
    const dec = mod(1 + modInverse(P.QFAC, core), core), groups = Math.ceil(P.UNITS / 3);
    const t = (k) => L(`t${k}`);
    const loc = (k) => `(${t(k)}-${probe})*${1 + P.QFAC}`;              // first half, location B
    const loc2 = (k) => `(${t(k)}-${probe})*${2 * P.QFAC + 1}`;         // second half
    const mid = (g) => (3 * g + 1 < P.UNITS ? t(3 * g + 1) : `${t(3 * g)}+1`);
    const pick = (k) => { const r = k % 3; return r === 0 ? `{${L('sel')}` : r === 2 ? `}${L('sel')}` : '$0'; };
    for (let k = 0; k < P.UNITS; k++) {
      ctx.ins(k ? '' : 'qScan', 'SNE', 'I', `${probe}+${loc(k)}+${dec}`, `${probe}+${loc(k)}+${dec + P.GAP}`);
      ctx.ins('', 'SEQ', 'I', `<${t(k)}`, `${probe}+${loc(k)}+${P.GAP}`);
      ctx.ins('', 'JMP', 'B', L(`dec${Math.floor(k / 3)}`), pick(k));
    }
    // The qz mutation: location QDEC, and probe.B becomes QDEC+1 for the rest.
    ctx.ins('', 'SEQ', 'I', `>${probe}`, `${probe}+${dec + P.GAP}`);
    ctx.ins('', 'JMP', 'B', L('pick'), `<${probe}`);                    // hit: back to QDEC, no MUL needed
    for (let j = 0; j < P.UNITS2; j++) {
      const k = P.UNITS - P.UNITS2 + j;
      ctx.ins('', 'SEQ', 'I', `${probe}+${loc2(k)}`, `${probe}+${loc2(k)}+${P.GAP}`);
      ctx.ins('', 'JMP', 'B', L(`dec${Math.floor(k / 3)}`), pick(k));
    }
    ctx.ins('', 'MOV', 'AB', `#${span}`, probe);                        // nothing found: the image boundary
    ctx.ins('', 'JMP', 'B', ctx.next);
    for (let g = groups - 1; g >= 1; g--) ctx.ins(`dec${g}`, 'ADD', 'A', `#${mid(g)}-${mid(g - 1)}`, L('sel'));
    ctx.ins('dec0', 'MUL', 'B', `*${L('sel')}`, probe);                 // probe.B = (QDEC or QDEC+1) * entry
    ctx.ins('pick', 'JMN', 'F', ctx.next, `@${probe}`);                 // first cell occupied: hand it on
    ctx.ins('', 'ADD', 'AB', `#${P.GAP}`, probe);                       // otherwise the second
    ctx.ins('', 'JMP', 'B', ctx.next);
    ctx.ins('sel', 'DAT', 'F', `${mid(0)}-${L('sel')}`, '#0');
  },
  plant(api) { return [[api.at('probe') + m45Want(api.P, api.core), MARKER]]; },
  watch(api) {
    const planted = api.scenario === 'opening-qscan-mul45: planted target';
    const want = m45Want(api.P, api.core);
    const seesSelf = m45Cells(api.P, api.core).some((c) => api.inImage(api.at('probe') + c));
    const exit = onExit(api, (b) => {
      if (planted && b !== want && !api.inImage(api.at('probe') + b)) throw new Error(`The q^4.5 quickscan handed on ${b}, not the planted cell ${want}`);
      if (api.scenario === 'alone' && !seesSelf && !atBoundary(api, b)) throw new Error(`The q^4.5 quickscan found nothing but did not hand on the image boundary (handed on ${b})`);
    });
    return { before: exit.before, final: () => { if (planted && !exit.exited()) throw new Error('The q^4.5 quickscan never handed on'); } };
  },
};

// ---------------------------------------------------------------------------
// opening-qscan-qi
//
// inversed's two-factor q^i (Eternal Exile, King Cobra, One bite; pst_v4 uses
// it too). The probe holds two factors (FA, FB) and three table cells hold
// pairs S, T, R. Each unit compares an A location with a B location built
// from different factors, so the two cells of a pair are unrelated places:
//
//   sne  probe+FA*x, probe+FB*y           ; pair 1
//   seq  probe+FA*x+STEP, probe+FB*y+STEP ; pair 2, STEP further on
//   jmp  dec, <dsel                       ; hit: choose (x, y), go
//
// The (x, y) of the ten units, and how each one's JMP sets them up:
//   (1, 1)                  jmp decide        (no MUL)
//   T, S, R                 jmp dec, $0 / <dsel / >dsel   (dsel picks the cell)
//   (TA-1, TB-1)            djn.f dec, T      (decrements the entry)
//   T with (FA-1, FB-1)     djn.f dec, probe  (decrements the factors)
//   (TA*TB, TA*TB) and the same for S, R, and (TA-1)(TB-1):
//                           jmp decX ...      (MUL.X squares the entry first)
// dec is `mul.f @dsel, probe`, so the probe then holds both locations; decide
// checks the first pair (`sne *probe, @probe`; equal means the second pair,
// `add.f` STEP to both), and if the A cell is occupied swaps the fields with
// MOV.X, so B is the occupied cell. A hit costs 0 to 2 MULs and 2 to 4 more
// cycles. No hit sets B to the image boundary. The constants are ours: a
// search for 40 cells distinct and clear of the warrior on both cores.

const qiFactors = (P, core) => {
  const m = (...xs) => xs.reduce((p, x) => mod(p * mod(x, core), core), 1);
  const T2 = m(P.TA, P.TB), S2 = m(P.SA, P.SB), R2 = m(P.RA, P.RB), T1 = m(P.TA - 1, P.TB - 1);
  return [[P.FA, P.FB], [m(P.FA, P.TA), m(P.FB, P.TB)], [m(P.FA, P.SA), m(P.FB, P.SB)], [m(P.FA, P.RA), m(P.FB, P.RB)],
    [m(P.FA, P.TA - 1), m(P.FB, P.TB - 1)], [m(P.FA - 1, P.TA), m(P.FB - 1, P.TB)],
    [m(P.FA, T2), m(P.FB, T2)], [m(P.FA, S2), m(P.FB, S2)], [m(P.FA, R2), m(P.FB, R2)], [m(P.FA, T1), m(P.FB, T1)]].slice(0, P.UNITS);
};
const qiCells = (P, core) => qiFactors(P, core).flatMap(([a, b]) => [a, b, mod(a + P.STEP, core), mod(b + P.STEP, core)]);
// Planted: the second pair's A cell of unit 7 (or the last), so the selector,
// the squaring MUL, the pair choice and the swap all run.
const qiWant = (P, core) => { const f = qiFactors(P, core), [a] = f[Math.min(7, f.length - 1)]; return mod(a + P.STEP, core); };

const qscanQi = {
  id: 'opening-qscan-qi',
  kind: 'opening', exit: 'next', processes: 1, writes: 'sparse', link: 'fall', dialects: '94',
  purpose: 'Two-factor q^i quickscan: the probe holds factors (FA, FB); UNITS unrolled units of three lines each compare an A location with an unrelated B location (and both again STEP on), the factors coming from table pairs S, T, R, decremented or squared by the unit\'s JMP; a hit is decoded with one or two MULs, a pair test and a field swap, and hands on the exact cell, or the image boundary.',
  params: { FA: [2, 54000], FB: [2, 54000], TA: [2, 54000], TB: [2, 54000], SA: [2, 54000], SB: [2, 54000], RA: [2, 54000], RB: [2, 54000], STEP: [1, 54000], UNITS: [4, 10] },
  defaults: { FA: 3010, FB: 513, TA: 4176, TB: 1246, SA: 807, SB: 6019, RA: 4062, RB: 6926, STEP: 3550, UNITS: 10 },
  entry: 'qScan',
  provides: { probe: 'probe' },
  mutable: [['probe', ['a', 'b']], ['tS', ['a', 'b']], ['tT', ['a', 'b']], ['tR', ['a', 'b']], ['dsel', ['b']]],
  mismatches(P, settings) { return probeProblems('q^i quickscan', settings, qiCells(P, settings.coreSize)); },
  state(ctx) {
    const { L, P } = ctx;
    ctx.ins('probe', 'DAT', 'F', `#${P.FA}`, `#${P.FB}`);
    ctx.ins('tS', 'DAT', 'F', `#${P.SA}`, `#${P.SB}`);
    ctx.ins('tT', 'DAT', 'F', `#${P.TA}`, `#${P.TB}`);
    ctx.ins('tR', 'DAT', 'F', `#${P.RA}`, `#${P.RB}`);
    ctx.ins('qinc', 'DAT', 'F', `#${P.STEP}`, `#${P.STEP}`);
    ctx.ins('dsel', 'DAT', 'F', '#0', `${L('tT')}-${L('dsel')}`);
  },
  emit(ctx) {
    const { L, P, core, span } = ctx, probe = L('probe');
    const exits = [['JMP', L('decide'), '$0'], ['JMP', L('dec'), '$0'], ['JMP', L('dec'), `<${L('dsel')}`], ['JMP', L('dec'), `>${L('dsel')}`],
      ['DJN', L('dec'), L('tT')], ['DJN', L('dec'), probe], ['JMP', L('decX'), '$0'], ['JMP', L('decX'), `<${L('dsel')}`],
      ['JMP', L('decX'), `>${L('dsel')}`], ['DJN', L('decX'), L('tT')]];
    qiFactors(P, core).forEach(([a, b], k) => {
      ctx.ins(k ? '' : 'qScan', 'SNE', 'I', `${probe}+${a}`, `${probe}+${b}`);
      ctx.ins('', 'SEQ', 'I', `${probe}+${mod(a + P.STEP, core)}`, `${probe}+${mod(b + P.STEP, core)}`);
      const [op, to, side] = exits[k];
      ctx.ins('', op, op === 'DJN' ? 'F' : 'B', to, side);
    });
    ctx.ins('', 'MOV', 'AB', `#${span}`, probe);                        // nothing found: the image boundary
    ctx.ins('', 'JMP', 'B', ctx.next);
    ctx.ins('decX', 'MUL', 'X', `@${L('dsel')}`, `@${L('dsel')}`);       // (x, y) -> (x*y, y*x)
    ctx.ins('dec', 'MUL', 'F', `@${L('dsel')}`, probe);                  // probe = both locations
    ctx.ins('decide', 'SNE', 'I', `*${probe}`, `@${probe}`);             // first pair differs?
    ctx.ins('', 'ADD', 'F', L('qinc'), probe);                           //   no: the second pair
    ctx.ins('', 'JMZ', 'F', ctx.next, `*${probe}`);                      // A cell empty: B is the hit
    ctx.ins('', 'MOV', 'X', probe, probe);                               // otherwise point B at A's cell
    ctx.ins('', 'JMP', 'B', ctx.next);
  },
  plant(api) { return [[api.at('probe') + qiWant(api.P, api.core), MARKER]]; },
  watch(api) {
    const planted = api.scenario === 'opening-qscan-qi: planted target';
    const want = qiWant(api.P, api.core);
    const seesSelf = qiCells(api.P, api.core).some((c) => api.inImage(api.at('probe') + c));
    const exit = onExit(api, (b) => {
      if (planted && b !== want && !api.inImage(api.at('probe') + b)) throw new Error(`The q^i quickscan handed on ${b}, not the planted cell ${want}`);
      if (api.scenario === 'alone' && !seesSelf && !atBoundary(api, b)) throw new Error(`The q^i quickscan found nothing but did not hand on the image boundary (handed on ${b})`);
    });
    return { before: exit.before, final: () => { if (planted && !exit.exited()) throw new Error('The q^i quickscan never handed on'); } };
  },
};


// ---------------------------------------------------------------------------
// The SPL-then-DAT clear both vampires fall into once a prisoner has arrived:
// a SPL lap of every cell outside the protected span, then DATs for ever, and
// at the end of the first lap the pit is DATted so its prisoners die. Lines
// come in two runs of four, each ending in a jump, so the airbag vampire can
// lay them out between its padding cells.
const clearRuns = (ctx) => {
  const { L, span, core } = ctx;
  return [
    [['clr', 'MOV', 'I', L('cBomb'), `>${L('cPtr')}`], ['', 'DJN', 'B', L('clr'), L('cCnt')], ['', 'ADD', 'AB', `#${span}`, L('cPtr')], ['', 'JMP', 'B', L('clrB')]],
    [['clrB', 'MOV', 'AB', `#${core - span}`, L('cCnt')], ['', 'MOV', 'I', L('cDat'), L('cBomb')], ['', 'MOV', 'I', L('cDat'), L('vPit')], ['', 'JMP', 'B', L('clr')]],
  ];
};
// Its data cells (cPtr's first write lands just past the protected span).
const clearData = (ctx) => [
  () => ctx.ins('cPtr', 'DAT', 'F', '#0', `#${ctx.span - ctx.pc()}`),
  () => ctx.ins('cCnt', 'DAT', 'F', '#0', `#${ctx.core - ctx.span}`),
  () => ctx.ins('cBomb', 'SPL', 'B', '#0', '#0'),
  () => ctx.ins('cDat', 'DAT', 'F', '#0', '#0'),
];
const clearMutable = [['cPtr', ['b']], ['cCnt', ['b']], ['cBomb', ['a', 'b']], ['vPit', ['a', 'b']]];
// The clear has started once its counter moved or its bomb became a DAT.
const clearStarted = (api, vm) => vm.peek(api.at('cCnt')).b !== api.code('cCnt').b || vm.peek(api.at('cBomb')).op === 'DAT';

// The mechanism with a real prisoner: a fresh round against a one-cell loop
// placed on `cell`. The vampire must catch it, switch to its clear and win,
// with the `keep` lines of its code as loaded.
function prisonerDuel(api, name, cell, keep, bomb = null) {
  const d = api.duel('victim jmp 0, 1\n', { offset: api.norm(cell - api.image.start) });
  if (!d.ours) throw new Error(`${name} died against a lone loop`);
  if (d.theirs) throw new Error(`${name}'s pit did not finish its prisoner`);
  // A DJN bomb may finish the victim before the scan reaches it: no prisoner then, but it must be the bomb.
  if (!clearStarted(api, d.vm) && !(bomb && api.same(d.vm.peek(cell), api.code(bomb)))) throw new Error(`${name} never switched to its clear`);
  for (const [label, k] of keep) if (!api.same(d.vm.peek(api.at(label, k)), api.code(label, k))) throw new Error(`${name}'s code was damaged in the prisoner duel`);
}

// ---------------------------------------------------------------------------
// airbag-vampire
//
// The airbag loop of Unpit (P. Kline) and One bite (inversed): one 4-line
// vampire loop run by three processes at once, so a stray hit that kills one
// leaves two still throwing. The launch rewrites the loop's last line:
//
//   vGo   spl  vJ              ; 2 processes
//         spl  vJ              ; 3, all at vJ
//   vJ    jmp  {vChk           ; each: vChk.A -1, -2, -3; jump to vChk + that
//   vLoop add.f inc, fang      ; i0
//         mov.i fang, @fang    ; i1  throw the fang
//         jmn.b vOut, pit      ; i2  a prisoner? leave
//   vChk  jmp  $0              ; i3  becomes jmp -3 = vLoop
//
// so the three enter at i2, i1 and i0, staggered, and the loop closes on
// vLoop. The fang is fang-vampire's dual-field JMP: `add.f inc` moves A down
// and B up by STEP, so A + B stays on the pit and every copy thrown at fang+B
// jumps into it. With three processes a check before a throw is always stale
// (the other two run the other lines in between), so the throws carry no
// check: STEP and the first B are a multiple of G plus 1, and every cell of
// this block G*k + 1 past the fang is padding. The throws land only there,
// on the openings that ran before it (finished by then), or outside the
// warrior: a lattice of core/G cells, Dwarf's trick. The pit is a leaky DJN
// (One bite's): a prisoner loops on it, counting its B down, and falls out
// onto a DAT a lap later. When pit.B moves the three processes leave; a
// ticket lets the first into the SPL/DAT clear and sends the others onto a DAT.

const airbagThrows = (api, k) => api.norm(api.at('vFang') + api.code('vFang').b + k * api.P.STEP);

const airbagVampire = {
  id: 'airbag-vampire',
  kind: 'body', exit: 'never', processes: 3, writes: 'core', roams: false, dialects: '94', entryFirst: false,
  purpose: 'Blind vampire whose 4-line loop is run by 3 staggered processes (a launch that predecrements the loop\'s closing JMP): a dual-field fang (A + B on the pit) is thrown every pass at a lattice of core/G cells that misses the block\'s own code (its padding takes the hits); a prisoner in the leaky DJN pit sends one process into a SPL/DAT clear and the other two onto a DAT.',
  params: { STEP: [5, 27720], G: [5, 10] },
  defaults: { STEP: 2395, G: 5 },
  entry: 'vGo', loop: 'vLoop',
  mutable: [['vFang', ['a', 'b']], ['vChk', ['a']], ['vTick', ['b']], ...clearMutable],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (core % P.G) out.push(`airbag-vampire: G ${P.G} does not divide the core, so the throws leave their lattice`);
    if (P.STEP % P.G) out.push(`airbag-vampire: STEP ${P.STEP} is not a multiple of G ${P.G}, so the throws would hit the vampire`);
    const reach = core / gcd(P.STEP, core);
    if (reach < 1000) out.push(`airbag-vampire: STEP ${P.STEP} throws at only ${reach} cells`);
    return out;
  },
  emit(ctx) {
    const { L, P, span } = ctx, G = P.G;
    const fangPc = ctx.pc(), off = () => ctx.pc() - fangPc;
    // The first throw (after one ADD) lands just past the protected span, on the lattice.
    const b1 = span - fangPc + mod(1 - (span - fangPc), G), b0 = b1 - P.STEP;
    ctx.ins('vFang', 'JMP', 'B', `${L('vPit')}-(${b0})`, `${b0}`);
    const data = [
      () => ctx.ins('vInc', 'DAT', 'F', `#${-P.STEP}`, `#${P.STEP}`),
      () => ctx.ins('vTick', 'DAT', 'F', '#0', '#1'),
      ...clearData(ctx),
    ];
    // Each run of code starts just after a padding cell, so none has padding
    // inside it (runs are at most four lines and G >= 5). Data fills the gaps.
    const run = (lines) => {
      while (mod(off(), G) !== 2) { if (mod(off(), G) !== 1 && data.length) data.shift()(); else ctx.ins('', 'DAT', 'F', '#0', '#0'); }
      for (const l of lines) ctx.ins(...l);
    };
    run([['vGo', 'SPL', 'B', L('vJ')], ['', 'SPL', 'B', L('vJ')], ['vJ', 'JMP', 'B', `{${L('vChk')}`]]);
    run([['vLoop', 'ADD', 'F', L('vInc'), L('vFang')], ['', 'MOV', 'I', L('vFang'), `@${L('vFang')}`], ['', 'JMN', 'B', L('vOut'), L('vPit')], ['vChk', 'JMP', 'B', '$0']]);
    run([['vOut', 'DJN', 'B', L('cDat'), L('vTick')], ['', 'JMP', 'B', L('clr')]]);   // the first out clears; the rest die
    for (const r of clearRuns(ctx)) run(r);
    run([['vPit', 'DJN', 'B', '$0', '#0'], ['', 'DAT', 'F', '#0', '#0']]);            // loop a lap, then fall out and die
    while (data.length) { if (mod(off(), G) === 1) ctx.ins('', 'DAT', 'F', '#0', '#0'); else data.shift()(); }
  },
  watch(api) {
    const { vm, P } = api, fang = api.at('vFang'), pit = api.at('vPit'), throwAt = api.at('vLoop', 1);
    const loop = [0, 1, 2, 3].map((k) => api.at('vLoop', k));
    let throws = 0, staggered = null, cleared = false;
    return {
      before(pc) {
        if (pc === api.at('clr')) cleared = true;
        if (staggered === null && api.entered() && vm.cycle > 60 && !cleared) {
          const ps = vm.processes(0).filter((q) => loop.includes(q));
          staggered = ps.length === 3 && new Set(ps).size === 3;
        }
        if (pc === throwAt && api.same(vm.peek(pc), api.code('vLoop', 1))) return api.norm(fang + vm.peek(fang).b);
        return null;
      },
      after(t) {
        if (t === null) return;
        if (api.inSelf(t) && mod(t - fang, api.core) % P.G !== 1) throw new Error('airbag-vampire threw a fang onto its own code');
        if (api.inImage(t) && !api.inSelf(t) && !api.inDead(t) && !api.sole()) throw new Error('airbag-vampire threw a fang into a block that is still running');
        const f = vm.peek(t);
        if (f.op !== 'JMP' || api.norm(t + f.a) !== pit) throw new Error('An airbag-vampire fang does not lead to its pit');
        throws++;
      },
      final() {
        if (!api.alone) return;
        if (!staggered) throw new Error('airbag-vampire\'s loop is not run by three staggered processes');
        if (throws < 1000) throw new Error(`airbag-vampire threw too few fangs (${throws})`);
        if (cleared) throw new Error('airbag-vampire switched to its clear with no prisoner');
        if (api.image.start !== 0) return;
        let k = 40, cell = airbagThrows(api, k);
        while (api.inImage(cell) || api.inImage(cell + 1) || api.inImage(cell - 1)) cell = airbagThrows(api, ++k);
        prisonerDuel(api, 'airbag-vampire', cell, [['vLoop', 0], ['vLoop', 1], ['vLoop', 2], ['vGo', 0]]);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// djn-vampire
//
// fang-vampire's scan and bite with a second throw in the loop: the DJN.F
// bombs Forgotten Lore II (David Moore) throws beside its fangs, meant for the
// self-splitting loops of stones and clears (an enemy process that runs
// `djn.f $0, $1` loops in place, decrementing the next cell until both its
// fields are zero). Carmilla (inversed) keeps a process on a DJN line for a
// similar reason.
//
//   vLoop add.f inc, fang       ; A down, B up: A + B stays on the pit
//         slt.b fang, lim       ; B < span: the throw would land on us, skip it
//         mov.i djn, *fang      ; throw a DJN.F bomb at fang + A
//   vLook jmz.f vLoop, @fang    ; scan fang + B
//
// The throw lands at fang + A = pit - B. The pit is the block's last cell, so
// the last cell of the protected span, and pit - B is inside the span exactly
// when B < span: one SLT guards it. (The block must end what it protects, as a
// body at the end of a seq or of a boot's member does; the gate refuses a tree
// where the throws reach the warrior.) A pass is four cycles: a .25c scan and
// a .25c bomber. A find outside the warrior is bitten with the fang; the pit
// is a leaky DJN, and a prisoner there sends it into the SPL/DAT clear.

const djnScanCell = (api, k) => api.norm(api.at('vFang') + api.code('vFang').b + k * api.P.STEP);

const djnVampire = {
  id: 'djn-vampire',
  kind: 'body', exit: 'never', processes: 1, writes: 'core', roams: false, dialects: '94',
  purpose: 'Scanning vampire that also throws DJN.F bombs: each pass steps a dual-field fang (A + B on the pit), throws `djn.f $0, $1` at fang + A (one SLT guards it, since the pit is the last protected cell) and scans fang + B; a find outside the warrior is bitten, and a prisoner in the leaky DJN pit switches it to a SPL/DAT clear.',
  params: { STEP: [1, 27719] },
  defaults: { STEP: 2341 },
  entry: 'vLoop', loop: 'vLoop',
  mutable: [['vFang', ['a', 'b']], ...clearMutable],
  mismatches(P, settings) {
    const reach = settings.coreSize / gcd(P.STEP, settings.coreSize);
    return reach < 1000 ? [`djn-vampire: STEP ${P.STEP} scans only ${reach} cells of the core`] : [];
  },
  emit(ctx) {
    const { L, P, span, core } = ctx;
    const iF = (here) => `(${here}+${L('vFang')})`;                    // label arithmetic: the fang's index
    ctx.ins('vLoop', 'ADD', 'F', L('vInc'), L('vFang'));
    ctx.ins('', 'SLT', 'B', L('vFang'), L('vLim'));                     // the throw would land on us: skip it
    ctx.ins('vThrow', 'MOV', 'I', L('vDjn'), `*${L('vFang')}`);
    ctx.ins('vLook', 'JMZ', 'F', L('vLoop'), `@${L('vFang')}`);
    // Found something: skip the protected span, as fang-vampire does. Finding
    // our own cells (about once a thousand cycles) also looks at the pit, so a
    // prisoner is noticed before the leaky pit lets it go, even with nothing to bite.
    ctx.ins('', 'SLT', 'AB', `#(${span - 1}-${iF(ctx.pc())})`, L('vFang'));
    ctx.ins('', 'JMP', 'B', L('vCheck'));
    ctx.ins('', 'SLT', 'AB', `#(${core - 1}-${iF(ctx.pc())})`, L('vFang'));
    ctx.ins('', 'JMP', 'B', L('vBite'));
    ctx.ins('', 'JMP', 'B', L('vCheck'));
    ctx.ins('vBite', 'MOV', 'I', L('vFang'), `@${L('vFang')}`);
    ctx.ins('vCheck', 'JMZ', 'B', L('vLoop'), L('vPit'));               // no prisoner yet: scan on
    for (const r of clearRuns(ctx)) for (const l of r) ctx.ins(...l);
    for (const d of clearData(ctx)) d();
    ctx.ins('vInc', 'DAT', 'F', `#${-P.STEP}`, `#${P.STEP}`);
    ctx.ins('vLim', 'DAT', 'F', '#0', `#${span}`);
    ctx.ins('vDjn', 'DJN', 'F', '$0', '$1');
    const b0 = `(${span - P.STEP}-${ctx.pc()})`;                        // the first look: just past the span
    ctx.ins('vFang', 'JMP', 'B', `${L('vPit')}-${b0}`, b0);
    ctx.ins('vPit', 'DJN', 'B', '$0', '#0');                            // last cell: prisoners loop, then fall out
  },
  watch(api) {
    const { vm } = api, fang = api.at('vFang'), pit = api.at('vPit');
    let throws = 0, cleared = false;
    return {
      before(pc) {
        if (pc === api.at('clr')) cleared = true;
        if (pc === api.at('vThrow') && api.same(vm.peek(pc), api.code('vThrow'))) return { djn: api.norm(fang + vm.peek(fang).a) };
        if (pc === api.at('vBite') && api.same(vm.peek(pc), api.code('vBite'))) return { bite: api.norm(fang + vm.peek(fang).b) };
        return null;
      },
      after(t) {
        if (!t) return;
        if (t.djn !== undefined) {
          if (api.inImage(t.djn) && !api.inDead(t.djn)) throw new Error('djn-vampire threw a DJN bomb onto its own warrior');
          if (!api.same(vm.peek(t.djn), api.code('vDjn'))) throw new Error('djn-vampire threw something other than its DJN bomb');
          throws++;
          return;
        }
        if (api.inImage(t.bite) && !api.inDead(t.bite)) throw new Error('djn-vampire bit its own warrior');
        const f = vm.peek(t.bite);
        if (f.op !== 'JMP' || api.norm(t.bite + f.a) !== pit) throw new Error('A djn-vampire fang does not lead to its pit');
      },
      final() {
        if (!api.alone) return;
        if (cleared) throw new Error('djn-vampire switched to its clear with no prisoner');
        if (throws < 1000) throw new Error(`djn-vampire threw too few DJN bombs (${throws})`);
        if (api.image.start !== 0) return;
        let k = 40, cell = djnScanCell(api, k);
        while (api.inImage(cell) || api.inImage(cell + 1) || api.inImage(cell - 1)) cell = djnScanCell(api, ++k);
        prisonerDuel(api, 'djn-vampire', cell, [['vLoop', 0], ['vLoop', 1], ['vThrow', 0], ['vLook', 0], ['vBite', 0]], 'vDjn');
      },
    };
  },
};

export default [qscanMul45, qscanQi, airbagVampire, djnVampire];
export { m45Cells, qiCells };
