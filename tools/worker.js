// Worker thread for tools/hill.js: plays one match and sends back a summary.
import { parentPort, workerData } from 'node:worker_threads';
import { runMatch, runRound, VM, DEFAULT_SETTINGS, diagnoseRounds } from '../src/engine/index.js';
import { matchPlan, summarizeMatch } from '../src/engine/match.js';
import { createRingDuel } from '../src/engine/ring-duel.js';
import { createWasmRingKernel } from '../src/engine/ring-duel-wasm.js';
import { createNativeRingKernel } from './ring-duel-native.js';

const { native, wasmModule } = workerData;
const createKernel = native ? createNativeRingKernel() : wasmModule ? createWasmRingKernel(wasmModule) : null;

parentPort.on('message', ({ id, a, b, settings, seed, diagnose, details, roundOptions }) => {
  try {
    const task = { a, b, settings, seed, diagnose, details, roundOptions };
    const cfg = { ...DEFAULT_SETTINGS, ...settings };
    const duel = createKernel && createRingDuel(cfg, [a, b], createKernel, { diagnose });
    if (duel) {
      const rounds = matchPlan(task).map(({ positions, firstTurn }) => duel.round(positions, firstTurn));
      parentPort.postMessage({ id, ...summarizeMatch(task, rounds) });
      return;
    }
    const historyKernel = createKernel
      && createRingDuel(cfg, [a, b], createKernel) ? createKernel : undefined;
    if (details || roundOptions) {
      const pspaces = [VM.freshPSpace(cfg), VM.freshPSpace(cfg)];
      const rounds = matchPlan(task).map((options) => runRound([a, b], cfg, {
        ...options, pspaces, report: !!diagnose, createRingKernel: historyKernel,
      }));
      parentPort.postMessage({ id, ...summarizeMatch(task, rounds) });
      return;
    }
    const m = runMatch([a, b], settings, { seed, report: !!diagnose, createRingKernel: historyKernel });
    const me = m.warriors[0];
    parentPort.postMessage({
      id,
      w: me.wins, l: me.losses, t: me.ties, smooth: me.smooth,
      ...(diagnose ? { d: diagnoseRounds(m.rounds, 0) } : {}),
    });
  } catch (e) {
    parentPort.postMessage({ id, error: String(e.message || e) });
  }
});
