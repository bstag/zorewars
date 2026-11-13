// Named trees: well-known designs written as blocks and combinators, as
// starting points for evolution and as examples. Each says which rule sets it
// is meant for (and `length`, the length limit it needs, when it isn't 50);
// test/algebra.test.js builds every one there.

import {configureStoneImp} from './stone-imp-options.js';
import {recipeSettings} from '../blocks/recipes.js';
const stone = (TSTEP = 4) => ({ id: 'stone', P: { TSTEP, TBOMB: 0 } });
const stoneImpExample=()=>({id:'seq',kids:[
  {id:'opening-qscan-mul',P:{QFAC:347,GAP:138,UNITS:6,SHARE:0}},
  {id:'probe-burst2',P:{COUNT:17,STEP:6,OFFSET:0,GAP:82,BOMB:0}},
  {id:'fanboot',P:{N:4,K:1,SPLIT:1,HOPA:3362,HOPB:2391,MOREA:1},kids:[
    {id:'armadillo-switch',P:{STEP:3510,HOP:56,STREAM:1}},
    {id:'compact-imp-pump',P:{N:7,LEAD:64,IMM:1,RETIRE:1}},
  ]},
]});
const stoneImpProfile={rules:['94nop'],length:100,verification:'full',strictRules:true};
const tinyLpPaper = () => ({ id: 'tiny-lp-pointer-paper', P: { ATTACK: 0 } });
const tinyLpStonePaper = () => ({ id: 'par', kids: [{ id: 'tiny-lp-stone-triad' }, tinyLpPaper()] });
const bootedPhasePaper = (P) => ({
  id: 'par', kids: [
    { id: 'lp-scatter-paper', P: { HOP: 1000, COUNT: 21, SCATTER: 0 } },
    { id: 'boot', P: { HOP: 5952 }, kids: [{ id: 'lp-phase-stone', ...(P && { P }) }] },
  ],
});
const tinyLpScanAttack = (body) => ({ id: 'seq', kids: [
  { id: 'opening-qscan-decode', P: { N: 4, START: 150, SPACING: 83, GAP: 13 } },
  { id: 'probe-burst2', P: { COUNT: 4, STEP: 7, GAP: 23, SIDE: 1 } },
  body,
] });

