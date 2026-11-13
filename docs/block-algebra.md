# Block algebra

Warriors as trees of blocks. A *block* is a small piece of Redcode with a
written contract; *combinators* join blocks into larger ones; the *linker*
lays a tree out as Redcode for any rule set; the *gate* checks that the
result does what every part of it promises; and evolution searches over
trees, so it can find new ways of putting blocks together as well as better
numbers. The code is in `tools/algebra/`.

The compact imp pump loads without draft activation. The public `fanboot-stone-imp-example` recipe illustrates its local-template mode. Recipe builds support full verification, and `--tree-out` saves the source tree. Use `configure` or `configureStoneImp` to tune placement, seed mode, lead and source layout. See the [verification guide](block-algebra-verification.md).

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
are skipped unless enabled by `ALGEBRA_DRAFTS`, a comma-separated list of draft
filenames). `core.js` holds the blocks ported from `combo`. A block is an
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
| `relocatable`, `protects` | Finishers: whether `relocate` may move it; whether its clear spares `self` or the whole `image`. Any block: `'siblings'` (or `(P) => ...`) if its clear spares the other copies it runs beside, so `apart` and `copies` accept it although it clears the core |
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
| `claimsFreeB(P)`, `claimCell(P, L, k)` | Optional: data the block may keep in another block's free B-fields (below). `claimsFreeB` returns group sizes (each group stays in consecutive cells), or null to keep everything private; `claimCell` gives cell k's `{ label, value }`, the label the block addresses it by and the B-field text written there |
| `lattice(P, settings, where)`, `keeps(P, settings, where)`, `copies(P, settings, where)` | Optional, read by `fanboot` and `fanboot3` after linking; all offsets count from the member's first cell, and `where` says where the linker put it (`start`: its first cell's index in the image, `total`: the image's size, `at(label)`: a label's index). `lattice` declares the cells a member writes for as long as it runs, as `{ step, residues }` (`run-stone`: residues 6 and 7 of every 8; `hill-stone FIT 1`: its bomb classes) and/or a window `{ from, size }` (`gated-dclear`: its span below the gate); one object or an array. `keeps` declares `{ from, size }` cells outside its code that it needs left alone (`gated-dclear`: its gate cell). `copies` declares where a paper's copies land, in two forms: `{ step, residues }` for every generation (the grain its copy distances share, and the residues its cells fill) and `{ cells }` for what the original writes in its first eight laps (`loop-paper6`, `stream-paper3`, `backcopy-paper` give both; `tail-silk` gives only the second). Papers also declare their own first-lap writes as `lattice` windows, so a partner's code under them is refused: copies, bombs (`loop-paper6`: its bomb pointer's cell and the run of bombs two thirds of the core on), erased cells (`stream-paper3`: the 2*PROCS cells behind each copy), DAT rows (`backcopy-paper`) and tails (`tail-silk`: the self-dropping line's cells and its carpet). The tree is refused when a partner's boot copy (its code, not the fan's rounding tail) or kept cell sits on a declared write; when a residue lattice meets a partner's every-generation copies (a stone sweeps those cells for the whole round); or when a window meets a partner's first-lap cells (a bounded clear: a paper's later generations reach every window, so only its launch is protected, and copies that land in the window later are cleared). Members that declare nothing are not checked |
| `linked(P, settings, at, { span })` | Optional: reasons it can't be built, checked once the layout is known (`at(local)` is a label's address, `span` the size of what it protects). For checks that depend on where the linker put things. The fourth argument also has `dead`: `[{ start, size }]` windows of the loaded image that no longer run once this block is entered (the code and state cells of earlier `seq` members that have handed on, less the cells they `provide`; the members a switch does not take; an `image`'s data members, for its running member; the whole image under a `boot`), so a check on what the block writes can leave them out |

### Compact imp pump

`_compact-pump.js` supplies `compact-imp-pump`: four pump instructions and an
imp template, composed as a separate fanboot member. `N` sets the number of
spiral points; `LEAD` moves the first launched seed beyond the template;
`IMM: 1` uses an immediate source so numeric A-field damage does not redirect
the imp's read. `RETIRE: 1` permits friendly overwriting of the launcher only
after successful launches and with at least N compatible imps surviving.
The watcher remembers the first structural fault's writer: subsequent execution
of a friendly DAT or self-copying cannot erase that proof. An enemy first fault
cannot become a permitted retirement through later friendly writes.

The active pump must refill after the planted process kill. That refill
requirement ends after actual friendly retirement; the remaining imps must
still survive the ordinary run. Applying an alternating-process wipe after
retirement also destroys the baseline and original Armadillo's imp components,
so it is not used as a requirement that retired launchers recover. The pump's
tests separately check active recovery, permitted retirement, launch geometry,
source-mode tolerance and rejection of missing launches or descendants.

### Draft remote reserve clear

`_stone-reserve.js` supplies `stone-reserve`, an experimental extension of the
unchanged eight-cell `armadillo-switch` emitter. It requires three entrants
(`fanboot` N4, SPLIT1): three processes start the stone and one boots a separate
thirteen-cell watchdog/clear at `RESERVE`. It watches the primary clear's MOV;
damage stops the original stone feeder, bomber and imp feeder before starting
a counted backward clear. `PUMPDIST` specifies the deployed imp feeder's offset
from the stone. The gate checks actual remote copying, correct monitoring,
three entrants, self-excluding writes and a reaction to early planted damage.

This is an early fallback, not a durable late reserve. In the recorded full-field
experiment it lost substantial strength: the extra launch work delays bombing,
and the primary clear erases the reserve before late attacks. Planted late hits
do not recover. It remains a draft excluded from normal evolution; its tests
preserve both its working early handoff and its known late failure. Enable
`_stone-reserve.js` when rebuilding those trees; the compact pump already loads.

### Draft bounded stone handoff

`_bounded-stone.js` supplies `bounded-stone`, reusing the existing stone emitter
and gated clear with a bounded DJN.B counter and one MOV latch. `COUNT` counts
visits until the counter first expires; other queued processes can visit it
before the expiring process executes its latch. The contract remembers that
expiry, checks counter values, requires the SPL handoff and actual DAT writes,
and rejects clear writes into the body. `KEEPSTREAM: 1` retains the original
DJN.F decrement stream by adding the counter as a separate loop instruction;
the default replaces that stream. Neither version adds a polling process.

This remains an excluded draft. The recorded experiment brought intact clearing
forward but lost field strength: the best admitted trial was about 5.4% below
the seven-point control on two fresh forty-round full-field runs. The stream-
retaining version and a small early-handoff placement grid also lost. Several
timings failed the planted imp-recovery scenario despite surviving quietly.
An earlier normal handoff is not a demonstrated damage-recovery mechanism.
Enable `_bounded-stone.js` to rebuild its trees.

### Draft two-writer stone clear

`_double-clear-stone.js` supplies `double-clear-stone`, composed from the
existing self-switching stone emitter. `WRITERS: 1`, `PAD: 0` reproduces the
original compiled instructions. The two-writer mode adds a second MOV and
adjusts the clear's back edge. `FAULT` selects which writer receives SPL1,1
in the planted scenario, without changing emitted code. Both writer-fault
choices must be checked. The watcher verifies actual DAT writes, protects the
body and requires continued clearing by the other writer after the hit.

Layout matters: the original inline change stopped the natural handoff, while
an out-of-line writer could be erased by the stone's own A-trail before entry.
`LAYOUT: 1` preserves the old bomb slot and adds a writer plus a return JMP;
`GAP` separates that pair with DAT cells. The compact `LAYOUT: 0` works in the
recorded composite after calibrating HOP56 to57. That calibration also changes
the bomb's B-field, so it is not an unchanged-number experiment. These modes
add no watcher process and leave the original DJN decrement stream in place.

This stays an excluded draft. The compact version survives a controlled SPL
hit on either writer and passes full-round gate scenarios, but lost about5.3%
against the seven-point control on fresh full-field confirmations. Thirteen
ordinary-gate-passing configurations were scored; all lost. A first-writer
DAT overwrite still stops sustained clearing. Enable `_double-clear-stone.js`
to rebuild the recorded experiment trees.

### Draft passive-decoy layout controls

`_zero-padding.js` supplies data-only `zero-padding`: exact DAT.F $0,$0
cells matching empty core. The five-cell compact pump is copied in an
eight-cell fanboot round; a three-cell empty tail keeps following decoys out
of that live copy. An image-padding-only control separates that layout change
from the decoy contents. Passive decoys add no executed setup instructions,
but their larger image and contents can still affect execution elsewhere.

`_friendly-decoys.js` supplies data-only `friendly-decoys`, repeated DAT or
SPL cells with immediate fields1,2. The name refers to one tested interaction:
our clear's DJN.F changes1,1 into0,0 and falls through, whereas1,2 becomes0,1
and continues. Repeated equal decrements preserve the unequal-field
difference; other writes can invalidate that property. A whole-composite
regression keeps the code/length identical apart from decoy B-fields and
checks that the unequal-field pattern retains the seven-point imp component.

The recorded passive-decoy experiment showed no demonstrated field upgrade.
Several standard1,1 patterns lost their imps quietly; four unequal-field
follow-ups passed but did not beat the control in screening. The best of the
longer-confirmed standard patterns gained only about0.03%, with inconsistent
seed signs. Keep these data blocks excluded drafts rather than treating them
as proven defensive improvements.

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
- `ctx.claimed` is the set of groups the linker placed in another block's free
  B-fields (`claimsFreeB`): leave those cells out of `state`.
- `ctx.siblings` lists other copies of the warrior that run beside this block
  (under `copies` or `apart`), as `{ start, size }` windows in this block's own
  frame (offsets from the image start, like `span`). A block that attacks what
  it finds should skip them as it skips its own image; the scanners built on
  `scanBody` (`scanner`, `bscan-body`) do. Empty on a torus.
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
- `inImage(c)`: the warrior as loaded plus each copy a combinator laid down (a boot's copy
  holds only its member's cells, and counts once a process has run in it: before that
  its cells are still to be written), minus a branch not taken; `inDead(c)`: cells that no
  longer run (the original after a boot moved everything away, a branch not taken). An
  opening may find dead cells and a burst may hit them; live ones never
- `add(a, b)` and `rel(c, from)` (cells along the row from `from` to `c`): address arithmetic
  that works on a torus as well as the ring; on a torus use them instead of `norm(a + b)`. `geo` is the geometry (null on the ring)
- `sole()`: every live process is inside this copy's code (it's the only block still
  running, e.g. a clear after its opening has handed on); `ref(cap)`: the address of a
  capability another block provides, in this copy's frame; `entered()`: whether this copy has run yet (under
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
| `seq(a, b, ...)` | All members' state cells, then each member's code; each hands control to the next | Every member but the last exits `next`; the last runs forever, or hands on too, which makes the seq an opening (a fork's first member). A member's `needs` are met by another member's `provides` |
| `par(a, b, ...)` | `SPL` launchers, then the members (any with `layout: 'last'` last) | Members run forever, don't clear the core, and fit the process limit together |
| `relocate(x)` | Copies `x` to probe + HOP and jumps there | `x` must be relocatable |
| `boot(x, stay)` | `x`, then `stay` (left behind), then code that copies `x` to + HOP, UNROLL cells a loop, and starts the copy. WIPE 1: it starts the copy with SPL and the boot process erases the launch and the destination pointer before it dies. SHARE 1 (no code change) names `x`'s cells as the capabilities `payload`, `payloadEnd` and `payloadEntry`, so a `redeploy` leaf in another member of the same `switch`, `switch-table` or `switch-score` copies the same `x` to its own HOP in six cells instead of carrying a second copy of it. `x` may be a leaf or a whole subtree (its entry is the linker's entry of `x`). SHARE 2 to 4 name further payloads (`payload2`, ...), each reached by `redeploy FROM k`; one boot per number | One relocation per warrior. WIPE adds one process for a few cycles. The redeploy's watch checks its copy is `x` cell for cell, clear of the warrior, and that the jump lands on `x`'s entry there, but `x`'s own watch runs only on the boot's copy |
| `image(a, b, ...)` | Members in order; the first one runs | The rest are `data` |
| `trigger(a, b)` | A watcher beside `a`; when it fires it rewrites `a`'s `loop` to jump to `b` | MODE 0: after TIME laps; 1: when its marker is damaged; 2: when `a`'s loop is damaged (a watchdog, which starts `b` itself) |
| `apart(a, b)` | Copies `b` D cells away and runs it there beside `a`; each learns where the other is (`ctx.siblings`) | Neither clears the core; the copy must not overlap |
| `copies(x)` | N copies of `x`, D cells apart, all running; each learns every place another copy could be, k·D away (`ctx.siblings`) | As `apart` |
| `switch(a, b, ...)` | Reads P-space and jumps to one of 2–4 members. POLICY 0: move to the next after a loss; 1: only after two losses in a row; 2: every round | Only where the rules have P-space (the 94x hill). The gate tries every kind of history against a model of the code |
| `switch-score(a, b, ...)` | Reads P-space and jumps to one of 2–6 members by accumulated score: the member played last round gets WIN, TIE or LOSS added to its score box, then the best score plays, the last member keeping HOLD in hand. STREAK s scores the s-th tie in a row as a loss. A sentinel cell that reads wrong (first round, brainwash) resets every box and plays FIRST | Only where the rules have P-space; ring only; FIRST names a member; the cells from CELL (last member, sentinel, one box per member, the streak) fit the P-space. The gate runs every path against `scoreChoice` and checks every cell written |
| `parboot(x)` | K independent copy loops each copying `x` to + HOP; the first to finish starts the copy (one atomic DJN), so a bomb on one loop doesn't stop it. STAY 1 keeps a process on the original. REACT: the losing loops watch the copy's `loop`; when it's hit they make a new copy at + HOP2 (1), first stunning CARPET cells either side of the hit (2) | REACT needs K ≥ 2 and an `x` with a `loop`; the hops must clear the warrior and each other. The gate bombs a copy loop mid-copy, and hits the running copy |
| `restart(x)` | Backs `x` up at the start; a watcher compares `x`'s `loop` with its original and, when it's damaged, copies the backup back and starts `x` again | `x` has a `loop` and doesn't roam |
| `fork(opening, a, b)` | The opening runs; if its probe holds a hit, `a` runs, if it is still at the image boundary (nothing found), `b`. BY 1: the opening (a seq ending in `probe-verdict`) provides a verdict, and `a` runs only for a body, `b` for nothing or a lone cell (a bomb or decoy). The gate runs the opening's planted target (must take `a`) and a run with nothing planted (must take `b`); once a branch is entered, the other is dead code that a body may attack. An empty cell separates `a` and `b` | the opening exits `next` and provides `probe`; `a` and `b` run forever. Bodies that treat the whole image as their own (some scanners) may wipe into themselves through the dead branch; the gate refuses those pairings |
| `fanboot(a, b)` | A fan of SPLs (N of 2, 3, 4, 6, 8, 12 or 16 processes in lockstep), then copy lines `MOV <v, {v` that each copy N cells, `a` to + HOPA and `b` to + HOPB; each member's copy pointer is then run as its jump vector. SPLIT 0: `SPL` sends K·N processes into `a`, then `JMP` sends N into `b`; SPLIT 1: a `DJN #N` sends N-1 into `a` and the last one into `b`. A member whose entry isn't its first cell gets a `JMP` in front of it | Both members run forever and accept that many processes entering together (the gate decides: a silk with its own stages, a one-process stone and an imp launcher do; a backward silk tail doesn't); '94, ring only; the copies clear the warrior and each other; one relocation per warrior. The fan lines' B-fields are free (below) |
| `classify(a, b, c)` | Runs `a` beside a marker; when the marker is hit, a cell with both fields zero (a clear's or stone's DAT) hands over to `b`, anything else (copied code, a scanner's bomb) to `c` | `a` has a `loop`; '94 only |

A switch, `switch-table`, `switch-score` or `fork` takes one branch, once. The gate records the first branch of each group entered; after that, a process running another branch's entry (a paper's copy, an imp crossing the image) has not entered it: that branch stays dead code, and its watch is not asked to account for it. A block whose watch checks its own work should therefore test `api.entered()` (or its own entry) before it does.

`fanboot` also accepts experimental `MOREA: 1` with `SPLIT: 1`.
After the `DJN` routes N-1 workers into the first member, the final worker
forks one additional first-member process before entering the second member.
This gives N first-member workers and one second-member worker, at the cost
of one instruction. The default is zero and preserves existing code.
More workers change scheduling and friendly-fire timing; the behavior gate
and a full solo round still need to verify the combined engines.

### Exact placement and stone stream selection

`armadillo-switch STREAM:1` selects the supported A-indirect DJN stream operand `*-3`. STREAM0 retains the original folded B-predecrement operand and existing code output. This changes addressing semantics rather than instruction count or execution speed; it earned a small gain in the retained four-worker composition on two fresh full-field confirmations. Other geometry and process allocations still require verification and scoring.

### Experimental integrity check before a fan boot

`fanboot` defaults to `CHECK: 0`, preserving its emitted code. `CHECK: 1`
sums both numeric fields of the two original members and the second copy's
rounded tail. `CHECK: 2` sums only three selected source cells. `C0`, `C1`
and `C2` index the concatenation of the unpadded members. These checksum
variants cost nine cells; their expected sums are resolved after linking.
`CHECK: 3` instead tests C0 and C1 for both fields zero and costs six cells.
All checks run before the process fan. `BYPASS: 1` keeps the same layout and
checking work but routes rejection back to the boot, for matched controls.

Checks need an upstream `probe` as scratch space and a first member with a
`coldStart` descriptor: local `entry`, `feeder` and `gate` expressions.
Currently `armadillo-switch` supplies it. Rejection zeroes the original
clear's gate pointer, copies its SPL feeder onto the loop, and enters that
loop. Both pointer initialization and the feeder are needed: survival alone
can otherwise hide a destroyed clear. Fault tests require continued writes
across most of the core, including the abandoned image, through cycle 80,000.

These are limited integrity checks. Numeric sums omit opcodes and addressing
modes and can collide; the zero test detects only zero-field damage. Hits
after validation can still be copied, and the fallback itself may be damaged.
The ordinary behavior gate checks the intact route; dedicated fault tests
check the fallback and these limitations. The experimental checks did not
improve the measured stone/imp entry; they remain opt-in.

## Linker

Two passes: the first measures every block, the second emits with the sizes
known (a guarded clear protects the whole image; a stone's first bomb lands
past the end of the warrior). It writes `ORG` for '94 and `END entry` for '88,
and the blocks choose '88 or '94 code from `ctx.old`.

**Free B-fields.** Hill warriors keep tables in fields their other parts never
read (Hullabaloo's quickscan table sits in its boot's SPLs). A block that
offers such cells writes them with `ctx.free(run, i, label, opcode, modifier,
a, b)`: when another block claimed cell i of that run, the linker puts that
block's label on the instruction and its value in the B-field, otherwise `b`.
Today `fanboot` offers its fan lines (run `fan`) and, with SPLIT 0 and K > 2,
its extra `SPL *va` lines (`spk`). A block with `claimsFreeB` (the MUL
quickscan with SHARE 1) gets whole groups from runs offered later in the same
`seq`, which run after it; groups that don't fit stay in its own state cells.
Its addresses must then be written as label arithmetic, and checks on where
things land go in `linked`.

## Gate

1. The contract: every block's `mismatches` accept the settings; combinators'
   rules hold; every `need` is provided; the processes fit.
2. It assembles and fits the length limit.
3. The shapes `combo` can make keep `combo`'s exact checks: a chain (an opening,
   then a clear) and bodies side by side.
