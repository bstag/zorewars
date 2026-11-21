// Split stone: a five-cell stone whose clear lives a step away, bombing every G-th cell of the
// core for one full lap and then turning itself into that clear (docs/block-algebra-catalog.md).
// Written from scratch for ModelWar's 25,200-cell core after a study of the 94x hill's P-space
// switchers (their stone arm beat guard-stone by about 0.4 points a round there): what made the
// difference was not the step or the decoys but the lattice and the lap. No hill code was copied.
//
//   ssBoot MOV cp, p+S-2     the clear is copied S cells past p, five cells,
//          ...               before the stone starts
//          SPL s             PROCS-1 of them, then JMP s: 4M+1 processes, each a line behind
//          JMP s             the next, so the loop's lines run in order
//   s      ADD.AB #2S, p
//          MOV bomb, @p      a bomb at X ...
//   p      MOV bomb, *0      ... and one at X+S, through the first bomb's A-field (B: X, from p)
//          JMN.B s, bomb     the bomb still there? bomb on
//          JMP p+S           no (an enemy zeroed it): to the clear
//   bomb   MOV S, 1          the bomb: a process that runs it copies the cell S away in front of itself
//   cp..c2                   the clear's template (copied): cp DAT 0, 5 / cb DAT 0, 5 /
//                            c0 SPL #0 / c1 MOV cb, >cp / c2 DJN.F c1, >cp
//
// S shares the factor G (3 or more) with the core and 2S shares 2G, so the first bombs fill one
// class mod 2G and the second bombs the class G past it: together every cell ≡ p (mod G), so
// every G cells of the enemy hold a bomb, and any loop of G lines or fewer is hit within the lap.
// The first bombs come round to p itself on the last pass (the pointer starts at 0), which is why
// p is the only cell of the loop on that residue; the bomb that lands there makes p a MOV S, 1,
// which copies the clear's SPL #0 (S past p, written by no pass before the last) over the JMN:
// every process then pumps and jumps to the clear. The clear's cells other than its SPL are off
// the residue too, so the lap never touches the running code. The clear is forward only: it
// writes a DAT and decrements the next cell each loop, and when its pointer comes round to cp
// the DAT written there (B 5) makes it skip its own five cells.
//
// One process until the clear. Ring, ICWS'94 only. How to write a block: docs/block-algebra.md.

import { guardStep } from './guard-stone.js';

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const mod = (x, n) => ((x % n) + n) % n;
const EVERY = ['op', 'mod', 'aMode', 'a', 'bMode', 'b'];

export function splitPlan(P, core) {
  const S = guardStep(P, core), g = gcd(S, core), N = core / gcd(2 * S, core);
  return { S, g, N };
}

