# n1LS Redcode collection in our warrior history

Added October 28, 2026. The [n1LS/redcode-warriors collection](https://github.com/n1LS/redcode-warriors)
contains **567 Redcode source files and one listing**, all now cached locally
with their original bytes and attribution. This expands the historical corpus;
it does not add opponents or genes to the ordinary evolver automatically.

- [Browse all warriors](n1ls-warrior-index.md): names, authors, pinned source links and local compatibility.
- [Machine-readable history](n1ls-warrior-history.json): source hashes, original strategy/version notes, date candidates, duplicate groups and assembly diagnostics.
- [Broader family history](warrior-family-history.md): how this evidence relates to our generator work.

## Provenance and dates

The snapshot is pinned to commit `615f2f3d75acfcb5420821eb5c1acc659377a7e2`
and Git tree `0101c055147bc8e3633ca7bd05bed34776027abc`. The repository has a
single initial commit dated **April 27, 2018**. That establishes an upload,
not when these warriors were invented or submitted to a hill. The indexer
reconstructs and verifies the Git tree hash, checks every file's blob hash and
size, and refuses missing or additional files.

There are 539 sources with an author header and 28 without one. All have a name
header. Forty-one files contain numeric date candidates in source comments;
these are preserved as evidence requiring review, not automatically converted
into creation dates. Placeholders such as `Submitted: @date@` are not dates.

The pinned tree contains no repository license file. Following our existing
archive convention, full originals remain under ignored
`imported/history/n1ls/redcode-warriors-615f2f3d75acfcb5420821eb5c1acc659377a7e2/`.
Tracked documents retain provenance and analysis. No source attribution is
replaced, and no downloaded host-language program is executed.

## Useful version series already identified

These are source-based observations, not new performance measurements. File
names and version numbers alone do not prove direct descent or improvement.

| Series | Evidence in this collection | Lesson for our search |
|---|---|---|
| Agony 2.1, 2.4b, 3.1, 5.1 | Stefan Strack's version notes describe changing scan intervals and bombing duration, anti-imp constants, gating, and later boot/decoy placement. The 5.1 notes also record shorter launch code. | Evolve scanner spacing, bombing budget, and relocation as related choices; measure how long it takes to scan or attack our own decoy. |
| Charon 2.0, 3.0, 7.0, 8.0, 8.1 | Author notes credit integration with Strack's Echo, movement away from half-core scan pairs, a decrement-driven transition into the clear, and later anti-imp steps. | Preserve the scan-to-attack pointer interface and test the transition trigger independently. Counter-strategies should inform opponent selection. |
| Imprimis 2, 4, 6 | Paul Kline's headers describe changing stone/imp combinations; version 4 credits ExtraExtra and Impression and adds anti-vampire/clear/gate roles. Version 6 describes different three- and seven-point imp launchers and redundant clears. | Launcher scheduling, imp stride, and process allocation need a joint contract before whole components can be crossed over. |
| Sphinx 2.8, 2.9, 4.7, 5.1 | The 2.8 header describes constant optimization in a stone/spiral with a multipass clear; 5.1 explicitly describes adding a decoy. Intermediate files are available for subsequent detailed comparison. | Keep parameter tuning and structural alternatives distinct in the experiment journal; do not infer that the highest version number is strongest. |

Primary source anchors:
[Agony 2.1](https://github.com/n1LS/redcode-warriors/blob/615f2f3d75acfcb5420821eb5c1acc659377a7e2/agony21.red),
[Agony 5.1](https://github.com/n1LS/redcode-warriors/blob/615f2f3d75acfcb5420821eb5c1acc659377a7e2/agony51.red),
[Charon 3.0](https://github.com/n1LS/redcode-warriors/blob/615f2f3d75acfcb5420821eb5c1acc659377a7e2/charon3.red),
[Charon 7.0](https://github.com/n1LS/redcode-warriors/blob/615f2f3d75acfcb5420821eb5c1acc659377a7e2/charon7.red),
[Charon 8.1](https://github.com/n1LS/redcode-warriors/blob/615f2f3d75acfcb5420821eb5c1acc659377a7e2/charon81.red),
[Imprimis 4](https://github.com/n1LS/redcode-warriors/blob/615f2f3d75acfcb5420821eb5c1acc659377a7e2/imprimis4.red),
[Imprimis 6](https://github.com/n1LS/redcode-warriors/blob/615f2f3d75acfcb5420821eb5c1acc659377a7e2/imprimis6.red),
[Sphinx 2.8](https://github.com/n1LS/redcode-warriors/blob/615f2f3d75acfcb5420821eb5c1acc659377a7e2/sphinx28.red),
[Sphinx 5.1](https://github.com/n1LS/redcode-warriors/blob/615f2f3d75acfcb5420821eb5c1acc659377a7e2/sphinx51.red).

Two dating/lineage cautions matter here. Early Charon headers give creation as
`4/11/92`, while the 8.1 header gives `4/22/92`, also the date of the v2 overhaul.
Keep those claims separate; v8.1's version note explicitly gives `1/25/93`.
Agony's initial-version note says `4-7-92`; retain that literal date without
silently choosing a date convention. **Agony Killer** is attributed to John
Lewis and has a different program; its name is not evidence that it belongs in
Strack's Agony version chain.
[Agony Killer source](https://github.com/n1LS/redcode-warriors/blob/615f2f3d75acfcb5420821eb5c1acc659377a7e2/agonykiller.red),
[early Charon source](https://github.com/n1LS/redcode-warriors/blob/615f2f3d75acfcb5420821eb5c1acc659377a7e2/charon2.red).

## Compatibility and duplicate screening

These checks use our assembler and existing profile limits, with no source
rewriting. The 50-instruction column is a length filter on successful assembly.
It does not certify survival, portability of constants, historical dialect,
correct relocation, or competitiveness.

| Local profile | Assembles | Also fits 50 instructions |
|---|---:|---:|
| 88 | 563 | 425 |
| 94nop | 565 | 427 |
| lp | 563 | 426 |
| 94x | 454 | 372 |
| 94x-hill | 454 | 372 |

This collection is especially valuable for our compact '88 experiments. Passing
94x assembly does not convert an 8000-core design into a correctly tuned
55440-core design. Many explicit 8000-core assertions correctly prevent that.
`fail.red` has no assembled instructions; `stone.red` produces a local operand
parse error. Both originals are retained with diagnostics, not silently fixed.

There are no byte-identical file pairs within the snapshot. Removing comments
and whitespace exposes one lexical pair, `impy.red` / `impy3.red`. Under our
94nop profile, compiled instructions **and entry point** match for five pairs:

- `boring2.red` / `implance.red`
- `foggy_swamp.red` / `foggyswamp.red`
- `idle.red` / `useless.red`
- `imp.red` / `wow.red`
- `impy.red` / `impy3.red`

The manifest records these per profile. Identical assembly is not an authorship
claim; it is a reason not to count both as independent opponents. None has an
exact byte hash match in the existing local/curated-public/eight-source history
manifest used for this check. That does not exclude equivalent code, changed
headers, or overlap with other public collections.

## How this feeds Red Queen and the block catalog

The collection supplies candidate ancestors, strategy variants, and potential
opponents. Every source has lexical family hints and section/constant counts;
the full label regions, references and constants are in the reproducible local
`imported/history/n1ls/anatomy.json`. These are discovery aids, not approved blocks.

Before a selection enters evolution, review the family, eliminate equivalent
opponents, check the intended rules and length, and run behavioral tests for its
process schedule, relocation and transitions. Keep related versions together
when separating training and comparison opponents so we do not mistake success
against near-duplicates for generalization. Parameter tuning and Red Queen can
then use verified variants without changing the historical originals.

No battles were run for this ingestion, no generator choices were added, and
the existing Red Queen opponent history and default settings are unchanged.

## Reproduce the snapshot and index

From the worktree root in PowerShell, use an empty destination for extraction:

```powershell
$archiveDir = Join-Path (Get-Location) 'imported/history/n1ls'
New-Item -ItemType Directory -Force -Path $archiveDir | Out-Null
Invoke-WebRequest -Uri 'https://codeload.github.com/n1LS/redcode-warriors/zip/615f2f3d75acfcb5420821eb5c1acc659377a7e2' -OutFile (Join-Path $archiveDir 'snapshot.zip')
Invoke-WebRequest -Uri 'https://api.github.com/repos/n1LS/redcode-warriors/git/trees/0101c055147bc8e3633ca7bd05bed34776027abc?recursive=1' -OutFile (Join-Path $archiveDir 'tree.json')
Expand-Archive -LiteralPath (Join-Path $archiveDir 'snapshot.zip') -DestinationPath $archiveDir
node scripts/index-n1ls-history.js
```

The indexer is local and deterministic. It verifies the pinned snapshot before
writing any report, assembles Redcode as VM data only, and regenerates the
tracked index/manifest plus the ignored anatomy report. The summary and lineage
observations in this document are manually reviewed.
