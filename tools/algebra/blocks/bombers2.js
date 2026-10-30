// Stones that look after themselves, and a moat against vampires
// (docs/block-algebra.md): a stone that leaves when bombs land beside it, a
// stone that repairs its own loop from a pristine template, and a sweeper
// that wipes foreign cells around the warrior and, in '94, bombs the pit a
// fang points at. All written here; ring only.
//
// The two stones are guarded: their pointer's A-field (a count cell in '88)
// holds the target's index in a window around the code, and a target inside
// the window is skipped, so any STEP is safe and their own bombs never set off
// their own reactions.

const DAT0 = { op: 'DAT', mod: 'F', aMode: '#', a: 0, bMode: '#', b: 0 };
const STRIKE = { op: 'DAT', mod: 'F', aMode: '#', a: 9, bMode: '#', b: 9 };
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const seqOp = (ctx) => (ctx.old ? 'CMP' : 'SEQ');
const planted = (api, id) => api.scenario === `${id}: planted target`;
const ours = (api, local) => api.same(api.vm.peek(api.at(local)), api.code(local));
const reach = (id, P, settings) => (settings.coreSize / gcd(P.STEP, settings.coreSize) < 100
  ? [`${id}: STEP ${P.STEP} reaches only ${settings.coreSize / gcd(P.STEP, settings.coreSize)} cells of the core`] : []);
// A label's index in the whole warrior, as an expression (start: the index of `from`).
const place = (ctx, start, label, from) => `(${start}+(${ctx.L(label)}-${ctx.L(from)}))`;

// The guarded throw both stones share. The window is WIN cells from index LO
// of the warrior (LO may be negative); the first bomb lands just past it.
//   '94: ADD.F inc, ptr / SLT.A #WIN-1, ptr / JMP skip / throw MOV.I bomb, @ptr
//   '88: ADD #STEP, ptr / ADD #STEP, pos / SLT #WIN-1, pos / JMP skip / throw MOV bomb, @ptr
function guardedThrow(ctx, R, lab, win, skip) {
  const { P, old } = ctx;
  if (old) {
    ctx.ins(lab('top'), 'ADD', 'AB', `#${P.STEP}`, R('ptr'));
    ctx.ins('', 'ADD', 'AB', `#${P.STEP}`, R('pos'));
    ctx.ins('', 'SLT', 'AB', `#${win - 1}`, R('pos'));
  } else {
    ctx.ins(lab('top'), 'ADD', 'F', R('inc'), R('ptr'));
    ctx.ins('', 'SLT', 'A', `#${win - 1}`, R('ptr'));
  }
  ctx.ins('', 'JMP', 'B', R(skip));
  ctx.ins(lab('throw'), 'MOV', 'I', R('bomb'), `@${R('ptr')}`);
}
// The pointer cells, at the current pc: ptr (and pos in '88; inc in '94).
function guardedData(ctx, lo, win) {
  const { P, old } = ctx, ptrAt = ctx.pc();
  const idx0 = win - P.STEP, b0 = lo + win - ptrAt - P.STEP;   // after one ADD: index win, the cell just past the window
  ctx.ins('ptr', 'DAT', 'F', `#${old ? 0 : idx0}`, `#${b0}`);
  if (old) ctx.ins('pos', 'DAT', 'F', '#0', `#${idx0}`);
  else ctx.ins('inc', 'DAT', 'F', `#${P.STEP}`, `#${P.STEP}`);
}

