# Block recipe examples

These are original, behavior-checked ring recipes built from the executable
[catalog](../../docs/warrior-blocks.md). They are experimental examples, not
library promotions or claims of hill strength. Both start with a timed bomber,
copy a payload elsewhere, apply 64 SPL bombs, then reset for repeated DAT passes.

- `relocating-clear-94x.red`: 26 instructions, 55440-cell ring.
- `relocating-clear-88.red`: 28 instructions, strict '88 syntax, 8000-cell ring.
- Matching `.recipe.json` files preserve all choices and parameters.

From the repository root:

```sh
node cli/zorewars.js check examples/blocks/relocating-clear-94x.red --rules 94x --length 50 --json
node scripts/blocks.js verify --recipe examples/blocks/relocating-clear-94x.recipe.json
node scripts/blocks.js build --recipe examples/blocks/relocating-clear-94x.recipe.json --out evolved/my-blocks
node cli/zorewars.js tune evolved/my-blocks.js --rules 94x --length 50 --candidates 12
node scripts/evolve-blocks.js --rules 94x --out evolved/my-block-search
```

To use the parameter tuner without changing the structural choices, restrict the
generated `// SPACE` object to WAIT, STEP, HOP and STUN. Leave the full `const P`
object intact. After saving tuned constants, verify the generator itself:

```sh
node scripts/blocks.js verify --rules 94x --generator evolved/my-blocks.js
```

The verifier checks both the generated instructions and the behavior. An old
receipt cannot certify arbitrary edits to the emitted Redcode or generator.
The search runner checks every admitted recipe and every numerical neighbor,
then checks the existing tuner's finalists again before validation. All current
search runs use CPU workers. Existing CLI evolution and tuning defaults are unchanged.
