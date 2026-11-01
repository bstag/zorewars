# Core War strategy trends: leaders, top tens and our experiments

Research date: October 30, 2026 (America/Chicago). The published tables and source files were retrieved today. Retrieval is not a new tournament or a claim about when each table was recomputed. This covers the four Koenigstuhl hills our project targets, with additional checks of the separate 88 and 94nop TOP50 tables. It does not enumerate every warrior or every active server.

## Assessment

Core War has converged on a small number of efficient families and carefully coordinated compositions. The evidence does not establish one universally best strategy, a solved game, or a warrior that wins a majority of rounds against every relevant field. Highest aggregate score and highest win rate are different objectives; a tie earns a point.

For the broad recursive 94nop table, four of the top ten are quickscan/paper/stone warriors, including all of the first three. But there are also two oneshots, a bombing paper, a stone/imp, a scanning vampire and a sustained scanner. Those are primary-family classifications, not mutually exclusive inventories of every effect.

Arvon, Azathoth and pst_v4 are a related lineage: Arvon and pst_v4 explicitly credit Azathoth. Counting them as three independent discoveries would exaggerate convergence. Arvon's source describes improvements to scan coverage, a parallel boot and established paper/stone patterns. This is evidence for continued improvement within an established architecture. [Arvon source](https://asdflkj.net/COREWAR/94/HILL32/arvon.red), [pst_v4 source](https://asdflkj.net/COREWAR/94/HILL32/pst_v4.red).

The strongest common design is an inexpensive opening, safe and fast deployment, a compact attack, and an appropriate survival or clearing continuation. Efficiency and cooperation between these parts matter more than adding more named strategies.

## The opponent pool changes the king

| Ranking | Published leader | Important comparison |
|---|---|---|
| 94nop recursive | Arvon | Paper/stone; Azathoth second and pst_v4 third |
| 94nop TOP50 flat | Kaitain | Oneshot; King Cobra second; Arvon sixth and Azathoth tenth |
| 88 recursive | Lithobolia C yvfp | Distributed stones with paper/imps |
| 88 TOP50 flat | Semiopacity | B-scanner; another B-scanner, Stasis Prime, is second; Lithobolia is tenth |
| X recursive | Fatamorgana X | P-space portfolio of attacks |
| LP recursive | R.O.U.S. | Compact bombing paper |

