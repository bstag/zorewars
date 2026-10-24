// Weave: imps along a row and down a column at the same time. The row imp
// rides along x as usual; the column imp is launched like Column Imp, with
// TRN. Together they make a cross that sweeps one row and one column of the
// plane over and over, and every enemy process that runs into an imp cell
// becomes an imp too, so rounds Weave can't win tend to end in ties.
name("Weave");
author("ZoreWars");
strategy("Row imp and column imp together: a moving cross that turns rounds into ties.");
if (SIZEY < 2) throw new Error("Weave is for a plane: choose a Plane battlefield in Rules (CLI: --torus 100x80)");

org("go");
label("go");  spl("down");                            // one process for the column
jmp("imp");                                           // this one becomes the row imp
label("down"); mov.i("cimp", vec(1, 1));              // a column imp below the TRN
trn(vec(0, 1));                                       // face down onto it
label("imp");  mov.i(0, 1);                           // the row imp: copy myself one cell along
label("cimp"); mov.i(0, vec(0, 1));                   // the column imp: copy myself one row down
