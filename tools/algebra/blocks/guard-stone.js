// Guard stone: a multi-process two-bomb stone on a lattice that shares a factor
// with the core, with a guard cell timed to be hit at a chosen point of its lap,
// then a self-restarting clear (docs/block-algebra-catalog.md). Written from
// scratch for ModelWar's 25,200-cell core after an ablation study of the hill's
// P-space switchers, whose stone arm beats the stones and papers a scanner
// loses to; no hill code was copied. Every number is a share of the core, so
// one tree builds on any core size.
//
//   cp    DAT  BA, clr      the clear's pointers (A backward, B forward); the LOWEST cell
//   boot  SPL  s            PROCS-1 of them, then JMP s: PROCS = 4M+1 processes, each one
//         ...               line behind the next, so the 4-line loop runs in order
//         JMP  s
//   s     ADD.AB #2S, p
//         MOV  bomb, @p     a bomb at X...
//   p     MOV  bomb, *X0    ...and one at X+S, through the first bomb's A-field
//         JMN.B s, guard    the guard still there? bomb on
//   clr   SPL  #0, 0        no: every process runs the clear
//   cl    MOV  cb, >cp      forward DAT
//         DJN.F cl, {cp     backward: decrement both fields of every cell
//         JMP  cl
//   bomb  MOV  S, 1         (BOMB 2, the default: guard read with JMZ.A)
//                           (DAT #S, #0 with BOMB 0, SPL #S, 0 with BOMB 1: guard read with JMN.B)
//   cb    DAT  BA, clr      the clear's bomb: the same as cp's start
//         (GPAD empty cells)
//   guard DAT  0, 1
//
// AIR 1 is an airbag: the guard is an empty cell (DAT 0, 0) read with JMZ.F, so any
// write with a non-zero field starts the clear: our own lattice bomb, and an enemy's
// SPL or DAT bomb whichever field it sets. (AIR 0 reads one field only, so with the
// MOV bomb an enemy's DAT 0/#n on the guard goes unnoticed.) A DAT 0, 0 written on
// it changes nothing, and an empty guard gives a scanner nothing to find.
//
// The bombs cover one residue class modulo g = gcd(S, core). X0 is chosen at
// build time so that the guard is the first cell of the block the lattice
// reaches, at step K = LIFE% of the lap (or the latest step before that at
// which no other cell of the block has been hit, with a few steps' margin for
// the processes still in the loop): the stone stops itself before it would
// bomb its own code, and an enemy bomb on the guard (a DAT, or anything with a
// zero B-field, or with BOMB 2 a non-zero A-field) starts the clear early.
// The MOV bomb is what beats papers: a paper process that runs it copies the
// cell S away (usually empty) in front of itself and dies on it next, and a
// paper that copies the bomb into its own body carries it on. The loop runs with 4M+1 processes:
// one more than a multiple of its length, so the processes run its lines in
// order (s, mov, p, jmn, s, ...), and every write goes to a fresh pointer.

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const mod = (x, n) => ((x % n) + n) % n;

// The factor the step shares with the core: the largest divisor of the core from 2 to G.
export function guardFactor(G, core) {
  for (let g = Math.max(2, G); g >= 2; g--) if (core % g === 0) return g;
  return 1;
}
// The step: a multiple of the factor near STEPF/10000 of the core, sharing nothing else with it
// (and, when 2g divides the core, an odd multiple, so the two bombs cover the class's two halves).
export function guardStep(P, core) {
  const g = guardFactor(P.G, core), want = Math.round((core * P.STEPF) / 10000 / g);
  for (let d = 0; d < core / g; d++) {
    for (const k of [want + d, want - d]) {
      const s = k * g;
      if (s > 0 && s < core && gcd(s, core) === g && (core % (2 * g) || gcd(2 * s, core) === 2 * g)) return s;
    }
  }
  return g;
}

// Offsets from cp.
export function guardLayout(P) {
  const procs = 4 * P.M + 1, s = 1 + procs, clr = s + 4, cl = clr + 1, bomb = clr + 4, cb = bomb + 1;
  // PTR 1: both bombs go through a pointer cell of its own (after cb, with its step beside it),
  // so an enemy write on the first bomb's cell can't turn the second bomb back onto the stone.
  const p = P.PTR ? cb + 1 : s + 2, inc = P.PTR ? cb + 2 : null;
  const guard = cb + 1 + (P.PTR ? 2 : 0) + P.GPAD;
  const critical = [0, s, s + 1, s + 2, s + 3, clr, cl, cl + 1, cl + 2, bomb, cb, ...(P.PTR ? [p, inc] : [])];
  return { procs, s, p, inc, clr, cl, bomb, cb, guard, size: guard + 1, critical };
}

