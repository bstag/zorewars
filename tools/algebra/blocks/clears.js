// Clears and capture: three finishers (a d-clear, a two-pass clear, a gated
// clear) and a vampire whose pit is a trap. How to write a block:
// docs/block-algebra.md. All three clears count their passes, spare their own
// code, need nothing from the image (so relocate can move them) and write '88
// code when ctx.old. Each provides a DAT and an SPL cell, so the openings that
// bomb (opening-bomber, opening-bscan) can run in front of them.
import { VM } from '../../../src/engine/index.js';

const FINISHER = { kind: 'finisher', exit: 'never', processes: 1, writes: 'core', relocatable: true, protects: 'self' };
const splBomb = (ctx, label) => (ctx.old ? ctx.ins(label, 'SPL', 'B', '0', '0') : ctx.ins(label, 'SPL', 'B', '#0', '#0'));
// Cells outside the block: the size is measured from the first label to one past the last.
const outside = (ctx, first, last) => `(CORESIZE-(${ctx.L(last)}+1-${ctx.L(first)}))`;

// What every clear here promises, checked while it runs: each bomb write lands
// outside its own code, is the bomb it should be, and was made by the writer;
// its code is intact at the end (pointers and counters aside); and, when it ran
// as the only process with time for a full pass, every cell outside it was
// DAT-bombed after it was entered. `writers` maps a writing instruction to its
// bomb and pointer: `<ptr` (predecrement), as every clear here uses.
function clearWatch(api, { writers, mutable, first, last, cyclesPerCell, onWrite, onFinal }) {
  const { vm, core } = api;
  const byPc = new Map(Object.entries(writers).map(([label, w]) => [api.at(label), { ...w, ptrAt: api.at(w.ptr) }]));
  const loose = new Set(mutable.map((l) => api.at(l)));
  const killed = new Int32Array(core).fill(-1);
  const st = { entered: null, sole: false, spl: 0, dat: 0, killed };
  return {
    st,
    before(pc) {
      if (st.entered === null && pc === api.entry()) {
        st.entered = vm.cycle;
        st.sole = api.scenario === 'alone' && vm.processes(0).length === 1;
      }
      const w = st.entered === null ? null : byPc.get(pc);
      if (!w) return null;
      return { pc, w, t: api.norm(w.ptrAt + vm.peek(w.ptrAt).b - 1) };
    },
    after(tok) {
      if (!tok) return;
      if (api.inSelf(tok.t)) throw new Error('The clear wrote over its own code');
      if (vm.peek(tok.t).op !== tok.w.op || vm.writerPc[tok.t] !== tok.pc) throw new Error('A clear write broke its contract');
      if (tok.w.op === 'DAT') { killed[tok.t] = vm.cycle; st.dat++; } else st.spl++;
      onWrite?.(tok, st);
    },
    final() {
      if (st.entered === null) return;
      const from = api.at(first), n = api.norm(api.at(last) - from) + 1;
      for (let k = 0; k < n; k++) {
        const x = api.code(first, k), y = vm.peek(from + k);
        const ok = loose.has(api.norm(from + k)) ? ['op', 'mod', 'aMode', 'bMode'].every((f) => x[f] === y[f]) : api.same(x, y);
        if (!ok) throw new Error('The clear damaged its own code');
      }
      if (st.sole && vm.cycle - st.entered >= cyclesPerCell * core) {
        for (let c = 0; c < core; c++) if (!api.inSelf(c) && killed[c] < st.entered) throw new Error('The clear left cells untouched');
      }
      onFinal?.(st);
    },
  };
}

