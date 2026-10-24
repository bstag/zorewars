// Evolved Silk, converted from Redcode by ZoreWars.
// Verified: compiles to exactly the same instructions as the original.

name("Evolved Silk");
author("ZoreWars Evolver");
strategy("A silk paper bred by \"zorewars evolve\" (Red Queen rounds of MAP-Elites)");
strategy("from slices of ZoreWars bots. Nobody wrote it: evolution rebuilt a");
strategy("classic silk, with a copy distance that changes on every pass.");

org(0);
// It came out of the evolver's archive cell for warriors that reach the
// 8000-process limit and execute 1000-3999 different cells. The comments were
// added afterwards; the instructions are exactly as evolved.

// Launcher: SPL 1 doubles the processes that run the following lines.
spl.b(dir(1), dir(0));
spl.b(dir(2), dir(0));                      // skips the next line for half of them
spl.b(dir(31), dir(0));                     // a leftover of evolution: starts a process in
// empty core, where it dies at once. Harmless.
spl.b(dir(1), dir(0));
spl.b(dir(1), dir(0));
spl.b(dir(1), dir(0));
// The silk: every process runs these lines in step, so each pass copies one
// cell per process to 1777 cells away and starts the copy running.
label("silk"); spl.b(dir(1777), imm(0));    // start a process at the copy
mov.i(postinc(-1), apostinc(-1));           // copy one cell of ourselves there
add.a(imm(1013), "seed");                   // next time, copy 1013 cells further away
mov.f("seed", "silk");                      // reset silk's pointers from the seed
jmp("silk");
label("seed"); dat.f(imm(1777), imm(0));
