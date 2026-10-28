# Producing stronger warriors

`train` runs an independent search for each battlefield and exports a version
only when it improves on the starting baseline in a fresh-placement check.
When the search does not establish an improvement, `best.red` contains the
baseline. Champions are still saved for further experiments.
Two generated candidates and their independent checks are preserved in
[`examples/trained/`](../examples/trained/README.md).

```sh
# Four tournament rulesets; actual tournament points drive selection.
node cli/zorewars.js train --profiles 94nop,88,lp,94x --seed 4242

# Also cover the default P-space ring, X hill, plane and four volumes.
node cli/zorewars.js train --profiles all --seed 4242 --threads 4

# Short exploratory run, keeping the normal battlefield cycle limits.
node cli/zorewars.js train --profiles 88,volume --generations 2 --batches 2 --batch 12 --eval-rounds 4 --check-rounds 30 --seeds 3 --seed 4242

# Retain different behaviours instead of one fitness-selected population.
node cli/zorewars.js train --profiles plane,volume --algorithm map-elites --objective smooth --seed 4242

# Custom tournament and a larger genome; add a previous winner as a source.
node cli/zorewars.js evolve evolved/training/94nop/best.red --rules 94nop --length 50 --genome 50 --algorithm ga --objective points --validate --seed 5252 --out evolved/next-94nop
```

Search is CPU intensive. `--threads` bounds battle workers, `--generations`
controls opponent evolution, and `--batches` × `--batch` controls children per
generation. The GA population defaults to `--batch`; set `--population` to
change it independently. `--eval-rounds` controls screening cost. Validation
defaults to three fresh placement seeds, 30 rounds per opponent and seed,
and six unique finalists (`--seeds`, `--check-rounds`, `--finalists`).
`train` uses the full entry length limit, capped at half a row on tori, so
large library warriors can be baselines too. `evolve` retains its 40-instruction
default. Set `--genome` to restrict either search explicitly.

## What is already in the library

The source of truth is [`warriors/index.json`](../warriors/index.json).
JavaScript and Python conversions are the same programs expressed in other
languages; they are not extra independent opponents. The benchmark selector
also excludes experimental prototypes. Every selected program must compile
under the selected rules. On tori, opponents must also survive a full solo run.

| Warriors | Mechanism and useful variation |
| --- | --- |
| Imp, Imp Ring, Stone and Imp | Copy moving instructions through core, sometimes alongside a bomber. Good survival baselines; winning needs a second attack. Launch order and imp spacing are sensitive to core size. |
| Dwarf, Carpet Bomber, Stunner | Blind DAT or SPL bombing, sometimes followed by a clear. Step, gap, carpet size and bombing duration determine coverage and self-hits. |
| Gemini, Mice | Copy a body and jump into it, or split into the copy and keep replicating. Copy distance and pointer initialisation matter. |
| Scout, Seeker, One-Shot, Gatekeeper | Scan for nonempty cells or differing pairs; stun the find and then clear. Probe gap, step, scan duration and clear entry are useful search targets. |
| Quickscan, Blitz | Check several fixed spots early. Quickscan falls back to a stone; Blitz becomes paper. Large unrolled scans need a larger genome budget. |
| Silk, Papercut, Fast Silk, Evolved Silk | Many processes cooperate to make fast copies. Papercut adds bombs; Fast Silk has several copy streams. Preserve the copying loop while varying distances and attack operands. |
| Vampire | Places jumps to its own pit rather than killing immediately. Fangs must keep pointing to the pit as they move. |
| Sweeper, Two-Pass Clear | Walk pointers through core, writing DAT or SPL followed by DAT. Pass lengths, direction and protection of their own body are critical. |
| Hedgehog, Hydra, Red Queen | Combine scans, booting, stones, imps or paper. They cost more instructions and process turns; crossover can destroy their internal offsets. |
| Chameleon, Bandit | Use P-space to choose strategies between rounds. Legal on the default ring and P-space profiles; excluded when P-space is forbidden. |
| Gremlin (ring) | DJN stream changes fields in other code and breaks arithmetic. A separate non-benchmark seed, available explicitly as `@gremlin`. |

