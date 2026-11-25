// Blocks found missing while rebuilding the Koenigstuhl P-space hill's top 10
// (docs/hill-top10/pspace.md). 8,000 cells, 100 instructions, P-space.
//
//   sunset-paper-stone -- David Moore's paper/stone (Sunset, Just
//     experimenting 1.4, Cooperative Black Dimension): one nine-line fan boot
//     makes six lockstep processes that copy a never-stopping stone (a SPL #
//     feeder over a two-write loop) and a five-line replicator, then sends
//     twelve into the stone and six into the paper.
//
//   recon-scanner      -- Moore's Recon 2 (Sunset): a .8c two-pair scanner
//     that wipes each find with SPLs, counted by a timer; when the timer runs
//     out the wipe is turned into a SPL-pumped DAT clear by two decrements.
//
//   mini-blur          -- Moore's mini Blur (Fire and Ice, Liquid Paper,
//     Mantrap Arcade): one SPL a scan at a carpet pointer that every find moves
//     to just before it; the scan counter reaching zero starts a d-clear.
//
//   fi-paper           -- the paper of Fire and Ice and Liquid Paper: a
//     six-process launch that copies the body and runs it in both places, a
//     forward silk stage and a second stage that copies backward.
//
//   skew-dwarf, nomolos-paper            -- Mantrap Arcade's dwarf (also in
//     Recycled Bits) and paper.
//   carbonite-stone, twin-silk           -- Aggression is a switch's stone and paper.
//   incendiary-clear, mirage-scanner, sdd-clear, imp-silk -- Recycled Bits' arms.
//   vanquisher         -- Return of Vanquisher PsP's four-process incendiary bomber.
//
// The P^3 selectors of these warriors are switch-table ROWS 1 (switch-table.js).
//
// All Redcode here is written from scratch from the mechanisms the originals
// were read for; nothing is copied from them. Ring, ICWS'94 only.

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const mod = (x, n) => ((x % n) + n) % n;
const near = (d, core) => Math.min(mod(d, core), core - mod(d, core));
const third = (core) => Math.round(core / 3);
const EVERY = ['op', 'mod', 'aMode', 'a', 'bMode', 'b'];

// How many cells of the core hold an instruction equal to `x` (fields mod core).
function countLike(api, x) {
  let n = 0;
  for (let c = 0; c < api.core; c++) if (api.same(api.vm.peek(c), x)) n++;
  return n;
}
// A process runs on a cell holding one of these instructions (a moving body's copies).
const onAny = (api, codes) => api.vm.processes(0).some((q) => { const x = api.vm.peek(q); return codes.some((y) => api.same(x, y)); });

