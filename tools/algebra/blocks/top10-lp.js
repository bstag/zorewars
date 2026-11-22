// Blocks for rebuilding the Koenigstuhl LP hill's top 10 (docs/hill-top10/lp.md).
// Each one is a mechanism the existing LP blocks did not express exactly:
//
//   lp-rain-paper      the 7-line looping paper of Digital Rain, Replinator and
//                      Hippogriff: the order of the lap, the entry, the attack
//                      (doubling scatter or an arithmetic walk) and the operand
//                      modes of the restart and the transfer are parameters
//   lp-quiet-paper     the 5-line paper with a 2-instruction copy loop and no
//                      attack, as Fear of the Unknown and Distortion Energy run it
//                      beside a stone
//   lp-quad-stone      a boot that copies a 4-line stone away and starts four
//                      staggered processes in it: Fear's self-indexed MOV/ADD/JMN
//                      stone (STYLE 0) or Distortion Energy's ADD.X/MOV/JMP stone,
//                      whose pointer eventually reads its own code (STYLE 1)
//   lp-destroyer-stone The LP Destroyer's one-process stone: two JMP #1 stun bombs
//                      a lap on one residue mod 4 for COUNT laps, then a forward
//                      DAT clear that skips its own code
//   lp-gate-dwarf      The LP Destroyer II's SPL-fed dwarf: a predecrement stream
//                      and a stepping bomb, timed so the bomb lands on its own MOV
//   lp-void-quartet    Disciples of the Void's two loaders and four mutually
//                      invisible JMZ.A scanners
//
// All Redcode here is written from the descriptions in docs/hill-top30/lp.md;
// the originals are third-party code and are not part of the repository.

const CORE_MODES = ['$', '#', '@', '*', '<', '>', '{', '}'];
const wrap = (x, core) => ((x % core) + core) % core;
// Written for the 8,000-cell, 8-process LP ring, but plain ring code: they build on any
// ring (ModelWar's 25,200 cells too), where an uncapped SPL lets the papers multiply.
// Offsets given as parameters must stay inside the core.
const lpOnly = (id, settings, P = {}, keys = []) => {
  if (settings.topology) return [`${id} needs a ring`];
  const big = keys.filter((k) => Math.abs(P[k]) >= settings.coreSize);
  return big.length ? [`${id}: ${big.join(', ')} must be smaller than the core`] : [];
};
const sameShape = (a, b) => a.op === b.op && a.mod === b.mod && a.aMode === b.aMode && a.bMode === b.bMode;

// The address an operand reaches, read before the instruction runs (pre- and
// post-increments included, as the VM applies them).
function operandTarget(vm, pc, mode, field, core) {
  const p = wrap(pc + field, core), cell = vm.peek(p);
  switch (mode) {
    case '$': return p;
    case '@': return wrap(p + cell.b, core);
    case '*': return wrap(p + cell.a, core);
    case '<': return wrap(p + cell.b - 1, core);
    case '{': return wrap(p + cell.a - 1, core);
    case '>': return wrap(p + cell.b, core);
    case '}': return wrap(p + cell.a, core);
    default: return pc;
  }
}

// Shared gate for the two papers: the attack (if any) writes every lap, the
// step updates it as declared, the first copy is complete where the contract
// says before the transfer runs, and the transfer moves a process onto its head.
function paperWatch(api, o) {
  const { vm, at, norm, same, P } = api, core = api.core;
  const entry = at(o.entry), entryCode = api.code(o.entry), hop = at('hop'), seed = at('seed');
  const stable = o.stable.map((label) => [norm(at(label) - seed), api.code(label)]);
  const expected = norm(hop + o.hopField - o.first);
  let started = false, done = false, attacks = 0, laps = 0;
  return {
    before(pc) {
      if (done) return null;
      if (!started) {
        if (pc === entry && sameShape(vm.peek(pc), entryCode)) started = true;
        else return null;
      }
      if (o.attack && pc === at('attack')) {
        const ins = vm.peek(pc);
        return { k: 'attack', pc, target: operandTarget(vm, pc, ins.bMode, ins.b, core) };
      }
      if (o.attack && pc === at('step')) {
        const c = vm.peek(at('attack')), h = vm.peek(at('home'));
        return { k: 'step', a: c.a, b: c.b, ha: h.a, hb: h.b };
      }
      if (pc === at('copy')) laps++;
      if (pc === hop) {
        const head = o.head(vm, hop);
        if (head !== expected) throw new Error(`${o.id}: its first copy is at ${head - hop} from the transfer, not ${expected - hop}`);
        for (const [off, code] of stable) {
          if (!same(vm.peek(norm(head + off)), code)) throw new Error(`${o.id}: the transfer ran before the first copy was complete`);
        }
        return { k: 'hop', head };
      }
      return null;
    },
    after(t) {
      if (!t) return;
      if (t.k === 'attack') {
        if (vm.lastWrite[t.target] !== vm.steps || vm.writerPc[t.target] !== t.pc) throw new Error(`${o.id}: a lap's attack wrote nothing`);
        attacks++;
      } else if (t.k === 'step') {
        const c = vm.peek(at('attack'));
        const want = P.ATTACK ? [t.a + t.ha, t.b + t.hb] : [2 * t.a, 2 * t.b];
        if (norm(c.a) !== norm(want[0]) || norm(c.b) !== norm(want[1])) throw new Error(`${o.id}: the step did not ${P.ATTACK ? 'walk' : 'double'} the attack's offsets`);
      } else if (t.k === 'hop') {
        if (vm.processes(0).at(-1) !== t.head) throw new Error(`${o.id}: the transfer did not enter the copy`);
        done = true;
      }
    },
    final() {
      if (api.entered && !api.entered()) return;
      if (started && !done) throw new Error(`${o.id}: it never moved into its first copy`);
      if (o.attack && done && attacks < laps - 1) throw new Error(`${o.id}: ${attacks} attacks in ${laps} laps`);
    },
  };
}

