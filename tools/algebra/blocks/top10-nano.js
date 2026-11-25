// Blocks from the Koenigstuhl Nano hill's top 10 (docs/hill-top10/nano.md).
// The Nano hill is 80 cells, five instructions, 800 cycles and 80 processes;
// every one of its leaders is a single five-line loop, so each block here is a
// whole warrior with its fields named by the job they do.
//
// - nano-mirror-clear: a SPL whose immediate A-field is the clear's write
//   pointer; a mirror line that reads through a remote cursor and writes
//   through that pointer; a walker that copies the cursor cell and steps the
//   cursor (by rewriting the mirror's own A-field) while writing down a
//   stream; a DJN stream back to the mirror. The fifth line is a swap-back
//   (Reptiloid Conspiracy), a one-shot head before the SPL ([RS] Nextratulated
//   Sturvinator 2, Iron Throne) or a reverse copier that throws the SPL itself
//   (Forbes, rogue[AI], 128_48).
// - nano-twin-clear: both pointers are the SPL's own fields, so the SPL's
//   side-effect address moves with the clear (NanoCracker, Combat Arithmetic).
// - nano-dat-clear: a step-2 DAT carpet whose pointer is a MOV's own B-field,
//   with a bomb whose B-field becomes that pointer when the carpet reaches
//   the MOV: the bomber turns itself into a one-step clear (Reptiloid
//   Supremacy).
// - nano-paper-clear: a paper that copies itself one cell a pass, SPLs a
//   process into the cell it has just copied through the cell it will copy
//   next, and runs a two-line A-stream clear on the processes that fall
//   through (Glitch//CORE//opt).
//
// Numbers are cells counted from the block's first cell on the 80-cell ring
// ("nano units"). On another core an offset within four cells of the block is
// kept and every other offset is scaled by coreSize/80, so a tree keeps its
// layout as shares of the core (see nanoScale).
//
// All Redcode here is written from scratch from the descriptions in
// docs/hill-top10/nano.md; the hill warriors were read for ideas, never copied.
// How to write a block: docs/block-algebra.md.

export const NANO_MODES = ['<', '>', '{', '}'];
const NANO = 80;
const mod = (x, n) => ((x % n) + n) % n;

// A nano-unit offset (cells from the block's first cell, or a field value) on
// this core: offsets within four cells keep their value, the rest scale.
export function nanoScale(c, core) {
  const m = mod(c, NANO), s = m > NANO / 2 ? m - NANO : m;
  return core === NANO || Math.abs(s) <= 4 ? s : Math.round((s * core) / NANO);
}

// Operand text for a cell given in nano units, from the block's first cell.
const farText = (ctx, c) => {
  const s = nanoScale(c, ctx.core);
  return s >= 0 ? `${ctx.L('c0')}+${s}` : `${ctx.L('c0')}-${-s}`;
};
const valText = (ctx, v) => `${nanoScale(v, ctx.core)}`;

// Settings every nano block refuses.
function nanoFit(id, settings) {
  const out = [];
  if (settings.coreSize < NANO) out.push(`${id}: needs a core of at least ${NANO} cells`);
  if (settings.maxLength < 5) out.push(`${id}: needs five instructions`);
  return out;
}

// A far cell must stay off the block's own five cells once scaled.
function offImage(id, name, c, settings, size = 5) {
  const s = mod(nanoScale(c, settings.coreSize), settings.coreSize);
  return s < size ? [`${id}: ${name} ${c} lands on its own code`] : [];
}

// Same opcode, modifier and modes as compiled: its fields are pointers and change.
const shapeOf = (api, label) => {
  const now = api.vm.peek(api.at(label)), was = api.code(label);
  return now.op === was.op && now.mod === was.mod && now.aMode === was.aMode && now.bMode === was.bMode;
};
const fresh = (api, target, pc) => api.vm.lastWrite[target] === api.vm.steps && api.vm.writerPc[target] === pc;
const delta = (api, a, b) => {
  const d = mod(b - a, api.core);
  return d > api.core / 2 ? d - api.core : d;
};

// How many early executions of each line a watch checks: the pointers cross
// each other and the opponent soon after, so only the opening is contractual.
const EARLY = 8;

