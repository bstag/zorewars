# Koenigstuhl 94nop top 10: rebuilt from blocks

The ten leaders of the Koenigstuhl 94nop hill (ICWS'94, 8,000 cells, no P-space, length 100), each taken apart, rebuilt as a block tree, and played against the original. The line-by-line source notes are in [../hill-top30/94nop.md](../hill-top30/94nop.md); this file is about how each warrior works as a running program, how close the rebuild gets, and what that teaches.

The recipes are `top10-94nop-<name>` in [tools/algebra/recipes-top10/94nop.js](../../tools/algebra/recipes-top10/94nop.js). Ten blocks were added for them, in [tools/algebra/blocks/top10-94nop.js](../../tools/algebra/blocks/top10-94nop.js), tested in `test/algebra-top10-94nop.test.js`. All Redcode in the blocks was written from the descriptions here; no original is in the repository. Build one with:

```bash
node scripts/algebra.js recipe top10-94nop-kaitain --rules 94nop --length 100 --out kaitain.red
```

## How the numbers were measured

- **Hill score**: `zorewars hill <file> --hill koenigstuhl:94nop --top 30 --rules 94nop --length 100 --rounds 200`, points a round (win 3, tie 1) against the hill's top 30, which includes the warrior itself. 200 rounds per opponent, because at 20 to 50 rounds the per-opponent numbers swing by a win in four (one Excalibur run showed 17 against 6 wins over lzma2 at 40 rounds; at 200 rounds the two were 72 and 71). Expect about ±0.02 on a hill score at 200 rounds.
- **Head-to-head**: `zorewars battle rebuild.red original.red --rules 94nop -r 200`, the rebuild's wins-losses-ties and points a round. Two equal warriors score about 1.2 here, not 1.0, because ties count 1 and a win 3: 40/40/120 is 1.20.
- **ModelWar**: the rebuild compiled with `--rules modelwar --length 5040` (25,200 cells, 252,000 cycles, P-space) and played against the 17-warrior ModelWar field, 100 rounds in each load order, seed 1. References on the same field: Decoy Adapter v6.1 2.16, Trio v10 1.98, `runner-stone-imp` 1.67.

## Summary

| # | Warrior | Recipe | New blocks | Hill: original | Hill: rebuild | Head-to-head (rebuild) | First try with the old blocks* | ModelWar |
|---|---|---|---|---:|---:|---|---:|---:|
| 1 | Arvon | `top10-94nop-arvon` | `lattice-qscan` | 1.381 | 1.340 | 44-31-125, 1.29 | 1.275 | 1.36 (rescaled) |
| 2 | Azathoth | `top10-94nop-azathoth` | `lattice-qscan` | 1.359 | 1.343 | 38-45-117, 1.16 | 1.263 | 1.39 (rescaled) |
| 3 | pst_v4 | `top10-94nop-pst-v4` | `qi-qscan` | 1.325 | 1.300 | 31-35-134, 1.14 | 1.223 | 1.32 |
| 4 | King Cobra | `top10-94nop-king-cobra` | `qi-qscan`, `cobra-body` | 1.406 | 1.375 | 78-105-17, 1.26 | 0.711 | 1.91 (rescaled) |
| 5 | Kaitain | `top10-94nop-kaitain` | `lattice-qscan`, `cobra-body` | 1.435 | 1.418 | 79-106-15, 1.26 | 0.654 | 1.92 (rescaled) |
| 6 | The Collective | `top10-94nop-the-collective` | `q45-qscan`, `collective-paper` | 1.407 | 1.417 | 93-92-15, 1.47 | 0.617 | 1.56 (rescaled) |
| 7 | Tolypeutes | `top10-94nop-tolypeutes` | `q45-qscan`, `toly-pump` | 1.359 | 1.305 | 61-51-88, 1.36 | 1.166 | 1.86 (rescaled) |
| 8 | Hullab3loo | `top10-94nop-hullab3loo` | `q45-qscan`, `h-stone`, `moore-paper` | 1.363 | 1.304 | 56-55-89, 1.29 | 1.092 | 1.47 (rescaled) |
| 9 | Forgotten Lore II | `top10-94nop-forgotten-lore-ii` | `lore-vampire` | 1.345 | 1.345 | 105-94-1, 1.58 | 0.441 | 1.58 |
| 10 | Excalibur | `top10-94nop-excalibur` | `agony-body` | 1.321 | 1.292 | 88-93-19, 1.42 | 0.259 | 1.61 (rescaled) |

\* The nearest tree from the blocks that existed before this work (the "Nearest blocks" of the top-30 review), 50 rounds per opponent. Every rebuild's head-to-head is within a few wins of even.

The ten new blocks:

| Block | Kind | What it is | Used by |
|---|---|---|---|
| `lattice-qscan` | opening | Metcalf's 30-line lattice quickscan with its two-stream burst built in | Azathoth, Arvon, Kaitain |
| `qi-qscan` | opening | inversed's two-factor q^i with its burst; FORM 0 (six straight units) and FORM 1 (King Cobra's cross pairs) | pst_v4, King Cobra |
| `q45-qscan` | opening | van Rijn's q^4.5 with its burst, table first so the cells spread | Collective, Tolypeutes, Hullab3loo |
| `cobra-body` | body | King Cobra's oneshot, clear and imp, with an optional copy of its own two-cells-a-pass boot | King Cobra, Kaitain |
| `agony-body` | body | Excalibur's two-look scanner, fixed wipe and self-triggered clear | Excalibur |
| `lore-vampire` | body | Forgotten Lore II, island for island | Forgotten Lore II |
| `collective-paper` | body | the counted-copy paper with three bombs per copied cell | The Collective |
| `toly-pump` | body | Tolypeutes' one-process continuous imp pump | Tolypeutes |
| `h-stone` | body | Hullabaloo's step-17 stone that lays runs of bombs per wave | Hullab3loo |
| `moore-paper` | body | the six-line looping bombing paper of Hullab3loo and Borgir | Hullab3loo |

