import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { compile, RULESETS } from '../src/engine/index.js';
import { buildTree, recipes } from '../tools/algebra/index.js';

test('the LP hybrid recipe reproduces the benchmark warrior', () => {
  const rules = 'lp-hill';
  const source = readFileSync(new URL('./fixtures/lp-romulan-rous.red', import.meta.url), 'utf8');
  const reference = compile(source, 'redcode', RULESETS[rules]);
  assert.ok(reference.ok);
  const { w } = buildTree(recipes['lp-romulan-rous'].tree(), { rules, length: 200, verification: 'full' });
  const instructions = warrior => warrior.instructions.map(({ line, ...instruction }) => instruction);
  assert.equal(w.start, reference.start);
  assert.deepEqual(instructions(w), instructions(reference));
});
