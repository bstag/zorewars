// gated-dclear: a d-clear (a DAT, then a decrement, cell after cell) that runs
// from the first cycle beside other bodies: Son of Vain's third body beside
// its stone and imp pump (docs/hill-top30/94nop.md). The hill warrior was
// studied for the idea only; this code is written from scratch. Ring, '94.
//
//   gdGo  slt.ab #LOW-1, gate       is the pointer inside the span (not below its low end)?
//         mov   gdBm, gate          no: back to the top
//         mov   gdBm, <gate         a DAT on the next cell down
//         djn.f 1,    <gate         and the one below it loses one from both fields
//         jmp   gdGo, {gate         loop; the gate's A-field goes down one a pass
//   gdBm  dat   <third, #TOP        the bomb, and the pointer's starting value
//
// `gate` is a cell GATE below the block, outside it. Its B-field is the sweep
// pointer and its A-field is decremented every pass, so an imp instruction
// that lands there is changed before its process arrives and the ring breaks
// on it. The gate needs no setting up: an empty gate reads as "below the
// span" and the first pass arms it.
//
// Unlike a hill d-clear it does not go round the core. It sweeps downward over
// the SPAN cells that start FIRST below the gate and starts again, checking
// the pointer before every pass. The pointer is an offset from the gate, the
// span lies at the top of that range and the block just above zero, so one
// comparison covers everything: any value below the span's low end, which
// includes every value that would point at the block itself, is put back
// before a pass starts, and any other value writes below the gate, inside
// the window the block declares. (A hit that lands between the check and the
// two writes still costs those two cells.) That bound is what lets it run
// beside partners: the block declares the window (`lattice`) and its gate
// cell (`keeps`), and a fan boot refuses a layout in which a partner's copy
// sits in the window or a partner writes on the gate.
const mod = (x, n) => ((x % n) + n) % n;
const LEN = 6;
const third = (core) => Math.round(core / 3);

