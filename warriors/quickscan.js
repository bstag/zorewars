// Quickscan: before doing anything else, check a fixed set of locations
// spread across the core. If one isn't empty, carpet-bomb it right away;
// otherwise fall back to being a Dwarf. JavaScript does the bookkeeping:
// it unrolls the checks and computes every address.
name("Quickscan");
author("ZoreWars");
strategy("Unrolled SNE checks of fixed locations, then attack the first hit; falls back to a stone.");

const PROBES = 14;              // pairs of cells to check
const FIRST = 200;              // nearest probe (enemies load at least MINDISTANCE away)
const SPAN = CORESIZE - 2 * FIRST;
const GAP = Math.floor(SPAN / (2 * PROBES));   // distance between the two cells of a pair
const CARPET = GAP + 12;        // cells bombed around a hit

// Line numbers are known in advance: ptr is line 0, probe i starts at 1 + 4*i.
const probeLine = (i) => 1 + 4 * i;
const target = (i) => FIRST + 2 * i * GAP;     // offset from line 0

org("probe0");
label("ptr"); dat.f(imm(0), imm(0));
for (let i = 0; i < PROBES; i++) {
  const rel = target(i) - probeLine(i);          // operands are relative to their own line
  label(`probe${i}`);
  sne.i(rel, rel + GAP);                          // differ? skip to the MOV below
  jmp(i + 1 < PROBES ? `probe${i + 1}` : "stone"); // both empty: next probe
  mov.ab(imm(target(i) - 6), "ptr");              // aim a little before the hit
  jmp("attack");
}
label("attack"); mov.i("bomb", postinc("ptr"));
djn.b("attack", imm(CARPET));
label("stone");  add.ab(imm(4), "bomb");
mov.i("bomb", ind("bomb"));
jmp("stone");
label("bomb");   dat.f(imm(0), imm(0));
