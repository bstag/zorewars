// Defence, movement and sensor blocks (docs/block-algebra.md): a body that
// leaps away from an incoming clear, a stone that answers damage to its
// marker, a controller that keeps re-deploying a small worker, two partners
// that repair each other, a stream that damages numbers, and a bomb that
// reports where it was run. All written here; ring only.
//
// Some reactions only make sense after the block has set itself up (it plants
// its own sentinels, or copies its partner), so a plant made before the run
// would be overwritten. Those blocks' watches play the opponent themselves in
// the planted scenario: they poke the core at a set cycle (a clear's front
// moving at one cell every two cycles; a hit on the partner).

const FRONT = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 1 };   // a clear's DAT pass
const seqOp = (ctx) => (ctx.old ? 'CMP' : 'SEQ');
// Offset of a local label from the block's first cell.
const offsetOf = (api, local, first = 'first') => api.norm(api.at(local) - api.at(first));
const planted = (api, id) => api.scenario === `${id}: planted target`;
// Whether a label still holds this block's own instruction (a trigger may have rewritten it, or a hit).
const ours = (api, local) => api.same(api.vm.peek(api.at(local)), api.code(local));

// ---------------------------------------------------------------------------
// leap: watches a sentinel SENT cells beyond each end of the warrior; when a
// clear's front writes one, copies itself HOP away on the other side (behind
// the front) and carries on there. Meanwhile it runs a slow clear of its own
// over everything outside the warrior and its sentinels, which in time comes
// round to the low sentinel: the block then leaps backwards too, so it never
// meets its own clear. It moves alone: whatever else the warrior holds is
// left behind at the first leap.
const leap = {
  id: 'leap', kind: 'body', exit: 'never', processes: 1, writes: 'core', roams: true,
  purpose: 'Anti-clear: watches a sentinel SENT cells below and above the warrior; when a clear\'s front writes one, copies itself HOP cells the other way (behind the front) and runs there; meanwhile clears the core one cell per lap.',
  params: { SENT: [16, 200], HOP: [200, 20000] }, entry: 'first', loop: 'loop',
  provides: { datBomb: 'kill' },
  mutable: [['ptr', ['b']], ['dst', ['a', 'b']], ['src', ['b']], ['cnt', ['b']]],
  mismatches: (P, settings) => [
    ...(P.HOP < 2 * P.SENT + settings.maxLength + 100 ? ['leap: HOP must clear both sentinels and the copy'] : []),
    ...(P.HOP > settings.coreSize / 2 ? ['leap: HOP is more than half the core'] : []),
  ],
  emit(ctx) {
    const { L, P, old, total } = ctx, S = P.SENT, p = ctx.pc();
    // The sentinels sit SENT cells outside the whole warrior (p: this block's place in it).
    const lo = `${L('first')}-${p + S}`, hi = `${L('first')}+${total - 1 - p + S}`, size = `(${L('kill')}-${L('first')}+1)`;
    ctx.ins('first', 'MOV', 'I', L('mark'), lo);                       // plant both sentinels
    ctx.ins('', 'MOV', 'I', L('mark'), hi);
    ctx.ins('', 'MOV', 'AB', `#(${L('first')}+${total - p + S}-${L('ptr')})`, L('ptr'));   // our clear starts past the high one
    ctx.ins('loop', 'MOV', 'I', L('kill'), old ? `@${L('ptr')}` : `>${L('ptr')}`);
    if (old) ctx.ins('', 'ADD', 'AB', '#1', L('ptr'));
    ctx.ins('', seqOp(ctx), 'I', L('mark'), lo);
    ctx.ins('', 'JMP', 'B', L('back'));                                  // a front from below: leap back
    ctx.ins('', seqOp(ctx), 'I', L('mark'), hi);
    ctx.ins('', 'JMP', 'B', L('fwd'));                                   // from above: leap forward
    ctx.ins('', 'JMP', 'B', L('loop'));
    if (old) {
      // '88: copy down from the end (dst ends on the copy's first cell).
      ctx.ins('back', 'MOV', 'AB', `#(${L('first')}-${L('dst')}+${size}-${P.HOP})`, L('dst'));
      ctx.ins('', 'JMP', 'B', L('go'));
      ctx.ins('fwd', 'MOV', 'AB', `#(${L('first')}-${L('dst')}+${size}+${P.HOP})`, L('dst'));
      ctx.ins('go', 'MOV', 'AB', `#(${L('first')}-${L('src')}+${size})`, L('src'));
      ctx.ins('', 'MOV', 'AB', `#${size}`, L('cnt'));
      ctx.ins('copy', 'MOV', 'I', `<${L('src')}`, `<${L('dst')}`);
      ctx.ins('', 'DJN', 'B', L('copy'), L('cnt'));
      ctx.ins('jump', 'JMP', 'B', `@${L('dst')}`);
      ctx.ins('src', 'DAT', 'F', '#0', '#0');
    } else {
      // '94: copy up from the first cell, which the front reaches first.
      ctx.ins('back', 'MOV', 'AB', `#(${L('first')}-${L('dst')}-${P.HOP})`, L('dst'));
      ctx.ins('', 'JMP', 'B', L('go'));
      ctx.ins('fwd', 'MOV', 'AB', `#(${L('first')}-${L('dst')}+${P.HOP})`, L('dst'));
      ctx.ins('go', 'MOV', 'A', `#(${L('first')}-${L('dst')})`, L('dst'));
      ctx.ins('', 'MOV', 'AB', `#${size}`, L('cnt'));
      ctx.ins('copy', 'MOV', 'I', `}${L('dst')}`, `>${L('dst')}`);
      ctx.ins('', 'DJN', 'B', L('copy'), L('cnt'));
      ctx.ins('', 'SUB', 'AB', `#${size}`, L('dst'));
      ctx.ins('jump', 'JMP', 'B', `@${L('dst')}`);
    }
    ctx.ins('dst', 'DAT', 'F', '#0', '#0');
    ctx.ins('ptr', 'DAT', 'F', '#0', '#0');
    ctx.ins('cnt', 'DAT', 'F', '#0', '#0');
    ctx.ins('mark', 'DAT', 'F', '#0', '#1');
    ctx.ins('kill', 'DAT', 'F', '#0', '#0');
  },
};
// A whole copy of the leap at `start`, ignoring the cells that change as it runs.
function leapIntact(api, start) {
  const size = offsetOf(api, 'kill') + 1;
  const skip = new Set(leap.mutable.map(([l]) => offsetOf(api, l)).filter((x) => !Number.isNaN(x)));
  for (let i = 0; i < size; i++) {
    if (skip.has(i)) continue;
    if (!api.same(api.vm.peek(start + i), api.code('first', i))) return false;
  }
  return true;
}
function leapRunning(api) {
  const size = offsetOf(api, 'kill') + 1;
  return api.vm.processes(0).some((q) => {
    for (let i = 0; i < size; i++) if (api.same(api.vm.peek(q), api.code('first', i)) && leapIntact(api, q - i)) return true;
    return false;
  });
}
leap.running = leapRunning;
// Where its sentinels are, read from the two instructions that plant them.
const sentinels = (api) => [api.norm(api.at('first') + api.code('first', 0).b), api.norm(api.at('first') + 1 + api.code('first', 1).b)];
leap.plant = (api) => {
  // The trail of a clear's DAT pass, below the low sentinel; the watch moves its front on.
  const out = [];
  for (let k = 61; k <= 100; k++) out.push([sentinels(api)[0] - k, FRONT]);
  return out;
};
leap.watch = (api) => {
  const first0 = api.at('first'), size = offsetOf(api, 'kill') + 1;
  const jumpOff = offsetOf(api, 'jump'), dstOff = offsetOf(api, 'dst');
  const isPlanted = planted(api, 'leap'), [lo, hi] = sentinels(api);
  // The planted front starts 60 cells below the low sentinel and runs until it is 20 past the high one.
  const frontLen = api.norm(hi - lo) + 80, leaps = [];
  let base = first0, entered = null, front = api.norm(lo - 60), frontSteps = 0;
  return {
    before(pc) {
      if (entered === null && pc === api.entry()) entered = api.vm.cycle;
      // The planted scenario: a clear's front moves up one cell every two cycles.
      if (isPlanted && entered !== null && api.vm.cycle > entered + 20 && frontSteps < frontLen && api.vm.cycle % 2 === 0) {
        api.vm.poke(front, FRONT); front = api.norm(front + 1); frontSteps++;
      }
      if (pc === api.norm(base + jumpOff) && api.same(api.vm.peek(pc), api.code('jump'))) return api.norm(base + dstOff + api.vm.peek(base + dstOff).b);
      return null;
    },
    after(target) {
      if (target === null) return;
      if (!leapIntact(api, target)) throw new Error('leap: the copy it jumped to is not a whole copy');
      leaps.push(api.norm(target - base)); base = target;
    },
    final() {
      if (!api.alone && !isPlanted) return;
      if (!leaps.length) throw new Error(isPlanted ? 'leap: the front reached the sentinel but it never leapt' : 'leap: its own clear came round but it never leapt');
      if (leaps[0] !== api.norm(-api.P.HOP)) throw new Error('leap: it leapt towards the front instead of behind it');
      if (!leapRunning(api)) throw new Error('leap: no process runs a copy after the leap');
      if (isPlanted) {
        if (frontSteps < frontLen) throw new Error('leap: the planted front did not finish');
        if (api.vm.processes(0).some((q) => api.norm(q - first0) < size)) throw new Error('leap: a process stayed behind in the front\'s path');
      }
    },
  };
};

