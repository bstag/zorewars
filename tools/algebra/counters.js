// What a tree loses to, and which changes to a tree fix it.
//
// - opponentTags() labels an opponent by strategy (paper, stone, scanner,
//   clear, imp, vampire) from its ;strategy comments and name, or its library
//   category; hybrids get several tags.
// - diagnose() sums a warrior's results by opponent tag: what it beats, ties
//   and loses to.
// - describeChange() names the difference between a parent tree and its
//   child: blocks added (+imp), removed (-decoys), replaced (paper>silk3) or a
//   number tuned (tune mod-stone.STEP).
// - CounterTable accumulates, for every kind of change, how much it moved the
//   score against each opponent tag (child minus parent, same seeds), so after
//   enough mutations it says, from measurement, which changes counter which
//   strategies. It is saved as JSON and carries on across runs.

const PATTERNS = [
  ['paper', /paper|silk|replicat|clone|mice|\bcopy|copies/i],
  ['stone', /stone|bomb|dwarf|carpet|blur/i],
  ['scanner', /scan|one-?shot|\bsne\b|\bcmp\b|seek|hunter/i],
  ['clear', /clear|sweep|wipe|\bclr/i],
  ['imp', /\bimps?\b|spiral|imp[- /]?ring|launch/i],
  ['vampire', /vamp|fang|\bpit\b|trap/i],
];
const CATEGORY = { paper: 'paper', replicator: 'paper', stone: 'stone', bomber: 'stone', scanner: 'scanner', clear: 'clear', imp: 'imp', vampire: 'vampire' };

export function opponentTags(o) {
  if (o.group === 'champion') return ['champion'];
  const text = `${o.strategy ?? ''} ${o.name ?? ''}`;
  const tags = PATTERNS.filter(([, re]) => re.test(text)).map(([t]) => t);
  if (!tags.length && o.category) for (const [k, t] of Object.entries(CATEGORY)) if (String(o.category).toLowerCase().includes(k)) tags.push(t);
  return tags.length ? [...new Set(tags)] : ['unknown'];
}

// Results by tag: { tag: { opponents, w, l, t, pts } }, pts per round.
export function diagnose(rows, field) {
  const out = {};
  rows.forEach((r, i) => {
    for (const tag of field[i].tags ?? opponentTags(field[i])) {
      const d = (out[tag] ??= { opponents: 0, w: 0, l: 0, t: 0, pts: 0 });
      d.opponents++; d.w += r.w; d.l += r.l; d.t += r.t; d.pts += r.pts;
    }
  });
  for (const d of Object.values(out)) d.pts /= d.opponents;
  return out;
}

// The opponent type a warrior does worst against (the one to counter next);
// vague tags are ignored, and a type it already scores well against is not
// worth aiming at (returns null above `enough` points per round).
export function weakestTag(dx, { ignore = ['champion', 'unknown', 'scanner-or-stone'], enough = 2.4 } = {}) {
  const tags = Object.entries(dx).filter(([t]) => !ignore.includes(t)).sort((a, b) => a[1].pts - b[1].pts);
  return tags.length && tags[0][1].pts < enough ? tags[0][0] : null;
}

// One line: the weakest tags first.
export function describeDiagnosis(dx, n = 3) {
  return Object.entries(dx).filter(([t]) => t !== 'champion').sort((a, b) => a[1].pts - b[1].pts).slice(0, n)
    .map(([t, d]) => `${t} ${d.pts.toFixed(2)} (${d.w}/${d.l}/${d.t})`).join(', ');
}

function nodes(tree, out = []) {
  out.push(tree);
  for (const k of tree.kids ?? []) nodes(k, out);
  return out;
}

// The change from parent to child, as a key: structural changes by block id,
// otherwise the parameter that was tuned.
export function describeChange(parent, child) {
  const count = (t) => nodes(t).reduce((m, x) => m.set(x.id, (m.get(x.id) ?? 0) + 1), new Map());
  const a = count(parent), b = count(child), added = [], removed = [];
  for (const id of new Set([...a.keys(), ...b.keys()])) {
    const d = (b.get(id) ?? 0) - (a.get(id) ?? 0);
    for (let i = 0; i < Math.abs(d); i++) (d > 0 ? added : removed).push(id);
  }
  added.sort(); removed.sort();
  if (added.length || removed.length) {
    if (added.length === 1 && removed.length === 1) return `${removed[0]}>${added[0]}`;
    return [...removed.map((x) => `-${x}`), ...added.map((x) => `+${x}`)].join(',');
  }
  // Same blocks: find the parameters that differ, node by node in order.
  const pa = nodes(parent), pb = nodes(child), keys = [];
  pa.forEach((x, i) => {
    const y = pb[i];
    if (!y || x.id !== y.id) return;
    for (const k of new Set([...Object.keys(x.P ?? {}), ...Object.keys(y.P ?? {})])) if (x.P?.[k] !== y.P?.[k]) keys.push(`${x.id}.${k}`);
  });
  if (keys.length) return `tune ${[...new Set(keys)].sort().join(',')}`;
  return 'rearrange';
}

