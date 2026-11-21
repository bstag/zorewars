# pMARS compliance

ZoreWars is an independent implementation of ICWS'94 Redcode. pMARS is the reference simulator used by the Core War hills and tournaments, so we test ZoreWars against it directly: the same warriors go through both, and every difference is a bug.

## Latest results

pMARS v0.9.5 (03/01/2026), built from the Debian source package, tested on 24 October 2026 with `npm run compare`:

| Check | What is compared | Result |
| --- | --- | --- |
| Assembler | Every instruction (opcode, modifier, modes, fields) and the start address, against pMARS's listing | **53 / 53** warriors identical |
| Single rounds | Who wins (or ties) a round at a fixed position (`pmars -F`), for every pair of warriors | **2,550 / 2,550** rounds identical |
| 2-warrior matches | Win and tie totals of 20-round matches: random placement, rotating first mover, P-space between rounds | **100 / 100** matches identical |
| P-space | 30-round matches between warriors whose strategy depends on P-space (`test/fixtures`) | **42 / 42** matches identical |

Games with three or more warriors use ZoreWars' own placement (see below). They aren't compared with pMARS, because pMARS can't be given fixed positions for more than two warriors. An earlier version that copied pMARS's placement matched 40 of 40 such matches. That confirms the scoring formula and the rescaled cycle limit, which haven't changed since.

The warriors are the ZoreWars library, two P-space test warriors, and 34 Hall of Fame originals from 1984 to 2026, fetched from the public archives when the test runs. They include `FOR`/`ROF` loops, pMARS registers, P-space, imp spirals, silk papers, quickscans and vampires.

