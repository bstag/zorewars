// Scatter: Slant as it was meant to work. Each process copies the whole body
// HOP away (across rows, columns and layers at once), starts a process in
// the copy, then turns HOP by STEER (ADD.A, the hop's own field), so every
// copy lands somewhere new. One process per copy; the copies scatter through
// the volume instead of lining up in chains as Slant's do. Its SPL and JMP
// also carry a free side effect (an idea from Mercenary on ModelWar): their
// spare operand decrements a far cell's B-field, and since every copy runs
// them from a new place, the decrements land all over the volume. Worth
// about +0.06 points per round (1.85 against 1.79 without, 5 seeds).
name("Scatter");
author("ZoreWars");
strategy("Diagonal replicator that scatters: every copy lands somewhere new across rows, columns and layers.");
if (SIZEZ < 2) throw new Error("Scatter is for a 3D battlefield: choose a Volume in Rules (CLI: --torus 40x20x10)");
//
// Tuned constants: `node cli/zorewars.js tune warriors/volume/scatter.js --torus 40x20x10`
// SPACE {"HX":[0,39],"HY":[1,19],"HZ":[1,9],"SX":[0,39],"SY":[0,19],"SZ":[0,9],"SIDE":[0,2],"FX":[0,39],"FY":[1,19],"FZ":[0,9]}
const P = {"HX":11,"HY":1,"HZ":7,"SX":11,"SY":5,"SZ":1,"SIDE":2,"FX":5,"FY":17,"FZ":5};
// Free side effect (from Mercenary on ModelWar): an instruction's unused operand
// can decrement a far cell for nothing. Every copy runs it from a new place.
const SIDE = (x) => (P.SIDE === 1 ? apredec(vec(P.FX, P.FY, P.FZ)) : P.SIDE === 2 ? predec(vec(P.FX, P.FY, P.FZ)) : x);
const HOP = vec(P.HX, P.HY, P.HZ), STEER = vec(P.SX, P.SY, P.SZ);

org("go");
label("go");  mov.ab(imm("last-src"), "src");                 // fresh pointers: a copy is taken mid-count
label("aim"); mov.ab(imm(`last-dst+${HOP}`), "dst");          // where this copy goes (its A-field is steered)
mov.ab(imm("last-go"), "cnt");
label("copy"); mov.i(predec("src"), predec("dst"));            // copy the body, last cell first
djn.b("copy", "cnt");
spl(ind("dst"), SIDE(0));                                               // start the copy at its first cell
add.a(imm(STEER), "aim");                                     // the next copy lands somewhere else
jmp("go", SIDE(0));
label("src"); dat.f(0, 0);
label("dst"); dat.f(0, 0);
label("cnt"); dat.f(0, 0);
equ("last", "(cnt+1)");
