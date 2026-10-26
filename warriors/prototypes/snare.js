// PROTOTYPE (not in the library; see README.md in this folder).
// Result: survives alone and beats Volume Queen 21-9, but loses to nearly
// everything else (Shears 0-30, Backdraft, Tripwire and Gremlin 0-30,
// papers 1-15): trapping one find at a time is too slow against the
// volume's clears and streams. (A first version kept its pointer at the
// start and trapped itself: the lap guard needs our code behind the pointer.)
//
// Snare: a small scanner that sets traps. The idea (from Shears, a 1990s
// hill warrior): scan fast, and put a stun trap on whatever you find rather
// than a bomb. Snare checks one cell per cycle (JMZ.F on a pointer that
// counts through every cell, as Battleship does); on a find it lays the
// SPL 0 / JMP -1 pair (the process on the JMP jumps back onto the SPL) and
// steps past it. After each lap a DAT pass kills what the traps are holding,
// then it scans again. Each lap stops two rows short of coming home.
name("Snare");
author("ZoreWars");
strategy("Small scanner: checks a cell per cycle, traps what it finds with SPL 0 / JMP -1, then a DAT pass, lap after lap.");
if (SIZEZ < 2) throw new Error("Snare is for a 3D battlefield: choose a Volume in Rules (CLI: --torus 40x20x10)");
//
// Tuned constants: `node cli/zorewars.js tune warriors/volume/snare.js --torus 40x20x10`
// SPACE {"START":[1,3],"KILL":[0,1]}
const P = {"START":2,"KILL":1};

org("lap");
label("lap");   mov.ab(imm(P.START * SIZEX), "ptr");          // a lap starts START rows on
label("dig");   jmz.f("dig", postinc("ptr"));                 // empty: next cell
slt.ab(imm("stop"), "ptr");                                   // come round to ourselves?
jmp("trap");
P.KILL ? jmp("sweep") : jmp("lap");                           //   yes: the DAT pass (or a new lap)
label("trap");  mov.i("jump", ind("ptr"));                    // JMP -1 just past the find...
mov.i("stun", predec("ptr"));                                 // ...SPL 0 on it
add.ab(imm(2), "ptr");                                        // and on past both
jmp("dig");
label("sweep"); mov.ab(imm(P.START * SIZEX), "ptr");          // DAT everything we can reach, then scan again
label("kloop"); mov.i("kill", postinc("ptr"));
slt.ab(imm("stop"), "ptr");
jmp("kloop");
jmp("lap");
label("stun");  spl.b(imm(0), imm(0));
label("jump");  jmp(-1);
label("kill");  dat.f(imm(0), imm(0));
// The pointer comes last, so our code lies just behind it: a lap that comes
// round reaches the end of the lap before it reaches us.
const PTR = curline();
label("ptr");   dat.f(0, 0);
equ("stop", CORESIZE - 2 * SIZEX - PTR);                      // two rows short of our own code
