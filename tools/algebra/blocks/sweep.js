// Sweep: a two-pair continuous scanner that stuns what it finds with SPL, then
// a self-restarting clear (docs/block-algebra-catalog.md). Written from
// scratch for ModelWar's 25,200-cell core, from an ablation study of what makes
// a fast continuous scanner beat a silk-and-imp paper (Nemesis); no hill code
// was copied. Every number is given as a share of the core, so one tree builds
// on any core size.
//
//   cp    DAT  BA, clr      the clear's pointers (A backward, B forward); the LOWEST cell
//   trip  DAT  0, 0         the tripwire: non-zero after a wipe starts the clear (TRIP)
//   one   DAT  1, 1         the cell under the probes: the end of a lap finds it
//   p     DAT  #s-GAP, #s   the probes, GAP apart (A low, B high)
//         (UP-2 empty cells)
//   loop  ADD.F st, p       two pairs per loop
//         SEQ  *p, @p
//         JMP  hit
//         ADD.F st, p
//         SEQ  *p, @p
//         JMP  hit
//   lap   DJN  loop, #LAPS  the timer: LAPS loops (finds count too), then the clear
//         JMP  clr
//   hit   SLT.AB #own+2W, p  our own cells (everything above p, to the image's end)?
//         JMP  lap
//         MOV.AB #W, c
//         ADD.AB #UP, p      the wipe starts UP-1 cells above the high probe...
//   wipe  MOV  st, <p        ...and lays 2W SPL cells downward
//         MOV  st, <p
//   c     DJN  wipe, #0
//         ADD.AB #2W-UP, p
//         JMZ  lap, trip     (TRIP 1, 2) the tripwire
//   idle  DJN  idle, lap     (TRIP 2) run the timer out without scanning
//   clr   SPL  #0, 0         a stream of processes, all running the clear:
//   cl    MOV  cb, >cp       forward DAT
//         DJN.F cl, {cp      backward: decrement both fields of every cell
//         JMP  cl
//   st    SPL  #STEP, STEP   the step, and the stun bomb
//   cb    DAT  BA, clr       the clear's bomb: the same as cp's start
//
// The step shares a factor G with the core, so the scan visits every G-th cell
// and comes back to itself after core/G probes. Probes start one cell below a
// multiple of G from p, so the lap's last probe lands on `one`; its wipe then
// runs over p itself (the B-field becomes the bomb's), and the scan, with both
// probes now on one cell, finds nothing more until the timer starts the clear.
// That accident of layout measured far better than a clean tripwire that
// starts the clear at once (49 wins in 100 against Nemesis on 25,200 cells,
// against 8): one lap of stunning, then a pause, then the clear.
//
// The clear's forward pointer comes round from below and overwrites cp before
// anything else of the block; cb equals cp's start, so the clear starts again
// from just past the block, and it never reaches its own loop however many
// processes run it. Moving cp up next to the loop cost the same 49 wins: keep
// it lowest. With CLR 0 the clear starts just past the block and runs over
// the rest of the image (as mode 2 of a switch, the other branches are dead
// and an opponent's copies inside them get cleared); with CLR 1 it starts past
// the image and spares it.

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const mod = (x, n) => ((x % n) + n) % n;
const EVERY = ['op', 'mod', 'aMode', 'a', 'bMode', 'b'];

// The factor the step shares with the core: the largest divisor of the core from 2 to G.
export function sweepFactor(G, core) {
  for (let g = Math.max(2, G); g >= 2; g--) if (core % g === 0) return g;
  return 1;
}
// The step: a multiple of the factor near STEPF/10000 of the core, sharing nothing else with it.
export function sweepStep(P, core) {
  const g = sweepFactor(P.G, core), want = Math.round((core * P.STEPF) / 10000 / g);
  for (let d = 0; d < core / g; d++) {
    for (const k of [want + d, want - d]) {
      const s = k * g;
      if (s > 0 && s < core && gcd(s, core) === g) return s;
    }
  }
  return g;
}
// Where the probes start: near STARTF/10000 of the core, one below a multiple of the factor.
export function sweepStart(P, core) {
  const g = sweepFactor(P.G, core), s = Math.max(g, Math.round((core * P.STARTF) / 10000));
  return s - mod(s + 1, g);
}
// LAPF percent of half the core: how many loops before the clear.
export const sweepLaps = (P, core) => Math.max(2, Math.round((core * P.LAPF) / 200));
const pads = (P) => Math.max(0, P.UP - 2);

