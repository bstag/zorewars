// Blocks from the Koenigstuhl Tiny hill's top 10 (800 cells, 20 instructions;
// docs/hill-top10/tiny.md): the compact engines the catalog did not have, so
// the recipes in tools/algebra/recipes-top10/tiny.js play like the originals.
//
// - tiny-qbomb: unrolled MOV lines that each touch one far cell through an
//   incrementing or decrementing pointer and copy what it points at somewhere
//   else, one cycle a line: decoys for scanners and a quick bomb (Tarragon,
//   Chorus, Microcosmos, Resinoid and the four evolved bvowk warriors).
// - inv-qscan: inversed's 11-line quickscan (Double Shock, Consonance): two
//   SNE/SEQ units test seven cells in four or five cycles, one MUL.X decodes
//   the hit, and a four-line loop bombs outward both ways until it sees two
//   equal cells.
// - tiny-silk2: the Tiny hill's paper: a 6- or 7-process fan, two silk stages
//   (the second step tied to the first, 3X + Y = 1 in Tarragon and
//   Consonance) and a 2- or 3-line tail in which every copy's processes turn
//   into a clear (Tarragon, Consonance, the four evolved warriors).
// - chorus-silk: Chorus's paper: a fan copies the silk to a mirror half the
//   core away, then each copy runs a one-stage silk whose processes also
//   rebuild their own copy CRAWL cells on and move into it.
// - satellite-silk: Microcosmos's four-line silk that copies, with every copy,
//   a SPL-fed satellite clear from where the copy before left one
//   (ORBIT = STEP + DIST), and starts it.
// - resin-boot: Resinoid's boot: four processes copy one four-line resin clear
//   to two places half the core apart and a silk-imp paper to a third, the
//   SPLs' own A-fields counting the copies, and start all three.
// - twin-clear: Double Shock's boot of one four-line SPL-fed double clear to
//   two places half the core apart.
// - djn-stream1: the one-line DJN.F stream one of the evolved warriors runs
//   beside its paper.
//
// All Redcode here is written from scratch from the descriptions in
// docs/hill-top10/tiny.md; the hill warriors were read for ideas, never
// copied. How to write a block: docs/block-algebra.md.

import { modInverse } from '../util.js';

const MARKER = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };
const mod = (x, n) => ((x % n) + n) % n;
// Addressing modes as parameters: the index of the mode in this string.
const MODES = '{}<>$@*#';
const OPS = ['MOV', 'DJN', 'JMP', 'DAT'];
const sameShape = (a, b) => a.op === b.op && a.aMode === b.aMode && a.bMode === b.bMode;
// Does a process stand on a cell shaped like one of these (numbers may differ)?
const onShape = (api, shapes) => api.vm.processes(0).some((q) => { const x = api.vm.peek(q); return shapes.some((y) => sameShape(x, y)); });

// ---------------------------------------------------------------------------
// tiny-qbomb
//
// COUNT unrolled lines MOV.I <m>a, $b. The A operand's pointer cell is
// decremented or incremented (mode { } < >), so an empty cell there becomes a
// non-zero decoy, and what it then points at is copied to b: on empty core a
// blank, which kills whatever stood at b. One cycle a line.
//   FORM 0: line i reads A0 + i*AS and writes B0 + i*BS (both counted from the
//           block's first line), mode AM: the FOR-loop form of Tarragon,
//           Chorus and Microcosmos.
//   FORM 1: each line its own Ai, Bi (counted from that line) and mode Mi: the
//           evolved warriors' lines.
const QB_MAX = 12;
const qbLines = (P, core) => Array.from({ length: P.COUNT }, (_, i) => (P.FORM
  ? { m: MODES[P[`M${i + 1}`]], a: mod(P[`A${i + 1}`], core), b: mod(P[`B${i + 1}`], core) }
  : { m: MODES[P.AM], a: mod(P.A0 + i * P.AS - i, core), b: mod(P.B0 + i * P.BS - i, core) }));
