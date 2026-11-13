// opening-qscan-table-88: a decoding ICWS'88 quickscan in the hill's size
// class, written from scratch. The idea studied from the Koenigstuhl '88 hill
// (docs/hill-top30/88.md) is that the decoder reads its offsets out of B-fields
// the scan already has, and that the line taken on a hit both jumps into the
// decoder and moves one of its pointers. The layout, the coding of the pairs
// and the table arithmetic below are this block's own.
//
// PAIRS comparisons; each pair is two lines, the CMP and a second line that is
// skipped while the pair is equal (one cycle a quiet pair). A pair is coded by
// (e, d): e chooses where it enters a chain of K decoder lines, d whether and
// which of the K pointers it moves on the way:
//
//   pair (e, -)    CMP lo, hi / JMP Ee, $u_e      enters at Ee, moves nothing
//   pair (d, d)    CMP lo, hi / DJN Ed, #ptr      moves its own B-field: the pointer
//   pair (e, d)    CMP lo, hi / JMP Ee, <sel_d    moves pointer d (d < e)
//   miss           JMP next, $w                    no pair differed
//   qT             DAT #0, #u_0                    table 0
//   qP             DAT #0, #boundary               the probe
//   E(K-1) .. E0   ADD @sel_k, qP                  add table k's entry
//   side           CMP @qP, blank / JMP next / SUB #GAP, qP   then fall into next
//
// Pointer d is the B-field of pair (d, d)'s DJN; for d > 0 it points at pair (d, -)'s JMP,
// whose B-field u_d is table d's entry. A moved pointer points one cell lower,
// at that pair's CMP, whose B-field (the high cell it compares) is table d's
// other entry. Table 0 is the cell qT and, moved, the miss line's B-field
// (were it a CMP too, pairs (e, 0) would sit a fixed few dozen cells from
// pairs (e, -)). Entering at Ee runs E_e .. E0, so the decoded offset is
//   u_0 + ... + u_e                         for pair (e, -)
//   u_0 + ... + u_e - u_d + CMP(d,-).B      for pair (e, d)
// and every pair's cells are placed exactly there (high cell = decoded offset),
// so the decoder lands on the high cell of the pair that differed. The CMP of
// a (d, -) pair only depends on the free u's, so nothing is circular. The u's
// are drawn from a seeded generator until the pairs are spread out and clear of
// the warrior. K pointers give K(K+3)/2 pairs: 5 give 20, for 2*PAIRS+K+6
// cells: 18 pairs in 47. The side test compares the high cell with an empty
// cell BLANK away and steps back to the low cell when they match.
//
// A quiet round hands on after PAIRS+1 cycles; a find at pair i after
// i + 1 + 1 + (e + 1) + 2.
//
// BURST > 0 folds the bomb burst in. The side test goes, the pairs are placed
// so the decoder lands BACK*STEP below the high cell, and five lines follow the
// decoder, bombing with the table cell qT (a DAT) through the probe itself:
//   bLoop  MOV qT, @qP         one stream: decoded + k*STEP
//          SUB #GAP, qP
//          MOV qT, @qP         the other: GAP below it
//          ADD #GAP+STEP, qP
//   bCount DJN bLoop, #BURST   then fall into the next block
// Pass BACK bombs both cells of the pair that differed. 18 pairs and the burst
// are 49 cells. The plan keeps every cell a burst can reach clear of the image.
const ID = 'opening-qscan-table-88';
const MARKER = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };
const mod = (x, n) => ((x % n) + n) % n;

