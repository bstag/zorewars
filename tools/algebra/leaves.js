// The blocks: small pieces of Redcode with a contract (docs/block-algebra.md).
// Each one declares its own parameters, what it needs and provides, how it
// exits and what it writes, and emits its code with local labels (ctx.L) and
// references to other blocks' capabilities (ctx.ref). The code is the same as
// tools/blocks/combo.js writes, so every combination there is a tree here.

// The step of an N-point imp spiral: N steps land one cell past the start. 0 when there is none.
export function modInverse(n, core) { for (let s = 1; s < core; s++) if ((n * s) % core === 1) return s; return 0; }

const OPENING = { kind: 'opening', exit: 'next', processes: 1, writes: 'sparse' };
const opener = (extra) => ({
  ...OPENING,
  mutable: [['probe', ['a', 'b']], ['clock', ['b']]],
  // Every opening keeps a probe (B: the last cell it touched) and a clock.
  provides: { probe: 'probe' },
  ...extra,
});

// Openings run for a while and hand on. All but the scan end in a link jump.
const openings = {
  'opening-none': opener({
    purpose: 'Hands on at once, with an empty probe.',
    params: {}, entry: 'opening', link: 'jump',
    state(ctx) {
      ctx.ins('probe', 'DAT', 'F', '#0', '#MAXLENGTH');
      ctx.ins('clock', 'DAT', 'F', '#0', '#128');
    },
    emit(ctx) { ctx.ins('opening', 'JMP', 'B', ctx.next); },
  }),
  'opening-bomber': opener({
    purpose: 'Drops WAIT DAT bombs STEP cells apart, then hands on (the probe holds the last bomb).',
    params: { WAIT: [1, 768], STEP: [1, 2048] }, entry: 'opening', link: 'jump',
    needs: ['datBomb'],
    state(ctx) {
      ctx.ins('probe', 'DAT', 'F', '#0', '#MAXLENGTH');
      ctx.ins('clock', 'DAT', 'F', '#0', `#${ctx.P.WAIT}`);
    },
    emit(ctx) {
      const { L, P } = ctx;
      ctx.ins('opening', 'ADD', 'AB', `#${P.STEP}`, L('probe'));
      ctx.ins(null, 'SLT', 'AB', '#(MAXLENGTH-1)', L('probe'));
      ctx.ins(null, 'JMP', 'B', L('tick'));
      ctx.ins('attackWrite', 'MOV', 'I', ctx.ref('datBomb'), `@${L('probe')}`);
      ctx.ins('tick', 'DJN', 'B', L('opening'), L('clock'));
    },
    // Bombs it should drop: those that miss its own image.
    expectedAttacks: (P, settings) => {
      let n = 0;
      for (let i = 1; i <= P.WAIT; i++) if (((settings.maxLength + i * P.STEP) % settings.coreSize) >= settings.maxLength) n++;
      return n;
    },
  }),
  'opening-bscan': opener({
    purpose: 'Probes WAIT cells STEP apart and stuns any that is not empty, then hands on.',
    params: { WAIT: [1, 768], STEP: [1, 2048] }, entry: 'opening', link: 'jump',
    needs: ['splBomb'],
    state(ctx) {
      ctx.ins('probe', 'DAT', 'F', '#0', '#MAXLENGTH');
      ctx.ins('clock', 'DAT', 'F', '#0', `#${ctx.P.WAIT}`);
    },
    emit(ctx) {
      const { L, P } = ctx;
      ctx.ins('opening', 'ADD', 'AB', `#${P.STEP}`, L('probe'));
      ctx.ins(null, 'SLT', 'AB', '#(MAXLENGTH-1)', L('probe'));
      ctx.ins(null, 'JMP', 'B', L('tick'));
      ctx.ins(null, 'JMZ', 'B', L('tick'), `@${L('probe')}`);
      ctx.ins('attackWrite', 'MOV', 'I', ctx.ref('splBomb'), `@${L('probe')}`);
      ctx.ins('tick', 'DJN', 'B', L('opening'), L('clock'));
    },
  }),
  'opening-cmpscan': opener({
    purpose: 'Compares pairs of cells GAP apart, SSTEP at a time, from START; hands on the first pair that differs, or the image boundary after SCANS tries.',
    params: { SSTEP: [1, 55439], GAP: [1, 31], START: [128, 54000], SCANS: [8, 256] }, entry: 'scan', link: 'fall',
    dialects: '94',
    state(ctx) {
      const { P } = ctx;
      ctx.ins('probe', 'DAT', 'F', `#${P.START}`, `#${P.START + P.GAP}`);
      ctx.ins('clock', 'DAT', 'F', '#0', `#${P.SCANS}`);
      ctx.ins('stride', 'DAT', 'F', `#${P.SSTEP}`, `#${P.SSTEP}`);
    },
    emit(ctx) {
      const { L, span } = ctx, probe = L('probe');
      ctx.ins('scan', 'ADD', 'F', L('stride'), probe);
      ctx.ins('', 'SLT', 'AB', `#${span - 1}`, probe); ctx.ins('', 'JMP', 'B', L('tick'));
      ctx.ins('', 'SLT', 'A', `#${span - 1}`, probe); ctx.ins('', 'JMP', 'B', L('tick'));
      ctx.ins('compare', 'SNE', 'I', `*${probe}`, `@${probe}`); ctx.ins('', 'JMP', 'B', L('tick')); ctx.ins('', 'JMP', 'B', L('found'));
      ctx.ins('tick', 'DJN', 'B', L('scan'), L('clock')); ctx.ins('', 'MOV', 'A', `#${span}`, probe);
      ctx.ins('found', 'MOV', 'AB', probe, probe);
    },
  }),
};

