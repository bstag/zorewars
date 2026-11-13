// remote-feed-stone: Moore's remote-bomb stone (see remote-bomb-stone in xstones.js) with a bounded
// feeder, for running beside a partner that grows (a continuous imp pump), where a stone with a fixed
// handful of processes gets a vanishing share of the turns.
//
//   rbCg    DAT   #0, #0           the clear's gate (A): the block's first cell
//   rbGate  DAT   A, B             the two bomb pointers
//   rbIn    MOV   rbTpl, R         entry: plant the remote bomb R cells away
//   rbFeed  SPL   rbLoop           FEEDN times: one more process into the loop ...
//           DJN   rbFeed, #FEEDN   ... then the feeder joins it itself
//   rbLoop  ADD.F rbTpl, rbGate    both pointers on by 2*STEP
//   rbW1    MOV   R, *rbGate       a copy of the remote bomb
//   rbW2    MOV   R+1, @rbGate     a blank
//   rbWatch JMZ.B rbCm, R          the airbag: remote bomb destroyed -> the clear
//   rbTime  DJN.B rbLoop, #COUNT   the time-up: a pass counter ...
//   rbStop  MOV   rbJmp, rbLoop    ... the process that counts the last pass turns the loop's first line
//                                  into a jump to the clear, so every other process follows it there
//   rbCm    MOV   rbDat, }rbCg     the d-clear, from the gate on
//   rbCd    DJN.F rbCm, }rbCg
//   rbDat   DAT   #restart, <imp step
//   rbJmp   JMP   rbCm - rbLoop
//   rbTpl   DAT   <2S, <2S         the bomb's template and the loop's increment
//
// Why a counter: with many processes in a four-line loop the lines run out of order, so two ADDs can
// come between two writes and a pointer value is skipped. remote-bomb-stone's time-up (its own blank
// landing on the remote bomb) can then be stepped over, and the lattice walks on into the stone.
// The counter counts passes whatever the order. ADDs can run ahead of the counted passes by at most
// the number of processes in the loop (FEEDN + 1, all the feeder makes), so COUNT is the planned
// time-up less that margin: the pointers never reach the remote bomb's row, nor the stone.
//
// One entrant only (a boot, par, or a fan boot's single process): more entrants would share the
// feeder's counter, and every one but the first would feed for ever. The gate refuses that (more
// processes than declared). Written from scratch; the hill warriors were read for the idea only.
// Ring, ICWS'94.

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const mod = (x, n) => ((x % n) + n) % n;
const EVERY = ['op', 'mod', 'aMode', 'a', 'bMode', 'b'];
const ZERO = { op: 'DAT', mod: 'F', aMode: '$', a: 0, bMode: '$', b: 0 };
const SIZE = 16, GATE = 1, MIN = 40;
const antiImp = (core) => { for (let n = 3; n < 64; n++) if (gcd(n, core) === 1) { for (let s = 1; s < core; s++) if ((n * s) % core === 1) return s; } return 1; };
const inWindow = (x, [lo, hi], core) => mod(x - lo, core) < hi - lo;
function windowFor(anchorIdx, blockStart, blockSize, span) {
  let lo = blockStart - anchorIdx, hi = lo + blockSize;
  if (span > 0 && anchorIdx < span) { lo = Math.min(lo, -anchorIdx); hi = Math.max(hi, span - anchorIdx); }
  return [lo - 1, hi + 1];
}
// The remote bomb R (from the gate) and the longest run of passes whose bombs and blanks all miss the
// window, counting back from the pass whose blank would land on R.
function plan(P, core, win) {
  const S = P.STEP, S2 = mod(2 * S, core), period = core / gcd(S2, core);
  const ok = (x) => !inWindow(x, win, core);
  let best = null;
  for (let adj = 0; adj < 24 && (!best || best.safe < period - 1); adj++) {
    const R = P.BDIST + adj;
    let safe = -1;
    if (ok(R) && ok(R + 1) && ok(R + S)) {
      safe = period - 1;
      for (let j = 1; j < period; j++) { const b = mod(R - j * S2, core), a = mod(b + S, core); if (!ok(b) || !ok(a) || a === mod(R + 1, core)) { safe = j - 1; break; } }
    }
    if (!best || safe > best.safe) best = { R, safe };
  }
  const T = Math.max(1, Math.min(best.safe, P.TIME ? P.TIME + P.FEEDN + 10 : best.safe));
  const count = T - (P.FEEDN + 10);
  return { R: best.R, safe: best.safe, T, count, S2, B0: mod(best.R - T * S2, core), A0: mod(best.R - T * S2 + S, core) };
}

