import { readFileSync } from 'node:fs';
import path from 'node:path';
import { RULESETS, runMatch } from '../../src/engine/index.js';
import { buildTree, observeTree, recipes } from '../../tools/algebra/index.js';
import { assemble } from './stateless-replay.mjs';

const rules = 'lp-hill';
const settings = RULESETS[rules];
const variants = [128, 512, 1200].flatMap(WIDTH => [0, 1].map(AIM => {
  const tree = recipes['lp-quickscan-sector'].tree();
  tree.kids[1].P = { WIDTH, AIM };
  return { WIDTH, AIM, built: buildTree(tree, { rules, length: 42, verification: 'full' }) };
}));

function replay(folder) {
  const source = file => assemble(readFileSync(path.join(folder, file), 'utf8'), file, settings);
  const main = ['rous.red', 'digitalrain.red', 'dse_6.red', '4xlb_6.red'].map(source);
  const separate = ['bronzeminotaur.red', 'l111.red', 'hippogriff.red', 'lpdestroyer.red'].map(source);
  const fields = [
    { opponents: main, seeds: [6151, 8191] },
    { opponents: separate, seeds: [23431, 26003] },
  ];
  const rounds = 48;
  return variants.map(({ WIDTH, AIM, built }) => {
    const panels = fields.map(({ opponents, seeds }) => {
      const matchups = opponents.map(opponent => {
        let points = 0;
        for (const seed of seeds) {
          const { wins, ties } = runMatch([built.w, opponent], { ...settings, rounds }, { seed }).warriors[0];
          points += wins * 3 + ties;
        }
        return { opponent: opponent.name, pointsPerRound: points / (rounds * seeds.length) };
      });
      return { seeds, rounds, matchups, pointsPerRound: matchups.reduce((sum, row) => sum + row.pointsPerRound, 0) / matchups.length };
    });
    return { WIDTH, AIM, panels };
  });
}

function replayChangedRound(folder) {
  const file = path.join(folder, 'rous.red');
  const opponent = assemble(readFileSync(file, 'utf8'), file, settings);
  const pair = variants.filter(({ WIDTH }) => WIDTH === 512);
  const seed = 8191, rounds = 48;
  const [fixed, aimed] = pair.map(({ built }) => runMatch([built.w, opponent], { ...settings, rounds }, { seed }).rounds);
  const index = aimed.findIndex((round, i) => round.winner === 0 && fixed[i].winner === 1);
  if (index < 0) throw new Error('Expected an aimed win at a fixed-control loss');
  const { positions, firstTurn } = aimed[index];
  const traces = pair.map(({ AIM, built }) => {
    const { vm, observation } = observeTree(built, { positions, firstTurn, opponent });
    const { phases } = observation.blocks.find(block => block.id === 'lp-probe-sector');
    return { AIM, winner: vm.winner, cycles: vm.cycle, phases, opponentLastDeath: vm.warriors[1].lastDeath };
  });
  return { opponent: opponent.name, seed, round: index + 1, positions, firstTurn, traces };
}

const [folder, mode] = process.argv.slice(2);
if (mode && mode !== '--trace') throw new Error('Pass the LP source folder, optionally followed by --trace');
const timing = variants.map(({ WIDTH, AIM, built }) => {
  const phases = row => row.observation.blocks.find(block => block.id === 'lp-probe-sector').phases;
  return { WIDTH, AIM, quiet: phases(built.verification.observations[0]), planted: phases(built.verification.observations.at(-1)) };
});
const example = variants.find(({ WIDTH, AIM }) => WIDTH === 512 && AIM === 1).built;
const quietEntry = example.verification.observations[0].observation.blocks[1].enteredAt;
const probe = example.labels.b1probe;
const boundary = [277, 278, 6542, 6543].map(address => {
  const instruction = { ...example.w.instructions[probe], b: address - probe };
  const { observation } = observeTree(example, { cycles: 80, injections: [{ cycle: quietEntry, address: probe, instruction }] });
  return { address, phases: observation.blocks.find(block => block.id === 'lp-probe-sector').phases };
});
console.log(JSON.stringify({
  timing, boundary,
  ...(folder && (mode === '--trace' ? { trace: replayChangedRound(folder) } : { panels: replay(folder) })),
}, null, 2));
