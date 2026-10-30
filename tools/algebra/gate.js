// The behaviour gate for trees (docs/block-algebra.md): run the warrior alone
// and watch every block do what its contract says. The shapes combo can make
// (a chain of an opening and a clear; bodies side by side) keep combo's exact
// checks. Every other tree goes through the generic gate: each copy of each
// block is watched with that block's own checks, every block must be entered,
// bodies must still be running at the end, and combinators' scenarios (a
// planted marker, a P-space history) must get the reaction they promise.
// Passing means the warrior behaves when alone; it says nothing about how it fights.
import { compile, VM } from '../../src/engine/index.js';
import { leaves } from './leaves.js';
import { link, iface, entryOf, switchChoice } from './link.js';
import { makeGeometry } from '../../src/engine/geometry.js';

const isLeaf = (node) => Object.hasOwn(leaves, node.id);
const parOrder = (kids) => [...kids].sort((a, b) => (leaves[a.id]?.layout === 'last') - (leaves[b.id]?.layout === 'last'));

// The running part of a tree, and the boot around it, if any.
function unwrap(root) {
  let node = root, boot = null;
  if (node.id === 'image') node = node.kids[0];
  if (node.id === 'boot') { boot = node; node = node.kids[0]; }
  return { main: node, boot };
}

export function shapeOf(root) {
  const { main } = unwrap(root);
  const last = main.id === 'seq' ? main.kids.at(-1) : main;
  const fin = last.id === 'relocate' ? last.kids[0] : last;
  const openings = main.id === 'seq' ? main.kids.slice(0, -1) : [];
  const core = (n) => isLeaf(n) && leaves[n.id].file === 'core.js';
  if (core(fin) && leaves[fin.id].kind === 'finisher' && (main === fin || (openings.length === 1 && core(openings[0]) && leaves[openings[0].id].kind === 'opening'))) return 'chain';
  const coreBody = (n) => core(n) && leaves[n.id].kind === 'body';
  if (coreBody(main) || (main.id === 'par' && main.kids.every(coreBody))) return 'bodies';
  return 'generic';
}

export function gate(built) {
  const shape = shapeOf(built.root);
  if (shape === 'chain') return checkChain(built);
  if (shape === 'bodies') return checkBodiesTree(built);
  return checkGeneric(built);
}

const sameIns = (core) => {
  const norm = (x) => ((x % core) + core) % core;
  return (a, b) => ['op', 'mod', 'aMode', 'bMode'].every((k) => a[k] === b[k]) && norm(a.a) === norm(b.a) && norm(a.b) === norm(b.b);
};

