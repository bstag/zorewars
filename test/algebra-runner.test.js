import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree } from '../tools/algebra/index.js';
import { leaves } from '../tools/algebra/leaves.js';
import { treeSettings } from '../tools/algebra/build.js';

const SI = 'runner-stone-imp', PS = 'runner-paper-stone';
const build = (id, P, rules = 'modelwar', length = 5040) => buildTree({ id, P }, { rules, length });
const misfits = (id, P, rules = 'modelwar', length = 5040) => leaves[id].mismatches({ ...leaves[id].defaults, ...P }, treeSettings(rules, length));

test('the paper/stone runner boot passes the gate with its defaults', () => {
  const b = build(PS, {});
  assert.equal(b.verification.ok, true, JSON.stringify(b.verification.issues ?? b.verification));
  // Fan, two copy lines, K vectors, the paper vector, the 6-cell stone and the 6-cell paper.
  assert.equal(b.total, 3 + 2 + 6 + 1 + 6 + 6);
  assert.match(b.source, /SUB\.X/);
  assert.match(b.source, /JMZ\.F/);
});

test('the stone/imp runner boot passes the gate with its defaults', () => {
  const b = build(SI, {});
  assert.equal(b.verification.ok, true, JSON.stringify(b.verification.issues ?? b.verification));
  // Three pumps: a copy line and a vector each.
  assert.equal((b.source.match(/MOV\.I +</g) ?? []).length, 3 + 1);
});

test('one pump builds a smaller boot', () => {
  const b = build(SI, { PUMPS: 1 });
  assert.equal(b.verification.ok, true, JSON.stringify(b.verification.issues ?? b.verification));
  assert.ok(b.total < build(SI, {}).total);
});

test('the runner stone refuses settings that bomb itself or never retire', () => {
  assert.ok(misfits(PS, { TIME: 4651 }).some((m) => /TIME must be even/.test(m)));
  assert.ok(misfits(PS, { STEP: 10650 }).some((m) => /2\*STEP shares/.test(m)));
  assert.ok(misfits(SI, { IPOINTS: 5 }).some((m) => /no 5-point spiral/.test(m)));
  assert.ok(misfits(SI, { D: 1 }).some((m) => /too few for a 31-point spiral/.test(m)));
  assert.deepEqual(misfits(SI, { D: 1, IPOINTS: 13 }).filter((m) => /spiral/.test(m)), []);
});

test('the stone/imp boot keeps its bodies apart', () => {
  assert.ok(misfits(SI, { SHOP: 300, IHOP: 320 }).some((m) => /on top of each other/.test(m)));
});