// The pairs, in scan order, and K.
function structure(N) {
  let K = 1;
  while ((K * (K + 3)) / 2 < N) K++;
  const combos = [];
  for (let e = 0; e < K; e++) combos.push({ e, d: -1 });                 // table pairs: pair k is (k, -)
  for (let d = 0; d < K; d++) combos.push({ e: d, d, self: true });       // pointer pairs: pair K + d is (d, d)
  for (let e = 1; e < K; e++) for (let d = 0; d < e; d++) combos.push({ e, d });
  return { K, pairs: combos.slice(0, N) };
}
// Line offsets from the first CMP.
const rel = (N, K) => ({ miss: 2 * N, qT: 2 * N + 1, qP: 2 * N + 2, entry: (k) => 2 * N + 3 + (K - 1 - k), side: 2 * N + 3 + K });

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// The offsets (from qP) of every pair's low cell, for table entries u (u[K] is table 0's other entry).
function positions(P, S, u, b, core) {
  const { K, pairs } = S, N = pairs.length, R = rel(N, K);
  const U = []; u.slice(0, K).reduce((acc, x, k) => (U[k] = acc + x), 0);
  const L = new Array(N);
  const shift = P.BURST ? P.BACK * P.STEP : 0;              // decoded = high - shift
  for (let k = 0; k < K; k++) L[k] = mod(b + U[k] - P.GAP + shift, core);
  pairs.forEach((p, i) => {
    if (p.d < 0) return;
    // Table 0's moved entry is the miss line's B-field; table d's is the B-field of pair (d, -)'s CMP.
    const C = p.d === 0 ? u[K] : (R.qP - 2 * p.d) + L[p.d] + P.GAP;
    L[i] = mod(b + U[p.e] - u[p.d] + C - P.GAP + shift, core);
  });
  return L;
}

// Draw the table: deterministic in (SEED, layout). Returns the u's and the low cells, or null.
function plan(P, settings, b) {
  const core = settings.coreSize, room = settings.maxLength, S = structure(P.PAIRS), random = rng(P.SEED);
  const ok = (c) => c >= room && c <= core - room;
  const score = (u) => {
    const L = positions(P, S, u, b, core);
    const cells = [...L, ...L.map((x) => mod(x + P.GAP, core)), ...(P.BURST ? [] : [mod(P.BLANK, core)])];
    if (!cells.every(ok) || new Set(cells).size !== cells.length) return { u, L, gap: -1 };
    // Every cell a burst can bomb: from the decoded cell down GAP, up (BURST-1)*STEP.
    if (P.BURST && !L.every((lo) => { const d0 = lo + P.GAP - P.BACK * P.STEP; return ok(mod(d0 - P.GAP, core)) && ok(mod(d0 + (P.BURST - 1) * P.STEP, core)) && mod(d0 + (P.BURST - 1) * P.STEP - (d0 - P.GAP), core) < core / 2; })) return { u, L, gap: -1 };
    const sorted = [...L].sort((x, y) => x - y);
    let gap = core - sorted.at(-1) + sorted[0];
    for (let i = 1; i < sorted.length; i++) gap = Math.min(gap, sorted[i] - sorted[i - 1]);
    return { u, L, gap };
  };
  // Random starts, each improved one entry at a time.
  let best = null;
  for (let t = 0; t < 12; t++) {
    let cur = score(Array.from({ length: S.K + 1 }, () => Math.floor(random() * core)));
    for (let step = 0; step < 300; step++) {
      const u = [...cur.u];
      u[Math.floor(random() * (S.K + 1))] = Math.floor(random() * core);
      const next = score(u);
      if (next.gap >= cur.gap) cur = next;
    }
    if (!best || cur.gap > best.gap) best = cur;
  }
  return best && best.gap >= P.MINDIST ? best : null;
}

