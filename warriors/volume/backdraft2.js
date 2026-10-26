// Backdraft II: Backdraft with a wire against DJN streams. A stream (Gremlin)
// walks backward through the volume taking one off both fields of every
// cell, and Backdraft's numbers can't take it. So a wire cell sits two rows
// on from our code, the side a backward stream arrives from; each step of
// both passes looks at it, and when it has changed we copy ourselves four
// rows on, into cells the stream has already passed, and start again there.
// Our own passes stop just short of the wire, so only others trip it.
name("Backdraft II");
author("ZoreWars");
strategy("Backdraft with a wire: when a DJN stream (or anything) touches it, the clear moves into cells the stream has passed.");
if (SIZEZ < 2) throw new Error("Backdraft II is for a 3D battlefield: choose Volume 80×10×10 in Rules (CLI: --torus 80x10x10)");
//
// Tuned constants: `node cli/zorewars.js tune warriors/volume/backdraft2.js --torus 80x10x10`
// SPACE {"WIRE":[1,4],"HOPY":[2,6],"HOPZ":[0,3]}
const P = {"WIRE":2,"HOPY":4,"HOPZ":0};

label("ptr");   dat.f(0, 0);                                  // the clear's pointer (counts down)
org("first");
label("first"); mov.i("mark", ind("wp"));                     // lay the wire
label("lap");   mov.ab(imm(0), "ptr");
mov.ab(imm(`(${CORESIZE}-reach)/2`), "left");
label("pass1"); mov.i("stun", predec("ptr"));                 // traps, walking backward
mov.i("jump", predec("ptr"));
seq.i("mark", ind("wp"));                                     // the wire still there?
jmp("move");
djn.b("pass1", "left");
mov.ab(imm(0), "ptr");
mov.ab(imm(`${CORESIZE}-reach`), "left");
label("pass2"); mov.i("kill", predec("ptr"));                 // DATs
seq.i("mark", ind("wp"));
jmp("move");
djn.b("pass2", "left");
jmp("lap");
// Move: copy everything (last cell first) and run the copy's first line.
label("move");  mov.ab(imm("last-src"), "src");
mov.ab(imm(`last-dst+${vec(0, P.HOPY, P.HOPZ)}`), "dst");
mov.ab(imm("last-ptr"), "cnt");
label("copy");  mov.i(predec("src"), predec("dst"));
djn.b("copy", "cnt");
add.ab(imm("first-ptr"), "dst");
jmp(ind("dst"));
label("stun");  spl.b(imm(0), imm(0));
label("jump");  jmp(-1);
label("kill");  dat.f(imm(0), imm(0));
label("left");  dat.f(0, 0);
label("src");   dat.f(0, 0);
label("dst");   dat.f(0, 0);
label("cnt");   dat.f(0, 0);
label("wp");    dat.f(0, vec(0, P.WIRE, 0));                  // where the wire is: WIRE rows on
label("mark");  dat.f(0, 1);
equ("last", "(mark+1)");
equ("len", "(last-ptr)");
equ("reach", `(wp-ptr+${vec(0, P.WIRE, 0)}+1)`);             // the passes stop just past the wire
