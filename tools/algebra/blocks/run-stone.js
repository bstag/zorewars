// run-stone: a multi-process stone that never switches itself off and never
// turns into anything else (the kind that sits beside a paper in Borgir, King
// of Metal and Spiritual Black Dimension; docs/hill-top30/94nop.md). The hill
// stones were studied for the idea only; this code is written from scratch.
// Ring, '94.
//
//   rsGo    spl   #0, 0              the feeder: every turn it gets, one more
//                                    process enters the loop (and the boot's
//                                    workers all pass through it first)
//   rsLoop  add.f rsBm, rsMv         both targets on by the stride
//   rsMv    mov   NEAR, NEAR+LEAP    drag: the cell at the near target moves
//                                    LEAP cells further on
//           mov   rsBm, *rsMv        and a DAT takes its place
//           jmp   rsLoop
//   rsBm    dat   #STRIDE, #STRIDE   the bomb, and the stride
//
// Two writes in four instructions. The processes are spread over the loop's
// lines, so their ADDs and writes interleave and the writes land on new cells.
//
// It needs no guard and no counter because of where it aims. The stride is a
// multiple of 8, the near target starts on residue 6 (mod 8, counted from the
// block's first cell) and the far one on residue 7, and the block is six cells
// long: residues 0 to 5. Neither target can ever reach the stone, so it bombs
// for as long as the round lasts. A partner whose cells all sit on residues 0
// to 5 from the stone is never hit either: loop-paper6 with STEP = 8 (mod 16),
// booted a multiple of 8 from the stone, keeps every copy there.
const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
const mod = (x, n) => ((x % n) + n) % n;
const LEN = 6, GRAIN = 8;
const stride = (P, core) => mod(GRAIN * P.STEP, core);
const near = (P, core) => mod(GRAIN * P.FIRST + 4, core);                       // rsMv is cell 2: residue 6
const far = (P, core) => mod(GRAIN * P.FIRST + 4 + GRAIN * P.LEAP + 1, core);   // residue 7

const runStone = {
  id: 'run-stone',
  kind: 'body', exit: 'never', grows: true, writes: 'sparse', roams: false, dialects: '94',
  processes: 1,
  purpose: 'A six-cell multi-process stone that never stops: an SPL #0 feeder keeps adding processes to a four-line loop that drags the cell at one target 8*LEAP+1 cells on and drops a DAT in its place, both targets moving 8*STEP a pass. The targets stay on residues 6 and 7 (mod 8) from the stone, which fills 0 to 5, so it cannot hit itself and has no switch-off, counter or clear. Takes any number of entrants, so it can be a fan boot\'s first member.',
  params: { STEP: [1, 6929], FIRST: [1, 6929], LEAP: [1, 6929] },
  defaults: { STEP: 359, FIRST: 60, LEAP: 250 },
  entry: 'rsGo', loop: 'rsLoop',
  provides: { datBomb: 'rsBm' },
  mutable: [['rsMv', ['a', 'b']]],
  // Where it writes for as long as it runs, from its first cell: a fan boot
  // refuses a partner whose copy sits there (tools/algebra/link.js).
  lattice: () => ({ step: GRAIN, residues: [6, 7] }),
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (core % GRAIN) out.push(`run-stone: its 8-cell grain does not divide a ${core}-cell core`);
    if (settings.maxProcesses < 64) out.push(`run-stone: its feeder never stops adding processes; this hill allows ${settings.maxProcesses}`);
    const s = stride(P, core);
    if (!s) out.push('run-stone: STEP moves the targets a whole number of cores: it would bomb one cell');
    else if (core / gcd(s, core) < core / 32) out.push(`run-stone: STEP reaches only ${core / gcd(s, core)} cells with each target`);
    return out;
  },
  emit(ctx) {
    const { L, P, core } = ctx, s = stride(P, core);
    ctx.ins('rsGo', 'SPL', 'B', '#0', '0');
    ctx.ins('rsLoop', 'ADD', 'F', L('rsBm'), L('rsMv'));
    ctx.ins('rsMv', 'MOV', 'I', `${near(P, core)}`, `${far(P, core)}`);
    ctx.ins('rsDrop', 'MOV', 'I', L('rsBm'), `*${L('rsMv')}`);
    ctx.ins('', 'JMP', 'B', L('rsLoop'));
    ctx.ins('rsBm', 'DAT', 'F', `#${s}`, `#${s}`);
  },
  watch(api) {
    const { P, vm, core } = api, home = api.at('rsGo'), mv = api.at('rsMv'), drop = api.at('rsDrop');
    const s = stride(P, core), reach = core / gcd(s, core);
    const whole = () => [0, 1, 3, 4, 5].every((k) => api.same(vm.peek(api.add(home, k)), api.code('rsGo', k))) && vm.peek(mv).op === 'MOV';
    const bombed = new Set(), dragged = new Set();
    let entered = false, lastWrite = -1;
    return {
      before(pc) {
        if (pc === home) entered = true;
        if ((pc !== mv && pc !== drop) || !whole()) return null;
        const x = vm.peek(mv);
        return pc === mv ? { to: api.add(mv, x.b) } : { bomb: api.add(mv, x.a) };
      },
      after(tok) {
        if (!tok) return;
        const t = tok.to ?? tok.bomb;
        if (api.rel(t, home) < LEN) throw new Error('run-stone wrote onto its own code');
        if (api.rel(t, home) % GRAIN !== (tok.to !== undefined ? 7 : 6)) throw new Error('run-stone: a target left its residue class');
        if (tok.bomb !== undefined) { if (vm.peek(t).op !== 'DAT') throw new Error('run-stone dropped something other than its bomb'); bombed.add(t); } else dragged.add(t);
        lastWrite = vm.cycle;
      },
      final() {
        if (!entered) return;                   // a branch not taken
        if (!bombed.size) throw new Error('run-stone never bombed');
        if (!api.alone) return;
        // Alone, nothing can stop it: the loop is untouched, the feeder has kept
        // feeding, and it was still bombing when the run ended.
        if (!whole()) throw new Error('run-stone damaged its own loop');
        if (vm.processes(0).filter((q) => api.rel(q, home) < LEN).length < 8) throw new Error('run-stone: the feeder did not keep adding processes');
        if (vm.cycle - lastWrite > 8) throw new Error('run-stone stopped bombing');
        const want = Math.min(reach, Math.floor(vm.cycle / 16));
        if (bombed.size < 0.9 * want || dragged.size < 0.9 * want) throw new Error(`run-stone reached too few cells (${bombed.size} bombed, ${dragged.size} dragged to; ${want} expected)`);
      },
    };
  },
};

export default runStone;
