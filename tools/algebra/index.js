// The block algebra (docs/block-algebra.md): warriors as trees of blocks.
//   build(tree, { rules, length }) -> { source, w, verification, ... }
// checks the contract, links the tree, assembles it and runs the gate.
import { compile } from '../../src/engine/index.js';
import { recipeSettings } from '../blocks/recipes.js';
import { link, treeMismatches, shape } from './link.js';
import { gate } from './gate.js';

export { leaves, modInverse } from './leaves.js';
export { combinators, definition, iface, link, shape, treeMismatches, switchChoice } from './link.js';
export { gate, shapeOf } from './gate.js';
// treeSettings is defined below.
export { comboToTree } from './combo-tree.js';
export { recipes } from './recipes.js';
export * from './genome.js';

// A battlefield: a hill's rules, and optionally a torus ('100x80' or '20x20x20')
// in place of the ring. On a torus a warrior may be at most half a row long.
export function treeSettings(rules = '94x', length = 50, torus = null) {
  const settings = recipeSettings(rules, length);
  if (!torus) return settings;
  const dims = String(torus).toLowerCase().split('x').map((d) => parseInt(d, 10));
  if (dims.length < 2 || dims.length > 3 || dims.some((d) => !Number.isFinite(d) || d < 1)) throw new Error('torus takes sizes like 100x80 or 20x20x20');
  const [x, y, z = 1] = dims;
  return { ...settings, topology: 'torus', sizeX: x, sizeY: y, sizeZ: z, coreSize: x * y * z, maxLength: Math.min(length, Math.floor(x / 2)) };
}

export function buildTree(tree, { rules = '94x', length = 50, name, torus = null } = {}) {
  const settings = treeSettings(rules, length, torus);
  const misfits = treeMismatches(tree, settings);
  if (misfits.length) throw new Error(`Blocks do not fit: ${misfits.join('; ')}`);
  const built = { ...link(tree, settings, { name }), settings, rules, tree };
  if (built.total > settings.maxLength) throw new Error(`The tree needs ${built.total} instructions; budget is ${settings.maxLength}`);
  built.w = compile(built.source, 'redcode', settings);
  if (!built.w.ok) throw new Error(JSON.stringify(built.w.errors));
  built.verification = gate(built);
  built.shape = shape(tree);
  return built;
}
