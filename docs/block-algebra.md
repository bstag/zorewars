# Block algebra

Warriors as trees of blocks. A *block* is a small piece of Redcode with a
written contract; *combinators* join blocks into larger ones; the *linker*
lays a tree out as Redcode for any rule set; the *gate* checks that the
result does what every part of it promises; and evolution searches over
trees, so it can find new ways of putting blocks together as well as better
numbers. The code is in `tools/algebra/`.

The older block code (`tools/blocks/`: the clear recipe, Lifeboat, Compass and
`combo`) stays as it is, so saved recipes still rebuild. Every `combo` is also
a tree, and the tests check that the two give the same compiled code.

## Why a tree

`combo` has fixed slots: one chain (opening, handoff, finisher, boot,
decoys) or one or two bodies side by side. Every block lives inside one
emitter, so a new block means editing the emitter, the fit checks, the
repair, the canonical form and the gate together, and a warrior can't take
a shape the slots don't have: a quickscan before a boot, three bodies, a
stone that becomes a clear. A tree has no such limit, and each block is one
module.

## Blocks

A block module exports:

| Field | Meaning |
|---|---|
| `id`, `kind` | Name, and what it is: `opening` (runs, then hands on), `finisher` (runs forever), `body` (a whole strategy, runs forever), `data` (never executed: decoys) |
| `params`, `defaults` | Its own parameters only, each an integer range |
| `iface(P, settings)` | Its contract: processes, how it exits (`next`: control leaves at its end; `never`), whether its code moves (`roams`: copies or imps outside the image), what it writes (`sparse` or `core`: a clear), which capabilities it `provides` and `needs` (a probe pointer, a DAT bomb cell, an SPL bomb cell), and the reasons it can't run on these settings |
| `state(ctx)`, `emit(ctx)` | Its state cells and its code, written with local labels (`ctx.L`) and references to other blocks' capabilities (`ctx.ref`) |
| `checks` | What it must be seen doing when the gate runs it: a stone bombs 100 cells, a spiral keeps its processes, a paper makes copies, a clear covers the core and leaves the protected image intact |

The linker gives every block its own label namespace, so two copies of one
block can sit in one warrior.

## Combinators

| Combinator | Lays out | Contract |
|---|---|---|
| `seq(a, b, ...)` | All members' state cells, then each member's code; each hands control to the next | Every member but the last exits `next`; the last runs forever. A member's `needs` are met by another member's `provides` |
| `par(a, b, ...)` | `SPL` launchers, then the members (any that write ahead of themselves, like a spiral, last) | Members run forever, don't clear the core, and fit the process limit together |
| `relocate(x)` | Copies `x` to probe + HOP and jumps there | `x` must be relocatable |
| `boot(x, stay)` | `x`, then `stay` (left behind), then code that copies `x` to + HOP and starts the copy | One relocation per warrior |
| `image(a, b, ...)` | Members in order; the first one runs | The rest are `data` |

Phase 2 adds `trigger(a, b)` (switch on a timer or a damaged marker) and
`switch(a, b)` (choose by P-space, where the rules have it).

## Linker

Two passes: the first measures every block, the second emits with the sizes
known (a guarded clear protects the whole image; a stone's first bomb lands
past the end of the warrior). It writes `ORG` for '94 and `END entry` for '88,
and the blocks choose '88 or '94 code from `ctx.old`.

## Gate

1. The contract: every block's `iface` accepts the settings; combinators'
   rules hold; every `need` is provided.
2. It assembles and fits the length limit.
3. It runs alone from several load positions, including one where a copy
   wraps the end of the core, to the cycle limit (20,000 cycles with a paper,
   which fills the process table), and survives.
4. Every block's checks hold. A `par` member is first gated on its own, then
   every member must still be running at cycle 1,000. A `seq` must reach its
   last member, intact. Scanners are shown a planted target and must react.

Passing the gate means the warrior does what its blocks claim when it runs
alone; it says nothing about how well it fights.

## Evolution

A genome is a tree. Mutations: tune a parameter, swap a block for another of
the same kind, wrap or unwrap a `boot`, `relocate` or decoys, add or drop a
`par` member, swap same-kind subtrees between parents. Phase 2 adds the
evolution loop: fitness by points or push-off place (with racing and the
league), and an archive keyed by behaviour species and by tree shape, which
rewards shapes it hasn't seen.

## Phases

1. This contract, the linker, the gate and the tree genome, with `combo`'s
   blocks ported as leaves.
2. Triggers, the evolution loop and the shape archive.
3. Hill staples: quickscan, one-shot, Mice-style paper, imp ring, decrement
   gate, airbag stone, distributed stones.
4. Control and defence: P-space switch, marker trigger, anti-clear leap,
   watchdog; Lifeboat and Compass as trees.
5. Torus and volume blocks (TRN).

All blocks are written here. Hill warriors are studied, never copied.
