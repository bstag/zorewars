# Historical component taxonomy and our blocks

Generated from Planar’s 14 component pages and our existing block catalog. [Archive notes](planar-warrior-history.md) · [Warrior index](planar-warrior-index.md) · [Full membership data](planar-warrior-history.json). Counts are unique source URLs per component, so a composite warrior appears in several rows. Definitions are the archive maintainer’s classification. Local mappings identify related implementations or design candidates; they do not certify archive code for composition.

| Archive component | Sources | Related local blocks |
|---|---:|---|
| [stone](https://gallium.inria.fr/~doligez/corewar/by-types/Xstone.htm) | 630 | `opening-bomber` (selectable in existing grammar) |
| [paper](https://gallium.inria.fr/~doligez/corewar/by-types/Xpaper.htm) | 315 | `paper-copy` (candidate only), `silk-launch` (candidate only) |
| [vamp](https://gallium.inria.fr/~doligez/corewar/by-types/Xvamp.htm) | 147 | `vampire-fang` (candidate only) |
| [stun](https://gallium.inria.fr/~doligez/corewar/by-types/Xstun.htm) | 636 | `clear-stun-dat` (selectable in existing grammar) |
| [imp](https://gallium.inria.fr/~doligez/corewar/by-types/Ximp.htm) | 344 | `imp-spiral` (candidate only) |
| [clear](https://gallium.inria.fr/~doligez/corewar/by-types/Xclear.htm) | 867 | `clear-dat` (selectable in existing grammar), `clear-stun-dat` (selectable in existing grammar) |
| [scan](https://gallium.inria.fr/~doligez/corewar/by-types/Xscan.htm) | 576 | `opening-bscan` (selectable in existing grammar), `compare-scan` (candidate only), `one-shot` (candidate only) |
| [pspace](https://gallium.inria.fr/~doligez/corewar/by-types/Xpspace.htm) | 182 | `pspace-selector` (candidate only) |
| [boot](https://gallium.inria.fr/~doligez/corewar/by-types/Xboot.htm) | 408 | `relocate-copy` (selectable in existing grammar) |
| [gate](https://gallium.inria.fr/~doligez/corewar/by-types/Xgate.htm) | 372 | `decrement-gate` (candidate only) |
| [quick](https://gallium.inria.fr/~doligez/corewar/by-types/Xquick.htm) | 136 | `quickscan` (candidate only) |
| [factor](https://gallium.inria.fr/~doligez/corewar/by-types/Xfactor.htm) | 5 | No battle-block mapping |
| [sort](https://gallium.inria.fr/~doligez/corewar/by-types/Xsort.htm) | 19 | No battle-block mapping |
| [other](https://gallium.inria.fr/~doligez/corewar/by-types/Xother.htm) | 305 | No battle-block mapping |

Boot relocation here does not imply our implementation also supplies the archive’s decoy behavior. Quick covers both quick scanning and quick bombing; our mapping is only to quickscan. P-space requires a profile that enables it, such as 94x-hill, rather than 94x. Factor and sort are tournament computation tasks, with no automatic battle-pool admission. Other requires individual inspection. Every proposed extraction still needs entry/exit, pointer, process, length and ruleset contracts.
