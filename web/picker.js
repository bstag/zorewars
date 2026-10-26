// The warrior picker: a searchable list of the library in place of a long
// drop-down. By default it shows the originals that can play on the current
// battlefield; the JavaScript and Python versions of a Redcode warrior and
// warriors for other battlefields are a checkbox away. Search covers names,
// families, authors and the ;strategy text.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Library entries carry their encyclopedia family; for a warrior without one
// (a file added to the library, not yet to the encyclopedia), a guess from its
// category. Order matters: "Quickscan + paper" is a hybrid, "Stone/imp" too.
const FAMILIES = [
  ['P-space', /p-space|switcher|bandit/i],
  ['Stream', /stream/i],
  ['Anti-clear', /anti-clear|sensor/i],
  ['Hybrid', /[+/]|hybrid|quickscan/i],
  ['Vampire', /vampire/i],
  ['Core clear', /clear/i],
  ['Scanner', /scan|one-shot/i],
  ['Stone', /stone|bomber|stun/i],
  ['Imp', /imp/i],
  ['Self-mover', /mover/i],
  ['Paper', /paper|replicator|silk/i],
];
export const familyOf = (category = '') => FAMILIES.find(([, re]) => re.test(category))?.[0] ?? 'Other';

export const fieldOf = (e) => (!e.battlefield ? 'ring' : e.battlefield.split('x').length > 2 ? '3d' : 'plane');
const FIELD_BADGE = { ring: '', plane: 'plane', '3d': '3D' };
const LANG_BADGE = { redcode: '', javascript: 'JS', python: 'Py' };

