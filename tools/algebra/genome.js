// Trees as genomes (docs/block-algebra.md): random trees, mutations and
// crossover that only make trees whose contracts fit, within the length limit.
// The evolution loop (phase 2) is built on these.
import { createHash } from 'node:crypto';
import { leaves } from './leaves.js';
import { combinators, definition, link, treeMismatches, shape } from './link.js';

const pick = (xs, random) => xs[Math.floor(random() * xs.length)];
const kinds = {};
for (const [id, b] of Object.entries(leaves)) (kinds[b.kind] ??= []).push(id);

// A legal value for one parameter: anywhere in its range, or near its default.
function sampleParam([lo, hi], random, near) {
  if (near !== undefined && random() < 0.5) {
    const width = Math.max(1, Math.round((hi - lo) * 0.05));
    return Math.min(hi, Math.max(lo, near + Math.round((random() * 2 - 1) * width)));
  }
  return lo + Math.floor(random() * (hi - lo + 1));
}
const YZ = ['HOPY', 'HOPZ', 'DY', 'DZ', 'HOP2Y', 'HOP2Z'];
let onTorus = false;                         // set by randomTree/mutate/crossover from the settings
const sampleParams = (id, random) => {
  const def = definition(id);
  return Object.fromEntries(Object.entries(def.params).map(([k, r]) => [k, YZ.includes(k) && !onTorus ? 0 : sampleParam(r, random, def.defaults[k])]));
};
const leaf = (id, random) => ({ id, P: sampleParams(id, random) });

export function fits(tree, settings) {
  if (treeMismatches(tree, settings).length) return false;
  try { return link(tree, settings).total <= settings.maxLength; } catch { return false; }
}

function randomShape(settings, random) {
  if (random() < 0.55) {
    const opening = leaf(pick(kinds.opening, random), random);
    const fin = leaf(pick(kinds.finisher, random), random);
    let main;
    if (opening.id === 'opening-none' && random() < 0.4) main = fin;
    else main = { id: 'seq', kids: [opening, leaves[fin.id].relocatable && random() < 0.3 ? { id: 'relocate', P: sampleParams('relocate', random), kids: [fin] } : fin] };
    return wrap(main, settings, random);
  }
  const body = () => leaf(pick(kinds.body, random), random);
  const runner = () => (random() < 0.7 ? body() : leaf(pick(kinds.finisher, random), random));
  const r = random();
  if (r < 0.12) return wrap({ id: 'seq', kids: [leaf(pick(kinds.opening, random), random), body()] }, settings, random);
  if (r < 0.27) {                                // a looped block that becomes something else
    const looped = kinds.body.filter((id) => leaves[id].loop);
    if (looped.length) return wrap({ id: 'trigger', P: sampleParams('trigger', random), kids: [leaf(pick(looped, random), random), runner()] }, settings, random);
  }
  if (r < 0.37) return wrap({ id: 'apart', P: sampleParams('apart', random), kids: [body(), body()] }, settings, random);
  if (r < 0.45) return wrap({ id: 'copies', P: sampleParams('copies', random), kids: [body()] }, settings, random);
  if (r < 0.52 && settings.pSpace) return wrap({ id: 'switch', P: sampleParams('switch', random), kids: Array.from({ length: 2 + Math.floor(random() * 3) }, body) }, settings, random);
  if (r < 0.58) {                                // a looped block, restarted when hit, or sent one way or another by what hit it
    const looped = kinds.body.filter((id) => leaves[id].loop);
    const a = leaf(pick(looped, random), random);
    return wrap(random() < 0.5 ? { id: 'restart', P: {}, kids: [a] } : { id: 'classify', P: {}, kids: [a, body(), body()] }, settings, random);
  }
  const n = random() < 0.4 ? 1 : random() < 0.8 ? 2 : 3;
  const bodies = Array.from({ length: n }, body);
  return wrap(n > 1 ? { id: 'par', kids: bodies } : bodies[0], settings, random);
}
function wrap(main, settings, random) {
  const decoys = random() < 0.3 ? leaf('decoys', random) : null;
  if (random() < 0.25) return { id: 'boot', P: sampleParams('boot', random), kids: decoys ? [main, decoys] : [main] };
  return decoys ? { id: 'image', kids: [main, decoys] } : main;
}

