# Review of Planar's “other” warriors

Reviewed October 28, 2026. “Other” is a mixed collection, not a single strategy
family. The useful additions for us are repair, continuous deployment of small
attacks, process-scheduled damage detection, movement triggers, numeric damage,
and execution-triggered reports. Several entries instead illustrate special
tournament protocols, deliberate losing, simulator validation, or calculations.

[All 305 sources](planar-other-index.md) · [Survey evidence](planar-other-survey.json)
· [Detailed source/post review](planar-other-mechanisms.md)
· [Experimental results](planar-other-screen.json).

## Scope and the ideas worth taking forward

We surveyed metadata, source comments and compact-94x compilation for all 305
sources. **137 compile with an actual 50-instruction cap**; this is not a claim
that they behave correctly. Seventy-three contain P-space instruction syntax.
The comment signals in the index are explicitly heuristic and often absent;
they prioritize reading, not automatic family assignment. The detailed report
reviews a 19-source shortlist plus tournament-specific examples. Eleven compact
originals received solo checks, and six surviving originals received a small
battle screen. Most entries have not been behavior-tested.

| Mechanism | Concrete examples | What to preserve or derive |
|---|---|---|
| Continuous worker refresh | Dwarfer, 8 instructions; Dwarfer II, 20 | Deploy tiny attacks repeatedly; derive the actual stride including pointer side effects, protect the controller and measure revisit time. |
| Numeric disruption | tamper, 3; Signal 1.1, 7 | Attack operands with a decrement stream. Keep self-exclusion, wrap detection and phase handoff explicit. |
| Mutual repair | bunker variants, 25 and 28 | Detect supported damage, kill stray processes, wait, restore and restart. Derive partner spacing and checksums from emitted code. |
| Process-scheduled detection | Airbag Demo, 21 | Queue order and pointer side effects signal missing work. Its fallback is only JMP 0; a real attack still needs designing. |
| Reactive movement | 4-line Bomb Dodger; kill -9, 8 | Verify the trigger, copied state and repeated relocation. Small source length alone is insufficient. |
| Execution-reporting bombs | Process Finder / Combatra | A planted instruction reports its location only when executed. An in-round, no-P-space receiver is a new design hypothesis. |

These mechanisms are explained with line-specific primary evidence in the
[source review](planar-other-mechanisms.md). No new executable recipe was created.
The new block-catalog entries are reference candidates only.

For our next generator experiment, **continuous worker refresh** and a
**numeric-disruption opening** are the smallest starting points. A **derived
repair pair** is more distinctive but demands more verification. This is a
design priority based on size, source evidence, and the limited screen below;
it is not a ranking of proven tournament winners.

## Solo checks reveal portability and timing traps

Every selected source was kept unchanged, compiled with length 50, and tested
at base 0 and at `coreSize - 7` to exercise wrapping. The two placements agreed
on survival and death cycle for each entry. Standard 94nop uses 8000 cells and
80,000 cycles; standard 94x uses 55,440 cells and 500,000 cycles. We also ran an
8000-cell diagnostic with the horizon extended to 500,000 cycles, so a short
native-profile pass would not hide eventual self-destruction.

| Original | Standard 94nop solo | 8000 cells, extended 500k | Standard 94x solo |
|---|---|---|---|
| Airbag Demo | survives | survives | survives |
| 4-line Bomb Dodger | survives | survives | survives |
| kill -9 | dies at 29,861 | dies at 29,861 | dies at 204,683 |
| bunker [1], 28 instructions | survives | dies at 111,498 | dies at 496,418 |
| bunker [2], 25 instructions | survives | survives | dies at 441,244 |
| Dwarfer | dies at 47,894 | dies at 47,894 | survives |
| Dwarfer II | survives | dies at 142,207 | dies at 240,401 |
| tamper | survives | survives | survives |
| Antivamp | dies at 23,966 | dies at 23,966 | dies at 166,286 |
| Body-Snatcher3 | survives | survives | survives |
| Signal 1.1 | survives | survives | survives |

