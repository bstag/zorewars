// fan-imp-pump (tools/algebra/blocks/fan-imp-pump.js): the continuous imp pump
// for a fan of lockstep entrants, and the 4 / 1 / 4 three-body launch
// (fanboot3 ROUTE 1) it was written for.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, treeMismatches, shape } from '../tools/algebra/index.js';
import { compile, VM } from '../src/engine/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';

const s94 = recipeSettings('94nop', 100);
const ok = (rules, tree, opts = {}) => {
  const built = buildTree(tree, { rules, length: 100, ...opts });
  assert.equal(built.verification.ok, true, `${rules} ${shape(tree)}`);
  return built;
};
const pump = (P = {}) => ({ id: 'fan-imp-pump', P: { FAN: 0, PROCS: 4, ...P } });
// Stone at +3000, pump at +4400, clear at +7000 (its span, 5494 .. 6993, holds neither copy).
const three = (stone, P = {}) => ({ id: 'fanboot3', P: { N: 4, ROUTE: 1, HOPA: 3000, HOPB: 7000, HOPC: 4400, ...P }, kids: [stone, { id: 'gated-dclear' }, pump()] });

test('fan-imp-pump passes the gate alone: 3 points on 8,000 cells, 13 on 55,440, and other fans', () => {
  assert.equal(ok('94nop', { id: 'fan-imp-pump' }).total, 2 + 4);              // a fan of four, then the four cells
  ok('94x', { id: 'fan-imp-pump' });                                           // POINTS 0: 13 points, 16 processes
  ok('94nop', { id: 'fan-imp-pump', P: { PROCS: 3 } });
  ok('94nop', { id: 'fan-imp-pump', P: { PROCS: 6 } });
  ok('94nop', { id: 'fan-imp-pump', P: { POINTS: 7, PROCS: 8 } });
  ok('94x', { id: 'fan-imp-pump', P: { POINTS: 13, PROCS: 16 } });
});

test('launch k lands k ring steps past the seed, on an imp, and the spiral keeps growing', () => {
  const built = buildTree({ id: 'fan-imp-pump' }, { rules: '94nop', length: 100 }), at = (l) => built.labels[built.root.ns + l];
  const vm = new VM(s94); vm.load([compile(built.source, 'redcode', s94)], { positions: [0] });
  const jump = at('fpJ'), seed = at('fpImp'), targets = [];
  const imps = () => vm.processes(0).filter((q) => vm.peek(q).op === 'MOV' && vm.peek(q).b === 2667).length;
  let ranEmpty = 0, early = null;
  while (vm.cycle < 6000) {
    const pc = vm.processes(0)[0];
    if (pc === jump) targets.push((jump + vm.peek(jump).a) % 8000);
    else if (pc > seed + 3 && vm.peek(pc).op === 'DAT') ranEmpty++;       // an imp or a launch that found nothing to run
    vm.step();
    if (vm.cycle === 600) early = imps();
  }
  assert.ok(targets.length > 100, `${targets.length} launches`);
  targets.forEach((t, k) => assert.equal(t, (seed + k * 2667) % 8000, `launch ${k}`));
  assert.equal(ranEmpty, 0);
  assert.ok(imps() > 2 * early && early >= 12, `${early} imps at 600, ${imps()} at 6000`);
  // The four feeders are still on the SPL.
  assert.equal(vm.processes(0).filter((q) => q === at('fpGo')).length, 4);
});

test('the 4 / 1 / 4 three-body launch passes the gate with each multi-process stone, behind a quickscan at 100 (full) and at 50', () => {
  const stones = [{ id: 'run-stone' }, { id: 'armadillo-switch', P: { STEP: 3510, HOP: 56, STREAM: 1 } }, { id: 'timed-stone' }];
  const nudge = (stone) => (stone.id === 'run-stone' ? { HOPB: 7002, HOPC: 4404 } : {});     // off run-stone's lattice
  for (const stone of stones) ok('94nop', three(stone, nudge(stone)));
  const scan = (UNITS) => ({ id: 'opening-qscan-mul', P: { UNITS, SHARE: 1 } }), arm = stones[1];
  const big = ok('94nop', { id: 'seq', kids: [scan(10), { id: 'probe-burst2' }, three(arm)] }, { verification: 'full' });
  assert.equal(big.verification.profile, 'full');
  assert.ok(big.total <= 100, `${big.total}`);
  const small = ok('94nop', { id: 'seq', kids: [scan(3), three(arm)] }, { length: 50 });
  assert.ok(small.total <= 50, `${small.total}`);
  // Counted in the core once the boot is over: four feeders on the pump's SPL, one process in the clear, the rest in the stone.
  const built = buildTree(three(arm), { rules: '94nop', length: 100 }), vm = new VM(s94);
  vm.load([compile(built.source, 'redcode', s94)], { positions: [0] });
  const span = built.root.kids.map((k, i) => ({ start: built.spans[k.ns].start + [3000, 7000, 4400][i], size: built.spans[k.ns].size }));
  for (let n = 0; n < 2000 && vm.processes(0).some((q) => q < span[0].start - 3000); n++) vm.step();
  const count = (s) => vm.processes(0).filter((q) => q >= s.start && q < s.start + s.size).length;
  assert.equal(vm.processes(0).filter((q) => q === span[2].start).length, 4);
  assert.equal(count(span[1]), 1);
  assert.ok(count(span[0]) >= 4, `${count(span[0])} in the stone`);
});

test('on 94x it runs beside a stone in a fan boot', () => {
  ok('94x', { id: 'fanboot', P: { N: 16, K: 1, HOPA: 20000, HOPB: 40000 }, kids: [{ id: 'mod-stone' }, { id: 'fan-imp-pump', P: { FAN: 0 } }] });
});

test('settings and entrants that cannot work are refused', () => {
  const has = (tree, re, rules = '94nop') => {
    const m = treeMismatches(tree, recipeSettings(rules, 100));
    assert.ok(m.some((x) => re.test(x)), JSON.stringify(m));
  };
  has({ id: 'fan-imp-pump' }, /needs ICWS'94/, '88');
  has({ id: 'fan-imp-pump' }, /this hill allows 8 processes/, 'lp');
  has({ id: 'fan-imp-pump', P: { POINTS: 3 } }, /no 3-point spiral on a 55440-cell core/, '94x');
  has({ id: 'fan-imp-pump', P: { POINTS: 7, PROCS: 4 } }, /PROCS must be at least POINTS/);
  has({ id: 'fan-imp-pump', P: { PROCS: 5 } }, /PROCS must be a fan size/);
  // The bare pump needs its PROCS entrants together: one process, or the old 1-entrant routing, fails the gate.
  assert.throws(() => buildTree(pump(), { rules: '94nop', length: 100 }), /1 process entered together/);
  assert.throws(() => buildTree(three({ id: 'mod-stone' }, { ROUTE: 0 }), { rules: '94nop', length: 100 }), /1 process entered together/);
});
