// Multi-round matches and round-robin tournaments.

import { VM } from './vm.js';
import { DEFAULT_SETTINGS, roundPoints, separationFor } from './constants.js';
import { mulberry32 } from './random.js';
import { topologyFor } from './topology.js';
import { postMortem } from './report.js';

// Score per round with two warriors: a win is worth 3 points, a tie 1.
// In general each survivor scores (W*W-1)/S, as in pMARS.
export const WIN_POINTS = 3;
export const TIE_POINTS = 1;

// `report` adds a post-mortem (see report.js); `traceSize` keeps the last
// that many executed instructions.
export function runRound(warriors, settings = {}, { seed, positions: fixedPositions, firstTurn = 0, pspaces, report = false, traceSize = 0 } = {}) {
  const vm = new VM(settings);
  if (traceSize) vm.enableTrace(traceSize);
  const positions = vm.load(warriors, { seed, positions: fixedPositions, firstTurn, pspaces });
  vm.run();
  vm.recordResults();
  return {
    winner: vm.winner,
    cycles: vm.cycle,
    positions,
    firstTurn,
    survivors: vm.warriors.filter((w) => w.alive).map((w) => w.index),
    ...(report ? { report: postMortem(vm) } : {}),
    ...(traceSize ? { trace: vm.trace } : {}),
  };
}

// Run a match between 2+ compiled warriors over several rounds. The first
// mover rotates each round. Load positions come from the battlefield's
// topology (topology.js), driven by `seed`; `fixed` works like pMARS's -F
// option (with two warriors, warrior 2 starts there in round 1). Two-warrior
// matches follow the standard placement rule, so they can be replayed in
// pMARS exactly.
// `report`: true for a post-mortem of every round, or a round number.
// `traceRound` / `traceSize`: keep the last traceSize instructions of that round.
export function runMatch(warriors, settings = {}, { seed = 1, fixed, onRound, report = false, traceRound = 0, traceSize = 0 } = {}) {
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  const rng = mulberry32(seed);
  const topology = topologyFor(cfg);
  let pSeed = fixed !== undefined ? fixed - separationFor(cfg) : seed;
  const stats = warriors.map((w) => ({ name: w.name, author: w.author, wins: 0, losses: 0, ties: 0, score: 0 }));
  const rounds = [];
  // P-space persists for the whole match, so warriors can adapt between rounds.
  const pspaces = warriors.map(() => VM.freshPSpace(cfg));
  for (let r = 0; r < cfg.rounds; r++) {
    const roundSeed = Math.floor(rng() * 2 ** 32);
    let positions;
    [positions, pSeed] = topology.place(warriors.length, pSeed);
    const res = runRound(warriors, cfg, {
      seed: roundSeed, positions, firstTurn: r % warriors.length, pspaces,
      report: report === true || report === r + 1,
      traceSize: traceRound === r + 1 ? traceSize : 0,
    });
    rounds.push({ round: r + 1, ...res });
    const points = roundPoints(warriors.length, res.survivors.length);
    stats.forEach((s, i) => {
      if (res.winner === i) { s.wins++; s.score += points; }
      else if (res.winner === null && res.survivors.includes(i)) { s.ties++; s.score += points; }
      else s.losses++;
    });
    onRound?.(rounds.at(-1), stats);
  }
  return { settings: cfg, seed, warriors: stats, rounds };
}

// Every pair of warriors plays a match; ranked by total score.
export function runTournament(warriors, settings = {}, { seed = 1, onMatch } = {}) {
  const table = warriors.map((w) => ({ name: w.name, author: w.author, wins: 0, losses: 0, ties: 0, score: 0, played: 0 }));
  const matches = [];
  for (let i = 0; i < warriors.length; i++) {
    for (let j = i + 1; j < warriors.length; j++) {
      const m = runMatch([warriors[i], warriors[j]], settings, { seed: seed + i * 1000 + j });
      [i, j].forEach((k, side) => {
        const s = m.warriors[side];
        table[k].wins += s.wins; table[k].losses += s.losses; table[k].ties += s.ties;
        table[k].score += s.score; table[k].played += m.rounds.length;
      });
      const entry = { a: warriors[i].name, b: warriors[j].name, result: m.warriors };
      matches.push(entry);
      onMatch?.(entry);
    }
  }
  const ranking = table
    .map((t) => ({ ...t, scorePerRound: t.played ? +(t.score / t.played).toFixed(3) : 0 }))
    .sort((x, y) => y.score - x.score);
  return { ranking, matches };
}
