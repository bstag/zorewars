// ZoreWars arena: editors, live battle view, inspector and tournaments.

import { compile, VM, runRound, mulberry32, DEFAULT_SETTINGS, listing, roundPoints, postMortem, generateFromJS } from '../src/engine/index.js';
import { convertWarrior } from '../src/engine/convert.js';
import { CoreRenderer, ProcessChart, WARRIOR_COLORS } from './arena.js';
import { generateFromPython, pythonReady } from './python.js';
import { createCodeEditor } from './editor.js';
import './nav.js';

const $ = (id) => document.getElementById(id);
const MAX_SLOTS = 4;
const STORAGE_KEY = 'zorewars.slots.v1';
const SETTINGS_KEY = 'zorewars.settings.v1';

const TEMPLATES = {
  redcode: `;name My Warrior
;author You
;strategy Describe your plan here.

        ORG     start
start   MOV.I   $0, $1          ; replace me with something cleverer
`,
  javascript: `// Each call emits one Redcode instruction. Use loops, functions and
// constants freely: only the generated Redcode goes into the arena.
name("My Warrior");
author("You");

org("start");
label("start"); mov.i(0, 1);
`,
  python: `# Each call emits one Redcode instruction. Use loops, functions and
# constants freely: only the generated Redcode goes into the arena.
from zorewars import *

name("My Warrior")
author("You")

org("start")
label("start"); mov.i(0, 1)
`,
};

const state = {
  settings: { ...DEFAULT_SETTINGS },
  library: [],
  slots: [],
  active: 0,
  vm: null,
  roster: [],        // slot indices loaded in the current round
  running: false,
  stepsPerFrame: 1,
  carry: 0,
  round: 0,
  alive: [],
  pinned: -1,
  hover: -1,
  lastStep: null,
  tournament: null,
  dirtyFrame: true,
  booting: true,
};

const renderer = new CoreRenderer($('core'));
const chart = new ProcessChart($('chart'));

// ---------------------------------------------------------------- storage

function safeGet(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}
function saveSlots() {
  safeSet(STORAGE_KEY, state.slots.map(({ language, source, libFile, origin, edited }) => ({ language, source, libFile, origin, edited })));
}

// ---------------------------------------------------------------- library

async function loadLibrary() {
  const list = await fetch('../warriors/index.json').then((r) => r.json());
  await Promise.all(list.map(async (entry) => {
    entry.source = await fetch(`../warriors/${entry.file}`).then((r) => r.text());
  }));
  state.library = list;
  const sel = $('librarySelect');
  sel.innerHTML = '<option value="">Load a classic…</option>';
  const groups = { redcode: 'Redcode', javascript: 'JavaScript', python: 'Python' };
  for (const [lang, label] of Object.entries(groups)) {
    const og = document.createElement('optgroup');
    og.label = label;
    for (const e of list.filter((x) => x.language === lang)) {
      const o = document.createElement('option');
      o.value = e.file;
      o.textContent = `${e.name} — ${e.category}${e.convertedFrom ? ' (converted)' : ''}`;
      og.appendChild(o);
    }
    if (og.children.length) sel.appendChild(og);
  }
}

function libraryEntry(file) {
  return state.library.find((e) => e.file === file);
}

// ---------------------------------------------------------------- slots & compiling

function makeSlot(file) {
  const e = libraryEntry(file);
  return { language: e?.language ?? 'redcode', source: e?.source ?? TEMPLATES.redcode, libFile: e ? file : null, compiled: null, status: 'idle', token: 0 };
}

async function compileSlot(slot) {
  const token = ++slot.token;
  slot.status = 'compiling';
  if (slot === activeSlot()) renderEditorStatus();
  let result;
  try {
    if (slot.language === 'python') {
      if (!pythonReady()) {
        slot.statusText = 'Loading Python in your browser (about 10 MB, first time only)…';
        if (slot === activeSlot()) renderEditorStatus();
      }
      const redcode = await generateFromPython(slot.source, state.settings);
      result = compile(redcode, 'redcode', state.settings);
    } else {
      result = compile(slot.source, slot.language, state.settings);
    }
  } catch (e) {
    const msg = String(e.message || e).split('\n').filter(Boolean).slice(-3).join('\n');
    result = { ok: false, errors: [{ line: 0, message: msg }], warnings: [], instructions: [] };
  }
  if (token !== slot.token) return; // superseded by a newer edit
  if (result.ok && result.name === 'Unnamed' && slot.origin?.name) result.name = slot.origin.name;
  slot.compiled = result;
  slot.status = result.ok ? 'ok' : 'error';
  slot.statusText = '';
  renderTabs();
  if (slot === activeSlot()) renderEditorStatus();
  // Apply edits immediately when the current round has not started or is over.
  if (!state.booting && (!state.vm || state.vm.steps === 0 || state.vm.done)) {
    if (state.slots.every((s) => s.status !== 'compiling')) newRound();
  }
}

let compileTimer = null;
function scheduleCompile(slot, delay) {
  clearTimeout(compileTimer);
  compileTimer = setTimeout(() => compileSlot(slot), delay);
}

function activeSlot() {
  return state.slots[state.active];
}

// ---------------------------------------------------------------- editor UI

function renderTabs() {
  const tabs = $('slotTabs');
  tabs.innerHTML = '';
  state.slots.forEach((slot, i) => {
    const b = document.createElement('button');
    b.className = 'tab' + (slot.status === 'error' ? ' err' : '');
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(i === state.active));
    const name = slot.compiled?.ok ? slot.compiled.name : `Warrior ${i + 1}`;
    b.innerHTML = `<span class="dot" style="background:${WARRIOR_COLORS[i]}"></span><span class="label"></span>`;
    b.querySelector('.label').textContent = name;
    b.title = name;
    b.onclick = () => { state.active = i; renderEditor(); };
    tabs.appendChild(b);
  });
  if (state.slots.length < MAX_SLOTS) {
    const add = document.createElement('button');
    add.className = 'tab add';
    add.textContent = '+ Add';
    add.title = 'Add another warrior (up to 4 can battle at once)';
    add.onclick = addSlot;
    tabs.appendChild(add);
  }
  $('removeSlot').disabled = state.slots.length <= 1;
}

