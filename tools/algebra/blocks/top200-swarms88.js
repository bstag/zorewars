import { modInverse } from '../util.js';

// Ports of the launch mechanisms in Morrell's Imps! Imps! Imps! and Moore's
// Hordes of Microwarriors and Leviathan. The public hill sources and the
// relationship to the other launch blocks are in docs/tw2027-88-block-gaps.md.
const burst = {
  id: 'repeat-burst-imp-88', kind: 'body', exit: 'never', entry: 'feed',
  entryFirst: false, processes: 1, grows: true, writes: 'sparse', roams: true,
  purpose: 'A persistent feeder reseeds a moving origin and repeatedly dispatches a binary fan of imp jumpers through one interleaved launch vector.',
  params: { POINTS: [3, 23], FAN: [2, 5], SHIFT: [32, 1800] },
  defaults: { POINTS: 7, FAN: 4, SHIFT: 260 },
  mutable: [['seed', ['b']]],
  mismatches(P, { coreSize, maxProcesses }) {
    const errors = [];
    if (!modInverse(P.POINTS, coreSize)) errors.push('repeat-burst-imp-88: no modular imp step for POINTS');
    if (maxProcesses < 4 * 2 ** P.FAN) errors.push('repeat-burst-imp-88: too few process slots for repeated bursts');
    return errors;
  },
  emit(ctx) {
    const { L, P, core } = ctx, step = modInverse(P.POINTS, core);
    ctx.ins('imp', 'MOV', 'I', '0', String(step));
    ctx.ins('feed', 'SPL', 'B', '0');
    ctx.ins('seed', 'MOV', 'I', L('imp'), String(P.FAN + 6));
    ctx.ins('shift', 'ADD', 'AB', `#${P.SHIFT}`, L('seed'));
    for (let i = 0; i < P.FAN; i++) ctx.ins('', 'SPL', 'B', '1');
    ctx.ins('', 'SPL', 'B', '2');
    ctx.ins('jump', 'JMP', 'B', `@${L('seed')}`);
    ctx.ins('step', 'ADD', 'AB', `#${step}`, L('seed'));
  },
  running({ vm, at, same, code }) {
    return vm.processes(0).some((pc) => pc === at('feed') || same(vm.peek(pc), code('imp')));
  },
  watch({ vm, at, code, norm, P, same, entered }) {
    const seed = at('seed'), jump = at('jump');
    const step = code('imp').b, width = 2 ** P.FAN;
    let seeds = 0, launches = 0, previous = null, firstSeed = null;
    return {
      before(pc) {
        if (pc === seed && seeds < 2) return { copy: norm(seed + vm.peek(seed).b) };
        if (pc !== jump || launches >= 2 * width) return null;
        const target = norm(seed + vm.peek(seed).b);
        if (launches % width && target !== norm(previous + step)) {
          throw new Error('repeat-burst-imp-88: successive siblings did not launch one imp step apart');
        }
        previous = target;
        launches++;
        return null;
      },
      after(event) {
        if (!event) return;
        if (!same(vm.peek(event.copy), code('imp')) || vm.writerPc[event.copy] !== seed) {
          throw new Error('repeat-burst-imp-88: the feeder did not seed an imp');
        }
        if (seeds && event.copy !== norm(firstSeed + P.SHIFT)) {
          throw new Error('repeat-burst-imp-88: the seed did not move by SHIFT');
        }
        firstSeed ??= event.copy;
        seeds++;
      },
      final() {
        if (entered() && (seeds < 2 || launches < 2 * width)) {
          throw new Error('repeat-burst-imp-88: two bursts did not launch');
        }
      },
    };
  },
};

const microwarriors = {
  id: 'microwarrior-swarm-88', kind: 'body', exit: 'never', entry: 'launch',
  processes: 1, grows: true, writes: 'sparse', attacks: 'all', roams: true,
  purpose: 'A compact swarm that advances a shared worker pointer, places remote DJN workers and dispatches processes into them.',
  params: { FIRST: [200, 7600], STEP: [500, 7500], STREAM: [100, 7900] },
  defaults: { FIRST: 978, STEP: 2201, STREAM: 6970 },
  mismatches(_, { coreSize }) {
    return coreSize === 8000 ? [] : ['microwarrior-swarm-88: this layout needs 8,000 cells'];
  },
  mutable: [['store', ['b']]],
  emit(ctx) {
    const { L, P } = ctx;
    ctx.ins('launch', 'SPL', 'B', '1');
    ctx.ins('', 'SPL', 'B', '1');
    ctx.ins('', 'MOV', 'I', '-1', '0');
    ctx.ins('feeder', 'SPL', 'B', '0', '<2');
    ctx.ins('', 'MOV', 'I', '0', '<1');
    ctx.ins('store', 'MOV', 'I', L('worker'), String(P.FIRST));
    ctx.ins('', 'ADD', 'AB', `#${P.STEP}`, '@-2');
    ctx.ins('', 'MOV', 'I', L('feeder'), '@-2');
    ctx.ins('dispatch', 'JMP', 'B', `@${L('store')}`);
    ctx.ins('worker', 'DJN', 'B', '-2', `#${P.STREAM}`);
  },
  running: ({ vm }) => vm.warriors[0].alive,
  watch({ vm, at, norm, same, code, entered }) {
    const store = at('store'), dispatch = at('dispatch');
    const workers = new Set();
    let launched = false, ranRemote = false;
    return {
      before(pc) {
        if (workers.has(pc) && vm.peek(pc).op === 'DJN') ranRemote = true;
        if (pc === dispatch) launched = true;
        if (pc === store && workers.size < 24) return norm(store + vm.peek(store).b);
        return null;
      },
      after(target) {
        if (target === null) return;
        if (vm.writerPc[target] === store && same(vm.peek(target), code('worker'))) workers.add(target);
      },
      final() {
        if (entered() && (workers.size < 2 || !launched || !ranRemote)) {
          throw new Error('microwarrior-swarm-88: the remote workers were not written and run');
        }
      },
    };
  },
};

