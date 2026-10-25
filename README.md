# ZoreWars

A browser-based programming game inspired by **Core War** (1984). Players write small programs, called *warriors*, that compete inside a simulated circular memory array run by a virtual machine. Warriors can read and overwrite any cell, so they bomb, copy, scan and trap each other. The last warrior with a running process wins.

- **Visual arena**: watch every memory write, executed instruction and live process in real time, step through instructions, inspect memory, and run tournaments.
- **Code editor that works on phones**: CodeMirror 6 with Redcode, JavaScript and Python highlighting, assembler errors underlined on their line, autocomplete with instruction help, and a symbol bar above the phone keyboard (`# $ @ < > { }` and common opcodes). On phones the arena switches to Arena / Code / Details tabs with icon controls.
- **Redcode, JavaScript, Python or C++**: Redcode (ICWS'94 assembly) is what runs in the VM. JavaScript, Python and C++ programs *generate* Redcode, so loops and functions act as a macro language.
- **Warrior encyclopedia**: 26 warriors covering the classic strategy families (imp, imp ring, stone, paper, silk, B-scanner, CMP scanner, one-shot, quickscan, vampire, core clears, stone/imp, P-space switchers, quickscan hybrids), each explained line by line, with history, a Hall of Fame of 35 famous warriors linked to the public archives, and round-robin benchmark results: [web/warriors.html](web/warriors.html).
- **Tuned and evolved warriors**: Gatekeeper, Papercut, Blitz, Chameleon and Bandit were tuned with the developer tools against the library and the Hall of Fame, Evolved Silk and Red Queen were bred by the evolver. Fast Silk, Hedgehog and Hydra rebuild the techniques of modern hill warriors (decoding quickscan, booting, multi-process stones, imp spirals) in our own code.
- **Ladder and species map**: a king-of-the-hill ladder in the arena (kept in your browser), and a map that places warriors by how they behave: processes at once against cells executed.
- **Post-mortems**: every round explains how it was won. You get the killing blow and who wrote it, a timeline, process deaths by cause, conversions (processes running the opponent's program), and the ending code against the original. The arena can replay the end of any round instruction by instruction, and the CLI has `battle --report` and `trace`.
- **Redcode → JavaScript / Python converter**: readable output (constants, real loops, comments), verified to compile to exactly the same program. Every library warrior ships converted in `warriors/javascript/` and `warriors/python/`, and any original can be converted on demand: `zorewars convert classic:thermite --to py`, or the arena's Convert buttons.
- **Tutorial and reference**: [web/docs.html](web/docs.html), served at `/web/docs.html`.
- **Battle the real classics**: import originals from the public archives (Koenigstuhl, Planar's archive) by URL, from a file, or by dropping a `.red` file onto the editor. In the CLI, use `classic:thermite` or any URL. Nothing is copied into the project.
- **CLI for AI agents**: battles and tournaments with `--json` output, reproducible from a seed. See [AGENTS.md](AGENTS.md).
- **3D (experimental)**: a 40×20×10 or 80×10×10 volume or a 20×20×20 cube, shown live in 3D in the arena (drag to turn it, pinch or wheel to zoom, or let it spin). Code can travel along any axis.
- **The plane (experimental)**: the first step towards a 3D battlefield. The core can be a torus plane (100×80 or 125×64) where addresses are vectors such as `[0,1]`. Code flows along rows, and fixed strides can't cover the plane, so the strategies that win change. Classic battles are unaffected, and a plane one row high is proven identical to the ring. See [design/3d-battlefield.md](design/3d-battlefield.md).
- **Developer tools**: `zorewars hill` (benchmark with loss diagnosis), `species` (behaviour map), `tune` (constant search) and `evolve` (Red Queen rounds of MAP-Elites, after [Digital Red Queen](https://github.com/SakanaAI/drq)), all using every CPU core.

**Play it:** [zorewars.blackstag.workers.dev](https://zorewars.blackstag.workers.dev) (full version on Cloudflare) · [bstag.github.io/zorewars](https://bstag.github.io/zorewars/) (static mirror on GitHub Pages: everything except importing originals by URL)

No runtime dependencies; Node.js 18+ (Wrangler, for Cloudflare deploys, needs Node 22).

## Quick start

```bash
npm start
```

Then open http://localhost:8080. Pick warriors from the Library menu, press **Run**, and hover over the core to read memory.

**Hosting:** there's no build step; the repository root is the website. Deploy it to Cloudflare (Workers + Static Assets, with a tiny Worker that proxies archive downloads) or to GitHub Pages (fully static). See [DEPLOY.md](DEPLOY.md).

```bash
node cli/zorewars.js list
node cli/zorewars.js battle @mice @dwarf --rounds 100
node cli/zorewars.js tournament warriors --rounds 20
node cli/zorewars.js battle warriors/carpet.js @scanner --json
node cli/zorewars.js hill warriors/gatekeeper.js --classics
node cli/zorewars.js evolve --generations 6
```

## Project layout

| Path | What it is |
| --- | --- |
| `index.html` | Redirects to `web/`, so the repository root can be served as-is. |
| `worker/index.js`, `wrangler.jsonc`, `.assetsignore` | Cloudflare deployment: static site plus the `/api/fetch` archive proxy. |
| `.github/workflows/` | CI (tests, Cloudflare dry run) and an optional GitHub Pages deploy. |
| `design/` | Design proposals, starting with rulesets and the 3D battlefield. |
| `src/engine/` | The VM, assembler, JS generator and match runner. Shared by the browser and Node. |
| `web/` | The arena (`index.html`, `app.js`, `arena.js`) and the tutorial (`docs.html`). |
| `cli/zorewars.js` | Command-line battles, tournaments, compiler, and the static server with its archive proxy. |
| `cli/devtools.js`, `tools/` | Developer tools: the parallel benchmark (`hill.js`, `worker.js`), tuner (`tune.js`), evolver (`evolve.js`, `genes.js`). |
| `cli/remote.js` | Fetches warriors from the public archives (allow-listed hosts for the proxy; Redcode only). |
| `warriors/` | Built-in warriors and `index.json`, the library manifest. |
| `lang/python/zorewars.py` | Python generator library. |
| `lang/cpp/zorewars.hpp` | C++17 generator library (header only). |
| `warriors/encyclopedia.json` | History and analysis behind the encyclopedia page. The line-by-line breakdown comes from each warrior's own comments. |
| `scripts/pmars-compare.js` | Differential test against a pMARS binary (`npm run compare`). |
| `src/engine/topology.js` | Battlefield shapes: addressing, distance and placement (the classic ring today; the seam for 3D). |
| `src/engine/species.js` | Behaviour measurement for the species map, the evolver's archive and `zorewars species`. |
| `web/ladder.js` | The arena's Ladder and Species map cards. |
| `src/engine/geometry.js` | Torus geometry: numbers as points, per-axis arithmetic (the plane and, later, 3D). |
| `scripts/plane-reference.js`, `scripts/plane-fuzz.js` | An independent interpreter for torus battlefields and the differential fuzzer that checks the VM against it (`npm run fuzz`). |
| `src/engine/convert.js` | The Redcode → JavaScript / Python converter, with verification. |
| `scripts/convert-library.js` | Regenerates and verifies `warriors/javascript/` and `warriors/python/`. |
| `scripts/benchmark.js` | Round robin of the library; writes `warriors/benchmarks.json` (`npm run bench`). |
| `examples/` | Example warriors in each language. |
| `test/` | Engine, converter and tool tests: `npm test`. |

## How it works

The core holds 8000 instructions by default. Each warrior has a queue of processes; warriors alternate, running one instruction from the front of their queue each turn. `DAT` (or dividing by zero) kills the process that runs it, and `SPL` adds a process. A round ends when one warrior is left, or as a tie after 80,000 cycles.

The engine implements the ICWS'94 opcode set (`DAT MOV ADD SUB MUL DIV MOD JMP JMZ JMN DJN SPL SLT SEQ/CMP SNE NOP`), all eight addressing modes (`# $ * @ { < } >`) and all seven modifiers (`.A .B .AB .BA .F .X .I`) with the standard defaults. It also supports P-space (`LDP`/`STP`), `FOR`/`ROF` macro loops, pMARS expression registers and `;assert`, enough for 34 of the 35 Hall of Fame originals to load unchanged. Read/write limits and `PIN` are not implemented.

**Tested against pMARS**, the reference simulator: identical assembly for 53 warriors and identical results for 2,550 fixed-position rounds and 142 multi-round matches, including P-space. The CLI accepts pMARS's command-line options and uses the same placement for two-warrior matches, so those can be replayed in pMARS exactly. See [COMPLIANCE.md](COMPLIANCE.md) to rerun the comparison (`npm run compare -- --pmars path/to/pmars`).

As a further check, a round robin of those 34 originals ranks the modern hill champions (Tolypeutes, Myrmidon, Son of Vain, Azathoth, Arvon) at the top and the 1984 classics at the bottom.

## Languages

| Language | Arena | CLI |
| --- | --- | --- |
| Redcode (`.red`) | yes | yes |
| JavaScript (`.js`) | yes | yes |
| Python (`.py`) | yes, through Pyodide (about 10 MB, downloaded on first use) | yes, with local `python` |
| C++ (`.cpp`) | no | yes, with `g++` or `clang++` |

## License

- **Code:** [Apache License 2.0](LICENSE). It's free to use, change and build on, including commercially, with a patent grant from contributors. See [NOTICE](NOTICE).
- **Warriors written for ZoreWars:** [CC0 1.0](warriors/LICENSE.md), public domain. The adapted classics (Imp, Dwarf, Mice) are credited to their authors and excluded.
- **Documentation text:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **The name and logo** "ZoreWars" are not licensed.

Contributions are welcome: sign your commits with `git commit -s` (Developer Certificate of Origin). See [CONTRIBUTING.md](CONTRIBUTING.md).