function checkChain(built) {
  const { w, settings, root, labels, spans, total } = built;
  const core = settings.coreSize, norm = (x) => ((x % core) + core) % core, same = sameIns(core);
  const { main, boot } = unwrap(root);
  const members = main.id === 'seq' ? main.kids : [main];
  const last = members.at(-1), relocated = last.id === 'relocate' ? last : null;
  const fin = relocated ? relocated.kids[0] : last, F = leaves[fin.id], P = fin.P;
  const opening = members.length > 1 ? members.at(-2) : null;
  const at = (node, local) => labels[node.ns + local];
  const counted = F.protects === 'self';
  const fin0 = spans[fin.ns].start, finLen = spans[fin.ns].size, runnable = fin0 + finLen;
  const span = boot ? spans[main.ns].size : total;
  const [protStart, protLen] = counted ? [fin0, finLen] : [spans[main.ns].start, span];
  // Fields each block may change while the clear runs.
  const mutable = {};
  const collect = (node) => {
    if (isLeaf(node)) {
      const m = leaves[node.id].mutable;
      for (const [label, fields] of (typeof m === 'function' ? m(node.P) : m) ?? []) mutable[at(node, label)] = fields;
    }
    for (const k of node.kids ?? []) collect(k);
  };
  collect(counted ? fin : main);
  const stunPc = at(fin, F.writers.stun), killPc = at(fin, F.writers.kill);
  const expectedStuns = !P.PHASE ? 0 : P.PHASE === 2 ? core - (counted ? finLen : span) : P.STUN;
  const timed = opening && (opening.id === 'opening-bomber' || opening.id === 'opening-bscan');
  const probeIdx = opening ? at(opening, 'probe') : null;
  const expectedAttacks = opening?.id === 'opening-bomber' ? leaves['opening-bomber'].expectedAttacks(opening.P, settings) : null;
  const hop = boot ? boot.P.HOP : 0;

  function run(base, { inject = [], untilEntry = false } = {}) {
    const vm = new VM(settings); vm.load([w], { positions: [base] });
    for (const [a, ins] of inject) vm.poke(a, ins);
    const dest = norm(base + hop);
    const finAt = relocated ? norm(dest + probeIdx + relocated.P.HOP) : norm(dest + fin0);
    const addr = (i) => norm(finAt - fin0 + i);
    const protAddr = counted ? finAt : norm(dest + protStart);
    const inProtected = (c) => norm(c - protAddr) < protLen;
    const intact = () => {
      for (let i = 0; i < protLen; i++) {
        const k = protStart + i, x = w.instructions[k], cell = { ...vm.peek(protAddr + i) };
        for (const f of mutable[k] ?? []) cell[f] = x[f];
        if (!same(x, cell)) return false;
      }
      return true;
    };
    let attacks = 0;
    const attackAt = opening && at(opening, 'attackWrite') !== undefined ? norm(dest + at(opening, 'attackWrite')) : -1;
    while (!vm.done && vm.processes(0)[0] !== finAt && vm.cycle < settings.maxCycles) {
      if (vm.step()?.pc === attackAt) attacks++;
    }
    if (vm.processes(0)[0] !== finAt) throw new Error('The finisher was never entered');
    if (!intact()) throw new Error('The finisher did not arrive intact');
    if (timed && vm.peek(dest + at(opening, 'clock')).b !== 0) throw new Error('The opening left before its timer ran out');
    const probeB = probeIdx === null ? null : vm.peek(dest + probeIdx).b;
    const arrivedAt = vm.cycle;
    if (untilEntry) return { vm, dest, probeB, attacks };
    if (expectedAttacks !== null && attacks !== expectedAttacks) throw new Error('The bomber missed its expected bombs');

    // The first clear write and the stun-to-DAT transition.
    const ptrAt = counted ? addr(at(fin, F.pointer)) : norm(dest + probeIdx);
    const expectedFirst = counted ? norm(P.BACKWARD ? finAt - 1 : finAt + finLen) : norm(dest + probeIdx + (probeB >= span ? probeB : span));
    let stuns = 0, firstWrite = null, firstDat = null;
    while (!vm.done && firstDat === null && vm.cycle < settings.maxCycles) {
      const pc = vm.processes(0)[0], writing = pc === addr(stunPc) || pc === addr(killPc);
      const target = writing ? norm(ptrAt + vm.peek(ptrAt).b + (counted && P.BACKWARD ? -1 : 0)) : null;
      vm.step();
      if (!writing) continue;
      const stun = pc === addr(stunPc);
      if (inProtected(target) || vm.writerPc[target] !== pc || vm.peek(target).op !== (stun ? 'SPL' : 'DAT')) throw new Error('A clear write broke its contract');
      if (firstWrite === null && (firstWrite = target) !== expectedFirst) throw new Error('The clear did not start where its contract says');
      if (stun) stuns++; else firstDat = target;
    }
    if (firstDat === null || stuns !== expectedStuns) throw new Error('Incorrect stun phase');
    vm.run();
    if (!vm.warriors[0].alive || vm.cycle !== settings.maxCycles || vm.warriors[0].peak !== 1) throw new Error('Solo/process contract failed');
    if (!intact()) throw new Error('The clear damaged protected code');
    for (let c = 0; c < core; c++) if (!inProtected(c) && vm.writeCycle[c] < arrivedAt) throw new Error('The clear left cells untouched');
    return { base, arrivedAt, attacks, firstWrite, stunWrites: stuns, survives: true };
  }

  const observations = [];
  const bases = [0, core - 7];
  const moves = relocated ?? boot;
  if (moves) bases.push(norm(core - moves.P.HOP - Math.ceil(runnable / 2)));   // the copy wraps the end of core
  for (const base of bases) observations.push(run(base));

  // Scanners must react to what they find.
  const marker = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };
  const inImage = (c) => norm(c) < total;
  if (opening?.id === 'opening-bscan') {
    const dest = norm(hop), a = norm(dest + settings.maxLength + opening.P.STEP);
    if (!inImage(a)) {
      const r = run(0, { inject: [[a, marker]], untilEntry: true });
      if (r.attacks < 1 || r.vm.peek(a).op !== 'SPL') throw new Error('The B-scan ignored what it found');
      observations.push({ scenario: 'bscan-hit', at: a, attacks: r.attacks });
    }
  }
  if (opening?.id === 'opening-cmpscan') {
    const Q = opening.P, dest = norm(hop);
    for (let k = 1; k <= Q.SCANS; k++) {
      const a = norm(Q.START + k * Q.SSTEP), b = norm(Q.START + Q.GAP + k * Q.SSTEP);
      if (inImage(dest + a) || inImage(dest + b)) break;                     // earlier probes would see our own image
      if (a < span || b < span) continue;                                    // the guard skips these
      const hit = run(0, { inject: [[dest + a, marker]], untilEntry: true });
      if (hit.probeB !== a) throw new Error('The comparison scan handed on the wrong cell');
      const even = run(0, { inject: [[dest + a, marker], [dest + b, marker]], untilEntry: true });
      if (even.probeB === a) throw new Error('The comparison scan stopped on an equal pair');
      observations.push({ scenario: 'cmpscan-hit', probe: k, handedOn: a });
      break;
    }
  }
  return { ok: true, shape: 'chain', scope: 'openings then a clear; three load positions; full solo rounds; scanner hits', observations };
}

