import {fanLines} from './fan-lines.js';
export {fanLines} from './fan-lines.js';
// Combinators, contracts and the linker (docs/block-algebra.md). A tree is
// { id, P?, kids? }: a leaf from leaves.js, or a combinator from here.
import { leaves } from './leaves.js';
import { initialContract, leafContract, combinatorContract } from './contracts.js';
import { makeGeometry } from '../../src/engine/geometry.js';

export const combinators = {
  seq: { kids: [2, 8], purpose: 'Members run one after another; each hands control to the next.' },
  par: { kids: [2, 4], purpose: 'Members launched side by side with SPL.' },
  relocate: { kids: [1, 1], params: { HOP: [256, 54000] }, defaults: { HOP: 4096 }, purpose: 'Copies its member to probe + HOP and runs it there.' },
  boot: { kids: [1, 2], params: { HOP: [0, 54000], UNROLL: [1, 4], HOPY: [0, 200], HOPZ: [0, 200], WIPE: [0, 1], EARLY: [0, 1] }, defaults: { HOP: 4096, UNROLL: 1, HOPY: 0, HOPZ: 0, WIPE: 0, EARLY: 0 },
    purpose: 'Copies its first member to + HOP (UNROLL cells per loop) and runs the copy; the second (data) stays behind. WIPE 1: the boot then erases its own pointers to the copy, so a scanner that finds the boot learns nothing. EARLY 1 (gap 10, copy-ahead): copies forward and SPLs into the copy as soon as its entry is in, then finishes copying the tail while it already runs, so the body is live and safe much sooner against a fast quickscan (\'94, ring only).' },
  image: { kids: [2, 4], purpose: 'Members laid out in order; the first runs, the rest are data.' },
  trigger: { kids: [2, 2], params: { MODE: [0, 2], TIME: [1, 4096] }, defaults: { MODE: 0, TIME: 2000 },
    purpose: 'Runs its first member (a block with a loop) with a watcher beside it; when the watcher fires it rewrites the loop to jump to the second member. MODE 0: after TIME laps of the watcher; 1: when its marker is damaged; 2: when the first member\'s loop is damaged (a watchdog).' },
  apart: { kids: [2, 2], params: { D: [0, 54000], DY: [0, 200], DZ: [0, 200] }, defaults: { D: 4000, DY: 0, DZ: 0 },
    purpose: 'Copies its second member D cells away and runs it there beside the first, so one hit can\'t find both.' },
  copies: { kids: [1, 1], params: { N: [2, 4], D: [0, 54000], DY: [0, 200], DZ: [0, 200] }, defaults: { N: 2, D: 2667, DY: 0, DZ: 0 },
    purpose: 'Runs N copies of its member, D cells apart.' },
  switch: { kids: [2, 4], params: { CELL: [1, 500], POLICY: [0, 2] }, defaults: { CELL: 17, POLICY: 0 },
    purpose: 'Chooses one of its members by P-space (the 94x hill only). POLICY 0: keep the choice after a win or tie, move to the next after a loss; 1: move on only after two losses in a row; 2: move on every round.' },
  fork: { kids: [3, 3], params: { BY: [0, 1] }, defaults: { BY: 0 },
    purpose: 'Runs its first member (an opening that provides a probe), then picks a body by what it found. BY 0: the second member if the probe holds a hit, the third if it is still at the image boundary (nothing found). BY 1 (the opening must provide a verdict, as probe-verdict does): the second member if it found a body, the third if it found nothing or a lone cell (a bomb or decoy).' },
  restart: { kids: [1, 1], purpose: 'Keeps a pristine copy of its member (a block with a loop) and a watcher; when the loop is damaged, copies the member back and starts it again.' },
  parboot: { kids: [1, 1],
    params: { K: [1, 4], HOP: [0, 54000], HOPY: [0, 200], HOPZ: [0, 200], STAY: [0, 1], REACT: [0, 2], HOP2: [0, 54000], HOP2Y: [0, 200], HOP2Z: [0, 200], CARPET: [1, 20] },
    defaults: { K: 2, HOP: 4000, HOPY: 0, HOPZ: 0, STAY: 0, REACT: 0, HOP2: 2000, HOP2Y: 0, HOP2Z: 0, CARPET: 8 },
    purpose: 'A boot by K independent copy loops, each copying its member to + HOP, so a bomb on one loop doesn\'t stop the copy; the first loop to finish starts the copy. STAY 1 keeps a process running the original too. REACT: the other loops stay on as watchers of the copy\'s loop; when it is hit they make a new copy at + HOP2 (1), first stunning CARPET cells either side of the hit (2).' },
  fanboot: { kids: [2, 2], params: { N: [2, 16], K: [1, 4], SPLIT: [0, 1], HOPA: [0, 54000], HOPB: [0, 54000] }, defaults: { N: 8, K: 2, SPLIT: 0, HOPA: 2000, HOPB: 5000 },
    purpose: 'The hill fan boot of two bodies: a fan of SPLs makes N processes that copy both members in lockstep (each copy line copies N cells), the first to + HOPA and the second to + HOPB. The copy pointers are the jump vectors, so the launch happens the moment the copy is done. SPLIT 0: K*N processes enter the first member and N the second; SPLIT 1: N-1 the first and one the second. N is 2, 3, 4, 6, 8, 12 or 16.' },
  classify: { kids: [3, 3], params: { MARKS: [1, 10], DIST: [256, 27000], SPREAD: [1, 2000] }, defaults: { MARKS: 6, DIST: 2000, SPREAD: 800 }, purpose: 'Runs its first member (a block with a loop) beside MARKS tripwire cells scattered DIST away, SPREAD apart, so an attacker out in the core trips one before it reaches the body. When a tripwire is overwritten it reads what hit it: both fields zero (a clear\'s or stone\'s DAT) hands over to the second member; anything else (copied code, a scanner\'s bomb) to the third.' },
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
  if (node.id === 'seq' || node.id === 'image' || node.id === 'fork') return entryOf(node.kids[0]);
  return node.ns + { par: 'split', relocate: 'transition', boot: 'boot', trigger: 'start', apart: 'start', copies: 'start', switch: 'start', restart: 'start', classify: 'start', parboot: 'start', fanboot: 'start' }[node.id];
}

