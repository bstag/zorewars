// Stones and bombs: bodies that drop something every STEP cells, forever.
// How to write a block: docs/block-algebra.md.
//
// Every bomber here is layout-safe. Unguarded, its bombs land only on one
// residue class modulo g = gcd(STEP, CORESIZE) (or a few consecutive ones, for
// a carpet or a pair), and it lays out its pointer so those classes meet its
// own code only on its bomb cells, each written over itself: whatever offset
// the block gets inside a larger tree, it never bombs its own loop.
// `mismatches` refuses a step whose classes would meet a cell the loop needs.
// The first bomb lands past the end of the whole warrior; later laps do meet
// partners' cells, as any stone's would. GUARD 1 spends two more instructions
// a pass to skip every target inside the warrior, so partners are spared too
// (and then any step is safe).

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const mod = (x, n) => ((x % n) + n) % n;

// The offset from the anchor (the first bomb cell, at local index pc) to the
// first cell of its residue class past the end of the warrior.
const firstOffset = (ctx, pc, g) => g * Math.max(1, Math.ceil((ctx.total - pc) / g));

// The shared loop. o: {
//   pf: label prefix; step; below: cells a pass writes below the pointer's
//   target (they are written top down); shared: the first bomb holds the
//   pointer (unguarded only); twoField: count A as well (a second pointer, via
//   an inc cell); a0(F, g): that A-field; jmpB: the loop JMP's B-field;
//   writes(ptr): the writing instructions; bombs: [label, op, mod, a, b] cells,
//   the first one the anchor }.
// Layout: loop ADD; ['88 guard: ADD to pos]; [guard: SLT, JMP]; writes; JMP;
// [guard: more skip JMPs]; [ptr]; bombs; [inc]; ['88 guard: pos].
const ptrOf = (o, P) => (o.shared && !P.GUARD ? o.bombs[0][0] : `${o.pf}Ptr`);
function emitLoop(ctx, o) {
  const { L, P, old, core } = ctx, pf = o.pf, g = gcd(o.step, core), guard = !!P.GUARD;
  const ptr = L(ptrOf(o, P)), loop = `${pf}Loop`, incB = o.step + o.below;
  const twoF = guard ? !old : !!o.twoField;
  ctx.ins(loop, 'ADD', twoF ? 'F' : 'AB', twoF ? L(`${pf}Inc`) : `#${incB}`, ptr);
  if (guard && old) ctx.ins('', 'ADD', 'AB', `#${o.step}`, L(`${pf}Pos`));
  if (guard) {
    // The A-field (or pos) counts the target's index in the warrior: bomb only past its end.
    ctx.ins(`${pf}Guard`, 'SLT', old ? 'AB' : 'A', `#${ctx.total - 1 + o.below}`, old ? L(`${pf}Pos`) : ptr);
    // Skipping, the pointer must still fall by the cells a pass writes below it: the skip JMPs predecrement it.
    ctx.ins('', 'JMP', 'B', L(o.below > 1 ? `${pf}Skip1` : loop), o.below ? `<${ptr}` : '0');
  }
  o.writes(ptr);
  ctx.ins(`${pf}Jmp`, 'JMP', 'B', L(loop), o.jmpB ?? '0');
  if (guard) for (let i = 1; i < o.below; i++) ctx.ins(`${pf}Skip${i}`, 'JMP', 'B', L(i + 1 < o.below ? `${pf}Skip${i + 1}` : loop), `<${ptr}`);
  const ptrAt = ctx.pc(), shared = o.shared && !guard, anchor = shared ? ptrAt : ptrAt + 1;
  const F = firstOffset(ctx, anchor, g), p = anchor + F + o.below;   // p: index of the first cell @ptr reaches
  const b0 = p - ptrAt - incB, a0 = guard && !old ? p - o.step : o.a0 ? o.a0(F, g) : 0;
  if (!shared) ctx.ins(`${pf}Ptr`, 'DAT', 'F', `#${a0}`, `#${b0}`);
  o.bombs.forEach(([label, op, m, a, b], i) => {
    if (i || !shared) ctx.ins(label, op, m, a, b);
    else ctx.ins(label, op, m, op === 'DAT' ? `#${a0}` : a, `#${b0}`);
  });
  if (twoF) ctx.ins(`${pf}Inc`, 'DAT', 'F', `#${o.step}`, `#${incB}`);
  if (guard && old) ctx.ins(`${pf}Pos`, 'DAT', 'F', '#0', `#${p - o.step}`);
}