const finishers = {
  // Two streams in one loop: an SPL stream GAP cells ahead of a DAT stream, both
  // walking backward from the block. Stunned processes split in place until the
  // DAT stream catches them. The SPL stream stops GAP cells early, so a pass
  // never reaches the block's far end; the DAT stream finishes alone.
  'finisher-dclear': {
    ...FINISHER,
    purpose: 'A d-clear: an SPL stream GAP cells ahead of a DAT stream, both walking backward over everything but itself, pass after pass.',
    params: { GAP: [1, 4000] }, entry: 'payload',
    provides: { datBomb: 'dbomb', splBomb: 'sbomb' },
    mutable: [['sptr', ['b']], ['dptr', ['b']], ['cnt', ['b']]],
    emit(ctx) {
      const { L, P } = ctx, n = outside(ctx, 'payload', 'dbomb');
      ctx.ins('payload', 'MOV', 'AB', `#(${L('payload')}-${L('sptr')}-${P.GAP})`, L('sptr'));
      ctx.ins(null, 'MOV', 'AB', `#(${L('payload')}-${L('dptr')})`, L('dptr'));
      ctx.ins(null, 'MOV', 'AB', `#(${n}-${P.GAP})`, L('cnt'));
      ctx.ins('both', 'MOV', 'I', L('sbomb'), `<${L('sptr')}`);
      ctx.ins('both2', 'MOV', 'I', L('dbomb'), `<${L('dptr')}`);
      ctx.ins(null, 'DJN', 'B', L('both'), L('cnt'));
      ctx.ins(null, 'MOV', 'AB', `#${P.GAP}`, L('cnt'));
      ctx.ins('tail', 'MOV', 'I', L('dbomb'), `<${L('dptr')}`);
      ctx.ins(null, 'DJN', 'B', L('tail'), L('cnt'));
      ctx.ins(null, 'JMP', 'B', L('payload'));
      ctx.ins('sptr', 'DAT', 'F', '#0', '#0');
      ctx.ins('dptr', 'DAT', 'F', '#0', '#0');
      ctx.ins('cnt', 'DAT', 'F', '#0', '#0');
      splBomb(ctx, 'sbomb');
      ctx.ins('dbomb', 'DAT', 'F', '#0', '#0');
    },
    watch(api) {
      const gap = api.P.GAP, n = api.core - (api.norm(api.at('dbomb') - api.at('payload')) + 1);
      let lead = null;                 // the SPL stream must stay GAP cells ahead of the DAT stream
      return clearWatch(api, {
        writers: { both: { op: 'SPL', ptr: 'sptr' }, both2: { op: 'DAT', ptr: 'dptr' }, tail: { op: 'DAT', ptr: 'dptr' } },
        mutable: ['sptr', 'dptr', 'cnt'], first: 'payload', last: 'dbomb', cyclesPerCell: 4,
        onWrite(tok) {
          if (tok.w.op === 'SPL') lead = tok.t;
          else if (tok.pc === api.at('both2') && lead !== null && api.norm(tok.t - lead) !== gap) throw new Error('The SPL stream is not GAP cells ahead of the DAT stream');
        },
        onFinal(st) { if (st.sole && st.spl < n - gap) throw new Error('The d-clear stunned too few cells'); },
      });
    },
  },

  // A whole pass of SPL, then a whole pass of DAT, both backward from the block;
  // RESTUN 1 stuns again before every kill pass, 0 only before the first.
  'finisher-twopass': {
    ...FINISHER,
    purpose: 'Sweeps everything but itself with SPL (stun), then with DAT (kill); RESTUN 1 repeats both passes, 0 repeats the kill pass only.',
    params: { RESTUN: [0, 1] }, entry: 'payload',
    provides: { datBomb: 'dbomb', splBomb: 'sbomb' },
    mutable: [['ptr', ['b']], ['cnt', ['b']]],
    emit(ctx) {
      const { L, P } = ctx, n = outside(ctx, 'payload', 'dbomb'), first = `#(${L('payload')}-${L('ptr')})`;
      ctx.ins('payload', 'MOV', 'AB', first, L('ptr'));
      ctx.ins(null, 'MOV', 'AB', `#${n}`, L('cnt'));
      ctx.ins('stun', 'MOV', 'I', L('sbomb'), `<${L('ptr')}`);
      ctx.ins(null, 'DJN', 'B', L('stun'), L('cnt'));
      ctx.ins('again', 'MOV', 'AB', first, L('ptr'));
      ctx.ins(null, 'MOV', 'AB', `#${n}`, L('cnt'));
      ctx.ins('kill', 'MOV', 'I', L('dbomb'), `<${L('ptr')}`);
      ctx.ins(null, 'DJN', 'B', L('kill'), L('cnt'));
      ctx.ins(null, 'JMP', 'B', L(P.RESTUN ? 'payload' : 'again'));
      ctx.ins('ptr', 'DAT', 'F', '#0', '#0');
      ctx.ins('cnt', 'DAT', 'F', '#0', '#0');
      splBomb(ctx, 'sbomb');
      ctx.ins('dbomb', 'DAT', 'F', '#0', '#0');
    },
    watch(api) {
      const n = api.core - (api.norm(api.at('dbomb') - api.at('payload')) + 1);
      let passes = 0, turned = false;
      return clearWatch(api, {
        writers: { stun: { op: 'SPL', ptr: 'ptr' }, kill: { op: 'DAT', ptr: 'ptr' } },
        mutable: ['ptr', 'cnt'], first: 'payload', last: 'dbomb', cyclesPerCell: 5,
        onWrite(tok, st) {
          if (tok.w.op !== 'DAT' || turned) return;
          // The first kill: the stun pass must have covered every cell outside the block.
          turned = true;
          if (st.spl !== n) throw new Error('The stun pass did not cover the core');
          if (st.sole) for (let c = 0; c < api.core; c++) {
            if (!api.inSelf(c) && c !== tok.t && api.vm.peek(c).op !== 'SPL') throw new Error('A cell missed the stun pass');
          }
        },
        onFinal(st) {
          passes = Math.floor(st.spl / n);
          // Restunning: stun passes keep pace with kill passes; otherwise one stun pass only.
          if (st.sole && st.dat >= 2 * n && (api.P.RESTUN ? passes < Math.floor(st.dat / n) : passes !== 1)) throw new Error('The stun passes do not follow RESTUN');
        },
      });
    },
  },

  // A counted clear behind a decrement gate. The gate is the first cell (a JMP
  // into the code, run once) and its B-field is the clear's counter, so every
  // lap of the two-instruction loop decrements it: an imp that writes itself
  // there finds its B-field decremented and walks into the DAT guard behind it.
  // An imp's copy also shortens or lengthens the count; a pass that overshoots
  // reaches the pointer first (the top cell), and the bomb (B = 1) written there
  // pins the pointer to itself until the count runs out.
  'finisher-gated': {
    ...FINISHER,
    purpose: 'A counted DAT clear walking backward, behind a decrement gate: the counter lives in the cell in front of the code, so imps that reach it are broken and die on the guard behind it.',
    params: {}, entry: 'gate',
    provides: { datBomb: 'dbomb', splBomb: 'sbomb' },
    mutable: [['gate', ['b']], ['ptr', ['b']]],
    emit(ctx) {
      const { L } = ctx;
      ctx.ins('gate', 'JMP', 'B', L('payload'), '0');
      ctx.ins('guard', 'DAT', 'F', '#0', '#0');
      ctx.ins('payload', 'MOV', 'AB', `#(${L('gate')}-${L('ptr')})`, L('ptr'));
      ctx.ins(null, 'MOV', 'AB', `#${outside(ctx, 'gate', 'ptr')}`, L('gate'));
      ctx.ins('kill', 'MOV', 'I', L('dbomb'), `<${L('ptr')}`);
      ctx.ins('tick', 'DJN', 'B', L('kill'), L('gate'));
      ctx.ins(null, 'JMP', 'B', L('payload'));
      splBomb(ctx, 'sbomb');
      ctx.ins('dbomb', 'DAT', 'F', '#0', '#1');
      ctx.ins('ptr', 'DAT', 'F', '#0', '#0');
    },
    watch(api) {
      const gate = api.at('gate'), tick = api.at('tick');
      let ticks = 0, lastTick = null;
      const w = clearWatch(api, {
        writers: { kill: { op: 'DAT', ptr: 'ptr' } },
        mutable: ['gate', 'ptr'], first: 'gate', last: 'ptr', cyclesPerCell: 3,
        onFinal(st) {
          // While it clears, the gate is decremented on every lap of the loop.
          if (st.sole && ticks < st.dat - 1) throw new Error('The gate was not decremented on every lap');
        },
      });
      return {
        before(pc) {
          const tok = w.before(pc);
          return pc === tick && w.st.entered !== null ? { tok, gateB: api.vm.peek(gate).b } : { tok };
        },
        after(x) {
          w.after(x.tok);
          if (x.gateB === undefined) return;
          if (api.vm.peek(gate).b !== api.norm(x.gateB - 1)) throw new Error('The gate was not decremented');
          if (w.st.sole && lastTick !== null && api.vm.cycle - lastTick > 6) throw new Error('The gate went undecremented');
          ticks++; lastTick = api.vm.cycle;
        },
        final: () => w.final(),
      };
    },
  },
};

