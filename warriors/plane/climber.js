// Climber: moving up and down. Code only ever flows along a row, so the
// way to travel vertically is to copy yourself to another row and jump
// there. Climber copies its whole body DY rows down, then jumps into the
// copy, leaving its old body behind as a decoy. Each copy starts by setting
// its own pointers, because a copy is taken while the original is mid-count.
name("Climber");
author("ZoreWars");
strategy("Self-mover for the plane: copies itself DY rows down and jumps into the copy.");
const DY = 7;
if (SIZEY < 2) throw new Error("Climber is for a plane: choose a Plane battlefield in Rules (CLI: --torus 100x80)");

org("hop");
label("hop");  mov.ab(imm("last-src"), "src");                  // fresh pointers for this copy
mov.ab(imm(`last-dst+${vec(0, DY)}`), "dst");
mov.ab(imm("last-hop"), "cnt");                                   // cells to copy
label("cp");   mov.i(predec("src"), predec("dst"));               // copy the body, last cell first
djn.b("cp", "cnt");
jmp(`hop+${vec(0, DY)}`);                                         // continue in the copy, DY rows down
label("src");  dat.f(0, 0);
label("dst");  dat.f(0, 0);
label("cnt");  dat.f(0, 0);
equ("last", "(cnt+1)");
