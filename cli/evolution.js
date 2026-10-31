// Evolution command dispatch, instruction search output and training campaigns.
import fs from 'node:fs';
import path from 'node:path';
import { libraryOpponents, strip } from '../tools/hill.js';
import { evolve } from '../tools/evolution/instructions/index.js';
import { validateInstructionSearch } from '../tools/evolution/instructions/options.js';
import { trainingProfiles, validateCandidates } from '../tools/training.js';
import { roleOf, toRedcode } from '../tools/genes.js';
import { makeGeometry } from '../src/engine/geometry.js';
import { cmdEvolveTrees } from './tree-evolution.js';
import { battlePool, opponents, hillOpponents, hillSettingsFor, progress, done } from './devtools-context.js';

export async function cmdEvolve(args, h, { quiet = false } = {}) {
  if (args.flags.representation === 'blocks') {
    const { cmdEvolveBlocks } = await import('./block-devtools.js');
    return cmdEvolveBlocks(args, h, { quiet, battlePool, hillOpponents, hillSettingsFor });
  }
  if (args.flags.representation === 'tree') return cmdEvolveTrees(args, h, { quiet });
  if (args.flags.representation && args.flags.representation !== 'instructions') h.usage('--representation takes instructions, blocks or tree');
  const settings = h.settingsFrom(args.flags);
  const json = !!args.flags.json;
  const integer = (key, fallback, min = 1) => {
    const n = Number(args.flags[key] ?? fallback);
    if (!Number.isSafeInteger(n) || n < min) h.usage(`--${key} must be an integer >= ${min}`);
    return n;
  };
  const generations = integer('generations', 6);
  const batches = integer('batches', 4);
  const batchSize = integer('batch', 40);
  const seed = integer('seed', 1, 0);
  if (seed > 2147483646) h.usage('--seed must be <= 2147483646');
  const algorithm = args.flags.algorithm ?? 'map-elites';
  const objective = args.flags.objective ?? 'smooth';
  const selection = args.flags.selection ?? 'default';
  const descriptor = args.flags.descriptor ?? 'species';
  const epsilon = args.flags.epsilon === undefined || args.flags.epsilon === 'auto' ? 'auto' : Number(args.flags.epsilon);
  if (objective === 'pushoff' && args.flags.scratch) h.usage('--objective pushoff ranks against a field: not with --scratch');
  const tieValue = Number(args.flags.ties ?? 0.5);
  const evalRounds = integer('eval-rounds', args.flags.rounds ?? 6);
  const populationSize = integer('population', batchSize);
  const archiveSize = integer('archive-size', 64);
  const localSteps = integer('local-steps', 0, 0);
  const checkRounds = integer('check-rounds', 30);
  const seeds = integer('seeds', 3, 2);
  const finalists = integer('finalists', 6);
  const out = args.flags.out ?? 'evolved';
  // Gene pool and starting opponents: the library, plus any warriors given.
  // --scratch: none of that. Random programs, scored only against each
  // other's champions; the library is only held out, to report progress.
  const scratch = !!args.flags.scratch;
  const fieldRounds = integer('field-rounds', 50);
  const league = !!args.flags.league;
  const exploitWin = Number(args.flags['exploit-win'] ?? 2);
  if (!Number.isFinite(exploitWin)) h.usage('--exploit-win takes a number of points per round');
  const exploitAge = integer('exploit-age', 6);
  const race = integer('race', 0, 0);
  const maxLength = Math.min(settings.maxLength, integer('genome', 40));
  try {
    validateInstructionSearch({ algorithm, selection, epsilon, descriptor, localSteps, race,
      objective, tieValue, league, scratch, exploitWin, exploitAge });
  } catch (error) { h.usage(error.message); }
  // Separate the legal opponent field from additional sources of genes.
  const library = libraryOpponents(settings);
  // '88 uses its actual adapted library for opponents. Additional '94 genes
  // may be bent into '88, but must never become illegal '88 opponents.
  const genes = settings.dialect === '88' ? [...library, ...libraryOpponents({ ...settings, dialect: undefined })] : library;
  const hill = args.flags.hill ? await hillOpponents(String(args.flags.hill), settings, args.flags) : null;
  const field = scratch ? [] : hill ?? library;
  const extra = args._.length ? await h.loadAll(h.expandRefs(args._), settings, json) : [];
  const sources = [
    ...(scratch ? [] : genes).map((o) => ({ w: o.w, role: roleOf(`${o.category} ${o.name}`) })),
    ...extra.map((w) => ({ w: strip(w), role: roleOf(`${w.name} ${w.strategy || ''}`) || 'paper' })),
  ];
  const classics = args.flags.classics ? await opponents(h, settings, { ...args.flags, classics: true }, []).then((f) => f.filter((x) => x.group === 'classic')) : [];
  const heldOut = scratch ? [...library, ...classics] : classics;
  // --king a.js,b.red: start the Red Queen with these as champions (they
  // also join the gene pool and the starting population).
  const kings = args.flags.king ? await h.loadAll(h.expandRefs(String(args.flags.king).split(',')), settings, json) : [];
  for (const w of kings) sources.push({ w: strip(w), role: roleOf(`${w.name} ${w.strategy || ''}`) || 'paper' });
  // --partner a.red,b.red: our other entries, ranked beside each candidate (--objective pushoff).
  const partners = args.flags.partner ? await h.loadAll(h.expandRefs(String(args.flags.partner).split(',')), settings, json) : [];
  if (partners.length && objective !== 'pushoff') h.usage('--partner needs --objective pushoff');
  const entrySettings = { ...settings };
  if (hill) Object.assign(settings, hillSettingsFor(settings));   // genomes keep the entry limit above
  if (!scratch && !field.length) h.usage('no opponents compiled for this battlefield');
  fs.mkdirSync(out, { recursive: true });
  const pool = await battlePool(args.flags, h);
  try {
    if (!json) console.log(`Evolving${scratch ? ' from scratch' : ''}: ${generations} Red Queen generations, ${batches}x${batchSize} children each, ${scratch ? 'random programs, no gene pool' : `${sources.length} warriors in the gene pool`}, genomes up to ${maxLength} instructions${kings.length ? `, starting champions: ${kings.map((k) => k.name).join(', ')}` : ''}${heldOut.length ? `, ${heldOut.length} ${scratch ? 'library warriors and classics' : 'classics'} held out` : ''}\n`);
    const geo = settings.topology === 'torus' ? makeGeometry(settings) : null;
    const r = await evolve({
      pool, sources, opponents: field, heldOut, settings, entrySettings, rounds: generations, batches, batchSize,
      maxLength, kings, scratch, seed, algorithm, objective, evalRounds, populationSize, tieValue, partners, fieldRounds,
      selection, epsilon, descriptor, archiveSize, localSteps, league, exploitWin, exploitAge, race,
      onLog: (t) => progress(json, t),
      onRound: (rec) => {
        done(json);
        const c = rec.champion;
        const file = path.join(out, `redqueen-${rec.round}.red`);
        fs.writeFileSync(file, toRedcode(c.g, { name: c.name, coreSize: settings.coreSize, geo, dialect: settings.dialect, strategy: `Champion of Red Queen generation ${rec.round} (zorewars evolve): ${c.species.hint}, ${c.species.processes} processes, ${c.species.coverage} cells.` }));
        for (const [x, prefix, what] of [[rec.exploiter, 'exploiter', 'exploiter: beats the champion before it'], [rec.leagueExploiter, 'league', 'league exploiter: beats the league']]) {
          if (x) fs.writeFileSync(path.join(out, `${prefix}-${rec.round}.red`), toRedcode(x.g, { name: x.name, coreSize: settings.coreSize, geo, dialect: settings.dialect, strategy: `Generation ${rec.round} ${what} (zorewars evolve --league): ${x.species.hint}.` }));
        }
        if (json) return;
        const vs = c.vsAncestors ? ` | vs ancestors ${(c.vsAncestors.reduce((s, x) => s + x.pts, 0) / c.vsAncestors.length).toFixed(2)} pts/round` : '';
        const held = c.heldOut ? ` | held-out ${scratch ? 'library' : 'classics'} ${c.heldOut.score.toFixed(2)}` : '';
        const fitText = c.places ? `push-off place ${c.places[0]}${c.places.length > 1 ? ` (partners ${c.places.slice(1).join(', ')})` : ''}` : `fitness ${c.fit.toFixed(2)}`;
        const side = rec.exploiter ? ` | exploiter ${rec.exploiter.fit.toFixed(2)}${rec.exploiter.restart ? ' (restarts)' : ''}, league exploiter ${rec.leagueExploiter.fit.toFixed(2)}` : '';
        console.log(`generation ${rec.round}: ${rec.cells} ${algorithm === 'ga' ? 'population members' : `${descriptor} cells`} (${rec.placed} archive updates) | champion ${fitText}, ${c.species.hint}, ${c.g.code.length} instructions${vs}${held}${side}  -> ${file}`);
      },
    });
    for (const x of r.archive) {
      const [p, c, shape] = x.cell.split(',');
      const tag = descriptor === 'outcomes' ? x.cell : `p${p}-c${c}${shape ? `-s${shape}` : ''}`;
      fs.writeFileSync(path.join(out, `elite-${tag}.red`), toRedcode(x.g, { name: `Elite ${tag.replaceAll('-', ' ')}`, coreSize: settings.coreSize, geo, dialect: settings.dialect, strategy: `Best evolved ${x.species.hint} (${x.species.processes} processes, ${x.species.coverage} cells), zorewars evolve.` }));
    }
    r.inputs = {
      sources: sources.map((s) => ({ name: s.w.name, role: s.role, w: s.w })),
      opponents: field, heldOut, kings: kings.map(strip), partners: partners.map(strip),
    };
    if (args.flags.validate) {
      // Scratch remains independent of the library: validate against its
      // champion lineage, rather than using the held-out library to select.
      const validationField = scratch ? r.champions.map((c) => ({ name: c.name, group: 'champion', w: c.w })) : field;
      r.validation = await validateCandidates({ pool, baseline: r.baseline,
        candidates: [...(r.population ?? r.archive), ...r.champions.slice().reverse()], field: validationField,
        settings, seed, seeds, rounds: checkRounds, finalists, objective, partners, fieldRounds,
        onProgress: (i, n) => progress(json, `Validating finalist ${i}/${n} on fresh placements…`),
      });
      const best = r.validation.results.find((c) => c.id === r.validation.recommended);
      fs.writeFileSync(path.join(out, 'best.red'), toRedcode(best.g, { name: `Recommended ${algorithm}`, coreSize: settings.coreSize, geo,
        dialect: settings.dialect, strategy: r.validation.improved ? `Validated ${objective} improvement over starting baseline (gain ${best.gain.toFixed(3)}).` : 'Starting baseline retained: no finalist cleared the validation noise margin.' }));
      if (!json) console.log(`\nValidation: ${r.validation.improved ? 'improved version' : 'starting baseline retained'} -> ${path.join(out, 'best.red')}`);
    }
    r.execution = pool.stats ? structuredClone(pool.stats) : { backend: 'cpu', threads: pool.size };
    fs.writeFileSync(path.join(out, 'evolve.json'), JSON.stringify(r, null, 1));
    if (quiet) return r;
    if (!json && race) console.log(`
Racing: ${r.stats.raced} children raced past the screen, ${r.stats.promoted} took a cell; ${r.stats.battleRounds} battle rounds in all.`);
    if (json) { console.log(JSON.stringify({ ok: true, out, config: r.config, execution: r.execution, stats: r.stats, validation: r.validation, champions: r.champions.map(({ w, ...c }) => c), archive: r.archive, operators: r.operators }, null, 2)); return r; }
    console.log(`\nFinal archive: ${r.archive.length} ${descriptor} niches, best first`);
    h.printTable(r.archive.slice(0, 12).map((x) => ({ Cell: x.cell, Usually: x.species.hint, Processes: x.species.processes, 'Cells run': x.species.coverage, Length: x.g.code.length, Fitness: x.fit.toFixed(2) })));
    console.log(`\nWritten to ${out}/: redqueen-N.red (each generation's champion), elite-*.red (niche elites), evolve.json.`);
    console.log(`Try one: zorewars hill ${out}/redqueen-${generations}.red --classics`);
    return r;
  } finally { pool.close(); }
}

