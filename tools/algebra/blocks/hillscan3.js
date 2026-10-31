// Hill scanners, third group: three scan engines from the Koenigstuhl 94nop
// hill that we had no block for (docs/hill-recipe-book.md, scanners and
// vampires chapters, gaps #14 and #15):
//
// - blur-carpet: the hill blur's single moving carpet (The Machine, HazyLazy
//   A 70, Perseus; Twin Storms carpets the same way). Every lap of the scan
//   drops one SPL at a carpet pointer, whether anything was found or not, and
//   a find moves that one pointer to the find, so the carpet keeps growing
//   from the newest find while the scan goes on. The scan compares a pair of
//   cells GAP apart on a mod-10 step (70: one residue class, 800 cells a lap
//   on the 8,000 core), so a lap is short. When the lap is done (SCANS laps)
//   the same pointer becomes a SPL #0-pumped DAT clear that carries on from
//   the carpet's front. `blur-scanner` differs: it lays a fixed LEN cells per
//   find and only while armed, with a one-cell JMZ look.
// - twin-storm: Twin Storms' two booted scanners. The block copies one small
//   engine to two places D apart and starts both, so one bomb can't end the
//   scan; the original stays behind as a decoy. Each engine compares two cells
//   HOP apart, bombs both pointers every lap, and steps on by STEP only when
//   the pair is equal, so empty core gets a sparse SPL lattice and a find gets
//   a solid carpet. Each engine scans TIME laps, a window that misses both
//   engines (checked in `mismatches`), then becomes a pumped DAT clear; the
//   first engine's clear meets the second engine's only after both are
//   clears. This is a block and not `copies(scanner)` because a copied scanner
//   only knows its own image and bombs its sibling (the gate says so), and
//   `copies` refuses clears; see the report.
// - scanner-mul: Russ Post's multiplicative scan. The pointer is multiplied
//   each lap and stepped back one (p := MULT p - 1, a linear congruential
//   sequence), so the scan visits the core in a pseudo-random order instead of
//   a fixed stride. When MULT - 1 is a multiple of every prime factor of the
//   core (and of 4 when 4 divides it), the sequence visits every cell once per
//   core-size looks (Hull-Dobell), checked in `mismatches`. Bombs like
//   `scanner`: one DAT or SPL on each non-empty cell outside its image.
//
// All three are '94-only (SEQ/SNE .I, A-field modes, MUL). All Redcode here is
// written from scratch; the hill warriors named above were read for ideas,
// never copied. How to write a block: docs/block-algebra.md.

const MARKER = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };
const mod = (x, core) => ((x % core) + core) % core;
// The global index of a local label, as an expression usable on the current line.
const idxOf = (ctx, label) => `(${ctx.L(label)}+${ctx.pc()})`;
const live = (api, t) => api.vm.processes(0).some((q) => mod(t - q + api.settings.maxLength, api.core) < 2 * api.settings.maxLength);
const ownCell = (api, t) => api.inSelf(t) || (api.inImage(t) && live(api, t));
// Same opcode, modifier and modes (fields may have moved: a scan pointer).
const sameOp = (x, y) => x.op === y.op && x.mod === y.mod && x.aMode === y.aMode && x.bMode === y.bMode;
const BODY = { kind: 'body', exit: 'never', roams: false, dialects: '94' };

