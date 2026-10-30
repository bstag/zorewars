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

Each file in `tools/algebra/blocks/` exports a block, or an array of them, as
its default; `tools/algebra/leaves.js` loads them all (files starting with `_`
are skipped). `core.js` holds the blocks ported from `combo`. A block is an
object:

| Field | Meaning |
|---|---|
| `id` | Unique, kebab-case (`opening-quickscan`, `spl-stone`) |
| `kind` | `opening` (runs, then hands on), `finisher` (a clear: runs forever), `body` (a whole strategy: runs forever), `data` (never run: decoys) |
| `purpose` | One sentence: what it does |
| `params`, `defaults` | Its own parameters only: `{ NAME: [lo, hi] }` integer ranges, and values that work. Ranges must suit both the 8,000 and the 55,440 cores; refuse bad combinations in `mismatches` |
| `entry` | Local label of the first instruction it runs |
| `exit` | `next` (control leaves at its end; openings), `never`, or `data` |
| `link` | Openings: `jump` if control leaves through a link jump the linker adds after it, `fall` if it falls straight into the next block |
| `processes` | How many it runs at most: a number or `(P) => number`; `grows: true` if it fills the process table (papers) |
| `writes` | `sparse`, or `core` for a clear (a clear can't share the core with partners); or `(P) => ...` when a parameter decides |
| `roams`, `layout` | `roams: true` if it runs outside its image (imps, copies); `layout: 'last'` if it writes just ahead of itself and must be laid out last (a spiral) |
| `loop` | Local label of a cell it runs on every pass of its main loop. `trigger` needs one: it rewrites that cell to hand over |
| `attacks` | `'all'` if it attacks every non-empty cell but its own (and not its partners'): `par`, `apart` and `copies` refuse it partners |
| `moves` | `true` if it copies itself elsewhere and leaves its old code (leap, bomb-dodger): `trigger`, `restart` and `classify` refuse it, since their watcher would lose it |
| `entryFirst` | `false` if `entry` isn't its first cell, so a launcher falling into it needs a jump |
| `relocatable`, `protects` | Finishers: whether `relocate` may move it; whether its clear spares `self` or the whole `image` |
| `dialects` | `'94'` if it needs ICWS'94; otherwise it must also write '88 code when `ctx.old` |
| `topologies` | Where it can run: `['ring']` (the default), `['torus']`, or both. On a torus, code runs along a row and plain numbers are x-steps, so a ring block's steps never leave its row. Torus blocks write vectors (`ctx.vec(x, y, z)` gives `[x,y,z]` operand text) and use `TRN` |
| `needs`, `provides` | Capabilities: `provides` maps a capability to the local label that holds it (`{ probe: 'probe' }`), or is `(P) => map`. Known ones: `probe` (an opening's pointer; B = the last cell it touched), `datBomb`, `splBomb` (bomb cells to copy). New ones are fine: name them clearly |
| `mutable` | `[[label, ['a', 'b']], ...]` or `(P) => list`: fields that change while it runs, so the gate doesn't count them as damage |
| `mismatches(P, settings)` | Reasons it can't be built on these settings: `[]` when it can |
| `state(ctx)` | State cells a `seq` lays out before all code (optional) |
| `emit(ctx)` | Its code |
| `watch(api)` | Its behaviour checks (below) |
| `running(api)` | Whether it is still running; default: a process is inside its own code. Moving bodies need their own |
| `plant(api)` | For blocks that react to an opponent: `[[address, instruction], ...]` to poke before the run, or `[address, instruction, cycle]` to poke at that cycle (after the block has set itself up), so `watch` can check the reaction |

### Writing code: `ctx`

`emit` and `state` get `ctx`:

- `ctx.ins(label, opcode, modifier, a, b = '0')` adds one instruction. `label`
  is local (or `''`/`null`); operands are strings. In '88 the modifier is
  dropped, so write '88 code when `ctx.old`: only `DAT MOV ADD SUB JMP JMZ JMN
  DJN CMP SPL SLT`, modes `# $ @ <`, `CMP` for `SEQ`, and no immediate A on
  `SPL` or the jumps (`zorewars check --rules 88` and `pmars -8` refuse it).
- `ctx.L(name)` is the namespaced label of a local name: use it in operands
  (`ctx.L('loop')`, `` `@${ctx.L('ptr')}` ``, `` `${ctx.L('a')}-${ctx.L('b')}` ``).
- `ctx.mark(name)` labels the next instruction without adding one.
- `ctx.ref(cap)` is the label of a capability another block provides.
- `ctx.next` is the label to jump to when an opening hands on.
- `ctx.torus` (true on a torus), `ctx.geo` (the geometry: `X`, `Y`, `Z`, `encode`, `decode`, `add`), `ctx.vec(x, y, z)` (vector operand text);
- `ctx.P`, `ctx.old`, `ctx.core`, `ctx.settings`; `ctx.pc()` is the index of the
  next instruction; `ctx.total` is the whole warrior's size and `ctx.span` the
  size of what's protected (both 0 in the measuring pass, real in the second;
  sizes must not depend on them).

Write the code yourself. Hill warriors and published originals may be studied
for ideas, never copied.

### Checking behaviour: `watch(api)`

`watch(api)` returns hooks for one running copy of the block:
`{ before(pc) → token, after(token), final() }`. `before` is called before
every step with the program counter about to run, `after` with what `before`
returned, and `final` at the end of each run. Throw an `Error` with a clear
message when the block breaks its contract. `api` has:

- `vm` (peek, writeCycle, writerPc, processes(0), warriors[0]), `P`, `settings`, `core`
- `at(local, k = 0)`: the address of a local label (+ k) in this running copy, wrapped
- `self` (`{ start, size }`: this copy's cells), `image` (the whole warrior as loaded), `total`, `maxLength`, `mayStop` (inside a trigger's first member)
- `code(local, k = 0)`: the compiled instruction at that label (+ k), to compare against
- `entry()`, `inSelf(c)`, `inImage(c)`, `norm(x)`, `same(a, b)` (instructions equal mod core)
- `add(a, b)` and `rel(c, from)` (cells along the row from `from` to `c`): address arithmetic
  that works on a torus as well as the ring; on a torus use them instead of `norm(a + b)`. `geo` is the geometry (null on the ring)
- `sole()`: every live process is inside this copy's code (it's the only block still
  running, e.g. a clear after its opening has handed on); `ref(cap)`: the address of a
  capability another block provides; `entered()`: whether this copy has run yet (under
  a `switch`, the branch not taken never does)
- `alone`: true when this block is the whole warrior and nothing is planted; check
  quantities (cells bombed, copies made) only then
- `duel(opponent, { offset, cycles })`: a fresh round of this warrior against a real
  opponent (Redcode text or a compiled warrior) loaded `offset` cells away; returns
  `{ vm, cycles, ours, theirs }` (who is still alive). Use it to test a reaction with
  a real enemy instead of poking the core
- `scenario`: the run's name; with `plant`, it is `'<id>: planted target'` for the planted copy and `'<id>: planted target (another copy)'` for any other copy of the same block

The gate itself checks, for every tree: it survives alone to the cycle limit
from three load positions; it never runs more processes than the blocks
declare (unless one `grows`); every block is entered; every block that runs
forever is still running 1,000 cycles after it was entered. Combinators add
scenarios: a trigger's marker or loop is damaged and its second member must
take over; a switch is shown each P-space history and must take the right branch.

### Testing a block

Each group of blocks gets `test/algebra-<group>.test.js`: every block builds
with `buildTree` and passes the gate with its defaults on every rule set it
supports ('88, 94nop, lp, 94x), alone and in at least one combination (`par`,
`seq`, `trigger`, `apart`); a scanner's planted target is found; and at least
one broken setting is refused by `mismatches` or the gate. Keep a test file
under a minute. `node scripts/algebra.js catalog` regenerates the catalog.

## Combinators

| Combinator | Lays out | Contract |
|---|---|---|
| `seq(a, b, ...)` | All members' state cells, then each member's code; each hands control to the next | Every member but the last exits `next`; the last runs forever. A member's `needs` are met by another member's `provides` |
| `par(a, b, ...)` | `SPL` launchers, then the members (any with `layout: 'last'` last) | Members run forever, don't clear the core, and fit the process limit together |
| `relocate(x)` | Copies `x` to probe + HOP and jumps there | `x` must be relocatable |
| `boot(x, stay)` | `x`, then `stay` (left behind), then code that copies `x` to + HOP, UNROLL cells a loop, and starts the copy | One relocation per warrior |
| `image(a, b, ...)` | Members in order; the first one runs | The rest are `data` |
| `trigger(a, b)` | A watcher beside `a`; when it fires it rewrites `a`'s `loop` to jump to `b` | MODE 0: after TIME laps; 1: when its marker is damaged; 2: when `a`'s loop is damaged (a watchdog, which starts `b` itself) |
| `apart(a, b)` | Copies `b` D cells away and runs it there beside `a` | Neither clears the core; the copy must not overlap |
| `copies(x)` | N copies of `x`, D cells apart, all running | As `apart` |
| `switch(a, b, ...)` | Reads P-space and jumps to one of 2–4 members. POLICY 0: move to the next after a loss; 1: only after two losses in a row; 2: every round | Only where the rules have P-space (the 94x hill). The gate tries every kind of history against a model of the code |
| `parboot(x)` | K independent copy loops each copying `x` to + HOP; the first to finish starts the copy (one atomic DJN), so a bomb on one loop doesn't stop it. STAY 1 keeps a process on the original. REACT: the losing loops watch the copy's `loop`; when it's hit they make a new copy at + HOP2 (1), first stunning CARPET cells either side of the hit (2) | REACT needs K ≥ 2 and an `x` with a `loop`; the hops must clear the warrior and each other. The gate bombs a copy loop mid-copy, and hits the running copy |
| `restart(x)` | Backs `x` up at the start; a watcher compares `x`'s `loop` with its original and, when it's damaged, copies the backup back and starts `x` again | `x` has a `loop` and doesn't roam |
| `classify(a, b, c)` | Runs `a` beside a marker; when the marker is hit, a cell with both fields zero (a clear's or stone's DAT) hands over to `b`, anything else (copied code, a scanner's bomb) to `c` | `a` has a `loop`; '94 only |

## Linker

Two passes: the first measures every block, the second emits with the sizes
known (a guarded clear protects the whole image; a stone's first bomb lands
past the end of the warrior). It writes `ORG` for '94 and `END entry` for '88,
and the blocks choose '88 or '94 code from `ctx.old`.

## Gate

1. The contract: every block's `mismatches` accept the settings; combinators'
   rules hold; every `need` is provided; the processes fit.
2. It assembles and fits the length limit.
3. The shapes `combo` can make keep `combo`'s exact checks: a chain (an opening,
   then a clear) and bodies side by side.
4. Every other tree goes through the generic gate described above.

Passing the gate means the warrior does what its blocks claim when it runs
alone; it says nothing about how well it fights.

## Evolution

`tools/algebra/evolve.js` (`evolve --representation tree`) breeds trees
against a hill and judges them as a hill does: average points against every
warrior on it. Only trees that pass the gate are scored. The archive keeps the
best tree per niche (behaviour species and top-level shape), racing confirms a
child with doubled rounds on common seeds before it takes a niche, and
`placeOnHill` reports where a tree would rank among the hill's warriors.
Tune mode keeps a tree's shape and only changes its numbers.

A genome is a tree. Mutations: tune a parameter, swap a block for another of
the same kind, wrap or unwrap a `boot`, `relocate` or decoys, add or drop a
`par` member, swap same-kind subtrees between parents. Phase 2 adds the
evolution loop: fitness by points or push-off place (with racing and the
league), and an archive keyed by behaviour species and by tree shape, which
rewards shapes it hasn't seen.

## Phases

1. Done: this contract, the linker, the gate and the tree genome, with
   `combo`'s blocks ported as leaves.
2. Done: the combinators `trigger`, `apart`, `copies`, `switch` and a fast
   `boot`; the generic gate; 28 more blocks (scanners, stones and bombers,
   clears, papers, imps and gates, capture, sensors and repair); named recipes
   (Compass, one-shot, distributed stones, stone/imp, a watchdog).
3. Done: 19 more blocks (bomb-dodger, airbag stone, fang gate; Blur-style
   and mirror scanners, a decoding quickscan, an outward clear; a relaunching
   paper and an imp feeder; '88 versions of the scan-then-clear blocks), the
   `restart` and `classify` combinators, n-way switches with three P-space
   policies, and a `duel` helper.
4. Done: torus and volume support (vector hops, per-axis copy loops,
   geometry-aware checks) and six torus blocks (vector stone, TRN row sweeper,
   plane clear, volume paper, torus scanner, column imp).
5. Done: `parboot` (redundant copy loops, a stay-behind original, watchers
   that re-copy or counter-attack when the copy is hit).
6. Done: the hill gaps found by surveying our warriors, the Hall of Fame and
   the hill leaders: probe-burst, lattice quickscan and decoy maker; the
   modern multi-process hill stone (DJN stream, remote bomb, self-bomb to
   clear), scanning vampire, elf, multi-process clear; pair-wipe and carpet
   scanners with '88 versions; bombing Mice, '88 silk, anti-imp silk, dual
   launchers; vector silk, backward clear, multi-process plane clear, torus
   leap. The wave boot is the `waveboot` recipe (parboot of a par).
7. Next: the evolution loop over trees, with an archive keyed by behaviour
   and by tree shape.
8. Not built: `fang-backtrack` (a fang can't record where it ran), `ring-paper`
   (no different from Mice with a fixed step), a scheduled-airbag block (its
   fall-through-on-loss claim couldn't be verified without a counter).

All blocks are written here. Hill warriors are studied, never copied.
