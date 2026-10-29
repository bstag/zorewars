// Combinators, contracts and the linker (docs/block-algebra.md). A tree is
// { id, P?, kids? }: a leaf from leaves.js, or a combinator from here.
import { leaves } from './leaves.js';

export const combinators = {
  seq: { kids: [2, 8], purpose: 'Members run one after another; each hands control to the next.' },
  par: { kids: [2, 4], purpose: 'Members launched side by side with SPL.' },
  relocate: { kids: [1, 1], params: { HOP: [256, 54000] }, defaults: { HOP: 4096 }, purpose: 'Copies its member to probe + HOP and runs it there.' },
  boot: { kids: [1, 2], params: { HOP: [256, 54000] }, defaults: { HOP: 4096 }, purpose: 'Copies its first member to + HOP and runs the copy; the second (data) stays behind.' },
  image: { kids: [2, 4], purpose: 'Members laid out in order; the first runs, the rest are data.' },
};
for (const [id, c] of Object.entries(combinators)) { c.id = id; c.combinator = true; c.params ??= {}; c.defaults ??= {}; }

export const definition = (id) => leaves[id] ?? combinators[id];
const isLeaf = (node) => Object.hasOwn(leaves, node.id);
const value = (v, ...args) => (typeof v === 'function' ? v(...args) : v);

// Give every node its own label namespace, in a deterministic order.
export function annotate(tree) {
  let k = 0;
  const walk = (node) => {
    const def = definition(node.id);
    if (!def) throw new Error(`Unknown block: ${node.id}`);
    return { ...node, ns: `b${k++}`, P: { ...def.defaults, ...node.P }, kids: node.kids?.map(walk) };
  };
  return walk(tree);
}

export function entryOf(node) {
  if (isLeaf(node)) return node.ns + leaves[node.id].entry;
  if (node.id === 'seq' || node.id === 'image') return entryOf(node.kids[0]);
  return node.ns + { par: 'split', relocate: 'transition', boot: 'boot' }[node.id];
}

// par lays out members that write ahead of themselves (a spiral's imps) last.
const parOrder = (kids) => [...kids].sort((a, b) => (leaves[a.id]?.layout === 'last') - (leaves[b.id]?.layout === 'last'));

