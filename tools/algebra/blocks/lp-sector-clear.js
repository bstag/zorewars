export const sectorSlack = 24;
export const sectorTail = ['initialize', 'feed', 'hold', 'clear', 'check', 'resetMeter', 'resetCursor', 'meter', 'clearCursor'];

// Omitting the origin preserves the zero-A tail used by the transparent quartet.
export function emitSectorTail(ins, L, width, origin, pace = 0) {
  const cursor = L('clearCursor');
  const initial = origin === undefined ? `(${cursor}-${L('resetCursor')})` : `((${origin})-${cursor})`;
  ins('initialize', 'MOV', 'BA', '@0', L('meter'));
  ins('feed', 'SPL', 'B', '@0', L('clear'));
  for (let i = 0; i < pace; i++) ins(`pace${i}`, 'NOP', 'F', '$0', '$0');
  ins('hold', 'JMP', 'B', '@0', L('feed'));
  ins('clear', 'MOV', 'I', '@0', `>${cursor}`);
  ins('check', 'DJN', 'A', '@0', L('meter'));
  ins('resetMeter', 'MOV', 'BA', '@0', L('meter'));
  ins('resetCursor', 'MOV', origin === undefined ? 'B' : 'AB', origin === undefined ? '#0' : `#${initial}`, cursor);
  ins('meter', 'DAT', 'F', '#0', `#${width}`);
  ins('clearCursor', 'DAT', 'F', '#0', `#${initial}`);
}

const bounds = (P, label) => {
  const start = label('initialize') + P.START;
  return { start, end: start + P.WIDTH + sectorSlack };
};

const sectorClear = {
  id: 'lp-sector-clear',
  kind: 'body', exit: 'never', dialects: '94', processes: 1, grows: true, writes: 'sparse',
  entry: 'initialize',
  purpose: 'A persistent feeder issues optional DAT workers into a bounded sector, with a linked allowance for pending writes.',
  params: { START: [16, 7999], WIDTH: [32, 1850], PACE: [0, 3] },
  defaults: { START: 256, WIDTH: 1800, PACE: 0 },
  mutable: [['meter', ['a']], ['clearCursor', ['b']]],
  observationRole: 'sector-clear',
  phaseContract: { requiresReset: true, requiresFeederAtLimit: true },
  knowledge: {
    parameterRoles: {
      START: 'First target relative to entry', WIDTH: 'Counter width before allowing for pending writes',
      PACE: 'Number of extra turns on each feeder return. Changes FIFO competition without moving the sector.',
    },
    invariants: ['SPL keeps the feeder continuation ahead of the optional writer child.',
      'The linked sector includes 24 extra cells for queued writes before a reset.'],
    evidence: ['docs/lp-partitioned-quartet.md', 'docs/lp-sector-clear.md'],
  },
  mismatches(_, settings) {
    return settings.coreSize === 8000 && settings.maxProcesses === 8
      ? [] : ['lp-sector-clear requires an 8,000-cell ring and eight process slots'];
  },
  linked(P, settings, label, { total, shiftedFrame }) {
    if (shiftedFrame) return ['lp-sector-clear requires an unshifted linked frame'];
    const { start, end } = bounds(P, label);
    return start >= total && end <= settings.coreSize ? [] : ['lp-sector-clear sector overlaps the loaded image'];
  },
  linkedSectors(P, label) {
    return [bounds(P, label)];
  },
  emit({ ins, L, P }) {
    emitSectorTail(ins, L, P.WIDTH, `${L('initialize')}+${P.START}`, P.PACE);
  },
  running(api) {
    const feed = api.at('feed');
    const span = api.rel(api.at('clear'), feed);
    return api.vm.processes(0).some(pc => api.rel(pc, feed) < span);
  },
  observe(api) {
    let fullFeed = false;
    const resetFields = api.P.AIM ? ['a'] : [];
    return {
      before(event) {
        fullFeed = api.matches(event, 'feed') && api.processes().length === api.settings.maxProcesses;
      },
      after(event) {
        if (api.matches(event, 'feed')) {
          api.work('feeds');
          if (fullFeed) api.work('feeds-at-cap');
        }
        const target = event.operands[1]?.address;
        if (api.matches(event, 'clear') && api.wrote(event, target) && api.peek(target).op === 'DAT') {
          api.work('dat-writes', { target });
          api.phase('first-dat', { target });
        }
        if (api.matches(event, 'resetCursor', resetFields) && api.wrote(event, target)) {
          api.work('resets');
          api.phase('first-reset');
        }
      },
      finish() {
        const queue = api.processes();
        const feeder = ['feed', 'hold', ...Array.from({ length: api.P.PACE }, (_, i) => `pace${i}`)];
        return { feederAtLimit: feeder.some(label =>
          queue.includes(api.at(label)) && api.same(api.peek(api.at(label)), api.original(label))) };
      },
    };
  },
  verifyObservation(record, report) {
    const issues = [];
    if (!record.work.resets) issues.push('the clear did not reset its sector');
    if (!record.feederAtLimit || (record.work['dat-writes']?.lastCycle ?? -Infinity) < report.cycleLimit - 64) {
      issues.push('the feeder did not keep the clear working through the round limit');
    }
    return issues;
  },
  watch(api) {
    const { vm, at, P, norm, rel } = api;
    const first = norm(at('initialize') + P.START), writer = at('clear'), cursor = at('clearCursor');
    return {
      before(pc) {
        if (pc !== writer) return null;
        const target = norm(cursor + vm.peek(cursor).b);
        if (rel(target, first) >= P.WIDTH + sectorSlack || api.inImage(target)) {
          throw new Error('lp-sector-clear wrote outside its linked sector');
        }
        return target;
      },
      after(target) {
        if (target === null) return;
        if (vm.writerPc[target] !== writer || vm.lastWrite[target] !== vm.steps || vm.peek(target).op !== 'DAT') {
          throw new Error('lp-sector-clear did not deliver its DAT write');
        }
      },
    };
  },
};

