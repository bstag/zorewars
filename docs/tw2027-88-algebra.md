# ICWS ’88 block evolution

The [niche review](tw2027-88-niches.md) identified a five-cell bomber with unusual matchups and an Iron Sword variant that complemented Coil 31. Both now have parameterized blocks in [niche88.js](../tools/algebra/blocks/niche88.js). The standalone recipes emit the published Gymnosperm Trickery and the tested distance-54 Iron Sword byte for byte at the instruction level. Their combined shapes use the existing `boot` and `seq` combinators.

| Recipe | Cells | Search controls |
| --- | ---: | --- |
| `gymnosperm-88` | 5 | Initial remote-copy offset `HOP` |
| `gymnosperm-boot-88` | 11 | Body offset, boot destination and copy setup |
| `iron-sword-88` | 12 | Comparison gap `GAP`, which also determines stride and clear offsets |
| `iron-sword-q2-88` | 38 | The scanner settings plus the quickscan probes and stun burst |

The behavior checks verify Gymnosperm's first remote copy, Iron Sword's reaction to a planted target, and the scanner's eventual clear in a full-length round. The quick check stops at 20,000 cycles and verifies the scan and planted hit.

## Gymnosperm results

| Tree | Points per round | Solo SD place | Better place with Coil 31 |
| --- | ---: | --- | --- |
| Published five-cell body | 1.147 | 7, 17, 51 | 15, 10, 10 |
| Default boot at 3801 | 1.167 | 15, 13, 7 | 11, 8, 13 |
| Evolved boot at 5516 with two copies per loop | 1.134 | 11, 16, 17 | 8, 8, 16 |
| Evolved five-cell body at displacement 3749 | 1.112 | 20, 26, 50 | 11, 7, 11 |

The default boot is the first tree to build on. The 3749 displacement moved the mean on seven weak matchups from 0.314 to 0.400, with a gain on each seed. The seven were Zygote (hill version), The Next Step ’88, Replicant, Zygote, A.I.P., Replicant--, and Vendetta. On three more seeds, adding 3749 to the default boot raised the boot's score against that group from 0.345 to 0.373 and lowered its full-field score from 1.154 to 1.111. The evolved boot at 5516 improved the better place with Coil 31 twice and slipped once.

## Iron Sword results

| Tree | Points per round | Solo SD place | Better place with Coil 31 |
| --- | ---: | --- | --- |
| Standalone distance 54 | 1.171 | 27, 19, 43 | 13, 10, 16 |
| Quickscan into distance 54 | 1.118 | 56, 19, 27 | 11, 7, 18 |
| Evolved quickscan into distance 34 | 1.137 | 30, 34, 44 | 10, 7, 14 |

With the evolved quickscan tree, Coil 31 supplied the better place on each seed. The quickscan tree is a pairing lead for another panel. Distance 54 remains the standalone control. The numeric search's distance-27 alternative passed the quick checks and failed to reach the clear in full verification.

## Search and replay

Each lane started with both of its recipes and tuned numbers for three generations of 20 candidates, initially using eight rounds per matchup with one race. The 14-opponent training fields contain weak matchups and controls from the published top 100. The Gymnosperm lane includes the Replicant and Zygote families, with Foggy swamp and Blur ’88 (Decoy) as controls. The Iron Sword lane includes Freight Train v0.2, Der Zweite Blitzkrieg 2021, Whirl, and Medusa's v7X. Search used points to screen candidates. The independent checks used 50 rounds per matchup against the full top 100 and replayed the official SD rule with Coil 31 on each of three common, fresh entry seeds.

Run from the project root. Replace `$lane` with `gymnosperm` or `iron-sword`.

```powershell
$lab = 'evolved/tw2027-88-niches/algebra'
$lane = 'gymnosperm'
$seed = @{ gymnosperm = 36191; 'iron-sword' = 41957 }[$lane]
node cli/zorewars.js evolve --representation tree --tune --start "$lab/$lane-seeds.json" --hill "$lab/$lane-field" --top 14 --rules 88 --length 100 --generations 3 --batch 20 --rounds 8 --race 1 --seed $seed --backend gpu --gpu-adapter NVIDIA --place none --out "$lab/$lane"
```

The [search manifest](../evolved/tw2027-88-niches/algebra/search.json) records the exact published ranks in each lane. Seed trees, exported Redcode, champion histories, validation plans, and raw matchup files are in the Git-ignored benchmark directory. The saved scores can be ranked again without running battles. [Replay script](../evolved/tw2027-88-niches/replay.mjs)

```powershell
node evolved/tw2027-88-niches/replay.mjs algebra-gym-a algebra-gym-b algebra-gym-c algebra-sword-a algebra-sword-b algebra-sword-c algebra-cross-a algebra-cross-b algebra-cross-c
```
