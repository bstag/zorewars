# Reconstructed Tournament Weekend 2026 benchmark

For the latest results, see the [rerun with P-space removed before
selection and published hill scores](tw2026-prefiltered-reconstruction.md).
The runs below retain the earlier setup for comparison.

The [scoring audit](tw2026-scoring-audit.md) directly verifies these
matrices against the organizer's shared Ruby script and measures seed,
sample-size and roster differences.

The reconstructed round robins use all 50 published entrants, plus
64 Koenigstuhl opponents each for LP and 94x and 128 each for ’88 and
94nop. The user selected these field sizes. Each division uses its
current published recursive hill ordering, downloaded and frozen on
November 17, 2026. Historical roster identity, original match seed,
round count and starting order are unconfirmed.

The first complete run used 50 rounds per distinct pair and seed
20261117. It contains 25,320 matchups and 1,266,000 rounds across four
fields. All pair results, settings, warrior sources, source hashes and
rankings are saved locally. Hill opponents retain full images and
P-space support. All entrants compile under their own division's
50-instruction tournament profile.
[Run script](../scripts/replay-tw2026.js),
[restore and replay instructions](tournament-weekend-2026-benchmark.md)

## First rerun versus published entrant places

Each rerun place below counts only tournament entrants after the
combined hill/entrant field has undergone the official SD push-off.
These are new measurements.

| Division | Warrior | Published entrant place | Rerun entrant place | Rerun combined-field rank |
| --- | --- | ---: | ---: | ---: |
| LP | Amethystine Python | 1 | 4 | 10 |
| LP | Escapement | 2 | 5 | 15 |
| LP | Spindle | 13 | 12 | 43 |
| 94x | Giant Alien Force | 1 | 1 | 3 |
| 94x | Spyglass | 4 | 6 | 52 |
| 94x | Millwright | 6 | 7 | 54 |
| ’88 | Plasmograph | 1 | 3 | 27 |
| ’88 | Shadow Gauge | 2 | 7 | 77 |
| ’88 | Coil 31 | 3 | 1 | 17 |
| 94nop | Nova | 1 | 1 | 12 |
| 94nop | Burin | 5 | 6 | 35 |
| 94nop | Mallet | 12 | 10 | 96 |

Giant Alien Force, Hex and Slayer remain the first three 94x entrants.
Gemini LP ilcv heads the first LP rerun, and Coil 31 heads ’88.
The changes establish that this 50-round reconstruction does not
reproduce the entire published ordering. A larger round count can
test sampling sensitivity, while confirming historical inputs requires
the original roster and match settings.

The data are saved in
[LP](../evolved/tw2026-reconstruction/lp/analysis-20261117-50.json),
[94x](../evolved/tw2026-reconstruction/94x/analysis-20261117-50.json),
[’88](../evolved/tw2026-reconstruction/88/analysis-20261117-50.json)
and [94nop](../evolved/tw2026-reconstruction/94nop/analysis-20261117-50.json).

## LP check at 500 rounds

The LP field was rerun at 500 rounds per pair on the same frozen roster
and seed, adding 1,540,500 rounds. The complete exercise therefore
contains 2,806,500 simulated rounds. Gemini LP ilcv remains the
highest-ranked entrant, followed by Python and Rodents. Escapement
places ninth among entrants, Spindle thirteenth and Hell Kitty fifteenth.
The larger sample changes the ordering and still differs from the
published result. Historical reconstruction remains unverified. Confirm
the original roster, settings and scoring script before treating these
new rankings as a reproduction of the contest.

| Entry | Initial average, 0–300 | Closest initial profile | Initial SD distance |
| --- | ---: | --- | ---: |
| Amethystine Python | 168.98 | LPKD | 72.74 |
| Escapement | 163.96 | Gemini LP ilcv | 38.74 |
| Rodents | 176.38 | Hell Kitty pqfc | 25.19 |
| Hell Kitty pqfc | 171.32 | Rodents | 25.19 |

R.O.U.S. is second-nearest for both Rodents and Hell Kitty, at distances
27.21 and 30.45. This higher-round result supports studying their common
paper family as a cluster of similar matchup profiles. At Hell Kitty's
73rd-place elimination, Rodents remains its nearest profile. By
Rodents' later 12th-place elimination its nearest profile is Gemini.
This shows how the active field changes the diversity comparison.
[500-round LP analysis](../evolved/tw2026-reconstruction/lp/analysis-20261117-500.json),
[replayable score matrix](../evolved/tw2026-reconstruction/lp/scores-20261117-500.json)

## Comparing diversity on a common field

These 50-round values use the complete initial field of each division. Average
points are shown on a 0–300 scale. SD distances use the same columns
and standard deviations for every entrant within that division.

| Division | Entry | Initial average | Closest profile | Initial SD distance |
| --- | --- | ---: | --- | ---: |
| LP | Amethystine Python | 163.23 | LPKD | 69.54 |
| LP | Rodents | 173.87 | R.O.U.S. | 42.86 |
| LP | Hell Kitty pqfc | 171.90 | R.O.U.S. | 41.77 |
| 94x | Giant Alien Force | 157.30 | xd100 test | 46.45 |
| ’88 | Plasmograph | 147.90 | Monolith | 118.31 |
| ’88 | Shadow Gauge | 109.84 | Snake7 | 123.73 |
| ’88 | Coil 31 | 95.18 | Efoil | 154.47 |
| 94nop | Nova | 132.37 | Bloodthirst | 205.01 |
| 94nop | Burin | 95.90 | Bloodthirst | 182.19 |

Rodents and Hell Kitty both have R.O.U.S. as their nearest neighbor
on this reconstructed starting field. That is consistent with the
organizer's explanation of their similar bombing-paper matchup
profiles. Python's higher distance accompanies a lower initial
average than either paper. Coil 31 also has a lower average and a
larger initial distance than Plasmograph and Shadow Gauge.
These observations concern this run. Each subsequent elimination
changes the field and can change the nearest neighbor.

Saved analysis also records each entrant's nearest profiles at its
elimination step. Compare those with its initial profiles to see how
removing competitors changes its diversity. The source reviews explain
the mechanisms behind candidate differences.
[Warrior source review](tournament-weekend-2026-warrior-review.md)

## Verification and provenance

The score files load through the existing push-off replay command.
One LP Python/R.O.U.S. matchup was independently repeated with the
JavaScript engine using the same placement seed and 50 rounds. Its
25 wins and 16 ties matched the native run.

The 94nop archive's Herbal Avenger file ends with a NUL byte followed
by a newline. The runner preserves its source bytes and hash and
removes trailing whitespace/NUL padding only for assembly. Entry
sources are checked against the previously downloaded manifest hashes.

The original tournament matrix remains a primary source for validating
historical results. The reconstructed matrices supply new controlled
measurements for comparing strategies and testing refinements.