// ---------------------------------------------------------------------------
// sentinel-stone: a stone (a DAT every TSTEP cells, never inside the warrior)
// whose first cell is a marker. Each pass it compares the marker with a
// pristine copy; when it has been hit (by something arriving from below) it
// re-arms it and turns its bombs on that side: BURST DATs walking down from
// just below the warrior, then back to the stone.
const sentinelStone = {
  id: 'sentinel-stone', kind: 'body', exit: 'never', processes: 1, writes: 'sparse', roams: false, entryFirst: false,
  purpose: 'A stone (a DAT every TSTEP cells, skipping the warrior) that checks a marker at its low edge every pass; when it is hit it re-arms it and bombs the BURST cells below the warrior, the side the hit came from, then goes back to stoning.',
  params: { TSTEP: [1, 4000], BURST: [1, 400] }, entry: 'loop', loop: 'loop',
  provides: { datBomb: 'bomb' },
  mutable: [['bomb', ['a', 'b']], ['gate', ['b']], ['bptr', ['b']], ['cnt', ['b']]],
  emit(ctx) {
    const { L, P, old, total } = ctx, start = ctx.pc();
    const place = (label) => `${start}+(${L(label)}-${L('mark')})`;   // a label's place in the warrior
    ctx.ins('mark', 'JMP', 'B', '$1', '$1');                        // the marker (harmless if run: it jumps to loop)
    // The bomb's place in the warrior is kept beside its pointer (A in '94, a gate cell in '88).
    if (old) {
      ctx.ins('loop', 'ADD', 'AB', `#${P.TSTEP}`, L('bomb'));
      ctx.ins('', 'ADD', 'AB', `#${P.TSTEP}`, L('gate'));
      ctx.ins('guard', 'SLT', 'AB', `#${total - 1}`, L('gate'));
    } else {
      ctx.ins('loop', 'ADD', 'F', L('step'), L('bomb'));
      ctx.ins('guard', 'SLT', 'A', `#${total - 1}`, L('bomb'));
    }
    ctx.ins('', 'JMP', 'B', L('check'));                              // inside the warrior: no bomb
    ctx.ins('throw', 'MOV', 'I', L('bomb'), `@${L('bomb')}`);
    ctx.ins('check', seqOp(ctx), 'I', L('mark'), L('ref'));
    ctx.ins('', 'JMP', 'B', L('hit'));
    ctx.ins('', 'JMP', 'B', L('loop'));
    ctx.ins('hit', 'MOV', 'I', L('ref'), L('mark'));                 // re-arm the marker
    ctx.ins('aim', 'MOV', 'AB', `#-(${place('bptr')})`, L('bptr'));   // bptr: the warrior's first cell
    ctx.ins('', 'MOV', 'AB', `#${P.BURST}`, L('cnt'));
    ctx.ins('burst', 'MOV', 'I', L('bomb'), `<${L('bptr')}`);
    ctx.ins('', 'DJN', 'B', L('burst'), L('cnt'));
    ctx.ins('', 'JMP', 'B', L('loop'));
    ctx.ins('bptr', 'DAT', 'F', '#0', '#0');
    ctx.ins('cnt', 'DAT', 'F', '#0', '#0');
    ctx.ins('ref', 'JMP', 'B', '$1', '$1');                          // the marker as it should be
    if (old) ctx.ins('gate', 'DAT', 'F', '#0', `#(${place('bomb')})`);
    else ctx.ins('step', 'DAT', 'F', `#${P.TSTEP}`, `#${P.TSTEP}`);
    ctx.ins('bomb', 'DAT', 'F', old ? '#0' : `#(${place('bomb')})`, '#0');
  },
  plant: (api) => [[api.at('mark'), { op: 'DAT', mod: 'F', aMode: '#', a: 0, bMode: '#', b: 0 }]],
  watch(api) {
    const cells = new Set(), burst = new Set(), isPlanted = planted(api, 'sentinel-stone');
    let throwsAfterBurst = 0, rearmed = false;
    const imageStart = api.norm(api.at('bptr') + api.code('aim').a), total = api.code('guard').a + 1;
    const inFrame = (c) => api.norm(c - imageStart) < total, throwAt = api.at('throw'), burstAt = api.at('burst');
    return {
      before(pc) {
        if (pc === throwAt && ours(api, 'throw')) return ['throw', api.norm(api.at('bomb') + api.vm.peek(api.at('bomb')).b)];
        if (pc === burstAt && ours(api, 'burst')) return ['burst', api.norm(api.at('bptr') + api.vm.peek(api.at('bptr')).b - 1)];
        if (pc === api.at('hit') && ours(api, 'hit')) return ['hit'];
        return null;
      },
      after(t) {
        if (!t) return;
        if (t[0] === 'hit') {
          if (!api.same(api.vm.peek(api.at('mark')), api.vm.peek(api.at('ref')))) throw new Error('sentinel-stone: the marker was not re-armed');
          rearmed = true; return;
        }
        if (inFrame(t[1])) throw new Error(`sentinel-stone: a ${t[0]} hit the warrior`);
        if (t[0] === 'throw') { cells.add(t[1]); if (burst.size) throwsAfterBurst++; } else burst.add(t[1]);
      },
      final() {
        if (api.alone) {
          if (burst.size) throw new Error('sentinel-stone: it reacted with nothing hitting its marker');
          if (cells.size < 100) throw new Error('sentinel-stone: the stone bombs too few cells');
        }
        if (isPlanted) {
          if (burst.size !== api.P.BURST) throw new Error('sentinel-stone: the hit marker did not turn its bombs on the area below');
          for (let k = 1; k <= api.P.BURST; k++) if (!burst.has(api.norm(imageStart - k))) throw new Error('sentinel-stone: the burst missed the cells below the warrior');
          if (!rearmed) throw new Error('sentinel-stone: the marker was not re-armed');
          if (throwsAfterBurst < 100) throw new Error('sentinel-stone: it did not go back to stoning');
        }
      },
    };
  },
};

