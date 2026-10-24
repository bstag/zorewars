// Bandit: a three-armed bandit. P-space keeps, for each of three strategies,
// the points it has earned (win 3, tie 1) and how many rounds it has played.
// Each round Bandit plays the arm with the best average, where every arm
// starts with an optimistic average (PRIOR), so each one gets tried. The arms
// are the rock-paper-scissors of Core War: a stone (beats scanners), a paper
// (beats stones) and a scanner (beats papers).
//
// Tuned constants. `zorewars tune` searches the SPACE below for better values:
//   node cli/zorewars.js tune warriors/bandit.js
// SPACE {"KEY":[1,490],"PRIOR":[10,40],"SSTEP":[2,3998]}
const P = {"KEY":238,"PRIOR":33,"SSTEP":2476};
name("Bandit");
author("ZoreWars");
strategy("Three-armed bandit in P-space: plays stone, paper or scanner, whichever has the best average so far.");

const PAPER = { LEVELS: 4, STEP: 3479, DELTA: 5722, BOMB: 462, BDELTA: 3579 };
const GK = { STEP: 24, GAP: 8, CARPET: 22, BACK: 6 };
const K = P.KEY;                       // K: last arm; K+1..3 points; K+4..6 plays

// ---- arm 3: the scanner (Gatekeeper), first, so its clear starts past everything ----
equ("last", "(stun+1)");
equ("count", `(CORESIZE-(last-gate)-${GK.GAP}-${GK.STEP})/${GK.STEP}`);
label("gate"); dat.f(imm(0), imm(0));
label("cptr"); dat.f(imm(0), imm(0));
label("loop"); add.f("inc", "scan");
label("scan"); seq.i("last-scan", `last-scan+${GK.GAP}`);
jmp("hit");
label("next"); djn.b("loop", "cnt");
label("clear"); mov.ab(imm("last-cptr"), "cptr");
label("clr1"); mov.i("stun", postinc("cptr"));
jmn.b("clr1", "cptr");
mov.ab(imm("last-cptr"), "cptr");
label("clr2"); mov.i("seed", postinc("cptr"));
jmp("clr2", predec("gate"));
label("hit");  mov.ab("scan", "bptr");
add.ab(imm(`scan-bptr-${GK.BACK}`), "bptr");
mov.ab(imm(GK.CARPET), "ccnt");
label("cl");   mov.i("stun", postinc("bptr"));
djn.b("cl", "ccnt");
jmp("next");
label("inc");  dat.f(imm(GK.STEP), imm(GK.STEP));
label("cnt");  dat.f(imm(0), imm("count"));
label("bptr"); dat.f(imm(0), imm(0));
label("ccnt"); dat.f(imm(0), imm(0));

// ---- arm 1: the stone. It drops as many bombs as it can without hitting
// Bandit's own code, then runs the scanner's core clear.
const LEN = 97;                        // checked below against the real length
const sp = curline() + 3;              // line of sptr
let safe = 0;
for (let k = 1; k < CORESIZE; k++) {
  const at = (((sp + P.SSTEP * k) % CORESIZE) + CORESIZE) % CORESIZE;
  if (at < LEN) break;
  safe = k;
}
label("stone"); add.ab(imm(P.SSTEP), "sptr");
mov.i("sbomb", ind("sptr"));
djn.b("stone", imm(safe));
label("sptr"); jmp("clear", 0);        // B-field: the bomb pointer
label("sbomb"); dat.f(imm(0), imm(0));

// ---- the bandit ----
org("think");
label("think"); ldp.ab(imm(0), "res");                // P-space 0: last round's result
ldp.ab(imm(K), "arm");                                // the arm we played
jmz.b("choose", "arm");                               // first round: nothing to learn yet
jmz.b("upd", "res");                                  // lost: 0 points
mov.ab(imm(10), "pts");                               // tie: 1 point (points are stored x10)
seq.ab(imm(1), "res");
jmp("upd");
mov.ab(imm(30), "pts");                               // sole survivor: 3 points
label("upd");  mov.b("arm", "idx");
add.ab(imm(K), "idx");
ldp.b("idx", "tmp");                                  // points[arm] += pts
add.b("pts", "tmp");
stp.b("tmp", "idx");
add.ab(imm(3), "idx");
ldp.b("idx", "tmp");                                  // plays[arm] += 1
add.ab(imm(1), "tmp");
stp.b("tmp", "idx");
label("choose");
for (let a = 1; a <= 3; a++) {                        // average = (10*points+PRIOR)/(plays+1)
  ldp.ab(imm(K + a), "tmp");
  ldp.ab(imm(K + 3 + a), "idx");
  add.ab(imm(P.PRIOR), "tmp");
  add.ab(imm(1), "idx");
  div.b("idx", "tmp");
  slt.b("best", "tmp");                               // better than the best so far?
  jmp(`skip${a}`);
  mov.b("tmp", "best");
  mov.ab(imm(a), "arm");
  label(`skip${a}`);
}
stp.b("arm", imm(K));
sne.ab(imm(1), "arm");
jmp("stone");
sne.ab(imm(2), "arm");
jmp("silkgo");
jmp("loop");
label("res");  dat.f(imm(0), imm(0));
label("arm");  dat.f(imm(0), imm(1));
label("pts");  dat.f(imm(0), imm(0));
label("idx");  dat.f(imm(0), imm(0));
label("tmp");  dat.f(imm(0), imm(0));
label("best"); dat.f(imm(0), imm(0));

// ---- arm 2: the paper (Papercut) ----
label("silkgo");
for (let i = 0; i < PAPER.LEVELS; i++) spl(1);
label("silk"); spl(PAPER.STEP, imm(0));
mov.i(postinc("silk"), apostinc("silk"));
mov.i("seed", postinc("carpet"));
add.a(imm(PAPER.DELTA), "seed");
add.ab(imm(PAPER.BDELTA), "carpet");
mov.f("seed", "silk");
jmp("silk");
label("seed"); dat.f(imm(PAPER.STEP), imm(0));
label("carpet"); dat.f(imm(0), imm(PAPER.BOMB));
label("stun"); spl.b(imm(0), imm(0));
if (curline() !== LEN) throw new Error(`LEN is ${LEN} but the code is ${curline()} lines`);
if (safe < 20) throw new Error(`stone step ${P.SSTEP} hits our code after ${safe} bombs`);
