import {fanLines} from './fan-lines.js';
// Contract policies for algebra nodes. Each combinator owns its safety rules;
// shared validation and capability aggregation stay separate from code emission.
import { leaves } from './leaves.js';
import { makeGeometry } from '../../src/engine/geometry.js';
import { pSpaceSizeFor } from '../../src/engine/constants.js';
import { packedPlan, tableRows } from './switch-table.js';
import { scoreCells } from './switch-score.js';
// The linker's entry rule, for a shared payload's entry (a live binding: used only once both modules have loaded).
import { entryOf } from './link.js';
const value = (v, ...args) => typeof v === 'function' ? v(...args) : v;

export function initialContract(node, def) {
  const out = { processes: 0, grows: false, exit: 'never', writes: 'sparse', roams: false, relocatable: false,
    provides: new Map(), needs: new Set(), mismatches: [] };
  for (const [key, [lo, hi]] of Object.entries(def.params ?? {})) {
    const v = node.P?.[key];
    if (!Number.isSafeInteger(v) || v < lo || v > hi) out.mismatches.push(`${node.id}: ${key} must be an integer from ${lo} to ${hi}`);
  }
  return out;
}

export function leafContract(node, def, settings, out) {
  const validParameters = out.mismatches.length === 0;
  const old = settings.dialect === '88';
  const P = node.P;
  if (def.dialects === '94' && old) out.mismatches.push(`${node.id} needs ICWS'94`);
  const topo = settings.topology === 'torus' ? 'torus' : 'ring';
  if (!(def.topologies ?? ['ring']).includes(topo)) out.mismatches.push(`${node.id} is written for the ${topo === 'torus' ? 'ring' : 'torus'}`);
  if (validParameters) out.mismatches.push(...(def.mismatches?.(P, settings) ?? []));
  Object.assign(out, { processes: value(def.processes, P), grows: !!def.grows, exit: def.exit, writes: value(def.writes, P),
    roams: !!def.roams, relocatable: !!def.relocatable, link: def.link ?? 'fall' });
  for (const [cap, label] of Object.entries(value(def.provides, P) ?? {})) out.provides.set(cap, node.ns + label);
  for (const cap of value(def.needs, P) ?? []) out.needs.add(cap);
  return out;
}

// On the ring a hop must clear the warrior; a y/z hop on a torus changes row.
function landsOnSelf(node, settings, x = node.P.HOP, y = node.P.HOPY, z = node.P.HOPZ) {
  const torus = settings.topology === 'torus', core = settings.coreSize;
  if (!torus) return x % core < 256 || core - (x % core) < 256;
  const w = x % settings.sizeX;
  return !(y || z) && (w < settings.maxLength || settings.sizeX - w < settings.maxLength);
}

function requireEndless(node, kids, parts, out) {
  parts.forEach((p, i) => { if (p.exit !== 'never') out.mismatches.push(`${node.id}: ${kids[i].id} must run forever`); });
}

function protectPartners(node, kids, out) {
  const parallel = node.id === 'par';
  // A leaf may declare protects: 'siblings' (or a function of P): its clear spares the other copies,
  // so `apart` and `copies` may run it (lp-selfhit-scanner with SECTOR tiles the core between them).
  const spares = (k) => leaves[k.id] && value(leaves[k.id].protects, k.P) === 'siblings';
  if (!parallel && kids.length && kids.every(spares)) return;
  if (out.writes === 'core') out.mismatches.push(`${node.id}: a clear erases ${parallel ? 'its partners' : 'the other copies'}, so a clear runs alone`);
  for (const k of kids) if (leaves[k.id]?.attacks === 'all') out.mismatches.push(`${node.id}: ${k.id} attacks every cell but its own, ${parallel ? 'partners' : 'the other copies'} included`);
}

function checkSequence({ parts, out, kids }) {
  parts.forEach((p, i) => {
    if (i < parts.length - 1 && p.exit !== 'next') out.mismatches.push(`seq: ${kids[i].id} never hands on, so nothing after it runs`);
    if (i === parts.length - 1 && p.exit !== 'never' && p.exit !== 'next') out.mismatches.push(`seq: the last member (${kids[i].id}) must run forever, or hand on`);
  });
  if (parts.at(-1)?.exit === 'next') Object.assign(out, {exit:'next',link:parts.at(-1).link});
  out.processes = Math.max(0, ...parts.map((p) => p.processes));
  for (const c of [...out.needs]) if (out.provides.has(c)) out.needs.delete(c);   // met inside the seq
}

