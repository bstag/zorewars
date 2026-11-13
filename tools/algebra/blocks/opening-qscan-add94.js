// opening-qscan-add94: an additive quickscan with no table. The idea is the
// one behind luca's "Q3.14" scan (docs/hill-top30/94nop.md): the decoder works
// out which scan line fired and reads the address back from that line's own
// operand. The hill warrior was studied for the idea only; this code is
// written from scratch. Ring, '94.
//
// UNITS units of three lines, four cells each, on a regular grid:
//
//   sne  probe+X_k,      probe+X_k+GAP          X_k = START + k * SPACING
//   seq  probe+X_k+HALF, probe+X_k+HALF+GAP
//   jmp  dec_g, {sel / $0 / }sel
//
// `sel` counts units: the JMP's side effect says which of a three fired, and
// a ladder of ADD #3 (entered at dec_g) which three. Then
//
//   mul.a  #3, sel           unit number -> its SNE line, three lines a unit
//   add.a  #K, sel           ... counted from sel
//   mov.ab *sel, probe       that line's A-field: the cell, counted from the line
//   add.ab sel,  probe       + the line, counted from sel
//   add.ab #sel-probe, probe + sel, counted from the probe
//
// which leaves the first of the unit's four cells in the probe; three JMN
// tests walk the other three (+GAP, +HALF, +HALF+GAP) and hand on the occupied
// one. No hit leaves the probe at the image boundary.
//
// 4 * UNITS cells in 3 * UNITS scan lines plus 13 decoder lines, two cells and the
// ladder: 40 cells in 48 instructions with UNITS 10 (the 40-cell, 10-unit
// width of pdQscan, which is otherwise a one-MUL table scan and already
// covered by opening-qscan-mul UNITS 10); UNITS 9 is nearest luca's 38 cells.
// It costs no table cells and one MUL, but a hit takes 7 to 13 cycles more
// than a table scan's.
const mod = (x, n) => ((x % n) + n) % n;
const MARKER = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };

const first = (P, core, k) => mod(P.START + k * P.SPACING, core);
const unitCells = (P, core, k) => [0, P.GAP, P.HALF, P.HALF + P.GAP].map((d) => mod(first(P, core, k) + d, core));
const cells = (P, core) => Array.from({ length: P.UNITS }, (_, k) => unitCells(P, core, k)).flat();
// The gate plants on the last of a middle unit's four cells: the ladder, the side effect and every pick step run.
const plantedCell = (P, core) => unitCells(P, core, Math.floor(P.UNITS / 2))[3];

