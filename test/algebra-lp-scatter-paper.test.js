import assert from 'node:assert/strict';
import test from 'node:test';
import { VM } from '../src/engine/index.js';
import { buildTree, observeTree } from '../tools/algebra/index.js';

const rules = 'lp-hill';
const id = 'lp-scatter-paper';

test('LP scatter and quiet control share copy and capped-transfer timing', () => {
  for (const SCATTER of [0, 1]) {
    const built = buildTree({ id, P: { SCATTER } }, { rules, verification: 'full' });
    assert.equal(built.total, 7);
    const base = 7997;
    const { observation } = observeTree(built, { positions: [base] });
    const { phases } = observation.blocks[0];
    assert.deepEqual(phases['first-transfer'], { cycle: 29, target: 6077 });
    assert.equal(phases['capped-transfer'].cycle, 550);
    assert.equal(phases['first-scatter']?.cycle, SCATTER ? 1 : undefined);
  }
});

test('LP scatter copies the pre-increment snapshot and the transfer rejects a damaged seed', () => {
  const built = buildTree({ id }, { rules });
  const vm = new VM(built.settings);
  const base = 7997;
  const at = offset => vm.norm(base + offset);
  const source = at(2 + 4883), pointer = at(2 + 1347), firstCopy = at(6080);
  const marker = { op: 'JMP', mod: 'B', aMode: '#', a: 7, bMode: '$', b: 0 };
  vm.load([built.w], { positions: [base] });
  vm.poke(source, marker);
  vm.step();
  vm.step();
  assert.deepEqual(vm.peek(pointer - 1), marker);
  assert.equal(vm.peek(source).b, 1);
  assert.equal(vm.peek(pointer).a, 7999);

  while (vm.steps < 29) vm.step();
  assert.equal(vm.peek(firstCopy).b, 0);
  vm.poke(firstCopy, { ...vm.peek(firstCopy), b: 1 });
  vm.step();
  assert.ok(!vm.processes(0).includes(firstCopy));
});

test('LP scatter refuses incompatible rules and a first-generation pointer alias', () => {
  assert.throws(() => buildTree({ id }, { rules: 'tinylp' }), /8,000-cell ring/);
  assert.throws(() => buildTree({ id, P: { READ: 1347 } }, { rules }), /pointer cells or scatter destinations overlap/);
});
