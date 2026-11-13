// Small scanners with different commitments after a find.
const dat = { op: 'DAT', mod: 'F', aMode: '$', a: 0, bMode: '$', b: 1 };

const datScanner = {
  id: 'guarded-dat-scanner', kind: 'body', exit: 'never', writes: 'sparse', dialects: '94',
  entry: 'loop', entryFirst: false, processes: 1,
  purpose: 'Scout-style single-cell scanner. It checks both fields, guards its own eight-cell window, and drops one DAT at each find.',
  params: { STEP: [1, 54000] }, defaults: { STEP: 9 },
  mutable: [['ptr', ['b']]],
  mismatches(P, { coreSize, topology }) {
    return P.STEP % coreSize === 0 || topology === 'torus' ? ['guarded-dat-scanner needs a nonzero stride on a ring'] : [];
  },
  emit({ ins, L, P }) {
    const ptr = L('ptr'), loop = L('loop'), span = `${L('last')}+1-${ptr}`;
    ins('ptr', 'DAT', 'F', '#0', `#(${span})`);
    ins('bomb', 'DAT', 'F', '#0', '#0');
    ins('loop', 'ADD', 'AB', `#${P.STEP}`, ptr);
    ins('', 'JMZ', 'F', loop, `@${ptr}`);
    ins('', 'SLT', 'AB', `#(${span})`, ptr);
    ins('', 'JMP', 'B', loop);
    ins('hit', 'MOV', 'I', L('bomb'), `@${ptr}`);
    ins('last', 'JMP', 'B', loop);
  },
  plant(api) {
    for (let i = 1; i < api.core; i++) {
      const offset = api.norm(8 + i * api.P.STEP), target = api.norm(api.at('ptr') + offset);
      if (offset >= 8 && !api.inImage(target)) return [[target, dat]];
    }
    return [];
  },
};

const oneShot = {
  id: 'unrolled-oneshot', kind: 'body', exit: 'never', writes: 'core', attacks: 'all', dialects: '94',
  entry: 'scan', processes: 1, grows: true,
  purpose: 'Unrolls three paired probes per loop. On a difference it picks the occupied side, backs the gate up by LEAD, and clears backward in two writes per pass. TIME passes lay SPL before switching the same clear to DAT.',
  params: { STEP: [1, 54000], FIRST: [0, 54000], GAP: [1, 54000], LEAD: [1, 128], TIME: [32, 12000] },
  defaults: { STEP: 113, FIRST: 100, GAP: 601, LEAD: 12, TIME: 3500 },
  mutable: [['ptr', ['a', 'b']], ['gate', ['a', 'b']], ['count', ['b']]],
  mismatches(P, { coreSize, topology }) {
    return topology === 'torus' || P.STEP % coreSize === 0 || P.GAP % coreSize === 0 ? ['unrolled-oneshot needs a ring and distinct, moving probes'] : [];
  },
  emit({ ins, L, P }) {
    const scan = L('scan'), ptr = L('ptr'), gate = L('gate'), clear = L('clear');
    ins('scan', 'ADD', 'F', L('step'), ptr);
    ins('ptr', 'SNE', 'I', `${P.FIRST}`, `${P.FIRST + P.GAP}`);
    for (let i = 0; i < 2; i++) {
      ins('', 'ADD', 'F', L('step'), ptr);
      ins('', 'SNE', 'I', `*${ptr}`, `@${ptr}`);
    }
    ins('', 'JMP', 'B', scan);
    ins('', 'JMZ', 'F', L('useB'), `*${ptr}`);
    ins('', 'MOV', 'AB', ptr, ptr);
    ins('useB', 'MOV', 'B', ptr, gate);
    ins('', 'SUB', 'AB', `#${P.LEAD}`, gate);
    ins('feed', 'SPL', 'B', '#0', '0');
    ins('clear', 'MOV', 'I', L('bomb'), `<${gate}`);
    ins('', 'MOV', 'I', L('bomb'), `<${gate}`);
    ins('count', 'DJN', 'B', clear, `#${P.TIME}`);
    ins('', 'MOV', 'I', L('kill'), L('bomb'));
    ins('', 'JMP', 'B', clear);
    ins('bomb', 'SPL', 'B', '#0', '-8');
    ins('kill', 'DAT', 'F', '0', '-8');
    ins('gate', 'DAT', 'F', '0', '-8');
    ins('step', 'DAT', 'F', `#${P.STEP}`, `#${P.STEP}`);
  },
  plant(api) {
    const { P } = api, first = api.norm(api.at('ptr') + P.FIRST + P.STEP);
    return api.inImage(first) ? [] : [[first, dat]];
  },
  watch(api) {
    let cleared = false;
    return {
      before(pc) {
        if (pc === api.at('clear') && api.same(api.vm.peek(pc), api.code('clear'))) cleared = true;
      },
      final() {
        if (api.scenario === 'unrolled-oneshot: planted target' && !cleared) throw new Error('unrolled-oneshot: a paired find did not start the clear');
      },
    };
  },
};

const splDecoy = {
  id: 'spl-decoy-strip-88', kind: 'data', exit: 'data', processes: 0, writes: 'sparse',
  purpose: 'Inert SPL decoy strip with cycling backward A-fields and a repeating negative B-field among positive B-fields. Place after a boot using image.',
  params: { COUNT: [1, 96], CYCLE: [1, 31], SPACING: [1, 31], OFFSET: [0, 30], BACK: [1, 31] },
  defaults: { COUNT: 16, CYCLE: 5, SPACING: 3, OFFSET: 0, BACK: 6 },
  emit({ ins, P }) {
    for (let i = 0; i < P.COUNT; i++) {
      const b = (i + P.OFFSET) % P.SPACING === 0 ? -P.BACK : 1;
      ins(i ? '' : 'decoy', 'SPL', 'B', `${-((i + 1) % P.CYCLE)}`, `${b}`);
    }
  },
};

export default [datScanner, oneShot, splDecoy];
