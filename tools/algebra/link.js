// Combinators, contracts and the linker (docs/block-algebra.md). A tree is
// { id, P?, kids? }: a leaf from leaves.js, or a combinator from here.
import { leaves } from './leaves.js';
import { makeGeometry } from '../../src/engine/geometry.js';

export const combinators = {
  seq: { kids: [2, 8], purpose: 'Members run one after another; each hands control to the next.' },
  par: { kids: [2, 4], purpose: 'Members launched side by side with SPL.' },
  relocate: { kids: [1, 1], params: { HOP: [256, 54000] }, defaults: { HOP: 4096 }, purpose: 'Copies its member to probe + HOP and runs it there.' },
  boot: { kids: [1, 2], params: { HOP: [0, 54000], UNROLL: [1, 4], HOPY: [0, 200], HOPZ: [0, 200] }, defaults: { HOP: 4096, UNROLL: 1, HOPY: 0, HOPZ: 0 },
    purpose: 'Copies its first member to + HOP (UNROLL cells per loop) and runs the copy; the second (data) stays behind.' },
  image: { kids: [2, 4], purpose: 'Members laid out in order; the first runs, the rest are data.' },
  trigger: { kids: [2, 2], params: { MODE: [0, 2], TIME: [1, 4096] }, defaults: { MODE: 0, TIME: 2000 },
    purpose: 'Runs its first member (a block with a loop) with a watcher beside it; when the watcher fires it rewrites the loop to jump to the second member. MODE 0: after TIME laps of the watcher; 1: when its marker is damaged; 2: when the first member\'s loop is damaged (a watchdog).' },
  apart: { kids: [2, 2], params: { D: [0, 54000], DY: [0, 200], DZ: [0, 200] }, defaults: { D: 4000, DY: 0, DZ: 0 },
    purpose: 'Copies its second member D cells away and runs it there beside the first, so one hit can\'t find both.' },
  copies: { kids: [1, 1], params: { N: [2, 4], D: [0, 54000], DY: [0, 200], DZ: [0, 200] }, defaults: { N: 2, D: 2667, DY: 0, DZ: 0 },
    purpose: 'Runs N copies of its member, D cells apart.' },
  switch: { kids: [2, 4], params: { CELL: [1, 500], POLICY: [0, 2] }, defaults: { CELL: 17, POLICY: 0 },
    purpose: 'Chooses one of its members by P-space (the 94x hill only). POLICY 0: keep the choice after a win or tie, move to the next after a loss; 1: move on only after two losses in a row; 2: move on every round.' },
  restart: { kids: [1, 1], purpose: 'Keeps a pristine copy of its member (a block with a loop) and a watcher; when the loop is damaged, copies the member back and starts it again.' },
  parboot: { kids: [1, 1],
    params: { K: [1, 4], HOP: [0, 54000], HOPY: [0, 200], HOPZ: [0, 200], STAY: [0, 1], REACT: [0, 2], HOP2: [0, 54000], HOP2Y: [0, 200], HOP2Z: [0, 200], CARPET: [1, 20] },
    defaults: { K: 2, HOP: 4000, HOPY: 0, HOPZ: 0, STAY: 0, REACT: 0, HOP2: 2000, HOP2Y: 0, HOP2Z: 0, CARPET: 8 },
    purpose: 'A boot by K independent copy loops, each copying its member to + HOP, so a bomb on one loop doesn\'t stop the copy; the first loop to finish starts the copy. STAY 1 keeps a process running the original too. REACT: the other loops stay on as watchers of the copy\'s loop; when it is hit they make a new copy at + HOP2 (1), first stunning CARPET cells either side of the hit (2).' },
  classify: { kids: [3, 3], params: {}, purpose: 'Runs its first member (a block with a loop) beside a marker. When the marker is hit, it looks at what hit it: a cell with both fields zero (a clear\'s or a stone\'s DAT) hands over to the second member; anything else (copied code, a scanner\'s bomb) to the third.' },
};

