import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { RULESETS, runMatch } from '../../src/engine/index.js';
import { createRound } from '../../src/engine/battle.js';
import { buildTree, observeTree } from '../../tools/algebra/index.js';
import { assemble } from './stateless-replay.mjs';

const [folder, mode] = process.argv.slice(2);
const rules = 'lp-hill';
const counted = counts => counts.map(HITS => [`handoff after ${HITS}`, { SPREAD: 10, HANDOFF: 3, HITS }]);
const holdout = mode?.endsWith('-holdout');
const rescan = ['same-layout rescan', { SPREAD: 10, HANDOFF: 0 }];
const reach = (widths, OUTWARD) => widths.map(SWEEP => [
  `${OUTWARD ? 'outward' : 'backward'} sweep ${SWEEP}`, { SPREAD: 10, HANDOFF: 3, HITS: 64, SWEEP, OUTWARD },
]);
const countedScreen = counted([1, 2, 4, 8, 16, 32]);
const aimLayout = { OUTWARD: 1, START: 74, SPREAD: 3, HITS: 64, SWEEP: 120 };
const aimControl = ['fixed origin, matched layout', { ...aimLayout, HANDOFF: 3, AIM: 1 }];
const aimed = ['last-trap origin', { ...aimLayout, HANDOFF: 3, AIM: 2 }];
const aimPanel = [['rescan, matched layout', { ...aimLayout, HANDOFF: 0, AIM: 1 }], aimControl, aimed];
const burst = (HITS, SWEEP, HANDOFF = 4, BURSTSKIP = 0) => [
  `${HANDOFF === 4 ? 'DAT' : 'NOP'} burst ${SWEEP} after ${HITS}${BURSTSKIP ? ', skip trap' : ''}`,
  { SPREAD: 10, OUTWARD: 1, HITS, SWEEP, HANDOFF, BURSTSKIP },
];
const inline = [
  ['compact JMP', { SPREAD: 10 }],
  ['compact DAT', { SPREAD: 10, TRAP: 0 }],
  ['inline DAT after JMP', { SPREAD: 10, HANDOFF: 6 }],
  ['inline NOP after JMP', { SPREAD: 10, HANDOFF: 7 }],
];
const neighbors = [rescan, ...[4, 16].flatMap(hits => [
  burst(hits, 5), burst(hits, 5, 4, 1), burst(hits, 5, 5, 1),
])];
const lanes = [['previous 80-cell lanes', { SPREAD: 10 }], ...[80, 50, 40].map(STEP => [
  `step ${STEP}, matched first probes`, { START: 31, SPREAD: 4, STEP },
])];
const tighter = [
  ['step 40, unrolled loader', { START: 31, SPREAD: 4, STEP: 40 }],
  ['step 40, smaller loader', { START: 31, SPREAD: 4, STEP: 40, UNROLL: 1 }],
  ['step 32, smaller loader', { START: 10, SPREAD: 2, STEP: 32, UNROLL: 1 }],
];
const studies = {
  '--panel': [
    ['two lanes, JMP', {}],
    ['one lane, JMP', { SHIFT: 4000 }],
    ['four lanes, JMP', { SPREAD: 10 }],
    ['four lanes, DAT', { SPREAD: 10, TRAP: 0 }],
  ],
  '--handoff': [
    rescan,
    ['probe guard', { SPREAD: 10, HANDOFF: 1 }],
    ['confirmed trap handoff', { SPREAD: 10, HANDOFF: 2 }],
  ],
  '--counted': countedScreen,
  '--counted-sample': countedScreen,
  '--counted-confirm': [rescan, ...counted([32, 64, 96])],
  '--reach': [rescan, ...reach([80, 120, 144], 0), ...reach([120, 360, 960, 1800], 1)],
  '--reach-holdout': [rescan, ...reach([120, 960], 1)],
  '--aim': aimPanel,
  '--aim-holdout': aimPanel,
  '--aim-sample': [aimControl, aimed],
  '--burst': [rescan, ...[1, 4, 16, 64].map(hits => burst(hits, 5)), burst(4, 5, 5), burst(16, 5, 5)],
  '--burst-width': [rescan, ...[1, 3, 5, 9].map(width => burst(16, width)), burst(16, 1, 5), burst(16, 9, 5)],
  '--inline': inline,
  '--inline-holdout': inline,
  '--inline-trace': inline.slice(2),
  '--neighbor': neighbors,
  '--neighbor-holdout': neighbors,
  '--lanes': lanes,
  '--lanes-holdout': lanes,
  '--tighter': tighter,
  '--tighter-holdout': tighter,
};
if (!folder || (mode && !Object.hasOwn(studies, mode))) {
  throw new Error(`Pass the Koenigstuhl LP HILL32 source folder and optionally ${Object.keys(studies).join(', ')}`);
}
const variants = studies[mode ?? '--panel'];
const builds = variants.map(([, P]) =>
  buildTree({ id: 'lp-opposed-scanners', P }, { rules, length: P.AIM ? 100 : undefined, verification: 'full' }));