## 1. Arvon (Stefan Kammann & Forge-AI)

**What it is.** Azathoth with re-tuned constants: a lattice quickscan, then a fan boot that starts a stone and a paper in one go. The quickscan and boot are Metcalf's; the numbers came from a model of scan coverage.

**How it works.**

1. *Quickscan (30 lines, about 20 cycles when nothing is there).* Six units of three lines look at 24 cells. Each unit compares two cells with SNE; if they are equal its SEQ compares two more, and the SEQ's first operand is a predecrement through one of six table rows, so it both reads a cell and changes the row. The rows are B-fields of lines that are there anyway (two exits, two DATs, the last unit's jump, the bomb). A unit that sees a difference jumps to the decoder after its jump line has nudged one of three A-fields (`}`, `{`, `djn.a`), which is how the decoder knows which row fired. Then: `mul.b` turns the pointer's B (the constant `qdec = 1 + 1/qfac`) into the address of the pair's first cell, an `sne` against an empty cell picks the occupied one of the pair, and the burst lays 15 pairs of DATs 9 apart, one on the pointer and one 67 below it through the A-field of the bomb just written (two bombs per four cycles). The exits jump to the boot.
2. *Boot (9 lines).* `spl 2 / spl 1 / spl 1` makes six processes in lockstep. Each runs `mov <p, {p` and `mov <sgo, {s` once, so six cells of the paper and six of the stone are copied, and the A-fields of `s` and `p` end up pointing at the copies. Each process then runs `spl sboot / spl *s / spl *s / djn.f pboot`: three groups of six enter the stone, six enter the paper. The source image (81 cells) stays behind, unerased, as a decoy.
3. *Stone (6 cells, 18 processes).* `spl #0` keeps feeding. Each pass bombs `dat }2431, >1` at the B pointer, `sub.x #4862` moves that pointer back two steps, and `mov {back, }first` writes once more through the A-field of the next target while dragging a decrement trail; `djn.f` loops. The first target is chosen so that after `time/2 = 735` passes the bomb lands on the stone's own `sub.x`; from then on only `spl #0 / mov` run, and the stone is a process sink. Measured alone: the `sub.x` is overwritten at cycle 5,576.
4. *Paper (5 lines, 6 processes).* Each lap starts the six processes 1,365 cells on, and three copy lines write into one shared destination: the body, then the cells after it upward and downward through a second source pointer, so every copy lands with an erased tail. `jmz.f` drops a copy whose trailing cell is not empty, so a hit copy dies instead of spreading the damage.

**Why it is strong here.** It does three jobs in under 30 cycles of setup: the quickscan kills slow starters, the stone covers the core while the paper is small, and once the stone sleeps the paper has every process slot. The stone sleeping on time matters: a stone that keeps bombing would eventually hit its own paper.

**Recipe.** `seq(lattice-qscan{QFAC 163, GAP 67, STEP 9, TIME 15}, runner-paper-stone{K 3, SHOP 3200, PHOP 837, STEP 2431, TIME 1470, BACK -2122, PSTEP 1365})`. `runner-paper-stone` (added for Azathoth on ModelWar, `runner.js`) already was this boot, stone and paper; the lattice was the missing part. The quickscan's 24 compiled scan lines are identical to the original's (same cells relative to the pointer).

**Fidelity.** Hill 1.340 against 1.381; head-to-head 44-31-125. Two changes moved it: the lattice instead of `opening-qscan-mul` + `probe-burst2` (1.275 at 50 rounds to 1.319), and placing the paper copy 2,357 cells below the stone copy as the original does (PHOP 843 to 837: 1.319 to 1.340). The remaining gap is uncertain; the rebuild is 51 cells against the original's 81, so the dead image it leaves is smaller.

**ModelWar.** The 8,000-cell lattice factor 163 puts a scanned cell on the warrior at 25,200 cells, so the tree was rebuilt with QFAC 24667 (searched for spread) and the distances scaled by 3.15: **1.36**. It wins nearly every round against the three stones and scanners at the bottom of the field (2.73 to 2.98 against PROBE, Skippy and DriftLab) and ties or loses everything else; papers and stone/imps there are made for 25,200 cells and fill it faster.

**Lessons.** Where two bodies sit relative to each other is a parameter in its own right: six cells of offset were worth 0.02. The lattice beats our generic MUL scan by about 0.05 in the same tree.

## 2. Azathoth (John Metcalf)

**What it is.** The original of the Arvon line: the same quickscan, boot, stone and paper with Metcalf's own constants (`qfac 1533`, burst 21 passes of 7, second stream 80 below; stone back trail at -2129).

**How it works.** As Arvon, step for step. The layout is boot, stone, paper, 50 blank cells, quickscan last, so the dead image is the full 100 cells. Measured alone: the stone's `sub.x` is overwritten at cycle 5,576, the same moment as Arvon's, because the stone's numbers are the same; about 2,100 processes are alive at the end, almost all paper.

