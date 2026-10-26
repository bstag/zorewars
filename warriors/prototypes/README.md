# 3D prototypes

Warriors we built to test an idea on the plane and the volume, and didn't put in the library. Each file runs (`node cli/zorewars.js battle --torus 40x20x10 warriors/prototypes/<file> @volume/volumequeen.js`), and each starts with a `PROTOTYPE` note: what it tried, how it scored, and why. They're here so the ideas, the numbers and the reasons survive, and so anyone can pick one up and try to make it work.

Scores are points per round (win 3, tie 1) from `zorewars hill <file> --torus <size> --classics --rounds 30 --seed 4242`, against every library warrior that can play on that battlefield and the Hall of Fame classics that survive there. Head-to-head records are wins-losses-ties over 20 or 30 rounds. For comparison, the library's leaders: **Volume Queen** 2.26 on 40×20×10 (2.25 on 80×10×10), **Volume Chameleon** 2.39 on 80×10×10, **Leapfrog** 1.92 (anti-clear specialist). The design notes are in [`design/3d-battlefield.md`](../../design/3d-battlefield.md).

## Answers to clears

| File | Field | Idea | Result | Why |
| --- | --- | --- | --- | --- |
| `sentry.js` | 80×10×10 | Leapfrog with markers on four sides, checked in pairs | Worse than Leapfrog everywhere (12-4-4 vs 18-2 against Volume Queen) | Bombs and copies land without crossing a marker; each extra check slows the watch and the clear |
| `leapfrog-randomhop.js` | 40×20×10 | Leapfrog that leaps in a drifting direction | 1.85 (Leapfrog 1.92); beats Imp 30-0 | A random hop sometimes lands ahead of the front; also clears itself when alone (see geometry below) |
| `leapfrog-sidehop.js` | 40×20×10 | Leap 4 rows up, drifting sideways | 1.86; beats Imp 29-0-1 | As above |
| `bullfrog.js` | 80×10×10 | Leapfrog with Battleship's scan and 3D salvos | 1.54; beats Leapfrog 15-2, loses to papers 0-18 | Papers overwrite a one-process body in ~3,000 cycles, before a scan matters |
| `dodgingqueen.js` | 80×10×10 | Volume Queen plus a watcher that moves the clear behind another clear's front | Ties nearly everything | Two clear processes share one DJN counter; after a move they split into an SPL pass and a DAT pass on alternate cells |
| `dodgingqueen-one.js` | 80×10×10 | The same with one clear process | 1.77 (Volume Queen 2.25); beats clears 17-3 | Weaker against papers than a two-process clear |

## Ideas from the hill archive