function checkParallel({ node, parts, out, kids }) {
  requireEndless(node, kids, parts, out);
  if (kids.filter((k) => leaves[k.id]?.layout === 'last').length > 1) out.mismatches.push('par: only one member may write just ahead of itself (each must be laid out last)');
  protectPartners(node, kids, out);
  out.processes = parts.reduce((n, p) => n + p.processes, 0);
}

function checkRelocation({ node, settings, parts, out, kids }) {
  if (parts[0] && !parts[0].relocatable) out.mismatches.push(`relocate: ${kids[0].id} reads state in the image, so it cannot be relocated`);
  if (leaves[kids[0]?.id]?.entryFirst === false) out.mismatches.push(`relocate: ${kids[0].id} doesn't start at its first cell`);
  if (landsOnSelf(node, settings)) out.mismatches.push('HOP lands on the warrior itself');
  out.processes = parts[0]?.processes ?? 0;
  out.needs.add('probe');
}

export const payloadCaps = (k) => (k === 1 ? ['payload', 'payloadEnd', 'payloadEntry'] : [`payload${k}`, `payload${k}End`, `payload${k}Entry`]);
function checkBoot({ node, settings, parts, out, kids }) {
  if (parts[0] && parts[0].exit !== 'never') out.mismatches.push('boot: its first member must run forever');
  if (parts[1] && parts[1].exit !== 'data') out.mismatches.push('boot: its second member stays behind, so it must be data');
  const hasRelocate = (n) => n.id === 'relocate' || (n.kids ?? []).some(hasRelocate);
  if (kids[0] && hasRelocate(kids[0])) out.mismatches.push('one relocation per warrior: relocate or boot');
  if (landsOnSelf(node, settings)) out.mismatches.push('HOP lands on the warrior itself');
  if (node.P.EARLY && settings.dialect === '88') out.mismatches.push("boot: EARLY needs ICWS'94 (it copies forward with a postincrement)");
  if (node.P.EARLY && settings.topology === 'torus') out.mismatches.push('boot: EARLY is ring-only');
  if (node.P.DIRECT && (node.P.WIPE || node.P.EARLY || settings.topology === 'torus')) out.mismatches.push('boot: DIRECT is ring-only and cannot use WIPE or EARLY');
  out.processes = (parts[0]?.processes ?? 0) + (node.P.WIPE || node.P.EARLY ? 1 : 0);
  // SHARE k: the payload's cells, for a redeploy (FROM k) in another switch member. Payload 1's
  // capabilities are payload, payloadEnd and payloadEntry; payload k's carry the number (payload2, ...).
  if (node.P.SHARE) {
    if (settings.topology === 'torus') out.mismatches.push('boot: SHARE is ring-only');
    const [p, e, n] = payloadCaps(node.P.SHARE);
    out.provides.set(p, node.ns + 'payload').set(e, node.ns + 'payloadEnd');
    if (kids[0]) out.provides.set(n, entryOf(kids[0]));
  }
}

function checkTrigger({ node, parts, out, kids }) {
  const a = kids[0], A = leaves[a?.id];
  if (!A?.loop) out.mismatches.push(`trigger: ${a?.id} has no loop for the watcher to rewrite`);
  if (A?.moves) out.mismatches.push(`trigger: ${a.id} moves itself away, so the watcher would lose it`);
  requireEndless(node, kids, parts, out);
  if ((parts[0]?.processes ?? 0) > 1 && leaves[kids[1]?.id]?.kind === 'finisher') out.mismatches.push(`trigger: ${kids[1].id} is a one-process clear; it can't take over ${kids[0].id}'s processes`);
  // After a watchdog fires, a's redirected process and the watcher may both enter b.
  out.processes = Math.max((parts[0]?.processes ?? 0) + 1, (parts[1]?.processes ?? 0) * (node.P.MODE === 2 ? 2 : 1));
}

function checkCopies({ node, settings, parts, out, kids, torus, core }) {
  requireEndless(node, kids, parts, out);
  protectPartners(node, kids, out);
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
}

