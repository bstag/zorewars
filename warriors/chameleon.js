// Chameleon: a P-space switcher. P-space keeps one number per warrior between
// the rounds of a match. Chameleon stores which strategy it played; after a
// round it lost, it plays the other one: a bombing silk paper (Papercut) or a
// compare scanner with a clear (Gatekeeper). Paper beats bombers, scanners beat
// paper, so against any single opponent it settles on whichever wins.
//
// Tuned constants. `zorewars tune` searches the SPACE below for better values:
//   node cli/zorewars.js tune warriors/chameleon.js
// SPACE {"KEY":[1,499],"START":[0,1],"TIES":[0,1]}
const P = {"KEY":223,"START":1,"TIES":0};
name("Chameleon");
author("ZoreWars");
strategy("P-space switcher: plays paper or a scanner, and switches after losing a round.");

const PAPER = { LEVELS: 4, STEP: 3479, DELTA: 5722, BOMB: 462, BDELTA: 3579 };
const GK = { STEP: 24, GAP: 8, CARPET: 22, BACK: 6 };

// ---- the scanner (Gatekeeper), first, so its clear starts past everything ----
equ("last", "(stun+1)");
equ("count", `(CORESIZE-(last-gate)-${GK.GAP}-${GK.STEP})/${GK.STEP}`);
label("gate"); dat.f(imm(0), imm(0));
label("cptr"); dat.f(imm(0), imm(0));
label("loop"); add.f("inc", "scan");
label("scan"); seq.i("last-scan", `last-scan+${GK.GAP}`);
jmp("hit");
label("next"); djn.b("loop", "cnt");
mov.ab(imm("last-cptr"), "cptr");
label("clr1"); mov.i("stun", postinc("cptr"));
jmn.b("clr1", "cptr");
mov.ab(imm("last-cptr"), "cptr");
label("clr2"); mov.i("seed", postinc("cptr"));        // seed is a DAT
jmp("clr2", predec("gate"));
label("hit");  mov.ab("scan", "bptr");
add.ab(imm(`scan-bptr-${GK.BACK}`), "bptr");
mov.ab(imm(GK.CARPET), "ccnt");
label("cl");   mov.i("stun", postinc("bptr"));
djn.b("cl", "ccnt");
jmp("next");
label("inc");  dat.f(imm(GK.STEP), imm(GK.STEP));
label("cnt");  dat.f(imm(0), imm("count"));
label("bptr"); dat.f(imm(0), imm(0));
label("ccnt"); dat.f(imm(0), imm(0));

// ---- the switch: read last round's result and our last strategy ----
org("think");
label("think"); ldp.ab(imm(0), "res");                // P-space 0: 0 if we lost the last round
ldp.ab(imm(P.KEY), "mode");                           // the strategy we played
// Keep the strategy after a win (result 1: sole survivor); with TIES=0, ties
// keep it too. Otherwise switch.
P.TIES ? seq.ab(imm(1), "res") : jmn.b("keep", "res");
P.TIES ? jmp("keep") : nop(0);
add.ab(imm(1), "mode");                               // lost: switch
label("keep"); mod.ab(imm(2), "mode");
stp.b("mode", imm(P.KEY));                            // remember for next round
P.START ? jmn.b("silkgo", "mode") : jmz.b("silkgo", "mode");
jmp("loop");                                          // the other value: scanner
label("res");  dat.f(imm(0), imm(0));
label("mode"); dat.f(imm(0), imm(0));

// ---- the paper (Papercut) ----
label("silkgo");
for (let i = 0; i < PAPER.LEVELS; i++) spl(1);
label("silk"); spl(PAPER.STEP, imm(0));
mov.i(postinc("silk"), apostinc("silk"));
mov.i("seed", postinc("carpet"));
add.a(imm(PAPER.DELTA), "seed");
add.ab(imm(PAPER.BDELTA), "carpet");
mov.f("seed", "silk");
jmp("silk");
label("seed"); dat.f(imm(PAPER.STEP), imm(0));
label("carpet"); dat.f(imm(0), imm(PAPER.BOMB));
label("stun"); spl.b(imm(0), imm(0));