export function randomTree(settings, random, tries = 500) {
  onTorus = settings.topology === 'torus';
  for (let i = 0; i < tries; i++) {
    const t = randomShape(settings, random);
    if (fits(t, settings)) return t;
  }
  throw new Error('No random tree fits these settings');
}

// Every node, with a way to put a replacement in its place.
function slots(tree) {
  const out = [];
  const walk = (node, set) => {
    out.push({ node, set });
    node.kids?.forEach((k, i) => walk(k, (n) => { node.kids[i] = n; }));
  };
  const box = { root: structuredClone(tree) };
  walk(box.root, (n) => { box.root = n; });
  return { box, all: out };
}
const kindOf = (node) => leaves[node.id]?.kind ?? node.id;

// The running part of a tree, its boot or image wrapper, and its decoys.
function parts(tree) {
  let main = tree, boot = null, decoys = null;
  if (main.id === 'image') { decoys = main.kids[1]; main = main.kids[0]; }
  if (main.id === 'boot') { boot = main; decoys = main.kids[1] ?? null; main = main.kids[0]; }
  return { main, boot, decoys };
}
function assemble({ main, boot, decoys }) {
  if (boot) return { id: 'boot', P: boot.P, kids: decoys ? [main, decoys] : [main] };
  return decoys ? { id: 'image', kids: [main, decoys] } : main;
}

export const MUTATIONS = ['tune', 'swap', 'boot', 'decoys', 'relocate', 'member', 'opening', 'wrap', 'unwrap'];
const WRAPPERS = ['trigger', 'apart', 'copies', 'switch', 'restart', 'classify', 'parboot'];

// One mutation that keeps the tree legal; returns { tree, op } or null.
// `ops` limits the mutations tried (['tune'] only changes numbers).
export function mutate(tree, settings, random, tries = 60, ops = MUTATIONS) {
  onTorus = settings.topology === 'torus';
  for (let i = 0; i < tries; i++) {
    const op = pick(ops, random);
    const t = mutation(op, tree, random);
    if (t && fits(t, settings) && id(t) !== id(tree)) return { tree: t, op };
  }
  return null;
}

