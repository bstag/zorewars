// Hill vampires: the scan-bite-clear vampire of the Koenigstuhl 94nop hill
// (docs/hill-recipe-book.md, vampires chapter), and a piece of the in-round
// switch that picks a body from what the opening found.
//
//   fang-vampire   one dual-field fang is both scan pointer and bomb; the pit is
//                  a parameter (stun, leaky DJN, counting, or none at all: the
//                  Unpit sentinel); the first prisoner flips it to a SPL/DAT clear
//   probe-verdict  reads an opening's probe and records found-nothing / a lone
//                  cell / a body, for a body or a future combinator to branch on
//
// How to write a block: docs/block-algebra.md. All Redcode here is written
// from scratch; hill warriors were studied for ideas only.


const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const mod = (x, core) => ((x % core) + core) % core;
const MARKER = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };

// ---------------------------------------------------------------------------
// fang-vampire
//
// The fang `JMP a, b` is the vampire's only pointer. Its B-field is the scan
// pointer (`jmz.f loop, @fang` looks at fang+b) and its A-field is the way
// home: one `add.f inc, fang` with inc = (-STEP, +STEP) moves the two fields in
// opposite directions, so a + b stays equal to (aim - fang). When the scan
// finds an occupied cell S = fang+b outside the warrior, `mov.i fang, @fang`
// copies the fang there unchanged, and S + a = aim: the enemy process that
// runs it jumps straight to the aim. A scan pass is two instructions (.5c).
// The idea of the A/B pair summing to the pit is from Curse of the Undead and
// Nosferatu (John Metcalf); Forgotten Lore II, Carmilla and Unpit scan and bite
// the same way.
//
// The aim is the pit, chosen by PIT:
//   0 stun:     `spl #0, >0` / `jmp pit`: prisoners split in place forever and
//               the first one's postincrement marks pit.B (Curse, Bloodlust).
//   1 leaky:    `djn $0, #0`: a prisoner loops, counting pit.B down; after a lap
//               of the core it falls out onto a DAT and dies, even if the
//               vampire is dead by then (Carmilla, One bite).
//   2 counting: each arrival counts HOLD down and waits in a JMN loop; the
//               HOLD-th arrival releases them all onto DATs (Forgotten Lore II
//               counts to MAXPROCESSES).
//   3 none:     Unpit's trick (P. Kline). The fang is `jmp }a` aimed at a
//               sentinel X = `dat #KILL`: the prisoner jumps through X to
//               X+KILL, an empty cell KILL away, and dies there, and the `}`
//               bumps X.A, which is the signal. No pit holds anyone.
// RELAY > 0 (pits 0-2) is Carmilla's anti-trace: the start code drops a relay
// `jmp pit` RELAY cells past the pit and the fangs aim at it, so a scanner
// that follows a fang finds the relay, not the warrior.
//
// After every bite the vampire checks the pit's signal; while it is unchanged
// it scans on (a bite with no prisoner switches nothing). Once a prisoner has
// arrived it falls into a one-process SPL-then-DAT clear of every cell outside
// the warrior: a SPL lap stuns, then it DATs the cells prisoners loop on and
// clears with DATs for ever. A prisoner that arrives just after a bite is
// noticed at the next bite (on an empty board, when the scan comes round to
// its own fang a lap later).
const PITS = ['stun', 'leaky DJN', 'counting', 'none (Unpit sentinel)'];

// Offsets the watch and the plant need: the first scan cell and the k-th one.
const scanCell = (api, k) => api.norm(api.at('vFang') + api.code('vFang').b + k * api.P.STEP);
// Where the fangs must lead: the relay, the sentinel or the pit.
const aimOf = (api) => (api.P.PIT === 3 ? api.at('vSent') : api.P.RELAY ? api.norm(api.at('vPit') + api.P.RELAY) : api.at('vPit'));
// The third scan cell well clear of the warrior (and of the relay).
function vampPlanted(api) {
  let found = 0;
  for (let k = 1; k < 4000; k++) {
    const c = scanCell(api, k);
    if (!api.inImage(c) && !api.inImage(c + 1) && !api.inImage(c - 1) && c !== aimOf(api) && ++found === 3) return c;
  }
  return null;
}

