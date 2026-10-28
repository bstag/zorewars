# Molting 94x laboratory

`molting.js` is an experimental, tunable generator. It emits 27–31 Redcode
instructions for the 55,440-cell 94x ring. It needs no P-space and fits a
50-instruction competition limit. It is deliberately outside the standard
warrior library. Main's evolver, tuner and defaults are unchanged.

The opening bombs or scans, then copies a 13-instruction payload elsewhere
and jumps into it. The payload makes one SPL stun pass and repeated DAT kill
passes, each excluding its own body. The old opening is abandoned.

`fragments-four.red` and `fragments-eight.red` preserve the first evolution
recommendations for study. They have 16/17 instructions and peak at 4/8
processes. They discarded relocation and scored poorly against the held-out
panel; they are not replacements for the Molting generator.

| Parameter | Meaning |
| --- | --- |
| OPENING | 0: DAT bomber; 1: scan nonzero fields and drop SPL bombs. The scanner does not detect zero-field instructions. |
| TRIGGER | 0: timer; 1: changed remote marker, with a timer fallback. A marker does not detect every attack. |
| BACKWARD | 0: forward clear; 1: backward clear. |
| WAIT | Number of opening iterations, not VM cycles. |
| STEP | Opening probe stride. Targets inside the protected first 2048 cells are skipped. |
| HOP | Relocated payload's offset from the original first instruction. |
| SENSOR | Marker offset, inside the protected region. Unused with TRIGGER=0. |

Run these commands from the worktree root:

```sh
node cli/zorewars.js check examples/experimental-94x/molting.js --rules 94x --length 50 --json
node cli/zorewars.js battle examples/experimental-94x/molting.js --rules 94x --length 50 --rounds 5 --json
node cli/zorewars.js battle examples/experimental-94x/molting.js @fastsilk.js --rules 94x --length 50 --rounds 20 --seed 4242 --report --json
node --test test/molting.test.js
```

To reproduce the complete experiment (about 3–4 minutes on the development
machine using four CPU workers):

```sh
node scripts/experiment-molting.js --out evolved/molting-94x-4242 --backend cpu
```

Choose a new output directory if that one already has a report. The script
refuses to overwrite an existing experiment. `--backend auto` or `gpu` uses
the existing GPU execution support when the optional runtime is installed;
the recorded first experiment used CPU. CPU mechanism tests still inspect
the copy and transition directly.

Outputs include eight `structure-N.js` / `.red` pairs, `tuned.js`, both
evolution runs' `best.red` and `evolve.json`, two controls, opponent panels,
and `report.json` with input snapshots, all tuning samples and results.
The eight structures vary OPENING, TRIGGER and BACKWARD in that bit order.
No result automatically rewrites `molting.js`.

Once the opponent panel has been exported, the regular CLI also works:

```sh
node cli/zorewars.js tune examples/experimental-94x/molting.js --rules 94x --length 50 --hill evolved/molting-94x-4242/training --candidates 12 --seeds 3
node cli/zorewars.js evolve examples/experimental-94x/molting.js --rules 94x --length 50 --genome 50 --hill evolved/molting-94x-4242/training --selection lexicase --descriptor outcomes --local-steps 1 --generations 2 --batches 2 --batch 12 --seed 4242 --validate --out evolved/molting-cli
```

The regular `tune` CLI samples randomly; the experiment runner seeds that
sampling for repeatability. The regular `evolve` CLI also includes library
genes; the runner deliberately uses only Molting structures and its tuning
recommendation. These are different experiments.

Parameter tuning preserves this generator's design choices. Ordinary
compiled-code evolution may discard the opening, relocation, or both. Its
exports must not be described as functioning Molting warriors without
checking their behavior. The first two evolution recommendations did exactly
that, and lost much of their score against held-out opponents.

See [the build and experiment journal](../../docs/molting-94x-journal.md)
for results, validation limits, and the next experiments to consider.
