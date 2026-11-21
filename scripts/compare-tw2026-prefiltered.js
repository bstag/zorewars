// Verify the mixed published/measured matrices and compare entrant placements.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { readKoenigstuhlRecord } from '../cli/koenigstuhl-scores.js';
import { pushOff } from '../src/engine/pushoff.js';

const root = path.resolve(process.argv[2] ?? 'evolved/tw2026-prefiltered');
const seed = Number(process.argv[3] ?? 20261117);
const rounds = Number(process.argv[4] ?? 500);
// In published entrant order, transcribed from docs/tournament-weekend-2026.md.
const officialCombinedRanks = {
  lp: [3, 7, 18, 19, 30, 38, 48, 49, 51, 52, 58, 64, 66, 73, 75],
  '94x': [7, 9, 10, 20, 28, 38, 52, 54, 60, 65, 67],
  '88': [9, 10, 20, 22, 23, 33, 71, 77, 104, 119],
  '94nop': [6, 9, 17, 21, 22, 27, 31, 32, 37, 45, 70, 75, 93, 122],
};
const summary = [];
for (const division of ['lp', '94x', '88', '94nop']) {
  const folder = path.join(root, division);
  const record = JSON.parse(fs.readFileSync(path.join(folder, `scores-${seed}-${rounds}.json`)));
  const analysis = JSON.parse(fs.readFileSync(path.join(folder, `analysis-${seed}-${rounds}.json`)));
  const reference = readKoenigstuhlRecord(record.referenceScores.metadata);
  const hill = record.warriors.filter(w => !w.entry);
  assert.equal(hill.length, analysis.top);
  assert.equal(record.settings.pSpace, false);
  let referenceCells = 0, measuredPairs = 0;
  for (let i = 0; i < record.warriors.length; i++) {
    const a = record.warriors[i];
    if (!a.entry) assert.notEqual(reference.warriors[a.publishedIndex].format, 'P-Space');
    assert.equal(record.scores[i][i], 0);
    for (let j = 0; j < i; j++) {
      const b = record.warriors[j];
      if (!a.entry && !b.entry) {
        assert.equal(record.scores[i][j], reference.scores[a.publishedIndex][b.publishedIndex]);
        assert.equal(record.scores[j][i], reference.scores[b.publishedIndex][a.publishedIndex]);
        referenceCells += 2;
      } else {
        const result = record.measuredResults[i][j];
        assert.equal(result.w + result.l + result.t, rounds);
        assert.equal(record.scores[i][j], (3 * result.w + result.t) / rounds);
        assert.equal(record.scores[j][i], (3 * result.l + result.t) / rounds);
        measuredPairs++;
      }
    }
  }
  const replay = pushOff(record.scores, record.warriors.map(w => w.name), { rule: 'official' });
  assert.deepEqual(replay.map(w => w.index), analysis.ranking.map(w => w.index));
  const rubyFile = path.join(root, 'ruby-check', division, 'ruby-output.txt');
  let rubyVerified = false;
  if (fs.existsSync(rubyFile)) {
    const ruby = fs.readFileSync(rubyFile, 'utf8').trim().split(/\r?\n/).map(line => {
      const match = line.match(/^(\d+)\s+(.*?)"(.*)" by/);
      assert.ok(match, `invalid Ruby output: ${line}`);
      return { rank: Number(match[1]), values: match[2].trim().split(/\s+/).map(Number), name: match[3] };
    }).sort((a, b) => a.rank - b.rank);
    assert.deepEqual(ruby.map(row => row.name), replay.map(row => row.name));
    for (const row of ruby.filter(row => row.rank > 1)) {
      const expected = replay[row.rank - 1];
      for (const [i, value] of [expected.score * 100, expected.div, expected.avg * 100].entries()) {
        assert.ok(Math.abs(row.values[i] - value) <= 0.000501, `${division}: Ruby numeric mismatch at ${row.rank}`);
      }
    }
    rubyVerified = true;
  }
  const previousRounds = division === 'lp' ? 500 : 50;
  const previous = JSON.parse(fs.readFileSync(path.resolve('evolved/tw2026-reconstruction', division,
    `analysis-${seed}-${previousRounds}.json`)));
  const placements = analysis.entryRanking.map(row => ({
    name: row.name, official: row.publishedEntrantRank, rerun: row.entrantRank,
    previous: previous.entryRanking.find(old => old.name === row.name).entrantRank,
    combinedRank: row.rank, publishedCombinedRank: officialCombinedRanks[division][row.publishedEntrantRank - 1],
  }));
  const error = key => placements.reduce((sum, row) => sum + Math.abs(row[key] - row.official), 0) / placements.length;
  summary.push({ division, top: analysis.top, fieldSize: record.warriors.length, rubyVerified,
    lastSelectedHillRank: Math.max(...hill.map(w => w.hillRank)), referenceCells, measuredPairs,
    rounds, seed, previousRounds, meanAbsoluteRankError: error('rerun'),
    previousMeanAbsoluteRankError: error('previous'),
    meanAbsoluteCombinedRankError: placements.reduce((sum, row) =>
      sum + Math.abs(row.combinedRank - row.publishedCombinedRank), 0) / placements.length,
    exactPlaces: placements.filter(row => row.rerun === row.official).length, placements });
}
fs.writeFileSync(path.join(root, 'comparison.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