4. Every other tree goes through the generic gate described above.

Passing the gate means the warrior does what its blocks claim when it runs
alone; it says nothing about how well it fights.

### Retiring an imp launcher

`imp-feeder` normally promises recovery after the gate kills some imps. A
coordinated stone/imp can instead use `RETIRE: 1`: after the feeder has actually
fed its spiral, another part of the warrior may overwrite the launcher while
the deployed imps continue running. The watcher requires an observed friendly
overwrite from outside the feeder's own span and at least `N` surviving imp
processes matching its template. A feeder that never feeds, merely stops, or
leaves too few imps still fails. The default `RETIRE: 0` keeps the recovery
requirement.

This changes the component's lifetime contract, not its emitted instructions.
It does not establish that a companion stone reaches its clear. Growing
composites use a bounded gate run (currently 20,000 cycles), and some phase
quantity checks apply only to standalone blocks. For a late transition, also
observe the full battle horizon, the transition itself, useful clear activity,
and surviving imp descendants before measuring combat strength.

### Full phase verification and shared observation

`buildTree(tree, { rules, length, verification: 'full' })` extends intrinsic
checks through the rule set's complete cycle limit and applies declared phase
contracts. The default `quick` mode retains bounded growing-assembly checks.
`observeTree` and `createObservation` share read-only actual-address and useful
work measurement; `verifyPhases` checks a complete solo report. Battle reports
are diagnostic and cannot substitute for solo verification.