function renderEditor() {
  const slot = activeSlot();
  state.editor.setLanguage(slot.language);
  state.editor.setValue(slot.source);
  $('languageSelect').value = slot.language;
  $('librarySelect').value = slot.libFile && libraryEntry(slot.libFile)?.source === slot.source ? slot.libFile : '';
  const origin = $('originText');
  origin.hidden = !slot.origin;
  if (slot.origin) {
    origin.innerHTML = slot.origin.url
      ? `Imported from <a href="${escapeHtml(slot.origin.url)}" target="_blank" rel="noopener">${escapeHtml(new URL(slot.origin.url).hostname)}</a>. Kept only in this browser.`
      : / converted to /.test(slot.origin.name) ? `${escapeHtml(slot.origin.name)}.`
      : `Imported from ${escapeHtml(slot.origin.name)}. Kept only in this browser.`;
  }
  renderTabs();
  renderGutter();
  renderEditorStatus();
}

// Errors and warnings appear on their lines in the editor. (For JavaScript
// and Python the line numbers refer to the generated Redcode, so they are
// listed below the editor instead.)
function renderGutter() {
  const slot = activeSlot();
  const c = slot.compiled;
  const marks = slot.language === 'redcode' && c
    ? [...(c.errors || []), ...(c.warnings || []).map((w) => ({ ...w, severity: 'warning' }))]
    : [];
  state.editor.setErrors(marks);
}

function onSourceChange(text) {
  const slot = activeSlot();
  slot.source = text;
  slot.edited = true;
  saveSlots();
  scheduleCompile(slot, slot.language === 'python' ? 900 : 250);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function renderEditorStatus() {
  const slot = activeSlot();
  const el = $('compileStatus');
  const c = slot.compiled;
  if (slot.status === 'compiling') {
    el.innerHTML = `<span class="pending">● ${escapeHtml(slot.statusText || 'Compiling…')}</span>`;
  } else if (c && !c.ok) {
    const where = slot.language === 'redcode' ? 'line' : 'Redcode line';
    el.innerHTML = `<span class="bad">✕ ${c.errors.length} error${c.errors.length > 1 ? 's' : ''}</span><ul>${
      c.errors.map((e) => `<li>${e.line ? `${where} ${e.line}: ` : ''}${escapeHtml(e.message)}</li>`).join('')}</ul>`;
  } else if (c) {
    const warn = c.warnings.length ? ` <span class="pending">(${c.warnings.length} warning${c.warnings.length > 1 ? 's' : ''}: ${escapeHtml(c.warnings[0].message)})</span>` : '';
    el.innerHTML = `<span class="ok">✓ ${escapeHtml(c.name)}</span> <span class="muted">by ${escapeHtml(c.author)} · ${c.instructions.length} instruction${c.instructions.length === 1 ? '' : 's'}</span>${warn}`;
  } else el.textContent = '';
  const hint = rulesHint(c);
  if (hint) {
    el.insertAdjacentHTML('beforeend', `<div class="rules-hint pending">${escapeHtml(hint.text)}<button class="btn" id="useRules">Use these rules</button></div>`);
    $('useRules').onclick = () => applySettings(hint.settings);
  }
  $('strategyText').textContent = c?.ok ? c.strategy.replace(/\s*\n\s*/g, ' ') : '';
  $('convertRow').hidden = !(c?.ok && slot.language === 'redcode');

  const gen = $('generatedBox');
  if (c?.ok) {
    $('generatedCode').textContent = listing(c, state.settings.coreSize);
    $('generatedMeta').textContent = slot.language === 'redcode' ? '(normalised)' : `(generated from ${slot.language === 'python' ? 'Python' : 'JavaScript'})`;
    gen.hidden = false;
  } else if (c?.redcode && slot.language !== 'redcode') {
    $('generatedCode').textContent = c.redcode;
    $('generatedMeta').textContent = '(generated, has errors)';
    gen.hidden = false;
  } else gen.hidden = true;
  renderGutter();
}

function addSlot() {
  if (state.slots.length >= MAX_SLOTS) return;
  const used = new Set(state.slots.map((s) => s.libFile));
  const pick = ['scanner.red', 'vampire.red', 'imp.red', 'sweeper.red', 'stunner.red'].find((f) => !used.has(f)) || 'imp.red';
  const slot = makeSlot(pick);
  state.slots.push(slot);
  state.active = state.slots.length - 1;
  saveSlots();
  renderEditor();
  compileSlot(slot);
}

function removeSlot() {
  if (state.slots.length <= 1) return;
  state.slots.splice(state.active, 1);
  state.active = Math.max(0, state.active - 1);
  saveSlots();
  renderEditor();
  newRound();
}


// Originals written for another hill say so with ;assert CORESIZE == N or
// by being longer than our limit. Offer to switch the arena's rules.
const HILL_94X = { coreSize: 55440, maxProcesses: 10000, maxCycles: 500000, maxLength: 200, minDistance: 200 };
function rulesHint(c) {
  if (!c) return null;
  const core = c.warnings?.map((w) => /CORESIZE\s*==\s*(\d+)/.exec(w.message)).find(Boolean);
  const len = c.errors?.map((e) => /is (\d+) instructions long/.exec(e.message)).find(Boolean);
  if (!core && !len) return null;
  let settings = { ...state.settings };
  if (core && +core[1] === 55440) settings = { ...settings, ...HILL_94X };
  else if (core) settings.coreSize = +core[1];
  if (len) settings.maxLength = Math.max(settings.maxLength, +len[1]);
  if (settings.coreSize === state.settings.coreSize && settings.maxLength === state.settings.maxLength) return null;
  const parts = [];
  if (settings.coreSize !== state.settings.coreSize) parts.push(`core size ${settings.coreSize.toLocaleString()}`);
  if (settings.maxLength !== state.settings.maxLength) parts.push(`max length ${settings.maxLength}`);
  return { settings, text: `This warrior was written for different rules (${parts.join(', ')}). Switching applies to every warrior in the arena.` };
}

// ---------------------------------------------------------------- importing

const MAX_IMPORT_BYTES = 512 * 1024;

function isPristine(slot) {
  return !slot.source.trim() || state.library.some((x) => x.source === slot.source) ||
    Object.values(TEMPLATES).includes(slot.source) || (!!slot.origin && !slot.edited);
}

function nameFromUrl(url) {
  const base = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'warrior');
  return base.replace(/\.[^.]+$/, '').replace(/\[\d+\]$/, '') || 'warrior';
}

