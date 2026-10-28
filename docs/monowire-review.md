# Monowire review and compact reference screen

Reviewed October 28, 2026. [Mizcu's development article](https://corewar.co.uk/mizcu/monowire.htm)
is useful evidence for combining structural evolution with parameter tuning.
Its final source credits Miz. The article provides no publication date, and its
historical hill placement is not a current ranking. See the
[mechanism analysis](monowire-mechanisms.md) for the development sequence,
component credits, pointer relationships, and proposed behavioral contracts.

## What was preserved and tested

The full page and all nine displayed code blocks are cached in ignored
`imported/history/monowire/`. The [review receipt](monowire-review.json) records
the page hash, snippet hashes, source line ranges, compile diagnostics, exact
copy checks and per-opponent results. Only code blocks are assembled; downloaded
HTML is not executed.

The final displayed source contains **80 instructions**: nine fighting
instructions, 60 decoy instructions and 11 boot/pointer instructions. We tested
three explicitly distinguished variants:

| Variant | Length | Change |
|---|---:|---|
| Original final source | 80 | Unchanged article extraction; a reference above our 50-instruction entry limit. |
| Local compact derivative | 50 | Reduce decoy repetitions from twelve to six; compensate the destination expression so the payload lands at the original location. |
| Local body extraction | 9 | Retain only the final fighting body and start at its update instruction; removes both relocation and decoy. |

The compact version preserves the nine assembled payload instructions. The
original destination pointer sits at offset 79, giving a payload landing of
`up - 1021` after the copy. With 30 fewer decoy instructions, the derivative
uses a symbolic destination operand `up-1021+9` to preserve that landing. It
does not simply remove padding and accidentally move the attack. The boot code
and pointer instructions themselves necessarily occupy different original
positions, so this is not a pure decoy-content-only experiment.

At both base zero and a wrapping load at `coreSize - 7`, original and compact
versions reached their relocated entry after ten cycles with all nine payload
instructions copied exactly, comparing fields modulo the core. Their landing
locations matched: 6979/6972 in the 8000-cell profile and 54419/54412 in 94x.
All three variants survived both full-cycle solo runs in each profile. These
checks establish copying and survival, not complete scanner or clear contracts.

Earlier displayed snippets are not all complete warriors. Under our assembler,
blocks 1, 6, 8 and 9 compile to 2, 97, 9 and 80 instructions respectively.
Blocks 2–5 and 7 have missing context, reserved `END` label conflicts, or literal
dialogue/placeholders. Their errors are retained rather than silently turning
illustrative reconstructions into purported original releases.

## Matched exploratory screen

Each entry faced Dwarf, Seeker, Silk and Vampire for four rounds at each of seeds
20261030 and 20262030: 32 rounds per entry/profile, **288 rounds total**. Native
94nop used 8000 cells/80,000 cycles; 94x used 55,440 cells/500,000 cycles.
Opponents passed solo checks. Original-80 is an oversized historical reference;
the other candidates and controls were assembled with a 50-instruction cap.
All evaluation used CPU.

| Entry | 94nop points/round | 94x points/round |
|---|---:|---:|
| Original 80 | 2.281 | 2.156 |
| Compact 50 | 2.281 | 2.156 |
| Body 9 | 2.031 | 2.250 |
| Plain DAT control | 1.063 | 1.469 |
| Lifeboat default | Not tested | 0.906 |

The original and compact variants had identical win/loss/tie results in this
screen. That does not prove decoy size never matters. Body-9's slightly higher
94x score likewise does not establish that removing booting is generally better:
it changes both layout and starting location, and this is a tiny sample. These
results justify a scanner/clear generator experiment, not promotion or a public
hill-strength claim. There was no tuning, evolution, new held-out field, or
significance test. Historical benchmark scores were not reproduced.

## Implications for our evolution work

The useful unit is the **scanner, pointer handoff and self-modifying clear
together**. Independently mutating scan step, probe gap, bomb selector and table
layout risks destroying the mechanism. The source analysis gives the relevant
relationships and tests to add before exposing choices to evolution.

The ideal uninterrupted +24 scan orbit covers 25% of an 8000-cell core but only
one twelfth of a 55,440-cell core across its two probes. This arithmetic excludes
early detection, decrement-stream side effects and self-modification. It is a
reason to derive and measure new scan geometry for 94x, not infer that +24 is
already tuned for that profile from the encouraging score.

Before generator admission, test actual targets at each probe, first clear-write
placement, false triggers from startup code, the SPL-to-DAT phase transition,
queue growth and damage, and self-safety over repeated passes. The current review
only verifies startup copies, full-cycle solo survival and aggregate fights.
The final clear creates many processes, so it cannot simply inherit the existing
single-process clear grammar's contract.

The next sensible implementation would keep a verified nine-instruction core
structure while searching derived scan geometry, clear parameters, relocation
and decoy options. Parameter tuning can refine each legal structure; Red Queen
can then test it against both a base field and accumulated champions. This is
a proposed next experiment. No executable generator or Red Queen setting was
changed here, and public code remains an attributed reference.

## Reproduce

With the cached article present:

```text
node scripts/review-monowire.js --out evolved/new-monowire-review
```

The output directory must be new. The script regenerates labeled extractions in
the ignored cache and writes a report in the requested output directory. The
completed run is `evolved/monowire-review-20261028-v2/report.json`; the tracked
copy is [monowire-review.json](monowire-review.json). The initial incomplete run
was superseded after correcting the verifier to normalize negative operands;
no source or VM change was needed.