// Finishers run forever: core clears that spare the code they protect.
const finishers = {
  'finisher-counted': {
    kind: 'finisher', exit: 'never', processes: 1, writes: 'core', relocatable: true, protects: 'self',
    purpose: 'Clears everything but itself, pass after pass: an optional SPL stun phase (PHASE 1: STUN cells; 2: the whole core), then DAT.',
    params: { PHASE: [0, 2], STUN: [1, 4096], BACKWARD: [0, 1] }, entry: 'payload',
    provides: { datBomb: 'clearKill', splBomb: 'clearStun' },
    mutable: [['clearPtr', ['b']], ['remaining', ['b']]],
    writers: { stun: 'stunLoop', kill: 'killLoop' }, pointer: 'clearPtr',
    emit(ctx) {
      const { L, P, old } = ctx;
      const end = `${L('clearKill')}+1`, size = `(${end}-${L('payload')})`;
      const first = P.BACKWARD ? `(${L('payload')}-${L('clearPtr')})` : `(${end}-${L('clearPtr')})`;
      const target = P.BACKWARD ? `<${L('clearPtr')}` : old ? `@${L('clearPtr')}` : `>${L('clearPtr')}`;
      if (P.PHASE) {
        ctx.ins('payload', 'MOV', 'AB', `#${first}`, L('clearPtr'));
        ctx.ins(null, 'MOV', 'AB', P.PHASE === 2 ? `#(CORESIZE-${size})` : `#${P.STUN}`, L('remaining'));
        ctx.ins('stunLoop', 'MOV', 'I', L('clearStun'), target);
        if (old && !P.BACKWARD) ctx.ins(null, 'ADD', 'AB', '#1', L('clearPtr'));
        ctx.ins(null, 'DJN', 'B', L('stunLoop'), L('remaining'));
      } else ctx.mark('payload');
      ctx.ins('resetKill', 'MOV', 'AB', `#${first}`, L('clearPtr'));
      ctx.ins(null, 'MOV', 'AB', `#(CORESIZE-${size})`, L('remaining'));
      ctx.ins('killLoop', 'MOV', 'I', L('clearKill'), target);
      if (old && !P.BACKWARD) ctx.ins(null, 'ADD', 'AB', '#1', L('clearPtr'));
      ctx.ins(null, 'DJN', 'B', L('killLoop'), L('remaining'));
      ctx.ins(null, 'JMP', 'B', L('resetKill'));
      ctx.ins('clearPtr', 'DAT', 'F', '#0', '#0');
      ctx.ins('remaining', 'DAT', 'F', '#0', '#0');
      ctx.ins('clearStun', 'SPL', 'B', '0', '#0');
      ctx.ins('clearKill', 'DAT', 'F', '#0', '#0');
    },
  },
  'finisher-guarded': {
    kind: 'finisher', exit: 'never', processes: 1, writes: 'core', relocatable: false, protects: 'image',
    purpose: 'Clears forward from the probe, skipping the whole image: an optional SPL stun phase, then DAT.',
    params: { PHASE: [0, 2], STUN: [1, 4096] }, entry: 'payload',
    dialects: '94', needs: ['probe'],
    provides: (P) => (P.PHASE ? { datBomb: 'killBomb', splBomb: 'stunBomb' } : { datBomb: 'killBomb' }),
    mutable: [['remaining', ['b']]],
    writers: { stun: 'stunWrite', kill: 'killWrite' },
    state(ctx) { ctx.ins('remaining', 'DAT', 'F', '#0', `#${ctx.P.STUN}`); },
    emit(ctx) {
      const { L, P, span, core } = ctx, probe = ctx.ref('probe');
      ctx.mark('payload');
      if (P.PHASE) {
        ctx.ins('', 'MOV', 'AB', `#${P.PHASE === 2 ? core - span : P.STUN}`, L('remaining'));
        ctx.ins('stunGuard', 'SLT', 'AB', `#${span - 1}`, probe); ctx.ins('', 'MOV', 'AB', `#${span}`, probe);
        ctx.ins('stunWrite', 'MOV', 'I', L('stunBomb'), `>${probe}`); ctx.ins('', 'DJN', 'B', L('stunGuard'), L('remaining'));
      }
      ctx.ins('killGuard', 'SLT', 'AB', `#${span - 1}`, probe); ctx.ins('', 'MOV', 'AB', `#${span}`, probe);
      ctx.ins('killWrite', 'MOV', 'I', L('killBomb'), `>${probe}`); ctx.ins('', 'JMP', 'B', L('killGuard'));
      if (P.PHASE) ctx.ins('stunBomb', 'SPL', 'B', '#0', '#0');
      ctx.ins('killBomb', 'DAT', 'F', '#0', '#0');
    },
  },
};

