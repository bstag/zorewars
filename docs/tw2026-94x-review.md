# Tournament Weekend 2026 94x source review

Reviewed November 17, 2026. The archive contains eleven published entries,
all compiled under the 55,440-cell tournament profile and 50-cell limit.
This review reads those sources and the existing ZoreWars research records.
It adds no battle measurements. Tournament place establishes the finishing
order. The original matchup matrix is unavailable, so the nearest neighbor
and measured contribution of diversity remain unverified.
[Archive manifest](../imported/tournament-weekend-2026/manifest.json),
[published results](https://corewar.co.uk/tournamentweekend2026.htm).

Current block availability and earlier tests are separate evidence. The
X block trial record describes its catalog as of November 9, 2026 and
was committed on November 13, before the November 14 X tournament.
Those recorded trials support the pre-tournament comparisons below.
The referenced Molting journal begins on October 27.
[Dated block review](hill-top30/block-gaps.md),
[Molting journal](molting-94x-journal.md).

| Place | Warrior | Cells | What the executed design does |
| ---: | --- | ---: | --- |
| 1 | Giant Alien Force | 25 | Boots a mov-through stone and a compact mirrored A-imp launcher to separate locations. |
| 2 | Hex | 26 | Boots a two-write stone and a multistage bombing paper, sharing the process queue. |
| 3 | Slayer | 14 | Compares separated cells, wipes targets with SPL instructions, then reaches a DAT clear. |
| 4 | Spyglass | 8 | Walks a step-31 pointer, tests both numeric fields, and DAT-bombs nonzero cells beyond its own image. |
| 5 | Evolved Reach | 50 | Starts a SPL-fed postincrement copying/decrementing attack. Most of its image is evolved mixed code and DATs. |
| 6 | Millwright | 28 | Fans eight workers into remote stone and silk copies, then patches the counted stone into a DAT clear. |
| 7 | Iron Gate | 13 | Pair-comparison scanner lays SPL/JMP traps and finishes with a decrementing gate/clear. |
| 8 | Protekshun | 28 | Boots a SpookyWench-style stone and a modified vortex launcher feeding A- and B-imps. |
| 9 | Orca zoya | 49 | Four quickbomb writes precede a booted mov-through stone and multistage bombing paper. |
| 10 | Evolved Rift | 50 | Starts a SPL-fed postincrement copying/decrementing attack with coupled mutable pointers and an evolved tail. |
| 11 | REAMer DX jbgc | 50 | Starts two different paper engines and an imp spiral from a third launch branch. |

The corresponding archived files are in
[`imported/tournament-weekend-2026/94x/`](../imported/tournament-weekend-2026/94x).

## Giant Alien Force

The boot seeds two identical imp instructions half a core apart, places
their pointer 6,285 cells away, and copies the stone and launcher to
different remote locations. The stone's `mov {zofs1, >zofs2` copies the
instruction found through changing remote pointers. A second MOV drops
the explicit DAT bomb, while ADD advances the two fields and DJN.F
corrupts another addressed instruction. The explicit ending is a forward
DAT clear if the bombing loop falls through.

The launcher has a persistent SPL head and two jump paths. One advances
the pointer's A-field and one advances its B-field, sending processes
through the two mirrored streams. Each imp is `MOV.I #27721, *0`, so its
copy destination comes from the A-field. This compact half-core geometry
is the most specific feature to investigate. A general stone/imp
composition alone does not reproduce its launch schedule.
[Published source](https://corewar.co.uk/cwtw2026/94x/giant_alien_force.red),
[local source](../imported/tournament-weekend-2026/94x/giant_alien_force.red).

We have explored mov-through stones, remote booting, and continuous imp
pumps. Existing `dual-imp-pump` deliberately feeds A- and B-imps of
different ring sizes, so it is a related capability with different
geometry. The reviewed records contain no experiment reproducing this
exact mirrored launcher. Earlier X trials did test a 29-instruction
fan boot of `movthrough-feed-stone` with `dual-imp-pump`, reporting a
mean 0.935 points per round over two seeds. That is evidence that we
tested this broad family, on an earlier field.
[Imp pump implementation](../tools/algebra/blocks/ximps.js),
[stone implementations](../tools/algebra/blocks/xstones.js),
[recorded trials](hill-top30/block-gaps.md).

## Hex and Millwright

Hex starts several processes before copying its stone and paper. Its
stone performs two DAT writes per loop, one through a B-indirect target
and one through an A-postincrement target. The ADD moves the target
stream by twice `hStep`. A DJN.F stream supplies extra numeric damage.
The paper uses SPL and pointer-based MOVs to create subsequent copies,
adds a remote DAT write, and finishes its copy path through DJN.F.
Boot offsets, process distribution and paper steps jointly determine
how long both attacks retain useful work.
[Hex source](https://corewar.co.uk/cwtw2026/94x/hex.red).

Millwright uses three initial SPLs to create eight copy workers.
They copy one eight-cell paper chunk and two stone chunks to remote
locations. Several SPLs send additional entrants into the stone before
the workers take the paper branch. Its stone writes through both
fields of a bomb pointer and advances that pointer with ADD.F.
After the shared counter reaches zero, `MOV.I switch, bombing`
replaces the first bombing instruction with a jump into a forward DAT
clear. Its silk copies itself, advances a seed offset, restores the
copy pointer from that seed, and repeats.
[Millwright source](https://corewar.co.uk/cwtw2026/94x/millwright.red).

We built and tested this family directly. The
`fanboot-paper-stone` block exposes copy distances, worker count,
stone step/time, paper step/drift and the stone-to-clear choice.
Millwright's published structure is a close match to this interface.
Hex adds a different paper body and stone addressing schedule. A useful
follow-up would preserve each boot's actual worker allocation while
comparing paper bodies, rather than changing all constants together.
[Fan-boot implementation](../tools/algebra/blocks/fanboot.js),
[catalog](block-algebra-catalog.md),
[X block trials](hill-top30/block-gaps.md).

## Slayer, Spyglass and Iron Gate

Slayer begins at the SEQ scanner. ADD moves both scan addresses, which
are separated by eight cells. Its A-postincrement operand also alters
the remote A-field it references. A mismatch reaches the target setup
and wipe path. The wipe copies the SPL bomb through a postincrementing
target pointer. The tail contains an SPL-fed DAT clear with an
anti-imp operand in its DAT bomb. Its target copying, short wipe and
return-to-scan control share a compact piece of state.
[Slayer source](https://corewar.co.uk/cwtw2026/94x/slayer.red).

Spyglass has a deliberately small response. It advances a B-pointer
by 31, skips empty numeric fields with JMZ.F, guards its own eight-cell
image, and writes a DAT at the one cell found. It has no SPL flooding,
multi-cell wipe or later clear. Because 31 is coprime to 55,440,
its pointer can eventually visit every address. It shares its work
between looking and direct killing.
[Spyglass source](https://corewar.co.uk/cwtw2026/94x/spyglass.red).

Iron Gate compares cells 121 apart and advances the pair by 242. On a
find it writes a JMP and SPL backward, creating a trap for enemy
processes. Its final loop writes backward while the bomb's addressing
side effect supplies a decrement gate.
[Iron Gate source](https://corewar.co.uk/cwtw2026/94x/iron_gate_94x.red).

We have explored all three broad scanner responses. The library and
algebra include direct field scanners, paired comparison/wipe scanners,
Pendulum-style wipes and terminal clears. Our X-specific
`follow-scanner` also follows a found instruction's B-field to chase
imp arms. Prior work tested booted ladder scanners and follow-scanners.
That establishes real prior experiments with scanning and clears.
An exact source-level Slayer reproduction is absent from the records
reviewed here.
[Scanner blocks](../tools/algebra/blocks/scanners.js),
[pair/Pendulum blocks](../tools/algebra/blocks/hillscan.js),
[X scanner](../tools/algebra/blocks/xscanners.js),
[trial record](hill-top30/block-gaps.md).

## Other distinctive entries

Protekshun is another close relative of our stone/imp work. Its five-cell
launcher uses an increment carrying the 13-point stride 34,117, a SPL
branch and a DJN.F branch to dispatch A- and B-imps. Unlike our default
dual pump, both published imp templates use that same numeric stride.
The stone, its remote bomb, and the launcher are booted separately.
The eight-place finish does not establish why it lost places to Giant
Alien Force.
[Protekshun source](https://corewar.co.uk/cwtw2026/94x/protekshun.red),
[our dual pump](../tools/algebra/blocks/ximps.js).

Orca zoya's four opening MOVs are quickbombs with pointer side effects.
They perform no comparison-based detection. Its paper/stone body
therefore extends a family we have already explored with a short
up-front disturbance of core.
[Orca source](https://corewar.co.uk/cwtw2026/94x/orca_zoya.red),
[probe-burst blocks](../tools/algebra/blocks/hillopen.js).

REAMer's comments describe a Q3 quickscan, but the published image starts
at `warr` and contains no such comparison/decoder opening. The first
SPLs divide execution between two paper starts and a separate imp
launcher. The moving copy streams and DAT bombs carry different
increment/decrement effects. This is a paper/imp composition with
multiple competing streams, adjacent to existing silk, silk-tail and
vector-spiral capabilities.
[REAMer source](https://corewar.co.uk/cwtw2026/94x/reamer_dx_jbgc.red),
[imp blocks](../tools/algebra/blocks/imps.js),
[paper blocks](../tools/algebra/blocks/papers.js).

Evolved Reach and Evolved Rift both begin with SPL, MOV and DJN. Their
MOV and DJN use postincremented indirect pointers, combining instruction
copies with numeric corruption in very short active loops. Their
remaining 47 cells contain mixed arithmetic, jumps and DATs. Static
reading does not establish every reachable tail path after self-modification
or combat damage. We have run instruction evolution and have DJN streams
and copying attacks in the library, but these exact evolved loops
need a trace before claiming a compact block equivalent.
[Reach source](https://corewar.co.uk/cwtw2026/94x/evolved_reach.red),
[Rift source](https://corewar.co.uk/cwtw2026/94x/evolved_rift.red),
[evolution records](evolution-experiments.md).

## What we actually missed

The winners mainly combine mechanisms we already studied. The clearest
specific gap in the reviewed records is Giant Alien Force's compact
mirrored A-imp launcher and its scheduling beside that stone. We have
tested broader stone/pump compositions and paper/stone fan boots.
We should measure whether this launch geometry preserves useful
survivors against different opponents before attributing its first
place to diversity.

Our separate Molting experiments explored bounded openings followed by
relocation and clears. Their journal records that early frozen
specimens had a guard error and made zero opening attacks. Later E5
experiments corrected that. Those trials establish experience with
phase changes and relocation, with that qualification. They provide
no direct test of the mirrored imp launcher or Hex's multistage paper.
[Molting journal and E5 correction](molting-94x-journal.md).
