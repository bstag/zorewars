// PROTOTYPE (not in the library): Frogspawn, second design. See README.md.
// The first design, with the clear running backwards towards the marker:
// each frog clears about two rows, trips its own marker and splits, so it
// spreads fast, leaving a cleared strip behind it.
// Result: still kills itself alone (the siblings' strips still hit each
// other), and loses to clears 1-19.
name("Frogspawn (back clear)");
author("ZoreWars");
strategy("Prototype: Leapfrog as a paper, every frog clearing backwards towards its marker.");
if (SIZEZ < 2) throw new Error("Frogspawn is for a 3D battlefield: choose a Volume in Rules (CLI: --torus 40x20x10)");
// SPACE {"SENT":[1,4],"HOPX":[0,39],"HOPY":[2,9],"HOPZ":[0,4],"STX":[0,39],"STY":[0,9],"STZ":[1,4]}
const P = {"SENT":2,"HOPX":0,"HOPY":4,"HOPZ":0,"STX":13,"STY":2,"STZ":1};
const HOP = vec(P.HOPX, -P.HOPY, -P.HOPZ), STEER = vec(P.STX, -P.STY, -P.STZ);

org("first");
// src is the body's first cell: the copy runs until src points at itself.
label("src");   dat.f(0, 0);
label("dst");   dat.f(0, 0);
label("first"); mov.i("mark", ind("sentp"));                 // plant the marker
mov.ab(imm("src-ptr"), "ptr");                                // our clear starts just before us, going up
label("loop");  mov.i("kill", predec("ptr"));                 // one cell of our clear, towards the marker
sne.i("mark", ind("sentp"));                                  // marker changed? then split
jmp("loop");
// Split: two copies (last cell first), each started with its own process.
mov.ab(imm(2), "kill");                                       // the kill bomb's B-field counts the copies
label("again"); mov.ab(imm("last-src"), "src");
label("aim");   mov.ab(imm(`last-dst+${HOP}`), "dst");
label("copy");  mov.i(predec("src"), predec("dst"));
jmn.b("copy", "src");                                         // until src has copied itself
add.ab(imm("first-src"), "dst");                              // dst: the copy's first instruction
spl(ind("dst"));                                              // start it
add.ab(imm(STEER), "aim");                                    // (moves aim's destination, as in Slant)
djn.b("again", "kill");
label("ptr");   dat.f(0, 0);                                  // (the old process ends here: a DAT)
label("sentp"); dat.f(0, vec(0, -P.SENT, 0));                 // the marker's place: SENT rows up
label("mark");  dat.f(0, 1);
label("kill");  dat.f(imm(0), imm(0));
equ("last", "(kill+1)");
