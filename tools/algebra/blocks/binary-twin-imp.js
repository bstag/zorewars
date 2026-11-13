// Two phase-offset formations, inspired by the direct-jump launch in
// Monika Keindl's Twimp. Each seed feeds four processes on a three-point trail.
import { modInverse } from '../util.js';

const size = 8;
const norm = (n, core) => ((n % core) + core) % core;
const phaseOf = (P, core) => P.PHASE || Math.floor(core / 6);
const offsets = (P, core) => {
  const step = modInverse(3, core);
  const phase = phaseOf(P, core);
  return Array.from({ length: size }, (_, i) => norm(Math.floor(i / 2) * step + (i % 2) * phase, core));
};

const block = {
  id: 'binary-twin-imp', kind: 'body', exit: 'never', writes: 'sparse',
  roams: true, layout: 'last', processes: size, entry: 'seed',
  purpose: 'Seed two equal-step three-point imp trails PHASE apart. A balanced binary split tree dispatches eight processes in alternating trail order without temporary adders. PHASE 0 uses one sixth of the core.',
  params: { PHASE: [0, 55439] },
  testedProfiles: ['88', 'icws', 'icws64'],
  knowledge: {
    parameterRoles: { PHASE: 'Distance between the two seeds. Zero selects floor(CORESIZE/6).' },
    invariants: ['Three imp steps must land one cell beyond the seed.', 'The eight entries must be distinct and all remote entries must clear the linked image.'],
    evidence: ['docs/hill-block-review.md#icws64-puts-launch-order-under-a-cap', 'test/algebra-hill-profile.test.js'],
  },
  mismatches(P, settings) {
    const { coreSize: core, maxProcesses } = settings;
    if (!modInverse(3, core)) return ['binary-twin-imp: 3 has no inverse on this ring'];
    if (maxProcesses < size) return ['binary-twin-imp: the launch needs eight process slots'];
    if (phaseOf(P, core) >= core || new Set(offsets(P, core)).size !== size) {
      return ['binary-twin-imp: PHASE must place both trails in distinct cells of this core'];
    }
    return [];
  },
  linked(P, settings, at, { total, shiftedFrame }) {
    if (shiftedFrame) return ['binary-twin-imp: the launch needs an unshifted linked image'];
    const core = settings.coreSize;
    const imp = at('imp');
    if (offsets(P, core).slice(1).some(x => norm(imp + x, core) < total)) {
      return ['binary-twin-imp: a seed or launch position would overwrite the linked image'];
    }
    return [];
  },
  emit(ctx) {
    const { P, L, core } = ctx;
    const destinations = offsets(P, core);
    ctx.ins('seed', 'MOV', 'I', L('imp'), `${L('imp')}+${destinations[1]}`);
    // FIFO expands each node into its left continuation then its right child.
    // Equal path lengths make the jump leaves run in left-to-right order.
    function branch(depth, index, label) {
      if (depth === 3) {
        ctx.ins(`jump${index}`, 'JMP', 'B', `${L('imp')}+${destinations[index]}`);
        return;
      }
      const right = `branch${depth}_${index}`;
      const childIndex = index + 2 ** (2 - depth);
      const childLabel = depth === 2 ? `jump${childIndex}` : right;
      ctx.ins(label, 'SPL', 'B', L(childLabel));
      branch(depth + 1, index, '');
      branch(depth + 1, childIndex, right);
    }
    branch(0, 0, '');
    ctx.ins('imp', 'MOV', 'I', '0', String(modInverse(3, core)));
  },
  running(api) {
    return api.vm.processes(0).some(pc => api.same(api.vm.peek(pc), api.code('imp')));
  },
  watch(api) {
    const destinations = offsets(api.P, api.core).map(x => api.norm(api.at('imp') + x));
    const jumps = new Map(destinations.map((_, i) => [api.at(`jump${i}`), i]));
    const imp = api.code('imp');
    let launched = 0, started = 0;
    return {
      before(pc) {
        if (launched < size && jumps.has(pc)) {
          const index = jumps.get(pc);
          const ins = api.vm.peek(pc);
          if (index !== launched || ins.op !== 'JMP' || api.norm(pc + ins.a) !== destinations[index]) {
            throw new Error('binary-twin-imp: launch order or target changed');
          }
          launched++;
        } else if (launched === size && started < size && destinations.includes(pc)) {
          if (pc !== destinations[started] || !api.same(api.vm.peek(pc), imp)) {
            throw new Error('binary-twin-imp: a trail reached an unseeded cell or started out of order');
          }
          started++;
        }
      },
      final() {
        if (!api.entered()) return;
        if (started !== size) throw new Error('binary-twin-imp: both trails did not start');
        if (api.alone && (api.vm.processes(0).length !== size || !api.vm.processes(0).every(pc => api.same(api.vm.peek(pc), imp)))) {
          throw new Error('binary-twin-imp: the eight-process formation did not survive');
        }
      },
    };
  },
};

export default block;
