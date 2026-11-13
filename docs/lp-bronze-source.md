# Bronze minotaur's two bombing papers

G. Labarga's *Bronze minotaur* ranks third in the retrieved Koenigstuhl LP recursive field. I traced the 200-cell published image under native LP limits, then changed only its two-instruction launch to compare the original with each lineage running alone. The two papers share an attack pattern and compete for the same eight slots. [Published source](https://asdflkj.net/COREWAR/LP/HILL32/bronzeminotaur.red) · [Koenigstuhl LP field](https://asdflkj.net/COREWAR/LP/hill32_rec.html)

## How both lineages get running

At load zero, the two seven-cell bodies occupy addresses 0–6 and 193–199. The boot at 70 executes SPL and queues its own continuation at 71 ahead of the new process at 1. On turn 2 that continuation jumps to 194. Both lineages enter the copy loop one cell after their initializer. Each initial initializer already contains B=7. Its A field holds the later generation's count, 20 for the first body and 17 for the second. The first generation copies seven cells, while a process that reaches the initializer uses its A field to reload the count. [Published boot and copy loops](https://asdflkj.net/COREWAR/LP/HILL32/bronzeminotaur.red) · [FIFO execution](../src/engine/vm.js)

| Event at load zero | Lineage A | Lineage B |
| --- | --- | --- |
| First backward copy | Turn 3, PC 1, cells 6 → 5,746 | Turn 4, PC 194, cells 199 → 6,613 |
| First scatter copy | Turn 5, cells 1,172 → 827 | Turn 6, cells 1,365 → 1,020 |
| First restart SPL | Turn 59, queues local initializer 0 | Turn 60, queues local initializer 193 |
| First successor transfer | Turn 61, JMZ queues 5,740 | Turn 63, JMZ queues 6,607 |
| First successor executes | Turn 65, initializer at 5,740 | Turn 67, initializer at 6,607 |

On the first copy, the source and destination cursor are the same JMZ cell. ZoreWars captures the source instruction before evaluating the destination operand. In lineage A, the copy to 5,746 keeps A=5,741 even though the parent cursor at 6 becomes A=5,740 during the write. Lineage B likewise copies A=6,415 and leaves A=6,414 in its parent cursor. At completion, the parent cursor has been decremented seven times. Its JMZ tests B on the remote initializer, which was copied with B=0, and jumps to that same cell. The local restart and the remote transfer therefore create two continuing workers with different cursor histories. [Published cursor instructions](https://asdflkj.net/COREWAR/LP/HILL32/bronzeminotaur.red) · [VM source register and operand order](../src/engine/vm.js)

Each copy-loop iteration also performs a scatter copy through two A-predecrement operands. The following self-indexed ADD reads and writes the preceding MOV, doubling both of its offsets. The trace shows 1,171 and 826 becoming 2,342 and 1,652 on turn 7 in A and turn 8 in B. The ADD's own A field returns to zero after its predecrement and postincrement. The copied value comes from the live remote source cell, so the scatter can carry DAT, code, or pointer fields that earlier traffic left behind. [Published scatter instructions](https://asdflkj.net/COREWAR/LP/HILL32/bronzeminotaur.red) · [Address side effects](../src/engine/vm.js)

## Eight slots and mutual interference

I tracked ancestry through the FIFO pushes. Both successors of a split inherit the active process's lineage after the boot assigns A or B. This distinguishes descendants even when the two papers cross the same addresses. At turn 1 the queue is `[71,1]`, and at turn 2 it is `[1,194]`. By turn 60 the two local restart branches and their continuing parents occupy four slots, two per lineage. At the first eight-process checkpoint, turn 412, the FIFO is `[6,0,5013,6610,6593,197,5746,5740]`, tagged `[A,A,B,B,B,B,A,A]`. This split emerges from the two copy loops reaching their next SPLs. The boot assigns no fixed quota. [Published source](https://asdflkj.net/COREWAR/LP/HILL32/bronzeminotaur.red) · [Process queue implementation](../src/engine/vm.js)

The first death in each lineage comes from a whole-instruction copy by the other. A copies a DAT into 3,406 on turn 1,086, and a B process executes it on turn 1,103. B copies a DAT into 6,888 on turn 2,255, and an A process dies there on turn 2,329. A later A-side field write leaves a different last-touch stamp at 6,888, so I also tracked the writer of the full instruction image. A's last process dies on turn 16,824 on a DAT written by A. B's last process dies on turn 48,259 on a DAT written by B one turn earlier. The two-lineage layout shows both mutual interference and eventual same-lineage failure in this quiet trace. [Published source](https://asdflkj.net/COREWAR/LP/HILL32/bronzeminotaur.red) · [Prior solo census](lp-top-ten.md)

| Version | Change to the launch | First reaches eight slots | Solo result at load zero |
| --- | --- | ---: | --- |
| Published dual paper | Original SPL then JMP | 412, four A and four B | A gone at 16,824, B gone at 48,259 |
| A only | Replace boot JMP with DAT, retaining both operands | 528, all A | Six processes at turn 80,000 |
| B only | Replace boot SPL with NOP, retaining both operands | 456, all B | Eight processes at turn 80,000 |

Both controls keep all 200 loaded cells and execute the original boot operands. They start their first copy at turn 3, dispatch their remote copy at turn 32, and run one paper through all available slots. The dual trace spends turns on both bodies, so removing a lineage also changes the scheduler cadence of the retained one. [Published source](https://asdflkj.net/COREWAR/LP/HILL32/bronzeminotaur.red)

## A paired comparison on the other LP leaders

Each version fought the other nine Koenigstuhl LP top-ten warriors for 64 rounds at seed 23,033 and 64 at seed 49,139. The versions faced the same opponents, placements and first movers. Each match used the published settings, including private P-space across rounds. Scores are ordinary three-point wins plus one-point ties. [Published LP field](https://asdflkj.net/COREWAR/LP/hill32_rec.html) · [ZoreWars match runner](../src/engine/battle.js)

| Opponent | Published dual W/L/T | A only W/L/T | B only W/L/T |
| --- | ---: | ---: | ---: |
| R.O.U.S. | 43/74/11 | 40/80/8 | 36/83/9 |
| Replinator | 68/56/4 | 74/52/2 | 66/58/4 |
| Digital Rain | 77/47/4 | 80/45/3 | 65/58/5 |
| Fear of the Unknown | 31/37/60 | 43/34/51 | 35/34/59 |
| The LP Destroyer | 67/51/10 | 70/49/9 | 64/59/5 |
| Hippogriff | 65/46/17 | 61/42/25 | 56/51/21 |
| Distortion Energy | 41/40/47 | 57/28/43 | 63/33/32 |
| The LP Destroyer II | 75/50/3 | 80/46/2 | 75/50/3 |
| Disciples of the Void | 46/52/30 | 44/60/24 | 37/61/30 |
| Points per round, 1,152 rounds per version | 1.4974 | 1.5747 | 1.4401 |

The dual version led both controls against R.O.U.S., Hippogriff, and Disciples. A alone led the panel overall, and B alone scored best against Distortion Energy. A reusable dual-paper gate can check that each worker copies the intended image, resets its own count, and enters its successor before the queue fills. Competitive evaluation then needs both single-lineage controls. That reveals whether the second lineage adds coverage on the target field or consumes turns the first could have used. [Published LP leaders and code maps](lp-top-ten-sources.md)
