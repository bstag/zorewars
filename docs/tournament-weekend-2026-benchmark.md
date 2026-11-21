# Tournament Weekend 2026 benchmark

The published 2026 field is saved locally in
`imported/tournament-weekend-2026/`. Sources retain the downloaded bytes.
The manifest records the source URL, tournament place, author, SHA-256,
download time and compilation result for each warrior. The snapshot
contains 15 LP, 11 94x, 10 ’88 and 14 94nop warriors. All 50 compile
under their division's tournament preset with a 50-instruction limit.
[Published results and sources](https://corewar.co.uk/tournamentweekend2026.htm)

The downloaded sources live in the Git-ignored `imported/` directory.
Restore them on another checkout with the tracked downloader.

```sh
node scripts/download-tw2026.js
```

To preserve an existing snapshot while fetching again, provide a new
destination directory as the script's first argument.

Each division is a folder accepted by `hill`, `pushoff`, `tune`,
`refine` and `evolve`. Use the matching rules preset and the entry
length limit. These examples benchmark a new ’88 entry.

```sh
node cli/zorewars.js hill mine.red --hill imported/tournament-weekend-2026/88 --rules 88 --length 50 --rounds 100 --seed 1 --json
node cli/zorewars.js pushoff mine.red --hill imported/tournament-weekend-2026/88 --rules 88 --length 50 --top 100 --rounds 100 --seed 1 --save evolved/tw2027-88-scores.json --json
```

| Division | Folder | Rules |
| --- | --- | --- |
| Limited process | `imported/tournament-weekend-2026/lp` | `lp` |
| ’88 | `imported/tournament-weekend-2026/88` | `88` |
| 94nop | `imported/tournament-weekend-2026/94nop` | `94nop` |
| 94x | `imported/tournament-weekend-2026/94x` | `94x` |

This snapshot contains the tournament entrants. For the top-100
development study, also benchmark against a saved Koenigstuhl roster.
Keep the matchup matrix and seeds for each run so candidate comparisons
can use the same field and the rankings can be replayed.

## Reconstructing the contest benchmark

`scripts/replay-tw2026.js` adds the published entrants to a frozen
Koenigstuhl roster, plays every distinct pair and saves both directions
of the matchup matrix. The selected reconstruction uses 64 hill
opponents for LP and 94x and 128 for ’88 and 94nop. The ’88 and 94nop
counts were selected by the user, consistent with reported ranks of
119 and 122. The exact historical rosters and original placement seeds
remain unconfirmed.

```sh
node scripts/replay-tw2026.js --divisions lp,94x,88,94nop --rounds 50 --seed 20261117 --threads 8
```

The default output is `evolved/tw2026-reconstruction/<division>/`.
Each division keeps the downloaded ranking page, original warrior
sources, roster hashes, match settings, a resumable completed-row
checkpoint, the replayable score record and an analysis file. The
analysis reports entrant ordering, initial full-field average points
and the three nearest SD neighbors. The official iterative push-off
is computed from the complete matrix.

Rerunning the same command resumes completed rows and reuses the frozen
roster. Change `--seed` or `--rounds` for another run on that roster.
Use a new `--out` directory to fetch another roster. Hill opponents
retain their full images and P-space support, while entrants are checked
with the tournament's 50-instruction limit and no P-space.

## Published reference scores, with P-space removed first

The following mode removes warriors tagged `P-Space` from the recursive
ranking before taking its first N opponents. It fills the cutoff with
the next eligible warriors, retains the corresponding published
hill-vs-hill scores, and fights only entrant-vs-entrant and entrant-vs-hill
matches. It uses 64 hill opponents for LP/X and the previously selected
128 for ’88/94nop. Removing warriors does not recalculate the recursive
hill ordering; selection follows the frozen published ranking.

```sh
node scripts/replay-tw2026.js --published-hill imported/koenigstuhl-scores-20261117 --divisions lp,94x,88,94nop --rounds 500 --seed 20261117 --threads 10
node scripts/compare-tw2026-prefiltered.js
```

The default output is `evolved/tw2026-prefiltered/<division>/`. The
reference folder contains `88`, `94`, `LP` and `X` directories, each
with the matching `hill32.dat` and `hill32.scores` files. Metadata and
score hashes are recorded in the roster. Source hashes and reference
hashes are checked when resuming. P-space is disabled during matches.

Published scores are normalized points without round counts. Saved
records therefore retain measured win/loss/tie counts under
`measuredResults`, with reference provenance under `referenceScores`.
They do not invent counts for the published hill cells. Score-based
replay uses the complete `scores` matrix normally.

The comparison script checks every reference score against the source
table, every measured pair against its counts, field sizes, P-space
exclusion, and replayed ranking. Its `comparison.json` reports every
entrant's official and reconstructed place. The older comparison uses
500 rounds for LP and 50 for the other divisions, so it measures the
whole setup change rather than isolating filtering alone.
