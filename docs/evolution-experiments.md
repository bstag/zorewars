# Evolution capability experiment

Worktree branch: `evolution-capabilities`, based on `ca3fa2b`.

This stage adds optional epsilon-lexicase selection, CVT outcome niches, and
numeric refinement using the existing mutation operators. Standalone
generator parameter tuning and the architecture-specific '88 grids remain
available. Search and finalist validation now share objective scoring,
including push-off placement and partner weighting.

## Reproduce

```sh
node scripts/compare-evolution.js --threads 4
```

The completed local report is
[`comparison.json`](../evolved/algorithm-comparison/comparison.json); each
run directory contains `best.red` and `evolve.json`. Generated files are
ignored by Git. The script preserves the compiled training and held-out
inputs in its report.

All 18 runs used the real ICWS'88 settings: 8000 cells, 8000 processes,
80000 cycles, no P-space, and at most 50 instructions. The six variants used
evolution seeds 4242, 4243 and 4244, two generations, two batches of 12
offspring per generation, four screening rounds per opponent, a 16-member GA
population or 16-cell outcome archive. Species MAP-Elites retains its normal
species bins. Sources and the eight library opponents were identical.

Finalists were compared with the starting baseline using three fresh
placement seeds and 20 rounds per opponent. Five experimental warriors
(Afterimage, Levy, Riptide, Telltale, Undercurrent) were then checked on three
separate placement seeds, 20 rounds each. Those results never selected a
finalist. Every recommendation was assembled under the entry rules and
survived a full solo run.

## Results

Scores below average the recommended version across the three evolution
seeds, including retained baselines. Points use win/tie/loss = 3/1/0.
"Promotions" means the candidate cleared the paired validation noise margin;
it can be another initial source, rather than newly evolved code.

| Variant | Fresh-placement points | Held-out points | Promotions | Search battle rounds |
| --- | ---: | ---: | ---: | ---: |
| GA, tournament selection | 1.974 | 2.047 | 2/3 | 6664 |
| GA, epsilon-lexicase | 1.960 | 1.802 | 1/3 | 6940 |
| Species MAP-Elites | 1.882 | 2.081 | 1/3 | 6652 |
| Outcome CVT-MAP-Elites | 1.868 | 1.738 | 1/3 | 6208 |
| Outcomes + epsilon-lexicase | 1.868 | 1.738 | 1/3 | 5924 |
| Outcomes + epsilon-lexicase + local refinement | 1.868 | 1.738 | 1/3 | 6888 |

The matched starting baselines averaged 1.803 library points and 2.007
held-out points. There were 39276 search battle rounds in total, plus final
validation and held-out checks. These runs match offspring schedules, not
compute budgets: archive refreshes, rejected programs, caching, and local
refinement change actual costs. Elapsed times include concurrent regression
checks and should not be treated as CPU benchmarks.

The GA promoted new clear grafts of 39 and 15 instructions. Lexicase GA
promoted a new 27-instruction paper graft; species MAP-Elites promoted an
8-instruction numeric mutation. Outcome variants recommended the initial
Imp Ring '88 on seed 4242 and retained the baseline on the other seeds.
Local refinement tried 34 numerical changes and found three improvements
within search, without changing the final recommendation.

The additions work, but this small campaign does not establish a strength
advantage. Defaults remain unchanged. The held-out reversals show why library
score alone is insufficient. Larger experiments should use a representative
hill, more independent evolution seeds, and matched evaluation budgets before
choosing a default. The five experimental opponents are a diagnostic panel,
not an unseen public hill.

## Regression checks

- Full suite: 125 passed, one skipped because Python was unavailable.
- Expanded selection/training checks: 16 passed, including repeatability
  across one/two workers, specialist retention, bounded outcome niches,
  refinement, strict '88/LP/X/torus exports, and CLI report/file generation.
- Six direct comparisons with the original checkout reproduced default GA
  and MAP-Elites champions, archive contents, lineage, and operator credits
  under points, smooth, and push-off objectives.
- A controlled push-off regression promotes a lower-point specialist when
  candidate/partner placement improves; a smooth-score regression chooses a
  different finalist from points. Fresh field matrices are shared within a
  validation seed and rebuilt between seeds.
- A combined CLI push-off/partner/outcomes/lexicase/refinement smoke run
  completed with a 2000-cycle limit and exported a legal recommendation. Its
  abbreviated settings check integration only; it is separate from the
  full-cycle strength comparison above.

## Integration with GPU-enabled main

The capabilities were integrated with main at `5b641c8`, retaining the CPU
default, explicit GPU mode, automatic CPU fallback, accelerated solo checks,
and batching of independent births. The execution counters preserve live
backend getters so a fallback during evolution remains visible to scheduling.

Existing search defaults are unchanged: ordinary GA/MAP-Elites selection,
species niches, and zero local refinement steps. Step/parameter tuning remains
available. The intentional validation correction is that finalist promotion
uses the selected objective, including push-off and partner placement.

The combined version passed 154 standard tests (seven optional checks skipped)
and all 23 explicitly enabled native GPU checks. Native parity tests include
lexicase, outcome archives and numeric refinement under smooth and push-off
objectives. Hardware-independent regressions also cover concurrent birth
scheduling and a GPU-to-CPU fallback during solo measurement. Six comparisons
against pre-merge main reproduced default champions, archives, lineage and
operator credits for GA/MAP-Elites with points, smooth and push-off scoring.
