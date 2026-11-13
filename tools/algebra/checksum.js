// Resolve initial numeric-field checksums after the linker's layout is stable.
// The expected A sum is encoded in MOV.F's initial bias; SEQ.F compares with
// its own instruction register, whose A field is the distance to the accumulator.
import { assemble } from '../../src/engine/assembler.js';

export function resolveChecksums(lines, checks, labels, header, entry, settings) {
  if (!checks.length) return lines;
  const source = [...header, `ORG ${entry}`, ...lines, 'END'].join('\n');
  const w = assemble(source, settings);
  if (!w.ok) throw new Error(`Cannot resolve checksum: ${JSON.stringify(w.errors)}`);
  const norm = x => ((x % settings.coreSize) + settings.coreSize) % settings.coreSize;
  const result = [...lines];
  for (const c of checks) {
    const cells = c.range
      ? Array.from({ length: labels[c.end] + c.extra - labels[c.start] }, (_, i) => labels[c.start] + i)
      : c.cells.map(([label, offset]) => labels[label] + offset);
    let a = 0, b = 0;
    for (const pc of cells) { a += w.instructions[pc]?.a ?? 0; b += w.instructions[pc]?.b ?? 0; }
    const acc = labels[c.acc], init = labels[c.init], cmp = labels[c.cmp];
    result[c.initLine] = `${c.init} MOV.F #${norm(acc - cmp - a)}, ${c.acc}`;
    result[c.cmpLine] = `${c.cmp} SEQ.F ${c.acc}, #${norm(acc - init + b)}`;
  }
  return result;
}
