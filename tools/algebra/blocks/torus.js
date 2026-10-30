// Torus blocks: bodies and a clear for the plane and the volume (--torus).
// How to write a block: docs/block-algebra.md; the torus rules: AGENTS.md
// ("The plane"). Code runs along x, so every label distance is a plain step
// along the row; anything that reaches another row or layer is a vector. Two
// kinds of arithmetic meet here and the blocks keep them apart:
// - ADD/SUB and addressing work per axis (no carry from x into y), so a
//   vector step keeps its parity on every axis;
// - pointer increments (> <), DJN and SLT are plain numbers, so a >ptr walks
//   every cell of the torus row by row, layer by layer, and a plain range of
//   pointer values around 0 is exactly a stretch of the pointer's own row.
// Self-safety comes from one or the other: a stone whose steps are even on
// an axis and whose first bomb is an odd distance away on it never lands on
// its own row; a clear or scan that walks plain numbers skips a plain range.
// Checks use the geometry (api.add, api.rel, api.geo), never plain sums.

// A planted target: a cell no empty core holds.
const TARGET = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };
const dimsOf = (s) => [s.sizeX ?? s.coreSize, s.sizeY ?? 1, s.sizeZ ?? 1];
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const lcm = (a, b) => (a / gcd(a, b)) * b;
const wrap = (v, m) => ((v % m) + m) % m;
// How many steps of s before a walk along an axis of size m comes home.
const period = (s, m) => m / gcd(wrap(s, m), m);
// The z part of a vector, which a plane (Z = 1) has no room for.
const vz = (ctx, z) => (dimsOf(ctx.settings)[2] > 1 ? z : 0);
const TORUS = { topologies: ['torus'] };
// The offset of c from `from` as [x, y, z].
const offset = (api, c, from) => api.geo.decode(api.geo.sub(api.norm(c), api.norm(from)));
const rowKey = (api, c) => { const [, y, z] = api.geo.decode(c); return `${y},${z}`; };
const layersOf = (keys) => new Set([...keys].map((k) => k.split(',')[1])).size;

