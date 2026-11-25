# Koenigstuhl LP hill, top 10: rebuilt from blocks

The LP ("limited process") hill runs ICWS'94 on 8,000 cells with **8 processes per warrior**, 80,000 cycles, minimum distance 200, length 200 and P-space. This page takes the hill's top 10 apart, rebuilds each one as a block tree (`tools/algebra/recipes-top10/lp.js`, keys `top10-lp-*`), measures how close the rebuild plays to the original, and checks whether anything carries over to the ModelWar ladder. The line-by-line source reviews are in [../hill-top30/lp.md](../hill-top30/lp.md); this page builds on them and corrects them in two places (the LP Destroyer's stone and the LP Destroyer II's bomb, below).

## How the numbers were made

- **Rules.** Our `lp` profile is `pmars -s 8000 -p 8 -c 80000 -d 200` with a 100-instruction limit and no P-space. The hill allows 200 instructions and P-space, which is our `lp-hill` profile. Hill scores use `--rules lp --length 200` for warriors without P-space (the opponents load at their published length either way), and `--rules lp-hill` for the two P-space switchers (The LP Destroyer and its sequel), because `--rules lp` refuses `LDP`/`STP`. How the hill tool plays the two P-space opponents under `--rules lp` was not checked; it is the same for every warrior measured. Recipes build under `lp-hill`; those that fit in 100 cells and use no P-space also build under `lp`.
- **Hill score:** `zorewars hill <x.red> --hill koenigstuhl:lp --top 30 --rounds 40`: average points per round (win 3, tie 1) against the hill's top 30, the warrior's own original included. 40 rounds against 30 opponents is 1,200 rounds; the standard error is about 0.04, so differences under 0.08 are noise. Two warriors were re-run at 100 rounds.
- **Head-to-head:** `zorewars battle rebuild.red original.red -r 200`, rebuild's points per round. An exact copy does not score 1.5 here: it scores what the original scores against a copy of itself, which is anywhere from 1.07 (paper/stone mirrors, mostly ties) to 1.62. The table gives that mirror figure beside each head-to-head; compare the two, not the head-to-head and 1.5.
- **ModelWar:** the rebuilds are rescaled to 25,200 cells (core-relative constants times 3.15, parity kept where a block needs it; counts unchanged) and built with `--rules modelwar --length 5040`, then played against the 17-warrior ModelWar field, 100 rounds each way, seed 1. Reference: Decoy Adapter v6.1 scores 2.16 on the same field.

## Summary

| # | Warrior | Recipe | New blocks | Hill: original | Hill: rebuild | Head-to-head (mirror) | ModelWar |
|--:|---|---|---|--:|--:|--:|--:|
| 1 | R.O.U.S. | `top10-lp-rous` | none (`lp-scatter-paper`) | 1.679 | 1.679 | 1.525 (1.525) | 0.97 |
| 2 | Replinator | `top10-lp-replinator` | `lp-rain-paper` | 1.593 (1.596 at 100) | 1.547 (1.527 at 100) | 1.240 (1.545) | 1.02 |
| 3 | Bronze minotaur | `top10-lp-bronze-minotaur` | `lp-rain-paper` | 1.518 | 1.544 | 1.395 (1.465) | 0.97 |
| 4 | Digital Rain | `top10-lp-digital-rain` | `lp-rain-paper` | 1.494 | 1.494 | 1.615 (1.615) | 1.03 |
| 5 | Fear of the Unknown | `top10-lp-fear-of-the-unknown` | `lp-quiet-paper`, `lp-quad-stone` | 1.571 | 1.563 | 1.110 (1.120) | 0.88 |
| 6 | The LP Destroyer | `top10-lp-destroyer` | `lp-destroyer-stone`, `lp-rain-paper` | 1.413 | 1.440 | 1.470 (1.380) | 1.19 |
| 7 | Hippogriff | `top10-lp-hippogriff` | `lp-rain-paper` | 1.419 | 1.419 | 1.115 (1.115) | 1.14 |
| 8 | Distortion Energy | `top10-lp-distortion-energy` | `lp-quiet-paper`, `lp-quad-stone` | 1.414 | 1.430 | 1.065 (1.070) | 0.91 |
| 9 | The LP Destroyer II | `top10-lp-destroyer-ii` | `lp-gate-dwarf`, `lp-rain-paper` | 1.345 | 1.309 | 1.375 (1.455) | 1.24 |
| 10 | Disciples of the Void | `top10-lp-disciples-of-the-void` | `lp-void-quartet` | 1.435 | 1.435 | 1.530 (1.530) | 1.16 |

