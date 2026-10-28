// Deterministic round plans and summaries shared by CPU and GPU match hosts.
import { DEFAULT_SETTINGS } from './constants.js';
import { mulberry32 } from './random.js';
import { topologyFor } from './topology.js';
import { smoothPoints } from './battle.js';
import { diagnoseRounds } from './report.js';

export function matchPlan(task) {
  const settings = { ...DEFAULT_SETTINGS, ...task.settings };
  if (!Number.isSafeInteger(settings.rounds) || settings.rounds < 1) throw new Error('rounds must be a positive integer');
  const topology = topologyFor(settings), random = mulberry32(task.seed ?? 1);
  if (task.roundOptions && task.roundOptions.length !== settings.rounds) throw new Error('roundOptions must contain one entry per round');
  const rounds = [];
  let placementSeed = task.seed ?? 1;
  for (let r = 0; r < settings.rounds; r++) {
    const options = task.roundOptions?.[r];
    const seed = options?.seed ?? Math.floor(random() * 2 ** 32);
    let positions;
    if (options) {
      const loadSeed = 1 + Math.floor(mulberry32(seed)() * 2147483645);
      positions = options.positions ?? topology.place(2, loadSeed)[0];
    } else [positions, placementSeed] = topology.place(2, placementSeed);
    const firstTurn = options?.firstTurn ?? r % 2;
    if (positions.length !== 2 || positions.some((p) => !Number.isInteger(p) || p < 0 || p >= settings.coreSize)
      || ![0, 1].includes(firstTurn)) throw new Error('invalid two-warrior round positions or first mover');
    rounds.push({ seed, positions: [...positions], firstTurn });
  }
  return rounds;
}

export function summarizeMatch(task, rounds) {
  const settings = { ...DEFAULT_SETTINGS, ...task.settings };
  const sides = [0, 1].map(() => ({ w: 0, l: 0, t: 0, smooth: 0 }));
  const d = { suicide: 0, converted: 0, early: 0, late: 0, tie: 0 };
  for (const round of rounds) {
    sides.forEach((s, i) => {
      if (round.winner === i) s.w++;
      else if (round.winner === null && round.survivors.includes(i)) s.t++;
      else s.l++;
      const points = round.winner === null ? 1 : 3;
      s.smooth = +(s.smooth + smoothPoints(round, i, points, settings.maxCycles)).toFixed(4);
    });
    if (task.diagnose && round.winner !== 0) {
      if (round.diagnostic) d[round.diagnostic]++;
      else {
        const diagnosed = diagnoseRounds([round]);
        for (const key in d) d[key] += diagnosed[key];
      }
    }
  }
  return { ...sides[0], ...(task.diagnose ? { d } : {}), ...(task.details ? {
    opponent: sides[1], rounds: rounds.map(({ diagnostic, report, ...round }) => round),
  } : {}) };
}
