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
// MODE qscan replaces the sprayer with a quick-scan opener (from Pyre-Swept
// on ModelWar): before launching the clear it compares two pairs of distant
// cells; if one differs, something is there, and the SPL 0 pass starts at
// the first of them and runs on up to our own code instead of starting from
// us. The DAT pass still sweeps everything.
name("Volume Queen");
author("ZoreWars (from Plane Queen, ZoreWars Evolver)");
strategy("Two-pass core clear plus a decoy sprayer that scatters copies of itself across rows and layers.");
if (SIZEZ < 2) throw new Error("Volume Queen is for a 3D battlefield: choose a Volume in Rules (CLI: --torus 40x20x10)");
//
// Tuned constants: `node cli/zorewars.js tune warriors/volume/volumequeen.js --torus 40x20x10`
// SPACE {"EX":[0,39],"EY":[0,19],"EZ":[0,9],"FX":[0,39],"FY":[0,19],"FZ":[1,9],"MODE":["decoy","stone","qscan"],"N":[1,12],"Q1X":[0,39],"Q1Y":[2,17],"Q1Z":[0,9],"Q2X":[0,39],"Q2Y":[2,17],"Q2Z":[0,9],"Q3X":[0,39],"Q3Y":[0,19],"Q3Z":[1,9],"Q4X":[0,39],"Q4Y":[0,19],"Q4Z":[1,9],"G":[1,9]}
const P = {"EX":30,"EY":5,"EZ":3,"FX":10,"FY":7,"FZ":4,"MODE":"decoy","N":1,"Q1X":11,"Q1Y":5,"Q1Z":3,"Q2X":27,"Q2Y":12,"Q2Z":6,"Q3X":5,"Q3Y":9,"Q3Z":2,"Q4X":33,"Q4Y":3,"Q4Z":7,"G":4};
const QSCAN = P.MODE === "qscan";
const Q = (x, y, z, g = 0) => vec(x + g, y, z);

if (QSCAN) {
  org("qs");
  label("qs");    sne.i(Q(P.Q1X, P.Q1Y, P.Q1Z), Q(P.Q1X, P.Q1Y, P.Q1Z, P.G));   // something at Q1?
  seq.i(Q(P.Q2X, P.Q2Y, P.Q2Z), Q(P.Q2X, P.Q2Y, P.Q2Z, P.G));                   // or at Q2?
  jmp("hit");
  sne.i(Q(P.Q3X, P.Q3Y, P.Q3Z), Q(P.Q3X, P.Q3Y, P.Q3Z, P.G));
  seq.i(Q(P.Q4X, P.Q4Y, P.Q4Z), Q(P.Q4X, P.Q4Y, P.Q4Z, P.G));
  jmp("hit");
} else org("launch");
label("launch"); if (!QSCAN) spl("spray");            // a process for the decoy sprayer
spl(1);                                               // two processes for the clear (one scores 2.19, four 0.90)
jmp("pass1");
// ---- Two-Pass Clear ----
label("ptr");   dat.f(imm(0), imm("len"));
label("pass1"); mov.i("stun", postinc("ptr"));        // pass 1: SPL 0
label("count1"); djn.b("pass1", imm(`${CORESIZE}-len`));
mov.ab(imm("len"), "ptr");
label("clear"); mov.i("kill", postinc("ptr"));        // pass 2: DAT
jmp("clear");
label("stun");  spl.b(imm(0), imm(0));
label("kill");  dat.f(imm(0), imm(0));                // also the sprayer's pointers (A: write, B: read)
if (QSCAN) {
  // ---- a find: start the SPL 0 pass at Q1 (in the qs line's frame), and
  // stop it just short of the lines before ptr (the opener and launch) ----
  label("hit");   mov.ab(imm(`qs-ptr+${vec(P.Q1X, P.Q1Y, P.Q1Z)}`), "ptr");
  mov.ab(imm(`${CORESIZE}-(ptr-qs)-(qs-ptr+${vec(P.Q1X, P.Q1Y, P.Q1Z)})`), "count1");
  jmp("launch");
  equ("len", "(hit+3-ptr)");                         // the clear spares all of us
} else {
  // ---- decoy sprayer (Fast Silk's loop) ----
  label("spray");
  for (let i = 0; i < 3; i++) P.MODE === "stone" ? mov.i("kill", apostinc("kill")) : mov.i(postinc("kill"), apostinc("kill"));
  add.a(imm(vec(P.EX, P.EY, P.EZ)), "seed");          // the next target: elsewhere in the volume
  mov.f("seed", "kill");
  label("count"); djn.b("spray", imm(P.N));            // N times, then on into the DAT below
  label("seed");  dat.f(imm(vec(P.FX, P.FY, P.FZ)), imm(0));
  equ("len", "(seed+1-ptr)");                        // the clear spares all of us
}
