# Stone worker count and launch phase in LP

The published *Distortion Energy* boots a four-cell stone, then admits workers at ADD, MOV, JMP and MOV again. These workers share the stone's writable operands. Giving a second worker the wrong entry can spend two turns writing the same cell while leaving another target untouched. [Published warrior](https://asdflkj.net/COREWAR/LP/HILL32/dse_6.red) · [Original launch and mutation trace](lp-distortion-source.md)

## Keep the image and vary the admissions

The replay loads the same 200-cell published image for every run. At the two original dispatch instructions, a host-side queue filter keeps or drops each candidate stone admission. The boot still copies the stone, advances its routing pointer and attempts the paper launch to cell 1. The filter changes the queue cadence, so the first paper instruction runs on turns 17–24 depending on which workers are kept. The four-worker case preserves all admissions and the runner checks its outcomes against normal engine matches. These controls are diagnostic engine runs. [Replay code](../examples/hill-study/replay-lp-distortion-workers.mjs)

| Retained stone entries | First full queue | Stone writes | Distinct targets | Last stone death |
| --- | ---: | ---: | ---: | ---: |
| ADD | 664, 1 stone and 7 paper | 150 | 150 | 2,898 |
| ADD and first MOV | 833, 2 stone and 6 paper | 300 | 150 | 3,068 |
| ADD and JMP | 833, 2 stone and 6 paper | 299 | 299 | 3,067 |
| ADD and late MOV | 831, 2 stone and 6 paper | 299 | 150 | 3,065 |
| All four | 547, 4 stone and 4 paper | 598 | 596 | 3,354 |

These are quiet rounds with load origin zero. In all five, the last stone worker dies executing cell 4,898, with the last write attributed to the paper at 7,171. Every run ends with eight paper descendants. The two-worker MOV route produces two consecutive writes per destination. The JMP route inserts an ADD between writes and covers almost twice as many cells in the same lifetime. [Source breakdown](lp-distortion-source.md#launch-and-queue-pressure)

## Battle results

Scores are points per round on matched placements and first movers. Each Disciples panel used 128 rounds. Each other opponent used 96. The first Disciples panel reused seeds 23,033 and 49,139 from the source study. The other columns use seeds 31,517 and 52,489.

| Retained entries | Disciples, first panel | Disciples, fresh panel | Bronze minotaur | R.O.U.S. |
| --- | ---: | ---: | ---: | ---: |
| ADD | 0.625 | 0.758 | 1.063 | 1.115 |
| ADD and first MOV | 0.641 | 0.477 | 1.188 | 0.917 |
| ADD and JMP | 1.063 | 0.594 | 1.271 | 1.219 |
| ADD and late MOV | 0.617 | 0.422 | 1.375 | 1.021 |
| All four | 1.000 | 1.133 | 0.938 | 0.979 |

ADD plus JMP beat both two-worker MOV routes on both Disciples panels. Its lead over the published four-worker launch on the first panel reversed on fresh placements. Against Bronze, ADD plus late MOV led despite having the lower quiet coverage. Battle scores include both lineages, whose cadence changes whenever a slot is reassigned.

At Disciples offset 2,296 with Distortion Energy moving first, the one-worker and both two-worker MOV variants lost. The ADD-plus-JMP variant tied after writing 238 distinct stone targets. The four-worker variant won after writing 596 distinct targets, even though its last stone worker died thousands of turns before the battle ended. This round shows that late survival of the stone is an incomplete measure of the opening's effect.

## A reusable phase control

`lp-phase-stone` is a six-cell original model that keeps the shared destination and swaps only the dispatch JMP. `PHASE 0` starts the second worker at MOV. Two writes then use one target before two ADDs advance it. `PHASE 1` starts the second worker at the loop JMP, so one ADD advances the target between writes. The DAT donor stays fixed and the block has no mutation handoff.

| Mode | First eight targets relative to MOV | Quiet writes | Distinct targets |
| --- | --- | ---: | ---: |
| `PHASE 0` | 49, 49, 113, 113, 177, 177, 241, 241 | 26,666 | 125 |
| `PHASE 1` | 49, 81, 113, 145, 177, 209, 241, 273 | 26,666 | 250 |

The linker checks that the shot lattice misses the loaded image. The full gate checks the opening sequence, complete orbit, late writes, and two processes still executing compatible stone code at the limit. Both modes pass beside the same quiet paper in the 14-cell `lp-phase-paper` recipe. Against Disciples the two recipes had identical totals on both panels, scoring 0.016 and 0.070 points per round. The compact recipe isolates phase behavior while the published comparison retains the remote boot, live source reads and different paper. The follow-up holds the phase fixed and traces seven boot placements. [Block](../tools/algebra/blocks/lp-phase-stone.js) · [Focused tests](../test/algebra-lp-phase-stone.test.js) · [Deployment study](lp-phase-deployment.md)

## Reproduce

```sh
node scripts/algebra.js recipe lp-phase-stone --rules lp-hill --out phase-stone.red
node scripts/algebra.js recipe lp-phase-paper --rules lp-hill --out phase-paper.red
node examples/hill-study/replay-lp-distortion-workers.mjs path/to/LP/HILL32
node examples/hill-study/replay-lp-distortion-workers.mjs path/to/LP/HILL32 --compact
```
