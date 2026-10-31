// Hill scanners: the two scanner engines the Koenigstuhl 94nop leaders win
// with that we had no block for (docs/hill-recipe-book.md, scanners chapter,
// gaps #6 and #14):
//
// - scanner-pendulum: Metcalf's .75c Pendulum engine. A tiny SNE scanner that,
//   on a real find, wipes forward with SPL until it reaches an empty cell
//   (wipe-until-empty, so a body of any length is stunned), and counts the
//   times the scan comes round onto its own code; after TIME such self-finds
//   it flips the wipe bomb from SPL to DAT, so the same scan-and-wipe loop
//   turns every stun back into a kill and becomes a core clear. Used by
//   Pendulum, Xenosmilus and Herald of Destruction.
// - oneshot-cobra: inversed's King Cobra oneshot. It scans two adjacent cells
//   on a find and commits only when both are occupied (a body), not when just
//   one is (a lone stone bomb or a decrement its own stream left), so decoys
//   and bombers don't trigger it. On a real find it starts a forward clear
//   right at the scan pointer; a DJN counter folded into the clear flips its
//   bomb from SPL to DAT after TIME writes (the SPL pass stuns, the DAT pass
//   kills), and the clear steps over its own image on every wrap. Used by
//   King Cobra, Kaitain, Infravision. (King Cobra also spins off a crawling
//   `mov.i` imp as a tie failsafe on the find; that is left out here because a
//   ring-crawling imp laps the core and overwrites the clear within one lap,
//   which the solo gate -- 80,000 cycles alone -- cannot survive. See the
//   report: it belongs with a boot that puts the engine where the imp's lap
//   does not reach it before the round ends.)
//
// Both are '94-only bodies (they use .I compares and indirect modes '88 has
// not). All Redcode here is written from scratch; the hill warriors above were
// read for ideas, never copied. How to write a block: docs/block-algebra.md.

const MARKER = { op: 'DAT', mod: 'F', aMode: '#', a: 1, bMode: '#', b: 123 };
const mod = (x, core) => ((x % core) + core) % core;
// The global index of a local label, as an expression usable on the current
// line (a label's value is its distance from the line; plus the line's index
// gives the absolute index, which is what span/CORESIZE are measured in).
const idxOf = (ctx, label) => `(${ctx.L(label)}+${ctx.pc()})`;
const BODY = { kind: 'body', exit: 'never', roams: false, dialects: '94' };

// ---------------------------------------------------------------------------
// scanner-pendulum
//
// A pointer cell (ptr) holds the offset of the cell to look at; each loop adds
// STEP and looks (JMZ.F, as the Blur line does). An empty cell is skipped. A
// non-empty cell that is far enough from our own code (both guards, as the
// plain `scanner` uses) is a real find: from it the wipe lays the bomb forward,
// cell after cell, until it reaches an empty one -- so a body of any length is
// stunned (wipe-until-empty, Pendulum's `jmn.f wipe,>ptr`). A non-empty cell
// that falls on our own image is a self-find: it decrements cnt, and when cnt
// reaches zero the bomb cell is overwritten with a DAT, so from then on the
// wipe kills instead of stunning and the loop becomes a core clear.
function emitPendulum(ctx) {
  const { L, P, span } = ctx, ptr = L('ptr');
  const lo = (l) => `#(${span}-${idxOf(ctx, l)}-1)`;
  const hi = (l) => `#(CORESIZE-${idxOf(ctx, l)}-${P.ROOM})`;
  ctx.ins('sLoop', 'ADD', 'AB', `#${P.STEP}`, ptr);
  ctx.ins('sLook', 'JMZ', 'F', L('sLoop'), `@${ptr}`);   // empty? keep scanning
  // A non-empty cell. In range (past our image, not wrapped into it) -> wipe.
  ctx.ins('sHit', 'SLT', 'AB', lo('ptr'), ptr);          // ptr.B >= span? skip to the far test
  ctx.ins('', 'JMP', 'B', L('self'));                    // ptr.B < span: our own image
  ctx.ins('', 'SLT', 'AB', hi('ptr'), ptr);              // ptr.B <= core-ROOM? don't skip
  ctx.ins('', 'JMP', 'B', L('wSet'));
  ctx.ins('', 'JMP', 'B', L('self'));                    // too far: wrapped into our image
  // Wipe forward from the cell until an empty cell is reached.
  ctx.ins('wSet', 'MOV', 'B', ptr, L('wp'));             // wp.B := ptr.B
  ctx.ins('', 'ADD', 'AB', `#(${idxOf(ctx, 'ptr')}-${idxOf(ctx, 'wp')})`, L('wp'));
  ctx.ins('wipe', 'MOV', 'I', L('bomb'), `@${L('wp')}`);
  ctx.ins('', 'ADD', 'AB', '#1', L('wp'));
  ctx.ins('', 'JMZ', 'F', L('sLoop'), `@${L('wp')}`);    // next cell empty? stop wiping
  ctx.ins('', 'JMP', 'B', L('wipe'));
  // A self-find: count down, and when the count runs out flip the bomb to DAT.
  ctx.ins('self', 'DJN', 'B', L('sLoop'), L('cnt'));
  ctx.ins('', 'MOV', 'I', L('dbomb'), L('bomb'));
  ctx.ins('', 'JMP', 'B', L('sLoop'));
  // Data.
  ctx.ins('ptr', 'DAT', 'F', '#0', `#(${span}-${idxOf(ctx, 'ptr')}-${P.STEP})`);
  ctx.ins('wp', 'DAT', 'F', '#0', '#0');
  ctx.ins('cnt', 'DAT', 'F', '#0', `#${P.TIME}`);
  ctx.ins('bomb', 'SPL', 'B', '#0', '#0');
  ctx.ins('dbomb', 'DAT', 'F', '#0', '#0');
}

