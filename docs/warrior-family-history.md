# What warrior history can teach our generator

Research snapshot: 2026-10-28 UTC (2026-10-27 in Chicago). This note traces
representative families through original warrior sources, author posts and
contemporary newsletters. It is a design history, not an exhaustive genealogy
or a claim that later warriors always beat earlier ones. Source originals stay
in ignored `imported/`; this document contains analysis and links.

The [full Planar source index](planar-warrior-history.md), added October 28,
2026, preserves 1,686 index entries, 1,683 distinct source files and 852 linked
texts. Its [14-component breakdown](planar-components.md) is cross-referenced
to our block catalog. Original posts are separate from maintainer assembly
copies; archive-date precision, shared-source ambiguities and overlap with
n1LS are recorded explicitly.

The [other-category review](planar-other-review.md) follows this with source
analysis of repair pairs, remote-worker refresh, process-scheduled detection,
movement and arithmetic disruption, plus a limited 94x screen. These mechanisms
add reference candidates to our block catalog; they are not executable recipes.

The [n1LS collection](n1ls-warrior-history.md), added October 28, 2026, expands
this history with 567 pinned Redcode files, source version notes, compatibility
checks and duplicate detection. Agony, Charon, Imprimis and Sphinx provide
additional version series; repository upload dates are kept separate from
warrior dates. [Browse the collection](n1ls-warrior-index.md).

The eight additionally downloaded warrior versions are indexed with source
URLs, hashes and date-evidence notes in [the source manifest](warrior-history-sources.json).
The first implemented follow-up is [Lifeboat 94x](../examples/experimental-94x/lifeboat/README.md);
its results and limitations are recorded in [journal E7](molting-94x-journal.md).

The strongest recurring pattern is **better cooperation between parts**:
launchers place attacks safely, process schedules sustain replication, scanners
hand useful pointers to attacks, and a damaged or exhausted attack changes into
a suitable endgame. Our generator should evolve those relationships under
explicit constraints, rather than freely splice instructions.

## How to read the dates and relationships

- **Dated primary evidence** means an original post, an issue date, or a date in
  the author's source. An appearance in a newsletter establishes existence by
  that date, not the exact invention date.
- **Archive date** means the maintainer's release metadata. It can identify a
  later repost or version, so it is weaker evidence for first appearance.
- **Confirmed lineage** requires an author credit, explicit replacement, or
  version note. Similar code or a shared family name alone establishes a useful
  comparison, not descent.
- **Observed now** means a source was retrieved in our current leader study.
  It does not establish when that source was written.

