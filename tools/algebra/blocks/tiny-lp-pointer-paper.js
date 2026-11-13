// Shared copy and control pointers, inspired by FragPaper 800 and tiny Roskilde.
// https://asdflkj.net/COREWAR/ODD/HILL32/fpaper800.red
// https://asdflkj.net/COREWAR/ODD/HILL32/troskilde.red

const wrap = (value) => ((value % 800) + 800) % 800;
const size = (P) => 6 + P.ATTACK;
const sameExceptB = (api, instruction, original) => api.same({ ...instruction, b: original.b }, original);

export default {
  id: 'tiny-lp-pointer-paper',
  kind: 'body', exit: 'never', processes: 1, grows: true, roams: true, writes: 'sparse',
  dialects: '94', entry: 'seed', testedProfiles: ['tinylp'],
  purpose: 'Six-cell backward replicator for Tiny LP. The source cursor returns to zero and restarts the parent through indirect SPL. The destination cursor becomes a guarded transfer into the finished copy. An optional seventh instruction attacks during each copy.',
  params: { HOP: [50, 749], ATTACK: [0, 1], SLOT: [50, 742], SIDE: [50, 749] },
  defaults: { HOP: 347, ATTACK: 1, SLOT: 601, SIDE: 117 },
  mutable: [['seed', ['b']], ['go', ['b']]],
  observationRole: 'pointer-paper',
  knowledge: {
    evidence: ['docs/tiny-lp-source-followup.md', 'test/algebra-tiny-lp-extracts.test.js'],
    parameterRoles: { HOP: 'first copy displacement', ATTACK: 'interleave a DAT write with each copy', SLOT: 'remote attack cursor', SIDE: 'remote SPL predecrement' },
  },
  mismatches(_, settings) {
    return settings.coreSize === 800 && settings.maxProcesses === 8 ? [] : ['tiny-lp-pointer-paper needs the Tiny LP ring and eight process slots'];
  },
  linked(P, _settings, label, { total, shiftedFrame }) {
    if (shiftedFrame) return ['tiny-lp-pointer-paper needs an unshifted image'];
    const seed = label('seed');
    const copy = Array.from({ length: size(P) }, (_, i) => wrap(seed + P.HOP + i));
    const side = wrap(seed + P.SIDE);
    const attack = P.ATTACK ? Array.from({ length: size(P) + 1 }, (_, i) => wrap(seed + P.SLOT + i)) : [];
    if (copy.some((address) => address < total) || attack.some((address) => address < total || copy.includes(address))
      || side < total || copy.includes(side) || attack.includes(side)) {
      return ['tiny-lp-pointer-paper overlaps its image, first copy, or attack lane'];
    }
    return [];
  },
  emit(ctx) {
    const { L, P } = ctx, length = size(P);
    ctx.ins('seed', 'MOV', 'AB', `#${length}`, `#${length}`);
    ctx.ins('copy', 'MOV', 'I', `<${L('seed')}`, `<${L('go')}`);
    if (P.ATTACK) ctx.ins('attack', 'MOV', 'I', L('bomb'), `>${L('seed')}+${P.SLOT}`);
    ctx.ins('check', 'JMN', 'B', L('copy'), L('seed'));
    ctx.ins('restart', 'SPL', 'B', `@${L('seed')}`, `<${L('seed')}+${P.SIDE}`);
    ctx.ins('go', 'JMZ', 'B', '@0', `$${P.HOP + 2}`);
    ctx.ins('bomb', 'DAT', 'F', '$0', '$2');
  },
  running(api) {
    return api.vm.processes(0).some((pc) => ['seed', 'copy', 'check', 'restart', 'go'].some((label) => (
      sameExceptB(api, api.vm.peek(pc), api.code(label))
    )));
  },
  observe(api) {
    return {
      after(event) {
        if (!api.own(event)) return;
        const destination = event.operands[1]?.address;
        if (api.matches(event, 'copy') && api.wrote(event, destination)) {
          api.work('root-copy-writes', { target: destination });
        }
        if (api.P.ATTACK && api.matches(event, 'attack') && api.wrote(event, destination)) {
          api.work('root-attack-writes', { target: destination });
        }
        if (sameExceptB(api, event.instruction, api.original('go')) && api.processes().includes(destination)) {
          if (event.pc === api.at('go')) api.phase('first-copy-transfer', { target: destination });
          if (api.processes().length === api.settings.maxProcesses) api.phase('full-queue-transfer', { target: destination });
        }
      },
    };
  },
  watch(api) {
    const { P, vm } = api, length = size(P), seed = api.at('seed'), go = api.at('go');
    const copyPc = api.at('copy'), restart = api.at('restart');
    const attack = P.ATTACK ? api.at('attack') : null;
    const slot = wrap(seed + P.SLOT), first = wrap(seed + P.HOP);
    let copies = 0, attacks = 0, restarted = false, entered = false, fullQueueTransfer = false;
    const firstImage = [];
    return {
      before(pc) {
        if (!entered && pc === copyPc) {
          const from = wrap(seed + vm.peek(seed).b - 1);
          const target = wrap(go + vm.peek(go).b - 1);
          if (copies >= length || from !== wrap(seed + length - 1 - copies) || target !== wrap(first + length - 1 - copies)) {
            throw new Error('tiny-lp-pointer-paper lost its backward copy sequence');
          }
          const value = vm.peek(from);
          if (from === seed) value.b = 0;
          return { type: 'copy', pc, target, value };
        }
        if (!entered && pc === attack) {
          const target = wrap(slot + vm.peek(slot).b);
          const expected = wrap(slot + (attacks ? attacks + 1 : 0));
          if (target !== expected || api.inImage(target)) throw new Error('tiny-lp-pointer-paper lost its attack cursor');
          return { type: 'attack', pc, target, value: api.code('bomb') };
        }
        if (!restarted && pc === restart) {
          if (copies !== length || attacks !== length * P.ATTACK || vm.peek(seed).b !== 0) {
            throw new Error('tiny-lp-pointer-paper restarted before copying its complete body');
          }
          if (firstImage.some(({ target, value }) => !api.same(vm.peek(target), value))) {
            throw new Error('tiny-lp-pointer-paper changed its completed image before transfer');
          }
          return { type: 'restart', queue: vm.processes(0).length };
        }
        if (fullQueueTransfer) return null;
        const instruction = vm.peek(pc);
        if (!sameExceptB(api, instruction, api.code('go'))) return null;
        const target = wrap(pc + instruction.b);
        const emptyCursor = api.same(vm.peek(target), { ...api.code('seed'), b: 0 });
        const queue = vm.processes(0);
        const visits = queue.filter((address) => address === target).length;
        if (!entered && pc === go) {
          if (!restarted || target !== first || !emptyCursor) throw new Error('tiny-lp-pointer-paper did not guard its finished copy');
          return { type: 'enter', target, visits, queue: queue.length };
        }
        if (entered && emptyCursor && queue.length === api.settings.maxProcesses) {
          return { type: 'full', target, visits, queue: queue.length };
        }
        return null;
      },
      after(event) {
        if (!event) return;
        if (event.type === 'restart') {
          if (event.queue < api.settings.maxProcesses && !vm.processes(0).includes(seed)) {
            throw new Error('tiny-lp-pointer-paper did not restart its source');
          }
          restarted = true;
          return;
        }
        if (event.type === 'enter' || event.type === 'full') {
          const queue = vm.processes(0);
          if (queue.length !== event.queue || queue.filter((address) => address === event.target).length !== event.visits + 1) {
            throw new Error('tiny-lp-pointer-paper lost its transfer');
          }
          if (event.type === 'enter') entered = true;
          else fullQueueTransfer = true;
          return;
        }
        const { target, value, pc } = event;
        if (vm.lastWrite[target] !== vm.steps || vm.writerPc[target] !== pc || !api.same(vm.peek(target), value)) {
          throw new Error('tiny-lp-pointer-paper did not write the planned instruction');
        }
        if (event.type === 'copy') {
          firstImage.push({ target, value });
          copies++;
        } else {
          attacks++;
        }
      },
      final() {
        if (api.entered() && (!entered || !fullQueueTransfer)) {
          throw new Error('tiny-lp-pointer-paper failed to transfer an intact copy with eight processes');
        }
      },
    };
  },
};
