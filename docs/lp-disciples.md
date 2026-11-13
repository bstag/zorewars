# Four scanners under the Limited Process cap

The [transparent pair study](lp-transparent-pair.md) extracts the published scanner's full parity orbit and late self-hit into a 26-cell recipe. Its 54-cell quartet then traces two pairs sharing the same eight slots, including the DAT collisions that retire the locked workers and one of the clears.

*Disciples of the Void* is tenth in the Koenigstuhl LP recursive standings. Two boot paths deploy four six-cell scanners. Each path supplies one scanner to each of two pairs. Within a pair the scanners walk opposite ways. The 3,961-cell displacement between pairs is odd, so corresponding scanners probe opposite parities. [Koenigstuhl LP standings](https://asdflkj.net/COREWAR/LP/hill32_rec.html) · [Published source](https://asdflkj.net/COREWAR/LP/HILL32/4xlb_6.red)

## Follow the scan into the clear

At load zero, the original starts running the deployed copies at addresses 2000, 2156, 5961 and 6117 on turns 40, 42, 43 and 45. Its ADD and SUB update a B pointer, then the `JMZ.A` predecrement contributes the last unit of its net −78 or +78 step. Each probe sees the target's A-field. A nonzero B-field can pass unnoticed. Most of the loaded scanner is transparent to this test.

In the quiet trace the first nonzero A fields the scanners find belong to their abandoned loaded image. The first hit on another live scanner arrives on turn 32,060. The backward scanner overwrites its partner with a JMP lock, then hits its own code and switches into an SPL-fed clear. The last DAT sweep can kill processes held by the JMP.

At one fixed placement against R.O.U.S., a paper operand's postincrement changes the scan guard's B-field from −2 to −1. The guard reads the adjacent MOV, sees a zero A-field, and enters the clear early. In that round, restoring just the guard field changes a scanner win into a tie. The [source trace](lp-disciples-source.md) includes the placement and the control.

## Verify a complete scan lane

The 29-cell `lp-opposed-scanners` block keeps the two loaders, opposite directions, A-field detection and JMP strike. It uses a stride of 80 and a separate bomb cell. A lane repeats after 100 probes, so the linker can exclude the entire loaded image and all four deployed bodies by checking their residues. The published stride of 78 has a much wider orbit of 4,000 cells per parity and can find friendly code late. Our isolated scan model stays in its probe lanes for the whole round. Its bomb selector can use DAT as a controlled comparison.

The four model scanners first execute on turns 35, 37, 38 and 40 and first probe on turns 39, 41, 42 and 44. A marker on the first lane at offset 2057 is trapped on turn 43. The gate checks each copy before entry, every signed probe, the hit destination and one survivor per site. Wrapped tests verify the complete orbit and show that an otherwise identical marker with only a nonzero B-field survives.

| Geometry | Config | Combined unique probe cells | First scanner starts |
| --- | --- | ---: | ---: |
| One lane | `SHIFT=4000, SPREAD=0` | 100 | 35 |
| Two lanes | `SHIFT=4001, SPREAD=0` | 200 | 35 |
| Four lanes | `SHIFT=4001, SPREAD=10` | 400 | 35 |

## Replay against six papers and hybrids

The same opponents and placement seeds run against every candidate. Each matchup uses 64 rounds per seed, with seeds 521 and 1777. P-space carries between rounds. The geometry changes also move probes or whole copies, so these scores describe each chosen layout. The JMP and DAT comparison holds every address constant.

| Build | Six-opponent mean | Against scatter paper | Against its quiet control |
| --- | ---: | ---: | ---: |
| Published Disciples | 1.621 | 1.422 | 2.852 |
| Published Disciples with forced rescan | 0.727 | 0.727 | 0.992 |
| One lane, JMP | 0.372 | 0.336 | 0.953 |
| Two lanes, JMP | 0.380 | 0.289 | 0.898 |
| Four lanes, JMP | 0.452 | 0.469 | 0.969 |
| Four lanes, DAT | 0.158 | 0.047 | 0.398 |

Four probe lanes beat two on this panel, and JMP outscored DAT against all six opponents at the four-lane layout. The one-cell shift that separates the pairs' parities produced a small panel gain and scored lower against both of our paper variants. The original's wider probe orbit and late clear are the major differences between the model and the source.

The forced-rescan control changes the two `JMN.A` guards to unconditional jumps through the same operand. The instruction fields and addresses stay fixed, but an intact guard always branches back instead of handing off to the clear. The score fell against every opponent. This measures the value of the conditional handoff in the published design, including its response to changes in pointer state.

## Test the JMP-to-DAT handoff

The 49-cell `lp-opposed-handoff` recipe adds a guard and a clear to each scanner. A scanner first traps a nonzero-A cell with JMP. When its guard reads zero A, it overwrites the trap with DAT and repeatedly clears the 120 cells behind its own deployment. The link check keeps each sweep clear of friendly code. A planted probe gets JMP on turn 93 and DAT on turn 101. The new boot first executes on turn 85, compared with turn 35 for the 29-cell scanner.

| Guard in the 49-cell layout | Behavior after a trap | Six-opponent mean |
| --- | --- | ---: |
| `HANDOFF=0` | Unconditionally resume scanning | 0.385 |
| `HANDOFF=1` | Resume while the scanner's probe still has nonzero A | 0.380 |
| `HANDOFF=2` | Enter the clear when the struck cell has zero A | 0.102 |

The replay uses the same six opponents and seed schedule as above. Modes 0 and 2 differ only in the opcode and modifier of the two guard templates. On a wrapped load, a separate injection redirected mode 1's guard to a zero-A cell after the JMP write. That produced the same turn-101 DAT while the intact guard resumed scanning.

The confirmed-trap variant scored lower than the matched rescan against all six opponents. This version commits a scanner to a fixed strip as soon as its first trap lands. The published design keeps scanning until the guard fails and then sweeps beyond a small strip. The test isolates the early handoff in the model and leaves the timing and reach of the published clear as separate questions.

### Delay the clear by counting strikes

`HANDOFF=3` decrements a private counter after each JMP write. `HITS` sets how many strikes a scanner makes before handing off. A miss leaves the count alone, and another scanner's strikes do not advance it. The switch overwrites the last struck cell with DAT and enters the same 120-cell sweep. The counter uses a spare cell in the 49-cell template. The model requires four distinct probe lanes so the gate can plant the full strike sequence on one lane and verify that the other three finish their orbits.

The first replay used the same six opponents and seeds 521 and 1777. The counted rows differ only in their initial counters. The rescan row comes from the earlier matched-layout replay. The DAT timings use consecutive planted targets and count one-based solo turns. The sample columns count rounds with at least one observed handoff in the first 16 starts at seed 521.

| Handoff threshold | First DAT on consecutive markers | Six-opponent mean | Scatter paper handoffs | Quiet paper handoffs |
| --- | ---: | ---: | ---: | ---: |
| 1 strike | 101 | 0.117 | 16 / 16 | 16 / 16 |
| 2 strikes | 121 | 0.129 | 16 / 16 | 16 / 16 |
| 4 strikes | 161 | 0.150 | 16 / 16 | 16 / 16 |
| 8 strikes | 241 | 0.246 | 14 / 16 | 11 / 16 |
| 16 strikes | 401 | 0.255 | 14 / 16 | 1 / 16 |
| 32 strikes | 721 | 0.336 | 12 / 16 | 1 / 16 |
| Rescan | — | 0.385 | — | — |

The six-opponent mean rose as the switch moved later. At 32 strikes, the build matched the rescan against the two paper controls in this panel. The aggregate gap came from the four published opponents. The observed rounds show that the same threshold can leave one matchup mostly scanning and send another into the clear regularly.

The follow-up kept the six opponents fixed and used fresh placement seeds 2053 and 4099, with 64 rounds per seed. The best counted setting in this run was 64 strikes. It matched rescan against R.O.U.S. and the scatter paper and did better against Digital Rain. It gave back more against The LP Destroyer, which can change its payload between rounds. The fixed sweep still has no measured advantage over the rescan across this field.

| Fresh placement replay | Six-opponent mean |
| --- | ---: |
| Rescan | 0.354 |
| 32 strikes | 0.290 |
| 64 strikes | 0.346 |
| 96 strikes | 0.340 |

To build the 64-strike variant, pass this tree to `node scripts/algebra.js build - --rules lp-hill --verification full`.

```json
{"id":"lp-opposed-scanners","P":{"HANDOFF":3,"HITS":64,"SPREAD":10}}
```

### Widen the clear with the same handoff

`SWEEP` sets the number of DAT destinations per pass. With the original all-backward sweeps, the 160-cell separation inside each pair leaves room for 144 targets before the sweep reaches the other 16-cell body. `OUTWARD=1` keeps the backward scanners clearing backward and sends the forward scanners ahead from just past their own body. The link check follows both directions through wraparound and rejects any strip that crosses a deployed body or the loaded image. At the tested placement geometry, the outward limit is 1,823 cells. The test runs a 1,800-cell forward strip across the seam, watches it reset for another pass, and checks that it leaves the next cell untouched.

The reach replay holds the 64-strike threshold, 49-cell image, deployment and probe lanes fixed. It includes an outward 120-cell version so the direction change can be compared at the same width. The width changes alter dormant counters that an opponent can detect before the clear starts. Both versions still wait for the same number of strikes and overwrite the last trapped cell first.

| Sweep | Six-opponent mean |
| --- | ---: |
| Continue scanning | 0.391 |
| Backward 80 | 0.327 |
| Backward 120 | 0.323 |
| Backward 144 | 0.329 |
| Outward 120 | 0.344 |
| Outward 360 | 0.342 |
| Outward 960 | 0.342 |
| Outward 1,800 | 0.332 |

Each matchup ran for 64 rounds at each of seeds 6151 and 8191. The outward direction improved the 120-cell build in this panel, while wider outward clears failed to improve on it. Continuing to scan scored higher than every sweep on the six-opponent mean.

The holdout used Replinator, Bronze minotaur, Hippogriff, and published Disciples, with 64 rounds per opponent at each of seeds 12203 and 16001. Rescan scored **0.188**, outward 120 scored **0.191**, and outward 960 scored **0.186**. The small 120-cell gain came with lower points against Hippogriff. Across both panels the results give little reason to increase the fixed sweep's width. A separate experiment could hold the width fixed and move its starting point toward the last detected activity, while preserving the protected image checks.

### Aim the sweep at the last trap

`AIM=2` uses the last strike as the sweep origin if all 120 cells fit inside a preverified 1,800-cell corridor. Otherwise it takes the fixed strip. It computes a signed distance from the fixed origin, checks it against the remaining room, and saves the accepted cursor for later passes. `AIM=1` keeps the same code and disables the relocation by changing the two cutoff fields to zero. Both paths take the same number of turns before the first sweep write. Tests exercise the exact fit, the next cell beyond it, and the forward cursor's wrap and reset.

The aim code expands the image to 73 cells and delays the first deployed instruction to turn 145. The probes also move to clear that larger image. All three entries below share the 73-cell boot and probe geometry. Both clear variants switch at 64 strikes and sweep 120 cells.

| Origin study | Six-opponent panel | Four-opponent holdout |
| --- | ---: | ---: |
| Continue scanning | 0.3125 | 0.1523 |
| Fixed origin | 0.3047 | 0.1016 |
| Last-trap origin | 0.3047 | 0.1016 |

The replay used seeds 6151 and 8191 for the six-opponent panel and 23431 and 26003 for the four-opponent holdout, with 64 rounds per seed and opponent. Aiming added one point against scatter paper and lost one against its quiet control in the main panel. In a 16-round sample against scatter paper, the aimed build started a clear in seven rounds and the guard approved a relocation in four. Against the quiet paper, it started a clear once and used the fixed origin. This isolates one reason the relocation has limited effect. The local corridor sometimes excludes the last trap.

Build the aimed variant with `node scripts/algebra.js build - --rules lp-hill --length 100 --verification full` and this tree.

```json
{"id":"lp-opposed-scanners","P":{"AIM":2,"OUTWARD":1,"START":74,"SPREAD":3,"HANDOFF":3,"HITS":64,"SWEEP":120}}
```

### Burst around the trap and return to scanning

`HANDOFF=4` keeps the 49-cell image. After the configured number of JMP strikes, the scanner moves a private cursor to the last trap, drops a finite DAT burst, reloads both counters, and returns to its original probe sequence. The linker checks the whole range of burst destinations from every probe residue. `HANDOFF=5` replaces the burst MOV with NOP, preserving operand evaluation, cursor changes and instruction schedule. A planted four-strike run starts the burst on turn 169. The gate exercises repeated rearming and a complete subsequent probe orbit.

| Five-cell burst | Six-opponent mean |
| --- | ---: |
| Continue scanning | 0.391 |
| DAT after 1 strike | 0.141 |
| DAT after 4 strikes | 0.297 |
| DAT after 16 strikes | 0.342 |
| DAT after 64 strikes | 0.345 |
| NOP after 4 strikes | 0.361 |
| NOP after 16 strikes | 0.355 |

The screen used seeds 6151 and 8191, with 64 rounds per seed and opponent. At a fixed 16-strike trigger on seeds 10301 and 13709, DAT widths 1, 3, 5 and 9 scored 0.345, 0.333, 0.339 and 0.336. Continued scanning scored 0.359, and the one- and nine-cell NOP controls scored 0.359 and 0.358. Spending turns on a burst changes the schedule. DAT writes also changed the result in the matched control, even with width one.

### Check whether killing a locked process helps

`HANDOFF=6` writes DAT directly after its JMP strike. `HANDOFF=7` executes NOP at that same address in the 33-cell template. A planted marker gets JMP on turn 53 and the DAT or NOP follow-up on turn 57. These two builds compare the effect of replacing the lock without the counted burst's longer boot and counter.

| Scan response | Six-opponent mean | Four-opponent holdout |
| --- | ---: | ---: |
| Compact JMP | 0.460 | 0.287 |
| Compact DAT | 0.158 | 0.104 |
| Inline DAT after JMP | 0.174 | 0.098 |
| Inline NOP after JMP | 0.423 | 0.256 |

The six-opponent panel reused seeds 6151 and 8191. The separate four opponents used seeds 23431 and 26003. Both used 64 rounds per seed and opponent.

The trace reproduces seed 6151, round 4 against the quiet scatter-paper control at offset 3440, with the paper moving first. The NOP version first has a process queued at a scanner-written JMP at step 425 on cell 7588. The DAT version kills the process on that cell at step 433. Across the round, the NOP version holds up to five paper processes in JMP locks and observes a full paper queue with at least one lock on 2,500 paper turns. The DAT version peaks at one locked process and observes a full queue with a lock on 14 paper turns. NOP ties at 80,000 cycles. DAT loses at 48,881. This is one matched example of how holding a process can reduce the queue slots available for active copies.

### Strike beside the lock

`BURSTSKIP=1` begins the counted burst on the neighboring cell in the chosen direction. The gate protects the shifted range, and a wrapped test checks that cell zero still holds JMP while the adjacent five cells receive DAT. This separates an attack on nearby instructions from overwriting the trap itself.

| Five-cell response | Six-opponent mean | Four-opponent holdout |
| --- | ---: | ---: |
| Continue scanning | 0.355 | 0.166 |
| DAT after 4 strikes, include trap | 0.255 | 0.135 |
| DAT after 4 strikes, preserve trap | 0.296 | 0.125 |
| NOP after 4 strikes, preserve trap | 0.288 | 0.150 |
| DAT after 16 strikes, include trap | 0.316 | 0.117 |
| DAT after 16 strikes, preserve trap | 0.305 | 0.125 |
| NOP after 16 strikes, preserve trap | 0.306 | 0.133 |

These panels used 64 rounds per seed and opponent, with seeds 19001 and 19841 for the six opponents and 30703 and 37003 for the four. The effects of moving the burst off the lock varied by threshold and field. Continued scanning led both panels.

### Spend the saved turns on more probes

The 29-cell JMP scanner can use a smaller even stride when the full orbit avoids friendly code. Keeping the same first probes, four 80-cell lanes visit 400 distinct cells across the ring, four 50-cell lanes visit 640, and four 40-cell lanes visit 800. The boot and its first probe schedule stay fixed. The `lp-dense-scanners` recipe uses the 40-cell step with first offsets 31 and 35.

| JMP scan geometry | Six-opponent mean | Four-opponent holdout |
| --- | ---: | ---: |
| Previous 80-cell layout | 0.460 | 0.260 |
| Step 80, matched first probes | 0.458 | 0.225 |
| Step 50, matched first probes | 0.562 | 0.355 |
| Step 40, matched first probes | 0.574 | 0.363 |

The main panel used seeds 6151 and 8191 and the separate panel used 30703 and 37003, with 64 rounds per seed and opponent. Both denser geometries improved both panel means. The data support offering the 40-cell geometry as a named recipe while leaving the original reference layout available.

Copying one cell per site before checking the boot counter saves four cells and delays the first deployed instruction from turn 35 to 41. The 25-cell image has room for four safe 32-cell lanes covering 1,000 distinct cells. The 29-cell image rejects this geometry because one or more of those orbits would hit friendly code.

| Loader and stride | Fresh six-opponent mean | Fresh four-opponent holdout |
| --- | ---: | ---: |
| 29 cells, step 40 | 0.562 | 0.387 |
| 25 cells, step 40 | 0.576 | 0.365 |
| 25 cells, step 32 | 0.549 | 0.404 |

These matches used 64 rounds per seed and opponent, with seeds 40127 and 41113 for the six opponents and 43201 and 46021 for the four. The first two rows isolate the loader at the same first probe addresses. The third also changes those addresses. The smaller 40-cell loader improved one panel and fell on the other. The densest 32-cell layout reversed that tradeoff. The 29-cell recipe remains the reference dense build. All three had trouble against published Disciples, which can probe 4,000 cells per parity and later convert to a clear.

## Reproduce

```sh
node scripts/algebra.js recipe lp-opposed-scanners --rules lp-hill --out opposed.red
node cli/zorewars.js check opposed.red --rules lp-hill --json
node examples/hill-study/replay-lp-opposed-scanners.mjs path/to/LP/HILL32
node examples/hill-study/replay-lp-opposed-scanners.mjs path/to/LP/HILL32 --panel
node scripts/algebra.js recipe lp-opposed-handoff --rules lp-hill --out handoff.red
node examples/hill-study/replay-lp-opposed-scanners.mjs path/to/LP/HILL32 --handoff
node examples/hill-study/replay-lp-opposed-scanners.mjs path/to/LP/HILL32 --counted
node examples/hill-study/replay-lp-opposed-scanners.mjs path/to/LP/HILL32 --counted-sample
node examples/hill-study/replay-lp-opposed-scanners.mjs path/to/LP/HILL32 --counted-confirm
node examples/hill-study/replay-lp-opposed-scanners.mjs path/to/LP/HILL32 --reach
node examples/hill-study/replay-lp-opposed-scanners.mjs path/to/LP/HILL32 --reach-holdout
node examples/hill-study/replay-lp-opposed-scanners.mjs path/to/LP/HILL32 --aim
node examples/hill-study/replay-lp-opposed-scanners.mjs path/to/LP/HILL32 --aim-holdout
node examples/hill-study/replay-lp-opposed-scanners.mjs path/to/LP/HILL32 --aim-sample
node examples/hill-study/replay-lp-opposed-scanners.mjs path/to/LP/HILL32 --burst
node examples/hill-study/replay-lp-opposed-scanners.mjs path/to/LP/HILL32 --burst-width
node examples/hill-study/replay-lp-opposed-scanners.mjs path/to/LP/HILL32 --inline
node examples/hill-study/replay-lp-opposed-scanners.mjs path/to/LP/HILL32 --inline-holdout
node examples/hill-study/replay-lp-opposed-scanners.mjs path/to/LP/HILL32 --inline-trace
node examples/hill-study/replay-lp-opposed-scanners.mjs path/to/LP/HILL32 --neighbor
node examples/hill-study/replay-lp-opposed-scanners.mjs path/to/LP/HILL32 --neighbor-holdout
node examples/hill-study/replay-lp-opposed-scanners.mjs path/to/LP/HILL32 --lanes
node examples/hill-study/replay-lp-opposed-scanners.mjs path/to/LP/HILL32 --lanes-holdout
node examples/hill-study/replay-lp-opposed-scanners.mjs path/to/LP/HILL32 --tighter
node examples/hill-study/replay-lp-opposed-scanners.mjs path/to/LP/HILL32 --tighter-holdout
node scripts/algebra.js recipe lp-dense-scanners --rules lp-hill --out dense.red
```

The replay prints zero-based cycles. The tables and prose above use one-based turns.
