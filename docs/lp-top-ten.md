# Full-size Limited Process leaders

Koenigstuhl's LP field gives us ten published leaders to replay on an 8,000-cell ring with eight processes, 80,000 turns, 200-cell images and P-space. Use `--rules lp-hill` for that field. ZoreWars also offers `--rules lp`, a 100-cell tournament profile without P-space. SAL LP is a separate ladder. Its standings stayed the same from challenge 566 to 567, and two of its top ten have matching published name-author records. [Koenigstuhl recursive standings](https://asdflkj.net/COREWAR/LP/hill32_rec.html) · [SAL LP challenge 567](https://sal.discontinuity.info/hill.php?key=lp&t=567&how=late) · [Source audit](lp-top-ten-sources.md)

## Timing the ten Koenigstuhl leaders

One-based solo VM turns, with clean P-space and an empty core. The script checks each trace with an ordinary load and a load that wraps. The first remote MOV can be a copy or an attack. Remote execution records the first execution of code the warrior wrote outside its loaded image. A dash marks an event that did not occur during the run.

| Rank and warrior | Cells | First remote MOV | First remote execution | First at eight | Quiet outcome |
| --- | ---: | ---: | ---: | ---: | --- |
| 1 R.O.U.S. | 7 | 1 | 32 | 574 | 3 processes |
| 2 Replinator | 200 | 21 | 106 | 825 | 8 processes |
| 3 Bronze minotaur | 200 | 3 | 65 | 412 | Dies on turn 48,259 |
| 4 Digital Rain | 7 | 2 | 105 | 719 | 5 processes |
| 5 Fear of the Unknown | 200 | 3 | 17 | 458 | 8 processes |
| 6 The LP Destroyer | 200 | 10 | 95 | 814 | 8 processes |
| 7 Hippogriff | 7 | 1 | 116 | 802 | 8 processes |
| 8 Distortion Energy | 200 | 4 | 12 | 547 | 8 processes |
| 9 The LP Destroyer II | 83 | 8 | 95 | 814 | 8 processes |
| 10 Disciples of the Void | 200 | 3 | 40 | 32,127 | 2 processes |