**Why it is strong here.** As Arvon. The stone covers the opening of the round (5,500 cycles is about 700 bombs spread over the core, two directions a pass), which is when the hill's scanners and stones are most dangerous to a small paper.

**Recipe.** `seq(lattice-qscan{QFAC 1533, GAP 80, STEP 7, TIME 21}, runner-paper-stone{... BACK -2129 ...})`.

**Fidelity.** Hill 1.343 against 1.359; head-to-head 38-45-117 (1.16). This is the closest of the paper/stones.

**ModelWar.** Rescaled as Arvon (QFAC 24667, distances x3.15): **1.39**. The same picture: 2.73 to 2.97 against the three weakest, about 1.0 elsewhere.

**Lessons.** The whole design is 50 lines of code and still the hill's #2: a 30-line scan, a 9-line boot that gives each body its own process count, a 6-line stone that switches itself off and a 5-line paper. Nothing in it waits or checks anything except the paper's one `jmz.f`.

## 3. pst_v4 (Stefan Kammann & Forge-AI)

**What it is.** Arvon's boot, stone and paper behind inversed's q^i quickscan (taken from clrsrc/Eternal Exile).

**How it works.**

1. *Quickscan (34 lines).* The cell `found` is `mov qxa, }qxb`: its two fields are two unrelated locations. Each of six units compares an A location with a B location (`sne X+qxa*f, X+qxb*g`) and both again 3,949 further on (`seq`), where (f, g) is (1, 1), a table row, a decremented row, or a squared row. The jump line of each unit sets up the decoder: plain `jmp dec0de`, `jmp dec0de, <dec1` (point at the other row), `djn.f dec0de, qtab` (decrement the row), `djn.f dec0de, found` (decrement the factors), or `jmp dec1` (`mul.x` squares the row first). Then `mul` multiplies both fields of `found` by the row, `sne *found, @found` checks whether the first pair differed (if not, `add qinc` moves both to the second pair), `seq nil, *found` asks whether the A cell is empty, and if it is not, `mov.x` swaps it into the B-field. The burst: 21 DATs 9 apart from `found.B`, and `mov qxa, }qxb` at `found` itself copies the A cell (normally empty) 67 below each bomb.
2. *Boot, stone, paper.* Arvon's, byte for byte.

**Why it is strong here.** As Arvon; the q^i finds the same 24 cells as the lattice in 4 more lines, and its pairs are unrelated places, so a single scanner bomb or decoy is less likely to look like two of its cells.

**Recipe.** `seq(qi-qscan{FORM 0, A0 3325, B0 7515, A1 3270, B1 3495, A2 5778, B2 4498, STEP 3949, BSTEP 9, BHOP 67, BCOUNT 21}, runner-paper-stone{...Arvon's...})`. The compiled quickscan is identical to the original's, line for line, except the distance of the exit jump.

**Fidelity.** Hill 1.300 against 1.325; head-to-head 31-35-134. The existing `opening-qscan-qi` with the same constants scored 1.237; its unit order is different (it has an R row where pst_v4 squares T) and its burst is a separate block.

**ModelWar.** Built unchanged (the q^i cells are valid on 25,200): **1.32**; the same pattern as Arvon.

**Lessons.** The decoder costs 0 to 2 MULs; a faithful q^i with its burst in one block gained 0.06 over the generic one. Arvon (lattice, 1.381) beat pst_v4 (q^i, 1.325) with the same payload, which is the authors' own evidence that on this hill the lattice is the better 24-cell scan.

## 4. King Cobra (inversed)

**What it is.** A oneshot: scan until there is evidence of a real body, then clear from there, with an imp as insurance.

**How it works.**

1. *Quickscan (34 cells in 41 lines).* q^i with seven four-cell units whose second pair is the cross pair (A·B2, B·A2), then three two-cell units of cross pairs. The decoder has one extra line, `fast mul.x q2, q0`, which turns a pair into its cross pair; the jump lines choose among `decide`, `decode`, `djn.f` on the factors or the row, `<qbomb` (other row) and `}decode` (square the factors). Burst: 20 DATs 5 apart, and the other probe cell copied 78 below each.
2. *Boot (6 lines, 20 cycles).* `mov {from, {btptr / mov <from, <btptr / djn boot, #6`: two fields of one pointer copy the 6-line scanner to +6055 and the 6-line clear 17 cells below it, two cells a pass. `spl` starts the copied scanner, `mov.f #0, {0` erases the pointer, and the boot process dies on the DAT after it.
3. *Scan (4 lines, 1 process).* The scan's two pointers live in the clear's first cell, 11 apart. `sub inc, @3` moves both by 19 (the step is set by where `inc` sits relative to that cell); `seq` compares the pair (both pointers predecremented); if it differs, `sne` compares the pair one below; only if that differs too does it fall through to commit. So a lone bomb or a single decoy cell does not trigger it: it needs two adjacent occupied cells. The loop's `djn.f` also decrements the scanned cell.
4. *Commit.* `spl *bptr` starts the clear at its pump, and the scanning process falls onto `mov.i #4000, 1` and crawls away as an imp.
5. *Clear (6 lines).* `spl #124` pumps processes into `mov *bptr, >cptr` twice and `djn.f clear, }cs0`. It lays the SPL `spl #124, 1077` forward from just below the find; when the front comes round onto `cptr`, that bomb's B resets the pointer 1,077 cells on, past the clear, the scanner and the imp's first stretch. The `djn.f` B-operand walks a decrement stream up from the pump; when it has come all the way round it decrements `bptr` (`dat 1, 9` becomes `dat 0, 8`), `*bptr` then names `bptr` itself, and the clear lays DATs with an 8-cell skip from then on. Measured alone: the scanner commits at cycle 1,236 (on its own abandoned original), and the clear switches to DAT at cycle 25,519.

