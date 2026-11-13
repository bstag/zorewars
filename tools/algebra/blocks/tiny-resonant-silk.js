// The coupled steps of inversed's Consonance, with an independent clear tail.
// https://asdflkj.net/COREWAR/TINY/HILL32/consonance.red

const WORKERS = 6;
const SIZE = 9;
const wrap = (n) => ((n % 800) + 800) % 800;
const yHop = ({ X, RETURN }) => wrap(RETURN - 3 * X);

function route(y, x, P) {
  const Y = yHop(P);
  const firstY = wrap(y + Y);
  const firstX = wrap(x + P.X);
  const yThenX = wrap(x + Y);
  const secondX = wrap(yThenX + P.X);
  const thirdX = wrap(secondX + P.X);
  const returnAt = wrap(thirdX + P.X);
  return { firstY, firstX, yThenX, secondX, thirdX, returnAt };
}

function lineage(y, x, P) {
  const { firstY, firstX, yThenX, secondX, thirdX, returnAt } = route(y, x, P);
  return [
    [y, null, 'y', 'root-y'], [x, null, 'x', 'root-x'],
    [firstY, y, 'y', 'first-y'], [firstX, x, 'x', 'first-x'],
    [yThenX, y, 'x', 'y-lineage-x'],
    [secondX, yThenX, 'x', 'y-lineage-hop-1'],
    [thirdX, secondX, 'x', 'y-lineage-hop-2'],
    [returnAt, thirdX, 'x', 'resonant-return'],
  ].map(([entry, parent, stage, phase]) => ({
    entry, writer: parent === null ? null : wrap(parent + 1), stage, phase,
  }));
}

function assertWrite(vm, target, pc) {
  if (vm.lastWrite[target] !== vm.steps || vm.writerPc[target] !== pc) {
    throw new Error('tiny-resonant-silk missed a declared write');
  }
}

