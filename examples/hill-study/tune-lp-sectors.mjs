import { readFileSync } from 'node:fs';
import path from 'node:path';
import { RULESETS, runMatch } from '../../src/engine/index.js';
import { buildTree, link, observeTree, treeSettings, verifyPhases } from '../../tools/algebra/index.js';
import { assemble } from './stateless-replay.mjs';

const rules = 'lp-hill';
const settings = RULESETS[rules];
const linkedSettings = treeSettings(rules);

function atTargets(starts, width, paces) {
  const tree = { id: 'par', kids: starts.map((START, i) =>
    ({ id: 'lp-sector-clear', P: { START, WIDTH: width, PACE: paces[i] } })) };
  // Relink each relative START after pacing changes the loaded image.
  const { labels } = link(tree, linkedSettings);
  tree.kids.forEach((kid, i) => { kid.P.START = starts[i] - labels[`b${i + 1}initialize`]; });
  return tree;
}

function queueTrace(paces) {
  const tree = atTargets([256, 2050, 3950, 5950], 1200, paces);
  const built = { ...link(tree, linkedSettings), settings: linkedSettings };
  if (built.misfits.length) throw new Error(built.misfits.join('; '));
  built.w = assemble(built.source, 'paced sectors', linkedSettings);
  const { vm, observation } = observeTree(built);
  const sites = observation.blocks.map(({ work, feederAtLimit }) => ({
    firstTarget: work['dat-writes']?.firstTarget, writes: work['dat-writes']?.count ?? 0,
    deniedWriterChildren: work['feeds-at-cap']?.count ?? 0, feederAtLimit,
  }));
  return { paces, cells: built.total, peak: vm.warriors[0].peak, sites, phases: verifyPhases(observation) };
}

function battleStudy(folder) {
  const source = file => assemble(readFileSync(path.join(folder, file), 'utf8'), file, settings);
  const development = ['rous.red', 'digitalrain.red', 'dse_6.red', '4xlb_6.red'].map(source);
  const holdout = ['bronzeminotaur.red', 'l111.red', 'hippogriff.red', 'lpdestroyer.red'].map(source);
  const devSeeds = [6151, 8191], freshSeeds = [23431, 26003];
  function replay(candidate, opponents, seeds, rounds) {
    const matchups = opponents.map(opponent => {
      let points = 0;
      for (const seed of seeds) {
        const { wins, ties } = runMatch([candidate.warrior, opponent], { ...settings, rounds }, { seed }).warriors[0];
        points += wins * 3 + ties;
      }
      return { opponent: opponent.name, pointsPerRound: points / (rounds * seeds.length) };
    });
    return {
      starts: candidate.starts, width: candidate.width, matchups,
      pointsPerRound: matchups.reduce((sum, row) => sum + row.pointsPerRound, 0) / matchups.length,
    };
  }
  const grid = [256, 640, 1280].flatMap(start => [512, 1000, 1800].map(width => {
    const starts = [start, start + 3944];
    const tree = atTargets(starts, width, [0, 0]);
    const warrior = buildTree(tree, { rules, verification: 'full' }).w;
    return { starts, width, warrior };
  }));
  const screen = grid.map(candidate => ({ candidate, result: replay(candidate, development, devSeeds, 32) }))
    .sort((a, b) => b.result.pointsPerRound - a.result.pointsPerRound);
  const baseline = grid.find(({ starts, width }) => starts[0] === 256 && width === 1800);
  const finalists = [baseline, ...screen.filter(({ candidate }) => candidate !== baseline).slice(0, 2).map(row => row.candidate)];
  return {
    devSeeds, freshSeeds, screen: screen.map(row => row.result),
    confirmation: finalists.map(candidate => ({
      freshDevelopment: replay(candidate, development, freshSeeds, 64),
      holdout: replay(candidate, holdout, freshSeeds, 64),
    })),
  };
}

const [folder] = process.argv.slice(2);
const queue = [[0, 0, 0, 0], [1, 1, 1, 1], [2, 2, 2, 0], [2, 2, 2, 2]].map(queueTrace);
console.log(JSON.stringify({ queue, ...(folder && { battle: battleStudy(folder) }) }, null, 2));
