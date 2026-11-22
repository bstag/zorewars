import assert from 'node:assert/strict';
import test from 'node:test';
import { VM } from '../src/engine/index.js';
import { buildTree } from '../tools/algebra/index.js';

// Blocks from tools/algebra/blocks/top10-lp.js (the LP hill's top 10, docs/hill-top10/lp.md).
const M = { $: 0, '#': 1, '@': 2, '*': 3, '<': 4, '>': 5, '{': 6, '}': 7 };
const hippogriff = { COUNT: 28, FIRST: 28, ENTRY: 1, ORDER: 1, ATTACK: 1, READ: 5096, WRITE: 2407, RM: M['}'], WM: M.$, CHECK: 0, HA: 1, HM: M['}'], RESTART: 2407, HOP: 7569, TRANSFER: 1 };
const bronze = { COUNT: 20, FIRST: 7, ENTRY: 1, ORDER: 0, ATTACK: 0, READ: 1171, WRITE: 826, RM: M['{'], WM: M['{'], DOUBLE: 0, CHECK: 0, HA: 0, HM: M['>'], RESTART: 2903, HOP: 5741, TRANSFER: 0 };
const body = (built) => built.source.split('\n').filter((l) => l && !l.startsWith(';') && !/^(ORG|END)/.test(l.trim()));
const run = (built, cycles) => {
  const vm = new VM(built.settings);
  vm.load([built.w], { positions: [0] });
  while (!vm.done && vm.cycle < cycles) vm.step();
  return vm;
};

