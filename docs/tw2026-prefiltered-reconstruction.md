# Tournament reconstruction using published hill scores

The subsequent [LP pMARS check](tw2026-lp-pmars-check.md) independently
replayed all 1,065 entrant matchups. Every win/loss/tie total agrees
exactly, leaving the rankings below unchanged.

Completed November 17, 2026. This run removes P-space warriors before
selecting the hill opponents, fills the resulting gaps, and uses the
published Koenigstuhl hill-vs-hill scores. It is closer to the published
entrant ordering overall, but does not reproduce the tournament exactly.

## Inputs and procedure

- Use the frozen November 17 recursive hill ranking and corresponding
  `hill32.dat` / `hill32.scores` files.
- Exclude every warrior tagged `P-Space` before taking the first 64
  eligible LP/X warriors. Retain the user's earlier selection of 128
  opponents for ’88 and 94nop. Filtering retains published rank order;
  it does not recompute the recursive hill.
- LP selection reaches original hill rank 78; X reaches rank 88.
  The fields contain 79, 75, 138 and 142 warriors respectively,
  including all 50 published tournament entrants across the divisions.
- Preserve published scores between selected hill warriors, matching
  metadata by filename rather than treating archive order as rank order.
- Fight entrant-vs-hill and entrant-vs-entrant pairs at 500 rounds each,
  seed 20261117, with P-space disabled. Entrants retain the 50-instruction
  limit; hill opponents retain their original images.
- Apply the organizer's shared SD-score push-off algorithm.

There are 5,032 newly measured pairs, totaling 2,516,000 rounds. Another
20,288 hill-vs-hill pairs use the published reference scores. Source and
reference hashes, settings, measured counts and complete mixed score
matrices are saved. Published normalized scores have no supplied
win/loss/tie counts, so those counts are not fabricated.

[Repeatable commands](tournament-weekend-2026-benchmark.md#published-reference-scores-with-p-space-removed-first),
[complete comparison](../evolved/tw2026-prefiltered/comparison.json)

## How close are the entrant places?

“Average difference” is the mean absolute difference between each
entrant's reconstructed place among tournament entrants and its
published place. It is not the difference in combined-field ranks.

| Division | Earlier average difference | New average difference | Exact entrant places | New average combined-rank difference |
| --- | ---: | ---: | ---: | ---: |
| LP | 3.87 | 3.60 | 3 / 15 | 17.53 |
| 94x | 0.73 | 0.73 | 4 / 11 | 2.91 |
| ’88 | 2.20 | 0.60 | 4 / 10 | 14.70 |
| 94nop | 2.00 | 1.86 | 4 / 14 | 12.21 |
| All entrants | 2.32 | 1.88 | 15 / 50 | — |

The earlier LP comparison used 500 rounds; the other earlier divisions
used 50. Several inputs changed together. These numbers compare the
complete setups and do not isolate a causal effect of filtering or of
published scores alone. ’88 and 94nop have no tagged P-space warriors,
so their changes arise from reference scores and new match samples.

## Our eight entries

| Division | Warrior | Published entrant place | New entrant place | Published combined rank | New combined rank |
| --- | --- | ---: | ---: | ---: | ---: |
| LP | Escapement | 2 | 10 | 7 | 38 |
| LP | Spindle | 13 | 13 | 66 | 57 |
| 94x | Spyglass | 4 | 4 | 20 | 18 |
| 94x | Millwright | 6 | 5 | 38 | 27 |
| ’88 | Shadow Gauge | 2 | 3 | 10 | 25 |
| ’88 | Coil 31 | 3 | 2 | 20 | 20 |
| 94nop | Burin | 5 | 2 | 22 | 22 |
| 94nop | Mallet | 12 | 11 | 75 | 82 |

Burin illustrates why the two ranks matter: it matches its published
combined-field rank of 22 while placing second among entrants rather
than fifth, because other entrants have moved around it.

Amethystine Python, Plasmograph and Nova match their published first
places among entrants. Python also matches its combined-field rank of
3. In X, Hex and Slayer precede Giant Alien Force; the published winner
places third in this rerun.

LP remains the main discrepancy. Rodents places second among entrants
and fourth overall, versus the published fourteenth and 73rd. Hell
Kitty remains last among entrants. Initially, Rodents' closest matchup
profile is R.O.U.S., but R.O.U.S. is eliminated at rank 69 and Rodents
survives. Similarity alone does not ensure that the same member of the
cluster is pushed off. This run therefore still fails to reproduce the
organizer's reported Rodents outcome.

## Verification and remaining uncertainty

The comparison script verifies every retained reference cell against
the published table, every measured score against its saved counts,
the complete field sizes, P-space exclusion, and score-only replay.
All four matrices were exported to the native binary format and run
through the unchanged shared Ruby scorer. Every warrior's rank agrees;
all printed scores, diversity distances and averages agree to its
three-decimal output precision. The 24 targeted score import/export,
cache and scorer tests also pass.

[Ruby fixtures and outputs](../evolved/tw2026-prefiltered/ruby-check/),
[comparison/verification script](../scripts/compare-tw2026-prefiltered.js)

This establishes agreement with the shared October 28 scoring script on
these inputs. It does not establish the organizer's exact final inputs
or prove that all remaining differences are seed effects. The contest's
precise historical reference table, selection procedure, placement
sequence, round count and final script revision remain unconfirmed.
The earlier audit also found eight differences in the 94nop top-128
membership between the November 9 and November 17 snapshots. Matchups
here use ZoreWars' native engine rather than a fresh pMARS run.

[Earlier scoring and input audit](tw2026-scoring-audit.md)
