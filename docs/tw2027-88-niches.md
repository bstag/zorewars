# ICWS ’88 niche review for Tournament Weekend 2027

**Keep Coil 31 as the reference partner. Develop Gymnosperm Trickery as the strongest candidate to replace Shadow Gauge, with No Mucking About and Imps! Imps! Imps! as distinct alternatives.** Iron Sword at comparison distance 54 was the clearest improvement among the edits when paired with Coil 31.

## Shortlist

I screened all published ranks 101–200 against the same top 100. The first two runs used 10 archived rounds and 20 new rounds per matchup. The shortlist below uses fresh 50-round runs. I compared each matchup with the mean score the other leaders earned against that opponent and looked for repeated standouts across seeds. Points are per round against just the 100 leaders. SD is the range of initial nearest-neighbor distances when the candidate enters alone. Place comes from the tournament runner's SD rule as implemented by ZoreWars, which recalculates distances and averages after each elimination.

| Warrior | Hill rank | Points | Initial SD | Solo push-off places |
| --- | ---: | ---: | ---: | --- |
| Gymnosperm Trickery | 174 | 1.163 | 74.8–85.4 | 25, 13, 6, 8, 26, 21 |
| Imps! Imps! Imps! | 162 | 1.134 | 77.6–86.2 | 13, 10, 26 |
| No Mucking About | 188 | 1.120 | 101.7–109.3 | 37, 15, 14, 29, 15, 21 |
| Iron Trap | 124 | 1.257 | 95.2–106.3 | 8, 33, 46, 19, 25, 17 |
| Iron Sword | 165 | 1.239 | 90.6–102.0 | 27, 32, 67 |
| Coil 31 | — | 0.924 | 121.4–130.9 | 10, 9, 14, 5, 7, 7 |
| Shadow Gauge | — | 1.074 | 85.5–99.4 | 45, 42, 47, 32, 50, 43 |

- **Gymnosperm Trickery** scored 2.42 against Blur ’88 (Decoy) and 2.27 against Foggy swamp on the first three fresh seeds. Replicant-- and Replicant held it to 0.07 and 0.15. The five-cell evolved bomber needs a way to block early replication. Moving its remote write from 3432 to 3448 barely moved those matchups and cost 0.051 points per round across the next three seeds.
- **Imps! Imps! Imps!** repeatedly scored 2.00–2.10 against Janus, chaoscan, Semiopacity, and Beholder's Eye v1.7. Sting, Glyph, and Tangle Trap 3 held it to 0.35, 0.49, and 0.65. A launch or spiral-spacing change is worth testing against that trio, with the strong scanner matchups as controls.
- **No Mucking About** scored 2.06 against Night of the Living Dead and 1.99 against Replicant--. Positive Knife ’88, Pixie 88, and Evoltmp 88 held it below 0.35. Changing the comparison gap from 49 to 53 cost 0.289 points per round on its fresh panel. Test the clear handoff next while preserving the original scan and SPL carpet.
- **Iron Trap** scored 2.05 against Snake3 and 1.97 against Chimera v3.5. Permafrost held it to 0.50. Time spent in its 100-iteration spiral-stun loop is a concrete parameter to test against Permafrost and Agony 5.1. Check how often the loop triggers before changing it. Gothik is another profile worth retaining. It averaged 2.40 against Leviathan and 2.37 against Matreshka Rulez!, with solo places 29, 54, and 50.

## Pairings and adjustments

The better place of **Shadow Gauge + Coil 31** was **11, 6, 15, 8, 9, 17**. Substituting **Gymnosperm Trickery for Shadow Gauge** gave **13, 6, 10, 8, 8, 14**. Gymnosperm led that pair on three seeds. Paired directly with Shadow Gauge, Gymnosperm itself ranked 14, 10, 9, 10, 21, and 28 and placed ahead of Shadow Gauge each time. No Mucking About + Coil 31 gave better-entry places of 10, 10, 9, 14, 11, and 15.

