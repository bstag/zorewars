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

## Using pMARS command lines

The CLI accepts pMARS's short options and reproduces pMARS's placement and random number generator, so a pMARS match can be replayed exactly:

```bash
pmars              -r 50 -s 8000 -p 8000 -c 80000 -l 25 -d 100 -F 3000 silk.red seeker.red
zorewars battle    -r 50 -s 8000 -p 8000 -c 80000 -l 25 -d 100 -F 3000 silk.red seeker.red
```

Both report Silk 19 wins, 0 losses, 31 ties (88 points) and Seeker 31 points. The Core War Tournament Weekend 2024 '94 event used `pmars -s 8000 -p 8000 -c 80000 -l 25 -d 100`. Note that `-p` is the process limit, not the P-space size, which is `-S`.

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
