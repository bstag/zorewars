# Full phase verification and useful work observation

The algebra now shares full-round phase checks and read-only work observations. The first adapters cover a stone/imp example: its MUL quickscan, two-stream burst, self-switching stone/clear and compact growing imp pump. This makes the earlier experimental checks reusable without changing warrior instructions.

## Run the checks

The compact pump loads normally. In PowerShell:

```powershell
node scripts/algebra.js recipe fanboot-stone-imp-example --tree-out example.tree.json --json
node scripts/algebra.js observe example.tree.json --rules 94nop --length 100 --json
node scripts/algebra.js explain compact-imp-pump --json
```

`build --verification full` runs intrinsic checks, all existing planted/combinator scenarios and declared phase contracts through the rule set's cycle limit. For94nop that is80,000 cycles. The existing `quick` default remains a bounded intrinsic gate, currently20,000 cycles for growing generic assemblies. Quick verification is not a claim about the final phase.

`observe` reports actual work in a solo run. `--base 7993` checks a wrapping load position. `--opponent warriors/stunner.red` observes a battle with an opponent; `--cycles` selects an observation horizon and `--out` saves the JSON report. Battle observation is diagnostic and is not a promise to survive an opponent. It cannot be passed to `verifyPhases` as solo validation.

The JavaScript interface is:

```js
const built = buildTree(tree, {
  rules: '94nop', length: 100, verification: 'full'
});
const { observation } = observeTree(built, {
  opponent: compiledOpponent,
  positions: [0, 4000], firstTurn: 0
});
```

The public functions are exported from `tools/algebra/index.js`. `createObservation` also attaches to an existing VM for a `before → step → after` loop; `finish` returns the report and restores the original resolver. Disposing an older observer cannot detach a later one.

## What is verified

The existing gate still checks compilation, composition, entry/branch behavior and each block's intrinsic watcher. Full mode extends the horizon and applies declared role checks:

| Role | Full phase promise |
|---|---|
| Self-switching stone/clear | Observed natural handoff, at least100 healthy clear writes, no observed clear writes into its own active block, and a live process in a healthy clear loop at the end |
| Compact growing pump | At least2×N intact launch attempts, an observed compatible imp execution, at leastN compatible imp processes at the end, and either an intact pump or permitted friendly retirement |

Active pump recovery and the correctness of its launch-target sequence remain intrinsic watcher requirements. Retirement requires actual feeding and the first structural fault to be a friendly write from outside the pump; later friendly writes cannot relabel an initial foreign or internal fault.

Parent combinators may deliberately permit a block to stop or leave a branch unselected. Reports expose those exceptions. Required blocks cannot silently remain unentered. Blocks without observation adapters or declared phase contracts are listed in coverage; full horizon does not invent a clear requirement for a paper or claim that every library block now has a phase model. The first coverage is four observed roles and two additional phase contracts for the current assembly.

The100-write minimum is the stone's declared phase requirement, not a global optimization target. Competitive fitness is still full-field points. Earlier experiments also used stronger fixture-specific admission checks; those are not silently applied to every warrior family.

## What the observer measures

The observer calls the VM's normal operand resolver exactly once per operand. It records effective addresses and source instruction snapshots in execution order, including predecrement and postincrement effects. Work counts therefore use actual copy destinations rather than manually reconstructed pointers.

Each observed block reports its resolved location, first entry, phase-event times, work counts, distinct targets, first and last work cycles and the first structural deviation from known mutable forms. Where available, provenance retains the damaging writer's instruction as executed, rather than assuming the instruction still at its address later is the same one.

Times are the cycle of the executing instruction before the VM advances the round counter, matching execution-trace convention. An older report sampled after stepping can differ by one cycle. Phase events are first observations, not a single global state machine: bombing processes can coexist with clearing processes.

The pump additionally distinguishes compatible carpet copies from other copies, intact launch attempts, compatible imp executions, the first template change and the first loss of template compatibility. Compatible instruction shape is not full process ancestry. A damaged remnant can still perform useful work, so the report does not classify every late pump-address instruction as waste.

The interface offers read operations and reporting operations to block adapters. It does not expose VM mutation to those adapters. Controlled `observeTree` injections are explicit host-side test inputs, scheduled once at a cycle and absolute core address; they are not instructions added to the warrior.

## Current warrior measurements

