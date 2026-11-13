import { buildTree, observeTree } from '../../tools/algebra/index.js';
import { replayTinyLpPanels } from './tiny-lp-panels.mjs';

const [folder, field = 'a'] = process.argv.slice(2);
if (!folder || !['a', 'b'].includes(field)) {
  throw new Error('Usage: node examples/hill-study/replay-tiny-lp-stream.mjs <Koenigstuhl Odd HILL32 directory> [a|b]');
}
const HOP = 380, FIELD = Number(field === 'b');
const variants = ['staged', 'counter', 'stream', 'compact'];
const trees = [
  { id: 'paired-clear-staged', P: { HOP } },
  ...[{ STREAM: 0 }, { STREAM: 1 }, { COMPACT: 1 }].map(P => ({
    id: 'paired-clear-stream', P: { HOP, FIELD, ...P },
  })),
];
const builds = trees.map(tree => buildTree(tree, { rules: 'tinylp', verification: 'full' }));
const handoffs = builds.slice(1).map(built => {
  const { observation } = observeTree(built, { cycles: 850 });
  const { work, phases } = observation.blocks[0];
  return ['home', 'remote'].map(site => ({
    firstWrite: work[site + '-attack'].firstCycle + 1,
    selectorTurn: phases[site + '-selector'].cycle + 1,
    firstDat: phases[site + '-first-dat'].cycle + 1,
  }));
});
console.log(JSON.stringify({ field, variants, sizes: builds.map(b => b.total), handoffs,
  ...replayTinyLpPanels(folder, builds) }, null, 2));
