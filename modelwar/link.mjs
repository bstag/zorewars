// node modelwar/link.mjs tree.json out.red [length]
// Links a block-algebra tree under the ModelWar rules with the contracts checked but without the
// behaviour gate. The gate rejects a scanner arm that finds a switch's idle arms ("wiped its own
// warrior"), which is harmless in a real round; the Discord Cobra trees need this.
// Use length 200 for trees under 200 instructions and 600 above (5040 makes the quickscans misfit).
import fs from 'node:fs';
import { treeSettings } from '../tools/algebra/build.js';
import { link, treeMismatches } from '../tools/algebra/link.js';

const [, , inp, out, len = '200'] = process.argv;
if (!inp || !out) { console.error('usage: node modelwar/link.mjs tree.json out.red [length]'); process.exit(2); }
const tree = JSON.parse(fs.readFileSync(inp, 'utf8'));
const settings = treeSettings('modelwar', Number(len));
const mismatches = treeMismatches(tree, settings);
if (mismatches.length) throw new Error(mismatches.join('; '));
const built = link(tree, settings, { name: inp.split(/[\\/]/).pop().replace('.json', '') });
if (built.misfits.length) throw new Error(built.misfits.join('; '));
fs.writeFileSync(out, built.source);
console.log(`${out}: ${built.total} instructions`);