// The vampire's trap. Fangs (JMPs aimed at the pit) are dropped VSTEP apart,
// skipping the whole image. The pit is the block's last cell: a JMP into a
// three-cell loop, and its B-field is the prisoners' clear pointer. In the loop
// each prisoner splits (SPL 0: the prisoners multiply until their table is
// full; a full table drops the new copy, so the loop always moves on) and drops
// a DAT backward from the cell before the block, down to the pit. The pointer
// reaches the pit last: that DAT closes the pit, and the next four land on the
// bomb and the loop's cells from the top down, the last on the MOV itself, so the
// clear is bounded however many prisoners run it at once, and they all die.
const bodies = {
  'vampire-trap': {
    kind: 'body', exit: 'never', processes: 1, writes: 'sparse', roams: false, entryFirst: false,
    purpose: 'Drops JMP fangs VSTEP apart (never on its own image) aimed at a pit where prisoners multiply, clear the core for it and finally die.',
    params: { VSTEP: [1, 4000] }, entry: 'vStart', loop: 'vStart',
    mutable: [['vFang', ['a', 'b']]],
    emit(ctx) {
      const { L, P } = ctx, o = ctx.pc(), size = `(${L('vPit')}+1-${L('vFang')})`;
      // A + B stays the distance from the fang to the pit; the first fang lands just past the pit.
      ctx.ins('vFang', 'JMP', 'B', `${P.VSTEP - 1}`, `${size}-${P.VSTEP}`);
      ctx.ins('vStep', 'DAT', 'F', `#${-P.VSTEP}`, `#${P.VSTEP}`);
      ctx.ins('vStart', 'ADD', 'F', L('vStep'), L('vFang'));
      ctx.ins(null, 'SLT', 'AB', `#${ctx.total - 1 - o}`, L('vFang'));     // past the image's end?
      ctx.ins(null, 'JMP', 'B', L('vStart'));
      ctx.ins(null, 'SLT', 'AB', `#${ctx.core - o - 1}`, L('vFang'));     // before its start?
      ctx.ins('vMov', 'MOV', 'I', L('vFang'), `@${L('vFang')}`);
      ctx.ins(null, 'JMP', 'B', L('vStart'));
      ctx.ins('pMov', 'MOV', 'I', L('pBomb'), `<${L('vPit')}`);
      ctx.ins('pSpl', 'SPL', 'B', '0', '0');
      ctx.ins('pJmp', 'JMP', 'B', L('pMov'));
      ctx.ins('pBomb', 'DAT', 'F', '#0', '#0');
      ctx.ins('vPit', 'JMP', 'B', L('pSpl'), `#(CORESIZE-${size}+1)`);
    },
    watch(api) {
      let fangs = 0;
      const { vm } = api, fang = api.at('vFang'), pit = api.at('vPit');
      const intact = () => { const x = vm.peek(fang); return x.op === 'JMP' && api.norm(fang + x.a + x.b) === pit; };
      return {
        // Checked while the fang template is intact (a partner's bomb may hit it).
        before: (pc) => (pc === api.at('vMov') && intact() ? api.norm(fang + vm.peek(fang).b) : null),
        after(t) {
          if (t === null) return;
          if (api.inSelf(t)) throw new Error('A fang landed on the vampire');
          if (api.inImage(t)) return;
          const x = vm.peek(t);
          if (x.op !== 'JMP' || api.norm(t + x.a) !== pit) throw new Error('A fang does not lead to the pit');
          fangs++;
        },
        final() {
          if (!api.alone) return;
          if (fangs < 100) throw new Error('The vampire drops too few fangs');
          trapDuel(api);
        },
      };
    },
  },
};

