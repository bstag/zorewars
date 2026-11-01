import {DEFAULT_SETTINGS,RULESETS} from '../src/engine/index.js';
import {fieldSettings,fieldKey,battlefieldSettings,NO_HILL_RULES} from './battlefield.js';
// Configure a linked archive entry before considering saved or library slots.
export function initializeRemoteImport(params, {state,libraryEntry,makeSlot,applySettings,clearQuery}) {
  const remote = params.get('url');

  if (!remote) return null;
  {
    const vs = libraryEntry(params.get('vs')) ? params.get('vs') : 'dwarf.red';
    state.slots = [makeSlot(null), makeSlot(vs)];
    state.slots[0].source = `; Loading ${remote}…\n`;

    // &rules=94x-hill&length=201: the rules the original was written for
    // (pMARS needs warriors at least their length apart); otherwise the
    // classic ring.
    const rules = RULESETS[params.get('rules')];
    const length = parseInt(params.get('length'), 10) || 0;
    applySettings(rules
      ? { ...fieldSettings('ring'), ...NO_HILL_RULES, ...rules, rulesName: params.get('rules'), ...(length ? { maxLength: length, minDistance: Math.max(rules.minDistance, length) } : {}) }
      : { ...DEFAULT_SETTINGS, ...fieldSettings('ring'), ...NO_HILL_RULES });
    clearQuery();
  }
  return remote;
}

export function initializeLocalSlots(saved, requested, {state,libraryEntry,makeSlot,saveSlots,applySettings,clearQuery,maxSlots:MAX_SLOTS=4}) {
  if (requested.length) {
    if (requested.length === 1) requested.push(requested[0] === 'dwarf.red' ? 'imp.red' : 'dwarf.red');
    state.slots = requested.map((f) => makeSlot(f));
    saveSlots();
    clearQuery();
    // The first warrior's battlefield: a plane or 3D warrior opens on its own.
    const field = libraryEntry(requested[0]).battlefield ?? 'ring';
    if (fieldKey(state.settings) !== field || state.settings.rulesName || state.settings.dialect) applySettings(battlefieldSettings(field));
  } else if (Array.isArray(saved) && saved.length) {
    state.slots = saved.slice(0, MAX_SLOTS).map((s) => ({ ...makeSlot(null), ...s, compiled: null }));
  } else {
    state.slots = [makeSlot('dwarf.red'), makeSlot('mice.red')];
  }
}

