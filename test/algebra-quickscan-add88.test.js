import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, gate, leaves, link, treeMismatches } from '../tools/algebra/index.js';
import { compile, RULESETS, VM } from '../src/engine/index.js';

const id = 'opening-qscan-add-88';
const marker = { op: 'JMP', mod: 'B', aMode: '$', a: 0, bMode: '$', b: 0 };
const treeWith = (P) => ({
  id: 'seq',
  kids: [{ id, P }, { id: 'finisher-guarded-88', P: { PHASE: 0 } }],
});

function strictBuild(coreSize, P) {
  const settings = { ...RULESETS['88'], coreSize };
  const tree = treeWith(P);
  assert.deepEqual(treeMismatches(tree, settings), []);
  const linked = link(tree, settings);
  assert.deepEqual(linked.misfits, []);
  const w = compile(linked.source, 'redcode', settings);
  assert.equal(w.ok, true, JSON.stringify(w.errors));
  assert.deepEqual(w.warnings, []);
  return { ...linked, settings, w };
}

function handoff(built, base, plant) {
  const { w, settings, labels } = built;
  const { ns: opening } = built.root.kids[0];
  const { ns: finisher } = built.root.kids[1];
  const vm = new VM(settings);
  vm.load([w], { positions: [base] });
  const at = (offset) => (base + offset) % settings.coreSize;
  const probe = labels[opening + 'probe'];
  const goal = at(labels[finisher + 'payload']);
  for (const offset of plant) vm.poke(at(probe + offset), marker);
  for (let step = 0; step < 100 && !vm.done; step++) {
    if (vm.processes(0)[0] === goal) {
      return at(probe + vm.peek(at(probe)).b);
    }
    vm.step();
  }
  assert.fail('the scan did not enter the finisher');
}

test("additive '88 scan hands off every low and high hit on both core sizes", () => {
  for (const core of [8000, 8192]) {
    const P = { ROWS: 6, START: core - 500, ROWSTEP: 900, COLUMN: 200, GAP: 12, BLANK: 7120 };
    const built = strictBuild(core, P);
    const { ns } = built.root.kids[0];
    const probe = built.labels[ns + 'probe'];
    for (const base of [0, core - 4]) {
      const want = (offset) => (base + probe + offset) % core;
      const boundary = (base + built.total) % core;
      assert.equal(handoff(built, base, []), boundary);
      for (let row = 0; row < P.ROWS; row++) {
        for (const column of [0, P.COLUMN]) {
          const low = P.START + row * P.ROWSTEP + column, high = low + P.GAP;
          assert.equal(handoff(built, base, [low]), want(low));
          assert.equal(handoff(built, base, [high]), want(high));
          assert.equal(handoff(built, base, [low, high]), boundary);
        }
      }
      const first = P.START + P.GAP, later = P.START + P.ROWSTEP + P.COLUMN;
      assert.equal(handoff(built, base, [first, later]), want(first));
    }
    assert.equal(gate(built, { verification: 'full' }).ok, true);
  }
});

test("additive '88 scan rejects aliasing and a broken decoder", () => {
  const settings = RULESETS['88'];
  assert.ok(treeMismatches(treeWith({ COLUMN: 8000 }), settings).some((x) => x.includes('distinct cells')));
  assert.ok(treeMismatches(treeWith({ BLANK: 7999 }), settings).some((x) => x.includes('lands on the image')));

  const built = buildTree(treeWith(), { rules: '88', length: 100, verification: 'full' });
  const { ns } = built.root.kids[0];
  const row = built.labels[ns + `row${leaves[id].defaults.ROWS - 1}`];
  built.w.instructions[row].a++;
  assert.throws(() => gate(built), /incorrect additive scan handoff/);
});
