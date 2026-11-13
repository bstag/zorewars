# What the top 30 of each tournament hill are made of

A source-level reading of the top 30 warriors on the four Koenigstuhl hills behind the tournament brackets: ICWS'88, 94nop, Limited Process and X. Ranks are the recursive tables as retrieved on 9 November 2026. Every one of the 120 sources was read in full and assembled locally; lengths are assembled lengths. Mechanisms that were derived by hand and not traced in the simulator are marked **(uncertain)** in the per-hill files.

| Hill | Full breakdown | Hill settings | Tournament difference |
|---|---|---|---|
| ICWS'88 | [88.md](88.md) | 8,000 cells, 8,000 processes, length 100 | length 50 |
| 94nop | [94nop.md](94nop.md) | 8,000 cells, 8,000 processes, length 100 | length 50 |
| Limited Process | [lp.md](lp.md) | 8,000 cells, 8 processes, length 200, P-space | length 50, no P-space |
| X | [94x.md](94x.md) | 55,440 cells, 10,000 processes, 500,000 cycles, length 200, P-space | length 50, no P-space |

Each file has a summary table (one row per warrior), a block census, a paragraph per warrior with its core loop quoted, and a list of patterns.

## The four hills side by side

| | '88 | 94nop | LP | X |
|---|---|---|---|---|
| Modal design | quickscan, then stone/imp (9) | quickscan, then paper/stone through a fan boot (14) | 7-instruction counted-copy paper (20 carry one, 6 are nothing else) | P-space switcher over small scanners and an airbag stone (top 5, 9 in all) |
| Quickscan | 24 of 30 | 27 of 30 | 7 of 30 | 3 of 30, none in the top 11 |
| Quickscan form | additive decoder: Metcalf 18 pairs in 48 lines (11), Janeczek 10 to 12 pairs in 33 to 37 lines (11) | q^4.5, 33 cells in 35 lines (12); Metcalf one-MUL lattice, 24 cells in 30 lines (6); two-factor q^i (5) | Schmidt MUL-decoded Q4, about 41 lines | MUL-decoded q^4 / q^4.5 |
| Stone | 14 | 16 | 11 | 17 |
| Paper | 9, straight-line chains ending in an imp tail, resin or clear | 18, of which 14 beside a stone | 20 | 5, never alone |
| Imps | 15: twelve 3-point, three 7-point | 4: two 3-point pumps, two single-imp failsafes | 4, never the main payload | 12: 13-point and up (3- and 7-point rings do not exist on 55,440) |
| Scanner | 8 | 10 | 10 | 19 |
| Vampire | 3 | 1 | 2 | 2 |
| Booted away | 27 | 25 | 14 | 22 |
| P-space switch | not allowed | not allowed | 7 | 9, plus 2 with an STP bomb only |
| Fit in 50 as published | 2 (Eidolon, Tangle Trap 3) | 0 (8 have 50 or fewer non-padding lines) | 9 | 7 |

## What recurs everywhere

- **Tables hide in fields that already exist.** Quickscan factors sit in the B-fields of boot `SPL` lines and bombs, boot copy pointers become the jump vectors, increments are live instructions. This is where the top warriors find their last five to ten cells.
- **Phase changes are triggered by self-hits, not counters.** Stones aim a bomb at their own loop after a chosen number of passes; scanners are laid out so the first own cell the scan reaches is the one whose overwrite starts the clear.
- **Scanners stun before they kill.** `SPL` wipes or `SPL`/`JMP` pairs first, then an `spl #0`-fed DAT clear. One process, 9 to 16 lines.
- **Imps are answered rather than launched** on 94nop and LP: `dat <2667,<5334` in papers and clears, DJN streams in stones. '88 and X still launch them, and X only on rings of 13 points or more.
- **The fields are a few designs retuned.** On 94nop, Arvon and pst_v4 are Azathoth's boot, stone and paper; Kaitain is King Cobra's body; three Schmidt entries are one program. On LP, Replinator's paper reappears in three P-switchers. On X, four of the top five share Moore's airbag stone.

## What the 50-instruction limit changes

- **'88:** the 33 to 48-line quickscan cannot be carried with a body. Bodies are 15 to 29 lines, so the shapes that fit are a body with a 4 to 6-pair scan, or a body with a short decoy.
- **94nop:** padding goes first, then scan width, then one component. Azathoth and Arvon are exactly 50 code lines (30 scan, 9 boot, 6 stone, 5 paper); Kaitain is 48. The scanner bodies fit whole with a full 24-cell scan.
- **LP:** the pure papers and single scanners lose nothing. The seven P-switchers reduce to one branch, and the 41-line quickscan leaves room for a 9-line paper and nothing else.
- **X:** with no P-space each switcher collapses to its first-round arm, a scanner in seven of nine cases; Fatamorgana X throws its first two rounds on a handshake and so never fights. Every arm is small enough to fit: Arrow X 11, Tsunami 9, Kenshin 23, airbag stone with boot 26.

## Known disagreements and open checks

- **Talisman ('88):** this reading counts four stone processes and one launcher; [hill-block-review.md](../hill-block-review.md) says five and one.
- **King Cobra (94nop):** the SPL-to-DAT switch is read here as the clear's DJN stream wrapping onto `bptr`; the `oneshot-cobra-imp` catalog text describes a pointer overwrite. Neither was traced.
- **Stone switch-off timings** on '88 and 94nop come from the target arithmetic, not from simulation with all processes interleaved.
- **Kenshin 4X (X):** its seven-line "pre-bomb" stone measured zero executions, so the strategy comment is stale. KAT v5's table comment is stale for row 0.
- **Heavy cavalry (LP):** the `STRAT1`/`STRAT2` comments are stale; measured, it opens with the scanner.