function mutation(op, tree, random) {
  const { box, all } = slots(tree);
  switch (op) {
    case 'tune': {                               // one parameter of one node
      const tunable = all.filter((s) => Object.keys(definition(s.node.id).params).length);
      if (!tunable.length) return null;
      const { node } = pick(tunable, random), def = definition(node.id);
      const key = pick(Object.keys(def.params), random);
      if (YZ.includes(key) && !onTorus) return null;
      node.P = { ...def.defaults, ...node.P, [key]: sampleParam(def.params[key], random, node.P?.[key]) };
      return box.root;
    }
    case 'swap': {                               // a leaf for another of the same kind
      const swappable = all.filter((s) => leaves[s.node.id] && kinds[leaves[s.node.id].kind].length > 1);
      if (!swappable.length) return null;
      const s = pick(swappable, random), others = kinds[leaves[s.node.id].kind].filter((x) => x !== s.node.id);
      s.set(leaf(pick(others, random), random));
      return box.root;
    }
    case 'boot': {                               // wrap in a boot, or unwrap one
      const p = parts(tree);
      p.boot = p.boot ? null : { P: sampleParams('boot', random) };
      return assemble(p);
    }
    case 'decoys': {
      const p = parts(tree);
      p.decoys = p.decoys ? (random() < 0.5 ? null : leaf('decoys', random)) : leaf('decoys', random);
      return assemble(p);
    }
    case 'relocate': {                           // relocate a finisher, or stop relocating it
      const p = parts(tree);
      if (p.main.id !== 'seq') return null;
      const last = p.main.kids.at(-1);
      p.main = structuredClone(p.main);
      p.main.kids[p.main.kids.length - 1] = last.id === 'relocate' ? last.kids[0] : { id: 'relocate', P: sampleParams('relocate', random), kids: [last] };
      return assemble(p);
    }
    case 'member': {                             // add or drop a body side by side
      const p = parts(tree);
      if (kindOf(p.main) === 'body') p.main = { id: 'par', kids: [p.main, leaf(pick(kinds.body, random), random)] };
      else if (p.main.id === 'par') {
        const kids = [...p.main.kids];
        if (kids.length < combinators.par.kids[1] && random() < 0.5) kids.push(leaf(pick(kinds.body, random), random));
        else kids.splice(Math.floor(random() * kids.length), 1);
        p.main = kids.length > 1 ? { id: 'par', kids } : kids[0];
      } else return null;
      return assemble(p);
    }
    case 'wrap': {                               // put the running part inside a new combinator
      const p = parts(tree), w = pick(WRAPPERS, random), body = () => leaf(pick(kinds.body, random), random);
      if (w === 'copies' || w === 'restart' || w === 'parboot') p.main = { id: w, P: sampleParams(w, random), kids: [p.main] };
      else if (w === 'classify') p.main = { id: w, P: {}, kids: [p.main, body(), body()] };
      else if (w === 'switch' && random() < 0.4) p.main = { id: w, P: sampleParams(w, random), kids: [p.main, body(), body()] };
      else if (w === 'trigger') p.main = { id: w, P: sampleParams(w, random), kids: [p.main, random() < 0.5 ? body() : leaf(pick(kinds.finisher, random), random)] };
      else p.main = { id: w, P: sampleParams(w, random), kids: random() < 0.5 ? [p.main, body()] : [body(), p.main] };
      return assemble(p);
    }
    case 'unwrap': {                             // keep one member of a combinator
      const p = parts(tree);
      if (!WRAPPERS.includes(p.main.id) && p.main.id !== 'par') return null;
      p.main = pick(p.main.kids, random);
      return assemble(p);
    }
    case 'opening': {                            // a bare clear gains an opening, or loses an empty one
      const p = parts(tree);
      if (kindOf(p.main) === 'finisher') p.main = { id: 'seq', kids: [leaf(pick(kinds.opening, random), random), p.main] };
      else if (p.main.id === 'seq' && p.main.kids[0].id === 'opening-none' && kindOf(p.main.kids[1]) === 'finisher') p.main = p.main.kids[1];
      else return null;
      return assemble(p);
    }
  }
  return null;
}

// Swap a subtree of a for one of the same kind from b; returns a legal child or null.
export function crossover(a, b, settings, random, tries = 20) {
  onTorus = settings.topology === 'torus';
  const donors = slots(b).all;
  for (let i = 0; i < tries; i++) {
    const { box, all } = slots(a);
    const s = pick(all, random), k = kindOf(s.node);
    const same = donors.filter((d) => kindOf(d.node) === k && id(d.node) !== id(s.node));
    if (!same.length) continue;
    s.set(structuredClone(pick(same, random).node));
    if (fits(box.root, settings)) return box.root;
  }
  return null;
}

// One program, one id: parameters in a fixed order, unknown ones dropped.
export function canonical(node) {
  const def = definition(node.id);
  const P = Object.fromEntries(Object.keys(def.params).sort().map((k) => [k, node.P?.[k] ?? def.defaults[k]]));
  return { id: node.id, ...(Object.keys(P).length ? { P } : {}), ...(node.kids ? { kids: node.kids.map(canonical) } : {}) };
}
export const id = (tree) => createHash('sha256').update(JSON.stringify(canonical(tree))).digest('hex').slice(0, 16);
export { shape };
