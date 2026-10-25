// PROTOTYPE (not in the library; see README.md in this folder).
// Volume Queen's two-process clear plus a watcher that moves the whole
// clear behind another clear's front. 80x10x10. Result: ties nearly
// everything (0-4-16 against Volume Queen). The two clear processes share
// the first pass's DJN counter: after a move one leaves for the DAT pass
// and the other wraps it to -1 and keeps writing SPL 0, so the passes
// alternate cells and stunned enemies on the SPL cells never die.
//
// Dodging Queen: Volume Queen's clear with Leapfrog's lookout. Two processes
// run the two-pass clear (SPL 0 everywhere, then DAT everywhere); a third
// watches a marker a few rows up the path another clear's front would come
// along. When the marker changes, the watcher copies the whole warrior
// behind that front, kills the old clear (a DAT over each of its loops, so
// the old processes end instead of being stunned) and starts the copy. Its
// own clear trips the marker once a lap too, and it simply moves on.
name("Dodging Queen");
author("ZoreWars");
strategy("Two-process core clear with a lookout: when another clear's front nears, it moves the whole clear behind it.");
if (SIZEZ < 2) throw new Error("Dodging Queen is for a 3D battlefield: choose Volume 80×10×10 in Rules (CLI: --torus 80x10x10)");
//
// Tuned constants: `node cli/zorewars.js tune warriors/volume/dodgingqueen.js --torus 80x10x10`
// SPACE {"SENT":[1,3],"HOPY":[2,6],"HOPZ":[0,3]}
const P = {"SENT":2,"HOPY":4,"HOPZ":0};

label("ptr");   dat.f(imm(0), imm("len"));                   // the clear's pointer: it spares all of us
org("start");
label("start"); spl("watch");                                // a watcher...
spl(1);                                                      // ...and two processes for the clear
label("pass1"); mov.i("stun", postinc("ptr"));               // pass 1: SPL 0
djn.b("pass1", imm(`${CORESIZE}-len`));
mov.ab(imm("len"), "ptr");
label("clear"); mov.i("kill", postinc("ptr"));               // pass 2: DAT
jmp("clear");
label("watch"); mov.i("mark", ind("sentp"));                 // plant the marker
label("wl");    seq.i("mark", ind("sentp"));                 // still there?
jmp("move");
jmp("wl");
// Move: copy everything (last cell first) behind the front, end the old
// clear, and start the copy.
label("move");  mov.ab(imm("last-src"), "src");
mov.ab(imm(`last-dst+${vec(0, -P.HOPY, -P.HOPZ)}`), "dst");
mov.ab(imm("last-ptr"), "cnt");
label("copy");  mov.i(predec("src"), predec("dst"));
djn.b("copy", "cnt");
mov.i("kill", "pass1");                                      // the old clear's processes end here
mov.i("kill", "clear");
add.ab(imm("start-ptr"), "dst");                             // dst: the copy's start
jmp(ind("dst"));
label("stun");  spl.b(imm(0), imm(0));
label("kill");  dat.f(imm(0), imm(0));
label("src");   dat.f(0, 0);
label("dst");   dat.f(0, 0);
label("cnt");   dat.f(0, 0);
label("sentp"); dat.f(0, vec(0, -P.SENT, 0));
label("mark");  dat.f(0, 1);
equ("last", "(mark+1)");
equ("len", "(last-ptr)");
