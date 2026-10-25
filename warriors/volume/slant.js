// Slant: a replicator that cuts diagonally through the volume. It copies its
// whole body HOP away (across rows, columns and layers at once), starts a
// process in the copy, then nudges HOP by STEER, so the next copy lands
// somewhere else. Every copy does the same, one process per copy, so the
// copies spread through the volume along slanting lines.
name("Slant");
author("ZoreWars");
strategy("Diagonal replicator: copies itself across rows, columns and layers at once, one process per copy.");
if (SIZEZ < 2) throw new Error("Slant is for a 3D battlefield: choose a Volume in Rules (CLI: --torus 40x20x10)");
//
// Tuned constants: `node cli/zorewars.js tune warriors/volume/slant.js --torus 40x20x10`
// SPACE {"HX":[0,39],"HY":[1,19],"HZ":[1,9],"SX":[0,39],"SY":[0,19],"SZ":[0,9]}
const P = {"HX":7,"HY":5,"HZ":3,"SX":11,"SY":3,"SZ":1};
const HOP = vec(P.HX, P.HY, P.HZ), STEER = vec(P.SX, P.SY, P.SZ);

org("go");
label("go");  mov.ab(imm("last-src"), "src");                 // fresh pointers: a copy is taken mid-count
label("aim"); mov.ab(imm(`last-dst+${HOP}`), "dst");          // where this copy goes (its A-field is steered)
mov.ab(imm("last-go"), "cnt");
label("copy"); mov.i(predec("src"), predec("dst"));            // copy the body, last cell first
djn.b("copy", "cnt");
spl(ind("dst"));                                               // start the copy at its first cell
add.ab(imm(STEER), "aim");                                     // the next copy lands somewhere else
jmp("go");
label("src"); dat.f(0, 0);
label("dst"); dat.f(0, 0);
label("cnt"); dat.f(0, 0);
equ("last", "(cnt+1)");