// The trap at work: the block alone in a fresh core, against an opponent whose
// only instruction is a fang. Its process must fall into the pit, multiply,
// clear the core and die, and the vampire's code outside the pit must survive.
function trapDuel(api) {
  const { core, settings } = api, start = api.at('vFang'), n = api.norm(api.at('vPit') - start) + 1;
  const mine = Array.from({ length: n }, (_, k) => api.code('vFang', k));
  const at = (l) => api.norm(api.at(l) - start);
  const X = Math.floor(core / 2);
  const victim = { op: 'JMP', mod: 'B', aMode: '$', a: api.norm(at('vPit') - X), bMode: '$', b: 0 };
  const vm = new VM(settings);
  vm.load([{ name: 'trap', instructions: mine, start: at('vStart') }, { name: 'victim', instructions: [victim], start: 0 }], { positions: [0, X] });
  const pMov = at('pMov');
  let hit = false;
  while (!vm.done) { vm.step(); if (vm.writerPc[X] === pMov) hit = true; }
  const [us, them] = vm.warriors;
  if (!us.alive || them.alive) throw new Error('The pit did not kill its prisoner');
  if (them.peak < 2) throw new Error('Prisoners did not multiply in the pit');
  if (!hit) throw new Error("The prisoners' clear missed the opponent's code");
  for (let k = 0; k < pMov; k++) if (k !== at('vFang') && !api.same(vm.peek(k), mine[k])) throw new Error("The prisoners' clear hit the vampire");
}

const leaves = { ...finishers, ...bodies };
for (const [id, b] of Object.entries(leaves)) {
  b.id = id;
  b.defaults ??= Object.fromEntries(Object.entries(b.params).map(([k, [lo]]) => [k, lo]));
}
Object.assign(leaves['finisher-dclear'].defaults, { GAP: 12 });
Object.assign(leaves['finisher-twopass'].defaults, { RESTUN: 1 });
Object.assign(leaves['vampire-trap'].defaults, { VSTEP: 7 });

export default Object.values(leaves);
