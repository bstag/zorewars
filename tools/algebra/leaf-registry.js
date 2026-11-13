const kinds = ['opening', 'finisher', 'body', 'data'];
const supportedLegacyFiles = new Set(['_compact-pump.js']);

export function isLeafFile(file, drafts = new Set()) {
  return file.endsWith('.js') && (!file.startsWith('_') || supportedLegacyFiles.has(file) || drafts.has(file));
}

export function registerLeaves(files) {
  const leaves = {};
  for (const [file, blocks] of files) {
    for (const b of [].concat(blocks)) {
      const problem = !b?.id ? 'no id' : leaves[b.id] ? `${b.id} defined twice` : !kinds.includes(b.kind) ? `${b.id}: kind must be one of ${kinds.join(', ')}`
        : typeof b.emit !== 'function' ? `${b.id}: no emit` : !b.params || !b.purpose ? `${b.id}: needs params and purpose` : null;
      if (problem) throw new Error(`tools/algebra/blocks/${file}: ${problem}`);
      b.defaults ??= Object.fromEntries(Object.entries(b.params).map(([k, [lo]]) => [k, lo]));
      b.file = file;
      leaves[b.id] = b;
    }
  }
  return leaves;
}