| Plane and volume warriors | Mechanism and implications |
| --- | --- |
| Plaid, Pillar, Cubist | Bomb lattices. Geometry determines whether a step visits enough cells; a good ring stride can cover a tiny stripe here. |
| Climber, Plane Silk, Volume Silk | Copy across rows or layers. Search vectors as axis components, rather than only changing the encoded integer. |
| Column Imp, Weave, Lift, Star | TRN headings produce imps along y or z, sometimes along several axes. Useful survival niches, often ties. |
| Raster, Plane Queen, Volume Queen | Pointer increments enumerate the whole array even on a torus. SPL passes suppress enemy work; DAT passes finish. Two-process clears must retain their timing. |
| Slant, Scatter, Broadside | Diagonal copying, changing copy vectors and extra bombing. Some useful behaviours depend on seemingly accidental field choices; judge changes by battles. |
| Battleship, Fleet | Scan individual cells and bomb around finds; Fleet also replicates. Sharing turns between jobs can make a hybrid weaker than either parent. |
| Leapfrog | Watches a marker and jumps behind an approaching clear. Multiple watchers or copying processes can slow the response enough to lose. |
| Backdraft, Backdraft II, Tripwire | Backward clearing; a warning wire or an initial DJN stream changes their matchups against streams and forward clears. |
| Volume Chameleon, Volume Chameleon II, Anti-Chameleon | Switch strategies between rounds through P-space. Match rounds must run together to preserve learning. |
| Adapter | Recognises what touched its marker, leaps from a clear or becomes a clear against copied code, and remembers through P-space. |
| Gremlin (volume) | Evolved DJN stream, particularly useful as a counterexample to clear-only search. |

ICWS'88 has exact conversions of Imp, Dwarf, Mice and Vampire, plus adaptations
of Gemini, Scout, Imp Ring and Stunner. These eight legal programs form the
default '88 opponent field. Additional '94 library programs can supply genes;
their offspring are converted to legal '88 instructions and assembled before
evaluation. They do **not** become '94 opponents in an '88 match.

The failed and specialist hybrids are documented in
[`warriors/prototypes/README.md`](../warriors/prototypes/README.md). They remain
available as explicit sources. In particular, sibling clears killing one
another, delayed marker checks and shared counters make arbitrary grafting
unreliable. No prototype is silently added to the standard benchmark.

## Search and fitness

The original search already used mutation and crossover. Both algorithms now
share seeded genetics, a solo survival filter, strict compilation of exported
code, duplicate evaluation caching, loss-driven mutation and Red Queen
opponents:

- **MAP-Elites** keeps the strongest program in each process-count × executed
  coverage niche. Tori also distinguish how many axes the writes occupy.
  Parents are sampled uniformly across occupied niches. This protects unusual
  strategies when a clear or paper dominates average fitness.
- **GA** keeps up to `--population` unique genomes, retaining the fittest
  parents and children after each batch. Three-way tournament selection picks
  parents; crossover is attempted for 70% of children and mutation follows.
  Crossover uses the same instruction index in both parents to preserve the
  positions used by relative branches. MAP-Elites retains the original,
  more disruptive splice crossover at 20%.

The following options extend those searches without changing their defaults:

- `--selection lexicase` selects parents using shuffled per-opponent cases.
  Each case keeps candidates within epsilon of its best score. The default
  `--epsilon auto` uses that case's median absolute deviation; a nonnegative
  number gives a fixed tolerance in points/smooth-score units. In GA mode,
  survival also uses lexicase without replacement after keeping the overall
  elite, so scalar truncation does not immediately discard specialists.
- `--descriptor outcomes` replaces MAP-Elites' solo-species cells with a
  CVT archive of win and tie rates against the fixed starting field, including
  partners for push-off. Loss rate is implicit. `--archive-size` caps its
  cells (default 64). Seeded centroids and probe identities stay fixed; every
  generation remeasures outcomes on its common placements and reassigns the
  surviving elites. New Red Queen champions affect fitness and lexicase cases,
  but never change descriptor dimensions. This option needs MAP-Elites and a
  starting field; it is unavailable with `--scratch`.
