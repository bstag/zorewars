// ICWS'88 scanning blocks from the Koenigstuhl '88 hill review
// (docs/hill-top30/88.md, docs/hill-top30/block-gaps.md):
//
//   probe-burst-88      the bomb burst after a quickscan hit;
//   bscan-clear-88      a 0.5c B-field scanner that stuns with SPL 0 / JMP -1
//                       pairs and, when its pointer reaches its own code,
//                       becomes an SPL 0 + DAT clear;
//   scan-replicator-88  a one-process bomber that tests the cell under each
//                       bomb and copies itself beside whatever it finds;
//   opening-q2-stun-88  a quickscan whose attack is a stun pit and a run of
//                       JMP bombs.
//
// The mechanisms are studied from the hill; every line of Redcode, the layouts
// and the constants here are written from scratch. All run in strict '88 and
// in '94.
const mod = (x, n) => ((x % n) + n) % n;
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const MARKER = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };
const sameOp = (x, y) => ['op', 'aMode', 'bMode'].every((f) => x[f] === y[f]);

// ---------------------------------------------------------------------------
// probe-burst-88
//
// Sits in a seq after an opening that hands on a cell through `probe` (its
// B-field is that cell, from the probe; the image boundary when it found
// nothing). COUNT passes, each two DAT bombs GAP apart, the passes STEP apart,
// the first OFFSET cells before the found cell:
//
//   burst  MOV U, bp            the probe cell, whole, into our pointer
//          ADD #shift, bp       make it ours, moved so that every found cell
//          SLT #limit, bp       whose burst would touch the image (the
//          JMP next             boundary included) is a small number: hand on
//          SUB #back, bp        a real pointer again, OFFSET before the cell
//   bLoop  MOV bomb, @bp
//          ADD #GAP, bp
//          MOV bomb, @bp
//          SUB #GAP-STEP, bp
//          DJN bLoop, #COUNT    and fall into the next block
//
// One comparison does both jobs: the cells whose burst would reach the image
// run from just below it to OFFSET past its end, and the shift maps exactly
// that stretch onto 0 .. span+reach-1. The upstream probe is left alone, so a
// finisher after the burst still starts from the found cell.
const PB = 'probe-burst-88';
const burstReach = (P) => (P.COUNT - 1) * P.STEP + P.GAP;        // from the first bomb to the last
const probeBurst = {
  id: PB, kind: 'opening', exit: 'next', link: 'fall', processes: 1, writes: 'sparse', entry: 'burst',
  purpose: "ICWS'88 burst after a quickscan hit: COUNT passes STEP apart from OFFSET cells before the cell the probe found, two DAT bombs a pass GAP apart, never inside the warrior's image; at the image boundary, or when the burst would reach the image, it hands on at once. Ten instructions and two data cells.",
  params: { COUNT: [1, 40], STEP: [1, 100], GAP: [1, 200], OFFSET: [0, 200] },
  defaults: { COUNT: 8, STEP: 9, GAP: 43, OFFSET: 27 },
  // Like probe-burst, it does not advertise `probe` itself: the seq already carries the
  // upstream probe through unchanged, and advertising one would let it meet its own need.
  needs: ['probe'],
  mutable: [['bp', ['a', 'b']], ['bCount', ['b']]],
  knowledge: {
    parameterRoles: { COUNT: 'Passes: 2*COUNT bombs.', STEP: 'Between passes.', GAP: 'Between the two bombs of a pass.', OFFSET: 'How far before the found cell the first bomb lands.' },
    tuning: ['The burst costs 5 cycles a pass after 5 to set up.', 'With GAP a multiple of the quickscan pair gap the second stream covers the other cell of the pair.'],
    failures: ['A found cell closer to the image than the burst is long gets no burst at all.'],
    evidence: ['docs/hill-top30/88.md'],
  },
  mismatches(P, settings) {
    return burstReach(P) + P.OFFSET >= Math.floor(settings.coreSize / 2) - settings.maxLength ? [`${PB}: the burst is long enough to wrap into the warrior`] : [];
  },
  state(ctx) {
    ctx.ins('bp', 'DAT', 'F', '#0', '#0');
    ctx.ins('bomb', 'DAT', 'F', '#0', '#0');
  },
  emit(ctx) {
    const { L, P } = ctx, U = ctx.ref('probe'), bp = L('bp'), reach = burstReach(P);
    // bp's index in the image, as label arithmetic (the first code line is at ctx.pc()).
    const idx = `(${ctx.pc()}-(${L('burst')}-${bp}))`;
    ctx.ins('burst', 'MOV', 'I', U, bp);
    ctx.ins('', 'ADD', 'AB', `#(${U}-${bp}+${idx}+${reach - P.OFFSET})`, bp);
    ctx.ins('', 'SLT', 'AB', `#${ctx.span + reach - 1}`, bp);
    ctx.ins('', 'JMP', 'B', ctx.next);
    ctx.ins('', 'SUB', 'AB', `#(${idx}+${reach})`, bp);
    ctx.ins('bLoop', 'MOV', 'I', L('bomb'), `@${bp}`);
    ctx.ins('', 'ADD', 'AB', `#${P.GAP}`, bp);
    ctx.ins('bTwo', 'MOV', 'I', L('bomb'), `@${bp}`);
    ctx.ins('', 'SUB', 'AB', `#${P.GAP - P.STEP}`, bp);
    ctx.ins('bCount', 'DJN', 'B', L('bLoop'), `#${P.COUNT}`);
  },
  // It has no plant of its own: poking the upstream probe would break that opening's own
  // checks. The watch judges every run by where the probe points when the burst is entered,
  // so the upstream opening's planted find exercises the burst.
  watch(api) {
    const { vm, P, core } = api, bp = api.at('bp'), w1 = api.at('bLoop'), w2 = api.at('bTwo'), reach = burstReach(P);
    const hit = new Set();
    let bombs = 0, found = null, due = null, closed = false;
    return {
      before(pc) {
        // One run: once the burst has handed on, a stray process that slides back into these cells is not it.
        if (found !== null && !closed && pc !== api.entry() && !api.inSelf(pc)) closed = true;
        if (closed) return null;
        if (pc === api.entry() && found === null) {
          found = api.norm(api.ref('probe') + vm.peek(api.ref('probe')).b);
          // Due unless a bomb of the burst would land on the image (or the probe is at its boundary).
          due = true;
          for (let d = -P.OFFSET; d <= -P.OFFSET + reach && due; d++) if (api.rel(found + d, api.image.start) < api.total) due = false;
          if (api.rel(found, api.image.start) === api.total) due = false;
        }
        // Only the burst itself: late in a round an imp of ours may walk over these cells.
        return (pc === w1 || pc === w2) && vm.peek(pc).op === 'MOV' && vm.peek(pc).bMode === '@' ? { t: api.norm(bp + vm.peek(bp).b), pc } : null;
      },
      after(x) {
        if (!x) return;
        if (api.inImage(x.t) && !api.inDead(x.t)) throw new Error(`${PB} bombed its own image`);
        if (!api.same(vm.peek(x.t), api.code('bomb')) || vm.writerPc[x.t] !== x.pc) throw new Error(`${PB} dropped something other than its bomb`);
        bombs++; hit.add(x.t);
      },
      final() {
        if (found === null) return;
        if (!due) { if (bombs) throw new Error(`${PB} bombed although the probe held nothing it could burst`); return; }
        if (bombs !== 2 * P.COUNT) throw new Error(`${PB} dropped ${bombs} bombs, not ${2 * P.COUNT}`);
        for (let k = 0; k < P.COUNT; k++) for (const g of [0, P.GAP]) {
          if (!hit.has(api.norm(found - P.OFFSET + k * P.STEP + g))) throw new Error(`${PB} did not lay both streams from OFFSET before the found cell`);
        }
      },
    };
  },
};

