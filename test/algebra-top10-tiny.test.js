import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree } from '../tools/algebra/index.js';
import { leaves } from '../tools/algebra/leaves.js';
import { treeSettings } from '../tools/algebra/build.js';
import { recipes } from '../tools/algebra/recipes.js';

// The blocks of tools/algebra/blocks/top10-tiny.js (docs/hill-top10/tiny.md).
const ok = (b) => assert.equal(b.verification.ok, true, JSON.stringify(b.verification.issues ?? b.verification));
const build = (tree, rules = 'tiny', length = 20) => buildTree(tree, { rules, length });
const misfits = (id, P, rules = 'tiny', length = 20) => leaves[id].mismatches({ ...leaves[id].defaults, ...P }, treeSettings(rules, length));

test('the bodies pass the gate alone with their defaults', () => {
  for (const id of ['tiny-silk2', 'chorus-silk', 'satellite-silk', 'resin-boot', 'twin-clear', 'djn-stream1']) ok(build({ id }));
});

test('the openings pass the gate in front of a body (inv-qscan with its planted target)', () => {
  ok(build({ id: 'seq', kids: [{ id: 'tiny-qbomb' }, { id: 'tiny-silk2' }] }));
  ok(build({ id: 'seq', kids: [{ id: 'inv-qscan' }, { id: 'twin-clear' }] }));
  ok(build({ id: 'seq', kids: [{ id: 'tiny-qbomb', P: { FORM: 1, COUNT: 3 } }, { id: 'resin-boot' }] }));
});

test('every top-10 Tiny recipe builds, passes the gate and fits 20 instructions', () => {
  const keys = Object.keys(recipes).filter((k) => k.startsWith('top10-tiny-'));
  assert.equal(keys.length, 10);
  for (const k of keys) {
    const b = build(recipes[k].tree('tiny'), 'tiny', recipes[k].length);
    ok(b);
    assert.equal(b.total, 20, k);
  }
});

test('tiny-silk2: the three fans give the process counts the stages copy', () => {
  const six = build({ id: 'tiny-silk2' });
  assert.equal(six.total, 9);
  assert.match(six.source, /SPL\.B 2, \{100/);
  const seven = build({ id: 'tiny-silk2', P: { FAN: 7, TLEN: 3 } });
  ok(seven);
  assert.equal(seven.total, 10);
  assert.match(seven.source, /MOV\.I \$-1, #300/);
  ok(build({ id: 'tiny-silk2', P: { FAN: 8, TLEN: 3 } }));
});

test('the bodies scale to the ModelWar core (25,200 cells)', () => {
  ok(build({ id: 'seq', kids: [{ id: 'inv-qscan', P: { QX: 14413, QY: 3601, QANY: 12695 } }, { id: 'twin-clear', P: { HOP1: 20664, HOP2: 8064, CA: 23688, CB: 18490, CM: 2867, F1: 14269, F2: 14269 } }] }, 'modelwar', 5040));
  ok(build({ id: 'tiny-silk2', P: { X: 15184, Y: 3339, F1: 12506, F2: 12443, F3: 12380, T1A: 16474, T2A: 25198, T2B: 12695 } }, 'modelwar', 5040));
  ok(build({ id: 'resin-boot', P: { HOP1: 9324, HOP2: 21924, PHOP: 5922, RB: 10868 } }, 'modelwar', 5040));
});

test('mismatches refuse settings that break each block', () => {
  assert.ok(misfits('inv-qscan', { QX: 151 }).some((m) => /not a multiple of 800/.test(m)));
  assert.ok(misfits('inv-qscan', {}, 'modelwar', 5040).some((m) => /not a multiple of 25200/.test(m)));
  assert.ok(misfits('tiny-silk2', { FAN: 7 }).some((m) => /7 processes copy 7 cells/.test(m)));
  assert.ok(misfits('tiny-silk2', { X: 798 }).some((m) => /X copies onto the paper/.test(m)));
  assert.ok(misfits('tiny-silk2', { Y: 3 + 795 }).some((m) => /Y copies onto the paper/.test(m)));
  assert.ok(misfits('chorus-silk', { DIST: 10 }).some((m) => /mirror on the warrior/.test(m)));
  assert.ok(misfits('satellite-silk', { STEP: 795 }).some((m) => /STEP copies onto the silk/.test(m)));
  assert.ok(misfits('resin-boot', { POINTS: 5 }).some((m) => /no 5-point imp/.test(m)));
  assert.ok(misfits('resin-boot', { HOP2: 298, HOP1: 296 }).some((m) => /overlap/.test(m)));
  assert.ok(misfits('twin-clear', { HOP1: 5 }).some((m) => /lands on the warrior/.test(m)));
  assert.ok(misfits('djn-stream1', { START: 900 }).length > 0);
  assert.ok(misfits('tiny-qbomb', { A0: 900 }).some((m) => /smaller than the core/.test(m)));
});

test('linked checks: a scanned cell on the warrior, a quick bomb into it, a resin boot not last', () => {
  // QX 2, QY 401: QX*(QY-1) = 800, but qf+QX lies on the warrior.
  assert.throws(() => build({ id: 'seq', kids: [{ id: 'inv-qscan', P: { QX: 2, QY: 401 } }, { id: 'twin-clear' }] }), /scanned cell lies on the warrior/);
  assert.throws(() => build({ id: 'seq', kids: [{ id: 'tiny-qbomb', P: { FORM: 1, COUNT: 1, A1: 3, B1: 400 } }, { id: 'tiny-silk2' }] }), /points into the warrior/);
  assert.throws(() => build({ id: 'image', kids: [{ id: 'resin-boot' }, { id: 'decoys', P: { DECOYS: 2, DECOY: 0 } }] }), /resin-boot must be last/);
});

test('djn-stream1 RETIRE: wiped by its partner it still counts as done, alone it must keep running', () => {
  ok(build({ id: 'djn-stream1', P: { START: 355, RETIRE: 1 } }));
  ok(build(recipes['top10-tiny-dfd94f0'].tree('tiny')));
  const noRetire = recipes['top10-tiny-dfd94f0'].tree('tiny');
  noRetire.kids[1].kids[0].kids[1].P.RETIRE = 0;
  assert.throws(() => build(noRetire), /djn-stream1 stopped running/);
});
