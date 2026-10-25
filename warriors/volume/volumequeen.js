// Volume Queen: Plane Queen, the evolver's best plane warrior, rewritten for
// the volume. A two-pass core clear (Two-Pass Clear: SPL 0 everywhere, then
// DAT everywhere) does the killing; its pointer counts as a plain number, so
// it reaches every cell of the volume. A second process runs Fast Silk's
// copy loop N times, leaving decoys (fragments of the warrior) in other rows
// and layers, then runs into the DAT after it and ends: a sprayer that kept
// going would be caught by the clear's SPL 0 pass and fill our process queue,
// starving the clear. Plane Queen does the same with N = 1 (its loop jumps
// into the DAT); MODE stone sprays DAT bombs instead of decoys. The tuner
// found no spray setting better than the noise: what wins is the clear run
// by two processes (2.34 points per round on 40x20x10; one process 2.19,
// four 0.90, Two-Pass Clear 2.14).
name("Volume Queen");
author("ZoreWars (from Plane Queen, ZoreWars Evolver)");
strategy("Two-pass core clear plus a decoy sprayer that scatters copies of itself across rows and layers.");
if (SIZEZ < 2) throw new Error("Volume Queen is for a 3D battlefield: choose a Volume in Rules (CLI: --torus 40x20x10)");
//
// Tuned constants: `node cli/zorewars.js tune warriors/volume/volumequeen.js --torus 40x20x10`
// SPACE {"EX":[0,39],"EY":[0,19],"EZ":[0,9],"FX":[0,39],"FY":[0,19],"FZ":[1,9],"MODE":["decoy","stone"],"N":[1,12]}
const P = {"EX":30,"EY":5,"EZ":3,"FX":10,"FY":7,"FZ":4,"MODE":"decoy","N":1};

org("launch");
label("launch"); spl("spray");                        // a process for the decoy sprayer
spl(1);                                               // two processes for the clear (one scores 2.19, four 0.90)
jmp("pass1");
// ---- Two-Pass Clear ----
label("ptr");   dat.f(imm(0), imm("len"));
label("pass1"); mov.i("stun", postinc("ptr"));        // pass 1: SPL 0
djn.b("pass1", imm(`${CORESIZE}-len`));
mov.ab(imm("len"), "ptr");
label("clear"); mov.i("kill", postinc("ptr"));        // pass 2: DAT
jmp("clear");
label("stun");  spl.b(imm(0), imm(0));
label("kill");  dat.f(imm(0), imm(0));                // also the sprayer's pointers (A: write, B: read)
// ---- decoy sprayer (Fast Silk's loop) ----
label("spray");
for (let i = 0; i < 3; i++) P.MODE === "stone" ? mov.i("kill", apostinc("kill")) : mov.i(postinc("kill"), apostinc("kill"));
add.a(imm(vec(P.EX, P.EY, P.EZ)), "seed");            // the next target: elsewhere in the volume
mov.f("seed", "kill");
label("count"); djn.b("spray", imm(P.N));              // N times, then on into the DAT below
label("seed");  dat.f(imm(vec(P.FX, P.FY, P.FZ)), imm(0));
equ("len", "(seed+1-ptr)");                          // the clear spares all of us