export default {
  id: 'tiny-resonant-silk',
  kind: 'body', exit: 'never', processes: WORKERS, grows: true, writes: 'core', roams: true,
  dialects: '94', entry: 'fan', layout: 'last',
  purpose: 'Launches a six-process two-stage paper with Y = RETURN − 3×X mod 800. The Y lineage returns after three X hops to RETURN cells past the first X entry. Copies trail a backward clear.',
  params: { X: [20, 260], RETURN: [1, 2], SOURCE: [20, 779], SWEEP: [8, 60] },
  defaults: { X: 117, RETURN: 1, SOURCE: 211, SWEEP: 29 },
  mutable: [['y', ['a', 'b']], ['x', ['a', 'b']], ['again', ['b']]],
  observationRole: 'resonant-silk',
  testedProfiles: ['tiny'],
  knowledge: {
    parameterRoles: { X: 'Second silk displacement', RETURN: 'Target offset after one Y hop and three X hops', SOURCE: 'Remote instruction copied by the sweep', SWEEP: 'Initial backward sweep distance' },
    invariants: ['Y is derived from X and RETURN modulo 800.', 'The early six-cell copies must stay distinct until the intentional return.'],
    evidence: ['docs/hill-block-followup.md#move-a-silk-return-by-one-cell', 'test/algebra-tiny-resonant-silk.test.js'],
  },
  mismatches(_, settings) {
    if (settings.coreSize !== 800) return ['tiny-resonant-silk requires the 800-cell ring'];
    if (settings.maxProcesses < 128) return ['tiny-resonant-silk needs at least 128 process slots for its deployment'];
    return [];
  },
  linked(P, _settings, label, { total, shiftedFrame }) {
    if (shiftedFrame || label('fan') + SIZE !== total) return ['tiny-resonant-silk requires an unshifted, last body'];
    const y = label('y'), x = label('x'), Y = yHop(P);
    const { firstY, firstX, secondX, thirdX } = route(y, x, P);
    const footprints = [firstY, wrap(firstY + Y), firstX, secondX, thirdX]
      .flatMap((entry) => Array.from({ length: WORKERS }, (_, i) => wrap(entry + i)));
    if (footprints.some((cell) => cell < total) || new Set(footprints).size !== footprints.length) {
      return ['tiny-resonant-silk deployment footprints overlap before the return'];
    }
    const source = wrap(label('fire') + P.SOURCE);
    const firstSweep = wrap(label('again') - P.SWEEP - 1);
    if (source < total || footprints.includes(source) || wrap(firstSweep - source) < WORKERS) {
      return ['tiny-resonant-silk clear source overlaps the image, early copies, or first sweep'];
    }
    return [];
  },
  emit(ctx) {
    const { L, P } = ctx;
    ctx.ins('fan', 'SPL', 'B', '2');
    ctx.ins('', 'SPL', 'B', '1');
    ctx.ins('', 'SPL', 'B', '1');
    for (const [stage, hop] of [['y', yHop(P)], ['x', P.X]]) {
      ctx.ins(stage, 'SPL', 'B', '@0', `>${hop}`);
      ctx.ins('', 'MOV', 'I', `}${L(stage)}`, `>${L(stage)}`);
    }
    ctx.ins('fire', 'MOV', 'I', `$${P.SOURCE}`, `<${L('again')}`);
    ctx.ins('again', 'JMP', 'B', L('fire'), `$-${P.SWEEP}`);
  },
  plant(api) {
    return [[wrap(api.at('fire') + api.P.SOURCE), {
      op: 'DAT', mod: 'F', aMode: '#', a: 7, bMode: '#', b: 9,
    }]];
  },
  running(api) {
    const stage = api.code('x'), copy = api.code('x', 1), fire = api.code('fire'), tail = api.code('again');
    return api.vm.processes(0).some((pc) => {
      const instruction = api.vm.peek(pc);
      return api.same(instruction, copy) || api.same(instruction, fire)
        || api.same({ ...instruction, a: stage.a, b: stage.b }, stage)
        || api.same({ ...instruction, b: tail.b }, tail);
    });
  },
  observe(api) {
    const arrivals = new Map(lineage(api.at('y'), api.at('x'), api.P).map((stage) => [stage.entry, stage]));
    return {
      after(event) {
        if (!api.own(event)) return;
        const arrival = arrivals.get(event.pc);
        if (arrival && (arrival.writer === null || api.provenance(event.pc).writerPc === arrival.writer)
          && api.same(event.instruction, api.original(arrival.stage))) {
          api.phase(arrival.phase, { target: event.pc });
        }
        if (api.matches(event, 'fire') && api.wrote(event, event.operands[1].address)) {
          api.work('root-sweep-writes', { target: event.operands[1].address });
        }
      },
    };
  },
  watch(api) {
    const { vm, P } = api;
    const y = api.at('y'), x = api.at('x'), fire = api.at('fire'), again = api.at('again');
    const stages = lineage(y, x, P).map((stage) => ({ ...stage, entered: false, copies: 0 }));
    const entries = new Map(stages.map((stage) => [stage.entry, stage]));
    const copyPCs = new Map(stages.slice(0, -1).map((stage) => [wrap(stage.entry + 1), stage]));
    const processesAt = (address) => vm.processes(0).filter((pc) => pc === address).length;
    let sweeps = 0;
    return {
      before(pc) {
        const launch = entries.get(pc);
        if (launch && !launch.entered && (launch.writer === null || vm.writerPc[pc] === launch.writer)) {
          if (!api.same(vm.peek(pc), api.code(launch.stage))) throw new Error('tiny-resonant-silk entered a damaged silk stage');
          const target = wrap(pc + api.code(launch.stage).b);
          return { launch, target, count: processesAt(target) };
        }
        const copy = copyPCs.get(pc);
        if (copy?.entered && copy.copies < WORKERS) {
          const pointer = vm.peek(copy.entry);
          const hop = api.code(copy.stage).b;
          if (!api.same(vm.peek(pc), api.code(copy.stage, 1))
            || pointer.a !== copy.copies || pointer.b !== wrap(hop + copy.copies)) {
            throw new Error('tiny-resonant-silk lost its six-cell copy sequence');
          }
          return { copy, pc, target: wrap(copy.entry + pointer.b), value: vm.peek(copy.entry + pointer.a) };
        }
        if (pc === fire && sweeps < WORKERS) {
          const pointer = vm.peek(again);
          if (!api.same(vm.peek(pc), api.code('fire')) || pointer.b !== wrap(-P.SWEEP - sweeps)) {
            throw new Error('tiny-resonant-silk lost its backward sweep sequence');
          }
          return { pc, target: wrap(again + pointer.b - 1), value: vm.peek(pc + P.SOURCE) };
        }
        return null;
      },
      after(event) {
        if (!event) return;
        if (event.launch) {
          if (processesAt(event.target) !== event.count + 1) throw new Error('tiny-resonant-silk did not launch at the coupled step');
          event.launch.entered = true;
          return;
        }
        assertWrite(vm, event.target, event.pc);
        if (!api.same(vm.peek(event.target), event.value)) throw new Error('tiny-resonant-silk wrote a different instruction than it read');
        if (event.copy) {
          event.copy.copies++;
        } else {
          assertWrite(vm, again, event.pc);
          sweeps++;
        }
      },
      final() {
        if (!api.entered()) return;
        if (stages.some(({ entered }) => !entered) || [...copyPCs.values()].some(({ copies }) => copies !== WORKERS)) {
          throw new Error('tiny-resonant-silk did not deploy and execute the coupled lineage');
        }
        if (sweeps !== WORKERS) throw new Error('tiny-resonant-silk did not complete the first backward sweep writes');
      },
    };
  },
};
