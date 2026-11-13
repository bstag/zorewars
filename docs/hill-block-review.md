# Reading the warriors behind the hills

This review starts with the published Redcode, then compares each mechanism with the ZoreWars block that comes closest. Ranks refer to the Koenigstuhl tables retrieved November 7, 2026. Koenigstuhl is an archive with an all-against-all score table and, on most hills, a recursively weighted ranking. A high rank in that table is evidence about this archive field. Historical introduction, replacement and eviction require dated sources or a standing-hill history such as SAL's. [Koenigstuhl scoring and hill settings](https://asdflkj.net/COREWAR/koenigstuhl.html) · [SAL research](sal-hill-research.md)

## What changes as the rules change

| Field | Read these originals | Pressure visible in the code |
| --- | --- | --- |
| '88, 8,000 cells | Lithobolia C yvfp and Talisman | Fixed comparison pairs and additive decoding buy an opening despite the restricted instruction set. The budget left for launch and payload changes what can follow the scan. |
| 94nop | Arvon and King Cobra | One opening can fund either broad paper/stone coverage or a scanner that delays committing to a clear until it sees evidence of a body. |
| Limited Process | R.O.U.S., Replinator and The LP Destroyer | Copying and bombing on the same loop uses the active worker every turn. Native LP's 200-cell limit and P-space also permit long outer shells around a small replicator. |
| X | Fatamorgana X and Fire and Ice II | A 55,440-cell core and 200-instruction budget permit wide deployment, parallel attacks, and a persistent selector. Each alternative pays its own boot costs. |
| P-space, 8,000 cells | Sunset and Cooperative Black Dimension 1.0 | A state can pick a body, pick a different boot location for the same body, or participate in a cross-warrior handshake. These need different tests. |
| ICWS, 8,192 cells | Eye of the Storm T | The additive '88 decoder survives a core-size change. Scan constants, boot offsets and imp arithmetic change with the ring. |
| ICWS/64, 8,192 cells | Twimp and NightCrawler 2^13 | Relative launch phase and the order of `SPL` and `JMP` determine which imps are seeded before the queue fills. |
| Odd | Happy New Year and Idiot | The archive mixes tournament origins. Its flat ranking is a way to find mechanisms to study. Record each original event's rules separately before making a tournament claim. |

## '88 and ICWS share an additive decoder

**Talisman** has 18 `CMP` instructions, each testing two cells. A hit branches into one of several entries around `qfast`, `qslow` and `qslower`. The branch's otherwise spare B operand and intermediate `DJN` or predecrement effects select existing offsets. The decoder adds them into the bombing pointer. A comparison then chooses the occupied half of the pair. The following `qloop` lays the timed bomb burst before the warrior starts its stone and imp. `sboot` copies both branches backward. The `djn @sboot,#5` routes five workers into the stone and leaves the other to enter the imp launcher. **Lithobolia C yvfp** shares much of that opening skeleton, but at `warr` routes seven four-cell stone copies to different locations and spends the remaining path on a multi-launch paper with an imp tail. [Talisman](https://asdflkj.net/COREWAR/88/HILL32/talisman.red) · [Lithobolia C yvfp](https://asdflkj.net/COREWAR/88/HILL32/lithoboliaC-yvfp.red)

**Eye of the Storm T** carries the same additive decoder to 8,192 cells with different probe constants. Its `warr` splits into a stone boot, a remote imp-launcher boot, and direct jumps into the seeded imp path. Its imp step is 2,731, because `3 × 2731 ≡ 1 mod 8192`. Talisman's 2,667 solves the same equation modulo 8,000. Keeping the instruction syntax while copying the offsets across rings would break the formation. [Eye of the Storm T](https://asdflkj.net/COREWAR/ICWS/HILL32/eyeofthestormicws.red) · [ICWS standings](https://asdflkj.net/COREWAR/ICWS/hill32_rec.html)

**Block fit.** `opening-quickscan-88` tests 4–12 fixed pairs and hands on a probe. `opening-sne-88` loops over pairs. The 94 lattice opening needs opcodes and addressing absent from '88. The missing opening here is an **additive table decoder with a shared attack path**, where multiple branch entries select the correct side without duplicating an attack for every pair. `silk-88`, `bomb-mice`, `hill-stone`, `vector-spiral` and `apart` can express ingredients. `fanboot` is explicitly '94-only, and `copies` supports two to four copies, so neither reproduces the source's '88 split tree or six-worker meter. A useful contract would verify selected branch, exact bomb destination, no-hit exit, and the worker and entry schedule after copying. [Opening and dialect catalog](block-algebra-catalog.md) · [Combinators](../tools/algebra/link.js) · [Fan boot contracts](../tools/algebra/contracts.js)

