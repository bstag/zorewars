# Booting the two-worker stone away from its paper

The 21-cell `lp-booted-phase-paper` recipe starts the same ADD-plus-JMP stone used in the worker-phase study. Its `par` launch sends one process to the existing backward-copy paper and one to the standard `boot` loader. The loader copies the stone's six cells backward and jumps into the copy. The copied SPL and dispatch JMP then start the two stone workers in their established phases. [Worker phase study](lp-distortion-workers.md) · [Block and relocated lane check](../tools/algebra/blocks/lp-phase-stone.js)

The seven booted layouts vary the `HOP` parameter alone. They retain the same 21-cell layout, paper entry, paper copy parameters, stone template, stride and first-shot offset. All hops are multiples of 32, so they keep the absolute shot residue. The stone starts at `HOP + 9` relative to the load origin. The first stone shot moves with that start, which changes the order in which the stone visits its lane. The unbooted recipe has a smaller image and different opening timing, so it serves as a separate reference.

## Track the writer through the queue

The replay follows actual FIFO successors and preserves ancestry when a process starts executing overwritten code. For each of the six deployed cells it records the last writing turn, lineage, instruction address and, for a whole-instruction MOV, source address. It distinguishes a touch from a change to any instruction field. A death inside the deployed body carries the last recorded touch. A death after a process has jumped outside that footprint has no such record. In the other direction, it checks whether a stone shot still owns the last write when a paper process dies at that address. [Trace runner](../examples/hill-study/replay-lp-phase-deployment.mjs)

Every layout copies the six cells on turns 3, 7, 11, 15, 19 and 23. The paper first executes on turn 4 and the deployed stone on turn 29. The quiet traces give the same relative results when loaded at 0 and 7,997.

| Boot hop | Paper touches on stone | Whole copies | Touches that changed a field | Stone writes | Paper deaths on stone writes | Final stone / paper |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 256 | 0 | 0 | 0 | 7,826 | 20 | 2 / 4 |
| 512 | 6 | 6 | 0 | 6,812 | 18 | 2 / 6 |
| 1,024 | 81 | 15 | 81 | 928 | 5 | 0 / 8 |
| 1,984 | 60 | 18 | 50 | 42 | 0 | 0 / 8 |
| 4,032 | 0 | 0 | 0 | 9,120 | 22 | 2 / 1 |
| 4,896 | 21 | 21 | 13 | 1,125 | 6 | 0 / 8 |
| 5,952 | 0 | 0 | 0 | 7,063 | 27 | 2 / 6 |

At hop 512 the paper's first whole write to the stone copies the unchanged DAT donor at 526 onto itself. At hop 1,984 the paper process at 1,003 copies DAT from 1,012 onto the donor at 1,998 on turn 246. On turn 262 the same process copies DAT from 1,011 onto the loop JMP at 1,997. Both stone workers then execute that DAT, on turns 265 and 271. At hop 4,896 the first changed write comes much later, on turn 12,654, when the paper changes the donor at 4,910. The number of cells between the two launch sites is a poor substitute for tracing where descendants actually copy.

The full gate accepts hops 256, 512, 4,032 and 5,952. The recipe uses 5,952 as the separated example because the quiet trace retains both stone workers and six paper descendants with zero paper touches on the stone. It still loses 27 individual paper processes to stone writes over the round. For the first such death, the stone hits 1,949 on turn 929 and a paper process executes that cell on turn 979. Hop 512 also retains all eight processes and its touches leave the stone unchanged. The other three hops are legal Redcode and appear in the diagnostic comparison after failing the full coexistence gate.

## Disciples of the Void replays

Each panel uses 128 rounds with identical load positions and first movers for every candidate. Panel one uses seeds 23,033 and 49,139. The fresh panel uses 31,517 and 52,489. Scores are points per round. [Published Disciples source](https://asdflkj.net/COREWAR/LP/HILL32/4xlb_6.red)

| Stone placement | First panel | Fresh panel |
| --- | ---: | ---: |
| Unbooted reference | 0.016 | 0.070 |
| 256 | 0.063 | 0.039 |
| 512 | 0.102 | 0.047 |
| 1,024 | 0.055 | 0.023 |
| 1,984 | 0.031 | 0.055 |
| 4,032 | 0.016 | 0.055 |
| 4,896 | 0.039 | 0.047 |
| 5,952 | 0.031 | 0.031 |

Hop 512 led the first panel, then fell behind the unbooted reference on fresh placements. Hop 5,952 drew four rounds and won zero on each panel. Keeping the paper out of the deployed stone in quiet play did not produce a repeatable competitive gain. The previous replay of the published *Distortion Energy* on these same panels scored 1.000 and 1.133. Its different paper, boot and stone remain separate factors. [Published worker control](lp-distortion-workers.md#battle-results)

At Disciples load position 561 with our hybrid moving first, neither paper touches its deployed stone. Disciples kills both stone workers in both layouts. The 512 layout wins after 12,366 cycles with 616 stone writes, while the 5,952 layout loses after 32,093 cycles with 1,538 writes. In this round the longer-lived stone does more work while its hybrid fares worse.

## What can be reused

- **Standard boot plus phase stone.** Use the existing single-cell-per-pass `boot` to move the whole worker template. The phase stone checks the wrapped copy span against the loaded image and recomputes its shot lane in the deployed frame. The full gate checks the opening shot sequence, complete orbit, late writes and two compatible stone workers at the limit. This support covers a direct standard boot in an unshifted parent frame.
- **Friendly-write audit.** Combine FIFO ancestry with actual operand destinations. Count changes separately from touches and distinguish whole copies from address side effects. This shows both the harmless self-copy at hop 512 and the lethal copy at hop 1,984. Static lane checks cover the boot and the stone's orbit. Dynamic paper descendants still need a trace.

The [lane study](lp-phase-lanes.md) keeps hop 5,952 and the worker phase fixed, then tests which stone lanes overwrite fewer paper copies.

## Reproduce

```sh
node scripts/algebra.js recipe lp-booted-phase-paper --rules lp-hill --out booted-phase-paper.red
node cli/zorewars.js check booted-phase-paper.red --rules lp-hill --json
node examples/hill-study/replay-lp-phase-deployment.mjs
node examples/hill-study/replay-lp-phase-deployment.mjs path/to/LP/HILL32/4xlb_6.red
```
