# Reproducible paired warrior comparisons

Run from the repository root:

```sh
node scripts/compare-warriors.js path/to/comparison.config.json --out evolved/comparison
```

The CLI accepts two Redcode sources, optional matching algebra trees, a compiled opponent snapshot, and either saved full-field evidence or a fresh evaluation configuration. It changes no warrior. Paths resolve relative to the configuration’s `baseDirectory`.

## What is automated

1. Validate compiled subject images, optional trees and historical source witnesses. Hash sources, compiled images, opponent order/images, evidence, settings and implementation.
2. Pool opponent scores across evidence seeds. Select the strongest gains, strongest regressions and nearest-zero controls, with opponent index breaking ties.
3. Replay every round of each selected opponent on the CPU, preserving load positions and first mover. Reject any mismatch in historical W/L/T totals.
4. Select the largest positive and negative round changes for each non-control opponent, breaking ties by seed and round. Trace the first unchanged round for a control when available.
5. Separate static instruction differences, executed instruction differences, effective address differences and process-control differences. Observe changed memory, later opponent instruction fetches, operand values and indirect pointer reads.
6. Record per-actor activity in fixed cycle windows, including MOV/comparison execution, SPL attempts, admitted children, deaths and execution of foreign-owned instructions. Algebra trees additionally supply the existing phase and useful-work observations for the subject.
7. Compare each observed execution with an unobserved execution: complete core values and provenance, queues, counters, deaths, engine contacts and outcome must match.
8. Optionally replay selected contacts with their changed fields restored after the writing instruction. These separate host interventions probe sensitivity; they are not a warrior implementation.

## Files and frozen reproduction

`report.html` is the readable review; `report.md` explains the method; `report.json` contains compact machine results. `matches/` stores all selected round plans and transition counts. `cases/` stores detailed contacts, activity, role observations and rollback results. `manifest.json` records provenance. An existing output directory rejects different inputs or implementation instead of silently mixing experiments.

The output also freezes both sources, optional trees, all compiled opponents and normalized evidence under `inputs/`. To reproduce without the original source/cache/evidence paths:

```sh
node scripts/compare-warriors.js evolved/comparison/replay.config.json --out evolved/reproduced
```

The repository implementation and named bundled draft blocks are still required. Output fingerprints differ when configuration paths change; compare field results, selection and case traces rather than expecting directory manifests to be byte-identical.

Verify the reproduction automatically:

```sh
node scripts/verify-warrior-comparison.js evolved/comparison evolved/reproduced
```

This checks the implementation, field and selection, every selected round plan, complete case traces and rollback controls, then writes `reproduction-verification.json` into the reproduced output.

For a new comparison, omit `evidence` and `normalizedEvidence` and supply `evaluation`, for example `{"backend":"cpu","threads":4,"rounds":20,"seeds":[101,202],"seedStride":7}`. GPU evaluation is optional; selected replay and diagnostic execution remain CPU checks. Historical evidence entries require `file`, `baselineId`, `candidateId`, and source witnesses when their metadata differs from the subject snapshots. See the worked config for the complete shape. An opponent snapshot is an array of `{id,name,w:{start,instructions}}` records; instruction fields are `op,mod,aMode,a,bMode,b`.

## Interpretation and limits

A changed cell, a later use and a strategic consequence are separate evidence. A decrement touching an enemy-owned cell does not establish that scanning or replication stopped. MOV/comparison counts are activity proxies, can include foreign code, and stop when the round ends. They are not a general classifier of enemy useful work or a complete process ancestry trace.

The observer tracks the latest changed writer per field, not full propagation of derived values. Aggregate counters are uncapped; retained detailed contacts are bounded by `earlyLimit` and `usedLimit`, and the report exposes saturation. `executedChangedCells` counts write versions later executed, not distinct addresses. Results are diagnostic examples deliberately selected from extremes, not a prevalence estimate for the whole field.

A rollback restores only the chosen changed fields after the instruction. It leaves other changes, ownership/provenance and already resolved effects in place. A changed outcome demonstrates sensitivity to that intervention; an unchanged outcome does not prove irrelevance. Contacts overwritten again within the same instruction are skipped if their saved post-write fields no longer match.

Current scope is two-warrior ring rounds without P-space. Historical evidence lacking an opponent-set hash retains that gap explicitly: row identities and exact selected replay totals are checked, but do not prove historical byte identity for every unselected opponent.

## Verification

```sh
node --test test/comparison.test.js test/comparison-probe.test.js test/algebra-observation.test.js test/algebra-field-stream.test.js
```

Fixtures cover observer neutrality with pre/postincrement and self-modification, pointer dependencies, rollback outcome sensitivity, unused operand data, admitted versus attempted splits, changed empty cells, newly installed DAT kills, lifecycle restoration, deterministic balanced selection, frozen-input reproduction and rejection before stale inputs can be overwritten.

## Matched factorial and component controls

`tools/comparison/factorial.js` exports `summarizeMatchedFactorial(record,definitions,dimensions)`. It validates declared grid identities, opponent order and counts, retains missing measured cells as missing, and computes contrasts from paired per-opponent scores. Pair interactions subtract both singles and restore baseline. Total nonadditivity subtracts all singles and restores two baselines; pure three-way interaction additionally subtracts all pairs and restores all singles. These answer different questions. Sensitivity bounds preserve correlations among the same opponent's scores; they are not independent-seed confidence and are not multiplicity corrected.

The same study replays five selected opponents' paired80-round totals exactly and checks18 observed/unobserved trace states. Selection includes both improved and worsened directions. Keep these examples separate from whole-field prevalence and causal isolation.

## Three-entry matched placement

`scripts/compare-placement-entries.js CONFIG --out DIRECTORY` is the fixed current/combined/seed-only placement follow-up. It verifies all603,351 archive pair rows, reconstructs totals, checks the original engine/program/settings hashes and plays every new entrant matchup at the archive's ten-round resolution. Each subject independently joins the archive; all opponents receive their new matchup points before the entrant is ranked. This is not simultaneous insertion of the three subjects.

## Launcher source damage
