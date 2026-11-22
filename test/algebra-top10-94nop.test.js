import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree } from '../tools/algebra/index.js';
import { leaves } from '../tools/algebra/leaves.js';
import { treeSettings } from '../tools/algebra/build.js';
import { recipes } from '../tools/algebra/recipes.js';

// The blocks of tools/algebra/blocks/top10-94nop.js (docs/hill-top10/94nop.md).
const ok = (b) => assert.equal(b.verification.ok, true, JSON.stringify(b.verification.issues ?? b.verification));
const build = (tree, rules = '94nop', length = 100) => buildTree(tree, { rules, length });
const misfits = (id, P, rules = '94nop', length = 100) => leaves[id].mismatches({ ...leaves[id].defaults, ...P }, treeSettings(rules, length));

test('the bodies pass the gate alone with their defaults', () => {
  for (const id of ['cobra-body', 'agony-body', 'lore-vampire', 'collective-paper', 'toly-pump']) ok(build({ id }));
});

test('the openings pass the gate (and their planted bursts) in front of a body', () => {
  for (const id of ['lattice-qscan', 'qi-qscan', 'q45-qscan']) ok(build({ id: 'seq', kids: [{ id }, { id: 'cobra-body', P: { BOOT: 6055 } }] }));
  ok(build({ id: 'seq', kids: [{ id: 'qi-qscan', P: { FORM: 1, A0: 5340, B0: 4327, A1: 2215, B1: 2487, A2: 4665, B2: 2698, BSTEP: 5, BHOP: 78, BCOUNT: 20 } }, { id: 'imp' }] }));
});

test('the fan-boot members work beside a partner, and cobra-body under the boot combinator', () => {
  ok(build({ id: 'fanboot', P: { N: 6, K: 2, HOPA: 4854, HOPB: 556 }, kids: [{ id: 'h-stone' }, { id: 'moore-paper' }] }));
  ok(build({ id: 'fanboot', P: { N: 4, K: 1, SPLIT: 1, MOREA: 1, HOPA: 7116, HOPB: 6860 }, kids: [{ id: 'armadillo-switch', P: { STEP: 2090, HOP: 46, STREAM: 1 } }, { id: 'toly-pump', P: { IDEST: 7402 } }] }));
  ok(build({ id: 'boot', P: { HOP: 3000, WIPE: 1 }, kids: [{ id: 'cobra-body' }] }));
  ok(build({ id: 'boot', P: { HOP: 1423, DIRECT: 1 }, kids: [{ id: 'agony-body' }] }));
});

test('every top-10 94nop recipe builds and passes the gate', () => {
  const keys = Object.keys(recipes).filter((k) => k.startsWith('top10-94nop-'));
  assert.equal(keys.length, 10);
  for (const k of keys) ok(build(recipes[k].tree('94nop'), '94nop', recipes[k].length));
});

test('cobra-body: its own boot is shorter than the boot combinator\'s copy and starts the scan BOOT cells on', () => {
  const own = build({ id: 'cobra-body', P: { BOOT: 3000 } });
  ok(own);
  assert.equal(own.total, 23 + 6);
  assert.match(own.source, /MOV\.F #0, \{0/);
});

test('lore-vampire lays its islands out as Forgotten Lore II does', () => {
  const b = build({ id: 'lore-vampire' });
  assert.equal(b.total, 99);
  const ins = b.w.instructions;
  assert.deepEqual([ins[1].op, ins[1].aMode, ins[1].a, ins[1].b], ['JMP', '@', 335, -117]);
  assert.equal(ins[76].op, 'DJN');
  assert.equal(ins[95].op, 'SPL');
});

test('mismatches refuse settings that break each block', () => {
  assert.ok(misfits('cobra-body', { STEP: 20 }).some((m) => /shares a factor/.test(m)));
  assert.ok(misfits('cobra-body', { SKIP: 10 }).some((m) => /SKIP must clear/.test(m)));
  assert.ok(misfits('cobra-body', { BOOT: 50 }).some((m) => /BOOT puts the copy/.test(m)));
  assert.ok(misfits('lattice-qscan', { QFAC: 1534 }).some((m) => /no inverse/.test(m)));
  assert.ok(misfits('lattice-qscan', {}, 'modelwar', 5040).some((m) => /no inverse mod 25200/.test(m)));
  assert.ok(misfits('agony-body', { STEP: 3146 }).some((m) => /shares a factor/.test(m)));
  assert.ok(misfits('agony-body', {}, '94x').some((m) => /shares a factor with the 55440/.test(m)));
  assert.ok(misfits('agony-body', { WLEN: 15 }).some((m) => /WLEN must be even/.test(m)));
  assert.ok(misfits('lore-vampire', { STEP: 25 }).some((m) => /before flag|never reach flag/.test(m)));
  assert.ok(misfits('lore-vampire', { STEP: 45 }).some((m) => /STEP puts the loop on the clear/.test(m)));
  assert.ok(misfits('collective-paper', { D: 7990 }).some((m) => /lands on/.test(m)));
  assert.ok(misfits('toly-pump', { IDEST: 7990 }).some((m) => /IDEST lays the imps/.test(m)));
  assert.ok(misfits('toly-pump', { ISTEP: 2 }).some((m) => /not the step of a ring/.test(m)));
  assert.ok(misfits('moore-paper', { STEP: 7990 }).some((m) => /lands the copy on the paper/.test(m)));
  assert.ok(misfits('h-stone', { STEP: 20 }).some((m) => /shares 20/.test(m)));
  assert.ok(misfits('q45-qscan', { QZ: 3 }).some((m) => /no inverse/.test(m)));
  assert.ok(misfits('qi-qscan', { BCOUNT: 40, BSTEP: 100 }).some((m) => /too wide/.test(m)));
});

test('the gate catches a lattice-qscan whose scanned cells land on the warrior', () => {
  assert.throws(() => build({ id: 'seq', kids: [{ id: 'lattice-qscan', P: { QFAC: 1 } }, { id: 'cobra-body', P: { BOOT: 6055 } }] }), /lattice-qscan/);
});
