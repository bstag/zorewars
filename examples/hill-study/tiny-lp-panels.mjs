import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { RULESETS, runMatch } from '../../src/engine/index.js';
import { buildTree, recipes } from '../../tools/algebra/index.js';
import { assemble, tally } from './stateless-replay.mjs';

const original = ['masterotw.red', 'daubfusion.red', 'fpaper800.red', 'uglyredcode.red', 'troskilde.red', 'swallow.red'];
const additional = ['dilemma.red', 'makeupmind.red', 'pangalactic.red', 'tqscanlpap.red', 'trottinger.red'];
const seeds = [124, 521, 1777];

function heldOut(w, opponent, settings) {
  const counts = { wins: 0, losses: 0, ties: 0 };
  for (const seed of seeds) {
    const result = runMatch([w, opponent], { ...settings, rounds: 250 }, { seed }).warriors[0];
    for (const key of Object.keys(counts)) counts[key] += result[key];
  }
  return counts;
}

export function replayTinyLpPanels(folder, builds) {
  const { settings } = builds[0];
  function panel(files, compare) {
    const rows = files.map(file => {
      const opponent = assemble(readFileSync(path.join(folder, file), 'utf8'), file, settings);
      return { opponent: opponent.name, counts: builds.map(({ w }) => compare(w, opponent, settings)) };
    });
    const pointsPerRound = builds.map((_, i) => {
      const totals = rows.reduce(({ points, rounds }, row) => {
        const { wins, losses, ties } = row.counts[i];
        return { points: points + 3 * wins + ties, rounds: rounds + wins + losses + ties };
      }, { points: 0, rounds: 0 });
      return totals.points / totals.rounds;
    });
    return { rows, pointsPerRound };
  }
  return { original: panel(original, tally), additional: panel(additional, heldOut) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [folder] = process.argv.slice(2);
  if (!folder) throw new Error('Pass the Odd HILL32 source folder');
  const rules = 'tinylp';
  const settings = RULESETS[rules];
  const kiss = assemble(readFileSync(path.join(folder, 'kiss.red'), 'utf8'), 'kiss.red', settings);
  const names = ['KISS', 'paired-clear-feeder', 'paired-clear-staged', 'tiny-lp-trap-scan', 'tiny-lp-trap-scan DAT'];
  const trees = [
    ...names.slice(1, 4).map(name => recipes[name].tree(rules)),
    { id: 'tiny-lp-trap-scan', P: { TRAP: 0 } },
  ];
  const builds = [{ w: kiss, settings }, ...trees.map(tree => buildTree(tree, { rules, verification: 'full' }))];
  console.log(JSON.stringify({ names, ...replayTinyLpPanels(folder, builds) }, null, 2));
}
