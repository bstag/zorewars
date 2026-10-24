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
- `species [warrior...] [--json]`: where warriors sit by behaviour (most processes at once x different cells executed, measured alone). No arguments: the whole library.
- `tune <warrior.js> [--candidates 40] [--seeds 3] [--write]`: random search over a JavaScript warrior's constants. The file needs `const P = {...};` and a `// SPACE {"NAME":[min,max],...}` comment; see `warriors/gatekeeper.js`. Finalists are re-checked on fresh seeds against the current constants, opponent by opponent; a result only counts (and `--write` only saves it) if the gain is larger than its noise margin.
- `evolve [warrior...] [--generations 6] [--batches 4] [--batch 40] [--king a.js,b.red] [--genome 40] [--classics] [--out evolved]`: breed warriors. MAP-Elites keeps the best of each species; each generation's champion joins the opponents (Red Queen); `--classics` reports each champion's score against the held-out originals. `--king` starts the Red Queen with those warriors as champions (generation 1 must beat them); `--genome` raises the size limit for evolved code (default 40). Writes `redqueen-N.red`, `elite-pP-cC.red` and `evolve.json`.

Scores: points per round (win 3, tie 1) and the smooth score, where a loss is worth the share of the cycle limit survived (0 to just under 1).

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