// ---------------------------------------------------------------------------
// blur-carpet
//
// cptr is a state cell (the image's first cell, alone or as the first state of
// a seq). Its B-field is the carpet pointer, its A-field names the clear's
// bomb. The loop (four instructions when nothing differs):
//   MOV.I bomb, >cptr     one SPL at the carpet pointer, every lap
//   SEQ.I a, a+GAP        the pair (scan's own fields)
//   JMP   hit             (skipped when the pair is equal)
//   ADD.F inc, scan       step both by STEP
//   DJN   loop, cnt       SCANS laps
// A find moves the carpet to BACK cells before the pair's A cell, but only if
// the carpet can't reach the image from there in the laps left: the hit path
// checks scan.A >= LO and scan.A < HI - cnt. So the carpet never enters the
// image, and the clear that follows (MOV.I *cptr, >cptr from a SPL #0 pump)
// starts at the carpet's front and goes on round the core; when it writes over
// cptr the DAT's B-field (the image's length after cptr) resets the pointer
// past the warrior, and the next pass is DAT again.
function emitBlurCarpet(ctx) {
  const { L, P, span } = ctx, cptr = L('cptr'), scan = L('scan'), cnt = L('cnt'), tmp = L('tmp');
  ctx.ins('sLoop', 'MOV', 'I', L('bomb'), `>${cptr}`);
  const first = `(${span}-${idxOf(ctx, 'scan')}+${P.BACK})`;
  ctx.ins('scan', 'SEQ', 'I', first, `${first}+${P.GAP}`);
  ctx.ins('', 'JMP', 'B', L('hit'));
  ctx.ins('next', 'ADD', 'F', L('inc'), scan);
  ctx.ins('', 'DJN', 'B', L('sLoop'), cnt);
  // The clear, from the carpet's front.
  ctx.ins('cGo', 'SPL', 'B', '#0', '0');
  ctx.ins('cLoop', 'MOV', 'I', `*${cptr}`, `>${cptr}`);
  ctx.ins('cW2', 'MOV', 'I', `*${cptr}`, `>${cptr}`);
  ctx.ins('', 'JMP', 'B', L('cLoop'));
  // A pair differs: move the carpet there if it stays clear of the image.
  ctx.ins('hit', 'SLT', 'A', `#(${span}-${idxOf(ctx, 'scan')}+${P.BACK}-1)`, scan);  // past the image's end?
  ctx.ins('', 'JMP', 'B', L('next'));
  ctx.ins('', 'MOV', 'A', `#(CORESIZE-${idxOf(ctx, 'scan')}-2)`, tmp);
  ctx.ins('', 'SUB', 'BA', cnt, tmp);                                             // the laps left
  ctx.ins('', 'SLT', 'A', scan, tmp);                                             // room for them before the image?
  ctx.ins('', 'JMP', 'B', L('next'));
  ctx.ins('set', 'MOV', 'AB', scan, cptr);
  ctx.ins('', 'ADD', 'AB', `#(${idxOf(ctx, 'scan')}-${idxOf(ctx, 'cptr')}-${P.BACK})`, cptr);
  ctx.ins('setJ', 'JMP', 'B', L('next'));
  // Data.
  ctx.ins('inc', 'DAT', 'F', `#${P.STEP}`, `#${P.STEP}`);
  ctx.ins('tmp', 'DAT', 'F', '#0', '#0');
  ctx.ins('cnt', 'DAT', 'F', '#0', `#${P.SCANS}`);
  ctx.ins('bomb', 'SPL', 'B', '#0', '#0');
  ctx.ins('dbomb', 'DAT', 'F', `#(${L('dbomb')}-${cptr})`, `#(${span}-${idxOf(ctx, 'cptr')})`);
}

// The planted target: the 3rd pair the scan compares whose A cell has room
// around it, BACK before it and the rest of the laps after it.
function carpetTarget(api) {
  const scan = api.at('scan'), a0 = api.code('scan').a, P = api.P;
  let found = 0;
  for (let k = 0; k < 2000; k++) {
    const c = mod(scan + a0 + k * P.STEP, api.core);
    let clear = true;
    for (let j = -P.BACK - 8; j <= 60 && clear; j++) if (api.inImage(c + j)) clear = false;
    if (clear && ++found === 3) return c;
  }
  return -1;
}

