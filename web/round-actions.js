// Async live-round ownership, cancellation and finish scheduling.
export function createRoundActions(state, {setStepDisabled,setFinishDisabled,checkDeaths,finishRound,sampleChart,updateCycle,stopRunning,onError,yieldFrame=()=>new Promise(resolve=>setTimeout(resolve,0)),now=()=>performance.now()}) {
// A live controller advances a bounded chunk per call, so a request for more
// than one chunk (a fast speed setting) repeats until it is met or the frame's
// time is used up. Infinity ("finish") takes one chunk; its caller loops.
const FRAME_BUDGET_MS = 12;
async function step(maxSteps, valid = () => true) {
  const vm = state.vm;
  const live = state.live;
  if (!vm || vm.done || !live) return 0;
  const token = { vm, live }; state.livePending = token; setStepDisabled(true);
  const deadline = now() + FRAME_BUDGET_MS;
  let total = 0;
  try {
    for (;;) {
      const n = await live.advance(maxSteps - total, { cancelled: () => state.vm !== vm || state.live !== live || !valid() });
      if (state.vm !== vm || state.live !== live) return 0;
      total += n;
      state.lastStep = live.lastStep;
      checkDeaths();
      if (!state.replaying && !vm.done) state.roundSetup?.recorder?.checkpoint();
      if (vm.done) finishRound();
      sampleChart(); updateCycle(); state.dirtyFrame = true;
      if (!n || vm.done || maxSteps === Infinity || total >= maxSteps || now() >= deadline) return total;
    }
  } catch (error) {
    if (state.vm === vm && state.live === live) { onError(error); }
    return 0;
  } finally {
    if (state.livePending === token) { state.livePending = null; setStepDisabled(false); }
  }
}
let finishing = null;
async function finish() {
  if (!state.vm || state.vm.done || finishing) return;
  stopRunning();
  const token = { vm: state.vm, live: state.live }; finishing = token;
  setFinishDisabled(true);
  try {
    while (finishing === token && state.vm === token.vm && state.live === token.live && !token.vm.done) {
      const n = await step(Infinity);
      if (!n) break;
      await yieldFrame();
    }
  } finally { if (finishing === token) { finishing = null; setFinishDisabled(false); } }
}

return {step,finish,cancelFinish(){finishing=null;}};
}
