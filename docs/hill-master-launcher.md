# Master of the Wins and a reusable marching stone

Christian Schmidt's *Master of the Wins* was second on the public Tiny LP standings at challenge 195. Its published entry is 43 cells. It opens with a short two-factor comparison and multiply decoder, attacks around the result, and runs a controller that repeatedly copies a three-cell stone. Tiny LP allows 50 loaded instructions and only eight processes on an 800-cell ring. [SAL Tiny LP 195](https://sal.discontinuity.info/hill.php?key=tinylp&t=195&how=late) · [Published Redcode](https://asdflkj.net/COREWAR/ODD/HILL32/masterotw.red)

## What the original does

The opening has three comparison groups. Unequal pairs take paths that can alter the live fields of `qf`, whose `MUL.X` decodes two addresses. The attack around `qlo` uses a four-instruction loop with moving copy and decrement operands. Its visit count depends on what those operands encounter. A quiet start reaches the boot without executing the burst.

In the boot, the same `bptr` A field is the backward copy destination and the SPL target. The three copy instructions consume three address units. The subsequent add of 695 advances the next entry by 692 modulo 800. A separate DJN supplies the controller's return path and remote decrement effects. In the deployed stone, cross-field subtraction and the return jump each move its source pointer. The source therefore drifts by two each lap and the attack destination moves by −637. This stone copies what it finds through the source operand, which can include opponent code.

The table is a ZoreWars solo trace at load address zero. Cycle numbers are shown after the instruction executes.

| Cycle | Event | What the VM records |
| ---: | --- | --- |
| 6 | Quiet opening hands on | Controller entry 14 is queued |
| 7–9 | Backward transfer | Writes at 291, 290, 289 |
| 10 | First SPL | Parent continues at 18, child is queued at 289 |
| 12 | First worker MOV | Bomb write at 453, A predecrement at 584, source read at 583 |
| 21, 38, 61 | Next three SPLs | Child entries 181, 73, 765, crossing the seam on the last one |
| 166 | Seventh child joins | Eight processes including the controller |
| 213 | Next SPL at cap | Copy already complete, controller continues with no extra child |

```sh
node cli/zorewars.js trace masterotw.red --rules tinylp --cycles 230 --last 230
```

## Extracting the launch mechanism

`marching-stone-boot` is an original nine-cell leaf. Three MOVs write a worker backwards through the SPL's A field, then the SPL launches it. The controller restores those three units and moves by `MARCH`, and keeps copying once the cap blocks new children. The payload is a separate three-cell stone that reads from its preceding cell. That cell starts empty in solo play. An opponent that changes it can change the bomb. The leaf isolates launch timing and wrap from the original's moving-source attack and remote decrement stream. [Block source](../tools/algebra/blocks/marching-stone-boot.js)

The deployment grain is `gcd(CORESIZE, MARCH)`. Every slot reserves four cells, including its blank source. The shot grain is `gcd(CORESIZE, MARCH, STRIDE)`, so all shots from all slots occupy one residue class. The linker excludes overlaps among slots, blank sources, shot targets and the linked image. With default `MARCH=280` on an 800-cell ring, there are 20 slots. The full gate checks every fresh copy, launch destination, parent and child queue, bomb write and stride. The focused test places the first worker at address 799, checks the reverse writes at 1, 0 and 799, then follows the controller back to its first slot while the queue is full. The boot completes in three turns and dispatches on turn four. The child first attacks on turn six. [Verification tests](../test/algebra-marching-stone.test.js)

```sh
echo '{"id":"marching-stone-boot"}' | node scripts/algebra.js build - --rules tinylp --verification full
```

A four-unit `opening-qscan-qi` can precede it in 36 cells. The gate runs both a quiet handoff and a planted target. The two-factor scan hands on a hit, while the marching controller uses the placement in its own contract. The scan only directs an attack when a probe-consuming step follows it. A 40-cell example can instead use `opening-qscan-decode` and `probe-burst` in sequence before the launcher. Both examples use `FIRST=250, MARCH=240` to protect the bigger linked image. [Two-factor opening](../tools/algebra/blocks/hillqv.js) · [Probe burst](../tools/algebra/blocks/hillopen.js)

```sh
echo '{"id":"seq","kids":[{"id":"opening-qscan-qi","P":{"UNITS":4,"FA":53,"FB":137,"TA":2,"TB":3,"SA":5,"SB":7,"RA":11,"RB":13,"STEP":41}},{"id":"marching-stone-boot","P":{"FIRST":250,"MARCH":240}}]}' | node scripts/algebra.js build - --rules tinylp --verification full
```

## What the benchmark says about the extraction

The panel was *KISS*, *DaubFusion*, *FragPaper 800*, *ugly redcode*, *tiny Roskilde* and *swallow*. Each matchup ran all relative load offsets from 50 to 750 and both first-mover orders, with fresh state for 1,402 rounds. The three block designs use the same controller parameters, measured relative to the controller's own entry, so adding an opening also changes the physical deployment positions. These are fixed-field comparisons. [Source panel](https://asdflkj.net/COREWAR/ODD/hill32.html) · [Round runner](../src/engine/battle.js)

| Design | Loaded cells | Points per round |
| --- | ---: | ---: |
| Published *Master of the Wins* | 43 | 1.307 |
| Marching boot and stone | 9 | 0.320 |
| Two-factor scan and marching boot | 36 | 0.245 |
| Decoding scan, probe burst and marching boot | 40 | 0.249 |

With `MARCH=240` and `STRIDE=80`, the conservative stone targets only ten cells across the ring. The original's attack stride is coprime with the core and its moving source changes what it throws. The results show how much competitive work is left after reproducing the launch pattern. A wider payload and an explicit way to protect the controller from friendly shots are the next mechanisms to test.
