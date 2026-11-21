// David Moore's Tangle Trap 3. Two fangs relay to a process-capacity pit.
// Seven staggered workers alternate two fang writes with a compensating
// update of the remote check cell. A missed update falls into a reserve clear.
const ID = 'tangle-trap-88';
const CHECK = 45, PIT = 217, CLEAR = -41;
const damageAt = 200;

const tangleTrap = {
  id: ID, kind: 'body', exit: 'never', entry: 'boot',
  entryFirst: false, processes: 7, grows: true, writes: 'core', attacks: 'all', roams: true,
  purpose: 'A two-stage fang vampire with a process-capacity pit and a remote reserve clear triggered by an unbalanced worker update.',
  params: { BOOT: [2000, 6700], STEP: [33, 83], TIME: [700, 1300] },
  defaults: { BOOT: 5098, STEP: 49, TIME: 976 },
  mismatches(_, { coreSize, maxProcesses }) {
    return coreSize === 8000 && maxProcesses >= 8
      ? [] : [`${ID}: this deployment needs an 8,000-cell ring and at least eight slots`];
  },
  mutable: [['pF', ['a', 'b']], ['pV', ['b']], ['pV2', ['b']],
    ['pT', ['b']], ['pC', ['a', 'b']], ['source', ['b']], ['pCl', ['b']]],
  emit(ctx) {
    const { L, P } = ctx, step = -P.STEP, skip = -18;
    const remote = `${L('boot')}+${P.BOOT}`;
    const check = `${L('workerAdd')}+${CHECK}`;
    ctx.ins('boot2', 'MOV', 'I', L('clearBomb'), `@${L('pCl')}`);
    ctx.ins('', 'MOV', 'I', L('fang2'), `@${L('pF')}`);
    ctx.ins('', 'MOV', 'I', L('fang1'), `<${L('pF')}`);
    ctx.ins('pW', 'MOV', 'I', L('blanker'), `${remote}+${2 + skip + step}`);
    ctx.ins('pT', 'SPL', 'B', L('pC'), `${remote}+${PIT + 3}`);
    ctx.ins('pF', 'SPL', 'B', `${remote}+2`, `${remote}+${CHECK}`);
    ctx.ins('pV', 'SPL', 'B', '@0', `${remote}+6`);
    ctx.ins('', 'MOV', 'I', `<${L('pV')}`, L('pF'));
    ctx.ins('', 'DAT', 'F', `<${L('pT')}`, `<${L('pW')}`);
    ctx.ins('pC', 'SPL', 'B', `${remote}+3`, `${remote}+${CLEAR + 3}`);
    ctx.ins('pV2', 'SPL', 'B', '@0', `${remote}+1`);
    ctx.ins('', 'MOV', 'I', `<${L('pV2')}`, L('pC'));
    ctx.ins('', 'DAT', 'F', `<${L('pV2')}`, `<${remote}+3858`);

    ctx.ins('boot', 'SPL', 'B', L('boot2'), `<${remote}+3466`);
    ctx.ins('', 'SPL', 'B', '2', `<${remote}+1555`);
    ctx.ins('', 'SPL', 'B', '1', `<${remote}+2290`);
    for (const dest of ['pV', 'pV', 'pC', 'pT']) {
      ctx.ins('', 'MOV', 'I', `<${L('source')}`, `<${L(dest)}`);
    }
    ctx.ins('', 'DJN', 'B', `@${L('pV2')}`, '#3');
    ctx.ins('pCl', 'DJN', 'B', `@${L('pV')}`, `#${remote}+${CLEAR - 4}`);

    ctx.ins('blanker', 'JMP', 'B', '0', '<0');
    ctx.ins('clearBomb', 'DAT', 'F', '<-8', '#-10');
    ctx.ins('fang1', 'JMP', 'B', String(skip + step), String(skip));
    ctx.ins('fang2', 'JMP', 'B', String(PIT - 2 + step * P.TIME - skip - step), '2');
    ctx.ins('pit', 'SPL', 'B', '0', '<2');
    ctx.ins('source', 'SPL', 'B', '-1', `${L('workerAdd')}+6`);
    ctx.ins('', 'JMN', 'B', '-1', '#MAXPROCESSES');

    ctx.ins('reserve', 'SPL', 'B', '0', '<-7');
    ctx.ins('', 'MOV', 'I', '-5', '<-5');
    ctx.ins('', 'DJN', 'B', '-1', '<3984');

    ctx.ins('workerAdd', 'ADD', 'F', L('workerSub'), check);
    ctx.ins('workerSub', 'SUB', 'AB', `#${-step}`, '2');
    ctx.ins('', 'MOV', 'I', `<${check}`, `@${L('second')}`);
    ctx.ins('second', 'MOV', 'I', `<${check}`, `@${L('workerAdd')}+${2 - step * P.TIME}`);
    ctx.ins('check', 'JMZ', 'B', L('workerAdd'), check);
    ctx.ins('', 'JMP', 'B', `${L('workerAdd')}+${CLEAR}`);
  },
  running({ vm, entry, norm, P }) {
    const start = norm(entry() + P.BOOT);
    return vm.processes(0).some((pc) => norm(pc - start) < 6 || norm(pc - start - CLEAR) < 3);
  },
  plant({ entry, norm, P }) {
    const missedWrite = norm(entry() + P.BOOT + 2);
    return [[missedWrite, { op: 'JMP', mod: 'B', aMode: '$', a: 1, bMode: '$', b: 0 }, damageAt]];
  },
  watch({ vm, entry, norm, P, core, scenario, entered }) {
    const start = norm(entry() + P.BOOT);
    const check = norm(start + CHECK), pit = norm(start + PIT), wipe = norm(start + CLEAR + 1);
    const outer = norm(start + 2), inner = norm(start + 3);
    const planted = scenario === `${ID}: planted target`;
    let quiet = 0, relay = false, tripped = false, cleared = false;
    const incoming = new Set();
    const follows = (at) => norm(at + vm.peek(at).a);
    return {
      before(pc) {
        if (pc === norm(start + 4)) {
          const state = vm.peek(check);
          if (vm.cycle < damageAt && state.b === 0) quiet++;
          if (planted && vm.cycle >= damageAt && state.b !== 0) tripped = true;
        }
        if (pc === wipe && vm.peek(wipe).op === 'MOV') {
          if (vm.cycle < damageAt) throw new Error(`${ID}: the reserve clear ran during the quiet loop`);
          if (tripped) cleared = true;
        }
        if (relay || vm.cycle >= damageAt || (pc !== outer && pc !== inner)) return null;
        const pointer = norm(pc + vm.peek(pc).b);
        return { pc, target: norm(pointer + vm.peek(pointer).b) };
      },
      after(write) {
        if (!write) return;
        const { pc, target } = write;
        if (vm.writerPc[target] !== pc || vm.peek(target).op !== 'JMP') return;
        if (pc === outer) incoming.add(follows(target));
        if (pc === inner && incoming.has(target) && follows(target) === pit) {
          relay = vm.peek(pit).op === 'SPL' && vm.peek(norm(pit + 2)).op === 'JMN' &&
            vm.peek(norm(pit + 2)).b === vm.settings.maxProcesses % core;
        }
      },
      final() {
        if (!entered()) return;
        if (quiet < 10 || !relay) throw new Error(`${ID}: the quiet loop or the staged pit could not be observed`);
        if (planted && (!tripped || !cleared)) throw new Error(`${ID}: a missed fang update did not start the clear`);
      },
    };
  },
};

export default tangleTrap;