// Archives rarely send CORS headers, so go through the site's proxy: the dev
// server (npm start) or the Cloudflare Worker, both using cli/remote.js.
// Plain static hosting (such as GitHub Pages) has no proxy: try a direct
// fetch, which works only for hosts that allow it.
async function fetchRemote(url) {
  const r = await fetch(`../api/fetch?url=${encodeURIComponent(url)}`); // relative: works under a sub-path
  if (r.status !== 404) {
    const text = await r.text();
    if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
    return text;
  }
  try {
    const direct = await fetch(url, { mode: 'cors' });
    if (direct.ok) return await direct.text();
    throw new Error(`HTTP ${direct.status}`);
  } catch (e) {
    throw new Error(`Couldn't fetch ${url}: this copy of ZoreWars is on a static host without the archive proxy, and the archive doesn't allow direct downloads. Open the link, save the file and use "Or a file from your computer", or run ZoreWars with "npm start" or on Cloudflare.`);
  }
}

function importIntoSlot(slot, { text, name, url = null, language = 'redcode' }) {
  if (text.length > MAX_IMPORT_BYTES) throw new Error('That file is larger than 512 KB.');
  Object.assign(slot, { language, source: text, libFile: null, origin: { name, url }, edited: false, compiled: null });
  saveSlots();
  if (slot === activeSlot()) renderEditor();
  return compileSlot(slot);
}

function languageOfFile(name) {
  return /\.m?js$/i.test(name) ? 'javascript' : /\.py$/i.test(name) ? 'python' : 'redcode';
}

async function importFile(file, slot = activeSlot()) {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('That file is larger than 512 KB.');
  if (!isPristine(slot) && !confirm(`Replace ${slot.compiled?.name || 'this warrior'} with ${file.name}?`)) return false;
  await importIntoSlot(slot, { text: await file.text(), name: file.name.replace(/\.[^.]+$/, ''), language: languageOfFile(file.name) });
  return true;
}

async function importUrl(url, slot = activeSlot()) {
  const parsed = new URL(url);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('Only http and https URLs are supported.');
  if (/\.(m?js|py|cpp)$/i.test(parsed.pathname)) throw new Error('Only Redcode can be loaded from a URL. Programs are never run from the network.');
  const text = await fetchRemote(url);
  await importIntoSlot(slot, { text, name: nameFromUrl(url), url });
}

async function loadClassics() {
  try {
    const data = await fetch('../warriors/encyclopedia.json').then((r) => r.json());
    const sel = $('classicSelect');
    for (const h of data.hallOfFame) {
      const o = document.createElement('option');
      o.value = h.url;
      o.textContent = `${h.name} (${h.author}, ${h.year})`;
      sel.appendChild(o);
    }
  } catch { /* the dialog still works with URLs and files */ }
}

function wireImport() {
  const dlg = $('importDialog');
  const status = (msg, cls = '') => { $('importStatus').textContent = msg; $('importStatus').className = `import-status ${cls}`; };
  $('importBtn').addEventListener('click', () => {
    status('');
    $('importFile').value = '';
    dlg.showModal();
  });
  $('importCancel').addEventListener('click', () => dlg.close());
  $('classicSelect').addEventListener('change', (e) => { if (e.target.value) { $('importUrl').value = e.target.value; $('importFile').value = ''; } });
  $('importFile').addEventListener('change', () => { if ($('importFile').files.length) $('importUrl').value = ''; });
  $('importForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = $('importFile').files[0];
    const url = $('importUrl').value.trim();
    if (!file && !url) { status('Choose a classic, paste a URL or pick a file.', 'bad'); return; }
    $('importGo').disabled = true;
    try {
      if (file) {
        if (await importFile(file)) dlg.close();
      } else {
        if (!isPristine(activeSlot()) && !confirm('Replace your edits in this slot?')) return;
        status('Fetching…', 'pending');
        await importUrl(url);
        dlg.close();
      }
    } catch (err) {
      status(err.message, 'bad');
    } finally {
      $('importGo').disabled = false;
    }
  });

  // Drop a file onto the editor to load it into the active slot.
  const target = $('codeEditor');
  // Capture phase, so file drops are imported here before the code editor
  // (which would insert the file's text) sees them. Dragged text still goes
  // to the editor.
  target.addEventListener('dragover', (e) => {
    if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); target.classList.add('dropping'); }
  }, true);
  target.addEventListener('dragleave', () => target.classList.remove('dropping'));
  target.addEventListener('drop', async (e) => {
    target.classList.remove('dropping');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    e.preventDefault();
    e.stopPropagation();
    try { await importFile(file); } catch (err) { alert(err.message); }
  }, true);
}

// ---------------------------------------------------------------- converting

// Redcode -> JavaScript or Python. The conversion is verified (it must
// compile to exactly the same program) and opens in a new slot when there
// is room, so the two versions can be compared or even fight each other.
async function convertActive(lang) {
  const slot = activeSlot();
  if (slot.language !== 'redcode' || !slot.compiled?.ok) return;
  const status = $('convertStatus');
  const buttons = [...document.querySelectorAll('#convertRow .linkbtn')];
  buttons.forEach((b) => { b.disabled = true; });
  status.textContent = lang === 'python' && !pythonReady() ? 'loading Python to verify the conversion…' : 'converting…';
  try {
    const toRedcode = lang === 'javascript' ? (code) => generateFromJS(code, state.settings) : (code) => generateFromPython(code, state.settings);
    const r = await convertWarrior(slot.source, lang, { compile, toRedcode, settings: state.settings });
    let target;
    if (state.slots.length < MAX_SLOTS) {
      target = makeSlot(null);
      state.slots.push(target);
      state.active = state.slots.length - 1;
    } else {
      if (!confirm('All four slots are in use. Replace this warrior with its conversion?')) return;
      target = slot;
    }
    const label = lang === 'python' ? 'Python' : 'JavaScript';
    Object.assign(target, {
      language: lang, source: r.code, libFile: null, edited: false, compiled: null,
      origin: { name: `${slot.compiled.name}, converted to ${label}`, url: slot.origin?.url ?? null },
    });
    saveSlots();
    renderEditor();
    await compileSlot(target);
    status.textContent = '';
    log(`Converted <b>${escapeHtml(slot.compiled.name)}</b> to ${label} (${r.level} form, verified identical)`);
  } catch (e) {
    status.textContent = `couldn't convert: ${e.message}`;
  } finally {
    buttons.forEach((b) => { b.disabled = false; });
    if (status.textContent.startsWith('converting') || status.textContent.startsWith('loading')) status.textContent = '';
  }
}