// Where the scan looks on lap k.
const penLook = (api, k) => mod(api.at('ptr') + api.code('ptr').b + k * api.P.STEP, api.core);
// The planted target: the first B cell outside the image with empty room after
// it (so the wipe starts and ends cleanly) and a marker neighbour for a body.
function penTarget(api) {
  let found = 0;
  for (let k = 1; k < 5000; k++) {
    const c = penLook(api, k);
    let clear = true;
    for (let j = -4; j <= 40 && clear; j++) if (api.inImage(c + j)) clear = false;
    if (clear && ++found === 3) return c;
  }
  return -1;
}

function watchPendulum(api) {
  const { vm, core } = api, wp = api.at('wp');
  const planted = api.scenario === 'scanner-pendulum: planted target';
  const target = planted ? penTarget(api) : -1;
  const wiped = new Set();
  let looks = 0, bombs = 0, flipped = null, enteredAt = null;
  return {
    before(pc) {
      if (enteredAt === null) enteredAt = vm.cycle;
      if (pc === api.at('sLook')) looks++;
      if (pc !== api.at('wipe')) return null;
      return mod(wp + vm.peek(wp).b, core);
    },
    after(t) {
      if (t === null) return;
      if (api.inSelf(t)) throw new Error('scanner-pendulum wiped its own code');
      const want = flipped === null ? api.code('bomb') : api.code('dbomb');
      if (!api.same(vm.peek(t), want) || vm.writerPc[t] !== api.at('wipe')) throw new Error('scanner-pendulum dropped something other than its bomb');
      wiped.add(t);
      if (!api.inImage(t)) bombs++;   // a booted decoy it finds is fair game; only truly empty cells count
    },
    final() {
      // Record the flip whenever it happens (the bomb cell becomes a DAT).
      if (flipped === null && api.same(vm.peek(api.at('bomb')), api.code('dbomb'))) flipped = vm.cycle;
      if (planted) {
        if (!wiped.has(target)) throw new Error('scanner-pendulum ignored the planted target');
        if (!wiped.has(mod(target + 1, core))) throw new Error('scanner-pendulum did not wipe forward through the body');
      }
      if (!api.alone) return;
      if (looks < 1000) throw new Error('scanner-pendulum looked at too few cells');
      if (bombs) throw new Error('scanner-pendulum wiped an empty core');
      if (flipped === null) throw new Error('scanner-pendulum never flipped its wipe to a DAT clear');
    },
  };
}