// ---------------------------------------------------------------------------
// bomb-dodger: a guarded stone with a sentinel SENT cells below and above the
// warrior. Each pass it compares both with its marker; when either has been
// hit, it copies itself HOP cells on and jumps to the copy, which plants its
// own sentinels and carries on with the same pointer. Its bombs skip the
// window from sentinel to sentinel, so alone it never moves. It moves alone:
// partners are left behind.
const dodger = {
  id: 'bomb-dodger', kind: 'body', exit: 'never', processes: 1, writes: 'sparse', roams: true, moves: true,
  purpose: 'A guarded stone (a DAT every STEP cells, never between its sentinels) that checks a sentinel SENT cells below and above the warrior every pass; when one is hit it copies itself HOP cells on and carries on bombing from there.',
  params: { STEP: [1, 4000], SENT: [4, 100], HOP: [200, 20000] }, entry: 'first', loop: 'top',
  provides: { datBomb: 'bomb' },
  mutable: (P) => [['dst', ['a', 'b']], ['cnt', ['b']], ['ptr', ['a', 'b']], ['pos', ['b']], ['src', ['b']]],
  mismatches: (P, settings) => {
    const room = settings.maxLength + 2 * P.SENT + 10;
    return [
      ...reach('bomb-dodger', P, settings),
      ...(P.HOP < room || P.HOP > settings.coreSize - room ? ['bomb-dodger: HOP would put the copy on its own window'] : []),
    ];
  },
  emit(ctx) {
    const { L, P, old, total } = ctx, S = P.SENT, p = ctx.pc(), win = total + 2 * S;
    const lo = `${L('first')}-${p + S}`, hi = `${L('first')}+${total - 1 - p + S}`, size = `(${L('bomb')}-${L('first')}+1)`;
    ctx.ins('first', 'MOV', 'I', L('mark'), lo);                    // plant both sentinels
    ctx.ins('', 'MOV', 'I', L('mark'), hi);
    guardedThrow(ctx, L, (x) => x, win, 'check');
    ctx.ins('check', seqOp(ctx), 'I', L('mark'), lo);
    ctx.ins('', 'JMP', 'B', L('dodge'));
    ctx.ins('', seqOp(ctx), 'I', L('mark'), hi);
    ctx.ins('', 'JMP', 'B', L('dodge'));
    ctx.ins('', 'JMP', 'B', L('top'));
    if (old) {
      // '88: copy down from the end; dst ends on the copy's first cell.
      ctx.ins('dodge', 'MOV', 'AB', `#(${L('first')}-${L('dst')}+${size}+${P.HOP})`, L('dst'));
      ctx.ins('', 'MOV', 'AB', `#(${L('first')}-${L('src')}+${size})`, L('src'));
      ctx.ins('', 'MOV', 'AB', `#${size}`, L('cnt'));
      ctx.ins('copy', 'MOV', 'I', `<${L('src')}`, `<${L('dst')}`);
      ctx.ins('', 'DJN', 'B', L('copy'), L('cnt'));
      ctx.ins('jump', 'JMP', 'B', `@${L('dst')}`);
      ctx.ins('src', 'DAT', 'F', '#0', '#0');
    } else {
      // '94: copy up from the first cell.
      ctx.ins('dodge', 'MOV', 'AB', `#(${L('first')}-${L('dst')}+${P.HOP})`, L('dst'));
      ctx.ins('', 'MOV', 'A', `#(${L('first')}-${L('dst')})`, L('dst'));
      ctx.ins('', 'MOV', 'AB', `#${size}`, L('cnt'));
      ctx.ins('copy', 'MOV', 'I', `}${L('dst')}`, `>${L('dst')}`);
      ctx.ins('', 'DJN', 'B', L('copy'), L('cnt'));
      ctx.ins('', 'SUB', 'AB', `#${size}`, L('dst'));
      ctx.ins('jump', 'JMP', 'B', `@${L('dst')}`);
    }
    ctx.ins('dst', 'DAT', 'F', '#0', '#0');
    ctx.ins('cnt', 'DAT', 'F', '#0', '#0');
    guardedData(ctx, -S, win);
    ctx.ins('mark', 'DAT', 'F', '#0', '#1');
    ctx.ins('bomb', 'DAT', 'F', '#0', '#0');
  },
};
// Where each copy is, for `running`: the watch keeps it here.
const dodgerBase = new WeakMap();
const dodgerSize = (api) => api.norm(api.at('bomb') - api.at('first')) + 1;
dodger.running = (api) => {
  const base = dodgerBase.get(api) ?? api.at('first'), size = dodgerSize(api);
  return api.vm.processes(0).some((q) => api.norm(q - base) < size);
};
dodger.plant = (api) => [[api.at('first') + api.code('first').b, DAT0, 400]];   // a bomb on the low sentinel, once it is set
dodger.watch = (api) => {
  const off = (label) => api.norm(api.at(label) - api.at('first')), size = dodgerSize(api);
  const loOff = api.code('first').b, hiOff = 1 + api.code('first', 1).b, mark = api.code('mark');
  const skip = new Set(dodger.mutable(api.P).map(([l]) => off(l)).filter((x) => !Number.isNaN(x)));
  const isPlanted = planted(api, 'bomb-dodger'), strict = api.alone || isPlanted;
  let base = api.at('first'), bombs = 0, bombsHere = 0;
  const leaps = [];
  dodgerBase.set(api, base);
  const addr = (label) => api.norm(base + off(label));
  const hit = () => !api.same(api.vm.peek(base + loOff), mark) || !api.same(api.vm.peek(base + hiOff), mark);
  const intact = (at) => { for (let i = 0; i < size; i++) if (!skip.has(i) && !api.same(api.vm.peek(at + i), api.code('first', i))) return false; return true; };
  return {
    before(pc) {
      if (pc === addr('throw') && api.same(api.vm.peek(pc), api.code('throw'))) return ['throw', api.norm(addr('ptr') + api.vm.peek(addr('ptr')).b)];
      if (pc === addr('dodge') && api.same(api.vm.peek(pc), api.code('dodge')) && !hit()) throw new Error('bomb-dodger: it moved with nothing hitting its sentinels');
      if (pc === addr('jump') && api.same(api.vm.peek(pc), api.code('jump'))) return ['jump', api.norm(addr('dst') + api.vm.peek(addr('dst')).b)];
      return null;
    },
    after(t) {
      if (!t) return;
      const [kind, at] = t;
      if (kind === 'throw') {
        if (api.norm(at - base - loOff) <= api.norm(hiOff - loOff)) throw new Error('bomb-dodger: a bomb landed between its own sentinels');
        if (api.vm.peek(at).op !== 'DAT') throw new Error('bomb-dodger: it wrote something other than its DAT bomb');
        // The copy's first bomb: by now it has planted its own sentinels.
        if (isPlanted && leaps.length === 1 && !bombsHere && hit()) throw new Error('bomb-dodger: the copy did not plant its sentinels');
        bombs++; bombsHere++;
        return;
      }
      if (strict && !intact(at)) throw new Error('bomb-dodger: the copy it jumped to is not a whole copy');
      leaps.push(api.norm(at - base));
      base = at; bombsHere = 0;
      dodgerBase.set(api, base);
    },
    final() {
      if (api.alone) {
        if (leaps.length) throw new Error('bomb-dodger: it moved with nothing hitting it');
        if (bombs < 100) throw new Error(`bomb-dodger: too few bombs (${bombs})`);
      }
      if (isPlanted) {
        if (!leaps.length) throw new Error('bomb-dodger: its sentinel was hit but it never moved');
        if (leaps[0] !== api.norm(api.P.HOP)) throw new Error('bomb-dodger: it did not move HOP cells on');
        if (bombsHere < 100) throw new Error(`bomb-dodger: it did not keep bombing after it moved (${bombsHere} bombs)`);
      }
    },
  };
};

