# Design: rulesets and the 3D battlefield

Status: **the 2D slice is implemented** (a torus plane, `--torus 100x80`, experimental). The full 3D game is still a proposal. See "What we built: the 2D slice" below for the semantics as implemented, which refine the draft further down, and for what we learned.

## What we built: the 2D slice

A torus battlefield of X×Y×Z cells (`settings.topology = 'torus'`, `sizeX/sizeY/sizeZ`), used so far as a plane (Z = 1): 100×80 or 125×64, both 8,000 cells.

**Numbers are points.** Every field still holds one number in [0, CORESIZE), and that number *is* a point of the torus, written in balanced mixed radix: x in [-X/2, X/2), then y, then z (`src/engine/geometry.js`). So `1`, `-1` and `12` are still steps along x, exactly as in classic Redcode, and `[0,1]` (= X) is one row down. Storage, P-space, replays and post-mortems are unchanged.

| Per axis (geometry) | Plain numbers (counting) |
| --- | --- |
| addressing (`$ @ *`), the next instruction, skips | `DJN` decrements, so counters count normally |
| `ADD SUB MUL DIV MOD` (DIV/MOD skip zero components, die only on an all-zero divisor) | pointer increments `< > { }`, so a `>ptr` clear sweeps every cell row by row |
| loading: a warrior's code runs along its row | `SLT`, `SEQ`, `SNE`, `JMZ`, `JMN` |

**The safety net.** A torus one row high (8000×1) is mathematically the classic ring. A check over the library and the 34 Hall of Fame classics (7,080 rounds) and a permanent test (`test/torus.test.js`) confirm battles there are identical, round for round, to the pMARS-verified ring.

**Syntax.** Vector literals `[x,y]` and `[x,y,z]` in any expression; constants `SIZEX`, `SIZEY`, `SIZEZ`; generators get `vec(x, y, z)`. On the ring, a vector with a y or z part is an error.

**Placement.** Warriors load on different rows, at least a quarter of the longest axis apart (Chebyshev distance). The 8000×1 torus places exactly like the ring.

### What the plane taught us

1. **Code flows along rows.** The program counter always moves along x, so an imp circles its own row (100 cells, never 8,000). Moving vertically takes a jump: Climber copies itself down and jumps into the copy.
2. **No fixed step covers the plane.** Z100×Z80 isn't cyclic: no step visits more than lcm(100, 80) = 400 cells (5%). Stones and scanners need nested loops (Plaid bombs a lattice row by row). The plane's shape decides this: on 125×64 (coprime sides) a single step can still reach every cell.
3. **Ring-computed constants break.** Imp Ring, Hedgehog, Hydra and Bandit kill themselves on the plane, because their JavaScript did ring arithmetic. Plane warriors compute with `SIZEX`/`SIZEY`.
4. **The metagame flips.** In a 17-warrior tournament on 100×80, linear core clears came first (Two-Pass Clear 2.41, Raster 2.15 points per round), papers were nearly unkillable (Papercut, Plane Silk, Fast Silk lost 0 to 8 of 320 rounds), and stride-based scanners and stones fell to about 1.0.

### Headings: code that flows in any direction

Every process has a heading, one of ±x, ±y, ±z (stored beside its program counter; +x at load). The next instruction is one step along the heading and a skip two. One new instruction, `TRN A`, turns the process to face along A relative to itself, choosing the axis with the largest component (`TRN $[0,1]` faces +y; `TRN @ptr` turns to a computed direction; a zero vector leaves the heading alone). Jumps keep the heading; SPL children inherit it. `TRN` is an assembler error on the ring, and the ring never changes a heading, so classic Core War is untouched (re-verified against pMARS and the ring identity).

What it showed: a vertical imp now works (Column Imp covers its 80-cell column). A stone standing in a column (Pillar) beats the same stone lying in a row (Plaid) in most matchups (7-3-10 head to head, 8-12 instead of 2-18 against the clears), because it is one cell wide in every row. In the full plane tournament, linear clears and papers still lead; imps are weak in 2D, since one row or column is a thin line.

### Code length and validation

