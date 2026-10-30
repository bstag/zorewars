// Scanners: blocks that look for the opponent and react to what they find.
// Two openings (an unrolled quickscan and a fast SNE scan) hand the cell they
// found on through `probe`, like opening-cmpscan; two bodies scan forever and
// bomb what they find, skipping their own image. How to write a block:
// docs/block-algebra.md.

const OPENING = { kind: 'opening', exit: 'next', processes: 1, writes: 'sparse', link: 'fall' };
// What a planted opponent looks like: a cell no empty core holds.
const MARKER = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };
const mod = (x, core) => ((x % core) + core) % core;

// Openings: watch for the moment control leaves the block's code and check
// the probe then. `check(probeB)` throws when it is wrong.
function onExit(api, check) {
  let prevInSelf = false, exited = false;
  return {
    before(pc) {
      if (prevInSelf && !api.inSelf(pc) && !exited) { exited = true; check(api.vm.peek(api.at('probe')).b); }
      prevInSelf = api.inSelf(pc);
      return null;
    },
    exited: () => exited,
  };
}
// The probe is at the image boundary: the cell before it is ours, the cell itself is not.
const atBoundary = (api, b) => api.inImage(api.at('probe') + b - 1) && !api.inImage(api.at('probe') + b);

// The quickscan's table: N pairs (X, X + GAP), X = START + k SPACING from the probe.
const quickTable = (P, core) => Array.from({ length: P.N }, (_, k) => mod(P.START + k * P.SPACING, core));

const openings = {
  'opening-quickscan': {
    ...OPENING,
    purpose: 'Unrolled quickscan: compares N fixed pairs of cells (GAP apart, SPACING apart from START) in about N cycles; hands on a pair that differs, or the image boundary.',
    params: { START: [1, 54000], SPACING: [1, 27000], GAP: [1, 4000], N: [4, 12] }, entry: 'qScan',
    dialects: '94',
    provides: { probe: 'probe' },
    mutable: [['probe', ['a', 'b']]],
    mismatches(P, settings) {
      const core = settings.coreSize, room = settings.maxLength;
      // Every probed cell must be outside the image wherever the probe sits in it.
      return quickTable(P, core).some((x) => x < room || x + P.GAP > core - room) ? ['a quickscan probe lands on or next to the warrior itself'] : [];
    },
    state(ctx) { ctx.ins('probe', 'DAT', 'F', '#0', `#${ctx.span}`); },
    emit(ctx) {
      const { L, P, core } = ctx, probe = L('probe');
      // SEQ skips the MOV when the pair is equal: one cycle per empty pair. A pair
      // that differs leaves its first cell in the probe (the last such pair wins).
      quickTable(P, core).forEach((x, k) => {
        ctx.ins(k ? '' : 'qScan', 'SEQ', 'I', `${probe}+${x}`, `${probe}+${x + P.GAP}`);
        ctx.ins(k === P.N - 1 ? 'qLast' : '', 'MOV', 'AB', `#${x}`, probe);
      });
    },
    plant(api) {
      const x = quickTable(api.P, api.core)[Math.floor(api.P.N / 2)];
      return [[api.at('probe') + x, MARKER]];
    },
    watch(api) {
      const table = quickTable(api.P, api.core);
      const planted = api.scenario === 'opening-quickscan: planted target';
      const seesSelf = table.some((x) => api.inImage(api.at('probe') + x) || api.inImage(api.at('probe') + x + api.P.GAP));
      const exit = onExit(api, (b) => {
        if (planted && b !== table[Math.floor(api.P.N / 2)]) throw new Error('The quickscan did not hand on the planted cell');
        if (api.scenario === 'alone' && !seesSelf && !atBoundary(api, b)) throw new Error('The quickscan found nothing but did not hand on the image boundary');
      });
      return { before: exit.before, final: () => { if (planted && !exit.exited()) throw new Error('The quickscan never handed on'); } };
    },
  },
  'opening-sne': {
    ...OPENING,
    purpose: 'Fast scan: two pairs of cells (GAP apart) per loop, STEP apart, for SCANS loops from START; hands on the first pair that differs, or the image boundary.',
    params: { START: [1, 54000], STEP: [2, 4000], GAP: [1, 2000], SCANS: [1, 4000] }, entry: 'sScan',
    dialects: '94',
    provides: { probe: 'probe' },
    mutable: [['probe', ['a', 'b']], ['clock', ['b']]],
    mismatches(P, settings) {
      const core = settings.coreSize, room = settings.maxLength;
      const out = [];
      if (P.START + P.STEP < room) out.push('the SNE scan starts inside the warrior');
      if (P.START + 2 * P.SCANS * P.STEP + P.GAP > core - room) out.push('the SNE scan runs on into the warrior itself');
      return out;
    },
    state(ctx) {
      const { P } = ctx;
      ctx.ins('probe', 'DAT', 'F', `#${P.START}`, `#${P.START + P.GAP}`);
      ctx.ins('clock', 'DAT', 'F', '#0', `#${P.SCANS}`);
      ctx.ins('stride', 'DAT', 'F', `#${P.STEP}`, `#${P.STEP}`);
    },
    emit(ctx) {
      const { L, span } = ctx, probe = L('probe');
      // SNE skips when the pair differs: a hit at the first SNE skips the step and
      // the second SNE sees the same pair; a hit at the second skips the DJN.
      ctx.ins('sScan', 'ADD', 'F', L('stride'), probe);
      ctx.ins('', 'SNE', 'I', `*${probe}`, `@${probe}`);
      ctx.ins('', 'ADD', 'F', L('stride'), probe);
      ctx.ins('', 'SNE', 'I', `*${probe}`, `@${probe}`);
      ctx.ins('', 'DJN', 'B', L('sScan'), L('clock'));
      // Out of the loop: by a hit (the clock is left above zero) or because it ran out.
      ctx.ins('', 'JMN', 'B', L('found'), L('clock'));
      ctx.ins('', 'MOV', 'A', `#${span}`, probe);
      ctx.ins('found', 'MOV', 'AB', probe, probe);
    },
    plant(api) { return [[api.at('probe') + api.P.START + 3 * api.P.STEP, MARKER]]; },
    watch(api) {
      const planted = api.scenario === 'opening-sne: planted target';
      const clock = () => api.vm.peek(api.at('clock')).b;
      const exit = onExit(api, (b) => {
        if (planted && b !== mod(api.P.START + 3 * api.P.STEP, api.core)) throw new Error('The SNE scan did not hand on the planted cell');
        if (planted && clock() === 0) throw new Error('The SNE scan ran out of scans despite a hit');
        if (api.scenario === 'alone' && (clock() !== 0 || !atBoundary(api, b))) throw new Error('The SNE scan stopped early, or did not hand on the image boundary');
      });
      return { before: exit.before, final: () => { if (planted && !exit.exited()) throw new Error('The SNE scan never handed on'); } };
    },
  },
};

