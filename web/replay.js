// Reconstruct a deterministic replay privately before publishing it to the page.
import {VM} from '../src/engine/index.js';
export async function prepareReplay(settings,setup,end,cyclesBefore,{isCurrent,resetHighlights,clock=()=>performance.now(),yieldFrame=()=>new Promise(resolve=>setTimeout(resolve,0))}) {
  const vm = new VM(settings);
  vm.enableEvents();
  resetHighlights(vm.size);
  vm.load(setup.warriors, { positions: setup.positions, firstTurn: setup.firstTurn, pspaces: setup.pspaces.map((ps) => ps.slice()) });
  const target = Math.max(0, end - cyclesBefore);
  let deadline = clock() + 4;
  while (!vm.done && vm.cycle < target) {
    vm.step();
    if ((vm.steps & 511) === 0 && clock() >= deadline) {
      await yieldFrame();
      if (!isCurrent()) return null;
      deadline = clock() + 4;
    }
  }
  if (!isCurrent()) return null;
  return vm;
}
