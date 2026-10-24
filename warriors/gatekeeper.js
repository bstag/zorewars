// Gatekeeper: a compare scanner. It compares two cells GAP apart; when they
// differ, it drops a carpet of CARPET SPL 0 "stun" bombs starting BACK cells
// before the first one. After one lap it clears the whole core twice (SPL,
// then DAT), and the final loop keeps decrementing an imp gate in front of it.
//
// Tuned constants. `zorewars tune` searches the SPACE below for better values:
//   node cli/zorewars.js tune warriors/gatekeeper.js
// SPACE {"STEP":[4,40],"GAP":[2,20],"CARPET":[4,24],"BACK":[0,8]}
const P = {"STEP":24,"GAP":8,"CARPET":22,"BACK":6};
name("Gatekeeper");
author("ZoreWars");
strategy("Compare scanner: stun a block around every find, then a two-pass SPL/DAT clear with an imp gate.");

// The assembler works out lengths from labels: "last" is one past the end.
equ("last", "(dat0+1)");
equ("count", `(CORESIZE-(last-gate)-${P.GAP}-${P.STEP})/${P.STEP}`);

org("loop");
label("gate"); dat.f(imm(0), imm(0));                   // imp gate: decremented by the clear
label("cptr"); dat.f(imm(0), imm(0));                   // clear pointer, relative to cptr
label("loop"); add.f("inc", "scan");                    // move both probes forward
label("scan"); seq.i(`last-scan`, `last-scan+${P.GAP}`);  // two cells identical? (starts just past us)
jmp("hit");                                             //   no: something is there
label("next"); djn.b("loop", "cnt");                    //   yes: keep scanning until a lap is done
mov.ab(imm("last-cptr"), "cptr");                       // scan over: clear from just past our code
label("stun"); mov.i("spl0", postinc("cptr"));          // pass 1: SPL 0 everywhere
jmn.b("stun", "cptr");                                  // until the pointer wraps round to cptr
mov.ab(imm("last-cptr"), "cptr");
label("kill"); mov.i("dat0", postinc("cptr"));          // pass 2: DAT everywhere
jmp("kill", predec("gate"));                            // ...and decrement the imp gate each time
label("hit");  mov.ab("scan", "bptr");                  // aim the carpet at the first probe...
add.ab(imm(`scan-bptr-${P.BACK}`), "bptr");             // ...relative to bptr, BACK cells early
mov.ab(imm(P.CARPET), "ccnt");
label("cl");   mov.i("spl0", postinc("bptr"));          // carpet of stun bombs
djn.b("cl", "ccnt");
jmp("next");
label("inc");  dat.f(imm(P.STEP), imm(P.STEP));
label("cnt");  dat.f(imm(0), imm("count"));
label("bptr"); dat.f(imm(0), imm(0));
label("ccnt"); dat.f(imm(0), imm(0));
label("spl0"); spl.b(imm(0), imm(0));
label("dat0"); dat.f(imm(0), imm(0));
