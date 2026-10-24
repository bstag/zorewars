// Gemini, converted from Redcode by ZoreWars.
// Verified: compiles to exactly the same instructions as the original.

name("Gemini");
author("ZoreWars, after A. K. Dewdney (1984)");
strategy("A self-mover: copies its whole body 100 cells ahead, then jumps");
strategy("into the copy. It leaves a dead copy of itself behind as a decoy.");

const hop = 100;                            // how far each jump moves the program
equ("hop", hop);
equ("len", "(fin+1-ptr)");                  // program length, worked out by the assembler

org("copy");
// ptr holds two pointers, both relative to ptr itself:
// A-field = next cell to read, B-field = next cell to write.
label("ptr"); dat.f(imm(0), imm(hop));      // read from ptr+0, write to ptr+100
label("copy"); mov.i(apostinc("ptr"), postinc("ptr"));  // copy one cell, then add 1 to both pointers
seq.a(imm("len"), "ptr");                   // read pointer reached the end? skip the next line
jmp("copy");                                // not yet: copy the next cell
label("fin"); jmp("copy+hop");              // done: continue running inside the new copy
