# Tournament Weekend 2026 ’88 warrior review

Plasmograph won with a compact relocated Blur scanner. Shadow Gauge and
Coil 31 took second and third with mechanisms we built for the tournament.
The clearest additional mechanism to study is Plasmograph's strict-’88
scan-and-carpet loop. Our closest Blur blocks currently target ’94.
[Official results](https://corewar.co.uk/tournamentweekend2026.htm),
[download manifest](../imported/tournament-weekend-2026/manifest.json)

This review reads all ten published sources and compares them with local
blocks and recorded experiments. Published tournament ranks establish the
finishing order. The missing tournament matchup matrix prevents measuring
which nearest neighbor affected an entry or attributing a placement to a
particular instruction. The mechanism descriptions below follow the source.

Chronology matters here. The tournament's ’88 round was November 15.
The current rank-101–200 niche review and several blocks were added on
November 16–17 for the next tournament. They establish what we have explored
now. Shadow Gauge and Coil 31 are direct evidence of what we submitted in
2026. A currently available block or a post-tournament trial alone does not
establish a pre-submission experiment.
[event dates](https://corewar.co.uk/tournamentweekend2026.htm),
[dated niche-review measurements](tw2027-88-niches.md),
[follow-up block work](tw2027-88-block-gaps.md)

## All ten entries

| Place | Warrior | How the published code operates | What we have explored |
| ---: | --- | --- | --- |
| 1 | [Plasmograph](https://corewar.co.uk/cwtw2026/88/plasmograph.red) | Boots a ten-cell paired-CMP scanner away from its launch image. The live loop drops SPL bombs while stepping the scan by 1656. Unequal pairs update the carpet pointer. Its terminal phase uses a SPL-fed DAT clear and DJN decrement stream. | Blur behavior is represented by `blur-carpet` and `blur-scanner` in ’94. Strict-’88 B-field and pair-wipe scanners have been studied and implemented. I found no documented trial of this exact strict-’88 Blur loop. |
| 2 | [Shadow Gauge](https://corewar.co.uk/cwtw2026/88/shadow_gauge.red) | Copies its twelve-cell scanner/clear package 6180 cells away, then jumps into it. ADD/JMZ scans B-fields at stride 1429. A hit receives JMP -1 and an SPL immediately below it. A timed self-hit turns the scanner into an SPL-fed DAT clear with a DJN stream. The abandoned image includes a large SPL decoy. | This is our entry and a direct instance of the existing `bscan-clear-88` family with boot and decoy. It was retained as a reference in the later top-100 studies. |
| 3 | [Coil 31](https://corewar.co.uk/cwtw2026/88/coil_31.red) | Seeds a separate one-step imp 256 cells away. Five doubling SPLs feed a shared ADD/JMP vector launcher, which sends the imp processes around a 31-point spiral at stride 3871. | This is our entry. `vector-spiral` supports N=31, K=5 and TAIL=256. Earlier Coil augmentation and damage studies tested related launchers and reserves. |
| 4 | [Scarlet Knight](https://corewar.co.uk/cwtw2026/88/scarlet_knight.red) | Deploys a stone/vampire, a remote slave pit, a fang template and a three-point imp launcher. The stone moves cells on a step-17 pattern while a second write lays JMP fangs aimed at the pit. Captured processes multiply and write remotely. The attack also contains a transition into a core clear. | Booted stone/imp, vampires with slave pits, and attack-to-clear transitions already exist in our library and hill reviews. I found no measured local trial of this exact step-17 stone/vampire/imp deployment. |
| 5 | [Dragonfly 2026](https://corewar.co.uk/cwtw2026/88/dragonfly_2026.red) | A compact one-shot compares cells 13 apart while moving by -321. On a mismatch it redirects into a backward clear with three MOVs per loop. The clear's source is selected through the shared `x` cell, allowing SPL bombing followed by DAT bombing when the clear overwrites that selector. | We studied one-shots and pointer-overwrite clear transitions in Whirl and Mountain Viper. This exact compact scan/clear arrangement is a useful faithful-port candidate. |
| 6 | [The Creature Tries In Vain](https://corewar.co.uk/cwtw2026/88/creature_tries_in_vain.red) | Ten evolved instructions. Its SPL 0 feeds a three-MOV/DJN loop. Initially that loop copies a DJN into remote core, also copies empty cells, and scatters an SPL instruction through another predecrement pointer. Other paths start in empty core or are dependent on mutation. | We have instruction evolution and the short self-modifying `gymnosperm-88` and swarm families. These are related search mechanisms. No exact reproduction or controlled comparison of this evolved body was found. |
| 7 | [Efoil](https://corewar.co.uk/cwtw2026/88/efoil.red) | B-field scanner with stride 56 that drops SPL 0 at each find, plus nonzero DAT chaff. The normal four-instruction scan/bomb loop jumps back to itself. The separately written DAT clear has no direct handoff from that intact loop. | B-scanners, SPL stun bombs and decoys are represented. Its exact chaff and damage-dependent access to the clear were not established as a tested local strategy. |
| 8 | [Evolved Cairn](https://corewar.co.uk/cwtw2026/88/evolved_cairn.red) | Fifty evolved instructions with multiple SPL, MOV and DJN structures. In the initial path, SPL 0 continually supplies processes and a predecrement MOV copies a remote instruction. The next DJN performs another predecrement and redirects descendants. Much of the remaining text needs mutation or external entry before execution. | Our instruction evolver supports this kind of discovered code. The exact live subset and damage responses need tracing before assigning it a single conventional family. |
| 9 | [Iron Gate OG](https://corewar.co.uk/cwtw2026/88/iron_gate_og.red) | Paired-CMP scanner with distance 49 and step 98. SLT protects the image, hits receive a JMP/SPL pair, and pointer updates continue the search. It eventually becomes a short SPL-fed clear/gate with a decrementing operand. | Pair-wipe scanners are represented. The later Iron Sword and Iron Trap studies investigated closely related scan, stun and clear interactions, including exact-match implementations and fresh-seed measurements. |
| 10 | [Night Crawler OG](https://corewar.co.uk/cwtw2026/88/night_crawler_og.red) | Boots a four-cell stone 1600 cells away, leaving DAT decoys, then launches seven processes on a three-point imp spiral. The stone moves a cell, uses SUB to change its own bombing instruction and runs a DJN stream. | Stone/imp, binary imp launches and booted stone/pump bodies were studied and benchmarked. Its exact four-cell stone plus fixed binary launch is represented at the family level, with no exact measured reproduction established here. |

Local implementations and prior reviews supporting the comparisons are
[scan88b.js](../tools/algebra/blocks/scan88b.js),
[pairscan.js](../tools/algebra/blocks/pairscan.js),
[imps.js](../tools/algebra/blocks/imps.js),
[imps88.js](../tools/algebra/blocks/imps88.js),
[hillqv.js](../tools/algebra/blocks/hillqv.js),
[tangle-trap88.js](../tools/algebra/blocks/tangle-trap88.js),
the [’88 top-30 source review](hill-top30/88.md), and the
[block catalog](block-algebra-catalog.md).

## What made the leading designs worth studying

**Plasmograph combines finding and stunning in the same loop.** A fixed-length
wipe scanner usually suspends searching while completing its attack. Here
the live loop keeps dropping SPLs while moving the scan, and a newly detected
unequal pair updates where subsequent carpet writes go. That couples attack
placement to current search results. The ten-cell remote body also gives the
boot a small payload. Its DAT bomb has predecrement side effects against imp
traffic, and the DJN clear adds another stream of field corruption. These are
concrete differences to compare with Shadow Gauge's ADD/JMZ scan and two-write
stun response. The source establishes that difference. Whether it explains
the tournament rank requires matchup controls.
[Plasmograph source](../imported/tournament-weekend-2026/88/plasmograph.red),
[Shadow Gauge source](../imported/tournament-weekend-2026/88/shadow_gauge.red)

**Coil 31 supplies a very different survival mechanism from either scanner.**
The stride works because 31 × 3871 equals 120001, which is one modulo 8000.
Successive arms can therefore copy the MOV instruction into the position the
next arm will execute. The early one-step tail starts while the main vector
launch is still being prepared, providing a separate surviving path. The
published code is thirteen instructions. Its source and our block show the
mechanism directly. Our recorded top-100 panels also support keeping it as a
reference partner, with solo push-off places 10, 9, 14, 5, 7 and 7 across six
fresh panels. Those panels use a different field from the 2026 tournament.
[Coil 31 source](../imported/tournament-weekend-2026/88/coil_31.red),
[vector launcher block](../tools/algebra/blocks/imps.js),
[local niche study](tw2027-88-niches.md)

**Scarlet Knight coordinates three distinct jobs within 50 cells.** The stone
corrupts core, the vampire converts an executing enemy process into a worker
inside its pit, and the imp provides a surviving MOV spiral. The boot writes
the remote fang and imp seed before distributing execution. The fang's JMP
offset and its landing pointer change in opposite directions so later fangs
keep routing prisoners to the pit. This makes deployment geometry and process
allocation useful refinement targets. The existing blocks cover the roles,
but a faithful port needs the actual geometry and transition tests.
[Scarlet Knight source](../imported/tournament-weekend-2026/88/scarlet_knight.red),
[earlier vampire/imp analysis](hill-top30/88.md),
[existing ’88 booted stone/pump](../tools/algebra/blocks/imps88.js)

## What we actually tested, and what remains open

The post-tournament ’88 work went beyond a catalog. Shadow Gauge and Coil 31
were controls in saved top-100 panels. The November 16–17 rank-101–200 review tested
Gymnosperm, Iron Sword, Iron Trap, repeating imp bursts, and related candidates.
The repeated-burst study improved an eleven-point build on fresh top-100
panels. It also tested a second displacement that improved ordinary points on
the wider hill but had mixed fresh tournament-placement results. That is
direct evidence of current work on divergent mechanisms and pairing-sensitive
tuning. The checked records do not establish a test of Plasmograph itself
before this review or before tournament submission.
[niche review](tw2027-88-niches.md), [block trials and burst tuning](tw2027-88-block-gaps.md),
[Gymnosperm/Iron Sword experiments](tw2027-88-algebra.md)

The most useful follow-up is a faithful strict-’88 Plasmograph body beside
Shadow Gauge as a control, followed by Dragonfly's compact source-selector
clear and Scarlet Knight's coordinated boot. Keep the original source and
try one change at a time. Compare all versions on the same tournament and
top-100 matrices, then check fresh seeds with Coil 31 included. A different
sequence of opcodes supplies a candidate mechanism. Its matchup vector
establishes whether that mechanism earns useful diversity against the field.

This source review ran no new battles. Exact tournament nearest-neighbor
distances, evolved-code live-path counts and mutation-dependent handoffs
remain unmeasured.
