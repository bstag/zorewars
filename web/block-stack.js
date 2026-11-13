// The editor stores the same {id, P?, kids?} trees that the CLI reads.
export function newBlock(def) {
  return def.kids ? { id: def.id, kids: [] } : { id: def.id };
}

export function readStack(tree, catalog, { complete = false } = {}) {
  let count = 0;
  function read(node, depth) {
    if (++count > 80 || depth > 12) throw new Error('A workbench stack can have up to 80 blocks and 12 levels.');
    const def = catalog.get(node?.id);
    if (!def) throw new Error(`Unknown block ${String(node?.id ?? '(missing ID)')}.`);
    const clean = newBlock(def);
    if (node.P !== undefined) {
      if (!node.P || typeof node.P !== 'object' || Array.isArray(node.P)) throw new Error(`${def.id} needs a parameter object.`);
      const entries = Object.entries(node.P);
      for (const [key, value] of entries) {
        if (!Object.hasOwn(def.params, key) && !Object.hasOwn(def.defaults, key)) throw new Error(`${def.id} has no ${key} parameter.`);
        if (complete ? !Number.isSafeInteger(value) : value !== null && !Number.isFinite(value)) {
          throw new Error(`${def.id} needs ${complete ? 'an integer' : 'a number'} for ${key}.`);
        }
      }
      clean.P = Object.fromEntries(entries);
    }
    if (def.kids) {
      const [min, max] = def.kids;
      const kids = node.kids ?? [];
      if (!Array.isArray(kids) || kids.length > max || (complete && kids.length < min)) {
        throw new Error(`${def.id} needs ${min === max ? min : `${min}–${max}`} member blocks.`);
      }
      clean.kids = kids.map((kid) => read(kid, depth + 1));
    } else if (node.kids !== undefined && (!Array.isArray(node.kids) || node.kids.length)) {
      throw new Error(`${def.id} cannot contain other blocks.`);
    }
    return clean;
  }
  if (!tree) throw new Error('Add a block to the warrior stack first.');
  return read(tree, 1);
}

export function blockPosition(root, node) {
  if (!root || root === node) return null;
  for (const [index, kid] of (root.kids ?? []).entries()) {
    if (kid === node) return { parent: root, index };
    const nested = blockPosition(kid, node);
    if (nested) return nested;
  }
  return null;
}

export function moveBlock(root, node, target, catalog) {
  const source = blockPosition(root, node);
  if (!source || !target.parent) throw new Error('Use Wrap in group to add a group above the root.');
  const { parent, index } = target;
  if (node === parent || blockPosition(node, parent)) throw new Error('A group cannot move into itself.');
  const sameGroup = source.parent === parent;
  if (!sameGroup && parent.kids.length >= catalog.get(parent.id).kids[1]) {
    throw new Error(`${parent.id} is full. Choose a slot in another group.`);
  }
  source.parent.kids.splice(source.index, 1);
  parent.kids.splice(index - Number(sameGroup && source.index < index), 0, node);
}
