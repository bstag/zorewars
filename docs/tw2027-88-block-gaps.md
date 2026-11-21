# Block and recipe gaps in the ICWS ’88 top 200

I compared the published roster with the algebra catalog and inspected the Redcode behind the most distinct candidates. Before these additions, I built all 11 registered ’88 recipes and compared their default instructions and entry addresses with the compiled top 200. Gymnosperm Trickery was the only exact default match. Iron Sword was already a parameterized port with the published build at GAP 34 and our distance-54 default. The exact-match count measures the default recipes. Many more mechanisms are covered by existing blocks and parameter settings. [Published ranks](https://asdflkj.net/COREWAR/88/hill32_rec.html) · [Archived Redcode bundle](../evolved/tw2026-88-hill-peers/live-88.tar.gz) · [Block catalog](block-algebra-catalog.md) · [Recipe registry](../tools/algebra/recipes.js)

## New blocks or extensions

| Priority | Source | What to add | Closest existing implementation |
| ---: | --- | --- | --- |
| 1 | **Imps! Imps! Imps! #162** — `impsimpsimps.red`, `start` and `p` | A persistent feeder that moves the seed by 260 between bursts and uses a shared vector to send each burst's jumpers to positions 1143 apart. Start with the original seven-point, 16-jumper burst. Test the number and spacing of launches as well as how many settle into working imp arms. The original placed 13th, 10th and 26th on the fresh top-100 panel. | `vector-spiral` launches once. `imp-pump-88` launches one at a time. `fan-imp-pump` is strict ’94. |
| 2 | **Iron Trap #124** — `irontrap.red`, the comparison with `imp` and the three instructions after `e` | A CMP scanner with an optional imp response. On an exact match to the three-point imp template, it uses the hit pointer to drop a bounded run of SPLs one spiral step apart before clearing. Make the run length tunable and verify the branch with a planted imp and a different planted MOV. The original reached eighth on one fresh push-off and stayed distinct across six seeds. | `iron-sword-88` and `pair-wipe-scanner-88` cover scanning and clear handoff. `impstep-clear` uses a gate-triggered response in ’94. |
| 3 | **Tangle Trap 3 #27, dlhu #83, and Tangle Trap 2 #151** — `tangletrap3.red`, `vamp_A`–`vamp_E`; `tangletrap2.red`, `fang1`/`fang2` and `trap` | Two pieces worth extracting. First, a two-stage fang and a pit that waits for the opponent's process slots to fill before releasing the trapped processes onto DAT. Then the #27 phase-locked vampire, where seven staggered processes balance updates to a shared check and a nonzero check switches to the reserve clear. Verify a quiet loop and a single planted missed update separately. | `vampire-trap` has a prisoner-powered clear. The relay and leaky pits in `fang-vampire` and `airbag-vampire` are ’94. The linker checksum and recovery drafts cover different checks. |
| 4 | **Shadow Seeker #200 / Speeed 88mph #80 / chaoscan #63** — `shadowseeker.red`, `chk` through `adj`; `speeed88.red` and `chaosscan88.red` | A scanner using the Zooom family’s combined scan/write loop. Start with Shadow Seeker's ten-cell form, where subtraction through a predecrement pointer both touches remote core and supplies the following B-field test. Expose the scan geometry and keep Shadow Gauge as the B-scanner control. | `bscan-clear-88` scans via ADD/JMZ. Pair and blur scanners provide timing controls without this particular scan/update path. |
| 5 | **Hordes of Microwarriors #128** — `smallbombers.red`, ten-cell body | A launcher that lays a remote DJN worker through a moving pointer and dispatches a process to it. Follow the first two workers' writes and executions to pin down how the shared pointer advances. This gives evolution a second small swarm body beside Gymnosperm. | `hydra-88` plants resin bodies. Generic copies and refreshers lay whole payloads through separate launch machinery. |
| 6 | **Leviathan #34** — `leviathan.red`, `b0`–`b7` and `s/n/m/d` | A bounded, staggered launcher of eight four-cell Gymnosperm-derived heads. Reuse the existing quickscan family. Keep the four-cell head and its local pointers together, then expose count, spacing and the shared decrement pattern. | `gymnosperm-88` is the five-cell ancestor. `hydra-88` supplies the resin launcher pattern with a different child and different timing. |
| 7 | **Keystone t21 #172 and t13 #177** — `keystonet21.red`, `stone/cnt/inc`, `hide1`–`hide6`, `m0/mimp` | A coordinated fallback where the stone's own writes turn its anti-vampire helper into a clear, turn its own loop into a gate, or release an imp launcher. Start with one observed handoff and prove the firing write and receiver before adding the other paths. | `trigger` provides generic handoff, and `_stone-reserve` and `_recovering-stone` address damage. The stone-as-patcher interaction needs its own layout contract. |

## Ports and close relatives

| Source | Smallest useful change |
| --- | --- |
| **Spitfire 3 #149**, **rewired #129**, and **Stillborn Bomber v0.2 #118** | Add a configurable three-cell SPL/MOV/JMP attack. Spitfire's `attack` through `compptr` attaches it to a comparison hit and shares clear state. Rewired's `loop` through `djn` gives a timed bomber control. Stillborn's `DD` separates the incendiary halves to seed a longer reverse carpet. The current `incendiary` is a blind adjacent SPL/MOV pair. |
| **R.O.U.S. #196** | Give `lp-scatter-paper` an ’88 path or extract its seven-cell ancestor. `rous88.red` uses a 22-cell inherited backward copy and a dual-predecrement move with self-doubling fields. `INDIRECT 1` and `lp-romulan-rous` already cover the idea on LP in ’94. |
| **Gothik #119** | Add a faithful variant of `scan-replicator-88` with the `sptr` self-hit timing, shared scan/copy cursor and two backward MOVs per copy loop. The existing block is a suitable control. |
| **No Mucking About #188** | Add the compact attack and handoff to the existing scanner family. Its `POS/JB/SB/AIM` path has a JMP on the hit, three SPLs just below it, and a separate clear pointer adjustment. Keep the original gap as the control, since the earlier gap change lost heavily. |
| **Monolith #21, Sting #37, Glyph #73** | Use `pair-wipe-scanner-88` for the baseline family. A small extension would let the clear reuse the attack cursor and distinguish the fixed attack burst from the final sweep. The source anchors are `attack/wipe`, `wptr/wipe`, and `cptr/bptr`, respectively. |
| **PacMan v3 #104** and **Leapfrog #109** | Treat as composed designs. PacMan's `power/pill` stone and `gobble/wait/safety/tjump` use separately booted roles with a timed anti-imp gate. Leapfrog's stone checks the decremented cell and hands the evolving pointer to an anti-vampire/clear/gate package alongside paper. Build and test each handoff before generalizing it. |
| **.T.E.S.T. V0.1 #163** | Combine two copies of the short Clown bomber 3999 cells apart, then supply both remote anti-imp DAT seeds during deployment. The `copies` combinator supplies spacing. Seeded clear bombs make up the remaining deployment work. |
| **ttti #101** | Port the four-cell mirrored MOV-through worker at `twill` and pair it with a seven-point `vector-spiral`. The equivalent stone family includes ’94 `movthrough-feed-stone`. |
| **Matreshka Rulez! #40** | `silk-tail-88` already models the nested copy stages and the empty cells used as counters. The remaining faithful-port work is the shared fan boot and its counters, stage displacement, and short tail timing. A two-boot analog already passes the gate. |

## Recipe seeds available now

These trees passed **full** algebra verification in strict ’88 and now have named recipes. The old seed array follows the table order and can still be passed to `evolve --representation tree --start`. [Local seed array](../evolved/tw2027-88-niches/algebra/top200-seeds.json)

In the table, **Q** is `opening-qscan-table-88` with `PAIRS: 12, BURST: 6`; **tail(n)** is `silk-tail-88` with `TAIL: n`; **boot(h, x)** is `boot` at `HOP: h` around x.

| Inspired by | Tree | Cells |
| --- | --- | ---: |
| **Matreshka Rulez! #40** | `seq(Q, par(boot(3348, tail(0)), boot(7348, tail(0))))` | 71 |
| **Permafrost #12** | `seq(Q, par(boot(3348, tail(1)), boot(7348, tail(2))))` | 77 |
| **Evil Spirit #103** / **Night Terrors #110** | `seq(Q, tail(1))` | 50 |
| **Gothik #119** / **Vendetta #81** | `seq(Q, scan-replicator-88)` | 49 |
| **Torment #20** / **Abomination #95** | `seq(Q, hydra-88)` as the single-payload hydra control | 46 |
| **No Mucking About #188** | `pair-wipe-scanner-88` with `WIPE: 3, BACK: 0, GAP: 2, CLEAR: 1` as a three-SPL control | 28 |
| **Triangular Sun #25** / **Imprimis 6 #144** | `par(triple-stream-stone, imp-pump-88{N: 7})` as the existing anti-imp stone/pump baseline | 14 |

The double tail trees passed when the two papers were booted independently. Placing both directly in one image is refused because each needs its counters immediately after its body. A paper beside the generic hydra is also refused because the hydra declares core-wide writes. A faithful hybrid like Mythos ’88 (#31) needs demonstrated deployment geometry before relaxing that contract. [Paper block](../tools/algebra/blocks/papers88b.js) · [Hydra block](../tools/algebra/blocks/hydra88.js) · [Layout contracts](../tools/algebra/contracts.js)

## Added recipes and first matches

The six reusable blocks are `repeat-burst-imp-88`, `iron-trap-88`, `tangle-trap-88`, `shadow-seeker-88`, `microwarrior-swarm-88`, and `leviathan-launch-88`. The first five defaults reproduce their published assembled instructions and entry address. Leviathan reproduces the 51-cell launch and body behind a table quickscan in the registered 87-cell `leviathan-88` recipe. Tangle Trap's gate checks a working relay during the quiet phase and the reserve clear after removing a fang update. A separate test starts one process in the deployed pit and verifies that the pit reaches the process cap before it lets any process leave. [Swarms](../tools/algebra/blocks/top200-swarms88.js) · [Scanners](../tools/algebra/blocks/top200-scanners88.js) · [Tangle Trap](../tools/algebra/blocks/tangle-trap88.js)

All 13 recipes assembled in ZoreWars and pMARS under strict ’88. Two fresh 50-round runs used the same 100-leader field and each candidate's matches against Coil 31. A paired place below is the better of the two entries.

| Recipe | Points per round | Solo SD place | Better paired place |
| --- | ---: | --- | --- |
| `repeat-burst-imp-88` | 1.143 | 12, 42 | 12, 42 |
| `iron-trap-88` | 1.269 | 5, 43 | 9, 16 |
| `tangle-trap-88` | 1.426 | 87, 18 | 7, 12 |
| `shadow-seeker-88` | 1.094 | 43, 45 | 8, 20 |
| `microwarrior-swarm-88` | 1.263 | 83, 88 | 7, 13 |
| `leviathan-88` | 1.245 | 62, 76 | 8, 13 |
| `matreshka-dual-tail-88` | 0.905 | 43, 42 | 9, 19 |
| `permafrost-dual-tail-88` | 1.024 | 68, 68 | 8, 10 |
| `evil-spirit-imp-tail-88` | 1.076 | 86, 88 | 7, 13 |
| `gothik-quickscan-88` | 0.770 | 47, 48 | 5, 11 |
| `torment-hydra-88` | 1.032 | 50, 86 | 7, 13 |
| `no-mucking-carpet-88` | 0.282 | 90, 88 | 7, 13 |
| `triangular-sun-pump-88` | 0.864 | 48, 46 | 7, 10 |
| Shadow Gauge + Coil 31 | — | — | 8, 9 |

The pairing results varied by seed. For the next evolution batch, start with the seven-point burst, Iron Trap's short and long imp-stun settings, and the default booted Gymnosperm as separate families. Use the two-boot Matreshka recipe as a paper control. Tangle Trap is a higher-points candidate for a separate lane. [Trial seeds and configuration](../evolved/tw2027-88-niches/algebra/top200-added-plan.json) · [First ranking](../evolved/tw2027-88-niches/top200-added-a-ranking.json) · [Second ranking](../evolved/tw2027-88-niches/top200-added-b-ranking.json)

```powershell
node scripts/algebra.js recipe iron-trap-88 --rules 88 --tree-out iron-trap.json
node evolved/tw2027-88-niches/replay.mjs top200-added-a top200-added-b
```

## First evolution run

I ran a three-generation parameter search for each of the repeated imp burst and Iron Trap. Each lane used 18 candidates per generation, eight starting rounds, one race, and 14 leaders chosen from the earlier weak and strong matchups. The first training attempt expanded three length-dependent decoys when the hill loader compiled with a higher budget. The retained runs pinned those sources at 100 and verified all 28 training opponents against the published compiled versions. The full top-100 check used three fresh entry seeds, 50 rounds per matchup, and the same archived leader matrix and Coil 31 build for every variant in a seed. Native and GPU scores agreed on four spot checks. [Search manifest](../evolved/tw2027-88-niches/algebra/top200-evolution/search.json) · [Validation plan and seeds](../evolved/tw2027-88-niches/algebra/top200-evolution/validation-plan.json)

| Build | Full-field points per round | Points vs 86 leaders outside its training set | Solo SD place | Better place with Coil 31 |
| --- | ---: | ---: | --- | --- |
| Seven-point burst, displacement 260 | 1.135 | 1.113 | 21, 46, 27 | 16, 14, 26 |
| **Eleven-point burst, displacement 441** | **1.194** | **1.141** | **8, 36, 25** | **10, 9, 13** |
| Eleven-point burst, displacement 323 | 1.181 | 1.133 | 19, 9, 19 | 8, 11, 26 |
| Iron Trap, gap 98 and stun 100 | 1.270 | 1.245 | 14, 32, 25 | 3, 3, 27 |
| Iron Trap, gap 48 and stun 121 | 1.071 | 1.030 | 13, 22, 17 | 9, 11, 8 |
| Iron Trap, gap 48 and stun 112 | 1.073 | 1.032 | 13, 24, 27 | 14, 14, 20 |
| Shadow Gauge + Coil 31 | — | — | — | 11, 3, 14 |

**Advance the 441 burst.** It improved against Hexamorph, Eidolon, and Glyph on all three seeds, by 1.27, 1.25, and 0.54 points per round on average. It lost 0.43 against Dragonfly ’88. All 150 head-to-head rounds against the original burst tied. Its advantage showed up against the field and in the pairing. [Tree](../evolved/tw2027-88-niches/algebra/top200-evolution/burst-11-441.json) · [Redcode](../evolved/tw2027-88-niches/algebra/top200-evolution/burst-11-441.red)

**Keep the original Iron Trap.** Gap 48 and stun 121 improved solo place on all three seeds as its initial nearest-neighbor SD distance rose from 100–101 to 114–122. It lost 0.199 points per round and gave up both third-place paired finishes. Both gap-48 builds finished 62 wins, 54 losses, and 34 ties head to head against the original. The earlier matchup profile and stronger paired finishes favor retaining gap 98. [Original tree](../evolved/tw2027-88-niches/algebra/top200-evolution/iron-trap-original.json)

```powershell
node evolved/tw2027-88-niches/replay.mjs top200-evolved-a top200-evolved-b top200-evolved-c
```

## Tuning the 441 burst for Coil 31

I screened 20 alternatives to 441 by median better-entry place with Coil 31 under the tournament's iterative SD rule. The grid changed one of the burst displacement, spiral points, or fan size at a time. One other variant failed the full behavior check. The three 50-round tuning panels used fixed top-100 leader matrices. I used mean better-entry place, mean burst place, and then mean points as tie breaks.

The winner was **577**, with the same 11-point spiral and fan size four. Its better-entry places on the tuning seeds were **9, 7, 13**, against **12, 11, 16** for 441. I locked 577 before running the fresh panels. Both builds use 11 instructions and passed strict ’88 assembly in pMARS with the 50-instruction entry limit. [Search grid and seeds](../evolved/tw2027-88-niches/algebra/top200-evolution/paired-study.json) · [Screening results](../evolved/tw2027-88-niches/algebra/top200-evolution/paired-tune-results.json) · [577 tree](../evolved/tw2027-88-niches/algebra/top200-evolution/burst-paired-finalist.json)

| Field and metric | 441 | 577 |
| --- | --- | --- |
| Top 100, points per round | 1.181 | 1.184 |
| Top 100, better SD place with Coil 31 | 8, 10, 17 | 18, 9, 11 |
| Top 100, burst's own SD place in the pair | 8, 10, 17 | 23, 9, 11 |
| Full 683, points per round | 1.886 | 1.896 |
| Full 683, burst's points rank with Coil 31 in the field | 125, 128, 124 | 119, 124, 122 |
| Full 683, burst's own SD place in the pair | 343, 336, 356 | 336, 374, 342 |
| Full 683, better SD place with Coil 31 | 340, 336, 348 | 336, 337, 342 |

**Keep 441 as the tournament baseline.** The 577 build won two of three fresh top-100 comparisons. Its larger loss on the first seed left it with a worse median (11th vs. 10th) and mean place. All 150 direct rounds on those seeds tied. Against the leaders, 577 gained 0.30 points per round against Iron Gate and 0.29 against Agony 3.1, and lost 0.30 against vm5. Its modest full-hill gain moves the median points rank from 125th to 122nd. The full-field SD places for both pairs stay near the middle. [Fresh top-100 results](../evolved/tw2027-88-niches/algebra/top200-evolution/paired-fresh-results.json) · [Full-hill results](../evolved/tw2027-88-niches/algebra/top200-evolution/paired-full-results.json)

I verified the names and scores at all 683 published ranks on November 17, 2026, after normalizing whitespace. The 50-round fresh top-100 panels used independent saved leader matrices. The wider check used the single cached 10-round leader round robin and three fresh 10-round entrant panels, so the wider rank variation reflects entrant positions while the archived leader matches stay fixed. Each round robin adds the burst and Coil 31, giving 102 and 685 entries respectively. The points ranks use those simulated round robins. Koenigstuhl's public ranking uses recursive weighting. The standalone Rust replay for the wide field matched the repository's official-rule ordering exactly on all three fresh 102-entry controls. [Published ranking](https://asdflkj.net/COREWAR/88/hill32_rec.html) · [Koenigstuhl weighting](https://asdflkj.net/COREWAR/koenigstuhl.html) · [Runner and saved matchup panels](../evolved/tw2027-88-niches/algebra/top200-evolution/tune-burst-paired.mjs)