const settings = RULESETS[rules];
const source = file => assemble(readFileSync(path.join(folder, file), 'utf8'), file, settings);
const paper = SCATTER => buildTree({ id: 'lp-scatter-paper', P: { SCATTER } }, { rules }).w;
const timings = builds.map(({ total, verification }, index) => ({
  name: variants[index][0], cells: total,
  quiet: verification.observations[0].observation.blocks[0].phases,
  planted: verification.observations.find(row => row.scenario.includes('planted target'))?.observation.blocks[0].phases,
}));

function replay() {
  const opponents = holdout
    ? ['l111.red', 'bronzeminotaur.red', 'hippogriff.red', '4xlb_6.red'].map(source)
    : [source('rous.red'), source('digitalrain.red'), source('lpdestroyer.red'), source('dse_6.red'),
      { ...paper(1), name: 'lp-scatter-paper' }, { ...paper(0), name: 'lp-scatter-paper control' }];
  const candidates = builds.map(({ w }, i) => [variants[i][0], w]);
  if (mode === '--panel') {
    const published = source('4xlb_6.red');
    const isGuard = ({ op, mod, aMode }) => op === 'JMN' && mod === 'A' && aMode === '@';
    assert.equal(published.instructions.filter(isGuard).length, 2, 'Expected two source scan guards');
    const forcedRescan = {
      ...published,
      instructions: published.instructions.map(instruction =>
        isGuard(instruction) ? { ...instruction, op: 'JMP', mod: 'B' } : instruction),
    };
    candidates.unshift(['Published Disciples', published], ['Published Disciples, forced rescan', forcedRescan]);
  }
  const studySeeds = {
    '--counted-confirm': [2053, 4099],
    '--reach': [6151, 8191],
    '--reach-holdout': [12203, 16001],
    '--aim': [6151, 8191],
    '--aim-holdout': [23431, 26003],
    '--burst': [6151, 8191],
    '--burst-width': [10301, 13709],
    '--inline': [6151, 8191],
    '--inline-holdout': [23431, 26003],
    '--neighbor': [19001, 19841],
    '--neighbor-holdout': [30703, 37003],
    '--lanes': [6151, 8191],
    '--lanes-holdout': [30703, 37003],
    '--tighter': [40127, 41113],
    '--tighter-holdout': [43201, 46021],
  };
  const seeds = studySeeds[mode] ?? [521, 1777];
  const rounds = 64;
  const results = candidates.map(([name, warrior]) => {
    const matchups = opponents.map(opponent => {
      const scores = seeds.map(seed => runMatch([warrior, opponent], { ...settings, rounds }, { seed }).warriors[0]);
      const points = scores.reduce((sum, { wins, ties }) => sum + 3 * wins + ties, 0);
      return { opponent: opponent.name, pointsPerRound: points / (rounds * seeds.length) };
    });
    return { name, matchups, pointsPerRound: matchups.reduce((sum, row) => sum + row.pointsPerRound, 0) / matchups.length };
  });
  return { seeds, rounds, results };
}

