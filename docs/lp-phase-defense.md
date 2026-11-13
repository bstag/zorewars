# Hiding the sparse stone's return from an A-field scanner

`lp-hidden-return-paper` uses the same 21-cell image layout, 5,952 boot hop, ADD-plus-JMP worker phase and sparse `STEP 160`, `OFFSET 46` lane as `lp-sparse-phase-paper`. The defense changes one instruction in the stone template. The rest of the stone and the paper retain their original code. [Sparse lane study](lp-phase-lanes.md) · [Phase-stone block](../tools/algebra/blocks/lp-phase-stone.js)

## How Disciples stops the stone

The six stone cells deploy at 5,961–5,966. The return is at 5,965, and the bombing MOV is at 5,964. *Disciples of the Void* uses `JMZ.A` to read only the target's A field. A nonzero A falls through into a whole-instruction MOV that installs `JMP.B #0` from the scan cursor. The process on that cell then keeps jumping to itself. A later DAT sweep can kill it. [Published Disciples source](https://asdflkj.net/COREWAR/LP/HILL32/4xlb_6.red) · [Scanner and clear walkthrough](lp-disciples-source.md)

The table follows the match with Disciples loaded at 630 and our warrior moving first. Turns count executions by both warriors. Scanner sites are relative to the Disciples image. Stone addresses are relative to our image at zero.

| Turn | Baseline event |
| ---: | --- |
| 4,344 | The scanner at site 2,000 reads A=2 at the spent launch instruction, cell 5,961. |
| 4,352 | The scanner puts a JMP lock on the launch cell. The two stone workers are already running. |
| 7,460 | The scanner at site 2,156 reads A=−2 at the live return, cell 5,965. |
| 7,468 | The scanner copies its JMP lock over the return from cell 2,707. |
| 7,481 | A stone worker executes the lock. Its slot remains occupied. |
| 65,152–65,188 | The scanner at site 5,961 overwrites its own probe. Its guard reads A=0 and falls through on turn 65,164. Its first clear write lands on turn 65,188. |
| 75,156 | That scanner's backward DAT sweep reaches the locked return at 5,965. |
| 75,159 and 75,161 | Both stone workers execute that DAT and die. |

After the first worker executes the lock, the eight queued slots are `1990 P, 2872 P, 3740 P, 963 P, 942 P, 6 P, 5964 S, 5965 S`. The other stone worker is still queued at the MOV. This separates the original scanner sighting, the loss of useful stone work and the later release of both slots. [Replay and FIFO instrumentation](../examples/hill-study/replay-lp-phase-defense.mjs)

## One A-transparent instruction

The normal return is `JMP.B $-2, $0`. With `HIDERETURN 1` it becomes `JMP.B @0, $-2`. The A operand resolves through the jump's own B field and still goes back two cells. The B operand is direct and has no side effect. An A-only probe now reads zero. This encoding makes B part of the control flow, so a B-field overwrite can redirect it.

In the same match, the forward scanner probes 5,965 on turn 7,436, sees A=0 and continues scanning. The first executed lock moves to the bombing MOV at 5,964 on turn 11,929, after a different scanner detects its A=2 and writes a trap on turn 11,926. The hidden return allows 556 stone writes in the round, versus 372 for the baseline. The DAT sweep still kills both workers, now at the MOV on turns 75,143 and 75,145. Both hybrids lose this round. The defense preserves useful work until the next exposed instruction is trapped. It leaves that instruction and the sweeping clear in play.

At Disciples offset 3,648 with the scanner moving first, the MOV is trapped before the return is probed. Both versions make 389 stone writes. Hiding the later target buys no additional writes in this placement.

The quiet run keeps the first full FIFO and both stone workers, but the paper's later behavior changes. On turn 227 it copies the original template's return from cell 13 to cell 992. The hidden encoding has now spread outside the stone. The runner also tests `JMP.B $-2, $-2`, a direct return with the same B value as the hidden form. That control keeps the baseline quiet totals. All three quiet traces are translation-equivalent at loads 0 and 7,997.

| Quiet result | Baseline and direct same-B control | Hidden return |
| --- | ---: | ---: |
| First full queue | 938 | 938 |
| Turns with two stone and six paper processes | 74,811 | 41,087 |
| Stone writes | 6,770 | 7,910 |
| Stone writes over paper copies | 32 | 101 |
| Paper deaths on cells last written by stone | 6 | 75 |
| Final stone / paper | 2 / 6 | 2 / 4 |

## Matched Disciples panels

Each panel uses 128 rounds with matched placements and first movers. None of the three variants wins a round. The entries below are ties, so each point-per-round score is the tie count divided by 128.

| Seeds | Baseline ties | Direct same-B ties | Hidden-return ties |
| --- | ---: | ---: | ---: |
| 23,033 and 49,139 | 5 | 5 | 6 |
| 38,177 and 57,347 | 7 | 7 | 8 |
| 47,041 and 61,169 | 11 | 11 | 11 |

The hidden return turns six baseline losses into ties and four baseline ties into losses. It gains two ties across 384 rounds. The fresh third panel gives no net gain, while the quiet run shows substantially more damage to the companion paper. The hidden-return recipe records the defense as a separate experiment.

## Reuse the return encoding and the scan trace

A zero-A return fits a loop that has a fixed branch destination and can dedicate its B field to that displacement. The existing block keeps it optional through `HIDERETURN`. When screening against A-only scanners, trace which instruction gets probed, which instruction actually captures the worker, and who writes the fatal DAT. A process count alone includes workers parked on traps. The probe, trap and clear classifications in this replay use the known published Disciples layout.

## Reproduce

```sh
node scripts/algebra.js recipe lp-hidden-return-paper --rules lp-hill --out hidden-return-paper.red
node cli/zorewars.js check hidden-return-paper.red --rules lp-hill --json
node examples/hill-study/replay-lp-phase-defense.mjs path/to/LP/HILL32/4xlb_6.red
```
