// Timed stone endings (docs/hill-recipe-book.md, the paper/stone and stone/imp
// chapters; gap #5). Everything here is written from scratch; hill warriors are
// studied, never copied. Ring, ICWS'94 only.
//
// The top paper/stones (Azathoth, Hullabaloo, Numb) and stone/imps (Quicksilver,
// Candy II, Nightstalker) do not run their stone forever. The stone bombs for a
// fixed number of passes, and then one of two things happens to the loop:
//   (a) the trail writes onto the stone's own pointer and the bombing stops; the
//       SPL #0 feeder becomes a process sink (paper/stone self-off), or
//   (b) the stone's `dat X, >1` bomb lands on its own ADD, so the three cells
//       that survive -- SPL #0 / MOV / DAT >1 -- become a one-cell-per-process
//       core clear with no extra code (stone/imp wreck-becomes-clear).
//
// `hill-stone` (tools/algebra/blocks/hillstone.js) is the layout-safe hill
// bomber with a counted, ~7-line re-arming ENDCLEAR. This block is the
// alternative those families actually use: a short bomber whose ending is the
// hill's own free-form wreck -- the 3-cell one-cell clear (END 1), or the
// process sink (END 0) -- reached after a counted number of passes.
//
// On an 8,000-cell core a bomber that reaches >= 100 cells has gcd(STEP, core)
// <= 80, so (as with hill-stone) a single warrior that is strictly layout-safe
// to 100 cells cannot exist here. The hill stones use coprime steps and survive
// their own stray bombs only because a paper repairs them; that cannot pass a
// solo gate. So this block is layout-safe in the same, weaker sense every stone
// in stones.js is: its bomb residue class meets none of its OWN loop or ending
// cells (gcd(STEP, core) is kept larger than the block), so it never stops
// itself before its planned conversion. The bombing phase runs one process (a
// shared counter across SPL-fed processes cannot time the conversion cleanly),
// and only the ending's SPL #0 grows the process table.

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const mod = (x, n) => ((x % n) + n) % n;