// ---------------------------------------------------------------------------
// oneshot-cobra
//
// Scan loop: ptr holds a pair GAP apart; each lap steps and compares (SNE.I).
// A difference in range is checked for a body: the B cell and the cell after
// it must both be non-empty (bomb detection) -- a lone bomb or a stray
// decrement leaves only one cell changed and is ignored. On a real body it
// SPLs off an imp (a crawling MOV.I, a tie failsafe) and runs a forward clear
// from the found cell: cptr walks forward writing the bomb `sel` points at,
// stepping over the image on each wrap; a DJN counter folded into the loop
// points `sel` at the DAT cell after TIME writes, so the stun pass becomes a
// kill pass. Alone nothing is ever found, so it just scans and survives.
function emitCobra(ctx) {
  const { L, P, span } = ctx, ptr = L('ptr'), cptr = L('cptr');
  const lo = (l) => `#(${span}-${idxOf(ctx, l)}-1)`;
  const hi = (l) => `#(CORESIZE-${idxOf(ctx, l)}-${P.ROOM})`;
  ctx.ins('sLoop', 'ADD', 'F', L('inc'), ptr);
  ctx.ins('sLook', 'SNE', 'I', `*${ptr}`, `@${ptr}`);    // pair differs? skip the loop-jump
  ctx.ins('', 'JMP', 'B', L('sLoop'));
  ctx.ins('sHit', 'SLT', 'AB', lo('ptr'), ptr);          // ptr.B >= span?
  ctx.ins('', 'JMP', 'B', L('sLoop'));
  ctx.ins('', 'SLT', 'AB', hi('ptr'), ptr);              // in range?
  ctx.ins('', 'JMP', 'B', L('chk'));
  ctx.ins('', 'JMP', 'B', L('sLoop'));
  // Bomb detection: the B cell and its neighbour must both be occupied.
  ctx.ins('chk', 'MOV', 'B', ptr, L('tp'));
  ctx.ins('', 'ADD', 'AB', `#(${idxOf(ctx, 'ptr')}-${idxOf(ctx, 'tp')})`, L('tp'));
  ctx.ins('', 'SNE', 'I', `@${L('tp')}`, L('blank'));    // B cell non-empty? skip the give-up
  ctx.ins('', 'JMP', 'B', L('sLoop'));
  ctx.ins('', 'ADD', 'AB', '#1', L('tp'));
  ctx.ins('', 'SNE', 'I', `@${L('tp')}`, L('blank'));    // neighbour non-empty? skip the give-up
  ctx.ins('', 'JMP', 'B', L('sLoop'));                   // only one cell: a lone bomb -> ignore
  // Commit: aim the clear at the found cell and clear from there.
  ctx.ins('commit', 'MOV', 'B', ptr, cptr);              // cptr.B := found offset
  ctx.ins('', 'ADD', 'AB', `#(${idxOf(ctx, 'ptr')}-${idxOf(ctx, 'cptr')})`, cptr);
  ctx.ins('cLoop', 'MOV', 'I', `@${L('sel')}`, `>${cptr}`);
  ctx.ins('', 'DJN', 'B', L('cStep'), L('tmr'));         // count the writes; at zero, flip
  ctx.ins('', 'MOV', 'AB', `#(${L('dbomb')}-${L('sel')})`, L('sel'));  // sel -> DAT: kill pass
  ctx.ins('cStep', 'SLT', 'AB', lo('cptr'), cptr);       // cptr.B >= span? skip to the far test
  ctx.ins('', 'JMP', 'B', L('cFix'));                    // below span: into the image
  ctx.ins('', 'SLT', 'AB', `#(CORESIZE-${idxOf(ctx, 'cptr')}-1)`, cptr);
  ctx.ins('', 'JMP', 'B', L('cLoop'));                   // in range: carry on
  ctx.ins('cFix', 'MOV', 'AB', `#(${span}-${idxOf(ctx, 'cptr')})`, cptr);  // step past the image
  ctx.ins('', 'JMP', 'B', L('cLoop'));
  // Data.
  ctx.ins('inc', 'DAT', 'F', `#${P.STEP}`, `#${P.STEP}`);
  ctx.ins('ptr', 'DAT', 'F', `#(${span}-${idxOf(ctx, 'ptr')}-${P.STEP})`, `#(${span}-${idxOf(ctx, 'ptr')}+${P.GAP}-${P.STEP})`);
  ctx.ins('tp', 'DAT', 'F', '#0', '#0');
  ctx.ins('cptr', 'DAT', 'F', '#0', '#0');
  ctx.ins('tmr', 'DAT', 'F', '#0', `#${P.TIME}`);
  ctx.ins('sel', 'DAT', 'F', '#0', `#(${L('sbomb')}-${L('sel')})`);  // points at the SPL first
  ctx.ins('sbomb', 'SPL', 'B', '#0', '#0');
  ctx.ins('dbomb', 'DAT', 'F', '#0', '#0');
  ctx.ins('blank', 'DAT', 'F', '$0', '$0');
}

const cobLook = (api, k) => mod(api.at('ptr') + api.code('ptr').b + k * api.P.STEP, api.core);
// Planted body: the B cell of a found pair, with a non-empty neighbour, so the
// bomb-detection commits. Room after it for the clear to get going cleanly.
function cobTarget(api) {
  let found = 0;
  for (let k = 1; k < 5000; k++) {
    const c = cobLook(api, k);
    let clear = true;
    for (let j = -4; j <= 8 && clear; j++) if (api.inImage(c + j)) clear = false;
    if (clear && ++found === 3) return c;
  }
  return -1;
}

