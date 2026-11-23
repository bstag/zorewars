// Recipes that rebuild the Koenigstuhl Nano hill's top 10 from blocks (see
// docs/hill-top10/nano.md for how each one works and how close it plays).
// Keys are 'top10-nano-<warrior>'; recipes.js merges this file into its table.
//
// Nano: 80 cells, five instructions, 800 cycles, 80 processes. Each warrior is
// one five-line block with its fields named; the numbers are cells on the
// 80-cell ring. Scores are points a round against the hill's top 30 (the hill
// command, 1000 rounds per opponent, --rules nano), rebuild against original.

const nano = { rules: ['nano'], length: 5, strictRules: true };

// The shared mirror loop of Nextratulated, Iron Throne and Forbes: the mirror
// reads up from cursor 67, the walker steps it up.
const mirror67 = { CURM: 0, CURSOR: 67, WALKM: 0 };

export default {
  'top10-nano-reptiloid-conspiracy': {
    ...nano,
    purpose: 'Reptiloid Conspiracy (inversed, #1): SPL-fed mirror clear with a swap-back line: the mirror and the swap exchange the cells under the SPL\'s A pointer (from 39) and cursor 69, the walker steps the cursor up and writes down an A-stream that the SPL also drives. Evolved with ArmsRace.',
    tree: () => ({ id: 'nano-mirror-clear', P: { SLOT: 0, PTR: 39, FEEDMOD: 1, SIDEM: 2, SIDE: 57, CURM: 0, CURSOR: 69, WALKM: 0, STRM: 2, STREAM: 57, DJNM: 2, DJNC: 58, DJNMOD: 0 } }),
  },
  'top10-nano-reptiloid-supremacy': {
    ...nano,
    purpose: 'Reptiloid Supremacy (inversed, #2): a DAT carpet two cells a pass down from cell 34, whose bomb\'s B-field becomes the pointer when the carpet reaches the MOV that holds it, so the bomber becomes a one-step clear. Evolved with ArmsRace.',
    tree: () => ({ id: 'nano-dat-clear', P: { BOMBA: 32, BOMBB: 76, FEEDA: 48, SIDE: 50, PTR: 34, DJNC: 74 } }),
  },
  'top10-nano-nextratulated-sturvinator-2': {
    ...nano,
    purpose: '[RS] Nextratulated Sturvinator 2 (inversed, #3): a one-shot head presets the cursor field and throws a blank at 29, then the mirror clear: mirror writes down from cell 26, the walker writes every third cell down from 59 where the SPL, the walker and the DJN share one B-stream. Evolved with RedShift.',
    tree: () => ({ id: 'nano-mirror-clear', P: { SLOT: 1, HEADM: 0, HEADA: 70, HEADB: 29, PTR: 26, FEEDMOD: 0, SIDEM: 0, SIDE: 59, ...mirror67, STRM: 0, STREAM: 59, DJNM: 0, DJNC: 59, DJNMOD: 0 } }),
  },
  'top10-nano-combat-arithmetic': {
    ...nano,
    purpose: 'Combat Arithmetic (inversed, #4): a one-shot head, then a SPL whose two fields are both pointers: each walker swaps the cells under them and ends on a DIV.F bomb that divides by zero on blanks, so only the SPL loops and the warrior runs on three or four processes.',
    tree: () => ({ id: 'nano-twin-clear', P: { SLOT: 1, HEADM: 1, HEADA: 60, HEADB: 75, PA: 70, PB: 36, SIDEM: 0, FEEDMOD: 0, DIVC: 51 } }),
  },
  'top10-nano-forbes': {
    ...nano,
    purpose: 'Forbes (Roy van Rijn, #5): the Nextratulated mirror loop with the walker and DJN on stream 63, plus a reverse copier that throws the SPL to cell 46 and then sprays the cells below the warrior up from 15 through the thrown SPL B-field. The published cursor (67) wipes its own SPL at cycle 466 when alone, which the gate refuses; cursor 66 survives and plays the same (1.585 against 1.588).',
    tree: () => ({ id: 'nano-mirror-clear', P: { SLOT: 2, PTR: 42, FEEDMOD: 0, SIDEM: 1, SIDE: 49, COPYB: 46, CURM: 0, CURSOR: 66, WALKM: 0, STRM: 0, STREAM: 63, DJNM: 0, DJNC: 63, DJNMOD: 1 } }),
  },
  'top10-nano-iron-throne': {
    ...nano,
    purpose: 'Iron Throne (Roy van Rijn, #6): Nextratulated\'s mirror loop with a different one-shot head (copy cell 66 to 28) and the DJN on its own stream from 42.',
    tree: () => ({ id: 'nano-mirror-clear', P: { SLOT: 1, HEADM: 3, HEADA: 66, HEADB: 28, PTR: 26, FEEDMOD: 0, SIDEM: 0, SIDE: 59, ...mirror67, STRM: 0, STREAM: 59, DJNM: 0, DJNC: 42, DJNMOD: 0 } }),
  },
  'top10-nano-glitch-core-opt': {
    ...nano,
    purpose: 'Glitch//CORE//opt (John Metcalf, #7): a paper that copies itself a cell a pass 45 cells on and starts processes in each copied cell, with a two-line A-stream clear for the processes that fall through.',
    tree: () => ({ id: 'nano-paper-clear', P: { SIDE1: 54, COPY: 45, SIDE2: 57, BOMB: 72, CLR: 32, DJNC: 33 } }),
  },
  'top10-nano-rogue-ai': {
    ...nano,
    purpose: 'rogue[AI] (John Metcalf, #8): a reverse copier throws the SPL up from cell 48; the mirror reads down from fixed cursor 25 while the walker drags that cursor down too, writing down a B-stream from 60, and a DJN B-stream from 76.',
    tree: () => ({ id: 'nano-mirror-clear', P: { SLOT: 2, PTR: 44, FEEDMOD: 0, SIDEM: 1, SIDE: 13, COPYB: 48, CURM: 0, CURSOR: 25, WALKM: 1, STRM: 0, STREAM: 60, DJNM: 0, DJNC: 76, DJNMOD: 0 } }),
  },
  'top10-nano-128-48': {
    ...nano,
    purpose: '128_48 (yabevolver, #9, evolved): a reverse copier throws the SPL to cell 24 and sprays on through its B-field; the mirror reads up from cursor 32 (B-postincrement) while the walker steps it down, writing down A-streams from 42 and 57. The published copier start (24) wipes its own SPL at cycle 521 when alone, which the gate refuses; 25 survives and plays the same (1.441 against 1.434).',
    tree: () => ({ id: 'nano-mirror-clear', P: { SLOT: 2, PTR: 76, FEEDMOD: 1, SIDEM: 1, SIDE: 67, COPYB: 25, CURM: 1, CURSOR: 32, WALKM: 1, STRM: 2, STREAM: 42, DJNM: 2, DJNC: 57, DJNMOD: 1 } }),
  },
  'top10-nano-nanocracker': {
    ...nano,
    purpose: 'NanoCracker (Terry Newton, #10, evolved with mevo): a SPL whose two fields are the pointers (from 42 and 71, its side effect riding the B pointer), a swap-back, an upward sweep from 49 into the A pointer and a DJN on the A pointer.',
    tree: () => ({ id: 'nano-twin-clear', P: { SLOT: 0, PA: 42, PB: 71, SIDEM: 1, FEEDMOD: 1, SWEEP: 49, DJNMOD: 1 } }),
  },
};
