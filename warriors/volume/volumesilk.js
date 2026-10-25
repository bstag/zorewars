// Volume Silk: the small silk paper of Fast Silk and Plane Silk, with copy
// distances in all three dimensions, so its copies fill the volume layer by
// layer rather than one plane.
name("Volume Silk");
author("ZoreWars");
strategy("Small silk paper whose copies jump across rows, columns and layers.");
if (SIZEZ < 2) throw new Error("Volume Silk is for a 3D battlefield: choose a Volume in Rules (CLI: --torus 40x20x10)");
//
// Tuned constants: `node cli/zorewars.js tune warriors/volume/volumesilk.js --torus 40x20x10`
// SPACE {"LEVELS":[1,3],"DX":[1,39],"DY":[0,19],"DZ":[1,9],"EX":[0,39],"EY":[0,19],"EZ":[0,9]}
const P = {"LEVELS":3,"DX":29,"DY":14,"DZ":3,"EX":21,"EY":16,"EZ":5};

org("start");
label("start");
for (let i = 0; i < P.LEVELS; i++) spl(1);
label("silk"); spl(vec(P.DX, P.DY, P.DZ), imm(0));    // start a process in the copy
for (let i = 0; i < 3; i++) mov.i(postinc("silk"), apostinc("silk"));   // copy three cells
add.a(imm(vec(P.EX, P.EY, P.EZ)), "seed");            // next copy: somewhere else in the volume
mov.f("seed", "silk");
jmp("silk");
label("seed"); dat.f(imm(vec(P.DX, P.DY, P.DZ)), imm(0));
