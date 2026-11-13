// gated-dclear (tools/algebra/blocks/gated-dclear.js): the bounded d-clear with
// a decrement gate that runs beside a stone copy and an imp pump copy, and the
// Son-of-Vain-shaped tree it was written for.
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
// Stone at +3000, pump at +4400, clear at +7000: its span (the 1500 cells below its gate) holds neither copy.
const three = (P = {}, clear = {}) => ({ id: 'fanboot3', P: { N: 4, MOREA: 1, HOPA: 3000, HOPB: 7000, HOPC: 4400, ...P },
  kids: [{ id: 'mod-stone' }, { id: 'gated-dclear', P: clear }, { id: 'compact-imp-pump' }] });

test('gated-dclear passes the gate alone on 94nop and 94x, booted, and beside a stone', () => {
  assert.equal(ok('94nop', { id: 'gated-dclear' }).total, 6);
  ok('94x', { id: 'gated-dclear' });
  ok('94nop', { id: 'gated-dclear', P: { GATE: 9, FIRST: 40, SPAN: 600 } });
  ok('94nop', { id: 'boot', P: { HOP: 3000 }, kids: [{ id: 'gated-dclear' }] });
  ok('94nop', { id: 'fanboot', P: { N: 4, SPLIT: 1, HOPA: 3000, HOPB: 6000 }, kids: [{ id: 'mod-stone' }, { id: 'gated-dclear' }] });
});

test('the three-body launch (stone + gated d-clear + imp pump) passes the gate: 4 / 1 / 1, behind a quickscan, at 100 (full) and at 50', () => {
  ok('94nop', three());
  const scan = (UNITS) => ({ id: 'opening-qscan-mul', P: { UNITS, SHARE: 1 } });
  const big = ok('94nop', { id: 'seq', kids: [scan(10), { id: 'probe-burst2' }, three()] }, { verification: 'full' });
  assert.equal(big.verification.profile, 'full');
  assert.ok(big.total <= 100, `${big.total}`);
  const small = ok('94nop', { id: 'seq', kids: [scan(3), three()] }, { length: 50 });
  assert.ok(small.total <= 50, `${small.total}`);
});

// Runs the block alone; `poke` is [cycle, instruction, between] for the gate. `below(c)` is how far cell c lies below the gate.
function alone(P, cycles, poke) {
  const built = buildTree({ id: 'gated-dclear', P }, { rules: '94nop', length: 100 }), home = built.labels[built.root.ns + 'gdGo'];
  const w = compile(built.source, 'redcode', s94), vm = new VM(s94);
  vm.load([w], { positions: [1000] });
  const gate = 1000 + home - (P.GATE ?? 4);
  let poked = !poke;
  while (vm.cycle < cycles && !vm.done) {
    // `between: true` pokes between two passes (the next instruction is the check); otherwise at that cycle, wherever the pass is.
    if (!poked && vm.cycle >= poke[0] && (!poke[2] || vm.processes(0)[0] === 1000 + home)) { vm.poke(gate, poke[1]); poked = true; }
    vm.step();
  }
  const ins = (x) => [x.op, x.mod, x.aMode, (x.a + 8000) % 8000, x.bMode, (x.b + 8000) % 8000];
  const whole = () => Array.from({ length: 6 }, (_, k) => k).every((k) => JSON.stringify(ins(vm.peek(1000 + home + k))) === JSON.stringify(ins(w.instructions[home + k])));
  return { vm, gate, home: 1000 + home, whole, below: (c) => (gate - c + 8000) % 8000 };
}
// The default span with SPAN 400: the cells 2 .. 401 below the gate.
const inSpan = (k) => k >= 2 && k <= 401;

test('alone it sweeps exactly its span, downward, again and again, and its gate counts down', () => {
  const { vm, gate, home, below } = alone({ SPAN: 400 }, 4000);
  for (let c = 0; c < 8000; c++) assert.equal(vm.writeCycle[c] > 0, below(c) === 0 || inSpan(below(c)), `cell ${below(c)} below the gate`);
  // DATs and decremented cells alternate, the DAT first.
  assert.equal(vm.peek(gate - 2).a, 2667);
  assert.notEqual(vm.peek(gate - 3).a, 2667);
  assert.ok(vm.writeCycle[gate - 20] > 1700, 'the span was swept more than once');
  const a = vm.peek(gate).a; for (let i = 0; i < 4; i++) vm.step();
  assert.equal((a - vm.peek(gate).a + 8000) % 8000, 1);            // one pass: the gate's A-field lost one
  assert.equal(vm.processes(0).length, 1);
  assert.ok(vm.processes(0)[0] >= home && vm.processes(0)[0] < home + 6);
});

