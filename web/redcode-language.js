// Shared Redcode vocabulary, stream highlighting and document names.
import {OPCODES} from '../src/engine/index.js';
export const CONSTANTS = ['CORESIZE', 'MAXPROCESSES', 'MAXCYCLES', 'MAXLENGTH', 'MINDISTANCE', 'PSPACESIZE', 'CURLINE'];
export const ALL_OPS = [...OPCODES, 'CMP'];
export const OP_RE = new RegExp(`^(${ALL_OPS.join('|')})(\\.(AB|BA|A|B|F|X|I))?$`, 'i');
const PSEUDO_RE = /^(ORG|END|EQU|FOR|ROF|PIN)$/i;

// ---------------------------------------------------------------- Redcode mode

export const redcodeMode = {
  name: 'redcode',
  startState: () => ({ sawOpcode: false }),
  token(stream, state) {
    if (stream.sol()) state.sawOpcode = false;
    if (stream.eatSpace()) return null;
    if (stream.peek() === ';') {
      const meta = stream.match(/^;\s*(name|author|strategy|assert|redcode)\b/i, false);
      stream.skipToEnd();
      return meta ? 'meta' : 'comment';
    }
    if (stream.match(/^\d+/)) return 'number';
    if (stream.match(/^[#$*@{<}>]/)) return state.sawOpcode ? 'operator' : 'operator';
    const word = stream.match(/^[A-Za-z_][\w.&]*/);
    if (word) {
      const w = word[0];
      if (OP_RE.test(w)) { state.sawOpcode = true; return 'keyword'; }
      if (PSEUDO_RE.test(w)) { state.sawOpcode = true; return 'controlKeyword'; }
      if (CONSTANTS.includes(w.toUpperCase())) return 'atom';
      // A word before the opcode is a label being defined.
      return state.sawOpcode ? 'variableName' : 'labelName';
    }
    stream.next();
    return /[-+*/%()=!<>&|]/.test(stream.current()) ? 'operator' : null;
  },
  languageData: { commentTokens: { line: ';' } },
};

// Labels and EQU names defined in a Redcode document.
export function definedNames(text) {
  const names = new Set();
  for (const line of text.split('\n')) {
    const m = /^\s*([A-Za-z_][\w]*):?(\s|$)/.exec(line.replace(/;.*/, ''));
    if (m && !OP_RE.test(m[1]) && !PSEUDO_RE.test(m[1])) names.add(m[1]);
  }
  return [...names];
}

