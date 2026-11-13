import { buildTree, observeTree } from '../../tools/algebra/index.js';

const rules = 'lp-hill';
const build = id => buildTree({ id }, { rules, length: 100, verification: 'full' });
const unrestricted = build('lp-transparent-quartet');
const partitioned = build('lp-partitioned-quartet');

// Keep the same layout, but make the feeder the optional child instead.
const instructions = partitioned.w.instructions.map(instruction => ({ ...instruction }));
for (const side of ['back', 'back2']) {
  const label = name => partitioned.labels[`b0${side}${name}`];
  const feed = label('feed'), hold = label('hold');
  Object.assign(instructions[feed], { aMode: '#', a: 0, bMode: '$', b: 0 });
  instructions[hold].b = label('clear') - hold;
}
const optionalFeeder = { ...partitioned, w: { ...partitioned.w, instructions } };

function trace(built) {
  const { vm, observation } = observeTree(built, { positions: [0] });
  const { phases, work, queueUsage } = observation.blocks[0];
  return {
    cells: built.total, phases, work, queueUsage, peak: vm.warriors[0].peak,
    finalQueue: vm.processes(0).map(pc => ({ pc, instruction: vm.disassemble(pc) })),
  };
}

console.log(JSON.stringify({
  unrestricted: trace(unrestricted),
  partitioned: trace(partitioned),
  optionalFeederControl: trace(optionalFeeder),
}, null, 2));
