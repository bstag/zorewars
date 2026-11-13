# Reproduce the Koenigstuhl source census

The November 2026 census paired ten public Koenigstuhl ranking listings with the files they link. The [saved results](hill-archive-census.json) include the hash of each listing and a digest of the ordered source filenames and SHA-256 hashes. This measures the field available on retrieval. SAL's challenge records supply the separate historical observations. [Koenigstuhl inventory and settings](https://asdflkj.net/COREWAR/koenigstuhl.html) · [SAL snapshot survey](sal-hill-evolution.md)

## Prepare the inputs

Each field needs a ranking HTML file named after its key and a directory of the same name containing the unpacked source folder, usually `HILL32`. Keep the original files on disk for later comparison. The script reads the Redcode as text and assembles it locally.

| Key | Directory under the [archive root](https://asdflkj.net/COREWAR/) | Ranking | Source archive |
| --- | --- | --- | --- |
| `88` | `88` | `hill32_rec.html` | `88.tar.gz` |
| `94nop` | `94` | `hill32_rec.html` | `94.tar.gz` |
| `pspace` | `PSPACE` | `hill32_rec.html` | Individual links in the ranking |
| `icws64` | `ICWS64` | `hill32_rec.html` | `icws64.tar.gz`, extracts to `HILL` |
| `icws` | `ICWS` | `hill32_rec.html` | `icws.tar.gz` |
| `lp` | `LP` | `hill32_rec.html` | `lp.tar.gz` |
| `94x` | `X` | `hill32_rec.html` | `x.tar.gz` |
| `tiny` | `TINY` | `hill32_rec.html` | `tiny.tar.gz` |
| `nano` | `NANO` | `hill32_rec.html` | `nano.tar.gz` |
| `odd` | `ODD` | `hill32.html` | `odd.tar.gz` |

The P-space bulk archive returned 404 during the survey. All 206 individual linked sources downloaded successfully. Save them under `pspace/HILL32/` when reproducing the complete census.

For example, run this from the ZoreWars checkout to reproduce just Nano. Create `hill-snapshot/nano` first.

```sh
curl -fLsS https://asdflkj.net/COREWAR/NANO/hill32_rec.html -o hill-snapshot/nano.html
curl -fLsS https://asdflkj.net/COREWAR/NANO/nano.tar.gz -o hill-snapshot/nano.tar.gz
tar -xzf hill-snapshot/nano.tar.gz -C hill-snapshot/nano
node scripts/hill-archive-census.js hill-snapshot nano
```

Omit the last argument to audit all ten prepared fields. Redirect standard output to save a new JSON snapshot. A new archive retrieval may have a different digest or result.

## Interpret the counts

- Each ranked row contributes once. `matched` counts distinct local source files used by that ranking. The Odd table includes a repeated source link. Files with names beginning with a dot, such as AppleDouble metadata, are skipped.
- Assembly uses the displayed profile with strict assertions. Odd uses its broad comparison profile. Its sources may assert other settings because they were written for different competitions. Missing sources and assembler errors are counted separately, with examples of each in the saved results.
- `top50` refers to the first 50 rank positions of the retrieved table. The feature counts and median lengths use assembled rows only. The comparison count indicates the presence of an assembled `SEQ`, `SNE`, or `CMP`. It does not classify an entry as a scanner.
- The decade grouping uses a single unambiguous four-digit year from a `;date` header. A date in a source header is evidence about the source's declared date. It does not establish when it reached a given rank. Most entries were undated by this method, which is why the census uses rank bands for cross-sectional comparisons.

For source-level explanations of the feature differences, see the [block review](hill-block-review.md) and [compact hill workshop](compact-hill-workshop.md).
