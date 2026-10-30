// Imps and the defence against them: a single imp, an imp ring with a counted
// launcher, an imp spiral started by a vector launch, and a decrement gate.
// How to write a block: docs/block-algebra.md.
//
// Every imp here is MOV 0, STEP. An N-point ring or spiral needs N * STEP = 1
// (mod core), so its STEP is modInverse(N, core): the k-th imp execution of
// the whole ring then lands on start + k * STEP, and each lap moves on a cell.
// The launchers share one idea: the processes that will become imps reach a
// JMP @vector in one pass of the queue, each followed by a process that ADDs
// STEP to the vector, so consecutive jumpers land STEP apart; the adders then
// die on the vector cell. All imps must start in the same pass, or the first
// one runs into a cell its ring has not written yet.
import { modInverse } from '../util.js';

const IMP = { kind: 'body', exit: 'never', writes: 'sparse', roams: true, layout: 'last' };

// Points of an N-point ring with m processes: process i starts at i * STEP.
// Refuse a point that lands just behind the imp, on the code that launched it.
function pointMismatches(n, m, settings) {
  const core = settings.coreSize, step = modInverse(n, core);
  if (!step) return [`no ${n}-point imp ring on a ${core}-cell core`];
  const out = [];
  if (m < n) out.push('fewer imps than points');
  for (let i = 1; i < m; i++) {
    const d = (i * step) % core;
    if (d > core - settings.maxLength) { out.push(`a ${n}-point imp lands on the launcher`); break; }
  }
  return out;
}

// The tail both launchers end in: interleaved jumpers and adders, the vector, the imp.
function vectorTail(ctx, p) {
  const { L, core } = ctx, step = modInverse(ctx.P.N, core);
  ctx.ins(`${p}Split`, 'SPL', 'B', L(`${p}Add`));           // a jumper, then an adder
  ctx.ins(`${p}Jump`, 'JMP', 'B', `@${L(`${p}Vec`)}`);
  ctx.ins(`${p}Add`, 'ADD', 'AB', `#${step}`, L(`${p}Vec`));
  ctx.ins(`${p}Vec`, 'DAT', 'F', '#0', `#${L(`${p}Imp`)}-${L(`${p}Vec`)}`);   // adders die here
  ctx.ins(`${p}Imp`, 'MOV', 'I', '0', `${step}`);
}

const imps = {
  imp: {
    ...IMP, processes: 1,
    purpose: 'One MOV 0, 1 imp: crawls through the whole core forever. The smallest body; a partner that is hard to kill.',
    params: {}, entry: 'imp',
    emit(ctx) { ctx.ins('imp', 'MOV', 'I', '0', '1'); },
  },
  'imp-ring': {
    ...IMP,
    purpose: 'An N-point imp ring, one process per point, STEP = (k * core + 1) / N apart. A counted loop parks N processes, the count reaching zero frees them in one pass, and a vector jump sends each to its point.',
    params: { N: [3, 23] }, entry: 'rLaunch',
    processes: (P) => 2 * P.N,                    // N parked processes, each split into a jumper and an adder
    mismatches: (P, settings) => pointMismatches(P.N, P.N, settings),
    emit(ctx) {
      const { L, P } = ctx;
      ctx.ins('rLaunch', 'SPL', 'B', L('rPark'));
      ctx.ins('', 'DJN', 'B', L('rLaunch'), L('rCount'));
      ctx.ins('rCount', 'DAT', 'F', '#0', `#${P.N}`);          // the launcher dies here once its count is zero
      ctx.ins('rPark', 'JMN', 'B', L('rPark'), L('rCount'));   // parked until the count reaches zero
      vectorTail(ctx, 'r');
    },
  },
  'vector-spiral': {
    ...IMP,
    purpose: 'An N-point imp spiral of 2^K imps, STEP = modInverse(N, core): K SPLs, then a vector jump whose adders step it by STEP. Ten cells whatever the imp count.',
    params: { N: [3, 31], K: [1, 6] }, entry: 'vStart',
    processes: (P) => 2 ** (P.K + 1),             // 2^K jumpers and 2^K adders; the adders die
    mismatches: (P, settings) => pointMismatches(P.N, 2 ** P.K, settings),
    emit(ctx) {
      for (let i = 0; i < ctx.P.K; i++) ctx.ins(i ? '' : 'vStart', 'SPL', 'B', '1');
      vectorTail(ctx, 'v');
    },
  },
  'imp-gate': {
    kind: 'body', exit: 'never', writes: 'sparse', roams: false, loop: 'gLoop',
    purpose: 'Decrement gate: 2^GK processes loop on JMP 0, <gate, where the gate is GATE cells before the warrior. An imp that writes itself onto the gate runs MOV 0, 0 and steps into the empty cell after it. It stops an imp only when it runs in the imp\'s one-turn window, so it works best with few partner processes.',
    params: { GATE: [2, 40], GK: [0, 2] }, entry: 'gStart',
    processes: (P) => 2 ** P.GK,
    emit(ctx) {
      const { P } = ctx;
      for (let i = 0; i < P.GK; i++) ctx.ins(i ? '' : 'gStart', 'SPL', 'B', '1');
      if (!P.GK) ctx.mark('gStart');
      // The gate is GATE cells before the first cell of the warrior, so it never touches a partner's code.
      ctx.ins('gLoop', 'JMP', 'B', '0', `<${-ctx.pc() - P.GATE}`);
    },
  },
};

