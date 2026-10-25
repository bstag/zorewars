// PROTOTYPE (not in the library; see README.md in this folder).
// Leapfrog with markers on four sides (rows and layers above and below),
// checked in pairs. 80x10x10. Result: worse than Leapfrog against clears
// (12-4-4 against Volume Queen, Leapfrog 18-2), Battleship (6-14 vs 16-4)
// and Imp, and no better against papers. Bombs and copies land without
// crossing a marker first, and each extra check slows the watch and the
// clear.
//
// Sentry: Leapfrog with shield cells all round. Four marker cells (rows
// above and below, the layers above and below) are checked two at a time:
// SEQ compares the pair to each other, so a change to either one trips it.
// Its own clear writes the marker's value, so its sweep never sets it off;
// a counter stops the sweep before it reaches its own code.
name("Sentry");
author("ZoreWars");
strategy("Leapfrog with shield cells on four sides: leaps when anything touches one.");
if (SIZEZ < 2) throw new Error("Sentry is for a 3D battlefield: choose Volume 80x10x10 in Rules (CLI: --torus 80x10x10)");
// SPACE {"SENT":[1,3],"HOPY":[2,5],"HOPZ":[0,3]}
const P = {"SENT":2,"HOPY":4,"HOPZ":0};

org("first");
label("first"); mov.i("mark", aind("pa"));                   // plant the four markers
mov.i("mark", ind("pa"));
mov.i("mark", aind("pb"));
mov.i("mark", ind("pb"));
mov.ab(imm("last-ptr"), "ptr");                               // our clear starts just past us
mov.ab(imm(`${CORESIZE}-2*(last-first)`), "left");            // and stops short of us
label("loop");  seq.i(aind("pa"), ind("pa"));                 // pair 1 untouched?
jmp("move");
seq.i(aind("pb"), ind("pb"));                                 // pair 2 untouched?
jmp("move");
jmz.b("loop", "left");                                        // our clear done: just watch
label("left");  djn.b("hit", imm(0));                         // clear cells left?
jmp("loop");                                                  //   none: just watch
label("hit");   mov.i("mark", postinc("ptr"));                // one cell of our clear (a DAT like our markers)
jmp("loop");
label("move");  mov.ab(imm("last-src"), "src");
mov.ab(imm(`last-dst+${vec(0, -P.HOPY, -P.HOPZ)}`), "dst");
mov.ab(imm("last-first"), "cnt");
label("copy");  mov.i(predec("src"), predec("dst"));
djn.b("copy", "cnt");
jmp(ind("dst"));
label("src");   dat.f(0, 0);
label("dst");   dat.f(0, 0);
label("cnt");   dat.f(0, 0);
label("ptr");   dat.f(0, 0);
label("pa");    dat.f(vec(0, -P.SENT, 0), vec(0, P.SENT, 0));   // rows above and below
label("pb");    dat.f(vec(0, 0, -1), vec(0, 0, 1));             // layers above and below
label("mark");  dat.f(0, 1);
equ("last", "(mark+1)");
