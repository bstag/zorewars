// Tree evolution, learned counters and hill ladder output.
import fs from 'node:fs';
import path from 'node:path';
import { libraryOpponents, strip } from '../tools/hill.js';
import { battlePool, hillOpponents, hillSettingsFor, progress, done } from './devtools-context.js';

// The counter table (tools/algebra/counters.js): --counters file (default
// <out>/counters.json) is read if it exists, added to, and saved as we go.
async function counterTable(f, out) {
  const { CounterTable, summarizeCounters } = await import('../tools/algebra/counters.js');
  const file = f.counters ? String(f.counters) : path.join(out, 'counters.json');
  const table = new CounterTable(fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {});
  return { table, file, save: () => fs.writeFileSync(file, JSON.stringify(table, null, 1)), summary: () => summarizeCounters(table) };
}

// Tags every opponent by what it does alone, a claim in its comments only
// narrowing that (tagByBehaviour in tools/algebra/counters.js); cached per
// rule set beside the downloaded hills.
async function tagField(field, settings, json) {
  const { tagByBehaviour } = await import('../tools/algebra/counters.js');
  const { measureSpecies } = await import('../src/engine/index.js');
  const dir = path.join((await import('node:os')).tmpdir(), 'zorewars-hills');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `tags-${settings.coreSize}-${settings.maxProcesses}-${settings.maxCycles}.json`);
  const cache = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  progress(json, `measuring ${field.length} opponents…`);
  tagByBehaviour(field, { measureSpecies, settings: hillSettingsFor(settings), cache });
  done(json);
  fs.writeFileSync(file, JSON.stringify(cache));
  const wrong = field.filter((o) => o.claimed && o.claimed[0] !== 'unknown' && !o.tags.some((t) => o.claimed.includes(t))).length;
  if (!json) console.log(`Tagged ${field.length} opponents by behaviour; ${wrong} do not do what their comments claim.`);
}

function printCounters(counters,write=console.log) {
  counters.save();
  const lines = counters.summary();
  if (lines.length) write(`\nWhat helped, by opponent strategy (mean change in pts/round against it, n experiments):\n${lines.map((x) => `  ${x}`).join('\n')}`);
}

// evolve --representation tree: breed block trees (tools/algebra) against a hill,
// scored by average points against every warrior on it, then say where the
// best would rank there. --tune --start tree.json only changes numbers.
export async function cmdEvolveTrees(args, h, { quiet = false } = {}) {
  const { evolveTrees } = await import('../tools/evolution/trees/search.js');
  const { placeOnHill } = await import('../tools/evolution/trees/placement.js');
  const { treeSettings, recipes, shape } = await import('../tools/algebra/index.js');
  const f = args.flags, json = !!f.json;
  const {integer,rules,length,torus,settings,generations,batch,rounds,race,seed,archiveSize,ties,aim,aimTries,aimExplore,lexicase,lexEpsilon,ops,starts,out}=treeCommandOptions(f,h,{treeSettings,recipes});
  fs.mkdirSync(out, { recursive: true });
  if (f.ladder) return climbHill(args, h, { settings, rules, length, torus, starts, batch, rounds, race, seed, archiveSize, ties, aim, aimTries, aimExplore, lexicase, lexEpsilon, ops, integer, out, json });
  const field = f.hill ? await hillOpponents(String(f.hill), settings, { ...f, top: f.top ?? '30' }) : libraryOpponents(settings);
  if (!field.length) h.usage('no opponents compiled for this battlefield');
  const pool = await battlePool(f, h);
  const counters = await counterTable(f, out);
  try {
    await tagField(field, settings, json);
    if (!json) console.log(`Evolving block trees on ${rules}${torus ? ` (torus ${torus})` : ''}, up to ${settings.maxLength} instructions, against ${field.length} ${f.hill ? 'hill' : 'library'} warriors: ${generations} generations of ${batch}${f.tune ? ', numbers only' : ''}, ${rounds} rounds on the screen, racing ${race}${ties !== 1 ? `, ties worth ${ties}` : ''}${aim && !f.tune ? ', mutations aimed by the counter table' : ''}.\n`);
    const r = await evolveTrees({ pool, field, rules, length, torus, starts, generations, batch, rounds, race, seed, archiveSize, ties, counters: counters.table, aim, aimTries, aimExplore, lexicase, lexEpsilon,
      ops,
      onLog: (t) => { done(json); if (!json) console.log(t); },
      onGeneration: (rec) => {
        const b = rec.champion;
        fs.writeFileSync(path.join(out, `tree-${rec.gen}.json`), JSON.stringify(b.tree, null, 1));
        counters.save();
      },
    });
    // Place the confirmed finalists, including the winner of the fresh-seed finals.
    const cache = {}, placed = [];
    const candidates = r.finalists.length ? r.finalists : r.archive;
    for (const e of candidates.slice(0, f.place === 'none' ? 0 : 3)) {
      progress(json, `placing ${e.shape} on the hill…`);
      placed.push({ ...e, placement: await placeOnHill({ pool, field, w: e.w, settings, rounds: integer('place-rounds', 50), cache }) });
    }
    done(json);
    const best = placed.sort((a, b) => b.placement.score - a.placement.score)[0] ?? candidates[0];
    if (best) {
      fs.writeFileSync(path.join(out, 'best.red'), best.source);
      fs.writeFileSync(path.join(out, 'best.json'), JSON.stringify(best.tree, null, 1));
    }
    const report = { config: { rules, length, torus, generations, batch, rounds, race, seed, ties, tune: !!f.tune, hill: f.hill ?? 'library', opponents: field.length },
      stats: r.stats, history: r.history, placed: placed.map(({ w, ...e }) => e),
      finalists: r.finalists.map(({ w, source, ...e }) => e), archive: r.archive.map(({ w, source, ...e }) => e) };
    fs.writeFileSync(path.join(out, 'evolve-trees.json'), JSON.stringify(report, null, 1));
    if (quiet) return report;
    if (json) { console.log(JSON.stringify(report, null, 2)); return report; }
    printTreeResults(r,placed,best,counters,out);
    return report;
  } finally { pool.close(); }
}