The first adapters cover `opening-qscan-mul`, `probe-burst2`,
`armadillo-switch` and draft `compact-imp-pump`. The latter two declare extra
phase contracts. Coverage and parent-permitted exceptions are explicit.
`node scripts/algebra.js explain <block> --json` exposes stored parameter
purposes, coupling, derived values, failure lessons and evidence. This metadata
does not yet replace the mutation engine. See
[Full phase verification and useful work observation](block-algebra-verification.md).

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

## Coupled pump placement

`shiftCompactPumpKeepingSeed(tree, pumpShift, {stoneShift: 0})` returns a new tree for one fanboot with a compact pump as its second member. A physical pump move `d` applies `HOPB += d` and `LEAD -= d`. The input must have explicit HOPA/HOPB/LEAD values, the resulting lead must remain in range, and source layout must stay fixed. The compact pump still requires draft registration.

After linking or building, `linkedCompactPumpSeed(built)` resolves the actual ring seed through the linked block placement. Compare it before and after the transformation. Layout mutations can change the template offset even when the parameter sum is preserved. Full verification and an actual first-launch trace remain necessary because friendly arithmetic changes can defeat the static invariant.

## Separately seeded compact launcher

`compact-imp-pump SEED1` keeps four live cells in its copied span and hoists the original imp template into outer `seq` state. Its direct `fanboot` parent plants one seed before creating copy workers, using the member's `bootSeed {source, entry, offset}` declaration. The source is a loaded template; the destination is the deployed member entry plus its declared offset. Seeded deployment currently requires an unshifted parent frame without `CHECK`; seed targets must avoid the original image and all rounded copied spans.

