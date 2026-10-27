// Mortar: the ring hills' paper/stone in 3D. A stone and a paper are
// launched as separate parts, each with its own processes, rather than one
// body doing both jobs (the hybrids that failed here did that). The paper
// is Volume Silk and survives; the stone is Cubist's lattice, half a step
// off its own row and layer, and kills. Its bombs can land on the paper's
// copies, as on the ring: the paper makes more.
name("Mortar");
author("ZoreWars");
strategy("Paper/stone: Volume Silk's copies plus a separate Cubist lattice stone.");
if (SIZEZ < 2) throw new Error("Mortar is for a 3D battlefield: choose a Volume in Rules (CLI: --torus 80x10x10)");
//
// SPACE {"LEVELS":[1,3],"DX":[1,79],"DY":[0,9],"DZ":[1,9],"EX":[0,79],"EY":[0,9],"EZ":[0,9],"GX":[2,4,5,8,10],"GY":[2,10],"GZ":[2,10],"STONE":[0,4]}
const P = {"LEVELS":3,"DX":29,"DY":4,"DZ":3,"EX":21,"EY":6,"EZ":5,"GX":4,"GY":2,"GZ":2,"STONE":2};
if (SIZEX % P.GX || SIZEY % P.GY || SIZEZ % P.GZ || P.GY % 2 || P.GZ % 2) {
  throw new Error(`a ${P.GX}x${P.GY}x${P.GZ} lattice doesn't fit a ${SIZEX}x${SIZEY}x${SIZEZ} volume`);
}

org("boot");
label("boot");  spl("stone");                                // the stone gets its own processes
// ---- paper (Volume Silk) ----
for (let i = 0; i < P.LEVELS; i++) spl(1);
label("silk");  spl(vec(P.DX, P.DY, P.DZ), imm(0));
for (let i = 0; i < 3; i++) mov.i(postinc("silk"), apostinc("silk"));
add.a(imm(vec(P.EX, P.EY, P.EZ)), "seed");
mov.f("seed", "silk");
jmp("silk");
label("seed");  dat.f(imm(vec(P.DX, P.DY, P.DZ)), imm(0));
// ---- stone (Cubist), run by 2^STONE processes so the paper's many
// processes don't starve it; they share its pointer, which stays off our
// own row and layer whichever of them moves it ----
label("stone"); for (let i = 0; i < P.STONE; i++) spl(1);
label("layer"); mov.ab(imm(SIZEY / P.GY), "ycnt");
label("row");   mov.ab(imm(SIZEX / P.GX), "xcnt");
label("bomb");  mov.i("dat0", ind("ptr"));
add.ab(imm(P.GX), "ptr");
djn.b("bomb", "xcnt");
add.ab(imm(vec(0, P.GY, 0)), "ptr");
djn.b("row", "ycnt");
add.ab(imm(vec(0, 0, P.GZ)), "ptr");
jmp("layer");
label("ptr");   dat.f(0, vec(1, P.GY / 2, P.GZ / 2));
label("xcnt");  dat.f(0, 0);
label("ycnt");  dat.f(0, 0);
label("dat0");  dat.f(0, 0);