// Bodies: each one alone first (when there are several), then all together.
function checkBodiesTree(built) {
  const { root, settings } = built;
  const { main } = unwrap(root);
  const observations = [];
  if (main.id === 'par') for (const kid of main.kids) {
    const alone = link({ id: kid.id, P: kid.P }, settings);
    const w = compile(alone.source, 'redcode', settings);
    if (!w.ok) throw new Error(JSON.stringify(w.errors));
    observations.push({ alone: kid.id, ...checkBodies({ ...alone, w, settings }).observations[0] });
  }
  observations.push(...checkBodies(built).observations);
  return { ok: true, shape: 'bodies', scope: 'each body alone, then together; two load positions; full solo rounds (20,000 cycles with paper)', observations };
}

function checkBodies({ w, settings, root, labels, spans }) {
  if (!w?.ok) throw new Error('Bodies did not assemble');
  const core = settings.coreSize, norm = (x) => ((x % core) + core) % core, same = sameIns(core);
  const { main, boot } = unwrap(root);
  const parts = main.id === 'par' ? parOrder(main.kids) : [main];
  const alone = parts.length === 1, checkpoint = 1000, hop = boot ? boot.P.HOP : 0;
  const L = (node, local) => labels[node.ns + local];
  // Paper fills the process table; simulating it to the cycle limit costs minutes
  // on 94x. By this horizon it has spread over hundreds of copies.
  const horizon = parts.some((p) => p.id === 'paper') ? Math.min(settings.maxCycles, 20000) : settings.maxCycles;
  const observations = [];
  for (const base of [0, core - 7]) {
    const vm = new VM(settings); vm.load([w], { positions: [base] });
    const dest = norm(base + hop);
    const at = (node, local) => norm(dest + L(node, local));
    const inImage = (c) => norm(c - base) < w.instructions.length || norm(c - dest) < w.instructions.length;
    const fangs = parts.map(() => 0), stoneCells = parts.map(() => new Set());
    const paperCode = parts.map((p) => (p.id === 'paper' ? w.instructions.slice(L(p, 'pSilk') + 1, L(p, 'pSilk') + 5) : []));
    while (!vm.done && vm.cycle < horizon) {
      const pc = vm.processes(0)[0];
      // A fang must aim at the pit while the vampire's step is intact; a stone's bomb must land.
      const pending = parts.map((p) => {
        if (p.id === 'vampire' && pc === at(p, 'vMov') && same(vm.peek(at(p, 'vStep')), w.instructions[L(p, 'vStep')])) return norm(at(p, 'vFang') + vm.peek(at(p, 'vFang')).b);
        if (p.id === 'stone' && pc === at(p, 'tMov')) return norm(at(p, 'tBomb') + vm.peek(at(p, 'tBomb')).b);
        return null;
      });
      vm.step();
      parts.forEach((p, i) => {
        const t = pending[i];
        if (t === null) return;
        if (p.id === 'stone') { stoneCells[i].add(t); return; }
        if (inImage(t)) return;
        const fang = vm.peek(t);
        if (fang.op !== 'JMP' || norm(t + fang.a) !== at(p, 'vPit')) throw new Error('A fang does not lead to the pit');
        fangs[i]++;
      });
      if (vm.cycle === checkpoint) {
        // Every body must still be running: a process in its code (or, for moving bodies, in a copy of it).
        const running = vm.processes(0).map((q) => vm.peek(q));
        const healthy = parts.map((p, i) => {
          if (p.id === 'spiral') return running.some((x) => same(x, w.instructions[L(p, 'iImp')]));
          if (p.id === 'paper') return running.some((x) => paperCode[i].some((y) => same(x, y)));
          const { start, size } = spans[p.ns];
          return vm.processes(0).some((q) => norm(q - dest - start) < size);
        });
        if (healthy.includes(false)) throw new Error(`A body stopped running: ${parts.filter((_, i) => !healthy[i]).map((p) => p.id).join(', ')}`);
      }
    }
    if (!vm.warriors[0].alive || vm.cycle !== horizon) throw new Error('The warrior did not survive alone');
    const result = { base, processes: vm.processes(0).length, peak: vm.warriors[0].peak };
    if (alone) {
      const p = parts[0];
      if ((p.id === 'stone' || p.id === 'vampire') && vm.warriors[0].peak !== 1) throw new Error('A one-process body split');
      if (p.id === 'stone' && stoneCells[0].size < 100) throw new Error('The stone bombs too few cells');
      if (p.id === 'vampire' && fangs[0] < 100) throw new Error('The vampire drops too few fangs');
      if (p.id === 'spiral' && vm.processes(0).length !== 2 ** p.P.SK - 1) throw new Error('The spiral lost processes on its own');
      if (p.id === 'paper') {
        let copies = 0;
        for (let c = 0; c < core; c++) if (!inImage(c) && paperCode[0].every((x, i) => same(x, vm.peek(c + i)))) copies++;
        if (copies < 3) throw new Error('The paper made too few copies');
        result.copies = copies;
      }
      Object.assign(result, { fangs: fangs[0], stoneCells: stoneCells[0].size });
    }
    observations.push(result);
  }
  return { observations };
}

