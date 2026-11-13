// opening-qscan-qbob: a two-MUL decoding quickscan, the idea of the qBob scan
// in The Art of CoreWar (docs/hill-top30/94nop.md): table cells with two
// fields, so one cell serves two units, the second at the price of a second
// MUL. The hill warrior was studied for the idea only; this code is written
// from scratch on the same algebra as opening-qscan-mul. Ring, '94.
//
// Table cell t_k sits d_k = k + 1 past the probe and holds (QF2, X_k) with
// X_k = 1 + QFAC * d_k. QDEC = 1 + QFAC^-1, so QDEC * QFAC = QFAC + 1.
//
// Row 1, UNITS units of three lines, four cells each (as opening-qscan-mul):
//
//   sne  probe+B_k+QDEC, probe+B_k+QDEC+GAP   location A_k = QDEC * X_k
//   seq  <t_k, probe+B_k+GAP                  location B_k = QDEC * (X_k - 1) = d_k * (1 + QFAC)
//   jmp  dec_g, {sel / $0 / }sel              (the SEQ's <t_k leaves X_k - 1 in the table)
//
// Row 2, UNITS2 units of two lines, two cells each, on the same table cells.
// By now every entry holds X_k - 1, and the cell's other field multiplies it:
//
//   seq  probe+C_k, probe+C_k+GAP             location C_k = QF2 * B_k
//   jmp  two_g, {sel / $0 / }sel
//
// Decoder: a ladder walks `sel` to the unit's table cell (units come in
// threes around a middle cell, as the JMPs' side effects say). A row-2 hit
// first runs MUL.AB *sel, *sel (the entry becomes QF2 * (X_k - 1)); then both
// rows share MOV #QDEC / MUL.B *sel: the probe is the location, and a JMN
// picks the occupied cell of the pair. One MUL for row 1, two for row 2.
// No hit leaves the probe at the image boundary.
//
// 4 * UNITS + 2 * UNITS2 cells in 3 * UNITS + 2 * UNITS2 scan lines, a table
// of UNITS cells and about eight decoder lines: 36 cells in 48 instructions
// with the defaults (6 and 6). The table stays in the block's own state
// cells: it is not offered to a fan boot's free B-fields.
import { modInverse } from '../util.js';

const mod = (x, n) => ((x % n) + n) % n;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const MARKER = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };

// Every location, as offsets from the probe: row 1 gives A_k and B_k, row 2 C_k.
function locations(P, core) {
  const dec = mod(1 + modInverse(P.QFAC, core), core), out = [];
  for (let k = 0; k < P.UNITS; k++) {
    const b = mod((k + 1) * (1 + P.QFAC), core);
    out.push({ row: 1, k, a: mod(b + dec, core), b, c: mod(P.QF2 * b, core) });
  }
  return out;
}
function cells(P, core) {
  const out = [];
  for (const u of locations(P, core)) {
    out.push(u.a, mod(u.a + P.GAP, core), u.b, mod(u.b + P.GAP, core));
    if (u.k < P.UNITS2) out.push(u.c, mod(u.c + P.GAP, core));
  }
  return out;
}
// The cell the gate plants on: the second cell of a middle row-2 unit (both MULs, the ladder and the pair choice run).
const plantedCell = (P, core) => mod(locations(P, core)[Math.floor(P.UNITS2 / 2)].c + P.GAP, core);