export default {
  id: 'remote-feed-stone', kind: 'body', exit: 'never', writes: 'core', roams: false, dialects: '94',
  processes: (P) => P.FEEDN + 1,
  purpose: 'Moore\'s remote-bomb stone with a bounded feeder, for running beside a growing partner: one entrant plants the bomb BDIST cells away, sends FEEDN more processes into the four-line loop and joins it, so the stone holds FEEDN + 1 processes instead of five. The loop copies the remote bomb and a blank each pass (STEP apart, .5c); a JMZ airbag sends a process to the d-clear when an enemy destroys the remote bomb; a pass counter ends the stone after COUNT passes (TIME, or as many as miss the stone less a margin for out-of-order passes), and the process that counts the last pass rewrites the loop\'s first line into a jump to the clear. 16 instructions.',
  params: { STEP: [1, 27719], TIME: [0, 27000], BDIST: [200, 50000], FEEDN: [1, 400], SPARE: [0, 6000], OWN: [0, 1] },
  defaults: { STEP: 2019, TIME: 0, BDIST: 3000, FEEDN: 40, SPARE: 0, OWN: 0 },
  entry: 'rbIn', entryFirst: false, loop: 'rbLoop',
  provides: { datBomb: 'rbDat' },
  mutable: [['rbCg', EVERY], ['rbGate', EVERY], ['rbFeed', ['b']], ['rbFeedC', ['b']], ['rbTime', ['b']], ['rbLoop', EVERY]],
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (P.FEEDN + 1 > settings.maxProcesses) out.push(`remote-feed-stone: ${P.FEEDN + 1} processes; this hill allows ${settings.maxProcesses}`);
    if (P.BDIST > core - 4 * settings.maxLength) out.push(`remote-feed-stone: BDIST ${P.BDIST} puts the remote bomb on the warrior itself on a ${core}-cell core`);
    if (P.SPARE > core / 4) out.push(`remote-feed-stone: SPARE ${P.SPARE} is more than a quarter of the core`);
    const period = core / gcd(2 * P.STEP, core);
    if (period < 100) out.push(`remote-feed-stone: STEP ${P.STEP} reaches only ${period} cells of the core`);
    if (!out.length) {
      const p = plan(P, core, windowFor(GATE, 0, SIZE, 0));
      if (p.count < MIN) out.push(`remote-feed-stone: STEP ${P.STEP} allows only ${Math.max(p.count, 0)} counted passes (${p.safe} safe, less a margin of FEEDN + 10)`);
    }
    return out;
  },
  linked(P, settings, at, { span }) {
    const p = plan(P, settings.coreSize, windowFor(at('rbGate'), at('rbCg'), SIZE, P.OWN ? 0 : span));
    return p.count < MIN ? [`remote-feed-stone: here STEP ${P.STEP} allows only ${Math.max(p.count, 0)} counted passes`] : [];
  },
  emit(ctx) {
    const { L, P, core } = ctx, start = ctx.pc();
    const p = plan(P, core, windowFor(start + GATE, start, SIZE, P.OWN ? 0 : ctx.span));
    const R = `${L('rbGate')}+${p.R}`;
    ctx.ins('rbCg', 'DAT', 'F', '#0', '#0');
    ctx.ins('rbGate', 'DAT', 'F', `$${p.A0}`, `$${p.B0}`);
    ctx.ins('rbIn', 'MOV', 'I', L('rbTpl'), R);
    ctx.ins('rbFeed', 'SPL', 'B', L('rbLoop'));
    ctx.ins('rbFeedC', 'DJN', 'B', L('rbFeed'), `#${P.FEEDN}`);
    ctx.ins('rbLoop', 'ADD', 'F', L('rbTpl'), L('rbGate'));
    ctx.ins('rbW1', 'MOV', 'I', R, `*${L('rbGate')}`);
    ctx.ins('rbW2', 'MOV', 'I', `${R}+1`, `@${L('rbGate')}`);
    ctx.ins('rbWatch', 'JMZ', 'B', L('rbCm'), R);
    ctx.ins('rbTime', 'DJN', 'B', L('rbLoop'), `#${p.count}`);
    ctx.ins('rbStop', 'MOV', 'I', L('rbJmp'), L('rbLoop'));
    ctx.ins('rbCm', 'MOV', 'I', L('rbDat'), `}${L('rbCg')}`);
    ctx.ins('rbCd', 'DJN', 'F', L('rbCm'), `}${L('rbCg')}`);
    ctx.ins('rbDat', 'DAT', 'F', `#${L('rbTpl')}-${L('rbCg')}+1+${P.SPARE}`, `<${antiImp(core)}`);
    ctx.ins('rbJmp', 'JMP', 'B', `${L('rbCm')}-${L('rbLoop')}`);
    ctx.ins('rbTpl', 'DAT', 'F', `<${p.S2}`, `<${p.S2}`);
  },
  // An enemy destroys the remote bomb once the stone is running.
  plant: (api) => [[api.norm(api.at('rbWatch') + api.code('rbWatch').b), ZERO, 1200]],
  watch(api) {
    const { vm, core, P } = api;
    const gate = api.at('rbGate'), cg = api.at('rbCg'), w1 = api.at('rbW1'), w2 = api.at('rbW2'), cm = api.at('rbCm'), cd = api.at('rbCd'), loop = api.at('rbLoop'), stop = api.at('rbStop');
    const R = api.norm(api.at('rbWatch') + api.code('rbWatch').b);
    const g0 = api.code('rbGate'), S2 = api.norm(api.code('rbTpl').a), lat = gcd(S2, core), count = api.code('rbTime').b;
    const end = api.norm(api.at('rbTpl') + 1), spared = (c) => api.rel(c, end) < P.SPARE;
    const planted = api.scenario === 'remote-feed-stone: planted target';
    let bombs = 0, blankOnR = false, clearAt = null, stopAt = null, clearWrites = 0, most = 0;
    return {
      before(pc) {
        if (!api.entered()) return null;
        if (pc === stop && stopAt === null) stopAt = vm.cycle;
        // One entrant: every 500 cycles, no more than FEEDN + 1 processes (and two for a partner passing through) run the stone's own code.
        if (vm.cycle % 500 === 0) { const mine = (q) => { const x = vm.peek(q), o = api.code('rbCg', api.rel(q, cg)); return x.op === o.op && x.mod === o.mod && x.aMode === o.aMode && x.bMode === o.bMode && api.norm(x.a) === api.norm(o.a); };
          const n = vm.processes(0).filter((q) => api.inSelf(q) && mine(q)).length; if (n > most) most = n; if (n > P.FEEDN + 3) throw new Error(`remote-feed-stone has ${n} processes, more than FEEDN + 1 (and two for a passing partner): it was entered by more than one process`); }
        if (pc === w1 || pc === w2) {
          if (!api.same(vm.peek(pc), api.code(pc === w1 ? 'rbW1' : 'rbW2'))) return null;
          const p = vm.peek(gate);
          return { k: pc === w1 ? 1 : 2, t: api.norm(gate + (pc === w1 ? p.a : p.b)) };
        }
        if (pc === cm) {
          if (clearAt === null) clearAt = vm.cycle;
          if (!api.same(vm.peek(pc), api.code('rbCm'))) return null;
          return { k: 3, t: api.norm(cg + vm.peek(cg).a) };
        }
        return null;
      },
      after(tok) {
        if (!tok) return;
        const { k, t } = tok;
        if (k === 3) {
          if (t !== cg && api.inSelf(t)) throw new Error("remote-feed-stone's clear wrote its own code");
          if (spared(t)) throw new Error('remote-feed-stone cleared the cells it was told to spare');
          clearWrites++;
          return;
        }
        if (api.inSelf(t) || (api.inImage(t) && !api.inDead(t))) throw new Error('remote-feed-stone bombed the warrior');
        if (api.norm(t - gate - (k === 1 ? g0.a : g0.b)) % lat) throw new Error('remote-feed-stone left its step lattice');
        if (k === 2 && t === R) blankOnR = true;
        if (k === 1) bombs++;
      },
      final() {
        if (!api.entered()) return;
        if (planted) {
          if (clearAt === null) throw new Error('remote-feed-stone did not fall into its clear when the remote bomb was destroyed');
          if (stopAt !== null && stopAt < clearAt) throw new Error('remote-feed-stone ended on its counter, not on the destroyed bomb');
          if (!clearWrites) throw new Error("remote-feed-stone's clear never wrote");
          return;
        }
        if (!api.alone) return;
        if (blankOnR) throw new Error('remote-feed-stone ran past its counted passes: its own blank reached the remote bomb');
        if (stopAt === null) {
          if (vm.cycle > 40 * (count + 50) * (P.FEEDN + 1)) throw new Error(`remote-feed-stone never counted its ${count} passes`);
          return;
        }
        if (bombs < count) throw new Error(`remote-feed-stone made ${bombs} bombs in ${count} counted passes`);
        if (vm.peek(loop).op !== 'JMP') throw new Error('remote-feed-stone did not turn its loop into a jump to the clear');
        const procs = vm.processes(0);
        if (vm.cycle - stopAt > 2000 && !procs.every((q) => q === cm || q === cd)) throw new Error('remote-feed-stone: a process is outside the clear long after the time-up');
        if (procs.length !== P.FEEDN + 1) throw new Error(`remote-feed-stone ended with ${procs.length} processes, not FEEDN + 1`);
        for (const l of ['rbCm', 'rbCd', 'rbDat']) if (!api.same(vm.peek(api.at(l)), api.code(l))) throw new Error('remote-feed-stone damaged its own clear');
        if (vm.cycle - stopAt >= 2 * core + 2000) {
          for (let c = 0; c < core; c++) if (!api.inSelf(c) && !spared(c) && vm.writeCycle[c] < stopAt) throw new Error("remote-feed-stone's clear left cells untouched");
        }
      },
    };
  },
};
