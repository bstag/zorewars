// One worker per stone site, inspired by tiny Roskilde's three-copy fan.
// https://asdflkj.net/COREWAR/ODD/HILL32/troskilde.red

const wrap = (value) => ((value % 800) + 800) % 800;
const sites = (P) => [P.SITE1, P.SITE2, P.SITE3].map((site) => 20 * site + P.LANE);
const destination = (base, offset) => wrap(base + offset);

export default {
  id: 'tiny-lp-stone-triad',
  kind: 'body', exit: 'never', processes: 3, writes: 'sparse', roams: true,
  dialects: '94', entry: 'fan', testedProfiles: ['tinylp'],
  purpose: 'Three workers copy one three-cell stone to each of three sites, then a self-indexing dispatch sends exactly one worker to each. The stones share a lattice phase and keep their bomb lane clear of all deployed bodies.',
  params: {
    SITE1: [3, 36], SITE2: [3, 36], SITE3: [3, 36], LANE: [0, 19],
    STEP: [1, 19], FIRST: [3, 17], DONOR: [50, 749],
  },
  defaults: { SITE1: 8, SITE2: 20, SITE3: 31, LANE: 11, STEP: 2, FIRST: 9, DONOR: 413 },
  mutable: [['lane1', ['a', 'b']], ['lane2', ['a', 'b']], ['lane3', ['a', 'b']], ['dispatch', ['a']]],
  observationRole: 'stone-triad',
  knowledge: {
    evidence: ['docs/tiny-lp-source-followup.md', 'test/algebra-tiny-lp-extracts.test.js'],
    parameterRoles: {
      SITE1: 'first deployment in 20-cell units', SITE2: 'second deployment', SITE3: 'third deployment',
      LANE: 'shared stone residue class', STEP: 'bomb stride in 20-cell units', FIRST: 'initial bomb offset',
      DONOR: 'initial source offset, moving backward once per loop',
    },
  },
  mismatches(_, settings) {
    return settings.coreSize === 800 && settings.maxProcesses === 8 ? [] : ['tiny-lp-stone-triad needs the Tiny LP ring and eight process slots'];
  },
  linked(P, _settings, label, { total, shiftedFrame }) {
    if (shiftedFrame) return ['tiny-lp-stone-triad needs an unshifted image'];
    const deploy = sites(P).map((offset) => destination(label('fan'), offset));
    if (new Set(deploy).size !== deploy.length || deploy.some((entry) => [0, 1, 2].some((i) => wrap(entry + i) < total))) {
      return ['tiny-lp-stone-triad deployment footprints overlap each other or the linked image'];
    }
    return [];
  },
  emit(ctx) {
    const { L, P } = ctx;
    const hops = sites(P);
    ctx.ins('fan', 'SPL', 'B', '2');
    ctx.ins('', 'SPL', 'B', '1');
    for (let i = 1; i <= hops.length; i++) {
      ctx.ins(`copy${i}`, 'MOV', 'I', `<${L(`lane${i}`)}`, `{${L(`lane${i}`)}`);
    }
    ctx.ins('dispatch', 'JMP', 'B', `*${L('lane1')}`, '}0');
    hops.forEach((hop, i) => {
      ctx.ins(`lane${i + 1}`, 'DAT', 'F', `#(${L('fan')}+${hop}+3-${L(`lane${i + 1}`)})`,
        `#(${L('attack')}+3-${L(`lane${i + 1}`)})`);
    });
    ctx.ins('attack', 'MOV', 'I', `$${P.DONOR}`, `$${P.FIRST}`);
    ctx.ins('step', 'ADD', 'X', `#${20 * P.STEP}`, L('attack'));
    ctx.ins('loop', 'JMP', 'B', L('attack'));
  },
  running(api) {
    return sites(api.P).some((offset) => {
      const entry = destination(api.at('fan'), offset);
      return api.same(api.vm.peek(entry + 1), api.code('step')) && api.same(api.vm.peek(entry + 2), api.code('loop'))
        && api.vm.processes(0).some((pc) => wrap(pc - entry) < 3);
    });
  },
  observe(api) {
    const deploy = new Map(sites(api.P).map((offset, i) => [destination(api.at('fan'), offset), i + 1]));
    return {
      after(event) {
        if (!api.own(event)) return;
        const target = event.operands[1]?.address, lane = deploy.get(event.pc);
        if (lane && api.same(event.instruction, api.original('attack'), ['a', 'b']) && api.wrote(event, target)) {
          api.phase(`lane-${lane}-first-attack`, { entry: event.pc, target });
          api.work(`lane-${lane}-attack-writes`, { target });
        }
        if (api.matches(event, 'dispatch', ['a'])) api.phase('first-dispatch', { target: event.operands[0].address });
      },
    };
  },
  watch(api) {
    const { P, vm } = api, template = api.at('attack'), dispatch = api.at('dispatch');
    const lanes = sites(P).map((offset, i) => ({
      entry: destination(api.at('fan'), offset),
      state: api.at(`lane${i + 1}`),
      copy: api.at(`copy${i + 1}`),
      copies: 0, launched: false, attacks: 0,
    }));
    const copied = new Map(lanes.map((lane) => [lane.copy, lane]));
    const deployed = new Map(lanes.map((lane) => [lane.entry, lane]));
    let dispatched = 0;
    return {
      before(pc) {
        const copy = copied.get(pc);
        if (copy && copy.copies < 3) {
          const pointer = vm.peek(copy.state), index = 2 - copy.copies;
          const source = wrap(copy.state + pointer.b - 1), target = wrap(copy.state + pointer.a - 1);
          if (source !== wrap(template + index) || target !== wrap(copy.entry + index)) {
            throw new Error('tiny-lp-stone-triad copied outside its declared deployment');
          }
          return { type: 'copy', lane: copy, target, pc, value: vm.peek(source), pointer };
        }
        if (pc === dispatch && dispatched < lanes.length) {
          const lane = lanes[dispatched];
          if (lanes.some(({ copies }) => copies !== 3)
            || wrap(pc + vm.peek(pc).a) !== lane.state
            || wrap(lane.state + vm.peek(lane.state).a) !== lane.entry
            || ['attack', 'step', 'loop'].some((label, i) => !api.same(vm.peek(lane.entry + i), api.code(label)))) {
            throw new Error('tiny-lp-stone-triad dispatched before a complete three-site copy');
          }
          return { type: 'dispatch', lane, queue: vm.processes(0).length, selector: vm.peek(pc).a };
        }
        const stone = deployed.get(pc);
        if (stone?.launched && stone.attacks < 3) {
          const instruction = vm.peek(pc);
          const original = api.code('attack');
          const donor = wrap(pc + P.DONOR - stone.attacks);
          const target = wrap(pc + P.FIRST + stone.attacks * P.STEP * 20);
          if (!api.same({ ...instruction, a: original.a, b: original.b }, original)
            || wrap(pc + instruction.a) !== donor || wrap(pc + instruction.b) !== target
            || lanes.some(({ entry }) => wrap(target - entry) < 3)) {
            throw new Error('tiny-lp-stone-triad left its declared attack lane');
          }
          return { type: 'attack', lane: stone, target, pc, value: vm.peek(donor) };
        }
        return null;
      },
      after(event) {
        if (!event) return;
        const { type, lane, target, pc, value } = event;
        if (type === 'dispatch') {
          const queue = vm.processes(0);
          if (queue.length !== event.queue || queue.filter((address) => address === lane.entry).length !== 1
            || vm.peek(dispatch).a !== wrap(event.selector + 1)) {
            throw new Error('tiny-lp-stone-triad did not assign exactly one process');
          }
          lane.launched = true;
          dispatched++;
          return;
        }
        if (vm.lastWrite[target] !== vm.steps || vm.writerPc[target] !== pc || !api.same(vm.peek(target), value)) {
          throw new Error('tiny-lp-stone-triad missed a declared write');
        }
        if (type === 'copy') {
          const pointer = { ...event.pointer, a: wrap(event.pointer.a - 1), b: wrap(event.pointer.b - 1) };
          if (!api.same(vm.peek(lane.state), pointer)) throw new Error('tiny-lp-stone-triad lost a copy pointer decrement');
          lane.copies++;
        } else lane.attacks++;
      },
      final() {
        if (api.entered() && lanes.some(({ launched, attacks }) => !launched || attacks !== 3)) {
          throw new Error('tiny-lp-stone-triad did not start all three attacks');
        }
      },
    };
  },
};