const qbParams = {}, qbDefaults = {};
for (let i = 1; i <= QB_MAX; i++) { qbParams[`A${i}`] = [0, 54000]; qbParams[`B${i}`] = [0, 54000]; qbParams[`M${i}`] = [0, 3]; qbDefaults[`A${i}`] = 100 + 25 * i; qbDefaults[`B${i}`] = 400 + 25 * i; qbDefaults[`M${i}`] = 0; }
const tinyQbomb = {
  id: 'tiny-qbomb',
  kind: 'opening', exit: 'next', link: 'fall', processes: 1, writes: 'sparse', dialects: '94',
  entry: 'q0',
  purpose: 'Unrolled quick bomb: COUNT lines MOV.I {a, b (or }a, <a, >a), one cycle each; the pointer cell turns into a decoy and what it points at (a blank on empty core) is copied over b. FORM 0 spaces the cells arithmetically (A0 + i*AS, B0 + i*BS from the first line), FORM 1 gives every line its own A, B and mode; then it falls into the next block.',
  params: { FORM: [0, 1], COUNT: [1, QB_MAX], A0: [0, 54000], AS: [0, 54000], B0: [0, 54000], BS: [0, 54000], AM: [0, 3], ...qbParams },
  defaults: { FORM: 0, COUNT: 9, A0: 590, AS: 411, B0: 352, BS: 388, AM: 0, ...qbDefaults },
  mismatches(P, settings) {
    const big = ['A0', 'AS', 'B0', 'BS'].filter((k) => P[k] >= settings.coreSize);
    return big.length ? [`tiny-qbomb: ${big.join(', ')} must be smaller than the core`] : [];
  },
  linked(P, settings, label, { total }) {
    const core = settings.coreSize, q0 = label('q0');
    const bad = qbLines(P, core).findIndex(({ a, b }, i) => mod(q0 + i + a, core) < total || mod(q0 + i + b, core) < total);
    return bad < 0 ? [] : [`tiny-qbomb: line ${bad + 1} points into the warrior`];
  },
  emit(ctx) {
    const { P, core } = ctx;
    qbLines(P, core).forEach(({ m, a, b }, i) => ctx.ins(i ? '' : 'q0', 'MOV', 'I', `${m}${a}`, `$${b}`));
  },
  watch(api) {
    const { vm, P } = api, lines = qbLines(P, api.core), q0 = api.at('q0');
    let done = 0;
    return {
      before(pc) {
        if (done >= lines.length || pc !== api.add(q0, done)) return null;
        const { a, b } = lines[done], ptr = api.add(pc, a), x = vm.peek(ptr);
        return { pc, ptr, field: '{}'.includes(lines[done].m) ? 'a' : 'b', was: x, dest: api.add(pc, b) };
      },
      after(t) {
        if (!t) return;
        const now = vm.peek(t.ptr)[t.field], step = mod(now - t.was[t.field], api.core);
        if (step !== 1 && step !== api.core - 1 && t.ptr !== t.dest) throw new Error(`tiny-qbomb: line ${done + 1} did not step its pointer cell`);
        if (vm.lastWrite[t.dest] !== vm.steps || vm.writerPc[t.dest] !== t.pc) throw new Error(`tiny-qbomb: line ${done + 1} did not write its target`);
        done++;
      },
      final() {
        if (api.entered() && done !== lines.length) throw new Error(`tiny-qbomb ran ${done} of its ${lines.length} lines`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// inv-qscan
//
//   s0  SNE.F qf+a1, qf+v1       v1 = (QX-1)QY, a1 = v1(v1+1)
//       SEQ.F qf+a2, }qf         qf+QX; qf.A becomes QX+1   (a2 = w(w+1), w = QX*QY)
//       JMP   @qlo+1, {qf        a hit: qf.A back to QX-1 or QX, into the MUL
//       SNE.F qf+a3, qf+v3       v3 = (QX+1)QY, a3 = v3(v3+1)
//       JMZ.F next, <qf          qf.B = QY-1: qf+QY-1 too; nothing: hand on
//   qf  MUL.X #QX, #QY           both fields become A*B: the pair's first cell
//       JMZ.F @qlo+1, >qf        empty? then B+1 and MUL again: v(v+1), the other cell
//   qlo MOV   }QANY, >qf         bomb up from the find (what lies at qlo+QANY: blanks)
//       MOV   }qlo, {qf          and down
//       SEQ   {qf, >qf           two cells further out the same? hand on
//       DJN.F qlo, >qf
//
// The JMP's @qlo+1 and the MUL both lean on layout: qlo+1's B-field names qf.
// The SEQ unit decodes to qf+QX only if QX*QY = QX (mod core), so QX*(QY-1)
// must be a multiple of the core.
const IQ = { qf: 5, qlo: 7, size: 11 };
function iqCells(P, core) {
  const v1 = mod((P.QX - 1) * P.QY, core), w = mod(P.QX * P.QY, core), v3 = mod((P.QX + 1) * P.QY, core);
  const pair = (v) => mod(v * (v + 1), core);
  return { v1, a1: pair(v1), w, a2: pair(w), v3, a3: pair(v3), x: mod(P.QX, core), y1: mod(P.QY - 1, core) };
}
const invQscan = {
  id: 'inv-qscan',
  kind: 'opening', exit: 'next', link: 'fall', processes: 1, writes: 'sparse', dialects: '94',
  entry: 's0',
  purpose: 'inversed\'s 11-line quickscan (Double Shock, Consonance): an SNE/SEQ unit and an SNE/JMZ unit test seven cells in four or five cycles, one MUL.X #QX, #QY decodes the hit (a second MUL picks the other cell of the pair), and a four-line loop bombs outward both ways from the find until two cells further out are equal; then it falls into the next block.',
  params: { QX: [2, 54000], QY: [2, 54000], QANY: [20, 54000] },
  defaults: { QX: 150, QY: 577, QANY: 403 },
  mutable: [['qf', ['a', 'b']]],
  mismatches(P, settings) {
    const core = settings.coreSize;
    if (P.QX >= core || P.QY >= core || P.QANY >= core) return ['inv-qscan: QX, QY and QANY must be smaller than the core'];
    if (mod(P.QX * (P.QY - 1), core)) return [`inv-qscan: QX*(QY-1) is not a multiple of ${core}, so a hit on qf+QX decodes to another cell`];
    return [];
  },
  linked(P, settings, label, { total }) {
    const core = settings.coreSize, qf = label('qf'), c = iqCells(P, core);
    const cells = [c.a1, c.v1, c.a2, c.x, c.a3, c.v3, c.y1].map((d) => mod(qf + d, core));
    return cells.some((x) => x < total) ? ['inv-qscan: a scanned cell lies on the warrior'] : [];
  },
  emit(ctx) {
    const { L, P, core } = ctx, c = iqCells(P, core), qf = L('qf');
    ctx.ins('s0', 'SNE', 'F', `${qf}+${c.a1}`, `${qf}+${c.v1}`);
    ctx.ins('', 'SEQ', 'F', `${qf}+${c.a2}`, `}${qf}`);
    ctx.ins('', 'JMP', 'B', `@${L('qlo')}+1`, `{${qf}`);
    ctx.ins('', 'SNE', 'F', `${qf}+${c.a3}`, `${qf}+${c.v3}`);
    ctx.ins('', 'JMZ', 'F', ctx.next, `<${qf}`);
    ctx.ins('qf', 'MUL', 'X', `#${P.QX}`, `#${P.QY}`);
    ctx.ins('', 'JMZ', 'F', `@${L('qlo')}+1`, `>${qf}`);
    ctx.ins('qlo', 'MOV', 'I', `}${P.QANY}`, `>${qf}`);
    ctx.ins('', 'MOV', 'I', `}${L('qlo')}`, `{${qf}`);
    ctx.ins('', 'SEQ', 'I', `{${qf}`, `>${qf}`);
    ctx.ins('', 'DJN', 'F', L('qlo'), `>${qf}`);
  },
  // A body on the first scanned cell (the first SNE fires).
  plant(api) { return [[api.add(api.at('qf'), iqCells(api.P, api.core).a1), MARKER]]; },
  watch(api) {
    const { vm } = api, qlo = api.at('qlo'), planted = api.scenario === 'inv-qscan: planted target';
    const target = planted ? api.add(api.at('qf'), iqCells(api.P, api.core).a1) : null;
    let near = 0, bombs = 0;
    return {
      before(pc) { return pc === qlo || pc === api.add(qlo, 1) ? { pc } : null; },
      after(t) {
        if (!t) return;
        bombs++;
        if (planted) for (let d = -3; d <= 3; d++) if (vm.lastWrite[api.add(target, d)] === vm.steps) near++;
      },
      final() {
        if (planted && api.entered() && (!bombs || !near)) throw new Error('inv-qscan did not bomb the body it found');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// tiny-silk2
//
//   fan     FAN 6: SPL 2 / SPL 1 / SPL 1 (six processes; the B-fields are decoys)
//           FAN 7: SPL 1 / SPL 1 / MOV -1, #f: the first of four copies the SPL
//                  over the MOV, the other three split on it: seven processes
//           FAN 8: SPL 2 / MOV decoy / SPL 1 / MOV -1, #f: seven processes too
//   sx      SPL @0, <m>X        each process launches one at sx+X ...
//           MOV }sx, >sx        ... and copies one cell there (N cells)
//   sy      SPL @0, <m>Y        the same Y on
//           MOV }sy, >sy
//   tail    TLEN lines, each OP <m>a, <m>b (MOV.I, DJN.F, JMP or DAT): what every
//           copy's processes do once they have copied: a clear that copies
//           far cells over the core and over the copy's own past, and a DJN
//           stream (Tarragon: MOV >sx, {0 / DJN.F -2, <-49).
//
// The B mode of each SPL (X_M, Y_M) touches the cell the copy goes to, so a
// copy that lands on an opponent decrements it before overwriting it. The
// processes of the X copy run both stages, those of the Y copies only Y.
const SF = { 6: { procs: 6, len: 3 }, 7: { procs: 7, len: 3 }, 8: { procs: 7, len: 4 } };
const s2Procs = (P) => SF[P.FAN].procs;
const s2Body = (P) => 4 + P.TLEN;
const tailParams = {}, tailDefaults = {};
for (let i = 1; i <= 3; i++) Object.assign(tailParams, { [`T${i}O`]: [0, 3], [`T${i}AM`]: [0, 7], [`T${i}A`]: [0, 54000], [`T${i}BM`]: [0, 7], [`T${i}B`]: [0, 54000] });
Object.assign(tailDefaults, { T1O: 0, T1AM: 3, T1A: 796, T1BM: 0, T1B: 0, T2O: 1, T2AM: 4, T2A: 798, T2BM: 2, T2B: 751, T3O: 1, T3AM: 4, T3A: 798, T3BM: 2, T3B: 751 });
const silk2 = {
  id: 'tiny-silk2',
  kind: 'body', exit: 'never', grows: true, writes: 'sparse', roams: true, dialects: '94',
  processes: (P) => s2Procs(P),
  entry: 'fan', loop: 'sx',
  purpose: 'The Tiny hill\'s two-stage paper: a fan of six (FAN 6) or seven (FAN 7, 8) processes, a silk stage that copies the body X on and starts the processes there, a second stage Y on, and a tail of TLEN lines (MOV, DJN, JMP or DAT with any modes) that every copy\'s processes run afterwards, typically a clear that copies far cells backward over the copy\'s own past and a DJN stream (Tarragon, Consonance, the evolved bvowk warriors).',
  params: {
    FAN: [6, 8], F1M: [0, 3], F1: [0, 54000], F2M: [0, 3], F2: [0, 54000], F3M: [0, 3], F3: [0, 54000],
    DM: [0, 3], DA: [0, 54000], DB: [0, 54000],
    X: [8, 54000], XM: [0, 3], Y: [8, 54000], YM: [0, 3], TLEN: [2, 3], ...tailParams,
  },
  defaults: { FAN: 6, F1M: 0, F1: 100, F2M: 0, F2: 200, F3M: 0, F3: 300, DM: 0, DA: 176, DB: 305, X: 486, XM: 0, Y: 105, YM: 0, TLEN: 2, ...tailDefaults },
  mutable: (P) => [['sx', ['a', 'b']], ['sy', ['a', 'b']], ...Array.from({ length: P.TLEN }, (_, i) => [`t${i}`, ['a', 'b']]), ...(P.FAN === 6 ? [] : [['fself', ['a', 'b']]])],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [], n = s2Procs(P), body = s2Body(P);
    if (!SF[P.FAN]) return ['tiny-silk2: FAN is 6, 7 or 8'];
    if (n !== body) out.push(`tiny-silk2: ${n} processes copy ${n} cells, but the body is ${body} cells (TLEN ${P.TLEN} with FAN ${P.FAN})`);
    const clear = (s, from) => mod(s, core) >= body - from + 1 && mod(-s, core) >= n + from + 1;
    if (!clear(P.X, 0)) out.push('tiny-silk2: X copies onto the paper');
    if (!clear(P.Y, 2)) out.push('tiny-silk2: Y copies onto the paper');
    if (settings.maxProcesses < 8 * n) out.push(`tiny-silk2 needs room to grow (${8 * n} processes)`);
    if (['X', 'Y', 'F1', 'F2', 'F3', 'DA', 'DB'].some((k) => P[k] >= core)) out.push('tiny-silk2: offsets must be smaller than the core');
    return out;
  },
  emit(ctx) {
    const { L, P } = ctx, m = (k) => MODES[P[k]];
    if (P.FAN === 6) {
      ctx.ins('fan', 'SPL', 'B', '2', `${m('F1M')}${P.F1}`);
      ctx.ins('', 'SPL', 'B', '1', `${m('F2M')}${P.F2}`);
      ctx.ins('', 'SPL', 'B', '1', `${m('F3M')}${P.F3}`);
    } else {
      ctx.ins('fan', 'SPL', 'B', `${P.FAN === 8 ? 2 : 1}`, `${m('F1M')}${P.F1}`);
      if (P.FAN === 8) ctx.ins('', 'MOV', 'I', `${m('DM')}${P.DA}`, `$${P.DB}`);
      ctx.ins('', 'SPL', 'B', '1', `${m('F2M')}${P.F2}`);
      ctx.ins('fself', 'MOV', 'I', '$-1', `#${P.F3}`);
    }
    for (const [s, step, sm] of [['sx', P.X, 'XM'], ['sy', P.Y, 'YM']]) {
      ctx.ins(s, 'SPL', 'B', '@0', `${m(sm)}${step}`);
      ctx.ins('', 'MOV', 'I', `}${L(s)}`, `>${L(s)}`);
    }
    for (let i = 0; i < P.TLEN; i++) {
      const k = (f) => P[`T${i + 1}${f}`], o = OPS[k('O')];
      ctx.ins(`t${i}`, o, o === 'MOV' ? 'I' : o === 'JMP' ? 'B' : 'F', `${MODES[k('AM')]}${k('A')}`, `${MODES[k('BM')]}${k('B')}`);
    }
  },
  running(api) {
    const shapes = [api.code('sx'), api.code('sx', 1), ...Array.from({ length: api.P.TLEN }, (_, i) => api.code(`t${i}`))];
    return onShape(api, shapes);
  },
  watch(api) {
    const { vm, P } = api, n = s2Procs(P), body = s2Body(P);
    const stages = [['sx', P.X, body], ['sy', P.Y, body - 2]].map(([l, s, len]) => ({ l, mov: api.add(api.at(l), 1), to: api.add(api.at(l), s), len, runs: 0, ok: false }));
    return {
      before(pc) { return stages.find((s) => s.mov === pc && !s.ok) ?? null; },
      after(s) {
        if (!s || ++s.runs !== n) return;
        for (let k = 0; k < s.len; k++) if (!sameShape(vm.peek(api.add(s.to, k)), api.code(s.l, k))) throw new Error(`tiny-silk2: stage ${s.l} made an incomplete copy (cell ${k})`);
        s.ok = true;
      },
      final() {
        if (!api.entered() || !api.alone) return;
        if (!stages.every((s) => s.ok)) throw new Error('tiny-silk2: a stage never finished its first copy');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// chorus-silk
//
//   fan   SPL 2 / SPL 1 / SPL 1          six processes (B-fields: decoys)
//         MOV {sx, {bp                   each copies one cell of the silk, last first,
//   bp    SPL sx+DIST+6, F4              ... to sx+DIST, then starts one there
//   sx    SPL @6, >X                     A counted 6 down to 0 by the boot: SPL @0
//         MOV }sx, >sx                   the silk copies the six cells X on
//         MOV >M1A, {M1B                 a blank (or whatever) over the core ...
//         MOV >M2A, {M2B                 ... and over the copy CRAWL cells back
//         MOV {sx, {sy                   copy the silk again, last cell first,
//   sy    DJN.F CRAWL+1, <DJS            CRAWL cells on, and move into it
//
// Twelve processes start (six on each copy); every copy both throws a copy X
// on and crawls CRAWL on. The mirror DIST away (half the core) gives the
// paper two independent lineages from the first cycle.
const chorusSilk = {
  id: 'chorus-silk',
  kind: 'body', exit: 'never', grows: true, writes: 'sparse', roams: true, dialects: '94',
  processes: 12, entry: 'fan', loop: 'sx',
  purpose: 'Chorus\'s paper: a fan of six copies the six-line silk DIST away (a mirror half the core off) and starts six processes in each copy; every copy throws a copy X on, lays two blanks (or whatever its pointers read) over the core and over its own past, and rebuilds itself CRAWL cells on and moves into the rebuilt copy.',
  params: { X: [8, 54000], DIST: [20, 54000], CRAWL: [6, 200], M1A: [0, 54000], M1B: [0, 54000], M2A: [0, 54000], M2B: [0, 54000], DJS: [0, 54000], F1: [0, 54000], F2: [0, 54000], F3: [0, 54000], F4: [0, 54000] },
  defaults: { X: 67, DIST: 400, CRAWL: 12, M1A: 688, M1B: 368, M2A: 703, M2B: 788, DJS: 45, F1: 280, F2: 690, F3: 300, F4: 709 },
  mutable: [['sx', ['a', 'b']], ['sy', ['a', 'b']], ['bp', ['a', 'b']], ['m1', ['a', 'b']], ['m2', ['a', 'b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (['X', 'DIST', 'M1A', 'M1B', 'M2A', 'M2B', 'DJS', 'F1', 'F2', 'F3', 'F4'].some((k) => P[k] >= core)) out.push('chorus-silk: offsets must be smaller than the core');
    if (mod(P.X, core) < 13 || mod(-P.X, core) < 13) out.push('chorus-silk: X copies onto the silk');
    if (mod(P.DIST, core) < 30 || mod(-P.DIST, core) < 30) out.push('chorus-silk: DIST puts the mirror on the warrior');
    if (settings.maxProcesses < 100) out.push('chorus-silk needs room to grow');
    return out;
  },
  emit(ctx) {
    const { L, P } = ctx;
    ctx.ins('fan', 'SPL', 'B', '2', `{${P.F1}`);
    ctx.ins('', 'SPL', 'B', '1', `{${P.F2}`);
    ctx.ins('', 'SPL', 'B', '1', `{${P.F3}`);
    ctx.ins('', 'MOV', 'I', `{${L('sx')}`, `{${L('bp')}`);
    ctx.ins('bp', 'SPL', 'B', `${L('sx')}+${P.DIST + 6}`, `{${P.F4}`);
    ctx.ins('sx', 'SPL', 'B', '@6', `>${P.X}`);
    ctx.ins('', 'MOV', 'I', `}${L('sx')}`, `>${L('sx')}`);
    ctx.ins('m1', 'MOV', 'I', `>${P.M1A}`, `{${P.M1B}`);
    ctx.ins('m2', 'MOV', 'I', `>${P.M2A}`, `{${P.M2B}`);
    ctx.ins('', 'MOV', 'I', `{${L('sx')}`, `{${L('sy')}`);
    ctx.ins('sy', 'DJN', 'F', `${P.CRAWL + 1}`, `<${P.DJS}`);
  },
  running(api) { return onShape(api, [api.code('sx', 1), api.code('sx', 4), api.code('sy'), { op: 'SPL', aMode: '@', bMode: '>' }]); },
  watch(api) {
    const { vm, P } = api, sx = api.at('sx'), bp = api.at('bp'), mirror = api.add(sx, P.DIST);
    let booted = 0, crawled = 0;
    return {
      before(pc) { return pc === bp ? 'bp' : pc === api.add(sx, 5) ? 'crawl' : null; },
      after(t) {
        if (t === 'bp' && ++booted === 6) {
          for (let k = 1; k < 6; k++) if (!sameShape(vm.peek(api.add(mirror, k)), api.code('sx', k))) throw new Error(`chorus-silk: the mirror copy is incomplete (cell ${k})`);
          if (vm.peek(mirror).op !== 'SPL') throw new Error('chorus-silk: the mirror copy has no SPL');
        }
        if (t === 'crawl') crawled++;
      },
      final() {
        if (!api.entered() || !api.alone) return;
        if (booted < 6 || crawled < 6) throw new Error(`chorus-silk: booted ${booted} of 6, crawled ${crawled} times`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// satellite-silk
//
// State (laid before all code): the satellite, a SPL-fed clear
//   sat  SPL #SA0, <SB0 / MOV }0, >SB1 / MOV >SA2, {SB2 / DJN.F -2, <-3
// Code:
//   boost  SPL 1, sat            four processes ...
//          SPL 1, {F2
//          MOV >boost, >launch   ... copy the satellite to launch+DIST-4
//   silk   SPL @0, {STEP
//          MOV }silk, >silk      the four-line silk STEP on
//          MOV <launch, {launch  copy the satellite DIST-1..DIST-4 past launch to
//   launch DJN.F ORBIT, {DIST-4  ORBIT-1..ORBIT-4, and move into it
// ORBIT = STEP + DIST: the satellite each copy reads is the one the copy
// before it laid, so every generation launches a satellite from its parent's.
const SAT = 4;
const satelliteSilk = {
  id: 'satellite-silk',
  kind: 'body', exit: 'never', grows: true, writes: 'sparse', roams: true, dialects: '94',
  processes: 4, entry: 'boost', loop: 'silk',
  purpose: 'Microcosmos\'s paper with a satellite: four processes copy a four-line SPL-fed satellite clear (laid before the code) beside the silk, then run a four-line silk STEP on whose every copy also copies the satellite its parent left ORBIT = STEP + DIST away and starts its four processes in it.',
  params: { STEP: [8, 54000], DIST: [8, 54000], SA0: [0, 54000], SB0: [0, 54000], SB1: [0, 54000], SA2: [0, 54000], SB2: [0, 54000], F2: [0, 54000] },
  defaults: { STEP: 104, DIST: 41, SA0: 672, SB0: 511, SB1: 117, SA2: 4, SB2: 794, F2: 517 },
  mutable: [['boost', ['b']], ['silk', ['a', 'b']], ['launch', ['a', 'b']], ['sat', ['a', 'b']], ['sat1', ['a', 'b']], ['sat2', ['a', 'b']], ['sat3', ['a', 'b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (['STEP', 'DIST', 'SA0', 'SB0', 'SB1', 'SA2', 'SB2', 'F2'].some((k) => P[k] >= core)) out.push('satellite-silk: offsets must be smaller than the core');
    if (mod(P.STEP, core) < 9 || mod(-P.STEP, core) < 9) out.push('satellite-silk: STEP copies onto the silk');
    if (P.DIST < SAT + 2 || mod(P.STEP + P.DIST, core) < SAT + 2) out.push('satellite-silk: the satellite copies land on the silk');
    return out;
  },
  state(ctx) {
    const { P } = ctx;
    ctx.ins('sat', 'SPL', 'B', `#${P.SA0}`, `<${P.SB0}`);
    ctx.ins('sat1', 'MOV', 'I', '}0', `>${P.SB1}`);
    ctx.ins('sat2', 'MOV', 'I', `>${P.SA2}`, `{${P.SB2}`);
    ctx.ins('sat3', 'DJN', 'F', '-2', '<-3');
  },
  emit(ctx) {
    const { L, P } = ctx;
    ctx.ins('boost', 'SPL', 'B', '1', L('sat'));
    ctx.ins('', 'SPL', 'B', '1', `{${P.F2}`);
    ctx.ins('', 'MOV', 'I', `>${L('boost')}`, `>${L('launch')}`);
    ctx.ins('silk', 'SPL', 'B', '@0', `{${P.STEP}`);
    ctx.ins('', 'MOV', 'I', `}${L('silk')}`, `>${L('silk')}`);
    ctx.ins('', 'MOV', 'I', `<${L('launch')}`, `{${L('launch')}`);
    ctx.ins('launch', 'DJN', 'F', `${P.STEP + P.DIST}`, `{${P.DIST - SAT}`);
  },
  running(api) { return onShape(api, [api.code('silk', 1), api.code('silk', 2), api.code('launch'), api.code('sat'), api.code('sat1'), api.code('sat2'), api.code('sat3')]); },
  watch(api) {
    const { vm, P } = api, launch = api.at('launch'), silk = api.at('silk');
    let entered = 0, copies = 0;
    return {
      before(pc) { return pc === launch ? { k: 'djn', t: api.add(launch, vm.peek(launch).a) } : pc === api.add(silk, 1) ? { k: 'copy' } : null; },
      after(t) {
        if (!t) return;
        if (t.k === 'copy') { copies++; return; }
        if (vm.processes(0).includes(t.t) && sameShape(vm.peek(t.t), api.code('sat'))) entered++;
      },
      final() {
        if (!api.entered() || !api.alone) return;
        if (copies < SAT || entered < 1) throw new Error(`satellite-silk: ${copies} silk copies, ${entered} processes into a satellite`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// resin-boot
//
//         SPL 1, <F1 / SPL 1, >F2         four processes
//         MOV {resin, {cb1                each copies one resin cell (the SPL's A
//         MOV {pad, {cb2                  counts 4 down to 0, then pad's A does),
//         MOV {paper, {pb                 one paper cell
//   cb1   SPL resin+HOP1+4, }F3           start four in clear 1 (A: counted down to it)
//   cb2   SPL resin+HOP2+4, {F4           four in clear 2
//   pb    JMZ.F *paper+PHOP+4, >F5        four in the paper (always jumps: B is empty)
//   paper SPL @4, ISTEP+1                 silk stage ISTEP+1 on (A counted down to 0)
//         MOV }paper, >paper
//         SPL >0, }2*ISTEP                each process starts one at an imp
//         MOV.I #-1, ISTEP                the imp (ISTEP = 1/POINTS mod the core)
//   resin SPL 4, {resin-4                 A counted down to 0: SPL 0, the feeder
//         MOV 1, <1                       resin: MOV <0, <RB laid downward ...
//         MOV <0, <RB                     ... each a trail-layer itself
//         DJN.F -2, {resin-4
//   pad   (the next block, or a blank: its A-field is the second counter)
const RB = { size: 16 };
const rbImpStep = (P, core) => modInverse(P.POINTS || (core % 3 ? 3 : 13), core);
const resinBoot = {
  id: 'resin-boot',
  kind: 'body', exit: 'never', grows: true, writes: 'core', dialects: '94', roams: true,
  processes: 12, entry: 'go', loop: 'clear',
  purpose: 'Resinoid\'s boot: four processes copy a four-line resin clear (SPL 0 feeding MOV 1, <1 / MOV <0, <RB / DJN, which lays trails of MOV <0, <RB downward) to two places, HOP1 and HOP2 on, and a four-line silk-imp paper PHOP on (a stage ISTEP+1 on, then SPL >0 starting an imp per process), each copy counted by an SPL\'s own A-field, and start four processes in each. Needs a blank cell after it.',
  params: { HOP1: [20, 54000], HOP2: [20, 54000], PHOP: [20, 54000], RB: [0, 54000], POINTS: [0, 31], F1: [0, 54000], F2: [0, 54000], F3: [0, 54000], F4: [0, 54000], F5: [0, 54000] },
  defaults: { HOP1: 296, HOP2: 696, PHOP: 188, RB: 345, POINTS: 0, F1: 192, F2: 419, F3: 386, F4: 399, F5: 249 },
  mutable: [['cb1', ['a']], ['cb2', ['a']], ['pb', ['a', 'b']], ['paper', ['a', 'b']], ['spawn', ['b']], ['resin', ['a']], ['clear', ['b']], ['trail', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (!rbImpStep(P, core)) out.push(`resin-boot: no ${P.POINTS || 3}-point imp on a ${core}-cell core`);
    if (['HOP1', 'HOP2', 'PHOP', 'RB', 'F1', 'F2', 'F3', 'F4', 'F5'].some((k) => P[k] >= core)) out.push('resin-boot: offsets must be smaller than the core');
    const far = (h) => mod(h, core) >= 20 && mod(h, core) <= core - 40;
    if (!far(P.HOP1) || !far(P.HOP2) || !far(P.PHOP)) out.push('resin-boot: a copy lands on the warrior');
    if (Math.abs(mod(P.HOP1 - P.HOP2, core)) < 8 || mod(P.HOP2 - P.HOP1, core) < 8) out.push('resin-boot: the two clears overlap');
    return out;
  },
  linked(P, settings, label, { total }) {
    return label('resin') + 4 !== total ? ['resin-boot must be last: the blank cell after it is its second copy counter'] : [];
  },
  emit(ctx) {
    const { L, P, core } = ctx, s = rbImpStep(P, core);
    ctx.ins('go', 'SPL', 'B', '1', `<${P.F1}`);
    ctx.ins('', 'SPL', 'B', '1', `>${P.F2}`);
    ctx.ins('', 'MOV', 'I', `{${L('resin')}`, `{${L('cb1')}`);
    ctx.ins('', 'MOV', 'I', `{${L('resin')}+4`, `{${L('cb2')}`);
    ctx.ins('', 'MOV', 'I', `{${L('paper')}`, `{${L('pb')}`);
    ctx.ins('cb1', 'SPL', 'B', `${L('resin')}+${P.HOP1 + 4}`, `}${P.F3}`);
    ctx.ins('cb2', 'SPL', 'B', `${L('resin')}+${P.HOP2 + 4}`, `{${P.F4}`);
    ctx.ins('pb', 'JMZ', 'F', `*${L('paper')}+${P.PHOP + 4}`, `>${P.F5}`);
    ctx.ins('paper', 'SPL', 'B', '@4', `${s + 1}`);
    ctx.ins('', 'MOV', 'I', `}${L('paper')}`, `>${L('paper')}`);
    ctx.ins('spawn', 'SPL', 'B', '>0', `}${mod(2 * s, core)}`);
    ctx.ins('', 'MOV', 'I', '#-1', `${s}`);
    ctx.ins('resin', 'SPL', 'B', '4', `{${L('resin')}-4`);
    ctx.ins('clear', 'MOV', 'I', '1', '<1');
    ctx.ins('trail', 'MOV', 'I', '<0', `<${P.RB}`);
    ctx.ins('', 'DJN', 'F', L('clear'), `{${L('resin')}-4`);
  },
  running(api) { return onShape(api, [api.code('clear'), api.code('trail'), api.code('paper', 1), api.code('spawn', 1), { op: 'MOV', aMode: '<', bMode: '<' }]); },
  watch(api) {
    const { vm, P } = api, resin = api.at('resin');
    const sites = [P.HOP1, P.HOP2].map((h) => api.add(resin, h));
    const paperAt = api.add(api.at('paper'), P.PHOP);
    let started = 0;
    return {
      before(pc) { return pc === api.at('pb') ? 'pb' : null; },
      after(t) {
        if (t !== 'pb' || started++) return;
        for (const c of sites) {
          if (vm.peek(c).op !== 'SPL' || vm.peek(c).a !== 0) throw new Error('resin-boot: a clear copy does not start with SPL 0');
          for (let k = 1; k < 4; k++) if (!api.same(vm.peek(api.add(c, k)), api.code('resin', k))) throw new Error(`resin-boot: a clear copy is incomplete (cell ${k})`);
        }
        for (let k = 1; k < 4; k++) if (!api.same(vm.peek(api.add(paperAt, k)), api.code('paper', k))) throw new Error(`resin-boot: the paper copy is incomplete (cell ${k})`);
        if (vm.processes(0).filter((q) => q === sites[0] || q === sites[1] || q === api.add(sites[0], 1) || q === api.add(sites[1], 1)).length < 2) throw new Error('resin-boot did not start its clears');
      },
      final() {
        if (api.entered() && api.alone && !started) throw new Error('resin-boot never started its copies');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// twin-clear
//
//   copy  MOV {1, {bp1          the next line's A counts down from the clear's end:
//         MOV clr+4, {bp2       each pass copies one cell to both places
//         DJN copy, #4
//   bp1   SPL clr+HOP1+4, {F1   start the first copy
//   bp2   JMP clr+HOP2+4, {F2   and move into the second
//   clr   SPL #CA, {CB          the double clear: SPL-fed; each process lays a
//         MOV >CM, {clr         blank at clr+A and one at clr+B, both walking down
//         MOV {-1, <clr         two cells a loop, while the SPL's {CB and the
//         DJN.F -2, clr         source pointer walk over the cells between
const twinClear = {
  id: 'twin-clear',
  kind: 'body', exit: 'never', grows: true, writes: 'core', dialects: '94', roams: true,
  processes: 2, entry: 'copy', loop: 'clr',
  purpose: 'Double Shock\'s boot and double clear: a three-line loop copies a four-line SPL-fed clear to HOP1 and HOP2 (half the core apart) and starts both; each lays blanks through two pointers in its SPL\'s fields, both walking down two cells a loop, while the SPL\'s B-field decrements the cells between.',
  params: { HOP1: [20, 54000], HOP2: [20, 54000], CA: [0, 54000], CB: [0, 54000], CM: [0, 54000], F1: [0, 54000], F2: [0, 54000] },
  defaults: { HOP1: 656, HOP2: 256, CA: 752, CB: 587, CM: 91, F1: 453, F2: 453 },
  mutable: [['copy', ['a']], ['copy2', ['a']], ['cnt', ['b']], ['bp1', ['a']], ['bp2', ['a']], ['clr', ['a', 'b']], ['clr1', ['a']]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (['HOP1', 'HOP2', 'CA', 'CB', 'CM', 'F1', 'F2'].some((k) => P[k] >= core)) out.push('twin-clear: offsets must be smaller than the core');
    const far = (h) => mod(h, core) >= 10 && mod(h, core) <= core - 30;
    if (!far(P.HOP1) || !far(P.HOP2)) out.push('twin-clear: a copy lands on the warrior');
    if (mod(P.HOP1 - P.HOP2, core) < 4 || mod(P.HOP2 - P.HOP1, core) < 4) out.push('twin-clear: the two copies overlap');
    return out;
  },
  emit(ctx) {
    const { L, P } = ctx;
    ctx.ins('copy', 'MOV', 'I', '{1', `{${L('bp1')}`);
    ctx.ins('copy2', 'MOV', 'I', `${L('clr')}+4`, `{${L('bp2')}`);
    ctx.ins('cnt', 'DJN', 'B', L('copy'), '#4');
    ctx.ins('bp1', 'SPL', 'B', `${L('clr')}+${P.HOP1 + 4}`, `{${P.F1}`);
    ctx.ins('bp2', 'JMP', 'B', `${L('clr')}+${P.HOP2 + 4}`, `{${P.F2}`);
    ctx.ins('clr', 'SPL', 'B', `#${P.CA}`, `{${P.CB}`);
    ctx.ins('clr1', 'MOV', 'I', `>${P.CM}`, '{-1');
    ctx.ins('', 'MOV', 'I', '{-1', '<-2');
    ctx.ins('', 'DJN', 'F', '-2', '-3');
  },
  running(api) { return onShape(api, [api.code('clr', 1), api.code('clr', 2), api.code('clr', 3), api.code('clr')]); },
  watch(api) {
    const { vm, P } = api, clr = api.at('clr'), sites = [P.HOP1, P.HOP2].map((h) => api.add(clr, h));
    let ok = false;
    return {
      before(pc) { return pc === api.at('bp1') ? 'go' : null; },
      after(t) {
        if (t !== 'go' || ok) return;
        for (const c of sites) for (let k = 0; k < 4; k++) if (!api.same(vm.peek(api.add(c, k)), api.code('clr', k))) throw new Error(`twin-clear: a copy is incomplete (cell ${k})`);
        ok = true;
      },
      final() { if (api.entered() && api.alone && !ok) throw new Error('twin-clear never started its copies'); },
    };
  },
};

// ---------------------------------------------------------------------------
// djn-stream1
//
//   DJN.F #START, {0     the A-field is the pointer: each pass decrements it,
//                        then both fields of the cell it names, and jumps to
//                        itself (# names the instruction itself), so one
//                        process walks a decrement stream down the core, one
//                        cell a pass, for ever (a cell it leaves at 0, 0 makes it fall
//                        through, so it stays clear of zeros: it decrements
//                        both fields, and a blank becomes -1, -1).
const djnStream1 = {
  id: 'djn-stream1',
  kind: 'body', exit: 'never', processes: 1, writes: 'sparse', dialects: '94',
  entry: 's', loop: 's',
  purpose: 'A one-line DJN.F #START, {0: one process decrements both fields of one cell a pass, walking down the core from START past itself (its own A-field is the pointer), for ever. RETIRE 1 lets a partner overwrite it (the paper tail of an evolved warrior wipes it after a few dozen passes): it then only promises the decrements it made before.',
  params: { START: [2, 54000], RETIRE: [0, 1] },
  defaults: { START: 354, RETIRE: 0 },
  mutable: [['s', ['a']]],
  mismatches(P, settings) {
    const core = settings.coreSize;
    return P.START >= core || P.START < 2 ? ['djn-stream1: START must be inside the core and past the line'] : [];
  },
  emit(ctx) { ctx.ins('s', 'DJN', 'F', `#${ctx.P.START}`, '{0'); },
  running(api) {
    const { vm } = api, s = api.at('s');
    if (vm.processes(0).includes(s)) return true;
    // Retired: a friendly instruction outside the line overwrote it.
    return !!api.P.RETIRE && !api.alone && vm.writerPc[s] >= 0 && !api.inSelf(vm.writerPc[s]) && (!vm.owner || vm.owner[s] === 0);
  },
  watch(api) {
    const { vm } = api, s = api.at('s');
    let laps = 0;
    return {
      before(pc) { return pc === s ? { t: api.add(s, vm.peek(s).a - 1) } : null; },
      after(t) { if (t && vm.lastWrite[t.t] === vm.steps) laps++; },
      final() { if (api.entered() && api.alone && laps < 100) throw new Error(`djn-stream1 decremented only ${laps} cells`); },
    };
  },
};

export default [tinyQbomb, invQscan, silk2, chorusSilk, satelliteSilk, resinBoot, twinClear, djnStream1];
