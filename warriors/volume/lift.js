// Lift: an imp that travels through the depth of the battlefield. It puts a
// copy of itself one layer deeper, then TRN turns the process to face +z, so
// every step after that goes one layer further in, round and round the z
// axis.
name("Lift");
author("ZoreWars");
strategy("Depth imp: TRN turns the process to face +z, and it crawls through the layers.");
if (SIZEZ < 2) throw new Error("Lift is for a 3D battlefield: choose a Volume in Rules (CLI: --torus 40x20x10)");

org("go");
label("go");  mov.i("imp", vec(1, 0, 1));            // an imp one layer in from the TRN
trn(vec(0, 0, 1));                                   // face +z: the next instruction is that imp
label("imp"); mov.i(0, vec(0, 0, 1));                // copy myself one layer in
