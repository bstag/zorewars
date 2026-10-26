// Backdraft: a core clear that runs backward. The idea (from ULTIMA RATIO
// REGUM, a 1990s hill warrior): a clear's pointer that decrements walks
// through every cell just as one that increments does, but its front
// arrives from the other side. Leapfrog, Adapter and Volume Chameleon watch
// for a front coming the way forward clears move, and never see it.
// One process: pass 1 lays stun traps behind itself, pass 2 lays DATs, each
// pass stopping just short of its own code, and then it starts over, so it
// keeps clearing for the whole round instead of running into itself.
// TRAP spl writes SPL 0 everywhere; TRAP pair writes SPL 0 and JMP -1 in
// turn, a two-cell trap: a process on the JMP jumps back onto the SPL.
name("Backdraft");
author("ZoreWars");
strategy("Backward core clear in one process: stun traps then DATs, each pass stopping short of itself, over and over.");
if (SIZEZ < 2) throw new Error("Backdraft is for a 3D battlefield: choose a Volume in Rules (CLI: --torus 40x20x10)");
//
// Tuned constants: `node cli/zorewars.js tune warriors/volume/backdraft.js --torus 40x20x10`
// SPACE {"TRAP":["spl","pair"],"PROCS":[1,2]}
const P = {"TRAP":"pair","PROCS":1};
const PAIR = P.TRAP === "pair";

label("ptr");   dat.f(0, 0);                                  // the pointer: it counts down from just behind us
org("go");
label("go");    if (P.PROCS === 2) spl(1);                    // (a second process for the clear)
label("lap");   mov.ab(imm(0), "ptr");
mov.ab(imm(PAIR ? `(${CORESIZE}-len)/2` : `${CORESIZE}-len`), "left");
label("pass1"); mov.i("stun", predec("ptr"));                 // pass 1: traps, walking backward
if (PAIR) mov.i("jump", predec("ptr"));
djn.b("pass1", "left");
mov.ab(imm(0), "ptr");
mov.ab(imm(`${CORESIZE}-len`), "left");
label("pass2"); mov.i("kill", predec("ptr"));                 // pass 2: DATs
djn.b("pass2", "left");
jmp("lap");                                                   // and again
label("stun");  spl.b(imm(0), imm(0));
label("jump");  jmp(-1);                                      // (TRAP pair: back onto the SPL laid after it)
label("kill");  dat.f(imm(0), imm(0));
label("left");  dat.f(0, 0);
equ("len", "(left+1-ptr)");
