# Live GPU arena

The interactive arena supports persistent GPU execution for one through four
warriors on rings, planes and volumes, with automatic CPU fallback. The
existing renderer, avatars, inspector, highlights, process chart and
post-mortem consume confirmed VM snapshots. A CPU interpreter does not run
alongside normal GPU playback.

## Controls and fallback

Settings → **Live battles** selects **GPU when available** (default) or
**CPU**. A status beside the cycle counter shows the selected backend; its
tooltip gives the fallback reason. This preference is separate from warrior
rules and from headless tournament/ladder execution.

Run, Pause, Step, Finish and New round retain their existing meanings. Step
advances exactly one instruction. Controls prevent another step while a
snapshot is pending. Pause stops new submissions; an already submitted
bounded slice may settle before the paused display is final. New round,
rules changes and replay invalidate outstanding requests, including pending
GPU initialization, so an old response cannot update the replacement round
or its P-space.

A missing GPU, device/readback failure, or a GPU operation that does not
return within 15 seconds selects CPU. The last confirmed
VM snapshot is authoritative, including all queue and forensic state. Failed
unpublished work is discarded and the requested slice executes on CPU from
that snapshot. The next round can try GPU again. Explicit instruction
tracing uses CPU; existing CLI trace behavior is unchanged.

Replay reconstructs the original positions, first mover and starting P-space
on the CPU in yielding slices, then resumes GPU execution from that exact
checkpoint. Replaying a round does not train the original match's P-space a
second time. GPU snapshots support ICWS'88 checkpoints as well as '94.

## Implementation

- `src/engine/gpu/kernel.js` shares instruction execution, addressing and
  arithmetic between headless matches and live sessions. Live execution
  supplies its own scheduler and forensic hooks.
- `src/engine/gpu/live-kernel.js` handles 1–4 warrior queues, headings, deaths,
  termination and the CPU VM's death-time instruction-budget rescaling.
- `src/engine/gpu/live.js` retains device buffers and caches compiled
  pipelines across rounds. Each advance runs at most 4096 instructions and
  reads one complete snapshot.
- `src/engine/gpu/live-layout.js` transfers instruction fields, owners,
  execution/write timestamps, write provenance, complete FIFO buffers,
  headings, P-space, counters, contacts, conversions and process-death records.
  Applying a snapshot synchronously updates the existing VM facade.
- `src/engine/live.js` serializes advances and resumes the same VM on CPU
  after failure. `web/live.js` supplies and reuses the browser GPU device.

Animation events use a bounded buffer and retain the same visible prefix as
the CPU VM. Overflow is counted in `vm.eventsDropped`; forensic records stay
complete. The event limit and dispatch size bound work and readback memory.
Snapshots are taken once per advance, rather than after every instruction.

GPU throughput gains measured for batches of independent fights do not imply
that one displayed fight will be faster. Full snapshot readback and renderer
updates still use CPU, particularly for large cores. CPU mode remains useful
on devices where a single GPU session is slower.

## Validation

```powershell
$env:ZOREWARS_GPU_TEST='1'
node --test --test-concurrency=1 test/gpu-live.test.js test/gpu.test.js
node scripts/check-browser-gpu.js
```

Hardware tests compare every core field, full FIFO buffer and order,
headings, P-space, budgets, timing, contacts, death records, animation events
and post-mortems at fixed instruction boundaries. They cover rings, planes,
volumes, random self-modifying code, real volume warriors, P-space across
rounds, '88 replay checkpoints, event overflow and CPU recovery.

The real-Chrome check exercises live stepping, running/pausing, finishing,
deterministic replay, reset during pending GPU work, CPU selection, recovery
from a rejected GPU readback, automatic fallback without WebGPU and a
four-warrior volume. It also verifies the headless worker paths.