// Why this loop can't use this step. Unguarded: lay it out, and check that no
// cell it needs shares a residue with a write; a bomb cell may take the write
// that puts its own copy there (`self`: label -> distance from the anchor), and
// `dead` cells (a launcher that has finished) may take anything.
function loopMismatches(block, P, settings) {
  const core = settings.coreSize, cells = [];
  const ctx = { L: (x) => x, P, old: settings.dialect === '88', core, settings, total: 0, span: 0, pc: () => cells.length,
    ins: (label) => cells.push(label ?? ''), mark: () => {}, ref: (c) => c, next: '' };
  const o = block.loopOf(P, ctx, core), g = gcd(o.step, core), out = [];
  if (core / g < 100) out.push(`${block.id}: STEP ${o.step} reaches only ${core / g} cells of the core`);
  if (P.GUARD) return out;
  block.emit(ctx);
  const anchor = cells.indexOf(o.bombs[0][0]), self = o.self ?? { [o.bombs[0][0]]: 0 };
  const clash = cells.some((label, i) => !(o.dead ?? []).includes(label) && Array.from({ length: o.below + 1 }, (_, h) => h)
    .some((h) => mod(i - anchor - h, g) === 0 && self[label] !== h));
  if (clash) out.push(`${block.id}: STEP ${o.step} has gcd ${g} with the ${core}-cell core, so its bombs would land on its own loop`);
  return out;
}

// A watch for bombers: every write lands where its pointer says, writes the
// right thing, never hits its own loop (nor, guarded, the warrior), and the
// first lands past the warrior. Quantities only when alone.
function bombWatch(api, o, { writes, check, min = 100, what = 'bombs' }) {
  const ptr = ptrOf(o, api.P), old = api.settings.dialect === '88', incB = o.step + o.below;
  const target = { '@': (a) => a.at(ptr) + a.vm.peek(a.at(ptr)).b, '<': (a) => a.at(ptr) + a.vm.peek(a.at(ptr)).b - 1, '*': (a) => a.at(ptr) + a.vm.peek(a.at(ptr)).a };
  const at = new Map(Object.keys(writes).map((l) => [api.at(l), l]));
  const self = o.self ?? { [o.bombs[0][0]]: 0 }, harmless = new Set(Object.keys(self).map((l) => api.at(l)));
  for (const l of o.dead ?? []) harmless.add(api.at(l));
  // Guarded: the warrior, from the index of the pointer cell in it (its count less its pointer) and the SLT's limit.
  let inWarrior = () => false;
  if (api.P.GUARD) {
    const count = old ? api.code(`${o.pf}Pos`).b : api.code(`${o.pf}Ptr`).a;
    const index = api.norm(count + o.step - (api.code(`${o.pf}Ptr`).b + incB));
    const start = api.at(`${o.pf}Ptr`) - index, size = api.norm(api.code(`${o.pf}Guard`).a) - o.below + 1;
    inWarrior = (t) => api.norm(t - start) < size;
  }
  const cells = new Set();
  let first = true;
  return {
    before: (pc) => { const l = at.get(pc); return l && api.same(api.vm.peek(pc), api.code(l)) ? [l, api.norm(target[writes[l]](api))] : null; },
    after: (token) => {
      if (!token) return;
      const [l, t] = token;
      if (api.inSelf(t) && !harmless.has(t)) throw new Error(`${o.id} bombed its own code`);
      if (inWarrior(t)) throw new Error(`The guarded ${o.id} bombed the warrior`);
      if (first && api.inImage(t)) throw new Error(`${o.id}'s first bomb landed inside the warrior`);
      first = false;
      const bad = check(api, t, l, api.vm.peek(t));
      if (bad) throw new Error(bad);
      cells.add(t);
    },
    final: () => { if (api.alone && cells.size < min) throw new Error(`${o.id}: too few ${what} (${cells.size} cells)`); },
  };
}
const sameOp = (api, cell, local) => { const c = api.code(local); return cell.op === c.op && cell.aMode === c.aMode && api.norm(cell.a) === api.norm(c.a); };
const isDat = (id) => (a, t, l, cell) => (cell.op === 'DAT' ? null : `${id} wrote ${cell.op}, not its DAT bomb`);

