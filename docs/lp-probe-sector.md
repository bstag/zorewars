# Aim a bounded LP clear with a quickscan

The 42-cell `lp-quickscan-sector` recipe combines an eight-pair decoding opening with the `lp-probe-sector` block. The block consumes the linked probe's decoded address, measures its distance from a fixed origin, and accepts the address only if the full strip and 24 cells of pending-write room fit inside its corridor. The chosen address initializes the first write and the reset value. The clear falls back to the fixed origin when the probe misses or fails the corridor check. [Shared sector tail](lp-sector-clear.md) · [Probe block](../tools/algebra/blocks/lp-sector-clear.js)

The fixed control uses the same geometry and evaluates the same probe. It replaces the two pointer-installation MOV instructions with NOP. This preserves the selection and instruction schedule while keeping the cursor and its reset at the fixed origin.

## Timing and boundary checks

At load zero, the fixed origin is cell 278. With no hit, the first DAT lands there on solo turn 16. With the quickscan's planted marker, both versions decode cell 3977 and deliver their first DAT on turn 24. The fixed control writes to 278 and the aimed version writes to 3977. The full trace verifies that the aimed writer keeps that origin after resetting.

The 512-cell design accepts an origin from 278 through 6542, inclusive. The upper bound reserves the whole strip and pending-write room. A wrapped test injects the last valid address and the next cell at handoff. The first is accepted and the second uses the fallback. The linker also rejects another declared clear sector anywhere inside the reserved corridor, even when the fixed strip would miss it.

## Matched placement replay

Each matchup used 48 rounds per seed and kept the same source, placements, and first mover for the fixed and aimed versions. The main panel used seeds 6151 and 8191 against R.O.U.S., Digital Rain, Distortion Energy and Disciples of the Void. The separate panel used 23431 and 26003 against Bronze minotaur, Replinator, Hippogriff and The LP Destroyer.

| Width | Main fixed | Main aimed | Separate fixed | Separate aimed |
| ---: | ---: | ---: | ---: | ---: |
| 128 | 0.0286 | 0.0443 | 0.0312 | 0.0781 |
| 512 | 0.0521 | 0.0677 | 0.0339 | 0.0729 |
| 1,200 | 0.0495 | 0.0651 | 0.0260 | 0.0729 |

Aiming improved the points-per-round mean for each tested width. Width 512 led the main aimed panel, and width 128 led the separate one. The 42-cell recipe keeps width 512 as the teaching configuration. The absolute scores remain low, and the results do not identify a consistently stronger width.

## Where the aimed write changed a round

In seed 8191, round 46, R.O.U.S. starts at cell 335 and moves first. Both controls decode cell 337 and make their first DAT write on cycle index 24. The fixed build writes at 278 and loses after 3,591 cycles. The aimed build writes at 337. The paper's last process executes that DAT on global step 51, and the aimed build wins after 26 cycles. The provenance points to the sector writer at cell 36. That write interrupts the paper's opening while it still depends on the loaded image. [R.O.U.S. source](https://asdflkj.net/COREWAR/LP/HILL32/rous.red)

The quickscan's pair selection determines whether this opportunity exists. The sector's linked corridor determines whether it can act on the selected target. Keeping these as separate blocks allows a later replay to change the probe map without changing the DAT engine.

```sh
node scripts/algebra.js recipe lp-quickscan-sector --rules lp-hill --out quick-sector.red
node cli/zorewars.js check quick-sector.red --rules lp-hill --json
node examples/hill-study/replay-lp-probe-sector.mjs
node examples/hill-study/replay-lp-probe-sector.mjs path/to/LP/HILL32
node examples/hill-study/replay-lp-probe-sector.mjs path/to/LP/HILL32 --trace
```
