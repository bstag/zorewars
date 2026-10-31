// Preserve live backend getters and accelerated solo checks when counting work.
import { measureSpecies } from '../../src/engine/index.js';
import { strip } from '../hill.js';

export function countBattles(runner, stats) {
  return {
    get backend() { return runner.backend; },
    get size() { return runner.size; },
    get stats() { return runner.stats; },
    measureSpecies: runner.measureSpecies ? (w, cfg) => runner.measureSpecies(w, cfg) : undefined,
    match(task) { stats.matches++; stats.battleRounds += task.settings.rounds; return runner.match(task); },
  };
}

export const measureSolo = async (pool, w, settings) => pool.measureSpecies
  ? pool.measureSpecies(strip(w), settings) : measureSpecies(w, settings);
