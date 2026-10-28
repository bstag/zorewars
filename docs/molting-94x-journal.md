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