// ---------------------------------------------------------------------------
// bscan-clear-88
//
//   sLoop  ADD #STEP, cPtr       the scan: one B-field every STEP cells,
//   sTest  JMZ sLoop, @cPtr      two cycles a cell (0.5c)
//   sHitA  MOV cJmp, @cPtr       found: JMP -1 on the cell ...
//   sHitB  MOV cHead, <cPtr      ... and SPL 0 on the cell below it
//   sFix   ADD #1, cPtr          (put the pointer back, so a find costs no step)
//   sBack  JMN sLoop, sLoop      scan on while sLoop still has a B-field
//   cHead  SPL 0, 0              the clear; also the SPL bomb
//   cMov   MOV cBomb, <cPtr
//   cJmp   JMP cMov, 0           also the JMP -1 bomb
//   cBomb  DAT #0, #-10          its B-field takes the clear past the block
//   cPtr   DAT #0, #first        the one pointer: scan, stun and clear
//
// The pointer starts TIME steps before sTest. Scan number TIME therefore finds
// the scanner's own JMZ: the stun pair lands on sTest and sLoop, sLoop is now
// SPL 0, 0, the JMN fails, and control falls into the clear, which starts on
// the dead scan lines and walks downward. When the clear comes round to its
// pointer it copies cBomb over it, and the pointer is then ten cells further
// down: just below the block, lap after lap. No counter is spent on the timing.
const BC = 'bscan-clear-88';
const bcCells = ['sLoop', 'sTest', 'sHitA', 'sHitB', 'sFix', 'sBack', 'cHead', 'cMov', 'cJmp', 'cBomb', 'cPtr'];
const BC_LEN = bcCells.length;
// The pointer before the first scan, from cPtr: scan TIME lands on sTest (cPtr - 9).
const bcFirst = (P, core) => mod(-(BC_LEN - 2) - P.TIME * P.STEP, core);
const bscanClear = {
  id: BC, kind: 'body', exit: 'never', processes: 1, grows: true, entry: 'sLoop',
  writes: 'core', attacks: 'all', relocatable: false,
  purpose: "ICWS'88 B-field scanner at 0.5c (one B-field every STEP cells) that stuns each find with JMP -1 on the cell and SPL 0 below it. At scan TIME it finds its own code and becomes an SPL 0 + DAT clear. STREAM optionally gives the clear a DJN stream and a separate JMP stun cell.",
  params: { STEP: [3, 27000], TIME: [50, 8000], ANTISTEP: [0, 27719], STREAM: [0, 7999] },
  defaults: { STEP: 2359, TIME: 2000, ANTISTEP: 0, STREAM: 0 },
  mutable: [['cPtr', ['a', 'b']], ['sLoop', ['a', 'b']], ['sTest', ['a', 'b']]],
  knowledge: {
    parameterRoles: {
      STEP: 'Between scanned cells. With gcd(STEP, core) = 1 the scan can reach every cell.',
      TIME: 'Scans before it turns into the clear (two cycles each).',
      ANTISTEP: 'If nonzero, the DAT bomb decrements a B-field this far ahead when executed. The clear retains its own pointer-wrap distance.',
      STREAM: 'If nonzero, the DAT clear uses a predecrement DJN stream starting this far from the scanner, and the JMP stun is stored separately.',
    },
    tuning: ['A find costs four cycles and no step: the conversion always comes at scan TIME.', 'The clear is 0.5c with one process and gains a process a pass from its SPL 0; a lap of the 8,000 core takes 16,000 cycles.'],
    failures: ['It scans B-fields only: code whose B-fields are zero is invisible until the clear.', 'It stuns any non-zero B-field it meets, its own image included, so it takes no partners; decoys in its own image are found and stunned like anything else.', 'An enemy write that changes sLoop before scan TIME starts the clear early; one that changes cPtr sends the scan elsewhere and the conversion may never come.'],
    evidence: ['docs/hill-top30/88.md'],
  },
  mismatches(P, settings) {
    const core = settings.coreSize, out = [], first = bcFirst(P, core);
    // Before scan TIME the pointer must not meet the block (or the cell above it, whose SPL would land on cPtr).
    for (let k = 1; k < P.TIME; k++) {
      const d = mod(first + k * P.STEP, core);
      // The SPL feeder's B-field is zero until the handoff, so probing it is harmless.
      if (P.STREAM && d === mod(bcCells.indexOf('cHead') - (BC_LEN - 1), core)) continue;
      if (d === 0 || d >= core - (BC_LEN - 1)) { out.push(`${BC}: scan ${k} of ${P.TIME} already lands on the scanner (STEP ${P.STEP} comes back too soon)`); break; }
    }
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, ptr = L('cPtr');
    ctx.ins('sLoop', 'ADD', 'AB', `#${P.STEP}`, ptr);
    ctx.ins('sTest', 'JMZ', 'B', L('sLoop'), `@${ptr}`);
    ctx.ins('sHitA', 'MOV', 'I', L(P.STREAM ? 'stunJmp' : 'cJmp'), `@${ptr}`);
    ctx.ins('sHitB', 'MOV', 'I', L('cHead'), `<${ptr}`);
    ctx.ins('sFix', 'ADD', 'AB', '#1', ptr);
    ctx.ins('sBack', 'JMN', 'B', L('sLoop'), L('sLoop'));
    ctx.ins('cHead', 'SPL', 'B', '0', '0');
    ctx.ins('cMov', 'MOV', 'I', L('cBomb'), `<${ptr}`);
    if (P.STREAM) ctx.ins('cJmp', 'DJN', 'B', L('cMov'), `<${L('sLoop')}+${P.STREAM}`);
    else ctx.ins('cJmp', 'JMP', 'B', L('cMov'), '0');
    ctx.ins('cBomb', 'DAT', 'F', P.ANTISTEP ? `<${P.ANTISTEP}` : '#0', `#${-(BC_LEN - 1)}`);
    ctx.ins('cPtr', 'DAT', 'F', '#0', `#${bcFirst(P, core)}`);
    if (P.STREAM) ctx.ins('stunJmp', 'JMP', 'B', '-1', '0');
  },
  // A find for the gate: a non-zero B-field on the cell scan number 7 looks at.
  plant(api) {
    const cell = api.norm(api.at('cPtr') + bcFirst(api.P, api.core) + 7 * api.P.STEP);
    return [[cell, MARKER]];
  },
  watch(api) {
    const { vm, P, core } = api, at = Object.fromEntries(bcCells.map((l) => [l, api.at(l)]));
    const planted = api.scenario === `${BC}: planted target`;
    const target = api.norm(at.cPtr + bcFirst(P, core) + 7 * P.STEP);
    const inBlock = (c) => api.norm(c - at.sLoop) < BC_LEN;
    const scanning = () => api.same(vm.peek(at.sLoop), api.code('sLoop')) && api.same(vm.peek(at.sTest), api.code('sTest'));
    const stun = api.code(P.STREAM ? 'stunJmp' : 'cJmp');
    let scans = 0, convertedAt = null, convertedCycle = null, wipes = 0, stuns = 0;
    const wiped = new Set();
    return {
      before(pc) {
        if (pc === at.cHead && convertedAt === null) { convertedAt = scans; convertedCycle = vm.cycle; }
        if (pc === at.sTest && scanning()) return { scan: api.norm(at.cPtr + vm.peek(at.cPtr).b) };
        if (pc === at.sHitA && api.same(vm.peek(pc), api.code('sHitA'))) return { stun: api.norm(at.cPtr + vm.peek(at.cPtr).b) };
        if (pc === at.cMov && api.same(vm.peek(pc), api.code('cMov')) && vm.peek(at.cPtr).op === 'DAT') {
          // The DJN stream can decrement the carried DAT's B-field as it passes.
          return { wipe: api.norm(at.cPtr + vm.peek(at.cPtr).b - 1), bomb: P.STREAM ? { ...vm.peek(at.cBomb) } : api.code('cBomb') };
        }
        return null;
      },
      after(t) {
        if (!t) return;
        if (t.scan !== undefined) {
          scans++;
          // Alone, nothing moves the pointer but the scan: scan k looks k steps on.
          if (api.alone && t.scan !== api.norm(at.cPtr + bcFirst(P, core) + scans * P.STEP)) throw new Error(`${BC}: scan ${scans} looked at the wrong cell`);
        } else if (t.stun !== undefined) {
          if (!sameOp(vm.peek(t.stun), stun) || api.norm(vm.peek(t.stun).a) !== core - 1) throw new Error(`${BC}: no JMP -1 on the cell it found`);
          stuns++;
        } else {
          // The clear: DATs everywhere but its own nine live cells (the two dead scan lines go first).
          if (inBlock(t.wipe) && api.norm(t.wipe - at.sLoop) > 1 && t.wipe !== at.cPtr && t.wipe !== at.cBomb) throw new Error(`${BC}: the clear wiped its own code`);
          if (t.bomb.op !== 'DAT' || !api.same(vm.peek(t.wipe), t.bomb)) throw new Error(`${BC}: the clear wrote something other than its DAT bomb`);
          wipes++; wiped.add(t.wipe);
        }
      },
      final() {
        if (planted) {
          if (!sameOp(vm.peek(target), stun) && vm.peek(target).op !== 'DAT') throw new Error(`${BC}: the planted cell was not stunned`);
          if (stuns < 1) throw new Error(`${BC}: the scan ignored the planted cell`);
        }
        if (!api.alone && !planted) return;
        const expected = 2 * P.TIME + (planted ? 4 : 0);
        if (vm.cycle < expected + 20) {
          if (convertedAt !== null) throw new Error(`${BC}: it became a clear after ${convertedAt} scans, before scan ${P.TIME}`);
          if (scans < Math.floor(vm.cycle / 2) - 8) throw new Error(`${BC}: only ${scans} scans in ${vm.cycle} cycles`);
          return;
        }
        if (convertedAt !== P.TIME) throw new Error(`${BC}: it became a clear after ${convertedAt} scans, not ${P.TIME}`);
        if (api.alone && !P.STREAM && stuns !== 1) throw new Error(`${BC}: ${stuns} stuns alone; only its own code should be found`);
        const due = Math.min(core - BC_LEN - 2, Math.floor((vm.cycle - convertedCycle) * 0.45) - 40);   // 0.5c, less the SPL 0's turns
        if (wiped.size < due) throw new Error(`${BC}: the clear covered ${wiped.size} cells, not ${due}`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// scan-replicator-88
//
//   rCnt   JMP rLoop, 0          a copy is started here; its B-field counts the copy
//   rFound MOV rCnt, @rDat       found something: put this JMP on it (its B-field is
//                                zero, so the cell is never found again),
//   rArmC  MOV #LEN, rCnt        arm the count ...
//   rArm   MOV #HOP+LEN+2, rBack ... and the copy pointer,
//   rAim   ADD rDat, rBack       HOP cells past the bomb above what was found
//   rCopy  MOV <rCnt, <rBack     copy the body, top down
//   rMore  JMN rCopy, rCnt
//   rGo    SPL @rBack            start the copy, and scan on
//   rLoop  ADD #STEP+1, rDat
//   rDrop  MOV rDat, @rDat       a DAT every STEP cells ...
//   rTest  JMZ rLoop, <rDat      ... and a look at the B-field of the cell below it
//   rBack  JMP rFound, 0         its B-field is the copy pointer
//   rDat   DAT #0, #first        the bomb, and the bomb pointer
//
// One process, three cycles a pass. The bombs fall on one residue class of the
// grain gcd(STEP, core), the tested cells on the class below it, and the body
// on classes 0-12, so it never bombs or finds itself; HOP is moved to the
// value that puts every copy on the same classes, and a copy inherits the
// parent's pointer, so copies never bomb or find each other either.
const SR = 'scan-replicator-88';
const srCells = ['rCnt', 'rFound', 'rArmC', 'rArm', 'rAim', 'rCopy', 'rMore', 'rGo', 'rLoop', 'rDrop', 'rTest', 'rBack', 'rDat'];
const SR_LEN = srCells.length, SR_RHO = SR_LEN + 1;        // the bombs' residue, from the body's first cell
function srGeom(P, core) {
  const g = gcd(P.STEP, core);
  // Bomb k lands on rDat + first + k*STEP; from the body's first cell that is residue SR_RHO.
  const first = P.FIRST - mod(P.FIRST + (SR_LEN - 1) - SR_RHO, g);
  const hop = P.HOP - mod(P.HOP + SR_RHO, g);              // copy start = bomb + hop, on residue 0
  return { g, first, hop };
}
const scanReplicator = {
  id: SR, kind: 'body', exit: 'never', processes: 1, grows: true, writes: 'sparse', roams: true, attacks: 'all', entry: 'rCnt',
  purpose: "ICWS'88 self-replicating scanner: one process drops a DAT every STEP cells and tests the B-field of the cell below each bomb (three cycles a pass); when that is not zero it overwrites that cell, copies its thirteen cells HOP cells past the bomb, starts a process in the copy and scans on, so it gains a process for every find.",
  params: { STEP: [14, 27000], FIRST: [20, 54000], HOP: [100, 54000] },
  defaults: { STEP: 2380, FIRST: 2362, HOP: 3187 },
  mutable: [['rCnt', ['b']], ['rBack', ['b']], ['rDat', ['b']]],
  knowledge: {
    parameterRoles: {
      STEP: 'Between bombs. gcd(STEP, core) is the grain: at least 15 (thirteen classes for the body, one for the bombs, one for the tested cells).',
      FIRST: 'First bomb, from the bomb cell; moved down to the bomb class.', HOP: 'Where a copy goes, from the bomb above the find; moved down so the copy sits on the body classes.',
    },
    tuning: ['It bombs 1/grain of the core and tests another 1/grain: a grain of 20 on the 8,000 core is 400 bombs a lap, 1,200 cycles.', 'A copy starts with its parent\'s pointer, so parent and copy bomb the same class from different places.'],
    failures: ['Alone it never copies: it is then a one-process mod-grain stone.', 'A find HOP cells before the scanner puts the copy on the scanner itself; nothing guards against that.', 'It bombs and tests whatever lies on its two classes, its own image outside the body included.'],
    evidence: ['docs/hill-top30/88.md'],
  },
  mismatches(P, settings) {
    const core = settings.coreSize, room = settings.maxLength, out = [], G = srGeom(P, core);
    if (G.g < SR_LEN + 2) return [`${SR}: STEP ${P.STEP} shares only ${G.g} with the core; the body, the bombs and the tested cells need a grain of ${SR_LEN + 2}`];
    if (G.first < 20 || G.hop < room + SR_LEN || G.hop > core - room - 2 * SR_LEN) out.push(`${SR}: FIRST or HOP is out of range once moved to its residue`);
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, G = srGeom(P, core);
    ctx.ins('rCnt', 'JMP', 'B', L('rLoop'), '0');
    ctx.ins('rFound', 'MOV', 'I', L('rCnt'), `@${L('rDat')}`);
    ctx.ins('rArmC', 'MOV', 'AB', `#${SR_LEN}`, L('rCnt'));
    // The pointer is on the found cell, one below the bomb, and rBack is one below rDat.
    ctx.ins('rArm', 'MOV', 'AB', `#${G.hop + SR_LEN + 2}`, L('rBack'));
    ctx.ins('rAim', 'ADD', 'F', L('rDat'), L('rBack'));
    ctx.ins('rCopy', 'MOV', 'I', `<${L('rCnt')}`, `<${L('rBack')}`);
    ctx.ins('rMore', 'JMN', 'B', L('rCopy'), L('rCnt'));
    ctx.ins('rGo', 'SPL', 'B', `@${L('rBack')}`, '0');
    ctx.ins('rLoop', 'ADD', 'AB', `#${P.STEP + 1}`, L('rDat'));
    ctx.ins('rDrop', 'MOV', 'I', L('rDat'), `@${L('rDat')}`);
    ctx.ins('rTest', 'JMZ', 'B', L('rLoop'), `<${L('rDat')}`);
    ctx.ins('rBack', 'JMP', 'B', L('rFound'), '0');
    ctx.ins('rDat', 'DAT', 'F', '#0', `#${G.first - 1}`);
  },
  // The cell under bomb number 5: the scanner must copy itself HOP past that bomb.
  plant(api) {
    const G = srGeom(api.P, api.core);
    return [[api.norm(api.at('rDat') + G.first + 5 * api.P.STEP - 1), MARKER]];
  },
  running: (api) => api.vm.processes(0).some((q) => api.inSelf(q)),
  watch(api) {
    const { vm, P, core } = api, G = srGeom(P, core);
    const at = Object.fromEntries(srCells.map((l) => [l, api.at(l)]));
    const planted = api.scenario === `${SR}: planted target`;
    const bomb5 = api.norm(at.rDat + G.first + 5 * P.STEP), wantCopy = api.norm(bomb5 + G.hop);
    const loopOk = () => ['rLoop', 'rDrop', 'rTest'].every((l) => api.same(vm.peek(at[l]), api.code(l)));
    const cells = new Set();
    let bombs = 0, copies = 0, copyAt = null, copyRan = false;
    return {
      before(pc) {
        if (copyAt !== null && pc === api.norm(copyAt + srCells.indexOf('rDrop'))) copyRan = true;
        if (pc === at.rDrop && loopOk()) return { bomb: api.norm(at.rDat + vm.peek(at.rDat).b) };
        if (pc === at.rGo && api.same(vm.peek(pc), api.code('rGo'))) {
          const dst = api.norm(at.rBack + vm.peek(at.rBack).b);
          // The copy is whole: every cell, apart from the three B-fields that are pointers.
          srCells.forEach((l, i) => {
            const x = vm.peek(dst + i), y = vm.peek(at[l]);
            if (!sameOp(x, y) || api.norm(x.a) !== api.norm(y.a) || (!['rCnt', 'rBack'].includes(l) && api.norm(x.b) !== api.norm(y.b))) throw new Error(`${SR}: the copy is not the scanner (cell ${i})`);
          });
          return { copy: dst };
        }
        return null;
      },
      after(t) {
        if (!t) return;
        if (t.bomb !== undefined) {
          if (api.inSelf(t.bomb)) throw new Error(`${SR}: it bombed itself`);
          if (copyAt !== null && api.norm(t.bomb - copyAt) < SR_LEN) throw new Error(`${SR}: it bombed its copy`);
          if (vm.peek(t.bomb).op !== 'DAT') throw new Error(`${SR}: it dropped something other than its DAT`);
          bombs++; cells.add(t.bomb);
          if (api.alone && t.bomb !== api.norm(at.rDat + G.first + bombs * P.STEP)) throw new Error(`${SR}: bomb ${bombs} is not STEP past the last`);
        } else {
          if (vm.processes(0).at(-1) !== t.copy) throw new Error(`${SR}: no process was started in the copy`);
          copies++; copyAt ??= t.copy;
        }
      },
      final() {
        if (planted) {
          if (copyAt !== wantCopy) throw new Error(`${SR}: the copy went to ${copyAt}, not HOP past the bomb above the find (${wantCopy})`);
          if (!copyRan) throw new Error(`${SR}: the copy never ran its scan`);
          if (api.total === SR_LEN && copies !== 1) throw new Error(`${SR}: it copied itself ${copies} times for one find`);
          if (vm.processes(0).length < 2) throw new Error(`${SR}: the scanner or its copy died`);
        }
        // Alone in the image: decoys or dead code beside it would be found like anything else.
        if (!api.alone || api.total !== SR_LEN) return;
        if (copies) throw new Error(`${SR}: it copied itself with nothing to find`);
        if (vm.processes(0).length !== 1) throw new Error(`${SR}: ${vm.processes(0).length} processes alone`);
        if (cells.size < Math.min(100, core / G.g - 1)) throw new Error(`${SR}: it bombed only ${cells.size} cells`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// opening-q2-stun-88
//
// PAIRS comparisons, one cycle each, of cells GAP apart, the pairs SPACING
// apart from START. A pair that differs jumps into a ladder of ADDs at its own
// rung, so the probe ends one cell above the pair's low cell. The attack is
// not a DAT burst but a pit and a run:
//
//   qPit   MOV qJ, <qP        JMP -2 on the low cell,
//          MOV qS1, <qP       SPL -1 below it,
//          MOV qS0, <qP       SPL 0 below that: a process that runs any of the
//   qRun   ADD #STEP, qP      three is held there, splitting for ever
//          MOV qJ, @qP        then RUN JMP -2 bombs STEP apart, upward; GAP+2
//   qCount DJN qRun, #RUN     is a multiple of STEP, so one lands on the pair's
//                             high cell
//
// and it falls into the next block with the probe on its last bomb. Nothing
// found: it hands on with the probe at the image boundary.
const Q2 = 'opening-q2-stun-88';
const q2Low = (P, i) => P.START + i * P.SPACING;
const q2Stun = {
  id: Q2, kind: 'opening', exit: 'next', link: 'fall', processes: 1, writes: 'sparse', entry: 'qScan',
  purpose: "ICWS'88 quickscan with a stun attack: PAIRS one-cycle comparisons of cells GAP apart (SPACING apart from START), an ADD ladder that decodes the pair, then a pit on the pair's low cell (SPL 0 / SPL -1 / JMP -2) and RUN JMP -2 bombs STEP apart above it, one of them on the pair's high cell. 3*PAIRS+7 instructions and four data cells.",
  params: { PAIRS: [2, 10], START: [60, 54000], SPACING: [20, 27000], GAP: [2, 400], RUN: [1, 12], STEP: [2, 100] },
  defaults: { PAIRS: 5, START: 1500, SPACING: 1300, GAP: 38, RUN: 5, STEP: 10 },
  provides: { probe: 'qP' },
  mutable: [['qP', ['a', 'b']], ['qCount', ['b']]],
  knowledge: {
    parameterRoles: { PAIRS: 'Comparisons: two cells each.', START: 'Low cell of the first pair, from the probe.', SPACING: 'Between pairs.', GAP: 'Between the two cells of a pair; GAP+2 must be a multiple of STEP no longer than the run.', RUN: 'JMP bombs after the pit.', STEP: 'Between them.' },
    tuning: ['A quiet scan costs PAIRS+1 cycles. A hit on pair i costs i+1 ladder cycles, three for the pit and three a JMP bomb.'],
    failures: ['Equal cells are invisible, so two cells of the same decoy pass.', 'The pit holds only processes that run one of its three cells; the JMP -2 bombs send a process two cells back, which stops code only where that loops.'],
    evidence: ['docs/hill-top30/88.md'],
  },
  mismatches(P, { coreSize: core, maxLength: room }) {
    const out = [], cells = [];
    if ((P.GAP + 2) % P.STEP || (P.GAP + 2) / P.STEP > P.RUN) out.push(`${Q2}: GAP+2 must be a multiple of STEP within the run, so a JMP bomb lands on the pair's high cell`);
    for (let i = 0; i < P.PAIRS; i++) {
      const low = mod(q2Low(P, i), core);
      cells.push(low, mod(low + P.GAP, core));
      if (low - 2 < room || low + Math.max(P.GAP, P.RUN * P.STEP - 2) > core - room) { out.push(`${Q2}: pair ${i}, its pit or its run reaches the image`); break; }
    }
    if (new Set(cells).size !== cells.length) out.push(`${Q2}: two probes are the same cell`);
    return out;
  },
  state(ctx) {
    ctx.ins('qP', 'DAT', 'F', '#0', `#${ctx.span - ctx.pc()}`);
    ctx.ins('qS0', 'SPL', 'B', '0', '0');
    ctx.ins('qS1', 'SPL', 'B', '-1', '0');
    ctx.ins('qJ', 'JMP', 'B', '-2', '0');
  },
  emit(ctx) {
    const { L, P, core } = ctx, qP = L('qP');
    const at = (offset) => `${qP}+${mod(offset, core)}`;
    for (let i = 0; i < P.PAIRS; i++) {
      ctx.ins(i ? '' : 'qScan', 'CMP', 'I', at(q2Low(P, i)), at(q2Low(P, i) + P.GAP));
      ctx.ins('', 'JMP', 'B', L(`qRung${i}`));
    }
    ctx.ins('qMiss', 'JMP', 'B', ctx.next);
    for (let i = P.PAIRS - 1; i > 0; i--) ctx.ins(`qRung${i}`, 'ADD', 'AB', `#${P.SPACING}`, qP);
    // The probe started on the image boundary; this rung takes it to one above the first low cell.
    ctx.ins('qRung0', 'ADD', 'AB', `#(${P.START + 1 - (ctx.span - ctx.pc())}+${qP})`, qP);
    ctx.ins('qPit', 'MOV', 'I', L('qJ'), `<${qP}`);
    ctx.ins('', 'MOV', 'I', L('qS1'), `<${qP}`);
    ctx.ins('', 'MOV', 'I', L('qS0'), `<${qP}`);
    ctx.ins('qRun', 'ADD', 'AB', `#${P.STEP}`, qP);
    ctx.ins('qBomb', 'MOV', 'I', L('qJ'), `@${qP}`);
    ctx.ins('qCount', 'DJN', 'B', L('qRun'), `#${P.RUN}`);
  },
  plant(api) {
    return [[api.at('qP') + q2Low(api.P, api.P.PAIRS - 1), MARKER]];
  },
  watch(api) {
    const { vm, P } = api, qP = api.at('qP'), scan = api.at('qScan'), miss = api.at('qMiss'), count = api.at('qCount');
    const cell = (offset) => vm.peek(api.norm(qP + offset));
    const writers = new Set([api.at('qPit'), api.at('qPit', 1), api.at('qPit', 2), api.at('qBomb')]);
    let hitPair, done = false, wrote = 0;
    return {
      before(pc) {
        if (pc === scan && hitPair === undefined) {
          hitPair = -1;
          for (let i = 0; i < P.PAIRS && hitPair < 0; i++) if (!api.same(cell(q2Low(P, i)), cell(q2Low(P, i) + P.GAP))) hitPair = i;
        }
        if (hitPair === undefined || done) return null;
        if (pc === miss) {
          if (hitPair >= 0) throw new Error(`${Q2}: it passed over a pair that differs`);
          if (vm.peek(qP).b !== api.code('qP').b) throw new Error(`${Q2}: it moved the probe without a find`);
          done = true;
          return null;
        }
        if (writers.has(pc)) return { pc };
        return pc === count ? { count: true } : null;
      },
      after(t) {
        if (!t) return;
        if (t.pc !== undefined) {
          const target = api.norm(qP + vm.peek(qP).b);
          if (api.inImage(target) && !api.inDead(target)) throw new Error(`${Q2}: it bombed its own image`);
          wrote++;
          return;
        }
        if (api.norm(vm.peek(count).b) !== 0) return;
        // The run is over: the pit sits on the low cell of the pair that differed, the run above it.
        done = true;
        if (hitPair < 0) throw new Error(`${Q2}: it attacked although every pair was equal`);
        const low = q2Low(P, hitPair);
        const is = (offset, label) => api.same(cell(offset), api.code(label));
        if (!is(low, 'qJ') || !is(low - 1, 'qS1') || !is(low - 2, 'qS0')) throw new Error(`${Q2}: no SPL 0 / SPL -1 / JMP -2 pit on the pair it found`);
        for (let k = 1; k <= P.RUN; k++) if (!is(low - 2 + k * P.STEP, 'qJ')) throw new Error(`${Q2}: JMP bomb ${k} of the run is missing`);
        if (!is(low + P.GAP, 'qJ')) throw new Error(`${Q2}: no bomb on the pair's high cell`);
        if (wrote !== 3 + P.RUN) throw new Error(`${Q2}: ${wrote} writes, not ${3 + P.RUN}`);
        if (api.norm(vm.peek(qP).b) !== api.norm(low - 2 + P.RUN * P.STEP)) throw new Error(`${Q2}: the probe is not on its last bomb`);
      },
      final() {
        if (hitPair !== undefined && !done) throw new Error(`${Q2}: it never handed on`);
      },
    };
  },
};

export default [probeBurst, bscanClear, scanReplicator, q2Stun];
