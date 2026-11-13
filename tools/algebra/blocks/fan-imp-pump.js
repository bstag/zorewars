// fan-imp-pump: a continuous imp pump for a fan of lockstep processes (the
// kind of launcher Son of Vain starts with four of its boot's workers;
// docs/hill-top30/94nop.md). The hill warrior was studied for the idea only;
// this code is written from scratch. Ring, '94.
//
//   fpGo   spl   #0, 0              the PROCS entrants stay here: every round
//                                   each sends one process down the pump
//   fpAdd  add.a #STEP, fpJ         ... which moves the launch vector one ring
//                                   step on
//   fpJ    jmp   fpImp-PROCS*STEP   ... and jumps. The queue alternates adders
//                                   and jumpers, so each jump sees its own
//                                   vector: launch k lands on fpImp + k*STEP
//   fpImp  mov.i #0, STEP           the seed (launch 0 runs it here)
//
// STEP is the ring step of a POINTS-point spiral (POINTS * STEP = 1 mod core).
// A launched process runs the cell it lands on in the next round, directly
// after the launch before it has run its own cell and so written this one:
// the launches feed each other and need nothing from the spiral. After POINTS
// launches the vector has come round to one cell past the seed, so the spiral
// is fed PROCS new imps a round, PROCS/POINTS cells of fresh spiral a round.
// That needs PROCS >= POINTS: with fewer, the first imp reaches its second
// cell before the launch that writes it has run.
//
// What it promises: its launches land a ring step apart, each on an imp
// instruction, for as long as its four cells are intact and the process table
// has room (a full table turns an SPL #0 into a plain step, and the feeders
// leave as imps). It does not promise that the spiral survives partners that
// bomb, nor that it can be rebuilt from nothing: it has no refill check.
//
// FAN 0 is the bare four cells for a fan boot with N = PROCS (fanboot3 ROUTE 1
// sends N into its third member); FAN 1 puts its own SPL fan in front.
import { fanLines } from '../fan-lines.js';
import { modInverse } from '../util.js';

const mod = (x, n) => ((x % n) + n) % n;
const LEN = 4;
// POINTS 0: three points, or thirteen where three divides the core. PROCS 0: the smallest fan that is not smaller.
const pointsOf = (P, core) => P.POINTS || (core % 3 ? 3 : 13);
const procsOf = (P, core) => P.PROCS || [4, 6, 8, 12, 16].find((n) => n >= pointsOf(P, core)) || 16;