for (const [id, b] of Object.entries(imps)) {
  b.id = id;
  b.defaults ??= Object.fromEntries(Object.entries(b.params).map(([k, [lo]]) => [k, lo]));
}
// Defaults that work on both the 8,000 and the 55,440 cores (13 has an inverse on both).
Object.assign(imps['imp-ring'].defaults, { N: 13 });
Object.assign(imps['vector-spiral'].defaults, { N: 13, K: 4 });
Object.assign(imps['imp-gate'].defaults, { GATE: 3, GK: 0 });

// Moving bodies run in copies of their imp, not in their code.
const runsImp = (label) => (api) => api.vm.processes(0).some((q) => api.same(api.vm.peek(q), api.code(label)));
imps.imp.running = runsImp('imp');
imps['imp-ring'].running = runsImp('rImp');
imps['vector-spiral'].running = runsImp('vImp');

imps.imp.watch = (api) => ({
  final: () => {
    if (!api.alone) return;
    const procs = api.vm.processes(0), imp = api.code('imp');
    if (procs.length !== 1 || !api.same(api.vm.peek(procs[0]), imp)) throw new Error('The imp is not running');
    // Alone for the whole round, it has crawled over every cell.
    for (let c = 0; c < api.core; c++) if (!api.same(api.vm.peek(c), imp)) throw new Error('The imp did not cover the core');
  },
});

// A ring or spiral alone: every imp alive, and in queue order the imps stand
// STEP apart (one break where the processes that have run this pass end).
function ringWatch(label, count) {
  return (api) => ({
    final: () => {
      if (!api.alone) return;
      const procs = api.vm.processes(0), imp = api.code(label), want = count(api.P);
      if (procs.length !== want) throw new Error(`The imps lost processes on their own (${procs.length} of ${want})`);
      if (!procs.every((q) => api.same(api.vm.peek(q), imp))) throw new Error('A process left the imp');
      const step = api.norm(imp.b);
      let breaks = 0;
      for (let i = 1; i < procs.length; i++) if (api.norm(procs[i] - procs[i - 1]) !== step) breaks++;
      if (breaks > 1) throw new Error('The imps are not STEP apart: the launch was out of step');
    },
  });
}
imps['imp-ring'].watch = ringWatch('rImp', (P) => P.N);
imps['vector-spiral'].watch = ringWatch('vImp', (P) => 2 ** P.K);

// The gate: every pass of the loop decrements the gate cell. In the planted
// scenario an imp (MOV 0, 1) heads at the gate and is played as the opponent,
// one step after each of ours, as the VM alternates two warriors. It must die
// before it reaches the warrior. When the gate runs alone it has the imp's
// one-turn window every time, so the first imp must die; beside partners it
// may miss a pass, so the imp is sent again from a little further back (as if
// on its next lap) until it dies, at most 32 times.
const PLANT = 8;
const IMP_CELL = { op: 'MOV', mod: 'I', aMode: '$', a: 0, bMode: '$', b: 1 };
imps['imp-gate'].plant = (api) => {
  const gate = api.norm(api.at('gLoop') + api.code('gLoop').b);
  return [[gate - PLANT, IMP_CELL]];
};
imps['imp-gate'].watch = (api) => {
  const gateAt = () => api.norm(api.at('gLoop') + api.code('gLoop').b);
  const planted = api.scenario === 'imp-gate: planted target';
  let hits = 0, firstHit = null;
  let imp = null, tries = 0, stopped = false, escaped = null;
  const launch = () => { tries++; imp = api.norm(gateAt() - PLANT - (tries - 1)); api.vm.poke(imp, IMP_CELL); };
  // One step of the opponent's imp process.
  const impStep = () => {
    const x = api.vm.peek(imp);
    if (x.op === 'DAT') { stopped = true; imp = null; return; }
    if (api.inImage(imp) || x.op !== 'MOV' || x.aMode !== '$' || api.norm(x.a) !== 0 || x.bMode !== '$') {
      // Past the gate: it would run over the warrior.
      const strict = api.vm.processes(0).every((q) => api.inSelf(q));
      if (strict || tries >= 32) { escaped = strict ? 'with the gate running alone' : `${tries} times`; imp = null; return; }
      launch();
      return;
    }
    api.vm.poke(imp + x.b, x);
    imp = api.norm(imp + 1);
  };
  return {
    before: (pc) => (pc === api.at('gLoop') && api.same(api.vm.peek(pc), api.code('gLoop')) ? api.vm.peek(gateAt()).b : null),
    after: (b) => {
      if (b !== null) {
        if (api.vm.peek(gateAt()).b !== api.norm(b - 1)) throw new Error('The gate loop did not decrement its gate cell');
        hits++;
        firstHit ??= api.vm.cycle;
      }
      if (!planted || stopped || escaped) return;
      if (imp === null && hits) launch();      // the gate is running: send the imp
      if (imp !== null) impStep();
    },
    final: () => {
      if (api.alone && hits < api.vm.cycle - firstHit) throw new Error('The gate was not hit on every pass');
      if (!api.alone && hits < 100) throw new Error('The gate was hardly hit');
      if (planted && escaped) throw new Error(`An imp got past the gate (${escaped})`);
      if (planted && !stopped) throw new Error('The planted imp was never stopped');
    },
  };
};

export default Object.values(imps);
