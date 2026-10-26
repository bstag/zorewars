// PROTOTYPE (not in the library; see README.md in this folder). 80x10x10.
// Result: better than Leapfrog against backward clears (Backdraft 6-13-11,
// where Leapfrog loses 0-30) but still losing, and much weaker against
// everything else (Volume Queen 20-9 where Leapfrog wins 29-1, Fast Silk
// 0-25): checking two wires every step leaves its own clear too slow to win.
//
// Leapfrog II: Leapfrog that watches both ways. Leapfrog beats forward clears
// by watching the side their front comes from; backward clears (Backdraft,
// after ULTIMA RATIO REGUM) come from the other side and beat it 30-0. So
// there are two wires: two rows up for a forward front (leap up, behind it)
// and two rows down for a backward one (leap down, behind that). Its own
// clear writes the wires' own value, so it never trips them, and a counter
// stops it short of the upper wire and of us.
name("Leapfrog II");
author("ZoreWars");
strategy("Leapfrog with wires on both sides: leaps behind a forward or a backward clear's front, and clears in between.");
if (SIZEZ < 2) throw new Error("Leapfrog II is for a 3D battlefield: choose Volume 80×10×10 in Rules (CLI: --torus 80x10x10)");
//
// Tuned constants: `node cli/zorewars.js tune warriors/volume/leapfrog2.js --torus 80x10x10`
// SPACE {"SENT":[1,3],"HOP":[2,6]}
const P = {"SENT":2,"HOP":4};

org("first");
label("first"); mov.i("mark", ind("up"));                     // lay both wires
mov.i("mark", ind("dn"));
mov.ab(imm("last-lptr"), "lptr");                             // our clear starts just past us
mov.ab(imm(`${CORESIZE}-(last-first)-${P.SENT + 1}*${SIZEX}`), "cnt");   // and stops short of the upper wire
label("loop");  seq.i("mark", ind("up"));                     // a forward front?
jmp("goup");
seq.i("mark", ind("dn"));                                     // a backward one?
jmp("godn");
jmz.b("loop", "cnt");                                         // our clear is done: just watch
mov.i("mark", postinc("lptr"));                               // one cell of our clear (the wires' value)
djn.b("loop", "cnt");
jmp("loop");
label("goup");  mov.ab(imm(`last-dst+${vec(0, -P.HOP, 0)}`), "dst");
jmp("move");
label("godn");  mov.ab(imm(`last-dst+${vec(0, P.HOP, 0)}`), "dst");
label("move");  mov.ab(imm("last-src"), "src");               // copy everything, last cell first
mov.ab(imm("last-first"), "cnt2");
label("copy");  mov.i(predec("src"), predec("dst"));
djn.b("copy", "cnt2");
jmp(ind("dst"));                                              // dst now points at the copy's first line
label("src");   dat.f(0, 0);
label("dst");   dat.f(0, 0);
label("cnt2");  dat.f(0, 0);
label("cnt");   dat.f(0, 0);
label("lptr");  dat.f(0, 0);
label("up");    dat.f(0, vec(0, -P.SENT, 0));                 // the upper wire: SENT rows up
label("dn");    dat.f(0, vec(0, P.SENT, 0));                  // the lower wire: SENT rows down
label("mark");  dat.f(0, 1);
equ("last", "(mark+1)");
