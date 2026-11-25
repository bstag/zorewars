# Koenigstuhl Nano top 10: rebuilt from blocks

The ten leaders of the Koenigstuhl Nano hill (`--rules nano`: 80 cells, 5 instructions, 800 cycles, 80 processes, minimum distance 5). Each one was traced, rebuilt as a block tree and played against the original.

The recipes are `top10-nano-<name>` in [tools/algebra/recipes-top10/nano.js](../../tools/algebra/recipes-top10/nano.js). The four blocks they use are in [tools/algebra/blocks/top10-nano.js](../../tools/algebra/blocks/top10-nano.js), tested in `test/algebra-top10-nano.test.js`. The Redcode in the blocks was written from the descriptions here; no original is in the repository. Build one with:

```bash
node scripts/algebra.js recipe top10-nano-reptiloid-conspiracy --rules nano --out conspiracy.red
```

## The hill in one paragraph

All ten are a single five-line loop fed by a `SPL #x`, and nine of them are core clears. On 80 cells there is no time to scan, boot or decoy. The SPL adds one process to the loop each time it runs. Because the queue is FIFO, it runs once per lap of the queue, so a lone SPL has about √(2t) processes at cycle t: 20 at cycle 200, 26 at cycle 325, and never the 80 allowed. The rest of each warrior is two or three `MOV.I` lines and a `DJN`. Every operand is a pointer, and most pointers are other instructions' fields. **The bombs are whatever the read pointer finds**: decremented blanks (`DAT 0,-1`) at first, then the warrior's own `SPL` and `MOV` lines once the read window passes over its own code. Those copies land in the opponent's area as SPL bombs and decoys. Run alone, most of them clear the whole core, then their own loop, and end as a lone `SPL` on one or two processes, which cannot die. Fights are decided in the first 100 to 300 cycles.

## How the numbers were measured

- **Hill score**: `zorewars hill <file> --hill koenigstuhl:nano --top 30 --rules nano --rounds 1000`, points a round against the hill's top 30, which includes the warrior itself. The 200-round figure is also given. Between 200 and 1000 rounds a score moves by up to 0.025, so 1000 rounds is used for fidelity.
- **Line ablation**: one line's opcode replaced by `NOP.F` with its operands kept, so its addressing side effects still happen. Measured on the hill at 200 rounds. This shows what each line's *action* is worth, separately from its pointer arithmetic.
- **ModelWar**: the rebuild compiled with `--rules modelwar --length 5040` (25,200 cells, 252,000 cycles) and played against the ModelWar field with `fieldrun2.sh`, seeds 1–3, 100 rounds each way. Placement used the server's real load separation: the second warrior starts 5,139–20,061 cells after the first. The live entry, Decoy Adapter v6.1, was measured the same way as the reference.

## Summary

| # | Warrior | Recipe | Block | Hill: original | Hill: rebuild | Notes |
|---|---|---|---|---:|---:|---|
| 1 | Reptiloid Conspiracy (inversed) | `top10-nano-reptiloid-conspiracy` | `nano-mirror-clear` SLOT 0 | 1.523 | 1.523 | identical |
| 2 | Reptiloid Supremacy (inversed) | `top10-nano-reptiloid-supremacy` | `nano-dat-clear` | 1.564 | 1.564 | identical |
| 3 | [RS] Nextratulated Sturvinator 2 (inversed) | `top10-nano-nextratulated-sturvinator-2` | `nano-mirror-clear` SLOT 1 | 1.468 | 1.468 | identical |
| 4 | Combat Arithmetic (inversed) | `top10-nano-combat-arithmetic` | `nano-twin-clear` SLOT 1 | 1.453 | 1.453 | identical |
| 5 | Forbes (Roy van Rijn) | `top10-nano-forbes` | `nano-mirror-clear` SLOT 2 | 1.588 | 1.585 | cursor 66, not 67 (gate) |
| 6 | Iron Throne (Roy van Rijn) | `top10-nano-iron-throne` | `nano-mirror-clear` SLOT 1 | 1.458 | 1.458 | identical |
| 7 | Glitch//CORE//opt (John Metcalf) | `top10-nano-glitch-core-opt` | `nano-paper-clear` | 1.547 | 1.547 | identical |
| 8 | rogue[AI] (John Metcalf) | `top10-nano-rogue-ai` | `nano-mirror-clear` SLOT 2 | 1.450 | 1.450 | identical |
| 9 | 128_48 (yabevolver, evolved) | `top10-nano-128-48` | `nano-mirror-clear` SLOT 2 | 1.434 | 1.441 | copier start 25, not 24 (gate) |
| 10 | NanoCracker (Terry Newton, evolved) | `top10-nano-nanocracker` | `nano-twin-clear` SLOT 0 | 1.462 | 1.462 | identical |