// X0 (the pointer's start, from p) and K (the step at which the guard is hit), or null.
export function guardPlan(P, core) {
  const S = guardStep(P, core), lay = guardLayout(P), N = core / gcd(2 * S, core);
  const first = new Map();                       // offset from p+X0 -> the first step that writes it
  for (let k = N; k >= 0; k--) first.set(mod(2 * k * S, core), k);
  for (let k = N; k >= 0; k--) { const c = mod(2 * k * S + S, core); if (!(first.get(c) <= k)) first.set(c, k); }
  const hit = (c, X0) => first.get(mod(c - lay.p - X0, core)) ?? Infinity;
  const margin = lay.procs + 2;
  for (let K = Math.max(1, Math.round((N * P.LIFE) / 100)); K > margin; K--) {
    const X0 = mod(lay.guard - lay.p - 2 * K * S, core);
    if (hit(lay.guard, X0) !== K) continue;
    if (lay.critical.every((c) => hit(c, X0) > K + margin)) return { S, X0, K, N, lay };
  }
  return null;
}

function guardMismatches(P, settings) {
  const core = settings.coreSize, out = [];
  if (settings.topology === 'torus') return ['guard-stone: written for the ring'];
  if (guardFactor(P.G, core) < 2) out.push(`guard-stone: the ${core}-cell core has no factor from 2 to ${P.G} for the step to share`);
  else if (!guardPlan(P, core)) out.push('guard-stone: no start puts the guard ahead of its own cells on the lattice: change G, GPAD or STEPF');
  const procs = 4 * P.M + 1;
  if (procs > settings.maxProcesses) out.push(`guard-stone: ${procs} processes, this hill allows ${settings.maxProcesses}`);
  return out;
}

