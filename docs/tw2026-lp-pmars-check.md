# LP tournament reconstruction checked with pMARS

Completed November 17, 2026. **All 1,065 LP entrant matchups have exactly
the same win/loss/tie totals in pMARS and ZoreWars.** Replacing the
measured LP scores with the pMARS results leaves the complete score
matrix, combined-field ranking and entrant ordering unchanged.

This comparison replays the previous reconstruction's placements,
rather than comparing two independently sampled tournaments. It rules
out a difference between these engines' aggregate match results for
this particular field, settings and placement sequence. It does not
identify the organizer's historical inputs.

| Warrior | Published entrant place | pMARS entrant place | Published combined rank | pMARS combined rank |
| --- | ---: | ---: | ---: | ---: |
| Amethystine Python | 1 | 1 | 3 | 3 |
| Escapement | 2 | 10 | 7 | 38 |
| Spindle | 13 | 13 | 66 | 57 |
| Rodents | 14 | 2 | 73 | 4 |
| Hell Kitty pqfc | 15 | 15 | 75 | 65 |

## What ran

- pMARS v0.9.6, dated March 5, 2026, SERVER build.
- Binary SHA-256: `ee0a24dbeb6a4e4a275819d841d7f0a1a2b7cead4bc6db518fd8b68662eaef55`.
- Same 15 original entrants and 64 hill opponents selected after
  removing P-space warriors; source hashes checked before running.
- Same published hill-vs-hill matrix, unchanged.
- All entrant-vs-hill and entrant-vs-entrant pairs: 500 rounds each,
  532,500 rounds in total. Each of Rodents and Escapement faces all
  other 78 warriors, totaling 39,000 rounds per warrior.
- Settings: `-s 8000 -p 8 -c 80000 -l 200 -d 200 -r 500 -b -k`.
  Entrants had already passed the 50-instruction tournament check.
- Exact original pair seeds and first-mover rotation. For matrix
  indices `i < j`, the prior runner used
  `pairSeed = 20261117 + i + 7 * (j - i - 1)`.
  pMARS receives `-F (pairSeed + 200)`, because it subtracts the minimum
  distance from `-F` to initialize its placement generator. Passing the
  seed itself as `-F` would use a different sequence.

The original per-pair stdout, stderr, arguments and results are saved
in the resumable checkpoint. The executable is pinned alongside the
results. The runner checks process status, output format, matching tie
counts and the 500-round total before accepting each result.

[Raw pMARS checkpoint](../evolved/tw2026-pmars-lp/checkpoint.json),
[comparison](../evolved/tw2026-pmars-lp/comparison.json),
[replayable matrix](../evolved/tw2026-pmars-lp/scores.json),
[rankings](../evolved/tw2026-pmars-lp/analysis.json)

## What this explains—and what remains open

The discrepancy survives replacing ZoreWars match results with pMARS
results. The [earlier check](tw2026-prefiltered-reconstruction.md) also
found exact agreement with the organizer's shared Ruby scoring script.
Neither simulator match totals nor that shared scoring implementation
explains the remaining gap on these inputs.

In this reconstruction Rodents initially resembles R.O.U.S. most
closely. R.O.U.S. is pushed off at rank 69 while Rodents survives to
rank 4. The published contest instead pushed Rodents off at rank 73.
The order of removals therefore differs; the fact that two warriors
have similar profiles does not determine which one will be removed.

The remaining variables include the exact historical benchmark
selection and source versions, reference score table, sampled
placements, round count, and final organizer script revision. We have
not isolated which causes the discrepancy. The most decisive next
input would be the organizer's LP `hill32.dat` and `hill32.scores`
containing the tournament entrants. Their names and pair scores would
let us locate the first differing input directly.

## Repeat

The pinned executable is reused by default:

```sh
node scripts/replay-tw2026-pmars-lp.js --threads 10
```

For another executable, pass `--pmars PATH`; use a fresh `--out`
directory if changing the binary or input matrix. `--input PATH`
accepts another compatible saved LP record. Cached pairs are reused
only when the input matrix and executable hashes match.
