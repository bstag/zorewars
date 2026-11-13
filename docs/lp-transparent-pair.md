# How opposed LP scanners stay invisible to one another

The 26-cell `lp-transparent-pair` recipe isolates one of the two pairs in *Disciples of the Void*. The published warrior deploys four scanners in two parity groups. This model deploys two on the same parity, lets them scan, and follows the intentional collision that starts the clear. Use either `lp` or `lp-hill`. The block owns its loaded image so a neighboring block's instructions cannot change the quiet collision schedule. [Published source](https://asdflkj.net/COREWAR/LP/HILL32/4xlb_6.red) · [Source trace](lp-disciples-source.md)

## The probe, cursor, and bomb share state

Both payloads have six instructions. Only the probe instruction has a nonzero A field. The ADD or SUB changes a separate cursor's B field, and the probe's predecrement supplies the last unit of the signed step. The cursor also holds a JMP with A zero. The hit instruction copies that JMP using the cursor's live B value. The scan then checks the same cell again. Since the trap has A zero, the recheck resumes the walk. [Block implementation](../tools/algebra/blocks/lp-transparent-pair.js)

Changing only the two probe modifiers to B-only or both fields changes that recheck. The scanner sees the live B field in its own JMP and keeps attacking the same cell. In the quiet model, both controls visited 640 distinct cells on the backward scanner and 75 on the forward scanner through the full 80,000 turns. The backward control finished probing a JMP with A zero and B 6,080. Neither control reached the clear. The A-only version reached 3,999 distinct cells before its intentional self-hit.

## The two collisions are part of the algorithm

For step magnitude `s` and starts `D` and `D + 2s`, the two scanners can see only the opposite-parity cells, one of which is the probe in each body. Steps with `gcd(s, 8000) = 2` have a 4,000-cell orbit. The backward scanner visits the forward probe on distinct look 3,997 and its own on 3,999. An intact guard branches back to the probe. Once the scanner overwrites its own probe with a zero-A JMP, the guard falls through into the SPL-fed backward clear. [Probe formulas and published controls](lp-disciples-source.md#what-preserves-the-late-meeting)

| Event in the 26-cell model | Default step 78 | Step 82 |
| --- | ---: | ---: |
| Backward scanner enters | Turn 30 | Turn 30 |
| Forward scanner enters | 131 | 131 |
| Backward scanner locks its peer | 16,030, probe 3,997 | 16,036, probe 3,997 |
| Backward scanner overwrites its own probe | 16,044, probe 3,999 | 16,050, probe 3,999 |
| First DAT from the backward clear | 16,050 | 16,056 |
| Peer executes the DAT that replaced its lock | 47,412 | 47,386 |

These are one-based quiet VM turns at load zero. The published four-scanner warrior reaches its first peer lock on turn 32,064. The model's two processes and different loader give it a different turn schedule even when the distinct probe indices agree. It finishes with one worker at the backward SPL. [Published quiet endgame](lp-disciples-source.md#endgame-in-the-quiet-core)

## Probe order and queue order both matter

The model gives the backward scanner a lead with a single zero-A DJN immediately before the deployed forward body. Waiting at the original loaded image let some backward probes trap the forward loader before it finished. Waiting after deployment keeps the forward scanner out of that race. The gate checks intact copies, both signed orbits and the peer executing its JMP lock before the self-trigger. Full verification also checks that the backward clear retires the locked peer.

To separate scan phase from launch timing, the replay advances only the forward cursor's seed by 40 strides. Both launch turns stay the same. The forward scanner now locks the backward probe on turn 15,981 at its own distinct look 3,958, then overwrites its own probe on look 3,960. The forward clear writes its first DAT on turn 16,001. This swaps which scanner clears without changing the two body placements, stride magnitude, or launch sequence.

## Run both pairs in the same queue

The 54-cell `lp-transparent-quartet` uses the same loader, cursor seeds, and six-instruction payloads twice. The second pair is 3,961 cells from the first. This odd displacement separates their even-step probe orbits by parity. At load zero the backward and forward sites are 2000 and 2156 for pair one, then 5961 and 6117 for pair two. The backward scanners still lock their partners at distinct probe 3,997 and hit their own probes at 3,999. [Shared block implementation](../tools/algebra/blocks/lp-transparent-pair.js)

The table lists the FIFO queue after each one-based solo turn. The counts follow the site order above. At the cap, a clearing site occupies three slots. One runs the SPL feeder, one runs the DAT writer, and one is the writer's continuation waiting to die on DAT. Each forward JMP lock holds one slot. The queue touches eight, but neither feeder executes with eight already queued in this trace. A DAT continuation frees a slot before the next feeder needs it. [FIFO queue implementation](../src/engine/vm.js)

| Turn and event | FIFO PCs after the turn | Site counts |
| --- | --- | --- |
| 32,133, pair two feeds | 6118, 2004, 2157, 5966, 5965 | 1 / 1 / 2 / 1 |
| 32,135, pair one feeds | 2157, 5966, 5965, 6118, 2005, 2004 | 2 / 1 / 2 / 1 |
| 32,141, queue first fills | 2157, 5967, 5966, 5965, 6118, 2006, 2005, 2004 | 3 / 1 / 3 / 1 |
| 62,550, lock at 2157 dies | 5967, 5966, 5965, 6118, 2006, 2005, 2004 | 3 / 0 / 3 / 1 |
| 63,100, lock at 6118 dies | 2006, 2005, 2004, 5967, 5966, 5965 | 3 / 0 / 3 / 0 |
| 63,546, first clear retires | 5967, 5966, 5965 | 0 / 0 / 3 / 0 |
| 80,000, round limit | 5965 | 0 / 0 / 1 / 0 |

This is the same cap allocation as the published warrior, with a different boot order. In the published trace pair one feeds first and the queue reaches eight on turn 32,127. The two clears share a core, so separating the **probes** by parity leaves the later dense DAT sweeps free to collide. In the model each clear kills the other pair's lock. The second clear then overwrites the first clear's MOV and SPL. It later overwrites its own MOV, leaving a single SPL at the limit. [Published queue and collision trace](lp-disciples-source.md#process-slots-after-the-handoff)

### Keep each kind of collision separate

The trace restores selected whole-cell DAT writes after address resolution. It preserves the operand side effects and consumes the same turn. Preserving the other clear's MOV and SPL restores four writes and leaves both DAT writers active at turn 80,000. Preserving only the two forward locks keeps those slots occupied and moves the first clear's retirement from turn 63,546 to 63,772. In that control the second writer is still making DAT writes at the round limit. The first control isolates why one writer disappears. The second isolates how the locked processes affect the turn budget. [Quartet trace script](../examples/hill-study/trace-lp-transparent-quartet.mjs)

The [partitioned quartet](lp-partitioned-quartet.md) builds the protected sectors into Redcode and traces the extra controller steps and SPL ordering.

## Reproduce

```sh
node scripts/algebra.js recipe lp-transparent-pair --rules lp-hill --out transparent.red
node cli/zorewars.js check transparent.red --rules lp-hill --json
node examples/hill-study/trace-lp-transparent-pair.mjs
node scripts/algebra.js recipe lp-transparent-quartet --rules lp-hill --out quartet.red
node examples/hill-study/trace-lp-transparent-quartet.mjs
node --test test/algebra-lp-transparent-pair.test.js
```

The traces print zero-based cycles and report each scanner's distinct probe count. The quartet also records FIFO PCs, per-site slot counts, and the roles of queued processes at its key transitions.