// ---------------------------------------------------------------------------
// nano-mirror-clear
//
//   SLOT 1:  head   MOV.I  HEADM HEADA, HEADB     run once, before the SPL
//            feed   SPL    #PTR, SIDEM SIDE        A: the write pointer; B: a side stream
//   SLOT 2:  copier MOV.I  {0, >COPYB             once per spawn: throws the SPL, then
//                                                  the cells below it, up from COPYB
//            mirror MOV.I  CURM CURSOR, {feed     read through the cursor, write below PTR
//   SLOT 0:  back   MOV.I  {feed, <CURSOR         the swap: feed's next cell into the cursor
//            walk   MOV.I  }mirror|{mirror, STRM STREAM
//                                                  copy the cursor cell and step the
//                                                  cursor (the mirror's A-field) up or down
//            djn    DJN    mirror, DJNM DJNC
//
// Each spawn adds one process to the loop, so a lone SPL makes about
// sqrt(2t) processes by cycle t (26 at cycle 325 on Nano). The bombs are
// whatever the cursor finds: decremented blanks at first, then the warrior's
// own SPL and MOVs once the cursor reaches them (SPL bombs and decoys). Run
// alone, the clear sweeps the whole core and then its own loop, leaving the SPL
// as an immortal one- or two-process remnant; with SLOT 2 the copier can also
// throw the SPL away and the warrior then dies when it is alone.
const mirrorClear = {
  id: 'nano-mirror-clear',
  kind: 'body', exit: 'never', processes: 1, grows: true, writes: 'core', dialects: '94',
  purpose: 'Nano SPL clear: the SPL\'s immediate A-field is the write pointer; a mirror line reads through a remote cursor and writes below it, a walker copies the cursor cell down a stream and steps the cursor by rewriting the mirror\'s A-field, and a DJN stream loops back. Fifth line: a swap-back (SLOT 0, Reptiloid Conspiracy), a one-shot head before the SPL (SLOT 1, Nextratulated Sturvinator, Iron Throne) or a reverse copier that throws the SPL (SLOT 2, Forbes, rogue[AI], 128_48). Numbers are cells on the 80-cell ring; other cores scale them.',
  params: {
    SLOT: [0, 2], PTR: [5, 79], FEEDMOD: [0, 1], SIDEM: [0, 3], SIDE: [5, 79],
    CURM: [0, 1], CURSOR: [5, 79], WALKM: [0, 1], STRM: [0, 3], STREAM: [5, 79],
    DJNM: [0, 3], DJNC: [5, 79], DJNMOD: [0, 1], HEADM: [0, 3], HEADA: [5, 79], HEADB: [5, 79], COPYB: [5, 79],
  },
  // Reptiloid Conspiracy.
  defaults: {
    SLOT: 0, PTR: 39, FEEDMOD: 1, SIDEM: 2, SIDE: 57, CURM: 0, CURSOR: 69, WALKM: 0, STRM: 2, STREAM: 57,
    DJNM: 2, DJNC: 58, DJNMOD: 0, HEADM: 0, HEADA: 70, HEADB: 29, COPYB: 46,
  },
  testedProfiles: ['nano'],
  // The first cell runs first: the head under SLOT 1, otherwise the SPL.
  entry: 'c0', loop: 'mirror',
  knowledge: {
    parameterRoles: {
      SLOT: 'The fifth line: 0 swap-back, 1 one-shot head, 2 reverse copier',
      PTR: 'Where the SPL\'s A-field write pointer starts (the mirror writes just below it, descending)',
      FEEDMOD: 'SPL modifier, 0 .B or 1 .I (it matters only when the SPL is copied as a bomb)',
      SIDEM: 'Mode of the SPL\'s B side effect (< > { })', SIDE: 'The cell the SPL\'s side effect walks',
      CURM: 'Mirror read: 0 B-predecrement (reads below the cursor), 1 B-postincrement (reads up from it)',
      CURSOR: 'The mirror\'s first cursor cell', WALKM: 'Walker steps the cursor 0 up (}) or 1 down ({)',
      STRM: 'Mode of the walker\'s write stream', STREAM: 'The walker\'s stream cell',
      DJNM: 'Mode of the DJN stream', DJNC: 'The DJN stream cell', DJNMOD: 'DJN modifier, 0 .F or 1 .I',
      HEADM: 'SLOT 1: the head\'s A mode', HEADA: 'SLOT 1: the head\'s source pointer cell', HEADB: 'SLOT 1: where the head copies to',
      COPYB: 'SLOT 2: where the reverse copier starts writing (B-postincrement up from there)',
    },
    invariants: ['The mirror writes through the SPL\'s A-field and the walker moves the mirror\'s cursor by one each pass.'],
    evidence: ['docs/hill-top10/nano.md', 'test/algebra-top10-nano.test.js'],
  },
  mutable: (P) => [['feed', ['a', 'b']], ['mirror', ['a']], ...(P.SLOT === 2 ? [['copier', ['a']]] : [])],
  mismatches(P, settings) {
    const id = 'nano-mirror-clear', out = nanoFit(id, settings);
    for (const k of ['PTR', 'SIDE', 'CURSOR', 'STREAM', 'DJNC', ...(P.SLOT === 1 ? ['HEADA', 'HEADB'] : []), ...(P.SLOT === 2 ? ['COPYB'] : [])]) out.push(...offImage(id, k, P[k], settings));
    // The cursor walks one cell a pass from CURSOR: it must not start on a cell the loop
    // decrements every pass, or the mirror reads its own pointer.
    if (P.CURSOR === P.STREAM || P.CURSOR === P.DJNC) out.push(`${id}: CURSOR ${P.CURSOR} shares a cell with a stream, so the mirror reads its own pointer`);
    return out;
  },
  emit(ctx) {
    const { L, P } = ctx, M = NANO_MODES;
    ctx.mark('c0');
    if (P.SLOT === 1) ctx.ins('head', 'MOV', 'I', `${M[P.HEADM]}${farText(ctx, P.HEADA)}`, farText(ctx, P.HEADB));
    ctx.ins('feed', 'SPL', P.FEEDMOD ? 'I' : 'B', `#${farText(ctx, P.PTR)}`, `${M[P.SIDEM]}${farText(ctx, P.SIDE)}`);
    if (P.SLOT === 2) ctx.ins('copier', 'MOV', 'I', '{0', `>${farText(ctx, P.COPYB)}`);
    ctx.ins('mirror', 'MOV', 'I', `${P.CURM ? '>' : '<'}${farText(ctx, P.CURSOR)}`, `{${L('feed')}`);
    if (P.SLOT === 0) ctx.ins('back', 'MOV', 'I', `{${L('feed')}`, `<${farText(ctx, P.CURSOR)}`);
    ctx.ins('walk', 'MOV', 'I', `${P.WALKM ? '{' : '}'}${L('mirror')}`, `${M[P.STRM]}${farText(ctx, P.STREAM)}`);
    ctx.ins('djn', 'DJN', P.DJNMOD ? 'I' : 'F', L('mirror'), `${M[P.DJNM]}${farText(ctx, P.DJNC)}`);
  },
  watch(api) {
    const { vm, P } = api, feed = api.at('feed'), mirror = api.at('mirror'), walk = api.at('walk');
    const body = ['feed', 'mirror', 'walk', 'djn'];
    const counts = { feed: 0, mirror: 0, walk: 0 };
    return {
      before(pc) {
        if (pc !== feed && pc !== mirror && pc !== walk) return null;
        if (!body.every((l) => shapeOf(api, l))) return null;
        const line = pc === feed ? 'feed' : pc === mirror ? 'mirror' : 'walk';
        if (counts[line] >= EARLY) return null;
        counts[line]++;
        return { line, pc, q: vm.processes(0).length, ptr: vm.peek(feed).a, cur: vm.peek(mirror).a };
      },
      after(t) {
        if (!t) return;
        if (t.line === 'feed') {
          if (t.q < api.settings.maxProcesses && vm.processes(0).length !== t.q + 1) throw new Error('nano-mirror-clear: the SPL did not add a process to the loop');
          return;
        }
        if (t.line === 'mirror') {
          const ptr = vm.peek(feed).a;
          if (delta(api, t.ptr, ptr) !== -1) throw new Error('nano-mirror-clear: the mirror did not step the SPL\'s write pointer down');
          if (!fresh(api, api.add(feed, ptr), t.pc)) throw new Error('nano-mirror-clear: the mirror did not write where the SPL points');
          return;
        }
        if (delta(api, t.cur, vm.peek(mirror).a) !== (P.WALKM ? -1 : 1)) throw new Error('nano-mirror-clear: the walker did not step the mirror\'s cursor');
      },
      final() {
        if (api.alone && api.entered() && (counts.mirror < 3 || counts.walk < 3)) throw new Error('nano-mirror-clear: the loop barely ran');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// nano-twin-clear
//
//   SLOT 1:  head   MOV.I  HEADM HEADA, HEADB     run once, before the SPL
//            feed   SPL    #PA, SIDEM PB           both fields are pointers; the side
//                                                  effect runs through B, so it moves too
//            mirror MOV.I  <feed, {feed           B-pointer cell into the A-pointer cell
//            back   MOV.I  {feed, <feed           and the other way round
//   SLOT 0:  sweep  MOV.I  >SWEEP, {feed          an upward read into the A-pointer
//            djn    DJN    back, {feed            loop; its target is the A-pointer
//   SLOT 1:  div    DIV.F  {DIVC, {DIVC           a dividing bomb on an A-stream; on a
//                                                  blank cell it divides by zero and the
//                                                  walker dies, so the loop is the SPL
//
// The two pointers sweep two windows of the core and exchange their cells:
// blanks onto the opponent, and the opponent (and later the warrior's own
// lines) into the other window.
const twinClear = {
  id: 'nano-twin-clear',
  kind: 'body', exit: 'never', processes: 1, grows: true, writes: 'core', dialects: '94',
  purpose: 'Nano SPL clear whose two pointers are the SPL\'s own A and B fields, so its B side effect moves with the clear: a mirror and a swap-back exchange the cells under the two pointers. SLOT 0 (NanoCracker) loops through the swap, an upward sweep and a DJN on the A-pointer; SLOT 1 (Combat Arithmetic) has a one-shot head and ends each walker on a DIV.F bomb that kills it on blank cells, so only the SPL loops. Numbers are cells on the 80-cell ring; other cores scale them.',
  params: { SLOT: [0, 1], PA: [5, 79], PB: [5, 79], SIDEM: [0, 3], FEEDMOD: [0, 1], SWEEP: [5, 79], DJNMOD: [0, 1], HEADM: [0, 3], HEADA: [5, 79], HEADB: [5, 79], DIVC: [5, 79] },
  // NanoCracker.
  defaults: { SLOT: 0, PA: 42, PB: 71, SIDEM: 1, FEEDMOD: 1, SWEEP: 49, DJNMOD: 1, HEADM: 1, HEADA: 60, HEADB: 75, DIVC: 51 },
  testedProfiles: ['nano'],
  entry: 'c0', loop: 'back',
  knowledge: {
    parameterRoles: {
      SLOT: '0: swap, sweep and DJN loop; 1: one-shot head and a DIV.F bomb that ends each walker',
      PA: 'The SPL\'s A-field pointer start', PB: 'The SPL\'s B-field pointer start (also its side-effect address)',
      SIDEM: 'Mode of the SPL\'s side effect through its own B-field', FEEDMOD: 'SPL modifier, 0 .B or 1 .I',
      SWEEP: 'SLOT 0: the sweep\'s upward cursor cell', DJNMOD: 'SLOT 0: DJN modifier, 0 .F or 1 .I',
      HEADM: 'SLOT 1: the head\'s A mode', HEADA: 'SLOT 1: the head\'s source pointer cell', HEADB: 'SLOT 1: where the head copies to',
      DIVC: 'SLOT 1: the DIV.F bomb\'s A-stream cell',
    },
    invariants: ['The mirror and the swap-back each step both SPL fields down by one.'],
    evidence: ['docs/hill-top10/nano.md', 'test/algebra-top10-nano.test.js'],
  },
  mutable: [['feed', ['a', 'b']]],
  mismatches(P, settings) {
    const id = 'nano-twin-clear', out = nanoFit(id, settings);
    for (const k of ['PA', 'PB', ...(P.SLOT === 0 ? ['SWEEP'] : ['HEADA', 'HEADB', 'DIVC'])]) out.push(...offImage(id, k, P[k], settings));
    if (P.PA === P.PB) out.push(`${id}: PA and PB start on the same cell, so the swap moves nothing`);
    return out;
  },
  emit(ctx) {
    const { L, P } = ctx, M = NANO_MODES;
    ctx.mark('c0');
    if (P.SLOT === 1) ctx.ins('head', 'MOV', 'I', `${M[P.HEADM]}${farText(ctx, P.HEADA)}`, farText(ctx, P.HEADB));
    ctx.ins('feed', 'SPL', P.FEEDMOD ? 'I' : 'B', `#${farText(ctx, P.PA)}`, `${M[P.SIDEM]}${farText(ctx, P.PB)}`);
    ctx.ins('mirror', 'MOV', 'I', `<${L('feed')}`, `{${L('feed')}`);
    ctx.ins('back', 'MOV', 'I', `{${L('feed')}`, `<${L('feed')}`);
    if (P.SLOT === 0) {
      ctx.ins('sweep', 'MOV', 'I', `>${farText(ctx, P.SWEEP)}`, `{${L('feed')}`);
      ctx.ins('djn', 'DJN', P.DJNMOD ? 'I' : 'F', L('back'), `{${L('feed')}`);
    } else {
      ctx.ins('div', 'DIV', 'F', `{${farText(ctx, P.DIVC)}`, `{${farText(ctx, P.DIVC)}`);
    }
  },
  watch(api) {
    const { vm, P } = api, feed = api.at('feed'), mirror = api.at('mirror'), back = api.at('back');
    const body = ['feed', 'mirror', 'back'];
    let checked = 0;
    return {
      before(pc) {
        if ((pc !== mirror && pc !== back) || checked >= 2 * EARLY || !body.every((l) => shapeOf(api, l))) return null;
        checked++;
        const f = vm.peek(feed);
        return { pc, a: f.a, b: f.b };
      },
      after(t) {
        if (!t) return;
        const f = vm.peek(feed);
        if (delta(api, t.a, f.a) !== -1 || delta(api, t.b, f.b) !== -1) throw new Error('nano-twin-clear: a swap line did not step both SPL pointers down by one');
        const target = api.add(feed, t.pc === mirror ? f.a : f.b);
        if (!fresh(api, target, t.pc)) throw new Error('nano-twin-clear: a swap line did not write under its pointer');
      },
      final() {
        if (api.alone && api.entered() && checked < 4) throw new Error('nano-twin-clear: the swap barely ran');
        if (P.SLOT === 0 && api.alone && api.entered() && vm.peek(feed).op !== 'SPL') throw new Error('nano-twin-clear: the clear took its own SPL');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// nano-dat-clear
//
//   bomb   DAT.B  {BOMBA, }BOMBB     the bomb; its B-field is a spare pointer
//   feed   SPL.I  #FEEDA, >SIDE      (entry)
//   throw  MOV.I  bomb, <ptr         a bomb two cells a pass, down from PTR-1
//   ptr    MOV.I  <0, {PTR           B: the carpet pointer (both lines decrement it);
//                                    A-predecrements the bomb it has just thrown
//   djn    DJN.F  throw, {DJNC       an A-stream
//
// When the carpet reaches ptr, the bomb lands on it with its B-field BOMBB:
// from then on the processes die at ptr, throw keeps the SPL fed loop going
// one cell a pass with the bomb's B-field as its pointer, and the bomber is a
// one-step DAT clear.
const BOMB_PTR = 3;   // ptr's index
const datClear = {
  id: 'nano-dat-clear',
  kind: 'body', exit: 'never', processes: 1, grows: true, writes: 'core', dialects: '94', entryFirst: false,
  purpose: 'Nano DAT carpet that turns itself into a clear (Reptiloid Supremacy): a SPL-fed loop throws a DAT every second cell down from PTR through a MOV\'s own B-field, and when the carpet reaches that MOV the bomb\'s B-field becomes the pointer, so the remaining SPL and MOV lay one bomb a cell for good. Numbers are cells on the 80-cell ring; other cores scale them.',
  params: { BOMBA: [0, 79], BOMBB: [0, 79], FEEDA: [0, 79], SIDE: [5, 79], PTR: [5, 79], DJNC: [5, 79] },
  defaults: { BOMBA: 32, BOMBB: 76, FEEDA: 48, SIDE: 50, PTR: 34, DJNC: 74 },
  testedProfiles: ['nano'],
  entry: 'feed', loop: 'throw',
  knowledge: {
    parameterRoles: {
      BOMBA: 'The bomb\'s A-field value (an A-predecrement when executed)', BOMBB: 'The bomb\'s B-field value: the pointer once the bomb lands on ptr',
      FEEDA: 'The SPL\'s A-field (inert)', SIDE: 'The SPL\'s B-postincrement cell', PTR: 'Where the carpet starts (ptr\'s B-field)', DJNC: 'The DJN A-stream cell',
    },
    invariants: ['Every bomb lands on ptr + B(ptr), and the pointer moves down two cells a pass until the carpet reaches ptr.'],
    evidence: ['docs/hill-top10/nano.md', 'test/algebra-top10-nano.test.js'],
  },
  mutable: [['bomb', ['a', 'b']], ['ptr', ['b']]],
  mismatches(P, settings) {
    const id = 'nano-dat-clear', out = nanoFit(id, settings), core = settings.coreSize;
    for (const k of ['SIDE', 'PTR', 'DJNC']) out.push(...offImage(id, k, P[k], settings));
    // Once the bomb is ptr, the throw writes at ptr + BOMBB - 1: it must not land on the SPL or the throw.
    const next = mod(BOMB_PTR + nanoScale(P.BOMBB, core) - 1, core);
    if (next < BOMB_PTR) out.push(`${id}: BOMBB ${P.BOMBB} turns the clear onto its own SPL`);
    return out;
  },
  emit(ctx) {
    const { L, P } = ctx;
    ctx.mark('c0');
    ctx.ins('bomb', 'DAT', 'B', `{${valText(ctx, P.BOMBA)}`, `}${valText(ctx, P.BOMBB)}`);
    ctx.ins('feed', 'SPL', 'I', `#${valText(ctx, P.FEEDA)}`, `>${farText(ctx, P.SIDE)}`);
    ctx.ins('throw', 'MOV', 'I', L('bomb'), `<${L('ptr')}`);
    ctx.ins('ptr', 'MOV', 'I', '<0', `{${farText(ctx, P.PTR)}`);
    ctx.ins('djn', 'DJN', 'F', L('throw'), `{${farText(ctx, P.DJNC)}`);
  },
  watch(api) {
    const { vm } = api, ptr = api.at('ptr'), thrw = api.at('throw'), bomb = api.at('bomb');
    let carpet = 0, handed = false, clear = 0;
    return {
      before(pc) {
        // A carpet whose parity misses ptr bombs the throw itself; final() then reports it.
        if (pc !== thrw || !shapeOf(api, 'throw')) return null;
        return { pc, b: vm.peek(ptr).b, armed: vm.peek(ptr).op === 'MOV' };
      },
      after(t) {
        if (!t) return;
        // The bomb lands one cell below the old pointer; when that cell is ptr itself the
        // bomb's B-field is the pointer from then on.
        // Once the clear has come round to the warrior's own cells it may bomb them (and the
        // bomb onto itself); only the carpet and the clear's first lap are checked.
        const target = api.add(ptr, t.b - 1), b = vm.peek(ptr).b;
        if ((api.inSelf(target) && target !== ptr) || clear > api.core) return;
        if ((target !== ptr && delta(api, t.b, b) !== -1) || !fresh(api, target, t.pc) || !api.same(vm.peek(target), vm.peek(bomb))) throw new Error('nano-dat-clear: the throw did not lay the bomb under ptr\'s pointer');
        if (t.armed) carpet++;
        else { handed = true; clear++; }
      },
      final() {
        if (!api.alone || !api.entered()) return;
        if (carpet < 5) throw new Error('nano-dat-clear: the carpet barely ran');
        if (!handed || clear < 20) throw new Error('nano-dat-clear: the carpet never turned into a one-step clear');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// nano-paper-clear
//
//   paper  SPL.B  #0, >SIDE1          (entry) the pump
//          MOV.I  }paper, }dest       copy cell k of the paper to COPY+k (A-fields count)
//   dest   SPL.B  {COPY, >SIDE2       A-predecrement the next cell to be copied and SPL
//                                     to the one before it: the cell just copied
//   clr    MOV.I  @BOMB, {CLR         a two-line A-stream clear for the processes
//          DJN.F  clr, {DJNC          that fall through
//
// The copy keeps going past the paper (copying blanks on), and every copy is
// a paper of its own, so the copies spread COPY apart while each runs its clear.
const paperClear = {
  id: 'nano-paper-clear',
  kind: 'body', exit: 'never', processes: 1, grows: true, writes: 'core', roams: true, dialects: '94',
  purpose: 'Nano paper with a clear (Glitch//CORE//opt): a SPL #0 pump, a copy line that moves one cell a pass to COPY (its source and destination are the A-fields of the pump and of the next line), a SPL that predecrements the next cell to be copied and so starts a process in the cell just copied, and a two-line A-stream clear for the processes that fall through. Every copy is a paper of its own. Numbers are cells on the 80-cell ring; other cores scale them.',
  params: { SIDE1: [5, 79], COPY: [5, 75], SIDE2: [5, 79], BOMB: [5, 79], CLR: [5, 79], DJNC: [5, 79] },
  defaults: { SIDE1: 54, COPY: 45, SIDE2: 57, BOMB: 72, CLR: 32, DJNC: 33 },
  testedProfiles: ['nano'],
  entry: 'paper', loop: 'copy',
  knowledge: {
    parameterRoles: {
      SIDE1: 'The pump\'s B-postincrement cell', COPY: 'Where the first copy lands', SIDE2: 'The launch SPL\'s B-postincrement cell',
      BOMB: 'The clear\'s B-indirect source cell', CLR: 'The clear\'s A-stream cell', DJNC: 'The DJN A-stream cell',
    },
    invariants: ['The copy line writes the paper cell by cell to COPY, and the SPL starts processes in the copy.'],
    evidence: ['docs/hill-top10/nano.md', 'test/algebra-top10-nano.test.js'],
  },
  mutable: [['paper', ['a', 'b']], ['dest', ['a']]],
  mismatches(P, settings) {
    const id = 'nano-paper-clear', out = nanoFit(id, settings);
    for (const k of ['SIDE1', 'SIDE2', 'BOMB', 'CLR', 'DJNC']) out.push(...offImage(id, k, P[k], settings));
    // The first copy (five cells from COPY) must miss the paper.
    const at = mod(nanoScale(P.COPY, settings.coreSize), settings.coreSize);
    if (at < 5 || at > settings.coreSize - 5) out.push(`${id}: COPY ${P.COPY} lands the copy on the paper`);
    return out;
  },
  emit(ctx) {
    const { L, P } = ctx;
    ctx.mark('c0');
    ctx.ins('paper', 'SPL', 'B', '#0', `>${farText(ctx, P.SIDE1)}`);
    ctx.ins('copy', 'MOV', 'I', `}${L('paper')}`, `}${L('dest')}`);
    ctx.ins('dest', 'SPL', 'B', `{${farText(ctx, P.COPY)}`, `>${farText(ctx, P.SIDE2)}`);
    ctx.ins('clr', 'MOV', 'I', `@${farText(ctx, P.BOMB)}`, `{${farText(ctx, P.CLR)}`);
    ctx.ins('', 'DJN', 'F', L('clr'), `{${farText(ctx, P.DJNC)}`);
  },
  // A process on any copy of the paper's lines.
  running(api) {
    const shapes = [0, 1, 2, 3, 4].map((k) => api.code('paper', k));
    return api.vm.processes(0).some((q) => {
      const c = api.vm.peek(q);
      return shapes.some((y) => c.op === y.op && c.mod === y.mod && c.aMode === y.aMode && c.bMode === y.bMode);
    });
  },
  watch(api) {
    const { vm } = api, copy = api.at('copy'), dest = api.at('dest'), first = api.add(dest, api.code('dest').a);
    let copied = 0, launched = 0;
    return {
      before(pc) {
        if (pc === copy && copied < 5 && shapeOf(api, 'copy')) return { kind: 'copy', pc, src: api.add(api.at('paper'), vm.peek(api.at('paper')).a), dst: api.add(dest, vm.peek(dest).a) };
        if (pc === dest && launched < 3 && shapeOf(api, 'dest')) return { kind: 'spl', q: vm.processes(0).length };
        return null;
      },
      after(t) {
        if (!t) return;
        if (t.kind === 'spl') { launched++; return; }
        if (t.dst !== api.add(first, copied)) throw new Error('nano-paper-clear: the copy went somewhere other than COPY');
        const was = api.code('paper', copied), now = vm.peek(t.dst);
        if (!fresh(api, t.dst, t.pc) || now.op !== was.op || now.aMode !== was.aMode || now.bMode !== was.bMode) throw new Error('nano-paper-clear: the copy line did not copy the paper cell by cell');
        copied++;
      },
      final() {
        if (api.alone && api.entered() && copied < 5) throw new Error('nano-paper-clear: the paper never finished its first copy');
      },
    };
  },
};

export default [mirrorClear, twinClear, datClear, paperClear];
