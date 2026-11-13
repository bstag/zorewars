# Tiny LP copy pointers and three-worker deployment

At SAL Tiny LP challenge 195, *FragPaper 800* was fourth and *tiny Roskilde* seventh. Both use the eight-process limit as part of their design. The traces below are quiet local VM runs at load address 0 with zero-based cycles. [SAL Tiny LP challenge 195](https://sal.discontinuity.info/hill.php?key=tinylp&t=195)

## FragPaper 800

Michal Janeczek spends three turns copying a three-cell stone backward. Four workers then share that deployed body. The first visits the stone at cycle 10, and its first bomb lands at cycle 15. The two paper loops begin independently. Each uses the source B-field as a backward copy cursor, fires a DAT into an attack lane between copies, and uses the destination B-field both as a predecrement cursor and as the eventual entry selector. Its `JMN` checks the B-field of the source cell just read. Reaching the seed, whose cursor has just reached zero, ends the copy. `SPL` restarts the original seed. The next instruction's indirect jump and direct B-field test resolve to the same copied seed, so the continuation enters only when that cursor is zero. [FragPaper 800 source](https://asdflkj.net/COREWAR/ODD/HILL32/fpaper800.red)

The head and tail first copy at cycles 8 and 11, first attack at 12 and 16, complete their initial copies at 113 and 118, and transfer at 137 and 143 to cells 342 and 160. The first queue of eight, after cycle 136, contains exactly four stone workers and two processes in each original paper region.

## tiny Roskilde

Christian Schmidt starts a paper process before opening the stone fan. Three workers execute each of three shared copy instructions. In each, the B-field of one data cell walks the source backward and the same cell's A-field walks the destination backward. The three workers fill each three-cell stone site before the self-indexing jump reads the three pointers in sequence. The first execution of each copy instruction is at cycles 4, 8 and 12. The stones attack from cells 526, 83 and 751 at cycles 20, 22 and 23. [tiny Roskilde source](https://asdflkj.net/COREWAR/ODD/HILL32/troskilde.red)

The six-cell paper uses the same source and destination cursor roles as the two FragPaper branches. It starts copying directly at cycle 2, writes the final cell at cycle 41, transfers at cycle 53 and executes the first copied seed at cycle 58. The paper SPL predecrements a remote cell at cycle 49, while the DAT travels as part of the copied image. The first queue of eight, after cycle 216, contains one process in each stone and five in paper. The `qtab` names in the source are labels and aliases. Entry is the paper-and-stone launcher.

## Reusable versions

The catalog's `lp-paper` already supplies counted copies and a concurrent doubling attack. `boot-paper` supplies a serial copy followed by a fan, and `fanboot3` allocates workers across three distinct members. The new leaves cover the short shared-pointer paper and the launch of three one-worker copies from a single template. Their offsets and payloads are independent of the published warriors. [Counted LP paper](../tools/algebra/blocks/silktails.js) · [Boot paper](../tools/algebra/blocks/papers.js) · [Fan combinators](../tools/algebra/link.js)

The six-cell `tiny-lp-pointer-paper` explicitly tests the remaining cursor during copying. The originals instead examine each copied source instruction's B-field for the sentinel zero. All three check the copied seed's B-field before transferring. The seven-cell mode interleaves a DAT write through a remote cursor. Its full gate checks every first-generation copy and attack, then witnesses a successful transfer with eight processes and verifies that the transfer preserves queue size. The damage test changes the copied seed's B-field and confirms the transfer stays closed. [Pointer paper](../tools/algebra/blocks/tiny-lp-pointer-paper.js) · [Focused tests](../test/algebra-tiny-lp-extracts.test.js)

The 12-cell `tiny-lp-stone-triad` checks the nine copies, both decrements of the three shared pointers, one queued entrant at each site and each site's first three bombs. Its two-offset `ADD.X` sends bombs along a fixed residue class outside all three stone bodies. The first three local bomb cycles are identical to *tiny Roskilde* when composed with the copy-only paper. A later paper can still collide with a stone, and the queue after launch can change. [Stone triad](../tools/algebra/blocks/tiny-lp-stone-triad.js)

| Quiet build | Length | First paper copy / attack | First paper transfer | First stone attacks | First eight-process queue |
| --- | ---: | --- | --- | --- | --- |
| *FragPaper 800* | 50 | 8 / 12 and 11 / 16 | 137 and 143 | 15 | 136, 4 + 2 + 2 |
| *tiny Roskilde* | 39 | 2 / — | 53 | 20, 22, 23 | 216, 1 + 1 + 1 + 5 |
| Copy-only pointer paper | 6 | 1 / — | 14 | — | 102 |
| Attack pointer paper | 7 | 1 / 2 | 23 | — | 165 |
| Triad alone | 12 | — | — | 14, 15, 16 | 3 processes throughout after dispatch |
| Triad and copy-only paper | 19 | 5 / — | 57 | 20, 22, 23 | 220, 1 + 1 + 1 + 5 |
| Triad and attack paper, `SLOT=499` | 20 | 5 / 9 | 93 | 20, 22, 23 | 354, two stone sites still active |

The untuned attack paper passes alone, then fails the full gate with the default triad. Moving its remote attack cursor from 601 to 499 produces a passing composition. Even with that adjustment, the attack instruction adds paper work between copies and the first transfer moves from cycle 57 to 93. The cap is a scheduling constraint as well as a capacity constraint.

In local exhaustive replay with offsets 50 through 750 and both first movers, the 19-cell model scored more points than the 20-cell attack model against both selected originals. Against *FragPaper 800* the counts were 394/638/370 versus 343/890/169 wins/losses/ties. Against *tiny Roskilde* they were 255/381/766 versus 268/597/537. This comparison keeps the stone sites and paper hop fixed. It includes the change in paper length, execution schedule and loaded image from enabling attack.

To reproduce the 19-cell build and its trace from the repository root, pass the tree on standard input. The JSON verification includes the three first attacks, the first paper transfer and the transfer after the cap. Set the paper parameters to `{"ATTACK":1,"SLOT":499}` to compare the 20-cell version.

```powershell
'{"id":"par","kids":[{"id":"tiny-lp-stone-triad"},{"id":"tiny-lp-pointer-paper","P":{"ATTACK":0}}]}' |
  node scripts/algebra.js build - --rules tinylp --verification full --json
node --test test/algebra-tiny-lp-extracts.test.js
```

For the two published traces, save the linked sources as `fpaper800.red` and `troskilde.red` in the working directory. This snippet prints the relevant visits, write addresses and first full queue. A pointer side effect is also a write, so use the source instruction and address to distinguish it from the copied instruction or bomb.

```powershell
@'
import { readFileSync } from 'node:fs';
import { compile, RULESETS, VM } from './src/engine/index.js';
for (const [file, watched] of [
  ['fpaper800.red', [1, 2, 5, 44, 45, 48, 556, 557]],
  ['troskilde.red', [1, 3, 4, 29, 30, 31, 32, 526, 83, 751]],
]) {
  const settings = RULESETS.tinylp;
  const warrior = compile(readFileSync(file, 'utf8'), 'redcode', settings);
  if (!warrior.ok) throw Error(JSON.stringify(warrior.errors));
  const vm = new VM(settings);
  vm.load([warrior], { positions: [0] });
  let capped = false;
  while (!vm.done && vm.cycle <= 220) {
    const cycle = vm.cycle, pc = vm.processes(0)[0];
    vm.step();
    const queue = vm.processes(0);
    const firstFullQueue = !capped && queue.length === 8;
    capped ||= firstFullQueue;
    if (watched.includes(pc) || firstFullQueue) {
      const writes = [...vm.lastWrite.keys()].filter((cell) => vm.lastWrite[cell] === vm.steps);
      console.log(file, JSON.stringify({ cycle, pc, writes, queue, firstFullQueue }));
    }
  }
}
'@ | node --input-type=module
```
