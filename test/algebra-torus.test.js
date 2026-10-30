// Torus blocks (tools/algebra/blocks/torus.js): every block builds and passes
// the gate with its defaults on the plane and a volume, alone and in a
// combination; the scanner reacts to a planted target in another row and
// layer; and a broken variant of each is refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, treeMismatches, treeSettings, leaves, shape } from '../tools/algebra/index.js';

const build = (tree, torus) => buildTree(tree, { rules: '94nop', torus });
const passes = (tree, torus) => {
  const built = build(tree, torus);
  assert.equal(built.verification.ok, true, `${shape(tree)} on ${torus}`);
  return built;
};
// A test-only copy of a block: its own id, with some fields replaced.
function variant(id, over, run) {
  const name = `${id}-broken`;
  leaves[name] = { ...leaves[id], ...over, id: name };
  try { return run(name); } finally { delete leaves[name]; }
}
// The same block with one emitted instruction's operands rewritten.
const rewrite = (id, fix) => ({ emit: (ctx) => leaves[id].emit({ ...ctx, ins: (l, op, mod, a, b) => ctx.ins(l, op, mod, ...fix(op, a, b ?? '0')) }) });
const misfits = (tree, torus) => treeMismatches(tree, treeSettings('94nop', 50, torus));

const SHAPES = {
  'vector-stone': ['100x80', '40x20x10', '20x20x20', '41x20x9'],
  'row-sweeper': ['100x80', '40x20x10', '80x10x10'],
  'plane-clear': ['100x80', '40x20x10', '20x20x20'],
  'volume-paper': ['100x80', '40x20x10', '20x20x20'],
  'torus-scanner': ['100x80', '40x20x10'],
  'column-imp': ['100x80', '40x20x10', '20x20x20'],
};

test('every torus block passes the gate alone on the plane and a volume', () => {
  for (const [id, shapes] of Object.entries(SHAPES)) for (const torus of shapes) passes({ id }, torus);
  passes({ id: 'column-imp', P: { AXIS: 2, SIGN: 1 } }, '40x20x10');            // a depth imp, going up
  // Torus blocks are refused on the ring, and ring blocks on the torus.
  assert.throws(() => buildTree({ id: 'vector-stone' }, { rules: '94nop' }), /written for the torus/);
});

test('torus blocks in combination: apart, boot, trigger, par, copies', () => {
  const cases = [
    ['100x80', { id: 'apart', P: { D: 0, DY: 40 }, kids: [{ id: 'vector-stone' }, { id: 'vector-stone', P: { SX: 3, SY: 2 } }] }],
    ['80x10x10', { id: 'apart', P: { D: 0, DY: 4, DZ: 5 }, kids: [{ id: 'vector-stone' }, { id: 'vector-stone' }] }],
    ['100x80', { id: 'trigger', P: { MODE: 0, TIME: 1500 }, kids: [{ id: 'vector-stone' }, { id: 'plane-clear' }] }],   // a stone, then a clear
    ['100x80', { id: 'restart', kids: [{ id: 'vector-stone' }] }],                                                      // repaired when its loop is hit
    ['100x80', { id: 'apart', P: { D: 0, DY: 40 }, kids: [{ id: 'row-sweeper' }, { id: 'row-sweeper', P: { GY: 4 } }] }],
    ['80x10x10', { id: 'boot', P: { HOP: 0, HOPY: 4, HOPZ: 5 }, kids: [{ id: 'row-sweeper' }] }],
    ['100x80', { id: 'boot', P: { HOP: 0, HOPY: 40 }, kids: [{ id: 'torus-scanner' }] }],
    ['100x80', { id: 'trigger', P: { MODE: 0, TIME: 3000 }, kids: [{ id: 'torus-scanner' }, { id: 'plane-clear', P: { PHASE: 0 } }] }],
    ['80x10x10', { id: 'boot', P: { HOP: 0, HOPY: 4, HOPZ: 3 }, kids: [{ id: 'torus-scanner' }] }],   // torus copy loops step per axis: 22 cells, too long for 40x20x10
    ['100x80', { id: 'par', kids: [{ id: 'column-imp' }, { id: 'volume-paper' }] }],
    ['40x20x10', { id: 'par', kids: [{ id: 'column-imp', P: { AXIS: 2 } }, { id: 'volume-paper' }] }],
    ['40x20x10', { id: 'copies', P: { N: 3, D: 0, DY: 7, DZ: 3 }, kids: [{ id: 'column-imp' }] }],
  ];
  for (const [torus, tree] of cases) passes(tree, torus);
});

test('the torus scanner bombs a target planted in another row and layer', () => {
  for (const torus of ['100x80', '40x20x10']) {
    const scenarios = passes({ id: 'torus-scanner' }, torus).verification.observations.map((o) => o.scenario);
    assert.ok(scenarios.includes('torus-scanner: planted target'), torus);
  }
});

test('broken torus blocks are refused', () => {
  // vector-stone: an odd row step is refused by its contract; without the contract, the gate sees it bomb its own row.
  assert.ok(misfits({ id: 'vector-stone', P: { SY: 3 } }, '100x80').some((m) => /its own row/.test(m)));
  variant('vector-stone', { mismatches: undefined }, (id) =>
    assert.throws(() => build({ id, P: { SY: 3 } }, '100x80'), /own row|did not survive/));
  // row-sweeper: an odd step along the row reaches its own column.
  assert.ok(misfits({ id: 'row-sweeper', P: { GX: 3 } }, '100x80').some((m) => /must be even/.test(m)));
  variant('row-sweeper', { mismatches: undefined }, (id) =>
    assert.throws(() => build({ id, P: { GX: 3 } }, '100x80'), /own column|did not survive/));
  // plane-clear: protecting fewer cells than its own code.
  variant('plane-clear', { emit: (ctx) => leaves['plane-clear'].emit({ ...ctx, span: 2 }) }, (id) =>
    assert.throws(() => build({ id }, '100x80'), /cleared its own code|did not survive/));
  // volume-paper: a copy pointer that runs over the row's edge splits every copy over two rows.
  assert.ok(misfits({ id: 'volume-paper', P: { DX: -45 } }, '100x80').some((m) => /DX must be/.test(m)));
  variant('volume-paper', { mismatches: undefined }, (id) =>
    assert.throws(() => build({ id, P: { DX: -45 } }, '100x80'), /incomplete copy|not DX columns|copies are in/));
  // torus-scanner: a limit that lets the scan reach its own row.
  variant('torus-scanner', rewrite('torus-scanner', (op, a, b) => [op === 'SLT' ? '#7999' : a, b]), (id) =>
    assert.throws(() => build({ id }, '100x80'), /bombed itself|own row|did not survive/));
  // column-imp: a TRN that faces along the row runs off the end of the imp.
  variant('column-imp', rewrite('column-imp', (op, a, b) => [op === 'TRN' ? '[1,0,0]' : a, b]), (id) =>
    assert.throws(() => build({ id }, '100x80'), /did not survive|left its line|visited/));
});