Eight rebuilds compile to the original's five instructions and play exactly as the original. Forbes and 128_48 throw their own SPL away and die alone, at cycles 466 and 521. The gate requires a warrior to survive alone, so each recipe uses the nearest one-field change that survives and plays the same. Both are within 0.01, and head to head against its original each rebuild scores 1.55 (Forbes) and 1.43 (128_48) over 1000 rounds.

At 200 rounds, before this work, the nearest existing Nano blocks were `nano-lane` and `nano-relay-clear`. They are original designs, not models of these warriors.

### The four blocks

Numbers are cells counted from the block's first cell on the 80-cell ring. On another core, `nanoScale` keeps any offset within four cells of the block and scales every other offset by coreSize/80, so a tree keeps its layout as shares of the core.

| Block | Lines | Used by |
|---|---|---|
| `nano-mirror-clear` | `SPL #PTR` (its A-field is the write pointer) · mirror `MOV <|>CURSOR, {feed` · walker `MOV }|{mirror, STREAM` (copies the cursor cell and steps the cursor by rewriting the mirror's A-field) · `DJN mirror, DJNC`. The fifth line is chosen by SLOT: 0 a swap-back `MOV {feed, <CURSOR`, 1 a one-shot head before the SPL, 2 a reverse copier `MOV {0, >COPYB` that throws the SPL | Conspiracy, Nextratulated, Iron Throne, Forbes, rogue[AI], 128_48 |
| `nano-twin-clear` | `SPL #PA, <|>PB`: both fields are pointers, and the side effect rides the B pointer · `MOV <feed, {feed` · `MOV {feed, <feed`, then SLOT 0 an upward sweep and a `DJN` on the A pointer, or SLOT 1 a one-shot head and a `DIV.F` bomb that ends each walker | NanoCracker, Combat Arithmetic |
| `nano-dat-clear` | a `DAT` bomb · `SPL` · `MOV bomb, <ptr` · `ptr MOV <0, {PTR` (its own B-field is the carpet pointer) · `DJN`. When the carpet reaches `ptr`, the bomb's B-field becomes the pointer | Reptiloid Supremacy |
| `nano-paper-clear` | `SPL #0` · `MOV }paper, }dest` · `dest SPL {COPY` (launches into the cell just copied) · a two-line A-stream clear | Glitch//CORE//opt |

Each block's watch checks the coupling the warrior depends on. `nano-mirror-clear`: the SPL adds a process; the mirror steps the SPL's A pointer down by one and writes where it points; the walker moves the cursor one cell. `nano-twin-clear`: each swap line steps both SPL fields and writes under its pointer. `nano-dat-clear`: every throw lands under `ptr`'s pointer until the carpet hands over to a one-step clear, which it must do. `nano-paper-clear`: the first copy is cell for cell at COPY.

## Line ablation

Hill score at 200 rounds with one line's opcode replaced by `NOP.F`. L0 is the first line of the source.

| Warrior | Original | L0 | L1 | L2 | L3 | L4 |
|---|---:|---:|---:|---:|---:|---:|
| Conspiracy | 1.530 | 1.151 (SPL) | **0.818** (mirror) | 1.233 (swap) | 1.265 (walker) | 1.304 (DJN) |
| Supremacy | 1.567 | 1.356 (bomb) | 0.583 (SPL) | **0.433** (throw) | 1.059 (ptr) | 1.117 (DJN) |
| Nextratulated | 1.473 | 1.352 (head) | 1.110 (SPL) | **0.724** (mirror) | 1.087 (walker) | 1.067 (DJN) |
| Combat Arithmetic | 1.470 | 1.381 (head) | **0.038** (SPL) | 0.887 (mirror) | 0.932 (swap) | 1.221 (DIV) |
| Forbes | 1.570 | 1.141 (SPL) | 1.321 (copier) | **0.883** (mirror) | 1.349 (walker) | 1.229 (DJN) |
| Iron Throne | 1.465 | 1.354 (head) | 1.037 (SPL) | **0.713** (mirror) | 1.094 (walker) | 1.017 (DJN) |
| Glitch | 1.540 | **0.568** (pump) | 0.605 (copy) | 0.816 (launch) | 1.040 (clear) | 1.317 (DJN) |
| rogue[AI] | 1.439 | 1.011 (SPL) | 1.208 (copier) | **0.814** (mirror) | 1.221 (walker) | 0.990 (DJN) |
| 128_48 | 1.409 | 1.077 (SPL) | 1.133 (copier) | **0.926** (mirror) | 1.188 (walker) | 1.108 (DJN) |
| NanoCracker | 1.486 | **0.667** (SPL) | 1.160 (mirror) | 1.163 (swap) | 1.208 (sweep) | 1.025 (DJN) |

The line that writes through the SPL's pointer (the mirror, or Supremacy's throw) is the most valuable one in every clear. Every other line is worth 0.1 to 0.4. That includes the one-shot heads, which run once and are still worth 0.09 to 0.12. Without its SPL, 128_48 still scores 1.08 on one process. Combat Arithmetic without its SPL (0.04) has no loop at all.