// evolve --representation tree --ladder 10: climb the whole hill from the
// bottom, a rung of 10 at a time (evolution/trees/ladder.js), then
// place the champion on the hill's top 30 as a normal tree run does.
async function climbHill(args, h, o) {
  const { climbTrees } = await import('../tools/evolution/trees/ladder.js');
  const { placeOnHill } = await import('../tools/evolution/trees/placement.js');
  const { buildTree, shape } = await import('../tools/algebra/index.js');
  const f = args.flags, { settings, out, json, integer } = o;
  const hill = await hillOpponents(String(f.hill), settings, { ...f, top: f.top ?? '100000' });
  if (hill.length < 2) h.usage('no opponents compiled for this battlefield');
  const rung = integer('ladder', 10), sample = integer('sample', 20, 0), cap = integer('cap', 10), fromRung = integer('from-rung', 1);
  const clearPlace = integer('clear-place', 2), clearMargin = Number(f['clear-margin'] ?? 0.05), clearRounds = integer('clear-rounds', 30);
  // Resuming: --from-rung N --champions a.json,b.json (earlier champions, oldest first).
  const previous = (f.champions ? String(f.champions).split(',') : []).map((file) => {
    const tree = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { tree, shape: shape(tree), w: strip(buildTree(tree, { rules: o.rules, length: o.length, torus: o.torus }).w) };
  });
  const pool = await battlePool(f, h);
  const counters = await counterTable(f, out);
  await tagField(hill, settings, json);
  const source = (tree) => buildTree(tree, { rules: o.rules, length: o.length, torus: o.torus }).source;
  try {
    if (!json) console.log(`Climbing ${f.hill} (${hill.length} warriors) from the bottom, ${rung} at a time: on each rung trees evolve against it, ${sample} cleared warriors and the latest champions, for up to ${cap} generations of ${o.batch}${o.lexicase ? ', lexicase selection' : ''}; a rung is cleared when a champion ranks in the top ${clearPlace} or within ${clearMargin} of the leader (${clearRounds} rounds).\n`);
    if (!json && fromRung > 1) console.log(`Resuming at rung ${fromRung} with ${previous.length} earlier champions.
`);
    const r = await climbTrees({ pool, hill, rung, sample, cap, fromRung, previous, rules: o.rules, length: o.length, torus: o.torus, starts: o.starts, seed: o.seed,
      batch: o.batch, rounds: o.rounds, race: o.race, archiveSize: o.archiveSize, ties: o.ties, counters: counters.table, aim: o.aim, aimTries: o.aimTries, aimExplore: o.aimExplore,
      lexicase: o.lexicase, lexEpsilon: o.lexEpsilon, ops: o.ops, clearPlace, clearMargin, clearRounds,
      onGeneration: () => counters.save(),
      onLog: (t) => { done(json); if (!json) console.log(t); },
      onRung: (entry) => {
        fs.writeFileSync(path.join(out, `rung-${entry.rung}.json`), JSON.stringify(entry.champion.tree, null, 1));
        fs.writeFileSync(path.join(out, `rung-${entry.rung}.red`), source(entry.champion.tree));
      } });
    // The full check: the final champion placed among the hill's top 30.
    const top = hill.slice(0, 30);
    progress(json, 'placing the champion on the top 30…');
    const placement = r.champion ? await placeOnHill({ pool, field: top, w: r.champion.w, settings, rounds: integer('place-rounds', 50) }) : null;
    done(json);
    if (r.champion) {
      fs.writeFileSync(path.join(out, 'best.red'), source(r.champion.tree));
      fs.writeFileSync(path.join(out, 'best.json'), JSON.stringify(r.champion.tree, null, 1));
    }
    const report = { config: { rules: o.rules, length: o.length, hill: f.hill, warriors: hill.length, rung, sample, cap, batch: o.batch, rounds: o.rounds, race: o.race, seed: o.seed, ties: o.ties },
      reached: r.reached, generations: r.generations, rungs: r.rungs, champion: r.champion && { shape: r.champion.shape, tree: r.champion.tree },
      top30: placement && { score: placement.score, place: placement.place, of: placement.of, table: placement.table } };
    fs.writeFileSync(path.join(out, 'climb.json'), JSON.stringify(report, null, 1));
    if (json) { console.log(JSON.stringify(report, null, 2)); return report; }
    console.log(`\nReached hill rank ${r.reached ?? '-'} of ${hill.length} in ${r.generations} generations (${r.rungs.filter((x) => x.skipped).length} rungs skipped, ${r.rungs.filter((x) => x.cleared).length} cleared by evolving).`);
    if (placement) {
      console.log(`Champion ${r.champion.shape}: ${placement.score.toFixed(2)} pts/round, place ${placement.place} of ${placement.of} on the top 30.`);
      placement.table.forEach((x, i) => { if (i < 5 || x.ours || i === placement.table.length - 1) console.log(`${String(i + 1).padStart(3)}. ${x.score.toFixed(2)}  ${x.ours ? `>> ${r.champion.shape}` : x.name}`); });
    }
    printCounters(counters);
    console.log(`\nWritten to ${out}/: rung-N.json/.red (each evolved rung's champion), best.red, best.json, climb.json; the counter table to ${counters.file}.`);
    return report;
  } finally { pool.close(); }
}

