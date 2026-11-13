// The block algebra (docs/block-algebra.md): warriors as trees of blocks.
//   build(tree, { rules, length }) -> { source, w, verification, ... }
// checks the contract, links the tree, assembles it and runs the gate.
export { buildTree, treeSettings } from './build.js';
export { leaves, modInverse } from './leaves.js';
export { combinators, definition, iface, link, shape, treeMismatches, switchChoice } from './link.js';
export { gate, shapeOf } from './gate.js';
export {observeTree,createObservation,verifyPhases} from './observe.js';
export {describeBlock} from './knowledge.js';
export {shiftCompactPumpKeepingSeed,linkedCompactPumpSeed,linkedCompactPumpSeeds,withIndependentImpEngines,withSeededCompactPump,withSeparateLauncherPath} from './pump-placement.js';
export {configureStoneImp,stoneImpLayout} from './stone-imp-options.js';
export { comboToTree } from './combo-tree.js';
export { recipes } from './recipes.js';
export * from './genome.js';