function watchBlurCarpet(api) {
  const { vm, core, P } = api, cptr = api.at('cptr'), scan = api.at('scan');
  const skip = api.code('dbomb').b;
  const planted = api.scenario === 'blur-carpet: planted target';
  const target = planted ? carpetTarget(api) : -1;
  const carpet = new Set(), killed = new Int32Array(core).fill(-1);
  let looks = 0, spl = 0, moves = 0, stray = 0, clearAt = null, sole = false, pending = null;
  const clearPcs = new Set([api.at('cLoop'), api.at('cW2')]);
  return {
    before(pc) {
      if (pc === scan) looks++;
      if (clearAt === null && pc === api.at('cGo')) {
        clearAt = vm.cycle;
        sole = api.alone && vm.processes(0).length === 1;
      }
      if (pc === api.at('set')) {
        // A move: the pair it acts on (A cell and B cell), as the scan sees them now.
        const a = mod(scan + vm.peek(scan).a, core), b = mod(scan + vm.peek(scan).b, core);
        moves++;
        const ours = (c) => carpet.has(c) || api.inImage(c) || api.inDead(c);
        if (!ours(a) && !ours(b)) stray++;
        pending = a;
        return null;
      }
      if (pc === api.at('setJ') && pending !== null) {
        // The carpet now starts BACK cells before the A cell.
        if (mod(cptr + vm.peek(cptr).b, core) !== mod(pending - P.BACK, core)) throw new Error('blur-carpet did not move its carpet to the find');
        pending = null;
      }
      if (pc === api.at('sLoop')) return { pc, t: mod(cptr + vm.peek(cptr).b, core), bomb: api.code('bomb') };
      if (clearPcs.has(pc)) return { pc, clear: true, t: mod(cptr + vm.peek(cptr).b, core), bomb: vm.peek(mod(cptr + vm.peek(cptr).a, core)) };
      return null;
    },
    after(tok) {
      if (!tok) return;
      const { t, bomb } = tok;
      if (tok.clear) {
        if (t !== cptr && (api.inSelf(t) || api.rel(t, cptr) < skip)) throw new Error('blur-carpet cleared its own warrior');
        if (!api.same(bomb, api.code('dbomb'))) throw new Error('blur-carpet cleared with something other than its DAT');
        if (t !== cptr) killed[t] = vm.cycle;
      } else {
        if (ownCell(api, t)) throw new Error('blur-carpet carpeted its own warrior');
        carpet.add(t); spl++;
      }
      if (!api.same(vm.peek(t), bomb) || vm.writerPc[t] !== tok.pc) throw new Error('blur-carpet dropped something other than its bomb');
    },
    final() {
      if (planted) {
        if (!moves) throw new Error('blur-carpet never moved its carpet');
        for (let k = -P.BACK; k < 8; k++) if (!carpet.has(mod(target + k, core))) throw new Error('blur-carpet did not carpet the planted target');
      }
      if (!api.alone) return;
      if (looks < Math.min(P.SCANS, 1000)) throw new Error('blur-carpet looked at too few cells');
      if (stray) throw new Error('blur-carpet moved its carpet in an empty core');
      if (spl < Math.min(P.SCANS, 1000) - 1) throw new Error('blur-carpet did not drop a bomb every lap');
      if (clearAt === null && vm.cycle > 12 * P.SCANS + 100) throw new Error('blur-carpet never switched to its clear');
      if (sole && clearAt !== null && vm.cycle - clearAt >= 2 * core) {
        for (let c = 0; c < core; c++) if (!api.inImage(c) && killed[c] < clearAt) throw new Error("blur-carpet's clear left cells untouched");
      }
    },
  };
}

