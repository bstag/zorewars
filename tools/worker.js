// Worker thread for tools/pool.js: plays one match and sends back a summary.
import { parentPort } from 'node:worker_threads';
import { runMatch, runRound, VM, DEFAULT_SETTINGS, diagnoseRounds } from '../src/engine/index.js';
import { matchPlan, summarizeMatch } from '../src/engine/match.js';

parentPort.on('message', ({ id, a, b, settings, seed, diagnose, details, roundOptions }) => {
  try {
    if (details || roundOptions) {
      const task = { a, b, settings, seed, diagnose, details, roundOptions };
      const cfg = { ...DEFAULT_SETTINGS, ...settings }, pspaces = [VM.freshPSpace(cfg), VM.freshPSpace(cfg)];
      const rounds = matchPlan(task).map((options) => runRound([a, b], cfg, { ...options, pspaces, report: !!diagnose }));
      parentPort.postMessage({ id, ...summarizeMatch(task, rounds) });
      return;
    }
    const m = runMatch([a, b], settings, { seed, report: !!diagnose });
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
