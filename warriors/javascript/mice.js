// Mice, converted from Redcode by ZoreWars.
// Verified: compiles to exactly the same instructions as the original.

name("Mice");
author("Chip Wendell (1986), adapted to ICWS'94 syntax");
strategy("A replicator (\"paper\"). Copies its 8 instructions to a new spot,");
strategy("starts a new process there with SPL, then repeats with a new");
strategy("destination. Copies spread through the core faster than most");
strategy("bombers can destroy them.");

org("start");
label("ptr"); dat.f(imm(0), imm(0));
label("start"); mov.ab(imm(12), "ptr");     // number of cells to copy
label("loop"); mov.i(ind("ptr"), predec("copy"));  // copy one cell, last to first
djn.b("loop", "ptr");
spl.b(ind("copy"), 0);                      // start the new copy running
add.ab(imm(653), "copy");                   // choose the next destination
jmz.b("start", "ptr");
label("copy"); dat.f(imm(0), imm(833));