// ---------------------------------------------------------------------------
// twin-storm
//
// A launcher copies the engine (E cells) to cptr + BOOT and cptr + BOOT + D in
// one loop (two MOVs from one source pointer), starts the first with SPL and
// jumps into the second. Each engine:
//   cptr  DAT   names dbomb, B = E (the clear's pointer, at the engine's start)
//   ptr   SNE.I A, A+HOP     the pair, FIRST cells past the engine's start
//         ADD.F inc, ptr     equal: STEP-1 on (and 1 more from the bombs)
//         MOV.I bomb, >ptr   bomb the B pointer, step it
//         MOV.I bomb, }ptr   bomb the A pointer, step it
//         DJN   ptr, #TIME   TIME laps
//         SPL   #0           then a pumped clear: MOV.I *cptr, >cptr twice
// A lap moves each pointer STEP cells (pair equal) or one (pair differs), so in
// TIME laps the A pointer stays in [FIRST, FIRST + TIME*STEP] and the B pointer
// HOP above it. `mismatches` keeps both windows off both engines.
const TS_E = 13;                       // engine cells
function tsWindows(P) { const r = P.TIME * P.STEP + 2; return [[P.FIRST, P.FIRST + r], [P.FIRST + P.HOP, P.FIRST + P.HOP + r]]; }
// Does [lo, hi] (offsets from the engine, mod core) meet [z, z + n)?
function meets([lo, hi], z, n, core) {
  if (hi - lo + 1 >= core) return true;
  for (let i = 0; i < n; i++) if (mod(z + i - lo, core) <= hi - lo) return true;
  return false;
}

function emitTwinStorm(ctx) {
  const { L, P } = ctx, s = L('src');
  // The launcher.
  ctx.ins('boot', 'MOV', 'I', `<${s}`, `<${L('d1')}`);
  ctx.ins('', 'MOV', 'I', `@${s}`, `<${L('d2')}`);
  ctx.ins('', 'DJN', 'B', L('boot'), L('bc'));
  ctx.ins('', 'SPL', 'B', `${L('ptr')}+${P.BOOT}`);
  ctx.ins('launch', 'JMP', 'B', `${L('ptr')}+${P.BOOT}+${P.D}`);
  ctx.ins('src', 'DAT', 'F', '#0', `#(${L('eEnd')}-${s})`);
  ctx.ins('d1', 'DAT', 'F', '#0', `#(${L('eEnd')}+${P.BOOT}-${L('d1')})`);
  ctx.ins('d2', 'DAT', 'F', '#0', `#(${L('eEnd')}+${P.BOOT}+${P.D}-${L('d2')})`);
  ctx.ins('bc', 'DAT', 'F', '#0', `#${TS_E}`);
  // The engine.
  const start = ctx.pc(), cptr = L('cptr'), ptr = L('ptr');
  ctx.ins('cptr', 'DAT', 'F', `#(${L('dbomb')}-${cptr})`, `#${TS_E}`);
  ctx.ins('ptr', 'SNE', 'I', `${P.FIRST - 1}`, `${P.FIRST - 1 + P.HOP}`);
  ctx.ins('', 'ADD', 'F', L('inc'), ptr);
  ctx.ins('sb', 'MOV', 'I', L('bomb'), `>${ptr}`);
  ctx.ins('sa', 'MOV', 'I', L('bomb'), `}${ptr}`);
  ctx.ins('', 'DJN', 'B', ptr, `#${P.TIME}`);
  ctx.ins('pump', 'SPL', 'B', '#0', '0');
  ctx.ins('cLoop', 'MOV', 'I', `*${cptr}`, `>${cptr}`);
  ctx.ins('cW2', 'MOV', 'I', `*${cptr}`, `>${cptr}`);
  ctx.ins('', 'JMP', 'B', L('cLoop'));
  ctx.ins('inc', 'DAT', 'F', `#${P.STEP - 1}`, `#${P.STEP - 1}`);
  ctx.ins('bomb', 'SPL', 'B', '#0', '#0');
  ctx.ins('dbomb', 'DAT', 'F', `#(${L('dbomb')}-${cptr})`, `#${TS_E}`);
  ctx.mark('eEnd');
  if (ctx.pc() - start !== TS_E) throw new Error('twin-storm: engine layout changed');
}

