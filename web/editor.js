// The code editor: CodeMirror 6 (web/vendor/codemirror.js) with Redcode
// highlighting, inline assembler errors, autocomplete and instruction help.
// If the bundle can't load, the plain textarea already on the page is used,
// behind the same small interface:
//   getValue() setValue(text) setLanguage(lang) setErrors([{line, message}])
//   insert(text) moveCursor(delta) undo() focus() hasFocus()

import { OPCODES, MODIFIERS, MODE_NAMES } from '../src/engine/index.js';

// One-line help shown in autocomplete and on hover.
const OPCODE_HELP = {
  DAT: 'Data. A process that executes it dies. Fields store numbers.',
  MOV: 'Copy A to B: a whole instruction with .I, or individual fields.',
  ADD: 'B = B + A, modulo the core size.',
  SUB: 'B = B − A.',
  MUL: 'B = B × A.',
  DIV: 'B = B ÷ A, rounded down. Dividing by zero kills the process.',
  MOD: 'B = B mod A. Dividing by zero kills the process.',
  JMP: 'Jump to A.',
  JMZ: 'Jump to A if B is zero.',
  JMN: 'Jump to A if B is not zero.',
  DJN: 'Decrement B, then jump to A if it is not zero.',
  SPL: 'Split: queue the next instruction, then a new process at A.',
  SLT: 'Skip the next instruction if A is less than B.',
  SEQ: 'Skip the next instruction if A equals B.',
  CMP: 'Old name for SEQ: skip the next instruction if A equals B.',
  SNE: 'Skip the next instruction if A does not equal B.',
  NOP: 'Do nothing.',
  LDP: 'Load from P-space cell A into B.',
  STP: 'Store A into P-space cell B.',
};
const MODIFIER_HELP = {
  A: 'A-field to A-field', B: 'B-field to B-field', AB: 'A-field to B-field', BA: 'B-field to A-field',
  F: 'both fields, A→A and B→B', X: 'both fields, crossed', I: 'the whole instruction',
};
const PSEUDO_HELP = {
  ORG: 'Where execution starts: ORG label', END: 'End of the program (optionally END label)',
  EQU: 'Named constant: name EQU expression', FOR: 'Repeat a block: counter FOR count … ROF', ROF: 'End of a FOR block',
};
const CONSTANTS = ['CORESIZE', 'MAXPROCESSES', 'MAXCYCLES', 'MAXLENGTH', 'MINDISTANCE', 'PSPACESIZE', 'CURLINE'];
const ALL_OPS = [...OPCODES, 'CMP'];
const OP_RE = new RegExp(`^(${ALL_OPS.join('|')})(\\.(AB|BA|A|B|F|X|I))?$`, 'i');
const PSEUDO_RE = /^(ORG|END|EQU|FOR|ROF|PIN)$/i;

// ---------------------------------------------------------------- Redcode mode

