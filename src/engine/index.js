// Public entry point for the ZoreWars engine (browser and Node).

import { assemble, listing } from './assembler.js';
import { generateFromJS } from './generator.js';
import { DEFAULT_SETTINGS } from './constants.js';

export * from './constants.js';
export { VM } from './vm.js';
export { assemble, listing } from './assembler.js';
export { createGenerator, generateFromJS } from './generator.js';
export { runRound, runMatch, runTournament, smoothPoints, WIN_POINTS, TIE_POINTS } from './battle.js';
export { topologyFor, ringTopology } from './topology.js';
export { mulberry32, pmarsRng } from './random.js';
export { postMortem, formatPostMortem, diagnoseRounds } from './report.js';
export { measureSpecies, speciesAxes, speciesHint } from './species.js';

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
