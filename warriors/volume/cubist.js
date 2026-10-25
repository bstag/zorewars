// Cubist: a stone for the volume. Plaid's lattice stays in its own layer,
// because its loops never move along z; Cubist adds a third loop, so it
// bombs a lattice through the whole volume: every GX cells along a row,
// every GY rows down, every GZ layers in. Its bombs land half a lattice step
// below its own row and half a step into the volume from its own layer, so
// it never hits itself.
name("Cubist");
author("ZoreWars");
strategy("3D stone: bombs a lattice through the whole volume, row by row, then layer by layer.");
if (SIZEZ < 2) throw new Error("Cubist is for a 3D battlefield: choose a Volume in Rules (CLI: --torus 40x20x10)");
//
// Tuned constants: `node cli/zorewars.js tune warriors/volume/cubist.js --torus 40x20x10`
// SPACE {"GX":[2,4,5,8,10],"GY":[2,4,10],"GZ":[2,10]}
const P = {"GX":4,"GY":4,"GZ":2};
// Each spacing must divide its axis (so a loop ends where it started) and
// be even along y and z (so "half a step" is a whole row or layer).
if (SIZEX % P.GX || SIZEY % P.GY || SIZEZ % P.GZ || P.GY % 2 || P.GZ % 2) {
  throw new Error(`a ${P.GX}x${P.GY}x${P.GZ} lattice doesn't fit a ${SIZEX}x${SIZEY}x${SIZEZ} volume`);
}

org("layer");
label("layer"); mov.ab(imm(SIZEY / P.GY), "ycnt");           // rows per lattice layer
label("row");   mov.ab(imm(SIZEX / P.GX), "xcnt");           // bombs per lattice row
label("bomb");  mov.i("dat0", ind("ptr"));
add.ab(imm(P.GX), "ptr");                                    // along the row
djn.b("bomb", "xcnt");
add.ab(imm(vec(0, P.GY, 0)), "ptr");                         // next lattice row (x is back where it began)
djn.b("row", "ycnt");
add.ab(imm(vec(0, 0, P.GZ)), "ptr");                         // next lattice layer (y is back too)
jmp("layer");
label("ptr");  dat.f(0, vec(1, P.GY / 2, P.GZ / 2));         // first bomb: off our row and our layer
label("xcnt"); dat.f(0, 0);
label("ycnt"); dat.f(0, 0);
label("dat0"); dat.f(0, 0);