test('the rain paper builds the three published lap orders and passes the gate on both LP profiles', () => {
  for (const rules of ['lp', 'lp-hill']) {
    for (const P of [{}, hippogriff, bronze]) {
      const built = buildTree({ id: 'lp-rain-paper', P }, { rules, verification: 'full' });
      assert.equal(built.total, 7);
      assert.equal(built.verification.ok, true);
    }
  }
  // Digital Rain's order: attack, step, copy; Hippogriff's walk adds the restart's fields.
  const rain = body(buildTree({ id: 'lp-rain-paper' }, { rules: 'lp' }));
  assert.match(rain[1], /MOV\.I \{2638, \{2649/);
  assert.match(rain[2], /ADD\.F \{0, \}0/);
  assert.match(rain[6], /JMZ\.B \$1971, \*0/);
  const walk = body(buildTree({ id: 'lp-rain-paper', P: hippogriff }, { rules: 'lp' }));
  assert.match(walk[2], /ADD\.F \w+home, \w+attack/);
  assert.match(walk[6], /JMZ\.B @7569, \*0/);
  // Bronze minotaur's order copies first.
  assert.match(body(buildTree({ id: 'lp-rain-paper', P: bronze }, { rules: 'lp' }))[1], /MOV\.I <\w+seed, \{\w+hop/);
});

test('the rain paper reaches eight processes alone and refuses broken settings', () => {
  const built = buildTree({ id: 'lp-rain-paper' }, { rules: 'lp' });
  let most = 0;
  const vm = new VM(built.settings);
  vm.load([built.w], { positions: [0] });
  while (vm.cycle < 20000) { vm.step(); most = Math.max(most, vm.processes(0).length); }
  assert.equal(most, 8);
  assert.throws(() => buildTree({ id: 'lp-rain-paper', P: { ATTACK: 1, WM: M['{'] } }, { rules: 'lp' }), /walking attack/);
  assert.throws(() => buildTree({ id: 'lp-rain-paper', P: { HOP: 7995 } }, { rules: 'lp' }), /first copy lands on itself/);
  assert.throws(() => buildTree({ id: 'lp-rain-paper', P: { HOP: 9000 } }, { rules: 'lp' }), /smaller than the core/);
});

test('the quiet paper and the quad stone run 1 + 4 processes side by side in both published styles', () => {
  const fear = { id: 'par', kids: [
    { id: 'lp-quiet-paper', P: { STYLE: 0, COUNT: 20, FIRST: 20, DEC: 3997, HOP: 5849 } },
    { id: 'lp-quad-stone', P: { STYLE: 0, S: 6742, HOP: 2143 } },
  ] };
  const distortion = { id: 'par', kids: [
    { id: 'lp-quiet-paper', P: { STYLE: 1, COUNT: 38, FIRST: 5, DEC: 2746, HOP: 5919 } },
    { id: 'lp-quad-stone', P: { STYLE: 1, ASTEP: 35, BSTEP: 44, AOFS: -2, BOFS: -1, GATE: -6, HOP: 4885 } },
  ] };
  for (const [tree, size] of [[fear, 15], [distortion, 16]]) {
    for (const rules of ['lp', 'lp-hill']) {
      const built = buildTree(tree, { rules, verification: 'full' });
      assert.equal(built.total, size);
      assert.equal(built.verification.ok, true);
    }
  }
  // Four processes run in the stone copy once the boot is done, one in the paper.
  const built = buildTree(fear, { rules: 'lp' });
  const vm = run(built, 40);
  const s0 = body(built).findIndex((l) => /^\w*s0 /.test(l));
  const stone = (s0 + 2143) % 8000;
  assert.equal(vm.processes(0).filter((pc) => pc >= stone && pc < stone + 4).length, 4);
  assert.equal(vm.processes(0).length, 5);
  // Alone, both published stones end by bombing their own lines (the paper beside them lives on).
  assert.throws(() => buildTree({ id: 'lp-quad-stone' }, { rules: 'lp' }), /did not survive alone/);
  assert.throws(() => buildTree({ id: 'lp-quad-stone', P: { S: 6741 } }, { rules: 'lp' }), /odd S/);
  assert.throws(() => buildTree({ id: 'lp-quad-stone', P: { STYLE: 1, AOFS: 0 } }, { rules: 'lp' }), /zero field/);
});

test('the destroyer stone traps one residue mod 4, keeps its clear bomb, then clears', () => {
  const built = buildTree({ id: 'lp-destroyer-stone' }, { rules: 'lp', verification: 'full' });
  assert.equal(built.total, 31);
  const vm = run(built, 80000);
  assert.equal(vm.warriors[0].alive, true);
  // The clear's bomb is still a DAT with the pointer reset (the blank after it took the lap-823 hit).
  assert.equal(vm.peek(1).op, 'DAT');
  assert.throws(() => buildTree({ id: 'lp-destroyer-stone', P: { STEP: 66 } }, { rules: 'lp' }), /multiple of 4/);
  // Under the LP Destroyer's brain beside Replinator's paper (P-space rules only).
  const paper = { id: 'lp-rain-paper', P: { COUNT: 21, READ: 548, WRITE: 109, RESTART: 7293, HOP: 6667 } };
  const sw = buildTree({ id: 'switch-table', P: { FIRST: 1, LOSS: 0x5518, WIN: 0x8855, TIE: 0x1151, PACKED: 1 }, kids: [{ id: 'lp-destroyer-stone' }, paper] },
    { rules: 'lp-hill', length: 200, verification: 'full' });
  assert.equal(sw.verification.ok, true);
});

test('the gate dwarf needs its spawner to live alone and converts when its bomb reaches its loop', () => {
  for (const rules of ['lp', 'lp-hill']) {
    assert.equal(buildTree({ id: 'lp-gate-dwarf' }, { rules, verification: 'full' }).total, 10);
    assert.equal(buildTree({ id: 'boot', P: { HOP: 5421 }, kids: [{ id: 'lp-gate-dwarf' }] }, { rules, verification: 'full' }).verification.ok, true);
  }
  assert.throws(() => buildTree({ id: 'lp-gate-dwarf', P: { ROUTE: 0 } }, { rules: 'lp' }), /dies alone/);
  assert.throws(() => buildTree({ id: 'lp-gate-dwarf', P: { TIME: 1680 } }, { rules: 'lp' }), /reaches its own code before its time/);
});

test('the void quartet deploys four scanners that cannot see one another', () => {
  const built = buildTree({ id: 'lp-void-quartet' }, { rules: 'lp-hill', length: 200, verification: 'full' });
  assert.equal(built.total, 200);
  assert.equal(built.verification.ok, true);
  const vm = run(built, 400);
  assert.equal(vm.processes(0).length, 4);
  // Every scanner cell but the JMZ.A has A = 0 at its four sites.
  for (const hop of [2000, 5961, 2156, 6117]) {
    const a = [0, 1, 2, 3, 4, 5].map((i) => vm.peek((hop + i) % 8000).a);
    assert.deepEqual(a.map((x, i) => (i === 1 ? x !== 0 : x === 0)), [true, true, true, true, true, true]);
  }
  const compact = buildTree({ id: 'lp-void-quartet', P: { GAP: 10 } }, { rules: 'lp', verification: 'full' });
  assert.equal(compact.total, 54);
  assert.throws(() => buildTree({ id: 'lp-void-quartet', P: { SHIFT: 3960 } }, { rules: 'lp' }), /SHIFT must be odd/);
  assert.throws(() => buildTree({ id: 'lp-void-quartet', P: { STEP: 77 } }, { rules: 'lp' }), /STEP must be even/);
});