// ---------------------------------------------------------------------------
// The generic gate.

// Where each block runs: one entry per copy, as an offset from the load address,
// with what the gate expects of it.
function instances(root, labels, spans, settings) {
  const out = [];
  const geo = makeGeometry(settings);
  const vec = (x, y = 0, z = 0) => (geo ? geo.encode(x, y, z) : x);
  const plus = (a, b) => (geo ? geo.add(a, b) : a + b);
  const walk = (node, shifts, flags) => {
    if (isLeaf(node)) { for (const shift of shifts) out.push({ node, shift, ...flags }); return; }
    const k = node.kids;
    switch (node.id) {
      case 'boot': walk(k[0], shifts.map((s) => plus(s, vec(node.P.HOP, node.P.HOPY, node.P.HOPZ))), flags); if (k[1]) walk(k[1], shifts, flags); break;
      case 'relocate': {
        const probe = labels[node.probeLabel];
        walk(k[0], shifts.map((s) => s + probe + node.P.HOP - spans[k[0].ns].start), flags);
        break;
      }
      case 'apart': walk(k[0], shifts, flags); walk(k[1], shifts.map((s) => plus(s, vec(node.P.D, node.P.DY, node.P.DZ))), flags); break;
      case 'copies': walk(k[0], shifts.flatMap((s) => Array.from({ length: node.P.N }, (_, i) => plus(s, vec(i * node.P.D, i * node.P.DY, i * node.P.DZ)))), flags); break;
      case 'trigger':
        walk(k[0], shifts, { ...flags, mayStop: true });
        walk(k[1], shifts, { ...flags, ...(node.P.MODE ? { optional: true, triggered: node.ns } : {}) });
        break;
      case 'switch': k.forEach((kid, i) => walk(kid, shifts, { ...flags, optional: true, branch: `${node.ns}:${i}` })); break;
      case 'classify':
        walk(k[0], shifts, { ...flags, mayStop: true });
        walk(k[1], shifts, { ...flags, optional: true, branch: `${node.ns}:1` });
        walk(k[2], shifts, { ...flags, optional: true, branch: `${node.ns}:2` });
        break;
      default: for (const kid of k) walk(kid, shifts, flags);
    }
  };
  walk(root, [0], {});
  return out;
}

