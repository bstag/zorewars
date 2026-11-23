# Koenigstuhl P-space hill, top 10: rebuilt from blocks

The P-space hill: ICWS'94, 8,000 cells, 80,000 cycles, 8,000 processes, length 100, P-space on (`--rules pspace`). Each of the ten leaders was read, run and traced in the VM, rebuilt as a block tree, and measured against its original. Nothing here copies the originals: the blocks are written from scratch from the mechanisms.

Recipes: `tools/algebra/recipes-top10/pspace.js` (keys `top10-pspace-<name>`). New blocks: `tools/algebra/blocks/top10-pspace.js`. The P^3 tables use a new mode of `switch-table`, `ROWS 1` (in `tools/algebra/switch-table.js`). Tests: `test/algebra-top10-pspace.test.js`. Build one with `node scripts/algebra.js recipe top10-pspace-sunset --rules pspace --length 100 --out x.red`.

## How it was measured

- **Hill score**: points a round against the hill's top 30, 50 rounds a pairing (`hill <x> --hill koenigstuhl:pspace --top 30 --rules pspace --rounds 50`), seed 1, and the mean over seeds 1, 2 and 3. The same warrior moved a few dozen cells scores up to 0.04 differently, so a single seed is good to about ±0.04; the three-seed mean to about ±0.025.
- **Head to head**: rebuild against original, 100 rounds, the rebuild's wins-losses-ties.
- **Arms**: a switcher's components alone, from a scratch copy of the original with `ORG` (or its dispatch) pointed at one arm (never added to the repo), and each rebuilt arm as its own tree.
- **ModelWar**: each recipe built with `--rules modelwar --length 200` (distances and counters scaled from 8,000 by 3.15, steps moved to the nearest value with the same gcd; length 200 because the MUL quickscan sizes its safety margin from the length limit) and played against the 17-warrior field, 100 rounds each way, seeds 1 to 3, with warriors loaded at least 5,040 cells apart as ModelWar's server does. On that placement Decoy Adapter v6.1 scores **2.04**, the reference below.

## Summary

| # | Warrior | Recipe | New blocks | Hill seed 1: original / rebuild | Three seeds | Head to head | ModelWar |
|---|---|---|---|---|---|---|---|
| 1 | Sunset (Moore) | `top10-pspace-sunset` | `sunset-paper-stone`, `recon-scanner`, ROWS | 1.477 / 1.478 | 1.501 / 1.481 | 38-41-21 | **2.13** |
| 2 | Cooperative Black Dimension 1.0 | `top10-pspace-cooperative-black-dimension` | `sunset-paper-stone` | 1.493 / 1.504 | 1.483 / 1.491 | 24-24-52 | 1.31 |
| 3 | Mantrap Arcade (Hillis) | `top10-pspace-mantrap-arcade` | `nomolos-paper`, `skew-dwarf`, `mini-blur`, ROWS | 1.423 / 1.380 | 1.432 / 1.348 | 37-44-19 | 1.53 |
| 4 | Just experimenting 1.4 | `top10-pspace-just-experimenting` | as Sunset | 1.435 / 1.473 | 1.427 / 1.462 | 40-42-18 | **2.14** |
| 5 | Combatra (Moore) | `top10-pspace-combatra` | ROWS; stand-in arms | 1.236 / 1.288 | 1.253 / 1.249 | 38-49-13 | 1.33 |
| 6 | Aggression is a switch | `top10-pspace-aggression-is-a-switch` | `twin-silk`, `carbonite-stone` | 1.458 / 1.316 | 1.450 / 1.293 | 22-49-29 | 1.42 |
| 7 | Fire and Ice (Moore) | `top10-pspace-fire-and-ice` | `mini-blur`, `fi-paper`, ROWS | 1.371 / 1.373 | 1.392 / 1.376 | 54-30-16 | 1.64 |
| 8 | Liquid Paper | `top10-pspace-liquid-paper` | as Fire and Ice | 1.367 / 1.365 | 1.386 / 1.378 | 40-44-16 | 1.59 |
| 9 | Return of Vanquisher PsP | `top10-pspace-return-of-vanquisher` | `vanquisher` | 1.466 / 1.418 | 1.486 / 1.374 | 45-42-13 | 0.82 |
| 10 | Recycled Bits (Moore) | `top10-pspace-recycled-bits` | `imp-silk`, `skew-dwarf`, `mirage-scanner`, `sdd-clear`, `incendiary-clear`, ROWS | 1.419 / 1.378 | 1.389 / 1.358 | 35-45-20 | 1.61 |

