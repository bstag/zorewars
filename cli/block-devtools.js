import fs from 'node:fs';
import path from 'node:path';
import { RULESETS } from '../src/engine/index.js';
import { libraryOpponents, classicOpponents, evaluate } from '../tools/hill.js';
import { recipeFamilies } from '../tools/blocks/registry.js';
import { evolveBlocks } from '../tools/block-evolve.js';
import { validateCandidates } from '../tools/training.js';
import { genomeOf } from '../tools/genes.js';
import { genomeId } from '../tools/evolve.js';

export async function cmdEvolveBlocks(args, h, { quiet, battlePool, hillOpponents, hillSettingsFor }) {
  const f = args.flags;
  const supported = new Set(['representation', 'rules', 'length', 'genome', 'families', 'generations', 'population', 'batch', 'batches',
    'eval-rounds', 'rounds', 'local-steps', 'seed', 'objective', 'ties', 'algorithm', 'selection', 'hill', 'top', 'king', 'classics',
    'out', 'json', 'backend', 'threads', 'gpu-batch', 'validate', 'seeds', 'check-rounds', 'finalists', 'partner', 'field-rounds']);
  for (const key of Object.keys(f)) if (!supported.has(key)) h.usage(`--${key} is not supported with --representation blocks`);
  if (f.algorithm && f.algorithm !== 'ga') h.usage('Block recipes currently use --algorithm ga');
  if (f.selection && !['default', 'lexicase'].includes(f.selection)) h.usage('Block recipes use lexicase selection');
  const rules = String(f.rules ?? '94x');
  if (!Object.hasOwn(RULESETS, rules)) h.usage('Blocks require a standard --rules profile');
  const integer = (key, fallback, min = 1) => {
    const n = Number(f[key] ?? fallback);
    if (!Number.isSafeInteger(n) || n < min) h.usage(`--${key} must be an integer >= ${min}`);
    return n;
  };
  const length = Math.min(integer('length', 50), integer('genome', f.length ?? 50));
  if (length > RULESETS[rules].maxLength) h.usage('Block length exceeds the profile limit');
  const generations = integer('generations', 3), populationSize = integer('population', 12),
    offspring = integer('batch', 12) * integer('batches', 1), rounds = integer('eval-rounds', f.rounds ?? 6),
    localSteps = integer('local-steps', 0, 0), seed = integer('seed', 1, 0),
    seeds = integer('seeds', 3, 2), checkRounds = integer('check-rounds', 30), finalists = integer('finalists', 6);
  const objective = f.objective ?? 'points', tieValue = Number(f.ties ?? 0.5), fieldRounds = integer('field-rounds', 50);
  if (!['points', 'smooth', 'pushoff'].includes(objective)) h.usage('Block objective takes points, smooth or pushoff');
  if (objective === 'pushoff' && !f.hill) h.usage('--objective pushoff ranks in a hill: add --hill');
  if (f.partner && objective !== 'pushoff') h.usage('--partner needs --objective pushoff');
  if (!Number.isFinite(tieValue) || tieValue < 0 || tieValue > 1 || seed > 2147483646) h.usage('Invalid ties or seed');
  const families = f.families ? String(f.families).split(',') : Object.keys(recipeFamilies).filter(k => recipeFamilies[k].rules.includes(rules));
  if (!families.length || new Set(families).size !== families.length || families.some(k => !Object.hasOwn(recipeFamilies, k) || !recipeFamilies[k].rules.includes(rules))) h.usage('Unknown, duplicate or unsupported block family');
  if (populationSize < families.length) h.usage('--population must be at least the number of families');
  const initial = args._.map(file => {
    if (!file.endsWith('.recipe.json')) h.usage('Block seeds must be exported .recipe.json files; use --king for Redcode opponents');
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (saved.rules && saved.rules !== rules) h.usage('Seed recipe rules do not match --rules');
    return saved.recipe ?? saved;
  });
  const entrySettings = { ...RULESETS[rules], maxLength: length }, settings = { ...RULESETS[rules] };
  const field = f.hill ? await hillOpponents(String(f.hill), settings, f) : libraryOpponents(settings);
  if (!field.length) h.usage('No opponents compiled');
  if (f.hill) Object.assign(settings, hillSettingsFor(settings));
  // --partner a.red,b.red: our other entries, ranked beside each candidate.
  const partners = f.partner ? await h.loadAll(h.expandRefs(String(f.partner).split(',')), entrySettings, !!f.json) : [];
  const kings = f.king ? await h.loadAll(h.expandRefs(String(f.king).split(',')), entrySettings, !!f.json) : [];
  const heldOut = f.classics ? await classicOpponents(settings) : [];
  const out = path.resolve(f.out ?? 'evolved/blocks');
  if (fs.existsSync(out) && fs.readdirSync(out).length) h.usage('Use an empty output directory to preserve experiment history');
  fs.mkdirSync(out, { recursive: true });
  const save = (name, x) => {
    fs.writeFileSync(path.join(out, name + '.red'), x.source);
    fs.writeFileSync(path.join(out, name + '.js'), x.generator);
    fs.writeFileSync(path.join(out, name + '.recipe.json'), JSON.stringify({ schemaVersion: 1, rules, length, recipe: x.recipe,
      id: x.id, sections: x.sections, instructions: x.w.instructions.length, verification: x.verification }, null, 2));
  };
  const pool = await battlePool(f, h);
  try {
    const r = await evolveBlocks({ pool, opponents: field, settings, rules, length, families, initial, kings,
      populationSize, offspring, generations, rounds, localSteps, seed, objective, tieValue, partners, fieldRounds,
      onGeneration: async (record, champion) => {
        if (heldOut.length) record.heldOut = await evaluate(pool, champion.w, heldOut, { settings, rounds, seed: seed + record.generation * 10000 });
        save(`redqueen-${record.generation}`, champion);
        const placed = record.places ? `, push-off place ${record.places[0]}${record.places.length > 1 ? ` (partners ${record.places.slice(1).join(', ')})` : ''}` : '';
        if (!quiet && !f.json) console.log(`generation ${record.generation}: ${record.family}, ${champion.w.instructions.length} instructions, ${record.score.toFixed(3)} points${placed}, ${record.ancestorCount} ancestors`);
      } });
    save('baseline', r.baseline);
    for (const family of families) {
      const best = r.population.find(x => x.recipe.family === family); if (best) save(`elite-${family}`, best);
    }
    if (f.validate) {
      const candidates = [...r.population, ...r.champions.slice().reverse()].map(x => ({ ...x, g: genomeOf(x.w) }));
      const baseline = { ...r.baseline, g: genomeOf(r.baseline.w) };
      r.validation = await validateCandidates({ pool, baseline, candidates, field, settings, seed, seeds, rounds: checkRounds, finalists, objective, partners, fieldRounds });
      const best = [baseline, ...candidates].find(x => genomeId(x.g) === r.validation.recommended);
      save('best', best);
    }
    r.inputs = { opponents: field, kings, heldOut, partners };
    r.execution = structuredClone(pool.stats);
    fs.writeFileSync(path.join(out, 'evolve.json'), JSON.stringify(r, null, 2));
    if (!quiet) console.log(f.json ? JSON.stringify({ ok: true, out, config: r.config, stats: r.stats, execution: r.execution, history: r.history,
      validation: r.validation }, null, 2) : `Saved recipes, generators, lineage and verification in ${out}`);
    return r;
  } finally { await pool.close(); }
}