const fangVampire = {
  id: 'fang-vampire',
  kind: 'body', exit: 'never', processes: 1, writes: 'core', roams: false, dialects: '94',
  purpose: 'Scanning vampire: one JMP fang whose A and B fields move oppositely by STEP is both scan pointer (B) and way home (A, summing to the pit); it bites occupied cells outside the warrior, and when the pit (PIT 0 stun, 1 leaky DJN, 2 counting HOLD arrivals, 3 none: an Unpit sentinel whose postincrement is the signal) reports a prisoner it switches to a SPL-then-DAT clear. RELAY > 0 aims the fangs at a remote relay (anti-trace).',
  params: { STEP: [1, 27719], PIT: [0, 3], RELAY: [0, 27000], HOLD: [1, 4000], KILL: [256, 27000] },
  defaults: { STEP: 2341, PIT: 0, RELAY: 0, HOLD: 6, KILL: 3000 },
  entry: 'vStart', loop: 'vLoop',
  mutable: [['vFang', ['a', 'b']], ['vPit', ['a', 'b']], ['vPit1', ['b']], ['vCnt', ['b']], ['vSent', ['a']], ['cPtr', ['b']], ['cCnt', ['b']], ['cBomb', ['a', 'b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, room = settings.maxLength, out = [];
    const reach = core / gcd(P.STEP, core);
    if (reach < 1000) out.push(`fang-vampire: STEP ${P.STEP} scans only ${reach} cells of the core`);
    if (P.RELAY && P.PIT === 3) out.push('fang-vampire: the Unpit sentinel is its own relay; RELAY must be 0 with PIT 3');
    if (P.RELAY && (P.RELAY < 2 * room || P.RELAY > core - 2 * room)) out.push('fang-vampire: the relay lands on or next to the warrior');
    if (P.PIT === 3 && (P.KILL < 2 * room || P.KILL + 1000 > core - 2 * room)) out.push('fang-vampire: the kill zone (KILL past the sentinel, drifting a cell per prisoner) runs into the warrior');
    if (P.PIT === 2 && P.HOLD >= settings.maxProcesses) out.push(`fang-vampire: HOLD ${P.HOLD} prisoners can never all arrive (at most ${settings.maxProcesses} processes)`);
    return out;
  },
  emit(ctx) {
    const { L, P, span, core } = ctx;
    // What the fang's A-field leads to, as an offset from the fang.
    const aim = P.PIT === 3 ? `(${L('vSent')}-${L('vFang')})` : `(${L('vPit')}-${L('vFang')}+${P.RELAY})`;
    if (P.RELAY) ctx.ins('vStart', 'MOV', 'I', L('vRel'), `${L('vPit')}+${P.RELAY}`);
    else ctx.mark('vStart');
    ctx.ins('vLoop', 'ADD', 'F', L('vInc'), L('vFang'));             // a -= STEP, b += STEP
    ctx.ins('vLook', 'JMZ', 'F', L('vLoop'), `@${L('vFang')}`);      // empty? scan on
    // Found something. Skip the warrior's own image [0, span): fang+b is in it
    // when b <= span-1-iF or b >= core-iF (iF = the fang's index).
    const iF = (here) => `(${here}+${L('vFang')})`;                  // label arithmetic: the fang's index
    ctx.ins('', 'SLT', 'AB', `#(${span - 1}-${iF(ctx.pc())})`, L('vFang'));
    ctx.ins('', 'JMP', 'B', L('vLoop'));                             // our own code, past the fang's side
    ctx.ins('', 'SLT', 'AB', `#(${core - 1}-${iF(ctx.pc())})`, L('vFang'));
    ctx.ins('', 'JMP', 'B', P.RELAY ? L('vNotR') : L('vBite'));
    ctx.ins('', 'JMP', 'B', L('vLoop'));                             // wrapped round into our own code
    if (P.RELAY) {                                                   // and never bite the relay
      ctx.ins('vNotR', 'SNE', 'AB', `#${aim}`, L('vFang'));
      ctx.ins('', 'JMP', 'B', L('vLoop'));
    }
    ctx.ins('vBite', 'MOV', 'I', L('vFang'), `@${L('vFang')}`);     // the copy at S has S + a = aim
    // The signal: has a prisoner arrived?
    if (P.PIT <= 1) ctx.ins('vCheck', 'JMZ', 'B', L('vLoop'), L('vPit'));
    else {
      ctx.ins('vCheck', 'SNE', P.PIT === 2 ? 'AB' : 'A', `#${P.PIT === 2 ? P.HOLD : P.KILL}`, P.PIT === 2 ? L('vCnt') : L('vSent'));
      ctx.ins('', 'JMP', 'B', L('vLoop'));
    }
    // The clear: a SPL lap of every cell outside the image, then DATs for ever.
    ctx.ins('clr', 'MOV', 'I', L('cBomb'), `>${L('cPtr')}`);
    ctx.ins('', 'DJN', 'B', L('clr'), L('cCnt'));
    ctx.ins('', 'ADD', 'AB', `#${span}`, L('cPtr'));                // hop over the image
    ctx.ins('', 'MOV', 'AB', `#${core - span}`, L('cCnt'));
    ctx.ins('', 'MOV', 'I', L('cDat'), L('cBomb'));                 // DATs from the second lap on
    for (const cell of { 0: ['vPit', 'vPit1'], 1: ['vPit'], 2: ['vHold'], 3: [] }[P.PIT]) ctx.ins('', 'MOV', 'I', L('cDat'), L(cell));
    ctx.ins('', 'JMP', 'B', L('clr'));
    ctx.ins('cPtr', 'DAT', 'F', '#0', `#${span - ctx.pc()}`);        // first write: just past the image
    ctx.ins('cCnt', 'DAT', 'F', '#0', `#${core - span}`);
    ctx.ins('cBomb', 'SPL', 'B', '#0', '#0');
    ctx.ins('cDat', 'DAT', 'F', '#0', '#0');
    // The fang. The first look (after one ADD) is the cell just past the image.
    ctx.ins('vInc', 'DAT', 'F', `#${-P.STEP}`, `#${P.STEP}`);
    const b0 = `(${span - P.STEP}-${ctx.pc()})`;
    ctx.ins('vFang', 'JMP', 'B', `${P.PIT === 3 ? '}' : '$'}(${aim}-${b0})`, b0);
    if (P.RELAY) ctx.ins('vRel', 'JMP', 'B', `$${-P.RELAY}`);        // copied RELAY past the pit: jumps back to it
    // The pit.
    if (P.PIT === 0) {
      ctx.ins('vPit', 'SPL', 'B', '#0', '>0');                       // split in place; the first marks pit.B
      ctx.ins('vPit1', 'JMP', 'B', L('vPit'));
    } else if (P.PIT === 1) {
      ctx.ins('vPit', 'DJN', 'B', '$0', '#0');                       // loop a lap of the core...
      ctx.ins('', 'DAT', 'F', '#0', '#0');                           // ...then fall out and die
    } else if (P.PIT === 2) {
      ctx.ins('vPit', 'DJN', 'B', L('vHold'), L('vCnt'));            // count the arrival
      ctx.ins('', 'DAT', 'F', '#0', '#0');                           // the HOLD-th dies here...
      ctx.ins('vHold', 'JMN', 'B', L('vHold'), L('vCnt'));           // ...the rest wait for it
      ctx.ins('', 'DAT', 'F', '#0', '#0');
      ctx.ins('vCnt', 'DAT', 'F', '#0', `#${P.HOLD}`);
    } else {
      ctx.ins('vSent', 'DAT', 'F', `#${P.KILL}`, '#0');              // through here to an empty cell KILL away
    }
  },
  plant(api) {
    const c = vampPlanted(api);
    return c === null ? [] : [[c, MARKER]];
  },
  watch(api) {
    const { vm, P } = api, fang = api.at('vFang'), aim = aimOf(api);
    const planted = api.scenario === 'fang-vampire: planted target';
    const target = planted ? vampPlanted(api) : null;
    let looks = 0, fangs = 0, clearAt = null, hitPlanted = false;
    return {
      before(pc) {
        if (pc === api.at('vLook')) looks++;
        if (pc === api.at('clr') && clearAt === null) clearAt = vm.cycle;
        if (pc === api.at('vBite') && api.same(vm.peek(pc), api.code('vBite'))) return { bite: api.norm(fang + vm.peek(fang).b) };
        if (pc === api.at('clr') && api.same(vm.peek(pc), api.code('clr'))) return { clear: api.norm(api.at('cPtr') + vm.peek(api.at('cPtr')).b) };
        return null;
      },
      after(t) {
        if (!t) return;
        if (t.clear !== undefined) { if (api.inSelf(t.clear)) throw new Error("fang-vampire's clear hit its own code"); return; }
        const c = t.bite;
        if (api.inImage(c)) throw new Error('fang-vampire bit its own warrior');
        if (P.RELAY && c === aim) throw new Error('fang-vampire bit its own relay');
        const f = vm.peek(c);
        if (f.op !== 'JMP' || api.norm(c + f.a) !== aim) throw new Error('A fang-vampire fang does not lead to its pit');
        fangs++;
        if (c === target) hitPlanted = true;
      },
      final() {
        if (planted && target !== null) {
          if (!hitPlanted) throw new Error('fang-vampire ignored the planted cell');
          if (clearAt !== null) throw new Error('fang-vampire switched to its clear with no prisoner');
        }
        if (!api.alone) return;
        if (looks < 1000) throw new Error(`fang-vampire looked at too few cells (${looks})`);
        if (fangs) throw new Error('fang-vampire bit an empty core');
        if (clearAt !== null) throw new Error('fang-vampire switched to its clear with no prisoner');
        if (P.RELAY && !api.same(vm.peek(aim), { ...api.code('vRel'), a: api.norm(-P.RELAY) })) throw new Error('fang-vampire did not place its relay');
        if (api.image.start === 0) prisonerDuel(api);
      },
    };
  },
};

// The mechanism with a real prisoner: a fresh round against a one-cell loop
// planted on the scan path. The vampire must bite it, take its process
// prisoner (PIT 3: kill it and bump the sentinel), switch to the clear and
// win, with its own code intact.
function prisonerDuel(api) {
  const { P } = api;
  let k = 40, cell = scanCell(api, k);
  while (api.inImage(cell) || api.inImage(cell + 1) || api.inImage(cell - 1) || cell === aimOf(api)) cell = scanCell(api, ++k);
  const offset = api.norm(cell - api.image.start);
  const d = api.duel('victim jmp 0, 1\n', { offset });
  if (!d.ours) throw new Error('fang-vampire died against a lone loop');
  if (d.theirs) throw new Error(`fang-vampire's ${PITS[P.PIT]} pit did not finish its prisoner`);
  if (P.PIT === 3) {
    if (d.vm.peek(api.at('vSent')).a !== P.KILL + 1) throw new Error('The Unpit sentinel was not bumped by its prisoner');
  } else {
    // The clear has started once its counter moved or its bomb became a DAT.
    // A leaky pit may finish its prisoner on its own first (a lap of the core).
    const switched = d.vm.peek(api.at('cCnt')).b !== api.code('cCnt').b || d.vm.peek(api.at('cBomb')).op === 'DAT';
    if (!switched && P.PIT !== 1) throw new Error('fang-vampire never switched to its clear');
  }
  // Our code outside the pit and the moving fields must be as loaded.
  const skip = new Set(['vFang', 'cPtr', 'cCnt', 'cBomb', 'vPit', 'vPit1', 'vHold', 'vCnt', 'vSent'].map((l) => { try { return api.at(l); } catch { return -1; } }));
  for (let c = api.self.start, n = 0; n < api.self.size; n++, c = api.norm(c + 1)) {
    if (skip.has(c)) continue;
    const k2 = api.norm(c - api.self.start);
    if (!api.same(d.vm.peek(c), api.code('vStart', k2))) throw new Error('fang-vampire\'s code was damaged in the prisoner duel');
  }
}

// ---------------------------------------------------------------------------
// probe-verdict
//
// The opening half of Alternating Raisins' in-round switch (Steve Gunnell:
// paper if the quickscan hit, scanner if not), with Argon's refinement of
// telling a lone bomb from a body. It sits in a seq after an opening that
// hands on a probe, reads it, and writes a verdict cell (provided as the
// capability `verdict`): B = 0 when the opening found nothing (the probe at
// the image boundary), 1 when it found a lone cell (the NEAR cells either side
// of the hit are all empty: probably a bomb or a decoy), 2 when a neighbour is
// occupied too (a body). Then it hands on, leaving the probe as it was. A body
// (or the combinator sketched in the report) branches on the verdict.
const VERDICT = { NONE: 0, LONE: 1, BODY: 2 };
const verdictFound = (api) => mod(api.image.start + Math.floor(api.core / 2) + 1, api.core);

const probeVerdict = {
  id: 'probe-verdict',
  kind: 'opening', exit: 'next', processes: 1, writes: 'sparse', link: 'fall', dialects: '94',
  purpose: 'Reads an opening\'s probe and records a verdict (capability `verdict`, B-field): 0 the opening found nothing, 1 a lone cell (its NEAR neighbours either side empty: a bomb or decoy), 2 a body (a neighbour occupied too); then hands on with the probe unchanged.',
  params: { NEAR: [1, 8] },
  defaults: { NEAR: 2 },
  entry: 'pv',
  needs: ['probe'],
  provides: { verdict: 'verdict' },
  mutable: [['verdict', ['b']], ['pvPtr', ['b']], ['pvCnt', ['b']]],
  mismatches(P, settings) {
    return P.NEAR * 2 + 1 >= settings.maxLength ? ['probe-verdict: the neighbourhood is as wide as a warrior'] : [];
  },
  state(ctx) { ctx.ins('verdict', 'DAT', 'F', '#0', '#0'); },
  emit(ctx) {
    const { L, P, span } = ctx, U = ctx.ref('probe');
    ctx.ins('pv', 'SNE', 'AB', `#${span}`, U);                       // boundary: found nothing, verdict 0
    ctx.ins('', 'JMP', 'B', ctx.next);
    ctx.ins('', 'MOV', 'AB', `#${VERDICT.LONE}`, L('verdict'));
    // pvPtr -> found - NEAR; walk 2*NEAR+1 cells, skipping the found one itself.
    ctx.ins('', 'MOV', 'B', U, L('pvPtr'));
    ctx.ins('', 'ADD', 'AB', `#(${U}-${L('pvPtr')}-${P.NEAR})`, L('pvPtr'));
    ctx.ins('', 'MOV', 'AB', `#${2 * P.NEAR + 1}`, L('pvCnt'));
    ctx.ins('pvLoop', 'SNE', 'AB', `#${P.NEAR + 1}`, L('pvCnt'));      // the found cell: don't count it
    ctx.ins('', 'JMP', 'B', L('pvNext'));
    ctx.ins('', 'JMZ', 'F', L('pvNext'), `@${L('pvPtr')}`);
    ctx.ins('', 'MOV', 'AB', `#${VERDICT.BODY}`, L('verdict'));      // an occupied neighbour: a body
    ctx.ins('', 'JMP', 'B', ctx.next);
    ctx.ins('pvNext', 'ADD', 'AB', '#1', L('pvPtr'));
    ctx.ins('', 'DJN', 'B', L('pvLoop'), L('pvCnt'));
    ctx.ins('', 'JMP', 'B', ctx.next);
    ctx.ins('pvPtr', 'DAT', 'F', '#0', '#0');
    ctx.ins('pvCnt', 'DAT', 'F', '#0', '#0');
  },
  // Aim the upstream opening's probe at a far cell holding a marker, with a
  // second marker beside it: the verdict must be "body".
  plant(api) {
    const found = verdictFound(api), U = api.ref('probe');
    return [[U, { op: 'DAT', mod: 'F', aMode: '#', a: 0, bMode: '#', b: api.norm(found - U) }], [found, MARKER], [found + api.P.NEAR, MARKER]];
  },
  watch(api) {
    const planted = api.scenario === 'probe-verdict: planted target';
    let prevIn = false, exited = false, seen = null, foundB = null;
    return {
      before(pc) {
        if (pc === api.entry() && foundB === null) foundB = api.vm.peek(api.ref('probe')).b;
        if (prevIn && !api.inSelf(pc) && !exited && !api.vm.processes(0).some((q) => api.inSelf(q))) { exited = true; seen = api.vm.peek(api.at('verdict')).b; }
        prevIn = api.inSelf(pc);
        return null;
      },
      final() {
        if (!exited) { if (planted) throw new Error('probe-verdict never handed on'); return; }
        if (planted && seen !== VERDICT.BODY) throw new Error(`probe-verdict called a body ${seen}, not ${VERDICT.BODY}`);
        if (api.scenario === 'alone' && foundB !== null) {
          const U = api.ref('probe'), boundary = api.inImage(U + foundB - 1) && !api.inImage(U + foundB);
          if (boundary && seen !== VERDICT.NONE) throw new Error(`probe-verdict saw a hit (${seen}) although the opening found nothing`);
        }
      },
    };
  },
};

export default [fangVampire, probeVerdict];
export { VERDICT, PITS };
