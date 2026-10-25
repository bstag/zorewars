// Climber: moving up and down. Code only ever flows along a row, so the
// way to travel vertically is to copy yourself to another row and jump
// there. Climber copies its whole body DY rows down, then jumps into the
// copy, leaving its old body behind as a decoy. Each copy starts by setting
// its own pointers, because a copy is taken while the original is mid-count.
name("Climber");
author("ZoreWars");
strategy("Self-mover for the plane: copies itself DY rows down and jumps into the copy.");
//
// Tuned constants: `node cli/zorewars.js tune warriors/plane/climber.js --torus 100x80`
// SPACE {"DY":[1,79],"DX":[-20,20]}
const P = {"DY":45,"DX":19};
const DY = P.DY;
const HOP = vec(P.DX, DY);
if (SIZEY < 2) throw new Error("Climber is for a plane: choose a Plane battlefield in Rules (CLI: --torus 100x80)");

org("hop");
label("hop");  mov.ab(imm("last-src"), "src");                  // fresh pointers for this copy
mov.ab(imm(`last-dst+${HOP}`), "dst");
mov.ab(imm("last-hop"), "cnt");                                   // cells to copy
label("cp");   mov.i(predec("src"), predec("dst"));               // copy the body, last cell first
djn.b("cp", "cnt");
jmp(`hop+${HOP}`);                                                // continue in the copy, DY rows down
label("src");  dat.f(0, 0);
label("dst");  dat.f(0, 0);
label("cnt");  dat.f(0, 0);
equ("last", "(cnt+1)");
