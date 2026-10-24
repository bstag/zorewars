// One-Shot, converted from Redcode by ZoreWars.
// Verified: compiles to exactly the same instructions as the original.

name("One-Shot");
author("ZoreWars, after one-shots such as Frontwards and Myrmidon");
strategy("Scans until it finds the enemy once, then never scans again: it");
strategy("stuns everything from just before the hit to the end of the core");
strategy("with SPL 0, then goes over the same stretch again with DAT.");

const step = 12;                            // scan step
equ("step", step);
const gap = 6;                              // distance between the two cells compared
equ("gap", gap);
equ("count", "(CORESIZE-2-gap-(last-scan))/step");  // scans before we'd see ourselves
equ("last", "(dat0+1)");                    // one past our final instruction (pMARS drops labels after the last line)

org("loop");
label("cptr"); dat.f(imm(0), imm(0));       // clear pointer, relative to cptr
label("loop"); add.f("inc", "scan");        // move both scan pointers forward
label("scan"); seq.i("last-scan-step", "last-scan-step+gap");  // two cells identical?
jmp("found");                               // no: that's the enemy
djn.b("loop", "cnt");                       // yes: keep scanning, unless we've done a lap
mov.ab(imm("last-cptr"), "cptr");           // nothing found: clear from just after our code
jmp("go");
label("found"); mov.ab("scan", "cptr");     // aim the clear at the hit (scan's A-field) ...
add.ab(imm("scan-cptr-8"), "cptr");         // ... converted to be relative to cptr, minus 8
label("go"); mov.b("cptr", "start");        // remember where the clear began (B-field to B-field)
label("stun"); mov.i("spl0", postinc("cptr"));  // pass 1: SPL 0 on each cell, then move on
jmn.b("stun", "cptr");                      // until the pointer wraps round to cptr itself
mov.b("start", "cptr");                     // rewind to where we began
label("kill"); mov.i("dat0", postinc("cptr"));  // pass 2: DAT on each cell
jmp("kill");                                // ends by rewriting cptr forever, never reaching us
label("inc"); dat.f(imm(step), imm(step));
label("cnt"); dat.f(imm(0), imm("count"));
label("start"); dat.f(imm(0), imm(0));
label("spl0"); spl.b(imm(0), imm(0));
label("dat0"); dat.f(imm(0), imm(0));
