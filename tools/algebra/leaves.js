// Every block in tools/algebra/blocks/ (one file per block or group of blocks,
// each exporting a block or an array of them as its default). A file whose
// name starts with _ is a draft and is skipped, unless ALGEBRA_DRAFTS names it
// (comma-separated), so a draft can be tested without affecting anyone else.
// How to write one: docs/block-algebra.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export { modInverse } from './util.js';

const KINDS = ['opening', 'finisher', 'body', 'data'];
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'blocks');
export const leaves = {};
const drafts = new Set((process.env.ALGEBRA_DRAFTS ?? '').split(',').filter(Boolean));
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js') && (!f.startsWith('_') || drafts.has(f))).sort()) {
  const mod = await import(pathToFileURL(path.join(dir, file)).href);
  for (const b of [].concat(mod.default)) {
    const problem = !b?.id ? 'no id' : leaves[b.id] ? `${b.id} defined twice` : !KINDS.includes(b.kind) ? `${b.id}: kind must be one of ${KINDS.join(', ')}`
      : typeof b.emit !== 'function' ? `${b.id}: no emit` : !b.params || !b.purpose ? `${b.id}: needs params and purpose` : null;
    if (problem) throw new Error(`tools/algebra/blocks/${file}: ${problem}`);
    b.defaults ??= Object.fromEntries(Object.entries(b.params).map(([k, [lo]]) => [k, lo]));
    b.file = file;
    leaves[b.id] = b;
  }
}
