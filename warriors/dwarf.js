// Dwarf, written in JavaScript.
// JavaScript warriors don't run in the arena themselves: they *generate*
// Redcode, and the Redcode is what fights. Change STEP and recompile.
name("Dwarf (JavaScript)");
author("ZoreWars");
strategy("The classic Dwarf bomber, generated from JavaScript.");

const STEP = 4; // must divide CORESIZE or the Dwarf will eventually bomb itself
if (CORESIZE % STEP !== 0) throw new Error(`STEP ${STEP} does not divide ${CORESIZE}`);

org("loop");
label("loop"); add.ab(imm(STEP), "bomb");
               mov.i("bomb", ind("bomb"));
               jmp("loop");
label("bomb"); dat.f(imm(0), imm(0));
