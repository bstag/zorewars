# Molting 94x: build and experiment journal

## Scope — 2026-10-27

Build an optional experimental generator on `codex/molting-94x`, based on
main `347a931`. Keep existing evolution, parameter tuning, library membership
and defaults unchanged. Save design rationale, reproducible experiments,
failures and results here. This is an engineering journal, not a claim of
historical novelty or competitive strength.

## Design hypothesis

A warrior can spend a bounded opening bombing or probing for nonzero fields,
then abandon its original location and run a different attack. A remote marker
may trigger an earlier move when it changes; a timer guarantees eventual
transition. The final attack is a forward or backward SPL pass followed by
repeated DAT passes. No between-round memory is needed.

The structural choices are OPENING (bomber/scanner), TRIGGER (timer/marker with
timer fallback), and BACKWARD (clear direction). WAIT, STEP, HOP and SENSOR
are numerical parameters. The existing `const P` / `SPACE` tuner can search
both kinds; no new tuning algorithm is required. Label expressions calculate
copy boundaries and relative addresses after each structural choice.

The opening protects the first 2048 cells, including its own code and marker.
This trades some attack coverage for a simple checkable self-safety invariant.
The destination is outside that region and far enough from the end of core to
fit the complete payload. The opening may bomb the future destination; the
subsequent copy replaces it. Only the payload moves, not the opening state.
One process runs the payload. Each clear pass excludes its own whole body,
and the DAT pass restarts before wrapping into that body.

## Planned checks

- Compile all eight structural combinations under 94x and a 50-instruction cap.
- Observe the timer transition, exact payload copy and execution at the new
  location; disturb the marker and verify earlier transition.
- Verify complete solo survival at 500000 cycles, including repeated clear
  passes, extreme parameters and deterministic sampled settings.
- Test existing parameter tuning, save sampled constants and fresh-seed
  validation results, and retain the original unless a gain clears the margin.
- Seed existing evolution with Molting variants; validate finalists and check
  exported code alone. Compiled-code mutation may destroy the Molting design:
  evolution descendants are not automatically structure-preserving.
- Keep held-out opponents separate from selection. Report actual limits,
  opponent identities, seeds and computational scope. No public-hill claims
  from a local-library experiment.

## E0 — build checks and corrections

The generator emits 27 instructions for timer/bomber, 28 for timer/scanner,
30 for marker/bomber, and 31 for marker/scanner. Both clear directions have
the same length. The default is marker/bomber/backward, with WAIT=128,
STEP=997, HOP=19000 and SENSOR=911.

Two construction mistakes were corrected before benchmarking:

- The existing generator's EQU helper does not separate names of ten or more
  characters from `EQU`. Used short `psize` and `pend` names locally; no shared
  generator code was changed.
- The destination expression must include the original zero label (`probe`).
  `HOP+psize-dst` alone lands two cells late. `probe+HOP+psize-dst` lands
  exactly at the requested offset.

Tests check exact copied instructions before their first execution, normal
and wrapping load positions, actual execution of the relocated DAT phase,
preserved static payload after repeated passes, timer fallback, and earlier
response to marker damage. All eight structures and 48 boundary/random
parameter sets survived full 500000-cycle solo runs. The default additionally
completed five CLI solo rounds without a death. These establish solo safety
under the tested settings, not immunity to enemy-induced self-hits.

## E1 — parameter tuning and compiled evolution, seed 4242

```sh
node scripts/experiment-molting.js --out evolved/molting-94x-4242 --backend cpu
```

The run used real 94x core/process/cycle limits, no P-space, and a 50-instruction
entry cap. Opponents retained the standard 200-instruction allowance. Four CPU
workers completed 10932 battle rounds in 1645 match jobs in about 200 seconds,
excluding setup solo audits. Solo checks are additional. No GPU performance
claim is made from this run.

Training: Dwarf, Scout, Silk, Vampire, Two-Pass Clear, Stunner, Quickscan and
Fast Silk. Held out: Seeker, One-Shot, Mice, Gatekeeper, Papercut and Hydra.
Every selected opponent passed a full solo check. The library's Imp Ring
failed on 94x and was excluded. These are local-library opponents compiled
for 94x, not the public X hill.

### Tuning

The existing tuner screened the default plus 12 seeded random parameter sets
at four rounds per opponent. It checked three finalists and the default on
seeds 1001, 2001 and 3001, at 12 rounds per opponent. Its smooth objective and
paired noise guard are unchanged.

**No finalist cleared the noise margin.** Default constants were retained;
`tuned.js` is intentionally identical to the original. All sampled parameter
sets compiled and survived solo checks. Only the standalone runner seeds the
tuner's synchronous sampling; normal CLI tuning remains unchanged.

