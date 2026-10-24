// Worker thread for tools/pool.js: plays one match and sends back a summary.
import { parentPort } from 'node:worker_threads';
import { runMatch, diagnoseRounds } from '../src/engine/index.js';

parentPort.on('message', ({ id, a, b, settings, seed, diagnose }) => {
  try {
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
