// Hill-style bombers and their relatives (docs/block-algebra.md). Everything
// here is written from scratch; hill warriors are studied, never copied. Ring
// only.
//
// The pieces strong 94nop bombers run together, each as its own block:
//   elf           a multi-process DJN decrement stream (several SPL-fed copies)
//   finisher-multi a two-pass clear run by several processes, so one dies safely
//   scan-vampire  a scanner that only fangs occupied cells, aimed at a pit
//   hill-stone    several processes in one bombing loop (two pointers, an
//                 optional folded DJN stream, an optional remote bomb cell, and
//                 an optional turn into a core clear when the bombing comes home)

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const mod = (x, n) => ((x % n) + n) % n;

// ===========================================================================
// elf: an SPL-fed DJN decrement stream. A feeder splits PROCS - 1 processes
// into one decrement stream and then joins it, so PROCS processes walk the
// core together decrementing every cell they pass (both fields in '94, B in
// '88), UNROLL cells per count, around the whole core but the warrior. Losing
// one process to a bomb does not stop the stream.
const elf = {
  id: 'elf', kind: 'body', exit: 'never', writes: 'sparse', roams: false,
  processes: (P) => P.PROCS,
  purpose: 'A multi-process DJN decrement stream: an SPL feeder splits PROCS processes into one stream that walks the core decrementing every cell it passes (both fields in \'94, B in \'88), UNROLL cells per count, around everything but the warrior; a hit on one process does not stop it.',
  params: { PROCS: [2, 64], UNROLL: [1, 8] }, entry: 'elFeed', loop: 'elS0',
  defaults: { PROCS: 4, UNROLL: 4 },
  mutable: [['elPtr', ['b']], ['elCnt', ['b']], ['elProcs', ['b']]],
  mismatches: (P, settings) => {
    const out = [];
    if (P.PROCS > settings.maxProcesses) out.push(`elf: ${P.PROCS} processes; this hill allows ${settings.maxProcesses}`);
    if (Math.floor((settings.coreSize - 20) / P.UNROLL) < 1) out.push('elf: UNROLL too large for this core');
    return out;
  },
  emit(ctx) {
    const { L, P, core, total } = ctx;
    // The feeder: split PROCS - 1 processes into the stream, then fall into it.
    ctx.ins('elFeed', 'SPL', 'B', L('elS0'));
    ctx.ins('', 'DJN', 'B', L('elFeed'), L('elProcs'));
    // The stream. ptr's B is set so the first target is the cell before the
    // whole warrior; one pass stops short of its end (count * UNROLL cells).
    const streamPc = ctx.pc();
    const ptrIdx = streamPc + P.UNROLL + 4;        // elPtr's index below
    // One pass leaves the warrior plus a margin untouched: the shared counter is
    // tested once per UNROLL decrements and its reset is not atomic, so several
    // processes may carry the pointer past the end of a pass before one resets
    // it. (PROCS + 1) * UNROLL cells cover the worst overshoot.
    const margin = (P.PROCS + 1) * P.UNROLL;
    const init = -ptrIdx, count = Math.floor((core - total - margin) / P.UNROLL);
    for (let i = 0; i < P.UNROLL; i++) ctx.ins(`elS${i}`, 'DJN', 'F', '1', `<${L('elPtr')}`);
    ctx.ins('', 'DJN', 'B', L('elS0'), L('elCnt'));
    ctx.ins('', 'MOV', 'AB', `#${init}`, L('elPtr'));
    ctx.ins('', 'MOV', 'AB', `#${count}`, L('elCnt'));
    ctx.ins('', 'JMP', 'B', L('elS0'));
    ctx.ins('elPtr', 'DAT', 'F', '#0', `#${init}`);
    ctx.ins('elCnt', 'DAT', 'F', '#0', `#${count}`);
    ctx.ins('elProcs', 'DAT', 'F', '#0', `#${P.PROCS - 1}`);
  },
  watch(api) {
    const at = new Map(Array.from({ length: api.P.UNROLL }, (_, i) => [api.at(`elS${i}`), `elS${i}`]));
    const old = api.settings.dialect === '88', cells = new Set();
    return {
      before: (pc) => {
        if (!at.has(pc) || !api.same(api.vm.peek(pc), api.code(at.get(pc)))) return null;   // a trigger may have rewritten it
        const t = api.norm(api.at('elPtr') + api.vm.peek(api.at('elPtr')).b - 1);
        return [t, api.vm.peek(t)];
      },
      after: (token) => {
        if (!token) return;
        const [t, was] = token, now = api.vm.peek(t);
        if (api.inImage(t)) throw new Error('elf decremented the warrior');
        if (api.norm(now.b - was.b) !== api.core - 1 || (!old && api.norm(now.a - was.a) !== api.core - 1)) throw new Error('elf did not decrement the cell it passed');
        cells.add(t);
      },
      final: () => {
        if (api.alone && cells.size < Math.min(api.code('elCnt').b * api.P.UNROLL, 100)) throw new Error(`elf decremented only ${cells.size} cells`);
      },
    };
  },
};

