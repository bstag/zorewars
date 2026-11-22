// Frame budgets and paused animation cadence; drawing remains with the page.
// stepsPerFrame is the speed at 60 frames a second; `now` (ms) scales it to the
// real frame time, so the arena runs at the same speed on a 144 Hz display.
const FRAME_MS = 1000 / 60;
export function advanceFrame(state, stepVM, now) {
  const vm = state.vm;
  const last = state.lastAdvance;
  state.lastAdvance = now;
  if (vm && state.running && !vm.done && !state.livePending) {
    // Without a clock (or after a pause) count one nominal frame; a long gap
    // (a background tab) must not turn into one enormous burst.
    const frames = now === undefined || last === undefined ? 1 : Math.min(Math.max(now - last, 0) / FRAME_MS, 4);
    state.carry += state.stepsPerFrame * frames * vm.warriors.filter((w) => w.alive).length;
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