// What the combinators and blocks promise, as runs with something planted.
function scenarios(root, labels, settings) {
  const out = [{ name: 'alone' }];
  const walk = (node) => {
    // A block that reacts to an opponent (a scanner) plants one and checks its reaction in watch.final.
    if (isLeaf(node) && leaves[node.id].plant) out.push({ name: `${node.id}: planted target`, plant: node.ns, id: node.id });
    if (node.id === 'trigger' && node.P.MODE) {
      const target = node.P.MODE === 1 ? node.ns + 'mark' : node.kids[0].ns + leaves[node.kids[0].id].loop;
      out.push({ name: `trigger ${node.P.MODE === 1 ? 'marker' : 'damage'} hit`, at: 200, poke: labels[target], expect: node.ns });
    }
    if (node.id === 'switch') {
      // Every kind of history, against the model of the emitted code.
      const n = node.kids.length, { POLICY, CELL } = node.P;
      for (const [result, choice, losses] of [[-1, 0, 0], [1, 1, 0], [0, 0, 0], [0, 0, 1], [0, n - 1, 1], [1, n - 1, 1], [2, 1, 0]]) {
        const p = VM.freshPSpace(settings); p[0] = result; p[CELL] = choice; p[CELL + 1] = losses;
        const pick = switchChoice(POLICY, n, result, choice, losses);
        out.push({ name: `switch: result ${result}, choice ${choice}, losses ${losses}`, pspace: p, branch: `${node.ns}:${pick}` });
      }
    }
    if (node.id === 'classify') {
      const zero = { op: 'DAT', mod: 'F', aMode: '#', a: 0, bMode: '#', b: 0 };
      const code = { op: 'MOV', mod: 'I', aMode: '$', a: 0, bMode: '$', b: 1 };
      out.push({ name: 'classify: hit by a zero DAT', at: 200, poke: labels[node.ns + 'mark'], ins: zero, branch: `${node.ns}:1` });
      out.push({ name: 'classify: hit by copied code', at: 200, poke: labels[node.ns + 'mark'], ins: code, branch: `${node.ns}:2` });
    }
    if (node.id === 'restart') {
      const loop = labels[node.kids[0].ns + leaves[node.kids[0].id].loop];
      out.push({ name: 'restart: loop damaged', at: 200, poke: loop, restored: loop });
    }
    for (const k of node.kids ?? []) walk(k);
  };
  walk(root);
  return out;
}