Four rebuilds (1, 4, 7 and 10) play like the originals to three decimals, because they run the same instructions in the same layout; Fear of the Unknown is within 0.01. Bronze minotaur, the LP Destroyer and Distortion Energy are within noise. Replinator is about 0.05 to 0.07 short and loses the head-to-head; LP Destroyer II is about 0.04 short. No rebuild comes near ModelWar strength: the best is 1.24 against 2.16.

Before this work the nearest existing recipes scored: `lp-transparent-quartet` 1.308 (and 0.39 head-to-head against Disciples of the Void), `lp-bronze-paper` 1.460, `lp-booted-phase-paper` 0.772 (for Fear of the Unknown), `lp-mutation-paper` 0.850 (for Distortion Energy), `lp-outcome-switch` 1.272 (for the LP Destroyer).

## New blocks (`tools/algebra/blocks/top10-lp.js`)

| Block | Cells | Processes | What it is |
|---|--:|--:|---|
| `lp-rain-paper` | 7 | 1, grows to the cap | The 7-line LP looping paper. Parameters choose the lap order (copy first or attack first), the entry (head, or first lap line with a short first copy), the attack (doubling scatter or arithmetic walk) and the operand modes of the attack, the restart and the transfer. Covers Digital Rain, Replinator, Hippogriff, Bronze minotaur and R.O.U.S. exactly. |
| `lp-quiet-paper` | 5 | 1, grows | A paper with a 2-instruction copy loop and no attack, in Fear of the Unknown's or Distortion Energy's addressing. |
| `lp-quad-stone` | 8 or 9 | 4 | A 4-process boot plus a 4-line stone, all four processes started in the copy one line apart: Fear's self-indexed MOV/ADD/JMN stone or Distortion Energy's ADD.X/MOV/JMP stone. Like both originals it ends by bombing itself, so the gate refuses it alone. |
| `lp-destroyer-stone` | 31 | 1 | The LP Destroyer's stone: 998 laps of two `jmp #1,#1` traps on one residue mod 4, then a forward DAT clear that skips its own code. |
| `lp-gate-dwarf` | 10 | grows | The LP Destroyer II's dwarf: a predecrement stream plus a bomb stepping 81 a lap that lands on its own loop after 1,677 laps. Needs a two-line spawner (ROUTE 1) to live alone; the published SPL #0 (ROUTE 0) is refused. |
| `lp-void-quartet` | 34 to 200 | 4, grows | Disciples of the Void: two loaders, four mutually invisible JMZ.A scanners, SPL-fed backward clears; GAP blank cells around the launch. |

All of them are ring code written for LP; since ModelWar was a goal they build on any ring (offset parameters must be smaller than the core), where the uncapped SPL lets the papers multiply. Tests: `test/algebra-top10-lp.test.js`.

---

## 1. R.O.U.S. (S. Fernandes): 7 cells

**What it is.** The purest form of the LP paper: one process, seven instructions, no opening, no P-space.

**How it works.** The entry is the first lap line with the seed's B preset to 7, so the first copy is just the body: 7 cells in 28 cycles (four instructions a cell). Each lap:

1. `mov <paper, {pboot` copies one cell backwards: the seed's B is the source pointer and the transfer line's A is the destination pointer, both predecremented.
2. `mov >5033, {1319` is the attack: it reads through a remote pointer cell 5,033 ahead (post-increment) and writes through another 1,319 ahead (A-predecrement). Both pointer cells are usually blank, so the write is usually a blank DAT; when the read lands in enemy code it moves enemy code somewhere else.
3. `add.f <0, >0` doubles both fields of the attack line. The `<0`/`>0` pair points at the line before through its own B-field and leaves that B at 0 when done, so the step line is all zeros at rest.
4. `jmn loop, *loop` loops while the count (the seed's B, reached through the copy line's A) is non-zero.

When the count runs out, `spl @paper, >83` starts a new process at the seed (which rewrites the count to 22) and `jmz 6192, *0` moves the current process into the copy, but only if the copy's head arrived with B = 0. Both operands of that JMZ point at the copy's head, since the destination pointer has been walked down to it.

**Process budget.** One process doubles each generation until there are 8. From then on `spl` does nothing: the process simply walks into the copy and the home is abandoned. An LP paper is a *mover* at the cap, not a multiplier. Every later copy is 22 cells: the 7-cell body and 15 blank cells, which land on whatever was there.