// ---------------------------------------------------------------- battle

function newRound() {
  stopRunning();
  const roster = state.slots.map((s, i) => (s.compiled?.ok ? i : -1)).filter((i) => i >= 0);
  state.roster = roster;
  if (!roster.length) {
    state.vm = null;
    showOverlay('No runnable warriors', 'Fix the compile errors to start a round.');
    renderScoreboard();
    return;
  }
  const vm = new VM(state.settings);
  const warriors = roster.map((i) => state.slots[i].compiled);
  // P-space carries over between rounds while the same warriors keep fighting.
  const sameField = state.pspaceOwners?.length === warriors.length && warriors.every((w, k) => w === state.pspaceOwners[k]);
  if (!sameField) {
    state.pspaceOwners = warriors;
    state.pspaces = warriors.map(() => VM.freshPSpace(state.settings));
  }
  const firstTurn = state.round % warriors.length;
  const pspacesAtStart = state.pspaces.map((ps) => ps.slice()); // for replays
  try {
    const positions = vm.load(warriors, { seed: (Math.random() * 2 ** 32) >>> 0, firstTurn, pspaces: state.pspaces });
    state.roundSetup = { warriors, positions, firstTurn, pspaces: pspacesAtStart };
  } catch (e) {
    state.vm = null;
    showOverlay('Could not load warriors', e.message);
    return;
  }
  state.vm = vm;
  state.round++;
  state.replaying = false;
  state.report = null;
  $('pmCard').hidden = true;
  state.alive = vm.warriors.map(() => true);
  state.lastStep = null;
  chart.reset(warriors.length, state.settings.maxCycles);
  chart.sample(0, vm.warriors.map((w) => w.queue.size));
  hideOverlay();
  const skipped = state.slots.length - roster.length;
  log(`<b>Round ${state.round}</b> · ${vm.warriors.map((w, k) => `${colorName(k, w.name)} at ${pad4(w.position)}`).join(', ')}${skipped ? ` <span class="muted">(${skipped} skipped: compile errors)</span>` : ''}`);
  renderScoreboard();
  updateCycle();
  state.dirtyFrame = true;
}

function colorName(k, name) {
  const slot = state.roster[k];
  return `<b style="color:${WARRIOR_COLORS[slot]}">${escapeHtml(name)}</b>`;
}
const pad4 = (n) => String(n).padStart(4, '0');

function stepVM(maxSteps, budgetMs = 14) {
  const vm = state.vm;
  if (!vm || vm.done) return 0;
  const t0 = performance.now();
  let n = 0;
  while (n < maxSteps && !vm.done) {
    state.lastStep = vm.step();
    n++;
    if ((n & 1023) === 0 && performance.now() - t0 > budgetMs) break;
  }
  checkDeaths();
  if (vm.done) finishRound();
  return n;
}

function checkDeaths() {
  const vm = state.vm;
  vm.warriors.forEach((w, k) => {
    if (state.alive[k] && !w.alive) {
      state.alive[k] = false;
      log(`${colorName(k, w.name)} eliminated at cycle ${w.diedAt}`);
    }
  });
}

function finishRound() {
  const vm = state.vm;
  stopRunning();
  vm.recordResults();
  renderPostMortem(postMortem(vm));
  const tag = state.replaying ? '<span class="replay-tag">Replay:</span> ' : '';
  if (vm.winner !== null && vm.winner !== undefined) {
    const w = vm.warriors[vm.winner];
    log(`${tag}${colorName(vm.winner, w.name)} <b>wins</b> at cycle ${vm.cycle}`);
    showOverlay(`${w.name} wins`, `cycle ${vm.cycle.toLocaleString()} · see "Why it ended" · ${touchQuery.matches ? "tap" : "click"} for a new round`, WARRIOR_COLORS[state.roster[vm.winner]]);
  } else {
    const survivors = vm.warriors.filter((w) => w.alive);
    const msg = vm.warriors.length === 1
      ? (survivors.length ? `Survived all ${vm.cycle.toLocaleString()} cycles` : `Died at cycle ${vm.cycle}`)
      : `Tie: ${survivors.map((w) => w.name).join(', ')} survived ${vm.cycle.toLocaleString()} cycles`;
    log(`${tag}<b>${escapeHtml(msg)}</b>`);
    showOverlay(vm.warriors.length === 1 ? (survivors.length ? 'Survived' : 'Died') : 'Tie', `${msg} · ${touchQuery.matches ? "tap" : "click"} for a new round`);
  }
  renderScoreboard();
}

// ---------------------------------------------------------------- post-mortem

