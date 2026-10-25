// Volume Chameleon: a P-space switcher built on the volume's triangle.
// Leapfrog beats clears, stones and scanners but loses to papers; a clear
// ties papers. So it plays Leapfrog, and after a round it lost it switches
// to the clear (Volume Queen's two-process two-pass clear), and back again
// after losing with that. P-space keeps the strategy between rounds; a win
// or a tie keeps it.
name("Volume Chameleon");
author("ZoreWars");
strategy("P-space switcher: plays Leapfrog, and switches to a core clear after losing a round (and back).");
if (SIZEZ < 2) throw new Error("Volume Chameleon is for a 3D battlefield: choose Volume 80×10×10 in Rules (CLI: --torus 80x10x10)");
//
// Tuned constants: `node cli/zorewars.js tune warriors/volume/volumechameleon.js --torus 80x10x10`
// SPACE {"KEY":[1,499],"START":[0,1],"SENT":[1,3],"HOPY":[2,6],"HOPZ":[0,3]}
const P = {"KEY":490,"START":0,"SENT":1,"HOPY":5,"HOPZ":2};

// ---- the clear (Volume Queen's), first, so it spares everything after it ----
label("ptr");   dat.f(imm(0), imm("len"));
label("pass1"); mov.i("stun", postinc("ptr"));               // pass 1: SPL 0
djn.b("pass1", imm(`${CORESIZE}-len`));
mov.ab(imm("len"), "ptr");
label("clear"); mov.i("kill", postinc("ptr"));               // pass 2: DAT
jmp("clear");
label("stun");  spl.b(imm(0), imm(0));
label("kill");  dat.f(imm(0), imm(0));

// ---- the switch: last round's result and the strategy we played ----
org("think");
label("think"); ldp.ab(imm(0), "res");                       // P-space 0: 0 if we lost the last round
ldp.ab(imm(P.KEY), "mode");                                  // the strategy we played
jmn.b("keep", "res");                                        // won or tied (or the first round): keep it
add.ab(imm(1), "mode");                                      // lost: switch
label("keep");  mod.ab(imm(2), "mode");
stp.b("mode", imm(P.KEY));                                   // remember for next round
P.START ? jmn.b("first", "mode") : jmz.b("first", "mode");   // Leapfrog
spl("pass1");                                                // the clear, with two processes
jmp("pass1");
label("res");   dat.f(imm(0), imm(0));
label("mode");  dat.f(imm(0), imm(0));

// ---- Leapfrog (see leapfrog.js); it copies only itself, first..last ----
label("first"); mov.i("mark", ind("sentp"));                 // plant the marker
mov.ab(imm("last-lptr"), "lptr");                            // our clear starts just past us
label("loop");  mov.i("lkill", postinc("lptr"));
seq.i("mark", ind("sentp"));                                 // marker still there?
jmp("move");
jmp("loop");
label("move");  mov.ab(imm("last-src"), "src");
mov.ab(imm(`last-dst+${vec(0, -P.HOPY, -P.HOPZ)}`), "dst");
mov.ab(imm("last-first"), "cnt");
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
equ("last", "(lkill+1)");
equ("len", "(last-ptr)");
