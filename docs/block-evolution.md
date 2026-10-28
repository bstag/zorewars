# Block recipes in the evolver

The main CLI now accepts `--representation blocks`. This opt-in path evolves
verified recipes instead of individual instructions. The existing instruction
evolver and its defaults remain available.

```sh
node cli/zorewars.js evolve --representation blocks --rules 94x --length 50 --families clear,lifeboat,compass --population 12 --batch 12 --generations 6 --local-steps 4 --validate --threads 4 --out evolved/blocks-run-1
```

Use a new output directory for each experiment. `--hill` accepts the same hill
or local Redcode directory as instruction evolution. Without it, opponents
come from the library. `--king` adds starting Red Queen opponents; it does not
splice their instructions into recipes. Exported `.recipe.json` files can be
positional starting seeds. They supplement each selected family's default.

## What is executable

| Recipe family | Layout and structural choices | Rules |
|---|---|---|
| `clear` | No opening, bounded bomber or B-field scanner → optional relocation → forward/backward DAT or SPL/DAT clear | 88, 94nop, lp, 94x, 94x-hill |
| `lifeboat` | Optional boot → bomber plus independent watchdog → guarded fallback clear; bomb type, direction and phase choices | 94x |
| `compass` | Optional boot → comparison scanner → guarded clear, with independently sized and patterned decoys outside the payload | 94x |
| `combo` | Any fitting chain of the single-process blocks below, or one or two multi-process bodies (stone, spiral, paper, vampire) | 88, 94nop, lp, 94x, 94x-hill |

These cover several attack and support blocks from the broader catalog.

## Combining blocks

`combo` ([tools/blocks/combo.js](../tools/blocks/combo.js)) turns the blocks
inside `clear` and Compass into genes. A genome picks one block per slot and
that block's numbers; the composer lays them out in order, and one generic gate
checks whatever combination results.

| Slot | Blocks | What the block needs, and what it hands on |
|---|---|---|
| Opening (`OPENING`) | none, bomber, B-scan, comparison scan | Bomber and B-scan exit on a timer and need a DAT or SPL bomb cell from the finisher; the comparison scan exits on the first differing pair and hands on the cell it found ('94 only). All leave a probe whose B-field the next block can read. |
| Handoff (`RELOCATE`) | in place, relocate | In place passes the probe on. Relocate copies the finisher to probe+HOP and passes nothing, so the finisher must be relocatable. |
| Finisher (`FINISHER`) | counted clear, guarded clear | The counted clear needs nothing, is relocatable and owns DAT and SPL bomb cells. The guarded clear starts at the probe's cell and skips the protected span; it reads state in the image, so it cannot be relocated ('94 only). Both take an optional stun phase (`PHASE`). |
| Boot (`BOOT`) | none, boot first | Copies the runnable image to probe+HOP before the opening starts; excludes relocate. |
| Decoys (`DECOYS`, `DECOY`) | 0–18 cells | After the finisher; SPL decoys are '94 only. |

Combinations whose blocks do not fit are refused with the reason, for example
"the guarded clear reads state in the image, so it cannot be relocated". The
evolver records these refusals with every other rejection.

Half of all combo mutations are block swaps: one slot gets a different block,
then the other slots are repaired so the contracts fit, keeping the block just
chosen (choosing the guarded clear turns relocation off; choosing relocation
turns the counted clear back on). Ordinary mutations and crossover are repaired
the same way. Run `combo` without `clear`: its default is the `clear` default,
so the two families compete for the same programs.

The two templates are combinations: the composer emits exactly the `clear`
recipe's code for all 108 choices in '88, 94nop and 94x, and exactly Compass's
code for all 54 layouts (`test/combo.test.js`). On every template variant the
generic gate and the template's own gate agree. New combinations include a
bomber or B-scan followed by the guarded clear, the comparison scan followed by
a relocated counted clear, and Compass on the 8000-cell ring.

