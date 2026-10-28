# Monowire: development history and coupled mechanisms

Reviewed October 28, 2026 from [Mizcu's Monowire article](https://corewar.co.uk/mizcu/monowire.htm).
The final source credits **Miz** and identifies a 94nop oneshot. The page supplies
no calendar date; its development duration and reported hill places do not
establish a publication date or current ranking. Line references below refer
to the cached HTML, including markup, in `imported/history/monowire/monowire.htm`.

The [matched local screen](monowire-review.md) separately records extraction,
copy/survival checks and battle results; this document covers source analysis.

## The historical progression

The author describes starting with a small JMZ scanner and a multipass clear,
then removing redundant pointer transfer, experimenting with JMP versus DJN,
and adding a quickscan. Layout changes and further tuning improved its reported
beginner-hill performance. A later comparison scanner adopted a clear associated
with S774++, which the author explicitly credits. The account then examines
removing the quickscan, using a decoymaker, tuning the scan constant, and finally
booting the attack away from a decoy-filled starting image. Additional constant
and boot-distance work preceded the reported ninth-place 94nop entry.

This is evidence for alternating structural changes with parameter search,
and for reevaluating changes against a different opponent field. It is not a
controlled ablation: constants, layout and opponents changed, early examples
are acknowledged reconstructions, and the historical benchmark scores have not
been reproduced here. The article supports a development relationship and
explicit component credits, rather than a conclusion that each later form is
universally stronger. [Article, lines 16–17, 59–98, 170–229](https://corewar.co.uk/mizcu/monowire.htm).

## The final source is 80 instructions, not nine

Counting the final displayed program gives the following layout:

| Region | Instructions | Source lines | Role |
|---|---:|---|---|
| Oneshot payload | 9 | 242–250 | Comparison scan, process generation, two-copy clear and bomb data |
| Repeated decoy | 60 | 252–258 | Twelve repetitions of five instructions |
| Boot and pointer data | 11 | 259–264 | Nine MOV copies, an SPL transfer, and destination data |

`END boot` selects the boot as entry. Its pointers are predecremented, so the
nine MOVs copy the payload backward; the SPL transfers execution to that copy.
The original source fits a 100-instruction limit but exceeds our requested 50.
A shortened-decoy version or bare payload is a derivative and must be labeled
as such. [Final source, lines 232–265](https://corewar.co.uk/mizcu/monowire.htm).

The article's earlier code blocks are not interchangeable runnable releases.
One clear example has inconsistent `ptr`/`ptr1` labels and undefined context;
several use `end` as a label, conflicting with our assembler's reserved END
directive; another includes dialogue and a placeholder operand. Preserve those
snippets as explanatory history rather than silently repairing them into
supposed originals. [Examples, lines 30–40, 43–93, 182–189](https://corewar.co.uk/mizcu/monowire.htm).

## What the code couples together

**Scan stride, probe spacing, and handoff.** The first ADD.F reads the SPL's
two `24` fields and adds them to both operands of SNE.I. The comparison keeps a
seven-cell gap. SNE.I compares whole instructions; unequal cells skip the
scanner's DJN and enter the clear. The scanner's B operand then serves as the
clear's destination pointer, so target detection and bombing location share
state. In particular, discovering a difference does not prove that the first
clear write hits whichever of the two cells actually contains the opponent.
[Payload, lines 240–248](https://corewar.co.uk/mizcu/monowire.htm).

An ideal uninterrupted `+24` orbit visits 1000 positions per probe in an
8000-cell core, because `gcd(24,8000)=8`. The seven-cell separation gives two
distinct residue classes: 2000 unique probe locations, or 25% of that core.
At 55,440 cells, `gcd(24,55440)=24`, so the corresponding count is 4620 locations,
or one twelfth of the core. These are arithmetic bounds before early exits,
DJN side effects, damage and self-modification; they are not measured detection
coverage or win probabilities. A successful 94x assembly does not preserve the
original coverage fraction.

**Bomb selection and the phase change.** Both MOVs obtain their source through
the same clear-loop DJN's B field: one uses `@2`, the other `@1`. An initial
value of two selects the SPL bomb at payload offset eight; a value of one
selects the DAT at offset seven. The `DJN.F ... {2` combines decrement effects
with an A-field predecrement pointer in that bomb area. Source order, modifier,
addressing mode, and the phase-changing self-modification form one mechanism.
Changing the clear's numbers independently can change both its attack and its
control flow. [Clear and bombs, lines 245–250](https://corewar.co.uk/mizcu/monowire.htm).

**Boot position and decoy length.** The final destination operand is relative
to its own pointer instruction. At base zero, the unmodified pointer sits at
offset 79; after nine predecrements, the first payload instruction lands at
`79 - 1100 = -1021`, modulo the core. Removing decoy instructions moves that
pointer, so retaining the same literal operand also changes the landing site.
A comparison intended to isolate decoy length must compensate for that shift.
Removing padding alone is otherwise a combined layout/relocation change.
[Boot, lines 252–265](https://corewar.co.uk/mizcu/monowire.htm).

The scanner has no separate explicit self-exclusion test. Its initial operands,
stride, relocated position, original image and stream offsets therefore need
joint analysis. The decoy also changes what other scanners find and where their
clears begin; it is not merely unused instruction count.

## Contracts before generator admission

1. **Copy and entry:** verify all nine copied instructions before execution,
   exact landing position, entry at the relocated update instruction, and
   pointer cleanup under wrapping loads.
2. **Detection:** place targets at either probe, in both probes, and in old
   startup code; record actual visited cells, false triggers, detection latency,
   and whether equal-looking target cells evade SNE.I.
3. **Pointer handoff:** check the first write's address after each detection
   case and preserve the relation between probe gap and clear direction.
4. **Clear phase:** observe SPL writes followed by DAT writes, the selector and
   loop changes that cause the transition, and the destination range throughout.
   Survival alone does not establish a working multipass clear.
5. **Queue and self-safety:** vary process caps and injected process loss or SPL
   damage; track protected code, unexpected self-entry and total process loss.
6. **Matched experiments:** separate stride/offset tuning, decoy size, landing
   location and quickscan presence. Use shared seeds and additional opponent
   families before treating a score increase as general progress.

These contracts extend the existing comparison-scan, one-shot, relocation and
stun/DAT-clear candidates. They do not justify arbitrary instruction splicing.
For 94x, the next question is whether a compact, derived scanner/clear can keep
its detection and phase contracts on 55,440 cells, not whether the historical
source merely assembles. No new generator capability is implemented by this
source review.
