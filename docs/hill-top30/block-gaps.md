# Hill blocks against our block catalog: the gaps

This compares the mechanisms found in the top 30 of each hill ([README](README.md)) with the 137 blocks, the combinators and the recipes in [block-algebra-catalog.md](../block-algebra-catalog.md), as of 9 November 2026.

How to read it: each warrior's review names its nearest catalog blocks. Every block name cited was checked to exist in the catalog, the combinators or the recipes. "Covered" means a block describes the same mechanism with parameters; it does **not** mean a build was made and compared with the original. No hill warrior was rebuilt from blocks for this note.

## Coverage in one table

| Hill | Covered by an existing block or recipe | Approximate only | No block |
|---|---|---|---|
| '88 | additive quickscan, pair-bomber stone, one-pass spirals, '88 silk, pair-wipe scanner, B-scanner, vampires, decoys | imp pump, parallel boot, stone/imp as one unit, paper tails, scanner phase change | resin and hydra payloads, Moore q^2 opening, self-replicating scanner, anti-imp three-stream stone |
| 94nop | all three leading quickscans, two-stream burst, fan boot, Azathoth paper/stone, Armadillo stone, King Cobra, blur scanner, pair-wipe scanner, DJN vampire, Twin Storms | Moore-style 6-line paper, Schmidt's non-stopping stone, three-body fan boot | qBob two-MUL scan, "Q3.14" additive scan, Ziggy's backward-copy paper |
| LP | scatter paper, twin paper, phase stone, mutation stone, four opposed scanners, outcome switch | one-pass scanners with a self-hit handoff, carried-DAT papers, vampire with pit, multi-process jmp bomber | scanning paper, `add.x` mutation attack, imp-throwing bomber, relocating clear |
| X | P^3 table switch, timed stone, fan boots, blur carpet, pendulum scanner, pair-wipe scanner, one-shot, fang and DJN vampires, 13-point pumps and spirals, decoys | Moore's remote-bomb stone, continuous dual pump, Kenshin's scan-and-clear | mov-through stone, Truth Is Out There II, 55HSB, Carmilla's trampoline, score-box switch and handshake |

## '88

