// Tripwire: Gremlin's DJN stream, then Backdraft's clear. The idea (from
// Death, a 1980s warrior): the stream walks backward through every cell
// taking one off both fields, which breaks the exact numbers clears and
// scanners rely on. Its tripwire is a (1,1) cell at the very end of our
// code, the last cell the stream reaches: taking one off it leaves (0,0), so
// the DJN falls through, JMN sees the wire cut, and we turn into a backward
// two-pass clear to finish off what the stream can't break, such as papers.
name("Tripwire");
author("ZoreWars");
strategy("A DJN stream for one lap through the volume, then a backward SPL/JMP-then-DAT clear when it trips its own wire.");
if (SIZEZ < 2) throw new Error("Tripwire is for a 3D battlefield: choose a Volume in Rules (CLI: --torus 40x20x10)");
//
// Tuned constants: `node cli/zorewars.js tune warriors/volume/tripwire.js --torus 40x20x10`
// SPACE {"TRAP":["spl","pair"]}
const P = {"TRAP":"pair"};
const PAIR = P.TRAP === "pair";

label("sp");    dat.f(0, 0);                                  // the stream's pointer: it walks back from here
label("ptr");   dat.f(0, 0);                                  // the clear's pointer
org("go");
label("go");    djn.f("go", apredec("sp"));                   // the stream: one off both fields, cell after cell
jmn.b("go", "wire");                                          // fell through: is our wire cut?
label("lap");   mov.ab(imm(0), "ptr");                        // yes: a backward two-pass clear, over and over
mov.ab(imm(PAIR ? `(${CORESIZE}-len)/2` : `${CORESIZE}-len`), "left");
label("pass1"); mov.i("stun", predec("ptr"));
if (PAIR) mov.i("jump", predec("ptr"));
djn.b("pass1", "left");
mov.ab(imm(0), "ptr");
mov.ab(imm(`${CORESIZE}-len`), "left");
label("pass2"); mov.i("kill", predec("ptr"));
djn.b("pass2", "left");
jmp("lap");
label("stun");  spl.b(imm(0), imm(0));
label("jump");  jmp(-1);
label("kill");  dat.f(imm(0), imm(0));
label("left");  dat.f(0, 0);
label("wire");  dat.f(imm(1), imm(1));                        // the last cell the stream reaches
equ("len", "(wire+1-ptr)");