function checkSwitch({ node, settings, old, parts, out, kids }) {
  if (!settings.pSpace) out.mismatches.push('switch needs P-space (the 94x hill)');
  if (old) out.mismatches.push("switch needs ICWS'94 (LDP and STP)");
  if (node.P.CELL + (node.P.POLICY === 1 ? 1 : 0) >= pSpaceSizeFor(settings)) {
    out.mismatches.push('switch: private cells exceed the P-space size');
  }
  requireEndless(node, kids, parts, out);
  out.processes = Math.max(0, ...parts.map((p) => p.processes));
}

function checkSwitchTable(ctx) {
  checkSwitch(ctx);
  const { node, kids, out } = ctx;
  if (ctx.torus) out.mismatches.push('switch-table needs a ring');
  if (node.P.PACKED && !packedPlan(node.P, ctx.core)) {
    out.mismatches.push('switch-table: packed residue range exceeds the core');
  }
  if (tableRows(node.P).some(row => row.branch >= kids.length)) {
    out.mismatches.push('switch-table: a row selects a missing payload');
  }
}

function checkSwitchScore({ node, settings, old, parts, out, kids, torus }) {
  if (!settings.pSpace) out.mismatches.push('switch-score needs P-space');
  if (old) out.mismatches.push("switch-score needs ICWS'94 (LDP and STP)");
  if (torus) out.mismatches.push('switch-score needs a ring');
  if (node.P.FIRST >= kids.length) out.mismatches.push('switch-score: FIRST selects a missing member');
  if (scoreCells(node.P, kids.length).top >= pSpaceSizeFor(settings)) out.mismatches.push('switch-score: private cells exceed the P-space size');
  requireEndless(node, kids, parts, out);
  out.processes = Math.max(0, ...parts.map((p) => p.processes));
}

function checkRestart({ parts, out, kids }) {
  const x = kids[0], X = leaves[x?.id];
  if (!X?.loop) out.mismatches.push(`restart: ${x?.id} has no loop to watch`);
  if (X?.moves) out.mismatches.push(`restart: ${x.id} moves itself away, so a restored copy wouldn't help`);
  if (parts[0] && parts[0].exit !== 'never') out.mismatches.push(`restart: ${x.id} must run forever`);
  if (parts[0]?.roams) out.mismatches.push(`restart: ${x.id} moves away from its code, so a restored copy wouldn't help`);
  out.processes = 2 * (parts[0]?.processes ?? 0) + 1;     // a restart may join a process that survived
}

function checkParallelBoot({ node, settings, parts, out, kids, torus, core }) {
  const x = kids[0], X = leaves[x?.id], P = node.P;
  if (parts[0] && parts[0].exit !== 'never') out.mismatches.push(`parboot: ${x.id} must run forever`);
  if (landsOnSelf(node, settings)) out.mismatches.push('HOP lands on the warrior itself');
  if (P.REACT) {
    if (P.K < 2) out.mismatches.push('parboot: REACT needs K of 2 or more (the loops that lose the race watch the copy)');
    if (!X?.loop) out.mismatches.push(`parboot: ${x?.id} has no loop for the watchers to check`);
    if (X?.moves) out.mismatches.push(`parboot: ${x.id} moves itself away, so the watchers would lose it`);
    if (landsOnSelf(node, settings, P.HOP2, P.HOP2Y, P.HOP2Z)) out.mismatches.push('HOP2 lands on the warrior itself');
    if (!torus && Math.min((P.HOP2 - P.HOP + 2 * core) % core, (P.HOP - P.HOP2 + 2 * core) % core) < 256) out.mismatches.push('parboot: the new copy would land on the first');
    if (torus && P.HOP2Y === P.HOPY && P.HOP2Z === P.HOPZ && Math.abs((P.HOP2 - P.HOP) % settings.sizeX) < settings.maxLength) out.mismatches.push('parboot: the new copy would land on the first');
  }
  // The copy, the original (STAY), the new copy (REACT), and every loop's process until it stops.
  out.processes = (parts[0]?.processes ?? 0) * (1 + P.STAY + (P.REACT ? 1 : 0)) + P.K;
}

