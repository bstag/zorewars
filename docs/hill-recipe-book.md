# Hill recipe book: how the Koenigstuhl 94nop warriors are built

Review date: 2026-10-30. This book covers the 1,106 warriors on the Koenigstuhl 94nop recursive hill (ICWS'94, core 8000, length up to 100 on that hill, no P-space). It lists the parts they are built from, the order those parts run in, and how the parts hand control, processes and cells to each other. 1,099 of them compile under our engine. Every warrior was tagged automatically, and about 120 were then read line by line, many of them also run alone in our engine to see how they behave. The automatic tags are in [hill-recipe-index.json](hill-recipe-index.json) and come from `node scripts/hill-recipes.js`.

The book has three parts:

1. A census of which parts appear at which ranks.
2. The anatomy all strong warriors share, and ten recipe cards for the designs that hold the top of the hill.
3. Six family chapters (openings and boots, papers, paper/stone, stones and stone/imps, scanners/oneshots/clears, vampires and outliers), each with ingredients, Redcode skeletons, the method step by step, the variants seen on the hill, and how they map to our [block algebra](block-algebra-catalog.md). A consolidated list of the techniques we have no block for closes the book.

Ranks are from the published recursive table retrieved on 2026-10-30. They are not our own measurements. Matchup figures quoted in the chapters are small local checks (100 rounds, one seed), not hill results.

## Census

### Parts by rank band

Share of warriors in each band carrying each part. The automatic tagger reads the warrior's comments and looks for code shapes: unrolled SNE/SEQ runs, `SPL @0` silk, an imp step with N·step ≡ 1 (mod 8000), a tight clear loop, runs of non-empty DATs.

| Part | ranks 1-50 | 51-200 | 201-500 | 501+ |
|---|---:|---:|---:|---:|
| quickscan | **86%** | 76% | 57% | 13% |
| stone | 67% | 44% | 44% | 48% |
| paper | 51% | 38% | 36% | 28% |
| core clear | 39% | 56% | 57% | 55% |
| boot | 37% | 19% | 19% | 10% |
| imp | 35% | 44% | 32% | 29% |
| scanner (sustained) | 33% | 36% | 38% | 30% |
| decoy | 14% | 9% | 20% | 13% |
| oneshot | 4% | 10% | 9% | 3% |
| vampire | 4% | 4% | 3% | 9% |
| median length | 100 | 100 | 100 | 29 |

The readers found the tagger right about the broad picture and wrong on many individual warriors (each chapter lists its corrections). The most common errors: comments that mention a part the warrior lacks ("anti-imp", "anti-vamp", "not fooled by decoys"), quickscans with no comment, stones and imps inside a paper's tail, and boots the tags miss. Read the shares as approximate. The quickscan share in particular is a floor, since several top warriors have one with no comment and no SNE/SEQ run long enough to trigger the code test.

Three things stand out:

- **The quickscan is the price of entry.** 42 of the top 49 open with one, against 13% below rank 500. It is always a prefix, never a branch: every warrior boots afterwards whether the scan hit or not.
- **The top of the hill is long.** Every top-50 warrior is longer than 50 instructions, and the median above rank 500 is 100. The best warriors of 50 instructions or fewer are Pendulum (#62, 23 lines, scanner), Clairvoyance (#84), procoptodon (#87), Dettol E (#91), Discord (#106, 15 lines) and Grendel (#166, 10 lines): scanners, clears and oneshots. Under our `--length 50` tournament profile the paper/stone and stone/imp designs need shrinking; the scanner and oneshot recipes fit as they are.
- **Nobody near the top kills itself.** Every warrior in the top 500 survives a solo run except three; below 500, 47 do not. The shortest top-50 warrior is 81 lines.

### The common combinations

Parts are counted together here, ignoring decoys and stun bombs. Most rows are exact combinations; the rows that say "any" or list extras group related ones. "Best" is the highest-ranked member of the combination.

| Combination | Warriors | in top 50 | in top 200 | Best |
|---|---:|---:|---:|---|
| qscan + paper + stone | 29 | 10 | 16 | Azathoth (2), DanceOfFallenAngels (13), luca (17) |
| qscan + paper | 39 | 5 | 12 | Ziggy (16), pdQscan (20), Borg (25) |
| qscan + stone + imp | 22 | 5 | 11 | Last Judgement (36), Nightstalker (40), Red Dragon (45) |
| qscan + boot + stone + clear + imp | 11 | 3 | 9 | Armadillo (33), Elven King (42) |
| scanner + clear | 72 | 3 | 11 | Kusanagi (21), Z++ (35), Discord (41) |
| qscan + scanner + clear | 23 | 1 | 15 | Ghost Murmur (12), Arrow (52) |
| qscan + paper + imp | 32 | 1 | 14 | For John (43), LuckyMisfortune (60) |
| qscan + boot + paper + stone (any extras but imp/clear) | 16 | 5 | 9 | Arvon (1), pst_v4 (3), The Collective (5) |
| any oneshot | 65 | 2 | 17 | King Cobra (4), Kaitain (7), Digeridoo (64) |
| clear (blur scanners mostly) | 64 | 0 | 3 | HazyLazy A 70 (53), procoptodon (87) |
| stone + clear (no imps) | 41 | 0 | 0 | Fuse (273), Tornado 4 (397) |
| paper alone | 41 | 0 | 0 | paper01o (572), minotaur (584) |
| imp alone | 20 | 0 | 0 | Rosebud (305; really a stone/imp) |

Lineage concentrates the top: John Metcalf has 18 of the top 100, Roy van Rijn 15, inversed 12, Christian Schmidt 8. Arvon (#1) and pst_v4 (#3) are retunes of Azathoth (#2): the same boot, stone and paper with a different quickscan. Kaitain (#7) is King Cobra's (#4) body behind Azathoth's quickscan. Counting them separately would overstate how many independent designs reach the top.

## The anatomy every strong warrior shares

Read across the families, the strong warriors are built in five layers, and the families differ mainly in what fills layer 3.

```
1. opening   quickscan: ~25-40 fixed cells in ~15 cycles; on a hit a two-stream DAT burst
             (~30-40 bombs over ~150 cells), then fall through either way
2. deploy    boot the body 800-7000 cells away; the original image stays as a decoy
             (fan boot: N processes copy one cell each, copy pointers = jump vectors)
3. body      paper | stone | paper + stone | scanner | oneshot | vampire
4. insurance imps (tie instead of lose), a second body, a DJN stream left behind,
             an imp spun off at the find
5. endgame   a core clear, usually SPL then DAT, that never runs over its own code
```

The same small tricks recur in every family. They are what separates the top 50 from the warriors below, more than the choice of body:

- **One cell, two jobs.** Quickscan decode tables live in the B-fields of the boot's `spl 1` lines. The scan step doubles as the wipe bomb (`inc spl #STEP, STEP`). The paper's first A-field is the boot's copy counter: eight predecrements turn `spl @8` into the working `spl @0`. The stone's bomb A-field is its second pointer.
- **Self-metering boots.** N processes run each copy line once, and the copy pointers become the jump vectors, so the launch finishes exactly when the copy does. A `djn ..., #N` counter splits the processes: N-1 to the stone, 1 to the imp or paper.
- **Planned self-damage as a timer.** Stones start their pointer at `-STEP*TIME` so their own trail comes home after TIME passes. Then either the stone stops (paper/stone), or the wreck becomes a one-cell-per-process clear because the bomb `dat X, >1` lands on the stone's own ADD (stone/imp). Scanners start at `-STEP*TIME` too, and finding themselves is the cue to switch to the clear.
- **Bombs that steer.** A clear's DAT carries a B-field (`HOP+1`, `DSAFE`, `dcgap`) that throws the pointer past the clear's own code when it laps the core. The anti-imp `dat <2667, <5334` breaks a 3-point ring when an imp runs into it, because '94 evaluates DAT operands before the process dies.
- **A DJN stream as a clock.** In King Cobra-style clears the stream's counter is the pass timer: after about two laps it decrements the bomb selector, and the clear flips from SPL to DAT.
- **Switching inside the round.** With no P-space, what the round itself reveals picks the next phase: a quickscan hit (Alternating Raisins picks paper or scanner), a prisoner arriving in a vampire's pit, a self-find count, an airbag cell turning non-zero.

## Recipe cards

Each card is one design that holds a top-100 place, with its ingredients in running order. Chapter references point to the full mechanism.

**R1. Paper/stone (Azathoth line).** Q^4 or lattice quickscan → 6-process fan boot copying both bodies (copy pointers = vectors) → 18 stone + 6 paper processes → "Quicksilver" stone (2 writes + 1 decrement per 4-line loop, coprime step, bombs its own pointer after TIME passes) alongside a 3-stream silk → after the stone stops, the paper is the warrior. *Azathoth #2, Arvon #1, pst_v4 #3, Hullabaloo #14, DofA #13.* Beats scanners and oneshots; weak against stone/imp. Chapters: openings, paper/stone.

**R2. Stone/imp.** Q^4 quickscan with its tables in the boot's SPLs → 6-process boot, `djn #6` sends 5 to the stone and 1 to the imp pump → remote-bomb two-pointer stone with a folded DJN stream → continuous 3-point imp pump (step 2667) → after TIME passes the stone bombs its own ADD and the wreck becomes a core clear. *Last Judgement #36, Nightstalker #40, Red Dragon #45, Quicksilver #50, Uninvited #59.* Variant: Armadillo-type self-copying stone whose SPL lands on its DJN and floods a gated forward clear (*Tolypeutes #6, Armadillo #33, Elven King #42*). Chapter: stones.

**R3. Oneshot.** q^i quickscan → boot a 10-cell engine → scan two adjacent pairs per loop (drop finds where only one cell differs: that is a bomb, not a body) → on a real find, start the clear at the scan pointer and spin off a `mov.i #4000,1` imp → SPL/DAT clear whose DJN stream flips SPL to DAT after about two laps. *King Cobra #4, Kaitain #7, KryneLamiya #133, Infravision #123.* Chapter: scanners.

**R4. Agony pair scanner.** Optional quickscan → boot → compare pairs GAP apart, STEP coprime to 8000, with a self-distance test → wipe a fixed 8-16 SPLs at each find and scan on → switch to a gated d-clear when the timed pointer wraps, or when a wipe reaches the scanner. *Excalibur #10, Kusanagi #21, Eternal Exile #23, Discord #41.* Many SPL decoys with mixed modifiers make it hard to scan back. Chapter: scanners.

**R5. Blur scanner.** A mod-10 step (one residue class, about 800 cells a lap) → one SPL per loop at a carpet pointer that jumps to each new find → d-clear with `dat <2667`. *Twin Storms #31 (two booted blurs), Perseus #32, HazyLazy A 70 #53, The Machine #154.* Chapter: scanners.

**R6. Quickscan paper.** Quickscan → fan out to 6 or 8 → boot two different papers (8 processes each) or spread over 2-4 sites core/N apart → silk stages, then a tail of anti-imp bombs, a backward cc clear or silk-imps (last step = imp step + 1). *pdQscan #20, SnowScan #37, For John #43, LuckyMisfortune #60, Swarm #82.* Chapter: papers.

**R7. Counted-copy bombing replicator ("LP paper").** One process runs a Mice-style counted copy with a doubling bomb pointer (`add <0,>0`) inside the loop; 2-37 processes only. *The Collective #5, Borg #25.* Chapters: papers, paper/stone.

**R8. Scanning vampire.** Scan one side, fang the other; the fang's A and B fields move in opposite directions so they always sum to the pit → pit (stun, leaky DJN or counting) → the first prisoner trips the switch → SPL/DAT clear. *Forgotten Lore II #9, Carmilla #46, Unpit #63 (no pit: the fang kills and signals).* Chapter: vampires.

**R9. Tiny fast scanner.** No boot, no quickscan: a .75c three-probe loop with step 17, wipe-until-empty, and a self-find counter that flips the wipe from SPL to DAT. 13-23 lines. *Pendulum #62, Xenosmilus #48 (with a quickscan), Herald #51.* The strongest recipe that fits 50 lines. Chapter: scanners.

**R10. Airbag stone → clear.** A stone whose loop test reads a cell that stays zero until something hits it; on a hit, abandon the stone for a booted clear. *Viva La Bomba #307, airBag #520, Fort Destruction #93.* Mid-hill only. Chapter: stones.

## Openings and deployment

On this hill the opening is what runs between cycle 0 and the moment the main body starts its loop. In the top 50, 42 of 49 warriors (86%) open with a quickscan: an unrolled run of SNE/SEQ tests over 24 to 40 fixed cells, then a short bombing run at whatever it hit. After that they boot the body away from the original image, which stays behind as a decoy. The quickscan punishes long, slow-starting warriors (big papers still copying, oneshots still scanning, stones still booting) by hitting them before they spread. Small or fast-moving warriors get little from it. The boot that follows is what decides whether the warrior survives a quickscan itself.

### Ingredients

**1. Pair test (detection unit).** Three lines test four cells for about two cycles when nothing is there: SNE skips when its pair differs, SEQ skips when its pair is equal, so empty core falls through both and the JMP is never reached.

```
        sne   BASE+L1,     BASE+L1+GAP     ; pair 1 differs -> skip to jmp
        seq   <TABLE,      BASE+L1'+GAP    ; pair 2 (also mutates TABLE)
        jmp   DECODE,      }SELECTOR       ; hit: pick a table entry, go
```

The cost is two cycles per four cells, or one cycle per two cells in SEQ-only form (Luca, Uninvited). Tolypeutes gets 34 locations into 27 lines this way: seven SNE/SEQ/JMP units (28 cells) and three SEQ/JMP pairs (6 cells). The trace I ran on Hullab3loo shows its 33-cell scan ending at cycle 16, when control passes to the boot.

**2. The q^4 decoder (Azathoth, Arvon, Kaitain, Hullabaloo, Halcyon, Elven King, Numb, Positive Knife).** This one carries most of the hill. Every location is `qptr + qdec*X`, where X is a table entry. The constants satisfy `qdec = 1 + qfac^-1 (mod 8000)` and each entry is `X = 1 + qfac*(t - qptr)`, with t the address of the cell holding X. From that, `qptr + qdec*(X-1) = t + X - 1`. So the SEQ's A operand `<t` decrements the table entry to X-1 and lands on exactly the second scan location. One instruction both tests location X-1 and records which of the unit's two locations fired. The constants check out: Azathoth 1533·2197 ≡ 1, Arvon 163·1227 ≡ 1, Hullabaloo 243·2107 ≡ 1, Hullab3loo 5931·3971 ≡ 1. Numb computes the inverse in the assembler with pMARS register arithmetic.

```
dec     mul.b  *sel,   qptr        ; qptr.B = qdec * chosen table entry
        sne    <ZERO,  @qptr       ; first cell of the pair empty?
        add.b  gaptab, qptr        ;   then aim at the other cell
loop    mov    bomb,   @qptr       ; stream 1
qptr    mov    bomb,   *QDEC       ; stream 2: target + bomb's own A field
        add    #STEP,  qptr
        djn    loop,   #TIME
        jmp    BOOT
bomb    dat    GAP2,   X           ; A field (-67..-87) offsets stream 2
```

The table entries are the B fields of instructions that exist for other reasons. In Azathoth and Arvon they are the scan's own last JMP/DJN (`djn.f warr, <qb` is both the no-hit exit and entry qb) and the decoder's exit (`djn.f warr, <qc`). In Hullabaloo, Tolypeutes, Elven King and pdQscan they are the B fields of the boot's `spl 1, <qb1` fan. The hit unit's JMP picks an entry by mutating a pointer with its B operand. `}q1`/`{q1` move q1's A field to the entry above or below. `{qdecode`/`}qdecode` move the decoder's `*` operand to another instruction whose A field points at a different table. `djn.a qdecode, {qdecode` does both at once: it moves the selector and decrements that table's pointer. Because q1's A field is also the source of the pair gap (`add.b qtab1, qptr`), one mutation selects both the multiplier and the gap. A hit costs one MUL plus the 2-way choice before bombing starts. Hullabaloo, Halcyon and Elven King (they share the constants qz=2108 and qy=243) add a "qz mutation": `seq >qptr, ...` post-increments qptr's B field from qdec to qdec+1, so the following units test `(qz+1)*(X-1)` with no extra table. Those warriors call this q^4.5.

**3. q^i, two multipliers (inversed: Eternal Exile, King Cobra; pst_v4).** Here the pointer cell holds two independent factors, `found = (qxa, qxb)`. `mul @dec1, found` (.F) multiplies both fields by an entry pair (qa, qb), so each test compares two unrelated locations, A-loc against B-loc, and then both again `+qstep`. An "instant" unit needs no MUL at all, four units need one, and one unit needs `mul.x qtab, qtab` first (qa2·qb2, so "+1 cycle"). The JMPs' B operands decrement the dec1 pointer, the table, or `found` itself. To decode, `sne *found, @found` checks whether A-loc and B-loc differ (if they don't, `add qinc` moves both by qstep), then `seq nil, *found` / `mov.x found, found` swaps the fields so B points at the occupied cell. The Arvon comments call their decoder "lattice q^i", but it is the q^4 structure from part 2 with retuned constants (Kaitain even keeps Azathoth's qfac 1533 and qdec 2198), not inversed's two-factor q^i.

**4. Other decoders.** *Mini-Q^3* (Uninvited) puts the locations at `k*qs`, with k built from three factors: A=10 is the B field of the decoder's exit DJN, B=6 is the bomb's B field, and C=3 is an immediate MUL. That gives k ∈ {1, 3±1, 6±1, 9, 10, 12, 15, 18, 21, 24, 27, 30}, and a hit costs 0, 1 or 2 MULs. The first unit's `djn.f qSki, {far` skips decoding entirely. *Q3.14* (Luca) uses 20 SEQ pairs on a plain linear grid (200 apart, pair gap qhop=3800). It needs no multiplier table, because the decoder reads the scan offset back out of the scanning instruction's own A field (`add.ab @bline, bline`, after `ultra`/`fast` have moved bline 2k lines into the scan). It costs 2.5, 3.5 or 4.5 cycles, and halfway through it resets its base (`mov.ab #pos11-bline, bline`). *pdQscan* (P. Kline) is the older 40-cell, 10-entry form, with a `mov.a #pH-decode, decode` pre-entry to switch table groups.

**5. The attack after a hit.** Almost every source uses the same two-stream burst. The first MOV drops a DAT whose A or B field holds a small negative offset (−67 in Arvon and pdQscan, −75 in Luca, −87 in Hullabaloo and Eternal Exile). The second MOV addresses through that just-written field (`*` or `@`), so it lands 67–87 cells before the first, and the pointer then steps 5–9 cells. The total is 15–21 loops of 4 cycles, about 30–40 DAT bombs covering roughly 150 cells on both sides of the hit. Eternal Exile's second stream copies the empty cell the A pointer is left on (`found mov qxa, }qxb`), so it drops DAT 0,0. Numb adds a third MOV per loop and moves the two pointers in opposite directions (`sub qsub, qb` with qsub = −15, 21). None of these sources makes a SPL carpet or jumps into the target. The SPL/stun burst belongs to oneshot bodies such as King Cobra's clear, not to the quickscan.

**6. No-hit exit.** The last scan line doubles as the exit. In Azathoth and Arvon it is `qtab0 djn.f warr, <qb` (table entry plus jump to the launcher). Hullabaloo, Halcyon, Elven King, Luca and Uninvited end with `jmz.f BOOT, cell`, a free one-cell test: if the cell is non-empty, control falls into the decoder unmutated. Tolypeutes simply falls through into its boot code. Whether or not anything was found, every warrior here then boots. The quickscan is a prefix, not a branch.

**7. Self-metering parallel launcher (Azathoth, Arvon, pst_v4, Uninvited, Hullabaloo family).**

```
go      spl  2,      <D1          ; spl 2 / spl 1 / spl 1 = 6 processes
        spl  1,      {D2
        spl  1,      }D3
        mov  <p,     {p           ; each process copies 1 paper cell
        mov  <sgo,   {s           ;   and 1 stone cell
s       spl  SBOOT,  <D4          ; vectors = copy pointers: after 6 copies
        spl  *s,     {D5          ;   they point exactly at the copies
        spl  *s,     {D6
p       djn.f PBOOT, }PAPER+6     ; ...then enter the paper
```

The six processes run in lockstep, so all six copies finish before any process reaches `s`. The copy pointers are the jump vectors themselves. Each process launches 3 stone processes and then enters the paper: 18 stone and 6 paper processes from 9 lines and about 30 cycles. The B operands of the fan (`<-3828` and so on) are free decrement shots, or, in the Hullabaloo family, quickscan table entries. Uninvited meters with a counter instead: `djn sBoot+6, #6` lets five processes jump into the stone and the sixth falls through to `jmp iBoot+6` for the imp, whose copied first line `djn #0, #5` stalls before pumping imps. Hullab3loo interleaves the work, as my trace showed: each process copies a stone cell, SPLs into the stone, copies a paper cell, SPLs into the stone again and only then jumps into the paper, so the stone is bombing while the paper is still arriving. It also self-modifies its fan: `spl }2` turns the `spl 0` two lines down into `spl 1`, which caps the fan at 6. Halcyon and Numb use a looped variant: `spl 2 / spl 2 / spl 1`, then `mov <src, <dst` and `djn @bBoot, #5`, with the last process leaving through `jmp wGo` to the paper's own boot.

**8. Serial boots and pointer wiping.** The Collective uses a plain 10-MOV unrolled copy and a JMP. Eternal Exile unrolls 4 per loop (entered halfway so 14 cells take 2+3·4 MOVs). Kaitain copies two bodies at once from both ends (`mov {from, {bt` / `mov <from, <bt`, 6 loops). After the launching SPL, Eternal Exile, Kaitain and Silver Talon erase the boot pointer (`mov.i #0, {0` overwrites `bp`, or `mov 0, bp`) and let the boot process die on a DAT. A scanner that later finds the abandoned image cannot follow the pointer to the copy. Excalibur SPLs into its copy after 11 of 16 MOVs and finishes the last 5 while the copy is already running. That works because the scan loop is copied first and the copy runs only every other cycle.

**9. Decoys.** The abandoned image (qscan, launcher, padding) is the main decoy in nearly all of these. Explicit decoys are less common. Excalibur has 51 lines of `spl.<mod> #1, 1` with every modifier, so neighbouring cells always differ. Silver Talon uses 72 SPLs with varied B modes, including a "transparent" `spl #-4, #1`. Forgotten Scanner's decoy costs no lines: `mov.i {place+k, #0` changes eight empty cells 3000 away through the pre-decrement and post-increment side effects, and also overwrites each decoy-maker line with the copied empty cell.

**10. Bomb detection.** None of the top-ranked quickscanners does this. Argon (rank 563) is the clearest case: after a hit it checks the neighbour (`jmz.f silk, <ptr`). An isolated non-empty cell means a stone's bomb, so it switches to booting a silk paper. A cell that matches its decoy signature means scan again. Anything else gets a clear. The Boss is back has a per-step `sne *gate, @gate` "bomb check" in its scan loop, which belongs to the scanner body, not the opening. Azathoth's "sleeping chaos" is flavour text: its code has no dormant phase.

### Method (the steps)

1. Execution starts at the quickscan (`org qscan`), placed at the far end of a 100-line image. 20–50 lines of `dat 0,0` padding separate it from the launcher and bodies. The sources don't say why; my guess is that one q-burst or bomb is then less likely to hit both.
2. The scan runs for about 12–17 cycles with one process. On the first differing pair, a JMP enters the decoder and its B operand mutates the selector.
3. The decoder needs 1–3 cycles (MUL, then pick a cell of the pair). A burst of 15–21 two-bomb loops follows (60–85 cycles), then a jump to the launcher.
4. With no hit, the last scan line jumps or falls to the launcher at once.
5. The launcher fans out to 6 processes (or loops), copies the paper and stone to `warr+843` and `warr+3200` in Azathoth/Arvon, or `sAway`/`pAway` in Hullabaloo, and SPLs processes into each copy. The vectors are the copy pointers, so the launch completes when the copy does.
6. The original image is never cleaned up. Its stale code, the decoder's table and the bomb cell remain as decoys. Only the single-body boots (Eternal Exile, Kaitain, Silver Talon) wipe their pointer.
7. The bodies take over: the stone and paper in their own regions, or a oneshot scan in Kaitain and Eternal Exile. Each copy region was chosen so the stone's step never lands on the paper's copy. Nothing in the opening coordinates the endgame. That belongs to the bodies.

### Variants on the hill

| rank | warrior (file) | author | variant |
|---|---|---|---|
| 1 | Arvon (arvon.red) | Kammann & Forge-AI | q^4 table decode (qfac 163, qdec 1228, 24 cells, 15×2 burst gap −67) → 6-process self-metering launcher → silk + stone |
| 2 | Azathoth (azathoth.red) | John Metcalf | Origin of the Arvon line (qfac 1533, 21×2 burst gap −80). Tags miss qscan and boot |
| 3 | pst_v4 (pst_v4.red) | Kammann & Forge-AI | Eternal Exile's two-factor q^i + Azathoth launcher. "scanner" tag is wrong |
| 4 | King Cobra (kingcobra.red) | inversed | q^i over products (qa0·qa2 …), 7 two-pair and 3 single-pair units → boot oneshot |
| 5 | The Collective (thecollective.red) | Roy van Rijn | Tolypeutes' 34-location scan → unrolled 10-MOV boot of an LP paper |
| 6 | Tolypeutes (tolypeutes.red) | Roy van Rijn | 34 locations / 27 lines, all >100 apart. Tables in the stone/imp boot's SPL B fields. "scanner" tag is wrong |
| 7 | Kaitain (kaitain.red) | Kammann & Forge-AI | Azathoth constants → two-ended boot of oneshot + clear, pointer wipe. No imp code despite the tag |
| 8 / 14 | Hullab3loo / Hullabaloo | Roy van Rijn | q^4.5 (qz mutation + final JMZ, 33 cells), interleaved stone/paper launcher, self-modifying fan. Hullab3loo is tagged only qscan |
| 10 | Excalibur (excalibur.red) | inversed | No qscan: 51-line SPL decoy, early-SPL boot, "mirror" copies of the tail (purpose unclear; probably extra decoy) |
| 16 | Ziggy (ziggy.red) | Roy van Rijn | Hullab3loo's opening and launcher with a different paper. Tags miss boot and stone |
| 17 | luca (luca.red) | Sascha Zapf | Q3.14 (20 linear locations, offsets read from the scan lines) → Hullab3loo launcher |
| 20 | pdQscan (pdqscan.red) | P. Kline | 40-cell, 10-entry table scan, −67 second stream, tables in the paper boot's SPLs |
| 23 | Eternal Exile (Eternal_Exile.red) | inversed | Two-factor q^i, 20×2 burst → unrolled boot, pointer wipe |
| 34 / 42 | Halcyon / Elven King | van Rijn / Schmidt | Hullabaloo's q^4.5 constants → looped parallel stone boot (Halcyon) or imp+stone launcher (Elven King, qtime 14) |
| 39 | Numb (numb.red) | Roy van Rijn | q^4, assembler-computed inverse, 3-bomb loop with diverging pointers. The "decoy" tag comes from a comment; there is no decoy code |
| 47 | Positive Knife | Ken Espiritu | Compiled q^4 (8 units) → stone/imp. The "paper" hint is wrong |
| 59 | Uninvited (uninvited.red) | John Metcalf | Mini-Q^3 (A·B·C products), counter-metered 5 stone / 1 delayed imp |
| 132 / 258 | Silver Talon / Forgotten Scanner | Edgar / David Moore | 72-SPL varied decoy + 10-MOV boot with pointer erase; side-effect decoy maker |
| 563 | Argon (argon.red) | Fizmo | Post-hit bomb/decoy classifier choosing paper, rescan or clear |

### How it fits

The quickscan pairs with papers and stones. A paper can spare 12–100 cycles before it starts replicating, and the burst cripples slow starters: oneshots and scanners still in their first lap, stones still booting, big papers mid-copy. Against another quickscanner it is a race won by the first mover. Against small imps or silk it rarely finds anything useful, and against fast replicators the burst only kills one copy. The boot answers the opponent's quickscan. The body leaves the cells its enemy's scan tables are likely to hit (around the image), and the remains become decoys that waste the enemy's burst. The parallel launcher also means a single bomb on the launcher cannot stop the launch, since the other five processes still finish it.

Failure modes visible in the code: a scan location inside the warrior's own image would decode onto itself, so Tolypeutes spaces all 34 >100 apart and our gate checks the same. Self-metering needs all processes in lockstep, so a launcher hit mid-fan can leave the copy pointers short, and the jump then lands on a half-copied body. Stone and paper copies must sit where the stone's step never reaches the paper. In Arvon and Azathoth these are fixed offsets (843 and 3200) tuned together with sstep 2431. The two-stream burst covers about 150 cells, so a decoy-laden opponent (Excalibur) absorbs it.

### Our blocks

| Hill part | Our block(s) | Difference / gap |
|---|---|---|
| Pair-test detection | `opening-quickscan`, `opening-qscan-decode` (SEQ+MOV per pair), `opening-qscan-lattice` (SNE/SEQ/JMP, 4 cells per 3 lines) | Detection density matches; the lattice block has the hill's 3-line unit |
| q^4 / q^i MUL decode | `opening-qscan-mul` | **Mostly built.** `opening-qscan-mul` is the single-factor q^4: `qdec = 1 + qfac^-1`, an inverse-constant table, a one-MUL hit decode, and (SHARE 1) the table stored in other instructions' B-fields. Remaining gap: the q^4.5 qz-mutation and inversed's two-factor q^i (more locations per cycle). `opening-qscan-lattice` is the loop-decode fallback (~4 cycles a pair) |
| Tables stored in other code's fields | none | **Gap.** Our blocks keep private data cells; the hill reuses the boot's SPL B fields and the scan's exit DJN as the table, which our block contracts can't express |
| Two-stream burst | `probe-burst` | Ours is one guarded stream (≈5 cycles a bomb). The hill's second stream addresses through the bomb it just wrote: 2 bombs per 4 cycles |
| Final JMZ test / fall-through exit | none needed (`seq` hand-on) | Free extra cell missing |
| Self-metering parallel launcher | `waveboot` recipe (`parboot` of `par`), `parboot` | **Partial.** `parboot` uses K independent copy loops; the hill uses N lockstep processes, one cell each, with copy pointers as SPL vectors and a DJN counter splitting processes between bodies (5:1, 3:1). No interleaved copy-and-spawn as in Hullab3loo |
| Serial / unrolled boot | `boot` (UNROLL 1–4), `boot-paper`, `relocate` | Unroll above 4 (The Collective: 10) and two-ended copy are missing |
| Boot-pointer wipe, early SPL into a partial copy | none | **Gap** (cheap: 1–2 lines) |
| In-image decoy | `decoys` (DECOY 2 = SPL with varied fields) | Capped at 18 cells; Excalibur uses 51 and Silver Talon 72 |
| Remote decoy | `decoy-maker` | Ours writes a junk cell in a loop; Forgotten Scanner gets its decoy from addressing side effects and hides the maker |
| Bomb/decoy classification after a hit | `classify` (reacts to what hits *our* marker) | **Gap**: nothing classifies the *found* cell (Argon: isolated bomb → paper) |

## Papers (replicators), alone or with imps

A paper copies its few cells somewhere else in the core and starts processes in the copy. Each copy does the same until the process table (8,000) is full. Bombs and clears kill copies one at a time, and the copies come back faster than they die, so on the 94nop hill a paper is the anti-stone: it ties or beats bombers and clears. It loses to scanners and to papers with stronger anti-paper tails. Pure papers win few rounds outright: most of their points are ties. The families below add something that kills. Bombing lines and "cc" (core-clear) tails make the copies dangerous. Imp tails turn the leftover processes into imp spirals, which keep stones from scoring and catch the ties that a paper would otherwise give away. In the top 50, 25 of 49 warriors carry a paper. By tag combination: `qscan+paper` has 39 warriors, best 16th; `qscan+paper+imp` has 32, best 43rd; `paper+imp` without a quickscan has 13, best 485th; `paper` alone has 41, best 572nd. Nearly every paper in the top 200 has a quickscan in front, often an uncommented one (SnowScan, Froth and Fizzle).

### Ingredients

**1. Process fan-out (the launcher).** A silk stage copies one cell per process that passes through it, so the number of processes is chosen to equal the number of cells copied.

```
go    spl 1          ; 2
      spl 1          ; 4
      spl 1          ; 8   -> an 8-cell paper
; or, for a 6-cell paper (SnowScan, Froth and Fizzle, pdQscan, Mercenary):
go    spl 2          ; P0 -> next, P1 -> third line
      spl 1
      spl 1          ; 6 processes
```

Cost: 3 instructions. Ziggy saves a cell: `spl }2` against a `spl 0` two lines down. The `}` turns that `spl 0` into `spl 1` as it splits, giving the same six processes. Swarm launches 8 processes and then splits them unevenly (`spl iBoot` after two `spl 1`s): 8 go to one paper and 4 to another. The 4-process paper has two `mov` lines per stage, so 4 processes still copy 8 cells. The B-fields of these `spl` lines are usually free. Every qscan-fronted paper in the set stores its quickscan table there (`pGo spl 1, <qb1` in Yorba, Devilstick, Human Machine; `tG spl 2, }qG` in SnowScan). When those lines run, the `<`/`}` operands also do a little damage far away.

**2. Boot (copy away, leave a decoy).** The paper body is copied backward with a predecrement and the processes split or jump to the copy. The original stays behind as a decoy.

```
      mov  {paper, {dst     ; each process copies one cell; paper.A counts down
dst   spl  paper+HOP, 0     ; dst.A counts down too, ending at the copy's start
      ...                   ; (or jmp / djn.f to the copy)
paper spl  @LEN, >STEP      ; A starts at LEN; the boot leaves it at 0
```

The neat part is that the boot uses the paper's own first A-field as its source counter. Eight predecrements take `spl @8` down to `spl @0`, which is exactly the silk instruction (For John, Devilstick, Shadowfax, Electra, Mercenary). With `spl dst` the processes split, so half run the copy and half run on into the next boot. That is how For John, Devilstick, LuckyMisfortune, Swarm and Electra start two different papers with 8 processes each. Shadowfax and pppc boot the same paper twice (6000 and 2000 away). The Human Machine copies its copy a second time, 235 further on.

**3. Parallel launch (Froth and Fizzle, pdQscan, SnowScan).** No boot to one place: the 6 processes are doubled across sites.

```
      mov  <cp, {cp          ; 1 + 6 cells copied
cp    spl  body+4000, body   ; 6 stay, 6 go 4000 away
body  mov  <1, {1
      spl  2000, 7           ; each site splits again, 2000 away
pap   spl  @0, >STEP ...
```

Solo run (checked): Froth and Fizzle has 6 processes at each of 0, 2000, 4000 and 6000 by cycle 80. SnowScan instead runs two copy groups that share one pointer (`mov <pAj,{pAj` and `mov @pAj,{pBj`). It ends with 6 processes at each of three sites about 2667 apart (core/3), and Mercenary with 6 at each of two sites 4001 apart.

**4. Silk stage (the copy engine).**

```
s     spl  @0, >STEP     ; split to s+B (the copy)
      mov  }s, >s        ; copy cell s+A to s+B, then A++ and B++
```

Each of N processes splits once and copies one cell. All N splits run before the first `mov`, so every child lands on the copy's first cell, which the first `mov` has just filled. The copy's spl was copied while its B was still STEP, so every generation copies at the same distance. Cost: 2 cells, 2 cycles per process, and the process count doubles each pass. The `>STEP` operand also increments a cell STEP away, a free one-point "bomb". Blackheart writes the stage the other way round, `spl STEP, 0 / mov >s, }s` (A = destination and split target, B = source). That is the order our `paper` block uses.

**5. Backward stage (Timescape-style), stage 2 or 3.**

```
s1    spl  @0, >STEP1
      mov  }s1, >s1
      mov  {s1, <s2       ; copy the body again, last cell first
s2    spl  @0, >STEP2     ; B was decremented N times: lands in the new copy's s2
```

This stage reuses stage 1's A-pointer, which now points past the body, so no new source pointer is needed. Its step drifts by N per generation, because the stage cell is copied after its B has been decremented. Several papers end with a stage that moves processes instead of splitting them: `jmz.a @0, STEP3` (minotaur, For John's second paper) or `djn.f @0, }STEP3` (Electra). The processes jump into a third copy and the old copy is left empty.

**6. Bombing lines (the tail every process runs once per copy).**

```
      mov  bomb, >BSTEP          ; a DAT carpet, one cell per process
      mov.i #X, }2667            ; drops itself one 3-point imp step away
bomb  dat  <2667, <5334          ; anti-imp DAT
```

The anti-imp DAT works because '94 evaluates a DAT's operands before the process dies. An imp process that runs into it decrements the B-fields of the cells 2667 and 5334 on, which are the other two points of a 3-point imp ring. That bends the ring's imps off course. Variants: `dat <5334,<2667` (Electra, Ziggy), `dat >1,}1` (For John), `dat 1,1` (minotaur). `mov.i #6000-1-2667, }2667` (Froth, pdQscan) and `mov.i #-2668-pInd, }pInd` (SnowScan) write the instruction itself at a pointer that walks one cell per process. The 2667-based constants suggest it is aimed at 3-point imps, but I did not verify what it does to a running ring. `mov.i STEP2, }STEP3` (For John) moves a far cell somewhere else, a scatter bomb.

**7. Core-clear tail ("cc paper").**

```
      mov.i #K, <1      ; writes this line into the cell below the pointer
cc    djn   -1, <FAR    ; Shadowfax/Devilstick: loops until a far cell counts down to 0
;     djn.b -1, #N      ; pppc/Swarm: N laps, then the process falls into a DAT and dies
```

This is a backward clear that every process joins after its last stage. Its bomb is the clear's own MOV line, not a DAT. A process that runs it does not die there; the clear destroys by overwriting. pppc counts its laps with `#cstep2` (539), so its clear processes die and free table slots for new copies. Shadowfax's `<2335` keeps decrementing a far cell and runs for thousands of laps.

**8. Imp tails.** Three different mechanisms share the "imp paper" label.

- *Silk-imps* (Blackheart, LuckyMisfortune, Electra): the last stage's step is the imp step plus one (`spl @0, <2668` / `}2668`), and the body ends with `imp mov.i #x, 2667`. Each process that runs the imp writes it at imp+2667, which is the cell just before the next copy's imp. Processes that walk into a run of imps keep crawling. Checked solo: Blackheart has 1,350 processes on `MOV.I #x, $2667` cells at cycle 60,000, and about 2/3 of them have an imp in the next cell. LuckyMisfortune has 1,066 at cycle 79,000. Electra has 200-370, because only one of its two papers carries imps.
- *Moving imp* (Mercenary's "silk-imps"): the paper ends with `mov.i #3340, }659`. The written copy lands 659 cells on plus the A-field found there, and the `}` increments that A-field, so successive writes fan out. Solo, this line is the main activity: 2,371 of 5,097 processes are on it at cycle 30,000, and variants #3341-#3348 appear as A-fields get incremented.
- *Imp launcher carried by silk* (For John, Devilstick, Swarm, Burning Metal): a one-stage silk copies a stone/imp launcher with it.

```
pap   spl  @0, >STEP          ; copies the 8 cells below each pass
      mov  }pap, >pap
loop  spl  #0                 ; endless process source
      mov  bomb, >ptr         ; bomb at ptr.B
      add.x imp, ptr          ; ptr.A += ISTEP, ptr.B += SSTEP-1
ptr   jmp  imp-ISTEP*8, >SSTEP-6   ; vector launch onto the spiral
bomb  dat  >1, }1
imp   mov.i #SSTEP-1, ISTEP   ; ISTEP 1143 = (8000+1)/7, or 2667 = (8000+1)/3
```

The `add.x` steps both halves of `ptr` at once: the A-half walks the launch point along the spiral and the B-half walks the bomb. The first few launches land on empty cells and die, until the jump reaches `imp`. After that, each new process joins the spiral where the last imp copied itself. Swarm and Burning Metal use `djn.f` instead of `jmp`, so the loop also leaves a decrement stream behind it.

**9. Counted-copy replicator (Borg, The Collective: the "LP paper").** No silk. One process runs a Mice-style counted loop, and the same loop bombs:

```
cnt   mov  #LEN, #N        ; when run: resets its own B to LEN
copy  mov  <cnt, <dst      ; one cell per lap, last first
bptr  mov  <A0, B0         ; scatter: copies a far cell elsewhere
      add  <0, >0          ; add.f: doubles bptr's two fields each lap
      mov  bomb, }bptr     ; bomb at bptr.A, A++
      jmn  copy, cnt
      spl  >cnt, >4000     ; restart the factory at cnt
dst   jmz  @0, STEP        ; then jump into the copy if its counter cell is 0
bomb  dat  }1, >1
```

`add <0,>0` predecrements its own B to -1 and adds the cell above (bptr) to itself, then restores B. The bomb pointer therefore doubles every lap, plus one from the `}`: a pseudo-random bomb walk. The first copy moves 9 cells. Later ones reset the counter to 24 and copy 15 cells from beyond the body as well, empty in the original, so each new copy also wipes the cells at its destination. That is my reading of the code; the 24-cell copies match what Borg's solo run writes (6,277 cells touched by cycle 30,000). The process count stays tiny: 2, 8 and 37 processes at cycles 300, 3,000 and 30,000. A scanner finds few targets, a clear meets copies spread far apart, and the 8-process LP hill does not stop it.

### Method (the steps)

1. **Quickscan (most top papers).** The qscan runs for 20-60 cycles; on a hit it bombs and then jumps to the launcher. With no hit it falls through to the same launcher. The quickscan's tables sit in the launcher's B-fields and in `dat zero-1, qa1` cells inside the decoy padding (see the openings chapter).
2. **Fan out** to 6 or 8 processes (3 cycles), or to 12 split 8+4 (Swarm).
3. **Boot or spread.** Either copy one or two paper bodies away (8 cycles per body, one cell per process) and split or jump the processes into them, or double the processes across 2-4 sites core/N apart. Papers that boot two bodies send 8 processes into each. The original image stays behind as a decoy. pppc and Paper Dreaming also pad the image with empty or `dat -launch,1` cells.
4. **Copy in stages.** At each splitting stage every process leaves a child in a new copy, so the count doubles per stage: 8, 16, 32... Children reach their copy one cycle after the cell they need was written. Stage steps are tuned by optimizers. The usual constraints:
   - no step may land a copy on its own body, nor on another stage's live copy;
   - imp tails need the last step to be ISTEP+1;
   - bomb steps avoid the paper's own residue where possible (`bomb-paper` makes this exact with 80- and 16-cell grains; the hill warriors just tune it).
5. **Tail.** After its last stage each process runs the tail once: a bomb line, an imp write, or the clear. Then it dies on the DAT at the end, or loops in the clear or the imp launcher. Flow-through silks have no loop: a process lives for about 6-10 instructions, and the warrior lives on in its descendants. Looping papers keep their processes: Paper Dreaming jumps back with `jmn.f @0, {p1s`, whose `{` also rewinds the copy pointer by one per process, and the Moore-style papers in the paper/stone chapter loop with `jmz.f`.
6. **Saturation.** When the table is full the `spl`s fail and the stages only copy. Copies then keep overwriting the core (with paper code, DAT carpets, cc lines or imps), and the imp tails start to dominate. This is the endgame: solo, the silk-imp papers have about 1,000 imp processes by the end of the round. The cc papers sweep backward with their clears.

### Variants on the hill

| rank | warrior (file) | author | variant |
|---|---|---|---|
| 5 | The Collective (thecollective.red) | Roy van Rijn | Borg engine (counted copy + doubling bomb pointer, `add <0,>0`), booted 7661 away by an unrolled `mov.i` boot. Tagged `stone`, but the bombs are inside the copy loop |
| 16 | Ziggy (ziggy.red) | Roy van Rijn | qscan, `spl }2` fan-out to 6, boots a `spl #6` multi-process stone *and* a looping 6-cell paper (`jmn.b pGo, }pGo`). Really a stone/paper hybrid; the tag misses the stone |
| 20 | pdQscan (pdqscan.red) | P.Kline | 6 processes, parallel launch to 4 sites 2000 apart, 2-stage silk (forward + backward), `mov.i #..,}2667`, `mov.i >0,}0` |
| 25 | Borg (borg.red) | John Metcalf | "hybrid replicator": a counted copy loop with scatter and bomb lines; 24-cell copies; 2-37 processes solo |
| 37 | SnowScan (snowscan.red) | P.Kline | as pdQscan, but two copy groups sharing one pointer give 3 sites core/3 apart |
| 38 | Froth and Fizzle (frothfizzle.red) | P.Kline | pdQscan's paper behind a different qscan (an `aSkip` table) |
| 43 | For John (forjohn.red) | Roy van Rijn | boots two papers: a silk carrying a 7-point imp launcher and stone (ISTEP 1143), and a 3-stage paper with two bomb lines and a `jmz.a` third stage |
| 58 | Yorba (yorba.red) | Roy van Rijn | qscan, then boots a `spl #0` stone plus a 2-stage paper with a bomb line. A hybrid; tag misses the stone |
| 60 | LuckyMisfortune (luckymisfortune.red) | Nenad Tomasev | two papers: the Human Machine's 3-stage bomber body and a silk-imp paper (2668 / 2667) |
| 69 | Mercenary (mercenary.red) | John Metcalf | 6 processes, 2 sites 4001 apart, 2-stage silk, moving-imp tail `mov.i #3340,}659` |
| 74 | Burning Metal (burningmetal.red) | inversed | anti-imp paper (2 stages, two `dat <2667,<5334` carpets) plus an imp paper (`spl #0`/`add.x`/`djn.f` launcher, 1143) |
| 77 | The Human Machine (humanmachine.red) | bvowk/fiz | one evolved 3-stage paper booted twice, 235 apart; tail `mov.i #-3581,{1` / `mov.i >705,}-10` |
| 82 | Swarm (swarm.red) | Roy van Rijn | 8-process cc paper (3 stages + `djn.b #bStep2` clear) and a 4-process imp paper (two `mov`s per stage, 2667 launcher) |
| 96 | Devilstick (devilstick.red) | Roy van Rijn | Dawn lineage: a cc paper (`mov.i #1138,<1 / djn -2,<1618`) plus For John's imp paper |
| 218 | paper(paper(paper(clear))) (pppc.red) | Sascha Zapf | Shadowfax engine re-tuned by optimax, with a bounded clear (`djn.b #539`), Q4.5 and decoy padding |
| 223 | Electra (electra.red) | S.Fernandes | a 3-stage bombing paper (`djn.f @0` third stage) plus a silk-imp paper |
| 350 | Two Trick Pony (twotrickpony.red) | lain | a 2-stage cc paper plus a 4-process silk that carries a `jmz.f`-looped Moore-style copier |
| 485 | Blackheart (blackheart.red) | Ben Ford | 13 lines: silk stages in A=dest/B=src order, imp stage 2668/2667 |
| 558 | Shadowfax (shadowfax.red) | Roy van Rijn | no qscan; two boots of a 3-stage cc paper (6000, 2000) |
| 584 | minotaur (minotaur.red) | Simon Wainwright | 11 lines: the textbook 2 splitting stages, a DAT carpet, a backward stage and a `jmz.a` move |
| 645 | Paper Dreaming (paperdream.red) | P.Kline | looping 1-stage silk; `add`/`sub` rewrite each copy's bomb offsets; an 80-cell decoy |

### How it fits

- **What it pairs with.** A qscan in front, because a paper is slow to kill anything, and an early quickscan hit is free points against scanners. Decoys and the abandoned boot image soak up the scanners' first attacks. Then one of three insurances: imps (ties against everything, and they ruin stones' kill rate), a cc tail (kills enemy papers and scanners caught in the sweep), or a second, different paper. The double-boot papers mix two of these so that one counter cannot handle both: Electra, LuckyMisfortune, Devilstick, Swarm and For John. Pairing with a stone is the paper/stone chapter.
- **Matchups.** Against stones and plain clears: wins or ties, since copies outrun the bombs, and anti-imp DATs and imp tails keep the stone's own imps from tying. Against scanners: loses unless the qscan hits first, because a scanner that finds a copy stuns the processes, and an SPL carpet makes the copies' children run SPL 0 (hence "SPL-carpet resistant" silks such as Stylized Euphoria). Against other papers: mostly ties; a cc tail or a moving-imp flood decides it. Against imp spirals: the anti-imp DAT `<2667,<5334` and `mov.i #..,}2667` lines target exactly the 3-point ring.
- **Failure modes seen in the code.**
  - Steps must avoid the paper's own copies. The boot's predecrement count must equal the body length, because it is also what resets `spl @8` to `spl @0`.
  - A cc tail clears backward through the paper's own copies too. Shadowfax's clear writes its own MOV line, so a sibling copy it hits is broken, not converted.
  - pppc bounds the clear so that its processes die instead of filling the table with clear loops.
  - The silk-imp tail only forms crawling imps if the last stage's step is exactly ISTEP+1.
  - Borg's copies carry 15 cells from beyond the body, so they also carry whatever is there.
  - Processes that come back from a failed `spl` under a full table only copy. Late in the round papers stop growing and just churn, which is why pure papers tie so much.

### Our blocks

| hill part | our block(s) | notes / gaps |
|---|---|---|
| fan-out `spl 1` x3 / `spl 2,1,1` | built into `paper`, `silk3` (`sStart` SPLs) | no 6-process (non-power-of-two) fan-out; no `spl }2` trick; qscan tables in the launcher's B-fields are not modelled |
| silk stage | `paper`, `silk3`, `boot-paper` (STAGES 1-3) | same engine (our stage is `SPL STEP,#0 / MOV.I >s,}s`, Blackheart's order) |
| boot + leave decoy | `boot-paper`; `boot`, `parboot` combinators | hill boots reuse the paper's A-field as the copy counter; two different papers booted from one fan-out = `par` of two `boot-paper`s, but nothing splits a process group 8/8 the way `spl dst` does |
| parallel launch to core/3, core/4 | `copies` (N 2-4, D) | close; the hill shares one copy pointer between groups (SnowScan), we copy independently |
| backward stage `mov {s1,<s2` | none | gap: all our stages copy forward |
| moving last stage `jmz.a @0` / `djn.f @0` | none | gap: `silk3` stages all split |
| DAT carpet / anti-imp DAT | `bomb-paper` (BOMB 1 = `DAT >core/3`), `anti-imp-silk` | ours is a looping silk with one bomb a pass; the hill's is a flow-through tail. Hill uses `dat <2667,<5334` (two predecrements, both other ring points) |
| `mov.i #X,}2667` self-dropping bomb | none | gap |
| cc tail `mov.i #K,<1 / djn` | `finisher-counted`, `backward-clear` (standalone) | gap: no "tail" slot in a silk; our silk bodies end in DAT, so processes cannot fall through into a clear |
| silk-imps (last step = ISTEP+1, imp at end) | none (`spiral`, `vector-spiral` are separate launchers) | gap |
| moving imp `mov.i #a,}b` (Mercenary) | none | gap |
| silk carrying a `spl #0`/`add.x` imp launcher + stone | `imp-feeder`, `vector-spiral`, `paper` + `par` | partial: we have no paper whose copies each carry a launcher |
| counted-copy replicator with bombs (Borg, The Collective) | `bomb-mice`, `anti-imp-silk` | close to `bomb-mice`; missing the doubling bomb pointer (`add <0,>0`), the scatter `mov <a,b`, and copies that carry extra blank cells |
| looping silk (Paper Dreaming, Moore-style `jmz.f` loop) | `bomb-paper` (loops) | partial; no per-copy self-modification (`add #incr, @...`) |

## Paper/stone compositions

A paper/stone warrior is a quickscan followed by one boot that sets up two bodies at once: a self-replicating silk paper and a stationary multi-process stone. The two run side by side until the round ends. The design holds ranks 1-3 (Arvon, Azathoth and pst_v4, which share one body) and about a dozen more top-50 places. The paper survives bombers and clears because it is spread over many copies. The stone and the paper's anti-imp bombs turn paper-vs-paper and imp ties into wins, and the stone kills scanners that waste time on decoys and paper copies. In a 100-round check (seed 1, `--rules 94nop`), Azathoth beat Ghost Murmur 53-40-7, Kusanagi 61-35-4 and Excalibur 55-35-10. Against stone/imp it scored 25-41-34 with King Cobra and 14-20-66 with Tolypeutes, and against the qscan paper Ziggy 31-18-51. Imps and stone/imp are its problem matchups.

### Ingredients

**1. Quickscan (front).** Every composition read here opens with a decoding quickscan: Q^4 (`qz 2108 / qy 243`) in Hullabaloo, DofA, Borgir, Metal, Spiritual, Gods of Destiny and Halcyon, and variants with other factors in Neith, Numb, lzma2 and Reepicheep; the Azathoth lattice scan (`qdec = 1 + qfac^-1`) in Azathoth, Arvon and Shadow Weaver; a mini q^i from clrsrc in pst_v4; and a custom "Q3.14" in luca. What it hands over is always the same: after about 14-21 bombs (`dat >qoff, >qc2`, step 7) it jumps to the boot entry. It passes no probe, because the bodies do not use one. One composition detail matters to this family: the quickscan's decode tables live in the B-fields of the boot's `spl 1` lines (`qtab2 spl 1, <qb2` in Hullabaloo, Borgir, DofA, Neith and Numb), so the two parts share cells.

**2. Fan boot (Azathoth line, Hullabaloo line, DofA line, Borgir line, Neith).** N processes each copy one cell of each body, then each splits k processes into the stone and enters the paper itself.

```
boot   spl  2               ; with the two spl 1 below: 6 processes
       spl  1               ; (DofA, GoD, Neith: three spl 1 = 8)
       spl  1
       mov  <pptr, {pptr    ; copy one paper cell, last cell first
       mov  <sgo,  {sptr    ; copy one stone cell
sptr   spl  SBOOT           ; A-field was the copy pointer: now = stone copy
       spl  *sptr
       spl  *sptr           ; k = 3 stone processes per boot process
pptr   djn.f PBOOT, }PAPER+6  ; A-field = paper copy: enter the paper
```

The copy destination pointers are the A-fields of the very `spl`/`djn` that jump later. After N predecrements they point at the first copied cell, which is why the pst_v4 comment calls it "self-metering". Process queues are FIFO, so all N copies finish before the first jump. Splits on the hill: Azathoth, Arvon and pst_v4 use 6 boot processes and 18 stone + 6 paper; Hullabaloo, luca and Hullab3loo use 6 and 12 + 6; DofA, Gods of Destiny and Neith use 8 and 16 + 8; Borgir, Metal and Spiritual use 6 and 12 + 6, copying the stone forward (`mov >src, >dst`) and the paper backward. Hullabaloo gets 6 processes from 3 lines with a self-modifying `spl }2` that turns a later `spl 0` into `spl 1`. Cost: about 40-60 warrior cycles. Constants: SBOOT and PBOOT (Azathoth: +3200 and +843) put the two bodies far apart from each other and from the decoy-filled original.

**3. Loop boot (Halcyon, Reepicheep, Numb).** The stone goes first, then the paper is started separately.

```
boot   mov  STONE, SOFF-6       ; first stone cell
       mov  BOMB,  SOFF+HOFF    ; remote bomb cell
       spl  2
       spl  2
sdst   spl  1, SOFF             ; 5 processes now
       mov  <ssrc, <sdst        ; each copies one stone cell
       djn  @boot, #5           ; 4 processes go to the copied stone
ssrc   jmp  PAPER, LAST+1       ; the 5th falls through to the paper
```

In Halcyon and Reepicheep that fifth process hits `spl 1` ×3 and runs the paper in place with 8 processes, so the original image becomes the paper. Numb splits to 8 and boots two papers, one at +5567 and one at +472, giving 16 paper and 4 stone processes. Shadow Weaver does the same thing with a counted `djn hloc, #1`: 5 processes go to the stone and 1 falls through, splits to 8 and boots the paper.

**4. Stone: the "Quicksilver" loop.** Numb calls it "the normal quicksilver stone" and Gods of Destiny says "qsilver stone". The form below is Hullabaloo, Gods of Destiny, Halcyon, Numb, Shadow Weaver, Neith, lzma2, luca and Hullab3loo.

```
stone  spl   #0                    ; feeder: process count grows
loop   mov   BOMB+OFF, @ptr        ; write 1 at X
hit    add   #STEP*2,  ptr         ; X += 2*STEP
ptr    mov   BOMB+OFF, }hit-STEP*TIME  ; write 2 at (old X) + STEP
       djn.f loop,     <DJN        ; decrement stream, 1 cell/loop back
bomb   dat   STEP,     >1
```

That is 2 writes per 4-instruction loop. Write 2 goes through `}`: it reads the A-field of the cell just bombed, which is the bomb's own A = STEP, so it lands STEP beyond write 1 and increments that A-field. A simulation of Numb gave bombs at 25, 25-1954, 209, 209-1954, and so on, so together the writes walk every multiple of STEP. `djn.f <DJN` drags a decrement through the cells below the stone. `TIME` sets ptr's starting B so that after TIME loops the stream lands on `ptr` itself. The stone switches itself off, as checked in the simulator: Azathoth's ptr turned into a DAT after 1,468 bomb writes (its TIME is 1470), and Numb, Hullabaloo and Halcyon did the same. After that, `spl #0` keeps feeding processes into a 3-cell run that dies on the DAT. This process sink holds about 50 processes until the paper's copies overwrite it, which in Azathoth's solo run happened by about step 30,000. STEP is coprime to 8000 (2431, 3039, 6046), so this stone is not layout-safe. It hits its own paper copies and eventually itself, and the design relies on the paper repairing itself. `OFF` with the pre-boot `mov BOMB, SBOOT+OFF` keeps the bomb source outside the loop: 5 cells past it in Hullabaloo, -265 in luca and +6864 in Halcyon.

Other stones in the family:
- *Azathoth/Arvon/pst_v4*: `sub.x #STEP*2, @loop` moves ptr.B by -2*STEP and ptr.A by +1, and `mov {SBACK, }FIRST` plus `djn.f @hit, }ptr` run a forward crawl that decrements 2 cells per loop, starting 2,122-2,129 cells below the stone. That crawl is the "bidirectional" in the comment. The traced bomb stream steps 3138 (= -2*2431), the second write is a copied blank 2431 beyond each bomb, and the crawl touched cells 1077, 1079, 1081... There are 1470 loops in all.
- *DofA*: `sub.f stone, @-1` adds 3*STEP to both pointers. Writes come in pairs STEP apart (2670, 4141), and loops are 3*STEP apart (2670 to 7083).
- *Borgir/Metal/Spiritual*: `spl #2D,{2D / mov bomb,*2 / add.f -2,1 / mov OFF,OFF+D / jmp -3`. It has an A-indirect bomb plus a mov that carries the bomb D further on. The trace shows one step-2862 stream, 2 writes per loop. There is no TIME constant. In my solo run the loop was gone by about step 30,000 and the paper had overwritten it, but I did not check whether a self-hit came first.
- *Reepicheep*: drops a pair 31 cells apart (the bomb's `>hop` A-field) every 2777, with TIME 1425 and a backward `{-1500` stream.
- *Hullab3loo (rank 8) / luca*: STEP 17 and TIME 7485. The trace shows DATs at 6326, 6343, 6360..., a step-17 carpet that starts about 1470 cells ahead. Since gcd(17, 8000) = 1 it fills the whole core in about 4000 loops. In effect this "stone" is a slow forward core clear.

**5. Paper.** There are two families.
- *Moore-style 5-line silk* (Hullabaloo, luca, Borgir, Metal, Spiritual, Hullab3loo): `spl STEP,{3 / mov }2,}-1 / mov BOMB,>BSTEP / mov 3,}-3 / jmz.f -4,*-1 / dat <5334,<2667`. One silk copy, one anti-imp bomb per lap, and a `jmz.f` that loops until the source pointer reads an empty cell. Azathoth's paper has a different shape: three copy movs (`mov }x / mov }x+3 / mov {x+3, }paper`) share the spl's A-field as destination, and the comment calls them "3 silk streams". It has no bomb line.
- *Multi-stage silk* (DofA, Gods of Destiny, Shadow Weaver, Halcyon, Reepicheep, Neith, Numb, lzma2): two `spl @0,>S / mov }-1,>-1` stages, then 1-2 bomb lines (`mov b,>bs` with `dat <2667,<5334`, or `mov #1,{1`), then a backward Moore copy (`mov {p,{q / djn.f @0 / jmz.a`). lzma2's paper drops two anti-imp bombs per lap, which the author calls "very anti-imp". The 2667/5334 fields are a third of the core: decrements spaced to break 3-point imps.

### Method (the steps)

1. The quickscan runs (about 20-40 cycles). If it finds something, it decodes and drops a short burst of DATs. Either way it jumps to the boot.
2. Optional pre-move: one `mov` places the stone's bomb cell (Hullabaloo, Gods of Destiny, luca, Shadow Weaver, the loop boots) or the first stone cell (Borgir).
3. A fan of 6 or 8 processes copies both bodies one cell per process, in FIFO waves. In the loop-boot design, 5 processes copy only the stone.
4. Every boot process spawns k processes into the stone copy (k = 2-3) and then jumps into the paper copy. Loop boots send 4 to the stone and 1 that becomes 8 paper processes.
5. Both bodies grow on their own: the stone's `spl #0` and the silk's `spl`. They draw on one shared 8000-process limit. In Azathoth's solo run there were 54 processes at step 100, 408 at step 2,000 (about 230 of them in the stone) and about 2,000 at step 30,000, nearly all paper.
6. The stone lays 2 writes per loop across the core, ignoring its own paper. The paper copies itself and bombs with anti-imp DATs.
7. Endgame: after TIME loops the stone bombs its own pointer and stops. Its feeder becomes a small process sink until silk copies overwrite it, and from then on the paper is the warrior. None of these stones turns into a d-clear. The only clear-like behaviour is the step-17 Hullab3loo/luca stone, which covers every cell during its run.

### Variants on the hill

| rank | warrior (file) | author | variant / what is different |
|---|---|---|---|
| 1 | Arvon (arvon.red) | Kammann & Forge-AI | Azathoth body (sback -2122); lattice qscan re-fit (qfac 163, qtime 15); 81 cells |
| 2 | Azathoth (azathoth.red) | Metcalf | reference: 6-process fan, 18 stone / 6 paper, sub.x stone with forward crawl, 3-stream silk |
| 3 | pst_v4 (pst_v4.red) | Kammann & Forge-AI | Azathoth body; mini q^i quickscan from clrsrc |
| 5 | The Collective (thecollective.red) | van Rijn | *not a composition*: one Borg-style counted-copy paper with bombing lines inside its loop |
| 8 | Hullab3loo (hullabaloo3.red) | van Rijn | Hullabaloo boot; step-17 carpet stone (TIME 7485, OFF -265); tagged only "qscan" |
| 13 | DanceOfFallenAngels (dofa.red) | Tomasev | 8-process fan, 16/8; sub.f stone, 3*STEP per loop; two-stage silk |
| 14 | Hullabaloo (hullabaloo.red) | van Rijn | Quicksilver stone (3039/3360); Moore silk; `spl }2` self-modifying fan |
| 17 | luca (luca.red) | Zapf | Hullab3loo bodies; custom Q3.14 scan |
| 19, 26, 29 | Borgir, King of Metal, Spiritual Black Dimension | Schmidt | spl/add.f/jmp stone (D 2862), no TIME; forward stone copy; Moore silk |
| 22 | lzma2 (lzma2.red) | NDusN | Quicksilver stone whose djn stream follows the bomb pointer (`>hit-step*cnt`); paper with two anti-imp lines; "imp" tag is from the comment |
| 24 | Gods Of Destiny (godsofdestiny.red) | Tomasev | Hullabaloo stone constants; 8-process fan; silk with `mov #1,{1` |
| 27 | Neith (neith.red) | inversed | 8-process fan, 16/8, stone hop 473 / TIME 2520; its stone was overwritten by its own paper's DAT by step 20,000 |
| 30 | Shadow Weaver (shadowweaver.red) | Fernandes | two boots: 5 stone processes, then 1 process splits to 8 for the paper; two `spl #0` feeders |
| 34, 49 | Halcyon, Reepicheep | van Rijn; Grabun/Metcalf | loop boot of stone (4 processes), paper runs in place (8); Reepicheep bombs pairs 31 apart |
| 39 | Numb (numb.red) | van Rijn | loop boot of stone; two paper copies of 8 processes each; tags "decoy" and "imp" are from comments, not code |
| 11 | The Art of CoreWar (artofcorewar.red) | Fluffy/Zapf | *no stone*: qBob, then two booted copies of an nPaper II silk; the "stone, scanner, clear" tags are wrong |

### How it fits

The composition gives a paper that rarely dies plus a stone that adds kills and needs no scanning, so decoys and the paper's own copies cost it nothing. The quickscan covers the first 20-40 cycles against large or slow opponents. Matchups: scanners and one-shots find paper copies but get bombed or stall on decoys (Ghost Murmur, Kusanagi and Excalibur all lose to Azathoth). Other papers mostly tie, and the stone converts some of those ties. Stone/imp and imp-heavy warriors are the weak spot: King Cobra and Tolypeutes beat or tie it, because imps survive DAT bombing and the anti-imp bombs are sparse.

Failure modes visible in the code and in solo runs:
- The stone is never layout-safe: STEP is coprime to the core and nothing guards it. It bombs its own paper copies (Azathoth's crawl decremented cells 1077-1085 inside a silk copy) and finally itself. Designers bound the damage with TIME.
- The paper kills the stone. Neith's and DofA's stone pointers were overwritten by their own paper's `dat <2667,<5334`, and Borgir's and Azathoth's stone cells were later overwritten by silk copies. That is accepted because the stone has done its work by then.
- The dead stone's `spl #0` keeps eating a share of the process queue (in Azathoth about 54 of 735 processes at step 8,000) until something overwrites it.
- Boot timing: N processes copy one cell each, so a body longer than N cells must be padded or pre-moved (Gods of Destiny pre-places `hBomb`; Neith's 8-cell copy takes in two silk lines).

### Our blocks

| Hill part | Block(s) | Notes / gaps |
|---|---|---|
| Q^4 / lattice quickscan | `opening-qscan-decode`, `opening-qscan-lattice` | gap: decode tables stored in the boot's `spl` B-fields (cell sharing between parts) |
| Quicksilver stone | `fanboot-paper-stone`'s stone (2 writes + a decrement per loop, TIME self-off); `hill-stone` for the layout-safe variant | **Built.** `fanboot-paper-stone`'s stone is a faithful Quicksilver: 2 writes + 1 decrement per loop and a planned self-hit that switches it off after TIME, so the paper inherits the core. Its contract has no gcd constraint, so a full-core coprime step is allowed (its default step 2377 is coprime). `hill-stone` is the separate layout-safe bomber (gcd(STEP, core) >= length, optional ENDCLEAR) |
| Azathoth forward crawl | `hill-stone` STREAM, `djn-stream` | gap: a crawl folded into the A-field side of the same pointer cell, moving opposite to the bombs |
| Reepicheep pair bombs | `carpet-bomber` (WIDTH 2) | gap: pair spacing 31, not adjacent |
| Step-17 carpet stone | `finisher-counted` (roughly) | gap: a sparse forward carpet that closes up over laps |
| spl/add.f/jmp stone (Borgir) | `spl-stone`, `hill-stone` | close enough |
| Moore 5-line silk | `bomb-paper` (BOMB 1) | gap: the `jmz.f` self-check loop and the `{3`-offset copy |
| Multi-stage silk | `silk3`, `bomb-paper`, `boot-paper` | `silk3` has no bomb lines or backward Moore copy stage |
| Fan boot with process split | `par`, `parboot`, `waveboot` recipe | gap: one N-process wave that copies two bodies and sets a k:1 stone:paper ratio, with copy pointers reused as jump vectors. `par` only SPLs side by side; `parboot` copies one member |
| Loop boot then paper in place | `boot` + `par` | gap: counted `djn @boot, #N` that sends N-1 processes to the stone and the last to the paper |
| Remote bomb cell | `hill-stone` REMOTE | matches |
| Borg/Collective bombing replicator | `bomb-mice`, `bomb-paper` | a single body, not this family |

The `paper-stone` recipe (`par` of `paper` and a stone) lacks the quickscan, the boot away from the original, the process ratio and the timed self-stop, which are the four things every top paper/stone here has.

## Stones and stone/imps

A stone is a small, fast bombing loop, usually fed by an `SPL #0`, that drops DATs at a fixed step and decrements a second stream of cells as it goes. On this hill it rarely runs alone. The standard pairing is stone/imp: a Q^4 quickscan, a process-parallel boot, a stone, and a 3-point imp spiral (step 2667). The stone wins games and the imps turn would-be losses into ties. Stones beat scanners and one-shots, which find the small stone late or waste their attack on a decoy bomb. Imps tie papers. Clears that pass through the spiral without being broken by it, and papers that out-replicate the bombing, are the bad matchups. A second line of bombers ("stone+clear", 41 warriors, best rank 273; Viva La Bomba, Fort Destruction, Torch, Tornado) has no imps. These finish with a core clear, often triggered by an airbag test or by a bomb that the stone deliberately drops on its own exit instruction.

I checked the claims below by running each warrior alone in our engine and logging which cells execute in each window of cycles. The endgame mechanisms in particular come from those traces, not from the comments.

### Ingredients

**1. The Q^4 opening.** Nearly every top stone/imp starts with a Q^4/Q^5 quickscan (see the openings chapter). Two details matter here. The scan's decode tables sit in the B-fields of the boot's own `SPL 1` lines (`qtab2 spl 1, }qD`), so the boot doubles as the table. And the scan exits with `jmz.f boot, ...` or `djn.f boot, #0` straight into the boot.

**2. Process-parallel boot.** Make 4 or 6 processes, then let every process run each copy line once. Each `MOV` line then copies N cells for one line of code, and the processes are already in place to start the stone.

```
boot   spl  2            ; 1 -> 6 processes (spl 2 / spl 1 / spl 1)
tab    spl  1
       spl  1
       mov  <impSrc, {iDst    ; 6 processes copy 6 cells
       mov  {stnSrc, {sDst
sDst   djn  STONE+6, #6       ; 5 processes take the jump...
iDst   jmp  IMP+6            ; ...the 6th falls through to the imp
```
The `DJN …, #6` is a process splitter: the counter decides that 5 of the 6 processes go to the stone and the last goes to the imp launcher (Uninvited, Red Dragon, Quicksilver, Cascade, Candy II). Armadillo and Tolypeutes use `spl iBoot` instead, and one process boots the imp launcher with a separate 4-line copy loop. Positions are constants (STONE ≈ 1000–7000 away, IMP elsewhere), so the stone, the launcher and the original copy sit in three different places. Most boots also plant the stone's bomb separately (`mov bomb, STONE+OFF`).

**3. Stone loops.** Five families appear in the sources:

(a) *Remote-bomb two-pointer stone* (Quicksilver, Cascade, Candy II, Last Judgement, Nightstalker, Uninvited/Red Dragon, Pixie):
```
       spl  #0, 0                 ; feeder: one new process per pass
loop   mov  BOMB+OFF, @ptr        ; write 1
       add  #STEP*2, ptr
ptr    mov  BOMB+OFF, }ptr-STEP*TIME   ; write 2
       djn.f loop, <DJNSTART      ; folded DJN stream
bomb   dat  STEP, >1
```
Four instructions per pass give 2 writes plus 1 decrement. The bomb's A-field equals STEP, so when write 2 lands on a cell that already holds a bomb, the `}` indirection follows that A-field and writes STEP further on. The bomb works as its own pointer. `BOMB+OFF` reads a copy of the bomb planted OFF cells away (Quicksilver hOff=5, Candy bOff=6, Nightstalker bdist=22), so a scanner that finds a bomb next to the loop is led to a decoy. `-STEP*TIME` in the pointer's start value fixes the pass on which the bombs come home (see 4). Uninvited's variant uses `sub.x #STEP*2, @loop` and `mov {A, }B`, giving 3 writes per 4 lines.

(b) *Self-copying stone with gated clear* (Armadillo, Elven King, Tolypeutes):
```
inc   spl  #STEP, <-STEP          ; spl #x = spl 0: unbounded feeder
      mov  {STEP, <HIT            ; copy a cell from the A-trail (mostly empty)
      mov  bomb, @-1              ; DAT on the B-trail
      add.f inc, -2               ; step both pointers
loop  djn.f @-1, <STREAM          ; back to the 2nd line, plus DJN stream
      mov  bomb, >GATE            ; 2-line forward clear
      djn.f -1, >GATE
bomb  dat  <1, HOP+1              ; (Elven King: dat <2667, HOP+1)
```
Steps: Armadillo 3510/hop 56, Elven King 3630/46, Tolypeutes 2090/46.

(c) *Self-referencing arithmetic stone* (Cloudrunner, Black Knight, Positive Knife):
```
      spl  #0, 0
loop  mov  -STEP, 1+STEP          ; Positive Knife: mov 187, 374
      sub.ab {0, }0               ; or add.ab {0,}0
      djn.f loop, <STREAM
```
`{0` and `}0` both resolve to the cell above, with the line's own A-field decremented and then restored. The line therefore adds that cell's A-field into its own B-field, and needs no separate increment cell. A 3-line loop gives 1 write and 1 decrement per 3 instructions. Black Knight's step is 197, Cloudrunner's 68. Positive Knife and Black Knight reuse the trick in their imp launchers.

(d) *Skew/Joonas stone* (Cascade: `spl #3*S,3*S / mov bomb+5,@ptr / add start,@-1 / ptr mov …,*4 / djn.f -3,*ptr`) and Pixie's "skew dwarf", which puts a gate in the feeder itself (`spl #rock, <GATE`): every spawn decrements the gate cell.

(e) *Incendiary / 60%c bombers without imps* (Torch t5, Tornado 4, Viva La Bomba, Fort Destruction). These alternate `SPL #0` and `MOV @0, >STEP` halves, or lay `spl #2 / mov @0,}-1 / jmp -STEP` triples. Tornado writes 3 bombs per 5 instructions.

**4. How the stone ends: the wreck becomes a clear.** This is the most important hill trick in the family, and the comments do not describe it. The stone's start pointer is set so that after TIME passes (Quicksilver hTime=3360, Uninvited uTim=1183, Last Judgement dtime=1677) the bomb trail reaches the stone itself. The first lines hit are the arithmetic line and the DJN line. What remains is:
```
      spl  #0, 0
      mov  bomb, @ptr      ; or mov bomb, >ptr / {ptr
      dat  X, >1           ; the stone's own bomb, now over the ADD
```
Every process runs MOV, dies on the DAT, and the DAT's `>1` operand post-increments the pointer the MOV just used (ICWS'94 evaluates DAT operands). The `SPL #0` keeps replacing processes, so the wreck is a one-cell-per-process core clear. Traced alone: Quicksilver's pointer advances 20 cells per 100 cycles from cycle ~5000 on, Black Knight's 12 per 50 from ~12000. The same thing happens in Uninvited, Red Dragon, Candy II, Pixie (backward, via `{`), Nightstalker, Last Judgement, Cloudrunner and Positive Knife. That is why bombs look like `dat >hop, >1`, `dat hStep, >1`, `dat >-1, >1`.

Family (b) ends differently. The A-trail copy (`mov {STEP, <HIT`) eventually reads the stone's own `SPL #STEP` and writes it over the `DJN` (Armadillo at cycle ~5000, traced). The loop becomes two SPL feeders, and every process falls through into `mov bomb,>GATE / djn.f -1,>GATE`: a forward clear of 1 DAT plus 1 decrement per 2 instructions, run by thousands of processes (3,300 at cycle 30000). When the clear laps the core it writes the bomb onto GATE itself. The bomb's B-field (HOP+1, larger than the stone) resets the clear pointer past the code, so the clear never runs over itself. Son of Vain does something else again: it boots a separate d-clear (`spl #0 / spl #0,{gate / mov gate+2,>gate / djn.f -1,>gate`) that runs from the start, and its wipe start is computed so the clear wipes the stone at cycle ~6000–9000.

**5. Imp launchers.** All use 3-point imps, step 2667 = (8000+1)/3. The imp instruction varies: `mov.i #0, 2667`, `mov.i #2667, *0` (step held in the A-field), `mov.i #1333, 2667`, `mov.i #1, 2667`. Why the A-field value is chosen I could not settle from the code. The two `*0` and B-direct forms react differently to A- and B-field decrements from enemy DJN streams.

(a) *Continuous pump* (Quicksilver, Cascade, Uninvited, Red Dragon, Candy II, Pixie, Elven King, Armadillo; about 20 files share it):
```
pump  spl  #imp, ...              ; one new process per pass
      sub.f #-(2667+1), jump      ; advance both jump fields one ring step + 1
      mov  imp, }pump             ; lay an imp at a moving cell
jump  jmp  imp-2*(2667+1), >imp+2*2667-1
imp   mov.i #2667, *0
```
Each process is sent one ring step plus one cell further than the last, so the processes fill a 3-point spiral that grows by one process per pump pass and never stops. Nightstalker's 3-line form is `spl #0 / sub.f #-2667, ptr / ptr djn.f TARGET, <STREAM`, and Tolypeutes uses a 4-line `sub.x -1, 2` version. Quicksilver caps the pump on purpose: `iDist = hDist+2+hStep*(iTime-hTime)` places the launcher where the stone's 101st bomb lands. The trace shows the launcher bombed within the first 1,000 cycles, after which the imp count stays fixed.

(b) *Launcher that feeds the stone* (Black Knight, Last Judgement, Positive Knife):
```
      spl  #0, 0
      add.a #2667, 1
      spl  RING-4*2667            ; spawn an imp at the next ring point
      djn.f STONE-HERE, <STREAM   ; spare process joins the stone
```
Each pass launches one imp and sends the leftover process to the stone, so the launcher is also a process feeder for the bomber (Black Knight's stone runs ~1,000 processes). Black Knight and Last Judgement boot two such launchers at different distances, giving two independent spirals.

(c) *Delayed imp* (Uninvited, Red Dragon): `djn #0, #5` in front of the pump idles 5 times before launching, so the stone gets its processes first.

(d) *Imps from a paper* (Cloudrunner): the paper body contains `spl 2668,0 / mov >p,}p / spl 5334,<345 / mov.i #1,2667`, so every paper copy seeds imps. The `stone,imp` tag misses the paper.

(e) *Imps capped by the clear* (airBag): `spl #0 / add.a #2668,1 / jmp imp-2668` launchers that, as its comment says, are "killed by the dclear (if it is working!)".

**6. Anti-imp measures.** Imps are the stone's tie partner, but the opponent's imps are what stop a stone from winning. The measures in the code: DJN streams folded into the stone loop (`djn.f loop, <X`), which decrement fields and break imp rings; bombs with `<2667` A-fields (Elven King, Son of Vain's `dmop dat <2667`, Viva's `jmp -400,<2667`), so a process dying on the bomb also decrements the next imp of a ring; decrement gates in the clear (`djn.f -1, >GATE`) and in the feeder (Pixie's `spl #x, <GATE`); and Son of Vain's `spl #0, {dgate` gated d-clear.

**7. Airbag.** The loop's exit test reads a cell that stays zero as long as nothing has hit the stone. A hit, or the stone's own trail coming home, makes it non-zero, and the bomber escapes into a clear. Viva La Bomba: `jmz.a bLoop, <bJmp` then `bEvac jmp -bcOff`, into a separately booted SPL/JMP clear. Fort Destruction: `jmz.a init, {move+off` then `djn.f clr`. airBag uses two half-speed processes: one runs `jmz.f one, >check` and the other `jmz.f two, <check`, so check's B-field oscillates 0/1. A hit on check, or the death of either process (the oscillation drifts and the test reads the non-zero bomb beside it), sends both into the d-clear and the imp launchers. Fuse (`mov.i }2804,70 / jmz.f -2,{-1`) is a one-process stone that exits to a spl/spl/dat clear as soon as its test cell is non-zero.

### Method (the steps)

1. Qscan (~20 cycles of SNE/SEQ, then up to 14–21 bombing loops on a hit), then jump to the boot.
2. Plant the remote bomb copy (`mov bomb, STONE+OFF`) and, in Black Knight/Last Judgement, the imp instructions at their spiral origins.
3. `spl 2 / spl 1 / spl 1` (6 processes) or `spl 1 / spl 1` (4). The splits are free table entries for the qscan.
4. Parallel copy: every process runs each `mov <src,{dst`. The stone, launcher and bomb end up at three distances chosen by optimisers (`;optimax` lines in Christian Schmidt's warriors).
5. Split processes: a `DJN …,#N` counter (N-1 to the stone, 1 to the imp), or a separate `SPL` for a second boot loop. The original code is left behind as a decoy.
6. The stone's `SPL #0` feeder grows its process count (hundreds to thousands). The imp pump grows the spiral one process per pass, unless the stone bombs it on purpose (Quicksilver) or the launcher hands its spare processes to the stone (Black Knight).
7. The stone runs a fixed number of passes. Its step is chosen so the bombs miss the stone, the launcher and the bomb copy until the planned pass. The boot distances are tuned against that step.
8. Endgame. The stone bombs its own arithmetic line and the wreck becomes a one-cell clear (family a/c), or copies its SPL over its DJN and floods a gated forward clear (family b), or a pre-booted d-clear wipes it (Son of Vain). The imps keep crawling. If the opponent is still alive at the cycle limit, they turn the round into a tie.

### Variants on the hill

| rank | warrior (file) | author | variant / what is different |
|---|---|---|---|
| 6 | Tolypeutes (tolypeutes.red) | Roy van Rijn | Armadillo stone (step 2090) + gated clear; 4-line `sub.x` pump; new 34-location qscan |
| 18 | Son of Vain (sonofvain.red) | Oversby/Pihlaja | Stone + separate gated d-clear from the start + `spl/add.a/djn.f` spinner with decoy; the clear wipes the stone |
| 33 | Armadillo (armadillo.red) | Lukasz Grabun | Self-copying stone ends in SPL-fed forward clear; separate boot loop for pump |
| 36 | Last Judgement (lastjudgement.red) | Christian Schmidt | Two launchers (two spirals) whose spare processes feed the stone; step 81 |
| 40 | Nightstalker (nightstalker.red) | John Metcalf | No boot table in splits; 3-line `djn.f` pump; remote bomb at +22; wreck → clear |
| 42 | Elven King (elvenking.red) | Christian Schmidt | Armadillo-type stone with `dat <2667` anti-imp bomb; 5-line pump |
| 45 | Red Dragon (reddragon.red) | John Metcalf | Uninvited with step 5799 and Q^5 |
| 47 | Positive Knife (positiveknife.red) | Ken Espiritu | Compiled-only source; `add.ab {0,}0` stone; `sub.ba {0,}0` launcher feeding the stone |
| 50 | Quicksilver (quicksilver.red) | Michal Janeczek | Remote-bomb stone; launcher placed to be bombed on pass 101 (imp cap) |
| 56 | Candy II (candy2.red) | Lukasz Grabun | Quicksilver-type stone (step 4289) with Uninvited's pump |
| 57 | Pixie (pixie.red) | Lukasz Grabun | Skew-dwarf stone with gate in the SPL; wreck clears backward |
| 59 | Uninvited (uninvited.red) | John Metcalf | Mini-Q^3; `sub.x` stone (3 writes/4 lines); delayed pump; DJN 5/1 split |
| 93 | Fort Destruction (fortdestruction.red) | NDusN | No imps (tag wrong): incendiary triplets + airbag `jmz.a`, then clear with `dat <2667` |
| 104 | Cascade (cascade.red) | Roy van Rijn | Quicksilver frame with Joonas's skew stone |
| 108 | Cloudrunner (cloudrunner.red) | Simon Wainwright | 3-line `sub.ab {0,}0` stone + paper that seeds imps |
| 112 | Black Knight (blackknight.red) | Christian Schmidt | Like Last Judgement with the 3-line stone, step 197 |
| 273 | Fuse (fuse.red) | Myer Bremer | One-process testing stone → spl/spl/dat clear |
| 307 | Viva La Bomba (viva.red) | Christian Schmidt | Incendiary airbag stone; escape into booted SPL/JMP clear |
| 397 | Tornado 4 (tornado4.red) | Beppe Bezzi | 60%c spl/mov bomber; own SPL bomb on `jmz.b` starts d-clear; `spl 1,1` padding |
| 520 | airBag (airbag.red) | Paulsson | Two half-speed bombers sharing an oscillating airbag cell; d-clear + continuous imps |
| 562 | Torch t5 (torcht5.red) | P.Kline | Incendiary bomber; own SPL on `djn.f` starts clear; boot refuses non-empty target; 64 imp-like decoy lines never executed (tag `imp` wrong) |

### How it fits

The stone wins against scanners, one-shots and other stones that it hits first. The imps cover papers, which a 0.5c stone cannot outbomb, by forcing ties. The qscan in front handles the small and slow warriors that a stone would take too long to find. Hill tags confirm the pairing: 16 of the 33 tagged stones in the top 50 also carry imps, and the "qscan+stone+imp" combination's best entries reach rank 36.

What the composition gains comes from processes and timing. One boot fills the stone with 4–6 processes, the `SPL #0` feeder grows that to hundreds, and the pump grows the spiral. Most designs keep the stone from hitting its own imps only by distance and step. The stone's bombs can still land on its own spiral, which the continuous pump tolerates by re-seeding.

Failure modes visible in the code:
- A pump left running absorbs process slots and cycles the stone needs. Quicksilver bombs its own pump, airBag clears its own launchers, and Black Knight turns launcher processes into stone processes.
- A clear crossing its own code. Armadillo's gate reset (bomb B = HOP+1) and the hill-stone margin both exist for this.
- A boot onto enemy code. Torch checks the destination with `jmn.f c2, @copy1` and picks the second boot site.
- The wreck clear is slow (one cell per process turn, and it shares cycles with the imps). Against a paper it mainly kills copies that wander into it.

### Our blocks

| Hill part | Our block(s) | Notes |
|---|---|---|
| Q^4 opening | `opening-qscan-decode`, `opening-qscan-lattice` | Ours don't reuse the boot's SPL lines as tables |
| Parallel boot, DJN 5/1 split | `boot`, `parboot`, `par`; recipes `waveboot`, `stone-imp` | Gap: no "N processes run each copy line once" boot and no DJN-counter process split |
| Two-pointer stone with folded stream | `hill-stone` (WRITES 2, STREAM 1, REMOTE 1), `spl-stone`, `mod-stone` | Close match. Gap: bomb A-field used as the second pointer |
| `{0,}0` 3-line stone | `stone`, `mod-stone` | Gap: no self-referencing-arithmetic loop |
| Wreck-becomes-clear ending | `hill-stone` ENDCLEAR, recipe `stone-then-clear` | Different: ours counts passes and adds ~7 clear lines; hill stones get the clear free from the `>1` bomb landing on their own ADD |
| Self-copying stone → gated clear | `finisher-gated`, `trigger` MODE 0 | Gap: no SPL-copied-over-DJN switch, no bomb-resets-gate wraparound |
| Separate d-clear from start (Son of Vain) | `finisher-dclear` + `par` | Matches. Clear wiping the stone on purpose is not modelled |
| Continuous imp pump | `imp-feeder`, `vector-spiral`, `spiral`, `dual-launcher` | `imp-feeder` adds an imp every WAIT+4 passes; the hill pump adds one per pass, uncapped unless the stone bombs it. Gap: stone-capped pump |
| Launcher feeding the stone | none | Gap |
| Two spirals | `dual-launcher` | Ours launches both from one split |
| Imp-seeding paper | `paper-stone` recipe, `bomb-paper` | Gap: paper that spawns imps |
| Anti-imp `<2667` bombs, gate in SPL | `imp-gate`, `djn-stream`, `finisher-gated` | Gap: anti-imp DAT A-field |
| Airbag → clear | `airbag-stone`, `sentinel-stone`, `trigger` MODE 1/2 | Different: our `airbag-stone` repairs itself and keeps bombing; hill airbags abandon the stone for a clear. `trigger` MODE 1 is the closer match |
| Incendiary / spl-mov bombers | `incendiary`, `jmp-bomber`, `carpet-bomber` | Gap: own-SPL-on-exit-instruction start of the clear (Torch, Tornado) |

## Scanners, oneshots and core clears

Scanners look at the core instead of bombing it blind: they compare cells (SNE/SEQ of two cells, or JMZ/JMN of one) and attack only where something is. On the 94nop hill every serious scanner ends in a core clear, and the clear is often the part that actually wins. There are four shapes: pair scanners that wipe each find and scan on (Agony line: Kusanagi, Excalibur, Discord, Eternal Exile), blur scanners that carpet SPL bombs while still scanning (The Machine, HazyLazy, Perseus, Twin Storms, Arrow), oneshots that stop at the first real find and clear outward from it (King Cobra, Kaitain, Infravision, KryneLamiya, One Shot), and Metcalf's tiny .75c Pendulum engine. They beat papers (an SPL carpet stuns a replicator's processes, the DAT pass kills them) and lose to stones (a bomber is small and its DAT bombs give a scanner false finds) and to imps (most get ties at best). Decoys are aimed squarely at this family.

### Ingredients

**1. The scan loop and how it avoids itself.** A pointer cell holds two offsets (A and B, `GAP`/`hop` apart); each loop adds `STEP` to both and compares the two targets. Cost is the number of cells looked at per cycle: Kusanagi checks two pairs per 6-instruction loop, the 3-instruction loops of Eternal Exile, Arrow and Shot to Nothing check a pair per 3 cycles (".66c"), Pendulum three cells per 4 (".75c"), Z++ one cell per 2-instruction JMZ loop. Three ways to not find yourself:
- A distance test after a find: `slt #SAFE, ptr` (Kusanagi, Excalibur `slt #ssafe,@x`, Discord `slt.a #self,ptrs`). A find whose offset is under `SAFE` (the code's length plus `hop`) is ignored and the scan continues.
- A timed scan: start the pointer at `first = -STEP*TIME` (Eternal Exile `zo = 0 - step*time`, Ghost Murmur `first = clear+1-step*time`), so the pointer field reaches 0, or lands on the scanner's own code, after exactly `TIME` loops. That event is the cue to switch to the clear, so the self-find is the timer.
- Count self-finds: Pendulum/Xenosmilus/Herald run `slt ptr,#last-ptr+4` then `djn reset,#18`; each self-find uses up one count.

```
loop  add   inc, ptr          ; ptr.A += STEP, ptr.B += STEP
ptr   sne   FIRST, FIRST+GAP  ; differ? -> attack
      jmn.a loop, ptr         ; loop until ptr.A wraps to 0 (timed scan)
      ...attack...
inc   spl   #STEP, STEP       ; the step is also the wipe bomb
```

**Step choice.** For a pair scanner the step must be odd or coprime with 8000 so a lap reaches everything (Kusanagi 2851, Eternal Exile -101, Excalibur 3147, Discord 7599). Blur scanners use mod-10 steps on purpose (The Machine 70, HazyLazy 290 and 7170, Shot to Nothing 10): the scan only visits one residue class, about 800 cells, which keeps a lap short. The compare gap (5, 7, 8) is smaller than the step, so a body longer than the gap is always seen. Pendulum uses step 17 with `sub.x #-2*step` folding two strides into one loop. Most constants carry `;!opt` or optimax markers (clrsrc, Arrow, Shot to Nothing): they were tuned by search, not derived.

**2. Fixed-length wipe (Agony line).** On a find, copy the pointer into a wipe pointer and drop `WLEN` SPL bombs, usually the `inc` cell itself (`spl #STEP,STEP`), so the bomb doubles as the step constant. Then go back to scanning.

```
z     mov   @x, @y            ; bptr <- found pointer        (Kusanagi)
      mov   #WLEN, cnt
wipe  mov   inc, }bptr        ; wipe from the A target
y     mov   inc, >bptr        ; and from the B target
cnt   djn   wipe, #0
      jmn.a loop, *c          ; back to scanning while ptr.A != 0
```
Kusanagi wipes 8 cells from each pointer, Eternal Exile 2×8 (clrsrc 2×9), Discord 2×15 backward, Excalibur 16 backward. The variable-length alternative is Pendulum's `jmn.f wipe,>ptr`: it keeps wiping until it reaches an empty cell, so a whole body gets stunned however long it is.

**3. Blur bombing.** One SPL bomb per loop at a bomb pointer, always. When the scan sees something, `mov.ab scan,@top` moves the bomb pointer there, and scanning goes on while the carpet grows (The Machine, HazyLazy):

```
top   mov.i bomb, >ptr        ; one SPL #1,#1 per loop, always
scan  seq.i 2*STEP, 2*STEP+GAP
      mov.ab scan, @top       ; found: retarget the carpet
      sub.f inc, scan
      jmn.b top, @top
inc   spl   #-STEP, >-STEP    ; loop ends -> SPL pump
      mov.i clr, >gate        ; d-clear
      djn.f -1, >gate
clr   dat   <2667, clr-gate+2
```
Twin Storms' "Origin of Storms" is the same idea: it bombs both pointers every loop (`mov bomb,>ptr` / `mov bomb,}ptr`) and advances by STEP only when the SNE pair is equal, so a find gets a solid carpet. A `djn @p,#time` counter ends it after 348 loops. Arrow and Ghost Murmur drop only one or two SPLs per find and count finds (`djn {sFlag,#sHit`, 20 finds for Arrow).

**4. SPL/SPL/JMP trap (Z++).** On a nonzero cell Z++ writes `spl #0` before it, and the boot has planted a `jmp -2` at a step offset; enemy processes run into SPL 0 and JMP back into it, stuck in a loop. `djn.b top,@top` counts hits, then it falls into `spl #0` plus a d-clear.

**5. Oneshot scan with bomb detection.** A oneshot scans once and commits. King Cobra/Kaitain compare two adjacent pairs per loop: `seq {p,<p` then `sne {p,<p`. If only the first pair differs and the second matches, the find is dropped, so a single isolated cell (a stone's bomb, a decrement left by its own stream) does not trigger it; a real body, several cells long, makes both pairs differ. The scan pointer is the clear's own `cptr` (the boot places the clear exactly `shift` cells below the loop), so on a find the clear starts right there with no copying. Infravision runs a .80c prescan (`pstep = -5*step`, 27 loops) and SPL-wipes its first find, then hands to a .66c main scan. The main scan's `djn.f loop,{cptr` decrements every cell it passes, and it jumps into the clear on the first difference.

**6. The clears and how they switch passes.** All of them run on an `spl #x` that splits to itself (the `#` A-operand makes the SPL target its own cell), so many processes share one clear loop.
- **D-clear** (The Machine, HazyLazy, Arrow, Ghost Murmur, Kusanagi): `spl #s ; mov dat,>gate ; djn.f -1,>gate`. It writes one DAT and decrements the next cell each loop. The DAT is usually `dat <2667, n`: its A-operand predecrements at the imp step, so imps that run into it get broken. The SPL carpet laid during the scan counts as the first pass, so this is "spl/dat two-pass" spread over the whole round.
- **Self-switching SPL->DAT clear (King Cobra, Kaitain, KryneLamiya, Infravision):**
```
cptr  dat   ZOFS+HOP+1, ZOFS  ; write pointer (= scan pointer)
bptr  dat   1, DSAFE          ; *bptr -> next cell (the SPL)
cs0   spl   #DJS, SSAFE       ; pump + first-pass bomb
clear mov   *bptr, >cptr
      mov   *bptr, >cptr
      djn.f clear, }cs0       ; DJN stream at cs0+cs0.A, cs0.A++
```
The DJN stream is also a timer. `cs0.A` counts up by one per loop, and when `cs0+cs0.A` reaches `bptr` (after about 8000-DJS loops, roughly two laps of SPL writes) it decrements `bptr.A` from 1 to 0, so `*bptr` now points at `bptr` itself and the clear writes `dat 0,DSAFE-1`. When the write pointer wraps onto `cptr`, the bomb it writes there resets `cptr.B` to `SSAFE`/`DSAFE`, which is larger than the clear's own length, so the pointer jumps over the clear's own code. I worked this out by reading KryneLamiya (`spl #400,10`, `b dat 1,10`, five cells) and did not run it. Perseus's "Crystal Clear" appears to use the same trick: `mov.i *sw,}gate` writes `*sw` (the SPL `cc`), and the `djn.f -1,>inc` stream should eventually decrement `sw.A` so that it points at the `dat OFFSET+3,0` after the gate. The source comment "must have a DAT after the gate" fits that reading. The stream starts 112 cells ahead and is what "spiral killing" refers to.
- **Pointer-overwrite switch (One Shot):** `ptr dat bomb1,#0`, and the clear writes `*ptr`. When the pointer wraps onto `ptr`, the copy of bomb1 replaces `ptr.A` with the offset of bomb2, and the next wrap with bomb3 (`dat >2667,>5334`, the anti-imp DAT). Each pass sets up the next: spl, spl, anti-imp dat.
- **Counter switch (Pendulum, Xenosmilus, Herald):** when the self-find count runs out, `jmp reset,{wipe` (Herald: `djn.f hit-1,#sbmb`) decrements the wipe's source field, so the SPL source becomes the empty DAT below it. The same scan-and-wipe loop then turns every SPL carpet back into empty cells.
- **Own-code gate (Eternal Exile, clrsrc):** `mov kill,>gate ; djn.f clear,>gate` where `gate` is one of the dead scanner's own instructions. The clear walks forward over the dead scan loop, overwrites `gate`, and the DAT it leaves there (`dat <ikill, dcgap`, dcgap 10) sends the pointer `dcgap` cells on, past the clear itself.

**7. Imp failsafe.** King Cobra/Kaitain: the find branch is `inc spl *clear` followed by `mov.i #4000,1`, which is a MOV 0,1 imp. One process starts the clear and the other crawls away as an imp, so if the clear dies the warrior can still tie.

### Method (the steps)

1. Quickscan (most top entries): inversed's mini q^i (King Cobra, Eternal Exile, Twin Storms), Metcalf's lattice decoder (Ghost Murmur, Xenosmilus, Kaitain) or Schmidt's q^4 table (Arrow, HazyLazy C 11, KryneLamiya revisited, Shot to Nothing). If it finds something, it bombs there briefly (`qbcnt` 15-20 bombs `qbstep` apart), and in every case it falls into the boot. Covered in the openings chapter.
2. Boot: copy the 6-16 cell engine 1,400-6,000 cells away (`bdist` 6055, 4774, 1423). Excalibur starts the copy running (`spl scan+bd`) while a second process is still copying the tail, because the tail is not needed until the first find. Twin Storms boots two scanners at once (`bdist1`, `bdist1+913`) with one interleaved copy loop. The original stays behind as a decoy, sometimes padded to look like the warrior: Discord (decoy) carries a pre-assembled image of its own scanner among the SPL decoys, and Excalibur's "mirror" lines look like the same idea (purpose not documented).
3. One process scans. Only the oneshots and Twin Storms split before the clear.
4. On a find: a pair scanner wipes `WLEN` cells and goes back to step 3; a blur moves its carpet; a oneshot jumps straight into the clear with its pointer already set at the find (King Cobra also starts its imp).
5. Switch to the clear when the scan pointer field reaches 0 (Kusanagi `jmn.a`, Eternal Exile), when a wipe touches the cell just below the scanner (Discord/Excalibur `jmz scan,scan-1`: a find just past the self-check distance wipes backward into it), when a counter runs out (Twin Storms `djn #time`, Arrow `#sHit`, Pendulum `#18`), or, for The Machine/HazyLazy, when the bomb-pointer B field reaches 0. I did not trace the last one; it seems to depend on the mod-10 scan reaching the warrior's own body.
6. Endgame: an SPL pump plus a DAT clear runs until the round ends. The pump keeps adding processes, so DAT bombs that hit the clear kill only some of them. Imps are handled by `dat <2667` bombs, DJN streams and the One Shot `>2667` DAT.

### Variants on the hill

| rank | warrior (file) | author | variant |
|---|---|---|---|
| 4 | King Cobra (kingcobra.red) | inversed | q^i -> oneshot with 2-pair bomb detection -> self-switching SPL/DAT clear + trailing imp |
| 7 | Kaitain (kaitain.red) | Kammann & Forge-AI | King Cobra body with Metcalf's lattice quickscan |
| 10 | Excalibur (excalibur.red) | inversed | Agony II rework: 49 mixed-modifier SPL decoys, copy-ahead boot, DJN stream in the scan, 16-cell backward wipe, mirror lines |
| 12 | Ghost Murmur (ghostmurmur.red) | Metcalf | lattice qscan -> timed SEQ scanner (step 3984, gap 6, 492 loops), one SPL per find -> d-clear |
| 21 | Kusanagi (kusanagi3.red) | inversed | Agony scanner: 2 pairs/loop, 8+8 forward wipe, scan ends when ptr.A wraps, decoy maker |
| 23 | Eternal Exile (Eternal_Exile.red) | inversed | q^i -> .66c timed scanner, 2x8 wipe, own-code-gated d-clear |
| — | clrsrc (clrsrc.red) | Kammann & Forge-AI | Eternal Exile with optimizer-retuned constants (wlen 9, bdist 5500) |
| 31 | Twin Storms (twinstorms.red) | inversed | two booted Origin-of-Storms blurs, 348 loops each -> d-clear |
| 32 | Perseus (perseus.red) | Marsden | blur (step -112) -> Crystal Clear; boot scatters ~50 decoy pairs |
| 35 | Z++ (zplusplus.red) | Marsden | spl/spl/jmp JMZ scanner + "big decoy" of every opcode/modifier |
| 41 | Discord (decoy) (discorddecoy.red) | Metcalf | Agony line, 2x15 backward wipe, decoys include a copy of itself |
| 48 | Xenosmilus (xenosmilus.red) | Metcalf | lattice qscan -> Pendulum engine (step 17, 13 self-finds) |
| 51 | Herald of Destruction (herald.red) | Metcalf | .75c three-probe scanner, wipe-until-empty, SPL->DAT by counter |
| 52 | Arrow (arrow.red) | Schmidt | q^4 -> .66c scanner, SPL per find, 20 finds -> d-clear |
| 53 / 101 | HazyLazy A 70, Hazy Lazy (hazylazya70.red, hazylazy.red) | Gunnell | The Machine retuned: mod-10 step 290 blur -> d-clear |
| 55 | HazyLazy C 11 (hazylazyc11.red) | Schmidt & Gunnell | q^4 + boot + the HazyLazy blur (step 7170) |
| 62 / 124 | Pendulum, Pendulum-4009 | Metcalf | 23 / 13 cells, .75c, no boot, no decoy |
| 109 / 133 | KryneLamiya (revisited) | Tomasev | 5-cell SSD oneshot clear, .66c scan with `seq }p,>p` / `sne *p,@p`; revisited adds q^4 + boot |
| 123 | Infravision (infravision.red) | inversed | .80c prescan + SPL wipe -> .66c DJN-stream scan -> SSD clear |
| 129 | Shot to Nothing (shottonothing.red) | Schmidt | q^4 -> two-pointer (4000 apart) mod-10 oneshot -> SPL clear from both pointers with DJN streams |
| 154 | The Machine (machine.red) | Marsden | "Blur 2", mod-10 step 70 -> d-clear |
| 235 | One Shot (oneshot.red) | Kendall | step 30/sep 15 oneshot; spl, spl, anti-imp dat chosen by pointer overwrite |

### How it fits

Scanners rarely pair with another body; what goes alongside is an opening (quickscan), a boot and decoys. With a quickscan in front, a stone or paper close to the warrior gets hit in the first ~40 cycles, and the boot hides the 10-cell engine. Decoys work in both directions. Their own decoys use every SPL modifier and mode variant (Excalibur, Z++, One Shot, The Machine) so that a SEQ/SNE scanner comparing `.I` sees every cell as different and wastes time. Infravision is built to cope with other people's decoys: the prescan wipes the first find and then goes on scanning.

Matchups: strong against paper and against other scanners that are slower or less bomb-resistant. Weak against stones: the stone's bombs give false finds, which is why bomb detection (King Cobra), mod-10 blurs that keep bombing anyway, and Perseus's "poor man's air bag" (`jmn.a scan,{chg`, which drops into the clear when hit) exist. Against imps they get ties unless the clear is anti-imp (`dat <2667`, Perseus's two gates, One Shot's third pass).

Failure modes seen in the code:
- A wipe or clear that hits its own code. Every clear writes a bomb whose B field (`DSAFE`, `SSAFE`, `dcgap`, `cstart`, `clr-gate+2`) moves the pointer past the code when it wraps onto its own pointer cell.
- A self-check that is too short lets the scanner wipe itself. In the Discord/Excalibur line this is used on purpose as the switch to the clear.
- A oneshot fooled by a decoy commits its whole clear to the wrong place. Bomb detection and Infravision's prescan are the countermeasures.
- One process scanning means one bomb on the loop ends the scan. Twin Storms answers by running two scanners.

Wrong first-pass tags: King Cobra and Kaitain are tagged `stone` (there is no stone, only the quickscan bombs), and their "small replicator" hint comes from the trailing imp. Infravision is tagged `decoy` only because it says "not fooled by decoys". The Machine and Perseus are tagged `stone`, and Perseus `imp`, from comments about imps; neither has a stone or an imp. HazyLazy A 70 and Hazy Lazy are tagged only `clear` but are blur scanners. Shot to Nothing is tagged `qscan,clear` and is missing `oneshot`. Pendulum, Herald and Xenosmilus are missing `clear`, although their counter switch turns them into a DAT clear.

### Our blocks

| Hill part | Block(s) | Notes |
|---|---|---|
| Agony pair scanner + fixed wipe + switch to d-clear | `pair-wipe-scanner` (STREAM for Excalibur's DJN stream, CLEAR 1) | Close match. Our switch is "wipe would reach own image", which is Discord/Excalibur's. Kusanagi's ptr.A-wraps timer and Eternal Exile's timed scan are not modelled. |
| Blur scanner | `blur-scanner` (CLEAR 1, SCANS) | Ours lays LEN bombs forward per find; the hill blurs move one ever-growing carpet, use mod-10 steps, and switch when the scan reaches their own body or a counter runs out. |
| CMP scanner with carpet | `cmp-carpet-scanner` | Runs forever, needs `trigger`; HazyLazy-like with a trigger. |
| Oneshot | `opening-cmpscan` / `opening-sne` + `finisher-guarded` or `finisher-outward`; recipe `one-shot` | No bomb detection (2-pair check), no prescan-then-wipe, no imp failsafe branch. |
| D-clear | `finisher-dclear` | Hill d-clears walk forward with `>gate` and an anti-imp `dat <2667`; ours walks backward. |
| SPL/DAT two-pass | `finisher-twopass`, `finisher-counted`, `finisher-multi`, `backward-clear` | Pass switching is by our own counter, not the DJN-stream timer or pointer-overwrite tricks. |
| Gated clear | `finisher-gated` | Fine for the gate idea; Eternal Exile's own-code gate is different. |
| Pendulum .75c wipe-until-empty | `scanner` (BOMB 1) is the nearest | Gap: variable-length wipe and SPL->DAT flip by self-find count. |
| Decoys, self-image decoy | `decoys`, `decoy-maker` | Gap: decoys that copy the warrior's own code (Discord decoy, Excalibur mirror) and decoys mixing every modifier to defeat `.I` compares. |
| Quickscans | `opening-qscan-lattice`, `opening-qscan-decode`, `opening-quickscan`, `probe-burst` | Lattice matches Metcalf/Kaitain; q^4 mutation table and inversed's q^i are approximated by `opening-qscan-decode`. |

Gaps with no block: spl/spl/jmp trap scanner (Z++); Crystal Clear and other DJN-stream-timed SPL->DAT clears (King Cobra/KryneLamiya/Perseus); One Shot's three-pass pointer-overwrite clear; two-pair bomb detection; imp failsafe spun off at the find; booting two independent scanners (Twin Storms) as one block (approximable with `copies` + `blur-scanner`); copy-ahead boot (start the copy before it is complete).

## Vampires, switchers, evolved warriors and outliers

A vampire throws JMP "fangs" instead of DATs: an enemy process that runs one is sent into a *pit* the vampire owns, where it splits uselessly or loops until it dies, and the vampire uses the moment it notices a prisoner to switch to a SPL/DAT core clear. On this hill vampires are a small, old minority (2 in the top 50, about 70 rows tagged `vampire`, many of them wrongly); the strong ones (Forgotten Lore II #9, Carmilla #46, Unpit #63, Curse of the Undead #99, Nosferatu #100) all scan, bite and then clear. They beat stones and clears whose loops run a fang, and lose to papers, which copy the fang into their offspring or overwrite the pit. This section also covers what "P-space switchers" turn into on a hill without P-space, the evolved warriors, pure imps, and the untagged rows.

### Ingredients

**1. The fang, aimed indirectly.** Every strong vampire here aims the fang *through* a pointer rather than at the pit directly, so a `}`/`>` hit on the fang moves only the pointer, not the prisoners. The trick that makes one stepping instruction serve as both scan pointer and bomb: the fang's A and B fields move in opposite directions by STEP, and their sum always points back at the pit.

```
fang  jmp  @STEP, pit-STEP     ; A: scan offset, B: bomb offset
inc   dat  STEP, -STEP          ; add inc,fang each pass
; copy at fang+B: (fang+B)+A == pit, and pit.B==0, so JMP @ lands in pit
```
(Curse of the Undead.) When the scan side (`*fang`) finds something, the vampire copies the fang there too and runs `mov.a #0, *fang`: with its A zeroed, the copy points through its own B-field, which equals `pit - here`, so it also lands in the pit. Carmilla goes one step further: the fang points at a relay cell `atrace jmp @0, -dtrace` that the start code places at `pit+dtrace`, which `jmp @0` then forwards to the pit ("anti-trace", so a scanner following the fang finds the relay, not the pit). Lore II puts the pointer to the trap 218 cells from `bite` and writes copies at ±1 "in case of +1/-1 hit".

**2. The pit.** Three designs appear:
- *Self-splitting stun pit* (Curse, Nosferatu, Bloodlust): `spl #0,{0 / spl {0,}0 / jmn.a trap+1,trap`. Prisoners multiply in place, and the `{0` side effects make `trap` nonzero, which is the signal (`jmz.f vamp, trap` falls through).
- *Counting pit* (Lore II): `trap spl -1,<flag` sends prisoners to a `spl #x,<flag` that loops on itself, decrementing `flag`; `spl #4000,}1` counts entries into `tsrc jmn.a #0-MAXPROCESSES,#-3`, and when MAXPROCESSES prisoners have entered they all fall through to a DAT. The `<flag` is the signal.
- *Leaky pit* (Carmilla, One bite): a single `pit djn #0,#0`. A prisoner loops on it, decrementing `pit.B`; the first decrement makes `pit` nonzero (the signal), and after 8,000 decrements the prisoner falls out into the empty core and dies, even if the vampire has been killed meanwhile.

**3. No pit at all (Unpit, P. Kline).** I traced it alone to confirm. The fang is `jmp >unpit-first, >first`, and its two copies are written each pass by `mov fang,*fang` and `mov {unpit,@fang`. The second copy jumps through `>unpit`, where `unpit dat 0,0` is the vampire's own sentinel: the prisoner lands on a DAT and dies, and the postincrement bumps `unpit.B`. The loop `jmz.f vamp, unpit` sees the nonzero cell and falls into the clear. The bite kills the process outright, and the JMP's own postincrement is the detector. Unpit also gets the pointer for free: `mov {unpit,@fang` decrements `unpit.A` to -1 so the source is `fang`, and the next `sub.x incr, }unpit` hits `unpit-1` = `fang` and restores `unpit.A` to 0.

**4. Airbag launch.** Unpit starts from `spl 2 / spl 1 / djn.f {vamp+3, ...`: three processes each predecrement the A-field of `jmz.f 0, unpit` (to -1, -2, -3) and jump to vamp+2, vamp+1 and vamp. So the loop ends up as `jmz.f vamp`, entered at three staggered points: three processes share a 4-instruction loop, and one stray hit does not stop it. One bite ("One-hit vampire with airbag") does the same job differently.

**5. DJN payloads and streams.** Lore II alternates two throws in one loop: `b2 djn.f #1,1` goes to the A pointer every pass (aimed at self-splitting loops like `spl 0 / mov / djn.f -1,>x`, according to its comments), and fangs go to scanned nonzero cells. Carmilla's step constant is `inc djn.f #-step,<step`. After `spl cs0` launches the clear, the original process falls onto that line and stays there as a one-instruction DJN stream, "leaving one process in the djn stream. If the clear is destroyed, there is still a chance of a draw."

**6. The clear.** Almost always the same SPL-then-DAT clear behind a gate:
```
bptr  dat  1, 11             ; *bptr selects the bomb: first SPL, later DAT
dptr  spl  #DEC, 13
clear mov  *bptr, >gate
      mov  *bptr, >gate
      djn.f clear, }dptr     ; }dptr walks the selector
```
(Curse/Nosferatu; DEC 1700/1710.) Lore II uses a self-modifying variant (`spl #11,{6568` "will become spl #11,{1") whose gate stops `MOV.I #1143,*0` imps.

**Costs.** The scan-bite loop is 6 instructions: `add / mov fang,@fang / jmz.f / mov / mov.a / jmz.f trap`. With no find it loops after 3, so it bombs and scans at .33c. Nosferatu bombs its A side with `tnt mov step,1` and scans and bites the B side, ".33c vampire / .33c bomber". tvamp (John K W) skips scanning and drops 4 fangs per 7-instruction loop ("true 57%c"). Its pit `spl 0 / mov -2,>-4 / jmp -1` makes prisoners DAT-clear the core for it, and after the `djn loop,#0` counter runs out the vampire becomes a clear itself.

**STEP choice.** Steps are mod-7-ish or large odd numbers so that fangs never land in the vampire's own body and the A/B pointer pair covers the core evenly: Carmilla 5851 with `time 471` (the first fang lands `step*time` away), One bite 2511 ("mod~7, bombs 7 cells apart" so a clear that falls through its DJN cannot stun itself), Curse 5904, Nosferatu 5936, Unpit 7389, Bloodlust 4395.

### Method (the steps)

1. Start code (Carmilla, Bloodlust, Lore II) places the remote parts: the pit or relay cells (Bloodlust puts its pit and fang pointer as EQU addresses half a core away, outside its 18-line body, using `mov pit,trap / mov vbomb,fang`), then jumps into the loop. Lore II runs its 4-line boot *inside* the scan loop: `jmz.f boot,<bite` re-enters boot on every empty scan, and `mov -5,}lj` overwrites one boot line with DAT per pass while stepping `lj`'s target forward, so after four passes the boot is erased and the loop has shrunk to 3 instructions.
2. Main loop: advance the fang, bomb one side, scan the other. On a find, bite it (and in Curse/Carmilla, re-aim the bitten copy at the pit).
3. After every bite, check the signal cell (pit, flag or sentinel). If it is still zero, keep scanning.
4. When the signal fires, jump to the clear (Carmilla uses SPL so a process stays behind as a stream). The clear runs SPL first, so prisoners and survivors are stunned, then DAT. The clear's first targets are near the pit, which wipes the prisoners last.
5. Endgame: the gate and DAT pass. In Lore II, when the clear overwrites the trap pointer it "will then point to a second trap", made at boot by `mov >tsrc,>tdest`.

### Variants on the hill

| rank | warrior (file) | author | variant |
|---|---|---|---|
| 9 | Forgotten Lore II (lore2.red) | David Moore | scanning vamp + DJN.F thrower in one loop; counting pit; boot erased from inside the loop; `flag` next to `bite` so a silk hitting the fang also skips straight to the clear |
| 46 | Carmilla (Carmilla_3.red) | inversed | one-hit scanning vamp; relay (anti-trace) pointer; DJN pit; SPL to clear leaves a DJN stream |
| 63 | Unpit (unpit.red) | P. Kline | no pit: the fang kills, and its postincrement trips a sentinel; 3-process airbag loop |
| 99 | Curse of the Undead (curseoftheundead.red) | John Metcalf | classic scan/bite, `mov.a #0` re-aim, spl#0 pit |
| 100 | Nosferatu (nosferatu.red) | John Metcalf | scan B side, bomb A side with `mov step,1` |
| 121 | Bloodlust (bloodlust.red) | John Metcalf | 18-line body; pit and fang pointer half a core away; `inc spl #-step,<step` doubles as step and launch |
| 324 | One bite (onebite.red) | inversed | qscan, then pure .33c fang thrower (no scan) with airbag, DJN pit, SSD clear |
| 394 | White Mist (whitemistJM.red) | John Metcalf | 3-line vampire + 7 imps (3-point, step 2667) via a binary SPL fan |
| 821 | Mohini v0.1 (mohini01.red) | Ayan Chakrabarti | the pit's first line `mov ptr,check` is run by the *prisoner* and rewrites the vampire's check into a jump to the clear |
| 868 | tvamp (tvamp.red) | John K W | 57%c blind thrower; prisoners run a DAT clear |

**Wrong tags.** `vampire` fires on "anti-vamp" comments: pulp, paperone, papery and avamppaper are papers with anti-vampire bombs, not vampires. `pspace` is wrong for every compiled row (next subsection).

### Switchers on a hill without P-space

The engine refuses LDP/STP under `--rules 94nop` (`src/engine/assembler.js`: "these rules have no P-space"). The one file in the folder that uses STP (sptst4dp.red) does not compile under these rules. All 37 rows tagged `pspace` were tagged from comment words ("switch", "no pspace", "w/o ... p-space"). What they actually do is switch *within the round*:
- **Lore II** says it outright: "Instead of using pspace to switch between a vamp and a 1-shot SPL/DAT clear, combine them".
- **Mohini**: the captured enemy flips the switch (see the table).
- **Alternating Raisins swhg** (#54, Steve Gunnell, "semi evolved"): a lattice quickscan. If it finds something, it bombs and then jumps to `boot2` with the boot pointer aimed at component B0, a 12-line evolved SPL paper. If it finds nothing it falls through `add.f adju, dest`, which re-aims the same boot (6 unrolled `mov.i <dest,{dest` × 2 processes) at A0, a 12-line evolved scanner with a SPL/DAT clear. The qscan result picks the strategy. The boot then cleans up after itself: `djn.b *1,#1` sends one process into the copy and lets the other run `dest div.f`, which divides the pointer cell's fields by themselves (leaving 1, 1), and then dies on the DAT after it.
- **Qutrum, He Scans Alone, win, Blitz**: "switch" means an HSA-style scanner switching from SPL carpet to DAT wipe once its own bomb is found. These are scanners, not switchers.

### Evolved and semi-evolved

- **RainRat 94-236 / 94-425** (#912, #905): 100 lines of random-looking code that starts at line 0. I counted executions over 20,000 steps run alone. Only lines 0-4 of the original ever run: `SPL #,# / SPL #,{ / SPL <2190,>85 / MOV.I }-4,}-1 / DJN.F #3913,<-83`. That is two SPL-to-self, one remote SPL, a copy and a DJN that jumps to itself: an evolved paper engine. The other 95 lines are payload copied along with it, executed only now and then in copies (e.g. `SPL.B #34,>-55` copies act as SPL-0 process sinks). They count as length, so scanners find them.
- **RC94 Evolover G007W059** (#1064, untagged): the work is lines 2-3 (`SPL.A #41,<7 / JMP.X >2184,@16`, about 5,850 executions each), plus a short tail.
- **Semi-evolved by Gunnell** (altraisins, consequence, azurewrap): hand-written qscan and boot around evolved components. **Arvon #1** is tagged `evolved` for "evolved from my pst_v3/v4 line", which means tuned constants, not machine-written code.

### Imps and the untagged rows

**Pure imps** are near the bottom of the hill: postimp (`mov.i }0,}0`, #1019), imptest02 (a `spl 0` pump continuously launching a 19-point imp: 7579 ≡ -421 and 19·421 = 7999, #853), mimp. The `imp`-only rows near the top are mislabeled stone/imps. **Rosebud** (#305) boots a 5-line stone (`spl #0 / spl #-step,<step / mov >-step,step+1 / add / djn.f`, step -845) and a binary-SPL imp launcher (`spl 1`×4, `spl 2`, `jmp`, `add.a #2667`), and fills the gap with `spl #stptr,impptr` decoys. **Blue Funk 3** (#453) boots the same Emerald stone (step 3044) 200 cells away and launches a 3-point spiral with Morrell's `jmp >0, imp+k*2667` trick: each process that runs it jumps and increments the target, so successive processes enter consecutive cells. The 78 lines of `dat <imp,<2667` are filler.

**Untagged (sample).** The tagger fails when a source has no strategy text and uses unusual idioms:

| rank | file | really is |
|---|---|---|
| 411 | kosmos.red | qscan, then a silk paper, a remote SPL/MOV clear "satellite" and a 3-point imp "satellite", all launched by one `spl 1` pair |
| 529 | gabriel.red | `add.a/jmz.f` scanner, step 451, with a `spl/spl/dat` wipe around each find |
| 606 | russpost.red | scanner whose pointer is *multiplied* each pass (`mul.a #STEP,@hptr`, STEP = 386·20+1): a pseudo-random visiting order |
| 610 | lavibra.red | jmz.f scanner dropping `spl #-5,1` bombs |
| 653 | astounding.red | Beholder's Eye scanner (`jmz.A`, step 76) + SPL/gate clear |
| 886 | rotldtng.red | "Living Dead": 7 copies of `spl #0,>-10 / djn.I #0,<-10`, CORESIZE/7 apart: self-splitting DJN streams |
| 1042 | scratcher.red | 20 one-line `djn.A #0,<-10` streams, 400 apart, each started by SPL |
| 921 | coresweep.red | two-pointer `sne.x/seq.x >p1,>p2` sweep, 3900 apart, then a SPL/MOV clear |
| 890 | snowflake.red | boots a 4-line SPL-fed dwarf (`spl #snow / add #15 / mov / jmp`); the rest is junk decoy |
| 922 | lethalfrog.red | 3-process mover: `mov.i }-1,>-1 / jmp pStep-1` copies itself 4499 on and jumps there |

### How it fits

A vampire pairs a scanner (to find targets) with a clear (to finish), and the pit turns enemy processes into stunned, harmless ones before the clear arrives. It beats stones and clears: their loops run a fang, and a DJN.F or DJN stream breaks `spl/mov/djn` loops. It beats lone scanners about evenly. It loses to papers: a silk copies the fang into children (Lore II uses `@` fangs and puts `flag` beside `bite` for exactly this case, so a silk hit skips straight to the clear) and spreads faster than the clear. Failure modes visible in the code: the fang or pit gets overwritten by a `mov.i >-1,}-1` neighbour (answered with indirect fangs and relays), and the clear gets bombed before the round ends (Carmilla leaves a DJN process behind, One bite's leaky pit still kills prisoners). The in-round switch, where the round's own events (a prisoner arriving, a qscan hit, the victim itself) choose what runs next, is what this hill uses instead of P-space.

### Our blocks

| hill part | block(s) | gap / difference |
|---|---|---|
| blind fang thrower | `vampire`, `vampire-trap` | ours aim at the pit directly; no A/B dual-pointer fang, no relay (anti-trace) pointer |
| scan + bite | `scan-vampire` (COUNT 1 = gathering pit), `fang-vampire` (the A/B pair sums to the pit, so no `mov.a #0` re-aim is needed; BSTEP adds Nosferatu's bomb side) | match |
| spl#0 stun pit, DJN leaky pit, counting pit | `fang-vampire` PIT 0-2 | match |
| Unpit's pitless kill-and-signal fang; Mohini's victim-flipped switch | `fang-vampire` PIT 3 and PIT 4 | match |
| switch to clear on capture | `trigger` MODE 1 (marker damaged) | close, but the hill's signal is the pit or sentinel being written by prisoners, inside the vampire loop |
| SPL/DAT clear | `finisher-twopass`, `finisher-dclear`, `finisher-gated` | match |
| airbag loop (3 processes in one loop via self-modifying launch) | `spl-stone` PROCS, `hill-stone`, `airbag-vampire` | match |
| DJN.F throw / leftover DJN stream | `djn-stream`, `elf`, `hill-stone` STREAM, `djn-vampire` (throws scattered `djn.f` bombs) | match |
| Living Dead / scratcher streams | `stream-swarm`, `fed-stream-swarm` | match |
| qscan-chosen component (Alternating Raisins) | `fork` (by the opening's probe: found / not found; BY 1: a body / a lone cell), `classify`, `switch` | match |
| multiplicative scan (Russ Post) | `scanner-mul` | match |
| Morrell `jmp >0` spiral launch | `vector-spiral`, `imp-feeder` (imptest02's pump) | same result, different launcher |
| evolved payload (RainRat) | none needed | the 5-line engine is a paper; the 95 inert lines are decoys we could model with `decoys` |

## What our blocks are missing

Each chapter ends with its own block table. This list merges the gaps and orders them by how much of the top of the hill depends on them. The first five are used by most of the top 50, and building them is the shortest route from our recipes to the hill's designs.

| # | Technique | Used by | Nearest block today | Chapter |
|---|---|---|---|---|
| 1 | **MUL-decoded quickscan** — single-factor q^4 (`qdec = 1 + qfac^-1`) is now built as `opening-qscan-mul`. Remaining: the q^4.5 qz-mutation and inversed's two-factor q^i, decoding in ~1 cycle | most top-50 quickscanners | `opening-qscan-mul` (q^4); `opening-qscan-lattice` (loop decode) | openings |
| 2 | **Two-stream quickscan burst**: the second MOV addresses through the bomb just written, 2 bombs per 4 cycles | every quickscan read | `probe-burst` (one stream) | openings |
| 3 | **Fan boot of two bodies**: N processes copy one cell each, copy pointers become jump vectors, k:1 stone-to-paper split, or a `djn #N` counter splitting N-1 / 1 | ranks 1-3, the paper/stone and stone/imp lines | `parboot`, `waveboot`, `par` (independent copy loops) | openings, paper/stone, stones |
| 4 | **Tables in other parts' fields**: quickscan tables in the boot's SPL B-fields or the scan's exit DJN | Hullabaloo, Tolypeutes, Elven King, pdQscan, SnowScan and others | none; block contracts keep private data cells | openings |
| 5 | **Timed stone endings** — the paper/stone self-off is now built (`fanboot-paper-stone`'s stone: TIME self-hit, coprime step allowed). Remaining: the stone/imp variant where the `dat X, >1` bomb lands on the stone's own ADD so the wreck clears the core | Azathoth line, Quicksilver line | `fanboot-paper-stone` (self-off); `fanboot-stone-imp`; `hill-stone` (layout-safe) | paper/stone, stones |
| 6 | **King Cobra clear**: two-pair bomb detection, clear starting at the scan pointer, DJN stream as the SPL→DAT timer, `mov.i #4000,1` imp spun off at the find | King Cobra #4, Kaitain #7, KryneLamiya, Infravision | `one-shot` recipe, `finisher-twopass` (own counter) | scanners |
| 7 | **Armadillo stone switch**: the A-trail copies the stone's SPL over its DJN and floods a gated forward clear; the bomb's B-field (HOP+1) resets the gate on wrap | Tolypeutes #6, Armadillo #33, Elven King #42 | `finisher-gated`, `trigger` | stones |
| 8 | **Silk tails**: a slot after the last stage for a cc clear, silk-imps (last step = 2668), a backward stage `mov {s1,<s2`, a moving last stage `jmz.a @0`, the `mov.i #X, }2667` bomb, Mercenary's moving imp | the quickscan papers, For John, Swarm, Electra | `paper`, `silk3`, `bomb-paper` (end in DAT, stages copy forward and split) | papers |
| 9 | **Imp pumps that serve the stone**: a launcher whose spare process joins the stone (Black Knight), a pump placed where the stone's Nth bomb lands to cap it (Quicksilver), a delayed pump (`djn #0, #5`) | stone/imps ranks 36-112 | `imp-feeder`, `vector-spiral` | stones |
| 10 | **Cheap boot hygiene**: wipe the boot pointer after launch, start the copy running before it is complete | Eternal Exile, Kaitain, Excalibur | `boot` | openings, scanners |
| 11 | **Stronger decoys**: more than 18 cells, every modifier mixed so `.I` compares always differ, a copy of the warrior's own code | Excalibur #10, Z++ #35, Discord #41, Silver Talon | `decoys`, `decoy-maker` | openings, scanners |
| 12 | **Body chosen by the opening**: paper if the quickscan hit, scanner if it did not; or classify the found cell (isolated bomb vs body) | Alternating Raisins #54, Argon | `classify` (reacts to hits on our own marker) | vampires, openings |
| 13 | **Vampire parts**: a fang whose A and B fields move oppositely so their sum stays on the pit, relay (anti-trace) pointers, pit as a choice (stun, leaky DJN, counting), Unpit's pitless kill-and-signal fang, a 3-process vampire loop | Lore II #9, Carmilla #46, Unpit #63 | `scan-vampire`, `vampire-trap` | vampires |
| 14 | **Scanner engines**: Pendulum's .75c wipe-until-empty with a self-find counter, the spl/spl/jmp trap (Z++), One Shot's pointer-overwrite three-pass clear, the hill blur's single moving carpet on a mod-10 step, two booted scanners at once | Pendulum #62, Z++ #35, Twin Storms #31, One Shot | `scanner`, `blur-scanner`, `pair-wipe-scanner` | scanners |
| 15 | **Odd engines**: the `{0,}0` self-adding 3-line stone, the step-17 carpet stone, multiplicative scan steps, many one-line DJN streams core/N apart | Positive Knife, Black Knight, Hullab3loo, Russ Post, Living Dead | `stone`, `elf` | stones, paper/stone, vampires |

The old `paper-stone`/`stone-imp` recipes (`par` of a paper and a stone) lacked the quickscan, the boot, the process ratio and the timed stop. The `fanboot-paper-stone` and `fanboot-stone-imp` blocks now supply all of these in one fan boot (self-metering launch, k:1 or N-1:1 split, timed self-off), behind `opening-qscan-mul`'s q^4 — so the paper/stone and stone/imp lines are built bar the q^4.5/q^i decode refinement (#1) and the stone/imp wreck-clear ending (#5).

### Progress on the gaps

Built on 2026-10-30. Scores are points per round against the top 50 of the 94nop hill (20-100 rounds per opponent), each block in the same tree as the nearest block we had before. Differences under about 0.04 are noise.

| # | Block(s) | Tree | Before | After |
|---|---|---|---:|---:|
| 1 | `opening-qscan-mul` | qscan → burst → stone | 0.437 (lattice) | **0.521** |
| 2 | `probe-burst2` | qscan-mul → burst → stone | 0.477 (`probe-burst`) | **0.549** |
| 3 | `fanboot-paper-stone`, `fanboot-stone-imp` | qscan-mul → burst → paper/stone | 0.676 (`parboot(par(paper, mod-stone))`) | **0.873** |
| 3 | | qscan-mul → stone/imp | 0.287 (`waveboot`) | **0.573** |
| 5 | `timed-stone` (wreck-becomes-clear, or stop after TIME) | quickscan → stone | 0.314 (`spl-stone`) | 0.212 |
| 6 | `oneshot-cobra` (two-pair bomb detection, clear from the find) | bare | 0.238 (`one-shot`) | 0.141 |
| 7 | `armadillo-switch` | quickscan → stone | 0.212 (`timed-stone`) | **0.868** |
| 8 | `silk-imps`, `tail-silk`, `silk-cc` | bare paper | 0.646 (`silk3`) | **0.976**, **0.989**, **0.911** |
| R7 | `lp-paper` | bare, LP hill | 0.513 (`bomb-mice`) | 0.556 |
| 9 | `delayed-pump` | `par(stone, pump)` | 0.365 (`vector-spiral`) | 0.340 |
| 10 | `boot-stone` (pointer wipe, early start) | stone | 0.578 (`boot(mod-stone)`) | 0.564-0.576 |
| 11 | `decoys-mixed`, `decoy-mirror` | qscan-mul → burst → stone + decoys | 0.547 (`decoys`) | 0.586, 0.538 |
| 12 | `fork` combinator, `probe-verdict` | qscan-mul → fork(paper, scanner) | 0.850 (no fork) | 0.280-0.648 |
| 13 | `fang-vampire` (four pits, relay) | qscan-mul → vampire | 0.226 (`scan-vampire`) | **0.377** |
| 14 | `scanner-pendulum` | bare | 0.343 (`blur-scanner`) | 0.235 |
| 15 | `self-add-stone` | quickscan → stone | 0.377 (`mod-stone`) | 0.312 |

The gains are in the hill's deployment and endgame tricks: the MUL decode, the second burst stream, the fan boot, the Armadillo switch and the silk tails. Mechanisms that only pay off inside a hill warrior's full setup (the oneshot's bomb detection, Pendulum, the timed stone) lose when used bare; they are in the catalog for evolution to combine. `fork` loses on this hill because the quickscan finds nothing against most strong opponents, so the "nothing found" body decides the round, and a paper is the better default there.

The gate learned three things on the way: a booted copy holds only its member's cells (before, every booted quickscan failed the gate); `api.ref` resolves a capability in the copy's own frame; and after a boot or a fork, the original or the branch not taken is dead code (`api.inDead`) that an opening may find and a burst may hit.

**Second round** (2026-10-31), the items the first round left open. Same benchmark: top 50, 20 rounds per opponent.

| # | Block or combinator | Tree | Before | After |
|---|---|---|---:|---:|
| 3 | `fanboot(a, b)` combinator | qscan-mul → burst2 → fanboot(`mod-stone`, `silk-imps`) | 0.982 (`fanboot-paper-stone` block) | 0.921 |
| 3 | | qscan-mul → burst2 → fanboot(`spl-stone`, `silk-imps`), K 1 | | 0.928 |
| 4 | `freeB` free B-fields; `opening-qscan-mul` SHARE 1 | the first fanboot tree, table partly in the fan lines | 0.921 (unshared) | 0.811 |
| 6 | `oneshot-cobra-imp` (imp failsafe, pumped clear) | bare | 0.141 (`oneshot-cobra`) | **0.602** |
| 8 | `moving-imp-silk` (Mercenary) | bare | 0.984 (`silk-imps`), 0.986 (`tail-silk`) | 0.978 |
| 9 | `knight-pump` (the launcher's spare joins the stone) | bare | 0.687 (`fanboot-stone-imp`) | **0.783** |
| 9 | `capped-pump` (the stone's Nth bomb stops the pump) | bare | 0.687 | **0.800** |
| 10 | `boot` WIPE 1 | boot(qscan-mul → burst2 → `mod-stone`) | 0.255 (WIPE 0) | 0.271 |
| 14 | `trap-scanner` (Z++'s spl/spl/jmp trap) | bare | 0.343 (`blur-scanner`) | **0.427** |
| 14 | `finisher-overwrite` (One Shot's clear) | qscan-mul → clear | 0.322 (`finisher-guarded`) | **0.904** |
| 14 | | cmpscan → clear | 0.238 (`one-shot` recipe) | **0.736** |

- **One Shot's clear is the biggest gain of the round.** It clears through the opening's own probe, and each time the clear wraps past the warrior it resets the pointer and starts its next pass (SPL, SPL, then DAT). Behind the MUL quickscan it nearly reaches the silks.
- **King Cobra's imp failsafe** couldn't pass a solo gate because a lone imp laps the core in about 16,000 cycles and overwrites its own warrior. An `SPL #0` pump fixes that: the clear's processes outnumber the imp, so the shared clear pointer catches it from behind.
- **The `fanboot` combinator** boots any two bodies that accept N processes entering together. It falls a little short of the hand-made `fanboot-paper-stone` block, whose counted stone switches itself off.
- **The shared table works**, saving 3 cells (6 with K 4 on 94x). It scores lower because the moved table cells move their probe locations, and on this hill the regular lattice scans better. It is off by default.
- **Fixes in the gate and the watches:**
  - A copy counts as the warrior's only once a process has run in it, so a burst that lands where a copy will go is not a self-hit.
  - The openings' exit check waits until no process is left in the opening, so the boot's wiping process doesn't look like a hand-on.
  - The burst's watch ignores an imp crawling over its abandoned code.

**Third round** (2026-10-31), the rest of the list. Same benchmark.

| # | Block, combinator or tree | Tree | Before | After |
|---|---|---|---:|---:|
| 1 | `opening-qscan-mul45` (q^4.5) | qscan → burst2 → `mod-stone`, 50 rounds | 0.576 (`opening-qscan-mul`) | 0.550 |
| 1 | `opening-qscan-qi` (two-factor q^i) | the same | 0.576 | 0.567 |
| 12 | `fork` BY 1 (a body, or nothing / a lone cell) | fork(qscan-mul → `probe-verdict`, `finisher-overwrite`, `tail-silk`) | 0.904 (qscan-mul → `finisher-overwrite`) | 0.978 |
| 12 | `fork` (hit or nothing) | fork(qscan-mul, `finisher-overwrite`, `silk-imps`) | 0.904; 0.859 (qscan-mul → `silk-imps`) | **1.026** |
| 12 | | fork(qscan-mul, `finisher-overwrite`, `tail-silk`): recipe `hill-fork` | | **1.049** |
| 13 | `airbag-vampire` (3 processes in one loop) | bare | 0.500 (`fang-vampire`) | 0.292 |
| 13 | `djn-vampire` (Carmilla's `djn.f` throws) | bare | 0.500 | 0.416 |
| 14 | `blur-carpet` (one moving carpet, mod-10 step) | bare | 0.343 (`blur-scanner`) | **0.524** |
| 14 | `twin-storm` (two booted scanners) | bare | 0.343 | **0.752** |
| 15 | `scanner-mul` (Russ Post's multiplied pointer) | bare | 0.419 (`scanner`) | 0.349 |
| 15 | `carpet-stone` (step 17) | qscan-mul → stone | 0.381 (`mod-stone`) | **0.502** |
| 15 | `stream-swarm`, `fed-stream-swarm` (Living Dead) | bare | 0.127 (`elf`) | **0.494**, **0.754** |
| 9 | `knight-pump-stream` (Black Knight's `DJN.F` stream) | bare | 0.783 (`knight-pump`) | 0.783 |
| 14 | `finisher-overwrite-antiimp` (One Shot's anti-imp DAT) | qscan-mul → clear | 0.904 (`finisher-overwrite`) | 0.928 |

- **The best tree in the book** comes from the fork, which lost in the first round. Behind the MUL quickscan, a hit now goes to One Shot's clear, which starts from the found cell, and "nothing found" goes to a silk. Each body covers the other's weak matchups. It is the `hill-fork` recipe, and an evolution seed.
- **Evolution can now reach the new parts.** The new mutations `fan` (a `par` of two bodies becomes a `fanboot`, and back) and `fork` (an opening's body gains a second body to choose between) join `tune`, which already reaches SHARE, WIPE and BY.
- **`twin-storm` is a block, not `copies(scanner)`.** A copied scanner knows only its own image, so it finds its sibling and bombs it, and the gate rightly refuses that. Composing it would take `apart` and `copies` telling each member where its siblings are.
- **The streams are safe, with limits.** `knight-pump-stream` aims its stream at a cell the stone's bombs keep resetting. It is safe while the stone runs; if the stone dies and the pump runs about 2,100 more passes, the stream reaches the pump.
- **The anti-imp DAT:** in the clear's DAT pass, the bomb leaves a copy of itself that later passes copy, so the last bomb doesn't need to point at itself.

Both of those are now done:
- **`linked` sees the protected span**, so `djn-vampire` is refused at link time wherever it isn't the last protected block.
- **`copies` and `apart` tell each member where its siblings are** (`ctx.siblings`). The copies run the same code and can't tell which copy they are, so each avoids every window k·D away. The `scanBody` scanners skip those windows, which makes `copies(scanner)` and `apart(scanner, bscan-body)` legal.
- **Composing plain scanners doesn't pay**, though: two copies of `scanner` score 0.153 and three 0.115, against 0.419 for one; `apart(scanner, bscan-body)` scores 0.264. Each copy gets a share of the cycles, so `twin-storm`'s 0.752 comes from its engines (SPL carpets, then a clear), not from there being two of them.

Every gap the book listed now has a block.

**Fourth round** (2026-10-31): the last two vampire differences, as `fang-vampire` parameters. The tree for both is qscan-mul → `fang-vampire`, 94nop top 50, 20 rounds.

| Parameter | Before (PIT 0, stun) | After |
|---|---:|---:|
| PIT 4: Mohini's pit, where the prisoner rewrites the vampire's `jmp loop` into a jump to the clear | 0.377 | 0.374 |
| PIT 4 with RELAY 2000 | 0.377 | 0.309 |
| BSTEP 80 (Nosferatu's bomb side) | 0.377 | 0.322 |
| BSTEP 200 | 0.377 | 0.297 |
| PIT 4 with BSTEP 80 | 0.377 | 0.309 |

- **Mohini's pit is as good as the stun pit, and no better.** The vampire's check after a bite becomes a plain `jmp`, the same length as `jmz` on the pit.
- **The bomb side costs points.** Its bombs must stay on a lattice whose spacing gcd(BSTEP, 8000) is wider than the warrior, so they reach only 1 cell in 80 or so, and they halve the scan rate. Nosferatu bombs the whole core, which only its own layout allows. `linked` refuses a BSTEP whose lattice would cross the warrior or the relay.
- **The vampire table above now reads "match" on every row.**

## Reproducing the census

```bash
node scripts/hill-recipes.js --hill 94nop
```

It fetches the hill listing, uses the cached warrior files in the system temp folder (`zorewars-hills/94`, filled by any `--hill koenigstuhl:94nop` command), compiles each warrior, runs it alone once and writes [hill-recipe-index.json](hill-recipe-index.json): rank, name, author, score, length, parts, solo behaviour and the first 200 characters of `;strategy`. The other hills work the same way (`--hill 88`, `lp`, `94x`), but our cache holds only their top 50.

The warriors are their authors' work, published on the [Koenigstuhl hills](https://asdflkj.net/COREWAR/koenigstuhl.html). The skeletons in this book are generic reconstructions with placeholder constants, with a few short quoted lines credited to their warriors.