**Why the constants.** The doubling offsets go through a cycle of 100 values mod 8,000 (the order of 2 mod 125), and every child inherits the attack line as it stood when it was copied, so the 8 lineages scatter over different parts of the cycle. The transfer line is copied after 16 decrements, so each generation's hop is 16 shorter than its parent's.

**Why it is strong here.** Every top-10 warrior but one has a paper or depends on one; papers tie papers, and R.O.U.S. converts those ties into wins faster than the others (2.10 to 2.25 against Bronze minotaur, Digital Rain, the LP Destroyer II). Its weak match is Fear of the Unknown (0.75), whose four-process stone shares the queue with a paper.

**Recipe.** `lp-scatter-paper` with `INDIRECT: 1` (the published R.O.U.S. addressing), HOP 6191, COUNT 22, READ 5033, WRITE 1319, RESTART 83. Exact instructions.

**Fidelity.** Hill 1.679 against 1.679; head-to-head 1.525, the same as the original against itself.

**ModelWar.** 0.97. Without a process cap the paper multiplies like an ordinary paper, but its attack is one blank cell per four cycles, and the field's stones and clears kill it (0.33 to 0.56 against eleven of the seventeen). It farms the three weak warriors (2.59 to 2.95).

**Lessons.** Seven cells can carry four jobs per lap if the address arithmetic lives in fields that already exist. The transfer guard (`jmz` on the copy's head) is what makes the cap harmless: a full queue turns reproduction into movement and a damaged copy is never entered.

## 2. Replinator (C. Schmidt): 200 cells, 50 live

**What it is.** A q^4.5 quickscan with a 20-pass two-bomb attack, then Digital Rain's paper with different numbers.

**How it works.** The scan is the standard MUL-decoded form: six `sne`/`seq`/`jmp` triples test 24 cells at multiples of `qz = 2108`, then a `seq >qptr` bumps the decoder's multiplier and three more pairs test 12 cells, and a final `jmz.f`. A hit costs one `mul.b` and a pick between the two cells of the pair. The attack then drops two `dat >-88, >qc2` bombs per pass, stepping 7, for 20 passes, and jumps to the paper. Two of the scan's jumps carry stray increments (`}4443`, `}3256`) marked "extra attack". The paper is 7 lines: scatter (`mov {548, {109`), double (`add {0, }0`), copy, test, `spl >from, }7293`, `jmz 6667, *0`. Copies are 21 cells (14 blank); 6667 is five sixths of the core.

**Layout.** The paper sits 13 cells into the image, the scan's bomb and tables about 90 to 140 cells later and the scan code at the end. When the scan hands over, its 40-odd cells stay behind as dead code, far from the paper's home.

**Process budget.** One process scans and bombs (about 300 cycles), then the paper grows to 8.

**Why it is strong here.** On a hill of papers the scan rarely kills, but its 40 bombs land on the find before the opponent has 8 processes, and a paper that lost a copy or two early is behind for the rest of the round. Its best matches are against the slower papers (2.02 against the LP Destroyer II); its worst is R.O.U.S. (0.57).

**Recipe.** `seq(opening-qscan-mul45 {QFAC 2107, GAP 100, UNITS 6, UNITS2 3}, probe-burst2 {COUNT 20, STEP 7, GAP 88}, boot {HOP 6000} (lp-rain-paper with Replinator's numbers))`. QFAC 2107 gives the published multiplier 2108 = QFAC + 1. The scan's table and pair offsets come from our block, not the original's layout, so the scanned cells differ.

**Fidelity.** The paper alone matches: Replinator's own image entered at the paper scores 1.485 on the hill, our `lp-rain-paper` with the same numbers 1.484. With the scan, the original gains 0.11 (1.596 at 100 rounds) and our first rebuild gained nothing (1.469 at 100 rounds, the paper right after the scan code). Booting the paper away from the dead scan code was worth +0.06 (1.527 at 100 rounds; boot distances 3,000 to 6,000 all scored 1.51 to 1.55). The rest of the gap is the scan itself: ours finds different cells. Head-to-head 1.240 against a mirror of 1.545: the original wins this pairing. Tuning the scan (GAP 100 to 1,500, QFAC 1577, 8 units, a 10-pass burst, SPL bombs) moved the score between 1.42 and 1.48, all within noise of each other.

**ModelWar.** 1.02. The scan is a 25,200-cell q^4.5 with QFAC 6323; it does not save the paper.

**Lessons.** A quickscan in front of an LP paper earns its keep partly by being a decoy: the 200-cell image leaves 40 dead, non-blank cells far from where the paper restarts. In a tree the same separation comes from booting the paper. Our quickscan block is not interchangeable with Schmidt's: which 36 cells a scan looks at matters by about 0.07 here.

## 3. Bronze minotaur (G. Labarga): 200 cells, 16 live

**What it is.** Two R.O.U.S.-shaped papers, 193 cells apart, started together by `spl`/`jmp`.

**How it works.** Each paper enters at its first lap line with a 7-cell first copy. The lap copies first, then scatters (`mov {1171, {826`), then doubles (`add.f {0, }0`), then tests. On restart one head writes count 20 and the other 17, the hops are 5741 and 6415, and the restart side effects (`>2903`, `>155`) differ, so the two lineages spread over different parts of the core while sharing the 8 slots.

**Process budget.** Two processes at the start, 4 copies each at most; usually one lineage gets more slots than the other.

**Why it is strong here.** Two independent lineages are harder to wipe than one: a scanner or clear that finds one paper has not found the other. That does not make it good against scanners (1.02 against Disciples of the Void); its strength is the paper-against-paper matches (1.93 against Replinator, 2.17 against Digital Rain).

**Recipe.** `par(lp-rain-paper ×2)` with copy-first order, ENTRY 1 (first copy 7), counts 17 and 20, hops 6415 and 5741. Exact instructions; the image is 16 cells instead of 200.

**Fidelity.** Hill 1.544 against 1.518; head-to-head 1.395 against a mirror of 1.465. Within noise. The older recipe `lp-bronze-paper` (two `lp-scatter-paper`) scored 1.460: it writes the doubling line as `add.f scatter, scatter`, which does the same arithmetic but leaves both fields at -1 instead of 0. A scanner that tests fields sees that line; Bronze's `add.f {0, }0` it does not. The difference is about two standard errors, so call it likely, not proven. Padding the image to 200 cells changed nothing: trailing blank cells are the same as empty core.

**ModelWar.** 0.97.

**Lessons.** "Equivalent" instructions are not equivalent on a hill full of field scanners: the resting values of an instruction's fields are part of its defence. Two lineages share one queue, so a twin paper is not twice as fast; its value is spread.

## 4. Digital Rain (inversed): 7 cells

**What it is.** The template the rest of the hill copies: Replinator, the two LP Destroyers and End of Days use its exact shape.

**How it works.** The entry is the head, `mov #25, #0`, so even the first copy is 25 cells (18 blank). The lap attacks first: `mov {2638, {2649` moves the cell before one A-predecrement pointer onto the cell before another; `add {0, }0` doubles both offsets; then the copy and the test. `spl >from, }4001` restarts the head (its post-increment is overwritten at once when the head rewrites the count) and increments a cell 4,001 away; `jmz 1971, *0` is the guarded transfer.

**Process budget.** As R.O.U.S.; a slower start (25 cells before the first child instead of 7), but every copy lays an 18-cell carpet from the first.

**Why it is strong here.** Same reasons as R.O.U.S.; the scatter-first order means the attack's first write happens before the first copy cell, and its numbers are tuned against the hill's papers (1.90 against itself in mirror, 1.82 against Distortion Energy).

**Recipe.** `lp-rain-paper` with its defaults (they are Digital Rain's). Exact instructions.

**Fidelity.** 1.494 against 1.494; head-to-head identical to the mirror (1.615).

**ModelWar.** 1.03.

**Lessons.** One parametric block covers the four 7-line papers in the top 10; what separates them is order, entry, attack and a handful of numbers, not structure.

## 5. Fear of the Unknown (J. Metcalf): 200 cells, 14 live

**What it is.** A quiet paper beside a booted four-process stone. The only top-10 warrior whose attacker is a real multi-process stone.

**How it works.**

- *Boot.* `spl copy` sends one process to the paper. Two `spl 1` make four processes, which each run `mov <boot+1, <boot` once, copying the 4-line stone (last line first) 5,848 cells below the paper, then `jmp >boot`, which sends them to four consecutive lines of the copy.
- *Stone.* `inc mov <6742, <-6742` runs once (two remote decrements and a move) and is then only the increment. The loop is `mov >13484, 1-13484` / `add inc, <0` / `jmn >-1, inc`: the ADD reaches the MOV by predecrementing its own B-field and the JMN reaches it by post-incrementing the same field, so the loop needs no pointer cell. Each ADD moves the MOV's read pointer +6,742 and its write target -6,742. The MOV copies whatever its post-increment pointer selects, usually a blank cell, so the bombs are DATs.
- *Four processes in three lines.* Entered one line apart, the four processes execute MOV, ADD, JMN in a rotating order: 4 moves every 12 instructions, the pace of one process, but the stone survives three losses.
- *Paper.* Five lines: count 20, `mov <paper, <dest` / `jmn @0, *copy` (a 2-instruction copy loop), `spl *copy, <paper+4000`, `jmz @dest, 5849`. The seed's B is both the count and, on restart, its own write pointer.

**Process budget.** 4 in the stone, 1 in the paper; the paper can reach 4 more while the stone lives.

**Endgame.** None planned. The stone's write lattice has gcd 2 with the core and starts on odd offsets from the MOV, so after about 4,000 laps it writes over its own lines. Run alone, the stone dies at cycle 19,612; the paper lives on. That is the design: the stone does the damage in the first quarter of the round and the paper holds the rest.

**Why it is strong here.** Against papers, a stone that keeps bombing with four processes while its own paper spreads wins the attrition (1.77 against Replinator, 1.90 against Disciples of the Void, 1.85 to 2.50 against the six one-pass scanners further down the hill).

**Recipe.** `par(image(lp-quad-stone {STYLE 0, S 6742, HOP 2342}, lp-padding 186), lp-quiet-paper {STYLE 0, COUNT 20, FIRST 20, DEC 3997, HOP 5849})`. This reproduces the published layout: boot and stone template at the front, 186 blank cells, the paper last.

**Fidelity.** 1.563 against 1.571, head-to-head 1.110 against a mirror of 1.120. The compact version (paper and stone side by side, 15 cells) scored 1.446: the 186-cell gap between the paper and the stone's template is worth about 0.12. The existing `lp-booted-phase-paper` (a two-worker stone) scored 0.772.

**ModelWar.** 0.88, the weakest of the ten: four stone processes are nothing in a 25,200-process game, and a paper with no attack of its own loses everything but the three weak warriors.

**Lessons.** Under a process cap, staggered entry into a short loop is how several processes share one stone without colliding; the self-indexed ADD/JMN pair shows how to make a loop pointer from a field that is already there. A stone may be finite if a paper carries the endgame. Spacing inside the image is a parameter: a scanner that finds one part should not find the other in the same sweep.

## 6. The LP Destroyer (C. Schmidt): 200 cells, P-space

**What it is.** A P-space brain choosing between Replinator's paper and a one-process stone that becomes a clear.

**How it works.**

- *Brain.* `ldp.ba what, what` loads the state (P-cell `from - what`), `mod.a #3` folds it to 0 to 2, `ldp.ab #0` loads last round's result, and `add.a @switch, what` adds the A-field of the cell `result` cells after `switch`: 0 for the first round and for a tie, 5 for a loss, 3 for a win. That index picks a table row whose A is the next state (stored by `stp.ab`) and whose B is the jump target. Decoded: the paper by default; a loss in state 0 plays the stone, and the stone is kept while it wins; after the paper has won, it takes two losses in a row before the stone is tried again; the stone's tie or loss goes back to the paper.
- *Stone.* `add.f steps, ptr` adds (136, 136) to `ptr`; `mov.i bomb, *ptr` drops `jmp #1, #1` at `ptr + ptr.A`; `ptr` itself, `mov.i x, x+68`, then copies that trap 68 further on. Two traps a 4-cycle lap, both on one residue mod 4 (136 = 8 x 17), for 998 laps: almost every cell of that class.
- *Clear.* `mov cbomb, >steps` / `djn.f clear, >steps` / `jmp -1, >steps+2667`: a DAT on one cell, a decrement on the next, the pointer being `steps`' B-field. When the sweep comes round onto `steps`, the bomb's B (`#last-steps+2`) resets the pointer past the stone's code. Its A (`>2667`) gives every enemy process that dies on it an extra increment a third of the core away.
- *The blank cell.* There is a `dat 0, 0` line between `cbomb` and `sloop`. It sits on the traps' residue: the second trap of lap 823 lands on it. Without it that trap lands on `cbomb`, the clear lays `jmp #1, #1` instead of DATs, and the stone ends by trapping itself. The [top-30 review](../hill-top30/lp.md) missed this line; our first rebuild did too and its stone scored 0.586 alone instead of 0.978 (the original's stone, entered directly, scores 0.958).

**Process budget.** One process either way. The paper grows to 8; the stone never splits.

**Why it is strong here.** The switch lets it answer a bad pairing: against a warrior that beats the paper (another faster paper), a loss brings out a stone that traps the paper's processes and then clears. With P-space it scores 1.413; the stone alone scores 0.96 and the paper alone 1.485, so the brain costs a little against the average opponent and gains against specific ones (1.95 against the LP Destroyer II, 1.68 against Disciples).

**Recipe.** `switch-table(lp-destroyer-stone, lp-rain-paper)` with FIRST 1, LOSS 0x5518, WIN 0x8855, TIE 0x1151, PACKED 1, which encodes the decoded policy. The stone is member 0: with the paper first, the paper's scatter moved the stone's cells into its copies and the paper died alone (cycle 50,059 and 53,342 in two placements).

**Fidelity.** 1.440 against 1.413 (both under `lp-hill`); head-to-head 1.470 against a mirror of 1.380. The existing `lp-outcome-switch` (same policy, `lp-scatter-paper` and our generic `stone`) scored 1.272.

**ModelWar.** 1.19 for the switch; the stone alone 1.08. The stone alone is the only part that fights ModelWar's stones and scanners: 1.71 against SEMalytics, 1.70 against Dave, 1.76 against Drift v2 (Decoy Adapter: 1.76) and 2.01 against Drift (Decoy Adapter: 2.02). It ties neither imp warrior's ties away (0.13 against mercenary, 0.07 against InnovationStation).

**Lessons.** A single blank line can be a component. One process can run a two-phase plan (traps on one residue, then a clear) with a DJN counter as its clock, and a bomb field can reset the clear's pointer so it never needs a guard instruction. In a tree, member order is layout: a paper that moves cells around must not have live code near its scatter.

## 7. Hippogriff (J. Metcalf): 7 cells

**What it is.** A looping paper with an arithmetic attack instead of a doubling one.

**How it works.** Entry at the attack line with the count preset to 28 (21 blank cells per copy, the widest carpet of the 7-liners). The attack `mov }5096, 2407` moves a cell selected through an A-post-increment pointer onto a direct target; `add inc, copy` adds the two fields of the restart line `inc spl >paper, }2407` to the attack line: -5 to its A (the read pointer cell walks back 5) and 2,407 to its B (the target walks 2,407 a lap, coprime with 8,000, so it reaches every cell eventually). The SPL line is both launcher and increment. The transfer `jmz @7569, *0` jumps B-indirectly through the copy's head and tests it A-indirectly; both resolve to the head.

**Process budget.** As the other papers.

**Why it is strong here.** A walk covers the core evenly where doubling revisits a 100-value cycle; against papers that spread widely (Bronze minotaur, 1.80) that matters more than the scatter's speed.

**Recipe.** `lp-rain-paper` with ATTACK 1, ENTRY 1, COUNT/FIRST 28, READ 5096, WRITE 2407, RESTART 2407, HOP 7569, TRANSFER 1. Exact instructions.

**Fidelity.** 1.419 against 1.419; head-to-head identical to the mirror (1.115, mostly ties).

**ModelWar.** 1.14, the best of the pure papers, probably because a coprime walk still covers the larger core. Not close to useful.

**Lessons.** The restart SPL's fields are free constants; using them as the attack's increment costs no cell.

## 8. Distortion Energy (inversed): 200 cells, 15 live

**What it is.** A quiet paper beside a booted four-process stone whose own pointer slowly rewrites it.

**How it works.**

- *Boot.* Two `spl 1` make four processes, each copies one stone cell 4,895 cells away, then `djn >1, #4` sends three of them to the copy's ADD, MOV and JMP lines through a post-incremented vector; the fourth falls through, starts one more process on the MOV and goes to the paper. Four in the stone, one in the paper.
- *Stone.* `inc dat 44, 35` / `add.x inc, ptr` / `mov {-2, -1` / `jmp loop, <gate`. The ADD.X adds 35 to the MOV's A-field and the increment's A-field (44 at first) to its B. The MOV's A-field starts by pointing at `inc` itself, so the first MOVs decrement the increment; then the read pointer walks away by 35 a lap (gcd 5 with the core) and the write target by about 44. The author's comment says the stone goes through three such mutations and ends as a clear. What we measured: alone, the stone part dies at cycle 38,530; the paper beside it lives. The exact mutation path is **not traced** here.
- *Paper.* Five lines with a 2-instruction copy loop, first copy 5 cells, later copies 38 (33 blank: the biggest carpet on the hill).

**Why it is strong here.** As Fear of the Unknown, with a faster first copy and a larger carpet; its best matches are against the 7-line papers that rely on a single DAT a lap (1.60 against Digital Rain, 1.88 against the LP Destroyer II).

**Recipe.** `par(lp-quiet-paper {STYLE 1, COUNT 38, FIRST 5, DEC 2746, HOP 5919}, lp-quad-stone {STYLE 1, ASTEP 35, BSTEP 44, AOFS -2, BOFS -1, GATE -6, HOP 4885})`: compact, 16 cells, stone copy at the same distance from the paper as published.

**Fidelity.** 1.430 against 1.414; head-to-head 1.065 against a mirror of 1.070. Spreading this one to 200 cells like Fear made it worse (1.352), so the compact tree stays. The existing `lp-mutation-paper` scored 0.850.

**ModelWar.** 0.91.

**Lessons.** The same four-process stone shape works with very different loops; a stone that reads its own increment is a cheap way to vary its step during the round, at the price of being hard to predict (and to verify).

## 9. The LP Destroyer II (C. Schmidt): 83 cells, P-space

**What it is.** The LP Destroyer's brain and paper, with a booted SPL-fed dwarf in place of the stone.

**How it works.** Seven boot lines copy the dwarf 5,421 cells away; a run of the engine shows the copy as `spl #0, <5279` / `mov dbmb, {7838` / `mov dbmb, @dloop` / `sub #81, dloop` / `djn.f dloop, <5275`, three blank cells, and `dat <5278, >1` (the boot writes that last cell separately, which is why `dbmb` is `dend+4`). So the bombs are that DAT, not blank cells as the top-30 review guessed. The SPL feeds processes into a loop that bombs through a remote A-predecrement stream and with a bomb stepping 81 down each lap; after 1,677 laps the stepping bomb lands on the loop's second MOV, and from then each process makes one stream bomb and dies.

**The flaw.** `spl #0` joins the loop as soon as the table is full, so once the loop's MOV is a DAT there is nothing to replace the dying processes. Alone it dies at cycle 3,834. In battle the conversion only works if the opponent dies first.

**Recipe.** `switch-table(boot{HOP 5421}(lp-gate-dwarf), lp-rain-paper)` with the LP Destroyer's policy. Our dwarf (ROUTE 1) feeds the loop from a two-line `spl dl` / `jmp feed` spawner outside it (seven loopers and one spawner), so the self-hit becomes an SPL-fed clear and the gate passes. With eight processes sharing a 4-line loop, consecutive SUBs sometimes run without a MOV between them, so the planned hit on the MOV can be skipped; a later hit on the SUB or the DJN converts the dwarf the same way, and the gate accepts either.

**Fidelity.** 1.309 against 1.345; head-to-head 1.375 against a mirror of 1.455. The dwarf alone: ours 0.453, the original's dwarf 0.535 (both weak; the original's paper alone 1.462).