const BOMBER = { kind: 'body', exit: 'never', writes: 'sparse', roams: false };
function bomber(id, def) {
  return {
    ...BOMBER, ...def, id,
    params: def.guard === false ? def.params : { ...def.params, GUARD: [0, 1] },
    entry: def.entry ?? `${def.pf}Loop`, loop: `${def.pf}Loop`,
    mutable: [[`${def.pf}Ptr`, ['a', 'b']], [`${def.pf}Pos`, ['b']], ...(def.mutable ?? [])],
    mismatches: (P, settings) => [...(def.refuse?.(P, settings) ?? []), ...loopMismatches(blocks[id], P, settings)],
    emit(ctx) { def.before?.(ctx); emitLoop(ctx, def.loopOf(ctx.P, ctx, ctx.core)); },
    watch: (api) => def.watchWith(api, (w) => bombWatch(api, { ...def.loopOf(api.P, null, api.core), id }, w)),
  };
}

const blocks = {};
const add = (id, def) => { blocks[id] = bomber(id, def); };

add('mod-stone', {
  pf: 'ms', processes: 1,
  purpose: 'A layout-safe Dwarf: a DAT every STEP cells (gcd(STEP, core) keeps it off its own loop); BOMBS 2 adds a second DAT half a core away each pass; GUARD 1 skips every target inside the warrior, so it spares its partners too.',
  params: { STEP: [1, 4000], BOMBS: [1, 2] },
  provides: { datBomb: 'msBomb' },
  mutable: [['msBomb', ['a', 'b']]],
  refuse: (P, settings) => [
    ...(P.BOMBS === 2 && settings.dialect === '88' ? ["mod-stone: two bombs a pass need ICWS'94 (A-field indirection)"] : []),
    ...(P.BOMBS === 2 && P.GUARD ? ['mod-stone: the guard counts in the A-field, so a guarded stone drops one bomb a pass'] : []),
  ],
  loopOf(P, ctx, core) {
    return {
      pf: 'ms', step: P.STEP, below: 0, shared: true, twoField: P.BOMBS === 2,
      a0: (F, g) => F + g * Math.round(core / 2 / g) - P.STEP,
      writes: (ptr) => {
        ctx.ins('msMov', 'MOV', 'I', ctx.L('msBomb'), `@${ptr}`);
        if (P.BOMBS === 2) ctx.ins('msMov2', 'MOV', 'I', ctx.L('msBomb'), `*${ptr}`);
      },
      bombs: [['msBomb', 'DAT', 'F', '#0', '#0']],
    };
  },
  watchWith: (api, w) => w({ writes: api.P.BOMBS === 2 ? { msMov: '@', msMov2: '*' } : { msMov: '@' }, check: isDat('mod-stone'), min: api.P.BOMBS === 2 ? 200 : 100 }),
});

add('spl-stone', {
  pf: 'ss', entry: 'ssFeed', guard: false,   // a guard's check and write would race between processes
  processes: (P) => P.PROCS,
  purpose: 'A self-splitting stone: its own SPL feeds PROCS processes into one layout-safe Dwarf loop (a DAT every STEP cells), so a hit on one process does not stop it.',
  params: { STEP: [1, 4000], PROCS: [2, 64] },
  provides: { datBomb: 'ssBomb' },
  mutable: [['ssJmp', ['b']], ['ssBomb', ['b']]],
  refuse: (P, settings) => (P.PROCS > settings.maxProcesses ? [`spl-stone: ${P.PROCS} processes; this hill allows ${settings.maxProcesses}`] : []),
  // The feeder: SPL a process into the loop, PROCS - 1 times (the count is the loop JMP's B-field); then join it.
  before(ctx) {
    ctx.ins('ssFeed', 'SPL', 'B', ctx.L('ssLoop'));
    ctx.ins('ssDjn', 'DJN', 'B', ctx.L('ssFeed'), ctx.L('ssJmp'));
  },
  loopOf(P, ctx, core) {
    return {
      pf: 'ss', step: P.STEP, below: 0, shared: true, jmpB: `#${P.PROCS - 1}`, dead: ['ssFeed', 'ssDjn'],
      writes: (ptr) => ctx.ins('ssMov', 'MOV', 'I', ctx.L('ssBomb'), `@${ptr}`),
      bombs: [['ssBomb', 'DAT', 'F', '#0', '#0']],
    };
  },
  watchWith: (api, w) => {
    const hooks = w({ writes: { ssMov: '@' }, check: isDat('spl-stone') });
    return {
      ...hooks,
      final: () => {
        hooks.final();
        // Every process it launched is still in its loop.
        const start = api.at('ssLoop'), size = api.at('ssJmp') - start + 1;
        const n = api.vm.processes(0).filter((q) => api.norm(q - start) < size).length;
        if (api.alone && n !== api.P.PROCS) throw new Error(`spl-stone runs ${n} processes in its loop, not ${api.P.PROCS}`);
      },
    };
  },
});

