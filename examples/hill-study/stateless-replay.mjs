import assert from 'node:assert/strict';
import { compile, runRound } from '../../src/engine/index.js';

export function assemble(source, label, settings) {
  const warrior = compile(source, 'redcode', settings);
  assert.ok(warrior.ok, `${label}: ${JSON.stringify(warrior.errors)}`);
  return warrior;
}

export function tally(warrior, opponent, settings, round = runRound) {
  for (const contestant of [warrior, opponent]) {
    assert.ok(contestant.instructions.every(({ op }) => op !== 'LDP' && op !== 'STP'),
      'This replay resets P-space before each round. Use warriors without LDP or STP.');
  }
  const counts = { wins: 0, losses: 0, ties: 0 };
  for (let offset = settings.minDistance; offset <= settings.coreSize - settings.minDistance; offset++) {
    for (const firstTurn of [0, 1]) {
      const { winner } = round([warrior, opponent], settings, { positions: [0, offset], firstTurn, seed: 1 });
      counts[winner === 0 ? 'wins' : winner === 1 ? 'losses' : 'ties']++;
    }
  }
  return counts;
}
