import { strip } from '../../hill.js';

// Bump this when a checkpoint from an earlier search no longer reproduces it.
const VERSION = 1;

export function checkpointOptions(options) {
  const { pool, onPlace, onLog, onRound, geo, sources, kings, partners, exploitWin, exploitAge_, ...config } = options;
  return {
    ...config,
    exploitWin: Number.isFinite(exploitWin) ? exploitWin : String(exploitWin),
    exploitAge: exploitAge_,
    sources: sources.map(({ w, role }) => ({ w: strip(w), role })),
    kings: kings.map(strip),
    partners: partners.map(strip),
  };
}

export function instructionCheckpoint(options, state) {
  return { version: VERSION, representation: 'instructions', options, state };
}

export function readInstructionCheckpoint(checkpoint) {
  if (checkpoint?.version !== VERSION || checkpoint.representation !== 'instructions') {
    throw new Error('Unsupported instruction evolution checkpoint format');
  }
  const { options, state } = checkpoint;
  if (!options?.settings || !state || !Number.isSafeInteger(state.round) || state.round < 1 || state.round > options.rounds
    || !Number.isInteger(state.randomState) || state.randomState < 0 || state.randomState > 0xffffffff
    || state.history?.length !== state.round || !state.archive?.length || !state.credit || !state.stats
    || (options.objective === 'pushoff' && !state.fieldResults)
    || (options.league && !state.leagueArchive)
    || ![options.sources, options.opponents, options.heldOut, options.kings, options.partners,
      state.start, state.startingSources, state.history, state.archive, state.champions,
      state.exploiters, state.leagueExploiters, state.lineage].every(Array.isArray)) {
    throw new Error('Invalid instruction evolution checkpoint');
  }
  return { options: { ...options, exploitWin: Number(options.exploitWin) }, state };
}
