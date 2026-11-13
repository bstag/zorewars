// Layout pieces for LP hill warriors.
//
//   lp-padding    blank cells (DAT 0,0, exactly what an empty core holds) that a 200-cell
//                 hill entry uses to stretch its image: a scanner that finds the image
//                 finds mostly nothing, and components sit further apart.
//   lp-imp-quad   an imp spiral started with exactly 2^K processes and no adders: a binary
//                 SPL fan, then each process jumps through one entry of a table of JMPs,
//                 picked by an A-postincrement pointer, onto its point of the spiral. The
//                 vector launchers (`vector-spiral`, `imp-ring`) briefly hold an adder per imp,
//                 so their four-imp spiral needs eight slots; this one needs four, which is
//                 what an LP warrior with two papers and two stones beside it has left.
import { modInverse } from '../util.js';

const padding = {
  id: 'lp-padding',
  kind: 'data', exit: 'data', processes: 0, writes: 'sparse',
  purpose: 'COUNT blank cells (DAT.F $0, $0, the same as empty core) laid out after the code, to stretch a hill-length image: a scanner that finds the image finds mostly empty cells, and the warrior\'s parts sit further apart.',
  params: { COUNT: [1, 190] },
  defaults: { COUNT: 120 },
  emit(ctx) { for (let i = 0; i < ctx.P.COUNT; i++) ctx.ins(i ? '' : 'pad', 'DAT', 'F', '$0', '$0'); },
};

const points = (P, core) => {
  const step = modInverse(P.N, core);
  return Array.from({ length: 2 ** P.K }, (_, i) => ((i * step) % core + core) % core);
};

const impQuad = {
  id: 'lp-imp-quad',
  kind: 'body', exit: 'never', dialects: '94', processes: (P) => 2 ** P.K, writes: 'sparse', roams: true, layout: 'last',
  entry: 'fan',
  purpose: 'An N-point imp spiral of exactly 2^K processes (K 1-3) with no temporary adders: K SPLs make the processes in lockstep, an A-postincrement JMP sends each through its own entry of a JMP table to its point (i times the spiral step), and the imp is the last cell. 2^K + K + 2 cells; it never holds more processes than imps.',
  params: { N: [3, 31], K: [1, 3] },
  defaults: { N: 3, K: 2 },
  mismatches(P, settings) {
    const core = settings.coreSize, step = modInverse(P.N, core);
    if (!step) return [`lp-imp-quad: no ${P.N}-point spiral on a ${core}-cell core`];
    if (2 ** P.K < P.N) return ['lp-imp-quad: fewer imps than points'];
    // A point just behind the imp would run code the imp hasn't written yet.
    if (points(P, core).slice(1).some((p) => p > core - settings.maxLength)) return [`lp-imp-quad: a ${P.N}-point imp lands on the launcher`];
    return [];
  },
  emit(ctx) {
    const { L, P, core } = ctx, step = modInverse(P.N, core), n = 2 ** P.K;
    for (let i = 0; i < P.K; i++) ctx.ins(i ? '' : 'fan', 'SPL', 'B', '1');
    ctx.ins('go', 'JMP', 'B', `}${L('vec')}`);
    ctx.ins('vec', 'DAT', 'F', `${L('t0')}-${L('vec')}`, '#0');
    for (let i = 0; i < n; i++) ctx.ins(`t${i}`, 'JMP', 'B', `${L('imp')}+${(i * step) % core}`);
    ctx.ins('imp', 'MOV', 'I', '0', `${step}`);
  },
  running(api) {
    const imp = api.code('imp');
    return api.vm.processes(0).some((pc) => api.same(api.vm.peek(pc), imp) || api.inSelf(pc));
  },
  watch(api) {
    const { vm, P, core, norm, same } = api;
    const imp = api.at('imp'), code = api.code('imp'), want = points(P, core).map((p) => norm(imp + p));
    const firsts = [];
    let entered = false;
    return {
      before(pc) {
        if (pc === api.entry() && same(vm.peek(pc), api.code('fan'))) entered = true;
        if (!entered || firsts.length >= want.length) return null;
        if (pc === want[firsts.length] && same(vm.peek(pc), code)) firsts.push(vm.steps);
        else if (want.includes(pc) && !firsts.includes(pc) && same(vm.peek(pc), code) && api.alone) {
          throw new Error('lp-imp-quad started its imps out of order');
        }
        return null;
      },
      final() {
        if (!entered) return;
        if (firsts.length !== want.length) throw new Error(`lp-imp-quad started ${firsts.length} of its ${want.length} imps`);
        if (!api.alone) return;
        if (vm.warriors[0].peak !== want.length) throw new Error('lp-imp-quad held more processes than imps');
        const live = vm.processes(0).filter((pc) => same(vm.peek(pc), code)).length;
        if (live !== want.length) throw new Error(`lp-imp-quad: ${live} of ${want.length} imps still running`);
      },
    };
  },
};

export default [padding, impQuad];
