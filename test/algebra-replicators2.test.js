// The recovering replicators (tools/algebra/blocks/replicators2.js): each builds
// and passes the gate with its defaults on every rule set it supports, alone and
// combined; its planted damage is repaired; a variant without the recovery is
// refused by the gate; settings that can't work are refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, treeMismatches, link, gate, shape } from '../tools/algebra/index.js';
import { compile } from '../src/engine/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';

const ok = (rules, tree) => {
  const built = buildTree(tree, { rules });
  assert.equal(built.verification.ok, true, `${rules} ${shape(tree)}`);
  return built;
};
const planted = (built, id) => built.verification.observations.some((o) => o.scenario === `${id}: planted target`);
// LP allows 8 processes: the feeder gets a 3-point spiral of 4 imps there.
const LP_FEEDER = { N: 3, K: 2 };

test('every block passes the gate alone with its defaults on every rule set it supports', () => {
  for (const r of ['88', '94nop', 'lp', '94x']) assert.ok(planted(ok(r, { id: 'relaunch-paper' }), 'relaunch-paper'), r);
  for (const r of ['88', '94nop', '94x']) assert.ok(planted(ok(r, { id: 'imp-feeder' }), 'imp-feeder'), r);
  assert.ok(treeMismatches({ id: 'imp-feeder' }, recipeSettings('lp')).some((m) => /more processes than this hill allows/.test(m)));
  assert.ok(planted(ok('lp', { id: 'imp-feeder', P: LP_FEEDER }), 'imp-feeder'));
  // Other sizes work too.
  ok('94nop', { id: 'relaunch-paper', P: { N: 16 } });
  ok('94x', { id: 'relaunch-paper', P: { N: 4 } });
  ok('lp', { id: 'relaunch-paper', P: { N: 5 } });
  ok('94nop', { id: 'imp-feeder', P: { N: 3, K: 2, WAIT: 30 } });
  ok('94x', { id: 'imp-feeder', P: { N: 17, K: 5, WAIT: 4 } });
});

test('the blocks combine with others', () => {
  const stone = { id: 'stone' };
  const cases = [
    ['88', { id: 'par', kids: [stone, { id: 'relaunch-paper' }] }],
    ['94nop', { id: 'par', kids: [stone, { id: 'relaunch-paper' }] }],
    ['94nop', { id: 'apart', kids: [stone, { id: 'relaunch-paper' }] }],
    ['lp', { id: 'par', kids: [{ id: 'imp-gate' }, { id: 'relaunch-paper', P: { N: 4 } }] }],
    ['lp', { id: 'copies', kids: [{ id: 'relaunch-paper', P: { N: 4 } }] }],
    ['94x-hill', { id: 'switch', kids: [stone, { id: 'relaunch-paper' }] }],
    ['88', { id: 'par', kids: [stone, { id: 'imp-feeder' }] }],
    ['94nop', { id: 'apart', kids: [stone, { id: 'imp-feeder' }] }],
    ['88', { id: 'boot', P: { HOP: 3000 }, kids: [{ id: 'imp-feeder' }] }],
    ['lp', { id: 'boot', P: { HOP: 3000 }, kids: [{ id: 'imp-feeder', P: LP_FEEDER }] }],
    ['94x-hill', { id: 'switch', kids: [stone, { id: 'imp-feeder' }] }],
  ];
  for (const [rules, tree] of cases) ok(rules, tree);
});

test('settings that cannot work are refused', () => {
  const has = (rules, tree, re) => {
    const m = treeMismatches(tree, recipeSettings(rules));
    assert.ok(m.some((x) => re.test(x)), JSON.stringify(m));
  };
  has('94nop', { id: 'relaunch-paper', P: { N: 3 } }, /3 slots don't divide a 8000-cell core/);
  has('94x', { id: 'relaunch-paper', P: { N: 13 } }, /13 slots don't divide a 55440-cell core/);
  has('lp', { id: 'relaunch-paper', P: { N: 16 } }, /more slots than the process table holds/);
  has('94nop', { id: 'imp-feeder', P: { N: 12 } }, /no 12-point imp spiral/);
  has('94nop', { id: 'imp-feeder', P: { N: 13, K: 3 } }, /fewer imps than points/);
  has('94x', { id: 'imp-feeder', P: { N: 7 } }, /no 7-point imp spiral on a 55440-cell core/);
});

// Link a block, rewrite lines of its code ([pattern, replacement] pairs), and run the gate on the result.
function broken(tree, rules, ...edits) {
  const settings = recipeSettings(rules), linked = link(tree, settings);
  let source = linked.source;
  for (const [line, by] of edits) {
    const next = source.replace(line, by);
    assert.notEqual(next, source, String(line));
    source = next;
  }
  const w = compile(source, 'redcode', settings);
  assert.ok(w.ok, JSON.stringify(w.errors));
  return () => gate({ ...linked, source, w, settings, tree });
}

test('the gate refuses the blocks with their recovery taken out', () => {
  // A paper whose copies still scan, vote and relaunch but no longer rewrite
  // the cell: the boot spreads it, so it passes alone, but the wiped slots stay wiped.
  assert.throws(broken({ id: 'relaunch-paper' }, '94nop', [/^(b0fix) MOV\.I .*$/m, '$1 NOP.F $0, $0']), /relaunch-paper did not rebuild wiped slot/);
  assert.throws(broken({ id: 'relaunch-paper' }, '88', [/^(b0fix) MOV .*$/m, '$1 JMP b0more, 0']), /relaunch-paper (did not rebuild|never repaired)/);
  // A feeder that stops after ten laps (counted down in its counter's A-field):
  // the spiral grows, but the imps the planted kill takes are never replaced.
  // Without the feeder the kill may take the rest of the spiral too.
  const noRefill = /imp-feeder did not refill its spiral|did not survive alone \(imp-feeder: planted target\)/;
  const stop = (rules, P) => broken({ id: 'imp-feeder', P }, rules, [/^ JMP\.B b0fLoop, 0$/m, ' DJN.A b0fLoop, b0fCnt'], [/^(b0fCnt DAT\.F) #0,/m, '$1 #10,']);
  assert.throws(stop('94nop', {}), noRefill);
  assert.throws(stop('94x', { WAIT: 30 }), noRefill);
  assert.throws(stop('lp', LP_FEEDER), noRefill);
});