## 1. Reptiloid Conspiracy (inversed)

**What it is.** A mirror clear with a swap-back line, evolved with ArmsRace. It is the default of `nano-mirror-clear`.

**How it works.** The four pointers are the SPL's A-field (39), the cursor cell 69's B-field, the A-field of cell 57, and the mirror's own A-field.

1. *Feed.* The SPL (immediate A-field 39) runs once per queue lap. Its B operand A-predecrements cell 57, which the walker also writes through, so that stream speeds up as processes grow.
2. *Mirror.* It B-predecrements the cursor (cell 69) and reads the cell below it. It A-predecrements the SPL and writes at SPL+A: 38, 37, 36 and so on, down from 39, one cell a pass.
3. *Swap-back.* It reads through the SPL's A pointer and writes through the cursor's B, the reverse of the mirror. Each pass the two lines exchange a cell between the read window around 68 and the write window below 39, and each line moves both windows by one.
4. *Walker.* It copies the cell at mirror+A (A-postincrement through the mirror), which is the cursor cell itself, now a `DAT 0,-1`. It writes it down the A-stream from 57, then increments the mirror's A-field. The next pass's mirror uses a fresh cursor one cell up: 70, 71, 72. Any cell the walker has passed becomes a cursor.
5. *DJN.* It loops to the mirror, with a decrement stream through cell 58's A.

