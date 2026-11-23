// Recipes that rebuild the Koenigstuhl P-space hill's top 10 from blocks (see
// docs/hill-top10/pspace.md for how close each one plays to the original).
// Keys are 'top10-pspace-<warrior>'; recipes.js merges this file into its table.
//
// Every tree takes the rule set: on 'modelwar' (25,200 cells) distances and
// counters are scaled from 8,000 and steps moved to the nearest value with the
// same gcd, so `recipe <key> --rules modelwar --length 5040` builds a ModelWar
// version of the same design. Scores in the purposes are points a round
// against the hill's top 30 (`--rules pspace`, 50 rounds a pairing, seed 1)
// for the rebuild / the original.
//
// The P-space selectors are switch-table ROWS 1: the P^3 table itself (state k
// plays a member and names its next state after a loss, a win and a tie), as
// Sunset, Mantrap Arcade, Combatra and Recycled Bits store it. A row is
// [member, next after a loss, next after a win, next after a tie].

const CORE = 8000;
const isHill = (rules) => rules !== 'modelwar';
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const coreOf = (rules) => (isHill(rules) ? CORE : 25200);
// A distance or a counter scaled from 8,000 to the rule set's core.
const sc = (v, rules) => (isHill(rules) ? v : Math.round((v * coreOf(rules)) / CORE));
// A step scaled with the gcd it has on 8,000 (1 stays coprime).
const st = (v, rules) => {
  if (isHill(rules)) return v;
  const core = coreOf(rules), want = gcd(gcd(v, CORE), core), base = Math.round((v * core) / CORE);
  for (let d = 0; d < core; d++) for (const s of [base + d, base - d]) if (s > 0 && s < core && gcd(s, core) === want) return s;
  return base;
};
const rows = (table, FIRST = 0) => ({ ROWS: 1, STATES: table.length, FIRST,
  ...Object.fromEntries(table.map(([m, l, w, t], k) => [`R${k}`, m + 8 * l + 128 * w + 2048 * t])) });
const boot = (HOP, kid, P = {}) => ({ id: 'boot', P: { HOP, ...P }, kids: [kid] });

// Moore's paper/stone (Sunset and Just experimenting 1.4; Cooperative Black Dimension's numbers with cbd).
const paperStone = (rules, cbd = false) => ({ id: 'sunset-paper-stone', P: cbd
  ? { SHOP: sc(4275, rules), PHOP: sc(3524, rules), STEP: st(2862, rules), OFF: sc(4655, rules), PSTEP: sc(431, rules), PBOMB: sc(4692, rules) }
  : { SHOP: sc(5300, rules), PHOP: sc(5523, rules), STEP: st(2862, rules), OFF: sc(4655, rules), PSTEP: sc(4200, rules), PBOMB: sc(5200, rules) } });
const recon = (rules) => ({ id: 'recon-scanner', P: { STEP: st(6557, rules), TIME: sc(4800, rules) } });
// Sunset's own P^3 table, state for state (11 states; members: paper/stone, Recon 2 at A, at B).
const SUNSET = [[0, 4, 9, 4], [0, 4, 9, 0], [2, 0, 6, 6], [0, 7, 10, 5], [1, 7, 8, 8], [0, 2, 10, 7], [2, 2, 6, 6], [0, 2, 10, 2], [1, 4, 8, 8], [0, 0, 9, 1], [0, 5, 10, 3]];
const sunsetTree = (rules, CELL) => ({ id: 'switch-table', P: { CELL, ...rows(SUNSET) }, kids: [
  paperStone(rules),
  boot(sc(1282, rules), recon(rules), { DIRECT: 1, SHARE: 1 }),
  { id: 'redeploy', P: { HOP: sc(6800, rules) } },
] });
// mini Blur's step on another core: the nearest coprime step whose TIME looks never land on a
// cell of the block with a non-zero field (offsets -2..2 and 4..6 from its ADD), as on 8,000.
const blurStep = (rules, TIME) => {
  if (isHill(rules)) return 2891;
  const core = coreOf(rules), bad = new Set([-2, -1, 0, 1, 2, 4, 5, 6].map((o) => (o + core) % core)), base = Math.round((2891 * core) / CORE);
  const ok = (s) => { for (let j = 1; j <= TIME; j++) if (bad.has((core - ((s * j) % core)) % core)) return false; return true; };
  for (let d = 0; d < core; d++) for (const s of [base + d, base - d]) if (gcd(s, core) === 1 && ok(s)) return s;
  return base;
};
const blur = (rules, TIME = 2210) => boot(sc(2942, rules), { id: 'mini-blur', P: { STEP: blurStep(rules, sc(TIME, rules)), TIME: sc(TIME, rules), START: sc(2951, rules) } }, { DIRECT: 1 });
// Stealth Carbonite's time-up on another core: the longest TIME (up to the scaled one) whose
// bombs reach the ADD before any other cell of the loop.
const carbTime = (rules, STEP, TIME) => {
  if (isHill(rules)) return TIME;
  // Write k lands at 1 + STEP*(k - TIME) past the MOV: the loop is safe while TIME - k < m, the
  // first m with 1 - STEP*m on the SPL, the MOV or the DJN.
  const core = coreOf(rules), live = new Set([core - 1, 0, 2]);
  for (let m = 1; m <= TIME; m++) if (live.has((((1 - STEP * m) % core) + core) % core)) return m - 1;
  return TIME;
};
const fiPaper = (rules) => ({ id: 'fi-paper', P: { BOOT: sc(2319, rules), STEP1: sc(4195, rules), STEP2: sc(6234, rules) } });
// Fire and Ice's brain: scanner (weak, the first), scanner (strong), paper.
const FIRE = [[0, 2, 1, 0], [0, 0, 1, 1], [1, 1, 2, 0]];
const dwarf = (rules) => ({ id: 'skew-dwarf', P: { STEP: st(81, rules), TIME: sc(1677, rules), GATE: sc(5277, rules) } });
const qscan = (UNITS) => ({ id: 'opening-qscan-mul', P: { UNITS } });

