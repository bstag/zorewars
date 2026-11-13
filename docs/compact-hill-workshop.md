# Build and test a compact hill warrior

Nano fits five instructions in an 80-cell ring. Tiny gives you 20 instructions and an 800-cell ring. Both reward sharing instruction fields between roles. The exercises below change one decision at a time and check each version at every legal starting offset, with each warrior moving first once. [SAL Nano rules](https://sal.discontinuity.info/hill.php?key=nano) · [SAL Tiny rules](https://sal.discontinuity.info/hill.php?key=tiny) · [Published Nano strategies](https://corewar.co.uk/nano.htm)

## Nano scan and attack in five cells

Read three published designs with the same budget. *Type-1* advances a pointer by subtracting five, tests both fields with `JMZ.F`, and uses the pointer to wipe forward from a hit. *Toy Soldier* spends one comparison on two cells. A difference lets the next instruction redirect the same B-field its clear will later use, while equality skips the redirect. *Bombus Sylvestris* uses a scanning instruction's B-field as the clear destination and the bomb's A-field as a changing source. This couples finding a target to the first write without a separate pointer transfer. [Type-1 source](https://asdflkj.net/COREWAR/NANO/HILL32/type1.red) · [Toy Soldier source](https://asdflkj.net/COREWAR/NANO/HILL32/toysoldier.red) · [Bombus Sylvestris source](https://asdflkj.net/COREWAR/NANO/HILL32/bombussylvestris.red)

[Nano Lane](../examples/hill-study/nano-lane.red) isolates one of those ideas in an original five-cell layout. The scanner owns its pointer, and the attack reads that exact pointer.

| Cell | What it does |
| ---: | --- |
| 0 | Adds five to the scanner's B-field. |
| 1 | Starts by reading offset 44 from the image base. If both fields at the probe are zero, it jumps back to advance. |
| 2 | On a nonzero field, copies the bomb to the probed cell via `@look`. |
| 3 | Goes back to advance, keeping the same probe lane. |
| 4 | Stores a zero-field DAT. This is the only friendly cell on the probe lane, so an undamaged image needs no explicit self-guard. |

The offset sequence is 44, 49, …, 79, 4, 9, …, 39. It covers 16 of 80 cells because `gcd(80, 5) = 5`. Every contiguous five-cell opponent image initially overlaps one probe on this lane. Shorter images can fit between probes, and even a five-cell image can put zero fields on its only probed cell. A zero-field instruction can still execute, and a successful bomb can land on an expendable cell. This is a repeated single-target attack, while *Type-1* and *Bombus Sylvestris* spend their post-hit work reaching nearby cells. [Runnable Nano Lane source](../examples/hill-study/nano-lane.red)

The replay verifies the 16-cell probe set, no bomb drops and 800 cycles alive at both load positions 0 and 78. At each load position it also plants a jump with only its A-field nonzero at the first probe. `JMZ.F` falls through and bombs it on the second turn. Changing it to `JMZ.B` makes it skip the hit. This controlled difference did not produce a uniform competitive gain.

| Opponent | Both fields W/L/T | B-field only W/L/T |
| --- | ---: | ---: |
| Type-1 | 34/107/1 | 37/104/1 |
| Toy Soldier | 14/103/25 | 14/103/25 |
| Bombus Sylvestris | 39/99/4 | 37/102/3 |
| Reptiloid Conspiracy | 1/119/22 | 0/121/21 |
| Forbes | 4/134/4 | 6/133/3 |
| Nano'Powa | 1/122/19 | 1/121/20 |

Our existing `scanner` leaf already has full-field detection and a DAT attack. Its general layout allocates a separate pointer and protects the whole image and sibling windows with explicit guards. Nano Lane trades those guarantees for a fixed image shape and a sparse lane. A Nano leaf would need to declare that shape, record the pointer field as mutable, and verify its reachable offsets and first hostile write. The existing scanner gate requires 1,000 looks in an empty core, beyond an entire 800-cycle Nano round. A compact gate can instead prove lane coverage and test hits at specific offsets. A useful next block to test is the fused scan-to-clear handoff that drops Nano Lane's requirement to return to the same lane after a hit. [Scanner leaf and gate](../tools/algebra/blocks/scanners.js)

## Tiny opening and paper boot

*Little Fluffy Clouds* spends nine cells on opening `MOV`s, three on a process fan, two on the boot, and six on paper. Each opening move predecrements a remote A-field, then copies the resolved instruction to a fixed destination. In quiet core that usually means copying an empty cell. In a fight it can also copy opponent code or erase a live cell. The paper runs two silk stages and includes an extra bombing write before looping. [Little Fluffy Clouds source](https://asdflkj.net/COREWAR/TINY/HILL32/little_fluffy_clouds.red)

The boot makes two instruction fields do the work of two pointers. The paper's first `SPL` begins with A = 6. The copy instruction decrements that field and copies the paper backward, so its sixth copy writes the first paper instruction with A already zero. The boot's `DJN` uses its own A-field as the destination pointer. Six workers decrement that field through six writes and then jump through the same instruction, now pointed at offset 760. The replay checks the six deployed cells before the first worker executes there, after 26 solo turns in both variants.

The opening experiment replaces the nine `MOV`s with `NOP.F` while keeping their operands, predecrements, positions and nominal timing. This suppresses the destination copies and changes the nine visible opcodes. The same harness checks that the default 14-cell `boot-paper` leaf passes the full gate under Tiny's settings and runs it against the same field. Its serial copy followed by a split fan and a different paper make it a comparison of whole catalog builds. [Catalog paper leaves](../tools/algebra/blocks/papers.js) · [Tiny replay](../examples/hill-study/replay-tiny.mjs)

| Opponent | Original W/L/T | Nine copies disabled W/L/T | Default `boot-paper` W/L/T |
| --- | ---: | ---: | ---: |
| Imp .X-ing | 519/311/692 | 478/314/730 | 580/654/288 |
| after the storm | 896/335/291 | 826/377/319 | 268/1102/152 |
| One Shot 'T' | 740/217/565 | 625/261/636 | 367/698/457 |
| Four Winds | 653/325/544 | 577/372/573 | 505/872/145 |
| Freezer4 | 935/264/323 | 869/315/338 | 340/979/203 |

The opening increased 3/1/0 score against all five selected opponents. The greatest gain was against *One Shot 'T'*, where it added 115 wins and reduced ties by 71. Across these cases the default catalog paper gave up ties that the archived warrior preserved, especially against *Imp .X-ing*. The catalog comparison mixes differences in opening, boot, paper and constants, so it does not assign the score gap to the opening.

A compact fixed-address copy burst is a concrete block candidate. Existing `probe-burst` places a bomb pattern around an upstream hit. The Tiny opening spends one instruction per fixed source/destination pair and needs no probe. A first implementation can check all copy and predecrement targets against the final linked image, verify that planted instructions reach the declared destinations, and assert a fall-through after exactly one turn per pair. Test it with a paper that already fits Tiny's 20 cells and keep matched no-copy controls. [Probe burst](../tools/algebra/blocks/hillopen.js) · [Published Tiny field](https://asdflkj.net/COREWAR/TINY/hill32_rec.html)

## Reproduce the experiments

Download the archives and extract them into separate directories because both contain a `HILL32` directory. The examples assume the extracted directories are named `nano` and `tiny`. Run the commands from the ZoreWars repo root. [Nano tarball](https://asdflkj.net/COREWAR/NANO/nano.tar.gz) · [Tiny tarball](https://asdflkj.net/COREWAR/TINY/tiny.tar.gz)

```text
node cli/zorewars.js check examples/hill-study/nano-lane.red -s 80 -c 800 -p 80 -l 5 -d 5 -S 5 --json
node examples/hill-study/replay-nano.mjs nano/HILL32/type1.red nano/HILL32/toysoldier.red nano/HILL32/bombussylvestris.red nano/HILL32/reptiloid_Conspiracy.red nano/HILL32/forbes.red nano/HILL32/nanopowa.red
node examples/hill-study/replay-tiny.mjs tiny/HILL32/little_fluffy_clouds.red tiny/HILL32/impx.red tiny/HILL32/afterstorm.red tiny/HILL32/oneshott.red tiny/HILL32/fourwinds.red tiny/HILL32/freezer4.red
```

With no opponents, the Nano script only runs its local behavior checks. The replays run 142 rounds per Nano pairing and 1,522 per Tiny pairing. They reset P-space each round and require programs without `LDP` or `STP`. These are selected opponents and deterministic local outcomes. Historical SAL scores use a separate match schedule and field. [Archive rules and schedules](https://asdflkj.net/COREWAR/koenigstuhl.html)