// What a switch picks this round, from last round's result, its stored choice
// and loss count (a model of the emitted code, for the gate's scenarios).
export function switchChoice(policy, n, result, choice, losses) {
  choice %= n;
  if (policy === 0) return result === 0 ? (choice + 1) % n : choice;
  if (policy === 1) return result === 0 && losses + 1 >= 2 ? (choice + 1) % n : choice;
  return result === -1 ? choice : (choice + 1) % n;
}
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
  return node.ns + { par: 'split', relocate: 'transition', boot: 'boot', trigger: 'start', apart: 'start', copies: 'start', switch: 'start', restart: 'start', classify: 'start', parboot: 'start' }[node.id];
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
    const topo = settings.topology === 'torus' ? 'torus' : 'ring';
    if (!(def.topologies ?? ['ring']).includes(topo)) out.mismatches.push(`${node.id} is written for the ${topo === 'torus' ? 'ring' : 'torus'}`);
    out.mismatches.push(...(def.mismatches?.(P, settings) ?? []));
    Object.assign(out, { processes: value(def.processes, P), grows: !!def.grows, exit: def.exit, writes: value(def.writes, P),
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
  const torus = settings.topology === 'torus';
  // On the ring a hop must clear the warrior; on a torus, a hop with a y or z part changes row.
  const landsOnSelf = (x = node.P.HOP, y = node.P.HOPY, z = node.P.HOPZ) => {
    if (!torus) return x % core < 256 || core - (x % core) < 256;
    const w = x % settings.sizeX;
    return !(y || z) && (w < settings.maxLength || settings.sizeX - w < settings.maxLength);
  };
  if (!torus && (node.P?.HOPY || node.P?.HOPZ || node.P?.DY || node.P?.DZ || node.P?.HOP2Y || node.P?.HOP2Z)) out.mismatches.push(`${node.id}: y and z parts only mean something on a torus`);
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
      if (kids.filter((k) => leaves[k.id]?.layout === 'last').length > 1) out.mismatches.push('par: only one member may write just ahead of itself (each must be laid out last)');
      if (out.writes === 'core') out.mismatches.push('par: a clear erases its partners, so a clear runs alone');
      for (const k of kids) if (leaves[k.id]?.attacks === 'all') out.mismatches.push(`par: ${k.id} attacks every cell but its own, partners included`);
      out.processes = parts.reduce((n, p) => n + p.processes, 0);
      break;
    case 'relocate':
      if (parts[0] && !parts[0].relocatable) out.mismatches.push(`relocate: ${kids[0].id} reads state in the image, so it cannot be relocated`);
      if (leaves[kids[0]?.id]?.entryFirst === false) out.mismatches.push(`relocate: ${kids[0].id} doesn't start at its first cell`);
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
    case 'trigger': {
      const a = kids[0], A = leaves[a?.id];
      if (!A?.loop) out.mismatches.push(`trigger: ${a?.id} has no loop for the watcher to rewrite`);
      if (A?.moves) out.mismatches.push(`trigger: ${a.id} moves itself away, so the watcher would lose it`);
      parts.forEach((p, i) => { if (p.exit !== 'never') out.mismatches.push(`trigger: ${kids[i].id} must run forever`); });
      if ((parts[0]?.processes ?? 0) > 1 && leaves[kids[1]?.id]?.kind === 'finisher') out.mismatches.push(`trigger: ${kids[1].id} is a one-process clear; it can't take over ${kids[0].id}'s processes`);
      // After a watchdog fires, a's redirected process and the watcher may both enter b.
      out.processes = Math.max((parts[0]?.processes ?? 0) + 1, (parts[1]?.processes ?? 0) * (node.P.MODE === 2 ? 2 : 1));
      break;
    }
    case 'apart':
    case 'copies': {
      parts.forEach((p, i) => { if (p.exit !== 'never') out.mismatches.push(`${node.id}: ${kids[i].id} must run forever`); });
      if (out.writes === 'core') out.mismatches.push(`${node.id}: a clear erases the other copies, so a clear runs alone`);
      for (const k of kids) if (leaves[k.id]?.attacks === 'all') out.mismatches.push(`${node.id}: ${k.id} attacks every cell but its own, the other copies included`);
      const n = node.id === 'copies' ? node.P.N : 1;
      out.processes = node.id === 'copies' ? n * (parts[0]?.processes ?? 0) : parts.reduce((t, p) => t + p.processes, 0);
      // Every copy needs room: no two may overlap, nor the original image.
      const count = n + 1 - (node.id === 'copies' ? 1 : 0);
      if (torus) {
        // Copies sit at k x (D, DY, DZ): no two may share a row closer than a warrior's length.
        const geo = makeGeometry(settings), at = Array.from({ length: count }, (_, i) => geo.decode(geo.encode(i * node.P.D, i * node.P.DY, i * node.P.DZ)));
        const X = settings.sizeX, w = (v) => ((v % X) + X) % X;
        for (let i = 0; i < at.length; i++) for (let j = i + 1; j < at.length; j++) {
          const [a, b] = [at[i], at[j]], dx = w(b[0] - a[0]);
          if (a[1] === b[1] && a[2] === b[2] && Math.min(dx, X - dx) < settings.maxLength) out.mismatches.push(`${node.id}: D puts copies on top of each other or of the warrior`);
        }
      } else {
        const at = Array.from({ length: count }, (_, i) => (i * node.P.D) % core).sort((x, y) => x - y);
        const gaps = at.map((x, i) => ((i + 1 < at.length ? at[i + 1] : at[0] + core) - x));
        if (Math.min(...gaps) < 256) out.mismatches.push(`${node.id}: D puts copies on top of each other or of the warrior`);
      }
      break;
    }
    case 'switch':
      if (!settings.pSpace) out.mismatches.push('switch needs P-space (the 94x hill)');
      if (old) out.mismatches.push("switch needs ICWS'94 (LDP and STP)");
      parts.forEach((p, i) => { if (p.exit !== 'never') out.mismatches.push(`switch: ${kids[i].id} must run forever`); });
      out.processes = Math.max(0, ...parts.map((p) => p.processes));
      break;
    case 'restart': {
      const x = kids[0], X = leaves[x?.id];
      if (!X?.loop) out.mismatches.push(`restart: ${x?.id} has no loop to watch`);
      if (X?.moves) out.mismatches.push(`restart: ${x.id} moves itself away, so a restored copy wouldn't help`);
      if (parts[0] && parts[0].exit !== 'never') out.mismatches.push(`restart: ${x.id} must run forever`);
      if (parts[0]?.roams) out.mismatches.push(`restart: ${x.id} moves away from its code, so a restored copy wouldn't help`);
      out.processes = 2 * (parts[0]?.processes ?? 0) + 1;     // a restart may join a process that survived
      break;
    }
    case 'parboot': {
      const x = kids[0], X = leaves[x?.id], P = node.P;
      if (parts[0] && parts[0].exit !== 'never') out.mismatches.push(`parboot: ${x.id} must run forever`);
      if (landsOnSelf()) out.mismatches.push('HOP lands on the warrior itself');
      if (P.REACT) {
        if (P.K < 2) out.mismatches.push('parboot: REACT needs K of 2 or more (the loops that lose the race watch the copy)');
        if (!X?.loop) out.mismatches.push(`parboot: ${x?.id} has no loop for the watchers to check`);
        if (X?.moves) out.mismatches.push(`parboot: ${x.id} moves itself away, so the watchers would lose it`);
        if (landsOnSelf(P.HOP2, P.HOP2Y, P.HOP2Z)) out.mismatches.push('HOP2 lands on the warrior itself');
        if (!torus && Math.min((P.HOP2 - P.HOP + 2 * core) % core, (P.HOP - P.HOP2 + 2 * core) % core) < 256) out.mismatches.push('parboot: the new copy would land on the first');
        if (torus && P.HOP2Y === P.HOPY && P.HOP2Z === P.HOPZ && Math.abs((P.HOP2 - P.HOP) % settings.sizeX) < settings.maxLength) out.mismatches.push('parboot: the new copy would land on the first');
      }
      // The copy, the original (STAY), the new copy (REACT), and every loop's process until it stops.
      out.processes = (parts[0]?.processes ?? 0) * (1 + P.STAY + (P.REACT ? 1 : 0)) + P.K;
      break;
    }
    case 'classify': {
      const a = kids[0], A = leaves[a?.id];
      if (!A?.loop) out.mismatches.push(`classify: ${a?.id} has no loop for the watcher to rewrite`);
      if (A?.moves) out.mismatches.push(`classify: ${a.id} moves itself away, so the watcher would lose it`);
      if (old) out.mismatches.push("classify needs ICWS'94 (JMZ.F)");
      parts.forEach((p, i) => { if (p.exit !== 'never') out.mismatches.push(`classify: ${kids[i].id} must run forever`); });
      out.processes = Math.max((parts[0]?.processes ?? 0) + 1, parts[1]?.processes ?? 0, parts[2]?.processes ?? 0);
      break;
    }
    case 'image':
      if (parts[0] && parts[0].exit !== 'never') out.mismatches.push('image: its first member must run forever');
      parts.slice(1).forEach((p, i) => { if (p.exit !== 'data') out.mismatches.push(`image: ${kids[i + 1].id} is laid out after the code, so it must be data`); });
      out.processes = parts[0]?.processes ?? 0;
      break;
  }
  if (node.id === 'image' || node.id === 'boot') out.exit = parts[0]?.exit ?? 'never';
  if (['trigger', 'apart', 'copies', 'switch', 'restart', 'classify', 'parboot'].includes(node.id) && !out.mismatches.length) out.exit = 'never';
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

// Lays the tree out as Redcode: a measuring pass, then passes with every size
// known until the layout stops changing.
export function link(tree, settings, { name = 'Tree' } = {}) {
  const root = annotate(tree), old = settings.dialect === '88', core = settings.coreSize;
  const torus = settings.topology === 'torus';
  // A hop: a plain number on the ring; a vector [x, y, z] on a torus, whose x part
  // wraps within the row (a plain number would carry into the next row).
  const hop = (x, y = 0, z = 0) => (torus ? `[${x},${y},${z}]` : `${x}`);
  // A label plus a hop. On a torus the label goes inside the vector: "label+[x,y,z]"
  // is added as plain numbers and would carry from x into y at the row's edge.
  const hopFrom = (label, x, y = 0, z = 0) => (torus ? `[${label}+${x},${y},${z}]` : `${label}+${x}`);
  // A copy loop. On the ring: MOV <from, <to, then DJN. On a torus the pointers
  // step back per axis (SUB), so a copy that crosses the row's edge stays on its row.
  const copyLoop = (ctx, label, from, to, count, unroll = 1) => {
    const { L } = ctx;
    for (let i = 0; i < unroll; i++) {
      if (torus) {
        ctx.ins(i ? '' : label, 'SUB', 'AB', '#1', L(from));
        ctx.ins('', 'SUB', 'AB', '#1', L(to));
        ctx.ins('', 'MOV', 'I', `@${L(from)}`, `@${L(to)}`);
      } else ctx.ins(i ? '' : label, 'MOV', 'I', `<${L(from)}`, `<${L(to)}`);
    }
    ctx.ins('', 'DJN', 'B', L(label), L(count));
  };
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
        torus, geo: torus ? makeGeometry(settings) : null, vec: (x, y = 0, z = 0) => `[${x},${y},${z}]`,
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
            const before = kids.map((_, i) => {
              const m = new Map();
              for (const k of kids.slice(0, i)) for (const [c, l] of iface(k, settings).provides) m.set(c, l);
              return m;
            });
            for (const leaf of stateLeaves(node)) emitState(leaf, env);
            kids.forEach((kid, i) => {
              const last = i === kids.length - 1;
              const k = iface(kid, settings), into = leaves[kids[i + 1]?.id];
              const linkCell = !last && kids[i + 1].id !== 'relocate' && (k.link === 'jump' || into?.entryFirst === false);
              const next = last ? env.next : linkCell ? node.ns + `link${i}` : entryOf(kids[i + 1]);
              scopes.push(before[i]);
              emit(kid, { ...env, next });
              scopes.pop();
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
            copyLoop(ctx, 'transition', 'copySource', 'copyTarget', 'copyCount');
            ctx.ins(null, 'JMP', 'B', `@${L('copyTarget')}`);
            ctx.ins('copySource', 'DAT', 'F', '#0', `#${kid.start + kid.size - pc}`);
            node.probeLabel = ctx.ref('probe');
            ctx.ins('copyTarget', 'DAT', 'F', '#0', `#(${ctx.ref('probe')}+${P.HOP}+${kid.size}-${L('copyTarget')})`);
            ctx.ins('copyCount', 'DAT', 'F', '#0', `#${kid.size}`);
            emit(kids[0], env);
            break;
          }
          case 'boot': {
            const main = spanOf(kids[0]);
            emit(kids[0], { ...env, span: main.size });
            if (kids[1]) emit(kids[1], env);
            copyLoop(ctx, 'boot', 'copyFrom', 'copyTo', 'copyCount', P.UNROLL);
            ctx.ins('', 'JMP', 'B', hopFrom(entryOf(kids[0]), P.HOP, P.HOPY, P.HOPZ));
            ctx.ins('copyFrom', 'DAT', 'F', '#0', `#${main.start + main.size - pc}`);
            ctx.ins('copyTo', 'DAT', 'F', '#0', `#${hop(main.start + P.HOP + main.size - pc, P.HOPY, P.HOPZ)}`);
            ctx.ins('copyCount', 'DAT', 'F', '#0', `#${Math.ceil(main.size / P.UNROLL)}`);
            break;
          }
          case 'trigger': {
            // start: [copy a's loop for the watchdog], split off the watcher, run a.
            const [a, b] = kids, loop = a.ns + leaves[a.id].loop, bEntry = entryOf(b);
            if (P.MODE === 2) ctx.ins('start', 'MOV', 'I', loop, L('ref'));
            ctx.ins(P.MODE === 2 ? '' : 'start', 'SPL', 'B', L('watch'));
            ctx.ins('', 'JMP', 'B', entryOf(a));
            emit(a, env);
            emit(b, env);
            if (P.MODE === 0) {
              ctx.ins('watch', 'DJN', 'B', L('watch'), L('count'));
              ctx.ins('', 'MOV', 'I', L('jump'), loop);
              ctx.ins('', 'DAT', 'F', '#0', '#0');
              ctx.ins('count', 'DAT', 'F', '#0', `#${P.TIME}`);
            } else {
              const [x, y] = P.MODE === 1 ? [L('mark'), L('ref')] : [loop, L('ref')];
              ctx.ins('watch', old ? 'CMP' : 'SEQ', 'I', x, y);
              ctx.ins('', 'JMP', 'B', L('fire'));
              ctx.ins('', 'JMP', 'B', L('watch'));
              ctx.ins('fire', 'MOV', 'I', L('jump'), loop);
              // A marker hit leaves a running: its next lap takes it to b. Damage may
              // have killed it, so the watchdog starts b itself.
              if (P.MODE === 1) ctx.ins('', 'DAT', 'F', '#0', '#0'); else ctx.ins('', 'JMP', 'B', bEntry);
              if (P.MODE === 1) ctx.ins('mark', 'DAT', 'F', '#0', '#1');
              ctx.ins('ref', 'DAT', 'F', '#0', '#1');
            }
            // Copied over a's loop, so its offset is from there to b.
            ctx.ins('jump', 'JMP', 'B', `${bEntry}-${loop}`);
            break;
          }
          case 'apart': {
            const [a, b] = kids, bs = spanOf(b);
            copyLoop(ctx, 'start', 'src', 'dst', 'count');
            ctx.ins('', 'SPL', 'B', hopFrom(entryOf(b), P.D, P.DY, P.DZ));
            ctx.ins('', 'JMP', 'B', entryOf(a));
            ctx.ins('src', 'DAT', 'F', '#0', `#${bs.start + bs.size - pc}`);
            ctx.ins('dst', 'DAT', 'F', '#0', `#${hop(bs.start + P.D + bs.size - pc, P.DY, P.DZ)}`);
            ctx.ins('count', 'DAT', 'F', '#0', `#${bs.size}`);
            emit(a, env);
            emit(b, env);
            break;
          }
          case 'copies': {
            const x = spanOf(kids[0]);
            for (let k = 1; k < P.N; k++) {
              copyLoop(ctx, k === 1 ? 'start' : `copy${k}`, 'src' + k, 'dst' + k, 'count' + k);
            }
            for (let k = 1; k < P.N; k++) ctx.ins('', 'SPL', 'B', hopFrom(entryOf(kids[0]), k * P.D, k * P.DY, k * P.DZ));
            ctx.ins('', 'JMP', 'B', entryOf(kids[0]));
            for (let k = 1; k < P.N; k++) {
              ctx.ins('src' + k, 'DAT', 'F', '#0', `#${x.start + x.size - pc}`);
              ctx.ins('dst' + k, 'DAT', 'F', '#0', `#${hop(x.start + k * P.D + x.size - pc, k * P.DY, k * P.DZ)}`);
              ctx.ins('count' + k, 'DAT', 'F', '#0', `#${x.size}`);
            }
            emit(kids[0], env);
            break;
          }
          case 'switch': {
            const n = kids.length, choice = L('choice'), result = L('result'), losses = L('losses');
            ctx.ins('start', 'LDP', 'AB', '#0', result);
            ctx.ins('', 'LDP', 'AB', `#${P.CELL}`, choice);
            ctx.ins('', 'MOD', 'AB', `#${n}`, choice);
            if (P.POLICY === 0) {                       // move on after a loss
              ctx.ins('', 'JMN', 'B', L('keep'), result);
              ctx.ins('', 'ADD', 'AB', '#1', choice);
            } else if (P.POLICY === 1) {                // move on after two losses in a row
              ctx.ins('', 'LDP', 'AB', `#${P.CELL + 1}`, losses);
              ctx.ins('', 'JMN', 'B', L('won'), result);
              ctx.ins('', 'ADD', 'AB', '#1', losses);
              ctx.ins('', 'SLT', 'AB', '#1', losses);
              ctx.ins('', 'JMP', 'B', L('keep'));
              ctx.ins('', 'ADD', 'AB', '#1', choice);
              ctx.ins('won', 'MOV', 'AB', '#0', losses);
            } else {                                    // move on every round but the first
              ctx.ins('', 'ADD', 'AB', '#1', result);
              ctx.ins('', 'JMZ', 'B', L('keep'), result);
              ctx.ins('', 'ADD', 'AB', '#1', choice);
            }
            ctx.ins('keep', 'MOD', 'AB', `#${n}`, choice);
            ctx.ins('', 'STP', 'B', choice, `#${P.CELL}`);
            if (P.POLICY === 1) ctx.ins('', 'STP', 'B', losses, `#${P.CELL + 1}`);
            // choice B becomes the distance to its table entry: JMP @choice lands there.
            ctx.ins('', 'ADD', 'AB', `#${L('table')}-${choice}`, choice);
            ctx.ins('', 'JMP', 'B', `@${choice}`);
            ctx.ins('result', 'DAT', 'F', '#0', '#0');
            ctx.ins('choice', 'DAT', 'F', '#0', '#0');
            if (P.POLICY === 1) ctx.ins('losses', 'DAT', 'F', '#0', '#0');
            kids.forEach((kid, i) => ctx.ins(i ? '' : 'table', 'JMP', 'B', entryOf(kid)));
            for (const kid of kids) emit(kid, env);
            break;
          }
          case 'restart': {
            // start: note the loop, back the member up, split off the watcher, run it.
            const x = kids[0], xs = spanOf(x), loop = x.ns + leaves[x.id].loop, cmp = old ? 'CMP' : 'SEQ';
            ctx.ins('start', 'MOV', 'I', loop, L('ref'));
            copyLoop(ctx, 'save', 'src', 'dst', 'count');
            ctx.ins('', 'SPL', 'B', L('watch'));
            ctx.ins('', 'JMP', 'B', entryOf(x));
            emit(x, env);
            ctx.ins('watch', cmp, 'I', loop, L('ref'));
            ctx.ins('', 'JMP', 'B', L('fire'));
            ctx.ins('', 'JMP', 'B', L('watch'));
            // fire: copy the backup back over the member, re-arm, start it, keep watching.
            copyLoop(ctx, 'fire', 'back', 'home', 'again');
            ctx.ins('', 'MOV', 'AB', `#${L('spare')}+${xs.size}-${L('back')}`, L('back'));
            ctx.ins('', 'MOV', 'AB', `#${xs.size}`, L('again'));
            ctx.ins('', 'MOV', 'AB', `#${xs.start + xs.size - pc}-${L('home')}`, L('home'));
            ctx.ins('', 'SPL', 'B', entryOf(x));
            ctx.ins('', 'JMP', 'B', L('watch'));
            ctx.ins('ref', 'DAT', 'F', '#0', '#0');
            ctx.ins('src', 'DAT', 'F', '#0', `#${xs.start + xs.size - pc}`);
            ctx.ins('dst', 'DAT', 'F', '#0', `#${L('spare')}+${xs.size}-${L('dst')}`);
            ctx.ins('count', 'DAT', 'F', '#0', `#${xs.size}`);
            ctx.ins('back', 'DAT', 'F', '#0', `#${L('spare')}+${xs.size}-${L('back')}`);
            ctx.ins('home', 'DAT', 'F', '#0', `#${xs.start + xs.size - pc}`);
            ctx.ins('again', 'DAT', 'F', '#0', `#${xs.size}`);
            for (let i = 0; i < xs.size; i++) ctx.ins(i ? '' : 'spare', 'DAT', 'F', '#0', '#0');
            break;
          }
          case 'parboot': {
            const x = kids[0], xs = spanOf(x), entry = entryOf(x), cmp = old ? 'CMP' : 'SEQ';
            const loop = P.REACT ? x.ns + leaves[x.id].loop : null;
            if (P.REACT) ctx.ins('start', 'MOV', 'I', loop, L('ref'));         // note the loop as it is now
            for (let i = 2; i <= P.K; i++) ctx.ins(i === 2 && !P.REACT ? 'start' : '', 'SPL', 'B', L('loop' + i));
            if (P.STAY) ctx.ins(P.K < 2 && !P.REACT ? 'start' : '', 'SPL', 'B', entry);   // a process stays on the original
            if (P.K < 2 && !P.REACT && !P.STAY) ctx.mark('start');
            // K independent copy loops, each copying all of x to + HOP.
            for (let i = 1; i <= P.K; i++) {
              copyLoop(ctx, 'loop' + i, 'src' + i, 'dst' + i, 'cnt' + i);
              ctx.ins('', 'JMP', 'B', L('join'));
            }
            // The first loop to get here starts the copy; DJN decides atomically.
            ctx.ins('join', 'DJN', 'B', L('lose'), L('flag'));
            ctx.ins('', 'JMP', 'B', hopFrom(entry, P.HOP, P.HOPY, P.HOPZ));
            if (!P.REACT) ctx.ins('lose', 'DAT', 'F', '#0', '#0');
            else {
              // The losers watch the copy's loop; the first to see it hit reacts.
              ctx.ins('lose', cmp, 'I', hopFrom(loop, P.HOP, P.HOPY, P.HOPZ), L('ref'));
              ctx.ins('', 'JMP', 'B', L('fire'));
              ctx.ins('', 'JMP', 'B', L('lose'));
              ctx.ins('fire', 'DJN', 'B', L('quit'), L('flag2'));
              if (P.REACT === 2) {                                            // stun CARPET cells either side of the hit
                ctx.ins('carpet', 'MOV', 'I', L('stun'), `<${L('cpt')}`);
                ctx.ins('', 'DJN', 'B', L('carpet'), L('ccnt'));
              }
              copyLoop(ctx, 'again', 'src0', 'dst0', 'cnt0');                 // a new copy from the original
              ctx.ins('', 'JMP', 'B', hopFrom(entry, P.HOP2, P.HOP2Y, P.HOP2Z));
              ctx.ins('quit', 'DAT', 'F', '#0', '#0');
              ctx.ins('ref', 'DAT', 'F', '#0', '#0');
              ctx.ins('flag2', 'DAT', 'F', '#0', '#1');
              if (P.REACT === 2) {
                ctx.ins('cpt', 'DAT', 'F', '#0', `#${hopFrom(loop, P.HOP + P.CARPET + 1, P.HOPY, P.HOPZ)}`);
                ctx.ins('ccnt', 'DAT', 'F', '#0', `#${2 * P.CARPET + 1}`);
                ctx.ins('stun', 'SPL', 'B', '0', '0');
              }
              ctx.ins('src0', 'DAT', 'F', '#0', `#${xs.start + xs.size - pc}`);
              ctx.ins('dst0', 'DAT', 'F', '#0', `#${hop(xs.start + P.HOP2 + xs.size - pc, P.HOP2Y, P.HOP2Z)}`);
              ctx.ins('cnt0', 'DAT', 'F', '#0', `#${xs.size}`);
            }
            ctx.ins('flag', 'DAT', 'F', '#0', '#1');
            for (let i = 1; i <= P.K; i++) {
              ctx.ins('src' + i, 'DAT', 'F', '#0', `#${xs.start + xs.size - pc}`);
              ctx.ins('dst' + i, 'DAT', 'F', '#0', `#${hop(xs.start + P.HOP + xs.size - pc, P.HOPY, P.HOPZ)}`);
              ctx.ins('cnt' + i, 'DAT', 'F', '#0', `#${xs.size}`);
            }
            emit(x, env);
            break;
          }
          case 'classify': {
            const [a, b, c] = kids, loop = a.ns + leaves[a.id].loop;
            ctx.ins('start', 'SPL', 'B', L('watch'));
            ctx.ins('', 'JMP', 'B', entryOf(a));
            for (const kid of kids) emit(kid, env);
            ctx.ins('watch', 'SEQ', 'I', L('mark'), L('ref'));
            ctx.ins('', 'JMP', 'B', L('fire'));
            ctx.ins('', 'JMP', 'B', L('watch'));
            ctx.ins('fire', 'JMZ', 'F', L('zero'), L('mark'));
            ctx.ins('', 'MOV', 'I', L('toC'), loop);
            ctx.ins('', 'DAT', 'F', '#0', '#0');
            ctx.ins('zero', 'MOV', 'I', L('toB'), loop);
            ctx.ins('', 'DAT', 'F', '#0', '#0');
            ctx.ins('mark', 'DAT', 'F', '#0', '#1');
            ctx.ins('ref', 'DAT', 'F', '#0', '#1');
            // Copied over a's loop, so their offsets are from there.
            ctx.ins('toB', 'JMP', 'B', `${entryOf(b)}-${loop}`);
            ctx.ins('toC', 'JMP', 'B', `${entryOf(c)}-${loop}`);
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
  // Lay out until the sizes stop changing: a block can depend on another's size
  // (restart's backup is as long as its member), so two passes aren't always enough.
  let out = pass(null);
  for (let i = 0; i < 6; i++) {
    const next = pass({ total: out.total, spans: out.spans });
    const stable = next.total === out.total && JSON.stringify(next.spans) === JSON.stringify(out.spans);
    out = next;
    if (stable && i > 0) break;
  }
  const entry = entryOf(root);
  const header = [`;name ${name}`, ';author ZoreWars', `;strategy ${shape(tree)}`, `;assert CORESIZE==${core}`];
  const source = [...header, ...(old ? [] : [`ORG ${entry}`]), ...out.lines, old ? `END ${entry}` : 'END'].join('\n') + '\n';
  return { source, root, labels: out.labels, spans: out.spans, total: out.total, entry };
}

// A tree's shape without its numbers: what evolution counts as a new way of combining blocks.
export function shape(node) {
  return node.kids ? `${node.id}(${node.kids.map(shape).join(',')})` : node.id;
}
