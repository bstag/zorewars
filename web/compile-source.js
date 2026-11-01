// Generator execution and persisted hang markers; callers decide whether a result is current.
export async function compileSource(source, language, {compile,pythonReady,loadPython,generateFromPython,generating,getSettings,hung,onPythonLoading}) {
  let result;
  const generator = language !== 'redcode';

  try {
    if (hung) {
      throw new Error("This warrior's code didn't finish running last time (an endless loop?), so it wasn't run again. Edit it to try again.");
    }
    if (language === 'python') {
      if (!pythonReady()) {
        onPythonLoading();
      }
      await loadPython();             // a slow download is not a hang
      generating(source, true);
      const redcode = await generateFromPython(source, getSettings());
      generating(source, false);
      result = compile(redcode, 'redcode', getSettings());
    } else {
      if (generator) generating(source, true);
      result = compile(source, language, getSettings());
      if (generator) generating(source, false);
    }
  } catch (e) {
    if (generator && !hung) generating(source, false);
    const msg = String(e.message || e).split('\n').filter(Boolean).slice(-3).join('\n');
    result = { ok: false, errors: [{ line: 0, message: msg }], warnings: [], instructions: [] };
  }
  return result;
}

export function canStartEditedRound(state) {
  return !state.booting && (!state.vm || state.vm.steps === 0 || state.vm.done)
    && state.slots.every(slot => slot.status !== 'compiling');
}

export function publishCompilation(slot,token,result) {
  if (token !== slot.token) return false; // superseded by a newer edit
  if (result.ok && result.name === 'Unnamed' && slot.origin?.name) result.name = slot.origin.name;
  slot.compiled = result;
  slot.status = result.ok ? 'ok' : 'error';
  slot.statusText = '';
  return true;
}
