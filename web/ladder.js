// Ladder (king of the hill) and species map cards for the arena's side panel.
//
// Ladder: a hill of up to LADDER_SIZE warriors, kept in this browser. A
// challenger plays every warrior on it; if it ranks in the top LADDER_SIZE it
// stays and the bottom warrior drops off. Every warrior on the hill has had to
// beat the ones that were there before it (the "Red Queen" idea from Digital
// Red Queen, Sakana AI / MIT). Ranked by points per round, then smooth score,
// or by the Core War Tournament Weekend's diversity push-off (pushOff): a
// warrior that wins its own way outranks a stronger one that has a twin.
//
// Species map: where warriors sit by behaviour, measured alone in the core
// (src/engine/species.js), with the library for comparison.

import { compile, mulberry32, roundPoints, smoothPoints, speciesAxes, speciesHint, inLibraryFor, pushOff } from '../src/engine/index.js';
import { WARRIOR_COLORS } from './arena.js';
import { createSimulationRunner } from './simulation.js';
import { createBrowserMatchPool } from './matches.js';

const LADDER_KEY = 'zorewars.ladder.v1';
const LADDER_SIZE = 10;
const LADDER_START = ['gatekeeper.js', 'bandit.js', 'chameleon.js', 'evolvedsilk.red', 'blitz.js', 'papercut.js', 'silk.red', 'oneshot.red'];
// On a plane: warriors written for it, and classic ones that do well there.
const LADDER_START_PLANE = ['plane/planequeen.red', 'plane/planesilk.js', 'plane/raster.js', 'plane/pillar.js', 'twopass.red', 'papercut.js', 'fastsilk.js', 'mice.red'];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rulesKey = (s) => [s.topology ?? 'ring', s.sizeX, s.sizeY, s.sizeZ, s.coreSize, s.maxCycles, s.maxProcesses, s.maxLength, s.minDistance, s.dialect, s.pSpace].join('/');
function safeGet(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function safeSet(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } }
const plural = (n, one, many) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36); };

