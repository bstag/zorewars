# Two transparent pairs with protected DAT sectors

The 68-cell `lp-partitioned-quartet` uses the transparent quartet's two parity groups and late self-hits. Each backward scanner switches to a forward DAT sweep in its own sector. Its sector includes its own locked forward scanner. The sectors avoid each other, both live clear bodies, and the original loaded image. The [54-cell quartet](lp-transparent-pair.md#run-both-pairs-in-the-same-queue) is the reference for the original cross-clearing behavior.

## Keep both clears alive

The two backward scanners still lock their own forward partners at distinct probe 3,997 and hit their own probe at 3,999. The expanded clear tail starts with zero A fields. Before the handoff, the A-only scanners can pass over it just as they pass over the original six-cell bodies. The forward bodies keep the scanner and its lock but have no competing DAT sweep.

Once a backward guard falls through, `MOV.BA @0,meter` copies the meter's stored width from B into A. The writer advances its own cursor. Each writer's `DJN.A @0,meter` debits the count and normally branches to that DAT. The writer that decrements the count to zero falls through to reset both meter and cursor. The first target is at body offset +14. Since a write and its debit are separate turns, the linker reserves 24 cells beyond the requested width for in-flight writes before the reset. The gate checks every quiet-run DAT against that reserved sector. At width 1,800 each site actually visits 1,801 cells and resets twice. [Implementation](../tools/algebra/blocks/lp-transparent-pair.js)

The feeder uses `SPL.B @0,writer` followed by a jump back to the feeder. The writer is the optional child. The VM queues the continuation first, so even if the table is already full the feeder gets to return. In the same-layout control, SPL instead creates the feeder as the optional child and the continuation goes to the writer. The first pair executes SPL at the cap on turn 32,249, drops its feeder, and makes only one DAT write before retiring. Its forward worker stays locked for the rest of the round. Both versions have safe sectors. Their different behavior comes from which path SPL admits first. [VM SPL and queue behavior](../src/engine/vm.js) · [Replay](../examples/hill-study/trace-lp-partitioned-quartet.mjs)

## Follow the eight slots

These are one-based solo turns at load zero. The site order is backward one, forward one, backward two, forward two.

| Event | Unrestricted quartet | Partitioned quartet |
| --- | --- | --- |
| Both clear feeders have entered | Turn 32,135, slots 2 / 1 / 2 / 1 | Turn 32,232, slots 2 / 1 / 2 / 1 |
| First queue of eight | 32,141, slots 3 / 1 / 3 / 1 | 32,247, slots 3 / 1 / 3 / 1 |
| Pair two's lock dies | 63,100, killed by pair one | 34,175, killed by pair two |
| Pair one's lock dies | 62,550, killed by pair two | 34,232, killed by pair one |
| After both locks are gone | First clear later retires. The second eventually overwrites its own MOV. | Both sites reset and continue writing. |
| Turn 80,000 | One SPL remains. | Five queued processes, split 2 / 0 / 3 / 0. Both writers still work. |

The partitioned queue first reaches eight with PCs `[5969, 6118, 2006, 2007, 2011, 2157, 5967, 5968]`. The two lock PCs are 6118 and 2157. The other slots include both feeder returns, both writers, one meter check, and one DAT continuation waiting to die. The trace records 690 turns with eight queued while both locks are present. Once both locks are gone the queue spends 41,180 of 45,771 turns at five or six processes and never reaches eight again. The feeder can keep both sectors working without using every slot.

Pair two's last DAT lands on turn 79,992 and pair one's on 79,999. The final queue can omit a writer's PC when that process is at its meter check or feeder return. Counting writers requires tracing writes as well as looking at the last queue.

## Reuse the pieces

- **Transparent handoff.** The scan, cursor, JMP lock, and self-hit remain shared with the two- and four-scanner recipes.
- **Feeder with an optional worker.** Put the persistent control path on SPL's continuation and use its child for expendable work. The matched control shows why this matters when other components share the queue.
- **Bounded concurrent clear.** Keep separate cursor and meter state per site. Reserve room for writes already queued before a reset, and verify both sectors against linked geometry. The [standalone sector block](lp-sector-clear.md) shares this tail and adds placement and feeder pacing controls.

```sh
node scripts/algebra.js recipe lp-partitioned-quartet --rules lp-hill --out partitioned.red
node cli/zorewars.js check partitioned.red --rules lp-hill --json
node examples/hill-study/trace-lp-partitioned-quartet.mjs
node --test test/algebra-lp-transparent-pair.test.js
```

The replay prints zero-based cycle indices, FIFO queues, queue-size histograms by number of live locks, and separate DAT and reset counts for each site.
