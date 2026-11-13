const cells = 7;
const wrap = (value, core) => ((value % core) + core) % core;

export default {
  id: 'lp-scatter-paper',
  kind: 'body', exit: 'never', dialects: '94', processes: 1, grows: true, writes: 'sparse', roams: true,
  entry: 'copy', entryFirst: false, loop: 'copy',
  purpose: 'A seven-cell LP replicator that copies backwards, scatters through two doubling offsets, and transfers to the copy even when its restart SPL is capped.',
  params: { HOP: [200, 7793], READ: [1, 7999], WRITE: [1, 7999], COUNT: [7, 27], SCATTER: [0, 1],
    READMODE: [0, 1], RESTART: [1, 7999] },
  defaults: { HOP: 6080, READ: 4883, WRITE: 1347, COUNT: 21, SCATTER: 1, READMODE: 0, RESTART: 97 },
  mutable: [['seed', ['b']], ['scatter', ['a', 'b']], ['transfer', ['a']]],
  observationRole: 'lp-scatter-paper',
  knowledge: {
    parameterRoles: {
      HOP: 'Displacement of the first copy', READ: 'Initial source pointer offset',
      WRITE: 'Initial A-predecrement destination pointer offset', COUNT: 'Copy count on restart, including cells preceding the seven-cell body',
      SCATTER: 'Use 0 to keep the timing and omit the indirect copy and its pointer side effects',
      READMODE: '0 B-postincrement read, 1 A-predecrement read',
      RESTART: 'Remote B-postincrement offset on the restart SPL',
    },
    evidence: ['docs/lp-top-ten.md#seven-cells-and-two-jobs-per-pass', 'docs/lp-bronze-paper.md'],
  },
  mismatches(_, settings) {
    return settings.coreSize === 8000 && settings.maxProcesses === 8
      ? [] : ['lp-scatter-paper requires an 8,000-cell ring with eight process slots'];
  },
  linked(P, { coreSize }, label, { total, shiftedFrame }) {
    if (shiftedFrame) return ['lp-scatter-paper needs an unshifted image'];
    const seed = label('seed');
    const copy = Array.from({ length: cells }, (_, index) => wrap(seed + P.HOP + index, coreSize));
    const touched = [label('restart') + P.RESTART];
    if (P.SCATTER) {
      const scatter = label('scatter');
      for (let scale = 1; scale < 2 ** cells; scale *= 2) {
        const read = scatter + scale * P.READ;
        const write = scatter + scale * P.WRITE;
        touched.push(read, write, write - 1);
        if (P.READMODE) touched.push(read - 1);
      }
    }
    const sites = [...copy, ...touched.map(address => wrap(address, coreSize))];
    if (sites.some(address => address < total) || new Set(sites).size !== sites.length) {
      return ['lp-scatter-paper: first copy, pointer cells or scatter destinations overlap'];
    }
    return [];
  },
  emit({ L, P, ins }) {
    ins('seed', 'MOV', 'AB', `#${P.COUNT}`, `#${cells}`);
    ins('copy', 'MOV', 'I', `<${L('seed')}`, `{${L('transfer')}`);
    ins('scatter', P.SCATTER ? 'MOV' : 'NOP', P.SCATTER ? 'I' : 'F',
      `${P.SCATTER ? (P.READMODE ? '{' : '>') : '$'}${P.READ}`, `${P.SCATTER ? '{' : '$'}${P.WRITE}`);
    ins('double', 'ADD', 'F', L('scatter'), L('scatter'));
    ins('check', 'JMN', 'B', L('copy'), L('seed'));
    ins('restart', 'SPL', 'B', `@${L('seed')}`, `>${P.RESTART}`);
    // Backward copying moves A from HOP+1 to HOP-6. Both operands then address the copied seed.
    ins('transfer', 'JMZ', 'B', `$${P.HOP + 1}`, '*0');
  },
  running(api) {
    const stable = ['copy', 'double', 'check', 'restart'].map(label => api.code(label));
    return api.vm.processes(0).some(pc => {
      const instruction = api.vm.peek(pc);
      return stable.some(expected => api.same(instruction, expected))
        || api.same({ ...instruction, a: api.code('transfer').a }, api.code('transfer'));
    });
  },
  observe(api) {
    const transfer = api.original('transfer');
    return {
      after(event) {
        if (!api.own(event)) return;
        const target = event.operands[1]?.address;
        if (api.matches(event, 'copy') && api.wrote(event, target)) api.work('root-copy', { target });
        if (api.P.SCATTER && event.pc === api.at('scatter') && event.instruction.op === 'MOV' && api.wrote(event, target)) {
          api.work('root-scatter', { target });
          api.phase('first-scatter', { target });
        }
        if (api.same({ ...event.instruction, a: transfer.a }, transfer)
          && event.operands[0]?.address === target && event.operands[1]?.snapshot.b === 0
          && api.processes().at(-1) === target) {
          if (event.pc === api.at('transfer')) api.phase('first-transfer', { target });
          if (api.processes().length === api.settings.maxProcesses) api.phase('capped-transfer', { target });
        }
      },
    };
  },
  watch(api) {
    const { vm, at, P, norm, same } = api;
    const seed = at('seed'), scatter = at('scatter'), transfer = at('transfer');
    const first = norm(seed + P.HOP);
    const image = [];
    let scatters = 0, doubles = 0, transferred = false;
    return {
      before(pc) {
        if (transferred) return null;
        if (pc === at('copy')) {
          const offset = cells - 1 - image.length;
          const value = vm.peek(seed + offset);
          if (offset === 0) value.b = 0;
          return { pc, kind: 'copy', target: norm(first + offset), value };
        }
        if (pc === scatter && P.SCATTER) {
          const read = norm(scatter + P.READ * 2 ** scatters);
          const write = norm(scatter + P.WRITE * 2 ** scatters);
          const readOffset = P.READMODE ? norm(vm.peek(read).a - 1) : vm.peek(read).b;
          const writeOffset = norm(vm.peek(write).a - 1);
          const source = norm(read + readOffset);
          const value = vm.peek(source);
          if (P.READMODE && source === read) value.a = readOffset;
          return {
            pc, kind: 'scatter', target: norm(write + writeOffset),
            read, readOffset, write, writeOffset, value,
          };
        }
        if (pc === at('double')) return { kind: 'double' };
        if (pc === transfer) {
          if (image.length !== cells || doubles !== cells || scatters !== cells * P.SCATTER
            || image.some(({ target, value }) => !same(vm.peek(target), value))) {
            throw new Error('lp-scatter-paper did not finish the first backward copy');
          }
          return { kind: 'transfer' };
        }
        return null;
      },
      after(event) {
        if (!event) return;
        if (event.kind === 'transfer') {
          if (vm.processes(0).at(-1) !== first) throw new Error('lp-scatter-paper did not enter the first copy');
          transferred = true;
        } else if (event.kind === 'double') {
          const { a, b } = vm.peek(scatter), scale = 2 ** ++doubles;
          if (a !== norm(P.READ * scale) || b !== norm(P.WRITE * scale)) {
            throw new Error('lp-scatter-paper lost a doubling offset');
          }
        } else {
          if (vm.lastWrite[event.target] !== vm.steps || vm.writerPc[event.target] !== event.pc
            || !same(vm.peek(event.target), event.value)) {
            throw new Error(`lp-scatter-paper did not write its planned ${event.kind}`);
          }
          if (event.kind === 'copy') image.push(event);
          else {
            const readField = P.READMODE ? 'a' : 'b';
            const readAfter = P.READMODE ? event.readOffset : norm(event.readOffset + 1);
            if ((event.read !== event.target && vm.peek(event.read)[readField] !== readAfter)
              || (event.write !== event.target && vm.peek(event.write).a !== event.writeOffset)) {
              throw new Error('lp-scatter-paper lost a scatter pointer side effect');
            }
            scatters++;
          }
        }
      },
      final() {
        if (api.entered() && !transferred) throw new Error('lp-scatter-paper failed to transfer');
      },
    };
  },
};
