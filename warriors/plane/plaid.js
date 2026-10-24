// Plaid: a stone for the plane. On a torus no single step visits every cell
// (on 100x80 a fixed step repeats after at most 400 cells), so Plaid bombs
// a lattice with two loops: along a row every GX cells, then down GY rows.
// Its bombs land on rows that are an odd multiple of GY/2 away from its own,
// so it never hits itself, whatever the plane's size.
name("Plaid");
author("ZoreWars");
strategy("Plane stone: bombs a lattice of points, every GX cells along a row and every GY rows down.");
if (SIZEY < 4) throw new Error("Plaid is for a plane: choose a Plane battlefield in Rules (CLI: --torus 100x80)");
// The lattice spacing must divide the plane on each axis (so a row of bombs
// ends where it started) and be even along y (so "half a step" is a row).
const pickX = [4, 5, 3, 2].find((g) => SIZEX % g === 0);
const pickY = [4, 6, 2].find((g) => SIZEY % g === 0);
if (!pickX || !pickY) throw new Error(`no lattice fits a ${SIZEX}x${SIZEY} plane`);
const GX = pickX, GY = pickY;

org("row");
label("row");  mov.ab(imm(SIZEX / GX), "xcnt");     // bombs per row
label("bomb"); mov.i("dat0", ind("ptr"));
add.ab(imm(GX), "ptr");                             // along the row
djn.b("bomb", "xcnt");
add.ab(imm(vec(0, GY)), "ptr");                     // next lattice row (x is back where it started)
jmp("row");
label("ptr");  dat.f(0, vec(1, GY / 2));            // first bomb: half a lattice step below us
label("xcnt"); dat.f(0, 0);
label("dat0"); dat.f(0, 0);
