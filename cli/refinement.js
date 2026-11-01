// Model-guided search orchestration; options and presentation have separate jobs.
import fs from 'node:fs';
import path from 'node:path';
import { strip } from '../tools/hill.js';
import { refine, claudeProposer } from '../tools/refine.js';
import { refineOptions } from './search-options.js';
import { battlePool, opponents, hillSettingsFor, progress, done } from './devtools-context.js';

async function defaultProposer(options) {
  if (typeof process.loadEnvFile === 'function' && fs.existsSync('.env')) process.loadEnvFile('.env');
  return claudeProposer(options);
}

function reportRefinement(r, { json, out, search }, name, fieldSize) {
  if (json) { console.log(JSON.stringify({ ok: true, out, ...r, source: undefined }, null, 2)); return; }
  console.log(`Refined ${name} against ${fieldSize} opponents: ${search.iterations} iterations of ${search.variants} rewrites each.\n`);
  for (const e of r.log) {
    if (e.error) { console.log(`iteration ${e.iteration}: stopped: ${e.error}`); continue; }
    console.log(`iteration ${e.iteration}: current ${e.text}, worst against ${e.worst.join(', ') || 'nobody'}; the model took ${e.turns} turns (${e.calls.check} checks, ${e.calls.battle} battles, ${e.calls.score} field scores)`);
    for (const v of e.variants) console.log(`  ${v.text}  ${v.idea}`);
    if (e.check) console.log(`  fresh seeds: ${e.check.gain >= 0 ? '+' : ''}${e.check.gain.toFixed(3)} ± ${e.check.margin.toFixed(3)} ${r.objective === 'pushoff' ? 'places' : 'pts/round'} -> ${e.kept ? 'kept' : 'within the noise, not kept'}`);
  }
  console.log(`\n${r.improved ? `Improved (${r.idea})` : 'No rewrite beat the starting warrior by more than the noise'} -> ${out}`);
  console.log(`Model tokens${r.cost !== null ? ` (about $${r.cost.toFixed(2)} of a $${search.budget.toFixed(2)} budget)` : ''}: ${r.usage.input_tokens} in, ${r.usage.cache_read_input_tokens} read from the cache, ${r.usage.cache_creation_input_tokens} written to it, ${r.usage.output_tokens} out.`);
}

// Model creation is injectable for offline use. The same command still loads
// real warriors, evaluates drafts and writes the chosen source and full log.
export async function cmdRefine(args, h, { createProposer = defaultProposer, createPool = battlePool } = {}) {
  const request = refineOptions(args, h.usage);
  const { file, flags, json, out, search } = request;
  const settings = h.settingsFrom(flags);
  const source = fs.readFileSync(file, 'utf8');
  const [w] = await h.loadAll([file], settings, json);
  const entrySettings = { ...settings };
  const field = await opponents(h, settings, flags, [w.name, path.basename(file)]);
  if (!field.length) h.usage('no opponents compiled for this battlefield');
  const partners = flags.partner ? await h.loadAll(h.expandRefs(String(flags.partner).split(',')), entrySettings, json) : [];
  if (flags.hill) Object.assign(settings, hillSettingsFor(settings));
  const pool = await createPool(flags, h);
  try {
    const propose = await createProposer(request.proposer);
    const r = await refine({ ...search, pool, source, field, settings, entrySettings, propose, partners: partners.map(strip),
      onProgress: text => progress(json, text) });
    done(json);
    fs.mkdirSync(path.dirname(out) || '.', { recursive: true });
    fs.writeFileSync(out, r.source);
    fs.writeFileSync(out.replace(/\.(red|rc)$/i, '') + '.refine.json', JSON.stringify(r, null, 1));
    reportRefinement(r, request, w.name, field.length);
  } finally { pool.close(); }
}