const qscanTable = {
  id: ID, kind: 'opening', exit: 'next', link: 'fall', processes: 1, writes: 'sparse', entry: 'qScan',
  purpose: "ICWS'88 decoding quickscan (BURST > 0: with its bomb burst built in, 49 cells for 18 pairs): PAIRS one-cycle comparisons whose second lines enter a chain of K decoder ADDs and move one of K table pointers; the tables are the B-fields of the scan's own lines, so 18 pairs and the decoder are 47 cells. A quiet round hands on after PAIRS+1 cycles with the probe on the image boundary; a find hands on the occupied cell of the first pair that differs, within about 10 cycles of the comparison.",
  params: { PAIRS: [5, 20], GAP: [2, 400], BLANK: [100, 54000], SEED: [1, 100000], MINDIST: [10, 2000], BURST: [0, 30], STEP: [1, 200], BACK: [0, 29] },
  defaults: { PAIRS: 18, GAP: 43, BLANK: 3901, SEED: 7, MINDIST: 200, BURST: 0, STEP: 9, BACK: 3 },
  provides: { probe: 'qP' },
  mutable: (P) => [['qP', ['a', 'b']], ...(P.BURST ? [['bCount', ['b']]] : []), ...Array.from({ length: structure(P.PAIRS).K }, (_, d) => [`sel${d}`, ['b']])],
  knowledge: {
    parameterRoles: {
      PAIRS: 'Comparisons, two lines each; K = 2 to 5 decoder lines are added to cover them.', GAP: 'Between the two cells of a pair.',
      BLANK: 'An empty cell, from the probe, that the side test compares the high cell with (not used with BURST).', BURST: '0: hand on the occupied cell. Otherwise bomb BURST passes, two DAT bombs GAP apart a pass, STEP between passes, then hand on.', STEP: 'BURST: between passes.', BACK: 'BURST: passes before the one that bombs the pair (must be below BURST).',
      SEED: 'Picks the table entries, and so where the pairs are; the linker refuses a seed whose pairs are not spread MINDIST apart or that look at the warrior.',
      MINDIST: 'Least distance between two pairs\' low cells.',
    },
    tuning: ['A quiet pair costs one cycle, as in every unrolled scan; the decoder only pays on a find, which hands on at once instead of after the remaining pairs.', 'The pairs land where the table puts them, not on a lattice: change SEED to move them.'],
    failures: ['Equal cells are invisible.', 'A find in a pair whose high cell matches the blank cell is taken to be the low cell.', 'The opponent writing over a table cell before the scan reaches it moves where a find is reported.'],
    evidence: ['docs/hill-top30/88.md'],
  },
  mismatches(P, settings) {
    const out = [], core = settings.coreSize, room = settings.maxLength;
    if (mod(P.BLANK, core) < room || mod(P.BLANK, core) > core - room) out.push(`${ID}: the blank cell lands on the image`);
    if (P.GAP >= core / 4) out.push(`${ID}: GAP is too large`);
    if (P.BURST && P.BACK >= P.BURST) out.push(`${ID}: BACK must be below BURST, or the pair is never bombed`);
    return out;
  },
  linked(P, settings, at, { span }) {
    return plan(P, settings, span - at('qP')) ? [] : [`${ID}: no table with SEED ${P.SEED} spreads the pairs MINDIST apart clear of the warrior; try another SEED`];
  },
  emit(ctx) {
    const { L, P, core } = ctx, S = structure(P.PAIRS), N = S.pairs.length, R = rel(N, S.K);
    const start = ctx.pc(), b = ctx.span - (start + R.qP);
    const pl = plan(P, ctx.settings, b) ?? { u: Array(S.K + 1).fill(0), L: Array(N).fill(0) };
    const qP = L('qP');
    S.pairs.forEach((p, i) => {
      const lo = pl.L[i];
      ctx.ins(i ? '' : 'qScan', 'CMP', 'I', `${qP}+${lo}`, `${qP}+${mod(lo + P.GAP, core)}`);
      const into = L(`E${p.e}`);
      if (p.d < 0) ctx.ins(`tab${p.e}`, 'JMP', 'B', into, `${p.e ? mod(pl.u[p.e], core) : 0}`);
      else if (p.self) ctx.ins(`sel${p.d}`, 'DJN', 'B', into, `#(${L(p.d ? `tab${p.d}` : 'qT')}-${L(`sel${p.d}`)})`);
      else ctx.ins('', 'JMP', 'B', into, `<${L(`sel${p.d}`)}`);
    });
    ctx.ins('qMiss', 'JMP', 'B', ctx.next, `${mod(pl.u[S.K], core)}`);    // B: table 0's moved entry
    ctx.ins('qT', 'DAT', 'F', '#0', `#${mod(pl.u[0], core)}`);          // table 0's entry
    ctx.ins('qP', 'DAT', 'F', '#0', `#${mod(b, core)}`);
    for (let k = S.K - 1; k >= 0; k--) ctx.ins(`E${k}`, 'ADD', 'F', `@${L(`sel${k}`)}`, qP);
    if (P.BURST) {
      ctx.ins('bLoop', 'MOV', 'I', L('qT'), `@${qP}`);
      ctx.ins('', 'SUB', 'AB', `#${P.GAP}`, qP);
      ctx.ins('bTwo', 'MOV', 'I', L('qT'), `@${qP}`);
      ctx.ins('', 'ADD', 'AB', `#${P.GAP + P.STEP}`, qP);
      ctx.ins('bCount', 'DJN', 'B', L('bLoop'), `#${P.BURST}`);
      return;
    }
    ctx.ins('qSide', 'CMP', 'I', `@${qP}`, `${qP}+${mod(P.BLANK, core)}`);
    ctx.ins('', 'JMP', 'B', ctx.next);
    ctx.ins('qBack', 'SUB', 'AB', `#${P.GAP}`, qP);
  },
  // A find for the gate: the high cell of the last pair (the longest decode).
  plant(api) {
    const i = structure(api.P.PAIRS).pairs.length - 1, cmp = api.at('qScan', 2 * i);
    return [[api.norm(cmp + api.code('qScan', 2 * i).b), MARKER]];
  },
  watch(api) {
    const { vm, P } = api, S = structure(P.PAIRS), N = S.pairs.length;
    const qP = api.at('qP'), scan = api.at('qScan');
    const pairAt = (i) => { const c = api.at('qScan', 2 * i), x = api.code('qScan', 2 * i); return { lo: api.norm(c + x.a), hi: api.norm(c + x.b) }; };
    const blank = P.BURST ? null : api.norm(api.at('qSide') + api.code('qSide').b);
    const writers = P.BURST ? new Set([api.at('bLoop'), api.at('bTwo')]) : new Set();
    const bombs = new Set();
    let expected, cycles = 0, done = false;
    return {
      before(pc) {
        if (done) return;
        if (expected === undefined) {
          if (pc !== scan) return;
          expected = { cell: api.norm(qP + api.code('qP').b), cycles: N + 1 };
          for (let i = 0; i < N; i++) {
            const { lo, hi } = pairAt(i);
            if (api.same(vm.peek(lo), vm.peek(hi))) continue;
            expected = P.BURST
              ? { cell: api.norm(hi - P.BACK * P.STEP + P.BURST * P.STEP), cycles: i + 1 + 1 + (S.pairs[i].e + 1) + 5 * P.BURST, pair: i,
                  bombs: Array.from({ length: P.BURST }, (_, k) => [api.norm(hi - P.BACK * P.STEP + k * P.STEP), api.norm(hi - P.BACK * P.STEP + k * P.STEP - P.GAP)]).flat() }
              : { cell: api.same(vm.peek(hi), vm.peek(blank)) ? lo : hi, cycles: i + 1 + 1 + (S.pairs[i].e + 1) + 2, pair: i };
            break;
          }
        }
        if (api.inSelf(pc)) {
          cycles++;
          if (writers.has(pc)) return { bomb: api.norm(qP + vm.peek(qP).b), pc };
          return;
        }
        // The first step outside the block: it has handed on.
        done = true;
        const got = api.norm(qP + vm.peek(qP).b);
        if (got !== expected.cell) throw new Error(`${ID}: handed on the wrong cell${expected.pair === undefined ? ' with nothing found' : ` for pair ${expected.pair}`}`);
        if (cycles !== expected.cycles) throw new Error(`${ID}: took ${cycles} cycles, not ${expected.cycles}`);
        if (P.BURST) {
          const want = new Set(expected.bombs ?? []);
          if (bombs.size !== want.size || [...want].some((c) => !bombs.has(c))) throw new Error(`${ID}: the burst bombed ${bombs.size} cells, not the ${want.size} it should`);
        }
      },
      after(t) {
        if (!t) return;
        if (api.inImage(t.bomb) && !api.inDead(t.bomb)) throw new Error(`${ID}: the burst bombed the warrior`);
        if (!api.same(vm.peek(t.bomb), api.code('qT')) || vm.writerPc[t.bomb] !== t.pc) throw new Error(`${ID}: the burst dropped something other than its DAT`);
        bombs.add(t.bomb);
      },
      final() {
        if (expected !== undefined && !done) throw new Error(`${ID}: it never handed on`);
      },
    };
  },
};

export default [qscanTable];