const timedStone = {
  id: 'timed-stone', kind: 'body', exit: 'never', writes: 'sparse', roams: false,
  grows: true, processes: 8, dialects: '94',
  purpose: 'A short bomber that drops a DAT every STEP cells for TIME passes, then converts its loop into the hill wreck: END 1 a 3-cell one-cell-per-process core clear (SPL #0 / MOV / DAT >1, the pointer carried by the DAT\'s postincrement), END 0 a process sink (the paper/stone self-off). One bombing process; the ending\'s SPL #0 grows the table.',
  params: { STEP: [1, 4000], TIME: [100, 4000], END: [0, 1] },
  defaults: { STEP: 2920, TIME: 400, END: 1 },
  entry: 'tsLoop', loop: 'tsLoop',
  provides: { datBomb: 'tsBomb' },
  mutable: [['tsPtr', ['b']], ['tsCnt', ['b']], ['tsCPtr', ['b']]],
  mismatches(P, settings) {
    const core = settings.coreSize, g = gcd(P.STEP, core), out = [];
    if (core / g < 100) out.push(`timed-stone: STEP ${P.STEP} reaches only ${Math.floor(core / g)} cells of the core`);
    // The bomb class must clear the whole block (about 12 cells): gcd larger than it
    // leaves an empty residue class past the block's end to aim the first bomb at.
    if (g < 16) out.push(`timed-stone: gcd(STEP, core) = ${g} is too small to keep the bomb class off the block's own cells`);
    return out;
  },
  emit(ctx) {
    const { L, P, core, total } = ctx;
    // Bombing loop (single process): write, advance, count down TIME, then jump
    // to the ending. The DJN's counter is the pass counter.
    ctx.ins('tsLoop', 'MOV', 'I', L('tsBomb'), `@${L('tsPtr')}`);
    ctx.ins('tsArm', 'ADD', 'AB', `#${P.STEP}`, L('tsPtr'));
    ctx.ins('tsBack', 'DJN', 'B', L('tsLoop'), L('tsCnt'));
    ctx.ins('tsGo', 'JMP', 'B', L(P.END ? 'tsCFeed' : 'tsSFeed'));
    // The pointer: its B advances by STEP each pass. The first bomb lands at
    // `total`, just past the whole warrior, on a residue class empty of the block.
    const pidx = ctx.pc();
    ctx.ins('tsPtr', 'DAT', 'F', '#0', `#${mod(total - pidx, core)}`);
    ctx.ins('tsCnt', 'DAT', 'F', '#0', `#${P.TIME}`);
    ctx.ins('tsBomb', 'DAT', 'F', '#0', '#0');
    if (P.END) {
      // The wreck: SPL #0 feeds processes through one MOV into the DAT, whose
      // postincrement (>1 -> the next cell, tsCPtr) walks the clear pointer one
      // cell per process death. The clear starts at `total` and sweeps forward.
      ctx.ins('tsCFeed', 'SPL', 'B', '#0', '0');
      ctx.ins('tsCMov', 'MOV', 'I', L('tsCBomb'), `@${L('tsCPtr')}`);
      ctx.ins('tsCBomb', 'DAT', 'F', '#0', '>1');
      const cpidx = ctx.pc();
      ctx.ins('tsCPtr', 'DAT', 'F', '#0', `#${mod(total - cpidx, core)}`);
    } else {
      // The sink: SPL #0 keeps spawning processes that die on the DAT. No writes.
      ctx.ins('tsSFeed', 'SPL', 'B', '#0', '0');
      ctx.ins('tsSink', 'DAT', 'F', '#0', '#0');
    }
  },
  watch(api) {
    const { P } = api;
    const loopAt = api.at('tsLoop'), ptrAt = api.at('tsPtr');
    const cmovAt = P.END ? api.at('tsCMov') : -1, cptrAt = P.END ? api.at('tsCPtr') : -1;
    const feedAt = api.at(P.END ? 'tsCFeed' : 'tsSFeed');
    let bombs = 0, converted = false, lastClear = null;
    const clearCells = new Set();
    return {
      before(pc) {
        if (pc === loopAt && api.same(api.vm.peek(pc), api.code('tsLoop'))) return { kind: 'stone', t: api.norm(ptrAt + api.vm.peek(ptrAt).b) };
        if (pc === cmovAt && api.same(api.vm.peek(pc), api.code('tsCMov'))) return { kind: 'clear', t: api.norm(cptrAt + api.vm.peek(cptrAt).b) };
        if (pc === feedAt) converted = true;    // the ending has been entered
        return null;
      },
      after(tok) {
        if (!tok) return;
        if (tok.kind === 'stone') {
          if (api.inSelf(tok.t)) throw new Error('timed-stone bombed its own code');
          if (converted) throw new Error('timed-stone kept bombing after it converted');
          if (bombs === 0 && api.inImage(tok.t)) throw new Error("timed-stone's first bomb landed inside the warrior");
          bombs++;
        } else {
          if (api.inSelf(tok.t)) throw new Error("timed-stone's clear wrote its own code");
          if (lastClear !== null && tok.t !== api.norm(lastClear + 1)) throw new Error('timed-stone\'s one-cell clear did not advance exactly one cell');
          lastClear = tok.t;
          clearCells.add(tok.t);
        }
      },
      final() {
        if (!api.alone) return;
        if (bombs !== P.TIME) throw new Error(`timed-stone made ${bombs} bombs, not TIME = ${P.TIME}`);
        if (!converted) throw new Error('timed-stone never converted to its ending');
        if (P.END && clearCells.size < 100) throw new Error(`timed-stone's one-cell clear swept too few cells (${clearCells.size})`);
      },
    };
  },
};

export default [timedStone];
