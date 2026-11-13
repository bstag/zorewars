// Tests for the bounded-feeder remote-bomb stone (tools/algebra/blocks/xremotefeed.js): remote-feed-stone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, treeMismatches, leaves, shape, link, treeSettings } from '../tools/algebra/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';
import { compile, VM } from '../src/engine/index.js';

const ID = 'remote-feed-stone';
const mod = (x, n) => ((x % n) + n) % n;
const ok = (tree, rules, length = 100, verification = 'quick') => {
  const built = buildTree(tree, { rules, length, verification });
  assert.equal(built.verification.ok, true, `${shape(tree)} on ${rules}`);
  return built;
};

test('remote-feed-stone builds alone, booted and beside a pump, on both cores', () => {
  assert.equal(typeof leaves[ID].watch, 'function');
  assert.equal(ok({ id: ID }, '94x').total, 16);
  for (const rules of ['94x', '94nop']) ok({ id: ID }, rules, 100, 'full');
  ok({ id: 'boot', P: { HOP: 20000 }, kids: [{ id: ID }] }, '94x', 50);
  // One entrant: the fan boot's last process (SPLIT 1, N 2), beside dual-imp-pump.
  ok({ id: 'fanboot', P: { N: 2, SPLIT: 1, HOPA: 31000, HOPB: 20000 }, kids: [{ id: 'dual-imp-pump' }, { id: ID }] }, '94x', 50);
  // A long-phase step: 22069 plans about 20,000 passes on 55,440 cells.
  ok({ id: ID, P: { STEP: 22069 } }, '94x', 100, 'full');
});

test('bad settings are refused, and so is more than one entrant', () => {
  const x = recipeSettings('94x');
  const has = (tree, settings, re) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  has({ id: ID, P: { STEP: 13860 } }, x, /reaches only/);
  has({ id: ID, P: { FEEDN: 400 } }, recipeSettings('94nop'), /counted passes/);   // 289 safe passes on 8,000 cells, less a margin of 410
  has({ id: ID, P: { BDIST: 30000 } }, recipeSettings('94nop'), /on the warrior itself/);
  has({ id: ID }, recipeSettings('88'), /needs ICWS'94/);
  // Five lockstep entrants share the feeder's counter: all but one feed for ever. The watch counts them.
  assert.throws(() => buildTree({ id: 'fanboot', P: { N: 6, SPLIT: 1, HOPA: 20000, HOPB: 31000 }, kids: [{ id: ID }, { id: 'dual-imp-pump' }] }, { rules: '94x', length: 100 }), /entered by more than one process/);
});

// Directly: FEEDN + 1 processes, COUNT passes, then the loop's first line becomes a jump and every
// process is in the clear; the stone's own blank never reaches the remote bomb (the counter ends it).
test('remote-feed-stone feeds its loop, counts its passes and hands every process to the clear', () => {
  const settings = treeSettings('94x', 100), core = settings.coreSize;
  const r = link({ id: ID, P: leaves[ID].defaults }, settings), w = compile(r.source, 'redcode', settings);
  const at = (l) => r.labels['b0' + l];
  const count = w.instructions[at('rbTime')].b, R = mod(at('rbWatch') + w.instructions[at('rbWatch')].b, core);
  const vm = new VM(settings); vm.load([w], { positions: [0] });
  let adds = 0, peak = 0;
  while (vm.peek(at('rbLoop')).op === 'ADD' && vm.cycle < 400000) {
    if (vm.processes(0)[0] === at('rbLoop')) adds++;
    vm.step();
    peak = Math.max(peak, vm.processes(0).length);
  }
  assert.equal(vm.peek(at('rbLoop')).op, 'JMP', 'the counter turned the loop into a jump');
  assert.equal(peak, leaves[ID].defaults.FEEDN + 1);
  assert.ok(adds >= count && adds <= count + peak, `${adds} passes for a count of ${count}`);
  assert.notEqual(vm.peek(R).b, 0, 'the blank never reached the remote bomb');
  vm.run(5000);
  assert.ok(vm.processes(0).every((q) => q === at('rbCm') || q === at('rbCd')), 'every process is in the clear');
});

test('remote-feed-stone: destroying the remote bomb sends the processes to the clear', () => {
  const settings = treeSettings('94x', 100), core = settings.coreSize;
  const r = link({ id: ID, P: leaves[ID].defaults }, settings), w = compile(r.source, 'redcode', settings);
  const at = (l) => r.labels['b0' + l];
  const R = mod(at('rbWatch') + w.instructions[at('rbWatch')].b, core);
  const vm = new VM(settings); vm.load([w], { positions: [0] });
  vm.run(3000);
  vm.poke(R, { op: 'DAT', mod: 'F', aMode: '$', a: 0, bMode: '$', b: 0 });
  vm.run(2000);
  const procs = vm.processes(0);
  assert.ok(procs.filter((q) => q === at('rbCm') || q === at('rbCd')).length >= procs.length - 2, 'all but processes still in flight are in the clear');
  assert.equal(vm.peek(at('rbLoop')).op, 'ADD', 'it was the airbag, not the counter');
});
