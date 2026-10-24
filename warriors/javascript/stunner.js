// Stunner, converted from Redcode by ZoreWars.
// Verified: compiles to exactly the same instructions as the original.

name("Stunner");
author("ZoreWars");
strategy("Bombs with SPL 0 instead of DAT. An enemy that executes SPL 0");
strategy("keeps splitting into useless copies of itself, so its real code");
strategy("gets almost no turns. After stunning, a DAT sweep finishes it off.");

const step = 3048;                          // a multiple of 8, so bombs never hit our own code
const count = 999;

org("loop");
label("ptr"); dat.f(imm(0), imm(8));        // sweep pointer, starts just past our code
label("loop"); add.ab(imm(step), "stun");
mov.i("stun", ind("stun"));                 // drop an SPL 0 bomb
djn.b("loop", imm(count));                  // repeat a fixed number of times
label("clear"); mov.i("kill", postinc("ptr"));  // then sweep the whole core with DAT bombs
jmp("clear");
label("stun"); spl.b(imm(0), imm(0));
label("kill"); dat.f(imm(0), imm(0));
