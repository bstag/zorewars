// The block algebra (docs/block-algebra.md): warriors as trees of blocks.
//   build(tree, { rules, length }) -> { source, w, verification, ... }
// checks the contract, links the tree, assembles it and runs the gate.
import { compile } from '../../src/engine/index.js';
import { recipeSettings } from '../blocks/recipes.js';
import { link, treeMismatches, shape } from './link.js';
import { gate } from './gate.js';

export { leaves, modInverse } from './leaves.js';
export { combinators, definition, iface, link, shape, treeMismatches } from './link.js';
export { gate, shapeOf } from './gate.js';
export { comboToTree } from './combo-tree.js';
export { recipes } from './recipes.js';
export * from './genome.js';

export function buildTree(tree, { rules = '94x', length = 50, name } = {}) {
  const settings = recipeSettings(rules, length);
  const misfits = treeMismatches(tree, settings);
  if (misfits.length) throw new Error(`Blocks do not fit: ${misfits.join('; ')}`);
  const built = { ...link(tree, settings, { name }), settings, rules, tree };
  if (built.total > length) throw new Error(`The tree needs ${built.total} instructions; budget is ${length}`);
  built.w = compile(built.source, 'redcode', settings);
  if (!built.w.ok) throw new Error(JSON.stringify(built.w.errors));
  built.verification = gate(built);
  built.shape = shape(tree);
  return built;
}