// ===========================================================================
// finisher-multi: a two-pass clear (one SPL stun pass, then DAT) run by PROCS
// processes. One controller stuns the core, then launches PROCS - 1 killers and
// joins them as the last; every killer has its own loop but they all step one
// shared pointer and counter, so a bomb that kills one process leaves the rest
// sweeping the same ground. A margin keeps the shared pointer's overshoot (the
// reset is not atomic) off the block's own code.
const finisherMulti = {
  id: 'finisher-multi', kind: 'finisher', exit: 'never', writes: 'core', roams: false,
  relocatable: true, protects: 'self',
  processes: (P) => P.PROCS,
  purpose: 'A two-pass clear (SPL stun, then DAT) run by PROCS processes: a controller stuns the core, then PROCS killers sweep it with DAT, each on its own loop but all stepping one shared pointer, so losing a process to a bomb does not stop the clear. Provides datBomb and splBomb so a bombing opening can run in front of it.',
  params: { PROCS: [2, 16] }, entry: 'entry', loop: 'k0',
  defaults: { PROCS: 3 },
  provides: { datBomb: 'dbomb', splBomb: 'sbomb' },
  mutable: [['ptr', ['b']], ['cnt', ['b']]],
  mismatches: (P, settings) => (P.PROCS > settings.maxProcesses ? [`finisher-multi: ${P.PROCS} processes; this hill allows ${settings.maxProcesses}`] : []),
  emit(ctx) {
    const { L, P, old } = ctx;
    const margin = 2 * P.PROCS + 2;
    const n = `((CORESIZE-(${L('dbomb')}+1-${L('entry')}))-${margin})`;
    const first = `#(${L('entry')}-${L('ptr')})`;
    // Controller: one full SPL stun pass over everything but the block.
    ctx.ins('entry', 'MOV', 'AB', first, L('ptr'));
    ctx.ins('', 'MOV', 'AB', `#${n}`, L('cnt'));
    ctx.ins('stun', 'MOV', 'I', L('sbomb'), `<${L('ptr')}`);
    ctx.ins('', 'DJN', 'B', L('stun'), L('cnt'));
    // Re-arm and launch the killers, then fall into k0.
    ctx.ins('', 'MOV', 'AB', first, L('ptr'));
    ctx.ins('', 'MOV', 'AB', `#${n}`, L('cnt'));
    for (let i = 1; i < P.PROCS; i++) ctx.ins('', 'SPL', 'B', L('k' + i));
    // PROCS killer loops. Each re-arms the shared pointer when its count runs out.
    for (let i = 0; i < P.PROCS; i++) {
      ctx.ins('k' + i, 'MOV', 'I', L('dbomb'), `<${L('ptr')}`);
      ctx.ins('', 'DJN', 'B', L('k' + i), L('cnt'));
      ctx.ins('', 'MOV', 'AB', first, L('ptr'));
      ctx.ins('', 'MOV', 'AB', `#${n}`, L('cnt'));
      ctx.ins('', 'JMP', 'B', L('k' + i));
    }
    ctx.ins('ptr', 'DAT', 'F', '#0', '#0');
    ctx.ins('cnt', 'DAT', 'F', '#0', '#0');
    if (old) ctx.ins('sbomb', 'SPL', 'B', '0', '0'); else ctx.ins('sbomb', 'SPL', 'B', '#0', '#0');
    ctx.ins('dbomb', 'DAT', 'F', '#0', '#0');
  },
  // Kill one killer's loop once the clear is under way: the others carry on.
  plant: (api) => [[api.at('k1'), { op: 'DAT', mod: 'F', aMode: '#', a: 0, bMode: '#', b: 0 }, 3000]],
  watch(api) {
    const old = api.settings.dialect === '88';
    const ptrAt = api.at('ptr'), margin = 2 * api.P.PROCS + 2;
    // Each writing instruction -> [its bomb cell, the label to check it is intact].
    const movs = new Map();
    movs.set(api.at('stun'), ['sbomb', 'stun']);
    for (let i = 0; i < api.P.PROCS; i++) movs.set(api.at('k' + i), ['dbomb', 'k' + i]);
    const protSize = api.self.size + margin;             // the block plus the un-swept margin above it
    const prot = (c) => api.norm(c - api.self.start) < protSize;
    const killed = new Map();
    let entered = null;
    return {
      before(pc) {
        if (entered === null && pc === api.entry()) entered = api.vm.cycle;
        const m = movs.get(pc);
        if (!m || !api.same(api.vm.peek(pc), api.code(m[1]))) return null;   // a bomb may have broken this killer
        return [m[0], api.norm(ptrAt + api.vm.peek(ptrAt).b - 1)];
      },
      after(token) {
        if (!token) return;
        const [bomb, t] = token;
        if (api.inSelf(t)) throw new Error('finisher-multi cleared its own code');
        const cell = api.vm.peek(t);
        if (bomb === 'dbomb') { if (cell.op !== 'DAT') throw new Error('finisher-multi wrote the wrong kill bomb'); killed.set(t, api.vm.cycle); }
        else if (cell.op !== 'SPL') throw new Error('finisher-multi wrote the wrong stun bomb');
      },
      final() {
        if (entered === null || !api.alone) return;
        for (let c = 0; c < api.core; c++) {
          if (prot(c)) continue;
          const k = killed.get(c);
          if (k === undefined || k < entered) throw new Error('finisher-multi left cells uncleared');
        }
      },
    };
  },
};

