// A large static decoy field (docs/hill-top30/94x.md: five of the X hill's top 30 fill most of a
// 200-cell image with 63 to 168 decoy SPLs, and fourteen pad the image with blank cells to put
// distance between their parts). `decoys-mixed` stops at 90 cells and has no padding.
//
//   decoy-field  -- GAP blank cells, then COUNT decoy cells. PATTERN 0: SPLs that all differ
//     (modifier, both modes and both fields change from cell to cell), so a scanner that
//     compares any two cells of the field sees a difference, and one that tests for non-zero
//     fields stops on every cell. PATTERN 1: COUNT identical `spl #0, #0`: a comparing scanner
//     sees them as equal and an F-scanner sees them as empty, except where the field meets
//     the code, so it hides how long the image is; a process that falls into it is stunned.
//
// Data only: nothing here is ever run by the warrior. Written from scratch; the hill warriors
// were read for the idea, never copied. Ring, ICWS'94. How to write a block: docs/block-algebra.md.

const MODS = ['F', 'X', 'B', 'AB', 'I', 'A', 'BA'];
const AMODES = ['<', '#', '}', '$', '@', '{', '*', '>'], BMODES = ['>', '$', '#', '<', '@'];

export default {
  id: 'decoy-field', kind: 'data', exit: 'data', processes: 0, writes: 'sparse', dialects: '94',
  purpose: 'A large static decoy field for full-size (200-cell) images: GAP blank cells, then COUNT (1-190) decoy cells. PATTERN 0: SPLs that all differ in modifier, modes and both fields, so comparing and F-scanners alike stop on every cell and spend their attack there; PATTERN 1: identical spl #0, #0 cells, which a comparing scanner sees as equal and an F-scanner as empty, and which stun anything that runs into them.',
  params: { COUNT: [1, 190], GAP: [0, 150], PATTERN: [0, 1], SEED: [1, 400] },
  defaults: { COUNT: 120, GAP: 0, PATTERN: 0, SEED: 61 },
  mismatches(P, settings) {
    return P.COUNT + P.GAP + 2 > settings.maxLength ? [`decoy-field: ${P.COUNT + P.GAP} cells of gap and decoys do not fit a ${settings.maxLength}-instruction warrior`] : [];
  },
  emit(ctx) {
    const { P } = ctx;
    for (let i = 0; i < P.GAP; i++) ctx.ins(i ? '' : 'dfGap', 'DAT', 'F', '$0', '$0');
    for (let i = 0; i < P.COUNT; i++) {
      if (P.PATTERN) ctx.ins(i ? '' : 'dfField', 'SPL', 'B', '#0', '#0');
      // A-fields 1 .. COUNT are all different; B-fields wander with SEED and are never zero.
      else ctx.ins(i ? '' : 'dfField', 'SPL', MODS[i % 7], `${AMODES[i % 8]}${i + 1}`, `${BMODES[i % 5]}${1 + ((i * P.SEED + 7) % 991)}`);
    }
  },
};
