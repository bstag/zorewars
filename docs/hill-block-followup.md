# Smaller controllers and coupled attacks

## Pack a P-space policy without changing its choices

David Moore's *Sunset* and Dave Hillis's *Mantrap Arcade* use the previous result to choose a modulus. Taking that residue of a stored value selects the next table row. We can use the same idea with our four-state `switch-table`, which already defines the payload and next state separately. [Sunset source](https://asdflkj.net/COREWAR/PSPACE/HILL32/sunset.red) · [Mantrap Arcade source](https://asdflkj.net/COREWAR/PSPACE/HILL32/mantraparcade.red)

Set `PACKED: 1` on the existing node. The linker shares rows with identical payload and next state. It chooses three coprime moduli and computes an encoded value for each logical state using the Chinese remainder theorem. The emitted controller reads the result, reduces the stored value with the corresponding modulus, and jumps through that row. It writes the encoding of the next logical state. The first round has its own row, which also provides the fallback when a corrupted state points into an unused row. The linker rejects a chosen residue range that cannot fit in the current core.

For the default policy, the four unique rows use moduli 4, 5, and 7. States 0 and 2 share a code because their choices are identical, as do states 1 and 3. The separate verification case uses four distinct encodings, compares both controllers over a persistent sequence at a wrapped load position, and covers the first-round sentinel, wins, losses, ties, and a three-survivor result. The full gate also plants an encoded value selecting an unused row. [Controller](../tools/algebra/switch-table.js) · [Behavior tests](../test/algebra-hill-profile.test.js)

```sh
node scripts/algebra.js recipe table-stones --rules tinylp --out explicit.red
node scripts/algebra.js recipe packed-stones --rules tinylp --length 31 --out packed.red
```

The same two-stone policy drops from 39 cells to 31. At base zero, it reaches its payload in 7, 11, 11, and 11 solo turns after a first round, loss, win, and two-survivor tie, compared with 8, 11, 13, and 13 for the explicit version. A Tiny LP controller selecting between `paired-clear` and `stone` goes from 50 cells to 42, freeing eight cells. Both versions pass the full gate. Save the JSON below as `pair-switch.json`, build it with `--rules tinylp --length 42 --verification full`, then change `PACKED` to 0 and use length 50 for the comparison.

```json
{"id":"switch-table","P":{"PACKED":1},"kids":[{"id":"paired-clear"},{"id":"stone"}]}
```

Both versions ran 100 rounds per opponent at seed 124 under Tiny LP rules. Keep the same opponent order, seed, and round count to reproduce the comparison. `battle` preserves P-space within each match. Packing also moves the bodies and changes the dispatch timing, so the battle tests measure the whole linked design.

| Opponent | Explicit W/L/T | Packed W/L/T |
| --- | ---: | ---: |
| KISS | 23/75/2 | 24/72/4 |
| Master of the Wins | 6/92/2 | 2/97/1 |
| DaubFusion | 4/94/2 | 3/94/3 |
| FragPaper 800 | 5/91/4 | 8/88/4 |
| ugly redcode | 22/73/5 | 24/71/5 |
| tiny Roskilde | 3/85/12 | 4/89/7 |
| swallow | 3/97/0 | 5/95/0 |

The seven-match average was 0.321 versus 0.334 points per round. Matchup results went both ways. In the separate 40-round seed-124 screen at 8,000 cells, the two-stone recipe also split its results across *Sunset*, *Mantrap Arcade*, and *Just experimenting 1.4*. The reliable gain in both examples is instruction budget. [Tiny LP sources and prior controls](hill-block-review.md#sal-leaders-with-separately-published-sources)

## Move a silk return by one cell

In inversed's *Consonance*, the two copy steps satisfy `3X + Y ≡ 1 mod 800`. After one Y hop and three X hops, a descendant lands next to the original X stage. The return can overwrite a particular instruction of the earlier image. Our original nine-cell `tiny-resonant-silk` uses different steps and a backward sweep. Its gate verifies the actual child execution, provenance of the copies, and fresh sweep writes, including a planted instruction read by the sweep. [Consonance source](https://asdflkj.net/COREWAR/TINY/HILL32/consonance.red) · [Block](../tools/algebra/blocks/tiny-resonant-silk.js) · [Behavior tests](../test/algebra-tiny-resonant-silk.test.js)

The default uses `X=117`, `Y=450`, and `RETURN=1`. Changing `RETURN` to 2 changes only one assembled field, taking Y to 451. Both variants return at solo cycle 199 in the nine-cell layout. The first lands at cell 6, overwrites the original X copy instruction, and leaves eight writes from the original sweep. The second lands at cell 7 and overwrites that sweep's writer after six writes. Prepending the four-copy opening moves both events four cycles and four cells later.

```sh
node scripts/algebra.js recipe tiny-resonant-paper --rules tiny --tree-out resonant.json --out resonant.red
node scripts/algebra.js observe resonant.json --rules tiny --cycles 250 --json
```

For the matched control, add `"P":{"RETURN":2}` to the `tiny-resonant-silk` child in the saved tree and build it again. For the nine-cell layout, use only that child as the tree. The table uses all 1,522 Tiny placement and first-mover combinations with a fresh VM each round. Use [the stateless replay helper](../examples/hill-study/stateless-replay.mjs) for the same sweep. [Published Tiny field](https://asdflkj.net/COREWAR/TINY/hill32_rec.html)

| Opponent | Direct +1 W/L/T | Direct +2 W/L/T | With opening +1 W/L/T | With opening +2 W/L/T |
| --- | ---: | ---: | ---: | ---: |
| dfd94f0 | 286/1,085/151 | 330/1,011/181 | 330/1,032/160 | 359/966/197 |
| e21ca502 | 374/985/163 | 372/978/172 | 453/924/145 | 516/842/164 |
| Double Shock | 726/689/107 | 697/725/100 | 695/721/106 | 708/715/99 |
| Consonance | 362/859/301 | 402/781/339 | 414/839/269 | 444/764/314 |

The +2 control scored higher in seven of eight comparisons even though it cuts off the original sweep sooner. Direct +1 did better against *Double Shock*. Tuning the return point is therefore a choice about which part of the parent the descendant replaces and how that changes a specific matchup. The new recipe keeps +1 as its reference so the original relation and its one-cell control are both easy to reproduce.

For Nano, a separate [temporal trace study](hill-block-review.md#a-second-writer-can-stop-an-attack-or-redirect-its-own) shows how a copy that kills an attacker in one placement can erase useful pointer state in another. Its proposed admission checks can guide a future coupled-clear leaf.

## Give both Tiny LP clears a faster attack

Published *KISS* gave us the deployment pattern: two workers copy one remote image and split between home and remote. The original ZoreWars `paired-clear` deliberately kept a simple DAT sweep as a baseline. The opt-in `paired-clear-staged` shares that boot, copies a ten-cell payload, then makes two writes per burst at each site. In the tested configuration each worker puts down 256 SPL bombs, then repeatedly lays 332 DAT bombs. The gate checks the complete backward copy, one queued worker per site, both bounded write sequences, and the restart of the DAT pass. [KISS source](https://asdflkj.net/COREWAR/ODD/HILL32/kiss.red) · [Block](../tools/algebra/blocks/paired-clear.js) · [Behavior tests](../test/algebra-paired-clear.test.js)

```sh
node scripts/algebra.js recipe paired-clear-staged --rules tinylp --out staged.red
```

At `HOP=380`, we compared the same six published opponents used in the earlier study. Each pairing covered 1,402 legal placement and first-mover combinations with fresh state each round. Use [the stateless replay helper](../examples/hill-study/stateless-replay.mjs) with `treeSettings('tinylp')` and builds of each clear at `HOP=380`. We selected parameters on a smaller placement sample from this panel, so the exhaustive result includes the tuning positions. The staged version improved on the original DAT baseline against all six opponents. [Opponent sources and earlier experiment](hill-block-review.md#sal-leaders-with-separately-published-sources)

| Opponent | Original DAT W/L/T | Same-layout DAT W/L/T | Bounded staged W/L/T |
| --- | ---: | ---: | ---: |
| Master of the Wins | 45/1,330/27 | 123/1,223/56 | 145/958/299 |
| DaubFusion | 23/1,343/36 | 290/977/135 | 328/496/578 |
| FragPaper 800 | 103/1,248/51 | 103/1,229/70 | 228/951/223 |
| ugly redcode | 265/1,024/113 | 337/975/90 | 278/1,006/118 |
| tiny Roskilde | 34/1,203/165 | 45/1,141/216 | 260/762/380 |
| swallow | 85/1,240/77 | 1,006/306/90 | 730/304/368 |

For the same-layout DAT control, change only the B operand of `b0repeat JMP.B b0write, b0stun` to `b0bomb` in the emitted staged recipe. This keeps the boot, counters, and both passes. The SPL phase helped four matchups against that control. The DAT phase was preferable from the start against *ugly redcode* and *swallow*.

| Variant | Points per round |
| --- | ---: |
| Paired DAT baseline | 0.254 |
| Same-layout two-write DAT | 0.757 |
| Bounded SPL then DAT | 0.936 |
| Unbounded pointer-reset experiment | 1.073 |
| Published KISS | 1.776 |

The unbounded control lost its remote lane in the solo check. The bounded version earns its place as an opt-in leaf because it retains both lanes and improves the benchmark. It still trails KISS, whose original payload grows to four workers at each site. A useful follow-up would trace when that growth earns back its startup turns under the eight-process cap.

We then froze the settings and ran five additional published opponents. For each opponent and variant we played 250 rounds at each of seeds 124, 521, and 1777, preserving P-space within each match. The staged clear beat the original DAT baseline against all five, averaging 0.752 versus 0.401 points per round. The same-layout DAT control averaged 0.523 and retained a matchup advantage against *MakeUpMind* and *Pan Galactic Gargle Blaster*. [Published Odd sources](https://asdflkj.net/COREWAR/ODD/hill32.html)

| Additional opponent | Original DAT W/L/T | Same-layout DAT W/L/T | Bounded staged W/L/T |
| --- | ---: | ---: | ---: |
| Dilemma | 56/595/99 | 122/570/58 | 95/350/305 |
| MakeUpMind | 62/665/23 | 125/566/59 | 74/601/75 |
| Pan Galactic Gargle Blaster | 157/580/13 | 187/533/30 | 151/547/52 |
| Tiny QScan-LPap | 66/650/34 | 48/651/51 | 210/441/99 |
| Tiny Rottinger | 96/631/23 | 101/634/15 | 166/384/200 |

The packed controller can select between the staged clear and a stone in 45 cells. The explicit layout needs 53. Save this tree and build it with `--rules tinylp --length 45 --verification full`.

```json
{"id":"switch-table","P":{"PACKED":1},"kids":[{"id":"paired-clear-staged","P":{"HOP":380}},{"id":"stone"}]}
```

## Follow a Nano strike back into its read cursor

`nano-relay-clear` is an original five-cell design inspired by the coupled writes in *Reptiloid Conspiracy*. One worker reads through a remote predecrement cursor and puts the resolved instruction in a relay. The strike copies that instruction into one residue class. Its first destination is the cursor itself. The remaining two instructions advance the strike and loop, and a self-SPL supplies workers. The linker excludes the five-cell image and the relay from the strike orbit. The default stride of eight reaches ten distinct cells. [Published leader](https://asdflkj.net/COREWAR/NANO/HILL32/reptiloid_Conspiracy.red) · [Earlier temporal trace study](hill-block-review.md#a-second-writer-can-stop-an-attack-or-redirect-its-own) · [Block](../tools/algebra/blocks/nano-relay-clear.js)

With the block at base zero, the first prime reads cell 36. The planted payload has B=3. When the strike copies it into cursor 37, the next predecrement takes the new B from 3 to 2 and reads cell 39. Suppressing the strike leaves the old cursor on its predecrement path to cell 35. The behavior test checks those addresses at base zero and with an image wrapped around cell 79. The full gate also checks fresh writes and the full strike orbit. [Behavior tests](../test/algebra-nano-relay-clear.test.js)

```sh
node scripts/algebra.js recipe nano-relay-clear --rules nano --tree-out relay.json --out relay.red
node scripts/algebra.js observe relay.json --rules nano --cycles 30 --json
node examples/hill-study/replay-nano-relay.mjs HILL32/forbes.red HILL32/type1.red
```

The replay script compares two controls with the default. **Prime suppressed** replaces the relay's first writer with a NOP and keeps the source predecrement. **Cursor B held** keeps each strike's opcode and other fields, then restores only the previous B field when a strike hits the cursor. That second intervention changes both our next read address and the B field an opponent would see if it used the written cell. Each pairing runs all 142 legal Nano placement and first-mover combinations. [Replay script](../examples/hill-study/replay-nano-relay.mjs) · [Published Nano field](https://asdflkj.net/COREWAR/NANO/hill32_rec.html)

| Opponent | Original W/L/T | Prime suppressed W/L/T | Cursor B held W/L/T |
| --- | ---: | ---: | ---: |
| Reptiloid Conspiracy | 6/112/24 | 2/118/22 | 4/115/23 |
| Forbes | 8/110/24 | 6/119/17 | 14/107/21 |
| Type-1 | 51/85/6 | 44/92/6 | 52/84/6 |
| Toy Soldier | 13/100/29 | 7/102/33 | 12/106/24 |
| Reptiloid Supremacy | 10/102/30 | 7/110/25 | 12/103/27 |
| Iron Throne | 10/103/29 | 4/110/28 | 13/105/24 |
| Glitch//CORE//opt | 9/99/34 | 4/109/29 | 8/105/29 |
| Bombus Sylvestris | 32/106/4 | 26/110/6 | 32/106/4 |
| NanoCracker | 12/100/30 | 6/108/28 | 13/101/28 |

Relay priming improved the score against all nine opponents, averaging 0.519 points per round versus 0.401. Holding the cursor B field moved the average to 0.521, a difference of three points over 1,278 rounds. The direction varied by opponent. The relay earned its cell in this sample. The cursor feedback is mechanically real and matchup-dependent.

A separate parameter screen tested 112 valid configurations including the reference. It used the first four opponents above and both first movers at offsets `5 + (13i mod 71)` for `i=0…23`. The sampled winner used cursor 47, relay 58 and stride 8, and scored 0.688 versus 0.448 for the reference. Exhaustive replay reversed the result on those four opponents, 0.537 versus 0.558. It also lost the five-opponent holdout, 0.387 versus 0.487. The recipe retains the reference parameters.

## Test four workers at each Tiny LP site

`paired-clear-fan` uses the same counted home-and-remote dispatch as the staged clear. Each copy has two startup slots. Replacing zero, one, or two NOPs with SPLs gives 1+1, 2+2, or 4+4 workers. The three builds all use 27 instructions, the same copy displacement of 380, and the same attack instructions and ranges. The shared cursor uses a limit check and idempotent reset in place of the original staged clear's one-worker decrement. Both the 256-cell SPL pass and the 328-cell DAT pass end on an eight-write group boundary so four queued writers cannot cross a phase boundary in pristine execution. The gate verifies the boot, allocation, fresh writes in sequence, and the DAT restart with a wrapped remote site. [Block and gate](../tools/algebra/blocks/paired-clear.js) · [Matched tests](../test/algebra-paired-clear.test.js)

| Workers, home + remote | Allocation reached, home / remote | First attack turn, home / remote | Distinct cells hit by turn 100, home / remote | Original panel points/round | Additional panel points/round |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1+1 | 20 / 19 | 28 / 27 | 19 / 19 | 0.404 | 0.460 |
| 2+2 | 22 / 21 | 33 / 31 | 18 / 20 | 0.379 | 0.429 |
| 4+4 | 26 / 24 | 39 / 35 | 16 / 18 | 0.346 | 0.441 |

The opening measurements use a quiet core at base zero and count executed warrior turns. The original panel uses all 1,402 legal Tiny LP placement and first-mover combinations against six published opponents. The additional panel uses five other opponents, with 250 rounds per seed at 124, 521, and 1777 and persistent P-space within each match. The replay reports each opponent's W/L/T. Use the `HILL32` directory extracted from the published Odd archive. [Published Odd sources](https://asdflkj.net/COREWAR/ODD/hill32.html) · [Replay runner](../examples/hill-study/replay-tiny-lp-fan.mjs)

```sh
echo '{"id":"paired-clear-fan","P":{"HOP":380,"FAN":2}}' | node scripts/algebra.js build - --rules tinylp --verification full --out fan.red
node examples/hill-study/replay-tiny-lp-fan.mjs odd/HILL32
```

The startup fan cost turns before the first write, and neither larger allocation improved the average on either panel. The 1+1 matched control also trailed the separately tested 18-cell staged clear, which hits 29 cells per site by turn 100 and averaged 0.936 and 0.752 on the respective panels. Its simpler loop and smaller boot are part of that comparison. Keep `paired-clear-fan` as a diagnostic block and the staged recipe as the stronger baseline.

KISS's first writes arrive at turns 17 home and 15 remote, before its full eight-process queue at turn 24. It reached 27 and 29 attack targets by turn 100 in the same solo setup. Its split belongs inside the attack loop. The next test is a paired clear that writes before its second split, with a matched early-write control and checks that one site cannot take the other's slots. [KISS source](https://asdflkj.net/COREWAR/ODD/HILL32/kiss.red)

## Attack while the queue grows

`paired-clear-fan` now accepts `LEAD=1`. At each site it drops an SPL bomb before the first split and drops more while the first cohort is growing. The early cursor targets cells 31–33 relative to each payload with the default parameters, just before the regular sweep. The separate sweep cursor starts at 34 and still has full write groups at both phase boundaries. The 30-cell builds differ only in the two split opcodes, with NOPs preserving the layout in the 1+1 control. The gate checks the lead writes, the actual per-site worker allocation, and both regular passes. A wrapped test checks both first strikes at a point where the queue still has only two processes. [Implementation](../tools/algebra/blocks/paired-clear.js) · [Behavior tests](../test/algebra-paired-clear.test.js)

| Attack-first workers, home + remote | Allocation reached, home / remote | First attack turn, home / remote | Distinct cells hit by turn 100, home / remote | Original panel points/round | Additional panel points/round |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1+1 | 22 / 21 | 24 / 23 | 20 / 20 | 0.411 | 0.379 |
| 2+2 | 26 / 25 | 24 / 23 | 19 / 19 | 0.397 | 0.372 |
| 4+4 | 34 / 32 | 24 / 23 | 19 / 19 | 0.361 | 0.384 |

Both panels use the same opponents and schedules as the startup-fan experiment. The 4+4 variant hits four more distinct cells by turn 100 than the startup-only 4+4 build. Its original-panel score rises from 0.346 to 0.361 and its additional-panel score drops from 0.441 to 0.384. That comparison includes three more loaded instructions and a changed early target range. Within the same attack-first layout, 4+4 loses on the original panel and gains only 0.005 points per round on the additional panel compared with 1+1.

```sh
echo '{"id":"paired-clear-fan","P":{"HOP":380,"FAN":2,"LEAD":1}}' | node scripts/algebra.js build - --rules tinylp --verification full --out lead.red
node examples/hill-study/replay-tiny-lp-fan.mjs odd/HILL32 --lead
```

The 18-cell staged clear remains the stronger baseline. It already starts on turns 15–16 and makes 58 distinct hits by turn 100. This experiment brought the first write forward within the fan design, but its larger copy and the extra sweep check still cost attack time. The next mechanism worth isolating is a compact loop that grows during sustained writes, with a phase handoff that does not require a bounds check on every two-write burst.

A longer solo trace of KISS suggests a concrete handoff to study. At base zero its remote copy makes its last write from either original writer on turn 980. The home sweep overwrites the remote loop's `DJN` at address 386 with SPL on turn 982. On turn 4,660 the home `DJN` at address 6 decrements its own B-field from 797 to 796. The next write, on turn 4,661, reads through that changed selector and drops DAT. The phase switch comes from the decrement stream reaching the selector. The remote overwrite happens much earlier, so a reproduction should test the switch separately from letting the two sweeps collide. These are observations from quiet core at one load base. [KISS source](https://asdflkj.net/COREWAR/ODD/HILL32/kiss.red) · [VM write provenance](../src/engine/vm.js)

## Let the decrement stream switch bombs

The `paired-clear-stream` block keeps the existing two-worker boot and a single writer at each site. It makes two SPL writes per burst. The `DJN` steps backwards through core until it decrements the bomb selector from one to zero. That changes the source of both writers from the adjacent SPL template to the selector's own DAT. It also makes `DJN` fall through. The handoff resets the sweep cursor and installs a counted DAT loop. The two regular loops each use two MOVs and a DJN. Both sites keep their own range, so the test isolates the switch from the remote overwrite seen in KISS. [Implementation](../tools/algebra/blocks/paired-clear.js) · [Wrapped-placement and mutation tests](../test/algebra-paired-clear.test.js)

The 24-cell counter and stream versions differ in two assembled instructions. The counter decrements a local count while the stream decrements a different core cell each burst. Both execute the explicit selector write at handoff. The 21-cell version drops that instruction and its copy padding. The tests check that the selector is actually written by the DJN in both stream layouts, and by the explicit write in the counter. In the two full layouts, the first DAT arrives on turns 796 home and 795 remote. In the compact layout it arrives on 792 and 791. All versions keep `HOP=380`, the initial attack offset 34, and the same quiet-core pass widths.

```sh
echo '{"id":"paired-clear-stream","P":{"HOP":380,"FIELD":1,"COMPACT":1}}' | node scripts/algebra.js build - --rules tinylp --verification full --out stream.red
node examples/hill-study/replay-tiny-lp-stream.mjs odd/HILL32 a
node examples/hill-study/replay-tiny-lp-stream.mjs odd/HILL32 b
```

The replay reports selector and first-DAT turns alongside W/L/T for the same six-opponent exhaustive panel and five additional opponents used above. `FIELD=0` decrements A. `FIELD=1` decrements B, as KISS does. Changing fields also changes which enemy pointers the stream can disturb. [Replay runner](../examples/hill-study/replay-tiny-lp-stream.mjs) · [Published Odd archive](https://asdflkj.net/COREWAR/ODD/hill32.html)

| Layout | Cells | Original panel points/round | Additional panel points/round |
| --- | ---: | ---: | ---: |
| Staged baseline | 18 | 0.936 | 0.752 |
| A-field counter | 24 | 0.692 | 0.595 |
| A-field stream | 24 | 0.667 | 0.628 |
| A-field compact stream | 21 | 0.634 | 0.617 |
| B-field counter | 24 | 0.687 | 0.601 |
| B-field stream | 24 | 0.678 | 0.614 |
| B-field compact stream | 21 | 0.668 | 0.671 |

Each full stream gains on the additional panel and gives ground on the original panel relative to its own counter. The compact B-field stream is the stronger compact variant on both panels. The staged baseline still leads every variant on both panels. It also fires two turns sooner at each site and hits 58 cells by turn 100 to the compact build's 56. The stream stays a diagnostic block.

The stream has an early-exit hazard. In a controlled A-field replay, placing `DAT.F #1,#0` at the home stream's first target made the DJN fall through on its first burst. The full version switched early and wrote its first home DAT on turn 34. The compact version entered the counted loop with the selector still at one and produced no home DAT in the first 1,000 turns. The remote site switched as expected in both cases. The injected addresses were 149 for the full build and 146 for the compact build, the first stream target in each linked image. The quiet-core gate establishes the intended handoff. This injection shows how an enemy cell can redirect it.
