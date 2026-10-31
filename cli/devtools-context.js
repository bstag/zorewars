// Battle execution, opponent loading and progress shared by developer commands.
import fs from 'node:fs';
import path from 'node:path';
import { createPool, libraryOpponents, classicOpponents, strip } from '../tools/hill.js';
import { createMatchBackend } from '../src/engine/match-backend.js';

export const progress = (json, text) => { if (!json && process.stderr.isTTY) process.stderr.write(`\r${text}\x1b[K`); };
export const done = (json) => { if (!json && process.stderr.isTTY) process.stderr.write('\r\x1b[K'); };

export async function battlePool(flags, h) {
  const backend = flags.backend ?? 'cpu';
  if (!['auto', 'cpu', 'gpu'].includes(backend)) h.usage('--backend takes auto, cpu or gpu');
  const positive = (key) => {
    if (flags[key] === undefined) return undefined;
    const value = Number(flags[key]);
    if (!Number.isSafeInteger(value) || value < 1) h.usage(`--${key} must be a positive integer`);
    return value;
  };
  const threads = positive('threads'), batchSize = positive('gpu-batch');
  return createMatchBackend({ backend, createCpu: () => createPool(threads),
    createGpu: async () => (await import('../tools/gpu.js')).createGpuPool({ batchSize }),
    onFallback: (reason) => { if (!flags.json) console.error(`Using CPU for battles: ${reason}`); },
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

const KOENIGSTUHL = { '94nop': '94', '88': '88', lp: 'LP', '94x': 'X' };
async function fetchHill(name, top, json) {
  const dir = KOENIGSTUHL[name];
  if (!dir) throw new Error(`unknown hill '${name}': use ${Object.keys(KOENIGSTUHL).map((k) => `koenigstuhl:${k}`).join(', ')}`);
  const base = `https://asdflkj.net/COREWAR/${dir}/`;
  const cache = path.join((await import('node:os')).tmpdir(), 'zorewars-hills', dir);
  fs.mkdirSync(cache, { recursive: true });
  const listing = await (await fetch(`${base}hill32_rec.html`)).text();
  const files = [...new Set([...listing.matchAll(/href="(HILL32\/[^"]+\.red)"/gi)].map((m) => m[1]))].slice(0, top);
  const out = [];
  for (const [k, f] of files.entries()) {
    const local = path.join(cache, path.basename(f));
    if (!fs.existsSync(local)) {
      const res = await fetch(base + f);
      const text = await res.text();
      if (!res.ok || /^\s*<!DOCTYPE|^\s*<html/i.test(text)) { if (!json) console.error(`(could not fetch ${path.basename(f)})`); continue; }
      fs.writeFileSync(local, text);
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
export function hillSettingsFor(settings) { return { ...settings, pSpace: undefined, maxLength: Math.max(settings.maxLength, 200) }; }
export async function hillFiles(spec, top, json) {
  return spec.startsWith('koenigstuhl:') ? fetchHill(spec.slice(12).toLowerCase(), top, json)
    : fs.readdirSync(spec).filter((f) => /\.(red|rc)$/i.test(f)).map((f) => path.join(spec, f)).slice(0, top);
}
export async function hillOpponents(spec, settings, flags) {
  const { compile } = await import('../src/engine/index.js');
  const { opponentTags } = await import('../tools/algebra/counters.js');
  const json = !!flags.json;
  const out = [];
  for (const f of await hillFiles(spec, Math.max(1, parseInt(flags.top ?? '50', 10)), json)) {
    const w = compile(fs.readFileSync(f, 'utf8'), 'redcode', hillSettingsFor(settings));
    if (!w.ok) { if (!json) console.error(`(skipped ${path.basename(f)}: ${w.errors[0].message})`); continue; }
    // What its comments claim it is; tree evolution tags it by play (tagField).
    out.push({ name: w.name, group: 'hill', strategy: w.strategy, claimed: opponentTags({ name: w.name, strategy: w.strategy }), w: strip(w) });
  }
  return out;
}