// Bodies: whole strategies that run forever, alone or side by side.
const bodies = {
  stone: {
    kind: 'body', exit: 'never', processes: 1, writes: 'sparse', roams: false,
    purpose: 'Dwarf: a DAT (or SPL) bomb every TSTEP cells, forever; the first lands past the end of the warrior.',
    params: { TSTEP: [1, 4000], TBOMB: [0, 1] }, entry: 'tLoop',
    provides: (P) => (P.TBOMB ? { splBomb: 'tBomb' } : { datBomb: 'tBomb' }),
    mismatches: (P, settings) => (settings.dialect === '88' && P.TBOMB ? ["SPL bombs need ICWS'94"] : []),
    emit(ctx) {
      const { L, P } = ctx;
      ctx.ins('tLoop', 'ADD', 'AB', `#${P.TSTEP}`, L('tBomb'));
      ctx.ins('tMov', 'MOV', 'I', L('tBomb'), `@${L('tBomb')}`);
      ctx.ins('', 'JMP', 'B', L('tLoop'));
      ctx.ins('tBomb', P.TBOMB ? 'SPL' : 'DAT', P.TBOMB ? 'B' : 'F', '#0', `#${ctx.total - ctx.pc() - 1}`);
    },
  },
  spiral: {
    kind: 'body', exit: 'never', writes: 'sparse', roams: true, layout: 'last',
    purpose: 'Imp spiral: SN points, 2^SK - 1 imps, each lap entering one cell further on. Writes ahead of itself, so it is laid out last.',
    params: { SN: [3, 31], SK: [1, 6] }, entry: 'iStart',
    processes: (P) => 2 ** P.SK,                 // the launcher splits to 2^SK; one dies on its table
    mismatches: (P, settings) => [
      ...(modInverse(P.SN, settings.coreSize) ? [] : [`no ${P.SN}-point spiral on a ${settings.coreSize}-cell core`]),
      ...(2 ** P.SK - 1 < P.SN ? ['fewer spiral processes than points'] : []),
    ],
    emit(ctx) {
      const { L, P, core } = ctx, step = modInverse(P.SN, core), n = 2 ** P.SK - 1;
      for (let i = 0; i < P.SK; i++) ctx.ins(i ? '' : 'iStart', 'SPL', 'B', '1');
      ctx.ins('', 'JMP', 'B', `<${L('iTab')}`);
      ctx.ins('iTab', 'DAT', 'F', '#0', `#${n + 1}`);
      for (let i = n - 1; i >= 0; i--) ctx.ins('', 'JMP', 'B', `${L('iImp')}+${(i % P.SN) * step + Math.floor(i / P.SN)}`);
      ctx.ins('iImp', 'MOV', 'I', '0', `${step}`);
    },
  },
  paper: {
    kind: 'body', exit: 'never', processes: 8, grows: true, writes: 'sparse', roams: true,
    purpose: 'Silk: eight processes copy the paper PSTEP away, the distance changing by PDELTA each time.',
    params: { PSTEP: [100, 54000], PDELTA: [1, 54000] }, entry: 'pStart', dialects: '94',
    emit(ctx) {
      const { L, P } = ctx;
      for (let i = 0; i < 3; i++) ctx.ins(i ? '' : 'pStart', 'SPL', 'B', '1');
      ctx.ins('pSilk', 'SPL', 'B', `${P.PSTEP}`, '#0');
      ctx.ins('', 'MOV', 'I', `>${L('pSilk')}`, `}${L('pSilk')}`);
      ctx.ins('', 'ADD', 'A', `#${P.PDELTA}`, L('pSeed'));
      ctx.ins('', 'MOV', 'F', L('pSeed'), L('pSilk'));
      ctx.ins('', 'JMP', 'B', L('pSilk'));
      ctx.ins('pSeed', 'DAT', 'F', `#${P.PSTEP}`, '#0');
    },
  },
  vampire: {
    kind: 'body', exit: 'never', processes: 1, writes: 'sparse', roams: false, entryFirst: false,
    purpose: 'Drops a JMP fang every VSTEP cells, each aimed at its pit; processes that run one fall in and die.',
    params: { VSTEP: [1, 4000] }, entry: 'vStart',
    emit(ctx) {
      const { L, P } = ctx;
      ctx.ins('vStep', 'DAT', 'F', `#${-P.VSTEP}`, `#${P.VSTEP}`);
      ctx.ins('vStart', 'ADD', 'F', L('vStep'), L('vFang'));
      ctx.ins('vMov', 'MOV', 'I', L('vFang'), `@${L('vFang')}`);
      ctx.ins('', 'JMP', 'B', L('vStart'));
      const skip = ctx.total - ctx.pc() - 2;          // cells after the pit
      ctx.ins('vFang', 'JMP', 'B', skip ? `${L('vPit')}-${skip}` : L('vPit'), `${skip}`);
      ctx.ins('vPit', 'DAT', 'F', '#0', '#0');
    },
  },
};

