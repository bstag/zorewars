// Fleet: Battleship and Slant together, the Red Queen recipe in 3D. The
// scanner digs through the volume and fires block salvos at what it finds;
// the replicator (Slant's code, including its accidental steering: see
// slant.js) lays chains of copies in the background, one process per copy,
// so it takes few of the scanner's turns. With the steering "fixed" (ADD.A)
// Fleet drops from 1.66 to 1.16 points per round on 80x10x10. The scanner hunts
// papers' copies while the replicator outlasts the stones that beat scanners.
// It needs a volume at least 64 cells wide (code can be half a row long):
// 80x10x10 gives it room.
name("Fleet");
author("ZoreWars");
strategy("Digging scanner plus diagonal replicator: Battleship hunts while Slant spreads copies through the volume.");
if (SIZEZ < 2) throw new Error("Fleet is for a 3D battlefield: choose Volume 80×10×10 in Rules (CLI: --torus 80x10x10)");
//
// Tuned constants: `node cli/zorewars.js tune warriors/volume/fleet.js --torus 80x10x10`
// SPACE {"W":[2,6],"BOMB":["dat","spl"],"HX":[0,79],"HY":[1,9],"HZ":[1,9],"SX":[0,79],"SY":[0,9],"SZ":[0,9]}
const P = {"W":3,"BOMB":"spl","HX":78,"HY":7,"HZ":7,"SX":59,"SY":3,"SZ":2};
const HOP = vec(P.HX, P.HY, P.HZ), STEER = vec(P.SX, P.SY, P.SZ);

org("launch");
label("launch"); spl("go");                                     // the replicator gets its own process

// ---- the scanner (Battleship) ----
label("dig");  jmz.f("dig", postinc("ptr"));                    // empty: look at the next cell
slt.ab(imm("stop"), "ptr");                                     // come round to ourselves?
jmp("aim");
jmp(0);                                                         //   yes: stop here
label("aim");  mov.b("ptr", "shot");
add.ab(imm(vec(-2 - Math.floor(P.W / 2), -1, -1)), "shot");     // the salvo's near corner
mov.ab(imm(3), "zdjn");
label("zlp");  mov.ab(imm(3), "ydjn");
label("ylp");  mov.ab(imm(P.W), "xdjn");
label("xlp");  mov.i("bomb", postinc("shot"));
label("xdjn"); djn.b("xlp", imm(0));
add.ab(imm(vec(-P.W, 1, 0)), "shot");
label("ydjn"); djn.b("ylp", imm(0));
add.ab(imm(vec(0, -3, 1)), "shot");
label("zdjn"); djn.b("zlp", imm(0));
jmp("dig");
const PTR = curline();
label("ptr");  dat.f(0, 2 * SIZEX);
label("shot"); dat.f(0, 0);
label("bomb"); P.BOMB === "spl" ? spl.b(imm(0), imm(0)) : dat.f(0, 0);
equ("stop", CORESIZE - PTR - 2 * SIZEX);

// ---- the replicator (Slant): copies only itself, go..cnt ----
label("go");   mov.ab(imm("last-src"), "src");
label("steer"); mov.ab(imm(`last-dst+${HOP}`), "dst");
mov.ab(imm("last-go"), "cnt");
label("copy"); mov.i(predec("src"), predec("dst"));
djn.b("copy", "cnt");
spl(ind("dst"));
add.ab(imm(STEER), "steer");
jmp("go");
label("src"); dat.f(0, 0);
label("dst"); dat.f(0, 0);
label("cnt"); dat.f(0, 0);
equ("last", "(cnt+1)");
