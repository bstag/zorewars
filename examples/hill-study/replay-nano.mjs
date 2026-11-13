import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VM } from '../../src/engine/index.js';
import { assemble, tally } from './stateless-replay.mjs';

const settings = {
  coreSize: 80,
  maxCycles: 800,
  maxLength: 5,
  maxProcesses: 80,
  minDistance: 5,
  pSpaceSize: 5,
  assertErrors: true,
};
const source = readFileSync(new URL('./nano-lane.red', import.meta.url), 'utf8');
const scanner = assemble(source, 'Nano Lane', settings);
const ablation = assemble(source.replace('JMZ.F', 'JMZ.B'), 'B-field-only variant', settings);
const marker = assemble('JMP.B #1, $0', 'A-field-only marker', settings).instructions[0];

// Verify the whole lane and a hit at two positions, including a wrapped image.
const contracts = [0, 78].map((base) => {
  const solo = new VM(settings);
  solo.load([scanner], { positions: [base] });
  const look = (base + 1) % settings.coreSize;
  const visited = new Set();
  while (!solo.done) {
    if (solo.processes(0)[0] === look) visited.add((look + solo.peek(look).b) % settings.coreSize);
    solo.step();
  }
  const lane = Array.from({ length: 16 }, (_, index) => (base + 4 + 5 * index) % settings.coreSize);
  assert.deepEqual(visited, new Set(lane));
  assert.equal(solo.warriors[0].alive, true);
  assert.equal(solo.cycle, settings.maxCycles);
  assert.equal(solo.writerPc.includes((base + 2) % settings.coreSize), false);

  const target = (base + 44) % settings.coreSize;
  for (const [warrior, expected] of [[scanner, 'DAT'], [ablation, 'JMP']]) {
    const planted = new VM(settings);
    planted.load([warrior], { positions: [base] });
    planted.poke(target, marker);
    planted.step();
    planted.step();
    assert.equal(planted.peek(target).op, expected);
  }
  return { base, uniqueProbes: visited.size, cyclesAlive: solo.cycle, firstTarget: target };
});

const matches = process.argv.slice(2).map((file) => {
  const opponent = assemble(readFileSync(file, 'utf8'), file, settings);
  return {
    opponent: opponent.name,
    bothFields: tally(scanner, opponent, settings),
    bFieldOnly: tally(ablation, opponent, settings),
  };
});
console.log(JSON.stringify({ settings, contracts, matches }, null, 2));