The head stays at `pFeed+4+LEAD` in every mode. It does not move to `pFeed+span+LEAD` when the live span shrinks to four. `withSeededCompactPump(tree, settings, mode)` clones the retained seq/stone-pump fanboot, relinks and compensates both displacements to preserve stone, pump and head. `linkedCompactPumpSeeds` resolves actual deployed entries and heads even when the template label is outside the copied span.

Modes are `SEED0` original local-template behavior; `SEED1` four copied cells reading the seeded head; `SEED2` five copied cells reading the seeded head; and `SEED3` five copied cells reading their local template after the same early initialization. Modes2/3 are experimental controls. Default0 preserves the previous source and compiled instructions. Full observation records pre-entry compatible initialization, seed damage, actual carpet source, incompatible copies, intact launches and surviving insurance.

## Two independent imp engines

`fanboot3(stone, pumpA, pumpB)` is a ring-only, three-leaf fan boot. It routes `N-1+MOREA` entrants to the first member and one to each other member. The copies have separate runtime instructions, pointers and seeds, while the opening, fan, process budget and core are shared. Exact overlap checks include each rounded copy, all three pairs, source-image overlap and wrapping. Nested shifted frames are rejected. Routing is fixed at SPLIT1/K1 without integrity CHECK.

`fanboot3 ROUTE 1` changes the split to N / 1 / N (Son of Vain's 4 / 1 / 4): every worker forks into the first member (`va SPL`) and into the third (`vc SPL`), both in lockstep, then a `DJN #N` ends N-1 workers on a DAT and the last one jumps into the second member. It costs one cell more than the default and MOREA has no effect. The default `ROUTE 0` is the routing above and emits the same code as before. Use it with members that want N entrants together in the first and third places (`run-stone` or `armadillo-switch`, and `fan-imp-pump` or a FAN 0 paper) and a one-process body in the middle (`gated-dclear`); the recipe `three-body-launch` is that tree.

`withIndependentImpEngines(tree, settings, {secondEntry, firstShift, firstPoints, secondPoints, secondLead, stoneWorkers})` creates a new tree from the retained seq/two-member-fanboot shape, relinks the three-member layout and preserves the stone location and first seed. `firstShift` moves the first pump and adjusts its lead oppositely. Recompute actual locations with `linkedCompactPumpSeeds`; full verification and competitive evaluation remain necessary.

Full verification of a `fanboot3` with multiple compact pumps automatically mirrors FIFO process descent. Each engine must actually launch at least2*N times without arithmetic drift, execute compatible imp code and leave N compatible descendants of its own in every scenario. The older shared role's instruction-compatible count is still a pool; it cannot establish independent lineages. Quick verification is bounded and does not make the full independence promise. The lineage observer does not alter VM queues, and a saturated SPL only tags successors actually admitted.

## DAT anti-imp side effects

`armadillo-switch ANTISTEP` changes only the DAT bomb's A number. The default1 retains existing code;2667 reproduces the remote-decrement mechanism studied in Elven King. When a copied bomb executes, `<ANTISTEP` decrements the B field at `bombPC+ANTISTEP` before the process dies. Keep the bomb B field derived as `HOP+1`, because it also resets the clear gate.

`createDatBombObservation` in `tools/comparison/dat-bomb.js` records exact-template DAT execution and the actual remote B decrement without changing the VM. `scripts/audit-dat-bombs.js` applies it to quiet runs and selected paired battles, checks full-state parity, and distinguishes friendly compatible-imp-cell hits from enemy imp-like-cell hits. Neither category proves a live process was killed or identifies complete ancestry.

## Separate launcher paths and signed burst geometry

`fanboot PATH0` keeps the shared lockstep emitter unchanged. Optional `PATH1/2` split one unrolled second-member copy path from the first-member fan. PATH1 continues with the stone and forks the pump; PATH2 reverses those roles. They require two entry-first leaf members, SPLIT1/MOREA1, no CHECK and an unshifted frame. The stone span remains N-rounded; the pump span is exact. N processes enter the stone and one enters the pump. `PUMPORDER0/1` selects forward/reverse copying and `PUMPWAIT` adds pump-process NOP visits, not global cycles. Use `withSeparateLauncherPath(tree,settings,{path,seed,wait,reverse})` to compensate boot offsets and preserve linked stone/pump/head positions. The helper clones its input; it does not establish combat strength.

`probe-burst2` now accepts nonzero signed STEP and SIDE-1/+1. The second lane is SIDE*GAP from the first. Its entire signed target hull must avoid the original image, including wraparound; width is GAP+abs((COUNT-1)*STEP). Distinct-lane checks use abs(STEP). Defaults preserve the old source exactly. A reverse geometry does not automatically import another warrior's bomb addressing effects.

All blocks are written here. Hill warriors are studied, never copied.