export async function cmdTrain(args, h) {
  if (args.flags.representation && !['instructions', 'blocks'].includes(args.flags.representation)) {
    h.usage('train --representation takes instructions or blocks; use evolve for tree search');
  }
  let profiles;
  try { profiles = trainingProfiles(args.flags.profiles); } catch (e) { h.usage(e.message); }
  if (args.flags.rules || args.flags.torus) h.usage('train selects battlefields with --profiles; use evolve for custom --rules/--torus');
  const out = args.flags.out ?? path.join('evolved', 'training');
  fs.mkdirSync(out, { recursive: true });
  const campaign = { ok: true, profiles: [] };
  for (const profile of profiles) {
    if (!args.flags.json) console.log(`Training ${profile.name}…`);
    const directory = path.join(out, profile.name);
    const r = await cmdEvolve({ _: args._, flags: { ...args.flags, ...profile.flags, out: directory,
      genome: args.flags.genome ?? h.settingsFrom({ ...args.flags, ...profile.flags }).maxLength,
      algorithm: args.flags.algorithm ?? 'ga', objective: args.flags.objective ?? 'points', validate: true, json: true } }, h, { quiet: true });
    const best = r.validation.results.find((c) => c.id === r.validation.recommended);
    const base = r.validation.results.find((c) => c.id === r.validation.baseline);
    const result = { profile: profile.name, file: path.join(directory, 'best.red'), report: path.join(directory, 'evolve.json'),
      improved: r.validation.improved, objective: r.validation.objective, objectiveValue: best.objectiveValue,
      score: best.score, baseline: base.score, gain: best.gain, margin: best.margin, config: r.config };
    campaign.profiles.push(result);
    // Persist after each profile so completed runs survive interruption.
    fs.writeFileSync(path.join(out, 'training.json'), JSON.stringify(campaign, null, 2));
    if (!args.flags.json) console.log(`${profile.name}: ${best.score.toFixed(3)} pts/round (${r.validation.improved ? `${r.validation.objective} gain +${best.gain.toFixed(3)}` : 'baseline retained'}) -> ${result.file}`);
  }
  if (args.flags.json) console.log(JSON.stringify(campaign, null, 2));
}
