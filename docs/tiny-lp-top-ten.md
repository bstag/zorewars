# What the Tiny LP leaders teach us

This study uses [SAL Tiny LP challenge 195](https://sal.discontinuity.info/hill.php?key=tinylp&t=195&how=late), an 800-cell ring with 50 loaded instructions, eight process slots and 8,000 turns per warrior in a two-player round. The live standings still matched this snapshot on November 7, 2026. Five of the top ten have public Redcode that assembles identically across the RF22 and Koenigstuhl archives. See the [source audit](tiny-lp-top-ten-sources.md) for the other five and the evidence behind each identification.

## First attack and process growth

The table counts one-based solo turns. The first attack follows the source's attack path, which can hit a friendly cell when the core is empty. The first remote instruction may instead belong to a boot or a paper. The [timing script](../examples/hill-study/time-tiny-lp-leaders.mjs) repeats quiet and planted runs across two load positions, one wrapped.

| Rank and published warrior | First attack | First remote instruction | First at eight processes | Reusable block |
| --- | --- | ---: | ---: | --- |
| 1 KISS | Turn 15, remote SPL | 13 | 24 | `paired-clear-feeder` |
| 2 Master of the Wins | Turn 12, stone DAT. Planted quickscan starts on turn 11. | 12 | 166 | `marching-stone-boot` |
| 4 FragPaper 800 | Turn 13, home paper DAT | 11 | 137 | `tiny-lp-pointer-paper` with `ATTACK=1` |
| 7 tiny Roskilde | Turn 21, the first of three remote stone writes | 21 | 217 | `tiny-lp-stone-triad` alongside `tiny-lp-pointer-paper` |
| 9 ugly redcode | Turn 5 on a planted quickscan probe, turn 15 on a planted body probe | None | Never | `tiny-lp-trap-scan` |

### 1 KISS

The launcher spends one SPL and four paired backward-copy instructions to duplicate an eight-cell clear. The two workers share a DJN whose counter sends one worker home and one to the copy. Each clear executes the same SPL it copies as a bomb. It starts sweeping while its queue grows, and the DJN's reverse decrement eventually changes the home bomb selector from SPL to DAT. In a quiet run the forward sweeps also collide, removing the remote clear. The bomb's B-field doubles as a safe sweep restart when the bomb lands on its own cursor. A zero or small reset can send the next writes into the live MOVs. [Published source](https://www.corewar.info/tournament/round22/kiss.red)

The 15-cell `paired-clear-feeder` verifies the intact copy, one worker at each site on dispatch, SPL writes before the cap, a four-plus-four first allocation, and the home DAT handoff. It uses original pointer and bomb values. The remote and home first attacks still occur on turns 15 and 17, with eight processes on turn 24 and four at the end. Its home DAT phase starts on turn 4,622 versus 4,661 for the published warrior. Both write to 64 distinct remote MOV destinations by turn 100, including the boot. The block currently owns its image because the two sweeps can overwrite a nearby partner.

### 2 Master of the Wins

The opening decodes a quickscan hit into a short attack before the same launcher used on a miss. The launcher writes three instructions backward, SPLs to the completed copy, advances the launch address, and repeats. The copy's MOV both bombs and predecrements another remote cell, with cross-field arithmetic moving its two operands in opposite directions. The published quiet run ultimately dies on its own stone. The nine-cell `marching-stone-boot` preserves the recurring copy and launch, checks behavior with a full queue, and verifies that its guarded attack stays clear of the controller. Its small safe attack orbit limits coverage. [Source trace, build and six-opponent replay](hill-master-launcher.md)

### 4 FragPaper 800 and 7 tiny Roskilde

In FragPaper the first stone starts remotely while two paper pairs interleave backward copies and DAT writes. A paper instruction's B-field serves as both destination cursor and next entry address. Tiny Roskilde uses a closely related pointer trick but launches three single-process stones while the paper grows into the five remaining slots. The six-cell paper model reuses the cursor for transfer and the seven-cell variant adds an interleaved attack. The triad and nonattacking paper fit in 19 cells. They land their first three stone attacks on turns 21, 23 and 24, matching the published Roskilde, and fill the queue on turn 221 versus 217. Matching those launch turns still leaves the original bomb and copy geometry to study. [Pointer code, traces and placement results](tiny-lp-source-followup.md)

### 9 ugly redcode

The body shares the B-field of an ADD instruction between a both-fields probe and the trap write. A quiet miss takes two turns per probe. The JMP it drops keeps an enemy process spinning on the overwritten cell, while DAT kills that process on execution. The 10-cell `tiny-lp-trap-scan` isolates this tradeoff with the same stride, guards and layout for both bombs. It guards the whole linked image and attacks a planted body probe on turn 5 from entry. The published body is smaller and pairs its trap with a remote decrement and a quickscan. [Published source](https://www.corewar.info/tournament/round22/ugly.red)

## Replay against published opponents

The first panel covers all 701 legal relative load offsets and both first movers for each of six opponents. The separate panel uses three fixed seeds at 250 rounds each against five different opponents. Scores are points per round. The [panel runner](../examples/hill-study/tiny-lp-panels.mjs) lists every opponent and seed. These are fixed-field local results.

| Warrior or block | Loaded cells | Six opponents | Separate five |
| --- | ---: | ---: | ---: |
| Published KISS | 50 | 1.776 | 2.194 |
| `paired-clear-feeder` | 15 | 1.768 | 2.068 |
| `paired-clear-staged` from the previous study | 18 | 0.936 | 0.752 |
| `tiny-lp-trap-scan` with JMP | 10 | 0.131 | 0.374 |
| Same scanner with DAT | 10 | 0.164 | 0.416 |

The feeder's six-opponent average hides a specific weakness. Against *ugly redcode* it won 437 of 1,402 starts, and its average fell further below published KISS in the separate panel. The trap scanner is a usable mechanism test. In these two panels its DAT control scored higher, while JMP tended to exchange wins and losses for ties. The marching launcher and the stone/paper model use their own fixed opponent sets in their linked studies. [Staged-clear results](hill-block-followup.md)

## Entries with strategy records

| Rank | SAL evidence | Blocks for studying the published strategy |
| --- | --- | --- |
| 3 Unknown | Stone/paper | The 19-cell triad and pointer-paper recipe is a runnable model of a shared process budget. Its exact allocation belongs to the model. |
| 5 The two | Strategy undisclosed. Opponent results match Unknown across all 14 shared opponents at published precision. | Keep the pair together in any training and holdout split. The matchup data do not identify a mechanism to extract. |
| 6 poppy seeds | Quickscan into paper | `tiny-lp-scan-paper` combines a decoding scan, DAT burst and pointer paper. |
| 8 Fear of the Unknown | Quickscan into stone/paper | `tiny-lp-scan-stone-paper` puts the same scan and burst ahead of the 19-cell stone and paper recipe. The same-name 8,000-cell source is a different rules-profile example. |
| 10 I'm “TinyLP” Legend | LP super paper | The pointer paper provides a compact copy and transfer test for studying saturation at eight processes. |

These timings describe our models. Both quickscan recipes use the guarded two-stream burst and overwrite a planted marker at address 329 on turn 14. That attack uses 22 turns that would otherwise go to deployment.

| Model | Cells | Quiet first remote MOV | Quiet first at cap | Planted first at cap |
| --- | ---: | ---: | ---: | ---: |
| Stone and pointer paper | 19 | 5 | 221 | — |
| Scan, burst and pointer paper | 33 | 10 | 111 | 133 |
| Scan, burst, stones and pointer paper | 46 | 13 | 229 | 251 |
| Copy-only pointer paper | 6 | 2 | 103 | — |

The evidence for those rows comes from the [SAL submission audit](tiny-lp-top-ten-sources.md). The [earlier Tiny LP snapshots](sal-hill-evolution.md) show how a change in the opposing field can move two warriors in the standings while their head-to-head numbers hold steady.

## Reproduce the timings

```sh
node examples/hill-study/time-tiny-lp-leaders.mjs path/to/ODD/HILL32
node examples/hill-study/tiny-lp-panels.mjs path/to/ODD/HILL32
node scripts/algebra.js recipe paired-clear-feeder --rules tinylp --out feeder.red
node scripts/algebra.js recipe tiny-lp-stone-paper --rules tinylp --out stone-paper.red
node scripts/algebra.js recipe tiny-lp-trap-scan --rules tinylp --out trap.red
node examples/hill-study/time-tiny-lp-leaders.mjs --warrior trap.red 73
node scripts/algebra.js recipe tiny-lp-scan-stone-paper --rules tinylp --out scan-stone-paper.red
node examples/hill-study/time-tiny-lp-leaders.mjs --warrior scan-stone-paper.red 329
node cli/zorewars.js check feeder.red --rules tinylp --json
```
