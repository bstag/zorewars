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

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WARRIOR_DIR = path.join(ROOT, 'warriors');

// Only what the VM needs, so warriors can be posted to worker threads.
export const strip = (w) => ({
  name: w.name, author: w.author, start: w.start,
  instructions: w.instructions.map(({ op, mod, aMode, a, bMode, b }) => ({ op, mod, aMode, a, bMode, b })),
});

export function createPool(threads = os.cpus().length) {
  let next = 0;
  const pending = new Map();
  const workers = Array.from({ length: Math.max(1, threads) }, () => {
    const w = new Worker(new URL('./worker.js', import.meta.url));
    w.on('message', (msg) => {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error)); else p.resolve(msg);
    });
    w.on('error', (e) => { for (const p of pending.values()) p.reject(e); pending.clear(); });
    return w;
  });
  return {
    size: workers.length,
    match(task) {
      const id = next++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        workers[id % workers.length].postMessage({ ...task, id });
      });
    },
    close() { for (const w of workers) w.terminate(); },
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
