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

## E3 — generator-level evolution (protocol fixed before results)

Requested follow-up: evolve choices and parameters while preserving relocation,
and compare against plain clears. Keep the original generator and its parameter
ranges unchanged so this experiment isolates the search representation.

The optional `tools/parameter-evolve.js` GA works on parameter objects. It uses
epsilon-lexicase parents and survivors, one scalar elite, whole-parameter
crossover, single-parameter mutation (local nudges or resampling), and 10%
random immigrants. Each child is regenerated from labeled source. No emitted
instruction is trimmed, grafted or otherwise edited. The standard CLI evolver
and tuner are unchanged.

Admission requires observed exact payload copying to HOP, execution of the
relocated DAT phase, abandonment of the opening, undamaged static payload, and
full 500000-cycle solo survival. Both a zero and wrapping base are checked.
Marker-enabled candidates must also relocate early after injected marker
damage. Tests deliberately break destination, relocation, payload and sensor
to verify rejection. This is a solo behavior contract, not a guarantee of
successful relocation under enemy interference.

Frozen schedule: seeds 4242 and 4243, population 12, three generations of 12
offspring, four screening rounds. Start with all eight structures plus random
parameters. Parents and children use the same placements within a generation;
parents are re-evaluated when placements rotate. Fitness is points minus the
stronger of the two plain-clear controls on that generation's training panel.
Subtracting this common baseline does not itself change the points ordering.

Training now contains the original eight plus the former six held-out entries.
The new untouched battle panel is Imp, Gemini, Sweeper, Stone and Imp, Evolved
Silk, Red Queen, Carpet Bomber and Blitz. All pass full solo checks. These are
still related local-library designs, not an independent public-hill sample.

Three finalists per search are checked against the original on three fresh
placement seeds, 12 rounds per opponent. Only that validation may choose the
export. After both exports are frozen, compare original, both exports, both
13-instruction standalone clear directions and each export's full-body
in-place control. Final placement seeds: 1200001, 1210001, 1220001. No selection
or edits based on this final panel. Report paired per-seed gains and the existing
2.5-standard-error screening margin; three seeds do not establish broad strength.

Reproduce with a fresh output directory:

```sh
node scripts/evolve-molting-parameters.js --out evolved/molting-parameters
```

### Results

Completed 19880 battle rounds in 3374 match jobs using four CPU workers, about
262 seconds including concurrent regression-test activity. Search admitted 46
parameter sets in seed 4242 and 48 in seed 4243; all passed the behavior gate.
There were zero gate rejections in the actual search because the fixed template
and declared ranges were safe in these trials. Deliberately broken candidates
are rejected in tests. Each run made 84 fitness evaluations, including rescored
parents. Full search lineage and observations remain in `search-SEED.json`.

Both runs passed the existing training-validation promotion margin:

| Seed | Original on validation placements | Selected | Gain | Noise margin |
| --- | ---: | ---: | ---: | ---: |
| 4242 | 0.827 | 0.994 | +0.167 | 0.104 |
| 4243 | 0.867 | 0.921 | +0.054 | 0.048 |

Preserved specimens:

- [Molting Timer 4242](../examples/experimental-94x/molting-4242.js): 27
  instructions, bomber, timer, forward clear. WAIT=211, STEP=1338, HOP=6965.
  SENSOR=545 is unused because TRIGGER=0. Its solo copy finishes at cycle 871
  at both tested load bases, and the relocated DAT phase survives the full round.
- [Molting Sensor 4243](../examples/experimental-94x/molting-4243.js): 31
  instructions, scanner, marker/timer, forward clear. WAIT=128, STEP=997,
  HOP=5540, SENSOR=911. Its undisturbed transition is cycle 668; injected marker
  damage brings that forward to cycle 33. Both paths survive full solo rounds.

The saved specimens differ from frozen recommendations only in their display
names. Their compiled genome IDs were verified against the validation record.
The original generator's constants remain unchanged.
Timer was produced by a parameter mutation in generation 3; Sensor by a
parameter mutation in generation 2. They are actual evolved descendants,
not merely reselected starting structures.

Final comparison (same three fresh placement seeds, 12 rounds per opponent):

| Entry | Instructions | Expanded training panel | New held-out panel |
| --- | ---: | ---: | ---: |
| Original Molting | 30 | 0.829 | 1.128 |
| Plain forward clear | 13 | 0.986 | 1.115 |
| Plain backward clear | 13 | 0.933 | 1.038 |
| Molting Timer 4242 | 27 | 1.024 | 1.177 |
| Timer's full-body in-place control | 27 | 0.950 | 1.188 |
| Molting Sensor 4243 | 31 | 0.992 | 1.090 |
| Sensor's full-body in-place control | 31 | 0.956 | 1.087 |

**The representation problem is addressed in this experiment:** evolved
recommendations retain and demonstrate relocation instead of becoming unrelated
clear fragments. The competitive result remains modest. On the new held-out
panel, Timer gains +0.049 versus original with a 0.009 screening margin, but
only +0.063 versus the forward plain clear with a 0.105 margin. Against its own
in-place control it loses 0.010 with a 0.066 margin. Sensor loses 0.038 versus
original; its +0.003 versus its in-place control is far below the 0.140 margin.
Both selected forward clears, so improvements cannot be attributed to relocation
alone. These multiple descriptive comparisons and three placement seeds are not
proof of tournament strength. Do not replace defaults on this evidence.

Tracked evidence: [parameter-search results](molting-parameters-results.json).
Raw input snapshots, all admitted parameter sets, provenance, generated source,
behavior observations and per-opponent scores are in `evolved/molting-parameters/`.
The original E1/E2 artifacts remain intact. This new held-out panel has now
been examined and must not be described as untouched in later design work.

Next useful experiment: keep the admission contract and vary the payload's stun
duration or switch directly to DAT, with matching plain-clear controls. This is
not implemented here: E3 intentionally held the template fixed to test whether
searching generator parameters could improve it without losing its behavior.

Final regression verification: **170 tests, 164 passed, six optional GPU checks
skipped, zero failures**. The saved recommendations are rebuilt and checked
against their validated genome IDs and behavior observations in the tests.
Log: `evolved/molting-parameters/tests-final.tap`. Main and the original Molting
defaults remain unchanged; all E3 work stays on `codex/molting-94x`.
