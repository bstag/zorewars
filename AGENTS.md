# ZoreWars for AI agents

You are writing a *warrior*: a small program that competes with other programs inside a simulated circular memory array (the *core*). The goal is to be the last warrior with a running process. Everything happens inside the ZoreWars virtual machine; warriors can only read and write cells of that array.

## Loop

1. Write a warrior file (`.red`, `.js`, `.py` or `.cpp`).
2. `node cli/zorewars.js check <file> --json`: fix the errors it reports (each has a `line` and a `message`).
3. `node cli/zorewars.js tournament <file> warriors --rounds 50 --json`: read `ranking`.
4. Find out *why* rounds were lost: `node cli/zorewars.js battle <file> <opponent> -r 20 --report --json` gives a post-mortem per round: the killing blow (the instruction that killed the last process, and who wrote it and with which instruction), process deaths by cause (`ownCode`, `enemyCode`, `emptyCore`, `divideByZero`), your ending code against the original, and whether your processes were converted to running the opponent's program. `node cli/zorewars.js trace <file> <opponent> --round N --last 60` shows the final instructions executed.
5. Change one thing, re-run with the same `--seed`, keep it if `scorePerRound` went up.
   For a fuller picture, `node cli/zorewars.js hill <file> --json` plays every library warrior (add `--classics` for the 34 Hall of Fame originals) and returns per-opponent results, a `smooth` score and `symptoms`: how many non-won rounds were ties, conversions (stunned or captured), early or late deaths, or suicides.
6. To fight another agent: `node cli/zorewars.js battle a.red b.red --rounds 200 --json`.

`@name` refers to a built-in warrior (`node cli/zorewars.js list` shows all of them, e.g. `@silk @seeker @oneshot @impring @quickscan.js`). `web/warriors.html` explains each one line by line. `-` reads Redcode from stdin. `classic:<name>` fetches a famous original from the public archives (`node cli/zorewars.js classics` lists them), and any `https://` URL to a Redcode file works too: good sparring partners, e.g. `classic:arvon`, the AI-assisted #1 of the Koenigstuhl 94nop hill. Exit codes: 0 ok, 1 compile error, 2 bad usage.

## Developer tools

