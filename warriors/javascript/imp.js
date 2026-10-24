// Imp, converted from Redcode by ZoreWars.
// Verified: compiles to exactly the same instructions as the original.

name("Imp");
author("A. K. Dewdney (1984)");
strategy("The smallest program that never dies. It copies itself one cell");
strategy("forward, then executes that copy, crawling around the core forever.");
strategy("It rarely wins, but it is very hard to kill, so it forces ties.");

mov.i(dir(0), dir(1));                      // copy this cell to the next one, then run the next one
