import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree } from '../tools/algebra/index.js';
import { splitPlan } from '../tools/algebra/blocks/split-stone.js';

test('split-stone passes the gate on modelwar (a full lap, then its clear) and on 94nop with a factor of 4', () => {
  for (const [rules, P] of [['modelwar', {}], ['modelwar', { M: 0 }], ['modelwar', { CHECK: 0 }], ['94nop', { G: 4 }]]) {
    const t = buildTree({ id: 'split-stone', P }, { rules });
    assert.equal(t.verification.ok, true, `${rules} ${JSON.stringify(P)}: ${JSON.stringify(t.verification.issues ?? t.verification)}`);
  }
});

test('split-stone booted away still passes', () => {
  const t = buildTree({ id: 'boot', P: { HOP: 12600 }, kids: [{ id: 'split-stone' }] }, { rules: 'modelwar' });
  assert.equal(t.verification.ok, true, JSON.stringify(t.verification.issues ?? t.verification));
});

test('split-stone bombs two classes G apart: every G-th cell over a lap of core / 2G passes', () => {
  const { S, g, N } = splitPlan({ G: 3, STEPF: 1199 }, 25200);
  assert.equal(g, 3);
  assert.equal(N, 25200 / 6);
  assert.equal((2 * S) % 6, 0);
  assert.equal(S % 6, 3);
});

test('split-stone refuses a step whose factor leaves no room around its pointer', () => {
  assert.throws(() => buildTree({ id: 'split-stone', P: { G: 3 } }, { rules: '94nop' }), /factor of 3 or more/);
});

test('Trio v8 rebuilds to the committed Redcode', async () => {
  const fs = await import('node:fs');
  const tree = JSON.parse(fs.readFileSync(new URL('../modelwar/trio8.json', import.meta.url), 'utf8'));
  const built = buildTree(tree, { rules: 'modelwar', length: 5040, verification: 'quick' }).source;
  const body = (s) => s.split(/\r?\n/).filter((l) => !l.startsWith(';')).join('\n').trim();
  assert.equal(body(built), body(fs.readFileSync(new URL('../modelwar/trio8.red', import.meta.url), 'utf8')));
});