// ---------------------------------------------------------------------------
// airbag-stone: a guarded stone whose loop checks its own work cells every
// pass against a pristine template laid out after it (never run). When one
// differs it copies the whole template back over the loop and starts the
// pass again, so a hit on a cell that has already run this pass, or one that
// only changes a field, is mended before it is run. A DAT on a cell the
// process is about to run still kills it: one process can't cover that.
// The loop's last cell (the JMP back, `loop` for trigger) is not repaired, so
// a trigger's rewrite of it stands.
const workCells = (old) => (old ? 5 : 4);
const airbagN = (old) => 3 * workCells(old);      // the repaired cells: the work cells and their checks
const airbag = {
  id: 'airbag-stone', kind: 'body', exit: 'never', processes: 1, writes: 'sparse', roams: false,
  purpose: 'A guarded stone (a DAT every STEP cells, never inside the warrior) that compares its loop with a pristine template every pass; when a cell differs it copies the template back over the loop and carries on, so a hit is mended before it runs.',
  params: { STEP: [1, 4000] }, entry: 'top', loop: 'back',
  provides: { datBomb: 'bomb' },
  mutable: [['rs', ['b']], ['rd', ['b']], ['cnt', ['b']], ['ptr', ['a', 'b']], ['pos', ['b']]],
  mismatches: (P, settings) => reach('airbag-stone', P, settings),
  emit(ctx) {
    const { L, P, old, total } = ctx, nw = workCells(old), N = airbagN(old);
    // The loop's work cells and their checks; the template is the same cells, every reference shifted so it reads the same.
    const body = (R, lab) => {
      guardedThrow(ctx, R, lab, total, 'chk');
      for (let i = 0; i < nw; i++) {
        ctx.ins(i ? '' : lab('chk'), seqOp(ctx), 'I', `${R('top')}+${i}`, `${R('tmpl')}+${i}`);
        ctx.ins('', 'JMP', 'B', R('fix'));
      }
    };
    body(L, (x) => x);
    ctx.ins('back', 'JMP', 'B', L('top'));
    ctx.ins('fix', 'MOV', 'AB', `#(${L('tmpl')}+${N}-${L('rs')})`, L('rs'));
    ctx.ins('', 'MOV', 'AB', `#(${L('top')}+${N}-${L('rd')})`, L('rd'));
    ctx.ins('', 'MOV', 'AB', `#${N}`, L('cnt'));
    ctx.ins('rep', 'MOV', 'I', `<${L('rs')}`, `<${L('rd')}`);
    ctx.ins('', 'DJN', 'B', L('rep'), L('cnt'));
    ctx.ins('fixJ', 'JMP', 'B', L('top'));
    ctx.mark('tmpl');
    body((x) => `(${L(x)}+${L('tmpl')}-${L('top')})`, () => '');
    ctx.ins('rs', 'DAT', 'F', '#0', '#0');
    ctx.ins('rd', 'DAT', 'F', '#0', '#0');
    ctx.ins('cnt', 'DAT', 'F', '#0', '#0');
    guardedData(ctx, 0, total);
    ctx.ins('bomb', 'DAT', 'F', '#0', '#0');
  },
};
// The planted scenario: at cycle 300 the throw's source is moved a cell back
// (damage that is harmless when run: it copies a data cell), and once that is
// mended the watch drops a DAT on the loop's first cell just after it has run.
airbag.plant = (api) => {
  const c = api.code('throw');
  return [[api.at('throw'), { ...c, a: c.a - 1 }, 300]];
};
airbag.watch = (api) => {
  const N = airbagN(api.settings.dialect === '88'), nw = workCells(api.settings.dialect === '88');
  const isPlanted = planted(api, 'airbag-stone'), strict = api.alone || isPlanted;
  const top = api.at('top'), throwAt = api.at('throw'), ptrAt = api.at('ptr');
  const loopIntact = (n) => { for (let i = 0; i < n; i++) if (!api.same(api.vm.peek(top + i), api.code('top', i))) return false; return true; };
  let bombs = 0, bombsAfter = 0, repairs = 0, struck = false;
  return {
    before(pc) {
      if (isPlanted && !struck && repairs >= 1 && pc === api.norm(top + 1) && ours(api, 'top')) {
        api.vm.poke(top, STRIKE); struck = true;
      }
      if (pc === throwAt && ours(api, 'throw')) return api.norm(ptrAt + api.vm.peek(ptrAt).b);
      if (pc === api.at('fix') && ours(api, 'fix')) {
        if (strict && loopIntact(nw)) throw new Error('airbag-stone: it repaired a loop that was not damaged');
        repairs++;
      }
      if (pc === api.at('fixJ') && ours(api, 'fixJ') && strict && !loopIntact(N)) throw new Error('airbag-stone: the repair did not restore its loop');
      return null;
    },
    after(t) {
      if (t === null || t === undefined) return;
      if (api.inImage(t)) throw new Error('airbag-stone: the guarded stone bombed the warrior');
      if (api.vm.peek(t).op !== 'DAT') throw new Error('airbag-stone: it wrote something other than its DAT bomb');
      bombs++;
      if (struck) bombsAfter++;
    },
    final() {
      if (api.alone) {
        if (repairs) throw new Error('airbag-stone: it repaired itself with nothing hitting it');
        if (bombs < 100) throw new Error(`airbag-stone: too few bombs (${bombs})`);
      }
      if (isPlanted) {
        if (!repairs) throw new Error('airbag-stone: the damaged loop was never repaired');
        if (!struck) throw new Error('airbag-stone: the loop was never struck');
        if (repairs < 2) throw new Error('airbag-stone: the DAT on its loop was not repaired');
        if (bombsAfter < 100) throw new Error(`airbag-stone: it did not keep bombing after the hit (${bombsAfter} bombs)`);
      }
    },
  };
};