// A paper is running while some process runs one of its unchanging lines, here or in a copy.
const paperRunning = (labels) => (api) => {
  const code = labels.map((label) => api.code(label));
  return api.vm.processes(0).some((pc) => code.some((ins) => api.same(api.vm.peek(pc), ins)));
};

// ---------------------------------------------------------------------------
// lp-rain-paper (7 cells)
//
//   seed   mov.ab #COUNT, #FIRST        the count; ENTRY 0 starts here (first copy COUNT cells)
//   ORDER 0: copy, attack, step  /  ORDER 1: attack, step, copy
//   copy   mov.i  <seed, {hop           backward copy through the hop's A-field
//   attack mov.i  RM READ, WM WRITE     ATTACK 0: a scatter; ATTACK 1: WM is $ (a walk)
//   step   add.f  {0, }0  (or <0, >0)   ATTACK 0: doubles the attack line's two offsets
//          add.f  home, attack          ATTACK 1: adds the restart's two fields to it
//   check  jmn.b  loop, seed (or *copy) loop while the count is not zero
//   home   spl.b  @seed or >seed, HM RESTART   restart at the head; a no-op at the cap
//   hop    jmz.b  HOP or @HOP, *0       enter the copy if its head arrived (B = 0)
const rainOrder = (P) => (P.ORDER ? ['seed', 'attack', 'step', 'copy', 'check', 'home', 'hop'] : ['seed', 'copy', 'attack', 'step', 'check', 'home', 'hop']);
const rainFirst = (P) => (P.ENTRY ? P.FIRST : P.COUNT);
const rainPaper = {
  id: 'lp-rain-paper',
  kind: 'body', exit: 'never', dialects: '94', processes: 1, grows: true, writes: 'sparse', roams: true,
  // ENTRY 1 starts at the first lap line with the count preset.
  entry: (P) => (P.ENTRY ? (P.ORDER ? 'attack' : 'copy') : 'seed'), entryFirst: false,
  purpose: 'The 7-line LP looping paper of Digital Rain, Replinator and Hippogriff: each lap copies one cell backward and makes one remote write, either a scatter whose two offsets double every lap (ATTACK 0) or a walk whose offsets grow by the restart SPL\'s own fields (ATTACK 1); after COUNT cells (COUNT - 7 of them blank, a carpet) an SPL restarts the head, a no-op once eight processes run, and a JMZ guarded by the copy\'s head moves the process into the copy. ORDER, ENTRY and the operand modes pick between the published variants.',
  params: {
    COUNT: [7, 40], FIRST: [7, 40], ENTRY: [0, 1], ORDER: [0, 1], ATTACK: [0, 1],
    READ: [1, 54000], WRITE: [1, 54000], RM: [0, 7], WM: [0, 7], DOUBLE: [0, 1], CHECK: [0, 1],
    HA: [0, 1], HM: [0, 7], RESTART: [1, 54000], HOP: [200, 54000], TRANSFER: [0, 1],
  },
  // Digital Rain's shape and numbers.
  defaults: {
    COUNT: 25, FIRST: 25, ENTRY: 0, ORDER: 1, ATTACK: 0, READ: 2638, WRITE: 2649, RM: 6, WM: 6, DOUBLE: 0, CHECK: 0,
    HA: 1, HM: 7, RESTART: 4001, HOP: 1971, TRANSFER: 0,
  },
  mutable: [['seed', ['b']], ['attack', ['a', 'b']], ['step', ['a', 'b']], ['hop', ['a', 'b']]],
  knowledge: {
    parameterRoles: {
      COUNT: 'Cells copied after a restart (7 body + COUNT-7 blank carpet)', FIRST: 'With ENTRY 1, the first copy\'s length (the seed\'s preset B)',
      ENTRY: '0 starts at the head, 1 at the first lap line with the count preset', ORDER: '0 copy first (R.O.U.S., Bronze minotaur), 1 attack first (Digital Rain, Hippogriff)',
      ATTACK: '0 doubling scatter, 1 arithmetic walk by the restart SPL\'s fields', READ: 'Attack A-field', WRITE: 'Attack B-field',
      RM: 'Attack A mode (index into $ # @ * < > { })', WM: 'Attack B mode (ATTACK 1 forces $)', DOUBLE: 'Step operands {0,}0 (0) or <0,>0 (1)',
      CHECK: 'Loop test through seed (0) or *copy (1)', HA: 'Restart target @seed (0) or >seed (1)', HM: 'Restart B mode', RESTART: 'Restart B-field (ATTACK 1: the walk\'s write step)',
      HOP: 'The transfer\'s A-field: the first copy\'s head is HOP - first count from it', TRANSFER: 'jmz HOP (0) or jmz @HOP (1)',
    },
  },
  mismatches(P, settings) {
    const out = lpOnly('lp-rain-paper', settings, P, ['READ', 'WRITE', 'RESTART', 'HOP']);
    if (P.ATTACK && P.WM !== 0) out.push('lp-rain-paper: a walking attack (ATTACK 1) writes through a direct B-field (WM 0)');
    if (P.RM === 1) out.push('lp-rain-paper: an immediate attack A-field copies the attack line onto itself');
    if (P.HM === 1) out.push('lp-rain-paper: the restart SPL needs a non-immediate B mode');
    if (P.HOP - rainFirst(P) < 2 * 7 || settings.coreSize - P.HOP < 2 * 7) out.push('lp-rain-paper: the first copy lands on itself');
    return out;
  },
  linked(P, { coreSize }, label, { total, shiftedFrame }) {
    if (shiftedFrame) return [];
    const hop = label('hop'), head = hop + P.HOP - rainFirst(P), out = [];
    for (let i = 0; i < rainFirst(P); i++) if (wrap(head + i, coreSize) < total) { out.push('lp-rain-paper: its first copy lands on the warrior'); break; }
    // Pointer cells may sit in blank padding of the image (as published), not on the paper itself.
    const seed = label('seed'), sites = [label('attack') + P.READ, label('attack') + P.WRITE, label('home') + P.RESTART];
    if (sites.some((c) => wrap(c - seed, coreSize) < 7)) out.push('lp-rain-paper: a pointer cell of its attack or restart sits in the paper');
    return out;
  },
  emit({ ins, L, P }) {
    const m = (i) => CORE_MODES[i];
    const loop = L(P.ORDER ? 'attack' : 'copy');
    const cells = {
      seed: () => ins('seed', 'MOV', 'AB', `#${P.COUNT}`, `#${P.ENTRY ? P.FIRST : 0}`),
      copy: () => ins('copy', 'MOV', 'I', `<${L('seed')}`, `{${L('hop')}`),
      attack: () => ins('attack', 'MOV', 'I', `${m(P.RM)}${P.READ}`, `${P.ATTACK ? '$' : m(P.WM)}${P.WRITE}`),
      step: () => (P.ATTACK ? ins('step', 'ADD', 'F', L('home'), L('attack'))
        : ins('step', 'ADD', 'F', P.DOUBLE ? '<0' : '{0', P.DOUBLE ? '>0' : '}0')),
      check: () => ins('check', 'JMN', 'B', loop, P.CHECK ? `*${L('copy')}` : L('seed')),
      home: () => ins('home', 'SPL', 'B', `${P.HA ? '>' : '@'}${L('seed')}`, `${m(P.HM)}${P.RESTART}`),
      hop: () => ins('hop', 'JMZ', 'B', `${P.TRANSFER ? '@' : '$'}${P.HOP}`, '*0'),
    };
    rainOrder(P).forEach((name) => cells[name]());
  },
  running: paperRunning(['copy', 'check']),
  watch(api) {
    const { P } = api;
    return paperWatch(api, {
      id: 'lp-rain-paper', entry: P.ENTRY ? (P.ORDER ? 'attack' : 'copy') : 'seed', attack: true,
      stable: ['copy', 'check', 'home', 'step'], first: rainFirst(P), hopField: P.HOP,
      head: (vm, hop) => {
        const x = wrap(hop + vm.peek(hop).a, api.core);
        return P.TRANSFER ? wrap(x + vm.peek(x).b, api.core) : x;
      },
    });
  },
};