| Adjustment | Fresh result against its original on the same field |
| --- | --- |
| Iron Sword comparison distance 54 | With Coil 31, Iron Sword moved from **41, 14, 71** to **23, 10, 24**, and the better entry moved from **11, 13, 10** to **7, 9, 7**. Whirl and Medusa's v7X each improved by 0.20 points per round. Overall points slipped from 1.239 to 1.208. Head to head, the edit went 59 wins, 74 losses, and 17 ties. Keep for the Coil pairing. |
| Iron Sword distance 42 and Spitfire 3 starting phase 1394 | Both lost field points. Spitfire also lost 0.22 against its target ’88 test IV. Neither consistently improved the paired result. |
| Full-length PacMan v3 and Sucker 5 boot shifts | PacMan's shift gained 0.32 against Leviathan and 0.49 against Infiltrator. Sucker's shift gained 0.39 against Dragonfly ’88 and 0.35 against Vendetta. Each gained under 0.01 overall and improved solo place on two of three fresh seeds, with mixed paired results. Retain as matchup ideas. |
| PacMan v3 and Sucker 5 decoy trims to 50 | Both assembled and lost a little field score. The full-length originals remain in consideration. |

The first screen put PacMan v3 and Sucker 5 in ninth and 12th. Their full-length originals placed 49th–57th and 46th–67th on the fresh panel. The loss reports cover Whirl, ’88 test IV, Leviathan, and Nemesis, including the instruction that killed the last process. [Saved round diagnoses](../evolved/tw2027-88-niches/loss-diagnosis.json)

## Replay and limits

The archived names and scores match the live ranking at every position from 1 to 200 on November 16, 2026. All 200 archived source files reassembled to the cached instruction sequences and entry addresses. I reused the 10-round full-hill slice and six compatible 50-round top-100 matrices, and reproduced 16 cached matchups as a spot check. Battles used strict ICWS ’88, 8,000 cells and processes, 80,000 cycles, and 100-cell placement separation. The nine edits and two reference builds passed pMARS assembly. The initial entry trials used the 2026 length cap. The follow-up retained the full-length designs per the updated instruction. [Published ranking](https://asdflkj.net/COREWAR/88/hill32_rec.html) · [Maintainer's method](https://asdflkj.net/COREWAR/koenigstuhl.html) · [Saved 2026 benchmark](../evolved/tw2026-88-hill-peers/RERUN.md)

Shadow Gauge is the 49-instruction submission-draft build and Coil 31 is the 13-instruction, 256-cell reserve build. Their reported 2026 places of 10th and 20th are entrant-supplied. The organizer page was unavailable during this review, and the tournament's full scores, exact placements, and 2027 field are unverified. The rankings here are development-field measurements. [2026 recap](tournament-weekend-2026.md) · [Event page](https://corewar.co.uk/tournamentweekend2026.htm) · [Official-rule implementation](../src/engine/pushoff.js)

The [roster](../evolved/tw2027-88-niches/roster.json) includes source hashes and the archived fixture IDs. Each result file holds `[wins, losses]` from the listed side, with ties equal to rounds minus wins and losses. Leader fixtures are the upper triangle in published order. Challenger rows follow that same opponent order, with match seed equal to the file's seed plus seven times the zero-based opponent index. Direct match seeds are stored explicitly. Files with `hillSeed` reuse that 50-round leader matrix. The screening files reuse the discovery leader matrix. The historical schedules and new battles can be reproduced with [run.mjs](../evolved/tw2027-88-niches/run.mjs) using the local source checkout. Ranking replay uses only the saved scores and the repository engine. The benchmark directory is Git-ignored in this checkout.

```powershell
node evolved/tw2027-88-niches/replay.mjs archive discovery screen fresh-a fresh-b fresh-c extra-screen extra-fresh-a extra-fresh-b extra-fresh-c specialists-screen specialists-a specialists-b specialists-c
```