### Evolution

Both searches started with the same eight structural variants plus the tuned
recommendation. No library genes were added. Each used two generations, two
batches of 12 offspring per generation, and four screening rounds.

- Standard: existing MAP-Elites defaults, species descriptors.
- Specialist: lexicase selection, outcome descriptors, 16 archive cells,
  localSteps=1. No numeric refinement trial was triggered in this particular
  run (localTried=0); it does not establish a refinement benefit.

Finalists played 12 rounds per opponent on three fresh seeds: 100004243,
100014243 and 100024243. Selection used points. Both runs promoted candidates
over the strongest screened starting seed: 1.531 points/round for standard
and 1.559 for specialist, versus a 0.774 baseline on those placements.

**Both descendants lost the Molting mechanism.** Standard exported 16
instructions combining clear fragments, with a peak of four processes;
specialist added another SPL for 17 instructions and a peak of eight. Neither
retains the marker, opening or payload relocation. Both survive solo, but are
evolved fragment experiments, not successful Molting designs. Both end in a
`procs` mutation; full ancestry is in each run's `evolve.json`.

### Independent comparison and controls

After recommendations were fixed, all entries played seeds 900001, 910001 and
920001 at 12 rounds per opponent. Held-out results did not select or modify
candidates. Scores are points per round (win 3, tie 1).

| Entry | Length | Training panel, fresh placements | Held-out panel |
| --- | ---: | ---: | ---: |
| Original Molting | 30 | 0.747 | 0.940 |
| Tuner recommendation (same original) | 30 | 0.747 | 0.940 |
| Standard evolution fragments | 16 | 1.434 | 0.398 |
| Specialist evolution fragments | 17 | 1.444 | 0.426 |
| Skip opening; relocate immediately | 30 | 0.778 | 1.023 |
| Run the clear in place | 30 | 0.885 | 1.037 |

Controls retain the original complete body and change only its entry point to
`molt` or `payload`, holding loaded footprint constant. They are not
size-optimized standalone clears.

The controls scored higher on these samples. This version has **not shown a
benefit from the opening or relocation**. The evolved fragments show a large
generalization failure despite fresh-placement validation on training
opponents. One search seed and a small panel cannot rank evolution algorithms.

Tracked evidence: [results JSON](molting-94x-results.json). Complete local
output is in `evolved/molting-94x-4242/`: `report.json`, parameterized
structures, controls and evolution archives. Bulk output is ignored by Git;
the runner and compact record are tracked.

## E2 — loss diagnosis

```sh
node cli/zorewars.js battle examples/experimental-94x/molting.js @fastsilk.js --rules 94x --length 50 --rounds 8 --seed 4242 --report --json
```

Result: 2 wins, 4 losses, 2 ties. Round 1 ended at cycle 356798 when Fast Silk
overwrote the relocated DAT-loop instruction at address 19006. Two losses
ended on Molting's own DAT code; that attribution describes the killing cell,
not necessarily the earlier cause of bad control flow. Round 7 tied after all
10000 of Molting's surviving processes became Fast Silk processes. A tie is
therefore not proof the intended clear survived. See
[diagnosis JSON](molting-94x-diagnosis.json).

## Next experiments, not implemented

1. Evolve parameter/structural choices and regenerate labeled code after each
   mutation. Require an observed opening-to-payload transition before admitting
   candidates to a Molting archive. Keep unrestricted compiled search separate.
2. Compare a short stun burst or direct DAT payload with the full-core SPL pass,
   which needs roughly 111000 single-process turns before killing starts. Use
   a new untouched panel: this held-out panel has now informed design decisions.
3. Measure marker-trigger frequency and relocation timing in contested rounds.
   A functioning marker does not prove it provides useful warning.
4. Investigate damage tolerance and process allocation with shared-counter
   tests. Blindly adding SPL can break the clear's pass-boundary invariant.

## Build status

Work remains on `codex/molting-94x`; main was not modified. Final `node --test`
verification: **166 tests, 160 passed, zero failures, six optional GPU checks
skipped**. The log is `evolved/molting-94x-4242/tests.tap`.

A separate small run in `evolved/molting-smoke` exercised the final runner and
opponent-file exports with `--backend auto`, one candidate, one-round screens
and checks, two validation seeds, and one generation/batch/child. It completed
both evolution modes and all exports. The fresh worktree has no optional
`webgpu` package, so auto correctly fell back to CPU and recorded the reason.
The smoke scores are not competitive evidence and are excluded from E1.
