# What the 2026 tournament warriors did

Reviewed November 17, 2026. All 50 published entries were read across
the four divisions and compared with ZoreWars source, blocks and saved
experiment notes. The review emphasizes the winners, distinctive
compositions and our eight entries. Details and the complete inventories
are in the [LP review](tw2026-lp-review.md),
[’88 review](tw2026-88-review.md),
[94nop review](tw2026-94nop-review.md)
and [94x review](tw2026-94x-review.md).

The strongest entries combine mechanisms we already knew with specific
launch schedules, pointer tricks and phase transitions. We had studied
most of the families before the tournament. Several exact combinations
remain useful questions for experiments.

| Winner | How it works | What we had explored |
| --- | --- | --- |
| Amethystine Python, LP | A paired scanner finds a target, starts an SPL/JMP trap and later DAT killing pass, and launches a remote one-cell imp for survival. | Paired LP scanners, stun-to-kill transitions and Cobra's imp fallback were studied. Python's exact eight-process layout and timing remain untested locally. |
| Plasmograph, ’88 | Copies a ten-cell scanner away from the original. It lays SPL bombs while comparing and scanning, redirects the attack on a difference, then finishes with a DAT clear. | Blur scanners were studied and implemented in ’94. Strict-’88 scan-and-carpet mechanics are a specific gap in the reviewed records. |
| Nova, 94nop | A paired scan triggers a loop that both stuns the target and copies an eight-cell clear elsewhere. The clear changes its selected payload as it overwrites its own pointer. | Pointer-overwrite clears and relocating staged clears were studied. This scan-guided stun-and-deploy arrangement was not found among our controlled experiments. |
| Giant Alien Force, 94x | Separately boots a bomber and mirrored imp launcher. Two A-indirect imp streams begin half a core apart while the bomber keeps attacking. | Stone/imp fan boots and dual pumps were actually tested. The half-core mirrored launcher is a different geometry from our existing dual-pump experiment. |

These mechanisms are read from the published
[Python](https://corewar.co.uk/cwtw2026/lp/amethystine_python.red),
[Plasmograph](https://corewar.co.uk/cwtw2026/88/plasmograph.red),
[Nova](https://corewar.co.uk/cwtw2026/94/nova.red)
and [Giant Alien Force](https://corewar.co.uk/cwtw2026/94x/giant_alien_force.red)
sources. Prior-work evidence and its qualifications are linked in the
division reviews.

## Where we already had close equivalents

Escapement is our two-paper/scanner composition. Shadow Gauge is our
booted B-field scanner with a clear and decoy. Coil 31 is our 31-point
imp spiral. Burin is our unrolled paired-scan oneshot. Spyglass is our
small direct-DAT scanner. Spindle is our two-paper arrangement.
Millwright and Mallet use our fan-booted paper/stone and stone/imp
compositions. Their published results therefore provide direct evidence
for those submitted arrangements.
[Published entrant sources and places](https://corewar.co.uk/tournamentweekend2026.htm)

Clairvoyance's staged prescan, wipe and main scan also has a close
precedent in our October source review of Infravision. We had read that
architecture before submission. Hex's paper/stone and the Arvon-derived
94nop entrants belong to extensively studied families. Rodents and
Hell Kitty use the R.O.U.S. family, which we had studied with measured
copy/scatter controls.
[October recipe book](hill-recipe-book.md),
[LP source study and controls](lp-top-ten.md)

Some additional ’88 mechanisms are now represented because of the
post-tournament top-100/ranks-101–200 study. Those new blocks and trials
show present coverage. Their existence does not establish that we had
tested them before submission.
[Dated follow-up evidence](tw2026-88-review.md),
[2027 ’88 niche study](tw2027-88-niches.md)

## Distinctive combinations worth isolating

- Python's clear and imp fallback under the eight-slot queue. Compare
  the complete design with the same clear without the imp fallback.
- Plasmograph's strict-’88 scan-and-carpet loop. Compare it with our
  scanner that interrupts scanning to wipe a target.
- Nova's target-guided clear deployment. Compare its scan-guided move
  with a fixed-address boot while preserving the clear.
- Giant Alien Force's mirrored imp launch. Compare its launch geometry
  with our dual-pump baseline while retaining the same stone.
- Photon Storm's paper plus two three-cell hopping workers. We explored
  moving silk tails and relocating clears, but found no exact measured
  equivalent of this LP composition.
- Spear of Osiris 50's paper plus remote microwarrior workers. We have
  the broad ingredients, including newly added ’88 worker blocks, with
  no documented test of this exact combined arrangement.

Each comparison needs the same opponents and placements, then fresh
seeds. Useful observations include first useful attack, successful copy,
actual phase transition, process allocation and friendly interference.
Compare per-opponent results and paired push-off places as well as
average points.

## What the sources cannot establish

The tournament matchup matrix is still unavailable. A winning entry's
rank establishes its result, while its code explains its intended
mechanisms. The code and reported elimination snapshots cannot
identify its closest SD neighbor or quantify how much a particular
instruction improved diversity.

Evolved entrants can contain code whose execution depends on pointer
mutation or combat damage. The division reviews describe identifiable
opening loops and mark unresolved later behavior. This review adds no
new battles or full instruction traces. Prior measurements retain their
original field and seed limitations.
