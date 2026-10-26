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

Drawing uses a typed-array depth sort with no per-frame allocation: about 3–4 ms per frame for 8,000 cells. Per-axis addition, which the VM does for every address, goes through lookup tables (each number's position along each axis, and the number at each position), so the VM runs as fast on a plane or volume as on the ring: about 9 million steps a second on 40×20×10, up from 4.4 with the arithmetic version (paired runs, same machine). The 40×20×10 volume is the default 3D battlefield because half a row (the code length limit) is 20 instructions there, against 10 on the cube. 80×10×10 gives 40 instructions, enough for hybrids such as Fleet (Battleship's scanner plus Slant's replicator, 31 instructions).

### What the volume taught us

On 40×20×10 a fixed step repeats within lcm(40, 20, 10) = 40 cells (0.5% of the volume), so single-stride stones and scanners cover almost nothing, and the metagame is the plane's, only more so. The volume baseline: Plane Queen 2.30 points per round, Volume Silk 2.21, Broadside 2.18, Fast Silk 2.18, Slant 1.83, Battleship 1.71 (30 rounds against the volume field and the classics that survive there, seed 4242). Warriors that do well treat the volume as a list of cells: clears and scanners that count with plain-number pointers (`>ptr`), and papers that copy themselves to new places.

- **Battleship** checks every cell in turn (JMZ.F on `>ptr`) and fires a 3D block salvo around a find. It beats stones and clears (20-0 against Dwarf, 15-5 against Two-Pass Clear) but not papers: there are too many copies to sink.
- **Slant** hops diagonally across rows, columns and layers, then (by a happy bug: its steering ADD.AB moves the destination field instead of the hop) lays a chain of copies one body length apart and writes stray values along a diagonal. As written it scores 1.84; with the steering it was meant to have, 1.76, and Fleet, which shares the code, 1.16 instead of 1.66. **Broadside** is a silk paper whose every copy bombs its own diagonal, so many bombers run side by side. Papers tie each other almost every round.
- **Volume Queen** is Plane Queen written as a 3D generator. It scores 2.34 against the volume field, the best there. An evolver run on the volume (8 Red Queen generations, started from Plane Queen, Fast Silk and Volume Silk) ended at the same place: its best champion (2.31) is Plane Queen with one harmless mode change. Clears are the volume's local optimum, and two clear processes beat one (2.19) or four (0.90). A paper whose copies each run a linear clear scores the same as Broadside (2.17): papers saturate.
- **Leapfrog** answers the clears. A clear can't be hidden from, but its front is predictable and its code never moves. Leapfrog plants a marker two rows up (the side the front comes from), watches it, and when either pass changes it, copies itself four rows further up, behind the front, with a single process so nothing is left to be stunned. Between looks it runs its own slow forward clear, which reaches the enemy clear's code in time. It beats Volume Queen 29-1, Plane Queen 28-2, Two-Pass Clear 26-4 and every stone, but loses to every paper (0-28 against Fast Silk), whose copies keep tripping its marker and outnumber it: 1.92 against the whole field. With papers tying clears, the volume has a rock-paper-scissors triangle again. Variants tested: four markers on all sides (Sentry, 80×10×10) did worse: each check costs a turn, and bombs and copies land without crossing a marker first. Random hop directions also did worse (1.85 against 1.92: a random hop sometimes lands ahead of the front), though they beat Imp 30-0.
- **Volume Chameleon** plays the triangle with P-space: Leapfrog first, and after a lost round the clear (Volume Queen's), switching back after losing with that. It scores 2.39 on 80×10×10 (30 rounds, seed 4242), ahead of Volume Queen and Plane Queen (2.25), Fast Silk (2.10) and Leapfrog alone (1.97). It still loses to the fastest papers, which beat Leapfrog outright and can win against the clear too. **Anti-Chameleon** reads it: Volume Chameleon keeps its strategy after a win and switches after a loss, always between the same two, so a paper-and-Leapfrog switcher that switches after every decided round (keeping only after ties) is always one step ahead: 26-2-2 against Volume Chameleon over 30 rounds. Against warriors that never switch, switching after a win throws away a winning strategy (11-12-7 against Volume Queen; with the classic switch-after-loss rule it would be 19-7-4 but only 14-9-7 against Volume Chameleon), so it scores 1.98 against the whole field to Volume Chameleon's 2.33, and its paper only ties other papers. It is kept as the counter-switcher. **Adapter** identifies its opponent within the round, from what changes its marker: an instruction with both fields zero (one `JMZ.F`: a clear's `SPL 0` or `DAT 0`, or a bomb) means leap; anything with non-zero fields is copied code, a paper (or an imp), so it becomes Volume Queen's clear on the spot, and it records what it saw in P-space to open the next round with the answer. 2.21 on 80×10×10: Papercut 19-6, Battleship 20-10, Volume Queen 20-10, close to even with Volume Chameleon (10-13-7). Lessons on the way: matching the clear's exact bombs (`SPL #0,#0`, `DAT #0,#0`) misread Battleship's `DAT $0,$0` bombs as a paper (7-23); and reopening with Leapfrog after every loss, to look again, threw the lesson away (2.02 instead of 2.21). Not kept: **Bullfrog**, Leapfrog with Battleship's scan and salvos in place of its slow clear (1.54). It beats Leapfrog head to head, but papers overwrite its single-process body within about 3,000 cycles, long before a one-cell-per-pass scan can matter: like Battleship, it can't out-shoot a paper.
- **Scatter** is Slant with the steering it was meant to have (ADD.A): every copy lands somewhere new, and it runs code in about 4,400 cells alone against Slant's 2,000. Tuned, it scores 1.76 against Slant's 1.84, so Slant's chains win, but both are kept as two kinds of replicator.
- **Tried and not kept** (40×20×10 unless noted, 30 rounds, seed 4242, against Volume Queen's 2.26). Every one of these is in [`warriors/prototypes/`](../warriors/prototypes/README.md), runnable, with its numbers and what it teaches:
  - *Fang clears* (the clear's first pass writes `JMP -1`, so each fang jumps to the one written before it and every row becomes a ring that traps processes; then a DAT pass, or one DAT per row, or `SPL 0` pits in the rings): 1.99, 1.73, 1.79. A trap only holds the processes that run into it, while `SPL 0` also makes each trapped process spawn, flooding the enemy's queue so its copying processes hardly run. That is why a stun pass beats papers and a fang pass doesn't.
  - *Dodging Queen* (Volume Queen plus a watcher that moves the whole clear behind another clear's front, 80×10×10): with two clear processes their shared first-pass counter splits them after a move into one SPL pass and one DAT pass on alternate cells, so stunned enemies survive; with one clear process it beats clears 17-3 but loses ground to papers: 1.77 against 2.25.
  - *Queen Imp* (the clear plus Lift's depth imp): 0.89. The clear stuns its own imp, which then floods its own queue.
  - *Small-swarm Frogspawn* (a few frogs, splitting only when a marker is touched): 0.69-0.71. It survives and ties but has no attack.
  - *Remora* (hide in an enemy's blind spot, e.g. the rows Battleship never scans near itself) wasn't built: only Battleship has such a spot here, Leapfrog already beats it, and clears have none.
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

**Tested on 41×20×9 (it didn't hold, yet).** On the coprime volume (30 rounds against the field that can play there and the classics, seed 4242), clears still lead: Plane Queen 2.32, Volume Queen 2.26, Two-Pass Clear 2.07, Volume Silk 1.99, Fast Silk 1.85, Battleship 1.59, Seeker 0.58. Cubist and Dwarf kill themselves there, since their steps assume even sizes. An evolver run from scratch (6 generations) found warriors that use the volume, such as a paper/stone hybrid whose copier and stone both step through all three axes (2.05). But its best champions (2.24–2.25) are again a core clear run by two processes, plus spare parts. A stride that *can* reach every cell still takes 7,380 steps to do it, and a clear covers the same cells in the same time with no gaps and no risk to itself. So coprime sizes bring strides back in theory, but clears stay the stronger choice at this size. Stones would need step tables built for the volume, as the ring's "optima" numbers were.

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

- **Results so far:** with `axis`, `rotate`, `lift` and the shape niche, a 6-generation run on 40×20×10 (started from Volume Queen, Broadside and Battleship) filled 39 species cells, 19 of them volume-shaped. `lift` improved its parent in 19 of 96 tries, about as often as `retune` (31 of 154). Its champions (2.30–2.32) tie Volume Queen (2.34) within noise and are variants of it: the 3D mutations show up as a depth vector on the kill bomb and an idling third process. Clears remain the volume's local optimum. Finding something better probably needs a fitness that rewards beating clears specifically, or larger volumes where a sweep takes longer.
- **Vector-aware mutation (built):** on a torus the evolver also has `axis` (nudge one axis of a number, or set it anywhere along that axis), `rotate` (swap two axes) and `lift` (give a plain step a y or z part). It can also write TRN: `turn` makes an instruction face along one axis, and `tweak` can switch any opcode to TRN, so evolution can find code that flows down columns or through layers by itself instead of only by grafting it from Lift, Star or Column Imp. (`tweak` now picks from every ICWS'94 opcode except the P-space ones, adding SLT, DIV, MOD and NOP on every battlefield.) In a first 3-generation run on 40×20×10, `turn` improved its parent 4 times in 36 tries, and 7 of the 36 species in the archive use TRN. Generation 1's champion built a depth imp by itself: it copies `MOV.I $0, $[0,0,1]` into the cell one layer below a `TRN $[0,0,1]`, so the turned process steps down into the copy and keeps going through the layers, as Lift does. Later champions dropped it. The older retunes treat a number as one number, so most of them stay in the same row.
- **Seed with 2D winners lifted to 3D:** Plane Queen, Two-Pass Clear and Plane Silk, with their constants rewritten as vectors.
- **A shape dimension for MAP-Elites (built):** `measureSpecies` reports `shape`, how many axes the cells a warrior wrote alone spread over (1 a row, 2 a layer, 3 the volume). On a torus it is the archive's third dimension, so diagonal and volumetric species get their own cells instead of competing with row-bound ones.
- **Fitness on several volumes at once** (40×20×10, 80×10×10, the cube and a coprime volume), so champions win because of their strategy, not because they fit one size.
- **A size curriculum:** evolve on a small volume, then carry the elites into a larger one.

### Evolving from scratch

`zorewars evolve --scratch` starts from random programs (random opcodes, modifiers, modes and numbers, TRN included), with no library code, no library opponents and no known-good numbers: fitness is only against earlier champions, the first four being random survivors, and the library is held out to watch progress.

- **On the 100×80 plane (20 generations, genomes up to 20):** self-play settled on tie-farming. Champions survived by not dying (a 3-cell loop, then an `SPL` spreader with 936 processes) and never grew an attack: 0.8-1.1 points per round against the held-out library. With no outside opponents a newcomer only has to out-survive random ancestors, and nothing rewards killing.
- **Then on 40×20×10 (12 generations, the plane's champions as kings):** most champions stayed tie-farmers (0.51 against the library), but generation 8, which nearly always lost to its own ancestors, beat Volume Queen 29-1, Plane Queen and Leapfrog 30-0, Volume Chameleon 26-3 and Adapter 28-1. It rediscovered a classic **DJN stream**: `DJN.F #10, {-10` loops on itself while its `{` pointer walks back through memory, taking one off both fields of every cell. Clears depend on exact numbers, so they destroy themselves; papers shrug it off. It is in the library as **Gremlin** (1.91 on 40×20×10, 1.79 on 80×10×10, 1.67 on the plane). Its strategy is classic ICWS'94: the TRN and vectors were leftovers in lines that never matter, so `warriors/gremlin.red` is the same program for the ring (TRN made NOP, vectors cut to their x part). There it beats Two-Pass Clear 30-0 and Vampire 28-1 but loses to scanners and papers (1.18).
- Lessons: pure self-play finds survivors, not killers, and its fitness can't tell a world-class specialist (Gremlin scored 0.14 against its ancestors) from a dud. Holding the library out was what spotted it.
- **A second run with a kill reward** (`--ties 0.1`: a tie with a champion counts a tenth, so champions must kill; the same two phases, phase 2's kings being phase 1's generations 7-9) behaved differently. On the plane, children kept beating their parents (17-28 a generation, against 1-9 in the first run) and the champions became clears, process swarms and papers instead of survivors (0.84-1.18 against the held-out library). On the volume, generations 7 and 10 were **DJN streams again** (`DJN.I #4, {-15`), found independently of Gremlin: 1.94 and 1.91, Volume Queen, Plane Queen and Battleship 30-0, Leapfrog 29-1, and a tie with Gremlin in every round. Two runs from different random starts converging on the same trick suggests the DJN stream is the volume's natural answer to clears. Generation 10, the smallest (10 instructions, one process), is in `warriors/prototypes/evolved-stream.red`.

### Ideas from the hill archive

The 567 warriors of the public hill collection (n1LS/redcode-warriors, studied, not copied; see COMPLIANCE.md for what it taught the assembler) were scored against our library on the ring and, for the 287 that run there unchanged, on 40×20×10. Stunners and SPL carpets did best on the ring (up to 2.52, '88 test IV). On the volume a 12-instruction backward clear, ULTIMA RATIO REGUM, scored 2.53 (30 rounds, 3 seeds), ahead of everything we had (Volume Queen 2.25), and 16 hill warriors beat Volume Queen. Its front comes the other way: every lookout we built (Leapfrog, Adapter, Volume Chameleon) watches the side a forward clear arrives from. Our own versions:

- **Backdraft** (new): a backward two-pass clear in one process, laying SPL 0 / JMP -1 trap pairs then DATs, each pass stopping just short of itself, repeated. **2.53**, Leapfrog and Volume Queen 30-0, papers 13-8 and 14-9; Gremlin beats it 16-12 (a clear's numbers are what a stream breaks). The trap pair matters (2.06 with SPL 0 alone), and so does one process (1.35 with two: they share a counter and drift apart, as in Dodging Queen).
- **Tripwire** (Gremlin modified, after Death): a DJN stream for one lap, tripping a (1,1) wire at the end of its own code, then Backdraft's clear. **2.37**; beats Backdraft 12-9-9 and ULTIMA 21-9, Volume Queen 30-0; even with papers; Gremlin beats it.
- Not kept (see `warriors/prototypes/`): a small trap scanner (Snare, after Shears), a backward One-Shot for the ring (One-Shot II, after Oneshot '88), and decoys for One-Shot ('88 test IV): none beat what we had.

- **Follow-ups.** *Volume Chameleon II* (Backdraft, switching to a paper after a loss: a stream beats Backdraft but can't hurt a paper) scores 2.33 on 80×10×10, beating Gremlin 20-6 and Volume Chameleon 27-2. *Backdraft II* adds a wire two rows upstream: when a stream (or anything) touches it, the clear moves into cells the stream has passed. It turns Gremlin from 10-19 into 12-1-17 and beats Backdraft and Tripwire 26-4, but checking the wire every step slows it (1.91 overall). *Leapfrog II*, wires on both sides, lost too much speed (prototype). An evolver run started from Backdraft and Tripwire found Backdraft with its first pass a few cells shorter; it beat Backdraft 19-11 head to head but tied it over the field (2.48 against 2.51), and tuning the pass lengths found nothing better.

**Rankings, 25 October 2026** (every library warrior that plays there, whole field and classics, 3 seeds × 30 rounds):

| 40×20×10 | | 80×10×10 | |
| --- | --- | --- | --- |
| Backdraft | 2.51 | Backdraft | 2.36 |
| Tripwire | 2.37 | Volume Chameleon II | 2.33 |
| Volume Queen | 2.14 | Tripwire | 2.23 |
| Volume Silk | 2.13 | Volume Chameleon | 2.19 |
| Broadside, Plane Queen | 2.12 | Volume Queen, Adapter, Plane Queen | 2.11 |
| Raster | 1.92 | Volume Silk | 1.99 |
| Gremlin | 1.87 | Backdraft II | 1.91 |
| Scatter, Slant, Leapfrog | 1.73-1.79 | Anti-Chameleon, Raster | 1.87-1.88 |

### Ideas from ModelWar.ai

[ModelWar.ai](https://modelwar.ai) is a Core War ladder for AI agents (ICWS'94, a 25,200-cell 1v1 core and a classic 8,000-cell 10-player arena). Its leaders, read through its public API (code studied, not copied), suggested three techniques, tried on our bots as switches the tuner can keep or leave off (40×20×10, whole field, 3-5 seeds, 30 rounds each):

- **Free side effects in spare operands** (Mercenary): `spl 1, {far` starts a process and decrements a far cell at once. In papers every copy runs it from a new place. Scatter gains about 0.06 (kept: B-field decrements); Volume Silk and Broadside don't change (±0.01); Slant loses badly (1.84 to 1.20 with A-field decrements, 1.75 with B-field), because its copies lie in chains and the decrements land on its own copies.
- **A quick-scan opener** (Pyre-Swept): Volume Queen compares two pairs of distant cells before launching and starts its first pass at a find (`MODE qscan`, replacing the useless decoy). 2.24 against 2.25: four probes rarely find anything in 8,000 cells, and the clear reaches everything anyway. Left off.
- **A one-instruction P-space switch** (Chimera, `ldp` then `slt`): it would free only about two of Volume Chameleon's 38 instructions, too few for an opener, and its rule (after a loss play B, otherwise A) adapts worse than keep-after-a-win, switch-after-a-loss. Not applied.

The ladder itself is mostly two designs by John Metcalf (Spellbinder, a one-shot scanner turning into a decrementing SPL clear; Mercenary, a paper with silk imps) re-tuned for 25,200 cells, and its strongest entry is evolved (Pyre-Swept: a quick-scan in front of a one-shot).

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
