// Blocks added to rebuild the Koenigstuhl '88 hill's top ten
// (tools/algebra/blocks/top10-88.js, docs/hill-top10/88.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree } from '../tools/algebra/index.js';
import { leaves } from '../tools/algebra/leaves.js';
import { treeSettings } from '../tools/algebra/build.js';

const build88 = (tree) => buildTree(tree, { rules: '88', length: 100 });
const ok = (b) => assert.equal(b.verification.ok, true, JSON.stringify(b.verification.issues ?? b.verification));
const misfits = (id, P, rules = '88', length = 100) => leaves[id].mismatches({ ...leaves[id].defaults, ...P }, treeSettings(rules, length));
const seq = (...kids) => ({ id: 'seq', kids });

test('every top-ten block builds alone in strict 88 and passes the gate', () => {
  for (const tree of [
    { id: 'selfclear-stone-pump-88', P: { STEP: 5789 } },
    { id: 'resin-paper-88' },
    { id: 'paper-stone-boot-88' },
    { id: 'cannonade-pump-88' },
    { id: 'blitz-stone-spiral-88' },
    { id: 'stone-loop-paper-88' },
    { id: 'oneshot-88' },
    { id: 'pit-vampire-imp-88' },
  ]) {
    const b = build88(tree);
    ok(b);
    assert.doesNotMatch(b.source, /\.(I|F|AB|BA|A|B|X)\b/, `${tree.id} must write '88 code`);
  }
});

test('the decoding quickscan with its built-in carpet leads a body and passes its planted find', () => {
  const b = build88(seq({ id: 'opening-qscan-m-88' }, { id: 'selfclear-stone-pump-88', P: { STEP: 5789 } }));
  ok(b);
  // 18 pairs: 36 scan lines, a miss line, 5 decoder ADDs, the side test (3) and the carpet (4), plus its bomb.
  const plan = 2 * 18 + 1 + 5 + 3 + 4 + 1;
  assert.equal(b.total, plan + 21);
  // Twelve and ten pairs need four levels.
  ok(build88(seq({ id: 'opening-qscan-m-88', P: { PAIRS: 12, GAP: 161, COUNT: 6, STEP: 9, DB: 43 } }, { id: 'paper-stone-boot-88' })));
});

test('the separate carpet follows a decoding quickscan and a non-decoding one', () => {
  ok(build88(seq({ id: 'opening-qscan-table-88', P: { PAIRS: 12 } }, { id: 'probe-carpet-88' }, { id: 'imp' })));
  ok(build88(seq({ id: 'opening-qscan-full-88', P: { PAIRS: 8, START: 525, SPACING: 260, GAP: 130 } }, { id: 'probe-carpet-88', P: { SIDE: 1 } }, { id: 'imp' })));
});

test('decoys and padding sit behind a body in an image', () => {
  ok(build88({ id: 'image', kids: [seq({ id: 'opening-qscan-m-88', P: { PAIRS: 12, GAP: 161, COUNT: 6, STEP: 9, DB: 43 } }, { id: 'stone-loop-paper-88' }), { id: 'blank-padding-88', P: { COUNT: 33 } }] }));
  ok(build88({ id: 'image', kids: [{ id: 'oneshot-88' }, { id: 'spl-decoy-strip-88', P: { COUNT: 42, CYCLE: 7 } }] }));
});

test('the Quicksilver layout may bomb its own pump only with GUARD 0', () => {
  const P = { STEP: 7893, TIME: 1868, STREAM: 5246, BOFF: 11, DEC: 17, HOP: 4857, PHOP: 2849, IOFF: 6111 };
  assert.ok(misfits('selfclear-stone-pump-88', { ...P, GUARD: 1 }).some((m) => /bombs the stone or the pump/.test(m)));
  assert.deepEqual(misfits('selfclear-stone-pump-88', { ...P, GUARD: 0 }), []);
  ok(build88({ id: 'selfclear-stone-pump-88', P: { ...P, GUARD: 0 } }));
});

test('the imp blocks take a point count, so they build on the 25,200-cell ModelWar core', () => {
  assert.ok(misfits('selfclear-stone-pump-88', {}, 'modelwar', 200).some((m) => /no 3-point imp ring/.test(m)));
  const mw = (tree) => buildTree(tree, { rules: 'modelwar', length: 200 });
  ok(mw({ id: 'selfclear-stone-pump-88', P: { N: 13, STEP: 18205, TIME: 3450, STREAM: 7680, HOP: 14855, PHOP: 24227, IOFF: 3020 } }));
  ok(mw(seq({ id: 'opening-qscan-m-88', P: { BLANK: 12600 } }, { id: 'blitz-stone-spiral-88', P: { N: 13, C: 1048, SHOP: 10726, PHOP: 17003 } })));
});

test('broken settings are refused', () => {
  assert.ok(misfits('selfclear-stone-pump-88', { STEP: 2211 }).some((m) => /already bombs/.test(m)));
  assert.ok(misfits('opening-qscan-m-88', { DB: 1 }).some((m) => /DB must be/.test(m)));
  assert.ok(misfits('probe-carpet-88', { SIDE: 1, BLANK: 100 }).some((m) => /BLANK/.test(m)));
  assert.ok(misfits('resin-paper-88', { RHOP: 7990 }).some((m) => /lands on the warrior/.test(m)));
  assert.ok(misfits('paper-stone-boot-88', { TIME: 3000 }).some((m) => /already bombs the stone/.test(m)));
  assert.ok(misfits('cannonade-pump-88', { C1HOP: 1510 }).some((m) => /overlap/.test(m)));
  assert.ok(misfits('blitz-stone-spiral-88', { C: 327 }).some((m) => /grain/.test(m)));
  assert.ok(misfits('stone-loop-paper-88', { STEP: 7990 }).some((m) => /lands on the warrior/.test(m)));
  assert.ok(misfits('oneshot-88', { STEP: 10 }).some((m) => /STEP must leave room/.test(m)));
  assert.ok(misfits('pit-vampire-imp-88', { FOFF: 30, TOFF: 20 }).some((m) => /order/.test(m)));
});
