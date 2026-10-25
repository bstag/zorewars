// PROTOTYPE (not in the library; see README.md in this folder).
// Scanner Swarm: four Battleships that know each other. The original copies
// itself to three other places (other rows and layers, the same x) and
// starts each copy, then all four dig: each checks one cell per instruction
// (JMZ.F on a pointer that counts through every cell) and fires a 3D salvo
// at what it finds. Friend or foe: the copies line up at the same x, so a
// sibling's cell holds the same instruction as our own cell at that x. On a
// find it compares the found cell's A-field with our cell's at the same x
// (MUL by [1,0,0] keeps only the x part of the offset) and skips it if they
// match: A-fields, because the B-fields hold each copy's own pointers and
// counters. (An enemy cell with the same A-field as ours there is skipped
// too: the price of the check.)
// (A tag in the first cell doesn't work: a body across the end of its row is
// two pieces in number order, and the scan can meet the tail first.) The
// scan starts two rows away and stops two rows short of coming home, so a
// salvo can't reach its own body, then laps again. 80x10x10.
// Result: 1.52 (Battleship 1.50). Beats Battleship 18-1, Leapfrog 20-0,
// Dwarf and Imp 20-0; turns paper losses into ties (Fast Silk 0-3-17,
// Battleship loses those outright: four bodies are harder to wipe out than
// one); loses to clears 6-14. Copies split the warrior's turns, so the four
// scan no faster than one.
name("Scanner Swarm");
author("ZoreWars");
strategy("Prototype: four aligned Battleships that recognise each other and fire 3D salvos at everything else.");
if (SIZEZ < 2) throw new Error("Scanner Swarm is for a 3D battlefield: choose Volume 80×10×10 in Rules (CLI: --torus 80x10x10)");
//
// SPACE {"W":[2,6],"COPIES":[1,5],"HY":[1,9],"HZ":[1,9],"SY":[0,9],"SZ":[1,9]}
const P = {"W":3,"COPIES":3,"HY":3,"HZ":3,"SY":3,"SZ":3};

label("init");  mov.ab(imm(2 * SIZEX), "ptr");               // dig from two rows on
label("dig");   jmz.f("dig", postinc("ptr"));                // empty: next cell
slt.ab(imm("stop"), "ptr");                                  // come round to ourselves?
jmp("found");
jmp("init");                                                 //   yes: start a new lap
label("found"); mov.b("ptr", "chk");                         // chk sits just before ptr: @chk is the find
mov.ba("ptr", "chk");                                        // and in its A-field...
mul.a(imm(vec(1, 0, 0)), "chk");                             // ...only the x part: *chk is our cell at the find's x
sne.a(aind("chk"), ind("chk"));                              // the same A-field? one of us (B-fields hold each copy's state)
jmp("dig");                                                  //   yes: leave it
mov.b("ptr", "shot");                                        // shot sits just after ptr
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
jmp("dig");
// Launch (the original only): copy the body COPIES times, start each copy.
org("launch");
label("launch"); mov.ab(imm("last-src"), "src");
mov.ab(imm("last-dst"), "dst");
add.b("hop", "dst");                                         // where this copy goes (kept in a B-field, so copies match)
mov.ab(imm("last-init"), "cnt");
label("copy");  mov.i(predec("src"), predec("dst"));
djn.b("copy", "cnt");
spl(ind("dst"));                                             // dst points at the copy's first cell
add.ab(imm(vec(0, P.SY, P.SZ)), "hop");                      // the next copy goes elsewhere (same x)
djn.b("launch", imm(P.COPIES));
jmp("init");                                                 // then dig ourselves
label("src");   dat.f(0, 0);
label("dst");   dat.f(0, 0);
label("cnt");   dat.f(0, 0);
label("hop");   dat.f(0, vec(0, P.HY, P.HZ));
label("chk");   dat.f(0, 0);
const PTR = curline();
label("ptr");   dat.f(0, 0);
label("shot");  dat.f(0, 0);
label("bomb");  dat.f(imm(0), imm(0));
equ("last", "(bomb+1)");
equ("stop", CORESIZE - PTR - 2 * SIZEX);