const corridor = (P, label) => {
  const start = label('aimStart') + P.START;
  return { start, end: start + P.CORRIDOR };
};

const probeSector = {
  ...sectorClear,
  id: 'lp-probe-sector',
  entry: 'aimStart',
  needs: ['probe'],
  purpose: 'Uses a quickscan hit to aim a bounded DAT sector inside a reserved corridor, with a fixed fallback.',
  params: { ...sectorClear.params, CORRIDOR: [56, 7984], AIM: [0, 1] },
  defaults: { ...sectorClear.defaults, WIDTH: 512, CORRIDOR: 6800, AIM: 1 },
  mutable: [...sectorClear.mutable, ['distance', ['b']], ['resetCursor', ['a']]],
  observationRole: 'probe-sector',
  knowledge: {
    ...sectorClear.knowledge,
    parameterRoles: {
      ...sectorClear.knowledge.parameterRoles,
      CORRIDOR: 'Reserve all possible target strips and their pending-write room.',
      AIM: 'With 0 keep the fixed start while executing the same target selection and timing.',
    },
    evidence: ['docs/lp-probe-sector.md'],
  },
  mismatches(P, settings) {
    return [
      ...sectorClear.mismatches(P, settings),
      ...(P.CORRIDOR < P.WIDTH + sectorSlack ? ['lp-probe-sector corridor is too short for its sweep and pending writes'] : []),
    ];
  },
  linked(P, settings, label, { total, shiftedFrame }) {
    if (shiftedFrame) return ['lp-probe-sector requires an unshifted linked frame'];
    const { start, end } = corridor(P, label);
    return start >= total && end <= settings.coreSize ? [] : ['lp-probe-sector corridor overlaps the loaded image'];
  },
  linkedSectors(P, label) {
    return [corridor(P, label)];
  },
  emit(ctx) {
    const { ins, L, P, span } = ctx;
    const probe = ctx.ref('probe'), scratch = L('distance'), cursor = L('clearCursor');
    const origin = `${L('aimStart')}+${P.START}`;
    ins('aimStart', 'SNE', 'AB', `#${span}`, probe);
    ins('', 'JMP', 'B', L('initialize'));
    ins('', 'MOV', 'B', probe, scratch);
    ins('', 'ADD', 'AB', `#(${probe}-(${origin}))`, scratch);
    ins('', 'SLT', 'B', scratch, `#${P.CORRIDOR - P.WIDTH - sectorSlack + 1}`);
    ins('', 'JMP', 'B', L('initialize'));
    ins('accepted', 'ADD', 'AB', `#(${origin}-${cursor})`, scratch);
    ins('aimCursor', P.AIM ? 'MOV' : 'NOP', P.AIM ? 'B' : 'F', scratch, cursor);
    ins('', P.AIM ? 'MOV' : 'NOP', P.AIM ? 'BA' : 'F', scratch, L('resetCursor'));
    ins('', 'JMP', 'B', L('initialize'));
    ins('distance', 'DAT', 'F', '#0', '#0');
    emitSectorTail(ins, L, P.WIDTH, origin, P.PACE);
  },
  observe(api) {
    const observer = sectorClear.observe(api);
    return {
      ...observer,
      after(event) {
        observer.after(event);
        if (api.matches(event, 'accepted')) {
          api.phase('accepted-probe', { target: api.norm(api.at('clearCursor') + api.peek(api.at('distance')).b) });
        }
      },
    };
  },
  watch(api) {
    const { vm, at, P, norm, rel } = api;
    const origin = norm(at('aimStart') + P.START), writer = at('clear'), cursor = at('clearCursor');
    let first = origin, entered = false, wrote = false;
    return {
      before(pc) {
        if (pc === at('aimStart') && !entered) {
          entered = true;
          const probe = api.ref('probe'), offset = vm.peek(probe).b;
          const target = norm(probe + offset);
          const miss = vm.peek(at('aimStart')).a;
          if (P.AIM && offset !== miss && rel(target, origin) + P.WIDTH + sectorSlack <= P.CORRIDOR) {
            first = target;
          }
        }
        if (pc !== writer) return null;
        const target = norm(cursor + vm.peek(cursor).b);
        if ((!wrote && target !== first) || rel(target, first) >= P.WIDTH + sectorSlack || api.inImage(target)) {
          throw new Error('lp-probe-sector wrote outside its selected sector');
        }
        return target;
      },
      after(target) {
        if (target === null) return;
        if (vm.writerPc[target] !== writer || vm.lastWrite[target] !== vm.steps || vm.peek(target).op !== 'DAT') {
          throw new Error('lp-probe-sector did not deliver its DAT write');
        }
        wrote = true;
      },
    };
  },
};

export default [sectorClear, probeSector];