// Data: cells that are never run.
const data = {
  decoys: {
    kind: 'data', exit: 'data', processes: 0, writes: 'sparse',
    purpose: 'DECOYS cells for scanners to find: DAT, SPL, or SPL with varied fields.',
    params: { DECOYS: [1, 18], DECOY: [0, 2] },
    mismatches: (P, settings) => (settings.dialect === '88' && P.DECOY ? ["SPL decoys need ICWS'94"] : []),
    emit(ctx) {
      const { P } = ctx;
      for (let i = 0; i < P.DECOYS; i++) ctx.ins('', P.DECOY === 0 ? 'DAT' : 'SPL', P.DECOY === 0 ? 'F' : 'B',
        P.DECOY === 2 ? `#${i * 73 + 1}` : '#1', P.DECOY === 2 ? `#${i * 137 + 7}` : '#1');
    },
  },
};

export const leaves = { ...openings, ...finishers, ...bodies, ...data };
for (const [id, b] of Object.entries(leaves)) {
  b.id = id;
  b.defaults ??= Object.fromEntries(Object.entries(b.params).map(([k, [lo]]) => [k, lo]));
}
// Defaults that run well: the same as combo's.
Object.assign(leaves['opening-bomber'].defaults, { WAIT: 128, STEP: 997 });
Object.assign(leaves['opening-bscan'].defaults, { WAIT: 128, STEP: 997 });
Object.assign(leaves['opening-cmpscan'].defaults, { SSTEP: 997, GAP: 7, START: 512, SCANS: 64 });
Object.assign(leaves['finisher-counted'].defaults, { PHASE: 1, STUN: 64, BACKWARD: 0 });
Object.assign(leaves['finisher-guarded'].defaults, { PHASE: 1, STUN: 64 });
Object.assign(leaves.stone.defaults, { TSTEP: 4, TBOMB: 0 });
Object.assign(leaves.spiral.defaults, { SN: 13, SK: 4 });
Object.assign(leaves.paper.defaults, { PSTEP: 1777, PDELTA: 1013 });
Object.assign(leaves.vampire.defaults, { VSTEP: 7 });
Object.assign(leaves.decoys.defaults, { DECOYS: 6, DECOY: 0 });