// The ;strategy lines (Redcode) or strategy("...") calls (generators), joined.
function strategyOf(e) {
  const parts = e.language === 'redcode'
    ? [...e.source.matchAll(/^\s*;\s*strategy\s+(.+)$/gim)].map((m) => m[1])
    : [...e.source.matchAll(/strategy\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]);
  return parts.join(' ').replace(/\\(["'`])/g, '$1').replace(/\s+/g, ' ').trim();
}
const authorOf = (e) => (e.language === 'redcode'
  ? e.source.match(/^\s*;\s*author\s+(.+)$/im)?.[1]
  : e.source.match(/author\(\s*(["'`])((?:\\.|(?!\1).)*)\1/)?.[2]) ?? '';

// A version: a conversion of another library warrior, or a hand-written
// example of the same code in another language (sameAs).
const isVersion = (e) => !!(e.convertedFrom || e.sameAs);

// ctx: { library(), fits(entry) -> true/false/undefined (unknown yet), onPick(entry) }
export function initPicker(ctx) {
  const $ = (id) => document.getElementById(id);
  const dlg = $('pickerDialog');
  const state = { family: 'All', cursor: 0, rows: [] };

  const annotate = (e) => {
    if (!e.pick) e.pick = { family: e.family ?? familyOf(e.category), strategy: strategyOf(e), author: authorOf(e), field: fieldOf(e) };
    return e.pick;
  };

  // The library under the two checkboxes: these warriors' families are the chips.
  function pool() {
    const allFields = $('pickerAllFields').checked, versions = $('pickerVersions').checked;
    return ctx.library().map((e) => ({ e, p: annotate(e), fits: ctx.fits(e) }))
      .map((x) => ({ ...x, inPool: (allFields || x.fits !== false) && (versions || !isVersion(x.e)) }));
  }

  function visible() {
    const q = $('pickerSearch').value.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    const all = pool();
    const match = (x) => words.every((w) => `${x.e.name} ${x.e.category} ${x.p.family} ${x.p.author} ${x.p.strategy} ${x.e.file}`.toLowerCase().includes(w));
    const famOk = (x) => state.family === 'All' || x.p.family === state.family;
    const shown = all.filter((x) => x.inPool && famOk(x) && match(x));
    const hidden = all.filter((x) => !shown.includes(x) && famOk(x) && match(x)).length;
    const order = $('pickerSort').value;
    shown.sort((a, b) => (a.fits === false) - (b.fits === false)
      || (order === 'family' ? a.p.family.localeCompare(b.p.family) : 0)
      || a.e.name.localeCompare(b.e.name) || a.e.file.localeCompare(b.e.file));
    return { shown, hidden };
  }

  function renderChips() {
    const fams = ['All', ...new Set(pool().filter((x) => x.inPool).map((x) => x.p.family))].sort((a, b) => (a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b)));
    if (!fams.includes(state.family)) state.family = 'All';
    $('pickerFamilies').innerHTML = fams.map((f) => `<button type="button" class="chip" aria-pressed="${f === state.family}" data-f="${esc(f)}">${esc(f)}</button>`).join('');
  }

  function render() {
    const { shown, hidden } = visible();
    state.rows = shown;
    state.cursor = Math.min(state.cursor, Math.max(0, shown.length - 1));
    $('pickerList').innerHTML = shown.map(({ e, p, fits }, i) => {
      const badges = [FIELD_BADGE[p.field], LANG_BADGE[e.language], e.convertedFrom ? 'converted' : '', e.sameAs ? 'example' : ''].filter(Boolean);
      return `<li role="option" id="pick-${i}" data-i="${i}" aria-selected="${i === state.cursor}" class="${fits === false ? 'elsewhere' : ''}">
        <div class="pick-top"><b>${esc(e.name)}</b><span class="pick-fam">${esc(p.family)}</span>${badges.map((b) => `<span class="badge">${esc(b)}</span>`).join('')}</div>
        <div class="pick-cat">${esc(e.category)}${p.author ? ` · ${esc(p.author)}` : ''}</div>
        ${p.strategy ? `<div class="pick-why">${esc(p.strategy)}</div>` : ''}
        ${fits === false ? `<div class="pick-note">Plays on ${esc(e.battlefield ? e.battlefield.replace('torus:', '') : 'the ring')}: picking it offers to switch.</div>` : ''}
      </li>`;
    }).join('') || '<li class="empty">No warriors match.</li>';
    $('pickerCount').textContent = `${shown.length} shown${hidden ? ` · ${hidden} more with the boxes below ticked` : ''}`;
    $('pickerList').setAttribute('aria-activedescendant', shown.length ? `pick-${state.cursor}` : '');
  }

  function choose(i) {
    const row = state.rows[i];
    if (!row) return;
    dlg.close();
    ctx.onPick(row.e);
  }
  function move(d) {
    if (!state.rows.length) return;
    state.cursor = (state.cursor + d + state.rows.length) % state.rows.length;
    for (const li of $('pickerList').querySelectorAll('li[data-i]')) li.setAttribute('aria-selected', String(+li.dataset.i === state.cursor));
    $(`pick-${state.cursor}`)?.scrollIntoView({ block: 'nearest' });
    $('pickerList').setAttribute('aria-activedescendant', `pick-${state.cursor}`);
  }

  $('pickerFamilies').addEventListener('click', (ev) => {
    const b = ev.target.closest('.chip');
    if (!b) return;
    state.family = b.dataset.f;
    state.cursor = 0;
    renderChips();
    render();
  });
  for (const id of ['pickerSearch', 'pickerAllFields', 'pickerVersions', 'pickerSort']) {
    $(id).addEventListener(id === 'pickerSearch' ? 'input' : 'change', () => { state.cursor = 0; if (id !== 'pickerSearch') renderChips(); render(); });
  }
  $('pickerSearch').addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); move(1); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); move(-1); }
    else if (ev.key === 'Enter') { ev.preventDefault(); choose(state.cursor); }
  });
  $('pickerList').addEventListener('click', (ev) => {
    const li = ev.target.closest('li[data-i]');
    if (li) choose(+li.dataset.i);
  });
  $('pickerClose').addEventListener('click', () => dlg.close());

  return {
    open() {
      renderChips();
      render();
      dlg.showModal();
      $('pickerSearch').focus();
      $('pickerSearch').select();
    },
    refresh() { if (dlg.open) render(); },
  };
}