| Hill mechanism | Used by | Nearest we have | Gap |
|---|---|---|---|
| Three-line JMP/ADD imp pump on one process | 9 of the 15 imp users (Talisman, Quicksilver '88, Guardian, Sorcery, ...) | `imp-feeder` (a vector launch plus a feeder), `vector-spiral`, `imp-ring`, `dual-launcher` | `compact-imp-pump`, `knight-pump` and `capped-pump` are '94 only. The '88 blocks launch in one pass or need a spiral first. |
| Parallel boot that routes N processes to two bodies | 27 of 30 boot; stone/imp and paper pairs split 4 to 9 processes | `boot`, `copies` (2 to 4), `apart` | `fanboot`, `fanboot-stone-imp` and `fanboot-paper-stone` are '94 only. Nothing does Lithobolia's seven-way split. |
| Straight-line paper ending in an imp tail, resin or mini clear | 7 of 9 papers | `silk-88` | `silk-imps`, `tail-silk` and `silk-cc` are '94 only, so the tails are missing in '88. |
| Resin stone / resin clear / hydra | Lithobolia, Resinoid, Permafrost, Torment | none | No block. The reviews also mark how resin kills as uncertain. |
| Moore q^2 opening with a stun-pit attack | Freight Train, Guardian | `opening-qscan-add-88` | Tables hidden in payload B-fields and the SPL/JMP pit attack are not offered. |
| Bomb burst after a quickscan hit | all 24 quickscanners | hand-on probe only | `probe-burst` and `probe-burst2` are '94 only. |
| B-scanner that times its own switch to a clear | Stasis Prime, Semiopacity, Janus | `bscan-body` (stuns forever) | No self-hit phase change; the clear has to be joined on separately. |
| Stone with three decrement streams 2667 apart | Triangular Sun | `hill-stone` STREAM, `self-add-stone` idea | No anti-imp stream geometry. |
| Scanner that copies itself on a hit | Infiltrator | `bomb-mice`, `relaunch-paper` in spirit | No block. |
| 7-point pump | Freight Train, Sorcery | `vector-spiral` N 7 (one pass) | Continuous 7-point pumping is '94 only. |

## 94nop

| Hill mechanism | Used by | Nearest we have | Gap |
|---|---|---|---|
| Moore-style 6-line paper beside a stone | Hullab3loo, Hullabaloo, Borgir, King of Metal, Spiritual Black Dimension, luca | `bomb-paper` | Approximate. The exact loop is not a block, and it is the most used paper in the top 30. |
| Azathoth three-stream paper on its own | Arvon, Azathoth, pst_v4 | inside `fanboot-paper-stone` | Only available bundled with its stone and boot. |
| Stone that never stops (step 2862) | Borgir, King of Metal, Spiritual Black Dimension | `hill-stone` | Approximate. |
| Fan boot into three bodies (stone, d-clear, imp pump) | Son of Vain | `fanboot3` contract (fixed routing), `fanboot` | Partial: fixed SPLIT 1 / K 1 routing only. |
| qBob two-MUL quickscan, 38 cells | The Art of CoreWar | `opening-qscan-mul` | No block. Too long for a 50-line entry anyway. |
| "Q3.14" additive scan, 19 pairs | luca | `opening-qscan-decode` | No block. Also too long for 50. |
| Backward-copy paper | Ziggy | `anti-imp-silk` | Not a match. |
| Mirror lines and 51 mixed SPL decoys | Excalibur | `decoys-mixed`, `decoy-mirror` | Covered in kind; the purpose of the mirror lines is uncertain in the review. |

Everything else maps onto existing blocks: `opening-qscan-mul`, `opening-qscan-mul45`, `opening-qscan-qi`, `probe-burst2`, `fanboot`, `armadillo-switch`, `compact-imp-pump`, `oneshot-cobra-imp`, `blur-carpet`, `pair-wipe-scanner`, `djn-vampire`, `twin-storm`, `lp-paper`, `decoy-maker`.

## LP

| Hill mechanism | Used by | Nearest we have | Gap |
|---|---|---|---|
| One-pass scanner, 13 to 16 lines, laid out so its first self-hit starts an `spl #0` clear | Simplicity, Yamabushi, Hypnos, Hired Guns, Romulan Warbird, Reclon 2 | `pair-wipe-scanner` + `finisher-counted` / `finisher-guarded`, `tiny-lp-trap-scan`, `twin-storm` | Only as a join of general blocks. No compact LP scanner with the self-hit handoff built in. Six warriors. |
| Paper that carries a DAT stream | Lord of the Core, DaubFusion, 100% Evil, Muffineer | `lp-paper`, `bomb-mice` | Approximate. |
| Arithmetic-step bombing paper | Hippogriff (rank 7) | `lp-paper` step-walk | Approximate. |
| Evolved `add.x` attack | BioMech (rank 11) | `lp-paper` loosely | No block for the attack. |
| Paper that scans for a target and copies onto it | Biocular | `relaunch-paper` idea | No block. |
| Bomber that throws `mov.i #3315,1` imps, with a DJN stream | LPKD | `jmp-bomber`, `djn-stream`, `imp` | The bomber has no block. |
| Five-process jmp bomber with a separate one-process clear | Assault on Mirage | `jmp-bomber`, `hill-stone`, `lp-sector-clear` | Partial. |
| Vampire with a slave pit under the 8-process cap | LP and Feelin' Fine, Incisive | `vampire-trap` | Not checked for LP: our pit relies on prisoners multiplying. |
| One-shot with a relocating SPL-carpet clear | Heavy cavalry | `oneshot-cobra` + `finisher-guarded` + `leap` | Loose. |

Covered: `lp-scatter-paper` (R.O.U.S., Digital Rain, Replinator, Rottinger), recipe `lp-bronze-paper`, `lp-phase-stone`, `lp-mutation-stone`, `lp-opposed-scanners`, recipe `lp-outcome-switch`.

## X

| Hill mechanism | Used by | Nearest we have | Gap |
|---|---|---|---|
| Moore's stone: code and remote bomb in separate places, a `jmn` watch on the bomb, fall-through to a d-clear | Fatamorgana X, Fire and Ice II, Fire and Brimstone, Ballista (4 of the top 5) | `hill-stone` REMOTE + `finisher-dclear`, recipe `stone-then-clear` | Approximate. Our `airbag-stone` is a different mechanism (repair from a template). |
| Mov-through stone that falls into `mov bomb,>ptr / djn.f` | xd100, Evol Cap 4 X, Olivia X, Rosebud, Falcon v0.3 X | `armadillo-switch` (copies its own SPL over its DJN) | Partial: no explicit timer and not ranged for the 55,440 core. Five warriors. |
| Truth Is Out There II: scanner that follows B-fields to answer imps | Fatamorgana X, Fire and Ice II | `scanner-pendulum` for the wipe | No block. |
| 55HSB: brainwash carpet and a clear stepping by the imp step | KAT v5, Big I.F.F.S. | `scanner-pendulum` | No block. |
| Kenshin: one-process scan with a running carpet and a bomb ladder (SPL, JMP, DAT passes) | Fire and Brimstone, Kenshin 4X | `blur-scanner` + `boot` EARLY 1 | The ladder has no block. |
| Continuous dual pump, 13-point A-imps and 19-point B-imps | Denial, KAT v5, Big I.F.F.S. | `dual-launcher` | Ours is one pass. |
| Vampire trampoline | Carmilla | `fang-vampire` with `RELAY` > 0 and `PIT 1` | Covered: the relay cell is the trampoline. |
| Score-box switch, self-handshake, PIN handshake, loss counter | Fatamorgana X, Big I.F.F.S., Falcon | `switch`, `switch-table` | No block. Irrelevant without P-space. |
| STP brainwash bombs | six warriors | none | Irrelevant without P-space. |

Covered: `switch-table` (PACKED 1 is the P^3 encoding), `timed-stone`, `fanboot-paper-stone`, `fanboot-stone-imp`, `compact-imp-pump`, `vector-spiral` (N 13), `blur-carpet`, `scanner-pendulum` (Pendulum X itself), `pair-wipe-scanner`, `oneshot-cobra`, `finisher-overwrite`, `decoys-mixed`, `decoy-maker`.

## Blocks added to close the gaps

Twenty-four blocks were added after this comparison. Each was written from the mechanism, not copied from a hill warrior, and has a gate test alone and in at least one combination. The points are single untuned runs against that hill's top 30 (10 rounds; 6 on X) and are there to show the block fights, not to rank it.

| Hill | Block | File | Lines | Points/round |
|---|---|---|---|---|
| '88 | `imp-pump-88` | `imps88.js` | 6 | 0.73 |
| '88 | `stone-pump-boot-88` | `imps88.js` | 20 | 0.93; 0.95 after `opening-q2-stun-88` |
| '88 | `silk-tail-88` | `papers88b.js` | 9 to 14 | 0.96 clear tail, 0.97 imp tail |
| '88 | `probe-burst-88` | `scan88b.js` | 12 | raises a quickscan + `bscan-clear-88` from 0.49 to 0.54 |
| '88 | `bscan-clear-88` | `scan88b.js` | 11 | 0.53 to 0.56 |
| '88 | `scan-replicator-88` | `scan88b.js` | 13 | 0.71 |
| '88 | `opening-q2-stun-88` | `scan88b.js` | 26 at 5 pairs | see `stone-pump-boot-88` |
| '88 | `triple-stream-stone` | `stones88b.js` | 7 | 0.49; 0.74 beside a 7-point `imp-pump-88` |
| 94nop | `loop-paper6` | `hill-papers.js` | 6 | 1.07 beside `run-stone` (50 rounds) |
| 94nop | `stream-paper3` | `hill-papers.js` | 5 | 1.07 beside `run-stone` (50 rounds) |
| 94nop | `backcopy-paper` | `hill-papers.js` | 6 | 0.91 beside `run-stone` (50 rounds) |
| 94nop | `run-stone` | `run-stone.js` | 6 | see the papers |
| LP | `lp-selfhit-scanner` | `lp-selfhit-scanner.js` | 9 to 16 | 0.95 |
| LP | `lp-stream-paper` | `lp-papers.js` | 8 | 0.95 |
| LP | `lp-step-paper` | `lp-papers.js` | 7 | 1.04 |
| LP | `lp-scan-paper` | `lp-papers.js` | 8 | 0.87 |
| LP | `lp-imp-bomber` | `lp-bombers.js` | 12 | 1.01 |
| LP | `lp-jmp-stone-clear` | `lp-bombers.js` | 18 | 0.64 |
| X | `remote-bomb-stone` | `xstones.js` | 14 | 0.69; 0.79 with `dual-imp-pump` |
| X | `movthrough-stone` | `xstones.js` | 10 | 0.93 |
| X | `follow-scanner` | `xscanners.js` | 19 | 0.58 |
| X | `ladder-scanner` | `xladder.js` | 18 | 0.63 |
| X | `dual-imp-pump` | `ximps.js` | 10 | 0.75; 0.86 with `timed-stone` |
| X | `impstep-clear` | `ximps.js` | 6 | 0.29 |

For comparison, `fanboot-paper-stone` behind the same 50-line opening scored 0.89 against the 94nop top 30 over 50 rounds.

### Second pass

A second pass closed most of what the first left open. Four more blocks were added (28 in all), every new block now passes `--verification full` at its defaults, and three recipes were added.

| Hill | Block | Change | Points/round |
|---|---|---|---|
| '88 | `resin-stone` (new, `resin88.js`, 5 lines) | Lays a downward trail of `MOV <0, <p`. A loop whose jump is hit walks off its code; an SPL-fed process drags an empty cell through its own code and wipes itself | 0.96 (80 rounds) |
| '88 | `hydra-88` (new, `hydra88.js`, 10 lines) | Launches a four-cell resin child every HOP cells with one process each | 0.83 (80 rounds) |
| '88 | `stone-pump-boot-88` | `TIME` mode accepts any step and stops the stone after TIME passes | 0.90 to 0.95 against 0.94 by default |
| '88 | `silk-tail-88` | Watch fix found by the full-length run | unchanged |
| LP | `lp-selfhit-scanner` | `GUARD` (one SLT) lets it scan every second cell | 0.88 to 1.10 (20 rounds); pair mode with SPL/JMP stun, STEP 28, GAP 14 reached 1.34 |
| LP | `lp-stream-paper`, `lp-step-paper` | Default lattice widened to 32 cells so they combine on defaults | 0.97 to 1.08; 1.07 to 1.15 |
| LP | `lp-jmp-stone-clear` | `SPLIT` boots the clear to its own place | 0.64 to 0.67 |
| LP | `lp-relocating-clear` (new, 17 lines) | Compares two guard cells each lap; when they differ it copies itself ahead and continues the clear at the same cell | 0.23 alone (no scanner in front) |
| X | `remote-bomb-stone`, `movthrough-stone` | `RETIRE` shuts down a pump placed before the block when the stone converts; `SPARE` skips cells after it | with `compact-imp-pump` on 94x: refused before, 0.68 after |
| X | `ladder-scanner` | Entry moved behind the loop so `boot` with `EARLY 1` works; 19 lines | 0.63 to 0.66 |
| X | `follow-scanner` | No change; the switch to its clear is now checked on 55,440 cells | 0.58 |
| 94nop | `gated-dclear` (new, 6 lines) | One-process bounded d-clear behind a decrement gate; declares its window and gate | part of `three-body-launch` |
| 94nop | `fanboot3` | `ROUTE 1` routes N / 1 / N; default unchanged and existing trees build to identical code | |
| 94nop | `fanboot`, `fanboot3` | A member may declare `lattice` and `keeps`; a partner boot copy on them is refused | |
| 94nop | `run-stone` | Declares its lattice (residues 6 and 7 mod 8) | recipes `run-stone-loop-paper` 1.10 and `run-stone-stream-paper` 1.10 (50 rounds) |
| 94nop | recipe `three-body-launch` | Quickscan, burst, `fanboot3(mod-stone, gated-dclear, compact-imp-pump)`, 91 lines | 0.77; the 47-line version 0.65 |

Still open:

- **Son of Vain's 4 / 1 / 4 split.** `fanboot3` can now route it, but `compact-imp-pump` takes one entrant only. The recipe is 4 / 1 / 1 with `mod-stone`, a weaker stone than the original's, and scores below `fanboot-paper-stone`.
- **Stone and pump on the X core.** The refusal was the pump's own recovery check, which fails beside any partner (also `hill-stone`). The `RETIRE` trees pass only with a short stone phase (TIME 60 to 100) and score no better than the stone alone. With `RETIRE` set, `remote-bomb-stone`'s planted-hit scenario runs at cycle 6,000 instead of 600.
- **`impstep-clear`** leaves 72 cells unbombed on 55,440. A variant that covered them lost a round in six to the 64-process spiral and was reverted. Why its DJN matters is not established.
- **Resin against imp rings** is not claimed: a lone imp died against one head and survived two. Lithobolia's and Permafrost's variants were not traced separately.
- **`lp-relocating-clear`** needs a `probe` variant before it can follow a scanner.
- **LP papers** cannot tell dead opening cells from live partners in `linked`; wider defaults are the workaround. `lp-scan-paper` scored worse on wider lattices and is unchanged.
- **`gated-dclear`** sweeps its own code if its pointer is knocked into 1 to FIRST-1.
- **The lattice check covers boot copies only**: `stream-paper3`'s later copies do land on `run-stone`'s lattice.
- **LP vampire:** no new block needed. `vampire-trap`, `airbag-vampire`, `fang-vampire` and `djn-vampire` pass the gate under the 8-process cap; `vampire-trap` scored 0.48.
- qBob and "Q3.14" quickscans, the P-space controllers and the STP bombs were left out on purpose.

### Third pass: no length limit

The third pass dropped the 50-instruction and no-P-space limits, since the blocks are not for one contest, and scored assemblies at both the tournament size and each hill's own size. The catalog now holds 174 blocks.

New blocks:

| Hill | Block | What it is |
|---|---|---|
| '88 | `opening-qscan-full-88` | Full-size quickscan with no decoder: 18 pairs in 37 cells, 49 with `probe-burst-88`. Scans every pair each round |
| LP | `lp-relocating-finisher` | The relocating clear started from an opening's probe, 20 cells |
| X | `brainwash-scanner` | Scan with wipe-until-empty, an STP carpet, then the imp-step clear; `WASH 0` builds without P-space |
| X | `decoy-field` | 1 to 190 decoy cells with blank padding |
| 94nop | `fan-imp-pump` | Continuous pump for N lockstep entrants, 4 cells; no refill promise |
| 94nop | `opening-qscan-qbob` | Two-MUL quickscan, 36 cells in 48 lines |
| 94nop | `opening-qscan-add94` | Additive quickscan with no table, 40 cells in 48 lines |

Changed blocks: `silk-tail-88` (resin tail), `resin-stone` (split form), `lp-selfhit-scanner` (pair mode with SPL/JMP stun is now the default: 1.09 to 1.37 over 200 rounds), `lp-scan-paper` (0.78 to 0.91), `ladder-scanner` and `follow-scanner` (STP option under P-space rules; ladder default step 0.56 to about 0.80), `impstep-clear` (reordered, 31/8/1 to 40/0/0 against the 64-process spiral over 40 rounds), `remote-bomb-stone` (RETIRE fires only on the time-up, so the early planted hit is back), `gated-dclear` (self-sweep hole closed), the three hill papers (declare `copies`). pdQscan's 40-cell scan is `opening-qscan-mul` with UNITS 10.

Shared changes: `linked` receives `dead` windows; `fanboot`/`fanboot3` check a paper's later copies against a partner's lattice; recipe `three-body-launch` is now the 4 / 1 / 4 tree; `run-stone-stream-paper` uses eight processes; recipe `q45-run-stone-loop-paper` added.

Best assemblies against each hill's top 30 (100 rounds; 40 on X):

| Hill | Size | Tree | Points/round |
|---|---|---|---|
| '88 | 50 | 6-row additive quickscan + `silk-tail-88`, clear tail | 0.97 |
| '88 | 50 | 8-pair full quickscan + burst + `stone-pump-boot-88` | 0.94 |
| '88 | 100 | Zygote shape: 12-pair quickscan + burst + silk beside a stone | 1.00 (80 rounds) |
| '88 | 100 | Talisman shape: 18-pair quickscan + burst + stone/pump | 0.85 |
| 94nop | 50 | `run-stone` + `loop-paper6` | 1.12 |
| 94nop | 100 | q^4.5 + `run-stone` + `loop-paper6` | 1.15 |
| 94nop | 100 | Son of Vain 4 / 1 / 4 | 1.10 |
| LP | 50 | `lp-selfhit-scanner` alone, 15 or 16 cells | 1.38 |
| LP | 50 | `lp-step-paper` alone, 7 cells | 1.13 |
| LP | 200, P-space | switch: scanner first, step paper after a loss | 1.30 |
| X | 50 | existing `fanboot-paper-stone` | 0.94 |
| X | 50 | booted `ladder-scanner` | 0.77 |
| X | 200, P-space | STP ladder + 168-cell `decoy-field` | 0.82 |

What the runs say:

- **Bigger did not score better.** On '88 the 18-pair quickscan lowered the stone/pump from 0.94 to 0.85; on 94nop a 13-unit scan scored below the 33-cell q^4.5; decoys lowered or did not change every tree they were added to. No LP hill-size design beat the bare scanner.
- **No block assembly beat the existing stone/imp on 94nop**, and none of the new X blocks beat the existing `fanboot-paper-stone` there.
- **Resin ties continuous imp pumps and does not kill them** (2/8/90 against a 3-point pump over 100 rounds with two heads); it kills one-pass spirals (58/1/41 against a 7-point one). No setting changed that.
- **`impstep-clear` kills at its pointer cell**, not by its laps: an imp copied onto the pointer re-aims the clear along the ring, an imp step apart. After the kill the re-aimed walk reaches its own loop, so beside other code it dies soon after. Its 72 blind cells stay.

Still open:

- **P-space controllers are design-only.** `switch-table` has four states and four payloads; the hill's need up to 15 rows and 5 arms, counters (score per arm, draw streak, loss count), a sentinel reset, and one arm reachable from two rows. A `switch-score` combinator is proposed, not built. A PIN handshake cannot be tested because the VM gives private P-space, and a self-recognition handshake throws rounds, which the gate forbids.
- **Gate under a switch:** a roaming member (paper copy, imp) that runs the entry cell of a branch not taken is reported as "ran the wrong branch". This blocks twin papers and imp arms as switch members. `blur-carpet` and `fanboot-paper-stone` also fail their own watches as the branch not taken.
- **Booted scanners:** `pair-wipe-scanner` fails its own watch when booted and `oneshot-cobra-imp` fails its planted-target check booted behind a quickscan, so the Excalibur and King Cobra shapes are not built. `hill-stone` cannot be built at length 100 on 8,000 cells.
- **A decoding 18-pair '88 quickscan** with tables in B-fields (48 lines) is not built; `opening-qscan-full-88` pays PAIRS cycles every round.
- **Lithobolia's seven separate resin stones** cannot coexist by the spacing arithmetic (not run); `hydra-88` stands in.
- **LP:** DaubFusion's 2 + 2 + 4 split (`par` takes four members, imp launchers over-declare processes), twin and quad scanners (`apart` and `copies` refuse clears), decoy padding behind a quickscan-then-paper tree (decoys count as live).
- **Stone + `compact-imp-pump` on 94x** still needs a short stone phase. The X stones cannot share a fan with `fan-imp-pump` (4 or 5 entrants against 16).
- **Papers beside `gated-dclear`** are always refused; `tail-silk` and `backcopy-paper` are refused beside `run-stone`.
- All scores are single untuned runs.

### Fourth pass: score-box switch and the switch gate

- **`switch-score`** (combinator, `tools/algebra/switch-score.js`): 2 to 6 members; each has a score box in P-space, the member played last round gets WIN, TIE or LOSS added, and the best score plays next, the last member keeping HOLD in hand. STREAK counts ties in a row and scores the s-th as a loss. A sentinel cell resets every box on the first round and after a brainwash. The gate runs nine to eleven P-space histories against the model `scoreChoice` and checks the branch and every cell written; `test/algebra-switch-score.test.js` also plays a 15-round match against the model and shows the gate catches a wrong LOSS line.
- **Gate:** once a switch, `switch-table`, `switch-score` or `fork` has taken a branch, a roaming process that runs another branch's entry no longer counts as entering it.
- **Watch fixes:** `lp-stream-paper`, `lp-step-paper` and `lp-scan-paper` no longer check copies before they are entered, and the fan boot's final check is skipped for a branch not taken. Trees that failed before and pass now: `switch-table(lp-imp-bomber, lp-step-paper, lp-selfhit-scanner)`, `switch-score` over the same three, and `switch-table` with `fanboot-paper-stone` either side of `stone` on 94x.

Scores against the top 30 on the hill rules (P-space on; LP 100 rounds, X 20 rounds):

| Hill | Tree | Points/round |
|---|---|---|
| LP | `lp-selfhit-scanner` alone | 1.38 |
| LP | `switch-score(scanner, step paper)` | 1.26 (HOLD 1: 1.26) |
| LP | `switch-table(scanner, step paper)` | 1.17 |
| LP | `switch-score(scanner, step paper, imp bomber)`, STREAK 3 | 1.13 |
| X | `fanboot-paper-stone` alone | 0.89 |
| X | `switch-score(paper/stone, booted ladder)` | 0.92 |
| X | `switch-score(paper/stone, booted ladder, booted movthrough)`, STREAK 3 | 0.94 |

The score-box switch beats `switch-table` over the same pair on LP, but neither beats the bare scanner. On X it is the first tree to edge above `fanboot-paper-stone`, within the noise of 20 rounds. The hill's opponents play without P-space here, so these runs cannot show what a selector does against another selector.

Still open after this pass: a shared payload reached through two deployments, a PIN handshake (the VM gives each warrior private P-space), and a self-recognition handshake (it throws rounds, which the gate forbids).

### Fifth pass

| Hill | Block or tree | Change | Points/round vs top 30 |
|---|---|---|---|
| '88 | `opening-qscan-table-88` (new) | Decoding quickscan, 18 pairs in 47 cells, decode offsets in spare B-fields. A quiet round still costs a cycle per pair | Murmur shape at length 50 (9 pairs): **1.05**, the best '88 tree so far. At length 100 it is the best opening for all four shapes tried (Talisman 0.91 against 0.85 full, 0.83 additive) |
| '88 | `hydra-88` | `CHILDREN` limit and split children | Lithobolia layout 0.89 alone (40 rounds), 0.96 behind the table opening |
| LP | `lp-selfhit-scanner` | `SECTOR` for twin and quad copies; `protects: 'siblings'` accepted by `apart` and `copies` | twin 0.98, quad 0.84 (the 16-cell single scanner stays at 1.38) |
| LP | `lp-imp-quad`, `lp-padding` (new) | Exactly four imps under the cap; blank padding to 200 | DaubFusion shape 0.99; Muffineer shape 1.09 |
| LP | `opening-qscan-mul45` | Built at length 200 (it checked the rule set's limit, not the warrior's length) | — |
| LP | `switch-score` trees | Members the old gate refused | scanner / step paper 1.26 is still the best |
| X | `impstep-clear` | `TRIP`: once the spiral is dead the clear returns to ordinary laps, so it no longer kills itself (40/40 against spiral plus survivor) | 0.40 behind a ladder scanner: still a specialist |
| X | `movthrough-feed-stone` (new) | Mov-through stone whose increment cell is an SPL, so it keeps its share of turns beside a growing pump | booted alone 0.88 / 0.90 (plain 0.73); with `dual-imp-pump` 0.89 / 0.93 |
| X | `remote-bomb-stone`, `follow-scanner` | New defaults (STEP 2019; STEP 23), both better on two seeds; `OWN` option for large images | 0.82 / 0.98 (was 0.55 / 0.56); 0.72 / 0.66 (was 0.63 / 0.63) |
| X | `switch-score` over paper/stone, STP ladder, fanboot(feed stone + dual pump), booted feed stone | Four arms, STREAK 3, 160 cells | **1.00 / 1.01** on two seeds (20 rounds), the first X tree above 1.0; reference 0.98 / 0.92, paper/stone alone 0.89 / 0.86 |
| 94nop | `pair-wipe-scanner`, `oneshot-cobra-imp` | Booted behind a quickscan they protected the wrong cells and wiped their own code; fixed, plus two watch fixes | Excalibur shape 0.41 to 0.46 at 100; King Cobra shape 0.70 at 100, 0.65 at 50 |
| 94nop | `hill-stone` | `FIT 1`: size check against the real warrior, so it builds at length 100 | 0.97 in a Hullabaloo shape (`run-stone` there: 1.16) |
| 94nop | `tail-silk`, papers beside `gated-dclear` | `FAN 0` for fan-boot membership; papers declare their first-lap cells, so a bounded clear is checked against those | — |
| 94nop | `boot SHARE 1` + `redeploy` (new) | One payload booted to two places from different switch branches without a second copy | Sunset shape 121 to 92 cells under `switch-table`, so it fits the 100-cell P-space hill |
| 94nop | `run-stone-stream-paper` | STEP 1512, best of 57 settings off the lattice | 1.065 (the refused 6-process version was 1.10) |

Corrections: `follow-scanner` at its old step was reported winning 17 of 20 against the 13-point spiral; measured, it goes 6/12/2. The imp launchers do not over-declare their processes; each imp briefly needs an adder.

Still open after this pass:

- Twin and quad LP scanners end on one process per copy and tie against papers; a race-free multi-process sector clear is not designed.
- Resin does not beat a continuous imp ring; no partner or stream changes that. Lithobolia's seven resin stones overrun each other within a round in every layout measured.
- `trap-scanner` has the same booted-behind-a-quickscan bug as the two scanners fixed here.
- `redeploy`: one shared payload per tree, a leaf only, and its watch runs only on the boot's copy.
- `backcopy-paper` beside `run-stone` is a real collision (its copies drift onto the stone's residues).
- A paper's own bombs and erased tails are not declared to the partner check; only its copies are.
- A stone that keeps its share beside a pump has to grow; `remote-bomb-stone` has no feeding version. The mov-through lattice caps its stone phase at about 2,650 passes.
- P-space: PIN handshake (the VM gives private P-space) and self-recognition (it throws rounds) remain untestable.

### Sixth pass

| Hill | Block or tree | Change | Points/round vs top 30 |
|---|---|---|---|
| '88 | `opening-qscan-table-88` | `BURST`: the post-find burst is built into the decoder; 18 pairs plus burst in 49 cells instead of 59 | Murmur shape at 50: 1.10 (was 1.05); Talisman shape at 100: 0.97 (was 0.91) |
| '88 | tuned Murmur tree, 45 instructions (PAIRS 11, BURST 8, silk STEP1 2364) | 3 seeds × 40 rounds per candidate | **1.18** over 100 rounds, the best '88 tree |
| LP | `lp-selfhit-scanner` | `FEED`: each twin or quad copy's clear runs its share of the 8 processes without writing on another copy | twin 0.90, quad 0.75 (single scanner 1.38) |
| X | `remote-feed-stone` (new) | Feeds its own processes and ends on a pass counter | 0.86 / 0.83 booted |
| X | `fanboot(movthrough-feed-stone, dual-imp-pump)`, 29 instructions | Best tournament-legal X tree | 0.935 mean of two seeds (paper/stone 0.909) |
| 94nop | `trap-scanner`, `finisher-overwrite` | Same booted-behind-a-quickscan fix as `pair-wipe-scanner` | — |
| 94nop | `loop-paper6`, `stream-paper3`, `backcopy-paper`, `tail-silk` | Declare their own bombs and erased cells for the partner check | no recipe refused |
| 94nop | `boot SHARE` / `redeploy` | Whole-subtree payloads, up to four per tree | two payloads on 94x-hill: 221 cells to 166 |

Push-off: the best trees by points place low. The tuned '88 Murmur tree pushed off in Sledge's place came 50th of 52, where Sledge comes 33rd; on X the best block tree placed 46th of 54. Raw points against a top 30 are not a tournament prediction; see the private repo's research note for the entries' push-off places.

Still open after this pass:

- Eight blocks probably carry the booted-behind-a-quickscan frame bug: `blur-carpet`, `finisher-overwrite-antiimp`, `finisher-guarded-88`, `follow-scanner`, `movthrough-stone`, `remote-bomb-stone`, `scan-vampire`, `scanner-pendulum`.
- Why the twin and quad LP scanners lose 0.4 to 0.6 points to the single scanner is not understood (not the ties).
- `movthrough-feed-stone` can step past its exact end, because its feeder runs the loop out of order; `remote-feed-stone` needs exactly one entrant, which no contract field can declare.
- Longer stone phases scored worse at every step tried on X.
- Papers declare only their first 8 laps; `redeploy` runs the payload's watch only on the boot's copy.
- Nothing yet searches for an entry that is both strong and unlike its hill (`evolve --objective pushoff` is the local tool for that).

## Which gaps matter for the tournament

Ranked by how many top-30 warriors use the mechanism and whether it fits 50 instructions without P-space.

1. **'88 imp pump and '88 parallel boot.** Stone/imp is the hill's modal design, and both halves of its delivery are '94 only in our catalog.
2. **Compact LP scanner with a self-hit handoff.** Six top-30 warriors, all 13 to 16 lines, and the P-switchers that beat them lose their second branch in the tournament.
3. **X stones: Moore's remote-bomb stone and the mov-through stone.** Nine warriors between them, including four of the top five.
4. **X anti-imp scanner (Truth Is Out There II).** It is what most switchers would run every round without P-space.
5. **94nop Moore-style paper as its own block**, and the Azathoth paper unbundled from its fan boot.
6. **'88 paper tails and the post-quickscan burst.**

Not worth building for this tournament: the P-space controllers and STP bombs, the 38 to 40-cell quickscans, and large static decoy fields.
