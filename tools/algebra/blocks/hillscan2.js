// Hill scanners, second group: three scanner/clear mechanisms from the
// Koenigstuhl 94nop hill that we had no block for (docs/hill-recipe-book.md,
// scanners chapter, gaps #6 and #14):
//
// - trap-scanner: Anton Marsden's Z++ idea. A JMZ scanner that, instead of
//   bombing what it finds, lays a three-cell trap over it: SPL #0, SPL #0,
//   JMP -2. An enemy process that runs into any of the three cells splits and
//   jumps back inside, so all of that warrior's processes there are captured
//   (and multiply, eating its process table) instead of half of them walking
//   on, as after a lone SPL bomb. The SPL cells have both fields zero, so the
//   scan doesn't see them again; the JMP is recognised and skipped. After HITS
//   traps, or after SELF looks that land on its own warrior (the lap has come
//   round), it turns into a DAT clear of everything outside its image, which
//   kills the prisoners. Used by Z++.
// - finisher-overwrite: Philip Kendall's One Shot clear. The clear writes
//   through the opening's own scan pointer (the probe): A-indirect for the
//   bomb, B post-increment for the target. Each bomb's A-field is the offset
//   from the probe to the next bomb and its B-field is the length of the
//   image after the probe, so when the clear comes round and writes over the
//   probe itself, the pointer is reset past the warrior and the next pass
//   writes the next bomb: SPL, SPL, then DAT forever (SPLS sets how many SPL
//   passes). No counter, no range checks, so many processes can share it
//   (PUMP 1 runs it from a SPL #0 pump, as One Shot does). Used by One Shot.
// - oneshot-cobra-imp: inversed's King Cobra with its imp failsafe. The scan
//   and the two-cell bomb detection are those of `oneshot-cobra`; on a real
//   find it spins off a `mov.i #x, 1` imp (insurance: if the clear is killed
//   the warrior still ties) and runs a pumped SPL->DAT clear from the find.
//   Why `oneshot-cobra` left the imp out: with one clear process the imp gets
//   every other cycle and crawls 1 cell per 2 cycles while the clear writes 1
//   cell per ~6, so the imp laps the core in ~16,000 cycles and overwrites the
//   warrior. Two things make it safe here, as in King Cobra: the clear runs
//   from a SPL #0 pump, so its processes outnumber the imp and the imp slows
//   to 1 cell per N cycles while the shared clear pointer keeps its speed and
//   catches the imp from behind; and the imp starts just past the image's
//   end, as far from the image's start as it can be. Because many processes
//   share the pointer, the clear can't check its range before each write
//   (another process may already be past the check), so it skips the image
//   the One Shot way: its pointer is a state cell at the image's start and
//   both bombs carry the image's length in their B-field, so a wrap resets
//   the pointer past the warrior. That wrap also switches SPL to DAT, so the
//   front meets the imp (waiting just past the image) as a DAT and kills it.
//   With a SPL front instead, the stunned imp follows the front into its
//   fresh carpet and multiplies until the clear starves. King Cobra switches
//   by a DJN-stream timer; this one's SPL pass runs from the find to the
//   image only. Used by King Cobra, Kaitain.
//
// All three are '94-only (A-indirect, .I compares, JMZ.F). All Redcode here is
// written from scratch; the hill warriors named above were read for ideas,
// never copied. How to write a block: docs/block-algebra.md.