// Command configuration and seed trees are resolved before pools are allocated.
export function treeCommandOptions(f,h,{treeSettings,recipes}) {
  const integer = (key, fallback, min = 1) => {
    const n = Number(f[key] ?? fallback);
    if (!Number.isInteger(n) || n < min) h.usage(`--${key} must be an integer of at least ${min}`);
    return n;
  };
  const rules = f.rules ?? '94nop', length = integer('length', 100), torus = f.torus ?? null;
  const settings = treeSettings(rules, length, torus);
  const generations = integer('generations', 10), batch = integer('batch', 30), rounds = integer('rounds', 10);
  const race = integer('race', 2, 0), seed = integer('seed', 1, 0), archiveSize = integer('archive-size', 48);
  const ties = Number(f.ties ?? 1);
  if (!(ties >= 0 && ties <= 1)) h.usage('--ties must be between 0 and 1');
  const aim = f.aim === undefined ? true : !['0', 'false', 'no', 'off'].includes(String(f.aim));
  const aimTries = integer('aim-tries', 6), aimExplore = Number(f['aim-explore'] ?? 0.3);
  const lexicase = f.select ? f.select === 'lexicase' : true;   // --select lexicase|tournament
  const lexEpsilon = Number(f['lex-epsilon'] ?? 0.1);
  if (f.select && !['lexicase', 'tournament'].includes(f.select)) h.usage('--select takes lexicase or tournament');
  if (!Number.isFinite(lexEpsilon) || lexEpsilon < 0) h.usage('--lex-epsilon must be a nonnegative finite number');
  const ops = f.tune ? ['tune'] : undefined;
  // Starting trees: --start a.json[,b.json] (a tree or an array of trees), else the recipes for these rules.
  const starts = [];
  for (const file of f.start ? String(f.start).split(',') : []) starts.push(...[].concat(JSON.parse(fs.readFileSync(file, 'utf8'))));
  if (f.tune && (!f.start || !starts.length)) h.usage('--tune needs a nonempty --start tree.json');
  if (!starts.length) for (const r of Object.values(recipes)) if (r.rules.includes(rules) && !torus) starts.push(r.tree(rules));
  if (f.ladder && !f.hill) h.usage('--ladder needs --hill');
  const out = f.out ?? path.join('evolved', 'trees');
  return {integer,rules,length,torus,settings,generations,batch,rounds,race,seed,archiveSize,ties,aim,aimTries,aimExplore,lexicase,lexEpsilon,ops,starts,out};
}

// Human output is kept outside search orchestration and JSON serialization.
export function printTreeResults(r,placed,best,counters,out,write=console.log) {
    write(`\nGate: ${r.stats.built} trees built, ${r.stats.refused} refused; ${r.stats.scored} scored (${r.stats.battleRounds} battle rounds)${r.stats.aimed ? `; ${r.stats.aimed} mutations aimed, ${r.stats.experiments} experiments recorded` : ''}.`);
    for (const p of placed) write(`${p.placement.score.toFixed(2)} pts/round, place ${p.placement.place} of ${p.placement.of} on the hill: ${p.shape} (${p.size} cells, ${p.species})`);
    if (best?.placement) {
      write(`\nThe hill by score, with the best tree:`);
      best.placement.table.slice(0, 12).forEach((x, i) => write(`${String(i + 1).padStart(3)}. ${x.score.toFixed(2)}  ${x.ours ? `>> ${best.shape}` : x.name}`));
    }
    printCounters(counters,write);
    write(`\nWritten to ${out}/: best.red and best.json, tree-N.json (each generation's champion), evolve-trees.json; the counter table to ${counters.file}.`);
}
