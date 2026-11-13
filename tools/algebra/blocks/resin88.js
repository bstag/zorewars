// resin-stone: the "resin" of the Koenigstuhl '88 hill (Resinoid, Permafrost,
// Lithobolia; docs/hill-top30/88.md). The mechanism below was traced in the VM
// from those warriors; the Redcode, layout and constants are written from
// scratch.
//
//   rHead  SPL 0, 0            (HEADS of these)
//   rLay   MOV rDrop, <rDrop   lay a copy of the next line, through its B-field
//   rDrop  MOV <0, <first      the drop; run here it only counts the trail on
//   rBack  DJN rLay, <stream
//
// What it writes. rLay copies rDrop to the cell rDrop's B-field points at,
// one lower each time, and rDrop itself lowers the same field once more a
// pass: a trail of "MOV <0, <p" instructions two cells a pass, downward from
// FIRST cells above the stone. A drop is not a DAT. A process that runs one
// decrements the drop's own B-field, then the B-field of the cell p above the
// drop, copies the cell under that one to where it now points, and steps on
// to the next cell alive.
//
// Why that kills (each case is run as a duel by the watch):
//   1. A loop that loses its jump to a drop runs the drop and walks off the
//      end of its code onto the first empty cell. This is the common kill and
//      it comes the turn after the drop is run.
//   2. A process that cannot fall off, because an SPL keeps feeding the cells
//      or a jump brings it back, runs drops again and again. Two neighbouring
//      drops run in turn drag an empty cell downward one cell a run, from p
//      cells above them: the victim's own processes run a DAT clear down the
//      core and finally over their own code. One drop alone takes two laps of
//      its field to do the same.
// So the resin does not need a second pass with DATs: what it stuns clears
// itself, and whatever lies between.
//
// Its own life, alone. After one lap (about 3 * core / 2 cycles) the trail
// comes down onto the stone. Depending on which cells of the trail fall on
// it, either the head is lost and the loop runs on with the processes it has,
// or rLay and rBack become drops: then the SPL 0 feeds processes through
// three drops in a row, which is case 2 run by the stone itself, a DAT clear
// that comes round to the stone, wipes the three drops and from then on drags
// copies of the SPL 0 itself down the core. Either way it never dies alone,
// and it lays its trail once.
const ID = 'resin-stone';
const mod = (x, n) => ((x % n) + n) % n;

// The victims of the two duels, small on purpose: neither writes outside itself.
const FALLS = ';name falls off\nv SUB #1, 2\n JMP v\n DAT #0, #0\n END v\n';
const HELD = ';name held\nv SPL 0\n JMP v\n END v\n';