A warrior's code lies along its row, and its labels are plain numbers. Only numbers in [-X/2, X/2) are pure x steps, so on a torus a warrior may be at most half a row long (50 instructions on 100×80, 63 on 125×64); the assembler explains this when a warrior is longer. The differential fuzzer found the bug this rule fixes: code longer than half a row was loaded across two rows while execution wrapped within one.

The plane has no outside reference like pMARS, so `scripts/plane-reference.js` is a second, independent interpreter written from these rules. `scripts/plane-fuzz.js` runs random programs (2D and 3D) through both and compares every cell and process after every step: 581,477 steps agree (see COMPLIANCE.md).

### Tuning on the plane

`zorewars hill`, `tune`, `evolve` and `species` take `--torus`; the field is the library warriors that can play there (see `inLibraryFor` in `src/engine/index.js`) and, with `--classics`, the Hall of Fame originals that survive on the plane (15 of 34). With the honest tuner every plane warrior improved by more than its noise margin: Pillar 0.80 -> 1.10 (a 2×2 lattice), Climber 0.42 -> 0.64 (diagonal hops), Plane Silk 1.99 -> 2.15, Plaid 0.87 -> 1.00.

The evolver on the plane (`zorewars evolve --torus 100x80`, started from Two-Pass Clear, Papercut and Plane Silk as champions) found the plane's best warrior so far, Plane Queen: 2.39 points per round against the plane field and 2.32 against the 16 classics that can play there, ahead of Two-Pass Clear (2.17) and the tuned Plane Silk (2.14). It is Two-Pass Clear plus Fast Silk's copy loop with its SPL lost. A closer look while porting it to 3D showed the loop's last jump lands on a DAT, so it leaves exactly one inert decoy and ends. That matters: a sprayer that keeps looping gets caught by the clear's SPL 0 pass and fills the process queue, starving the clear. The decoy itself adds nothing measurable: with the sprayer removed it scores the same (2.45 on 100×80, 2.35 on 40×20×10; 10 rounds against each field, seed 4242). Its edge over Two-Pass Clear (2.23 and 2.14) comes from running the clear with two processes, so it survives losing one (+0.14 and +0.15), and from its larger body (+0.08 and +0.06). Nothing on the board can hide from a clear.

### The 3D view

`web/arena3d.js` draws a torus battlefield in 3D on a plain canvas (no WebGL or libraries): every cell at its (x, y, z) with perspective and depth sorting, coloured by owner with a glow for recent writes, running processes as white points, and faint dots for empty space. Drag to rotate, wheel or pinch to zoom; it spins until grabbed. It has the 2D grid's interface (layout, draw, addressAt), so hovering and pinning cells work the same. Volumes (40×20×10, 20×20×20) open in 3D; the 2D view lays their layers out side by side.

The view also slices (only a slab of 1, 3 or 5 layers along x, y or z), zooms by buttons, wheel or pinch, fits the whole shape, and shows battle highlights: the VM reports overrides (a warrior writing into another's cell) and kills (a process dying on an enemy's bomb) when the arena calls `vm.enableEvents()`, and `web/highlights.js` turns them into splash rings and spark bursts on wall-clock time, sampled so bursts don't flood the screen. Each event also heats its cell; the heat fades with a 1.5 s half-life, and the Action camera eases towards the hottest cell and follows it. Tapping a warrior's card follows it: each frame the camera moves to that warrior's process nearest (in torus distance) to the one it followed last frame, so it rides one line of descent instead of jumping between thousands of processes, and draws a trail (broken where the process hops) and a pulsing ring. Wrapping round the torus snaps the camera across instead of sweeping it through the volume.

Drawing uses a typed-array depth sort with no per-frame allocation: about 3–4 ms per frame for 8,000 cells. The 40×20×10 volume is the default 3D battlefield because half a row (the code length limit) is 20 instructions there, against 10 on the cube. 80×10×10 gives 40 instructions, enough for hybrids such as Fleet (Battleship's scanner plus Slant's replicator, 31 instructions).

### What the volume taught us

On 40×20×10 a fixed step repeats within lcm(40, 20, 10) = 40 cells (0.5% of the volume), so single-stride stones and scanners cover almost nothing, and the metagame is the plane's, only more so. The volume baseline: Plane Queen 2.30 points per round, Volume Silk 2.21, Broadside 2.18, Fast Silk 2.18, Slant 1.83, Battleship 1.71 (30 rounds against the volume field and the classics that survive there, seed 4242). Warriors that do well treat the volume as a list of cells: clears and scanners that count with plain-number pointers (`>ptr`), and papers that copy themselves to new places.

