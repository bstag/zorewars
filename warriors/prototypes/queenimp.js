// PROTOTYPE (not in the library; see README.md in this folder).
// Volume Queen's clear plus Lift's depth imp. Result: 0.89. The clear writes
// SPL 0 into the imp's path; the stunned imp floods our own queue and
// starves the clear. An imp can't share a volume with its own clear.
//
// Queen Imp: Volume Queen's two-process clear plus Lift's depth imp.
name("Queen Imp");
author("ZoreWars");
strategy("Two-process core clear plus a depth imp crawling through the layers.");
label("ptr");   dat.f(imm(0), imm("len"));
org("start");
label("start"); spl("go");                                   // the imp
spl(1);                                                      // two processes for the clear
label("pass1"); mov.i("stun", postinc("ptr"));
djn.b("pass1", imm(`${CORESIZE}-len`));
mov.ab(imm("len"), "ptr");
label("clear"); mov.i("kill", postinc("ptr"));
jmp("clear");
label("stun");  spl.b(imm(0), imm(0));
label("kill");  dat.f(imm(0), imm(0));
label("go");    mov.i("imp", vec(1, 0, 1));
trn(vec(0, 0, 1));
label("imp");   mov.i(0, vec(0, 0, 1));
equ("len", "(imp+1-ptr)");
