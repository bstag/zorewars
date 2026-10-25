// Anti-Chameleon: a P-space switcher built to stay a step ahead of Volume
// Chameleon. Volume Chameleon plays Leapfrog, and after a lost round
// switches to a core clear (and back). A paper beats Leapfrog; Leapfrog
// beats a clear. So Anti-Chameleon starts with the paper (Volume Silk) and,
// with SWITCHWIN, switches after every decided round, won or lost, keeping
// its strategy only after a tie: when it wins, Volume Chameleon has lost and
// will switch, so it switches to what beats Volume Chameleon's next choice.
// With SWITCHWIN 0 it switches only after a loss, like Volume Chameleon.
name("Anti-Chameleon");
author("ZoreWars");
strategy("P-space switcher: paper or Leapfrog, switching after every decided round to stay ahead of Volume Chameleon.");
if (SIZEZ < 2) throw new Error("Anti-Chameleon is for a 3D battlefield: choose Volume 80×10×10 in Rules (CLI: --torus 80x10x10)");
//
// Tuned constants: `node cli/zorewars.js tune warriors/volume/antichameleon.js --torus 80x10x10`
// SPACE {"KEY":[1,499],"LEVELS":[2,3],"DX":[1,79],"DY":[0,9],"DZ":[1,9],"EX":[0,79],"EY":[0,9],"EZ":[0,9],"SENT":[1,3],"HOPY":[2,6],"HOPZ":[0,3]}
const P = {"KEY":307,"SWITCHWIN":1,"LEVELS":3,"DX":29,"DY":4,"DZ":3,"EX":21,"EY":6,"EZ":5,"SENT":2,"HOPY":4,"HOPZ":0};

// ---- the switch: last round's result and the strategy we played ----
org("think");
label("think"); ldp.ab(imm(0), "res");                       // P-space 0: 0 lost, 1 won, 2 tied, -1 first round
ldp.ab(imm(P.KEY), "mode");                                  // the strategy we played (0 paper, 1 Leapfrog)
if (P.SWITCHWIN) slt.ab(imm(1), "res");                      // a tie or the first round (res > 1): keep it
else jmn.b("keep", "res");                                   // won, tied or first round: keep it
add.ab(imm(1), "mode");                                      // otherwise switch
label("keep");  mod.ab(imm(2), "mode");
stp.b("mode", imm(P.KEY));                                   // remember for next round
jmz.b("paper", "mode");
jmp("first");                                                // Leapfrog
label("res");   dat.f(imm(0), imm(0));
label("mode");  dat.f(imm(0), imm(0));

// ---- Leapfrog (see leapfrog.js); it copies only itself, first..llast ----
label("first"); mov.i("mark", ind("sentp"));                 // plant the marker
mov.ab(imm("llast-lptr"), "lptr");                           // our clear starts just past Leapfrog
label("loop");  mov.i("lkill", postinc("lptr"));
seq.i("mark", ind("sentp"));                                 // marker still there?
jmp("move");
jmp("loop");
label("move");  mov.ab(imm("llast-src"), "src");
mov.ab(imm(`llast-dst+${vec(0, -P.HOPY, -P.HOPZ)}`), "dst");
mov.ab(imm("llast-first"), "cnt");
label("copy");  mov.i(predec("src"), predec("dst"));
djn.b("copy", "cnt");
jmp(ind("dst"));
label("src");   dat.f(0, 0);
label("dst");   dat.f(0, 0);
label("cnt");   dat.f(0, 0);
label("lptr");  dat.f(0, 0);
label("sentp"); dat.f(0, vec(0, -P.SENT, 0));
label("mark");  dat.f(0, 1);
label("lkill"); dat.f(imm(0), imm(0));
equ("llast", "(lkill+1)");

// ---- the paper (Volume Silk), last: its copies take the cells after silk ----
label("paper");
for (let i = 0; i < P.LEVELS; i++) spl(1);
label("silk");  spl(vec(P.DX, P.DY, P.DZ), imm(0));           // start a process in the copy
for (let i = 0; i < 3; i++) mov.i(postinc("silk"), apostinc("silk"));
add.a(imm(vec(P.EX, P.EY, P.EZ)), "seed");                    // next copy: somewhere else
mov.f("seed", "silk");
jmp("silk");
label("seed");  dat.f(imm(vec(P.DX, P.DY, P.DZ)), imm(0));