const tsEngines = (api) => [api.add(api.at('cptr'), api.P.BOOT), api.add(api.at('cptr'), api.P.BOOT + api.P.D)];
// The planted pair: two cells at the A pointer of engine 1's 4th equal compare
// with room around it. Before that the pointers move as they will alone: one
// cell a lap past the abandoned original (it differs), STEP otherwise.
function tsTarget(api) {
  const { P } = api, e1 = tsEngines(api)[0], near = (c) => { for (let j = -8; j <= 8; j++) if (api.inImage(api.add(c, j))) return true; return false; };
  let a = P.FIRST, b = P.FIRST + P.HOP, equal = 0;
  for (let i = 0; i < P.TIME; i++) {
    const ca = api.add(e1, a);
    if (api.inImage(ca) || api.inImage(api.add(e1, b))) { a++; b++; continue; }
    if (++equal >= 4 && !near(ca) && !near(api.add(e1, b))) return ca;
    a += P.STEP; b += P.STEP;
  }
  return api.add(e1, P.FIRST);
}

function watchTwinStorm(api) {
  const { vm, core, P } = api;
  const eng = tsEngines(api), off = (l) => api.rel(api.at(l), api.at('cptr'));
  const pcs = {};
  eng.forEach((e, k) => {
    for (const l of ['ptr', 'sb', 'sa', 'pump', 'cLoop', 'cW2']) pcs[api.add(e, off(l))] = [k, l];
  });
  const inEng = (c) => eng.findIndex((e) => api.rel(c, e) < TS_E);
  const planted = api.scenario === 'twin-storm: planted target';
  const target = planted ? tsTarget(api) : -1;
  const bombed = new Set();
  const launched = [null, null], clearing = [null, null], looks = [0, 0];
  let stray = 0;
  return {
    before(pc) {
      const k = inEng(pc);
      if (k >= 0 && launched[k] === null) {
        launched[k] = vm.cycle;
        for (let i = 0; i < TS_E; i++) if (!api.same(vm.peek(api.add(eng[k], i)), api.code('cptr', i))) throw new Error(`twin-storm: engine ${k + 1} started before it was copied`);
      }
      const hit = pcs[pc];
      // A cell the other engine's clear has already overwritten runs as what it now is.
      if (!hit || !sameOp(vm.peek(pc), api.code(hit[1]))) return null;
      const [e, l] = hit, base = eng[e], ptr = api.add(base, off('ptr')), cptr = base;
      if (l === 'ptr') {
        looks[e]++;
        const a = api.add(ptr, vm.peek(ptr).a), b = api.add(ptr, vm.peek(ptr).b);
        if (!api.same(vm.peek(a), vm.peek(b))) {
          const ours = (c) => bombed.has(c) || api.inImage(c) || api.inDead(c);
          if (!ours(a) && !ours(b)) stray++;
        }
        return null;
      }
      if (l === 'pump') { if (clearing[e] === null) clearing[e] = vm.cycle; return null; }
      if (l === 'sb' || l === 'sa') return { e, pc, scan: true, t: api.add(ptr, l === 'sb' ? vm.peek(ptr).b : vm.peek(ptr).a), bomb: api.code('bomb') };
      return { e, pc, t: api.add(cptr, vm.peek(cptr).b), bomb: vm.peek(api.add(cptr, vm.peek(cptr).a)), cptr };
    },
    after(tok) {
      if (!tok) return;
      const { e, t, bomb } = tok, k = inEng(t);
      if (tok.scan) {
        if (k >= 0) throw new Error(`twin-storm: engine ${e + 1}'s scan bombed engine ${k + 1}`);
        if (api.inSelf(t) && launched[e] === null) throw new Error('twin-storm bombed its launcher');
        bombed.add(t);
      } else {
        if (k === e && t !== tok.cptr) throw new Error(`twin-storm: engine ${e + 1}'s clear wrote over its own code`);
        if (k >= 0 && k !== e && launched[k] === null) throw new Error('twin-storm did not start both engines');
        if (k >= 0 && k !== e && clearing[k] === null) throw new Error(`twin-storm: engine ${e + 1}'s clear hit engine ${k + 1} while it was still scanning`);
        if (!api.same(bomb, api.code('dbomb'))) throw new Error('twin-storm cleared with something other than its DAT');
      }
      if (!api.same(vm.peek(t), bomb) || vm.writerPc[t] !== tok.pc) throw new Error('twin-storm dropped something other than its bomb');
    },
    final() {
      if (launched.includes(null)) throw new Error('twin-storm did not start both engines');
      if (planted && (!bombed.has(target) || !bombed.has(api.add(target, 1)))) throw new Error('twin-storm did not carpet the planted pair');
      if (!api.alone) return;
      if (looks.some((n) => n < P.TIME)) throw new Error('twin-storm: an engine scanned fewer than TIME laps');
      if (clearing.includes(null)) throw new Error('twin-storm: an engine never became a clear');
      if (stray) throw new Error('twin-storm found something in an empty core');
    },
  };
}

