// Battle execution, opponent loading and progress shared by developer commands.
import fs from 'node:fs';
import path from 'node:path';
import { createPool, libraryOpponents, classicOpponents, strip } from '../tools/hill.js';
import { createMatchBackend } from '../src/engine/match-backend.js';
import { rustEngine } from './rust-engine.js';

// Progress heartbeat. On an interactive terminal it redraws a single line
// (suppressed under --json so it never clutters piped output). When stderr is
// redirected to a file (a backgrounded run), it instead writes throttled,
// timestamped, newline-terminated lines — even under --json, since the JSON
// goes to stdout and stderr is free — so a long run records how far it got.
let progStart = 0, progLast = 0;
export const progress = (json, text) => {
  if (process.stderr.isTTY) { if (!json) process.stderr.write(`\r${text}\x1b[K`); return; }
  const now = Date.now();
  if (!progStart) progStart = now;
  if (now - progLast < 2000) return; // throttle: at most one log line every 2s
  progLast = now;
  process.stderr.write(`[+${Math.round((now - progStart) / 1000)}s] ${text}\n`);
};
export const done = (json) => {
  if (process.stderr.isTTY) { if (!json) process.stderr.write('\r\x1b[K'); return; }
  if (progStart) process.stderr.write(`[+${Math.round((Date.now() - progStart) / 1000)}s] done\n`);
  progStart = 0; progLast = 0;
};

export async function battlePool(flags, h) {
  const adapter = flags['gpu-adapter']?.trim();
  if (Object.hasOwn(flags, 'gpu-adapter') && (!adapter || adapter.startsWith('--'))) h.usage('--gpu-adapter needs a GPU name');
  const rust = flags.wasm || flags.native;
  const requestedBackend = flags.backend ?? (adapter ? 'gpu' : 'cpu');
  if (!['auto', 'cpu', 'gpu'].includes(requestedBackend)) h.usage('--backend takes auto, cpu or gpu');
  if (rust && (requestedBackend === 'gpu' || adapter)) h.usage('Rust execution needs a CPU backend');
  const backend = rust ? 'cpu' : requestedBackend;
  if (adapter && backend === 'cpu') h.usage('--gpu-adapter requires --backend gpu or auto');
  const positive = (key) => {
    if (flags[key] === undefined) return undefined;
    const value = Number(flags[key]);
    if (!Number.isSafeInteger(value) || value < 1) h.usage(`--${key} must be a positive integer`);
    return value;
  };
  const threads = positive('threads'), batchSize = positive('gpu-batch');
  const { native, wasmModule } = rustEngine(flags, h.usage);
  return createMatchBackend({ backend, createCpu: () => createPool(threads, { native, wasmModule }),
    createGpu: async () => (await import('../tools/gpu.js')).createGpuPool({ batchSize, adapter }),
    // To stderr, so it is safe (and worth knowing) under --json too.
    onFallback: (reason) => console.error(`Using CPU for battles: ${reason}`),
  });
}

export async function opponents(h, settings, flags, exclude) {
  const json = !!flags.json;
  // --hill koenigstuhl:94nop (or a folder): train against a real hill's top
  // warriors instead of the library.
  const field = flags.hill ? await hillOpponents(String(flags.hill), settings, flags) : libraryOpponents(settings, { exclude });
  if (flags.classics) {
    progress(json, 'Fetching the Hall of Fame classics from the public archives…');
    const missing = [];
    field.push(...await classicOpponents(settings, { onError: (name) => missing.push(name) }));
    done(json);
    if (missing.length && !json) console.error(`(could not load ${missing.length} classic${missing.length === 1 ? '' : 's'}: ${missing.join(', ')})`);
  }
  return field;
}

