import { DEFAULT_SETTINGS } from '../src/engine/constants.js';
import { VM } from '../src/engine/vm.js';
import { matchPlan, summarizeMatch } from '../src/engine/match.js';
import { createSimulationRunner } from './simulation.js';

// A single yielding CPU queue works in a worker, or on the page when workers
// are unavailable. Partial matches never escape after cancellation.
export function createCpuMatchPool({ cancelled = () => false, yieldControl } = {}) {
  let closed = false, tail = Promise.resolve();
  const stats = { backend: 'cpu', threads: 1, matches: 0, rounds: 0, soloChecks: 0 };
  return {
    backend: 'cpu', size: 1, stats,
    match(task) {
      const result = tail.then(async () => {
        const stopped = () => closed || cancelled();
        if (stopped()) throw new DOMException('Match cancelled', 'AbortError');
        const settings = { ...DEFAULT_SETTINGS, ...task.settings };
        const plan = matchPlan(task), pspaces = [VM.freshPSpace(settings), VM.freshPSpace(settings)], rounds = [];
        const runner = createSimulationRunner({ cancelled: stopped, yieldControl });
        for (const options of plan) {
          const round = await runner.round([task.a, task.b], settings, { ...options, pspaces, report: !!task.diagnose });
          if (!round) throw new DOMException('Match cancelled', 'AbortError');
          rounds.push(round);
        }
        stats.matches++; stats.rounds += rounds.length;
        return summarizeMatch(task, rounds);
      });
      tail = result.catch(() => {});
      return result;
    },
    measureSpecies(warrior, settings) {
      const result = tail.then(async () => {
        const stopped = () => closed || cancelled();
        if (stopped()) throw new DOMException('Solo check cancelled', 'AbortError');
        const runner = createSimulationRunner({ cancelled: stopped, yieldControl });
        const species = await runner.species(warrior, settings);
        if (!species || stopped()) throw new DOMException('Solo check cancelled', 'AbortError');
        stats.soloChecks++;
        return species;
      });
      tail = result.catch(() => {});
      return result;
    },
    close() { closed = true; },
  };
}
