import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, runMatch, RULESETS } from '../src/engine/index.js';
import { pmarsRng } from '../src/engine/random.js';

// ModelWar's server (pmars-ts) separates the two warriors by the 5040 length
// limit, not by its minSeparation of 100, and advances the battle seed once
// before round 1. These positions are from a real server battle (seed
// 607169539), recovered by replaying it round for round.
test('the modelwar rules place warriors where the ModelWar server does', () => {
  const settings = { ...RULESETS.modelwar, rounds: 5 };
  const imp = compile('MOV.I $0, $1', 'redcode', settings);
  const r = runMatch([imp, imp], settings, { seed: pmarsRng(607169539) });
  assert.deepEqual(r.rounds.map((x) => x.positions[1]), [16890, 18791, 16159, 15937, 10746]);
});

test('modelwar loads 5040..20160 cells apart but still reports MINDISTANCE 100', () => {
  const settings = { ...RULESETS.modelwar, rounds: 200 };
  const w = compile('JMP $0', 'redcode', settings);
  const offsets = runMatch([w, w], settings, { seed: 1 }).rounds.map((x) => x.positions[1]);
  assert.ok(Math.min(...offsets) >= 5040 && Math.max(...offsets) <= 25200 - 5040);
  const probe = compile('DAT #MINDISTANCE, #0', 'redcode', settings);
  assert.equal(probe.instructions[0].a, 100);
});