// ---------------------------------------------------------------------------
// lp-quiet-paper (5 cells): the copy loop is two instructions and does nothing else.
//
// STYLE 0 (Fear of the Unknown)          STYLE 1 (Distortion Energy)
//   seed  mov.ab #COUNT, >FIRST            seed  mov.ab #COUNT, #FIRST
//   copy  mov.i  <seed, <hop               copy  mov.i  <seed, {hop
//   check jmn.b  @0, *copy                 check jmn.b  copy, seed
//   home  spl.b  *copy, <DEC               home  spl.b  seed, {DEC
//   hop   jmz.b  @0, HOP                   hop   jmz.b  HOP, *0
//
// Both start at copy with FIRST in the seed's B-field. In STYLE 0 that B-field
// is also the seed's write pointer: restarted with B = 0, the MOV writes COUNT
// into the seed itself.
const quietPaper = {
  id: 'lp-quiet-paper',
  kind: 'body', exit: 'never', dialects: '94', processes: 1, grows: true, writes: 'sparse', roams: true,
  entry: 'copy', entryFirst: false,
  purpose: 'A 5-line LP paper whose lap is a bare 2-instruction backward copy (no attack): FIRST cells the first time, COUNT after each restart (COUNT - 5 blank, a carpet), then an SPL home that is a no-op at the cap and a JMZ into the copy guarded by its head. STYLE 0 addresses as Fear of the Unknown (B-field pointers), STYLE 1 as Distortion Energy (A-field transfer). Meant to run beside a stone that does the attacking.',
  params: { STYLE: [0, 1], COUNT: [5, 45], FIRST: [5, 45], DEC: [1, 54000], HOP: [200, 54000] },
  defaults: { STYLE: 1, COUNT: 38, FIRST: 5, DEC: 2746, HOP: 5919 },
  mutable: [['seed', ['b']], ['hop', ['a', 'b']]],
  knowledge: {
    parameterRoles: {
      STYLE: '0 Fear of the Unknown, 1 Distortion Energy', COUNT: 'Cells copied after a restart', FIRST: 'Cells in the first copy',
      DEC: 'Offset of the cell the restart SPL decrements', HOP: 'The transfer\'s pointer field: the first copy\'s head is HOP - FIRST from it',
    },
  },
  mismatches(P, settings) {
    const out = lpOnly('lp-quiet-paper', settings, P, ['DEC', 'HOP']);
    if (P.HOP - Math.max(P.FIRST, P.COUNT) < 10 || settings.coreSize - P.HOP < 10) out.push('lp-quiet-paper: a copy lands on itself');
    return out;
  },
  linked(P, { coreSize }, label, { total, shiftedFrame }) {
    if (shiftedFrame) return [];
    const head = label('hop') + P.HOP - P.FIRST;
    for (let i = 0; i < P.FIRST; i++) if (wrap(head + i, coreSize) < total) return ['lp-quiet-paper: its first copy lands on the warrior'];
    return wrap(label('home') + P.DEC, coreSize) < total ? ['lp-quiet-paper: the restart SPL decrements a cell of the warrior'] : [];
  },
  emit({ ins, L, P }) {
    if (P.STYLE === 0) {
      ins('seed', 'MOV', 'AB', `#${P.COUNT}`, `>${P.FIRST}`);
      ins('copy', 'MOV', 'I', `<${L('seed')}`, `<${L('hop')}`);
      ins('check', 'JMN', 'B', '@0', `*${L('copy')}`);
      ins('home', 'SPL', 'B', `*${L('copy')}`, `<${P.DEC}`);
      ins('hop', 'JMZ', 'B', '@0', `$${P.HOP}`);
    } else {
      ins('seed', 'MOV', 'AB', `#${P.COUNT}`, `#${P.FIRST}`);
      ins('copy', 'MOV', 'I', `<${L('seed')}`, `{${L('hop')}`);
      ins('check', 'JMN', 'B', L('copy'), L('seed'));
      ins('home', 'SPL', 'B', L('seed'), `{${P.DEC}`);
      ins('hop', 'JMZ', 'B', `$${P.HOP}`, '*0');
    }
  },
  running: paperRunning(['copy', 'check', 'home']),
  watch(api) {
    const { P } = api;
    return paperWatch(api, {
      id: 'lp-quiet-paper', entry: 'copy', attack: false, stable: ['copy', 'check', 'home'], first: P.FIRST, hopField: P.HOP,
      head: (vm, hop) => wrap(hop + (P.STYLE === 0 ? vm.peek(hop).b : vm.peek(hop).a), api.core),
    });
  },
};

