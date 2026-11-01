// Binary warrior records shared by match and solo dispatch.
import {OP, MOD, MODES} from '../constants.js';
export function appendWarrior(input, desc, w, s, geo) {
  const norm = (v) => ((v % s.coreSize) + s.coreSize) % s.coreSize;
  if (!w?.instructions?.length || w.instructions.length > s.maxLength || (geo && w.instructions.length > geo.maxCodeLength)) throw new Error('GPU: invalid warrior length for ' + (w?.name ?? 'warrior'));
  if (!Number.isSafeInteger(w.start)) throw new Error('GPU: invalid warrior start');
  input[desc] = input.length; input[desc + 1] = w.instructions.length;
  input[desc + 2] = geo ? geo.encode(w.start, 0, 0) : norm(w.start);
  for (const ins of w.instructions) {
    const op = typeof ins.op === 'number' ? ins.op : OP[ins.op];
    const mod = typeof ins.mod === 'number' ? ins.mod : MOD[ins.mod];
    const am = typeof ins.aMode === 'number' ? ins.aMode : MODES.indexOf(ins.aMode);
    const bm = typeof ins.bMode === 'number' ? ins.bMode : MODES.indexOf(ins.bMode);
    if (![op, mod, am, bm, ins.a, ins.b].every(Number.isInteger) || op < 0 || op > 18 || mod < 0 || mod > 6 || am < 0 || am > 7 || bm < 0 || bm > 7) throw new Error('GPU: invalid compiled instruction');
    input.push(op | (mod << 5) | (am << 8) | (bm << 11), norm(ins.a), norm(ins.b));
  }
}
