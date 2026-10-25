// Adapter: Leapfrog whose marker is a sensor. When the marker changes it
// looks at what changed it. An instruction whose fields are both zero (a
// clear's SPL 0 or DAT 0, or a bomb) means a clear's front or a bomber:
// leap, as Leapfrog does. Anything with non-zero fields is copied code (a
// paper, or an imp): switch to Volume Queen's two-process SPL 0 / DAT clear
// on the spot, the one thing that holds papers here and beats imps. It
// remembers what it saw in P-space and opens the next round with the answer:
// a clear or a bomber seen (or nothing yet): Leapfrog; a paper seen: the
// clear. (Opening with Leapfrog after every loss, to look again, scored
// worse: 2.02 against 2.21. Against a paper that is the losing choice.)
// A leap copies the whole program, so the clear goes along.
name("Adapter");
author("ZoreWars");
strategy("Leapfrog whose marker is a sensor: leaps from a clear's front, turns into a clear when a paper touches it, and remembers.");
if (SIZEZ < 2) throw new Error("Adapter is for a 3D battlefield: choose Volume 80×10×10 in Rules (CLI: --torus 80x10x10)");
//
// Tuned constants: `node cli/zorewars.js tune warriors/volume/adapter.js --torus 80x10x10`
// SPACE {"KEY":[1,499],"SENT":[1,3],"HOPY":[2,6],"HOPZ":[0,3]}
const P = {"KEY":211,"SENT":2,"HOPY":4,"HOPZ":0};

// ---- the clear (Volume Queen's), first, so it spares everything after it ----
label("ptr");   dat.f(imm(0), imm("len"));
label("pass1"); mov.i("stun", postinc("ptr"));               // pass 1: SPL 0
djn.b("pass1", imm(`${CORESIZE}-len`));
mov.ab(imm("len"), "ptr");
label("clear"); mov.i("kill", postinc("ptr"));               // pass 2: DAT
jmp("clear");
label("stun");  spl.b(imm(0), imm(0));
label("kill");  dat.f(imm(0), imm(0));                       // also Leapfrog's own clear bomb

// ---- the opening: saw a clear or a bomber (or nothing): Leapfrog; saw a paper: the clear ----
org("think");
label("think"); ldp.ab(imm(P.KEY), "m");                     // what we saw: 0 a clear (or nothing), 1 a paper
jmz.b("first", "m");
jmp("goclear");
label("m");     dat.f(imm(0), imm(0));

// ---- Leapfrog with a sensor ----
label("first"); mov.i("mark", ind("sentp"));                 // plant the marker
mov.ab(imm("last-lptr"), "lptr");                            // our clear starts just past us
label("loop");  mov.i("kill", postinc("lptr"));
seq.i("mark", ind("sentp"));                                 // marker still there?
jmp("sense");
jmp("loop");
label("sense"); jmz.f("front", ind("sentp"));                // both fields zero: a clear's front or a bomb: leap
stp.ab(imm(1), imm(P.KEY));                                  // copied code (a paper): remember it...
label("goclear"); spl("pass1");                              // ...and become the clear
jmp("pass1");
label("front"); stp.ab(imm(0), imm(P.KEY));                  // a clear or a bomber: remember it, and leap
mov.ab(imm("last-src"), "src");                              // copy the whole program (last cell first)
mov.ab(imm(`last-dst+${vec(0, -P.HOPY, -P.HOPZ)}`), "dst");
mov.ab(imm("last-ptr"), "cnt");
label("copy");  mov.i(predec("src"), predec("dst"));
djn.b("copy", "cnt");
add.ab(imm("first-ptr"), "dst");                             // dst: the copy's Leapfrog
jmp(ind("dst"));
label("src");   dat.f(0, 0);
label("dst");   dat.f(0, 0);
label("cnt");   dat.f(0, 0);
label("lptr");  dat.f(0, 0);
label("sentp"); dat.f(0, vec(0, -P.SENT, 0));
label("mark");  dat.f(0, 1);
equ("last", "(mark+1)");
equ("len", "(last-ptr)");
