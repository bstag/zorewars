# Koenigstuhl Tiny top 10: rebuilt from blocks

The ten leaders of the Koenigstuhl Tiny hill (ICWS'94, 800 cells, 20 instructions, 8,000 cycles, 800 processes, minimum distance 20), each taken apart, rebuilt as a block tree, and played against the original.

The recipes are `top10-tiny-<name>` in [tools/algebra/recipes-top10/tiny.js](../../tools/algebra/recipes-top10/tiny.js). Eight blocks were added for them, in [tools/algebra/blocks/top10-tiny.js](../../tools/algebra/blocks/top10-tiny.js), tested in `test/algebra-top10-tiny.test.js`. All Redcode in the blocks was written from the descriptions here; no original is in the repository. Build one with:

```bash
node scripts/algebra.js recipe top10-tiny-consonance --rules tiny --length 20 --out consonance.red
```

## How the numbers were measured

- **Hill score**: `zorewars hill <file> --hill koenigstuhl:tiny --top 30 --rules tiny --rounds 500`, points a round against the hill's top 30 (the warrior itself included). A tiny round is cheap, so 500 rounds per opponent; expect about ±0.015.
- **Head-to-head**: `zorewars battle rebuild.red original.red --rules tiny -r 500`. Two identical warriors score about 1.41 here (Tarragon against itself: 226-247-27), because ties are rare on this hill.
- **ModelWar**: the design compiled with `--rules modelwar --length 5040` (25,200 cells, 252,000 cycles, 25,200 processes, P-space), core-relative numbers scaled by 31.5 and layout offsets kept, and played against the 17-warrior field, 100 rounds in each load order, seeds 1 to 3, with the ModelWar server's load separation (warriors at least 5,040 cells apart, as pmars-ts places them). The reference is Decoy Adapter v6.1 (`modelwar/decoyadapt61.red`) run the same way.

## Summary

The Tiny hill's top 10 is one family seen from several sides. Seven of the ten are papers: a fan of six or seven processes, a silk that copies the body somewhere else and starts the processes there, and a tail in which every copy's processes turn into a clear. The four evolved warriors by bvowk, the #1 to #4, are the same design found by a model: a burst of decoy lines, a seven-process fan, a two-stage silk stepping 236 then 92 (83 in one), and a three-line clear tail. Double Shock is the anti-paper: a quickscan and two SPL-fed clears half the core apart.

| # | Warrior | Recipe | Blocks | Hill: original | Hill: rebuild | ModelWar |
|---|---|---|---|---:|---:|---:|
| 1 | dfd94f0 (bvowk) | `top10-tiny-dfd94f0` | `tiny-qbomb`, `djn-stream1`, `tiny-silk2`, `par` | 1.595 | 1.570 | 1.35 |
| 2 | e21ca502 (bvowk) | `top10-tiny-e21ca502` | `tiny-qbomb`, `tiny-silk2` | 1.494 | 1.500 | 1.33 |
| 3 | 7b15f4b8 (bvowk) | `top10-tiny-7b15f4b8` | `tiny-qbomb`, `tiny-silk2` | 1.483 | 1.483 | not built |
| 4 | 4b0804b3 (bvowk) | `top10-tiny-4b0804b3` | `tiny-qbomb`, `tiny-silk2` | 1.493 | 1.493 | not built |
| 5 | Double Shock (inversed) | `top10-tiny-double-shock` | `inv-qscan`, `twin-clear` | 1.485 | 1.485 | 1.54 |
| 6 | Consonance (inversed) | `top10-tiny-consonance` | `inv-qscan`, `tiny-silk2` | 1.518 | 1.518 | 1.46 |
| 7 | Chorus (inversed) | `top10-tiny-chorus` | `tiny-qbomb`, `chorus-silk` | 1.465 | 1.465 | 1.02 |
| 8 | Microcosmos (inversed) | `top10-tiny-microcosmos` | `tiny-qbomb`, `satellite-silk` | 1.452 | 1.452 | 1.09 |
| 9 | Resinoid (John Metcalf) | `top10-tiny-resinoid` | `tiny-qbomb`, `resin-boot` | 1.531 | 1.531 | 1.27 |
| 10 | Tarragon (John Metcalf) | `top10-tiny-tarragon` | `tiny-qbomb`, `tiny-silk2` | 1.428 | 1.428 | 1.63 |

Eight of the ten rebuilds compile to the original's instructions (7b15f4b8 and 4b0804b3 up to the modifiers of SPL and JMP lines, which change nothing they execute), so they score the same to the last digit. Two differ on purpose:

- **dfd94f0** runs its decrement stream as `DJN.F #355, {0` (its own A-field as the pointer) instead of borrowing the A-field of a decoy line three cells up, and the `par` combinator's SPL has no decoy B-field. 1.570 against 1.595; head-to-head 230-233-37 (1.45, even).
- **e21ca502** kills itself when it plays alone: its clear tail wipes its last process at cycle 7,202 of 8,000, so the original cannot pass the gate. The rebuild moves the tail's first source pointer one cell back (-199 instead of -200) and survives. 1.500 against 1.494; head-to-head 257-228-15 (1.57).

Before this work the nearest trees, `tiny-resonant-paper` and `tiny-copy-paper`, scored 1.091 and 0.688 against the same field.

The eight new blocks:

| Block | Kind | What it is | Used by |
|---|---|---|---|
| `tiny-qbomb` | opening | unrolled `MOV {a, b` lines (any of `{ } < >`): each makes a decoy where its pointer is and copies a blank (or what it finds) over b; arithmetic or per-line cells | 8 of the 10 |
| `inv-qscan` | opening | inversed's 11-line quickscan: seven cells in four or five cycles, a `MUL.X` decoder, a two-way bombing loop that stops on two equal cells | Double Shock, Consonance |
| `tiny-silk2` | body | the hill's paper: a 6- or 7-process fan (three forms), two silk stages with any B-modes, a tail of 2 or 3 lines with any opcodes and modes | Tarragon, Consonance, the four evolved |
| `chorus-silk` | body | a fan boots a mirror copy half the core away; a one-stage silk whose copies also rebuild themselves 12 cells on and move in | Chorus |
| `satellite-silk` | body | a four-line silk that, with every copy, relaunches the SPL-fed satellite clear its parent left ORBIT = STEP + DIST away | Microcosmos |
| `resin-boot` | body | four processes copy a resin clear twice (half the core apart) and a silk-imp paper once, SPL A-fields counting the copies | Resinoid |
| `twin-clear` | body | a three-line loop copies a four-line SPL-fed double clear to two places half the core apart | Double Shock |
| `djn-stream1` | body | a one-line `DJN.F #START, {0` stream; RETIRE 1 lets the warrior's own paper wipe it | dfd94f0 |

### What matters on this hill (ablations)

Each line changes one thing in a rebuild and plays the same 500 rounds against the top 30:

| Change | Hill | Effect |
|---|---:|---:|
| Tarragon as it is | 1.428 | |
| no clear tail (both tail lines DAT) | 0.908 | -0.52 |
| no decoy lines (9-line paper) | 1.292 | -0.14 |
| 5 decoy lines instead of 11 | 1.381 | -0.05 |
| first silk step one off resonance (-313 or -315 for -314) | 1.373 / 1.359 | -0.06 / -0.07 |
| second step 106 for 105 | 1.399 | -0.03 |
| Consonance's quickscan instead of the decoy lines | 1.482 | +0.05 |
| Consonance as it is | 1.518 | |
| no clear tail | 0.995 | -0.52 |
| no quickscan (9-line paper) | 1.304 | -0.21 |
| Tarragon's 11 decoy lines instead of the quickscan | 1.433 | -0.09 |
| the evolved warriors' silk steps (236, 92) with Consonance's tail | 1.220 | -0.30 |
| stage B-modes `{` instead of `>` | 1.521 | 0.00 |
| Double Shock with Consonance's scan factors (150, 577) | 1.467 | -0.02 |
| Double Shock without its quickscan | 1.266 | -0.22 |
| Resinoid without its four decoy lines | 1.465 | -0.07 |
| e21ca502 without its ten decoy lines | 1.359 | -0.14 |
| dfd94f0 with its stream line made a DAT (the second process dies at once) | 1.529 | -0.07 |
| dfd94f0 with the SPL and the stream both turned into decoy lines | 1.524 | -0.07 |

## 1. dfd94f0 (bvowk, evolved)

**What it is.** An evolved paper ("evolved with code generating deep neural network"): decoys, a seven-process two-stage silk with a three-line clear tail, and a second process that runs a short decrement stream.

**How it works.** (Traced alone at address 0.)

1. *Decoys (3 lines, 3 cycles).* Three MOVs whose A operands step a field of an empty far cell (with `}`, `{` and `<`: the cells become `DAT 1, 0`, `DAT -1, 0`, `DAT 0, -1`) and copy an empty cell over another empty cell. On empty core the visible effect is three non-empty cells; over an opponent the copy is a blank bomb and the step damages a field.
2. *Split.* `SPL 5`: one process goes on into three more decoy lines and then the stream, the other jumps to the paper.
3. *Stream (1 line).* A DJN.F with an immediate A-field and a `{` B operand three cells back: it decrements the A-field of the first of those three decoy lines and then both fields of the cell it names (cell 361, 360, 359, ...), and jumps to itself (an immediate A-field names the instruction itself). It runs only about seven times: the paper's own tail overwrites it at cycle 192. Short as it is, it is worth 0.07 (see the ablations): seven more non-empty cells in the region a quickscan reads.
4. *Fan (4 lines).* A SPL 2, a decoy MOV run by one process, a SPL 1, and a MOV of the line before it onto itself (immediate B). Four processes reach the MOV; the first copies the `SPL 1` over the MOV itself, so the other three split on it: seven processes enter the silk together. A plain `spl 2 / spl 1 / spl 1` fan gives six.
5. *Silk (4 lines).* The classic silk stage (a SPL through its own B-field, then a MOV that copies through the SPL's two fields), stepping 236 with a `{` B-mode, then again stepping 92. Each of the seven processes starts one process 236 cells on and copies one cell there, so the whole seven-line body (both stages and the tail) is copied while its new processes are already running it; the SPL's B-operand also decrements the A-field of the cell the copy goes to. Then the same 92 on, copying the second stage, the tail and two cells beyond. Copies made by stage one run both stages; copies made by stage two run only the second.
6. *Tail (3 lines).* The first line reads through a fan line's B-field (a decoy the fan made) and writes backward through its own A-field, over the copy's own past: line 10, 9, 8, ... so each copy wipes its own boot and then keeps clearing backward; the second lays blanks walking down from about 380 cells away; the third is a DJN decrement stream about 330 cells away that loops back to the first tail line. Every copy of the paper, once it has copied, becomes a three-front clear with seven processes.

**Recipe.** `seq(tiny-qbomb{3 lines}, par(seq(tiny-qbomb{3 lines}, djn-stream1{START 355, RETIRE 1}), seq(tiny-qbomb{1 line}, tiny-silk2{FAN 8, X 236 {, Y 92 {, 3-line tail})))`. The `par` combinator emits the same `SPL` the original has. `djn-stream1` points with its own A-field rather than a neighbour's, and needs RETIRE 1, because the gate otherwise requires every body to be running 1,000 cycles after it starts, and this one is wiped by its partner after about 190.

**Fidelity.** Hill 1.570 against 1.595 (the same edit made to the original text measured 1.585); head-to-head 230-233-37.

**ModelWar.** Scaled by 31.5 (silk 7434 then 2898, stream from 11183, layout offsets kept): **1.35**. 2.86 to 3.00 against the three small stones, 0.86 to 1.36 against everything else. Seven processes copying seven cells are too slow to reach the opponent first on 25,200 cells, and the tail's clear has 31.5 times as much core to cover.

**Lessons.** The evolver found the human design (decoys, fan, two-stage silk, clear tail) and two tricks we did not have: a fan that converts one of its own lines (`MOV -1, #x` turning into `SPL 1`) to get seven processes from three lines, and a throwaway second process whose few decrements still pay. All four bvowk warriors share the silk steps 236 and 92 (83 in 4b0804b3) and the fan; they differ in the decoy lines and the tail, so they are one lineage.

## 2. e21ca502 (bvowk, evolved)

**What it is.** The same lineage without the stream: ten decoy lines, the seven-process fan, the silk 236/92 with `>` B-modes, and a three-line tail.

**How it works.**

1. *Decoys (10 lines, 10 cycles).* Ten MOVs with `{`, `}`, `<` and `>` pointers, each leaving one non-empty cell and copying a blank to another place.
2. *Fan (3 lines).* Two SPL 1 lines and the self-overwriting MOV: four processes reach the MOV, the first turns it into a SPL 1, the other three split: seven processes.
3. *Silk.* As dfd94f0, with `>236` and `>92`: the B-operand increments the target's B-field instead of decrementing its A-field.
4. *Tail.* A MOV from a pointer 200 cells back, laid backward over its own past; a MOV between two far pointers; a DJN stream that loops back two lines.

Alone, the original's clear comes round to its last copy at cycle 7,202 and kills it: a suicide that costs nothing against a live opponent unless the round would otherwise have been a tie.

**Recipe.** `seq(tiny-qbomb{FORM 1, 10 lines}, tiny-silk2{FAN 7, X 236 >, Y 92 >, tail MOV >-199, {0 / MOV >-121, {-392 / DJN -2, <347})`. Of the single-number edits to the tail that survive alone, -199 for -200 changed the score least (others scored 1.47 to 1.51).

**Fidelity.** Hill 1.500 against 1.494; head-to-head 257-228-15 (1.57).

**ModelWar.** Scaled the same way: **1.33**, the same picture as dfd94f0 (2.77 to 2.99 against the small stones, about 1.0 elsewhere). 7b15f4b8 and 4b0804b3 were not built separately.

**Lessons.** The decoy lines are worth 0.14 here (1.359 without them). A clear tail that eventually laps its own last copy is a real risk only in a quiet core; in battle the opponent's code is usually there to absorb it.

## 3. 7b15f4b8 (bvowk, evolved)

**What it is.** e21ca502's sibling: ten decoy lines, the seven-process fan, the silk 236/92, and a different tail.

**How it works.** As e21ca502 up to the tail. Its tail copies whatever the cell four on points at backward from 21 cells back, copies from one far pointer to another, and loops with a JMP that increments a far B-field: a clear with no DJN, so it never falls through.

**Recipe.** `seq(tiny-qbomb{FORM 1, 10 lines}, tiny-silk2{FAN 7, X 236 >, Y 92 >, tail MOV @4, {-21 / MOV }-121, {-392 / JMP -2, >177})`. The compiled code is the original's except the modifiers (`SPL.I`, `SPL.X`, `JMP.BA` become `.B`), which do not change what any line does.

**Fidelity.** Hill 1.483 against 1.483.

**ModelWar.** Not built separately; the design is e21ca502's.

**Lessons.** Three of the four evolved warriors differ mainly in their tails and decoys, and their scores sit within 0.02 of each other: the silk and the fan carry the design; the tails are interchangeable as long as every copy turns into some clear.

## 4. 4b0804b3 (bvowk, evolved)

**What it is.** The fourth sibling: nine decoy lines, a fan with a tenth decoy line inside it, the silk 236 then 83 (with `<`), and a tail that loops on its own second line.

**How it works.** The fan is dfd94f0's form (SPL 2, a decoy MOV, SPL 1, the self-overwriting MOV: seven processes). The second stage steps 83 with a `<` B-mode (it decrements the target's B-field). The tail is two far-pointer MOVs and a DJN that jumps back to the line just before it, so after the first pass the processes alternate between two lines and the first tail line is never run again.

**Recipe.** `seq(tiny-qbomb{FORM 1, 9 lines}, tiny-silk2{FAN 8, X 236 >, Y 83 <, tail MOV }-53, {115 / MOV <-30, {-341 / DJN -1, <-41})`; the same code as the original but for modifiers.

**Fidelity.** Hill 1.493 against 1.493.

**ModelWar.** Not built separately.

**Lessons.** The evolver keeps silk step 236 in all four; 236 * 3 = 708 and 236 + 92 = 328 do not repeat soon on 800, so the first copies spread out across the core rather than falling on each other.

## 5. Double Shock (inversed)

**What it is.** A quickscan, then a double clear: the hill's main anti-paper.

**How it works.**

1. *Quickscan (5 lines, 4 or 5 cycles).* `qf` is a MUL.X of two immediates, QX = 512 and QY = 376. Line 1, an SNE.F, compares two cells (qf + (QX-1)QY and qf + v(v+1) for v = (QX-1)QY). If they are equal, line 2, an SEQ.F, compares qf + w(w+1) with qf + QX through `}qf`, which also raises qf's A-field to QX+1; if that pair differs, a JMP through qlo+1's B-field with a `{qf` B operand lowers it again and jumps to the MUL (qlo+1's B-field names qf). Otherwise line 4 compares the third pair; if equal, a JMZ.F to the next phase with `<qf` lowers qf's B-field to QY-1 and tests qf + QY - 1 too. Seven cells in at most five cycles. If all are empty it hands on.
2. *Decoder (2 lines).* The MUL.X makes both fields A·B, the first cell of the pair that fired; a JMZ.F through `>qf` tests it: if it is empty, the B-field goes up by one and the MUL runs again, giving v(v+1), the other cell. That is why the pairs are (v, v(v+1)); and for the SEQ pair, QX·QY = QX (mod 800), which `inv-qscan` checks (QX·(QY-1) a multiple of the core).
3. *Attack (4 lines).* Two MOVs copy blanks (from an empty region 347 on) up and down from the find through qf's two fields, then an SEQ looks at the next two cells out: if they are the same (both empty) the loop ends and it hands on, otherwise a DJN.F goes round again. It bombs outward exactly as far as the body reaches.
4. *Boot (5 lines, 15 cycles).* A three-line loop whose second line's A-field counts down from the clear's end (the first line predecrements it), so each pass copies one clear cell to both places. A SPL starts the first copy, a JMP moves into the second; the copies are 400 cells apart.
5. *Clear (4 lines, in each copy).* A SPL with an immediate A-field (-48) feeds processes and holds the two write pointers; the next line lays a blank at s0 + A (A walking down two a loop), the third another at s0 + B (B, starting at -213, walking down two a loop), and a DJN.F loops, decrementing both pointers again. The SPL's own `{` B operand decrements the cells the B front skips. Two fronts per copy, two copies half the core apart: four fronts sweeping the 800 cells, fed by ever more processes.

**Recipe.** `seq(inv-qscan{QX 512, QY 376, QANY 347}, twin-clear{HOP1 656, HOP2 256, CA -48, CB -213, CM 91})`.

**Fidelity.** Hill 1.485 against 1.485 (the same code).

**ModelWar.** Quickscan factors searched for 25,200 (QX 14413, QY 3601: the seven cells at least 3,418 apart), the clears 12,600 apart, their pointers scaled: **1.54**, the second best of the ten. It beats Decoy Adapter v6.1 on 02e_orn11 (1.82 against 0.88), clu 3 (1.64 against 1.57) and Drift (1.90 against 1.87), and is close on Drift v2 (1.60 against 1.84); it loses badly to the papers mercenary, InnovationStation and NovaBomber (0.30 to 0.69), as it loses to papers on the Tiny hill.

**Lessons.** It beats every scanner and oneshot on the hill (1.6 to 2.1) and loses narrowly to most papers (1.1 to 1.4): a clear wins against a paper only if it is faster than the paper's spread, and on 800 cells a paper copies itself across the core in a couple of hundred cycles. Without the quickscan it falls to 1.266: the quickscan's bombs are what kill a slow starter in the first dozen cycles.

## 6. Consonance (inversed)

**What it is.** The same quickscan, then a six-process two-stage paper whose steps resonate, with a two-line clear tail ("resonant coreclear-type paper").

**How it works.**

1. *Quickscan and attack (11 lines).* As Double Shock, QX 150, QY 577 (150·576 = 108·800), bomb source 403 on.
2. *Fan (3 lines).* SPL 2, SPL 1, SPL 1: six processes; the `{` B-fields make three decoys.
3. *Silk.* Two silk stages with `>` B-modes, stepping -317 then 106. The steps satisfy 3X + Y = 1 (mod 800) with X = 106, Y = -317: a copy that takes the first step and then three second steps lands one cell past where it started, next to its ancestor's stage. The first copy is complete at cycle 26.
4. *Tail (2 lines).* A MOV from a source pointer 523 cells on (its B-field walks up a cell each time) written backward through its own A-field, over the copy's own stages and on down the core; a DJN.F that decrements a far cell and loops. Every copy becomes a backward clear with six processes.

**Recipe.** `seq(inv-qscan{QX 150, QY 577, QANY 403}, tiny-silk2{FAN 6, X -317 >, Y 106 >, tail MOV >523, {0 / DJN -2, <403})`.

**Fidelity.** Hill 1.518 against 1.518.

**ModelWar.** The quickscan as Double Shock's, the silk on the same resonance (f = 3339: X = 1 - 3f, Y = f), the tail's far pointers scaled: **1.46**. 2.98 to 3.00 against the three small stones, 1.0 to 1.3 elsewhere; better than v6.1 only on 02e_orn11 (1.17) and the small stones.

**Lessons.** The clear tail is worth 0.52 (0.995 without it): on this hill a paper that only copies ties other papers and loses to clears; one whose copies clear wins. The quickscan is worth 0.21 over no opening and 0.09 over Tarragon's eleven decoys in the same 11 cells.

## 7. Chorus (inversed)

**What it is.** A quick bomb, then a Timescape-style paper that starts with a mirror copy half the core away and crawls.

**How it works.**

1. *Quick bomb (9 lines, 9 cycles).* `MOV {a, b` with a = 179 + 411i and b = 764 + 388i (i = 1..9) from the start: nine decoys and nine blanks thrown over the core.
2. *Fan and mirror boot (5 lines).* Six processes; each runs one MOV that copies one silk cell, last first, to 400 cells on: the silk stage's own A-field (6 at load) counts the six copies down to 0. Then a SPL to 406 past the silk sends one process into the mirror for every one that goes on: twelve processes, six in each copy, by cycle 26.
3. *Silk (6 lines).* A silk stage copies the six lines 67 on; two MOVs copy what two walking pointers find (blanks) over the core and over the place 12 cells back; a MOV through the stage's and the last line's A-fields copies the silk again, last cell first, to 7..12 cells past its end; the last line, a DJN.F whose A-field those copies lowered from 13 to 7, moves the process into that new copy. Every generation throws a copy 67 on and crawls 12 on; 6 · 67 = 402, so the original's line and the mirror's interleave.

**Recipe.** `seq(tiny-qbomb{FORM 0, 9, A 590 + 411i, B 352 + 388i}, chorus-silk{X 67, DIST 400, CRAWL 12, ...})`.

**Fidelity.** Hill 1.465 against 1.465.

**ModelWar.** Scaled (step 2111, mirror 12,600, crawl 12 kept): **1.02**, the weakest. It ties the papers (mercenary, InnovationStation, NovaBomber, about 1.0) and beats the small stones, but loses to everything else (0.4 to 0.6): a 12-cell crawl is nothing on 25,200 cells, and a one-stage silk spreads slowly.

**Lessons.** Two independent lineages from cycle 20 for the price of two lines; a crawling copy keeps a paper alive where a clear has passed. The A-field of the first silk line doubles as the boot counter, so the boot costs no counter cell.

## 8. Microcosmos (inversed)

**What it is.** A quick bomb, then a small paper whose every copy relaunches a satellite clear.

**How it works.**

1. *Layout.* The satellite (4 lines) comes first, then the quick bomb, then the boost and the silk; the warrior starts at the quick bomb.
2. *Quick bomb (9 lines).* As Chorus, a = 771 + 776i, b = 571 + 137i from the warrior's first cell.
3. *Boost (3 lines).* Two SPL 1 lines and a MOV through two B-fields: four processes copy the satellite to 37 cells past `launch` (the first SPL's B-field, which names the satellite, walks it).
4. *Silk (4 lines).* A silk stage copies the four lines 104 on; a MOV through `launch`'s two fields copies the satellite from 37..40 past `launch` to 141..144 past it, and `launch` itself, a DJN.F whose A-field (145) those copies lowered to 141, sends the four processes into it. 145 = 104 + 41: the satellite a copy reads is exactly the one its parent laid, so every generation launches a satellite from its parent's.
5. *Satellite (4 lines).* A SPL-fed loop of two MOVs and a DJN.F: a clear that copies its own MOV line 117 on and lays blanks behind it.

**Recipe.** `seq(tiny-qbomb{FORM 0, 9, A 743 + 776i, B 704 + 137i from the bomb's first line}, satellite-silk{STEP 104, DIST 41, ...})`; the satellite is the block's state, which the `seq` lays before all code, so the layout and entry are the original's.

**Fidelity.** Hill 1.452 against 1.452.

**ModelWar.** Scaled (step 3276, satellite 1292 on): **1.09**. As Chorus: four processes are too few for a 25,200-cell core.

**Lessons.** A paper can carry a clear without spending the clear's cells in its own body: each copy fetches it from where the last one put it. Its weakness is the paper side: four processes and a four-line body copy slowly, and it scores 1.34 against the other papers (Double Shock beats it 1.90).

## 9. Resinoid (John Metcalf)

**What it is.** Two resin clears half the core apart and a silk-imp paper, booted together by four processes.

**How it works.**

1. *Decoys (4 lines).* Two `{` and two `<` decoy MOVs.
2. *Fan (2 lines).* Two SPL 1 lines: four processes.
3. *Boot (3 lines, one cell per process each).* The first line copies the clear, last cell first; the resin's own SPL A-field (4 at load) is the counter and ends at 0, so the copies start with SPL 0. The second copies it again, counted by the A-field of the blank cell after the warrior. The third copies the paper, counted by its first line's A-field. The A-fields of `cb1`, `cb2` and `pb` count down to the copies' first cells.
4. *Start (3 lines).* A SPL into clear 1 (4 processes), a SPL into clear 2, and a JMZ.F through its own A-field (its B operand is a blank, so it always jumps) into the paper. Everything runs by cycle 31.
5. *Resin clear (4 lines).* A SPL 0 feeds; the next line copies the line after it downward; that line copies cells from below itself to 345 cells off through two predecrements; a DJN.F loops. It lays a trail of predecrementing MOVs: an opponent's process that runs into the trail runs resin itself and keeps laying it.
6. *Paper (4 lines).* A silk stage copies 268 on (one more than the imp step); a SPL through its own post-incremented B-field starts a process at a place that walks up one cell each time; the last line is a three-point imp of step 267 (3 · 267 = 801). The copies line up so that their leftover processes crawl as imps.

**Recipe.** `seq(tiny-qbomb{FORM 1, 4 lines}, resin-boot{HOP1 296, HOP2 696, PHOP 188, RB 345})`. The block must be last: the blank after it is its second counter.

**Fidelity.** Hill 1.531 against 1.531.

**ModelWar.** Scaled (clears 12,600 apart, resin offset 10868, a 13-point imp because 3 divides 25,200): **1.27**. Its best is Drift v2, 1.97 against v6.1's 1.84; against papers it falls to 0.44 to 0.66.

**Lessons.** Three bodies booted in 31 cycles by four processes, with no counter cells at all: every count lives in an A-field that has another job afterwards. It is the best non-evolved paper against other papers (1.55), because the resin clears hit papers while the imps tie the rest.

## 10. Tarragon (John Metcalf)

**What it is.** The plainest member of the family: decoys and a two-stage paper with a clear tail.

**How it works.**

1. *Decoys (11 lines, 11 cycles).* A FOR loop of `{` decoy MOVs: eleven cells 25 apart become `DAT -1, 0`, and blanks are thrown 195 cells below each.
2. *Fan (3 lines).* SPL 2, SPL 1, SPL 1: six processes, and their `{` B-fields make three more decoys.
3. *Silk (4 lines).* Two silk stages with `{` B-modes, stepping -314 then 105: 3 · 105 - 314 = 1.
4. *Tail (2 lines).* A MOV copies from the first stage's B pointer (just past its last copy) backward over the copy itself; a DJN.F decrements a cell 49 back and jumps to the second stage's MOV, which copies further cells on.

**Recipe.** `seq(tiny-qbomb{FORM 0, 11, A 726 + 775i, B 531 + 775i}, tiny-silk2{FAN 6, X -314 {, Y 105 {, tail MOV >-4, {0 / DJN -2, <-49})`. FOR loops in pMARS count from 1, so the first line's cells are d + 556 + 775 + 195, not d + 556 + 195.

**Fidelity.** Hill 1.428 against 1.428.

**ModelWar.** Scaled (decoys 788 apart, silk f = 3308, tail far pointer -1544, layout kept): **1.63**, the best of the ten on ModelWar. It beats Decoy Adapter v6.1 on 02e_orn11 (1.27 against 0.88), Drift v2 (1.96 against 1.84) and the three small stones (2.96 to 2.99 against 2.19 to 2.82); it ties the three papers (1.00) and scores 1.2 to 1.5 against the rest, where v6.1 has 1.9 to 2.3.

**Lessons.** Every part is measurable: the tail is worth 0.52, the decoys 0.14, the resonance 0.06 (a first step one off), and the same paper behind Consonance's quickscan scores 1.482.

## Tiny design against 8,000-cell design

1. **The paper is the core clear.** On 800 cells a six-process silk covers the core within a few hundred cycles, so the hill's papers spend their tail on clearing: every copy, after copying, erases its own past and the cells around it. Paper against paper is then decided rather than tied (dfd94f0 ties 3 to 8 rounds in 100 against the other papers, except the two that leave imps, Resinoid and Desync, about 30). On 8,000 cells the leading papers add bombs or imps to a paper that mostly survives; here the tail is half the score.
2. **Decoys are cheap and pay.** One instruction, one cycle, one non-empty cell where a quickscan looks. Eleven of them are worth 0.14 to Tarragon; the evolved warriors spend half their length on them. With 7 cells tested by a quickscan out of 800, each decoy is a real chance to send an opponent's attack to empty core.
3. **Quickscans test few cells and decode in place.** inversed's quickscan tests seven cells in five instructions and its attack stops when the body ends; it costs 11 lines and is worth 0.21 to 0.22 to both its warriors. Our generic MUL quickscans are 20 to 40 lines.
4. **Every field has two jobs.** The silk's A-field is Chorus's boot counter; Resinoid's SPL A-fields count its copies and then become `SPL 0`; the evolved fan's MOV becomes a SPL; Double Shock's JMP finds the MUL through a B-field of the attack loop; Microcosmos's satellite pointer is the copy's own distance. The 20-line limit forces it.
5. **Resonant steps.** 3X + Y = 1 (Consonance, Tarragon) and ORBIT = STEP + DIST (Microcosmos) tie the generations together on purpose, so a lineage returns next to its ancestor (refreshing a copy that was hit) or picks up what the parent left. One cell off costs 0.06, and the steps are tuned together with the tail: Consonance with the evolved warriors' steps 236/92 falls from 1.518 to 1.220, though those steps work in the evolved warriors' own tails.
6. **Small numbers do not transfer as numbers.** Most constants are fractions of 800 (half the core for twin clears, steps that spread copies); scaled by 31.5 they keep their geometry, but the timing does not scale: a six-process paper needs 31.5 times as many copies to fill a 25,200-cell core, and the process cap rises from 800 to 25,200. See the ModelWar results.

## ModelWar

Every design was compiled for ModelWar with its core-relative numbers scaled by 31.5 (layout offsets, such as a tail's jump back or Chorus's 12-cell crawl, kept) and played against the 17-warrior field with the server's load separation (5,040 cells; 3 seeds, both orders). Decoy Adapter v6.1, run the same way, scores **2.04**.

| Design | Field average | Where it beats v6.1 |
|---|---:|---|
| Decoy Adapter v6.1 (reference) | 2.04 | |
| Tarragon (decoys + two-stage silk + clear tail) | **1.63** | 02e_orn11 1.27 vs 0.88, Drift v2 1.96 vs 1.84, PROBE, Skippy, DriftLab (2.96 to 2.99 vs 2.19 to 2.82) |
| Double Shock (quickscan + twin clear) | 1.54 | 02e_orn11 1.82, clu 3 1.64 vs 1.57, Drift 1.90 vs 1.87 |
| Consonance (quickscan + resonant silk) | 1.46 | 02e_orn11 1.17, PROBE, Skippy, DriftLab |
| dfd94f0, e21ca502 (evolved) | 1.35, 1.33 | the three small stones |
| Resinoid | 1.27 | Drift v2 1.97 |
| Microcosmos, Chorus | 1.09, 1.02 | the small stones |

**Which engines transfer.** Those whose numbers are fractions of the core and whose work grows with the core: the twin clear (two SPL-fed clears half the core apart) and the two-stage silk with a clear tail. Papers with few processes (Microcosmos's four, Chorus's crawl) do not: on 25,200 cells their copies are too sparse. Every design wins nearly every round against the three small stones (PROBE, Skippy, DriftLab), which v6.1 beats less often; against the three papers (mercenary, InnovationStation, NovaBomber) the tiny papers tie and Double Shock loses.

**Would a selector help?** A perfect choice per opponent among v6.1, Tarragon and Double Shock averages 2.17, 0.13 above v6.1 before any switching cost. As on the other hills, that is not enough to build a switcher for; Tarragon's paper is the one worth remembering as a member against 02e_orn11, Drift v2 and the small stones.


## What the catalog still can't express

- **A body meant to die early beside a partner.** dfd94f0's stream is wiped by its own paper after 190 cycles; `djn-stream1` needed RETIRE 1 to pass the gate. Other blocks with the same lifetime would need the same flag.
- **Warriors that kill themselves alone.** e21ca502 dies on its own clear at cycle 7,202 of 8,000; the gate refuses it, so the rebuild changes one number.
- **A cell borrowed from another block.** dfd94f0's stream uses the A-field of a decoy line three cells up as its pointer; Resinoid's second copy counter is the blank cell after the warrior (`resin-boot` must be last). Blocks own their cells, so the rebuild points the stream at itself.
- **Decoy fields on combinator lines.** The `par` SPL has no B-field parameter, so dfd94f0's `SPL 5, {-36` loses its decoy.
- **Modifiers as data.** Evolved code carries `SPL.I`, `SPL.X`, `JMP.BA`; the blocks emit `.B`. Harmless here (no line's behaviour changes) but not identical code.
