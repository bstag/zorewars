// Mortar Clear: Mortar with Backdraft's backward clear in place of the
// stone. In 3D a stone can't kill a paper (Mortar tied every paper 30-0-30);
// a full clear can. The clear lays DATs only: SPL 0 traps would stun our own
// paper's copies and flood our own queue (Queen Imp's failure). The paper
// is insurance against what beats clears.
name("Mortar Clear");
author("ZoreWars");
strategy("Paper/clear: Volume Silk's copies plus a separate backward DAT clear (Backdraft's second pass).");
if (SIZEZ < 2) throw new Error("Mortar Clear is for a 3D battlefield: choose a Volume in Rules (CLI: --torus 80x10x10)");
//
// SPACE {"LEVELS":[0,3],"DX":[1,79],"DY":[0,9],"DZ":[1,9],"EX":[0,79],"EY":[0,9],"EZ":[0,9],"CLEAR":[0,3],"K":[0,30]}
const P = {"LEVELS":2,"DX":29,"DY":4,"DZ":3,"EX":21,"EY":6,"EZ":5,"CLEAR":0,"K":0};

label("ptr");   dat.f(0, 0);                                  // the clear's pointer
org("boot");
label("boot");  spl("clear");                                 // the clear gets its own process(es)
// ---- paper (Volume Silk) ----
for (let i = 0; i < P.LEVELS; i++) spl(1);
label("silk");  spl(vec(P.DX, P.DY, P.DZ), imm(0));
for (let i = 0; i < 3; i++) mov.i(postinc("silk"), apostinc("silk"));
add.a(imm(vec(P.EX, P.EY, P.EZ)), "seed");
mov.f("seed", "silk");
// K > 0: each copy loop runs K times and then dies (on seed), so the
// paper's processes stop growing and leave the clear its turns.
if (P.K) djn.b("silk", imm(P.K)); else jmp("silk");
label("seed");  dat.f(imm(vec(P.DX, P.DY, P.DZ)), imm(0));
// ---- backward DAT clear (Backdraft's pass 2, over and over) ----
label("clear"); for (let i = 0; i < P.CLEAR; i++) spl(1);
label("lap");   mov.ab(imm(0), "ptr");
mov.ab(imm(`${CORESIZE}-len`), "left");
label("pass");  mov.i("kill", predec("ptr"));
djn.b("pass", "left");
jmp("lap");
label("kill");  dat.f(imm(0), imm(0));
label("left");  dat.f(0, 0);
equ("len", "(left+1-ptr)");