// ---------------------------------------------------------------------------
// fang-gate: sweeps a moat of ZONE cells on each side of the warrior, one cell
// a side per pass, and wipes any cell that is not empty, so a vampire's fang
// (a JMP into its pit) that lands beside the warrior is gone within a sweep,
// before a process that strays out of the warrior, or an imp or a copy
// launched from it, can run it. In '94 it first reads the foreign cell's
// A-field as a fang's and, unless it points into the warrior or the moat,
// drops a DAT on the cell it points at: the pit, so processes it has already
// captured die there. '88 can't use an A-field as an address, so it only
// wipes; and as '88 can't write the empty DAT $0, $0 its moat is the DAT #0,
// #0 it writes on the first sweep.
const fangGate = {
  id: 'fang-gate', kind: 'body', exit: 'never', processes: 1, writes: 'sparse', roams: false,
  purpose: 'Sweeps a moat of ZONE cells on each side of the warrior and wipes any foreign cell there, so a vampire\'s fang beside it is gone within a sweep; in \'94 it also follows the fang\'s A-field and drops a DAT on the pit it points at (unless that is the warrior).',
  params: { ZONE: [4, 100] }, entry: 'loop', loop: 'loop',
  provides: { datBomb: 'empty' },
  mutable: [['p', ['a', 'b']], ['pf', ['b']], ['pb', ['b']], ['cnt', ['b']], ['t', ['b']], ['f', ['a', 'b']], ['r', ['b']]],
  mismatches: (P, settings) => (2 * P.ZONE + settings.maxLength + 100 > settings.coreSize ? ['fang-gate: the moat does not fit this core'] : []),
  emit(ctx) {
    const { L, P, old, total } = ctx, Z = P.ZONE, start = ctx.pc();
    const front0 = total, back0 = -Z;                    // the first cell of each side of the moat, as indices
    if (old) {
      const rel = (cell, label) => `#(${cell}-${place(ctx, start, label, 'loop')})`;
      ctx.ins('loop', 'ADD', 'AB', '#1', L('pf'));
      ctx.ins('', 'ADD', 'AB', '#1', L('pb'));
      ctx.ins('', 'DJN', 'B', L('look'), L('cnt'));
      ctx.ins('', 'MOV', 'AB', rel(front0, 'pf'), L('pf'));   // a sweep done: back to the first cells
      ctx.ins('', 'MOV', 'AB', rel(back0, 'pb'), L('pb'));
      ctx.ins('', 'MOV', 'AB', `#${Z}`, L('cnt'));
      ctx.ins('look', 'CMP', 'I', L('empty'), `@${L('pf')}`);
      ctx.ins('wipeF', 'MOV', 'I', L('empty'), `@${L('pf')}`);  // skipped when the cell is empty
      ctx.ins('', 'CMP', 'I', L('empty'), `@${L('pb')}`);
      ctx.ins('wipeB', 'MOV', 'I', L('empty'), `@${L('pb')}`);
      ctx.ins('', 'JMP', 'B', L('loop'));
      ctx.ins('pf', 'DAT', 'F', '#0', `#(${front0 - 1}-${place(ctx, start, 'pf', 'loop')})`);
      ctx.ins('pb', 'DAT', 'F', '#0', `#(${back0 - 1}-${place(ctx, start, 'pb', 'loop')})`);
      ctx.ins('cnt', 'DAT', 'F', '#0', `#${Z + 1}`);
      ctx.ins('empty', 'DAT', 'F', '#0', '#0');
      return;
    }
    // '94: one pointer, B at the front side, A at the back side.
    const tIdx = place(ctx, start, 't', 'loop'), fIdx = place(ctx, start, 'f', 'loop');
    ctx.ins('loop', 'ADD', 'F', L('inc'), L('p'));
    ctx.ins('', 'DJN', 'B', L('look'), L('cnt'));
    ctx.ins('', 'MOV', 'F', L('init'), L('p'));
    ctx.ins('', 'MOV', 'AB', `#${Z}`, L('cnt'));
    ctx.ins('look', 'SEQ', 'I', L('empty'), `@${L('p')}`);
    ctx.ins('', 'JMP', 'B', L('hitF'));
    ctx.ins('back', 'SEQ', 'I', L('empty'), `*${L('p')}`);
    ctx.ins('', 'JMP', 'B', L('hitB'));
    ctx.ins('', 'JMP', 'B', L('loop'));
    ctx.ins('hitF', 'MOV', 'AB', `#(${L('back')}-${L('r')})`, L('r'));   // come back to the other side
    ctx.ins('', 'MOV', 'B', L('p'), L('t'));
    ctx.ins('', 'JMP', 'B', L('hit'));
    ctx.ins('hitB', 'MOV', 'AB', `#(${L('loop')}-${L('r')})`, L('r'));
    ctx.ins('', 'MOV', 'AB', L('p'), L('t'));
    ctx.ins('hit', 'ADD', 'AB', `#(${L('p')}-${L('t')})`, L('t'));      // t -> the foreign cell
    ctx.ins('', 'MOV', 'I', `@${L('t')}`, L('f'));                       // keep it, to read its A-field
    ctx.ins('wipe', 'MOV', 'I', L('empty'), `@${L('t')}`);
    ctx.ins('', 'ADD', 'BA', L('t'), L('f'));                            // f's A: the pit's index from the moat's low end
    ctx.ins('', 'ADD', 'A', `#(${tIdx}+${Z})`, L('f'));
    ctx.ins('', 'SLT', 'A', `#${total + 2 * Z - 1}`, L('f'));
    ctx.ins('', 'JMP', 'B', `@${L('r')}`);                                // it points at us: leave it
    ctx.ins('', 'SUB', 'A', `#(${fIdx}+${Z})`, L('f'));                 // f's A: the pit, from f
    ctx.ins('pit', 'MOV', 'I', L('empty'), `*${L('f')}`);
    ctx.ins('', 'JMP', 'B', `@${L('r')}`);
    const pAt = ctx.pc();
    ctx.ins('p', 'DAT', 'F', `#${back0 - 1 - pAt}`, `#${front0 - 1 - pAt}`);
    ctx.ins('inc', 'DAT', 'F', '#1', '#1');
    ctx.ins('init', 'DAT', 'F', `#${back0 - pAt}`, `#${front0 - pAt}`);
    ctx.ins('cnt', 'DAT', 'F', '#0', `#${Z + 1}`);
    ctx.ins('t', 'DAT', 'F', '#0', '#0');
    ctx.ins('f', 'DAT', 'F', '#0', '#0');
    ctx.ins('r', 'DAT', 'F', '#0', '#0');
    ctx.ins('empty', 'DAT', 'F', '$0', '$0');
  },
};
// The moat's first cells, read from the pointer's first value.
function moat(api) {
  const old = api.settings.dialect === '88', Z = api.P.ZONE;
  const front0 = old ? api.norm(api.at('pf') + api.code('pf').b + 1) : api.norm(api.at('p') + api.code('p').b + 1);
  const back0 = old ? api.norm(api.at('pb') + api.code('pb').b + 1) : api.norm(api.at('p') + api.code('p').a + 1);
  const inFront = (c) => api.norm(c - front0) < Z, inBack = (c) => api.norm(c - back0) < Z;
  const inArea = (c) => api.norm(c - back0) < api.norm(front0 - back0) + Z;   // the moat and the warrior between
  return { front0, back0, inFront, inBack, inArea, inMoat: (c) => inFront(c) || inBack(c) };
}
// Two fangs, one on each side, planted once the sweep has started; each points at a pit far away.
// A third points into the warrior: it must be wiped, and its "pit" left alone.
const fangsOf = (api) => {
  const m = moat(api), Z = api.P.ZONE, intoUs = api.norm(m.back0 + Z) - api.norm(m.front0 + Z - 1);
  return [[api.norm(m.front0 + (Z >> 1)), Math.floor(api.core / 2), 100], [api.norm(m.back0 + 1), Math.floor(api.core / 3), 130], [api.norm(m.front0 + Z - 1), intoUs, 160, true]]
    .map(([at, d, cycle, us]) => ({ at, pit: api.norm(at + d), cycle, us: !!us, fang: { op: 'JMP', mod: 'B', aMode: '$', a: d, bMode: '$', b: 0 } }));
};
const PIT = { op: 'SPL', mod: 'B', aMode: '$', a: 0, bMode: '$', b: 0 };
fangGate.plant = (api) => fangsOf(api).flatMap((x) => [...(x.us ? [] : [[x.pit, PIT]]), [x.at, x.fang, x.cycle]]);
fangGate.watch = (api) => {
  const old = api.settings.dialect === '88', m = moat(api), Z = api.P.ZONE;
  const isPlanted = planted(api, 'fang-gate'), fangs = isPlanted ? fangsOf(api) : [];
  const wipes = [], pits = [];
  const wipeAt = old ? { wipeF: 'pf', wipeB: 'pb' } : { wipe: 't' };
  return {
    before(pc) {
      for (const x of fangs) {
        // Every copy of a planted block is told it is the planted one (copies share a namespace): only fangs seen in this moat count.
        if (api.vm.cycle === x.cycle) x.seen = api.same(api.vm.peek(x.at), x.fang);
        if (pc === x.at && api.same(api.vm.peek(pc), x.fang)) throw new Error('fang-gate: a process ran a fang beside the warrior');
        if (pc === x.pit && !x.us) throw new Error('fang-gate: a process reached a pit');
      }
      for (const [label, ptr] of Object.entries(wipeAt)) {
        if (pc === api.at(label) && ours(api, label)) return ['wipe', api.norm(api.at(ptr) + api.vm.peek(api.at(ptr)).b)];
      }
      if (!old && pc === api.at('pit') && ours(api, 'pit')) return ['pit', api.norm(api.at('f') + api.vm.peek(api.at('f')).a)];
      return null;
    },
    after(t) {
      if (!t) return;
      const [kind, at] = t;
      if (kind === 'wipe') {
        if (!m.inMoat(at)) throw new Error('fang-gate: it wiped a cell outside its moat');
        if (!api.same(api.vm.peek(at), api.code('empty'))) throw new Error('fang-gate: a wiped cell is not empty');
        wipes.push([at, api.vm.cycle]);
      } else {
        if (m.inArea(at) || api.inImage(at)) throw new Error('fang-gate: it bombed a pit inside the warrior or its moat');
        pits.push([at, api.vm.cycle]);
      }
    },
    final() {
      if (api.alone) {
        if (pits.length) throw new Error('fang-gate: it bombed a pit with nothing in its moat');
        // '88 writes its empty cell over the whole moat once; '94 finds the moat empty.
        if (old ? new Set(wipes.map(([c]) => c)).size !== wipes.length || wipes.length > 2 * Z : wipes.length) throw new Error('fang-gate: it wiped cells with nothing in its moat');
      }
      for (const x of fangs.filter((y) => y.seen)) {
        if (!wipes.some(([c, cycle]) => c === x.at && cycle >= x.cycle)) throw new Error('fang-gate: a fang in its moat was never wiped');
        if (!api.same(api.vm.peek(x.at), api.code('empty')) && api.same(api.vm.peek(x.at), x.fang)) throw new Error('fang-gate: a fang was left in its moat');
        if (!old && !x.us) {
          if (!pits.some(([c]) => c === x.pit)) throw new Error('fang-gate: it did not bomb the pit a fang pointed at');
          if (api.vm.peek(x.pit).op !== 'DAT') throw new Error('fang-gate: the pit is still there');
        }
      }
    },
  };
};

const blocks = [dodger, airbag, fangGate];
for (const b of blocks) b.defaults ??= Object.fromEntries(Object.entries(b.params).map(([k, [lo]]) => [k, lo]));
Object.assign(dodger.defaults, { STEP: 2377, SENT: 20, HOP: 3000 });
Object.assign(airbag.defaults, { STEP: 2377 });
Object.assign(fangGate.defaults, { ZONE: 16 });

export default blocks;