// ctx: { library(), slots(), activeSlot(), settings() }
export function initLadder(ctx) {
  let ladder = null;
  let job = null;          // the match runner currently going, if any

  const compileMember = (m) => {
    m.compiled ??= compile(m.source, m.language, ctx.settings());
    return m.compiled;
  };
  const key = (a, b) => `${a}|${b}`;
  const result = (a, b) => ladder.results[key(a, b)];

  function load() {
    const saved = safeGet(LADDER_KEY);
    if (saved && saved.rules === rulesKey(ctx.settings()) && Array.isArray(saved.members)) return saved;
    const lib = ctx.library();
    // Under ICWS'88 rules: the library's '88 warriors.
    const start = ctx.settings().dialect === '88' ? lib.filter((e) => inLibraryFor(e, ctx.settings())).map((e) => e.file)
      : ctx.settings().topology === 'torus' ? LADDER_START_PLANE : LADDER_START;
    const members = start.map((f) => lib.find((e) => e.file === f)).filter(Boolean)
      .map((e) => ({ id: `lib:${e.file}`, name: e.name, language: e.language, source: e.source, origin: 'library', age: 0 }));
    return { rules: rulesKey(ctx.settings()), members, results: {} };
  }
  const save = () => safeSet(LADDER_KEY, { ...ladder, members: ladder.members.map(({ compiled, ...m }) => m) });

  function standings() {
    return ladder.members.map((m) => {
      let pts = 0, smooth = 0, n = 0, w = 0, l = 0, t = 0;
      for (const o of ladder.members) {
        if (o === m) continue;
        const r = result(m.id, o.id);
        if (!r) continue;
        pts += (3 * r.w + r.t) / r.rounds; smooth += r.smooth / r.rounds; n++;
        w += r.w; l += r.l; t += r.t;
      }
      return { m, pts: n ? pts / n : 0, smooth: n ? smooth / n : 0, w, l, t, n };
    }).sort((a, b) => b.pts - a.pts || b.smooth - a.smooth);
  }
  // The same rows in push-off order, each with its diversity and push-off
  // score. Members that haven't played everyone yet go last, unranked.
  const pushoffMode = () => $('ladderRank').value === 'pushoff';
  function ranked() {
    const rows = standings();
    if (!pushoffMode()) return rows;
    const full = rows.filter((r) => r.n === rows.length - 1);
    if (full.length < 3) return rows;
    const scores = full.map((a) => full.map((b) => { const r = a === b ? null : result(a.m.id, b.m.id); return r ? (3 * r.w + r.t) / r.rounds : 0; }));
    const order = pushOff(scores, full.map((r) => r.m.name));
    return [...order.map((o) => ({ ...full[o.index], div: o.div, score: o.score })), ...rows.filter((r) => !full.includes(r))];
  }

  function render(status) {
    if (status !== undefined) $('ladderStatus').innerHTML = status;
    const rows = ranked();
    const po = pushoffMode();
    const extra = po
      ? '<th title="SD-score to the most similar warrior: how differently it wins and loses">Div</th><th title="Push-off score: points per round × diversity, when it was pushed off">Score</th>'
      : '<th title="Smooth score: a loss counts the share of the round survived">Smooth</th>';
    const cells = (r) => (po
      ? `<td>${r.div !== undefined ? r.div.toFixed(2) : '…'}</td><td>${r.score !== undefined ? r.score.toFixed(2) : '…'}</td>`
      : `<td>${r.n ? r.smooth.toFixed(2) : '…'}</td>`);
    $('ladderTable').innerHTML = `<table class="results ladder"><thead><tr><th>#</th><th>Warrior</th><th title="Points per round against the rest of the ladder (win 3, tie 1)">Pts</th>${extra}<th title="Challenges survived since joining">Age</th></tr></thead><tbody>${
      rows.map((r, i) => `<tr${r.m.origin === 'you' ? ' class="you"' : ''} title="${r.w} wins, ${r.l} losses, ${r.t} ties"><td>${i + 1}</td><td class="name">${r.m.origin === 'you' ? '<span class="dot" style="background:var(--accent)"></span>' : ''}${esc(r.m.name)}</td><td>${r.n ? r.pts.toFixed(2) : '…'}</td>${cells(r)}<td>${r.m.age}</td></tr>`).join('')
    }</tbody></table>`;
    const slot = ctx.activeSlot();
    const name = slot?.compiled?.ok ? slot.compiled.name : null;
    $('ladderChallenge').textContent = job ? 'Stop' : name ? `Challenge with ${name}` : 'Challenge';
    $('ladderChallenge').disabled = !job && !name;
  }

  // Submit independent matches together. Each match keeps its own sequential
  // P-space rounds; results retain the browser's existing placement seeds.
  function play(pairs, rounds, onDone) {
    const settings = { ...ctx.settings() };
    const rng = mulberry32((Math.random() * 2 ** 32) >>> 0);
    const total = pairs.length * rounds;
    let done = 0;
    const ownJob = { cancel: false, pool: null };
    job = ownJob;
    const cancelled = () => job !== ownJob || ownJob.cancel || rulesKey(ctx.settings()) !== rulesKey(settings);
    render();
    const run = async () => {
      try {
        const pool = ownJob.pool = await createBrowserMatchPool({ cancelled });
        const badge = $('ladderBackend');
        const showBackend = () => { if (badge) { badge.textContent = pool.backend.toUpperCase(); badge.title = pool.stats.fallbackReason ?? ''; } };
        showBackend();
        const tasks = pairs.map(([a, b]) => ({ a: compileMember(a), b: compileMember(b), settings: { ...settings, rounds }, details: true,
          roundOptions: Array.from({ length: rounds }, (_, r) => ({ seed: Math.floor(rng() * 2 ** 32), firstTurn: r % 2 })) }));
        await Promise.all(tasks.map(async (task, i) => {
          const result = await pool.match(task);
          if (cancelled()) return;
          const [a, b] = pairs[i];
          const smooth = (side) => result.rounds.reduce((sum, r) => sum + smoothPoints(r, side, roundPoints(2, r.survivors.length), settings.maxCycles), 0);
          ladder.results[key(a.id, b.id)] = { w: result.w, l: result.l, t: result.t, smooth: smooth(0), rounds };
          ladder.results[key(b.id, a.id)] = { w: result.l, l: result.w, t: result.t, smooth: smooth(1), rounds };
          done += rounds;
          $('ladderBar').style.width = `${(done / total) * 100}%`;
          showBackend();
        }));
      } catch (error) {
        if (!cancelled()) {
          ownJob.cancel = true;
          ownJob.error = error.message;
        }
      } finally { ownJob.pool?.close(); }
      if (job !== ownJob) return;
      job = null;
      if (rulesKey(ctx.settings()) !== rulesKey(settings)) {
        ladder = load(); render('The rules changed: setting the ladder up again for them…'); fillGaps(); return;
      }
      save(); onDone(ownJob.cancel);
      if (ownJob.error) render(`Stopped: ${esc(ownJob.error)}`);
    };
    run();
  }

  const roundsWanted = () => Math.max(2, Math.min(200, parseInt($('ladderRounds').value, 10) || 20));

  // Matches between members that have never played (a fresh ladder, or a reset).
  function fillGaps(then) {
    const pairs = [];
    for (let i = 0; i < ladder.members.length; i++) for (let j = i + 1; j < ladder.members.length; j++) {
      const a = ladder.members[i], b = ladder.members[j];
      if (!result(a.id, b.id) && compileMember(a).ok && compileMember(b).ok) pairs.push([a, b]);
    }
    if (!pairs.length) { then?.(); return; }
    render('Setting up the ladder: the starting warriors play each other…');
    play(pairs, roundsWanted(), (cancelled) => { render(cancelled ? 'Stopped.' : ''); if (!cancelled) then?.(); });
  }

  function challenge() {
    if (job) { job.cancel = true; job.pool?.close(); return; }
    const slot = ctx.activeSlot();
    if (!slot?.compiled?.ok) return;
    const w = slot.compiled;
    const id = `you:${hash(slot.language + '\n' + slot.source)}`;
    if (ladder.members.some((m) => m.id === id)) { render(`${esc(w.name)} is already on the ladder, unchanged.`); return; }
    fillGaps(() => {
      // An earlier version of the same warrior steps aside for the new one.
      const old = ladder.members.find((m) => m.origin === 'you' && m.name === w.name);
      if (old) removeMember(old);
      const me = { id, name: w.name, language: slot.language, source: slot.source, origin: 'you', age: 0, compiled: w };
      const pairs = ladder.members.filter((m) => compileMember(m).ok).map((m) => [me, m]);
      render(`${esc(w.name)} is playing ${pairs.length} warriors…`);
      ladder.members.push(me);
      play(pairs, roundsWanted(), (cancelled) => {
        if (cancelled) { removeMember(me); save(); render('Challenge stopped.'); return; }
        const rows = ranked();
        const place = rows.findIndex((r) => r.m === me) + 1;
        let msg;
        if (rows.length > LADDER_SIZE) {
          const out = rows.at(-1).m;
          removeMember(out);
          msg = out === me
            ? `${esc(w.name)} finished last (#${place}) and didn't make the ladder.`
            : `${esc(w.name)} is in at #${place}. ${esc(out.name)} dropped off the ladder.`;
        } else msg = `${esc(w.name)} is in at #${place}.`;
        for (const m of ladder.members) if (m !== me) m.age++;
        if (place === 1 && ladder.members.includes(me)) msg = `${esc(w.name)} is the new king of the hill!`;
        save();
        render(msg);
      });
    });
  }

  function removeMember(m) {
    ladder.members = ladder.members.filter((x) => x !== m);
    for (const k of Object.keys(ladder.results)) if (k.startsWith(`${m.id}|`) || k.endsWith(`|${m.id}`)) delete ladder.results[k];
  }

  function reset() {
    if (job) return;
    try { localStorage.removeItem(LADDER_KEY); } catch { /* storage unavailable */ }
    ladder = load();
    render('');
    fillGaps();
  }

  $('ladderChallenge').addEventListener('click', challenge);
  $('ladderReset').addEventListener('click', reset);
  $('ladderRank').addEventListener('change', () => { if (ladder) render(); });
  // The ladder is set up the first time the card is opened.
  $('ladderCard').addEventListener('toggle', () => {
    if (!$('ladderCard').open) return;
    if (!ladder || ladder.rules !== rulesKey(ctx.settings())) ladder = load();
    render();
    if (!job) fillGaps();
  });
  return {
    refresh: () => {
      if (job && ladder.rules !== rulesKey(ctx.settings())) { job.cancel = true; job.pool?.close(); }
      if (!ladder || !$('ladderCard').open) return;
      if (!job && ladder.rules !== rulesKey(ctx.settings())) { ladder = load(); render(''); fillGaps(); return; }
      render();
    },
  };
}