**Hill archive.** The 567 warriors of the public hill collection [n1LS/redcode-warriors](https://github.com/n1LS/redcode-warriors) (fetched for the test, not stored here) were assembled by both on 25 October 2026: **564 identical**, 2 rejected by both (one empty file, one missing a comma between operands), and 1 different (below). This found two gaps, now fixed: a label on the `END` line (`last end start`) is the address just past the last instruction, and an `EQU` can stand for a whole instruction (`d01 equ spl 0,1`, then `d01` on its own line), as pMARS's EQU is text substitution. A re-run of `npm run compare` after the fix: 64/64 assembled, 1,891/1,891 rounds, 30/30 matches and 42/42 P-space matches identical.

**corewar.dev collections.** The 703 public warriors from corewar.dev's `warriors_public` (fetched for the test, not stored here) were assembled by both on 26 October 2026, each collection under its own hill's rules: the Koenigstuhl top 50s (94nop, '88 with `-8`, P-space), the low-process and X hills, and the Wilkies, Wilfiz, White Army, Moore '88, tiny (800 cells) and nano (80 cells) benchmarks. **All 703 are identical.** Before, 676 were: this found five gaps in how we read pMARS's preprocessor, now fixed:
- **EQU is text.** An EQU is written into an expression as text, as pMARS does, so `step equ 7/2` makes `2*step` 7 (not 6) and `-gate` with `gate equ src-step` is `-src-step`. An EQU chain ending in a mode (`win equ lose+1`, `lose equ #2256`) gives the operand that mode.
- **EQUs in FOR loops.** An EQU that uses a loop's counter (`Lookat equ look+8*(qscan-1)`) or pastes it (`length equ (data&i-pap&i+1)`) takes the counter's value in each copy.
- **Multi-line EQU.** `name EQU line` followed by lines of `EQU line` is a macro; the name alone expands to those lines.
- **FOR counts** may use labels defined earlier (`for bomb-bomber+1`), and `CURLINE` now counts lines written `label:opcode` with no space.
- **Registers and trailing labels.** pMARS's registers `a`-`z` (either case) read 0 until set, so `mov f, 0` assembles (with a warning). A label on its own line just before `END` is the address past the last instruction; with no `END`, pMARS discards it, and so do we.

After the fixes the other checks were re-run and still agree: `npm run compare` (70/70 assembled, 4,422/4,422 single rounds, 100/100 matches, 42/42 P-space matches), the hill archive (564 identical, the same 1 different and 2 rejected by both), and the '88 accept/reject check below. `test/fixtures/pmars-preprocessor.red` holds one example of each construct, checked against pMARS.

**Clean-room preprocessor corpus.** A separate agent read pMARS's assembler and wrote a behaviour specification with no code ([docs/clean-room/pmars-preprocessor-behaviour.md](docs/clean-room/pmars-preprocessor-behaviour.md)), plus 81 original probe programs whose outputs it captured from a pMARS 0.9.5 build ([test/pmars-clean-room/](test/pmars-clean-room/)). ZoreWars was then changed from the specification and the probes alone, without the source; `test/pmars-clean-room.test.js` runs every probe. Of the 81, 62 matched at first; now 79 do, and the other 2 are deliberate:
- **Asserts** run where they stand during expansion, once per loop copy, with labels counted from there, and can set registers. A false `;assert` rejects the warrior under the hill rule sets (`--rules`, the arena's Hill rules), as in pMARS. Elsewhere it is a warning, so ring warriors can still play on planes and volumes.
- **Registers** set while expanding (in FOR counts and asserts) carry into the operands, which are evaluated after all expansion.
- **Duplicate labels:** a line that defines a label again is left out, with a warning (so a loop body with a fixed label emits it once).
- **Start:** ORG wins unless it is 0, then END's; `CURLINE` in ORG or END is the position there.
- **Input:** a trailing backslash joins lines (without a comment on the line); a second `;redcode` line ends the program.
- **EQU edge cases:** a comment may sit between multi-line EQU lines; defining an EQU twice is an error; an unnamed EQU is a warning.
- **Unclosed FOR:** with a positive count, the rest of the program is used once, with a warning.
- **Names:** `CURLINE` is uppercase only; `VERSION` is 95; `WARRIORS` is the number of warriors in the battle (1 when assembling one alone).
- **Deliberately different:** an empty program (`blank`, and `for-unclosed-zero`, where `FOR 0` swallows everything) is rejected. pMARS assembles it but can't run it; a ZoreWars warrior needs an instruction to play.

Afterwards everything was re-run: the 703 corewar.dev warriors (all identical), `npm run compare` (70/70 assembled, 4,422/4,422 rounds, 100/100 matches, 72/72 P-space matches), the hill archive (564 identical, unchanged), and the '88 check (729/729). 

**Differential fuzzing.** `scripts/fuzz-pmars.js` then generated random programs and mutations of the probes, assembled each with the pMARS executable and with ZoreWars, and shrank every disagreement to a minimal program. Each rule found this way was captured from the executable as a new probe (138 `fuzz-*` programs, 219 probes in all) and written into the specification's "Findings from differential fuzzing" section, still without reading the source. Recorded campaigns are in `test/pmars-clean-room/campaigns/`. Runs of 3,000 programs now find 0 to 1 disagreements each. pMARS crashes, timeouts and contradictory results are counted apart and never treated as language rules, and 32-bit overflow is platform-dependent and left out.

**ICWS'88 checks.** `--rules 88` checks syntax the way `pmars -8` does. Every opcode and pair of modes was tried against pMARS to build the table (11 opcodes, `# $ @ <` only, no modifiers, no `ORG`, `DAT` operands `#` or `<`, no immediate B-operand for MOV/ADD/SUB/CMP or A-operand for the jumps and SPL). Accept/reject agrees with `pmars -8` on all **1,275** files tried: the 683 warriors of the Koenigstuhl '88 hill, the 567 of the hill archive, and our 25 Redcode warriors.

As a sanity check that the P-space test can catch bugs, it was run against a deliberately broken engine that forgets round results. 21 of 39 matches then differed.

## Run it yourself

1. Build pMARS. On Linux or macOS, unpack the source and run `make` (remove `-DXWINGRAPHX` from `CFLAGS` if you have no X11). On Windows without a compiler, the portable [Zig](https://ziglang.org/download/) toolchain works:

   ```bash
   zig cc -O2 -w -DEXT94 -DPERMUTATE -DRWLIMIT -DSERVER pmars.c asm.c eval.c disasm.c cdb.c sim.c pos.c clparse.c global.c token.c str_eng.c -o pmars.exe
   ```

   Sources: the [official pMARS page](https://corewar.co.uk/pmars.htm) or the [Debian source package](https://sources.debian.org/src/pmars/0.9.5-1/).

2. Run the comparison:

   ```bash
   npm run compare -- --pmars path/to/pmars
   npm run compare -- --pmars path/to/pmars --quick --only asm,match
   ```

   It exits with status 1 and lists the first differences if anything disagrees.

## Benchmark the WebAssembly engine

The browser's CPU match worker uses WebAssembly for eligible two-warrior matches, including match diagnostics and solo species checks. The live arena's CPU path also uses WebAssembly for supported rounds, including play, stepping, and replay. If the browser cannot load the module, it falls back to JavaScript. Use `--wasm` for CLI battles, including solo and multi-warrior rounds, round-robin tournaments, traces, and battle reports. Both ring and 2D and 3D torus battlefields are supported. To rebuild the bundled module, install the Rust WebAssembly target.

```bash
rustup target add wasm32-unknown-unknown
npm run build:wasm
node cli/zorewars.js battle "@silk" "@seeker" --rules 94nop --rounds 200 --wasm
npm run bench:wasm -- 400 /path/to/pmars
```

The benchmark compares warmed JavaScript and Wasm runs at identical placements and checks every round result. The optional native pMARS comparison checks the win and tie totals and measures CLI wall time, including process startup and assembly.

On a Ryzen 5 7600 with Node 22.22.3 and an optimized x64 pMARS 0.9.6 server build, Wasm ran the three 400-round pairings 3.1–3.4× as fast as the packed JavaScript engine and took 9–18% longer than the native CLI. All 1,200 Wasm round results matched JavaScript, and pMARS agreed on every pairing's win and tie totals.

The CLI also accepts `--wasm` on `species`, `hill`, `tune`, `evolve`, `train`, `refine`, and `pushoff`. The packed Rust interpreter tracks hill loss symptoms on rings and tori, including when a match is run in slices. The Rust engine supports private P-space across rounds. The assembler still warns on `PIN` and gives each warrior private P-space.

```bash
node cli/zorewars.js hill "@silk" --rules 94nop --threads 4 --rounds 100 --seed 42 --json
node cli/zorewars.js hill "@silk" --rules 94nop --threads 4 --rounds 100 --seed 42 --json --wasm
```

On the same machine, the two commands produced identical JSON for 24 opponents and 2,400 rounds. Median CLI wall time over five measured runs was 7.77 s with JavaScript and 1.05 s with Wasm.

The Wasm engine matched native pMARS 0.9.6 on all 252 30-round matchups in the local P-space comparison.

```bash
npm run compare -- --pmars /path/to/pmars --only pspace --wasm
```

## Run the native Rust engine

Build the Node addon with `npm run build:native` and select it with `--native` on the CLI commands that accept `--wasm`. The addon uses the same Rust interpreter and packed-state interface as WebAssembly. The browser continues to load the Wasm build. The local native addon is built for the host and lives in `tools/build/`.

On Windows, the build uses the architecture-matched `node.lib` from the Node SDK. Obtain it with `node-gyp install`, or point `ZOREWARS_NODE_LIB` at an existing copy.

```bash
npm run build:native
node cli/zorewars.js battle "@silk" "@seeker" --rules 94nop --rounds 200 --native
npm run compare -- --pmars /path/to/pmars --only pspace --native
npm run bench:wasm -- 200 /path/to/pmars --native
```

The native addon matched pMARS 0.9.6 on all 252 local P-space matchups. CLI comparisons also matched JavaScript and Wasm for ring and torus battles, traces, hill runs, and tournaments. In a 200-round run of the three ring benchmark pairings, the native addon was 2.7–3.3× as fast as packed JavaScript and took 2–10% longer than Wasm and 7–20% longer than pMARS.

Both Rust builds also matched pMARS in 561 single rounds with fixed placements and 30 seeded 20-round matches against the local library.

```bash
npm run compare -- --pmars /path/to/pmars --local --quick --only round,match --wasm
npm run compare -- --pmars /path/to/pmars --local --quick --only round,match --native
```

The torus fuzzer compares core cells and process positions and headings against the independent reference interpreter. On seed 144, each Rust build passed 1,000 generated matchups and 54,793 step comparisons across four shapes.

The native addon was verified on Windows x64 and Linux x64. The Linux run used Debian Bookworm with Node 22 and passed the ring, torus, and match-backend tests, including P-space on one-cell and two-cell cores. On seed 219, both Rust builds passed another 1,000 generated torus matchups and 58,575 step comparisons.

The packed backends preserve large cycle budgets and counters on resumed rounds, wrap signed load positions, and accept command-line torus sizes above the browser arena's cell limit where the packed buffers fit. They allocate process slots based on how many processes the round budget can create and store only P-space cells that Redcode can address. Wide cores reset in place. Packed buffers are capped at 2 GiB for Wasm and 4 GiB for the native addon, subject to available memory. For explicitly placed games, P-space preserves the raw survivor count even when overlapping starts allow more warriors than cells.

Live execution can hand a confirmed GPU snapshot back to Wasm, preserving process queues, P-space, trace history and the final report. The opt-in WebGPU suite verifies that transition on a torus. Trace replay checks the actual compiled opcodes when deciding whether prior rounds are needed to reconstruct P-space. Assembler restrictions continue to apply to source input.

Rust advances up to 128 instructions per call when collecting execution history. JavaScript applies the recorded writes, process changes and P-space stores in order to produce the same traces and reports. Single-step advances one instruction. Rebuild both Rust artifacts after changes to the shared history layout. Benchmark the history path with `npm run bench:wasm -- --history --native`.

Live playback without an instruction trace uses Rust's scheduler state at each batch boundary. JavaScript applies the forensic changes in order for the inspector and recorded replay. To measure the score-only interpreter on a preloaded core, run `npm run bench:wasm -- 250 --kernel --native`. Its timing includes the call boundary and excludes loading, core reset, and scoring.

`node scripts/check-browser-gpu.js` checks the arena in Chrome, including Wasm match diagnostics and solo results against JavaScript on a ring and a torus. It also exercises live stepping, replay, GPU readback failure, and automatic Wasm fallback with WebGPU disabled.

```bash
node scripts/plane-fuzz.js 1000 400 144 --wasm
node scripts/plane-fuzz.js 1000 400 144 --native
```

## Using pMARS command lines

The CLI accepts pMARS's short options and reproduces pMARS's placement and random number generator, so a pMARS match can be replayed exactly:

```bash
pmars              -r 50 -s 8000 -p 8000 -c 80000 -l 25 -d 100 -F 3000 silk.red seeker.red
zorewars battle    -r 50 -s 8000 -p 8000 -c 80000 -l 25 -d 100 -F 3000 silk.red seeker.red
```

Both report Silk 19 wins, 0 losses, 31 ties (88 points) and Seeker 31 points. The Core War Tournament Weekend 2024 '94 event used `pmars -s 8000 -p 8000 -c 80000 -l 25 -d 100`. Note that `-p` is the process limit, not the P-space size, which is `-S`.

### Exchanging match scores

Capture the standard output of each two-warrior pMARS match. Import
accepts either the two lines from `-b -k` or regular output ending in
`Results: <first wins> <second wins> <ties>`. Keep the warrior order
from the pMARS command line and give each pair its own file.

```sh
pmars -b -k -r 50 -F 3000 silk.red seeker.red > silk-seeker.txt
```

Create a manifest next to the score files. Each match uses zero-based
indices into `warriors`. Paths are relative to the manifest directory.
Give one result per distinct pair. Self-fights are optional, and the
optional `rounds` field checks that each match ran the specified number
of rounds.

```json
{
  "format": "pmars",
  "warriors": [{ "name": "Silk", "entry": true }, { "name": "Seeker" }],
  "rounds": 50,
  "matches": [{ "a": 0, "b": 1, "file": "silk-seeker.txt" }]
}
```

```sh
node cli/zorewars.js pushoff --load manifest.json --save scores.json
node cli/zorewars.js pushoff --load scores.json --export-pmars pmars-matches
```

Import rebuilds the win/loss/tie and points-per-round matrices, then
prints the push-off ranking. Export writes the two `wins ties` lines
for each pair and a reusable `manifest.json` into a new directory.
Export requires saved win/loss/tie counts.

### Koenigstuhl binary tables

`pushoff --load` also accepts a `.dat` or `.scores` path and reads
its matching sibling file. The metadata has four lines per warrior
after the count. The binary matrix stores the column warrior's score
against the row warrior as a little-endian 32-bit integer. Its
0–300 normalized scores are multiplied by 10,000, giving a factor of
1,000,000 relative to our 0–3 points per round.
[Metcalf's format specification](https://corewar.co.uk/metcalf/koenformat.txt)

```sh
node cli/zorewars.js pushoff --load hill32.dat --save scores.json
node cli/zorewars.js pushoff --load scores.json --export-koenigstuhl exported-hill
node cli/zorewars.js pushoff --load hill32.dat --remove-pspace --export-koenigstuhl filtered-hill
```

`--remove-pspace` removes entries whose metadata format is
`P-Space`, together with the corresponding rows and columns, following
the published Ruby helper. It preserves the order of retained warriors.
[P-space removal script](https://corewar.co.uk/metcalf/removepspace.rb)

Binary tables contain normalized scores. Win/loss/tie counts and match
seeds must come from separate records. Export preserves available
author, source filename and format labels. Missing filenames use
`warrior-N.red`, and missing format labels default to `94`, or
`88` when the saved settings specify that dialect. Export rounds to
the binary format's precision of 0.0001 normalized points and writes
the pair of files into a new directory.

## What the audit changed

The pMARS simulator (`sim.c`), assembler (`asm.c`), placement (`pos.c`) and option defaults (`clparse.c`) were read line by line against our engine. The instruction semantics already matched: every opcode and modifier, all eight addressing modes, division by zero inside `.F` and `.X`, `DJN` testing the value before the decrement, `SEQ.I`, `SLT`, `SPL`'s process limit, and P-space `LDP`/`STP`. These differences were found and fixed:

| Area | Before | Now (as pMARS) |
| --- | --- | --- |
| Post-increment | Applied before the operand's instruction was read | Read first, then incremented (ICWS'94) |
| Placement (2 warriors) | Our own random distribution | The Park-Miller RNG and the standard placement rule, with `-F`: identical to pMARS |
| Placement (3+ warriors) | Our own random distribution | Still our own (`src/engine/topology.js`); it does not reproduce pMARS |
| Score | 3 per win, 1 per tie | `(W*W-1)/S` per survivor: the same with 2 warriors, 8/4/2 with 3 |
| Cycle limit with 3+ warriors | Counted full laps | pMARS's step budget, rescaled when a warrior dies |
| P-space default size | `CORESIZE/16`, rounded down | `CORESIZE` divided by its largest divisor up to 16 |
| Labels after the last instruction | Pointed one past the end | Discarded with a warning |
| Single operand | Allowed for any opcode | Only `DAT`, `JMP`, `SPL` and `NOP` |
| Missing features | `FOR`/`ROF`, P-space, registers, `;assert` | Implemented (needed by 15 of the 35 originals) |

## The plane and 3D (torus battlefields)

pMARS has no torus battlefield, so the experimental plane (`--torus`) is checked two other ways:

| Check | What is compared | Result |
| --- | --- | --- |
| Ring identity | A torus one row high (8000×1) against the classic ring: the library and the 34 Hall of Fame originals, every pair, 4 rounds each | **7,080 / 7,080** rounds identical (winner, cycle, survivors, positions) |
| Reference interpreter | `scripts/plane-reference.js`, a second interpreter written from the rules with cells kept by (x, y, z) and its number/point mapping built by enumeration, against the VM on random programs, on 100×80, 125×64, 20×20×20 and 7×3×5 | **5,000** programs, **581,477** steps: every cell and every process (position and heading) identical after every step |

Run them with `npm run fuzz` (the reference comparison; arguments: programs, steps, seed) and `npm test` (smaller versions of both). As a check that the comparison can catch bugs, three mistakes were planted in a copy of the reference interpreter (per-axis counting, a different TRN tie-break, DIV zeroing an axis); each was caught within 100 programs.

## Known differences

- **Read/write limits** (pMARS `-R`/`-W`) are not implemented. Without them pMARS uses the whole core, as we do.
- **`PIN`** (shared P-space between warriors) is ignored with a warning; each warrior gets private P-space.
- **ICWS'88 mode** (`pmars -8`) is not enforced. We assemble '88 warriors with '94 rules, as pMARS does without `-8`, but we don't reject '94-only features. Check '88 tournament entries with real pMARS.
- **`;assert`**: a false assertion is a warning in ZoreWars (the arena offers to switch rules); pMARS refuses to run the warrior.
- **Placement with 3 or more warriors** is ZoreWars' own: every start is at least the minimum distance from every other, measured round the ring. The same warriors and seed give different positions than pMARS, so 3+ warrior matches can't be replayed in pMARS.
- **More than 4 warriors** are not supported in the arena; the engine and CLI have no limit.
- **`dat#9` with no space** after the opcode: pMARS reads it as `DAT #0, #90` (one hill warrior, Asian Flu, has this line); ZoreWars reads `DAT #0, #9`. This looks like a pMARS tokenizer quirk on malformed input, and isn't copied.
- **pMARS's alternative RNG** (`-F` with a non-numeric argument, RC5-based) and permutation mode (`-P`) are not reproduced.

## Licensing note

ZoreWars contains no pMARS code and no code derived from it. pMARS (GPL-2.0-or-later) was used only as a reference to compare behaviour against, and the comparison script runs it as a separate program. Compatibility rests on the ICWS'94 draft standard, the published Park-Miller generator (Park and Miller, Communications of the ACM 31:10, 1988), and pMARS's documented options and observable behaviour. An earlier version re-implemented pMARS's multi-warrior placement routine; it was removed in favour of ZoreWars' own placement so the project could be licensed under Apache-2.0.
