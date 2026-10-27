# Unusual ICWS'88 experiments, under 50 instructions

These are original implementations for this library. Their building blocks
have historical precedents: the [Corewar lexicon](https://www.corewar.info/lexicon/)
already lists DJN streams, dodgers, slavers and self-repair, and the
[Art in '88 notes](https://corewars.org/docs/tips.html) discuss self-mutation.
No historical-first claim is established here. No archived warrior code was
copied into these candidates.

All five files compile with `--rules 88 --length 50` and survive an
800,000-cycle solo run. They remain outside the benchmark library.

| Warrior | Instructions | Different mechanism | Assessment |
| --- | ---: | --- | --- |
| [Riptide](riptide.red) | 20 | Corrupt B-fields at one instruction per ordinary scan step. A field becoming zero is both damage and a detection signal; switch to a pointer-bounded DAT sweep. | Competitive local candidate; redundant scan fuses protect against a lost marker. |
| [Telltale](telltale.red) | 42 | Inspect the word just damaged. An exact zero-data match selects SPL suppression before killing; other words select the faster DAT path. | In-round adaptation without P-space; both clears now check their pointers. |
| [Afterimage](afterimage.red) | 38 | Clear while watching a remote marker; move using bounded source/destination cursors, a checked landing point and a rebuilt prologue. | Pointer-hardened experimental version; weak overall. |
| [Levy](levy.red) | 18 | Lay fangs whose captured enemy processes execute a bounded clear on the enemy's turn budget. The original process continues placing fangs. | Mechanism works as a prototype, but current coverage and clearing latency score poorly. |
| [Undercurrent](undercurrent.red) | 11 | Repeated B-field corruption with two matching private end markers. No killing sweep. | Interesting attack primitive; tolerates either marker being lost. |

## Suicide hardening

The original examples already survived alone, but controlled combat faults
exposed real self-damage paths. The fixes are shared with the search generator
in `tools/experimental-88.js`:

- Afterimage no longer blindly copies the two-instruction prologue that it has
  stopped executing. It copies the tail, then rebuilds those two words from
  separate templates. Source and destination bounds are checked before each
  copied word; a source-cursor endpoint replaces the mutable copy counter, and
  the landing pointer is verified before launch. The forward sweep checks both
  ends of its safe interval before a two-word batch. These checks prevent the
  reproduced corrupted-cursor and copied-prologue failures.
- Riptide and Telltale have two B=1 end fuses. Losing either one no longer
  lets the stream proceed into the executable body. Pulse variants rearm both.
- Their clear phases now check pointer bounds before each unrolled batch,
  rather than trusting a mutable iteration counter. A pointer already inside
  the protected body exits the pass. Unrolling recovers clearing throughput.
- Undercurrent has a second tagged marker and rearms both markers on restart.
- Levy passed the full 8000-captured-process stress case unchanged. Its terminal
  DAT intentionally ends captive workers; replacing that with a survival loop
  would keep the opposing warrior alive too.

The 15 targeted regression tests cover a damaged copy prologue, corrupted copy
and sweep pointers, loss of either fuse, redirected freeze/kill pointers, a full captive queue, and long solo
survival. These are specific fault guarantees, not immunity to arbitrary enemy
rewrites: both fuses, templates or instructions themselves can still be hit,
and an enemy can change a pointer after a batch's check.

The matched audit freezes the original eight library opponents plus the five
original prototypes, with 12 rounds per opponent on each of seeds 880050 and
9753189: 312 rounds per entry. `suicide` below is the existing ownership-based
label, which also includes enemy-induced execution of our data or modified code.

| Warrior | Labelled suicides, original → hardened | Points/round, original → hardened |
| --- | ---: | ---: |
| Afterimage | 35 → 34 | 1.151 → 0.776 |
| Levy (unchanged) | 68 → 68 | 1.019 → 1.019 |
| Riptide | 10 → 5 | 1.760 → 1.753 |
| Telltale | 3 → 5 | 1.801 → 1.753 |
| Undercurrent | 4 → 5 | 1.340 → 1.353 |

The structural regression cases are fixed; the raw combat labels do not all
decrease. Afterimage's full pointer checks cost substantial performance in this field. The retained
settings prioritise the reproduced safety faults and remain experimental.
These audit scores include the prototype opponents and are a different field
from the historical nine-opponent results below.
All five remaining labels for Riptide and all five for Telltale followed
execution of enemy-written instructions. The audit records this separately as
`flaggedAfterEnemyExecution`; the underlying VM classification is unchanged.

```sh
node scripts/build-experimental-88.js
node --test test/experimental-88-safety.test.js
node scripts/audit-88-suicides.js --out evolved/suicide-audit/new --assert-solo
```

`parameters.json` records the checked versions. For a matched audit against
saved originals, add `--field-dir evolved/suicide-audit/before`. The final
checked audit is `evolved/suicide-audit/final-guards/audit.json`. Local before/
after records and rejected safety experiments are retained under
`evolved/suicide-audit/`; they are ignored by Git.

## Why the two leaders are interesting

Riptide uses `DJN stream, <base` as a damaging sensor. Empty B=0 cells become
7999, so the loop continues. A B=1 word becomes zero, causing execution to
fall through into the attack. That catches counters and ordinary imp movement
fields while also damaging unrelated pointers along the way. It does not
need a separate read/compare instruction for every scanned cell.

Telltale adds an observation at that event: did the resulting whole instruction
match `DAT #0, #0`? If so, it treats the contact as counter-like and performs a
stun pass. Otherwise it starts killing immediately. This is a heuristic, not
perfect opponent identification. Its own end fuses also take the data path
after a solo lap. The current version uses 42 instructions, including unrolled
bounded clears.

The main development opportunity is to improve this contact classification:
learn which damaged words predict a paper, scanner or stone, then choose a
response using the program counter and ordinary core cells. ICWS'88 forbids
P-space, but it still permits a warrior to observe and adapt within a round.

## Historical fresh-seed results (before hardening)

This section records the initial 12-instruction Riptide and 18-instruction
Telltale. It does not describe the current hardened files.

The field was the eight legal '88 library warriors plus the previously trained
17-instruction hybrid. Every warrior had the normal '88 settings, a
50-instruction entry limit, and an 80,000-cycle limit. Scores are average
points per round across those nine opponents, with wins/ties/losses worth
3/1/0.

After screening and finalist validation, a final check used five further
placement seeds and 50 rounds per opponent and seed:

| Warrior | Points/round | Gain over previous hybrid | Noise margin |
| --- | ---: | ---: | ---: |
| Previous trained hybrid | 1.762 | — | — |
| Riptide | 1.872 | +0.110 | 0.062 |
| Telltale | 1.888 | +0.126 | 0.078 |

Both gains exceeded the paired 2.5-standard-error screening guard. The small
score difference between Telltale and Riptide does not establish that one is
better than the other. These are local-library results; external hill
performance has not been measured.

An earlier independent five-seed check gave Riptide 1.903 versus the hybrid's
1.744. In that check Riptide beat the hybrid **242 wins to 8 losses** and Imp
Ring **246 to 4**, but lost to Mice **6 wins, 194 losses, 50 ties**. It has a
different matchup profile rather than uniform superiority.

A local 13-warrior round robin with 50 rounds per pair put Riptide third under
the existing iterative diversity push-off. Its nearest existing score vector
was Scout's, at a mean absolute difference of 0.751 points/round over the nine
reference opponents. This measures outcome diversity in this particular field,
not historical novelty or an external tournament rank. The round robin
predates Telltale and contains the other four prototypes.

## What did not work well

- Afterimage needs its marker on the side the enemy front arrives from. The
  retained positive-direction version scored 1.88 points/round against a
  backward two-pass clear over 100 rounds, but just 0.742 against the general
  nine-opponent field in a separate five-seed check. Repeated copying costs
  turns and leaves it vulnerable to papers.
- Levy's captive workers take time to produce useful damage. Wider fang
  carpets help coverage, while the shared clear pointer requires a protected
  region to reduce the risk of workers clearing the original body. Its
  checked general score was 0.859. It is not ready to replace the main entries.
- Undercurrent's pure corruption scored 1.438 in the same general check.
  Surviving processes and fresh paper copies can recover, which makes the
  absence of a finishing attack expensive.
- A post-mortem showed Riptide spending its remaining turns idling while Mice
  rebuilt after the first sweep. Repeated-sweep and repeated-pulse variants
  were screened. The checked original remains the saved Riptide candidate;
  the exploratory variants are retained in the local reports.

## Reproduce and extend

```sh
node cli/zorewars.js check examples/experimental-88/telltale.red --rules 88 --length 50 --json
node cli/zorewars.js hill examples/experimental-88/riptide.red --rules 88 --length 50 --rounds 50 --seed 123456 --json

# Mechanism-specific parameter search; every candidate is strictly '88.
node scripts/explore-88.js --families riptide,telltale --candidates 48 --seed 880050 --out evolved/new-88-experiment --threads 4

# Use the new architectures as seeds for the existing diverse evolver.
node cli/zorewars.js evolve examples/experimental-88/riptide.red examples/experimental-88/telltale.red --rules 88 --length 50 --genome 50 --algorithm map-elites --objective points --validate --seed 525288 --out evolved/novel-88-descendants
```

The search script supports `afterimage`, `levy`, `riptide`, `undercurrent` and
`telltale`. It samples each architecture's parameter grid reproducibly, rejects
solo deaths, screens against the nine references and a diagnostic clear, then
checks leading generalists and a control specialist on fresh placements. The
diagnostic clear is excluded from the validation score. Its per-family saved
winner uses the general validation score; specialist candidates remain in
`experiments.json` for separate investigation.

The saved Afterimage was selected specifically for its anti-clear results,
not as the strongest generalist. The other files retain their checked
per-family versions. Default script budgets can change the chosen parameters;
use the retained files to reproduce the reported versions.

Local reports, ignored by Git:

- `evolved/novel-88-final/experiments.json`: broad architecture screening.
- `evolved/novel-88-final/audit.json`: the first independent five-seed check.
- `evolved/novel-88-final/final-audit.json`: the final table above.
- `evolved/novel-88-final/round-robin.json`: the 13-warrior diversity check.
- `evolved/novel-88-final/riptide-mice-report.json`: per-round post-mortems.
- `evolved/undercurrent-88/`, `evolved/riptide-refined/` and
  `evolved/telltale-88/`: additional architecture and response experiments.