add('jmp-bomber', {
  pf: 'jb', processes: 1,
  purpose: 'Drops stun bombs every STEP cells (layout-safe): JMP 0, which traps a process that runs it in place, or with BOMB 1 SPL 0, which also floods its warrior with useless processes.',
  params: { STEP: [1, 4000], BOMB: [0, 1] },
  provides: (P) => (P.BOMB ? { splBomb: 'jbBomb' } : {}),
  mutable: [['jbBomb', ['b']]],
  loopOf(P, ctx, core) {
    return {
      pf: 'jb', step: P.STEP, below: 0, shared: true,
      writes: (ptr) => ctx.ins('jbMov', 'MOV', 'I', ctx.L('jbBomb'), `@${ptr}`),
      bombs: [['jbBomb', P.BOMB ? 'SPL' : 'JMP', 'B', '0', '#0']],
    };
  },
  watchWith: (api, w) => w({
    writes: { jbMov: '@' }, what: 'traps',
    check: (a, t, l, cell) => (sameOp(a, cell, 'jbBomb') && a.norm(cell.a) === 0 ? null : `jmp-bomber wrote ${cell.op} ${cell.a}, not a ${a.P.BOMB ? 'SPL' : 'JMP'} 0 trap`),
  }),
});

add('carpet-bomber', {
  pf: 'cb', processes: 1,
  purpose: 'Lays a carpet of WIDTH consecutive DATs every STEP cells (layout-safe: gcd(STEP, core) must leave room for the carpet beside its loop).',
  params: { STEP: [1, 4000], WIDTH: [2, 4] },
  provides: { datBomb: 'cbBomb' },
  // The pointer has its own cell: a predecrement write over the cell that holds
  // the pointer would put back the value it had before the decrement.
  loopOf(P, ctx, core) {
    return {
      pf: 'cb', step: P.STEP, below: P.WIDTH - 1,
      writes: (ptr) => {
        ctx.ins('cbTop', 'MOV', 'I', ctx.L('cbBomb'), `@${ptr}`);
        for (let i = 1; i < P.WIDTH; i++) ctx.ins(`cbRow${i}`, 'MOV', 'I', ctx.L('cbBomb'), `<${ptr}`);
      },
      bombs: [['cbBomb', 'DAT', 'F', '#0', '#0']],
    };
  },
  watchWith: (api, w) => {
    const writes = { cbTop: '@' };
    for (let i = 1; i < api.P.WIDTH; i++) writes[`cbRow${i}`] = '<';
    let last = null;
    return w({
      writes, what: 'carpet cells', min: 100 * api.P.WIDTH,
      check: (a, t, l, cell) => {
        const prev = last; last = t;
        if (!a.same(cell, a.code('cbBomb'))) return `carpet-bomber wrote ${cell.op}, not its DAT bomb`;
        if (l !== 'cbTop' && t !== a.norm(prev - 1)) return "carpet-bomber's carpet is not a run of consecutive cells";
        return null;
      },
    });
  },
});

