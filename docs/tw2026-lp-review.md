# How the 2026 limited-process entrants worked

This is a source review of all 15 published LP entries, compared with the
current local block library and experiment notes. Places below are
tournament places. The downloaded sources and compilation sizes are
recorded in the benchmark manifest. A ranking alone cannot identify a
warrior's nearest SD neighbor or establish which mechanism earned its
place. The original tournament matchup matrix is unavailable.
[Tournament results](https://corewar.co.uk/tournamentweekend2026.htm),
[local manifest](../imported/tournament-weekend-2026/manifest.json)

## The winner and the closest comparisons

**Amethystine Python, first place, 38 cells.** It begins by copying a
one-cell imp to a remote address. One scanner process compares two
whole instructions ten cells apart. Its ADD and the predecrement on
the loop together advance the probe pair by 20 cells. When the probes
differ, it copies their fields into a separate clear pointer and
starts the clear while the continuation launches the remote imp and
can fall through into the local imp instruction. The clear writes an
SPL-derived instruction and a backward JMP in successive cells. Its
A-indirect bomb selector and postincrement DJN stream provide the
subsequent DAT phase. This combines finding a target, trapping its
processes, killing them, and retaining an independent survival route.
The exact timing of the phase change under eight processes deserves a
trace before extracting a faithful block.
[Published source](https://corewar.co.uk/cwtw2026/lp/amethystine_python.red),
[local source](../imported/tournament-weekend-2026/lp/amethystine_python.red)

We already explored the ingredients. The LP self-hit scanner has paired
probes, SPL/JMP stun and a DAT endgame. Our Cobra-with-imp block also
combines a scanner, a pumped clear and an imp failsafe. Existing notes
record actual trials of that failsafe and explain how process sharing
can let the clear catch the imp. Python uses a different scan trigger,
bomb selection and clear layout. The Cobra experiment was on a
different field, so its reported gain does not establish an LP result
for Python's arrangement.
[LP scanner](../tools/algebra/blocks/lp-selfhit-scanner.js),
[Cobra implementation](../tools/algebra/blocks/hillscan2.js),
[recorded Cobra trials](hill-recipe-book.md)

**Escapement, second place, 50 cells.** Our entrant runs two backward
copying papers and a single-process scanner at once. One paper changes
its scatter offsets using SUB against its restart instruction. The
other doubles its scatter offsets. The scanner compares fields at two
locations, installs SPL/JMP traps on a find, then reaches a backward
DAT clear when its own deliberate trip cell changes. The strategy is
to keep replicating while another part looks for a killing opportunity.
The clear can also wipe friendly paper copies. This exact combination
is represented by our twin-paper/scanner block, and the standalone
scanner has prior benchmark results. Those results establish tested
components, while the tournament finish establishes the submitted
combination's result.
[Published source](https://corewar.co.uk/cwtw2026/lp/escapement.red),
[twin-paper and scanner blocks](../tools/algebra/blocks/lp-looping-paper.js),
[earlier scanner measurements](hill-top30/block-gaps.md)

**Replicant--lp, third place, nine cells.** Each copy lap moves a cell
of the program backward and places DAT bombs through two destinations.
The arithmetic advances the attack while copying continues. A SPL
restarts the source, and a guarded JMZ transfers the continuing process
into the completed copy. This transfer remains useful when the process
queue is already full. We have counted-copy papers and a DAT-dropping
paper, and we tested what extra bombing contributes to low-process
replication. The exact two-destination loop and indirect arithmetic
here are a useful narrower comparison.
[Published source](https://corewar.co.uk/cwtw2026/lp/replicant_lp.red),
[LP paper blocks](block-algebra-catalog.md),
[copy and scatter controls](lp-top-ten.md)

**inner truth, fourth place, 19 cells.** The author identifies this as
evolved code. Its executable body contains a backward copy loop, a
source counter, SPL restart and guarded JMZ transfer, surrounded by
arithmetic and pointer side effects. It therefore has a recognizable
counted-copy paper mechanism despite the irregular image. The unused
or indirectly reached cells should remain in the image when testing
it. Our scatter and twin papers cover the central copy/restart idea.
I found no local controlled study of this exact evolved body.
[Published source](https://corewar.co.uk/cwtw2026/lp/inner_truth.red),
[scatter paper study](lp-top-ten.md),
[twin-paper block](../tools/algebra/blocks/lp-looping-paper.js)

## The distinctive alternatives

**Photon Storm, ninth place, 22 cells.** A shared boot deploys a
five-cell counted-copy paper and two three-cell moving workers.
Each worker writes its JMP ahead, copies another instruction through
predecremented pointers, then jumps onward while modifying a remote
field. These hopping workers add mobility to the paper's replication.
We explored moving-imp silk tails and relocating clears, but their
process requirements and movement rules differ. I found no exact
low-process three-cell hopper block or measured paper-plus-two-hopper
experiment in the inspected notes.
[Published source](https://corewar.co.uk/cwtw2026/lp/photon_storm.red),
[moving-imp silk](../tools/algebra/blocks/hillimps.js),
[LP relocating-clear measurements](hill-top30/block-gaps.md)

**Harpoon-LP-06, eleventh place, 15 cells.** Its launch plants a
three-point imp ring at offsets 2,667 apart, then leaves a process
scanning and bombing occupied cells. The DAT bomb's predecrements
also attack conventional imp spacing, and the scan's jump maintains a
decrementing gate. We have LP imp launchers, an imp bomber and scanners.
That gives us the ingredients for this scanner-plus-spiral arrangement.
The imp bomber's recorded benchmark is a different design, and I found
no matched trial of Harpoon's exact process allocation.
[Published source](https://corewar.co.uk/cwtw2026/lp/harpoon-lp-06.red),
[LP imp and bomber blocks](block-algebra-catalog.md),
[recorded LP block benchmarks](hill-top30/block-gaps.md)

**Rodents and Hell Kitty, fourteenth and fifteenth.** Rodents is the
seven-cell R.O.U.S. paper with new constants. It copies backward,
scatters through moving pointers, doubles the scatter offsets and
restarts through SPL/JMZ. Hell Kitty adds an initial series of
unconditional remote copies before the same family of paper. We
studied R.O.U.S. directly, built a scatter-paper block and compared it
with a control that removed scattering. The organizer's recap
attributes these two entries' low diversity placements to similar
matchup profiles among bombing papers. Their exact SD neighbors still
require the tournament matrix.
[Rodents source](https://corewar.co.uk/cwtw2026/lp/rodents.red),
[Hell Kitty source](https://corewar.co.uk/cwtw2026/lp/hell_kitty_pqfc.red),
[our measured scatter controls](lp-top-ten.md),
[recap preserved in tournament notes](tournament-weekend-2026.md)

## Complete field inventory

| Place | Entrant | Main mechanism read from the source | Closest local exploration |
| ---: | --- | --- | --- |
| 1 | Amethystine Python | Pair scan, SPL/JMP-to-DAT clear, remote imp fallback | LP paired stun scanner and Cobra imp failsafe, with earlier trials |
| 2 | Escapement | Two bombing papers plus one scanner and backward DAT clear | Our submitted combination and twin-paper/scanner block |
| 3 | Replicant--lp | Counted-copy paper with two DAT attack destinations | Stream/scatter papers and copy controls |
| 4 | inner truth | Evolved counted-copy paper with irregular pointer effects | Scatter and looping papers, exact body unstudied |
| 5 | Evolved Lantern | Irregular evolved image with an initial SPL/MOV/DJN loop and pointer-driven writes | Instruction evolution broadly, exact reachable behavior needs tracing |
| 6 | Gemini LP ilcv | A backward-copy paper beside an ADD/JMZ scanner, stun write and decrementing writes | Escapement's paper/scanner composition, different loop and allocation |
| 7 | Snow White and the Seven Dwarfs | Several fixed-step bombers, a backward clear and imp launches | LP bombers and imp blocks, no exact arrangement found |
| 8 | Evolved Sleet | Irregular evolved SPL/MOV/DJN image with scattered data cells | Instruction evolution broadly, exact reachable behavior needs tracing |
| 9 | Photon Storm | Booted paper with two moving three-cell workers | Mobility explored through different silk tails and relocating clears |
| 10 | Iron Gate LP | Two-stage comparison scan, SPL/JMP trapping and a decrementing continuation | Paired stun scanner and scanner-to-clear blocks |
| 11 | Harpoon-LP-06 | Occupancy scanner plus planted three-point imp spiral | LP imp launchers, imp bomber and scanners |
| 12 | conflict | Evolved repeated DJN streams and one-cell imp instructions | DJN streams and imp bombers, exact runtime arrangement unstudied |
| 13 | Spindle | Two counted-copy papers, one using SUB drift and the other ADD drift | Our submitted twin-paper design and parameterized block |
| 14 | Rodents | Seven-cell doubling-scatter R.O.U.S. paper | Direct source study and measured scatter controls |
| 15 | Hell Kitty pqfc | R.O.U.S.-family paper preceded by an unconditional quickbomb burst | Scatter paper plus burst openings, exact burst unmeasured |

Each inventory classification comes from the corresponding source in
the local LP snapshot. The manifest supplies the published links,
authors and source hashes. “Exact body unstudied” means no matching
controlled experiment was located in the inspected repository notes.
[LP source snapshot](../imported/tournament-weekend-2026/lp),
[manifest](../imported/tournament-weekend-2026/manifest.json)

The clearest follow-up is to trace Python's phase transition under the
eight-slot queue, then compare the clear with and without its imp
fallback on the same field. Photon Storm offers another concrete
question, whether two mobile workers improve the paper against a
different subset of leaders. Our earlier Bronze study shows why each
hybrid should be tested against single-component controls, since the
extra worker can consume turns or damage its partner.
[earlier hybrid controls](lp-bronze-paper.md)