const redcodeMode = {
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
function definedNames(text) {
  const names = new Set();
  for (const line of text.split('\n')) {
    const m = /^\s*([A-Za-z_][\w]*):?(\s|$)/.exec(line.replace(/;.*/, ''));
    if (m && !OP_RE.test(m[1]) && !PSEUDO_RE.test(m[1])) names.add(m[1]);
  }
  return [...names];
}

function redcodeCompletions(context) {
  const word = context.matchBefore(/[A-Za-z_][\w]*(\.[A-Za-z]*)?/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  const dot = word.text.indexOf('.');
  if (dot > 0 && OP_RE.test(word.text.slice(0, dot))) {
    return {
      from: word.from + dot + 1,
      options: MODIFIERS.map((m) => ({ label: m, type: 'type', detail: MODIFIER_HELP[m] })),
    };
  }
  const text = context.state.doc.toString();
  return {
    from: word.from,
    options: [
      ...ALL_OPS.map((op) => ({ label: op, type: 'keyword', detail: OPCODE_HELP[op], boost: 2 })),
      ...Object.entries(PSEUDO_HELP).map(([op, d]) => ({ label: op, type: 'keyword', detail: d })),
      ...CONSTANTS.map((c) => ({ label: c, type: 'constant' })),
      ...definedNames(text).filter((n) => n !== word.text).map((n) => ({ label: n, type: 'variable', detail: 'label', boost: 1 })),
    ],
    validFor: /^[\w]*$/,
  };
}

// Generator API for JavaScript and Python warriors.
const API_HELP = {
  name: 'name("…"): the warrior name', author: 'author("…")', strategy: 'strategy("…"): one line of description',
  label: 'label("x"): label the next instruction', org: 'org("x"): where execution starts',
  equ: 'equ("n", value): a Redcode EQU constant', comment: 'comment("…")', raw: 'raw("…"): any line of Redcode',
  curline: 'curline(): index of the next instruction', imm: 'imm(x) → #x', dir: 'dir(x) → $x', ind: 'ind(x) → @x',
  aind: 'aind(x) → *x', predec: 'predec(x) → <x', apredec: 'apredec(x) → {x', postinc: 'postinc(x) → >x', apostinc: 'apostinc(x) → }x',
};
function apiCompletions(context) {
  const word = context.matchBefore(/[A-Za-z_]\w*(\.\w*)?/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  const dot = word.text.indexOf('.');
  if (dot > 0 && OP_RE.test(word.text.slice(0, dot))) {
    return { from: word.from + dot + 1, options: MODIFIERS.map((m) => ({ label: m.toLowerCase(), type: 'type', detail: MODIFIER_HELP[m] })) };
  }
  return {
    from: word.from,
    options: [
      ...ALL_OPS.map((op) => ({ label: op.toLowerCase(), type: 'function', detail: OPCODE_HELP[op] })),
      ...Object.entries(API_HELP).map(([k, d]) => ({ label: k, type: 'function', detail: d })),
      ...CONSTANTS.filter((c) => c !== 'CURLINE' && c !== 'PSPACESIZE').map((c) => ({ label: c, type: 'constant' })),
    ],
    validFor: /^\w*$/,
  };
}

// ---------------------------------------------------------------- textarea fallback

function textareaEditor(textarea, gutter, { onChange }) {
  let lang = 'redcode';
  let errors = [];
  const renderGutter = () => {
    const count = textarea.value.split('\n').length;
    const errLines = new Set(errors.map((e) => e.line));
    const parts = [];
    for (let i = 1; i <= count; i++) parts.push(errLines.has(i) ? `<span class="err">${i}</span>` : `${i}\n`);
    gutter.innerHTML = parts.join('');
    gutter.scrollTop = textarea.scrollTop;
  };
  textarea.addEventListener('input', () => { renderGutter(); onChange(textarea.value); });
  textarea.addEventListener('scroll', () => { gutter.scrollTop = textarea.scrollTop; });
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      api.insert(lang === 'redcode' ? '\t' : '    ');
    }
  });
  const api = {
    kind: 'textarea',
    getValue: () => textarea.value,
    setValue: (text) => { textarea.value = text; renderGutter(); },
    setLanguage: (l) => { lang = l; textarea.style.tabSize = l === 'redcode' ? 8 : 4; },
    setErrors: (list) => { errors = list; renderGutter(); },
    insert: (text) => {
      textarea.setRangeText(text, textarea.selectionStart, textarea.selectionEnd, 'end');
      textarea.dispatchEvent(new Event('input'));
    },
    moveCursor: (d) => { const p = Math.max(0, textarea.selectionStart + d); textarea.setSelectionRange(p, p); },
    undo: () => document.execCommand('undo'),
    focus: () => textarea.focus(),
    hasFocus: () => document.activeElement === textarea,
    element: textarea,
  };
  return api;
}

// ---------------------------------------------------------------- CodeMirror

