// hydra-88: a launcher that plants a small resin clear every HOP cells and
// sends one process into each (the idea is Torment's hydra, docs/hill-top30/
// 88.md, traced in the VM; the Redcode, the order of the lines and the
// constants are written from scratch). What a resin trail is and how it kills
// is in resin88.js.
//
//   hHead  SPL 0, 0            one new process a pass; also the child's head
//   hS     MOV hHead, <hTop    lay the child's SPL 0 (its lowest cell, last)
//   hL     MOV cLay, <hTop     its layer line
//   hD     MOV cDrop, <hTop    its drop line
//   hTop   MOV cBack, first    its DJN, the top cell: this B-field is the pointer
//   hAdd   ADD #HOP+3, hTop    on to the next child
//   hJ     JMP @hTop           into the child finished the pass before
//   cLay   MOV 1, <1           the child, as it is copied:
//   cDrop  MOV <0, <FIRST        SPL 0 / MOV 1, <1 / MOV <0, <FIRST / DJN -2, <STREAM
//   cBack  DJN -2, <STREAM
//
// The SPL 0 puts a process on every line, so in one pass of the queue every
// line runs once, the lowest line first: the JMP enters the child whose head
// was laid at the end of the pass before, the ADD moves the pointer HOP+3 on,
// and the four MOVs lay the next child from its top cell down to its head,
// where the pointer stays for the next JMP. Each child therefore gets exactly
// one process, on its SPL 0, and children stand HOP cells apart. While the
// lines fill, the first passes lay the bottom three cells of a child one HOP
// before the first whole one; nothing is sent there.
//
// Each child is a one-head resin: it lays its trail of MOV <0, <p drops from
// FIRST cells above itself downward, through whatever is there, older children
// and in time the launcher included. A launcher that has become drops lets its
// processes fall into the three template lines after it, which are a resin
// loop themselves.
//
// CHILDREN > 0 adds a counter before the jump: when it runs out it overwrites
// the launcher's SPL 0 with a DAT, so the launcher stops after that many
// launches (plus the few its pipeline still holds). SPLIT 1 makes each child
// return to its own SPL 0 (as resin-stone SPLIT 1), so each fills its share
// of the process table.
const ID = 'hydra-88';
const mod = (x, n) => ((x % n) + n) % n;
const launcher = (P) => ['hHead', 'hS', 'hL', 'hD', 'hTop', 'hAdd', ...(P.CHILDREN ? ['hC', 'hStop'] : []), 'hJ'];
const cellsOf = (P) => [...launcher(P), 'cLay', 'cDrop', 'cBack', ...(P.CHILDREN ? ['hDie'] : [])];
const child = ['hHead', 'cLay', 'cDrop', 'cBack'];        // a child, lowest cell first
const FALLS = ';name falls off\nv SUB #1, 2\n JMP v\n DAT #0, #0\n END v\n';