// ---------------------------------------------------------------------------
// lp-quad-stone: a 4-process boot and a 4-line stone.
//
//   fan   spl.b 1, src              B: one past the stone (the copy's source pointer)
//   dv    spl.b 1, dst              B: one past the copy; 4 processes now
//         mov.i <fan, <dv           each copies one stone cell, last cell first
//   STYLE 0: jmp.b >dv, 0           each enters the next copied cell: s0, s1, s2, s3
//   STYLE 1: djn.b >vec, #4         three enter s1, s2, s3 through vec's B-field;
//         vec jmp.b s2', s1'        the fourth falls through and enters s2
//
// STYLE 0 (Fear of the Unknown's stone; s0 runs once, then is the increment):
//   s0  mov.i <S, <-S
//   s1  mov.i >2S, 1-2S             moves the cell a post-increment pointer selects
//   s2  add.f s0, <0                adds (S, -S) to s1 through its own B-field
//   s3  jmn.b >-1, s0               back to s1 through the same B-field
// STYLE 1 (Distortion Energy's stone):
//   s0  dat   BSTEP, ASTEP          the increment
//   s1  add.x s0, s2                s2.A += ASTEP, s2.B += s0.A (which s2 decrements)
//   s2  mov.i {AOFS, BOFS           moves the cell an A-predecrement pointer selects
//   s3  jmp.b s1, <GATE
// Four staggered processes in a 3-line loop keep the order a single process
// would have and survive three losses.
const quadMov = (P) => (P.STYLE ? 2 : 1);
const quadStone = {
  id: 'lp-quad-stone',
  kind: 'body', exit: 'never', dialects: '94', processes: 4, writes: 'sparse', roams: true,
  entry: 'fan',
  purpose: 'Boots a 4-line stone HOP cells away with four lockstep processes and starts all four in it, staggered one line apart: STYLE 0 is Fear of the Unknown\'s self-indexed MOV/ADD/JMN stone (S on A, -S on B; the ADD and JMN share one B-field as the pointer to the MOV), STYLE 1 is Distortion Energy\'s ADD.X/MOV/JMP stone, whose increment cell is also decremented by the MOV, so its steps drift until it reads its own code. Four processes in a 3-line loop bomb at a single process\'s pace and survive three losses. Like both originals it ends by bombing its own lines (STYLE 0 after about 4,000 laps, on a gcd-2 lattice), so it needs a partner that lives on: the gate refuses it alone.',
  params: { STYLE: [0, 1], HOP: [200, 54000], S: [2, 54000], ASTEP: [1, 54000], BSTEP: [1, 54000], AOFS: [-4, 4], BOFS: [-4, 4], GATE: [-200, -4] },
  defaults: { STYLE: 0, HOP: 2342, S: 6742, ASTEP: 35, BSTEP: 44, AOFS: -2, BOFS: -1, GATE: -6 },
  knowledge: {
    parameterRoles: {
      STYLE: '0 Fear of the Unknown, 1 Distortion Energy', HOP: 'Distance from the stone\'s cells here to its copy',
      S: 'STYLE 0 step: the MOV\'s A-field moves +S a lap and its B-field -S', ASTEP: 'STYLE 1: added to the MOV\'s A-field a lap', BSTEP: 'STYLE 1: the increment\'s A-field, added to the MOV\'s B-field (it shrinks as the MOV decrements it)',
      AOFS: 'STYLE 1: the MOV\'s first A-field', BOFS: 'STYLE 1: the MOV\'s first B-field', GATE: 'STYLE 1: the JMP\'s decrement, from the JMP',
    },
  },
  mismatches(P, settings) {
    const out = lpOnly('lp-quad-stone', settings, P, ['HOP', 'S', 'ASTEP', 'BSTEP']);
    if (P.STYLE === 0 && wrap(P.S, settings.coreSize) % 2) out.push('lp-quad-stone: an odd S moves the STYLE 0 stone\'s writes onto every residue, its own cells first');
    if (P.STYLE === 1 && (P.AOFS === 0 || P.BOFS === 0)) out.push('lp-quad-stone: a STYLE 1 MOV with a zero field starts by moving onto itself');
    return out;
  },
  linked(P, { coreSize }, label, { total, shiftedFrame }) {
    if (shiftedFrame) return ['lp-quad-stone boots itself and needs an unshifted image'];
    const d = label('s0') + P.HOP;
    for (let i = 0; i < 4; i++) if (wrap(d + i, coreSize) < total) return ['lp-quad-stone: its stone copy lands on the warrior'];
    return [];
  },
  emit({ ins, L, P, core }) {
    const S = wrap(P.S, core);
    // Pointers one past the source (s3) and one past its copy.
    ins('fan', 'SPL', 'B', '1', `${L('s0')}-${L('fan')}+4`);
    ins('dv', 'SPL', 'B', '1', `${L('s0')}-${L('dv')}+${P.HOP + 4}`);
    ins('', 'MOV', 'I', `<${L('fan')}`, `<${L('dv')}`);
    if (P.STYLE === 0) {
      ins('', 'JMP', 'B', `>${L('dv')}`, '0');
      ins('s0', 'MOV', 'I', `<${S}`, `<${wrap(-S, core)}`);
      ins('s1', 'MOV', 'I', `>${wrap(2 * S, core)}`, `${wrap(1 - 2 * S, core)}`);
      ins('s2', 'ADD', 'F', L('s0'), '<0');
      ins('s3', 'JMN', 'B', '>-1', L('s0'));
    } else {
      ins('', 'DJN', 'B', `>${L('vec')}`, '#4');
      ins('vec', 'JMP', 'B', `${L('s0')}-${L('vec')}+${P.HOP + 2}`, `${L('s0')}-${L('vec')}+${P.HOP + 1}`);
      ins('s0', 'DAT', 'F', `${P.BSTEP}`, `${P.ASTEP}`);
      ins('s1', 'ADD', 'X', L('s0'), L('s2'));
      ins('s2', 'MOV', 'I', `{${P.AOFS}`, `${P.BOFS}`);
      ins('s3', 'JMP', 'B', L('s1'), `<${P.GATE}`);
    }
  },
  running(api) {
    const d = api.add(api.at('s0'), api.P.HOP);
    return api.vm.processes(0).some((pc) => api.rel(pc, d) < 4);
  },
  watch(api) {
    const { vm, P, core } = api, d = api.add(api.at('s0'), P.HOP), mv = api.add(d, quadMov(P));
    let arrived = false, bombs = 0, most = 0;
    return {
      before(pc) {
        if (api.rel(pc, d) >= 4) return null;
        if (!arrived) {
          for (let i = 0; i < 4; i++) if (!api.same(vm.peek(api.add(d, i)), api.code('s0', i))) throw new Error('lp-quad-stone: a process entered the stone copy before it was complete');
          arrived = true;
        }
        most = Math.max(most, vm.processes(0).filter((q) => api.rel(q, d) < 4).length);
        const ins = vm.peek(pc);
        if (pc === mv && ins.op === 'MOV') return { pc, target: operandTarget(vm, pc, ins.bMode, ins.b, core) };
        return null;
      },
      after(t) {
        if (t && vm.lastWrite[t.target] === vm.steps && vm.writerPc[t.target] === t.pc) bombs++;
      },
      final() {
        if (api.entered && !api.entered()) return;
        if (!arrived) throw new Error('lp-quad-stone: nothing entered the stone copy');
        if (!api.alone) return;
        if (most < 4) throw new Error(`lp-quad-stone: only ${most} processes ran in the stone`);
        if (bombs < 100) throw new Error(`lp-quad-stone: only ${bombs} moves`);
      },
    };
  },
};

