// Benchmarking a warrior against a field of opponents ("a hill"), in parallel
// on all CPU cores. Used by the CLI's hill, tune and evolve commands.
//
//   const pool = createPool();
//   const field = [...libraryOpponents(), ...await classicOpponents()];
//   const r = await evaluate(pool, warrior, field, { rounds: 20 });
//   pool.close();
//
// Scores are points per round (win 3, tie 1, loss 0) and the smooth score
// (a loss counts the share of the cycle limit survived), averaged over the
// opponents. With diagnose: true every match also reports why rounds were
// not won (see diagnoseRounds in src/engine/report.js).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { compile, inLibraryFor, measureSpecies, DEFAULT_SETTINGS } from '../src/engine/index.js';
import { fetchWarriorText, nameFromUrl } from '../cli/remote.js';
import { createWasmRingKernel } from '../src/engine/ring-duel-wasm.js';
import { createNativeRingKernel } from './ring-duel-native.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WARRIOR_DIR = path.join(ROOT, 'warriors');

// Only what the VM needs, so warriors can be posted to worker threads.
export const strip = (w) => ({
  name: w.name, author: w.author, start: w.start,
  instructions: w.instructions.map(({ op, mod, aMode, a, bMode, b }) => ({ op, mod, aMode, a, bMode, b })),
});

export function createPool(threads = os.cpus().length, { wasmModule, native = false } = {}) {
  const createRingKernel = native ? createNativeRingKernel() : wasmModule ? createWasmRingKernel(wasmModule) : undefined;
  let next = 0, closed = false, startupFailures = 0;
  const size = Math.max(1, threads);
  // Tasks wait in a queue and go to whichever thread is free, so one long
  // match doesn't hold up the short ones behind it. A thread that dies fails
  // only the match it was playing and is replaced.
  const queue = [];
  const idle = [];
  const workers = new Set();
  const dispatch = () => {
    while (queue.length && idle.length) {
      const job = queue.shift();
      const slot = idle.pop();
      try {
        slot.worker.postMessage({ ...job.task, id: job.id });
        slot.job = job;
      } catch (error) { // a task that can't be posted
        idle.push(slot);
        job.reject(error);
      }
    }
  };
  const spawn = () => {
    const slot = { worker: new Worker(new URL('./worker.js', import.meta.url), { workerData: { wasmModule, native } }), job: null };
    const settle = (error, msg) => {
      const job = slot.job;
      slot.job = null;
      if (job) error ? job.reject(error) : job.resolve(msg);
    };
    slot.worker.on('message', (msg) => {
      if (!slot.job || msg.id !== slot.job.id) return;
      settle(msg.error && new Error(msg.error), msg);
      startupFailures = 0;
      idle.push(slot);
      dispatch();
    });
    const died = (error) => {
      if (!workers.delete(slot)) return;
      const at = idle.indexOf(slot);
      if (at >= 0) idle.splice(at, 1);
      settle(error);
      if (closed) return;
      // Threads that keep dying before they answer anything can't be replaced
      // into working: stop instead of respawning forever.
      if (++startupFailures > size) {
        closed = true;
        for (const job of queue.splice(0)) job.reject(error);
        return;
      }
      spawn();
      dispatch();
    };
    slot.worker.on('error', died);
    slot.worker.on('exit', (code) => died(new Error(`CPU worker exited (code ${code})`)));
    workers.add(slot);
    idle.push(slot);
  };
  for (let i = 0; i < size; i++) spawn();
  return {
    size,
    match(task) {
      if (closed) return Promise.reject(new Error('CPU pool is closed'));
      return new Promise((resolve, reject) => {
        queue.push({ id: next++, task, resolve, reject });
        dispatch();
      });
    },
    async measureSpecies(warrior, settings) {
      if (closed) throw new Error('CPU pool is closed');
      // Keep the original local CPU path: per-program worker messages are
      // costly for scratch screening's many short-lived random programs.
      return measureSpecies(warrior, settings, createRingKernel);
    },
    close() {
      if (closed) return;
      closed = true;
      const error = new Error('CPU pool is closed');
      for (const job of queue.splice(0)) job.reject(error);
      for (const slot of [...workers]) {
        workers.delete(slot);
        if (slot.job) slot.job.reject(error);
        slot.worker.terminate();
      }
    },
  };
}

