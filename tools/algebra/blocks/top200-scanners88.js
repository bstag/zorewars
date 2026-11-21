const imp = { op: 'MOV', mod: 'I', aMode: '$', a: 0, bMode: '$', b: 2667 };
const marker = { op: 'DAT', mod: 'F', aMode: '#', a: 0, bMode: '#', b: 1 };

// Wayne Sheppard's Iron Trap. The literal-imp check reads the adjusted
// comparison pointer after the ordinary JMP/SPL attack.
const ironTrap = {
  id: 'iron-trap-88', kind: 'body', exit: 'never', entry: 'advance',
  processes: 1, grows: true, writes: 'core', attacks: 'all',
  purpose: 'An Iron Trap comparison scanner. When the adjusted hit pointer finds a three-point imp template, lay a bounded SPL trail along its spiral before clearing.',
  params: { GAP: [24, 126], STUN: [8, 240] },
  defaults: { GAP: 98, STUN: 100 },
  mutable: [['compare', ['a', 'b']], ['count', ['b']]],
  mismatches(_, { coreSize }) {
    return coreSize === 8000 ? [] : ['iron-trap-88: this imp response needs an 8,000-cell core'];
  },
  emit(ctx) {
    const { L, P } = ctx, compare = L('compare'), hit = L('hit');
    ctx.ins('advance', 'ADD', 'F', L('increment'), `@${hit}`);
    ctx.ins('compare', 'CMP', 'I', String(P.GAP - 1), '-1');
    ctx.ins('', 'SLT', 'AB', '#20', `@${hit}`);
    ctx.ins('', 'DJN', 'B', L('advance'), '<7000');
    ctx.ins('', 'MOV', 'I', L('jump'), `@${compare}`);
    ctx.ins('hit', 'MOV', 'I', L('split'), `<${compare}`);
    ctx.ins('', 'SUB', 'F', L('bomb'), `@${hit}`);
    ctx.ins('recognize', 'CMP', 'I', `@${compare}`, L('imp'));
    ctx.ins('', 'JMN', 'B', compare, L('advance'));
    ctx.ins('spiral', 'MOV', 'I', L('split'), `<${compare}`);
    ctx.ins('', 'ADD', 'AB', '#2668', '@-1');
    ctx.ins('count', 'DJN', 'B', '-2', `#${P.STUN}`);
    ctx.ins('split', 'SPL', 'B', '0', `<${1 - P.GAP}`);
    ctx.ins('clear', 'MOV', 'I', '2', '<-3');
    ctx.ins('jump', 'JMP', 'B', '-1');
    ctx.ins('bomb', 'DAT', 'F', `<${-P.GAP}`, `<${-P.GAP - 1}`);
    ctx.ins('increment', 'DAT', 'F', `<${2 * P.GAP}`, `<${2 * P.GAP}`);
    ctx.ins('imp', 'MOV', 'I', '0', '2667');
  },
  plant({ at, norm, P }) {
    const struck = at('compare') + 2 * P.GAP - 1;
    return [[norm(struck), marker], [norm(struck + P.GAP), imp]];
  },
  watch({ vm, at, norm, P, scenario }) {
    const scan = at('compare'), spiral = at('spiral'), clear = at('clear');
    const planted = scenario === 'iron-trap-88: planted target';
    let hits = 0, previous = null, cleared = false;
    return {
      before(pc) {
        if (!planted) return null;
        if (pc === clear && hits === P.STUN) cleared = true;
        if (hits >= P.STUN || pc !== spiral) return null;
        return norm(scan + vm.peek(scan).b - 1);
      },
      after(target) {
        if (target === null) return;
        if (vm.peek(target).op !== 'SPL' || vm.writerPc[target] !== spiral ||
            (hits && target !== norm(previous + 2667))) {
          throw new Error('iron-trap-88: the spiral stun missed its target');
        }
        previous = target;
        hits++;
      },
      final() {
        if (planted && (hits !== P.STUN || !cleared)) {
          throw new Error('iron-trap-88: the planted imp did not cause a complete stun and clear handoff');
        }
      },
    };
  },
};

// John Metcalf's Shadow Seeker. SUB writes into the remote scan lane; the
// predecrement on the subsequent JMZ points that test at the same lane.
const shadowSeeker = {
  id: 'shadow-seeker-88', kind: 'body', exit: 'never', entry: 'check',
  entryFirst: false, processes: 1, grows: true, writes: 'core', attacks: 'all',
  purpose: 'A SUB-enhanced B-field scanner that blends a remote write with its probe, lays a backward SPL carpet and clears when its scan is interrupted.',
  params: { STEP: [30, 240], GAP: [2, 16] },
  defaults: { STEP: 70, GAP: 5 },
  mutable: [['check', ['a', 'b']], ['bomb', ['b']]],
  emit(ctx) {
    const { L, P } = ctx;
    const probe = 3 * P.STEP - 3;
    ctx.ins('adjust', 'ADD', 'AB', '#1', `@${L('check')}-1`);
    ctx.ins('carpet', 'MOV', 'I', L('split'), `<${L('bomb')}+2`);
    ctx.ins('', 'SUB', 'F', L('bomb'), L('check'));
    ctx.ins('check', 'SUB', 'F', String(probe), `<${probe + P.GAP + 1}`);
    ctx.ins('look', 'JMZ', 'B', `@${L('adjust')}`, `<${L('check')}`);
    ctx.ins('aim', 'MOV', 'I', L('check'), `@${L('carpet')}`);
    ctx.ins('', 'JMZ', 'B', `<${L('adjust')}`, '#0');
    ctx.ins('split', 'SPL', 'B', '0', `<${-P.STEP}`);
    ctx.ins('', 'MOV', 'I', L('bomb'), `<${L('check')}`);
    ctx.ins('bomb', 'DAT', 'F', `<${-P.STEP}`, `<${-P.STEP - 1}`);
  },
  plant({ at, norm, P }) {
    return [[norm(at('check') + 3 * P.STEP - 3), marker]];
  },
  watch({ vm, at, norm, P, scenario }) {
    const check = at('check'), aim = at('aim');
    const struck = norm(check + 3 * P.STEP - 3 + P.GAP);
    const carpet = at('carpet'), pointer = norm(at('bomb') + 2);
    let probed = false, aimed = false, painted = false;
    return {
      before(pc) {
        if (pc === aim && probed) aimed = true;
        if (!probed && pc === check) return { probe: true };
        if (aimed && !painted && pc === carpet) return { destination: norm(pointer + vm.peek(pointer).b - 1) };
        return null;
      },
      after(event) {
        if (!event) return;
        if (event.probe) probed = vm.writerPc[struck] === check && vm.peek(struck).b === norm(-1);
        else painted = vm.writerPc[event.destination] === carpet && vm.peek(event.destination).op === 'SPL';
      },
      final() {
        if (scenario === 'shadow-seeker-88: planted target' && !painted) {
          throw new Error('shadow-seeker-88: the planted write and probe did not lead to a carpet');
        }
      },
    };
  },
};

export default [ironTrap, shadowSeeker];
