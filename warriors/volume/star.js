// Star: three imps leaving one point along x, y and z. Each launcher puts an
// imp next to its TRN and turns onto it, so one process crawls along its
// row, one down its column and one through the layers: a cross that sweeps
// three lines of the volume, turning any enemy process it meets into an imp.
name("Star");
author("ZoreWars");
strategy("Imps along x, y and z at once: a 3D cross sweeping three lines of the volume.");
if (SIZEZ < 2) throw new Error("Star is for a 3D battlefield: choose a Volume in Rules (CLI: --torus 40x20x10)");

org("go");
label("go");   spl("down");
spl("deep");
jmp("ximp");                                         // this process: the row imp
label("down"); mov.i("yimp", vec(1, 1, 0));          // a column imp below the TRN...
trn(vec(0, 1, 0));                                   // ...and face down onto it
label("deep"); mov.i("zimp", vec(1, 0, 1));          // a depth imp one layer in...
trn(vec(0, 0, 1));                                   // ...and face +z onto it
label("ximp"); mov.i(0, 1);
label("yimp"); mov.i(0, vec(0, 1, 0));
label("zimp"); mov.i(0, vec(0, 0, 1));
