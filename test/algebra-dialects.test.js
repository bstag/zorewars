import test from 'node:test';
import assert from 'node:assert/strict';
import { recipeSettings } from '../tools/blocks/recipes.js';
import { compile } from '../src/engine/index.js';
import { buildTree, treeMismatches, leaves, shape } from '../tools/algebra/index.js';

const ALL = ['88', '94nop', 'lp', '94x'];
const OPENINGS = ['opening-cmpscan-88', 'opening-quickscan-88', 'opening-sne-88'];
const QUICK6 = { START: 300, SPACING: 650, GAP: 8, N: 6 };
const guarded88 = { id: 'finisher-guarded-88' }, counted = { id: 'finisher-counted' };
const ok = (tree, rules, planted = []) => {
  const built = buildTree(tree, { rules });
  assert.equal(built.verification.ok, true, `${shape(tree)} on ${rules}`);
  const scenarios = built.verification.observations.map((o) => o.scenario);
  for (const id of planted) assert.ok(scenarios.includes(`${id}: planted target`), `${shape(tree)} on ${rules}: no planted run for ${id}`);
  if (rules === '88') {
    // The '88 text must pass the '88 checker with no errors or warnings.
    const w = compile(built.source, 'redcode', recipeSettings('88'));
    assert.equal(w.ok, true, `${shape(tree)}: ${JSON.stringify(w.errors)}`);
    assert.deepEqual(w.warnings ?? [], [], `${shape(tree)}: warnings`);
  }
  return built;
};
const refused = (tree, rules, re) => assert.throws(() => buildTree(tree, { rules }), re, `${shape(tree)} on ${rules} should be refused`);

// A copy of a block whose emitted code is changed by `edit(label, op, a, b)`,
// which returns the instruction to emit instead ([op, a, b]) or null to drop it.
function broken(id, edit) {
  const def = leaves[id], bad = `${id}-broken`;
  leaves[bad] = {
    ...def, id: bad,
    emit(ctx) {
      def.emit({ ...ctx, ins: (label, op, m, a, b = '0') => { const x = edit(label, op, a, b); if (x) ctx.ins(label, x[0], m, x[1], x[2]); else if (label) ctx.mark(label); } });
    },
  };
  return bad;
}

test("the '88 scan blocks are loaded with working defaults", () => {
  for (const id of [...OPENINGS, 'finisher-guarded-88']) {
    assert.ok(leaves[id], id);
    assert.equal(typeof leaves[id].watch, 'function', id);
    assert.equal(leaves[id].dialects, undefined, `${id} must not be '94 only`);
  }
  for (const id of OPENINGS) assert.equal(typeof leaves[id].plant, 'function', id);
});

test("each '88 opening hands on to the '88 guarded clear and to the counted clear, on every rule set", () => {
  for (const rules of ALL) {
    for (const id of OPENINGS) {
      ok({ id: 'seq', kids: [{ id }, guarded88] }, rules, [id]);
      ok({ id: 'seq', kids: [{ id }, counted] }, rules, [id]);
    }
  }
});

test("the '88 guarded clear follows other openings, with and without a stun phase", () => {
  for (const rules of ['88', '94nop']) {
    ok({ id: 'seq', kids: [{ id: 'opening-none' }, { id: 'finisher-guarded-88', P: { PHASE: 0, STUN: 1 } }] }, rules);
    ok({ id: 'seq', kids: [{ id: 'opening-bomber' }, { id: 'finisher-guarded-88', P: { PHASE: 2, STUN: 1 } }] }, rules);
    // Two openings: the probe the clear uses is not the first cell of the image.
    ok({ id: 'seq', kids: [{ id: 'opening-quickscan-88', P: QUICK6 }, { id: 'opening-cmpscan-88' }, guarded88] }, rules, ['opening-quickscan-88', 'opening-cmpscan-88']);
  }
  // The '94 openings hand on to it as well.
  for (const id of ['opening-quickscan', 'opening-sne']) ok({ id: 'seq', kids: [{ id }, guarded88] }, '94nop', [id]);
  // And the '94 guarded clear takes the '88 openings' probe.
  ok({ id: 'seq', kids: [{ id: 'opening-cmpscan-88' }, { id: 'finisher-guarded' }] }, '94nop', ['opening-cmpscan-88']);
});