add('incendiary', {
  pf: 'in', processes: 1,
  purpose: 'Drops incendiary pairs every STEP cells (layout-safe): SPL 0 then MOV -1, <0, so a process that runs one splits and copies SPL 0 backward over its own code.',
  params: { STEP: [1, 4000] },
  provides: { splBomb: 'inSpl' },
  loopOf(P, ctx, core) {
    return {
      pf: 'in', step: P.STEP, below: 1,
      writes: (ptr) => {
        ctx.ins('inMovW', 'MOV', 'I', ctx.L('inMov'), `@${ptr}`);   // the MOV half, one cell on
        ctx.ins('inSplW', 'MOV', 'I', ctx.L('inSpl'), `<${ptr}`);   // then the SPL half before it
      },
      bombs: [['inSpl', 'SPL', 'B', '0', '0'], ['inMov', 'MOV', 'I', '-1', '<0']],
      self: { inSpl: 0, inMov: 1 },
    };
  },
  watchWith: (api, w) => {
    let half = null;
    return w({
      writes: { inMovW: '@', inSplW: '<' }, what: 'incendiary halves', min: 200,
      check: (a, t, l, cell) => {
        if (l === 'inMovW') { half = t; return a.same(cell, a.code('inMov')) ? null : 'incendiary wrote a broken MOV half'; }
        if (half === null || t !== a.norm(half - 1)) return "incendiary's SPL half is not just before its MOV half";
        return a.same(cell, a.code('inSpl')) ? null : 'incendiary wrote a broken SPL half';
      },
    });
  },
});

blocks['djn-stream'] = {
  ...BOMBER, id: 'djn-stream', processes: 1,
  purpose: "A DJN stream: walks backward from the warrior's start decrementing every cell it passes (both fields in '94, B in '88), UNROLL cells per count, around the whole core but the warrior, then starts over. Breaks imps, counters and pointers.",
  params: { UNROLL: [1, 8] }, entry: 'djS0', loop: 'djS0',
  mutable: [['djPtr', ['b']], ['djCnt', ['b']]],
  emit(ctx) {
    const { L, P, core, total } = ctx;
    // ptr's B: the first target is the cell before the warrior; one pass stops short of its end.
    const init = -(ctx.pc() + P.UNROLL + 4), count = Math.floor((core - total) / P.UNROLL);
    for (let i = 0; i < P.UNROLL; i++) ctx.ins(`djS${i}`, 'DJN', 'F', '1', `<${L('djPtr')}`);
    ctx.ins('', 'DJN', 'B', L('djS0'), L('djCnt'));
    ctx.ins('', 'MOV', 'AB', `#${init}`, L('djPtr'));
    ctx.ins('', 'MOV', 'AB', `#${count}`, L('djCnt'));
    ctx.ins('', 'JMP', 'B', L('djS0'));
    ctx.ins('djPtr', 'DAT', 'F', '#0', `#${init}`);
    ctx.ins('djCnt', 'DAT', 'F', '#0', `#${count}`);
  },
  watch: (api) => {
    const at = new Map(Array.from({ length: api.P.UNROLL }, (_, i) => [api.at(`djS${i}`), `djS${i}`]));
    const old = api.settings.dialect === '88', cells = new Set();
    // The warrior: from its first cell (ptr's first B) for the length one pass leaves out.
    const start = api.norm(api.at('djPtr') + api.code('djPtr').b);
    const size = api.core - api.code('djCnt').b * api.P.UNROLL;
    return {
      before: (pc) => {
        if (!at.has(pc) || !api.same(api.vm.peek(pc), api.code(at.get(pc)))) return null;   // a trigger may have rewritten it
        const t = api.norm(api.at('djPtr') + api.vm.peek(api.at('djPtr')).b - 1);
        return [t, api.vm.peek(t)];
      },
      after: (token) => {
        if (!token) return;
        const [t, was] = token, now = api.vm.peek(t);
        if (api.inSelf(t) || api.norm(t - start) < size) throw new Error('The DJN stream decremented the warrior');
        if (api.norm(now.b - was.b) !== api.core - 1 || (!old && api.norm(now.a - was.a) !== api.core - 1)) throw new Error('The DJN stream did not decrement the cell it passed');
        cells.add(t);
      },
      final: () => {
        const want = api.code('djCnt').b * api.P.UNROLL;     // one full pass
        if (api.alone && cells.size < want) throw new Error(`The DJN stream decremented only ${cells.size} cells`);
      },
    };
  },
};

blocks['mod-stone'].defaults = { STEP: 3044, BOMBS: 1, GUARD: 0 };
blocks['spl-stone'].defaults = { STEP: 3044, PROCS: 6 };
blocks['jmp-bomber'].defaults = { STEP: 3044, BOMB: 0, GUARD: 0 };
blocks['carpet-bomber'].defaults = { STEP: 2930, WIDTH: 3, GUARD: 0 };
blocks.incendiary.defaults = { STEP: 2936, GUARD: 0 };
blocks['djn-stream'].defaults = { UNROLL: 4 };

export default Object.values(blocks);
