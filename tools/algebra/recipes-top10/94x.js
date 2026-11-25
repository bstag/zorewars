// Recipes that rebuild the Koenigstuhl 94x hill's top 10 from blocks (see
// docs/hill-top10/94x.md for how close each one plays to the original).
// Keys are 'top10-94x-<warrior>'; recipes.js merges this file into its table.
//
// Every tree takes the rule set: on 'modelwar' (25,200 cells) distances are
// rescaled from 55,440 and steps moved to the nearest value with the same gcd
// that the blocks accept, so `recipe <key> --rules modelwar --length 5040`
// builds a ModelWar version of the same design. Scores in the purposes are
// points a round against the hill's top 30 (`--rules 94x-hill`, 50 rounds a
// pairing, seed 1) for the rebuild / the original, then the rebuild against
// the original over 100 rounds (its wins-losses-ties).

const X = 55440;
const isX = (rules) => rules !== 'modelwar';
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
// A distance scaled from 55,440 to the rule set's core.
const sc = (v, rules) => (isX(rules) ? v : Math.round((v * 25200) / X));
// A step scaled with the gcd it has on 55,440 (1 stays coprime).
const st = (v, rules) => {
  if (isX(rules)) return v;
  const core = 25200, want = gcd(gcd(v, X), core), base = Math.round((v * core) / X);
  for (let d = 0; d < core; d++) for (const s of [base + d, base - d]) if (s > 0 && s < core && gcd(s, core) === want) return s;
  return base;
};
const boot = (HOP, kid, P = {}) => ({ id: 'boot', P: { HOP, ...P }, kids: [kid] });

// Moore's airbag stone, as Fire and Ice II boots it: 43,990 cells away, its d-clear 2,019
// behind the loop. The outer boot moves the block (so every other arm's boot source counts
// as spent code); the block then leaves only its loop, bomb and clear in the far core.
const airbag = (rules) => boot(sc(30000, rules), { id: 'airbag-mov-stone', P: { STEP: isX(rules) ? 2019 : 921, HOP: sc(13990, rules) } });
// Moore's P^3 table (Fire and Ice II, Fire and Brimstone, Ballista) has six states; the
// switch-table keeps four: scanner (two strikes: S1 strong, S0 weak and first) and stone
// (T1 strong, T0 on probation). Members: 0 the stone, 1 the scanner. A row is 4 * next + member.
// LOSS: S0->T0, S1->S0, T1->T0, T0->S0; WIN: S->S1, T->T1; TIE: S0, S1, T1 stay, T0->S0.
const moore = { CELL: 123, FIRST: 1, LOSS: 0x1c1c, WIN: 0x8855, TIE: 0x1851, PACKED: 1 };
const denial = (rules) => (isX(rules) ? { id: 'stone-dual-pump' }
  : { id: 'stone-dual-pump', P: { SHOP: sc(30133, rules), PHOP: sc(30133, rules) + 228, STEP: 863, TIME: 10592, DJN: sc(45001, rules) } });
const follow = (rules, P = {}) => ({ id: 'follow-scanner', P: { STEP: st(13379, rules), STP: 1, ...P } });