Seven of the ten are within 0.05 of the original on the three-seed mean (Sunset, Cooperative Black Dimension, Just experimenting, Combatra, Fire and Ice, Liquid Paper, Recycled Bits); Just experimenting's rebuild scores more because it does not throw round 1. Mantrap Arcade is 0.08 short. Aggression is a switch and Return of Vanquisher are 0.11 to 0.16 short, and in both the whole gap is the quickscan: their arms match.

## Hill summary

**What this hill rewards.** Nine of the ten use P-space, and so do most of the rest of the top 30, so a match is two learners adapting to each other over 50 rounds. Unlike the 94x hill, where the best arm alone beat every switcher, here the selector earns its place:

| Warrior | Best arm alone | Whole warrior | Gain from switching |
|---|---|---|---|
| Fire and Ice | scanner 1.19 | 1.37 | +0.18 |
| Mantrap Arcade | mini Blur 1.27 | 1.42 | +0.16 |
| Aggression is a switch (without its quickscan) | paper 1.06 | 1.30 | +0.24 |
| Sunset | paper/stone 1.47 | 1.48 | +0.01 |
| Recycled Bits | incendiary bomber 1.40 | 1.39 | 0 |

The gain is largest where the arms are individually weak and complementary (a paper and a scanner, a paper and a stone): each opponent meets the arm that beats it after one or two lost rounds and keeps meeting it. Where one arm is already strong (Sunset's paper/stone, Recycled Bits' bomber) the table mostly protects it.

**Lessons across warriors.**

1. **The P^3 table is the hill's common brain, and it needed more than four states.** Sunset (11 states), Mantrap Arcade (18 rows), Combatra (11), Recycled Bits (16, as a P^2 variant) and Fire and Ice (3) all store one number and reduce it by a modulus chosen by the last result; the residue is the next row. `switch-table ROWS 1` now emits exactly this (state k: member, next after a loss, a win, a tie; the stored numbers found by the Chinese remainder theorem over three coprime moduli of at least STATES). Sunset with its own 11-state table scores 1.48; with the best 4-state approximation tried, 1.41 to 1.48 depending on the table. The README's first catalog gap (tables over four states) is closed.
2. **Tables carry dead rows.** Minimising Mantrap Arcade's 18 rows from its first state leaves 9: its fourth arm (the CLP snare dodger, a JMP trap into a P-space brainwasher) is never played unless its state cell is brainwashed. Recycled Bits' comments mark two unreachable states. A table is worth reducing before reading meaning into every row.
3. **Quickscans are worth 0.1 to 0.15 here, and ours do not always deliver it.** Cooperative Black Dimension's quickscan adds 0.11 over its paper/stone and our MUL quickscan plus burst reproduces that. But Aggression's q^2 (23 pairs, a decoder of at most two cycles, 18 bombs spreading both ways) adds 0.15 to its switcher and Return of Vanquisher's q^4 adds 0.11 to its bomber, while the same MUL quickscan and burst add 0.04 and 0.00 to the rebuilt arms (which match the originals alone). The STP brainwash bomb in Vanquisher's quickscan is not the reason: replaced by a SPL it scores 1.47 against 1.49.
4. **Moore's paper/stone is the strongest single arm.** Sunset's and Cooperative Black Dimension's fan boot of a never-stopping stone (a SPL # feeder, a DAT and a copied cell a pass) and a replicator scores 1.42 to 1.47 alone, more than any other component on the hill, in 23 cells.
5. **Invisible bombs.** mini Blur's carpet bomb is `SPL 0, 0`: a JMZ.F scanner, its own included, reads it as empty. Its scan passes over its own SPL line at look 843 of 2,210 without noticing, and opponents' F-scans pass over its whole carpet.
6. **Footprint and placement are noise-sized but real.** Moving Sunset's paper/stone 40 or 77 cells changes its hill score by up to 0.04; a 100-cell image of blank padding changes nothing (the battles are identical). Booting each Recycled Bits arm to its own distance instead of running it in place took the rebuild from 1.10 to 1.36: arms left in the image are found by every quickscan and wiped with the dead code around them.
7. **Multi-process loops scatter their aim.** Recycled Bits' incendiary bomber aims the SPL half of each pair through the MOV line's B-field after other processes have already moved it, so the SPL halves fall off the pair lattice; the bomber's own JMZ is hit, and the clear starts, near cycle 5,500, not at a planned pass.
8. **Handshakes cost a round.** Just experimenting and Cooperative Black Dimension open with a PIN handshake (shared P-space, which pMARS gives warriors with the same PIN and our VM does not); against anyone else it throws round 1 and then marks the opponent as an enemy. Left out of the rebuilds, which therefore score slightly more.

