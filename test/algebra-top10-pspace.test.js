// Tests for the blocks and recipes added while rebuilding the Koenigstuhl P-space
// hill's top 10 (tools/algebra/blocks/top10-pspace.js, tools/algebra/recipes-top10/pspace.js,
// switch-table ROWS 1; docs/hill-top10/pspace.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, leaves } from '../tools/algebra/index.js';
import { treeSettings } from '../tools/algebra/build.js';
import { recipes } from '../tools/algebra/recipes.js';
import { rowsPlan, rowsChoice, packRow } from '../tools/algebra/switch-table.js';

const IDS = ['sunset-paper-stone', 'recon-scanner', 'mini-blur', 'fi-paper', 'skew-dwarf', 'carbonite-stone', 'twin-silk',
  'nomolos-paper', 'incendiary-clear', 'mirage-scanner', 'sdd-clear', 'imp-silk', 'vanquisher'];
const ok = (tree, rules = 'pspace', length = 100) => {
  const built = buildTree(tree, { rules, length });
  assert.equal(built.verification.ok, true, JSON.stringify(built.verification.issues ?? built.verification));
  return built;
};
const misfits = (id, P, rules = 'pspace', length = 100) => leaves[id].mismatches({ ...leaves[id].defaults, ...P }, treeSettings(rules, length));
const refuses = (tree, pattern, rules = 'pspace') => assert.throws(() => buildTree(tree, { rules, length: 100 }), pattern);

test('the blocks load with a watch and accept their defaults on the P-space hill', () => {
  for (const id of IDS) {
    assert.ok(leaves[id], id);
    assert.equal(typeof leaves[id].watch, 'function', `${id} watch`);
    assert.deepEqual(misfits(id, {}), [], id);
  }
});

test('every top10-pspace recipe passes the gate on its hill and builds for ModelWar', () => {
  const keys = Object.keys(recipes).filter((k) => k.startsWith('top10-pspace-'));
  assert.equal(keys.length, 10);
  for (const k of keys) {
    const b = ok(recipes[k].tree('pspace'));
    assert.ok(b.total <= 100, `${k}: ${b.total} instructions`);
  }
  // ModelWar: 25,200 cells; built at length 200 (the warriors are under 100 cells).
  ok(recipes['top10-pspace-sunset'].tree('modelwar'), 'modelwar', 200);
  ok(recipes['top10-pspace-fire-and-ice'].tree('modelwar'), 'modelwar', 200);
});

test('switch-table ROWS: the stored numbers carry each next state as three residues', () => {
  const P = { ROWS: 1, STATES: 11, FIRST: 0, R0: packRow(0, 4, 9, 4), R1: packRow(0, 4, 9, 0), R2: packRow(2, 0, 6, 6), R3: packRow(0, 7, 10, 5), R4: packRow(1, 7, 8, 8),
    R5: packRow(0, 2, 10, 7), R6: packRow(2, 2, 6, 6), R7: packRow(0, 2, 10, 2), R8: packRow(1, 4, 8, 8), R9: packRow(0, 0, 9, 1), R10: packRow(0, 5, 10, 3) };
  const plan = rowsPlan(P, 8000);
  assert.deepEqual(plan.moduli, [11, 12, 13]);
  // Sunset's first round plays the paper; a loss there goes to Recon 2 at its first place.
  assert.deepEqual(rowsChoice(P, 8000, -1, 0), { branch: 0, state: 0, stored: plan.values[0] });
  assert.equal(rowsChoice(P, 8000, 0, plan.values[0]).branch, 1);
  assert.equal(rowsChoice(P, 8000, 2, plan.values[3]).state, 5);
  // A number from no state (residue past STATES) plays FIRST.
  assert.equal(rowsChoice(P, 8000, 2, 12).state, 0);
});