const qbob = {
  id: 'opening-qscan-qbob',
  kind: 'opening', exit: 'next', processes: 1, writes: 'sparse', link: 'fall', dialects: '94',
  purpose: 'Two-MUL decoding quickscan (the qBob idea): UNITS units of three lines test four cells each from table entries, as opening-qscan-mul does, then UNITS2 units of two lines test one more pair each from the same table cells, whose second field QF2 multiplies the entry. A hit in the first row is decoded with one MUL, in the second with two (MUL.AB on the table cell, then the shared MUL); a JMN picks the occupied cell of the pair and hands it on, or the image boundary. 4*UNITS + 2*UNITS2 cells; 36 cells in 48 instructions by default.',
  params: { QFAC: [1, 54000], QF2: [2, 54000], GAP: [1, 2000], UNITS: [3, 9], UNITS2: [1, 9] },
  defaults: { QFAC: 349, QF2: 3911, GAP: 197, UNITS: 6, UNITS2: 6 },
  entry: 'qbScan',
  provides: { probe: 'probe' },
  mutable: (P) => [['probe', ['a', 'b']], ['sel', ['a']], ...Array.from({ length: P.UNITS }, (_, k) => [`t${k}`, ['b']])],
  mismatches(P, settings) {
    const core = settings.coreSize, room = settings.maxLength, out = [];
    if (gcd(P.QFAC, core) !== 1) return [`opening-qscan-qbob: QFAC ${P.QFAC} has no inverse mod ${core}, so a hit can't be decoded`];
    if (P.UNITS2 > P.UNITS) out.push('opening-qscan-qbob: UNITS2 cannot exceed UNITS (the second row reuses the first row\'s table cells)');
    const all = cells(P, core);
    if (all.some((c) => c <= room || c >= core - room)) out.push('opening-qscan-qbob: a probe lands on or next to the warrior itself');
    if (new Set(all).size < all.length) out.push('opening-qscan-qbob: two probes test the same cell');
    return out;
  },
  // The probe and the table are state cells, laid out before all code, so every location is fixed.
  state(ctx) {
    const { L, P } = ctx;
    ctx.ins('probe', 'DAT', 'F', '#0', `#${ctx.span}`);
    for (let k = 0; k < P.UNITS; k++) ctx.ins(`t${k}`, 'DAT', 'F', `#${P.QF2}`, `#1-${P.QFAC}*(${L('probe')})`);
  },
  emit(ctx) {
    const { L, P, core } = ctx, probe = L('probe');
    const dec = mod(1 + modInverse(P.QFAC, core), core);
    const t = (k) => L(`t${k}`), loc = (k) => `(${t(k)}-${probe})*${1 + P.QFAC}`;       // location B, as label arithmetic
    const groups = (n) => Math.ceil(n / 3);
    const mid = (g, n) => (3 * g + 1 < n ? t(3 * g + 1) : `${t(3 * g)}+1`);             // where sel.A points for group g
    const side = (r) => (r === 0 ? `{${L('sel')}` : r === 2 ? `}${L('sel')}` : '$0');
    const u = locations(P, core);
    for (let k = 0; k < P.UNITS; k++) {
      ctx.ins(k ? '' : 'qbScan', 'SNE', 'I', `${probe}+${loc(k)}+${dec}`, `${probe}+${loc(k)}+${dec + P.GAP}`);
      ctx.ins('', 'SEQ', 'I', `<${t(k)}`, `${probe}+${loc(k)}+${P.GAP}`);
      ctx.ins('', 'JMP', 'B', L(`dec${Math.floor(k / 3)}`), side(k % 3));
    }
    for (let k = 0; k < P.UNITS2; k++) {
      ctx.ins('', 'SEQ', 'I', `${probe}+${u[k].c}`, `${probe}+${mod(u[k].c + P.GAP, core)}`);
      ctx.ins('', 'JMP', 'B', L(`two${Math.floor(k / 3)}`), side(k % 3));
    }
    ctx.ins('', 'JMP', 'B', ctx.next);                         // nothing found: the probe stays at the boundary
    // Row 1's ladder: entering at dec_g walks sel.A down to group g, then on to the shared decoder.
    const g1 = groups(P.UNITS), g2 = groups(P.UNITS2);
    for (let g = g1 - 1; g >= 1; g--) ctx.ins(`dec${g}`, 'ADD', 'A', `#${mid(g, P.UNITS)}-${mid(g - 1, P.UNITS)}`, L('sel'));
    if (g1 > 1) ctx.ins('', 'JMP', 'B', L('dec0'));
    // Row 2's ladder, then its own MUL: the entry times the table cell's other field.
    for (let g = g2 - 1; g >= 1; g--) ctx.ins(`two${g}`, 'ADD', 'A', `#${mid(g, P.UNITS)}-${mid(g - 1, P.UNITS)}`, L('sel'));
    ctx.ins('two0', 'MUL', 'AB', `*${L('sel')}`, `*${L('sel')}`);
    ctx.ins('dec0', 'MOV', 'AB', `#${dec}`, probe);
    ctx.ins('', 'MUL', 'B', `*${L('sel')}`, probe);            // probe.B = QDEC * entry = the location
    ctx.ins('', 'JMN', 'F', ctx.next, `@${probe}`);            // first cell occupied: hand it on
    ctx.ins('', 'ADD', 'AB', `#${P.GAP}`, probe);              // otherwise it is the second
    ctx.ins('', 'JMP', 'B', ctx.next);
    ctx.ins('sel', 'DAT', 'F', `${mid(0, P.UNITS)}-${L('sel')}`, '#0');
  },
  plant: (api) => [[api.at('probe') + plantedCell(api.P, api.core), MARKER]],
  watch(api) {
    const planted = api.scenario === 'opening-qscan-qbob: planted target', want = plantedCell(api.P, api.core);
    const seesSelf = cells(api.P, api.core).some((c) => api.inImage(api.at('probe') + c));
    let prevInSelf = false, exited = false, muls = 0;
    return {
      before(pc) {
        if (api.inSelf(pc) && api.vm.peek(pc).op === 'MUL') muls++;
        if (prevInSelf && !api.inSelf(pc) && !exited && !api.vm.processes(0).some((q) => api.inSelf(q))) {
          exited = true;
          const b = api.vm.peek(api.at('probe')).b;
          if (planted && !api.inImage(api.at('probe') + b)) {
            if (b !== want) throw new Error(`opening-qscan-qbob handed on ${b}, not the planted cell ${want}`);
            if (muls !== 2) throw new Error(`opening-qscan-qbob decoded a second-row hit with ${muls} MUL${muls === 1 ? '' : 's'}, not two`);
          }
          if (api.scenario === 'alone' && !seesSelf) {
            if (!(api.inImage(api.at('probe') + b - 1) && !api.inImage(api.at('probe') + b))) throw new Error(`opening-qscan-qbob found nothing but did not hand on the image boundary (handed on ${b})`);
            if (muls) throw new Error('opening-qscan-qbob ran its decoder with nothing to find');
          }
        }
        prevInSelf = api.inSelf(pc);
        return null;
      },
      final() { if (planted && !exited) throw new Error('opening-qscan-qbob never handed on'); },
    };
  },
};

export default qbob;