const mod = (x, n) => ((x % n) + n) % n;
const leafLabel = (i) => `deploy${i}`;
const branchLabel = (i, size) => size === 1 ? leafLabel(i) : `branch${i}x${size}`;

const leviathan = {
  id: 'leviathan-launch-88', kind: 'body', exit: 'never', entry: 'launch',
  processes: 1, grows: true, writes: 'core', attacks: 'all', roams: true,
  purpose: 'A binary launch tree boots four-cell Gymnosperm-derived heads at fixed intervals, with a separate set of staggered startup decrements.',
  params: { FAN: [1, 3], START: [64, 1800], GAP: [300, 1700], TRAIL: [150, 2200], STREAM: [70, 1400] },
  defaults: { FAN: 3, START: 100, GAP: 918, TRAIL: 653, STREAM: 267 },
  mutable: (P) => Array.from({ length: 2 ** P.FAN }, (_, i) => [leafLabel(i), ['b']]),
  mismatches(P, { coreSize, maxLength }) {
    const size = 2 ** P.FAN;
    if (coreSize !== 8000) return ['leviathan-launch-88: this deployment needs 8,000 cells'];
    const cells = new Set();
    for (let i = 0; i < size; i++) for (let j = 0; j < 4; j++) {
      const target = mod(P.START + i * P.GAP - j, coreSize);
      // A launch tree plus any preceding or following data must stay clear of the destinations.
      if (target < 6 * size + 3 || target >= coreSize - maxLength || cells.has(target)) {
        return ['leviathan-launch-88: a head overlaps the image or another head'];
      }
      cells.add(target);
    }
    return [];
  },
  emit(ctx) {
    const { L, P } = ctx;
    const heads = 2 ** P.FAN;
    let tick = 0;
    const stream = () => `<${4200 + 200 * tick++}`;
    const emitBranch = (i, count) => {
      const label = count === heads ? 'launch' : branchLabel(i, count);
      if (count === 1) {
        ctx.ins(label, 'MOV', 'I', L('headBack'), `${L('launch')}+${P.START + i * P.GAP}`);
        ctx.ins('', 'MOV', 'I', L('headDrop'), `<${L(label)}`);
        ctx.ins('', 'MOV', 'I', L('headLay'), `<${L(label)}`);
        ctx.ins('', 'MOV', 'I', L('headSplit'), `<${L(label)}`);
        ctx.ins(`enter${i}`, 'DJN', 'B', `@${L(label)}`, stream());
        return;
      }
      const half = count / 2;
      ctx.ins(label, 'SPL', 'B', L(branchLabel(i + half, half)), stream());
      emitBranch(i, half);
      emitBranch(i + half, half);
    };
    emitBranch(0, heads);
    ctx.ins('headSplit', 'SPL', 'B', '0', `<${-P.STREAM}`);
    ctx.ins('headLay', 'MOV', 'I', '1', '<1');
    ctx.ins('headDrop', 'MOV', 'I', '<0', `<${-P.TRAIL}`);
    ctx.ins('headBack', 'DJN', 'B', '-3', `<${-P.STREAM - 3}`);
  },
  running: ({ vm }) => vm.warriors[0].alive,
  watch({ vm, at, norm, same, code, P, entered }) {
    const count = 2 ** P.FAN, dispatched = new Set(), ran = new Set();
    const template = ['headSplit', 'headLay', 'headDrop', 'headBack'].map((label) => code(label));
    const heads = Array.from({ length: count }, (_, i) => {
      const pc = at(`enter${i}`);
      return { pc, target: norm(at('launch') + P.START + i * P.GAP - 3) };
    });
    return {
      before(pc) {
        const head = heads.find((h) => h.pc === pc);
        if (head) {
          if (!template.every((ins, i) => same(vm.peek(norm(head.target + i)), ins))) {
            throw new Error('leviathan-launch-88: dispatch ran before the head was ready');
          }
          dispatched.add(head.target);
        }
        if (dispatched.has(pc) && vm.peek(pc).op === 'SPL') ran.add(pc);
      },
      final() {
        if (entered() && (dispatched.size !== count || ran.size !== count)) {
          throw new Error('leviathan-launch-88: not all of the remote heads ran');
        }
      },
    };
  },
};

export default [burst, microwarriors, leviathan];