export class CounterTable {
  constructor(data = {}) { this.changes = data.changes ?? {}; this.runs = (data.runs ?? 0) + 1; }
  // One experiment: parent and child rows against the same opponents, same seeds.
  record(change, parentRows, childRows, field) {
    const c = (this.changes[change] ??= { n: 0, tags: {} });
    c.n++;
    const sums = {};
    childRows.forEach((r, i) => {
      const p = parentRows[i];
      if (!p || p.name !== r.name) return;
      for (const tag of ['all', ...(field[i].tags ?? opponentTags(field[i]))]) {
        const s = (sums[tag] ??= { d: 0, k: 0 });
        s.d += r.pts - p.pts; s.k++;
      }
    });
    for (const [tag, s] of Object.entries(sums)) {
      const e = (c.tags[tag] ??= { n: 0, mean: 0, m2: 0 });
      const x = s.d / s.k;                     // one sample: the mean change against this tag
      e.n++;
      const delta = x - e.mean;
      e.mean += delta / e.n;
      e.m2 += delta * (x - e.mean);
    }
  }
  // The changes that help most against a tag, with enough samples to trust.
  best(tag, { min = 5, top = 5 } = {}) {
    return Object.entries(this.changes).map(([change, c]) => ({ change, ...stat(c.tags[tag]) }))
      .filter((x) => x.n >= min).sort((a, b) => b.mean - a.mean).slice(0, top);
  }
  // What this change did against a tag before: its mean effect and how many
  // times it was tried. Unseen changes return n 0, mean 0.
  predict(change, tag) {
    const e = this.changes[change]?.tags[tag];
    return e ? { mean: e.mean, n: e.n } : { mean: 0, n: 0 };
  }
  // How much to prefer a change against a tag, balancing what is known to help
  // against trying what has not been measured (UCB: an unseen change gets the
  // full exploration bonus, so new ideas are still tried). `explore` sets how
  // strongly the unknown is favoured.
  score(change, tag, explore = 0.3) {
    const { mean, n } = this.predict(change, tag);
    return mean + explore / Math.sqrt(n + 1);
  }
  tags() { return [...new Set(Object.values(this.changes).flatMap((c) => Object.keys(c.tags)))].filter((t) => t !== 'all').sort(); }
  toJSON() { return { runs: this.runs, changes: this.changes }; }
}

function stat(e) {
  if (!e) return { n: 0, mean: 0, se: Infinity };
  const sd = e.n > 1 ? Math.sqrt(e.m2 / (e.n - 1)) : Infinity;
  return { n: e.n, mean: e.mean, se: sd / Math.sqrt(e.n) };
}

// A readable summary: for each tag, the changes that helped most against it.
export function summarizeCounters(table, { min = 5, top = 3 } = {}) {
  const lines = [];
  for (const tag of ['all', ...table.tags()]) {
    const best = table.best(tag, { min, top }).filter((x) => x.mean > 0);
    if (best.length) lines.push(`${tag}: ${best.map((x) => `${x.change} ${x.mean >= 0 ? '+' : ''}${x.mean.toFixed(2)} (n ${x.n})`).join('; ')}`);
  }
  return lines;
}

// When an opponent says nothing about its strategy: what it does alone
// (measureSpecies), mapped onto the same tags where the behaviour is clear.
const BEHAVIOUR = {
  'paper (replicator)': ['paper'], 'small replicator': ['paper'], 'paper/stone hybrid': ['paper', 'stone'],
  'imp or mover': ['imp'], 'imp spiral or small paper': ['imp'], 'core clear or process swarm': ['clear'],
  'lean scanner or stone': ['scanner-or-stone'], 'mover or wide bomber': ['stone'], 'stunner or SPL carpet': ['clear'],
};
export function behaviourTags(species) { return BEHAVIOUR[species?.hint] ?? ['unknown']; }

// Tags by behaviour, not by claim: a warrior's comments may be wrong, so what
// it does alone decides its broad class, and a claim only narrows it within
// that class. Run alone, a replicator spreads over thousands of cells; a
// scanner, one-shot or clear stays put (a few hundred cells at most) whatever
// processes its clear spawns. `cache` maps a warrior to its tags, so a hill is
// measured once. Its comment tags are kept as `claimed`.
export function verifiedTags(species, claimed) {
  const says = (t) => claimed.includes(t);
  if (species.coverage >= 1000) {
    if (species.processes < 100 && says('imp') && !says('paper')) return ['imp'];
    return says('stone') ? ['paper', 'stone'] : ['paper'];
  }
  if (species.coverage >= 300 && species.processes <= 3) return ['stone'];      // a wide bomber
  const tags = ['scanner', 'stone', 'clear', 'vampire'].filter(says);
  if (tags.length) return tags;
  return species.processes > 3 ? ['clear'] : ['scanner-or-stone'];
}

export function tagByBehaviour(opponents, { measureSpecies, settings, cache = {} }) {
  const keyOf = (o) => `${o.name}|${o.w.instructions.length}|${JSON.stringify(o.w.instructions[0])}`;
  for (const o of opponents) {
    o.claimed ??= opponentTags(o);
    const key = keyOf(o);
    cache[key] ??= verifiedTags(measureSpecies(o.w, settings), o.claimed);
    o.tags = cache[key];
  }
  return cache;
}
