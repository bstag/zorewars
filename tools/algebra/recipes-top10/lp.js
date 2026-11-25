// Recipes that rebuild the Koenigstuhl lp hill's top 10 from blocks (see
// docs/hill-top10/lp.md for how close each one plays to the original).
// Keys are 'top10-lp-<warrior>'; recipes.js merges this file into its table.

const lpRules = { rules: ['lp', 'lp-hill'], verification: 'full', strictRules: true };
const lpHill = { rules: ['lp-hill'], verification: 'full', strictRules: true };

// Mode indices for lp-rain-paper: $ # @ * < > { }
const M = { $: 0, '#': 1, '@': 2, '*': 3, '<': 4, '>': 5, '{': 6, '}': 7 };

// Replinator's paper (also The LP Destroyer's and The LP Destroyer II's):
// Digital Rain's shape with COUNT 21, scatter 548/109, restart 7293, hop 6667.
const replinatorPaper = () => ({
  id: 'lp-rain-paper', P: { COUNT: 21, ENTRY: 0, ORDER: 1, ATTACK: 0, READ: 548, WRITE: 109, RM: M['{'], WM: M['{'], DOUBLE: 0, CHECK: 0, HA: 1, HM: M['}'], RESTART: 7293, HOP: 6667, TRANSFER: 0 },
});
// Bronze minotaur's papers: copy first, enter at the copy with a 7-cell first copy.
const bronzePaper = (COUNT, RESTART, HOP) => ({
  id: 'lp-rain-paper', P: { COUNT, FIRST: 7, ENTRY: 1, ORDER: 0, ATTACK: 0, READ: 1171, WRITE: 826, RM: M['{'], WM: M['{'], DOUBLE: 0, CHECK: 0, HA: 0, HM: M['>'], RESTART, HOP, TRANSFER: 0 },
});
const pad = (COUNT) => ({ id: 'lp-padding', P: { COUNT } });
// The LP Destroyer's three-state brain: paper by default; a loss in state 0
// plays the stone, which is kept while it wins; a paper that has won needs two
// losses in a row before the stone is tried.
// The stone is member 0 and the paper member 1: laid out the other way round, the
// paper's scatter moves the stone's cells into its copies and the paper dies alone.
// Rows are 4 * next state + member: LOSS s0 -> stone/2, s1 -> paper/0, s2 -> paper/1.
const destroyerBrain = { FIRST: 1, LOSS: 0x5518, WIN: 0x8855, TIE: 0x1151, PACKED: 1 };