function renderPostMortem(report) {
  state.report = report;
  const vm = state.vm;
  const nameHtml = (n) => {
    const k = vm.warriors.findIndex((w) => w.name === n);
    return k >= 0 ? colorName(k, n) : escapeHtml(n);
  };
  // Colour warrior names inside report sentences.
  const colorize = (text) => {
    let html = escapeHtml(text);
    for (const w of vm.warriors) html = html.split(escapeHtml(w.name)).join(nameHtml(w.name));
    return html;
  };
  $('pmSummary').innerHTML = colorize(report.summary);
  $('pmTimeline').innerHTML = report.timeline.map((e) => `<li class="${e.kind}"><b>${e.cycle.toLocaleString()}</b> ${colorize(e.text)}</li>`).join('');
  $('pmBlow').hidden = !report.killingBlow;
  $('pmReplay').hidden = !state.roundSetup;
  const causes = { ownCode: 'its own code or data', enemyCode: 'opponent bombs', emptyCore: 'empty core', divideByZero: 'division by zero' };
  $('pmWarriors').innerHTML = report.warriors.map((w) => {
    const deaths = Object.entries(w.deaths).filter(([k, v]) => k !== 'total' && v).map(([k, v]) => `${v.toLocaleString()} on ${causes[k]}`);
    const running = Object.entries(w.runningProgram).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v.toLocaleString()} running ${colorize(k)}`);
    const rows = w.code.map((c) => `<tr class="${c.changed ? 'changed' : ''}"><td>${pad4(c.addr)}</td><td>${escapeHtml(c.original)}</td><td>${c.changed ? escapeHtml(c.instruction) : '—'}</td><td class="by">${c.changed && c.ownerName ? `${colorize(c.ownerName)} @${c.writtenAtCycle}` : ''}</td></tr>`).join('');
    return `<div class="pm-w"><h4>${nameHtml(w.name)} · ${w.alive ? `alive, ${w.finalProcesses.toLocaleString()} processes` : `eliminated at cycle ${w.diedAt.toLocaleString()}`} (peak ${w.peakProcesses.toLocaleString()})</h4>
      <ul>${w.deaths.total ? `<li>${w.deaths.total.toLocaleString()} process deaths: ${deaths.join('; ')}</li>` : '<li>no process ever died</li>'}${running.length ? `<li>${running.join(', ')}</li>` : ''}</ul>
      <div class="pm-code-wrap"><table class="pm-code"><thead><tr><td>addr</td><td>original</td><td>at the end</td><td class="by">written by</td></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="muted small">${w.codeIntact}/${w.code.length} of its original instructions unchanged.</p></div>`;
  }).join('');
  $('pmCard').hidden = false;
  if (isPhone() && state.view !== 'details') $('detailsBadge').hidden = false;
}

function showKillingBlow() {
  const blow = state.report?.killingBlow;
  if (!blow) return;
  state.pinned = blow.pc;
  state.dirtyFrame = true;
  $('inspector').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// Rounds are deterministic, so a replay re-runs this exact round from the
// start and pauses shortly before the end; then Step through the finish.
function replayEnd(cyclesBefore = 100) {
  const setup = state.roundSetup;
  const end = state.vm?.cycle ?? 0;
  if (!setup) return;
  stopRunning();
  const vm = new VM(state.settings);
  vm.load(setup.warriors, { positions: setup.positions, firstTurn: setup.firstTurn, pspaces: setup.pspaces.map((ps) => ps.slice()) });
  const target = Math.max(0, end - cyclesBefore);
  while (!vm.done && vm.cycle < target) vm.step();
  state.vm = vm;
  state.replaying = true;
  state.lastStep = null;
  state.alive = vm.warriors.map((w) => w.alive);
  chart.reset(vm.warriors.length, state.settings.maxCycles);
  chart.sample(vm.cycle, vm.warriors.map((w) => w.queue.size));
  hideOverlay();
  if (state.report?.killingBlow) state.pinned = state.report.killingBlow.pc;
  log(`<span class="replay-tag">Replay</span> of round ${state.round} paused at cycle ${vm.cycle.toLocaleString()}, ${end - vm.cycle} cycles before the end. Press Step (S) to advance one instruction; the killing-blow cell is pinned.`);
  renderScoreboard();
  updateCycle();
  state.dirtyFrame = true;
}

function showOverlay(title, sub, color) {
  const o = $('overlay');
  o.innerHTML = `<div><div class="big"${color ? ` style="color:${color};text-shadow:0 0 24px ${color}"` : ''}>${escapeHtml(title)}</div><div class="sub">${escapeHtml(sub)}</div></div>`;
  o.hidden = false;
}
function hideOverlay() { $('overlay').hidden = true; }

function startRunning() {
  if (!state.vm) return;
  if (state.vm.done) newRound();
  state.running = true;
  $('runIcon').setAttribute('href', '#i-pause');
  $('runLabel').textContent = 'Pause';
  $('runBtn').setAttribute('aria-label', 'Pause');
}
function stopRunning() {
  state.running = false;
  $('runIcon').setAttribute('href', '#i-play');
  $('runLabel').textContent = 'Run';
  $('runBtn').setAttribute('aria-label', 'Run');
}

let finishing = false;
function finishFast() {
  if (!state.vm || state.vm.done || finishing) return;
  stopRunning();
  finishing = true;
  $('finishBtn').disabled = true;
  const chunk = () => {
    stepVM(Infinity, 30);
    sampleChart();
    state.dirtyFrame = true;
    if (state.vm && !state.vm.done) setTimeout(chunk, 0);
    else { finishing = false; $('finishBtn').disabled = false; }
  };
  chunk();
}

// ---------------------------------------------------------------- rendering loop

function sampleChart() {
  const vm = state.vm;
  if (vm) chart.sample(vm.cycle, vm.warriors.map((w) => w.queue.size));
}

function frame() {
  const vm = state.vm;
  if (vm && state.running && !vm.done) {
    state.carry += state.stepsPerFrame * vm.warriors.filter((w) => w.alive).length;
    const want = Math.floor(state.carry);
    state.carry -= want;
    if (want > 0) {
      stepVM(want);
      sampleChart();
      state.dirtyFrame = true;
    }
  }
  if (state.dirtyFrame && vm) {
    const fade = Math.min(40000, Math.max(24, state.stepsPerFrame * vm.warriors.length * 36));
    renderer.hover = state.hover;
    renderer.pinned = state.pinned;
    renderer.draw(vm, fade);
    chart.draw(state.settings.maxProcesses);
    renderScoreboardLive();
    updateCycle();
    renderInspector();
    state.dirtyFrame = false;
  }
  requestAnimationFrame(frame);
}

function updateCycle() {
  const vm = state.vm;
  const c = vm ? vm.cycle : 0;
  $('cycleOut').textContent = `Cycle ${c.toLocaleString()} / ${state.settings.maxCycles.toLocaleString()}`;
  $('cycleBar').style.width = `${Math.min(100, (c / state.settings.maxCycles) * 100)}%`;
}

function renderScoreboard() {
  const sb = $('scoreboard');
  sb.innerHTML = '';
  const vm = state.vm;
  if (!vm) return;
  vm.warriors.forEach((w, k) => {
    const color = WARRIOR_COLORS[state.roster[k]];
    const d = document.createElement('div');
    d.className = 'fighter';
    d.style.setProperty('--c', color);
    d.innerHTML = `<div class="name"></div><div class="meta"><span class="procs"></span><span class="badge"></span></div><div class="bar"><i></i></div>`;
    d.querySelector('.name').textContent = w.name;
    d.querySelector('.name').title = `${w.name} by ${w.author} · ${w.length} instructions`;
    sb.appendChild(d);
  });
  renderScoreboardLive();
}

function renderScoreboardLive() {
  const vm = state.vm;
  if (!vm) return;
  const cards = $('scoreboard').children;
  const maxP = state.settings.maxProcesses;
  vm.warriors.forEach((w, k) => {
    const card = cards[k];
    if (!card) return;
    const p = w.queue.size;
    card.querySelector('.procs').textContent = `${p.toLocaleString()} proc${p === 1 ? '' : 's'}`;
    const winner = vm.done && vm.winner === k;
    card.querySelector('.badge').textContent = winner ? 'winner' : w.alive ? (vm.done ? 'survived' : 'alive') : `dead @${w.diedAt}`;
    card.classList.toggle('dead', !w.alive);
    card.classList.toggle('winner', winner);
    card.querySelector('.bar i').style.width = `${(Math.log2(p + 1) / Math.log2(maxP + 1)) * 100}%`;
  });
}

function renderInspector() {
  const vm = state.vm;
  const addr = state.pinned >= 0 ? state.pinned : state.hover;
  const el = $('inspector');
  const hint = $('inspectHint');
  if (!vm) { el.textContent = ''; return; }
  const ls = state.lastStep;
  let center = addr;
  if (center < 0 && ls && !state.running) center = ls.pc;
  if (center < 0) {
    el.innerHTML = '';
    hint.textContent = 'Hover over the core to read memory. Click to pin.';
    return;
  }
  const rows = [];
  for (let d = -4; d <= 4; d++) {
    const p = vm.norm(center + d);
    const o = vm.owner[p];
    const who = o >= 0 ? `<span style="color:${WARRIOR_COLORS[state.roster[o]]}">${escapeHtml(vm.warriors[o].name)}</span>` : '';
    const running = vm.warriors.some((w) => w.alive && [...w.queue].includes(p)) ? ' ◂ pc' : '';
    const text = `${d === 0 ? '▸' : ' '}${pad4(p)}  ${vm.disassemble(p).padEnd(22)}`;
    rows.push(d === 0 ? `<span class="cur">${escapeHtml(text)}${who}${running}</span>` : `${escapeHtml(text)}${who}${running}`);
  }
  el.innerHTML = rows.join('\n');
  if (addr < 0 && ls) {
    hint.innerHTML = `Last step: ${colorName(ls.warrior, vm.warriors[ls.warrior].name)} ran address ${pad4(ls.pc)}${ls.killed ? ' and the process <b>died</b>' : ''}.`;
  } else {
    // Where this cell's current contents came from.
    const p = vm.norm(addr);
    const o = vm.owner[p];
    const wpc = vm.writerPc[p];
    const origin = o < 0 ? 'Empty core: never written.'
      : wpc < 0 ? `Loaded as part of ${colorName(o, vm.warriors[o].name)}.`
      : `Written by ${colorName(o, vm.warriors[o].name)} at cycle ${vm.writeCycle[p].toLocaleString()}, using ${escapeHtml(vm.disassemble(wpc))} at ${pad4(wpc)}.`;
    hint.innerHTML = `${origin} ${state.pinned >= 0 ? `Pinned at ${pad4(state.pinned)}; click again to unpin.` : 'Click to pin.'}`;
    const peek = $('cellPeek');
    peek.hidden = state.pinned < 0;
    if (state.pinned >= 0) peek.innerHTML = `<b>${pad4(p)}</b> ${escapeHtml(vm.disassemble(p))} · ${origin} <span class="muted">Tap again to unpin.</span>`;
  }
}

function log(html) {
  const li = document.createElement('li');
  li.innerHTML = html;
  const ol = $('log');
  ol.prepend(li);
  while (ol.children.length > 200) ol.lastChild.remove();
}

// ---------------------------------------------------------------- tournament

function runTournamentUI() {
  if (state.tournament) { state.tournament.cancel = true; return; }
  const roster = state.slots.map((s, i) => (s.compiled?.ok ? i : -1)).filter((i) => i >= 0);
  if (roster.length < 2) { $('tourResults').innerHTML = '<p class="muted small">Need at least two working warriors.</p>'; return; }
  const rounds = Math.max(1, Math.min(1000, parseInt($('tourRounds').value, 10) || 50));
  const warriors = roster.map((i) => state.slots[i].compiled);
  const stats = warriors.map((w) => ({ name: w.name, wins: 0, losses: 0, ties: 0, score: 0 }));
  const rng = mulberry32((Math.random() * 2 ** 32) >>> 0);
  const pspaces = warriors.map(() => VM.freshPSpace(state.settings));
  const t = { cancel: false, done: 0 };
  state.tournament = t;
  $('tourBtn').textContent = 'Stop';

  const render = () => {
    const rows = stats.map((s, k) => ({ ...s, k })).sort((a, b) => b.score - a.score);
    $('tourResults').innerHTML = `<table class="results"><thead><tr><th>Warrior</th><th>W</th><th>L</th><th>T</th><th>Pts</th></tr></thead><tbody>${
      rows.map((s) => `<tr><td class="name"><span class="dot" style="background:${WARRIOR_COLORS[roster[s.k]]}"></span>${escapeHtml(s.name)}</td><td>${s.wins}</td><td>${s.losses}</td><td>${s.ties}</td><td>${s.score}</td></tr>`).join('')
    }</tbody></table><p class="muted small">${t.done} / ${rounds} rounds · each survivor scores (W²−1)/S, as in pMARS</p>`;
    $('tourBar').style.width = `${(t.done / rounds) * 100}%`;
  };

  const next = () => {
    const t0 = performance.now();
    while (t.done < rounds && !t.cancel && performance.now() - t0 < 40) {
      const res = runRound(warriors, state.settings, { seed: Math.floor(rng() * 2 ** 32), firstTurn: t.done % warriors.length, pspaces });
      stats.forEach((s, k) => {
        const points = roundPoints(warriors.length, res.survivors.length);
        if (res.winner === k) { s.wins++; s.score += points; }
        else if (res.winner === null && res.survivors.includes(k)) { s.ties++; s.score += points; }
        else s.losses++;
      });
      t.done++;
    }
    render();
    if (t.done < rounds && !t.cancel) setTimeout(next, 0);
    else { state.tournament = null; $('tourBtn').textContent = 'Run'; }
  };
  next();
}

// ---------------------------------------------------------------- settings

const SETTING_INPUTS = {
  coreSize: 'setCoreSize', maxCycles: 'setMaxCycles', maxProcesses: 'setMaxProcesses', maxLength: 'setMaxLength', minDistance: 'setMinDistance',
};
function renderSettings() {
  for (const [k, id] of Object.entries(SETTING_INPUTS)) $(id).value = state.settings[k];
}
function applySettings(values) {
  state.settings = { ...state.settings, ...values };
  safeSet(SETTINGS_KEY, state.settings);
  renderSettings();
  renderer.layout(state.settings.coreSize);
  state.vm = null;
  state.slots.forEach((s) => compileSlot(s));
}

// ---------------------------------------------------------------- speed

function speedFromSlider(v) {
  // 0..100 -> 0.05 .. 20,000 cycles per frame (exponential)
  return 0.05 * Math.pow(400000, v / 100);
}
function renderSpeed() {
  const v = state.stepsPerFrame;
  const perSec = v * 60;
  $('speedOut').textContent = perSec < 10 ? `${perSec.toFixed(1)} cyc/s` : perSec < 10000 ? `${Math.round(perSec)} cyc/s` : `${Math.round(perSec / 1000)}k cyc/s`;
}


// ---------------------------------------------------------------- phone layout

const phoneQuery = matchMedia('(max-width: 860px)');
const touchQuery = matchMedia('(pointer: coarse)');
function isPhone() { return phoneQuery.matches; }

// Phones show one view at a time: arena, code or details.
function setView(view) {
  state.view = view;
  document.body.dataset.view = view;
  for (const b of document.querySelectorAll('#tabbar button')) {
    if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  if (view === 'details') $('detailsBadge').hidden = true;
  if (view === 'arena') { renderer.layout(state.settings.coreSize); state.dirtyFrame = true; }
  safeSet('zorewars.view', view);
  window.scrollTo(0, 0);
}

// Keys that are awkward on phone keyboards, inserted at the cursor.
const KEYS = {
  redcode: ['\t', '#', '$', '@', '*', '<', '>', '{', '}', ',', ';', '.', ':', '-', '+', 'MOV', 'ADD', 'JMP', 'SPL', 'DAT', 'DJN', 'SEQ'],
  javascript: ['  ', '(', ')', '"', '.', ',', ';', '=', '[', ']', '{', '}', '`', '$', '+', '-'],
  python: ['    ', '(', ')', '"', '.', ',', ':', '=', '[', ']', '_', '#', '+', '-'],
};
function renderKeybar() {
  const lang = activeSlot()?.language || 'redcode';
  const label = (k) => (k === '\t' || /^ +$/.test(k) ? 'Tab' : k);
  $('keybar').innerHTML = `
    <button data-act="left" aria-label="Cursor left"><svg class="icon"><use href="#i-left"/></svg></button>
    <button data-act="right" aria-label="Cursor right"><svg class="icon"><use href="#i-right"/></svg></button>
    <button data-act="undo" aria-label="Undo"><svg class="icon"><use href="#i-undo"/></svg></button>
    ${KEYS[lang].map((k) => `<button data-key="${escapeHtml(k)}" class="${/^[A-Z]{3}$/.test(k) || label(k) === 'Tab' ? 'word' : ''}">${escapeHtml(label(k))}</button>`).join('')}`;
}

function wireMobile() {
  $('tabbar').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-view]');
    if (b) setView(b.dataset.view);
  });
  const saved = safeGet('zorewars.view');
  setView(['arena', 'code', 'details'].includes(saved) ? saved : 'arena');

  // On phones the side cards start folded, except the battle log.
  if (isPhone()) {
    $('inspectorCard').open = false;
    $('tourCard').open = false;
  }

  // Symbol bar: shown while the editor has focus on a touch screen, and kept
  // just above the on-screen keyboard.
  const bar = $('keybar');
  // The bar is pinned to the bottom edge of the *visual* viewport, which is
  // where the on-screen keyboard starts. Browsers disagree about how the
  // keyboard changes innerHeight, so nothing is measured from the page bottom.
  // While editing, the tab bar is hidden (it's behind the keyboard anyway).
  const place = () => {
    if (bar.hidden) return;
    const vv = window.visualViewport;
    if (!vv) { bar.style.top = ''; bar.style.bottom = '0px'; return; }
    bar.style.bottom = 'auto';
    bar.style.top = `${Math.round(vv.offsetTop + vv.height - bar.offsetHeight)}px`;
    showViewportDebug();
  };
  let raf = 0;
  const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); };
  const editorBox = $('codeEditor');
  editorBox.addEventListener('focusin', () => {
    if (!touchQuery.matches) return;
    renderKeybar();
    document.body.classList.add('editing');
    bar.hidden = false;
    place();
  });
  editorBox.addEventListener('focusout', () => setTimeout(() => {
    if (state.editor.hasFocus()) return;
    bar.hidden = true;
    document.body.classList.remove('editing');
  }, 150));
  window.visualViewport?.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('scroll', schedule);
  window.addEventListener('resize', schedule);

  // ?debug=viewport shows what the browser reports, for diagnosing
  // keyboard and toolbar behaviour on real phones.
  const debug = new URLSearchParams(location.search).get('debug') === 'viewport';
  function showViewportDebug() {
    if (!debug) return;
    let box = $('vpDebug');
    if (!box) {
      box = document.createElement('pre');
      box.id = 'vpDebug';
      box.style.cssText = 'position:fixed;top:4px;right:4px;z-index:99;margin:0;padding:6px 8px;font:11px/1.4 monospace;background:#000c;color:#0f0;border:1px solid #0f0;border-radius:6px;pointer-events:none';
      document.body.appendChild(box);
    }
    const vv = window.visualViewport;
    const r = bar.getBoundingClientRect();
    box.textContent = [
      `innerH ${window.innerHeight}  clientH ${document.documentElement.clientHeight}`,
      `vv.h ${vv ? Math.round(vv.height) : '-'}  vv.top ${vv ? Math.round(vv.offsetTop) : '-'}  scale ${vv ? vv.scale.toFixed(2) : '-'}`,
      `bar ${Math.round(r.top)}..${Math.round(r.bottom)}  dpr ${devicePixelRatio}`,
    ].join('\n');
  }
  if (debug) {
    window.visualViewport?.addEventListener('resize', showViewportDebug);
    showViewportDebug();
  }
  // pointerdown + preventDefault keeps focus (and the keyboard) in the editor.
  bar.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    e.preventDefault();
    if (b.dataset.act === 'left') state.editor.moveCursor(-1);
    else if (b.dataset.act === 'right') state.editor.moveCursor(1);
    else if (b.dataset.act === 'undo') state.editor.undo();
    else if (b.dataset.key) state.editor.insert(b.dataset.key);
  });
}

