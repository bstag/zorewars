// Pillar: a lattice stone (like Plaid) whose code stands in a column. In
// every row it is only one cell wide, so row-based attacks such as Plaid's
// lattice almost never touch it.
//
// The body is written below as ordinary lines, but its operands are vertical
// offsets: line i refers to line j as [0, j-i]. The launcher copies line i to
// the cell i+1 rows below the TRN, then TRN turns the process to face down,
// so it runs the body from top to bottom and the JMP keeps it heading down.
name("Pillar");
author("ZoreWars");
strategy("Lattice stone standing in a column: one cell wide per row, so row-based attacks rarely touch it.");
if (SIZEY < 12) throw new Error("Pillar is for a plane: choose a Plane battlefield in Rules (CLI: --torus 100x80)");
const pickX = [4, 5, 3, 2].find((g) => SIZEX % g === 0);
const pickY = [4, 6, 2].find((g) => SIZEY % g === 0);
if (!pickX || !pickY) throw new Error(`no lattice fits a ${SIZEX}x${SIZEY} plane`);
const GX = pickX, GY = pickY;

// The vertical body: names of its lines, top to bottom.
const NAMES = ['row', 'bomb', 'step', 'count', 'next', 'back', 'ptr', 'xcnt', 'dat0'];
const at = (n) => NAMES.indexOf(n);
const v = (from, to) => vec(0, at(to) - at(from));      // operand from line `from` to line `to`
const BODY = [
  () => mov.ab(imm(SIZEX / GX), v('row', 'xcnt')),       // row:   bombs per lattice row
  () => mov.i(v('bomb', 'dat0'), ind(v('bomb', 'ptr'))), // bomb:  drop one
  () => add.ab(imm(GX), v('step', 'ptr')),               // step:  along the row
  () => djn.b(v('count', 'bomb'), v('count', 'xcnt')),   // count
  () => add.ab(imm(vec(0, GY)), v('next', 'ptr')),       // next:  the next lattice row
  () => jmp(v('back', 'row')),                           // back:  (heading down is kept)
  () => dat.f(0, vec(GX / 2, GY / 2)),                   // ptr:   first bomb, off our column and row
  () => dat.f(0, 0),                                     // xcnt
  () => dat.f(0, 0),                                     // dat0
];

org("go");
label("go");
for (let i = 0; i < BODY.length; i++) mov.i(`body+${i}`, `turn+${vec(0, i + 1)}`);   // stand the body up
label("turn"); trn(vec(0, 1));                          // face down, into the column
label("body");
for (const line of BODY) line();                        // the body, as data (never run here)