- **Battleship** checks every cell in turn (JMZ.F on `>ptr`) and fires a 3D block salvo around a find. It beats stones and clears (20-0 against Dwarf, 15-5 against Two-Pass Clear) but not papers: there are too many copies to sink.
- **Slant** copies itself along diagonals that cross rows, columns and layers. **Broadside** is a silk paper whose every copy bombs its own diagonal, so many bombers run side by side. Papers tie each other almost every round.
- **Volume Queen** is Plane Queen written as a 3D generator. It scores 2.34 against the volume field, the best there. An evolver run on the volume (8 Red Queen generations, started from Plane Queen, Fast Silk and Volume Silk) ended at the same place: its best champion (2.31) is Plane Queen with one harmless mode change. Clears are the volume's local optimum, and two clear processes beat one (2.19) or four (0.90). A paper whose copies each run a linear clear scores the same as Broadside (2.17): papers saturate.
- **Fleet** (Battleship plus Slant, the Red Queen recipe) needs 31 instructions, so it plays on 80×10×10. It ties papers instead of beating them: in 3D the scanner can't find copies faster than the replicator makes them.

## Ideas: bigger volumes and 3D-native Redcode (not built)

These are proposals to discuss. Nothing here is implemented.

### Bigger volumes

The longest a single stride can run before repeating is lcm(X, Y, Z). It covers every cell only when the three sizes are pairwise coprime, just as 125×64 brings classic strides back to the plane. 8,000 = 2⁶·5³ can't be split into three coprime sizes greater than 1, so every 8,000-cell volume favours clears and papers.

| Volume | Cells | Half a row (code limit) | Longest stride | Character |
| --- | --- | --- | --- | --- |
| 40×20×10 (now) | 8,000 | 20 | 40 (0.5%) | clears and papers only |
| 80×10×10 (now) | 8,000 | 40 | 80 (1%) | room for hybrids |
| 41×20×9 | 7,380 | 21 | all of it | small and coprime: stones and scanners return |
| 100×80×8 | 64,000 | 50 | 400 (0.6%) | the plane, stacked: 2D warriors carry over layer by layer |
| 160×20×20 | 64,000 | 80 | 160 (0.3%) | long warriors, big hybrids |
| 63×32×25 | 50,400 | 32 | all of it | large and coprime |
| 125×64×9 | 72,000 | 63 | all of it | the 125×64 plane with depth; ring strategies at scale |

Larger volumes need rules that grow with them, as the 94x hill does for 55,440 cells: cycles in proportion (about 10 per cell), processes, and minimum distance. Classic Dwarf kills itself on 41×20×9, since 4 doesn't divide the odd row, so coprime volumes need their own step tables, like the ring's "optima" numbers. The 3D view draws 8,000 cells in 3–4 ms, so it would take roughly 30 ms for 64,000 cells. That calls for slices by default, blocks of 2×2×2 cells drawn as one point when zoomed out, or WebGL points. The VM's cost per cycle doesn't change; only rounds get longer.

A suggested ladder: **41×20×9** as a second small volume (the coprime opposite of 40×20×10, which shows the geometry deciding the metagame), then **125×64×9** as "the big one".

### Redcode for 3D

Each idea would be torus-only like `TRN`, so classic Redcode and pMARS parity stay untouched.

1. **Frame-relative operands.** A process's heading becomes a frame (forward, side, up), and the operands of the code it runs are read in that frame. Turning a process turns the whole routine: one bomber loop can bomb along x, y or z depending on how it was launched. Warriors become rotation-invariant, which also makes the next idea fair.
2. **Random orientation at load.** Each warrior is loaded with its axes randomly rotated (one of 24 rotations). Hard-coded vectors can no longer assume where "down" is, which rewards scanning over memorised geometry. It needs idea 1, or warriors written with frame-free code.
3. **Relative turns.** `TRN #k` turns left, right, up or down relative to the current heading. That's 6 cheap, evolvable moves instead of computed vectors.
4. **SPL with a heading.** A modifier (say `SPL.T A, B`) starts the child facing along B. Star launches imps in three axes today with a TRN per process; this does it in one instruction and makes multi-axis papers small.
5. **Heading-aware increments.** A post-increment that steps along the process's heading instead of +1. A clear could then sweep a column or a depth line as easily as a row.
6. **Distance comparison.** `SLT` by torus distance (an open question below) lets a scanner ask "is this near me?", for self-avoiding salvos without hand-placed limits like Battleship's.
7. **Game modes, not rules:** layers with different properties (a read-only floor, a layer where processes run at half speed), or a volume that shrinks during the round. They would be fun as arena modes, but they leave Core War's uniform-memory model behind.