const hydra = {
  id: ID, kind: 'body', exit: 'never', processes: 1, grows: true, writes: 'core', attacks: 'all', roams: true, entry: 'hHead',
  purpose: "ICWS'88 hydra: a seven-line launcher that, every pass of the queue, lays a four-cell resin clear (SPL 0 / MOV 1, <1 / MOV <0, <FIRST / DJN) HOP cells past the last and sends one process into the one before; each child lays a trail of non-lethal MOV drops downward from FIRST above itself (see resin-stone for how those kill). Ten instructions.",
  params: { HOP: [20, 27000], START: [100, 54000], FIRST: [200, 54000], STREAM: [16, 54000], CHILDREN: [0, 200], SPLIT: [0, 1] },
  defaults: { HOP: 636, START: 1500, FIRST: 2170, STREAM: 7900, CHILDREN: 0, SPLIT: 0 },
  mutable: (P) => [['hTop', ['b']], ...(P.CHILDREN ? [['hC', ['b']], ['hHead', ['a', 'b']]] : [])],
  knowledge: {
    parameterRoles: { CHILDREN: '0: launch for as long as the launcher lasts. Otherwise stop after that many launches (and up to six more already under way).', SPLIT: '1: each child returns to its own SPL 0.', HOP: 'Between children.', START: 'Where the first child goes, from the launcher.', FIRST: 'Where each child\'s trail starts, above the child.', STREAM: 'Each child\'s DJN stream pointer, from its DJN.' },
    tuning: ['One child a pass; a pass grows by a process each time (the launcher\'s own) plus what the children\'s SPL 0s add, so launches slow down quickly: about 60 children in the first 5,000 cycles alone.', 'Children whose trails cross lose their loops to each other\'s drops and go on as SPL 0 heads feeding drops.'],
    coexistence: ['Measured alone, CHILDREN 7, over a grid of HOP 200 to 400 and FIRST 4,800 to 6,000 with SPLIT 0 and 1, and in the Lithobolia layout (HOP 992, the trail 661 below each child): in every case the trail of one child reached another within 225 to 50,000 cycles, most within 8,000. A trail moves as fast as its child has processes, so with SPLIT 1 or a growing SPL 0 it laps the core in a few thousand cycles; no spacing keeps the children apart for a round.', 'That does not stop the Lithobolia layout: a child whose loop is overrun becomes an SPL 0 feeding drops, and the warrior kept 8,000 processes to the end (with SPLIT 0 it died out). CHILDREN 7, SPLIT 1, HOP 992, FIRST 7339 scored 0.89 against the 88 top 30 (40 rounds) where the default scored 0.81.'],
    failures: ['Imp rings are tied, not killed: over 100 rounds, 2 wins, 27 losses, 71 ties against a continuous 3-point pump and 3/21/76 against a 7-point one; one-pass spirals of 8 imps fall more often (20/0/80 on 3 points, 77/0/23 on 7).', 'Alone, the trails of the children wipe every SPL 0 within about 8,000 cycles; what is left is a few dozen processes looping on drops.', 'The launcher is overrun by its children\'s trails; it lays children only for the first part of a round.', 'It takes no partners: the trails go through everything.'],
    evidence: ['docs/hill-top30/88.md'],
  },
  mismatches(P, settings) {
    const core = settings.coreSize, room = settings.maxLength, out = [];
    if (P.START < room + 8 || P.START > core - room - 8) out.push(`${ID}: START puts the first child on the warrior`);
    // The first children must not land on the launcher.
    for (let k = -1; k < (P.CHILDREN ? P.CHILDREN + 7 : 40); k++) { const d = mod(P.START + k * P.HOP, core); if (d < room + 8 || d > core - room - 8) { out.push(`${ID}: child ${k} lands on the warrior`); break; } }
    if (P.FIRST > core - 2 * room || P.STREAM > core - 16) out.push(`${ID}: a child's trail or stream starts on the child`);
    return out;
  },
  emit(ctx) {
    const { L, P } = ctx, top = L('hTop');
    ctx.ins('hHead', 'SPL', 'B', '0', '0');
    ctx.ins('hS', 'MOV', 'I', L('hHead'), `<${top}`);
    ctx.ins('hL', 'MOV', 'I', L('cLay'), `<${top}`);
    ctx.ins('hD', 'MOV', 'I', L('cDrop'), `<${top}`);
    // The first whole child's head is START from hHead (hTop is four cells on; the lines above it
    // run three times, and the ADD once, before the first top cell is laid).
    // With CHILDREN the jump is a line further down, so the ADD runs once more before it.
    ctx.ins('hTop', 'MOV', 'I', L('cBack'), `${P.START - P.HOP + 5 - (P.CHILDREN ? P.HOP : 0)}`);
    ctx.ins('hAdd', 'ADD', 'AB', `#${P.HOP + 3}`, top);
    if (P.CHILDREN) {
      ctx.ins('hC', 'DJN', 'B', L('hJ'), `#${P.CHILDREN + 1}`);         // count the launches
      ctx.ins('hStop', 'MOV', 'I', L('hDie'), L('hHead'));            // the last: no more processes
    }
    ctx.ins('hJ', 'JMP', 'B', `@${top}`, '0');
    ctx.ins('cLay', 'MOV', 'I', '1', '<1');
    ctx.ins('cDrop', 'MOV', 'I', '<0', `<${P.FIRST}`);
    ctx.ins('cBack', 'DJN', 'B', P.SPLIT ? '-3' : '-2', `<${P.STREAM}`);
    if (P.CHILDREN) ctx.ins('hDie', 'DAT', 'F', '#0', '#0');
  },
  running: (api) => api.vm.processes(0).length > 0,
  watch(api) {
    const { vm, P } = api, cells = cellsOf(P), at = Object.fromEntries(cells.map((l) => [l, api.at(l)]));
    const intact = () => cells.every((l) => ['hTop', 'hC', 'hHead'].includes(l) ? vm.peek(at[l]).op === api.code(l).op : api.same(vm.peek(at[l]), api.code(l)));
    const isChild = (c) => child.every((l, i) => api.same(vm.peek(c + i), api.code(l)));
    const heads = [];
    let whole = 0, ranChild = false;
    return {
      before(pc) {
        if (!ranChild && heads.length && !api.inSelf(pc) && api.same(vm.peek(pc), api.code('cLay'))) ranChild = true;
        return pc === at.hJ && intact() ? { head: api.norm(at.hTop + vm.peek(at.hTop).b) } : null;
      },
      after(t) {
        if (!t) return;
        const k = heads.length;
        heads.push(t.head);
        // Every launch enters a whole child, HOP past the last (with CHILDREN, only the first CHILDREN:
        // the ones the pipeline still makes after the stop copy the dead head, and their processes die).
        if (P.CHILDREN && k >= P.CHILDREN) return;
        if (t.head !== api.norm(at.hHead + P.START + k * P.HOP)) throw new Error(`${ID}: child ${k} is not HOP cells past the one before`);
        if (!isChild(t.head)) {
          // Alone, nothing but an older child's trail can have touched it, and that comes later.
          if (api.alone && k < 20) throw new Error(`${ID}: launch ${k} entered a child that is not whole`);
          return;
        }
        whole++;
      },
      final() {
        if (!api.alone) return;
        if (P.CHILDREN) {
          if (heads.length < P.CHILDREN || heads.length > P.CHILDREN + 7) throw new Error(`${ID}: ${heads.length} launches, not ${P.CHILDREN} (+ up to 7)`);
          if (whole !== P.CHILDREN) throw new Error(`${ID}: ${whole} whole children, not ${P.CHILDREN}`);
          if (vm.peek(at.hHead).op === 'SPL') throw new Error(`${ID}: the launcher did not stop`);
        } else if (whole < 14) throw new Error(`${ID}: only ${whole} whole children were launched`);
        if (P.CHILDREN && whole < Math.min(P.CHILDREN, 14)) throw new Error(`${ID}: only ${whole} whole children were launched`);
        if (!ranChild) throw new Error(`${ID}: no child ran its layer line`);
        // A plain loop in the path of the first child's trail must walk off its code.
        const offset = api.norm(at.hHead - api.image.start + P.START + 2 + P.FIRST - 60);
        const r = api.duel(FALLS, { offset, cycles: P.SPLIT ? 30000 : 4000 });
        if (!r.ours || r.theirs) throw new Error(`${ID}: a loop in the path of a child's trail did not die`);
      },
    };
  },
};

export default [hydra];
