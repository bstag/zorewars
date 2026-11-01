// Instruction-search CLI counts and policy validation, before opponents or pools load.
import {validateInstructionSearch} from '../tools/evolution/instructions/options.js';
export function evolutionOptions(args,h,settings) {
  const integer = (key, fallback, min = 1) => {
    const n = Number(args.flags[key] ?? fallback);
    if (!Number.isSafeInteger(n) || n < min) h.usage(`--${key} must be an integer >= ${min}`);
    return n;
  };
  const generations = integer('generations', 6);
  const batches = integer('batches', 4);
  const batchSize = integer('batch', 40);
  const seed = integer('seed', 1, 0);
  if (seed > 2147483646) h.usage('--seed must be <= 2147483646');
  const algorithm = args.flags.algorithm ?? 'map-elites';
  const objective = args.flags.objective ?? 'smooth';
  const selection = args.flags.selection ?? 'default';
  const descriptor = args.flags.descriptor ?? 'species';
  const epsilon = args.flags.epsilon === undefined || args.flags.epsilon === 'auto' ? 'auto' : Number(args.flags.epsilon);
  if (objective === 'pushoff' && args.flags.scratch) h.usage('--objective pushoff ranks against a field: not with --scratch');
  const tieValue = Number(args.flags.ties ?? 0.5);
  const evalRounds = integer('eval-rounds', args.flags.rounds ?? 6);
  const populationSize = integer('population', batchSize);
  const archiveSize = integer('archive-size', 64);
  const localSteps = integer('local-steps', 0, 0);
  const checkRounds = integer('check-rounds', 30);
  const seeds = integer('seeds', 3, 2);
  const finalists = integer('finalists', 6);
  const out = args.flags.out ?? 'evolved';
  // Gene pool and starting opponents: the library, plus any warriors given.
  // --scratch: none of that. Random programs, scored only against each
  // other's champions; the library is only held out, to report progress.
  const scratch = !!args.flags.scratch;
  const fieldRounds = integer('field-rounds', 50);
  const league = !!args.flags.league;
  const exploitWin = Number(args.flags['exploit-win'] ?? 2);
  if (!Number.isFinite(exploitWin)) h.usage('--exploit-win takes a number of points per round');
  const exploitAge = integer('exploit-age', 6);
  const race = integer('race', 0, 0);
  const maxLength = Math.min(settings.maxLength, integer('genome', 40));
  try {
    validateInstructionSearch({ algorithm, selection, epsilon, descriptor, localSteps, race,
      objective, tieValue, league, scratch, exploitWin, exploitAge });
  } catch (error) { h.usage(error.message); }
  return {generations, batches, batchSize, seed, algorithm, objective, selection, descriptor, epsilon, tieValue, evalRounds, populationSize, archiveSize, localSteps, checkRounds, seeds, finalists, out, scratch, fieldRounds, league, exploitWin, exploitAge, race, maxLength};
}
