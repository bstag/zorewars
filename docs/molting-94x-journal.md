# Molting 94x: build and experiment journal

**Qualification discovered in E5:** the frozen Molting openings use an incorrect
`SLT.B` immediate-threshold guard. The default phase specimen makes zero opening
attacks in a solo diagnostic. E1–E4 still document their actual specimens and
relocation behavior, but do not establish the intended bomber/scanner opening
effectiveness. See E5 below. Frozen files and historical measurements are retained.

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

## E4 — shorter stun and direct DAT (protocol fixed before scores)

User-requested follow-up: vary the payload's stun duration while preserving
relocation, and compare with plain clears. Use a controlled ablation before
another evolutionary search: hold all seven parameters of both saved E3
recommendations fixed. Test full stun, 64, 512 and 4096 stun writes, and direct
DAT, for each parent. No variant selection or default changes in this experiment.

New template: `molting-phases.js`, with PHASE=0 (direct DAT), 1 (short stun),
2 (full stun), and STUN=32..4096. STUN is unused in modes 0 and 2. The original
files stay frozen. Full mode must compile to the same genome as each old parent.
Direct DAT removes four payload instructions; it does not just jump past them.
The scanner opening's SPL bomb remains unchanged; "direct DAT" describes the
relocated payload, not the opening. Short stuns reset the pointer before DAT so
the kill pass starts at the beginning of the stunned strip.

Extend the relocation gate to count actual SPL writes and verify their addresses,
then record the first DAT write and require it at the start of the clear. Keep
exact copying, timer/marker checks, wrapping load checks and full solo survival.
Check both directions and all eight opening/trigger structures, even though the
two frozen E3 recommendations both clear forward.

For every phase compare the relocated warrior, its full-body in-place control,
and the corresponding compact plain payload. Five shared forward plain clears,
ten Molting entries, ten in-place controls: 25 entries. Match all on four fresh
placement seeds (1400001, 1410001, 1420001, 1430001), 12 rounds per opponent,
with full 94x cycles and a 50-instruction entry cap. Opponents retain 200.

Use the same 14 development and eight comparison opponents as E3. Both panels
have already been examined: **the comparison panel is no longer held out**.
Fresh placements do not restore untouched-opponent status. Report paired seed
gains and the 2.5-standard-error noise margin as exploratory diagnostics; many
comparisons are being made. No public-hill claims.

```sh
node scripts/compare-molting-phases.js --out evolved/molting-phases
```

### Mechanism results

All ten variants and their matching controls compiled and survived full solo
rounds. Full-stun variants matched their frozen parent genomes exactly. Tests
also cover all eight structures in both clear directions, short-phase boundary
values, altered stun counters, and a deliberately incorrect DAT restart.

| Payload | Stun writes | Payload instructions | Turns from arrival to first DAT write |
| --- | ---: | ---: | ---: |
| Full stun | 55427 | 13 | 110859 |
| Short 64 | 64 | 13 | 133 |
| Short 512 | 512 | 13 | 1029 |
| Short 4096 | 4096 | 13 | 8197 |
| Direct DAT | 0 | 9 | 3 |

Direct DAT also copies four fewer instructions, arriving eight solo turns
earlier. The timer variant shrinks from 27 to 23 instructions; the sensor
variant from 31 to 27. The behavior gate observed the exact write counts and
the first DAT destination, not just eventual survival. No relocation or marker
behavior was removed.

### Battle results

Completed **26400 rounds in 2200 match jobs**, four CPU workers, about 315
seconds including concurrent test activity. The additional diagnostic replay
below adds 24 rounds and is not included in that count. Scores are points per
round, averaged equally over opponents within each panel. These panels have
different opponents, so their scores should not be compared as if interchangeable.

| Parent / phase | Length | Development | Comparison | Matching plain clear, comparison | Matching in-place, comparison |
| --- | ---: | ---: | ---: | ---: | ---: |
| Timer / full | 27 | 0.988 | 1.156 | 1.104 | 1.172 |
| Timer / 64 | 27 | 0.923 | 1.354 | 1.211 | 1.268 |
| Timer / 512 | 27 | 0.899 | 1.323 | 1.227 | 1.263 |
| Timer / 4096 | 27 | 0.746 | 1.154 | 1.034 | 1.138 |
| Timer / DAT | 23 | 0.945 | 1.286 | 1.221 | 1.266 |
| Sensor / full | 31 | 0.973 | 1.141 | 1.104 | 1.148 |
| Sensor / 64 | 31 | 0.859 | 1.240 | 1.211 | 1.266 |
| Sensor / 512 | 31 | 0.871 | 1.240 | 1.227 | 1.266 |
| Sensor / 4096 | 31 | 0.713 | 1.146 | 1.034 | 1.156 |
| Sensor / DAT | 27 | 0.917 | 1.268 | 1.221 | 1.263 |

Timer/64 has a promising **panel-specific advantage over both controls**: on comparison
opponents it gains +0.143 against its matching plain clear (noise margin 0.033)
and +0.086 against its full-body in-place control (margin 0.042). Those clear
the exploratory margin. Its +0.198 versus the old full-stun Timer is slightly
below that comparison's 0.200 margin. These are four-seed, multiple-comparison
diagnostics on previously examined opponents, not formal significance claims.
The controls bypass both the opening and relocation, so they do not isolate
relocation's contribution from the opening attack. Short-stun/full-stun pairs
have the same code length; direct DAT also changes footprint and copy cost.