function twinMismatches(P, s) {
  const core = s.coreSize, room = s.maxLength, out = [];
  const win = tsWindows(P);
  if (win[1][1] - win[0][0] >= core) out.push('twin-storm: TIME * STEP + HOP is more than the core');
  // Engine 1 sees engine 2 at +D; engine 2 sees engine 1 at -D.
  for (const w of win) {
    if (meets(w, 0, TS_E, core)) { out.push('twin-storm: a scan window reaches its own engine'); break; }
    if (meets(w, P.D, TS_E, core) || meets(w, core - P.D, TS_E, core)) { out.push('twin-storm: a scan window reaches the other engine'); break; }
  }
  if (P.D < TS_E || P.D > core / 2) out.push('twin-storm: D must keep the engines apart and the second within half the core (the first clear reaches it first)');
  // The engines (BOOT and BOOT + D from the template) must miss the image, taken as room cells either side.
  if (meets([P.BOOT, P.BOOT + TS_E - 1], core - room, 2 * room, core) || meets([P.BOOT + P.D, P.BOOT + P.D + TS_E - 1], core - room, 2 * room, core)) out.push('twin-storm: BOOT puts an engine on the warrior itself');
  return out;
}

// ---------------------------------------------------------------------------
// scanner-mul
//
//   MUL.AB #MULT, ptr     p := p * MULT
//   JMZ.F  loop, <ptr     p := p - 1, look at ptr + p
// then the guard and bomb of `scanner`: a non-empty cell whose offset is
// outside the image gets one bomb. Two cycles a look, like `scanner`.
const primes = (n) => { const out = []; for (let p = 2; p * p <= n; p++) if (n % p === 0) { out.push(p); while (n % p === 0) n /= p; } if (n > 1) out.push(n); return out; };
const fullPeriod = (mult, core) => primes(core).every((p) => (mult - 1) % p === 0) && (core % 4 || (mult - 1) % 4 === 0);

function emitMul(ctx) {
  const { L, P, span } = ctx, ptr = L('ptr');
  ctx.ins('sLoop', 'MUL', 'AB', `#${P.MULT}`, ptr);
  ctx.ins('sLook', 'JMZ', 'F', L('sLoop'), `<${ptr}`);
  ctx.ins('sHit', 'SLT', 'AB', `#(${span}-${idxOf(ctx, 'ptr')}-1)`, ptr);   // past the image's end?
  ctx.ins('', 'JMP', 'B', L('sLoop'));
  ctx.ins('', 'SLT', 'AB', `#(CORESIZE-${idxOf(ctx, 'ptr')}-1)`, ptr);     // before its start?
  ctx.ins('', 'JMP', 'B', L('sBomb'));
  ctx.ins('', 'JMP', 'B', L('sLoop'));
  ctx.ins('sBomb', 'MOV', 'I', L('bomb'), `@${ptr}`);
  ctx.ins('', 'JMP', 'B', L('sLoop'));
  ctx.ins('ptr', 'DAT', 'F', '#0', `#${P.START}`);
  if (P.BOMB) ctx.ins('bomb', 'SPL', 'B', '#0', '#0');
  else ctx.ins('bomb', 'DAT', 'F', '#0', '#0');
}

