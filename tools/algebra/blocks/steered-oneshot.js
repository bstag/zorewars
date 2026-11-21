// Steered one-shot (ModelWar 1v1 ladder, Nov 2026):
//
//   steered-oneshot  -- a one-shot scanner that looks at two cells a loop (.66c), then runs a
//     SPL/DAT clear forward from the find, wrapped in decoy cells: HEAD cells before the code,
//     a JMP back to the scan just before the clear's bomb pointer, TGAP blank cells after the
//     code and then TAIL more decoys. Against another one-shot the decoys decide who finds
//     whom first: a one-shot clears forward from its find, so an enemy that stops on the tail
//     clears away from our scanner and gives it a whole lap to finish its own scan; and since a
//     scan of this kind follows the A-field of each cell it touches, the decoys' fields (drawn
//     from SEED) steer where the enemy's pointer goes next. SEED is a tuning knob, not a design:
//     the right one is found by searching against the opponent.
//
// Written from scratch for the ModelWar ladder (modelwar/README.md); the two-cells-a-loop scan
// and the SPL/DAT clear are the textbook one-shot. Ring, ICWS'94 only.
// How to write a block: docs/block-algebra.md.

const EVERY = ['op', 'mod', 'aMode', 'a', 'bMode', 'b'];

// SEED's decoy fields: 2 * count numbers in 1 .. core - 1.
function fields(seed, count, core) {
  let x = (seed * 2654435761) % 2147483648;
  const out = [];
  for (let i = 0; i < 2 * count; i++) {
    x = (x * 1103515245 + 12345) % 2147483648;
    out.push(1 + (x % (core - 1)));
  }
  return out;
}

export default {
  id: 'steered-oneshot', kind: 'body', exit: 'never', writes: 'core', roams: false, dialects: '94',
  processes: 1, grows: true,
  purpose: 'A one-shot scanner (two cells a loop, .66c) that runs a SPL-pumped SPL/DAT clear forward from its find and skips its own code on the wrap, wrapped in decoys: HEAD cells before it, a JMP back to the scan just before its bomb pointer, then TGAP blank cells and TAIL decoys after it. A one-shot clears forward from where it stops, so an enemy one-shot that stops on the tail clears away from this scanner; the decoys\' fields (from SEED) also steer an enemy scan that follows A-fields. Tuned against one opponent by searching SEED, HEAD, TGAP and TAIL. 17 instructions plus the decoys.',
  params: { STEP: [1, 54000], GAP: [1, 64], DEC: [1, 54000], HEAD: [0, 16], TGAP: [0, 80], TAIL: [0, 16], SEED: [1, 1000000] },
  defaults: { STEP: 5044, GAP: 13, DEC: 3000, HEAD: 6, TGAP: 45, TAIL: 8, SEED: 42 },
  entry: 'soScan', entryFirst: false, loop: 'soScan',
  provides: { splBomb: 'soSpl', datBomb: 'soBptr' },
  // The scan pointer and the clear's pointers change as it runs; once the clear wraps it writes over
  // the decoys, the jump back, and the scan's tail (the loop has ended by then).
  mutable(P) {
    const list = [['soSptr', ['a', 'b']], ['soSpl', ['a']], ['soJmp', EVERY], ['soBack', EVERY], ['soMov', EVERY], ['soGo', EVERY], ['soInc', EVERY], ['soDjn', EVERY]];
    for (let i = 0; i < P.HEAD; i++) list.push([`soHead${i}`, EVERY]);
    for (let i = 0; i < P.TAIL; i++) list.push([`soTail${i}`, EVERY]);
    return list;
  },
  mismatches(P, settings) {
    const len = P.HEAD + 1 + 17 + P.TGAP + P.TAIL;
    return len > settings.maxLength ? [`steered-oneshot: ${len} cells do not fit a ${settings.maxLength}-instruction warrior`] : [];
  },
  emit(ctx) {
    const { L, P, core } = ctx;
    const f = fields(P.SEED, P.HEAD + P.TAIL, core);
    for (let i = 0; i < P.HEAD; i++) ctx.ins(`soHead${i}`, 'DAT', 'F', `$${f[2 * i]}`, `$${f[2 * i + 1]}`);
    // The clear's pointer cell is two before the bomb pointer: the last decoy (or whatever precedes).
    ctx.ins('soJmp', 'JMP', 'B', L('soScan'), '$0');
    ctx.ins('soBptr', 'DAT', 'F', '#1', '#11');               // DAT pass bomb; A: the next bomb, B: the skip on the wrap
    ctx.ins('soSpl', 'SPL', 'B', `#${P.DEC}`, '$13');           // pump and SPL pass bomb; A: the decrement stream
    ctx.ins('soClr', 'MOV', 'I', `*${L('soBptr')}`, `>${L('soBptr')}-2`);
    ctx.ins('', 'MOV', 'I', `*${L('soBptr')}`, `>${L('soBptr')}-2`);
    ctx.ins('soDjn', 'DJN', 'F', L('soClr'), `}${L('soSpl')}`);
    for (let i = 0; i < 5; i++) ctx.ins('', 'DAT', 'F', '$0', '$0');
    ctx.ins('soScan', 'ADD', 'F', L('soInc'), L('soSptr'));
    ctx.ins('soSptr', 'SNE', 'I', `${L('soBptr')}-1+${P.STEP}+${P.GAP}`, `}${L('soBptr')}-1+${P.STEP}`);
    ctx.ins('soBack', 'DJN', 'F', L('soScan'), `*${L('soSptr')}`);
    ctx.ins('soMov', 'MOV', 'I', L('soSptr'), `${L('soBptr')}-2`);
    ctx.ins('soGo', 'JMP', 'B', `${L('soSpl')}`, `<${L('soBptr')}-2`);
    for (let i = 0; i < 5; i++) ctx.ins('', 'DAT', 'F', '$0', '$0');
    ctx.ins('soInc', 'DAT', 'F', `$${P.STEP}`, `$${P.STEP}`);
    for (let i = 0; i < P.TGAP; i++) ctx.ins('', 'DAT', 'F', '$0', '$0');
    for (let i = 0; i < P.TAIL; i++) ctx.ins(`soTail${i}`, 'DAT', 'F', `$${f[2 * (P.HEAD + i)]}`, `$${f[2 * (P.HEAD + i) + 1]}`);
  },
  watch(api) {
    const scan = api.at('soScan'), clr = api.at('soClr');
    let looks = 0, cleared = false;
    return {
      before(pc) {
        if (pc === scan) looks++;
        if (pc === clr) cleared = true;
        return null;
      },
      after() {},
      final() {
        if (api.entered() && api.alone && looks === 0) throw new Error('steered-oneshot: never scanned');
        if (api.entered() && api.alone && !cleared) throw new Error('steered-oneshot: never started its clear (a lap of the scan should find its own code)');
      },
    };
  },
};
