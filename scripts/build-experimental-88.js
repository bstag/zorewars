// Regenerate the checked examples from their recorded architecture parameters.
import fs from 'node:fs';
import { compile, RULESETS } from '../src/engine/index.js';
import * as generators from '../tools/experimental-88.js';

const root = new URL('../examples/experimental-88/', import.meta.url);
const parameters = JSON.parse(fs.readFileSync(new URL('parameters.json', root), 'utf8'));
const artifacts = Object.entries(parameters).map(([name, p]) => {
  const source = generators[name](p);
  const w = compile(source, 'redcode', { ...RULESETS['88'], maxLength: 50 });
  if (!w.ok) throw new Error(`${name}: ${JSON.stringify(w.errors)}`);
  return { name, source, length: w.instructions.length };
});
for (const x of artifacts) {
  fs.writeFileSync(new URL(`${x.name}.red`, root), x.source);
  console.log(`${x.name}: ${x.length} instructions`);
}
