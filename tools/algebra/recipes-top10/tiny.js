// Recipes that rebuild the Koenigstuhl Tiny hill's top 10 (800 cells, 20
// instructions) from blocks; docs/hill-top10/tiny.md says how close each one
// plays to the original. Keys are 'top10-tiny-<warrior>'; recipes.js merges
// this file into its table.
//
// Scores are points a round against the hill's top 30 (the hill command,
// 500 rounds per opponent, --rules tiny), rebuild against the original
// measured the same way.

const hill = { rules: ['tiny'], length: 20 };

// Addressing modes and tail opcodes as the blocks number them (tools/algebra/blocks/top10-tiny.js).
const M = { '{': 0, '}': 1, '<': 2, '>': 3, $: 4, '@': 5, '*': 6, '#': 7 };
const w = (x) => ((x % 800) + 800) % 800;
// FORM 1 quick-bomb lines: [mode, A, B], both counted from the line.
const lines = (rows) => {
  const P = { FORM: 1, COUNT: rows.length };
  rows.forEach(([m, a, b], i) => Object.assign(P, { [`M${i + 1}`]: M[m], [`A${i + 1}`]: w(a), [`B${i + 1}`]: w(b) }));
  return { id: 'tiny-qbomb', P };
};
// FORM 0: the FOR-loop form (pMARS counts from 1, so A0/B0 are the first line's cells).
const spaced = (COUNT, A0, AS, B0, BS) => ({ id: 'tiny-qbomb', P: { FORM: 0, COUNT, A0: w(A0), AS: w(AS), B0: w(B0), BS: w(BS), AM: 0 } });
// tiny-silk2: fan, the two stages [step, mode], and the tail [op, a-mode, a, b-mode, b].
const silk = (fan, [X, XM], [Y, YM], tail) => {
  const P = { ...fan, X: w(X), XM: M[XM], Y: w(Y), YM: M[YM], TLEN: tail.length };
  tail.forEach(([o, am, a, bm, b], i) => Object.assign(P, { [`T${i + 1}O`]: ['MOV', 'DJN', 'JMP', 'DAT'].indexOf(o), [`T${i + 1}AM`]: M[am], [`T${i + 1}A`]: w(a), [`T${i + 1}BM`]: M[bm], [`T${i + 1}B`]: w(b) }));
  return { id: 'tiny-silk2', P };
};
const fan6 = (F1, F2, F3) => ({ FAN: 6, F1M: 0, F1: w(F1), F2M: 0, F2: w(F2), F3M: 0, F3: w(F3) });