const resinStone = {
  id: ID, kind: 'body', exit: 'never', processes: 1, grows: true, writes: 'core', attacks: 'all', entry: 'rHead',
  purpose: "ICWS'88 resin: SPL 0 over a three-line loop that lays a trail of MOV <0, <p instructions downward from FIRST cells above itself, two cells a pass, with a DJN stream. A drop is not lethal by itself: a loop that loses its jump to one walks off its own end, and processes that are held on drops (by an SPL or a jump) drag empty cells down the core onto their own code. It ties imp rings rather than killing them. Five instructions with two heads, four with one.",
  params: { HEADS: [1, 2], FIRST: [200, 54000], STREAM: [16, 54000], SPLIT: [0, 1] },
  defaults: { HEADS: 2, FIRST: 3314, STREAM: 7900, SPLIT: 0 },
  mutable: [['rDrop', ['b']], ['rBack', ['b']]],
  knowledge: {
    parameterRoles: { SPLIT: '0: the loop returns to its layer line and the heads add a process a pass. 1: it returns to the first SPL 0, so the processes double every few passes and fill the table; the trail is denser and held victims die sooner, but against the hill it scored lower (0.82 against 0.96, 40 rounds) and some FIRST values overrun the stone itself (the gate refuses those).', HEADS: 'SPL 0 lines above the loop.', FIRST: 'Where the trail starts, above the drop line; also how far above a drop its runner starts dragging empty cells down.', STREAM: 'The DJN stream\'s pointer cell, from the DJN.' },
    tuning: ['The trail covers about two cells in five, a lap of the 8,000 core in about 12,000 cycles.', 'Kills by fall-off are immediate; a victim held on drops takes about three cycles a cell of FIRST to clear itself.'],
    failures: ['Imp rings are not killed, only tied. Over 100 rounds each with two heads: 2 wins, 8 losses, 90 ties against a continuous 3-point pump and 3/16/81 against a 7-point one; small one-pass spirals of 8 imps fall more often (17/1/82 on 3 points, 58/1/41 on 7). A ring rewrites each cell just before it runs it, so a drop is overwritten before it is run; only the oldest imp is exposed. More heads, another trail start or another stream position did not change that. Nor did (100 rounds each, against the 3-point pump, the 7-point pump and Talisman) three DJN streams a third apart in the loop (1/11/88, 2/22/76, 3/53/44), the stream moved to 2667 (2/4/94, 1/11/88, 9/31/60), a triple-stream stone beside it (1/5/94, 2/8/90, 2/36/62) or a 7-point pump beside it (1/0/99, 2/3/95, 3/19/78): the pump beside it turns losses into ties, not ties into wins, and scored 0.97 against 0.96 alone (40 rounds, within noise). Those two pairings are not trees: resin-stone attacks every cell, so par refuses them.', 'After its first lap the stone is overwritten by its own trail; it stays alive but lays nothing more.', 'The trail goes through its own image and any partner there.'],
    evidence: ['docs/hill-top30/88.md'],
  },
  mismatches(P, settings) {
    const core = settings.coreSize, out = [];
    if (P.FIRST > core - 2 * settings.maxLength) out.push(`${ID}: FIRST starts the trail on the warrior`);
    if (P.STREAM > core - 16) out.push(`${ID}: the DJN stream starts on the stone`);
    return out;
  },
  emit(ctx) {
    const { L, P } = ctx;
    for (let i = 0; i < P.HEADS; i++) ctx.ins(i ? `rHead${i}` : 'rHead', 'SPL', 'B', '0', '0');
    ctx.ins('rLay', 'MOV', 'I', L('rDrop'), `<${L('rDrop')}`);
    ctx.ins('rDrop', 'MOV', 'I', '<0', `<${P.FIRST}`);
    // SPLIT 1: back to the SPL, so every process splits again each pass (Lithobolia's and Permafrost's form).
    ctx.ins('rBack', 'DJN', 'B', P.SPLIT ? L('rHead') : L('rLay'), `<${P.STREAM}`);
  },
  running: (api) => api.vm.processes(0).some((q) => api.inSelf(q)),
  watch(api) {
    const { vm, P, core } = api, rLay = api.at('rLay'), rDrop = api.at('rDrop');
    const isDrop = (x) => x.op === 'MOV' && x.aMode === '<' && x.bMode === '<' && api.norm(x.a) === 0;
    const laying = () => api.same(vm.peek(rLay), api.code('rLay')) && isDrop(vm.peek(rDrop));
    const drops = new Set();
    let first = null;
    // A fresh round against a victim loaded in the path of the trail, `ahead` cells below its start.
    const kills = (victim, cycles) => {
      const offset = api.norm(rDrop - api.image.start + P.FIRST - 60);
      const r = api.duel(victim, { offset, cycles });
      return r.ours && !r.theirs;
    };
    return {
      before(pc) {
        return pc === rLay && laying() ? { at: api.norm(rDrop + vm.peek(rDrop).b - 1) } : null;
      },
      after(t) {
        if (!t) return;
        if (!isDrop(vm.peek(t.at))) throw new Error(`${ID}: it laid something other than its drop`);
        first ??= t.at;
        drops.add(t.at);
      },
      final() {
        if (!api.alone) return;
        if (first !== api.norm(rDrop + P.FIRST - 1)) throw new Error(`${ID}: the trail did not start FIRST cells above the drop line`);
        if (drops.size < Math.min(1000, Math.floor(vm.cycle / 8))) throw new Error(`${ID}: it laid only ${drops.size} drops`);
        if (!vm.processes(0).some((q) => vm.peek(q).op === 'SPL')) throw new Error(`${ID}: no SPL is left running`);
        // The two ways a drop kills, each against a real victim.
        if (!kills(FALLS, P.SPLIT ? 40000 : 2000)) throw new Error(`${ID}: a loop whose jump became a drop did not walk off its code`);
        if (!kills(HELD, Math.min(api.settings.maxCycles, 60000))) throw new Error(`${ID}: processes held on drops did not clear themselves`);
      },
    };
  },
};

export default [resinStone];
