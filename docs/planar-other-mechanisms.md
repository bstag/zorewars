# Mechanisms worth studying in Planar's “other” category

Reviewed October 28, 2026. This is a focused source and author-post review of
selected mechanisms from the 305-source category, not a claim that every entry
was deeply reviewed. Primary texts were read from the hash-checked cache indexed
in [the Planar manifest](planar-warrior-history.json). Line numbers below refer
to the linked archive text, including its comments or message headers.

The most promising additions to our design vocabulary are **repairing a remote
partner**, **repeatedly refreshing small deployed attacks**, **detecting lost
work through a process schedule**, and **using enemy execution to report an
active location**. These are distinct mechanisms that can be combined with
ordinary bombing, clearing or relocation. They are not automatically working
94x blocks merely because their source assembles.

## Shortlist and portability

Lengths are the prior ingestion's unmodified-source assembly results for our
55,440-cell no-P-space `94x` profile. A numerical length means assembly succeeds;
it says nothing about survival, behavior or strength. This review did not run
battles or change source code.

| Source | 94x status | What merits attention |
|---|---:|---|
| [bunker, later variant](https://gallium.inria.fr/~doligez/corewar/rc/bunker[2].txt) | 25 instructions | Partner checksum, kill, restore and relaunch; core-dependent spacing makes unchanged 94x use suspect. |
| [bunker, earlier variant](https://gallium.inria.fr/~doligez/corewar/rc/bunker[1].txt) | 28 | Explicit monitoring and repair pipeline, with startup copies of both partners. |
| [Dwarfer](https://gallium.inria.fr/~doligez/corewar/rc/Dwarfer.txt) | 8 | Continually deploy and refresh two-instruction bombers. |
| [Dwarfer II](https://gallium.inria.fr/~doligez/corewar/rc/DwarferII.txt) | 20 | Similar distributed attack with a separate tracing/clear process. |
| [Airbag Demo](https://gallium.inria.fr/~doligez/corewar/rc/AirbagDemo.txt) | 21 | Missing work changes a shared pointer and triggers fallback. |
| [4-line Bomb Dodger](https://gallium.inria.fr/~doligez/corewar/rc/4-lineBombDodger.txt) | 4 | Very small reactive moving/copying mechanism, originally an IMT 2 proposal. |
| [Leaper-X 4.0](https://gallium.inria.fr/~doligez/corewar/rc/Leaper-X4.0.txt) | 16 | Clear a local region on both sides, then move; SPL phase eventually changes to DAT. |
| [Shoggoth 1.1](https://gallium.inria.fr/~doligez/corewar/rc/Shoggoth1.1.txt) | 21 | Process multiplicity supplies the repetitions for clearing and copying. |
| [RAIDAR](https://gallium.inria.fr/~doligez/corewar/rc/RAIDAR.txt) | 28 | Monitor two bands of markers, then relocate away from a disturbed band. |
| [dodgem6](https://gallium.inria.fr/~doligez/corewar/rc/dodgem6.txt) | 98; too long | Marker-triggered placement plus a checksum-selected backup payload. |
| [Antivamp](https://gallium.inria.fr/~doligez/corewar/rc/Antivamp.txt) | 3 | Follow the arithmetic in a vampire's fang toward its source/pit. |
| [tamper](https://gallium.inria.fr/~doligez/corewar/rc/tamper.txt) | 3 | Corrupt numeric fields rather than replace whole instructions. |
| [Signal 1.1](https://gallium.inria.fr/~doligez/corewar/rc/Signal1.1.txt) | 7 | Self-marker resets a decrement stream; the name does not establish inter-process messaging. |
| [sizer](https://gallium.inria.fr/~doligez/corewar/rc/sizer.txt) | 21 | Determine the core-size range at runtime; its outcomes are demonstration loops. |
| [Process Finder](https://gallium.inria.fr/~doligez/corewar/rc/ProcessFinder.txt) | Rejected | Execution-triggered reporting bomb; requires an 8000-cell core and P-space as published. |
| [Combatra](https://gallium.inria.fr/~doligez/corewar/rc/Combatra.txt) | Rejected | Learn an opponent's boot displacement across rounds, then attack relative to its decoy. |
| [Reinforcements v0.01a beta](https://gallium.inria.fr/~doligez/corewar/rc/Reinforcementsv0.01abeta.txt) | Rejected | In-warrior reinforcement learning for a special tournament; 62 instructions under `94x-hill`, still over 50. |
| [Evolver 520 x 200](https://gallium.inria.fr/~doligez/corewar/rc/Evolver520x200.txt) | 13 | Historical evolved scanner with hill-based training; useful as evidence, not as a certified portable recipe. |
| [VOTER](https://gallium.inria.fr/~doligez/corewar/rc/VOTER.txt) | Rejected | Triple-copy repair demonstration; 226 instructions and an unresolved entry label in this copy. |

## Repair is more than copying good code back

Paul Kline's bunker uses each partner's sum of B-operands as a damage detector.
On mismatch, it DAT-bombs the other partner, waits for processes created by SPL
damage to die, restores the code, then restarts it. The original explanation
explicitly identifies the kill/wait/restore ordering; merely overwriting bytes
does not repair the process queue. The later version reuses a pointer and
addresses decrement damage that previously caused the pair to destroy itself.
[Earlier post, lines 18–56 and 100–107](https://gallium.inria.fr/~doligez/corewar/post/bunker[1].txt),
[later post, lines 13–36](https://gallium.inria.fr/~doligez/corewar/post/bunker[2].txt).

The compactness is attractive, but both sources hardcode `space equ 4000`.
Their reciprocal partner arithmetic assumes that twice that spacing wraps the
8000-cell core. Their expected sums (`-2353` and `-388`) are tied to the actual
operands. **A 94x assembly pass does not preserve either relationship.** A
generator would have to derive both partner offsets and the checksum from its
emitted image. A B-field sum also misses pure opcode/A-field changes and can miss
multiple offsetting B-field changes; that is a limitation of the inspected
detector, not evidence of general instruction repair.
[Earlier source, lines 6–26](https://gallium.inria.fr/~doligez/corewar/rc/bunker[1].txt),
[later source, lines 6–24](https://gallium.inria.fr/~doligez/corewar/rc/bunker[2].txt).

**Proposed contract:** exact startup copies and mutual address resolution;
expected sum derived from emitted code; injected B-field/opcode/A-field faults;
simultaneous partner damage; observed termination of stray SPL processes before
restore; repeated recovery with no healthy partner overwritten. A correct test
must distinguish detecting a supported fault from merely surviving it.

VOTER shows an older three-copy approach, comparing corresponding cells and
repairing a disagreeing copy. Its archived version is not ready to run here:
the expanded body exceeds 200 instructions and `END start1` names no label.
Its useful contribution is the redundant-copy idea, not an existing compact
94x implementation.
[Source, lines 5–10, 25–48, 65–88, 105–130](https://gallium.inria.fr/~doligez/corewar/rc/VOTER.txt).

## Refresh small workers instead of repairing the whole warrior

Dwarfer's controller writes two worker instructions, starts that worker, advances
its destination, and repeats. Its author calls the repeated visits refreshing
damaged fighters. Dwarfer II adds a separate tracing/clearing strand while
retaining the worker deployment loop. This is a different strategy from bunker:
refresh occurs on a schedule, without first diagnosing the individual worker.
[Dwarfer source, lines 5–19](https://gallium.inria.fr/~doligez/corewar/rc/Dwarfer.txt),
[Dwarfer II source, lines 12–34](https://gallium.inria.fr/~doligez/corewar/rc/DwarferII.txt),
[Dwarfer author post](https://gallium.inria.fr/~doligez/corewar/post/Dwarfer.txt).

**Proposed contract:** derive the actual destination sequence including both
predecrements, not just the ADD constant; measure how soon a worker is revisited;
prove deployment avoids the controller and protected workers; inject a worker
fault and verify refresh restores useful execution; measure process growth and
controller starvation. This is an especially useful candidate for a compact
94x generator because the controller is small, but no win claim follows from
that size.

## Process scheduling can implement a detector or a copy loop

Airbag Demo creates five processes at selected points of a four-instruction
loop. The balanced side effects on a shared pointer keep its normal branch
working. If one loop instruction fails to execute, the pointer relationship
changes and the branch falls through to `phase2`. The fallback is only `JMP 0`
in the demo, so a surviving demo is not evidence of an effective attack.
[Source, lines 8–32](https://gallium.inria.fr/~doligez/corewar/rc/AirbagDemo.txt).
Moore's post explicitly instructs the reader to insert a DAT into a loop
instruction and observe the response.
[Author post, lines 24–46](https://gallium.inria.fr/~doligez/corewar/post/AirbagDemo.txt).

Shoggoth exploits a related scheduling fact for work rather than detection.
Sixteen processes each execute repeated clear instructions and then one MOV
copy instruction; the queue supplies the repetition needed to copy the moving
body. Its author explicitly describes this as “split-for-faster-copy,” in an
experimental-hill discussion.
[Source, lines 7–34](https://gallium.inria.fr/~doligez/corewar/rc/Shoggoth1.1.txt),
[author post, lines 13–14 and 53–55](https://gallium.inria.fr/~doligez/corewar/post/Shoggoth1.1.txt).

**Proposed contract:** process count, entry positions, and queue order are part
of the block interface; verify copy completion and fallback timing at several
queue caps, after losing a process, and after gaining unwanted processes.
These designs cannot be freely spliced into our one-process clear grammar.

## Movement: preserve the trigger and the complete traveling image

Leaper-X bombs on both sides before copying itself and jumping. Its author
describes the tradeoff: two-sided protection and a slightly unrolled bombing
loop, with SPL attacks before DAT. The source couples `lines`, `leap`, pointer
positions, and phase state. Constants `limit=250` and `reach=125` are historical
design choices, not the parameters of our current 94x profile.
[Source, lines 12–37](https://gallium.inria.fr/~doligez/corewar/rc/Leaper-X4.0.txt),
[author post, lines 13–23](https://gallium.inria.fr/~doligez/corewar/post/Leaper-X4.0.txt).

RAIDAR places marker bands and has separate panic paths for moving in opposite
directions. Its old source uses comparisons with immediate B operands and its
second copy loop names `pan` in the DJN, although its local label is `pan2`.
These are reasons to verify intended semantics and each branch, not silently
assume its modern assembly implements a faithful historical dodger.
[Source, lines 14–38](https://gallium.inria.fr/~doligez/corewar/rc/RAIDAR.txt).

dodgem6 checks many scattered markers, uses a checksum to choose between two
cargo copies, then positions its payload using a bombing-pattern assumption.
It is 98 instructions, so the idea requires a new compact design rather than
an unchanged 50-instruction entry. The source even has an intentional timeout
to avoid a self-tie; this must not be misdiagnosed as an accidental suicide.
[Source, lines 14–26, 43–46, 61–74](https://gallium.inria.fr/~doligez/corewar/rc/dodgem6.txt).

4-line Bomb Dodger is interesting because it gives a tiny trigger/copy/split
sequence to inspect. Its original post says the author missed the tournament
and had not yet tested it with the patched simulator. It is not historical
evidence of a winning design.
[Source, lines 7–10](https://gallium.inria.fr/~doligez/corewar/rc/4-lineBombDodger.txt),
[post, lines 17–20 and 37–39](https://gallium.inria.fr/~doligez/corewar/post/4-lineBombDodger.txt).

**Proposed contract:** marker initialization, false-trigger rate, trigger
latency, directional choice, exact copied body and state, and at least two
successive moves. Test a moving clear crossing the markers, not only arbitrary
single-cell damage. The historical experimental hill sometimes used read/write
limits; the archive explicitly warns that moving-but-not-replicating designs
can depend on those rules.
[Archive introduction](https://gallium.inria.fr/~doligez/corewar/).

## Enemy execution can become a measurement

Process Finder places a MOV bomb that writes its encoded location back to a
shared-core receiver if an enemy process executes it. The owner's STP then
stores that value. This is not privileged access to the opponent's process
queue: it requires the opponent to execute the planted instruction. Combatra
combines such a report with the located startup image to estimate boot
displacement for later rounds. Moore reports that results vary with discovery
time and which component is detected; a misleading imp launcher can make a
bad target even when the detector works.
[Process Finder source, lines 11–18](https://gallium.inria.fr/~doligez/corewar/rc/ProcessFinder.txt),
[Core Warrior 78, lines 385–426](https://gallium.inria.fr/~doligez/corewar/corewarrior/078.txt).

The published sources explicitly require 8000 cells, and P-space is forbidden
by our no-P-space 94x profile. Process Finder has six source instructions when
STP is included; an error-producing compile that omits unsupported STP is not
a valid five-instruction warrior. Combatra's full design is 100 instructions
under the intended settings, so neither is ready to drop into our 50-instruction
no-P-space work.
[Process Finder assertion](https://gallium.inria.fr/~doligez/corewar/rc/ProcessFinder.txt),
[Combatra source, lines 4–11 and 78–97](https://gallium.inria.fr/~doligez/corewar/rc/Combatra.txt).

**Proposed experiment:** a new in-round receiver could consume a report directly
without P-space, if its cost fits. Test exact bomb-to-receiver relocation,
whether the report came from execution rather than a passive hit, stale or
overwritten reports, multiple enemy components, and whether using the report
improves attack latency. This adaptation is a hypothesis, not implemented code.

## Tiny disruption, environment tests, and misleading names

tamper's DJN loop mutates numeric fields. Antivamp's SUB/MOV loop attempts to
trace vampire snares back toward their origin. Both fit easily, but their small
size does not establish coverage or self-safety on a new core. They suggest
separate disruption and feedback-directed-attack blocks with address-trace
tests, rather than grouping everything under generic bombing.
[tamper, lines 7–10](https://gallium.inria.fr/~doligez/corewar/rc/tamper.txt),
[Antivamp, lines 5–8](https://gallium.inria.fr/~doligez/corewar/rc/Antivamp.txt).

Signal 1.1 uses a marker to recognize its own decrement stream and reset its
pointer. It hardcodes 7990 and does not implement communication between two
cooperating processes. A generator should derive the boundary and test repeated
wraps rather than treat the name “Signal” as a behavioral classification.
[Source, lines 5–11](https://gallium.inria.fr/~doligez/corewar/rc/Signal1.1.txt).

sizer repeatedly divides the core-minus-one value to dispatch to a size bucket.
All buckets are `JMP 0` demonstrations. The original context is a tournament
with unknown core sizes below 64K. Our generators already receive CORESIZE, so
the useful lesson is deriving arithmetic relationships; spending runtime code
to discover a known parameter would usually be unnecessary.
[Source, lines 7–29](https://gallium.inria.fr/~doligez/corewar/rc/sizer.txt),
[author post, lines 14–21 and 38–57](https://gallium.inria.fr/~doligez/corewar/post/sizer.txt).

## Historical evolution is not the same as portable evolved code

Some “other” designs exploit a specific tournament setup. Certain Abuse's own
header says it predicts load locations from a P-space round counter and a table
for fixed `-F 4000` hill settings, with different values required for challenger
and defender. Hold still a minute...Thanks targets a 55440-cell core but labels
itself for `-F 27723` and likewise uses a persistent counter and table. These
are useful benchmark-leakage examples: a result against the matching historical
schedule is not general opponent detection. Keep load-sequence assumptions
explicit and test fresh placement schedules before interpreting strength.
[Certain Abuse, lines 4–12 and 21–35](https://gallium.inria.fr/~doligez/corewar/rc/CertainAbuse.txt),
[Hold still, lines 1–33](https://gallium.inria.fr/~doligez/corewar/rc/Holdstillaminute...Thanks.txt).

Evolver 520 x 200's post announces YACE's new hill-based evolution mode, calls
this result its first evolved scanner, and explicitly says it is not a very
good warrior. The source has no restrictive core assertion even though its
operands repeatedly cluster near 800. The post alone does not prove a Red Queen
champion-history algorithm, and successful 94x assembly does not establish that
the evolved address relationships survive a 55,440-cell core.
[Source](https://gallium.inria.fr/~doligez/corewar/rc/Evolver520x200.txt),
[author post, lines 26–43 and 67–68](https://gallium.inria.fr/~doligez/corewar/post/Evolver520x200.txt).

Reinforcements is a different use of learning: the warrior maintains values for
36 two-round states and chooses between TimeScape and Carbonite. Its author
notes lack of exploratory actions and a brainwashing failure. This was a
special tournament controller, not the outside-the-VM algorithm that breeds
our warriors. Its 62-instruction P-space-enabled assembly still exceeds 50.
[Source, lines 5–44 and 64–100](https://gallium.inria.fr/~doligez/corewar/rc/Reinforcementsv0.01abeta.txt).

For our next design work, the strongest first choices are a **derived,
fault-tested repair pair**, a **safe distributed-worker refresher**, and a
**compact relocation trigger**. Execution-reporting bombs are a more speculative
fourth option. Select among them using the [matched screen](planar-other-review.md) and
behavioral gates; this source review alone does not establish a winner.