export const recipes = {
  'nano-lane': {
    rules: ['nano'], length: 5, verification: 'full', strictRules: true,
    purpose: 'A five-cell Nano scanner whose comparison and attack share a pointer.',
    tree: () => ({ id: 'nano-lane' }),
  },
  'nano-relay-clear': {
    rules: ['nano'], length: 5, verification: 'full', strictRules: true,
    purpose: 'A five-cell attacker whose first strike overwrites the cursor that supplies its relay.',
    tree: () => ({ id: 'nano-relay-clear' }),
  },
  'tiny-copy-paper': {
    rules: ['tiny'], length: 20, verification: 'full', strictRules: true,
    purpose: 'A fixed remote copy burst followed by a booted paper on the 800-cell hill.',
    tree: () => ({ id: 'seq', kids: [{ id: 'tiny-copy-burst' }, { id: 'boot-paper' }] }),
  },
  'tiny-resonant-paper': {
    rules: ['tiny'], length: 20, verification: 'full', strictRules: true,
    purpose: 'A remote copy opening followed by a silk whose two displacements return a descendant next to the original copy stage.',
    tree: () => ({ id: 'seq', kids: [{ id: 'tiny-copy-burst' }, { id: 'tiny-resonant-silk' }] }),
  },
  'additive-clear-88': {
    rules: ['88', 'icws', 'icws64'], verification: 'full', strictRules: true,
    purpose: "A strict '88 additive quickscan that hands a decoded target to a guarded clear in 50 instructions.",
    tree: () => ({ id: 'seq', kids: [{ id: 'opening-qscan-add-88', P: { ROWS: 6 } }, { id: 'finisher-guarded-88', P: { PHASE: 0 } }] }),
  },
  'twinned-stone': {
    rules: ['88', 'icws', 'icws64'], verification: 'full', strictRules: true,
    purpose: 'A one-process stone beside two equal-step imp trails launched by direct binary jumps.',
    tree: () => ({ id: 'par', kids: [{ id: 'stone' }, { id: 'binary-twin-imp' }] }),
  },
  'table-stones': {
    rules: ['pspace', 'lp-hill', '94x-hill', 'tinylp'], verification: 'full', strictRules: true,
    purpose: 'A four-state outcome table selecting between two differently spaced stones.',
    tree: () => ({ id: 'switch-table', kids: [{ id: 'stone' }, { id: 'stone', P: { TSTEP: 8 } }] }),
  },
  'packed-stones': {
    rules: ['pspace', 'lp-hill', '94x-hill', 'tinylp'], verification: 'full', strictRules: true,
    purpose: 'The table-stones policy encoded as result-specific residues in 31 cells.',
    tree: () => ({ ...recipes['table-stones'].tree(), P: { PACKED: 1 } }),
  },
  'paired-clear': {
    rules: ['tiny', 'tinylp', 'lp-hill'], length: 20, verification: 'full', strictRules: true,
    purpose: 'Two copy workers deploy a remote clear, then divide between its home and remote images.',
    tree: () => ({ id: 'paired-clear' }),
  },
  'paired-clear-staged': {
    rules: ['tinylp'], verification: 'full', strictRules: true,
    purpose: 'A counted home-and-remote deployment with a bounded SPL prefix and a two-write DAT sweep at each site.',
    tree: () => ({ id: 'paired-clear-staged', P: { HOP: 380 } }),
  },
  'paired-clear-feeder': {
    rules: ['tinylp'], length: 15, verification: 'full', strictRules: true,
    purpose: 'Two clear sites copy the live SPL that grows their queues, then the surviving site switches to DAT.',
    tree: () => ({ id: 'paired-clear-feeder' }),
  },
  'tiny-lp-stone-paper': {
    rules: ['tinylp'], length: 19, verification: 'full', strictRules: true,
    purpose: 'Three single-process stones run beside a compact paper with a shared copy and entry pointer.',
    tree: tinyLpStonePaper,
  },
  'tiny-lp-scan-paper': {
    rules: ['tinylp'], length: 33, verification: 'full', strictRules: true,
    purpose: 'A decoding quickscan and two-stream DAT burst before the shared-pointer paper.',
    tree: () => tinyLpScanAttack(tinyLpPaper()),
  },
  'tiny-lp-scan-stone-paper': {
    rules: ['tinylp'], length: 46, verification: 'full', strictRules: true,
    purpose: 'A decoding quickscan and two-stream DAT burst before the three-stone and pointer-paper launcher.',
    tree: () => tinyLpScanAttack(tinyLpStonePaper()),
  },
  'tiny-lp-trap-scan': {
    rules: ['tinylp'], length: 10, verification: 'full', strictRules: true,
    purpose: 'A single-process scanner that guards its linked image and traps occupied cells with a JMP.',
    tree: () => ({ id: 'tiny-lp-trap-scan' }),
  },
  'lp-scatter-paper': {
    rules: ['lp', 'lp-hill'], length: 7, verification: 'full', strictRules: true,
    purpose: 'Seven-cell backward-copy paper with doubling scatter offsets and a guarded transfer.',
    tree: () => ({ id: 'lp-scatter-paper' }),
  },
  'lp-bronze-paper': {
    rules: ['lp', 'lp-hill'], length: 16, verification: 'full', strictRules: true,
    purpose: 'Two backward-copy bombing papers with distinct restart lengths and destinations.',
    tree: () => ({
      id: 'par',
      // par schedules its SPL child after the continuation JMP, as the source does.
      kids: [[6414, 17, 155], [5740, 20, 2903]].map(([HOP, COUNT, RESTART]) => ({
        id: 'lp-scatter-paper', P: { HOP, COUNT, RESTART, READMODE: 1, READ: 1171, WRITE: 826 },
      })),
    }),
  },
  'lp-mutation-stone': {
    rules: ['lp', 'lp-hill'], length: 11, verification: 'full', strictRules: true,
    purpose: 'A planned stone shot replaces its stride with a jump into a bounded DAT clear.',
    tree: () => ({ id: 'lp-mutation-stone' }),
  },
  'lp-mutation-paper': {
    rules: ['lp', 'lp-hill'], length: 19, verification: 'full', strictRules: true,
    purpose: 'A self-writing stone and bounded clear share the LP queue with a backward-copy paper.',
    tree: () => ({
      id: 'par', kids: [
        { id: 'lp-mutation-stone', P: { STEP: 32, SHOTS: 128 } },
        { id: 'lp-scatter-paper', P: { HOP: 2000, COUNT: 20, SCATTER: 0 } },
      ],
    }),
  },
  'lp-phase-stone': {
    rules: ['lp', 'lp-hill'], length: 6, verification: 'full', strictRules: true,
    purpose: 'Two workers enter a shared stone at different phases and advance the target between writes.',
    tree: () => ({ id: 'lp-phase-stone' }),
  },
  'lp-phase-paper': {
    rules: ['lp', 'lp-hill'], length: 14, verification: 'full', strictRules: true,
    purpose: 'A two-worker stone interleaves stride and write turns beside a quiet backward-copy paper.',
    tree: () => ({
      id: 'par', kids: [
        { id: 'lp-phase-stone' },
        { id: 'lp-scatter-paper', P: { HOP: 1000, COUNT: 21, SCATTER: 0 } },
      ],
    }),
  },
  'lp-booted-phase-paper': {
    rules: ['lp', 'lp-hill'], length: 21, verification: 'full', strictRules: true,
    purpose: 'Boots a two-worker phase stone away from a backward-copy paper while retaining its ADD-plus-JMP launch.',
    tree: () => bootedPhasePaper(),
  },
  'lp-sparse-phase-paper': {
    rules: ['lp', 'lp-hill'], length: 21, verification: 'full', strictRules: true,
    purpose: 'Keeps the phase stone boot and gives the stone a sparse lane with fewer quiet hits on its paper companion.',
    tree: () => bootedPhasePaper({ STEP: 160, OFFSET: 46 }),
  },
  'lp-hidden-return-paper': {
    rules: ['lp', 'lp-hill'], length: 21, verification: 'full', strictRules: true,
    purpose: 'Keeps the sparse stone lane and makes its return jump transparent to A-only probes.',
    tree: () => bootedPhasePaper({ STEP: 160, OFFSET: 46, HIDERETURN: 1 }),
  },
  'lp-outcome-switch': {
    rules: ['lp-hill'], length: 32, verification: 'full', strictRules: true,
    purpose: 'Three outcome-dependent states dispatch between a guarded scatter paper and a stone.',
    tree: () => ({
      id: 'switch-table', P: { FIRST: 0, LOSS: 0x4409, WIN: 0x9944, TIE: 0x0040, PACKED: 1 },
      kids: [{ id: 'lp-scatter-paper' }, { id: 'stone', P: { TSTEP: 4 } }],
    }),
  },
  'lp-opposed-scanners': {
    rules: ['lp', 'lp-hill'], length: 29, verification: 'full', strictRules: true,
    purpose: 'Four opposed A-field scanners with two disjoint residue lanes and a checked boot.',
    tree: () => ({ id: 'lp-opposed-scanners' }),
  },
  'lp-dense-scanners': {
    rules: ['lp', 'lp-hill'], length: 29, verification: 'full', strictRules: true,
    purpose: 'Four opposed JMP scanners with 200 probe cells per lane and a protected deployment.',
    tree: () => ({ id: 'lp-opposed-scanners', P: { START: 31, SPREAD: 4, STEP: 40 } }),
  },
  'lp-transparent-pair': {
    rules: ['lp', 'lp-hill'], length: 26, verification: 'full', strictRules: true,
    purpose: 'Two opposed A-field scanners with a late peer lock and a self-triggered DAT clear.',
    tree: () => ({ id: 'lp-transparent-pair' }),
  },
  'lp-transparent-quartet': {
    rules: ['lp', 'lp-hill'], length: 54, verification: 'full', strictRules: true,
    purpose: 'Two transparent scanner pairs on opposite parities with an observed shared clear queue.',
    tree: () => ({ id: 'lp-transparent-quartet' }),
  },
  'lp-partitioned-quartet': {
    rules: ['lp', 'lp-hill'], length: 68, verification: 'full', strictRules: true,
    purpose: 'Two transparent pairs and two bounded DAT sectors with a feeder that survives the process cap.',
    tree: () => ({ id: 'lp-partitioned-quartet' }),
  },
  'lp-sector-pair': {
    rules: ['lp', 'lp-hill'], length: 19, verification: 'full', strictRules: true,
    purpose: 'Two independent DAT sectors whose feeders remain live in the shared queue.',
    tree: () => ({ id: 'par', kids: [255, 4190].map(START => ({ id: 'lp-sector-clear', P: { START } })) }),
  },
  'lp-paced-sectors': {
    rules: ['lp', 'lp-hill'], length: 43, verification: 'full', strictRules: true,
    purpose: 'Four bounded DAT sectors paced to share writer turns under the eight-process cap.',
    tree: () => ({
      id: 'par', kids: [253, 2037, 3927, 5917].map(START => ({ id: 'lp-sector-clear', P: { START, WIDTH: 1200, PACE: 1 } })),
    }),
  },
  'lp-quickscan-sector': {
    rules: ['lp', 'lp-hill'], length: 42, verification: 'full', strictRules: true,
    purpose: 'A decoding quickscan that aims a bounded DAT sector with a checked fallback.',
    tree: () => ({
      id: 'seq', kids: [
        { id: 'opening-qscan-decode', P: { START: 320, SPACING: 910, GAP: 17, N: 8 } },
        { id: 'lp-probe-sector' },
      ],
    }),
  },
  'lp-opposed-handoff': {
    rules: ['lp', 'lp-hill'], length: 49, verification: 'full', strictRules: true,
    purpose: 'Four opposed scanners check a JMP strike before converting to bounded DAT sweeps.',
    tree: () => ({ id: 'lp-opposed-scanners', P: { SPREAD: 10, HANDOFF: 2 } }),
  },
  'fanboot-stone-imp-example': {
    ...stoneImpProfile,
    purpose:'MUL quickscan and probe burst with a four-worker stone and seven-point local-template imp pump.',
    tree:()=>stoneImpExample(),
  },
  'fanboot-stone-imp-preseeded': {
    ...stoneImpProfile,
    purpose:'Uses a preseeded four-cell imp launcher and a different quickscan factor.',
    tree:()=>configureStoneImp(stoneImpExample(),recipeSettings('94nop',100),{seedMode:1,scan:{QFAC:247}}).tree,
  },
  'fanboot-stone-imp-seed-only': {
    ...stoneImpProfile,
    purpose:'Uses the same scan as the local-template example with a preseeded four-cell launcher.',
    tree:()=>configureStoneImp(stoneImpExample(),recipeSettings('94nop',100),{seedMode:1}).tree,
  },
  'fanboot-stone-imp-local-template': {
    ...stoneImpProfile,status:'diagnostic-control',
    purpose:'Seeds the head before boot and copies a local template that the launcher reads.',
    tree:()=>configureStoneImp(stoneImpExample(),recipeSettings('94nop',100),{seedMode:3}).tree,
  },
  compass: {
    rules: ['94nop', '94x'],
    purpose: 'Comparison scanner booted away from its decoys, then a guarded clear from the cell it found (Compass).',
    tree: (rules) => ({ id: 'boot', P: { HOP: rules === '94x' ? 20000 : 3000 }, kids: [
      { id: 'seq', kids: [{ id: 'opening-cmpscan', P: { SSTEP: rules === '94x' ? 4001 : 3044, GAP: 5, START: 700, SCANS: 40 } },
        { id: 'finisher-guarded', P: { PHASE: 1, STUN: 100 } }] },
      { id: 'decoys', P: { DECOYS: 12, DECOY: 0 } }] }),
  },
  'one-shot': {
    rules: ['94nop', '94x'],
    purpose: 'Scan until something differs, then clear forward from it, skipping its own image.',
    tree: () => ({ id: 'seq', kids: [{ id: 'opening-cmpscan', P: { SSTEP: 3044, GAP: 5, START: 700, SCANS: 64 } }, { id: 'finisher-guarded', P: { PHASE: 1, STUN: 64 } }] }),
  },
  'bomber-clear': {
    rules: ['88', '94nop', 'lp', '94x'],
    purpose: 'A timed bomber, then the clear relocated away from where the bombing started.',
    tree: () => ({ id: 'seq', kids: [{ id: 'opening-bomber', P: { WAIT: 128, STEP: 997 } }, { id: 'relocate', P: { HOP: 2900 }, kids: [{ id: 'finisher-counted', P: { PHASE: 1, STUN: 64, BACKWARD: 0 } }] }] }),
  },
  'stone-imp': {
    rules: ['88', '94nop'],
    purpose: 'A stone and an imp spiral booted away together (stone/imp).',
    tree: () => ({ id: 'boot', P: { HOP: 3000 }, kids: [{ id: 'par', kids: [stone(), { id: 'spiral', P: { SN: 13, SK: 4 } }] }] }),
  },
  'paper-stone': {
    rules: ['94nop', '94x'],
    purpose: 'A silk paper with a stone beside it.',
    tree: () => ({ id: 'par', kids: [{ id: 'paper', P: { PSTEP: 1777, PDELTA: 1013 } }, stone()] }),
  },
  'distributed-stones': {
    rules: ['88', '94nop'],
    purpose: 'Three stones a third of the core apart, so one hit can\'t stop the bombing.',
    tree: () => ({ id: 'copies', P: { N: 3, D: 2667 }, kids: [stone()] }),
  },
  'stone-then-clear': {
    rules: ['88', '94nop', '94x'],
    purpose: 'A stone that turns into a core clear after a fixed time.',
    tree: () => ({ id: 'trigger', P: { MODE: 0, TIME: 2000 }, kids: [stone(), { id: 'finisher-counted', P: { PHASE: 1, STUN: 64, BACKWARD: 0 } }] }),
  },
  watchdog: {
    rules: ['94nop'],
    purpose: 'A vampire with a watchdog: if its loop is hit, a stone takes over (in the spirit of Lifeboat).',
    tree: () => ({ id: 'trigger', P: { MODE: 2, TIME: 1 }, kids: [{ id: 'vampire', P: { VSTEP: 7 } }, stone(16)] }),
  },
  waveboot: {
    rules: ['88', '94nop'],
    purpose: 'A redundant process wave boots a stone and an imp spiral together and splits between them (parboot of a par): a bomb on one copy loop cannot stop the boot.',
    tree: () => ({ id: 'parboot', P: { K: 2, HOP: 3000, HOPY: 0, HOPZ: 0, STAY: 0, REACT: 0, HOP2: 2000, HOP2Y: 0, HOP2Z: 0, CARPET: 8 },
      kids: [{ id: 'par', kids: [{ id: 'mod-stone', P: { STEP: 2936, BOMBS: 1, GUARD: 1 } }, { id: 'spiral', P: { SN: 7, SK: 3 } }] }] }),
  },
  'hill-fork': {
    rules: ['94nop', '94x'],
    length: 100,                                 // the 94nop hill's length limit
    purpose: 'A MUL quickscan picks the body (docs/hill-recipe-book.md): a hit gets the One Shot pointer-overwrite clear from the found cell, nothing found gets a silk paper with a backward tail. 1.05 points a round against the 94nop top 50.',
    tree: () => ({ id: 'fork', kids: [{ id: 'opening-qscan-mul' }, { id: 'finisher-overwrite' }, { id: 'tail-silk' }] }),
  },
  'spread-stone-spiral': {
    rules: ['94nop'],
    purpose: 'A stone, with an imp spiral started 4000 cells away from it.',
    tree: () => ({ id: 'apart', P: { D: 4000 }, kids: [stone(), { id: 'spiral', P: { SN: 7, SK: 3 } }] }),
  },
  // 94nop top-30 shapes in 50 instructions (docs/hill-top30/94nop.md). The fan boot checks run-stone's
  // lattice: the paper's copy starts a multiple of 8 from the stone's (HOPB + 6 - HOPA).
  'run-stone-loop-paper': {
    rules: ['94nop'],
    purpose: 'Quickscan and burst, then a six-process fan boot of the never-stopping run-stone (12 processes) and the six-line looping paper (6), the paper kept off the lattice the stone bombs. 50 instructions; 1.10 points a round against the 94nop top 30 (50 rounds).',
    tree: () => ({ id: 'seq', kids: [{ id: 'opening-qscan-mul', P: { UNITS: 3, SHARE: 1 } }, { id: 'probe-burst2' },
      { id: 'fanboot', P: { N: 6, K: 2, HOPA: 3200, HOPB: 1002 }, kids: [{ id: 'run-stone' }, { id: 'loop-paper6', P: { FAN: 0 } }] }] }),
  },
  'run-stone-stream-paper': {
    rules: ['94nop'],
    purpose: 'As run-stone-loop-paper with the five-line three-stream paper, on an eight-process fan (16 into the stone, 8 into the paper): 24 cells a lap and a STEP that is a multiple of 8 keep every copy off the lattice; STEP 1512 (189 x 8) also keeps copies of copies from coming home for 16 generations. 49 instructions; 1.07 points a round against the 94nop top 30 (50 rounds; the six-process paper scored 1.10 with its later copies on the lattice).',
    tree: () => ({ id: 'seq', kids: [{ id: 'opening-qscan-mul', P: { UNITS: 3, SHARE: 1 } }, { id: 'probe-burst2' },
      { id: 'fanboot', P: { N: 8, K: 2, HOPA: 3200, HOPB: 1002 }, kids: [{ id: 'run-stone' }, { id: 'stream-paper3', P: { FAN: 0, TAIL: 0, PROCS: 8, STEP: 1512 } }] }] }),
  },
  'three-body-launch': {
    rules: ['94nop'], length: 100, verification: 'full',
    purpose: 'The stone + d-clear + imp pump launch, split 4 / 1 / 4 (the shape of Son of Vain): a ten-unit quickscan and burst, then a four-process fanboot3 (ROUTE 1) sends four processes into a self-switching stone, one into a bounded gated d-clear whose span holds neither partner, and four into a lockstep three-point imp pump. 94 instructions; 1.09 points a round against the 94nop top 30 (50 rounds).',
    tree: () => ({ id: 'seq', kids: [{ id: 'opening-qscan-mul', P: { UNITS: 10, SHARE: 1 } }, { id: 'probe-burst2' },
      { id: 'fanboot3', P: { N: 4, ROUTE: 1, HOPA: 3000, HOPB: 7000, HOPC: 4400 }, kids: [{ id: 'armadillo-switch', P: { STEP: 3510, HOP: 56, STREAM: 1 } }, { id: 'gated-dclear' }, { id: 'fan-imp-pump', P: { FAN: 0, PROCS: 4 } }] }] }),
  },
  'q45-run-stone-loop-paper': {
    rules: ['94nop'], length: 100,
    purpose: 'The Hullabaloo / Borgir shape at the hill\'s own length: a 33-cell q^4.5 quickscan and burst, then a six-process fan boot of the never-stopping run-stone (12 processes) and the six-line looping paper (6), the source image left behind as a decoy. 76 instructions; 1.15 points a round against the 94nop top 30 (100 rounds), the best new paper/stone measured at length 100.',
    tree: () => ({ id: 'seq', kids: [{ id: 'opening-qscan-mul45', P: { UNITS: 6, UNITS2: 4 } }, { id: 'probe-burst2' },
      { id: 'fanboot', P: { N: 6, K: 2, HOPA: 3200, HOPB: 1002 }, kids: [{ id: 'run-stone' }, { id: 'loop-paper6', P: { FAN: 0 } }] }] }),
  },
};