// ---------------------------------------------------------------------------
// sunset-paper-stone (23 cells)
//
//   spStone SPL   #2S, {2S        the stone: entrants split here for ever (SPL #: a
//           MOV   spAmmo, *2      process stays), the loop below: a DAT at X,
//           ADD.F spStone, 1      both pointers on 2S,
//           MOV   OFF, OFF+S      and the cell at the next X copied S further on
//   spSrc   JMP   -3, spStone     loop; its B-field is the boot's source pointer
//           DAT   0, 0
//   spAmmo  DAT   }1, >1          the bomb: a process that runs it moves the copy line on
//   spPap   SPL   PSTEP, {spThis  the paper: start the copy's processes,
//           MOV   }spThis, }spPap copy one cell,
//           MOV   spDat, >PBOMB   drop an anti-imp DAT,
//   spThis  MOV   spPap+6, }spPap the copy's next source,
//           JMZ.F spPap, *spThis  and go on while the cell after the copy is empty
//   spDat   DAT   <third, <2third
//   spEnd   DAT   0, 0            the end of the paper's source
//   spBoot  MOV   >spSrc, >spDst  the first stone cell
//           SPL   2 / SPL 1 / SPL 1   six lockstep processes (spSrcP's B: the paper source)
//           MOV   >spSrc, >spDst  six more stone cells
//           MOV   <spSrcP, {spVec six paper cells, backward
//   spDst   SPL   @spVec, SHOP    every process sends one into the stone ...
//           SPL   @spVec, >spDst  ... and a second
//   spVec   DJN   PHOP, #SHOP     and enters the paper (the djn only counts)
//
// SHOP and PHOP count from spBoot. The stone writes two lattices of step 2S (gcd(2S,
// core) classes): the DATs at 3+OFF and the copies at 3+OFF+S from spStone. Its own
// bomb on the ADD (or an enemy's) turns the loop into a moving clear: the DAT's }1 >1
// move the copy line's pointers one cell for every process that dies there.
const SP = { stone: 0, mov: 1, add: 2, copy: 3, jmp: 4, ammo: 6, pap: 7, this: 10, dat: 12, end: 13, boot: 14, size: 23 };
const sunsetPaperStone = {
  // The stone bombs the whole core, its own boot image and any partner included: writes 'core'.
  id: 'sunset-paper-stone', kind: 'body', exit: 'never', writes: 'core', roams: true, dialects: '94',
  processes: 19, grows: true, entryFirst: false,
  purpose: 'David Moore\'s paper/stone (Sunset, Just experimenting 1.4, Cooperative Black Dimension): a nine-line fan boot makes six lockstep processes that copy a never-stopping stone SHOP away and a five-line replicator PHOP away, then sends twelve into the stone and six into the paper. The stone (SPL # feeder, a DAT and a copied cell a pass, step 2*STEP) turns into a moving clear when a bomb lands on its ADD; the paper starts six processes in each copy PSTEP away and drops an anti-imp DAT PBOMB on per process, until the cell after its copy is hit.',
  params: { SHOP: [200, 54000], PHOP: [200, 54000], STEP: [1, 27000], OFF: [1, 54000], PSTEP: [100, 54000], PBOMB: [100, 54000] },
  // Sunset's numbers; Cooperative Black Dimension: SHOP 4275, PHOP 3524, PSTEP 431, PBOMB 4692.
  defaults: { SHOP: 5300, PHOP: 5523, STEP: 2862, OFF: 4655, PSTEP: 4200, PBOMB: 5200 },
  entry: 'spBoot',
  mutable: [['spSrc', ['b']], ['spSrcP', ['b']], ['spDst', ['b']], ['spVec', ['a', 'b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [], len = Math.min(settings.maxLength, 200);
    if (settings.maxProcesses < 19) out.push('sunset-paper-stone: needs 19 processes');
    for (const [k, v] of [['SHOP', P.SHOP], ['PHOP', P.PHOP]]) if (near(v, core) < len + SP.size) out.push(`sunset-paper-stone: ${k} ${v} puts a copy on the warrior`);
    if (near(P.SHOP - P.PHOP, core) < 8) out.push('sunset-paper-stone: the stone and the paper copies overlap');
    const g = gcd(2 * P.STEP, core);
    if (core / g < 200) out.push(`sunset-paper-stone: STEP ${P.STEP} bombs only ${core / g} cells`);
    // The DAT lattice must miss the stone's two MOVs and its JMP, the copy lattice its two MOVs.
    const bomb = mod(3 + P.OFF, g), copy = mod(3 + P.OFF + P.STEP, g);
    if ([SP.mov, SP.copy, SP.jmp].some((l) => mod(l, g) === bomb)) out.push(`sunset-paper-stone: the stone's DATs (class ${bomb} of ${g}) land on its own loop`);
    if ([SP.mov, SP.copy].some((l) => mod(l, g) === copy)) out.push(`sunset-paper-stone: the stone's copies (class ${copy} of ${g}) land on its own MOVs`);
    if (near(P.PSTEP, core) < 16) out.push('sunset-paper-stone: PSTEP lands the paper on itself');
    if (near(P.PBOMB, core) < 16) out.push('sunset-paper-stone: PBOMB bombs the paper itself');
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, S2 = mod(2 * P.STEP, core), t = third(core);
    ctx.ins('spStone', 'SPL', 'B', `#${S2}`, `{${S2}`);
    ctx.ins('spMov', 'MOV', 'I', L('spAmmo'), '*2');
    ctx.ins('spAdd', 'ADD', 'F', L('spStone'), '1');
    ctx.ins('spCopy', 'MOV', 'I', `$${mod(P.OFF, core)}`, `$${mod(P.OFF + P.STEP, core)}`);
    ctx.ins('spSrc', 'JMP', 'B', L('spMov'), L('spStone'));
    ctx.ins('', 'DAT', 'F', '$0', '$0');
    ctx.ins('spAmmo', 'DAT', 'F', '}1', '>1');
    ctx.ins('spPap', 'SPL', 'B', `$${mod(P.PSTEP, core)}`, `{${L('spThis')}`);
    ctx.ins('', 'MOV', 'I', `}${L('spThis')}`, `}${L('spPap')}`);
    ctx.ins('', 'MOV', 'I', L('spDat'), `>${mod(P.PBOMB, core)}`);
    ctx.ins('spThis', 'MOV', 'I', `${L('spPap')}+6`, `}${L('spPap')}`);
    ctx.ins('', 'JMZ', 'F', L('spPap'), `*${L('spThis')}`);
    ctx.ins('spDat', 'DAT', 'F', `<${t}`, `<${mod(2 * t, core)}`);
    ctx.ins('spEnd', 'DAT', 'F', '$0', '$0');
    ctx.ins('spBoot', 'MOV', 'I', `>${L('spSrc')}`, `>${L('spDst')}`);
    ctx.ins('', 'SPL', 'B', '$2', '$0');
    ctx.ins('', 'SPL', 'B', '$1', '$0');
    ctx.ins('spSrcP', 'SPL', 'B', '$1', L('spEnd'));
    ctx.ins('', 'MOV', 'I', `>${L('spSrc')}`, `>${L('spDst')}`);
    ctx.ins('', 'MOV', 'I', `<${L('spSrcP')}`, `{${L('spVec')}`);
    ctx.ins('spDst', 'SPL', 'B', `@${L('spVec')}`, `${L('spBoot')}+${P.SHOP}`);
    ctx.ins('', 'SPL', 'B', `@${L('spVec')}`, `>${L('spDst')}`);
    ctx.ins('spVec', 'DJN', 'B', `${L('spBoot')}+${P.PHOP + 6}`, `#${L('spBoot')}+${P.SHOP}`);
  },
  running: (api) => onAny(api, [SP.mov, SP.add, SP.pap + 1, SP.pap + 2, SP.this + 1].map((k) => api.code('spStone', k))),
  watch(api) {
    const { vm, P, core } = api, boot = api.at('spBoot');
    const stone = api.add(boot, P.SHOP), paper = api.add(boot, P.PHOP);
    const movAt = api.add(stone, SP.mov), copyAt = api.add(stone, SP.copy);
    const loopCells = [SP.mov, SP.copy, SP.jmp].map((k) => api.add(stone, k));
    let inStone = 0, inPaper = 0, counted = false, bombs = 0;
    const papHead = api.code('spStone', SP.pap + 1);
    return {
      before(pc) {
        if (!api.entered()) return null;
        if (!counted) {
          if (pc === stone) inStone++;
          if (pc === paper) inPaper++;
          if (pc === movAt && inPaper >= 6) {
            counted = true;
            if (inStone < 12) throw new Error(`sunset-paper-stone: only ${inStone} processes entered the stone (12 expected)`);
          }
        }
        if (pc === movAt && api.same(vm.peek(pc), api.code('spMov')) && bombs < 400) return { t: api.add(copyAt, vm.peek(copyAt).a) };
        return null;
      },
      after(tok) {
        if (!tok) return;
        bombs++;
        if (loopCells.includes(tok.t)) throw new Error('sunset-paper-stone: the stone bombed its own loop');
      },
      final() {
        if (!api.entered() || !api.alone) return;
        if (inPaper < 6) throw new Error(`sunset-paper-stone: only ${inPaper} processes entered the paper (6 expected)`);
        if (bombs < 100) throw new Error(`sunset-paper-stone: the stone bombed too little (${bombs})`);
        if (countLike(api, papHead) < 4) throw new Error('sunset-paper-stone: the paper made too few copies');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// recon-scanner (17 cells): Recon 2
//
//   rcPtr   DAT   0, 0            the wipe pointer (two cells before the decoy)
//           DAT   0, 0
//   rcDecoy DAT   19, 19          also the clear's bomb
//   rcInc   SPL   #-STEP, #-STEP  the step, the wipe's bomb and the clear's pump
//   rcWipe  MOV   rcInc, >rcPtr   SPLs at the pointer ...
//   rcW2    MOV   *rcWipe, >rcPtr ... two a pass (the A-field of rcWipe names the bomb)
//           DJN.A rcWipe, rcLen   WIPE passes
//   rcTop   SUB   rcInc, @rcS2    the pair on by STEP
//   rcScan  SNE   B0-GAP? ...     a pair GAP apart
//           SUB   rcInc, rcScan
//   rcS2    SEQ   *rcScan, @rcScan the next pair (after a difference the same one again)
//           SLT.A #OWN, rcScan    a difference among our own cells: scan on
//   rcTime  DJN   rcTop, #TIME    the timer
//   rcLen   SUB.BA #0, #-WIPE     reload the wipe count (rcLen.A += WIPE)
//           MOV.AB @rcS2, @rcWipe the wipe pointer: eight cells before the find
//   rcT2    JMN   *rcW2, rcTime   timer still running: wipe
//   rcEnd   DJN.A <rcLen+1, {rcT2 time up: rcWipe's A now names the decoy (a DAT),
//                                 and the jump lands on rcInc: a SPL-pumped DAT clear
const RC = { ptr: 0, decoy: 2, inc: 3, wipe: 4, w2: 5, top: 7, scan: 8, s2: 10, time: 12, len: 13, size: 17 };
const reconScanner = {
  id: 'recon-scanner', kind: 'body', exit: 'never', writes: 'core', roams: false, dialects: '94',
  processes: 1, grows: true, entryFirst: false,
  purpose: 'David Moore\'s Recon 2 (Sunset, Just experimenting 1.4): a one-process .8c scanner comparing two pairs of cells GAP apart every five instructions, STEP at a time; a difference outside its own cells is wiped with 2*WIPE SPLs upward from eight cells before it. TIME passes of the scan later, two decrements turn the wipe into a SPL-pumped DAT clear (its bomb the DAT 19, 19 at its head).',
  params: { STEP: [1, 54000], GAP: [1, 32], WIPE: [2, 16], TIME: [100, 54000] },
  // Sunset's numbers: STEP 6557 beats 3, 7, 9 and 11-point imps; a pair 6 apart, 14 SPLs, 4,800 passes.
  defaults: { STEP: 6557, GAP: 6, WIPE: 7, TIME: 4800 },
  entry: 'rcTop', loop: 'rcTop',
  provides: { splBomb: 'rcInc', datBomb: 'rcDecoy' },
  mutable: [['rcPtr', ['b']], ['rcWipe', ['a']], ['rcScan', ['a', 'b']], ['rcTime', ['b']], ['rcLen', ['a']], ['rcT2', ['a']], ['rcEnd', ['a']], ['rcTweak', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (core / gcd(P.STEP, core) < 500) out.push(`recon-scanner: STEP ${P.STEP} looks at only ${core / gcd(P.STEP, core)} positions`);
    if (2 * P.WIPE < 9 || P.GAP > 8) out.push(`recon-scanner: ${2 * P.WIPE} SPLs from eight cells before a find cannot cover a pair ${P.GAP} apart`);
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, S = mod(-P.STEP, core);   // a SUB of -STEP: the pointers move STEP
    ctx.ins('rcPtr', 'DAT', 'F', '$0', '$0');
    ctx.ins('', 'DAT', 'F', '$0', '$0');
    ctx.ins('rcDecoy', 'DAT', 'F', '$19', '$19');
    ctx.ins('rcInc', 'SPL', 'B', `#${S}`, `#${S}`);
    ctx.ins('rcWipe', 'MOV', 'I', L('rcInc'), `>${L('rcPtr')}`);
    ctx.ins('rcW2', 'MOV', 'I', `*${L('rcWipe')}`, `>${L('rcPtr')}`);
    ctx.ins('', 'DJN', 'A', L('rcWipe'), L('rcLen'));
    ctx.ins('rcTop', 'SUB', 'F', L('rcInc'), `@${L('rcS2')}`);
    // The A pointer starts at STEP - 1 and the B pointer GAP below it; the first look comes after a SUB.
    ctx.ins('rcScan', 'SNE', 'I', `$${mod(P.STEP - 1, core)}`, `$${mod(P.STEP - 1 - P.GAP, core)}`);
    ctx.ins('', 'SUB', 'F', L('rcInc'), L('rcScan'));
    ctx.ins('rcS2', 'SEQ', 'I', `*${L('rcScan')}`, `@${L('rcScan')}`);
    ctx.ins('', 'SLT', 'A', '#20', L('rcScan'));
    ctx.ins('rcTime', 'DJN', 'B', L('rcTop'), `#${P.TIME}`);
    ctx.ins('rcLen', 'SUB', 'BA', '#0', `#${mod(-P.WIPE, core)}`);
    ctx.ins('rcTweak', 'MOV', 'AB', `@${L('rcS2')}`, `@${L('rcWipe')}`);
    ctx.ins('rcT2', 'JMN', 'B', `*${L('rcW2')}`, L('rcTime'));
    ctx.ins('rcEnd', 'DJN', 'A', `<${L('rcTweak')}`, `{${L('rcT2')}`);
  },
  plant: (api) => [[api.add(api.at('rcScan'), mod(api.P.STEP * 13 - 1, api.core)), { op: 'MOV', mod: 'I', aMode: '$', a: 0, bMode: '$', b: 1 }]],
  running(api) { const top = api.at('rcPtr'); return api.vm.processes(0).some((q) => api.rel(q, top) < RC.size); },
  watch(api) {
    const { vm, core, P } = api, top = api.at('rcPtr'), wipe = api.at('rcWipe'), w2 = api.at('rcW2'), ptr = top, inc = api.at('rcInc');
    const planted = api.scenario === 'recon-scanner: planted target';
    const target = planted ? api.add(api.at('rcScan'), mod(P.STEP * 13 - 1, core)) : null;
    let spls = 0, dats = 0, hitTarget = false;
    return {
      before(pc) {
        if (!api.entered()) return null;
        if ((pc === wipe || pc === w2) && vm.peek(pc).op === 'MOV') return { t: api.add(ptr, vm.peek(ptr).b) };
        return null;
      },
      after(tok) {
        if (!tok) return;
        const x = vm.peek(tok.t);
        if (api.rel(tok.t, top) < RC.size && tok.t !== ptr) throw new Error('recon-scanner wiped its own code');
        if (x.op === 'SPL') spls++; else if (x.op === 'DAT') dats++;
        if (target !== null && api.rel(target, tok.t) < 2 * P.WIPE) hitTarget = true;
      },
      final() {
        if (!api.entered()) return;
        if (planted && !hitTarget) throw new Error('recon-scanner did not wipe its planted target');
        if (!api.alone) return;
        if (vm.cycle > 5 * P.TIME + 2000 && dats < 100) throw new Error(`recon-scanner never cleared (${dats} DATs after its timer)`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// mini-blur (12 cells)
//
//   mbPtr  DAT   0, 0            the clear's pointer (three cells before mbTop)
//          DAT   0, 0 / DAT 0, 0
//   mbTop  MOV.B 2, #START       the carpet pointer; on a find, set to two cells before it
//          MOV   mbSpl, >mbTop   one SPL a scan at the carpet pointer
//   mbAdd  ADD   #STEP, #-STEP*TIME  the scan pointer (it reaches 0 after TIME looks)
//          JMZ.F mbTop+1, @mbAdd an empty cell: scan on
//          JMN   mbTop, *mbTop   a find (mbTop's A names mbAdd): move the carpet; a zero
//                                scan pointer (it found mbAdd itself): fall into the clear
//   mbSpl  SPL   0, 0            the carpet bomb and the clear's pump
//          MOV   2, >mbPtr       a d-clear forward from mbPtr
//          DJN.F -1, >mbPtr
//          DAT   0, mbSpl-mbPtr+... its B resets mbPtr past the code when it comes round
const MB = { ptr: 0, top: 3, add: 5, spl: 8, size: 12 };
const miniBlur = {
  id: 'mini-blur', kind: 'body', exit: 'never', writes: 'core', roams: false, dialects: '94',
  processes: 1, grows: true, entryFirst: false,
  purpose: 'David Moore\'s mini Blur (Fire and Ice, Liquid Paper, Mantrap Arcade): one process scans a cell every STEP and lays one SPL a scan at a carpet pointer, which every find moves to two cells before it, so the carpet always grows from the newest find; when the scan counter reaches zero (TIME looks) it finds itself and falls into a SPL-fed d-clear. START aims the carpet before the first find.',
  params: { STEP: [1, 54000], TIME: [100, 54000], START: [16, 54000] },
  // Fire and Ice: step 2891, 2,210 SPLs, the carpet first 2,951 cells on; Liquid Paper: 2,000.
  defaults: { STEP: 2891, TIME: 2210, START: 2951 },
  entry: 'mbJmz', loop: 'mbTop',
  provides: { splBomb: 'mbSpl' },
  mutable: [['mbPtr', ['b']], ['mbTop', ['b']], ['mbAdd', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    // The scan looks at mbAdd - STEP*j for j = TIME down to 1: none of those may be a cell of
    // the block with a non-zero field (JMZ.F reads the blanks and the SPL 0, 0 as empty).
    const seen = new Set([3, 4, 5, 6, 7, 9, 10, 11].map((i) => mod(i - MB.add, core)));
    for (let j = 1; j <= P.TIME; j++) {
      if (seen.has(mod(-P.STEP * j, core))) { out.push(`mini-blur: look ${P.TIME - j + 1} of ${P.TIME} lands on its own code`); break; }
    }
    if (near(P.START, core) < MB.size + 4) out.push('mini-blur: START aims the carpet at itself');
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx;
    ctx.ins('mbPtr', 'DAT', 'F', '$0', '$0');
    ctx.ins('', 'DAT', 'F', '$0', '$0');
    ctx.ins('', 'DAT', 'F', '$0', '$0');
    ctx.ins('mbTop', 'MOV', 'B', '$2', `#${mod(P.START, core)}`);
    ctx.ins('mbLay', 'MOV', 'I', L('mbSpl'), `>${L('mbTop')}`);
    ctx.ins('mbAdd', 'ADD', 'AB', `#${mod(P.STEP, core)}`, `#${mod(-P.STEP * P.TIME, core)}`);
    ctx.ins('mbJmz', 'JMZ', 'F', L('mbLay'), `@${L('mbAdd')}`);
    ctx.ins('', 'JMN', 'B', L('mbTop'), `*${L('mbTop')}`);
    ctx.ins('mbSpl', 'SPL', 'B', '$0', '$0');
    ctx.ins('mbClr', 'MOV', 'I', '$2', `>${L('mbPtr')}`);
    ctx.ins('', 'DJN', 'F', '$-1', `>${L('mbPtr')}`);
    ctx.ins('mbBomb', 'DAT', 'F', '$0', `$${MB.size + 1}`);
  },
  plant: (api) => [[api.add(api.at('mbAdd'), mod(-api.P.STEP * (api.P.TIME - 40), api.core)), { op: 'MOV', mod: 'I', aMode: '$', a: 0, bMode: '$', b: 1 }]],
  running(api) { const top = api.at('mbPtr'); return api.vm.processes(0).some((q) => api.rel(q, top) < MB.size); },
  watch(api) {
    const { vm, core, P } = api, top = api.at('mbPtr'), lay = api.at('mbLay'), carpet = api.at('mbTop'), clr = api.at('mbClr');
    const planted = api.scenario === 'mini-blur: planted target';
    const target = planted ? api.add(api.at('mbAdd'), mod(-P.STEP * (P.TIME - 40), core)) : null;
    let near2 = false, clearAt = null, laid = 0;
    return {
      before(pc) {
        if (!api.entered()) return null;
        if (pc === clr && clearAt === null) clearAt = vm.cycle;
        if (pc === lay && api.same(vm.peek(pc), api.code('mbLay'))) return { t: api.add(carpet, vm.peek(carpet).b) };
        return null;
      },
      after(tok) {
        if (!tok) return;
        laid++;
        if (api.rel(tok.t, top) < MB.size) throw new Error('mini-blur carpeted its own code');
        if (target !== null && api.rel(tok.t, target) < 8) near2 = true;
      },
      final() {
        if (!api.entered()) return;
        if (planted && !near2) throw new Error('mini-blur never carpeted its planted target');
        if (!api.alone) return;
        if (laid < P.TIME / 2) throw new Error(`mini-blur laid too few SPLs (${laid})`);
        if (clearAt === null) throw new Error('mini-blur never reached its clear');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// fi-paper (11 cells)
//
//   fpGo   SPL   1, >-400        two processes
//          MOV.I 1, #0           the first turns this cell into the next one (a third SPL)
//          SPL   1, {-300        six processes
//          MOV   <fpBoot, {fpBoot  each copies one body cell, backward
//   fpBoot SPL   BOOT, 6         six into the copy BOOT away; the six go on into the body here
//   fpBody SPL   @0, <STEP1      silk: a process STEP1 on (the B-field counts down), ...
//          MOV   }fpBody, >fpBody ... copy one cell there,
//          MOV   fpEnd, >fpBody  drop the end marker after it,
//          MOV   {fpBody, {fpJmz copy one cell backward to the second stage ...
//   fpJmz  JMZ.A STEP2, *0       ... and jump there once its A-field reads zero
//   fpEnd  DAT   1, 1
const fiPaper = {
  id: 'fi-paper', kind: 'body', exit: 'never', writes: 'sparse', roams: true, dialects: '94',
  processes: 12, grows: true,
  purpose: 'The paper of Moore\'s Fire and Ice (and Liquid Paper): a launch makes six processes that copy the six-cell body BOOT away and then run it there and in place (twelve processes); each copy is a silk stage STEP1 on with an end marker after it, and a second stage that copies the body backward to STEP2 and jumps there.',
  params: { BOOT: [100, 54000], STEP1: [100, 54000], STEP2: [100, 54000] },
  defaults: { BOOT: 2319, STEP1: 4195, STEP2: 6234 },
  entry: 'fpGo',
  mutable: [['fpGo', EVERY], ['fpMk', EVERY], ['fpBoot', ['a', 'b']], ['fpBody', ['a', 'b']], ['fpJmz', ['a']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (near(P.BOOT - 6, core) < Math.min(settings.maxLength, 200) + 12) out.push(`fi-paper: BOOT ${P.BOOT} puts the copy on the warrior`);
    for (const [k, v] of [['STEP1', P.STEP1], ['STEP2', P.STEP2]]) if (near(v, core) < 16) out.push(`fi-paper: ${k} lands a copy on itself`);
    if (settings.maxProcesses < 12) out.push('fi-paper: needs 12 processes');
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx;
    ctx.ins('fpGo', 'SPL', 'B', '$1', `>${mod(-400, core)}`);
    ctx.ins('fpMk', 'MOV', 'I', '$1', '#0');
    ctx.ins('', 'SPL', 'B', '$1', `{${mod(-300, core)}`);
    ctx.ins('', 'MOV', 'I', `<${L('fpBoot')}`, `{${L('fpBoot')}`);
    ctx.ins('fpBoot', 'SPL', 'B', `$${mod(P.BOOT, core)}`, '$7');
    ctx.ins('fpBody', 'SPL', 'B', '@0', `<${mod(P.STEP1, core)}`);
    ctx.ins('', 'MOV', 'I', '}-1', '>-1');
    ctx.ins('', 'MOV', 'I', '$3', '>-2');
    ctx.ins('', 'MOV', 'I', '{-3', '{1');
    ctx.ins('fpJmz', 'JMZ', 'A', `$${mod(P.STEP2, core)}`, '*0');
    ctx.ins('fpEnd', 'DAT', 'F', '$1', '$1');
  },
  running(api) { return onAny(api, [1, 2, 3].map((k) => api.code('fpBody', k))); },
  watch(api) {
    const head = api.code('fpBody', 1);
    let started = false;
    return {
      before(pc) { if (pc === api.at('fpBody')) started = true; return null; },
      final() {
        if (!api.entered() || !api.alone) return;
        if (!started) throw new Error('fi-paper never reached its body');
        if (countLike(api, head) < 6) throw new Error('fi-paper made too few copies');
      },
    };
  },
};

// A watch for bodies that write through one MOV's B-pointer: `lines` are [label, how the target
// is found from the line]; `own` the offsets (from `base`) no write may touch before `until` writes.
function writesWatch(api, { name, lines, base, own, until = Infinity, least = 0, after }) {
  let n = 0;
  return {
    before(pc) {
      if (!api.entered()) return null;
      for (const [label, target] of lines) {
        const at = api.at(label);
        if (pc === at && api.vm.peek(at).op === api.code(label).op) return { t: target(at) };
      }
      return null;
    },
    after(tok) {
      if (!tok) return;
      n++;
      if (n < until && own.some((k) => api.add(api.at(base), k) === tok.t)) throw new Error(`${name} bombed its own code (write ${n})`);
    },
    final() {
      if (!api.entered()) return;
      after?.(n);
      if (api.alone && n < least) throw new Error(`${name} bombed too little (${n})`);
    },
  };
}

// ---------------------------------------------------------------------------
// skew-dwarf (9 cells): the dwarf of Patel's Virus (Mantrap Arcade) and Recycled Bits
//
//   sdSpl  SPL   #0, <GATE+2      a feeder; its B decrements one cell for ever (a gate)
//   sdLoop MOV   sdBomb, {START   P = sdLoop + B: its A-field goes down one and the bomb
//                                 lands where it then points (P - 1 on a blank cell) ...
//          MOV   sdBomb, @sdLoop  ... and at P itself
//          SUB   #STEP, sdLoop    P moves STEP down
//          DJN.F sdLoop, <GATE-2  a decrement stream
//          DAT 0,0 / DAT 0,0 / DAT 0,0
//   sdBomb DAT   <GATE+1, >1
//
// START = STEP * TIME + 1: after TIME passes P is sdLoop + 1 and the bombs land on the
// second MOV and on sdLoop: the loop stops, and what stays is the feeder over a DAT (a
// decrement gate that breaks imps and keeps the warrior alive).
const SD = { spl: 0, loop: 1, mov2: 2, sub: 3, djn: 4, bomb: 8, size: 9 };
const skewDwarf = {
  id: 'skew-dwarf', kind: 'body', exit: 'never', writes: 'sparse', roams: false, dialects: '94',
  processes: 2, grows: true,
  purpose: 'The dwarf of Patel\'s Virus (Mantrap Arcade, Recycled Bits): a SPL #0 feeder over a loop that bombs P and the cell P\'s A-field names (one below P on a blank cell, a skewed pair), moves P STEP down and runs a decrement stream; after TIME passes the bombs land on its own loop and what is left is the feeder over a DAT, a decrement gate GATE cells away.',
  params: { STEP: [1, 27000], TIME: [50, 54000], GATE: [16, 54000] },
  defaults: { STEP: 81, TIME: 1677, GATE: 5277 },
  entry: 'sdSpl', loop: 'sdLoop',
  provides: { datBomb: 'sdBomb' },
  mutable: [['sdLoop', ['a', 'b']], ['sdSub', ['b']], ['sdDjn', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    // P before pass k (k = 0 .. TIME-1) is sdLoop + 1 + STEP*(TIME - k): it must miss the block.
    for (let k = 0; k < P.TIME; k++) {
      const p = mod(1 + P.STEP * (P.TIME - k), core);
      // P and P - 1 are bombed; the live cells are sdSpl to sdDjn (-1 to 3 from sdLoop).
      if (mod(p + 1, core) <= 5) { out.push(`skew-dwarf: pass ${k + 1} bombs its own code before its time-up`); break; }
    }
    if (near(P.GATE, core) < 16) out.push('skew-dwarf: the gate lands on the dwarf');
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx;
    ctx.ins('sdSpl', 'SPL', 'B', '#0', `<${mod(P.GATE + 2, core)}`);
    ctx.ins('sdLoop', 'MOV', 'I', L('sdBomb'), `{${mod(P.STEP * P.TIME + 1, core)}`);
    ctx.ins('sdMov2', 'MOV', 'I', L('sdBomb'), `@${L('sdLoop')}`);
    ctx.ins('sdSub', 'SUB', 'AB', `#${P.STEP}`, L('sdLoop'));
    ctx.ins('sdDjn', 'DJN', 'F', L('sdLoop'), `<${mod(P.GATE - 2, core)}`);
    for (let i = 0; i < 3; i++) ctx.ins('', 'DAT', 'F', '$0', '$0');
    ctx.ins('sdBomb', 'DAT', 'F', `<${mod(P.GATE + 1, core)}`, '>1');
  },
  running(api) { const top = api.at('sdSpl'); return api.vm.processes(0).some((q) => api.rel(q, top) < SD.size); },
  watch(api) {
    const { vm } = api;
    return writesWatch(api, {
      name: 'skew-dwarf', base: 'sdSpl', own: [SD.spl, SD.sub, SD.djn], until: 2 * api.P.TIME - 4, least: 500,
      lines: [['sdMov2', (at) => api.add(at, vm.peek(api.add(at, -1)).b - 1)]],
    });
  },
};

// ---------------------------------------------------------------------------
// carbonite-stone (6 cells): Stealth Carbonite (Aggression is a switch)
//
//   cbGo   MOV   cbBomb, cbMov+STEP  plant the bomb STEP past the MOV
//   cbSpl  SPL   #0, 0               a feeder
//   cbMov  MOV   STEP, 1-TIME*STEP   copy the planted bomb to the pointer ...
//          ADD.AB {0, }0             ... which moves STEP (the MOV's own A-field is the step)
//          DJN.F cbMov, <STREAM      a decrement stream
//   cbBomb DAT   >-1, >1
//
// After TIME passes the bomb lands on the ADD. A process that runs it moves the MOV's
// pointer and the DJN's stream on by one before it dies, so the stone becomes a clear
// that advances a cell for every process the feeder sends into it.
const CB = { go: 0, spl: 1, mov: 2, add: 3, djn: 4, bomb: 5, size: 6 };
const carboniteStone = {
  id: 'carbonite-stone', kind: 'body', exit: 'never', writes: 'core', roams: false, dialects: '94',
  processes: 2, grows: true,
  purpose: 'Stealth Carbonite (Aggression is a switch): plants a DAT >-1, >1 STEP past its MOV, then a SPL #0 feeder runs a loop that copies that bomb to a pointer moving STEP a pass (an ADD.AB {0, }0 adds the MOV\'s own A-field to its B-field) beside a decrement stream; after TIME passes the bomb lands on the ADD and every process that dies there moves the pointer one cell on: a core clear.',
  params: { STEP: [3, 27000], TIME: [100, 54000], STREAM: [100, 54000] },
  defaults: { STEP: 197, TIME: 3499, STREAM: 3501 },
  entry: 'cbGo', loop: 'cbMov',
  provides: { datBomb: 'cbBomb' },
  mutable: [['cbMov', ['b']], ['cbAdd', ['a']], ['cbDjn', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    // Write k lands at cbMov + 1 + STEP*(k - TIME): the first one on the stone must be the ADD (k = TIME).
    const live = new Set([-1, 0, 2].map((o) => mod(o, core)));
    for (let k = 0; k < P.TIME; k++) if (live.has(mod(1 + P.STEP * (k - P.TIME), core))) { out.push(`carbonite-stone: pass ${k + 1} bombs its own loop before its time-up`); break; }
    if (near(P.STEP, core) < CB.size) out.push('carbonite-stone: STEP plants the bomb on the stone');
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx;
    ctx.ins('cbGo', 'MOV', 'I', L('cbBomb'), `${L('cbMov')}+${P.STEP}`);
    ctx.ins('cbSpl', 'SPL', 'B', '#0', '$0');
    ctx.ins('cbMov', 'MOV', 'I', `$${P.STEP}`, `$${mod(1 - P.TIME * P.STEP, core)}`);
    ctx.ins('cbAdd', 'ADD', 'AB', '{0', '}0');
    ctx.ins('cbDjn', 'DJN', 'F', L('cbMov'), `<${mod(-P.STREAM, core)}`);
    ctx.ins('cbBomb', 'DAT', 'F', '>-1', '>1');
  },
  running(api) { const top = api.at('cbGo'); return api.vm.processes(0).some((q) => api.rel(q, top) < CB.size); },
  watch(api) {
    const { vm } = api;
    return writesWatch(api, {
      name: 'carbonite-stone', base: 'cbGo', own: [CB.spl, CB.mov, CB.djn], until: api.P.TIME, least: 1000,
      lines: [['cbMov', (at) => api.add(at, vm.peek(at).b)]],
    });
  },
};

// ---------------------------------------------------------------------------
// twin-silk (16 cells): the paper of Aggression is a switch
//
//   tsGo   SPL 2 / SPL 2 / SPL 1, 1    five processes
//   tsSrc  SPL   1, tsEnd           ten
//          MOV   <tsSrc, {tsDst     each copies one body cell, backward
//   tsDst  SPL   DIST+10, 1         ten into the copy DIST away; ten go on here
//   tsPap  SPL   @0, {C1            stage 1: a silk copy C1 on
//          MOV   }-1, >-1
//          SPL   @0, {C2            stage 2: C2 on
//          MOV   }-1, >-1
//          MOV   tsMov, }C3         two bombs (an imp-breaking MOV and a DAT)
//          MOV   tsDat, }C4
//          MOV   {-4, <1            stage 3: copy backward to C5 and jump there
//          JMP   @0, >C5
//   tsDat  DAT   <third, <2third
//   tsMov  MOV.I #1, <1
const twinSilk = {
  id: 'twin-silk', kind: 'body', exit: 'never', writes: 'sparse', roams: true, dialects: '94',
  processes: 20, grows: true,
  purpose: 'The paper of Aggression is a switch: five processes become ten, copy the ten-cell body DIST away and run it there and in place (twenty processes); the body runs two forward silk stages (C1, C2), drops an imp-breaking MOV and a DAT (C3, C4), then copies itself backward and jumps to the copy (C5).',
  params: { DIST: [100, 54000], C1: [100, 54000], C2: [100, 54000], C3: [10, 54000], C4: [10, 54000], C5: [100, 54000] },
  defaults: { DIST: 3532, C1: 7085, C2: 1953, C3: 854, C4: 687, C5: 2228 },
  entry: 'tsGo',
  mutable: [['tsSrc', ['b']], ['tsDst', ['a']], ['tsPap', ['a', 'b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (near(P.DIST, core) < Math.min(settings.maxLength, 200) + 16) out.push(`twin-silk: DIST ${P.DIST} puts the copy on the warrior`);
    for (const k of ['C1', 'C2', 'C5']) if (near(P[k], core) < 16) out.push(`twin-silk: ${k} lands a copy on itself`);
    if (settings.maxProcesses < 20) out.push('twin-silk: needs 20 processes');
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, t = third(core);
    ctx.ins('tsGo', 'SPL', 'B', '$2', '$0');
    ctx.ins('', 'SPL', 'B', '$2', '$0');
    ctx.ins('', 'SPL', 'B', '$1', '$1');
    ctx.ins('tsSrc', 'SPL', 'B', '$1', L('tsEnd'));
    ctx.ins('', 'MOV', 'I', `<${L('tsSrc')}`, `{${L('tsDst')}`);
    ctx.ins('tsDst', 'SPL', 'B', `${L('tsGo')}+${P.DIST + 10}`, '$1');
    ctx.ins('tsPap', 'SPL', 'B', '@0', `{${mod(P.C1, core)}`);
    ctx.ins('', 'MOV', 'I', '}-1', '>-1');
    ctx.ins('', 'SPL', 'B', '@0', `{${mod(P.C2, core)}`);
    ctx.ins('', 'MOV', 'I', '}-1', '>-1');
    ctx.ins('', 'MOV', 'I', L('tsMov'), `}${mod(P.C3, core)}`);
    ctx.ins('', 'MOV', 'I', L('tsDat'), `}${mod(P.C4, core)}`);
    ctx.ins('', 'MOV', 'I', '{-4', '<1');
    ctx.ins('', 'JMP', 'B', '@0', `>${mod(P.C5, core)}`);
    ctx.ins('tsDat', 'DAT', 'F', `<${t}`, `<${mod(2 * t, core)}`);
    ctx.ins('tsMov', 'MOV', 'I', '#1', '<1');
    ctx.mark('tsEnd');
  },
  running(api) { return onAny(api, [1, 3, 4, 5].map((k) => api.code('tsPap', k))); },
  watch(api) {
    const head = api.code('tsPap', 1);
    return {
      final() {
        if (!api.entered() || !api.alone) return;
        if (countLike(api, head) < 6) throw new Error('twin-silk made too few copies');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// nomolos-paper (20 cells): the paper of Nomolos (Mantrap Arcade's paper arm)
//
//   npGo   SPL   1, <-300          two processes
//          MOV   <npPtr, {npPtr  x6   twelve cells copied backward, DIST away
//   npPtr  JMP   DIST, #npEnd      and into the copy
//          MOV.I npGo-DIST+..., #0 the first runner turns this cell into npGo's SPL,
//          MOV.I -1, #0 / MOV.I -1, #0   and each next one copies it on: more processes
//   npSilk SPL   @0, <D0 / MOV }-1, >-1        silk stage 1
//          SPL   @0, <D1 / MOV }-1, >-1        silk stage 2
//          MOV   npBomb, }R / MOV npBomb, >R   two anti-imp DATs
//          MOV   {npSilk1, <npSilk2            copy backward ...
//   npSilk2 JMP  @0, <D2                       ... and jump there
//   npBomb DAT   <third, <2third
const nomolosPaper = {
  id: 'nomolos-paper', kind: 'body', exit: 'never', writes: 'sparse', roams: true, dialects: '94',
  processes: 8, grows: true,
  purpose: 'The paper of Nomolos (Ian Oversby; Mantrap Arcade\'s paper arm): two processes copy the twelve-cell body DIST away and run it, where three MOV.I x, #0 lines turn into copies of the launch\'s SPL and multiply the processes; the body runs two forward silk stages (D0, D1), drops two anti-imp DATs RANGE on, then copies itself backward and jumps there (D2).',
  params: { DIST: [200, 54000], D0: [100, 54000], D1: [100, 54000], D2: [100, 54000], RANGE: [16, 54000] },
  defaults: { DIST: 4000, D0: 5689, D1: 1021, D2: 3607, RANGE: 4723 },
  entry: 'npGo',
  mutable: [['npPtr', ['a', 'b']], ['npSilk', ['a', 'b']], ['npSilk1', ['a', 'b']], ['npSilk2', ['a', 'b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (near(P.DIST, core) < Math.min(settings.maxLength, 200) + 24) out.push(`nomolos-paper: DIST ${P.DIST} puts the copy on the warrior`);
    for (const k of ['D0', 'D1', 'D2']) if (near(P[k], core) < 16) out.push(`nomolos-paper: ${k} lands a copy on itself`);
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, t = third(core);
    ctx.ins('npGo', 'SPL', 'B', '$1', `<${mod(-300, core)}`);
    for (let i = 0; i < 6; i++) ctx.ins('', 'MOV', 'I', `<${L('npPtr')}`, `{${L('npPtr')}`);
    ctx.ins('npPtr', 'JMP', 'B', `$${mod(P.DIST, core)}`, `#${L('npEnd')}`);
    // In the copy (DIST - 12 past npPtr), this cell's A reaches back to npGo in the original.
    ctx.ins('npMk', 'MOV', 'I', `$${mod(-(P.DIST - 12) - 7, core)}`, '#0');
    ctx.ins('', 'MOV', 'I', '$-1', '#0');
    ctx.ins('', 'MOV', 'I', '$-1', '#0');
    ctx.ins('npSilk', 'SPL', 'B', '@0', `<${mod(P.D0, core)}`);
    ctx.ins('', 'MOV', 'I', '}-1', '>-1');
    ctx.ins('npSilk1', 'SPL', 'B', '@0', `<${mod(P.D1, core)}`);
    ctx.ins('', 'MOV', 'I', '}-1', '>-1');
    ctx.ins('', 'MOV', 'I', L('npBomb'), `}${mod(P.RANGE, core)}`);
    ctx.ins('', 'MOV', 'I', L('npBomb'), `>${mod(P.RANGE, core)}`);
    ctx.ins('', 'MOV', 'I', `{${L('npSilk1')}`, `<${L('npSilk2')}`);
    ctx.ins('npSilk2', 'JMP', 'B', '@0', `<${mod(P.D2, core)}`);
    ctx.ins('npBomb', 'DAT', 'F', `<${t}`, `<${mod(2 * t, core)}`);
    ctx.mark('npEnd');
  },
  running(api) { return onAny(api, [1, 3, 4, 5].map((k) => api.code('npSilk', k))); },
  watch(api) {
    const head = api.code('npSilk', 1);
    return {
      final() {
        if (!api.entered() || !api.alone) return;
        if (countLike(api, head) < 6) throw new Error('nomolos-paper made too few copies');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// incendiary-clear (9 cells): the incendiary bomber of Recycled Bits
//
//   icGo   SPL   #1, HOP          a feeder (SPL #: a process stays)
//   icAdd  ADD   #STEP, 1         the pointer on STEP (+1 from the MOV's post-increment)
//          MOV   icMov, >FIRST    the MOV half of the bomb at the pointer ...
//          MOV   icGo, @-1        ... and the SPL half after it
//   icJmz  JMZ   icAdd, #0        loop; after TIME passes the SPL half lands here,
//          MOV   icDat, >icGo-GATE   so the loop falls into a d-clear
//          DJN.F -1, >icGo-GATE
//   icDat  DAT   <third, 2+GATE
//   icMov  MOV   -HOP, >-HOP      the MOV half: whoever runs it copies the cell HOP back on
//
// A process that runs the pair splits, then copies cells over its own warrior.
const IC = { go: 0, add: 1, mov: 2, spl: 3, jmz: 4, dat: 7, bmov: 8, size: 9 };
const incendiaryClear = {
  id: 'incendiary-clear', kind: 'body', exit: 'never', writes: 'core', roams: false, dialects: '94',
  processes: 2, grows: true,
  purpose: 'Moore\'s incendiary bomber from Recycled Bits: a SPL # feeder over a loop that lays an incendiary pair (MOV -HOP, >-HOP, then SPL #1) every STEP+1 cells; after TIME passes the SPL half lands on the loop\'s own JMZ, which then falls through into a SPL-fed d-clear GATE cells below the block.',
  params: { STEP: [2, 27000], TIME: [100, 54000], HOP: [16, 54000], GATE: [1, 16] },
  defaults: { STEP: 2394, TIME: 1378, HOP: 7953, GATE: 3 },
  entry: 'icGo', loop: 'icAdd',
  provides: { datBomb: 'icDat' },
  mutable: [['icMov0', ['b']], ['icJmz', EVERY], ['icGo', ['b']]],
  // The feeder sends many processes round the loop, and the SPL half is aimed through the MOV
  // line's B-field after other processes may have moved it again, so the SPL halves scatter off
  // the pair lattice: the time-up is not a fixed pass (alone the JMZ is hit near cycle 5,500, with
  // about 25 processes in the loop). The contract checks the start and HOP only; the watch checks
  // that the clear is reached and that the loop survives until then.
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (near(P.HOP, core) < IC.size) out.push('incendiary-clear: HOP points the MOV half at the bomber');
    // The first pair (pass 1, STEP + 2 - STEP*TIME from icMov0) must not land on the block.
    const a = mod(2 - P.STEP * P.TIME + P.STEP, core);
    if (mod(a + IC.mov + 1, core) < IC.size + 1 || mod(a - (IC.size - IC.mov), core) > core - IC.size - 2) out.push('incendiary-clear: its first bombs land on the block');
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, t = third(core);
    // The MOV half lands at icMov0 + 2 - STEP*TIME + k*(STEP+1) - 1 on pass k (Recycled Bits' start).
    const first = mod(2 - P.STEP * P.TIME, core);
    ctx.ins('icGo', 'SPL', 'B', '#1', `$${mod(P.HOP, core)}`);
    ctx.ins('icAdd', 'ADD', 'AB', `#${P.STEP}`, '$1');
    ctx.ins('icMov0', 'MOV', 'I', L('icMov'), `>${first}`);
    ctx.ins('', 'MOV', 'I', L('icGo'), '@-1');
    ctx.ins('icJmz', 'JMZ', 'B', L('icAdd'), '#0');
    ctx.ins('', 'MOV', 'I', L('icDat'), `>${L('icGo')}-${P.GATE}`);
    ctx.ins('', 'DJN', 'F', '$-1', `>${L('icGo')}-${P.GATE}`);
    ctx.ins('icDat', 'DAT', 'F', `<${t}`, `$${2 + P.GATE + IC.dat}`);
    ctx.ins('icMov', 'MOV', 'I', `$${mod(-P.HOP, core)}`, `>${mod(-P.HOP, core)}`);
  },
  running(api) { const top = api.at('icGo'); return api.vm.processes(0).some((q) => api.rel(q, top) < IC.size); },
  watch(api) {
    const { vm } = api;
    let clear = false;
    const w = writesWatch(api, {
      name: 'incendiary-clear', base: 'icGo', own: [IC.go, IC.add, IC.mov], until: 100, least: 400,
      lines: [['icMov0', (at) => api.add(at, vm.peek(at).b)]],
    });
    return { ...w, before(pc) { if (pc === api.add(api.at('icJmz'), 1)) clear = true; return w.before(pc); },
      final() { w.final(); if (api.entered() && api.alone && !clear) throw new Error('incendiary-clear never reached its clear'); } };
  },
};

// ---------------------------------------------------------------------------
// mirage-scanner (11 cells): the scanner of Recycled Bits (bombing from the scan loop)
//
//   mgPtr  NOP   0, START         the carpet pointer
//   mgLay  MOV   mgBomb, >mgPtr   one bomb a scan at the carpet pointer
//   mgScan ADD   #STEP+1, #STEP+1 the scan pointer (STEP a look, after the predecrement)
//          JMZ.F mgLay, <mgScan   empty: scan on
//          SLT.B mgScan, #14      a find among our own cells: no re-aim
//          MOV.B mgScan, mgPtr    re-aim the carpet two cells before the find
//          JMN   mgLay, mgScan    scan on, until the scan pointer comes round to 0
//          JMP   mgLay, }mgLay    then bomb with the next cell after mgBomb (a DAT): a clear
//   mgBomb SPL   #0, {0
//          DAT 0,0 / DAT 0,0
const MG = { ptr: 0, lay: 1, scan: 2, bomb: 8, size: 11 };
const mirageScanner = {
  id: 'mirage-scanner', kind: 'body', exit: 'never', writes: 'core', roams: false, dialects: '94',
  processes: 1, grows: true,
  purpose: 'The scanner of Moore\'s Recycled Bits: a three-line loop that drops one SPL #0 at a carpet pointer, moves a scan pointer STEP and tests that cell (JMZ.F); a find outside its own cells re-aims the carpet just before it. When the scan pointer comes round to zero the bomb becomes the DAT after it, and the carpet turns into a clear.',
  params: { STEP: [1, 54000], START: [16, 54000], PAD: [0, 1] },
  // PAD 0 leaves out the two DATs after the bomb (the clear's bomb is then the blank cell after
  // the block): only for a booted copy, where far core is blank.
  defaults: { STEP: 5379, START: 5000, PAD: 1 },
  entry: 'mgLay', loop: 'mgLay',
  provides: { splBomb: 'mgBomb' },
  mutable: [['mgPtr', ['b']], ['mgLay', ['a']], ['mgScan', ['a', 'b']]],
  mismatches(P, settings) {
    const out = [], core = settings.coreSize;
    if (core / gcd(P.STEP, core) < 500) out.push(`mirage-scanner: STEP ${P.STEP} looks at only ${core / gcd(P.STEP, core)} cells`);
    if (near(P.START, core) < MG.size) out.push('mirage-scanner: START aims the carpet at itself');
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx;
    ctx.ins('mgPtr', 'NOP', 'F', '$0', `$${mod(P.START, core)}`);
    ctx.ins('mgLay', 'MOV', 'I', L('mgBomb'), `>${L('mgPtr')}`);
    ctx.ins('mgScan', 'ADD', 'AB', `#${mod(P.STEP + 1, core)}`, `#${mod(P.STEP + 1, core)}`);
    ctx.ins('', 'JMZ', 'F', L('mgLay'), `<${L('mgScan')}`);
    ctx.ins('', 'SLT', 'B', L('mgScan'), '#14');
    ctx.ins('', 'MOV', 'B', L('mgScan'), L('mgPtr'));
    ctx.ins('', 'JMN', 'B', L('mgLay'), L('mgScan'));
    ctx.ins('', 'JMP', 'B', L('mgLay'), `}${L('mgLay')}`);
    ctx.ins('mgBomb', 'SPL', 'B', '#0', '{0');
    if (P.PAD) { ctx.ins('', 'DAT', 'F', '$0', '$0'); ctx.ins('', 'DAT', 'F', '$0', '$0'); }
  },
  plant: (api) => [[api.add(api.at('mgScan'), mod(api.P.STEP * 30, api.core)), { op: 'MOV', mod: 'I', aMode: '$', a: 0, bMode: '$', b: 1 }]],
  running(api) { const top = api.at('mgPtr'); return api.vm.processes(0).some((q) => api.rel(q, top) < MG.size); },
  watch(api) {
    const { vm, P, core } = api, top = api.at('mgPtr'), lay = api.at('mgLay');
    const target = api.scenario === 'mirage-scanner: planted target' ? api.add(api.at('mgScan'), mod(P.STEP * 30, core)) : null;
    let laid = 0, near2 = false;
    return {
      before(pc) {
        if (!api.entered() || pc !== lay || vm.peek(pc).op !== 'MOV') return null;
        return { t: api.add(top, vm.peek(top).b) };
      },
      after(tok) {
        if (!tok) return;
        laid++;
        // The scan finds the pointer cell itself (it lies below mgScan, past the SLT's guard) and
        // re-aims the carpet just before it: the carpet then writes the pointer (its B becomes 0)
        // and mgLay, which turns the loop into SPL #0 feeding the scan: as in Recycled Bits, alone
        // it lives on. While the bomb is the SPL the carpet must never reach the scan lines.
        const k = api.rel(tok.t, top);
        if (k >= MG.scan && k < MG.bomb && vm.peek(lay).a === api.code('mgLay').a) throw new Error(`mirage-scanner bombed its own cell ${api.rel(tok.t, top)} at cycle ${vm.cycle} (${api.scenario})`);
        if (target !== null && api.rel(tok.t, target) < 8) near2 = true;
      },
      final() {
        if (!api.entered()) return;
        if (target !== null && !near2) throw new Error('mirage-scanner never bombed its planted target');
        if (api.alone && laid < 1000) throw new Error(`mirage-scanner bombed too little (${laid})`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// sdd-clear (12 cells): the SPL/DAT clear of Recycled Bits
//
//   sdcPtr DAT 0, 0 (three blanks; the first is the clear's pointer)
//   sdcGo  SPL   #-1, sdcEnd-sdcPtr  a feeder
//          MOV   *sdcEnd, >sdcPtr     two writes a pass, the bomb named by sdcEnd's A-field
//          MOV   *sdcEnd, >sdcPtr
//          DJN.F -1, {sdcPtr          (the DJN's A-predecrement moves the pointer's A: the
//          JMP   -2, <sdcPtr-2667      bomb selector walks from the SPL to the DAT pass)
//          DAT   #0, sdcEnd-sdcPtr-1
//          DAT   <5334, <2667         second pass bomb
//          SPL   #-2, sdcEnd-sdcPtr   first pass bomb
//   sdcEnd SPL   #sdcGo, sdcEnd-sdcPtr
//
// The pointer cell starts blank: the first write lands on it and copies the SPL feeder
// there (sdcEnd's A-field names sdcGo), which installs the pointer (its B-field the span)
// so the clear starts at sdcEnd and walks on from there.
const sddClear = {
  id: 'sdd-clear', kind: 'body', exit: 'never', writes: 'core', roams: false, dialects: '94',
  processes: 1, grows: true,
  purpose: 'The SPL/DAT clear of Moore\'s Recycled Bits, aimed at 3-point imps and at stones that bomb with core: a SPL #-1 feeder over two writes a pass through one pointer three cells below it, the bomb chosen by an A-field the clear itself walks, a SPL pass first and then DAT <2*third, <third, with a decrement stream a third of the core back.',
  params: { BACK: [100, 54000], PAD: [0, 1] },
  // PAD 0 leaves out the three blanks before the code (the pointer is then the cell three below
  // sdcGo, outside the block): only for a booted copy, where far core is blank.
  defaults: { BACK: 2667, PAD: 1 },
  entry: 'sdcGo',
  mutable: (P) => (P.PAD ? [['sdcPtr', EVERY], ['sdcEnd', ['a', 'b']]] : [['sdcEnd', ['a', 'b']]]),
  mismatches: () => [],
  emit(ctx) {
    const { L, core } = ctx, back = ctx.P.BACK, t = third(core);
    const ptr = ctx.P.PAD ? L('sdcPtr') : `(${L('sdcGo')}-3)`, span = `${L('sdcEnd')}-${ptr}`;
    if (ctx.P.PAD) { ctx.ins('sdcPtr', 'DAT', 'F', '$0', '$0'); ctx.ins('', 'DAT', 'F', '$0', '$0'); ctx.ins('', 'DAT', 'F', '$0', '$0'); }
    ctx.ins('sdcGo', 'SPL', 'B', '#-1', span);
    ctx.ins('', 'MOV', 'I', `*${L('sdcEnd')}`, `>${ptr}`);
    ctx.ins('', 'MOV', 'I', `*${L('sdcEnd')}`, `>${ptr}`);
    ctx.ins('', 'DJN', 'F', '$-1', `{${ptr}`);
    ctx.ins('', 'JMP', 'B', '$-2', `<${ptr}-${back}`);
    ctx.ins('', 'DAT', 'F', '#0', `${span}-1`);
    ctx.ins('', 'DAT', 'F', `<${mod(2 * t, core)}`, `<${t}`);
    ctx.ins('', 'SPL', 'B', '#-2', span);
    ctx.ins('sdcEnd', 'SPL', 'B', `#${L('sdcGo')}`, span);
  },
  running(api) { const top = api.add(api.at('sdcGo'), -3); return api.vm.processes(0).some((q) => api.rel(q, top) < 12); },
  watch(api) {
    const { vm } = api, top = api.add(api.at('sdcGo'), -3);
    let n = 0;
    return {
      before(pc) {
        if (!api.entered()) return null;
        const k = api.rel(pc, top);
        if ((k === 4 || k === 5) && vm.peek(pc).op === 'MOV') return { t: api.add(top, vm.peek(top).b) };
        return null;
      },
      // The first pass (SPL) must stay off the block; the clear's later passes come round over it.
      after(tok) { if (!tok) return; n++; if (n < 4000 && api.rel(tok.t, top) < 11 && api.rel(tok.t, top) > 2) throw new Error(`sdd-clear wrote its own code (write ${n})`); },
      final() { if (api.entered() && api.alone && n < 5000) throw new Error(`sdd-clear wrote too little (${n})`); },
    };
  },
};

// ---------------------------------------------------------------------------
// imp-silk (9 cells): the silk-imps of Recycled Bits
//
//   isGo   SPL 2 / SPL 1 / SPL 1     six processes
//   isS1   SPL   @0, >STEP1         stage 1: a copy STEP1 on ...
//          MOV   }-1, >-1
//          MOV   {-2, <1            ... and its source pointer handed to stage 2's B
//   isS2   SPL   @0, >STEP2         stage 2
//          MOV.I #2*STEP1, }-STEP1  each process leaves this instruction STEP1 back,
//                                   moving on like an imp through the other copies
//          DAT   1, 1
const impSilk = {
  id: 'imp-silk', kind: 'body', exit: 'never', writes: 'sparse', roams: true, dialects: '94',
  processes: 6, grows: true,
  purpose: 'The silk-imps of Moore\'s Recycled Bits: six processes run a silk stage STEP1 on that hands its source pointer to a second stage STEP2 on, then leave a MOV.I #2*STEP1, }-STEP1 behind them, which spreads through the other copies like an imp.',
  params: { STEP1: [100, 54000], STEP2: [100, 54000] },
  defaults: { STEP1: 2333, STEP2: 1737 },
  entry: 'isGo',
  mutable: [['isS1', ['a', 'b']], ['isS2', ['a', 'b']], ['isImp', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    for (const k of ['STEP1', 'STEP2']) if (near(P[k], core) < 16) out.push(`imp-silk: ${k} lands a copy on itself`);
    return out;
  },
  emit(ctx) {
    const { P, core } = ctx;
    ctx.ins('isGo', 'SPL', 'B', '$2', `>${mod(7398, core)}`);
    ctx.ins('', 'SPL', 'B', '$1', `>${mod(5483, core)}`);
    ctx.ins('', 'SPL', 'B', '$1', `>${mod(6723, core)}`);
    ctx.ins('isS1', 'SPL', 'B', '@0', `>${mod(P.STEP1, core)}`);
    ctx.ins('', 'MOV', 'I', '}-1', '>-1');
    ctx.ins('', 'MOV', 'I', '{-2', '<1');
    ctx.ins('isS2', 'SPL', 'B', '@0', `>${mod(P.STEP2, core)}`);
    ctx.ins('isImp', 'MOV', 'I', `#${mod(2 * P.STEP1, core)}`, `}${mod(-P.STEP1, core)}`);
    ctx.ins('', 'DAT', 'F', '$1', '$1');
  },
  running(api) { return onAny(api, [api.code('isS1', 1), api.code('isS1', 2), { ...api.code('isImp') }]); },
  watch(api) {
    const head = api.code('isS1', 1);
    return { final() { if (api.entered() && api.alone && countLike(api, head) < 6) throw new Error('imp-silk made too few copies'); } };
  },
};

// ---------------------------------------------------------------------------
// vanquisher (33 cells): the bomber of Return of Vanquisher PsP (Lukasz Grabun)
//
//   vqSrc  MOV.I {0, #7             the boot's source counter
//   vqLoo  MOV   vqSb', <vqPtr      three bombs a pass, all copied from cells planted
//          MOV   vqJb', *vqPtr      DOFF cells from the running loop: a SPL, a JMP
//   vqPtr  MOV   STEP+1, *3STEP+1   (and a cell copied through the pointer itself)
//          ADD   vqInc, vqPtr       both pointer fields on by 3*STEP (+4 / +1)
//          MOV   }vqMb', @vqPtr     and the MOV of the incendiary; its post-increment ...
//          JMZ.A vqLoo, {vqMb'      ... and this predecrement leave the remote MOV's A at 0
//   vqSpr  JMZ.F COFF+4, >COFF      while it is untouched: once hit (or after a lap), every
//   vqInc  JMZ.F 3STEP+4, @3STEP+1  process falls through into a spare clear COFF away
//          SPL #0 / MOV vqBmb, >vqClr-3 / DJN.F -1, >vqClr-3 / DAT >5335, 7   the clear
//          DAT 0,0 x3
//   vqJb   JMP   @STEP, STEP-1      the bombs: a process that runs the SPL splits, its
//   vqSb   SPL   #1-STEP, 8         children run the JMP and the MOV, and they jump on
//   vqMb   MOV   @0, <vqSb          into the next incendiary pair
//   vqBoo  plants the three bombs, the spare's two lines and the clear (twice, at the loop
//          and COFF away), copies the seven loop cells BOFF away and starts four processes
//          there, one a line (JMP >ptr), so the loop runs in lockstep.
const vanquisher = {
  id: 'vanquisher', kind: 'body', exit: 'never', writes: 'core', roams: true, dialects: '94',
  processes: 6, grows: true, entryFirst: false,
  purpose: 'The bomber of Return of Vanquisher PsP: four processes, one a line, run a seven-line loop BOFF away that lays three incendiary bombs a pass (SPL, JMP, MOV: an opponent that runs them splits and jumps into more bombs), all copied from cells planted DOFF away, stepping 3*STEP; a JMZ.A watches the planted MOV, and when it is hit (or the loop has lapped) every process falls through into a SPL-fed clear planted beside the loop, with a spare clear COFF away.',
  params: { STEP: [3, 18000], BOFF: [200, 54000], DOFF: [-400, 400], COFF: [40, 54000] },
  defaults: { STEP: 1022, BOFF: 3408, DOFF: -252, COFF: 7919 },
  entry: 'vqBoo',
  mutable: [['vqSrc', ['a', 'b']], ['vqPtr', ['a', 'b']], ['vqDst', ['b']], ['vqCSrc', ['b']], ['vqCSpr', ['b']], ['vqSpk', ['b']], ['vqMb', ['a']], ['vqSb', ['b']], ['vqSpr', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [], len = Math.min(settings.maxLength, 200);
    if (near(P.BOFF, core) < len + 40) out.push(`vanquisher: BOFF ${P.BOFF} puts the loop on the warrior`);
    if (Math.abs(P.DOFF) < 24) out.push('vanquisher: DOFF plants the bombs on the loop');
    if (near(P.COFF, core) < 40 || near(P.COFF - P.BOFF, core) < len + 40) out.push('vanquisher: the spare clear lands on the loop or the warrior');
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, S = P.STEP, D = P.DOFF;
    const boff = (k) => `${L('vqLoo')}+${P.BOFF + k}`;
    ctx.ins('vqSrc', 'MOV', 'I', '{0', '#7');
    ctx.ins('vqLoo', 'MOV', 'I', `${L('vqSb')}+${D - 2}`, `<${L('vqPtr')}`);
    ctx.ins('', 'MOV', 'I', `${L('vqJb')}+${D - 2}`, `*${L('vqPtr')}`);
    ctx.ins('vqPtr', 'MOV', 'I', `$${S + 1}`, `*${mod(3 * S + 1, core)}`);
    ctx.ins('', 'ADD', 'F', L('vqInc'), L('vqPtr'));
    ctx.ins('', 'MOV', 'I', `}${L('vqMb')}+${D - 2}`, `@${L('vqPtr')}`);
    ctx.ins('', 'JMZ', 'A', L('vqLoo'), `{${L('vqMb')}+${D - 2}`);
    ctx.ins('vqSpr', 'JMZ', 'F', `$${mod(P.COFF + 4, core)}`, `>${mod(P.COFF, core)}`);
    ctx.ins('vqInc', 'JMZ', 'F', `$${mod(3 * S + 4, core)}`, `@${mod(3 * S + 1, core)}`);
    ctx.ins('', 'SPL', 'B', '#0', '#0');
    ctx.ins('vqClr', 'MOV', 'I', L('vqBmb'), `>${L('vqClr')}-3`);
    ctx.ins('', 'DJN', 'F', L('vqClr'), `>${L('vqClr')}-3`);
    ctx.ins('vqBmb', 'DAT', 'F', `>${mod(Math.round(core * 2 / 3) + 2, core)}`, `$${2 + 5}`);
    for (let i = 0; i < 3; i++) ctx.ins('', 'DAT', 'F', '$0', '$0');
    ctx.ins('vqJb', 'JMP', 'B', `@${S}`, `$${S - 1}`);
    ctx.ins('vqSb', 'SPL', 'B', `#${mod(1 - S, core)}`, '$8');
    ctx.ins('vqMb', 'MOV', 'I', '@0', `<${L('vqSb')}`);
    ctx.ins('vqBoo', 'MOV', 'I', L('vqMb'), boff(17 + D));
    ctx.ins('', 'MOV', 'I', L('vqSb'), boff(16 + D));
    ctx.ins('', 'MOV', 'I', L('vqJb'), boff(15 + D));
    ctx.ins('', 'MOV', 'I', L('vqInc'), boff(9));
    ctx.ins('', 'MOV', 'I', L('vqSpr'), boff(8));
    ctx.ins('vqDst', 'SPL', 'B', '$1', boff(8));
    ctx.ins('', 'MOV', 'I', `<${L('vqCSrc')}`, `{${boff(9)}`);
    ctx.ins('', 'MOV', 'I', `<${L('vqCSrc')}`, `{${boff(9)}`);
    ctx.ins('', 'MOV', 'I', `<${L('vqCSpr')}`, `{${boff(8)}`);
    ctx.ins('', 'MOV', 'I', `<${L('vqCSpr')}`, `{${boff(8)}`);
    ctx.ins('vqSpk', 'SPL', 'B', '$1', '}0');
    ctx.ins('vqCSrc', 'SPL', 'B', '$1', `${L('vqBmb')}+1`);
    ctx.ins('', 'MOV', 'I', `<${L('vqSrc')}`, `<${L('vqDst')}`);
    ctx.ins('vqCSpr', 'JMP', 'B', `>${L('vqDst')}`, `${L('vqBmb')}+1`);
  },
  running(api) { return onAny(api, [2, 4, 5, 6].map((k) => api.code('vqLoo', k - 1))) || onAny(api, [api.code('vqClr'), api.code('vqClr', 1)]); },
  watch(api) {
    const { vm, P } = api, loo = api.add(api.at('vqLoo'), P.BOFF);
    let entered = 0, bombs = 0;
    const mb = api.code('vqMb');
    return {
      before(pc) { if (api.rel(pc, loo) < 4 && vm.cycle < 200) entered++; return null; },
      final() {
        if (!api.entered() || !api.alone) return;
        if (!entered) throw new Error('vanquisher: no process reached the loop');
        for (let c = 0; c < api.core; c++) if (vm.peek(c).op === 'MOV' && vm.peek(c).aMode === mb.aMode && vm.peek(c).bMode === mb.bMode) bombs++;
        if (bombs < 50) throw new Error(`vanquisher bombed too little (${bombs} incendiary MOVs)`);
      },
    };
  },
};

export default [sunsetPaperStone, reconScanner, miniBlur, fiPaper, skewDwarf, carboniteStone, twinSilk, nomolosPaper,
  incendiaryClear, mirageScanner, sddClear, impSilk, vanquisher];
