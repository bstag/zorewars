# Koenigstuhl LP hill, top 30: source-level breakdown

Hill rules: 8000 cells, 8 processes, 80000 cycles, length 200, min distance 200, P-space allowed.
Tournament target: `-s 8000 -p 8 -c 80000 -d 200 -l 50`, no P-space.

Method: all 30 sources read in full. Lengths are assembled lengths under `--rules lp-hill` (200-cell limit, P-space on). "Solo" figures (peak processes, distinct cells executed, survives) come from `zorewars species --rules lp-hill`. Anything marked **(uncertain)** was read from the source but not traced in the VM. "Len<=50" refers to the file as submitted; "core" is the live code once blank padding is removed.

## Summary table

| # | Name | Author | Len | <=50 | P-space | Archetype | Opening | Payloads | Endgame |
|--:|---|---|--:|:-:|:-:|---|---|---|---|
| 1 | R.O.U.S. | S. Fernandes | 7 | yes | no | LP paper, doubling scatter | none | 1 paper, 7-cell first copy then 22-cell copies | moving paper once 8 slots are full |
| 2 | Replinator | C. Schmidt | 200 | no (core ~50) | no | qscan -> LP paper | MUL-decoded Q4 scan, 40 DAT bombs | 1 scatter paper (21-cell copies) | moving paper |
| 3 | Bronze minotaur | G. Labarga | 200 | no (core 16) | no | twin LP paper | `spl`/`jmp` to two papers | 2 scatter papers (20- and 17-cell copies) | moving papers |
| 4 | Digital Rain | inversed | 7 | yes | no | LP paper, doubling scatter | none | 1 paper, 25-cell copies | moving paper |
| 5 | Fear of the Unknown | J. Metcalf | 200 | no (core 14) | no | paper + booted 4-process stone | boot stone, 5 processes placed | 5-line paper (20-cell copies), 4-line stone | none (stone runs forever) |
| 6 | The LP Destroyer | C. Schmidt | 200 | no | **yes** | P-switcher: paper / jmp-stone -> DAT clear | P-brain (6 cycles) | Replinator paper, or 1-process mod-4 `jmp #1` bomber | stone turns into forward DAT clear |
| 7 | Hippogriff | J. Metcalf | 7 | yes | no | LP paper, arithmetic-step bomb | none | 1 paper, 28-cell copies | moving paper |
| 8 | Distortion Energy | inversed | 200 | no (core 15) | no | paper + booted 4-process mutating stone | boot stone, 5 processes placed | 5-line paper (38-cell copies), 4-line stone | stone mutates into a clear (author's claim) |
| 9 | The LP Destroyer II | C. Schmidt | 83 | no | **yes** | P-switcher: paper / booted dwarf | P-brain | Replinator paper, or `spl #0`-fed dwarf | dwarf self-hit -> clear/gate **(uncertain)** |
| 10 | Disciples of the Void | inversed | 200 | no (core 34) | no | 4 booted transparent A-field scanners | dual boot, 4 scanners 1 process each | 0.5c `jmz.a` scanners, `jmp #0` bombs | self-hit -> `spl #0` backward DAT clear |
| 11 | BioMech | inversed (evolved) | 7 | yes | no | LP paper, `add.x` mutation bombing | none | 1 paper, 8-cell first copy then 23 | moving paper |
| 12 | Lord of the Core | C. Schmidt | 155 | no | **yes** | P-switcher over 4 warriors | P-brain | 3 dwarfs / twin scanner / Muffineer paper / 2 imps + DJN stream | depends on branch |
| 13 | Rottinger II | G. Labarga | 195 | no | no | qscan -> twin LP paper | MUL-decoded Q4 scan, 20 bombs | 2 scatter papers (9-cell, exact) | moving papers |
| 14 | Rottinger | G. Labarga | 200 | no | no | qscan -> LP paper | same qscan | 1 scatter paper (9-cell) + 6 decoy JMPs | moving paper |
| 15 | LP and Feelin' Fine | J. K. Wilkinson | 200 | no | **yes** | P-switcher: vampire+clears / 2 papers+stone / imp spiral | P-brain | LRI vampire, Tempest, 8-process spiral | pit clear / none / ties |
| 16 | Heavy cavalry | G. Labarga | 186 | no | **yes** | P-switcher: one-shot scanner -> clear / twin paper | P-brain | 0.4c `sne` one-shot with SPL carpet clear; 2 scatter papers | relocating clear **(details uncertain)** |
| 17 | Simplicity | A. Marsden | 200 | no (core 9, span 27) | no | scanner + SPL/JMP bomb -> clear | none | 0.5c `jmz.f` scan step 26, `spl`+`jmp` trap bombs | self-hit -> `spl #0` forward DAT clear |
| 18 | LPKD | NDusN | 200 | no | no | qscan -> imp-bomber + DJN stream + 2 imps | MUL-decoded qscan, 40 bombs | 0.5c bomber throwing `mov.i #3315,1`, DJN stream, 2 plain imps | imps tie; stream kills converted imps |
| 19 | End of Days | C. Schmidt | 174 | no | **yes** | P-switcher: SPL/JMP bomber -> clear / paper | P-brain | `spl #`-fed mod-5 SPL+JMP bomber (two instances) or Replinator paper | bomber self-hit -> forward DAT clear |
| 20 | Yamabushi | inversed | 13 | yes | no | pair scanner + SPL/DJN/JMP bomb -> JD clear | none | 0.66c `sne` scan step 70, 3-cell stun | self-hit -> `spl #0` JMP pass then DAT pass |
| 21 | Hypnos | inversed | 16 | yes | no | 0.66c pair scanner -> DAT clear | none | `seq` scan step 34 gap 17, `djn #0,#0` stun bombs | pointer wraps to 0 -> `spl #`-fed DAT clear |
| 22 | Hired Guns | R. Macrae | 15 (LP build) | yes | no (P-code only assembles for 8000 processes) | Iron Gate scanner -> LP clear | none | 0.66c `cmp` scan step 196, `spl 0`/`jmp -1` bombs | self-hit -> `spl 0` forward DAT clear |
| 23 | Romulan Warbird | P. Kendall | 14 | yes | no | Iron Gate-style scanner -> clear | none | 0.66c `cmp` scan step 196 gap 98, `spl #0`/`jmp -1` | self-hit -> `spl #0` forward DAT clear |
| 24 | DaubFusion | R. van Rijn | 97 | no | no | qscan -> 2 papers + 2 stones + imp spiral | MUL-decoded Q4 scan, 38 bombs | 2 DAT-bombing papers, 2 three-line stones, 4-process 3-point imps | imps tie |
| 25 | Biocular | C. Schmidt | 66 | no (core 16) | no | twin scanning paper | boot second copy 3855 away | paper that scans for a non-empty target, then copies 37 cells onto it | keeps scanning/copying |
| 26 | Assault on Mirage | inversed | 20 | yes | no | jmp-bomber + separate DAT clear | boot both parts away | 5-process `jmp #831` bomber, 1-process forward DAT clear | clear wipes own stone, keeps clearing |
| 27 | Reclon 2 scanner | G. Labarga | 120 | no (core 20) | no | twin `jmz.f` scanner -> clear | boot second scanner 4000 away | 0.5c scan step 238, `jmp #` bombs | self-hit -> `spl #0` backward DAT clear |
| 28 | 100% Evil | R. van Rijn | 200 | no | **yes** | qscan -> P-switch: scanner / paper+stone | two-factor table qscan, 24 bombs | Romulan Warbird copy, or 2 papers + stone | scanner clear / none |
| 29 | Muffineer | C. Schmidt | 194 | no | no | qscan -> DAT-bombing LP paper | MUL-decoded Q4 scan, 28 bombs | 1 paper (9-cell exact), DAT every 963 | moving paper |
| 30 | Incisive | R. Macrae | 200 | no (core ~55) | no | vampire + pit + dual clears | boot backward clear | 5-process vampire step 45, slave pit, forward + backward clear | pit/clears finish |

## Block census

Counts are warriors out of 30. A P-switcher is counted under every component it can select.

| Component | Count | Which | Dominant variant |
|---|--:|---|---|
| LP counted-copy paper (any) | 20 | 1 2 3 4 5 6 7 8 9 11 12 13 14 15 16 19 24 25 28 29 | 7-line backward-copy loop with guarded `jmz`/`jmn` transfer into the copy |
| - pure paper, nothing else | 6 | 1 3 4 7 11 25 | four of them are exactly 7 instructions |
| - scatter `mov {a,{b` + `add {0,}0` doubling | 10 | 1 2 3 4 6 9 13 14 16 19 | Replinator's paper is reused verbatim in 6, 9, 19 |
| - other in-loop attack (arithmetic step, `add.x`, DAT stream) | 6 | 7 11 12 24 28 29 | Muffineer-style `mov bomb,@ptr` with a carried DAT tail (12 24 28 29) |
| - no in-loop attack (2-instruction copy loop) | 3 | 5 8 15 | relies on companion stone |
| - scanning paper | 1 | 25 | - |
| - oversize copy (copies 13-33 blank cells as a DAT carpet) | 12 | 1 2 3 4 5 6 7 8 9 11 19 25 | copy count 20-38 for a 5-7 line body |
| - two papers launched side by side | 6 | 3 13 15 16 24 25 | `spl a` / `jmp b` |
| Stone / bomber | 11 | 5 6 8 9 12 15 18 19 24 26 28 | 3-4 line self-stepping `mov`/`add`/`jmp`; 4 or 5 processes in one loop (5 8 15 26) |
| Vampire with slave pit | 2 | 15 30 | Limb-Rending Incisors, 5 processes in the fang loop |
| Scanner | 10 | 10 12 16 17 20 21 22 23 27 28 | one pass, then self-hit converts to clear; stun bombs, not DATs |
| - `jmz` single-cell 0.5c (Simplicity/Switchblade family) | 4 | 10 12 17 27 | bomb is the pointer cell itself (`jmp #step,#ptr`) |
| - `cmp`/`sne`/`seq` pair 0.66c (Iron Gate family) | 5 | 20 21 22 23 28 | SPL + JMP pair on the hit |
| - one-shot | 1 | 16 | - |
| - multiple scanner instances | 3 | 10 (four) 12 (two) 27 (two) | booted ~4000 apart |
| Clear as endgame | 17 | 6 8 9 10 12 15 16 17 19 20 21 22 23 26 27 28 30 | `spl #0`-fed `mov bomb,>ptr` DAT clear, usually forward |
| Imps | 4 | 12 15 18 24 | 3-point spiral (2667) in 15 and 24; plain imps in 12 and 18 |
| Quickscan | 7 | 2 13 14 18 24 28 29 | Schmidt MUL-decoded Q4 (`qz 2108`, `qy 243`) in 5; same shape with `3722/2681` in 18; two-factor table in 28 |
| P-space switch | 7 | 6 9 12 15 16 19 28 | mod-encoded state table (`ldp`, `mod`, `stp`, `jmp }0`) |
| Boot away from the load image | 14 | 5 8 9 10 12 15 16 19 24 25 26 27 28 30 | `mov <src,{dst` run by 2-5 processes in parallel |
| Blank padding to >=150 cells | 17 | 2 3 5 6 8 10 12 13 14 15 16 17 18 19 28 29 30 | components spread 30-120 cells apart inside the image |
| Explicit decoy cells | 1 | 14 | six `jmp #i,<-250-i` lines (18's author also calls the spacing a decoy) |
| Already <=50 as submitted | 9 | 1 4 7 11 20 21 22 23 26 | 4 papers, 4 scanners, 1 bomber+clear |
| No P-space | 23 | all but 6 9 12 15 16 19 28 | - |

Bomb types across the 30: stun bombs dominate over DATs. `jmp #x` (trap in place): 6 10 12 17 19 26 27. SPL/JMP pairs: 17 19 20 22 23 28. `djn #0,#0`: 21. Imp instruction: 18. Vampire fangs: 15 30. With only 8 processes, trapping a process is nearly as good as killing it and the clear finishes the job.

## Per-warrior notes

### 1. R.O.U.S. (S. Fernandes) - 7 instructions, no P-space
Pure LP paper; entry at `loop` with the count preloaded at 7, so the first copy is finished in 28 cycles. Each lap does four things with one process: copy one cell backward (`<paper` -> `{pboot`), scatter one cell through two remote pointer cells (`>5033` read, `{1319` write), double both fields of the scatter instruction (`add.f <0,>0` points at the previous line both times and leaves its own B at 0), and test the counter. When the counter reaches 0, `spl @paper` restarts home at `paper`, which rewrites its own B to 22, so every later copy is 22 cells: the 7-cell body plus 15 cells after it, which lands as a blank carpet at each destination. The parent falls into `pboot`, whose A-field has been decremented to point at the head of the copy; `jmz` both tests that head's B (0 only if the copy is intact) and jumps there. When all 8 slots are in use the SPL does nothing and the process simply moves into the copy, so the paper keeps hopping. `pboot` is copied after 16 decrements, so each generation's hop is 16 shorter than its parent's. Solo: 8 processes, 2670 cells executed, survives. Nearest block: `lp-scatter-paper` (direct model).

```redcode
paper   mov    #22,    #7
loop    mov    <paper, {pboot
        mov    >5033,  {1319
        add.f  <0,     >0
        jmn    loop,   *loop
        spl    @paper, >83
pboot   jmz    6192,   *0
```

### 2. Replinator (C. Schmidt) - 200, no P-space
Quickscan, then one Digital Rain-shaped paper with different constants. The scan is the standard Schmidt MUL-decoded Q4 (27 instructions: six `sne`/`seq <tab`/`jmp q0` triples, one `seq >qptr`, three `seq`/`jmp` pairs, a closing `jmz.f`), decoded by `mul.b *2,qptr`, a `sne {qtab1,@qptr` side pick and `add.b qtab2,qptr`; `qz 2108`, `qy 243` (243 x 2107 = 1 mod 8000). The attack is 20 passes of two `dat >-88,>qc2` bombs, step 7, then `jmp pGo`. Two of the scan's `jmp` lines carry stray `}4443` / `}3256` side-effect increments ("extra attack"). The paper copies 21 cells for a 7-line body (14 blank), hop 6667-21 from `to`; 6667 is 5/6 of the core, so successive copies sit about a sixth of the core apart. The paper sits 13 cells into the image with 80 blank cells after it and 45 more before the scan tables. Tables and scan are ~43 instructions, so scan + paper is about 50 without padding. Nearest blocks: `opening-qscan-mul45` + `lp-scatter-paper`.

```redcode
from    mov     #21,    #0
loop    mov     {548,   {109
        add     {0,     }0
        mov     <from,  {to
        jmn     loop,   from
        spl     >from,  }7293
to      jmz     6667,   *0
```

### 3. Bronze minotaur (G. Labarga) - 200, no P-space
Two R.O.U.S.-style papers at image offsets 0 and 193, started by `spl loop1,>7573` / `jmp loop2,>1473`. Both enter at their loop with count 7; on restart the head rewrites the count to 20 (paper 1) or 17 (paper 2), so later copies carry 13 or 10 blank cells. Order inside the lap differs from R.O.U.S.: copy first, then scatter `mov {1171,{826`, then `add.f {0,}0` doubling. Hops are 5741 and 6415 from `dst`, and the SPL side effects (`>2903`, `>155`) differ, so the two lineages spread over different parts of the core while sharing the 8 slots. Solo it reaches 8 processes but eventually kills itself (around cycle 48,000 per the earlier timing study). Live code is 16 instructions. Nearest: recipe `lp-bronze-paper` (two `lp-scatter-paper`).

```redcode
src1    mov.ab #20,    #7
loop1   mov.i  <src1,  {dst1
        mov.i  {1171,  {826
        add.f  {0,     }0
        jmn.b  loop1,  src1
        spl    @src1,  >2903
dst1    jmz.b  5741,   *0
```

### 4. Digital Rain (inversed) - 7 instructions, no P-space
The template most of the hill copies. Entry is the head, which sets the count to 25 (18 blank cells per copy). The lap is scatter (`mov {2638,{2649`, both A-predecrement), doubling (`add {0,}0`, default `.F`, applied to the scatter line), copy, test. `spl >from` restarts home; the post-increment leaves the head's B at 1, but the restarted process immediately overwrites it with 25. `to jmz 1971,*0` is the guarded transfer; the copy's head sits at `from`+1952. `to` is copied after 19 decrements, so hops shrink 19 per generation. At the cap the process abandons home and moves on. Solo: 8 processes, 2690 cells, survives. Nearest: `lp-scatter-paper`, `lp-paper`.

```redcode
from    mov     #25,    #0
loop    mov     {2638,  {2649
        add     {0,     }0
        mov     <from,  {to
        jmn     loop,   from
        spl     >from,  }4001
to      jmz     1971,   *0
```

### 5. Fear of the Unknown (J. Metcalf) - 200, no P-space
Paper plus a booted stone. `spl copy` sends one process to the paper; two `spl 1` make four processes that each run `mov <boot+1,<boot` once (copying the 4-line stone to `paper`-5849+1) and then `jmp >boot`, which sends them to four consecutive stone lines. The stone loop is three lines (the first line is executed once and then serves as the increment): `mov >A,B`, `add inc,<0`, `jmn >-1,inc`. The ADD's B-predecrement and the JMN's B-postincrement make both point at the MOV using the ADD's own B-field, so the loop needs no explicit pointer. Step is 6742 on A and -6742 on B (gcd with 8000 is 2). Four staggered processes in a 3-line loop alternate MOV and ADD perfectly, giving 4 bombs per 3 rounds and surviving three process losses. The bomb is whatever the post-increment pointer selects, normally a blank cell **(bomb content uncertain in a live core)**. The paper is 5 lines with a 2-instruction copy loop and no in-loop attack: count 20 (15 blank cells), `spl *copy,<paper+4000`, guarded `jmz @dest,5849`. Split at start: 4 stone + 1 paper, so the paper can only ever hold 4 slots while the stone lives. There is no clear. Live code 14. Nearest: `lp-phase-stone`; recipe `lp-booted-phase-paper`.

```redcode
inc     mov    <6742,   <-6742
stone   mov    >13484,  1-13484
        add    inc,     <0
        jmn    >-1,     inc
paper   mov    #20,     >20
copy    mov    <paper,  <dest
        jmn    @0,      *copy
        spl    *copy,   <paper+4000
dest    jmz    @dest,   5849
```

### 6. The LP Destroyer (C. Schmidt) - 200, P-space
P-brain choosing between Replinator's paper (verbatim constants 21/6667/548/109/7293) and a single-process stone. The brain is 13 cells: two `ldp`, `mod.a #3`, `add.a`, `stp`, `jmp @0`, and a 7-row table; three states. Per the earlier 12-case replay: paper by default; a loss in state 0 selects the stone; the stone is kept while it wins; a tie or loss returns to paper. The stone adds 136 to both fields of `ptr`, drops `jmp #1,#1` at `*ptr`, and `ptr` itself then copies that cell 68 further, so two stun bombs per 4-cycle lap; 136 is 8 x 17 and the +68 offset fills the other residue, giving mod-4 coverage in the 998 counted laps. Then it falls into `mov cbomb,>steps` / `djn.f clear,>steps` / `jmp -1,>steps+2667`: a forward DAT clear with a 2667 decrement for imps. The stone runs with one process throughout. Layout: paper at 0, brain at 36, stone at 169, bomb at 199. Without P-space this collapses to Replinator minus the quickscan. Nearest: recipe `lp-outcome-switch`, `lp-scatter-paper`, `timed-stone`/`jmp-bomber`.

```redcode
sloop   add.f  steps, ptr        ; steps dat #136,#136
        mov.i  bomb,  *ptr       ; bomb  jmp #1,#1
ptr     mov.i  x,     x+68
x       djn.b  sloop, #998
clear   mov.i  cbomb, >steps     ; cbomb dat >2667,#11
        djn.f  clear, >steps
last    jmp    -1,    >steps+2667
```

### 7. Hippogriff (J. Metcalf) - 7 instructions, no P-space
Looping paper that the author says converged on Digital Rain. Entry at `copy` with count 28 preloaded (21 blank cells per copy, the widest carpet among the 7-liners). The attack line is `mov }5096,2407`; instead of doubling, `add inc,copy` adds the two fields of the `inc` SPL line (-5 and 2407) to it, so the write target advances 2407 per lap (coprime with 8000, so it eventually reaches every cell) and the read pointer cell retreats 5. The SPL line is therefore both launcher and increment constant. `spl >paper` restarts home (head rewrites count 28), `dest jmz @7569,*0` is the guarded transfer; here the jump target is B-indirect through the copy's head and the test is A-indirect, both resolving to the head. Copy head lands at `paper`+7547 (-453); `dest` is copied after 22 decrements. Solo: 8 processes, 2560 cells, survives. Nearest: `lp-paper` (step-walk variant); `lp-scatter-paper` for the copy/transfer part.

```redcode
paper   mov    #28,     #28
copy    mov    }5096,   2407
        add    inc,     copy
        mov    <paper,  {dest
        jmn    copy,    paper
inc     spl    >paper,  }2407
dest    jmz    @7569,   *0
```

### 8. Distortion Energy (inversed) - 200, no P-space
Paper plus a self-modifying stone. Boot: two `spl 1` make four processes that copy the 4-cell stone 4895 from `from`; `djn >1,#4` sends three of them to consecutive stone lines, the fourth falls through, `spl`s one more into the stone and jumps to the paper: 4 in the stone, 1 in the paper. The paper is 5 lines with a 2-instruction copy loop, first copy 5 cells, later copies 38 cells (33 blank: the biggest carpet on the hill), `spl from,{2746`, `jmz 5919,*0`. The stone is `add.x inc,ptr` / `mov {A,B` / `jmp loop,<gate` with A stepping 35 and B stepping 44: each lap moves the cell an A-predecrement pointer selects onto a 44-step lattice. The author states that, if the paper does not overwrite it, the stone goes through three step mutations and ends as a clear; `docs/lp-distortion-stone.md` traced those live reads, I did not re-trace them **(mutation path taken from the author comment)**. Live code 15. Nearest: `lp-mutation-stone`; recipe `lp-mutation-paper`.

```redcode
from    mov    #38,   #5
ploop   mov    <from, {to
        jmn    ploop, from
        spl    from,  {2746
to      jmz    5919,  *0
inc     dat    44,    35
loop    add.x  inc,   ptr
ptr     mov    {-2,   -1
        jmp    loop,  <inc-3
```

### 9. The LP Destroyer II (C. Schmidt) - 83, P-space
Same paper and same 3-state brain as #6; the alternative is a relocatable dwarf. Seven boot lines copy five cells 5421 away with `mov {dwarf,<dptr` and jump in via `djn.f @dptr,dptr`. The dwarf is `spl #0,<5279` over a 4-line loop: `mov dbmb,{7838` (A-predecrement stream), `mov dbmb,@dloop`, `sub #81,dloop`, `djn.f dloop,<5275`, so the SPL keeps adding processes into the loop up to the cap. `dbmb` is a blank cell 4 past the loop end, so the bombs are plain DATs at step -81 plus a second indirect stream. Comments say the `datb dat <5278,>1` cell combines with the SPL to form a gate and that the loop is hit after `dtime` 1677 steps "to start clear"; I did not trace that conversion **(uncertain)**. The earlier timing study measured the dwarf branch dying solo at cycle 3,847, which suggests the self-hit is not a clean conversion in an empty core. Nearest: `lp-outcome-switch`, `spl-stone`, `boot-stone`.

```redcode
        spl   #0,   <5279
dloop   mov   dbmb, {7838
        mov   dbmb, @dloop
        sub   #81,  dloop
dend    djn.f dloop, <5275
datb    dat   <5278, >1
```

### 10. Disciples of the Void (inversed) - 200, no P-space
Four copies of a 6-cell scanner, booted by two parallel loaders (`spl boot1` / `jmp boot2`) to +2000, +2156, +5961, +6117; each loader copies 6 cells to two destinations in a 5-line loop and then writes a `jmp #0,x` cell at the address each copy will use as its remote scan pointer. Each scanner gets one process. The loop is `add.b #0,ptr` (the immediate makes the ADD read its own B, -77) and `jmz.a loop,<ptr`: net step -78 (pair 1) or +78 (pair 2 uses `sub.b`), 0.5c, A-fields only. Every scanner instruction except `jmz.a` has A = 0, so the four cannot see each other; the pairs sit on opposite parities (odd shift 3961, even step). On a hit `mov @0,>ptr` writes a copy of the pointer cell, i.e. a `jmp #0,x` stun bomb, then `jmn.a @0,check` resumes. After a full pass the scanner finds its own `jmz.a` (or its partner's), overwrites it, the `jmn.a` falls through into `spl #0` / `mov @0,<kill`: a backward DAT clear fed up to the process cap. Solo the first SPL-fed clear starts near cycle 32,000 (one scanner gets a quarter of the turns). The original image stays behind as a 200-cell decoy. Live code is 34 instructions (two 7-cell scanners, two 9-cell loaders, 2 launch lines). Nearest: `lp-opposed-scanners`, `lp-transparent-quartet`, `lp-partitioned-quartet`.

```redcode
j1      jmp   #0,    0
loop1   add.b #0,    loop1-77
check1  jmz.a loop1, <loop1-77
        mov   @0,    >loop1-77
        jmn.a @0,    check1
        spl   #0,    0
        mov   @0,    <-7
```

### 11. BioMech (inversed, evolved with YACE) - 7 instructions, no P-space
Digital Rain's skeleton with an evolved attack. The head `mov #23,>8` uses its own B (8) as the first copy count, so the first copy is 8 cells; in copies and on restart the head's B is 0 and `>0` makes it write 23 into itself, so later copies are 23 cells (16 blank). Each lap: `mov <a,}26` moves the cell a backward-walking pointer selects (starting 2677 ahead) into a forward stream starting 26 past the loop, then `add.x #2696,{2678` adds (current pointer, 2696) to that same remote cell, then the copy and test. My reading is that every lap relocates one cell from ~2677 ahead and corrupts both fields of the original, leaving a 23-cell mutated strip per generation **(evolved code; effect on a live opponent not traced)**. `spl from,}6` restarts home; the transfer is `jmn.a @0,2231`, which tests the A-field of the copy's head (23, non-zero only if the head arrived) instead of a zero B. Solo: 8 processes, 3020 cells, survives. Nearest: `lp-paper` loosely; attack has no block.

```redcode
from    mov     #23,    >8
loop    mov     <a,     }26
a       add.x   #2696,  {2678
        mov     <from,  <to
        jmn     loop,   from
        spl     from,   }6
to      jmn.a   @0,     2231
```

### 12. Lord of the Core (C. Schmidt) - 155, P-space
Four complete small warriors behind a 10-row mod-encoded table (`ldp.a #0,in` / `ldp.a #301,table` / `mod.ba *in,table` / `stp.b *table,#301` / `jmp }0`; moduli 10 on loss, 9 on win, 11 on tie). Rows 0-1 and 9 run "8 Kings light", 2-4 "Viper's Bugloss", 5-7 Muffineer's paper (same constants as #29), 8 "Eve 15"; I did not enumerate the transitions **(policy uncertain)**. 8 Kings light: `spl 1` plus a self-rewriting `mov.i {0,#0` makes exactly three processes, which copy a 3-line dwarf (`mov {2550,1-2081` / `sub.x #2081,dDwarf` / `jmp dDwarf,}dDwarf`) to three sites and take one each. Viper's Bugloss: an 8-`mov` boot puts a second copy 3290 away and both run a 7-line `jmz.f` scanner, step 5266, 0.5c, bombing with its own pointer cell (`jmp #5266,#x`) and converting to an `spl #0` backward DAT clear when it bombs its own `sbmb`. Eve 15: two plain imps (`mov.i #-1,1`) 4174 apart and one process on a `djn.a #0,<7903` decrement stream. Solo first round: 3 processes, does not survive (the dwarfs). Every branch fits in 17 instructions or fewer, so any one of them is a legal 50-cell entry. Nearest: `tiny-lp-stone-triad` (three dwarfs), `twin-storm`/`lp-transparent-pair` (twin scanner), `djn-stream` + `imp`, `lp-paper`.

```redcode
sptr  jmp     #5266,  #INIT
sadd  add.ab  {0,     }0
scanx jmz.f   sadd,   @sptr
sbmb  mov     @0,     @sptr
schk  jmz.a   sadd,   sbmb
      spl     #0,     0
      mov     sptr-1, <schk
```

### 13. Rottinger II (G. Labarga) - 195, no P-space
Quickscan, then two identical 9-line papers started by `spl loop,{0` / `jmp loop2,{0`. The scan is the same Schmidt Q4 as Replinator (`qz 2108`, `qy 243`) with 10 double-bomb passes of `dat >-101,{qc2`, step 7. The paper is the scatter design with one extra line: on every restart and at the start of every copy, `add.a #4215,dst` moves the destination by 4215, so home relaunches spread across the core instead of stacking next to each other. Copy count is 9, exactly the body including its trailing `dat }1,>1`; there is no blank carpet. I read that tail as the cell a failed `jmz` falls into (a clean death) and as a non-zero marker; nothing references it **(purpose uncertain)**. Scatter is `mov {1171,{826` with `add.f {0,}0` doubling, as in Bronze minotaur. Solo: 8 processes, 3011 cells, eventually kills itself. Nearest: `opening-qscan-mul45` + recipe `lp-bronze-paper`.

```redcode
src     mov.ab #9,     #9
v1      add.a  #4215,  dst
loop    mov.i  <src,   {dst
        mov.i  {1171,  {826
        add.f  {0,     }0
        jmn.b  loop,   src
        spl    @src,   >2903
dst     jmz.b  5172,   *0
        dat    }1,     >1
```

### 14. Rottinger (G. Labarga) - 200, no P-space
The single-paper predecessor of #13: same paper, same constants, same quickscan, entered with `jmp loop` / `jmz.f loop`. The 200-cell image ends with six `jmp #i,<-250-i` lines, the only deliberate decoy cells in the top 30. Solo: 8 processes, 3167 cells, survives (unlike the twin version). The quickscan plus tables are 41 instructions and the paper 9, so this one is exactly a 50-instruction design once padding and decoys are dropped. Nearest: `opening-qscan-mul45` + `lp-scatter-paper`.

```redcode
q0      mul.b  *2,     qptr
q2      sne    {qtab1, @qptr
q1      add.b  qtab2,  qptr
        mov    qtab3,  @qptr
qptr    mov    qbomb,  }2108
        sub    #-7,    qptr
        djn    -3,     #10
        jmp    loop
```

### 15. LP and Feelin' Fine (J. K. Wilkinson) - 200, P-space
Three warriors behind an 18-row table (6 rows per strategy, state in P-cell 250, `mod.a #18` as brainwash guard). Result offsets are +1 loss, -1 win, 0 tie; my reading is that each strategy is kept until it has run through its six rows on losses and then hands to the next, cycling LRI -> Tempest -> spiral **(exact policy not traced)**. LRI (Limb-Rending Incisors): boots a 2-line backward DAT clear 2541 away (1 process), puts 5 processes into a 4-line vampire loop (`add inc,fang` / `mov fang,@fang` / `mov jbomb,*fang` / `jmp vamp`, step 15, a fang forward and a `jmp #0` stun backward each lap) and 1 into a forward clear that shares its pointer with the pit. The pit is `spl 1` / `mov dbomb,>pclear` / `jmp pit`: captured processes run our clear. Tempest: two 6-line papers (2-instruction copy loop that stops when the copied cell's B is 0, `spl @-3,<2151`, `jmz.b @0,3039`/`3359`, tail `dat {1,<1`) and a 3-line stone booted 801 back with four processes (`add.f 2,1` / `mov >A,B` / `jmp -2,<2946`, step 2946). Spire: three `spl 1` and a `jmp *1,}0` vector launch put 8 processes on a 3-point imp spiral (`mov.i #0,2667`). Nearest: `vampire-trap`, `vector-spiral`/`imp-ring`, `bomb-mice`, `hill-stone`.

```redcode
inc     spl     #-15,  15
vamp    add     inc,   fang
pfang   mov     fang,  @fang
        mov     jbomb, *fang     ; jbomb jmp #0,#0
        jmp     vamp,  @pfang
pit     spl     1,     pclear
        mov     dbomb, >pclear
hit1    jmp     pit,   pclear
```

### 16. Heavy cavalry (G. Labarga) - 186, P-space
Two strategies behind a 5-row P^3 table (state in P-cell 175; moduli 5 loss, 6 win, 7 tie). The `STRAT1`/`STRAT2` comments are stale: `STRAT1 equ loop+1` is the one-shot scanner and `STRAT2 equ lchp` launches the papers; `species` confirms round 1 runs one process over 64 cells. Decoding the table: the scanner is used first, a win resets the count, and after four consecutive non-wins the state reaches row 4 (value 214, which is 4 under all three moduli) and the twin paper is used for the rest of the match. The scanner compares two cells 7 apart with a pair of `sne` per 5-cycle lap (0.4c), step 2 x 4669, with a `<decoy` decrement stream. On a hit it runs a 0.5c clear from the hit (`mov *sw,>gate` twice per lap, `spl #` bombs first), watches two sentinel cells with `sne.b fc1,fc2`, and when they differ copies itself 5534 away with `mov }ptr,@ptr` and resumes there **(clear phases and the relocation trigger read from source, not traced)**. The papers are Rottinger's 9-liner with two parameter sets (4215/5172/2903 and 468/5843/5436). Nearest: `oneshot-cobra` + `finisher-guarded` + `leap` (loosely); recipe `lp-bronze-paper`.

```redcode
loop    sub.f inc,   @2          ; inc dat >-9338,>-9338
        sne.i *gate, @gate
        sub.f inc,   gate
scan    sne.i *gate, @gate
        djn.b loop,  <decoy
        djn.f setf,  @-3
clop    mov   *sw,   >gate       ; sw dat <1,fc2+2 ; sbm spl #x,x
        mov   *sw,   >gate
```

### 17. Simplicity (A. Marsden) - 200 (8 live + bomb at +26), no P-space
The reference one-pass LP scanner. `add.ab {0,}0` adds `b2`'s A (26) to its own B, `jmz.f a,@b2` scans both fields at 0.5c. On a hit `mov grave,@b2` drops `jmp {0,}0`, then `jmn @b1,*0` jumps back through `b2`, which as an instruction moves the `spl #1,#1` stored 26 cells ahead onto the cell just before the hit (A-predecrement through the freshly written JMP): an SPL/JMP trap pair for two extra cycles. The scan runs odd offsets only and every own cell at an odd offset has both fields zero except `b1`, so the first self-hit is exactly on `b1` after 4000 steps (8000 cycles). That overwrites `b1` with a cell whose B is 0, `jmn` falls through, and `spl #0` / `mov 5,}b2` / `jmp {0,}0` becomes a forward DAT clear from the bomb cell onward, with the SPL filling the 8 slots. The remaining cells of the 200 are blank. Solo: 8 processes, 7 cells executed, survives. As a 50-cell entry this is unchanged (span 27). Nearest: `tiny-lp-trap-scan`, `trap-scanner`; no exact block.

```redcode
b2    mov    26,    {b1+208
a     add.ab {0,    }0
start jmz.f  a,     @b2
b1    mov    grave, @b2
      jmn    @b1,   *0
      spl    #0,    0
      mov    5,     }b2
grave jmp    {0,    }0
```

### 18. LPKD (NDusN) - 200, no P-space
Quickscan, then an Eve 15 descendant. The scan is the Core Warrior 92 MUL-decoded form (`qm 3722`, `qm2 2681`), 20 double-bomb passes with `dat >-90,>qc`, step 5, exiting with `djn.f init,@found`. `init` splits one process to `boot`, which copies the imp instruction 428 away, starts two plain imps (`mov.i #3315,1`) and settles on `djn.f #0,<-91`, a backward decrement stream. The main process is a 0.5c bomber whose bomb is that same imp instruction: `add #6630,2`, then two writes, the second landing 3315 past the first by going A-indirect through the bomb just written, so the pattern is every 3315 (gcd 5 with the core). An opponent process that runs a bomb becomes an imp, harmless under an 8-process cap, and the decrement streams break imp instructions they cross. Four processes total; solo 7873 cells executed (the imps). The author left the parts spread out as a decoy. Nearest: `opening-qscan-mul`, `djn-stream`, `imp`; the imp-throwing bomber has no block (`jmp-bomber` is the closest shape).

```redcode
init    spl   boot, {1002
        add   #6630, 2
        mov   imp,  @1
        mov   imp,  *-1
        djn.f -3,   <jump-92
boot    mov   imp,  *2
        spl   imp,  {3333
        spl   imp+428, {5555
        djn.f #0,   <-91
```

### 19. End of Days (C. Schmidt) - 174, P-space
A 15-row mod table (moduli 13 loss, 14 win, 15 tie; state in P-cell 456) choosing the bomber in 11 rows and Replinator's paper in 4 (rows 3, 7, 9, 14); I did not derive the policy beyond that **(uncertain)**. The bomber boots 10 cells 4017 away, starts the copy, waits 5 cycles and then also starts the home instance, so two instances share the 8 slots. Each is `spl #-95,-95` on top of a 4-line loop: `mov sm,*193` (a `jmp #1,#1` through the A-field of the target cell), `mov sp,@msm` (the SPL line itself as a bomb), `add.ab #190,msm`, `jmz.b @in,#0`. With several processes one line apart, the JMP is thrown through the A-field (-95) of the SPL bomb just written, so the pattern is SPL every 190 with a JMP at the half step: mod-95, gcd 5 **(interleaving reasoned, not traced)**. When an SPL bomb lands on `hit`, processes run through it into `mov cbomb,>gate` / `jmp clr,>gate-2667`, a forward DAT clear. Solo: 8 processes, 32 cells, survives. Nearest: `carpet-stone`/`spl-stone`, `lp-scatter-paper`, a switch.

```redcode
sp      spl.b  #-95,   -95
msm     mov.i  sm,     *193       ; sm jmp #1,#1
msp     mov.i  sp,     @msm
in      add.ab #190,   msm
hit     jmz.b  @in,    #0
clr     mov.i  cbomb,  >sp-3      ; cbomb dat 0,15
        jmp.b  clr,    >sp-3-2667
```

### 20. Yamabushi (inversed) - 13 instructions, no P-space
Pair scanner with a three-cell stun and a two-phase clear. `add inc,@x` / `sne A,A+6` / `djn.f loop,<6516` is three cycles per pair (0.66c), step 70. A hit gets `spl #0,0` at the first cell, `djn clear,#-1` after it and `jmp -6,{clear` six cells on, a trap that keeps captured processes cycling. The scan lattice is mod 10 with residues 0 and 6, and `ptr` and `s0` are exactly 6 apart, so after 800 steps (about 2400 cycles, 20% of the core) the scanner compares itself, rewrites `ptr` and `loop`, and `jmz.a loop,{ptr` falls through. The clear is `spl #0` / `mov inc,>cptr` / `djn clear,#-1`: one pass of 7999 `jmp #70,70` stun bombs, then `j2`'s `{clear` shifts the source from `inc` to `kill` and the next pass writes `dat 4000,16`, whose B (16) makes the pointer skip the body each lap. Solo: 8 processes, 11 cells, survives. Nearest: `cmp-carpet-scanner`/`pair-wipe-scanner` + `finisher-counted`.

```redcode
loop    add    inc,   @x          ; inc jmp #70,70
ptr     sne    70,    76
        djn.f  loop,  <6516
attack  mov    s0,    }ptr
x       mov    j1,    *ptr
        mov    j2,    @ptr
        jmz.a  loop,  {ptr
s0      spl    #0,    0
clear   mov    inc,   >kill-1
j1      djn    clear, #-1
j2      jmp    -6,    {clear
```

### 21. Hypnos (inversed) - 16 instructions, no P-space
0.66c pair scanner: `add inc,ptr` / `seq A,A+17` / (skipped `slt`) / `jmn.a loop,@loop`, step 34 with a 17-cell gap, so the two compared cells cover both parities and the whole core is scanned once in about 4000 steps (12,000 cycles). A differing pair outside the body (`slt.ab #len,ptr`) gets `djn #0,#0` on both cells, a bomb that holds a process in place for a full count. The loop condition tests `ptr`'s A-field, which starts at 204 and reaches exactly 0 after 3994 steps; the process then falls into `spl #34,34` and a clear: `mov kill,>cptr` / `djn.f clear,{cptr-1` / `jmp {0,}0`. The clear pointer is the B-field of the SPL (34), the bomb `dat 1,8` resets the pointer past the body when it comes around, and the `djn.f` adds a backward decrement stream. No bombing of its own code is needed to switch phases. Solo: 8 processes, 10 cells, survives. Nearest: `pair-wipe-scanner` + `finisher-counted`.

```redcode
loop    add    inc,   ptr         ; inc spl #34,34
ptr     seq    204,   221
        slt.ab #len,  ptr
        jmn.a  loop,  @loop
        mov    bomb,  *ptr        ; bomb djn #0,#0
        mov    bomb,  @ptr
        jmn.a  loop,  @loop
clear   mov    kill,  >inc        ; kill dat 1,8
        djn.f  clear, {inc-1
```

### 22. Hired Guns (R. Macrae) - 15 instructions on LP, no P-space there
A multi-format file: `for` conditions select parts by `MAXPROCESSES`/`MAXCYCLES`. With 8 processes only the Iron Gate scanner (8 lines), the "forward clear for LP" (3 lines) and 4 data cells assemble; the P-spacer and DieHard need 8000 processes. Scanner: `add d,@x` / `cmp a+98,a` / `slt #20,@x` / `djn a,<7000`, step 196, 0.66c; a hit gets `jmp -1` at the B cell and `spl 0` just before it, then `sub n,@x` shifts the pair by 98 and re-compares without stepping. The B cell starts at `a` itself, so after 2000 steps (gcd 4) the scanner bombs `a` with a JMP whose B is 0, `jmn c,a` falls through, and `spl 0,>x-1` / `mov e,>x` / `djn.f -1,>x` clears forward with `dat <2667,#8` **(self-hit trigger derived by arithmetic, not traced)**. Solo it reaches 8 processes and later kills itself. Nearest: `pair-wipe-scanner`, `blur-scanner` + `finisher-guarded`.

```redcode
a  add d,     @x                 ; d dat <196,<196
c  cmp a+98,  a
   slt #20,   @x
   djn a,     <7000
   mov j,     @c                 ; j jmp -1
x  mov s,     <c
y  sub n,     @x                 ; n dat <-98,<-99
   jmn c,     a
s  spl 0,     >x-1
   mov e,     >x                 ; e dat <2667,#8
   djn.f -1,  >x
```

### 23. Romulan Warbird (P. Kendall) - 14 instructions, no P-space
Iron Gate rewritten for LP. `add.f inc,@x` / `cmp.i A,A-98` / `slt.ab #12,@x` / `djn.f loop,<-1308`: step 196, 0.66c, with a decrement stream. A hit gets `jmp -1` on the B cell and `spl #0` on the cell before it, then `add.f adjust,scan` (98, 99) shifts the pair by 98 and `jmn.a @x,inc` re-compares. The B cell reaches `loop` after a full pass; the SPL then lands on `inc`, zeroing its A, and the `jmn.a` falls through into `spl #0,}ptr` / `mov dbomb,>ptr` / `jmp -1,}ptr`, a forward clear with `dat >2667,>17` fed by the SPL. Solo: 8 processes, 11 cells, survives. #28 embeds this warrior unchanged. Nearest: `pair-wipe-scanner` + `finisher-guarded`.

```redcode
loop    add.f  inc,    @x         ; inc dat 196,196
scan    cmp.i  195,    97
        slt.ab #12,    @x
        djn.f  loop,   <-1308
        mov.i  jbomb,  @scan
x       mov.i  sbomb,  <scan
        add.f  adjust, scan       ; adjust dat 98,99
        jmn.a  @x,     inc
sbomb   spl.a  #0,     }inc-2
clear   mov.i  dbomb,  >inc-2
jbomb   jmp.a  -1,     }inc-2
```

### 24. DaubFusion (R. van Rijn) - 97, no P-space
Everything at once, sized to exactly 8 processes. The Schmidt Q4 quickscan (19 double-bomb passes) stores three of its table values in the B-fields of the launcher's first three SPLs, so the launcher doubles as the table. Launch: `spl s1`, `spl p1`, `spl s2`, `spl p2`, then a binary split sends four processes to `imp`, `imp+2667`, `imp+5334`, `imp+8001`: a 3-point spiral with a fourth imp on the second turn. Papers are 7 lines with a 3-instruction lap: copy, `mov 4,{1088` (drops the paper's own `dat >1,<1` tail through a predecrement stream), test (loop ends when the copied cell's B is 0); `spl @-4`, `jmz.b @0,6587`/`4541`; count 7, no carpet. Stones are 3 lines, one at home (step 4343) and one booted 2348 away (step 6393), one process each. No clear and no endgame beyond the imps. Solo: 8 processes, all 8000 cells executed. Nearest: `opening-qscan-mul45`, `bomb-mice`, `self-add-stone`/`boot-stone`, `vector-spiral`.

```redcode
      mov   #7,    #7
p1    mov   <-1,   <4
      mov   4,     {1088
      jmn   -2,    @-3
      spl   @-4,   {5433
      jmz.b @0,    6587
      dat   >1,    <1
s1    mov   {1990, 1-4343
      sub.x #4343, -1
      jmp   -2,    }-2
```

### 25. Biocular (C. Schmidt) - 66 (16 live), no P-space
A paper that looks before it copies. Boot: eight `mov <sBo,{sBo` copy the 7-line body 3855 away, `spl` there, `jmp from`. The head sets count 37, then `add.a #814,to` / `jmz.f scan,*to` steps the destination by 814 (gcd 2) at 0.5c until the destination cell is non-empty; only then does the 2-instruction copy loop run, laying 37 cells (30 blank plus the body) just below the find. `spl from,{4265` restarts the scan at home and `jmz 7483,*0` moves into the copy. In an empty core it never copies except onto its twin or itself: solo peak 5 processes, 53 cells, does not survive. It is effectively a scanner whose bomb is a 30-cell DAT carpet plus a fresh instance. Nearest: none (`relaunch-paper` is the closest idea).

```redcode
from    mov     #37,   #37
scan    add.a   #814,  to
        jmz.f   scan,  *to
loop    mov     <from, {to
        jmn     loop,  from
        spl     from,  {4265
to      jmz     7483,  *0
```

### 26. Assault on Mirage (inversed) - 20 instructions, no P-space
Bomber and clear as independent parts, both booted (stone 5500 away, clear a further 7380). The boot uses `mov boot,0` twice to turn a line into `spl 1` after the first process has passed, giving 3 and then 5 processes for the parallel copies; `djn >bps2,#5` fans the stone processes across consecutive lines. The author states 5 processes in the bomber and 1 in the clear; `species` measured a peak of 7 **(final split not traced)**. Bomber: `mov bomb,*zofs` / `add #1662,sptr` / `mov bomb,@sptr` / `jmp sptr,<sgate`, bomb `jmp #831,0`. Writes go indirect through the target cell, so a bomb landing on an earlier bomb is thrown 831 further; 831 is coprime with 8000. The stone hits itself after 3050 steps and the clear (`mov kill,>cptr` / `jmp -1,<gate`, bomb `dat 0,8`) erases the wreck soon after. Solo: survives, 18 cells. Nearest: `jmp-bomber`, `hill-stone`, `lp-sector-clear`.

```redcode
sptr    mov    bomb,  *zofs
        add    #1662, sptr
hit     mov    bomb,  @sptr
        jmp    sptr,  <sgate
bomb    jmp    #831,  0
clear   mov    kill,  >clear-3
        jmp    -1,    <clear-4
kill    dat    0,     8
```

### 27. Reclon 2 scanner (G. Labarga) - 120 (20 live), no P-space
Ben Ford's Switchblade, twinned: ten `mov <dbm,<sgo` copy the 9 cells 4000 away, `spl scan` starts home and `jmp sloc+2` the copy. The scanner is the same shape as Viper's Bugloss in #12: `add.ab {0,}0` (adds the pointer cell's A, 238, to its B), `jmz.f loop,@ptr` at 0.5c, `mov @0,@ptr` bombing with the pointer cell (`jmp #238,#x`), `jmz.a loop,atk`. Step 238 has gcd 2 with the core; the pointer starts at `atk`+238 so the first self-hit is on `atk`, which makes its A non-zero and drops the process into the clear. The clear is `spl #0,<0` / `mov dbm,<-9` followed by a DAT: each spawned process writes one bomb and dies, so the backward clear runs at one cell per 3 cycles. Solo: peak 4 processes, 22 cells, survives. Nearest: `twin-storm`, `lp-transparent-pair`.

```redcode
ptr     jmp    #238, atk+238
loop    add.ab {0,   }0
scan    jmz.f  loop, @ptr
atk     mov    @0,   @ptr
        jmz.a  loop, atk
clr     spl    #0,   <0
        mov    dbm,  <-9
        dat    0,    0
dbm     dat    <5325, <1
```

### 28. 100% Evil (R. van Rijn) - 200, P-space
Quickscan, then a 2-way P-switch. The scan is van Rijn's own: 27 `seq` pairs 4000 apart at multiples of -100, decoded by `mul.b qtab,qptr` / `mul.ab qtab,@qslow` from a 3-row factor table, a side pick, then 12 passes of two `dat <76,<1` bombs. The switch is Macrae's 9-line one from Hired Guns (strategy number in P-cell 116, incremented after any loss or tie, taken mod 2): even runs the scanner, odd runs paper + stone. The scanner is Romulan Warbird verbatim. The other branch copies the 8-line paper 3105 away (`mov <pptr,{pptr` / `djn -1,#8`), starts both copies and sends the last process to a 3-line stone (the Tempest stone from #15, step 2946). The paper is Rottinger-shaped with a DAT stream instead of a scatter: `add.a #2343,to` on each start, copy, `mov 4,{4412` (its `dat }1,>1` tail), test, `spl pap,{4212`, `jmz 5223,*0`. Solo round 1: 8 processes, 6241 cells. Nearest: `opening-qscan-qi`, `pair-wipe-scanner`, `bomb-mice`, `boot-stone`.

```redcode
pap     mov   #8,     #8
        add.a #2343,  to
ploop   mov   <pap,   {to
        mov   4,      {4412
        jmn   ploop,  pap
        spl   pap,    {4212
to      jmz   5223,   *0
        dat   }1,     >1
```

### 29. Muffineer (C. Schmidt) - 194, no P-space
Quickscan (Schmidt Q4, 14 double-bomb passes), then one paper with the heaviest lap on the hill: five instructions per copied cell. Copy (`mov <pRef,<pBck`), relocate a cell from a predecrement stream 963 ahead into a post-increment stream (`mov <963,}pOff`), advance that line's B by its own A (`add.ab {0,}0`, +963, coprime with 8000), drop the carried `dat }7506,>7279` at the new B (`mov pBmb,@pPtr`), test. Count is 9, the exact body, so each generation costs 45 cycles and lays 9 DATs and 9 relocations; no blank carpet. `spl @pRef,<3704` restarts home and `jmz @0,5229` is the guarded transfer. Entry is `pGo` with the count preloaded. Solo: 8 processes, 4735 cells, survives. Scan + tables (41) + paper (9) is exactly 50 without the 143 blank cells. Nearest: `opening-qscan-mul45` + `lp-paper`/`bomb-mice`.

```redcode
pRef    mov     #9,     #9
pGo     mov     <pRef,  <pBck
pPtr    mov     <963,   }pOff
        add.ab  {0,     }0
pHit    mov     pBmb,   @pPtr
        jmn     pGo,    pRef
        spl     @pRef,  <3704
pBck    jmz     @0,     5229
pBmb    dat     }7506,  >7279
```

### 30. Incisive (R. Macrae) - 200 (~55 live), no P-space
A declared copy of Limb-Rending Incisors (branch w0 of #15) with step 45 and a tweaked boot. Start: four `mov` lines put the 2-line backward DAT clear ("sneak") 4841 away; then `spl sboot` (1 process), `spl myclear` (1), four `spl vamp` and a `jmp vamp` (5): seven processes placed. `species` shows 8 at peak solo, presumably because the vampire eventually captures one of its own processes into the pit's `spl 1` **(cause of the eighth process not traced)**. The fang loop and pit are as in #15: a `jmp` fang forward and a `jmp #0` stun backward per lap; the pit's `spl 1` / `mov dbomb,>pclear` / `jmp pit` makes captives run the forward clear, which shares `pclear` with our own clear process. The data cells are spaced with single blank cells (`hit1`..`hit5`) so the vampire's own pattern passes between them. Solo: 22 cells executed, survives. Nearest: `vampire-trap`.

```redcode
inc     spl     #-45,  45
vamp    add     inc,   fang       ; fang jmp pit-stfang, stfang
pfang   mov     fang,  @fang
        mov     jbomb, *fang
        jmp     vamp
myclear mov     dbomb, >pclear
        jmp     myclear
sneak   mov     bomb,  <bclear
        jmp     -1,    <bclear
```

## Patterns

- **The hill is a paper hill.** 20 of 30 carry a counted-copy LP paper, 6 are nothing else, and the 7-instruction form (head / attack / update / copy / test / `spl` home / guarded transfer) takes ranks 1, 4, 7 and 11 with no opening and no padding. A 50-instruction, no-P-space limit costs these nothing.
- **One process must do several jobs per lap.** The best papers copy, attack and update the attack in 4 cycles per cell, with the attack's address arithmetic folded into fields that already exist (`add {0,}0` on the previous line, or the SPL line reused as the increment). Papers with a bare 2-instruction copy loop (5, 8, 15) only place when a multi-process stone runs beside them.
- **Oversize copies are the cheap attack.** 12 warriors copy 13-33 more cells than the body, so each generation lays a blank carpet at its destination for free. The first copy is short (5-8 cells) to get a second process out quickly; later copies are long.
- **The transfer survives the cap.** Every paper ends `spl home` then a conditional jump into the copy guarded by a field of the copy's head. When 8 slots are full the SPL is a no-op and the process just moves on, so the paper never stalls and never jumps into a broken copy.
- **Scanners are one-pass with a self-hit handoff.** All ten scan once (0.5c single-cell `jmz` or 0.66c pair compare), bomb with stun cells (`jmp #x`, SPL+JMP, `djn #0`), and are laid out so the first own cell the scan can see is the one whose overwrite drops the process into an `spl #0`-fed DAT clear. None uses a counter. All fit in 16 instructions; twins and quads are booted about half a core apart.
- **Few processes per component, counted exactly.** Stones run 4-5 processes in a 3-4 line loop (staggered entry via `jmp >ptr` or `djn >ptr`), launchers budget all 8 slots (24: 2+2+4), and several boots use self-rewriting lines to get 3 or 5 processes. `spl #0` appears only where an unbounded feed is wanted (clears, dwarfs).
- **What a 50-cell, no-P-space entry gives up:** (a) the P-switchers' second strategy - seven warriors (6, 9, 12, 15, 16, 19, 28) lose their answer to a bad matchup and reduce to one branch; (b) padding - 17 warriors use 100-190 blank cells to separate components and to leave a large image behind after booting, which matters against scanners and quickscans; (c) the full quickscan beside a multi-part body - the Q4 scan with tables is about 41 instructions, leaving 9, which is exactly a Rottinger or Muffineer paper and nothing else (2, 14, 29 fit; 13, 18, 24, 28 do not).
- **What survives the limit unchanged:** every pure paper, every single scanner (and twin scanners with a compact boot: 27's live code is 20, 10's is 34), the paper + booted stone pair (5 and 8 are 14-15 live instructions), Assault on Mirage, and any single branch of Lord of the Core. Only the vampire (30, about 55 live cells) and DaubFusion (97) need real cutting.
- **Minimum distance 200 with a 50-cell image** makes quickscans weaker than on this hill (targets are a quarter the size), which further favours spending the 50 cells on two or three small bodies rather than a 41-cell scan.
- **Imps are rare (4 of 30) and never primary.** They appear as a tie fallback or, in LPKD, as a bomb. Most clears still carry a `2667` decrement or a DJN stream, so a spiral alone will not hold.
