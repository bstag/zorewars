import { fieldKey, fieldSettings, NO_HILL_RULES } from './battlefield.js';

const HILL_94X = { coreSize: 55440, maxProcesses: 10000, maxCycles: 500000, maxLength: 200, minDistance: 200 };
const SWITCH_NOTICE = 'Switching applies to every warrior in the arena.';

// Compile failures take priority over hill-size warnings. A completed library
// compatibility scan can also identify ring code that compiles but dies alone.
function battlefieldHint(compiled, settings, entry, fit) {
  const errors = compiled.errors ?? [];
  const home = entry?.battlefield;
  if ((settings.sizeZ ?? 1) < 2 && errors.some(e => /is for a 3D battlefield/.test(e.message))) {
    const field = home ?? 'torus:40x20x10';
    return { field, description: `This warrior is written for the 3D battlefield (${field.slice(6).replaceAll('x', '×')}, experimental).` };
  }
  if (home && home !== fieldKey(settings) && errors.length) {
    return { field: home, description: `This warrior is written for the ${home.slice(6).replaceAll('x', '×')} battlefield (experimental).` };
  }
  if (settings.topology === 'torus' && ((fit === false && !home) || errors.some(e => /half a row/.test(e.message)))) {
    return { field: 'ring', description: "This warrior is written for the classic ring and can't play on this battlefield." };
  }
  if (settings.topology !== 'torus' && errors.some(e => /is for a plane/.test(e.message))) {
    return { field: 'torus:100x80', description: 'This warrior is written for the plane battlefield (100×80, experimental).' };
  }
  return null;
}

// Archive originals express their core size with ;assert, or exceed the current
// code limit. Preserve custom settings unless the diagnostic calls for a change.
function limitsHint(compiled, current) {
  const core = compiled.warnings?.map(w => /CORESIZE\s*==\s*(\d+)/.exec(w.message)).find(Boolean);
  const len = compiled.errors?.map(e => /is (\d+) instructions long/.exec(e.message)).find(Boolean);
  if (!core && !len) return null;
  let settings = { ...current };
  if (core && +core[1] === 55440) settings = { ...settings, ...HILL_94X };
  else if (core) settings.coreSize = +core[1];
  if (len) settings.maxLength = Math.max(settings.maxLength, +len[1]);
  if (settings.coreSize === current.coreSize && settings.maxLength === current.maxLength) return null;
  const parts = [];
  if (settings.coreSize !== current.coreSize) parts.push(`core size ${settings.coreSize.toLocaleString()}`);
  if (settings.maxLength !== current.maxLength) parts.push(`max length ${settings.maxLength}`);
  return { settings, text: `This warrior was written for different rules (${parts.join(', ')}). ${SWITCH_NOTICE}` };
}

// fit is the active entry's completed compatibility result (undefined while
// scanning). The caller supplies browser state; this model has no DOM effects.
export function rulesHint(compiled, { settings, entry, fit }) {
  if (!compiled) return null;
  const hint = battlefieldHint(compiled, settings, entry, fit);
  if (!hint) return limitsHint(compiled, settings);
  const geometry = fieldSettings(hint.field);
  return {
    settings: { ...settings, ...NO_HILL_RULES, ...geometry, ...(hint.field === 'ring' ? { coreSize: 8000 } : {}) },
    text: `${hint.description} ${SWITCH_NOTICE}`,
  };
}