const gatedDclear = {
  id: 'gated-dclear',
  kind: 'body', exit: 'never', processes: 1, writes: 'sparse', roams: false, dialects: '94',
  purpose: 'A six-cell bounded d-clear with a decrement gate, built to run from the start beside a stone copy and an imp pump copy: one process lays a DAT and decrements the next cell, downward over the SPAN cells that start FIRST below its gate, again and again. The gate is a cell GATE below the block: its B-field is the sweep pointer (checked before every pass: a value below the span, which covers every value that would aim at the block, is put back) and its A-field loses one a pass, which breaks an imp that lands on it. It declares its window and its gate, so a fan boot refuses partners placed in the one or writing on the other.',
  params: { GATE: [2, 32], FIRST: [1, 54000], SPAN: [16, 54000] },
  defaults: { GATE: 4, FIRST: 2, SPAN: 1500 },
  entry: 'gdGo', loop: 'gdGo',
  provides: { datBomb: 'gdBm' },
  // Offsets from the block's first cell: everything from the bottom of the span up to the gate
  // (one cell more than SPAN below: a pointer left odd finishes a pass).
  lattice: (P) => ({ from: -P.GATE - P.FIRST - P.SPAN, size: P.FIRST + P.SPAN }),
  keeps: (P) => ({ from: -P.GATE, size: 1 }),
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (P.SPAN % 2) out.push('gated-dclear: SPAN must be even (a DAT and a decrement a pass)');
    if (P.GATE + P.FIRST + P.SPAN + LEN + 8 > core) out.push('gated-dclear: the span runs round the core into the block');
    return out;
  },
  // In place (not booted), the gate and the span must be clear of the warrior.
  linked(P, settings, at, { total, shiftedFrame }) {
    if (shiftedFrame) return [];
    const out = [], gate = at('gdGo') - P.GATE;
    if (gate >= 0) out.push('gated-dclear: its gate cell would lie on the warrior: put the block first, or boot it');
    if (settings.coreSize + gate - P.FIRST - P.SPAN < total) out.push('gated-dclear: its span runs round the core into the warrior: shorten SPAN, or boot it');
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, gate = `${L('gdGo')}-${P.GATE}`;
    ctx.ins('gdGo', 'SLT', 'AB', `#${mod(2 - P.FIRST - P.SPAN, core)}`, gate);
    ctx.ins('gdArm', 'MOV', 'I', L('gdBm'), gate);
    ctx.ins('gdDat', 'MOV', 'I', L('gdBm'), `<${gate}`);
    ctx.ins('gdDec', 'DJN', 'F', '1', `<${gate}`);
    ctx.ins('gdBack', 'JMP', 'B', L('gdGo'), `{${gate}`);
    ctx.ins('gdBm', 'DAT', 'F', `<${third(core)}`, `#${mod(1 - P.FIRST, core)}`);
  },
  // Planted: an imp instruction on the gate, as a spiral's head would leave it.
  plant: (api) => [[api.add(api.at('gdGo'), -api.P.GATE), { op: 'MOV', mod: 'I', aMode: '$', a: 0, bMode: '$', b: third(api.core) }, PLANT_AT]],
  watch(api) {
    const { P, vm, core } = api, home = api.at('gdGo'), gate = api.add(home, -P.GATE);
    const at = { arm: api.at('gdArm'), dat: api.at('gdDat'), dec: api.at('gdDec'), back: api.at('gdBack') };
    const whole = () => Array.from({ length: LEN }, (_, k) => k).every((k) => api.same(vm.peek(api.add(home, k)), api.code('gdGo', k)));
    const top = mod(1 - P.FIRST, core);
    const inSpan = (t) => api.rel(t, api.add(gate, -P.FIRST - P.SPAN)) < P.FIRST + P.SPAN;
    const planted = api.scenario === 'gated-dclear: planted target';
    const written = new Set();
    let entered = false, arms = 0, passes = 0, afterPlant = null, stray = 0, own = null, tainted = false;
    return {
      before(pc) {
        if (pc === home) {
          // Entrants: the processes in the block when the first one runs (later an imp may pass through).
          if (!entered && vm.processes(0).filter((q) => api.rel(q, home) < LEN).length > 1) throw new Error('gated-dclear: more than one process entered; it is a one-process clear');
        }
        if (pc === home) entered = true;
        if (api.rel(pc, home) >= LEN || !whole()) return null;
        const g = vm.peek(gate);
        if (pc === home) tainted = false;
        if (pc === at.dat || pc === at.dec) {
          // Something else moved the pointer after this pass's check: the pass finishes where it now points.
          if (own !== null && g.b !== own) tainted = true;
          const t = api.add(gate, g.b - 1);
          return { pc, t, was: { ...vm.peek(t) } };
        }
        if (pc === at.back) return { pc, a: g.a };
        if (pc === at.arm) return { pc };
        return null;
      },
      after(tok) {
        if (!tok) return;
        own = vm.peek(gate).b;
        if (tok.pc === at.arm) {
          if (api.norm(vm.peek(gate).b) !== top) throw new Error('gated-dclear: the pointer was not put back to the top of the span');
          arms++;
          if (planted && vm.cycle > PLANT_AT && afterPlant === null) afterPlant = 'rearmed';
          return;
        }
        if (tok.pc === at.back) {
          // The gate: its A-field loses one every pass.
          if (api.norm(vm.peek(gate).a - tok.a) !== core - 1) throw new Error('gated-dclear: the gate was not decremented');
          passes++;
          return;
        }
        // A write: never on its own code; below the gate, no lower than the bottom of the span.
        if (api.rel(tok.t, home) < LEN) throw new Error('gated-dclear wrote onto its own code');
        if (!inSpan(tok.t)) {
          // A pointer changed between the check and the writes costs the rest of that one pass: two cells at most.
          if (tainted) { stray++; return; }
          throw new Error(`gated-dclear wrote outside its span (${api.rel(tok.t, gate)} cells past the gate)`);
        }
        const now = vm.peek(tok.t);
        if (tok.pc === at.dat) { if (!api.same(now, { ...api.code('gdBm'), b: now.b })) throw new Error('gated-dclear dropped something other than its bomb'); }
        else if (api.norm(now.a - tok.was.a) !== core - 1 || api.norm(now.b - tok.was.b) !== core - 1) throw new Error('gated-dclear did not decrement the cell below its DAT');
        written.add(tok.t);
      },
      final() {
        if (!entered) return;                   // a branch not taken
        if (!passes) throw new Error('gated-dclear never made a pass');
        if (planted && afterPlant !== 'rearmed') throw new Error('gated-dclear: an imp on the gate was not answered by putting the pointer back');
        if (!api.alone) return;
        if (stray) throw new Error('gated-dclear wrote outside its span with nothing else in the core');
        // Alone it has the time for several sweeps: every cell of the span was written, none outside it.
        if (vm.cycle < 3 * P.SPAN) return;
        if (arms < 2) throw new Error('gated-dclear never came back to the top of its span');
        for (let k = 0; k < P.SPAN; k++) if (!written.has(api.add(gate, -P.FIRST - k))) throw new Error(`gated-dclear left cell ${k} of its span untouched`);
        if (!whole()) throw new Error('gated-dclear damaged its own code');
      },
    };
  },
};
const PLANT_AT = 600;

export default gatedDclear;
