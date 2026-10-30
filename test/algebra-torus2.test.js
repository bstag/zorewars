// More torus blocks (tools/algebra/blocks/torus2.js): every block builds and
// passes the gate with its defaults on the plane and a volume, alone and in a
// combination; the plant scenarios of the shared clear and the leap body get
// the reaction they promise; and one deliberately broken variant of each is
// refused by a mismatch or by the gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, treeMismatches, treeSettings, leaves } from '../tools/algebra/index.js';

const build = (tree, torus) => buildTree(tree, { rules: '94nop', torus });
const passes = (tree, torus) => {
  const built = build(tree, torus);
  assert.equal(built.verification.ok, true, `${JSON.stringify(tree)} on ${torus}`);
  return built;
};
const misfits = (tree, torus) => treeMismatches(tree, treeSettings('94nop', 50, torus));
// A test-only copy of a block: its own id, with some fields replaced.
function variant(id, over, run) {
  const name = `${id}-broken`;
  leaves[name] = { ...leaves[id], ...over, id: name };
  try { return run(name); } finally { delete leaves[name]; }
}

const SHAPES = {
  'vector-silk': ['100x80', '40x20x10'],
  'backward-clear': ['100x80', '40x20x10'],
  'multi-plane-clear': ['100x80', '40x20x10'],
  'torus-leap': ['100x80', '80x10x10'],
};

test('every torus2 block passes the gate alone on the plane and a volume', () => {
  for (const [id, shapes] of Object.entries(SHAPES)) for (const torus of shapes) passes({ id }, torus);
  passes({ id: 'backward-clear', P: { TRAP: 1 } }, '100x80');       // the SPL/JMP trap pair
  // Torus blocks are refused on the ring.
  assert.throws(() => build({ id: 'vector-silk' }, undefined), /written for the torus/);
});

test('torus2 blocks in combination: boot, trigger', () => {
  passes({ id: 'boot', P: { HOP: 0, HOPY: 40 }, kids: [{ id: 'vector-silk' }] }, '100x80');
  passes({ id: 'trigger', P: { MODE: 0, TIME: 1500 }, kids: [{ id: 'vector-stone' }, { id: 'backward-clear' }] }, '100x80');
  passes({ id: 'trigger', P: { MODE: 0, TIME: 1500 }, kids: [{ id: 'vector-stone' }, { id: 'multi-plane-clear' }] }, '100x80');
  passes({ id: 'boot', P: { HOP: 0, HOPY: 40 }, kids: [{ id: 'torus-leap' }] }, '100x80');
});

test('the shared clear survives a planted DAT, and the leap body reacts to a hit marker', () => {
  for (const torus of ['100x80', '40x20x10']) {
    const sc = passes({ id: 'multi-plane-clear' }, torus).verification.observations.map((o) => o.scenario);
    assert.ok(sc.includes('multi-plane-clear: planted target'), `mpc plant ${torus}`);
  }
  for (const torus of ['100x80', '80x10x10']) {
    const sc = passes({ id: 'torus-leap' }, torus).verification.observations.map((o) => o.scenario);
    assert.ok(sc.includes('torus-leap: planted target'), `leap plant ${torus}`);
  }
});

test('broken torus2 blocks are refused', () => {
  // vector-silk: copies on its own row (DY and DZ zero). The contract catches it;
  // without the contract, the gate sees a process started on the paper's own row.
  assert.ok(misfits({ id: 'vector-silk', P: { DY: 0, DZ: 0 } }, '100x80').some((m) => /own row/.test(m)));
  variant('vector-silk', { mismatches: undefined }, (id) =>
    assert.throws(() => build({ id, P: { DY: 0, DZ: 0 } }, '100x80'), /own row|did not survive/));
  // backward-clear: protecting fewer cells than it occupies -> it clears itself.
  variant('backward-clear', { emit: (ctx) => leaves['backward-clear'].emit({ ...ctx, span: 3 }) }, (id) =>
    assert.throws(() => build({ id }, '100x80'), /image it must spare|did not survive/));
  // multi-plane-clear: the same, so a shared pass runs into the image.
  variant('multi-plane-clear', { emit: (ctx) => leaves['multi-plane-clear'].emit({ ...ctx, span: 3 }) }, (id) =>
    assert.throws(() => build({ id }, '100x80'), /image it must spare|did not survive/));
  // torus-leap: SEQ turned to SNE makes it read an intact marker as a hit and
  // leap with no enemy near, which the gate forbids when alone.
  variant('torus-leap', { emit: (ctx) => leaves['torus-leap'].emit({ ...ctx, ins: (l, op, mod, a, b) => ctx.ins(l, op === 'SEQ' ? 'SNE' : op, mod, a, b) }) }, (id) =>
    assert.throws(() => build({ id }, '100x80'), /leaped while alone|did not survive/));
  // torus-leap: a leap that does not clear the front (HOPY within the marker) is refused.
  assert.ok(misfits({ id: 'torus-leap', P: { SENT: 4, HOPY: 3 } }, '100x80').some((m) => /HOPY/.test(m)));
});