**Why it is strong here.** Most of the hill is paper/stone. The scan finds a body within a few hundred cycles, the SPL pass freezes the paper and stone at once (every process that runs a SPL bomb spawns into more SPLs), and the DAT pass, 24,000 cycles later, kills what is frozen. The imp is a tie when the clear dies. The two-pair test keeps it from committing to the decoys and bomb fields that paper/stones leave.

**Recipe.** `seq(qi-qscan{FORM 1, A0 5340, B0 4327, A1 2215, B1 2487, A2 4665, B2 2698, BSTEP 5, BHOP 78, BCOUNT 20}, cobra-body{BOOT 6055})`. `cobra-body` emits the clear, 11 empty cells and the scanner (the step is the layout), and with BOOT it adds King Cobra's own boot after itself.

**Fidelity.** Hill 1.375 against 1.406; head-to-head 78-105-17. The path there:

| Tree | Hill (200 rounds unless noted) |
|---|---:|
| `opening-qscan-qi` (defaults) + `probe-burst2` + `boot(oneshot-cobra-imp)` | 0.711 (50) |
| the same with `cobra-body` under `boot{WIPE 1}` | 1.147 |
| `qi-qscan` FORM 1 with King Cobra's numbers instead | 1.304 |
| imp A-field 4,000 instead of 0 | 1.318 |
| `cobra-body`'s own boot instead of the boot combinator | **1.375** |

The last step is the boot's speed: the combinator copies all 23 cells, one a pass (about 50 cycles); King Cobra's copies only the 12 live cells, two a pass (20 cycles). The old `oneshot-cobra-imp` is a different machine (28 cells, a 3-instruction scan, a timer-free SPL pass); it is half as strong.

**ModelWar.** Unchanged numbers: **1.86**; with the scan offset, boot distance and wrap skip scaled by 3.15 (ZOFS 7472, BOOT 19073, SKIP 3393): **1.91**. Against Decoy Adapter v6.1 (2.16) per opponent it is better on 02_Lisan_Al_Gaib (2.06 against 1.88 unchanged), 02c_orn5 (2.36 against 2.28 rescaled), 07_Drift_v2 (2.44 against 1.76), 08_mercenary (1.95 against 1.60), 09_MWClient (2.31 against 2.17) and 10_InnovationStation (1.63 against 1.54); it is far weaker against SEMalytics, Dave, spellbinder and the three stones.

**Lessons.** For a one-process scanner, cycles before the first look are worth more than anything else we measured: 30 cycles of boot were worth 0.06. Two-pair commitment is cheap (one extra SNE) and makes the oneshot immune to single-cell decoys. A DJN stream from the clear's own pump is a timer that costs no instruction.

## 5. Kaitain (Stefan Kammann & Forge-AI)

**What it is.** King Cobra's boot, scanner and clear behind the Metcalf lattice (Azathoth's factor 1533, Arvon's burst). Kaitain is #5 on the hill, one place below King Cobra, but measured the higher score of the two against the top 30 here (1.435 against 1.406).

**How it works.** The lattice of Arvon (section 1), then King Cobra's body (section 4), unchanged: step 19, pair 11 apart, boot distance 6055, the 1,077 skip and the 124 stream start. 48 code lines.

**Why it is strong here.** The lattice is 11 lines shorter than King Cobra's q^i for 10 fewer cells, and starts the scanner sooner; on this hill that trade wins.

**Recipe.** `seq(lattice-qscan{QFAC 1533, GAP 67, STEP 9, TIME 15}, cobra-body{BOOT 6055})`.

**Fidelity.** Hill 1.418 against 1.435; head-to-head 79-106-15. With the boot combinator instead of the own boot it was 1.340; with `opening-qscan-mul` and the old oneshot, 0.654.

**ModelWar.** Lattice factor 1533 has no inverse mod 25,200; with QFAC 24667 and King Cobra's body rescaled: **1.92**, within 0.06 of Trio v10 (1.98), the best of the ten. Better than Decoy Adapter v6.1 on 02b_orn7 (2.14 against 2.10), 02c_orn5 (2.36 / 2.28), 07_Drift_v2 (2.26 / 1.76), 08_mercenary (1.89 / 1.60), 09_MWClient (2.29 / 2.17) and 12_Drift (2.04 / 2.02). A longer scan step (37, a wider gap between clear and scan) scored 1.80, so the 19-cell step stays.

**Lessons.** A quickscan swap alone moved King Cobra's body from 1.375 to 1.418: the same body is worth more behind a shorter scan.

## 6. The Collective (Roy van Rijn)

**What it is.** A q^4.5 quickscan, then a fast unrolled boot of a Borg-style paper that bombs three times for every cell it copies.

**How it works.**

