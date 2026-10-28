# Compass 94x

An original comparison scanner with configurable decoys, exact relocation and
an explicit SPL/DAT clear. Default length: 44. This is an experimental recipe,
not a promoted library warrior or a Monowire clone.

```sh
node cli/zorewars.js check examples/experimental-94x/compass/default.js --rules 94x --length 50 --json
node scripts/blocks.js verify --recipe examples/experimental-94x/compass/default.recipe.json --generator examples/experimental-94x/compass/default.js
node cli/zorewars.js evolve --representation blocks --families compass --rules 94x --length 50 --local-steps 4 --validate --out evolved/compass-search
```

[Layout, contracts, full-catalog roadmap and tuning](../../../docs/block-evolution.md).
The first matched screen did not establish a benefit from decoys. Keep variants
for further experiments; do not infer strength from passing solo checks.
