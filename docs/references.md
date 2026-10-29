# References: the methods we borrowed

ZoreWars' evolver, trainer and push-off are built from published methods.
This list credits each one where it came from; the notes and the site link
here or straight to the source wherever a method is used. Core War's own
history (warriors, authors, archives, hills) is credited in
[warrior-family-history.md](warrior-family-history.md) and on the site's
[history page](https://zorewar.app/web/history).

## Evolution

- <a id="map-elites"></a>**MAP-Elites** (`evolve`'s species archive): Jean-Baptiste Mouret and Jeff Clune,
  "Illuminating search spaces by mapping elites", 2015.
  [arXiv:1504.04909](https://arxiv.org/abs/1504.04909)
- <a id="cvt-map-elites"></a>**CVT-MAP-Elites** (`--descriptor outcomes`, a fixed number of niches over
  outcome rates): Vassilis Vassiliades, Konstantinos Chatzilygeroudis and
  Jean-Baptiste Mouret, "Using Centroidal Voronoi Tessellations to Scale Up the
  Multi-dimensional Archive of Phenotypic Elites Algorithm", 2016 (revised
  2017).
  [arXiv:1610.05729](https://arxiv.org/abs/1610.05729)
- <a id="lexicase"></a>**Lexicase selection** (`--selection lexicase`, one case per opponent):
  Thomas Helmuth, Lee Spector and James Matheson, "Solving Uncompromising
  Problems with Lexicase Selection", IEEE Transactions on Evolutionary
  Computation 19(5):630–643, 2015.
  [doi:10.1109/TEVC.2014.2362729](https://doi.org/10.1109/TEVC.2014.2362729)
  ([PDF](https://www.cs.hamilton.edu/~thelmuth/Pubs/lexicase-IEEETEC-2014.pdf))
- <a id="epsilon-lexicase"></a>**Epsilon-lexicase selection** (lexicase with near-best scores passing a
  case): William La Cava, Lee Spector and Kourosh Danai, "Epsilon-Lexicase
  Selection for Regression", GECCO 2016.
  [doi:10.1145/2908812.2908898](https://doi.org/10.1145/2908812.2908898)
  ([arXiv:1905.13266](https://arxiv.org/abs/1905.13266))
- <a id="red-queen"></a>**Digital Red Queen** (each generation's champion joins the opponents):
  Sakana AI and MIT, "Digital Red Queen: Adversarial Program Evolution in Core
  War with LLMs", 2026. [arXiv:2601.03335](https://arxiv.org/abs/2601.03335),
  [project page](https://pub.sakana.ai/drq/), [code](https://github.com/SakanaAI/drq)
- <a id="league"></a>**League training** (`--league`: exploiters and league exploiters beside
  the main warriors): Oriol Vinyals et al., "Grandmaster level in StarCraft II
  using multi-agent reinforcement learning", Nature 575:350–354, 2019.
  [doi:10.1038/s41586-019-1724-z](https://doi.org/10.1038/s41586-019-1724-z)
  ([DeepMind's summary](https://deepmind.google/discover/blog/alphastar-grandmaster-level-in-starcraft-ii-using-multi-agent-reinforcement-learning/))

## Ranking: the diversity push-off

- <a id="tournament-weekend"></a>**Iterative diversity push-off** (`pushoff`, `--objective pushoff`, the
  arena's Ladder): the ranking the
  [Core War Tournament Weekend](https://corewar.co.uk/tournamentweekend2026.htm)
  uses, played against the top of the
  [Koenigstuhl hills](https://asdflkj.net/COREWAR/koenigstuhl.html). Our
  default rule follows the tournament runner's SD-score hill script; we have not
  found a public address for that script, so this entry will gain a link when
  one is known.
- <a id="astolfi"></a>**Diversity distance**: Achille Astolfi, "A Numeric Approach to Diversity
  Hills". [corewar.co.uk/astolfi/diversity.htm](https://corewar.co.uk/astolfi/diversity.htm)
- <a id="sd-score"></a>**SD-score**: Osama Ismael, "The Standard Deviation Score: a novel
  similarity metric for data analysis", Journal of Big Data 12:58, 2025.
  [doi:10.1186/s40537-025-01091-z](https://doi.org/10.1186/s40537-025-01091-z)

## Reference simulator and other inspiration

- **pMARS**, the reference simulator our ring mode is checked against (no pMARS
  code is included; see [COMPLIANCE.md](../COMPLIANCE.md)).
  [corewar.sourceforge.net](https://corewar.sourceforge.net/)
- **ModelWar.ai**, a Core War ladder for AI agents whose leaders suggested ideas
  for the volume (code studied, not copied; see
  [3d-battlefield.md](../design/3d-battlefield.md#ideas-from-modelwarai)).
  [modelwar.ai](https://modelwar.ai)