Timer/512 gains +0.096 over its matching plain clear, below its 0.172 margin;
the in-place gain is +0.060 with a 0.085 margin. Direct DAT is compact and attacks
very quickly, but neither parent's comparison-panel gain over its matching
plain or in-place control clears the margin. For Timer/DAT those gains are
+0.065 (margin 0.241) and +0.021 (margin 0.165). The 4096-write intermediate
phase loses substantial development-panel performance without a useful
comparison-panel gain over the full-stun parent.

All shortened/direct variants score lower than their own full-stun parent on
the development panel. Do not promote a new general-purpose default from this
experiment. The short timer is a specialist worth further testing, while the
full-stun design remains important against papers.

### Opponent tradeoffs and loss diagnosis

Timer/64 versus Timer/full, mean per-opponent changes over all 48 rounds:
Scout +1.167, Vampire +0.604, Dwarf +0.500, Quickscan +0.500; Mice -2.458,
Hydra -0.521, Papercut -0.479, Silk -0.313, Fast Silk -0.229. On the comparison
panel the largest gains are Carpet Bomber +0.729, Stone and Imp +0.729 and
Gemini +0.583, while Evolved Silk loses 0.271. This supports treating short
stun as a changed matchup profile rather than an across-the-board improvement.

Replayed the first development-panel Mice match with reports, seed 1400071,
12 rounds each (base seed 1400001 plus Mice's opponent offset of 70):

- Timer/full: 11 wins, 1 loss, 0 ties.
- Timer/64: 0 wins, 10 losses, 2 ties.

In the first three short-stun losses, Mice overwrote the relocated clear's
instruction at 6972, ending the last process at cycles 219913, 413586 and
44318. The corresponding full-stun rounds killed Mice at cycles 221457,
218515 and 221495. The post-mortems establish the killing writes; they do not
alone prove the entire causal history. The pattern is consistent with losing
the full stun sweep's ability to suppress replication before the DAT pass.
Two short-stun losses end on own code, despite all solo checks passing; enemy
interference can still create self-hits.

Evidence: [results and per-opponent means](molting-phases-results.json),
[matched Mice diagnoses](molting-phases-diagnosis.json). Raw reports and all
25 Redcode entries plus ten JavaScript variants are in `evolved/molting-phases/`.
E1–E3 and their specimens are retained. No candidate was automatically promoted.

### Playable variants and verification

- `examples/experimental-94x/molting-phases.js`: predeclared Timer/512 default;
  set PHASE/STUN to explore other modes through the existing parameter tuner.
- `examples/experimental-94x/molting-direct-dat.js`: predeclared Timer/DAT sample.
- `evolved/molting-phases/4242-short64.js`: tested Timer/64, locally generated;
  rerun the comparison script to reproduce it and the other saved variants.

The full regression suite passed: **173 tests, 167 passed, six optional GPU
checks skipped, zero failures**. CLI checks for both new playable generators
passed without warnings. Log: `evolved/molting-phases/tests.tap`.
Main and the old generator defaults remain unchanged.

Possible next experiment: add a bounded local stun/kill cycle or choose payload
mode from an in-round signal, while retaining the full-stun control. That would
be a new design hypothesis, not a demonstrated improvement from E4.

## E5 — executable block catalog and source anatomy (2026-10-27)

### Build decisions and coverage

Keep discovery, implementation and evidence separate. The source index covers
all 147 warrior source files in `warriors/` and `examples/`: 44 Redcode, 82
JavaScript, 20 Python and one C++. Language conversions and adaptations retain
their relationships rather than counting as unrelated designs. It records
1,056 local label regions and 306 across the 35 curated public archive originals.
All 35 downloads succeeded. These are lexical candidate boundaries, not 1,362
independently usable blocks. Generated labels, macros and coupled state still
need review. Generator sources are inspected as text, not executed by inventory.

Public originals remain under ignored `imported/block-sources/`, keyed by hash.
Tracked metadata preserves author, URL, source hash, constants, line ranges,
symbol references and assembly results by profile. Redistribution rights have
not been established. Four sources have manual anatomy notes tied to their
exact hashes: MICE, Silk Warrior 1.3, Torch t18 and Iron Gate 1.5. Torch's
two-process, noncontiguous boot is explicitly incompatible with our current
single-process copy contract.

The catalog has seven executable choices and thirteen documented extraction
candidates. Its grammar is opening (none/bomber/B-scan), transfer (in place or
copy), and terminal payload (DAT, short stun then DAT, full stun then DAT),
with either clear direction. Symbolic labels keep copy extents and relative
references correct when sections change. Pure-clear controls omit the whole
startup wrapper. Arbitrary block order, papers, P-space control and torus
sections are not admitted yet. Their source locations and extraction contracts
are documented rather than falsely marked safe.

Strict '88 has its own legal forward-clear implementation using explicit ADD;
'94 uses postincrement. Both are tested with the actual profile settings,
including lp's currently implemented 100-instruction default. There is no '86
engine profile. The initial shared search bounds limit HOP to 256–7000 even on
94x; wider landing-site searches are an explicit future extension.

Entry points: [catalog](warrior-blocks.md), [source browser](block-source-index.md),
[machine instruction table](block-instructions.json), and
[playable recipes](../examples/blocks/README.md).

### Important correction to the earlier hypothesis

While strengthening attack tests, we found that the frozen Molting opening uses
`SLT.B #2047, probe`. With an immediate source, `.B` compares the executing
instruction's B-field, not the immediate A-field threshold. The default
`molting-phases.js` specimen performs **zero** opening writes before reaching
`molt` at cycle 844. Earlier solo/copy tests established survival and relocation,
but did not establish that the opening actually bombed or scanned as intended.
E1–E4 are retained with this qualification; they must not be cited as a clean
test of the intended opening-versus-relocation hypothesis.

The catalog uses `SLT.AB`, and its gate checks expected bomber write coverage,
the bomb opcode, protection of the original image, and the timer. The scanner
must hit an injected nonzero target exactly once and skip empty cells. A
regression deliberately changes the modifier back to `.B` and must be rejected.
This also explains why compilation and solo survival are insufficient contracts.
Frozen historical generators are not rewritten. The new B-field scanner and
protected span differ from the old template, so E5 is a new recipe experiment.

### Search protocol

```sh
node scripts/blocks.js inventory --public
node scripts/blocks.js catalog
node scripts/evolve-blocks.js --out evolved/block-search-4244-v2
node scripts/evolve-blocks.js --rules 88 --out evolved/block-search-88 --population 4 --generations 1 --offspring 2 --rounds 2 --check-rounds 2 --tune-candidates 1
```

The primary 94x run uses seed 4244, population six, two generations and six
offspring per generation. Six training opponents are Dwarf, Scanner, Silk,
Vampire, Two-Pass and Mice. Seeker and One-Shot form the comparison panel;
these are reused research opponents, not untouched held-out opponents.
Candidate budget is 50 instructions. Both wrapped and unwrapped behavioral
checks run before GA admission. Generation placement seeds rotate and all
parents are rescored. All 18 admitted parameter vectors passed; four duplicate
proposals were skipped. Numerical refinement tries eight coordinate neighbors
across WAIT, STEP, HOP and STUN with a common seed.

The existing tuner then tests four random numerical proposals plus the current
one, holding structural choices fixed. Its two finalists pass the block gate
again. Sampling is seeded while the tuner constructs its synchronous proposal
list, then the global random function is immediately restored. Tuner and GA
scores are not interchangeable: the tuner uses smooth score; the GA uses points.
Final validation compares every selected specimen with three pure clears on
three fresh placement seeds, eight rounds per opponent. Paired 2.5-SE margins
use seed-level panel means, not opponents as independent seed samples.

The 94x experiment ran **2,688 battle rounds**. The separate strict '88 integration
run used the actual indexed adaptations (including `scout-88.red`), not assumed
filenames, and ran **564 rounds**. It exercises six admitted recipes, parameter
steps and the existing tuner. It is a smoke experiment, not a strength estimate.
All evaluation uses CPU workers; no GPU performance claim is made.

### Results and decision

| 94x specimen | Instructions | Training points/round | Comparison points/round |
|---|---:|---:|---:|
| Starting recipe / GA champion | 26 | 1.1875 | 1.3125 |
| Parameter steps / existing tuner | 26 | 1.1875 | 1.3125 |
| Plain DAT | 9 | 1.4097 | 0.9375 |
| Plain short stun | 13 | 1.2431 | 0.7500 |
| Plain full stun | 13 | 1.4792 | 0.6875 |

Neither search nor tuning established an improvement over the starting recipe.
The recipe beats plain clears on the two-opponent comparison panel and loses
on the six-opponent training panel. This is a different matchup profile, not an
overall promotion. The '88 tuner also retained its input; coordinate steps
improved its small comparison panel while lowering training scores.

The initial local run `evolved/block-search-4244/` included four startup
instructions in the plain controls and is superseded by the v2 run above.
It remains only as local build history. The tracked
[experiment evidence](block-experiments.json) contains the two accepted run
reports, emitted section boundaries, lineage, parameters, behavior observations,
per-opponent results and paired margins. All primary-run candidates, numerical
neighbors and tuner finalists were rechecked after strengthening the gates.

Validation: **185 tests, 179 passed, six optional GPU skips, no failures**;
`evolved/blocks/tests-final.tap`. Playable examples are 26 instructions for 94x
and 28 for '88. The existing CLI evolver, tuner defaults and library membership
are unchanged. All work remains on `codex/molting-94x`; main is unchanged.

Next extraction priorities: a certified compare-scan/one-shot handoff, a
process-aware paper recipe, and a marker trigger contract. Add each only with
its own scheduling/memory tests, then benchmark against same-cost plain controls.

## E6 — current hill leader breakouts (2026-10-27 local)

Fetched the published Koenigstuhl recursive rankings at
`2026-10-28T02:41:46.087Z` (October 27 in Chicago), then inspected the top three
sources from each of 94x, 88, 94nop and LP. This is a dated retrieval of the
published tables, not a claim about their recomputation date or the different
Battle Royale/top-50 rankings. Sources, authors, ranks and hashes are recorded
in [the leader snapshot](hill-leaders.json); readable source maps are in
[the leader breakdowns](hill-leaders.md).

The current recursive leaders are Fatamorgana X (X), Lithobolia C yvfp (88),
Arvon (94nop), and R.O.U.S. (LP). Their full source lengths in our engine are
200, 99, 81 and 7 instructions respectively. All twelve originals assemble under
their source-hill settings. Only R.O.U.S. fits our corresponding 50-instruction
tournament profile unchanged. The source LP hill allows 200 instructions and
P-space; our existing lp default is 100 and forbids P-space. X's leaders use
P-space, so they are not direct legal entries in the no-P-space 94x experiment.
No existing profile was changed.

The sources make several important dependencies concrete:

- Fire and Ice II and Fire and Brimstone share the stone/controller lineage;
  the latter substitutes a Kenshin scanner. The former scanner still contains
  an STP bomb even when its controller is removed.
- Arvon, Azathoth and pst_v4 are closely related paper/stone recipes. Counting
  them as independent discoveries would overstate diversity. Their launchers
  use process timing and self-modified pointers to copy both payloads.
- Freight Train exposes an author-provided switch to omit its quickscan.
  That is a much stronger extraction boundary than deleting guessed lines.
- LP papers can be very small but copy more cells than their visible bodies.
  Copy spans, initial entry and eight-process scheduling belong in the contract.

Two originals failed a fresh solo run: Fatamorgana X and Bronze minotaur. The
snapshot preserves these observations. Fatamorgana includes result-dependent
entry logic; one enemy-free run is not a multi-round P-space test. Neither
failure is presented as proof that the published ranking or source is invalid.
They need separate diagnosis before training admission.

### Reference extractions and checks

Five reviewed reference specimens are cached in ignored
`imported/hill-leaders/extracted/`, retaining original attribution. Source hashes
must match the manual review before extraction; changed sources are marked
stale and cannot use the old extraction. These are public-code study specimens,
not newly authored implementations and not automatically admitted to evolution.

| Reference specimen | Profile | Instructions | Solo placements passed |
|---|---|---:|---:|
| Fire and Ice II airbag stone branch | 94x | 26 | 2/2 |
| Fire and Brimstone Kenshin branch | 94x | 23 | 2/2 |
| Freight Train, documented quickscan switch off | 88 | 29 | 2/2 |
| Arvon launcher + paper/stone body | 94nop | 20 | 2/2 |
| R.O.U.S., unchanged | lp | 7 | 2/2 |

All five compile within 50 instructions and survive the full cycle limit at
base zero and a wrapping placement. This establishes basic viability, not
exact-copy, process-scheduling, controller or mutation-safety contracts.
Six corresponding candidate families were added to the main catalog, with
explicit admission tests. The existing seven behavior-checked composer choices remain
the only choices the recipe GA may use.

### Matched exploratory screen

`node scripts/benchmark-leader-breakouts.js` ran 1,088 battle rounds on CPU.
Each profile uses four local opponents, seeds 2424601 and 2434601, and eight
rounds per opponent/seed. References and three plain clears share placements.
The panels are reused library material, not fresh held-out hills. Comparison
across different profiles is not meaningful.

| Profile | Reference | Points/round | Best plain-clear score on same panel |
|---|---|---:|---:|
| 94x | Airbag stone | 2.1250 | 1.6406 |
| 94x | Kenshin branch | 2.0313 | 1.6406 |
| 88 | Freight Train without quickscan | 2.1875 | 1.1563 |
| 94nop | Parallel paper/stone | 2.2500 | 1.0938 |
| lp | R.O.U.S. | 2.4219 | 0.7344 |

The screen supports spending effort on these families, but two seeds and four
opponents do not establish a general winner. It does not reproduce the original
hill rankings or attribute their strength to an isolated section. Detailed
per-opponent results and code hashes are in [screen evidence](hill-leader-screen.json).
No public source was copied into tracked implementation files or promoted into
the mutation grammar.

Validation: 17 focused tests passed, including stale-source rejection,
ranking-format rejection, symbolic dependency errors, documented conditional
extraction, source/profile separation and existing composer contracts. The live
fetch/compile/solo pipeline and the matched screen also completed successfully.

Best next 94x build: an original compact stone with a clear fallback and a
verified multi-process boot. Next breadth expansion: a process-aware paper
recipe, using the compact LP family and the parallel paper/stone family as
separate contracts. A P-space selector belongs in a distinct 94x-hill experiment.

## E7 — original Lifeboat stone/fallback and historical research (2026-10-27 local)

### Build hypothesis and implementation

Implement our own small 94x stone with a recoverable transition into a clear,
using the public leader breakout as a benchmark and architectural reference.
`tools/blocks/airbag.js` emits **Lifeboat 94x**, an original contiguous-copy
design. It does not copy the reference's noncontiguous boot, instruction body,
P-brain or multi-process stone. The default is 37 instructions; direct DAT
fallback uses 33, and omitting the boot removes another six.

The boot copies the complete payload backwards, then enters a launcher that
creates exactly two processes. One bombs with a guarded stride and a bounded
counter. The other watches the stone's first instruction, a completion flag,
and a private timeout. The watchdog alone owns the clear pointer/counter.
Normal completion signals the watchdog and intentionally retires the stone
process with DAT. This is not total-warrior suicide. Fatal damage to the watched
stone instruction triggers early clearing; fatal damage elsewhere is covered
by the timeout. Arbitrary enemy corruption of the watchdog or clear is not
covered by this contract.

BOOT, bomb type, clear direction and phase are structural choices. STEP, HOP,
SHOTS and STUN are numerical choices; the watchdog deadline is derived as
`2*SHOTS+32`. The probe's origin and protected interval are derived from the
assembled payload, so changing phase/length cannot silently invalidate offsets.
The active payload is excluded from both the stone and clear writes. HOP is
unused when BOOT=0, and STUN is unused for direct/full-stun modes.

### Behavioral gates

The final admission gate checks normal and wrapping source loads, a wrapping
destination when booting, injected fatal damage to the watched instruction,
and injected fatal damage to an unwatched loop instruction. It verifies exact copied instructions, entry,
actual attack counts/locations, intended bomb type, protected memory, transition
conditions, exact stun writes, DAT pointer reset, full-round survival, a peak
of two processes and one final survivor. The tests also deliberately break the
copy, launcher, attack guard, stun count/bomb, and handoff to ensure rejection.

The default boots in 63 cycles, makes 512 stone writes, enters its clear at
cycle 4166 and reaches DAT at 4298. Watched damage starts the clear at cycle 68;
unwatched loop damage starts it through the timeout at cycle 3238. Both damaged
scenarios finish the full 500,000-cycle round alive. These observations apply to
the specified injected faults, not an adversarial immunity claim.

All 24 structural combinations, numerical endpoints and twelve seeded random
vectors pass the gate. After strengthening the exact stun-write assertion and
adding an explicitly wrapping destination,
41 distinct vectors from search, refinement, tuner finalists and controls were
reverified. The evidence records the final verifier hash separately from the
initial run hash. The recipe has a separate process-aware GA runner; it is not
inserted into the single-process block composer.

### Search and matched controls

```sh
node scripts/evolve-airbag.js --out evolved/lifeboat-4247 --seed 4247
node scripts/airbag.js verify --generator examples/experimental-94x/lifeboat/lifeboat.js
```

The CPU search used population eight, three generations and eight children per
generation; 30 distinct recipes were admitted, with five duplicate proposals
and no gate rejection among these proposals. Screening used six opponents and
four rounds each, rotating placements while rescoring parents. Eight coordinate
neighbors refined STEP/HOP/SHOTS/STUN. The existing random tuner evaluated eight
numerical proposals plus its input, then rechecked three finalists on three
placement seeds. It found no improvement over its input.

Final validation uses three fresh placement seeds and twelve rounds per
opponent. Training is Dwarf, Scanner, Silk, Vampire, Mice and Two-Pass;
comparison is Seeker, One-Shot, Fast Silk and Gatekeeper. These are previously
examined opponents, not a fresh held-out hill. Controls include three pure
clears, the same tuned parameters booted/in-place, and the cached public stone
reference. The run totaled **5,808 battle rounds**. No defaults or library
entries were promoted.

| Specimen | Instructions | Training points/round | Comparison points/round |
|---|---:|---:|---:|
| Declared Lifeboat default | 37 | 1.1250 | 0.8542 |
| GA champion | 31 | 1.4028 | 0.7083 |
| Parameter steps / tuner choice | 31 | 1.3796 | 0.6458 |
| Same tuned parameters, booted | 37 | 1.4028 | 0.8264 |
| Plain DAT | 9 | 1.3426 | 0.4583 |
| Plain short stun | 13 | 1.3750 | 0.5069 |
| Plain full stun | 13 | 1.4491 | 0.5972 |
| Public stone reference | 26 | 1.8056 | 1.7014 |

The GA selected an in-place full-stun recipe with STEP=17224. Its apparent
training gain over the default, 0.2778, did not exceed the paired seed-level
2.5-SE margin of 0.2953, and comparison performance fell. Coordinate refinement
changed STEP to 18090 and performed worse on fresh placements. Matched booting
improved the comparison mean by 0.1806, but the margin was 0.4981. This run
establishes neither a general improvement nor a convincing boot advantage.

The public reference remains substantially better. Our extra watchdog and
per-shot protection consume execution slots; that is a plausible cost to
investigate, not an isolated causal result from these scores. Do not relax the
copy or process-ownership tests merely to recover score. A useful next ablation
would derive a safe bombing orbit and remove redundant per-shot work, while
retaining the same fallback tests and controls.

Evidence: [full run, lineage and per-opponent results](lifeboat-results.json),
[playable default and screening specimen](../examples/experimental-94x/lifeboat/README.md).
The complete regression suite passed: **194 tests, 188 passed, six optional GPU
skips, zero failures**. Final log: `evolved/lifeboat-4247/tests-final.tap`. All runs used CPU;
GPU performance was not tested.

### What the historical study changes

The parallel [family history](warrior-family-history.md) follows dated author
posts, actual source versions and contemporary newsletters across stones,
scanners, quickscans, clears/gates, paper/silk, imps, vampires, P-space, LP and X.
It separates confirmed credits from resemblance, and version evidence from
invention dates. Eight additional Redcode versions and five newsletter texts
were cached under ignored `imported/history/`. The additional source hashes and
archive metadata are preserved in [the source manifest](warrior-history-sources.json).

The most useful findings are operational: Torch changes booting, decrement
resistance and transitions across versions; TimeScape changes copying side
effects with scheduling; historical quickscan work tests actual target coverage
before aggregate battle scores. Changes sometimes reverse as the opponent mix
changes. We incorporated the boot/no-boot control, derived timeout and fault
injection now. Next contracts should cover safe stride relationships and first/
second-generation paper copying under explicit queue limits. No historical
code or dates were silently rewritten.

## E8 — Add the n1LS historical warrior collection (October 28, 2026)

Imported the user-supplied [n1LS/redcode-warriors repository](https://github.com/n1LS/redcode-warriors)
at commit `615f2f3d75acfcb5420821eb5c1acc659377a7e2`: 567 Redcode files plus
`listing.txt`. Original bytes remain in ignored `imported/history/n1ls/`.
The indexer verifies the Git tree and every blob, records authors, source
strategy/version/date notes, and generates local label/constant anatomy.

Assembly passes / passes within 50 instructions: 88 **563/425**, 94nop
**565/427**, lp **563/426**, 94x **454/372**, 94x-hill **454/372**. These are
compatibility checks, not behavioral or battle results. Five pairs assemble
identically under 94nop and are marked to prevent duplicate opponent weighting.

The initial review identifies Agony and Charon scanner revisions, Imprimis
stone/imp scheduling changes, and Sphinx constant/decoy variants. Source
comments support those relationships; the repository's 2018 upload date does
not date warrior creation. Charon's conflicting creation-date headers and
Agony's placeholder submission dates are retained explicitly. Agony Killer
is not treated as a descendant merely because of its name.

Evidence: [collection notes](n1ls-warrior-history.md),
[browseable index](n1ls-warrior-index.md), [full manifest](n1ls-warrior-history.json).
No battles, Red Queen promotions, library additions, or default-setting changes
were part of this ingestion. Behavioral gates and family-aware training splits
remain prerequisites for using these as generator components or opponents.

Validation checked all 567 cached SHA-256 hashes, commit-pinned links and length
flags, byte-identical regeneration of the index/manifest, and rejection of a
tampered tree without overwriting reports. `git diff --check` passed. The battle
engine was unchanged; the full battle regression suite was not rerun.

## E9 — Planar archive and component taxonomy (October 28, 2026)

Expanded the user-supplied Damien Doligez archive from our selected specimens
to both complete indexes, all 14 component pages, and their linked text
references. The old moscova address timed out; the gallium copy was reachable.
Cached **1,683 unique warrior sources** for **1,686 index entries** and **852
of 853 reference texts**. The SwitchBlade post returns 404; its separate
assembly source is present. All fetched bytes have SHA-256 receipts.

Component memberships agree across all 14 type pages and the dated index.
The crosswalk maps stone/paper/vamp/stun/imp/clear/scan/pspace/boot/gate/quick
to relevant local blocks and candidates. Factor and sort identify 24
special-purpose entries; other remains subject to individual review. These
classifications are metadata, not new generator capabilities or opponent
admissions.

The source index preserves 22 uncertain and 103 partial release dates. Its
count differs from the homepage's 1,689 claim, and four names share the Phoenix
1.1 source URL; those identities are flagged for review. Maintainer assembly
copies remain separate from original author posts. Across unique source URLs,
30 exactly match n1LS bytes and 399 match at least one n1LS assembly under 94nop.

Unique-source assembly passes / fits 50: 88 **496/364**, 94nop **1288/801**,
lp **1289/801**, 94x **1011/664**, 94x-hill **1115/696**. These include
special-purpose sources and do not establish behavior or competitive strength.

Historical follow-ups: Moore's 2001 Airbag Demo explicitly uses DAT injection
to demonstrate a fallback, and airbag frenzy reports a modest improvement
without solving all stone/imp matchups. Fire and Ice II's original post gives
dated context for our existing 94x reference. Older evolutionary posts include
tiny-core settings even when a header says 94x; preserve actual settings rather
than assigning today's profile from the name alone.

Evidence: [archive findings](planar-warrior-history.md),
[component crosswalk](planar-components.md), [source index](planar-warrior-index.md),
[full manifest](planar-warrior-history.json). No battles or evolution runs were
part of this ingestion; ordinary evolution and Red Queen defaults are unchanged.

Validation checked every cached index/source/reference hash, all 14 component
memberships, bracketed source/post links, four shared-source identity warnings,
and byte-identical offline report regeneration. A deliberately invalid cache
receipt was rejected without overwriting reports. The known SwitchBlade 404
is the only fetch failure and remains an explicit nonzero importer status.
Catalog documentation was regenerated and `git diff --check` passed. The
unchanged battle engine's regression suite was not rerun.

## E10 — Review the “other” mechanisms (October 28, 2026)

Surveyed all 305 Planar other-category source headers/comments and compiled
each unchanged source with an actual 94x 50-instruction cap: 137 pass. Keyword
signals are retained as reading aids, not family assignments. A focused
19-source shortlist and additional tournament examples received source/post
analysis. Added six non-selectable block candidates: worker refresher, numeric
disruptor, mutual repair, schedule watchdog, execution-report bomb and fang
backtrack. The seven executable grammar choices remain unchanged.

Eleven compact originals were solo-tested at base 0 and coreSize-7 under
standard 94nop and 94x. An additional 8000-cell 500,000-cycle diagnostic checked
whether the normal 80,000-cycle horizon hid later failures. Five originals
failed 94x solo and were excluded from battles: kill -9, both bunker variants,
Dwarfer II and Antivamp. Bunker [2] survived the extended 8000-cell run but died
at cycle 441244 in 94x; its core-half spacing/checksum assumptions need derived
parameters. Bunker [1] also died after the normal 94nop horizon, at 111498.
These are observations in our VM, not a pMARS equivalence result.

Six surviving originals and two local controls played four library opponents
(Dwarf, Seeker, Silk, Vampire), four rounds each at seeds 20261028 and 20262028:
**256 battle rounds**, CPU. Scores per round: tamper **1.625**, Dwarfer
**1.59375**, Lifeboat **1.46875**, plain DAT **1.375**, Signal **1.28125**,
Airbag Demo **0.875**, 4-line Bomb Dodger **0.875**, Body-Snatcher3 **0.78125**.
Only 32 rounds per entry and previously used opponents: no significance or
general-superiority claim. tamper loses to Silk; Dwarfer struggles with Seeker
and ties Silk. Airbag's demo fallback and Body-Snatcher mostly produce ties.

The next design candidates are a protected worker refresher and a bounded
numeric-disruption opening; a derived repair pair is more demanding but
distinctive. Gates must check actual restoration/attack behavior and queue
cleanup, not survival alone. No historical sources were edited, no tuning or
evolution was run, and no Red Queen history or default setting changed.

Evidence: [review](planar-other-review.md), [primary-source mechanism notes](planar-other-mechanisms.md),
[all-source survey](planar-other-survey.json), [solo and battle results](planar-other-screen.json).
Raw output: `evolved/planar-other-review-20261028/report.json`.

Validation: all 12 block-contract/catalog tests pass. Survey regeneration is
byte-identical; source-manifest hashes, raw/tracked report agreement, all 256
battle outcomes and calculated scores were checked. Six new candidates remain
non-selectable and the executable block count remains seven. `git diff --check`
passes. The full engine suite was not rerun because battle behavior was unchanged.

## E11 — Monowire development and compact reference (October 28, 2026)

Reviewed the user-supplied [Monowire article](https://corewar.co.uk/mizcu/monowire.htm),
preserving the page and nine displayed code blocks under ignored
`imported/history/monowire/`. Final source credits Miz; no publication date was
inferred. Earlier snippets include incomplete examples and END-label conflicts.
Their assembly failures are documented, not silently corrected.

The final source is 80 instructions: nine payload, 60 decoy, 11 boot/pointers.
Tested it unchanged beside a labeled 50-instruction derivative (30 decoy cells,
symbolic destination adjustment preserving the original landing) and a bare
nine-instruction final body. Exact nine-instruction startup copies were verified
before execution at base zero and wrapping placement; booted versions land at
the same address. All variants survive full-cycle solo checks under 94nop and
94x. These checks do not yet certify target detection or the SPL/DAT transition.

Four fixed library opponents, four rounds each, two seeds (20261030, 20262030):
**288 CPU battle rounds**. 94nop: original80 and compact50 **2.28125**, body9
**2.03125**, plain DAT **1.0625**. 94x: original80 and compact50 **2.15625**,
body9 **2.25**, plain DAT **1.46875**, Lifeboat **0.90625**. Original and compact
had identical outcomes in this small sample. No held-out field, significance
test, tuning, evolution, promotion or public-hill-strength claim.

The next useful contract is a coupled comparison scanner and self-modifying
clear. The unchanged +24 stride has a different ideal coverage fraction on
55440 than on 8000, and shortening decoys shifts the boot destination unless
compensated. These are parameters to derive jointly, not mutate independently.
The existing one-shot candidate now links this evidence; executable choices
and Red Queen settings remain unchanged.

Evidence: [experiment](monowire-review.md), [mechanisms](monowire-mechanisms.md),
[full receipt](monowire-review.json). Completed raw run:
`evolved/monowire-review-20261028-v2/report.json`.

Validation checked page/snippet/variant hashes, unchanged payload assembly,
exact startup-copy receipts, full-cycle survival, all 288 battle score totals,
and the seven unchanged executable catalog choices. The catalog-reference test
and `git diff --check` pass. The full engine suite was not rerun; only reference
metadata and optional review tooling changed.

## E12 — Typed recipes join the main evolver (2026-10-28)

**Question.** Can we evolve executable block layouts from the broader catalog,
preserve relocation and process contracts, and use Monowire's layout lessons
to study decoys without confusing them with changed boot positions?

Implemented the opt-in `evolve --representation blocks` path. Three recipe
families are admitted: the existing single-process clear/bomber/B-scan grammar,
the two-process Lifeboat watchdog grammar, and new original Compass comparison
scanner/clear with decoy layout. Whole-family contracts keep pointer frames and
process ownership intact. This does not expose arbitrary historical instruction
slices to crossover or change instruction-evolution defaults.

The GA uses within-family crossover, structural and numeric parameter mutation,
family immigrants, lexicase and family preservation. All new candidates pass
behavior gates. Parents are rescored every generation against common placements
and the current Red Queen ancestors. Local ±1 parameter steps use the same gates.
Exports preserve source, tuner-compatible generator, recipe, behavior receipt,
genealogy and per-generation population/ancestor counts. Fresh validation can
retain the original baseline. A CLI regression test covers export, verification,
resuming a receipt and refusing to overwrite a prior experiment.

**Monowire lesson applied.** Compass keeps its 20/26-instruction payload separate
from 0–18 decoy cells and an optional six-instruction boot. The default is 44
instructions. Boot destination is anchored to payload origin, independently of
decoy count. Scan stride, gap, start, timer, phase and decoys are tunable. Unlike
Monowire's coupled self-modifying multi-process clear, Compass uses explicit
single-process phases; it is a new recipe, not a claim to improve Monowire.

Checks cover exact copy and entry at three origins including destination wrap,
full-cycle solo survival, private mutable fields, and isolated empty/A-only/
B-only/equal/self probe cases with exact first clear write and phase count.
Negative tests deliberately break copying, comparison, handoff and phase length.
The full catalog readiness map includes all 14 historical categories, not only
“other.” Paper, imp launchers, vampires, quickscan decoders, gates, P-space and
additional repair mechanisms still need their own executable contracts. Factor
and sort require separate correctness objectives. Those references have not
silently become admitted genes.

**Experiment.** `scripts/experiment-block-evolution.js` runs the actual CLI on
six known local opponents: Dwarf, Scout, Silk, Vampire, Mice and Two-Pass Clear.
Seed 20261028, population six, six offspring per generation, three generations,
three local steps per generation and four battle rounds per opponent. All
opponents were checked for full-round 94x solo survival. The comparison panel
is Seeker, One-Shot, Fast Silk and Gatekeeper; it is not used by this search.
These are previously examined library panels, not unseen public-hill opponents.

Thirty distinct recipes passed admission from 35 proposals, with five duplicates
and zero rejections in this particular search. The nine local steps were tried;
43 evaluations used 0, 1 and 2 prior champions across the generations. Champions
were clear, clear, then Lifeboat. The final Lifeboat used STUN=1. The selected
clear used WAIT=127 and STUN=1; Compass changed START to 2195. Family representatives
survived selection even when their aggregate fitness was lower.

CLI validation used three fresh seeds and retained the baseline: no finalist
cleared the existing 2.5-standard-error noise guard. The existing standalone
tuner then tried six nearby STEP values on the final champion and likewise
retained its current settings. Its finalists were re-gated before further use.

All entries below used common fresh seeds 22261028, 22361028 and 22461028,
eight rounds per opponent per seed. Scores are points per round:

| Entry | Instructions | Training panel | Comparison panel |
|---|---:|---:|---:|
| Default clear recipe | 26 | 1.3194 | 0.6875 |
| Evolved clear | 26 | 1.3472 | 0.6875 |
| Default Lifeboat | 37 | 1.1528 | 0.9271 |
| Evolved Lifeboat / tuner choice | 37 | 1.2014 | 0.9271 |
| Default Compass | 44 | 1.0764 | 0.6563 |
| Evolved Compass | 44 | 1.0000 | 0.6875 |
| Plain DAT | 9 | 1.2847 | 0.6042 |
| Plain short stun | 13 | 1.3056 | 0.5208 |
| Plain full stun | 13 | 1.4028 | 0.6458 |
| Compass without decoys | 32 | 1.0694 | 0.6563 |
| Compass with DAT decoys | 44 | 1.0694 | 0.6563 |
| Compass with varied SPL decoys | 44 | 1.0764 | 0.6563 |
| Compass in place | 38 | 1.0208 | 0.2813 |
| Compass direct DAT | 38 | 1.1042 | 0.7292 |

**Interpretation.** This validates the integration, not competitive superiority.
Decoys did not show a useful advantage on these panels. Direct DAT and booting
look worth studying further, but their Compass comparison gains did not clear
the paired noise guard. A simpler plain clear remains competitive. No library
promotion or main-branch change was made.

Final run: **6,268 CPU battle rounds**: 1,204 search, 720 CLI validation and
4,344 tuner/control comparisons. A same-seed run was repeated after tightening
budget validation and correcting parentless-immigrant genealogy metadata; the
final receipt identifies its implementation by source hashes. Raw final outputs:
`evolved/block-evolution-20261028-final/`. The first raw run remains in
`evolved/block-evolution-20261028/`.

Evidence: [guide and full-family contracts](block-evolution.md),
[tracked experiment receipt](block-evolution-results.json),
[playable Compass](../examples/experimental-94x/compass/README.md).
Full suite during implementation: 192 passed, seven skipped, zero failures.
The final targeted block tests additionally cover budget validation, genealogy
and the actual CLI round trip. GPU battles were not tested in this experiment;
the CLI shares the existing backend selector, while behavior gates remain CPU.
