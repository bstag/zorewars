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

Three populations, as in AlphaStar's league:

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

Measure where every hill warrior sits by behaviour (the correlation of its
results across the field) and search for warriors far from all of them with
a reasonable average. In the push-off, distance multiplies the score.
Families of near-clones on the hill are targets: a warrior that beats one
beats all of them.

## 5. Model-guided mutation

Random mutation edits Redcode blindly. A language model could read a
candidate with its post-mortem (`battle --report`: killing blow, causes of
death, trace) and propose a targeted change, checked by the same push-off.
Slower per candidate, better aimed, and the output is still our own code.

## 6. Racing evaluation

Give every candidate a few rounds, drop the bottom half, double the rounds
for the rest, and repeat. On the same compute this tests many more
candidates, and finalists get enough rounds to reduce validation noise.

## 7. In-round adaptation without P-space

`@volume/adapter.js` identifies its opponent within a round from what
touches a marker. A ring warrior could spend a few cycles reading the core,
then commit to a stone or a paper. Evolution would tune the detector and the
switch point.
