// Two LP bombers that count their processes.
//
//   lp-imp-bomber       one process throws `mov.i #0,1` at two cells a lap (0.5c):
//                       an opponent process that runs one becomes an imp, which
//                       holds a slot and does nothing. A second process runs a
//                       DJN stream that breaks imp instructions it crosses, and
//                       IMPS 1 starts two plain imps of its own (4 processes).
//   lp-jmp-stone-clear  copies a stone and a clear away from the image, then
//                       sends five processes into the stone's four-line loop one
//                       round apart (so they act as one fast process, and four
//                       can be lost) and the last one into a forward DAT clear.
//
// Both bomb two lattices STEP apart through one pointer cell; `mismatches`
// refuses any lattice that reaches the block's own cells.
const wrap = (value, core) => ((value % core) + core) % core;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const lpOnly = (id, settings) => (settings.coreSize === 8000 && settings.maxProcesses === 8 && !settings.topology
  ? [] : [`${id} requires the 8,000-cell LP ring with eight process slots`]);
const onLattice = (offset, first, step, core) => wrap(offset - first, core) % gcd(step, core) === 0;
function latticeHits(first, step, lo, hi, core) {
  for (let d = lo; d <= hi; d++) if (onLattice(d, first, step, core)) return true;
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

// ---------------------------------------------------------------------------
// lp-imp-bomber
const impNames = (P) => ['go', 'step', 'one', 'two', 'back', ...(P.IMPS ? ['side', 'far', 'near'] : []), 'stream', 'aim', 'inc', 'ibomb'];
const impBomber = {
  id: 'lp-imp-bomber',
  kind: 'body', exit: 'never', dialects: '94', processes: (P) => (P.IMPS ? 4 : 2), writes: 'sparse', roams: true,
  entry: 'go',
  purpose: 'A 0.5c LP bomber (9 cells, 12 with IMPS 1) whose bomb is the imp instruction mov.i #0,1, thrown at two lattices STEP apart: a process that runs one becomes an imp. A second process runs a DJN stream below the bomber, re-armed each time a bomb lands on its pointer, and IMPS 1 starts two plain imps SPAN apart; 2 or 4 processes.',
  params: { STEP: [1, 7999], FIRST: [1, 7999], GAP: [1, 7999], GATE: [16, 4000], IMPS: [0, 1], SPAN: [200, 7700] },
  defaults: { STEP: 2912, FIRST: 2404, GAP: 1456, GATE: 60, IMPS: 1, SPAN: 3999 },
  mutable: [['aim', ['a', 'b']]],
  mismatches(P, settings) {
    const out = lpOnly('lp-imp-bomber', settings);
    if (out.length) return out;
    const core = settings.coreSize, names = impNames(P), aim = names.indexOf('aim'), lo = -aim, hi = names.length - 1 - aim;
    if (latticeHits(P.FIRST, P.STEP, lo, hi, core) || latticeHits(P.FIRST + P.GAP, P.STEP, lo, hi, core)) out.push('lp-imp-bomber: its bombs reach its own cells');
    if (!onLattice(-P.GATE, P.FIRST, P.STEP, core) && !onLattice(-P.GATE, P.FIRST + P.GAP, P.STEP, core)) {
      out.push('lp-imp-bomber: no bomb lands on the stream pointer (aim - GATE), so the stream would never be re-armed and would wrap onto the bomber');
    }
    // The stream takes as many turns as the bomber: four decrements a lap, core / gcd laps between re-arms.
    if (4 * core / gcd(P.STEP, core) > core - P.GATE - 2 * names.length) out.push('lp-imp-bomber: the stream wraps onto the bomber before it is re-armed (STEP shares too small a factor with the core)');
    return out;
  },
  linked(P, { coreSize }, label, { total, shiftedFrame, dead }) {
    if (shiftedFrame) return [];
    const aim = label('aim');
    // Cells that no longer run (an opening that handed on, a switch's other members) may be bombed.
    const live = (first) => {
      for (let cell = 0; cell < total; cell++) {
        if (onLattice(cell - aim, first, P.STEP, coreSize) && !(dead ?? []).some((w) => cell >= w.start && cell < w.start + w.size)) return true;
      }
      return false;
    };
    return live(P.FIRST) || live(P.FIRST + P.GAP) ? ['lp-imp-bomber: its bombs reach the rest of the warrior'] : [];
  },
  emit({ ins, L, P }) {
    ins('go', 'SPL', 'B', L(P.IMPS ? 'side' : 'stream'), '0');
    ins('step', 'ADD', 'F', L('inc'), L('aim'));
    ins('one', 'MOV', 'I', L('ibomb'), `@${L('aim')}`);
    ins('two', 'MOV', 'I', L('ibomb'), `*${L('aim')}`);
    ins('back', 'JMP', 'B', L('step'), '0');
    if (P.IMPS) {
      ins('side', 'MOV', 'I', L('ibomb'), `${L('ibomb')}+${P.SPAN}`);
      ins('far', 'SPL', 'B', `${L('ibomb')}+${P.SPAN}`, '0');
      ins('near', 'SPL', 'B', L('ibomb'), '0');
    }
    ins('stream', 'DJN', 'F', '#0', `<${L('aim')}-${P.GATE}`);
    ins('aim', 'DAT', 'F', `#${P.FIRST + P.GAP}`, `#${P.FIRST}`);
    ins('inc', 'DAT', 'F', `#${P.STEP}`, `#${P.STEP}`);
    ins('ibomb', 'MOV', 'I', '#0', '1');
  },
  running(api) {
    if (notStarted(api)) return true;
    const imp = api.code('ibomb');
    return api.vm.processes(0).some((pc) => api.inSelf(pc) || api.same(api.vm.peek(pc), imp));
  },
  watch(api) {
    const { vm, at, P, norm, same } = api;
    const aim = at('aim'), pointer = norm(aim - P.GATE), imp = api.code('ibomb'), real = entryWatch(api, 'go');
    const intact = () => ['step', 'one', 'two', 'inc', 'ibomb'].every((label) => same(vm.peek(at(label)), api.code(label))) && vm.peek(aim).op === 'DAT';
    const last = { one: null, two: null }, cells = new Set();
    let rearms = 0, streamed = 0, impSteps = 0;
    return {
      before(pc) {
        real.see(pc);
        if (!real.state.entered) return null;
        if ((pc === at('one') || pc === at('two')) && intact()) {
          const kind = pc === at('one') ? 'one' : 'two';
          return { kind, target: norm(aim + (kind === 'one' ? vm.peek(aim).b : vm.peek(aim).a)) };
        }
        if (pc === at('stream') && same(vm.peek(pc), api.code('stream'))) {
          return { kind: 'stream', target: norm(pointer + vm.peek(pointer).b - 1) };
        }
        if (!api.inSelf(pc) && same(vm.peek(pc), imp)) impSteps++;
        return null;
      },
      after(event) {
        if (!event) return;
        const { target } = event;
        if (event.kind === 'stream') {
          if (api.inSelf(target)) throw new Error('lp-imp-bomber: the stream reached the bomber');
          if (vm.lastWrite[target] !== vm.steps) throw new Error('lp-imp-bomber: the stream did not decrement its cell');
          streamed++;
          return;
        }
        if (api.inSelf(target)) throw new Error('lp-imp-bomber bombed itself');
        if (vm.lastWrite[target] !== vm.steps || !same(vm.peek(target), imp)) throw new Error('lp-imp-bomber did not throw its imp instruction');
        if (last[event.kind] !== null && norm(target - last[event.kind]) !== P.STEP) throw new Error('lp-imp-bomber left its lattice');
        last[event.kind] = target; cells.add(target);
        if (target === pointer) rearms++;
      },
      final() {
        if (!real.state.entered || !api.alone) return;
        if (cells.size < 2 * (api.core / gcd(P.STEP, api.core)) - 2) throw new Error('lp-imp-bomber did not cover its two lattices');
        if (!rearms || streamed < 1000) throw new Error('lp-imp-bomber: the stream was not re-armed');
        if (P.IMPS && impSteps < 1000) throw new Error('lp-imp-bomber: its own imps did not run');
        if (api.total !== impNames(P).length) return;
        // A process that runs a bomb becomes an imp: a one-line opponent sitting on the lattice.
        const cell = norm(aim + P.FIRST + 9 * P.STEP);
        const duel = api.duel('JMP 0', { offset: norm(cell - api.image.start), cycles: 600 });
        const theirs = duel.vm.processes(1);
        if (!duel.theirs || theirs.length !== 1 || theirs[0] === cell || !same(duel.vm.peek(theirs[0]), imp)) {
          throw new Error('lp-imp-bomber: a bombed process did not become an imp');
        }
      },
    };
  },
};

// ---------------------------------------------------------------------------
// lp-jmp-stone-clear
const PAYLOAD = ['adv', 'hurl', 'hur2', 'back', 'ptr', 'jbomb', 'cur', 'wipe', 'loop', 'kill'];
const WORKERS = 5;
const stoneClear = {
  id: 'lp-jmp-stone-clear',
  kind: 'body', exit: 'never', dialects: '94', processes: WORKERS + 1, writes: 'core', roams: true,
  entry: 'boot',
  purpose: 'Boots a jmp # stone HOP cells away and a DAT clear CHOP beyond it (SPLIT 1, 22 cells; SPLIT 0 copies them as one block, 18 cells), then starts five processes one round apart in the four-line stone loop (two bombs a lap on lattices STEP apart, 0.5c; five in four lines keep the order of one process) and jumps the sixth into a one-process forward clear that steps over itself.',
  params: { HOP: [200, 7780], STEP: [1, 7999], FIRST: [1, 7999], GAP: [1, 7999], SPLIT: [0, 1], CHOP: [200, 7600] },
  defaults: { HOP: 3170, STEP: 2912, FIRST: 2408, GAP: 1456, SPLIT: 1, CHOP: 712 },
  mutable: [['s1', ['b']], ['last', ['b']]],
  mismatches(P, settings) {
    const out = lpOnly('lp-jmp-stone-clear', settings);
    if (out.length) return out;
    // ptr is cell 4 of the 10 copied; the copied launch line sits one below them.
    if (latticeHits(P.FIRST, P.STEP, -5, 5, settings.coreSize) || latticeHits(P.FIRST + P.GAP, P.STEP, -5, 5, settings.coreSize)) {
      out.push('lp-jmp-stone-clear: the stone bombs its own loop or its clear');
    }
    // SPLIT 1: the clear's four cells sit CHOP further on than they would beside the stone.
    if (P.SPLIT && (latticeHits(P.FIRST, P.STEP, P.CHOP + 2, P.CHOP + 5, settings.coreSize) || latticeHits(P.FIRST + P.GAP, P.STEP, P.CHOP + 2, P.CHOP + 5, settings.coreSize))) {
      out.push('lp-jmp-stone-clear: the stone bombs its separate clear');
    }
    // One process in six, two turns a cell: the clear must not come round to the stone within a round.
    if (P.SPLIT && settings.coreSize - P.CHOP - 16 < settings.maxCycles / 12 + 64) out.push('lp-jmp-stone-clear: CHOP is so large that the clear reaches the stone within a round');
    return out;
  },
  linked(P, { coreSize }, label, { total, shiftedFrame }) {
    if (shiftedFrame) return [];
    const low = wrap(label('adv') + P.HOP - 1, coreSize), clear = wrap(label('cur') + P.HOP + P.CHOP, coreSize);
    const out = low < total + 8 || low + PAYLOAD.length + 8 > coreSize ? ['lp-jmp-stone-clear: HOP puts the copy on the warrior'] : [];
    if (P.SPLIT && (clear < total + 8 || clear + 12 > coreSize)) out.push('lp-jmp-stone-clear: CHOP puts the clear on the warrior');
    return out;
  },
  emit({ ins, L, P, mark }) {
    const far = P.SPLIT ? P.HOP + P.CHOP : P.HOP;
    // SPLIT 1: the clear goes to its own place, a cell at a time, before the loop copies the stone.
    if (P.SPLIT) for (const cell of ['cur', 'wipe', 'loop', 'kill']) ins(cell === 'cur' ? 'boot' : '', 'MOV', 'I', L(cell), `${L(cell)}+${far}`);
    else mark('boot');
    ins('copy', 'MOV', 'I', `<${L('last')}`, `<${L('s1')}`);
    ins('more', 'JMN', 'B', L('copy'), L('last'));
    // The first launch line's B-field is the destination pointer; the jump's is the count.
    ins('s1', 'SPL', 'B', `${L('adv')}+${P.HOP}`, `#${L(P.SPLIT ? 'jbomb' : 'kill')}-${L('s1')}+${P.HOP + 1}`);
    for (let i = 2; i <= WORKERS; i++) ins(`s${i}`, 'SPL', 'B', `${L('adv')}+${P.HOP}`, '0');
    ins('last', 'JMP', 'B', `${L('wipe')}+${far}`, `#${(P.SPLIT ? 6 : PAYLOAD.length) + 1}`);
    ins('adv', 'ADD', 'F', L('jbomb'), L('ptr'));
    ins('hurl', 'MOV', 'I', L('jbomb'), `@${L('ptr')}`);
    ins('hur2', 'MOV', 'I', L('jbomb'), `*${L('ptr')}`);
    ins('back', 'JMP', 'B', L('adv'), '0');
    ins('ptr', 'DAT', 'F', `#${P.FIRST + P.GAP}`, `#${P.FIRST}`);
    ins('jbomb', 'JMP', 'B', `#${P.STEP}`, `${P.STEP}`);
    ins('cur', 'DAT', 'F', '#0', '#4');
    ins('wipe', 'MOV', 'I', L('kill'), `>${L('cur')}`);
    ins('loop', 'JMP', 'B', L('wipe'), '0');
    ins('kill', 'DAT', 'F', '#0', '#4');
  },
  running(api) {
    if (notStarted(api)) return true;
    const start = api.norm(api.at('adv') + api.P.HOP);
    return api.vm.processes(0).some((pc) => api.rel(pc, start) < 4);
  },
  watch(api) {
    const { vm, at, P, norm, same } = api;
    const clearCells = ['cur', 'wipe', 'loop', 'kill'];
    const there = (label) => norm(at(label) + P.HOP + (P.SPLIT && clearCells.includes(label) ? P.CHOP : 0));
    const start = there('adv'), ptr = there('ptr'), cur = there('cur');
    const bomb = api.code('jbomb'), real = entryWatch(api, 'boot');
    const last = { hurl: null, hur2: null }, bombed = new Set(), cleared = new Set();
    let booted = false, lastClear = null;
    return {
      before(pc) {
        real.see(pc);
        if (!real.state.entered) return null;
        if (pc === at('s1') && !booted) {
          booted = true;
          PAYLOAD.forEach((label) => {
            if (!same(vm.peek(there(label)), api.code(label))) throw new Error(`lp-jmp-stone-clear: ${label} was not copied`);
          });
        }
        if (!booted) return null;
        if ((pc === there('hurl') || pc === there('hur2')) && vm.peek(ptr).op === 'DAT' && same(vm.peek(there('jbomb')), bomb)) {
          const kind = pc === there('hurl') ? 'hurl' : 'hur2';
          return { kind, target: norm(ptr + (kind === 'hurl' ? vm.peek(ptr).b : vm.peek(ptr).a)) };
        }
        if (pc === there('wipe') && same(vm.peek(pc), api.code('wipe'))) return { kind: 'clear', target: norm(cur + vm.peek(cur).b) };
        return null;
      },
      after(event) {
        if (!event) return;
        const { target } = event, own = api.rel(target, start) < 6 || api.rel(target, cur) < 4;
        if (event.kind === 'clear') {
          if (api.rel(target, there('wipe')) < 3) throw new Error('lp-jmp-stone-clear: the clear hit itself');
          if (vm.lastWrite[target] !== vm.steps || vm.peek(target).op !== 'DAT') throw new Error('lp-jmp-stone-clear: the clear lost a write');
          cleared.add(target); lastClear = vm.steps;
          return;
        }
        if (own) throw new Error('lp-jmp-stone-clear: the stone bombed its own copy');
        if (vm.lastWrite[target] !== vm.steps || !same(vm.peek(target), bomb)) throw new Error('lp-jmp-stone-clear: the stone did not throw its jmp bomb');
        // Five processes in four lines: every ADD is followed by exactly one of each throw.
        if (api.alone && bombed.size < 400 && last[event.kind] !== null && norm(target - last[event.kind]) !== P.STEP) {
          throw new Error('lp-jmp-stone-clear: the five workers fell out of step');
        }
        last[event.kind] = target; bombed.add(target);
      },
      final() {
        if (!real.state.entered) return;
        if (!booted) throw new Error('lp-jmp-stone-clear never finished its boot');
        if (!api.alone) return;
        const queue = vm.processes(0);
        const workers = queue.filter((pc) => api.rel(pc, start) < 4).length, clearing = queue.filter((pc) => api.rel(pc, there('wipe')) < 2).length;
        if (queue.length !== WORKERS + 1 || workers !== WORKERS || clearing !== 1) throw new Error('lp-jmp-stone-clear: not five workers and one clear at the end');
        if (bombed.size < 2 * (api.core / gcd(P.STEP, api.core)) - 2) throw new Error('lp-jmp-stone-clear: the stone did not cover its two lattices');
        if (cleared.size < 4000 || vm.steps - lastClear > 2 * (WORKERS + 1)) throw new Error('lp-jmp-stone-clear: the clear stopped');
      },
    };
  },
};

export default [impBomber, stoneClear];
