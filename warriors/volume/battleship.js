// Battleship: a scanner that digs through the volume. The scan is one
// instruction: JMZ.F jumps to itself while the cell under the pointer is
// empty, and the pointer counts up as a plain number, so it walks every cell,
// row by row and layer by layer, one per cycle. On a find it fires a salvo:
// a block of bombs W cells along x, by 3 rows, by 3 layers, around the hit,
// then digs on. The dig starts two rows away from its own code and stops
// two rows short of coming home, so a salvo can't land on Battleship itself
// (only a find in the very next layer, right by its own row, could).
name("Battleship");
author("ZoreWars");
strategy("Digging scanner: checks every cell in turn and fires a 3D block salvo around anything it finds.");
if (SIZEZ < 2) throw new Error("Battleship is for a 3D battlefield: choose a Volume in Rules (CLI: --torus 40x20x10)");
//
// Tuned constants: `node cli/zorewars.js tune warriors/volume/battleship.js --torus 40x20x10`
// SPACE {"W":[2,6],"BOMB":["dat","spl"]}
const P = {"W":2,"BOMB":"dat"};

org("dig");
label("dig");  jmz.f("dig", postinc("ptr"));                   // empty: look at the next cell
slt.ab(imm("stop"), "ptr");                                    // come round to ourselves?
jmp("aim");
jmp(0);                                                        //   yes: stop here (and stay alive)
// The hit is at ptr-1 (the pointer counted on). Aim at the block's near
// corner; shot is the cell after ptr, so it sits one further away.
label("aim");  mov.b("ptr", "shot");                          // the pointer is the B-field
add.ab(imm(vec(-2 - Math.floor(P.W / 2), -1, -1)), "shot");
mov.ab(imm(3), "zdjn");
label("zlp");  mov.ab(imm(3), "ydjn");
label("ylp");  mov.ab(imm(P.W), "xdjn");
label("xlp");  mov.i("bomb", postinc("shot"));                 // along the row
label("xdjn"); djn.b("xlp", imm(0));                           // (counts down its own B-field)
add.ab(imm(vec(-P.W, 1, 0)), "shot");                          // next row of the block
label("ydjn"); djn.b("ylp", imm(0));
add.ab(imm(vec(0, -3, 1)), "shot");                            // next layer of the block
label("zdjn"); djn.b("zlp", imm(0));
jmp("dig");
const PTR = curline();
label("ptr");  dat.f(0, 2 * SIZEX);                            // start two rows away
label("shot"); dat.f(0, 0);
label("bomb"); P.BOMB === "spl" ? spl.b(imm(0), imm(0)) : dat.f(0, 0);
// The scan reaches our own row again at pointer value CORESIZE - PTR - SIZEX;
// stop two rows before that.
equ("stop", CORESIZE - PTR - 2 * SIZEX);
