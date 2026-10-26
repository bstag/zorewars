// Broadside: a small silk paper whose copies bomb as they go. Each pass
// copies the body somewhere new (three cells per process, like Fast Silk)
// and drops one bomb along a diagonal from where that copy is. Every copy
// carries its own bomb line, so many copies fire side by side, in different
// rows and layers of the volume, along parallel diagonals.
name("Broadside");
author("ZoreWars");
strategy("Silk paper whose every copy bombs along a diagonal: many bombing lines side by side through the volume.");
if (SIZEZ < 2) throw new Error("Broadside is for a 3D battlefield: choose a Volume in Rules (CLI: --torus 40x20x10)");
//
// Tuned constants: `node cli/zorewars.js tune warriors/volume/broadside.js --torus 40x20x10`
// SPACE {"LEVELS":[2,3],"DX":[1,39],"DY":[0,19],"DZ":[1,9],"EX":[0,39],"EY":[0,19],"EZ":[0,9],"BX":[1,39],"BY":[0,19],"BZ":[0,9],"SIDE":[0,2],"FX":[0,39],"FY":[1,19],"FZ":[0,9]}
const P = {"LEVELS":3,"DX":23,"DY":7,"DZ":5,"EX":32,"EY":8,"EZ":6,"BX":17,"BY":14,"BZ":9,"SIDE":0,"FX":13,"FY":5,"FZ":3};
// Free side effect (from Mercenary on ModelWar): an instruction's unused operand
// can decrement a far cell for nothing. Every copy runs it from a new place.
const SIDE = (x) => (P.SIDE === 1 ? apredec(vec(P.FX, P.FY, P.FZ)) : P.SIDE === 2 ? predec(vec(P.FX, P.FY, P.FZ)) : x);

org("start");
label("start");
for (let i = 0; i < P.LEVELS; i++) spl(1);
label("silk"); spl(vec(P.DX, P.DY, P.DZ), imm(0));    // start a process in the copy
for (let i = 0; i < 3; i++) mov.i(postinc("silk"), apostinc("silk"));   // copy three cells
mov.i("seed", ind("hit"));                             // bomb (the seed is a DAT)...
add.ab(imm(vec(P.BX, P.BY, P.BZ)), "hit");             // ...one diagonal step further each pass
add.a(imm(vec(P.EX, P.EY, P.EZ)), "seed");             // next copy: somewhere else in the volume
mov.f("seed", "silk");
jmp("silk", SIDE(0));                                  // (its spare operand: see SIDE)
label("seed"); dat.f(imm(vec(P.DX, P.DY, P.DZ)), imm(0));
label("hit");  dat.f(0, vec(P.BX, P.BY + 1, P.BZ + 1)); // first bomb: off our row and layer
if ((2 ** P.LEVELS) * 3 < curline() - P.LEVELS) throw new Error('too few processes to copy the body in one pass');
