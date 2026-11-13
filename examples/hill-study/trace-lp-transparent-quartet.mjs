import { VM } from '../../src/engine/index.js';
import { buildTree, createObservation } from '../../tools/algebra/index.js';

const built = buildTree({ id: 'lp-transparent-quartet' }, { rules: 'lp-hill', length: 54, verification: 'full' });
const defaultPhases = built.verification.observations[0].observation.blocks[0].phases;
const clearSites = [defaultPhases['first-dat'].target + 3, defaultPhases['pair-2-first-dat'].target + 3];
const peerLocks = [defaultPhases['peer-lock'].target, defaultPhases['pair-2-peer-lock'].target];

function trace(control) {
  const vm = new VM(built.settings);
  vm.load([built.w], { positions: [0] });
  const observer = createObservation(built, vm);
  const restored = [];
  while (!vm.done) {
    const event = observer.before();
    vm.step();
    const writer = clearSites.findIndex(site => site + 5 === event.pc);
    const destination = event.operands[1];
    if (writer >= 0 && event.instruction.op === 'MOV' && destination) {
      const { address } = destination;
      const other = clearSites[1 - writer];
      const protect = control === 'clear-sites' ? address === other + 4 || address === other + 5
        : control === 'locked-peers' && peerLocks.includes(address);
      if (protect && vm.lastWrite[address] === vm.steps && vm.peek(address).op === 'DAT') {
        // The operand snapshot already includes the effects of address resolution.
        vm.poke(address, destination.snapshot, destination.owner);
        vm.lastWrite[address] = destination.writeStep;
        vm.writerPc[address] = destination.writerPc;
        vm.writeCycle[address] = destination.writeCycle;
        restored.push({ turn: vm.steps, address, writerPc: event.pc });
      }
    }
    observer.after();
  }
  const { phases, work } = observer.finish().blocks[0];
  const finalQueue = vm.processes(0).map(pc => ({ pc, instruction: vm.disassemble(pc) }));
  return { phases, work, finalQueue, restored };
}

console.log(JSON.stringify({
  normal: trace('none'),
  preserveClearSites: trace('clear-sites'),
  preserveLockedPeers: trace('locked-peers'),
}, null, 2));