function sweepMismatches(P, settings) {
  const core = settings.coreSize, out = [];
  if (settings.topology === 'torus') out.push('sweep: written for the ring');
  const g = sweepFactor(P.G, core);
  if (g < 2) out.push(`sweep: the ${core}-cell core has no factor from 2 to ${P.G} for the step to share`);
  if (g > P.GAP + 2 * P.WIPE) out.push(`sweep: the scan visits every ${g}th cell, more than its GAP plus its wipe (${P.GAP + 2 * P.WIPE}) cover: lower G or widen GAP or WIPE`);
  if (P.UP > 2 * P.WIPE) out.push('sweep: UP is above the wipe: it must start within its 2*WIPE cells');
  return out;
}

const sweep = {
  id: 'sweep', kind: 'body', exit: 'never', writes: 'core', attacks: 'all', roams: false, dialects: '94',
  processes: 1, grows: true,
  purpose: 'A two-pair continuous scanner on a step that shares a factor G with the core (every G-th cell, one lap of core/G probes): each find gets 2*WIPE SPL cells from UP-1 above the find downward; after LAPS loops (and a pause, see the file) a SPL-fed clear runs a forward DAT and a backward decrement, and restarts itself when its forward pointer comes round onto its lowest cell. Numbers are shares of the core, so it builds on any core; written for ModelWar, where it beats Nemesis 8-0 (54 wins, 10 losses in 100 rounds).',
  params: { G: [2, 16], STEPF: [1, 9999], STARTF: [1, 9999], GAP: [2, 32], WIPE: [2, 16], UP: [0, 9], LAPF: [1, 100], BA: [0, 3], TF: [0, 1], TRIP: [0, 2], CLR: [0, 1] },
  defaults: { G: 10, STEPF: 5044, STARTF: 2357, GAP: 9, WIPE: 9, UP: 5, LAPF: 28, BA: 0, TF: 0, TRIP: 1, CLR: 1 },
  entry: 'loop', entryFirst: false, loop: 'loop',
  protects: (P) => (P.CLR ? 'image' : 'self'),
  provides: { splBomb: 'st', datBomb: 'cb' },
  mutable: (P) => [['cp', ['a', 'b']], ['trip', EVERY], ['one', EVERY], ['p', EVERY], ...Array.from({ length: pads(P) }, (_, k) => [`pad${k}`, EVERY]), ['lap', ['b']], ['c', ['b']]],
  mismatches: sweepMismatches,
  // Its wipes and clear skip only what lies above p, so nothing that still runs may lie under it:
  // `attacks: 'all'` refuses running partners, and what an opening leaves under it (its code, a
  // probe pointer it hands on) is dead once the scan starts.
  emit(ctx) {
    const { L, P, core, total } = ctx, idx = ctx.pc();
    const W = P.WIPE, UP = P.UP, STEP = sweepStep(P, core), START = sweepStart(P, core);
    const past = `${L('cb')}+1-${L('cp')}`;             // the first cell past the block, from cp
    const rest = Math.max(total - idx, 1);              // the first cell past the warrior, from cp
    const own = `${rest}-(${L('p')}-${L('cp')})`;       // our cells from p up
    const clr = P.CLR ? `${rest}` : past;               // where the forward clear starts, from cp
    const p = L('p');
    ctx.ins('cp', 'DAT', 'F', `$${P.BA}`, `$${clr}`);
    ctx.ins('trip', 'DAT', 'F', '$0', '$0');
    ctx.ins('one', 'DAT', 'F', '$1', '$1');
    ctx.ins('p', 'DAT', 'F', `#${mod(START - P.GAP, core)}`, `#${START}`);
    for (let k = 0; k < pads(P); k++) ctx.ins(`pad${k}`, 'DAT', 'F', '$0', '$0');
    ctx.ins('loop', 'ADD', 'F', L('st'), p);
    ctx.ins('', 'SEQ', 'I', `*${p}`, `@${p}`);
    ctx.ins('', 'JMP', 'B', L('hit'));
    ctx.ins('', 'ADD', 'F', L('st'), p);
    ctx.ins('', 'SEQ', 'I', `*${p}`, `@${p}`);
    ctx.ins('', 'JMP', 'B', L('hit'));
    ctx.ins('lap', 'DJN', 'B', L('loop'), `#${sweepLaps(P, core)}`);
    ctx.ins('', 'JMP', 'B', L('clr'));
    ctx.ins('hit', 'SLT', 'AB', `#${own}+${2 * W}`, p);
    ctx.ins('', 'JMP', 'B', L('lap'));
    ctx.ins('', 'MOV', 'AB', `#${W}`, L('c'));
    ctx.ins('', 'ADD', 'AB', `#${UP}`, p);
    ctx.ins('wipe', 'MOV', 'I', L('st'), `<${p}`);
    ctx.ins('', 'MOV', 'I', L('st'), `<${p}`);
    ctx.ins('c', 'DJN', 'B', L('wipe'), '#0');
    ctx.ins('', 'ADD', 'AB', `#${2 * W - UP}`, p);
    if (P.TRIP) ctx.ins('', 'JMZ', P.TF ? 'F' : 'B', L('lap'), L('trip'));
    else ctx.ins('', 'JMP', 'B', L('lap'));
    if (P.TRIP === 2) ctx.ins('idle', 'DJN', 'B', L('idle'), L('lap'));
    ctx.ins('clr', 'SPL', 'B', '#0', '$0');
    ctx.ins('cl', 'MOV', 'I', L('cb'), `>${L('cp')}`);
    ctx.ins('', 'DJN', 'F', L('cl'), `{${L('cp')}`);
    ctx.ins('', 'JMP', 'B', L('cl'));
    ctx.ins('st', 'SPL', 'B', `#${STEP}`, `$${STEP}`);
    ctx.ins('cb', 'DAT', 'F', `$${P.BA}`, `$${clr}`);
  },
  plant(api) {
    // Something on the scan's path, a few probes out, clear of the image.
    const { P, core } = api, p = api.at('p'), STEP = sweepStep(P, core);
    let b = sweepStart(P, core);
    for (let k = 1; k < 400; k++) {
      b = mod(b + STEP, core);
      const c = api.norm(p + b);
      let free = true;
      for (let j = -40; j <= 40 && free; j++) if (api.inImage(api.norm(c + j))) free = false;
      if (free && k > 4) return [[c, { op: 'MOV', mod: 'I', aMode: '$', a: 0, bMode: '$', b: 1 }]];
    }
    return [];
  },
  watch(api) {
    const { vm, P } = api;
    const planted = api.scenario === 'sweep: planted target';
    const target = planted ? (sweep.plant(api)[0] ?? [null])[0] : null;
    const cl = api.at('cl');
    let cleared = null, stunned = false;
    return {
      before(pc) {
        if (cleared === null && pc === cl && api.same(vm.peek(pc), api.code('cl'))) cleared = vm.cycle;
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
        if (planted && target !== null && !stunned) throw new Error('sweep: did not wipe around the planted target');
        if (!api.alone) return;
        for (const l of ['clr', 'cl', 'st']) if (!api.same(vm.peek(api.at(l)), api.code(l))) throw new Error('sweep: its clear ran over its own loop');
        if (cleared === null && vm.cycle > 8 * sweepLaps(P, api.core) + 2 * api.core) throw new Error('sweep: never started its clear');
      },
    };
  },
};

