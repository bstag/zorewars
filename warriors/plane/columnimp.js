// Column Imp: an imp that crawls down a column instead of along a row.
// Code normally flows along x, so the launcher first puts a copy of the imp
// in the cell below the TRN, then TRN turns the process to face down (+y):
// its next instruction is that copy, and from then on every step is down.
// The imp copies itself one row down and moves there, forever, round the
// column.
name("Column Imp");
author("ZoreWars");
strategy("Vertical imp: TRN turns the process to face down, and it crawls down its column.");
if (SIZEY < 2) throw new Error("Column Imp is for a plane: choose a Plane battlefield in Rules (CLI: --torus 100x80)");

org("go");
label("go");  mov.i("imp", vec(1, 1));               // an imp in the cell below the TRN
trn(vec(0, 1));                                       // face down: the next instruction is that imp
label("imp"); mov.i(0, vec(0, 1));                    // the imp: copy myself one row down
