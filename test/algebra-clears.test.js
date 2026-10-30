import test from 'node:test';
import assert from 'node:assert/strict';
import { runMatch } from '../src/engine/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';
import { buildTree, treeMismatches, leaves } from '../tools/algebra/index.js';

const RULES = ['88', '94nop', 'lp', '94x'];
const FINISHERS = ['finisher-dclear', 'finisher-twopass', 'finisher-gated'];
const ok = (tree, rules) => {
  const built = buildTree(tree, { rules });
  assert.equal(built.verification.ok, true, `${JSON.stringify(tree)} on ${rules}`);
  return built;
};

test('every clear and the trap vampire pass the gate alone, on every rule set', () => {
  for (const id of [...FINISHERS, 'vampire-trap']) for (const rules of RULES) {
    assert.equal(ok({ id }, rules).verification.shape, 'generic', id);
  }
});

test('the clears run after every core opening, relocated, triggered and booted', () => {
  for (const f of FINISHERS) {
    const x = { id: f };
    for (const rules of RULES) {
      ok({ id: 'seq', kids: [{ id: 'opening-bomber' }, x] }, rules);                          // needs datBomb
      ok({ id: 'seq', kids: [{ id: 'opening-bscan' }, { id: 'relocate', kids: [x] }] }, rules); // needs splBomb; moved
    }
    for (const rules of ['88', '94nop']) {
      ok({ id: 'seq', kids: [{ id: 'opening-none' }, x] }, rules);
      ok({ id: 'trigger', P: { MODE: 0, TIME: 2000 }, kids: [{ id: 'stone' }, x] }, rules);   // a stone that becomes a clear
      ok({ id: 'boot', P: { HOP: 3000 }, kids: [x, { id: 'decoys' }] }, rules);
    }
  }
});

test('the trap vampire runs beside partners and hands over to a clear', () => {
  const v = { id: 'vampire-trap' };
  for (const rules of ['88', '94nop']) {
    ok({ id: 'par', kids: [v, { id: 'stone', P: { TSTEP: 4, TBOMB: 0 } }] }, rules);
    ok({ id: 'trigger', P: { MODE: 0, TIME: 2000 }, kids: [v, { id: 'finisher-gated' }] }, rules);
  }
  ok({ id: 'trigger', P: { MODE: 1, TIME: 1 }, kids: [v, { id: 'finisher-dclear' }] }, '94nop');
  ok({ id: 'boot', P: { HOP: 3000 }, kids: [v] }, 'lp');
  ok({ id: 'par', kids: [v, { id: 'spiral', P: { SN: 13, SK: 4 } }] }, '94x');
});

test('contracts refuse what does not fit', () => {
  const s = recipeSettings('94nop');
  const has = (tree, re) => assert.ok(treeMismatches(tree, s).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, s)));
  for (const f of FINISHERS) has({ id: 'par', kids: [{ id: 'stone' }, { id: f }] }, /a clear erases its partners/);
  has({ id: 'finisher-dclear', P: { GAP: 0 } }, /GAP must be an integer/);
  has({ id: 'finisher-twopass', P: { RESTUN: 2 } }, /RESTUN must be an integer/);
  has({ id: 'vampire-trap', P: { VSTEP: 0 } }, /VSTEP must be an integer/);
  has({ id: 'seq', kids: [{ id: 'finisher-gated' }, { id: 'opening-none' }] }, /never hands on/);
});

// A copy of a block whose code is changed by `f`, to show its watch notices.
let copies = 0;
function broken(id, f) {
  const orig = leaves[id], nid = `broken${++copies}-${id}`;
  leaves[nid] = { ...orig, id: nid, emit: (ctx) => orig.emit({ ...ctx, ins: (l, o, m, a, b = '0') => ctx.ins(l, ...f(l, o, m, a, b)) }) };
  return { id: nid };
}

test('the watches catch a broken mechanism', () => {
  const cases = [
    // A count one too long: the pass reaches the clear's own code.
    [broken('finisher-twopass', (l, o, m, a, b) => [o, m, a.replace('#(CORESIZE-', '#(1+CORESIZE-'), b]), /wrote over its own code/],
    [broken('finisher-twopass', (l, o, m, a, b) => [o, m, a.replace('#(CORESIZE-', '#(-1+CORESIZE-'), b]), /stun pass did not cover/],
    [broken('finisher-dclear', (l, o, m, a, b) => [o, m, l === 'payload' ? a.replace(/-12\)$/, '-11)') : a, b]), /GAP cells ahead/],
    [broken('finisher-gated', (l, o, m, a, b) => [o, m, a, l === 'tick' ? `${b}+1` : b]), /gate was not decremented/],
    [broken('vampire-trap', (l, o, m, a, b) => (l === 'pSpl' ? ['DAT', 'F', '#0', '#0'] : [o, m, a, b])), /did not multiply/],
    [broken('vampire-trap', (l, o, m, a, b) => (l === 'pJmp' ? ['JMP', 'B', a.replace('pMov', 'pSpl'), b] : [o, m, a, b])), /did not kill its prisoner/],
    [broken('vampire-trap', (l, o, m, a, b) => (o === 'SLT' ? [o, m, /#7999$/.test(a) ? a : '#0', b] : [o, m, a, b])), /fang landed on the vampire/],
  ];
  for (const [tree, re] of cases) assert.throws(() => buildTree(tree, { rules: '94nop' }), re, tree.id);
});

test('the gate keeps imps off: the gated clear beats an imp spiral more often than an ungated one', () => {
  const rules = '94nop', s = { ...recipeSettings(rules), rounds: 40 };
  const spiral = buildTree({ id: 'spiral', P: { SN: 7, SK: 3 } }, { rules }).w;
  const wins = (tree) => runMatch([buildTree(tree, { rules }).w, spiral], s, { seed: 5 }).warriors[0].wins;
  const gated = wins({ id: 'finisher-gated' }), plain = wins({ id: 'finisher-counted', P: { PHASE: 0, STUN: 64, BACKWARD: 1 } });
  assert.ok(gated > plain + 5, `gated ${gated}, ungated ${plain}`);
});
