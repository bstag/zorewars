// Seeker, converted from Redcode by ZoreWars.
// Verified: compiles to exactly the same instructions as the original.

name("Seeker");
author("ZoreWars");
strategy("A SEQ scanner with a core clear. It compares two cells 6 apart;");
strategy("anything other than a matching pair of empty cells means an enemy");
strategy("is near, and both cells get an SPL 0 \"stun\" bomb. After one lap of");
strategy("the core it sweeps everything with DAT to finish stunned enemies.");

const step = 12;                            // how far the scan moves each time
equ("step", step);
const gap = 6;                              // distance between the two cells compared
equ("gap", gap);
equ("count", "(CORESIZE-2-gap-(last-scan))/step");  // scans before we'd see ourselves
equ("last", "(kill+1)");                    // one past our final instruction (pMARS drops labels after the last line)

org("loop");
label("cptr"); dat.f(imm(0), imm("last-cptr"));  // clear pointer: starts just after our code
label("loop"); add.f("inc", "scan");        // move both scan pointers forward by step
label("scan"); seq.i("last-scan-step", "last-scan-step+gap");  // two cells identical?
jmp("hit");                                 // no: something is there
label("next"); djn.b("loop", "cnt");        // yes (empty): keep scanning until done
label("clear"); mov.i("kill", postinc("cptr"));  // scan over: write DAT on every cell after us
jmp("clear");
label("hit"); mov.i("stun", aind("scan"));  // stun-bomb the first cell compared
mov.i("stun", ind("scan"));                 // and the second
jmp("next");
label("inc"); dat.f(imm(step), imm(step));  // added to both of scan's fields
label("cnt"); dat.f(imm(0), imm("count"));  // scans left
label("stun"); spl.b(imm(0), imm(0));       // an enemy running this splits forever, uselessly
label("kill"); dat.f(imm(0), imm(0));
