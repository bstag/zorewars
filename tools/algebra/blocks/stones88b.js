// triple-stream-stone: a stone whose loop carries three decrement streams one
// third of the core apart, against 3-point imp rings (the idea is Triangular
// Sun's, docs/hill-top30/88.md; the Redcode, layout and constants are written
// from scratch, and unlike the original it is built to run for ever).
//
//   tHead  SPL 0, first        its free B-field is the bomb pointer
//   tMov   MOV tBomb, @tHead   a DAT every STEP cells
//   tAdd   ADD #STEP, tHead
//   tC     DJN tB, <third      three DJN streams: each predecrements its
//   tB     DJN tA, <second     pointer cell and then the cell that points at,
//   tA     DJN tMov, <first    so each walks down the core a cell a pass
//   tBomb  DAT #0, #0          (a process the last DJN drops dies here)
//
// The pointer cells start STREAM, STREAM + core/3 and STREAM + 2*core/3 cells
// above the last DJN, so in every pass the three decrements fall exactly a
// third of the core apart: what one does to an imp of a 3-point ring, the
// other two do to the imps a ring step either side of it.
//
// Why it can run for ever: a stream that has walked down to the stone meets
// the DJN lines from the top. It decrements the B-field of each DJN it passes,
// which only moves that DJN's pointer cell down one, and when it reaches its
// own DJN its own pointer moves and the walk starts again from the top. The
// three DJNs are the top three lines, each stream stops at its own, so the
// three lines below them are never touched. The first stream therefore works
// the STREAM cells above the stone, the second a third of the core more, the
// third two thirds: the three stay in step for the first STREAM passes, in
// which they cover the same stretch of all three thirds.
//
// The stone itself is layout-safe: gcd(STEP, core) is at least 8, the block is
// on residues 0-6 of that grain and the bombs on residue 7 (FIRST is moved
// down to it).
const ID = 'triple-stream-stone';
const mod = (x, n) => ((x % n) + n) % n;
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const cells = ['tHead', 'tMov', 'tAdd', 'tC', 'tB', 'tA', 'tBomb'];
const LEN = cells.length;

function geom(P, core) {
  const g = gcd(P.STEP, core), third = Math.round(core / 3);
  const first = P.FIRST - mod(P.FIRST - LEN, g);           // bombs on residue 7 from tHead
  return { g, third, first };
}