// The clear on its own: a finisher any opening can hand to.
const restartClear = {
  id: 'restart-clear', kind: 'finisher', exit: 'never', writes: 'core', attacks: 'all', roams: false, dialects: '94',
  processes: 1, grows: true, relocatable: false,
  purpose: 'A SPL-fed clear: a stream of processes runs a forward DAT pointer and a backward pointer that decrements both fields of every cell, from one pointer cell, its lowest; the forward pointer comes round onto that cell first and its bomb resets it, so the clear starts again from just past itself and never reaches its own loop, however many processes run it. CLR 1 spares the image, CLR 0 clears it too.',
  params: { BA: [0, 3], CLR: [0, 1] },
  defaults: { BA: 0, CLR: 1 },
  entry: 'clr', entryFirst: false, loop: 'cl',
  protects: (P) => (P.CLR ? 'image' : 'self'),
  provides: { datBomb: 'cb' },
  mutable: [['cp', ['a', 'b']]],
  mismatches: (P, settings) => (settings.topology === 'torus' ? ['restart-clear: written for the ring'] : []),
  // Like sweep's clear, it must have nothing still running under it (see sweep above).
  emit(ctx) {
    const { L, P, total } = ctx, idx = ctx.pc();
    const clr = P.CLR ? `${Math.max(total - idx, 1)}` : `${L('cb')}+1-${L('cp')}`;
    ctx.ins('cp', 'DAT', 'F', `$${P.BA}`, `$${clr}`);
    ctx.ins('clr', 'SPL', 'B', '#0', '$0');
    ctx.ins('cl', 'MOV', 'I', L('cb'), `>${L('cp')}`);
    ctx.ins('', 'DJN', 'F', L('cl'), `{${L('cp')}`);
    ctx.ins('', 'JMP', 'B', L('cl'));
    ctx.ins('cb', 'DAT', 'F', `$${P.BA}`, `$${clr}`);
  },
  watch(api) {
    const { vm } = api, guard = ['clr', 'cl', 'cb'];
    return {
      final() {
        if (!api.entered() || !api.alone) return;
        for (const g of guard) if (!api.same(vm.peek(api.at(g)), api.code(g))) throw new Error('restart-clear ran over its own loop');
      },
    };
  },
};

export default [sweep, restartClear];
