// Plane Silk: Fast Silk with two-dimensional copy distances. Each pass copies
// the body to a spot DX cells across and DY rows down, and the distance
// changes by (EX, EY) every pass, so the copies spread over the whole plane
// rather than along one stripe.
name("Plane Silk");
author("ZoreWars");
strategy("Small silk paper whose copies jump across rows as well as along them.");
const LEVELS = 2, DX = 37, DY = 23, EX = 17, EY = 29;
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
