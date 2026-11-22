// Recipes that rebuild the Koenigstuhl 94nop hill's top 10 from blocks (see
// docs/hill-top10/94nop.md for how close each one plays to the original).
// Keys are 'top10-94nop-<warrior>'; recipes.js merges this file into its table.
//
// Scores are points a round against the hill's top 30 (the hill command,
// 200 rounds per opponent, --rules 94nop --length 100), rebuild against the
// original measured the same way; head-to-head is the rebuild's points a round
// against the original over 200 rounds (two equal warriors score about 1.2).

const hill = { rules: ['94nop'], length: 100 };

// The Azathoth stone and paper as runner-paper-stone runs them: three groups of
// six into the stone, six into the paper; PHOP 837 puts the paper copy 2357
// cells below the stone copy, as in the originals.
const azathothBody = (BACK) => ({ id: 'runner-paper-stone', P: { K: 3, SHOP: 3200, PHOP: 837, STEP: 2431, TIME: 1470, BACK, PSTEP: 1365 } });
const vanRijnScan = (STEP) => ({ id: 'q45-qscan', P: { QZ: 438, PAD: 16, GAP: 87, STEP, TIME: 19 } });

export default {
  'top10-94nop-arvon': {
    ...hill,
    purpose: 'Arvon (Kammann & Forge-AI, #1): Metcalf lattice quickscan (QFAC 163, 15-pass burst) into the Azathoth paper/stone fan boot. 51 instructions; 1.340 a round against the 94nop top 30 (original 1.381).',
    tree: () => ({ id: 'seq', kids: [{ id: 'lattice-qscan', P: { QFAC: 163, GAP: 67, STEP: 9, TIME: 15 } }, azathothBody(5878)] }),
  },
  'top10-94nop-azathoth': {
    ...hill,
    purpose: 'Azathoth (John Metcalf, #2): lattice quickscan (QFAC 1533, 21-pass burst), then a six-process fan boot of the self-timed bidirectional stone (18 processes) and the three-stream looping paper (6). 51 instructions; 1.343 against the top 30 (original 1.359).',
    tree: () => ({ id: 'seq', kids: [{ id: 'lattice-qscan', P: { QFAC: 1533, GAP: 80, STEP: 7, TIME: 21 } }, azathothBody(5871)] }),
  },
  'top10-94nop-pst-v4': {
    ...hill,
    purpose: 'pst_v4 (Kammann & Forge-AI, #3): inversed\'s six-unit q^i quickscan with its burst, then Arvon\'s paper/stone fan boot. 55 instructions; 1.300 against the top 30 (original 1.325).',
    tree: () => ({ id: 'seq', kids: [
      { id: 'qi-qscan', P: { FORM: 0, A0: 3325, B0: 7515, A1: 3270, B1: 3495, A2: 5778, B2: 4498, STEP: 3949, BSTEP: 9, BHOP: 67, BCOUNT: 21 } },
      azathothBody(5878)] }),
  },
  'top10-94nop-king-cobra': {
    ...hill,
    purpose: 'King Cobra (inversed, #4): the 34-cell cross-pair q^i quickscan and burst, then the oneshot booted 6055 cells on by its own two-cells-a-pass boot: a four-line scan that commits only to two adjacent differing pairs, a pumped SPL clear turned to DAT by a DJN stream, and an imp left behind. 71 instructions; 1.375 against the top 30 (original 1.406).',
    tree: () => ({ id: 'seq', kids: [
      { id: 'qi-qscan', P: { FORM: 1, A0: 5340, B0: 4327, A1: 2215, B1: 2487, A2: 4665, B2: 2698, STEP: 1, BSTEP: 5, BHOP: 78, BCOUNT: 20 } },
      { id: 'cobra-body', P: { BOOT: 6055 } }] }),
  },
  'top10-94nop-kaitain': {
    ...hill,
    purpose: 'Kaitain (Kammann & Forge-AI, #5): King Cobra\'s oneshot and boot behind the Metcalf lattice quickscan (Azathoth\'s factor, Arvon\'s burst). 60 instructions; 1.418 against the top 30 (original 1.435).',
    tree: () => ({ id: 'seq', kids: [{ id: 'lattice-qscan', P: { QFAC: 1533, GAP: 67, STEP: 9, TIME: 15 } }, { id: 'cobra-body', P: { BOOT: 6055 } }] }),
  },
  'top10-94nop-the-collective': {
    ...hill,
    purpose: 'The Collective (Roy van Rijn, #6): a q^4.5 quickscan and burst, then ten unrolled MOVs boot the counted-copy paper 7661 cells away: one process copies 23 cells a time 7730 on, bombing three times per cell, and every copy doubles the processes. 80 instructions; 1.417 against the top 30 (original 1.407).',
    tree: () => ({ id: 'seq', kids: [vanRijnScan(6), { id: 'boot', P: { HOP: 7661, DIRECT: 1 }, kids: [{ id: 'collective-paper' }] }] }),
  },
  'top10-94nop-tolypeutes': {
    ...hill,
    purpose: 'Tolypeutes (Roy van Rijn, #7): a q^4.5 quickscan and burst, then a four-process fan boot: four processes into the Armadillo stone (step 2090, A-indirect stream) that copies its own SPL over its loop and becomes a gated clear, one into Tolypeutes\' one-process three-point imp pump 256 cells below it. 82 instructions; 1.305 against the top 30 (original 1.359).',
    tree: () => ({ id: 'seq', kids: [vanRijnScan(7), { id: 'fanboot', P: { N: 4, K: 1, SPLIT: 1, MOREA: 1, HOPA: 7116, HOPB: 6860 }, kids: [
      { id: 'armadillo-switch', P: { STEP: 2090, HOP: 46, STREAM: 1 } }, { id: 'toly-pump', P: { IDEST: 7402 } }] }] }),
  },
  'top10-94nop-hullab3loo': {
    ...hill,
    purpose: 'Hullab3loo (Roy van Rijn, #8): a q^4.5 quickscan and burst, then a six-process fan boot of the step-17 H-stone (12 processes, a run of bombs per wave, timed to bomb itself asleep) and the Moore-style six-line paper (6), the paper copy 4292 cells below the stone copy as in the original. 81 instructions; 1.304 against the top 30 (original 1.363).',
    tree: () => ({ id: 'seq', kids: [vanRijnScan(7), { id: 'fanboot', P: { N: 6, K: 2, HOPA: 4854, HOPB: 556 }, kids: [{ id: 'h-stone' }, { id: 'moore-paper' }] }] }),
  },
  'top10-94nop-forgotten-lore-ii': {
    ...hill,
    purpose: 'Forgotten Lore II (David Moore, #9): the DJN-throwing scanning vampire whose own bombs time its switch to a two-stream SPL-then-DAT clear; instruction for instruction the original at its defaults. 99 instructions; 1.345 against the top 30 (original 1.345).',
    tree: () => ({ id: 'lore-vampire' }),
  },
  'top10-94nop-excalibur': {
    ...hill,
    purpose: 'Excalibur (inversed, #10): the Agony-style scanner booted 1423 cells on by unrolled MOVs (one process, two looks a lap, 16-SPL wipes, a pumped DAT clear once it finds itself), behind a 51-cell decoy of mixed SPLs. 86 instructions; 1.292 against the top 30 (original 1.321).',
    tree: () => ({ id: 'image', kids: [{ id: 'boot', P: { HOP: 1423, DIRECT: 1 }, kids: [{ id: 'agony-body' }] }, { id: 'decoys-mixed', P: { COUNT: 51 } }] }),
  },
};