export default {
  'top10-tiny-dfd94f0': {
    ...hill,
    purpose: 'dfd94f0 (bvowk, evolved, #1): three decoy lines, then a SPL into two processes: one makes three more decoys and becomes a one-line DJN stream (wiped by its own paper after a few dozen passes), the other a seven-process two-stage silk (236, then 92) whose copies turn into a three-line clear. 20 instructions; 1.570 a round against the Tiny top 30 (original 1.595).',
    tree: () => ({ id: 'seq', kids: [
      lines([['}', 84, 135], ['{', -46, -21], ['<', -46, -294]]),
      { id: 'par', kids: [
        { id: 'seq', kids: [lines([['{', 358, -194], ['}', 163, -253], ['>', 34, 210]]), { id: 'djn-stream1', P: { START: 355, RETIRE: 1 } }] },
        { id: 'seq', kids: [lines([['}', -162, -124]]),
          silk({ FAN: 8, F1M: 0, F1: w(-220), DM: 0, DA: 176, DB: 305, F2M: 0, F2: 293, F3: 253 }, [236, '{'], [92, '{'],
            [['MOV', '>', -6, '{', 0], ['MOV', '>', -126, '{', -397], ['DJN', '$', -2, '{', -350]])] }] }] }),
  },
  'top10-tiny-e21ca502': {
    ...hill,
    purpose: 'e21ca502 (bvowk, evolved, #2): ten decoy lines, a seven-process fan (SPL 1 / SPL 1 / a MOV that copies the SPL over itself), the same two-stage silk (236, 92) and a three-line clear tail; the tail\'s first pointer is one cell further back than the original\'s, which kills itself alone at cycle 7,202. 20 instructions; 1.500 against the top 30 (original 1.494).',
    tree: () => ({ id: 'seq', kids: [
      lines([['{', -52, -249], ['>', 167, -155], ['}', -45, 310], ['{', 224, -345], ['{', 137, -122], ['>', 113, -305], ['>', 167, -68], ['{', 125, 209], ['<', 267, 326], ['{', 267, -33]]),
      silk({ FAN: 7, F1M: 0, F1: 183, F2M: 3, F2: 345, F3: w(-393) }, [236, '>'], [92, '>'],
        [['MOV', '>', -199, '{', 0], ['MOV', '>', -121, '{', -392], ['DJN', '$', -2, '<', 347]])] }),
  },
  'top10-tiny-7b15f4b8': {
    ...hill,
    purpose: '7b15f4b8 (bvowk, evolved, #3): ten decoy lines, the seven-process fan, the two-stage silk (236, 92) and a tail that copies from one far pointer to another and loops with a JMP. 20 instructions; 1.483 against the top 30, as the original (modifiers aside, the same code).',
    tree: () => ({ id: 'seq', kids: [
      lines([['{', -46, 377], ['{', -164, -258], ['}', 165, 138], ['{', -213, -294], ['{', -355, -200], ['}', -241, 305], ['>', 34, 207], ['<', -69, 39], ['}', -45, -124], ['<', 184, 112]]),
      silk({ FAN: 7, F1M: 2, F1: w(-44), F2M: 3, F2: 264, F3: w(-384) }, [236, '>'], [92, '>'],
        [['MOV', '@', 4, '{', -21], ['MOV', '}', -121, '{', -392], ['JMP', '$', -2, '>', 177]])] }),
  },
  'top10-tiny-4b0804b3': {
    ...hill,
    purpose: '4b0804b3 (bvowk, evolved, #4): nine decoy lines, a fan with a tenth decoy inside it (seven processes), the silk 236 then 83 and a tail whose DJN loops on its second line. 20 instructions; 1.493 against the top 30, as the original (modifiers aside, the same code).',
    tree: () => ({ id: 'seq', kids: [
      lines([['>', -110, -45], ['<', -394, -294], ['{', -164, -253], ['{', -106, -376], ['{', -214, -351], ['{', 38, 227], ['>', -38, 292], ['>', -266, 56], ['<', -374, -146]]),
      silk({ FAN: 8, F1M: 2, F1: w(-280), DM: 3, DA: 367, DB: 303, F2M: 0, F2: 263, F3: 256 }, [236, '>'], [83, '<'],
        [['MOV', '}', -53, '{', 115], ['MOV', '<', -30, '{', -341], ['DJN', '$', -1, '<', -41]])] }),
  },
  'top10-tiny-double-shock': {
    ...hill,
    purpose: 'Double Shock (inversed, #5): the 11-line quickscan (seven cells in four or five cycles, a MUL.X decoder, a two-way bombing loop), then a three-line boot copies one four-line SPL-fed double clear to two places 400 cells apart and starts both. 20 instructions; 1.485 against the top 30, as the original (the same code).',
    tree: () => ({ id: 'seq', kids: [{ id: 'inv-qscan', P: { QX: 512, QY: 376, QANY: 347 } }, { id: 'twin-clear', P: { HOP1: 656, HOP2: 256, CA: 752, CB: 587, CM: 91, F1: 453, F2: 453 } }] }),
  },
  'top10-tiny-consonance': {
    ...hill,
    purpose: 'Consonance (inversed, #6): the 11-line quickscan, then a six-process two-stage silk whose steps satisfy 3X + Y = 1 (Y = -317, X = 106), so a grandchild lands next to its ancestor, and a two-line clear tail. 20 instructions; 1.518 against the top 30, as the original (the same code).',
    tree: () => ({ id: 'seq', kids: [{ id: 'inv-qscan', P: { QX: 150, QY: 577, QANY: 403 } },
      silk(fan6(397, 395, 393), [-317, '>'], [106, '>'], [['MOV', '>', 523, '{', 0], ['DJN', '$', -2, '<', 403]])] }),
  },
  'top10-tiny-chorus': {
    ...hill,
    purpose: 'Chorus (inversed, #7): nine quick-bomb lines, then a fan of six copies the six-line silk to a mirror 400 cells away and starts six in each; every copy throws a copy 67 on, lays two blanks, and rebuilds itself 12 cells on and moves there. 20 instructions; 1.465 against the top 30, as the original (the same code).',
    tree: () => ({ id: 'seq', kids: [spaced(9, 590, 411, 352, 388), { id: 'chorus-silk' }] }),
  },
  'top10-tiny-microcosmos': {
    ...hill,
    purpose: 'Microcosmos (inversed, #8): a four-line SPL-fed satellite clear, nine quick-bomb lines, then four processes copy the satellite beside a four-line silk (step 104) whose every copy relaunches its parent\'s satellite 145 cells on. 20 instructions; 1.452 against the top 30, as the original (the same code).',
    tree: () => ({ id: 'seq', kids: [spaced(9, 743, 776, 704, 137), { id: 'satellite-silk' }] }),
  },
  'top10-tiny-resinoid': {
    ...hill,
    purpose: 'Resinoid (John Metcalf, #9): four decoy lines, then four processes copy a four-line resin clear to two places 400 apart and a silk-imp paper to a third, the SPLs\' A-fields counting the copies, and start four in each. 20 instructions; 1.531 against the top 30, as the original (the same code).',
    tree: () => ({ id: 'seq', kids: [lines([['{', 100, 760], ['{', 220, 410], ['<', 780, 360], ['<', 480, 460]]), { id: 'resin-boot' }] }),
  },
  'top10-tiny-tarragon': {
    ...hill,
    purpose: 'Tarragon (John Metcalf, #10): eleven decoy lines 25 cells apart, then a six-process two-stage silk (-314, then 105: 3X + Y = 1) and a two-line clear tail. 20 instructions; 1.428 against the top 30, as the original (the same code).',
    tree: () => ({ id: 'seq', kids: [spaced(11, 726, 775, 531, 775),
      silk(fan6(100, 200, 300), [-314, '{'], [105, '{'], [['MOV', '>', -4, '{', 0], ['DJN', '$', -2, '<', -49]])] }),
  },
};
