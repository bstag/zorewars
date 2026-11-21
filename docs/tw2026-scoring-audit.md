# Tournament Weekend 2026 scoring audit

The subsequent [run with P-space removed before selection and published
hill scores](tw2026-prefiltered-reconstruction.md) is complete. It adds
four more matrices checked against the unchanged Ruby script, with all
ranks and printed numeric values agreeing. Remaining placement
differences therefore persist even with that preprocessing and those
reference scores.

The JavaScript scorer matches the organizer's October 28 Ruby script
on all seven saved reconstruction matrices, including every rank and
every printed product, SD distance and average to three decimal places.
The matrices represent 671 ranked warrior rows. The reconstruction
differs from the published tournament results even when the original
Ruby script ranks it, so those differences cannot be explained by a
different implementation of that shared scoring rule.

This verifies the October 28 revision. Its accompanying message said
the script was subject to change. The final tournament revision,
original matchup matrix, round count and placement settings are still
unconfirmed.
[Captured comparison](../evolved/tw2026-scoring-audit/comparison.json)

## Original script and direct comparison

The original file was recovered from the user's October 28 attachment,
`b566d651-sdscore.rb`. A byte-for-byte copy is stored in the local
download archive. Its SHA-256 is
`01376831158b07ddc6caf65b715cbe928fab0772d66ca7640bfc7f0ce783eff2`.
Ruby was installed in WSL to execute the original code.
[Local copy](../imported/tournament-weekend-2026/scoring/sdscore-20261028.rb)

The audit exports each saved matrix to the Ruby script's expected
`hill32.dat` and signed 32-bit little-endian `hill32.scores` files.
The binary matrix is transposed on export because the script transposes
it on read. Scores are scaled from 0–3 points per round into the
script's 0–300 display scale. The Ruby script itself is unchanged.

Both implementations recalculate column standard deviations over
the remaining field, include the zero diagonal, sum normalized
absolute differences, choose each warrior's nearest neighbor, and
remove the lowest average-times-distance product.

| Matrix | Warriors | Rank differences | Printed-value differences |
| --- | ---: | ---: | ---: |
| LP, seed 20261117, 50 rounds | 79 | 0 | 0 |
| LP, seed 20261117, 500 rounds | 79 | 0 | 0 |
| LP, seed 20261118, 50 rounds | 79 | 0 | 0 |
| LP, seed 20261119, 50 rounds | 79 | 0 | 0 |
| 94x, seed 20261117, 50 rounds | 75 | 0 | 0 |
| ’88, seed 20261117, 50 rounds | 138 | 0 | 0 |
| 94nop, seed 20261117, 50 rounds | 142 | 0 | 0 |

The audit can be repeated from the repository root.

```sh
node scripts/audit-tw2026-scoring.js prepare
wsl -d Ubuntu -- ruby /mnt/e/Source/ZoreWars/evolved/tw2026-scoring-audit/run.rb
node scripts/audit-tw2026-scoring.js report
```

The report command exits unsuccessfully if any rank or rounded numeric
value differs. Each case retains its binary input, original script,
Ruby output and pre-fix JavaScript order.
[Audit script](../scripts/audit-tw2026-scoring.js)

## A real tie-breaking defect

Ruby's `min_by` compares the full tuple
`[product, distance, average, -index]`. JavaScript previously compared
only the product before removing the later-listed warrior. A
four-warrior case with two identical profiles and a separate zero-score
warrior demonstrates the difference. The previous implementation
ranked A, D, B, C. Ruby ranks A, D, C, B.

The regression failed before the fix and passes afterward. The scorer
now compares product, then distance, then average, then reverse file
order. All seven real saved rankings remain unchanged by the fix.
The focused scorer/replay/cache suite passes 22 tests.
[Regression](../test/sdscore.test.js),
[implementation](../src/engine/pushoff.js)

One intentional robustness difference remains. JavaScript skips
zero-spread columns, which otherwise produce 0/0. The shared Ruby
revision crashes on a degenerate zero-spread example. All seven
real matrices complete successfully in Ruby and have matching output.

## Seed sensitivity on the same LP roster

These are entrant-only places after push-off against the same 64 hill
opponents. The only changed input between these three new 50-round
runs is the match seed.

| Seed | Python | Escapement | Rodents | Hell Kitty |
| ---: | ---: | ---: | ---: | ---: |
| 20261117 | 4 | 5 | 2 | 13 |
| 20261118 | 3 | 1 | 9 | 8 |
| 20261119 | 1 | 3 | 2 | 9 |

Seed changes can therefore move an entry several places and change the
leading entrant on this field. These three samples establish
sensitivity, with no confidence interval for the true ranking.
[Saved seed comparison](../evolved/tw2026-scoring-audit/seeds.json)