// The library's benchmark warriors (Redcode and JavaScript), as opponents.
// On a torus, warriors written for the ring may kill themselves (their
// constants assume ring arithmetic); they would only be free wins, so they
// are left out of the field.
const usable = (w, settings) => w.ok && (settings.topology !== 'torus' || measureSpecies(w, settings).survives);

// The library warriors for this battlefield (see inLibraryFor), as opponents.
export function libraryOpponents(settings = DEFAULT_SETTINGS, { exclude = [] } = {}) {
  const list = JSON.parse(fs.readFileSync(path.join(WARRIOR_DIR, 'index.json'), 'utf8')).filter((e) => inLibraryFor(e, settings));
  const out = [];
  for (const e of list) {
    if (exclude.includes(e.name) || exclude.includes(e.file)) continue;
    const w = compile(fs.readFileSync(path.join(WARRIOR_DIR, e.file), 'utf8'), e.language, settings);
    if (usable(w, settings)) out.push({ name: w.name, group: 'library', file: e.file, category: e.category, w: strip(w) });
  }
  return out;
}

// The Hall of Fame originals, fetched from the public archives each time
// (they are not ours to copy, so nothing is saved).
export async function classicOpponents(settings = DEFAULT_SETTINGS, { onError } = {}) {
  const hof = JSON.parse(fs.readFileSync(path.join(WARRIOR_DIR, 'encyclopedia.json'), 'utf8')).hallOfFame;
  const got = await Promise.all(hof.map(async (h) => {
    try {
      const { text, url } = await fetchWarriorText(h.url, { anyHost: true });
      const w = compile(text, 'redcode', settings);
      if (!w.ok) throw new Error(w.errors[0]?.message || 'does not compile');
      if (!usable(w, settings)) throw new Error('kills itself on this battlefield');
      if (w.name === 'Unnamed') w.name = nameFromUrl(url);
      return { name: h.name, group: 'classic', w: strip(w) };
    } catch (e) {
      onError?.(h.name, e);
      return null;
    }
  }));
  return got.filter(Boolean);
}

export async function evaluate(pool, warrior, field, { rounds = 20, seed = 1, settings = DEFAULT_SETTINGS, diagnose = false } = {}) {
  const me = strip(warrior);
  const cfg = { ...settings, rounds };
  const results = await Promise.all(field.map((o, i) => pool.match({ a: me, b: o.w, settings: cfg, seed: seed + i * 7, diagnose })));
  const rows = results.map((r, i) => ({
    name: field[i].name, group: field[i].group,
    w: r.w, l: r.l, t: r.t, pts: (3 * r.w + r.t) / rounds, smooth: r.smooth / rounds, ...(r.d ? { d: r.d } : {}),
  }));
  const avg = (xs, k) => (xs.length ? xs.reduce((s, r) => s + r[k], 0) / xs.length : 0);
  const groups = {};
  for (const g of new Set(rows.map((r) => r.group))) {
    const xs = rows.filter((r) => r.group === g);
    groups[g] = { score: avg(xs, 'pts'), smooth: avg(xs, 'smooth'), opponents: xs.length };
  }
  let symptoms = null;
  if (diagnose) {
    symptoms = { suicide: 0, converted: 0, early: 0, late: 0, tie: 0 };
    for (const r of rows) for (const k in symptoms) symptoms[k] += r.d[k];
  }
  return { score: avg(rows, 'pts'), smooth: avg(rows, 'smooth'), groups, rows, symptoms };
}
