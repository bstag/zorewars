// An original additive decoder. Talisman and Eye of the Storm T show how an
// '88 quickscan can let the branch into a shared decoder carry hit information.
// https://asdflkj.net/COREWAR/88/HILL32/talisman.red
// https://asdflkj.net/COREWAR/ICWS/HILL32/eyeofthestormicws.red
const id = 'opening-qscan-add-88';
const marker = { op: 'JMP', mod: 'B', aMode: '$', a: 0, bMode: '$', b: 0 };
const norm = (n, core) => ((n % core) + core) % core;

function pairs(P) {
  return Array.from({ length: 2 * P.ROWS }, (_, i) => {
    const row = Math.floor(i / 2), column = i % 2;
    const low = P.START + row * P.ROWSTEP + column * P.COLUMN;
    return { row, column, low, high: low + P.GAP };
  });
}

export default {
  id, kind: 'opening', exit: 'next', processes: 1, writes: 'sparse', entry: 'scan',
  purpose: "ICWS'88 quickscan with an additive row decoder and a predecrement column selector. Compares two pairs per row and stops on the first unequal pair. Hands on its occupied cell when the other cell and the reference are empty, or the image boundary on a miss.",
  params: { ROWS: [2, 12], START: [1, 54000], ROWSTEP: [1, 54000], COLUMN: [1, 54000], GAP: [1, 4000], BLANK: [1, 54000] },
  defaults: { ROWS: 9, START: 350, ROWSTEP: 720, COLUMN: 240, GAP: 12, BLANK: 3900 },
  provides: { probe: 'probe' },
  mutable: [['probe', ['b']], ['column', ['b']]],
  knowledge: {
    tuning: ['Rows share an ADD ladder. The JMP after each comparison enters the ladder at its row. Its spare B operand selects column two by predecrementing one cell.', 'A quiet pair costs one CMP. A hit pays for its ADD path and the comparison that selects the occupied side.'],
    placement: ['Offsets are relative to the probe and wrap around the actual core. The linked image needs room on both sides of each probe and the separate comparison reference.'],
    failures: ['An equal pair is invisible to CMP. The side test compares whole instructions, so zero numeric fields in a nonempty target do not hide it. If the opponent occupies the reference cell, the side test can be misled.'],
    evidence: ['docs/hill-block-review.md'],
  },
  mismatches(P, { coreSize: core, maxLength: room }) {
    const offsets = [...pairs(P).flatMap(({ low, high }) => [low, high]), P.BLANK].map((n) => norm(n, core));
    const out = [];
    if (offsets.some((n) => n < room || n > core - room)) out.push(`${id}: a probe or the comparison reference lands on the image`);
    if (new Set(offsets).size !== offsets.length) out.push(`${id}: probes and the comparison reference must occupy distinct cells`);
    return out;
  },
  state(ctx) {
    ctx.ins('probe', 'DAT', 'F', '#0', `#${ctx.span - ctx.pc()}`);
    ctx.ins('column', 'DAT', 'F', '#0', '#1');
  },
  emit(ctx) {
    const { L, P } = ctx, probe = L('probe');
    const at = (offset) => `${probe}+${norm(offset, ctx.core)}`;
    pairs(P).forEach(({ row, column, low, high }, i) => {
      ctx.ins(i === 0 ? 'scan' : '', 'CMP', 'I', at(low), at(high));
      ctx.ins('', 'JMP', 'B', L(`row${row}`), column ? `<${L('column')}` : '0');
    });
    ctx.ins('', 'JMP', 'B', L('handoff'));

    // Enter at the hit row to add ROWSTEP once for each row above row zero.
    for (let row = P.ROWS - 1; row > 0; row--) {
      ctx.ins(`row${row}`, 'ADD', 'AB', `#${P.ROWSTEP}`, probe);
    }
    // The probe started at the image boundary, so convert that base to START+GAP.
    const adjustment = P.START + P.GAP - (ctx.span - ctx.pc());
    ctx.ins('row0', 'ADD', 'AB', `#(${adjustment}+${probe})`, probe);
    ctx.ins('', 'JMN', 'B', L('side'), L('column'));
    ctx.ins('', 'ADD', 'AB', `#${P.COLUMN}`, probe);

    // Strict '88 cannot assemble the VM's empty DAT $0,$0 in our image.
    // Compare against a separate, normally empty cell to recognize either side,
    // including an instruction with zero-valued A and B fields.
    ctx.ins('side', 'CMP', 'I', `@${probe}`, at(P.BLANK));
    ctx.ins('', 'JMP', 'B', L('handoff'));
    ctx.ins('', 'SUB', 'AB', `#${P.GAP}`, probe);
    ctx.ins('handoff', 'JMP', 'B', ctx.next);
  },
  plant(api) {
    const { low } = pairs(api.P).at(-1);
    return [[api.at('probe') + low, marker]];
  },
  watch(api) {
    const { vm, at, P, same, norm: wrap } = api;
    const probe = at('probe'), scan = at('scan'), handoff = at('handoff');
    const table = pairs(P);
    const cell = (offset) => vm.peek(wrap(probe + offset));
    let expected, expectedScans, scanned = 0, handed = false;
    return {
      before(pc) {
        if (handed) return;
        if (pc === scan && expected === undefined) {
          const hit = table.findIndex(({ low, high }) => !same(cell(low), cell(high)));
          expectedScans = hit < 0 ? table.length : hit + 1;
          expected = hit < 0 ? api.code('probe').b : (
            same(cell(table[hit].high), cell(P.BLANK)) ? table[hit].low : table[hit].high
          );
        }
        if (expected === undefined) return;
        if (scanned < expectedScans && pc === wrap(scan + 2 * scanned)) scanned++;
        if (pc !== handoff) return;
        if (scanned !== expectedScans || vm.peek(probe).b !== wrap(expected)) {
          throw new Error(`${id}: incorrect additive scan handoff`);
        }
        handed = true;
      },
      final() {
        if (expected !== undefined && !handed) throw new Error(`${id}: never handed on its probe`);
      },
    };
  },
};
