// silk-tail-88: the straight-line '88 paper of the Koenigstuhl '88 hill
// (docs/hill-top30/88.md: seven of its nine papers have this shape). The
// mechanism is studied from the hill; the Redcode, layout and constants here
// are written from scratch.
//
// A fan makes LEN processes, LEN being the length of the body, and they run
// the body in lockstep. The body does not loop:
//
//   k0   MOV <LEN, <k1       stage 1: every process copies one cell ...
//   k1   SPL @0, dst         ... and then starts a process in the copy
//   k2   MOV <LEN, <k3       stage 2, the same two lines
//   k3   SPL @0, dst
//   ...                      (STAGES of them)
//   tail
//
// A stage's source counter is the empty cell LEN cells after its MOV: LEN
// processes count it down from 0 to -LEN, so they copy the LEN cells from the
// MOV on. Its destination is the SPL's own B-field, which ends on the first
// cell of the copy, so SPL @0 starts a process there. Stage j therefore copies
// a window that starts 2j cells into the body: a copy made by a later stage
// begins with that stage and carries the cells after the body in place of the
// earlier ones. Every copy runs what it holds, then its tail. Because the
// counters are the cells after the body, the block must be last in the image.
//
// TAIL 0, a small clear:
//   tMov  MOV 0, <tDjn       lay this instruction downward, from GAP below
//   tDjn  DJN tMov, #-GAP    (both lines count the same field down)
// With LEN processes it wipes LEN cells in a row, skips LEN, and so on.
//
// TAIL 1, an imp tail (LEN is at least the three points of the ring):
//   tSpl  SPL 0
//   tAdd  ADD #S, tJmp       S = modInverse(3, core)
//   tJmp  JMP @0, tImp-S*LEN
//   tImp  MOV 0, S
// The LEN processes on the SPL send LEN children a pass down the two lines;
// each ADD precedes one JMP, so the launches land on tImp, tImp+S, tImp+2S ...
// and each imp writes the next one's cell just before it runs: a 3-point ring
// that needs no seed but the one template.
//
// TAIL 2, a resin tail (Permafrost's paper ends this way; resin88.js says what
// a resin trail is and how it kills):
//   tSpl  SPL 0
//   tLay  MOV tDrop, <tDrop    lay the drop line, a cell lower each time
//   tDrop MOV <0, <TRAIL       the drop
//   tBack DJN tSpl, <stream    back to the SPL: the group doubles as it goes
// With LEN processes in step it lays a drop on every other cell, downward from
// TRAIL cells above the drop line.
import { modInverse } from '../util.js';

const ID = 'silk-tail-88';
const mod = (x, n) => ((x % n) + n) % n;

// How to make n processes from one: 'D' is SPL 1, 'M' is MOV -1, 0 (n -> 2n-1).
function fanOps(n) {
  const ops = [];
  while (n > 1) { if (n % 2) { ops.unshift('M'); n = (n + 1) / 2; } else { ops.unshift('D'); n /= 2; } }
  return ops;
}

function geom(P) {
  const tail = P.TAIL === 2 ? ['tSpl', 'tLay', 'tDrop', 'tBack'] : P.TAIL ? ['tSpl', 'tAdd', 'tJmp', 'tImp'] : ['tMov', 'tDjn'];
  const LEN = 2 * P.STAGES + tail.length;
  const steps = [P.STEP1, P.STEP2, P.STEP3].slice(0, P.STAGES);
  // Everything a copy touches: its LEN cells and the counters after them.
  return { tail, LEN, steps, fan: fanOps(LEN), reach: LEN + 2 * P.STAGES };
}

