// The fanboot combinator (N processes copy two members in lockstep and their copy
// pointers become the jump vectors) and boot's WIPE option (docs/hill-recipe-book.md,
// gaps #3 and #10).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, treeMismatches } from '../tools/algebra/index.js';
import { fanLines } from '../tools/algebra/link.js';
import { recipeSettings } from '../tools/blocks/recipes.js';
import { compile, VM } from '../src/engine/index.js';

const fb = (a, b, P = {}) => ({ id: 'fanboot', P, kids: [a, b] });
const s94 = recipeSettings('94nop', 100);

test('fanLines makes 2, 3, 4, 6, 8, 12 and 16 processes and refuses the rest', () => {
  for (const n of [2, 3, 4, 6, 8, 12, 16]) {
    const lines = fanLines(n);
    // Simulate the fan: each SPL d sends a process on and a new one d lines further.
    let q = [0];
    while (q.some((x) => x < lines.length)) q = q.flatMap((x) => (x < lines.length ? [x + 1, x + Number(lines[x])] : [x]));
    assert.ok(q.every((x) => x === lines.length) && q.length === n, `${n}: ${q}`);
  }
  for (const n of [5, 7, 9, 10]) assert.equal(fanLines(n), null);
});

test('fanboot passes the gate on 94nop and 94x, alone and behind a quickscan', () => {
  for (const rules of ['94nop', '94x']) {
    for (const tree of [fb({ id: 'mod-stone' }, { id: 'silk-imps' }), fb({ id: 'mod-stone' }, { id: 'vector-spiral' }, { SPLIT: 1 }),
      { id: 'seq', kids: [{ id: 'opening-qscan-mul' }, fb({ id: 'mod-stone' }, { id: 'paper' })] }]) {
      assert.equal(buildTree(tree, { rules, length: 100 }).verification.ok, true, `${rules} ${JSON.stringify(tree)}`);
    }
  }
});

// Run until the boot is over (no process left in its code) and count who went where;
// each copy is compared with its original when the first process arrives in it.
function launch(P) {
  const built = buildTree(fb({ id: 'mod-stone' }, { id: 'mod-stone' }, P), { rules: '94nop', length: 100 });
  const w = compile(built.source, 'redcode', s94);
  const vm = new VM(s94); vm.load([w], { positions: [0] });
  const spans = built.root.kids.map((k) => built.spans[k.ns]), hops = [P.HOPA ?? 2000, P.HOPB ?? 5000];
  const bootEnd = spans[0].start - (built.root.fan.tramp[0] ? 1 : 0);
  const inCopy = (q, i) => q >= spans[i].start + hops[i] && q < spans[i].start + hops[i] + spans[i].size;
  const same = (i) => Array.from({ length: spans[i].size }, (_, k) => JSON.stringify(vm.peek(spans[i].start + hops[i] + k)) === JSON.stringify(vm.peek(spans[i].start + k))).every(Boolean);
  const intact = [null, null];
  let n = 0;
  while (vm.processes(0).some((q) => q < bootEnd) && n++ < 500) {
    for (const i of [0, 1]) if (intact[i] === null && vm.processes(0).some((q) => inCopy(q, i))) intact[i] = same(i);
    vm.step();
  }
  for (const i of [0, 1]) if (intact[i] === null && vm.processes(0).some((q) => inCopy(q, i))) intact[i] = same(i);   // the last arrival
  const count = (i) => vm.processes(0).filter((q) => inCopy(q, i)).length;
  return { toA: count(0), toB: count(1), intactA: intact[0], intactB: intact[1] };
}

test('fanboot splits K*N : N, or N-1 : 1 with a counter, and both copies are whole', () => {
  const k = launch({ N: 8, K: 2, SPLIT: 0 });
  assert.deepEqual([k.toA, k.toB, k.intactA, k.intactB], [16, 8, true, true]);
  const c = launch({ N: 6, SPLIT: 1 });
  assert.deepEqual([c.toA, c.toB, c.intactA, c.intactB], [5, 1, true, true]);
});