The seven-cell leaders can all write remotely within two turns. Their first remote execution differs by up to 84 turns because the quiet run of R.O.U.S. starts with a seven-cell copy, while Digital Rain and Hippogriff start with longer counts. Distortion Energy executes its remote stone by turn 12 with a much larger loaded image. A code-length comparison misses both choices. [R.O.U.S.](https://asdflkj.net/COREWAR/LP/HILL32/rous.red) · [Digital Rain](https://asdflkj.net/COREWAR/LP/HILL32/digitalrain.red) · [Hippogriff](https://asdflkj.net/COREWAR/LP/HILL32/hippogriff.red) · [Distortion Energy](https://asdflkj.net/COREWAR/LP/HILL32/dse_6.red)

The two LP Destroyers choose a different body when P-space cell 0 is set to a prior loss and the rest of memory is fresh. The first spends the round with one process and never runs remote code. The second starts remote on turn 14, fills the queue on turn 41, and dies on turn 3,847. The battle panel preserves P-space across rounds, where the internal state may also affect the choice. [The LP Destroyer](https://asdflkj.net/COREWAR/LP/HILL32/lpdestroyer.red) · [The LP Destroyer II](https://asdflkj.net/COREWAR/LP/HILL32/lpdestroyer2.red)

## Seven cells and two jobs per pass

R.O.U.S. spends four turns per copy lap. One MOV copies a cell backward, a second MOV scatters through two remote pointers, ADD doubles both offsets of that second MOV, and JMN repeats while the source counter is nonzero. The first copy uses the preloaded count of seven. A restart executes the seed, which writes a larger count into its own B-field and lets the next copy include cells before the body. SPL asks for a restart at home. Its continuation takes the guarded jump into the copy, even with eight slots already occupied. The depleted destination cursor points both operands of JMZ at the copied seed. Its B-field must be zero to transfer. Digital Rain shares the doubling and guarded transfer, but scatters before copying and uses A-predecrement at both scatter operands. Hippogriff steps its attack arithmetically rather than doubling it. [Published source](https://asdflkj.net/COREWAR/LP/HILL32/rous.red)

The seven-cell `lp-scatter-paper` block uses a direct ADD to make the doubling explicit. The first copy lands at +6,080 and subsequent copies use a count of 21. These values differ from the published warrior. The gate checks the complete first image, both scatter pointer side effects, and the transfer. The wrapped test injects a nonempty instruction into the first scatter read to confirm that MOV writes the preincrement snapshot. A separate injection makes the copied seed nonzero and the transfer stays closed. [Block](../tools/algebra/blocks/lp-scatter-paper.js) · [Focused tests](../test/algebra-lp-scatter-paper.test.js)

| Design | Cells | First remote execution | First at eight | Distinct remote MOV destinations by turn 100 |
| --- | ---: | ---: | ---: | ---: |
| Published R.O.U.S. | 7 | 32 | 574 | 50 |
| `lp-paper` catalog baseline | 15 | 105 | 737 | 39 |
| `lp-scatter-paper` | 7 | 32 | 550 | 50 |
| Same layout with `SCATTER=0` | 7 | 32 | 550 | 25 |

The control replaces the scatter MOV with a NOP and keeps the two field values, doubling instruction and copy schedule. Both versions first enter the copy on turn 32 and first complete a transfer with a full queue on turn 551. Any field-score difference includes both copying the remote instruction and the pointer writes that MOV's two operands perform.

## Replay the scatter control

Each entrant played the same ten published opponents, including R.O.U.S., for 80 rounds at each of seeds 124, 521 and 1777. The match runner kept P-space between rounds and alternated the first mover. The geometry was chosen after a small exploratory run against the first five opponents using seed 124. The panel reuses that seed alongside two others, so it measures the fixed field rather than an independent holdout. [Replay runner](../examples/hill-study/time-lp-leaders.mjs)

| Entrant | Points per round | Against Disciples of the Void |
| --- | ---: | ---: |
| Published R.O.U.S. | 1.808 | 1.779 |
| `lp-scatter-paper` | 1.326 | 1.296 |
| Same layout with `SCATTER=0` | 0.948 | 0.092 |
| `lp-paper` catalog baseline | 0.476 | 0.008 |

Enabling scatter raised points against every opponent in the panel. The largest gap was against Disciples, whose four scanners are designed to avoid probing one another. The quiet runs show both versions deploying their first copy at the same time. The match results justify keeping scatter in this block and leave open which of its three effects matters most against the scanners.

## Reuse the LP Destroyer policy

The two published controllers agree for all three internal states and four previous results. The packed `lp-outcome-switch` recipe represents the same three-state policy for legal match histories, with our scatter paper and a simple stone as the payloads. Its 32 cells include both bodies. Loss sends state 0 to stone and stores state 2. Wins in state 2 continue using stone. A tie in state 2 sends play back to paper and state 0. The table's spare fourth state mirrors state 2, and the fresh round starts in state 0. See the [original policy table](lp-top-ten-sources.md#the-same-controller-can-compare-distinct-secondary-attacks).

## Where the catalog still falls short

| Published designs | Current block fit | Detail to isolate |
| --- | --- | --- |
| R.O.U.S., Digital Rain, Hippogriff | `lp-scatter-paper` and `lp-paper` | Compare scatter direction and ordering independently of first copy length. |
| Replinator | MUL quickscan plus a compact paper | The archive's decoded target and the copy/attack loop need a joint placement check. |
| Bronze minotaur | `lp-bronze-paper` composes two backward-copy papers and traces their FIFO ancestry. | Compare the published and compact placements and test when each paper benefits from a partner. |
| Distortion Energy | `lp-mutation-paper` gives a self-writing stone and bounded DAT clear one slot beside a paper. | The original mutates its increment through live remote reads. Compare that behavior with the compact planned donor. |
| Fear of the Unknown | Stone and paper can be combined with a boot or parallel launch. | Trace the published launch and isolate what each payload does for the other. |
| The LP Destroyer and II | `lp-outcome-switch` uses their three-state transition policy. | Compare the two published secondary attacks under the same controller and placements. |
| Disciples of the Void | `lp-opposed-scanners` checks complete opposed probe lanes and excludes friendly images. | Reproduce the original's wider orbit and scan-to-clear transition. |

The [four-scanner study](lp-disciples.md) traces the original's first friendly contact and tests one, two and four complete probe lanes in an original model.

The [two-paper study](lp-bronze-paper.md) compares Bronze minotaur with a compact recipe and tracks what each lineage does when the queue fills.

The [mutation stone study](lp-distortion-stone.md) traces the source's live remote reads and builds a planned self-write that switches attacks in the same process slot.

## Reproduce

```sh
node examples/hill-study/time-lp-leaders.mjs path/to/LP/HILL32
node examples/hill-study/time-lp-leaders.mjs path/to/LP/HILL32 --panel
node scripts/algebra.js recipe lp-scatter-paper --rules lp-hill --out scatter.red
node cli/zorewars.js check scatter.red --rules lp-hill --json
node scripts/algebra.js recipe lp-outcome-switch --rules lp-hill --out outcome.red
```
