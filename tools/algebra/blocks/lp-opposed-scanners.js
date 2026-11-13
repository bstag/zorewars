const core = 8000;
const defaultStep = 80;
const periodFor = P => core / P.STEP;
const scanTemplate = ['advance', 'look', 'attack', 'return', 'bomb', 'pointer'];
const clearTemplate = ['advance', 'look', 'attack', 'guard', 'kill', 'sweep', 'meter',
  'resetCursor', 'resetMeter', 'again', 'return', 'bomb', 'pointer', 'dat', 'cursor', 'hits'];
const aimSetup = ['measure', 'origin', 'orient', 'limit', 'skipAim', 'aim', 'offset', 'saveAim', 'startSweep',
  'fixed', 'fixedWait1', 'fixedWait2'];
const aimedTemplate = [...clearTemplate.slice(0, 5), ...aimSetup, ...clearTemplate.slice(5)];
const burstTemplate = ['advance', 'look', 'attack', 'guard', 'seedBurst', 'shiftBurst', 'burst',
  'burstMeter', 'resetBurst', 'rearm', 'return', 'bomb', 'pointer', 'dat', 'cursor', 'hits'];
const inlineTemplate = ['advance', 'look', 'attack', 'burst', 'return', 'bomb', 'pointer', 'dat'];
const usesBurst = P => P.HANDOFF === 4 || P.HANDOFF === 5;
const usesInline = P => P.HANDOFF >= 6;
const templateFor = P => {
  if (P.HANDOFF < 0) return scanTemplate;
  if (usesInline(P)) return inlineTemplate;
  if (usesBurst(P)) return burstTemplate;
  return P.AIM ? aimedTemplate : clearTemplate;
};
const defaultSweep = 120;
const aimCorridor = 1800;
const sweepDirection = (P, site) => P.OUTWARD ? site.direction : -1;
const sweepOffset = (direction, size, index) => direction < 0 ? -1 - index : size + index;
const wrap = value => ((value % core) + core) % core;
const layout = ({ SHIFT, START, SPREAD }) => [
  { hop: 2000, start: START, direction: -1 },
  { hop: 2160, start: START + SPREAD, direction: 1 },
  { hop: 2000 + SHIFT, start: START, direction: -1 },
  { hop: 2160 + SHIFT, start: START + SPREAD, direction: 1 },
];
const key = (direction, label) => `${direction < 0 ? 'back' : 'fore'}${label}`;