const fanImpPump = {
  id: 'fan-imp-pump',
  kind: 'body', exit: 'never', grows: true, writes: 'sparse', roams: true, dialects: '94',
  processes: (P) => (P.FAN ? P.PROCS || 16 : 1),
  purpose: 'A four-cell continuous imp pump for PROCS lockstep entrants: they stay on an SPL #0 and each sends one process a round through an ADD and a JMP, so launch k lands k ring steps past the seed, on the cell the launch before it has just written, and a POINTS-point spiral gains PROCS imps a round. POINTS 0 is 3 (13 where 3 divides the core), PROCS 0 the smallest fan of at least POINTS (PROCS must not be smaller). It promises launches a ring step apart while its cells are intact and the process table has room, not a spiral that survives bombing partners or a refill from nothing. FAN 0 is the bare pump for a fan boot with N = PROCS (fanboot3 ROUTE 1 for the third member); FAN 1 adds its own fan.',
  params: { POINTS: [0, 31], PROCS: [0, 16], FAN: [0, 1] },
  defaults: { POINTS: 0, PROCS: 0, FAN: 1 },
  entry: 'fpIn',
  mutable: [['fpJ', ['a']]],
  mismatches(P, settings) {
    const core = settings.coreSize, points = pointsOf(P, core), procs = procsOf(P, core), out = [];
    if (points < 2 || !modInverse(points, core)) return [`fan-imp-pump: no ${points}-point spiral on a ${core}-cell core`];
    if (!fanLines(procs)) out.push('fan-imp-pump: PROCS must be a fan size (2, 3, 4, 6, 8, 12 or 16)');
    if (procs < points) out.push(`fan-imp-pump: ${procs} processes cannot feed a ${points}-point spiral (PROCS must be at least POINTS)`);
    if (settings.maxProcesses < 16 * procs) out.push(`fan-imp-pump: it adds ${procs} imps a round; this hill allows ${settings.maxProcesses} processes`);
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, step = modInverse(pointsOf(P, core), core), procs = procsOf(P, core);
    if (P.FAN) fanLines(procs).forEach((d, i) => ctx.ins(i ? '' : 'fpIn', 'SPL', 'B', d));
    else ctx.mark('fpIn');
    ctx.ins('fpGo', 'SPL', 'B', '#0', '0');
    ctx.ins('fpAdd', 'ADD', 'A', `#${step}`, L('fpJ'));
    ctx.ins('fpJ', 'JMP', 'B', `${L('fpImp')}+${mod(-procs * step, core)}`, '0');
    ctx.ins('fpImp', 'MOV', 'I', '#0', `${step}`);
  },
  running(api) {
    const home = api.at('fpGo'), step = api.code('fpImp').b;
    return api.vm.processes(0).some((q) => api.rel(q, home) < LEN || (api.vm.peek(q).op === 'MOV' && api.norm(api.vm.peek(q).b) === api.norm(step)));
  },
  watch(api) {
    const { P, vm, core } = api, home = api.at('fpGo'), addAt = api.at('fpAdd'), jAt = api.at('fpJ'), seed = api.at('fpImp');
    const step = api.norm(api.code('fpImp').b), procs = procsOf(P, core), points = pointsOf(P, core);
    const isImp = (c) => { const x = vm.peek(c); return x.op === 'MOV' && x.mod === 'I' && api.norm(x.b) === step; };
    const intact = () => [0, 1].every((k) => api.same(vm.peek(api.add(home, k)), api.code('fpGo', k))) && vm.peek(jAt).op === 'JMP';
    // Launches still to run their first cell: { cell, due } (the launched process runs it within one more round).
    const pending = new Map();
    let spl = 0, counted = false, launches = 0, landed = 0, full = false;
    return {
      before(pc) {
        if (pc === home) spl++;
        if (pc === addAt && !counted) {
          counted = true;
          if (spl !== procs) throw new Error(`fan-imp-pump: ${spl} process${spl === 1 ? '' : 'es'} entered together; it needs PROCS (${procs}) in lockstep (FAN 1, or a fan boot with N = PROCS)`);
        }
        if (!full && vm.warriors[0].queue.size >= api.settings.maxProcesses) full = true;      // (the queue's size: no copy of it every cycle)
        // A launched process runs the cell it landed on: it must hold an imp by then.
        const p = pending.get(pc);
        if (p) {
          pending.delete(pc);
          if (isImp(pc)) landed++;
          else if (api.alone) throw new Error(`fan-imp-pump: launch ${p.k} landed on a cell with no imp in it`);
        }
        if (pc !== jAt || !intact()) return null;
        return { target: api.add(jAt, vm.peek(jAt).a) };
      },
      after(tok) {
        if (!tok) return;
        // Launch k goes k ring steps past the seed: consecutive launches stand one step apart.
        const want = api.add(seed, api.norm(launches * step));
        if (tok.target !== want) {
          if (full) return;                     // a full table lets the feeders through out of turn
          throw new Error(`fan-imp-pump: launch ${launches} went to ${api.rel(tok.target, seed)} past the seed, not ${api.rel(want, seed)} (a ring step from the last)`);
        }
        pending.set(tok.target, { k: launches });
        launches++;
      },
      final() {
        if (!spl) return;                       // never entered
        if (launches < 2 * Math.max(points, procs)) throw new Error(`fan-imp-pump: only ${launches} launches`);
        if (!api.alone) return;
        if (landed < launches - procs - pending.size) throw new Error(`fan-imp-pump: only ${landed} of ${launches} launches ran an imp`);
        // Alone, the spiral lives: far more imps running than one round of launches.
        const imps = vm.processes(0).filter(isImp).length;
        if (imps < 4 * procs) throw new Error(`fan-imp-pump: only ${imps} imps are running`);
        if (!full && !intact()) throw new Error('fan-imp-pump: the pump did not stay intact on its own');
      },
    };
  },
};

export default fanImpPump;