// The k-th cell the scan looks at (k = 1 is the first).
function mulLooks(api, n) {
  const ptr = api.at('ptr'), out = [];
  let p = mod(api.code('ptr').b, api.core);
  for (let k = 0; k < n; k++) { p = mod(mod(p * api.P.MULT, api.core) - 1, api.core); out.push(mod(ptr + p, api.core)); }
  return out;
}
function mulTarget(api) {
  let found = 0;
  for (const c of mulLooks(api, 4000)) {
    let clear = true;
    for (let j = -8; j <= 8 && clear; j++) if (api.inImage(c + j)) clear = false;
    if (clear && ++found === 3) return c;
  }
  return -1;
}

function watchMul(api) {
  const { vm, core } = api, ptr = api.at('ptr');
  const planted = api.scenario === 'scanner-mul: planted target';
  const target = planted ? mulTarget(api) : -1;
  const seen = [], expect = mulLooks(api, Math.min(core, 4000));
  let bombs = 0, hit = false;
  return {
    before(pc) {
      if (pc === api.at('sLook')) return { look: true };
      if (pc === api.at('sBomb')) return { t: mod(ptr + vm.peek(ptr).b, core) };
      return null;
    },
    after(tok) {
      if (!tok) return;
      if (tok.look) { if (seen.length < expect.length) seen.push(mod(ptr + vm.peek(ptr).b, core)); return; }
      const { t } = tok;
      if (ownCell(api, t)) throw new Error('scanner-mul bombed its own warrior');
      if (!api.same(vm.peek(t), api.code('bomb'))) throw new Error('scanner-mul dropped something other than its bomb');
      bombs++;
      if (t === target) hit = true;
    },
    final() {
      if (planted && !hit) throw new Error('scanner-mul ignored the planted target');
      if (!api.alone) return;
      if (seen.length < 1000) throw new Error('scanner-mul looked at too few cells');
      if (bombs) throw new Error('scanner-mul bombed an empty core');
      // The mechanism: the looks follow p := MULT p - 1, none repeats, and they keep no fixed stride.
      seen.forEach((c, i) => { if (c !== expect[i]) throw new Error(`scanner-mul's look ${i + 1} is not MULT times the last, less one`); });
      if (new Set(seen).size !== seen.length) throw new Error('scanner-mul looked at a cell twice in one period');
      const strides = new Set(seen.slice(1, 50).map((c, i) => mod(c - seen[i], core)));
      if (strides.size < 10) throw new Error('scanner-mul scans with a near-fixed stride');
    },
  };
}

// ---------------------------------------------------------------------------

