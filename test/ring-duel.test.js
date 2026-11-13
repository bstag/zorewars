import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, DEFAULT_SETTINGS, MODIFIERS, MODES, OPCODES, runMatch } from '../src/engine/index.js';
import { createRound } from '../src/engine/battle.js';
import { mulberry32 } from '../src/engine/random.js';
import { createRingDuel } from '../src/engine/ring-duel.js';

const ring = { ...DEFAULT_SETTINGS, coreSize: 31, minDistance: 8, maxLength: 8, maxCycles: 5, maxProcesses: 4, pSpace: false };

function packedCore(vm) {
  const cells = new Uint16Array(vm.size * 3);
  for (let i = 0; i < vm.size; i++) {
    cells[3 * i] = vm.op[i] | (vm.mod[i] << 5) | (vm.aMode[i] << 8) | (vm.bMode[i] << 11);
    cells[3 * i + 1] = vm.a[i];
    cells[3 * i + 2] = vm.b[i];
  }
  return cells;
}

test('score-only ring rounds match core, queues and results across opcodes, modifiers and addressing modes', () => {
  const random = mulberry32(4242);
  const field = () => Math.floor(random() * 15) - 7;
  const ops = OPCODES.slice(0, OPCODES.indexOf('LDP'));
  const jump = { op: 'JMP', mod: 'B', aMode: '$', bMode: '$', a: 0, b: 0 };
  let scenario = 0;
  for (const op of ops) for (const mod of MODIFIERS) {
    for (const aMode of MODES) for (const bMode of MODES) {
      const label = `${op}.${mod} ${aMode}, ${bMode}`;
      const settings = { ...ring, maxProcesses: [1, 4, 8][scenario % 3] };
      const firstTurn = scenario++ % 2;
      const positions = [scenario % ring.coreSize, (scenario + 8) % ring.coreSize];
      const instructions = [{ op, mod, aMode, bMode, a: field(), b: field() }];
      for (let i = 0; i < 5; i++) {
        instructions.push({ ...jump, op: ops[Math.floor(random() * ops.length)], a: field(), b: field() });
      }
      const warriors = [{ name: 'Subject', start: 0, instructions }, { name: 'Opponent', start: 0, instructions: [jump] }];
      const reference = createRound(warriors, settings, { positions, firstTurn, executionHistory: false });
      const duel = createRingDuel(settings, warriors);
      assert.ok(duel, label);
      reference.vm.run();
      assert.deepEqual(duel.round(positions, firstTurn), reference.finish(), label);
      assert.deepEqual(duel.core, packedCore(reference.vm), label);
      assert.deepEqual([duel.processes(0), duel.processes(1)], reference.vm.warriors.map(w => [...w.queue]), label);
    }
  }
});

test('history-off matches preserve P-space behavior for warriors assembled with P-space', () => {
  const settings = { ...ring, rounds: 3 };
  const warrior = compile('STP.AB #1, #1\nLDP.AB #1, marker\nJMZ.B dead, marker\nJMP 0\ndead DAT 0, 0\nmarker DAT 0, 0', 'redcode', { ...settings, pSpace: true });
  const opponent = compile('JMP 0', 'redcode', settings);
  assert.ok(warrior.ok && opponent.ok);
  const warriors = [warrior, opponent];
  assert.equal(createRingDuel(settings, warriors), null);
  const baseline = runMatch(warriors, settings, { seed: 42 });
  assert.equal(baseline.warriors[0].ties, settings.rounds);
  assert.deepEqual(runMatch(warriors, settings, { seed: 42, executionHistory: false }), baseline);
});
