import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree } from '../tools/algebra/index.js';

test('steered-oneshot builds and passes the gate alone on 94nop and modelwar', () => {
  for (const rules of ['94nop', 'modelwar']) {
    const t = buildTree({ id: 'steered-oneshot' }, { rules });
    assert.equal(t.verification.ok, true, `${rules}: ${JSON.stringify(t.verification.issues ?? t.verification)}`);
  }
});

test('steered-oneshot lays its decoys from SEED: same SEED, same code; another SEED, other fields', () => {
  const a = buildTree({ id: 'steered-oneshot', P: { SEED: 7 } }, { rules: 'modelwar', verification: 'quick' }).source;
  const b = buildTree({ id: 'steered-oneshot', P: { SEED: 7 } }, { rules: 'modelwar', verification: 'quick' }).source;
  const c = buildTree({ id: 'steered-oneshot', P: { SEED: 8 } }, { rules: 'modelwar', verification: 'quick' }).source;
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('steered-oneshot is refused when its decoys do not fit the length limit', () => {
  assert.throws(() => buildTree({ id: 'steered-oneshot', P: { HEAD: 16, TGAP: 80, TAIL: 16 } }, { rules: '94nop' }), /do not fit/);
});

test('Trio v7 rebuilds to the committed Redcode', async () => {
  const fs = await import('node:fs');
  const tree = JSON.parse(fs.readFileSync(new URL('../modelwar/trio7.json', import.meta.url), 'utf8'));
  const built = buildTree(tree, { rules: 'modelwar', length: 5040, verification: 'quick' }).source;
  const body = (s) => s.split(/\r?\n/).filter((l) => !l.startsWith(';')).join('\n').trim();
  assert.equal(body(built), body(fs.readFileSync(new URL('../modelwar/trio7.red', import.meta.url), 'utf8')));
});
