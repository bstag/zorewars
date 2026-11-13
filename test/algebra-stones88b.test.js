// triple-stream-stone (tools/algebra/blocks/stones88b.js): a stone with three
// DJN streams a third of the core apart. It builds and passes the gate on 88
// and 94nop, alone and in combinations; the three streams are followed cell by
// cell in the VM; broken settings are refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, gate, leaves, treeMismatches } from '../tools/algebra/index.js';
import { RULESETS, VM } from '../src/engine/index.js';

const ID = 'triple-stream-stone';
const ok = (rules, tree) => {
  const built = buildTree(tree, { rules });
  assert.equal(built.verification.ok, true);
  assert.deepEqual(built.w.warnings, []);
  return built;
};

test('it passes the gate alone on 88 and 94nop: seven instructions', () => {
  for (const rules of ['88', '94nop']) assert.equal(ok(rules, { id: ID }).total, 7);
  ok('88', { id: ID, P: { STEP: 2360, STREAM: 2600 } });
});

test('the three streams decrement cells exactly a third of the core apart, and never reach the loop', () => {
  const built = ok('88', { id: ID });
  const { settings, labels } = built, core = settings.coreSize, P = leaves[ID].defaults, third = 2667;
  for (const base of [0, 7995]) {
    const vm = new VM(settings);
    vm.load([built.w], { positions: [base] });
    const at = (l) => (base + labels['b0' + l]) % core;
    const djn = [at('tA'), at('tB'), at('tC')], targets = [[], [], []], bombs = new Set();
    while (vm.cycle < 80000) {
      const pc = vm.processes(0)[0], j = djn.indexOf(pc);
      if (j >= 0) {
        const c = (pc + vm.peek(pc).b) % core;
        targets[j].push((c + vm.peek(c).b - 1 + core) % core);
      }
      if (pc === at('tMov')) bombs.add((at('tHead') + vm.peek(at('tHead')).b) % core);
      vm.step();
    }
    // In step for the first STREAM passes: stream j is j thirds above the first, a cell lower each pass.
    for (let n = 0; n < P.STREAM - 4; n++) {
      assert.equal(targets[0][n], (at('tA') + P.STREAM - 1 - n) % core, `pass ${n}`);
      assert.equal((targets[1][n] - targets[0][n] + core) % core, third, `pass ${n}`);
      assert.equal((targets[2][n] - targets[0][n] + core) % core, 2 * third, `pass ${n}`);
    }
    // For the whole round no stream touches the three lines under the DJNs, and the loop is as loaded.
    const low = (c) => (c - at('tHead') + core) % core < 3;
    assert.ok(targets.every((list) => list.length > 10000 && !list.some(low)));
    assert.deepEqual(['tMov', 'tAdd'].map((l) => vm.peek(at(l)).op), ['MOV', 'ADD']);
    assert.equal(vm.peek(at('tAdd')).b, core - 2);
    assert.equal(vm.peek(at('tMov')).b, core - 1);
    // The stone: one residue class of the 8-cell grain, off its own seven cells.
    assert.equal(bombs.size, 1000);
    for (const c of bombs) assert.equal((c - at('tHead') + core) % 8, 7);
    assert.equal(vm.warriors[0].alive, true);
  }
});

test('it combines: after a quickscan, over decoys, beside an imp and beside a 7-point pump', () => {
  assert.ok(ok('88', { id: 'seq', kids: [{ id: 'opening-qscan-add-88', P: { ROWS: 4 } }, { id: ID }] }).total <= 50);
  ok('88', { id: 'image', kids: [{ id: ID }, { id: 'decoys' }] });
  ok('88', { id: 'par', kids: [{ id: ID }, { id: 'imp' }] });
  ok('94nop', { id: 'par', kids: [{ id: ID }, { id: 'imp' }] });
  ok('88', { id: 'par', kids: [{ id: ID }, { id: 'imp-pump-88', P: { N: 7 } }] });
});

test('broken settings are refused by the contract and by the gate', () => {
  const s88 = { ...RULESETS['88'], maxLength: 50 };
  const refuses = (P, re) => assert.ok(treeMismatches({ id: ID, P }, s88).some((m) => re.test(m)), `${JSON.stringify(P)} should be refused`);
  refuses({ STEP: 2937 }, /grain of at least 8/);
  refuses({ STEP: 2932 }, /grain of at least 8/);
  refuses({ STREAM: 3000 }, /third stream/);

  // A second stream that does not start a third above the first.
  const off = buildTree({ id: ID }, { rules: '88' });
  off.w.instructions[off.labels.b0tB].b += 5;
  assert.throws(() => gate(off), /not a third of the core/);
  // A bomb pointer a cell off its residue walks onto the stone.
  const self = buildTree({ id: ID }, { rules: '88' });
  self.w.instructions[self.labels.b0tHead].b++;
  assert.throws(() => gate(self), /bombed itself|not a third of the core/);   // or a bomb lands on a stream's pointer first
});

// The whole 80,000-cycle round, with the read-only observer attached.
const full = (tree) => {
  const built = buildTree(tree, { rules: '88', verification: 'full' });
  assert.equal(built.verification.ok, true);
  assert.equal(built.verification.profile, 'full');
  assert.equal(built.verification.horizon, built.settings.maxCycles);
};

test('full verification: at its defaults, alone and beside a 7-point pump', () => {
  full({ id: ID });
  full({ id: 'par', kids: [{ id: ID }, { id: 'imp-pump-88', P: { N: 7 } }] });
  full({ id: 'seq', kids: [{ id: 'opening-qscan-add-88', P: { ROWS: 4 } }, { id: ID }] });
});