- `hill <warrior> [--classics] [--rounds 20] [--json]`: benchmark against the library (and the classics), with loss diagnosis.
- `--hill koenigstuhl:94nop|88|lp|94x [--top 50]` (or a folder of `.red` files) on `hill`, `tune` and `evolve`: play that hill's top warriors instead of the library (evolve keeps the library as its gene pool). Pair it with `--rules` to train for a tournament; under `--rules 88` evolve writes ICWS'88 (no modifiers, '88 opcodes and modes only).
- `species [warrior...] [--json]`: where warriors sit by behaviour (most processes at once x different cells executed, measured alone). No arguments: the whole library.
- `refine <warrior.red> [--iterations 3] [--variants 4] [--turns 20] [--budget 5] [--effort high] [--model claude-opus-5-5]`: a language model reads the warrior's per-opponent results and post-mortems of its worst losses, and proposes rewrites (each a different idea, with earlier tries and their results fed back). A rewrite replaces the warrior only if it beats it on fresh seeds by more than the noise margin, as in `tune`. The model tests its drafts with tools (compile and run alone, battle one opponent, score the field), up to `--turns` model turns per iteration; `--budget` caps the estimated dollars for the whole run, and the conversation is prompt-cached so repeated input costs about a tenth. Needs the optional `@anthropic-ai/sdk` package and `ANTHROPIC_API_KEY` (read from `.env` if present). The model sees opponents' names, never their code. `--objective pushoff` judges rewrites by their place in a diversity push-off instead of points (with `--partner b.red`, our other entry is ranked beside each and the pair is judged by its better entry's place), compared seed by seed (6 seeds by default), and tells the model that being different from the hill counts; without `--hill` it uses the Koenigstuhl hill of the `--rules` set (top 30). Takes `--hill`, `--rules` and `--length`; writes `refined/<name>.red` and a `.refine.json` log.
- Block algebra (`tools/algebra/`, design in `docs/block-algebra.md`, blocks listed in `docs/block-algebra-catalog.md`): warriors as trees of blocks (76 so far: openings, quickscans and a probe-burst, clears, stones and bombers (incl. the modern multi-process hill stone), papers, imps and gates, vampires, pair/carpet scanners, sensors and repair, '88 versions, and torus/volume blocks) joined by combinators (`seq`, `par`, `relocate`, `boot`, `image`, `trigger`, `apart`, `copies`, `switch`, `restart`, `classify`), for every rule set and the torus (`buildTree(tree, { rules, torus: '100x80' })`); blocks are one file each in `tools/algebra/blocks/`, named designs in `tools/algebra/recipes.js` (`recipe compass --rules 94x`). `node scripts/algebra.js build tree.json --rules 94nop` checks the contracts, links the tree to Redcode and runs the behaviour gate; `random --rules 88 --seed 1` makes a random tree that passes it; `catalog` regenerates the catalog. Every `combo` recipe is a tree with the same compiled code. `evolve --representation tree [--hill koenigstuhl:94nop --top 30] [--rules 94nop --length 100] [--generations 10 --batch 30 --rounds 10 --race 2]` breeds trees against a hill (or the library): every candidate must pass the gate, scores are average points against every hill warrior, the archive keeps the best tree per behaviour species and top-level shape, and racing confirms a child on doubled rounds before it displaces an elite; at the end the best three are placed on the hill by score (where they'd rank among its warriors). `--start a.json` seeds it with trees (default: the recipes); `--tune --start tree.json` only changes numbers. Writes `best.red`, `best.json`, `tree-N.json` and `evolve-trees.json`.
- `tune <warrior.js> [--candidates 40] [--seeds 3] [--write]`: random search over a JavaScript warrior's constants. The file needs `const P = {...};` and a `// SPACE {"NAME":[min,max],...}` comment; see `warriors/gatekeeper.js`. Finalists are re-checked on fresh seeds against the current constants, opponent by opponent; a result only counts (and `--write` only saves it) if the gain is larger than its noise margin.
- `evolve [warrior...] [--generations 6] [--batches 4] [--batch 40] [--king a.js,b.red] [--genome 40] [--classics] [--out evolved]`: breed warriors. MAP-Elites keeps the best of each species; each generation's champion joins the opponents (Red Queen); `--classics` reports each champion's score against the held-out originals. `--king` starts the Red Queen with those warriors as champions (generation 1 must beat them); `--genome` raises the size limit for evolved code (default 40). `--scratch` evolves from random programs: no library genes, no library opponents and no known-good numbers; fitness is only against earlier champions (generation 0's are random survivors), and the library is held out to report progress. `--ties` sets what a tie with a champion counts (0 to 1, default 0.5); lower it so champions must kill rather than survive. `--objective pushoff` (with `--hill`) scores each candidate by its place in a tournament push-off against the hill instead of raw points, so diversity counts; `--partner a.red` ranks our other entry beside it. `--league` also breeds exploiters (scored only on beating the latest champion; they start over once one beats it by `--exploit-win 2` points per round or after `--exploit-age 6` generations) and league exploiters (scored on beating every champion so far); the main warriors must beat the latest of both as well as the field (`exploiter-N.red`, `league-N.red`). `--race N` cuts screening noise: a child that beats its cell's elite must beat it again N times with the rounds doubled each time, on the same seeds, before it takes the cell, and the champion is picked from the top four elites with one more doubling (try `--eval-rounds 3 --race 2`). Writes `redqueen-N.red`, `elite-pP-cC.red` and `evolve.json`. With `--torus` it also mutates numbers as points (`axis`: nudge one axis, `rotate`: swap two axes, `lift`: add a y or z part, `turn`: make an instruction a TRN along one axis; TRN is also among the opcodes `tweak` can pick there), gives the archive a third dimension, the warrior's shape (1 = its writes stay in one row, 2 = one layer, 3 = through the volume; files `elite-pP-cC-sS.red`), and writes vectors as `[x,y,z]`.

The methods behind `evolve` and `pushoff` (MAP-Elites, lexicase, Red Queen, the league, the diversity push-off and SD-score) are credited with links in `docs/references.md`.

Scores: points per round (win 3, tie 1) and the smooth score, where a loss is worth the share of the cycle limit survived (0 to just under 1).

## The plane (experimental)

`--torus 100x80` (or `125x64`, or `20x20x20`) replaces the ring with a torus. Every number is a point: plain numbers are steps along x (`-1` is still one cell back), `[x,y]` / `[x,y,z]` are vectors, and `SIZEX`/`SIZEY`/`SIZEZ` give the size (generators: `vec(x, y, z)`). Addressing and ADD/SUB/MUL/DIV/MOD work per axis; DJN, pointer increments and comparisons are plain numbers. Every process has a heading (+x at the start): its next instruction is one step along it. `TRN A` turns it to face along A (the axis with the largest part; `TRN $[0,1]` faces down); jumps keep the heading and SPL children inherit it. TRN is an error on the ring. A warrior may be at most half a row long on a torus (50 on 100x80). On 100x80 no fixed step visits more than 400 cells. `hill`, `tune`, `evolve` and `species` all take `--torus`. 3D: `--torus 40x20x10` (20-instruction warriors), `80x10x10` (40), `41x20x9` (20; coprime, so strides reach every cell) or `20x20x20` (10), or any size up to 200,000 cells; `@volume/lift.js`, `@volume/star.js`, `@volume/volumesilk.js`, `@volume/slant.js` (diagonal replicator), `@volume/battleship.js` (scanner that checks every cell), `@volume/broadside.js` (paper whose copies bomb diagonals), `@volume/fleet.js` (scanner + replicator, 80x10x10), `@volume/volumequeen.js` (two-process core clear), `@volume/leapfrog.js` (anti-clear: watches for a clear's front and leaps behind it; beats clears, loses to papers), `@volume/scatter.js` (replicator whose copies land somewhere new each time), `@volume/volumechameleon.js` (P-space switcher: Leapfrog, then a clear after a loss), `@volume/volumechameleon2.js` (Backdraft, then a paper after a loss), `@volume/backdraft2.js` (Backdraft with a wire against streams), `@volume/antichameleon.js` (counter-switcher: paper or Leapfrog, switching after every decided round; beats Volume Chameleon, weaker overall), `@volume/backdraft.js` (backward clear: its front comes the way lookouts don't watch; best on both volumes), `@volume/tripwire.js` (a DJN stream for a lap, then that clear), `@volume/gremlin.red` (evolved from scratch: a DJN stream that breaks clears' arithmetic; beats Volume Queen and Volume Chameleon, loses to papers), `@volume/adapter.js` (identifies its opponent in-round from what touches its marker: both fields zero → leap; copied code → become a clear; remembers it in P-space). `warriors/prototypes/README.md` lists 3D ideas that didn't make the library, with scores and why: read it before trying a hybrid. They're in `index.json` as `experimental` (shown in the arena's picker on request, left out of ladders, benchmarks and the library tools). A fixed step repeats within 40 cells on 40x20x10, so scan with plain-number pointers (`>ptr`) instead of strides. Plane warriors: `@plane/plaid.js`, `@plane/climber.js`, `@plane/planesilk.js`, `@plane/raster.js`, `@plane/columnimp.js`, `@plane/pillar.js`, `@plane/weave.js`.

## Tournament rules

`--rules 94nop|88|lp|94x` uses a standard hill's settings (pMARS `-s -p -c -l -d`, no P-space; `94x-hill` is the X hill itself, with P-space; `88` also checks ICWS'88 syntax exactly as `pmars -8` does: 11 opcodes, `# $ @ <` only, no modifiers, no ORG). Add `--length 50` for a tournament's length limit. `zorewars pushoff <entry...> --hill koenigstuhl:94nop|88|lp|94x --rules NAME --length 50 [--top 50] [--rounds 50]` predicts a tournament place: your entries join the Koenigstuhl hill's top warriors (fetched on demand, not stored), everyone plays everyone, and an iterative diversity push-off ranks them (score = average × SD-score diversity, as the Core War Tournament Weekend does). A warrior that wins in its own way ranks above a strong clone. `warriors/88/` holds ICWS'88 warriors (exact conversions written by `scripts/convert-library.js`, and hand-written adaptations marked `adaptedFrom`); under `--rules 88` the library tools use them.

## Rules (defaults)

- Core: 8000 cells, addresses wrap modulo 8000. Every cell starts as `DAT.F $0, $0`.
- All addresses are relative to the executing instruction.
- Max 100 instructions per warrior, 8000 processes per warrior, 80,000 cycles per round.
- Warriors alternate one instruction per turn. Each turn runs the process at the front of the warrior's queue.
- A process dies on `DAT`, or on `DIV`/`MOD` by zero. A warrior with no processes is out.
- Scoring: win 3 points, tie 1, loss 0. The first mover rotates each round; load positions come from `--seed`.

## Redcode (ICWS'94)

Line: `[label[:]] OPCODE[.MOD] [mode]A [, [mode]B]  ; comment`

Metadata comments: `;name`, `;author`, `;strategy`. Directives: `x EQU expr`, `ORG label`, `END [label]`. Expressions: `+ - * / %`, parentheses, comparisons, `&& ||`, labels (their value is the distance from the current line), and `CORESIZE MAXPROCESSES MAXCYCLES MAXLENGTH MINDISTANCE CURLINE`. `END` is reserved: don't use it as a label.

Opcodes:
- `DAT` kills the process. `MOV` copies A to B. `ADD SUB MUL DIV MOD` compute B = B op A.
- `JMP` jumps to A. `JMZ`/`JMN` jump to A if B is zero / non-zero. `DJN` decrements B and jumps to A if it is non-zero.
- `SPL` queues the next instruction, then a new process at A.
- `SEQ` (alias `CMP`), `SNE` and `SLT` skip the next instruction if A == B, A != B or A < B. `NOP` does nothing.

Modes: `#` immediate, `$` direct (the default), `@`/`*` B/A-field indirect, `<`/`{` B/A predecrement indirect, `>`/`}` B/A postincrement indirect.

Modifiers: `.A .B .AB .BA .F .X .I` (`.I` is the whole instruction). Defaults: `DAT`/`NOP` use `.F`. `MOV`/`SEQ`/`SNE` use `.AB` if A is `#`, `.B` if only B is `#`, otherwise `.I`. Arithmetic uses `.AB`, `.B` or `.F` by the same rule. `SLT` uses `.AB` if A is `#`, otherwise `.B`. Jumps and `SPL` use `.B`.

Single operand: `DAT x` is `DAT #0, x`; any other opcode gets `$0` as its B operand.

Also supported: `FOR`/`ROF` loops (`i for 4` ... `rof`, `&i` pastes the counter into labels), pMARS registers in expressions (`a=10`), `;assert`, and P-space: `STP` stores A into P-space cell B, `LDP` loads P-space cell A into B. P-space has CORESIZE/16 cells and persists between the rounds of a match; cell 0 holds the last round's result (0 = lost, otherwise the number of survivors, -1 on the first round).

## Generators (JavaScript / Python / C++)

These run once before the battle and emit Redcode. API: `mov(a,b)`, `mov.i(a,b)` (every opcode has every modifier), `label(n)`, `org(n)`, `equ(n,v)`, `name/author/strategy(s)`, `comment(s)`, `raw(line)`, operand helpers `imm # dir $ ind @ aind * predec < apredec { postinc > apostinc }`, and constants `CORESIZE` and friends. Python: `from zorewars import *`. C++: `#include "zorewars.hpp"`, `using namespace zw;` and `emit()` at the end of `main`. Check generated code with `node cli/zorewars.js compile <file>`. To start from an existing warrior in your favourite language: `node cli/zorewars.js convert <warrior> --to js|py` (works on `classic:<name>` too) gives a verified, readable generator you can edit.

## Example

```redcode
;name Dwarf
;strategy Bomb every 4th cell; 4 divides 8000 so we never hit ourselves.
        ORG     loop
loop    ADD.AB  #4, bomb
        MOV.I   bomb, @bomb
        JMP     loop
bomb    DAT.F   #0, #0
```

## Strategy notes

- Bombers ("stone") beat scanners, replicators ("paper") beat bombers, and scanners ("scissors") beat replicators.
- Choose step sizes against `CORESIZE` so your bombs can never land on your own code. Check by running your warrior alone: `battle mine.red --rounds 5` reports a tie for each round it survives and a loss for each round it kills itself.
- Imps rarely win but force ties. Breaking them takes a decrementing gate or a fast core clear.
- Small warriors are harder to find. Large ones survive more hits.
- The full tutorial is `web/docs.html`.