Solo trace: queue peak 26 at cycle 325. Every cell has been written by cycle 193. The loop wipes itself between cycles 336 and 382, leaving the `SPL` with two processes. Two traced wins from [the earlier review](../hill-block-review.md#a-second-writer-can-stop-an-attack-or-redirect-its-own) show the swap-back's first two copies landing on the opponent's next instructions at steps 7 and 15.

**Recipe.** `nano-mirror-clear{SLOT 0, PTR 39, FEEDMOD 1, SIDEM 2 ({), SIDE 57, CURM 0 (<), CURSOR 69, WALKM 0 (}), STRM 2, STREAM 57, DJNM 2, DJNC 58, DJNMOD 0}`.

**Fidelity.** Identical code: 1.523 (1.530 at 200 rounds).

**Lessons.** The SPL's immediate A-field costs nothing as a pointer, since SPL never reads it. The walker turns every cell it passes into a cursor, so the read window crawls one way while the write windows crawl the other.

## 2. Reptiloid Supremacy (inversed)

**What it is.** A DAT carpet that turns into a one-step clear. Its first line is the bomb, and the bomb's B-field is a spare pointer.

**How it works.**

1. Execution starts at the SPL (`ORG 1`). Line 0 is `DAT.B {32, }76`.
2. *Throw.* `MOV bomb, <ptr` decrements `ptr`'s B-field and lays the bomb there. `ptr` is a MOV whose A operand B-predecrements its own cell, so it decrements its own B-field (31) again. So the carpet moves two cells a pass, and the bombs land on 33, 31, 29 and so on. `ptr`'s B operand A-predecrements the bomb just thrown and copies the blank below it far away.
3. *DJN* loops to the throw, with an A-stream from 74.
4. *Handover.* When the carpet reaches `ptr` (cycle 51 alone), the bomb lands on `ptr` itself. `ptr` is now a DAT, so processes die there, but its B-field is `}76`, which is -4. The throw keeps decrementing that field, so the surviving `SPL`/`MOV` pair lays one bomb a cell from 78 downward for good, on two or three processes.

**Recipe.** `nano-dat-clear{BOMBA 32, BOMBB 76, FEEDA 48, SIDE 50, PTR 34, DJNC 74}`. The block refuses a BOMBB that would point the clear back at the SPL. Its watch requires the handover to happen.

**Fidelity.** Identical code: 1.564.

**Lessons.** This is the 80-cell version of the 94nop "stone whose bombs are its second pointer". The parity has to work: the carpet must land on `ptr`, not on the throw. Scaled to 8,000 or 25,200 cells it lands on the throw and the gate refuses it, so this block is Nano-only for now. Without the bomb line's DAT (L0 as `NOP`) the score falls to 1.36.

## 3. [RS] Nextratulated Sturvinator 2 (inversed)

**What it is.** A mirror clear behind a one-shot head, evolved with RedShift and reoptimised.

**How it works.**

1. *Head* (runs once): a MOV that B-predecrements cell 70 and copies to cell 29. It presets cell 70's B-field to -1 and copies cell 69 (blank) to 29. That costs one cycle before the SPL and is worth 0.12 (ablation): it is a free early bomb at 29 and a pre-armed cursor.
2. *Feed.* The SPL's A-field puts the write pointer at 26. The side effect B-predecrements cell 59.
3. *Mirror.* It reads below the cursor (starting at 67) and writes down from 25, one cell a pass.
4. *Walker.* It copies the cursor cell and advances the cursor upward (66, 67, 68 and so on), writing down cell 59's B-stream.
5. *DJN* loops to the mirror, through the same cell 59. Cell 59 is decremented three times per lap (SPL, walker, DJN), so the walker writes every third cell down from 56, with the DJN's decrements in between.

Solo trace: peak 21 processes. The read window reaches the warrior at about cycle 50 and copies its head and SPL into the write window (25, 23) as decoys and SPL bombs. The loop is wiped between cycles 197 and 294. The end state is the head, the SPL and 14 processes.

**Recipe.** `nano-mirror-clear{SLOT 1, HEADM 0 (<), HEADA 70, HEADB 29, PTR 26, FEEDMOD 0, SIDEM 0, SIDE 59, CURSOR 67, WALKM 0, STRM 0, STREAM 59, DJNM 0, DJNC 59, DJNMOD 0}`.

**Fidelity.** Identical code: 1.468.

**Lessons.** Three lines decrementing one shared cell make a step-3 stream with no step constant. A head that runs once is still a whole line well spent.

## 4. Combat Arithmetic (inversed)

**What it is.** A twin-pointer clear in which only the SPL loops.

**How it works.**

1. *Head* (once): it copies blank cell 60 to 75 and post-increments cell 60's B.
2. *Feed.* The SPL's A-field (pointing at 70) and B-field (pointing at 36) are both clear pointers. The side effect decrements the B-field of the cell the B pointer names, so it moves with the clear. This leaves a trail of `DAT 0,-1` on every second cell down from 36.
3. *Mirror* `MOV <feed, {feed` and *swap* `MOV {feed, <feed`: each walker exchanges a cell between the window below 36 and the window below 70, moving both by one.
4. *DIV.F*: both operands A-predecrement cell 51, so it predecrements cell 51's A twice and divides through it. On blank cells that is a division by zero and the walker dies. If the target is enemy code with non-zero fields, the fields are divided. There is no loop: each spawn runs the mirror, the swap and the DIV once, then dies. The queue stays at 3 or 4 processes.

When the A window reaches the warrior (about cycle 75), its own lines are swapped into the other window. Whole copies of `MOV SPL MOV MOV` appear around cells 18–21 and 39–42, as decoys and SPL bombs.

**Recipe.** `nano-twin-clear{SLOT 1, HEADM 1 (>), HEADA 60, HEADB 75, PA 70, PB 36, SIDEM 0 (<), FEEDMOD 0, DIVC 51}`.

**Fidelity.** Identical code: 1.453.

**Lessons.** A DIV is a kill switch and a damage bomb in one line. A three-process clear has no queue to grow, so every spawn's work happens at once.

## 5. Forbes (Roy van Rijn)

**What it is.** Nextratulated's mirror loop on its own stream, with a reverse copier in place of the head.

**How it works.**

1. *Feed.* The write pointer starts at 42. The side effect increments cell 49's B.
2. *Reverse copier.* It runs once per spawn. Its A operand decrements its own A-field, so it reads the SPL first, then cells 79, 78 and so on downward. Its first write goes to cell 46 and post-increments cell 46's B. That first write *is* the SPL, so cell 46 now holds a copy of the SPL. Its B-field (49, which is -31 from cell 46) becomes the copier's destination pointer, and the copier sprays the cells below the warrior upward from cell 15. The thrown SPL is a stun bomb, a decoy and the copier's pointer at the same time.
3. *Mirror, walker, DJN.* As in Nextratulated: the mirror reads up from cursor 67, and the walker and DJN share cell 63's B-stream.

Alone, the mirror copies a blank over its own SPL at cycle 462 and the warrior dies at cycle 466. In battle the opponent is usually dead long before that.

**Recipe.** `nano-mirror-clear{SLOT 2, PTR 42, FEEDMOD 0, SIDEM 1 (>), SIDE 49, COPYB 46, CURSOR 66, WALKM 0, STRM 0, STREAM 63, DJNM 0, DJNC 63, DJNMOD 1}`. The original's cursor is 67, and with it the gate refuses the warrior because it dies alone (a test keeps that refusal). Of the 236 one-field variants that survive alone, cursor 66 is the closest in score and cursor 65 the best (1.599).

**Fidelity.** 1.585 against 1.588. Head to head over 1000 rounds: 517-483-0, 1.55.

**Lessons.** It is the hill's best warrior here, and it is the only one built for a benchmark (the source cites its NE benchmark scores). Dying alone at cycle 466 costs nothing on a hill decided by cycle 300.

## 6. Iron Throne (Roy van Rijn)

**What it is.** Nextratulated's mirror loop with a different head and its DJN on a separate stream.

**How it works.** The head copies cell 66 to 28 and post-increments cell 66's A. The feed, mirror and walker are Nextratulated's line for line. The DJN's stream runs through cell 42, so cell 59 is only decremented twice a lap (SPL and walker), and the walker writes every second cell. Solo: peak 23, loop wiped by cycle 296, ending as `SPL` plus two processes.

**Recipe.** `nano-mirror-clear{SLOT 1, HEADM 3 (}), HEADA 66, HEADB 28, PTR 26, FEEDMOD 0, SIDEM 0, SIDE 59, CURSOR 67, STREAM 59, DJNC 42, ...}`.

**Fidelity.** Identical code: 1.458.

**Lessons.** Iron Throne and Nextratulated differ in two operands and score within 0.01 of each other. The mirror loop is a stable engine, and the head and stream cells are fine tuning.

## 7. Glitch//CORE//opt (John Metcalf)

**What it is.** The one paper on the hill: a five-line paper/clear.

**How it works.**

1. *Pump.* A SPL to itself, with a B-postincrement side effect on cell 54.
2. *Copy.* It copies cell (paper + A) to (dest + A) and increments both A-fields. Cells 0, 1, 2 and so on go to 45, 46, 47 and so on, one cell a pass. It keeps going past the paper, so the copy is followed by blanks.
3. *Launch.* A SPL whose A operand points at the next cell the copy will write (dest + A, which follows the copy). It predecrements that cell's A to -1 and launches a process at the cell before it, which is the one just copied. The copy's processes therefore start in its SPL, then its MOV, and every copy becomes a paper of its own, about 43 cells on.
4. *Clear.* A MOV that reads B-indirect through cell 72 and a DJN back to it form a two-line A-stream clear on cells 32 and 33. The processes that fall through the launch run it.

Solo: peak 60 processes (the only top-10 warrior near the 80-process limit). The original is overwritten at cycle 524, and copies are still running at cycle 800.

**Recipe.** `nano-paper-clear{SIDE1 54, COPY 45, SIDE2 57, BOMB 72, CLR 32, DJNC 33}`.

**Fidelity.** Identical code: 1.547.

**Lessons.** "SPL through the cell you will write next" makes a launch that follows the copy without a counter. The paper has the most ties of the ten (6,122 of 30,000 rounds), which is the paper's usual profile against clears.

## 8. rogue[AI] (John Metcalf)

**What it is.** A mirror clear with a reverse copier, whose cursor walks down instead of up.

**How it works.** The copier throws the SPL to cell 48. The thrown SPL's B-field then drives the copier's writes, as in Forbes. The mirror reads below cursor 25 and writes down from 43. The walker *predecrements* the mirror's A-field, so the cursor moves down one cell a pass, and it writes down cell 60's B-stream. The mirror's read and write windows therefore move down together, 19 cells apart. When the read window reaches the warrior, its lines are copied 19 cells up. The DJN streams through cell 76, four cells below the warrior. Solo: peak 26. The loop is wiped by cycle 552, and the SPL and copier survive.

**Recipe.** `nano-mirror-clear{SLOT 2, PTR 44, SIDEM 1, SIDE 13, COPYB 48, CURSOR 25, WALKM 1 ({), STREAM 60, DJNC 76, ...}`.

**Fidelity.** Identical code: 1.450.

**Lessons.** Whether the cursor walks up (Nextratulated) or down (rogue[AI]) is one mode character. The block exposes it as WALKM.

## 9. 128_48 (yabevolver)

**What it is.** An evolved mirror clear with a reverse copier and an upward-reading mirror.

**How it works.** The copier throws the SPL to cell 24 (its B-field, 67, is the copier's pointer from then on). The mirror B-*post*increments cursor 32: it reads 32, 33, 34 and so on upward from the same cell while the walker moves the cursor cell down. The two motions cancel on a blank core, so the read stays near cell 32 while the cursor's B-field counts up. The walker writes down cell 42's A-stream and the DJN down cell 57's. Alone it wipes its own SPL and dies at cycle 521.

**Recipe.** `nano-mirror-clear{SLOT 2, PTR 76, FEEDMOD 1, SIDEM 1, SIDE 67, COPYB 25, CURM 1 (>), CURSOR 32, WALKM 1, STRM 2, STREAM 42, DJNM 2, DJNC 57, DJNMOD 1}`. The original's copier starts at 24. Cell 25 is the one-field change closest in score that survives alone. STREAM 43 is the best (1.458).

**Fidelity.** 1.441 against 1.434. Head to head: 469-507-24, 1.43.

**Lessons.** An evolver found the same mirror clear and reverse copier as the hand-written warriors, with every mode flipped.

## 10. NanoCracker (Terry Newton)

**What it is.** A twin-pointer clear with a loop, evolved by mevo in 2015 and still in the top 10.

**How it works.** The SPL's fields are the two pointers: the A pointer is at 42, and the B pointer is at 71 and also carries the side effect. The mirror (`MOV <feed, {feed`) runs once per spawn. The loop is the swap (`MOV {feed, <feed`), an upward sweep (reads 49, 50, 51 and so on into the A pointer) and `DJN back, {feed`, whose target is the A pointer itself. The A pointer is decremented three times a lap, so the clear front moves fastest there. Solo: peak 20, loop wiped by cycle 202, ending as `SPL` plus two processes.

**Recipe.** `nano-twin-clear{SLOT 0, PA 42, PB 71, SIDEM 1 (>), FEEDMOD 1, SWEEP 49, DJNMOD 1}`.

**Fidelity.** Identical code: 1.462.

**Lessons.** NanoCracker loses only 0.67 without its SPL, the steepest SPL ablation after Combat Arithmetic. The more of a loop's lines move one pointer, the more it depends on many processes running them.

## ModelWar

The rebuilds were compiled for ModelWar with `--rules modelwar --length 5040`, so `nanoScale` multiplies every far offset by 315. Each was run alone for 252,000 cycles, and the ones that survive were played against the 18-warrior field: `fieldrun2.sh`, seeds 1–3, 100 rounds each way, server load separation 5,040. Decoy Adapter v6.1, measured the same way, scores **2.04**.

| Build on 25,200 cells | Alone | Field average | Where it beats Decoy Adapter v6.1 |
|---|---|---:|---|
| Decoy Adapter v6.1 (reference) | survives | 2.04 | |
| Combat Arithmetic, scaled | survives | **1.52** | 02e_orn11 1.68/0.88, 03_clu_3 1.94/1.57, 02c_orn5 2.38/2.10, 19_DriftLab 2.52/2.19, 07_Drift_v2 2.06/1.84, 09_MWClient 2.03/2.01 |
| Iron Throne, scaled | survives | 1.35 | 02e_orn11 1.91/0.88, 03_clu_3 1.82/1.57, 19_DriftLab 2.41/2.19 |
| rogue[AI], scaled | survives | 1.16 | 07_Drift_v2 2.24/1.84, 19_DriftLab 2.65/2.19 |
| Reptiloid Conspiracy, scaled | survives | 1.09 | 02e_orn11 1.47/0.88 |
| Forbes, 128_48, Glitch, scaled | die alone at 143k–194k cycles | not run | |
| NanoCracker, Supremacy, scaled | refused by the gate | not run | |
| Nano numbers unscaled (Conspiracy, rogue[AI], Forbes, Glitch) | survive | 0.14–0.38 | nothing |

- **Scaling is what makes them work.** With the Nano numbers left as they are, the pointers start within 80 cells of the code. The clear then spends its first passes on its own neighbourhood, and the opponent, at least 5,040 cells away, is reached far too late (0.14–0.38). Scaled, the same five lines are real core clears. Each mirror or swap line moves a window by one cell a pass, so one lap of the core takes about 25,000 passes.
- **Combat Arithmetic is the best component.** It runs on three or four processes with no loop: the SPL spawns one walker, the walker swaps two cells and dies on the DIV. Against a field of papers and stone/imps that is a hard target, and it never runs out of process slots. Every walker also leaves a DAT trail through the SPL's side effect. It loses heavily to the big papers and scanners (mercenary 0.24, InnovationStation 0.15, NovaBomber 0.53, the orn papers 0.6–1.0).
- **As a switcher member.** Decoy Adapter's worst opponent is 02e_orn11 (0.88). Combat Arithmetic (1.68) and Iron Throne (1.91) both do about twice as well there, and both are also better against 03_clu_3. A perfect per-opponent choice between Decoy Adapter and Combat Arithmetic would average 2.15, which is +0.11, and most of that is orn11. This is an upper bound before any switching cost, the same size as the King Cobra/Discord bound in the [cross-hill summary](README.md), so a switcher is not worth building on this evidence alone. A five-cell clear could serve as a cheap endgame arm (P-space branch) against orn11-style warriors if one is built for other reasons.
- **Not an entry.** No nano rebuild is close to the live entry. None was tuned beyond the ×315 scaling. No ModelWar upload or challenge was made.

## Lessons for the larger blocks

1. **Free pointers.** A `SPL #x`'s A-field, a thrown bomb's B-field and a MOV's own B-field are all pointers that cost no cell. Supremacy's bomb *is* its next pointer; Forbes's thrown SPL *is* its copier's pointer. Our larger clears keep separate pointer cells (`cobra-body`'s `cptr`/`bptr`, the `gated-dclear` gate). On 25,200 cells a cell saved is small, but a cell an opponent can't find is not.
2. **Shared decrement cells make strides.** Three lines decrementing one cell give a step-3 stream (Nextratulated); two give step 2 (Iron Throne). Stride is set by how many lines share the cell, not by a constant.
3. **Copying beats bombing on a small core.** None of the nine clears has a bomb cell except Supremacy. They copy what the cursor finds, and that turns the warrior's own lines into SPL bombs and decoys once the window passes over them. A clear whose read window crosses its own code throws stun bombs for free.
4. **One-shot heads.** A line that runs once before the loop (a preset pointer plus an early bomb) was worth 0.09 to 0.12 here. Our openings are 20 to 40 lines. A one-line "first bomb plus pointer preset" in front of any body is a cheap experiment.
5. **Self-terminating clears leave an immortal SPL.** Six of the ten end alone as a `SPL #x` on one or two processes, a remnant no clear can starve. Larger clears that end in a lone `SPL #0` (or an imp) get the same insurance.
6. **Process growth is √(2t) from one SPL.** A clear that needs many processes early needs more than one feeding SPL. NanoCracker depends on its SPL far more than 128_48 does.
7. **A clear with no loop holds up best on 25,200 cells.** Combat Arithmetic's walkers each do one swap and die on a DIV, so the warrior lives on 3–4 processes. Scaled, it was the best of these on ModelWar (1.52) and beat the live entry on six opponents. A DIV (or MOD) that kills on blank cells and damages occupied ones is a one-line loop terminator our clears don't use.

## What the catalog and the gate can't express

- **Bodies that die alone.** Forbes and 128_48 wipe their own SPL at cycles 466 and 521 when alone. In battle that costs nothing. The gate requires solo survival, so the recipes use a one-field variant (measured within 0.01). This is the same gap as LP's self-bombing quad stones.
- **Quick-mode gate on ModelWar.** Growing trees are checked for 20,000 cycles. Scaled to 25,200 cells, Forbes, 128_48 and Glitch pass the gate but die alone at cycles 143,421, 159,888 and 193,952. `verification: 'full'` catches it. A ModelWar entry built from these blocks should be gated in full mode.
- **Parity that only holds on 80 cells.** Supremacy's handover needs the carpet to land on `ptr`. Scaled, it lands on the throw, and the gate refuses it (the watch requires the handover). A parity-aware scaling would be needed.
- **Scaling.** `nanoScale` keeps offsets within four cells and scales the rest. That keeps the layout as shares of the core, but not what the numbers do over time (when a window reaches the warrior, which cell the clear wipes last). NanoCracker scaled dies alone. The raw Nano numbers survive alone on 25,200 cells for all ten, but they play at 0.14–0.38.
- The block-algebra watch API reports the queue only through `vm.processes`. Checking "the SPL adds exactly one process" works on Nano. On large cores with a growing queue it costs a copy of the queue on every check, so the watches stop after the first eight passes.
