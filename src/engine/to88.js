// ICWS'88 output. A compiled warrior can be written as ICWS'88 Redcode when
// every instruction is one: an '88 opcode, the modes # $ @ <, the '88 limits
// on immediates, and the modifier that '88 code implies (ICWS'88 has no
// modifiers; each instruction runs with the '94 default for its modes). Then
// the '88 text assembles to exactly the same program, under pmars -8 too.

import { defaultModifier } from './constants.js';
import { check88 } from './assembler.js';

// Returns { ok: true, code } or { ok: false, line, reason } for the first
// instruction that has no '88 form.
export function toICWS88(w, { coreSize = 8000 } = {}) {
  for (const [k, i] of w.instructions.entries()) {
    const why = check88(i.op === 'SEQ' ? 'CMP' : i.op, null, i.aMode, i.bMode)
      || (i.mod !== defaultModifier(i.op, i.aMode, i.bMode) ? `${i.op}.${i.mod} has no ICWS'88 form (it would run as ${i.op}.${defaultModifier(i.op, i.aMode, i.bMode)})` : null);
    if (why) return { ok: false, line: k, reason: why };
  }
  const sv = (v) => { v = ((v % coreSize) + coreSize) % coreSize; return v > coreSize / 2 ? v - coreSize : v; };
  const strategy = String(w.strategy || '').split('\n').filter(Boolean);
  return {
    ok: true,
    code: [
      ';redcode', `;name ${w.name}`, ...(w.author ? [`;author ${w.author}`] : []), ...strategy.map((s) => `;strategy ${s}`),
      ...w.instructions.map((i, k) => (k === w.start ? 'start' : '').padEnd(8) + `${(i.op === 'SEQ' ? 'CMP' : i.op).padEnd(8)}${i.aMode}${sv(i.a)}, ${i.bMode}${sv(i.b)}`),
      '        END     start', '',
    ].join('\n'),
  };
}
