// Papercut: a silk paper whose copies also bomb. 2^LEVELS processes run the
// loop in lockstep: each starts a process in the copy, copies one cell, and
// drops one DAT bomb, so every pass leaves a fresh copy and a carpet of bombs.
//
// Tuned constants. `zorewars tune` searches the SPACE below for better values:
//   node cli/zorewars.js tune warriors/papercut.js
// SPACE {"LEVELS":[4,5],"STEP":[200,7800],"DELTA":[1,7999],"BOMB":[1,7999],"BDELTA":[1,7999]}
const P = {"LEVELS":4,"STEP":3479,"DELTA":5722,"BOMB":462,"BDELTA":3579};
name("Papercut");
author("ZoreWars");
strategy("Silk paper that also carpet-bombs: every pass makes a copy and drops a row of DAT bombs.");

org("start");
label("start");
for (let i = 0; i < P.LEVELS; i++) spl(1);          // 2^LEVELS processes, lined up at silk
label("silk"); spl(P.STEP, imm(0));                 // each starts a process in the copy
mov.i(postinc("silk"), apostinc("silk"));           // and copies one cell (B: read, A: write)
mov.i("seed", postinc("hit"));                      // and drops one bomb (the seed is a DAT)
add.a(imm(P.DELTA), "seed");                        // new distance for the next copy
add.ab(imm(P.BDELTA), "hit");                       // new place for the next carpet
mov.f("seed", "silk");                              // reset the copy pointers
jmp("silk");
label("seed"); dat.f(imm(P.STEP), imm(0));          // A: next copy distance, B: read from cell 0
label("hit");  dat.f(imm(0), imm(P.BOMB));          // where the carpet goes
