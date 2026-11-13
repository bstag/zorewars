# Moving a booted stone's bomb lane off paper copies

`lp-sparse-phase-paper` keeps the 5,952-cell boot, the same ADD-plus-JMP worker phase and the same backward-copy paper as `lp-booted-phase-paper`. Only two fields in the 21-cell image change. The stone's stride grows from 32 to 160 and its initial destination offset moves from 17 to 46. The new orbit visits 50 cells rather than 250. [Boot placement study](lp-phase-deployment.md) · [Phase-stone block](../tools/algebra/blocks/lp-phase-stone.js)

## Find a lane from copy traffic

The stone's MOV sits at 5,964 relative to the load origin. The lane residue is `(5964 + OFFSET) mod gcd(STEP, 8000)`. The linker rejects a lane that crosses the loaded image or any cell of the deployed stone. Those checks use linked addresses. A stone moved by a different boot can therefore make an otherwise safe residue unsafe.

First I screened one initial offset for each of the 11 legal residues at stride 32. Only offsets 11 and 17 passed the full gate, and offset 11 hit three more recently copied paper cells than the baseline. Then I ran the same loaded image with the copied stone entry changed to DAT. The boot still performs all six copies, and the paper runs without a stone sharing its queue. For strides 64, 80, 100, 125, 160, 200 and 250, I ranked legal residues by how often the paper copied into them and tried the lowest five for each stride. This paper-only histogram proposes candidates. Each candidate still has to run with the live stone because both its writes and its slots change the paper's trajectory. [Screen and replay code](../examples/hill-study/replay-lp-phase-lanes.mjs)

The trace counts a stone hit on a paper copy when the destination's last write before the shot came from a paper-lineage backward MOV. This tracks actual overwrites of copied cells, including copies that never execute. The converse counts a paper copy into a cell last written by the stone. A paper death counts separately when the process dies on a cell whose last write was a stone shot. [FIFO and write trace](../examples/hill-study/replay-lp-phase-deployment.mjs)

| Stride / offset | Residue | Orbit cells | Stone hits on paper copies | Paper copies over stone shots | Paper deaths on stone writes | Turns at 2 stone / 6 paper | Final stone / paper |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 32 / 17 | 29 | 250 | 295 | 320 | 27 | 59,517 | 2 / 6 |
| 32 / 11 | 23 | 250 | 298 | 334 | 21 | 36,819 | 2 / 4 |
| 125 / 61 | 25 | 64 | 17 | 17 | 4 | 15,500 | 2 / 4 |
| 160 / 11 | 55 | 50 | 79 | 81 | 7 | 63,174 | 2 / 6 |
| 160 / 46 | 90 | 50 | 32 | 36 | 6 | 74,811 | 2 / 6 |

The 125 / 61 lane gave the fewest copy hits among the finalists. I chose 160 / 46 for the named recipe because it spent the most time at the full two-stone, six-paper split and finished there. The other step-160 lane covers the same number of cells but hits 79 paper copies. This gives us a comparison of placement at fixed orbit size.

## Follow the eight slots

The baseline and 160 / 46 both fire their first shot on turn 35 and reach the same FIFO on turn 938. `P` and `S` denote ancestry, which stays with each process even if it later executes modified code.

| Checkpoint | FIFO from head to tail |
| --- | --- |
| First full queue, both layouts | `986 P, 8 P, 2 P, 5963 S, 5965 S, 1993 P, 1008 P, 1002 P` |
| Baseline at turn 80,000 | `7106 P, 5963 S, 5965 S, 1607 P, 1938 P, 1938 P, 2793 P, 3460 P` |
| 160 / 46 at turn 80,000 | `392 P, 394 P, 5965 S, 5964 S, 394 P, 387 P, 392 P, 394 P` |

The new lane still crosses paper traffic. The stone writes 2,970 on turn 540, the paper copies over it on turn 679, and the stone overwrites that copy on turn 1,007. The first paper death on a stone write moves from turn 979 to 3,761. Across the round the stone makes 6,770 writes versus 7,063 in the baseline. The fall in copy hits from 295 to 32 is much larger than the drop in shot count. The five finalist traces match after normalizing loads at 0 and 7,997.

## Replay against Disciples of the Void

Each panel uses 128 rounds with matched placements and first movers. The first panel uses seeds 23,033 and 49,139 from the deployment study. The fresh panel uses 38,177 and 57,347. All five layouts recorded zero wins on both panels, so their scores are the fraction of rounds tied. [Published Disciples source](https://asdflkj.net/COREWAR/LP/HILL32/4xlb_6.red)

| Stride / offset | First panel points per round | Fresh panel points per round |
| --- | ---: | ---: |
| 32 / 17 | 0.031 | 0.063 |
| 32 / 11 | 0.047 | 0.055 |
| 125 / 61 | 0.039 | 0.063 |
| 160 / 11 | 0.031 | 0.039 |
| 160 / 46 | 0.039 | 0.055 |

The sparse recipe gained one tie on the first panel and lost one on the fresh panel, finishing with 12 ties across 256 rounds, equal to the baseline. At offset 4,937 with Disciples moving first, the sparse lane reduced stone hits on paper copies from 19 to 5 and changed a loss into a tie. At offset 630 with our warrior moving first, it made zero such hits, but Disciples killed both stone workers and the hybrid lost. The baseline tied that round. Quiet coexistence is a distinct outcome from scanner resistance.

## Reuse the placement check and the trace

The block still uses the existing `STEP` and `OFFSET` parameters. A residue histogram can propose quieter lanes for another moving companion while a full replay checks actual copy overwrites and process survival. Keep both the last-writer checks and the FIFO composition. The 125 / 61 result shows why a low collision count alone can select a paper that spends much of the round below its six available slots.

The [defense study](lp-phase-defense.md) keeps this lane fixed and traces which stone instructions Disciples traps before its DAT sweep arrives.

## Reproduce

```sh
node scripts/algebra.js recipe lp-sparse-phase-paper --rules lp-hill --out sparse-phase-paper.red
node cli/zorewars.js check sparse-phase-paper.red --rules lp-hill --json
node examples/hill-study/replay-lp-phase-lanes.mjs
node examples/hill-study/replay-lp-phase-lanes.mjs path/to/LP/HILL32/4xlb_6.red
```
