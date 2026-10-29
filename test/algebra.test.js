import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, mulberry32 } from '../src/engine/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';
import { emitCombo, buildCombo, comboDefaults, comboMismatches } from '../tools/blocks/combo.js';
import { buildTree, comboToTree, link, treeMismatches, randomTree, mutate, crossover, fits, id, shape, leaves } from '../tools/algebra/index.js';

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
    ['94nop', { id: 'par', kids: [{ id: 'spiral', P: { SN: 7, SK: 3 } }, { id: 'spiral', P: { SN: 9, SK: 4 } }] }],
  ];
  for (const [rules, tree] of cases) {
    const built = buildTree(tree, { rules });
    assert.equal(built.verification.ok, true, shape(tree));
    assert.equal(built.shape, shape(tree));
  }
  assert.throws(() => buildTree({ id: 'seq', kids: [{ id: 'opening-bomber' }, stone(4)] }, { rules: '94nop' }), /No gate for this shape yet/);
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