export default {
  'top10-pspace-sunset': {
    rules: ['pspace'], length: 100,
    purpose: 'Sunset (David Moore, #1): Moore\'s P^3 table, all 11 states, over his paper/stone (a fan boot of a never-stopping stone and a replicator) and Recon 2 (a .8c two-pair scanner with a SPL wipe and a timed DAT clear) booted to two places by one shared payload. 93 instructions. 1.48 / 1.48 (three seeds: 1.48 / 1.50).',
    tree: (rules) => sunsetTree(rules, 234),
  },
  'top10-pspace-cooperative-black-dimension': {
    rules: ['pspace'], length: 100,
    purpose: 'Cooperative Black Dimension 1.0 (Escritt / Schmidt, #2): a MUL-decoding quickscan and burst, then Moore\'s paper/stone with its own numbers. Its PIN handshake (shared P-space, which the VM does not give; it throws round 1 against everyone else) is left out. 79 instructions. 1.50 / 1.49.',
    tree: (rules) => ({ id: 'seq', kids: [qscan(8), { id: 'probe-burst2', P: { COUNT: 14, STEP: 7 } }, paperStone(rules, true)] }),
  },
  'top10-pspace-mantrap-arcade': {
    rules: ['pspace'], length: 100,
    purpose: 'Mantrap Arcade (Dave Hillis, #3): its 18-row P^3 table reduced to the nine states reachable from the first round (the fourth arm, the CLP snare dodger, is never played unless the state is brainwashed), over the Nomolos paper, Patel\'s skew dwarf and mini Blur. 91 instructions. 1.38 / 1.42 (three seeds: 1.35 / 1.43).',
    tree: (rules) => ({ id: 'switch-table', P: { CELL: 156, ...rows([[1, 6, 2, 8], [2, 4, 6, 1], [1, 3, 2, 3], [1, 4, 2, 5], [0, 2, 7, 1], [0, 2, 5, 7], [2, 1, 6, 6], [0, 3, 7, 7], [1, 1, 2, 3]]) }, kids: [
      { id: 'nomolos-paper', P: { DIST: sc(4000, rules), D0: sc(5689, rules), D1: sc(1021, rules), D2: sc(3607, rules), RANGE: sc(4723, rules) } },
      boot(sc(5420, rules), dwarf(rules), { DIRECT: 1 }),
      blur(rules),
    ] }),
  },
  'top10-pspace-just-experimenting': {
    rules: ['pspace'], length: 100,
    purpose: 'Just experimenting 1.4 (Blake Escritt, #4): Sunset with its state in another P-space cell and the rest of the image a live SPL decoy. The PIN handshake that throws round 1 against everyone but its author\'s other entries is left out. 100 instructions.',
    tree: (rules) => ({ id: 'image', kids: [sunsetTree(rules, 223), { id: 'decoys', P: { DECOYS: 7, DECOY: 2 } }] }),
  },
  'top10-pspace-combatra': {
    rules: ['pspace'], length: 100,
    purpose: 'Combatra (David Moore, #5): its 11-state P^3 table over an incendiary bomber, a SPL/DAT clear and a scanner. Combatra itself learns where the opponent boots (a quickscan, then a troll bomb that makes the opponent report its own position) and aims its scanner there; the catalog has no such learning, so the arms are stand-ins (incendiary-clear, sdd-clear, mini-blur). 77 instructions. 1.29 / 1.24 (three seeds: 1.25 / 1.25).',
    tree: (rules) => ({ id: 'switch-table', P: { CELL: 271, ...rows([[0, 10, 4, 2], [0, 10, 4, 2], [0, 10, 4, 2], [2, 8, 7, 3], [0, 2, 4, 4], [1, 10, 5, 5], [2, 7, 6, 6], [2, 3, 6, 7], [2, 9, 3, 8], [2, 2, 3, 9], [1, 4, 5, 5]]) }, kids: [
      boot(sc(3000, rules), { id: 'incendiary-clear', P: { STEP: st(2394, rules), TIME: sc(1378, rules), HOP: sc(7953, rules) } }),
      boot(sc(6942, rules), { id: 'sdd-clear', P: { PAD: 0, BACK: sc(2667, rules) } }),
      blur(rules),
    ] }),
  },
  'top10-pspace-aggression-is-a-switch': {
    rules: ['pspace'], length: 100,
    purpose: 'Aggression is a switch (M Joonas Pihlaja, #6): a quickscan and burst, then a P-space switch between a twin silk paper and Stealth Carbonite (switch on a loss). The original\'s q^2 quickscan (23 pairs, a decoder of at most two cycles and 18 bombs) is worth 0.15 to it; the catalog\'s MUL quickscan that fits beside the arms is worth 0.04. 97 instructions. 1.32 / 1.46.',
    tree: (rules) => ({ id: 'seq', kids: [qscan(8), { id: 'probe-burst2', P: { COUNT: 6 } }, { id: 'switch', P: { CELL: 1, POLICY: 0 }, kids: [
      { id: 'twin-silk', P: { DIST: sc(3532, rules), C1: sc(7085, rules), C2: sc(1953, rules), C3: sc(854, rules), C4: sc(687, rules), C5: sc(2228, rules) } },
      boot(sc(1457, rules), { id: 'carbonite-stone', P: { STEP: st(197, rules), TIME: carbTime(rules, st(197, rules), sc(3499, rules)), STREAM: sc(3501, rules) } }, { DIRECT: 1 }),
    ] }] }),
  },
  'top10-pspace-fire-and-ice': {
    rules: ['pspace'], length: 100,
    purpose: 'Fire and Ice (David Moore, #7): a three-state P-space brain (the scanner first, two strikes; the paper after it loses) over mini Blur and a six-process paper with a backward second stage. 57 instructions. 1.37 / 1.37.',
    tree: (rules) => ({ id: 'switch-table', P: { CELL: 40, ...rows(FIRE) }, kids: [blur(rules), fiPaper(rules)] }),
  },
  'top10-pspace-liquid-paper': {
    rules: ['pspace'], length: 100,
    purpose: 'Liquid Paper (Sean McDonald, #8): Fire and Ice with a shorter Blur (2,000 SPLs) and the rest of the image DAT 1, 1 decoys.',
    tree: (rules) => ({ id: 'image', kids: [{ id: 'switch-table', P: { CELL: 40, ...rows(FIRE) }, kids: [blur(rules, 2000), fiPaper(rules)] }, { id: 'decoys', P: { DECOYS: 18, DECOY: 0 } }] }),
  },
  'top10-pspace-return-of-vanquisher': {
    rules: ['pspace'], length: 100,
    purpose: 'Return of Vanquisher PsP (Lukasz Grabun, #9): a MUL-decoding quickscan and burst (the original\'s also drops STP brainwash bombs), then Vanquisher: four processes in a seven-line incendiary bomber that falls into a planted clear. No P-space selector. 98 instructions.',
    tree: (rules) => ({ id: 'seq', kids: [qscan(10), { id: 'probe-burst2', P: { COUNT: 11, STEP: 7 } },
      { id: 'vanquisher', P: { STEP: st(1022, rules), BOFF: sc(3408, rules), COFF: sc(7919, rules) } }] }),
  },
  'top10-pspace-recycled-bits': {
    rules: ['pspace'], length: 100,
    purpose: 'Recycled Bits (David Moore, #10): its P^2 table (each arm three or four levels deep, a loss moves down a level, the bottom level hands over) with the top bomber level merged into the one below to fit, over silk-imps, the skew dwarf, a Mirage-style scanner, a SPL/DAT clear and an incendiary bomber; all but the paper booted to the original\'s distances. 100 instructions. 1.38 / 1.42 (three seeds: 1.36 / 1.39).',
    tree: (rules) => ({ id: 'switch-table', P: { CELL: 321, ...rows([[0, 1, 1, 3], [1, 2, 5, 1], [2, 12, 6, 2], [3, 2, 7, 3], [4, 12, 8, 4], [1, 1, 9, 5], [2, 2, 10, 6], [3, 3, 11, 7], [4, 4, 8, 8], [1, 5, 9, 9], [2, 6, 10, 10], [3, 7, 11, 11], [4, 0, 4, 0]]) }, kids: [
      { id: 'imp-silk', P: { STEP1: sc(2333, rules), STEP2: sc(1737, rules) } },
      boot(sc(5416, rules), dwarf(rules)),
      boot(sc(5923, rules), { id: 'mirage-scanner', P: { PAD: 0, STEP: st(5379, rules), START: sc(5000, rules) } }),
      boot(sc(4235, rules), { id: 'sdd-clear', P: { PAD: 0, BACK: sc(2667, rules) } }),
      boot(sc(3250, rules), { id: 'incendiary-clear', P: { STEP: st(2394, rules), TIME: sc(1378, rules), HOP: sc(7953, rules) } }),
    ] }),
  },
};