The generic gate, for every combination, at three load positions (one of them
wrapping the copy past the end of core):

- the finisher is entered, intact, at the address its handoff promises;
- a bomber or B-scan used up its timer; a bomber dropped every bomb;
- the first clear write lands where the finisher's contract says (after
  itself, before itself, or at the probe's cell), every clear write is the
  right bomb outside the protected span, and the stun phase has the declared length;
- the warrior survives a full solo round with one process, its protected code
  intact, and every unprotected cell written after the clear began;
- scanners react: a B-scan stuns a planted target, and the comparison scan
  hands on a planted cell but passes over an equal pair.

Parameters a combination does not use are reset to defaults before its id is
computed, so one program has one id.

### Bodies, alone or side by side

`BODY` replaces the chain with a whole multi-process strategy, and `PARTNER`
adds a second one, started with `SPL` as Stone and Imp does.

| Body | Processes | What it writes | Rules |
|---|---|---|---|
| stone (`TSTEP`, `TBOMB`) | 1 | a DAT or SPL bomb every TSTEP cells, forever | all; SPL bombs '94 |
| spiral (`SN`, `SK`) | 2^SK − 1 | an SN-point imp spiral; the step is SN's inverse modulo the core | all |
| paper (`PSTEP`, `PDELTA`) | 8, then the hill's limit | Silk copies PSTEP away, the distance changing by PDELTA | '94 |
| vampire (`VSTEP`) | 1 | JMP fangs every VSTEP cells, each aimed at its pit | all |

Alone, the defaults are exactly the library's Dwarf, Silk and Vampire. The
contracts: a chain runs alone (its clear would erase a partner); not the same
body twice; a spiral needs an inverse for SN and at least SN processes; both
bodies together must fit the hill's process limit (on LP a spiral beside a
stone has at most three points). Spirals write ahead of themselves, so they are
laid out last; stones and vampires start bombing past the end of the whole
warrior, so their first bombs miss the partner; a launcher falling into a
vampire jumps over its step. Repair keeps the body just chosen and otherwise
shrinks a spiral or drops the partner until the pair fits.

The body gate checks each body alone, then the pair, at two load positions:

- both bodies are running 1,000 cycles in (a process in a static body's code,
  on a spiral imp, or in a copy of the paper);
- the warrior survives the round alone (20,000 cycles when paper is present:
  it fills the process table, and by then it has hundreds of copies);
- alone, a stone or vampire never splits and bombs at least 100 cells, every
  fang leads to the pit while the step is intact, a spiral keeps all its
  processes, and paper leaves at least three copies.

Lifeboat's two-process watchdog is still a whole recipe, not a body.
Lifeboat is the process-aware recipe developed from the watchdog investigations;
the clear grammar predates that work. Compass extends scanning, boot layout and
decoys. They are complete compositions with different process contracts, not
interchangeable instruction slices.

The [machine-readable catalog](block-catalog.json) contains `runnableRecipes`
with integer parameter spaces and `familyReadiness` covering every historical
category. The original seven `selectable` blocks still describe the first
single-process grammar; they are not the count of all runnable recipes.

## Lessons from Monowire

