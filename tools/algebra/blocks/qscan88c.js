// opening-qscan-full-88: a full-size ICWS'88 quickscan with no decoder.
//
// The hill's quickscans (docs/hill-top30/88.md) fit 12 to 18 comparisons and a
// burst in 36 to 48 lines by decoding the hit from tables hidden in spare
// B-fields. This block gets the same size a simpler way, written from scratch:
// every pair is two lines,
//
//   CMP low, low+GAP      equal: skip the next line
//   MOV #low, qP          differ: the probe is this pair's low cell
//
// and there is nothing else: no ladder, no table, no jump. After the last pair
// it falls into the next block with the probe on the last pair that differed,
// or still on the image boundary. Eighteen pairs are 36 lines and one data
// cell; with probe-burst-88 (set its GAP to this GAP, so its two streams cover
// both cells of the pair) that is 49.
//
// The price is time, not space: a hit does not leave the scan, so the attack
// starts PAIRS + 1 cycles after the round does whichever pair differed, where
// a decoding quickscan answers an early pair a dozen cycles sooner.
const ID = 'opening-qscan-full-88';
const MARKER = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };
const mod = (x, n) => ((x % n) + n) % n;
const low = (P, i) => P.START + i * P.SPACING;

const qscanFull = {
  id: ID, kind: 'opening', exit: 'next', link: 'fall', processes: 1, writes: 'sparse', entry: 'qScan',
  purpose: "ICWS'88 full-size quickscan without a decoder: PAIRS comparisons of cells GAP apart (SPACING apart from START), each followed by a MOV that sets the probe to that pair's low cell when the pair differs; it falls into the next block after PAIRS cycles plus one for each pair that differed, with the probe on the last such pair or on the image boundary. 2*PAIRS instructions and one data cell: 18 pairs in 37.",
  params: { PAIRS: [2, 24], START: [60, 54000], SPACING: [20, 27000], GAP: [2, 4000] },
  defaults: { PAIRS: 18, START: 400, SPACING: 400, GAP: 43 },
  provides: { probe: 'qP' },
  mutable: [['qP', ['a', 'b']]],
  knowledge: {
    parameterRoles: { PAIRS: 'Comparisons: two cells and two lines each.', START: 'Low cell of the first pair, from the probe.', SPACING: 'Between pairs.', GAP: 'Between the two cells of a pair; give probe-burst-88 the same GAP.' },
    tuning: ['Every round costs PAIRS cycles before the body starts, hit or not.', 'The probe names the low cell of the pair, not the cell that is occupied: follow it with a burst whose two streams are GAP apart.'],
    failures: ['Two cells that hold the same instruction are invisible.', 'If several pairs differ only the last is attacked.'],
    evidence: ['docs/hill-top30/88.md'],
  },
  mismatches(P, { coreSize: core, maxLength: room }) {
    const out = [], cells = [];
    for (let i = 0; i < P.PAIRS; i++) {
      const a = mod(low(P, i), core), b = mod(low(P, i) + P.GAP, core);
      cells.push(a, b);
      if ([a, b].some((c) => c < room || c > core - room)) { out.push(`${ID}: pair ${i} looks at the image`); break; }
    }
    if (new Set(cells).size !== cells.length) out.push(`${ID}: two probes are the same cell`);
    return out;
  },
  state(ctx) {
    ctx.ins('qP', 'DAT', 'F', '#0', `#${ctx.span - ctx.pc()}`);
  },
  emit(ctx) {
    const { L, P, core } = ctx, qP = L('qP');
    for (let i = 0; i < P.PAIRS; i++) {
      const a = mod(low(P, i), core);
      ctx.ins(i ? '' : 'qScan', 'CMP', 'I', `${qP}+${a}`, `${qP}+${mod(a + P.GAP, core)}`);
      ctx.ins(i === P.PAIRS - 1 ? 'qLast' : '', 'MOV', 'AB', `#${a}`, qP);
    }
  },
  // The gate's find: something on the low cell of the first pair.
  plant(api) {
    return [[api.at('qP') + low(api.P, 0), MARKER]];
  },
  watch(api) {
    const { vm, P } = api, qP = api.at('qP'), scan = api.at('qScan'), last = api.at('qLast');
    const cell = (offset) => vm.peek(api.norm(qP + offset));
    let expected, cycles = 0, done = false;
    const check = () => {
      done = true;
      if (api.norm(vm.peek(qP).b) !== api.norm(expected.b)) throw new Error(`${ID}: the probe is not on the last pair that differed`);
      if (cycles !== P.PAIRS + expected.hits) throw new Error(`${ID}: the scan took ${cycles} cycles, not ${P.PAIRS + expected.hits}`);
    };
    return {
      before(pc) {
        if (pc === scan && expected === undefined) {
          expected = { b: api.code('qP').b, hits: 0 };
          for (let i = 0; i < P.PAIRS; i++) if (!api.same(cell(low(P, i)), cell(low(P, i) + P.GAP))) { expected.b = low(P, i); expected.hits++; }
        }
        if (expected === undefined || done) return null;
        if (api.norm(pc - scan) < 2 * P.PAIRS) { cycles++; return { pc }; }
        check();                                       // the first step outside the scan
        return null;
      },
      after(t) {
        // The last line is the last step when the last pair differed; otherwise the scan left a line earlier.
        if (t && !done && (t.pc === last || (t.pc === api.norm(last - 1) && vm.processes(0)[0] !== last))) check();
      },
      final() {
        if (expected !== undefined && !done) throw new Error(`${ID}: it never handed on`);
      },
    };
  },
};

export default [qscanFull];
