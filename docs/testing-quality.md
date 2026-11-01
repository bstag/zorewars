# Change risk and the CRAP process

CRAP combines cyclomatic complexity with test coverage:
`CC² × (1 − coverage)³ + CC`, where coverage is a fraction from zero to one.
The score identifies code worth investigating; it does not establish whether a
function is correct. The initial review threshold is 30 and CI reports it
advisorially while the existing backlog is reduced.

Use Node 22.13 or newer for the pinned analysis engine. The application runtime
is unchanged. Coverage uses the existing `node:test` suite, including Node worker
threads and CLI subprocesses, through [c8](https://github.com/bcoe/c8). Complexity
and function attribution use the public parser and coverage interfaces of the
[CRAP engine](https://github.com/fabian-barney/crap-typescript).

## Commands

```sh
npm ci
npm run test:coverage
npm run crap
```

`npm run crap:snapshot` records the initial reviewed baseline at
`docs/crap-baseline.json`; it refuses to overwrite an existing baseline.
`npm run crap:check` is an optional strict threshold check and exits 2 while any
measured score or labelled pessimistic estimate exceeds 30. It is not the CI
gate yet. Test, parsing, configuration and stale-input failures remain errors.

The current full report is `coverage/crap.json`, the baseline comparison is
`coverage/crap-comparison.json`, and the underlying function/statement/branch
coverage is `coverage/coverage-final.json`. CI publishes these as an artifact.
Generated coverage is ignored by Git and excluded from site uploads.

## Scope and limits

`.c8rc.json` is shared by coverage and source selection. All maintained JavaScript
under `src/`, `cli/`, `tools/`, `web/`, `worker/`, `scripts/`, `warriors/`,
`examples/`, and `modelwar/` is included, even when tests never load the file.
Tests, vendored browser bundles, and the generated warrior conversions in
`warriors/javascript/` and `warriors/python/` are audited exclusions.
Exclusions use directory-prefix patterns ending in `/**`, so the source
inventory and coverage collector can share exactly the same selection.

The report scores named declarations, assigned functions and methods; anonymous
callback expressions are not scored by this parser. It lists files without
scored methods and unsupported languages explicitly. Python/C++ bindings and
shell scripts require separate language coverage/complexity tooling. Redcode is
warrior data evaluated by the VM, and WGSL embedded in JavaScript strings is not
JavaScript control flow. These areas are not claimed to have CRAP measurements.

Function coverage is the minimum of statement and branch coverage. A required
component that cannot be attributed stays unknown. Known unexecuted files count
as zero coverage. Unknown functions retain a null measured score and are ranked
with a labelled zero-coverage estimate, so missing measurements cannot look like
passes. GPU/Python-dependent skipped tests remain gaps in the observed coverage.

The coverage runner fingerprints source, tests, dependency versions and config
before and after the suite. Failed runs invalidate earlier success; CRAP reports
refuse changed source or coverage data. Recollect coverage after code changes.

## Working a hotspot

1. Capture a baseline from the full suite and inspect the highest scores.
2. Reproduce meaningful missing behavior or identify a coherent module to
   simplify. Avoid adding tests that merely mirror the implementation.
3. Add regression coverage or reduce the actual decisions a caller must follow.
   Moving branches into helpers alone is not evidence that the system improved.
4. Run focused checks, then recollect full coverage and regenerate CRAP.
5. Inspect both the original function and added/removed functions in the
   comparison. Keep the baseline; record the change and remaining work below.

## First pass

The baseline was collected on Windows with Node 22.22.3 from `9ec91fb` plus this
analysis setup: 231 source files, 2,037 analyzed functions, 165 flagged above the
threshold (including pessimistic estimates), and 673 with unknown
function coverage. Eight Python/C++/shell files are listed as unsupported.
The baseline suite passed 338 tests and skipped seven. Statement/line coverage
was 59.82%, branch coverage 89.08%, and function coverage 86.95% across the c8
scope; these file-level totals differ from the conservative per-function CRAP
attribution policy.

The first selected improvement is the algebra contract evaluator (`iface`),
whose baseline complexity was 171 and measured CRAP was 412.7. Its combinator
safety rules now live in named policies in `tools/algebra/contracts.js`, with
shared checks for perpetual execution and writes that would erase partners.
The public contract and linker interfaces remain the same. Characterization
checks preserve 1,106 contract results across five dialect profiles and two
torus layouts.

This inspection also found a real hang: an invalid `bomb-paper` process count
reached an unbounded unroll calculation despite already failing range checks.
Invalid parameters now stop before block-specific mismatch calculations, while
retaining leaf metadata needed by direct behavior-gate checks. A subprocess
regression test caught the original timeout and verifies zero, negative,
nonfinite process counts return promptly.

Remaining priorities from the baseline:

| Area | Baseline finding | Next useful work |
| --- | --- | --- |
| Browser rendering | `AvatarView3D.drawWarrior`: CC 69, uncovered, CRAP 4830 | Browser/WebGL behavior coverage, then isolate drawing policies. |
| Browser rendering | `CoreView3D.draw`: CC 40, uncovered, CRAP 1640 | Cover render modes and selection/overlay behavior in a real browser. |
| Browser app | `rulesHint`: CC 39, uncovered, CRAP 1560 | Separate and test the rules-description model from DOM updates. |
| CLI/model integration | `cmdRefine`: unknown attribution, estimate 1260 | Verify coverage attribution and add controlled proposer/CLI scenarios. |
| GPU execution | `appendWarrior` and `runBatch`: unknown attribution | Keep CPU fixtures, add hardware coverage where available; retain unknown labels. |

Final measurements are saved in [crap-first-pass.json](crap-first-pass.json),
with full current results under `coverage/`. The original baseline remains
intact.

| Measurement | Baseline | First pass |
| --- | ---: | ---: |
| `iface` complexity | 171 | 7 |
| `iface` measured CRAP | 412.68 | 7.18 |
| Highest contract-policy CRAP | 412.68 | 31.82 (`checkParallelBoot`) |
| Functions flagged repository-wide | 165 | 165 |
| Source files / analyzed functions | 231 / 2,037 | 232 / 2,053 |
| Statement/line coverage | 59.82% | 59.92% |
| Branch coverage | 89.08% | 89.29% |
| Function coverage | 86.95% | 87.06% |
| Passing / skipped tests | 338 / 7 | 346 / 7 |

The global count has not fallen: the smaller parallel-boot policy replaces
`iface` as the one contract function over 30. Its coverage is 72.73%; targeted
watcher/fallback cases are the next contract task. Every other new policy is
under 30, with three small helper scores still labelled as unknown estimates.
The comparison also shows three small coverage-dependent score increases in
unchanged functions; none crosses 30. The strict check correctly exits 2 for
the remaining backlog, while the advisory report succeeds.

## Second pass

The remaining parallel-boot coverage now checks workers that terminate or move
away from their watchers, a replacement copy landing on the original warrior,
and overlapping copies on a volume. Separate rows, layers and sufficiently
separated positions on the same row are accepted through the public contract
interface; no production contract rule was changed in this pass.

Browser rule suggestions now live in `web/rules-hint.js`. Its public function
accepts a compiler result, current settings, active library metadata and the
completed compatibility result, and returns the suggested settings and text.
Battlefield selection and hill-size diagnostics are separate internal policies.
The arena and hint model share geometry settings in `web/battlefield.js`.

This exposed a user-facing bug: selecting a volume through “Use these rules”
from the '88 hill retained the '88 dialect. Lift then failed on ORG, modifiers
and TRN even though the suggested geometry was correct. Battlefield hints now
clear hill restrictions, as the existing battlefield picker does. The regression
test demonstrates the old failure and compiles Lift successfully using the new
suggestion, including a library-specific volume.

Other tests use real compiler and generator diagnostics for plane warriors,
half-row limits, core assertions and code lengths, and check library compatibility
and suggestion precedence. A separate comparison of 126 old/new hint results
matched apart from the deliberate clearing of hill restrictions. These checks
exercise the browser's model; DOM button wiring and WebGL rendering remain
outside this coverage.

Measurements and both baseline/first-pass comparisons are saved in
[crap-second-pass.json](crap-second-pass.json).

| Measurement | First pass | Second pass |
| --- | ---: | ---: |
| Parallel-boot policy coverage | 72.73% | 100% |
| Parallel-boot policy CRAP | 31.82 | 22 |
| Highest algebra contract-policy CRAP | 31.82 | 27.05 |
| Rules-hint model complexity | 39 in one function | 16 / 13 / 4 across two policies and the public function |
| Rules-hint model measured CRAP | 1560 | 16 / 13 / 4 |
| Shared battlefield helpers measured CRAP | 20 / 6 / 6 | 4 / 2 / 2 |
| Functions flagged repository-wide | 165 | 163 |
| Source files / analyzed functions | 232 / 2,053 | 234 / 2,055 |
| Statement/line coverage | 59.92% | 60.22% |
| Branch coverage | 89.29% | 89.42% |
| Function coverage | 87.06% | 87.14% |
| Passing / skipped tests | 346 / 7 | 355 / 7 |

All six extracted browser functions have measured 100% coverage. The caller
`renderEditorStatus` remains uncovered; passing the completed compatibility
result increases its complexity from 23 to 25 and CRAP from 552 to 650. This
increase is included in the comparison, and DOM behavior remains work to do.
The unchanged `scanLibraryFit` also shows a timing-dependent coverage change
(CRAP 25.58 to 26.13), still below the threshold.

The repository maximum is still the uncovered WebGL drawing function at 4830.
Unknown attribution remains at 673 functions, and eight source files remain
unsupported. The strict check still exits 2 for the 163-function backlog; the
advisory report succeeds. The next substantial rendering pass needs browser
fixtures for real draw modes; a separate CLI pass can cover `cmdRefine` validation
without making paid model calls.

## Third pass

The next targets are `cmdRefine` (CC 35, unknown statement attribution,
pessimistic estimate 1260) and `cmdTune` (CC 13, unknown statement attribution,
estimate 182). These are estimates, not measured uncovered scores.

Two regression tests first demonstrated that invalid input reached warrior
loading: `refine --field-rounds 0` was checked only after field/model/pool setup,
and tuning counts accepted malformed values through `parseInt` and clamping.
Shared local-search validation in `cli/search-options.js` now rejects invalid
counts before loading. Counts must be positive safe integers; zero and negative
tuning counts now produce usage errors rather than being clamped to one.
Refinement also rejects an incompatible `--partner` before loading and derives
push-off hill defaults without mutating the caller's flags.

`cli/refinement.js` owns the refinement command and its presentation. The
existing `cli/devtools.js` export remains available. Model creation and pool
creation can be supplied at the command's seam; production defaults use the
existing SDK proposer and battle backend. Model setup is inside the pool's
`try/finally`, with cleanup checked for setup and output-writing failures.
The tuner reuses `withConstants` when saving a confirmed improvement.

Offline command tests supply a deterministic proposer and retain real compiler,
local hill loading, CPU worker battles, significance checks, and file writes.
They cover successful and unchanged searches, model failures, JSON/text output,
saved logs, push-off partners, and entry limits against relaxed hill settings.
CLI subprocess checks verify exit code 2 for invalid counts. No paid model calls
or external hill fetches are needed. The SDK tool runner itself remains outside
these tests.

Measurements, extracted functions and both historical comparisons are saved in
[crap-third-pass.json](crap-third-pass.json).

| Measurement | Second pass | Third pass |
| --- | ---: | ---: |
| Refinement orchestration complexity | 35 | 4 |
| Refinement orchestration CRAP | Unknown; estimate 1260 | 4.02 measured |
| Refinement validation / reporting CRAP | Included in command | 19 / 12.95 measured |
| `cmdTune` complexity | 13 | 8 |
| `cmdTune` CRAP | Unknown; estimate 182 | 8.03 measured |
| Tuning search engine CRAP | Unknown; estimate 110 | 10.46 measured |
| Functions flagged repository-wide | 163 | 160 |
| Functions with unknown attribution | 673 | 671 |
| Source files / analyzed functions | 234 / 2,055 | 236 / 2,060 |
| Statement/line coverage | 60.22% | 61.02% |
| Branch coverage | 89.42% | 89.50% |
| Function coverage | 87.14% | 87.47% |
| Passing / skipped tests | 355 / 7 | 367 / 7 |

Every added function is below 30, including the unknown-attribution estimates
for the default proposer and two small inline helpers. The option validators
have measured 100% coverage. The unchanged refinement loop has a small
coverage-dependent score increase (31.65 to 31.86); it remains flagged and is
included in the comparison. `formatPostMortem` now has a measured score of 35.50
at 60% coverage, replacing its previous unknown-attribution estimate of 306.
Those two functions are useful follow-up targets; saved tournament replay in
`cmdPushoff` also remains thinly covered. The largest WebGL hotspots and eight
unsupported source files remain. The advisory report succeeds, and the strict
check exits 2 for the remaining 160-function backlog.

## Fourth pass

This pass targets the refinement loop (CC 30, measured CRAP 31.86) and
`formatPostMortem` (CC 17, measured CRAP 35.50).

Failing regressions reproduced incorrect torus reports: the original code was
formatted as scalar ring operands while live core cells used vectors. Untouched
plane/volume instructions were marked as changed, and distinct vector programs
with the same instruction shape could lose their exact program attribution.
The VM and post-mortem builder now share canonical instruction formatting in
`src/engine/disassembly.js`. Tests check intact code, real enemy writes and
process attribution on both planes and volumes, including code crossing a row's
wrap point. Provenance labels also share their loaded/written distinction:
overlapping loaded code now says `(loaded)` instead of `@null`, while a write at
cycle zero still says `@0`.

The outer `postMortem` function already reported 100% measured coverage before
this pass. The geometry-specific content assertions caught a bug that the
existing covered paths did not detect; the score alone did not establish
correctness.

Refinement now rejects empty fields, with a CLI check before model or pool
creation. Previously, a points search could ask a model despite having no
opponents. Missing, null or malformed proposal arrays could then crash outside
the model-error handler, and a null individual draft could crash while recording
its failure. `tools/refinement/proposals.js` owns response validation and bounded
draft screening. Invalid submissions stop cleanly and retain token usage; bad
individual drafts enter history without discarding later valid drafts. An
already confirmed improvement survives a malformed later response.

Loss-report preparation is separate from iteration orchestration, and draft
length validation uses the existing compiler's entry rules. Six valid-response
runs across points and push-off objectives matched the prior implementation's
results, history and usage. Focused engine, torus, report, refinement and CLI
checks passed before full coverage collection. No model API calls were needed.

Final measurements and historical comparisons are saved in
[crap-fourth-pass.json](crap-fourth-pass.json).

| Measurement | Third pass | Fourth pass |
| --- | ---: | ---: |
| Refinement loop complexity | 30 | 25 |
| Refinement loop coverage / CRAP | 87.27% / 31.86 | 93.18% / 25.20 |
| Post-mortem formatter complexity | 17 | 15 |
| Post-mortem formatter coverage / CRAP | 60% / 35.50 | 95.65% / 15.02 |
| Functions flagged repository-wide | 160 | 158 |
| Functions with unknown attribution | 671 | 671 |
| Source files / analyzed functions | 236 / 2,060 | 238 / 2,064 |
| Statement/line coverage | 61.02% | 61.26% |
| Branch coverage | 89.50% | 89.64% |
| Function coverage | 87.47% | 87.35% |
| Passing / skipped tests | 367 / 7 | 380 / 7 |

Both proposal helpers, the shared instruction formatter and its scalar helper,
and the provenance-label helper have measured 100% coverage. Loss-report
preparation has 72.73% coverage and CRAP 5.51; all added functions are below 30.
The CLI wrapper's empty-field guard increases its complexity from four to five
and measured CRAP from 4.02 to 5.02. This increase and the small decline in overall
function coverage remain visible in the report. Statement/branch gains do not
erase those gaps.

The strict check exits 2 for the 158-function backlog. The largest untouched
hotspots are still browser rendering and GPU attribution; tournament save/replay
and validation in `cmdPushoff` remain a useful next CLI target.

## Fifth pass

This pass targets the tournament CLI (`cmdPushoff`: CC 20, measured CRAP 113.22)
and announcement ranker (`pushOff`: CC 40, measured CRAP 40.35).

The CLI is separated into live execution, replay, option parsing and result-file
handling. Its existing export from `cli/devtools.js` remains available. Live
execution reuses the shared hill loader and rejects an empty hill or entry list
before creating battle workers. Malformed counts now fail before warrior loading;
positive counts remain subject to the existing minimum of two rounds/two hill
files, and signed integer seeds (including zero) remain supported.

Announcement options are validated before a tournament starts. Validation is
shared with the engine, so unknown metrics/fields and inherited feature names
such as `constructor` can no longer silently select unintended behavior. The
official rule still overrides announcement-specific options. Distance statistics
and bounded caches now live in `src/engine/diversity.js`, leaving elimination
order and scoring in `pushOff`. Existing golden tests preserve arithmetic and
tie-breaking across all readings, cache isolation, missing-cell handling and the
large-field allocation limit.

Replay reads a result record without constructing battlefield settings, loading
warriors or creating workers. Result files are checked for named warriors, square
finite score matrices, valid win/loss/tie counts when present, and self-fight data
when a reading requires it. Legacy scores-only records, optional entry markers,
and one-warrior records remain supported. Save creates parent directories and
retains the existing record fields; a save failure still closes the battle pool.

An integration test runs a real CPU tournament, saves self-fight results, and
replays all 36 announcement readings without additional matches. Further tests
check JSON/text output, entries below the first 25 displayed rows, relaxed hill
limits versus entry limits, malformed records/options and CLI usage exit codes.
All 51 focused checks passed before full coverage collection. These tests use
local hills and do not fetch opponents from external archives.

The browser entry also bundles successfully in memory with the shared engine
modules. The named distance-statistics function is measured separately from
construction and individual distance calculations, so extracting the model does
not hide its control flow inside an unscored returned callback.

Final measurements and comparisons are saved in
[crap-fifth-pass.json](crap-fifth-pass.json).

| Measurement | Fourth pass | Fifth pass |
| --- | ---: | ---: |
| Tournament command complexity | 20 | 8 |
| Tournament command coverage / CRAP | 38.46% / 113.22 | 95% / 8.01 |
| Announcement ranker complexity | 40 | 12 |
| Announcement ranker coverage / CRAP | 93.98% / 40.35 | 100% / 12 |
| Largest extracted distance-model CRAP | Included in ranker module | 19.01 |
| Functions flagged repository-wide | 158 | 156 |
| Functions with unknown attribution | 671 | 671 |
| Source files / analyzed functions | 238 / 2,064 | 241 / 2,076 |
| Statement/line coverage | 61.26% | 61.62% |
| Branch coverage | 89.64% | 89.88% |
| Function coverage | 87.35% | 87.16% |
| Passing / skipped tests | 380 / 7 | 392 / 7 |

All added functions are below 30, including labelled unknown estimates. Option
and record validation have measured 100% coverage. Distance construction,
statistics and individual distance calculations score 16.01, 12.09 and 19.01.
The individual distance function itself moved unchanged: the grouped comparison
for `pushoff.js:dist` reflects the move to `diversity.js`, not a reduction of its
own complexity. No existing method groups show a score increase. The decline in
overall function coverage remains recorded alongside statement/branch gains.

The strict check exits 2 for the 156-function backlog; the advisory report
succeeds. Browser rendering and GPU attribution remain the largest outstanding
areas. The browser bundle check verifies module compatibility, not rendering
behavior.

## Sixth pass

The browser highlight pipeline is the next target: `Highlights.ingest` had
CC 24, no measured execution and CRAP 600; `Highlights.draw` had CC 7 and
CRAP 56. Four failing regressions reproduced a lost first decay interval when
the initial timestamp was zero, a kill suppressed by an earlier write's
cooldown, overlapping effects on one cell after cooldown, and duplicate kills
consuming the frame budget so other cells never received an effect.

`web/highlight-model.js` now owns heat, event eligibility, sampling and effect
lifetimes. `Highlights` retains its existing entry point as a Canvas adapter
over that model, so both arena views keep their projection-based draw interface.
Every valid event contributes heat, while eligible unique cells consume the
display budget. A cell's first kill supersedes its write event, a visible kill
keeps its full lifetime, and a refresh replaces the previous effect. Cooldowns
are derived from visible effects, eliminating the separate historical busy map
and stale cooldowns for effects evicted by the cap.

The existing durations and budgets remain: 650 ms for writes, 900 ms for kills,
24 new effects per frame, and 140 visible effects. Writes are sampled across
eligible unique cells after giving kills priority. Invalid or incomplete event
records are ignored; packets stay flat during selection and only displayed
effects allocate effect objects. Heat still decays with a 1.5-second half-life.

Twenty-one focused highlight/avatar tests passed, including real VM write and
death packets delivered on successive frames, burst fairness, cooldown/expiry,
reset, effect caps, heat thresholds, invalid packets, and Canvas command output.
The Canvas checks verify projection skips, fallback colors, alpha restoration
and finite flash/spark coordinates. They are command-contract tests, not browser
pixel or WebGL tests. The full browser entry also bundles successfully in memory.

Final measurements and comparisons are saved in
[crap-sixth-pass.json](crap-sixth-pass.json).

| Measurement | Fifth pass | Sixth pass |
| --- | ---: | ---: |
| Highlight ingestion complexity | 24 | 5 |
| Highlight ingestion coverage / CRAP | 0% / 600 | 100% / 5 |
| Canvas highlight drawing coverage / CRAP | 0% / 56 | 100% / 7 |
| Highest new model-policy CRAP | Included in ingestion | 14 |
| Functions flagged repository-wide | 156 | 154 |
| Functions with unknown attribution | 671 | 673 |
| Source files / analyzed functions | 241 / 2,076 | 242 / 2,080 |
| Statement/line coverage | 61.62% | 62.14% |
| Branch coverage | 89.88% | 90.00% |
| Function coverage | 87.16% | 87.29% |
| Passing / skipped tests | 392 / 7 | 406 / 7 |

All model policies, ingestion, reset/hottest and Canvas drawing have measured
100% coverage. The constructor and `active` getter remain statement-unattributed,
with labelled estimates of two each; those rows increase the unknown count.
Every added function is below 30, and no existing method groups show an increase.

The strict check exits 2 for the 154-function backlog; the advisory report
succeeds. Avatar and core rendering, browser app orchestration and GPU attribution
remain larger outstanding areas. Canvas command coverage does not imply that
those rendering paths or browser pixels have been validated.

## Seventh pass

The flat avatar view is the next browser target. `AvatarView.drawAvatar` had
CC 38, no measured execution and CRAP 1482. The frame, projectile, glyph, eye,
impact and floor methods, idle-animation getter and spine generator were also
over the threshold because the view had no tests.

`web/avatar-layout.js` now owns deterministic body geometry and positioning.
Per-part appearance, damage, selection rings and hit regions are grouped in
`drawBodyParts`; `drawAvatar` composes them with the body halo, links, ghost and
process orbits. The main drawing method's complexity falls from 38 to 17, and
per-part painting has complexity 14. The clock can be supplied to the view for
deterministic tests; production continues to read `performance.now()`.

Failing regressions reproduced death at timestamp zero being mistaken for a
missing timestamp, conversion smoothing advancing without elapsed time, equally
close overlapping parts selecting the earlier-drawn part, and small pointer
moves rotating the camera without being recognized as a drag. Shared avatar
timing now uses explicit unset values, death state applies immediately, hit-test
ties select the later-drawn part, and drag classification uses displacement
from pointer-down. A hit at time zero can shake the flat body; a held pointer at
coordinate zero and pending impacts also keep the view animating.

Projectile regressions caught another wall-clock issue: a delayed frame could
turn an old flight into a fresh impact and body flash. Landing timestamps now
come from the scheduled flight deadline, and effects past their lifetime are
discarded. Expired impacts are removed before painting, once per frame.

Thirty-eight focused view/model/highlight tests passed. Real VM scenarios cover
all damage classes, conversion ghosts, captive/away processes, off-body hits
and kills, and projectile landing/expiry. Command checks cover all opcode glyphs,
finite coordinates and alpha, death collapse, projection and scaled hit testing,
pointer lifecycle, pixel-density limits and selection. The browser entry bundles
in memory. These checks exercise Canvas commands and model state; they do not
validate browser pixels or WebGL rendering.

Final measurements and comparisons are saved in
[crap-seventh-pass.json](crap-seventh-pass.json).

| Measurement | Sixth pass | Seventh pass |
| --- | ---: | ---: |
| Main avatar drawing complexity | 38 | 17 |
| Main avatar drawing coverage / CRAP | 0% / 1482 | 95% / 17.04 |
| Frame drawing coverage / CRAP | 0% / 272 | 92.59% / 16.10 |
| Projectile drawing coverage / CRAP | 0% / 240 | 100% / 16 |
| Spine generation coverage / CRAP | 0% / 110 | 100% / 10 |
| Functions flagged repository-wide | 154 | 145 |
| Functions with unknown attribution | 673 | 677 |
| Source files / analyzed functions | 242 / 2,080 | 243 / 2,082 |
| Statement/line coverage | 62.14% | 64.24% |
| Branch coverage | 90.00% | 90.19% |
| Function coverage | 87.29% | 87.70% |
| Passing / skipped tests | 406 / 7 | 423 / 7 |

All nine targeted functions now fall below 30, as do the extracted policies.
`drawBodyParts` scores 14 and `positionAvatar` scores 9, both with measured
100% coverage. The stale-flight guard raises `drawFlying` complexity from 15
to 16 while its measured coverage reduces CRAP from 240 to 16. `hash` and
`spine` moved files; their addition/removal entries reflect that move.

Four rows now have statement-unattributed coverage: `hash`, `colorOf`, `up`
and `consumeDrag`. Each retains a labelled pessimistic risk estimate of two;
none is presented as measured coverage. The sole existing method-group score
increase is unchanged `tools/genes.js:turn`: 2 to 2.5 as measured coverage
changed from 100% to 50%, with complexity still two. This run-to-run coverage
variation is retained in the comparison.

The strict check exits 2 for the remaining 145-function backlog; the advisory
report succeeds. Maximum risk remains 4830 in uncovered WebGL drawing, and
eight non-JavaScript files remain unsupported. Canvas command checks leave
browser pixel appearance and GPU behavior for separate validation.

## Goal: maximum risk 250

The next goal is a repository-wide maximum per-function risk of 250, including
labelled pessimistic estimates for unknown coverage. This does not change the
existing advisory threshold of 30 or exclude previously scored source files.
The seventh-pass report starts this goal with 20 functions above 250.

### Eighth pass: 3D avatar drawing

`AvatarView3D.drawWarrior` previously scored 4830 (CC 69, unexecuted).
It now composes slot positioning, conversion appearance, damage painting,
supports and process orbits. Slots remain the shared source for hit testing
and projectile endpoints. Frame event handling and nearest-opponent facing
also have their own internal methods, preserving their ordering before drawing.

Eighteen characterization cases compare mesh commands, transforms, colors,
hit slots and body height against the pre-refactor implementation. These use
real Three.js math and shape drawing with GPU submission replaced by a recorder.
Recorded values are rounded to six decimal places before hashing. Scenarios
cover every glyph and damage class, early/mid/late conversion with different
body lengths, collapse, capture, map height and process orbits. Three additional
tests verify flight caps, immediate kills and focus timing, nearest living
opponent selection, short-angle turning and map/cloud switching.

All 21 focused tests and the browser bundle pass. These are scene-command
checks; no browser pixel, native WebGL or GPU performance claim follows from
them. The full suite passed: 445 passed, seven skipped, no failures. Statement/line
coverage is 65.75%, branch coverage 90.30%, and function coverage 85.38%
(down from 87.70%; importing the 3D module exposes more unexecuted functions).
Flags above 30 fall from 145 to 141, functions above the goal of 250 fall from
20 to 17, and maximum risk falls from 4830 to 1640. Unknown attribution rises
from 677 to 734: unexecuted methods in the imported module now have missing
branch attribution, and retain pessimistic estimates. The sole increased
existing group is scanLibraryFit, 25.58 to 26.13 through coverage variation.
Detailed targets and comparisons are in [crap-eighth-pass.json](crap-eighth-pass.json).

### Ninth pass in progress: core rendering

CoreView3D drawing now composes camera updates, depth-sorted cell collection,
cell painting, processes, follow trails and overlays. Twelve comparisons with
the original implementation pass, using real VM state on rings and volumes,
box/torus views, all slice axes, camera following and selection.

Four new first-frame checks failed on CoreRenderer: it captured cell size and
column count before layout, producing non-finite coordinates or stale sizes.
Those values are now read after layout. Drawing a fresh view matches drawing
a view explicitly laid out first, on rings and volumes at two widths. All 16
focused tests pass. Full coverage/report refresh is pending grouped changes.

The assembler differential fuzzer now uses pmars-programs.js for seeded grammar
generation and pmars-comparison.js for outcome classification. Its process
execution, campaign file writes and reference-failure accounting stay in the
command. Twelve characterization cases compare 200 generated programs each
against the original seed stream (88/94, small/standard cores and three seeds).
A comparison test covers crashes, accept/reject differences, deliberate empty
program exclusion, length/instruction/start mismatches and out-of-range starts.
All 13 fuzzer checks pass without launching pMARS. This verifies generation
and classification, not a new external pMARS compatibility campaign.

GPU host preparation now separates warrior packing, cached pipeline creation
and bounded interpreter dispatch. Public pool tests use a recording device
adapter to check pipeline reuse, solo measurements, dispatch caps and buffer
destruction after success, shader errors, readback errors and budget exhaustion.
Packing checks cover string/numeric instruction forms, bit fields, modular
values, torus entry points and invalid records. Shader-generation checks cover
match, solo and one/four-warrior live modes on rings and volumes, retaining
full-output hashes and checking layout constants. All 14 focused GPU tests
pass. These tests verify host behavior and generated WGSL; they do not execute
WGSL on hardware. Native GPU tests retain their existing opt-in gates.

Browser presentation now separates renderer choice/control labels and editor
status/generated listings from page orchestration. Decision tests cover ring,
plane and volume defaults, explicit view overrides, flat avatars and WebGL
fallback. Editor checks cover escaped metadata/diagnostics, warning counts and
normalised/generated/failed output. Generator execution has its own module;
real Redcode/JavaScript compilation and injected Python loading checks retain
hang-marker ordering, current settings after downloads, skipped hung sources
and bounded exception diagnostics. Six focused browser tests and the full
browser bundle pass. Compilation publication still uses the slot token guard;
calling the extracted async helper adds a microtask before publishing a
synchronous compiler result. Page DOM integration remains outside these tests.

Frame policy separates fractional step budgets, live-epoch cancellation and
paused redraw cadence. Inspector drawing separates neighboring rows from
loaded/written/empty-cell provenance. Startup separates linked archive setup
from local saved/library slot restoration. Five additional focused checks pass
using real VM inspector state and startup dependency adapters; they cover
archive precedence, opponent fallback, length/minimum-distance rules, saved
state invalidation and default slots. The full browser entry bundles. All app
functions now have static complexity at most 15; coverage remains pending.

The final grouped CLI changes separate per-round battle printing, conversion
artifact output and instruction-evolution option parsing. New tests exercise
the public battle and conversion commands, compare written conversion code
with JSON/stdout, and validate evolution defaults, numeric limits and invalid
policy combinations before resources load. Existing evolution CLI tests also
pass. The complete focused set passed before starting full coverage; final
repository scores and coverage freshness remain to be verified.

### Final ninth-pass measurement and 250-goal audit

The full suite passed: **504 passed, seven skipped, zero failures** (511 total).
The browser entry bundles successfully. The fresh coverage manifest matches
the current source/test signature and the coverage artifact hash. The report
analyzes **2,118 functions**, including **716 unknown-coverage rows** whose
pessimistic estimates remain included. Every risk value is finite and at most
250: **maximum 240, zero above 250**. All 20 initial above-goal hotspots are
accounted for in [crap-ninth-pass.json](crap-ninth-pass.json), alongside moved
and extracted methods and the complete comparison.

| Measurement | Eighth pass | Ninth pass |
| --- | ---: | ---: |
| Maximum function risk | 1640 | 240 |
| Functions above 250 | 17 | 0 |
| Functions above advisory 30 | 141 | 123 |
| Unknown coverage attribution | 734 | 716 |
| Statement/line coverage | 65.75% | 69.63% |
| Branch coverage | 90.30% | 90.44% |
| Function coverage | 85.38% | 87.50% |
| Passing / skipped tests | 445 / 7 | 504 / 7 |

No existing method group has a score increase from the eighth-pass report.
The largest remaining risks (240) include unexecuted browser conversion and
unknown-attribution GPU/live and projectile methods. These are estimates or
unexecuted measurements, not evidence of browser or GPU execution. Eight
non-JavaScript source files remain unsupported, and anonymous callbacks and
embedded shader/Redcode strings retain the documented parser scope.

The advisory report succeeds. The strict 30-point check still exits 2 for
the 123-function backlog; the separately audited maximum-250 goal is met.
The original baseline and threshold are retained. Work remains uncommitted
on codex/crap-repo; no merge or publication was performed.

## Goal: maximum risk 100

The next goal retains the same source scope, original baseline and advisory
threshold of 30. It includes every reported risk and pessimistic unknown
estimate. The fresh ninth-pass report starts with 38 functions above 100 and
a maximum of 240; the starting rows are in crap-100-goal.json.

### Tenth pass in progress: live GPU host

Live session setup separates VM eligibility and resource ownership. A failed
allocation, upload or bind-group setup now destroys earlier buffers before
propagating the error; previously they leaked before the session owned them.
Four host tests drive the public engine/session interface with a recording
device whose snapshots are generated by a separate real CPU VM. They check
snapshot publication, pipeline reuse, input validation, setup rollback, map
failures, close during readback, serialization, tracing rejection and capacity
limits. This verifies host orchestration and codec integration, not WGSL
execution or hardware behavior. Final full-suite coverage and risk audit are
pending the complete maximum-100 batch.

Seven new headless 3D scene tests exercise real Three.js geometry, materials,
instanced mesh buffers, maps and the actual view frame orchestration. They
cover ring/floor/cloud/torus views, process tracking, hit selection, camera
focus/user override, projectile kinds and minor impacts, particle/ring/light
lifetimes and long-body helix slots. Submitted transforms/colors are finite
and instance counts remain within capacity. No WebGL renderer or pixels are
executed. A deterministic failing regression reproduced repeated timestamp-zero
frames advancing scene time from 0.016 to 0.032. The view now accepts an optional
clock and uses a null initial timestamp, with negative elapsed time clamped.
All 37 focused scene/live-host checks pass with one native GPU test skipped;
the browser bundle passes. Full risk measurement is still pending.

Redcode vocabulary/tokenization/document names now live in redcode-language.js,
shared with editor completion. Tests drive the installed CodeMirror StringStream
through every opcode, modifiers, labels, directives, constants, comments,
metadata, punctuation and line resets. Encyclopedia content is separate from
fetching/filter DOM setup; its annotation and card checks cover all three
languages, field geometry, escaped metadata, conversions and matchup ranking.
A failing comment regression reproduced an escaped-backslash/closing-quote
sequence swallowing a following comment; string parsing now consumes escape
pairs so quote state is correct. All three text tests and both arena and
encyclopedia bundles pass. Editorial HTML content remains rendered as before.

Browser round lifecycle now has a single live-action controller owning step
publication and finish scheduling. Replay preparation builds and advances a
private VM before returning it for publication. Compilation publication retains
the token guard and imported-name handling. New tests check replacement during
advance, error cleanup, external cancellation, finish yielding, deterministic
replay and cancellation during its yield. Round-end messages, library switch
prompts and conversion slot/status behavior have independent presentation
policies. Tests cover winner/solo/tie messages, touch/replay text, field/rules
prompts, append/replace/cancel conversion paths, origin metadata and button
cleanup. The 12 lifecycle/compile/presentation checks and browser bundle pass.
Every function left in app.js now has static complexity at most nine; actual
coverage and reported risks remain pending the full batch verification.

Maintenance helpers are separated from command startup: archive cache access
validates origin/redirects, receipt paths and hashes, retries and response
limits; replay differences retain first-path diagnostics; pMARS input loading
filters classic library entries and only .red fixtures. That filter fixes
JavaScript/JSON fixture helpers being treated as Redcode. Offline tests cover
cached/tampered/missing sources, rejected redirects/HTML/oversize/error responses,
fixture filtering and unavailable archive entries. Fuzzer mutation moved into
the seeded grammar module; 900 mixed generation/mutation results match the
original RNG streams. Experimental Lifeboat/Compass scripts are executed under
the real generator interface with their actual file names, default output is
compared with generateFromJS, and flag variants compile under 94x. Riptide
variants compile under exact 88 rules. All eight new maintenance/generator
tests pass; existing grammar tests remain part of grouped verification.

Conversion emission separates FOR count/scope/disabled-block handling from
node dispatch. Before/after hashes match every library conversion candidate
in JavaScript and Python. Compile/check and trace CLI tests cover JSON/text,
compile errors, and DAT/division death diagnostics. Instruction evolution now
separates opponent/gene preparation; tree and block commands separate options
and seed/profile validation from running searches. New setup tests exercise
defaults, tuning seeds, invalid combinations, scratch holdouts and partner/king
handling; the existing evolution CLI tests pass. Experimental standalone
generators separate parameter validation from emission while remaining
self-contained. Picking/tracking checks cover floor/cloud cells, missing
endpoints, nearest-process lineage, trail limits and camera wrap snapping.
Grouped full coverage and the maximum-100 audit follow these focused checks.

The first full tenth-pass run completed 541 passing tests and seven skips,
but failed one existing hang-regression test: its three-second spawn timeout
included module startup under coverage. The guard now starts a separate
processing deadline after a ready signal, retains a bounded startup deadline,
and is tested with delayed startup and a real synchronous infinite loop.
Two moved script imports were also restored below their shebangs; all selected
source files parse successfully. Diagnostic-only coverage from the failed run
identified one remaining risk above 100: cmdEvolveTrees at 117.48. Its human
reporting is now separate from search/JSON orchestration and has direct tests
for placements, aimed experiments and counter summaries. The failed run is
retained as an attempt log and is not used as passing goal evidence.

### Final tenth-pass measurement and maximum-100 audit

The second full run passed: **544 passed, seven skipped, zero failures**
(551 total). The current source/test signature, coverage artifact hash and
recorded JSON fixture hashes match the collected batch. All **2,150 reported
functions** have finite risk values at or below 100, including **701 rows with
unknown attribution** and their pessimistic estimates. The maximum is
**99.24** (instruction-evolution onRound), followed by VM.execute at 93.13.
All 38 starting hotspots are mapped to current methods in
[crap-tenth-pass.json](crap-tenth-pass.json), with moves explicitly identified.

| Measurement | Ninth pass | Tenth pass |
| --- | ---: | ---: |
| Maximum function risk | 240 | 99.24 |
| Functions above 100 | 38 | 0 |
| Functions above advisory 30 | 123 | 91 |
| Unknown attribution | 716 | 701 |
| Statement/line coverage | 69.63% | 73.29% |
| Branch coverage | 90.44% | 91.01% |
| Function coverage | 87.50% | 89.54% |
| Passing / skipped tests | 504 / 7 | 544 / 7 |

Three existing groups have higher scores: the 3D animating getter rises from
56 to an unknown-coverage estimate of 90, and applyMap from 18 to a measured
20, after adding the clock fallback. Unchanged scanLibraryFit rises from 25.58
to 26.13 through different measured coverage. These increases are retained
in the comparison; all remain below 100.

The advisory report succeeds. The strict check still exits 2 for the existing
91-function backlog above 30. The original baseline, source scope and 30-point
threshold remain intact; the separately audited maximum-100 goal is achieved.
Eight non-JavaScript files remain unsupported. Anonymous callbacks/embedded
languages retain the parser limits, and headless scene/device tests do not
prove browser pixels or native GPU execution. Both browser entries bundle,
and all selected source files parse. Changes remain uncommitted on
codex/crap-repo.