Sources: [94 recursive](https://asdflkj.net/COREWAR/94/hill32_rec.html), [94 TOP50](https://asdflkj.net/COREWAR/94/TOP50/hill32.html), [88 recursive](https://asdflkj.net/COREWAR/88/hill32_rec.html), [88 TOP50](https://asdflkj.net/COREWAR/88/TOP50/hill32.html), [X recursive](https://asdflkj.net/COREWAR/X/hill32_rec.html), [LP recursive](https://asdflkj.net/COREWAR/LP/hill32_rec.html). Scanner classifications follow [Semiopacity](https://asdflkj.net/COREWAR/88/TOP50/HILL32/semiopacity.red) and [Stasis Prime](https://asdflkj.net/COREWAR/88/TOP50/HILL32/Stasis_Prime.red).

The recursive table combines scores against the full archive with progressively greater emphasis on higher-ranked subsets. The separate TOP50 table is a different field and uses flat scores. Both field composition and evaluation method change, so the comparison does not isolate one cause. It does demonstrate that a single leader is not invariant across reasonable competition settings. [Maintainer's explanation and settings](https://asdflkj.net/COREWAR/koenigstuhl.html).

## Patterns across the four recursive top tens

- **94nop:** four paper/stones, two oneshots, one bombing paper, one stone/imp, one scanning vampire, one sustained scanner. Eight have quickscan openings. The quickscan is an opening, not an extra independent long-term strategy.
- **88:** seven stone hybrids; the other three are a clear/paper/imp combination, a oneshot and a vampire/imp. Nine have quickscan openings. In contrast, five of the separate TOP50's first ten are sustained scanners, plus Mountain Viper's oneshot.
- **X:** six of ten use P-space, including all of the first five. The other four are a paper/stone, two stone/imps and a scanner. Switching between complementary attacks is an important winning architecture under these rules.
- **LP:** nine of ten include paper, either as a concurrent payload or a selectable branch. The tenth is a quad scanner. Efficient replication under an eight-process limit is especially prominent; this is not the same scheduling problem as ordinary Silk.

These are qualitative source inspections, with source comments checked against bodies where necessary. They are not fresh performance measurements or a causal ablation of components. Tables below link each original.

## What our work adds

Our available blocks span these established families and also sensing, field corruption, repair, redundant deployment, movement and in-round classification. Availability in the grammar does not establish competitive execution. [Block catalog](block-algebra-catalog.md).

The strongest practical finding is that we still have implementation and evaluation headroom within known families. On the saved small matched screen, a paper/stone reference scored 2.250 points/round versus 1.094 for the best plain clear on that 94nop panel. The 88 Freight Train body without its quickscan scored 2.188 versus 1.156 for the best clear on its panel. These were four local opponents per profile and two seeds, not public-hill placements. [Screen evidence](hill-leader-screen.json), [local research and context](strategy-trends-local-research.md).

Our novelty experiments also expose overfitting: the Lifeboat screening champion improved training score from 1.125 to 1.403 while comparison score fell from 0.854 to 0.708. Historical Riptide/Telltale experiments produced useful different matchup profiles, but their published local scores predate hardening and establish no current public-hill rank. Molting's earlier opening results have an additional known guard bug. [Detailed evidence and qualifications](strategy-trends-local-research.md).

The 3D experiments form a separate landscape. Repeated simultaneous hybrids lose turns or interfere with their own attacks, while backward clears and switching between rounds have been promising. Those local results cannot establish that the established one-dimensional game has been solved. [Prototype results](../warriors/prototypes/README.md).

## Implications for our next work

1. Establish strong faithful baselines for paper/stone, stone/imp, scanner/oneshot, LP paper and legal P-space portfolios, using the actual target rules and length limit. Eleven of the twelve leaders in our earlier top-three study exceed our 50-instruction profile unchanged; some length is padding, so this does not prove their mechanisms cannot fit. Native X and LP also differ from our tournament profiles. [Leader compatibility](hill-leaders.md).
2. Improve deployment, attack rate, process allocation, scan coverage, and transitions before increasing component count. Preserve coupled arithmetic and scheduling constraints during mutation.
3. Pursue novelty with a specific matchup hypothesis: cheaper contact classification, stronger anti-paper behavior, or a specialist that complements an existing entry. Under a diversity objective, score the actual diversity placement rather than raw average alone.
4. Validate against fresh opponent identities and placements, including the strong TOP50 field. Keep training gains, held-out performance, head-to-head counters, and public submission results distinct.

The evidence favors a mature strategic vocabulary with substantial implementation and matchup work remaining. It does not justify abandoning innovation, or expecting an unfamiliar mechanism to beat optimized established designs merely because it is new.

## Retrieved top-ten source inventory

The following are the four published recursive tables, not the separate TOP50 tables. Scores are native published ranking scores; they are not our 0–3 benchmark points or win percentages. [Retrieval receipt](strategy-trends-snapshot.json) contains all 40 records and both additional TOP50 lists. Originals are cached only in ignored `imported/strategy-trends/`.

### 94nop

[Ranking source](https://asdflkj.net/COREWAR/94/hill32_rec.html).

| Rank | Warrior | Score | Strategy |
|---:|---|---:|---|
| 1 | [Arvon](https://asdflkj.net/COREWAR/94/HILL32/arvon.red) | 161.444 | Quickscan; parallel paper/stone |
| 2 | [Azathoth](https://asdflkj.net/COREWAR/94/HILL32/azathoth.red) | 160.017 | Quickscan; parallel paper/stone |
| 3 | [pst_v4](https://asdflkj.net/COREWAR/94/HILL32/pst_v4.red) | 159.897 | Quickscan; parallel paper/stone |
| 4 | [King Cobra](https://asdflkj.net/COREWAR/94/HILL32/kingcobra.red) | 156.570 | Quickscan; oneshot with bomb detection and imp fallback |
| 5 | [The Collective](https://asdflkj.net/COREWAR/94/HILL32/thecollective.red) | 156.538 | Quickscan; booted bombing LP-style paper |
| 6 | [Tolypeutes](https://asdflkj.net/COREWAR/94/HILL32/tolypeutes.red) | 156.315 | Quickscan; stone/imp |
| 7 | [Kaitain](https://asdflkj.net/COREWAR/94/HILL32/kaitain.red) | 156.270 | Quickscan; oneshot and SPL/DAT clear with imp fallback |
| 8 | [Hullab3loo](https://asdflkj.net/COREWAR/94/HILL32/hullabaloo3.red) | 156.129 | Quickscan; paper/stone |
| 9 | [Forgotten Lore II](https://asdflkj.net/COREWAR/94/HILL32/lore2.red) | 154.720 | Scanning vampire, DJN attack, capture-triggered clear |
| 10 | [Excalibur](https://asdflkj.net/COREWAR/94/HILL32/excalibur.red) | 154.277 | Pair scanner, decoy/boot, stun wipe and clear |

### 88

[Ranking source](https://asdflkj.net/COREWAR/88/hill32_rec.html).

| Rank | Warrior | Score | Strategy |
|---:|---|---:|---|
| 1 | [Lithobolia C yvfp](https://asdflkj.net/COREWAR/88/HILL32/lithoboliaC-yvfp.red) | 171.784 | Quickscan; distributed stones plus paper/imps |
| 2 | [Talisman](https://asdflkj.net/COREWAR/88/HILL32/talisman.red) | 170.387 | Quickscan; stone/imp |
| 3 | [Freight Train v0.2](https://asdflkj.net/COREWAR/88/HILL32/freighttrainv02.red) | 170.027 | Optional quickscan; stone and dual continuous imp launchers |
| 4 | [Resinoid](https://asdflkj.net/COREWAR/88/HILL32/resinoid88.red) | 168.336 | Quickscan; dual resin clears plus paper/imps |
| 5 | [Quicksilver '88](https://asdflkj.net/COREWAR/88/HILL32/quicksilver88.red) | 168.249 | Quickscan; stone/imp |
| 6 | [Into the Unknown](https://asdflkj.net/COREWAR/88/HILL32/intotheunknown.red) | 167.957 | Quickscan; paper/stone |
| 7 | [Mountain Viper](https://asdflkj.net/COREWAR/88/HILL32/Mountain_Viper.red) | 166.469 | Quickscan; oneshot |
| 8 | [Zygote (hill version)](https://asdflkj.net/COREWAR/88/HILL32/zygote_hv.red) | 165.176 | Quickscan; multiprocess stone and paper |
| 9 | [Elemental Dust 2](https://asdflkj.net/COREWAR/88/HILL32/elementaldust2.red) | 164.812 | Vampire/imp |
| 10 | [Der Zweite Blitzkrieg 2021](https://asdflkj.net/COREWAR/88/HILL32/dzb2021.red) | 164.739 | Quickscan; stone/imp, two-pass clear, gate |

### 94x

[Ranking source](https://asdflkj.net/COREWAR/X/hill32_rec.html).

| Rank | Warrior | Score | Strategy |
|---:|---|---:|---|
| 1 | [Fatamorgana X](https://asdflkj.net/COREWAR/X/HILL32/fatamorganaX.red) | 184.423 | P-space portfolio: stone, scanners, paper |
| 2 | [Fire and Ice II](https://asdflkj.net/COREWAR/X/HILL32/fireandice2.red) | 182.505 | P-space: airbag stone or anti-imp scanner |
| 3 | [Fire and Brimstone](https://asdflkj.net/COREWAR/X/HILL32/fireandbrim.red) | 180.761 | P-space: airbag stone or Kenshin scanner |
| 4 | [Ballista](https://asdflkj.net/COREWAR/X/HILL32/ballista.red) | 175.294 | P-space: Arrow X and stone |
| 5 | [KAT v5](https://asdflkj.net/COREWAR/X/HILL32/katv5.red) | 169.412 | P-space portfolio: paper/imps, bomber, scanners and stone/imps |
| 6 | [Azathoth](https://asdflkj.net/COREWAR/X/HILL32/azathothx.red) | 167.185 | Paper/stone |
| 7 | [Void Runner](https://asdflkj.net/COREWAR/X/HILL32/voidrunner.red) | 165.990 | Stone/imp |
| 8 | [Denial](https://asdflkj.net/COREWAR/X/HILL32/denial.red) | 163.034 | Dual imp systems and stone |
| 9 | [Big I.F.F.S.](https://asdflkj.net/COREWAR/X/HILL32/bigiffs.red) | 162.242 | P-space portfolio: scanner and stone/imps |
| 10 | [Discord](https://asdflkj.net/COREWAR/X/HILL32/discord.red) | 161.872 | Scanner |

### lp

[Ranking source](https://asdflkj.net/COREWAR/LP/hill32_rec.html).

| Rank | Warrior | Score | Strategy |
|---:|---|---:|---|
| 1 | [R.O.U.S.](https://asdflkj.net/COREWAR/LP/HILL32/rous.red) | 190.873 | Compact bombing paper |
| 2 | [Replinator](https://asdflkj.net/COREWAR/LP/HILL32/l111.red) | 178.452 | Quickscan and bombing paper |
| 3 | [Bronze minotaur](https://asdflkj.net/COREWAR/LP/HILL32/bronzeminotaur.red) | 178.409 | Two separated bombing papers |
| 4 | [Digital Rain](https://asdflkj.net/COREWAR/LP/HILL32/digitalrain.red) | 170.332 | Bombing paper |
| 5 | [Fear of the Unknown](https://asdflkj.net/COREWAR/LP/HILL32/fearfixed.red) | 170.123 | Paper/stone |
| 6 | [The LP Destroyer](https://asdflkj.net/COREWAR/LP/HILL32/lpdestroyer.red) | 168.546 | P-space: paper and stone |
| 7 | [Hippogriff](https://asdflkj.net/COREWAR/LP/HILL32/hippogriff.red) | 165.487 | Looping bombing paper |
| 8 | [Distortion Energy](https://asdflkj.net/COREWAR/LP/HILL32/dse_6.red) | 162.419 | Paper plus self-modifying stone/clear |
| 9 | [The LP Destroyer II](https://asdflkj.net/COREWAR/LP/HILL32/lpdestroyer2.red) | 162.405 | P-space: paper or dwarf |
| 10 | [Disciples of the Void](https://asdflkj.net/COREWAR/LP/HILL32/4xlb_6.red) | 162.132 | Quad scanner |