// ---------------------------------------------------------------------------
// worker-refresher: a controller that stays home and keeps a five-cell worker
// (a small stone that dies after LIFE bombs) at work elsewhere. At each
// destination it deploys a fresh copy REPEAT times, each one carrying on from
// the last one's bombs (a refresh repairs the worker's code); then it moves
// DSTEP on, skipping destinations whose bombs could reach the warrior. It
// waits out each worker's life, so there are never two.
const W = 5;                                     // worker: ADD, MOV, DJN, life counter, bomb
const workerReach = (P) => W - 1 + P.REPEAT * P.LIFE * P.WSTEP;
const workerRefresher = {
  id: 'worker-refresher', kind: 'body', exit: 'never', processes: 2, writes: 'sparse', roams: false,
  purpose: 'A controller that deploys a small stone worker (LIFE bombs WSTEP apart, then it dies) REPEAT times at each destination, each refresh carrying on where the last stopped, then moves DSTEP on; it skips destinations whose bombs could reach the warrior.',
  params: { DSTEP: [100, 20000], LIFE: [2, 200], WSTEP: [1, 200], REPEAT: [1, 8] }, entry: 'start', loop: 'start',
  provides: { datBomb: 'wb' },
  mutable: [['dptr', ['b']], ['gptr', ['b']], ['src', ['b']], ['dst', ['a', 'b']], ['cnt', ['b']], ['rep', ['b']], ['wb', ['b']]],
  mismatches: (P, settings) => (workerReach(P) + 200 >= settings.coreSize / 2 ? ["worker-refresher: the worker's reach is too long for this core"] : []),
  emit(ctx) {
    const { L, P, total } = ctx, R = workerReach(P);
    ctx.ins('start', 'ADD', 'AB', `#${P.DSTEP}`, L('dptr'));          // the next destination...
    ctx.ins('', 'ADD', 'AB', `#${P.DSTEP}`, L('gptr'));
    ctx.ins('', 'SLT', 'AB', `#${total - 1 + R}`, L('gptr'));         // ...unless its bombs could reach us
    ctx.ins('', 'JMP', 'B', L('start'));
    ctx.ins('', 'MOV', 'AB', '#0', L('wb'));                           // a new site: bombs start next to the worker
    ctx.ins('', 'MOV', 'AB', `#${P.REPEAT}`, L('rep'));
    ctx.ins('deploy', 'MOV', 'B', L('dptr'), L('dst'));
    ctx.ins('', 'ADD', 'AB', `#(${L('dptr')}-${L('dst')}+${W})`, L('dst'));
    ctx.ins('', 'MOV', 'AB', `#(${L('wb')}+1-${L('src')})`, L('src'));
    ctx.ins('', 'MOV', 'AB', `#${W}`, L('cnt'));
    ctx.ins('copy', 'MOV', 'I', `<${L('src')}`, `<${L('dst')}`);
    ctx.ins('', 'DJN', 'B', L('copy'), L('cnt'));
    ctx.ins('spl', 'SPL', 'B', `@${L('dst')}`);
    ctx.ins('', 'ADD', 'AB', `#${P.LIFE * P.WSTEP}`, L('wb'));        // the refresh carries on from here
    ctx.ins('', 'MOV', 'AB', `#${3 * P.LIFE}`, L('cnt'));             // wait out the worker's life
    ctx.ins('wait', 'DJN', 'B', L('wait'), L('cnt'));
    ctx.ins('', 'DJN', 'B', L('deploy'), L('rep'));
    ctx.ins('', 'JMP', 'B', L('start'));
    ctx.ins('dptr', 'DAT', 'F', '#0', '#0');
    const s = ctx.pc() - 1;                                            // dptr's place in the image
    ctx.ins('gptr', 'DAT', 'F', '#0', `#${s + R}`);
    ctx.ins('src', 'DAT', 'F', '#0', '#0');
    ctx.ins('dst', 'DAT', 'F', '#0', '#0');
    ctx.ins('cnt', 'DAT', 'F', '#0', '#0');
    ctx.ins('rep', 'DAT', 'F', '#0', '#0');
    // The worker, never run here.
    ctx.ins('w0', 'ADD', 'AB', `#${P.WSTEP}`, L('wb'));
    ctx.ins('', 'MOV', 'I', L('wb'), `@${L('wb')}`);
    ctx.ins('', 'DJN', 'B', L('w0'), L('wc'));
    ctx.ins('wc', 'DAT', 'F', '#0', `#${P.LIFE}`);
    ctx.ins('wb', 'DAT', 'F', '#0', '#0');
  },
};
// The first destination the controller will use.
const firstSite = (api) => {
  const R = workerReach(api.P);
  for (let k = 1; k < 1000; k++) {
    const d = api.norm(api.at('dptr') + k * api.P.DSTEP);
    let ok = true;
    for (let c = 0; c <= R && ok; c++) if (api.inImage(d + c)) ok = false;
    if (ok) return d;
  }
  return null;
};
workerRefresher.plant = (api) => {
  const d = firstSite(api);
  return Array.from({ length: W }, (_, i) => [d + i, { op: 'DAT', mod: 'F', aMode: '#', a: 7, bMode: '#', b: 7 }]);
};
workerRefresher.watch = (api) => {
  const P = api.P, R = workerReach(P), isPlanted = planted(api, 'worker-refresher');
  const plantedSite = isPlanted ? firstSite(api) : null;
  const sites = [];                                // { at, deploys, bombs: Set }
  let cur = null;
  return {
    before(pc) {
      if (pc === api.at('spl') && ours(api, 'spl')) return ['deploy', api.norm(api.at('dst') + api.vm.peek(api.at('dst')).b)];
      if (cur && pc === api.norm(cur.at + 1) && api.same(api.vm.peek(pc), api.code('w0', 1))) return ['bomb', api.norm(cur.at + 4 + api.vm.peek(cur.at + 4).b)];
      return null;
    },
    after(t) {
      if (!t) return;
      const [kind, at] = t;
      if (kind === 'deploy') {
        // Alone, every deploy must be a fresh copy; beside partners a bomb may land mid-copy, so only the planted site must be.
        const fresh = Array.from({ length: W - 1 }, (_, i) => api.same(api.vm.peek(at + i), api.code('w0', i))).every(Boolean);
        if (!fresh && (api.alone || at === plantedSite)) throw new Error('worker-refresher: a deployed worker is not a fresh copy');
        for (let c = 0; c <= R; c++) if (api.inImage(at + c)) throw new Error('worker-refresher: a worker was deployed where its bombs reach the warrior');
        if (!cur || cur.at !== at) sites.push(cur = { at, deploys: 0, bombs: new Set() });
        cur.deploys++;
      } else {
        if (api.inImage(at)) throw new Error('worker-refresher: a worker bombed the warrior');
        cur.bombs.add(at);
      }
    },
    final() {
      const done = sites.slice(0, -1);
      if (api.alone) {
        if (sites.length < 20) throw new Error('worker-refresher: it visited too few destinations');
        for (const s of done) {
          if (s.deploys !== P.REPEAT) throw new Error('worker-refresher: a destination was not refreshed REPEAT times');
          if (s.bombs.size !== P.REPEAT * P.LIFE) throw new Error('worker-refresher: refreshed workers did not carry on bombing where the last stopped');
        }
      }
      if (isPlanted) {
        const s = sites.find((x) => x.at === plantedSite);
        if (!s) throw new Error('worker-refresher: it never deployed over the damaged destination');
        if (s !== sites.at(-1) && s.bombs.size !== P.REPEAT * P.LIFE) throw new Error('worker-refresher: the worker over the damage did not do its work');
      }
    },
  };
};