test("'88 scan-then-clear trees with decoys and a boot", () => {
  for (const rules of ['88', '94nop']) {
    ok({ id: 'image', kids: [{ id: 'seq', kids: [{ id: 'opening-sne-88' }, guarded88] }, { id: 'decoys' }] }, rules, ['opening-sne-88']);
    ok({ id: 'image', kids: [{ id: 'seq', kids: [{ id: 'opening-cmpscan-88' }, guarded88] }, { id: 'decoys' }] }, rules, ['opening-cmpscan-88']);
    ok({ id: 'boot', kids: [{ id: 'seq', kids: [{ id: 'opening-quickscan-88', P: QUICK6 }, guarded88] }, { id: 'decoys' }] }, rules, ['opening-quickscan-88']);
  }
});

test('broken versions are refused by the gate', () => {
  // The comparison scan hands on the pair's CMP offset without making it relative to the probe.
  const cmp = broken('opening-cmpscan-88', (label, op, a, b) => (op === 'ADD' && /cmp-.*probe/.test(a) ? null : [op, a, b]));
  refused({ id: 'seq', kids: [{ id: cmp }, guarded88] }, '88', /did not hand on/);
  // Without its guard, a scan that wraps onto its own image hands that on.
  const unguarded = broken('opening-cmpscan-88', (label, op, a, b) => (op === 'JMP' && a.endsWith('tick') ? [op, a.replace(/tick$/, 'found'), b] : [op, a, b]));
  const wraps = { SSTEP: 40, GAP: 7, START: 7800, SCANS: 64 };
  ok({ id: 'seq', kids: [{ id: 'opening-cmpscan-88', P: wraps }, guarded88] }, '88');
  refused({ id: 'seq', kids: [{ id: unguarded, P: wraps }, guarded88] }, '88', /did not hand on the image boundary/);
  // The quickscan hands on the wrong cell of the pair.
  const quick = broken('opening-quickscan-88', (label, op, a, b) => (op === 'MOV' ? [op, `#${Number(a.slice(1)) + 1}`, b] : [op, a, b]));
  refused({ id: 'seq', kids: [{ id: quick }, guarded88] }, '88', /did not hand on the planted pair/);
  // The fast scan forgets to hand on the image boundary when it finds nothing.
  const sne = broken('opening-sne-88', (label, op, a, b) => (op === 'MOV' && a.startsWith('#') ? null : [op, a, b]));
  refused({ id: 'seq', kids: [{ id: sne }, guarded88] }, '88', /did not hand on the image boundary/);
  // The clear's kill loop loses its reset, so it walks down into its own image.
  const clear = broken('finisher-guarded-88', (label, op, a, b) => (label === 'killGuard' ? ['SLT', '#0', b] : [op, a, b]));
  refused({ id: 'seq', kids: [{ id: 'opening-none' }, { id: clear, P: { PHASE: 0, STUN: 1 } }] }, '88', /wrote inside the image|did not survive/);
});

test("bad '88 scan settings are refused", () => {
  const s88 = recipeSettings('88');
  const has = (tree, re) => assert.ok(treeMismatches(tree, s88).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, s88)));
  has({ id: 'seq', kids: [{ id: 'opening-quickscan-88', P: { START: 10, SPACING: 650, GAP: 8, N: 12 } }, guarded88] }, /lands on or next to the warrior/);
  has({ id: 'seq', kids: [{ id: 'opening-sne-88', P: { START: 100, STEP: 16, GAP: 8, SCANS: 300 } }, guarded88] }, /runs on into the warrior/);
  has({ id: 'seq', kids: [{ id: 'opening-cmpscan-88', P: { SSTEP: 8000, GAP: 7, START: 512, SCANS: 64 } }, guarded88] }, /stands still/);
  has({ id: 'finisher-guarded-88' }, /nothing provides a probe/);
  for (const rules of ALL) for (const id of OPENINGS) assert.deepEqual(treeMismatches({ id: 'seq', kids: [{ id }, guarded88] }, recipeSettings(rules)), []);
});