1. *Quickscan (34 cells).* Six units decoded by one MUL with multiplier `qz`, then a SEQ through `>qptr` that tests `qptr + qz` and bumps the multiplier to `qz + 1`, then three two-line units that reuse the rows the first pass decremented (`(qz+1)(V-1)`), and a last single cell. The relation that makes one MUL enough: each row holds `V = 1 + qy·(row - qptr)` with `qy·(qz - 1) = 1`, so a SEQ that predecrements through the row reads the same cell as `qptr + qz·(V - 1)`. Burst: 19 passes of 6, a second stream 87 below.
2. *Boot.* Ten unrolled `mov.i` lines copy the 10-line paper 7,661 cells away, and one `jmp` enters the copy at its second line (11 cycles).
3. *Paper (10 lines, one process to start).* A counted loop copies the body top-down (10 cells the first time, then 23: the body and 13 cells of carpet). Every copied cell also costs three attacks: a `dat <6, <1` at `bPtr + B`, a cell moved beside that bomb through its A-field, and, after `add <0, >0` doubles both of `bPtr`'s fields, a second DAT at `bPtr + A`. When the count is done, `spl >pGo` starts a new process at home (whose first line resets the count to 23) and the old one jumps into the copy if the cell after it is empty. Each copy then does the same, so the processes double every generation: about 25 alive at the end alone, but over 2,400 cells executed.

**Why it is strong here.** Against paper/stones its doubling walks and the moved cells spread damage the way a stone would, while it replicates; it is the paper here that kills papers (86 wins of 100 against lzma2). One process per copy keeps it fast at the start.

**Recipe.** `seq(q45-qscan{QZ 438, PAD 16, GAP 87, STEP 6, TIME 19}, boot{HOP 7661, DIRECT 1}(collective-paper))`. `q45-qscan` puts its table first and PAD empty cells before the scan, because the 33 cells a q^4.5 tests are only about as far apart as its rows are from `qptr` (the originals keep their rows 75 to 95 cells away, inside their boots); QZ 438 is the best spread for that layout (no two cells closer than 49). The original's scan cells are not reproduced, only the method.

**Fidelity.** Hill 1.417 against 1.407; head-to-head 93-92-15. The path: `lp-paper` 0.617 (50 rounds); `collective-paper` behind `opening-qscan-mul45` + `probe-burst2` 1.287; behind the lattice 1.370; behind `q45-qscan` 1.383; with the unrolled boot 1.417.

**ModelWar.** Unchanged: **1.49**; rescaled (QZ 230 for the bigger core, distances x3.15): **1.56**. Its best results are against the same three weak stones (2.65 to 2.98) and against NovaBomber (1.59).

**Lessons.** The paper's three bombs per copied cell are the strength; `lp-paper`, our Borg-like block, scored half. The generic q^4.5 block (`opening-qscan-mul45` with a separate burst) costs about 0.1 against a faithful one in every tree it was tried in.

## 7. Tolypeutes (Roy van Rijn)

**What it is.** A q^4.5 quickscan, then stone/imp: an Armadillo stone that turns into a clear, and a one-process continuous imp pump.

**How it works.**

1. *Quickscan.* As The Collective's (the same 34 cells and numbers; the table rows sit in the boot's SPL B-fields).
2. *Boot.* One line plants the imp instruction far away (the pump copies it from there); `spl iBoot` sends one process to copy the 4-line pump; a 4-process fan copies the 8-line stone to +7116 and enters it with all four.
3. *Stone (8 cells, 4 processes).* `spl #2090, <-2090` feeds. Each pass copies a cell from an A-side trail to a B-side target, bombs the B pointer's cell with `dat <1, 47`, adds (+2090, -2090) to both pointers so they walk apart, and `djn.f @-1, *-3` decrements through the trail. The trail eventually copies the stone's own SPL over the `djn.f`, and the processes fall into `mov sBomb, >sGate / djn.f -1, >sGate`, a forward clear whose bomb B-field (47) resets the gate past the stone on each wrap. Measured alone: the switch happens at cycle 4,292.
4. *Imp pump (4 lines, 1 process).* `spl #` pump; `sub.x` moves the launch vector on 2,668 a pass; `mov.i iAway, }-2` lays a fresh `mov.i #1, 2667` one cell further on each pass; `djn.f` launches one process down the vector. Each launch lands one ring step and one cell past the last, so the spiral keeps gaining imps. Measured alone: 20 to 32 imps alive from cycle 10,000 to 60,000.

**Why it is strong here.** The stone's clear handles papers that survive the bombing; the spiral turns losses into ties against everything that cannot stop imps. Continuous pumping rebuilds the spiral after a clear passes.

**Recipe.** `seq(q45-qscan{..., STEP 7}, fanboot{N 4, K 1, SPLIT 1, MOREA 1, HOPA 7116, HOPB 6860}(armadillo-switch{STEP 2090, HOP 46, STREAM 1}, toly-pump{IDEST 7402}))`. `fanboot` refuses hops closer than 256, so the pump sits 248 cells below the stone instead of 227; IDEST puts the first imp where the original's goes relative to the stone (846 below). `toly-pump` copies its imp from its own fifth cell instead of a planted far copy.

**Fidelity.** Hill 1.305 against 1.359; head-to-head 61-51-88 (1.36: the rebuild wins slightly more than it loses). From 1.166 (`opening-qscan-mul45`, `compact-imp-pump`); `STREAM 1` and `toly-pump` added about 0.02, the quickscan 0.11. The remaining gap is uncertain: the planted imp source and the exact 230-cell spacing are the known differences.