**ModelWar.** 1.24, the highest of the ten, most of it from the paper's farming of the weak three and the dwarf's 1.0 against SEMalytics and Drift.

**Lessons.** A timed self-hit needs a source of new processes that is not itself in the loop. On a capped hill, `spl #0` stops being a feeder the moment the table is full. A timed hit computed for one process order can miss under another; aim it at a span of cells that all convert.

## 10. Disciples of the Void (inversed): 200 cells, 34 live

**What it is.** Four 6-cell scanners that cannot see one another, booted from a 200-cell image.

**How it works.**

- *Launch.* `spl boot1` / `jmp boot2`: two loaders run in parallel.
- *Loaders.* Each copies its 6-cell scanner to two places 3,961 apart (four MOVs and a DJN, two cells a pass), writes the scanner's pointer cell (`jmp #0, 0` or `jmp #0, 80`) at the remote address the scanner uses, then `spl`s one copy and jumps into the other. Copies land at +2000, +5961 (pair 1) and +2156, +6117 (pair 2) from the image start.
- *Scanner.* `add.b #0, ptr` adds the ADD's own B-field (-77) to the remote pointer and `jmz.a loop, <ptr` predecrements it once more: a step of -78 a lap at 0.5c, testing A-fields only. The second pair uses `sub.b`: +78. Every scanner cell except the `jmz.a` has A = 0, so the four are invisible to one another; the members of a pair move in opposite directions on one parity, and 3,961 is odd, so the other pair is on the other parity.
- *Hit.* `mov @0, >ptr` writes a copy of the pointer cell (`jmp #0`) on the find, a stun bomb, and `jmn.a @0, check` resumes.
- *Endgame.* After a full pass a scanner reaches its own or its partner's `jmz.a`, bombs it, the `jmn.a` falls through, and `spl #0` / `mov @0, <-7` becomes a backward DAT clear fed up to the cap. Alone, the first clear starts near cycle 32,000.

