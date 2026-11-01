// Compiled-code census heuristics, separate from fetching a live hill.
const dist = (x) => Math.abs((((x + 4000) % 8000) + 8000) % 8000 - 4000);
const big = (x) => dist(x) > 100;

// Code tags: shapes a part leaves in the compiled instructions.
export function codeTags(ins) {
  const t = new Set();
  const cmps = ins.filter((i) => ['SEQ', 'SNE', 'CMP'].includes(i.op) && big(i.a) && big(i.b));
  if (cmps.length >= 6) t.add('qscan');
  // silk: SPL @0 plus a copy with incrementing/decrementing pointers on both sides
  if (ins.some((i) => i.op === 'SPL' && i.aMode === '@' && i.a === 0)
    && ins.some((i) => i.op === 'MOV' && '}<{>'.includes(i.aMode) && '><}'.includes(i.bMode))) t.add('paper');
  // imp: MOV.I to a step with N * step = 1 (mod 8000)
  if (ins.some((i) => i.op === 'MOV' && i.mod === 'I' && i.bMode === '$'
    && [3, 5, 7, 9, 11, 13, 17, 19, 21, 23, 27, 29, 31].some((n) => (((i.b % 8000) + 8000) * n) % 8000 === 1))) t.add('imp');
  // clear: a tight loop moving a bomb through a nearby incrementing pointer
  const clearMov = (m) => m.op === 'MOV' && '$*@'.includes(m.aMode) && '>}'.includes(m.bMode) && dist(m.b) < 30;
  if (ins.some((i, k) => i.op === 'SPL' && (i.aMode === '#' || i.a === 0) && ins.slice(k + 1, k + 5).some(clearMov)
      && ins.slice(k + 1, k + 6).some((j, d) => (j.op === 'DJN' || j.op === 'JMP') && j.a !== 0 && dist(j.a) <= d + 1))
    || ins.some((i, k) => clearMov(i) && ins.slice(k + 1, k + 4).some((j) => (j.op === 'DJN' || j.op === 'JMP') && (j.a + 8000) % 8000 > 7990))) t.add('clear');
  let run = 0;
  for (const i of ins) { run = i.op === 'DAT' && (i.a || i.b) ? run + 1 : 0; if (run >= 6) t.add('decoy'); }
  if (ins.some((i) => i.op === 'LDP' || i.op === 'STP')) t.add('pspace');
  return t;
}
