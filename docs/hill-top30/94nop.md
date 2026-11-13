# Koenigstuhl 94nop top 30: source-level breakdown

Method: every file `01-*.red` .. `30-*.red` was read in full and assembled with `zorewars compile --rules 94nop`; behaviour (max processes, cells executed, solo survival) was measured with `zorewars species`. Mechanisms below are from the code, not the `;strategy` lines. Anything derived by hand-tracing self-modifying code that I could not confirm in the simulator is marked **(uncertain)**.

"len" is the assembled length including `dat 0,0` padding; "code" is the number of non-padding instructions (what would have to fit in a 50-instruction entry). No warrior assembles to 50 or fewer; eight have 50 or fewer code-bearing instructions (Arvon 50, Azathoth 50, Kaitain 48, Forgotten Lore II 22, Ghost Murmur 40, Escaped Experiment 40, Kusanagi 20, Borg 39).

## Summary table

| # | Name | Author | len (code) | <=50? | Archetype | Opening | Payloads (processes) | Endgame |
|---|---|---|---|---|---|---|---|---|
| 1 | Arvon | Kammann & Forge-AI | 81 (50) | no (code yes) | qscan -> paper/stone fan boot | Metcalf one-MUL lattice, 24 cells, 2-stream burst 15x step 9 | stone (18) + 3-stream silk (6) | stone bombs itself asleep; paper |
| 2 | Azathoth | John Metcalf | 100 (50) | no (code yes) | qscan -> paper/stone fan boot | same form, 24 cells, burst 21x step 7 | stone (18) + silk (6) | stone sleeps; paper |
| 3 | pst_v4 | Kammann & Forge-AI | 81 (54) | no | qscan -> paper/stone fan boot | inversed two-factor q^i, 24 cells, burst 21x step 9 | stone (18) + silk (6) | as Arvon |
| 4 | King Cobra | inversed | 100 (59) | no | oneshot scanner + SPL/DAT clear + imp | two-factor q^i, 34 cells, burst 20x step 5 | oneshot scanner (1) | SPL clear -> DAT clear, single imp failsafe |
| 5 | Kaitain | Kammann & Forge-AI | 100 (48) | no (code yes) | oneshot scanner + clear + imp | Metcalf lattice, 24 cells, burst 15x step 9 | King Cobra body (1) | as King Cobra |
| 6 | The Collective | Roy van Rijn | 100 (62) | no | qscan -> booted LP-style bombing paper | q^4.5 (van Rijn 34-cell form), burst 19x step 6 | counted-copy paper (1, +1 per generation) | paper |
| 7 | Tolypeutes | Roy van Rijn | 100 (62) | no | qscan -> stone/imp | q^4.5, 34 cells in 27 lines | Armadillo stone (4) + 3-point imp pump (1) | stone -> gated d-clear; continuous spiral |
| 8 | Hullab3loo | Roy van Rijn | 100 (59) | no | qscan -> paper/stone fan boot | q^4.5, 33 cells, burst 19x step 7 | stone step 17 (12) + Moore-style paper (6) | stone sleeps; paper |
| 9 | Forgotten Lore II | David Moore | 100 (22) | no (code yes) | scanning vampire + DJN bomber -> SPL/DAT clear | none | vampire scan .33c (1) | SPL clear -> DAT clear with gate |
| 10 | Excalibur | inversed | 100 (97) | no | decoy + booted Agony-style scanner | none (51-cell SPL decoy instead) | pair scanner .66c, 16-SPL wipe (1) | SPL-pumped DAT clear |
| 11 | Ghost Murmur | John Metcalf | 100 (40) | no (code yes) | qscan -> blur scanner | Metcalf lattice, 24 cells, burst 12x step 7 | blur scanner, 492 probes (1) | SPL-pumped d-clear |
| 12 | The Art of CoreWar | Sascha Zapf | 100 (59) | no | qscan -> 2 papers | qBob two-MUL, 38 cells, burst 19x step 6 | 2 x 3-stage silk (8 each) | paper |
| 13 | DanceOfFallenAngels | Nenad Tomasev | 100 (60) | no | qscan -> paper/stone fan boot | q^4.5, 33 cells | stone step 1471 (16) + 3-stage silk (8) | paper |
| 14 | Hullabaloo | Roy van Rijn | 100 (59) | no | qscan -> paper/stone fan boot | q^4.5, 33 cells | stone step 3039 (12) + Moore paper (6) | stone sleeps; paper |
| 15 | Escaped Experiment | BigJk | 100 (40) | no (code yes) | qscan -> blur scanner | Metcalf lattice, 24 cells, burst 18x step -7 | Ghost Murmur body, unchanged (1) | d-clear |
| 16 | Ziggy | Roy van Rijn | 100 (59) | no | qscan -> paper/stone fan boot | q^4.5, 33 cells | stone 3039 (12) + backward-copy paper (6) | stone sleeps; paper |
| 17 | luca | Sascha Zapf | 100 (74) | no | qscan -> paper/stone fan boot | "Q3.14": 19 SEQ pairs, 38 cells, burst 20x step 5 | Hullab3loo stone (12) + paper (6) | stone sleeps; paper |
| 18 | Son of Vain | Oversby/Pihlaja | 100 (62) | no | qscan -> stone + d-clear + imp | q^4 one-MUL, 28 cells, burst 13x step -7 | stone (4) + d-clear (1) + 3-point imp pump (4) | gated d-clear from the start, spiral |
| 19 | Borgir | Christian Schmidt | 100 (59) | no | qscan -> paper/stone fan boot | q^4.5, 33 cells, burst 14x | stone 2862 (12) + Moore paper (6) | paper (stone never stops) |
| 20 | pdQscan | P. Kline | 96 (59) | no | qscan -> 4 papers | one-MUL, 10 units, 40 cells, burst 16x step 6 | 4 x 2-stage silk (6 each) | paper |
| 21 | Kusanagi | inversed | 100 (20) | no (code yes) | decoy maker + Agony-style scanner | none (4-line decoy maker) | pair scanner .66c, 2x8 SPL wipe (1) | SPL-pumped DAT clear |
| 22 | Eternal Exile | inversed | 83 (54) | no | qscan -> booted scanner with fixed wipe | two-factor q^i, 24 cells, burst 20x step 7 | pair scanner .66c, 16-SPL wipe, 712 probes (1) | SPL-pumped d-clear |
| 23 | Gods Of Destiny | Nenad Tomasev | 100 (61) | no | qscan -> paper/stone fan boot | q^4.5, 33 cells | stone 3039 (16) + 3-stage silk (8) | stone sleeps; paper |
| 24 | lzma2 | NDusN | 100 (65) | no | qscan -> paper/stone fan boot | q^4.5, 33 cells, burst 20x step 5 | stone 3039 (18) + 3-stage anti-imp silk (9) | stone sleeps; paper |
| 25 | Borg | John Metcalf | 100 (39) | no (code yes) | qscan -> LP-style paper in place | Metcalf lattice, 24 cells, burst 18x step -7 | counted-copy paper (1, grows) | paper |
| 26 | King of Metal | Christian Schmidt | 100 (59) | no | qscan -> paper/stone fan boot | q^4.5, 33 cells, burst 14x | stone 2862 (12) + Moore paper (6) | paper |
| 27 | clrsrc | Kammann & Forge-AI | 83 (54) | no | qscan -> booted scanner with fixed wipe | two-factor q^i, 24 cells, burst 15x step 5 | Eternal Exile body, 18-SPL wipe (1) | d-clear |
| 28 | Neith | inversed | 100 (60) | no | qscan -> paper/stone fan boot | q^4.5, 33 cells, burst 20x step 7 | stone hop 473 (16) + 2-stage bombing silk (8) | stone sleeps; paper |
| 29 | Twin Storms | inversed | 100 (54) | no | qscan -> two bomber-scanners -> clear | two-factor q^i, 32 cells, burst 20x step 5 | 2 x Origin-of-Storms engine (1 each) | SPL-pumped d-clear, twice |
| 30 | Spiritual Black Dimension | Christian Schmidt | 100 (59) | no | qscan -> paper/stone fan boot | q^4.5, 33 cells, burst 14x | stone 2862 (12) + Moore paper (6) | paper |

