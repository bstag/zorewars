// The parts of CodeMirror 6 the arena's editor uses, bundled into one file
// (web/vendor/codemirror.js) by scripts/build-editor.js.
export { EditorState, Compartment, StateEffect } from '@codemirror/state';
export {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  drawSelection, dropCursor, hoverTooltip, placeholder, tooltips,
} from '@codemirror/view';
export { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo, cursorCharLeft, cursorCharRight } from '@codemirror/commands';
export {
  StreamLanguage, HighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching, indentUnit,
} from '@codemirror/language';
export { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
export { setDiagnostics, lintGutter } from '@codemirror/lint';
export { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
export { javascript } from '@codemirror/lang-javascript';
export { python } from '@codemirror/lang-python';
export { tags } from '@lezer/highlight';
