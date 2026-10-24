// Blitz: quickscan first, then paper. In its first few dozen cycles it checks
// PROBES pairs of cells spread across the core; if one isn't empty, it
// bombs CARPET cells over it with SPL 0 and then DAT. Either way it then
// becomes a Papercut: a bombing silk paper.
//
// Tuned constants. `zorewars tune` searches the SPACE below for better values:
//   node cli/zorewars.js tune warriors/blitz.js
// SPACE {"PROBES":[6,14],"FIRST":[150,1500],"CARPET":[8,40]}
const P = {"PROBES":9,"FIRST":413,"CARPET":14};
name("Blitz");
author("ZoreWars");
strategy("Quickscan of fixed spots, carpet-bomb any find, then turn into a bombing silk paper.");

const PAPER = { LEVELS: 4, STEP: 3479, DELTA: 5722, BOMB: 462, BDELTA: 3579 };
const SPAN = CORESIZE - 2 * P.FIRST;
const GAP = Math.floor(SPAN / (2 * P.PROBES));        // distance between the two cells of a pair
const probeLine = (i) => 1 + 4 * i;                   // ptr is line 0
const target = (i) => P.FIRST + 2 * i * GAP;          // offset from line 0

org("probe0");
label("ptr"); dat.f(imm(0), imm(0));
for (let i = 0; i < P.PROBES; i++) {
  const rel = target(i) - probeLine(i);               // operands are relative to their own line
  label(`probe${i}`);
  sne.i(rel, rel + GAP);                              // pair differs? skip to the attack below
  jmp(i + 1 < P.PROBES ? `probe${i + 1}` : "start");  // both empty: next probe (or start the paper)
  mov.ab(imm(target(i) - 4), "ptr");                  // aim just before the find
  jmp("attack");
}
label("attack"); mov.i("stun", postinc("ptr"));       // pass 1: stun the area
djn.b("attack", imm(P.CARPET));
sub.ab(imm(P.CARPET), "ptr");                         // back to the start of the carpet
label("kill");   mov.i("seed", postinc("ptr"));       // pass 2: DAT over the same area
djn.b("kill", imm(P.CARPET));
// ---- the paper (Papercut) ----
label("start");
for (let i = 0; i < PAPER.LEVELS; i++) spl(1);
label("silk"); spl(PAPER.STEP, imm(0));
mov.i(postinc("silk"), apostinc("silk"));
mov.i("seed", postinc("hit"));
add.a(imm(PAPER.DELTA), "seed");
add.ab(imm(PAPER.BDELTA), "hit");
mov.f("seed", "silk");
jmp("silk");
label("seed"); dat.f(imm(PAPER.STEP), imm(0));
label("hit");  dat.f(imm(0), imm(PAPER.BOMB));
label("stun"); spl.b(imm(0), imm(0));
