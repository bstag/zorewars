import assert from 'node:assert/strict';
import { summarizeReplication } from './replication.js';

// Seed sets are the replicates for the primary uncertainty estimate.
export function summarizeFactorialReplication(records, options) {
  const ids = new Set(['baseline', 'candidate', 'scan-only', 'seed-only']);
  for (const record of records) {
    assert.equal(record.results.length, ids.size);
    assert.deepEqual(new Set(record.results.map(result => result.id)), ids);
  }

  function compare(referenceId, challengerId) {
    const pairedRecords = records.map(record => ({
      ...record,
      results: [
        { ...record.results.find(result => result.id === referenceId), id: 'baseline' },
        { ...record.results.find(result => result.id === challengerId), id: 'candidate' },
      ],
    }));
    return summarizeReplication(pairedRecords, options);
  }

  const primary = compare('baseline', 'candidate');
  const components = {
    scanOnly: compare('baseline', 'scan-only'),
    seedOnly: compare('baseline', 'seed-only'),
    addingSeed: compare('scan-only', 'candidate'),
    addingScan: compare('seed-only', 'candidate'),
  };
  const seeds = primary.seeds.map((seed, index) => ({
    seed: seed.seed,
    delta: seed.delta - components.scanOnly.seeds[index].delta - components.seedOnly.seeds[index].delta,
  }));
  const mean = seeds.reduce((sum, seed) => sum + seed.delta, 0) / seeds.length;
  const squaredDeviations = seeds.reduce((sum, seed) => sum + (seed.delta - mean) ** 2, 0);
  const standardDeviation = Math.sqrt(squaredDeviations / (seeds.length - 1));
  const margin = options.critical * (standardDeviation / Math.sqrt(seeds.length));
  const interval = [mean - margin, mean + margin];

  return {
    primary,
    components,
    interaction: {
      seeds,
      meanPairedPoints: mean,
      relativePct: primary.baseline === 0 ? null : 100 * mean / primary.baseline,
      seedMean95: interval,
      seedMean95RelativePct: interval.map(value => primary.baseline === 0 ? null : 100 * value / primary.baseline),
      scope: 'Combined minus scan-only minus seed-only plus baseline, paired within each seed. Exploratory, no multiplicity correction.',
    },
    newFieldRounds: primary.totalFieldRounds * 2,
    scope: 'Primary test is candidate versus baseline only. Component intervals are secondary, nominal and not multiplicity corrected. No prior evidence is pooled.',
  };
}
