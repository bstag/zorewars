# Full-size LP leaders on SAL and Koenigstuhl

SAL LP and Koenigstuhl LP both use 8,000 cells, eight processes, 80,000 cycles, 200 instructions and 200-cell minimum separation. SAL reports a 500-cell P-space. Its live page retrieved on November 7, 2026 showed challenge 567, *dreaded djn stream* by bjoern. After removing the challenge number from the row links, all 25 live rows matched the pinned challenge-566 table. Koenigstuhl's recursive standings are a separately scored, executable archive field. [SAL 566](https://sal.discontinuity.info/hill.php?key=lp&t=566&how=late) · [SAL 567](https://sal.discontinuity.info/hill.php?key=lp&t=567&how=late) · [Koenigstuhl rules and scoring](https://asdflkj.net/COREWAR/koenigstuhl.html)

## SAL LP source coverage

Two of the top ten have a published source with the matching author, name, profile and strategy. SAL supplies no public code image or hash for these entries, so the published versions are suitable for local replays with that provenance. The table describes the remaining eight from their SAL records. [SAL LP standings](https://sal.discontinuity.info/hill.php?key=lp&t=566&how=late)

| Rank | Warrior and SAL ID | Author | Submitted | Strategy and source status |
| ---: | --- | --- | --- | --- |
| 1 | [Scorpion · 453](https://sal.discontinuity.info/warrior.php?key=lp&id=453&t=566) | inversed | 2014-12-21 | The author describes a oneshot with a SPL/JMP-to-DAT clear and an imp fallback. Matching source unlocated. The published '88 [Scorpion](https://asdflkj.net/COREWAR/88/HILL32/scorpion.red) is by S. Fernandes. |
| 2 | [R.O.U.S. · 533](https://sal.discontinuity.info/warrior.php?key=lp&id=533&t=566) | S. Fernandes | 2022-02-05 | Paper. Use the seven-cell [LP source](https://asdflkj.net/COREWAR/LP/HILL32/rous.red). The [Odd source](https://asdflkj.net/COREWAR/ODD/HILL32/R4_rous.red) has different constants, an extra opening and a 20-cell image. |
| 3 | [Simplex · 475](https://sal.discontinuity.info/warrior.php?key=lp&id=475&t=566) | inversed | 2016-02-15 | Described as a modified double version of Anton Marsden's [Simplicity](https://asdflkj.net/COREWAR/LP/HILL32/simplicity.red). Simplex source unlocated. The same SAL author also entered *Simplex* in [MP](https://sal.discontinuity.info/warrior.php?key=mp&id=82&t=153), which has its own entry ID. |
| 4 | [Tractor Beam · 513](https://sal.discontinuity.info/warrior.php?key=lp&id=513&t=566) | inversed | 2018-09-10 | Scanner that directs a separate clear, with a speed trick compared to Zooom. Matching source unlocated. [Published Zooom reference](https://asdflkj.net/COREWAR/94/HILL32/zooom.red) |
| 5 | [D-Knight · 235](https://sal.discontinuity.info/warrior.php?key=lp&id=235&t=566) | Nenad Tomasev | 2005-10-22 | The strategy comment offers a version number and a hint about thinking. Matching source unlocated. |
| 6 | [Overseer · 474](https://sal.discontinuity.info/warrior.php?key=lp&id=474&t=566) | inversed | 2016-02-14 | Clear-directing scanner with a parallel SSD clear. Matching source unlocated. |
| 7 | [Alternating Raisins B nerl · 554](https://sal.discontinuity.info/warrior.php?key=lp&id=554&t=566) | Steve Gunnell | 2025-03-13 | Quickscan before a choice of semi-evolved components, described as resembling a oneshot and LP paper. The author credits Paul Kline's Shapeshifter quickscan. Matching source unlocated. [Published 94nop family variant B lsxd](https://asdflkj.net/COREWAR/94/HILL32/altraisinsB-lsxd.red) |
| 8 | [Fear of the Unknown · 512](https://sal.discontinuity.info/warrior.php?key=lp&id=512&t=566) | John Metcalf | 2018-09-10 | Paper/stone. The [published LP source](https://asdflkj.net/COREWAR/LP/HILL32/fearfixed.red) matches this profile and strategy. SAL's same-name [Tiny LP entry](https://sal.discontinuity.info/warrior.php?key=tinylp&id=153&t=195) is a separate submission with a quickscan and an unlocated Tiny LP source. |
| 9 | [Z-mix 2 a1 · 414](https://sal.discontinuity.info/warrior.php?key=lp&id=414&t=566) | G. Labarga | 2009-04-25 | The author marks it as a test. Matching source unlocated. |
| 10 | [WASSP · 560](https://sal.discontinuity.info/warrior.php?key=lp&id=560&t=566) | G. Labarga | 2025-05-22 | P-warrior. Matching source unlocated. |

The search covered the ten Koenigstuhl listings, inversed's LP rankings and published *CoreOps* issues, and Labarga's warrior index. Source-backed relatives and homonyms are listed separately from SAL entries. Among all 25 SAL live rows, eight have name-and-author archive candidates. Five are also in the Koenigstuhl LP top ten, including *Bronze minotaur*, *Replinator*, and *Distortion Energy* outside the SAL top ten. [Prior catalog join](hill-block-review.md#sal-leaders-with-separately-published-sources) · [inversed's Core War index](http://inversed.ru/CoreWar.htm) · [inversed's LP ranking](http://inversed.ru/CoreWar_LP_IW.htm) · [Labarga's sources](http://labarga.atspace.com/warriors.html)

## Koenigstuhl LP executable top ten

All ten linked files assembled with strict assertions, 200 cells of maximum length and P-space enabled. Seven failed the ordinary ZoreWars `--rules lp` entry profile because of its 100-cell limit or P-space restriction. That entry profile is for tournament submissions. The native fields require the 200-cell rules, including for warriors with a short active body and a large decoy or remote payload. [Recursive standings](https://asdflkj.net/COREWAR/LP/hill32_rec.html) · [ZoreWars rule profiles](../src/engine/constants.js)

| Rank | Published source | Author | Score | Cells | Code map |
| ---: | --- | --- | ---: | ---: | --- |
| 1 | [R.O.U.S.](https://asdflkj.net/COREWAR/LP/HILL32/rous.red) | S. Fernandes | 190.873 | 7 | One loop copies backward, performs a two-field indirect scatter, then doubles the scatter instruction's fields. The exhausted copy pointer also launches the child body. |
| 2 | [Replinator](https://asdflkj.net/COREWAR/LP/HILL32/l111.red) | Christian Schmidt | 178.452 | 200 | Multiply-decoded quickscan and timed attack precede a compact looping bombing paper. Its counted copy loop shares the same destination/launch pointer pattern as Digital Rain. |
| 3 | [Bronze minotaur](https://asdflkj.net/COREWAR/LP/HILL32/bronzeminotaur.red) | G. Labarga | 178.409 | 200 | The boot sends one worker to each of two seven-cell bombing papers. They share the scatter update but vary extra copied cells and successor jumps. |
| 4 | [Digital Rain](https://asdflkj.net/COREWAR/LP/HILL32/digitalrain.red) | inversed | 170.332 | 7 | Counted backward copy and double-field bombing in a single loop. Both mutable attack offsets double before the next iteration. |
| 5 | [Fear of the Unknown](https://asdflkj.net/COREWAR/LP/HILL32/fearfixed.red) | John Metcalf | 170.123 | 200 | Initial split separates the paper path. Copy workers boot a four-instruction stone. The paper carries a 20-cell count through a five-cell copy loop. |
| 6 | [The LP Destroyer](https://asdflkj.net/COREWAR/LP/HILL32/lpdestroyer.red) | Christian Schmidt | 168.546 | 200 | A result-indexed P-space table picks the counted bombing paper or a timed two-write stone that becomes a DAT clear. |
| 7 | [Hippogriff](https://asdflkj.net/COREWAR/LP/HILL32/hippogriff.red) | John Metcalf | 165.487 | 7 | A 28-cell counted paper copy shares the loop with a scatter instruction. The loop adds fields from the eventual SPL into that scatter instruction. |
| 8 | [Distortion Energy](https://asdflkj.net/COREWAR/LP/HILL32/dse_6.red) | inversed | 162.419 | 200 | A boot divides workers between a paper and a four-cell self-modifying stone. The source describes stone mutations leading to a clear if the paper leaves it intact. |
| 9 | [The LP Destroyer II](https://asdflkj.net/COREWAR/LP/HILL32/lpdestroyer2.red) | Christian Schmidt | 162.405 | 83 | The same outcome table chooses the same paper or a relocatable Dwarf with a timed clear handoff. |
| 10 | [Disciples of the Void](https://asdflkj.net/COREWAR/LP/HILL32/4xlb_6.red) | inversed | 162.132 | 200 | Two copy paths deploy four low-visibility scanners. Opposite scan directions and two probe parities reduce mutual detection during scanning. |

### Offset arithmetic and launch timing belong to the contract

In *Digital Rain* and both *Bronze minotaur* loops, the ADD uses A-field predecrement on its own cell to read the previous scatter instruction, then A-field postincrement to use that same scatter instruction as the destination. The ADD's A field returns to zero, while the previous instruction's A and B fields double. *R.O.U.S.* uses the corresponding B-field predecrement/postincrement form. The scatter move can also change remote pointer cells during address resolution, before copying the payload. A gate should record the resolved source, destination, both pointer side effects and the resulting fields. The eventual copy count and child entry remain separate obligations. [Digital Rain](https://asdflkj.net/COREWAR/LP/HILL32/digitalrain.red) · [Bronze minotaur](https://asdflkj.net/COREWAR/LP/HILL32/bronzeminotaur.red) · [R.O.U.S.](https://asdflkj.net/COREWAR/LP/HILL32/rous.red) · [Earlier scatter-write control](hill-block-review.md#lp-shows-how-much-work-one-copying-process-can-do)

*Disciples of the Void* gets effective scan steps of −78 and +78 even though the immediate A operands on its ADD and SUB are zero. The B-modified arithmetic reads the current instruction's B field. The ADD adds −77 and the following predecrement contributes −1. The SUB subtracts −79 and the same predecrement contributes −1. Within each pair, the deployed scanners sit 156 cells apart and run opposite ways. An odd 3,961-cell shift separates the two pairs, so the ±78 scan walks remain on different parities across the pairs. The probes test only A fields, which lets the source make most deployed instructions transparent. A reproduction can check the four exact launch addresses, both signed net scan steps, and which A fields can actually trigger a friendly scan before an endgame transition. [Disciples of the Void](https://asdflkj.net/COREWAR/LP/HILL32/4xlb_6.red)

### The same controller can compare distinct secondary attacks

Both *LP Destroyer* versions dispatch in six solo turns under the native LP rules. They use P-space slot 459 as the state location at load zero, derive a row from the previous result and a state modulo 3, then store the chosen row's next state. I seeded the previous result and each of the three states and stepped the two original controllers through all 12 combinations. The routes and next states agreed. The secondary route enters the first version's stone at address 172 and the second version's Dwarf at address 69. [The LP Destroyer](https://asdflkj.net/COREWAR/LP/HILL32/lpdestroyer.red) · [The LP Destroyer II](https://asdflkj.net/COREWAR/LP/HILL32/lpdestroyer2.red) · [P-space execution](../src/engine/vm.js)

| Previous result | State 0 | State 1 | State 2 |
| --- | --- | --- | --- |
| First round or tie | Paper, next 0 | Paper, next 1 | Paper, next 0 |
| Win | Paper, next 1 | Paper, next 1 | Secondary, next 2 |
| Loss | Secondary, next 2 | Paper, next 0 | Paper, next 1 |

State 0 and state 1 can both run paper, but a loss triggers the alternate attack from state 0 only. That distinction belongs in the controller's verification even when the two branches share a payload. It also gives a clean comparison plan. Keep the controller and paper fixed while changing the secondary attack, and replay the same opponent, starting placements, and round order so P-space evolves under a controlled schedule. [Switch-table block](hill-block-followup.md) · [The LP Destroyer II source](https://asdflkj.net/COREWAR/LP/HILL32/lpdestroyer2.red)

To assemble or battle the original LP files locally, use the numeric settings so the engine uses the native length budget and keeps P-space.

```sh
node cli/zorewars.js check lpdestroyer.red -s 8000 -c 80000 -p 8 -l 200 -d 200 -S 500 --json
node cli/zorewars.js battle lpdestroyer.red lpdestroyer2.red -s 8000 -c 80000 -p 8 -l 200 -d 200 -S 500 -r 250 --seed 124 --json
```

The published originals ran successfully with those settings. In the 250-round smoke test the first LP Destroyer went 111 wins, 130 losses and nine ties. The two published programs differ in image layout as well as secondary attack, so this match is a runnable baseline for a later isolated payload comparison.
