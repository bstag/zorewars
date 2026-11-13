import { VM } from '../../src/engine/index.js';
import { buildTree, createObservation } from '../../tools/algebra/index.js';
import { replayTinyLpPanels } from './tiny-lp-panels.mjs';

const [folder, option] = process.argv.slice(2);
if (!folder || (option && option !== '--lead')) {
  throw new Error('Usage: node examples/hill-study/replay-tiny-lp-fan.mjs <Koenigstuhl Odd HILL32 directory> [--lead]');
}

const HOP = 380;
const LEAD = Number(option === '--lead');
const builds = [0, 1, 2].map(FAN => buildTree({ id: 'paired-clear-fan', P: { HOP, FAN, LEAD } },
  { rules: 'tinylp', verification: 'full' }));
const { settings } = builds[0];

function opening(built) {
  const vm = new VM(settings);
  vm.load([built.w], { positions: [0] });
  const obs = createObservation(built, vm);
  const allocationAt = [null, null];
  const workers = 2 ** built.root.P.FAN;
  const first = built.labels[LEAD ? 'b0leadOne' : 'b0fan1'], last = built.labels.b0resetJump;
  while (vm.cycle < 100) {
    obs.before();
    vm.step();
    obs.after();
    const queue = vm.processes(0);
    [0, HOP].forEach((origin, i) => {
      if (queue.filter(pc => pc >= origin + first && pc <= origin + last).length === workers) {
        allocationAt[i] ??= vm.cycle;
      }
    });
  }
  const { work } = obs.finish().blocks[0];
  const lanes = [work['home-attack'], work['remote-attack']];
  return {
    workersPerSite: workers, allocationAt,
    firstWrite: lanes.map(lane => lane.firstCycle + 1),
    cellsHitByTurn100: lanes.map(lane => lane.uniqueTargets),
  };
}

console.log(JSON.stringify({ lead: !!LEAD, opening: builds.map(opening), ...replayTinyLpPanels(folder, builds) }, null, 2));