**Process budget.** Exactly four scanners of one process each; the clears fill the table to 8 at the end.

**Why it is strong here.** On a paper hill a scanner should lose, but four of them stun papers' processes with `jmp #0` (a trapped process is as good as dead under a cap of 8) and a paper's carpets rarely hit 6-cell targets that cannot be seen by A-field scanners. 1.65 against Hippogriff, 1.52 against the LP Destroyer.

**Recipe.** `lp-void-quartet` with STEP 78, HOP 2000, SHIFT 3961, GAP 83: the published code and layout. GAP 10 gives a 54-cell version that fits the `lp` profile.

**Fidelity.** 1.435 against 1.435; head-to-head identical to the mirror (1.530). The existing `lp-transparent-quartet` scored 1.308 and only 0.39 head-to-head against the original.

**ModelWar.** 1.16. Its clears do score against ModelWar's scanners (1.66 against clu 3, 1.50 against Drift, 1.40 against Drift v2) but it loses to the imp warriors (0.34, 0.47) and the weak three are no longer free (1.78 to 2.10).

**Lessons.** Mutual invisibility is designed field by field: zero A-fields everywhere except the one instruction a scanner tests, opposite directions within a pair, opposite parities between pairs. Multiple copies of a scanner are worth having only if they cannot find each other before they find the enemy.