// ---------------------------------------------------------------------------
// mutual-repair: copies itself half the core away and runs both copies. Each
// one walks the other's code a cell per lap, compares it with its own
// pristine template (a copy of the code that is never run) and restores any
// cell that differs. Each also runs a stone whose step divides half the core,
// so the two stones only ever hit each other's bomb cells.
// Limits: it repairs only code (not the partner's template), and damage to a
// cell the partner runs every lap kills that partner before the repair arrives.
const MR_SIZE = 33;   // setup 4, loop 11, template 11, data 7
const mutualRepair = {
  id: 'mutual-repair', kind: 'body', exit: 'never', processes: 2, writes: 'sparse', roams: true,
  purpose: 'Two copies half the core apart, each checking the other\'s code a cell per lap against its own pristine template and restoring what differs; each also drops a DAT every TSTEP cells.',
  params: { TSTEP: [40, 4000] }, entry: 'start', loop: 'top',
  provides: { datBomb: 'bomb' },
  mutable: [['bomb', ['b']], ['p', ['b']], ['q', ['b']], ['n', ['b']], ['src', ['b']], ['dst', ['b']], ['cnt', ['b']]],
  mismatches: (P, settings) => [
    ...((settings.coreSize / 2) % P.TSTEP ? [`mutual-repair: TSTEP must divide half the core (${settings.coreSize / 2})`] : []),
    ...(P.TSTEP < MR_SIZE ? [`mutual-repair: TSTEP must be at least its size (${MR_SIZE})`] : []),
  ],
  emit(ctx) {
    const { L, P } = ctx, start = ctx.pc();
    ctx.ins('start', 'MOV', 'I', `<${L('src')}`, `<${L('dst')}`);   // copy the whole block half the core away
    ctx.ins('', 'DJN', 'B', L('start'), L('cnt'));
    ctx.ins('', 'SPL', 'B', `${L('top')}+CORESIZE/2`);
    ctx.ins('', 'JMP', 'B', L('top'));
    // The loop, then its template: the same cells, with every address shifted to read the same.
    const loop = (R, label) => {
      ctx.ins(label('top'), 'ADD', 'AB', `#${P.TSTEP}`, R('bomb'));
      ctx.ins(label('throw'), 'MOV', 'I', R('bomb'), `@${R('bomb')}`);
      ctx.ins('', seqOp(ctx), 'I', `@${R('p')}`, `@${R('q')}`);        // the partner's cell is as it should be?
      ctx.ins(label('fix'), 'MOV', 'I', `@${R('p')}`, `@${R('q')}`);   // no: restore it from the template
      ctx.ins('', 'ADD', 'AB', '#1', R('p'));
      ctx.ins('', 'ADD', 'AB', '#1', R('q'));
      ctx.ins('', 'DJN', 'B', R('top'), R('n'));
      ctx.ins('', 'MOV', 'AB', `#(${L('tmpl')}-${L('p')})`, R('p'));
      ctx.ins('', 'MOV', 'AB', `#(${L('top')}-${L('q')}+CORESIZE/2)`, R('q'));
      ctx.ins('', 'MOV', 'AB', `#(${L('tmpl')}-${L('top')})`, R('n'));
      ctx.ins('', 'JMP', 'B', R('top'));
    };
    loop((x) => L(x), (x) => x);
    ctx.mark('tmpl');
    loop((x) => `(${L(x)}+${L('tmpl')}-${L('top')})`, () => '');
    ctx.ins('p', 'DAT', 'F', '#0', `#(${L('tmpl')}-${L('p')})`);
    ctx.ins('q', 'DAT', 'F', '#0', `#(${L('top')}-${L('q')}+CORESIZE/2)`);
    ctx.ins('n', 'DAT', 'F', '#0', `#(${L('tmpl')}-${L('top')})`);
    ctx.ins('src', 'DAT', 'F', '#0', `#(${L('bomb')}+1-${L('src')})`);
    ctx.ins('dst', 'DAT', 'F', '#0', `#(${L('bomb')}+1-${L('dst')}+CORESIZE/2)`);
    ctx.ins('cnt', 'DAT', 'F', '#0', `#(${L('bomb')}+1-${L('start')})`);
    ctx.ins('bomb', 'DAT', 'F', '#0', '#0');
    if (ctx.pc() - start !== MR_SIZE) throw new Error('mutual-repair: layout changed');
  },
};
mutualRepair.plant = () => [];        // the watch hits the partner once it exists
mutualRepair.watch = (api) => {
  const half = api.core / 2, C = offsetOf(api, 'tmpl', 'top');
  const top = api.at('top'), fixA = api.at('fix'), fixB = api.norm(fixA + half), throwAt = api.at('throw');
  const isPlanted = planted(api, 'mutual-repair');
  const hit = api.norm(fixA + half);                           // B's repair cell: only run when B finds damage
  let entered = null, struck = false, repairs = 0;
  const cells = new Set();
  const partnerOk = (shift) => { for (let i = 0; i < C; i++) if (!api.same(api.vm.peek(top + shift + i), api.code('tmpl', i))) return false; return true; };
  return {
    before(pc) {
      if (entered === null && pc === api.entry()) entered = api.vm.cycle;
      if (isPlanted && !struck && entered !== null && api.vm.cycle === entered + 400) {
        api.vm.poke(hit, { op: 'DAT', mod: 'F', aMode: '#', a: 9, bMode: '#', b: 9 }); struck = true;
      }
      if ((pc === fixA || pc === fixB) && api.same(api.vm.peek(pc), api.code('fix'))) repairs++;
      if (pc === throwAt && ours(api, 'throw')) return api.norm(api.at('bomb') + api.vm.peek(api.at('bomb')).b);
      return null;
    },
    after(t) { if (t !== null) cells.add(t); },
    final() {
      const procs = api.vm.processes(0);
      const inA = procs.some((q) => api.inSelf(q)), inB = procs.some((q) => api.inSelf(q - half));
      // A trigger may have taken A's process elsewhere; the end state is only checked while A's loop is its own.
      if (api.alone || (isPlanted && ours(api, 'top'))) {
        if (!inA || !inB) throw new Error('mutual-repair: a partner stopped running');
        if (!partnerOk(0) || !partnerOk(half)) throw new Error('mutual-repair: a partner\'s code differs from the template');
      }
      if (api.alone) {
        if (repairs) throw new Error('mutual-repair: it repaired something nothing had damaged');
        if (cells.size < 100) throw new Error('mutual-repair: the stone bombs too few cells');
      }
      if (isPlanted && !repairs) throw new Error('mutual-repair: the damaged partner was not repaired');
    },
  };
};

