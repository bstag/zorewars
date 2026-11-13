import assert from 'node:assert/strict';
import test from 'node:test';
import { VM } from '../src/engine/index.js';
import { buildTree } from '../tools/algebra/index.js';
import { bronzeBuilds, traceBronze } from '../examples/hill-study/trace-lp-bronze-paper.mjs';

test('LP A-predecrement scatter reads before the write across the core seam', () => {
  const built = buildTree({ id: 'lp-scatter-paper',
    P: { READMODE: 1, READ: 1171, WRITE: 826, HOP: 5740, COUNT: 20, RESTART: 2903 } },
    { rules: 'lp-hill', verification: 'full' });
  const vm = new VM(built.settings);
  const base = 7997;
  const marker = { op: 'JMP', mod: 'B', aMode: '#', a: 7, bMode: '$', b: 0 };
  vm.load([built.w], { positions: [base] });
  vm.poke(base + 1172, marker);
  vm.step();
  vm.step();
  assert.deepEqual(vm.peek(base + 827), marker);
  assert.equal(vm.peek(base + 1173).a, 7999);
  assert.equal(vm.peek(base + 828).a, 7999);
});

test('LP Bronze pair reaches the cap together and its transfers preserve FIFO ancestry', () => {
  const builds = bronzeBuilds();
  const dual = traceBronze(builds.dual);
  assert.deepEqual(traceBronze(builds.dual, 7997), dual);
  assert.equal(dual.firstCap.turn, 412);
  assert.deepEqual(dual.firstCap.tags, ['A', 'A', 'B', 'B', 'B', 'B', 'A', 'A']);
  assert.deepEqual(dual.lineages.map(row => row.firstTransfer.turn), [61, 63]);
  assert.deepEqual(dual.lineages.map(row => row.firstCappedTransfer), [
    { turn: 413, target: 5729, intact: true }, { turn: 882, target: 6382, intact: true },
  ]);
  assert.deepEqual(dual.final.counts, [8, 0]);
  assert.deepEqual(traceBronze(builds.aOnly).final.counts, [7, 0]);
  assert.deepEqual(traceBronze(builds.bOnly).final.counts, [0, 8]);
});
