# Distortion Energy’s paper and self-modifying stone

Inversed’s *Distortion Energy* pairs a five-cell paper with a four-cell stone. Its 200-cell published LP image uses the empty space between bodies for placement and a six-cell boot to split the process queue. I traced the image in ZoreWars with an 8,000-cell core, eight slots, an 80,000-cycle limit, a 200-cell maximum length, a 200-cell minimum separation, and 500 P-space cells. Solo addresses below use a load origin of zero and turns start at one. [Published source](https://asdflkj.net/COREWAR/LP/HILL32/dse_6.red) · [Koenigstuhl LP field](https://asdflkj.net/COREWAR/LP/hill32_rec.html)

## Launch and queue pressure

The two opening SPLs grow the queue to four. On turns 4–7 those processes copy the original stone from cells 101–98, in descending order, into cells 4,898–4,895. On turns 8–11 four visits to the boot DJN resolve successive branch addresses through its B-postincrement pointer. The first three visit the stone ADD, MOV and JMP. The fourth DJN falls through after decrementing its counter to zero. Its SPL on turn 15 queues one more stone worker at the MOV and keeps a continuation, which jumps to the paper on turn 19. [Published boot](https://asdflkj.net/COREWAR/LP/HILL32/dse_6.red) · [ZoreWars FIFO and operand execution](../src/engine/vm.js)

The first stone ADD executes on turn 12. The following MOV copies cell 4,929 to 4,940 on turn 13. The paper starts at its copy loop on turn 24 and copies cell 4 to 5,922. Its initial counter is five and its initializer resets later generations to 38. On turn 547 the queue first fills, with PCs `[4, 0, 4897, 4898, 4896, 4897, 5922, 5918]`. Four positions belong to the paper and four to the stone. The stone's first lost slot follows a paper copy at turn 3,338. A process at 7,171 copies a DAT from 7,188 onto the stone JMP at 4,898. Stone workers die on turns 3,340, 3,343, 3,349 and 3,354, before the first increment mutation. Paper descendants later occupy all eight slots. [Published paper and stone](https://asdflkj.net/COREWAR/LP/HILL32/dse_6.red)

| Solo route | First paper copy | First full queue | End of round |
| --- | ---: | --- | --- |
| Published dual | 24 | Turn 547, four paper and four stone | Eight paper descendants at 80,000 |
| Paper only | 14 | Turn 497, eight paper | Eight paper descendants at 80,000 |
| Stone only | — | Four workers at peak | Last worker dies on turn 38,531 |

For the single-lineage controls, I used a host-side FIFO filter. Paper only drops remote admissions from the original boot PCs 197 and 198 to 4,896–4,898. Stone only drops PC 199’s continuation to the paper copy loop at 1. Both keep the original 200 loaded cells, boot-copy writes and addressing side effects. This isolates each route while letting its remaining workers cycle through the queue faster. The controls are engine interventions on the published warrior. [Published launch](https://asdflkj.net/COREWAR/LP/HILL32/dse_6.red) · [Queue dispatch](../src/engine/vm.js)

## How the stone becomes a clear

The stone's ADD.X uses its preceding DAT as an increment. With that DAT initially at A=44 and B=35, every ADD advances the scatter MOV's A by 35 and its B by 44. The MOV uses A-predecrement on its source. After 1,600 ADDs its A offset returns to −2 because `8000 / gcd(8000,35) = 1600`. At that offset the MOV decrements the A field of the increment cell itself before fetching the payload. That changes the subsequent destination stride while B=35 keeps advancing the source lane. [Published stone](https://asdflkj.net/COREWAR/LP/HILL32/dse_6.red) · [Cross-field arithmetic and A-predecrement](../src/engine/vm.js)

| Stone-only turn | ADD updates | Observed write or source effect |
| ---: | ---: | --- |
| 4,814 | 1,600 | Increment A 44 → 43. The MOV fetches cell 4,938. |
| 9,614 | 3,200 | Increment A 43 → 42. The MOV fetches cell 4,937. |
| 14,414 | 4,800 | Increment A 42 → 41. The MOV fetches cell 4,936. |
| 14,531 | 4,839 | The MOV overwrites the increment at 4,895 with `DAT 0,0` from 6,256. |
| 14,534 | 4,840 | After ADD applies zero increments, the MOV repeats destination 4,895 with `DAT -1,0` from 6,255. |
| 14,537 | 4,841 | ADD now applies `(0,−1)` and the MOV writes to 4,894. The next writes go to 4,893 and 4,892. |

The reload payload at 6,255 came from the stone’s own earlier addressing side effect. On turn 11,102 the MOV selected cell 6,255 as its A pointer, changed its A from zero to −1, and fetched cell 6,254. Later, when the zero increment holds the MOV’s A field at 1,363, its source operand keeps predecrementing the pointer at 6,260. That brings it from 6,256 to the prepared payload at 6,255 on the second write to 4,895. With the new increment, the destination sweeps backward one cell per ADD while the source keeps consuming this live lane. It eventually overwrites its own JMP at turn 38,525 and its MOV at turn 38,528. The last process dies on turn 38,531. [Published self-modifying loop](https://asdflkj.net/COREWAR/LP/HILL32/dse_6.red)

## The paper can change the reload payload

I also kept both lineages and intercepted whole-cell paper copies to the four deployed stone cells. After operand resolution, the host restored each such destination to its pre-copy instruction. The filter preserved all address effects and let every paper copy to other addresses stand. The queue still filled on turn 547. The first three increment A changes now occurred on turns 9,352, 18,846 and 28,398, at the same 1,600, 3,200 and 4,800 ADD counts. [Published shared-core layout](https://asdflkj.net/COREWAR/LP/HILL32/dse_6.red) · [Write semantics](../src/engine/vm.js)

At turn 28,631 the stone loaded zero from 6,258. It loaded another zero from 6,257 on turn 28,638. On turn 28,645 the live cell at 6,256 supplied a paper JMZ with A=4,878 and B=0. The writer’s A still held steady, but its destination stride became +4,878 modulo 8,000, which has a 4,000-cell orbit. On turn 52,332 the stone overwrote its own MOV, and its last process died on turn 52,353. The paper filled the queue again by the time limit. This control separates direct overwrite of the deployed stone from the paper's influence on the stone’s source lane. [Published MOV and paper JMZ](https://asdflkj.net/COREWAR/LP/HILL32/dse_6.red)

## Paired fights against the published LP field

I ran the original and both queue controls against the nine other retrieved Koenigstuhl LP top-ten warriors. Each comparison reused 64 rounds from seed `23033` and 64 from `49139`, with identical placements and first movers per opponent and a fresh P-space history per match. The results are local engine measurements on that field. The filter saw fewer than its usual four stone admissions in one paper-only round and no paper admission in nine stone-only rounds. [Koenigstuhl LP ranks](https://asdflkj.net/COREWAR/LP/hill32_rec.html) · [Source map](lp-top-ten-sources.md) · [Match runner](../src/engine/battle.js)

| Opponent | Published dual W/L/T | Paper only W/L/T | Stone only W/L/T |
| --- | ---: | ---: | ---: |
| R.O.U.S. | 23/34/71 | 18/35/75 | 11/117/0 |
| Replinator | 46/52/30 | 42/47/39 | 8/120/0 |
| Bronze minotaur | 26/59/43 | 42/42/44 | 0/128/0 |
| Digital Rain | 50/49/29 | 41/56/31 | 16/112/0 |
| Fear of the Unknown | 12/12/104 | 16/2/110 | 4/124/0 |
| The LP Destroyer | 46/46/36 | 46/41/41 | 10/117/1 |
| Hippogriff | 18/26/84 | 7/21/100 | 9/119/0 |
| The LP Destroyer II | 50/45/33 | 49/42/37 | 11/116/1 |
| Disciples of the Void | 31/62/35 | 19/88/21 | 36/52/40 |
| **Total W/L/T** | **302/385/465** | **280/374/498** | **105/1,005/42** |
| **Points per round** | **1.1901** | **1.1615** | **0.3099** |

The stone made the clearest contribution against *Disciples of the Void*, where the hybrid gained 50 points over paper alone in 128 rounds and the stone alone gained 70. Against *Bronze minotaur*, the published hybrid scored 49 fewer points than the paper route alone. Queue sharing changes both components’ cadence, so these comparisons measure the effect of enabling the lineage within this launch and field. They leave open how much of the matchup change comes from the stone’s early scatter versus its late transition. [Published opponents](lp-top-ten-sources.md) · [Disciples trace](lp-disciples-source.md) · [Bronze minotaur trace](lp-bronze-source.md)

## What a block check can establish

A controlled gate can trace the copy and launch order, count updates by the deployed ADD, and verify the three A-field changes on the actual increment cell. With a controlled source lane it can then require the zero reload, the next write to the same destination, and consecutive backward DAT writes after the negative-unit reload. A queue-size check alone would also pass a hybrid whose paper had already killed the stone. A hybrid check can instead distinguish queue ancestry, the deployed writer’s execution, and the source instruction it reads. The protected-dual run gives a separate test case for a valid reload with a different stride. [Published increment and writer](https://asdflkj.net/COREWAR/LP/HILL32/dse_6.red) · [VM instrumentation point](../src/engine/vm.js)