export function initSpecies(ctx) {
  let libCache = { rules: null, rows: [] };
  let measuring = null;
  let ownJob = null;
  let ownRows = [];
  let selected = null;
  const ownCache = new WeakMap();
  async function measureOwn() {
    const settings = ctx.settings(), rules = rulesKey(settings);
    const task = {};
    ownJob = task;
    const runner = createSimulationRunner({ cancelled: () => ownJob !== task || rulesKey(ctx.settings()) !== rules });
    const rows = [];
    for (const [k, slot] of ctx.slots().entries()) {
      const compiled = slot.compiled;
      if (!compiled?.ok) continue;
      let result = ownCache.get(compiled);
      try {
        if (result?.rules !== rules) {
          const measured = await runner.species(compiled, settings);
          if (!measured) return;
          result = { rules, measured };
          ownCache.set(compiled, result);
        }
      } catch { continue; }
      rows.push({ compiled, k, rules, name: compiled.name, color: WARRIOR_COLORS[k], ...result.measured });
    }
    if (ownJob !== task || rulesKey(ctx.settings()) !== rules) return;
    ownJob = null;
    ownRows = rows;
    render();
  }

  async function measureLibrary(then) {
    const settings = ctx.settings();
    const rules = rulesKey(settings);
    if (libCache.rules === rules) { measuring = null; then(); return; }
    if (measuring?.rules === rules) return;
    const task = { rules };
    measuring = task;
    const runner = createSimulationRunner({ cancelled: () => measuring !== task || rulesKey(ctx.settings()) !== rules });
    const list = ctx.library().filter((e) => inLibraryFor(e, settings));
    const rows = [];
    $('speciesInfo').textContent = 'Measuring the library…';
    for (const e of list) {
      if (measuring !== task) return;
      let w, m;
      try {
        w = compile(e.source, e.language, settings);
        if (!w.ok) continue;
        m = await runner.species(w, settings);
        if (!m) return;
      } catch { continue; }           // one warrior that can't be measured is left off
      // On a plane, ring warriors that destroy themselves are left off the map.
      if (m.survives || settings.topology !== 'torus') rows.push({ name: w.name, ...m });
    }
    if (measuring !== task || rulesKey(ctx.settings()) !== rules) return;
    measuring = null;
    libCache = { rules, rows };
    then();
  }

  function render() {
    const settings = ctx.settings();
    const axes = speciesAxes(settings);
    const procs = (p) => `${axes.processes.labels[p]} ${axes.processes.labels[p] === '1' ? 'process' : 'processes'}`;
    const rules = rulesKey(settings);
    const mine = ownRows.filter((r) => r.rules === rules && ctx.slots()[r.k]?.compiled === r.compiled);
    const library = libCache.rules === rules ? libCache.rows : [];
    const P = axes.processes.labels.length, C = axes.coverage.labels.length;
    let html = '<div class="species-grid" style="grid-template-columns: auto repeat(' + P + ', 1fr)">';
    for (let c = C - 1; c >= 0; c--) {
      html += `<div class="sp-y">${esc(axes.coverage.labels[c])}</div>`;
      for (let p = 0; p < P; p++) {
        const lib = library.filter((r) => r.cell[0] === p && r.cell[1] === c);
        const you = mine.filter((r) => r.cell[0] === p && r.cell[1] === c);
        const sel = selected === `${p},${c}`;
        html += `<button class="sp-cell${sel ? ' sel' : ''}${lib.length || you.length ? ' used' : ''}" data-cell="${p},${c}" aria-label="${esc(procs(p))}, ${esc(axes.coverage.labels[c])} cells: ${lib.length + you.length} warriors">${
          you.map((r) => `<i class="sp-you" style="background:${r.color}"></i>`).join('')}${lib.map(() => '<i class="sp-lib"></i>').join('')}</button>`;
      }
    }
    html += `<div></div>${axes.processes.labels.map((l) => `<div class="sp-x">${esc(l)}</div>`).join('')}</div>`;
    html += '<p class="sp-axes muted small">Across: most processes at once. Up: different cells executed. <i class="sp-lib"></i> library <i class="sp-you" style="background:var(--accent)"></i> your warriors</p>';
    $('speciesMap').innerHTML = html;
    // What's in the selected cell, or where your warriors are.
    let info;
    if (selected) {
      const [p, c] = selected.split(',').map(Number);
      const here = [...mine.map((r) => ({ ...r, you: true })), ...library].filter((r) => r.cell[0] === p && r.cell[1] === c);
      info = `<b>${esc(procs(p))} × ${esc(axes.coverage.labels[c])} cells</b> · usually ${esc(speciesHint(p, c, axes))}<br>${
        here.length ? here.map((r) => `${r.you ? `<span class="dot" style="background:${r.color}"></span>` : ''}${esc(r.name)} <span class="muted">(${plural(r.processes, 'process', 'processes')}, ${plural(r.coverage, 'cell', 'cells')})</span>`).join(' · ') : '<span class="muted">Nobody here yet.</span>'}`;
    } else {
      info = mine.map((r) => `<span class="dot" style="background:${r.color}"></span><b>${esc(r.name)}</b>: ${r.survives ? esc(r.hint) : 'kills itself when alone'} <span class="muted">(${plural(r.processes, 'process', 'processes')}, ${plural(r.coverage, 'cell', 'cells')})</span>`).join('<br>') || (ownJob ? 'Measuring your warriors…' : 'No working warriors in the editor.');
      info += '<br><span class="muted">Tap a cell to see who lives there.</span>';
    }
    $('speciesInfo').innerHTML = info;
  }

  $('speciesMap').addEventListener('click', (e) => {
    const b = e.target.closest('.sp-cell');
    if (!b) return;
    selected = selected === b.dataset.cell ? null : b.dataset.cell;
    render();
  });
  const refresh = () => {
    if (!$('speciesCard').open) return;
    return Promise.all([measureLibrary(render), measureOwn()]);
  };
  $('speciesCard').addEventListener('toggle', () => {
    if ($('speciesCard').open) refresh();
    else { measuring = null; ownJob = null; }
  });
  return { refresh };
}