export default {
  'top10-lp-rous': {
    ...lpRules, length: 7,
    purpose: 'R.O.U.S. (#1): a 7-cell paper that copies first, then scatters through two doubling pointers; 7-cell first copy, 22-cell copies after. Exact instructions: hill 1.679, as the original.',
    tree: () => ({ id: 'lp-scatter-paper', P: { HOP: 6191, COUNT: 22, READ: 5033, WRITE: 1319, RESTART: 83, INDIRECT: 1, READMODE: 0, SCATTER: 1 } }),
  },
  'top10-lp-replinator': {
    ...lpRules, length: 100,
    purpose: 'Replinator (#2): a q^4.5 MUL quickscan and a 20-pass two-stream burst, then Digital Rain\'s paper with Replinator\'s numbers, booted 6000 away so it does not sit beside the dead scan code (the original keeps them about 100 cells apart in a 200-cell image). Hill 1.527 at 100 rounds against the original\'s 1.596; the scan finds different cells.',
    tree: () => ({ id: 'seq', kids: [
      { id: 'opening-qscan-mul45', P: { QFAC: 2107, GAP: 100, UNITS: 6, UNITS2: 3 } },
      { id: 'probe-burst2', P: { COUNT: 20, STEP: 7, OFFSET: 0, GAP: 88, BOMB: 0, SIDE: -1 } },
      { id: 'boot', P: { HOP: 6000 }, kids: [replinatorPaper()] },
    ] }),
  },
  'top10-lp-bronze-minotaur': {
    ...lpRules, length: 16,
    purpose: 'Bronze minotaur (#3): two copy-first scatter papers with different restart lengths (17, 20) and hops, launched together. Exact instructions in 16 cells: hill 1.544 against 1.518.',
    tree: () => ({ id: 'par', kids: [bronzePaper(17, 155, 6415), bronzePaper(20, 2903, 5741)] }),
  },
  'top10-lp-digital-rain': {
    ...lpRules, length: 7,
    purpose: 'Digital Rain (#4): the 7-line paper that scatters first, doubles, then copies; 25-cell copies (18 blank). Exact instructions: hill 1.494, as the original.',
    tree: () => ({ id: 'lp-rain-paper' }),
  },
  'top10-lp-fear-of-the-unknown': {
    ...lpHill, length: 200,
    purpose: 'Fear of the Unknown (#5): a booted 4-process self-indexed stone (step 6742), 186 blank cells, then a quiet 5-line paper; 4 + 1 processes, laid out as published: hill 1.563 against 1.571 (15 cells side by side: 1.446).',
    tree: () => ({ id: 'par', kids: [
      { id: 'image', kids: [{ id: 'lp-quad-stone', P: { STYLE: 0, S: 6742, HOP: 2342 } }, pad(186)] },
      { id: 'lp-quiet-paper', P: { STYLE: 0, COUNT: 20, FIRST: 20, DEC: 3997, HOP: 5849 } },
    ] }),
  },
  'top10-lp-destroyer': {
    ...lpHill, length: 100,
    purpose: 'The LP Destroyer (#6): a three-state P-space brain between Replinator\'s paper and a one-process mod-4 JMP stone that turns into a forward DAT clear. lp-hill rules: 1.440 against 1.413.',
    tree: () => ({ id: 'switch-table', P: destroyerBrain, kids: [{ id: 'lp-destroyer-stone' }, replinatorPaper()] }),
  },
  'top10-lp-hippogriff': {
    ...lpRules, length: 7,
    purpose: 'Hippogriff (#7): the 7-line paper whose attack walks 2407 a lap by the restart SPL\'s own fields; 28-cell copies. Exact instructions: hill 1.419, as the original.',
    tree: () => ({ id: 'lp-rain-paper', P: { COUNT: 28, FIRST: 28, ENTRY: 1, ORDER: 1, ATTACK: 1, READ: 5096, WRITE: 2407, RM: M['}'], WM: M.$, CHECK: 0, HA: 1, HM: M['}'], RESTART: 2407, HOP: 7569, TRANSFER: 1 } }),
  },
  'top10-lp-distortion-energy': {
    ...lpRules, length: 20,
    purpose: 'Distortion Energy (#8): a quiet paper (5-cell first copy, 38 after) beside a booted 4-process ADD.X stone whose steps drift. Compact: hill 1.430 against 1.414.',
    tree: () => ({ id: 'par', kids: [
      { id: 'lp-quiet-paper', P: { STYLE: 1, COUNT: 38, FIRST: 5, DEC: 2746, HOP: 5919 } },
      { id: 'lp-quad-stone', P: { STYLE: 1, ASTEP: 35, BSTEP: 44, AOFS: -2, BOFS: -1, GATE: -6, HOP: 4885 } },
    ] }),
  },
  'top10-lp-destroyer-ii': {
    ...lpHill, length: 100,
    purpose: 'The LP Destroyer II (#9): the same brain between Replinator\'s paper and a booted SPL-fed dwarf whose bomb lands on its own MOV after 1677 laps, fed from a spawner outside its loop so it survives the hit (the published SPL #0 dies alone). lp-hill rules: 1.309 against 1.345.',
    tree: () => ({ id: 'switch-table', P: destroyerBrain, kids: [{ id: 'boot', P: { HOP: 5421 }, kids: [{ id: 'lp-gate-dwarf' }] }, replinatorPaper()] }),
  },
  'top10-lp-disciples-of-the-void': {
    ...lpHill, length: 200,
    purpose: 'Disciples of the Void (#10): four mutually transparent A-field scanners, two pairs on opposite parities, each ending in an SPL-fed DAT clear. Published code and layout: hill 1.435, as the original.',
    tree: () => ({ id: 'lp-void-quartet' }),
  },
};