- `--local-steps N` adds bounded memetic refinement to offspring that improve
  on their parent. It uses the existing numeric `retune` operator (axis
  mutation on tori), retaining scalar improvements along the local trajectory.
  Other trials may still enter a different archive niche. Every trial uses
  the same current-generation opponents, seeds and strict survival checks.
  The default is zero; local search consumes additional evaluations.

Existing step/parameter tuning remains available through `tune` and the
architecture grids in `scripts/explore-88.js`. `tune` searches a generator's
declared `P`/`SPACE` parameters and recompiles its related expressions. Numeric
refinement inside evolution operates on compiled operands; it does not know
which operands originally shared a parameter. It is an integration of the
existing mutation machinery, not a replacement for generator tuning or a
symbol-aware program representation. Structural crossover still has the
relative-reference limitations described above.

```sh
node cli/zorewars.js evolve --rules 88 --length 50 --genome 50 --algorithm map-elites --selection lexicase --descriptor outcomes --archive-size 32 --local-steps 2 --objective points --validate --seed 4242 --out evolved/outcomes-88
```

Mutations retune fields, change opcodes/modifiers/modes, remove instructions,
add process launches, or graft library slices. On tori they can also change
one axis, swap axes, lift a vector off its row, or insert a turn. P-space
opcodes are generated only when entry rules permit them. The assembler checks
every distinct candidate before it competes. Geometry limits cap genomes at
half a row as well as the configured instruction limit.

Each generation re-evaluates survivors against its current opponents and
placements. Earlier fitness values are never compared to the new generation's
scores. Half of fitness comes from the starting field and half from previous
champions, when both exist. `--ties` discounts ties against champions. With
`--objective points`, ordinary matches use 3/1/0 tournament points. With
`--objective smooth`, a loss receives a fractional reward for survival. The
`evolve` default remains smooth; `train` defaults to points.

`evolve --objective pushoff` scores each candidate by its place in a Core War
Tournament Weekend push-off against the opponents (average points times
SD-score diversity, the median of the eight points readings), so a warrior
that wins in its own way beats a stronger copy of what the field already
plays. `--partner a.red,b.red` enters our other entries beside each
candidate; their places count half against it, so it isn't bred to push
them out. The opponents' own round robin is played once at the start, at
`--field-rounds` (default 50) a pair. Keep it and `--eval-rounds` high (20 or
more): few rounds make results noisy, and noise reads as diversity. At 10
rounds a pair the hill looked so diverse that a vampire placing 7th came
last. Use it with `--hill` to train for a tournament:

```sh
node cli/zorewars.js evolve my-entry.red --rules 88 --length 50 --genome 50 --hill koenigstuhl:88 --top 50 --objective pushoff --partner other-entry.red --eval-rounds 20 --out evolved/88-pushoff
```

`--scratch` uses random initial programs and champion-only fitness. Library
results remain observational, not a search target. If validation is requested,
scratch finalists are checked against their champion lineage rather than
using the library to select them. Explicit sources and `--king` are still
honoured, so omit those for a strictly random start.

## Validation and exported versions

The starting baseline is the strongest surviving initial source by first
generation screening fitness, before generated grafts or mutations. Final
population members (or niche elites) and champions provide the shortlist;
duplicate genomes are checked once. The baseline is always checked too.

Validation uses new placement seeds, identical for every candidate and the
baseline, and follows the selected objective: tournament points, smooth
survival reward, or push-off placement with the same partner weighting and
points tie-breaker as search. Push-off rebuilds a common opponent/partner
round robin for each fresh seed, reused by every finalist; candidates are
entered separately, never against the other finalists. For each seed it
compares the paired candidate-minus-baseline objective values. Reports retain
ordinary points and smooth scores alongside `objectiveValue`; push-off also
records the candidate and partner median places for each seed.
The noise margin is 2.5 standard errors of those seed-level gains. An evolved
candidate replaces the baseline only when its mean gain exceeds that margin.
The same opponent field is used, so this tests new placements, **not**
generalisation to an unseen hill. The margin is a practical screening guard,
not a guarantee or a formal tournament confidence bound. Use more seeds and
rounds for consequential comparisons.

