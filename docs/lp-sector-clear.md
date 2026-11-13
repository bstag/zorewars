# Compose and tune independent LP clear sectors

`lp-sector-clear` is the cap-safe DAT tail extracted from the [partitioned quartet](lp-partitioned-quartet.md). The standalone block can place its first write relative to its own entry. The quartet shares the same emitter and uses a zero-A cursor reset to keep its tail invisible during scanning.

The [probe-sector study](lp-probe-sector.md) uses this same feeder and writer with a quickscan-driven origin and a matched fixed control.

## Separate the feeder, worker, and sector

The feeder keeps its return path on the continuation SPL queues first. The DAT worker uses the optional child slot. A full queue can deny a writer while leaving its feeder alive. The worker writes one DAT, debits the site's meter, and normally exits through DAT. A worker that takes the count to zero reloads the meter and cursor. [Shared tail and observer](../tools/algebra/blocks/lp-sector-clear.js)

`START` sets the first DAT address relative to the block's entry. `WIDTH` sets the counter before allowing for writes in flight. The linker reserves `WIDTH + 24` cells and rejects a sector that touches the loaded image or overlaps another declared sector. These checks apply to unshifted layouts, including `par`. Full verification separately checks that each sector resets and keeps writing through the round limit. It can reject a layout with disjoint sectors if a feeder rarely gets a worker. [Linker](../tools/algebra/link.js)

## Tune queue sharing before battle scores

`PACE` adds zero to three turns to the feeder's return path. The replay holds the absolute starts at 256, 2050, 3950 and 5950 and the width at 1,200. It relinks each relative `START` after a pacing change shifts the loaded layout. Each row below is a quiet 80,000-turn replay.

| Extra return turns per feeder | Loaded cells | DAT writes by site | Writer children denied at cap | Full phase check |
| --- | ---: | --- | --- | --- |
| 0 / 0 / 0 / 0 | 39 | 4,209 / 4,206 / 4,206 / 4 | 1,054 / 1,057 / 1,057 / 5,259 | Failed |
| 1 / 1 / 1 / 1 | 43 | 2,961 / 2,962 / 2,963 / 2,960 | 742 / 742 / 740 / 743 | Passed |
| 2 / 2 / 2 / 0 | 45 | 2,856 / 2,856 / 2,856 / 2,856 | 1 / 1 / 1 / 2,857 | Passed |
| 2 / 2 / 2 / 2 | 47 | 2,857 / 2,856 / 2,856 / 2,853 | 0 / 1 / 1 / 4 | Passed |

Every feeder survived in the unpaced trace. Its fourth site still made just four DAT writes and never reset. At `PACE=1` the four sites deliver nearly equal work. The `2 / 2 / 2 / 0` row shows why the denial count needs context. Site four asks for more workers than the others and gets denied more often, yet it writes the same number of DATs. `lp-paced-sectors` uses the 43-cell layout as the smaller tested build with roughly equal output.

## Tune a two-sector layout on separate opponents

The 19-cell `lp-sector-pair` starts at absolute offsets 256 and 4200 at load zero. It uses width 1,800 and zero extra return turns. The placement screen keeps the two starts 3,944 cells apart, tries three starts for the first sector and crosses them with widths 512, 1,000 and 1,800. Every candidate passes full verification before battle. The screen runs 32 rounds per opponent at each of seeds 6151 and 8191. The baseline and two leading alternatives then run 64 rounds per opponent at each of fresh seeds 23431 and 26003.

| Starts and width | Development screen | Fresh development starts | Separate opponents |
| --- | ---: | ---: | ---: |
| 256 / 4200, width 1800 | 0.0820 | 0.0781 | 0.0371 |
| 1280 / 5224, width 1800 | 0.1211 | 0.0859 | 0.0527 |
| 1280 / 5224, width 512 | 0.1172 | 0.0898 | 0.0703 |

Scores are points per round. The development field was R.O.U.S., Digital Rain, Distortion Energy and Disciples of the Void. The separate field was Bronze minotaur, Replinator, Hippogriff and The LP Destroyer. The 512-cell candidate led both follow-up panels while scoring below 0.1 on each. This is a reusable payload and a measured placement improvement. A quiet queue trace establishes whether the payload keeps working, while the battle panels measure whether its sectors reach useful targets.

## Reproduce

```sh
node scripts/algebra.js recipe lp-sector-pair --rules lp-hill --out sector-pair.red
node scripts/algebra.js recipe lp-paced-sectors --rules lp-hill --out paced-sectors.red
node examples/hill-study/tune-lp-sectors.mjs
node examples/hill-study/tune-lp-sectors.mjs path/to/LP/HILL32
node --test test/algebra-lp-sector-clear.test.js
```

To rebuild the 512-cell candidate, pass this tree to `node scripts/algebra.js build - --rules lp-hill --verification full`. Relative starts account for the SPL and the first nine-cell leaf.

```json
{"id":"par","kids":[{"id":"lp-sector-clear","P":{"START":1279,"WIDTH":512}},{"id":"lp-sector-clear","P":{"START":5214,"WIDTH":512}}]}
```
