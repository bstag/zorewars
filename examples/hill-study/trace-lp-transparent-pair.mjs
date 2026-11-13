import assert from 'node:assert/strict';
import { buildTree, observeTree } from '../../tools/algebra/index.js';

const rules = 'lp-hill';
const build = P => buildTree({ id: 'lp-transparent-pair', P }, { rules, verification: 'full' });
const standard = build({ STEP: 78 });
const alternate = build({ STEP: 82 });
const probeControl = mod => {
  const instructions = standard.w.instructions.map(ins => ins.op === 'JMZ' && ins.mod === 'A' ? { ...ins, mod } : ins);
  assert.equal(instructions.filter((ins, index) => ins !== standard.w.instructions[index]).length, 2);
  return { ...standard, w: { ...standard.w, instructions } };
};
const seedIndex = standard.labels.b0foreseed;
const shiftedSeed = {
  ...standard,
  w: { ...standard.w, instructions: standard.w.instructions.map((ins, i) =>
    i === seedIndex ? { ...ins, b: ins.b + 40 * 78 } : ins) },
};

function trace(built) {
  const { observation, vm } = observeTree(built);
  const { phases, work } = observation.blocks[0];
  const finalProbeCells = Object.fromEntries(Object.entries(work).filter(([name]) => name.endsWith('-probes'))
    .map(([name, { lastTarget }]) => [name, { address: lastTarget, instruction: vm.peek(lastTarget) }]));
  return { phases, work, finalProbeCells, cycles: observation.cycles, finalQueue: vm.processes(0) };
}

console.log(JSON.stringify({
  standard: trace(standard),
  alternateStride: trace(alternate),
  bFieldControl: trace(probeControl('B')),
  bothFieldsControl: trace(probeControl('F')),
  forwardPhaseControl: trace(shiftedSeed),
}, null, 2));
