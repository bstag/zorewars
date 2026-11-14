// Reconstruct a deterministic replay privately before publishing it to the page.
import {VM} from '../src/engine/index.js';
import { prepareWasmLive } from './live.js';

export async function prepareReplay(settings,setup,end,cyclesBefore,{isCurrent,resetHighlights,loadWasmKernel,recording,onRecordedPlayback,clock=()=>performance.now(),yieldFrame=()=>new Promise(resolve=>setTimeout(resolve,0))}) {
  const vm = new VM(settings);
  vm.enableEvents();
  resetHighlights(vm.size);
  vm.load(setup.warriors, { positions: setup.positions, firstTurn: setup.firstTurn, pspaces: setup.pspaces.map((ps) => ps.slice()) });
  const target = Math.max(0, end - cyclesBefore);
  if (!isCurrent()) return null;
  const playback = recording?.seek(vm, target);
  if (!playback) {
    const attach = await prepareWasmLive(vm, loadWasmKernel);
    if (!isCurrent()) return null;
    attach?.();
  }
  let deadline = clock() + 4;
  while (!vm.done && vm.cycle < target) {
    const limit = Math.min(512, target - vm.cycle);
    if (playback) playback.advance(limit);
    else vm.run(limit);
    if (clock() >= deadline) {
      await yieldFrame();
      if (!isCurrent()) { playback?.close(); return null; }
      deadline = clock() + 4;
    }
  }
  if (!isCurrent()) { playback?.close(); return null; }
  if (playback) onRecordedPlayback?.(playback);
  return vm;
}
