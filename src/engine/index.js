// Public entry point for the ZoreWars engine (browser and Node).

import { assemble, listing } from './assembler.js';
import { generateFromJS } from './generator.js';
import { DEFAULT_SETTINGS } from './constants.js';
import { measureSpecies } from './species.js';

export * from './constants.js';
export { VM } from './vm.js';
export { assemble, listing } from './assembler.js';
export { createGenerator, generateFromJS } from './generator.js';
export { runRound, runMatch, runTournament, smoothPoints, WIN_POINTS, TIE_POINTS } from './battle.js';
export { topologyFor, ringTopology } from './topology.js';
export { mulberry32, pmarsRng } from './random.js';
export { postMortem, formatPostMortem, diagnoseRounds } from './report.js';
export { measureSpecies, speciesAxes, speciesHint } from './species.js';

// Which library entries (warriors/index.json) take part on a battlefield, in
// benchmarks, ladders, species maps and the CLI's developer tools. On the
// classic ring: the benchmark set. On a torus: that set plus the warriors
// written for the plane ("battlefield" in the index). Python entries and
// conversions are left out: they duplicate other entries.
export function inLibraryFor(entry, settings = {}) {
  if (entry.language !== 'redcode' && entry.language !== 'javascript') return false;
  if (entry.convertedFrom) return false;
  if (settings.topology === 'torus') return entry.benchmark !== false || !!entry.battlefield;
  return entry.benchmark !== false && !entry.battlefield;
}

// Whether a compiled warrior can play on a battlefield: it compiled there
// and, on a torus, doesn't destroy itself when run alone (warriors written
// for the ring often compute constants with ring arithmetic). Used to filter
// the arena's library list and the CLI's list.
export function fitsBattlefield(compiled, settings = {}) {
  if (!compiled?.ok) return false;
  if (settings.topology !== 'torus') return true;
  return measureSpecies(compiled, { ...DEFAULT_SETTINGS, ...settings }).survives;
}

// Compile warrior source in any in-process language to a loadable program.
// language: 'redcode' | 'javascript'. (Python and C++ produce Redcode first,
// in Pyodide or via the CLI, and are then compiled as 'redcode'.)
export function compile(source, language = 'redcode', settings = {}) {
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  let redcode = source;
  if (language === 'javascript') {
    try {
      redcode = generateFromJS(source, cfg);
    } catch (e) {
      return { ok: false, errors: [{ line: 0, message: `JavaScript error: ${e.message}` }], warnings: [], instructions: [], redcode: '' };
    }
  }
  const result = assemble(redcode, cfg);
  result.redcode = redcode;
  result.listing = result.ok ? listing(result, cfg) : '';
  return result;
}

export function detectLanguage(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  return {
    red: 'redcode', rc: 'redcode', txt: 'redcode',
    js: 'javascript', mjs: 'javascript',
    py: 'python',
    cpp: 'cpp', cc: 'cpp', cxx: 'cpp',
  }[ext] || 'redcode';
}
