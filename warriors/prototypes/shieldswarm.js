// PROTOTYPE (not in the library; see README.md in this folder).
// Shield Swarm: Scanner Swarm with Leapfrog's lookout in every copy. Each
// copy digs (JMZ.F on a counting pointer), recognises its siblings (their
// A-fields match its own cell at the same x, as in scannerswarm.js) and
// bombs the rest with a short row salvo. It looks at its marker, two rows up
// the path a clear's front comes along, whenever its scan finds something:
// a clear's front leaves a trail of SPL 0 behind it, so the scan keeps
// finding trail cells, and looking, as the front approaches. When the marker
// has changed the copy leaps: one routine copies the body and starts the
// copy, launching the swarm at the start (COPIES+1 copies, then the
// original ends) and leaping behind a front later (one copy four rows up,
// then the old one ends). 80x10x10.
// Result: 1.64 (Scanner Swarm 1.52, Battleship 1.50). Beats Battleship 19-1,
// Leapfrog 20-0, Dwarf and Imp; mostly ties papers (Papercut 1-5-14, Mice
// 2-9-9). The shield hardly helps against clears (7-13 against Volume Queen,
// 6-14 against Two-Pass Clear): each copy has a quarter of the turns and
// must see the front itself, so most are stunned before they leap.
name("Shield Swarm");
author("ZoreWars");
strategy("Prototype: four scanners that recognise each other, bomb everything else, and leap behind a clear's front.");
if (SIZEZ < 2) throw new Error("Shield Swarm is for a 3D battlefield: choose Volume 80×10×10 in Rules (CLI: --torus 80x10x10)");
//
// SPACE {"COPIES":[1,4],"SALVO":[1,3],"SENT":[1,3],"LEAPY":[3,6],"HY":[1,9],"HZ":[1,9],"SY":[0,9],"SZ":[1,9]}
const P = {"COPIES":3,"SALVO":3,"SENT":2,"LEAPY":4,"HY":3,"HZ":3,"SY":3,"SZ":3};

label("init");  mov.i("mark", ind("sentp"));                // plant the marker
label("dig");   jmz.f("dig", postinc("ptr"));                // empty: next cell
seq.i("mark", ind("sentp"));                                 // found something: marker still there?
jmp("leap");                                                 //   no: a front is near
mov.b("ptr", "chk");                                         // chk sits just before ptr: @chk is the find
mov.ba("ptr", "chk");                                        // and in its A-field...
mul.a(imm(vec(1, 0, 0)), "chk");                             // ...only the x part: *chk is our cell at the find's x
sne.a(aind("chk"), ind("chk"));                              // the same A-field? one of us
jmp("dig");                                                  //   yes: leave it
mov.b("ptr", "shot");                                        // shot sits just after ptr
add.ab(imm(-2 - Math.floor(P.SALVO / 2)), "shot");           // a short row salvo around the find
for (let i = 0; i < P.SALVO; i++) mov.i("bomb", postinc("shot"));
jmp("dig");
// Leap: one copy four rows up (behind the front), then this one ends.
label("leap");  mov.ab(imm(1), "left");
mov.ab(imm(vec(0, -P.LEAPY, 0)), "hop");
// Spawn: copy the body `left` times to `hop` (steered each time), start
// each copy, then end.
label("spawn"); mov.ab(imm("last-src"), "src");
mov.ab(imm("last-dst"), "dst");
add.b("hop", "dst");
mov.ab(imm("last-init"), "cnt");
label("copy");  mov.i(predec("src"), predec("dst"));
djn.b("copy", "cnt");
spl(ind("dst"));                                             // dst points at the copy's first cell
add.ab(imm(vec(0, P.SY, P.SZ)), "hop");                      // the next copy goes elsewhere (same x)
djn.b("spawn", "left");
// (on into the data below: this process ends)
label("src");   dat.f(0, 0);
label("dst");   dat.f(0, 0);
label("cnt");   dat.f(0, 0);
label("left");  dat.f(0, 0);
label("hop");   dat.f(0, 0);
label("sentp"); dat.f(0, vec(0, -P.SENT, 0));
label("mark");  dat.f(0, 1);
label("chk");   dat.f(0, 0);
label("ptr");   dat.f(0, 2 * SIZEX);                           // dig from two rows on (copies carry on from here)
label("shot");  dat.f(0, 0);
label("bomb");  dat.f(imm(0), imm(0));
// The original launches the swarm: COPIES+1 copies, then ends.
org("launch");
label("launch"); mov.ab(imm(P.COPIES + 1), "left");
mov.ab(imm(vec(0, P.HY, P.HZ)), "hop");
jmp("spawn");
equ("last", "(launch)");
