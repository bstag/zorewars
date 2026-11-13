// Three counted-copy LP papers. All share the tail every paper on the LP hill
// ends with: a head that resets the count, a backward copy through two
// predecrement pointers, `spl head` (a no-op once the eight slots are full) and
// a jump into the copy that is taken only if the copy's head arrived (its
// A-field, the count, is non-zero). What differs is the work each lap does
// beside the copy:
//
//   lp-stream-paper  lays its own carried DAT at a fixed stride
//   lp-step-paper    moves a remote cell to a target that steps by the SPL's B-field
//   lp-scan-paper    copies nothing until its scan finds a non-empty cell, then
//                    lays itself and a blank carpet over the find
//
// Offsets a copy inherits (the stream pointer, the step target, the scan
// pointer) are relative to the copy, so a lattice that misses the body of one
// copy misses the body of every copy: `mismatches` checks that once.
const wrap = (value, core) => ((value % core) + core) % core;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const lpOnly = (id, settings) => (settings.coreSize === 8000 && settings.maxProcesses === 8 && !settings.topology
  ? [] : [`${id} requires the 8,000-cell LP ring with eight process slots`]);

// Does offset + k * step (k >= 0) ever fall in [lo, hi] (offsets from the pointer's cell)?
function latticeHits(offset, step, lo, hi, core) {
  const g = gcd(step, core);
  for (let d = lo; d <= hi; d++) if (wrap(d - offset, core) % g === 0) return true;
  return false;
}

// Under a switch, a roaming process of the member that runs (a paper's copy, an imp) can execute the
// cell where a member not taken starts, and the gate then counts that member as entered. A block has
// really started only when a process runs its entry while its first instruction is still there.
const started = new WeakMap();
const sameShape = (a, b) => a.op === b.op && a.mod === b.mod && a.aMode === b.aMode && a.bMode === b.bMode;
function entryWatch(api, label) {
  const state = { entered: false }, entry = api.entry(), code = api.code(label);
  started.set(api, state);
  return { state, see(pc) { if (!state.entered && pc === entry && sameShape(api.vm.peek(pc), code)) state.entered = true; } };
}
const notStarted = (api) => !started.get(api)?.entered;

// Does the lattice reach a cell of the loaded image that still runs? `dead` (from the linker) lists
// the windows that no longer do once this block is entered: an opening that has handed on.
function reachesLive(offset, step, anchor, total, dead, core) {
  const g = gcd(step, core);
  for (let cell = 0; cell < total; cell++) {
    if (wrap(cell - anchor - offset, core) % g) continue;
    if (!(dead ?? []).some((w) => cell >= w.start && cell < w.start + w.size)) return true;
  }
  return false;
}

// Watches every copy: counts transfers into a copy whose head arrived, and
// those made with all eight slots in use (the SPL before them did nothing).
function transferWatch(api, { head, home, hop }) {
  const { vm, same, norm } = api;
  const headCode = api.code(head), homeCode = api.code(home), hopCode = api.code(hop);
  const like = (ins, code, field) => same({ ...ins, [field]: code[field] }, code);
  let full = -1;
  const seen = { transfers: 0, capped: 0, broken: 0 };
  return {
    seen,
    before(pc) {
      const ins = vm.peek(pc);
      if (same(ins, homeCode)) { full = vm.processes(0).length === api.settings.maxProcesses ? norm(pc + 1) : -1; return null; }
      if (!like(ins, hopCode, 'a')) return null;
      return { kind: 'hop', target: norm(pc + ins.a), capped: full === pc };
    },
    after(event) {
      if (event?.kind !== 'hop' || vm.processes(0).at(-1) !== event.target) return;
      if (!like(vm.peek(event.target), headCode, 'b')) { seen.broken++; return; }
      seen.transfers++;
      if (event.capped) seen.capped++;
    },
  };
}
const runningCode = (labels) => (api) => {
  if (notStarted(api)) return true;
  const code = labels.map((label) => api.code(label));
  return api.vm.processes(0).some((pc) => code.some((ins) => api.same(api.vm.peek(pc), ins)));
};
const inWindow = (address, start, size, core) => wrap(address - start, core) < size;

