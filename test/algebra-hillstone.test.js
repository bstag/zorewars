import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, VM } from '../src/engine/index.js';
import { recipeSettings } from '../tools/blocks/recipes.js';
import { buildTree, treeMismatches, leaves } from '../tools/algebra/index.js';

const ALL = ['88', '94nop', 'lp', '94x'];
const NO88 = ['94nop', 'lp', '94x'];                 // scan-vampire is '94 only
const CHEAP = ['88', '94nop', 'lp'];                  // 8,000-cell cores; skip the slow 94x run

const passes = (tree, rules) => {
  const built = buildTree(tree, { rules });
  assert.equal(built.verification.ok, true, `${rules} ${JSON.stringify(tree)}`);
  assert.equal(built.verification.shape, 'generic', `${rules} ${JSON.stringify(tree)}`);
  return built;
};
const spiral = (rules) => (rules === 'lp' ? { id: 'spiral', P: { SN: 3, SK: 2 } } : { id: 'spiral', P: { SN: 13, SK: 4 } });

test('the four blocks load with their declared kinds and loops', () => {
  for (const id of ['elf', 'finisher-multi', 'hill-stone', 'scan-vampire']) {
    assert.ok(leaves[id], id);
    assert.ok(leaves[id].loop, `${id} has a loop`);
  }
  assert.equal(leaves['elf'].kind, 'body');
  assert.equal(leaves['finisher-multi'].kind, 'finisher');
  assert.equal(leaves['hill-stone'].kind, 'body');
  assert.equal(leaves['scan-vampire'].kind, 'body');
});

test('elf: an SPL-fed DJN stream of several processes, alone and beside a spiral', () => {
  for (const rules of ALL) {
    passes({ id: 'elf' }, rules);
    passes({ id: 'elf', P: { PROCS: 2, UNROLL: 1 } }, rules);
    passes({ id: 'par', kids: [{ id: 'elf', P: { PROCS: 3 } }, spiral(rules)] }, rules);
  }
  passes({ id: 'elf', P: { PROCS: 8, UNROLL: 8 } }, '94x');
  // Broken: more processes than the LP hill allows.
  assert.throws(() => buildTree({ id: 'elf', P: { PROCS: 9 } }, { rules: 'lp' }), /this hill allows 8/);
});

test('finisher-multi: a two-pass clear of several processes, alone and behind a bombing opening', () => {
  for (const rules of ALL) {
    passes({ id: 'finisher-multi' }, rules);
    passes({ id: 'finisher-multi', P: { PROCS: 2 } }, rules);
    passes({ id: 'seq', kids: [{ id: 'opening-bomber' }, { id: 'finisher-multi' }] }, rules);
  }
  // It provides both bomb cells, so a stunning opening (needs splBomb) fits in front of it.
  assert.deepEqual(treeMismatches({ id: 'seq', kids: [{ id: 'opening-bscan' }, { id: 'finisher-multi' }] }, recipeSettings('94nop')), []);
  // Broken: a clear erases its partners, so it may not stand in a par.
  assert.throws(() => buildTree({ id: 'par', kids: [{ id: 'finisher-multi' }, { id: 'mod-stone' }] }, { rules: '94nop' }), /clear|runs alone|forever/);
});

test('finisher-multi survives a bomb that kills one of its processes', () => {
  // The gate runs the block with a DAT poked onto one killer's loop at cycle
  // 3000 (the block's `plant`); the others keep clearing. Confirm here directly.
  const settings = recipeSettings('94nop');
  const built = buildTree({ id: 'finisher-multi', P: { PROCS: 3 } }, { rules: '94nop' });
  const vm = new VM(settings);
  vm.load([built.w], { positions: [0] });
  const k1 = built.labels[built.root.ns + 'k1'];
  let peakAfter = 0;
  for (let i = 0; i < 6000 && !vm.done; i++) {
    if (vm.cycle === 3000) vm.poke(k1, { op: 'DAT', mod: 'F', aMode: '#', a: 0, bMode: '#', b: 0 });
    vm.step();
    if (vm.cycle > 3200) peakAfter = Math.max(peakAfter, vm.processes(0).length);
  }
  assert.ok(vm.warriors[0].alive, 'the clear survived the bomb');
  assert.ok(peakAfter >= 1 && peakAfter < 3, `one process was lost but the clear went on (${peakAfter} left)`);
});