function checkClassifier({ node, settings, torus, old, parts, out, kids }) {
  const a = kids[0], A = leaves[a?.id];
  if (!A?.loop) out.mismatches.push(`classify: ${a?.id} has no loop for the watcher to rewrite`);
  if (A?.moves) out.mismatches.push(`classify: ${a.id} moves itself away, so the watcher would lose it`);
  if (old) out.mismatches.push("classify needs ICWS'94 (JMZ.F)");
  if (torus) out.mismatches.push('classify: remote tripwires are ring-only');
  requireEndless(node, kids, parts, out);
  const {MARKS,DIST,SPREAD}=node.P, room=settings.maxLength;
  if (DIST < room) out.mismatches.push('classify: the tripwire region starts inside the warrior');
  if (DIST + MARKS * SPREAD > settings.coreSize - room) out.mismatches.push('classify: the tripwire region runs on into the warrior');
  out.processes = Math.max((parts[0]?.processes ?? 0) + 1, parts[1]?.processes ?? 0, parts[2]?.processes ?? 0);
}

function checkImage({ parts, out, kids }) {
  if (parts[0] && parts[0].exit !== 'never') out.mismatches.push('image: its first member must run forever');
  parts.slice(1).forEach((p, i) => { if (p.exit !== 'data') out.mismatches.push(`image: ${kids[i + 1].id} is laid out after the code, so it must be data`); });
  out.processes = parts[0]?.processes ?? 0;
}


function checkFork({node,settings,parts,out,kids,old,torus,core}) {
const [o, a, b] = parts;
      if (o && o.exit !== 'next') out.mismatches.push(`fork: ${kids[0].id} must hand on (an opening)`);
      if (o && !o.provides.has('probe')) out.mismatches.push(`fork: ${kids[0].id} provides no probe to decide by`);
      if (node.P.BY && o && !o.provides.has('verdict')) out.mismatches.push(`fork: BY 1 needs a verdict, and ${kids[0].id} provides none (put probe-verdict after the opening)`);
      [a, b].forEach((p, i) => { if (p && p.exit !== 'never') out.mismatches.push(`fork: ${kids[i + 1].id} must run forever`); });
      out.processes = Math.max(0, ...parts.map((p) => p.processes));
      for (const c of [...out.needs]) if (out.provides.has(c)) out.needs.delete(c);   // the opening's probe meets the bodies' needs
}

function checkFanBoot({node,settings,parts,out,kids,old,torus,core}) {
const P = node.P;
      if(P.PATH&&(!P.SPLIT||!P.MOREA||P.CHECK||kids.some(k=>!leaves[k.id]||leaves[k.id].entryFirst===false)))out.mismatches.push('fanboot: separate PATH requires two entry-first leaf bodies, SPLIT1/MOREA1 and no CHECK');
      if (P.CHECK) {
        out.needs.add('probe');
        const cold = leaves[kids[0].id]?.coldStart;
        if (!cold?.entry || !cold.feeder || !cold.gate) out.mismatches.push('fanboot: CHECK needs a cold-clear contract in its first member');
      }
      if (old) out.mismatches.push("fanboot needs ICWS'94 (A-field pointers)");
      if (torus) out.mismatches.push('fanboot is ring-only');
      if (!fanLines(P.N)) out.mismatches.push('fanboot: N must be 2, 3, 4, 6, 8, 12 or 16');
      if (P.MOREA && !P.SPLIT) out.mismatches.push('fanboot: MOREA requires SPLIT 1');
      parts.forEach((p, i) => { if (p.exit !== 'never') out.mismatches.push(`fanboot: ${kids[i].id} must run forever`); });
      const hasRelocate = (n) => n.id === 'relocate' || n.id === 'boot' || n.id === 'parboot' || n.id === 'fanboot' || (n.kids ?? []).some(hasRelocate);
      if (kids.some(hasRelocate)) out.mismatches.push('one relocation per warrior: fanboot moves both members');
      if (!torus && !P.EXACT) {
        if (landsOnSelf(node,settings,P.HOPA)) out.mismatches.push('HOPA lands on the warrior itself');
        if (landsOnSelf(node,settings,P.HOPB)) out.mismatches.push('HOPB lands on the warrior itself');
        if (Math.min((P.HOPA - P.HOPB + 2 * core) % core, (P.HOPB - P.HOPA + 2 * core) % core) < 256) out.mismatches.push('fanboot: the two copies would land on each other');
      }
      const [a, b] = [parts[0]?.processes ?? 0, parts[1]?.processes ?? 0];
      out.processes = Math.max(P.N, P.SPLIT ? (P.N - 1 + (P.MOREA || 0)) * a + b : P.K * P.N * a + P.N * b);
}
function checkFanBoot3({node,settings,parts,out,kids,old,torus}){
 if(node.P.PATH)out.mismatches.push('fanboot3 does not support separate PATH');
 if(node.P.SPLIT!==1||node.P.K!==1||node.P.CHECK)out.mismatches.push('fanboot3 uses fixed SPLIT1/K1 routing without CHECK');
 if(old)out.mismatches.push("fanboot3 needs ICWS'94");if(torus)out.mismatches.push('fanboot3 is ring-only');
 if(!fanLines(node.P.N))out.mismatches.push('fanboot3: N must be 2, 3, 4, 6, 8, 12 or 16');
 if(kids.some(k=>!leaves[k.id]))out.mismatches.push('fanboot3 currently accepts three leaf bodies only');
 requireEndless(node,kids,parts,out);
 // ROUTE 1 sends N workers into the first and third members and one into the second.
 if(node.P.ROUTE===1){
  out.processes=Math.max(node.P.N,node.P.N*(parts[0]?.processes??0)+(parts[1]?.processes??0)+node.P.N*(parts[2]?.processes??0));
  return;
 }
 out.processes=Math.max(node.P.N,(node.P.N-1+node.P.MOREA)*(parts[0]?.processes??0)+(parts[1]?.processes??0)+(parts[2]?.processes??0));
}

