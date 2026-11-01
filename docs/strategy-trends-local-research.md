# Local evidence for strategic convergence and remaining opportunities

Research date: 2026-10-30 (America/Chicago). This note reviews repository evidence; live public hill verification is a separate task. It does not claim to enumerate every warrior ever written.

## What our leader study actually supports

The saved public-hill snapshot was retrieved at 2026-10-28T02:41:46.087Z and covers the **top three recursive-ranked warriors on four Koenigstuhl hills**. Retrieval time is not recomputation time; recursive ranks differ from Battle Royale and flat top-50 ranks. [Leader anatomy](hill-leaders.md), [machine snapshot](hill-leaders.json).

| Hill | Local snapshot leaders and reviewed mechanisms | Interpretation |
|---|---|---|
| 94nop | Arvon, Azathoth, pst_v4: quickscan then parallel booted paper/stone | Strong convergence, with shared lineage: these are not three independent strategic discoveries. |
| 88 | Lithobolia C yvfp: quickscan, distributed stones, paper/imp; Talisman: quickscan, stone/imp; Freight Train: optional quickscan, stone and dual imp launchers | Survival insurance plus an efficient bombing attack and opening strike recur. |
| X | Fatamorgana X: P-space selector over stone, scanners and paper; Fire and Ice II: airbag stone/anti-imp scanner; Fire and Brimstone: airbag stone/Kenshin scanner | A portfolio selected between rounds addresses different matchups. |
| LP | R.O.U.S.: seven-instruction bombing paper; Replinator: quickscan and bombing paper; Bronze minotaur: separated bombing papers | Process-limited replication has different constraints from ordinary Silk. |

All twelve sources assemble under source-hill settings. **Only R.O.U.S. fits our 50-instruction tournament profile unchanged**; the other eleven use 69–200 instructions. Public X permits P-space, while our `94x` tournament profile forbids it. Public LP allows 200 instructions and P-space; our default LP profile differs. Scores across those settings cannot establish a universal hierarchy. [Leader anatomy](hill-leaders.md).

The resulting pattern is best described as established winning **compositions and scheduling relationships**, rather than a single best opcode or body: quickscan front ends, correct relocation/booting, complementary payloads, process allocation, and appropriate clearing endgames. The family history makes the same argument and documents historical shifts in which family led a hill. [Family history](warrior-family-history.md).

## Comparison with what our experiments achieve

The matched exploratory leader-breakout screen used four local opponents per ruleset, two placement seeds, eight rounds/opponent/seed (1,088 battle rounds in total). These were previously used opponents, not independent public hills. The original quickscan-free reference bodies already outscored the best plain clear on each corresponding small panel:

| Profile/reference | Reference points/round | Best plain clear |
|---|---:|---:|
| 94x airbag stone | 2.1250 | 1.6406 |
| 94x Kenshin scanner branch | 2.0313 | 1.6406 |
| 88 Freight Train, author-provided quickscan-off setting | 2.1875 | 1.1563 |
| 94nop parallel paper/stone | 2.2500 | 1.0938 |
| LP R.O.U.S. | 2.4219 | 0.7344 |

This supports improving our implementations of those bodies and interactions. It does not isolate any component's causal effect or establish tournament strength. [Journal E6](molting-94x-journal.md), [screen receipt](hill-leader-screen.json).

Our own Lifeboat 94x illustrates the implementation gap: declared default 1.1250 training/0.8542 comparison, screening champion 1.4028/0.7083, public stone reference 1.8056/1.7014 on the matched panels. Its 5,808-round experiment established neither a general improvement nor a clear boot advantage. Watchdog and per-shot safety work plausibly consume useful turns, but that explanation was not causally isolated. [Journal E7](molting-94x-journal.md), [results](lifeboat-results.json).

The Molting history also cautions against treating a novel mechanism as automatically useful. Compiled evolution improved training scores but discarded relocation and generalized poorly (1.434/1.444 training versus 0.398/0.426 held-out for the two fragments). Parameter evolution preserved relocation, but did not establish its benefit over matching in-place controls. **E5 later found an incorrect opening guard in the frozen E1–E4 specimens**; those experiments cannot establish the intended opening's effectiveness. [Journal introduction and E1–E5](molting-94x-journal.md).

