import { DEFAULT_SETTINGS } from '../src/engine/constants.js';
import { VM } from '../src/engine/vm.js';
import { matchPlan, summarizeMatch } from '../src/engine/match.js';
import { createRingDuel } from '../src/engine/ring-duel.js';
import { createSimulationRunner } from './simulation.js';

// A single yielding CPU queue works in a worker, or on the page when workers
// are unavailable. Partial matches never escape after cancellation.
export function createCpuMatchPool({ cancelled = () => false, yieldControl, createRingKernel } = {}) {
  let closed = false, tail = Promise.resolve();
  const stats = { backend: 'cpu', threads: 1, matches: 0, rounds: 0, soloChecks: 0, wasmRounds: 0 };
  return {
    backend: 'cpu', size: 1, stats,
    match(task) {
      const result = tail.then(async () => {
        const stopped = () => closed || cancelled();
        if (stopped()) throw new DOMException('Match cancelled', 'AbortError');
        const settings = { ...DEFAULT_SETTINGS, ...task.settings };
        const warriors = [task.a, task.b];
        const plan = matchPlan(task), rounds = [];
        const duel = createRingKernel && createRingDuel(settings, warriors, createRingKernel, { diagnose: !!task.diagnose });
        const runner = createSimulationRunner({ cancelled: stopped, yieldControl });
        if (duel) {
          for (const { positions, firstTurn } of plan) {
            const round = duel.startRound(positions, firstTurn);
            if (!await runner.advance(round)) throw new DOMException('Match cancelled', 'AbortError');
            rounds.push(round.finish());
          }
        } else {
          const pspaces = warriors.map(() => VM.freshPSpace(settings));
          for (const options of plan) {
            const round = await runner.round(warriors, settings, {
              ...options, pspaces, report: !!task.diagnose, createRingKernel, allowKernelFallback: true,
            });
            if (!round) throw new DOMException('Match cancelled', 'AbortError');
            rounds.push(round);
          }
        }
        stats.matches++; stats.rounds += rounds.length;
        if (duel) stats.wasmRounds += rounds.length;
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
        const species = await runner.species(warrior, settings, { createRingKernel });
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
