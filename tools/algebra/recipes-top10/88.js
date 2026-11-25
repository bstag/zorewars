// Recipes that rebuild the Koenigstuhl 88 hill's top 10 from blocks (see
// docs/hill-top10/88.md for how close each one plays to the original).
// Keys are 'top10-88-<warrior>'; recipes.js merges this file into its table.
//
// Points are per round against the hill's top 30 (100 rounds each, the
// original first): measured 22 November 2026.
const wide88 = { rules: ['88'], verification: 'full', strictRules: true, length: 100 };
const seq = (...kids) => ({ id: 'seq', kids });
const qm = (P = {}) => ({ id: 'opening-qscan-m-88', P });
// The Janeczek quickscans: 12 pairs 161 apart, a six-pass burst stepping 9.
const qmJ = { PAIRS: 12, GAP: 161, COUNT: 6, STEP: 9, DB: 43 };

export default {
  'top10-88-lithobolia': {
    ...wide88,
    purpose: 'Lithobolia C yvfp: a 13-pair quickscan with a 12-pass carpet, then seven one-process resins booted 992 apart and a six-cell-stage paper ending in a 3-point imp pump. 1.21 against the original\'s 1.36.',
    tree: () => seq(qm({ PAIRS: 13, GAP: 1168, COUNT: 12, STEP: 5, DB: 48 }), { id: 'resin-paper-88' }),
  },
  'top10-88-talisman': {
    ...wide88,
    purpose: 'Talisman: an 18-pair decoding quickscan with its carpet, then a five-process boot into a pair-bombing stone (step -2211) and a 3-point pump over three boot-laid imps; at pass 1819 the stone bombs its own second MOV and becomes an SPL-fed backward clear. 1.31 against 1.35.',
    tree: () => seq(qm(), { id: 'selfclear-stone-pump-88', P: { STEP: 5789 } }),
  },
  'top10-88-freight-train': {
    ...wide88,
    purpose: 'Freight Train v0.2: a 13-pair decoding quickscan (standing in for Moore\'s q^2), then a Cannonade-style stone that turns into a forward clear at pass 2437, an eight-imp vector launch onto a 7-point spiral and two continuous pumps feeding it. 1.37 against 1.38.',
    tree: () => seq(qm({ PAIRS: 13, GAP: 163 }), { id: 'cannonade-pump-88' }),
  },
  'top10-88-resinoid': {
    ...wide88,
    purpose: 'Resinoid: an 18-pair decoding quickscan, then two two-head resins 4000 apart started with six processes each and a one-stage paper ending in a 3-point imp pump (the original grows its imps in place). 1.15 against 1.31.',
    tree: () => seq(qm(), { id: 'resin-paper-88', P: { RPROCS: 6, RESINS: 2, HEADS: 2, SPLIT: 0, RHOP: 1300, HOP: 4000, FIRST: 3321, STREAM: 7900, STAGES: 1, STEP1: 1085 } }),
  },
  'top10-88-quicksilver': {
    ...wide88,
    purpose: 'Quicksilver \'88: a 12-pair quickscan with a six-pass burst, then the stone/pump boot with its layout: the stone (step -107) bombs its own pump head at pass 47, after about a dozen launches, and its own second MOV at pass 1868. 1.27 against 1.30.',
    tree: () => seq(qm(qmJ), { id: 'selfclear-stone-pump-88', P: { STEP: 7893, TIME: 1868, STREAM: 5246, BOFF: 11, DEC: 17, HOP: 4857, PHOP: 2849, IOFF: 6111, GUARD: 0 } }),
  },
  'top10-88-into-the-unknown': {
    ...wide88,
    purpose: 'Into the Unknown: an 18-pair decoding quickscan, then one boot that sends 18 processes into a timed pair-bombing stone (step 5789, its end at pass 1344) and nine into a three-stage paper ending in an SPL-fed clear. 1.29 against 1.36.',
    tree: () => seq(qm(), { id: 'paper-stone-boot-88' }),
  },
  'top10-88-mountain-viper': {
    ...wide88,
    purpose: 'Mountain Viper: a 10-pair decoding quickscan, then a booted 0.66c one-shot whose increment is the jump into its SPL-then-DAT clear, and a 42-cell SPL decoy. 1.28 against 1.42 (the same tree without the quickscan scores 1.29).',
    tree: () => ({
      id: 'image', kids: [
        seq(qm({ PAIRS: 10, GAP: 624 }), { id: 'oneshot-88' }),
        { id: 'spl-decoy-strip-88', P: { COUNT: 42, CYCLE: 7 } },
      ],
    }),
  },
  'top10-88-zygote': {
    ...wide88,
    purpose: 'Zygote (hill version): a 12-pair quickscan, then seven processes on an in-place stone (step -107) and seven on a looping paper that copies itself, bombs under each copy and runs a bomb stream; 33 empty cells follow. 1.23 against 1.33.',
    tree: () => ({
      id: 'image', kids: [
        seq(qm(qmJ), { id: 'stone-loop-paper-88' }),
        { id: 'blank-padding-88', P: { COUNT: 33 } },
      ],
    }),
  },
  'top10-88-elemental-dust-2': {
    ...wide88,
    purpose: 'Elemental Dust 2: no quickscan; a booted SPL-fed fang vampire (step 644) with a pit whose prisoners clear the core with anti-imp DATs, two laps of a 3-point imp ring from a binary tree, and DAT #pit, #1 decoys in every gap. 1.35 against 1.36.',
    tree: () => ({ id: 'pit-vampire-imp-88' }),
  },
  'top10-88-der-zweite-blitzkrieg': {
    ...wide88,
    purpose: 'Der Zweite Blitzkrieg 2021: an 18-pair decoding quickscan, then six processes on a mod-8 stone that, after 1000 passes, copies a prepared SPL onto its own JMP and falls into an SPL-then-DAT clear ending as a gate, beside a 15-imp one-pass 7-point spiral. 1.27 against 1.34.',
    tree: () => seq(qm(), { id: 'blitz-stone-spiral-88' }),
  },
};