Each profile directory contains:

- `best.red`: recommended checked version, possibly the starting baseline.
- `redqueen-N.red`: each generation's champion, including GA champions. The
  filename is retained for compatibility; the program's name identifies GA.
- `elite-pP-cC[-sS].red`: the best final program in each occupied niche. In GA
  mode these summarise its final population, rather than an independent
  historical diversity archive.
- `elite-oN.red`: outcome-descriptor elites, when that descriptor is selected.
- `evolve.json`: exact settings, seed, algorithm, baseline, champions, final
  population/archive, operator credits, genotype IDs and parent IDs, compiled
  input snapshots, validation seeds, per-opponent wins/losses/ties and gains.
  Outcome runs also retain the probe panel, centroids and elite descriptors.
  `stats.matches` and `stats.battleRounds` count actual search matches/rounds,
  including champion checks and the push-off field matrix, excluding final
  validation. `localTried` and `localImproved` report numeric refinement work.

`training.json` summarises completed profiles and points to each version and
report. It is saved after each profile; interrupted searches keep already
completed profiles and generation champion files. Reusing an output directory
overwrites files from that run and may leave older extra files; the manifest
and report describe the current run. Use a new `--out` for each experiment.
Generated outputs under `evolved/` are ignored by Git.

The initial comparison and its limitations are recorded in
[`evolution-experiments.md`](evolution-experiments.md).

`node scripts/compare-evolution.js --threads 4` runs six ablations on the
actual '88/50-instruction battlefield, across three evolution seeds. It
compares GA, lexicase GA, species MAP-Elites, outcome MAP-Elites, outcome plus
lexicase, and the latter with local refinement. All use identical sources,
offspring schedules and fresh-seed validation. Five experimental '88 warriors
are checked separately and never used for selection. `comparison.json`
records actual search battle counts and elapsed times: this is an initial
capability comparison, not an equal-compute benchmark or a prediction of
public-hill strength. `--variants ga,memetic`, `--seeds 4242`, `--generations`,
`--batch`, `--eval-rounds`, `--check-rounds` and `--out` allow smaller runs.

The seed controls all evolutionary choices and match placements; changing the
number of workers does not change the result for the same inputs and engine.
Reports retain compiled inputs because a remote hill or the library can
change. They are evidence and warm-start material, not resumable PRNG
checkpoints. To continue search, pass saved warriors as sources or `--king`
and use a new seed and output directory.

## Ruleset profiles

| Profile | Battlefield |
| --- | --- |
| `default` | 8000-cell ring, 8000 processes, P-space allowed |
| `94nop` | 8000-cell ring, no P-space |
| `88` | 8000-cell ring, ICWS'88 syntax, no P-space |
| `lp` | 8000-cell ring, eight processes, no P-space |
| `94x` | 55440-cell ring, 10000 processes, 500000 cycles, no P-space |
| `94x-hill` | X battlefield with P-space |
| `plane` | 100×80 torus |
| `volume` | 40×20×10 torus |
| `volume-wide` | 80×10×10 torus |
| `volume-coprime` | 41×20×9 torus |
| `volume-cube` | 20×20×20 torus |

`train` accepts common limits such as `--length`, `--cycles` and `--processes`;
these override profile settings and are recorded. Changing them changes the
competition being trained for. For arbitrary torus dimensions or combined
custom rules, use `evolve --torus ... --rules ... --validate`.

For tournament preparation, train against a representative local opponent
folder or a public hill rather than only the tutorial library:

```sh
node cli/zorewars.js evolve --rules 94nop --length 50 --genome 50 --hill koenigstuhl:94nop --top 50 --algorithm ga --objective points --validate --seed 4242 --out evolved/94nop-hill
node cli/zorewars.js hill evolved/94nop-hill/best.red --rules 94nop --hill koenigstuhl:94nop --rounds 100 --seed 97531 --json
```

The remote hill needs network access. `--classics` separately reports
champions against fetched originals and does not use those results in
evolution or the final selection. Preserve entry limits when opponents need
longer code or P-space: opponent loading may relax those settings, while
candidate compilation still enforces the requested entry rules.