// The contract of a node: what it does, what it needs, and why it can't be built.
export function iface(node, settings) {
  const def = definition(node.id), old = settings.dialect === '88', core = settings.coreSize;
  const out = { processes: 0, grows: false, exit: 'never', writes: 'sparse', roams: false, relocatable: false,
    provides: new Map(), needs: new Set(), mismatches: [] };
  for (const [key, [lo, hi]] of Object.entries(def.params ?? {})) {
    const v = node.P?.[key];
    if (!Number.isSafeInteger(v) || v < lo || v > hi) out.mismatches.push(`${node.id}: ${key} must be an integer from ${lo} to ${hi}`);
  }
  if (isLeaf(node)) {
    const P = node.P;
    if (def.dialects === '94' && old) out.mismatches.push(`${node.id} needs ICWS'94`);
    out.mismatches.push(...(def.mismatches?.(P, settings) ?? []));
    Object.assign(out, { processes: value(def.processes, P), grows: !!def.grows, exit: def.exit, writes: def.writes,
      roams: !!def.roams, relocatable: !!def.relocatable, link: def.link ?? 'fall' });
    for (const [cap, label] of Object.entries(value(def.provides, P) ?? {})) out.provides.set(cap, node.ns + label);
    for (const cap of def.needs ?? []) out.needs.add(cap);
    return out;
  }
  const [lo, hi] = def.kids, kids = node.kids ?? [];
  if (kids.length < lo || kids.length > hi) out.mismatches.push(`${node.id} takes ${lo}${hi > lo ? ` to ${hi}` : ''} members`);
  const parts = kids.map((k) => iface(k, settings));
  for (const p of parts) out.mismatches.push(...p.mismatches);
  out.grows = parts.some((p) => p.grows);
  out.roams = parts.some((p) => p.roams);
  out.writes = parts.some((p) => p.writes === 'core') ? 'core' : 'sparse';
  for (const p of parts) { for (const [c, l] of p.provides) if (!out.provides.has(c)) out.provides.set(c, l); for (const c of p.needs) out.needs.add(c); }
  const landsOnSelf = () => node.P.HOP % core < 256;
  switch (node.id) {
    case 'seq':
      parts.forEach((p, i) => {
        if (i < parts.length - 1 && p.exit !== 'next') out.mismatches.push(`seq: ${kids[i].id} never hands on, so nothing after it runs`);
        if (i === parts.length - 1 && p.exit !== 'never') out.mismatches.push(`seq: the last member (${kids[i].id}) must run forever`);
      });
      out.processes = Math.max(0, ...parts.map((p) => p.processes));
      for (const c of [...out.needs]) if (out.provides.has(c)) out.needs.delete(c);   // met inside the seq
      break;
    case 'par':
      parts.forEach((p, i) => { if (p.exit !== 'never') out.mismatches.push(`par: ${kids[i].id} must run forever`); });
      if (out.writes === 'core') out.mismatches.push('par: a clear erases its partners, so a clear runs alone');
      out.processes = parts.reduce((n, p) => n + p.processes, 0);
      break;
    case 'relocate':
      if (parts[0] && !parts[0].relocatable) out.mismatches.push(`relocate: ${kids[0].id} reads state in the image, so it cannot be relocated`);
      if (landsOnSelf()) out.mismatches.push('HOP lands on the warrior itself');
      out.processes = parts[0]?.processes ?? 0;
      out.needs.add('probe');
      break;
    case 'boot': {
      if (parts[0] && parts[0].exit !== 'never') out.mismatches.push('boot: its first member must run forever');
      if (parts[1] && parts[1].exit !== 'data') out.mismatches.push('boot: its second member stays behind, so it must be data');
      const hasRelocate = (n) => n.id === 'relocate' || (n.kids ?? []).some(hasRelocate);
      if (kids[0] && hasRelocate(kids[0])) out.mismatches.push('one relocation per warrior: relocate or boot');
      if (landsOnSelf()) out.mismatches.push('HOP lands on the warrior itself');
      out.processes = parts[0]?.processes ?? 0;
      break;
    }
    case 'image':
      if (parts[0] && parts[0].exit !== 'never') out.mismatches.push('image: its first member must run forever');
      parts.slice(1).forEach((p, i) => { if (p.exit !== 'data') out.mismatches.push(`image: ${kids[i + 1].id} is laid out after the code, so it must be data`); });
      out.processes = parts[0]?.processes ?? 0;
      break;
  }
  if (node.id === 'image' || node.id === 'boot') out.exit = parts[0]?.exit ?? 'never';
  return out;
}

// Why a whole tree can't be built on these settings; empty when it can.
export function treeMismatches(tree, settings) {
  const root = annotate(tree), f = iface(root, settings), out = [...f.mismatches];
  for (const c of f.needs) out.push(`nothing provides ${({ probe: 'a probe', datBomb: 'a DAT bomb cell', splBomb: 'an SPL bomb cell' })[c] ?? c}`);
  if (f.exit !== 'never') out.push('the warrior must run forever');
  if (f.processes > settings.maxProcesses) out.push('more processes than this hill allows');
  return out;
}

// What the gates and the evolver need to know about a node, from its definition.
export const kindOf = (node) => (isLeaf(node) ? leaves[node.id].kind : node.id);