// ---------------------------------------------------------------------------
// lp-stream-paper: 8 cells.
const STREAM = ['seed', 'drop', 'aim', 'copy', 'test', 'home', 'hop', 'tail'];
const streamPaper = {
  id: 'lp-stream-paper',
  kind: 'body', exit: 'never', dialects: '94', processes: 1, grows: true, writes: 'sparse', roams: true,
  entry: 'seed', loop: 'drop',
  purpose: 'An 8-cell LP paper that carries a DAT: every lap of its counted copy (its own 8 cells, plus EXTRA cells after them as a carpet) also drops that DAT STRIDE further on, and it moves into the copy through an spl home that is a no-op at the cap and a jump guarded by the copy\'s head.',
  params: { HOP: [200, 7790], STRIDE: [1, 7999], FIRST: [1, 7999], EXTRA: [0, 32] },
  defaults: { HOP: 2376, STRIDE: 2912, FIRST: 2416, EXTRA: 0 },
  mutable: [['seed', ['b']], ['aim', ['b']], ['hop', ['a']]],
  mismatches(P, settings) {
    const out = lpOnly('lp-stream-paper', settings);
    if (out.length) return out;
    // aim is cell 2 of 8: the body is offsets -2..5 from it, in every copy.
    if (latticeHits(P.FIRST, P.STRIDE, -2, 5, settings.coreSize)) out.push('lp-stream-paper: its DAT stream reaches its own body (FIRST + k STRIDE)');
    return out;
  },
  linked(P, { coreSize }, label, { total, shiftedFrame, dead }) {
    if (shiftedFrame) return [];
    const aim = label('aim'), seed = label('seed');
    const out = [];
    if (reachesLive(P.FIRST, P.STRIDE, aim, total, dead, coreSize)) out.push('lp-stream-paper: its DAT stream reaches the rest of the warrior');
    for (let i = 0; i < 2 * (STREAM.length + P.EXTRA); i++) if (wrap(seed + P.HOP - STREAM.length - P.EXTRA + i, coreSize) < total) { out.push('lp-stream-paper: its first copies land on the warrior'); break; }
    return out;
  },
  emit({ ins, L, P }) {
    const n = STREAM.length + P.EXTRA;
    ins('seed', 'MOV', 'AB', `#${n}`, '#0');
    ins('drop', 'MOV', 'I', L('tail'), `@${L('aim')}`);
    ins('aim', 'ADD', 'AB', `#${P.STRIDE}`, `#${P.FIRST}`);
    ins('copy', 'MOV', 'I', `<${L('seed')}`, `{${L('hop')}`);
    ins('test', 'JMN', 'B', L('drop'), L('seed'));
    ins('home', 'SPL', 'B', L('seed'), '0');
    // The copy lands cell by cell below this pointer; it ends on the copy's head.
    ins('hop', 'JMN', 'A', `${P.HOP + n - 6}`, '*0');
    ins('tail', 'DAT', 'F', '#1', '#1');
  },
  running: runningCode(['drop', 'copy', 'test', 'home']),
  watch(api) {
    const { vm, at, P, norm, same } = api;
    const moves = transferWatch(api, { head: 'seed', home: 'home', hop: 'hop' }), real = entryWatch(api, 'seed');
    const aim = at('aim'), first = norm(at('seed') + P.HOP);
    let drops = 0, last = null, checked = false;
    return {
      before(pc) {
        real.see(pc);
        // Under a switch, a branch not taken (or not yet started) has nothing to account for.
        if (!real.state.entered || (api.entered && !api.entered())) return null;
        if (pc === at('drop') && same(vm.peek(pc), api.code('drop')) && vm.peek(aim).op === 'ADD' && same(vm.peek(at('tail')), api.code('tail'))) {
          return { kind: 'drop', target: norm(aim + vm.peek(aim).b) };
        }
        if (pc === at('hop') && !checked) {
          checked = true;
          // Exactly its own cells, at HOP: the head's count is spent, the stream pointer is as it was copied.
          STREAM.forEach((label, i) => {
            const cell = vm.peek(first + i), code = { ...api.code(label) };
            if (label === 'seed') code.b = 0;
            if (label === 'aim') code.b = cell.b;
            if (label === 'hop') code.a = norm(P.HOP + 1);
            if (!same(cell, code)) throw new Error(`lp-stream-paper: the first copy's ${label} is wrong`);
          });
        }
        return moves.before(pc);
      },
      after(event) {
        if (event?.kind !== 'drop') { moves.after(event); return; }
        const { target } = event;
        if (api.inSelf(target)) throw new Error('lp-stream-paper dropped its DAT on itself');
        if (vm.lastWrite[target] !== vm.steps || !same(vm.peek(target), api.code('tail'))) throw new Error('lp-stream-paper did not drop its carried DAT');
        if (last !== null && norm(target - last) !== P.STRIDE) throw new Error('lp-stream-paper left its stride');
        last = target; drops++;
      },
      final() {
        if (!real.state.entered) return;
        if (!checked || moves.seen.transfers < 1) throw new Error('lp-stream-paper never moved into a copy');
        if (!api.alone) return;
        if (drops < STREAM.length) throw new Error('lp-stream-paper dropped too few DATs');
        if (moves.seen.capped < 1) throw new Error('lp-stream-paper never moved on with its eight slots full');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// lp-step-paper: 7 cells.
const STEP = ['seed', 'hit', 'walk', 'copy', 'test', 'home', 'hop'];
const stepPaper = {
  id: 'lp-step-paper',
  kind: 'body', exit: 'never', dialects: '94', processes: 1, grows: true, writes: 'sparse', roams: true,
  entry: 'seed', loop: 'hit',
  purpose: 'A 7-cell LP paper whose lap moves the cell a remote post-increment pointer selects to a target that advances by STEP, the B-field of its own restart SPL (an arithmetic walk; lp-scatter-paper and lp-paper double their offsets instead, and lp-stream-paper drops a DAT it carries). It copies COUNT cells, so COUNT - 7 blank cells follow each copy as a carpet.',
  params: { HOP: [200, 7790], COUNT: [7, 40], STEP: [1, 7999], WRITE: [1, 7999], READ: [1, 7999] },
  defaults: { HOP: 5208, COUNT: 21, STEP: 2912, WRITE: 2416, READ: 4004 },
  mutable: [['seed', ['b']], ['hit', ['b']], ['hop', ['a']]],
  mismatches(P, settings) {
    const out = lpOnly('lp-step-paper', settings);
    if (out.length) return out;
    // hit is cell 1 of 7: the body is offsets -1..5 from it, in every copy.
    if (latticeHits(P.WRITE, P.STEP, -1, 5, settings.coreSize)) out.push('lp-step-paper: its stepped target reaches its own body (WRITE + k STEP)');
    if (wrap(P.READ + 1 + P.COUNT, settings.coreSize) < 2 * P.COUNT + 7) out.push('lp-step-paper: READ points into its own body or carpet');
    return out;
  },
  linked(P, { coreSize }, label, { total, shiftedFrame, dead }) {
    if (shiftedFrame) return [];
    const hit = label('hit'), seed = label('seed'), out = [];
    if (reachesLive(P.WRITE, P.STEP, hit, total, dead, coreSize)) out.push('lp-step-paper: its stepped target reaches the rest of the warrior');
    const copy = wrap(seed + P.HOP, coreSize), reader = wrap(hit + P.READ, coreSize);
    if (copy < total || copy + P.COUNT > coreSize) out.push('lp-step-paper: its first copy lands on the warrior');
    if (reader < total || inWindow(reader, copy - P.COUNT, 3 * P.COUNT, coreSize)) out.push('lp-step-paper: its read pointer sits in the warrior or its first copy');
    return out;
  },
  emit({ ins, L, P }) {
    ins('seed', 'MOV', 'AB', `#${P.COUNT}`, '#0');
    ins('hit', 'MOV', 'I', `>${P.READ}`, `${P.WRITE}`);
    ins('walk', 'ADD', 'B', L('home'), L('hit'));
    ins('copy', 'MOV', 'I', `<${L('seed')}`, `{${L('hop')}`);
    ins('test', 'JMN', 'B', L('hit'), L('seed'));
    ins('home', 'SPL', 'B', L('seed'), `${P.STEP}`);
    ins('hop', 'JMN', 'A', `${P.HOP + P.COUNT - 6}`, '*0');
  },
  running: runningCode(['walk', 'copy', 'test', 'home']),
  watch(api) {
    const { vm, at, P, norm, same } = api;
    const moves = transferWatch(api, { head: 'seed', home: 'home', hop: 'hop' }), real = entryWatch(api, 'seed');
    const hit = at('hit'), reader = norm(hit + P.READ), first = norm(at('seed') + P.HOP);
    let moved = 0, last = null, checked = false;
    return {
      before(pc) {
        real.see(pc);
        // Under a switch, a branch not taken (or not yet started) has nothing to account for.
        if (!real.state.entered || (api.entered && !api.entered())) return null;
        if (pc === hit && same({ ...vm.peek(hit), b: 0 }, { ...api.code('hit'), b: 0 }) && same(vm.peek(at('home')), api.code('home'))) {
          const from = norm(reader + vm.peek(reader).b);
          return { kind: 'hit', target: norm(hit + vm.peek(hit).b), value: vm.peek(from), from, pointer: vm.peek(reader).b };
        }
        if (pc === at('hop') && !checked) {
          checked = true;
          STEP.forEach((label, i) => {
            const cell = vm.peek(first + i), code = { ...api.code(label) };
            if (label === 'seed') code.b = 0;
            if (label === 'hit') code.b = cell.b;
            if (label === 'hop') code.a = cell.a;
            if (!same(cell, code)) throw new Error(`lp-step-paper: the first copy's ${label} is wrong`);
          });
        }
        return moves.before(pc);
      },
      after(event) {
        if (event?.kind !== 'hit') { moves.after(event); return; }
        const { target } = event;
        if (api.inSelf(target)) throw new Error('lp-step-paper moved a cell onto itself');
        if (vm.lastWrite[target] !== vm.steps || (event.from !== target && event.from !== reader && !same(vm.peek(target), event.value))) {
          throw new Error('lp-step-paper did not move the selected cell');
        }
        if (target !== reader && norm(vm.peek(reader).b - event.pointer) !== 1) throw new Error('lp-step-paper did not advance its read pointer');
        if (last !== null && norm(target - last) !== P.STEP) throw new Error('lp-step-paper left its arithmetic walk');
        last = target; moved++;
      },
      final() {
        if (!real.state.entered) return;
        if (!checked || moves.seen.transfers < 1) throw new Error('lp-step-paper never moved into a copy');
        if (!api.alone) return;
        if (moved < P.COUNT) throw new Error('lp-step-paper made too few moves');
        if (moves.seen.capped < 1) throw new Error('lp-step-paper never moved on with its eight slots full');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// lp-scan-paper: 8 cells.
const PLANTED = { op: 'SPL', mod: 'B', aMode: '$', a: 3, bMode: '$', b: 0 };
const SCAN = ['seed', 'seek', 'look', 'aim', 'copy', 'test', 'home', 'hop'];
const scanPaper = {
  id: 'lp-scan-paper',
  kind: 'body', exit: 'never', dialects: '94', processes: 1, grows: true, writes: 'sparse', roams: true,
  entry: 'seed', loop: 'seek',
  purpose: 'An 8-cell LP paper that scans (jmz.f, STEP apart, 0.5c) and copies only when it finds a non-empty cell: it then lays COUNT cells, its body and a blank carpet, so the carpet covers the find, restarts the scan at home and moves into the copy. Alone it never copies; no copy can find itself. Do not run it beside anything of ours that fills the core with non-empty cells (imps, papers, bombers with visible bombs, decoy makers): it finds them and copies onto them. Beside a quiet partner (a stone with DAT 0 bombs) STEP must share a factor with the core larger than the image.',
  params: { COUNT: [13, 45], STEP: [1, 7999], FIRST: [1, 7999] },
  defaults: { COUNT: 29, STEP: 3024, FIRST: 2408 },
  mutable: [['seed', ['b']], ['look', ['b']], ['hop', ['a']]],
  mismatches(P, settings) {
    const out = lpOnly('lp-scan-paper', settings);
    if (out.length) return out;
    const core = settings.coreSize, g = gcd(P.STEP, core);
    // look is cell 2 of 8: the body is offsets -2..5 from it, in every copy.
    if (latticeHits(P.FIRST, P.STEP, -2, 5, core)) out.push('lp-scan-paper: its scan finds its own body (FIRST + k STEP)');
    // A copy made for a find at T has its head at T + 5 - COUNT; the scan returns to T + m g.
    for (let d = 5 - P.COUNT; d <= 12 - P.COUNT; d++) if (wrap(d, core) % g === 0) { out.push('lp-scan-paper: its scan comes back to the body of the copy it made'); break; }
    // The copy's look is at T + 7 - COUNT with the same pointer: its lattice, seen from the maker's look.
    if (latticeHits(2 * P.FIRST + 7 - P.COUNT, P.STEP, -2, 5, core)) out.push('lp-scan-paper: a copy\'s scan finds the paper that made it');
    return out;
  },
  linked(P, { coreSize }, label, { total, shiftedFrame, dead }) {
    if (shiftedFrame) return [];
    return reachesLive(P.FIRST, P.STEP, label('look'), total, dead, coreSize) ? ['lp-scan-paper: its scan finds the rest of the warrior'] : [];
  },
  emit({ ins, L, P }) {
    ins('seed', 'MOV', 'AB', `#${P.COUNT}`, '#0');
    ins('seek', 'ADD', 'AB', `#${P.STEP}`, L('look'));
    ins('look', 'JMZ', 'F', L('seek'), `${P.FIRST}`);
    ins('aim', 'MOV', 'BA', L('look'), L('hop'));
    ins('copy', 'MOV', 'I', `<${L('seed')}`, `{${L('hop')}`);
    ins('test', 'JMN', 'B', L('copy'), L('seed'));
    ins('home', 'SPL', 'B', L('seed'), '0');
    ins('hop', 'JMN', 'A', '0', '*0');
  },
  running(api) {
    if (notStarted(api)) return true;
    const fixed = ['seek', 'copy', 'test', 'home'].map((label) => api.code(label)), look = { ...api.code('look'), b: 0 };
    return api.vm.processes(0).some((pc) => {
      const ins = api.vm.peek(pc);
      return fixed.some((code) => api.same(ins, code)) || api.same({ ...ins, b: 0 }, look);
    });
  },
  // A target on an early probe, clear of the warrior and of where the copy will land.
  plant(api) {
    const target = scanTarget(api);
    return target === null ? [] : [[target, { ...PLANTED }]];
  },
  watch(api) {
    const { vm, at, P, norm, same } = api;
    const moves = transferWatch(api, { head: 'seed', home: 'home', hop: 'hop' }), real = entryWatch(api, 'seed');
    const look = at('look'), planted = api.scenario === 'lp-scan-paper: planted target';
    const target = planted ? scanTarget(api) : null, head = target === null ? null : norm(target + 5 - P.COUNT);
    let probes = 0, next = norm(look + P.FIRST), found = false, laid = false, copies = 0;
    return {
      before(pc) {
        real.see(pc);
        // Under a switch, a branch not taken (or not yet started) has nothing to account for.
        if (!real.state.entered || (api.entered && !api.entered())) return null;
        const event = moves.before(pc);
        if (pc === at('copy') && same(vm.peek(pc), api.code('copy'))) copies++;
        if (pc === at('hop') && found && !laid) {
          laid = true;
          SCAN.forEach((label, i) => {
            const cell = vm.peek(head + i), code = { ...api.code(label) };
            if (label === 'seed') code.b = 0;
            if (label === 'look') code.b = cell.b;
            if (label === 'hop') code.a = cell.a;
            if (!same(cell, code)) throw new Error(`lp-scan-paper: the copy's ${label} is wrong`);
          });
          // The cells after the body (blank when the paper is the whole warrior) now cover the find.
          if (same(vm.peek(target), PLANTED)) throw new Error('lp-scan-paper: the carpet did not cover the find');
          if (api.total === SCAN.length) {
            for (let c = norm(head + SCAN.length); c !== norm(target + 5); c = norm(c + 1)) {
              const cell = vm.peek(c);
              if (cell.op !== 'DAT' || cell.a || cell.b) throw new Error('lp-scan-paper: the carpet is not blank');
            }
          }
        }
        if (pc !== look || !same({ ...vm.peek(look), b: 0 }, { ...api.code('look'), b: 0 }) || found) return event;
        next = norm(next + P.STEP);
        const probe = norm(look + vm.peek(look).b);
        if (probe !== next) throw new Error('lp-scan-paper left its scan lattice');
        if (api.inSelf(probe)) throw new Error('lp-scan-paper probed its own body');
        probes++;
        if (probe === target) found = true;
        return event;
      },
      after(event) { moves.after(event); },
      final() {
        if (!real.state.entered) return;
        if (api.alone && api.total === SCAN.length && (copies || vm.processes(0).length !== 1 || probes < 1000)) throw new Error('lp-scan-paper copied itself with nothing to find');
        if (!planted || target === null) return;
        if (!found || !laid || moves.seen.transfers < 1) throw new Error('lp-scan-paper did not copy itself onto the planted target');
        if (api.total === SCAN.length && vm.processes(0).length !== 2) throw new Error('lp-scan-paper: the paper and its copy should both be scanning');
      },
    };
  },
};

function scanTarget(api) {
  const { P, norm } = api, look = api.at('look');
  for (let k = 3; k < 400; k++) {
    const target = norm(look + P.FIRST + k * P.STEP);
    let clear = true;
    for (let d = 5 - P.COUNT - 2; d <= 6 && clear; d++) if (api.rel(norm(target + d), api.image.start) < api.total + 2) clear = false;
    if (clear) return target;
  }
  return null;
}

export default [streamPaper, stepPaper, scanPaper];