Ideas 3 and 4 are the smallest steps and the most useful to evolution. Idea 1 is the biggest change and the most interesting one.

### Evolution for 3D

- **Vector-aware mutation:** mutate one axis of a vector constant, rotate a vector (swap its axes), or lift a 2D constant into 3D by adding a z part. Today's mutations treat a vector as one number, so most of them land in the same row.
- **Seed with 2D winners lifted to 3D:** Plane Queen, Two-Pass Clear and Plane Silk, with their constants rewritten as vectors.
- **A shape dimension for MAP-Elites:** how many axes a warrior's writes spread over (a line, a plane or the volume). Diagonal and volumetric species then get their own cells instead of competing with row-bound ones.
- **Fitness on several volumes at once** (40×20×10, 80×10×10, the cube and a coprime volume), so champions win because of their strategy, not because they fit one size.
- **A size curriculum:** evolve on a small volume, then carry the elites into a larger one.

### Open questions for the next step
- 100×80 (new strategies forced) or 125×64 (classic strategies carry over) as the default plane?
- 3D: z-slices are already drawn stacked; a WebGL view comes when warriors use z.

## Goals

1. Warriors fight in a 3D space, where geometry is part of the strategy rather than only the visual.
2. **Classic Core War keeps working exactly as it does now**: ICWS'94, pMARS-verified, the famous originals, the tutorial. It's ZoreWars' credibility with the Core War community, and the on-ramp for beginners.
3. Anyone can write a 3D warrior in Redcode, JavaScript or Python. The concepts carry over: an imp is still an imp, it just has a direction.
4. Reproducible, explainable battles: seeds, post-mortems, replays and the CLI work the same in 3D.

## Two layers: topology and ruleset

