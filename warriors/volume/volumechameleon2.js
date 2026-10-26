// Volume Chameleon II: a P-space switcher on the new triangle. Backdraft (a
// backward clear) beats nearly everything here, Leapfrog and the forward
// clears included, but a DJN stream such as Gremlin breaks its numbers; a
// stream can't hurt a paper, whose copies are redundant. So it plays
// Backdraft, and after a round it lost switches to Volume Silk (and back
// after losing with that). P-space keeps the strategy; a win or a tie keeps it.
name("Volume Chameleon II");
author("ZoreWars");
strategy("P-space switcher: Backdraft's backward clear, switching to a paper after a lost round (and back).");
if (SIZEZ < 2) throw new Error("Volume Chameleon II is for a 3D battlefield: choose Volume 80×10×10 in Rules (CLI: --torus 80x10x10)");
//
// Tuned constants: `node cli/zorewars.js tune warriors/volume/volumechameleon2.js --torus 80x10x10`
// SPACE {"KEY":[1,499],"LEVELS":[2,3],"DX":[1,79],"DY":[0,9],"DZ":[1,9],"EX":[0,79],"EY":[0,9],"EZ":[0,9]}
const P = {"KEY":181,"LEVELS":3,"DX":29,"DY":4,"DZ":3,"EX":21,"EY":6,"EZ":5};

// ---- Backdraft (see backdraft.js): its passes spare everything from ptr on ----
label("ptr");   dat.f(0, 0);
label("lap");   mov.ab(imm(0), "ptr");
mov.ab(imm(`(${CORESIZE}-len)/2`), "left");
label("pass1"); mov.i("stun", predec("ptr"));                 // traps, walking backward
mov.i("jump", predec("ptr"));
djn.b("pass1", "left");
mov.ab(imm(0), "ptr");
mov.ab(imm(`${CORESIZE}-len`), "left");
label("pass2"); mov.i("kill", predec("ptr"));                 // DATs
djn.b("pass2", "left");
jmp("lap");
label("stun");  spl.b(imm(0), imm(0));
label("jump");  jmp(-1);
label("kill");  dat.f(imm(0), imm(0));
label("left");  dat.f(0, 0);

// ---- the switch ----
org("think");
label("think"); ldp.ab(imm(0), "res");                       // P-space 0: 0 if we lost
ldp.ab(imm(P.KEY), "mode");                                  // 0 Backdraft, 1 the paper
jmn.b("keep", "res");                                        // won, tied or first round: keep it
add.ab(imm(1), "mode");                                      // lost: switch
label("keep");  mod.ab(imm(2), "mode");
stp.b("mode", imm(P.KEY));
jmz.b("lap", "mode");                                        // Backdraft
jmp("paper");
label("res");   dat.f(imm(0), imm(0));
label("mode");  dat.f(imm(0), imm(0));

// ---- the paper (Volume Silk), last: its copies take the cells after silk ----
label("paper");
for (let i = 0; i < P.LEVELS; i++) spl(1);
label("silk");  spl(vec(P.DX, P.DY, P.DZ), imm(0));
for (let i = 0; i < 3; i++) mov.i(postinc("silk"), apostinc("silk"));
add.a(imm(vec(P.EX, P.EY, P.EZ)), "seed");
mov.f("seed", "silk");
jmp("silk");
label("seed");  dat.f(imm(vec(P.DX, P.DY, P.DZ)), imm(0));
equ("len", "(seed+1-ptr)");