test('an imp instruction on the gate is changed and the pointer is put back inside the span', () => {
  const imp = { op: 'MOV', mod: 'I', aMode: '$', a: 0, bMode: '$', b: 2667 };
  const { vm, gate, below, whole } = alone({ SPAN: 400 }, 1000, [501, imp]);
  const g = vm.peek(gate);
  assert.notDeepEqual([g.op, g.a, g.b], ['MOV', 0, 2667]);
  assert.ok(g.b >= 8000 - 402 && g.b <= 7999, `pointer ${g.b}`);
  // At most the two cells of the pass the hit interrupted lie outside the span.
  let outside = 0;
  for (let c = 0; c < 8000; c++) if (vm.writeCycle[c] > 0 && below(c) !== 0 && !inSpan(below(c))) outside++;
  assert.ok(outside <= 2, `${outside} cells`);
  assert.equal(whole(), true);
});

test('a pointer knocked onto the block itself between passes is put back: it never sweeps its own code', () => {
  // Every pointer value that would aim a write at the six cells of the block or just around them.
  for (let b = 1; b <= 16; b++) {
    const { vm, home, whole, below } = alone({ SPAN: 400 }, 900, [502, { op: 'DAT', mod: 'F', aMode: '#', a: 5, bMode: '#', b }, true]);
    assert.equal(whole(), true, `pointer ${b}`);
    assert.equal(vm.processes(0).length, 1, `pointer ${b}`);
    assert.ok(vm.processes(0)[0] >= home && vm.processes(0)[0] < home + 6);
    let outside = 0;
    for (let c = 0; c < 8000; c++) if (vm.writeCycle[c] > 0 && below(c) !== 0 && !inSpan(below(c))) outside++;
    assert.ok(outside <= 2, `pointer ${b}: ${outside} cells outside`);
  }
});

test('settings and layouts that cannot work are refused', () => {
  const has = (tree, re, rules = '94nop') => {
    const m = treeMismatches(tree, recipeSettings(rules, 100));
    assert.ok(m.some((x) => re.test(x)), JSON.stringify(m));
  };
  has({ id: 'gated-dclear' }, /needs ICWS'94/, '88');
  has({ id: 'gated-dclear', P: { SPAN: 401 } }, /SPAN must be even/);
  has({ id: 'gated-dclear', P: { SPAN: 7990 } }, /round the core/);
  const refused = (tree, re) => assert.throws(() => buildTree(tree, { rules: '94nop', length: 100 }), re);
  // In place it must come first: its gate is the cell below it.
  refused({ id: 'par', kids: [{ id: 'mod-stone' }, { id: 'gated-dclear' }] }, /gate cell would lie on the warrior/);
  // A partner's copy inside the span, and a partner that writes on the gate.
  refused(three({ HOPC: 6000 }), /gated-dclear writes on cell \d of compact-imp-pump's copy/);
  refused(three({ HOPA: 6400 }), /gated-dclear writes on cell \d of mod-stone's copy/);
  refused({ id: 'fanboot', P: { N: 4, SPLIT: 1, HOPA: 3000, HOPB: 6002 }, kids: [{ id: 'run-stone' }, { id: 'gated-dclear', P: { GATE: 2 } }] }, /run-stone writes on a cell gated-dclear keeps outside its copy/);
  // A paper's later copies land everywhere, so also in the span.
  refused({ id: 'fanboot', P: { N: 6, SPLIT: 1, MOREA: 1, HOPA: 3000, HOPB: 6000 }, kids: [{ id: 'loop-paper6', P: { FAN: 0 } }, { id: 'gated-dclear' }] }, /loop-paper6's later copies land on cells gated-dclear writes/);
  // More than one entrant: it is a one-process clear.
  refused({ id: 'fanboot', P: { N: 4, SPLIT: 0, K: 1, HOPA: 3000, HOPB: 6000 }, kids: [{ id: 'mod-stone' }, { id: 'gated-dclear' }] }, /more than one process entered/);
});
