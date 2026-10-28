# Planar archive: historical sources and component breakdowns

Added October 28, 2026 from Damien Doligez's Core War archive. The user supplied
the historical `moscova.inria.fr/~doligez/corewar/` address. That address timed
out; the [archive at gallium.inria.fr](https://gallium.inria.fr/~doligez/corewar/)
was reachable. This extends the selected Planar specimens already used in our
family history to the full name/date indexes and their component breakdowns.

- [Browse by component](planar-components.md): all 14 types, counts, and mappings to our existing block catalog.
- [Browse by release date](planar-warrior-index.md): all index entries, authors, component tags, and local assembly compatibility.
- [Full manifest](planar-warrior-history.json): preserved dates, original-post references, hashes, category membership, overlap, and diagnostics.

Follow-up: [the other-category review](planar-other-review.md) examines unusual
mechanisms, surveys all 305 sources in that category, and records a compact
behavioral screen separately from the ingestion described below.

## What was preserved

The name and date indexes each contain **1,686 entries**, pointing to **1,683
distinct source URLs**. All 1,683 source files were downloaded. Their recorded
release dates span **1984–2002**. We also cached all 14 component pages and
**852 of 853 linked text references**: author posts and newsletter texts.
The linked `post/SwitchBlade.txt` returns HTTP 404; its failure is recorded and
the warrior's separate assembly source is available.

The homepage advertises 1,689 warriors. We retain that claim separately from
the counts actually present in both indexes. Four differently named entries
point to the same `Phoenix1.1.txt`: Phoenix 1.1, Big Silk Warrior 1.0, Big Phoenix
1.0, and TimeScapeX (0.1). Their original combined post is retained; the manifest
flags their shared source identity rather than assuming that one downloaded
program implements all four versions. Such entries require identity review
before use as distinct opponents or ancestors.

Source bytes and SHA-256 hashes are preserved in ignored
`imported/history/planar/`. Hash-based cache filenames avoid Windows conflicts
between source names with different case or punctuation. The tracked manifest
contains an exact receipt for each successful fetch. Text is decoded as UTF-8
when valid, otherwise Windows-1252; hashes always cover original bytes.
Downloads are never run as host programs, and author posts are never assembled
as if they were standalone warriors.

This is an indexed source collection, not a complete site mirror: binary
tournament bundles, PostScript publications, external references, and Olympus
data were not downloaded. Their provenance links remain in the manifest. The
old bulk FTP archive was unavailable through the checked HTTPS endpoint.

## Why the type pages matter

The maintainer's [component index](https://gallium.inria.fr/~doligez/corewar/by-types/idx.htm)
classifies techniques that can coexist inside a warrior. A stone with boot,
stun, clear, and gate tags is a useful composition example, not five independent
warriors. We checked every type page against the tags in the name/date listing:
**all 14 memberships agree** after deduplicating source URLs.

| Component | Distinct source URLs | Meaning for our block work |
|---|---:|---|
| stone | 630 | Bombing patterns; relate to our bounded bomber and stone recipes. |
| paper | 315 | Copying and reproduction; preserve initialization and process scheduling. |
| vamp | 147 | Capture through jump bombs; fang and pit offsets must remain linked. |
| stun | 636 | Slow enemy processes; distinguish bomb placement from locally executing SPL. |
| imp | 344 | Imp movement and launchers; core arithmetic and queue order are coupled. |
| clear | 867 | Sequential wiping; pointer handoff and self-exclusion need explicit tests. |
| scan | 576 | Target detection; distinguish comparisons, B-scans, and one-shot transitions. |
| pspace | 182 | Persistent controllers, brainwashing, or handshakes; inspect the actual role. |
| boot | 408 | Relocation, often with decoys; copying alone is only part of that behavior. |
| gate | 372 | Anti-imp defenses; location and service frequency matter. |
| quick | 136 | Unrolled early scans or bombing runs; decoding tables cannot be tuned independently. |
| factor | 5 | Factorization tournament tasks; keep separate from battle opponents. |
| sort | 19 | Sorting tournament tasks; keep separate from battle opponents. |
| other | 305 | Unclassified mechanisms requiring individual review. |

Counts overlap. Tags are the maintainer's judgments, not verified instruction
boundaries, code lineage, or ruleset declarations. The crosswalk identifies
which of **our** blocks are selectable today and which are only design
candidates; it does not promote archive fragments into the generator. In
particular, the existing `relocate-copy` block does not imply decoy generation,
and `quickscan` covers only part of the archive's broader quick category.

The 24 factor/sort entries are explicitly marked as special-purpose tasks.
No actual training pool is changed by the importer.

## Dates, versions, and primary evidence

The archive explains that its source copies may have been adjusted for pMARS,
including reconstructed decoys and some boot distances. Original-post links
must therefore stay separate from the assembly-copy links. Release dates are
the maintainer's best knowledge, not independently established invention dates.
There are **22 uncertain dates** and **103 year- or month-only dates**. Literal
question marks and precision are retained rather than inventing a day.
[Maintainer's explanation](https://gallium.inria.fr/~doligez/corewar/).

Several retrieved posts connect directly to our current work:

- **Airbag Demo, November 11, 2001:** David Moore explains a process-scheduled
  damage response and gives an explicit DAT fault-injection procedure. This is
  a valuable historical comparison for our Lifeboat watchdog and fault tests;
  it does not establish that the implementations are equivalent.
  [Original post](https://gallium.inria.fr/~doligez/corewar/post/AirbagDemo.txt).
- **airbag frenzy, November 25, 2001:** Joonas Pihlaja discusses a modification
  to Lukasz Grabun's bomber and reports a small improvement that still leaves
  stone/imp weaknesses. That supports testing fallback overhead and matchup
  changes separately. Those are the author's historical results, not ours.
  [Original post](https://gallium.inria.fr/~doligez/corewar/post/airbagfrenzy.txt).
- **Fire and Ice II, November 27, 2001:** David Moore describes its large-core
  stone and scanner strategies and the persistent selector between them. This
  supplies dated design context for the public reference in our Lifeboat
  experiment, without asserting that all archived versions have identical code.
  [Original post](https://gallium.inria.fr/~doligez/corewar/post/FireandIceII.txt).
- **Warrior #638 / Generation #52:** the archive index says March 6, 1997; the
  post's Date header says March 7. It describes an evolved program, scanner
  weaknesses and survival behavior. Its `redcode-94x` header accompanies an
  explicit **800-cell** assertion. It must not be assigned our modern
  55,440-cell profile merely from that header.
  [Original post](https://gallium.inria.fr/~doligez/corewar/post/Evolution-warriors-3.txt).
- **Evolver 4870 x 200, September 19, 2000:** Martin Ankerl's YACE post describes
  evolution from a random soup and reports opponent-by-opponent tiny-hill
  results. It is evidence of historical evolutionary search, not proof of a
  Red Queen algorithm or competitiveness under our rules.
  [Original post](https://gallium.inria.fr/~doligez/corewar/post/Evolver4870x200.txt).

The complete reference texts were cached; only the observations above were
manually reviewed here. Other posts remain a research corpus, not completed
lineage analysis.

## Compatibility and overlap with the n1LS collection

All assembly checks use unmodified downloaded sources and our local profiles.
Counts below are **unique source URLs**, not repeated index entries. They
include special-purpose programs; successful assembly is not admission to a
battle pool or proof of survival, correct behavior, or historical compatibility.

| Local profile | Assembles | Also fits 50 instructions |
|---|---:|---:|
| 88 | 496 | 364 |
| 94nop | 1288 | 801 |
| lp | 1289 | 801 |
| 94x | 1011 | 664 |
| 94x-hill | 1115 | 696 |

The archive warns that experimental-hill settings changed over time. Explicit
core/process assumptions and post descriptions therefore take precedence over
old suffixes such as `-x`. Passing our assembler does not repair old-core stride
choices or replace pMARS verification.

**30 sources** match n1LS files byte-for-byte. **399 sources** have at least one
identical n1LS assembly under 94nop, including the same entry point. These are
source-overlap counts, not 399 distinct strategy families; equivalent programs
can have different headers and filenames. Full mappings are retained per
profile so future benchmark construction can avoid weighting the same design
more than once.

## Reproduce and validate

```text
node scripts/import-planar-history.js --download
node scripts/import-planar-history.js
```

The first command downloads missing resources with four concurrent requests
and records failures. Existing verified cache entries are reused; it does not
silently refresh a saved snapshot. The second works offline from the cache and
regenerates the manifest, date index, component crosswalk and local anatomy
report. A cached byte mismatch stops the run before it writes new reports.
The raw index hashes in the manifest identify the exact pages parsed.

Both commands currently exit with status 1 **after writing the reports** because
the SwitchBlade original-post URL is missing. This preserves visibility of the
known incomplete reference; there are no missing warrior sources or component
pages. No evolution runs or battles were performed for this ingestion.
