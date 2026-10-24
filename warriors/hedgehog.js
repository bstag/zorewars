// Hedgehog: quickscan, then a stone and an imp spiral, booted away from a decoy.
//   1. A decoding quickscan checks 24 cells spread round the core in its
//      first few dozen cycles and carpet-bombs anything it finds.
//   2. The stone (multi-process, turns into a clear) is copied SOFF cells
//      away and started there. The scan code stays behind as a decoy.
//   3. An imp spiral of T processes is launched at IOFF: almost impossible to
//      kill, it turns rounds the stone can't win into ties.
// All the arithmetic (decode table, probe spread, safe bomb counts) is done
// by the JavaScript below.
//
// Tuned constants. `zorewars tune` searches the SPACE below for better values:
//   node cli/zorewars.js tune warriors/hedgehog.js
// SPACE {"GAP":[2,12],"QTIME":[8,24],"BACK":[0,6],"QBOMB":["dat","spl"],"SOFF":[200,7800],"SSTEP":[2,7998],"SBOMB":["dat","spl"],"IOFF":[200,7800],"T":[3,6,8]}
const P = {"GAP":8,"QTIME":10,"BACK":4,"QBOMB":"spl","SOFF":5077,"SSTEP":1874,"SBOMB":"dat","IOFF":6568,"T":8};
name("Hedgehog");
author("ZoreWars");
strategy("Decoding quickscan, then a booted multi-process stone that becomes a clear, plus an imp spiral.");

const N = CORESIZE;
const wrap = (x) => ((x % N) + N) % N;
const egcd = (a, b) => (b === 0 ? [a, 1, 0] : (([g, x, y]) => [g, y, x - Math.floor(a / b) * y])(egcd(b, a % b)));
const inverse = (a) => { const [g, x] = egcd(wrap(a), N); return g === 1 ? wrap(x) : null; };
const circ = (a, b) => { const d = wrap(a - b); return Math.min(d, N - d); };
const ISTEP = (N + 1) / 3;
if (!Number.isInteger(ISTEP)) throw new Error('the imp spiral needs CORESIZE+1 divisible by 3');

// ================= 1. quickscan with decode =================
// Each group of 3 lines checks 4 cells in two pairs:
//   SNE.I  C(v), C(v)+GAP        a difference skips the SEQ and goes to the JMP
//   SEQ.I  <t, C(v-1)+GAP        decrements table cell t (v -> v-1); its A-operand
//                                *is* the cell C(v-1), so it checks the second pair
//   JMP    dec, {sel / sel / }sel   the B-operand picks which table cell to read
// The decoder multiplies qp.b = D * t.b, so the carpet lands on qp + D*v:
// C(v) or C(v-1), whichever pair fired. For the SEQ's A-operand to be C(v-1),
// each table value must satisfy t + v - 1 = qp + D*(v-1) (mod CORESIZE), so
// v = 1 + (t - qp) / (D - 1): D - 1 must be invertible. JavaScript tries every
// D and keeps the one that spreads the probes most evenly, away from our code.
const G = 6, RESERVED = 100;
const Q = {};
let n = 3 * G;
for (const k of ['skip', 'decA', 'jA', 'decB', 'qb', 'ql', 'qadd', 'qdjn', 'qend', 'qbmb', 'selA', 'selB', 'qp']) Q[k] = n++;
Q.tabA = n; n += 3;
Q.tabB = n; n += 3;
const QLEN = n;
// Things the quickscan must not probe or bomb: our code, and where we boot to.
const ours = [[0, 100], [P.SOFF, P.SOFF + 20], [P.IOFF - 2, P.IOFF + 2]];
const nearOurs = (c, pad) => ours.some(([a, b]) => circ(c, (a + b) / 2) < (b - a) / 2 + pad);
function probesFor(D) {
  const inv = inverse(D - 1);
  if (inv === null) return null;
  const cells = [], groups = [];
  for (let k = 0; k < G; k++) {
    const t = (k < 3 ? Q.tabA : Q.tabB) + (k % 3);
    const v = wrap(1 + (t - Q.qp) * inv);
    const c1 = wrap(Q.qp + D * v), c2 = wrap(Q.qp + D * (v - 1));
    groups.push({ t, v, c1, c2 });
    cells.push(c1, c2);
  }
  return { cells, groups };
}
let best = null;
for (let D = 2; D < N; D++) {
  const p = probesFor(D);
  if (!p || p.cells.some((c) => nearOurs(c, P.QTIME + P.BACK + RESERVED / 2))) continue;
  let gap = Infinity;
  for (let i = 0; i < p.cells.length; i++) for (let j = i + 1; j < p.cells.length; j++) gap = Math.min(gap, circ(p.cells[i], p.cells[j]));
  if (!best || gap > best.gap) best = { D, gap, ...p };
}
if (!best) throw new Error('no decode factor keeps the probes clear of our code');

