// Dwarf, converted from Redcode by ZoreWars.
// Verified: compiles to exactly the same instructions as the original.

name("Dwarf");
author("A. K. Dewdney (1984)");
strategy("The classic \"stone\" (bomber). Drops a DAT bomb on every 4th cell.");
strategy("Any process that executes a DAT dies. A step of 4 divides the");
strategy("core size (8000) evenly, so the Dwarf never bombs its own code.");

const step = 4;

org("loop");
label("loop"); add.ab(imm(step), "bomb");   // move the target pointer forward
mov.i("bomb", ind("bomb"));                 // copy the bomb to where its B-field points
jmp("loop");
label("bomb"); dat.f(imm(0), imm(0));
