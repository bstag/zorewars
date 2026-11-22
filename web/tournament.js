// The Tournament card: many rounds between the warriors in the editor.
import { VM, mulberry32, roundPoints } from '../src/engine/index.js';
import { WARRIOR_COLORS } from './arena.js';
import { escapeHtml } from './editor-status.js';
import { createSimulationRunner } from './simulation.js';
import { createBrowserMatchPool } from './matches.js';

// pMARS scoring: each survivor of a round scores (W*W-1)/S.
export function scoreRound(stats, res) {
  const points = roundPoints(stats.length, res.survivors.length);
  stats.forEach((s, k) => {
    if (res.winner === k) { s.wins++; s.score += points; }
    else if (res.winner === null && res.survivors.includes(k)) { s.ties++; s.score += points; }
    else s.losses++;
  });
}

// Starts a tournament, or stops the one that is running.
export function runTournament(state, $) {
  if (state.tournament) { state.tournament.cancel = true; state.tournament.pool?.close(); return; }
  const roster = state.slots.map((s, i) => (s.compiled?.ok ? i : -1)).filter((i) => i >= 0);
  if (roster.length < 2) { $('tourResults').innerHTML = '<p class="muted small">Need at least two working warriors.</p>'; return; }
  const rounds = Math.max(1, Math.min(1000, parseInt($('tourRounds').value, 10) || 50));
  const warriors = roster.map((i) => state.slots[i].compiled);
  const stats = warriors.map((w) => ({ name: w.name, wins: 0, losses: 0, ties: 0, score: 0 }));
  const rng = mulberry32((Math.random() * 2 ** 32) >>> 0);
  const settings = { ...state.settings };   // the rules the warriors were compiled for
  const pspaces = warriors.map(() => VM.freshPSpace(settings));
  const t = { cancel: false, done: 0 };
  state.tournament = t;
  const runner = createSimulationRunner({ cancelled: () => t.cancel });
  $('tourBtn').textContent = 'Stop';
  $('tourBar').style.width = '0%';
  $('tourResults').innerHTML = '<p class="muted small">Starting…</p>';

  const render = () => {
    const rows = stats.map((s, k) => ({ ...s, k })).sort((a, b) => b.score - a.score);
    $('tourResults').innerHTML = `<table class="results"><thead><tr><th>Warrior</th><th>W</th><th>L</th><th>T</th><th>Pts</th></tr></thead><tbody>${
      rows.map((s) => `<tr><td class="name"><span class="dot" style="background:${WARRIOR_COLORS[roster[s.k]]}"></span>${escapeHtml(s.name)}</td><td>${s.wins}</td><td>${s.losses}</td><td>${s.ties}</td><td>${s.score}</td></tr>`).join('')
    }</tbody></table><p class="muted small">${t.done} / ${rounds} rounds · each survivor scores (W²−1)/S, as in pMARS</p>`;
    $('tourBar').style.width = `${(t.done / rounds) * 100}%`;
  };

  const stop = () => {
    t.pool?.close();
    if (state.tournament === t) {
      state.tournament = null; $('tourBtn').textContent = 'Run';
      if (t.cancel) $('tourResults').insertAdjacentHTML('beforeend', '<p class="muted small">Stopped.</p>');
    }
  };
  // The shared GPU kernel owns two-warrior matches. Multiplayer rounds keep
  // using the yielding CPU runner, with their existing scoring and P-space.
  if (warriors.length === 2) {
    const cancelled = () => t.cancel || state.tournament !== t;
    (async () => {
      try {
        const pool = t.pool = await createBrowserMatchPool({ cancelled });
        $('tourResults').innerHTML = `<p class="muted small">Running ${rounds} rounds on ${pool.backend.toUpperCase()}…</p>`;
        const plan = Array.from({ length: rounds }, (_, r) => ({ seed: Math.floor(rng() * 2 ** 32), firstTurn: r % 2 }));
        // In batches, so the table and the bar fill in as it goes and Stop
        // keeps what was played. P-space lives inside one match, so those
        // rules still play as a single batch.
        const batch = settings.pSpace ? rounds : 25;
        for (let at = 0; at < rounds; at += batch) {
          const roundOptions = plan.slice(at, at + batch);
          const result = await pool.match({ a: warriors[0], b: warriors[1], settings: { ...settings, rounds: roundOptions.length }, details: true, roundOptions });
          if (cancelled()) return;
          for (const res of result.rounds) scoreRound(stats, res);
          t.done += result.rounds.length; render();
        }
        $('tourResults').insertAdjacentHTML('beforeend', `<p class="muted small">${pool.backend.toUpperCase()}</p>`);
      } catch (error) {
        if (!cancelled()) $('tourResults').innerHTML = `<p class="muted small">Stopped: ${escapeHtml(error.message)}</p>`;
      } finally { stop(); }
    })();
    return;
  }
  const next = async () => {
    const t0 = performance.now();
    try {
      await playSlice(t0);
    } catch (e) {
      stop();
      $('tourResults').insertAdjacentHTML('beforeend', `<p class="muted small">Stopped: ${escapeHtml(e.message)}</p>`);
      return;
    }
    render();
    if (t.done < rounds && !t.cancel) setTimeout(next, 0);
    else stop();
  };
  const playSlice = async (t0) => {
    while (t.done < rounds && !t.cancel && performance.now() - t0 < 40) {
      const res = await runner.round(warriors, settings, { seed: Math.floor(rng() * 2 ** 32), firstTurn: t.done % warriors.length, pspaces });
      if (!res) break;
      scoreRound(stats, res);
      t.done++;
    }
  };
  next();
}
