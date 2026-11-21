# Tournament Weekend 2026 94nop source review

This review uses the downloaded published sources and the reported
entrant order. The snapshot is described in the
[benchmark guide](tournament-weekend-2026-benchmark.md). The original
tournament matchup matrix is unavailable. Source mechanisms and related
local work establish similarities, while the reported finish alone
cannot establish why an entry earned a particular diversity distance.

## Nova, first

Nova is labelled a Rusty variant by lain. It starts at the paired
`SNE.I *ptr2,@ptr2` scan, with probes 16 cells apart and a stride of
2255. The scan's `DJN.F` also damages a probed cell. On a mismatch it
adjusts the A-side destination by −129, drops two SPL instructions per
iteration through the B-side pointer, and copies the eight-cell clear
backward through the A-side pointer. Thus the scan locates both an
attack site and a place to deploy the clear.

The deployed clear writes twice per loop. Its source is selected through
the B-field of the same pointer whose A-field advances the destination.
The payload includes two SPL templates followed by two DAT templates.
Writing over the pointer changes which template the next pass selects.
The final DAT has predecrement operands 2667 and 5334, which can damage
imp spirals when executed. Scan, stun, relocation and staged killing are
coordinated through a small set of shared fields.
[Published Nova source](https://corewar.co.uk/cwtw2026/94/nova.red)

We have closely related primitives. `finisher-overwrite` advances its
SPL/SPL/DAT phases by overwriting its own pointer, and our Molting
experiment relocates a staged clear after an opening. Burin is a
scanner that commits to a clear. I found no documented test of this
specific combination of a paired scan, simultaneous stun/copy loop
and Rusty-style deployed clear. Molting's journal also records an
opening-guard defect, so its early results need that qualification.
[Pointer-overwrite block](../tools/algebra/blocks/hillscan2.js),
[Molting experiment](molting-94x-journal.md),
[Burin source](https://corewar.co.uk/cwtw2026/94/burin.red)

## Clairvoyance TW2026, second

Clairvoyance spends a short opening on two unrolled paired comparisons,
with the prescan stride encoded in the eventual jump to its main loop.
A hit triggers a short SPL wipe. It then uses a compact paired scanner
with a decrement stream and commits to a double-write staged clear.
The author describes these phases as .80c prescan, wipe, .66c scan,
SSD clear. These scan rates describe the author's instruction design,
not a measurement performed for this review.
[Published Clairvoyance source](https://corewar.co.uk/cwtw2026/94/clairvoyance_tw2026.red)

We explored fast unrolled probes, paired scanners and staged clears.
Our October 30 recipe book explicitly describes Infravision's .80c
prescan, SPL wipe and .66c main scan. Thus we had already studied this
architecture before the tournament. Burin transfers directly from its
first useful find to a descending clear. A concrete comparison would
preserve the same clear while adding or removing the prescan and local
wipe, then measure what those extra opening turns buy.
[Unrolled scanner block](../tools/algebra/blocks/scan-clears.js),
[Earlier scanner study](hill-top30/94nop.md),
[October recipe book](hill-recipe-book.md)

## Inventory and related work

Places below are the official order among tournament entrants.

| Place | Entry | Source mechanism | Evidence of related local work |
| ---: | --- | --- | --- |
| 1 | Nova | Paired scan, SPL wipe and backward boot, pointer-driven staged clear | Pointer-overwrite finisher and Molting exist. Exact integration is a review gap. |
| 2 | Clairvoyance TW2026 | Prescan, bounded SPL wipe, paired scan, staged clear | Infravision's related staged opening was explicitly source-reviewed in October. |
| 3 | Evolved Tidal | Evolved program whose opening starts a SPL-fed MOV/DJN loop with pointer side effects | Instruction evolution is implemented. The later mutated execution needs tracing before assigning a more specific strategy. |
| 4 | Bloodthirst | Active VERSION=92 branch creates four workers and a short silk paper, with immediate MOV bombs aimed through a backward pointer | Silk and imp-damaging bombs are represented. Its large VERSION>=94 branch is excluded at assembly time. |
| 5 | Burin | Three paired probes per loop, then two-write backward SPL clear changing to DAT | Our submitted unrolled-oneshot design, directly represented by the block. |
| 6 | Swan | Armadillo-style stone-to-clear plus vector-launched three-point imps | Armadillo and vector imp launchers are present. |
| 7 | Spear of Osiris 50 | MUL quickscan, then remote microwarrior workers alongside a two-stage bombing paper | Quickscans, bombing papers and ’88 microwarrior swarms exist. This exact mixed worker/paper launch is a composition to investigate. |
| 8 | Tractor Beam TW2026 | A scanner starts a separate staged clear and redirects its destination on subsequent finds | We studied clear-directing scanner families. This continued guidance differs from Burin's one-time commitment. |
| 9 | Night Crawler OG | Boots a small stone and launches a binary-tree three-point imp spiral | Booted stone/imp architectures are represented and previously studied. |
| 10 | Iron Gate | Fast paired scan, SPL/JMP attack and self-modifying continuation | Scanner/wipe families exist. Exact 2026 constants and interaction need comparison. |
| 11 | prion50o-2A | Arvon-derived quickscan and paper/stone plus a separately launched DAT sweeper | Arvon was source-reviewed and paper/stone blocks exist. The added sweeper's benefit is unmeasured here. |
| 12 | Mallet | Two-unit MUL quickscan, two-stream probe burst, fan boot of Armadillo stone and compact imp pump | Our submitted algebra composition. |
| 13 | Evolved Drift | Evolved SPL-fed MOV/DJN opening, with later branches and addressing side effects | Instruction evolution exists. Exact surviving execution needs tracing. |
| 14 | UHelium²³⁵-IVB | Arvon-derived six-pattern quickscan, booted stone and silk | Closely related architecture already source-reviewed. |

The inventory comes from the individual sources linked by the
[official entrant table](https://corewar.co.uk/tournamentweekend2026.htm).
Local comparison evidence is in the
[Arvon and scanner review](hill-block-review.md),
[recipe book](hill-recipe-book.md),
[block catalog](block-algebra-catalog.md),
[unrolled scanner emitter](../tools/algebra/blocks/scan-clears.js),
[microwarrior emitter](../tools/algebra/blocks/top200-swarms88.js)
and [Mallet source](https://corewar.co.uk/cwtw2026/94/mallet.red).

## What to explore next

Nova's combination is the clearest gap. Preserve the pointer-driven clear
and compare deployment triggered by a scan with deployment after a fixed
opening. Clairvoyance supplies a second controlled question about the
value of a short wipe before continued scanning. Spear of Osiris supplies
a third question about remote worker swarms combined with paper.

For each, record opening cost, first useful write, actual phase handoff,
process allocation and fresh-seed per-opponent outcomes. Then compare
nearest-neighbor distance and push-off placement on the same field with
our proposed second entry. Those measurements would distinguish an
interesting mechanism from a competitive divergent candidate.