**What the catalog still can't express.**

- **Learning where the opponent is.** Combatra quickscans; if it finds the opponent's image it drops a "troll" bomb that makes the opponent write its own position into a cell, stores the boot distance in P-space, and in later rounds aims its scanner at the opponent's boot. No block reads an opponent's position across rounds; its rebuild uses stand-in arms and only matches on score.
- **The q^2 and q^4 quickscans of Aggression and Vanquisher** (above): their value is not captured by `opening-qscan-mul` + `probe-burst2` in those trees.
- **A shared copier for many arms.** Recycled Bits boots all five arms through one nine-line copier indexed by its table; each `boot` here costs six cells, so the rebuild had to merge the bomber's top state and leave the paper in place to fit 100 cells.
- **Handshakes** (shared P-space) and **the snare-dodger** (Mantrap's unplayed arm) were not built.

**What transfers to ModelWar.** Sunset (2.13) and Just experimenting (2.14) are the first top-10 rebuilds from any hill to score above Decoy Adapter v6.1 (2.04 with ModelWar's 5,040-cell load separation). Their strength there is Recon 2 (1.88 alone, the best single arm measured) chosen by the P^3 table against the opponents a scanner beats, and the paper/stone against the small stones. They are weak where v6.1 is strong (SEMalytics, the orn family, clu_3): a selector choosing between v6.1 and Sunset per opponent would average 2.32 at best. Recon 2 and Sunset's table are the clearest candidates for a new ModelWar entry or arm. The other rebuilds score 0.8 to 1.6; each beats v6.1 against orn11, where v6.1 is weakest (0.88).

## 1. Sunset (David Moore)

**What it is.** A P^3 switcher over two arms: Moore's paper/stone and Recon 2, the scanner booted to one of two places.

**How it works.**

1. *Brain.* An LDP puts the last result in a cell's A-field; that A-field indexes three moduli (loss 9, win 11, tie 10; the first round's -1 lands on a row whose B-field is 923, so the fresh state 0 stays 0). The stored state is reduced by that modulus; the residue is the row. An STP through the row stores its B-field (the next state's number), and a JMP with an A-indirect post-increment operand jumps through the row's A-field to the arm (row 0 is the jump itself, whose post-increment sends it on to row 1). Traced in the VM for every state: 11 states, the paper plays rows 0, 1, 3, 5, 7, 9 and 10, Recon 2 at its first place rows 4 and 8, at its second place rows 2 and 6. The paper starts; losses walk down two or three paper rows (ties count as half a loss) to Recon 2, which keeps its place for one more loss after a win; each new stint of Recon 2 goes to the other place.
2. *Paper/stone.* A nine-line fan boot makes six lockstep processes; each copies one stone cell (the source pointer is the B-field of the stone's own JMP) and one paper cell (backward), then two SPLs through the entry vector send twelve processes into the stone and a `djn` sends six into the paper. The stone never stops: an SPL with an immediate A-field keeps feeding processes into a four-line loop that lays a DAT at X (its fields post-increment the next line's two pointers), adds the step to both pointers of a MOV, and has that MOV copy the cell at the next X to X + 2862 (step 2*2862, four lattice classes). When its bomb lands on the ADD (or an enemy's does), every process that dies there moves the copy line's pointers one cell: the stone becomes a moving clear. The paper is a five-line replicator (start the copy's processes, copy a cell, drop an anti-imp DAT 5,200 on, next source, go on while the cell after the copy is empty). Alone, by cycle 30,000 the stone's cells have been overwritten and the paper carries the round.
3. *Recon 2.* A 15-cell scanner booted by an unrolled copy loop: two pairs six cells apart every five instructions (.8c), step 6557 (it beats 3-, 7-, 9- and 11-point imps), SLT ignores its own cells; a find is wiped with 14 SPLs from eight cells before the A cell. A DJN timer of 4,800 passes; when it runs out, two decrements turn the wipe line's bomb from the SPL into the DAT 19, 19 at its head and the jump into the SPL #: a SPL-pumped DAT clear.

**Rebuild.** `switch-table ROWS 1` with Sunset's own 11 rows over `sunset-paper-stone`, `boot(recon-scanner)` (DIRECT, SHARE 1) at 1,282 and a `redeploy` of the same payload at 6,800. 93 cells.

**New blocks.** `sunset-paper-stone` (the fan boot, stone and replicator, 23 cells), `recon-scanner` (17 cells; the wipe pointer and a blank are inside the block).

**Fidelity.** 1.478 / 1.477 (three seeds 1.481 / 1.501), 38-41-21. Arms alone: paper/stone 1.434 / 1.467, Recon 2 1.24 (booted DIRECT) / 1.30 to 1.32. With 4-state `switch-table` approximations instead of the real table: 1.41 to 1.48.

**ModelWar.** **2.13, above Decoy Adapter v6.1 (2.04 on the same placement).** It beats v6.1 against orn11 (1.83 / 0.88), Drift v2 (2.88 / 1.84), Drift (2.31 / 1.87), InnovationStation (1.92 / 1.46), MWClient (2.30 / 2.01), DriftLab (2.88 / 2.19), mercenary, PROBE and Skippy, and loses to it against SEMalytics (1.31 / 2.27), orn5, orn7, orn8 and clu_3 (1.5 to 1.8 / 1.6 to 2.1). The arms alone: Recon 2 1.88 (it alone beats v6.1 against orn11, Drift v2, Drift, MWClient, mercenary and InnovationStation), the paper/stone 1.26 (it beats v6.1 only against the three small stones, 2.9 each). The table puts each opponent in front of the arm that beats it: the whole is 0.25 above its better arm. A perfect pick between v6.1 and Sunset for each opponent would average 2.32.

**Lessons.** Two boot places for one scanner cost a `redeploy` (6 cells). The brain matters little here because the paper/stone alone is nearly as good as the whole.

## 2. Cooperative Black Dimension 1.0 (Blake Escritt / Christian Schmidt)

**What it is.** A PIN handshake, then a q^4 quickscan with a 14-step two-bomb burst, then Moore's paper/stone with other numbers (stone 4,275 on, paper 3,524, replicator step 431, bomb 4,692). The quickscan's table lives in the fan boot's free SPL B-fields.

**How it works.** The handshake (Bigboy style): round 1 scans backward from its own image for a copy of itself and dies if it finds none; later rounds exchange win/loss flags through shared P-space with partners of the same PIN, and against anyone else set an enemy flag and go straight to the quickscan. Then as Sunset's paper/stone.

**Rebuild.** `seq(opening-qscan-mul (8 units), probe-burst2 (14 bombs, step 7), sunset-paper-stone)` with CBD's numbers. 79 cells. The handshake is left out.

**Fidelity.** 1.504 / 1.493 (three seeds 1.491 / 1.483), 24-24-52. The quickscan adds 0.11 to the paper/stone in both (original 1.531 with the handshake skipped, 1.422 without the quickscan; rebuild 1.504 and 1.391).

**ModelWar.** 1.31: the paper/stone without Recon 2 scores like the paper/stone arm (1.26), strong only against the small stones (PROBE 2.90, Skippy 2.97, DriftLab 2.89).

**Lessons.** The cheapest top-3 design here: a quickscan and the paper/stone, no P-space selector at all.

## 3. Mantrap Arcade (Dave Hillis)

**What it is.** A P^3 switcher with an 18-row table over four arms: the Nomolos paper, the dwarf from Patel's Virus, mini Blur (Fire and Ice's scanner) and a "Curious Little Program" snare dodger.

**How it works.**

1. *Brain.* Moore's dispatcher with moduli 16 (loss), 17 (win), 18 (tie); the first round plays the dwarf. Minimised from its first state the table has 9 states: dwarf ×4, mini Blur ×2, paper ×3. **The dodger is never reached** unless the state cell is brainwashed.
2. *Paper.* Two processes copy a twelve-cell body 4,000 on; in the copy three MOV.I lines with an immediate B-field (each copies a cell onto itself) turn into copies of the launch's SPL as the processes pass, multiplying them; the body runs two silk stages (5,689 and 1,021), drops two anti-imp DATs 4,723 on, then copies itself backward and jumps there (3,607).
3. *Dwarf.* A SPL #0 feeder over a loop that bombs the cell P and the cell P's A-field names (one below P on a blank: a skewed pair), moves P 81 down and runs a decrement stream; after 1,677 passes the bombs land on its own loop and what is left is the feeder over a DAT: a decrement gate that keeps the warrior alive (and breaks imps).
4. *mini Blur.* As Fire and Ice (#7).
5. *Dodger* (unplayed): two fence cells around itself are watched every pass; between checks it throws a JMP snare whose pit runs an STP in a DJN loop that walks the STP's cell number down, so a trapped opponent wipes its own P-space; a hit fence makes it copy itself away.

**Rebuild.** `switch-table ROWS 1` with the 9 reachable states over `nomolos-paper`, `boot(skew-dwarf)` at 5,420 and `boot(mini-blur)` at 2,942. 91 cells.

**New blocks.** `nomolos-paper` (20 cells), `skew-dwarf` (9 cells), `mini-blur` (12 cells).

**Fidelity.** 1.380 / 1.423 (three seeds 1.348 / 1.432), 37-44-19. Arms (three seeds, original / rebuild): paper 1.104 / 1.074, dwarf 0.862 / 0.863, mini Blur 1.266 / 1.223; dodger 0.284 (not built). The remaining 0.08 is spread over the arms; the same mini Blur scores 1.27 from Mantrap's image and 1.19 from Fire and Ice's (one seed), which suggests the dead image it leaves behind matters.

**ModelWar.** 1.53; above v6.1 only against orn11 (1.10) and DriftLab (2.78).

**Lessons.** Three weak arms (0.86 to 1.27 alone) make a 1.42 warrior: the table is worth 0.16 here. And a quarter of a 100-cell warrior can be unreachable code.

## 4. Just experimenting 1.4 (Blake Escritt)

**What it is.** Sunset with a handshake in front (the same as Cooperative Black Dimension's, PIN 1123), its state in another P-space cell (WID * 234 mod 480 + 1 = 223, an anti-brainwash measure) and the rest of the image a live decoy of SPLs with varied modes.

**Rebuild.** The Sunset tree with CELL 223 and seven `decoys` (DECOY 2) to fill 100 cells. The handshake is left out.

**Fidelity.** 1.473 / 1.435 (three seeds 1.462 / 1.427), 40-42-18. The rebuild scores more because it does not throw round 1 of every match.

**ModelWar.** **2.14**, the same as Sunset within noise (the same tree with seven decoys), the best rebuild of any hill so far on ModelWar.

**Lessons.** A handshake that loses round 1 against everyone costs about 0.03 a round on a 50-round hill; it pays only between cooperating entries.

## 5. Combatra (David Moore)

**What it is.** An 11-state P^3 learner: quickscan; if it finds the opponent's image, troll it; remember where the opponent boots; later run a scanner that looks exactly there. Otherwise a core clear or Floody River's bomber.

**How it works.** Every path but the scanner first runs a three-pair quickscan (MUL-decoded). On a find, a "troll" is booted beside the find: it bombs with a MOV.A that, run by the opponent, writes the opponent's position into a cell; Combatra stores the quickscan's cell and the troll's report in P-space. Next round the check state compiles them into the opponent's boot distance and switches to the scanner state, whose scan pointer starts at that distance and looks for the opponent's 100-cell boot code. Without a find it boots the clear or (a converted boot) the bomber. The table sends losses to the other strategy and keeps winners.

**Rebuild.** `switch-table ROWS 1` with Combatra's 11 rows over stand-ins: `boot(incendiary-clear)` for the bomber, `boot(sdd-clear)` for the clear, `boot(mini-blur)` for the scanner (no quickscan; with one the rebuild scored 1.21). 84 cells.

**Fidelity.** 1.288 / 1.236 (three seeds 1.249 / 1.253), 38-49-13. A score match, not a mechanism match.

**ModelWar.** 1.33.

**Lessons.** The only warrior here that learns about the opponent rather than about its own results. Its learning is worth less than it costs: it is the weakest of the ten, and a table over generic arms scores the same.

## 6. Aggression is a switch (M Joonas Pihlaja)

**What it is.** A q^2 quickscan, then a two-state P-space switch between a paper and Stealth Carbonite.

**How it works.**

1. *Quickscan.* 23 pairs 131 apart (step -262), one or two cycles each; the jump of each unit leaves its location in a table cell with a pre- or post-increment, so the decoder needs at most two cycles; it picks the occupied cell and lays 18 DAT bombs (whose A-predecrement operands damage cells 25 on and 13 back when they are run) moving both ways from it, then hands on.
2. *Brain.* A state cell in core 220 past the image; P-cell 1 is 0 for the paper, 1 for the stone. Traced for every case: the first round and every tie play the paper; a loss switches; a win keeps.
3. *Paper.* Five processes become ten, copy the ten-cell body 3,532 on and run it there and in place: two silk stages, an imp-breaking MOV and a DAT, then a backward copy and a jump.
4. *Stealth Carbonite.* The boot plants a DAT whose two post-increment operands point at the MOV and the DJN 197 past the stone's MOV; a SPL #0 feeds a three-line loop: the MOV copies that bomb to its pointer, an ADD.AB whose operands both resolve to the MOV adds the MOV's A-field (197) to its B-field (no step cell), and a DJN.F runs a decrement stream. After 3,499 passes its bomb lands on the ADD and each process that dies there moves the pointer on: a core clear.

**Rebuild.** `seq(opening-qscan-mul (8 units), probe-burst2, switch(twin-silk, boot(carbonite-stone)))`. 97 cells.

**New blocks.** `twin-silk` (16 cells), `carbonite-stone` (6 cells).

**Fidelity.** 1.316 / 1.458 (three seeds 1.293 / 1.450), 22-49-29. Arms alone: paper 1.075 / 1.055, stone 0.662 / 0.683; without the quickscan (three seeds) 1.252 / 1.299. The quickscan is the gap: 0.15 for the original, 0.04 for ours. Other bursts tried (wider, SPL bombs, Aggression's ±25/-13 spread) scored 1.20 to 1.27.

**ModelWar.** 1.42.

**Lessons.** The switch is worth 0.24 over its best arm; the q^2 another 0.15. Both pieces are cheap: four lines of brain, a quickscan whose table lives in the boot's free fields.

## 7. Fire and Ice (David Moore)

**What it is.** A three-state switcher over mini Blur and a paper.

**How it works.**

1. *Brain.* An LDP.BA loads the state into the final jump's A-field (that jump's B-field is the P-space cell number), takes it mod 3, then adds 5 after a loss, 3 after a win, 0 after a tie or the first round, read from the A-fields of the brain's own lines; an STP stores the A-field of the row it now names, and the jump, B-indirect through its own A-field, goes through that row's B-field. States: scanner (weak, the first), scanner (strong), paper. A scanner loss from the weak state goes to the paper; a paper loss to the strong scanner, a paper tie to the weak one.
2. *mini Blur.* Booted 2,942 on by nine unrolled MOVs. A three-line loop lays one SPL a look at a carpet pointer, adds 2891 to a scan pointer that starts at -2891*2210, and tests that cell with JMZ.F; a find copies the scan pointer into the carpet pointer, two cells before the find. After 2,210 looks the scan pointer is zero, the JMZ looks at the ADD itself, the JMN falls through into a SPL-fed d-clear whose bomb's B-field resets its pointer past the code. Its own SPL line reads as empty to its JMZ.F, so the scan that lands on it at look 843 does not stop.
3. *Paper.* Two SPLs around a MOV.I that copies the next line onto itself (so the second process to arrive runs a third SPL) make six processes, which copy the six-cell body 2,313 on and run it there and in place; the body is a silk stage 4,195 on with an end marker, and a second stage copying backward to 6,234 on.

**Rebuild.** `switch-table ROWS 1` (3 states) over `boot(mini-blur)` (DIRECT) and `fi-paper`. 57 cells.

**New blocks.** `mini-blur`, `fi-paper` (11 cells).

**Fidelity.** 1.373 / 1.371 (three seeds 1.376 / 1.392), 54-30-16. Arms: scanner 1.204 / 1.185, paper 0.941 / 0.972. The 4-state `switch-table` version scored 1.391.

**ModelWar.** 1.64; above v6.1 against orn11 (1.44), Drift v2 (2.21) and DriftLab (2.26).

**Lessons.** 0.18 from switching between two arms that score 0.97 and 1.19 alone.

## 8. Liquid Paper (Sean McDonald)

**What it is.** Fire and Ice with a 2,000-look Blur and the rest of the image DAT decoys with both fields 1.

**Rebuild.** As #7 with TIME 2000 and 18 `decoys` (DECOY 0). 75 cells.

**Fidelity.** 1.365 / 1.367 (three seeds 1.378 / 1.386), 40-44-16. The shorter Blur alone scores 1.28 against 1.19.

**ModelWar.** 1.59; as Fire and Ice.

**Lessons.** A tweak of a constant and a decoy: the same warrior within noise.

## 9. Return of Vanquisher PsP (Lukasz Grabun)

**What it is.** Olivia's q^4 quickscan (with STP brainwash bombs) in front of the Vanquisher incendiary bomber. No P-space selector.

**How it works.**

1. *Quickscan.* Seven MUL-decoded units; the attack drops an STP bomb (a process of the opponent that runs it overwrites one of its own P-cells) and a DJN.F onto itself on the find, then 11 passes of two DATs stepping 7.
2. *Vanquisher.* The boot plants three bombs (a JMP, an SPL and a MOV that together form an incendiary) 252 cells before the loop, two lines of a spare and the clear (twice), copies the seven-line loop 3,408 on and starts four processes there, one a line, through a JMP with a post-incrementing B-indirect operand. Each pass lays the SPL, the JMP and the MOV from the planted cells, stepping 3*1,022; a process that runs them splits and jumps into the next pair. A JMZ.A watches the planted MOV (its A-field is cycled back to 0 every pass); when it is hit, or the loop has gone round, every process falls through into a SPL-fed clear.

**Rebuild.** `seq(opening-qscan-mul (10 units), probe-burst2 (11 bombs, step 7), vanquisher)`. 98 cells.

**New block.** `vanquisher` (33 cells, its boot included).

**Fidelity.** 1.418 / 1.466 (three seeds 1.374 / 1.486), 45-42-13. The bomber alone matches (1.375 / 1.372). The original's quickscan adds 0.11; ours adds nothing (8 units and 14 bombs: 1.379). With the STP bombs replaced by SPLs the original still scores 1.472.

**ModelWar.** 0.82. The scaled bomber survives alone but loses almost everything: its bomb plant (DOFF) and spare-clear offsets were not tuned for 25,200 cells. Not investigated further.

**Lessons.** A plain bomber plus the right quickscan is #9 on a P-space hill; the brainwash bombs are not what makes it work.

## 10. Recycled Bits (David Moore)

**What it is.** A P^2 switcher over five arms: silk-imps, the skew dwarf (as Mantrap's), a Mirage-style scanner, a SPL/DAT clear and an incendiary bomber, all booted by one shared copier.

**How it works.**

1. *Brain.* The state (mod 16) plus a row offset chosen by the result indexes a list of STP lines (three tables overlapped to save 16 lines) whose A-fields are next states and whose B-fields name the arms' (distance, source) cells; the row's A-field is stored as the next state and an ADD through its B-field adds the arm's cell to the copier's last line; nine MOVs copy the arm and the copier's DJN.F jumps into it. Each arm has three or four levels: a win goes up, a loss down, the bottom level hands to the next arm (paper → dwarf → scanner → bomber → paper; the clear hands to the scanner); the paper hands on even after a win.
2. *Silk-imps.* Six processes, a stage 2,333 on that hands its source pointer to a stage 1,737 on, then each process leaves a MOV.I with an immediate A-field 2,333 back, which spreads through the copies like an imp.
3. *Scanner.* A three-line loop bombs from the scan itself (an SPL #0 at a carpet pointer, re-aimed to two cells before each find), steps the scan pointer 5,379 and tests with JMZ.F; after a lap the bomb becomes the DAT after it.
4. *SPL/DAT clear.* Its first write copies its own SPL feeder over the pointer cell three below it, which installs the pointer; then two writes a pass, the bomb chosen by an A-field the clear walks (SPL first, then a DAT with decrement operands a third of the core apart), against 3-point imps and stones that bomb with core.
5. *Incendiary bomber.* A SPL # feeder over a loop laying an incendiary pair (a MOV that copies the cell 47 back on, then an SPL) every 2,395 cells; the SPL halves are aimed through a pointer other processes have already moved, so they scatter; when one lands on the loop's JMZ the processes fall into a d-clear.

**Rebuild.** `switch-table ROWS 1` with 13 states (the bomber's fourth level merged into its third, to fit) over `imp-silk` in place and `boot`s of `skew-dwarf`, `mirage-scanner` (PAD 0), `sdd-clear` (PAD 0) and `incendiary-clear` at the original's distances. 100 cells.

**New blocks.** `imp-silk` (9), `mirage-scanner` (11, or 9 with PAD 0), `sdd-clear` (12, or 9), `incendiary-clear` (9).

**Fidelity.** 1.378 / 1.419 (three seeds 1.358 / 1.389), 35-45-20. Arms (original / rebuild): silk-imps 1.10 / 1.12, dwarf 0.83 / 0.86, scanner 1.17 / 1.20, clear 0.88 / 0.83, bomber 1.40 / 1.36 (three seeds). In place, unbooted, the same tree scored 1.10.

**ModelWar.** 1.61; above v6.1 only against orn11 (1.68).

**Lessons.** Five arms through one copier is what makes five fit in 100 cells; with a `boot` each, something has to give.

The numbers above are from 22 November 2026; where a statement rests on reading code rather than a run, it says so.