## 94nop spends the opening on different attacks

**Arvon** chooses a probe lattice using `qfac=163` and `qdec=1228`, with `163×(1228−1)≡1 mod 8000`. The opening mutates a table pointer so one multiply recovers the probe. The attack drops two streams using the first bomb's −67 A-field. `warr` creates six copy workers and uses the live launch operands as backward copy pointers, then sends three groups of six into the stone and one group of six into paper. The stone's two moving fields attack in opposite directions. The paper uses a shared destination for three copies per loop, where `}` and `{` move different source pointers. Existing `opening-qscan-mul`, `probe-burst2` and `fanboot` represent the broad workflow, while `fanboot-paper-stone` bundles the related Quicksilver/silk design. This is a partially covered architecture. The exact probe map, deployed stone loop, and three-stream paper each need their own comparison before substituting a block. [Arvon](https://asdflkj.net/COREWAR/94/HILL32/arvon.red) · [94nop recipe book](hill-recipe-book.md) · [Block catalog](block-algebra-catalog.md)

**King Cobra** starts with two-factor decoding. Its boot copies the scanner and clear into related positions while walking separate fields of a pointer, then erases the source launch pointer. The scanner tests adjacent occupied cells before committing to an SPL-to-DAT clear, and an imp gives it another route to survival. `opening-qscan-qi` and `oneshot-cobra-imp` cover the central mechanisms. `boot WIPE 1` captures the intent of hiding the relocation pointer. The ordinary boot copies one contiguous body. For an exact reproduction the coupled scanner/clear placement, including their separation and pointer fields after copying, deserves a layout test. The existing Cobra body passed the full gate in 29 instructions. [King Cobra](https://asdflkj.net/COREWAR/94/HILL32/kingcobra.red) · [Cobra body](../tools/algebra/blocks/hillscan2.js) · [Block catalog](block-algebra-catalog.md)

## LP shows how much work one copying process can do

**R.O.U.S.** is seven instructions. Each `loop` pass copies a cell through the A-field of `pboot`, makes a remote scatter write through two live operands, and updates mutable fields with `add.f <0, >0`. Its branch watches the copy counter. `spl @paper` queues a child at the original entry. The parent reaches `pboot`, which uses its exhausted A pointer to enter the complete copy. From position zero the queue first holds the remote entry at cycle 30 and first executes it at cycle 32. **Replinator** spends most of its 200 cells on padding and a MUL quickscan around a six-instruction copy/attack loop. That loop similarly pairs a remote write, a self-referential ADD, and one copied cell. **The LP Destroyer** reuses that paper but moves selection to P-space, where one table-driven result can instead dispatch to a timed stone with a DAT clear. [R.O.U.S.](https://asdflkj.net/COREWAR/LP/HILL32/rous.red) · [Replinator](https://asdflkj.net/COREWAR/LP/HILL32/l111.red) · [The LP Destroyer](https://asdflkj.net/COREWAR/LP/HILL32/lpdestroyer.red)

**Block fit.** `lp-paper` passed the full gate at 15 instructions. It captures counted copies and a simultaneous scatter/attack, with explicit data for its doubling walk. The originals are interesting because copying, the attack's address mutation, and the next generation's jump share instruction fields. A six- or seven-cell leaf can test that feedback directly. Check complete copies, when their first process enters, where each attack write goes, and whether the design still completes a copy when its eight slots are occupied. [Existing LP leaf](../tools/algebra/blocks/silktails.js)

**Controlled change.** Replaced R.O.U.S.'s remote `MOV >ipos,{spos` with `NOP >ipos,{spos`. This keeps the operand side effects and the copy loop's visit count. Both versions produced the second process at solo cycle 29 and reached the eight-process cap. The 80-round seed-124 matches below use the native-sized LP profile. The direct scatter write did worse in these two selected matchups. These results leave its performance against other families open. [Round runner](../src/engine/battle.js) · [R.O.U.S. original](https://asdflkj.net/COREWAR/LP/HILL32/rous.red)

| Opponent | Original W/L/T | Side effects only W/L/T |
| --- | ---: | ---: |
| Replinator | 48/27/5 | 53/23/4 |
| The LP Destroyer | 50/25/5 | 52/17/11 |

## X and P-space need a controller contract

**Fire and Ice II** uses the previous result to choose a modulus in `pTab2`. Persistent state reduced by that modulus selects a row of `pTable`. Each row encodes a payload address in A and the next state in B. A single scanner or stone may therefore have several states. Its booted stone puts instructions and ammunition in separate places, including a remote bomb monitored by `jmn.b dTop,dTop+dbPos`. When that B-field is zero, the path falls through to its fallback. The leaf called `airbag-stone` repairs a protected loop from a pristine template, a different recovery mechanism. The original scanner deploys an `STP` bomb in addition to a stun and clear, so extracting the scanner alone still requires P-space. **Fatamorgana X** adds four selectable payloads, accumulated scores, a draw streak, and a sentinel-triggered P-space reset. Its first-round entry sequence seeks an opponent and may die in solo play. [Fire and Ice II](https://asdflkj.net/COREWAR/X/HILL32/fireandice2.red) · [Fatamorgana X](https://asdflkj.net/COREWAR/X/HILL32/fatamorganaX.red) · [Prior X extractions](hill-leaders.md)

**Sunset** is a compact demonstration on 8,000 cells. Its `think` uses the previous result to select a modulus and chooses between one paper/stone and two routes into Recon 2. The two routes share a scanner body with distinct boot addresses. Recon 2 checks pairs at a six-cell gap, lays a fourteen-cell SPL wipe, and later turns that same wipe into a DAT clear. `pair-wipe-scanner`, `boot` and `fanboot` express the broad roles. The existing `switch` can change branches by loss, consecutive loss, or round number. It cannot express this transition table, separate next state from branch identity, or share a payload reached through two deployments. A controller contract should verify the first round, win/loss/tie transitions, storage writes, each actual launch destination, and what happens after a corrupted state. [Sunset](https://asdflkj.net/COREWAR/PSPACE/HILL32/sunset.red) · [Switch implementation](../tools/algebra/link.js)

**Cooperative Black Dimension 1.0** uses `PIN 1123` with win/lose flags, handshake cells, and a persistent enemy flag. On recognizing the handshake it can deliberately wait or die. On failure it goes to a conventional quickscan and paper/stone. This requires shared P-space in the VM before a block can promise the handshake. ZoreWars assembled the file with the explicit private-P-space warning. [Cooperative Black Dimension](https://asdflkj.net/COREWAR/PSPACE/HILL32/cbd.red) · [Compatibility limits](../COMPLIANCE.md)

## ICWS/64 puts launch order under a cap

**Twimp** seeds a three-point imp at `imp` and at `imp+1365`, then uses direct binary jump leaves to enter six positions along each trail. At the first seed the relative targets are 0, 2731, 5462, 1, 2732 and 5463. The second seed adds 1365 to each target. Both trails have step 2,731. The remainder of the launch feeds `twill`, a small stone. **NightCrawler 2^13** boots a stone first, then uses a smaller binary jump tree to route processes to a three-point imp trail (including additional processes one or two cells behind the first wave). Its decoy fills to `MAXLENGTH`. These programs reach the 64-process cap in a full solo run. [Twimp](https://asdflkj.net/COREWAR/ICWS64/HILL32/twimp.red) · [NightCrawler 2^13](https://asdflkj.net/COREWAR/ICWS64/HILL32/nightcrawler213.red)

**Block fit.** `vector-spiral` computes a valid step from the core, but uses a vector launcher with temporary adders. `dual-launcher` currently requires unequal point counts and rejects `NA=3, NB=3` in an 8,192-cell, 64-slot check. A same-step, phase-offset **binary seed and jump launcher** would admit Twimp's geometry and avoid extra adder processes. Its gate should check actual queued entrants and both initial lineages at their exact positions, then repeat under cap pressure and when the stone has already occupied several slots. [Dual-launcher](../tools/algebra/blocks/papers88.js) · [Spiral catalog](block-algebra-catalog.md)

## Odd has multiple origins

**Happy New Year** starts at a short decoy writer. Its moving two-cell comparison sets a live wipe pointer when the pair differs. The SPL bombing and scan share the loop until it falls through into the clear. `decoy-maker` or `decoys-mixed` alongside `blur-carpet` give comparable roles. **Idiot**, marked `94t` in its source, is a different design in the same archive. A q^4.5-style opening dispatches via P-space to either a scan/clear or a stone plus two paper deployments. Its state machine uses the previous outcome and can fold two states back into the same body after a win. These two rows illustrate why the Odd table is better suited to finding transfer candidates than defining a single target ruleset. [Happy New Year](https://asdflkj.net/COREWAR/ODD/HILL32/happynewyear.red) · [Idiot](https://asdflkj.net/COREWAR/ODD/HILL32/idiot.red) · [Odd flat standings](https://asdflkj.net/COREWAR/ODD/hill32.html)

## SAL leaders with separately published sources

Joining the ten Koenigstuhl listings to SAL by normalized name and author produced these **candidate** counts for the sampled midpoint and endpoint. A listed version may have been adapted to another profile. For example, Tiny LP's *Fear of the Unknown* and *Hippogriff* match names and authors in Koenigstuhl LP, but the available LP sources assert an 8,000-cell core. The unmatched SAL leaders *Scorpion*, *Simplex* and *X9C8* still supply standings and pairwise evidence. The join cannot establish their instruction mechanisms. [SAL snapshots](sal-hill-evolution.md#snapshot-results) · [Koenigstuhl inventory](https://asdflkj.net/COREWAR/koenigstuhl.html) · [Fear of the Unknown](https://asdflkj.net/COREWAR/LP/HILL32/fearfixed.red) · [Hippogriff](https://asdflkj.net/COREWAR/LP/HILL32/hippogriff.red)

| SAL field | Midpoint candidates | Endpoint candidates |
| --- | ---: | ---: |
| Beginners | 0/21 | 4/24 |
| Fortress | 0/10 | 0/10 |
| Tourney | 5/25 | 5/25 |
| LP | 9/25 | 8/25 |
| MP | 9/20 | 11/20 |
| Metaswitch | 0/25 | 0/24 |
| Nano | 10/50 | 21/50 |
| Tiny | 15/25 | 12/25 |
| Tiny LP | 6/15 | 8/15 |

**Tiny LP.** *KISS* and *Master of the Wins* were first and second at challenge 195. Their matching published sources identify the same authors and describe Tiny LP entries. KISS uses two copy workers to transfer eight cells across four backward copy instructions. A shared counter routes the two workers to different clears, one in the original image and one 380 cells away. In solo play at base zero, both clears have queued processes at cycle 12. At cycle 24 the process table is full, with four processes at addresses 3–6 and four at 383–386. *Master of the Wins* has a short multiply-decoded scan, a four-instruction attack loop, and a repeating launcher for three-cell stone copies. Its split instruction also serves as the moving boot destination. A useful block contract specifies when copying completes, the two entry destinations and the allocation at the process cap. [Tiny LP 195](https://sal.discontinuity.info/hill.php?key=tinylp&t=195&how=late) · [KISS source](https://asdflkj.net/COREWAR/ODD/HILL32/kiss.red) · [Master of the Wins source](https://asdflkj.net/COREWAR/ODD/HILL32/masterotw.red)

I compared the published KISS with two same-length controls that keep the boot and its writes. In one, the counted branch jumps home so both workers go home. In the other, the final jump sends the second worker to the remote image too. Each pair ran across all relative starts from 50 through 750, with both first-mover orders and fresh state, for 1,402 rounds per cell of the table. The split allocation improved the standard score against four of these six published Tiny LP opponents. The remote-only allocation did better against *ugly redcode* and *swallow*. The result measures the value of deployment in these matchups under SAL's numeric Tiny LP limits. SAL's archived match scores used its own schedule and entrant versions. [Round runner](../src/engine/battle.js) · [Published Odd listings and sources](https://asdflkj.net/COREWAR/ODD/hill32.html)

| Opponent | Split W/L/T | Both home W/L/T | Both remote W/L/T |
| --- | ---: | ---: | ---: |
| Master of the Wins | 708/395/299 | 602/659/141 | 627/577/198 |
| DaubFusion | 939/215/248 | 874/386/142 | 878/355/169 |
| FragPaper 800 | 735/462/205 | 584/749/69 | 605/709/88 |
| ugly redcode | 339/826/237 | 354/943/105 | 464/751/187 |
| tiny Roskilde | 845/299/258 | 648/557/197 | 670/531/201 |
| swallow | 859/129/414 | 899/465/38 | 1,139/119/144 |

ZoreWars now has a 15-cell `paired-clear` leaf that isolates the deployment. Two workers copy a compact body backward and the counted branch routes one to each site. Each site keeps one worker and sweeps a bounded interval with DAT. The gate checks eight fresh writes in reverse order, the intact remote image, the two queued entries, and both repeating write ranges. This is a deployment baseline. With `HOP=380` it scored 0.254 points per round across the same six-opponent panel and placement schedule, compared with 1.776 for the published KISS. The measured result motivates testing faster or staged payloads separately from their launch. [Paired clear](../tools/algebra/blocks/paired-clear.js) · [Verification tests](../test/algebra-paired-clear.test.js)

```sh
echo '{"id":"paired-clear","P":{"HOP":380}}' | node scripts/algebra.js build - --rules tinylp --verification full
```

**LP and MP.** SAL LP's second and thirteenth entries at challenge 566 match the names and authors of *R.O.U.S.* and *Replinator*. Their published copy-and-attack loops are described above. SAL MP midpoint leader *Cloudburst*, fifth at the endpoint, has a published 100-cell version whose multiply quickscan precedes two concurrent routes. One launches a moving SPL/DJN attack. The other seeds silk copies with an imp launcher using step 1,143. The published version filled the 64-slot queue by solo cycle 118. *Twin Flame*, third at the MP endpoint, is published as an LP design. A counted delay gives the booted Torch worker several turns before the home Torch launches. With only the process cap changed in an 8,000-cell solo run, it filled eight slots at cycle 38 and held one home and seven remote processes at cycle 2,000. With 64 slots it filled at cycle 1,018 and held 29 home and 35 remote processes at 2,000. This makes per-body allocation a separate gate observation from total peak size. [SAL LP 566](https://sal.discontinuity.info/hill.php?key=lp&t=566&how=late) · [SAL MP 76](https://sal.discontinuity.info/hill.php?key=mp&t=76&how=late) · [SAL MP 153](https://sal.discontinuity.info/hill.php?key=mp&t=153&how=late) · [Cloudburst source](https://asdflkj.net/COREWAR/94/HILL32/cloudburst.red) · [Twin Flame source](https://asdflkj.net/COREWAR/LP/HILL32/twinflame.red)

**Tourney and Metaswitch.** Tourney midpoint leader *The T Machine* has a matching 94t source, which assembles to 300 cells. Its opening uses `PIN 3` with a separately published companion and uses P-space slots to check the previous result and identify a shared partner before choosing the scan/clear path. Both versions produce ZoreWars' private-P-space warning. This gives a native 8,192-cell handshake case in addition to the 8,000-cell CBD example. For Metaswitch's *X9C8*, the available evidence is the author's description of an unbooted HSA-style scanner and the matchup table. It wins 89 of 100 against second-ranked *Replicator3* but loses 75 of 100 to fifth-ranked *MVB9*. A fixed scanner can be a useful control for testing a switcher. This evidence leaves X9C8's precise implementation open. [SAL The T Machine](https://sal.discontinuity.info/warrior.php?key=94t&id=60&t=101) · [The T Machine source](https://asdflkj.net/COREWAR/ODD/HILL32/tmachine.red) · [Companion source](https://asdflkj.net/COREWAR/ODD/HILL32/tmachines.red) · [SAL X9C8](https://sal.discontinuity.info/warrior.php?key=msw&id=105&t=105)

## Reproduce the review

Download the linked originals as local `.red` files. Run from the repository root. The CLI's native `lp` tournament profile disables P-space and sets a 100-instruction entry limit, so use numeric overrides for this reproduction. By default the CLI allows P-space. Strict '88 is selected with `--rules 88`.

```sh
node cli/zorewars.js battle talisman.red lithoboliaC-yvfp.red --rules 88 -r 50 --seed 124 --json
node cli/zorewars.js battle arvon.red kingcobra.red --rules 94nop -r 50 --seed 124 --json
node cli/zorewars.js battle rous.red l111.red -s 8000 -c 80000 -p 8 -l 200 -d 200 -S 500 -r 80 --seed 124 --json
node cli/zorewars.js battle rous.red lpdestroyer.red -s 8000 -c 80000 -p 8 -l 200 -d 200 -S 500 -r 80 --seed 124 --json
node cli/zorewars.js battle fireandice2.red fatamorganaX.red --rules 94x-hill -r 12 --seed 124 --json
node cli/zorewars.js battle sunset.red cbd.red -s 8000 -c 80000 -p 8000 -l 100 -d 100 -S 500 -r 12 --seed 124 --json
node cli/zorewars.js battle eyeofthestormicws.red --rules 88 -s 8192 -c 100000 --json
node cli/zorewars.js battle twimp.red nightcrawler213.red --rules 88 -s 8192 -p 64 -r 50 --seed 124 --json
node cli/zorewars.js battle happynewyear.red idiot.red -l 800 -d 800 -r 20 --seed 124 --json
```

All commands above ran locally. For a quick comparison, Arvon went 18/12/20 against King Cobra and Fire and Ice II went 6/3/3 against Fatamorgana X. Twimp and NightCrawler tied in all 50 rounds at seed 124. These are local fixed-seed results. [CLI usage](../cli/zorewars.js)

The P-space command with CBD uses private P-space. The cooperative handshake requires a VM with shared P-space. For the R.O.U.S. control, make a separate file with the single MOV-to-NOP edit above and run the same two commands with the control in the first slot. Inspect `battle --report` on rounds with changed winners. Replay the same seed, order and rule flags in `trace --round N --last 60` to inspect the final instruction sequence.

All 16 downloaded originals assembled in the corresponding profile with strict assertions. The table lists the loaded sizes and solo peak process counts observed using the default first-round P-space and placement zero. Assembling and surviving in solo are mechanical checks. CBD and Fatamorgana X died in this particular solo test, at cycles 7,906 and 55,236 respectively. The other 14 reached their cycle limits.

| Field | Loaded cells / solo peak |
| --- | --- |
| '88 | Lithobolia 99 / 8,000, Talisman 69 / 270 |
| 94nop | Arvon 81 / 2,600, King Cobra 100 / 396 |
| LP | R.O.U.S. 7 / 8, Replinator 200 / 8, The LP Destroyer 200 / 8 |
| X | Fatamorgana X 200 / 1, Fire and Ice II 200 / 882 |
| P-space | Sunset 100 / 2,330, CBD 96 / 1 |
| ICWS | Eye of the Storm T 77 / 256 |
| ICWS/64 | Twimp 40 / 64, NightCrawler 2^13 100 / 64 |
| Odd | Happy New Year 20 / 374, Idiot 300 / 4,449 |

The next tests for our own warriors can stay small. First, compare the existing block and the proposed leaf under an identical profile and launch plan. Check the operation it promises, such as exact decoded hits, complete copies, state transitions or phase-correct imp entries. Then run both designs on the same historical or source-backed panels and on a later holdout. A mechanism can pass its gate while making the complete warrior weaker, as the LP scatter control illustrates.

## Build the extracted mechanisms

Each recipe below emits original Redcode after full behavioral verification. Save the tree as well as the generated Redcode when you plan to tune a block.

| Recipe | Example profile | Cells | Mechanism isolated |
| --- | --- | ---: | --- |
| `nano-lane` | `nano` | 5 | A 16-cell scan lane with one pointer field shared by the scan and DAT write |
| `tiny-copy-paper` | `tiny` | 18 | Four fixed remote copy writes and their address side effects before the same boot paper |
| `additive-clear-88` | `88`, `icws`, `icws64` | 50 | A strict '88 shared ADD decoder, hit-side choice, and guarded clear |
| `twinned-stone` | `88`, `icws`, `icws64` | 22 | Two equal-step imp trails with separate seeds and a binary FIFO launch beside a stone |
| `table-stones` | `pspace`, `lp-hill`, `94x-hill`, `tinylp` | 39 | Four persistent states with independent branch and next-state selection |
| `paired-clear` | `tiny`, `tinylp`, `lp-hill` | 15 | Two lockstep reverse-copy workers, then one clear worker per image |

```sh
node scripts/algebra.js recipe tiny-copy-paper --rules tiny --out burst-paper.red --tree-out burst-paper.json
node scripts/algebra.js explain tiny-copy-burst --json
node cli/zorewars.js hill burst-paper.red --rules tiny --hill koenigstuhl:tiny --top 10 --seed 124 --json
node cli/zorewars.js evolve --representation tree --rules nano --hill nano-field --generations 1 --batch 6 --rounds 8 --race 1 --place none --threads 1 --seed 124 --out evolved/nano-trial --json
```

For a frozen Nano field in the last command, use a directory containing the published *Forbes*, *Type-1*, *Bombus Sylvestris*, and *Reptiloid Conspiracy*. A local run with these four sources selected `LANE=9, REVERSE=1, FIELDS=0` and scored 0.64 points per round in a 71-round-per-opponent check on the same field. That verifies the build, mutate, race and replay path. It leaves performance on other opponents open. [Nano sources](https://asdflkj.net/COREWAR/NANO/hill32_rec.html)

The native profiles preserve the field's length and P-space rules even when a smaller entry budget is chosen. Koenigstuhl's Nano, Tiny, ICWS, ICWS/64 and P-space fields can now be selected directly. For SAL, use `pspace` for Beginners, `lp-hill` for Limited Process, `sal-tourney` for Tourney, `sal-mp` for Medium Process, `sal-msw` for Metaswitch, and the matching `nano`, `tiny`, or `tinylp` profile for the compact hills. These select simulator settings. A historical SAL lineup still requires verified local sources, and Fortress still needs the VM's missing restricted-write rule. [Published SAL settings](sal-hill-research.md#public-hill-inventory)

### Tiny copy-burst control

The new `tiny-copy-paper` uses its own fixed addresses. To make the timing-matched control, change the first four `MOV.I` instructions in the emitted source to `NOP.F` and keep both operands. This retains the predecrements and the layout. The bare `boot-paper` is a separate reference with a shorter image. Every pair below used all 761 legal Tiny start offsets and both first movers with fresh state each round. [Tiny sources](https://asdflkj.net/COREWAR/TINY/hill32_rec.html)

| Opponent | Four-copy opening W/L/T | No-copy control W/L/T | Bare boot-paper W/L/T |
| --- | ---: | ---: | ---: |
| after the storm | 320/1,018/184 | 276/1,067/179 | 268/1,102/152 |
| One Shot 'T' | 508/582/432 | 435/625/462 | 367/698/457 |
| Freezer4 | 411/891/220 | 382/923/217 | 340/979/203 |

The four writes improved points in all three selected matchups. Their effect on other families and on later published leaders needs separate measurement. For the additive quickscan, keep the empty-reference assumption when planning planted tests. For the imp launcher, count actual queue entrants and check that an adjacent worker cannot consume the last reserved slot. For the P-space controller, each packed row is `4 × nextState + branch`. Use a private cell other than zero and keep the order of rounds fixed when comparing switchers.

### Tiny leaders reuse the idea in a different copy schedule

The two leading published Tiny entries in the captured Koenigstuhl table, bvowk's *dfd94f0-408f53a4-b1f60e08.rc* and *e21ca502-19d74cde-aae5d752.rc*, both carry two adjacent silk stages with displacements 236 and 92. Their openings differ. The first mixes remote copies with splits and a decrement stream. The second executes ten remote `MOV.I` instructions with one process before its fan starts. A later move copies a split onto itself. At base zero, the second entry first reaches the two silk split instructions at cycles 17 and 38, with 7 and 21 processes in the queue. Both sources use several forms of operand side effect in their openings. The similarity is a shared pattern visible in the code. The source comments credit the same generation approach and give no parentage. [Tiny standings](https://asdflkj.net/COREWAR/TINY/hill32_rec.html) · [First source](https://asdflkj.net/COREWAR/TINY/HILL32/dfd94f0.red) · [Second source](https://asdflkj.net/COREWAR/TINY/HILL32/e21ca502-19d74cde-aae5d752.red)

I compared the second entry with a copy whose first ten opcodes are `NOP.F`. Both operands remain in place so the variant retains addressing side effects and the opening's instruction count. Use the `assemble` and `tally` functions in [stateless-replay.mjs](../examples/hill-study/stateless-replay.mjs) with `treeSettings('tiny')` to repeat the 1,522-round sweep. The independently built `tiny-copy-paper` is included as a reference for what the new block delivers with a different paper and fewer writes.

| Opponent | Published W/L/T | No-copy W/L/T | New recipe W/L/T |
| --- | ---: | ---: | ---: |
| dfd94f0 | 640/830/52 | 561/918/43 | 269/1,172/81 |
| Double Shock | 851/619/52 | 772/698/52 | 283/1,182/57 |
| Consonance | 747/707/68 | 656/787/79 | 277/1,080/165 |
| Little Fluffy Clouds | 547/312/663 | 344/341/837 | 189/569/764 |

The opening writes improve the published warrior in all four pairings. Reaching that performance in our own tree still requires explaining the mode mix and the shared silk body. The next useful control is to swap one addressing mode at a time while preserving the same launch and paper, then hold the opening fixed and vary the first copy's entry schedule. The leader bodies also give two additional targets for extraction. *Double Shock* deploys two four-cell clears at half-core separation after a compact scan, while *Consonance* sets two silk steps under the relation `3 × X + Y ≡ 1 mod 800`. Test that relation by tracing the first several generations before treating the steps as independent tuning knobs. [Double Shock source](https://asdflkj.net/COREWAR/TINY/HILL32/doubleShock.red) · [Consonance source](https://asdflkj.net/COREWAR/TINY/HILL32/consonance.red)

### Nano leaders turn addressing into a coupled attack

*Reptiloid Conspiracy* grows a queue at an immediate SPL, then uses three whole-instruction moves and a DJN loop. Every attack instruction also updates at least one indirect pointer. The first move reads through a remote B-predecrement and writes through the preceding SPL's A field. The second and third use that same SPL field with opposite addressing side effects and move other remote pointers. A safe extraction needs to model how the moves and decrement stream change later reads and writes. Three independent bomb streams would omit that coupling. [Reptiloid Conspiracy source](https://asdflkj.net/COREWAR/NANO/HILL32/reptiloid_Conspiracy.red)

We replaced each move in turn with `NOP.F`, retaining the two operand side effects. All four variants survived the 800-cycle solo trial. The original and the variant missing the second write even had the same peak queue size and final counts of cells by last writer in that trial. Their battle results differ across all four sampled opponents. Each pairing exhausted the 142 legal offsets and first-mover combinations. [Nano source field](https://asdflkj.net/COREWAR/NANO/hill32_rec.html) · [Placement replay helper](../examples/hill-study/stateless-replay.mjs)

| Opponent | Original W/L/T | First write removed | Second write removed | Third write removed |
| --- | ---: | ---: | ---: | ---: |
| Reptiloid Supremacy | 64/68/10 | 37/97/8 | 54/78/10 | 55/83/4 |
| Forbes | 74/63/5 | 38/97/7 | 55/76/11 | 61/75/6 |
| Type-1 | 77/62/3 | 51/81/10 | 64/75/3 | 64/73/5 |
| Toy Soldier | 64/69/9 | 14/105/23 | 58/73/11 | 67/66/9 |

The first write was the most costly to remove across these pairings. The third removal helped against *Toy Soldier*. For a new compact clear, track the first meaningful write, the queue at that turn, and which pointer update caused the next visit. The final solo footprint misses some of the interaction that makes this leader strong.

#### A second writer can stop an attack or redirect its own

The solo comparison between the original and its second-writer NOP control hides a timing difference. At own turn 8, nine cells had been written in the original and seven in the control. At turn 800 both had reached all 80 cells, both peaked at 26 processes, and each instruction had the same number of cells attributed to it as last writer. Yet 57 cells held different instructions, and the original ended with two processes to the control's one. Matching a last-writer histogram is a weak test of a five-cell attack. [Reptiloid Conspiracy source](https://asdflkj.net/COREWAR/NANO/HILL32/reptiloid_Conspiracy.red) · [VM write tracking](../src/engine/vm.js)

The traces below use Conspiracy at address 0. A step is one executed instruction from either warrior. The NOP control retains the operand addressing modes and therefore keeps both predecrements when it executes the changed instruction. I also intervened on individual steps by writing the omitted payload after the NOP, or restoring the target's pre-MOV contents after the original. This isolates the whole-instruction copy for the selected step while leaving the other operand mutations in place. [ZoreWars round runner](../src/engine/battle.js) · [Nano placements](sal-hill-research.md#first-case-study)

| Opponent and placement | Original | Second-writer NOP | What changed |
| --- | --- | --- | --- |
| Type-1 at 64, Conspiracy first | Win at cycle 8 | Loss at cycle 61 | Steps 7 and 15 copy DAT to 67 and 65. Type-1 executes cell 65 on step 16. Restoring only the step-15 copy in the NOP control restores the cycle-8 win. |
| Forbes at 64, Conspiracy first | Win at cycle 13 | Loss at cycle 22 | The same two target cells hold attack instructions. With the copies removed, Forbes executes cell 65 at step 18 and overwrites Conspiracy's SPL at cell 0. Restoring step 7 alone still loses. Restoring step 15 alone ties. Restoring both wins at cycle 123. |
| Forbes at 33, Forbes first | Loss at cycle 127 | Win at cycle 59 | At step 60, the second writer overwrites cell 79, which later supplies both indirect fields of the first writer. At step 114 the first writer targets 71 in the original and Forbes's surviving SPL at 33 in the control. Restoring cell 79 just after the original's step 60 makes it win at cycle 61. Adding the omitted DAT at step 60 to the control turns its win into a tie. |

At offset 64 the second writer's first two copies preserve the launcher by killing enemy turns early. At offset 33 a later copy destroys pointer state that could have steered another writer into the opponent. The same instruction can serve either role. A copy log needs the executed PC, source and destination, and the state of the pointer cells before and after resolution. The target alone cannot show whether it prevented a future enemy turn or steered the next friendly write. [Type-1 source](https://asdflkj.net/COREWAR/NANO/HILL32/type1.red) · [Forbes source](https://asdflkj.net/COREWAR/NANO/HILL32/forbes.red)

For a new five-cell leaf, start with a self-SPL, three writers sharing at least one live cursor, and a DJN return. Derive the first two meaningful copies from the candidate's initial fields and queue schedule, and verify fresh whole-instruction writes at those targets. Repeat at a translated base where the addresses wrap. Plant a distinguishable payload at the second writer's first read and a victim marker at its first write. That catches a missed copy even if the predecrements still run. In a separate scenario, plant a value at a cell the second writer will overwrite and the first writer will later dereference. Verify which field changed and where the first writer went. Keep both traced placements as test cases for the harness. Then use the all-placement opponent panel to compare a candidate with the side-effects-only controls. A passing gate establishes that the writers interact as designed. The panel tests whether that interaction pays off.

### P-space leaders pack transitions into residues

*Sunset* and *Mantrap Arcade* use a compact transition representation worth separating from payload design. They load an encoded state from P-space, reduce it by a modulus selected by the last result, dispatch through the resulting row, and save that row's encoded state for next time. For *Sunset*, state 724 produces rows 4, 9, and 4 under the loss, win, and tie moduli 9, 11, and 10. For *Mantrap Arcade*, state 1415 produces rows 7, 4, and 11 under moduli 16, 17, and 18. The latter shares a factor between its first and last moduli, so the loss and tie row indices must agree modulo 2. A future packed variant can choose compatible moduli, solve the residue constraints at build time, and reject encodings that exceed the core's field range. The current `switch-table` uses explicit rows, giving that optimization a transparent reference for sequence tests. [Sunset source](https://asdflkj.net/COREWAR/PSPACE/HILL32/sunset.red) · [Mantrap Arcade source](https://asdflkj.net/COREWAR/PSPACE/HILL32/mantraparcade.red)
