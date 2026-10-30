import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, mulberry32 } from '../src/engine/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';
import { emitCombo, buildCombo, comboDefaults, comboMismatches } from '../tools/blocks/combo.js';
import { buildTree, comboToTree, link, treeMismatches, randomTree, mutate, crossover, fits, id, shape, leaves, recipes, switchChoice, treeSettings } from '../tools/algebra/index.js';

const code = (source, settings) => {
  const w = compile(source, 'redcode', settings);
  assert.ok(w.ok, JSON.stringify(w.errors));
  return { start: w.start, instructions: w.instructions.map(({ line, ...x }) => x) };
};

test('every combo is a tree: identical compiled code on every rule set', () => {
  let compared = 0;
  for (const rules of ['88', '94nop', 'lp', '94x']) {
    const settings = recipeSettings(rules), tries = [];
    for (const OPENING of [0, 1, 2, 3]) for (const RELOCATE of [0, 1]) for (const FINISHER of [0, 1]) for (const BOOT of [0, 1])
      for (const PHASE of [0, 1, 2]) for (const BACKWARD of [0, 1]) for (const DECOYS of [0, 5]) for (const DECOY of [0, 2])
        tries.push({ ...comboDefaults, OPENING, RELOCATE, FINISHER, BOOT, PHASE, BACKWARD, DECOYS, DECOY,
          WAIT: OPENING === 0 ? 128 : 77, STEP: 311, HOP: 2900, STUN: 40, SSTEP: 3044, GAP: 5, START: 700, SCANS: 40 });
    for (const BODY of [1, 2, 3, 4]) for (const PARTNER of [0, 1, 2, 3, 4]) for (const TBOMB of [0, 1]) for (const SK of [3, 5])
      tries.push({ ...comboDefaults, BODY, PARTNER, TBOMB, SK, SN: 7, TSTEP: 9, PSTEP: 1500, PDELTA: 700, VSTEP: 11 });
    for (const P of tries) {
      const misfit = comboMismatches(P, settings), tree = comboToTree(P), treeMisfit = treeMismatches(tree, settings);
      // The algebra allows the same body twice (each copy has its own labels); combo doesn't.
      if (!(misfit.length === 1 && misfit[0] === 'the same body twice')) assert.equal(!!treeMisfit.length, !!misfit.length, JSON.stringify({ rules, P, misfit, treeMisfit }));
      if (misfit.length) continue;
      assert.deepEqual(code(link(tree, settings).source, settings), code(emitCombo(P, settings).source, settings), JSON.stringify({ rules, P }));
      compared++;
    }
  }
  assert.ok(compared > 1000, `${compared} compared`);
});

test('the tree gate agrees with combo\'s gate', () => {
  const cases = [
    ['94x', { OPENING: 1, RELOCATE: 0, FINISHER: 1, PHASE: 1 }],
    ['94x', { OPENING: 2, RELOCATE: 0, FINISHER: 1, PHASE: 2 }],
    ['94x', { OPENING: 3, RELOCATE: 1, FINISHER: 0, PHASE: 1 }],
    ['94nop', { OPENING: 3, RELOCATE: 0, FINISHER: 1, PHASE: 1, BOOT: 1, HOP: 3000, START: 700, SSTEP: 3044 }],
    ['88', { OPENING: 1, RELOCATE: 0, FINISHER: 0, BOOT: 1, HOP: 3000, PHASE: 0, DECOYS: 6 }],
    ['88', { OPENING: 0, RELOCATE: 0, FINISHER: 0, PHASE: 1, BACKWARD: 1 }],
    ['lp', { OPENING: 2, RELOCATE: 1, FINISHER: 0, PHASE: 2, HOP: 2500 }],
    ['94nop', { BODY: 1, PARTNER: 2, SN: 13, SK: 4 }],
    ['94nop', { BODY: 4, PARTNER: 1 }],
    ['88', { BODY: 2, SN: 7, SK: 3 }],
    ['94nop', { BODY: 1, TSTEP: 3821 }],                    // a stone that bombs itself: both refuse it
  ];
  for (const [rules, over] of cases) {
    const P = { ...comboDefaults, ...over };
    const verdict = (f) => { try { f(); return 'ok'; } catch (e) { return e.message.replace(/^(Combo|The tree) needs/, 'needs'); } };
    assert.equal(verdict(() => buildTree(comboToTree(P), { rules })), verdict(() => buildCombo(P, { rules })), JSON.stringify({ rules, over }));
  }
});