const MARKER = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };
const mod = (x, core) => ((x % core) + core) % core;
// The global index of a local label, as an expression usable on the current line.
const idxOf = (ctx, label) => `(${ctx.L(label)}+${ctx.pc()})`;
// A cell is "live" when one of the warrior's processes runs near it (a booted
// warrior's original image is fair game once nothing runs there).
const live = (api, t) => api.vm.processes(0).some((q) => mod(t - q + api.settings.maxLength, api.core) < 2 * api.settings.maxLength);
const ownCell = (api, t) => api.inSelf(t) || (api.inImage(t) && live(api, t));
// The k-th in-range cell a scan looking at ptr + B0 + k STEP sees, with the
// cells from lo to hi around it clear of the warrior.
function scanTarget(api, lo, hi, nth = 3) {
  const ptr = api.at('ptr'), b0 = api.code('ptr').b;
  let found = 0;
  for (let k = 1; k < 5000; k++) {
    const c = mod(ptr + b0 + k * api.P.STEP, api.core);
    let clear = true;
    for (let j = lo; j <= hi && clear; j++) if (api.inImage(c + j)) clear = false;
    if (clear && ++found === nth) return c;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// trap-scanner
//
// ptr.B is the scan pointer. A non-empty cell past the image (and ROOM cells
// short of its start, so the trap's three cells never reach it) gets the trap,
// unless it is the JMP of one of our own traps. A non-empty cell in the image
// counts down SELF; HITS traps or SELF self-finds start the clear: DAT from the
// image's end round to its start, again and again.
function emitTrap(ctx) {
  const { L, P, span } = ctx, ptr = L('ptr'), tp = L('tp'), cp = L('cp');
  ctx.ins('sLoop', 'ADD', 'AB', `#${P.STEP}`, ptr);
  ctx.ins('sLook', 'JMZ', 'F', L('sLoop'), `@${ptr}`);           // empty (or our SPL): keep scanning
  ctx.ins('sHit', 'SLT', 'AB', `#(${span}-${idxOf(ctx, 'ptr')}-1)`, ptr);
  ctx.ins('', 'JMP', 'B', L('self'));                           // inside the image after ptr
  ctx.ins('', 'SLT', 'AB', `#(CORESIZE-${idxOf(ctx, 'ptr')}-${P.ROOM})`, ptr);
  ctx.ins('', 'JMP', 'B', L('tChk'));
  ctx.ins('', 'JMP', 'B', L('self'));                           // the image before ptr, or too close to it
  ctx.ins('tChk', 'SNE', 'I', L('tJmp'), `@${ptr}`);            // the JMP of one of our traps? leave it
  ctx.ins('', 'JMP', 'B', L('sLoop'));
  ctx.ins('tSet', 'MOV', 'B', ptr, tp);
  ctx.ins('', 'ADD', 'AB', `#(${idxOf(ctx, 'ptr')}-${idxOf(ctx, 'tp')})`, tp);
  ctx.ins('tW1', 'MOV', 'I', L('tSpl'), `>${tp}`);              // c:   SPL #0
  ctx.ins('tW2', 'MOV', 'I', L('tSpl'), `>${tp}`);              // c+1: SPL #0
  ctx.ins('tW3', 'MOV', 'I', L('tJmp'), `>${tp}`);              // c+2: JMP -2 (back to c)
  ctx.ins('', 'DJN', 'B', L('sLoop'), L('hits'));
  ctx.ins('', 'JMP', 'B', L('cGo'));
  ctx.ins('self', 'DJN', 'B', L('sLoop'), L('selfs'));
  // The clear: every cell outside the image, from its end round to its start.
  ctx.ins('cGo', 'MOV', 'AB', `#(${span}-${idxOf(ctx, 'cp')})`, cp);
  ctx.ins('', 'MOV', 'AB', `#(CORESIZE-${span})`, L('cnt'));
  ctx.ins('cLoop', 'MOV', 'I', L('dbomb'), `>${cp}`);
  ctx.ins('', 'DJN', 'B', L('cLoop'), L('cnt'));
  ctx.ins('', 'JMP', 'B', L('cGo'));
  // Data. The first cell looked at is the first one past the image.
  ctx.ins('ptr', 'DAT', 'F', '#0', `#(${span}-${idxOf(ctx, 'ptr')}-${P.STEP})`);
  ctx.ins('tp', 'DAT', 'F', '#0', '#0');
  ctx.ins('cp', 'DAT', 'F', '#0', '#0');
  ctx.ins('cnt', 'DAT', 'F', '#0', '#0');
  ctx.ins('hits', 'DAT', 'F', '#0', `#${P.HITS}`);
  ctx.ins('selfs', 'DAT', 'F', '#0', `#${P.SELF}`);
  ctx.ins('tSpl', 'SPL', 'B', '#0', '#0');
  ctx.ins('tJmp', 'JMP', 'B', '-2', '0');
  ctx.ins('dbomb', 'DAT', 'F', '#0', '#0');
}

const trapTarget = (api) => scanTarget(api, -4, api.P.ROOM + 4);

function watchTrap(api) {
  const { vm, core } = api, tp = api.at('tp'), cp = api.at('cp');
  const planted = api.scenario === 'trap-scanner: planted target';
  const target = planted ? trapTarget(api) : -1;
  const laid = new Map(), killed = new Int32Array(core).fill(-1);
  let looks = 0, traps = 0, clearAt = null, sole = false;
  const writer = {
    [api.at('tW1')]: ['tSpl', tp], [api.at('tW2')]: ['tSpl', tp], [api.at('tW3')]: ['tJmp', tp], [api.at('cLoop')]: ['dbomb', cp],
  };
  return {
    before(pc) {
      if (pc === api.at('sLook')) looks++;
      if (clearAt === null && pc === api.at('cGo')) {
        clearAt = vm.cycle;
        sole = api.alone && vm.processes(0).length === 1;
      }
      const w = writer[pc];
      return w ? { bomb: w[0], pc, t: mod(w[1] + vm.peek(w[1]).b, core) } : null;
    },
    after(tok) {
      if (!tok) return;
      const { t, bomb } = tok;
      if (ownCell(api, t)) throw new Error('trap-scanner wrote over its own warrior');
      if (!api.same(vm.peek(t), api.code(bomb)) || vm.writerPc[t] !== tok.pc) throw new Error('trap-scanner wrote something other than its trap or bomb');
      if (bomb === 'dbomb') killed[t] = vm.cycle;
      else {
        laid.set(t, bomb);
        // A trap on a booted warrior's abandoned original is fair game; one on empty core is not.
        if (tok.pc === api.at('tW1') && !api.inImage(t) && !api.inDead(t)) traps++;
      }
    },
    final() {
      if (planted) {
        const cells = [0, 1, 2].map((k) => laid.get(mod(target + k, core)));
        if (cells[0] !== 'tSpl' || cells[1] !== 'tSpl' || cells[2] !== 'tJmp') throw new Error('trap-scanner did not lay SPL, SPL, JMP over the planted target');
        if (mod(target + 2 + api.code('tJmp').a, core) !== target) throw new Error("trap-scanner's JMP does not lead back into the trap");
      }
      if (!api.alone) return;
      if (looks < 200) throw new Error('trap-scanner looked at too few cells');
      if (traps) throw new Error('trap-scanner laid a trap in an empty core');
      if (clearAt === null && vm.cycle > 4 * core) throw new Error('trap-scanner never switched to its clear');
      if (sole && vm.cycle - clearAt >= 2 * core + 10) {
        for (let c = 0; c < core; c++) if (!api.inImage(c) && killed[c] < clearAt) throw new Error("trap-scanner's clear left cells untouched");
      }
    },
  };
}

// ---------------------------------------------------------------------------
// finisher-overwrite
//
// Entered from a seq after an opening that provides `probe` (B = the cell it
// found, or the image boundary). It guards the probe off the image, points the
// probe's A-field at the first bomb, and clears with MOV.I *probe, >probe (two
// writes a loop). The bombs form a chain: SPLS SPL bombs, then a DAT whose
// A-field points back at itself; every B-field is the image's length after the
// probe. One process, or a SPL #0 pump (PUMP 1).
function bombChain(P) { return [...Array(P.SPLS).keys()].map((k) => `b${k}`).concat('bd'); }

function emitOverwrite(ctx) {
  const { L, P, span } = ctx, probe = ctx.ref('probe');
  const idx = () => `(${probe}+${ctx.pc()})`;   // the probe's global index, on the current line
  const chain = bombChain(P);
  ctx.mark('payload');
  ctx.ins('', 'SLT', 'AB', `#(${span}-${idx()}-1)`, probe);     // probe inside the image? -> its end
  ctx.ins('', 'MOV', 'AB', `#(${span}-${idx()})`, probe);
  ctx.ins('', 'MOV', 'A', `#(${L(chain[0])}-${probe})`, probe);  // *probe -> the first bomb
  if (P.PUMP) ctx.ins('pump', 'SPL', 'B', '#0', '0');
  ctx.ins('w1', 'MOV', 'I', `*${probe}`, `>${probe}`);
  ctx.ins('w2', 'MOV', 'I', `*${probe}`, `>${probe}`);
  ctx.ins('', 'JMP', 'B', L('w1'));
  chain.forEach((b, k) => {
    const nextBomb = chain[Math.min(k + 1, chain.length - 1)];
    const isDat = b === 'bd';
    ctx.ins(b, isDat ? 'DAT' : 'SPL', isDat ? 'F' : 'B', `#(${L(nextBomb)}-${probe})`, `#(${span}-${idx()})`);
  });
}

function watchOverwrite(api) {
  const { vm, core, P } = api, chain = bombChain(P);
  const probe = api.ref('probe'), skip = api.code(chain[0]).b;
  const written = new Int32Array(core).fill(-1);
  let enteredAt = null, wraps = 0, writes = 0;
  const w1 = api.at('w1'), w2 = api.at('w2');
  return {
    before(pc) {
      if (enteredAt === null && pc === api.at('payload')) enteredAt = vm.cycle;
      if (pc !== w1 && pc !== w2) return null;
      return { pc, t: mod(probe + vm.peek(probe).b, core) };
    },
    after(tok) {
      if (!tok) return;
      const { t, pc } = tok;
      const want = api.code(chain[Math.min(wraps, chain.length - 1)]);
      if (!api.same(vm.peek(t), want) || vm.writerPc[t] !== pc) throw new Error(`finisher-overwrite wrote something other than pass ${wraps + 1}'s bomb`);
      if (t === probe) {   // the wrap: the bomb over the pointer starts the next pass past the image
        wraps++;
        if (wraps === 2) {
          for (let c = 0; c < core; c++) if (api.rel(c, probe) >= skip && written[c] < 0) throw new Error('finisher-overwrite left cells untouched on its first full pass');
        }
        return;
      }
      if (api.inSelf(t) || api.rel(t, probe) < skip) throw new Error('finisher-overwrite cleared its own warrior');
      writes++; written[t] = vm.cycle;
    },
    final() {
      if (enteredAt === null) return;
      if (writes >= core && wraps === 0) throw new Error('finisher-overwrite never came round onto its pointer');
      if (writes >= chain.length * core && wraps < chain.length - 1) throw new Error('finisher-overwrite never reached its DAT pass');
    },
  };
}

// ---------------------------------------------------------------------------
// oneshot-cobra-imp
//
// cptr is a state cell, so it is the image's first cell (alone, or when this
// block's is the first state of a seq). The scan: ptr holds a pair GAP apart,
// stepped by inc and compared (SNE.I); a difference in range must show two
// adjacent occupied cells at the B cell. Then: cptr := the found cell, the imp
// is copied to IGAP cells past the image and a process started on it, and the
// clear runs from a SPL #0 pump: MOV.I *cptr, >cptr, cptr.A naming the bomb.
// Both bombs' B is the image's length, so a write over cptr resets it past the
// warrior; the SPL's A names the DAT and the DAT's names itself, so the first
// wrap turns the SPL pass (find -> image) into a DAT pass forever. The pass
// change has to be the wrap and not a timer: the imp waits just past the
// image, so the front reaches it right after a wrap, and it must arrive as a
// DAT. A SPL front would stun the imp, and the stunned process would follow
// the front into its fresh SPL carpet, multiplying until the clear starves
// (seen with a timer: ~2% of the turns left to the clear).
function emitCobraImp(ctx) {
  const { L, P, span } = ctx, ptr = L('ptr'), cptr = L('cptr'), tp = L('tp');
  const lo = `#(${span}-${idxOf(ctx, 'ptr')}-1)`;
  ctx.ins('sLoop', 'ADD', 'F', L('inc'), ptr);
  ctx.ins('sLook', 'SNE', 'I', `*${ptr}`, `@${ptr}`);
  ctx.ins('', 'JMP', 'B', L('sLoop'));
  ctx.ins('sHit', 'SLT', 'AB', lo, ptr);                         // past the image?
  ctx.ins('', 'JMP', 'B', L('sLoop'));
  ctx.ins('', 'SLT', 'AB', `#(CORESIZE-${idxOf(ctx, 'ptr')}-${P.ROOM})`, ptr);
  ctx.ins('', 'JMP', 'B', L('chk'));
  ctx.ins('', 'JMP', 'B', L('sLoop'));
  // Bomb detection: the B cell and the one after it both occupied.
  ctx.ins('chk', 'MOV', 'B', ptr, tp);
  ctx.ins('', 'ADD', 'AB', `#(${idxOf(ctx, 'ptr')}-${idxOf(ctx, 'tp')})`, tp);
  ctx.ins('', 'JMZ', 'F', L('sLoop'), `@${tp}`);
  ctx.ins('', 'ADD', 'AB', '#1', tp);
  ctx.ins('', 'JMZ', 'F', L('sLoop'), `@${tp}`);
  // Commit.
  ctx.ins('commit', 'MOV', 'B', ptr, cptr);
  ctx.ins('', 'ADD', 'AB', `#(${idxOf(ctx, 'ptr')}-${idxOf(ctx, 'cptr')})`, cptr);
  ctx.ins('', 'MOV', 'A', `#(${L('sbomb')}-${cptr})`, cptr);       // *cptr -> the SPL
  ctx.ins('launch', 'MOV', 'I', L('imp'), `(${span}+${P.IGAP}-${ctx.pc()})`);
  ctx.ins('spin', 'SPL', 'B', `(${span}+${P.IGAP}-${ctx.pc()})`, '0');
  ctx.ins('pump', 'SPL', 'B', '#0', '0');
  ctx.ins('cLoop', 'MOV', 'I', `*${cptr}`, `>${cptr}`);
  ctx.ins('cW2', 'MOV', 'I', `*${cptr}`, `>${cptr}`);
  ctx.ins('', 'JMP', 'B', L('cLoop'));
  // Data.
  ctx.ins('inc', 'DAT', 'F', `#${P.STEP}`, `#${P.STEP}`);
  ctx.ins('ptr', 'DAT', 'F', `#(${span}-${idxOf(ctx, 'ptr')}-${P.GAP}-${P.STEP})`, `#(${span}-${idxOf(ctx, 'ptr')}-${P.STEP})`);
  ctx.ins('tp', 'DAT', 'F', '#0', '#0');
  ctx.ins('sbomb', 'SPL', 'B', `#(${L('dbomb')}-${cptr})`, `#(${span}-${idxOf(ctx, 'cptr')})`);
  ctx.ins('dbomb', 'DAT', 'F', `#(${L('dbomb')}-${cptr})`, `#(${span}-${idxOf(ctx, 'cptr')})`);
  ctx.ins('imp', 'MOV', 'I', '#0', '$1');
}

// Planted body: two adjacent cells at a B cell the scan reaches, room around.
const cobImpTarget = (api) => scanTarget(api, -4 - api.P.GAP, 8);

function watchCobraImp(api) {
  const { vm, core } = api, cptr = api.at('cptr');
  const skip = api.code('sbomb').b;
  const impAt = mod(api.at('launch') + api.code('launch').b, core), impIns = api.code('imp');
  const planted = api.scenario === 'oneshot-cobra-imp: planted target';
  const target = planted ? cobImpTarget(api) : -1;
  let looks = 0, committed = null, found = -1, dat = 0, writes = 0, wraps = 0, hitBody = false, impRan = false, impSteps = 0;
  return {
    before(pc) {
      if (pc === api.at('sLook')) looks++;
      if (committed === null && pc === api.at('commit')) {
        committed = vm.cycle;
        const ptr = api.at('ptr');
        found = mod(ptr + vm.peek(ptr).b, core);
      }
      if (pc === api.at('cLoop') || pc === api.at('cW2')) return { clear: true, pc, t: mod(cptr + vm.peek(cptr).b, core), bomb: vm.peek(mod(cptr + vm.peek(cptr).a, core)) };
      if (committed !== null && !api.inSelf(pc) && api.same(vm.peek(pc), impIns)) return { imp: true, pc, t: mod(pc + 1, core) };
      return null;
    },
    after(tok) {
      if (!tok) return;
      if (tok.imp) {
        if (tok.pc === impAt) impRan = true;
        impSteps++;
        if (api.inImage(tok.t)) throw new Error("oneshot-cobra-imp's failsafe imp reached the warrior");
        return;
      }
      const { t, bomb } = tok;
      if (t !== cptr && (api.inSelf(t) || api.rel(t, cptr) < skip)) throw new Error('oneshot-cobra-imp cleared its own warrior');
      if (!api.same(vm.peek(t), bomb) || vm.writerPc[t] !== tok.pc) throw new Error('oneshot-cobra-imp wrote something other than its bomb');
      const want = api.code(wraps ? 'dbomb' : 'sbomb');
      if (!api.same(bomb, want)) throw new Error(`oneshot-cobra-imp wrote a ${bomb.op} on pass ${wraps + 1}`);
      if (t === cptr) wraps++; else writes++;
      if (bomb.op === 'DAT') dat++;
      if (t === target || t === mod(target + 1, core)) hitBody = true;
    },
    final() {
      if (planted) {
        if (committed === null) throw new Error('oneshot-cobra-imp did not commit to the planted body');
        if (!impRan || impSteps < 4) throw new Error('oneshot-cobra-imp did not spin off its imp at the find');
        if (!hitBody) throw new Error('oneshot-cobra-imp did not clear the found body');
        if (writes >= core && !dat) throw new Error('oneshot-cobra-imp never reached its DAT kill pass');
      }
      if (api.alone) {
        // Alone, the only thing it may commit to is a booted warrior's abandoned original.
        if (committed !== null && !api.inImage(found) && !api.inDead(found)) throw new Error('oneshot-cobra-imp committed on an empty core');
        if (committed === null && looks < 1000) throw new Error('oneshot-cobra-imp looked at too few cells');
      }
    },
  };
}

// ---------------------------------------------------------------------------

const roomCheck = (P, s) => (P.ROOM >= Math.floor(s.coreSize / 2) ? ['ROOM leaves no room for the scan past the warrior'] : []);
const blocks = {
  'trap-scanner': {
    kind: 'body', exit: 'never', processes: 1, writes: 'core', roams: false, dialects: '94',
    purpose: 'Z++ trap scanner: looks at one cell every STEP and lays a SPL #0, SPL #0, JMP -2 trap over each non-empty cell it finds, capturing every enemy process that runs into it; after HITS traps or SELF looks at its own warrior it becomes a DAT clear of everything outside its image, killing the prisoners.',
    params: { STEP: [1, 27719], HITS: [1, 400], SELF: [1, 400], ROOM: [3, 4000] },
    entry: 'sLoop', loop: 'sLoop',
    provides: { splBomb: 'tSpl', datBomb: 'dbomb' },
    mutable: [['ptr', ['b']], ['tp', ['b']], ['cp', ['b']], ['cnt', ['b']], ['hits', ['b']], ['selfs', ['b']]],
    mismatches: roomCheck,
    emit: emitTrap,
    plant: (api) => [[trapTarget(api), MARKER]],
    watch: watchTrap,
  },
  'finisher-overwrite': {
    kind: 'finisher', exit: 'never', writes: 'core', relocatable: false, protects: 'image', dialects: '94',
    processes: (P) => (P.PUMP ? 8 : 1), grows: true,
    purpose: 'One Shot clear: clears forward from the probe through the probe itself (A-indirect bomb, B post-increment); each bomb names the next in its A-field and the image length in its B-field, so every wrap over the pointer jumps past the warrior and starts the next pass: SPLS SPL passes, then DAT forever. PUMP 1 runs it from a SPL #0 pump.',
    params: { SPLS: [0, 3], PUMP: [0, 1] },
    entry: 'payload',
    needs: ['probe'],
    provides: { datBomb: 'bd' },
    mismatches: (P, s) => (P.PUMP && s.maxProcesses < 2 ? ['PUMP needs more than one process'] : []),
    emit: emitOverwrite,
    watch: watchOverwrite,
  },
  'oneshot-cobra-imp': {
    kind: 'body', exit: 'never', processes: 8, grows: true, writes: 'core', roams: true, dialects: '94',
    purpose: 'King Cobra oneshot with its imp failsafe: scans a pair and commits only to two adjacent occupied cells, then spins off a MOV.I #0, 1 imp just past its image (it still ties if the clear dies) and runs a SPL #0-pumped clear from the find: SPL up to its image, then (its pointer overwritten on the wrap) DAT forever; the pump keeps the imp slow so the DAT front catches it before it laps back.',
    params: { STEP: [1, 27719], GAP: [1, 64], ROOM: [100, 4000], IGAP: [0, 200] },
    entry: 'sLoop', loop: 'sLoop',
    provides: { splBomb: 'sbomb', datBomb: 'dbomb' },
    mutable: [['cptr', ['op', 'mod', 'aMode', 'a', 'bMode', 'b']], ['ptr', ['a', 'b']], ['tp', ['b']]],
    mismatches: roomCheck,
    state(ctx) { ctx.ins('cptr', 'DAT', 'F', '#0', '#0'); },
    emit: emitCobraImp,
    plant: (api) => { const c = cobImpTarget(api); return [[c, MARKER], [mod(c + 1, api.core), MARKER]]; },
    watch: watchCobraImp,
  },
};
for (const [id, b] of Object.entries(blocks)) b.id = id;
// Defaults that work on the 8,000 and 55,440 cores. 2341 and 19 are prime to both.
blocks['trap-scanner'].defaults = { STEP: 2341, HITS: 24, SELF: 8, ROOM: 8 };
blocks['finisher-overwrite'].defaults = { SPLS: 2, PUMP: 1 };
blocks['oneshot-cobra-imp'].defaults = { STEP: 19, GAP: 10, ROOM: 400, IGAP: 4 };

export default Object.values(blocks);
