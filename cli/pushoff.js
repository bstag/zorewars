// Live tournament execution and replay share ranking, but replay needs no
// battlefield, warrior loading or battle workers.
import { roundRobin } from '../tools/pushoff.js';
import { strip } from '../tools/hill.js';
import { pushOff, validatePushOffOptions } from '../src/engine/pushoff.js';
import { battlePool, hillOpponents, hillSettingsFor, progress, done } from './devtools-context.js';
import { loadPushoffRecord, savePushoffRecord } from './pushoff-record.js';

function integer(flags, key, fallback, usage, positive = true) {
  const value = Number(flags[key] ?? fallback);
  if (!Number.isSafeInteger(value) || (positive && value < 1)) usage(`--${key} must be ${positive ? 'a positive integer' : 'a safe integer'}`);
  return value;
}

function requestFrom(args, usage) {
  const flags = args.flags, rule = flags.rule ?? 'official';
  if (!['official', 'announcement'].includes(rule)) usage('pushoff --rule official|announcement');
  const variant = rule === 'official' ? { rule } : { features: flags.features ?? 'points', metric: flags.metric ?? 'sd', self: !!flags.self, field: flags.field ?? 'original' };
  try { validatePushOffOptions(variant); } catch (error) { usage(error.message); }
  const base = { json: !!flags.json, variant };
  if (flags.load) return { ...base, load: String(flags.load) };
  if (!args._.length || !flags.hill) usage('pushoff <entry...> --hill koenigstuhl:94nop|88|lp|94x (or a folder) [--rounds 50] [--save file] | pushoff --load file [--rule official|announcement]');
  return { ...base, top: Math.max(2, integer(flags, 'top', 50, usage)), rounds: Math.max(2, integer(flags, 'rounds', 50, usage)),
    seed: integer(flags, 'seed', 1, usage, false), save: flags.save ? String(flags.save) : null };
}

function showRanking(record, { json, variant }, h) {
  const ranked = pushOff(record.scores, record.warriors.map(w => w.name), { ...variant, results: record.results })
    .map(r => ({ ...r, entry: record.warriors[r.index].entry }));
  if (json) { console.log(JSON.stringify({ ok: true, variant, ranking: ranked.map(({ index, ...r }) => r) }, null, 2)); return; }
  h.printTable(ranked.slice(0, 25).concat(ranked.filter(r => r.entry && r.rank > 25)).map(r => ({
    Rank: r.rank, Warrior: `${r.entry ? '★ ' : ''}${r.name}`, 'Avg pts': r.avg.toFixed(2), Diversity: r.div.toFixed(2), Score: r.score.toFixed(2),
  })));
  for (const r of ranked.filter(r => r.entry)) console.log(`\n★ ${r.name}: rank ${r.rank} of ${ranked.length}`);
}

export async function cmdPushoff(args, h, { createPool = battlePool } = {}) {
  const request = requestFrom(args, h.usage);
  if (request.load) { showRanking(loadPushoffRecord(request.load, request.variant, h.usage), request, h); return; }
  const { json, rounds, seed, variant, save } = request, flags = args.flags;
  const settings = h.settingsFrom(flags), hillSettings = hillSettingsFor(settings);
  const entries = await h.loadAll(h.expandRefs(args._), settings, json);
  if (!entries.length) h.usage('pushoff needs at least one entry');
  const hill = await hillOpponents(String(flags.hill), settings, { ...flags, top: request.top });
  if (!hill.length) h.usage('no opponents compiled for this battlefield');
  const all = [...entries.map(w => ({ w, entry: true })), ...hill.map(({ w }) => ({ w, entry: false }))];
  if (!json) console.log(`Push-off: ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} + ${hill.length} hill warriors, ${rounds} rounds a pair (core ${settings.coreSize}, ${settings.maxProcesses} processes, ${settings.maxCycles} cycles)\n`);
  const pool = await createPool(flags, h);
  try {
    const matrices = await roundRobin(pool, all.map(x => strip(x.w)), { rounds, seed, settings: hillSettings, self: variant.self || !!save,
      onProgress: (i, n) => progress(json, `round robin: ${i}/${n}`) });
    done(json);
    const record = { rounds, settings: { coreSize: settings.coreSize, maxProcesses: settings.maxProcesses, maxCycles: settings.maxCycles, maxLength: settings.maxLength },
      warriors: all.map(x => ({ name: x.w.name, entry: x.entry })), ...matrices };
    if (save) savePushoffRecord(save, record);
    showRanking(record, request, h);
  } finally { pool.close(); }
}