---

## Hill summary

**Recurring patterns.**

- *The LP paper as a mover.* Seven of the ten carry a counted-copy paper, and all of them end with `spl home` followed by a jump into the copy guarded by its head. At 8 processes the SPL is a no-op and the paper moves instead of multiplying; a damaged copy is never entered.
- *Four jobs in one lap.* The 7-line papers copy, attack, update the attack and test in four instructions, with the attack's arithmetic in fields that already exist (the step line `{0, }0`, the restart SPL's fields).
- *Carpets for free.* Copies are 2 to 7 times the body; the blank tail is the attack that costs nothing.
- *Multi-process stones by staggered entry.* Fear and Distortion run four processes in a 3-line loop entered one line apart; the stones are finite and the paper holds the endgame.
- *Layout is a weapon.* Fear's 186-cell gap is worth 0.12; Replinator's separation of scan and paper about 0.06; the LP Destroyer's blank line about 0.4 for its stone. Trailing blank padding is worth nothing (it is empty core).
- *Stun under a cap.* Disciples' `jmp #0` bombs and the Destroyer's `jmp #1` traps rely on a trapped process being as good as a dead one when there are only 8.

**What the catalog still can't express.**

- A finite body: `lp-quad-stone` faithfully dies alone, and the gate has no contract for "ends, while a partner lives on", so it can only be built beside one.
- `par` falls into a member that is not a leaf (an `image`) at its first cell, ignoring that member's entry; padding can only follow a member whose entry is its first cell (we put it after the stone, not after the paper).
- The LP Destroyer's layout (paper, brain, stone, with the brain in the middle) cannot be made: `switch-table` always lays its code first.
- Our q^4.5 block cannot reproduce Schmidt's scanned cells, which are fixed by his table's place in a 200-cell image.
- The published dwarf of the LP Destroyer II, which dies alone, is refused by the gate (ROUTE 0 in `mismatches`).

**What transfers to ModelWar.** Very little. Every rebuild scores 0.88 to 1.24 against Decoy Adapter's 2.16. The papers depend on the cap: without it they are slow, attack-light multipliers, and lose 0.3 to 0.7 a round to every serious opponent. Two observations are worth keeping:

- Every paper beats Decoy Adapter v6.1 on the three weakest opponents (PROBE stone spl: 2.90 to 2.97 against 2.73; Skippy: 2.90 to 2.96 against 2.73; DriftLab: 2.58 to 2.72 against 2.25). A paper component is a cheap way to farm those.
- The LP Destroyer's one-process trap-then-clear stone matches Decoy Adapter against Drift (2.01 against 2.02) and Drift v2 (1.76 against 1.76) and scores 1.7 against SEMalytics and Dave, but loses badly to the two imp-based warriors (0.07, 0.13). As a switch member for stone/scanner opponents it might help; alone it does not (1.08).

No rebuild beats Decoy Adapter's level against any opponent of substance.