// ---------------------------------------------------------------------------
// numeric-disruptor: walks down the core from the warrior, subtracting AMT
// from both fields of every cell it passes (every cell but the warrior's
// own), lap after lap. Steps, pointers and counters in other code go wrong.
// As a body it streams forever; trigger it to hand on to a stronger phase.
const numericDisruptor = {
  id: 'numeric-disruptor', kind: 'body', exit: 'never', processes: 1, writes: 'core', roams: false,
  purpose: 'A stream that walks down the core subtracting AMT from both fields of every cell outside the warrior, lap after lap, so other code\'s steps, pointers and counters go wrong.',
  params: { AMT: [1, 4000] }, entry: 'loop', loop: 'loop',
  mutable: [['ptr', ['b']], ['cnt', ['b']]],
  emit(ctx) {
    const { L, P, total } = ctx, start = ctx.pc();
    ctx.ins('loop', 'SUB', 'F', L('dec'), `<${L('ptr')}`);
    ctx.ins('', 'DJN', 'B', L('loop'), L('cnt'));
    ctx.ins('', 'MOV', 'AB', `#${-(start + 5)}`, L('ptr'));           // back to the warrior's first cell
    ctx.ins('', 'MOV', 'AB', `#(CORESIZE-${total})`, L('cnt'));        // every cell but the warrior
    ctx.ins('', 'JMP', 'B', L('loop'));
    ctx.ins('ptr', 'DAT', 'F', '#0', `#${-(start + 5)}`);
    ctx.ins('cnt', 'DAT', 'F', '#0', `#(CORESIZE-${total})`);
    ctx.ins('dec', 'DAT', 'F', `#${P.AMT}`, `#${P.AMT}`);
  },
};
const ENEMY_STEP = { op: 'ADD', mod: 'AB', aMode: '#', a: 4, bMode: '$', b: 3 };
numericDisruptor.plant = (api) => [[api.at('loop') - 300, ENEMY_STEP]];
numericDisruptor.watch = (api) => {
  const seen = new Set(), loopAt = api.at('loop'), ptrAt = api.at('ptr'), A = api.P.AMT;
  const isPlanted = planted(api, 'numeric-disruptor'), target = api.norm(api.at('loop') - 300);
  let damaged = false;
  return {
    before(pc) {
      if (pc !== loopAt || !ours(api, 'loop')) return null;
      const t = api.norm(ptrAt + api.vm.peek(ptrAt).b - 1);
      return [t, api.vm.peek(t)];
    },
    after(tok) {
      if (!tok) return;
      const [t, was] = tok, now = api.vm.peek(t);
      if (api.inImage(t)) throw new Error('numeric-disruptor: it damaged the warrior');
      if (now.op !== was.op || api.norm(now.a - was.a + A) !== 0 || api.norm(now.b - was.b + A) !== 0) throw new Error('numeric-disruptor: a cell was not decremented by AMT');
      seen.add(t);
      if (t === target && now.op === 'ADD' && now.a !== 4) damaged = true;
    },
    final() {
      if (api.alone) {
        let outside = 0;
        for (let c = 0; c < api.core; c++) if (!api.inImage(c)) outside++;
        if (seen.size < outside) throw new Error('numeric-disruptor: a lap missed cells');
      }
      if (isPlanted && !damaged) throw new Error('numeric-disruptor: the planted step was not damaged');
    },
  };
};