// ---------------------------------------------------------------- events

function wireEvents() {

  $('librarySelect').addEventListener('change', (e) => {
    const entry = libraryEntry(e.target.value);
    if (!entry) return;
    const slot = activeSlot();
    if (!isPristine(slot) && !confirm('Replace your edits with this warrior?')) { renderEditor(); return; }
    Object.assign(slot, { language: entry.language, source: entry.source, libFile: entry.file, origin: null, edited: false, compiled: null });
    saveSlots();
    renderEditor();
    compileSlot(slot);
  });

  $('languageSelect').addEventListener('change', (e) => {
    const slot = activeSlot();
    const lang = e.target.value;
    const pristine = isPristine(slot);
    slot.language = lang;
    if (pristine) Object.assign(slot, { source: TEMPLATES[lang], libFile: null, origin: null, edited: false });
    slot.compiled = null;
    saveSlots();
    renderEditor();
    compileSlot(slot);
  });

  $('removeSlot').addEventListener('click', removeSlot);
  $('runBtn').addEventListener('click', () => (state.running ? stopRunning() : startRunning()));
  $('stepBtn').addEventListener('click', () => {
    stopRunning();
    if (!state.vm) return;
    if (state.vm.done) newRound();
    stepVM(1);
    sampleChart();
    state.dirtyFrame = true;
  });
  $('resetBtn').addEventListener('click', newRound);
  $('finishBtn').addEventListener('click', finishFast);
  $('overlay').addEventListener('click', () => { if (state.vm?.done) newRound(); });
  $('pmBlow').addEventListener('click', showKillingBlow);
  $('convertRow').addEventListener('click', (e) => {
    const lang = e.target.closest('.linkbtn')?.dataset.lang;
    if (lang) convertActive(lang);
  });
  $('pmReplay').addEventListener('click', () => replayEnd());

  const speed = $('speed');
  const onSpeed = () => {
    state.stepsPerFrame = speedFromSlider(+speed.value);
    renderSpeed();
    safeSet('zorewars.speed', +speed.value);
  };
  speed.addEventListener('input', onSpeed);
  const savedSpeed = safeGet('zorewars.speed');
  if (typeof savedSpeed === 'number') speed.value = savedSpeed;
  onSpeed();

  const canvas = $('core');
  canvas.addEventListener('mousemove', (e) => {
    const a = renderer.addressAt(e.clientX, e.clientY);
    if (a !== state.hover) { state.hover = a; state.dirtyFrame = true; }
  });
  canvas.addEventListener('mouseleave', () => { state.hover = -1; state.dirtyFrame = true; });
  canvas.addEventListener('click', (e) => {
    const a = renderer.addressAt(e.clientX, e.clientY);
    state.pinned = a === state.pinned ? -1 : a;
    state.dirtyFrame = true;
  });

  $('tourBtn').addEventListener('click', runTournamentUI);

  $('applySettings').addEventListener('click', () => {
    const v = {};
    for (const [k, id] of Object.entries(SETTING_INPUTS)) {
      const n = parseInt($(id).value, 10);
      if (!Number.isFinite(n) || n < +$(id).min) { $(id).focus(); return; }
      v[k] = n;
    }
    applySettings(v);
  });
  $('resetSettings').addEventListener('click', () => applySettings({ ...DEFAULT_SETTINGS }));

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('textarea, input, select, [contenteditable], .cm-editor, dialog') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Space') { e.preventDefault(); $('runBtn').click(); }
    else if (e.key === 's' || e.key === 'S') $('stepBtn').click();
    else if (e.key === 'r' || e.key === 'R') newRound();
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { renderer.layout(state.settings.coreSize); state.dirtyFrame = true; }, 100);
  });
}