**ModelWar.** Three divides 25,200, so `toly-pump` falls back to a 13-point spiral there; with the q^4.5 retuned (QZ 230) and the hops scaled: **1.86**, the third best of the ten. It beats Decoy Adapter v6.1 on 03_clu_3 (1.81 against 1.73) and 07_Drift_v2 (1.92 against 1.76), and is close on Lisan, spellbinder and MWClient; the stone/imp is mostly a tie machine there (1.6 to 2.1 against most of the field).

**Lessons.** The Armadillo switch (a trail that copies the stone's own SPL over its loop) is a timer with no counter. A one-process pump is enough for a three-point spiral when it pumps for the whole round.

## 8. Hullab3loo (Roy van Rijn)

**What it is.** q^4.5 quickscan, then a paper/stone fan boot: a stone with step 17 that lays runs of bombs, and Moore's six-line paper.

**How it works.**

1. *Quickscan (33 cells).* The q^4.5 of section 6, in the 33-cell form (six units, the bump, three two-line units, a last `jmz.f`), with `qz 3972`. The table is two DATs, the boot's three SPL B-fields and the bomb.
2. *Boot.* The stone's bomb is planted 7,735 cells from the stone first (so a scanner that finds the stone does not find its bomb). `spl }2 / spl 1 / spl 0` is a six-way fan (the `}2` turns the `spl 0` into `spl 1` for the second visitor). Twelve processes enter the stone at +4854, six the paper at +562.
3. *Stone (5 lines, 12 processes).* `spl #0`; `mov bomb, @hPtr`; `add #34, hPtr`; `mov bomb, }first`; `djn.f -3, {2926`. The second MOV writes through the A-field of the cell 34 on: an empty cell takes the bomb itself, but a bombed one (`dat }17, >1`, A = 17 and counting up) passes the bomb 17 and more cells on, so the twelve lockstep processes lay a short run there. The first target is aimed to hit the stone's own ADD, by my arithmetic about 3,700 passes in (uncertain: the runs depend on how the waves interleave). Measured alone, the ADD was still intact at cycle 40,000, when a copy of its own paper landed on the stone, so in that run the stone bombed for half the round and the planned self-hit never came first.
4. *Paper (6 lines, 6 processes).* `spl 561, {3` starts one process in the next copy and counts down the copy line's source; `mov }2, }-1` copies the body one cell per process; `mov pBmb, >7157` drops a `dat <5334, <2667` per process; `mov 3, }-3` erases one cell after the copy per process; `jmz.f -4, *-1` loops while the cell after the body is empty. Each lap the next copy goes 12 cells further.

**Why it is strong here.** The step-17 runs carpet the core densely (17 is small, so the runs fill in between earlier ones), and the anti-imp DATs from the paper take care of spirals.

**Recipe.** `seq(q45-qscan{..., STEP 7}, fanboot{N 6, K 2, HOPA 4854, HOPB 556}(h-stone, moore-paper))`. `h-stone` keeps its bomb as its sixth cell instead of planting it far away.

**Fidelity.** Hill 1.304 against 1.363; head-to-head 56-55-89. The first attempt with `run-stone` and `loop-paper6` scored 1.092. With `h-stone` and `moore-paper` at the original hops it fell to **0.868**: the stone's runs carpeted the paper's copies, because the fan boot puts the copies six cells further apart than the original's boot. Matching the original's 4,292-cell stone-to-paper distance (HOPB 562 to 556) gave 1.201, and `q45-qscan` 1.304.

**ModelWar.** Unchanged: **1.31**; rescaled: **1.47**.

**Lessons.** A stone and a paper booted side by side are tuned as a pair: a six-cell change in their distance cost a third of a point. The fan boot combinator should be able to state the distance between its copies directly (it states each hop from a different origin).

## 9. Forgotten Lore II (David Moore)

**What it is.** A scanning vampire that throws DJN bombs, waits for a prisoner before clearing, and uses its own bombs as its timer. 22 instructions spread over 100 cells.

**How it works.**

1. *Setup, folded into the loop.* Four setup lines sit in front of the loop, and `jmz.f boot, <bite` jumps back to them; each pass runs the remaining ones and then blanks the first, so the loop is 7, 6, 5, 4 and then 3 lines long. They write three trap pointers at bite+217 to 219 (the middle one points at the trap, the others at the lines beside it, in case a fang lands one off), and copy the three trap lines 6,619 cells away as a decoy and second trap.
2. *Scan (3 lines, .33c).* `sub.x #23, bite` moves the fang's A up 24 and its B down 23 (the `.x` subtracts the SUB line's own B-field, bite - loop = -24, from the A-field: the step is the layout again); `mov b2, *bite` throws `djn.f #1, 1` at the A side; `jmz.f boot, <bite` moves B down one more and looks there. Step 24 on 8,000 cells visits one cell in eight on each side.
3. *Bite.* A non-empty cell gets the fang `jmp @335, -117+...`: A + B stays 218, so the fang jumps through bite+218 into the trap. `jmz.f loop, flag` keeps scanning while the flag is clean.
4. *Trap.* `spl -1, <flag`: a prisoner dirties the flag and spins between `spl #124` and the trap; `spl #4000, }1` counts prisoners into `jmn.a`'s A-field, and when all 8,000 slots have passed it they fall onto a DAT.
5. *Timer.* The A side's lattice comes round onto the flag itself: its residue (7 mod 8 from bite) holds the flag, and it reaches the flag at pass 986, before either side reaches a live cell of its own (the B side reaches the outer trap pointer in the same pass, which is why there are three). So with no prisoner, the scan ends on its own. Measured alone: the clear starts at cycle 2,970.
6. *Clear.* `spl #11` pumps two streams of SPLs from the gate cell's two pointers (`dat 25, 3987`); `jmp -2, <-3` counts the SPL's B-field down from 6,568, and when it reaches 1 the SPL's own `{1` turns `mov -1` into `mov -2`, and both streams lay `dat <2667, 9` from then on. A wrap over the gate resets its pointers past the clear (11, and 9 for the DAT).

