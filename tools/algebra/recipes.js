// Named trees: well-known designs written as blocks and combinators, as
// starting points for evolution and as examples. Each says which rule sets it
// is meant for; test/algebra.test.js builds every one there.

const stone = (TSTEP = 4) => ({ id: 'stone', P: { TSTEP, TBOMB: 0 } });

export const recipes = {
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
  'spread-stone-spiral': {
    rules: ['94nop'],
    purpose: 'A stone, with an imp spiral started 4000 cells away from it.',
    tree: () => ({ id: 'apart', P: { D: 4000 }, kids: [stone(), { id: 'spiral', P: { SN: 7, SK: 3 } }] }),
  },
};