// `reservedBottom()` returns the top of anything fixed over the bottom of the
// screen (the phone symbol bar), so pop-ups never cover it.
export async function createCodeEditor(container, { textarea, gutter, onChange, reservedBottom = () => Infinity }) {
  let cm;
  try {
    cm = await import('./vendor/codemirror.js');
  } catch (e) {
    console.warn('CodeMirror could not load; using the plain editor.', e);
    return textareaEditor(textarea, gutter, { onChange });
  }
  const {
    EditorState, Compartment, EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
    drawSelection, hoverTooltip, tooltips, defaultKeymap, history, historyKeymap, indentWithTab, undo,
    StreamLanguage, HighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching, indentUnit,
    autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap, setDiagnostics, lintGutter,
    searchKeymap, highlightSelectionMatches, javascript, python, tags: t,
  } = cm;

  const touch = matchMedia('(pointer: coarse)').matches;
  const redcode = StreamLanguage.define(redcodeMode);
  const languageConf = new Compartment();
  const languageFor = (lang) => {
    if (lang === 'javascript') return [javascript(), indentUnit.of('  '), EditorState.languageData.of(() => [{ autocomplete: apiCompletions }])];
    if (lang === 'python') return [python(), indentUnit.of('    '), EditorState.languageData.of(() => [{ autocomplete: apiCompletions }])];
    return [redcode, indentUnit.of('\t'), EditorState.tabSize.of(8), EditorState.languageData.of(() => [{ autocomplete: redcodeCompletions }])];
  };

  const style = HighlightStyle.define([
    { tag: t.keyword, color: '#22d3ee', fontWeight: '600' },
    { tag: t.controlKeyword, color: '#c084fc', fontWeight: '600' },
    { tag: t.labelName, color: '#f472b6' },
    { tag: [t.number, t.atom, t.bool], color: '#fbbf24' },
    { tag: t.operator, color: '#a3e635' },
    { tag: t.comment, color: '#5b6b8c', fontStyle: 'italic' },
    { tag: t.meta, color: '#7dd3fc' },
    { tag: [t.string, t.special(t.string)], color: '#86efac' },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#67e8f9' },
    { tag: t.propertyName, color: '#93c5fd' },
    { tag: [t.definitionKeyword, t.modifier, t.moduleKeyword], color: '#c084fc' },
    { tag: t.variableName, color: '#e2e8f0' },
    { tag: t.typeName, color: '#fbbf24' },
  ]);

  const theme = EditorView.theme({
    '&': { height: '100%', backgroundColor: '#060a14', color: '#cbd5e1', fontSize: touch ? '16px' : '12.5px' },
    '.cm-scroller': { fontFamily: "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace", lineHeight: '1.6' },
    '.cm-content': { caretColor: '#22d3ee', padding: '8px 0' },
    '.cm-gutters': { backgroundColor: '#080d1a', color: '#3b4a6b', borderRight: '1px solid #1e2a47' },
    '.cm-activeLine': { backgroundColor: 'rgba(34, 211, 238, 0.05)' },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(34, 211, 238, 0.08)', color: '#94a3b8' },
    '&.cm-focused .cm-cursor': { borderLeftColor: '#22d3ee' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(34, 211, 238, 0.25) !important' },
    '.cm-tooltip': { backgroundColor: '#121b33', border: '1px solid #2a3a60', color: '#e2e8f0', borderRadius: '6px' },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: '#0e7490', color: '#ecfeff' },
    '.cm-completionDetail': { color: '#94a3b8', fontStyle: 'normal', marginLeft: '0.8em' },
    '.cm-diagnostic-error': { borderLeftColor: '#f87171' },
    '.cm-lintRange-error': { backgroundImage: 'none', textDecoration: 'underline wavy #f87171', textUnderlineOffset: '3px' },
    '.zw-hover': { padding: '6px 10px', maxWidth: '320px', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '13px' },
    '.zw-hover b': { color: '#22d3ee', fontFamily: "'JetBrains Mono', monospace" },
  }, { dark: true });

  // Hover help for opcodes, modifiers and addressing modes (desktop).
  const help = hoverTooltip((view, pos) => {
    const line = view.state.doc.lineAt(pos);
    const text = line.text;
    let s = pos - line.from, e = s;
    while (s > 0 && /[\w.]/.test(text[s - 1])) s--;
    while (e < text.length && /[\w.]/.test(text[e])) e++;
    const word = text.slice(s, e);
    let html = null;
    const m = OP_RE.exec(word);
    if (m) {
      const op = m[1].toUpperCase();
      html = `<b>${op}</b> ${OPCODE_HELP[op] || ''}${m[3] ? `<br><b>.${m[3].toUpperCase()}</b> ${MODIFIER_HELP[m[3].toUpperCase()]}` : ''}`;
    } else if (PSEUDO_HELP[word.toUpperCase()]) {
      html = `<b>${word.toUpperCase()}</b> ${PSEUDO_HELP[word.toUpperCase()]}`;
    } else if (!word && MODE_NAMES[text[pos - line.from]]) {
      html = `<b>${text[pos - line.from]}</b> ${MODE_NAMES[text[pos - line.from]]}`;
      s = pos - line.from; e = s + 1;
    }
    if (!html) return null;
    return {
      pos: line.from + s, end: line.from + e, above: true,
      create: () => { const dom = document.createElement('div'); dom.className = 'zw-hover'; dom.innerHTML = html; return { dom }; },
    };
  });

  let silent = false;
  let currentLang = 'redcode';
  // A fresh state per warrior: loading code isn't an undoable edit, and undo
  // never brings back a different warrior's code.
  const makeState = (doc) => EditorState.create({
    doc,
    extensions: [
        lineNumbers(), highlightActiveLineGutter(), highlightActiveLine(), drawSelection(), history(),
        indentOnInput(), bracketMatching(), closeBrackets(), highlightSelectionMatches(), lintGutter(),
        autocompletion({ activateOnTyping: true, icons: false }),
        syntaxHighlighting(style), theme,
        // Hover help is for mice; on touch screens a tap would trigger it.
        touch ? [] : help,
        // Pop-ups (autocomplete, help) fit in the visible area above the
        // keyboard and the symbol bar, flipping above the cursor if needed.
        tooltips({
          tooltipSpace: () => {
            const vv = window.visualViewport;
            const top = vv ? vv.offsetTop : 0;
            const bottom = Math.min(vv ? vv.offsetTop + vv.height : window.innerHeight, reservedBottom());
            return { top, left: 0, right: window.innerWidth, bottom };
          },
        }),
        languageConf.of(languageFor(currentLang)),
        EditorView.contentAttributes.of({ autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': 'Warrior source code' }),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...completionKeymap, ...searchKeymap, indentWithTab]),
        EditorView.updateListener.of((u) => { if (u.docChanged && !silent) onChange(u.state.doc.toString()); }),
    ],
  });
  const view = new EditorView({ parent: container, state: makeState(textarea.value) });
  textarea.hidden = true;
  gutter.hidden = true;
  container.classList.add('has-cm');

  const lineRange = (n) => {
    const line = view.state.doc.line(Math.min(Math.max(1, n), view.state.doc.lines));
    return { from: line.from, to: Math.max(line.from, line.to) };
  };

  return {
    kind: 'codemirror',
    getValue: () => view.state.doc.toString(),
    setValue: (text) => {
      if (text === view.state.doc.toString()) return;
      silent = true;
      view.setState(makeState(text));
      silent = false;
    },
    setLanguage: (lang) => {
      if (lang === currentLang) return;
      currentLang = lang;
      view.dispatch({ effects: languageConf.reconfigure(languageFor(lang)) });
    },
    setErrors: (list) => {
      const diagnostics = list.filter((e) => e.line > 0).map((e) => ({ ...lineRange(e.line), severity: e.severity || 'error', message: e.message }));
      view.dispatch(setDiagnostics(view.state, diagnostics));
    },
    insert: (text) => {
      view.dispatch(view.state.replaceSelection(text));
      view.focus();
    },
    moveCursor: (d) => {
      const pos = Math.max(0, Math.min(view.state.doc.length, view.state.selection.main.head + d));
      view.dispatch({ selection: { anchor: pos } });
      view.focus();
    },
    undo: () => { undo(view); view.focus(); },
    focus: () => view.focus(),
    hasFocus: () => view.hasFocus,
    element: view.contentDOM,
    view,
  };
}