| Layer | Decides | Classic | 3D |
| --- | --- | --- | --- |
| **Topology** (`src/engine/topology.js`) | Battlefield shape, how addresses wrap, distance between cells, where warriors load | `ring`: CORESIZE cells in a circle | `torus3d`: X×Y×Z cells, wrapping on every axis |
| **Ruleset** | Instruction set and operand syntax, limits, scoring | `redcode-94` (ICWS'94, P-space) | `redcode-zw3d` (proposed below) |

A warrior declares its ruleset in its header (`;redcode-94`, `;redcode-zw3d`). The assembler already records it as `dialect`. A battle runs one ruleset, and only warriors written for it can enter. Classic warriors don't silently run in 3D, and 3D warriors don't run in classic.

## How addressing could work in 3D

This is the core design decision. It determines how much Redcode changes.

### Option A: 3D view of the classic core (visual only)

Keep the 1D ring and draw its 8,000 cells as a 20×20×20 cube.
- **Pros:** no engine or Redcode changes, and every existing warrior works.
- **Cons:** it's only a visualisation. Space plays no part in the battle, so neighbouring cells in the cube aren't neighbours to the program.

Good as an early milestone: a 3D renderer for the classic game.

### Option B: vector addressing on a 3D torus (recommended)

Every address and every A/B field is a 3D vector `(dx, dy, dz)`, relative to the executing cell, wrapping independently on each axis.

```redcode
;redcode-zw3d
;name Imp, heading north
        MOV.I   $0, $[0,1,0]          ; copy myself one cell along +y
```

- **Scalars stay valid:** `5` means `[5,0,0]`. A classic warrior's logic runs along the x axis, so porting is easy, and a 1-cell-high, 1-cell-deep torus behaves exactly like the classic ring. That gives a strong automated test: `torus3d(N,1,1)` must match `ring(N)` on every pMARS-verified warrior.
- **Strategy becomes spatial:** stones bomb lattices, scanners sweep planes, imp rings become imp *lattices*, and distance in three directions matters for placement and scanning.
- **Implementation:** cells stay a flat array, and a vector is stored as one integer, its linear index `x + X*(y + Y*z)`. That way the typed arrays, P-space, post-mortems and replay don't change. Only operand resolution and arithmetic do: they add per axis, with wrapping. Performance stays close to classic.
- **Cons:** new syntax and new semantics to define (listed below), and all the docs and tooling need a 3D variant.

### Option C: spatial game layer on top of classic Redcode

Keep the classic VM, and give each warrior a body in space with new instructions such as `MOVE`, `SENSE` and `FIRE`.
- **Pros:** reads like a robot game.
- **Cons:** it stops being Core War. The core idea of programs overwriting each other's memory is lost, the community knowledge stops applying, and it's a different product.

**Recommendation: B, with A as the first deliverable.** Ship the 3D *renderer* for classic battles first (Option A, no rule changes). Then add the `redcode-zw3d` ruleset with vector addressing, using the `torus3d(N,1,1) == ring(N)` property to keep it honest.

## Proposed `redcode-zw3d` semantics (draft)

| Topic | Proposal |
| --- | --- |
| Vector literal | `[x,y,z]`, each component an expression. A scalar `n` means `[n,0,0]`. Brackets avoid clashing with the A/B operand comma. |
| Constants | `SIZEX`, `SIZEY`, `SIZEZ`, and `CORESIZE = SIZEX*SIZEY*SIZEZ` |
| Modes | All eight ICWS'94 modes. Indirect modes follow a vector stored in a field. Pre-decrement and post-increment change the **x** component only, so classic pointer loops still work. Open question: allow `.y`/`.z` variants? |
| MOV, ADD, SUB | Per component, wrapping on each axis |
| MUL, DIV, MOD | Per component. Division by zero in any used component kills the process, as in ICWS'94. |
| JMZ, JMN, DJN | "Zero" means the zero vector. DJN decrements x. |
| SEQ, SNE | Equal when all components are equal |
| SLT | Open question: compare toroidal distance from the origin, or x only? Distance is more "3D"; x keeps classic idioms. |
| Placement | Warriors at least MINDISTANCE apart, measured as toroidal Chebyshev distance (the largest per-axis gap). Reproducible from the seed, like the ring. |
| P-space | Unchanged: scalar cells |
| Default size | 20×20×20 (8,000 cells, the same as classic, so cycle and process limits carry over) |

## Already in place

- `src/engine/topology.js`: the battlefield seam. Placement and distance come from the topology (`ring` today), selected by `settings.topology`. A new topology is a new entry in its table.
- The assembler records each warrior's ruleset from its `;redcode-…` header (`dialect`).
- The VM, assembler, post-mortems, replay, converter and CLI share one engine, so they'll all gain 3D when the engine does.
- The classic ruleset is guarded by the pMARS comparison (COMPLIANCE.md) and the test suite.

## Plan

1. **3D renderer for classic battles** (Option A): a WebGL view of the core as a cube, next to the 2D grid. No engine changes. Candidate library: three.js (MIT).
2. **`torus3d` topology:** vector-aware placement and distance, with tests that `torus3d(N,1,1)` places and measures like `ring(N)`.
3. **Vector operands in the VM and assembler**, behind `redcode-zw3d`. Property test: every classic warrior gives identical results in `torus3d(N,1,1)` and `ring(N)`.
4. **Generators and converter:** `vec(x, y, z)` helpers in JavaScript, Python and C++.
5. **3D warrior library and tutorial:** ports of the classics, then new families that only make sense in 3D.
6. **Battle rules for 3D tournaments:** sizes, limits and the scoring formula, published like the pMARS options so others can build compatible simulators.

## Decisions needed

1. Is Option B (vector addressing) the direction, with the classic renderer first?
2. SLT on vectors: toroidal distance, or the x component only?
3. Should pre-decrement and post-increment get per-axis variants, or stay x-only?
4. Default 3D size: 20×20×20, or a non-cube such as 40×20×10?
5. Should a 3D ruleset spec be published openly (for example as `docs/redcode-zw3d.md`, CC BY) so others can build compatible engines? Recommended: it grows the community, and the name and hosted product stay yours.
