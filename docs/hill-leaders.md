# Current hill leader anatomy

Retrieved **2026-10-28T02:41:46.087Z**. Snapshot of the published recursive tables at retrieval time, not Battle Royale or top-50 flat rankings. Retrieval date is not the hill recomputation date.

Refresh with `node scripts/hill-leaders.js`. This fetches current rankings and Redcode, checks compatibility, and rebuilds this report. A changed source hash disables its old review/extraction until reviewed again. Defaults and evolution admission stay unchanged.

## Leaders and compatibility

| Hill | Rank | Leader | Author | Native instructions | Fits our 50-instruction profile |
|---|---:|---|---|---:|---|
| [94x](https://asdflkj.net/COREWAR/X/hill32_rec.html) | 1 | [Fatamorgana X](https://asdflkj.net/COREWAR/X/HILL32/fatamorganaX.red) | Zul Nadzri | 200 | no |
| [94x](https://asdflkj.net/COREWAR/X/hill32_rec.html) | 2 | [Fire and Ice II](https://asdflkj.net/COREWAR/X/HILL32/fireandice2.red) | David Moore | 200 | no |
| [94x](https://asdflkj.net/COREWAR/X/hill32_rec.html) | 3 | [Fire and Brimstone](https://asdflkj.net/COREWAR/X/HILL32/fireandbrim.red) | David Moore/Steve Gunnell | 193 | no |
| [88](https://asdflkj.net/COREWAR/88/hill32_rec.html) | 1 | [Lithobolia C yvfp](https://asdflkj.net/COREWAR/88/HILL32/lithoboliaC-yvfp.red) | Steve Gunnell | 99 | no |
| [88](https://asdflkj.net/COREWAR/88/hill32_rec.html) | 2 | [Talisman](https://asdflkj.net/COREWAR/88/HILL32/talisman.red) | John Metcalf | 69 | no |
| [88](https://asdflkj.net/COREWAR/88/hill32_rec.html) | 3 | [Freight Train v0.2](https://asdflkj.net/COREWAR/88/HILL32/freighttrainv02.red) | David Moore | 74 | no |
| [94nop](https://asdflkj.net/COREWAR/94/hill32_rec.html) | 1 | [Arvon](https://asdflkj.net/COREWAR/94/HILL32/arvon.red) | Stefan Kammann & Forge-AI | 81 | no |
| [94nop](https://asdflkj.net/COREWAR/94/hill32_rec.html) | 2 | [Azathoth](https://asdflkj.net/COREWAR/94/HILL32/azathoth.red) | John Metcalf | 100 | no |
| [94nop](https://asdflkj.net/COREWAR/94/hill32_rec.html) | 3 | [pst_v4](https://asdflkj.net/COREWAR/94/HILL32/pst_v4.red) | Stefan Kammann & Forge-AI | 81 | no |
| [lp](https://asdflkj.net/COREWAR/LP/hill32_rec.html) | 1 | [R.O.U.S.](https://asdflkj.net/COREWAR/LP/HILL32/rous.red) | S.Fernandes | 7 | yes |
| [lp](https://asdflkj.net/COREWAR/LP/hill32_rec.html) | 2 | [Replinator](https://asdflkj.net/COREWAR/LP/HILL32/l111.red) | Christian Schmidt | 200 | no |
| [lp](https://asdflkj.net/COREWAR/LP/hill32_rec.html) | 3 | [Bronze minotaur](https://asdflkj.net/COREWAR/LP/HILL32/bronzeminotaur.red) | G.Labarga | 200 | no |

X is P-space-enabled and LP allows 200 instructions/P-space on the source hill. Our `94x` and `lp` tournament profiles differ. [Published hill settings](https://asdflkj.net/COREWAR/koenigstuhl.html). No native ranking score is directly comparable with our local benchmark points.

## Source breakdowns

### 94x #1: [Fatamorgana X](https://asdflkj.net/COREWAR/X/HILL32/fatamorganaX.red)

**P-space portfolio: stone, scanners and paper.** Study the attack portfolio separately from its controller. Several shared labels and deliberate source edits cross section boundaries.

- Source lines 10–109: Persistent selector and recovery.
- Source lines 113–150: Booted stone with clear fallback.
- Source lines 153–190: Compare scanner, wipe and boot.
- Source lines 195–220: Paper launcher and replication.
- Source lines 225–266: Second scanner, boot, clear and P-space bomb.
- Source lines 271–290: Match-entry and result-dependent logic.

Contract requirements: P-space enabled for original; Four different payload process contracts; Multi-round controller tests; solo failure is not a hill-strength verdict.

**Solo observation:** this original loses all processes in a fresh enemy-free run in our engine. P-space entry logic and intentional transitions need separate diagnosis; this is not proof that the published leader is invalid.

### 94x #2: [Fire and Ice II](https://asdflkj.net/COREWAR/X/HILL32/fireandice2.red)

**P-space choice of airbag stone or anti-imp scanner.** The stone branch is a bounded source extraction candidate. The scanner still contains STP after removing the selector.

- Source lines 15–52: Stone boot, bombing and clear fallback.
- Source lines 64–84: Result/state table and dispatch.
- Source lines 96–119: Scanner, clear and P-space bomb.
- Source lines 123–130: Scanner boot.

Contract requirements: 55440-cell arithmetic; Preserve noncontiguous boot placement and process schedule; Do not classify the scanner as P-space-free.

### 94x #3: [Fire and Brimstone](https://asdflkj.net/COREWAR/X/HILL32/fireandbrim.red)

**P-space choice of shared airbag stone or Kenshin scanner.** The Kenshin branch can be assembled without the P-brain. Its child starts while the parent is copying, so copy order is part of the behavior.

- Source lines 14–51: Stone branch shared with Fire and Ice II.
- Source lines 63–83: Result/state controller.
- Source lines 95–112: Kenshin constants and copying launcher.
- Source lines 115–124: Scanner and attack continuation.

Contract requirements: 55440-cell offsets; Concurrent copy/execute schedule; Self-modifying pointer and attack transitions.

### 88 #1: [Lithobolia C yvfp](https://asdflkj.net/COREWAR/88/HILL32/lithoboliaC-yvfp.red)

**'88 quickscan, distributed stones, paper/imp.** A distributed set of small stones is more interesting for a 50-instruction recipe than copying the entire opening.

- Source lines 11–27: Scan constants and bomb.
- Source lines 28–71: Compare probes, decode and attack.
- Source lines 73–123: Placement constants and seven stone boots.
- Source lines 124–128: Compact stone.
- Source lines 131–147: Paper and imp launch.

Contract requirements: Legal 88 modes only; Stone side effects reference the original qscan region; Spawn tree, placement spacing and payload copies must agree.

### 88 #2: [Talisman](https://asdflkj.net/COREWAR/88/HILL32/talisman.red)

**'88 quickscan then booted stone/imp.** Study the shared boot as a stone/imp recipe. A standalone stone slice would miss the separately installed bomb.

- Source lines 9–23: Scan constants and bomb.
- Source lines 25–78: Compare scan, decoder and bombing.
- Source lines 80–95: Boot distances and launcher.
- Source lines 97–107: Stone and bomb.
- Source lines 109–115: Imp and continuous launcher.

Contract requirements: 8000-cell imp stride; Boot installs distant bomb and imp seeds; Continuous launcher consumes process budget.

### 88 #3: [Freight Train v0.2](https://asdflkj.net/COREWAR/88/HILL32/freighttrainv02.red)

**'88 optional quickscan, stone and dual imp launchers.** The original already provides a scan-off switch. This gives a meaningful small reference variant without guessing which scan lines to delete.

- Source lines 14–36: Documented scan switch and constants.
- Source lines 42–44: Continuous launcher.
- Source lines 50–105: Conditional quickscan.
- Source lines 111–127: Stone and launcher boot, bomb and imp.
- Source lines 129–141: Stone and initial launch tree.
- Source lines 145–151: Conditional entry point.

Contract requirements: Seven-point imp stride congruence; Both continuous launchers and initial seeding are coupled; Self-bombing stone transition must remain intact.

### 94nop #1: [Arvon](https://asdflkj.net/COREWAR/94/HILL32/arvon.red)

**Quickscan, parallel boot, paper/stone.** Preserve the launcher and both payloads as one recipe initially. Source credits Azathoth; pst_v4 shares the body, so these are related examples.

- Source lines 14–36: Coupled scan constants, decoder and bomb loop.
- Source lines 38–57: Unrolled probes and table.
- Source lines 65–84: Parallel two-payload launcher.
- Source lines 88–98: Stone.
- Source lines 102–108: Silk paper.

Contract requirements: 8000 cells and 8000 processes asserted; Six-process launch wave and six-cell copy extents; Quickscan multiplier/inverse must be changed together.

### 94nop #2: [Azathoth](https://asdflkj.net/COREWAR/94/HILL32/azathoth.red)

**Quickscan and parallel paper/stone.** Reference ancestor for the Arvon/pst_v4 body. Catalog it as a related lineage, not three independent strategies.

- Source lines 9–20: Boot distances and shared launcher.
- Source lines 22–31: Stone constants and loop.
- Source lines 33–39: Silk paper.
- Source lines 45–68: Lattice constants, decoder and bomb loop.
- Source lines 70–89: Probe fan and table.

Contract requirements: Core-specific inverse relation; Pointers in launch instructions act as copy counters; Process scheduling and payload lengths are coupled.

### 94nop #3: [pst_v4](https://asdflkj.net/COREWAR/94/HILL32/pst_v4.red)

**Alternative quickscan over related paper/stone body.** Useful controlled comparison of scanner front ends over a related body. Source credits Azathoth and Eternal Exile.

- Source lines 14–30: Scan constants and aliases.
- Source lines 33–59: Probe fan.
- Source lines 61–77: Decoder, bombing and tables.
- Source lines 89–108: Parallel launcher.
- Source lines 112–122: Stone.
- Source lines 126–132: Silk paper.

Contract requirements: 8000 cells and 8000 processes asserted; Decoder/table/probe equations form one unit; Same process-aware body contract as Arvon.

### lp #1: [R.O.U.S.](https://asdflkj.net/COREWAR/LP/HILL32/rous.red)

**Compact limited-process paper with bombing side effects.** A seven-instruction leader is a strong reason to add process-aware replication. Small source length does not mean only seven cells participate in copying.

- Source lines 9–11: Copy and bombing offsets.
- Source lines 13–19: Copy state, attack, loop and child handoff.

Contract requirements: Test under eight-process scheduling; Entry is loop, not initialization; Pre/postincrement side effects and copy extent are part of the algorithm.

### lp #2: [Replinator](https://asdflkj.net/COREWAR/LP/HILL32/l111.red)

**Limited-process bombing paper with quickscan and padding.** The paper body resembles the compact LP family, but starts through initialization and uses a longer copy span. Remove padding only after tracing what it copies.

- Source lines 10–24: Quickscan constants.
- Source lines 42–64: Paper copy and bombing constants/body.
- Source lines 67–103: Padding and decoder tables.
- Source lines 106–132: Probe fan.
- Source lines 134–141: Decode, bomb and paper handoff.

Contract requirements: 200-instruction source hill limit differs from repo lp default; Quickscan tables use assembled label distances; Eight-process behavior and copy extent.

### lp #3: [Bronze minotaur](https://asdflkj.net/COREWAR/LP/HILL32/bronzeminotaur.red)

**Two separated limited-process bombing papers.** An example of spatially separated copies sharing a small process budget. Its solo failure in this engine needs diagnosis before extraction or training admission.

- Source lines 9–14: Two copy destinations and bombing constants.
- Source lines 16–22: First paper.
- Source lines 23–31: Spacing and two-way launcher.
- Source lines 32–38: Second paper.

Contract requirements: 200-instruction layout includes spacing; Different initial copy spans; Enemy-free failure is recorded, not silently repaired.

**Solo observation:** this original loses all processes in a fresh enemy-free run in our engine. P-space entry logic and intentional transitions need separate diagnosis; this is not proof that the published leader is invalid.

## Local reference breakouts

These retain the original authorship and are cached only in ignored `imported/hill-leaders/extracted/`. They are useful starting specimens, not our new implementations or evolution-safe blocks. Compilation and two solo placements do not prove relocation, replication or competitive strength.

| Reference | Instructions | Solo survival at both placements | Change |
|---|---:|---|---|
| [airbag-stone-94x](../imported/hill-leaders/extracted/airbag-stone-94x.red) | 26 | yes | Complete stone boot and payload; controller and scanner omitted. Requires a multi-process boot verifier before evolution admission. |
| [kenshin-branch-94x](../imported/hill-leaders/extracted/kenshin-branch-94x.red) | 23 | yes | Controller and stone omitted; concurrent launch/copy must be verified before mutation. |
| [freight-no-qscan-88](../imported/hill-leaders/extracted/freight-no-qscan-88.red) | 29 | yes | Only the author-provided switch EQU changes from 1 to 0. This retains the full source and assembles its non-scanning variant. |
| [parallel-paper-stone-94nop](../imported/hill-leaders/extracted/parallel-paper-stone-94nop.red) | 20 | yes | Quickscan and padding omitted. Keep launcher, stone and paper together; copied blank tail cells still matter. |
| [rous-reference-lp](../imported/hill-leaders/extracted/rous-reference-lp.red) | 7 | yes | Unchanged original reference; already fits 50 instructions. This is not our new implementation. |

After refreshing sources, try a reference with `node cli/zorewars.js hill imported/hill-leaders/extracted/airbag-stone-94x.red --rules 94x --length 50 --rounds 20 --json`. Reproduce the small matched screen with `node scripts/benchmark-leader-breakouts.js --out evolved/leader-screen-new`. The [screen evidence](hill-leader-screen.json) records its own snapshot date and hashes; it is not automatically refreshed with this page.


## What to build from these

1. **airbag-stone:** Booted bomber with a separate clear fallback. Preserve boot layout, remote bomb installation and process schedule. Before admission: Exact copies at both destinations; Bomb stream and self-transition occur; Fallback clear runs after trigger damage.

2. **concurrent-boot:** Child execution overlaps parent copying. Copy order and scheduling are parameters only within proven bounds. Before admission: Child never reaches an uncopied cell; Parent erases pointers only after last copy; Wrapping and process-limit cases.

3. **parallel-paper-stone:** Launcher and two payloads form one process-aware recipe before any further splitting. Before admission: Launch wave count; Both relocated payloads match; Paper replicates while stone bombs without shared-counter interference.

4. **lp-bombing-paper:** Replication and bombing with a bounded process queue and copy spans larger than visible code. Before admission: First and second generation copy bounds; Eight-process scheduling; Attack side effects; No unintentional total process loss.

5. **stone-imp-boot:** Joint placement of stone, bomb, imp seeds and continuous launcher; stride must satisfy core congruence. Before admission: Imp launch order; Remote bomb present before stone starts; Full-cycle survival and actual kills against controls.

6. **distributed-stones:** Multiple compact stones with explicit separation and process allocation. Before admission: Each stone initialized; Mutual bombing exclusion; Spawn tree reaches every intended copy.

First 94x experiment: a compact stone with a clear fallback versus the plain clear and our timed-relocation recipe. For 50-instruction 88, compare a compact stone/imp launcher with and without a small scan. For lp, prioritize a replication contract under an eight-process limit. Preserve modular-arithmetic and scheduling constraints when tuning.

P-space selection is a separate `94x-hill` project: start with a small tested controller, not the largest leader brain. A quickscanner also needs coupled parameter generation (probe lattice, tables and decoder), rather than independent random mutation of every constant.

Full hashes, assembly diagnostics, source dependencies and observed behavior: [machine snapshot](hill-leaders.json). [Main block catalog](warrior-blocks.md) · [Experiment journal](molting-94x-journal.md).