org("qscan");
label("qscan");
best.groups.forEach((g, k) => {
  const at = curline();
  const sel = k < 3 ? Q.selA : Q.selB, dec = k < 3 ? Q.decA : Q.decB;
  sne.i(g.c1 - at, g.c1 + P.GAP - at);
  seq.i(predec(g.t - (at + 1)), g.c2 + P.GAP - (at + 1));
  const m = k % 3;
  jmp(dec - (at + 2), m === 0 ? apredec(sel - (at + 2)) : m === 2 ? apostinc(sel - (at + 2)) : 0);
});
jmp("boot");                                   // nothing found
mul.b(aind("selA"), "qp");                     // qp.b = D * v: the find
jmp("qb");
mul.b(aind("selB"), "qp");
label("qb"); sub.ab(imm(P.BACK), "qp");
label("ql"); mov.i("qbmb", ind("qp"));
add.ab(imm(1), "qp");
djn.b("ql", imm(P.QTIME));
jmp("boot");
label("qbmb"); P.QBOMB === "spl" ? spl.b(imm(0), imm(0)) : dat.f(0, 0);
label("selA"); dat.f(Q.tabA + 1 - Q.selA, 0);
label("selB"); dat.f(Q.tabB + 1 - Q.selB, 0);
label("qp");   dat.f(0, best.D);
for (let k = 0; k < G; k++) dat.f(0, best.groups[k].v);
if (curline() !== QLEN) throw new Error('quickscan layout is off');

// ================= 2. boot and launch =================
const STONE_LEN = 16;
label("boot");
for (let i = 0; i < STONE_LEN; i++) mov.i(`sgo+${i}`, `sgo+${i + P.SOFF}`);   // copy the stone away
mov.i("impi", `impi+${P.IOFF}`);                       // the first imp of the spiral
spl(`sgo+${P.SOFF}`);                                  // start the stone
const SPLITS = Math.ceil(Math.log2(P.T));
for (let i = 0; i < SPLITS; i++) spl(1);
jmp(apostinc("itab"));                                 // each process takes the next entry
label("itab"); dat.f(imm(1), 0);
for (let k = 0; k < 2 ** SPLITS; k++) {
  if (k < P.T) jmp(`impi+${P.IOFF + k * ISTEP}`);      // spiral point k
  else jmp(`sgo+${P.SOFF + 1}`);                       // spare processes join the stone
}
label("impi"); mov.i(imm(0), ISTEP);

// ================= 3. the stone (runs at SOFF) =================
label("sgo");    spl(imm(0), 0);                       // process factory
label("sl");     mov.i("sbomb", ind("sptr"));
add.ab(imm(P.SSTEP), "sptr");
djn.b("sl", "scnt");
mov.i("jclr", "sl");                                   // bombs done: everyone to the clear
label("clear");  mov.i("cbomb", postinc("cptr"));
djn.b("clear", "ccnt");
mov.i("idle", "clear");                                // clear done: everyone idles
label("sptr");   dat.f(0, 0);
label("scnt");   dat.f(0, "safe");
label("cptr");   dat.f(0, "send-cptr");
label("ccnt");   dat.f(0, `CORESIZE-${STONE_LEN}`);
label("jclr");   jmp("clear-sl");
label("idle");   jmp(0);
label("sbomb");  P.SBOMB === "spl" ? spl.b(imm(0), imm(0)) : dat.f(0, 0);
label("cbomb");  dat.f(0, 0);
equ("send", "(cbomb+1)");
if (curline() - (curline() - STONE_LEN) !== STONE_LEN) throw new Error('stone length');

// The stone's bombs come from its booted sptr (offset 8 in the block) and
// must never land on the stone itself.
const LEN = curline(), SGO = LEN - STONE_LEN;
if (LEN > MAXLENGTH) throw new Error(`${LEN} instructions`);
const stoneAt = wrap(SGO + P.SOFF);
if (circ(stoneAt, 0) < LEN + 20 || circ(P.IOFF, 0) < LEN + 20 || circ(P.IOFF, stoneAt) < 40) throw new Error('boot targets too close');
let safe = 0;
for (let k = 1; k < N; k++) {
  const at = wrap(stoneAt + 8 + k * P.SSTEP);
  if (wrap(at - stoneAt) < STONE_LEN) break;           // the launch code is only a decoy by now
  safe = k;
}
if (safe < 100) throw new Error(`stone step ${P.SSTEP} hits our code after ${safe} bombs`);
equ("safe", safe);
comment(`D=${best.D}, probes: ${best.groups.flatMap((g) => [g.c1, g.c1 + P.GAP, g.c2, g.c2 + P.GAP]).map(wrap).join(' ')}`);