// Bodies: scan forever with a pointer cell (ptr, B = offset of the next cell
// to look at) and bomb what isn't empty. The guard runs only on a hit, so the
// scan loop stays two cycles a cell: the target is bombed only if its offset d
// lies in [span - idx, core - idx - WIDTH], idx being the pointer's place in
// the image, so neither the image nor the cells after a hit reach it.
function scanBody(ctx, { fields, bomb, width }) {
  const { L, P, old, core, span } = ctx, ptr = L('ptr');
  const loop = 'sLoop', compare = old && fields === 'F';
  // '88 has no JMZ.F, so it compares each cell with an empty one, copied from
  // far away at the start (an empty cell is DAT $0, $0, which '88 can't write).
  if (compare) ctx.ins('sInit', 'MOV', 'I', `${L('empty')}+${Math.floor(core / 2)}`, L('empty'));
  else ctx.mark('sInit');
  ctx.ins(loop, 'ADD', 'AB', `#${P.STEP}`, ptr);
  if (compare) {
    ctx.ins('sLook', 'CMP', 'I', `@${ptr}`, L('empty'));
    ctx.ins('', 'JMP', 'B', L('sHit'));
    ctx.ins('', 'JMP', 'B', L(loop));
  } else ctx.ins('sLook', 'JMZ', fields, L(loop), `@${ptr}`);
  // Sizes don't depend on span; the pointer's index does not either.
  const after = 5 + 2 * width;                     // instructions between here and ptr
  const idx = ctx.pc() + after;
  ctx.ins('sHit', 'SLT', 'AB', `#${span - idx - 1}`, ptr);
  ctx.ins('', 'JMP', 'B', L(loop));
  ctx.ins('', 'SLT', 'AB', `#${core - idx - width}`, ptr);
  ctx.ins('', 'JMP', 'B', L('sBomb'));
  ctx.ins('', 'JMP', 'B', L(loop));
  for (let i = 0; i < width; i++) {
    if (i) ctx.ins('', 'ADD', 'AB', '#1', ptr);
    ctx.ins(i ? '' : 'sBomb', 'MOV', 'I', L('bomb'), `@${ptr}`);
  }
  ctx.ins('', 'JMP', 'B', L(loop));
  if (ctx.pc() !== idx && ctx.total) throw new Error('scanner layout');
  // The first cell looked at is one STEP past the end of the image.
  ctx.ins('ptr', 'DAT', 'F', '#0', `#${span - idx - P.STEP}`);
  if (bomb === 'SPL') ctx.ins('bomb', 'SPL', 'B', old ? '0' : '#0', old ? '0' : '#0');
  else ctx.ins('bomb', 'DAT', 'F', '#0', '#0');
  if (compare) ctx.ins('empty', 'DAT', 'F', '#0', '#0');
}

