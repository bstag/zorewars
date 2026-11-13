# Two bombing papers on the LP queue

G. Labarga's *Bronze minotaur* starts two seven-cell papers. Both scatter through the same doubling offsets, but they jump different distances and copy different lengths after a restart. The 16-cell `lp-bronze-paper` recipe packs this mechanism into two `lp-scatter-paper` blocks and a `par` launch. It runs on either full-size LP profile. Use `lp-hill` to replay the published 200-cell image. [Published warrior](https://asdflkj.net/COREWAR/LP/HILL32/bronzeminotaur.red) · [Koenigstuhl LP standings](https://asdflkj.net/COREWAR/LP/hill32_rec.html) · [Source walkthrough](lp-bronze-source.md)

## The reusable body

Each pass copies a cell backwards, scatters a live core cell, doubles both scatter offsets, and checks the copy counter. `READMODE 1` selects an A-predecrement scatter read, as in Bronze. The default B-postincrement mode still uses the read pointer's original B value before incrementing it. Both modes use A-predecrement for the write. `RESTART` sets the remote B-postincrement offset of the SPL. The offset is useful even when the SPL cannot add a process, since its addressing side effect still runs. [Block and first-generation footprint check](../tools/algebra/blocks/lp-scatter-paper.js)

The first generation copies seven cells. Its first write copies the transfer instruction before the destination operand decrements that same instruction's A cursor. The remote instruction carries the original displacement, while the local cursor moves toward the remote seed. When the copy finishes, JMZ checks B on that seed and queues the jump if B is zero. The SPL just before JMZ can also queue a local restart, which uses `COUNT` to decide how many cells to copy on its next pass. [Copy and launch trace in the original](lp-bronze-source.md#how-both-lineages-get-running)

The compact recipe keeps the published displacements and restart counts of 20 and 17. It substitutes a direct ADD for the published self-indexed ADD and puts the launch and both bodies next to each other. That shifts the scatter and copy destinations even though startup takes the same number of turns. Trying to hold both original first copy addresses fixed made one copy overlap its own first-generation scatter footprint in the packed layout, which the linker rejected. Moving just A back to the original address passed linking but failed quiet survival.

## What the eight slots do

The trace follows the actual FIFO pushes. A queued process keeps its ancestry tag when it moves to a copy or executes modified code. A capped SPL admits the continuation and discards the optional child. The following JMZ can still move that continuation to a new address without needing a ninth slot. To count an intact transfer, the trace checks the seven destination cells and allows only the fields the block intentionally changes. [Trace runner](../examples/hill-study/trace-lp-bronze-paper.mjs) · [FIFO ancestry tracker](../tools/algebra/fifo-lineage.js)

| Quiet round event | Published dual | Compact dual | Compact A only | Compact B only |
| --- | --- | --- | --- | --- |
| First successful transfer | A 61, B 63 | A 61, B 63 | A 32 | B 32 |
| First eight-process FIFO | Turn 412, `A A B B B B A A` | Turn 412, `A A B B B B A A` | Turn 528 | Turn 456 |
| Extinction | A 16,824, B 48,259 | B 11,478 | — | — |
| Processes at end | 0 | 8 A | 7 A | 8 B |

In the compact dual, A first transfers to an intact copy at the cap on turn 413, and B does so on turn 882. A later loses a process on a cell last touched by B on turn 4,970. B sees the reverse on turn 5,916 and loses its final process on turn 11,478 at a cell last touched by B. Last touch can be a pointer side effect. The published-source study separately tracked the full DAT writes and found that each lineage's first death came from the other lineage's scatter. Quiet compact traces match at load positions 0 and 7,997 after normalizing addresses. [Published death provenance](lp-bronze-source.md#eight-slots-and-mutual-interference)

## What the second paper buys

Each compact control changes one launch opcode in the same 16-cell image. A-only lets the SPL child live and kills the continuing launcher with DAT. B-only replaces SPL with NOP and follows the original continuation. The disabled body remains loaded in each case. The controls spend more early turns on one worker and expose how that worker behaves without a competing branch.

| Version | First field | Separate field |
| --- | ---: | ---: |
| Published dual | 1.320 | 1.445 |
| Compact dual | 1.227 | 1.352 |
| Compact A only | 1.234 | 1.305 |
| Compact B only | 1.117 | 1.477 |

Each score is points per round over four opponents, two seeds and 48 rounds per opponent and seed. The first field is R.O.U.S., Digital Rain, Distortion Energy and Disciples of the Void. The separate field is Replinator, Hippogriff, Fear of the Unknown and The LP Destroyer II. Each compact single leads the compact pair on one field. The pair still has the best compact score against individual opponents such as R.O.U.S. and Replinator. In the separate nine-opponent study of the published image, the published A-only control led overall and the pair led against three opponents. [Published same-image controls](lp-bronze-source.md)

Distortion Energy gives us a different pairing to study. Its four-cell stone can mutate into a clear while a paper runs elsewhere. Trace the mutation writes and the queue with stone-only, paper-only and dual launch controls before extracting the transition into a reusable block. [Published Distortion Energy source](https://asdflkj.net/COREWAR/LP/HILL32/dse_6.red)

## Reproduce

```sh
node scripts/algebra.js recipe lp-bronze-paper --rules lp-hill --out bronze.red
node cli/zorewars.js check bronze.red --rules lp-hill --json
node examples/hill-study/trace-lp-bronze-paper.mjs
node examples/hill-study/trace-lp-bronze-paper.mjs path/to/LP/HILL32
```
