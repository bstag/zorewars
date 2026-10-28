// Optional block workbench; no change to the ordinary evolve/tune defaults.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blocks, standaloneRecipes, instructionCatalog, catalogMarkdown } from '../tools/blocks/catalog.js';
import { inventorySources, hash, sourceIndexMarkdown } from '../tools/blocks/inventory.js';
import { parseTunable } from '../tools/tune.js';
import { compile } from '../src/engine/index.js';
import { recipeFamilies, familyReadiness, buildBlockRecipe } from '../tools/blocks/registry.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const command = process.argv[2];
const options = {};
for (let i = 3; i < process.argv.length; i++) {
  const key = process.argv[i];
  if (key === '--public') options.public = true;
  else if (['--rules', '--out', '--recipe', '--generator', '--length', '--family'].includes(key) && process.argv[i+1] && !process.argv[i+1].startsWith('--')) options[key.slice(2)] = process.argv[++i];
  else throw new Error(`Unknown/missing option ${key}`);
}
const inventoryPath = path.join(root, 'docs/block-sources.json');
const readInventory = () => fs.existsSync(inventoryPath) ? JSON.parse(fs.readFileSync(inventoryPath, 'utf8')) : null;
function saveJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
if (command === 'inventory') {
  const inventory = await inventorySources(root, { publicSources: options.public, previous: readInventory() });
  saveJson(inventoryPath, inventory);
  console.log(JSON.stringify({ local: inventory.local.length, public: inventory.public.length, inspected: inventory.public.filter(x => x.status === 'inspected').length, failures: inventory.public.filter(x => x.status === 'fetch-failed').map(x => ({ name: x.name, error: x.error })) }));
} else if (command === 'catalog') {
  const runnableRecipes = Object.entries(recipeFamilies).map(([id, { defaults, space, rules, numeric, blocks }]) => ({ id, defaults, space, rules, numeric, blocks }));
  saveJson(path.join(root, 'docs/block-catalog.json'), { schemaVersion: 2, blocks, standaloneRecipes, runnableRecipes, familyReadiness });
  saveJson(path.join(root, 'docs/block-instructions.json'), instructionCatalog());
  fs.writeFileSync(path.join(root, 'docs/warrior-blocks.md'), catalogMarkdown(readInventory()) + '\n## Current hill leaders\n\nThe [leader breakdowns](hill-leaders.md) map current recursive rankings to reviewed source sections, local reference extractions, and additional candidate contracts. Refresh them with `node scripts/hill-leaders.js`. Public-reference extractions are not admitted to evolution until their behavioral contracts are tested.\n');
  if (readInventory()) fs.writeFileSync(path.join(root, 'docs/block-source-index.md'), sourceIndexMarkdown(readInventory()));
  fs.appendFileSync(path.join(root, 'docs/warrior-blocks.md'), '\n## Process-aware recipe and historical lessons\n\n[Lifeboat 94x](../examples/experimental-94x/lifeboat/README.md) is an original stone/watchdog/clear recipe with its own gated evolution runner. Its two-process contract is separate from the single-process composer. The [family history](warrior-family-history.md) traces dated source changes and explains which coupled parameters, scheduling rules and behavioral tests we should preserve.\n');
  const archiveLink = '\n## Historical component taxonomy\n\nThe [Planar component crosswalk](planar-components.md) connects 14 historical categories to our existing blocks and design candidates. The [dated source index](planar-warrior-index.md) preserves component combinations, author attribution and original-post provenance; [archive notes](planar-warrior-history.md) explain source ambiguities and overlap with the n1LS collection. The [other-category review](planar-other-review.md) adds six documented mechanism candidates, source analysis and a small matched screen. Archive tags do not certify reusable blocks.\n';
  fs.appendFileSync(path.join(root, 'docs/warrior-blocks.md'), archiveLink);
  fs.appendFileSync(path.join(root, 'docs/warrior-blocks.md'), '\n## Recipe evolution\n\nThe [block evolution guide](block-evolution.md) describes the main CLI integration, Compass scanner/decoy layout, parameter tuning and the readiness of all historical families. Runnable recipes and their legal parameter spaces are exported in [the catalog](block-catalog.json). The original seven composable choices remain one grammar; additional recipes own separate process and pointer contracts.\n');
  if (readInventory()) fs.appendFileSync(path.join(root, 'docs/block-source-index.md'), archiveLink);
  console.log('Catalog, instructions and documentation generated.');
} else if (command === 'build' || command === 'verify') {
  if (command === 'verify' && !options.recipe && !options.generator) throw new Error('verify needs --recipe or --generator');
  const saved = options.recipe ? JSON.parse(fs.readFileSync(path.resolve(options.recipe), 'utf8')) : null;
  const family = options.family ?? saved?.recipe?.family ?? 'clear';
  if (!recipeFamilies[family]) throw new Error(`Unknown family ${family}`);
  const P = options.generator ? parseTunable(fs.readFileSync(path.resolve(options.generator), 'utf8')).current : saved?.recipe?.P ?? saved?.P ?? recipeFamilies[family].defaults;
  const config = { rules: options.rules ?? saved?.rules ?? '94x', length: Number(options.length ?? saved?.length ?? 50) };
  const built = buildBlockRecipe({ family, P }, config);
  if (options.generator) {
    const actual = compile(fs.readFileSync(path.resolve(options.generator), 'utf8'), 'javascript', built.settings);
    const code = w => JSON.stringify(w.instructions.map(({line, ...x}) => x));
    if (!actual.ok || actual.start !== built.w.start || code(actual) !== code(built.w)) throw new Error('Generator differs from the verified recipe; parameter receipt cannot certify edited code');
  }
  const receipt = { schemaVersion: 2, ...config, recipe: { family, P }, P, sourceHash: hash(built.source), sections: built.sections, verification: built.verification };
  if (command === 'build') {
    const out = path.resolve(options.out ?? path.join(root, 'evolved/blocks/sample'));
    for (const suffix of ['.red', '.js', '.recipe.json']) if (fs.existsSync(out + suffix)) throw new Error(`Output exists: ${out + suffix}`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out + '.red', built.source); fs.writeFileSync(out + '.js', built.generator); saveJson(out + '.recipe.json', receipt);
    console.log(`Wrote ${out}.{red,js,recipe.json}`);
  }
  console.log(JSON.stringify({ rules: config.rules, length: built.w.instructions.length, sourceHash: receipt.sourceHash, verification: built.verification }));
} else {
  throw new Error('Usage: node scripts/blocks.js inventory [--public] | catalog | build [--rules 88|94nop|lp|94x|94x-hill] [--out prefix] [--recipe file] | verify --recipe file [--generator tuned.js]');
}