test('contracts say why blocks do not fit', () => {
  const s94 = recipeSettings('94nop'), s88 = recipeSettings('88');
  const counted = { id: 'finisher-counted' }, guarded = { id: 'finisher-guarded', P: { PHASE: 0, STUN: 64 } };
  const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  has({ id: 'seq', kids: [{ id: 'opening-bscan' }, guarded] }, s94, /nothing provides an SPL bomb cell/);
  has({ id: 'par', kids: [{ id: 'stone' }, counted] }, s94, /a clear erases its partners/);
  has({ id: 'seq', kids: [{ id: 'opening-bomber' }, { id: 'relocate', kids: [guarded] }] }, s94, /cannot be relocated/);
  has({ id: 'seq', kids: [{ id: 'opening-cmpscan' }, counted] }, s88, /needs ICWS'94/);
  has({ id: 'boot', kids: [{ id: 'seq', kids: [{ id: 'opening-none' }, { id: 'relocate', kids: [counted] }] }] }, s94, /one relocation per warrior/);
  has({ id: 'seq', kids: [counted, { id: 'opening-none' }] }, s94, /never hands on/);
  has({ id: 'stone', P: { TSTEP: 0, TBOMB: 0 } }, s94, /TSTEP must be an integer/);
  assert.deepEqual(treeMismatches({ id: 'seq', kids: [{ id: 'opening-bomber' }, counted] }, s94), []);
});

test('trees combo cannot make: more bodies, two of one body, booted bodies', () => {
  const stone = (TSTEP) => ({ id: 'stone', P: { TSTEP, TBOMB: 0 } });
  const cases = [
    ['94nop', { id: 'par', kids: [stone(4), stone(8)] }],
    ['94nop', { id: 'par', kids: [stone(4), { id: 'spiral', P: { SN: 7, SK: 3 } }, { id: 'vampire', P: { VSTEP: 7 } }] }],
    ['88', { id: 'boot', P: { HOP: 3000 }, kids: [{ id: 'spiral', P: { SN: 13, SK: 4 } }, { id: 'decoys', P: { DECOYS: 6, DECOY: 0 } }] }],
  ];
  // Two blocks that each write just ahead of themselves can't both be laid out last.
  assert.ok(treeMismatches({ id: 'par', kids: [{ id: 'spiral', P: { SN: 7, SK: 3 } }, { id: 'spiral', P: { SN: 9, SK: 4 } }] }, recipeSettings('94nop'))
    .some((m) => /only one member may write just ahead/.test(m)));
  for (const [rules, tree] of cases) {
    const built = buildTree(tree, { rules });
    assert.equal(built.verification.ok, true, shape(tree));
    assert.equal(built.shape, shape(tree));
  }
});

test('combinators beyond combo: triggers, spacing, copies, a P-space switch, a fast boot', () => {
  const stone = (TSTEP) => ({ id: 'stone', P: { TSTEP, TBOMB: 0 } });
  const spiral = { id: 'spiral', P: { SN: 7, SK: 3 } };
  const cases = [
    ['94nop', { id: 'trigger', P: { MODE: 0, TIME: 2000 }, kids: [stone(4), { id: 'finisher-counted' }] }],      // stone, then a clear
    ['88', { id: 'trigger', P: { MODE: 1, TIME: 1 }, kids: [stone(4), spiral] }],                                // a spiral when the marker is hit
    ['94nop', { id: 'trigger', P: { MODE: 2, TIME: 1 }, kids: [{ id: 'vampire', P: { VSTEP: 7 } }, stone(16)] }], // a watchdog
    ['94nop', { id: 'apart', P: { D: 4000 }, kids: [stone(4), spiral] }],
    ['94nop', { id: 'copies', P: { N: 3, D: 2667 }, kids: [stone(4)] }],
    ['94x-hill', { id: 'switch', P: { CELL: 17 }, kids: [stone(4), { id: 'paper', P: { PSTEP: 1777, PDELTA: 1013 } }] }],
    ['94nop', { id: 'boot', P: { HOP: 3000, UNROLL: 3 }, kids: [spiral] }],
    ['94nop', { id: 'seq', kids: [{ id: 'opening-bomber', P: { WAIT: 50, STEP: 997 } }, stone(4)] }],        // a bomber that becomes a stone
  ];
  for (const [rules, tree] of cases) {
    const built = buildTree(tree, { rules });
    assert.equal(built.verification.ok, true, shape(tree));
  }
  const scenarios = (tree, rules) => buildTree(tree, { rules }).verification.observations.map((o) => o.scenario);
  assert.ok(scenarios(cases[1][1], '88').includes('trigger marker hit'));
  assert.ok(scenarios(cases[5][1], '94x-hill').includes('switch: result 0, choice 0, losses 0'));
  // The gate catches a hand-over to a stone that lands on its own code.
  assert.throws(() => buildTree({ id: 'trigger', P: { MODE: 2, TIME: 1 }, kids: [{ id: 'vampire', P: { VSTEP: 7 } }, stone(4)] }, { rules: '94nop' }), /did not survive/);
  const s94 = recipeSettings('94nop');
  assert.ok(treeMismatches({ id: 'switch', kids: [stone(4), spiral] }, s94).some((m) => /needs P-space/.test(m)));
  assert.ok(treeMismatches({ id: 'trigger', kids: [spiral, stone(4)] }, s94).some((m) => /no loop/.test(m)));
  assert.ok(treeMismatches({ id: 'copies', P: { N: 2, D: 100 }, kids: [stone(4)] }, s94).some((m) => /on top of each other/.test(m)));
  assert.ok(treeMismatches({ id: 'copies', P: { N: 2, D: 7950 }, kids: [stone(4)] }, s94).some((m) => /on top of each other/.test(m)));
});

test('more combinators: n-way P-space switches, restart, in-round classify', () => {
  const ms = (STEP = 3044) => ({ id: 'mod-stone', P: { STEP, BOMBS: 1, GUARD: 1 } });
  const paper = { id: 'paper', P: { PSTEP: 1777, PDELTA: 1013 } };
  for (const POLICY of [0, 1, 2]) {
    const built = buildTree({ id: 'switch', P: { CELL: 30, POLICY }, kids: [ms(), paper, ms(2000)] }, { rules: '94x-hill' });
    assert.ok(built.verification.observations.filter((o) => /^switch: result/.test(o.scenario)).length >= 7, `policy ${POLICY}`);
  }
  assert.equal(switchChoice(1, 2, 0, 0, 0), 0);          // one loss: keep
  assert.equal(switchChoice(1, 2, 0, 0, 1), 1);          // the second loss in a row: move on
  assert.equal(switchChoice(2, 3, 1, 2, 0), 0);          // rotate even after a win
  assert.equal(switchChoice(2, 3, -1, 2, 0), 2);         // but not on the first round
  for (const rules of ['88', '94nop']) {
    const built = buildTree({ id: 'restart', kids: [ms()] }, { rules });
    assert.ok(built.verification.observations.some((o) => o.scenario === 'restart: loop damaged'), rules);
  }
  const classify = buildTree({ id: 'classify', kids: [ms(), paper, { id: 'finisher-counted' }] }, { rules: '94nop' });
  assert.deepEqual(classify.verification.observations.filter((o) => /^classify/.test(o.scenario)).map((o) => o.scenario),
    ['classify: hit by a zero DAT', 'classify: hit by copied code']);
  const s94 = recipeSettings('94nop');
  assert.ok(treeMismatches({ id: 'restart', kids: [{ id: 'spiral' }] }, s94).some((m) => /no loop/.test(m)));
  assert.ok(treeMismatches({ id: 'classify', kids: [ms(), paper, ms(2000)] }, recipeSettings('88')).some((m) => /needs ICWS'94/.test(m)));
});

test('a block can duel a real opponent from its checks', () => {
  let result;
  leaves['test-duel'] = { ...leaves.stone, id: 'test-duel', file: 'test', watch: (api) => ({ final: () => { if (api.alone) result = api.duel('MOV 0, 1', { offset: 4000, cycles: 2000 }); } }) };
  try {
    buildTree({ id: 'test-duel', P: { TSTEP: 4, TBOMB: 0 } }, { rules: '94nop' });
    assert.equal(result.ours, true);
    assert.equal(result.cycles, 2000);
  } finally { delete leaves['test-duel']; }
});

test('trees build on a torus: vector hops, geometry-aware checks, ring blocks refused', () => {
  leaves['test-vstone'] = {
    id: 'test-vstone', kind: 'body', exit: 'never', processes: 1, writes: 'sparse', topologies: ['torus'], file: 'test',
    purpose: 'a vector stone (test only)', params: { SX: [1, 50], SY: [1, 50] }, defaults: { SX: 3, SY: 7 }, entry: 'loop', loop: 'loop',
    emit(ctx) {
      ctx.ins('loop', 'ADD', 'AB', `#${ctx.vec(ctx.P.SX, ctx.P.SY)}`, ctx.L('ptr'));
      ctx.ins('mov', 'MOV', 'I', ctx.L('bomb'), `@${ctx.L('ptr')}`);
      ctx.ins('', 'JMP', 'B', ctx.L('loop'));
      ctx.ins('ptr', 'DAT', 'F', '#0', `#${ctx.vec(0, 1)}`);
      ctx.ins('bomb', 'DAT', 'F', '#0', '#0');
    },
    watch(api) {
      const rows = new Set();
      return {
        before: (pc) => (pc === api.at('mov') ? api.add(api.at('ptr'), api.vm.peek(api.at('ptr')).b) : null),
        after: (t) => { if (t === null) return; if (api.inSelf(t)) throw new Error('bombed itself'); rows.add(api.geo.decode(t)[1]); },
        final: () => { if (api.alone && rows.size < 20) throw new Error(`bombs stayed in ${rows.size} rows`); },
      };
    },
  };
  try {
    const t = { id: 'test-vstone', P: { SX: 3, SY: 7 } };
    for (const tree of [t, { id: 'boot', P: { HOP: 10, HOPY: 40 }, kids: [t] }, { id: 'apart', P: { D: 0, DY: 40 }, kids: [t, { id: 'test-vstone', P: { SX: 7, SY: 3 } }] }]) {
      assert.equal(buildTree(tree, { rules: '94nop', torus: '100x80' }).verification.ok, true, shape(tree));
    }
    assert.match(link({ id: 'boot', P: { HOP: 10, HOPY: 40 }, kids: [t] }, treeSettings('94nop', 50, '100x80')).source, /\[b1loop\+10,40,0\]/);
    // A long hop with an unrolled boot: the jump must land on the copy's row, not carry into the next.
    assert.equal(buildTree({ id: 'boot', P: { HOP: 6365, HOPY: 183, UNROLL: 3 }, kids: [t] }, { rules: '94nop', torus: '100x80' }).verification.ok, true);
    assert.throws(() => buildTree({ id: 'stone' }, { rules: '94nop', torus: '100x80' }), /written for the ring/);
    assert.throws(() => buildTree(t, { rules: '94nop' }), /written for the torus/);
    assert.ok(treeMismatches({ id: 'boot', P: { HOP: 3000, HOPY: 5 }, kids: [{ id: 'stone' }] }, recipeSettings('94nop')).some((m) => /only mean something on a torus/.test(m)));
  } finally { delete leaves['test-vstone']; }
});

test('every named recipe builds and passes the gate on its rule sets', () => {
  for (const [name, r] of Object.entries(recipes)) for (const rules of r.rules) {
    assert.equal(buildTree(r.tree(rules), { rules }).verification.ok, true, `${name} on ${rules}`);
  }
});

test('the genome only makes trees that fit, and is seeded', () => {
  for (const rules of ['88', '94nop', 'lp', '94x']) {
    const settings = recipeSettings(rules), random = mulberry32(11);
    let tree = randomTree(settings, random);
    const seen = new Set([id(tree)]);
    for (let i = 0; i < 25; i++) {
      assert.ok(fits(tree, settings), JSON.stringify(tree));
      const m = mutate(tree, settings, random);
      if (!m) continue;
      assert.notEqual(id(m.tree), id(tree));
      tree = m.tree; seen.add(id(tree));
      const child = crossover(tree, randomTree(settings, random), settings, random);
      if (child) assert.ok(fits(child, settings));
    }
    assert.ok(seen.size > 10, rules);
    // '88 trees use only '88 blocks.
    if (rules === '88') assert.ok(![...JSON.stringify(tree).matchAll(/"id":"([a-z-]+)"/g)].some(([, x]) => leaves[x]?.dialects === '94'));
  }
  const a = randomTree(recipeSettings('94nop'), mulberry32(5)), b = randomTree(recipeSettings('94nop'), mulberry32(5));
  assert.deepEqual(a, b);
  assert.equal(id({ id: 'stone', P: { TBOMB: 0, TSTEP: 4 } }), id({ id: 'stone', P: { TSTEP: 4, TBOMB: 0 } }));
});
