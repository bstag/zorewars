# Examples from a seeded genetic search

These are generated candidates from the 2026-10-26 training campaign, kept
outside the benchmark library so that a run does not change its own opponents.
They are examples of producing and checking versions, not external hill
champions. Genotype IDs identify their executable instructions and entry point;
names, comments and assertions do not affect those IDs.

| File | Rules | Instructions | Mutation that produced it |
| --- | --- | --- | --- |
| [ga-88-4ab78c7a.red](ga-88-4ab78c7a.red) | ICWS'88, 8000-cell ring | 17 | Graft a stone onto an imp strategy |
| [ga-volume-cube-16dc14c7.red](ga-volume-cube-16dc14c7.red) | 20×20×20 torus | 10 | Add a process launch to a clear |

The complete campaign used the normal cycle/process limits and the full
legal instruction limit of each profile:

```sh
node cli/zorewars.js train --profiles all --generations 2 --batches 3 --batch 12 --eval-rounds 4 --check-rounds 20 --seeds 3 --finalists 3 --threads 4 --seed 4242 --out evolved/verified-4242
```

All 11 profiles completed, 63 generated Redcode files passed compilation under
their entry rules, and every recommendation matched its saved genome. The two
candidates above exceeded the validation noise margin. The other nine
profiles retained their starting baselines. Search evaluated 1074 distinct
candidate/generation combinations; repeated genomes within a generation were
cached.

Each candidate was then compared with its screening-selected starting baseline
on **five additional placement seeds**, with **50 rounds per opponent and seed**:

| Candidate | Baseline | Candidate points/round | Baseline points/round | Paired gain ± noise margin |
| --- | --- | --- | --- | --- |
| Genetic '88 | Stunner '88 | 1.872 | 1.599 | +0.273 ± 0.136 |
| Genetic cube | Fast Silk | 2.457 | 2.132 | +0.325 ± 0.016 |

The audit seeds were 100097532, 100107532, 100117532, 100127532 and 100137532.
Both gains exceeded the same 2.5-standard-error screening guard used by
training. These are comparisons with the baselines selected during search,
not claims to beat every existing warrior. An extra check against all eight
original '88 library programs put the '88 candidate statistically level with
the highest scoring original, Mice (1.875 points/round).

Try them on another seed:

```sh
node cli/zorewars.js hill examples/trained/ga-88-4ab78c7a.red --rules 88 --rounds 50 --seed 123456 --json
node cli/zorewars.js hill examples/trained/ga-volume-cube-16dc14c7.red --torus 20x20x20 --rounds 50 --seed 123456 --json
```

Local full reports are under `evolved/verified-4242/`: `training.json`,
`verification.json`, each profile's `evolve.json`, and `audit.json` for these
two candidates. Generated reports are ignored by Git. Replaying the campaign
requires the same engine and library; changing opponents or settings changes
the comparison. See [the training guide](../../docs/warrior-training.md) for
the algorithms, profiles, lineage records and validation limits.
