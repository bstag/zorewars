// Fast Silk: a small silk paper that copies three cells per pass.
// Every process runs the same lines in step. Papercut spends 7 instructions
// per pass to copy one cell per process; this one spends 6 to copy three, so
// 2^LEVELS processes copy the whole 7-line body in a single pass and start the
// copy. The copy distance changes by DELTA each pass, so copies spread out.
//
// Tuned constants. `zorewars tune` searches the SPACE below for better values:
//   node cli/zorewars.js tune warriors/fastsilk.js
// SPACE {"LEVELS":[1,4],"STEP":[200,7800],"DELTA":[1,7999],"MOVS":[2,3]}
const P = {"LEVELS":2,"STEP":485,"DELTA":7260,"MOVS":3};
name("Fast Silk");
author("ZoreWars");
strategy("Small silk paper: three copy streams per process, a new copy distance every pass.");

org("start");
label("start");
for (let i = 0; i < P.LEVELS; i++) spl(1);
label("silk"); spl(P.STEP, imm(0));                    // start a process in the copy
for (let i = 0; i < P.MOVS; i++) mov.i(postinc("silk"), apostinc("silk"));   // copy cells
add.a(imm(P.DELTA), "seed");                           // next copy distance
mov.f("seed", "silk");                                 // reset the pointers
jmp("silk");
label("seed"); dat.f(imm(P.STEP), imm(0));
const BODY = curline() - P.LEVELS;
if ((2 ** P.LEVELS) * P.MOVS < BODY) throw new Error(`${2 ** P.LEVELS} processes x ${P.MOVS} copies don't cover the ${BODY}-line body`);
