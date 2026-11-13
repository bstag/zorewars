import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTree, gate } from '../tools/algebra/index.js';
import { entryOf } from '../tools/algebra/link.js';
import { scoreChoice, scoreCells, scoreBias } from '../tools/algebra/switch-score.js';
import { VM, compile } from '../src/engine/index.js';

const lp = (P = {}) => ({ id: 'switch-score', P, kids: [{ id: 'lp-selfhit-scanner' }, { id: 'lp-step-paper' }, { id: 'lp-imp-bomber' }] });
const build = (tree, rules = 'lp-hill') => buildTree(tree, { rules, length: 200 });

// Run the dispatch once from a P-space and report which member it entered.
function dispatch(built, pspace) {
  const entries = built.root.kids.map((k) => built.labels[entryOf(k)]);
  const vm = new VM(built.settings);
  vm.load([built.w], { positions: [0], pspaces: [pspace] });
  for (let step = 0; step < 200; step++) {
    const at = entries.indexOf(vm.processes(0)[0]);
    if (at >= 0) return at;
    vm.step();
  }
  throw new Error('the dispatch never reached a member');
}

test('switch-score builds on P-space rule sets and refuses the rest', () => {
  for (const P of [{}, { STREAK: 3, HOLD: 1, WIN: 2, LOSS: -2 }]) assert.ok(build(lp(P)).w.ok);
  assert.ok(build({ id: 'switch-score', P: { CELL: 100 }, kids: [{ id: 'stone' }, { id: 'stone', P: { TSTEP: 8 } }] }, '94x-hill').w.ok);
  assert.throws(() => buildTree(lp(), { rules: 'lp' }), /needs P-space/);
  assert.throws(() => build(lp({ FIRST: 3 })), /FIRST selects a missing member/);
  assert.throws(() => build(lp({ CELL: 497 })), /exceed the P-space size/);
});

test('switch-score follows its model over a match of persistent rounds', () => {
  for (const P of [{}, { STREAK: 2, HOLD: 1, WIN: 2, TIE: 0, LOSS: -1 }]) {
    const built = build(lp(P)), n = 3, core = built.settings.coreSize;
    const full = { ...built.root.P }, cells = scoreCells(full, n);
    const pspace = VM.freshPSpace(built.settings);
    const results = [-1, 0, 0, 1, 2, 2, 2, 0, 1, 1, 0, 0, 0, 2, 3];
    const played = [];
    for (const result of results) {
      pspace[0] = ((result % core) + core) % core;
      const want = scoreChoice(full, n, pspace, core);
      assert.equal(dispatch(built, pspace), want.branch);
      for (const [cell, value] of want.writes) assert.equal(pspace[cell], value, `cell ${cell} after result ${result}`);
      played.push(want.branch);
    }
    assert.equal(pspace[cells.sentinel], full.SENT);
    assert.ok(new Set(played).size >= 2, 'losses moved it to another member');
  }
});

test('a broken sentinel resets every score and plays FIRST', () => {
  const built = build(lp({ FIRST: 2 })), core = built.settings.coreSize, cells = scoreCells(built.root.P, 3);
  const pspace = VM.freshPSpace(built.settings);
  pspace[0] = 1; pspace[cells.sentinel] = 77; pspace[cells.last] = 0; pspace[cells.box(0)] = 9;
  assert.equal(dispatch(built, pspace), 2);
  for (let i = 0; i < 3; i++) assert.equal(pspace[cells.box(i)], scoreBias(core));
  assert.equal(pspace[cells.last], 2);
});

test('HOLD keeps the member played until another beats its score by more', () => {
  const P = { WIN: 0, TIE: 0, LOSS: -1, HOLD: 2 };
  const built = build(lp(P)), full = built.root.P, core = built.settings.coreSize, cells = scoreCells(full, 3);
  const pspace = VM.freshPSpace(built.settings);
  pspace[0] = core - 1;
  const picks = [];
  for (let round = 0; round < 5; round++) { picks.push(dispatch(built, pspace)); pspace[0] = 0; }
  // HOLD 2 holds two losses (-1 + 2 and -2 + 2 are not beaten by 0); the third moves on, and the next
  // member then holds its own first loss.
  assert.deepEqual(picks, [0, 0, 0, 1, 1]);
  assert.equal(pspace[cells.box(0)], scoreBias(core) - 3);
});

test('the gate catches emitted code that disagrees with the model', () => {
  const built = build(lp());
  const changed = built.source.replace(/ADD\.AB #-1, (\S+)/, 'ADD.AB #1, $1');
  assert.notEqual(changed, built.source);
  const w = compile(changed, 'redcode', built.settings);
  assert.ok(w.ok);
  assert.throws(() => gate({ ...built, w }), /switch-score: P-space cell|ran the wrong branch/);
});

test('a roaming copy or imp running a branch not taken is not that branch', () => {
  // Each of these failed before: the not-taken paper or fan boot was checked as if it had run.
  const trees = [
    ['lp-hill', lp()],
    ['lp-hill', { id: 'switch-table', kids: [{ id: 'lp-imp-bomber' }, { id: 'lp-step-paper' }, { id: 'lp-selfhit-scanner' }] }],
    ['94x-hill', { id: 'switch-table', kids: [{ id: 'stone' }, { id: 'fanboot-paper-stone' }] }],
  ];
  for (const [rules, tree] of trees) assert.ok(build(tree, rules).w.ok);
});