// ---------------------------------------------------------------------------
// lp-destroyer-stone (one process)
//
//   steps  dat   #2*STEP, #2*STEP     the stride; later the clear's pointer
//   cbomb  dat   >ANTI, #last-steps+2  the clear's bomb; on steps it resets the pointer past the code
//          dat   0, 0                 a blank on the traps' residue (lap ~823 would hit cbomb)
//   sloop  add.f steps, ptr
//          mov.i bomb, *ptr           JMP #1 at ptr+ptr.A
//   ptr    mov.i x, x+STEP            ... and copied STEP further on: one residue mod 4
//   x      djn.b sloop, #COUNT
//   clear  mov.i cbomb, >steps        forward clear: a DAT, then
//          djn.f clear, >steps        a decrement on the next cell
//   last   jmp   -1, >steps+ANTI
//          (GAP blank cells)
//   bomb   jmp   #1, #1
const destroyerStone = {
  id: 'lp-destroyer-stone',
  kind: 'body', exit: 'never', dialects: '94', processes: 1, writes: 'core', protects: 'self',
  entry: 'sloop',
  purpose: 'The LP Destroyer\'s one-process stone: each 4-cycle lap drops a JMP #1 stun bomb 2*STEP further on and copies it STEP beyond, so for COUNT laps it covers one residue class mod 4 with traps; then the same process runs a forward DAT clear (a DAT, then a decrement, per two cells) whose bomb resets the pointer past the stone\'s own code when the sweep comes round, with an ANTI-cell decrement against imps.',
  params: { STEP: [4, 1600], COUNT: [100, 7000], ANTI: [1, 54000], GAP: [0, 40] },
  defaults: { STEP: 68, COUNT: 998, ANTI: 2667, GAP: 20 },
  mutable: [['ptr', ['a', 'b']], ['x', ['b']], ['steps', ['a', 'b']]],
  knowledge: {
    parameterRoles: {
      STEP: 'Half the stride; also the distance between the two bombs of a lap', COUNT: 'Laps before the clear',
      ANTI: 'The clear\'s extra post-increment offset (2667: a third of the core, against 3-point imps)', GAP: 'Blank cells between the code and its bomb cell',
    },
  },
  mismatches(P, settings) {
    const out = lpOnly('lp-destroyer-stone', settings, P, ['ANTI']);
    if (P.STEP % 4) out.push('lp-destroyer-stone: STEP must be a multiple of 4, so both bombs of a lap stay on one residue mod 4 off its own code');
    return out;
  },
  emit({ ins, L, P }) {
    ins('steps', 'DAT', 'F', `#${2 * P.STEP}`, `#${2 * P.STEP}`);
    ins('cbomb', 'DAT', 'F', `>${P.ANTI}`, `#${L('last')}-${L('steps')}+2`);
    // A blank cell on the bombs' residue: the lap that would hit cbomb hits it instead.
    ins('', 'DAT', 'F', '0', '0');
    ins('sloop', 'ADD', 'F', L('steps'), L('ptr'));
    ins('', 'MOV', 'I', L('bomb'), `*${L('ptr')}`);
    ins('ptr', 'MOV', 'I', L('x'), `${L('x')}+${P.STEP}`);
    ins('x', 'DJN', 'B', L('sloop'), `#${P.COUNT}`);
    ins('clear', 'MOV', 'I', L('cbomb'), `>${L('steps')}`);
    ins('', 'DJN', 'F', L('clear'), `>${L('steps')}`);
    ins('last', 'JMP', 'B', '-1', `>${L('steps')}+${P.ANTI}`);
    for (let i = 0; i < P.GAP; i++) ins('', 'DAT', 'F', '0', '0');
    ins('bomb', 'JMP', 'B', '#1', '#1');
  },
  watch(api) {
    const { vm, at, P } = api, bomb = api.code('bomb');
    const drop = api.add(at('sloop'), 1), ptr = at('ptr'), clear = at('clear');
    let traps = 0, clears = 0, cleared = false;
    return {
      before(pc) {
        const ins = vm.peek(pc);
        if (pc === drop && ins.op === 'MOV') return { k: 'trap', target: operandTarget(vm, pc, ins.bMode, ins.b, api.core) };
        if (pc === ptr && ins.op === 'MOV') return { k: 'trap', target: api.add(pc, ins.b) };
        if (pc === clear && ins.op === 'MOV') { cleared = true; return { k: 'clear', target: operandTarget(vm, pc, '>', ins.b, api.core) }; }
        return null;
      },
      after(t) {
        if (!t) return;
        const cell = vm.peek(t.target);
        if (t.k === 'trap') {
          // The traps' residue mod 4 holds the blank after cbomb, the gap and the bomb cell: no code cell.
          const off = api.rel(t.target, at('steps'));
          if (off <= 9 && off !== 2) throw new Error('lp-destroyer-stone: a trap landed on its own code');
          if (api.same(cell, bomb)) traps++;
        } else if (vm.lastWrite[t.target] === vm.steps) clears++;
      },
      final() {
        if (api.entered && !api.entered()) return;
        if (!api.alone) return;
        if (traps < Math.min(2 * P.COUNT, 400)) throw new Error(`lp-destroyer-stone: only ${traps} traps`);
        if (!cleared || clears < 100) throw new Error('lp-destroyer-stone: it never ran its clear');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// lp-gate-dwarf (10 cells; 9 with ROUTE 0)
//
//   feed  spl   dl, <FEED            ROUTE 1: a spawner that keeps one process
//         jmp   feed                 feeding the loop for ever (ROUTE 0: spl #0)
//   dl    mov.i db, {(STEP*TIME)+1   a bomb through an A-predecrement stream
//   dh    mov.i db, @dl              a bomb STEP lower each lap; after TIME laps on dh
//         sub.ab #STEP, dl
//   de    djn.f dl, <FEED-4
//         dat 0,0 (x3)
//   db    dat   <FEED-1, >1          (a bomb landing on db itself changes nothing)
//
// When the stepping bomb lands on dh, every process that passes dh dies after
// one more stream bomb. As published (ROUTE 0, spl #0) the SPL process joins
// the loop once the table is full, so after the self-hit nothing replaces the
// dying processes and the warrior dies alone (cycle ~3,800). ROUTE 1 keeps a
// two-line spawner outside the loop (seven loopers and the spawner), so the
// dead are replaced and the stream runs on as a one-cell-per-process clear.
const gateDwarf = {
  id: 'lp-gate-dwarf',
  kind: 'body', exit: 'never', dialects: '94', processes: 1, grows: true, writes: 'core', protects: 'self',
  entry: 'feed',
  purpose: 'The LP Destroyer II\'s dwarf: an SPL #0 fills the process table into a loop that bombs through a remote A-predecrement stream and with a bomb stepping STEP down each lap; after TIME laps that bomb lands on its own MOV, and from then each process makes one stream bomb and dies. ROUTE 1 (needed to live alone) feeds the loop from a two-line SPL/JMP spawner outside it, so the dead are replaced and the stream runs on as a clear.',
  params: { STEP: [1, 1600], TIME: [100, 7000], FEED: [10, 54000], ROUTE: [0, 1] },
  defaults: { STEP: 81, TIME: 1677, FEED: 5279, ROUTE: 1 },
  mutable: [['dl', ['b']], ['dh', ['a', 'b']]],
  knowledge: {
    parameterRoles: {
      STEP: 'Stride of the stepping bomb', TIME: 'Laps until the stepping bomb lands on its own MOV', FEED: 'Offset of the cell the SPL decrements (the DJN and the bomb aim near it)',
      ROUTE: '0 published SPL #0 (dies alone after the self-hit), 1 SPL/JMP spawner outside the loop',
    },
  },
  mismatches(P, settings) {
    const out = lpOnly('lp-gate-dwarf', settings, P, ['FEED']);
    if (P.ROUTE === 0) out.push('lp-gate-dwarf: ROUTE 0 (the published loop) dies alone once its bomb lands on its own MOV');
    const core = settings.coreSize;
    // dl.B starts at STEP*TIME + 1 and falls by STEP a lap; it must not reach dh (1) or the other own cells before TIME laps.
    for (let k = 0; k < P.TIME; k++) {
      const b = wrap(P.STEP * P.TIME + 1 - P.STEP * k, core);
      if ((b <= 3 || b === 7 || b >= core - 1) && b !== 1) { out.push('lp-gate-dwarf: the stepping bomb reaches its own code before its time'); break; }
    }
    return out;
  },
  emit({ ins, L, P, core }) {
    if (P.ROUTE) {
      ins('feed', 'SPL', 'B', L('dl'), `<${P.FEED}`);
      ins('', 'JMP', 'B', L('feed'), '0');
    } else ins('feed', 'SPL', 'B', '#0', `<${P.FEED}`);
    ins('dl', 'MOV', 'I', L('db'), `{${wrap(P.STEP * P.TIME + 1, core)}`);
    ins('dh', 'MOV', 'I', L('db'), `@${L('dl')}`);
    ins('', 'SUB', 'AB', `#${P.STEP}`, L('dl'));
    ins('de', 'DJN', 'F', L('dl'), `<${P.FEED - 4}`);
    for (let i = 0; i < 3; i++) ins('', 'DAT', 'F', '0', '0');
    ins('db', 'DAT', 'F', `<${P.FEED - 1}`, '>1');
  },
  watch(api) {
    const { vm, at, P } = api, dl = at('dl'), dh = at('dh');
    let most = 0, bombs = 0, hit = null;
    return {
      before(pc) {
        if (api.inSelf(pc)) most = Math.max(most, vm.processes(0).length);
        const ins = vm.peek(pc);
        if ((pc === dl || pc === dh) && ins.op === 'MOV') return { pc, target: operandTarget(vm, pc, ins.bMode, ins.b, api.core) };
        return null;
      },
      after(t) {
        if (!t) return;
        const off = api.rel(t.target, dl);
        // The first hit on dh, the SUB or the DJN converts it: from then each process makes one
        // stream bomb (two, if dh survives) and dies, and the spawner replaces it.
        if (hit === null && off >= 1 && off <= 3) { hit = vm.cycle; return; }
        if (hit === null && api.inSelf(t.target) && !(off >= 4 && off <= 7)) throw new Error(`lp-gate-dwarf: it bombed its own code (offset ${off}) before its time, cycle ${vm.cycle}`);
        bombs++;
      },
      final() {
        if (api.entered && !api.entered()) return;
        if (!api.alone) return;
        if (most < api.settings.maxProcesses) throw new Error(`lp-gate-dwarf: the SPL fed only ${most} processes`);
        if (bombs < P.TIME) throw new Error(`lp-gate-dwarf: only ${bombs} bombs`);
        if (hit === null) throw new Error('lp-gate-dwarf: its stepping bomb never reached its own MOV');
      },
    };
  },
};

// ---------------------------------------------------------------------------
// lp-void-quartet: Disciples of the Void's four transparent scanners.
//
//   p1    jmp   #0, 0              pointer template of pair member 1
//   l1    add.b #0, l1-STEP+1      adds its own B-field (-(STEP-1)) to the remote pointer
//         jmz.a l1, <l1-STEP+1     -1 more: STEP down a lap; tests A-fields only (0.5c)
//         mov   @0, >l1-STEP+1     a hit: the pointer cell (jmp #0) as a stun bomb
//         jmn.a @0, -2             back to the JMZ while it still has its A-field
//         spl   #0, 0              the JMZ was hit (a partner or itself found):
//         mov   @0, <-7            an SPL-fed backward DAT clear
//   b1    four MOVs and a DJN copy the six scanner cells to x0+HOP and
//         x0+HOP+SHIFT; two MOVs write p1 on each copy's pointer cell; an SPL
//         starts one copy and a JMP enters the other
//         (GAP blank cells)
//   start spl b1 / jmp b2
//         (GAP blank cells)
//   p2, l2 (SUB.B: STEP up a lap), b2: the same for HOP+2*STEP and HOP+2*STEP+SHIFT
//
// Every scanner cell but the JMZ has A = 0, so A-field scanners cannot see one
// another; the two members of a pair walk in opposite directions on one parity,
// and SHIFT is odd so the other pair is on the other parity. One process each.
const voidSites = (P) => [P.HOP, P.HOP + P.SHIFT, P.HOP + 2 * P.STEP, P.HOP + 2 * P.STEP + P.SHIFT];
const voidQuartet = {
  id: 'lp-void-quartet',
  kind: 'body', exit: 'never', dialects: '94', processes: 4, grows: true, writes: 'core', roams: true,
  entry: 'start', entryFirst: false,
  purpose: 'Disciples of the Void\'s quad scanner: two loaders each copy a 6-cell 0.5c JMZ.A scanner to two places SHIFT apart and start one process in each; the scanners test A-fields only and every one of their cells but the JMZ has A = 0, so the four cannot see one another (the pairs step STEP in opposite directions, SHIFT odd puts the second pair on the other parity). A hit gets the pointer cell (jmp #0) as a stun bomb; when a scanner finally hits its own or its partner\'s JMZ it falls into an SPL-fed backward DAT clear. GAP blank cells separate the loaders from the launch (a decoy image).',
  params: { STEP: [40, 400], HOP: [300, 27000], SHIFT: [3801, 27719], GAP: [0, 83] },
  defaults: { STEP: 78, HOP: 2000, SHIFT: 3961, GAP: 83 },
  knowledge: {
    parameterRoles: {
      STEP: 'Scan step (each pair walks it in opposite directions)', HOP: 'Distance from the first template\'s pointer cell to the first copy',
      SHIFT: 'Distance between the two copies a loader makes (odd: the other parity)', GAP: 'Blank cells on each side of the launch',
    },
  },
  mismatches(P, settings) {
    const out = lpOnly('lp-void-quartet', settings, P, ['HOP']);
    if (Math.abs(P.SHIFT - settings.coreSize / 2) > settings.coreSize / 40) out.push('lp-void-quartet: SHIFT must be close to half the core');
    if (P.STEP % 2) out.push('lp-void-quartet: STEP must be even so a pair stays on one parity');
    if (P.SHIFT % 2 === 0) out.push('lp-void-quartet: SHIFT must be odd so the two pairs sit on different parities');
    return out;
  },
  linked(P, { coreSize }, label, { total, shiftedFrame }) {
    if (shiftedFrame) return ['lp-void-quartet boots its own copies and needs an unshifted image'];
    const x0 = label('p1'), out = [];
    const sites = voidSites(P).map((h) => x0 + h);
    for (const s of sites) for (let i = -STEPBACK(P); i < 7; i++) if (wrap(s + i, coreSize) < total) { out.push('lp-void-quartet: a scanner copy or its pointer lands on the warrior'); return out; }
    return out;
  },
  emit({ ins, L, P }) {
    const scanner = (k, op, back) => {
      const l = `l${k}`, ptr = `${L(l)}-${back}`;
      ins(`p${k}`, 'JMP', 'B', '#0', k === 1 ? '0' : `${P.STEP + 2}`);
      ins(l, op, 'B', '#0', ptr);
      ins(`c${k}`, 'JMZ', 'A', L(l), `<${ptr}`);
      ins('', 'MOV', 'I', '@0', `>${ptr}`);
      ins('', 'JMN', 'A', '@0', L(`c${k}`));
      ins(`s${k}`, 'SPL', 'B', '#0', '0');
      ins('', 'MOV', 'I', '@0', '<-7');
    };
    const loader = (k, hops) => {
      const b = `b${k}`, src = `f${k}`, d1 = `t${k}a`, d2 = `t${k}b`;
      for (let i = 0; i < 2; i++) {
        ins(i ? '' : b, 'MOV', 'I', `<${L(src)}`, `<${L(d1)}`);
        ins('', 'MOV', 'I', `@${L(src)}`, `<${L(d2)}`);
      }
      ins('', 'DJN', 'B', L(b), '#3');
      ins(d1, 'MOV', 'I', L(`p${k}`), `@${L('p1')}+${hops[0] + 6}`);
      ins(d2, 'MOV', 'I', L(`p${k}`), `@${L('p1')}+${hops[1] + 6}`);
      ins(src, 'SPL', 'B', `@${L(d1)}`, `${L(`l${k}`)}+6`);
      ins('', 'JMP', 'B', `@${L(d2)}`, '0');
    };
    const [h1, h3, h2, h4] = voidSites(P);
    scanner(1, 'ADD', P.STEP - 1);
    loader(1, [h1, h3]);
    for (let i = 0; i < P.GAP; i++) ins('', 'DAT', 'F', '0', '0');
    ins('start', 'SPL', 'B', L('b1'), '0');
    ins('', 'JMP', 'B', L('b2'), '0');
    for (let i = 0; i < P.GAP; i++) ins('', 'DAT', 'F', '0', '0');
    scanner(2, 'SUB', P.STEP + 1);
    loader(2, [h2, h4]);
  },
  running(api) {
    const x0 = api.at('p1'), sites = voidSites(api.P).map((h) => api.add(x0, h));
    return api.vm.processes(0).some((pc) => sites.some((s) => api.rel(pc, s) < 6));
  },
  watch(api) {
    const { vm, P } = api, x0 = api.at('p1');
    const sites = voidSites(P).map((h, i) => ({ at: api.add(x0, h), k: i < 2 ? 1 : 2 }));
    const arrived = new Set();
    let bombs = 0, clears = 0;
    return {
      before(pc) {
        for (const s of sites) {
          if (api.rel(pc, s.at) >= 6) continue;
          if (!arrived.has(s.at)) {
            for (let i = 0; i < 6; i++) if (!api.same(vm.peek(api.add(s.at, i)), api.code(`l${s.k}`, i))) throw new Error('lp-void-quartet: a scanner started before its copy was complete');
            const ptr = vm.peek(api.add(s.at, vm.peek(s.at).b));
            if (!api.same({ ...ptr, b: 0 }, { ...api.code(`p${s.k}`), b: 0 })) throw new Error('lp-void-quartet: a scanner started without its pointer cell');
            arrived.add(s.at);
          }
          const off = api.rel(pc, s.at), ins = vm.peek(pc);
          if (off === 2 && ins.op === 'MOV') bombs++;
          if (off === 4 && ins.op === 'SPL') clears++;
        }
        return null;
      },
      final() {
        if (api.entered && !api.entered()) return;
        if (arrived.size !== 4) throw new Error(`lp-void-quartet: ${arrived.size} of 4 scanners started`);
        // A pass takes most of a round on its own (the first clear starts near cycle 32,000 on LP),
        // so the clear is checked only on runs that went most of the way.
        if (api.alone && vm.cycle >= 0.75 * api.settings.maxCycles && clears === 0) throw new Error('lp-void-quartet: no scanner reached its clear');
      },
    };
  },
};
// Cells before a copy that it uses: its pointer (STEP+1 back at most) and the clear's cells.
const STEPBACK = (P) => P.STEP + 2;

export default [rainPaper, quietPaper, quadStone, destroyerStone, gateDwarf, voidQuartet];