const blocks = {
  'blur-carpet': {
    ...BODY, processes: 8, grows: true, writes: 'core',
    purpose: 'Hill blur scanner: compares a pair of cells GAP apart on a (mod-10) STEP and drops one SPL a lap at a single carpet pointer, which every find moves to BACK cells before it, so the carpet grows from the newest find (never into the image); after SCANS laps the pointer becomes a SPL #0-pumped DAT clear from the carpet\'s front, reset past the image by its own bomb on each wrap.',
    params: { STEP: [1, 27719], GAP: [1, 64], BACK: [0, 64], SCANS: [1, 27000] },
    entry: 'sLoop', loop: 'sLoop',
    provides: { splBomb: 'bomb', datBomb: 'dbomb' },
    mutable: [['cptr', ['op', 'mod', 'aMode', 'a', 'bMode', 'b']], ['scan', ['a', 'b']], ['tmp', ['a']], ['cnt', ['b']]],
    mismatches: (P, s) => [
      ...(P.SCANS >= s.coreSize / 2 ? ['blur-carpet: SCANS laps of carpet could grow into the warrior (keep it under half the core)'] : []),
      ...(P.GAP >= P.STEP ? ['blur-carpet: GAP must be less than STEP, or the pairs overlap'] : []),
    ],
    state(ctx) { ctx.ins('cptr', 'DAT', 'F', `#(${ctx.L('dbomb')}-${ctx.L('cptr')})`, `#(${ctx.span}-${idxOf(ctx, 'cptr')})`); },
    emit: emitBlurCarpet,
    plant: (api) => [[carpetTarget(api), MARKER]],
    watch: watchBlurCarpet,
  },
  'twin-storm': {
    kind: 'body', exit: 'never', processes: 3, grows: true, writes: 'core', roams: true, moves: true, dialects: '94',
    purpose: 'Twin Storms: copies a small scan engine to two places D apart and starts both (the original stays as a decoy); each compares two cells HOP apart, bombs both pointers every lap and steps on by STEP only when they are equal (a SPL lattice, solid carpet over a find), for TIME laps in a window that misses both engines, then becomes a SPL #0-pumped DAT clear.',
    params: { FIRST: [16, 54000], HOP: [1, 27000], STEP: [2, 200], TIME: [1, 6000], D: [16, 27000], BOOT: [100, 54000] },
    entry: 'boot',
    provides: { splBomb: 'bomb', datBomb: 'dbomb' },
    mutable: [['src', ['b']], ['d1', ['b']], ['d2', ['b']], ['bc', ['b']]],
    mismatches: twinMismatches,
    emit: emitTwinStorm,
    running: (api) => { const eng = tsEngines(api); return api.vm.processes(0).some((q) => eng.some((e) => api.rel(q, e) < TS_E)); },
    plant: (api) => [[tsTarget(api), MARKER], [api.add(tsTarget(api), 1), MARKER]],
    watch: watchTwinStorm,
  },
  'scanner-mul': {
    ...BODY, processes: 1, writes: 'sparse',
    purpose: 'Multiplicative scanner (Russ Post): each lap multiplies the scan pointer by MULT and steps it back one, so it visits the core in a pseudo-random order (every cell once a period when MULT - 1 is a multiple of the core\'s prime factors and of 4); drops a bomb (BOMB 0 DAT, 1 SPL) on every non-empty cell outside its image.',
    params: { MULT: [2, 54000], START: [1, 54000], BOMB: [0, 1] },
    entry: 'sLoop', loop: 'sLoop',
    provides: (P) => (P.BOMB ? { splBomb: 'bomb' } : { datBomb: 'bomb' }),
    mutable: [['ptr', ['b']]],
    mismatches: (P, s) => (fullPeriod(P.MULT, s.coreSize) ? [] : [`scanner-mul: MULT - 1 must be a multiple of ${primes(s.coreSize).join(', ')}${s.coreSize % 4 ? '' : ' and 4'}, or the scan misses cells`]),
    emit: emitMul,
    plant: (api) => [[mulTarget(api), MARKER]],
    watch: watchMul,
  },
};
for (const [id, b] of Object.entries(blocks)) b.id = id;
// Defaults that work on the 8,000 and 55,440 cores. 70 is the hill blurs' own
// mod-10 step (gcd 10 with 8,000, 70 with 55,440). Twin-storm's windows keep
// both engines out of every scan (FIRST 1000, HOP 3000, 333 laps of 9), and
// BOOT 7400 puts the abandoned original between the engines on 8,000, outside
// both windows, so the scans don't waste laps carpeting it. 4621 = 4620 + 1,
// and 4620 holds every prime factor of both cores and 4.
blocks['blur-carpet'].defaults = { STEP: 70, GAP: 5, BACK: 2, SCANS: 800 };
blocks['twin-storm'].defaults = { FIRST: 1000, HOP: 3000, STEP: 9, TIME: 333, D: 913, BOOT: 7400 };
blocks['scanner-mul'].defaults = { MULT: 4621, START: 100, BOMB: 0 };

export default Object.values(blocks);
