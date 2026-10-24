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