const add94 = {
  id: 'opening-qscan-add94',
  kind: 'opening', exit: 'next', processes: 1, writes: 'sparse', link: 'fall', dialects: '94',
  purpose: 'Additive quickscan without a table (the Q3.14 idea): UNITS units of three lines test four cells each (X, X+GAP, X+HALF, X+HALF+GAP, X = START + k*SPACING); on a hit the decoder counts which unit fired, reads the address back from that unit\'s own SNE operand (one MUL #3 to turn the unit number into its line, then three ADDs), and three JMN tests hand on the occupied cell of the four, or the image boundary. 4*UNITS cells in 3*UNITS + 15 lines (probe and pointer cell included) and a short ladder: 40 cells in 48 instructions with UNITS 10.',
  params: { START: [1, 54000], SPACING: [1, 27000], GAP: [1, 4000], HALF: [1, 27000], UNITS: [2, 13] },
  defaults: { START: 640, SPACING: 677, GAP: 53, HALF: 3011, UNITS: 10 },
  entry: 'u0',
  provides: { probe: 'probe' },
  mutable: [['probe', ['a', 'b']], ['sel', ['a']]],
  mismatches(P, settings) {
    const core = settings.coreSize, room = settings.maxLength, out = [], all = cells(P, core);
    if (all.some((c) => c <= room || c >= core - room)) out.push('opening-qscan-add94: a probe lands on or next to the warrior itself');
    if (new Set(all).size < all.length) out.push('opening-qscan-add94: two probes test the same cell');
    return out;
  },
  state(ctx) { ctx.ins('probe', 'DAT', 'F', '#0', `#${ctx.span}`); },
  emit(ctx) {
    const { L, P, core } = ctx, probe = L('probe'), sel = L('sel');
    const groups = Math.ceil(P.UNITS / 3);
    for (let k = 0; k < P.UNITS; k++) {
      const [a, a2, b, b2] = unitCells(P, core, k), r = k % 3;
      ctx.ins(`u${k}`, 'SNE', 'I', `${probe}+${a}`, `${probe}+${a2}`);
      ctx.ins('', 'SEQ', 'I', `${probe}+${b}`, `${probe}+${b2}`);
      ctx.ins('', 'JMP', 'B', L(`dec${Math.floor(k / 3)}`), r === 0 ? `{${sel}` : r === 2 ? `}${sel}` : '$0');
    }
    ctx.ins('', 'JMP', 'B', ctx.next);                         // nothing found: the probe stays at the boundary
    // sel.A holds the unit number less one (so the middle unit of the first three is zero).
    for (let g = groups - 1; g >= 1; g--) ctx.ins(`dec${g}`, 'ADD', 'A', '#3', sel);
    ctx.ins('dec0', 'MUL', 'A', '#3', sel);
    ctx.ins('', 'ADD', 'A', `#${L('u1')}-${sel}`, sel);       // (u1 exists: UNITS is at least 2)
    ctx.ins('', 'MOV', 'AB', `*${sel}`, probe);
    ctx.ins('', 'ADD', 'AB', sel, probe);
    ctx.ins('', 'ADD', 'AB', `#${sel}-${probe}`, probe);
    // The occupied cell of the four.
    ctx.ins('', 'JMN', 'F', ctx.next, `@${probe}`);
    ctx.ins('', 'ADD', 'AB', `#${P.GAP}`, probe);
    ctx.ins('', 'JMN', 'F', ctx.next, `@${probe}`);
    ctx.ins('', 'ADD', 'AB', `#${mod(P.HALF - P.GAP, core)}`, probe);
    ctx.ins('', 'JMN', 'F', ctx.next, `@${probe}`);
    ctx.ins('', 'ADD', 'AB', `#${P.GAP}`, probe);
    ctx.ins('', 'JMP', 'B', ctx.next);
    ctx.ins('sel', 'DAT', 'F', '0', '0');
  },
  plant: (api) => [[api.at('probe') + plantedCell(api.P, api.core), MARKER]],
  watch(api) {
    const planted = api.scenario === 'opening-qscan-add94: planted target', want = plantedCell(api.P, api.core);
    const seesSelf = cells(api.P, api.core).some((c) => api.inImage(api.at('probe') + c));
    let prevInSelf = false, exited = false, muls = 0;
    return {
      before(pc) {
        if (api.inSelf(pc) && api.vm.peek(pc).op === 'MUL') muls++;
        if (prevInSelf && !api.inSelf(pc) && !exited && !api.vm.processes(0).some((q) => api.inSelf(q))) {
          exited = true;
          const b = api.vm.peek(api.at('probe')).b;
          if (planted && !api.inImage(api.at('probe') + b) && b !== want) throw new Error(`opening-qscan-add94 handed on ${b}, not the planted cell ${want}`);
          if (api.scenario === 'alone' && !seesSelf) {
            if (!(api.inImage(api.at('probe') + b - 1) && !api.inImage(api.at('probe') + b))) throw new Error(`opening-qscan-add94 found nothing but did not hand on the image boundary (handed on ${b})`);
            if (muls) throw new Error('opening-qscan-add94 ran its decoder with nothing to find');
          }
        }
        prevInSelf = api.inSelf(pc);
        return null;
      },
      final() { if (planted && !exited) throw new Error('opening-qscan-add94 never handed on'); },
    };
  },
};

export default add94;
