// Silk, converted from Redcode by ZoreWars.
// Verified: compiles to exactly the same instructions as the original.

name("Silk");
author("ZoreWars, after the \"silk\" papers of the mid-1990s");
strategy("A fast replicator. Eight processes run the same code in lockstep:");
strategy("each one copies one cell of the program and starts a process in the");
strategy("new copy, so a whole copy is made in a single pass. Every copy");
strategy("repeats this, so the number of copies doubles again and again.");

const step = 1777;                          // distance to the first copy
const delta = 1013;                         // how much the distance changes each time

org("start");
label("start"); spl(1);                     // 1 process -> 2
spl(1);                                     // 2 -> 4
spl(1);                                     // 4 -> 8, all lined up at 'silk'
// silk's A-field is where the copy goes; its B-field is the next cell to read.
label("silk"); spl(step, imm(0));           // each of the 8 processes starts one in the copy
mov.i(postinc("silk"), apostinc("silk"));   // each copies one cell: 8 processes, 8 cells
add.a(imm(delta), "seed");                  // choose a new distance for the next copy
mov.f("seed", "silk");                      // reset both pointers for the next pass
jmp("silk");                                // and replicate again
label("seed"); dat.f(imm(step), imm(0));    // A: next copy distance, B: read from cell 0
