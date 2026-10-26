import { VM } from '../src/engine/vm.js';
import { createRound } from '../src/engine/battle.js';
import { speciesFromVM } from '../src/engine/species.js';

// Background tasks let input and drawing go first, without timer clamping or
// the boosted continuations of scheduler.yield competing with animation.
const yieldToBrowser = () => globalThis.scheduler?.postTask
  ? globalThis.scheduler.postTask(() => {}, { priority: 'background' })
  : new Promise((resolve) => setTimeout(resolve, 0));

// Keep the deadline across rounds: many short battles must yield too.
export function createSimulationRunner({
  cancelled = () => false,
  yieldControl = yieldToBrowser,
} = {}) {
  let deadline = performance.now() + 4;
  async function advance(vm, remaining = Infinity) {
    while (!vm.done && remaining > 0) {
      if (cancelled()) return false;
      remaining -= vm.run(Math.min(512, remaining));
      if (performance.now() >= deadline) {
        await yieldControl();
        deadline = performance.now() + 4;
        if (cancelled()) return false;
      }
    }
    return !cancelled();
  }
  return {
    async round(warriors, settings, options) {
      if (cancelled()) return null;
      const round = createRound(warriors, settings, options);
      return await advance(round.vm) ? round.finish() : null;
    },
    async species(compiled, settings) {
      if (cancelled()) return null;
      const vm = new VM(settings);
      vm.load([compiled], { seed: 1 });
      return await advance(vm, Math.max(0, Math.ceil(vm.settings.maxCycles))) ? speciesFromVM(vm) : null;
    },
  };
}