export default {
  'top10-94x-fatamorgana-x': {
    rules: ['94x-hill'], length: 200,
    purpose: 'Fatamorgana X (Zul Nadzri, #1): a score-box selector (win +1, loss -1, the fourth tie in a row a loss, brainwash sentinel 651) over Moore\'s airbag stone, a pair scanner (Recon 2), a cc paper and the B-field-following scanner (The Truth Is Out There II). The self-recognition handshake that throws rounds 1 and 2 is left out (the gate forbids thrown rounds). 1.50 / 1.37 (the original loses its first two rounds of every match); 38-48-14. ModelWar 1.59.',
    tree: (rules) => ({ id: 'switch-score', P: { CELL: 11, FIRST: 0, WIN: 1, TIE: 0, LOSS: -1, HOLD: 0, STREAK: 4, SENT: 651 }, kids: [
      airbag(rules),
      boot(sc(27720, rules), { id: 'pair-wipe-scanner', P: { STEP: st(4876, rules), GAP: 6, BACK: 4, WIPE: 16, STREAM: 0, CLEAR: 1 } }, { WIPE: 1 }),
      boot(sc(9108, rules), { id: 'silk-cc', P: { STAGES: 3, STEP1: sc(9117, rules), STEP2: sc(4730, rules), STEP3: sc(777, rules), COUNT: isX(rules) ? 500 : 200 } }, { WIPE: 1 }),
      boot(sc(19255, rules), follow(rules), { WIPE: 1 }),
    ] }),
  },
  'top10-94x-fire-and-ice-ii': {
    rules: ['94x-hill'], length: 200,
    purpose: 'Fire and Ice II (David Moore, #2): Moore\'s P^3 table cut to four states over his airbag stone and a booted B-field-following scanner (The Truth Is Out There II, with its STP bomb). 1.40 / 1.57; 41-46-13. The stone arm alone: 1.53 / 1.66; the scanner arm alone: 0.59 / 0.86. ModelWar 1.63.',
    tree: (rules) => ({ id: 'switch-table', P: moore, kids: [airbag(rules), boot(sc(19241, rules), follow(rules), { WIPE: 1 })] }),
  },
  'top10-94x-fire-and-brimstone': {
    rules: ['94x-hill'], length: 200,
    purpose: 'Fire and Brimstone (Moore / Gunnell, #3): Fire and Ice II with Kenshin\'s scan-and-carpet scanner and its bomb ladder (SPL, JMP, DAT) in place of the follower, booted copy-ahead. 1.35 / 1.49; 38-45-17. ModelWar 1.72.',
    tree: (rules) => ({ id: 'switch-table', P: moore, kids: [airbag(rules), boot(sc(32003, rules), { id: 'ladder-scanner', P: { STEP: st(15331, rules), STP: 0 } }, { EARLY: 1 })] }),
  },
  'top10-94x-ballista': {
    rules: ['94x-hill'], length: 200,
    purpose: 'Ballista (Christian Schmidt, #4): Fire and Ice II with the Arrow X scanner (a .67c pair scan that becomes a .5c blur scanner at its first find, a clear after 45 finds). 1.56 / 1.60; 39-38-23. arrow-scanner alone 1.41 against Arrow X\'s 1.33 (20 rounds), 49-47-4 head to head. ModelWar 1.73.',
    tree: (rules) => ({ id: 'switch-table', P: moore, kids: [airbag(rules), boot(sc(18008, rules), { id: 'arrow-scanner', P: { STEP: isX(rules) ? 4927 : 2239, HITS: 45, TRAIN: sc(50302, rules), FAR: sc(1800, rules) } }, { WIPE: 1 })] }),
  },
  'top10-94x-kat-v5': {
    rules: ['94x-hill'], length: 200,
    purpose: 'KAT v5 (Dave Hillis, #5): five arms (silk with imps, incendiary bomber, spiral-search scanner, the 55HSB brainwash scanner, Denial\'s stone and dual pump), 55HSB first. Its 15-row P^3 table does not fit switch-table (four states, four members), so a score-box selector stands in. 199 cells. 1.09 / 1.39; 24-50-26. Arms alone (20 rounds, rebuild / original): paper 0.46 / 1.23, bomber 0.47 / 1.31, scanner 0.78 / 0.59, 55HSB 0.45 / 0.78, Denial 1.55 / 1.51. ModelWar 1.58.',
    tree: (rules) => ({ id: 'switch-score', P: { CELL: 1100, FIRST: 3, WIN: 1, TIE: 0, LOSS: -1, HOLD: 0, STREAK: 3, SENT: 1931 }, kids: [
      boot(sc(5465, rules), { id: 'silk-imps', P: { STAGES: 2, STEP1: sc(16211, rules), STEP2: sc(21445, rules), POINTS: 17 } }, { WIPE: 1 }),
      boot(sc(9362, rules), { id: 'incendiary' }, { WIPE: 1 }),
      boot(sc(18480, rules), follow(rules, { STEP: 13, STP: 0 }), { WIPE: 1 }),
      boot(sc(27000, rules), { id: 'brainwash-scanner', P: { STEP: 13, WASH: 1 } }, { WIPE: 1 }),
      boot(sc(12000, rules), denial(rules)),
    ] }),
  },
  'top10-94x-azathoth': {
    rules: ['94x-hill'], length: 200,
    purpose: 'Azathoth (John Metcalf, #6): six lockstep processes copy a 5-line looping paper and a self-timed 4-line stone; 30 processes enter the stone, 6 the paper. runner-paper-stone with the original constants. 1.48 / 1.48; 5-2-93. ModelWar 1.30 with the constants scaled (runner-paper-stone\'s own defaults score 1.69 there).',
    tree: (rules) => ({ id: 'runner-paper-stone', P: { K: 5, SHOP: sc(49653, rules), PHOP: sc(6149, rules), STEP: st(23431, rules), TIME: isX(rules) ? 10230 : 4650, BACK: sc(31562, rules), PSTEP: sc(16342, rules) } }),
  },
  'top10-94x-void-runner': {
    rules: ['94x-hill'], length: 200,
    purpose: 'Void Runner (John Metcalf, #7): a fan of 32 lockstep processes copies the runner stone and three 31-point imp pumps a third of the core apart. The original\'s step 8807 bombs its own first pump about 3,400 passes in, which runner-stone-imp refuses, so the stone steps 8773 with its trail at 3000. 1.45 / 1.51; 0-0-100. On ModelWar the recipe is runner-stone-imp\'s own defaults (1.67).',
    // On ModelWar the scaled numbers bomb a pump too; runner-stone-imp's own defaults were evolved there.
    tree: (rules) => (isX(rules) ? { id: 'runner-stone-imp', P: { D: 2, SHOP: 25244, IHOP: 9225, PUMPS: 3, PGAP: 0, STEP: 8773, TIME: 12696, BACK: 3000, IPOINTS: 31, NPROC: 32, DEC: 3455 } } : { id: 'runner-stone-imp' }),
  },
  'top10-94x-denial': {
    rules: ['94x-hill'], length: 200,
    purpose: 'Denial (David Moore, #8): five lockstep processes copy a self-splitting two-write stone and a dual pump (13-point A-imps, 19-point B-imps from one loop); 40 processes enter the stone, 20 the pump. stone-dual-pump with the original constants. 1.48 / 1.56; 0-1-99. ModelWar 1.54.',
    tree: (rules) => denial(rules),
  },
  'top10-94x-big-iffs': {
    rules: ['94x-hill'], length: 200,
    purpose: 'Big I.F.F.S. (Dave Hillis, #9): four arms (incendiary bomber, spiral-search scanner first, 55HSB, Denial) under a score-box selector; the PIN handshake (which needs shared P-space) and the 15-row P^3 table are left out. 1.22 / 1.24; 28-55-17. ModelWar 1.55.',
    tree: (rules) => ({ id: 'switch-score', P: { CELL: isX(rules) ? 2031 : 31, FIRST: 1, WIN: 1, TIE: 0, LOSS: -1, HOLD: 0, STREAK: 3, SENT: 1931 }, kids: [
      boot(sc(9362, rules), { id: 'incendiary' }, { WIPE: 1 }),
      boot(sc(18480, rules), follow(rules, { STEP: 13, STP: 0 }), { WIPE: 1 }),
      boot(sc(27000, rules), { id: 'brainwash-scanner', P: { STEP: 13, WASH: 1 } }, { WIPE: 1 }),
      boot(sc(12000, rules), denial(rules)),
    ] }),
  },
  'top10-94x-discord': {
    rules: ['94x-hill'], length: 200,
    purpose: 'Discord (John Metcalf, #10): the flag-cmp-scanner engine, a .8c two-pair scanner with a 16-cell SPL wipe; at the end of its first lap the pair lands on its own head and the wipe covers its flag cell, which starts its clear. 1.32 / 1.35; 45-50-5. With its first look 26 cells further on it never reached its clear alone and scored 0.41. ModelWar 1.71 (above Decoy Adapter v6.1 against Drift v2, Mercenary, InnovationStation and NovaBomber).',
    tree: (rules) => (isX(rules) ? { id: 'flag-cmp-scanner' } : { id: 'flag-cmp-scanner', P: { STEP: 3774, STREAM: sc(10000, rules) } }),
  },
};
