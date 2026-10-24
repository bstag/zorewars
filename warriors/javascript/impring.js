// Imp Ring, converted from Redcode by ZoreWars.
// Verified: compiles to exactly the same instructions as the original.

name("Imp Ring");
author("ZoreWars, after the imp rings of the early 1990s");
strategy("Three imps spaced exactly a third of the core apart. Each one");
strategy("writes the cell the next one is about to run, so they move as a");
strategy("linked ring. Very hard to kill; mostly wins by turning enemy code");
strategy("into more imp.");

const step = Math.trunc((CORESIZE + 1) / 3);  // 2667: three steps = 8001, one cell past the start
equ("step", step);

org("start");
// Launcher: make 4 processes, then send them through a jump table so
// that exactly three arrive at the ring points, in order.
label("start"); spl.b(1, 0);                // 1 process becomes 2, both at the next line
spl.b(1, 0);                                // 2 become 4
jmp.b(apostinc("tab"), 0);                  // each process jumps to tab+1, tab+2, ... in turn
label("tab"); dat.f(imm(1), imm(0));        // A-field: next table entry (counts up)
jmp("imp");                                 // process 1 -> ring point 0
jmp("imp+step");                            // process 2 -> ring point 1 (empty for now)
jmp("imp+2*step");                          // process 3 -> ring point 2 (empty for now)
dat.f(imm(0), imm(0));                      // process 4 isn't needed and dies here
// Point 0 copies the imp to point 1 just before process 2 runs it, point 1
// copies to point 2, and point 2 copies to point 0 plus one cell.
label("imp"); mov.i(imm(0), step);          // copy myself one third of the core ahead