function watchCobra(api) {
  const { vm, core } = api, cptr = api.at('cptr'), sel = api.at('sel');
  const planted = api.scenario === 'oneshot-cobra: planted target';
  const target = planted ? cobTarget(api) : -1;
  const killed = new Int32Array(core).fill(-1);
  let looks = 0, writes = 0, dat = 0, committed = null, hitBody = false;
  return {
    before(pc) {
      if (pc === api.at('sLook')) looks++;
      if (pc === api.at('commit')) committed = vm.cycle;
      if (pc !== api.at('cLoop')) return null;
      return { t: mod(cptr + vm.peek(cptr).b, core), bomb: vm.peek(sel + vm.peek(sel).b) };
    },
    after(tok) {
      if (!tok) return;
      if (api.inSelf(tok.t)) throw new Error('oneshot-cobra cleared its own code');
      if (!api.same(vm.peek(tok.t), tok.bomb) || vm.writerPc[tok.t] !== api.at('cLoop')) throw new Error('oneshot-cobra wrote something other than its bomb');
      writes++;
      if (tok.bomb.op === 'DAT') { killed[tok.t] = vm.cycle; dat++; }
      if (tok.t === target || tok.t === mod(target + 1, core)) hitBody = true;
    },
    final() {
      // The commit, the clear of the body and the SPL->DAT flip are checked on
      // the clean solo-planted run (cobra the whole warrior); in a combination
      // a partner's bombs may cut the clear short, so there only the contract
      // above (never clears itself, every write is its bomb) is required.
      const whole = api.self.size === api.total;
      if (planted && whole) {
        if (committed === null) throw new Error('oneshot-cobra did not commit to the planted body');
        if (!hitBody) throw new Error('oneshot-cobra did not clear the found body');
        if (!dat) throw new Error('oneshot-cobra never reached its DAT kill pass');
      }
      if (api.alone) {
        if (looks < 1000) throw new Error('oneshot-cobra looked at too few cells');
        if (committed !== null) throw new Error('oneshot-cobra committed on an empty core');
      }
    },
  };
}

// ---------------------------------------------------------------------------

const blocks = {
  'scanner-pendulum': {
    ...BODY, processes: 1, writes: 'sparse',
    purpose: 'Pendulum engine: a scanner that wipes forward with SPL from a find until the first empty cell (wipe-until-empty), counts the times the scan comes round onto its own code, and after TIME such self-finds flips the wipe bomb to DAT, turning the scan-and-wipe loop into a core clear.',
    params: { STEP: [1, 27719], TIME: [1, 400], ROOM: [100, 4000] },
    entry: 'sLoop', loop: 'sLoop',
    provides: { splBomb: 'bomb', datBomb: 'dbomb' },
    mutable: [['ptr', ['a', 'b']], ['wp', ['b']], ['cnt', ['b']], ['bomb', ['op', 'mod']]],
    mismatches: (P, s) => (P.ROOM >= Math.floor(s.coreSize / 2) ? ['ROOM leaves no room for the scan past the warrior'] : []),
    emit: emitPendulum,
    plant: (api) => { const c = penTarget(api); return [[c, MARKER], [mod(c + 1, api.core), MARKER]]; },
    watch: watchPendulum,
  },
  'oneshot-cobra': {
    ...BODY, processes: 1, writes: 'sparse',
    purpose: 'King Cobra oneshot: scans a pair and commits only when a find has two adjacent occupied cells (a body, not a lone bomb), then runs a forward clear from the scan pointer whose DJN counter flips its bomb from SPL (stun pass) to DAT (kill pass) after TIME writes, stepping over its own image on each wrap.',
    params: { STEP: [1, 27719], GAP: [1, 64], TIME: [100, 20000], ROOM: [100, 4000] },
    entry: 'sLoop', loop: 'sLoop',
    provides: { splBomb: 'sbomb', datBomb: 'dbomb' },
    mutable: [['ptr', ['a', 'b']], ['tp', ['b']], ['cptr', ['b']], ['tmr', ['b']], ['sel', ['b']]],
    mismatches: (P, s) => (P.ROOM >= Math.floor(s.coreSize / 2) ? ['ROOM leaves no room for the scan past the warrior'] : []),
    emit: emitCobra,
    plant: (api) => { const c = cobTarget(api); return [[c, MARKER], [mod(c + 1, api.core), MARKER]]; },
    watch: watchCobra,
  },
};
for (const [id, b] of Object.entries(blocks)) b.id = id;
// Defaults that work on the 8,000 and 55,440 cores. STEP 17 is Pendulum's own
// step; it is coprime with both cores, so a lap reaches every cell.
blocks['scanner-pendulum'].defaults = { STEP: 17, TIME: 18, ROOM: 400 };
blocks['oneshot-cobra'].defaults = { STEP: 19, GAP: 10, TIME: 8000, ROOM: 400 };

export default Object.values(blocks);
