// Every block in tools/algebra/blocks/ (one file per block or group of blocks,
// each exporting a block or an array of them as its default). A file whose
// name starts with _ is a draft and is skipped, unless ALGEBRA_DRAFTS names it
// (comma-separated), so a draft can be tested without affecting anyone else.
// How to write one: docs/block-algebra.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isLeafFile, registerLeaves } from './leaf-registry.js';

export { modInverse } from './util.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'blocks');
const drafts = new Set((process.env.ALGEBRA_DRAFTS ?? '').split(',').filter(Boolean));
const files = [];
for (const file of fs.readdirSync(dir).filter((f) => isLeafFile(f, drafts)).sort()) {
  const mod = await import(pathToFileURL(path.join(dir, file)).href);
  files.push([file, mod.default]);
}
export const leaves = registerLeaves(files);
