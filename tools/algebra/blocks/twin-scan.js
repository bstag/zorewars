// Twin scan: a .8c pair scanner (two pairs of cells GAP apart compared per
// five-instruction loop, one shared hit branch) that drops a short SPL wipe on
// each find and scans on, then after TIME/100 laps of its lattice turns its
// wipe loop into a self-restarting DAT clear (docs/block-algebra-catalog.md).
// Written from scratch for ModelWar's 25,200-cell core after an ablation study
// of the hill's P-space switchers, whose small fast pair-scanning arm beats
// ModelWar entries that bigger, slower scanners lose to; no hill code was
// copied. Every number is a share of the core, so one tree builds on any core.
//
//   cp    DAT  BA, clr      the wipe's and the clear's pointer; the LOWEST cell, GAP+UP under scan
//   st    SPL  #S, S        the step, and the stun bomb
//   cb    DAT  BA, clr      the clear's bomb: the same as cp's start
//         (GAP+UP-7 empty cells; with less room, an ADD in the hit branch instead)
//   wipe  MOV  st, >cp      2W cells upward
//         MOV  st, >cp
//   c     DJN  wipe, #0     falls into the scan
//   loop  ADD.F st, scan
//   scan  SNE  A, A-GAP     pair 1 (A the high probe, A-GAP the low one)
//         ADD.F st, scan    (skipped on a find, so pair 1 is looked at again below)
//         SEQ  *scan, @scan pair 2
//         SLT.A #own, scan  a find above the warrior? (else it is our own code)
//   timer DJN  loop, #T     no find: on, for T loops
//         JMZ.B clr, timer  the timer ran out: the clear
//         SLT.AB scan, #hi  a find just under us, whose wipe would wrap onto cp?
//         JMP  loop         ...ignore it
//         MOV.AB scan, cp   cp + A = the low probe less UP
//         MOV.AB #W, c
//         JMP  wipe
//   clr   MOV  cb, st       the clear: the wipe loop writes DAT from wherever cp points,
//         MOV.AB #0, c      for as long as the count takes to come round,
//         JMP  wipe
//
// The clear's pointer is cp, the lowest cell: going upward, it comes round onto
// cp before anything else of ours, and the bomb it writes there (cb, equal to
// cp's start) restarts it from past the warrior (CLR 1) or past the block (CLR
// 0), so it never runs over its own loop. Small matters: the same scanner
// padded from 15 to 25 cells lost a fifth of its wins against a decoy-heavy
// ModelWar scanner/paper.

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const mod = (x, n) => ((x % n) + n) % n;

// The factor the step shares with the core: the largest divisor of the core from 2 to G.
export function twinFactor(G, core) {
  for (let g = Math.max(2, G); g >= 2; g--) if (core % g === 0) return g;
  return 1;
}
// The step: a multiple of the factor near STEPF/10000 of the core, sharing nothing else with it.
export function twinStep(P, core) {
  const g = twinFactor(P.G, core), want = Math.round((core * P.STEPF) / 10000 / g);
  for (let d = 0; d < core / g; d++) {
    for (const k of [want + d, want - d]) {
      const s = k * g;
      if (s > 0 && s < core && gcd(s, core) === g) return s;
    }
  }
  return g;
}
// The high probe's start, near STARTF/10000 of the core.
export const twinStart = (P, core) => Math.max(P.GAP + 1, Math.round((core * P.STARTF) / 10000));
// The (step, start) pairs VARY rotates through: STEPF/STARTF first, then STEPF2/STARTF2, ...
export function twinEntries(P, core) {
  const out = [];
  for (let k = 1; k <= Math.max(1, P.VARY); k++) {
    const q = k === 1 ? P : { ...P, STEPF: P[`STEPF${k}`], STARTF: P[`STARTF${k}`] };
    out.push([twinStep(q, core), twinStart(q, core)]);
  }
  return out;
}
// TIME/100 laps of the lattice (core/g probes, two a loop).
export const twinLoops = (P, core) => Math.max(2, Math.round((P.TIME / 100) * (core / twinFactor(P.G, core)) / 2));
// Cells under scan: cp, st, cb, the wipe (3), the pads, loop.
const pads = (P) => Math.max(0, P.GAP + P.UP - 7);
const below = (P) => 7 + pads(P);

// DEAD d: the block runs d cells from where it was loaded (a boot's HOP), so the warrior as
// loaded lies d cells under it, dead once the boot has gone. A high probe in that image
// (or the low one, GAP under it) is ignored; the window is sized for the longest image.
function deadWindow(P, core, length, scanIdx = 0, total = length) {
  const start = mod(-P.DEAD - scanIdx, core);
  return { lo: start - 1, hi: start + total + P.GAP };
}