// Watch a scanning body: every bomb misses its own code and any live code of
// the warrior; it bombs the planted cell; alone, it looks at many cells.
function watchScan(api, id) {
  const ptr = api.at('ptr'), core = api.core;
  const planted = api.scenario === `${id}: planted target`;
  const target = plantedCell(api);
  let looks = 0, bombs = 0, hitPlanted = false;
  const live = (t) => api.vm.processes(0).some((q) => mod(t - q + api.settings.maxLength, core) < 2 * api.settings.maxLength);
  return {
    before(pc) {
      if (pc === api.at('sLook')) looks++;
      // Every MOV in the block but the '88 set-up bombs @ptr.
      if (!api.inSelf(pc) || pc === api.at('sInit') || api.vm.peek(pc).op !== 'MOV') return null;
      return mod(ptr + api.vm.peek(ptr).b, core);
    },
    after(t) {
      if (t === null) return;
      if (api.inSelf(t) || (api.inImage(t) && live(t))) throw new Error(`${id} bombed its own warrior`);
      if (!api.same(api.vm.peek(t), api.code('bomb'))) throw new Error(`${id} dropped something other than its bomb`);
      bombs++;
      if (t === target) hitPlanted = true;
    },
    final() {
      if (planted && !hitPlanted) throw new Error(`${id} ignored the planted target`);
      // Alone, the core is empty but for the warrior: lots of looking, no bombing.
      if (api.alone && looks < 1000) throw new Error(`${id} looked at too few cells`);
      if (api.alone && bombs) throw new Error(`${id} bombed an empty core`);
    },
  };
}
// The planted target: the first cell the scan looks at (one STEP at a time from
// the pointer's start) that is outside the image, a few steps in.
function plantedCell(api) {
  const ptr = api.at('ptr'), d0 = api.code('ptr').b;
  let found = 0;
  for (let k = 1; k < 1000; k++) {
    const c = mod(ptr + d0 + k * api.P.STEP, api.core);
    if (!api.inImage(c) && !api.inImage(c + 8) && !api.inImage(c - 8) && ++found === 3) return c;
  }
  return -1;
}

const BODY = { kind: 'body', exit: 'never', processes: 1, writes: 'sparse', roams: false, entry: 'sInit' };
const bodies = {
  scanner: {
    ...BODY,
    purpose: 'Scans one cell every STEP, forever, and drops a bomb (BOMB 0: DAT; 1: SPL stun) on every non-empty cell outside its own image.',
    params: { STEP: [1, 27719], BOMB: [0, 1] },
    loop: 'sLoop',
    provides: (P) => (P.BOMB ? { splBomb: 'bomb' } : { datBomb: 'bomb' }),
    mutable: [['ptr', ['b']]],
    emit(ctx) { scanBody(ctx, { fields: 'F', bomb: ctx.P.BOMB ? 'SPL' : 'DAT', width: 1 }); },
    plant(api) { return [[plantedCell(api), MARKER]]; },
    watch: (api) => watchScan(api, 'scanner'),
  },
  'bscan-body': {
    ...BODY,
    purpose: 'B-field scanner: looks at one B-field every STEP, forever, and stuns WIDTH cells with SPL bombs wherever it is not zero, outside its own image.',
    params: { STEP: [1, 27719], WIDTH: [1, 4] },
    loop: 'sLoop',
    provides: { splBomb: 'bomb' },
    mutable: [['ptr', ['b']]],
    emit(ctx) { scanBody(ctx, { fields: 'B', bomb: 'SPL', width: ctx.P.WIDTH }); },
    plant(api) { return [[plantedCell(api), MARKER]]; },
    watch: (api) => watchScan(api, 'bscan-body'),
  },
};

const blocks = { ...openings, ...bodies };
for (const [id, b] of Object.entries(blocks)) b.id = id;
// Defaults that work on every rule set they support (8,000 and 55,440 cores).
blocks['opening-quickscan'].defaults = { START: 300, SPACING: 650, GAP: 8, N: 12 };
blocks['opening-sne'].defaults = { START: 100, STEP: 16, GAP: 8, SCANS: 240 };
// 2341 is prime to 8,000 and 55,440: the scan reaches every cell.
blocks.scanner.defaults = { STEP: 2341, BOMB: 0 };
blocks['bscan-body'].defaults = { STEP: 2341, WIDTH: 2 };

export default Object.values(blocks);
