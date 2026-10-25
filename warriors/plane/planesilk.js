// Plane Silk: Fast Silk with two-dimensional copy distances. Each pass copies
// the body to a spot DX cells across and DY rows down, and the distance
// changes by (EX, EY) every pass, so the copies spread over the whole plane
// rather than along one stripe.
name("Plane Silk");
author("ZoreWars");
strategy("Small silk paper whose copies jump across rows as well as along them.");
//
// Tuned constants: `node cli/zorewars.js tune warriors/plane/planesilk.js --torus 100x80`
// SPACE {"LEVELS":[1,3],"DX":[1,99],"DY":[1,79],"EX":[1,99],"EY":[0,79]}
const P = {"LEVELS":3,"DX":10,"DY":67,"EX":30,"EY":42};
const { LEVELS, DX, DY, EX, EY } = P;
if (SIZEY < 2) throw new Error("Plane Silk is for a plane: choose a Plane battlefield in Rules (CLI: --torus 100x80)");

org("start");
label("start");
for (let i = 0; i < LEVELS; i++) spl(1);
label("silk"); spl(vec(DX, DY), imm(0));             // start a process in the copy
for (let i = 0; i < 3; i++) mov.i(postinc("silk"), apostinc("silk"));   // copy three cells
add.a(imm(vec(EX, EY)), "seed");                      // next copy: a new place on the plane
mov.f("seed", "silk");
jmp("silk");
label("seed"); dat.f(imm(vec(DX, DY)), imm(0));