const splitStone = {
  id: 'split-stone', kind: 'body', exit: 'never', writes: 'core', attacks: 'all', roams: false, dialects: '94',
  processes: (P) => (P.M ? 5 : 1), grows: true,
  purpose: 'A five-cell stone that bombs every G-th cell of the core for one full lap (two MOV S, 1 bombs a pass, the second through the first\'s A-field, in classes G apart mod 2G), with its d-clear copied S cells away by its own short boot. Only the stone\'s pointer line lies on its lattice, and the lap\'s last bomb lands there: that line then copies the clear\'s SPL #0 over the JMN and every process goes to the clear (an enemy zeroing the bomb sends them there early). Any enemy loop of G lines or fewer is hit within the lap. 4M+1 processes in the loop. Numbers are shares of the core, so it builds on any core with a factor of 3 or more.',
  params: { G: [3, 24], STEPF: [1, 9999], M: [0, 1], CHECK: [0, 1] },
  defaults: { G: 3, STEPF: 1199, M: 1, CHECK: 1 },
  entry: 'ssBoot', entryFirst: true, loop: 's',
  protects: 'self',
  provides: { datBomb: 'ssCb' },
  mutable: () => [['p', EVERY], ['ssJmn', EVERY], ['bomb', EVERY], ['ssGo', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (settings.topology === 'torus') return ['split-stone: written for the ring'];
    const { S, g } = splitPlan(P, core);
    if (g < 3) out.push(`split-stone: the step must share a factor of 3 or more with the ${core}-cell core (got ${g}): the loop needs two cells off the lattice either side of its pointer`);
    else if (gcd(2 * S, core) !== 2 * g) out.push(`split-stone: 2S must share ${2 * g} with the core so the two bombs fill classes ${g} apart; change G or STEPF`);
    const procs = P.M ? 5 : 1;
    if (procs > settings.maxProcesses) out.push(`split-stone: ${procs} processes, this hill allows ${settings.maxProcesses}`);
    return out;
  },
  // The clear is copied S cells past p; that must land outside the warrior (when it runs in place)
  // and outside the cells of this block's own running copy.
  linked(P, settings, at, { total, span }) {
    const core = settings.coreSize, { S } = splitPlan(P, core), p = at('p');
    const inside = (c, from, size) => ((c - from) % core + core) % core < size;
    for (let k = -2; k <= 2; k++) {
      const c = ((p + S + k) % core + core) % core;
      if (span && inside(c, span.start, span.size)) return [`split-stone: its clear (S = ${S} past the stone) would land on its own code`];
      if (inside(c, 0, total)) return [`split-stone: its clear (S = ${S} past the stone) would land inside the ${total}-cell warrior; boot it away or change STEPF`];
    }
    return [];
  },
  emit(ctx) {
    const { L, P, core } = ctx, { S } = splitPlan(P, core);
    const at = (k) => `${L('p')}+${S + k}`;
    ctx.ins('ssBoot', 'MOV', 'I', L('ssCp'), at(-2));
    ctx.ins('', 'MOV', 'I', L('ssCb'), at(-1));
    ctx.ins('', 'MOV', 'I', L('ssC0'), at(0));
    ctx.ins('', 'MOV', 'I', L('ssC1'), at(1));
    ctx.ins('', 'MOV', 'I', L('ssC2'), at(2));
    // M 1: five processes in lockstep (1 -> 2 -> 3 -> 5: each MOV copies the SPL above it onto
    // itself, so all but the process that ran the MOV split again), dealt by a JMP >0 whose B-field
    // counts up to ssWait, s, the first MOV, p and the JMN. Five over a four-line loop, one line
    // apart, run its lines strictly in turn from the first cycle (four would not: the fourth round
    // runs the JMN before that pass's p), which CHECK needs, since a line run out of turn moves the
    // JMN's pointer. ssWait is a JMP to s: the process sent there reaches s a turn later, behind
    // the one at the JMN.
    if (P.M) {
      ctx.ins('', 'SPL', 'B', '$1', '$0');
      ctx.ins('', 'MOV', 'I', '$-1', '$0');
      ctx.ins('', 'MOV', 'I', '$-1', '$0');
    }
    ctx.ins('ssGo', 'JMP', 'B', '>0', '$1');
    ctx.ins('ssWait', 'JMP', 'B', L('s'), '$0');
    ctx.ins('s', 'ADD', 'AB', `#${mod(2 * S, core)}`, L('p'));
    // CHECK 1: both writes take the bomb through the JMN's B-field, one raising it and one
    // lowering it back, so it points at the bomb only while both lines run. If an enemy breaks
    // either line, the JMN's pointer drifts onto a blank B-field next to the bomb and the processes
    // still in the loop fall through to the clear, which lives S away and is still intact.
    if (P.CHECK) {
      ctx.ins('', 'MOV', 'I', `>${L('ssJmn')}`, `@${L('p')}`);
      ctx.ins('p', 'MOV', 'I', `<${L('ssJmn')}`, '*0');
    } else {
      ctx.ins('', 'MOV', 'I', L('bomb'), `@${L('p')}`);
      ctx.ins('p', 'MOV', 'I', L('bomb'), '*0');
    }
    ctx.ins('ssJmn', 'JMN', 'B', L('s'), L('bomb'));
    ctx.ins('', 'JMP', 'B', at(0), '$0');                 // B-field 0: the drift's other side
    ctx.ins('bomb', 'MOV', 'I', `$${S}`, '$1');
    if (P.CHECK) ctx.ins('ssBlank', 'DAT', 'F', '$0', '$0');
    ctx.ins('ssCp', 'DAT', 'F', '$0', '$5');
    ctx.ins('ssCb', 'DAT', 'F', '$0', '$5');
    ctx.ins('ssC0', 'SPL', 'B', '#0', '$0');
    ctx.ins('ssC1', 'MOV', 'I', L('ssCb'), `>${L('ssCp')}`);
    ctx.ins('ssC2', 'DJN', 'F', L('ssC1'), `>${L('ssCp')}`);
  },
  plant(api) {
    // An enemy zeroes the bomb's B-field a few hundred passes in: the stone must go to its clear.
    return [[api.at('bomb'), { op: 'DAT', mod: 'F', aMode: '$', a: 0, bMode: '$', b: 0 }, 1500]];
  },
  watch(api) {
    const { vm, P } = api, { S, N } = splitPlan(P, api.core);
    const s = api.at('s'), c0 = api.norm(api.at('p') + S);
    const planted = api.scenario === 'split-stone: planted target';
    let passes = 0, clearAt = null;
    return {
      before(pc) {
        if (!api.entered()) return null;
        if (pc === s && clearAt === null) passes++;
        if (pc === c0 && clearAt === null) clearAt = vm.cycle;
        return null;
      },
      final() {
        if (!api.entered()) return;
        if (planted && clearAt === null) throw new Error('split-stone: its bomb was zeroed and it never went to its clear');
        if (!api.alone) return;
        if (clearAt === null && vm.cycle > 4 * (N + 50) * (P.M ? 5 : 1)) throw new Error('split-stone: it never handed over to its clear');
        if (clearAt !== null && passes < N - 2) throw new Error(`split-stone: it went to its clear after ${passes} passes, not the full lap of ${N}`);
      },
    };
  },
};

export default [splitStone];