The small algorithm comparison similarly found no clear advantage from more elaborate search: GA tournament selection averaged 1.974 fresh-placement/2.047 held-out points, species MAP-Elites 1.882/2.081, and the three outcome-archive variants 1.868/1.738. Six variants × three evolution seeds were short runs on eight local '88 opponents, with a separate five-prototype diagnostic panel. The point is sensitivity to opponent selection, not a general ranking of algorithms. [Evolution experiment](evolution-experiments.md).

## Evidence that useful alternatives remain

The original Riptide and Telltale experiments attacked **fields and counters while sensing contact**, instead of adding a conventional separate scan. Telltale then classified the damaged word to choose a stun or DAT response within the round, without P-space. Historical five-fresh-seed validation against nine local opponents gave Riptide 1.872 and Telltale 1.888 versus 1.762 for the prior hybrid; both paired gains exceeded the recorded screening margin. An earlier check had Riptide 242–8 against the hybrid and 246–4 against Imp Ring but only 6–194–50 against Mice. That is an alternative matchup profile, not universal superiority. **Those numbers predate hardening and do not describe the current 20-/42-instruction files. No external public hill result was measured.** [Experimental '88 README](../examples/experimental-88/README.md).

The same experiments contain failures with explanations: Afterimage's movement costs turns and depends on detecting the correct direction; Levy's captured workers attack too slowly; Undercurrent's pure corruption lacks a finisher. These are usable engineering lessons about latency and turn budgets, not proof the strategic families are exhausted. [Experimental '88 README](../examples/experimental-88/README.md).

Our current block-algebra catalog includes quickscans, a hill-style multiprocess stone, papers, imps, scanners, numeric disruption, vampires, gates, repair, redundant booting and in-round classification, with process and geometry contracts. **Availability in the grammar is not evidence of competitive strength.** Earlier journal statements that only seven blocks were executable are historical and should not be reused as a current capability count. [Current algebra catalog](block-algebra-catalog.md), [algebra design](block-algebra.md).

## The experimental volumes have their own emerging equilibrium

The 3D prototype collection repeatedly finds that adding simultaneous jobs loses turns or creates self-interference. Scanner Swarm does not scan faster than one scanner; paper processes starve a partner clear; clears stun their own imps; dodging and many copies compete for responsiveness. In that tested family, switching strategy between rounds is more promising than simultaneously running both. [Prototype results](../warriors/prototypes/README.md).

Useful positive exceptions change the geometry of an established mechanism: Backdraft's backward clear scored 2.53 on 40×20×10 in its recorded panel, and Tripwire's stream-to-clear 2.37. Scratch evolution independently rediscovered a depth imp and DJN streams; the evolved stream beat Volume Queen 30–0 but scored 1.91 overall. Quickdraft's quickscan left Backdraft's 80×10×10 score at 2.46, while the Mortar paper/stone scored 1.94 versus 2.00 for Volume Silk. These values use different recorded panels and must not be combined into a current leaderboard. [Prototype results](../warriors/prototypes/README.md).

The prototype README contains historical statements naming Volume Chameleon as best on 80×10×10, while later local evidence puts Backdraft above it. The raw saved `evolved/3d-80x10x10-hill.txt` lists Backdraft at 2.486 and nearby evolved clears at 2.475. That file lacks a full evaluation protocol in its text, so it is corroborating evidence of convergence toward clears, **not a verified current king**.

## Research interpretation

The evidence supports a mature, constrained design landscape with recurring strong compositions. It does not establish one universally best warrior or exhaustion of the space. Strong candidates must pay for detection, survival and killing from the same turn budget. More components can lower strength; efficient cooperation matters more than their labels.

Promising questions remain: improve contact classification without an expensive separate scan; preserve favorable turn allocation in complementary bodies; remove redundant work from safe bombing loops; choose portfolios only where P-space is legal; and train specialists against representative current public opponents. Evaluate on fresh opponent identities as well as fresh placements, and score the actual competition objective. A specialist complementary to an existing entry may place well in diversity push-off despite a lower raw average. [Evolution experiment](evolution-experiments.md), [block evolution objective](block-evolution.md), [references](references.md).
