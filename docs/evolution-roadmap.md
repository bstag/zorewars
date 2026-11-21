# Evolution roadmap

Ideas for the next stages of `evolve` and block evolution, in the order we
plan to try them. The first two are in progress; the rest are kept here so
they aren't lost.

## What a long Red Queen run showed

A 60-generation block Red Queen run that started with ten hill leaders as
champions got worse as it went on: its late champions placed 28th-29th of 32
in a push-off against the hill. Beating a fixed set of kings is too narrow a
target. Instruction runs, which faced the whole hill as opponents, held up
better but did not beat their starting warriors on fresh seeds.

## What the 2026 top-64 benchmark showed

Evaluate both entries together with the tournament's iterative SD-score
push-off. In the top-64 hill benchmark, Escapement and Spyglass ranked
ahead of their higher-average teammates in LP and 94x, respectively.
Those averages came from different elimination stages. Each removal
changes the opponents used to compute the average and nearest-neighbor
distance at the next step.

Validate finalists on the target tournament field using fresh seeds.
For a repeat of the 2026 benchmark, use the top 64 warriors from the
relevant hill plus the entrants. Use `pushoff` with
`--top 64 --save <file>` to keep the matrix. Compare average points and
nearest neighbors on that common field, then rerank the same match
results with each candidate alone and with its proposed partner.
[2026 results and competitor comparisons](tournament-weekend-2026.md)

## 1. A realistic opponent field

Hill warriors are written for a 100-instruction limit and most fill it:
about 56 non-empty instructions on average, much of it a quickscan of about
40 instructions shared across families, with the rest of the 100 left as
empty cells. A field for a 50-instruction contest should look like what
entrants can actually write there:

- hill warriors cut to 50 instructions (quickscan or padding removed),
- hill warriors with their constants jittered,
- our own library.

Compare each cut-down version with its original against the same field, to
see what the quickscan and the padding are worth. Hill warriors remain
opponents only, never genes.

First result (29 hill warriors, each rewritten without its quickscan,
without its empty spacing, and without both; 2 seeds x 50 rounds): against
the originals they average 1.33 points per round, 1.24 without the
quickscan, 1.31 without the spacing and 1.24 without both. The quickscan is
worth about 0.09; the spacing about 0.02, within noise (identical code
differed by up to 0.05), though a few warriors lose 0.07-0.2 without it.
Empty cells can't fool a scanner, which looks for non-empty ones; what
spacing does is keep components apart. Every rewrite fit 50 instructions
(9 to 50). Small evolved warriors placed one or two places higher against
the rewritten field than against the originals.

## 2. A league instead of a single Red Queen

Three populations, as in AlphaStar's league
([Vinyals et al., Nature 2019](references.md#league)):

- main warriors play the whole field;
- exploiters are scored only on beating the current main warriors;
- league exploiters are scored on beating the whole league.

Main warriors train against the exploiters as well as the field, so their
weaknesses are found before a real opponent finds them, without the
overfitting of a fixed set of kings.

Built as `evolve --league` (see AGENTS.md): main warriors must beat the
field and the latest ten exploiters of each kind; exploiters start over from
the gene pool once one beats the main champion by `--exploit-win` points per
round or after `--exploit-age` generations.

## 3. Evolve a pair as one genome

The diversity push-off scores each entry partly by its distance from its
nearest neighbour, and our other entry is a neighbour. Evolve both entries
together, scored by both places, with mutations that change either warrior
or swap one out.

## 4. Hunt for empty niches

Use the top 100 warriors on the relevant hill as the development field,
or the whole hill if it has fewer than 100. Compare candidates' scores
against each opponent and look for matchups where the hill leaders tend
to get similar results. A specialist that scores well in a different
set of matchups can earn a larger nearest-neighbor distance, even if it
struggles farther down the hill.

Select by iterative push-off place on the development field. Check both
average points and nearest-neighbor distance to see how a candidate
earned that place. Their product governs elimination at each step.

Look for overlooked designs at ranks 101–200, where the hill has that
many entries. Play them against the same top-100 field and compare
their per-opponent scores with the leaders' profiles. Shortlist designs
with repeatable strengths against a different set of opponents. Review
their losses for matchups a small design change could improve.

Start with earlier designs that already have favorable matchups within
their constraints. Pick a specific group of leading opponents the design
could do better against, then test a targeted refinement under the
tournament rules. Compare the original and the refinement on the same
opponents and seeds. Check whether its improved matchups made its
profile more like a leader's. Keep a refinement if it improves
push-off place on fresh seeds with the proposed second entry in the
field.

Include closely related opponents when available. The 2026 recap
reported that Rodents and Hell Kitty lost places because their matchup
scores resembled those of bombing papers such as R.O.U.S. Amethystine
Python scored well across scoring formats. Compare round-robin points
rank and push-off rank on the same field, and check each candidate's
nearest neighbor among the hill leaders and our other entry.

## 5. Model-guided mutation

Random mutation edits Redcode blindly. A language model could read a
candidate with its post-mortem (`battle --report`: killing blow, causes of
death, trace) and propose a targeted change, checked by the same push-off.
Slower per candidate, better aimed, and the output is still our own code.

Built as `refine` (see AGENTS.md): the model sees the warrior, its results
per opponent and post-mortems of its worst losses (opponents' names only,
never their code), proposes a few rewrites, and each is screened and then
checked on fresh seeds against the current version.

First results, starting from a small evolved stone against Koenigstuhl
94nop warriors cut to 50 instructions: with its testing tools the model
turned it into a oneshot scoring twice the points (+0.66 per round on fresh
seeds); without them, its drafts didn't compile or killed themselves. Opus
found a kept gain where Sonnet, at a third of the cost, didn't. But in a
push-off the oneshot placed below the stone: the hill is full of oneshots,
so raw points are the wrong target here. Next: score rewrites by push-off
place.

## 6. Racing evaluation

Give every candidate a few rounds, drop the bottom half, double the rounds
for the rest, and repeat. On the same compute this tests many more
candidates, and finalists get enough rounds to reduce validation noise.

Built as `evolve --race N`: a child that beats its cell's elite on the
screen must beat it again with doubled rounds, N times, on common seeds,
before it takes the cell; champions are picked from the top four elites
with one more doubling.

Measured on the same field (2 generations, 2 seeds), re-playing every
replacement with 64 rounds on fresh seeds: without racing 58-61% of the
children that replaced an elite were really better; with `--eval-rounds 3
--race 2` 94-100% were, for about the same battle rounds, and the champions
were stronger.

## 7. In-round adaptation without P-space

`@volume/adapter.js` identifies its opponent within a round from what
touches a marker. A ring warrior could spend a few cycles reading the core,
then commit to a stone or a paper. Evolution would tune the detector and the
switch point.