// par lays out members that write ahead of themselves (a spiral's imps) last.
const parOrder = (kids) => [...kids].sort((a, b) => (leaves[a.id]?.layout === 'last') - (leaves[b.id]?.layout === 'last'));

// A fan of SPLs that leaves exactly n processes in lockstep on the line after it:
// SPL 2 / SPL 1 makes three, and every further SPL 1 doubles them.

// The contract of a node: what it does, what it needs, and why it can't be built.
export function iface(node, settings) {
  const def = definition(node.id), out = initialContract(node, def);
  if (isLeaf(node)) return leafContract(node, def, settings, out);
  // Refuse invalid parameters before calling arithmetic/loop-dependent policies.
  if (out.mismatches.length) return out;
  const [lo, hi] = def.kids, kids = node.kids ?? [];
  if (kids.length < lo || kids.length > hi) out.mismatches.push(`${node.id} takes ${lo}${hi > lo ? ` to ${hi}` : ''} members`);
  return combinatorContract(node, settings, kids.map(k => iface(k, settings)), out);
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

// Free B-fields (gap #4 of docs/hill-recipe-book.md): runs of consecutive cells
// whose B-field the block never reads, so another block may keep data there.
// Today the fanboot's fan lines offer theirs (and the SPL *va lines of SPLIT 0).
function freeRuns(node) {
  if (node.id !== 'fanboot' || !fanLines(node.P.N)) return [];
  const runs = [{ run: 'fan', count: fanLines(node.P.N).length }];
  if (!node.P.SPLIT && node.P.K > 2) runs.push({ run: 'spk', count: node.P.K - 1 });
  return runs;
}

// A block that claims free B-fields (claimsFreeB: group sizes, each group kept in
// consecutive cells) gets them from runs offered later in the same seq, which run
// after it. Returns the cells' contents: key `${ns}:${run}:${i}` -> { label, value }.
function assignClaims(root) {
  const cells = new Map();
  const walk = (node) => {
    if (node.id === 'seq') node.kids.forEach((kid, i) => {
      const def = leaves[kid.id], sizes = def?.claimsFreeB?.(kid.P);
      if (!sizes) return;
      const runs = node.kids.slice(i + 1).flatMap((n) => freeRuns(n).map((r) => ({ ...r, ns: n.ns, used: 0 })));
      kid.claimed = new Set();
      sizes.forEach((size, g) => {
        const r = runs.find((x) => x.count - x.used >= size);
        if (!r) return;
        for (let c = 0; c < size; c++) cells.set(`${r.ns}:${r.run}:${r.used + c}`, def.claimCell(kid.P, (l) => kid.ns + l, 3 * g + c));
        r.used += size;
        kid.claimed.add(g);
      });
    });
    for (const k of node.kids ?? []) walk(k);
  };
  walk(root);
  return cells;
}

// Lays the tree out as Redcode: a measuring pass, then passes with every size
// known until the layout stops changing.
export function link(tree, settings, { name = 'Tree' } = {}) {
  const root = annotate(tree), old = settings.dialect === '88', core = settings.coreSize;
  const torus = settings.topology === 'torus';
  const claims = assignClaims(root);
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
        P: node.P, old, core, settings, L, next: env.next, span: env.span ?? total, total, claimed: node.claimed,
        siblings: env.siblings ?? [],
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
        // Cell i of a free run this block offers: an instruction whose B-field (otherwise
        // `b`) holds what a claiming block put there, under that block's label.
        free(run, i, label, opcode, mod, a, b) {
          const c = claims.get(`${node.ns}:${run}:${i}`);
          if (c) { labels[c.label] = pc; lines.push(c.label); }
          this.ins(label, opcode, mod, a, c ? c.value : b);
        },
      };
    };
    const spanOf = (node) => sizes?.spans[node.ns] ?? { start: 0, size: 0 };
    // How far a member's entry is from its first cell (state cells come first), from the last pass.
    const entryOffset = (node) => (sizes?.labels?.[entryOf(node)] ?? 0) - spanOf(node).start;
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
        node.span = env.span ?? total;               // what it protects, for its linked check
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
            if (P.EARLY) {
              // Copy-ahead (gap 10). Copy the member forward (postincrement), and the
              // moment its entry is in, SPL a process into the copy and keep copying the
              // tail behind it. A single-process body stays one step behind the boot, so
              // each cell it reaches has already been written; the body is live and safe
              // long before the copy is complete.
              const entryOff = (sizes?.labels?.[entryOf(kids[0])] ?? main.start) - main.start;
              const head = Math.max(1, Math.min(main.size, entryOff + 1));   // copy through the entry, then launch
              const tail = main.size - head;
              const launch = hopFrom(entryOf(kids[0]), P.HOP, P.HOPY, P.HOPZ);
              ctx.ins('boot', 'MOV', 'I', `>${L('copyFrom')}`, `>${L('copyTo')}`);
              ctx.ins('', 'DJN', 'B', L('boot'), L('headCount'));
              ctx.ins('go', 'SPL', 'B', launch);
              for (let i = 0; i < P.UNROLL; i++) ctx.ins(i ? '' : 'tail', 'MOV', 'I', `>${L('copyFrom')}`, `>${L('copyTo')}`);
              ctx.ins('', 'DJN', 'B', L('tail'), L('tailCount'));
              if (P.WIPE) {
                // Erase the launch and the copy pointer, then die: the abandoned image points nowhere.
                ctx.ins('', 'MOV', 'I', L('wiped'), L('go'));
                ctx.ins('', 'MOV', 'I', L('wiped'), L('copyTo'));
                ctx.ins('wiped', 'DAT', 'F', '#0', '#0');
              } else ctx.ins('', 'JMP', 'B', launch);   // the boot process joins the copy
              ctx.ins('copyFrom', 'DAT', 'F', '#0', `#${main.start - pc}`);               // forward: the member's first cell
              ctx.ins('copyTo', 'DAT', 'F', '#0', `#${hop(main.start + P.HOP - pc, P.HOPY, P.HOPZ)}`);
              ctx.ins('headCount', 'DAT', 'F', '#0', `#${head}`);
              ctx.ins('tailCount', 'DAT', 'F', '#0', `#${Math.max(0, Math.ceil(tail / P.UNROLL))}`);
              break;
            }
            copyLoop(ctx, 'boot', 'copyFrom', 'copyTo', 'copyCount', P.UNROLL);
            if (P.WIPE) {
              // Start the copy, then erase the launch and the destination pointer and die.
              ctx.ins('go', 'SPL', 'B', hopFrom(entryOf(kids[0]), P.HOP, P.HOPY, P.HOPZ));
              ctx.ins('', 'MOV', 'I', L('wiped'), L('go'));
              ctx.ins('', 'MOV', 'I', L('wiped'), L('copyTo'));
              ctx.ins('wiped', 'DAT', 'F', '#0', '#0');
            } else ctx.ins('', 'JMP', 'B', hopFrom(entryOf(kids[0]), P.HOP, P.HOPY, P.HOPZ));
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
            // Each member learns where the other runs, in its own frame (ring only).
            // The whole image, as the original holds it, D away either way.
            const whole = env.span ?? total, near = (o) => (torus ? [] : [{ start: (o % core + core) % core, size: whole }]);
            emit(a, { ...env, siblings: [...(env.siblings ?? []), ...near(P.D)] });
            emit(b, { ...env, siblings: [...(env.siblings ?? []), ...near(-P.D)] });
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
            // The copies run the same code and can't tell which one they are, so each
            // avoids the others wherever they could be: k*D away, k = ±1 .. ±(N-1).
            const sib = torus ? [] : [...new Set(Array.from({ length: 2 * (P.N - 1) }, (_, i) => ((i < P.N - 1 ? i + 1 : P.N - 1 - i - 1) * P.D % core + core) % core))]
              .map((o) => ({ start: o, size: env.span ?? total }));   // the whole image: the original holds the copy loops too
            emit(kids[0], { ...env, siblings: [...(env.siblings ?? []), ...sib] });
            break;
          }
          case 'fork': {
            // The opening's probe B is the image boundary (span) when it found nothing.
            const opening = new Map(iface(kids[0], settings).provides);
            // The opening's state first, so its probe is the image's first cell.
            for (const leaf of [...(isLeaf(kids[0]) ? [kids[0]] : stateLeaves(kids[0])), ...stateLeaves(node)]) emitState(leaf, env);
            emit(kids[0], { ...env, next: L('pick') });
            const probe = opening.get('probe');
            if (P.BY) ctx.ins('pick', 'SNE', 'AB', '#2', opening.get('verdict'));         // not a body: skip
            else ctx.ins('pick', old ? 'CMP' : 'SEQ', 'AB', `#${env.span ?? total}`, probe);   // nothing found: skip
            ctx.ins('', 'JMP', 'B', entryOf(kids[1]));              // a hit
            ctx.ins('', 'JMP', 'B', entryOf(kids[2]));              // nothing found
            scopes.push(opening);
            emit(kids[1], env);
            ctx.ins('gap', 'DAT', 'F', '#0', '#0');                 // an empty cell between the bodies, so a wipe that runs to
            emit(kids[2], env);                                     // the first empty cell stops between them
            scopes.pop();
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
          case 'fanboot': {
            // The fan, then every process runs each copy line once: MOV <v,{v copies one
            // cell per process, from v's B pointer to v's A pointer. Each member is copied
            // from its first cell (or from a JMP to its entry put in front of it), M cells
            // in all, so after the last copy v's A points at the copy's first cell and the
            // same cell, run as SPL / DJN / JMP, sends the processes there.
            const [a, b] = kids, N = P.N;
            const tramp = kids.map((k) => entryOffset(k) > 0);
            const M = kids.map((k, i) => Math.ceil((spanOf(k).size + tramp[i]) / N) * N);
            node.fan = { M, tramp };
            const [va, vb, sa] = [L('va'), L('vb'), P.SPLIT ? L('sa') : L('va')];
            fanLines(N).forEach((d, i) => ctx.free('fan', i, i ? '' : 'start', 'SPL', 'B', d, '0'));
            for (let i = 0; i < M[0] / N; i++) ctx.ins('', 'MOV', 'I', `<${sa}`, `{${va}`);
            for (let i = 0; i < M[1] / N; i++) ctx.ins('', 'MOV', 'I', `<${vb}`, `{${vb}`);
            const dst = (i, v) => `${L('c' + i)}+${[P.HOPA, P.HOPB][i]}+${M[i]}-${v}`, src = (i, v) => `${L('c' + i)}+${M[i]}-${v}`;
            if (P.SPLIT) ctx.ins('va', 'DJN', 'B', dst(0, va), `#${N}`);   // N-1 processes to a, the last falls through to b
            else {
              ctx.ins('va', 'SPL', 'B', dst(0, va), src(0, va));
              for (let k = 1; k < P.K; k++) ctx.free('spk', k - 1, '', 'SPL', 'B', `*${va}`, '0');
            }
            ctx.ins('vb', 'JMP', 'B', dst(1, vb), src(1, vb));
            if (P.SPLIT) ctx.ins('sa', 'DAT', 'F', '#0', src(0, sa));
            kids.forEach((k, i) => {
              if (tramp[i]) ctx.ins('c' + i, 'JMP', 'B', entryOf(k));
              else ctx.mark('c' + i);
              emit(k, env);
            });
            break;
          }
          case 'classify': {
            const [a, b, c] = kids, loop = a.ns + leaves[a.id].loop;
            const { MARKS, DIST, SPREAD } = ctx.P;
            // One process runs the sensor A; another scatters MARKS tripwires
            // DIST away (SPREAD apart) and sweeps them. A tripwire overwritten by
            // the enemy is read: both fields zero (a stone/clear's DAT) -> B,
            // anything else (copied code) -> C. ptr is shared by the planter and
            // the watcher, so both index the same remote cells.
            ctx.ins('start', 'SPL', 'B', L('plant'));
            ctx.ins('', 'JMP', 'B', entryOf(a));
            for (const kid of kids) emit(kid, env);
            ctx.ins('plant', 'MOV', 'AB', L('base'), L('ptr'));          // ptr.b = DIST
            ctx.ins('', 'MOV', 'AB', `#${MARKS}`, L('pcnt'));
            ctx.ins('pl', 'MOV', 'I', L('trip'), `@${L('ptr')}`);        // write a tripwire at ptr + DIST+k*SPREAD
            ctx.ins('', 'ADD', 'AB', `#${SPREAD}`, L('ptr'));
            ctx.ins('', 'DJN', 'B', L('pl'), L('pcnt'));
            ctx.ins('sweep', 'MOV', 'AB', L('base'), L('ptr'));          // reset ptr.b = DIST
            ctx.ins('', 'MOV', 'AB', `#${MARKS}`, L('wcnt'));
            ctx.ins('wl', 'SEQ', 'I', `@${L('ptr')}`, L('trip'));        // tripwire unchanged?
            ctx.ins('', 'JMP', 'B', L('fire'));                          // hit: ptr points at it
            ctx.ins('', 'ADD', 'AB', `#${SPREAD}`, L('ptr'));            // (skipped to here when unchanged)
            ctx.ins('', 'DJN', 'B', L('wl'), L('wcnt'));
            ctx.ins('', 'JMP', 'B', L('sweep'));
            ctx.ins('fire', 'JMZ', 'F', L('zero'), `@${L('ptr')}`);      // the hit cell's fields zero? -> B
            ctx.ins('', 'MOV', 'I', L('toC'), loop);
            ctx.ins('', 'DAT', 'F', '#0', '#0');
            ctx.ins('zero', 'MOV', 'I', L('toB'), loop);
            ctx.ins('', 'DAT', 'F', '#0', '#0');
            ctx.ins('base', 'DAT', 'F', `#${DIST}`, `#${DIST}`);
            ctx.ins('ptr', 'DAT', 'F', '#0', `#${DIST}`);
            ctx.ins('pcnt', 'DAT', 'F', '#0', '#0');
            ctx.ins('wcnt', 'DAT', 'F', '#0', '#0');
            ctx.ins('trip', 'DAT', 'F', '#0', '#1');                     // the tripwire value / reference
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
    const next = pass({ total: out.total, spans: out.spans, labels: out.labels });
    const stable = next.total === out.total && JSON.stringify(next.spans) === JSON.stringify(out.spans);
    out = next;
    if (stable && i > 0) break;
  }
  // Checks a block can make only once it knows where everything landed.
  const misfits = [];
  const check = (node) => {
    const def = leaves[node.id];
    if (def?.linked) misfits.push(...def.linked(node.P, settings, (l) => out.labels[node.ns + l], { span: node.span }));
    for (const k of node.kids ?? []) check(k);
  };
  check(root);
  const entry = entryOf(root);
  const header = [`;name ${name}`, ';author ZoreWars', `;strategy ${shape(tree)}`, `;assert CORESIZE==${core}`];
  const source = [...header, ...(old ? [] : [`ORG ${entry}`]), ...out.lines, old ? `END ${entry}` : 'END'].join('\n') + '\n';
  return { source, root, labels: out.labels, spans: out.spans, total: out.total, entry, misfits };
}

// A tree's shape without its numbers: what evolution counts as a new way of combining blocks.
export function shape(node) {
  return node.kids ? `${node.id}(${node.kids.map(shape).join(',')})` : node.id;
}