// Lays the tree out as Redcode. Two passes: the first measures, the second
// emits with every size known.
export function link(tree, settings, { name = 'Tree' } = {}) {
  const root = annotate(tree), old = settings.dialect === '88', core = settings.coreSize;
  const op = (opcode, mod) => (old ? opcode : `${opcode}.${mod}`);
  function pass(sizes) {
    const lines = [], labels = {}, spans = {};
    let pc = 0;
    const total = sizes?.total ?? 0;
    const scopes = [];
    const stateDone = new Set();
    const ctxFor = (node, env) => {
      const L = (local) => node.ns + local;
      return {
        P: node.P, old, core, settings, L, next: env.next, span: env.span ?? total, total,
        pc: () => pc,
        ref(cap) {
          for (let i = scopes.length - 1; i >= 0; i--) if (scopes[i].has(cap)) return scopes[i].get(cap);
          throw new Error(`${node.id} needs ${cap}, which nothing provides`);
        },
        ins(label, opcode, mod, a, b = '0') {
          if (label) labels[L(label)] = pc;
          lines.push(`${label ? L(label) : ''} ${op(opcode, mod)} ${a}, ${b}`);
          pc++;
        },
        mark(label) { labels[L(label)] = pc; lines.push(L(label)); },
      };
    };
    const spanOf = (node) => sizes?.spans[node.ns] ?? { start: 0, size: 0 };
    // State cells of every leaf a seq is responsible for (not those of nested seqs or pars).
    const stateLeaves = (node) => (node.kids ?? []).flatMap((k) => (isLeaf(k) ? [k] : k.id === 'seq' || k.id === 'par' ? [] : stateLeaves(k)));
    const emitState = (leaf, env) => {
      const def = leaves[leaf.id];
      if (!def.state || stateDone.has(leaf.ns)) return;
      stateDone.add(leaf.ns);
      def.state(ctxFor(leaf, env));
    };
    function emit(node, env) {
      const start = pc;
      if (isLeaf(node)) {
        emitState(node, env);
        leaves[node.id].emit(ctxFor(node, env));
      } else {
        const ctx = ctxFor(node, env), { L, P } = ctx, kids = node.kids;
        switch (node.id) {
          case 'seq': {
            const scope = new Map(iface(node, settings).provides);
            scopes.push(scope);
            for (const leaf of stateLeaves(node)) emitState(leaf, env);
            kids.forEach((kid, i) => {
              const last = i === kids.length - 1;
              const linkCell = !last && iface(kid, settings).link === 'jump' && kids[i + 1].id !== 'relocate';
              const next = last ? env.next : linkCell ? node.ns + `link${i}` : entryOf(kids[i + 1]);
              emit(kid, { ...env, next });
              if (linkCell) { labels[node.ns + `link${i}`] = pc; lines.push(`${node.ns}link${i} ${op('JMP', 'B')} ${entryOf(kids[i + 1])}, 0`); pc++; }
            });
            scopes.pop();
            break;
          }
          case 'par': {
            const order = parOrder(kids);
            order.slice(1).forEach((kid, i) => ctx.ins(i ? '' : 'split', 'SPL', 'B', entryOf(kid)));
            if (isLeaf(order[0]) && leaves[order[0].id].entryFirst === false) ctx.ins('', 'JMP', 'B', entryOf(order[0]));
            for (const kid of order) emit(kid, env);
            break;
          }
          case 'relocate': {
            const kid = spanOf(kids[0]);
            ctx.ins('transition', 'MOV', 'I', `<${L('copySource')}`, `<${L('copyTarget')}`);
            ctx.ins(null, 'DJN', 'B', L('transition'), L('copyCount'));
            ctx.ins(null, 'JMP', 'B', `@${L('copyTarget')}`);
            ctx.ins('copySource', 'DAT', 'F', '#0', `#${kid.start + kid.size - pc}`);
            ctx.ins('copyTarget', 'DAT', 'F', '#0', `#(${ctx.ref('probe')}+${P.HOP}+${kid.size}-${L('copyTarget')})`);
            ctx.ins('copyCount', 'DAT', 'F', '#0', `#${kid.size}`);
            emit(kids[0], env);
            break;
          }
          case 'boot': {
            const main = spanOf(kids[0]);
            emit(kids[0], { ...env, span: main.size });
            if (kids[1]) emit(kids[1], env);
            ctx.ins('boot', 'MOV', 'I', `<${L('copyFrom')}`, `<${L('copyTo')}`);
            ctx.ins('', 'DJN', 'B', L('boot'), L('copyCount'));
            ctx.ins('', 'JMP', 'B', `${entryOf(kids[0])}+${P.HOP}`);
            ctx.ins('copyFrom', 'DAT', 'F', '#0', `#${main.start + main.size - pc}`);
            ctx.ins('copyTo', 'DAT', 'F', '#0', `#${main.start + P.HOP + main.size - pc}`);
            ctx.ins('copyCount', 'DAT', 'F', '#0', `#${main.size}`);
            break;
          }
          case 'image':
            for (const kid of kids) emit(kid, env);
            break;
        }
      }
      spans[node.ns] = { start, size: pc - start };
    }
    emit(root, { next: null });
    return { lines, labels, spans, total: pc };
  }
  const first = pass(null);
  const out = pass({ total: first.total, spans: first.spans });
  const entry = entryOf(root);
  const header = [`;name ${name}`, ';author ZoreWars', `;strategy ${shape(tree)}`, `;assert CORESIZE==${core}`];
  const source = [...header, ...(old ? [] : [`ORG ${entry}`]), ...out.lines, old ? `END ${entry}` : 'END'].join('\n') + '\n';
  return { source, root, labels: out.labels, spans: out.spans, total: out.total, entry };
}

// A tree's shape without its numbers: what evolution counts as a new way of combining blocks.
export function shape(node) {
  return node.kids ? `${node.id}(${node.kids.map(shape).join(',')})` : node.id;
}
