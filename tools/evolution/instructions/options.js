// Defaults, supported combinations and entry limits for instruction search.
import { DEFAULT_SETTINGS } from '../../../src/engine/index.js';
import { makeGeometry } from '../../../src/engine/geometry.js';
import { MAXLEN } from '../../genes.js';

// Shared by CLI parsing and programmatic search; field-dependent checks remain
// in instructionOptions, after the caller has loaded its opponents.
export function validateInstructionSearch({ algorithm, selection, epsilon, descriptor,
  localSteps, race, objective, tieValue, league, scratch, exploitWin, exploitAge }) {
  if (!['map-elites', 'ga'].includes(algorithm)) throw new Error('algorithm must be map-elites or ga');
  if (!['default', 'lexicase'].includes(selection)) throw new Error('selection must be default or lexicase');
  if (epsilon !== 'auto' && (!Number.isFinite(epsilon) || epsilon < 0)) throw new Error('epsilon must be auto or a nonnegative number');
  if (!['species', 'outcomes'].includes(descriptor)) throw new Error('descriptor must be species or outcomes');
  if (descriptor === 'outcomes' && (algorithm !== 'map-elites' || scratch)) throw new Error('outcome niches need map-elites with a fixed opponent field, not scratch');
  if (!Number.isInteger(localSteps) || localSteps < 0) throw new Error('localSteps must be a nonnegative integer');
  if (!Number.isInteger(race) || race < 0 || race > 6) throw new Error('race must be an integer from 0 to 6');
  if (race && (algorithm !== 'map-elites' || descriptor !== 'species')) throw new Error('racing needs map-elites with species niches');
  if (!['smooth', 'points', 'pushoff'].includes(objective)) throw new Error('objective must be smooth, points or pushoff');
  if (!Number.isFinite(tieValue) || tieValue < 0 || tieValue > 1) throw new Error('tieValue must be from 0 to 1');
  if (league && (scratch || descriptor !== 'species')) throw new Error('league needs species niches and a gene pool: not with scratch or outcome niches');
  if (league && (typeof exploitWin !== 'number' || Number.isNaN(exploitWin) || !Number.isInteger(exploitAge) || exploitAge < 1)) throw new Error('exploitWin must be a number and exploitAge a positive integer');
}

export function instructionOptions({
  pool, sources, opponents, heldOut = [], settings, entrySettings = settings,
  rounds = 8, batches = 4, batchSize = 40, evalRounds = 6, maxLength = MAXLEN,
  kings = [],          // warriors that start as champions: generation 1 must already beat them
  scratch = false,     // from scratch: random programs, no gene pool, fitness only against champions
  tieValue = 0.5,      // what a tie with a champion is worth, as a share of a tie's points (0..1)
  seed = 1, algorithm = 'map-elites', objective = 'smooth', populationSize = batchSize,
  selection = 'default', epsilon = 'auto', descriptor = 'species', archiveSize = 64, localSteps = 0,
  partners = [],       // objective 'pushoff': our other entries, ranked beside each candidate
  fieldRounds = 50,    // objective 'pushoff': rounds a pair for the field's own round robin
  league = false,      // also breed exploiters and league exploiters (see above)
  exploitWin = 2,      // an exploiter champion this fit (points per round vs the main champion) has done its job: restart
  exploitAge: exploitAge_ = 6,      // ...and so has one that has bred this many generations without it
  race = 0,            // racing: how many times a would-be elite must win again with doubled rounds
  onPlace = () => {},  // called with (child, displaced elite or null) whenever a child takes a cell
  onLog = () => {}, onRound = () => {},
}) {
  settings = { ...DEFAULT_SETTINGS, ...settings };
  entrySettings = { ...DEFAULT_SETTINGS, ...entrySettings };
  for (const [key, n] of Object.entries({ rounds, batches, batchSize, evalRounds, maxLength, populationSize, fieldRounds, archiveSize })) {
    if (!Number.isInteger(n) || n < 1) throw new Error(`${key} must be a positive integer`);
  }
  if (!Number.isInteger(seed) || seed < 0 || seed > 2147483646) throw new Error('seed must be an integer from 0 to 2147483646');
  validateInstructionSearch({ algorithm, selection, epsilon, descriptor, localSteps, race,
    objective, tieValue, league, scratch, exploitWin, exploitAge: exploitAge_ });
  if (descriptor === 'outcomes' && !opponents.length) throw new Error('outcome niches need map-elites with a fixed opponent field, not scratch');
  if (objective === 'pushoff' && !opponents.length) throw new Error('objective pushoff needs opponents (a field to rank in)');
  const geo = settings.topology === 'torus' ? makeGeometry(settings) : null;
  maxLength = Math.min(maxLength, settings.maxLength, entrySettings.maxLength, geo?.maxCodeLength ?? Infinity);
  return { pool, sources, opponents, heldOut, settings, entrySettings, rounds, batches, batchSize, evalRounds,
    maxLength, kings, scratch, tieValue, seed, algorithm, objective, populationSize, selection, epsilon,
    descriptor, archiveSize, localSteps, partners, fieldRounds, league, exploitWin, exploitAge_, race,
    onPlace, onLog, onRound, geo };
}
