// Frame budgets and paused animation cadence; drawing remains with the page.
export function advanceFrame(state, stepVM) {
  const vm = state.vm;
  if (vm && state.running && !vm.done && !state.livePending) {
    state.carry += state.stepsPerFrame * vm.warriors.filter((w) => w.alive).length;
    const want = Math.floor(state.carry);
    state.carry -= want;
    if (want > 0) {
      const epoch = state.liveEpoch;
      stepVM(want, () => state.running && state.liveEpoch === epoch);
    }
  }
}
export function sceneNeedsDraw(state, highlightsActive, rendererAnimating, now) {
  if (state.dirtyFrame) state.sceneDirty = true;
  let scene = state.sceneDirty || highlightsActive || rendererAnimating;
  if (scene && !state.sceneDirty && !state.running && now - state.lastSceneDraw < 33) scene = false;
  return !!scene;
}
