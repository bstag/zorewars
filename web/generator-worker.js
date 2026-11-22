// Runs a JavaScript warrior generator off the page thread, so an endless loop
// in half-typed code can be stopped (web/js-generator.js) and never freezes the tab.
import { generateFromJS } from '../src/engine/generator.js';

self.onmessage = ({ data: { id, source, settings } }) => {
  try {
    self.postMessage({ id, redcode: generateFromJS(source, settings) });
  } catch (e) {
    self.postMessage({ id, error: String(e?.message ?? e) });
  }
};