test('switch-table ROWS refuses rows that play a missing member or name a missing state', () => {
  const kids = [{ id: 'stone' }, { id: 'stone', P: { TSTEP: 8 } }];
  ok({ id: 'switch-table', P: { ROWS: 1, STATES: 2, R0: packRow(0, 1, 0, 0), R1: packRow(1, 0, 1, 1) }, kids });
  refuses({ id: 'switch-table', P: { ROWS: 1, STATES: 2, R0: packRow(2, 1, 0, 0), R1: packRow(1, 0, 1, 1) }, kids }, /plays a missing member/);
  refuses({ id: 'switch-table', P: { ROWS: 1, STATES: 2, R0: packRow(0, 3, 0, 0), R1: packRow(1, 0, 1, 1) }, kids }, /state past STATES/);
  refuses({ id: 'switch-table', P: { ROWS: 1, STATES: 2, FIRST: 2, R0: 0, R1: 0 }, kids }, /FIRST is not one of the STATES/);
  refuses({ id: 'switch-table', kids: [{ id: 'imp' }, { id: 'imp' }, { id: 'imp' }, { id: 'imp' }, { id: 'imp' }] }, /more than four members needs ROWS 1/);
});

test('sunset-paper-stone: 23 cells, refuses lattices that bomb its loop and copies on the warrior', () => {
  assert.equal(ok({ id: 'sunset-paper-stone' }).total, 23);
  assert.ok(misfits('sunset-paper-stone', { OFF: 4656 }).some((m) => /land on its own loop/.test(m)));
  assert.ok(misfits('sunset-paper-stone', { SHOP: 50 }).length > 0);
  assert.ok(misfits('sunset-paper-stone', { PHOP: 5302 }).some((m) => /overlap/.test(m)));
});

test('recon-scanner and mini-blur find a planted target booted, and refuse broken settings', () => {
  ok({ id: 'boot', P: { HOP: 1282, DIRECT: 1 }, kids: [{ id: 'recon-scanner' }] });
  ok({ id: 'boot', P: { HOP: 2942, DIRECT: 1 }, kids: [{ id: 'mini-blur' }] });
  assert.ok(misfits('recon-scanner', { GAP: 12 }).some((m) => /cannot cover a pair/.test(m)));
  assert.ok(misfits('recon-scanner', { STEP: 4000 }).some((m) => /looks at only/.test(m)));
  // Step 2891 with 3,000 looks reaches mini Blur's own ADD-side cells.
  assert.ok(misfits('mini-blur', { TIME: 3000 }).some((m) => /look 790 of 3000 lands on its own code/.test(m)));
});

test('the papers make copies, and refuse steps that land on themselves', () => {
  for (const id of ['fi-paper', 'twin-silk', 'nomolos-paper', 'imp-silk']) ok({ id });
  assert.ok(misfits('fi-paper', { BOOT: 30 }).length > 0);
  assert.ok(misfits('twin-silk', { C1: 7995 }).some((m) => /lands a copy on itself/.test(m)));
  assert.ok(misfits('nomolos-paper', { D2: 5 }).some((m) => /lands a copy on itself/.test(m)));
  assert.ok(misfits('imp-silk', { STEP1: 7990 }).some((m) => /lands a copy on itself/.test(m)));
});

test('the stones and clears run alone and refuse timings that bomb their own loops', () => {
  ok({ id: 'boot', P: { HOP: 5420, DIRECT: 1 }, kids: [{ id: 'skew-dwarf' }] });
  ok({ id: 'boot', P: { HOP: 1457, DIRECT: 1 }, kids: [{ id: 'carbonite-stone' }] });
  ok({ id: 'incendiary-clear' });
  ok({ id: 'boot', P: { HOP: 4235 }, kids: [{ id: 'sdd-clear', P: { PAD: 0 } }] });
  ok({ id: 'mirage-scanner' });
  ok({ id: 'vanquisher' });
  assert.ok(misfits('skew-dwarf', { TIME: 3999 }).some((m) => /bombs its own code/.test(m)));
  assert.ok(misfits('carbonite-stone', { TIME: 7999 }).some((m) => /bombs its own loop/.test(m)));
  assert.ok(misfits('incendiary-clear', { HOP: 3 }).length > 0);
  assert.ok(misfits('mirage-scanner', { STEP: 4000 }).some((m) => /looks at only/.test(m)));
  assert.ok(misfits('vanquisher', { DOFF: 5 }).some((m) => /plants the bombs on the loop/.test(m)));
});
