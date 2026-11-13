import selfhit from './lp-selfhit-scanner.js';

// Each limb first copies one cell of itself, then does a moving write. When
// the copy is complete, the SPL restarts the source and the JMZ enters the copy.
const modes = ['>', '}', '{', '<'];
const limbParams = {
  COUNT: [7, 40], HOP: [200, 7999], READ: [0, 7999], WRITE: [0, 7999],
  READMODE: [0, 3], WRITEMODE: [0, 3], STEP: [1, 7999], DRIFT: [0, 2],
};
const perLimb = (a, b) => Object.fromEntries([
  ...Object.entries(a).map(([k, v]) => [`A${k}`, v]),
  ...Object.entries(b).map(([k, v]) => [`B${k}`, v]),
]);
const limb = (P, side) => Object.fromEntries(Object.keys(limbParams).map((k) => [k, P[side + k]]));

function emitLimb({ ins, L }, side, P) {
  const label = (name) => L(side + name);
  ins(`${side}seed`, 'MOV', 'AB', `#${P.COUNT}`, '#7');
  ins(`${side}copy`, 'MOV', 'I', `<${label('seed')}`, `{${label('hop')}`);
  ins(`${side}hit`, 'MOV', 'I', `${modes[P.READMODE]}${P.READ}`, `${modes[P.WRITEMODE]}${P.WRITE}`);
  ins('', P.DRIFT ? 'ADD' : 'SUB', 'F', label(P.DRIFT === 2 ? 'hit' : 'home'), label('hit'));
  ins('', 'JMN', 'B', label('copy'), label('seed'));
  ins(`${side}home`, 'SPL', 'B', `@${label('seed')}`, `>${P.STEP}`);
  ins(`${side}hop`, 'JMZ', 'B', `${P.HOP}`, '*0');
}

const twin = {
  id: 'lp-twin-looping-paper', kind: 'body', exit: 'never', dialects: '94',
  processes: 2, grows: true, writes: 'sparse', roams: true, entry: 'start',
  purpose: 'Two counted-copy LP paper loops. Each has independent read/write modes, copy reach and restart stride. DRIFT subtracts the restart fields (0), adds them (1) or doubles the moving write fields (2). GAP separates the loaded limbs.',
  params: { GAP: [0, 32], SPLPTR: [1, 7999], ...perLimb(limbParams, limbParams) },
  defaults: {
    GAP: 8, SPLPTR: 3432,
    ...perLimb(
      { COUNT: 19, HOP: 2057, READ: 7960, WRITE: 1750, READMODE: 0, WRITEMODE: 1, STEP: 1148, DRIFT: 0 },
      { COUNT: 22, HOP: 4782, READ: 6992, WRITE: 5140, READMODE: 1, WRITEMODE: 2, STEP: 3477, DRIFT: 1 },
    ),
  },
  mismatches(P, { coreSize, maxProcesses, topology }) {
    if (coreSize !== 8000 || maxProcesses !== 8 || topology) return ['lp-twin-looping-paper needs the 8,000-cell, eight-process LP ring'];
    return [];
  },
  emit(ctx) {
    ctx.ins('start', 'SPL', 'B', ctx.L('Bcopy'), `<${ctx.P.SPLPTR}`);
    emitLimb(ctx, 'A', limb(ctx.P, 'A'));
    pad(ctx, ctx.P.GAP);
    emitLimb(ctx, 'B', limb(ctx.P, 'B'));
  },
  running(api) {
    const queue = api.vm.processes(0);
    return queue.some((pc) => api.inSelf(pc) || ['Acopy', 'Bcopy', 'Ahome', 'Bhome'].some((label) => api.same(api.vm.peek(pc), api.code(label))));
  },
  watch(api) {
    const visits = new Set();
    const copies = ['Acopy', 'Bcopy'].map((label) => [api.at(label), api.code(label)]);
    return {
      before(pc) {
        for (const [cell, code] of copies) if (pc === cell && api.same(api.vm.peek(pc), code)) visits.add(cell);
      },
      final() {
        if (api.alone && visits.size !== copies.length) throw new Error('lp-twin-looping-paper: both initial copy loops must run');
      },
    };
  },
};

function pad(ctx, count) {
  for (let i = 0; i < count; i++) ctx.ins('', 'DAT', 'F', '0', '0');
}

// The scanner intentionally shares the queue and may clear its paper partners.
// Its emitted code is shared with the solo scanner, whose watch expects all
// eight slots and therefore does not apply to this mixed body.
const scannerPaper = {
  ...twin,
  id: 'lp-twin-paper-scanner', entry: 'go', processes: 3, writes: 'core', attacks: 'all',
  purpose: 'Forks a guarded self-hit scanner beside a twin looping paper. SCANPAD separates the scanner from the papers. The scanner may clear its partners when it takes over the core.',
  params: { ...twin.params, SCANPAD: [0, 32], SCANSTEP: [1, 7999], SCANPROBES: [1, 8000], SCANGAP: [1, 64] },
  defaults: { ...twin.defaults, SCANPAD: 8, SCANSTEP: 36, SCANPROBES: 2000, SCANGAP: 18 },
  mismatches(P, settings) {
    return [...twin.mismatches(P, settings), ...selfhit.mismatches(scanParams(P), settings)];
  },
  emit(ctx) {
    ctx.ins('go', 'SPL', 'B', ctx.L('adv'));
    twin.emit(ctx);
    pad(ctx, ctx.P.SCANPAD);
    selfhit.emit({ ...ctx, P: scanParams(ctx.P) });
  },
  watch(api) {
    const paper = twin.watch(api), scanner = api.at('adv');
    let scanned = false;
    return {
      before(pc) {
        paper.before(pc);
        if (pc === scanner && api.same(api.vm.peek(pc), api.code('adv'))) scanned = true;
      },
      final() {
        paper.final();
        if (api.alone && !scanned) throw new Error('lp-twin-paper-scanner: the scanner did not start');
      },
    };
  },
};

function scanParams(P) {
  return { ...selfhit.defaults, STEP: P.SCANSTEP, PROBES: P.SCANPROBES, GAP: P.SCANGAP };
}

export default [twin, scannerPaper];