This distinction already prevents mistakes in our catalog: Agony II appears in
the October 31, 1994 hill report, although our encyclopedia says 1995. Torch t8
appears in August 1994; the archived **t18** version is dated 1996. Those facts
are compatible when family age and version date are separate. No encyclopedia
dates were silently changed by this research.
[The '94 Warrior #12](https://www.corewar.info/corewarrior/94warrior/12.htm),
[The '94 Warrior #13](https://www.corewar.info/corewarrior/94warrior/13.htm),
[archive release index](https://gallium.inria.fr/~doligez/corewar/by-date/complete.htm).

## Dated milestones

| Evidence date | What we can establish | Why it matters |
|---|---|---|
| May 1984 | Dewdney introduced Core War publicly; the original material describes bombing, copying and moving programs. | Small contrasting baselines belong in our test set. [Original article record](https://www.scientificamerican.com/article/computer-recreations-1984-05/), [original article scan](https://wkbpic.com/wkbx/SA/1984/1984-05-01.pdf). |
| 1986; 1990 | The archive places MICE in 1986; Stone and Scissors identify ICWST'90 in their own headers. | Replication, bombing and scan/attack combinations are old families, not new discoveries when regenerated. [MICE](https://gallium.inria.fr/~doligez/corewar/rc/MICE.txt), [Stone](https://gallium.inria.fr/~doligez/corewar/rc/Stone.txt), [Scissors](https://gallium.inria.fr/~doligez/corewar/rc/Scissors.txt), [archive dates](https://gallium.inria.fr/~doligez/corewar/by-date/complete.htm). |
| October 14, 1992 | Anders Ivner's original post explains cyclic imps, layers, launch vulnerability and tie-heavy matchups. | Arithmetic and process ordering are inseparable from the imp instruction. [Author's post](https://gallium.inria.fr/~doligez/corewar/post/trident+TheIMPirestrikesback.txt). |
| August 10, 1994 | Pohjalainen posted Silk Warrior 1.3, with notes on distribution, self-testing and earlier versions. | Replication speed is a process-scheduling problem as well as a copy-loop problem. [Original post](https://gallium.inria.fr/~doligez/corewar/post/SilkWarrior1.3.txt). |
| November 30, 1994 | A contemporary quickscan discussion supplies '88 and '94 prototypes and discusses scan coverage. | Faster openings predate modern decoders; their instruction cost still matters. [The '94 Warrior #14](https://www.corewar.info/corewarrior/94warrior/14.htm). |
| August–September 1995 | The archive associates a P-space demo with pMARS 0.8.0 on August 6; myVamp v3.7's author gives September 30 as its submission date. | Persistent selection and compact capture/clear combinations became separate design dimensions. [P-space demo](https://gallium.inria.fr/~doligez/corewar/rc/P-spacedemo.txt), [archive date](https://gallium.inria.fr/~doligez/corewar/by-date/complete.htm), [myVamp source](https://gallium.inria.fr/~doligez/corewar/rc/myVampv3.7.txt). |
| July 8, 1996 issue | Ivner explains Q² in Core Warrior #37. Its Usenet posting header is July 7; the issue itself says July 8. | Earlier reaction and compact decoding are distinct from simply scanning more locations. [Contemporary issue](https://www.corewar.info/corewarrior/cw/037.txt). |
| May 28 / September 2, 1999 | Core Warrior #73 presents Humberto/Metcalf Q³; #75 presents a compact Q³ form. | Multiplication-based decoding and embedded constants reduce overhead, but introduce coupled parameters. [#73](https://www.corewar.info/corewarrior/cw/073.txt), [#75](https://www.corewar.info/corewarrior/cw/075.txt). |
| December 8, 2002 | Core Warrior #84 discusses quickscan correctness using all placement permutations against a simple stationary target. | Historical developers already separated semantic tests from aggregate scores. [#84](https://www.corewar.info/corewarrior/cw/084.txt). |
| April 2004 in source | Fatamorgana X describes a persistent controller, several attacks, and additional entry/result logic. | Portfolio selection is a different evolutionary problem from composing one no-P-space warrior. [Source](https://asdflkj.net/COREWAR/X/HILL32/fatamorganaX.red). |
| Current source snapshot | Arvon and pst_v4 explicitly credit earlier components; our LP leaders range from a seven-instruction body to padded 200-instruction recipes. | Modern leaders still refine old families and their interfaces. [Arvon](https://asdflkj.net/COREWAR/94/HILL32/arvon.red), [pst_v4](https://asdflkj.net/COREWAR/94/HILL32/pst_v4.red), [LP sources and measurements](hill-leaders.md). |

## The families and the changes worth borrowing

### Stones and bombers: from a stride to an attack lifecycle

The archived Dwarf is a tiny arithmetic stride and DAT bomb. Torch t18 combines
incendiary bombing, a clear, booting and decoys; its author notes that this
version restores the boot/decoy and uses a zero test rather than a decrementing
loop in the bombing stage. Tornado 3.0 describes a changed clear and a decoy
maker instead of a boot. These are documented design alternatives, not a simple
sequence in which every addition is better.
[Dwarf](https://gallium.inria.fr/~doligez/corewar/rc/Dwarf.txt),
[Torch t18](https://gallium.inria.fr/~doligez/corewar/rc/Torcht18.txt),
[Tornado 3.0](https://gallium.inria.fr/~doligez/corewar/rc/Tornado3.0.txt).

A particularly useful **confirmed relationship** is in Thermite II: its source
includes the Brand 3.3 body and credits Torch, while describing changes to its
scan, anti-paper settings and launcher. It demonstrates an opening/body/endgame
recipe whose parts were deliberately tuned together.
[Thermite II source](https://gallium.inria.fr/~doligez/corewar/rc/ThermiteII.txt).

**Generator lesson:** model placement, stride, bombing duration, trigger and
fallback as separate choices with joint safety constraints. Compare booted and
unbooted variants. Measure time to first bomb and time to first fallback write,
not just survival. A stone's stride and bomb side effects must be checked against
the actual core size and every protected region.

### Scanners, quickscans and one-shots: buy information, then exploit it

Scissors' source already combines scanning and an attack loop. Iron Gate uses
comparisons plus SPL/JMP bombing and pointer arithmetic. Blur 2 describes a scan
that lays an SPL carpet before a DAT/DJN endgame. Frontwards v2 explicitly
identifies a one-shot/two-pass design and documents modular constraints that keep
its scan, decrement stream and decoy from damaging one another.
[Scissors](https://gallium.inria.fr/~doligez/corewar/rc/Scissors.txt),
[Iron Gate](https://gallium.inria.fr/~doligez/corewar/rc/IronGate%5B2%5D.txt),
[Blur 2](https://gallium.inria.fr/~doligez/corewar/rc/Blur2.txt),
[Frontwards v2](https://gallium.inria.fr/~doligez/corewar/rc/Frontwardsv2.txt).

Quickscans pursue a different budget: many early probes, compact decoding, a
short targeted attack, then a backup warrior. Q², Q³ and compact Q³ document
changes in how a hit selects and computes the target. Their decoder constants
are part of the probe geometry, not free unrelated numbers.
[Q² by Ivner](https://www.corewar.info/corewarrior/cw/037.txt),
[Q³ by Humberto and Metcalf](https://www.corewar.info/corewarrior/cw/073.txt),
[compact Q³](https://www.corewar.info/corewarrior/cw/075.txt).

**Generator lesson:** add a small compare-scan/one-shot before a large quickscan.
For a quickscan, derive tables and decoder constants from a legal parameterization.
Test each probe with injected targets and ensure the correct cell is attacked.
Disable the backup while testing coverage, following the stationary-target
method in [Core Warrior #84](https://www.corewar.info/corewarrior/cw/084.txt).
Then restore the backup and measure whether the information pays for its startup
time and instruction footprint.

### Clears and gates: the handoff is often the real innovation

A clear is not merely a MOV loop. Frontwards' two-pass setup, Blur's carpet then
DAT/DJN transition, and Torch's clear/gate placement demonstrate different
endgames and handoffs. A later contemporary scanner discussion distinguishes
switching into a clear from keeping the scan running while changing to DAT
attacks; these are distinct recipes worth comparing.
[Frontwards](https://gallium.inria.fr/~doligez/corewar/rc/Frontwardsv2.txt),
[Blur 2](https://gallium.inria.fr/~doligez/corewar/rc/Blur2.txt),
[Torch](https://gallium.inria.fr/~doligez/corewar/rc/Torcht18.txt),
[Core Warrior #89](https://www.corewar.info/corewarrior/cw/089.txt).

**Generator lesson:** specify where the clear starts, what it excludes, who owns
its counters, whether it returns, and how it defeats or merely delays an imp.
Preserve negative evidence: our earlier short-stun result had a matchup benefit
but lost badly to Mice, and solo correctness did not establish effective opening
attacks. See [our experiment journal](molting-94x-journal.md).

### Papers and silk: replication became a scheduling mechanism

MICE copies a body backwards, launches it and advances the destination. Silk
Warrior's own version notes discuss distribution and self-testing. TimeScape
describes cooperating replication cells and explicitly calls out the processes
needed to sustain them. These are increasingly intertwined copy/launch schedules,
not interchangeable copy subroutines.
[MICE](https://gallium.inria.fr/~doligez/corewar/rc/MICE.txt),
[Silk Warrior 1.3](https://gallium.inria.fr/~doligez/corewar/rc/SilkWarrior1.3.txt),
[TimeScape 1.0](https://gallium.inria.fr/~doligez/corewar/rc/TimeScape(1.0).txt).

Current sources provide stronger lineage evidence than broad similarity:
Arvon credits Azathoth's decoding/body patterns and its author's pst_v3/v4 line;
pst_v4 credits Azathoth's launcher/stone/paper and Eternal Exile's quickscanner.
The reused body and changed front end should be counted as related variants,
not three independently invented species.
[Arvon](https://asdflkj.net/COREWAR/94/HILL32/arvon.red),
[Azathoth](https://asdflkj.net/COREWAR/94/HILL32/azathoth.red),
[pst_v4](https://asdflkj.net/COREWAR/94/HILL32/pst_v4.red).

**Generator lesson:** certify a launcher plus paper as one recipe first. Track
parent and child entry, copy direction, initial queue order and copied span.
Only then permit the generator to vary the fan-out, copy destinations or paired
stone. A copied span may include blank cells outside the visible instruction body.

### Imps and launchers: one instruction, many scheduling constraints

Ivner's 1992 post explains the arithmetic relation for a three-point imp and a
layered version, but also records launch-time vulnerability and weak winning
power against fast process growth. Cannonade's own strategy combines a stone
with gate-breaking imp spirals. Freight Train later exposes a seven-point imp,
dual continuous launchers, a stone, and an optional quickscan switch.
[Original imp post](https://gallium.inria.fr/~doligez/corewar/post/trident+TheIMPirestrikesback.txt),
[Cannonade](https://gallium.inria.fr/~doligez/corewar/rc/Cannonade.txt),
[Freight Train](https://asdflkj.net/COREWAR/88/HILL32/freighttrainv02.red).

**Generator lesson:** derive the stride from the intended number of points and
core congruence; do not tune it independently. Include seeding, launch order,
continuous-launch timing and process budget in the block. Optimize wins and
matchup diversity as well as survival, or selection may favor a tie machine.

### Vampires: capture needs both a destination and an endgame

PIPER is an early archive example, but its metadata says tournament 1987 **or**
1988 and does not identify an author reliably. Treat that as an uncertain early
anchor. myVamp v3.7 has a clear author-supplied September 1995 submission date
and combines jump bombing, opportunistic scanning and a multi-phase clear.
[PIPER source](https://gallium.inria.fr/~doligez/corewar/rc/PIPER.txt),
[archive metadata](https://gallium.inria.fr/~doligez/corewar/by-date/complete.htm),
[myVamp source](https://gallium.inria.fr/~doligez/corewar/rc/myVampv3.7.txt).

The August 1994 hill report explicitly associates vampire losses with stronger
replicators and easier anti-vampire measures using A-field indirection. That is
evidence of a changing opponent environment, not proof that vampires became
universally obsolete.
[Contemporary report](https://www.corewar.info/corewarrior/94warrior/12.htm).

**Generator lesson:** fang and pit are one linked behavior. Test the fang from
its landing address, confirm that captured enemy processes enter the intended
pit, and distinguish conversion from elimination. Copying a fang instruction
without its relocation equation is not a valid extraction.

### P-space and 94x: evolving a portfolio is different from evolving an attack

P-space persists between rounds and supplies result-dependent behavior; pMARS
documents it as a distinct memory area. The public X hill currently permits it,
while our no-P-space `94x` tournament profile does not.
[pMARS manual](https://sources.debian.org/src/pmars/0.9.5-1/doc/pmars.txt),
[published Koenigstuhl settings](https://asdflkj.net/COREWAR/koenigstuhl.html).

Fire and Ice II selects between a stone with a fallback clear and an anti-imp
scanner. Fire and Brimstone explicitly says that it replaces the scanner with
Kenshin: that is a **confirmed component substitution**. Fatamorgana X's April
2004 source packages multiple attacks with a more extensive persistent selector
and entry logic. The exact first-publication dates of the two Fire sources were
not established in this pass.
[Fire and Ice II](https://asdflkj.net/COREWAR/X/HILL32/fireandice2.red),
[Fire and Brimstone](https://asdflkj.net/COREWAR/X/HILL32/fireandbrim.red),
[Fatamorgana X](https://asdflkj.net/COREWAR/X/HILL32/fatamorganaX.red).

**Generator lesson:** first implement and test a P-space-free attack recipe.
Later evolve a small controller over certified attacks under `94x-hill`, with
first-round, win/loss/tie, corrupted-state and multi-round tests. Removing a
controller does not necessarily remove all P-space instructions: Fire and Ice's
scanner includes an STP bomb. A solo failure in a stateful original is diagnostic
evidence, not automatically a reason to call its published ranking invalid.

### Limited-process variants: process scarcity changes the best structure

The current LP source set contains R.O.U.S.'s compact bombing paper,
Replinator's quickscan/paper layout, and Bronze minotaur's separated papers.
Their source creation dates are not established here. Their similarities are
a **family comparison**, not a proven chain of descent. Our local tests already
show why the distinction matters: the compact original and larger padded
recipes do not share identical solo behavior.
[R.O.U.S.](https://asdflkj.net/COREWAR/LP/HILL32/rous.red),
[Replinator](https://asdflkj.net/COREWAR/LP/HILL32/l111.red),
[Bronze minotaur](https://asdflkj.net/COREWAR/LP/HILL32/bronzeminotaur.red),
[local observations](hill-leaders.md).

**Generator lesson:** LP deserves a separate process-aware recipe and training
panel. Varying a normal silk launcher's constants is not enough. Record peak
queue size, which children are actually admitted, and the second generation's
copy behavior. Keep the source hill's 200-instruction rules separate from our
short-entry experiments.

### Plane and volume: our experimental extension

Our torus heading/vector rules are a ZoreWars extension, not another historical
ICWS dialect. Existing plane/volume warriors and the prototype failure notes
are local research evidence. Their movement and coverage contracts should not
be inferred from successful ring warriors.
[Local prototype notes](../warriors/prototypes/README.md),
[engine geometry](../src/engine/topology.js),
[instruction catalog](block-instructions.json).

## What this changes in our build plan

### Concrete version comparisons collected for experiments

We now have several actual versions to compare, rather than only family labels.
The following dates are archive release metadata unless the row says otherwise;
the changes are visible in the retrieved source. They establish what changed,
not that the change improved performance under our rules.

| Versions | Observed change | Experiment to borrow |
|---|---|---|
| Torch t3 (June 16, 1994) → t5 (June 21, 1994) | The stride update changes from direct addressing to an indirect reference; t5 explicitly identifies DJN resistance. Both include boot choices. | Corrupt the bombing arithmetic with a decrement stream and check that the fallback remains reachable. [t3](https://gallium.inria.fr/~doligez/corewar/rc/Torcht3.txt), [t5](https://gallium.inria.fr/~doligez/corewar/rc/Torcht5.txt). |
| Torch t15 (April 7, 1995) → t18 (1996 archive) | t15 enters the stone directly despite an unused boot constant. t18 explicitly restores boot/decoy and replaces the bombing stage's DJN with a zero-test trigger. | Compare actual entry paths, not declared constants; test relocation and transition choice independently. [t15](https://gallium.inria.fr/~doligez/corewar/rc/Torcht15.txt), [t18](https://gallium.inria.fr/~doligez/corewar/rc/Torcht18.txt). |
| TimeScape 0.9 (April 20, 1995) → 1.0 | Each replication cell gains an extra MOV with remote predecrement side effects, the final jump changes an operand mode, and the initial SPL/MOV order changes. | Treat additional attack work, pointer side effects and launch scheduling as coupled changes; test copied bodies and queue order before scoring. [0.9](https://gallium.inria.fr/~doligez/corewar/rc/TimeScape(0.9).txt), [1.0](https://gallium.inria.fr/~doligez/corewar/rc/TimeScape(1.0).txt). |
| myVamp v3.7 (September 1995 in source) → 5.4 (July 1996 in source) | The later version lists opponent-targeted development, clear revisions and decoy additions; its entry runs the decoy maker and its capture pit participates in the attack transition. | Preserve fang/pit/transition relationships and distinguish a new attack from a change aimed at one opponent. [v3.7](https://gallium.inria.fr/~doligez/corewar/rc/myVampv3.7.txt), [5.4](https://gallium.inria.fr/~doligez/corewar/rc/myVamp5.4.txt). |
| Q² (1996) and Puddleglum's Q³ (1999) | Contemporary explanations and source expose different probe/decoder organizations. This is documented technique development, not proof that one complete warrior descends from the other. | Compare verified hit coverage, reaction latency and space used with the same backup disabled. [Q² source](https://gallium.inria.fr/~doligez/corewar/rc/Q%5E2.txt), [Puddleglum](https://gallium.inria.fr/~doligez/corewar/rc/Puddleglum.txt). |

The archive dates can be checked against the
[release index](https://gallium.inria.fr/~doligez/corewar/by-date/complete.htm).
The downloaded P-space demo additionally supplies an explicit multi-round test
case: it asserts more than one round and handles first-round and result state.
It is a demonstration, not evidence of a competitive controller.
[P-space demo](https://gallium.inria.fr/~doligez/corewar/rc/P-spacedemo.txt).

### Prioritized features and checks

1. **Build the stone/fallback recipe now.** Verify exact booted code, first attack,
   protected regions, deterministic trigger and first clear write. Test a
   damaged bombing stage separately from the normal timer transition. Keep a
   plain clear and an unbooted version as controls.
2. **Build one process-aware replication recipe next.** Start with a constrained
   launcher/body pair; test first and second generation copies before permitting
   mutation. Treat LP and unrestricted-process versions as separate contracts.
3. **Generate coupled numbers.** Use derived stride/coverage equations, imp
   congruences and scan decoder tables. A valid parameter object should encode
   the relationships, not leave the GA to rediscover them after breaking code.
4. **Track ancestry and ablations.** Store source hash, author, date evidence,
   credited parent, changed block, settings and test results. Compare one
   structural substitution at a time; do not give close relatives extra weight
   as supposedly independent opponents.
5. **Test behavior before score.** Coverage injection, copy comparisons,
   transition probes and queue assertions should reject nonfunctional specimens
   before long matches. Our previous opening guard failure is exactly the kind
   of mistake these tests catch.
6. **Keep historical strengths in context.** Evaluate under recorded dialect,
   core/process limits, placement seeds and opponent panels. Do not compare raw
   scores across eras or assume a modern leader's padded full source is suitable
   for a 50-instruction tournament.

The 1994 reports are a useful warning against simplistic progress narratives:
August describes a replication-heavy hill; October describes bombers taking the
top positions. The useful history is how designs answered an opponent mix,
instruction set and budget—not a single ladder from primitive to universally
superior warriors.
[August report](https://www.corewar.info/corewarrior/94warrior/12.htm),
[October report](https://www.corewar.info/corewarrior/94warrior/13.htm).

## Evidence limits and follow-up collection

This pass read the repository's public reference cache, all twelve leader
breakdowns, original 1992/1994 posts, and dated newsletter material. Five further
newsletter texts were cached under `imported/history/`. Eight additional
original Redcode sources were downloaded under `imported/history/warriors/`:
Torch t3, t5 and t15; TimeScape 0.9; Q²; Puddleglum; myVamp 5.4; and the P-space
demo. That folder's `index.json` records source URLs, byte hashes, archive
metadata and author change notes. The cache remains ignored and no remote
generator was executed. This pass did not benchmark an entire historical
collection, establish every invention date, or prove that one superficially
similar warrior directly descends from another.

Next, run the collected version pairs through the same behavioral probes and
matched opponent panels. Keep original and adapted forms separate; preserve
the original hash and settings before normalizing code. Add dated Tornado and
Silk versions as further comparison groups. This turns the history into a
repeatable dataset of component comparisons while keeping uncertain dates,
unproven ancestry and unknown redistribution terms visible.
