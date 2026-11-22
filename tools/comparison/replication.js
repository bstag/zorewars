import assert from 'node:assert/strict';

export function summarizeReplication(records, { critical, minimumPositive } = {}) {
  assert.ok(records.length >= 2);
  assert.ok(Number.isFinite(critical) && critical > 0);
  assert.ok(Number.isSafeInteger(minimumPositive) && minimumPositive > 0 && minimumPositive <= records.length);

  const seeds = records.map(record => {
    assert.equal(record.complete, true);
    assert.ok(Number.isSafeInteger(record.rounds) && record.rounds > 0, 'Expected a positive round count');
    const reference = record.results.find(result => result.id === 'baseline');
    const challenger = record.results.find(result => result.id === 'candidate');
    assert.equal(reference.rows.length, challenger.rows.length);
    assert.ok(reference.rows.length > 0);
    let referencePoints = 0;
    let challengerPoints = 0;

    reference.rows.forEach((referenceRow, index) => {
      const challengerRow = challenger.rows[index];
      assert.equal(referenceRow.index, index);
      assert.equal(challengerRow.index, index);
      assert.equal(referenceRow.name, challengerRow.name);
      for (const row of [referenceRow, challengerRow]) {
        assert.ok([row.w, row.l, row.t].every(count => Number.isSafeInteger(count) && count >= 0));
        assert.equal(row.w + row.l + row.t, record.rounds);
      }
      referencePoints += 3 * referenceRow.w + referenceRow.t;
      challengerPoints += 3 * challengerRow.w + challengerRow.t;
    });

    const games = record.rounds * reference.rows.length;
    const baseline = referencePoints / games;
    const candidate = challengerPoints / games;
    return {
      seed: record.seedBase,
      rounds: record.rounds,
      opponents: reference.rows.length,
      baseline,
      candidate,
      delta: candidate - baseline,
      gainPct: baseline === 0 ? null : 100 * (candidate / baseline - 1),
    };
  });

  assert.equal(new Set(seeds.map(seed => seed.seed)).size, seeds.length);
  assert.ok(seeds.every(seed => seed.rounds === seeds[0].rounds && seed.opponents === seeds[0].opponents),
    'Equal-sized seed replications required');

  const mean = seeds.reduce((sum, seed) => sum + seed.delta, 0) / seeds.length;
  const squaredDeviations = seeds.reduce((sum, seed) => sum + (seed.delta - mean) ** 2, 0);
  const standardDeviation = Math.sqrt(squaredDeviations / (seeds.length - 1));
  const standardError = standardDeviation / Math.sqrt(seeds.length);
  const interval = [mean - critical * standardError, mean + critical * standardError];
  const baseline = seeds.reduce((sum, seed) => sum + seed.baseline, 0) / seeds.length;
  const candidate = seeds.reduce((sum, seed) => sum + seed.candidate, 0) / seeds.length;
  const positiveSeeds = seeds.filter(seed => seed.delta > 0).length;

  // Absolute point differences are defined even when a baseline earns zero.
  return {
    seeds,
    baseline,
    candidate,
    gainPct: baseline === 0 ? null : 100 * (candidate / baseline - 1),
    meanPairedPoints: mean,
    seedStandardDeviation: standardDeviation,
    seedStandardError: standardError,
    seedMean95: interval,
    seedMean95RelativePct: interval.map(value => baseline === 0 ? null : 100 * value / baseline),
    positiveSeeds,
    minimumPositive,
    critical,
    degreesOfFreedom: seeds.length - 1,
    supportsRepeatableGain: positiveSeeds >= minimumPositive && interval[0] > 0,
    totalFieldRounds: seeds.reduce((sum, seed) => sum + seed.rounds * seed.opponents * 2, 0),
    scope: 'Across-seed Student-t interval under approximate independent-seed/mean assumptions. This does not measure all implementation or opponent-archive uncertainty.',
  };
}
