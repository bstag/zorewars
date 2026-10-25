// PROTOTYPE (not in the library): Volume Queen's first version. See README.md.
// Plane Queen ported to 3D with a sprayer that never stops. Result: ties
// almost everything (1-0-19 against Dwarf). The sprayed fragments include
// MOV instructions; enemy processes stunned by the clear's SPL 0 pass run
// them and rebuild SPL cells behind the clear, so stunned enemies outlive
// it. (With the clear starting on the sprayer instead, the stunned sprayer
// floods our own process queue and starves the clear.) Plane Queen's
// sprayer stops after one copy because its last JMP lands on a DAT; Volume
// Queen counts its copies.
name("Volume Queen (endless sprayer)");
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
jmp("spray");                                         // forever (the bug: see the top)
label("seed");  dat.f(imm(vec(P.FX, P.FY, P.FZ)), imm(0));
equ("len", "(seed+1-ptr)");                          // the clear spares all of us