// ---------------------------------------------------------------------------
// vector-stone: ADD a vector to the pointer, bomb, repeat; after LAP bombs
// (0: the walk's own period, when it would come home) shift the whole lattice
// by T. The first bomb is [0,1,1] + S from the pointer, and every step is even
// on y (or z), so on an even-sized axis every bomb lands an odd number of
// rows (layers) away: never on its own row, whatever S and T do along x.
function stoneLap(P, settings) {
  const [X, Y, Z] = dimsOf(settings);
  return P.LAP || lcm(lcm(period(P.SX, X), period(P.SY, Y)), period(P.SZ, Z));
}
const vectorStone = {
  ...TORUS, kind: 'body', exit: 'never', processes: 1, writes: 'sparse',
  purpose: 'Vector stone: bombs every [SX,SY,SZ] through rows and layers; after LAP bombs it shifts the lattice by [TX,TY,TZ]. Its y (or z) steps are even and its first bomb an odd row away, so it never bombs its own row.',
  params: { SX: [0, 199], SY: [0, 199], SZ: [0, 199], TX: [0, 199], TY: [0, 199], TZ: [0, 199], LAP: [0, 4000] },
  defaults: { SX: 7, SY: 6, SZ: 0, TX: 0, TY: 2, TZ: 1, LAP: 0 },
  entry: 'loop', loop: 'loop',
  mutable: [['ptr', ['b']], ['cnt', ['b']]],
  mismatches(P, settings) {
    const [, Y, Z] = dimsOf(settings), out = [];
    const safeY = Y % 2 === 0 && P.SY % 2 === 0 && P.TY % 2 === 0;
    const safeZ = Z > 1 && Z % 2 === 0 && P.SZ % 2 === 0 && P.TZ % 2 === 0;
    if (!safeY && !safeZ) out.push('vector-stone: its bombs could reach its own row (SY and TY must be even on an even y axis, or SZ and TZ on an even z axis)');
    if (lcm(period(P.SY, Y), period(P.SZ, Z)) < 4) out.push('vector-stone: S reaches fewer than 4 rows and layers');
    if (Z > 1 && wrap(P.SZ, Z) === 0 && wrap(P.TZ, Z) === 0) out.push('vector-stone: in a volume, S or T must reach other layers');
    return out;
  },
  emit(ctx) {
    const { P, L } = ctx, lap = stoneLap(P, ctx.settings);
    ctx.ins('loop', 'ADD', 'AB', `#${ctx.vec(P.SX, P.SY, vz(ctx, P.SZ))}`, L('ptr'));
    ctx.ins('mov', 'MOV', 'I', L('bomb'), `@${L('ptr')}`);
    ctx.ins('', 'DJN', 'B', L('loop'), L('cnt'));
    ctx.ins('', 'ADD', 'AB', `#${ctx.vec(P.TX, P.TY, vz(ctx, P.TZ))}`, L('ptr'));
    ctx.ins('', 'MOV', 'AB', `#${lap}`, L('cnt'));
    ctx.ins('', 'JMP', 'B', L('loop'));
    ctx.ins('ptr', 'DAT', 'F', '#0', `#${ctx.vec(0, 1, vz(ctx, 1))}`);
    ctx.ins('cnt', 'DAT', 'F', '#0', `#${lap}`);
    ctx.ins('bomb', 'DAT', 'F', '#0', '#0');
  },
  watch(api) {
    const { geo, P } = api, Z = api.settings.sizeZ ?? 1;
    const S = geo.encode(P.SX, P.SY, Z > 1 ? P.SZ : 0), ST = geo.add(S, geo.encode(P.TX, P.TY, Z > 1 ? P.TZ : 0));
    const first = api.add(api.at('ptr'), geo.add(api.norm(api.code('ptr').b), S));
    const rows = new Set(), cells = new Set();
    let prev = null, bombs = 0;
    return {
      before: (pc) => (pc === api.at('mov') ? api.add(api.at('ptr'), api.vm.peek(api.at('ptr')).b) : null),
      after: (t) => {
        if (t === null) return;
        if (api.inSelf(t)) throw new Error('vector-stone bombed itself');
        const [, y, z] = offset(api, t, api.self.start);
        if (!y && !z) throw new Error('vector-stone bombed its own row');
        // Each bomb is one step S on from the last, or S + T at the end of a lap
        // (or the first bomb again, when a restart has put the stone back as it was).
        const d = prev === null ? null : geo.sub(t, prev);
        if (d !== null && d !== S && d !== ST && t !== first) throw new Error(`vector-stone stepped by ${geo.format(d)}, not S or S + T`);
        prev = t; bombs++; rows.add(rowKey(api, t)); cells.add(t);
      },
      final: () => {
        if (!api.alone) return;
        if (cells.size < 100) throw new Error(`vector-stone bombed only ${cells.size} cells`);
        if (rows.size < 8) throw new Error(`vector-stone's bombs stayed in ${rows.size} rows`);
        if (Z > 1 && layersOf(rows) < 3) throw new Error(`vector-stone's bombs stayed in ${layersOf(rows)} layers`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// row-sweeper: a raster bomber standing in a column. The launcher copies an
// 8-line body into the cells under a TRN, line i to i + 1 rows down, and the
// TRN turns the process to face down, so it runs the body top to bottom (its
// operands are vertical offsets, and its JMP keeps the heading). The body
// bombs XN cells along a row GX apart (0: until it comes round), then turns down to the
// next row, [RX,GY,GZ] on. GX, RX and GY are even and the first bomb is one
// column across and seven rows down (an odd number of each), so on an even
// plane every bomb lands an odd column from its own column and an odd row
// from its launcher's row.
const SWEEP_BODY = 8, SWEEP_PTR = 6;
const sweepXN = (P, settings) => P.XN || period(P.GX, dimsOf(settings)[0]);   // 0: until x comes home
const rowSweeper = {
  ...TORUS, kind: 'body', exit: 'never', processes: 1, writes: 'sparse', roams: true,
  purpose: 'Raster bomber in a column: TRN stands its body up under the launcher; it bombs XN cells GX apart along a row, then turns down [RX,GY,GZ] to the next row. Odd column and row offsets keep it off itself.',
  params: { GX: [2, 198], GY: [0, 198], GZ: [0, 199], RX: [0, 198], XN: [0, 200] },
  defaults: { GX: 2, GY: 2, GZ: 1, RX: 0, XN: 0 },
  entry: 'go',
  mismatches(P, settings) {
    const [X, Y, Z] = dimsOf(settings), out = [];
    if (X % 2 || Y % 2) out.push('row-sweeper needs an even number of columns and rows');
    if (P.GX % 2 || P.GY % 2 || P.RX % 2) out.push('row-sweeper: GX, GY and RX must be even, or it can bomb its own column or row');
    if (wrap(P.GX, X) === 0) out.push('row-sweeper: GX does not move along the row');
    if (wrap(P.GY, Y) === 0 && wrap(P.GZ, Z) === 0) out.push('row-sweeper never turns to another row');
    if (Y <= SWEEP_BODY + 1) out.push(`row-sweeper stands ${SWEEP_BODY} rows tall: the plane needs more than ${SWEEP_BODY + 1} rows`);
    return out;
  },
  emit(ctx) {
    const { P } = ctx, xn = sweepXN(P, ctx.settings), v = (dy) => ctx.vec(0, dy, 0);
    // Launcher: line i copies body line i (9 cells on) to the TRN's column, i + 1 rows down.
    for (let i = 0; i < SWEEP_BODY; i++) ctx.ins(i ? '' : 'go', 'MOV', 'I', `${SWEEP_BODY + 1}`, ctx.vec(SWEEP_BODY - i, i + 1, 0));
    ctx.ins('turn', 'TRN', 'B', v(1));                                   // face down, onto the body
    // The body, as data here: line j refers to line k as [0, k - j].
    ctx.ins('tBomb', 'MOV', 'I', v(7), `@${v(6)}`);                       // 0: drop one
    ctx.ins('', 'ADD', 'AB', `#${ctx.vec(P.GX, 0, 0)}`, v(5));                          // 1: along the row
    ctx.ins('', 'DJN', 'A', v(-2), v(4));                                  // 2: XN to a row (ptr's A field)
    ctx.ins('', 'MOV', 'A', `#${xn}`, v(3));                               // 3: a new row's count
    ctx.ins('', 'ADD', 'AB', `#${ctx.vec(P.RX, P.GY, vz(ctx, P.GZ))}`, v(2)); // 4: turn down to the next row
    ctx.ins('', 'JMP', 'B', v(-5));                                        // 5: (heading down is kept)
    ctx.ins('tPtr', 'DAT', 'F', `#${xn}`, '#1');                           // 6: first bomb one column across
    ctx.ins('', 'DAT', 'F', '#0', '#0');                                   // 7: the bomb
  },
  // Running: a process in the standing body, under the TRN.
  running(api) {
    const turn = api.at('turn');
    return api.vm.processes(0).some((q) => { const [x, y, z] = offset(api, q, turn); return !x && !z && y >= 1 && y <= SWEEP_BODY; });
  },
  watch(api) {
    const { geo, P } = api, [X, Y, Z] = dimsOf(api.settings), xn = sweepXN(P, api.settings);
    const turn = api.at('turn'), bombAt = api.add(turn, geo.encode(0, 1, 0)), ptr = api.add(turn, geo.encode(0, SWEEP_PTR + 1, 0));
    const along = geo.encode(P.GX, 0, 0), down = geo.encode(P.GX + P.RX, P.GY, Z > 1 ? P.GZ : 0);
    const rows = new Set();
    let prev = null, run = 0, bombs = 0;
    return {
      before: (pc) => (pc === bombAt ? api.add(ptr, api.vm.peek(ptr).b) : null),
      after: (t) => {
        if (t === null) return;
        if (api.inSelf(t)) throw new Error('row-sweeper bombed its launcher');
        const [x, y, z] = offset(api, t, turn);
        if (!x && !z && y >= 0 && y <= SWEEP_BODY) throw new Error('row-sweeper bombed its own column');
        if (prev !== null) {
          const d = geo.sub(t, prev);
          if (d === along) run++;
          else if (d === down) { if (run + 1 !== xn) throw new Error(`row-sweeper turned after ${run + 1} bombs, not ${xn}`); run = 0; }
          else throw new Error(`row-sweeper stepped by ${geo.format(d)}: neither along the row nor down to the next`);
        }
        prev = t; bombs++; rows.add(rowKey(api, t));
      },
      final: () => {
        if (!api.alone) return;
        const expected = lcm(period(P.GY, Y), period(Z > 1 ? P.GZ : 0, Z));
        if (bombs < 1000) throw new Error(`row-sweeper dropped only ${bombs} bombs from its column`);
        if (rows.size < Math.min(8, expected)) throw new Error(`row-sweeper swept only ${rows.size} rows`);
        if (Z > 1 && wrap(P.GZ, Z) && layersOf(rows) < 3) throw new Error(`row-sweeper swept only ${layersOf(rows)} layers`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// plane-clear: a >ptr clear. The pointer counts as a plain number, so it walks
// every cell of the torus row by row, layer by layer. It starts just past the
// protected image (warrior cells 0 .. span, on its own row) and counts
// CORESIZE - span cells, so it ends just before the image: everything else is
// cleared, the rest of its own row included. PHASE 1: an SPL 0 pass first,
// then DAT passes for ever.
const planeClear = {
  ...TORUS, kind: 'finisher', exit: 'never', processes: 1, writes: 'core', protects: 'image', relocatable: false,
  purpose: 'Plane clear: a >ptr pointer counts through every cell of the torus row by row, sparing only the image on its own row; PHASE 1 stuns with SPL 0 on the first pass, then kills with DAT.',
  params: { PHASE: [0, 1] }, defaults: { PHASE: 1 },
  entry: 'go', loop: 'loop',
  mutable: [['ptr', ['b']], ['cnt', ['b']], ['bomb', ['op', 'mod', 'aMode', 'a', 'bMode', 'b']]],
  emit(ctx) {
    const { L, P } = ctx, ptrIdx = ctx.pc() + 6, first = ctx.span - ptrIdx, count = ctx.core - ctx.span;
    ctx.ins('go', 'MOV', 'AB', `#${first}`, L('ptr'));
    ctx.ins('', 'MOV', 'AB', `#${count}`, L('cnt'));
    ctx.ins('loop', 'MOV', 'I', L('bomb'), `>${L('ptr')}`);
    ctx.ins('', 'DJN', 'B', L('loop'), L('cnt'));
    ctx.ins('', 'MOV', 'I', L('kill'), L('bomb'));                       // later passes kill
    ctx.ins('', 'JMP', 'B', L('go'));
    ctx.ins('ptr', 'DAT', 'F', '#0', `#${first}`);
    ctx.ins('cnt', 'DAT', 'F', '#0', `#${count}`);
    if (P.PHASE) ctx.ins('bomb', 'SPL', 'B', '#0', '#0'); else ctx.ins('bomb', 'DAT', 'F', '#0', '#0');
    ctx.ins('kill', 'DAT', 'F', '#0', '#0');
  },
  watch(api) {
    const passLen = api.code('cnt').b, ptr = api.at('ptr'), written = new Set();
    let writes = 0;
    return {
      before: (pc) => (pc === api.at('loop') ? api.add(ptr, api.vm.peek(ptr).b) : null),
      after: (t) => {
        if (t === null) return;
        if (api.inSelf(t)) throw new Error('plane-clear cleared its own code');
        const want = api.P.PHASE && writes < passLen ? 'SPL' : 'DAT';
        if (api.vm.peek(t).op !== want) throw new Error(`plane-clear wrote ${api.vm.peek(t).op} where its pass writes ${want}`);
        writes++; written.add(t);
      },
      final: () => {
        if (!api.sole() || writes < 2 * passLen) return;
        // Two passes done: every cell but a stretch of its own row (the image) is cleared, and dead.
        const [X] = dimsOf(api.settings);
        let spared = 0;
        for (let c = 0; c < api.core; c++) {
          if (written.has(c)) { if (api.vm.peek(c).op !== 'DAT') throw new Error('plane-clear\'s second pass left a live cell'); continue; }
          const [x, y, z] = offset(api, c, api.self.start);
          if (y || z || Math.abs(x) >= Math.min(api.total, X)) throw new Error(`plane-clear missed a cell off its own image (${api.geo.format(api.geo.sub(c, api.self.start))} from it)`);
          spared++;
        }
        if (spared > api.total) throw new Error(`plane-clear spared ${spared} cells, more than the warrior`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// volume-paper: a Mice-style copy loop whose copy pointer is a vector. Each lap
// takes its destination from dst's A field (a seed), copies the 8 cells after
// cnt there one by one, starts a process in the copy and moves the seed on by
// [0,SY,SZ]. The predecrements are plain numbers, so the seed's x stays fixed
// (DX + 1) and well inside the row: the 8 pointer values then never cross the
// row's edge, and every copy is whole. Every copy sits exactly DX columns,
// DY + k*SY rows and DZ + k*SZ layers from its parent, and copies again.
const PAPER_LEN = 8;
const volumePaper = {
  ...TORUS, kind: 'body', exit: 'never', processes: 1, grows: true, writes: 'sparse', roams: true, entryFirst: false,
  purpose: 'Volume paper: copies itself [DX,DY,DZ] away (another row and layer), starts a process there and moves its seed on by [0,SY,SZ]; every copy does the same, so copies spread through rows, layers and, generation by generation, columns.',
  params: { DX: [-100, 100], DY: [0, 199], DZ: [0, 199], SY: [0, 199], SZ: [0, 199] },
  defaults: { DX: 7, DY: 3, DZ: 1, SY: 6, SZ: 3 },
  entry: 'go',
  mutable: [['cnt', ['b']], ['dst', ['a', 'b']]],
  mismatches(P, settings) {
    const [X, Y, Z] = dimsOf(settings), out = [];
    const hx = Math.floor(X / 2);
    // The copy pointer holds DX + 1, then counts down to DX - 7 along x: it must not cross the row's edge.
    if (P.DX - (PAPER_LEN - 1) < -hx || P.DX + 1 > X - hx - 1) out.push(`volume-paper: DX must be from ${PAPER_LEN - 1 - hx} to ${X - hx - 2} on a ${X}-wide row`);
    if (wrap(P.DY, Y) === 0 && wrap(P.DZ, Z) === 0) out.push('volume-paper: its first copy lands on its own row');
    if (lcm(period(P.SY, Y), period(P.SZ, Z)) < 3) out.push('volume-paper: S visits fewer than 3 rows and layers');
    if (Z > 1 && wrap(P.SZ, Z) === 0) out.push('volume-paper: in a volume, SZ must move its copies through the layers');
    return out;
  },
  emit(ctx) {
    const { L, P } = ctx;
    ctx.ins('cnt', 'DAT', 'F', '#0', '#0');
    ctx.ins('go', 'MOV', 'AB', `#${PAPER_LEN}`, L('cnt'));
    ctx.ins('', 'MOV', 'AB', L('dst'), L('dst'));                        // this lap's destination: the seed
    ctx.ins('copy', 'MOV', 'I', `@${L('cnt')}`, `<${L('dst')}`);         // cells 8 .. 1, last first
    ctx.ins('', 'DJN', 'B', L('copy'), L('cnt'));
    ctx.ins('spl', 'SPL', 'B', `@${L('dst')}`);                          // run the copy
    ctx.ins('', 'ADD', 'A', `#${ctx.vec(0, P.SY, vz(ctx, P.SZ))}`, L('dst'));
    ctx.ins('', 'JMP', 'B', L('go'));
    ctx.ins('dst', 'DAT', 'F', `#${ctx.vec(P.DX + 1, P.DY, vz(ctx, P.DZ))}`, '#0');
  },
  running(api) {
    const code = Array.from({ length: 7 }, (_, k) => api.code('go', k));
    return api.vm.processes(0).some((q) => code.some((y) => api.same(api.vm.peek(q), y)));
  },
  watch(api) {
    const { geo } = api, Z = api.settings.sizeZ ?? 1, go = api.at('go');
    const code = Array.from({ length: 7 }, (_, k) => api.code('go', k));
    const complete = (c) => code.every((y, k) => api.same(api.vm.peek(api.add(c, k)), y));
    let spawns = 0;
    return {
      before: (pc) => (spawns < 3 && pc === api.at('spl') ? api.add(api.at('dst'), api.vm.peek(api.at('dst')).b) : null),
      after: (t) => {
        if (t === null) return;
        spawns++;
        if (!complete(t)) throw new Error('volume-paper started a process at an incomplete copy');
        const [x, y, z] = offset(api, t, go);
        const X = api.settings.sizeX;
        if (wrap(x - api.P.DX, X) || (!y && !z)) throw new Error(`volume-paper copied itself ${geo.format(geo.sub(t, go))} away, not DX columns across on another row`);
      },
      final: () => {
        if (!api.alone) return;
        const rows = new Set();
        for (let c = 0; c < api.core; c++) if (c !== go && complete(c)) rows.add(rowKey(api, c));
        if (rows.size < 3) throw new Error(`volume-paper's copies are in ${rows.size} rows`);
        if (Z > 1 && layersOf(rows) < 2) throw new Error(`volume-paper's copies stayed in ${layersOf(rows)} layer`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// torus-scanner: JMZ.F walks a >ptr through every cell of the volume, one per
// cycle, from two rows below its own to two rows above (the pointer is plain,
// so that is every row of every layer but its own row and the two beside it).
// On a find it bombs the cell and the cells one row above and below it, then
// scans on. Reaching its own neighbourhood (SLT on the plain pointer), it
// starts the next lap.
const torusScanner = {
  ...TORUS, kind: 'body', exit: 'never', processes: 1, writes: 'sparse', attacks: 'all',
  purpose: 'Torus scanner: a JMZ.F >ptr scan of every cell of the torus but its own row and the two beside it; on a find it bombs the cell and the cells a row above and below, then scans on. Laps for ever.',
  params: {}, entry: 'scan', loop: 'scan',
  mutable: [['ptr', ['b']]],
  mismatches(P, settings) {
    return dimsOf(settings)[1] < 6 ? ['torus-scanner skips three rows of its own layer: it needs at least 6 rows'] : [];
  },
  emit(ctx) {
    const { L } = ctx, hx = Math.floor(ctx.geo.X / 2);
    const first = ctx.geo.encode(-hx, 2, 0), limit = ctx.geo.encode(-hx, -1, 0);   // row 2's first cell; row -1's
    const down = ctx.vec(0, 1, 0);
    ctx.ins('scan', 'JMZ', 'F', L('scan'), `>${L('ptr')}`);
    ctx.ins('', 'SLT', 'AB', `#${limit}`, L('ptr'));                     // past row -2: ourselves
    ctx.ins('', 'JMP', 'B', L('hit'));
    ctx.ins('reset', 'MOV', 'AB', `#${first}`, L('ptr'));                // the next lap
    ctx.ins('', 'JMP', 'B', L('scan'));
    ctx.ins('hit', 'MOV', 'I', L('bomb'), `<${L('ptr')}`);               // the find (the pointer steps back onto it)
    ctx.ins('', 'ADD', 'AB', `#${down}`, L('ptr'));
    ctx.ins('below', 'MOV', 'I', L('bomb'), `@${L('ptr')}`);             // a row below it
    ctx.ins('', 'SUB', 'AB', `#${ctx.vec(0, 2, 0)}`, L('ptr'));
    ctx.ins('above', 'MOV', 'I', L('bomb'), `@${L('ptr')}`);             // a row above it
    ctx.ins('', 'ADD', 'AB', `#${down}`, L('ptr'));
    ctx.ins('', 'JMP', 'B', L('scan'));
    ctx.ins('ptr', 'DAT', 'F', '#0', `#${first}`);
    ctx.ins('bomb', 'DAT', 'F', '#0', '#0');
  },
  // A target in another row (and, in a volume, another layer).
  plant(api) {
    const Z = api.settings.sizeZ ?? 1;
    return [[api.add(api.at('ptr'), api.geo.encode(7, 5, Z > 1 ? 2 : 0)), TARGET]];
  },
  watch(api) {
    const { geo } = api, Z = api.settings.sizeZ ?? 1, ptr = api.at('ptr');
    const planted = api.scenario === 'torus-scanner: planted target';
    const target = api.add(ptr, geo.encode(7, 5, Z > 1 ? 2 : 0));
    const hits = [api.at('hit'), api.at('below'), api.at('above')];
    const bombed = new Set();
    let laps = 0;
    return {
      before: (pc) => {
        if (pc === api.at('reset')) laps++;
        const i = hits.indexOf(pc);
        if (i < 0) return null;
        const b = api.vm.peek(ptr).b;
        return api.add(ptr, i === 0 ? api.norm(b - 1) : b);
      },
      after: (t) => {
        if (t === null) return;
        if (api.inSelf(t)) throw new Error('torus-scanner bombed itself');
        const [, y, z] = offset(api, t, api.self.start);
        if (!y && !z) throw new Error('torus-scanner bombed its own row');
        if (!api.same(api.vm.peek(t), api.code('bomb'))) throw new Error('a torus-scanner bomb did not land');
        bombed.add(t);
      },
      final: () => {
        if (api.alone && laps < 3) throw new Error(`torus-scanner made ${laps} laps of the torus`);
        if (!planted) return;
        const up = geo.encode(0, 1, 0);
        for (const c of [target, api.add(target, up), geo.sub(target, up)]) {
          if (!bombed.has(c)) throw new Error(`torus-scanner did not bomb ${geo.format(geo.sub(c, ptr))} from its pointer around the planted target`);
        }
      },
    };
  },
};

// ---------------------------------------------------------------------------
// column-imp: an imp that crawls along y (AXIS 1) or z (AXIS 2, a volume's
// depth) instead of x. The launcher puts MOV 0, step in the cell one step past
// a TRN, and the TRN turns the process to face along the step onto it.
const impStep = (ctx, P) => [0, P.AXIS === 1 ? (P.SIGN ? -1 : 1) : 0, P.AXIS === 2 ? (P.SIGN ? -1 : 1) : 0];
const columnImp = {
  ...TORUS, kind: 'body', exit: 'never', processes: 1, writes: 'sparse', roams: true,
  purpose: 'Column imp: TRN turns the process to face down a column (AXIS 1) or through the layers (AXIS 2; SIGN 1 the other way) onto a MOV 0, step it put there; it crawls round that line for ever.',
  params: { AXIS: [1, 2], SIGN: [0, 1] }, defaults: { AXIS: 1, SIGN: 0 },
  entry: 'go',
  mismatches(P, settings) {
    const [, Y, Z] = dimsOf(settings);
    return (P.AXIS === 1 ? Y : Z) < 2 ? [`column-imp: axis ${P.AXIS === 1 ? 'y' : 'z'} has one cell`] : [];
  },
  emit(ctx) {
    const [, sy, sz] = impStep(ctx, ctx.P);
    ctx.ins('go', 'MOV', 'I', ctx.L('imp'), ctx.vec(1, sy, sz));      // the imp, one step past the TRN
    ctx.ins('trn', 'TRN', 'B', ctx.vec(0, sy, sz));                     // face along the step, onto it
    ctx.ins('imp', 'MOV', 'I', '0', ctx.vec(0, sy, sz));                // (laid out here as data)
  },
  running(api) {
    const imp = api.code('imp');
    return api.vm.processes(0).some((q) => api.same(api.vm.peek(q), imp));
  },
  watch(api) {
    const { P } = api, [, Y, Z] = dimsOf(api.settings), imp = api.code('imp'), trn = api.at('trn'), visited = new Set();
    return {
      before: (pc) => {
        if (pc === api.at('imp') || !api.same(api.vm.peek(pc), imp)) return null;
        // (Other copies of the block run the same imp on their own lines.)
        const [x, y, z] = offset(api, pc, trn);
        if (x || (P.AXIS === 1 ? z : y)) { if (api.alone) throw new Error('column-imp left its line'); return null; }
        visited.add(pc);
        return null;
      },
      final: () => {
        const want = P.AXIS === 1 ? Y : Z;
        if (visited.size < want) throw new Error(`column-imp visited ${visited.size} of the ${want} cells of its line`);
      },
    };
  },
};

export default [
  { id: 'vector-stone', ...vectorStone },
  { id: 'row-sweeper', ...rowSweeper },
  { id: 'plane-clear', ...planeClear },
  { id: 'volume-paper', ...volumePaper },
  { id: 'torus-scanner', ...torusScanner },
  { id: 'column-imp', ...columnImp },
];
