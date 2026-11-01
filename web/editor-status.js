// Editor display output; the page owns DOM updates and rule-change actions.
import {listing} from '../src/engine/index.js';
export function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function compileStatusMarkup(slot) {
  const c = slot.compiled;
  if (slot.status === 'compiling') {
    return `<span class="pending">● ${escapeHtml(slot.statusText || 'Compiling…')}</span>`;
  } else if (c && !c.ok) {
    const where = slot.language === 'redcode' ? 'line' : 'Redcode line';
    return `<span class="bad">✕ ${c.errors.length} error${c.errors.length > 1 ? 's' : ''}</span><ul>${
      c.errors.map((e) => `<li>${e.line ? `${where} ${e.line}: ` : ''}${escapeHtml(e.message)}</li>`).join('')}</ul>`;
  } else if (c) {
    const warn = c.warnings.length ? ` <span class="pending">(${c.warnings.length} warning${c.warnings.length > 1 ? 's' : ''}: ${escapeHtml(c.warnings[0].message)})</span>` : '';
    return `<span class="ok">✓ ${escapeHtml(c.name)}</span> <span class="muted">by ${escapeHtml(c.author)} · ${c.instructions.length} instruction${c.instructions.length === 1 ? '' : 's'}</span>${warn}`;
  } else return '';
}
export function generatedListing(slot, settings) {
  const c = slot.compiled;
  if (c?.ok) return {code:listing(c,settings),meta:slot.language==='redcode'?'(normalised)':`(generated from ${slot.language==='python'?'Python':'JavaScript'})`};
  if (c?.redcode && slot.language!=='redcode') return {code:c.redcode,meta:'(generated, has errors)'};
  return null;
}