const KOENIGSTUHL = {
  '94nop': '94', '88': '88', lp: 'LP', '94x': 'X', pspace: 'PSPACE',
  icws: 'ICWS', icws64: 'ICWS64', tiny: 'TINY', nano: 'NANO',
};
// A whole number from a flag: "abc" and "2.9" are mistakes, not 0 and 2.
export function wholeNumber(flags, key, fallback, min = 1) {
  if (flags[key] === undefined) return fallback;
  const n = Number(flags[key]);
  if (!Number.isSafeInteger(n) || n < min) throw new Error(`--${key} must be a whole number of at least ${min}`);
  return n;
}

const HILL_FETCH_MS = 20000;
async function fetchHill(name, top, json) {
  const dir = KOENIGSTUHL[name];
  if (!dir) throw new Error(`unknown hill '${name}': use ${Object.keys(KOENIGSTUHL).map((k) => `koenigstuhl:${k}`).join(', ')}`);
  const base = `https://asdflkj.net/COREWAR/${dir}/`;
  const cache = path.join((await import('node:os')).tmpdir(), 'zorewars-hills', dir);
  fs.mkdirSync(cache, { recursive: true });
  const response = await fetch(`${base}hill32_rec.html`, { signal: AbortSignal.timeout(HILL_FETCH_MS) });
  if (!response.ok) throw new Error(`Could not load Koenigstuhl ${name}: HTTP ${response.status}`);
  const listing = await response.text();
  const files = [...new Set([...listing.matchAll(/href="(HILL(?:32)?\/[^"]+\.(?:red|rc|txt))"/gi)].map((m) => m[1]))].slice(0, top);
  const out = [];
  for (const [k, f] of files.entries()) {
    const local = path.join(cache, path.basename(f));
    if (!fs.existsSync(local) || !fs.statSync(local).size) {
      let res, text;
      try {
        res = await fetch(base + f, { signal: AbortSignal.timeout(HILL_FETCH_MS) });
        text = await res.text();
      } catch { res = null; }
      if (!res?.ok || !text.trim() || /^\s*<!DOCTYPE|^\s*<html/i.test(text)) { if (!json) console.error(`(could not fetch ${path.basename(f)})`); continue; }
      // Written beside the cache entry and renamed, so an interrupted run
      // never leaves half a warrior to be reused.
      const partial = `${local}.${process.pid}.part`;
      fs.writeFileSync(partial, text);
      fs.renameSync(partial, local);
    }
    out.push(local);
    progress(json, `hill: ${k + 1}/${files.length}`);
  }
  done(json);
  return out;
}
// Hill warriors aren't bound by the entry rules (the 94x hill's leaders use
// P-space, and many are longer than a tournament's limit), so games against
// them run with the limit raised; entries were checked when they compiled.
export function hillSettingsFor(settings) {
  if (settings.hillMaxLength !== undefined) return { ...settings, maxLength: settings.hillMaxLength };
  return { ...settings, pSpace: undefined, maxLength: Math.max(settings.maxLength, 200) };
}
export async function hillFiles(spec, top, json) {
  return spec.startsWith('koenigstuhl:') ? fetchHill(spec.slice(12).toLowerCase(), top, json)
    : fs.readdirSync(spec).filter((f) => !f.startsWith('.') && /\.(red|rc)$/i.test(f)).sort().slice(0, top).map((f) => path.join(spec, f));
}
export async function hillOpponents(spec, settings, flags) {
  const { compile } = await import('../src/engine/index.js');
  const { opponentTags } = await import('../tools/algebra/counters.js');
  const json = !!flags.json;
  const out = [];
  for (const f of await hillFiles(spec, wholeNumber(flags, 'top', 50), json)) {
    const w = compile(fs.readFileSync(f, 'utf8'), 'redcode', hillSettingsFor(settings));
    if (!w.ok) { if (!json) console.error(`(skipped ${path.basename(f)}: ${w.errors[0].message})`); continue; }
    // What its comments claim it is; tree evolution tags it by play (tagField).
    out.push({ name: w.name, group: 'hill', strategy: w.strategy, claimed: opponentTags({ name: w.name, strategy: w.strategy }), w: strip(w) });
  }
  return out;
}