const tripleStream = {
  id: ID, kind: 'body', exit: 'never', processes: 1, grows: true, writes: 'sparse', entry: 'tHead', loop: 'tMov',
  purpose: 'A stone with three DJN decrement streams one third of the core apart, against 3-point imps: SPL 0 over a five-line loop that drops a DAT every STEP cells and decrements three cells a pass, core/3 apart, each stream walking down a cell a pass from STREAM, STREAM + core/3 and STREAM + 2*core/3 above the stone. Layout-safe, seven instructions.',
  params: { STEP: [8, 27000], FIRST: [16, 54000], STREAM: [16, 18000] },
  defaults: { STEP: 2936, FIRST: 2439, STREAM: 2400 },
  mutable: [['tHead', ['b']], ['tC', ['b']], ['tB', ['b']], ['tA', ['b']], ['tBomb', ['b']]],
  knowledge: {
    parameterRoles: {
      STEP: 'Between bombs. gcd(STEP, core) is the grain, at least 8: the stone covers 1/grain of the core.',
      FIRST: 'First bomb, from the head; moved down to the bomb residue.',
      STREAM: 'Where the first stream starts, above the stone; the others start a third and two thirds of the core further up. Just under a third of the core makes the first sweep cover everything.',
    },
    tuning: ['Five cycles a pass with one process: a bomb and three decrements. The SPL 0 adds a process a pass.', 'After STREAM passes the first stream starts again from the top while the other two walk on, so from then on only two of the three are a third apart at a time.'],
    failures: ['The streams decrement whatever lies above the stone, a partner or decoys in its own image included.', 'A DJN that brings a B-field to zero drops its process on the bomb; the SPL 0 replaces it.'],
    evidence: ['docs/hill-top30/88.md'],
  },
  mismatches(P, settings) {
    const core = settings.coreSize, out = [], G = geom(P, core);
    if (G.g < LEN + 1) return [`${ID}: STEP ${P.STEP} shares only ${G.g} with the core; the stone needs a grain of at least ${LEN + 1} to miss itself`];
    if (G.first < 2 * LEN) out.push(`${ID}: FIRST is too small once moved to its residue`);
    if (P.STREAM + 2 * G.third > core - 2 * LEN) out.push(`${ID}: the third stream would start below the stone and walk away from it`);
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, G = geom(P, core);
    ctx.ins('tHead', 'SPL', 'B', '0', `${G.first}`);
    ctx.ins('tMov', 'MOV', 'I', L('tBomb'), `@${L('tHead')}`);
    ctx.ins('tAdd', 'ADD', 'AB', `#${P.STEP}`, L('tHead'));
    // Each operand is from its own line; all three are measured from tA.
    ctx.ins('tC', 'DJN', 'B', L('tB'), `<${P.STREAM + 2 * G.third + 2}`);
    ctx.ins('tB', 'DJN', 'B', L('tA'), `<${P.STREAM + G.third + 1}`);
    ctx.ins('tA', 'DJN', 'B', L('tMov'), `<${P.STREAM}`);
    ctx.ins('tBomb', 'DAT', 'F', '#0', '#0');
  },
  watch(api) {
    const { vm, P, core } = api, G = geom(P, core);
    const at = Object.fromEntries(cells.map((l) => [l, api.at(l)]));
    const streams = [at.tA, at.tB, at.tC];                       // stream j's DJN
    const intact = () => ['tMov', 'tAdd'].every((l) => api.same(vm.peek(at[l]), api.code(l)))
      && ['tC', 'tB', 'tA'].every((l) => vm.peek(at[l]).op === 'DJN' && api.norm(vm.peek(at[l]).a) === api.norm(api.code(l).a));
    const counts = [0, 0, 0], bombCells = new Set();
    const inStep = Math.min(P.STREAM - 4, 400);                  // passes checked cell for cell
    return {
      before(pc) {
        const j = streams.indexOf(pc);
        if (j >= 0 && intact()) {
          const c = api.norm(pc + vm.peek(pc).b);
          return { j, target: api.norm(c + vm.peek(c).b - 1) };
        }
        if (pc === at.tMov && intact()) return { bomb: api.norm(at.tHead + vm.peek(at.tHead).b) };
        return null;
      },
      after(t) {
        if (!t) return;
        if (t.bomb !== undefined) {
          if (api.inSelf(t.bomb)) throw new Error(`${ID}: it bombed itself`);
          if (vm.peek(t.bomb).op !== 'DAT') throw new Error(`${ID}: it dropped something other than its DAT`);
          bombCells.add(t.bomb);
          return;
        }
        const n = ++counts[t.j];
        // No stream ever reaches the three lines under the DJNs.
        if (api.norm(t.target - at.tHead) < 3) throw new Error(`${ID}: stream ${t.j + 1} decremented the stone's own loop`);
        // Alone, for the first passes: pass n of stream j is n cells below its start, a third above stream j-1.
        if (api.alone && n <= inStep && t.target !== api.norm(at.tA + P.STREAM + t.j * G.third - n)) throw new Error(`${ID}: stream ${t.j + 1} is not a third of the core from its neighbour on pass ${n}`);
      },
      final() {
        if (!api.alone) return;
        if (counts.some((n) => n < inStep)) throw new Error(`${ID}: a stream ran only ${Math.min(...counts)} passes`);
        if (Math.max(...counts) - Math.min(...counts) > vm.processes(0).length) throw new Error(`${ID}: the three streams are out of step`);
        if (bombCells.size < Math.min(100, core / G.g - 1)) throw new Error(`${ID}: it bombed only ${bombCells.size} cells`);
        if (!vm.processes(0).some((q) => api.inSelf(q))) throw new Error(`${ID}: the stone stopped`);
      },
    };
  },
};

export default [tripleStream];
