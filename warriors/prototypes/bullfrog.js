// PROTOTYPE (not in the library; see README.md in this folder).
// Leapfrog with Battleship's scan and salvos in place of its slow clear.
// 80x10x10. Result: 1.54 (Leapfrog 1.97). It beats Leapfrog 15-2 and Imp,
// but loses to every paper 0-18 or 0-19: papers overwrite its 31-cell,
// one-process body within about 3,000 cycles. SPL bombs (BOMB "spl") don't
// help (0-15 against Fast Silk).
//
// Bullfrog: Leapfrog with Battleship's guns. Leapfrog beats clears but its
// own slow clear can't keep up with papers. Bullfrog digs instead: its scan
// checks one cell per pass (JMZ.F on a pointer that counts through every
// cell), and when it finds something it fires a salvo, a block of bombs W
// cells along x by 3 rows by 3 layers, around the find. Every pass also
// looks at the marker two rows up the path a clear's front comes along, and
// when the marker changes, Bullfrog copies itself behind the front. When its
// scan comes round to its own marker, the salvo knocks the marker over and
// it leaps on and starts again (the salvo can't reach its own row).
name("Bullfrog");
author("ZoreWars");
strategy("Leapfrog with Battleship's guns: leaps behind a clear's front, and fires 3D salvos at whatever its scan finds.");
if (SIZEZ < 2) throw new Error("Bullfrog is for a 3D battlefield: choose Volume 80×10×10 in Rules (CLI: --torus 80x10x10)");
//
// Tuned constants: `node cli/zorewars.js tune warriors/volume/bullfrog.js --torus 80x10x10`
// SPACE {"W":[2,6],"BOMB":["dat","spl"],"SENT":[2,3],"HOPY":[3,6],"HOPZ":[0,3]}
const P = {"W":3,"BOMB":"dat","SENT":2,"HOPY":4,"HOPZ":0};

org("first");
label("first"); mov.i("mark", ind("sentp"));                 // plant the marker
mov.ab(imm(2 * SIZEX), "ptr");                                // the scan starts two rows on: a salvo there can't reach us
label("dig");   jmz.f("look", postinc("ptr"));               // empty: look at the marker; else fire
// The find is at ptr-1; shot is the cell after ptr, so it sits one further on.
mov.b("ptr", "shot");
add.ab(imm(vec(-2 - Math.floor(P.W / 2), -1, -1)), "shot");  // the salvo's near corner
mov.ab(imm(3), "zdjn");
label("zlp");   mov.ab(imm(3), "ydjn");
label("ylp");   mov.ab(imm(P.W), "xdjn");
label("xlp");   mov.i("bomb", postinc("shot"));
label("xdjn");  djn.b("xlp", imm(0));
add.ab(imm(vec(-P.W, 1, 0)), "shot");
label("ydjn");  djn.b("ylp", imm(0));
add.ab(imm(vec(0, -3, 1)), "shot");
label("zdjn");  djn.b("zlp", imm(0));
label("look");  seq.i("mark", ind("sentp"));                 // marker still there?
jmp("move");                                                  //   no: something is coming
jmp("dig");
// Leap: copy the whole body (last cell first) behind the front, and run it.
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
label("shot");  dat.f(0, 0);
label("sentp"); dat.f(0, vec(0, -P.SENT, 0));                 // the marker's place: SENT rows up
label("mark");  dat.f(0, 1);
label("bomb");  P.BOMB === "spl" ? spl.b(imm(0), imm(0)) : dat.f(imm(0), imm(0));
equ("last", "(bomb+1)");