function sampleHandoffs() {
  const aimSample = mode === '--aim-sample';
  const seed = aimSample ? 6151 : 521, rounds = 16;
  const opponents = [paper(1), paper(0)];
  const results = builds.map((built, i) => {
    const matchups = opponents.map(opponent => {
      const match = runMatch([built.w, opponent], { ...settings, rounds }, { seed });
      let handoffs = 0, aimed = 0;
      for (const { positions, firstTurn } of match.rounds) {
        const { observation } = observeTree(built, { positions, firstTurn, opponent });
        const phases = Object.keys(observation.blocks[0].phases);
        if (phases.some(phase => phase.endsWith('-first-dat'))) handoffs++;
        if (phases.some(phase => phase.endsWith('-aim'))) aimed++;
      }
      return { handoffs, aimed };
    });
    return {
      name: variants[i][0],
      roundsWithHandoff: matchups.map(row => row.handoffs),
      ...(aimSample && { roundsWithAim: matchups.map(row => row.aimed) }),
    };
  });
  return { seed, rounds, opponents: ['lp-scatter-paper', 'lp-scatter-paper control'], results };
}

function traceLocks() {
  const opponent = paper(0);
  const seed = 6151, rounds = 64;
  const [dat, nop] = builds;
  const match = built => runMatch([built.w, opponent], { ...settings, rounds }, { seed }).rounds;
  const datRounds = match(dat), nopRounds = match(nop);
  const index = datRounds.findIndex((round, i) => round.winner === 1 && nopRounds[i].winner === null);
  assert.ok(index >= 0, 'Expected a round that DAT lost and the NOP control tied');
  const { positions, firstTurn } = datRounds[index];
  const trace = built => {
    const { vm, finish } = createRound([built.w, opponent], settings, { positions, firstTurn });
    const labels = built.labels;
    const { phases } = built.verification.observations[0].observation.blocks[0];
    const sites = [1, 2, 3, 4].map(i => vm.norm(positions[0] + phases[`site-${i}-entry`].target));
    const pcs = label => new Set(sites.map((base, i) => {
      const side = i % 2 ? 'fore' : 'back';
      return vm.norm(base + labels[`b0${side}${label}`] - labels[`b0${side}advance`]);
    }));
    const trapPcs = pcs('attack'), datPcs = pcs('burst');
    let firstLocked = null, firstBurstDeath = null, peakLocked = 0, capTurnsWithLocks = 0;
    while (!vm.done) {
      const event = vm.step();
      if (event.warrior !== 1) continue;
      if (event.killed) {
        const death = vm.warriors[1].lastDeath;
        if (death.codeOwner === 0 && datPcs.has(death.writerPc)) firstBurstDeath ??= death;
      }
      const queue = vm.processes(1);
      const locked = queue.filter(pc => {
        const code = vm.peek(pc);
        return vm.owner[pc] === 0 && trapPcs.has(vm.writerPc[pc]) && code.op === 'JMP' && code.aMode === '#' && code.a === 0;
      });
      if (locked.length) firstLocked ??= { step: vm.steps, pc: locked[0], queue: queue.length };
      peakLocked = Math.max(peakLocked, locked.length);
      if (locked.length && queue.length === settings.maxProcesses) capTurnsWithLocks++;
    }
    return { winner: finish().winner, cycles: vm.cycle, firstLocked, firstBurstDeath, peakLocked, capTurnsWithLocks };
  };
  return { seed, round: index + 1, positions, firstTurn, dat: trace(dat), nop: trace(nop) };
}

console.log(JSON.stringify({
  timings,
  ...(mode === '--inline-trace' ? { trace: traceLocks() }
    : mode?.endsWith('-sample') ? { sample: sampleHandoffs() } : mode && { panel: replay() }),
}, null, 2));