test('fanboot refuses what it cannot boot', () => {
  const has = (tree, re, settings = s94) => assert.ok(treeMismatches(tree, settings).some((m) => re.test(m)), JSON.stringify(treeMismatches(tree, settings)));
  has(fb({ id: 'mod-stone' }, { id: 'paper' }, { N: 5 }), /N must be/);
  has(fb({ id: 'mod-stone' }, { id: 'paper' }, { HOPA: 3000, HOPB: 3100 }), /land on each other/);
  has(fb({ id: 'mod-stone' }, { id: 'opening-qscan-mul' }), /must run forever/);
  has(fb({ id: 'mod-stone' }, { id: 'paper' }), /ICWS'94/, recipeSettings('88', 100));
  has(fb({ id: 'mod-stone' }, { id: 'boot', kids: [{ id: 'paper' }] }), /one relocation/);
});

test('boot WIPE erases the launch and the destination pointer, on every rule set', () => {
  for (const rules of ['94nop', '88', 'lp', '94x']) {
    const settings = recipeSettings(rules, 100);
    const built = buildTree({ id: 'boot', P: { HOP: rules === '94x' ? 20000 : 3000, WIPE: 1 }, kids: [{ id: 'mod-stone' }] }, { rules, length: 100 });
    assert.equal(built.verification.ok, true, rules);
    const w = compile(built.source, 'redcode', settings);
    const vm = new VM(settings); vm.load([w], { positions: [0] });
    for (let i = 0; i < 200; i++) vm.step();
    const ns = built.root.ns;
    for (const l of ['go', 'copyTo']) {
      const c = vm.peek(built.labels[ns + l]);
      assert.deepEqual([c.op, c.a, c.b], ['DAT', 0, 0], `${rules} ${l}`);
    }
    assert.equal(vm.processes(0).length, 1, rules);
  }
});

// Gap #4: the MUL quickscan's table in the fan lines' free B-fields.
test('a shared quickscan table lives in the fan lines and still decodes every unit', () => {
  const tree = (SHARE, fanP = {}) => ({ id: 'seq', kids: [{ id: 'opening-qscan-mul', P: { SHARE } }, fb({ id: 'mod-stone' }, { id: 'silk-imps' }, fanP)] });
  const plain = buildTree(tree(0), { rules: '94nop', length: 100 }), shared = buildTree(tree(1), { rules: '94nop', length: 100 });
  assert.equal(shared.verification.ok, true);
  assert.equal(plain.total - shared.total, 3);                    // one three of the table moved into the 3 fan lines
  const q = shared.root.kids[0], f = shared.root.kids[1], at = (l) => shared.labels[q.ns + l];
  assert.deepEqual([...q.claimed], [0]);
  for (let k = 0; k < 3; k++) assert.equal(at(`t${k}`), shared.labels[f.ns + 'start'] + k);   // t0..t2 are the fan lines
  const w = compile(shared.source, 'redcode', s94), { QFAC, GAP, UNITS } = q.P;
  for (let k = 0; k < UNITS; k++) {
    const want = ((at(`t${k}`) - at('probe')) * (1 + QFAC) + GAP) % 8000;
    const vm = new VM(s94); vm.load([w], { positions: [0] });
    vm.poke(at('probe') + want, { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 7 });
    while (vm.processes(0)[0] !== shared.labels[f.ns + 'start'] && vm.cycle < 200) vm.step();
    assert.equal(vm.peek(at('probe')).b, want, `unit ${k}`);
  }
  // Where the placed table puts a probe on the warrior itself, the build is refused after linking.
  assert.throws(() => buildTree({ id: 'seq', kids: [{ id: 'opening-qscan-mul', P: { SHARE: 1 } }, { id: 'probe-burst2' }, fb({ id: 'mod-stone' }, { id: 'silk-imps' }, { K: 4 })] }, { rules: '94nop', length: 100 }), /lands on or next to the warrior/);
});

test('evolution can turn a par into a fanboot and give an opening a fork', async () => {
  const { mutate, shape } = await import('../tools/algebra/genome.js');
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const par = { id: 'seq', kids: [{ id: 'opening-qscan-mul' }, { id: 'par', kids: [{ id: 'mod-stone' }, { id: 'silk-imps' }] }] };
  const fanned = mutate(par, s94, random, 60, ['fan']);
  assert.equal(shape(fanned.tree), 'seq(opening-qscan-mul,fanboot(mod-stone,silk-imps))');
  assert.equal(shape(mutate(fanned.tree, s94, random, 60, ['fan']).tree), shape(par));
  const forked = mutate({ id: 'seq', kids: [{ id: 'opening-qscan-mul' }, { id: 'silk-imps' }] }, s94, random, 60, ['fork']);
  assert.match(shape(forked.tree), /^fork\(opening-qscan-mul,/);
});
