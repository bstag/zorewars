// PROTOTYPE (not in the library; see README.md in this folder).
// Fang Rings with the first column written as SPL 0 pits, so trapped
// processes flood there before the DAT column. Result: 1.79: most of a
// paper's processes never wander into a ring.
//
// Rollback B: one pass of JMP -1 fangs (each jumps to the cell before it,
// the fang written just before), so every row of the volume becomes a ring
// that traps whatever runs into it; then a column of DATs, one per row,
// kills everything circling the rings. Repeats the column forever.
name("Fang Pits");
author("ZoreWars");
strategy("Fang clear: JMP -1 everywhere traps processes in row rings, then one DAT per row kills them.");
const COLX = 3;                                     // the kill column: this far along x from cp
label("ptr");   dat.f(imm(0), imm("len"));
org("start");
label("start"); spl(1);                                       // two processes
label("pass1"); mov.i("fang", postinc("ptr"));                // a fang in every cell but ours
djn.b("pass1", imm(`${CORESIZE}-len`));
label("col");   mov.ab(imm(SIZEZ), "zc");
label("zl");    mov.ab(imm(SIZEY), "yc");
label("yl");    mov.i("bomb", ind("cp"));                     // a pit (first column), then DATs
add.ab(imm(vec(0, 1, 0)), "cp");
label("yc");    djn.b("yl", imm(0));
add.ab(imm(vec(0, 0, 1)), "cp");                              // (y has come round: next layer)
label("zc");    djn.b("zl", imm(0));
mov.i("kill", "bomb");                                        // after the first column: DATs
jmp("col");
label("fang");  jmp.b(-1, 0);
label("kill");  dat.f(imm(0), imm(0));
label("bomb");  spl.b(imm(0), imm(0));
label("cp");    dat.f(0, vec(COLX, 0, 0));
equ("len", "(cp+1-ptr)");
