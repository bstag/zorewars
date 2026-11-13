# From an LP stone to a DAT clear

inversed's *Distortion Energy* boots a four-cell stone and runs a paper in the same eight-slot queue. The native quiet round starts four stone workers, but the paper overwrites their remote loop and the last stone worker dies on turn 3,354. With the paper launch suppressed, the stone's own scatter copies change its increment cell until it starts sweeping backwards. The unbounded sweep eventually overwrites the stone's JMP and MOV. A diagnostic that protects the remote loop from whole-instruction paper writes still gives a different mutation because the paper also changes the stone's remote read sources. [Published warrior](https://asdflkj.net/COREWAR/LP/HILL32/dse_6.red) · [Source trace and controls](lp-distortion-source.md)

## A planned write changes the attack

`lp-mutation-stone` is an original 11-cell block. It uses the same principle of changing the next attack with a stone write. Its handoff uses a prepared JMP donor and a bounded clear instead of the published increment-cell mutations. The stone needs one process throughout.

1. `ADD.F` advances the A and B fields of a shared cursor. The scatter MOV uses A-predecrement to read and B-indirect to write, so the A increment is one larger than the B increment. Both effective addresses advance by `STEP`.
2. On shot `SHOTS`, the source is the prepared donor and the destination is the active ADD. The donor encodes the distance from that ADD to the clear. After the MOV copies it, the ordinary loop jump returns to the cell and executes its new instruction.
3. The clear writes consecutive DATs with a B-postincrement cursor. It resets that cursor after `WIDTH` writes and repeats from `START`. No SPL runs during the handoff or the clear.

The linker rejects prior donor reads or shots into the loaded image. It also rejects a sweep that overlaps that image or another declared clear sector. Those checks cover static placement. The full gate separately observes the handoff, sector coverage, resets and continued DAT writes near the end of the round. A paper's descendants can still rewrite the stone or its cursor later. [Block and phase checks](../tools/algebra/blocks/lp-mutation-stone.js) · [Wrapped tests](../test/algebra-lp-mutation-stone.test.js)

## Share one slot with a growing paper

`lp-mutation-paper` packs the stone and a backward-copy paper into 19 cells. The paper uses the quiet setting of `lp-scatter-paper`, with scatter disabled. In the first trial with the default scatter paper, the stone installed and executed its jump, but the clear cursor was corrupted and the gate caught a DAT outside its sector. With the quieter paper, a sweep over `SHOTS` values 32, 64, 96, 128, 160 and 192 found only 128 passed the full gate at the chosen placement. The first four other settings failed the clear contract, and 192 interfered with the paper's first backward copy. The setting comes from this quiet compatibility sweep.

| Quiet event | Stone only in the same image | Hybrid |
| --- | ---: | ---: |
| Queue fills | — | 718 |
| Handoff write | 383 | 2,225 |
| First DAT clear write | 386 | 2,249 |
| DAT clear writes by turn 80,000 | 26,530 | 3,287 |
| Distinct DAT clear targets | 960 | 960 |
| Final queue by ancestry | 1 stone | 1 stone, 7 paper |

When the hybrid first fills the queue, its slots read `paper paper stone paper paper paper paper paper`. Both the pivot write and first clear write leave seven paper descendants followed by the same stone lineage. The stone now gets about one turn in eight when the queue is full, which accounts for much of the drop in clear throughput. The no-handoff control restores the original ADD at the appointed shot and eventually loses its stone. The immediate-clear control takes the same jump on entry, but a paper descendant touches its cursor on turn 23,422 and the clear later dies. Both controls finish with eight paper descendants. The traces match across load positions 0 and 7,997 after normalizing addresses. [FIFO trace and replay runner](../examples/hill-study/trace-lp-mutation-paper.mjs)

## Matchup controls

Each compact control uses the same 19-cell layout. The single-lineage controls change the start address. The no-handoff control replaces the donor with a copy of the ADD, while the immediate-clear control replaces the opening ADD with the donor's JMP. The hybrid and both timing controls retain the same parallel launch.

| Version | First field | Separate field |
| --- | ---: | ---: |
| Published Distortion Energy | 1.169 | 1.184 |
| Compact hybrid | 0.938 | 1.069 |
| Compact paper only | 0.775 | 1.072 |
| Compact stone only | 0.091 | 0.028 |
| Compact no handoff | 0.900 | 1.044 |
| Compact immediate clear | 0.750 | 1.044 |

Each score covers 320 rounds across four opponents and two seeds. The first field is R.O.U.S., Digital Rain, Bronze minotaur and Disciples of the Void. The separate field is Replinator, Fear of the Unknown, Hippogriff and The LP Destroyer II. The delayed handoff led the two compact timing controls on both fields. Its lead over paper alone on the first field did not carry to the separate field. Disciples of the Void was the largest gap to the original, which scored 1.238 points per round against it versus 0.175 for the compact hybrid. The published four-stone-worker launch and its live remote reads offer a separate hypothesis to test in that matchup. [Published launch and matchup controls](lp-distortion-source.md)

The [worker allocation study](lp-distortion-workers.md) holds the published image fixed and compares one, two and four stone admissions. It also builds a smaller phase control that changes which instruction the second worker enters.

## Reproduce

```sh
node scripts/algebra.js recipe lp-mutation-stone --rules lp-hill --out mutation-stone.red
node scripts/algebra.js recipe lp-mutation-paper --rules lp-hill --out mutation-paper.red
node cli/zorewars.js check mutation-paper.red --rules lp-hill --json
node examples/hill-study/trace-lp-mutation-paper.mjs
node examples/hill-study/trace-lp-mutation-paper.mjs path/to/LP/HILL32
```
