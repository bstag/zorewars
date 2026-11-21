// Parameterized ports of Dave Hillis's Gymnosperm Trickery and Wayne
// Sheppard's Iron Sword. The defaults preserve the measured originals,
// using the distance-54 Iron Sword build from the 2027 niche review.
const ring8000 = (_, { coreSize }) => coreSize === 8000 ? [] : ['this block needs an 8,000-cell ring'];
const marker = { op: 'DAT', mod: 'F', aMode: '#', a: 17, bMode: '#', b: 123 };

const remoteCopyBomber = {
  id: 'gymnosperm-88', kind: 'body', exit: 'never', entry: 'launch',
  processes: 1, grows: true, writes: 'sparse', attacks: 'all',
  purpose: "Five-cell ICWS'88 evolved bomber. A pair of SPLs feeds a self-modifying MOV that deposits remote copies of its moving instruction.",
  params: { HOP: [512, 7488] },
  defaults: { HOP: 3432 },
  mismatches: ring8000,
  mutable: [['spread', ['b']]],
  knowledge: {
    parameterRoles: { HOP: 'Initial B-field of the moving instruction and offset of the first remote copy.' },
    failures: ['Changing the offset alone from 3432 to 3448 reduced fresh-seed field points.'],
    evidence: ['docs/tw2027-88-niches.md'],
  },
  emit(ctx) {
    const { L, P } = ctx;
    ctx.ins('launch', 'SPL', 'B', '0', '<-2');
    ctx.ins('', 'SPL', 'B', '0', '<-3');
    ctx.ins('feed', 'MOV', 'I', L('spread'), `<${L('spread')}`);
    ctx.ins('spread', 'MOV', 'I', '<0', `<${P.HOP}`);
    ctx.ins('loop', 'DJN', 'B', L('feed'), '<-6');
  },
  watch({ vm, at, norm, P, entered }) {
    const feed = at('feed');
    const firstCopy = norm(at('spread') + P.HOP - 1);
    let checked = false;
    return {
      before(pc) { return !checked && pc === feed; },
      after(firstFeed) {
        if (!firstFeed) return;
        if (vm.writerPc[firstCopy] !== feed || vm.peek(firstCopy).op !== 'MOV') {
          throw new Error('gymnosperm-88 missed its first remote copy');
        }
        checked = true;
      },
      final() {
        if (entered() && !checked) throw new Error('gymnosperm-88 did not feed its moving instruction');
      },
    };
  },
};

const sword = {
  id: 'iron-sword-88', kind: 'body', exit: 'never', entry: 'advance',
  processes: 1, grows: true, writes: 'core', attacks: 'all',
  purpose: "ICWS'88 comparison scanner that stuns with SPL/JMN and hands off to a three-point core clear.",
  params: { GAP: [24, 124] },
  defaults: { GAP: 54 },
  mismatches: ring8000,
  mutable: [['compare', ['a', 'b']], ['jump', ['b']]],
  knowledge: {
    parameterRoles: { GAP: 'Comparison gap, half the scan stride, and the clear pointer offset.' },
    tuning: ['34 is the published original. 54 improved the Coil 31 pairing on three fresh seeds.'],
    evidence: ['docs/tw2027-88-niches.md'],
  },
  emit(ctx) {
    const { L, P } = ctx;
    ctx.ins('advance', 'SUB', 'F', L('increment'), `@${L('stun')}`);
    ctx.ins('compare', 'CMP', 'I', `${P.GAP}`, '0');
    ctx.ins('', 'SLT', 'AB', '#20', `@${L('stun')}`);
    ctx.ins('', 'DJN', 'B', L('advance'), L('jump'));
    ctx.ins('attack', 'MOV', 'I', L('jump'), `@${L('compare')}`);
    ctx.ins('stun', 'MOV', 'I', L('split'), `<${L('compare')}`);
    ctx.ins('', 'SUB', 'F', L('clear'), L('compare'));
    ctx.ins('jump', 'JMN', 'B', '@-1', '#-20');
    ctx.ins('split', 'SPL', 'B', '0');
    ctx.ins('clear', 'MOV', 'I', `@${-P.GAP}`, `<${-P.GAP - 1}`);
    ctx.ins('', 'SUB', 'AB', '#2666', '@-1');
    ctx.ins('increment', 'DAT', 'F', `<${-2 * P.GAP}`, `<${-2 * P.GAP}`);
  },
  plant({ at, norm, P }) {
    return [[norm(at('compare') + 2 * P.GAP), marker]];
  },
  watch(api) {
    const { vm, at, norm, P, scenario } = api;
    const compare = at('compare');
    const target = norm(compare + 2 * P.GAP);
    const below = norm(target - 1);
    const attack = at('attack'), stun = at('stun'), clear = at('clear');
    let scanned = false, attacked = false, stunned = false, cleared = false;
    return {
      before(pc) {
        if (pc === compare && vm.peek(compare).op === 'SEQ') scanned = true;
        if (!cleared && pc === clear && vm.peek(clear).op === 'MOV' && vm.peek(clear).bMode === '<') {
          const pointer = norm(clear - P.GAP - 1);
          return { pc, to: norm(pointer + vm.peek(pointer).b - 1) };
        }
        return pc === attack || pc === stun ? { pc } : null;
      },
      after(step) {
        if (!step) return;
        const { pc, to } = step;
        if (pc === attack && vm.writerPc[target] === attack && vm.lastWrite[target] === vm.steps) attacked = true;
        if (pc === stun && vm.writerPc[below] === stun && vm.lastWrite[below] === vm.steps
          && vm.peek(below).op === 'SPL') stunned = true;
        if (pc === clear && vm.writerPc[to] === clear && vm.lastWrite[to] === vm.steps) cleared = true;
      },
      final() {
        if (api.entered() && !scanned) throw new Error('iron-sword-88 did not scan');
        if (scenario === 'iron-sword-88: planted target' && (!attacked || !stunned)) {
          throw new Error('iron-sword-88 missed the planted comparison pair');
        }
        // The quiet scan can run beyond the quick gate's 20,000-cycle horizon.
        if (api.entered() && !api.mayStop && vm.cycle === api.settings.maxCycles && !cleared) {
          throw new Error('iron-sword-88 did not reach its clear');
        }
      },
    };
  },
};

export default [remoteCopyBomber, sword];