function twinMismatches(P, settings) {
  const core = settings.coreSize, out = [];
  if (settings.topology === 'torus') return ['twin-scan: written for the ring'];
  if (twinFactor(P.G, core) < 2) out.push(`twin-scan: the ${core}-cell core has no factor from 2 to ${P.G} for the step to share`);
  if (P.VARY > 1 && !settings.pSpace) out.push('twin-scan: VARY counts rounds in P-space, which this hill does not have');
  if (P.DEAD) {
    const w = deadWindow(P, settings.coreSize, settings.maxLength);
    if (w.lo < 0 || w.hi >= settings.coreSize) out.push('twin-scan: the dead image window wraps the core');
  }
  if (2 * P.WIPE < P.GAP + P.UP + 1) out.push(`twin-scan: the wipe (${2 * P.WIPE} cells from UP under the low probe) does not reach the high probe: raise WIPE or lower GAP or UP`);
  return out;
}

const twinScan = {
  id: 'twin-scan', kind: 'body', exit: 'never', writes: 'core', attacks: 'all', roams: false, dialects: '94',
  processes: 1, grows: false,
  purpose: 'A small .8c pair scanner: two pairs of cells GAP apart compared per five-instruction loop on a step sharing a factor G with the core; each find gets 2*WIPE SPL cells from UP under the low probe upward, and the scan goes on; after TIME/100 laps the same wipe loop becomes a DAT clear that restarts itself when it comes round onto its lowest cell. Numbers are shares of the core, so it builds on any core; written for ModelWar, where booted away with a decoy left behind it beats the Decoy Adapter scanner/paper.',
  params: { G: [2, 16], STEPF: [1, 9999], STARTF: [1, 9999], GAP: [1, 16], WIPE: [1, 16], UP: [0, 8], TIME: [10, 2000], BA: [0, 3], CLR: [0, 1],
    VARY: [0, 4], VCELL: [1, 1500], STEPF2: [1, 9999], STARTF2: [1, 9999], STEPF3: [1, 9999], STARTF3: [1, 9999], STEPF4: [1, 9999], STARTF4: [1, 9999], DEAD: [0, 200000] },
  defaults: { G: 4, STEPF: 884, STARTF: 1768, GAP: 6, WIPE: 7, UP: 2, TIME: 360, BA: 0, CLR: 1,
    VARY: 0, VCELL: 44, STEPF2: 1500, STARTF2: 3100, STEPF3: 2900, STARTF3: 5300, STEPF4: 4100, STARTF4: 7700, DEAD: 0 },
  entry: (P) => (P.VARY > 1 ? 'pick' : 'loop'), entryFirst: false, loop: 'loop',
  protects: (P) => (P.CLR ? 'image' : 'self'),
  provides: { splBomb: 'st', datBomb: 'cb' },
  mutable: (P) => [['cp', ['a', 'b']], ['st', ['op', 'mod', 'aMode', 'a', 'bMode', 'b']], ['scan', ['a', 'b']], ['timer', ['b']], ['c', ['b']], ...(P.VARY > 1 ? [['vk', ['b']]] : []), ...Array.from({ length: pads(P) }, (_, k) => [`pad${k}`, ['op', 'mod', 'aMode', 'a', 'bMode', 'b']])],
  mismatches: twinMismatches,
  // Its wipes and clear skip only what lies above cp, so nothing that still runs may lie under it
  // (`attacks: 'all'`), as for sweep.
  emit(ctx) {
    const { L, P, core, total } = ctx, idx = ctx.pc();
    const W = P.WIPE, S = twinStep(P, core), A0 = twinStart(P, core), k = P.GAP + P.UP;
    const cp0 = idx + (P.VARY > 1 ? 10 + 2 * P.VARY : 0);     // cp's index: the picker comes first
    const rest = Math.max(total - cp0, 1);                    // the first cell past the warrior, from cp
    const clr = P.CLR ? `${rest}` : `${L('last')}+1-${L('cp')}`;
    const own = `${rest}-${below(P)}+${k}`;                   // a high probe up to here may be us
    const hi = core - 2 * W - below(P) - 2;                   // above this, the wipe could wrap onto cp
    const scan = L('scan');
    if (P.VARY > 1) {
      // A different step each round, as sweep's VARY: a round counter in P-space cell VCELL
      // picks entry (count mod VARY), copied over st and scan before the scan begins; the
      // first round plays STEPF/STARTF. It sits under cp, so a copy-ahead boot (EARLY 1),
      // which copies through the member's loop before launching it, has it all in place;
      // the clear passes over it (dead by then) on its way round to cp.
      const n = P.VARY, entries = twinEntries(P, core);
      ctx.ins('pick', 'LDP', 'AB', `#${P.VCELL}`, L('vk'));
      ctx.ins('', 'MOD', 'AB', `#${n}`, L('vk'));
      ctx.ins('', 'ADD', 'AB', '#1', L('vk'));
      ctx.ins('', 'STP', 'B', L('vk'), `#${P.VCELL}`);
      ctx.ins('', 'ADD', 'AB', `#${L('tst0')}-${L('vk')}-1`, L('vk'));
      ctx.ins('', 'MOV', 'I', `@${L('vk')}`, L('st'));
      ctx.ins('', 'ADD', 'AB', `#${n}`, L('vk'));
      ctx.ins('', 'MOV', 'I', `@${L('vk')}`, scan);
      ctx.ins('', 'JMP', 'B', L('loop'));
      ctx.ins('vk', 'DAT', 'F', '$0', '$0');
      entries.forEach(([St], j) => ctx.ins(`tst${j}`, 'SPL', 'B', `#${St}`, `$${St}`));
      entries.forEach(([St, a0]) => ctx.ins('', 'SNE', 'I', `$${mod(a0 - St, core)}`, `$${mod(a0 - St - P.GAP, core)}`));
    }
    ctx.ins('cp', 'DAT', 'F', `$${P.BA}`, `$${clr}`);
    ctx.ins('st', 'SPL', 'B', `#${S}`, `$${S}`);
    ctx.ins('cb', 'DAT', 'F', `$${P.BA}`, `$${clr}`);
    for (let j = 0; j < pads(P); j++) ctx.ins(`pad${j}`, 'DAT', 'F', '$0', '$0');
    ctx.ins('wipe', 'MOV', 'I', L('st'), `>${L('cp')}`);
    ctx.ins('', 'MOV', 'I', L('st'), `>${L('cp')}`);
    ctx.ins('c', 'DJN', 'B', L('wipe'), '#0');
    ctx.ins('loop', 'ADD', 'F', L('st'), scan);
    ctx.ins('scan', 'SNE', 'I', `$${mod(A0 - S, core)}`, `$${mod(A0 - S - P.GAP, core)}`);
    ctx.ins('', 'ADD', 'F', L('st'), scan);
    ctx.ins('', 'SEQ', 'I', `*${scan}`, `@${scan}`);
    ctx.ins('', 'SLT', 'A', `#${own}`, scan);
    ctx.ins('timer', 'DJN', 'B', L('loop'), `#${twinLoops(P, core)}`);
    ctx.ins('', 'JMZ', 'B', L('clr'), L('timer'));
    ctx.ins('', 'SLT', 'AB', scan, `#${hi}`);
    ctx.ins('', 'JMP', 'B', L('loop'));
    if (P.DEAD) {
      // A find in our own dead image (the warrior as loaded, DEAD cells under us) is ignored.
      const w = deadWindow(P, core, total, cp0 + below(P), total);
      ctx.ins('', 'SLT', 'A', `#${w.lo}`, scan);
      ctx.ins('', 'JMP', 'B', L('go'));
      ctx.ins('', 'SLT', 'A', `#${w.hi}`, scan);
      ctx.ins('', 'JMP', 'B', L('loop'));
    }
    ctx.ins(P.DEAD ? 'go' : '', 'MOV', 'AB', scan, L('cp'));
    // With fewer than 7 cells' room under scan, cp is too close: move the pointer down the rest.
    if (k < 7) ctx.ins('', 'ADD', 'AB', `#${7 - k}`, L('cp'));
    ctx.ins('', 'MOV', 'AB', `#${W}`, L('c'));
    ctx.ins('', 'JMP', 'B', L('wipe'));
    ctx.ins('clr', 'MOV', 'I', L('cb'), L('st'));
    ctx.ins('', 'MOV', 'AB', '#0', L('c'));
    ctx.ins('last', 'JMP', 'B', L('wipe'));
  },
  plant(api) {
    // Something on the high probe's path, a few loops out, clear of the image.
    const { P, core } = api, scan = api.at('scan'), S = twinStep(P, core);
    let a = mod(twinStart(P, core) - S, core);
    for (let k = 1; k < 400; k++) {
      a = mod(a + S, core);
      const c = api.norm(scan + a);
      let free = true;
      for (let j = -40; j <= 40 && free; j++) if (api.inImage(api.norm(c + j))) free = false;
      if (free && k > 6) return [[c, { op: 'MOV', mod: 'I', aMode: '$', a: 0, bMode: '$', b: 1 }]];
    }
    return [];
  },
  watch(api) {
    const { vm, P } = api;
    const planted = api.scenario === 'twin-scan: planted target';
    const target = planted ? (twinScan.plant(api)[0] ?? [null])[0] : null;
    const clr = api.at('clr');
    let cleared = null, stunned = false;
    return {
      before(pc) {
        if (cleared === null && pc === clr && api.same(vm.peek(pc), api.code('clr'))) cleared = vm.cycle;
        return null;
      },
      after() {
        if (planted && !stunned && target !== null) {
          const reach = 2 * P.WIPE + P.GAP + P.UP;
          for (let j = -reach; j <= reach && !stunned; j++) if (api.same(vm.peek(api.norm(target + j)), api.code('st'))) stunned = true;
        }
      },
      final() {
        if (!api.entered()) return;
        if (planted && target !== null && !stunned) throw new Error('twin-scan: did not wipe around the planted target');
        if (!api.alone) return;
        for (const l of ['wipe', 'loop', 'clr', 'cb']) if (!api.same(vm.peek(api.at(l)), api.code(l))) throw new Error(`twin-scan: its own ${l} was overwritten`);
        if (cleared === null && vm.cycle > 6 * twinLoops(P, api.core) + 2 * api.core) throw new Error('twin-scan: never started its clear');
      },
    };
  },
};

export default [twinScan];
