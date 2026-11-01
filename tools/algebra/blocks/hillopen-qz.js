// A q^4.5 quickscan: the qz-mutation of the Hullabaloo/Halcyon/Elven King
// family (docs/hill-recipe-book.md, openings chapter, mechanism 2). It is the
// MUL-decoding quickscan (opening-qscan-mul, hillopen.js) with one extra idea:
// a second group of units reuses the first group's table cells with a second
// multiplier, so the same cells test more locations.
//
// A table cell t_k holds X_k = 1 + QFAC*(t_k-probe); with QDEC = 1 + QFAC^-1
// (mod core) we have probe + QDEC*(X_k-1) = t_k + X_k - 1, so `<t_k` both
// decrements the entry to X_k-1 and lands on that location. The multiplier is
// held live in `mult`.B (= QDEC), not baked into the decoder.
//
//   GROUP 1 (UNITS units, three instructions each, exactly as the MUL block):
//     sne.i probe+B+QDEC, probe+B+QDEC+GAP   ; location A = QDEC*X_k  (pair)
//     seq.i <t_k,         probe+B+GAP        ; location B = QDEC*(X_k-1); <t_k --
//     jmp.b dec_g,        {sel / $0 / }sel   ; on a hit pick t_k, decode
//   where B = (t_k-probe)*(1+QFAC). A complete miss runs the SEQ, so by the
//   end of group 1 every t_k is at X_k-1.
//
//   THE QZ-MUTATION, on the fall-through path between the groups:
//     add.ab #1, mult                        ; mult.B: QDEC -> QDEC+1
//
//   GROUP 2 (UNITS units, two instructions each, reusing t_0..t_{UNITS-1}):
//     seq.i probe+A2,     probe+A2+GAP       ; location A2 = (QDEC+1)*(X_k-1)
//     jmp.b dec_g,        {sel / $0 / }sel   ;   = (t_k-probe)*(1+2*QFAC) (pair)
//
// Because the increment sits physically between the groups, a group-1 hit
// reaches the decoder with mult.B = QDEC and a group-2 hit with mult.B = QDEC+1,
// so the shared decoder (`mov.b mult,probe` / `mul.b *sel,probe`) rebuilds the
// right location either way: QDEC*X_k, QDEC*(X_k-1), or (QDEC+1)*(X_k-1). A JMN
// picks the occupied cell of the pair. UNITS cells thus test 3*UNITS locations
// (the MUL block tests 2 per cell), the density the family calls q^4.5. No hit
// leaves the probe at the image boundary. All Redcode here is written from
// scratch.

import { modInverse } from '../util.js';

const MARKER = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };
const mod = (x, core) => ((x % core) + core) % core;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

// Group-1 locations A and B, and group-2 location A2, for every unit, relative
// to the probe. t_k is the (k+1)th state cell, so d_k = k+1.
const qzCells = (P, core) => {
  const dec = mod(1 + modInverse(P.QFAC, core), core), out = [];
  for (let k = 0; k < P.UNITS; k++) {
    const d = k + 1;
    const b = mod(d * (1 + P.QFAC), core);          // location B (group 1 SEQ)
    const a = mod(b + dec, core);                   // location A (group 1 SNE)
    const a2 = mod(d * (1 + 2 * P.QFAC), core);      // location A2 (group 2 SEQ)
    out.push(a, mod(a + P.GAP, core), b, mod(b + P.GAP, core), a2, mod(a2 + P.GAP, core));
  }
  return out;
};
const problems = (P, settings) => {
  const core = settings.coreSize, room = settings.maxLength, out = [];
  if (gcd(P.QFAC, core) !== 1) return [`QFAC ${P.QFAC} has no inverse mod ${core}, so a hit can't be decoded`];
  const cells = qzCells(P, core);
  if (cells.some((c) => c <= room || c >= core - room)) out.push('a qz quickscan probe lands on or next to the warrior itself');
  if (new Set(cells).size < cells.length) out.push('two qz quickscan probes test the same cell');
  return out;
};

// Exit watcher, as hillopen.js: fire when the last process leaves the warrior.
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