const lpOpposedScanners = {
  id: 'lp-opposed-scanners',
  kind: 'body', exit: 'never', dialects: '94', processes: 4, writes: 'sparse', roams: true,
  entry: 'launch',
  purpose: 'Two loaders deploy four opposed A-field scanners. Each probe lane avoids friendly code. Optional guards send individual scanners into bounded DAT sweeps.',
  params: { SHIFT: [3800, 4100], START: [1, 79], SPREAD: [0, 20], TRAP: [0, 1], STEP: [32, 80], UNROLL: [1, 2],
    HANDOFF: [-1, 7], HITS: [1, 100], SWEEP: [1, 3800], OUTWARD: [0, 1], AIM: [0, 2], BURSTSKIP: [0, 1] },
  defaults: { SHIFT: 4001, START: 57, SPREAD: 0, TRAP: 1, STEP: defaultStep, UNROLL: 2, HANDOFF: -1, HITS: 1,
    SWEEP: defaultSweep, OUTWARD: 0, AIM: 0, BURSTSKIP: 0 },
  mutable: [-1, 1].flatMap(direction =>
    [...['pointer', 'source', 'split', 'go', 'count', 'cursor', 'meter', 'hits', 'guard', 'burstMeter']
      .map(label => [key(direction, label), ['b']]), [key(direction, 'resetCursor'), ['a']]]),
  observationRole: 'opposed-scanners',
  knowledge: {
    parameterRoles: {
      SHIFT: 'Distance between the two pairs. Odd values separate their probe parities.',
      START: 'Initial probe offset in the backward scanner', SPREAD: 'Additional initial probe offset in the forward scanner',
      STEP: 'Even divisor of the core. Smaller steps lengthen the orbit if the lane still excludes friendly code.',
      UNROLL: 'Copy one or two cells per site before the boot counter advances.',
      TRAP: 'Use a zero-field JMP with 1 or a zero-field DAT with 0',
      HANDOFF: '−1 compact scanner, 0 rescan, 1 probe guard, 2 trap guard, 3 counted sweep, 4 counted DAT burst, 5 NOP burst, 6 inline DAT, 7 inline NOP',
      HITS: 'Number of strikes before the counted handoff. Each scanner has its own counter.',
      SWEEP: 'Number of cells covered by a sweep pass or by a burst.',
      OUTWARD: 'Use the scan direction for each clear with 1. With 0 all four clear backward.',
      AIM: '0 original layout, 1 fixed-origin control with aiming code present, 2 aim at the last strike if the full strip fits',
      BURSTSKIP: 'Start a counted burst one cell beyond the strike with 1, leaving the JMP lock in place.',
    },
    invariants: ['The signed step includes the probe predecrement.', 'Each lane covers CORESIZE / STEP cells and excludes every friendly body.'],
    evidence: ['docs/lp-disciples.md'],
  },
  mismatches(P, settings) {
    if (settings.coreSize !== core || settings.maxProcesses !== 8) {
      return ['lp-opposed-scanners requires an 8,000-cell ring with eight process slots'];
    }
    if (P.STEP % 2 || core % P.STEP) return ['lp-opposed-scanners needs an even step dividing the core'];
    if (P.AIM && (P.HANDOFF < 0 || !P.OUTWARD || P.SWEEP > aimCorridor)) {
      return ['lp-opposed-scanners aiming requires an outward clear layout and a sweep of at most 1,800 cells'];
    }
    if (usesBurst(P) && (P.AIM || P.SWEEP > P.STEP)) {
      return ['lp-opposed-scanners bursts require AIM 0 and a width of at most one probe step'];
    }
    if (usesInline(P) && P.AIM) return ['lp-opposed-scanners inline follow-ups require AIM 0'];
    return [];
  },
  linked(P, _settings, label, { total, shiftedFrame }) {
    if (shiftedFrame) return ['lp-opposed-scanners needs an unshifted image'];
    const origin = label('launch');
    const sites = layout(P).map(site => ({ ...site, base: wrap(origin + site.hop) }));
    const size = templateFor(P).length;
    const residue = value => wrap(value) % P.STEP;
    const occupied = new Set(Array.from({ length: total }, (_, cell) => cell));
    for (const { base } of sites) {
      for (let i = 0; i < size; i++) occupied.add(wrap(base + i));
    }
    const friendly = new Set([...occupied].map(residue));
    const lanes = sites.map(({ base, start }) => residue(base + start));
    if (lanes.some(lane => friendly.has(lane))) {
      return ['lp-opposed-scanners: a probe lane intersects a friendly image'];
    }
    if ((P.HANDOFF === 3 || usesBurst(P)) && new Set(lanes).size !== sites.length) {
      return ['lp-opposed-scanners: the counted handoff needs four distinct probe lanes'];
    }
    if (usesBurst(P)) {
      const overlaps = sites.some((site, i) => Array.from({ length: P.SWEEP }, (_, j) =>
        residue(lanes[i] + (P.BURSTSKIP + j) * sweepDirection(P, site))).some(target => friendly.has(target)));
      return overlaps ? ['lp-opposed-scanners: a burst from this probe lane intersects friendly code'] : [];
    }
    if (P.HANDOFF >= 0 && !usesInline(P) && sites.some(site => {
      const direction = sweepDirection(P, site);
      return Array.from({ length: P.AIM ? aimCorridor : P.SWEEP }, (_, i) => wrap(site.base + sweepOffset(direction, size, i)))
        .some(target => occupied.has(target));
    })) return ['lp-opposed-scanners: a clear strip intersects friendly code'];
    return [];
  },
  emit({ L, P, ins }) {
    const sites = layout(P);
    const template = templateFor(P), size = template.length;
    ins('launch', 'SPL', 'B', L('forecopy'));
    for (const direction of [-1, 1]) {
      const local = label => key(direction, label);
      const ref = label => L(local(label));
      const site = sites.filter(site => site.direction === direction);
      for (let i = 0; i < P.UNROLL; i++) {
        ins(i ? '' : local('copy'), 'MOV', 'I', `<${ref('source')}`, `<${ref('split')}`);
        ins('', 'MOV', 'I', `@${ref('source')}`, `<${ref('go')}`);
      }
      ins(local('count'), 'DJN', 'B', ref('copy'), `#${size / P.UNROLL}`);
      ins(local('split'), 'SPL', 'B', `@${ref('split')}`, `${L('launch')}+${site[0].hop + size}`);
      ins(local('go'), 'JMP', 'B', `@${ref('go')}`, `${L('launch')}+${site[1].hop + size}`);
      ins(local('source'), 'DAT', 'F', '#0', `${ref('advance')}+${size}`);
    }
    for (const direction of [-1, 1]) {
      const local = label => key(direction, label);
      const ref = label => L(local(label));
      const { start } = sites.find(site => site.direction === direction);
      const sweepForward = sweepDirection(P, { direction }) > 0;
      const sweepStart = sweepForward ? `${ref('advance')}+${size}` : ref('advance');
      ins(local('advance'), 'ADD', 'AB', `#${direction * P.STEP + 1}`, ref('pointer'));
      ins(local('look'), 'JMZ', 'A', ref('advance'), `<${ref('pointer')}`);
      ins(local('attack'), 'MOV', 'I', ref('bomb'), `${P.HANDOFF < 0 ? '>' : '@'}${ref('pointer')}`);
      if (P.HANDOFF >= 0 && !usesInline(P)) {
        const guard = P.HANDOFF === 1 ? ref('look') : `@${ref('pointer')}`;
        if (P.HANDOFF >= 3) ins(local('guard'), 'DJN', 'B', ref('return'), ref('hits'));
        else ins(local('guard'), P.HANDOFF ? 'JMN' : 'JMP', P.HANDOFF ? 'A' : 'B', ref('return'), guard);
      }
      if (usesInline(P)) {
        ins(local('burst'), P.HANDOFF === 6 ? 'MOV' : 'NOP', P.HANDOFF === 6 ? 'I' : 'F',
          ref('dat'), `@${ref('pointer')}`);
      } else if (usesBurst(P)) {
        ins(local('seedBurst'), 'MOV', 'B', ref('pointer'), ref('cursor'));
        const adjustment = sweepForward ? P.BURSTSKIP : 1 - P.BURSTSKIP;
        ins(local('shiftBurst'), 'ADD', 'AB', `#(${ref('pointer')}-${ref('cursor')}+${adjustment})`, ref('cursor'));
        ins(local('burst'), P.HANDOFF === 4 ? 'MOV' : 'NOP', P.HANDOFF === 4 ? 'I' : 'F',
          ref('dat'), `${sweepForward ? '>' : '<'}${ref('cursor')}`);
        ins(local('burstMeter'), 'DJN', 'B', ref('burst'), `#${P.SWEEP}`);
        ins(local('resetBurst'), 'MOV', 'AB', `#${P.SWEEP}`, ref('burstMeter'));
        ins(local('rearm'), 'MOV', 'AB', `#${P.HITS}`, ref('hits'));
      } else if (P.HANDOFF >= 0) {
        // A missed guard enters the clear; a successful guard skips over it through return.
        ins(local('kill'), 'MOV', 'I', ref('dat'), `@${ref('pointer')}`);
        if (P.AIM) {
          const first = sweepOffset(sweepForward ? 1 : -1, size, 0);
          const limit = P.AIM === 2 ? aimCorridor - P.SWEEP + 1 : 0;
          // Once the clear starts, the guard is dead code. Reuse its B-field for the distance.
          ins(local('measure'), 'MOV', 'B', ref('pointer'), ref('guard'));
          ins(local('origin'), 'ADD', 'AB', `#(${ref('pointer')}-${ref('advance')}-(${first}))`, ref('guard'));
          ins(local('orient'), 'MUL', 'AB', `#${sweepForward ? 1 : -1}`, ref('guard'));
          ins(local('limit'), 'SLT', 'B', ref('guard'), `#${limit}`);
          ins(local('skipAim'), 'JMP', 'B', ref('fixed'));
          ins(local('aim'), 'MOV', 'B', ref('pointer'), ref('cursor'));
          ins(local('offset'), 'ADD', 'AB', `#(${ref('pointer')}-${ref('cursor')}+${sweepForward ? 0 : 1})`, ref('cursor'));
          ins(local('saveAim'), 'MOV', 'BA', ref('cursor'), ref('resetCursor'));
          ins(local('startSweep'), 'JMP', 'B', ref('sweep'));
          // Both paths take four turns after the comparison.
          for (const label of ['fixed', 'fixedWait1', 'fixedWait2']) ins(local(label), 'NOP', 'F', '$0', '$0');
        }
        ins(local('sweep'), 'MOV', 'I', ref('dat'), `${sweepForward ? '>' : '<'}${ref('cursor')}`);
        ins(local('meter'), 'DJN', 'B', ref('sweep'), `#${P.SWEEP}`);
        ins(local('resetCursor'), 'MOV', 'AB', `#(${sweepStart}-${ref('cursor')})`, ref('cursor'));
        ins(local('resetMeter'), 'MOV', 'AB', `#${P.SWEEP}`, ref('meter'));
        ins(local('again'), 'JMP', 'B', ref('sweep'));
      }
      ins(local('return'), 'JMP', 'B', ref('advance'), P.HANDOFF < 0 ? `<${ref('pointer')}` : '$0');
      ins(local('bomb'), P.TRAP ? 'JMP' : 'DAT', P.TRAP ? 'B' : 'F', '#0', '$0');
      ins(local('pointer'), 'DAT', 'F', '#0', `#${start - template.indexOf('pointer') - direction * P.STEP}`);
      if (P.HANDOFF >= 0) {
        ins(local('dat'), 'DAT', 'F', '#0', '#0');
      }
      if (P.HANDOFF >= 0 && !usesInline(P)) {
        ins(local('cursor'), 'DAT', 'F', '#0', usesBurst(P) ? '#0' : sweepStart);
        ins(local('hits'), 'DAT', 'F', '#0', `#${P.HANDOFF >= 3 ? P.HITS : 0}`);
      }
    }
  },
  plant(api) {
    const [{ hop, start, direction }] = layout(api.P);
    const count = usesBurst(api.P) ? api.P.HITS * Math.min(2, Math.floor(periodFor(api.P) / api.P.HITS))
      : api.P.HANDOFF === 3 ? api.P.HITS : 1;
    return Array.from({ length: count }, (_, i) => [
      wrap(api.at('launch') + hop + start + i * direction * api.P.STEP),
      { op: 'JMP', mod: 'B', aMode: '#', a: 3, bMode: '$', b: 0 },
    ]);
  },
  running(api) {
    const queue = api.vm.processes(0);
    const active = templateFor(api.P).indexOf('return');
    return layout(api.P).every(({ hop }) => queue.some(pc => wrap(pc - api.at('launch') - hop) <= active));
  },
  observe(api) {
    const template = templateFor(api.P);
    const sites = layout(api.P).map(({ hop, direction }, i) => ({ base: wrap(api.at('launch') + hop), direction, id: i + 1 }));
    const byPc = offset => new Map(sites.map(({ base, id }) => [wrap(base + offset), id]));
    const matches = (event, site, label) => api.same(event.instruction, api.original(key(sites[site - 1].direction, label)));
    const entries = byPc(0), looks = byPc(1), attacks = byPc(2);
    const hasSweep = template.includes('sweep');
    const kills = hasSweep ? byPc(template.indexOf('kill')) : new Map();
    const sweeps = hasSweep ? byPc(template.indexOf('sweep')) : new Map();
    const bursts = template.includes('burst') ? byPc(template.indexOf('burst')) : new Map();
    const rearms = usesBurst(api.P) ? byPc(template.indexOf('rearm')) : new Map();
    const aims = api.P.AIM ? byPc(template.indexOf('saveAim')) : new Map();
    const limits = api.P.AIM ? byPc(template.indexOf('limit')) : new Map();
    const approved = new Set();
    return {
      after(event) {
        if (!api.own(event)) return;
        const entry = entries.get(event.pc), probe = looks.get(event.pc), attack = attacks.get(event.pc);
        const target = event.operands[1]?.address;
        if (entry && event.instruction.op === 'ADD') api.phase(`site-${entry}-entry`, { target: event.pc });
        if (probe && event.instruction.op === 'JMZ') {
          api.phase(`site-${probe}-first-probe`, { target });
          api.work(`site-${probe}-probes`, { target });
        }
        if (attack && event.instruction.op === 'MOV' && api.wrote(event, target)) {
          api.phase(`site-${attack}-first-hit`, { target });
          api.work(`site-${attack}-strikes`, { target });
        }
        const kill = kills.get(event.pc), sweep = sweeps.get(event.pc);
        if (kill && matches(event, kill, 'kill') && api.wrote(event, target) && api.peek(target).op === 'DAT') {
          api.phase(`site-${kill}-first-dat`, { target });
        }
        if (sweep && api.wrote(event, target)) api.work(`site-${sweep}-sweep`, { target });
        const burst = bursts.get(event.pc), rearm = rearms.get(event.pc);
        if (burst && matches(event, burst, 'burst')) {
          api.phase(`site-${burst}-first-burst`, { target });
          if (api.wrote(event, target)) api.work(`site-${burst}-burst-dats`, { target });
        }
        if (rearm && matches(event, rearm, 'rearm') && api.wrote(event, target)) {
          api.phase(`site-${rearm}-first-rearm`);
          api.work(`site-${rearm}-rearms`);
        }
        const limit = limits.get(event.pc), aim = aims.get(event.pc);
        if (limit && matches(event, limit, 'limit') && event.operands[0].snapshot.b < event.instruction.b) {
          approved.add(limit);
        }
        if (aim && approved.has(aim) && matches(event, aim, 'saveAim') && api.wrote(event, target)) {
          api.phase(`site-${aim}-aim`);
        }
      },
    };
  },
  watch(api) {
    const { vm, at, P, same } = api;
    const period = periodFor(P);
    const template = templateFor(P), size = template.length;
    const pointer = template.indexOf('pointer');
    const lanes = layout(P).map(site => ({
      ...site, base: wrap(at('launch') + site.hop), probes: new Set(),
      count: 0, strikes: 0, last: null, anchor: null, entered: false, clear: false, sweeps: 0,
      bursts: 0, burstVisits: 0,
    }));
    const byPc = offset => new Map(lanes.map(lane => [wrap(lane.base + offset), lane]));
    const entries = byPc(0), looks = byPc(1), attacks = byPc(2);
    const hasSweep = template.includes('sweep');
    const kills = hasSweep ? byPc(template.indexOf('kill')) : new Map();
    const sweeps = hasSweep ? byPc(template.indexOf('sweep')) : new Map();
    const bursts = template.includes('burst') ? byPc(template.indexOf('burst')) : new Map();
    const rearms = usesBurst(P) ? byPc(template.indexOf('rearm')) : new Map();
    const planted = api.scenario === 'lp-opposed-scanners: planted target';
    const marker = wrap(lanes[0].base + lanes[0].start);
    let markerHit = false;
    return {
      before(pc) {
        const entering = entries.get(pc);
        if (entering && !entering.entered) {
          if (!template.every((label, offset) =>
            same(vm.peek(entering.base + offset), api.code(key(entering.direction, label))))) {
            throw new Error('lp-opposed-scanners entered an incomplete copy');
          }
          entering.entered = true;
        }
        const look = looks.get(pc);
        if (look) {
          const target = wrap(look.base + pointer + vm.peek(look.base + pointer).b - 1);
          if (target !== wrap(look.base + look.start + look.count * look.direction * P.STEP)) {
            throw new Error('lp-opposed-scanners left its signed probe lane');
          }
          look.count++;
          look.probes.add(target);
          look.last = target;
        }
        const attack = attacks.get(pc), kill = kills.get(pc), sweep = sweeps.get(pc);
        const burst = bursts.get(pc), rearm = rearms.get(pc);
        if (rearm) return { lane: rearm, rearm: true };
        const lane = attack ?? kill ?? sweep ?? burst;
        if (!lane) return null;
        const direction = sweepDirection(P, lane);
        const target = sweep ? wrap(lane.anchor + direction * (lane.sweeps % P.SWEEP))
          : burst ? wrap(lane.last + direction * (lane.burstVisits + (usesBurst(P) ? P.BURSTSKIP : 0))) : lane.last;
        if (api.inImage(target) || lanes.some(({ base }) => wrap(target - base) < size)) {
          throw new Error('lp-opposed-scanners attacked a friendly cell');
        }
        return { pc, lane, target, attack: Boolean(attack), kill: Boolean(kill), burst: Boolean(burst) };
      },
      after(event) {
        if (!event) return;
        const { pc, lane, target, attack, kill, burst, rearm } = event;
        if (rearm) {
          if (lane.burstVisits !== P.SWEEP || vm.peek(lane.base + template.indexOf('hits')).b !== P.HITS) {
            throw new Error('lp-opposed-scanners failed to rearm after its burst');
          }
          lane.burstVisits = 0;
          lane.bursts++;
          return;
        }
        const correctWrite = vm.lastWrite[target] === vm.steps && vm.writerPc[target] === pc
          && same(vm.peek(target), api.code(key(lane.direction, attack ? 'bomb' : 'dat')));
        const noWrite = burst && (P.HANDOFF === 5 || P.HANDOFF === 7);
        if (noWrite ? vm.lastWrite[target] === vm.steps : !correctWrite) {
          throw new Error('lp-opposed-scanners missed its probed cell');
        }
        if (attack) {
          markerHit ||= target === marker;
          lane.strikes++;
        } else if (kill) {
          if (P.HANDOFF === 3 && lane.strikes !== P.HITS) {
            throw new Error('lp-opposed-scanners handed off at the wrong strike count');
          }
          const direction = sweepDirection(P, lane);
          const fixed = wrap(lane.base + sweepOffset(direction, size, 0));
          const distance = wrap(direction * (target - fixed));
          lane.anchor = P.AIM === 2 && distance + P.SWEEP <= aimCorridor ? target : fixed;
          lane.clear = true;
        } else if (burst) {
          if (usesBurst(P) && lane.strikes !== (lane.bursts + 1) * P.HITS) {
            throw new Error('lp-opposed-scanners burst at the wrong strike count');
          }
          lane.burstVisits++;
        } else lane.sweeps++;
      },
      final() {
        const queue = vm.processes(0);
        const expectedClear = planted && (P.HANDOFF === 2 || P.HANDOFF === 3);
        const expectedBursts = planted && usesBurst(P) ? Math.min(2, Math.floor(period / P.HITS)) : 0;
        if (api.entered() && (lanes.some((lane, i) => !lane.entered || (
          expectedClear && i === 0 ? !lane.clear || lane.sweeps <= P.SWEEP : lane.clear || lane.probes.size !== period))
          || lanes.some((lane, i) => lane.bursts !== (i === 0 ? expectedBursts : 0))
          || (usesInline(P) && lanes.reduce((sum, lane) => sum + lane.burstVisits, 0) !== Number(planted))
          || queue.length !== lanes.length || !lpOpposedScanners.running(api) || (planted && !markerHit))) {
          throw new Error('lp-opposed-scanners missed a complete probe orbit or planted hit');
        }
      },
    };
  },
};

export default lpOpposedScanners;