## Block census (of 30)

**Opening**
- Quickscan of any kind: **27** (none: Forgotten Lore II, Excalibur, Kusanagi).
  - q^4.5, six SNE/SEQ units then a multiplier bump and two-line units (33-34 cells in 27 lines, one MUL): **12** (Hullab3loo, DOFA, Hullabaloo, Ziggy, Borgir, Gods Of Destiny, lzma2, King of Metal, Neith, SBD in the 33-cell form; The Collective, Tolypeutes in van Rijn's 34-cell form). The dominant variant.
  - Metcalf one-MUL lattice, six units, 24 cells in 18 lines, 30 lines complete: **6** (Arvon, Azathoth, Kaitain, Ghost Murmur, Escaped Experiment, Borg).
  - inversed two-factor q^i (A and B fields hold independent locations, MUL.F / MUL.X): **5** (pst_v4, King Cobra, Eternal Exile, clrsrc, Twin Storms; 24, 34, 24, 24, 32 cells).
  - older one-MUL q^4 without the bump: **2** (Son of Vain 28 cells, pdQscan 40 cells in 10 units).
  - two-MUL qBob: **1** (The Art of CoreWar, 38 cells). Additive "Q3.14" that reads the SEQ's own operand as its table: **1** (luca, 38 cells).
  - Attack after a hit: **27 of 27** use a two-stream DAT burst (a bomb on the pointer and a second write 60-90 cells away through the first bomb's field); 12-21 loops, step 5-9.
- Decoy built on purpose: **3** (Excalibur 51 mixed SPLs, Kusanagi 4-line decoy maker, Forgotten Lore II copies a second trap). Every booting warrior also leaves its qscan and source image behind.

**Boot**
- Boots its payload away: **25**. In place: **5** (Forgotten Lore II, Ghost Murmur, Escaped Experiment, Kusanagi, Borg).
- Lockstep fan boot where the copy pointers are the launch vectors: **18** (the 14 paper/stones, Art of CoreWar, pdQscan, Tolypeutes, Son of Vain). Fan size 6: 11; 8: 4; 9: 1 (lzma2); 4: 2.
- Serial copy loop or unrolled MOVs: **7** (King Cobra, Kaitain, Eternal Exile, clrsrc, Twin Storms, Excalibur, The Collective).
- Boot pointer erased afterwards: **5** (King Cobra, Kaitain, Eternal Exile, clrsrc with `mov #0,{0`; Forgotten Lore II overwrites its setup lines).
- Quickscan table kept in the boot SPLs' B-fields: all 12 q^4.5 warriors plus Son of Vain, pdQscan, Art of CoreWar.

**Payloads**
- Stone: **16**. "H-stone" (`mov bomb,@p / add #2s,p / mov bomb,}p / djn.f`): 7; Azathoth bidirectional stone: 3; Schmidt 2862 stone: 3; one-offs: DOFA, Tolypeutes (Armadillo), Son of Vain.
- Paper: **18**. Moore-style 6-line bombing paper: 6; multi-stage `spl @0` silk: 6; Azathoth 5-line 3-stream paper: 3; LP-style counted-copy loop: 2 (The Collective, Borg); Ziggy's backward-copy paper: 1.
- Paper + stone together: **14**. Paper only: 4. Stone/imp: 2.
- Imp: **4**. Continuous 3-point (2667) pump: 2 (Tolypeutes, Son of Vain). Single plain imp as a failsafe: 2 (King Cobra, Kaitain). No 7-point (1143) spiral, no binary or vector launcher anywhere in the top 30.
- Anti-imp DAT (`dat <2667,<5334` or `<2667` in a clear bomb): 10 papers, 5 clears.
- Scanner: **10**. Agony-style pair scanner with fixed-length SPL wipe: 4 (Excalibur, Kusanagi, Eternal Exile, clrsrc); oneshot: 2; blur: 2; vampire: 1; bomber-scanner: 1.
- Clear: **12** (all 10 scanners, Son of Vain's concurrent d-clear, Tolypeutes' stone-to-clear). Timed SPL-then-DAT: 3 (King Cobra, Kaitain, Forgotten Lore II). The rest are a `spl #`-pumped `mov bomb,>p / djn.f -1,>p` DAT clear.
- DJN stream folded into a loop: about 17 (most stones, King Cobra/Kaitain, Excalibur, Forgotten Lore II's DJN bombs).

## The shared parts, once

Four pieces recur so often that the per-warrior notes only name them.

**Metcalf lattice quickscan (30 lines).** `qdec = 1 + qfac^-1 mod 8000`. Six units of `sne X,X+g / seq <tab,Y / jmp-or-djn decode` test 4 cells each: the `<tab` operand both decrements the table entry and addresses the second location, so a hit in either half leaves the right factor in the table. Which unit fired is recorded by the unit's third line mutating the decoder's pointers (`}q1`, `{qdecode`, `djn.a`). One `mul.b *q1,qptr` rebuilds the address, `sne <qtab0,@qptr / add.b qtab1,qptr` picks the occupied cell of the pair, then the burst. Four of the six table entries are B-fields of live instructions.

```
qdecode mul.b  *q1,    qptr
q0      sne    <qtab0, @qptr
q1      add.b  qtab1,  qptr
q2      mov    qtab2,  @qptr      ; bomb on the pointer
qptr    mov    qtab2,  *qdec      ; second stream through the bomb's A-field (qgap)
        add    #qstep, qptr
        djn    q2,     #qtime
```

**q^4.5 quickscan (27 scan lines + 8 decoder lines).** `qy*(qz-1) = 1 mod 8000`. Six units as above (24 cells). Then `seq >qptr, ...` tests one more pair and post-increments the live multiplier from qz to qz+1; three two-line `seq / jmp` units reuse the already-decremented table against the new multiplier (6 cells), and a final `jmz.f boot, cell` tests one more: 33 cells. The table is `qa1,qa2` in two DATs, `qb1..qb3` in the B-fields of the three boot SPLs and `qc2` in the bomb. Burst: `mov qtab3,@qptr / mov qbomb,}qz / sub #qstep,qptr / djn -3,#qtime`, bomb `dat >qoff,>qc2`.

**inversed q^i.** `found mov qxa, }qxb` holds two unrelated locations. Each unit compares an A-location with a B-location and both again `qstep` on (or the cross pair, in King Cobra and Twin Storms). `mul @dec1,found` multiplies both fields by a table pair; `mul.x qtab,qtab` squares the table for the last unit. `sne *found,@found / add qinc,found / seq nil,*found / mov.x found,found` picks the pair and swaps the occupied cell into the B-field.

**Six-process fan boot.** `spl 2 / spl 1 / spl 1` gives 6 processes; each runs `mov <p,{p / mov <src,{s` once, so 6 cells of each body are copied and the A-fields of `s` and `p` end pointing at the copies. `s spl sboot / spl *s / spl *s / p djn.f pboot` then sends 3x6 (or 2x6) processes to the stone and 6 to the paper. The stone's `spl #0, 6` B-field is the copy counter and reads 0 once copied.

## Per warrior

**1. Arvon** (Kammann & Forge-AI, len 81, code 50). Metcalf lattice with `qfac=163, qdec=1228` (163 x 1227 = 1 mod 8000), 24 cells; burst 15 loops, step 9, second stream at -67 (30 DATs). Fan boot of 6: stone to `warr+3200`, paper to `warr+843`; 18 processes enter the stone, 6 the paper; the source stays as a decoy and the pointers are not erased. Stone: `spl #0` feeder over a 4-line loop that bombs `dat }2431,>1` through `@sptr`, steps the pointer by -4862 with `sub.x` (which also advances `sptr`'s A-field so the `{`/`}` decrement trail walks), and writes again through the bomb's A-field, so bombs go out in two directions. `sfirst` is set so that after 735 SUBs the bomb lands on `shit` and the loop dies down to `spl #0 / mov`, leaving the core to the paper (timing with 18 interleaved processes **uncertain**). Paper: 6 processes copy 18 cells per generation (the 5 lines plus 13 following cells, i.e. a trailing DAT carpet) 1365 away, +18 further each generation, and `jmz.f` kills a copy whose trailing cell was touched. Differs from Azathoth only in the lattice constants, burst numbers, `sback=-2122` and 31 instead of 50 padding cells. Nearest blocks: `opening-qscan-mul` + `probe-burst2` + `fanboot` / `fanboot-paper-stone`.

```
sgo     spl     # 0       ,   6
sloop   mov       sbomb   , @ sptr
shit    sub.x   # sstep*2 , @ sloop
sptr    mov     { sback   , } sfirst
sdjn    djn.f   @ shit    , } sptr
sbomb   dat     } sstep   , > 1
```

**2. Azathoth** (John Metcalf, len 100, code 50). The original of Arvon: lattice `qfac=1533, qdec=2198`, 24 cells, burst 21 loops, step 7, gap -80 (42 DATs). Same 9-line fan boot (stone +3200, paper +843; 18 + 6 processes), same stone (step 2431, `time=1470`, decrement trail from -2129), same paper (step 1365). The boot's B-fields (`<-3828`, `{-2602` ...) only decrement far cells. Layout is boot, stone, paper, 50 padding, quickscan last. Measured solo: 2526 processes, about 4900 cells executed. Nearest blocks: as Arvon.

```
paper   spl    pstep,  {x
        mov    }x,     }paper
        mov    }x+3,   }paper
x       mov    {x+3,   }paper
        jmz.f  @x-1,   *x
```

**3. pst_v4** (Kammann & Forge-AI, len 81, code 54). Arvon's boot, stone and paper byte for byte, behind inversed's q^i instead of the lattice: 6 units, 24 cells, `qxa=3325, qxb=7515`, table `(3270,3495) (5778,4498)`, `qstep=3949`; burst 21 loops, step 9, gap -67. The second burst stream copies the other probe cell (normally an empty DAT) rather than the bomb. The q^i costs 4 more lines than the lattice for the same 24 cells, which is presumably why Arvon replaced it. Nearest blocks: `opening-qscan-qi` + `probe-burst2` + `fanboot`.

```
dec1    mul.x     qtab   ,   qtab
dec0de  mul     @ dec1   ,   found
decide  sne     * found  , @ found
        add       qinc   ,   found
        seq       nil    , * found
        mov.x     found  ,   found
```

**4. King Cobra** (inversed, len 100, code 59). q^i with 7 four-cell units and 3 two-cell units (34 cells); the second pair of each unit is the cross pair `(A*qb2, B*qa2)`, decoded by `mul.x q2,q0`; burst 20 loops, step 5, gap -78. Boot: a 3-line loop copies the 6-line scanner to +6055 and the 6-line clear 17 cells below it (two fields of one pointer), `spl`s one process there and wipes the pointer with `mov.f #0,{0`. Scanner: step 19, compares cells 10 apart; `seq` then `sne` on the next lower pair means it commits only when two adjacent pairs differ (a body, not a lone bomb), and the loop's `djn.f` also decrements the scanned cell. On commit `spl *` starts the clear and the scanning process becomes a single imp via `mov.i #4000,1`. Clear: `spl #124` pump over `mov *bptr,>cptr` twice and a `djn.f clear,}cs0` stream; it lays SPL from the find, skips 1077 cells past itself on each wrap, and by my reading turns to DAT when the `}cs0` stream comes round and decrements `bptr` (`dat 1,9` -> `dat 0,8`), about 7900 passes in (**uncertain**: our block doc describes the switch as a pointer overwrite on the wrap). Nearest blocks: `opening-qscan-qi`, `probe-burst2`, `boot` with `WIPE 1`, `oneshot-cobra-imp`.

```
loop    sub       inc          , @ 3
        seq     { loop-shift   , < loop-shift
        sne     { loop-shift   , < loop-shift
        djn.f     loop         , < loop-shift
inc     spl     * loop-shift+1 , < loop-shift
        mov.i   # 4000         ,   1
```

**5. Kaitain** (Kammann & Forge-AI, len 100, code 48). King Cobra's clear, scanner and boot unchanged (step 19, hop 10, `zofs=2372`, boot distance 6055), with the quickscan swapped for the Metcalf lattice using Azathoth's own `qfac=1533, qdec=2198` and Arvon's burst (15 loops, step 9, gap -67). That saves 11 lines against King Cobra for 10 fewer scanned cells and is the only top-10 design whose code already fits 50 lines with room to spare. One process throughout until the clear's pump starts. Nearest blocks: `opening-qscan-mul` + `probe-burst2` + `oneshot-cobra-imp`.

```
cs0     spl     # djs    ,   ssafe
clear   mov     * bptr   , > cptr
        mov     * bptr   , > cptr
        djn.f     clear  , } cs0
```

**6. The Collective** (Roy van Rijn, len 100, code 62). van Rijn's 34-cell q^4.5 (7 four-cell units, 3 two-cell units, `qz=5714`, pair gap 5609); burst 19 loops, step 6 (the A-field of `tab jmp *-6` is the step), second stream at -87. Boot: ten unrolled `mov.i` lines copy the 10-line paper 7661 away, one process jumps in. Paper: a single process copies itself with a counted loop (10 cells the first time, `cLen=23` afterwards, so 13 trailing cells are carried as a carpet) 7730 away, then `spl`s a new process at home and jumps into the copy if the cell after it is empty. Every loop pass also drops `dat <6,<1` through a pointer, moves a remote cell next to that bomb, doubles both pointer fields with `add <0,>0` and bombs again, so each copied cell costs three attack writes. Measured solo: only 25 processes but about 2470 cells executed. "Based on Borg, with extra indirect bombing" is accurate. Nearest blocks: `opening-qscan-mul45`, `boot`, `lp-paper`.

```
pLoop   mov     <pGo    , <pDest
        mov     pBmb    , @bPtr
bPtr    mov     <bStep1 , }bStep2
        add     <0      , >0
        mov     pBmb    , }bPtr
        jmn     pLoop   , pGo
        spl     >pGo    , <4000
pDest   jmz     @0      , pStep
```

**7. Tolypeutes** (Roy van Rijn, len 100, code 62). Same 34-cell quickscan as The Collective, with the `qb` table in the boot SPLs. Boot: one line plants the imp instruction remotely, `spl iBoot` sends 1 process to copy the 4-line launcher, and a 4-process fan copies the 8-line stone to +7116 and jumps in. Stone ("based on Armadillo"): `spl #2090,<-2090` feeder; each pass copies a cell from an A-side trail to a B-side target, bombs the B-pointer cell with `dat <1,47`, adds (+2090,-2090) so the two pointers walk in opposite directions, and `djn.f` decrements the A-side cell. The design ends when the trail copies the stone's own SPL over `sLoop`, dropping the processes into the two-line clear `mov sBomb,>sGate / djn.f -1,>sGate` (switch timing not traced, **uncertain**). Imp: a `spl #` pump whose `sub.x` advances the jump by 2668 a pass while `mov.i iAway,}-2` lays a fresh `mov.i #1,2667` one cell further each time, a continuous 3-point spiral; solo it reaches 6014 processes. Nearest blocks: `opening-qscan-mul45`, `armadillo-switch`, `compact-imp-pump` / `fanboot-stone-imp` (recipes `hill-stone-imp-*`).

```
sInc    spl   #sStep   , <-sStep
        mov.i {sStep   , <(sLoop-sStep-sHop)
        mov.i sBomb    , @-1
        add.f sInc     , -2
sLoop   djn.f @-1      , *-3
        mov.i sBomb    , >sGate
        djn.f -1       , >sGate
sBomb   dat   <1       , sHop+1
```

**8. Hullab3loo** (Roy van Rijn, len 100, code 59). 33-cell q^4.5 with `qy=5931, qz=3972`; burst 19 loops, step 7, gap -87. Boot: the stone's bomb is planted separately, far from the stone (`hOff=7735`); `spl }2 / spl 1 / spl 0` is a 6-fan in disguise (the `}2` turns the `spl 0` into `spl 1`); 12 processes go to the stone at +4854, 6 to the paper at +562. Stone: the H-stone with step 17 (34 per pass), a remote `dat }17,>1` bomb and a `{2926` decrement stream; with waves of lockstep processes the `}` write lays short runs rather than single cells. `hTime=7485` aims a bomb at `hHit` to switch the stone off (exact moment **uncertain**). Paper: Moore-style, 6 processes copy 6 cells 561 away (+12 each generation), bomb `dat <5334,<2667` through a pointer at 7157, wipe the 6 cells after the copy and die if the cell after the body is non-zero. Nearest blocks: `opening-qscan-mul45` + `probe-burst2` + `fanboot` with `hill-stone` and `bomb-paper`.

```
dGo     spl     #0            , 6
        mov     hBomb+hOff    , @hPtr
hHit    add     #hStep*2      , hPtr
hPtr    mov     hBomb+hOff    , }hHit-hStep*hTime
        djn.f   -3            , {hDjn
```

**9. Forgotten Lore II** (David Moore, len 100, code 22). No quickscan and no boot; 22 instructions spread over 100 cells in five islands. The loop starts 7 lines long: four setup lines write trap pointers next to `bite+218` and copy a second trap away, and each pass overwrites one of them and advances the `jmz.f` target, so after four passes the loop is 3 lines. Each pass moves the fang's fields by (+24, -24) so A+B stays equal to the trap-pointer offset, throws `djn.f #1,1` at the A side and scans the B side (step 24, so every 8th cell, .33c); a non-empty cell gets the fang `jmp @A,B`, which leads through a pointer cell to the trap. The trap `spl -1,<flag` decrements `flag` as soon as a prisoner runs it, and only then does the scanner leave for the clear. Clear: `spl #11` pump, two SPL streams from `gate dat 25,3987`; the `jmp -2,<-3` counts the SPL's B-field down from 6568 to 1, at which point the SPL's own `{1` turns `mov -1` into `mov -2` and both streams lay `dat <2667,9`. The gate resets the pointers past the code on a wrap. Nearest block: `djn-vampire` (the same design).

```
loop  sub.x #-bite-1, bite
      mov   b2,       *bite
lj    jmz.f boot,     <bite
      mov   @-2,      @bite
      jmz.f loop,     flag
tdest jmp   clear,    <6619
```

**10. Excalibur** (inversed, len 100, code 97). No quickscan: 51 SPL instructions cycling through every modifier form a decoy that any compare-scanner stops on, plus 11 never-executed "mirror" lines shaped like the boot and scanner tail (purpose **uncertain**, probably to make the dead image compare equal). Boot: 16 unrolled `mov >bp,}bp` around `bp spl scan+1423`; the scanner is started after 11 cells and the last 5 are copied behind it, then the boot process dies. Scanner: Agony style, two compares per 6-line loop (.66c), step 3147, pair gap 8, `slt #27` self-guard, DJN stream at -344. A hit copies the pointer and lays 16 `spl #-3147,-3147` backwards. After one full cycle of 8000 probes it finds its own first line, wipes cells scan-11..scan+4, and the `jmz.a scan,scan-1` test then fails and drops it into `spl #` + `mov kill,>y / djn.f clear,{y`, a DAT clear that first erases the scanner and then skips 10 cells past itself (trigger derived by hand, **uncertain**). One process until the clear. Nearest blocks: `decoys-mixed`, `boot`, `pair-wipe-scanner`.

```
scan    sub     * y      , @ x
ptr     sne       sofs-hop ,  sofs
        sub     * y      ,   ptr
x       seq     * ptr    , @ ptr
        slt     # ssafe  , @ x
        djn.f     scan   , < scan+stream
```

**11. Ghost Murmur** (John Metcalf, len 100, code 40). Metcalf lattice `qfac=4933, qdec=3598`, 24 cells, burst 12 loops, step 7, gap -80; no boot, the 10-line scanner sits 60 cells above the quickscan. Scanner: `add inc,ptr / seq >first+6,first / jmn scan` compares two cells 6 apart every 3984 (a mod-16 pattern, 500 positions) and leaves a B-field mark on one of them. The first hit runs `djn.f`, which decrements the `jmn` so the loop now includes `mov inc,>adj`: from then on every pass also lays one SPL at a carpet pointer, and each later hit resets that pointer to the new find (a blur scanner, .5c scan + .25c carpet). After 492 probes the scan reaches its own `djn.f clear` line, the carpet's first SPL lands on `loop`, and control falls through two `spl #` lines into `mov dbmb,>ptr / djn.f clear,>ptr`, which alternates `dat <4001,10` and a decrement forward for ever, skipping 10 cells at home. Solo it reaches 3038 processes and executes 22 cells. Nearest blocks: `opening-qscan-mul` + `probe-burst2` + `blur-carpet`.

```
adj     mov.b  ptr,        #loop
        mov    inc,        >adj
scan    add    inc,        *adj
ptr     seq    >first+gap, first
check   djn.f  @adj+1,     @adj
loop    jmn    scan,       @scan
inc     spl    #step,      <step
clear   mov    dbmb,       >ptr
```

**12. The Art of CoreWar** (Sascha Zapf, len 100, code 59). qBob: 8 four-cell units, two two-cell scans and a fall-through pair, 38 cells at least 100 apart, pair gap 3857. The table is three two-field DATs plus the boot SPLs' B-fields, and a hit costs up to two MULs (`mul.ab qTab1,qTab1 / mul.b qTab2,@qDec1`); burst 19 loops, step 6, gap -80. Boot: `spl }1 / spl 0 / spl 1` makes 8 processes, which copy the 8-line paper to one place, split, copy it from there to a second place and jump in: two papers of 8 processes, no stone. The paper's `spl @silk1+8` A-field is the copy counter and reads `@0` when done. Paper: two forward `spl @0` stages (939, 1928), a backward third stage (241) that the processes jump into, and between them `mov.i #6332,{1 / mov.i 174,}6853`, which throws a self-copying MOV line through a remote pointer. Solo: 4165 processes, about 6100 cells. Nearest blocks: none for qBob (closest `opening-qscan-mul`); `fanboot`, `silk3` / `tail-silk`.

```
silk1   spl     @ silk1 + 8,  } pStep1
        mov.i   } silk1,      > silk1
silk2   spl     @ silk2,      > pStep2
        mov.i   } silk2,      > silk2
        mov.i   # iStep,      { 1
        mov.i   x,            } y
        mov.i   { silk2,      < silk3
silk3   jmz.a   @ silk3,      pStep3
```

**13. DanceOfFallenAngels** (Nenad Tomasev, len 100, code 60). 33-cell q^4.5 with `qz=2108, qy=243` (the constants six warriors share), burst 19 loops, step 7, gap -86. Boot: `spl 1` three times gives 8 processes; 8 cells of stone go 5491 away and get 16 processes, 8 cells of paper go 737 away and get 8. Stone: `spl #` feeder, bomb `dat >1471,>1` through `@shoot`, `sub.f` moves both of `shoot`'s pointers by 3 x 1471, then `shoot mov.i }A,}B` moves a cell between the two trails, with a `<3323` DJN stream; three target lines one step apart per pass. I found no switch-off in it (**uncertain**). Paper: two forward `spl @0` stages (1082, 2877), one `dat <2667,<5334` through a pointer at 3850 per process, then a backward copy that the process jumps into (4043). Nearest blocks: `opening-qscan-mul45` + `probe-burst2` + `fanboot` with `hill-stone` and `silk3` / `tail-silk`.

```
stone   spl   #-3*step, >-3*step
        mov.i sbomb,    @shoot
        sub.f stone,    @-1
shoot   mov.i }ini,     }ini+step
        djn.f (stone+1), <ds
```

**14. Hullabaloo** (Roy van Rijn, len 100, code 59). The earlier Hullab3loo: q^4.5 with 2108/243, same 6-fan (stone at +4854 with 12 processes, paper at +562 with 6), stone bomb planted 5 cells past the stone. Stone: H-stone with step 3039 (6078 per pass), `dat 3039,>1`, DJN stream `<2813`; `hTime=3360` puts the bomb on `hHit` after 1680 ADDs, after which only `spl #0 / mov` is left running. Paper: the same Moore-style six lines, step 561, bomb pointer 4633. Solo: 2134 processes, about 4640 cells. Nearest blocks: as Hullab3loo.

```
pGo     spl    pStep1,  {3
        mov    }2,      }-1
        mov    pBmb,    >bStep1
        mov    3,       }-3
        jmz.f  -4,      *-1
pBmb    dat    <5334,   <2667
```

**15. Escaped Experiment** (BigJk, len 100, code 40). Ghost Murmur's scanner copied unchanged (step 3984, gap 6, time 492, same ten lines); the comment "P-warrior scanner" is stale, there is no P-space code. Only the quickscan constants differ: `qfac=369, qdec=3730`, burst 18 loops, step -7, gap +87, which are Borg's burst numbers. Measured behaviour is identical to Ghost Murmur (3038 processes, 22 cells). Nearest blocks: as Ghost Murmur.

```
scan    add    inc,        *adj
ptr     seq    >first+gap, first
check   djn.f  @adj+1,     @adj
loop    jmn    scan,       @scan
```

**16. Ziggy** (Roy van Rijn, len 100, code 59). Hullab3loo's quickscan (5931/3972) and fan; the stone's feeder is `spl #6,<4`, its A-field serving as the copy counter, and the bomb is planted 28 cells off; the paper is copied through the B-field of the quickscan's last `jmp`. Stone: Hullabaloo's (step 3039, `hTime=3360`), 12 processes at +2079. Paper (6 processes at +1008) is different from the rest of the family: `mov.i {pGo,<pCopy` copies the 6 lines backwards using the first line's A-field as the counter, `spl @0` starts the copy, `mov.i pBmb,<pCopy` lays 6 anti-imp DATs directly below it, and `jmn.b pGo,}pGo` restores the counter; the first line also throws a copy of itself through a pointer at 5778. Each generation lands 12 cells lower. Solo: 4530 processes but under 3000 cells, so it packs tighter than the Moore paper. Nearest blocks: `opening-qscan-mul45` + `fanboot` + `hill-stone`; paper closest to `anti-imp-silk`, not a match.

```
pGo     mov.i   #pBmb+1 , {bStep1
        mov.i   {pGo    , <pCopy
pCopy   spl     @0      , }pStep1
        mov.i   pBmb    , <pCopy
        jmn.b   pGo     , }pGo
pBmb    dat     <5334   , <2667
```

**17. luca** (Sascha Zapf, len 100, code 74). "Q3.14": 19 `seq X,X+3800` pairs on a regular 200-cell grid (38 cells; a final `jmz.f` tests one more), in two halves with a `mov.ab` that re-bases the pointer between them. The decoder needs no address table: it computes which SEQ line fired (a small table `5,6 / 8,2 / 6,4`, mutated by the unit's JMP, gives the line offset, with one `mul.ab` for the later units) and then `add.ab @bline,bline` adds that SEQ's own A-field. Burst 20 loops, step 5, gap -75. It costs 53 lines, the most expensive opening here. Payload is Hullab3loo's boot, stone and paper with other distances (stone +7338, paper +4372, paper step 272, bomb pointer 4472); 12 + 6 processes. Nearest blocks: none for the opening (closest `opening-qscan-decode`); `fanboot` with `hill-stone` and `bomb-paper`.

```
fast    mul.ab  qtab,   *ultra
ultra   add.b   qtab,   bline
decode  add.ab  @bline, bline
choose  sne.i   pos1-1, @bline
        add.ab  #qhop,  bline
loop    mov.i   qbomb,  @bline
bline   mov.i   qbomb,  @pos1
```

**18. Son of Vain** (Oversby/Pihlaja, len 100, code 62). The older one-MUL q^4 this hill's q^4.5 grew from: one plain pair, six four-cell units and one two-cell unit (28 cells), factor `d=5014`; burst 13 loops, step -7, second stream at +60. Boot: `spl misc` sends one process to plant the imp, the stone bomb and the clear's gate and to start the clear; a 4-fan copies 4 cells each of clear, stone and launcher, then 4 processes enter the stone and 4 the launcher. Stone: `spl 0` over `mov bomb,@2 / add #6457,@-1 / djn.a @-1,*ptr` (.33c), where the DJN decrements the A-field 3643 past each bomb; after 2293 bombs that decrement lands on the ADD and changes the step (the "mutation"). Clear: `spl #0 / spl #0,{dgate / mov dgate+2,>dgate / djn.f -1,>dgate` with bomb `dat <2667,..`, running from the start with a decrementing gate. Imp: 4 lockstep processes in `spl #1 / add.a #2667,1 / djn.f`, which lands them on I, I+2667, I+5334, I+1 and keeps adding, a continuous 3-point spiral. The `chk_flag` line's role is **uncertain**. Nearest blocks: `opening-qscan-mul`, `fanboot3`, `timed-stone` / `hill-stone`, `finisher-dclear`, `compact-imp-pump`.

```
st      spl     0        , 4
        mov     -1+dbofs , @2
        add     #step    , @-1
        djn.a   @-1      , *st+(tgt-hop)-(step*time)
spin    spl     #1       , 4
        add.a   #2667    , 1
        djn.f   spin+idist-ldist-1-2667, <spin-ldist+ldecoy
```

**19. Borgir** (Christian Schmidt, len 100, code 59). q^4.5 with 2108/243, burst 14 loops, step 7, gap -87. Boot: one process copies the stone's first cell, then the 6-fan copies 6 more (7-cell stone) and the 6-cell paper; `spl @pBoo` twice puts 12 processes in the stone at +1806, and `djn ..., #ptr` puts 6 in the paper at +1001. Stone: `spl #5724` feeder; each pass bombs `dat }1,>1` at the A-pointer, adds 5724 to both pointers and copies the cell at the new A-pointer 2862 further on, so alternate targets get a bomb or a moved cell (.5c). It loops with a plain `jmp`: no DJN stream and no switch-off. Paper: the Moore-style six lines with step 552 and bomb pointer 7061, bomb `dat <2667,<5334`. Nearest blocks: `opening-qscan-mul45` + `probe-burst2` + `fanboot` with `hill-stone` and `bomb-paper`.

```
dGo     spl    #2*dStep, {2*dStep
        mov    dBmb,     *2
        add.f  -2,       1
        mov    dOff,     dOff+dStep
dLoop   jmp    -3,       dGo
        dat    0,        0
dBmb    dat    }1,       >1
```

**20. pdQscan** (P. Kline, len 96, code 59). The widest one-MUL scan: 10 units, 40 cells in 30 lines, `qM=6250`, pair gap 124. Its table needs no dedicated cells beyond four DATs: entries sit in the B-fields of DATs, of the units' own JMPs and of the boot SPLs, and are reached by double indirection (`mul.b *tB,qPtr`, with `tB`'s A-field pointing at the row; a `mov.a` re-aims the decoder for units G-I). Burst 16 loops, step 6, gap -67. Boot: 6-fan; the paper is copied to +4000, both groups copy again +2000 further, so four papers start 2000 apart with 6 processes each. Paper: forward `spl @0` stage (step 7 x 3754), backward second stage (1303 + 7 x 1021), then `mov.i #3332,}2667 / mov.i >0,}0` as a tail before the processes run off the end (the tail's effect is **uncertain**). Solo: 6766 processes, about 6700 cells, the most spread of the 30. Nearest blocks: `opening-qscan-mul` (UNITS 10), `fanboot` + `copies`, `silk3` / `tail-silk`.

```
pPap    spl     @0            , >pStep
        mov     }pPap         , >pPap
        mov     {pPap         , <1
        spl     @0            , >pStep2
        mov.i   #6000-1-2667  , }2667
        mov.i   >0            , }0
```

**21. Kusanagi** (inversed, len 100, code 20). The smallest program here: a 16-line scanner, 80 empty cells, and a 4-line decoy maker that runs first and dirties about eight cells 6700 away through operand side effects. No quickscan, no boot. Scanner: two compares per 6-line loop (.66c), step 2851, pair gap 18, `slt #36` self-guard. A hit copies the pointer pair to `loop-1` and lays 8 SPLs forward from each of the two compared cells. When the A-pointer has gone all the way round and reads 0, `jmn.a loop,*c` fails and the scanner falls into `spl #2851` + `mov kill,}cnt / djn clear,{z`, a pumped DAT clear with `dat 12,<2667` that skips 12 cells at home. Nearest blocks: `decoy-maker` + `pair-wipe-scanner` (`CLEAR 1`).

```
loop    add     * y     , @ x
ptr     sne       sofs  ,   sofs+hop
        add     * y     , @ x
c       seq     * ptr   , @ ptr
x       slt     # ssafe ,   ptr
        jmn.a     loop  , @ x
wipe    mov       inc   , } bptr
y       mov       inc   , > bptr
```

**22. Eternal Exile** (inversed, len 83, code 54). q^i with 6 units (24 cells): `qxa=6980, qxb=6810`, `qstep=2379`; burst 20 loops, step 7, gap -87. Boot: a 4-MOV loop entered in the middle copies 14 cells 4774 away, `spl @` starts the scanner at its second line, and `mov.i #0,{0` wipes the boot pointer. Scanner: `add / sne / jmn.a` (3 lines per pair, .66c), step -101, pair gap 8; a hit sets the wipe pointer 3 cells before the find and lays 16 SPLs forward in 8 passes, then scanning resumes. All jumps are indirect through each other's B-fields. `zo` is set so the A-pointer reads 0 after 712 probes; then `spl #-101` pumps `mov kill,>gate / djn.f clear,>gate`, alternating `dat <2667,10` and a decrement, erasing the scanner first and skipping 10 cells at home. Nearest blocks: `opening-qscan-qi` + `probe-burst2` + `boot` (`WIPE 1`) + `pair-wipe-scanner`.

```
loop    add       inc   ,   ptr
ptr     sne       zo    ,   zo + hop
j1      jmn.a   @ j2    , @ loop
t1      mov.ab    ptr   , @ wipe
cnt     mov     # wlen  , @ jw
wipe    mov       inc   , > wptr
gate    mov       inc   , > wptr
jw      djn     @ t1    ,   cnt
```

**23. Gods Of Destiny** (Nenad Tomasev, len 100, code 61). q^4.5 with 2108/243, burst 19 loops, gap -86. Boot: bomb planted first, then an 8-fan; 8 cells of stone go 4734 away with 16 processes, 8 cells of paper 1208 away with 8. Stone: Hullabaloo's H-stone with the same numbers (step 3039, `hTime=3360`, `<2813`, bomb `dat 3039,>1`). Paper: two forward `spl @0` stages (4143, 1011), then `mov.i #1,{1 / mov.i bs1,}bs2`, which writes a self-copying MOV line near +5700 and moves it through a pointer at 3823, then a backward third stage (7321) the processes jump into. It is DOFA with the stone and the paper's attack lines exchanged. Nearest blocks: `opening-qscan-mul45` + `fanboot` with `hill-stone` and `silk3` / `tail-silk`.

```
p1 spl @(p3+1), >ps1
   mov }p1, >p1
p2 spl @0, >ps2
   mov }p2, >p2
   mov.i #1, {1
   mov.i bs1, }bs2
   mov {p2, {p3
p3 jmz.a ps3, *0
```

**24. lzma2** (NDusN, len 100, code 65). q^4.5 as printed in Core Warrior 92 with `qm=3722, qm2=2681`; burst 20 loops, step 5, gap -90. Boot: `spl 2 / spl 2 / spl 1,}0 / spl 1` makes 9 processes (the `}0` turns the third SPL into `spl 2` for its second visitor); 9 cells of stone and 9 of paper are copied, 18 processes enter the stone and 9 the paper. Stone: the H-stone, step 3039, count 3358, bomb `dat >3039,>1`. Paper: two forward stages (7848, 3201), two `dat <2667,<5334` bombs per process per generation through pointers at 4063 and 1102 (the "very anti-imp" part), and a backward third stage entered by `djn @0,<2566`. Solo it reaches 7802 processes on only about 1200 cells, the densest paper here. Nearest blocks: `opening-qscan-mul45` + `fanboot` with `hill-stone` and `tail-silk` / `silk3`.

```
        spl @0, >step1
        mov }-1, >-1
        spl @0, >step3
        mov }-1, >-1
        mov data2, >4063
        mov data2, >1102
        mov {-4, <1
        djn @0, <step2
data2   dat <2667, <5334
```

**25. Borg** (John Metcalf, len 100, code 39). Metcalf lattice `qfac=2259, qdec=2140`, 24 cells, burst 18 loops, step -7, gap +87, then a 9-line replicator that runs where it was loaded, 61 cells from the quickscan (no boot). Paper: one process copies 24 cells (9 lines plus 15 trailing cells) -203 away with a counted loop; each pass also moves a remote cell (`mov <-664,-1299`), doubles that instruction's fields with `add <0,>0` and bombs `dat }1,>1` through its A-field; then `spl >paper` restarts the copy at home and `jmz @0` jumps into the new copy if the cell after it is empty. One new process per generation: solo it has 74 processes and about 2040 cells executed. The Collective is this with a boot and one more bomb per pass. Nearest blocks: `opening-qscan-mul` + `probe-burst2` + `lp-paper`.

```
paper   mov    #length,  #9
copy    mov    <paper,   <dest
bptr    mov    <-664,    -1299
        add    <0,       >0
        mov    bomb,     }bptr
        jmn    copy,     paper
        spl    >paper,   >4000
dest    jmz    @0,       step
bomb    dat    }1,       >1
```

**26. King of Metal** (Christian Schmidt, len 100, code 59). Borgir with other numbers: q^4.5 2108/243 (burst 14 loops), the same boot (first stone cell by one process, 6-fan for the rest), stone at +970 with 12 processes, paper at +4411 with 6. Stone identical to Borgir's (step 2862, pointer offset 4655, `jmp` loop, no switch-off). Paper: the Moore-style six lines, step 4208, bomb pointer 7795. Nearest blocks: as Borgir.

```
pStone  spl #2 * 2862, {2 * 2862
        mov pAmmo, *2
        add.f pStone, 1
        mov 4655, 4655 + 2862
pSrcS   jmp -3, pStone
```

**27. clrsrc** (Kammann & Forge-AI, len 83, code 54). Eternal Exile with retuned constants and nothing else changed: q^i `qxa=6913, qxb=7021, qstep=2168`, burst 15 loops, step 5, gap -81; boot distance 5500; scanner step -101, time 712, pair gap 8, wipe 9 passes (18 SPLs) instead of 8. The `;!opt` annotations show which numbers the authors' optimiser was allowed to move (burst, q-constants, boot distance, hop, step, time, wipe length, clear gap). Nearest blocks: as Eternal Exile.

```
jw      djn     @ t1    ,   cnt
j2      jmn.a   @ j1    , @ loop
inc     spl     # step  ,   step
clear   mov       kill  , > gate
        djn.f     clear , > gate
        dat       0     ,   0
kill    dat     < ikill ,   dcgap
```

**28. Neith** (inversed, len 100, code 60). q^4.5 with `qf=2713, dq=4778`, burst 20 loops, step 7, gap -86. Boot: 8-fan; 8 cells of stone go 1171 away (16 processes), 8 cells of paper 1394 away (8 processes); the final `jmz.a` jumps on the copied paper's zeroed counter. Stone: H-stone with hop 473 (946 per pass), `time=2520`, `<2087` stream, bomb `dat 473,>1`; it bombs its own `hit` line after 1260 ADDs. Paper: one `spl @0` stage (1873), then a second stage that is a paper of its own, `to spl 3353 / mov >from,}to`, which drops two `dat <2667,<5334` per process per pass through pointers at 7146 and 917 and loops on `djn.f to` instead of running off the end. Nearest blocks: `opening-qscan-mul45` + `probe-burst2` + `fanboot` with `hill-stone` and `bomb-paper` / `silk3`.

```
silk0   spl     @8,     <ofs0
        mov     }silk0, >silk0
to      spl     ofs1,   <from
        mov     >from,  }to
        mov     pbomb,  >b1
        mov     pbomb,  }b2
from    djn.f   to,     >to+8
pbomb   dat     <2667,  <5334
```

**29. Twin Storms** (inversed, len 100, code 54). q^i with 4 two-cell units first and 6 four-cell units (32 cells), cross-pair decoding as in King Cobra; burst 20 loops, step 5, gap -74. Boot: a 3-line loop copies the 9-line engine to two places 913 apart in the same pass (+6246 and +7159) and starts one process in each; the original is left as a decoy with its pointers intact. Engine: every lap it drops `spl #1,1` on both pointers (post-incrementing them), and adds 8 to both only when the two cells 2414 apart were equal, so empty core gets an SPL every 9 cells in two streams and a find gets a solid SPL carpet. After 348 laps `djn` falls through into `spl #1` + `mov db,>cptr / djn.f -1,>cptr`, which erases the engine and then clears forward with `dat 8,8`, skipping 9 cells at home. Nearest blocks: `opening-qscan-qi` + `probe-burst2` + `twin-storm` (the same design).

```
ptr     sne     first   ,     first+hop
        add     db      ,     ptr
p       mov     bomb    ,   > ptr
        mov     bomb    ,   } ptr
        djn   @ p       ,   # time
bomb    spl   # 1       ,     1
        mov     db      ,   > cptr
        djn.f  -1       ,   > cptr
db      dat     step-1  ,     step-1
```

**30. Spiritual Black Dimension** (Christian Schmidt, len 100, code 59). Borgir again: q^4.5 2108/243 (burst 14 loops), the same boot, stone at +4275 with 12 processes, paper at +3524 with 6, stone step 2862 with offset 4655. Paper: Moore-style, step 431, bomb pointer 4692, bomb `dat <2667,<5334`. Borgir, King of Metal and this differ only in four placement and paper constants. Nearest blocks: as Borgir.

```
dBoo    spl    @pBoo,        wGo+sAwa
        spl    @pBoo,        >dBoo
pBoo    djn    wGo+dAwa+6,   #wGo+sAwa
```

## Patterns

- **A quickscan is close to mandatory, and it is cheap per cell.** 27 of 30 open with one; the three that do not are small scanners that spend the cycles on a decoy or on starting at once. The modern forms test 24 cells in 30 lines (Metcalf) or 33 in 35 (q^4.5) because tables live in spare B-fields. Every one follows a hit with the same two-stream DAT burst.
- **Paper/stone through a lockstep fan boot is the default body** (14 of 30, 9 of the top 20). The recipe is fixed: 6 to 9 processes, copy pointers that double as launch vectors, 2 or 3 groups into a 5-6 line stone and one group into a 5-8 line paper, both booted away from a source image that is left as a decoy.
- **Stones are built to stop.** 10 of the 16 stones aim a bomb at their own loop after a set number of passes, so the stone covers the opening and the paper inherits the core. Only Schmidt's 2862 stone and DOFA's run on, and none of the paper/stones converts its stone into a clear.
- **Papers carry anti-imp bombs instead of imps.** 10 papers drop `dat <2667,<5334`; only two warriors launch a spiral (both 3-point, both continuous pumps), and two more keep a single imp as a failsafe. There is no 7-point spiral and no binary or vector launcher in the top 30.
- **Scanners are the other third (10), and they are short.** 14-16 line pair scanners with a fixed 16-18 cell SPL wipe, a counted scan (348 to 8000 probes) and a `spl #`-pumped DAT clear that skips their own image; King Cobra's oneshot and Lore's vampire are the two that wait for evidence (two adjacent occupied cells, a captured process) before committing.
- **The field is a handful of designs retuned.** Arvon and pst_v4 are Azathoth; Kaitain is King Cobra; Escaped Experiment is Ghost Murmur; clrsrc is Eternal Exile; Borgir, King of Metal and SBD are one program; luca reuses Hullab3loo's payload. Constants (steps, boot distances, lattice factors) are what separates rank 1 from rank 14.
- **What a 50-instruction entry gives up: padding first.** Every warrior here uses 27-80 empty cells to keep the quickscan's side effects off the payload and to bulk out the decoy; none assembles to 50. Azathoth and Arvon are exactly 50 code lines (30 + 9 + 6 + 5) and Kaitain 48, so those three designs survive with zero slack and a contiguous image.
- **Second cut: scan width.** The q^4.5 family (59-65 code lines) must drop its 9 post-bump lines (33 -> 24 cells) or switch to the 30-line lattice to fit a boot, stone and paper; the 38-40 cell scans of luca, qBob and pdQscan cannot be carried at all. Dropping to 4 or 5 units (16-20 cells) buys 3 lines each.
- **Third cut: one component.** Stone + paper + scan fits only with the 5-line Azathoth paper and 6-line stone; an 8-line multi-stage silk, a second paper, a separately planted remote bomb, or stone + clear + imp (Son of Vain, Tolypeutes at 62) each cost more than the budget allows without shrinking the scan further.
- **What already fits whole:** the scanner bodies (Kusanagi 20, Lore II 22, Eternal Exile's scanner + boot 22, King Cobra's body + boot 18, Ghost Murmur's 10, Twin Storms' 14, Borg's 9). A 50-line entry can carry any of these with a full 24-cell lattice scan, or two of them, which the 100-line hill has no reason to try.