// ---------------------------------------------------------------- boot

async function boot() {
  const savedSettings = safeGet(SETTINGS_KEY);
  if (savedSettings) state.settings = { ...DEFAULT_SETTINGS, ...savedSettings };
  renderSettings();
  state.editor = await createCodeEditor($('codeEditor'), {
    textarea: $('source'), gutter: $('gutter'), onChange: onSourceChange,
    reservedBottom: () => ($('keybar').hidden ? Infinity : $('keybar').getBoundingClientRect().top),
  });
  wireEvents();
  wireImport();
  wireMobile();
  loadClassics();
  renderer.layout(state.settings.coreSize);
  try {
    await loadLibrary();
  } catch (e) {
    showOverlay('Could not load the warrior library', 'Serve the project with "npm start" rather than opening the file directly.');
    console.error(e);
  }
  const saved = safeGet(STORAGE_KEY);
  // ?url=<archive file>&vs=silk.red imports an original to fight a library
  // warrior (the encyclopedia's Hall of Fame links here).
  const params = new URLSearchParams(location.search);
  const remote = params.get('url');
  let pendingImport = null;
  if (remote) {
    const vs = libraryEntry(params.get('vs')) ? params.get('vs') : 'dwarf.red';
    state.slots = [makeSlot(null), makeSlot(vs)];
    state.slots[0].source = `; Loading ${remote}…\n`;
    pendingImport = remote;
    history.replaceState(null, '', location.pathname);
  }
  // ?load=imp.red,dwarf.red opens library warriors (used by the encyclopedia).
  const requested = (new URLSearchParams(location.search).get('load') || '')
    .split(',').map((f) => f.trim()).filter((f) => libraryEntry(f)).slice(0, MAX_SLOTS);
  if (pendingImport) {
    // slots set above
  } else if (requested.length) {
    if (requested.length === 1) requested.push(requested[0] === 'dwarf.red' ? 'imp.red' : 'dwarf.red');
    state.slots = requested.map((f) => makeSlot(f));
    saveSlots();
    history.replaceState(null, '', location.pathname);
  } else if (Array.isArray(saved) && saved.length) {
    state.slots = saved.slice(0, MAX_SLOTS).map((s) => ({ ...makeSlot(null), ...s, compiled: null }));
  } else {
    state.slots = [makeSlot('dwarf.red'), makeSlot('mice.red')];
  }
  renderEditor();
  if (pendingImport) {
    try {
      await importUrl(pendingImport, state.slots[0]);
    } catch (e) {
      state.slots[0].source = `; Could not import ${pendingImport}\n; ${e.message}\n`;
      renderEditor();
    }
  }
  await Promise.all(state.slots.map((s) => compileSlot(s)));
  state.booting = false;
  newRound();
  requestAnimationFrame(frame);
}

boot();
