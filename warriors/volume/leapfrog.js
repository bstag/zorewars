// Leapfrog: an answer to core clears. A clear walks one front through every
// cell in turn (row by row, layer by layer) and can't be hidden from, but
// you can see it coming and it never moves. Leapfrog plants a marker a few
// rows "up" from itself, the side the front arrives from, and watches it.
// When the clear's first pass (SPL 0) or second pass (DAT 0,0) changes the
// marker, Leapfrog copies itself further up, behind the front, and carries on
// there: one process, so nothing is left behind for the clear to stun.
// Between looks it runs a slow clear of its own, forwards, which in time
// reaches the enemy clear's code (it stays where it started) and stops it.
// The marker also guards Leapfrog from its own clear: by the time that has
// gone round the volume it overwrites the marker, and Leapfrog leaps on and
// starts again.
name("Leapfrog");
author("ZoreWars");
strategy("Watches for a core clear's front, leaps behind it, and clears the volume itself in the meantime.");
if (SIZEZ < 2) throw new Error("Leapfrog is for a 3D battlefield: choose a Volume in Rules (CLI: --torus 40x20x10)");
//
// Tuned constants: `node cli/zorewars.js tune warriors/volume/leapfrog.js --torus 40x20x10`
// SPACE {"SENT":[1,4],"HOPY":[2,9],"HOPZ":[0,4]}
const P = {"SENT":2,"HOPY":4,"HOPZ":0};

org("first");
label("first"); mov.i("mark", ind("sentp"));                 // plant the marker
mov.ab(imm("last-ptr"), "ptr");                               // our clear starts just past us
label("loop");  mov.i("kill", postinc("ptr"));                // one cell of our clear
seq.i("mark", ind("sentp"));                                  // marker still there?
jmp("move");                                                  //   no: the front is near
jmp("loop");
// Leap: copy the whole body HOP away (last cell first) and run the copy.
label("move");  mov.ab(imm("last-src"), "src");
mov.ab(imm(`last-dst+${vec(0, -P.HOPY, -P.HOPZ)}`), "dst");
mov.ab(imm("last-first"), "cnt");
label("copy");  mov.i(predec("src"), predec("dst"));
djn.b("copy", "cnt");
jmp(ind("dst"));                                              // dst now points at the copy's first cell
label("src");   dat.f(0, 0);
label("dst");   dat.f(0, 0);
label("cnt");   dat.f(0, 0);
label("ptr");   dat.f(0, 0);
label("sentp"); dat.f(0, vec(0, -P.SENT, 0));                 // the marker's place: SENT rows up
label("mark");  dat.f(0, 1);
label("kill");  dat.f(imm(0), imm(0));
equ("last", "(kill+1)");
