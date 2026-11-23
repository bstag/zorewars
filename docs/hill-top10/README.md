# The hills' top 10, rebuilt from blocks

The top 10 warriors of four Koenigstuhl hills were each taken apart, rebuilt as a block-algebra recipe, measured against the original, and tried on the ModelWar ladder (22 Nov 2026). Each hill has its own write-up, with one section per warrior covering how it works step by step, its recipe, its fidelity numbers and its lessons:

- [94nop.md](94nop.md): ICWS'94, 8000 cells, no P-space
- [88.md](88.md): ICWS'88, 8000 cells
- [lp.md](lp.md): limited process (8 processes)
- [94x.md](94x.md): the X hill, 55440 cells, P-space

The recipes are `top10-<hill>-<warrior>` in `tools/algebra/recipes-top10/` (`node scripts/algebra.js recipe top10-94nop-king-cobra --rules 94nop --length 100`). The 31 new blocks are in `tools/algebra/blocks/top10-*.js`, written from scratch. No original Redcode is in the repo.

## How close the rebuilds play

The table gives scores against the hill's own top 30, original then rebuild. Round counts differ by hill: 94nop 200 per opponent, '88 100, LP 40, 94x 50; see each write-up.

| Hill | Within 0.05 of the original | Within 0.10 | Further off | New blocks |
|---|---|---|---|---|
| 94nop | 8 (Kaitain 1.435 / 1.418, The Collective 1.407 / 1.417, Lore II identical) | 10 | none | 10 |
| '88 | 5 (Freight Train 1.382 / 1.366, Talisman, Quicksilver, Elemental Dust 2) | 7 | Lithobolia, Resinoid (resin papers, about 0.15 short), Mountain Viper (quickscan) | 11 |
| LP | 9 (R.O.U.S., Digital Rain, Hippogriff, Disciples identical) | 10 | none | 6 |
| 94x | 6 (Azathoth, Big I.F.F.S., Discord, Ballista) | 7 | Fire and Ice II, Fire and Brimstone (6-state table cut to 4), KAT v5 (weak stand-in arms) | 4 |

Before this work, the nearest existing trees scored far lower: 0.26–1.28 for the 94nop top 10, for example, and 0.39 head to head for the old LP transparent quartet against Disciples.

## Lessons that hold across hills

1. **Layout is part of the program.** Steps, timers and endgames are commonly set by where cells sit, not by counters:
   - King Cobra's scan step is the distance from its clear to its scan.
   - Discord's first lap ends on its own head, which starts its clear; moving the first look 26 cells drops it from 1.32 to 0.41.
   - Azathoth, Talisman, Freight Train and Quicksilver change phase when their own bombs reach their own code.
   - One blank cell in The LP Destroyer absorbs its own trap; without it the stone falls from 0.98 to 0.59.
2. **Spacing and footprint are tuned constants.** Moving Hullab3loo's stone and paper 6 cells apart cost 0.33. Fear of the Unknown's 186 blank cells are worth 0.12. Booting only a stone's live loop instead of its whole block was worth 0.16 on 94x: a scanner that finds dead boot cells wipes on into the live ones.
3. **Speed at the start wins races.** A quickscan that decodes straight into its bomb, with the burst built in, beats our generic scan plus a separate probe:
   - by 0.05–0.11 in every 94nop tree;
   - Talisman went from 1.16 to 1.31 with the new '88 quickscan.

   King Cobra's own 12-cell boot beat the generic `boot` combinator by 0.06–0.08.
4. **Some apparent accidents are part of the design.** Quicksilver bombs its own imp launcher and lives on about a dozen imps. Void Runner's and Denial's stones retire their own pumps. Elemental Dust 2 traps its own processes into its clear. Rebuilds matched only once they reproduced these.
5. **Self-feeding SPLs make bodies hard to kill.** Every '88 stone grows to thousands of processes and keeps bombing after losing its own loop cell.
6. **Field values are visible.** Two instructions with the same arithmetic but resting fields of -1 instead of 0 cost about 0.08 against field-reading scanners (LP Bronze minotaur). Disciples relies on zero A-fields everywhere except the one cell its scanners test.
7. **On P-space hills the arms matter more than the selector.** Fire and Ice II, Fire and Brimstone and Ballista are the same frame with different scanners. Moore's stone alone (1.66) outscores every switcher it sits in. None of the five selectors studied beats our `switch-score`.

## ModelWar

Every rebuild was compiled for ModelWar (25200 cells, P-space) and played against the 17-warrior field. Decoy Adapter v6.1, the live entry, scores 2.16 there.

These numbers predate the placement fix of 23 Nov 2026 (see `modelwar/README.md`, "Replaying a server battle"): they loaded the warriors 100+ cells apart instead of the server's 5040+, which overrates long warriors such as Decoy Adapter (2.03 on the corrected bench). Re-measure before relying on them.

| Best rebuilds | Field average | Where it beats v6.1 |
|---|---|---|
| King Cobra / Kaitain (94nop), rescaled | 1.91–1.93 | Drift v2 2.25 vs 1.76, mercenary, MWClient, Ornithopter V |
| Ballista, Fire and Brimstone (94x) | 1.72–1.73 | Drift v2, Drift, clu 3 |
| Discord (94x) | 1.71 | Drift v2 2.62, InnovationStation 1.95, NovaBomber 2.94 |
| Mountain Viper ('88) | 1.54 | clu 3 2.01 vs 1.73, Drift v2 2.77 |
| papers and paper/stones (all hills) | 0.9–1.7 | the three small stones (PROBE, Skippy, DriftLab), 2.6–3.0 |
| LP designs | 0.88–1.24 | nothing serious; they assume 8 processes |

**Would a switcher help?** No rebuild beats v6.1 overall. As an upper bound, a perfect selector picking the best of v6.1, King Cobra and Discord for each opponent would average 2.27 (3 seeds). That's only 0.11 above v6.1 before any switching cost, so a switcher is not worth building for now.

The parts worth keeping in mind as switcher members are:
- `cobra-body`, against Drift-style and mercenary;
- `flag-cmp-scanner` (Discord), against Drift v2 and InnovationStation;
- a runner paper/stone, against small stones.

## What the catalog still can't express

- **P-space tables larger than four states.** Moore's has six; KAT and Big I.F.F.S. use 15 rows. Also handshakes that deliberately lose rounds, such as Fatamorgana's self-recognition, which the gate forbids.
- **Cells placed in another block's gaps, or planted far away before running.** Lore's flag cell, Hullab3loo's far stone cell and spread quickscan tables are examples. Our contiguous blocks pay padding or keep the cell local. `fanboot` also refuses hops under 256.
- **Bodies meant to die while a partner lives on.** LP's quad stones bomb themselves and the paper carries the endgame; the gate can't accept such a body alone.
- **3- and 7-point imps on a 25200-cell core** don't exist (3 and 7 divide 25200); the '88 imp blocks now take a point count, using 13 there.
- **Gate artifacts.** A switch's dispatch code, and boot source when a member isn't booted, are treated as live code; booting every arm works around both.
- **Resin papers** ('88 Lithobolia and Resinoid) are still about 0.14 short.