**Why it is strong here.** A process that runs `djn.f #1, 1` jumps to itself and decrements the next cell until both its fields reach zero: it is stalled, and the instruction after it is damaged. Thrown over a stone or clear of the `spl 0 / mov / djn.f -1, >x` kind (the pattern the source's comment names), that stalls the loop. The vampire turns scanned papers' processes into prisoners that feed nothing, and the clear comes only after it has caught something (or its timer fires), so it does not spend its SPL pass while there is still scanning to do.

**Recipe.** `lore-vampire` alone. At its defaults the block compiles to the original's 99 instructions exactly (the check is in the test file, on structure only). `mismatches` checks the timer for any other step: the A side must reach the flag before either side reaches a live cell.

**Fidelity.** Hill 1.345 against 1.345; head-to-head 105-94-1. The old `djn-vampire` (described as "the same design") scored 0.441: it guards its throws with an SLT, has a counted one-lap clear and no timer.

**ModelWar.** Its defaults build on 25,200 cells unchanged (the timer is a residue argument and still holds): **1.58**. It scores 2.89 against NovaBomber (the reference 2.81) and beats the reference on 03_clu_3 (1.95 against 1.73), but loses to the three stones the papers beat (1.38 to 1.59).

**Lessons.** Layout as arithmetic: the step is the distance between two lines, the timer is a residue class, the trap pointer is a sum kept constant. A block catalog that lays code out contiguously cannot express this; the block has to own its 99 cells.

## 10. Excalibur (inversed)

**What it is.** A rework of Agony II: a decoy, a fast boot, and a one-process scanner that wipes what it finds with 16 SPLs and turns into a clear when it finds itself.

**How it works.**

1. *Decoy (51 cells).* SPLs that differ only in modifier, so every adjacent pair differs under a `.I` compare: compare scanners and quickscans stop here and spend their attack on it.
2. *Boot.* 11 unrolled `mov >bp, }bp` copy the first 11 scanner cells 1,423 away; `spl` starts the copy at its 12th cell (`jmz.a scan, scan-1`, which jumps to the scan since the cell before the copy is empty), and 5 more MOVs copy the rest behind it while it scans. The boot process then dies. Eleven lines that mirror the boot and scanner (never run) sit around them; their purpose is uncertain.
3. *Scan (6 lines, two looks a lap, .66c).* `sub *y, @x` adds the step (3147) to both pointers, `sne` compares a pair 8 apart; equal: `sub` again and `seq` the next pair; a difference reaches `slt #27, @x`, which skips finds within 27 cells of the pointer (its own code); `djn.f scan, <scan-344` loops with a decrement stream walking down.
4. *Wipe.* `mov.b @x, #0` points 5 past the find, and eight passes of two `mov inc, <bptr` lay 16 SPLs down to 11 below it. `jmz.a scan, scan-1` returns to the scan while the cell before the scanner is still empty.
5. *Clear.* After 8,000 looks the B pointer comes round to the scanner itself; the wipe then covers the scan lines and the cell before them, the `jmz.a` falls through, and `spl #-3147` pumps `mov kill, >y / djn.f clear, {y`: DATs forward from the wipe's pointer, skipping 10 cells past `y` on every wrap. Measured alone: the clear starts at cycle 21,030.

**Why it is strong here.** It scans twice as fast as a single compare loop, the 16-SPL wipe stuns the area around a find without having to decode which cell was hit, and the pumped DAT clear at the end cleans up whatever the wipes stunned.

**Recipe.** `image(boot{HOP 1423, DIRECT 1}(agony-body), decoys-mixed{COUNT 51})`. `agony-body` adds an empty cell in front of the scanner (the original relies on the copy landing in empty core).

**Fidelity.** Hill 1.292 against 1.321; head-to-head 88-93-19. The path: `pair-wipe-scanner` 0.259 (50 rounds); `agony-body` under the looping boot 1.198; under the unrolled boot (`DIRECT 1`) 1.283; with the decoy 1.292. For comparison the original without its decoy (every decoy SPL replaced by an empty cell, a local experiment) scored 1.287, so the rebuild matches the original's engine and gets 0.01 of the decoy's 0.03.

**ModelWar.** Step 3147 shares a factor with 25,200; with STEP 9913 and the distances scaled: **1.61**. Per opponent it is the most uneven of the ten, and the best against several: 07_Drift_v2 2.52, 09_MWClient 2.48, 10_InnovationStation 2.12, 08_mercenary 1.85 and NovaBomber 2.89, all above Decoy Adapter v6.1 (1.76, 2.17, 1.54, 1.60, 2.81); but it loses to PROBE, Skippy and DriftLab (1.0 to 1.3), which every paper here beats.

**Lessons.** Again boot speed: 85 thousandths of a point from starting the scanner some 20 cycles sooner. The decoy is worth 0.03 to the original. Behind the slow boot our mixed decoys lowered the rebuild (1.14 to 1.20 against 1.20 without); behind the fast one they added 0.01. A decoy is only worth what the body behind it does with the time it buys.

## What the hill teaches

**Recurring patterns.**

- *Three quickscans, all MUL-decoded, all with a two-stream burst built in.* Metcalf's lattice (24 cells, 30 lines), inversed's q^i (24 or 34 cells), van Rijn's q^4.5 (33 or 34 cells). Our generic versions with a separate `probe-burst2` cost 0.05 to 0.11 in every tree. The burst being part of the decoder saves the setup cycles and the separate pointer.
- *Bodies whose numbers are their layout.* King Cobra's step is the distance from its clear to its scan; Lore's step is the distance from its fang to its loop, and its timer is a residue class; Azathoth's stone stops when its own bomb reaches its own SUB. These designs have no counters: the geometry is the counter.
- *Boots are sized to the body.* Each warrior boots the way its body needs: a lockstep fan for multi-process bodies (Azathoth, Hullab3loo, Tolypeutes), a two-cells-a-pass copy of just the live cells for King Cobra, unrolled MOVs with an early start for the one-process scanner and paper (Excalibur, The Collective). Generic boots cost up to 0.09.
- *Timed endings everywhere.* Azathoth's stone sleeps at cycle 5,576, Tolypeutes' stone becomes a clear at 4,292, Lore's scan ends at 2,970, King Cobra's SPL clear turns DAT at 25,519, Excalibur's scan becomes a clear at 21,030. None of them uses a counter instruction except Lore's clear.
- *Relative placement is tuned.* Hullab3loo's stone and paper, Azathoth's stone and paper, Tolypeutes' stone and imps: a few cells of difference cost 0.02 to 0.3.

**What the catalog still cannot express.**

- A body that interleaves with another (Lore's islands, Excalibur's mirror lines, a q^4.5 whose rows sit inside the boot's SPLs): blocks are contiguous, so `q45-qscan` keeps its own table and pays 8 cells plus padding for the spread the originals get for free. `claimsFreeB` exists for this but only for B-fields of later runs.
- `fanboot` cannot place two copies closer than 256 cells (Tolypeutes uses 230), and states each hop from a different origin, so matching an original's stone-to-paper distance takes arithmetic by hand.
- A planted remote cell (Hullab3loo's far bomb, Tolypeutes' far imp source): a block can only write its own cells before it runs; both rebuilds keep the cell local.
- `boot` has no "copy only the live cells, two a pass" mode and no early start for one-process bodies except `DIRECT` (which cannot wipe). `cobra-body` carries its own boot instead.
- Our blocks' contracts do not say *when* a timed ending fires. The measured cycles above came from a separate simulation, not the gate.

**What looks useful on ModelWar.** Field averages (17 opponents, 100 rounds each way, seed 1), against Decoy Adapter v6.1 2.16 and Trio v10 1.98:

| Rebuild on 25,200 cells | Average | Opponents where it beats Decoy Adapter v6.1 |
|---|---:|---|
| Kaitain (rescaled) | 1.92 | 02b_orn7, 02c_orn5, 07_Drift_v2, 08_mercenary, 09_MWClient, 12_Drift |
| King Cobra (rescaled; 1.86 unchanged) | 1.91 | 02_Lisan_Al_Gaib (unchanged numbers), 02c_orn5, 07_Drift_v2, 08_mercenary, 09_MWClient, 10_InnovationStation |
| Tolypeutes (rescaled, 13-point pump) | 1.86 | 03_clu_3, 07_Drift_v2 |
| Excalibur (rescaled) | 1.61 | 07_Drift_v2, 08_mercenary, 09_MWClient, 10_InnovationStation, 13_NovaBomber |
| Forgotten Lore II | 1.58 | 03_clu_3, 13_NovaBomber |
| The Collective (rescaled) | 1.56 | 14_PROBE, 18_Skippy, 19_DriftLab |
| Hullab3loo (rescaled) | 1.47 | 14_PROBE, 18_Skippy, 19_DriftLab |
| Azathoth / Arvon / pst_v4 | 1.39 / 1.36 / 1.32 | 14_PROBE, 18_Skippy, 19_DriftLab (2.7 to 3.0 each) |

- **The King Cobra oneshot (`cobra-body`) is the part to take.** Behind either quickscan it scores 1.91 to 1.92 with numbers only scaled, not tuned, and beats the live entry on the Drift/MWClient/mercenary/orn group. As a switcher member it would cover the opponents Decoy Adapter is weakest against (07_Drift_v2 1.76, 08_mercenary 1.60, 10_InnovationStation 1.54).
- **Excalibur's scanner (`agony-body`) is the specialist**: 2.12 to 2.89 against InnovationStation, MWClient, Drift_v2 and NovaBomber, but it loses to the three stones (1.0 to 1.3). A switcher member, not an entry.
- **The paper/stones win almost every round against PROBE, Skippy and DriftLab** (2.7 to 3.0, the reference 2.25 to 2.73) and are below 1.2 against everything else. Only useful as a branch a switcher picks against stones.
- **Tolypeutes' stone/imp** (1.86) mostly ties; it is the most even of the ten across the field.
- None of these numbers were tuned for ModelWar beyond scaling distances by 3.15 and picking scan factors that are units mod 25,200 (and one step test on Kaitain). They are a first look, not entries; no ModelWar upload or challenge was made.