// ---------------------------------------------------------------------------
// report-bomb: a stone whose bombs are `MOV.AB #(X - home), (receiver - X)`.
// An opponent that runs the bomb at X writes X's place into the receiver
// cell and carries on; the stone sees the report on its next pass and clears
// ATTACK cells from BACK below X, then goes back to bombing. STEP divides the
// core and is large enough that neither bombs nor the clear reach home.
const RB_SIZE = 16;
const reportBomb = {
  id: 'report-bomb', kind: 'body', exit: 'never', processes: 1, writes: 'sparse', roams: false, dialects: '94',
  purpose: 'A stone whose bombs report where they were run: an opponent running one writes its place into a receiver cell, and the stone then clears ATTACK cells from BACK below it before bombing on.',
  params: { STEP: [16, 4000], BACK: [0, 400], ATTACK: [1, 800] }, entry: 'loop', loop: 'loop',
  provides: { datBomb: 'kill' },
  mutable: [['rb', ['a', 'b']], ['rep', ['b']], ['aptr', ['b']], ['cnt', ['b']]],
  mismatches: (P, settings) => [
    ...(settings.coreSize % P.STEP ? [`report-bomb: STEP must divide the core (${settings.coreSize})`] : []),
    ...(P.STEP < P.BACK + RB_SIZE || P.STEP < P.ATTACK - P.BACK + RB_SIZE ? ['report-bomb: the clear around a report could reach home'] : []),
  ],
  emit(ctx) {
    const { L, P } = ctx, start = ctx.pc();
    ctx.ins('loop', 'ADD', 'F', L('step'), L('rb'));
    ctx.ins('throw', 'MOV', 'I', L('rb'), `*${L('rb')}`);
    ctx.ins('look', 'JMZ', 'B', L('loop'), L('rep'));                 // no report yet
    ctx.ins('', 'MOV', 'B', L('rep'), L('aptr'));                      // aptr: the reported cell, less BACK
    ctx.ins('', 'ADD', 'AB', `#(${L('rb')}-${L('aptr')}-${P.BACK})`, L('aptr'));
    ctx.ins('', 'MOV', 'AB', `#${P.ATTACK}`, L('cnt'));
    ctx.ins('atk', 'MOV', 'I', L('kill'), `>${L('aptr')}`);
    ctx.ins('', 'DJN', 'B', L('atk'), L('cnt'));
    ctx.ins('', 'MOV', 'AB', '#0', L('rep'));
    ctx.ins('', 'JMP', 'B', L('loop'));
    ctx.ins('step', 'DAT', 'F', `#${P.STEP}`, `#${-P.STEP}`);
    ctx.ins('rb', 'MOV', 'AB', '#0', `$(${L('rep')}-${L('rb')})`);   // A: where it lands; B: the receiver from there
    ctx.ins('rep', 'DAT', 'F', '#0', '#0');
    ctx.ins('aptr', 'DAT', 'F', '#0', '#0');
    ctx.ins('cnt', 'DAT', 'F', '#0', '#0');
    ctx.ins('kill', 'DAT', 'F', '#0', '#0');
    if (ctx.pc() - start !== RB_SIZE) throw new Error('report-bomb: layout changed');
  },
};
reportBomb.plant = (api) => {
  // An opponent ran a bomb at X0: its code is around X0 and the receiver holds X0.
  const X0 = api.norm(api.at('rb') + 5 * api.P.STEP), out = [];
  for (let k = -2; k <= 3; k++) if (k) out.push([X0 + k, ENEMY_STEP]);
  out.push([api.at('rep'), { op: 'DAT', mod: 'F', aMode: '#', a: 0, bMode: '#', b: 5 * api.P.STEP }]);
  return out;
};
reportBomb.watch = (api) => {
  const P = api.P, rbAt = api.at('rb'), repAt = api.at('rep'), aptrAt = api.at('aptr');
  const throws = new Set(), attacks = [], isPlanted = planted(api, 'report-bomb');
  let throwsAfter = 0;
  return {
    before(pc) {
      if (pc === api.at('throw') && ours(api, 'throw')) return ['throw', api.norm(rbAt + api.vm.peek(rbAt).a)];
      if (pc === api.at('atk') && ours(api, 'atk')) return ['atk', api.norm(aptrAt + api.vm.peek(aptrAt).b)];
      return null;
    },
    after(t) {
      if (!t) return;
      const [kind, x] = t;
      if (api.inSelf(x) && x !== rbAt) throw new Error(`report-bomb: a ${kind === 'atk' ? 'clear write' : 'bomb'} hit home`);
      if (kind === 'atk') { attacks.push(x); return; }
      if (x === rbAt) return;
      // Run where it landed, the bomb must write its own place into the receiver.
      const b = api.vm.peek(x);
      if (b.op !== 'MOV' || b.mod !== 'AB' || b.aMode !== '#' || api.norm(b.a) !== api.norm(x - rbAt) || api.norm(x + b.b) !== repAt) throw new Error('report-bomb: a bomb would not report its place');
      throws.add(x);
      if (attacks.length) throwsAfter++;
    },
    final() {
      if (api.alone) {
        if (attacks.length) throw new Error('report-bomb: it attacked with nothing reported');
        if (throws.size < 100) throw new Error('report-bomb: it bombs too few cells');
      }
      if (isPlanted) {
        const X0 = api.norm(rbAt + 5 * P.STEP);
        if (attacks.length !== P.ATTACK) throw new Error('report-bomb: the report did not start one attack of ATTACK cells');
        attacks.forEach((x, i) => { if (x !== api.norm(X0 - P.BACK + i)) throw new Error('report-bomb: the attack missed the reported place'); });
        if (ours(api, 'loop') && api.vm.peek(repAt).b !== 0) throw new Error('report-bomb: the receiver was not reset');
        if (throwsAfter < 100) throw new Error('report-bomb: it did not go back to bombing');
      }
    },
  };
};

const blocks = [leap, sentinelStone, workerRefresher, mutualRepair, numericDisruptor, reportBomb];
for (const b of blocks) b.defaults ??= Object.fromEntries(Object.entries(b.params).map(([k, [lo]]) => [k, lo]));
Object.assign(leap.defaults, { SENT: 40, HOP: 1000 });
Object.assign(sentinelStone.defaults, { TSTEP: 2381, BURST: 24 });
Object.assign(workerRefresher.defaults, { DSTEP: 2377, LIFE: 16, WSTEP: 7, REPEAT: 2 });
Object.assign(mutualRepair.defaults, { TSTEP: 40 });
Object.assign(numericDisruptor.defaults, { AMT: 1 });
Object.assign(reportBomb.defaults, { STEP: 40, BACK: 8, ATTACK: 32 });

export default blocks;
