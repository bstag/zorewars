// Slant: a replicator that cuts diagonally through the volume. Each process
// copies the whole body HOP away (across rows, columns and layers at once)
// and starts a process in the copy. What happens next is not what it was
// written to do, and works better: the ADD.AB meant to steer HOP adds to the
// B-field of the aim line, which is its destination, not its A-field (the
// hop). So from the second pass on, the aim line writes the hop value into a
// cell further along a diagonal each time (garbling whatever field it lands
// on), and dst keeps pointing at the last copy, so each later copy lands
// right behind the one before. Every process lays a chain of copies, one
// body length apart, from its first diagonal hop, and walks a diagonal of
// stray writes. Measured: 1.84 points per round against the volume field as
// written, 1.76 with ADD.A (the steering it was meant to have, untuned).
name("Slant");
author("ZoreWars");
strategy("Diagonal replicator: hops across rows, columns and layers, then lays a chain of copies, scribbling along a diagonal.");
if (SIZEZ < 2) throw new Error("Slant is for a 3D battlefield: choose a Volume in Rules (CLI: --torus 40x20x10)");
//
// Tuned constants: `node cli/zorewars.js tune warriors/volume/slant.js --torus 40x20x10`
// SPACE {"HX":[0,39],"HY":[1,19],"HZ":[1,9],"SX":[0,39],"SY":[0,19],"SZ":[0,9]}
const P = {"HX":7,"HY":5,"HZ":3,"SX":11,"SY":3,"SZ":1};
const HOP = vec(P.HX, P.HY, P.HZ), STEER = vec(P.SX, P.SY, P.SZ);

org("go");
label("go");  mov.ab(imm("last-src"), "src");                 // fresh pointers: a copy is taken mid-count
label("aim"); mov.ab(imm(`last-dst+${HOP}`), "dst");          // where this copy goes (its B-field is what gets steered)
mov.ab(imm("last-go"), "cnt");
label("copy"); mov.i(predec("src"), predec("dst"));            // copy the body, last cell first
djn.b("copy", "cnt");
spl(ind("dst"));                                               // start the copy at its first cell
add.ab(imm(STEER), "aim");                                     // moves aim's destination along a diagonal (see the top)
jmp("go");
label("src"); dat.f(0, 0);
label("dst"); dat.f(0, 0);
label("cnt"); dat.f(0, 0);
equ("last", "(cnt+1)");