const silkTail = {
  id: ID, kind: 'body', exit: 'never', processes: 1, grows: true,
  writes: 'sparse', roams: true, layout: 'last', entry: 'fGo',
  purpose: "ICWS'88 straight-line paper: a fan makes as many processes as the body has cells, and they run STAGES two-line stages (MOV <count, <dst / SPL @0, dst), each laying a copy STEPn cells on and starting it, then fall into a tail: TAIL 0 a two-line MOV 0, <1 / DJN clear from GAP cells below, TAIL 1 a three-line imp pump that builds a 3-point ring from one template, TAIL 2 a four-line resin (a trail of MOV <0, <p drops from TRAIL cells above it).",
  params: { STAGES: [2, 3], TAIL: [0, 2], STEP1: [200, 54000], STEP2: [200, 54000], STEP3: [200, 54000], GAP: [20, 4000], TRAIL: [200, 54000] },
  defaults: { STAGES: 3, TAIL: 0, STEP1: 3364, STEP2: 1120, STEP3: 6160, GAP: 120, TRAIL: 7450 },
  mutable: (P) => [...Array.from({ length: P.STAGES }, (_, j) => [`k${2 * j + 1}`, ['b']]), ...(P.TAIL === 2 ? [['tDrop', ['b']], ['tBack', ['b']]] : P.TAIL ? [['tJmp', ['b']]] : [['tDjn', ['b']]])],
  knowledge: {
    parameterRoles: {
      STAGES: 'Copy stages a generation runs before its tail.', TAIL: '0: the small clear. 1: the imp tail. 2: the resin tail.', TRAIL: 'TAIL 2: where the trail starts, from the drop line (a value near the core size starts it below the copy).',
      STEP1: 'Where stage 1 lays its copy, from the body.', STEP2: 'The same for stage 2, from its own first line.', STEP3: 'The same for stage 3.',
      GAP: 'TAIL 0: how far below the clear its wipe starts.',
    },
    tuning: ['A copy made by stage n starts with stage n, so it runs STAGES-n+1 stages. Each generation lands LEN-1 cells short of the last, so the copies drift apart instead of piling up.', 'The body is 2*STAGES+2 cells with the clear and 2*STAGES+4 with the imp tail; the fan adds three or four lines that are not copied.'],
    failures: ['It must be the last block in the image: the cells after the body are its counters.', 'The clear lays MOV 0, <1 instructions, not DATs, and wipes its own older copies as readily as anything else.'],
    evidence: ['docs/hill-top30/88.md'],
  },
  mismatches(P, settings) {
    const core = settings.coreSize, room = settings.maxLength, out = [], G = geom(P);
    const far = (d) => mod(d, core) >= room + G.reach && mod(d, core) <= core - room - G.reach;
    G.steps.forEach((s, j) => { if (!far(s)) out.push(`${ID}: STEP${j + 1} lays its copy on the warrior`); });
    for (let i = 0; i < G.steps.length; i++) for (let j = i + 1; j < G.steps.length; j++) {
      const d = mod((2 * j + G.steps[j]) - (2 * i + G.steps[i]), core);
      if (d < G.reach || d > core - G.reach) out.push(`${ID}: the copies of stages ${i + 1} and ${j + 1} overlap`);
    }
    if (P.TAIL === 2) {
      if (mod(P.TRAIL, core) < room + G.reach || mod(P.TRAIL, core) > core - room - G.reach) out.push(`${ID}: TRAIL starts the resin trail on the warrior`);
    } else if (P.TAIL) {
      const S = modInverse(3, core);
      if (!S) out.push(`${ID}: no 3-point imp ring on a ${core}-cell core (TAIL 1)`);
      else G.steps.forEach((s, j) => { for (let a = 0; a < 3; a++) { const d = mod(2 * j + s - (G.LEN - 1) - a * S, core); if (d < 400 || d > core - G.reach) out.push(`${ID}: the copy of stage ${j + 1} lies in the path of its parent's imps`); } });
    } else if (P.GAP < room) out.push(`${ID}: GAP ${P.GAP} starts the clear inside the warrior`);
    if (settings.maxProcesses < 4 * G.LEN) out.push(`${ID}: ${settings.maxProcesses} processes are too few for a ${G.LEN}-process group and its copies`);
    return [...new Set(out)];
  },
  linked(P, settings, at, { total, shiftedFrame }) {
    if (shiftedFrame) return [];
    return at('k0') + geom(P).LEN === total ? [] : [`${ID}: it must be the last block in the image (the cells after it are its counters)`];
  },
  emit(ctx) {
    const { L, P, core } = ctx, G = geom(P);
    G.fan.forEach((op, i) => (op === 'D' ? ctx.ins(i ? '' : 'fGo', 'SPL', 'B', '1', '0') : ctx.ins(i ? '' : 'fGo', 'MOV', 'I', '-1', '0')));
    G.steps.forEach((step, j) => {
      ctx.ins(`k${2 * j}`, 'MOV', 'I', `<${G.LEN}`, `<${L(`k${2 * j + 1}`)}`);
      // The copy starts STEP cells past this stage's MOV: the pointer ends there after LEN decrements.
      ctx.ins(`k${2 * j + 1}`, 'SPL', 'B', '@0', `${mod(step - 1 + G.LEN, core)}`);
    });
    if (P.TAIL === 2) {
      ctx.ins('tSpl', 'SPL', 'B', '0', '0');
      ctx.ins('tLay', 'MOV', 'I', L('tDrop'), `<${L('tDrop')}`);
      ctx.ins('tDrop', 'MOV', 'I', '<0', `<${mod(P.TRAIL, core)}`);
      ctx.ins('tBack', 'DJN', 'B', L('tSpl'), `<${Math.floor(core / 4) + 180}`);
    } else if (P.TAIL) {
      const S = modInverse(3, core);
      ctx.ins('tSpl', 'SPL', 'B', '0', '0');
      ctx.ins('tAdd', 'ADD', 'AB', `#${S}`, L('tJmp'));
      ctx.ins('tJmp', 'JMP', 'B', '@0', `${mod(1 - S * G.LEN, core)}`);
      ctx.ins('tImp', 'MOV', 'I', '0', `${S}`);
    } else {
      ctx.ins('tMov', 'MOV', 'I', '0', `<${L('tDjn')}`);
      ctx.ins('tDjn', 'DJN', 'B', L('tMov'), `#${-P.GAP}`);
    }
  },
  // It runs in its copies: a process on a stage line, a tail line or an imp.
  running(api) {
    const lines = ['k0', 'k2', ...(api.P.TAIL === 2 ? ['tSpl', 'tLay'] : api.P.TAIL ? ['tSpl', 'tAdd', 'tImp'] : ['tMov'])].map((l) => api.code(l));
    return api.vm.processes(0).some((q) => api.inSelf(q) || lines.some((x) => api.same(api.vm.peek(q), x)));
  },
  watch(api) {
    const { vm, P, core } = api, G = geom(P), S = P.TAIL === 1 ? modInverse(3, core) : 0;
    const tLay = P.TAIL === 2 ? api.at('tLay') : null, tDrop = P.TAIL === 2 ? api.at('tDrop') : null;
    const isDrop = (x) => x.op === 'MOV' && x.aMode === '<' && x.bMode === '<' && api.norm(x.a) === 0;
    let drops = 0, firstDrop = null;
    const k0 = api.at('k0');
    const stages = G.steps.map((step, j) => ({ j, mov: api.norm(k0 + 2 * j), spl: api.norm(k0 + 2 * j + 1), want: api.norm(k0 + 2 * j + step), runs: 0, dst: null }));
    const sameBut = (x, y, skipB) => ['op', 'aMode', 'bMode'].every((f) => x[f] === y[f]) && api.norm(x.a) === api.norm(y.a) && (skipB || api.norm(x.b) === api.norm(y.b));
    const lineOk = (l) => sameBut(vm.peek(api.at(l)), api.code(l), true);
    const tMov = P.TAIL ? null : api.at('tMov'), tDjn = P.TAIL ? null : api.at('tDjn'), tJmp = P.TAIL === 1 ? api.at('tJmp') : null, tImp = P.TAIL === 1 ? api.at('tImp') : null;
    let wipes = 0, launches = 0, fanned = null;
    return {
      before(pc) {
        if (pc === k0 && fanned === null) fanned = vm.processes(0).filter((q) => q === k0).length;
        const st = stages.find((s) => s.spl === pc);
        // Only the group's own pass counts: much later a stray process may run the line again.
        if (st && st.runs < G.LEN && sameBut(vm.peek(pc), api.code(`k${2 * st.j + 1}`), true)) {
          if (!st.runs) {
            // All LEN copies are down: the window from this stage's MOV on, cell for cell.
            st.dst = api.norm(pc + vm.peek(pc).b);
            if (st.dst !== st.want) throw new Error(`${ID}: stage ${st.j + 1} laid its copy ${api.norm(st.dst - st.mov)} cells on, not ${G.steps[st.j]}`);
            for (let i = 0; i < G.LEN; i++) if (!sameBut(vm.peek(st.dst + i), vm.peek(st.mov + i), i === 1)) throw new Error(`${ID}: stage ${st.j + 1} made an incomplete copy`);
          }
          return { stage: st };
        }
        if (pc === tMov && lineOk('tMov') && lineOk('tDjn')) return { wipe: api.norm(tDjn + vm.peek(tDjn).b - 1) };
        if (pc === tJmp && lineOk('tAdd') && lineOk('tJmp')) return { launch: api.norm(tJmp + vm.peek(tJmp).b) };
        if (pc === tLay && lineOk('tLay') && isDrop(vm.peek(tDrop))) return { drop: api.norm(tDrop + vm.peek(tDrop).b - 1) };
        return null;
      },
      after(t) {
        if (!t) return;
        if (t.stage) {
          t.stage.runs++;
          if (vm.processes(0).at(-1) !== t.stage.dst) throw new Error(`${ID}: stage ${t.stage.j + 1} did not start a process in its copy`);
        } else if (t.drop !== undefined) {
          if (!isDrop(vm.peek(t.drop))) throw new Error(`${ID}: the resin tail laid something other than its drop`);
          firstDrop ??= t.drop; drops++;
        } else if (t.wipe !== undefined) {
          if (api.inSelf(t.wipe) && api.rel(t.wipe, k0) < G.LEN) throw new Error(`${ID}: the clear wiped its own body`);
          if (!sameBut(vm.peek(t.wipe), api.code('tMov'), false)) throw new Error(`${ID}: the clear laid something other than its own line`);
          wipes++;
        } else {
          // Launch k of the original lands k ring steps past the template.
          if (t.launch !== api.norm(tImp + launches * S)) throw new Error(`${ID}: imp ${launches} left the ring`);
          launches++;
        }
      },
      final() {
        if (!api.alone) return;
        if (fanned !== G.LEN) throw new Error(`${ID}: the fan made ${fanned} processes, not ${G.LEN}`);
        for (const st of stages) if (st.runs !== G.LEN) throw new Error(`${ID}: stage ${st.j + 1} started ${st.runs} processes in its copy, not ${G.LEN}`);
        // Copies of the first stage, anywhere but here.
        const a = api.code('k0'), b = api.code('k1');
        let copies = 0;
        for (let c = 0; c < core; c++) if (!api.inSelf(c) && sameBut(vm.peek(c), a, false) && sameBut(vm.peek(c + 1), b, true)) copies++;
        // A resin tail wipes its own older copies with its trail: only the other tails are asked for copies.
        if (copies < 3 && P.TAIL !== 2) throw new Error(`${ID}: only ${copies} copies of the whole body exist`);
        if (!P.TAIL && wipes < G.LEN) throw new Error(`${ID}: the clear wiped only ${wipes} cells`);
        if (P.TAIL === 2) {
          if (firstDrop !== api.norm(tDrop + P.TRAIL - 1)) throw new Error(`${ID}: the resin trail did not start TRAIL cells from the drop line`);
          if (drops < G.LEN) throw new Error(`${ID}: the resin tail laid only ${drops} drops`);
          // A plain loop in the path of the trail walks off its code (see resin-stone).
          const r = api.duel(';name falls off\nv SUB #1, 2\n JMP v\n DAT #0, #0\n END v\n', { offset: api.norm(tDrop - api.image.start + P.TRAIL - 40), cycles: 20000 });
          if (!r.ours || r.theirs) throw new Error(`${ID}: a loop in the path of the resin trail did not die`);
        }
        if (P.TAIL === 1) {
          if (launches < 2 * G.LEN) throw new Error(`${ID}: the imp tail launched only ${launches} imps`);
          const imp = api.code('tImp');
          const imps = vm.processes(0).filter((q) => api.same(vm.peek(q), imp)).length;
          if (imps < 3) throw new Error(`${ID}: ${imps} imps are alive`);
        }
      },
    };
  },
};

export default [silkTail];