const guardStone = {
  id: 'guard-stone', kind: 'body', exit: 'never', writes: 'core', attacks: 'all', roams: false, dialects: '94',
  processes: (P) => 4 * P.M + 1, grows: true,
  purpose: 'A 4M+1-process stone that writes two bombs a step (the second through the first\'s A-field) on a lattice sharing a factor G with the core, until its guard cell is hit (by itself at LIFE% of the lap, placed so the guard comes before its own cells, or earlier by an enemy\'s zero-B bomb); then a SPL-fed self-restarting clear. Numbers are shares of the core, so it builds on any core; written for ModelWar, where it beats the stones and papers a scanner loses to.',
  params: { G: [2, 24], STEPF: [1, 9999], LIFE: [5, 100], M: [0, 3], BOMB: [0, 2], GPAD: [0, 12], BA: [0, 3], CLR: [0, 1], AIR: [0, 1], PTR: [0, 1] },
  // Screened on ModelWar (25 opponents, 2 matches each): BOMB 2 with G 6, GPAD 7 (the guard at 90%
  // of the lap) scored 1.56 points a round, 36-14 in matches; DAT and SPL bombs 1.35 to 1.45.
  defaults: { G: 6, STEPF: 3800, LIFE: 90, M: 0, BOMB: 2, GPAD: 7, BA: 0, CLR: 1, AIR: 0, PTR: 0 },
  entry: 'boot', entryFirst: false, loop: 's',
  protects: (P) => (P.CLR ? 'image' : 'self'),
  provides: { datBomb: 'cb' },
  mutable: (P) => [['cp', ['a', 'b']], ['p', P.PTR ? ['a', 'b'] : ['b']], ['guard', ['a', 'b']], ...Array.from({ length: P.GPAD }, (_, k) => [`pad${k}`, ['op', 'mod', 'aMode', 'a', 'bMode', 'b']])],
  mismatches: guardMismatches,
  // Its clear skips only what lies above cp, so nothing that still runs may lie under it
  // (`attacks: 'all'`), as for sweep.
  emit(ctx) {
    const { L, P, core, total } = ctx, idx = ctx.pc();
    const plan = guardPlan(P, core), { S, X0, lay } = plan;
    const rest = Math.max(total - idx, 1);
    const clr = P.CLR ? `${rest}` : `${L('cb')}+1-${L('cp')}`;
    ctx.ins('cp', 'DAT', 'F', `$${P.BA}`, `$${clr}`);
    for (let k = 0; k < lay.procs - 1; k++) ctx.ins(k ? '' : 'boot', 'SPL', 'B', L('s'), '$0');
    ctx.ins(lay.procs > 1 ? '' : 'boot', 'JMP', 'B', L('s'), '$0');
    if (P.PTR) {
      ctx.ins('s', 'ADD', 'F', L('inc'), L('p'));
      ctx.ins('', 'MOV', 'I', L('bomb'), `@${L('p')}`);
      ctx.ins('', 'MOV', 'I', L('bomb'), `*${L('p')}`);
    } else {
      ctx.ins('s', 'ADD', 'AB', `#${mod(2 * S, core)}`, L('p'));
      ctx.ins('', 'MOV', 'I', L('bomb'), `@${L('p')}`);
      ctx.ins('p', 'MOV', 'I', L('bomb'), `*${X0}`);
    }
    if (P.AIR) ctx.ins('', 'JMZ', 'F', L('s'), L('guard'));          // airbag: any non-zero field
    else if (P.BOMB === 2) ctx.ins('', 'JMZ', 'A', L('s'), L('guard'));   // our MOV bomb has a non-zero A
    else ctx.ins('', 'JMN', 'B', L('s'), L('guard'));                 // our DAT/SPL bomb has a zero B
    ctx.ins('clr', 'SPL', 'B', '#0', '$0');
    ctx.ins('cl', 'MOV', 'I', L('cb'), `>${L('cp')}`);
    ctx.ins('', 'DJN', 'F', L('cl'), `{${L('cp')}`);
    ctx.ins('', 'JMP', 'B', L('cl'));
    if (P.BOMB === 2) ctx.ins('bomb', 'MOV', 'I', `$${S}`, '$1');
    else ctx.ins('bomb', P.BOMB ? 'SPL' : 'DAT', P.BOMB ? 'B' : 'F', `#${S}`, '#0');
    ctx.ins('cb', 'DAT', 'F', `$${P.BA}`, `$${clr}`);
    if (P.PTR) {
      ctx.ins('p', 'DAT', 'F', `$${mod(X0 + S, core)}`, `$${X0}`);   // A: the second bomb, S past the first
      ctx.ins('inc', 'DAT', 'F', `$${mod(2 * S, core)}`, `$${mod(2 * S, core)}`);
    }
    for (let k = 0; k < P.GPAD; k++) ctx.ins(`pad${k}`, 'DAT', 'F', '$0', '$0');
    ctx.ins('guard', 'DAT', 'F', '$0', P.AIR ? '$0' : '$1');
  },
  plant(api) {
    // A target on the lattice, a few hundred steps out, clear of the image.
    const { P, core } = api, plan = guardPlan(P, core), p = api.at('p');
    for (let k = 40; k < plan.K; k++) {
      const c = api.norm(p + plan.X0 + 2 * k * plan.S);
      let free = true;
      for (let j = -40; j <= 40 && free; j++) if (api.inImage(api.norm(c + j))) free = false;
      if (free) return [[c, { op: 'MOV', mod: 'I', aMode: '$', a: 0, bMode: '$', b: 1 }]];
    }
    return [];
  },
  watch(api) {
    const { vm, P } = api, plan = guardPlan(P, api.core);
    const planted = api.scenario === 'guard-stone: planted target';
    const target = planted ? (guardStone.plant(api)[0] ?? [null])[0] : null;
    const clr = api.at('clr');
    let cleared = null;
    return {
      before(pc) {
        if (cleared === null && pc === clr && api.same(vm.peek(pc), api.code('clr'))) cleared = vm.cycle;
        return null;
      },
      final() {
        if (!api.entered()) return;
        if (planted && target !== null && api.same(vm.peek(target), { op: 'MOV', mod: 'I', aMode: '$', a: 0, bMode: '$', b: 1 })) throw new Error('guard-stone: did not bomb the planted target');
        if (!api.alone) return;
        for (const l of ['s', 'p', 'clr', 'cl', 'cb']) if (!api.same(vm.peek(api.at(l)), api.code(l)) && l !== 'p') throw new Error(`guard-stone: its own ${l} was overwritten`);
        if (cleared === null && vm.cycle > 2 * (4 * plan.K + 200) * (4 * P.M + 1)) throw new Error('guard-stone: never reached its guard and started the clear');
      },
    };
  },
};

export default [guardStone];
