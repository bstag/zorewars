// Tests for the large decoy field (tools/algebra/blocks/xdecoys.js): decoy-field.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, treeMismatches, leaves, shape } from '../tools/algebra/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';

const image = (...kids) => ({ id: 'image', kids });
const boot = (kid) => ({ id: 'boot', P: { HOP: 19000 }, kids: [kid] });
const field = (built) => built.w.instructions.slice(built.labels[Object.keys(built.labels).find((k) => k.endsWith('dfField'))]);
const ok = (tree, rules, length) => {
  const built = buildTree(tree, { rules, length });
  assert.equal(built.verification.ok, true, `${shape(tree)} on ${rules}`);
  return built;
};

test('decoy-field fills a full-size image behind a booted scanner, a stone and a paper/stone', () => {
  assert.equal(leaves['decoy-field'].kind, 'data');
  // 168 decoys is the largest field in the X top 30; with a booted ladder scanner that is 193 cells.
  const big = ok(image(boot({ id: 'ladder-scanner' }), { id: 'decoy-field', P: { COUNT: 168 } }), '94x-hill', 200);
  assert.equal(big.total, 25 + 168);
  ok(image(boot({ id: 'movthrough-stone' }), { id: 'decoy-field', P: { COUNT: 150, GAP: 30 } }), '94x-hill', 200);
  ok(image(boot({ id: 'ladder-scanner' }), { id: 'decoy-field', P: { COUNT: 63, PATTERN: 1 } }), '94x', 100);
  ok(image(boot({ id: 'follow-scanner' }), { id: 'decoy-field', P: { COUNT: 60 } }), '94nop', 100);
  // Full verification of one.
  assert.equal(buildTree(image(boot({ id: 'ladder-scanner' }), { id: 'decoy-field' }), { rules: '94x-hill', length: 200, verification: 'full' }).verification.ok, true);
});

test('PATTERN 0 cells all differ from one another; PATTERN 1 cells are identical and field-zero; GAP is blank', () => {
  const key = (x) => JSON.stringify([x.op, x.mod, x.aMode, x.a, x.bMode, x.b]);
  const a = field(ok(image(boot({ id: 'ladder-scanner' }), { id: 'decoy-field', P: { COUNT: 168 } }), '94x-hill', 200));
  assert.equal(a.length, 168);
  assert.equal(new Set(a.map(key)).size, 168, 'every decoy cell is different');
  assert.ok(a.every((x) => x.op === 'SPL' && x.a !== 0 && x.b !== 0), 'SPLs with both fields non-zero');
  // Neighbours differ in more than a field: a comparing scanner with any small gap sees a difference.
  for (let gap = 1; gap <= 20; gap++) for (let i = 0; i + gap < a.length; i++) assert.notEqual(key(a[i]), key(a[i + gap]));
  const b = field(ok(image(boot({ id: 'ladder-scanner' }), { id: 'decoy-field', P: { COUNT: 100, PATTERN: 1 } }), '94x-hill', 200));
  assert.equal(new Set(b.map(key)).size, 1, 'identical cells');
  assert.ok(b[0].op === 'SPL' && b[0].a === 0 && b[0].b === 0);
  const gapped = ok(image(boot({ id: 'ladder-scanner' }), { id: 'decoy-field', P: { COUNT: 50, GAP: 40 } }), '94x-hill', 200);
  const g0 = gapped.labels[Object.keys(gapped.labels).find((k) => k.endsWith('dfGap'))];
  for (let i = 0; i < 40; i++) { const x = gapped.w.instructions[g0 + i]; assert.ok(x.op === 'DAT' && x.a === 0 && x.b === 0, `gap cell ${i}`); }
  assert.equal(gapped.total, 25 + 40 + 50);
});

test('bad settings are refused', () => {
  const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  has(image({ id: 'ladder-scanner' }, { id: 'decoy-field', P: { COUNT: 120 } }), recipeSettings('94x', 50), /do not fit a 50-instruction warrior/);
  has(image({ id: 'ladder-scanner' }, { id: 'decoy-field', P: { COUNT: 150, GAP: 60 } }), recipeSettings('94x-hill', 200), /do not fit a 200-instruction warrior/);
  has(image({ id: 'ladder-scanner' }, { id: 'decoy-field', P: { COUNT: 191 } }), recipeSettings('94x-hill', 200), /COUNT must be an integer from 1 to 190/);
  has(image({ id: 'stone' }, { id: 'decoy-field', P: { COUNT: 20 } }), recipeSettings('88', 100), /needs ICWS'94/);
  // Data cannot run: it is refused as a body.
  assert.throws(() => buildTree({ id: 'decoy-field' }, { rules: '94x-hill', length: 200 }));
});