const checks = {
  fanboot3:checkFanBoot3,
  fork: checkFork, fanboot: checkFanBoot, seq: checkSequence, par: checkParallel, relocate: checkRelocation, boot: checkBoot,
  trigger: checkTrigger, apart: checkCopies, copies: checkCopies, switch: checkSwitch, 'switch-table': checkSwitchTable, 'switch-score': checkSwitchScore,
  restart: checkRestart, parboot: checkParallelBoot, classify: checkClassifier, image: checkImage,
};

export function combinatorContract(node, settings, parts, out) {
  const kids = node.kids ?? [], old = settings.dialect === '88', core = settings.coreSize;
  for (const p of parts) out.mismatches.push(...p.mismatches);
  out.grows = parts.some((p) => p.grows);
  out.roams = parts.some((p) => p.roams);
  out.writes = parts.some((p) => p.writes === 'core') ? 'core' : 'sparse';
  for (const p of parts) { for (const [c, l] of p.provides) if (!out.provides.has(c)) out.provides.set(c, l); for (const c of p.needs) out.needs.add(c); }
  const torus = settings.topology === 'torus';
  if (!torus && (node.P?.HOPY || node.P?.HOPZ || node.P?.DY || node.P?.DZ || node.P?.HOP2Y || node.P?.HOP2Z)) out.mismatches.push(`${node.id}: y and z parts only mean something on a torus`);
  checks[node.id]({ node, settings, parts, out, kids, old, core, torus });
  // A boot with SHARE 1 in one switch member provides the payload a redeploy in another needs.
  if (['switch', 'switch-table', 'switch-score'].includes(node.id)) {
    for (const c of [...out.needs]) if (/^payload/.test(c) && out.provides.has(c)) out.needs.delete(c);
    // Each shared payload number names one boot.
    const shared = [], walk = (n) => { if (n.id === 'boot' && n.P?.SHARE) shared.push(n.P.SHARE); (n.kids ?? []).forEach(walk); };
    kids.forEach(walk);
    for (const k of new Set(shared)) if (shared.filter((x) => x === k).length > 1) out.mismatches.push(`${node.id}: two boots share their payload as SHARE ${k}; give each its own number`);
  }
  if (node.id === 'image' || node.id === 'boot') out.exit = parts[0]?.exit ?? 'never';
  if (['trigger', 'apart', 'copies', 'switch', 'switch-score', 'restart', 'classify', 'parboot', 'fanboot','fanboot3'].includes(node.id) && !out.mismatches.length) out.exit = 'never';
  return out;
}