const qscanQz = {
  id: 'opening-qscan-qz',
  kind: 'opening', exit: 'next', processes: 1, writes: 'sparse', link: 'fall', dialects: '94',
  purpose: 'q^4.5 MUL-decoding quickscan: UNITS units test two pair locations each with multiplier QDEC (and decrement a table entry), then one ADD bumps a live multiplier to QDEC+1 and UNITS more units reuse the same table cells to test a third location each; a shared one-MUL decoder hands on the occupied cell, or the image boundary.',
  params: { QFAC: [1, 54000], GAP: [1, 2000], UNITS: [4, 12] },
  defaults: { QFAC: 349, GAP: 197, UNITS: 6 },
  entry: 'qScan',
  provides: { probe: 'probe' },
  mutable: (P) => [['probe', ['a', 'b']], ['sel', ['a']], ['mult', ['b']], ...Array.from({ length: P.UNITS }, (_, k) => [`t${k}`, ['b']])],
  mismatches(P, settings) { return problems(P, settings); },
  // The probe and the whole table are state cells, laid out before all code, so
  // d_k = k+1 and every scan location is fixed whatever the rest of the warrior.
  state(ctx) {
    const { L, P } = ctx;
    ctx.ins('probe', 'DAT', 'F', '#0', `#${ctx.span}`);
    for (let k = 0; k < P.UNITS; k++) ctx.ins(`t${k}`, 'DAT', 'F', '#0', `#1-${P.QFAC}*(${L('probe')})`);
  },
  emit(ctx) {
    const { L, P, core } = ctx, probe = L('probe');
    const qdec = mod(1 + modInverse(P.QFAC, core), core), groups = Math.ceil(P.UNITS / 3);
    const t = (k) => L(`t${k}`);
    const locB = (k) => `(${t(k)}-${probe})*${1 + P.QFAC}`;       // location B, label arithmetic
    const locA2 = (k) => `(${t(k)}-${probe})*${1 + 2 * P.QFAC}`;   // location A2 = (QDEC+1)*(X_k-1)
    const mid = (g) => (3 * g + 1 < P.UNITS ? t(3 * g + 1) : `${t(3 * g)}+1`);  // where sel.A points for group g
    const nudge = (k) => (k % 3 === 0 ? `{${L('sel')}` : k % 3 === 2 ? `}${L('sel')}` : '$0');
    // Group 1: the standard MUL units (location A by SNE, location B by SEQ).
    for (let k = 0; k < P.UNITS; k++) {
      ctx.ins(k ? '' : 'qScan', 'SNE', 'I', `${probe}+${locB(k)}+${qdec}`, `${probe}+${locB(k)}+${qdec + P.GAP}`);
      ctx.ins('', 'SEQ', 'I', `<${t(k)}`, `${probe}+${locB(k)}+${P.GAP}`);
      ctx.ins('', 'JMP', 'B', L(`dec${Math.floor(k / 3)}`), nudge(k));
    }
    // The qz-mutation: by now every t_k is X_k-1, so bump the live multiplier.
    ctx.ins('', 'ADD', 'AB', '#1', L('mult'));
    // Group 2: reuse the same table cells with multiplier QDEC+1.
    for (let k = 0; k < P.UNITS; k++) {
      ctx.ins('', 'SEQ', 'I', `${probe}+${locA2(k)}`, `${probe}+${locA2(k)}+${P.GAP}`);
      ctx.ins('', 'JMP', 'B', L(`dec${Math.floor(k / 3)}`), nudge(k));
    }
    ctx.ins('', 'JMP', 'B', ctx.next);                   // nothing found: probe stays at the boundary
    // Ladder: entering at dec_g walks sel.A from the first three down to group g.
    for (let g = groups - 1; g >= 1; g--) ctx.ins(`dec${g}`, 'ADD', 'A', `#${mid(g)}-${mid(g - 1)}`, L('sel'));
    ctx.ins('dec0', 'MOV', 'B', L('mult'), probe);       // probe.B = live multiplier (QDEC or QDEC+1)
    ctx.ins('', 'MUL', 'B', `*${L('sel')}`, probe);      // probe.B = multiplier * entry = the location
    ctx.ins('', 'JMN', 'F', ctx.next, `@${probe}`);      // first cell occupied: hand it on
    ctx.ins('', 'ADD', 'AB', `#${P.GAP}`, probe);        // otherwise it is the second
    ctx.ins('', 'JMP', 'B', ctx.next);
    ctx.ins('sel', 'DAT', 'F', `${mid(0)}-${L('sel')}`, '#0');
    ctx.ins('mult', 'DAT', 'F', '#0', `#${qdec}`);
  },
  // Plant on the first cell of a middle group-2 unit's pair, so the group-1
  // fall-through, the qz-mutation and the group-2 decode all run.
  plant(api) {
    const k = Math.floor(api.P.UNITS / 2), a2 = mod((k + 1) * (1 + 2 * api.P.QFAC), api.core);
    return [[api.at('probe') + a2, MARKER]];
  },
  watch(api) {
    const planted = api.scenario === 'opening-qscan-qz: planted target';
    const k = Math.floor(api.P.UNITS / 2), want = mod((k + 1) * (1 + 2 * api.P.QFAC), api.core);
    const seesSelf = qzCells(api.P, api.core).some((c) => api.inImage(api.at('probe') + c));
    const exit = onExit(api, (b) => {
      if (planted && b !== want && !api.inImage(api.at('probe') + b)) throw new Error(`The qz quickscan handed on ${b}, not the planted cell ${want}`);
      if (api.scenario === 'alone' && !seesSelf && !atBoundary(api, b)) throw new Error(`The qz quickscan found nothing but did not hand on the image boundary (handed on ${b}, image ${api.total})`);
    });
    return { before: exit.before, final: () => { if (planted && !exit.exited()) throw new Error('The qz quickscan never handed on'); } };
  },
};

export default qscanQz;
