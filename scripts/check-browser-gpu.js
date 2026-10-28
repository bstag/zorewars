#!/usr/bin/env node
// Real-browser smoke test. Uses an isolated headless Chrome profile, loopback
// HTTP server and Chrome's debugging interface; no extra npm packages needed.
// node scripts/check-browser-gpu.js [--chrome C:/path/to/chrome.exe]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { EventEmitter, once } from 'node:events';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const args = process.argv.slice(2);
const chrome = args.includes('--chrome') ? args[args.indexOf('--chrome') + 1]
  : path.join(process.env.PROGRAMFILES ?? 'C:/Program Files', 'Google/Chrome/Application/chrome.exe');
const profile = path.join(root, 'evolved', 'browser-gpu-check', `profile-${Date.now()}`);
fs.mkdirSync(profile, { recursive: true });
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/smoke') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>GPU smoke test</title>'); return; }
  const file = path.resolve(root, `.${decodeURIComponent(url.pathname)}`, url.pathname.endsWith('/') ? 'index.html' : '');
  if (!file.startsWith(root + path.sep) || file.includes(`${path.sep}node_modules${path.sep}`)) { res.writeHead(403).end(); return; }
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml' })[path.extname(file)] ?? 'application/octet-stream');
  fs.readFile(file, (error, data) => { if (error) res.writeHead(404).end(); else res.end(data); });
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const child = spawn(chrome, ['--headless=new', '--window-size=1440,1000', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => {
    let stderr = '';
    const timeout = setTimeout(() => reject(new Error(`Chrome did not start: ${stderr.slice(-2000)}`)), 20000);
    child.on('error', (error) => { clearTimeout(timeout); reject(error); });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
  socket = new WebSocket(endpoint); await once(socket, 'open');
  const pending = new Map(), events = new EventEmitter(); let id = 0;
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id) { events.emit(`${message.sessionId}:${message.method}`, message.params); return; }
    const p = pending.get(message.id); if (!p) return;
    pending.delete(message.id); clearTimeout(p.timeout);
    if (message.error) p.reject(new Error(message.error.message)); else p.resolve(message.result);
  });
  const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const request = ++id;
    const timeout = setTimeout(() => { pending.delete(request); reject(new Error(`${method} timed out`)); }, 60000);
    pending.set(request, { resolve, reject, timeout }); socket.send(JSON.stringify({ id: request, method, params, sessionId }));
  });
  const target = await call('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await call('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  await call('Page.enable', {}, sessionId);
  const navigate = async (url) => { const loaded = once(events, `${sessionId}:Page.loadEventFired`); await call('Page.navigate', { url }, sessionId); await loaded; };
  const evaluate = async (expression) => {
    const r = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  await navigate(`${origin}/smoke`);
  console.error('Checking browser GPU worker, round state and CPU fallback…');
  const engine = await evaluate(`(async () => {
    const { compile, DEFAULT_SETTINGS } = await import('/src/engine/index.js');
    const { createBrowserMatchPool } = await import('/web/matches.js');
    const { createCpuMatchPool } = await import('/web/cpu-matches.js');
    const settings = { ...DEFAULT_SETTINGS, coreSize: 80, maxLength: 5, minDistance: 5, maxCycles: 200, maxProcesses: 8, rounds: 5 };
    const a = compile('SPL 0\\nMOV.I 0, 1', 'redcode', settings);
    const b = compile('STP.AB #9, #1\\nLDP.AB #1, 1\\nJMP -2', 'redcode', settings);
    const task = { a, b, settings, seed: 4242, diagnose: true, details: true,
      roundOptions: Array.from({ length: 5 }, (_, r) => ({ seed: 27 + r, firstTurn: (r + 1) % 2 })) };
    const gpu = await createBrowserMatchPool({ backend: 'gpu' }), cpu = createCpuMatchPool();
    let info;
    try {
      const actual = await gpu.match(task), expected = await cpu.match(task);
      if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error('browser GPU/CPU round state mismatch');
      const solo = await Promise.all([a, b].map((w) => gpu.measureSpecies(w, settings)));
      const soloCpu = await Promise.all([a, b].map((w) => cpu.measureSpecies(w, settings)));
      if (JSON.stringify(solo) !== JSON.stringify(soloCpu)) throw Error('browser GPU/CPU solo mismatch');
      info = { backend: gpu.backend, adapter: gpu.stats.adapter, rounds: actual.rounds.length, soloChecks: gpu.stats.soloChecks };
    } finally { gpu.close(); cpu.close(); }
    const fallback = await createBrowserMatchPool({ createWorker: () => { throw Error('worker blocked for test'); } });
    try { await fallback.match(task); info.fallback = fallback.backend; } finally { fallback.close(); }
    let failGpu = false;
    const switching = await createBrowserMatchPool({ createWorker: () => {
      const worker = new Worker('/web/match-worker.js', { type: 'module' });
      const send = worker.postMessage.bind(worker); let mode;
      worker.postMessage = data => {
        if (data.type === 'init') mode = data.backend;
        if (failGpu && mode === 'gpu' && data.type === 'match') queueMicrotask(() => worker.onerror({ message: 'GPU worker failed for recovery test' }));
        else send(data);
      };
      return worker;
    } });
    try {
      const before = await switching.match(task);
      if (switching.backend !== 'gpu') throw Error('recovery test did not start on GPU');
      failGpu = true;
      const after = await switching.match(task);
      if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('CPU retry changed the match result');
      info.recovered = switching.backend;
    } finally { switching.close(); }
    const stopped = await createBrowserMatchPool({ backend: 'gpu' });
    const pending = stopped.match({ ...task, roundOptions: undefined, settings: { ...settings, rounds: 1000, maxCycles: 1000000 } });
    stopped.close();
    try { await pending; throw Error('cancelled GPU job published a result'); }
    catch (error) { if (!error.message.includes('closed')) throw error; info.cancelled = true; }
    return info;
  })()`);
  assert.equal(engine.backend, 'gpu'); assert.equal(engine.fallback, 'cpu'); assert.equal(engine.recovered, 'cpu'); assert.equal(engine.cancelled, true);
  await navigate(`${origin}/web/`);
  console.error('Checking arena tournament and ladder UI…');
  const ui = await evaluate(`(async () => {
    const wait = (predicate) => new Promise((resolve, reject) => {
      const deadline = Date.now() + 30000;
      const poll = () => { if (predicate()) resolve(); else if (Date.now() > deadline) reject(Error('arena UI timed out: ' + JSON.stringify({ tournament: document.getElementById('tourResults').textContent, ladder: document.getElementById('ladderStatus').textContent, bar: document.getElementById('ladderBar').style.width }))); else setTimeout(poll, 50); }; poll();
    });
    await wait(() => document.querySelector('.cm-editor') && document.getElementById('scoreboard').children.length >= 2);
    document.getElementById('setMaxCycles').value = '200'; document.getElementById('applySettings').click();
    await new Promise(resolve => setTimeout(resolve, 100));
    document.getElementById('tourRounds').value = '3'; document.getElementById('tourBtn').click();
    await wait(() => document.getElementById('tourResults').textContent.includes('3 / 3 rounds'));
    const tournament = document.getElementById('tourResults').textContent;
    document.getElementById('tourRounds').value = '1000'; document.getElementById('tourBtn').click(); document.getElementById('tourBtn').click();
    await wait(() => document.getElementById('tourBtn').textContent === 'Run');
    const stopped = document.getElementById('tourResults').textContent;
    if (!stopped.includes('Stopped.')) throw Error('tournament Stop did not cancel startup');
    document.getElementById('ladderRounds').value = '2'; document.getElementById('ladderCard').open = true;
    await wait(() => document.getElementById('ladderBar').style.width === '100%');
    const ladder = document.getElementById('ladderBackend').innerText;
    return { tournament, ladder, stopped };
  })()`);
  assert.match(ui.tournament, /GPU/); assert.equal(ui.ladder, 'GPU');
  console.error('Checking live arena GPU playback, Step, replay, reset and CPU mode…');
  const live = await evaluate(`(async () => {
    const el = id => document.getElementById(id);
    const steps = () => Number(el('cycleOut').dataset.steps);
    const wait = predicate => new Promise((resolve, reject) => {
      const deadline = Date.now() + 30000;
      const poll = () => { if (predicate()) resolve(); else if (Date.now() > deadline) reject(Error('live UI timed out: ' + JSON.stringify({ status: el('liveBackendStatus').textContent, reason: el('liveBackendStatus').title, cycle: el('cycleOut').textContent, steps: steps(), log: el('log')?.textContent.slice(-300) }))); else setTimeout(poll, 25); }; poll();
    });
    el('resetBtn').click();
    await wait(() => el('liveBackendStatus').dataset.backend === 'gpu');
    const first = steps(); el('stepBtn').click();
    await wait(() => !el('stepBtn').disabled && steps() === first + 1);
    el('runBtn').click(); await wait(() => steps() > first + 4 || !el('pmCard').hidden);
    if (el('runLabel').textContent === 'Pause') el('runBtn').click();
    await wait(() => !el('stepBtn').disabled);
    const paused = steps(); await new Promise(r => setTimeout(r, 100));
    if (steps() !== paused) throw Error('live arena advanced after pause settled');
    if (el('pmCard').hidden) el('finishBtn').click();
    await wait(() => !el('pmCard').hidden && !el('finishBtn').disabled);
    const report = el('pmSummary').textContent, endedAt = steps();
    el('pmReplay').click();
    await wait(() => steps() < endedAt && el('liveBackendStatus').dataset.backend === 'gpu');
    const replayStep = steps(); el('stepBtn').click();
    await wait(() => !el('stepBtn').disabled && steps() === replayStep + 1);
    el('finishBtn').click(); await wait(() => !el('finishBtn').disabled);
    if (el('pmSummary').textContent !== report) throw Error('GPU replay changed the post-mortem');
    el('resetBtn').click(); await wait(() => el('liveBackendStatus').dataset.backend === 'gpu');
    el('finishBtn').click(); await new Promise(r => setTimeout(r, 0)); el('resetBtn').click();
    await wait(() => el('liveBackendStatus').dataset.backend === 'gpu');
    await new Promise(r => setTimeout(r, 100));
    if (steps() !== 0 || !el('pmCard').hidden) throw Error('a stale GPU result replaced the new round');
    el('setLiveBackend').value = 'cpu'; el('applySettings').click();
    await wait(() => el('liveBackendStatus').dataset.backend === 'cpu');
    el('stepBtn').click(); await wait(() => !el('stepBtn').disabled && steps() === 1);
    el('finishBtn').click(); await wait(() => !el('pmCard').hidden && !el('finishBtn').disabled);
    el('setLiveBackend').value = 'auto'; el('applySettings').click();
    await wait(() => el('liveBackendStatus').dataset.backend === 'gpu');
    el('stepBtn').click(); await wait(() => !el('stepBtn').disabled && steps() === 1);
    const originalMap = GPUBuffer.prototype.mapAsync; let failed = false;
    GPUBuffer.prototype.mapAsync = function(...args) {
      if (!failed) { failed = true; return Promise.reject(Error('Live GPU readback failed for test')); }
      return originalMap.apply(this, args);
    };
    try {
      el('stepBtn').click();
      await wait(() => !el('stepBtn').disabled && el('liveBackendStatus').dataset.backend === 'cpu' && steps() === 2);
      if (!el('liveBackendStatus').title.includes('readback failed')) throw Error('live fallback reason was lost');
    } finally { GPUBuffer.prototype.mapAsync = originalMap; }
    el('resetBtn').click(); await wait(() => el('liveBackendStatus').dataset.backend === 'gpu');
    return { backend: el('liveBackendStatus').textContent, singleStep: true, pause: true, replay: true, reset: true, cpuMode: true, readbackRecovery: true };
  })()`);
  await navigate(origin + '/web/?load=volume/backdraft.js,volume/volumequeen.js,volume/volumesilk.js,volume/scatter.js');
  console.error('Checking four-warrior live GPU volume…');
  const volume = await evaluate(`(async () => {
    const el = id => document.getElementById(id);
    const wait = predicate => new Promise((resolve, reject) => {
      const deadline = Date.now() + 30000;
      const poll = () => { if (predicate()) resolve(); else if (Date.now() > deadline) reject(Error('volume live UI timed out: ' + el('liveBackendStatus').textContent + ' ' + el('liveBackendStatus').title)); else setTimeout(poll, 50); }; poll();
    });
    await wait(() => document.querySelector('.cm-editor') && el('libraryLabel').textContent.includes('Backdraft'));
    el('setMinDistance').value = '5'; el('setMaxCycles').value = '300'; el('applySettings').click();
    await wait(() => el('scoreboard').children.length === 4 && el('liveBackendStatus').dataset.backend === 'gpu');
    el('finishBtn').click();
    await wait(() => !el('pmCard').hidden && !el('finishBtn').disabled);
    return { warriors: el('scoreboard').children.length, backend: el('liveBackendStatus').textContent, report: el('pmSummary').textContent };
  })()`);
  assert.equal(live.backend, 'GPU'); assert.equal(volume.warriors, 4); assert.equal(volume.backend, 'GPU');
  const noGpuScript = await call('Page.addScriptToEvaluateOnNewDocument', { source: "Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });" }, sessionId);
  await navigate(origin + '/web/?load=dwarf.red,imp.red');
  console.error('Checking automatic live CPU fallback without WebGPU…');
  const liveFallback = await evaluate(`(async () => {
    const el = id => document.getElementById(id);
    const wait = predicate => new Promise((resolve, reject) => {
      const deadline = Date.now() + 30000;
      const poll = () => { if (predicate()) resolve(); else if (Date.now() > deadline) reject(Error('live CPU fallback timed out')); else setTimeout(poll, 50); }; poll();
    });
    await wait(() => el('scoreboard').children.length === 2 && el('liveBackendStatus').dataset.backend === 'cpu');
    if (!el('liveBackendStatus').title.includes('WebGPU')) throw Error('automatic CPU fallback did not explain unavailable GPU');
    el('setMaxCycles').value = '200'; el('applySettings').click();
    el('stepBtn').click();
    await wait(() => !el('stepBtn').disabled && Number(el('cycleOut').dataset.steps) === 1);
    el('finishBtn').click(); await wait(() => !el('pmCard').hidden && !el('finishBtn').disabled);
    return { backend: el('liveBackendStatus').textContent, finished: true };
  })()`);
  await call('Page.removeScriptToEvaluateOnNewDocument', { identifier: noGpuScript.identifier }, sessionId);
  assert.equal(liveFallback.backend, 'CPU');
  console.log(JSON.stringify({ engine, ui, live, volume, liveFallback }, null, 2));
  socket.send(JSON.stringify({ id: ++id, method: 'Browser.close' }));
} finally {
  socket?.close(); child.kill(); server.close();
  const ownedProfiles = path.join(root, 'evolved', 'browser-gpu-check') + path.sep;
  if (path.resolve(profile).startsWith(ownedProfiles)) {
    try { await fs.promises.rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
    catch { console.error(`Chrome profile still in use; test files retained at ${profile}`); }
  }
}