These figures describe the normal solo run at load position zero, not a battle win rate:

| Measurement | Observation |
|---|---:|
| Unique quickscan locations |24|
| Quickscan releases to the burst |13|
| No-hit burst releases to the boot |15|
| Stone first enters |38|
| Pump first enters |59|
| First compatible imp execution |149|
| First permitted friendly pump retirement |3,937|
| Natural handoff copied into the stone loop |4,258|
| First healthy clear write |4,464|
| Healthy clear writes |35,581|
| Distinct clear targets |7,923|
| Last healthy clear write |79,998|
| Compatible imp processes at the end |12|

The pump made34 intact launch attempts and36 compatible carpet copies before retirement. Attempts are not claimed as34 independently proven successful descendants. Actual execution and compatible end-state counts are separate observations.

Its template first changed at cycle3,790, when its immediate-source A field changed while stride remained1,143. The first stride damage was not until13,746. A template mutation is therefore not automatically the loss of the imp formation. The stone continued making some bombing writes after its first clear event, confirming overlapping process phases.

## Faults that the new checks distinguish

Overwriting the clear writer with DAT at25,000 leaves the whole warrior alive with26 compatible imp processes, but normal clear writes stop at24,998. The full phase check rejects it because no healthy clear process remains. The ordinary20,000-cycle gate cannot see that later fault. This test exercises the actual full builder path as well as standalone observation.

Redirecting the clear's pointer into its own block at25,000 produces three actual self writes even though the pointer cell itself remains outside the block. Full phase validation rejects those writes and the lost clear. This is why checking the effective destination matters.

Both faulty versions have more compatible imp processes than the healthy run's12. A tuner or verifier that rewards that count alone would learn the wrong objective. Offense and insurance require separate promises and measurements.

Six saved battle cases against Twin Storms, Jinx2, Swarm and Shrink reproduce their previous outcomes and ending cycles. Observed and unobserved executions also match complete core/provenance arrays and process queues. These cases include zero healthy clear writes in selected losses and only a few writes in others. They explain lost offense; they do not estimate full-field prevalence or demonstrate a new strength gain.

## Knowledge for tuning and future blocks

The block definitions now store the following learned distinctions for `explain` and future tooling:

- Scan factor, pair gap and linked table layout belong together; safe distinct locations do not alone establish useful combat coverage.
- Burst count, step, offset and stream gap define one window around a detected cell. Count also consumes deployment time on a hit.
- Stone STEP/HOP couple to handoff, clear-reset field and boot/process geometry. The emitted reset value HOP+1 is derived.
- Stone STREAM changes DJN addressing semantics. STREAM1 is the retained one-operand improvement; its quiet timing is identical to STREAM0, so quiet-work totals do not explain its field gain.
- Imp LEAD is spatial. With a fixed linked layout, HOPB−d and LEAD+d preserve the first seed. Recompute the linked address after changing layout.
- Seven-point stride1,143 and launcher increment1,144 derive from the8,000-cell core; do not mutate them independently.
- Worker allocation changes scheduling. The additional stone worker delayed first compatible imp execution in the tested assembly; entrant counts do not predict times by themselves.
- RETIRE is a verification permission and K is inactive with fanboot SPLIT1. They are not ordinary numeric strength genes.
- Fanboot EXACT is also validation-only. It permits close copies only after linked overlap checks including rounded tails and entry jumps; it does not prove later friendly-fire safety.
- A valid retirement, an immediate-mode A-field change, a damaged stride, a dead clear and a surviving imp cloud are different facts.
- The reserve, timed-handoff, second-writer, decoy and lead65 experiments remain scoped evidence. Do not rename a rejected adaptation as a proven recovery mechanism or turn one hill result into a universal blacklist.

Adding another block adapter means declaring its own useful events and optional phase contract. Test it through the same observation and build interfaces, including a failure that remains alive, wrapping addresses and observer/no-observer state parity. Keep new role coverage explicit. Complete ancestry tracking, a general dependency-aware mutation engine and new combat recovery blocks remain separate work.

## Audit the checker when compatibility is uncertain

A rejection identifies a declared role/scenario failure under a particular implementation. It does not establish universal incompatibility. Check semantic equivalence, completed deployment, permitted retirement and surviving useful work before treating a changed cell as damage. Distinguish legality, quiet purpose, artificial stress and competitive performance.