The [Monowire article](https://corewar.co.uk/mizcu/monowire.htm) and our
[source review](monowire-review.md) show why a block needs a contract beyond its
opcode sequence:

1. **Probe geometry:** stride, probe gap and core size determine what can be
   visited. Two equal cells can conceal a target from an inequality scan.
2. **Handoff state:** the scan pointer becomes the clear pointer. Its coordinate
   frame and first write must be checked, including which of the two probes hit.
3. **Scheduling and phase changes:** Monowire's small self-modifying clear and
   growing process queue are coupled. Extracting only its MOV loop loses that
   contract. Compass instead uses one process and explicit phase counters.
4. **Layout:** removing decoys moves the loader. Monowire's boot expression had
   to be compensated in the earlier compact derivative. Compass derives its
   destination from the payload origin, so changing decoys cannot move the boot.
5. **A decoy is a section with a role:** account for its instruction cost,
   pattern, position, visibility to scanners and whether it is copied or run.
   Do not assume more decoys improve a warrior.

Compass is original code, not a port or improved version of Monowire. Its extra
guards and explicit counters cost instructions and execution time. The archived
Monowire remains a separate historical reference.

### Compass layout

| Section | Size | Contract |
|---|---:|---|
| Private state | 4 | Probe A/B, scan timer, stride, phase counter |
| Comparison scan and handoff | 11 | Guard both probe addresses; inequality selects a clear starting at probe A; timeout starts at the protected boundary |
| Clear and bombs | 5 DAT-only / 11 SPL→DAT | Skip protected addresses on wrap; optional short/full SPL pass followed by continuing DAT writes |
| Decoys | 0–18 | DAT, repeated SPL or varied SPL fields; outside copied payload; no execution entry |
| Optional boot | 6 | Backward copy of exactly 20 or 26 payload cells; jump to relocated scan entry |

Default: **44 instructions** = 26 payload + 12 decoys + 6 boot. Maximum: 50.
In-place mode protects the decoy span as well. In booted mode the old source and
decoys remain behind and can be detected or overwritten later. Boot/no-boot
comparisons therefore change more than startup cost; decoy-count comparisons
with boot enabled retain identical payload bytes and landing position.

Admission checks exact copy and entry at normal and wrapped origins, full
500,000-cycle solo survival, one-process ownership, and immutable payload
fields. Isolated scan checks arrange empty, A-only, B-only, equal-pair and
self-probe cases; they check handoff, first write, SPL count and arrival at DAT.
They complement full-image solo runs, which include the old source and decoys.
They do not prove safety under arbitrary enemy corruption or competitive strength.

## The entire historical catalog

The [Planar crosswalk](planar-components.md), [family history](warrior-family-history.md),
[leader breakdowns](hill-leaders.md), [n1LS collection](n1ls-warrior-history.md)
and [other mechanisms](planar-other-mechanisms.md) supply examples and provenance.
The categories overlap; one warrior can contain several components.

| Historical category | Executable coverage now | Further blocks and required contract |
|---|---|---|
| Stone | Bounded bomber; watchdog bomber; endless stone body | Bombing engines with arithmetic coupled to core coverage and own-code exclusion |
| Paper | Silk body | Other papers: serial copy: copy extent, pointer restoration, launch timing, parent/child queue order |
| Vampire | Fang-to-pit body | Pit traps (SPL/clear inside the pit), captured-process entry |
| Stun | Short/full SPL phases | Self-modifying selectors and streams: phase transition under their actual process schedules |
| Imp | Imp spiral body | Imp rings and gates against imps: launch order and spacing |
| Clear | Forward/backward DAT; SPL→DAT; scan-directed clear | Shared-counter and multi-process clears with explicit ownership and wrap behavior |
| Scan | B-field scan; comparison scanner | Specialized one-shots and scan decoders; false positives and blind spots |
| P-space | Reference candidate | Persistent selector plus selectable bodies; use an enabled profile such as 94x-hill |
| Boot | Exact contiguous relocation; independent decoy layout | Split payloads, remote state and active decoy makers need separate copy/entry contracts |
| Gate | Reference candidate | Decrement gate: position, timing and interaction with clear/imp processes |
| Quick | Reference candidate | Quickscan/quickbomb tables: decoding arithmetic and handoff state |
| Factor | Special-purpose source collection | Factoring correctness and its tournament-specific objective, not ordinary combat fitness |
| Sort | Special-purpose source collection | Sorting correctness and its tournament-specific objective |
| Other | Lifeboat watchdog composition | Repair, refresh, numeric disruption, execution reporting and fang backtracking each need their own contracts |

The collected archives are not automatically admitted as genes or benchmark
opponents. Compiling a fragment or attaching a historical tag is not enough.
The next additions can implement the listed contracts without changing the
search engine: register a family, legal parameter space, symbolic emitter,
behavior gate and standalone generator. Promote evidence, not category labels.

## Search, Red Queen and tuning

Each genome contains a family identifier and that family's parameters.
Crossover occurs within a family. Mutation changes legal parameters, including
structural choices; immigrants introduce variations from other admitted
families. Every new recipe passes its behavior gate before battles.

Selection uses per-opponent lexicase, with the best available member of each
family retained. This is a family-preserving GA, not MAP-Elites. Every generation
rescores all parents at common placements against the same current opponents.
Fitness averages the base field and prior-champion field equally when ancestors
exist; `--ties` discounts ancestor ties as in instruction evolution. Each new
champion joins the next generation's opponents. `--king` can initialize that
history. `--local-steps` tries legal ±1 numeric changes and gates them too.

`--validate` uses fresh paired placements against the base field and retains
the starting baseline unless a finalist exceeds the existing noise margin. The
baseline is the starting recipe (a family default or a seed) that scored best
on the base field in generation 1, so family order does not change it.
Training/ancestor scores are not evidence of general improvement. `--classics`
reports champion performance separately, without using those results to select.

Exports include `redqueen-N.red`, a tuner-compatible `.js`, a `.recipe.json`
receipt, family elites, a baseline, and `evolve.json` containing genealogy,
rejections, population histories, opponents and execution statistics. With
validation, `best.*` is the recommended baseline or finalist.

```sh
node cli/zorewars.js tune evolved/blocks-run-1/elite-compass.js --rules 94x --length 50 --candidates 40 --write
node scripts/blocks.js verify --recipe evolved/blocks-run-1/elite-compass.recipe.json --generator evolved/blocks-run-1/elite-compass.js
```

The existing standalone tuner checks compilation and battle results; it does
not call the new structural gates itself. The second command re-runs those
gates using the tuned parameters and confirms the emitted instructions exactly
match the registered recipe. Rebuild a new receipt for a tuned generator:

```sh
node scripts/blocks.js build --family compass --generator evolved/blocks-run-1/elite-compass.js --rules 94x --out evolved/compass-tuned
```

Block mode supports the existing CPU/GPU/auto battle backend. Recipe generation
and detailed behavior gates run on CPU. The initial experiment used CPU; GPU
execution of this path has not been measured. Unsupported combinations such as
scratch, torus and MAP-Elites are rejected rather than ignored.

### Ranking by push-off place

`--objective pushoff` (with `--hill`) scores each recipe by its median place in
an iterative diversity push-off against the hill, as instruction evolution does:
the field plays one round robin up front, each candidate is placed in it, and a
recipe that wins in its own way ranks above a stronger clone. `--partner a.red`
enters our other entries beside every candidate; their places count half
against it, so the search looks for the best partner rather than the best
warrior. `--field-rounds` sets the field's own round robin (default 50).
Red Queen champions are kept as a record but do not enter push-off fitness, and
`--validate` re-ranks finalists on fresh seeds with the same objective.

```sh
node cli/zorewars.js evolve --representation blocks --families combo --rules 94nop --length 50 --hill koenigstuhl:94nop --objective pushoff --partner mine.red --validate --out evolved/partner-search
```

Mutation only picks parameters the program uses (changing one changes its
canonical form), so a paper body is not "mutated" by changing its unused chain
settings. On a fixed test field this cut re-proposed programs from 57% to 41%.

## First integration experiment

See [results](block-evolution-results.json) and journal E12. Reproduce in a fresh
directory with `node scripts/experiment-block-evolution.js evolved/blocks-repeat`.
The experiment runs the actual CLI, three generations, Red Queen, local steps,
the existing tuner, fresh placements and matched decoy/layout controls.
