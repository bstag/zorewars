// Candidate legality, solo measurements and fitness caches. Fitness is reset
// each generation; compilation and solo checks remain valid for the whole run.
import { compile } from '../../../src/engine/index.js';
import { evaluate, strip } from '../../hill.js';
import { clone, fits, genomeOf, legal88, toWarrior, toRedcode } from '../../genes.js';
import { genomeId } from '../identity.js';
import { measureSolo } from '../execution.js';

export function createAssessor({ pool, target, outcomes, stats, options }) {
  const { settings, entrySettings, maxLength, seed, evalRounds, objective, tieValue, league, geo } = options;
  const coreSize = settings.coreSize;
  const metric = objective === 'smooth' ? 'smooth' : 'score';
  const rowMetric = objective === 'smooth' ? 'smooth' : 'pts';
  const measured = new Map(), assessed = new Map(), lineage = new Map();
  const solo = w => measureSolo(pool, w, settings);
  // `level` is a racing level: evalRounds x 2^level rounds on that level's own
  // seeds, the same for every candidate in the round, so same-level fits compare.
  async function assess(input, round, origin = { operator: 'seed', parents: [] }, pop, level = 0) {
    let g = clone(input);
    if (!fits(g, maxLength)) return null;
    if (settings.dialect === '88') g.code.forEach(legal88);   // every child stays ICWS'88
    g = genomeOf(toWarrior(g, 'Evolved', coreSize));
    const id = genomeId(g);
    if (!lineage.has(id)) lineage.set(id, { id, generation: round, ...origin });
    const key = `${pop.key}:${level}:${id}`;
    if (assessed.has(key)) { stats.cacheHits++; return assessed.get(key); }
    if (!measured.has(id)) {
      // Compile what will actually be exported. This also enforces P-space,
      // dialect and geometry limits instead of bypassing them via toWarrior.
      const w = compile(toRedcode(g, { coreSize, geo, dialect: entrySettings.dialect }), 'redcode', entrySettings);
      measured.set(id, w.ok ? solo(w).then((species) => species.survives ? { w, species } : null) : null);
    }
    // Cache pending solo checks as well as pending fitness assessments.
    // Duplicate births retain one measurement and the same cache accounting.
    const pending = (async () => {
      const m = await measured.get(id);
      if (!m) { stats.rejected++; assessed.set(key, null); return null; }
      const { w, species } = m;
      const matchSeed = (seed + round * 1000 + level * 104729) % 2147483646 + 1;
      const n = evalRounds * 2 ** level;
      const a = pop.field && target.field.length ? await target.assess(w, { seed: matchSeed, diagnose: true, rounds: n }) : null;
      let fit = a?.fit ?? 0;
      const rows = a ? a.rows.slice(0, target.field.length).map((r) => ({ ...r, value: r[rowMetric] })) : [];
      const sym = a ? { ...a.symptoms } : {};
      const rivals = pop.rivals();
      if (rivals.length && (objective !== 'pushoff' || league || !a)) {
        const c = await evaluate(pool, w, rivals.map((x) => ({ name: x.name, group: 'champion', w: x.w })), { rounds: n, seed: matchSeed, settings, diagnose: true });
        const vsChamps = c.rows.reduce((s, r) => s + r[rowMetric] - ((1 - tieValue) * r.t) / n, 0) / c.rows.length;
        fit = !a ? vsChamps : objective === 'pushoff' ? a.fit + vsChamps : (a[metric] + vsChamps) / 2;
        rows.push(...c.rows.map((r) => ({ ...r, value: r[rowMetric] - ((1 - tieValue) * r.t) / n })));
        for (const k in c.symptoms) sym[k] = (sym[k] ?? 0) + c.symptoms[k];
      }
      const result = { id, g, fit, level, sym, species, cases: rows.map((r) => r.value), rows,
        ...(outcomes ? { descriptor: outcomes.describe(a.rows.slice(0, target.field.length)) } : {}),
        ...(a?.places ? { places: a.places } : {}) };
      stats.evaluated++;
      assessed.set(key, result);
      return result;
    })();
    assessed.set(key, pending);
    return pending;
  }
  const assessBatch = async (items, round, pop) => {
    if (pool.backend === 'gpu') return Promise.all(items.map(({ g, origin }) => assess(g, round, origin, pop)));
    const results = [];
    for (const { g, origin } of items) results.push(await assess(g, round, origin, pop));
    return results;
  };
  return { assess, assessBatch, lineage, reset: () => assessed.clear() };
}
