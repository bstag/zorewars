// PROTOTYPE (not in the library; see README.md in this folder).
// Frogspawn, third design: no clear. A frog splits into two copies behind
// the front when its marker changes, and on a timer (WAIT) as well.
// Result: survives alone (about 610 processes) but loses to clears 2-18 and
// mostly ties papers. With WAIT 3000 or 7999 (a small swarm of 6-10 frogs):
// 0.69-0.71 points per round. Many frogs each get a sliver of the turns, so
// none reacts in time; few frogs have no attack.
//
// Frogspawn: Leapfrog as a paper. Each frog watches a marker up the path a
// clear's front comes along, as Leapfrog does, and splits when it changes:
// two copies behind the front (the second a layer further up), each with a
// process, and the old body is left with none, so a clear finds nothing
// there to stun. It also splits every so often on its own, so the frogs
// spread through the volume like a paper, stomping on each other now and
// then. Unlike Leapfrog it doesn't clear: every copy running a clear would
// mostly clear its siblings.
name("Frogspawn (timer)");
author("ZoreWars");
strategy("Leapfrog as a paper: splits into two copies behind a clear's front when it nears, and every so often anyway.");
if (SIZEZ < 2) throw new Error("Frogspawn is for a 3D battlefield: choose a Volume in Rules (CLI: --torus 40x20x10)");
//
// Tuned constants: `node cli/zorewars.js tune warriors/volume/frogspawn.js --torus 40x20x10`
// SPACE {"SENT":[1,4],"WAIT":[20,2000],"HOPX":[0,39],"HOPY":[2,9],"HOPZ":[0,4],"STX":[0,39],"STY":[0,9],"STZ":[1,4]}
const P = {"SENT":2,"WAIT":200,"HOPX":0,"HOPY":4,"HOPZ":0,"STX":13,"STY":2,"STZ":1};
const HOP = vec(P.HOPX, -P.HOPY, -P.HOPZ), STEER = vec(P.STX, -P.STY, -P.STZ);

org("first");
// src is the body's first cell: the copy runs until src points at itself.
label("src");   dat.f(0, 0);
label("dst");   dat.f(0, 0);
label("first"); mov.i("mark", ind("sentp"));                 // plant the marker
mov.ab(imm(P.WAIT), "wait");                                  // and start the clock
label("loop");  sne.i("mark", ind("sentp"));                  // marker changed? split now
label("wait");  djn.b("loop", imm(0));                        // otherwise split when the clock runs out
// Split: two copies (last cell first), each started with its own process.
mov.ab(imm(2), "reps");
label("again"); mov.ab(imm("last-src"), "src");
label("aim");   mov.ab(imm(`last-dst+${HOP}`), "dst");
label("copy");  mov.i(predec("src"), predec("dst"));
jmn.b("copy", "src");                                         // until src has copied itself
add.ab(imm("first-src"), "dst");                              // dst: the copy's first instruction
spl(ind("dst"));                                              // start it
add.ab(imm(STEER), "aim");                                    // the next copy lands elsewhere
label("reps");  djn.b("again", imm(0));
label("sentp"); dat.f(0, vec(0, -P.SENT, 0));                 // the marker's place (the old process ends on this DAT)
label("mark");  dat.f(0, 1);
equ("last", "(mark+1)");