These are observations in our simulator, not cross-checked pMARS results.
Different profiles also have different process limits, and historical designs
can depend on an opponent or old rules. A solo failure is sufficient to reject
an unchanged source from this screen, not to dismiss its underlying idea.

The later bunker surviving the extended 8000-cell run is encouraging evidence
for studying its repair design. Its hardcoded 4000 spacing and B-field checksum
are still wrong assumptions to carry unchanged into a 55,440-cell generator.
The earlier version's failure after the ordinary cycle limit also shows why
survival horizon matters. We have not fault-injected either pair or certified
repair correctness.

Dwarfer ends the 94x solo run with only two processes after peaking at 81.
Survival therefore does not establish that a useful distributed workforce
remains active or that repairs succeeded. Those must be measured separately.

## Small matched battle screen

Only the six originals surviving both 94x solo placements entered this screen,
alongside our plain DAT clear and default Lifeboat controls. Each faced Dwarf,
Seeker, Silk and Vampire for four rounds at each of two seeds: **32 rounds per
entry, 256 total**. Full standard 94x battle settings were used; our entries
were separately limited to 50 instructions. Opponents also passed full-cycle
solo checks. All runs used CPU.

| Entry | Instructions | Points per round | Wins / losses / ties |
|---|---:|---:|---:|
| tamper | 3 | 1.625 | 14 / 8 / 10 |
| Dwarfer | 8 | 1.594 | 13 / 7 / 12 |
| Lifeboat default | 37 | 1.469 | 15 / 15 / 2 |
| Plain DAT clear | 9 | 1.375 | 13 / 14 / 5 |
| Signal 1.1 | 7 | 1.281 | 11 / 13 / 8 |
| Airbag Demo | 21 | 0.875 | 0 / 4 / 28 |
| 4-line Bomb Dodger | 4 | 0.875 | 4 / 12 / 16 |
| Body-Snatcher3 | 2 | 0.781 | 0 / 7 / 25 |

The highest means are interesting leads, not convincing evidence of overall
superiority. There are only eight rounds per matchup, these are previously
used library opponents, and no held-out panel or significance test was used.
No parameter tuning or evolution occurred.

tamper won seven of eight against Dwarf and seven of eight against Vampire,
but lost six of eight to Silk and tied every Seeker round. Dwarfer lost four of
eight to Seeker and tied all Silk rounds. These weaknesses make both useful
diversity candidates rather than obvious replacements for the controls.
Airbag Demo's 28 ties and no wins are consistent with its demonstrator fallback;
they do not measure the value of a complete airbag attack. Body-Snatcher3 also
mostly tied, so borrowed execution deserves a separate survival role rather
than a presumed killing strategy.

## Connection to generator evolution and Red Queen

The new search choices should be mechanisms with explicit contracts:

1. A worker refresher emits its deployment geometry and queue allocation as
   one linked choice; parameter tuning cannot independently scramble them.
2. A disruption opening owns its stream pointer and hands off before invading
   its protected state; vary direction, scope and transition timing together.
3. A repair pair derives mutual offsets and expected checksums, then passes
   fault-injection and process-cleanup checks before any fitness evaluation.
4. Red Queen should retain diverse opponents and champions that expose each
   mechanism's weaknesses. Generalization requires new opponents as well as
   fresh placement seeds. Survival-heavy designs should not be promoted merely
   because they accumulate ties.

The source corpus supplies examples and test ideas. It does not change the
existing Red Queen history, training opponents, ordinary evolver, or executable
generator choices. Special fixed-placement tricks, handshakes, graphics and
deliberate-loss programs are useful context, not default battle candidates.

## Reproduce

```text
node scripts/survey-planar-other.js
node scripts/screen-planar-other.js --out evolved/new-other-screen
```

Both read hash-checked local originals and need the existing Planar cache. The
screen requires a fresh output directory and records every compile/solo result,
skipped entry, fixed opponent, seed and per-matchup outcome. The extended
8000-cell diagnostic is included. The tracked report is
[planar-other-screen.json](planar-other-screen.json); original run output is
`evolved/planar-other-review-20261028/report.json`.