Ideas from the strongest of 567 public hill warriors ([n1LS/redcode-warriors](https://github.com/n1LS/redcode-warriors), studied, not copied), written our own way. Two made the library: **Backdraft** (a backward clear, after ULTIMA RATIO REGUM: 2.53 on 40×20×10) and **Tripwire** (a DJN stream that turns into that clear when it trips its own wire, after Death: 2.37). These didn't:

| File | Field | Idea | Result | Why |
| --- | --- | --- | --- | --- |
| `snare.js` | 40×20×10 | A small scanner that lays SPL 0 / JMP -1 traps on what it finds (after Shears), then a DAT pass | Beats Volume Queen 21-9, loses to nearly everything else | Trapping one find at a time is too slow against clears and streams |
| `leapfrog2.js` | 80×10×10 | Leapfrog with wires on both sides, leaping away from whichever front trips one (an answer to Backdraft) | Backdraft 6-13-11 (Leapfrog 0-30); Volume Queen 20-9 (Leapfrog 29-1); Fast Silk 0-25 | Two checks a step leave its clear too slow to win |
| `oneshot2.red` | ring | One-Shot rewritten to scan and clear backward with trap pairs (after Oneshot '88) | 1.17 (One-Shot 1.20, Oneshot '88 2.19) | Direction wasn't Oneshot '88's edge on the ring: its clear is a self-multiplying SPL 0 swarm in 10 instructions |
| (decoys) | ring | One-Shot with 30-60 junk cells before or after it (after '88 test IV) | 1.19-1.20 (no change) | Not kept as a file |

## Scanners that copy

| File | Field | Idea | Result | Why |
| --- | --- | --- | --- | --- |
| `scannerswarm.js` | 80×10×10 | Four Battleships that recognise each other: copies line up at the same x, and a find is compared (A-fields) with our own cell at that x, found with `MUL` by `[1,0,0]` | 1.52 (Battleship 1.50); Leapfrog 20-0, Battleship 18-1; paper losses become ties; clears 6-14 | Copies split the turns, so the scan is no faster; four bodies survive papers better than one |
| `shieldswarm.js` | 80×10×10 | Scanner Swarm with a Leapfrog marker in every copy, checked whenever the scan finds something | 1.64; still 7-13 against Volume Queen | Each copy has a quarter of the turns and must see the front itself |

Friend or foe in 3D: a tag in a body's first cell doesn't work, because a body across the end of its row is two pieces in number order and a scan can meet the tail first. Lining copies up at the same x and comparing a find with your own cell at that x does work, for every cell; compare A-fields only, since B-fields hold each copy's pointers and counters.

## Papers that dodge

| File | Field | Idea | Result | Why |
| --- | --- | --- | --- | --- |
| `frogspawn-clear.js` | 40×20×10 | Leapfrog as a paper: split in two behind the front; every frog runs a forward clear | Kills itself alone | Each frog's clear reaches its siblings before its own marker |
| `frogspawn-backclear.js` | 40×20×10 | The same, clearing backwards towards the marker | Kills itself alone; 1-19 against Volume Queen | The siblings' cleared strips still hit each other |
| `frogspawn.js` | 40×20×10 | No clear; split on the marker or a timer (`WAIT`) | Survives (≈610 processes) but loses to clears 2-18; with `WAIT` 3000 or 7999 (6-10 frogs) 0.69-0.71 | Many frogs: none reacts in time. Few frogs: no attack |

## Clears with something extra

| File | Field | Idea | Result | Why |
| --- | --- | --- | --- | --- |
| `volumequeen-endless.js` | 40×20×10 | Plane Queen's port with a sprayer that never stops | Ties almost everything (1-0-19 against Dwarf) | Stunned enemies run the sprayed MOV fragments and rebuild SPL cells behind the clear |
| `fangclear.js` | 40×20×10 | First pass writes `JMP -1` fangs (each jumps to the one before: every row a trap ring) | 1.99; 0-27 against Fast Silk | A trap only holds what runs into it; SPL 0 also floods the enemy's queue |
| `fangrings.js` | 40×20×10 | Fang pass, then one DAT per row (200 cells, not 8,000) | 1.73 | A fast kill doesn't make up for traps that don't flood |
| `fangpits.js` | 40×20×10 | Fang rings with a column of SPL 0 pits | 1.79 | Most of a paper's processes never reach a ring |
| `queenimp.js` | 40×20×10 | Volume Queen plus Lift's depth imp | 0.89 | The clear stuns its own imp, which floods its own queue |

## Papers and replicators

| File | Field | Idea | Result | Why |
| --- | --- | --- | --- | --- |
| `sweeper.js` | 40×20×10 | Broadside whose copies each run a linear clear | 2.17 (Broadside 2.18) | Papers saturate the volume; what each copy does barely matters |
| `fleet-scatter.js` | 80×10×10 | Fleet with Scatter's steering instead of Slant's chains | 1.16 (Fleet 1.66) | Slant's accidental chains suit Fleet better |

## Plane Queen, taken apart

| File | Idea | Result |
| --- | --- | --- |
| `planequeen-nodecoy.red` | Plane Queen without its decoy | The same score (2.45 on 100×80, 2.35 on 40×20×10): the decoy adds nothing |
| `planequeen-oneproc.red` | No decoy, one clear process | 2.31 and 2.20: the second clear process is worth ≈0.15, the larger body over Two-Pass Clear (2.23, 2.14) ≈0.07 |

## Evolved specimens

| File | Field | What it is |
| --- | --- | --- |
| `evolved-coprime-hybrid.red` | 41×20×9 | From an evolver run from scratch on the coprime volume: a copier stepping by `[-18,0,-2]` plus a stone bombing every `[14,-6,4]`, both through all three axes. 2.05 there (Plane Queen 2.32) |
| `evolved-stream.red` | 40×20×10 | From the second from-scratch run (`--ties 0.1`): a DJN stream again, found independently of Gremlin, in 10 instructions and one process. 1.91; Volume Queen 30-0; ties Gremlin 30 rounds in 30 |
| `evolved-depth-imp.red` | 40×20×10 | From the first evolver run with TRN: it invented a depth imp (copies `MOV.I $0,$[0,0,1]` under a `TRN $[0,0,1]`, as Lift does) |

## What they tell us about what's possible

1. **On an 8,000-cell volume the clear is king, and you beat it by seeing it coming, not by hiding.** A clear counts through every cell in number order, so no position is safe. But its front is predictable and its code never moves: Leapfrog (in the library) watches one marker in the one direction the front comes from and beats every clear. More markers (Sentry) or random directions only make it worse.
2. **`SPL 0` wins because it floods, not because it traps.** Every enemy process caught on `SPL 0` spawns another and fills the enemy's queue, so its working processes hardly run. Traps that only hold (the fang clears) lose to papers, however fast they kill.
3. **One process reacts; many processes survive; a warrior can't be both.** Turns belong to the warrior, not the process: four copies scan no faster than one. Leapfrog's dodge needs every turn in one process; a paper needs many processes, which leaves each one slow (Frogspawn, Shield Swarm's copies). A one-process body loses to papers however well it shoots (Bullfrog, Battleship); four bodies at least tie them (Scanner Swarm).
4. **Your own weapons are a hazard in 3D.** A clear stuns its own imp (Queen Imp); sibling copies clear each other (Frogspawn); two processes sharing one counter drift apart after a move (Dodging Queen).
5. **Mixing two jobs in one warrior costs more than it gains; switching between rounds doesn't.** Every two-job hybrid here scored below its best parent. Volume Chameleon, which plays one strategy per round and switches with P-space, is the best on 80×10×10.
6. **Geometry traps to remember:**
   - Addresses and ADD work per axis; DJN, `>`/`<` pointers and comparisons count as plain numbers. A sweep that counts goes through rows in order; a step that adds stays in its row.
   - A body that straddles the end of its row still runs, but in number order it's two pieces, so a number-order guard (a sweep that stops at a marker) can miss the stray piece (the random-hop Leapfrogs clear themselves at cycle 71,554).
   - `ADD.AB #v, x` changes x's **B**-field; to steer a value in x's A-field, use `ADD.A`. Slant does it the "wrong" way, and its accidental chains beat the intended steering (Scatter, in the library).
7. **Evolution finds 3D tricks but not yet a better strategy.** It rediscovers the depth imp and builds 3-axis hybrids, but its champions keep converging on the two-process clear. Directions still open: a fitness that rewards beating clears, scoring on several volumes at once, and larger volumes where a full sweep takes long enough for other strategies to matter.
