# Disciples of the Void in the eight-process core

*Disciples of the Void* is inversed's four-scanner entry, ranked tenth in the retrieved Koenigstuhl LP recursive field. I traced the published 200-cell source on ZoreWars with 8,000 cells, eight processes, 80,000 cycles, a 200-cell length and separation, and 500 P-space slots. The solo traces at base 0 and base 7,993 agreed on the endgame timing and queue after translating addresses. The battle below is one selected local placement. [Published source](https://asdflkj.net/COREWAR/LP/HILL32/4xlb_6.red) · [Koenigstuhl LP](https://asdflkj.net/COREWAR/LP/hill32_rec.html) · [LP profiles and source audit](lp-top-ten-sources.md)

## Four images, two paths

The loaded entry at 99 splits to two copy paths. Each path copies one six-cell payload backward to two sites. In each pair of writes the first `MOV` predecrements the shared source cursor and the second uses its current value. Two pairs run per loop iteration and three iterations fill both images. At base zero the first payload write is turn 3 to 2,005, and all 24 payload cells have arrived by turn 30. Turns 33–36 seed each separate scan pointer with a JMP bomb. The payloads start at 2,000, 2,156, 5,961 and 6,117. The pointer cells are behind those bodies and serve as both scan cursors and bomb sources. [Published source](https://asdflkj.net/COREWAR/LP/HILL32/4xlb_6.red)

| Body start | First execution | Pointer and initial B field | First probe | First nonzero A read |
| ---: | --- | --- | --- | --- |
| 2,000 | Turn 40, ADD | 1,923, B=0 | Turn 44 at 1,845, then 1,767 | Turn 4,316 at 193, A=5, original boot MOV |
| 2,156 | Turn 42, SUB | 2,077, B=80 | Turn 46 at 2,235, then 2,313 | Turn 638 at 7, A=7, original boot MOV |
| 5,961 | Turn 43, ADD | 5,884, B=0 | Turn 47 at 5,806, then 5,728 | Turn 3,103 at 10, A=4, original boot MOV |
| 6,117 | Turn 45, SUB | 6,038, B=80 | Turn 49 at 6,196, then 6,274 | Turn 2,697 at 14, A=−2, original boot SPL |

The backwards arithmetic reads the current instruction's B field, −77, and the probe predecrements the pointer once more. The forward SUB subtracts −79, and its probe predecrements once more. For a body starting at `D`, the nominal probe at index `n` is `D−77−78n` on the backwards side or `D+1+78n` on the forwards side, with `n=1` at the first probe and addresses reduced modulo 8,000. The initial B=80 of the forward pointer accounts for the different first offset. `gcd(78, 8000)=2` gives 4,000 addresses per nominal orbit. Both bodies in one pair probe odd addresses and both in the other pair probe even addresses. Within a pair, the deployed bodies are 156 cells apart and sweep opposite ways. [Published source](https://asdflkj.net/COREWAR/LP/HILL32/4xlb_6.red) · [Operand execution](../src/engine/vm.js)

A zero A field is transparent to `JMZ.A`, even on live code. In each undamaged deployed body the only nonzero A field is on the probe instruction itself. The first nonzero A read by each scanner in the table came from the abandoned loaded image. The first friendly hit is therefore distinct from the first hit on an active peer. Each of these early hits gets a JMP bomb from the cursor. The attack postincrements the pointer and the next probe predecrements it, so the scanner checks that cell again before resuming its ±78 advance. The total probe count then includes repeats. [Published source](https://asdflkj.net/COREWAR/LP/HILL32/4xlb_6.red)

### What preserves the late meeting

Let `s` be the step magnitude, `C` the core size, and `N = C / gcd(C,s)` the orbit length. With the published cursor seeds, the backwards body at `D` probes `D+1−s(n+1)` and the forwards body at `F` probes `F+1+sn`. Each body's visible cell is its start plus one. When `F−D ≡ ks mod C`, the nominal first peer probe is `−k−1` for the backwards body and `−k` for the forwards body, interpreted as positive indices modulo `N`. Their own probe cells are reached at `N−1` and `N`. A gap outside the stride's residue class puts a pair's visible cells on separate orbits. [Published cursor and boot layout](https://asdflkj.net/COREWAR/LP/HILL32/4xlb_6.red)

In an 8,000-cell core, preserving a 3,997th backwards peer probe and 3,999th self probe requires `gcd(8000,s)=2` and a gap of `2s mod 8000`. A fixed gap of 156 allows the nominal solutions 78 and 4,078. Copy spans and cursor cells still need a separate overlap check. For instance, step 6 with gap 12 gives a 4,000-cell orbit but places the forwards cursor inside the backwards payload. Translating the entire image preserves its relative geometry. Moving just the deployed sites can change their encounter order with the abandoned image.

| Source variant | Nominal backwards / forwards peer probe | First pair observed at base zero |
| --- | --- | --- |
| Step 78, gap 156, published | 3,997 / 3,998 | Backwards peer hit at turn 32,060, then self hit at 32,088 |
| Step 78, gap 78 | 3,998 / 3,999 | Backwards peer hit at 32,068, self still at 32,088 |
| Step 78, gap 234 | 3,996 / 3,997 | Backwards peer hit at 32,052, self still at 32,088 |
| Step 82, gap 164 | 3,997 / 3,998 | Forwards peer hit at 32,082, backwards peer hit at 32,084. Both enter their clear paths. |
| Step 78, gap 157 | Separate orbits within each pair | A backwards body sees the other pair's forwards body on distinct probe 2,818 at turn 22,604. |

The 82/164 variant preserves the nominal order in probe counts and reverses it in elapsed turns. The first backwards body takes six earlier hit paths and the first forwards body takes five. Each extra hit path consumes three of its own instructions, or 12 solo turns with four active scanners. Advancing the forwards cursor seed by `ts` advances its nominal peer and self probes by `t` positions around the orbit. Adding ten steps to the published forwards seed gave it a peer hit on distinct probe 3,988 and a self hit on 3,990. This changed which scanner retired and which entered the clear while keeping the same launch addresses. [Published source used for local variants](https://asdflkj.net/COREWAR/LP/HILL32/4xlb_6.red)

### Why the A-only comparison matters

The published JMP bomb has A=0 and copies the cursor's live B field. Its replacement is transparent to the A-only probe when the scanner checks the cell again, so the scan can move on. Changing just the two `JMZ.A` probes to `JMZ.B` or `JMZ.F` made the published layout stall on earlier targets. Both controls ran to turn 80,000 with no active-peer detection and no SPL clear. For example, the backwards scanner at 5,961 first detects original cell 190 at turn 623 in either control, with A=0 and B=−7. It replaces that cell with a JMP carrying a nonzero B and keeps seeing it. B and both-field probes can also see friendly payload cells on both parities. A gate for a configurable probe should check that its own bomb becomes invisible on the repeated probe before relying on the orbit arithmetic. [Published source](https://asdflkj.net/COREWAR/LP/HILL32/4xlb_6.red) · [JMZ numeric field tests](../src/engine/vm.js)

## Endgame in the quiet core

The two backwards bodies reach the forwards bodies' probe instructions on their 3,997th distinct probes. Each overwrites its peer with a JMP to the same cell. The backwards bodies then reach their own nonzero-A probe instructions on their 3,999th distinct probes. When they write their JMP bomb over their own probe, the following `JMN.A` sees A=0 there and falls through into the SPL. The clear copies backward from the local cell at `D−2`. Its first target is `D−3`. [Published source](https://asdflkj.net/COREWAR/LP/HILL32/4xlb_6.red) · [VM process queue and trace](../src/engine/vm.js)

| Event | First pair, solo turn | Second pair, solo turn |
| --- | --- | --- |
| Backwards body reads active peer | 32,060, cell 2,157 | 32,075, cell 6,118 |
| Backwards body locks peer with JMP | 32,064 | 32,079 |
| Peer first executes the JMP lock | 32,066 | 32,081 |
| Backwards body reads its own probe | 32,088, cell 2,001 | 32,103, cell 5,962 |
| Backwards body overwrites its probe | 32,092 | 32,108 |
| Guard falls through | 32,096 | 32,114 |
| Clear first executes SPL | 32,100 | 32,120 |
| Clear first writes DAT | 32,104 to 1,997 | 32,126 to 5,958 |

### Process slots after the handoff

The queue below is in FIFO order immediately after each solo turn. The site counts are in start order 2,000, 2,156, 5,961, 6,117. Each includes PCs in the six-cell body and the DAT continuation directly after it. The continuation occupies a slot until it executes. The translated run at base 7,993 reproduced the cap, lock deaths, retirement and final queue after subtracting its load address. [Published source](https://asdflkj.net/COREWAR/LP/HILL32/4xlb_6.red) · [FIFO queue implementation](../src/engine/vm.js)

| Checkpoint | FIFO PCs after the turn | Site counts |
| --- | --- | --- |
| 32,100, first backward SPL | 6118, 2157, 5962, 2005, 2004 | 2 / 1 / 1 / 1 |
| 32,120, second backward SPL | 2006, 2005, 2004, 6118, 2157, 5966, 5965 | 3 / 1 / 2 / 1 |
| 32,127, first eight-process queue | 2006, 2005, 2004, 6118, 2157, 5967, 5966, 5965 | 3 / 1 / 3 / 1 |
| 62,540, lock at 2157 dies | 5967, 5966, 5965, 2006, 2005, 2004, 6118 | 3 / 0 / 3 / 1 |
| 63,058, lock at 6118 dies | 5967, 5966, 5965, 2006, 2005, 2004 | 3 / 0 / 3 / 0 |
| 63,531, first clear's final process dies | 5967, 5966, 5965 | 0 / 0 / 3 / 0 |
| 80,000, end of solo round | 5966, 5965 | 0 / 0 / 2 / 0 |

The writer at 5,966 replaces the JMP lock at 2,157 with DAT on turn 62,534. The writer at 2,005 does the same to the other lock on turn 63,056. The second sweep then reaches the first clear's MOV at 2,005 on turn 63,522 and its SPL at 2,004 on 63,528. Their processes die three turns after each write. Later the surviving writer overwrites itself on turn 75,644 and its last MOV-line process dies on 75,647. At the round limit 5,966 contains DAT and 5,965 is still a self-SPL. Two queued PCs can therefore mean one feeder repeatedly sending a process to DAT, with neither site still writing. [Published source](https://asdflkj.net/COREWAR/LP/HILL32/4xlb_6.red) · [VM write provenance](../src/engine/vm.js)

I replayed two narrow controls in the quiet core. For a selected whole-cell write, the VM restored the destination as it stood after address resolution and before the copy, preserving the address side effects and elapsed turn. Restoring just the four cross-clear writes to the other clear's SPL and MOV leaves both clear writers active at the limit. The original lock deaths still occur at their measured turns, and the final queue is `[2005,2004,5967,5966,5965]`. Restoring only the two writes that would kill the locked forward workers keeps those slots occupied. The first clear's retirement moves from 63,531 to 63,761, and the final queue is `[5965,6118,2157,5967]`. Cross-clearing decides which writer survives, while removing the locked peers changes the remaining turn budget. These controls test queue and writer behavior in solo play. [Published source](https://asdflkj.net/COREWAR/LP/HILL32/4xlb_6.red) · [Operand resolution order](../src/engine/vm.js)

## A paper can trigger the clear early

At opponent offset 3,138 with *Disciples* moving first, the published *R.O.U.S.* reaches both the scan cursor and the guard via its scatter instruction. Here a step counts an instruction by either warrior. On step 664, the scatter replaces the JMP template at 1,923 with DAT. On step 2,520, its A operand's B-postincrement changes the guard at 2,003 from B=−2 to B=−1. It also copies the scanner's probe from 2,001 to 7,634. The guard uses that B field for both its indirect branch target and its direct test. With B=−1 it tests the adjacent MOV at 2,002, whose A is zero, instead of the probe at 2,001. On step 2,927 it falls through. The clear enters SPL at step 2,935 and makes its first DAT write at step 2,943. [Disciples source](https://asdflkj.net/COREWAR/LP/HILL32/4xlb_6.red) · [R.O.U.S. source](https://asdflkj.net/COREWAR/LP/HILL32/rous.red)

*Disciples* wins the unmodified round at cycle 19,843. The final kill happens on step 39,686 at 7,418, where a scanner had left a JMP lock. One step earlier the clear at 2,005 replaced that JMP with DAT. I replayed two one-step controls. Restoring just the guard B field after step 2,520 prevents that clear from executing for the whole round and gives a tie at 80,000 cycles. Restoring just the cursor cell at 1,923 after step 664 delays the first clear SPL from step 2,935 to step 3,015 and still wins at cycle 24,367. This case shows how a scatter side effect can bring on the sweep that eventually kills the paper. [Round runner](../src/engine/battle.js) · [VM field and write tracking](../src/engine/vm.js)

## Checks for a reusable block

- Verify all four complete payloads before dispatch, including the initial B value in each separately seeded pointer. Verify the four entry PCs under the FIFO queue and the eight-process limit.
- Verify the first probe address and signed step for each body at two translated loads. Use an A-zero marker and a nonzero-A marker to test that the first is passed over and the second receives a fresh copy of the correct bomb.
- Track the current branch target, the guard cell and the source cursor independently. Plant an altered guard B field to test whether a premature switch is an intended behavior or an avoidable dependency. The quiet trace needs separate assertions for attacks on abandoned code, a peer's probe and the scanner's own probe.
- Check that the clear can start and write backwards while the locked peers still occupy slots. Then measure whether preserving the original late collision and lock sequence earns more points than keeping the two scan pairs independent.

For a trace using the original files and placement, run from the repo root. The first round puts *R.O.U.S.* at 3,138 and gives *Disciples* the first move.

```sh
node cli/zorewars.js trace 4xlb_6.red rous.red -s 8000 -p 8 -c 80000 -l 200 -d 200 -S 500 --fixed 3138 --round 1 --last 60
```
