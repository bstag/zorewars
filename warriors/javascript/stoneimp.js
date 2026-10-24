// Stone and Imp, converted from Redcode by ZoreWars.
// Verified: compiles to exactly the same instructions as the original.

name("Stone and Imp");
author("ZoreWars, after the stone/imp combinations of the 1990s");
strategy("Runs two warriors at once: a Dwarf-style stone and an Imp Ring.");
strategy("If the stone gets killed, the imps usually survive and force a tie.");

const istep = Math.trunc((CORESIZE + 1) / 3);  // imp ring spacing (2667)
equ("istep", istep);

org("start");
label("start"); spl("stone");               // one process becomes the stone
// Same launcher as Imp Ring: 4 processes, 3 of them sent to the ring points.
spl.b(1, 0);
spl.b(1, 0);
jmp.b(apostinc("tab"), 0);
label("tab"); dat.f(imm(1), imm(0));
jmp("imp");
jmp("imp+istep");
jmp("imp+2*istep");
dat.f(imm(0), imm(0));
label("imp"); mov.i(imm(0), istep);
// The stone: a Dwarf. It gets one turn in four, because it shares the
// warrior's turns with the three imps.
label("stone"); add.ab(imm(4), "bomb");
mov.i("bomb", ind("bomb"));
jmp("stone");
label("bomb"); dat.f(imm(0), imm(0));