The 500-round run also permits changing sample sizes for only part of
the score matrix. This uses existing results, with the same roster
and seed. Every mixture is re-scored by the same algorithm.

| Entrant-involving matchups | Hill-vs-hill matchups | Python | Escapement | Rodents | Hell Kitty |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 50 rounds | 50 rounds | 4 | 5 | 2 | 13 |
| 500 rounds | 50 rounds | 1 | 11 | 12 | 15 |
| 50 rounds | 500 rounds | 2 | 4 | 5 | 14 |
| 500 rounds | 500 rounds | 2 | 9 | 3 | 15 |

Results among the reference hill warriors affect the standard
deviations, nearest neighbors and elimination sequence. Reusing an
existing hill score table while refighting entrant matchups can
therefore produce different ranks from refighting the entire field.
Whether the organizer used that workflow remains unknown.
[Saved sample-size comparison](../evolved/tw2026-scoring-audit/round-sensitivity.json)

## Roster comparison against the pre-contest snapshot

The November 9 local archives provide a second frozen roster to check.
The ’88 top 128, LP top 64 and X top 64 have identical membership and
order to the reconstruction. All compiled instructions also match.
Two LP source files differ in bytes while compiling identically.

The current 94nop top 128 has eight different members relative to the
November 9 top 128. The newcomers are Spawn of Azathoth, Talisman'94,
Riptide, Pendulum (decoy), Eye of the Storm '94, Void Runner, Recon 2
and Rust. Its ordering also changed. This is a known input difference
between snapshots, while the tournament's chosen snapshot remains
unconfirmed.
[Roster audit](../evolved/tw2026-scoring-audit/rosters.json)

The roster and partial-matrix checks are reproducible with the
pre-contest archive directory supplied as an argument.

```sh
node scripts/audit-tw2026-scoring.js inputs E:/Source/ZoreWars-private/hills
```

## What is established

The shared scoring algorithm is directly verified, and its tie-breaking
edge case is fixed. Seeds and sample sizes measurably affect these
rankings. The 94nop roster also differs from our pre-contest archive.

Exact historical reproduction needs the organizer's final script and
either the original score matrix or the precise roster, round counts,
placement sequence and ordering used to generate it. The current
evidence supports sampling and input differences as explanations,
without proving that seed choice alone accounts for every published
placement.

## Published Koenigstuhl inputs and P-space filtering

The subsequently supplied primary sources specify the binary format
and a preprocessing step that removes every warrior tagged `P-Space`
from the metadata and both axes of the score matrix. The supplied
94nop metadata contains all 1,113 warriors in archive order. That
order supplies matrix indices, while the recursive ranking supplies
the benchmark selection order.
[File format](https://corewar.co.uk/metcalf/koenformat.txt),
[filter script](https://corewar.co.uk/metcalf/removepspace.rb),
[94nop metadata](https://asdflkj.net/COREWAR/94/hill32.dat)

All four metadata/score pairs were downloaded locally. Importing and
exporting preserves every binary score byte. Running the published
`removepspace.rb` on copies and filtering with JavaScript produces
identical metadata and score bytes.

| Archive | Warriors | After P-space removal |
| --- | ---: | ---: |
| ’88 | 683 | 683 |
| 94nop | 1,113 | 1,113 |
| LP | 150 | 131 |
| X | 214 | 177 |

The earlier reconstructed top-64 fields include 10 tagged P-space
LP opponents and 22 tagged P-space X opponents. If the contest used
the published removal step, its field selection therefore differs
from that reconstruction. The point at which the top-N cutoff was
applied still needs confirmation.

As a controlled sensitivity check, removing those already-selected
warriors from our saved matrices changes LP from 79 to 69 total
warriors and X from 75 to 53. On the 50-round records, Escapement's
entrant place moves from fifth to second, and Spyglass from sixth
to third. This check adds no replacement opponents, so it tests the
effect of removal while leaving all retained match results fixed.
It does not reconstruct a fresh top-64 field chosen after filtering.

Using the published hill-vs-hill scores instead of our refought
hill-vs-hill scores also changes places with retained entrant scores
held fixed. Those are now available inputs for a closer reconstruction.
The previous conclusion that seed and sampling affect results still
holds, with filtering and reference-score provenance established as
additional setup variables.
[Binary round-trip evidence](../evolved/tw2026-scoring-audit/koenigstuhl-files/round-trip.json),
[filter parity](../evolved/tw2026-scoring-audit/koenigstuhl-files/filter-parity.json),
[input sensitivity](../evolved/tw2026-scoring-audit/koenigstuhl-files/input-sensitivity.json)