// ===========================================================================
// hill-stone: the shape strong 94nop bombers take. PROCS processes enter one
// bombing loop through an SPL feeder; each pass makes WRITES (2 or 3) writes
// with two stepping pointers; STREAM folds a DJN decrement into the loop;
// REMOTE keeps the bomb cell a long way from the body; ENDCLEAR turns the loop
// into a core clear once it has bombed long enough, instead of letting the
// bombing come home.
//
// Layout safety without a guard (a guard's check and write would race between
// the processes): STEP is chosen so g = gcd(STEP, CORESIZE) is at least the
// warrior's length, and every pointer aims at an empty residue class (one that
// holds no cell of the block). STEP is a multiple of g, so a pointer never
// leaves its class: it bombs core/g cells, none of them the warrior's.
const hillStone = {
  id: 'hill-stone', kind: 'body', exit: 'never', writes: 'sparse', roams: false,
  processes: (P) => P.PROCS,
  purpose: 'A hill-style bomber: PROCS processes in one layout-safe bombing loop (two stepping pointers, WRITES writes a pass); STREAM folds a DJN decrement into the loop; REMOTE keeps the bomb cell far from the body; ENDCLEAR turns the loop into a core clear once it has bombed long enough.',
  params: { STEP: [1, 4000], PROCS: [1, 64], WRITES: [2, 3], STREAM: [0, 1], REMOTE: [0, 1], ENDCLEAR: [0, 1], PASSES: [8, 4000] },
  defaults: { STEP: 240, PROCS: 6, WRITES: 2, STREAM: 0, REMOTE: 0, ENDCLEAR: 0, PASSES: 400 },
  entry: 'hsEntry', loop: 'hsLoop',
  provides: { datBomb: 'hsBomb' },
  mutable: (P) => [['hsPtrA', ['a', 'b']], ['hsPtrB', ['b']], ['hsStr', ['b']], ['hsEnd', ['b']], ['hsCPtr', ['b']], ['hsCCnt', ['b']], ['hsSrc', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, g = gcd(P.STEP, core), out = [];
    if (core / g < 100) out.push(`hill-stone: STEP ${P.STEP} reaches only ${core / g} cells of the core`);
    if (P.PROCS > settings.maxProcesses) out.push(`hill-stone: ${P.PROCS} processes; this hill allows ${settings.maxProcesses}`);
    // The bomb classes (one per stepping target, plus the stream) must be empty
    // residue classes; g must leave room for them beyond the warrior.
    const need = 2 + (P.WRITES === 3 ? 1 : 0) + (P.STREAM ? 1 : 0);
    if (g < settings.maxLength + need) out.push(`hill-stone: gcd(STEP, core) = ${g} is too small to keep ${need} bomb classes clear of the warrior`);
    if (P.WRITES === 3 && settings.dialect === '88') out.push("hill-stone: a third write a pass uses A-field indirection, which needs ICWS'94");
    return out;
  },
  emit(ctx) {
    const { L, P, old, core, total } = ctx;
    const g = gcd(P.STEP, core);
    // Each stepping target gets its own empty residue class past the warrior's end.
    let nextClass = total;
    const classB = (iPtr) => { const C = nextClass++; return mod(C - iPtr - P.STEP, core); };   // ptr.b so the first bomb (after one ADD) lands on class C
    const margin = 6 * P.PROCS + 10;   // the shared clear's pointer reset is not atomic; keep its overshoot off the warrior

    // REMOTE: at start, copy the bomb template to a cell well away from the body,
    // and bomb from there through hsSrc, so a scanner that finds a bomb is led
    // nowhere near the loop.
    if (P.REMOTE) {
      ctx.ins('hsEntry', 'MOV', 'I', L('hsBomb'), `@${L('hsSrc')}`);   // plant the remote bomb
    } else ctx.mark('hsEntry');

    // The feeder: split PROCS - 1 processes into the loop, then join it.
    if (P.PROCS > 1) {
      ctx.ins('hsFeed', 'SPL', 'B', L('hsLoop'));
      ctx.ins('', 'DJN', 'B', L('hsFeed'), L('hsProcs'));
    }

    const bombSrc = P.REMOTE ? `@${L('hsSrc')}` : L('hsBomb');
    ctx.ins('hsLoop', 'ADD', P.WRITES === 3 ? 'F' : 'AB', P.WRITES === 3 ? L('hsIncA') : `#${P.STEP}`, L('hsPtrA'));
    ctx.ins('', 'ADD', 'AB', `#${P.STEP}`, L('hsPtrB'));
    ctx.ins('hsWA', 'MOV', 'I', bombSrc, `@${L('hsPtrA')}`);
    ctx.ins('hsWB', 'MOV', 'I', bombSrc, `@${L('hsPtrB')}`);
    if (P.WRITES === 3) ctx.ins('hsWC', 'MOV', 'I', bombSrc, `*${L('hsPtrA')}`);
    if (P.STREAM) {
      ctx.ins('', 'ADD', 'AB', `#${P.STEP}`, L('hsStr'));
      ctx.ins('', 'DJN', 'F', '1', `@${L('hsStr')}`);     // decrement the cell it points at; flow is unaffected
    }
    if (!P.ENDCLEAR) { ctx.ins('', 'JMP', 'B', L('hsLoop')); } else {
      // Loop PASSES times, then convert the loop-back to a one-way jump into the
      // clear, so every bombing process joins the clear and none re-enters the
      // bombing loop (the DJN's counter would otherwise wrap and disrupt it).
      ctx.ins('hsBack', 'DJN', 'B', L('hsLoop'), L('hsEnd'));
      ctx.ins('', 'MOV', 'I', L('hsJmpT'), L('hsBack'));
      // A DAT clear of everything but the warrior, shared by the PROCS processes;
      // the loop re-arms the shared pointer at the top of every pass.
      const first = `#(${L('hsEntry')}-${L('hsCPtr')})`, nClr = `#(CORESIZE-${total}-${margin})`;
      ctx.ins('hsArm', 'MOV', 'AB', first, L('hsCPtr'));
      ctx.ins('', 'MOV', 'AB', nClr, L('hsCCnt'));
      ctx.ins('hsClr', 'MOV', 'I', L('hsCDat'), `<${L('hsCPtr')}`);
      ctx.ins('', 'DJN', 'B', L('hsClr'), L('hsCCnt'));
      ctx.ins('', 'JMP', 'B', L('hsArm'));
      ctx.ins('hsJmpT', 'JMP', 'B', `${L('hsArm')}-${L('hsBack')}`);   // copied over hsBack: jumps to the clear
    }

    // Data, past all code. Compute pointer B-fields now that their indices are known.
    const iA = ctx.pc();
    const bA = classB(iA);
    ctx.ins('hsPtrA', 'DAT', 'F', P.WRITES === 3 ? `#${classB(iA)}` : '#0', `#${bA}`);
    ctx.ins('hsPtrB', 'DAT', 'F', '#0', `#${classB(ctx.pc())}`);
    ctx.ins('hsBomb', 'DAT', 'F', '#0', '#0');
    if (P.PROCS > 1) ctx.ins('hsProcs', 'DAT', 'F', '#0', `#${P.PROCS - 1}`);
    if (P.WRITES === 3) ctx.ins('hsIncA', 'DAT', 'F', `#${P.STEP}`, `#${P.STEP}`);
    if (P.STREAM) ctx.ins('hsStr', 'DAT', 'F', '#0', `#${classB(ctx.pc())}`);
    if (P.ENDCLEAR) {
      ctx.ins('hsEnd', 'DAT', 'F', '#0', `#${P.PASSES}`);
      ctx.ins('hsCPtr', 'DAT', 'F', '#0', '#0');
      ctx.ins('hsCCnt', 'DAT', 'F', '#0', '#0');
      ctx.ins('hsCDat', 'DAT', 'F', '#0', '#0');
    }
    if (P.REMOTE) ctx.ins('hsSrc', 'DAT', 'F', '#0', `#${classB(ctx.pc())}`);
  },
  watch(api) {
    const { P } = api, g = gcd(P.STEP, api.core);
    const writes = [['hsWA', 'hsPtrA', 'b'], ['hsWB', 'hsPtrB', 'b']];
    if (P.WRITES === 3) writes.push(['hsWC', 'hsPtrA', 'a']);
    const byPc = new Map(writes.map(([mov, ptr, f]) => [api.at(mov), { ptr: api.at(ptr), f }]));
    const cells = new Set();
    const margin = 6 * P.PROCS + 10;
    let entered = null, cleared = new Map(), clearEntered = null;
    const clrPc = P.ENDCLEAR ? api.at('hsClr') : null, cPtr = P.ENDCLEAR ? api.at('hsCPtr') : null;
    return {
      before(pc) {
        if (entered === null && pc === api.entry()) entered = api.vm.cycle;
        const w = byPc.get(pc);
        if (w && api.same(api.vm.peek(pc), api.code(api.norm(pc) === api.at('hsWA') ? 'hsWA' : api.norm(pc) === api.at('hsWB') ? 'hsWB' : 'hsWC'))) {
          const p = api.vm.peek(w.ptr);
          return { kind: 'bomb', t: api.norm(w.ptr + (w.f === 'b' ? p.b : p.a)) };
        }
        if (clrPc !== null && pc === clrPc && api.same(api.vm.peek(pc), api.code('hsClr'))) {
          if (clearEntered === null) clearEntered = api.vm.cycle;
          return { kind: 'clear', t: api.norm(cPtr + api.vm.peek(cPtr).b - 1) };
        }
        return null;
      },
      after(tok) {
        if (!tok) return;
        if (tok.kind === 'bomb') {
          if (api.inSelf(tok.t)) throw new Error('hill-stone bombed its own code');
          if (entered !== null && cleared.size === 0 && clearEntered === null && cells.size === 0 && api.inImage(tok.t)) throw new Error("hill-stone's first bomb landed inside the warrior");
          cells.add(tok.t);
        } else {
          if (api.inSelf(tok.t)) throw new Error("hill-stone's clear wrote its own code");
          cleared.set(tok.t, api.vm.cycle);
        }
      },
      final() {
        if (!api.alone) return;
        if (!P.ENDCLEAR) { if (cells.size < 100) throw new Error(`hill-stone bombed too few cells (${cells.size})`); return; }
        if (clearEntered === null) throw new Error('hill-stone never reached its clear phase');
        // Once clearing a while, every cell but the warrior must have been hit.
        if (api.vm.cycle - clearEntered >= 3 * api.core) {
          const prot = (c) => api.norm(c - api.self.start) < api.self.size + margin;   // the warrior and the un-swept margin above it
          for (let c = 0; c < api.core; c++) if (!prot(c) && (cleared.get(c) ?? -1) < clearEntered) throw new Error('hill-stone\'s clear left cells untouched');
        }
      },
    };
  },
};

// The first cell the scan looks at that is a few steps outside the image.
function scanVampirePlanted(api) {
  const ptr = api.at('svPtr'), d0 = api.code('svPtr').b, step = api.P.STEP;
  let found = 0;
  for (let k = 1; k < 2000; k++) {
    const c = api.norm(ptr + d0 + k * step);
    if (!api.inImage(c) && !api.inImage(c + 1) && ++found === 3) return c;
  }
  return null;
}

// ===========================================================================
// scan-vampire: a scanner that only fangs occupied cells. It scans one cell
// every STEP; while it scans it keeps a JMP fang's A-field in lockstep with the
// pointer so the fang always points at the pit, and on an occupied cell outside
// its own image it drops that fang. A process that runs the fang jumps into the
// pit. COUNT 0: the pit kills on arrival; COUNT 1: a gathering pit where
// prisoners split and pile up before dying. '94 only (JMZ.F).
const scanVampire = {
  id: 'scan-vampire', kind: 'body', exit: 'never', writes: 'sparse', roams: false,
  dialects: '94',
  processes: 1,
  purpose: 'A scanning vampire: scans one cell every STEP and drops a JMP fang (aimed at its pit) only on occupied cells outside its own image, keeping the fang pointed at the pit as it scans. COUNT 1 makes a gathering pit where prisoners split and pile up before dying.',
  params: { STEP: [1, 27719], COUNT: [0, 1] },
  defaults: { STEP: 2341, COUNT: 0 },
  entry: 'svLoop', loop: 'svLoop',
  mutable: [['svPtr', ['b']], ['svFang', ['a']]],
  mismatches(P, settings) {
    const out = [];
    const g = gcd(P.STEP, settings.coreSize);
    if (settings.coreSize / g < 100) out.push(`scan-vampire: STEP ${P.STEP} reaches only ${settings.coreSize / g} cells of the core`);
    return out;
  },
  emit(ctx) {
    const { L, P, span } = ctx;
    const idx = ctx.pc() + 11;               // svLoop, SUB, sLook, then 8 instrs from sHit to svPtr
    const pit = idx + 1;                      // svPit sits just after svPtr
    const b0 = span - idx - P.STEP;           // first look (after one ADD) lands at `span`, just past the image
    const a0 = (pit - span) + P.STEP;         // fang.a tracks pit - target; after one SUB it is pit - span
    ctx.ins('svLoop', 'ADD', 'AB', `#${P.STEP}`, L('svPtr'));
    ctx.ins('', 'SUB', 'A', `#${P.STEP}`, L('svFang'));          // keep the fang pointed at the pit
    ctx.ins('sLook', 'JMZ', 'F', L('svLoop'), `@${L('svPtr')}`);  // empty? scan on
    ctx.ins('sHit', 'SLT', 'AB', `#${span - idx - 1}`, L('svPtr'));
    ctx.ins('', 'JMP', 'B', L('svLoop'));                        // in the image (low side): skip
    ctx.ins('', 'SLT', 'AB', `#${ctx.core - idx - 1}`, L('svPtr'));
    ctx.ins('', 'JMP', 'B', L('svDrop'));                        // occupied and clear of the image: fang it
    ctx.ins('', 'JMP', 'B', L('svLoop'));                        // wrapped back into the image: skip
    ctx.ins('svDrop', 'MOV', 'I', L('svFang'), `@${L('svPtr')}`);
    ctx.ins('', 'JMP', 'B', L('svLoop'));
    ctx.ins('svFang', 'JMP', 'B', `${a0}`, '0');                 // A maintained = pit - target
    ctx.ins('svPtr', 'DAT', 'F', '#0', `#${b0}`);
    if (!P.COUNT) {
      ctx.ins('svPit', 'DAT', 'F', '#0', '#0');                  // kill on arrival
    } else {
      ctx.ins('svPit', 'SPL', 'B', '#0', '#0');                  // gather: prisoners split...
      ctx.ins('', 'DAT', 'F', '#0', '#0');                       // ...and pile into the DAT behind it
    }
  },
  plant(api) {
    const c = scanVampirePlanted(api);
    return c === null ? [] : [[c, { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 }]];
  },
  watch(api) {
    const pit = api.at('svPit'), ptr = api.at('svPtr');
    const isPlanted = api.scenario === 'scan-vampire: planted target';
    const target = isPlanted ? scanVampirePlanted(api) : null;
    let looks = 0, fangs = 0, hitPlanted = false;
    return {
      before(pc) {
        if (pc === api.at('sLook')) looks++;
        if (pc === api.at('svDrop') && api.same(api.vm.peek(pc), api.code('svDrop'))) return api.norm(ptr + api.vm.peek(ptr).b);
        return null;
      },
      after(t) {
        if (t === null) return;
        if (api.inSelf(t)) throw new Error('scan-vampire fanged its own code');
        if (api.inImage(t)) return;               // a partner's cell; allowed, as any scanner's bomb
        const f = api.vm.peek(t);
        if (f.op !== 'JMP' || api.norm(t + f.a) !== pit) throw new Error('A scan-vampire fang does not lead to the pit');
        fangs++;
        if (t === target) hitPlanted = true;
      },
      final() {
        if (isPlanted && target !== null && !hitPlanted) throw new Error('scan-vampire ignored the planted cell');
        if (api.alone) {
          if (looks < 1000) throw new Error(`scan-vampire looked at too few cells (${looks})`);
          if (fangs) throw new Error('scan-vampire fanged an empty core');
        }
      },
    };
  },
};

const blocks = [elf, finisherMulti, hillStone, scanVampire];
export default blocks;