function checkGeneric(built) {
  const { w, settings, root, labels, spans, total } = built;
  const core = settings.coreSize, norm = (x) => ((x % core) + core) % core, same = sameIns(core);
  const all = instances(root, labels, spans, settings).filter((x) => leaves[x.node.id].kind !== 'data');
  // Address arithmetic: plain numbers mod the core on the ring; through the geometry on a torus,
  // where code runs along a row. `rel(c, from)` is how many cells along the row c is from `from`
  // (or a large number when it isn't on that row).
  const geo = makeGeometry(settings);
  const add = geo ? (a, b) => geo.add(norm(a), norm(b)) : (a, b) => norm(a + b);
  const rel = geo ? (c, from) => {
    const [x, y, z] = geo.decode(geo.sub(norm(c), norm(from)));
    return y || z ? core : ((x % settings.sizeX) + settings.sizeX) % settings.sizeX;
  } : (c, from) => norm(c - from);
  const shifts = [...new Set([0, ...all.map((x) => x.shift)])];
  const limit = iface(root, settings);
  const caps = limit.provides;
  const horizon = limit.grows ? Math.min(settings.maxCycles, 20000) : settings.maxCycles;
  const alone = all.length === 1;
  const maxShift = Math.max(...shifts.map(norm));
  const bases = geo ? [0, geo.encode(geo.X - 7, Math.floor(geo.Y / 2), 0), geo.encode(-3, geo.Y - 1, (geo.Z || 1) - 1)]
    : [0, core - 7, ...(maxShift ? [norm(core - maxShift - Math.ceil(total / 2))] : [])];
  const observations = [];

  function run(base, scenario) {
    const vm = new VM(settings);
    vm.load([w], { positions: [base], ...(scenario.pspace ? { pspaces: [scenario.pspace] } : {}) });
    const watchedBy = new Map();
    const watched = all.map((x) => {
      const def = leaves[x.node.id], home = add(base, x.shift), at = (local, k = 0) => add(home, labels[x.node.ns + local] + k);
      const { start, size } = spans[x.node.ns];
      // Another copy of a planted block sees its own name, so only the planted one checks the reaction.
      // Copies under `copies` share a namespace: only the first of them is the planted one.
      const planted = scenario.plant && all.findIndex((y) => y.node.ns === scenario.plant) === all.indexOf(x);
      const name = scenario.plant && !planted && scenario.id === x.node.id ? `${scenario.name} (another copy)` : scenario.name;
      const api = {
        vm, P: x.node.P, settings, core, norm, same, at, scenario: name,
        total, maxLength: settings.maxLength, mayStop: !!x.mayStop,
        self: { start: add(home, start), size },                  // this copy's own cells
        image: { start: norm(base), size: total },                 // the whole warrior as loaded
        // A fresh round against a real opponent (Redcode text or a compiled warrior), loaded `offset` cells away.
        duel: (opponent, { offset = Math.floor(core / 2), cycles = settings.maxCycles } = {}) => {
          const them = typeof opponent === 'string' ? compile(opponent, 'redcode', { ...settings, maxLength: Math.max(settings.maxLength, 100) }) : opponent;
          if (!them.ok) throw new Error(`duel opponent does not compile: ${them.errors?.[0]?.message}`);
          const d = new VM(settings); d.load([w, them], { positions: [base, add(base, offset)] });
          while (!d.done && d.cycle < cycles) d.step();
          return { vm: d, cycles: d.cycle, ours: d.warriors[0].alive, theirs: d.warriors[1].alive };
        },
        alone: alone && scenario.name === 'alone',          // alone, and nothing planted
        code: (local, k = 0) => w.instructions[labels[x.node.ns + local] + k],
        entry: () => add(home, labels[entryOf(x.node)]),
        inImage: (c) => shifts.some((s) => rel(c, add(base, s)) < total),
        inSelf: (c) => rel(c, add(home, start)) < size,
        add, rel, geo,                                              // address arithmetic that works on a torus too
        // Every live process is inside this copy's own code: it's the only block still running.
        sole: () => vm.processes(0).every((q) => rel(q, add(home, start)) < size),
        entered: () => watchedBy.get(x)?.entered ?? false,          // has this copy run yet (a switch may never pick it)
        // The address of a capability another block provides (as seen from this block's tree).
        ref: (cap) => { const l = caps.get(cap); return l === undefined ? null : add(base, labels[l]); },
      };
      const v = { x, def, api, hooks: def.watch?.(api) ?? {}, entryAt: api.entry(), entered: false, enteredAt: null, checked: false };
      watchedBy.set(x, v);
      return v;
    });
    // Plants: [address, instruction] before the run, or [address, instruction, cycle] at that cycle.
    const later = [];
    if (scenario.plant) {
      const v = watched.find((u) => u.x.node.ns === scenario.plant);       // the first copy
      for (const [addr, ins, cycle] of v.def.plant(v.api)) if (cycle) later.push([cycle, norm(addr), ins]); else vm.poke(norm(addr), ins);
    }
    const byEntry = new Map();
    for (const v of watched) byEntry.set(v.entryAt, [...(byEntry.get(v.entryAt) ?? []), v]);
    while (!vm.done && vm.cycle < horizon) {
      if (scenario.poke !== undefined && vm.cycle === scenario.at) vm.poke(add(base, scenario.poke), scenario.ins ?? { op: 'DAT', mod: 'F', aMode: '#', a: 9, bMode: '#', b: 9 });
      for (const [cycle, addr, ins] of later) if (vm.cycle === cycle) vm.poke(addr, ins);
      const pc = vm.processes(0)[0];
      for (const v of byEntry.get(pc) ?? []) if (!v.entered) { v.entered = true; v.enteredAt = vm.cycle; }
      const tokens = watched.map((v) => v.hooks.before?.(pc) ?? null);
      vm.step();
      watched.forEach((v, i) => v.hooks.after?.(tokens[i]));
      // A block that runs forever must still be running 1,000 cycles after it was entered.
      for (const v of watched) {
        if (v.checked || !v.entered || vm.cycle !== v.enteredAt + 1000) continue;
        v.checked = true;
        if (v.def.exit === 'never' && !v.x.mayStop) {
          const running = v.def.running ? v.def.running(v.api) : vm.processes(0).some((q) => v.api.inSelf(q));
          if (!running) throw new Error(`${v.x.node.id} stopped running (${scenario.name})`);
        }
      }
    }
    if (!vm.warriors[0].alive || vm.cycle !== horizon) throw new Error(`The warrior did not survive alone (${scenario.name})`);
    if (scenario.restored !== undefined && !same(vm.peek(add(base, scenario.restored)), w.instructions[scenario.restored])) throw new Error('restart: the damaged loop was not restored');
    if (!limit.grows && vm.warriors[0].peak > limit.processes) throw new Error(`More processes than the blocks declare (${vm.warriors[0].peak} > ${limit.processes})`);
    for (const v of watched) {
      const { x } = v;
      const required = scenario.branch ? (x.branch ? x.branch === scenario.branch : !x.optional)
        : scenario.expect ? !x.optional || x.triggered === scenario.expect : !x.optional;
      if (required && !v.entered) throw new Error(`${x.node.id} was never entered (${scenario.name})`);
      if (scenario.branch && x.branch && x.branch !== scenario.branch && v.entered) throw new Error(`ran the wrong branch (${scenario.name})`);
      v.hooks.final?.();
    }
    return { base, scenario: scenario.name, cycles: vm.cycle, peak: vm.warriors[0].peak };
  }
  for (const scenario of scenarios(root, labels, settings)) {
    for (const base of scenario.name === 'alone' ? bases : [0]) observations.push(run(base, scenario));
  }
  return { ok: true, shape: 'generic', scope: 'every copy of every block watched with its own checks; three load positions; full solo rounds; combinator scenarios', observations };
}