test('hill-stone: several processes in one bombing loop, with its options, alone and in combinations', () => {
  for (const rules of ALL) {
    passes({ id: 'hill-stone' }, rules);                                   // PROCS processes, two pointers, two writes
    passes({ id: 'hill-stone', P: { PROCS: 1 } }, rules);
    passes({ id: 'hill-stone', P: { STREAM: 1 } }, rules);                 // folded DJN stream
    passes({ id: 'hill-stone', P: { REMOTE: 1 } }, rules);                 // remote bomb cell
    passes({ id: 'hill-stone', P: { ENDCLEAR: 1, PASSES: 200 } }, rules);  // turns into a core clear
  }
  for (const rules of NO88) passes({ id: 'hill-stone', P: { WRITES: 3 } }, rules);   // three writes (A-field: '94)
  passes({ id: 'hill-stone', P: { WRITES: 3, STREAM: 1, REMOTE: 1, ENDCLEAR: 1, PASSES: 200 } }, '94x');
  // Combinations: beside a spiral, and handing over to a stone on a timer.
  for (const rules of CHEAP) {
    passes({ id: 'par', kids: [{ id: 'hill-stone', P: { PROCS: 3 } }, spiral(rules)] }, rules);
    passes({ id: 'trigger', kids: [{ id: 'hill-stone', P: { PROCS: 3 } }, { id: 'mod-stone' }] }, rules);
  }
  // Broken: a step whose gcd with the core is too small to keep the bomb classes off the warrior.
  assert.throws(() => buildTree({ id: 'hill-stone', P: { STEP: 3 } }, { rules: '94nop' }), /too small|reaches only/);
  // Broken: three writes need '94 (A-field indirection).
  assert.throws(() => buildTree({ id: 'hill-stone', P: { WRITES: 3 } }, { rules: '88' }), /ICWS'94/);
});

test('scan-vampire: fangs occupied cells and aims them at its pit', () => {
  for (const rules of NO88) {
    passes({ id: 'scan-vampire' }, rules);
    passes({ id: 'scan-vampire', P: { COUNT: 1 } }, rules);                 // gathering pit
    passes({ id: 'par', kids: [{ id: 'scan-vampire' }, spiral(rules)] }, rules);
  }
  // Broken: it needs ICWS'94 (JMZ.F).
  assert.throws(() => buildTree({ id: 'scan-vampire' }, { rules: '88' }), /ICWS'94/);
});

test('a planted occupied cell gets a JMP fang that leads to the pit', () => {
  // Build alone, plant an occupied cell on the scan path, run, and read the fang.
  const settings = recipeSettings('94nop');
  const built = buildTree({ id: 'scan-vampire' }, { rules: '94nop' });
  const ns = built.root.ns, L = (n) => built.labels[ns + n];
  const norm = (x) => ((x % settings.coreSize) + settings.coreSize) % settings.coreSize;
  const ptr = L('svPtr'), pit = L('svPit'), step = built.root.P.STEP;
  // The third cell the scan looks at that is clear of the image.
  let target = null, found = 0;
  for (let k = 1; k < 2000 && target === null; k++) {
    const c = norm(ptr + built.w.instructions[ptr].b + k * step);
    if ((c >= built.total) && (norm(c + 1) >= built.total) && ++found === 3) target = c;
  }
  assert.ok(target !== null, 'found a scan target outside the image');
  const vm = new VM(settings);
  vm.load([built.w], { positions: [0] });
  vm.poke(target, { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 });
  for (let i = 0; i < 40000 && !vm.done; i++) {
    vm.step();
    const cell = vm.peek(target);
    if (cell.op === 'JMP') { assert.equal(norm(target + cell.a), pit, 'the fang points at the pit'); return; }
  }
  assert.fail('the planted cell never got a fang');
});
