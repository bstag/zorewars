// Sweeper, converted from Redcode by ZoreWars.
// Verified: compiles to exactly the same instructions as the original.

name("Sweeper");
author("ZoreWars");
strategy("A core clear. It walks forward through the whole core writing DAT");
strategy("over every cell. When the sweep wraps around it lands on its own");
strategy("pointer, rewrites it forever, and stops before hitting its own code.");

org("start");
label("ptr"); dat.f(imm(0), imm(10));       // next cell to clear (relative to ptr)
label("start"); mov.i("bomb", postinc("ptr"));  // clear the cell, then advance the pointer
jmp("start");
label("bomb"); dat.f(imm(0), imm(0));
