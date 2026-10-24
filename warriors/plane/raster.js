// Raster: a core clear for the plane. Pointer increments (>) count as plain
// numbers, so the pointer walks every cell row by row and the clear covers
// the whole plane, like a TV raster. Two passes: SPL 0 to freeze everyone,
// then DAT to kill. Both start a row below and stop a row above, so Raster
// never clears its own row; then it idles.
name("Raster");
author("ZoreWars");
strategy("Plane core clear: walks the whole plane row by row, first with SPL 0, then with DAT.");
if (SIZEY < 3) throw new Error("Raster is for a plane: choose a Plane battlefield in Rules (CLI: --torus 100x80)");
const COUNT = CORESIZE - 2 * SIZEX;                    // every row except ours and the one above

org("pass1");
label("pass1"); mov.i("stun", postinc("ptr"));
djn.b("pass1", "cnt");
mov.ab(imm(vec(0, 1)), "ptr");
mov.ab(imm(COUNT), "cnt");
label("pass2"); mov.i("kill", postinc("ptr"));
djn.b("pass2", "cnt");
label("idle");  jmp(0);
label("ptr");  dat.f(0, vec(0, 1));
label("cnt");  dat.f(0, COUNT);
label("stun"); spl.b(imm(0), imm(0));
label("kill"); dat.f(0, 0);
